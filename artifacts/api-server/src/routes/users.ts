import { Router, type IRouter } from "express";
import { eq, and, inArray, like } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable, userRolesTable, refreshTokensTable } from "@workspace/db";
import { normalizeUsernameBase, resolveUniqueUsername } from "@workspace/db";
import { requireAuth, requireOrganization, requireRole } from "../middlewares/auth.js";
import { recordAudit } from "../lib/audit.service.js";
import { requestLogger } from "../lib/logger.js";

const router: IRouter = Router();

function safeUser(user: typeof usersTable.$inferSelect) {
  const { passwordHash: _pw, ...safe } = user;
  return safe;
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
      res.json({ users: users.map(safeUser) });
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
    res.json({ users: users.map(safeUser) });
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

  if (!name?.trim() || !email?.trim() || !password) {
    res.status(400).json({ error: "BAD_REQUEST", message: "name, email e password são obrigatórios" });
    return;
  }

  const VALID_SPECIALIZATIONS = ["PERFORMER", "PROFESSOR", "TRAINER", "PHYSIOTHERAPIST", "STRENGTH_COACH", "TECHNICAL_OPERATOR", "CHOREOGRAPHER", "OTHER"];
  if (specialization && !VALID_SPECIALIZATIONS.includes(specialization)) {
    res.status(400).json({ error: "BAD_REQUEST", message: `specialization inválida. Valores aceitos: ${VALID_SPECIALIZATIONS.join(", ")}` });
    return;
  }

  try {
    const normalizedEmail = (email as string).toLowerCase().trim();
    const existing = await db.query.usersTable.findFirst({
      where: eq(usersTable.email, normalizedEmail),
    });
    if (existing) {
      res.status(409).json({ error: "CONFLICT", message: "E-mail já cadastrado" });
      return;
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

router.patch("/users/:id", requireAuth, requireOrganization, requireRole("ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"), async (req, res) => {
  const log = requestLogger("teams", req.requestId, req.correlationId);
  const id = req.params.id as string;
  const { name, email, specialization, birthDate } = req.body;

  // Supervisors may only edit a member's specialization (function); full edits remain ADMIN-only.
  if (req.user!.role !== "ADMIN" && (name !== undefined || email !== undefined || birthDate !== undefined)) {
    res.status(403).json({ error: "FORBIDDEN", message: "Supervisores podem editar apenas a especialização do membro." });
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
