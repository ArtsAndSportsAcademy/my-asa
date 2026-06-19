import { Router, type IRouter } from "express";
import { eq, and, inArray, not, gte, asc, desc, or, isNull } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  scaleAllocationsTable,
  scalesTable,
  agendaEventsTable,
  showBookRolesTable,
  dailyBooksTable,
  dailyBookAssignmentsTable,
  dailyBookPositionsTable,
  dailyBookBlocksTable,
  dailyBookScenesTable,
  requestsTable,
  deliveriesTable,
  deliveryAssignmentsTable,
  operationsTable,
  operationalGroupsTable,
  noticesTable,
  noticeRecipientsTable,
} from "@workspace/db";
import { requireAuth, requireOrganization } from "../middlewares/auth.js";
import { requestLogger } from "../lib/logger.js";
import { LOG_DOMAIN } from "@workspace/shared";

const router: IRouter = Router();

// ─── GET /api/my-day ──────────────────────────────────────────────────────────

router.get("/my-day", requireAuth, requireOrganization, async (req, res) => {
  const log = requestLogger(LOG_DOMAIN.MY_DAY, req.requestId, req.correlationId);
  const userId = req.user!.sub;

  const today = new Date().toISOString().slice(0, 10);

  try {
    const [allocations, pendingRequests, deliveryAssignments, pendingNoticesRaw] = await Promise.all([
      // 1. Upcoming allocations for this user in published/republished scales
      db
        .select({
          allocationId: scaleAllocationsTable.id,
          allocationStatus: scaleAllocationsTable.status,
          scaleId: scalesTable.id,
          scaleTitle: scalesTable.title,
          scaleStatus: scalesTable.status,
          scaleRepublishedAt: scalesTable.republishedAt,
          operationId: scalesTable.operationId,
          groupId: scalesTable.groupId,
          eventId: agendaEventsTable.id,
          eventTitle: agendaEventsTable.title,
          eventType: agendaEventsTable.type,
          eventDate: agendaEventsTable.date,
          eventStartTime: agendaEventsTable.startTime,
          eventEndTime: agendaEventsTable.endTime,
          eventLocation: agendaEventsTable.location,
          eventStatus: agendaEventsTable.status,
          positionId: showBookRolesTable.id,
          positionName: showBookRolesTable.name,
        })
        .from(scaleAllocationsTable)
        .innerJoin(scalesTable, eq(scaleAllocationsTable.scaleId, scalesTable.id))
        .innerJoin(agendaEventsTable, eq(scaleAllocationsTable.agendaEventId, agendaEventsTable.id))
        .leftJoin(showBookRolesTable, eq(scaleAllocationsTable.positionId, showBookRolesTable.id))
        .where(
          and(
            eq(scaleAllocationsTable.userId, userId),
            inArray(scalesTable.status, ["PUBLISHED", "REPUBLISHED"]),
            gte(agendaEventsTable.date, today),
            inArray(agendaEventsTable.status, ["CONFIRMED", "DRAFT"]),
          )
        )
        .orderBy(asc(agendaEventsTable.date), asc(agendaEventsTable.startTime)),

      // 2. Active + recently resolved requests for this user (last 7 days)
      db
        .select()
        .from(requestsTable)
        .where(
          and(
            eq(requestsTable.requesterId, userId),
            or(
              inArray(requestsTable.status, ["PENDING", "ALTERNATIVE_PROPOSED"]),
              and(
                inArray(requestsTable.status, ["APPROVED", "DENIED", "ALTERNATIVE_ACCEPTED", "ALTERNATIVE_REJECTED"]),
                gte(requestsTable.updatedAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)),
              ),
            ),
          )
        )
        .orderBy(desc(requestsTable.createdAt)),

      // 3. Future delivery assignments for this user
      db
        .select({
          assignmentId: deliveryAssignmentsTable.id,
          assignmentStatus: deliveryAssignmentsTable.status,
          deliveryId: deliveriesTable.id,
          deliveryTitle: deliveriesTable.title,
          deliveryType: deliveriesTable.type,
          deliveryDueDate: deliveriesTable.dueDate,
          deliveryOperationId: deliveriesTable.operationId,
        })
        .from(deliveryAssignmentsTable)
        .innerJoin(deliveriesTable, eq(deliveryAssignmentsTable.deliveryId, deliveriesTable.id))
        .where(
          and(
            eq(deliveryAssignmentsTable.userId, userId),
            inArray(deliveryAssignmentsTable.status, ["PUBLISHED", "RECEIVED", "VIEWED"]),
            gte(deliveriesTable.dueDate, today),
            eq(deliveriesTable.status, "PUBLISHED"),
          )
        )
        .orderBy(asc(deliveriesTable.dueDate)),

      // 4. Pending notices with urgency CRITICAL or IMPORTANT, not yet confirmed, not expired
      db
        .select({
          id: noticesTable.id,
          title: noticesTable.title,
          content: noticesTable.content,
          urgency: noticesTable.urgency,
          type: noticesTable.type,
          requiresConfirmation: noticesTable.requiresConfirmation,
          deltaJson: noticesTable.deltaJson,
          publishedAt: noticesTable.publishedAt,
          recipientStatus: noticeRecipientsTable.status,
        })
        .from(noticeRecipientsTable)
        .innerJoin(noticesTable, eq(noticeRecipientsTable.noticeId, noticesTable.id))
        .where(
          and(
            eq(noticeRecipientsTable.userId, userId),
            eq(noticesTable.status, "PUBLISHED"),
            inArray(noticesTable.urgency, ["CRITICAL", "IMPORTANT"]),
            not(eq(noticeRecipientsTable.status, "CONFIRMED")),
            or(
              isNull(noticesTable.expiresAt),
              gte(noticesTable.expiresAt, new Date()),
            ),
          )
        )
        .orderBy(desc(noticesTable.publishedAt)),
    ]);

    // Collect unique operationIds and groupIds to resolve names
    const operationIds = [...new Set(allocations.map((a) => a.operationId).filter(Boolean))] as string[];
    const groupIds = [...new Set(allocations.map((a) => a.groupId).filter(Boolean))] as string[];
    const eventIds = [...new Set(allocations.map((a) => a.eventId))] as string[];

    // Fetch operation and group names + daily books in parallel
    const [operations, groups, dailyBooks] = await Promise.all([
      operationIds.length > 0
        ? db
            .select({ id: operationsTable.id, name: operationsTable.name })
            .from(operationsTable)
            .where(inArray(operationsTable.id, operationIds))
        : [],
      groupIds.length > 0
        ? db
            .select({ id: operationalGroupsTable.id, name: operationalGroupsTable.name })
            .from(operationalGroupsTable)
            .where(inArray(operationalGroupsTable.id, groupIds))
        : [],
      eventIds.length > 0
        ? db
            .select({
              id: dailyBooksTable.id,
              agendaEventId: dailyBooksTable.agendaEventId,
              status: dailyBooksTable.status,
              version: dailyBooksTable.version,
              republishDeltaJson: dailyBooksTable.republishDeltaJson,
              publishedAt: dailyBooksTable.publishedAt,
            })
            .from(dailyBooksTable)
            .where(
              and(
                inArray(dailyBooksTable.agendaEventId, eventIds),
                inArray(dailyBooksTable.status, ["PUBLISHED", "REPUBLISHED"]),
              )
            )
        : [],
    ]);

    // Fetch daily book assignments for this user
    const dailyBookIds = dailyBooks.map((b) => b.id);
    const myDailyBookAssignments = dailyBookIds.length > 0
      ? await db
          .select({
            assignmentId: dailyBookAssignmentsTable.id,
            dailyBookId: dailyBookAssignmentsTable.dailyBookId,
            status: dailyBookAssignmentsTable.status,
            positionId: dailyBookAssignmentsTable.positionId,
            positionName: dailyBookPositionsTable.name,
          })
          .from(dailyBookAssignmentsTable)
          .innerJoin(dailyBookPositionsTable, eq(dailyBookAssignmentsTable.positionId, dailyBookPositionsTable.id))
          .where(
            and(
              inArray(dailyBookAssignmentsTable.dailyBookId, dailyBookIds),
              eq(dailyBookAssignmentsTable.userId, userId),
            )
          )
      : [];

    // Build lookup maps
    const opMap = new Map(operations.map((o) => [o.id, o.name]));
    const groupMap = new Map(groups.map((g) => [g.id, g.name]));
    const dailyBookByEventId = new Map(dailyBooks.map((b) => [b.agendaEventId, b]));
    const assignmentsByDailyBookId = new Map<string, typeof myDailyBookAssignments[number][]>();
    for (const a of myDailyBookAssignments) {
      const existing = assignmentsByDailyBookId.get(a.dailyBookId) ?? [];
      existing.push(a);
      assignmentsByDailyBookId.set(a.dailyBookId, existing);
    }

    // Build enriched activities
    const activities = allocations.map((alloc) => {
      const dailyBook = dailyBookByEventId.get(alloc.eventId);
      const myAssignments = dailyBook ? (assignmentsByDailyBookId.get(dailyBook.id) ?? []) : [];

      return {
        allocationId: alloc.allocationId,
        allocationStatus: alloc.allocationStatus,
        scaleId: alloc.scaleId,
        scaleTitle: alloc.scaleTitle,
        scaleStatus: alloc.scaleStatus,
        scaleRepublishedAt: alloc.scaleRepublishedAt,
        operationId: alloc.operationId,
        operationName: opMap.get(alloc.operationId) ?? null,
        groupId: alloc.groupId ?? null,
        groupName: alloc.groupId ? (groupMap.get(alloc.groupId) ?? null) : null,
        eventId: alloc.eventId,
        eventTitle: alloc.eventTitle,
        eventType: alloc.eventType,
        eventDate: alloc.eventDate,
        eventStartTime: alloc.eventStartTime ?? null,
        eventEndTime: alloc.eventEndTime ?? null,
        eventLocation: alloc.eventLocation ?? null,
        eventStatus: alloc.eventStatus,
        positionId: alloc.positionId ?? null,
        positionName: alloc.positionName ?? null,
        dailyBook: dailyBook
          ? {
              id: dailyBook.id,
              status: dailyBook.status,
              version: dailyBook.version,
              republishedDelta: (dailyBook.status === "REPUBLISHED" && dailyBook.republishDeltaJson)
                ? dailyBook.republishDeltaJson
                : null,
              myAssignments: myAssignments.map((a) => ({
                assignmentId: a.assignmentId,
                positionId: a.positionId,
                positionName: a.positionName,
                status: a.status,
              })),
            }
          : null,
      };
    });

    // Separate today vs future
    const todayActivities = activities.filter((a) => a.eventDate === today);
    const futureActivities = activities.filter((a) => a.eventDate > today);

    type Activity = (typeof activities)[number];

    // Immediate action: first activity today, or if none, next future
    const immediateAction: Activity | null = todayActivities[0] ?? futureActivities[0] ?? null;

    // Next activity: first future (or second today if none future)
    let nextActivity: Activity | null = null;
    if (todayActivities.length > 0) {
      nextActivity = futureActivities[0] ?? todayActivities[1] ?? null;
    } else {
      nextActivity = futureActivities[1] ?? null;
    }

    const payload = {
      generatedAt: new Date().toISOString(),
      immediateAction,
      nextActivity,
      todayActivities,
      futureActivities: futureActivities.slice(0, 5),
      pendingNotices: pendingNoticesRaw.map((n) => {
        const delta = n.deltaJson as { before?: string; after?: string } | null;
        return {
          id: n.id,
          title: n.title ?? null,
          content: n.content,
          urgency: n.urgency,
          type: n.type,
          requiresConfirmation: n.requiresConfirmation,
          recipientStatus: n.recipientStatus,
          publishedAt: n.publishedAt,
          changeBefore: delta?.before ?? null,
          changeAfter: delta?.after ?? null,
        };
      }),
      complementaryInfo: {
        pendingRequests: pendingRequests.map((r) => ({
          requestId: r.id,
          type: r.type,
          status: r.status,
          targetDates: r.targetDates,
          reason: r.reason ?? null,
          createdAt: r.createdAt,
        })),
        upcomingDeliveries: deliveryAssignments.map((d) => ({
          assignmentId: d.assignmentId,
          deliveryId: d.deliveryId,
          title: d.deliveryTitle,
          type: d.deliveryType,
          dueDate: d.deliveryDueDate,
          status: d.assignmentStatus,
          operationId: d.deliveryOperationId,
        })),
      },
    };

    res.json(payload);
  } catch (err) {
    log.error({ err }, "erro ao montar Meu Dia");
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
