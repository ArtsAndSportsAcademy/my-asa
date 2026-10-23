import { eq, and, inArray, lte, gte, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { carregarRegrasDoDia, chaveDeEvitar, type EventoConhecido } from "./regras-de-escala.js";
import { janelaDoMes, lembrarOuLer, type LeiturasDoMes } from "./leituras-do-mes.js";
import {
  showBookScenesTable,
  showBookBlocksTable,
  showBookRolesTable,
  showBookLinesTable,
  showBookKeyframesTable,
  usersTable,
  userRolesTable,
  restrictionsTable,
  folgasTable,
  rotationDailyAdvancesTable,
  characterCastTable,
  charactersTable,
  isSchedulableMember,
} from "@workspace/db";
import { operationalDate } from "../lib/operational-date.js";

// ─── Tree building (shared with show-book route) ──────────────────────────────

type TreeExecutor = Pick<typeof db, "select">;

async function fetchAllLines(positionIds: string[], executor: TreeExecutor = db) {
  if (positionIds.length === 0) return {} as Record<string, (typeof showBookLinesTable.$inferSelect)[]>;
  // Uma única leitura evita abrir uma conexão por posição. Além de reduzir a
  // carga no pool do Supabase, mantém a árvore consistente na mesma consulta.
  const allLines = await executor
    .select()
    .from(showBookLinesTable)
    .where(and(inArray(showBookLinesTable.positionId, positionIds), eq(showBookLinesTable.active, true)))
    .orderBy(showBookLinesTable.positionId, showBookLinesTable.order, showBookLinesTable.id);
  const map: Record<string, (typeof showBookLinesTable.$inferSelect)[]> = {};
  positionIds.forEach((pid) => { map[pid] = []; });
  allLines.forEach((line) => { map[line.positionId]?.push(line); });
  return map;
}

export async function buildShowBookTree(showBookId: string, executor: TreeExecutor = db) {
  const scenes = await executor
    .select().from(showBookScenesTable)
    .where(and(eq(showBookScenesTable.showBookId, showBookId), eq(showBookScenesTable.active, true)))
    .orderBy(showBookScenesTable.order, showBookScenesTable.id);

  const blocks = await executor
    .select().from(showBookBlocksTable)
    .where(and(eq(showBookBlocksTable.showBookId, showBookId), eq(showBookBlocksTable.active, true)))
    .orderBy(showBookBlocksTable.order, showBookBlocksTable.id);

  const positions = await executor
    .select().from(showBookRolesTable)
    .where(and(eq(showBookRolesTable.showBookId, showBookId), eq(showBookRolesTable.active, true)))
    .orderBy(showBookRolesTable.order, showBookRolesTable.id);

  const keyframes = await executor
    .select()
    .from(showBookKeyframesTable)
    .where(and(inArray(showBookKeyframesTable.sceneId, scenes.map((scene) => scene.id)), eq(showBookKeyframesTable.active, true)))
    .orderBy(showBookKeyframesTable.sceneId, showBookKeyframesTable.order, showBookKeyframesTable.id);

  const linesMap = await fetchAllLines(positions.map((p) => p.id), executor);

  const posWithLines = positions.map((p) => ({ ...p, lines: linesMap[p.id] ?? [] }));

  const posByBlock: Record<string, typeof posWithLines> = {};
  posWithLines.forEach((p) => {
    const key = p.blockId ?? "__none";
    if (!posByBlock[key]) posByBlock[key] = [];
    posByBlock[key]!.push(p);
  });

  const blocksWithPos = blocks.map((b) => ({ ...b, positions: posByBlock[b.id] ?? [] }));

  const blocksByScene: Record<string, typeof blocksWithPos> = {};
  blocksWithPos.forEach((b) => {
    const key = b.sceneId ?? "__none";
    if (!blocksByScene[key]) blocksByScene[key] = [];
    blocksByScene[key]!.push(b);
  });

  const keyframesByScene: Record<string, typeof keyframes> = {};
  keyframes.forEach((frame) => { (keyframesByScene[frame.sceneId] ??= []).push(frame); });

  return scenes.map((s) => ({ ...s, blocks: blocksByScene[s.id] ?? [], keyframes: keyframesByScene[s.id] ?? [] }));
}

/** Reservas do grupo (0079): quem cobre qualquer posição DO GRUPO quando o titular não pode, na ordem cadastrada. Patinadores e bailarinos da mesma cena têm listas separadas. */
export function reservasDoGrupo(block: { reserveIds?: unknown }): string[] {
  return Array.isArray(block.reserveIds) ? [...new Set(block.reserveIds.filter((x): x is string => typeof x === "string" && x.length > 0))] : [];
}

// Coleta todos os userIds referenciados nas configs das linhas.
export function collectUserIdsFromConfig(config: unknown): string[] {
  if (!config || typeof config !== "object") return [];
  const c = config as Record<string, unknown>;
  const ids: string[] = [];
  if (typeof c.userId === "string") ids.push(c.userId);
  if (typeof c.titularId === "string") ids.push(c.titularId);
  if (Array.isArray(c.substituteIds)) ids.push(...c.substituteIds.filter((x): x is string => typeof x === "string"));
  if (Array.isArray(c.memberIds)) ids.push(...c.memberIds.filter((x): x is string => typeof x === "string"));
  if (c.dayAssignments && typeof c.dayAssignments === "object") {
    for (const v of Object.values(c.dayAssignments as Record<string, unknown>)) {
      if (typeof v === "string") ids.push(v);
    }
  }
  return ids;
}

// ─── Availability ─────────────────────────────────────────────────────────────

/**
 * Retorna o conjunto de userIds indisponíveis numa data (folga/atestado/restrição
 * ativos cobrindo a data). `dateISO` no formato "YYYY-MM-DD".
 */
export async function getUnavailableUserIds(operationId: string, dateISO: string): Promise<Set<string>> {
  const unavailable = new Set<string>();

  const folgas = await db
    .select({ userId: folgasTable.userId })
    .from(folgasTable)
    .where(
      and(
        eq(folgasTable.operationId, operationId),
        eq(folgasTable.status, "ACTIVE"),
        lte(folgasTable.startDate, dateISO),
        gte(folgasTable.endDate, dateISO)
      )
    );
  folgas.forEach((f) => unavailable.add(f.userId));

  const restrictions = await db
    .select({ userId: restrictionsTable.userId })
    .from(restrictionsTable)
    .where(
      and(
        eq(restrictionsTable.status, "ACTIVE"),
        lte(restrictionsTable.periodStart, dateISO),
        gte(restrictionsTable.periodEnd, dateISO)
      )
    );
  restrictions.forEach((r) => unavailable.add(r.userId));

  return unavailable;
}

/**
 * O mesmo que `getUnavailableUserIds`, mas lendo folgas e restrições do MÊS inteiro de uma vez e escolhendo o dia aqui
 * (mesmas comparações do banco). Sem `leituras`, é a leitura de sempre. Devolve um conjunto novo a cada chamada.
 */
export async function getUnavailableUserIdsComLeituras(operationId: string, dateISO: string, leituras?: LeiturasDoMes): Promise<Set<string>> {
  if (!leituras) return getUnavailableUserIds(operationId, dateISO);
  const { inicio, fim } = janelaDoMes(dateISO);
  const [folgas, restrictions] = await Promise.all([
    leituras.lembrar(`folgas-do-mes:${operationId}:${inicio}`, () => db
      .select({ userId: folgasTable.userId, startDate: folgasTable.startDate, endDate: folgasTable.endDate })
      .from(folgasTable)
      .where(and(eq(folgasTable.operationId, operationId), eq(folgasTable.status, "ACTIVE"), lte(folgasTable.startDate, fim), gte(folgasTable.endDate, inicio)))),
    leituras.lembrar(`restricoes-do-mes:${inicio}`, () => db
      .select({ userId: restrictionsTable.userId, periodStart: restrictionsTable.periodStart, periodEnd: restrictionsTable.periodEnd })
      .from(restrictionsTable)
      .where(and(eq(restrictionsTable.status, "ACTIVE"), lte(restrictionsTable.periodStart, fim), gte(restrictionsTable.periodEnd, inicio)))),
  ]);
  const unavailable = new Set<string>();
  for (const f of folgas) if (f.startDate <= dateISO && f.endDate >= dateISO) unavailable.add(f.userId);
  for (const r of restrictions) if (r.periodStart <= dateISO && r.periodEnd >= dateISO) unavailable.add(r.userId);
  return unavailable;
}

// ─── Resolver ─────────────────────────────────────────────────────────────────

export type ResolvedStatus = "COVERED" | "UNCOVERED" | "INACTIVE";

export interface ResolvedPerson {
  userId: string;
  name: string;
}

export interface ResolvedLine {
  lineId: string;
  type: string;
  status: ResolvedStatus;
  people: ResolvedPerson[];
  note?: string;
  /** Para ROTATION: a pessoa cujo contador deveria avançar se a escala for efetivada. */
  rotationAdvanceUserId?: string;
  /** Linha marcada como "fixo do dia": mesma pessoa em todos os shows do dia. */
  fixedForDay?: boolean;
}

export interface ResolvedPosition {
  positionId: string;
  name: string;
  minimumCoverage: number;
  lines: ResolvedLine[];
}

export interface ResolvedBlock {
  blockId: string;
  name: string;
  positions: ResolvedPosition[];
}

export interface ResolvedScene {
  sceneId: string;
  name: string;
  blocks: ResolvedBlock[];
}

export interface ResolveResult {
  date: string;
  weekday: number;
  scenes: ResolvedScene[];
  uncoveredCount: number;
  /** Havia restrição de horário a conferir, mas o show não tem horário: a regra não foi aplicada. */
  semHorario?: boolean;
}

function weekdayOf(dateISO: string): number {
  return new Date(`${dateISO}T00:00:00Z`).getUTCDay();
}

function asNum(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/**
 * Identifica o personagem ao qual uma linha de rodízio pertence.
 *
 * O modelo legado ainda guarda a configuração dentro da linha. Quando a linha
 * já possui characterId, ele é a chave compartilhada pelos shows. Linhas sem
 * essa informação permanecem isoladas por lineId até a migração do Bloco 2;
 * isso evita misturar personagens que o piloto não identificou.
 */
export function rotationCharacterKey(line: { id: string; config: unknown; characterId?: string | null }): string {
  if (typeof line.characterId === "string" && line.characterId.trim()) {
    return line.characterId.trim();
  }
  const cfg = (line.config && typeof line.config === "object" ? line.config : {}) as Record<string, unknown>;
  if (typeof cfg.characterId === "string" && cfg.characterId.trim()) {
    return `character:${cfg.characterId.trim()}`;
  }
  if (typeof cfg.characterName === "string" && cfg.characterName.trim()) {
    return `character-name:${cfg.characterName.trim().toLocaleLowerCase("pt-BR")}`;
  }
  return `legacy-line:${line.id}`;
}

function ehUuid(valor: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valor);
}

function rotationCountKey(characterId: string, userId: string): string {
  return `${characterId}::${userId}`;
}

/** Compara chaves numéricas em ordem (menor primeiro). */
function compareKeys(left: readonly number[], right: readonly number[]): number {
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const diff = (left[index] ?? 0) - (right[index] ?? 0);
    if (diff) return diff;
  }
  return 0;
}

/**
 * Equilíbrio do rodízio (07/10): antes da contagem do próprio personagem, vale quem está com
 * menos trabalho — supervisor por último, depois quem não está em show colado a este, depois menos shows no dia,
 * na semana e no mês.
 */
export type BalanceKey = (userId: string) => readonly number[];
const NO_BALANCE: BalanceKey = () => [];

function resolveLine(
  line: { id: string; type: string; config: unknown; characterId?: string | null },
  weekday: number,
  unavailable: Set<string>,
  nameOf: (id: string) => string,
  excluded: Set<string> = new Set(),
  rotationCounts: ReadonlyMap<string, number> = new Map(),
  memberIdsOverride?: readonly string[],
  characterMode?: "titular" | "rodizio",
  balance: BalanceKey = NO_BALANCE,
  /** Chaves (rotationCountKey) que já avançaram HOJE — descontadas de config.executionCounts, que
   *  é vitalício e sem data (ver nota mais abaixo, no uso). */
  advancedToday: ReadonlySet<string> = new Set(),
  /** userId → por que a pessoa não pode entrar neste show (restrição de horário, limite do dia). Proibição. */
  bloqueios: ReadonlyMap<string, string> = new Map(),
): ResolvedLine {
  const byBalance = (a: { id: string; idx: number; count: number }, b: { id: string; idx: number; count: number }) =>
    compareKeys([...balance(a.id), a.count, a.idx], [...balance(b.id), b.count, b.idx]);
  const cfg = (line.config && typeof line.config === "object" ? line.config : {}) as Record<string, unknown>;
  const person = (id: string): ResolvedPerson => ({ userId: id, name: nameOf(id) });
  // "Bloqueado" = de folga/restrição (unavailable) OU já escalado noutra posição da mesma
  // cena (excluded). Ambos fazem a escolha saltar para o próximo candidato da lista.
  const blocked = (id: string) => unavailable.has(id) || excluded.has(id) || bloqueios.has(id);
  const blockReason = (id: string) =>
    unavailable.has(id) ? "indisponível" : bloqueios.get(id) ?? "já escalado nesta cena";
  /** Quando ninguém pode, a nota diz qual regra impediu cada um (só dos que a regra barrou). */
  const porRegra = (ids: readonly string[]) => ids.filter((id) => bloqueios.has(id) && !unavailable.has(id)).map((id) => `${nameOf(id)} ${bloqueios.get(id)}`);
  const semNinguem = (texto: string, ids: readonly string[]) => {
    const motivos = porRegra(ids);
    return motivos.length ? `${texto} — ${motivos.join("; ")}` : texto;
  };

  switch (line.type) {
    case "FIXED_PERSON": {
      const id = typeof cfg.userId === "string" ? cfg.userId : "";
      if (!id) return { lineId: line.id, type: line.type, status: "UNCOVERED", people: [], note: "Sem pessoa definida" };
      if (blocked(id)) {
        return { lineId: line.id, type: line.type, status: "UNCOVERED", people: [], note: `${nameOf(id)} ${blockReason(id)} e sem substituto` };
      }
      return { lineId: line.id, type: line.type, status: "COVERED", people: [person(id)] };
    }

    case "TITULAR_SUBSTITUTE": {
      const titularId = typeof cfg.titularId === "string" ? cfg.titularId : "";
      const subs = Array.isArray(cfg.substituteIds)
        ? cfg.substituteIds.filter((x): x is string => typeof x === "string")
        : [];
      const order = [titularId, ...subs].filter(Boolean);
      if (order.length === 0) {
        return { lineId: line.id, type: line.type, status: "UNCOVERED", people: [], note: "Sem titular definido" };
      }
      const chosen = order.find((id) => !blocked(id));
      if (!chosen) {
        return { lineId: line.id, type: line.type, status: "UNCOVERED", people: [], note: "Titular e substitutos indisponíveis" };
      }
      const note = chosen === titularId ? undefined : `Titular ${blockReason(titularId)} — usando ${nameOf(chosen)}`;
      return { lineId: line.id, type: line.type, status: "COVERED", people: [person(chosen)], note };
    }

    case "ROTATION": {
      const configMemberIds = Array.isArray(cfg.memberIds)
        ? cfg.memberIds.filter((x): x is string => typeof x === "string")
        : [];
      const memberIds = memberIdsOverride ?? configMemberIds;
      const legacyCounts = (cfg.executionCounts && typeof cfg.executionCounts === "object"
        ? cfg.executionCounts
        : {}) as Record<string, unknown>;
      if (memberIds.length === 0) {
        return { lineId: line.id, type: line.type, status: "UNCOVERED", people: [], note: "Sem pessoas no rodízio" };
      }
      const characterKey = rotationCharacterKey(line);
      const available = memberIds
        .map((id, idx) => {
          const key = rotationCountKey(characterKey, id);
          // config.executionCounts é vitalício e sem data — o avanço de HOJE (publicação já
          // rodou) já está somado nele, igual ao que acontecia com characterCastTable.timesDone.
          // Desconta aqui pela mesma razão: senão o Livro do Dia vivo trocaria o rodízio sozinho
          // logo depois de publicar, sem folga nem mexida nenhuma.
          const legacy = Math.max(0, asNum(legacyCounts[id]) - (advancedToday.has(key) ? 1 : 0));
          return { id, idx, count: Math.max(legacy, rotationCounts.get(key) ?? 0) };
        })
        .filter((m) => !blocked(m.id))
        .sort(byBalance);
      if (available.length === 0) {
        return { lineId: line.id, type: line.type, status: "UNCOVERED", people: [], note: semNinguem("Todos do rodízio indisponíveis", memberIds) };
      }
      const chosen = available[0]!.id;
      return {
        lineId: line.id,
        type: line.type,
        status: "COVERED",
        people: [person(chosen)],
        rotationAdvanceUserId: chosen,
        fixedForDay: cfg.fixedForDay === true,
      };
    }

    case "DAY_OF_WEEK": {
      const assignments = (cfg.dayAssignments && typeof cfg.dayAssignments === "object"
        ? cfg.dayAssignments
        : {}) as Record<string, unknown>;
      const assigned = assignments[String(weekday)];
      if (typeof assigned === "string" && assigned) {
        if (blocked(assigned)) {
          return { lineId: line.id, type: line.type, status: "UNCOVERED", people: [], note: `${nameOf(assigned)} ${blockReason(assigned)} e sem substituto` };
        }
        return { lineId: line.id, type: line.type, status: "COVERED", people: [person(assigned)] };
      }
      // Compat: linhas antigas só com days[] (dias marcados, sem pessoa)
      const days = Array.isArray(cfg.days) ? (cfg.days as unknown[]).map((d) => asNum(d)) : [];
      if (days.includes(weekday)) {
        return { lineId: line.id, type: line.type, status: "UNCOVERED", people: [], note: "Dia ativo, mas sem pessoa definida" };
      }
      return { lineId: line.id, type: line.type, status: "INACTIVE", people: [], note: "Não atua neste dia" };
    }

    case "FUNCTION": {
      const label = typeof cfg.functionLabel === "string" ? cfg.functionLabel.trim() : "";
      return { lineId: line.id, type: line.type, status: "INACTIVE", people: [], note: label || "Função" };
    }
    case "CHARACTER": {
      // Vaga de personagem cadastrado: quem faz vem da fila do personagem. Titular escolhe o
      // primeiro disponível na ordem da fila; rodízio escolhe quem fez menos (desempate pela ordem).
      if (line.characterId && memberIdsOverride) {
        if (memberIdsOverride.length === 0) {
          return { lineId: line.id, type: line.type, status: "UNCOVERED", people: [], note: "Fila do personagem vazia" };
        }
        if (characterMode === "titular") {
          const chosen = memberIdsOverride.find((id) => !blocked(id));
          if (!chosen) return { lineId: line.id, type: line.type, status: "UNCOVERED", people: [], note: semNinguem("Titular e substitutos indisponíveis", memberIdsOverride) };
          const titularId = memberIdsOverride[0]!;
          const note = chosen === titularId ? undefined : `Titular ${blockReason(titularId)} — usando ${nameOf(chosen)}`;
          return { lineId: line.id, type: line.type, status: "COVERED", people: [person(chosen)], note };
        }
        const available = memberIdsOverride
          .map((id, idx) => ({ id, idx, count: rotationCounts.get(rotationCountKey(line.characterId!, id)) ?? 0 }))
          .filter((m) => !blocked(m.id))
          .sort(byBalance);
        if (available.length === 0) {
          return { lineId: line.id, type: line.type, status: "UNCOVERED", people: [], note: semNinguem("Todos da fila indisponíveis", memberIdsOverride) };
        }
        const chosen = available[0]!.id;
        return { lineId: line.id, type: line.type, status: "COVERED", people: [person(chosen)], rotationAdvanceUserId: chosen };
      }
      const label = typeof cfg.characterName === "string" ? cfg.characterName.trim() : "";
      return { lineId: line.id, type: line.type, status: "INACTIVE", people: [], note: label || "Personagem" };
    }
    default:
      return { lineId: line.id, type: line.type, status: "INACTIVE", people: [], note: "Linha sem resolução automática" };
  }
}

/** Segunda-feira e domingo da semana da data, e primeiro e último dia do mês (YYYY-MM-DD). */
export function workloadWindows(dateISO: string) {
  const day = new Date(`${dateISO}T00:00:00Z`);
  const iso = (value: Date) => value.toISOString().slice(0, 10);
  const shift = (days: number) => new Date(day.getTime() + days * 86_400_000);
  const sinceMonday = (day.getUTCDay() + 6) % 7;
  const monthStart = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth() + 1, 0));
  return { weekStart: iso(shift(-sinceMonday)), weekEnd: iso(shift(6 - sinceMonday)), monthStart: iso(monthStart), monthEnd: iso(monthEnd) };
}

/**
 * Quanto trabalho cada pessoa já tem: em quantos Livros do Dia (shows) da operação ela está
 * escalada no dia, na semana e no mês — sem contar Livros cancelados nem o próprio show nesta
 * data (regenerar não pode contar a si mesmo). Supervisor vai para o fim da fila do rodízio.
 */
async function workloadBalance(userIds: string[], operationId: string, dateISO: string, showBookId: string, eventId?: string, colados: ReadonlySet<string> = new Set(), leituras?: LeiturasDoMes): Promise<BalanceKey> {
  if (userIds.length === 0) return NO_BALANCE;
  // Com o evento do Livro em mãos, só o PRÓPRIO Livro fica de fora da conta (regenerar não conta a si mesmo);
  // assim a outra sessão do mesmo show, no mesmo dia, pesa contra quem já fez uma. Sem ele, vale o jeito antigo:
  // nenhum Livro do mesmo show na mesma data.
  const foraDaConta = eventId ? sql`b.agenda_event_id <> ${eventId}::uuid` : sql`not (b.show_book_id is not distinct from ${showBookId}::uuid and e.date = ${dateISO})`;
  const { weekStart, weekEnd, monthStart, monthEnd } = workloadWindows(dateISO);
  const from = weekStart < monthStart ? weekStart : monthStart;
  const to = weekEnd > monthEnd ? weekEnd : monthEnd;
  const ids = sql.join(userIds.map((id) => sql`${id}::uuid`), sql`, `);
  const [loads, supervisors] = await Promise.all([
    db.execute(sql`
      select a.user_id as "userId",
        count(distinct b.id) filter (where e.date = ${dateISO}) as "day",
        count(distinct b.id) filter (where e.date between ${weekStart} and ${weekEnd}) as "week",
        count(distinct b.id) filter (where e.date between ${monthStart} and ${monthEnd}) as "month"
      from daily_book_assignments a
      join daily_books b on b.id = a.daily_book_id
      join agenda_events e on e.id = b.agenda_event_id
      where a.user_id in (${ids})
        and a.superseded_at is null and a.status in ('ASSIGNED', 'AT_RISK')
        and b.status <> 'CANCELLED'
        and e.operation_id = ${operationId}
        and e.date between ${from} and ${to}
        and ${foraDaConta}
      group by a.user_id`),
    // Quem é supervisor não muda durante a geração; a carga (acima) muda a cada Livro gerado e é sempre lida de novo.
    lembrarOuLer(leituras, `supervisores:${operationId}:${[...userIds].sort().join(",")}`, () => db.select({ userId: userRolesTable.userId }).from(userRolesTable).where(and(
      inArray(userRolesTable.userId, userIds), eq(userRolesTable.operationId, operationId),
      inArray(userRolesTable.role, ["SUPERVISOR_A", "SUPERVISOR_B"]), eq(userRolesTable.active, true),
    ))),
  ]);
  const rows = (Array.isArray(loads) ? loads : (loads as { rows?: unknown[] }).rows ?? []) as { userId: string; day: number | string; week: number | string; month: number | string }[];
  const byUser = new Map(rows.map((row) => [row.userId, [Number(row.day), Number(row.week), Number(row.month)]]));
  const supervisorIds = new Set(supervisors.map((row) => row.userId));
  return (userId) => [supervisorIds.has(userId) ? 1 : 0, chaveDeEvitar(userId, { colados }), ...(byUser.get(userId) ?? [0, 0, 0])];
}

/**
 * Resolve o elenco concreto de cada linha do Livro do Show numa data específica,
 * respeitando disponibilidade (folga/atestado/restrição) e a ordem configurada.
 */
export async function resolveShowBookCast(
  showBookId: string,
  operationId: string,
  dateISO: string,
  opts: { dedupPerScene?: boolean; eventId?: string; leituras?: LeiturasDoMes; eventoConhecido?: EventoConhecido } = {}
): Promise<ResolveResult> {
  return (await resolveShowBookCastComNomes(showBookId, operationId, dateISO, opts)).result;
}

/** O elenco resolvido e, junto, o nome de cada pessoa que o motor encontrou (o Livro do Dia reaproveita os nomes). */
export async function resolveShowBookCastComNomes(
  showBookId: string,
  operationId: string,
  dateISO: string,
  opts: { dedupPerScene?: boolean; eventId?: string; leituras?: LeiturasDoMes; eventoConhecido?: EventoConhecido } = {}
): Promise<{ result: ResolveResult; nomes: ReadonlyMap<string, string> }> {
  const { leituras } = opts;
  const tree = await lembrarOuLer(leituras, `arvore:${showBookId}`, () => buildShowBookTree(showBookId));
  const weekday = weekdayOf(dateISO);

  // O elenco do Show (quem pode entrar, a fila de cada personagem, os nomes) não muda durante a geração do mês.
  const { userIds, castMembers, castCounts, characterModes, nameMap, nonSchedulable } = await lembrarOuLer(leituras, `elenco:${showBookId}`, async () => {
    // Nomes de todos os usuários referenciados
    const userIds = new Set<string>();
    const characterIds = new Set<string>();
    for (const scene of tree) {
      for (const block of scene.blocks) reservasDoGrupo(block).forEach((id) => userIds.add(id));
      for (const block of scene.blocks) {
        for (const pos of block.positions) {
          for (const line of pos.lines) {
            collectUserIdsFromConfig(line.config).forEach((id) => userIds.add(id));
            if (typeof line.characterId === "string" && line.characterId.trim()) {
              characterIds.add(line.characterId);
            }
          }
        }
      }
    }
    const castMembers = new Map<string, string[]>();
    const castCounts = new Map<string, number>();
    const characterModes = new Map<string, "titular" | "rodizio">();
    if (characterIds.size > 0) {
      // Personagem sem ninguém na fila ainda precisa do modo e de uma fila vazia (vaga descoberta).
      const characterRows = await db
        .select({ id: charactersTable.id, mode: charactersTable.mode })
        .from(charactersTable)
        .where(and(inArray(charactersTable.id, Array.from(characterIds)), eq(charactersTable.active, true)));
      for (const row of characterRows) {
        characterModes.set(row.id, row.mode);
        castMembers.set(row.id, []);
      }
      const castRows = await db
        .select({
          characterId: characterCastTable.characterId,
          personId: characterCastTable.personId,
          timesDone: characterCastTable.timesDone,
        })
        .from(characterCastTable)
        .innerJoin(charactersTable, eq(characterCastTable.characterId, charactersTable.id))
        .where(and(
          inArray(characterCastTable.characterId, Array.from(characterIds)),
          eq(characterCastTable.active, true),
          eq(charactersTable.active, true),
        ))
        .orderBy(characterCastTable.characterId, characterCastTable.order, characterCastTable.id);
      for (const row of castRows) {
        const members = castMembers.get(row.characterId) ?? [];
        members.push(row.personId);
        castMembers.set(row.characterId, members);
        castCounts.set(rotationCountKey(row.characterId, row.personId), row.timesDone);
        userIds.add(row.personId);
      }
    }
    const nameMap = new Map<string, string>();
    // Administradores e membros especiais não fazem parte do elenco escalável; mesmo
    // que estejam configurados numa linha, são tratados como indisponíveis (a linha
    // salta para o próximo substituto/rodízio ou fica descoberta).
    const nonSchedulable = new Set<string>();
    if (userIds.size > 0) {
      const ids = Array.from(userIds);
      const rows = await db
        .select({ id: usersTable.id, name: usersTable.name, specialization: usersTable.specialization })
        .from(usersTable)
        .where(inArray(usersTable.id, ids));
      rows.forEach((r) => nameMap.set(r.id, r.name));

      const adminRows = await db
        .select({ userId: userRolesTable.userId })
        .from(userRolesTable)
        .where(and(
          inArray(userRolesTable.userId, ids),
          // 08/10: Direção também não entra em show (Produção entra, ex.: Lucas no Yeti).
          inArray(userRolesTable.role, ["ADMIN", "DIR"]),
          eq(userRolesTable.active, true),
        ));
      const adminSet = new Set(adminRows.map((r) => r.userId));
      const specMap = new Map(rows.map((r) => [r.id, r.specialization]));
      for (const id of ids) {
        if (!isSchedulableMember({ isAdmin: adminSet.has(id), specialization: specMap.get(id) ?? null })) {
          nonSchedulable.add(id);
        }
      }
    }
    return { userIds, castMembers, castCounts, characterModes, nameMap, nonSchedulable };
  });
  const nameOf = (id: string) => nameMap.get(id) ?? "—";

  const unavailable = await getUnavailableUserIdsComLeituras(operationId, dateISO, leituras);
  for (const id of nonSchedulable) unavailable.add(id);
  // Restrição de horário e limite do dia são proibição; show colado é só "evitar". Sem o evento do Livro não há como
  // saber a hora do show, então nada disso se aplica (comportamento de antes).
  const regras = opts.eventId ? await carregarRegrasDoDia({ eventId: opts.eventId, userIds: Array.from(userIds), date: dateISO, operationId, leituras, eventoConhecido: opts.eventoConhecido }) : null;
  const balance = await workloadBalance(Array.from(userIds), operationId, dateISO, showBookId, opts.eventId, regras?.colados, leituras);

  const rotationKeys = new Set<string>();
  for (const scene of tree) {
    for (const block of scene.blocks) {
      for (const pos of block.positions) {
        for (const line of pos.lines) {
          if (line.type === "ROTATION" || (line.type === "CHARACTER" && line.characterId)) rotationKeys.add(rotationCharacterKey(line));
        }
      }
    }
  }
  const rotationCounts = new Map<string, number>();
  for (const [key, value] of castCounts) rotationCounts.set(key, value);
  // Chaves (characterKey+userId) que avançaram HOJE — o Livro do Dia vivo re-resolve a mesma data
  // depois de publicada (folga marcada depois, leitura da gestão), inclusive logo após a própria
  // publicação, que já avançou o contador do vencedor de hoje. Sem descontar aqui, quem acabou de
  // "fazer" hoje pesaria contra si mesmo nessa releitura, e o rodízio trocaria sozinho sem folga
  // nem mexida nenhuma. Equilíbrio por carga de trabalho já faz a mesma exclusão do próprio dia.
  const advancedToday = new Set<string>();
  // O histórico de avanços só existe para vaga ligada a um personagem (chave UUID). Linha de rodízio sem personagem tem
  // chave "legacy-line:…": consultar com ela derrubava a geração do dia inteiro ("Erro inesperado ao gerar este dia").
  const chavesDeHistorico = Array.from(rotationKeys).filter(ehUuid);
  if (chavesDeHistorico.length > 0) {
    const rows = await lembrarOuLer(leituras, `avancos:${showBookId}`, () => db
      .select({ characterId: rotationDailyAdvancesTable.characterId, userId: rotationDailyAdvancesTable.userId, date: rotationDailyAdvancesTable.date })
      .from(rotationDailyAdvancesTable)
      .where(inArray(rotationDailyAdvancesTable.characterId, chavesDeHistorico)));
    const historicalTotal = new Map<string, number>();
    for (const row of rows) {
      const key = rotationCountKey(row.characterId, row.userId);
      if (row.date === dateISO) { advancedToday.add(key); continue; }
      historicalTotal.set(key, (historicalTotal.get(key) ?? 0) + 1);
    }
    for (const [key, total] of historicalTotal) rotationCounts.set(key, Math.max(rotationCounts.get(key) ?? 0, total));
    for (const key of advancedToday) rotationCounts.set(key, Math.max(0, (rotationCounts.get(key) ?? 0) - 1));
  }

  let uncoveredCount = 0;
  const scenes: ResolvedScene[] = tree.map((scene) => {
    // Quando dedupPerScene está ligado, uma pessoa escolhida numa posição passa a
    // ficar "excluída" das posições seguintes da MESMA cena, forçando a escolha a
    // saltar para o próximo substituto/membro do rodízio (até não haver ninguém).
    const excluded = opts.dedupPerScene ? new Set<string>() : undefined;
    // Personagem titular tem prioridade: dentro da cena, as linhas de titular são resolvidas
    // antes das demais (na ordem das posições), para que um rodízio cadastrado antes não tome
    // a pessoa titular. A saída mantém a ordem original das posições.
    const isTitular = (line: { characterId?: string | null }) =>
      Boolean(line.characterId && characterModes.get(line.characterId) === "titular");
    const entries = scene.blocks.flatMap((block) => block.positions.flatMap((pos) => pos.lines.map((line) => ({ line }))));
    const resolvedByLine = new Map<string, ResolvedLine>();
    // Reservas do grupo: o titular de cada posição é resolvido primeiro, para que uma reserva nunca tome o lugar de quem é titular
    // de outra posição da mesma cena. Só depois, as posições cujo titular não pôde entram com substitutos próprios e reservas DO SEU GRUPO.
    const reservasDaLinha = new Map<string, string[]>();
    for (const block of scene.blocks) {
      const doGrupo = reservasDoGrupo(block);
      if (doGrupo.length) for (const pos of block.positions) for (const line of pos.lines) reservasDaLinha.set(line.id, doGrupo);
    }
    const usaReservas = (line: { id: string; type: string; config: unknown }) => {
      if (!reservasDaLinha.has(line.id) || line.type !== "TITULAR_SUBSTITUTE") return false;
      const cfg = (line.config && typeof line.config === "object" ? line.config : {}) as Record<string, unknown>;
      return typeof cfg.titularId === "string" && cfg.titularId !== "";
    };
    const resolverLinha = (line: (typeof entries)[number]["line"], config: unknown = line.config) => {
      const memberIdsOverride = line.characterId
        ? castMembers.get(line.characterId) ?? []
        : undefined;
      return resolveLine({ ...line, config }, weekday, unavailable, nameOf, excluded, rotationCounts, memberIdsOverride, line.characterId ? characterModes.get(line.characterId) : undefined, balance, advancedToday, regras?.bloqueios);
    };
    const registrar = (line: { id: string }, resolved: ResolvedLine) => {
      if (resolved.status === "UNCOVERED") uncoveredCount += 1;
      if (excluded) {
        for (const p of resolved.people) excluded.add(p.userId);
      }
      resolvedByLine.set(line.id, resolved);
    };
    const pendentes: (typeof entries)[number]["line"][] = [];
    for (const { line } of [...entries.filter((e) => isTitular(e.line)), ...entries.filter((e) => !isTitular(e.line))]) {
      if (usaReservas(line)) {
        const cfg = line.config as Record<string, unknown>;
        const soTitular = resolverLinha(line, { ...cfg, substituteIds: [] });
        if (soTitular.status === "COVERED") registrar(line, soTitular); else pendentes.push(line);
        continue;
      }
      registrar(line, resolverLinha(line));
    }
    for (const line of pendentes) {
      const cfg = line.config as Record<string, unknown>;
      const proprios = Array.isArray(cfg.substituteIds) ? cfg.substituteIds.filter((x): x is string => typeof x === "string") : [];
      registrar(line, resolverLinha(line, { ...cfg, substituteIds: [...new Set([...proprios, ...(reservasDaLinha.get(line.id) ?? [])])] }));
    }
    return {
      sceneId: scene.id,
      name: scene.name,
      blocks: scene.blocks.map((block) => ({
        blockId: block.id,
        name: block.name,
        positions: block.positions.map((pos) => ({
          positionId: pos.id,
          name: pos.name,
          minimumCoverage: pos.minimumCoverage ?? 1,
          lines: pos.lines.map((line) => resolvedByLine.get(line.id)!),
        })),
      })),
    };
  });

  return { result: { date: dateISO, weekday, scenes, uncoveredCount, ...(regras?.semHorario ? { semHorario: true } : {}) }, nomes: nameMap };
}

// ─── Mapa por papel (para alimentar o Livro do Dia) ───────────────────────────

export interface RoleResolution {
  /** Pessoas concretas (deduplicadas) somando todas as linhas COBERTAS do papel. */
  people: ResolvedPerson[];
  /** userIds cujo contador de rodízio deveria avançar quando o livro for efetivado. */
  rotationAdvanceUserIds: string[];
  /** O papel tem ao menos uma linha configurada (senão, cair na escala). */
  hasLines: boolean;
  /** Há ao menos uma linha que DEVERIA ter alguém hoje, mas ninguém está disponível (buraco real). */
  hasUncoveredLine: boolean;
  /** Há ao menos uma linha que requer cobertura hoje (COBERTA ou DESCOBERTA). */
  hasActiveLine: boolean;
}

/**
 * Resolve o elenco por PAPEL (showBookRole) numa data, agregando as linhas de cada
 * papel. Usado para preencher os assignments do Livro do Dia automaticamente.
 * A chave do mapa é o id do papel (= positionId do Livro do Show).
 */
export async function resolveAssignmentsByRole(
  showBookId: string,
  operationId: string,
  dateISO: string,
  opts: { dedupPerScene?: boolean; eventId?: string; leituras?: LeiturasDoMes; eventoConhecido?: EventoConhecido } = {}
): Promise<{ byRole: Map<string, RoleResolution>; result: ResolveResult; nomes: ReadonlyMap<string, string> }> {
  const { result, nomes } = await resolveShowBookCastComNomes(showBookId, operationId, dateISO, opts);
  const byRole = new Map<string, RoleResolution>();
  for (const scene of result.scenes) {
    for (const block of scene.blocks) {
      for (const pos of block.positions) {
        const seen = new Set<string>();
        const people: ResolvedPerson[] = [];
        const rotationAdvanceUserIds: string[] = [];
        let hasUncoveredLine = false;
        let hasActiveLine = false;
        for (const line of pos.lines) {
          for (const p of line.people) {
            if (!seen.has(p.userId)) { seen.add(p.userId); people.push(p); }
          }
          if (line.rotationAdvanceUserId) rotationAdvanceUserIds.push(line.rotationAdvanceUserId);
          if (line.status === "UNCOVERED") { hasUncoveredLine = true; hasActiveLine = true; }
          else if (line.status === "COVERED") { hasActiveLine = true; }
        }
        byRole.set(pos.positionId, {
          people,
          rotationAdvanceUserIds,
          hasLines: pos.lines.length > 0,
          hasUncoveredLine,
          hasActiveLine,
        });
      }
    }
  }
  return { byRole, result, nomes };
}

/**
 * Mapa lineId → userId do vencedor do rodízio de cada linha ROTATION, extraído de um
 * elenco já resolvido. Persistido na GERAÇÃO do Livro do Dia para que a publicação
 * avance o contador exatamente para quem ficou escalado na linha (e não re-resolva,
 * o que poderia escolher outra pessoa se a disponibilidade mudar entre gerar e publicar).
 */
export type RotationWinners = Record<string, string>;

export function collectRotationWinners(result: ResolveResult): RotationWinners {
  const winners: RotationWinners = {};
  for (const scene of result.scenes) {
    for (const block of scene.blocks) {
      for (const pos of block.positions) {
        for (const line of pos.lines) {
          if (line.rotationAdvanceUserId) winners[line.lineId] = line.rotationAdvanceUserId;
        }
      }
    }
  }
  return winners;
}

/**
 * Avança os contadores de rodízio (config.executionCounts) das linhas ROTATION a partir
 * de um mapa de vencedores já decidido (tipicamente persistido na geração). Deve ser
 * chamado UMA vez quando a escala do dia é efetivada (publicação do Livro do Dia).
 * Best-effort.
 */
export async function advanceRotationCountsFromWinners(
  winners: RotationWinners,
  dateISO: string = operationalDate(),
): Promise<number> {
  const lineIds = Object.keys(winners);
  if (lineIds.length === 0) return 0;

  const lines = await db
    .select()
    .from(showBookLinesTable)
    .where(and(inArray(showBookLinesTable.id, lineIds), eq(showBookLinesTable.active, true)));
  const byId = new Map(lines.map((l) => [l.id, l]));

  let updated = 0;
  for (const lineId of lineIds) {
    const userId = winners[lineId]!;
    const line = byId.get(lineId);
    if (!line) continue;
    const cfg = (line.config && typeof line.config === "object"
      ? { ...(line.config as Record<string, unknown>) }
      : {}) as Record<string, unknown>;
    const characterId = rotationCharacterKey(line);
    // Sem personagem (chave que não é UUID) não há linha de histórico para gravar; o contador da própria linha segue valendo.
    const [inserted] = !ehUuid(characterId) ? [{ id: "linha-sem-personagem" }] : await db
      .insert(rotationDailyAdvancesTable)
      .values({
        characterId,
        userId,
        date: dateISO,
        sourceLineId: line.id,
      })
      .onConflictDoNothing({
        target: [
          rotationDailyAdvancesTable.characterId,
          rotationDailyAdvancesTable.userId,
          rotationDailyAdvancesTable.date,
        ],
      })
      .returning({ id: rotationDailyAdvancesTable.id });
    if (!inserted) continue;

    const counts = { ...((cfg.executionCounts && typeof cfg.executionCounts === "object"
      ? cfg.executionCounts
      : {}) as Record<string, number>) };
    counts[userId] = asNum(counts[userId]) + 1;
    cfg.executionCounts = counts;
    await db.update(showBookLinesTable).set({ config: cfg as any }).where(eq(showBookLinesTable.id, lineId));
    if (line.characterId) {
      await db
        .update(characterCastTable)
        .set({
          timesDone: sql`${characterCastTable.timesDone} + 1`,
          updatedAt: new Date(),
        })
        .where(and(
          eq(characterCastTable.characterId, line.characterId),
          eq(characterCastTable.personId, userId),
          eq(characterCastTable.active, true),
        ));
    }
    updated += 1;
  }
  return updated;
}

/**
 * Avança os contadores de rodízio re-resolvendo a data. Mantido para compatibilidade
 * (ex.: Livros gerados antes de persistirmos os vencedores). Prefira persistir os
 * vencedores na geração e usar `advanceRotationCountsFromWinners` na publicação.
 */
export async function advanceRotationCounts(
  showBookId: string,
  operationId: string,
  dateISO: string
): Promise<number> {
  const result = await resolveShowBookCast(showBookId, operationId, dateISO);
  return advanceRotationCountsFromWinners(collectRotationWinners(result), dateISO);
}
