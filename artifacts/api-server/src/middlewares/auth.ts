import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken, type AccessTokenPayload } from "../lib/jwt.service.js";
import { assertUserCanAuthenticate, AuthError } from "../lib/auth.service.js";
import { hasOperationAccess, loadAuthorizationContext } from "../lib/authorization.service.js";

declare global {
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized", message: "Missing or invalid Authorization header" });
    return;
  }
  const token = authHeader.slice(7);
  try {
    const payload = verifyAccessToken(token);
    const user = await assertUserCanAuthenticate(payload.sub);
    const authorization = await loadAuthorizationContext(payload.sub);
    if (!authorization.primaryRole) {
      res.status(403).json({ error: "ACCOUNT_UNCONFIGURED", message: "Conta sem perfil de acesso ativo" });
      return;
    }
    req.user = {
      ...payload,
      organizationId: user.organizationId,
      role: authorization.primaryRole,
      operationIds: authorization.operationIds,
    };
    next();
  } catch (error) {
    if (error instanceof AuthError) {
      res.status(401).json({ error: error.code, message: error.message });
      return;
    }
    res.status(401).json({ error: "Unauthorized", message: "Token invalid or expired" });
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: "Forbidden",
        message: `Role ${req.user.role} is not authorized for this resource`,
      });
      return;
    }
    next();
  };
}

export function requireOrganization(req: Request, res: Response, next: NextFunction): void {
  if (!req.user?.organizationId) {
    res.status(403).json({ error: "Forbidden", message: "No organization context" });
    return;
  }
  next();
}

export function requireOperationScope(operationIdParam = "operationId") {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const requestedOperationId =
      req.params[operationIdParam] ?? req.query[operationIdParam];
    if (!requestedOperationId) {
      res.status(400).json({ error: "BAD_REQUEST", message: "Operation context is required" });
      return;
    }
    const allowed = await hasOperationAccess({
      userId: req.user.sub,
      organizationId: req.user.organizationId,
      operationId: requestedOperationId as string,
    });
    if (!allowed) {
      res.status(403).json({
        error: "Forbidden",
        message: "Operation not in user scope",
      });
      return;
    }
    next();
  };
}

export function requireSupervisorOperationScope(operationIdParam = "operationId") {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const requestedOperationId = req.params[operationIdParam] ?? req.query[operationIdParam];
    if (!requestedOperationId) {
      res.status(400).json({ error: "BAD_REQUEST", message: "Operation context is required" });
      return;
    }
    const allowed = await hasOperationAccess({
      userId: req.user.sub,
      organizationId: req.user.organizationId,
      operationId: requestedOperationId as string,
      supervisorOnly: true,
    });
    if (!allowed) {
      res.status(403).json({ error: "Forbidden", message: "Supervisor authority not valid for this operation" });
      return;
    }
    next();
  };
}
