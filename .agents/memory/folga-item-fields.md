---
name: FolgaItem field names (API shape)
description: The shape returned by /api/folgas (useListFolgas / FolgaItem) — field names that bite when consuming folga availability
---

# FolgaItem shape from useListFolgas

`GET /api/folgas` returns items typed as `FolgaItem` with these date/status fields:
- `startDate` / `endDate` (ISO strings) — NOT `dateFrom`/`dateTo` and NOT a single `date`.
- `status` — for "is this person unavailable" checks, the active value is `"ACTIVE"` (not `APPROVED`).
- `type` — folgaTypeEnum: DAY_OFF/NO_SHOW/RECESSO/AFASTAMENTO/RESTRICAO/OUTRO.

**Why:** Building availability maps (date→userId→type) by reading `f.dateFrom/f.dateTo/f.date` silently yields an empty map (those fields don't exist), so every member falsely shows "available". This was a real blocker in the admin scales page.

**How to apply:** When expanding a folga across a date range for availability indicators, iterate `buildDateRange(startDate, endDate)` and filter `status === "ACTIVE"`. Import the `FolgaItem` type from `@workspace/api-client-react` instead of using `any` to catch field drift at compile time.
