/**
 * "Quem mexeu" na Escala (decisão de 25/10/2026): por ora a Supervisão pode mexer na escala de QUALQUER área do local em que
 * supervisiona alguma área. Para a Supervisão da pessoa afetada não ser pega de surpresa, quando uma Supervisão mexe em pessoa de OUTRA
 * área isso fica visível de três jeitos, sem pedir motivo:
 * 1. o evento do Registro leva, no `metadata`, quem mexeu, a área de quem mexeu, a pessoa, a área dela e o que foi feito;
 * 2. `GET /escalas/dia` devolve `dia.mexidas` (lista do dia, derivada desses eventos);
 * 3. UM aviso no sino por acontecimento (por pedido, não por clique nem por pessoa) para a Supervisão da área da pessoa.
 */
import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { areaLocalSupervisorsTable, areasTable, db, historyEventsTable, locationsTable, usersTable } from "@workspace/db";
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
export async function novaColeta(actor: { sub: string; role: string }, locationId: string, date: string) {
  const ehSupervisao = SUPERVISOR.includes(actor.role);
  const minhasAreas = ehSupervisao ? new Set(await areasQueSupervisiona(actor.sub, locationId)) : new Set<string>();
  const acontecimento = randomUUID();
  const itens: Item[] = [];
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

  return {
    /** A pessoa é de outra área que quem mexeu NÃO supervisiona neste local? */
    cruzada,
    /** Registra quem foi tocado e devolve o `metadata` do evento do Registro: vazio quando não é mexida de outra área. */
    async registrar(escalaId: string, lista: { pessoa: PessoaDaMexida; texto: string }[]): Promise<Record<string, unknown>> {
      const novos: Item[] = [];
      for (const { pessoa, texto } of lista) {
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
    /** UM aviso por Supervisão da área mexida (nunca para quem mexeu), por acontecimento. */
    async avisar(executor: Exec, scale: { id: string; locationId: string | null; periodStart: string; status: string }) {
      if (!itens.length || !scale.locationId) return;
      const areas = [...new Set(itens.map((i) => i.areaId).filter((id): id is string => Boolean(id)))];
      if (!areas.length) return;
      const linhas = await executor.selectDistinct({ supervisorId: areaLocalSupervisorsTable.supervisorId, areaId: areaLocalSupervisorsTable.areaId }).from(areaLocalSupervisorsTable)
        .innerJoin(usersTable, eq(usersTable.id, areaLocalSupervisorsTable.supervisorId))
        .where(and(eq(areaLocalSupervisorsTable.locationId, scale.locationId), eq(areaLocalSupervisorsTable.active, true), eq(usersTable.status, "ACTIVE"), inArray(areaLocalSupervisorsTable.areaId, areas)));
      const porSupervisor = new Map<string, Set<string>>();
      for (const l of linhas) { if (l.supervisorId === actor.sub) continue; porSupervisor.set(l.supervisorId, new Set([...(porSupervisor.get(l.supervisorId) ?? []), l.areaId])); }
      if (!porSupervisor.size) return;
      const [local] = await executor.select({ name: locationsTable.name }).from(locationsTable).where(eq(locationsTable.id, scale.locationId)).limit(1);
      const a = await dadosDoAtor();
      const publicada = scale.status === "PUBLISHED" || scale.status === "REPUBLISHED";
      for (const [supervisorId, deles] of porSupervisor) {
        const dele = itens.filter((i) => i.areaId && deles.has(i.areaId));
        const unico = dele.length === 1 ? dele[0]! : null;
        await enqueueNotification(executor as unknown as Parameters<typeof enqueueNotification>[0], {
          userId: supervisorId, type: "escala.mexeram_na_sua_area", category: "schedule", priority: "NORMAL",
          title: unico ? `${a.nome} mexeu na escala de ${unico.pessoaNome}` : `${a.nome} mexeu na escala de ${dele.length} pessoas da sua área`,
          message: unico
            ? `${local?.name ?? "Escala do dia"} · ${dataPorExtenso(scale.periodStart)}: ${a.nome}${a.areaNome ? ` (${a.areaNome})` : ""} ${unico.texto}.${publicada ? " A escala já publicada pede republicação." : ""}`
            : `${local?.name ?? "Escala do dia"} · ${dataPorExtenso(scale.periodStart)}: ${a.nome}${a.areaNome ? ` (${a.areaNome})` : ""} mexeu em ${dele.slice(0, 4).map((i) => `${i.pessoaNome} (${i.texto})`).join("; ")}${dele.length > 4 ? ` e mais ${dele.length - 4}` : ""}.${publicada ? " A escala já publicada pede republicação." : ""}`,
          entityType: "scale", entityId: scale.id, actionUrl: `${APP_ROUTES.escalas}?data=${scale.periodStart}&local=${scale.locationId}`,
        }, new Date(), { deduplicationKey: `escala-mexida:${acontecimento}:${supervisorId}` });
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
