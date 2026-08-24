import bcrypt from "bcryptjs";
import { eq, and, isNull, gt } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  usersTable,
  operationsTable,
  operationalGroupsTable,
  organizationsTable,
  refreshTokensTable,
} from "@workspace/db";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
} from "./jwt.service.js";
import { recordAudit } from "./audit.service.js";
import { requestLogger } from "./logger.js";
import { loadAuthorizationContext } from "./authorization.service.js";
import { selfProfile } from "./person-projection.js";

export interface AuthContext {
  requestId: string;
  correlationId: string;
  ipAddress?: string;
  userAgent?: string;
}

function isGuestExpired(user: typeof usersTable.$inferSelect): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return user.specialization === "CONVIDADO" && !!user.visitUntil && user.visitUntil < today;
}

async function revokeAllRefreshTokens(userId: string): Promise<void> {
  await db.update(refreshTokensTable)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokensTable.userId, userId), isNull(refreshTokensTable.revokedAt)));
}

export async function assertUserCanAuthenticate(userId: string) {
  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, userId) });
  if (!user) throw new AuthError("USER_INACTIVE", "Usuário inativo");

  if (isGuestExpired(user)) {
    await db.update(usersTable)
      .set({ status: "INACTIVE", updatedAt: new Date() })
      .where(eq(usersTable.id, user.id));
    await revokeAllRefreshTokens(user.id);
    throw new AuthError("GUEST_ACCESS_EXPIRED", "O acesso temporário deste convidado expirou");
  }

  if (user.status !== "ACTIVE" || user.personStatus === "LEFT" || user.personStatus === "ARCHIVED") {
    await revokeAllRefreshTokens(user.id);
    throw new AuthError("USER_INACTIVE", "Usuário inativo");
  }
  return user;
}

export async function loginUser(
  username: string,
  password: string,
  ctx: AuthContext,
) {
  const log = requestLogger("identity", ctx.requestId, ctx.correlationId);

  const normalizedUsername = username.toLowerCase().trim();
  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.username, normalizedUsername),
  });

  if (!user || !user.passwordHash) {
    await recordAudit({
      action: "INVALID_ACCESS_ATTEMPT",
      targetResource: `login:${normalizedUsername}`,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { reason: "user_not_found_or_no_password" },
    });
    log.warn({ username: normalizedUsername }, "Login failed: user not found or no password");
    throw new AuthError("INVALID_CREDENTIALS", "Nome de usuário ou senha inválidos");
  }

  await assertUserCanAuthenticate(user.id);

  const passwordValid = await bcrypt.compare(password, user.passwordHash);
  if (!passwordValid) {
    await recordAudit({
      actorId: user.id,
      action: "INVALID_ACCESS_ATTEMPT",
      targetResource: "login",
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { reason: "wrong_password" },
    });
    log.warn({ userId: user.id }, "Login failed: wrong password");
    throw new AuthError("INVALID_CREDENTIALS", "Nome de usuário ou senha inválidos");
  }

  const { roles, operationIds, primaryRole, capabilities } = await loadAuthorizationContext(user.id);
  if (!primaryRole) {
    log.warn({ userId: user.id }, "Login failed: account has no active access profile");
    throw new AuthError("ACCOUNT_UNCONFIGURED", "Conta sem perfil de acesso ativo");
  }

  const accessToken = signAccessToken({
    sub: user.id,
    jti: crypto.randomUUID(),
    organizationId: user.organizationId,
    role: primaryRole,
    operationIds,
  });

  const { token: refreshToken, expiresAt } = signRefreshToken(user.id);
  const tokenHash = hashToken(refreshToken);

  await db.insert(refreshTokensTable).values({
    userId: user.id,
    tokenHash,
    expiresAt,
  });

  await recordAudit({
    actorId: user.id,
    action: "LOGIN",
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });

  log.info({ userId: user.id, role: primaryRole }, "Login successful");

  return { user: selfProfile(user), accessToken, refreshToken, roles, capabilities };
}

export async function refreshSession(
  rawRefreshToken: string,
  ctx: AuthContext,
) {
  const log = requestLogger("identity", ctx.requestId, ctx.correlationId);

  let payload;
  try {
    payload = verifyRefreshToken(rawRefreshToken);
  } catch {
    throw new AuthError("INVALID_TOKEN", "Refresh token inválido ou expirado");
  }

  const tokenHash = hashToken(rawRefreshToken);
  const storedToken = await db.query.refreshTokensTable.findFirst({
    where: and(
      eq(refreshTokensTable.tokenHash, tokenHash),
      isNull(refreshTokensTable.revokedAt),
      gt(refreshTokensTable.expiresAt, new Date()),
    ),
  });

  if (!storedToken || storedToken.userId !== payload.sub) {
    await recordAudit({
      actorId: payload.sub,
      action: "INVALID_ACCESS_ATTEMPT",
      targetResource: "refresh",
      ipAddress: ctx.ipAddress,
      metadata: { reason: "token_not_found_or_revoked" },
    });
    throw new AuthError("INVALID_TOKEN", "Refresh token inválido ou expirado");
  }

  await db
    .update(refreshTokensTable)
    .set({ revokedAt: new Date() })
    .where(eq(refreshTokensTable.id, storedToken.id));

  const user = await assertUserCanAuthenticate(payload.sub);

  const { roles, operationIds, primaryRole } = await loadAuthorizationContext(user.id);
  if (!primaryRole) {
    await revokeAllRefreshTokens(user.id);
    throw new AuthError("ACCOUNT_UNCONFIGURED", "Conta sem perfil de acesso ativo");
  }

  const accessToken = signAccessToken({
    sub: user.id,
    jti: crypto.randomUUID(),
    organizationId: user.organizationId,
    role: primaryRole,
    operationIds,
  });

  const { token: newRefreshToken, expiresAt } = signRefreshToken(user.id);
  await db.insert(refreshTokensTable).values({
    userId: user.id,
    tokenHash: hashToken(newRefreshToken),
    expiresAt,
  });

  await recordAudit({ actorId: user.id, action: "TOKEN_REFRESHED" });
  log.info({ userId: user.id }, "Token refreshed");

  return { accessToken, refreshToken: newRefreshToken };
}

export async function logoutUser(userId: string, tokenHash: string, ctx: AuthContext) {
  const log = requestLogger("identity", ctx.requestId, ctx.correlationId);

  await db
    .update(refreshTokensTable)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(refreshTokensTable.userId, userId),
        eq(refreshTokensTable.tokenHash, tokenHash),
      ),
    );

  await recordAudit({ actorId: userId, action: "LOGOUT" });
  log.info({ userId }, "Logout successful");
}

export async function getMe(userId: string) {
  const user = await assertUserCanAuthenticate(userId);

  const { roles, operationIds, primaryRole, capabilities } = await loadAuthorizationContext(userId);
  if (!primaryRole) throw new AuthError("ACCOUNT_UNCONFIGURED", "Conta sem perfil de acesso ativo");
  return { user: selfProfile(user), roles, operationIds, capabilities };
}

export async function getUserContext(userId: string) {
  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.id, userId),
  });
  if (!user) throw new AuthError("NOT_FOUND", "Usuário não encontrado");

  const [org, authorization, operations, groups] = await Promise.all([
    db.query.organizationsTable.findFirst({
      where: eq(organizationsTable.id, user.organizationId),
    }),
    loadAuthorizationContext(userId),
    db.query.operationsTable.findMany({
      where: and(
        eq(operationsTable.organizationId, user.organizationId),
        eq(operationsTable.status, "ACTIVE"),
      ),
    }),
    db.query.operationalGroupsTable.findMany({
      where: eq(operationalGroupsTable.organizationId, user.organizationId),
    }),
  ]);

  const { primaryRole, roles } = authorization;
  if (!primaryRole) throw new AuthError("ACCOUNT_UNCONFIGURED", "Conta sem perfil de acesso ativo");

  let filteredOperations = operations;
  let filteredGroups = groups;

  if (primaryRole === "SUPERVISOR_A" || primaryRole === "SUPERVISOR_B") {
    const myOperationIds = roles.map((r) => r.operationId);
    filteredOperations = operations.filter((o) => myOperationIds.includes(o.id));
    const myGroupIds = roles.map((r) => r.groupId).filter(Boolean) as string[];
    filteredGroups = groups.filter((g) => myGroupIds.includes(g.id));
  } else if (primaryRole === "MEMBER" || primaryRole === "TRAINER") {
    const myOperationIds = roles.map((r) => r.operationId);
    filteredOperations = operations.filter((o) => myOperationIds.includes(o.id));
    const myGroupIds = roles.map((r) => r.groupId).filter(Boolean) as string[];
    filteredGroups = groups.filter((g) => myGroupIds.includes(g.id));
  }

  return {
    user: selfProfile(user),
    roles,
    organization: org,
    operations: filteredOperations,
    groups: filteredGroups,
  };
}

export class AuthError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}
