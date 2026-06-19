---
name: MyASA 2.0 — Estado do Projeto
description: Estado atual do produto, sprints concluídas e decisões de arquitetura duráveis
---

## Sprint atual
CAP-D03 — Experiência Capitão (MEMBER + delegações ativas) — **COMPLETO**

## Sprints concluídas
- Sprint 18.1 — Task Integration & Audit
- Sprint 19 — Insights Operacionais (7 endpoints + web-admin + mobile)
- Sprint 20 — GOV-D11.1 Delegação por Responsabilidade Granular
- Sprint 21 — PERF-D01 Especializações Profissionais (coluna já existia)
- Sprint 22 — Estabilização Operacional (customFetch exportado, 3 páginas supervisor reescritas)
- CAP-D03 — Experiência Capitão completa (web-admin + mobile + API)

---

## CAP-D03 — Experiência Capitão (COMPLETO)

**Regra central:** MEMBER + delegação ativa = Capitão. Sem nova role, sem novas tabelas.

### O que foi entregue
- **`App.tsx` (web-admin):** `RoleRoute` checa `useGetMyActiveDelegations`; acesso a `/supervisor/*` é concedido dinamicamente se o MEMBER tiver a responsabilidade correspondente. Mapa `ROUTE_RESPONSIBILITY`: `/supervisor/check-ins→CHECK_INS`, `/supervisor/requests→REQUESTS`, `/supervisor/tasks→TASK_APPROVALS`, `/supervisor/daily-book→DAILY_BOOK`, `/supervisor/avisos→NOTICES`, `/admin/scales→SCALES`, `/supervisor/messages→OPERATIONAL_MESSAGES`.
- **`admin-layout.tsx` (web-admin):** seção CAPITÃO construída dinamicamente com responsabilidades ativas; `roleLabel` mostra "Capitão".
- **`meu-dia.tsx` (mobile):** `DelegateBanner` com botões acionáveis por responsabilidade — mobile navega direto para a tab; CHECK_INS e SCALES mostram Alert "disponível no Web Admin".
- **`avisos.tsx` (mobile):** botão "Novo Aviso" visível apenas se tem delegação NOTICES; modal sheet com urgência + título + conteúdo; cria + publica imediatamente via `useCreateNotice` + `usePublishNotice`.
- **`solicitacoes.tsx` (mobile):** tab "Para Decidir" com contador; lista solicitações pendentes via `useListPendingRequests`; botões Aprovar/Negar com confirmação via `useDecideRequest({decision: "APPROVED"|"DENIED"})`.
- **`tarefas.tsx` (mobile):** tab "Para Aprovar" com contador; lista via `useListTasks({status: "READY_FOR_APPROVAL"})`; botão Aprovar via `useApproveTask`.
- **`daily-book.tsx` (mobile):** banner "Modo Capitão" + subtítulo dinâmico quando tem delegação DAILY_BOOK.
- **`messages.ts` (API):** helper `hasOperationalMessagesDelegation`; MEMBER com OPERATIONAL_MESSAGES pode criar threads para qualquer role e encerrar conversas.
- **`delegations.ts` (API):** aviso automático (fire-and-forget) ao Capitão delegado após criação de delegação — cria aviso + publica via `noticesTable` + `noticeRecipientsTable`.
- **`delegations-manual.ts`:** hooks `useListDelegations` e `useGetMyActiveDelegations` tipados com `Omit<UseQueryOptions, "queryKey"|"queryFn">` para evitar TS2741; call sites usam `as any` para compatibilidade.

### Convenções CAP-D03
- `useGetMyActiveDelegations` — hook sem parâmetros obrigatórios; usar `{ query: { ... } as any }` nos call sites para evitar erro TS2741 de queryKey.
- `useDecideRequest` aceita `{ decision: "APPROVED"|"DENIED" }` (não `status`).
- O aviso automático de delegação é fire-and-forget dentro de IIFE async — não bloqueia a resposta da criação.
- `useListTasks({status: "READY_FOR_APPROVAL"})` pode retornar 403 para MEMBER sem TASK_APPROVALS ativo (normal — backend valida).

---

## Sprint 20 — GOV-D11.1 Delegação por Responsabilidade Granular (COMPLETO)

**Regra oficial**: Supervisor = papel permanente. Capitão = MEMBER + responsabilidades delegadas (sem novo papel).

### Convenções estabelecidas no Sprint 20
- Schema Drizzle de delegações usa nomes de colunas reais do banco (`delegatorId`, `delegateeId`, `validFrom`, `validUntil`, `revokedAt`).
- Status da delegação é SEMPRE computado em runtime (PENDING/ACTIVE/EXPIRED/CANCELLED) — não armazenado.
- Após alterar `lib/db/src/schema/`, rodar `pnpm --filter @workspace/db exec tsc -p tsconfig.json` ANTES dos typechecks dos pacotes dependentes.
- `RESPONSIBILITY_LABELS` e `ALL_RESPONSIBILITIES` vivem em `delegations-manual.ts`.

---

## Decisões duráveis Sprint 19

### Padrão de filtro por org nas rotas de insights
- `tasksTable` tem `organizationId` — admin usa `eq(tasksTable.organizationId, user.organizationId)`
- `requestsTable`, `operationalCheckInsTable`, `noticesTable` **não** têm `organizationId` — filtrar via `inArray(table.operationId, orgOpIds)`
- `libraryCategoriesTable` e `libraryDocumentsTable` usam `orgId` (não `organizationId`!)

### `inArray` com enums drizzle — usar `as const`
```ts
const ACTIVE = ["CREATED", "IN_PROGRESS"] as const;
inArray(tasksTable.status, ACTIVE)
```

### Enums de status (referência rápida)
- Check-ins: EXPECTED, CHECKED_IN, LATE, ABSENT, EXCUSED
- Tasks: CREATED, IN_PROGRESS, READY_FOR_APPROVAL, CHANGES_REQUESTED, APPROVED, COMPLETED, CANCELLED, EXPIRED
- Requests: PENDING, APPROVED, DENIED, ALTERNATIVE_PROPOSED, ALTERNATIVE_ACCEPTED, ALTERNATIVE_REJECTED, EXPIRED
- Notice recipients: PENDING, VIEWED, CONFIRMED, ESCALATED

---

## Architecture decisions worth preserving

### Visual Identity — MyASA Official Palette
Primary = #7C3AED (violet), gradient = linear-gradient(135deg, #7C3AED 0%, #2563EB 100%).

### Role enum values (critical)
Actual roles: "ADMIN", "SUPERVISOR_A", "SUPERVISOR_B", "MEMBER" — NOT "SUPERVISOR".

### api-client-react rebuild after codegen
After running codegen, always run `pnpm --filter @workspace/api-client-react exec tsc -p tsconfig.json`
to update dist/. Without this, web-admin/mobile see stale type exports.

### drizzle-kit push
ALWAYS fails without TTY — apply schema changes manually via psql. post-merge.sh skips drizzle push.

### Vite Fast Refresh
Never mix components + non-components in the same file.

## Roadmap / Feedback de Campo

1. **Livro do Show como Bíblia Operacional** — expandir S-13 com anotações, alertas recorrentes e histórico versionado.
2. **Check-in Operacional** — registro de presença por Supervisor no dia do evento.
3. **Insights da Biblioteca** — dashboards agregados. ✅ Sprint 19
4. **Google Calendar** — iniciar por exportação iCal.

## Sprints anteriores
- Sprint 2: CRUD completo usuários/operações/grupos
- Sprint 3–4: Show Book, Agenda, Escalas
- Sprint 5: Livro do Dia — 5 tables, 13 endpoints
- Sprint 6: Padronização Visual Oficial
- Sprint 7: Painel Operacional
- Sprint 11: Mensagens / S-09
- Sprint 12: Entregas / S-07
- Sprint 13: Biblioteca / S-14
- Sprint 16: Solicitações / S-06
