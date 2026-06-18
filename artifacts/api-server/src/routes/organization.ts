import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  organizationsTable,
  operationsTable,
  operationalGroupsTable,
} from "@workspace/db";
import { requireAuth, requireOrganization } from "../middlewares/auth.js";
import { getUserContext } from "../lib/auth.service.js";
import { requestLogger } from "../lib/logger.js";

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
      operations = await db.query.operationsTable.findMany({
        where: and(
          eq(operationsTable.organizationId, req.user!.organizationId),
          eq(operationsTable.status, "ACTIVE"),
        ),
      });
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
    const role = req.user!.role;
    let groups = await db.query.operationalGroupsTable.findMany();

    if (role === "SUPERVISOR_A" || role === "SUPERVISOR_B") {
      const myGroupIds = req.user!.operationIds;
      groups = groups.filter((g) => myGroupIds.some((id) => id === g.operationId));
    } else if (role === "MEMBER") {
      const myGroupIds = req.user!.operationIds;
      groups = groups.filter((g) => myGroupIds.some((id) => id === g.operationId));
    }

    res.json({ groups });
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
