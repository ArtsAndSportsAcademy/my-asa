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

export async function recordAudit(params: AuditParams): Promise<void> {
  try {
    await db.insert(securityAuditLogTable).values({
      actorId: params.actorId ?? null,
      action: params.action,
      targetResource: params.targetResource,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      metadata: params.metadata ? JSON.stringify(params.metadata) : undefined,
    });
  } catch (err) {
    log.error({ err, action: params.action }, "Failed to write security audit log");
  }
}
