import { pgTable, text, uuid, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./identity.js";

export const securityAuditActionEnum = pgEnum("security_audit_action", [
  "LOGIN",
  "LOGOUT",
  "PERMISSION_DENIED",
  "TOKEN_EXPIRED",
  "INVALID_ACCESS_ATTEMPT",
  "TOKEN_REFRESHED",
  "DEVICE_REGISTERED",
  "USER_CREATED",
  "USER_UPDATED",
  "USER_STATUS_CHANGED",
  "USER_DELETED",
  "ROLE_ASSIGNED",
  "ROLE_REMOVED",
  "OPERATION_CREATED",
  "OPERATION_UPDATED",
  "GROUP_CREATED",
  "GROUP_UPDATED",
  "MEMBER_ADDED",
  "MEMBER_REMOVED",
]);

export const securityAuditLogTable = pgTable("security_audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorId: uuid("actor_id").references(() => usersTable.id),
  action: securityAuditActionEnum("action").notNull(),
  targetResource: text("target_resource"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSecurityAuditLogSchema = createInsertSchema(securityAuditLogTable).omit({ id: true, createdAt: true });
export type InsertSecurityAuditLog = z.infer<typeof insertSecurityAuditLogSchema>;
export type SecurityAuditLog = typeof securityAuditLogTable.$inferSelect;
