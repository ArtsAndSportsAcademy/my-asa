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
  let payload: AccessTokenPayload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    res.status(401).json({ error: "Unauthorized", message: "Token invalid or expired" });
    return;
  }
  try {
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
    // Erro de banco ou de servidor não é "sessão vencida": responder 401 aqui fazia a tela renovar,
    // falhar e mandar a pessoa para o login com a credencial boa (banco lento). 503 não derruba ninguém.
    res.status(503).json({ error: "SERVICE_UNAVAILABLE", message: "Não consegui falar com o banco agora. Tente de novo em instantes." });
  }
}

const PERFIL_POR_EXTENSO: Record<string, string> = {
  ADMIN: "Administração", DIR: "Direção", DIRECTOR: "Direção", SUPERVISOR_A: "Supervisão", SUPERVISOR_B: "Supervisão", MEMBER: "Elenco",
};

/** Frase da recusa por perfil: quem pode fazer e qual é o perfil de quem tentou (nada de código de perfil em inglês). */
export function fraseDeRecusaPorPerfil(permitidos: string[], perfilDeQuemPede: string): string {
  const quem = [...new Set(permitidos.map((r) => PERFIL_POR_EXTENSO[r] ?? r))];
  const lista = quem.length > 1 ? `${quem.slice(0, -1).join(", ")} e ${quem[quem.length - 1]}` : quem[0] ?? "outro perfil";
  return `Esta ação é só de: ${lista}. O seu perfil (${PERFIL_POR_EXTENSO[perfilDeQuemPede] ?? perfilDeQuemPede}) não faz isso.`;
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
        message: fraseDeRecusaPorPerfil(roles, req.user.role),
      });
      return;
    }
    next();
  };
}

export function requireOrganization(req: Request, res: Response, next: NextFunction): void {
  if (!req.user?.organizationId) {
    res.status(403).json({ error: "Forbidden", message: "Sua conta ainda não está ligada a uma casa. Fale com a Administração." });
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
