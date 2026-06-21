---
name: Folga availability pitfall
description: The non-obvious trap when building per-day availability from folgas (field names + status value)
---

# Folga availability pitfall

When building a date→user availability/indisponibilidade map from `useListFolgas`:
- Range fields are `startDate`/`endDate` — NOT `dateFrom`/`dateTo` and NOT a single `date`.
- "Currently unavailable" is `status === "ACTIVE"` — NOT `APPROVED`.

**Why:** Reading `f.dateFrom/f.dateTo/f.date` silently yields an empty map (those keys don't exist), so every member falsely shows "available". This was a real blocker in the admin scales page and member week views.

**How to apply:** Iterate `buildDateRange(startDate, endDate)` and filter `status === "ACTIVE"`. Type the items as `FolgaItem` (from `@workspace/api-client-react`) instead of `any` so field drift fails at compile time.
