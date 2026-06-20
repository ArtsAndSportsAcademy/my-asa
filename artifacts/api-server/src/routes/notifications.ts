import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { requireAuth, requireOrganization } from "../middlewares/auth.js";
import { requestLogger } from "../lib/logger.js";
import { LOG_DOMAIN } from "@workspace/shared";
import {
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  type NotificationCategory,
} from "../services/notificationService.js";
import { registerDeviceToken, removeDeviceToken } from "../services/pushService.js";

const router: IRouter = Router();

const MANAGER_ROLES = ["ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"];

// ─── GET /notifications — lista com filtros e paginação ───────────────────────
// Members: somente as próprias notificações (scoped to organizationId).
// Supervisores/Admins: podem passar ?userId= para ver notificações de um membro
// da mesma organização.

router.get("/notifications", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  const log = requestLogger(LOG_DOMAIN.NOTIFICATIONS, req.requestId, req.correlationId);
  const user = req.user!;

  const {
    category,
    unreadOnly,
    userId: queryUserId,
    limit: limitStr,
    offset: offsetStr,
  } = req.query as Record<string, string | undefined>;

  // Only ADMIN can query another user's notifications via ?userId=.
  // Supervisors can only view their own notifications to avoid IDOR risk
  // (team-scoped cross-user access is a separate, future capability).
  let targetUserId = user.sub;
  if (queryUserId && queryUserId !== user.sub) {
    if (user.role !== "ADMIN") {
      res.status(403).json({ error: "Forbidden", message: "Apenas admins podem consultar notificações de outros usuários" });
      return;
    }
    // Validate target user belongs to same organization
    const [targetUser] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(and(eq(usersTable.id, queryUserId), eq(usersTable.organizationId, user.organizationId!)))
      .limit(1);
    if (!targetUser) {
      res.status(403).json({ error: "Forbidden", message: "Usuário não encontrado na sua organização" });
      return;
    }
    targetUserId = queryUserId;
  }

  const limit = Math.min(parseInt(limitStr ?? "50", 10) || 50, 100);
  const offset = parseInt(offsetStr ?? "0", 10) || 0;
  const unread = unreadOnly === "true";

  try {
    const result = await getUserNotifications({
      userId: targetUserId,
      category: category as NotificationCategory | undefined,
      unreadOnly: unread,
      limit,
      offset,
    });

    res.json({ notifications: result.notifications, total: result.total, limit, offset });
  } catch (err) {
    log.error({ err }, "erro ao listar notificações");
    res.status(500).json({ error: "Erro interno" });
  }
});

// ─── GET /notifications/unread-count ─────────────────────────────────────────

router.get("/notifications/unread-count", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  const log = requestLogger(LOG_DOMAIN.NOTIFICATIONS, req.requestId, req.correlationId);
  const user = req.user!;

  try {
    const count = await getUnreadCount(user.sub);
    res.json({ count });
  } catch (err) {
    log.error({ err }, "erro ao contar notificações não lidas");
    res.status(500).json({ error: "Erro interno" });
  }
});

// ─── PATCH /notifications/:id/read — marcar uma como lida ────────────────────

router.patch("/notifications/:id/read", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  const log = requestLogger(LOG_DOMAIN.NOTIFICATIONS, req.requestId, req.correlationId);
  const user = req.user!;
  const id = req.params["id"] as string;

  try {
    const notification = await markAsRead(id, user.sub);
    if (!notification) {
      res.status(404).json({ error: "Notificação não encontrada ou já lida" });
      return;
    }
    res.json({ notification });
  } catch (err) {
    log.error({ err, notificationId: id }, "erro ao marcar notificação como lida");
    res.status(500).json({ error: "Erro interno" });
  }
});

// ─── PATCH /notifications/read-all — marcar todas como lidas ─────────────────

router.patch("/notifications/read-all", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  const log = requestLogger(LOG_DOMAIN.NOTIFICATIONS, req.requestId, req.correlationId);
  const user = req.user!;

  try {
    const count = await markAllAsRead(user.sub);
    res.json({ marked: count });
  } catch (err) {
    log.error({ err }, "erro ao marcar todas as notificações como lidas");
    res.status(500).json({ error: "Erro interno" });
  }
});

// ─── POST /notifications/device-token — registra token de push do dispositivo ──
// Chamado pelo app após o login. Faz upsert por token (único). Não exige
// organização — qualquer usuário autenticado pode registrar seu dispositivo.

router.post("/notifications/device-token", requireAuth, async (req, res): Promise<void> => {
  const log = requestLogger(LOG_DOMAIN.NOTIFICATIONS, req.requestId, req.correlationId);
  const user = req.user!;
  const { token, platform } = req.body as { token?: string; platform?: string };

  if (!token || typeof token !== "string") {
    res.status(400).json({ error: "token é obrigatório" });
    return;
  }

  const normalizedPlatform =
    platform === "IOS" || platform === "ANDROID" ? platform : null;

  try {
    const row = await registerDeviceToken({
      userId: user.sub,
      token,
      platform: normalizedPlatform,
    });
    res.status(201).json({ id: row.id, registered: true });
  } catch (err) {
    log.error({ err }, "erro ao registrar token de dispositivo");
    res.status(500).json({ error: "Erro interno" });
  }
});

// ─── DELETE /notifications/device-token — remove token (logout) ───────────────

router.delete("/notifications/device-token", requireAuth, async (req, res): Promise<void> => {
  const log = requestLogger(LOG_DOMAIN.NOTIFICATIONS, req.requestId, req.correlationId);
  const user = req.user!;
  const { token } = req.body as { token?: string };

  if (!token || typeof token !== "string") {
    res.status(400).json({ error: "token é obrigatório" });
    return;
  }

  try {
    await removeDeviceToken(user.sub, token);
    res.json({ removed: true });
  } catch (err) {
    log.error({ err }, "erro ao remover token de dispositivo");
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
