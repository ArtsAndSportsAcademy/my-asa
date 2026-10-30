/**
 * Copiar de outro dia, parte 2 (H2): as vagas dos Livros do Dia. Quem faz cada personagem num show do dia de origem passa a fazer a mesma
 * vaga no Livro do mesmo show (e da mesma sessão) do dia de destino.
 *
 * Só COPIA vagas num Livro que já existe no destino: gerar os Livros continua sendo da Administração ("Gerar Escala e Livros"). Se o Livro
 * do show ainda não foi gerado no destino, a prévia diz isso e nada é copiado dele.
 *
 * Cada vaga passa pelas mesmas regras do ajuste normal: folga vence; quem não está no elenco do local; restrição de horário, limite de shows
 * do dia e atividade em outro local (`carregarRegrasDoDia`). Quem não passa fica de fora, com a frase, e a vaga segue como o Livro do destino
 * a resolveu. Show pega o elenco de onde for quando a pessoa está livre (decisão do pacote O), então aqui NÃO vale "é da equipe de outro
 * local": vale o que o motor do Livro já diz sobre a pessoa estar livre naquele horário.
 *
 * "Juntar" não mexe no que o destino já tem: vaga que alguém trocou à mão (`manual`) no destino fica como está. A vaga que o motor preencheu
 * sozinho é a que a cópia substitui. Se a pessoa copiada já está em OUTRA vaga do mesmo Livro de destino, essa outra vaga é aberta (volta a ser
 * calculada pelo motor) para ninguém ficar em dois personagens do mesmo show.
 */
import { and, asc, eq, inArray, isNull, ne, or } from "drizzle-orm";
import {
  agendaEventsTable, dailyBookAssignmentsTable, dailyBookBlocksTable, dailyBookPositionsTable, dailyBookScenesTable, dailyBooksTable, db, showBooksTable, usersTable,
} from "@workspace/db";
import type { EscalaDia } from "./escala-dia.js";
import { carregarRegrasDoDia } from "./regras-de-escala.js";
import { LeiturasDoMes } from "./leituras-do-mes.js";
import type { TrocaDeVaga } from "../routes/daily-book.js";

export type Vaga = { assignmentId: string; chave: string; personagem: string; userId: string | null; manual: boolean };
export type LivroDoDia = { id: string; showBookId: string; sessionId: string | null; status: string; version: number; agendaEventId: string; titulo: string; vagas: Vaga[] };
export type ForaDoLivro = { tipo: "livro_nao_gerado" | "livro_encerrado" | "folga" | "fora_do_elenco" | "regra" | "sem_vaga"; pessoaId?: string; pessoa?: string; frase: string };
export type PlanoDoLivro = { livro: LivroDoDia; trocas: TrocaDeVaga[]; copiadas: number; liberadas: number; jaEstava: number };

/** Os Livros de um local num dia (cancelado não conta), cada um com as suas vagas vivas, na ordem em que foram criadas. */
export async function lerLivrosDoDia(locationId: string, date: string): Promise<LivroDoDia[]> {
  const livros = await db.select({
    id: dailyBooksTable.id, showBookId: dailyBooksTable.showBookId, sessionId: dailyBooksTable.sessionId, status: dailyBooksTable.status, version: dailyBooksTable.version,
    agendaEventId: dailyBooksTable.agendaEventId, titulo: showBooksTable.title,
  }).from(dailyBooksTable)
    .innerJoin(agendaEventsTable, eq(dailyBooksTable.agendaEventId, agendaEventsTable.id))
    .innerJoin(showBooksTable, eq(dailyBooksTable.showBookId, showBooksTable.id))
    .where(and(eq(agendaEventsTable.date, date), eq(showBooksTable.locationId, locationId), ne(dailyBooksTable.status, "CANCELLED")));
  if (!livros.length) return [];
  const rows = await db.select({
    dailyBookId: dailyBookAssignmentsTable.dailyBookId, assignmentId: dailyBookAssignmentsTable.id, userId: dailyBookAssignmentsTable.userId, manual: dailyBookAssignmentsTable.manual,
    personagem: dailyBookPositionsTable.name, papel: dailyBookPositionsTable.sourceRoleId, bloco: dailyBookBlocksTable.sourceBlockId, cena: dailyBookScenesTable.sourceSceneId,
  }).from(dailyBookAssignmentsTable)
    .innerJoin(dailyBookPositionsTable, eq(dailyBookAssignmentsTable.positionId, dailyBookPositionsTable.id))
    .leftJoin(dailyBookBlocksTable, eq(dailyBookPositionsTable.blockId, dailyBookBlocksTable.id))
    .leftJoin(dailyBookScenesTable, eq(dailyBookBlocksTable.sceneId, dailyBookScenesTable.id))
    .where(and(
      inArray(dailyBookAssignmentsTable.dailyBookId, livros.map((l) => l.id)),
      ne(dailyBookAssignmentsTable.status, "REMOVED"), isNull(dailyBookAssignmentsTable.supersededAt),
      eq(dailyBookPositionsTable.isRemoved, false), isNull(dailyBookPositionsTable.supersededAt),
      or(isNull(dailyBookBlocksTable.id), eq(dailyBookBlocksTable.isRemoved, false)),
      or(isNull(dailyBookScenesTable.id), eq(dailyBookScenesTable.isRemoved, false)),
    ))
    .orderBy(asc(dailyBookPositionsTable.createdAt), asc(dailyBookAssignmentsTable.createdAt), asc(dailyBookAssignmentsTable.id));
  return livros.map((l) => {
    const contagem = new Map<string, number>();
    const vagas = rows.filter((r) => r.dailyBookId === l.id).map((r): Vaga => {
      // A vaga se reconhece de um dia para o outro pelo que vem do Livro do Show (cena, bloco e papel de origem), mais a ordem entre iguais.
      const base = `${r.cena ?? ""}|${r.bloco ?? ""}|${r.papel ?? `n:${r.personagem}`}`;
      const n = (contagem.get(base) ?? 0) + 1;
      contagem.set(base, n);
      return { assignmentId: r.assignmentId, chave: `${base}#${n}`, personagem: r.personagem, userId: r.userId, manual: r.manual };
    });
    return { id: l.id, showBookId: l.showBookId!, sessionId: l.sessionId, status: l.status, version: l.version, agendaEventId: l.agendaEventId, titulo: l.titulo ?? "Show", vagas };
  });
}

const mesmoLivro = (a: LivroDoDia, b: LivroDoDia) => a.showBookId === b.showBookId && (a.sessionId ?? null) === (b.sessionId ?? null);

/**
 * Planeja as vagas de um dia de destino. `barrar` diz se a pessoa não entra no dia (folga, fora do elenco) e devolve a frase; as regras de horário
 * e de limite do dia são conferidas aqui, uma vez por Livro, para todas as pessoas de uma vez.
 */
export async function planejarVagas(input: {
  organizationId: string; operationId: string; locationId: string; origem: string; destino: string; modo: "juntar" | "zero"; destDia: EscalaDia;
  livrosOrigem: LivroDoDia[]; livrosDestino: LivroDoDia[];
}): Promise<{ planos: PlanoDoLivro[]; foraDe: ForaDoLivro[]; vagas: number; jaEstava: number }> {
  const { destDia, modo } = input;
  const foraDe: ForaDoLivro[] = [];
  const planos: PlanoDoLivro[] = [];
  const nomes = new Map(destDia.pessoas.map((p) => [p.id, p.name]));
  const faltam = [...new Set(input.livrosOrigem.flatMap((l) => l.vagas.map((v) => v.userId)).filter((id): id is string => Boolean(id) && !nomes.has(id as string)))];
  if (faltam.length) for (const u of await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(and(inArray(usersTable.id, faltam), eq(usersTable.organizationId, input.organizationId)))) nomes.set(u.id, u.name);
  const aviso = new Map<string, ForaDoLivro>();
  const dizer = (userId: string, tipo: ForaDoLivro["tipo"], frase: (n: string) => string, onde: string) => {
    const chave = `${userId}|${tipo}|${frase("")}`;
    const nome = nomes.get(userId) ?? "Uma pessoa";
    const atual = aviso.get(chave);
    if (atual) { if (!atual.frase.includes(onde)) atual.frase = atual.frase.replace(/\.$/, `, ${onde}.`); return; }
    aviso.set(chave, { tipo, pessoaId: userId, pessoa: nome, frase: `${frase(nome)} Fica de fora de: ${onde}.` });
  };
  let vagasCopiadas = 0, jaEstavaTotal = 0;
  // As regras de cada Livro olham a Escala dos outros locais no mesmo dia (equipe por local): lidas uma vez e reaproveitadas de um Livro para o outro.
  const leituras = new LeiturasDoMes();
  for (const origem of input.livrosOrigem) {
    const comPessoa = origem.vagas.filter((v) => v.userId);
    if (!comPessoa.length) continue;
    const destino = input.livrosDestino.find((l) => mesmoLivro(l, origem));
    if (!destino) { foraDe.push({ tipo: "livro_nao_gerado", frase: `O Livro de ${origem.titulo} ainda não foi gerado neste dia, então as vagas dele não foram copiadas. A Administração gera o dia em "Gerar Escala e Livros"; depois copie de novo.` }); continue; }
    if (destino.status === "EXECUTED") { foraDe.push({ tipo: "livro_encerrado", frase: `O Livro de ${origem.titulo} deste dia já foi executado e não muda.` }); continue; }
    const regras = await carregarRegrasDoDia({ eventId: destino.agendaEventId, userIds: [...new Set(comPessoa.map((v) => v.userId!))], date: input.destino, operationId: input.operationId, leituras });
    const porChave = new Map(destino.vagas.map((v) => [v.chave, v]));
    const trocas: TrocaDeVaga[] = [];
    const ficam = new Map<string, string>(); // vaga de destino → pessoa que a cópia põe nela
    let jaEstava = 0, semVaga = 0;
    for (const v of comPessoa) {
      const alvo = porChave.get(v.chave);
      const userId = v.userId!;
      const onde = `${origem.titulo}${v.personagem ? ` · ${v.personagem}` : ""}`;
      if (!alvo) { semVaga += 1; continue; }
      const p = destDia.pessoas.find((x) => x.id === userId);
      if (!p) { dizer(userId, "fora_do_elenco", (n) => `${n} não está no elenco deste local neste dia.`, onde); continue; }
      if (p.folga && !p.chamadaNaFolga) { dizer(userId, "folga", (n) => `${n} está de folga neste dia. Folga vence a escala.`, onde); continue; }
      const regra = regras.bloqueios.get(userId);
      if (regra) { dizer(userId, "regra", (n) => `${n} ${regra}.`, onde); continue; }
      if (alvo.userId === userId) { jaEstava += 1; continue; }
      if (modo === "juntar" && alvo.manual && alvo.userId) { jaEstava += 1; continue; } // alguém já trocou esta vaga à mão: fica como está
      ficam.set(alvo.assignmentId, userId);
      trocas.push({ assignmentId: alvo.assignmentId, para: { userId, status: "ASSIGNED", manual: true } });
    }
    // A pessoa que a cópia põe numa vaga e que já estava em OUTRA vaga deste Livro deixa a outra aberta (o motor volta a preenchê-la).
    let liberadas = 0;
    for (const alvo of destino.vagas) {
      const novo = alvo.userId ? [...ficam.entries()].find(([vaga, user]) => user === alvo.userId && vaga !== alvo.assignmentId) : undefined;
      if (!novo || ficam.has(alvo.assignmentId)) continue;
      trocas.push({ assignmentId: alvo.assignmentId, para: { userId: null, status: "OPEN", manual: false } });
      liberadas += 1;
    }
    if (semVaga) foraDe.push({ tipo: "sem_vaga", frase: `${semVaga === 1 ? "Uma vaga" : `${semVaga} vagas`} de ${origem.titulo} não existe${semVaga === 1 ? "" : "m"} no Livro deste dia (o Livro do Show mudou), então não foi copiada${semVaga === 1 ? "" : "s"}.` });
    if (trocas.length) planos.push({ livro: destino, trocas, copiadas: ficam.size, liberadas, jaEstava });
    vagasCopiadas += ficam.size; jaEstavaTotal += jaEstava;
  }
  foraDe.unshift(...aviso.values());
  return { planos, foraDe, vagas: vagasCopiadas, jaEstava: jaEstavaTotal };
}
