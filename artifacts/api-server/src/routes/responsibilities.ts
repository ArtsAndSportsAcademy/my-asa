import { Router, type IRouter } from "express";
import { eq, and, inArray, or, isNull, not, desc, asc } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  responsibilitiesTable,
  responsibilityAssignmentsTable,
  usersTable,
  userRolesTable,
  operationsTable,
} from "@workspace/db";
import { requireAuth, requireOrganization } from "../middlewares/auth.js";
import { sendNotification, notifyMany } from "../services/notificationService.js";

const router: IRouter = Router();

const MANAGER_ROLES = ["ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"];

// ─── Helper: build full responsibility detail ──────────────────────────────────

async function buildResponsibilityDetail(id: string) {
  const [resp] = await db
    .select({
      id: responsibilitiesTable.id,
      orgId: responsibilitiesTable.orgId,
      operationId: responsibilitiesTable.operationId,
      title: responsibilitiesTable.title,
      description: responsibilitiesTable.description,
      category: responsibilitiesTable.category,
      active: responsibilitiesTable.active,
      createdAt: responsibilitiesTable.createdAt,
      updatedAt: responsibilitiesTable.updatedAt,
      operationName: operationsTable.name,
    })
    .from(responsibilitiesTable)
    .leftJoin(operationsTable, eq(responsibilitiesTable.operationId, operationsTable.id))
    .where(eq(responsibilitiesTable.id, id));

  if (!resp) return null;

  const assignments = await db
    .select({
      id: responsibilityAssignmentsTable.id,
      responsibilityId: responsibilityAssignmentsTable.responsibilityId,
      memberId: responsibilityAssignmentsTable.memberId,
      role: responsibilityAssignmentsTable.role,
      substituteMemberId: responsibilityAssignmentsTable.substituteMemberId,
      startsAt: responsibilityAssignmentsTable.startsAt,
      endsAt: responsibilityAssignmentsTable.endsAt,
      active: responsibilityAssignmentsTable.active,
      createdAt: responsibilityAssignmentsTable.createdAt,
      memberName: usersTable.name,
    })
    .from(responsibilityAssignmentsTable)
    .innerJoin(usersTable, eq(responsibilityAssignmentsTable.memberId, usersTable.id))
    .where(eq(responsibilityAssignmentsTable.responsibilityId, id))
    .orderBy(asc(responsibilityAssignmentsTable.role));

  // Resolve substitute names
  const subIds = assignments.map((a) => a.substituteMemberId).filter(Boolean) as string[];
  const subNames: Record<string, string> = {};
  if (subIds.length > 0) {
    const subs = await db
      .select({ id: usersTable.id, name: usersTable.name })
      .from(usersTable)
      .where(inArray(usersTable.id, subIds));
    for (const s of subs) subNames[s.id] = s.name;
  }

  return {
    ...resp,
    assignments: assignments.map((a) => ({
      ...a,
      substituteName: a.substituteMemberId ? (subNames[a.substituteMemberId] ?? null) : null,
    })),
  };
}

// ─── GET /responsibilities ────────────────────────────────────────────────────

router.get("/responsibilities", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  try {
    const user = req.user!;
    const { category, operationId, unassigned, memberId } = req.query as Record<string, string>;

    const isManager = MANAGER_ROLES.includes(user.role);

    const conditions = [
      eq(responsibilitiesTable.orgId, user.organizationId),
      eq(responsibilitiesTable.active, true),
    ];
    if (category) conditions.push(eq(responsibilitiesTable.category, category));
    if (operationId) conditions.push(eq(responsibilitiesTable.operationId, operationId));

    const responsibilities = await db
      .select({
        id: responsibilitiesTable.id,
        orgId: responsibilitiesTable.orgId,
        operationId: responsibilitiesTable.operationId,
        title: responsibilitiesTable.title,
        description: responsibilitiesTable.description,
        category: responsibilitiesTable.category,
        active: responsibilitiesTable.active,
        createdAt: responsibilitiesTable.createdAt,
        updatedAt: responsibilitiesTable.updatedAt,
        operationName: operationsTable.name,
      })
      .from(responsibilitiesTable)
      .leftJoin(operationsTable, eq(responsibilitiesTable.operationId, operationsTable.id))
      .where(and(...conditions))
      .orderBy(asc(responsibilitiesTable.category), asc(responsibilitiesTable.title));

    if (responsibilities.length === 0) { res.json({ responsibilities: [] }); return; }

    const respIds = responsibilities.map((r) => r.id);

    // Fetch active assignments for all
    const allAssignments = await db
      .select({
        id: responsibilityAssignmentsTable.id,
        responsibilityId: responsibilityAssignmentsTable.responsibilityId,
        memberId: responsibilityAssignmentsTable.memberId,
        role: responsibilityAssignmentsTable.role,
        substituteMemberId: responsibilityAssignmentsTable.substituteMemberId,
        startsAt: responsibilityAssignmentsTable.startsAt,
        endsAt: responsibilityAssignmentsTable.endsAt,
        active: responsibilityAssignmentsTable.active,
        memberName: usersTable.name,
      })
      .from(responsibilityAssignmentsTable)
      .innerJoin(usersTable, eq(responsibilityAssignmentsTable.memberId, usersTable.id))
      .where(
        and(
          inArray(responsibilityAssignmentsTable.responsibilityId, respIds),
          eq(responsibilityAssignmentsTable.active, true),
        )
      )
      .orderBy(asc(responsibilityAssignmentsTable.role));

    // Group assignments by responsibilityId
    const assignMap = new Map<string, typeof allAssignments>();
    for (const a of allAssignments) {
      const existing = assignMap.get(a.responsibilityId) ?? [];
      existing.push(a);
      assignMap.set(a.responsibilityId, existing);
    }

    let enriched = responsibilities.map((r) => ({
      ...r,
      assignments: assignMap.get(r.id) ?? [],
    }));

    // Filter: unassigned (no active assignments)
    if (unassigned === "true") {
      enriched = enriched.filter((r) => r.assignments.length === 0);
    }

    // Filter: by memberId
    if (memberId) {
      enriched = enriched.filter((r) =>
        r.assignments.some((a) => a.memberId === memberId)
      );
    }

    // MEMBER: only see responsibilities they are assigned to
    if (!isManager) {
      enriched = enriched.filter((r) =>
        r.assignments.some((a) => a.memberId === user.sub)
      );
    }

    res.json({ responsibilities: enriched });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao listar responsabilidades" });
  }
});

// ─── GET /responsibilities/:id ────────────────────────────────────────────────

router.get("/responsibilities/:id", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  try {
    const user = req.user!;
    const id = String(req.params.id);

    const detail = await buildResponsibilityDetail(id);
    if (!detail || detail.orgId !== user.organizationId) {
      res.status(404).json({ error: "Responsabilidade não encontrada" });
      return;
    }

    const isManager = MANAGER_ROLES.includes(user.role);
    if (!isManager) {
      const isAssigned = detail.assignments.some((a) => a.memberId === user.sub && a.active);
      if (!isAssigned) { res.status(403).json({ error: "Acesso não autorizado" }); return; }
    }

    res.json({ responsibility: detail });
  } catch {
    res.status(500).json({ error: "Erro ao buscar responsabilidade" });
  }
});

// ─── POST /responsibilities ───────────────────────────────────────────────────

router.post("/responsibilities", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  try {
    const user = req.user!;
    if (user.role !== "ADMIN") { res.status(403).json({ error: "Somente ADMIN pode criar responsabilidades" }); return; }

    const { title, description, category, operationId } = req.body as {
      title: string;
      description?: string;
      category?: string;
      operationId?: string;
    };

    if (!title?.trim()) { res.status(400).json({ error: "title é obrigatório" }); return; }

    const [created] = await db
      .insert(responsibilitiesTable)
      .values({
        orgId: user.organizationId,
        operationId: operationId ?? null,
        title: title.trim(),
        description: description?.trim() ?? null,
        category: category?.trim() || "OPERAÇÃO",
        active: true,
      })
      .returning();

    res.status(201).json({ responsibility: created });
  } catch {
    res.status(500).json({ error: "Erro ao criar responsabilidade" });
  }
});

// ─── PATCH /responsibilities/:id ──────────────────────────────────────────────

router.patch("/responsibilities/:id", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  try {
    const user = req.user!;
    if (user.role !== "ADMIN") { res.status(403).json({ error: "Somente ADMIN pode editar responsabilidades" }); return; }

    const id = String(req.params.id);
    const { title, description, category, operationId, active } = req.body as {
      title?: string;
      description?: string;
      category?: string;
      operationId?: string | null;
      active?: boolean;
    };

    const [existing] = await db
      .select()
      .from(responsibilitiesTable)
      .where(and(eq(responsibilitiesTable.id, id), eq(responsibilitiesTable.orgId, user.organizationId)));
    if (!existing) { res.status(404).json({ error: "Responsabilidade não encontrada" }); return; }

    const [updated] = await db
      .update(responsibilitiesTable)
      .set({
        ...(title !== undefined && { title: title.trim() }),
        ...(description !== undefined && { description: description?.trim() ?? null }),
        ...(category !== undefined && { category: category.trim() }),
        ...(operationId !== undefined && { operationId: operationId ?? null }),
        ...(active !== undefined && { active }),
        updatedAt: new Date(),
      })
      .where(eq(responsibilitiesTable.id, id))
      .returning();

    res.json({ responsibility: updated });
  } catch {
    res.status(500).json({ error: "Erro ao atualizar responsabilidade" });
  }
});

// ─── DELETE /responsibilities/:id ─────────────────────────────────────────────

router.delete("/responsibilities/:id", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  try {
    const user = req.user!;
    if (user.role !== "ADMIN") { res.status(403).json({ error: "Somente ADMIN pode remover responsabilidades" }); return; }

    const id = String(req.params.id);
    const [existing] = await db
      .select()
      .from(responsibilitiesTable)
      .where(and(eq(responsibilitiesTable.id, id), eq(responsibilitiesTable.orgId, user.organizationId)));
    if (!existing) { res.status(404).json({ error: "Responsabilidade não encontrada" }); return; }

    await db
      .update(responsibilitiesTable)
      .set({ active: false, updatedAt: new Date() })
      .where(eq(responsibilitiesTable.id, id));

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Erro ao remover responsabilidade" });
  }
});

// ─── POST /responsibilities/:id/assignments ───────────────────────────────────

router.post("/responsibilities/:id/assignments", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  try {
    const user = req.user!;
    if (user.role !== "ADMIN") { res.status(403).json({ error: "Somente ADMIN pode atribuir responsabilidades" }); return; }

    const respId = String(req.params.id);
    const { memberId, role, substituteMemberId, startsAt, endsAt } = req.body as {
      memberId: string;
      role?: "PRIMARY" | "SECONDARY";
      substituteMemberId?: string;
      startsAt?: string;
      endsAt?: string;
    };

    if (!memberId) { res.status(400).json({ error: "memberId é obrigatório" }); return; }

    const [resp] = await db
      .select()
      .from(responsibilitiesTable)
      .where(and(eq(responsibilitiesTable.id, respId), eq(responsibilitiesTable.orgId, user.organizationId)));
    if (!resp) { res.status(404).json({ error: "Responsabilidade não encontrada" }); return; }

    // Get member name for notification
    const [member] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, memberId));

    const [assignment] = await db
      .insert(responsibilityAssignmentsTable)
      .values({
        responsibilityId: respId,
        memberId,
        role: role ?? "PRIMARY",
        substituteMemberId: substituteMemberId ?? null,
        startsAt: startsAt ? new Date(startsAt) : null,
        endsAt: endsAt ? new Date(endsAt) : null,
        active: true,
      })
      .returning();

    // Notify assigned member
    sendNotification({
      userId: memberId,
      type: "responsibility.assigned",
      title: "Nova responsabilidade atribuída",
      message: `Você é agora responsável por: ${resp.title}`,
      priority: "IMPORTANT",
      category: "responsibility",
      entityType: "responsibility",
      entityId: respId,
    }).catch(() => {});

    res.status(201).json({ assignment: { ...assignment, memberName: member?.name ?? null } });
  } catch {
    res.status(500).json({ error: "Erro ao atribuir responsabilidade" });
  }
});

// ─── PATCH /responsibilities/:id/assignments/:assignmentId ────────────────────

router.patch("/responsibilities/:id/assignments/:assignmentId", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  try {
    const user = req.user!;
    if (user.role !== "ADMIN") { res.status(403).json({ error: "Somente ADMIN pode editar atribuições" }); return; }

    const { assignmentId } = req.params;
    const { substituteMemberId, active, endsAt } = req.body as {
      substituteMemberId?: string | null;
      active?: boolean;
      endsAt?: string | null;
    };

    const [existing] = await db
      .select()
      .from(responsibilityAssignmentsTable)
      .where(eq(responsibilityAssignmentsTable.id, assignmentId));
    if (!existing) { res.status(404).json({ error: "Atribuição não encontrada" }); return; }

    const [updated] = await db
      .update(responsibilityAssignmentsTable)
      .set({
        ...(substituteMemberId !== undefined && { substituteMemberId: substituteMemberId ?? null }),
        ...(active !== undefined && { active }),
        ...(endsAt !== undefined && { endsAt: endsAt ? new Date(endsAt) : null }),
        updatedAt: new Date(),
      })
      .where(eq(responsibilityAssignmentsTable.id, assignmentId))
      .returning();

    // If inactivated, notify member and check if now uncovered
    if (active === false) {
      sendNotification({
        userId: existing.memberId,
        type: "responsibility.unassigned",
        title: "Responsabilidade removida",
        message: "Uma responsabilidade foi removida da sua lista.",
        priority: "IMPORTANT",
        category: "responsibility",
        entityType: "responsibility",
        entityId: existing.responsibilityId,
      }).catch(() => {});

      // Check if uncovered — notify managers
      const remaining = await db
        .select({ id: responsibilityAssignmentsTable.id })
        .from(responsibilityAssignmentsTable)
        .where(
          and(
            eq(responsibilityAssignmentsTable.responsibilityId, existing.responsibilityId),
            eq(responsibilityAssignmentsTable.active, true),
            not(eq(responsibilityAssignmentsTable.id, assignmentId)),
          )
        );

      if (remaining.length === 0) {
        const [resp] = await db
          .select({ title: responsibilitiesTable.title, orgId: responsibilitiesTable.orgId })
          .from(responsibilitiesTable)
          .where(eq(responsibilitiesTable.id, existing.responsibilityId));

        if (resp) {
          // Managers scoped to this org via operationsTable
          const managers = await db
            .select({ userId: userRolesTable.userId })
            .from(userRolesTable)
            .innerJoin(operationsTable, eq(userRolesTable.operationId, operationsTable.id))
            .where(
              and(
                eq(operationsTable.organizationId, resp.orgId),
                inArray(userRolesTable.role, ["ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"] as any),
                eq(userRolesTable.active, true),
              )
            );
          const managerIds = [...new Set(managers.map((m) => m.userId))];
          notifyMany(managerIds, {
            type: "responsibility.uncovered",
            title: "Responsabilidade sem responsável",
            message: `A responsabilidade "${resp.title}" ficou sem responsável.`,
            priority: "IMPORTANT",
            category: "responsibility",
            entityType: "responsibility",
            entityId: existing.responsibilityId,
          }).catch(() => {});
        }
      }
    }

    // If substitute set, notify them
    if (substituteMemberId && substituteMemberId !== existing.substituteMemberId) {
      const [resp] = await db
        .select({ title: responsibilitiesTable.title })
        .from(responsibilitiesTable)
        .where(eq(responsibilitiesTable.id, existing.responsibilityId));
      sendNotification({
        userId: substituteMemberId,
        type: "responsibility.substitute_activated",
        title: "Substituição ativada",
        message: `Você foi definido como substituto em: ${resp?.title ?? "responsabilidade"}`,
        priority: "IMPORTANT",
        category: "responsibility",
        entityType: "responsibility",
        entityId: existing.responsibilityId,
      }).catch(() => {});
    }

    res.json({ assignment: updated });
  } catch {
    res.status(500).json({ error: "Erro ao atualizar atribuição" });
  }
});

// ─── DELETE /responsibilities/:id/assignments/:assignmentId ──────────────────

router.delete("/responsibilities/:id/assignments/:assignmentId", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  try {
    const user = req.user!;
    if (user.role !== "ADMIN") { res.status(403).json({ error: "Somente ADMIN pode remover atribuições" }); return; }

    const { assignmentId, id: respId } = req.params;

    await db
      .update(responsibilityAssignmentsTable)
      .set({ active: false, updatedAt: new Date() })
      .where(eq(responsibilityAssignmentsTable.id, assignmentId));

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Erro ao remover atribuição" });
  }
});

export default router;
