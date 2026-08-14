import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  organizationsTable,
  operationsTable,
  operationalGroupsTable,
  userRolesTable,
} from "@workspace/db";
import { requireAuth, requireOrganization } from "../middlewares/auth.js";
import { getUserContext } from "../lib/auth.service.js";
import { requestLogger } from "../lib/logger.js";
import { supervisedOperationIds, groupCoveredOperationIds, serializeGroup } from "./groups.js";

const router: IRouter = Router();

router.get("/organizations/current", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger("organization", req.requestId, req.correlationId);
  try {
    const org = await db.query.organizationsTable.findFirst({
      where: eq(organizationsTable.id, req.user!.organizationId),
    });
    if (!org) {
      res.status(404).json({ error: "NOT_FOUND", message: "Organização não encontrada" });
      return;
    }

    const role = req.user!.role;
    let operations;
    if (role === "ADMIN") {
      operations = await db.query.operationsTable.findMany({
        where: eq(operationsTable.organizationId, req.user!.organizationId),
      });
    } else {
      const { operationIds } = req.user!;
      operations = await db.query.operationsTable.findMany({
        where: and(
          eq(operationsTable.organizationId, req.user!.organizationId),
          eq(operationsTable.status, "ACTIVE"),
        ),
      });
      operations = operations.filter((operation) => operationIds.includes(operation.id));
    }

    const groups = await db.query.operationalGroupsTable.findMany();

    res.json({ organization: org, operations, groups });
  } catch (err) {
    log.error({ err }, "Error getting current organization");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/operations", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger("organization", req.requestId, req.correlationId);
  try {
    const role = req.user!.role;
    let operations;
    if (role === "ADMIN") {
      operations = await db.query.operationsTable.findMany({
        where: eq(operationsTable.organizationId, req.user!.organizationId),
      });
    } else {
      const { operationIds } = req.user!;
      operations = await db.query.operationsTable.findMany({
        where: and(
          eq(operationsTable.organizationId, req.user!.organizationId),
          eq(operationsTable.status, "ACTIVE"),
        ),
      });
      operations = operations.filter((o) => operationIds.includes(o.id));
    }
    res.json({ operations });
  } catch (err) {
    log.error({ err }, "Error getting operations");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/operational-groups", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger("organization", req.requestId, req.correlationId);
  try {
    const { role, sub, organizationId } = req.user!;

    // Considera apenas grupos da organização atual.
    const orgOps = await db.query.operationsTable.findMany({
      where: eq(operationsTable.organizationId, organizationId),
    });
    const orgOpIds = new Set(orgOps.map((o) => o.id));

    let groups = await db.query.operationalGroupsTable.findMany();
    groups = groups.filter((g) =>
      g.organizationId === organizationId || (g.operationId ? orgOpIds.has(g.operationId) : false),
    );

    if (role !== "ADMIN") {
      // Supervisor vê grupos da sua operação + grupos amplos que cobrem sua operação.
      // Membro vê grupos em que participa + grupos amplos que cobrem sua operação.
      const supOps = role === "MEMBER" ? [] : await supervisedOperationIds(sub);
      const myOps = role === "MEMBER" ? req.user!.operationIds : supOps;

      const visible: typeof groups = [];
      for (const g of groups) {
        const covered = await groupCoveredOperationIds(g, organizationId);
        if (covered.some((opId) => myOps.includes(opId))) {
          visible.push(g);
        } else if (role === "MEMBER") {
          const isMember = await db.query.userRolesTable.findFirst({
            where: and(
              eq(userRolesTable.userId, sub),
              eq(userRolesTable.groupId, g.id),
              eq(userRolesTable.active, true),
            ),
          });
          if (isMember) visible.push(g);
        }
      }
      groups = visible;
    }

    const serialized = await Promise.all(groups.map((g) => serializeGroup(g, organizationId)));
    res.json({ groups: serialized });
  } catch (err) {
    log.error({ err }, "Error getting operational groups");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/users/me/context", requireAuth, async (req, res) => {
  const log = requestLogger("organization", req.requestId, req.correlationId);
  try {
    const context = await getUserContext(req.user!.sub);
    res.json(context);
  } catch (err) {
    log.error({ err }, "Error getting user context");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
