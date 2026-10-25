/**
 * "Quem mexeu" na Escala (decisão de 25/10/2026): por ora a Supervisão pode mexer na escala de QUALQUER área do local em que
 * supervisiona alguma área. Para a Supervisão da pessoa afetada não ser pega de surpresa, quando uma Supervisão mexe em pessoa de OUTRA
 * área isso fica visível de três jeitos, sem pedir motivo:
 * 1. o evento do Registro leva, no `metadata`, quem mexeu, a área de quem mexeu, a pessoa, a área dela e o que foi feito;
 * 2. `GET /escalas/dia` devolve `dia.mexidas` (lista do dia, derivada desses eventos);
 * 3. UM aviso no sino por acontecimento (por pedido, não por clique nem por pessoa) para a Supervisão da área da pessoa.
 *
 * Etapa 7 (25/10/2026): enquanto a Escala é rascunho, a Supervisão "envia a parte da área" (marca de pronta). Se OUTRA pessoa mexe numa pessoa
 * dessa área depois, a marca cai sozinha e a Supervisão da área é avisada (junto do aviso acima, quando for o mesmo acontecimento, para não
 * chegarem dois). Quem supervisiona a área e mexe nela ele mesmo continua com a parte enviada: viu o que fez.
 */
import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { areaLocalSupervisorsTable, areasTable, db, escalaAreasProntasTable, historyEventsTable, locationsTable, usersTable } from "@workspace/db";
import { writeHistoryEvent, type HistoryExecutor } from "../lib/history-helper.js";
import { enqueueNotification } from "./undo.js";
import { APP_ROUTES } from "../lib/app-routes.js";

type Exec = typeof db;
const SUPERVISOR = ["SUPERVISOR_A", "SUPERVISOR_B"];
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const dataPorExtenso = (iso: string) => { const [, m, d] = iso.split("-").map(Number); return `${d} de ${MESES[m! - 1]}`; };

/** As áreas que esta pessoa supervisiona neste local (vazio = não supervisiona nada aqui). */
export async function areasQueSupervisiona(supervisorId: string, locationId: string, executor: Exec = db): Promise<string[]> {
  const rows = await executor.select({ areaId: areaLocalSupervisorsTable.areaId }).from(areaLocalSupervisorsTable).where(and(
    eq(areaLocalSupervisorsTable.supervisorId, supervisorId), eq(areaLocalSupervisorsTable.locationId, locationId), eq(areaLocalSupervisorsTable.active, true),
  ));
  return rows.map((r) => r.areaId);
}

export type PessoaDaMexida = { id: string; name: string; areaId: string | null };
export type MexidaDoDia = { pessoaId: string; pessoaNome: string; pessoaAreaNome: string | null; porId: string; porNome: string; porAreaNome: string | null; em: string; texto: string };

type Item = { pessoaId: string; pessoaNome: string; pessoaAreaNome: string | null; areaId: string | null; texto: string };

/**
 * Um pedido (um clique, ou um lote) = uma coleta. Cada pessoa tocada passa por `registrar` (devolve o que vai no `metadata` do evento do Registro)
 * e, no fim, `avisar` manda UM aviso por Supervisão afetada. A Administração nunca é "mexida de outra área".
 */
export async function novaColeta(actor: { sub: string; role: string; organizationId?: string | null }, locationId: string, date: string) {
  const ehSupervisao = SUPERVISOR.includes(actor.role);
  const minhasAreas = ehSupervisao ? new Set(await areasQueSupervisiona(actor.sub, locationId)) : new Set<string>();
  const acontecimento = randomUUID();
  const itens: Item[] = [];
  /** Toda pessoa tocada neste pedido (de qualquer área): é o que derruba a marca de "pronta" da área dela. */
  const tocadas: { areaId: string; pessoaNome: string; texto: string }[] = [];
  const naoCruzadas: (string | null)[] = [];
  const nomesDeArea = new Map<string, string | null>();
  let ator: { nome: string; areaNome: string | null } | null = null;

  const nomeDaArea = async (areaId: string | null) => {
    if (!areaId) return null;
    if (!nomesDeArea.has(areaId)) { const [a] = await db.select({ name: areasTable.name }).from(areasTable).where(eq(areasTable.id, areaId)).limit(1); nomesDeArea.set(areaId, a?.name ?? null); }
    return nomesDeArea.get(areaId) ?? null;
  };
  const dadosDoAtor = async () => {
    if (!ator) {
      const [u] = await db.select({ name: usersTable.name, areaId: usersTable.areaId }).from(usersTable).where(eq(usersTable.id, actor.sub)).limit(1);
      ator = { nome: u?.name ?? "A Supervisão", areaNome: await nomeDaArea(u?.areaId ?? [...minhasAreas][0] ?? null) };
    }
    return ator;
  };
  const cruzada = (p: PessoaDaMexida) => ehSupervisao && (!p.areaId || !minhasAreas.has(p.areaId));

  /**
   * A Escala ainda é rascunho e a área da pessoa tocada já tinha enviado a parte? A marca cai (com Registro) e devolve as áreas que caíram.
   * Não cai quando quem mexeu supervisiona aquela área neste local.
   */
  const derrubarProntas = async (executor: Exec, scale: { id: string; status: string; operationId?: string }): Promise<Map<string, string>> => {
    const caiu = new Map<string, string>();
    if (scale.status !== "DRAFT" || !tocadas.length) return caiu;
    const alvo = [...new Set(tocadas.map((t) => t.areaId))].filter((id) => !minhasAreas.has(id));
    if (!alvo.length) return caiu;
    const prontas = await executor.select().from(escalaAreasProntasTable).where(and(
      eq(escalaAreasProntasTable.scaleId, scale.id), inArray(escalaAreasProntasTable.areaId, alvo), eq(escalaAreasProntasTable.active, true),
    ));
    if (!prontas.length) return caiu;
    const a = await dadosDoAtor();
    for (const pronta of prontas) {
      await executor.update(escalaAreasProntasTable).set({ active: false, unmarkedBy: actor.sub, unmarkedAt: new Date() }).where(eq(escalaAreasProntasTable.id, pronta.id));
      const nome = (await nomeDaArea(pronta.areaId)) ?? "a área";
      caiu.set(pronta.areaId, nome);
      const dela = tocadas.filter((t) => t.areaId === pronta.areaId);
      await writeHistoryEvent({
        category: "SCALE", action: "escala.area_pronta_caiu", title: "Parte enviada de uma área voltou a ser editada",
        narrative: `A marca de pronta de ${nome} saiu porque ${a.nome} mexeu na escala depois: ${dela.slice(0, 3).map((t) => t.texto).join("; ")}${dela.length > 3 ? ` e mais ${dela.length - 3}` : ""}.`,
        entityType: "scale", entityId: scale.id, actorId: actor.sub, operationId: scale.operationId, orgId: actor.organizationId ?? undefined,
        beforeState: { areaId: pronta.areaId, pronta: true }, afterState: { areaId: pronta.areaId, pronta: false },
        metadata: { prontaCaiu: true, areaId: pronta.areaId, porId: actor.sub, porNome: a.nome },
      }, executor as unknown as HistoryExecutor);
    }
    return caiu;
  };

  return {
    /** A pessoa é de outra área que quem mexeu NÃO supervisiona neste local? */
    cruzada,
    /** Registra quem foi tocado e devolve o `metadata` do evento do Registro: vazio quando não é mexida de outra área. */
    async registrar(escalaId: string, lista: { pessoa: PessoaDaMexida; texto: string }[]): Promise<Record<string, unknown>> {
      const novos: Item[] = [];
      for (const { pessoa, texto } of lista) {
        if (pessoa.areaId) tocadas.push({ areaId: pessoa.areaId, pessoaNome: pessoa.name, texto });
        if (!cruzada(pessoa)) { naoCruzadas.push(pessoa.areaId); continue; }
        novos.push({ pessoaId: pessoa.id, pessoaNome: pessoa.name, pessoaAreaNome: await nomeDaArea(pessoa.areaId), areaId: pessoa.areaId, texto });
      }
      if (!novos.length) return {};
      itens.push(...novos);
      const a = await dadosDoAtor();
      return { mexidaDeOutraArea: true, escalaId, porId: actor.sub, porNome: a.nome, porAreaNome: a.areaNome, mexidas: novos.map(({ areaId: _area, ...resto }) => resto) };
    },
    /** Para o aviso de "a escala mudou depois de publicada": a Supervisão da área mexida recebe o aviso de quem mexeu, não dois. */
    paraARepublicacao(): { areaIds?: (string | null)[]; soAdministracao?: boolean } {
      if (!itens.length) return {};
      return naoCruzadas.length ? { areaIds: naoCruzadas } : { soAdministracao: true };
    },
    /**
     * Derruba a marca de pronta das áreas tocadas (Escala em rascunho) e manda UM aviso por Supervisão afetada (nunca para quem mexeu), por
     * acontecimento: quem é da área mexida e também teve a marca derrubada recebe tudo numa mensagem só.
     */
    async avisar(executor: Exec, scale: { id: string; locationId: string | null; periodStart: string; status: string; operationId?: string }) {
      if (!scale.locationId) return;
      const caiu = await derrubarProntas(executor, scale);
      const areas = [...new Set(itens.map((i) => i.areaId).filter((id): id is string => Boolean(id)))];
      const areasCaidas = [...caiu.keys()];
      if (!areas.length && !areasCaidas.length) return;
      const supervisoresDe = async (areaIds: string[]) => {
        const porSup = new Map<string, Set<string>>();
        if (!areaIds.length) return porSup;
        const linhas = await executor.selectDistinct({ supervisorId: areaLocalSupervisorsTable.supervisorId, areaId: areaLocalSupervisorsTable.areaId }).from(areaLocalSupervisorsTable)
          .innerJoin(usersTable, eq(usersTable.id, areaLocalSupervisorsTable.supervisorId))
          .where(and(eq(areaLocalSupervisorsTable.locationId, scale.locationId!), eq(areaLocalSupervisorsTable.active, true), eq(usersTable.status, "ACTIVE"), inArray(areaLocalSupervisorsTable.areaId, areaIds)));
        for (const l of linhas) { if (l.supervisorId === actor.sub) continue; porSup.set(l.supervisorId, new Set([...(porSup.get(l.supervisorId) ?? []), l.areaId])); }
        return porSup;
      };
      const porSupervisor = await supervisoresDe(areas);
      const porSupervisorCaida = await supervisoresDe(areasCaidas);
      if (!porSupervisor.size && !porSupervisorCaida.size) return;
      const [local] = await executor.select({ name: locationsTable.name }).from(locationsTable).where(eq(locationsTable.id, scale.locationId)).limit(1);
      const a = await dadosDoAtor();
      const publicada = scale.status === "PUBLISHED" || scale.status === "REPUBLISHED";
      const frasePronta = (supervisorId: string) => {
        const nomes = [...(porSupervisorCaida.get(supervisorId) ?? [])].map((id) => caiu.get(id)).filter(Boolean);
        return nomes.length ? ` A parte enviada de ${nomes.join(" e ")} voltou a ser editada: confira e envie de novo.` : "";
      };
      const url = `${APP_ROUTES.escalas}?data=${scale.periodStart}&local=${scale.locationId}`;
      for (const [supervisorId, deles] of porSupervisor) {
        const dele = itens.filter((i) => i.areaId && deles.has(i.areaId));
        const unico = dele.length === 1 ? dele[0]! : null;
        await enqueueNotification(executor as unknown as Parameters<typeof enqueueNotification>[0], {
          userId: supervisorId, type: "escala.mexeram_na_sua_area", category: "schedule", priority: "NORMAL",
          title: unico ? `${a.nome} mexeu na escala de ${unico.pessoaNome}` : `${a.nome} mexeu na escala de ${dele.length} pessoas da sua área`,
          message: unico
            ? `${local?.name ?? "Escala do dia"} · ${dataPorExtenso(scale.periodStart)}: ${a.nome}${a.areaNome ? ` (${a.areaNome})` : ""} ${unico.texto}.${publicada ? " A escala já publicada pede republicação." : ""}${frasePronta(supervisorId)}`
            : `${local?.name ?? "Escala do dia"} · ${dataPorExtenso(scale.periodStart)}: ${a.nome}${a.areaNome ? ` (${a.areaNome})` : ""} mexeu em ${dele.slice(0, 4).map((i) => `${i.pessoaNome} (${i.texto})`).join("; ")}${dele.length > 4 ? ` e mais ${dele.length - 4}` : ""}.${publicada ? " A escala já publicada pede republicação." : ""}${frasePronta(supervisorId)}`,
          entityType: "scale", entityId: scale.id, actionUrl: url,
        }, new Date(), { deduplicationKey: `escala-mexida:${acontecimento}:${supervisorId}` });
      }
      // Supervisão cuja área teve a marca derrubada por alguém da própria área (ex.: a Administração): aviso só da marca.
      for (const [supervisorId, deles] of porSupervisorCaida) {
        if (porSupervisor.has(supervisorId)) continue;
        const nomes = [...deles].map((id) => caiu.get(id)).filter(Boolean);
        const toques = tocadas.filter((t) => deles.has(t.areaId));
        await enqueueNotification(executor as unknown as Parameters<typeof enqueueNotification>[0], {
          userId: supervisorId, type: "escala.parte_voltou_a_editar", category: "schedule", priority: "IMPORTANT",
          title: `A parte enviada de ${nomes.join(" e ")} voltou a ser editada`,
          message: `${local?.name ?? "Escala do dia"} · ${dataPorExtenso(scale.periodStart)}: ${a.nome} mexeu em ${toques.slice(0, 3).map((t) => `${t.pessoaNome} (${t.texto})`).join("; ")}${toques.length > 3 ? ` e mais ${toques.length - 3}` : ""}. Confira e envie a parte de novo.`,
          entityType: "scale", entityId: scale.id, actionUrl: url,
        }, new Date(), { deduplicationKey: `escala-parte-voltou:${acontecimento}:${supervisorId}` });
      }
    },
  };
}

/** A lista de "quem mexeu" do dia: só mexidas de Supervisão em pessoa de outra área, a mais recente primeiro. */
export async function mexidasDoDia(escalaId: string | null | undefined, executor: Exec = db): Promise<MexidaDoDia[]> {
  if (!escalaId) return [];
  const rows = await executor.select({ createdAt: historyEventsTable.createdAt, metadata: historyEventsTable.metadata }).from(historyEventsTable)
    .where(and(sql`${historyEventsTable.metadata}->>'mexidaDeOutraArea' = 'true'`, sql`${historyEventsTable.metadata}->>'escalaId' = ${escalaId}`))
    .orderBy(desc(historyEventsTable.createdAt)).limit(100);
  return rows.flatMap((r) => {
    const m = (r.metadata ?? {}) as { porId?: string; porNome?: string; porAreaNome?: string | null; mexidas?: { pessoaId: string; pessoaNome: string; pessoaAreaNome: string | null; texto: string }[] };
    return (m.mexidas ?? []).map((x) => ({ pessoaId: x.pessoaId, pessoaNome: x.pessoaNome, pessoaAreaNome: x.pessoaAreaNome ?? null, porId: m.porId ?? "", porNome: m.porNome ?? "", porAreaNome: m.porAreaNome ?? null, em: r.createdAt.toISOString(), texto: x.texto }));
  });
}
