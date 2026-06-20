import bcrypt from "bcryptjs";
import { eq, and, isNull, gt } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  usersTable,
  userRolesTable,
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

export interface AuthContext {
  requestId: string;
  correlationId: string;
  ipAddress?: string;
  userAgent?: string;
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

  if (user.status !== "ACTIVE") {
    log.warn({ userId: user.id }, "Login failed: user inactive");
    throw new AuthError("USER_INACTIVE", "Usuário inativo");
  }

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

  const { roles, operationIds } = await getUserRolesAndOperations(user.id);
  const primaryRole = getPrimaryRole(roles);

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

  const safeUser = { ...user, passwordHash: undefined };
  return { user: safeUser, accessToken, refreshToken, roles };
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

  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.id, payload.sub),
  });

  if (!user || user.status !== "ACTIVE") {
    throw new AuthError("USER_INACTIVE", "Usuário inativo");
  }

  const { roles, operationIds } = await getUserRolesAndOperations(user.id);
  const primaryRole = getPrimaryRole(roles);

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
  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.id, userId),
  });
  if (!user) throw new AuthError("NOT_FOUND", "Usuário não encontrado");

  const { roles, operationIds } = await getUserRolesAndOperations(userId);
  const safeUser = { ...user, passwordHash: undefined };
  return { user: safeUser, roles, operationIds };
}

export async function getUserContext(userId: string) {
  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.id, userId),
  });
  if (!user) throw new AuthError("NOT_FOUND", "Usuário não encontrado");

  const [org, roles, operations, groups] = await Promise.all([
    db.query.organizationsTable.findFirst({
      where: eq(organizationsTable.id, user.organizationId),
    }),
    db.query.userRolesTable.findMany({
      where: and(eq(userRolesTable.userId, userId), eq(userRolesTable.active, true)),
    }),
    db.query.operationsTable.findMany({
      where: and(
        eq(operationsTable.organizationId, user.organizationId),
        eq(operationsTable.status, "ACTIVE"),
      ),
    }),
    db.query.operationalGroupsTable.findMany(),
  ]);

  const primaryRole = getPrimaryRole(roles);

  let filteredOperations = operations;
  let filteredGroups = groups;

  if (primaryRole === "SUPERVISOR_A" || primaryRole === "SUPERVISOR_B") {
    const myOperationIds = roles.map((r) => r.operationId);
    filteredOperations = operations.filter((o) => myOperationIds.includes(o.id));
    const myGroupIds = roles.map((r) => r.groupId).filter(Boolean) as string[];
    filteredGroups = groups.filter((g) => myGroupIds.includes(g.id));
  } else if (primaryRole === "MEMBER") {
    const myOperationIds = roles.map((r) => r.operationId);
    filteredOperations = operations.filter((o) => myOperationIds.includes(o.id));
    const myGroupIds = roles.map((r) => r.groupId).filter(Boolean) as string[];
    filteredGroups = groups.filter((g) => myGroupIds.includes(g.id));
  }

  return {
    user: { ...user, passwordHash: undefined },
    roles,
    organization: org,
    operations: filteredOperations,
    groups: filteredGroups,
  };
}

async function getUserRolesAndOperations(userId: string) {
  const roles = await db.query.userRolesTable.findMany({
    where: and(eq(userRolesTable.userId, userId), eq(userRolesTable.active, true)),
  });
  const operationIds = [...new Set(roles.map((r) => r.operationId))];
  return { roles, operationIds };
}

function getPrimaryRole(roles: typeof userRolesTable.$inferSelect[]): string {
  const priority = ["ADMIN", "SUPERVISOR_A", "SUPERVISOR_B", "MEMBER"];
  for (const p of priority) {
    if (roles.some((r) => r.role === p)) return p;
  }
  return "MEMBER";
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
