import { Router, type IRouter } from "express";
import { eq, and, gt, gte, lte, desc, inArray, isNotNull } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  folgasTable,
  historyEventsTable,
  usersTable,
  operationsTable,
  userRolesTable,
  operationalGroupsTable,
  isSchedulableMember,
} from "@workspace/db";
import { requireAuth, requireOrganization } from "../middlewares/auth.js";
import { groupCoveredOperationIds } from "./groups.js";
import { requestLogger } from "../lib/logger.js";
import { LOG_DOMAIN } from "@workspace/shared";
import { notifyMany, sendNotification } from "../services/notificationService.js";
import { writeHistoryEvent } from "../lib/history-helper.js";
import { operationalDate } from "../lib/operational-date.js";
import { listAreaLocalScopes } from "../services/area-local-scope.js";

const router: IRouter = Router();
const MANAGER_ROLES = ["ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"];
type FolgaMutationExecutor = Pick<typeof db, "insert" | "update">;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function offsetDate(date: string, days: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return operationalDate(d);
}

/**
 * Validate that the calling user can manage the given operationId.
 * ADMIN: operationId must belong to their org.
 * SUPERVISOR: they must have an active role in that operationId.
 * Optionally validates that targetUserId has an active role in the operation.
 * Returns an error message string if denied, null if allowed.
 */
/**
 * 08/10: a Supervisão vê o mapa de todo mundo, mas só altera folgas da própria equipe — área
 * que supervisiona, no local de costume da pessoa (sem local definido, vale a área). A folga do
 * próprio supervisor só a Administração altera. Devolve a mensagem de recusa, ou null.
 */
type Scope = { areaId: string; locationId: string };
const NOT_MY_TEAM = "Esta pessoa não é da sua equipe: só a Administração altera esta folga";
const OWN_FOLGA = "A sua própria folga só a Administração altera";
function inTeam(scopes: Scope[], person: { areaId: string | null; defaultLocationId: string | null }) {
  return Boolean(person.areaId) && scopes.some((scope) => scope.areaId === person.areaId && (!person.defaultLocationId || scope.locationId === person.defaultLocationId));
}
async function folgaEditBlock(user: { role: string; organizationId: string; sub: string }, personId: string): Promise<string | null> {
  if (user.role === "ADMIN") return null;
  if (personId === user.sub) return OWN_FOLGA;
  const [person] = await db.select({ areaId: usersTable.areaId, defaultLocationId: usersTable.defaultLocationId })
    .from(usersTable).where(and(eq(usersTable.id, personId), eq(usersTable.organizationId, user.organizationId))).limit(1);
  if (!person) return NOT_MY_TEAM;
  return inTeam(await listAreaLocalScopes(user.sub, user.organizationId), person) ? null : NOT_MY_TEAM;
}

async function validateManagerScope(
  user: { role: string; organizationId: string; sub: string },
  operationId: string,
  targetUserId?: string
): Promise<string | null> {
  if (user.role === "ADMIN") {
    const [op] = await db
      .select({ id: operationsTable.id })
      .from(operationsTable)
      .where(and(
        eq(operationsTable.id, operationId),
        eq(operationsTable.organizationId, user.organizationId)
      ));
    if (!op) return "Operação não pertence à sua organização";
  } else {
    const [role] = await db
      .select({ id: userRolesTable.id })
      .from(userRolesTable)
      .where(and(
        eq(userRolesTable.userId, user.sub),
        eq(userRolesTable.operationId, operationId),
        eq(userRolesTable.active, true)
      ));
    if (!role) return "Você não tem acesso a esta operação";
  }

  if (targetUserId) {
    const [membership] = await db
      .select({ id: userRolesTable.id })
      .from(userRolesTable)
      .where(and(
        eq(userRolesTable.userId, targetUserId),
        eq(userRolesTable.operationId, operationId),
        eq(userRolesTable.active, true)
      ));
    if (!membership) return "Membro não pertence a esta operação";
  }

  return null;
}

/**
 * Filtra folgas para manter apenas as de membros escaláveis (Performers comuns),
 * removendo administradores (role=ADMIN na operação) e membros especiais
 * (specialization preenchida e != PERFORMER). Usado no contexto de escalas, onde
 * folgas de admins/especiais não devem aparecer de forma alguma.
 */
async function filterSchedulableFolgas<T extends { userId: string; operationId: string }>(
  rows: T[]
): Promise<T[]> {
  if (rows.length === 0) return rows;
  const ids = [...new Set(rows.map((r) => r.userId))];

  const uRows = await db
    .select({ id: usersTable.id, specialization: usersTable.specialization })
    .from(usersTable)
    .where(inArray(usersTable.id, ids));
  const specMap = new Map(uRows.map((u) => [u.id, u.specialization]));

  const adminRows = await db
    .select({ userId: userRolesTable.userId, operationId: userRolesTable.operationId })
    .from(userRolesTable)
    .where(and(
      inArray(userRolesTable.userId, ids),
      eq(userRolesTable.role, "ADMIN"),
      eq(userRolesTable.active, true),
    ));
  const adminPairs = new Set(adminRows.map((r) => `${r.userId}|${r.operationId}`));

  return rows.filter((r) =>
    isSchedulableMember({
      isAdmin: adminPairs.has(`${r.userId}|${r.operationId}`),
      specialization: specMap.get(r.userId) ?? null,
    })
  );
}

/**
 * Cancel a folga record that overlaps a month range, preserving days outside the range
 * by creating left and/or right fragments.
 */
async function cancelAndSplitRange(
  f: {
    id: string;
    startDate: string;
    endDate: string;
    type: string;
    userId: string;
    operationId: string;
    notes: string | null;
  },
  firstDay: string,
  lastDay: string,
  createdBy: string,
  executor: FolgaMutationExecutor = db,
): Promise<void> {
  await executor
    .update(folgasTable)
    .set({ status: "CANCELLED", updatedAt: new Date() })
    .where(eq(folgasTable.id, f.id));

  if (f.startDate < firstDay) {
    await executor.insert(folgasTable).values({
      userId: f.userId,
      operationId: f.operationId,
      type: f.type as any,
      startDate: f.startDate,
      endDate: offsetDate(firstDay, -1),
      status: "ACTIVE",
      origem: "MANUAL",
      createdBy,
      notes: f.notes,
    });
  }

  if (f.endDate > lastDay) {
    await executor.insert(folgasTable).values({
      userId: f.userId,
      operationId: f.operationId,
      type: f.type as any,
      startDate: offsetDate(lastDay, 1),
      endDate: f.endDate,
      status: "ACTIVE",
      origem: "MANUAL",
      createdBy,
      notes: f.notes,
    });
  }
}

/**
 * Cancel a folga record and, if it spans more than the target date,
 * create left and/or right fragments to preserve the days not being edited.
 */
async function cancelAndSplit(
  f: {
    id: string;
    startDate: string;
    endDate: string;
    type: string;
    userId: string;
    operationId: string;
    notes: string | null;
  },
  targetDate: string,
  createdBy: string,
  executor: FolgaMutationExecutor = db,
): Promise<void> {
  await executor
    .update(folgasTable)
    .set({ status: "CANCELLED", updatedAt: new Date() })
    .where(eq(folgasTable.id, f.id));

  if (f.startDate < targetDate) {
    await executor.insert(folgasTable).values({
      userId: f.userId,
      operationId: f.operationId,
      type: f.type as any,
      startDate: f.startDate,
      endDate: offsetDate(targetDate, -1),
      status: "ACTIVE",
      origem: "MANUAL",
      createdBy,
      notes: f.notes,
    });
  }

  if (f.endDate > targetDate) {
    await executor.insert(folgasTable).values({
      userId: f.userId,
      operationId: f.operationId,
      type: f.type as any,
      startDate: offsetDate(targetDate, 1),
      endDate: f.endDate,
      status: "ACTIVE",
      origem: "MANUAL",
      createdBy,
      notes: f.notes,
    });
  }
}

// ─── GET /folgas — listar (baseado em papel) ──────────────────────────────────

router.get("/folgas", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger(LOG_DOMAIN.FOLGAS, req.requestId, req.correlationId);
  const user = req.user!;
  const raw = req.query as Record<string, string>;
  const operationId = raw.operationId === "__all__" ? undefined : raw.operationId;
  const { userId, type, status, dateFrom, dateTo } = raw;

  try {
    const conditions: SQL<unknown>[] = [];

    if (user.role === "ADMIN") {
      conditions.push(eq(operationsTable.organizationId, user.organizationId));
      if (operationId) conditions.push(eq(folgasTable.operationId, operationId));
      if (userId) conditions.push(eq(folgasTable.userId, userId));
    } else if (MANAGER_ROLES.includes(user.role)) {
      if (!operationId) {
        res.status(400).json({ error: "Bad Request", message: "operationId é obrigatório para supervisores" });
        return;
      }
      const scopeErr = await validateManagerScope(user, operationId);
      if (scopeErr) { res.status(403).json({ error: "Forbidden", message: scopeErr }); return; }
      conditions.push(eq(folgasTable.operationId, operationId));
      if (userId) conditions.push(eq(folgasTable.userId, userId));
    } else {
      conditions.push(eq(folgasTable.userId, user.sub));
    }

    if (type) conditions.push(eq(folgasTable.type, type as any));
    if (status) conditions.push(eq(folgasTable.status, status as any));
    if (dateFrom) conditions.push(gte(folgasTable.startDate, dateFrom));
    if (dateTo) conditions.push(lte(folgasTable.endDate, dateTo));

    const rows = await db
      .select({
        id:            folgasTable.id,
        userId:        folgasTable.userId,
        userName:      usersTable.name,
        operationId:   folgasTable.operationId,
        operationName: operationsTable.name,
        type:          folgasTable.type,
        startDate:     folgasTable.startDate,
        endDate:       folgasTable.endDate,
        status:        folgasTable.status,
        origem:        folgasTable.origem,
        requestId:     folgasTable.requestId,
        createdBy:     folgasTable.createdBy,
        notes:         folgasTable.notes,
        createdAt:     folgasTable.createdAt,
        updatedAt:     folgasTable.updatedAt,
      })
      .from(folgasTable)
      .innerJoin(usersTable, eq(folgasTable.userId, usersTable.id))
      .innerJoin(operationsTable, eq(folgasTable.operationId, operationsTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(folgasTable.startDate));

    // Contexto de escala (admin/supervisores): a lista de folgas alimenta as escalas,
    // então administradores e membros especiais não devem aparecer. Membros vendo as
    // próprias folgas (else branch acima) não são filtrados.
    let visibleRows = rows;
    if (MANAGER_ROLES.includes(user.role) && rows.length > 0) {
      visibleRows = await filterSchedulableFolgas(rows);
    }

    log.info({ count: visibleRows.length, role: user.role }, "folgas listadas");
    res.json({ folgas: visibleRows });
  } catch (err) {
    log.error({ err }, "erro ao listar folgas");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── GET /folgas/grid — grade mensal ──────────────────────────────────────────

router.get("/folgas/grid", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger(LOG_DOMAIN.FOLGAS, req.requestId, req.correlationId);
  const user = req.user!;
  const { operationId, year, month } = req.query as Record<string, string>;

  if (!MANAGER_ROLES.includes(user.role)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  if (!operationId || !year || !month) {
    res.status(400).json({ error: "Bad Request", message: "operationId, year e month são obrigatórios" });
    return;
  }

  const yr = parseInt(year, 10);
  const mo = parseInt(month, 10);
  if (isNaN(yr) || isNaN(mo) || mo < 1 || mo > 12) {
    res.status(400).json({ error: "Bad Request", message: "year e month inválidos" });
    return;
  }

  const scopeErr = await validateManagerScope(user, operationId);
  if (scopeErr) { res.status(403).json({ error: "Forbidden", message: scopeErr }); return; }

  try {
    const firstDay = `${yr}-${String(mo).padStart(2, "0")}-01`;
    const daysInMonth = new Date(yr, mo, 0).getDate();
    const lastDay = `${yr}-${String(mo).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

    const allMembers = await db
      .selectDistinct({
        userId:         userRolesTable.userId,
        name:           usersTable.name,
        specialization: usersTable.specialization,
        areaId:         usersTable.areaId,
        defaultLocationId: usersTable.defaultLocationId,
      })
      .from(userRolesTable)
      .innerJoin(usersTable, eq(userRolesTable.userId, usersTable.id))
      .where(and(
        eq(userRolesTable.operationId, operationId),
        eq(userRolesTable.active, true),
      ))
      .orderBy(usersTable.name);

    // Administradores e membros especiais não fazem parte do elenco escalável.
    const adminRows = await db
      .select({ userId: userRolesTable.userId })
      .from(userRolesTable)
      .where(and(
        eq(userRolesTable.operationId, operationId),
        eq(userRolesTable.active, true),
        eq(userRolesTable.role, "ADMIN"),
      ));
    const adminSet = new Set(adminRows.map((r) => r.userId));

    const members = allMembers.filter((m) =>
      isSchedulableMember({ isAdmin: adminSet.has(m.userId), specialization: m.specialization })
    );

    const memberIds = members.map((m) => m.userId);

    // Grupo (operacional) de cada membro nesta operação — permite ao painel
    // organizar a grelha por grupos. Um membro sem grupo fica "Sem grupo".
    // Ligação membro→grupo vem do próprio user_role nesta operação.
    const memberGroupLinks = memberIds.length > 0
      ? await db
          .select({
            userId:  userRolesTable.userId,
            groupId: userRolesTable.groupId,
          })
          .from(userRolesTable)
          .where(and(
            eq(userRolesTable.operationId, operationId),
            eq(userRolesTable.active, true),
            isNotNull(userRolesTable.groupId),
            inArray(userRolesTable.userId, memberIds),
          ))
      : [];

    const linkedGroupIds = [...new Set(
      memberGroupLinks.map((r) => r.groupId).filter((g): g is string => !!g),
    )];

    // Anti-vazamento: só rotulamos com o grupo se este COBRIR a operação atual
    // (OPERATION dona / MULTI na cobertura / ALL da organização). Grupos de
    // outra operação (dados inconsistentes) são ignorados.
    const allowedGroups = new Map<string, { id: string; name: string }>();
    if (linkedGroupIds.length > 0) {
      const groups = await db
        .select()
        .from(operationalGroupsTable)
        .where(inArray(operationalGroupsTable.id, linkedGroupIds));
      for (const g of groups) {
        const covered = await groupCoveredOperationIds(g, user.organizationId);
        if (covered.includes(operationId)) {
          allowedGroups.set(g.id, { id: g.id, name: g.name });
        }
      }
    }

    const groupByUser = new Map<string, { id: string; name: string }>();
    for (const link of memberGroupLinks) {
      if (groupByUser.has(link.userId)) continue;
      const g = link.groupId ? allowedGroups.get(link.groupId) : undefined;
      if (g) groupByUser.set(link.userId, g);
    }

    const folgas = memberIds.length > 0
      ? await db
          .select({
            userId:    folgasTable.userId,
            type:      folgasTable.type,
            startDate: folgasTable.startDate,
            endDate:   folgasTable.endDate,
          })
          .from(folgasTable)
          .where(and(
            eq(folgasTable.operationId, operationId),
            eq(folgasTable.status, "ACTIVE"),
            lte(folgasTable.startDate, lastDay),
            gte(folgasTable.endDate, firstDay),
            inArray(folgasTable.userId, memberIds),
          ))
      : [];

    const daysMap: Record<string, Record<string, string>> = {};
    for (const f of folgas) {
      const sDate = new Date(f.startDate + "T00:00:00Z");
      const eDate = new Date(f.endDate + "T00:00:00Z");

      const startDay =
        sDate.getUTCFullYear() === yr && sDate.getUTCMonth() + 1 === mo
          ? sDate.getUTCDate()
          : 1;
      const endDay =
        eDate.getUTCFullYear() === yr && eDate.getUTCMonth() + 1 === mo
          ? eDate.getUTCDate()
          : daysInMonth;

      if (!daysMap[f.userId]) daysMap[f.userId] = {};
      for (let d = startDay; d <= endDay; d++) {
        daysMap[f.userId][String(d)] = f.type;
      }
    }

    // Quem pode ser alterado por quem está olhando (a tela trava as outras linhas).
    const scopes = user.role === "ADMIN" ? [] : await listAreaLocalScopes(user.sub, user.organizationId);
    const canEdit = (m: (typeof members)[number]) => user.role === "ADMIN" || (m.userId !== user.sub && inTeam(scopes, m));
    const result = members.map((m) => {
      const days = daysMap[m.userId] ?? {};
      const totals: Record<string, number> = {
        NO_SHOW: 0, RECESSO: 0, OUTRO: 0, DAY_OFF: 0, AFASTAMENTO: 0, RESTRICAO: 0,
      };
      for (const type of Object.values(days)) {
        if (type in totals) totals[type]++;
      }
      const g = groupByUser.get(m.userId) ?? null;
      return { userId: m.userId, name: m.name, days, totals, groupId: g?.id ?? null, groupName: g?.name ?? null, editable: canEdit(m) };
    });

    log.info({ operationId, yr, mo, members: result.length }, "grade de folgas gerada");
    res.json({ members: result, daysInMonth, publicacao: await monthPublication(operationId, yr, mo) });
  } catch (err) {
    log.error({ err }, "erro ao gerar grade de folgas");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── Publicar mês (desenho 18) ────────────────────────────────────────────────
// Cada célula do mapa já vale na hora. "Publicar mês" avisa a equipe da operação que o mês está
// pronto e fica no Registro; se o mapa mudar depois, a tela mostra "mudou depois de publicar".
const monthKey = (operationId: string, yr: number, mo: number) => `${operationId}:${yr}-${String(mo).padStart(2, "0")}`;

async function monthPublication(operationId: string, yr: number, mo: number) {
  const [event] = await db.select({ occurredAt: historyEventsTable.occurredAt, actorName: historyEventsTable.actorName }).from(historyEventsTable)
    .where(and(eq(historyEventsTable.action, "FOLGA_MONTH_PUBLISHED"), eq(historyEventsTable.entityId, monthKey(operationId, yr, mo))))
    .orderBy(desc(historyEventsTable.occurredAt)).limit(1);
  if (!event) return { publishedAt: null, publishedBy: null, changedSince: false };
  const first = `${yr}-${String(mo).padStart(2, "0")}-01`, last = `${yr}-${String(mo).padStart(2, "0")}-${String(new Date(yr, mo, 0).getDate()).padStart(2, "0")}`;
  const [changed] = await db.select({ id: folgasTable.id }).from(folgasTable)
    .where(and(eq(folgasTable.operationId, operationId), lte(folgasTable.startDate, last), gte(folgasTable.endDate, first), gt(folgasTable.updatedAt, event.occurredAt))).limit(1);
  return { publishedAt: event.occurredAt.toISOString(), publishedBy: event.actorName ?? null, changedSince: Boolean(changed) };
}

router.post("/folgas/grid/publicar", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger(LOG_DOMAIN.FOLGAS, req.requestId, req.correlationId);
  const user = req.user!;
  if (!MANAGER_ROLES.includes(user.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  const { operationId, year, month } = req.body as { operationId?: string; year?: number; month?: number };
  if (!operationId || !year || !month || month < 1 || month > 12) { res.status(400).json({ error: "Bad Request", message: "operationId, year e month são obrigatórios" }); return; }
  const scopeErr = await validateManagerScope(user, operationId);
  if (scopeErr) { res.status(403).json({ error: "Forbidden", message: scopeErr }); return; }
  if (user.role !== "ADMIN") { res.status(403).json({ error: "Forbidden", message: "Só a Administração faz isso no mês inteiro" }); return; }
  try {
    const nomeMes = new Date(year, month - 1, 1).toLocaleDateString("pt-BR", { month: "long" });
    const membros = await db.selectDistinct({ id: userRolesTable.userId }).from(userRolesTable)
      .innerJoin(usersTable, eq(userRolesTable.userId, usersTable.id))
      .where(and(eq(userRolesTable.operationId, operationId), eq(userRolesTable.active, true), eq(usersTable.status, "ACTIVE")));
    const destinatarios = membros.map((m) => m.id).filter((id) => id !== user.sub);
    const republicacao = (await monthPublication(operationId, year, month)).publishedAt !== null;
    await writeHistoryEvent({
      category: "ABSENCE", action: "FOLGA_MONTH_PUBLISHED",
      title: `Folgas de ${nomeMes} ${republicacao ? "republicadas" : "publicadas"}`,
      narrative: `${destinatarios.length} pessoa(s) da operação avisada(s).`,
      entityType: "folga_mes", entityId: monthKey(operationId, year, month), actorId: user.sub, operationId, orgId: user.organizationId,
      metadata: { year, month, avisados: destinatarios.length, republicacao },
    });
    await notifyMany(destinatarios, {
      type: "folga.month_published", title: republicacao ? `Folgas de ${nomeMes} mudaram` : `Folgas de ${nomeMes} publicadas`,
      message: republicacao ? `O mapa de folgas de ${nomeMes} foi atualizado. Confira as suas.` : `O mapa de folgas de ${nomeMes} está pronto. Confira as suas.`,
      category: "absence", entityType: "folga_mes", entityId: monthKey(operationId, year, month), actionUrl: "/folgas",
    });
    log.info({ operationId, year, month, avisados: destinatarios.length }, "mês de folgas publicado");
    res.json({ ok: true, avisados: destinatarios.length, publicacao: await monthPublication(operationId, year, month) });
  } catch (err) { log.error({ err }, "erro ao publicar mês de folgas"); res.status(500).json({ error: "Internal Server Error" }); }
});

// ─── POST /folgas/grid/toggle — alternar célula ───────────────────────────────

router.post("/folgas/grid/toggle", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger(LOG_DOMAIN.FOLGAS, req.requestId, req.correlationId);
  const user = req.user!;

  if (!MANAGER_ROLES.includes(user.role)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const { userId, operationId, date, type } = req.body as {
    userId: string; operationId: string; date: string; type?: string | null;
  };

  if (!userId || !operationId || !date) {
    res.status(400).json({ error: "Bad Request", message: "userId, operationId e date são obrigatórios" });
    return;
  }

  const scopeErr = await validateManagerScope(user, operationId, userId);
  if (scopeErr) { res.status(403).json({ error: "Forbidden", message: scopeErr }); return; }
  { const block = await folgaEditBlock(user, userId); if (block) { res.status(403).json({ error: "Forbidden", message: block }); return; } }

  try {
    await db.transaction(async (tx) => {
      const existing = await tx
        .select({
          id: folgasTable.id,
          startDate: folgasTable.startDate,
          endDate: folgasTable.endDate,
          type: folgasTable.type,
          userId: folgasTable.userId,
          operationId: folgasTable.operationId,
          notes: folgasTable.notes,
        })
        .from(folgasTable)
        .where(and(
          eq(folgasTable.userId, userId),
          eq(folgasTable.operationId, operationId),
          eq(folgasTable.status, "ACTIVE"),
          lte(folgasTable.startDate, date),
          gte(folgasTable.endDate, date),
        ));

      for (const f of existing) {
        await cancelAndSplit(f, date, user.sub, tx as any);
      }

      if (type) {
        const [created] = await tx.insert(folgasTable).values({
          userId,
          operationId,
          type: type as any,
          startDate: date,
          endDate: date,
          status: "ACTIVE",
          origem: "MANUAL",
          createdBy: user.sub,
        }).returning();

        await writeHistoryEvent({
          category: "ABSENCE",
          action: "FOLGA_GRID_SET",
          title: `Folga ${type} registrada em ${date}`,
          narrative: `Gestor registrou ausência tipo ${type} para o membro no dia ${date}.`,
          entityType: "folga",
          entityId: created?.id ?? `${userId}:${date}`,
          actorId: user.sub,
          operationId,
          orgId: user.organizationId,
          beforeState: { activeFolgas: existing },
          afterState: created ?? null,
        }, tx as any);
      } else if (existing.length > 0) {
        await writeHistoryEvent({
          category: "ABSENCE",
          action: "FOLGA_GRID_CLEAR",
          title: `Folga removida em ${date}`,
          narrative: `Gestor removeu ausência do membro no dia ${date}.`,
          entityType: "folga",
          entityId: `${userId}:${date}`,
          actorId: user.sub,
          operationId,
          orgId: user.organizationId,
          beforeState: { activeFolgas: existing },
          afterState: null,
        }, tx as any);
      }
    });

    log.info({ userId, date, type: type ?? "clear" }, "célula da grade alterada");
    res.json({ ok: true });
  } catch (err) {
    log.error({ err }, "erro ao alternar célula da grade");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── POST /folgas/grid/bulk — preencher múltiplas células ─────────────────────

router.post("/folgas/grid/bulk", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger(LOG_DOMAIN.FOLGAS, req.requestId, req.correlationId);
  const user = req.user!;

  if (!MANAGER_ROLES.includes(user.role)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const { userId, operationId, dates, type } = req.body as {
    userId: string; operationId: string; dates: string[]; type?: string | null;
  };

  if (!userId || !operationId || !Array.isArray(dates) || dates.length === 0) {
    res.status(400).json({ error: "Bad Request", message: "userId, operationId e dates[] são obrigatórios" });
    return;
  }

  const scopeErr = await validateManagerScope(user, operationId, userId);
  if (scopeErr) { res.status(403).json({ error: "Forbidden", message: scopeErr }); return; }
  { const block = await folgaEditBlock(user, userId); if (block) { res.status(403).json({ error: "Forbidden", message: block }); return; } }

  try {
    const sortedDates = [...dates].sort();

    await db.transaction(async (tx) => {
      const beforeState: Record<string, unknown>[] = [];
      for (const date of sortedDates) {
        const existing = await tx
          .select({
            id: folgasTable.id,
            startDate: folgasTable.startDate,
            endDate: folgasTable.endDate,
            type: folgasTable.type,
            userId: folgasTable.userId,
            operationId: folgasTable.operationId,
            notes: folgasTable.notes,
          })
          .from(folgasTable)
          .where(and(
            eq(folgasTable.userId, userId),
            eq(folgasTable.operationId, operationId),
            eq(folgasTable.status, "ACTIVE"),
            lte(folgasTable.startDate, date),
            gte(folgasTable.endDate, date),
          ));
        beforeState.push({ date, activeFolgas: existing });

        for (const f of existing) {
          await cancelAndSplit(f, date, user.sub, tx as any);
        }

        if (type) {
          await tx.insert(folgasTable).values({
            userId,
            operationId,
            type: type as any,
            startDate: date,
            endDate: date,
            status: "ACTIVE",
            origem: "MANUAL",
            createdBy: user.sub,
          });
        }
      }

      await writeHistoryEvent({
        category: "ABSENCE",
        action: "FOLGA_GRID_BULK",
        title: `Bulk de folgas: ${dates.length} dia(s) ${type ?? "limpos"}`,
        narrative: `Gestor aplicou ${type ?? "limpeza"} em ${dates.length} dia(s) para o membro.`,
        entityType: "folga",
        entityId: userId,
        actorId: user.sub,
        operationId,
        orgId: user.organizationId,
        metadata: { dates, type: type ?? null },
        beforeState: { dates: beforeState },
        afterState: { dates: sortedDates, type: type ?? null },
      }, tx as any);
    });

    log.info({ userId, count: dates.length, type: type ?? "clear" }, "bulk de folgas aplicado");
    res.json({ ok: true, processed: dates.length });
  } catch (err) {
    log.error({ err }, "erro ao aplicar bulk de folgas");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── POST /folgas/grid/repeat — copiar a configuração do mês anterior ───────
router.post("/folgas/grid/repeat", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger(LOG_DOMAIN.FOLGAS, req.requestId, req.correlationId);
  const user = req.user!;
  if (!MANAGER_ROLES.includes(user.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  const { operationId, year, month } = req.body as { operationId?: string; year?: number; month?: number };
  if (!operationId || !year || !month || month < 1 || month > 12) { res.status(400).json({ error: "Bad Request", message: "operationId, year e month são obrigatórios" }); return; }
  const scopeErr = await validateManagerScope(user, operationId);
  if (scopeErr) { res.status(403).json({ error: "Forbidden", message: scopeErr }); return; }
  if (user.role !== "ADMIN") { res.status(403).json({ error: "Forbidden", message: "Só a Administração faz isso no mês inteiro" }); return; }
  try {
    const first = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const previous = new Date(year, month - 2, 1);
    const previousYear = previous.getFullYear(), previousMonth = previous.getMonth() + 1;
    const previousLast = new Date(previousYear, previousMonth, 0).getDate();
    const sourceFirst = `${previousYear}-${String(previousMonth).padStart(2, "0")}-01`;
    const sourceLast = `${previousYear}-${String(previousMonth).padStart(2, "0")}-${String(previousLast).padStart(2, "0")}`;
    const source = await db.select({ userId: folgasTable.userId, type: folgasTable.type, startDate: folgasTable.startDate, endDate: folgasTable.endDate })
      .from(folgasTable).where(and(eq(folgasTable.operationId, operationId), eq(folgasTable.status, "ACTIVE"), lte(folgasTable.startDate, sourceLast), gte(folgasTable.endDate, sourceFirst)));
    const daysToCopy = Math.min(previousLast, lastDay);
    await db.transaction(async (tx) => {
      for (const row of source) {
        const start = Math.max(1, Number(row.startDate.slice(8, 10)));
        const end = Math.min(daysToCopy, Number(row.endDate.slice(8, 10)));
        if (start > end) continue;
        for (let day = start; day <= end; day++) await tx.insert(folgasTable).values({ userId: row.userId, operationId, type: row.type, startDate: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`, endDate: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`, status: "ACTIVE", origem: "MANUAL", createdBy: user.sub });
      }
      await writeHistoryEvent({ category: "ABSENCE", action: "FOLGA_GRID_REPEAT", title: `Configuração repetida — ${month}/${year}`, narrative: `Gestor repetiu a configuração do mês anterior na operação.`, entityType: "folga", entityId: operationId, actorId: user.sub, operationId, orgId: user.organizationId, metadata: { year, month, sourceYear: previousYear, sourceMonth: previousMonth, copied: source.length } }, tx as any);
    });
    log.info({ operationId, year, month, copied: source.length }, "configuração mensal repetida");
    res.json({ ok: true, copied: source.length });
  } catch (err) { log.error({ err }, "erro ao repetir configuração mensal"); res.status(500).json({ error: "Internal Server Error" }); }
});

// ─── DELETE /folgas/grid/reset — resetar mês inteiro ─────────────────────────

router.delete("/folgas/grid/reset", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger(LOG_DOMAIN.FOLGAS, req.requestId, req.correlationId);
  const user = req.user!;

  if (user.role !== "ADMIN") {
    res.status(403).json({ error: "Forbidden", message: "Apenas Admin pode resetar o mês" });
    return;
  }

  const { operationId, year, month } = req.query as Record<string, string>;

  if (!operationId || !year || !month) {
    res.status(400).json({ error: "Bad Request", message: "operationId, year e month são obrigatórios" });
    return;
  }

  const yr = parseInt(year, 10);
  const mo = parseInt(month, 10);
  if (isNaN(yr) || isNaN(mo) || mo < 1 || mo > 12) {
    res.status(400).json({ error: "Bad Request", message: "year e month inválidos" });
    return;
  }

  const scopeErr = await validateManagerScope(user, operationId);
  if (scopeErr) { res.status(403).json({ error: "Forbidden", message: scopeErr }); return; }
  if (user.role !== "ADMIN") { res.status(403).json({ error: "Forbidden", message: "Só a Administração faz isso no mês inteiro" }); return; }

  try {
    const firstDay = `${yr}-${String(mo).padStart(2, "0")}-01`;
    const daysInMonth = new Date(yr, mo, 0).getDate();
    const lastDay = `${yr}-${String(mo).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

    const toCancel = await db.transaction(async (tx) => {
      const activeFolgas = await tx
        .select({
          id: folgasTable.id,
          startDate: folgasTable.startDate,
          endDate: folgasTable.endDate,
          type: folgasTable.type,
          userId: folgasTable.userId,
          operationId: folgasTable.operationId,
          notes: folgasTable.notes,
        })
        .from(folgasTable)
        .where(and(
          eq(folgasTable.operationId, operationId),
          eq(folgasTable.status, "ACTIVE"),
          lte(folgasTable.startDate, lastDay),
          gte(folgasTable.endDate, firstDay),
        ));

      for (const f of activeFolgas) {
        await cancelAndSplitRange(f, firstDay, lastDay, user.sub, tx as any);
      }

      await writeHistoryEvent({
        category: "ABSENCE",
        action: "FOLGA_GRID_RESET",
        title: `Grade de folgas resetada — ${mo}/${yr}`,
        narrative: `Admin resetou todas as folgas do mês ${mo}/${yr} na operação.`,
        entityType: "folga",
        entityId: operationId,
        actorId: user.sub,
        operationId,
        orgId: user.organizationId,
        metadata: { year: yr, month: mo, cancelled: activeFolgas.length },
        beforeState: { activeFolgas },
        afterState: { resetRange: { firstDay, lastDay } },
      }, tx as any);
      return activeFolgas;
    });

    log.info({ operationId, yr, mo, cancelled: toCancel.length }, "mês de folgas resetado");
    res.json({ ok: true, cancelled: toCancel.length });
  } catch (err) {
    log.error({ err }, "erro ao resetar mês de folgas");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── POST /folgas — criar folga manual ────────────────────────────────────────

router.post("/folgas", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger(LOG_DOMAIN.FOLGAS, req.requestId, req.correlationId);
  const user = req.user!;

  if (!MANAGER_ROLES.includes(user.role)) {
    res.status(403).json({ error: "Forbidden", message: "Apenas gestores podem criar folgas manualmente" });
    return;
  }

  const { userId, operationId, type, startDate, endDate, notes } = req.body as {
    userId: string; operationId: string; type: string;
    startDate: string; endDate: string; notes?: string;
  };

  if (!userId || !operationId || !type || !startDate || !endDate) {
    res.status(400).json({ error: "Bad Request", message: "userId, operationId, type, startDate e endDate são obrigatórios" });
    return;
  }

  try {
    const scopeErr = await validateManagerScope(user, operationId, userId);
    if (scopeErr) { res.status(403).json({ error: "Forbidden", message: scopeErr }); return; }
    { const block = await folgaEditBlock(user, userId); if (block) { res.status(403).json({ error: "Forbidden", message: block }); return; } }
    const [folga] = await db.transaction(async (tx) => {
      const [row] = await tx.insert(folgasTable).values({
        userId, operationId, type: type as any, startDate, endDate, status: "ACTIVE",
        origem: "MANUAL", createdBy: user.sub, notes: notes ?? null,
      }).returning();
      if (!row) throw new Error("Não foi possível criar folga");
      await writeHistoryEvent({
        category: "ABSENCE", action: "FOLGA_CREATED", title: `Folga ${type} registrada`,
        narrative: `Gestor registrou folga manual do tipo ${type} de ${startDate} a ${endDate}.`,
        entityType: "folga", entityId: row.id, actorId: user.sub, operationId,
        orgId: user.organizationId, beforeState: null, afterState: row,
        metadata: { reason: req.body?.reason ?? null },
      }, tx as any);
      return [row] as const;
    });

    await sendNotification({
      userId,
      type: "folga.created",
      title: "Nova folga registrada",
      message: `Uma folga foi registrada para você de ${startDate} a ${endDate}.`,
      category: "absence",
      entityType: "folga",
      entityId: folga!.id,
    });

    log.info({ folgaId: folga!.id, userId, type }, "folga criada");
    res.status(201).json(folga);
  } catch (err) {
    log.error({ err }, "erro ao criar folga");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── PATCH /folgas/:id — editar folga ─────────────────────────────────────────

router.patch("/folgas/:id", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger(LOG_DOMAIN.FOLGAS, req.requestId, req.correlationId);
  const user = req.user!;
  const id = req.params.id as string;

  if (!MANAGER_ROLES.includes(user.role)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const { type, startDate, endDate, notes } = req.body as {
    type?: string; startDate?: string; endDate?: string; notes?: string;
  };

  try {
    const [existing] = await db.select().from(folgasTable).where(eq(folgasTable.id, id));
    if (!existing) { res.status(404).json({ error: "Not Found" }); return; }
    const scopeErr = await validateManagerScope(user, existing.operationId, existing.userId);
    if (scopeErr) { res.status(403).json({ error: "Forbidden", message: scopeErr }); return; }
    { const block = await folgaEditBlock(user, existing.userId); if (block) { res.status(403).json({ error: "Forbidden", message: block }); return; } }
    if (existing.status === "CANCELLED") {
      res.status(400).json({ error: "Bad Request", message: "Folga cancelada não pode ser editada" });
      return;
    }

    const updates: Partial<typeof folgasTable.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (type) updates.type = type as any;
    if (startDate) updates.startDate = startDate;
    if (endDate) updates.endDate = endDate;
    if (notes !== undefined) updates.notes = notes;

    const [updated] = await db.transaction(async (tx) => {
      const [row] = await tx.update(folgasTable).set(updates).where(eq(folgasTable.id, id)).returning();
      if (!row) throw new Error("Folga não encontrada");
      await writeHistoryEvent({
        category: "ABSENCE", action: "FOLGA_UPDATED", title: "Folga atualizada",
        narrative: `Gestor atualizou a folga de ${existing.startDate} a ${existing.endDate}.`, entityType: "folga", entityId: id,
        actorId: user.sub, operationId: row.operationId, orgId: user.organizationId,
        beforeState: existing, afterState: row, metadata: { reason: req.body?.reason ?? null },
      }, tx as any);
      return [row] as const;
    });
    log.info({ folgaId: id }, "folga atualizada");
    res.json(updated);
  } catch (err) {
    log.error({ err }, "erro ao editar folga");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── POST /folgas/:id/cancelar — cancelar folga ───────────────────────────────

router.post("/folgas/:id/cancelar", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger(LOG_DOMAIN.FOLGAS, req.requestId, req.correlationId);
  const user = req.user!;
  const id = req.params.id as string;

  if (!MANAGER_ROLES.includes(user.role)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  try {
    const [existing] = await db.select().from(folgasTable).where(eq(folgasTable.id, id));
    if (!existing) { res.status(404).json({ error: "Not Found" }); return; }
    const scopeErr = await validateManagerScope(user, existing.operationId, existing.userId);
    if (scopeErr) { res.status(403).json({ error: "Forbidden", message: scopeErr }); return; }
    { const block = await folgaEditBlock(user, existing.userId); if (block) { res.status(403).json({ error: "Forbidden", message: block }); return; } }

    const [updated] = await db.transaction(async (tx) => {
      const [row] = await tx.update(folgasTable)
        .set({ status: "CANCELLED", updatedAt: new Date() })
        .where(eq(folgasTable.id, id)).returning();
      if (!row) throw new Error("Folga não encontrada");
      await writeHistoryEvent({
        category: "ABSENCE", action: "FOLGA_CANCELLED", title: "Folga cancelada",
        narrative: `Gestor cancelou folga de ${existing.startDate} a ${existing.endDate}.`, entityType: "folga", entityId: id,
        actorId: user.sub, operationId: existing.operationId, orgId: user.organizationId,
        beforeState: existing, afterState: row, metadata: { reason: req.body?.reason ?? null },
      }, tx as any);
      return [row] as const;
    });

    await sendNotification({
      userId: existing.userId,
      type: "folga.cancelled",
      title: "Folga cancelada",
      message: `Sua folga de ${existing.startDate} a ${existing.endDate} foi cancelada.`,
      category: "absence",
      entityType: "folga",
      entityId: id,
    });

    log.info({ folgaId: id }, "folga cancelada");
    res.json(updated);
  } catch (err) {
    log.error({ err }, "erro ao cancelar folga");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
