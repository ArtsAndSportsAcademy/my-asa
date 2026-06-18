import type { MOType, ActorType, RestrictionType, RequestDecisionType, NoticeUrgency, Platform } from "./enums.js";

export type EventPayloadMap = {
  "identity.user.logged_in": {
    userId: string;
    deviceId: string | null;
    platform: Platform | null;
    timestamp: Date;
  };
  "identity.user.logged_out": {
    userId: string;
    sessionId: string;
  };
  "identity.token.refreshed": {
    userId: string;
  };
  "identity.device.registered": {
    userId: string;
    deviceToken: string;
    platform: Platform;
  };

  "org.operation.created": {
    operationId: string;
    organizationId: string;
  };
  "org.operation.archived": {
    operationId: string;
  };

  "teams.member.added": {
    userId: string;
    groupId: string;
    operationId: string;
    role: string;
  };
  "teams.member.deactivated": {
    userId: string;
    operationId: string;
  };
  "teams.role.changed": {
    userId: string;
    operationId: string;
    previousRole: string;
    newRole: string;
  };
  "teams.restriction.created": {
    userId: string;
    restrictionId: string;
    type: RestrictionType;
    periodStart: string;
    periodEnd: string;
  };
  "teams.restriction.expired": {
    userId: string;
    restrictionId: string;
  };
  "teams.delegation.created": {
    delegatorId: string;
    delegateeId: string;
    operationId: string;
    delegationId: string;
    validUntil: Date;
  };
  "teams.delegation.expired": {
    delegationId: string;
  };

  "agenda.event.created": {
    eventId: string;
    operationId: string;
    type: string;
    date: string;
  };
  "agenda.event.confirmed": {
    eventId: string;
  };
  "agenda.event.changed": {
    eventId: string;
    changedFields: string[];
  };
  "agenda.event.cancelled": {
    eventId: string;
    operationId: string;
    affectedAllocationIds: string[];
  };
  "agenda.event.completed": {
    eventId: string;
  };

  "showbook.created": {
    showBookId: string;
    operationId: string;
  };
  "showbook.version_created": {
    showBookId: string;
    version: number;
    changeType: "STRUCTURAL" | "CONFIG";
  };
  "showbook.published": {
    showBookId: string;
    version: number;
  };

  "scale.published": {
    scaleId: string;
    groupId: string;
    operationId: string;
    changes: Array<{ allocationId: string; userId: string; previousState: string; newState: string }>;
    timestamp: Date;
  };
  "scale.allocation.changed": {
    allocationId: string;
    userId: string;
    eventId: string;
    previousState: string;
    newState: string;
    correlationId: string;
  };
  "scale.position.coverage_gap_detected": {
    eventId: string;
    roleId: string;
    currentCoverage: number;
    minimumRequired: number;
  };
  "scale.change.confirmed_by_member": {
    allocationId: string;
    userId: string;
    confirmedAt: Date;
  };

  "dailybook.generated": {
    dailyBookId: string;
    eventId: string;
    version: number;
  };
  "dailybook.published": {
    dailyBookId: string;
    version: number;
    supervisorId: string;
  };
  "dailybook.republished": {
    dailyBookId: string;
    previousVersion: number;
    newVersion: number;
    delta: Record<string, unknown>;
  };
  "dailybook.outdated": {
    dailyBookId: string;
    reason: string;
    triggeredBy: string;
    correlationId: string;
  };

  "solicitacoes.request.created": {
    requestId: string;
    requesterId: string;
    type: string;
    targetDates: string[];
    operationId: string;
    correlationId: string;
  };
  "solicitacoes.request.approved": {
    requestId: string;
    supervisorId: string;
    correlationId: string;
  };
  "solicitacoes.request.denied": {
    requestId: string;
    supervisorId: string;
    reason: string;
    correlationId: string;
  };
  "solicitacoes.request.alternative_proposed": {
    requestId: string;
    supervisorId: string;
    proposal: Record<string, unknown>;
    deadline: Date;
    correlationId: string;
  };
  "solicitacoes.request.alternative_accepted": {
    requestId: string;
    userId: string;
    correlationId: string;
  };
  "solicitacoes.request.alternative_rejected": {
    requestId: string;
    userId: string;
    correlationId: string;
  };

  "mo.created": {
    moId: string;
    type: MOType;
    actorId: string | null;
    actorType: ActorType;
    affectedEntities: Array<{ entityType: string; entityId: string }>;
    correlationId: string;
  };
  "mo.propagated": {
    moId: string;
    affectedSurfaces: string[];
    correlationId: string;
  };

  "avisos.created": {
    avisoId: string;
    authorId: string;
    urgency: NoticeUrgency;
    operationId: string;
    recipientIds: string[];
    correlationId: string;
  };
  "avisos.sent": {
    avisoId: string;
    notificationJobIds: string[];
    correlationId: string;
  };
  "avisos.confirmed_by_member": {
    avisoId: string;
    userId: string;
    confirmedAt: Date;
  };

  "messages.created": {
    messageId: string;
    senderId: string;
    recipientId: string | null;
    groupId: string | null;
    contextType: string | null;
    contextId: string | null;
    timestamp: Date;
  };

  "deliveries.created": {
    deliveryId: string;
    creatorId: string;
    operationId: string;
    type: string;
    dueDate: string;
  };
  "deliveries.published": {
    deliveryId: string;
    assignmentIds: string[];
  };
  "deliveries.assignment.completed": {
    deliveryId: string;
    userId: string;
    completedAt: Date;
  };
  "deliveries.assignment.overdue": {
    deliveryId: string;
    userId: string;
  };
  "deliveries.assignment.expired": {
    deliveryId: string;
    userId: string;
    assignmentId: string;
  };

  "notifications.sent": {
    notificationId: string;
    userId: string;
    platform: Platform;
  };
  "notifications.delivered": {
    notificationId: string;
    deliveredAt: Date;
  };
  "notifications.failed": {
    notificationId: string;
    attempt: number;
    reason: string;
  };
};

export type EventName = keyof EventPayloadMap;
export type EventPayload<T extends EventName> = EventPayloadMap[T];
