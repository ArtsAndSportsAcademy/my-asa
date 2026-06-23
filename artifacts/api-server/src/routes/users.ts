import { Router, type IRouter } from "express";
import { eq, and, inArray, like } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable, userRolesTable, refreshTokensTable } from "@workspace/db";
import { normalizeUsernameBase, resolveUniqueUsername, validateAndNormalizeUsername } from "@workspace/db";
import { requireAuth, requireOrganization, requireRole } from "../middlewares/auth.js";
import { recordAudit } from "../lib/audit.service.js";
import { requestLogger } from "../lib/logger.js";

const router: IRouter = Router();

function safeUser(user: typeof usersTable.$inferSelect) {
  const { passwordHash: _pw, ...safe } = user;
  return safe;
}

/**
 * Anexa a cada usuário a lista de operações (operationIds) onde tem papel ATIVO.
 * Permite ao frontend escopar listagens por operação (ex.: montar a escala de uma
 * operação sem mostrar membros de outra operação da mesma organização).
 */
async function attachOperationIds(users: (typeof usersTable.$inferSelect)[]) {
  const ids = users.map((u) => u.id);
  if (ids.length === 0) return [];
  const roles = await db.query.userRolesTable.findMany({
    where: and(eq(userRolesTable.active, true), inArray(userRolesTable.userId, ids)),
  });
  const opsByUser = new Map<string, Set<string>>();
  const supByUser = new Map<string, Set<string>>();
  const adminUsers = new Set<string>();
  for (const r of roles) {
    if (r.role === "ADMIN") adminUsers.add(r.userId);
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
  // `isAdmin` permite ao frontend excluir administradores das escalas/folgas
  // (não fazem parte do elenco escalável), sem precisar buscar papéis por usuário.
  return users.map((u) => ({
    ...safeUser(u),
    operationIds: [...(opsByUser.get(u.id) ?? [])],
    supervisorOperationIds: [...(supByUser.get(u.id) ?? [])],
    isAdmin: adminUsers.has(u.id),
  }));
}

router.get("/users", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger("teams", req.requestId, req.correlationId);
  const { role, sub, organizationId } = req.user!;

  if (role === "MEMBER") {
    res.status(403).json({ error: "FORBIDDEN", message: "Membros não podem listar usuários" });
    return;
  }

  try {
    if (role === "ADMIN") {
      const users = await db.query.usersTable.findMany({
        where: eq(usersTable.organizationId, organizationId),
      });
      res.json({ users: await attachOperationIds(users) });
      return;
    }

    const myRoles = await db.query.userRolesTable.findMany({
      where: and(eq(userRolesTable.userId, sub), eq(userRolesTable.active, true)),
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
    res.json({ users: await attachOperationIds(users) });
  } catch (err) {
    log.error({ err }, "Error listing users");
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

router.get("/users/:id", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger("teams", req.requestId, req.correlationId);
  const { role, sub, organizationId } = req.user!;
  const id = req.params.id as string;

  if (role === "MEMBER" && id !== sub) {
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
    res.json({ user: safeUser(user) });
  } catch (err) {
    log.error({ err }, "Error getting user");
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

router.post("/users", requireAuth, requireOrganization, requireRole("ADMIN"), async (req, res) => {
  const log = requestLogger("teams", req.requestId, req.correlationId);
  const { name, email, password, specialization, birthDate } = req.body;

  if (!name?.trim() || !password) {
    res.status(400).json({ error: "BAD_REQUEST", message: "name e password são obrigatórios" });
    return;
  }

  const VALID_SPECIALIZATIONS = ["PERFORMER", "PROFESSOR", "TRAINER", "PHYSIOTHERAPIST", "STRENGTH_COACH", "TECHNICAL_OPERATOR", "CHOREOGRAPHER", "OTHER"];
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

    const usernameBase = normalizeUsernameBase(name as string);
    const conflicting = await db.query.usersTable.findMany({
      columns: { username: true },
      where: like(usersTable.username, `${usernameBase}%`),
    });
    const taken = new Set(
      conflicting.map((u) => u.username).filter((u): u is string => !!u),
    );
    const username = resolveUniqueUsername(usernameBase, taken);

    const passwordHash = await bcrypt.hash(password as string, 12);
    const [newUser] = await db
      .insert(usersTable)
      .values({
        organizationId: req.user!.organizationId,
        name: (name as string).trim(),
        email: normalizedEmail,
        username,
        passwordHash,
        mustChangePassword: true,
        status: "ACTIVE",
        specialization: specialization ?? null,
        birthDate: (birthDate as string | undefined) ?? null,
      })
      .returning();

    await recordAudit({
      actorId: req.user!.sub,
      action: "USER_CREATED",
      targetResource: `user:${newUser!.id}`,
      metadata: { email: normalizedEmail },
    });

    log.info({ userId: newUser!.id }, "User created");
    res.status(201).json({ user: safeUser(newUser!) });
  } catch (err) {
    log.error({ err }, "Error creating user");
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

router.post("/users/me/password", requireAuth, async (req, res) => {
  const log = requestLogger("teams", req.requestId, req.correlationId);
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: "BAD_REQUEST", message: "currentPassword e newPassword são obrigatórios" });
    return;
  }
  if ((newPassword as string).length < 6) {
    res.status(400).json({ error: "BAD_REQUEST", message: "A nova senha deve ter ao menos 6 caracteres" });
    return;
  }

  try {
    const me = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, req.user!.sub),
    });
    if (!me || !me.passwordHash) {
      res.status(404).json({ error: "NOT_FOUND", message: "Usuário não encontrado" });
      return;
    }

    const valid = await bcrypt.compare(currentPassword as string, me.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "INVALID_CREDENTIALS", message: "Senha atual incorreta" });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword as string, 12);
    await db
      .update(usersTable)
      .set({ passwordHash, mustChangePassword: false, updatedAt: new Date() })
      .where(eq(usersTable.id, me.id));

    await recordAudit({
      actorId: me.id,
      action: "USER_UPDATED",
      targetResource: `user:${me.id}`,
      metadata: { change: "password" },
    });

    log.info({ userId: me.id }, "Password changed");
    res.json({ ok: true });
  } catch (err) {
    log.error({ err }, "Error changing password");
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

router.patch("/users/:id", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger("teams", req.requestId, req.correlationId);
  const id = req.params.id as string;
  const { name, email, username, specialization, birthDate } = req.body;

  const role = req.user!.role;
  const isAdmin = role === "ADMIN";
  const isSupervisor = role === "SUPERVISOR_A" || role === "SUPERVISOR_B";
  const isSelf = id === req.user!.sub;

  // O nome de usuário pode ser editado pelo próprio usuário ou por um admin.
  if (username !== undefined && !isAdmin && !isSelf) {
    res.status(403).json({ error: "FORBIDDEN", message: "Você só pode alterar o seu próprio nome de usuário." });
    return;
  }

  // Nome, e-mail e data de nascimento permanecem exclusivos do admin.
  if ((name !== undefined || email !== undefined || birthDate !== undefined) && !isAdmin) {
    res.status(403).json({ error: "FORBIDDEN", message: "Apenas administradores podem editar nome, e-mail ou data de nascimento." });
    return;
  }

  // Especialização (função) pode ser editada por admin ou supervisor.
  if (specialization !== undefined && !isAdmin && !isSupervisor) {
    res.status(403).json({ error: "FORBIDDEN", message: "Você não tem permissão para editar a especialização." });
    return;
  }

  // Membros comuns só podem editar o próprio perfil (nome de usuário).
  if (!isAdmin && !isSupervisor && !isSelf) {
    res.status(403).json({ error: "FORBIDDEN", message: "Você não tem permissão para editar este usuário." });
    return;
  }

  const VALID_SPECIALIZATIONS = ["PERFORMER", "PROFESSOR", "TRAINER", "PHYSIOTHERAPIST", "STRENGTH_COACH", "TECHNICAL_OPERATOR", "CHOREOGRAPHER", "OTHER"];
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

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (name?.trim()) updates.name = (name as string).trim();
    if (email?.trim()) {
      const normalizedEmail = (email as string).toLowerCase().trim();
      const existing = await db.query.usersTable.findFirst({ where: eq(usersTable.email, normalizedEmail) });
      if (existing && existing.id !== id) {
        res.status(409).json({ error: "CONFLICT", message: "E-mail já cadastrado" });
        return;
      }
      updates.email = normalizedEmail;
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

    const [updated] = await db
      .update(usersTable)
      .set(updates as any)
      .where(eq(usersTable.id, id))
      .returning();

    await recordAudit({ actorId: req.user!.sub, action: "USER_UPDATED", targetResource: `user:${id}` });
    res.json({ user: safeUser(updated!) });
  } catch (err) {
    log.error({ err }, "Error updating user");
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

router.patch("/users/:id/status", requireAuth, requireOrganization, requireRole("ADMIN"), async (req, res) => {
  const log = requestLogger("teams", req.requestId, req.correlationId);
  const id = req.params.id as string;
  const { status } = req.body;
  const VALID = ["ACTIVE", "INACTIVE"] as const;

  if (!VALID.includes(status)) {
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

    const [updated] = await db
      .update(usersTable)
      .set({ status: status as "ACTIVE" | "INACTIVE", updatedAt: new Date() })
      .where(eq(usersTable.id, id))
      .returning();

    await recordAudit({
      actorId: req.user!.sub,
      action: "USER_STATUS_CHANGED",
      targetResource: `user:${id}`,
      metadata: { from: user.status, to: status },
    });

    log.info({ userId: id, from: user.status, to: status }, "User status changed");
    res.json({ user: safeUser(updated!) });
  } catch (err) {
    log.error({ err }, "Error updating user status");
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

router.delete("/users/:id", requireAuth, requireOrganization, requireRole("ADMIN"), async (req, res) => {
  const log = requestLogger("teams", req.requestId, req.correlationId);
  const id = req.params.id as string;

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

    try {
      await db.transaction(async (tx) => {
        await tx.delete(userRolesTable).where(eq(userRolesTable.userId, id));
        await tx.delete(refreshTokensTable).where(eq(refreshTokensTable.userId, id));
        await tx.delete(usersTable).where(eq(usersTable.id, id));
      });
    } catch (err) {
      const code = (err as { code?: string })?.code ?? (err as { cause?: { code?: string } })?.cause?.code;
      if (code === "23503") {
        res.status(409).json({
          error: "CONFLICT",
          message:
            "Não é possível excluir: este usuário possui dados vinculados (tarefas, escalas, registros, etc.). Use 'Desativar' para removê-lo sem apagar o histórico.",
        });
        return;
      }
      throw err;
    }

    try {
      await recordAudit({
        actorId: req.user!.sub,
        action: "USER_DELETED",
        targetResource: `user:${id}`,
        metadata: { email: user.email, name: user.name },
      });
    } catch (auditErr) {
      log.warn({ err: auditErr, userId: id }, "Failed to record USER_DELETED audit (user already deleted)");
    }

    log.info({ userId: id }, "User deleted");
    res.status(204).send();
  } catch (err) {
    log.error({ err }, "Error deleting user");
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

export default router;
