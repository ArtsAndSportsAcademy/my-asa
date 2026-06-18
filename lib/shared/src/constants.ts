export const PUSH_MAX_RETRIES = 3;
export const PUSH_RETRY_DELAYS_MS = [5_000, 30_000, 120_000] as const;
export const ACCESS_TOKEN_TTL_MINUTES = 15;
export const REFRESH_TOKEN_TTL_DAYS = 30;
export const MY_DAY_POLL_INTERVAL_MS = 60_000;

export const COVERAGE_CRITICALITY_WEIGHT = {
  OPEN_MIN_ONE: 2.0,
  OPEN_MIN_MANY: 1.5,
  AT_RISK: 1.0,
  DAILY_BOOK_OUTDATED: 0.8,
  UNCONFIRMED_CHANGE: 0.6,
} as const;

export const LOG_DOMAIN = {
  IDENTITY: "identity",
  ORGANIZATION: "organization",
  TEAMS: "teams",
  AGENDA: "agenda",
  SHOW_BOOK: "show_book",
  SCALE: "scale",
  DAILY_BOOK: "daily_book",
  REQUESTS: "requests",
  MO_ENGINE: "mo_engine",
  AVISOS: "avisos",
  MESSAGES: "messages",
  DELIVERIES: "deliveries",
  HISTORY: "history",
  AI: "ai",
  NOTIFICATIONS: "notifications",
  AUDIT: "audit",
} as const;

export const REQUEST_ID_HEADER = "x-request-id";
export const CORRELATION_ID_HEADER = "x-correlation-id";
