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

const router: IRouter = Router();

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
