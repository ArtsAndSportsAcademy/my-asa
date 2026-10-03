import { Router, type IRouter } from "express";
import {
  loginUser,
  refreshSession,
  logoutUser,
  getMe,
  AuthError,
} from "../lib/auth.service.js";
import { requireAuth } from "../middlewares/auth.js";
import { hashToken } from "../lib/jwt.service.js";
import { requestLogger } from "../lib/logger.js";
import { and, eq, gt } from "drizzle-orm";
import { db, historyEventsTable, userNotificationsTable, userRolesTable, usersTable } from "@workspace/db";
import { writeHistoryEvent } from "../lib/history-helper.js";

const router: IRouter = Router();

// Desenho 01 · "Esqueci minha senha": o My ASA não usa e-mail; quem redefine é a Administração.
// A resposta é sempre a mesma (não revela se o usuário existe) e a Administração recebe
// no máximo um aviso a cada 30 minutos por pessoa. O pedido entra no Registro.
const RESPOSTA_ESQUECI = { ok: true, message: "Pronto. Se esse usuário existir, a Administração foi avisada e vai te passar uma senha provisória." };
router.post("/esqueci-senha", async (req, res) => {
  const log = requestLogger("identity", req.requestId, req.correlationId);
  const username = String((req.body as { username?: unknown })?.username ?? "").trim().toLowerCase();
  if (!username || username.length > 120) { res.json(RESPOSTA_ESQUECI); return; }
  try {
    await db.transaction(async (tx) => {
      // Serializa pedidos da mesma conta: duas requisições simultâneas não podem
      // passar juntas pela janela de 30 minutos e duplicar avisos no Registro.
      const [user] = await tx.select().from(usersTable).where(eq(usersTable.username, username)).for("update").limit(1);
      if (user?.organizationId && user.status === "ACTIVE") {
        const [recente] = await tx.select({ id: historyEventsTable.id }).from(historyEventsTable)
          .where(and(eq(historyEventsTable.entityId, user.id), eq(historyEventsTable.action, "user.password_reset_requested"), gt(historyEventsTable.createdAt, new Date(Date.now() - 30 * 60_000)))).limit(1);
        if (!recente) {
          const admins = await tx.selectDistinct({ id: usersTable.id }).from(usersTable)
            .innerJoin(userRolesTable, eq(userRolesTable.userId, usersTable.id))
            .where(and(eq(usersTable.organizationId, user.organizationId), eq(usersTable.status, "ACTIVE"), eq(userRolesTable.role, "ADMIN"), eq(userRolesTable.active, true)));
          const nome = user.preferredName ?? user.name;
          await writeHistoryEvent({
            category: "OPERATIONAL_CHANGE", action: "user.password_reset_requested", title: "Pedido de senha nova",
            narrative: `${nome} disse que esqueceu a senha e pediu uma nova à Administração.`,
            entityType: "user", entityId: user.id, actorId: user.id, orgId: user.organizationId,
          }, tx as any);
          if (admins.length) await tx.insert(userNotificationsTable).values(admins.map((admin) => ({
            userId: admin.id, type: "user.password_reset_requested", title: "Pedido de senha nova",
            message: `${nome} (${user.username}) esqueceu a senha. Gere uma senha provisória em Pessoas e acessos.`,
            priority: "IMPORTANT" as const, category: "system" as const, entityType: "user", entityId: user.id, actionUrl: "/pessoas",
          })));
        }
      }
    });
  } catch (err) {
    log.error({ err }, "erro ao registrar pedido de senha nova");
  }
  res.json(RESPOSTA_ESQUECI);
});

router.post("/login", async (req, res) => {
  const log = requestLogger("identity", req.requestId, req.correlationId);
  const { username, password } = req.body as { username?: string; password?: string };

  if (!username || !password) {
    res.status(400).json({ error: "Bad Request", message: "username e password são obrigatórios" });
    return;
  }

  try {
    const result = await loginUser(username, password, {
      requestId: req.requestId,
      correlationId: req.correlationId,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });
    res.json(result);
  } catch (err) {
    if (err instanceof AuthError) {
      const status = ["USER_INACTIVE", "GUEST_ACCESS_EXPIRED", "ACCOUNT_UNCONFIGURED"].includes(err.code) ? 403 : 401;
      res.status(status).json({ error: err.code, message: err.message });
      return;
    }
    log.error({ err }, "Unexpected error during login");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/refresh", async (req, res) => {
  const log = requestLogger("identity", req.requestId, req.correlationId);
  const { refreshToken } = req.body as { refreshToken?: string };

  if (!refreshToken) {
    res.status(400).json({ error: "Bad Request", message: "refreshToken é obrigatório" });
    return;
  }

  try {
    const result = await refreshSession(refreshToken, {
      requestId: req.requestId,
      correlationId: req.correlationId,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });
    res.json(result);
  } catch (err) {
    if (err instanceof AuthError) {
      res.status(401).json({ error: err.code, message: err.message });
      return;
    }
    log.error({ err }, "Unexpected error during refresh");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/logout", requireAuth, async (req, res) => {
  const log = requestLogger("identity", req.requestId, req.correlationId);
  const { refreshToken } = req.body as { refreshToken?: string };

  if (!refreshToken) {
    res.status(400).json({ error: "Bad Request", message: "refreshToken é obrigatório" });
    return;
  }

  try {
    await logoutUser(req.user!.sub, hashToken(refreshToken), {
      requestId: req.requestId,
      correlationId: req.correlationId,
    });
    res.status(204).send();
  } catch (err) {
    log.error({ err }, "Unexpected error during logout");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  const log = requestLogger("identity", req.requestId, req.correlationId);
  try {
    const result = await getMe(req.user!.sub);
    res.json(result);
  } catch (err) {
    if (err instanceof AuthError) {
      const status = err.code === "NOT_FOUND" ? 404 : err.code === "ACCOUNT_UNCONFIGURED" ? 403 : 401;
      res.status(status).json({ error: err.code, message: err.message });
      return;
    }
    log.error({ err }, "Unexpected error getting me");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
