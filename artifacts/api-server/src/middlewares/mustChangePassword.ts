import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { verifyAccessToken } from "../lib/jwt.service.js";

function isAllowed(req: Request): boolean {
  return req.method === "POST" && req.path === "/users/me/password";
}

export async function blockIfMustChangePassword(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (isAllowed(req)) {
    next();
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    // No token: let the per-route requireAuth respond with 401.
    next();
    return;
  }

  // From here a Bearer token is present, so this control fails CLOSED:
  // any failure to verify the token or load the flag denies the request.
  let sub: string;
  try {
    sub = verifyAccessToken(authHeader.slice(7)).sub;
  } catch {
    res.status(401).json({ error: "Unauthorized", message: "Token invalid or expired" });
    return;
  }

  try {
    const me = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, sub),
      columns: { mustChangePassword: true },
    });
    if (me?.mustChangePassword) {
      res.status(403).json({
        error: "MUST_CHANGE_PASSWORD",
        message: "Troque a senha provisória antes de continuar.",
      });
      return;
    }
  } catch {
    res.status(503).json({
      error: "SERVICE_UNAVAILABLE",
      message: "Não foi possível verificar o status da conta. Tente novamente.",
    });
    return;
  }

  next();
}
