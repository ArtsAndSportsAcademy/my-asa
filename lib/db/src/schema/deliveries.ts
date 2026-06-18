import { pgTable, text, uuid, timestamp, jsonb, pgEnum, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./identity.js";
import { operationsTable } from "./organization.js";

export const deliveryTypeEnum = pgEnum("delivery_type", ["READING", "VIDEO", "OPERATIONAL_UPDATE", "CHECKLIST"]);
export const deliveryStatusEnum = pgEnum("delivery_status", ["DRAFT", "PUBLISHED", "CANCELLED"]);
export const deliveryAssignmentStatusEnum = pgEnum("delivery_assignment_status", [
  "PUBLISHED", "RECEIVED", "VIEWED", "COMPLETED", "OVERDUE", "EXPIRED",
]);

export const deliveriesTable = pgTable("deliveries", {
  id: uuid("id").primaryKey().defaultRandom(),
  creatorId: uuid("creator_id").notNull().references(() => usersTable.id),
  operationId: uuid("operation_id").notNull().references(() => operationsTable.id),
  type: deliveryTypeEnum("type").notNull(),
  title: text("title").notNull(),
  content: jsonb("content").notNull(),
  dueDate: date("due_date", { mode: "string" }).notNull(),
  maxDueDate: date("max_due_date", { mode: "string" }).notNull(),
  status: deliveryStatusEnum("status").notNull().default("DRAFT"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const deliveryAssignmentsTable = pgTable("delivery_assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  deliveryId: uuid("delivery_id").notNull().references(() => deliveriesTable.id),
  userId: uuid("user_id").notNull().references(() => usersTable.id),
  status: deliveryAssignmentStatusEnum("status").notNull().default("PUBLISHED"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  expiredAt: timestamp("expired_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDeliverySchema = createInsertSchema(deliveriesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDelivery = z.infer<typeof insertDeliverySchema>;
export type Delivery = typeof deliveriesTable.$inferSelect;

export const insertDeliveryAssignmentSchema = createInsertSchema(deliveryAssignmentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDeliveryAssignment = z.infer<typeof insertDeliveryAssignmentSchema>;
export type DeliveryAssignment = typeof deliveryAssignmentsTable.$inferSelect;
