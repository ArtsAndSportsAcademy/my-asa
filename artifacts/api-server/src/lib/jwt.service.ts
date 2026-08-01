import jwt from "jsonwebtoken";
import { createHash, randomBytes } from "node:crypto";

// In production, JWT secrets must be set explicitly — weak fallbacks are never
// used. In development (NODE_ENV !== "production"), convenient defaults allow
// running without env config, but tokens signed with those defaults are
// publicly known and must never reach a real user.
function requireSecret(envVar: string, devFallback: string): string {
  const value = process.env[envVar];
  if (value) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      `${envVar} must be set in production. ` +
      "Generate a strong random value with: node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\"",
    );
  }
  return devFallback;
}

const ACCESS_SECRET = requireSecret("JWT_ACCESS_SECRET", "myasa-dev-access-secret");
const REFRESH_SECRET = requireSecret("JWT_REFRESH_SECRET", "myasa-dev-refresh-secret");
const ACCESS_TTL_SECONDS = 15 * 60;
const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;

export interface AccessTokenPayload {
  sub: string;
  jti: string;
  type: "access";
  organizationId: string;
  role: string;
  operationIds: string[];
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
  type: "refresh";
}

export function signAccessToken(payload: Omit<AccessTokenPayload, "type">): string {
  return jwt.sign({ ...payload, type: "access" }, ACCESS_SECRET, {
    expiresIn: ACCESS_TTL_SECONDS,
  });
}

export function signRefreshToken(userId: string): { token: string; jti: string; expiresAt: Date } {
  const jti = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + REFRESH_TTL_SECONDS * 1000);
  const token = jwt.sign({ sub: userId, jti, type: "refresh" }, REFRESH_SECRET, {
    expiresIn: REFRESH_TTL_SECONDS,
  });
  return { token, jti, expiresAt };
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const payload = jwt.verify(token, ACCESS_SECRET) as AccessTokenPayload;
  if (payload.type !== "access") throw new Error("invalid token type");
  return payload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const payload = jwt.verify(token, REFRESH_SECRET) as RefreshTokenPayload;
  if (payload.type !== "refresh") throw new Error("invalid token type");
  return payload;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function getRefreshTTLSeconds(): number {
  return REFRESH_TTL_SECONDS;
}
