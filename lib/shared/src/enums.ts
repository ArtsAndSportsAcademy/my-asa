export const UserRole = {
  ADMIN: "ADMIN",
  SUPERVISOR_A: "SUPERVISOR_A",
  SUPERVISOR_B: "SUPERVISOR_B",
  MEMBER: "MEMBER",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const UserStatus = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const OperationStatus = {
  DRAFT: "DRAFT",
  ACTIVE: "ACTIVE",
  PAUSED: "PAUSED",
  ARCHIVED: "ARCHIVED",
} as const;
export type OperationStatus = (typeof OperationStatus)[keyof typeof OperationStatus];

export const GroupStatus = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  ARCHIVED: "ARCHIVED",
} as const;
export type GroupStatus = (typeof GroupStatus)[keyof typeof GroupStatus];

export const RestrictionType = {
  PHYSICAL: "PHYSICAL",
  HEALTH: "HEALTH",
  SCHEDULE: "SCHEDULE",
  ROLE: "ROLE",
  TECHNICAL: "TECHNICAL",
  PERSONAL: "PERSONAL",
} as const;
export type RestrictionType = (typeof RestrictionType)[keyof typeof RestrictionType];

export const RestrictionStatus = {
  ACTIVE: "ACTIVE",
  EXPIRED: "EXPIRED",
} as const;
export type RestrictionStatus = (typeof RestrictionStatus)[keyof typeof RestrictionStatus];

export const RequestType = {
  LEAVE: "LEAVE",
  ROLE_RESTRICTION: "ROLE_RESTRICTION",
  PHYSICAL_RESTRICTION: "PHYSICAL_RESTRICTION",
  HEALTH_RESTRICTION: "HEALTH_RESTRICTION",
  SCHEDULE_CHANGE: "SCHEDULE_CHANGE",
  SWAP: "SWAP",
  OTHER: "OTHER",
} as const;
export type RequestType = (typeof RequestType)[keyof typeof RequestType];

export const RequestStatus = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  DENIED: "DENIED",
  ALTERNATIVE_PROPOSED: "ALTERNATIVE_PROPOSED",
  ALTERNATIVE_ACCEPTED: "ALTERNATIVE_ACCEPTED",
  ALTERNATIVE_REJECTED: "ALTERNATIVE_REJECTED",
  EXPIRED: "EXPIRED",
} as const;
export type RequestStatus = (typeof RequestStatus)[keyof typeof RequestStatus];

export const RequestDecisionType = {
  APPROVED: "APPROVED",
  DENIED: "DENIED",
  ALTERNATIVE_PROPOSED: "ALTERNATIVE_PROPOSED",
} as const;
export type RequestDecisionType = (typeof RequestDecisionType)[keyof typeof RequestDecisionType];

export const NoticeUrgency = {
  INFORMATIVE: "INFORMATIVE",
  IMPORTANT: "IMPORTANT",
  CRITICAL: "CRITICAL",
} as const;
export type NoticeUrgency = (typeof NoticeUrgency)[keyof typeof NoticeUrgency];

export const NoticeType = {
  INFORMATIVE: "INFORMATIVE",
  IMPORTANT: "IMPORTANT",
  PERSISTENT: "PERSISTENT",
  ESCALATED: "ESCALATED",
} as const;
export type NoticeType = (typeof NoticeType)[keyof typeof NoticeType];

export const NoticeStatus = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
  EXPIRED: "EXPIRED",
  CANCELLED: "CANCELLED",
} as const;
export type NoticeStatus = (typeof NoticeStatus)[keyof typeof NoticeStatus];

export const NoticeRecipientStatus = {
  PENDING: "PENDING",
  SENT: "SENT",
  VIEWED: "VIEWED",
  CONFIRMED: "CONFIRMED",
  ESCALATED: "ESCALATED",
} as const;
export type NoticeRecipientStatus = (typeof NoticeRecipientStatus)[keyof typeof NoticeRecipientStatus];

export const DeliveryType = {
  READING: "READING",
  VIDEO: "VIDEO",
  OPERATIONAL_UPDATE: "OPERATIONAL_UPDATE",
  CHECKLIST: "CHECKLIST",
} as const;
export type DeliveryType = (typeof DeliveryType)[keyof typeof DeliveryType];

export const DeliveryStatus = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
  CANCELLED: "CANCELLED",
} as const;
export type DeliveryStatus = (typeof DeliveryStatus)[keyof typeof DeliveryStatus];

export const DeliveryAssignmentStatus = {
  PUBLISHED: "PUBLISHED",
  RECEIVED: "RECEIVED",
  VIEWED: "VIEWED",
  COMPLETED: "COMPLETED",
  OVERDUE: "OVERDUE",
  EXPIRED: "EXPIRED",
} as const;
export type DeliveryAssignmentStatus = (typeof DeliveryAssignmentStatus)[keyof typeof DeliveryAssignmentStatus];

export const AgendaEventType = {
  SHOW: "SHOW",
  REHEARSAL: "REHEARSAL",
  MEETING: "MEETING",
  WORKSHOP: "WORKSHOP",
  OTHER: "OTHER",
} as const;
export type AgendaEventType = (typeof AgendaEventType)[keyof typeof AgendaEventType];

export const AgendaEventStatus = {
  DRAFT: "DRAFT",
  CONFIRMED: "CONFIRMED",
  CHANGED: "CHANGED",
  CANCELLED: "CANCELLED",
  COMPLETED: "COMPLETED",
} as const;
export type AgendaEventStatus = (typeof AgendaEventStatus)[keyof typeof AgendaEventStatus];

export const ShowBookStatus = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
  ARCHIVED: "ARCHIVED",
} as const;
export type ShowBookStatus = (typeof ShowBookStatus)[keyof typeof ShowBookStatus];

export const ScaleStatus = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
} as const;
export type ScaleStatus = (typeof ScaleStatus)[keyof typeof ScaleStatus];

export const AllocationStatus = {
  ALLOCATED: "ALLOCATED",
  AT_RISK: "AT_RISK",
  OPEN: "OPEN",
} as const;
export type AllocationStatus = (typeof AllocationStatus)[keyof typeof AllocationStatus];

export const DailyBookStatus = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
  OUTDATED: "OUTDATED",
  CANCELLED: "CANCELLED",
} as const;
export type DailyBookStatus = (typeof DailyBookStatus)[keyof typeof DailyBookStatus];

export const PositionStatus = {
  COVERED: "COVERED",
  AT_RISK: "AT_RISK",
  OPEN: "OPEN",
} as const;
export type PositionStatus = (typeof PositionStatus)[keyof typeof PositionStatus];

export const MOType = {
  MO_PUBLICACAO_ESCALA: "MO_PUBLICACAO_ESCALA",
  MO_APROVACAO_FOLGA: "MO_APROVACAO_FOLGA",
  MO_NOVA_RESTRICAO: "MO_NOVA_RESTRICAO",
  MO_CANCELAMENTO_SHOW: "MO_CANCELAMENTO_SHOW",
  MO_SUBSTITUICAO: "MO_SUBSTITUICAO",
  MO_AJUSTE_ESCALA: "MO_AJUSTE_ESCALA",
  MO_PUBLICACAO_LIVRO_DIA: "MO_PUBLICACAO_LIVRO_DIA",
  MO_REPUBLICACAO_LIVRO_DIA: "MO_REPUBLICACAO_LIVRO_DIA",
  MO_CANCELAMENTO_SOLICITACAO: "MO_CANCELAMENTO_SOLICITACAO",
  MO_DELEGACAO_CRIADA: "MO_DELEGACAO_CRIADA",
  MO_DELEGACAO_EXPIRADA: "MO_DELEGACAO_EXPIRADA",
  MO_RESTRICAO_CRIADA: "MO_RESTRICAO_CRIADA",
  MO_RESTRICAO_EXPIRADA: "MO_RESTRICAO_EXPIRADA",
  MO_MEMBRO_ADICIONADO: "MO_MEMBRO_ADICIONADO",
  MO_PAPEL_ALTERADO: "MO_PAPEL_ALTERADO",
} as const;
export type MOType = (typeof MOType)[keyof typeof MOType];

export const ActorType = {
  HUMAN: "HUMAN",
  DETERMINISTIC_ENGINE: "DETERMINISTIC_ENGINE",
  LLM_CONFIRMED: "LLM_CONFIRMED",
} as const;
export type ActorType = (typeof ActorType)[keyof typeof ActorType];

export const NotificationStatus = {
  PENDING: "PENDING",
  SENT: "SENT",
  DELIVERED: "DELIVERED",
  FAILED: "FAILED",
} as const;
export type NotificationStatus = (typeof NotificationStatus)[keyof typeof NotificationStatus];

export const Platform = {
  IOS: "IOS",
  ANDROID: "ANDROID",
} as const;
export type Platform = (typeof Platform)[keyof typeof Platform];

export const MessageContextType = {
  REQUEST: "REQUEST",
  DELIVERY: "DELIVERY",
  NOTICE: "NOTICE",
  MO: "MO",
  DAILY_BOOK: "DAILY_BOOK",
  FREE: "FREE",
} as const;
export type MessageContextType = (typeof MessageContextType)[keyof typeof MessageContextType];

export const SecurityAuditAction = {
  LOGIN: "LOGIN",
  LOGOUT: "LOGOUT",
  PERMISSION_DENIED: "PERMISSION_DENIED",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  INVALID_ACCESS_ATTEMPT: "INVALID_ACCESS_ATTEMPT",
  TOKEN_REFRESHED: "TOKEN_REFRESHED",
  DEVICE_REGISTERED: "DEVICE_REGISTERED",
  USER_CREATED: "USER_CREATED",
  USER_UPDATED: "USER_UPDATED",
  USER_STATUS_CHANGED: "USER_STATUS_CHANGED",
  USER_DELETED: "USER_DELETED",
  ROLE_ASSIGNED: "ROLE_ASSIGNED",
  ROLE_REMOVED: "ROLE_REMOVED",
  OPERATION_CREATED: "OPERATION_CREATED",
  OPERATION_UPDATED: "OPERATION_UPDATED",
  GROUP_CREATED: "GROUP_CREATED",
  GROUP_UPDATED: "GROUP_UPDATED",
  MEMBER_ADDED: "MEMBER_ADDED",
  MEMBER_REMOVED: "MEMBER_REMOVED",
} as const;
export type SecurityAuditAction = (typeof SecurityAuditAction)[keyof typeof SecurityAuditAction];
