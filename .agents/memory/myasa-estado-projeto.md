---
name: MyASA 2.0 — Estado do Projeto
description: Sprint progress, architectural decisions, and key conventions for the MyASA 2.0 system
---

## Sprint 7 — Painel Operacional (COMPLETO)
**Objetivo:** "O que exige minha atenção neste momento?" para Supervisores.
- Backend: `GET /operational-panel` em operational-panel.ts — consolida agenda/escalas/alocações/exceções/livros, computa HEALTHY/ATTENTION/RISK/CRITICAL, cobertura geral+grupo+evento.
- LOG_DOMAIN.OPERATIONAL_PANEL adicionado em lib/shared/src/constants.ts.
- 9 schemas OpenAPI; codegen + api-client-react rebuild concluídos.
- Web Admin: `/admin/operational-panel` (grid saúde/cobertura/exceções + tabs cobertura detalhada) e `/supervisor/operational-panel` (foco em ação imediata, alertas 48h). Nav registrado em admin-layout.tsx.
- Mobile: Tab "Painel" (`app/(tabs)/panel.tsx`) com pull-to-refresh. Registrado em NativeTabLayout + ClassicTabLayout.
- **Convenção:** `refetchInterval` não funciona em `query: { refetchInterval }` no orval gerado (exige `queryKey`). Usar botão manual ou useEffect separado.
- **Convenção:** showBookRolesTable só tem `id` e `name` — sem campo `label` (esse existe em showBookTagsTable).

## Sprint 6 — Padronização Visual Oficial (concluído)
- Paleta oficial MyASA aplicada em todas as superfícies Web e Mobile
- Primary: #7C3AED (violet), gradiente from #7C3AED to #2563EB
- Background: #F5F5F7, Cards: #FFFFFF, Texto: #111827, Muted: #6B7280, Borda: #E5E7EB
- Semânticos mantidos: verde #22C55E, âmbar #F59E0B, vermelho #EF4444
- Web: index.css reescrito com novos CSS custom properties; login hero usa .bg-myasa-gradient
- Mobile: constants/colors.ts atualizado — primary #7C3AED, tint #7C3AED, background #F5F5F7
- agenda.tsx: OPERATIONAL_BLOCK bg-orange → bg-indigo; daily-book.tsx: text-orange → text-violet
- Amber semântico preservado onde representa atenção/pendente (escala, daily-book)
- TypeScript: api-client-react recompilado após Sprint 5 merge; web-admin + mobile typechecks limpos

## Sprint 5 — Livro do Dia (concluído)
- DB: 5 tables (daily_books, _scenes, _blocks, _positions, _assignments)
- 13 API endpoints under /daily-book (all write endpoints require ADMIN|SUPERVISOR_A|SUPERVISOR_B)
- Web-admin: 3-panel layout — Panel 1 list (filters: status, event), Panel 2 Cena/Bloco/Posição tabs, Panel 3 Impacto/Alterações/Histórico/Delta tabs
- Mobile: daily-book tab (member-scoped + supervisor read-only)
- Audit log via writeDailyBookAudit() on all mutations
- Route guards: RoleRoute in App.tsx — /admin/daily-book (ADMIN+SUP_A+SUP_B), /supervisor/daily-book (SUP_A+SUP_B)

## Architecture decisions worth preserving

### Visual Identity — MyASA Official Palette
Primary = #7C3AED (violet), gradient = linear-gradient(135deg, #7C3AED 0%, #2563EB 100%).
Available via CSS utility `.bg-myasa-gradient` and `.text-myasa-gradient` in index.css.
Never use orange/copper as brand color. Amber (#F59E0B) only for semantic attention states.

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

### api-client-react rebuild after codegen
After running codegen, always run `pnpm --filter @workspace/api-client-react exec tsc -p tsconfig.json`
to update dist/. Without this, web-admin/mobile see stale type exports even though src is correct.

## Sprints anteriores
- Sprint 2: CRUD completo usuários/operações/grupos no web-admin, mobile atualizado
- Sprint 3–4: Show Book, Agenda, Escalas
