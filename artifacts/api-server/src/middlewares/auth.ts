import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken, type AccessTokenPayload } from "../lib/jwt.service.js";

declare global {
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized", message: "Missing or invalid Authorization header" });
    return;
  }
  const token = authHeader.slice(7);
  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
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
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const role = req.user.role;
    if (role === "ADMIN") {
      next();
      return;
    }
    const requestedOperationId =
      req.params[operationIdParam] ?? req.query[operationIdParam];
    if (
      requestedOperationId &&
      !req.user.operationIds.includes(requestedOperationId as string)
    ) {
      res.status(403).json({
        error: "Forbidden",
        message: "Operation not in user scope",
      });
      return;
    }
    next();
  };
}
