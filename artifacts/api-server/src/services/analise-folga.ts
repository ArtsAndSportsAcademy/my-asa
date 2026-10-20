/**
 * Análise do pedido de folga: o panorama de cada dia pedido para quem vai decidir.
 *
 * Calculada na leitura, nunca gravada (como a Escala do dia), para não envelhecer: se o dia mudou,
 * a próxima leitura já mostra o novo. Reaproveita a Escala do dia (`montarEscalaDoDia`, que conta
 * o rascunho) para saber quem folga e quem trabalha, e o Livro do Dia para saber a vaga da pessoa.
 *
 * "Pode cobrir" = está na lista do Livro do Show daquela vaga (titular, substitutos, rodízio,
 * pessoa fixa, dia da semana), trabalha nesse dia, não está de folga e não está em outro show no
 * mesmo horário. Quem pode cobrir só é mostrado: quem escolhe é a Supervisão.
 */
import { and, asc, eq, gte, inArray, isNull, lte, ne } from "drizzle-orm";
import {
  agendaEventsTable, dailyBookAssignmentsTable, dailyBookPositionsTable, dailyBooksTable, db, folgaGruposTable, folgasTable, showBookLinesTable, showBooksTable, usersTable,
} from "@workspace/db";
import { operacaoDaPessoa } from "./folga-roteamento.js";
import { montarEscalaDoDia } from "./escala-dia.js";
import { fraseDoLimite, lerConfigFolga, limitesExcedidos } from "./folga-config.js";

export const LIMITE_DIAS_ANALISE = 14;

export type PessoaDoDia = { id: string; name: string };
export type VagaAnalisada = { personagem: string; pessoa: string; podeCobrir: PessoaDoDia[]; /** Quem está na lista da vaga e está de folga neste dia: só com eles existe troca. */ deFolgaNaLista: PessoaDoDia[] };
/** Para cada colega de folga no dia pedido, os dias de folga de quem pediu que ele poderia receber em troca. */
export type TrocaPossivel = { colegas: { id: string; name: string; dias: string[] }[] };
export type DiaAnalisado = {
  date: string;
  deFolga: PessoaDoDia[];
  trabalham: PessoaDoDia[];
  vagas: VagaAnalisada[];
  resultado: { da: boolean; frase: string };
  aviso: string | null;
  semEscala: boolean;
};

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const NOMES_DOS_DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const curta = (iso: string) => { const [, m, d] = iso.split("-").map(Number); return `${d} ${MESES[m! - 1]}`; };

function diasDoPedido(startDate: string, endDate: string): { dias: string[]; cortado: boolean } {
  const dias: string[] = [];
  for (let t = new Date(`${startDate}T12:00:00Z`); t <= new Date(`${endDate}T12:00:00Z`); t.setUTCDate(t.getUTCDate() + 1)) {
    if (dias.length === LIMITE_DIAS_ANALISE) return { dias, cortado: true };
    dias.push(t.toISOString().slice(0, 10));
  }
  return { dias, cortado: false };
}

/** Quem a linha do Livro do Show aceita para a vaga, conforme o tipo (mesma leitura do motor de elenco). */
function candidatosDaLinha(type: string, config: unknown): string[] {
  const cfg = (config && typeof config === "object" ? config : {}) as Record<string, unknown>;
  const ids = (v: unknown) => Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  switch (type) {
    case "TITULAR_SUBSTITUTE": return [typeof cfg.titularId === "string" ? cfg.titularId : "", ...ids(cfg.substituteIds)].filter(Boolean);
    case "ROTATION": return ids(cfg.memberIds);
    case "FIXED_PERSON": return typeof cfg.userId === "string" && cfg.userId ? [cfg.userId] : [];
    case "DAY_OF_WEEK": {
      const porDia = (cfg.dayAssignments && typeof cfg.dayAssignments === "object" ? cfg.dayAssignments : {}) as Record<string, unknown>;
      return Object.values(porDia).filter((x): x is string => typeof x === "string" && x.length > 0);
    }
    default: return [];
  }
}

const sobrepoe = (a: { inicio: string | null; fim: string | null }, b: { inicio: string | null; fim: string | null }) => {
  if (!a.inicio || !b.inicio) return true; // sem horário não dá para provar que não colide: trata como colisão
  const fimA = a.fim ?? "23:59", fimB = b.fim ?? "23:59";
  return a.inicio < fimB && b.inicio < fimA;
};
const hhmm = (v: string | null) => v ? v.slice(0, 5) : null;

type VagaBruta = { personagem: string; sourceRoleId: string | null; dailyBookId: string; locationId: string | null; inicio: string | null; fim: string | null };

async function vagasDaPessoa(userId: string, date: string): Promise<VagaBruta[]> {
  const rows = await db.select({
    personagem: dailyBookPositionsTable.name, sourceRoleId: dailyBookPositionsTable.sourceRoleId, dailyBookId: dailyBooksTable.id,
    locationId: showBooksTable.locationId, inicio: agendaEventsTable.startTime, fim: agendaEventsTable.endTime,
  }).from(dailyBookAssignmentsTable)
    .innerJoin(dailyBookPositionsTable, eq(dailyBookAssignmentsTable.positionId, dailyBookPositionsTable.id))
    .innerJoin(dailyBooksTable, eq(dailyBookAssignmentsTable.dailyBookId, dailyBooksTable.id))
    .innerJoin(agendaEventsTable, eq(dailyBooksTable.agendaEventId, agendaEventsTable.id))
    .innerJoin(showBooksTable, eq(dailyBooksTable.showBookId, showBooksTable.id))
    .where(and(
      eq(dailyBookAssignmentsTable.userId, userId), isNull(dailyBookAssignmentsTable.supersededAt), ne(dailyBookAssignmentsTable.status, "REMOVED"),
      eq(dailyBookPositionsTable.isRemoved, false), isNull(dailyBookPositionsTable.supersededAt),
      ne(dailyBooksTable.status, "CANCELLED"), eq(agendaEventsTable.date, date),
    ))
    .orderBy(asc(agendaEventsTable.startTime), asc(dailyBookPositionsTable.name));
  return rows.map((r) => ({ ...r, inicio: hhmm(r.inicio), fim: hhmm(r.fim) }));
}

/** Os horários em que cada pessoa já tem vaga neste dia, para descartar quem colide com o show da vaga. */
async function horariosOcupados(userIds: string[], date: string, ignorarLivroDe: string) {
  if (!userIds.length) return new Map<string, { inicio: string | null; fim: string | null }[]>();
  const rows = await db.select({ userId: dailyBookAssignmentsTable.userId, inicio: agendaEventsTable.startTime, fim: agendaEventsTable.endTime, dailyBookId: dailyBooksTable.id })
    .from(dailyBookAssignmentsTable)
    .innerJoin(dailyBookPositionsTable, eq(dailyBookAssignmentsTable.positionId, dailyBookPositionsTable.id))
    .innerJoin(dailyBooksTable, eq(dailyBookAssignmentsTable.dailyBookId, dailyBooksTable.id))
    .innerJoin(agendaEventsTable, eq(dailyBooksTable.agendaEventId, agendaEventsTable.id))
    .where(and(
      inArray(dailyBookAssignmentsTable.userId, userIds), isNull(dailyBookAssignmentsTable.supersededAt), ne(dailyBookAssignmentsTable.status, "REMOVED"),
      eq(dailyBookPositionsTable.isRemoved, false), isNull(dailyBookPositionsTable.supersededAt), ne(dailyBooksTable.status, "CANCELLED"), eq(agendaEventsTable.date, date),
    ));
  const mapa = new Map<string, { inicio: string | null; fim: string | null }[]>();
  for (const r of rows) {
    if (!r.userId || r.dailyBookId === ignorarLivroDe) continue;
    mapa.set(r.userId, [...(mapa.get(r.userId) ?? []), { inicio: hhmm(r.inicio), fim: hhmm(r.fim) }]);
  }
  return mapa;
}

export async function analisarPedidoDeFolga(input: { organizationId: string; userId: string; startDate: string; endDate: string }): Promise<{ dias: DiaAnalisado[]; cortado: boolean; troca: TrocaPossivel | null }> {
  const { organizationId, userId } = input;
  const [pessoa] = await db.select({ name: usersTable.name, areaId: usersTable.areaId, defaultLocationId: usersTable.defaultLocationId })
    .from(usersTable).where(and(eq(usersTable.id, userId), eq(usersTable.organizationId, organizationId))).limit(1);
  if (!pessoa) return { dias: [], cortado: false, troca: null };
  const config = await lerConfigFolga(organizationId);
  // Grupos de folga da temporada em que esta pessoa está: para avisar a Supervisão se o dia pedido
  // bate com o padrão do grupo (não bloqueia; quem decide é a Supervisão).
  const operationId = await operacaoDaPessoa(db, userId, organizationId);
  const gruposDaPessoa = operationId
    ? (await db.select({ nome: folgaGruposTable.nome, diasFolga: folgaGruposTable.diasFolga, dataInicio: folgaGruposTable.dataInicio, dataFim: folgaGruposTable.dataFim, pessoaIds: folgaGruposTable.pessoaIds })
        .from(folgaGruposTable)
        .where(and(eq(folgaGruposTable.operationId, operationId), eq(folgaGruposTable.active, true))))
        .filter((g) => g.pessoaIds.includes(userId))
    : [];
  const { dias: datas, cortado } = diasDoPedido(input.startDate, input.endDate);
  const dias: DiaAnalisado[] = [];

  for (const date of datas) {
    const vagas = await vagasDaPessoa(userId, date);
    const locais = [...new Set([...vagas.map((v) => v.locationId), pessoa.defaultLocationId].filter((id): id is string => Boolean(id)))];
    const escalas = (await Promise.all(locais.map((l) => montarEscalaDoDia(organizationId, l, date)))).filter((e): e is NonNullable<typeof e> => Boolean(e));

    const nomes = new Map<string, string>();
    const folgam = new Set<string>(), trabalham = new Set<string>();
    for (const e of escalas) {
      for (const p of e.pessoas) { nomes.set(p.id, p.name); if (p.folga) folgam.add(p.id); }
      for (const b of e.blocos) for (const id of b.pessoaIds) trabalham.add(id);
    }
    for (const id of folgam) trabalham.delete(id);
    const semEscala = escalas.every((e) => e.blocos.length === 0);
    const lista = (ids: Set<string>): PessoaDoDia[] => [...ids].map((id) => ({ id, name: nomes.get(id) ?? "—" })).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

    // Quem cada vaga aceita, pelas linhas do Livro do Show (a "lista de substituições").
    const roleIds = [...new Set(vagas.map((v) => v.sourceRoleId).filter((id): id is string => Boolean(id)))];
    const linhas = roleIds.length ? await db.select({ positionId: showBookLinesTable.positionId, type: showBookLinesTable.type, config: showBookLinesTable.config })
      .from(showBookLinesTable).where(and(inArray(showBookLinesTable.positionId, roleIds), eq(showBookLinesTable.active, true))) : [];
    const aceitos = new Map<string, Set<string>>();
    for (const l of linhas) aceitos.set(l.positionId, new Set([...(aceitos.get(l.positionId) ?? []), ...candidatosDaLinha(l.type, l.config)]));

    const vagasAnalisadas: VagaAnalisada[] = [];
    const semSubstituto: string[] = [], semQuemCubra: string[] = [];
    for (const v of vagas) {
      const lista0 = [...(v.sourceRoleId ? aceitos.get(v.sourceRoleId) ?? [] : [])].filter((id) => id !== userId);
      const ocupados = await horariosOcupados(lista0, date, v.dailyBookId);
      const cobre = lista0.filter((id) => trabalham.has(id) && !folgam.has(id) && !(ocupados.get(id) ?? []).some((h) => sobrepoe(h, v))).sort();
      if (!lista0.length) semSubstituto.push(v.personagem); else if (!cobre.length) semQuemCubra.push(v.personagem);
      // nomes de quem não aparece na Escala (fora de área, por exemplo) vêm direto do cadastro
      const faltam = cobre.filter((id) => !nomes.has(id));
      if (faltam.length) for (const u of await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(inArray(usersTable.id, faltam))) nomes.set(u.id, u.name);
      vagasAnalisadas.push({ personagem: v.personagem, pessoa: pessoa.name, podeCobrir: cobre.map((id) => ({ id, name: nomes.get(id) ?? "—" })), deFolgaNaLista: lista0.filter((id) => folgam.has(id)).map((id) => ({ id, name: nomes.get(id) ?? "—" })) });
    }

    let resultado: DiaAnalisado["resultado"];
    if (folgam.has(userId)) resultado = { da: true, frase: `${pessoa.name} já está de folga nesse dia.` };
    else if (semEscala && !vagas.length) resultado = { da: true, frase: "Este dia ainda não tem Escala nem Livro do Dia, então não há o que conferir: decida pelo que você sabe do dia." };
    else if (!vagas.length) resultado = { da: true, frase: `${pessoa.name} não tem vaga em show nesse dia.` };
    else if (semSubstituto.length) resultado = { da: false, frase: `Não dá: ${semSubstituto.join(", ")} não tem substituto cadastrado no Livro do Show.` };
    else if (semQuemCubra.length) resultado = { da: false, frase: `Não dá: ninguém da lista de substituições de ${semQuemCubra.join(", ")} trabalha nesse dia e está livre.` };
    else resultado = { da: true, frase: `Dá. ${vagas.map((v) => v.personagem).join(", ")} ${vagas.length > 1 ? "ficam cobertas" : "fica coberta"}.` };

    // Aviso de cobertura da área: só avisa, nunca bloqueia.
    let aviso: string | null = null;
    const limite = pessoa.areaId ? config.limiteFolgaPorArea[pessoa.areaId] : undefined;
    if (config.limiteAreaAtivo && pessoa.areaId && typeof limite === "number") {
      const daArea = escalas.flatMap((e) => e.pessoas).filter((p) => p.areaId === pessoa.areaId);
      const jaDeFolga = new Set(daArea.filter((p) => folgam.has(p.id)).map((p) => p.id));
      const comEla = jaDeFolga.size + (jaDeFolga.has(userId) ? 0 : 1);
      if (comEla > limite) aviso = `Com ${pessoa.name}, ${daArea[0]?.areaName ?? "a área"} fica com ${comEla} de folga no ${curta(date)} (o limite é ${limite}).`;
    }

    // Limite total de folgas por dia (a casa toda): só aparece se a Administração ligou.
    if (config.limiteTotalAtivo && typeof config.limiteTotal === "number") {
      const total = (await limitesExcedidos({ organizationId, pessoas: [{ id: userId, areaId: pessoa.areaId }], dates: [date], config })).find((e) => e.tipo === "TOTAL");
      if (total) aviso = [aviso, fraseDoLimite(total)].filter(Boolean).join(" ");
    }

    // Grupo de folga da temporada: a Supervisão precisa saber se o dia pedido é a folga do grupo da pessoa
    // (então talvez já esteja de folga) ou se foge do padrão do grupo. Só avisa; quem decide é a Supervisão.
    const diaDaSemana = new Date(`${date}T12:00:00Z`).getUTCDay();
    for (const grupo of gruposDaPessoa) {
      const porDiaDaSemana = grupo.diasFolga.length > 0;
      const diasTexto = grupo.diasFolga.map((d) => NOMES_DOS_DIAS[d]).join(" e ");
      const eFolgaDoGrupo = porDiaDaSemana ? grupo.diasFolga.includes(diaDaSemana) : Boolean(grupo.dataInicio && grupo.dataFim && date >= grupo.dataInicio && date <= grupo.dataFim);
      let avisoGrupo: string | null = null;
      if (eFolgaDoGrupo) avisoGrupo = `Grupo "${grupo.nome}": este dia já é de folga do grupo desta pessoa${porDiaDaSemana ? ` (${diasTexto})` : ""}. Se o grupo já foi aplicado, ela já está de folga; confira antes de decidir.`;
      else if (porDiaDaSemana) avisoGrupo = `Grupo "${grupo.nome}": a folga fixa desta pessoa é ${diasTexto}; este dia foge do padrão do grupo.`;
      if (avisoGrupo) aviso = [aviso, avisoGrupo].filter(Boolean).join(" ");
    }

    dias.push({ date, deFolga: lista(folgam), trabalham: lista(trabalham), vagas: vagasAnalisadas, resultado, aviso, semEscala });
  }
  const troca = input.startDate === input.endDate && dias[0] ? await trocasPossiveis(userId, input.startDate, dias[0].vagas.flatMap((v) => v.deFolgaNaLista)) : null;
  return { dias, cortado, troca };
}

const HORIZONTE_DE_TROCA_DIAS = 120;
/** Os dias soltos de folga (DAY_OFF) de uma pessoa a partir de uma data, em ordem. */
async function diasDeFolga(userIds: string[], desde: string, ate: string): Promise<Map<string, Set<string>>> {
  const rows = await db.select({ userId: folgasTable.userId, startDate: folgasTable.startDate, endDate: folgasTable.endDate }).from(folgasTable)
    .where(and(inArray(folgasTable.userId, userIds), eq(folgasTable.status, "ACTIVE"), eq(folgasTable.type, "DAY_OFF"), lte(folgasTable.startDate, ate), gte(folgasTable.endDate, desde)));
  const mapa = new Map<string, Set<string>>(userIds.map((id) => [id, new Set<string>()]));
  for (const r of rows) {
    for (let t = new Date(`${r.startDate < desde ? desde : r.startDate}T12:00:00Z`); t.toISOString().slice(0, 10) <= (r.endDate > ate ? ate : r.endDate); t.setUTCDate(t.getUTCDate() + 1)) mapa.get(r.userId)!.add(t.toISOString().slice(0, 10));
  }
  return mapa;
}

async function trocasPossiveis(userId: string, dataPedida: string, candidatos: PessoaDoDia[]): Promise<TrocaPossivel | null> {
  const unicos = [...new Map(candidatos.map((c) => [c.id, c])).values()];
  if (!unicos.length) return null;
  const ate = new Date(`${dataPedida}T12:00:00Z`); ate.setUTCDate(ate.getUTCDate() + HORIZONTE_DE_TROCA_DIAS);
  const limite = ate.toISOString().slice(0, 10);
  const mapa = await diasDeFolga([userId, ...unicos.map((c) => c.id)], dataPedida, limite);
  const dela = [...(mapa.get(userId) ?? [])].filter((d) => d !== dataPedida).sort();
  const colegas = unicos.map((c) => ({ ...c, dias: dela.filter((d) => !(mapa.get(c.id)?.has(d))) })).filter((c) => c.dias.length > 0);
  return colegas.length ? { colegas } : null;
}
