import { eq, and, inArray, lte, gte } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  showBookScenesTable,
  showBookBlocksTable,
  showBookRolesTable,
  showBookLinesTable,
  usersTable,
  userRolesTable,
  restrictionsTable,
  folgasTable,
  isSchedulableMember,
} from "@workspace/db";

// ─── Tree building (shared with show-book route) ──────────────────────────────

async function fetchAllLines(positionIds: string[]) {
  if (positionIds.length === 0) return {} as Record<string, (typeof showBookLinesTable.$inferSelect)[]>;
  const allLines = await Promise.all(
    positionIds.map((pid) =>
      db
        .select()
        .from(showBookLinesTable)
        .where(eq(showBookLinesTable.positionId, pid))
        .orderBy(showBookLinesTable.order, showBookLinesTable.id)
    )
  );
  const map: Record<string, (typeof showBookLinesTable.$inferSelect)[]> = {};
  positionIds.forEach((pid, idx) => { map[pid] = allLines[idx] ?? []; });
  return map;
}

export async function buildShowBookTree(showBookId: string) {
  const scenes = await db
    .select().from(showBookScenesTable)
    .where(eq(showBookScenesTable.showBookId, showBookId))
    .orderBy(showBookScenesTable.order, showBookScenesTable.id);

  const blocks = await db
    .select().from(showBookBlocksTable)
    .where(eq(showBookBlocksTable.showBookId, showBookId))
    .orderBy(showBookBlocksTable.order, showBookBlocksTable.id);

  const positions = await db
    .select().from(showBookRolesTable)
    .where(eq(showBookRolesTable.showBookId, showBookId))
    .orderBy(showBookRolesTable.order, showBookRolesTable.id);

  const linesMap = await fetchAllLines(positions.map((p) => p.id));

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

  return scenes.map((s) => ({ ...s, blocks: blocksByScene[s.id] ?? [] }));
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
}

function weekdayOf(dateISO: string): number {
  return new Date(`${dateISO}T00:00:00Z`).getUTCDay();
}

function asNum(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function resolveLine(
  line: { id: string; type: string; config: unknown },
  weekday: number,
  unavailable: Set<string>,
  nameOf: (id: string) => string,
  excluded: Set<string> = new Set()
): ResolvedLine {
  const cfg = (line.config && typeof line.config === "object" ? line.config : {}) as Record<string, unknown>;
  const person = (id: string): ResolvedPerson => ({ userId: id, name: nameOf(id) });
  // "Bloqueado" = de folga/restrição (unavailable) OU já escalado noutra posição da mesma
  // cena (excluded). Ambos fazem a escolha saltar para o próximo candidato da lista.
  const blocked = (id: string) => unavailable.has(id) || excluded.has(id);
  const blockReason = (id: string) =>
    unavailable.has(id) ? "indisponível" : "já escalado nesta cena";

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
      const memberIds = Array.isArray(cfg.memberIds)
        ? cfg.memberIds.filter((x): x is string => typeof x === "string")
        : [];
      const counts = (cfg.executionCounts && typeof cfg.executionCounts === "object"
        ? cfg.executionCounts
        : {}) as Record<string, unknown>;
      if (memberIds.length === 0) {
        return { lineId: line.id, type: line.type, status: "UNCOVERED", people: [], note: "Sem pessoas no rodízio" };
      }
      const available = memberIds
        .map((id, idx) => ({ id, idx, count: asNum(counts[id]) }))
        .filter((m) => !blocked(m.id))
        .sort((a, b) => (a.count - b.count) || (a.idx - b.idx));
      if (available.length === 0) {
        return { lineId: line.id, type: line.type, status: "UNCOVERED", people: [], note: "Todos do rodízio indisponíveis" };
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
      const label = typeof cfg.characterName === "string" ? cfg.characterName.trim() : "";
      return { lineId: line.id, type: line.type, status: "INACTIVE", people: [], note: label || "Personagem" };
    }
    default:
      return { lineId: line.id, type: line.type, status: "INACTIVE", people: [], note: "Linha sem resolução automática" };
  }
}

/**
 * Resolve o elenco concreto de cada linha do Livro do Show numa data específica,
 * respeitando disponibilidade (folga/atestado/restrição) e a ordem configurada.
 */
export async function resolveShowBookCast(
  showBookId: string,
  operationId: string,
  dateISO: string,
  opts: { dedupPerScene?: boolean } = {}
): Promise<ResolveResult> {
  const tree = await buildShowBookTree(showBookId);
  const weekday = weekdayOf(dateISO);

  // Nomes de todos os usuários referenciados
  const userIds = new Set<string>();
  for (const scene of tree) {
    for (const block of scene.blocks) {
      for (const pos of block.positions) {
        for (const line of pos.lines) {
          collectUserIdsFromConfig(line.config).forEach((id) => userIds.add(id));
        }
      }
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
        eq(userRolesTable.role, "ADMIN"),
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
  const nameOf = (id: string) => nameMap.get(id) ?? "—";

  const unavailable = await getUnavailableUserIds(operationId, dateISO);
  for (const id of nonSchedulable) unavailable.add(id);

  let uncoveredCount = 0;
  const scenes: ResolvedScene[] = tree.map((scene) => {
    // Quando dedupPerScene está ligado, uma pessoa escolhida numa posição passa a
    // ficar "excluída" das posições seguintes da MESMA cena, forçando a escolha a
    // saltar para o próximo substituto/membro do rodízio (até não haver ninguém).
    const excluded = opts.dedupPerScene ? new Set<string>() : undefined;
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
          lines: pos.lines.map((line) => {
            const resolved = resolveLine(line, weekday, unavailable, nameOf, excluded);
            if (resolved.status === "UNCOVERED") uncoveredCount += 1;
            if (excluded) {
              for (const p of resolved.people) excluded.add(p.userId);
            }
            return resolved;
          }),
        })),
      })),
    };
  });

  return { date: dateISO, weekday, scenes, uncoveredCount };
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
  opts: { dedupPerScene?: boolean } = {}
): Promise<{ byRole: Map<string, RoleResolution>; result: ResolveResult }> {
  const result = await resolveShowBookCast(showBookId, operationId, dateISO, opts);
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
  return { byRole, result };
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
export async function advanceRotationCountsFromWinners(winners: RotationWinners): Promise<number> {
  const lineIds = Object.keys(winners);
  if (lineIds.length === 0) return 0;

  const lines = await db
    .select()
    .from(showBookLinesTable)
    .where(inArray(showBookLinesTable.id, lineIds));
  const byId = new Map(lines.map((l) => [l.id, l]));

  let updated = 0;
  for (const lineId of lineIds) {
    const userId = winners[lineId]!;
    const line = byId.get(lineId);
    if (!line) continue;
    const cfg = (line.config && typeof line.config === "object"
      ? { ...(line.config as Record<string, unknown>) }
      : {}) as Record<string, unknown>;
    const counts = { ...((cfg.executionCounts && typeof cfg.executionCounts === "object"
      ? cfg.executionCounts
      : {}) as Record<string, number>) };
    counts[userId] = asNum(counts[userId]) + 1;
    cfg.executionCounts = counts;
    await db.update(showBookLinesTable).set({ config: cfg as any }).where(eq(showBookLinesTable.id, lineId));
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
  return advanceRotationCountsFromWinners(collectRotationWinners(result));
}
