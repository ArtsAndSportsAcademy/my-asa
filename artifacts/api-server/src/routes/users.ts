import { Router, type IRouter } from "express";
import { randomInt } from "node:crypto";
import { eq, and, inArray, isNull, like, ne, gt, count } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import {
  usersTable,
  userRolesTable,
  operationsTable,
  operationalGroupsTable,
  groupOperationsTable,
  teamMembershipsTable,
  refreshTokensTable,
  deviceTokensTable,
  notificationsTable,
  userNotificationsTable,
  libraryViewsTable,
  messageThreadParticipantsTable,
  noticeRecipientsTable,
  noticeConfirmationsTable,
  noticeEscalationsTable,
  securityAuditLogTable,
  historyEventsTable,
  historyNarrativesTable,
  operationalChangesTable,
  areasTable,
} from "@workspace/db";
import { normalizeUsernameBase, resolveUniqueUsername, validateAndNormalizeUsername } from "@workspace/db";
import { requireAuth, requireOrganization, requireRole } from "../middlewares/auth.js";
import { recordAudit } from "../lib/audit.service.js";
import { hashToken } from "../lib/jwt.service.js";
import { requestLogger } from "../lib/logger.js";
import { adminPerson, colleaguePerson, selfProfile, supervisorPerson } from "../lib/person-projection.js";
import { loadAuthorizationContext } from "../lib/authorization.service.js";
import { normalizeReason, requireReason } from "../lib/reason.js";
import { writeHistoryEvent } from "../lib/history-helper.js";
import { listAreaLocalScopes } from "../services/area-local-scope.js";
import { canSupervisorAccessPerson } from "../services/area-local-scope.js";

const router: IRouter = Router();

/**
 * Anexa a cada usuário a lista de operações (operationIds) onde tem papel ATIVO.
 * Permite ao frontend escopar listagens por operação (ex.: montar a escala de uma
 * operação sem mostrar membros de outra operação da mesma organização).
 */
async function attachOperationIds(
  users: (typeof usersTable.$inferSelect)[],
  projection: "ADMIN" | "SUPERVISOR" | "COLEGA",
  viewerId = "",
) {
  const ids = users.map((u) => u.id);
  if (ids.length === 0) return [];
  const roles = await db.query.userRolesTable.findMany({
    where: and(eq(userRolesTable.active, true), inArray(userRolesTable.userId, ids)),
  });
  const [memberships, operations, areas] = await Promise.all([
    db.select({
      userId: teamMembershipsTable.userId,
      startsAt: teamMembershipsTable.startsAt,
      endsAt: teamMembershipsTable.endsAt,
      scope: operationalGroupsTable.scope,
      ownerOperationId: operationalGroupsTable.operationId,
      coveredOperationId: groupOperationsTable.operationId,
      teamStatus: operationalGroupsTable.status,
    })
      .from(teamMembershipsTable)
      .innerJoin(operationalGroupsTable, eq(operationalGroupsTable.id, teamMembershipsTable.teamId))
      .leftJoin(groupOperationsTable, eq(groupOperationsTable.groupId, operationalGroupsTable.id))
      .where(and(eq(teamMembershipsTable.active, true), inArray(teamMembershipsTable.userId, ids))),
    db.select({ id: operationsTable.id }).from(operationsTable)
      .where(eq(operationsTable.organizationId, users[0]!.organizationId)),
    db.select({ id: areasTable.id, name: areasTable.name }).from(areasTable)
      .where(eq(areasTable.organizationId, users[0]!.organizationId)),
  ]);
  const opsByUser = new Map<string, Set<string>>();
  const supByUser = new Map<string, Set<string>>();
  const adminUsers = new Set<string>();
  const characterEligibleUsers = new Set<string>();
  const teamOpsByUser = new Map<string, Set<string>>();
  const organizationOperationIds = new Set(operations.map((operation) => operation.id));
  const areaNames = new Map(areas.map((area) => [area.id, area.name]));
  for (const r of roles) {
    if (!organizationOperationIds.has(r.operationId)) continue;
    if (r.role === "ADMIN") adminUsers.add(r.userId);
    if (r.role === "MEMBER") characterEligibleUsers.add(r.userId);
    if (!r.operationId) continue;
    const set = opsByUser.get(r.userId) ?? new Set<string>();
    set.add(r.operationId);
    opsByUser.set(r.userId, set);
    // Operações onde o utilizador é supervisor (A/B). Permite ao frontend
    // mostrar só supervisores elegíveis ao escolher o responsável de um show.
    if (r.role === "SUPERVISOR_A" || r.role === "SUPERVISOR_B") {
      const sup = supByUser.get(r.userId) ?? new Set<string>();
      sup.add(r.operationId);
      supByUser.set(r.userId, sup);
    }
  }
  const now = new Date();
  for (const membership of memberships) {
    if (membership.teamStatus !== "ACTIVE") continue;
    if (membership.startsAt > now || (membership.endsAt && membership.endsAt < now)) continue;
    const target = teamOpsByUser.get(membership.userId) ?? new Set<string>();
    if (membership.scope === "ALL") operations.forEach((operation) => target.add(operation.id));
    else if (membership.scope === "MULTI" && membership.coveredOperationId) target.add(membership.coveredOperationId);
    else if (membership.ownerOperationId) target.add(membership.ownerOperationId);
    teamOpsByUser.set(membership.userId, target);
  }
  // `isAdmin` permite ao frontend excluir administradores das escalas/folgas
  // (não fazem parte do elenco escalável), sem precisar buscar papéis por usuário.
  return users.map((u) => ({
    ...(projection === "ADMIN" ? adminPerson(u) : projection === "COLEGA" ? colleaguePerson(u, viewerId) : supervisorPerson(u)),
    operationIds: [...(opsByUser.get(u.id) ?? [])],
    teamOperationIds: [...(teamOpsByUser.get(u.id) ?? [])],
    supervisorOperationIds: [...(supByUser.get(u.id) ?? [])],
    areaName: u.areaId ? areaNames.get(u.areaId) ?? null : null,
    isAdmin: adminUsers.has(u.id),
    // O seletor de personagem começa pelo elenco: direção, administração e
    // supervisão não entram como candidatos de personagem por acidente.
    isCharacterEligible: characterEligibleUsers.has(u.id),
  }));
}

async function supervisorCanViewUser(supervisorId: string, targetUserId: string): Promise<boolean> {
  const authorization = await loadAuthorizationContext(supervisorId);
  const supervisorRoles = authorization.roles.filter(
    (role) => role.role === "SUPERVISOR_A" || role.role === "SUPERVISOR_B",
  );
  const groupIds = supervisorRoles.map((role) => role.groupId).filter(Boolean) as string[];
  if (groupIds.length === 0) return false;
  const targetRole = await db.query.userRolesTable.findFirst({
    where: and(
      eq(userRolesTable.userId, targetUserId),
      eq(userRolesTable.active, true),
      inArray(userRolesTable.groupId, groupIds),
    ),
  });
  return !!targetRole;
}

router.get("/users", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger("teams", req.requestId, req.correlationId);
  const { role, sub, organizationId } = req.user!;

  try {
    if (role === "ADMIN") {
      const users = await db.query.usersTable.findMany({
        where: eq(usersTable.organizationId, organizationId),
      });
      res.json({ users: await attachOperationIds(users, "ADMIN") });
      return;
    }

    // Pessoas é diretório operacional: Direção o consulta inteiro, mas recebe
    // a mesma projeção reduzida de Supervisão (sem notas administrativas nem
    // dados sensíveis). Não é uma permissão de escrita.
    if (role === "DIR" || role === "DIRECTOR") {
      const users = await db.query.usersTable.findMany({
        where: eq(usersTable.organizationId, organizationId),
      });
      res.json({ users: await attachOperationIds(users, "SUPERVISOR") });
      return;
    }

    // O elenco vê os colegas da própria área, como combinado para a tela 07.
    // Nunca recebe a organização inteira, e a projeção remove os campos que
    // pertencem à ficha administrativa.
    if (role === "MEMBER" || role === "TRAINER") {
      const [me] = await db.select({ areaId: usersTable.areaId })
        .from(usersTable)
        .where(and(eq(usersTable.id, sub), eq(usersTable.organizationId, organizationId)))
        .limit(1);
      if (!me?.areaId) {
        res.json({ users: [] });
        return;
      }
      const users = await db.query.usersTable.findMany({
        where: and(eq(usersTable.organizationId, organizationId), eq(usersTable.areaId, me.areaId)),
      });
      // Colega vê telefone/e-mail só se a dona do dado deixou (28 Perfil, "quem vê o quê").
      res.json({ users: await attachOperationIds(users, "COLEGA", sub) });
      return;
    }

    // Supervisão vê a própria área inteira no diretório. O modelo novo é
    // área + local; o grupo legado continua sendo usado pelos demais módulos,
    // mas não pode esconder colegas da mesma área nesta tela de cadastro.
    if (role === "SUPERVISOR_A" || role === "SUPERVISOR_B") {
      const scopes = await listAreaLocalScopes(sub, organizationId);
      const areaIds = [...new Set(scopes.map((scope) => scope.areaId))];
      if (areaIds.length === 0) {
        res.json({ users: [] });
        return;
      }
      const users = await db.query.usersTable.findMany({
        where: and(eq(usersTable.organizationId, organizationId), inArray(usersTable.areaId, areaIds)),
      });
      res.json({ users: await attachOperationIds(users, "SUPERVISOR") });
      return;
    }

    const myRoles = await db.query.userRolesTable.findMany({
      where: and(
        eq(userRolesTable.userId, sub),
        eq(userRolesTable.active, true),
        inArray(userRolesTable.role, ["SUPERVISOR_A", "SUPERVISOR_B"]),
      ),
    });
    const myGroupIds = myRoles.map((r) => r.groupId).filter(Boolean) as string[];

    if (myGroupIds.length === 0) {
      res.json({ users: [] });
      return;
    }

    const memberRoles = await db.query.userRolesTable.findMany({
      where: and(eq(userRolesTable.active, true), inArray(userRolesTable.groupId, myGroupIds)),
    });
    const memberUserIds = [...new Set(memberRoles.map((r) => r.userId))];

    if (memberUserIds.length === 0) {
      res.json({ users: [] });
      return;
    }

    const users = await db.query.usersTable.findMany({
      where: and(eq(usersTable.organizationId, organizationId), inArray(usersTable.id, memberUserIds)),
    });
    res.json({ users: await attachOperationIds(users, "SUPERVISOR") });
  } catch (err) {
    log.error({ err }, "Error listing users");
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

router.get("/users/me/permissions", requireAuth, requireOrganization, async (req, res) => {
  const authorization = await loadAuthorizationContext(req.user!.sub);
  res.json({
    primaryRole: authorization.primaryRole,
    roles: authorization.roles,
    operationIds: authorization.operationIds,
    capabilities: authorization.capabilities,
  });
});

router.get("/users/:id", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger("teams", req.requestId, req.correlationId);
  const { role, sub, organizationId } = req.user!;
  const id = req.params.id as string;

  if ((role === "MEMBER" || role === "TRAINER") && id !== sub) {
    res.status(403).json({ error: "FORBIDDEN", message: "Membros só podem ver o próprio perfil" });
    return;
  }

  try {
    const user = await db.query.usersTable.findFirst({
      where: and(eq(usersTable.id, id), eq(usersTable.organizationId, organizationId)),
    });
    if (!user) {
      res.status(404).json({ error: "NOT_FOUND", message: "Usuário não encontrado" });
      return;
    }
    if (role !== "ADMIN" && id !== sub && !(await canSupervisorAccessPerson({ supervisorId: sub, organizationId, personId: id }))) {
      res.status(403).json({ error: "FORBIDDEN", message: "Pessoa fora do seu escopo de supervisão" });
      return;
    }
    const projected = role === "ADMIN"
      ? adminPerson(user)
      : id === sub
        ? selfProfile(user)
        : supervisorPerson(user);
    res.json({ user: projected });
  } catch (err) {
    log.error({ err }, "Error getting user");
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

router.post("/users", requireAuth, requireOrganization, requireRole("ADMIN"), async (req, res) => {
  const log = requestLogger("teams", req.requestId, req.correlationId);
  const {
    fullName, name: legacyName, email, phone, password, specialization, birthDate, visitUntil,
    entryDate, professionalProfile, primaryFunction, adminNotes, personStatus,
  } = req.body;

  const formalName = typeof fullName === "string" && fullName.trim()
    ? fullName.trim()
    : typeof legacyName === "string" && legacyName.trim()
      ? legacyName.trim()
      : "";
  if (!formalName) {
    res.status(400).json({ error: "BAD_REQUEST", message: "O nome completo é obrigatório" });
    return;
  }

  const VALID_SPECIALIZATIONS = ["PERFORMER", "CONVIDADO", "PROFESSOR", "TRAINER", "PHYSIOTHERAPIST", "STRENGTH_COACH", "TECHNICAL_OPERATOR", "CHOREOGRAPHER", "OTHER"];
  if (specialization && !VALID_SPECIALIZATIONS.includes(specialization)) {
    res.status(400).json({ error: "BAD_REQUEST", message: `specialization inválida. Valores aceitos: ${VALID_SPECIALIZATIONS.join(", ")}` });
    return;
  }

  try {
    const normalizedEmail = email?.trim() ? (email as string).toLowerCase().trim() : null;
    if (normalizedEmail) {
      const existing = await db.query.usersTable.findFirst({
        where: eq(usersTable.email, normalizedEmail),
      });
      if (existing) {
        res.status(409).json({ error: "CONFLICT", message: "E-mail já cadastrado" });
        return;
      }
    }

    let username: string | null = null;
    let passwordHash: string | null = null;
    if (password) {
      const usernameBase = normalizeUsernameBase(formalName);
      const conflicting = await db.query.usersTable.findMany({
        columns: { username: true },
        where: like(usersTable.username, `${usernameBase}%`),
      });
      const taken = new Set(conflicting.map((u) => u.username).filter((u): u is string => !!u));
      username = resolveUniqueUsername(usernameBase, taken);
      passwordHash = await bcrypt.hash(password as string, 12);
    }
    const [newUser] = await db.transaction(async (tx) => {
      const [created] = await tx.insert(usersTable).values({
        organizationId: req.user!.organizationId,
        fullName: formalName,
        name: formalName.split(/\s+/)[0]!,
        email: normalizedEmail,
        phone: typeof phone === "string" && phone.trim() ? phone.trim() : null,
        username,
        passwordHash,
        mustChangePassword: !!password,
        status: password ? "ACTIVE" : "INACTIVE",
        personStatus: ["ACTIVE", "ON_LEAVE", "LEFT", "ARCHIVED"].includes(personStatus) ? personStatus : "ACTIVE",
        professionalProfile: typeof professionalProfile === "string" && professionalProfile.trim() ? professionalProfile.trim() : null,
        primaryFunction: typeof primaryFunction === "string" && primaryFunction.trim() ? primaryFunction.trim() : null,
        specialization: specialization ?? null,
        birthDate: (birthDate as string | undefined) ?? null,
        entryDate: (entryDate as string | undefined) ?? null,
        visitUntil: (visitUntil as string | undefined) ?? null,
        adminNotes: typeof adminNotes === "string" && adminNotes.trim() ? adminNotes.trim() : null,
      }).returning();
      if (!created) throw new Error("Não foi possível criar a pessoa");
      await writeHistoryEvent({
        category: "OPERATIONAL_CHANGE", action: "user.created", title: "Pessoa criada",
        narrative: `A pessoa ${created.fullName} foi criada no cadastro.`, entityType: "user", entityId: created.id,
        actorId: req.user!.sub, orgId: created.organizationId, beforeState: null, afterState: created,
        metadata: { reason: normalizeReason(req.body?.reason) },
      }, tx as any);
      return [created] as const;
    });

    log.info({ userId: newUser!.id }, "User created");
    res.status(201).json({ user: adminPerson(newUser!) });
  } catch (err) {
    log.error({ err }, "Error creating user");
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

/** Encerra as sessões abertas da pessoa (refresh tokens), menos a do aparelho que pediu. */
async function encerrarSessoes(executor: Pick<typeof db, "update">, userId: string, manterRefreshToken?: unknown) {
  const manter = typeof manterRefreshToken === "string" && manterRefreshToken ? hashToken(manterRefreshToken) : null;
  const encerradas = await executor.update(refreshTokensTable).set({ revokedAt: new Date() })
    .where(and(eq(refreshTokensTable.userId, userId), isNull(refreshTokensTable.revokedAt), manter ? ne(refreshTokensTable.tokenHash, manter) : undefined))
    .returning({ id: refreshTokensTable.id });
  return encerradas.length;
}

/** Senha provisória legível para ditar no camarim: sem 0/O, 1/l/I. */
function senhaProvisoria() {
  const letras = "abcdefghjkmnpqrstuvwxyz", digitos = "23456789";
  const pick = (from: string) => from[randomInt(from.length)]!;
  return `${Array.from({ length: 4 }, () => pick(letras)).join("")}-${Array.from({ length: 4 }, () => pick(digitos)).join("")}`;
}

router.post("/users/me/password", requireAuth, async (req, res) => {
  const log = requestLogger("teams", req.requestId, req.correlationId);
  const { currentPassword, newPassword, refreshToken } = req.body;

  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: "BAD_REQUEST", message: "currentPassword e newPassword são obrigatórios" });
    return;
  }
  if ((newPassword as string).length < 6) {
    res.status(400).json({ error: "BAD_REQUEST", message: "A nova senha deve ter ao menos 6 caracteres" });
    return;
  }
  if (newPassword === currentPassword) {
    res.status(400).json({ error: "BAD_REQUEST", message: "A nova senha precisa ser diferente da atual" });
    return;
  }

  try {
    const me = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, req.user!.sub),
    });
    if (!me) {
      res.status(404).json({ error: "NOT_FOUND", message: "Usuário não encontrado" });
      return;
    }
    if (!me.passwordHash) {
      res.status(409).json({ error: "NO_PASSWORD", message: "Sua conta ainda não tem senha. Peça à Administração para definir uma senha provisória." });
      return;
    }

    const valid = await bcrypt.compare(currentPassword as string, me.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "INVALID_CREDENTIALS", message: "Senha atual incorreta" });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword as string, 12);
    // Trocar a senha encerra as sessões dos outros aparelhos; a deste aparelho continua.
    const sessoesEncerradas = await db.transaction(async (tx) => {
      await tx.update(usersTable).set({ passwordHash, mustChangePassword: false, updatedAt: new Date() }).where(eq(usersTable.id, me.id));
      const encerradas = await encerrarSessoes(tx, me.id, refreshToken);
      await writeHistoryEvent({
        category: "OPERATIONAL_CHANGE", action: "user.password_changed", title: "Senha trocada",
        narrative: me.mustChangePassword ? "A pessoa trocou a senha provisória por uma senha sua." : `A pessoa trocou a própria senha; ${encerradas === 1 ? "1 sessão em outro aparelho foi encerrada" : `${encerradas} sessões em outros aparelhos foram encerradas`}.`,
        entityType: "user", entityId: me.id, actorId: me.id, orgId: me.organizationId,
        beforeState: { mustChangePassword: me.mustChangePassword }, afterState: { mustChangePassword: false, sessoesEncerradas: encerradas },
      }, tx as any);
      return encerradas;
    });

    await recordAudit({
      actorId: me.id,
      action: "USER_UPDATED",
      targetResource: `user:${me.id}`,
      metadata: { change: "password", sessoesEncerradas },
    });

    log.info({ userId: me.id }, "Password changed");
    res.json({ ok: true, sessoesEncerradas });
  } catch (err) {
    log.error({ err }, "Error changing password");
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

/** Quantas sessões a pessoa tem abertas (aparelhos com login ativo). */
router.get("/users/me/sessions", requireAuth, async (req, res) => {
  const [row] = await db.select({ n: count() }).from(refreshTokensTable)
    .where(and(eq(refreshTokensTable.userId, req.user!.sub), isNull(refreshTokensTable.revokedAt), gt(refreshTokensTable.expiresAt, new Date())));
  res.json({ abertas: Number(row?.n ?? 0) });
});

/** Encerra as sessões dos outros aparelhos; a deste (refreshToken no corpo) continua. */
router.post("/users/me/sessions/encerrar-outras", requireAuth, async (req, res) => {
  const { refreshToken } = req.body ?? {};
  if (typeof refreshToken !== "string" || !refreshToken) {
    res.status(400).json({ error: "BAD_REQUEST", message: "Falta a sessão deste aparelho (refreshToken)." });
    return;
  }
  const me = await db.query.usersTable.findFirst({ where: eq(usersTable.id, req.user!.sub), columns: { id: true, organizationId: true } });
  if (!me) { res.status(404).json({ error: "NOT_FOUND" }); return; }
  const encerradas = await db.transaction(async (tx) => {
    const n = await encerrarSessoes(tx, me.id, refreshToken);
    await writeHistoryEvent({
      category: "OPERATIONAL_CHANGE", action: "user.sessions_revoked", title: "Sessões encerradas",
      narrative: `A pessoa encerrou ${n === 1 ? "1 sessão em outro aparelho" : `${n} sessões em outros aparelhos`}.`,
      entityType: "user", entityId: me.id, actorId: me.id, orgId: me.organizationId,
      beforeState: null, afterState: { sessoesEncerradas: n },
    }, tx as any);
    return n;
  });
  res.json({ ok: true, sessoesEncerradas: encerradas });
});

/**
 * Administração redefine a senha de alguém que esqueceu: gera uma senha provisória (mostrada uma vez),
 * obriga a troca no próximo login e encerra todas as sessões da pessoa. Motivo obrigatório.
 */
router.post("/users/:id/password-reset", requireAuth, requireOrganization, requireRole("ADMIN"), async (req, res) => {
  const log = requestLogger("teams", req.requestId, req.correlationId);
  const id = req.params.id as string;
  if (id === req.user!.sub) {
    res.status(400).json({ error: "BAD_REQUEST", message: "Para a sua própria senha, use Perfil → mudar senha." });
    return;
  }
  const reason = requireReason(res, req.body?.reason, "redefinir a senha");
  if (!reason) return;
  try {
    const person = await db.query.usersTable.findFirst({ where: and(eq(usersTable.id, id), eq(usersTable.organizationId, req.user!.organizationId)) });
    if (!person) { res.status(404).json({ error: "NOT_FOUND", message: "Pessoa não encontrada" }); return; }
    if (person.status !== "ACTIVE") { res.status(409).json({ error: "CONFLICT", message: "Esta pessoa não está ativa; reative o cadastro antes de redefinir a senha." }); return; }
    const temporaria = senhaProvisoria();
    const passwordHash = await bcrypt.hash(temporaria, 12);
    const encerradas = await db.transaction(async (tx) => {
      await tx.update(usersTable).set({ passwordHash, mustChangePassword: true, updatedAt: new Date() }).where(eq(usersTable.id, person.id));
      const n = await encerrarSessoes(tx, person.id);
      await writeHistoryEvent({
        category: "OPERATIONAL_CHANGE", action: "user.password_reset", title: "Senha redefinida",
        narrative: `A Administração redefiniu a senha de ${person.fullName ?? person.name}. A pessoa troca a senha provisória no próximo login; ${n === 1 ? "1 sessão aberta foi encerrada" : `${n} sessões abertas foram encerradas`}.`,
        entityType: "user", entityId: person.id, actorId: req.user!.sub, orgId: person.organizationId,
        beforeState: { mustChangePassword: person.mustChangePassword }, afterState: { mustChangePassword: true, sessoesEncerradas: n },
        metadata: { reason },
      }, tx as any);
      return n;
    });
    await recordAudit({ actorId: req.user!.sub, action: "USER_UPDATED", targetResource: `user:${person.id}`, metadata: { change: "password_reset", sessoesEncerradas: encerradas } });
    log.info({ userId: person.id }, "Password reset by admin");
    res.json({ senhaProvisoria: temporaria, sessoesEncerradas: encerradas });
  } catch (err) {
    log.error({ err }, "Error resetting password");
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

router.patch("/users/:id", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger("teams", req.requestId, req.correlationId);
  const id = req.params.id as string;
  const {
    fullName, displayName, name: legacyName, preferredName: legacyPreferredName, email, phone, username, photoUrl, specialization, birthDate, visitUntil,
    entryDate, professionalProfile, primaryFunction, adminNotes, personStatus, contactVisibility, reason,
  } = req.body;

  const role = req.user!.role;
  const isAdmin = role === "ADMIN";
  const isSelf = id === req.user!.sub;

  // O nome de usuário pode ser editado pelo próprio usuário ou por um admin.
  if (username !== undefined && !isAdmin && !isSelf) {
    res.status(403).json({ error: "FORBIDDEN", message: "Você só pode alterar o seu próprio nome de usuário." });
    return;
  }

  // Nome formal, e-mail e data de nascimento permanecem exclusivos do admin.
  if ((fullName !== undefined || legacyName !== undefined || birthDate !== undefined || entryDate !== undefined || professionalProfile !== undefined ||
      primaryFunction !== undefined || adminNotes !== undefined || personStatus !== undefined) && !isAdmin) {
    res.status(403).json({ error: "FORBIDDEN", message: "Apenas administradores podem editar nome completo, e-mail ou data de nascimento." });
    return;
  }
  if (displayName !== undefined && !isSelf) {
    res.status(403).json({ error: "FORBIDDEN", message: "O nome de exibição é escolhido pela própria pessoa no Perfil." });
    return;
  }

  // Especialização (função) e visitUntil (data de saída de convidados) são campos
  // exclusivos de admin ou supervisor — não podem ser alterados pelo próprio membro.
  if ((specialization !== undefined || visitUntil !== undefined) && !isAdmin) {
    res.status(403).json({ error: "FORBIDDEN", message: "Você não tem permissão para editar a especialização ou data de saída." });
    return;
  }

  // Na primeira entrega, supervisores consultam sua equipe, mas alterações de
  // cadastro administrativo continuam exclusivas da Administração autorizada.
  if (!isAdmin && !isSelf) {
    res.status(403).json({ error: "FORBIDDEN", message: "Você não tem permissão para editar este usuário." });
    return;
  }

  // preferredName é compatibilidade da tela antiga; somente a própria pessoa
  // pode usá-lo como nome de exibição até a tela nova de Perfil substituí-la.
  const requestedDisplayName = displayName !== undefined
    ? displayName
    : !isAdmin && legacyPreferredName !== undefined
      ? legacyPreferredName
      : undefined;
  const selfServiceChange = requestedDisplayName !== undefined || email !== undefined || phone !== undefined ||
    username !== undefined || photoUrl !== undefined || contactVisibility !== undefined;
  if (selfServiceChange && !isAdmin && !isSelf) {
    res.status(403).json({ error: "FORBIDDEN", message: "Você só pode editar seus próprios dados de contato e perfil." });
    return;
  }

  const VALID_SPECIALIZATIONS = ["PERFORMER", "CONVIDADO", "PROFESSOR", "TRAINER", "PHYSIOTHERAPIST", "STRENGTH_COACH", "TECHNICAL_OPERATOR", "CHOREOGRAPHER", "OTHER"];
  if (specialization !== undefined && specialization !== null && !VALID_SPECIALIZATIONS.includes(specialization)) {
    res.status(400).json({ error: "BAD_REQUEST", message: `specialization inválida. Valores aceitos: ${VALID_SPECIALIZATIONS.join(", ")}` });
    return;
  }

  try {
    const user = await db.query.usersTable.findFirst({
      where: and(eq(usersTable.id, id), eq(usersTable.organizationId, req.user!.organizationId)),
    });
    if (!user) {
      res.status(404).json({ error: "NOT_FOUND", message: "Usuário não encontrado" });
      return;
    }

    const isDisablingPerson = personStatus === "LEFT" || personStatus === "ARCHIVED";
    const personReason = isDisablingPerson
      ? requireReason(res, reason, "desligar pessoa")
      : normalizeReason(reason);
    if (isDisablingPerson && !personReason) return;

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    const requestedFormalName = fullName ?? legacyName;
    if (requestedFormalName !== undefined) {
      if (typeof requestedFormalName !== "string" || !requestedFormalName.trim()) {
        res.status(400).json({ error: "BAD_REQUEST", message: "O nome completo não pode ficar vazio." });
        return;
      }
      updates.fullName = requestedFormalName.trim();
    }
    if (requestedDisplayName !== undefined) {
      if (typeof requestedDisplayName !== "string" || !requestedDisplayName.trim()) {
        res.status(400).json({ error: "BAD_REQUEST", message: "O nome de exibição não pode ficar vazio." });
        return;
      }
      updates.name = requestedDisplayName.trim();
    }
    if (email?.trim()) {
      const normalizedEmail = (email as string).toLowerCase().trim();
      const existing = await db.query.usersTable.findFirst({ where: eq(usersTable.email, normalizedEmail) });
      if (existing && existing.id !== id) {
        res.status(409).json({ error: "CONFLICT", message: "E-mail já cadastrado" });
        return;
      }
      updates.email = normalizedEmail;
    }
    if (phone !== undefined) updates.phone = phone?.trim() || null;
    if (photoUrl !== undefined) updates.photoUrl = photoUrl?.trim() || null;
    if (contactVisibility !== undefined) {
      updates.contactVisibility = {
        email: contactVisibility?.email !== false,
        phone: contactVisibility?.phone !== false,
      };
    }
    if (username !== undefined) {
      const result = validateAndNormalizeUsername(username);
      if (!result.ok) {
        res.status(400).json({ error: "BAD_REQUEST", message: result.message });
        return;
      }
      // Username é único globalmente (é usado como login).
      const existing = await db.query.usersTable.findFirst({ where: eq(usersTable.username, result.username) });
      if (existing && existing.id !== id) {
        res.status(409).json({ error: "CONFLICT", message: "Este nome de usuário já está em uso." });
        return;
      }
      updates.username = result.username;
    }
    if (specialization !== undefined) {
      updates.specialization = specialization ?? null;
    }
    if (birthDate !== undefined) {
      updates.birthDate = (birthDate as string | null) || null;
    }
    if (entryDate !== undefined) updates.entryDate = (entryDate as string | null) || null;
    if (professionalProfile !== undefined) updates.professionalProfile = professionalProfile?.trim() || null;
    if (primaryFunction !== undefined) updates.primaryFunction = primaryFunction?.trim() || null;
    if (adminNotes !== undefined) updates.adminNotes = adminNotes?.trim() || null;
    if (personStatus !== undefined) {
      if (!["ACTIVE", "ON_LEAVE", "LEFT", "ARCHIVED"].includes(personStatus)) {
        res.status(400).json({ error: "BAD_REQUEST", message: "Situação da pessoa inválida" });
        return;
      }
      updates.personStatus = personStatus;
      updates.archivedAt = personStatus === "ARCHIVED" ? new Date() : null;
      updates.archivedBy = personStatus === "ARCHIVED" ? req.user!.sub : null;
    }
    // visitUntil só é válido para CONVIDADO — usar a especialização efectiva (nova ou atual).
    // Se a especialização resultante não for CONVIDADO, forçar null independentemente do body.
    const effectiveSpecialization = specialization !== undefined ? specialization : user.specialization;
    if (visitUntil !== undefined || specialization !== undefined) {
      if (effectiveSpecialization === "CONVIDADO") {
        if (visitUntil !== undefined) updates.visitUntil = (visitUntil as string | null) || null;
      } else {
        updates.visitUntil = null; // limpar sempre que a especialização não for CONVIDADO
      }
    }

    const [updated] = await db.transaction(async (tx) => {
      const [row] = await tx.update(usersTable).set(updates as any)
        .where(eq(usersTable.id, id)).returning();
      if (!row) throw new Error("Usuário não encontrado");
      if ((personStatus === "LEFT" || personStatus === "ARCHIVED")) {
        await tx.update(usersTable).set({ status: "INACTIVE", updatedAt: new Date() }).where(eq(usersTable.id, id));
        await tx.update(refreshTokensTable).set({ revokedAt: new Date() })
          .where(and(eq(refreshTokensTable.userId, id), isNull(refreshTokensTable.revokedAt)));
        row.status = "INACTIVE";
      }
      const displayNameChanged = requestedDisplayName !== undefined && requestedDisplayName.trim() !== user.name;
      await writeHistoryEvent({
        category: "OPERATIONAL_CHANGE", action: displayNameChanged ? "user.display_name_changed" : "user.updated",
        title: displayNameChanged ? "Nome de exibição atualizado" : "Cadastro de pessoa atualizado",
        narrative: displayNameChanged
          ? `O nome de exibição de ${user.fullName} mudou de "${user.name}" para "${row.name}".`
          : `O cadastro de ${row.fullName} foi atualizado.${personReason ? ` Motivo: ${personReason}` : ""}`,
        entityType: "user", entityId: id, actorId: req.user!.sub, orgId: row.organizationId,
        beforeState: user, afterState: row,
        metadata: { reason: personReason, calculatedReflection: personStatus !== undefined ? `Situação da pessoa alterada de ${user.personStatus} para ${personStatus}.` : null },
      }, tx as any);
      return [row] as const;
    });
    res.json({ user: isAdmin ? adminPerson(updated!) : selfProfile(updated!) });
  } catch (err) {
    log.error({ err }, "Error updating user");
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

router.patch("/users/:id/status", requireAuth, requireOrganization, requireRole("ADMIN"), async (req, res) => {
  const log = requestLogger("teams", req.requestId, req.correlationId);
  const id = req.params.id as string;
  const { status, reason } = req.body as { status?: string; reason?: string };
  const VALID = ["ACTIVE", "INACTIVE"] as const;

  if (!status || !VALID.includes(status as (typeof VALID)[number])) {
    res.status(400).json({ error: "BAD_REQUEST", message: `status deve ser: ${VALID.join(", ")}` });
    return;
  }
  if (id === req.user!.sub) {
    res.status(400).json({ error: "BAD_REQUEST", message: "Não é possível alterar o próprio status" });
    return;
  }

  try {
    const user = await db.query.usersTable.findFirst({
      where: and(eq(usersTable.id, id), eq(usersTable.organizationId, req.user!.organizationId)),
    });
    if (!user) {
      res.status(404).json({ error: "NOT_FOUND" });
      return;
    }
    const statusReason = status === "INACTIVE"
      ? requireReason(res, reason, "desligar pessoa")
      : normalizeReason(reason);
    if (status === "INACTIVE" && !statusReason) return;
    if (status === "ACTIVE" && (user.personStatus === "LEFT" || user.personStatus === "ARCHIVED")) {
      res.status(409).json({
        error: "PERSON_NOT_ACTIVE",
        message: "Reative primeiro a situação da pessoa antes de liberar a conta",
      });
      return;
    }

    const [updated] = await db.transaction(async (tx) => {
      const [row] = await tx.update(usersTable)
        .set({ status: status as "ACTIVE" | "INACTIVE", updatedAt: new Date() })
        .where(eq(usersTable.id, id)).returning();
      if (!row) throw new Error("Usuário não encontrado");
      if (status === "INACTIVE") await tx.update(refreshTokensTable).set({ revokedAt: new Date() })
        .where(and(eq(refreshTokensTable.userId, id), isNull(refreshTokensTable.revokedAt)));
      await writeHistoryEvent({
        category: "OPERATIONAL_CHANGE", action: "user.status_changed", title: "Acesso da pessoa alterado",
        narrative: `Acesso da pessoa alterado de ${user.status} para ${status}. Motivo: ${statusReason ?? "não informado"}.`,
        entityType: "user", entityId: id, actorId: req.user!.sub, orgId: user.organizationId,
        beforeState: user, afterState: row,
        metadata: { from: user.status, to: status, reason: statusReason, calculatedReflection: `Acesso da pessoa alterado de ${user.status} para ${status}.` },
      }, tx as any);
      return [row] as const;
    });

    log.info({ userId: id, from: user.status, to: status }, "User status changed");
    res.json({ user: adminPerson(updated!) });
  } catch (err) {
    log.error({ err }, "Error updating user status");
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

router.delete("/users/:id", requireAuth, requireOrganization, requireRole("ADMIN"), async (req, res) => {
  const log = requestLogger("teams", req.requestId, req.correlationId);
  const id = req.params.id as string;
  const reason = requireReason(res, req.body?.reason, "desativar pessoa");
  if (!reason) return;

  if (id === req.user!.sub) {
    res.status(400).json({ error: "BAD_REQUEST", message: "Não é possível excluir o próprio usuário" });
    return;
  }

  try {
    const user = await db.query.usersTable.findFirst({
      where: and(eq(usersTable.id, id), eq(usersTable.organizationId, req.user!.organizationId)),
    });
    if (!user) {
      res.status(404).json({ error: "NOT_FOUND", message: "Usuário não encontrado" });
      return;
    }

    const [updated] = await db.transaction(async (tx) => {
      const [row] = await tx.update(usersTable)
        .set({ status: "INACTIVE", personStatus: "ARCHIVED", archivedAt: new Date(), archivedBy: req.user!.sub, updatedAt: new Date() })
        .where(and(eq(usersTable.id, id), eq(usersTable.status, "ACTIVE")))
        .returning();
      if (!row) throw new Error("Usuário já está desativado");
      await tx.update(refreshTokensTable).set({ revokedAt: new Date() }).where(and(eq(refreshTokensTable.userId, id), isNull(refreshTokensTable.revokedAt)));
      await writeHistoryEvent({
        category: "OPERATIONAL_CHANGE", action: "user.deactivated", title: "Pessoa desativada",
        narrative: `A pessoa ${user.name} foi desativada. Motivo: ${reason}`,
        entityType: "user", entityId: id, actorId: req.user!.sub, orgId: user.organizationId,
        beforeState: user, afterState: row, metadata: { reason },
      }, tx as any);
      return [row] as const;
    });

    log.info({ userId: id }, "User deactivated");
    res.json({ user: adminPerson(updated!), deactivated: true });
  } catch (err) {
    log.error({ err }, "Error deleting user");
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

export default router;
