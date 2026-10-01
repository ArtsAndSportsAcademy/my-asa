import { db } from "@workspace/db";
import { securityAuditLogTable } from "@workspace/db";
import type { SecurityAuditAction } from "@workspace/shared";
import { domainLogger } from "./logger.js";

const log = domainLogger("audit");

interface AuditParams {
  actorId?: string | null;
  action: SecurityAuditAction;
  targetResource?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

export type AuditExecutor = Pick<typeof db, "insert">;

async function insertAudit(params: AuditParams, executor: AuditExecutor): Promise<void> {
  await executor.insert(securityAuditLogTable).values({
    actorId: params.actorId ?? null,
    action: params.action,
    targetResource: params.targetResource,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    metadata: params.metadata ? JSON.stringify(params.metadata) : undefined,
  });
}

export async function recordAudit(params: AuditParams): Promise<void> {
  try {
    await insertAudit(params, db);
  } catch (err) {
    log.error({ err, action: params.action }, "Failed to write security audit log");
  }
}

/**
 * Variante para alterações que precisam falhar junto com a transação de
 * negócio. Mantemos recordAudit para eventos de autenticação não críticos;
 * mutações operacionais devem usar esta função dentro do mesmo tx.
 */
export async function recordAuditStrict(
  params: AuditParams,
  executor: AuditExecutor = db,
): Promise<void> {
  await insertAudit(params, executor);
}
