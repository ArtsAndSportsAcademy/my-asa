---
name: MyASA 2.0 — Estado do Projeto
description: Sprint progress, architectural decisions, and key conventions for the MyASA 2.0 system
---

## Sprint 5 — Livro do Dia (concluído)
- DB: 5 tables (daily_books, _scenes, _blocks, _positions, _assignments)
- 13 API endpoints under /daily-book (all write endpoints require ADMIN|SUPERVISOR_A|SUPERVISOR_B)
- Web-admin: 3-panel layout — Panel 1 list (filters: status, event), Panel 2 Cena/Bloco/Posição tabs, Panel 3 Impacto/Alterações/Histórico/Delta tabs
- Mobile: daily-book tab (member-scoped + supervisor read-only)
- Audit log via writeDailyBookAudit() on all mutations
- Route guards: RoleRoute in App.tsx — /admin/daily-book (ADMIN+SUP_A+SUP_B), /supervisor/daily-book (SUP_A+SUP_B)

## Architecture decisions worth preserving

### Role enum values (critical)
Actual roles: "ADMIN", "SUPERVISOR_A", "SUPERVISOR_B", "MEMBER" — NOT "SUPERVISOR".
All requireRole() calls and RoleRoute checks must use the full _A/_B suffix.

### Role authorization pattern (daily-book)
All write endpoints (generate, regenerate, publish, republish, execute, cancel, assign, delete, reorder)
use `requireRole("ADMIN", "SUPERVISOR_A", "SUPERVISOR_B")`. Read endpoints (list, get, delta) are open to all authenticated org members.

### RoleRoute component (App.tsx)
Wraps wouter Route with role check: reads `auth.roles` (UserRole[]) from useAuth(), checks `.some(r => roles.includes(r.role))`. Redirects to /admin/home if authenticated but wrong role.

### computeDelta pattern
Structural soft-removal detection must compare currSnapshot.isRemoved against
prevSnapshot.isRemoved (not read isRemoved from prevSnapshot, which is always
false at publish time since snapshots are taken pre-edit). Use `Map<string, any>` for type safety.

### Terminal state guard pattern
EXECUTED and CANCELLED are terminal. All mutating endpoints (delete, reorder,
assign) must guard: `if (status === "EXECUTED" || status === "CANCELLED") return 409`.

### Scale auto-resolution in generate
Generate endpoint queries for PUBLISHED/REPUBLISHED scale with matching
agendaEventId when no explicit scaleId is provided. `inArray` from drizzle-orm already imported.

### Cancel OpenAPI contract
cancelDailyBook takes CancelDailyBookRequest { reason: string } (required).
Server enforces non-empty reason string.

### Delta endpoint response shape (GET /daily-book/:id/delta)
Returns: { version, status, hasLiveChanges, liveDelta, lastRepublishDelta }
NOT { delta, version } — OpenAPI spec and generated client reflect this.

### groupId filter in list endpoint
GET /daily-book accepts groupId as a query param. Filter implemented via subquery:
get scaleIds where scales.groupId = groupId, then filter dailyBooks.scaleId IN (scaleIds).
groupId is also declared in OpenAPI spec (added Sprint 5 end).

### Delta-before-republish UX
Republish dialog fetches live delta via useGetDailyBookDelta. Confirm button is
disabled when hasLiveChanges=false. Shows DeltaView component with all changes before confirming.
After republish, right panel auto-switches to "delta" tab.

### DailyBook Histórico tab
No `republishedAt` field on DailyBook/DailyBookWithScenes. Use `version > 1` to detect republication.
Timestamp fields that DO exist: generatedAt, publishedAt, executedAt, cancelledAt.

## Sprints anteriores
- Sprint 2: CRUD completo usuários/operações/grupos no web-admin, mobile atualizado
- Sprint 3–4: Show Book, Agenda, Escalas
