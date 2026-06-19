---
name: MyASA 2.0 — Estado do Projeto
description: Estado atual do produto, sprints concluídas e decisões de arquitetura duráveis
---

## Sprint atual
Sprint 20 — GOV-D11.1 Delegação por Responsabilidade — **COMPLETO**

## Sprints concluídas
- Sprint 18.1 — Task Integration & Audit
- Sprint 19 — Insights Operacionais (7 endpoints + web-admin admin/supervisor pages + mobile)
- Sprint 20 — GOV-D11.1 Delegação por Responsabilidade Granular

---

## Sprint 20 — GOV-D11.1 Delegação por Responsabilidade Granular (COMPLETO)
**Objetivo:** Transformar Delegações em sistema de responsabilidades operacionais granulares.

**Regra oficial**: Supervisor = papel permanente. Capitão = MEMBER + responsabilidades delegadas (sem novo papel).

### O que foi entregue
- **DB:** colunas `responsibilities TEXT[] NOT NULL DEFAULT '{}'` e `reason TEXT` adicionadas à tabela `delegations` via psql. Schema Drizzle completamente reescrito com nomes reais do banco.
- **Schema Drizzle** (`lib/db/src/schema/delegations.ts`): campos `delegatorId`, `delegateeId`, `validFrom`, `validUntil`, `revokedAt`; tipo `DelegatedResponsibility` exportado; `ALL_RESPONSIBILITIES` constante.
- **`delegation-check.ts`**: `isActiveDelegate` mantido; novo `hasActiveResponsibility(userId, opId, responsibility)` com filtro granular por responsabilidade. Status computado em runtime (PENDING/ACTIVE/EXPIRED/CANCELLED) — não armazenado.
- **`delegations.ts`** (API route): 4 endpoints totalmente reescritos com nomes corretos; POST valida `responsibilities[]` obrigatório; GET e /my-active retornam responsibilities.
- **Permissões granulares por rota:**
  - `check-ins.ts` → `hasActiveResponsibility(..., "CHECK_INS")`
  - `requests.ts` → `hasActiveResponsibility(..., "REQUESTS")`
  - `tasks.ts` helper `canManageTasks` → `hasActiveResponsibility(..., "TASK_APPROVALS")`
  - `daily-book.ts` publish/republish → `hasActiveResponsibility(..., "DAILY_BOOK")`
  - `notices.ts` POST /notices → guard com `hasActiveResponsibility(..., "NOTICES")`
  - `scales.ts` PATCH/:id, POST publish/republish → guard com `hasActiveResponsibility(..., "SCALES")`
- **`delegations-manual.ts`**: tipos `DelegatedResponsibility`, `ActiveDelegationItem`, `CreateDelegationInput` com responsibilities; constantes `ALL_RESPONSIBILITIES`, `RESPONSIBILITY_LABELS` exportadas de `@workspace/api-client-react`.
- **Web Admin** `supervisor/delegations.tsx`: multi-select checkboxes no modal, chips na tabela, linha expandível com grid ✓/✗ de todas as responsabilidades.
- **Mobile** `meu-dia.tsx` DelegateBanner: chips coloridos por responsabilidade delegada + período da delegação.

### Convenções estabelecidas no Sprint 20
- Schema Drizzle de delegações usa nomes de colunas reais do banco (`delegatorId`, `delegateeId`, `validFrom`, `validUntil`, `revokedAt`) — o schema antigo usava (`supervisorId`, `delegateId`, `startDate`, `endDate`, `status`).
- Status da delegação é SEMPRE computado em runtime: `revokedAt !== null` → CANCELLED; `validUntil < now` → EXPIRED; `validFrom <= now` → ACTIVE; else PENDING. Não armazenado no banco.
- Após alterar `lib/db/src/schema/`, rodar `pnpm --filter @workspace/db exec tsc -p tsconfig.json` ANTES dos typechecks dos pacotes dependentes.
- `RESPONSIBILITY_LABELS` e `ALL_RESPONSIBILITIES` vivem em `delegations-manual.ts` (não em gerado pelo orval).
- Erros pré-existentes **não do Sprint 20** a ignorar: `operations.tsx` (lateThresholdMinutes/timezone), mobile check-ins/requests-manual hooks antigos.

---

## Decisões duráveis Sprint 19

### Padrão de filtro por org nas rotas de insights
- `tasksTable` tem `organizationId` — admin usa `eq(tasksTable.organizationId, user.organizationId)`
- `requestsTable`, `operationalCheckInsTable`, `noticesTable` **não** têm `organizationId` — filtrar via `inArray(table.operationId, orgOpIds)`
- `libraryCategoriesTable` e `libraryDocumentsTable` usam `orgId` (não `organizationId`!)
- `operationsTable.organizationId` existe para join org→operações

### `inArray` com enums drizzle — usar `as const`
Arrays de status passados ao `inArray()` precisam ser `as const` para satisfazer o tipo de enum.
```ts
const ACTIVE = ["CREATED", "IN_PROGRESS"] as const;
inArray(tasksTable.status, ACTIVE)  // OK
```

### Enums de status (referência rápida)
- Check-ins: EXPECTED, CHECKED_IN, LATE, ABSENT, EXCUSED
- Tasks: CREATED, IN_PROGRESS, READY_FOR_APPROVAL, CHANGES_REQUESTED, APPROVED, COMPLETED, CANCELLED, EXPIRED
- Requests: PENDING, APPROVED, DENIED, ALTERNATIVE_PROPOSED, ALTERNATIVE_ACCEPTED, ALTERNATIVE_REJECTED, EXPIRED
- Notice recipients: PENDING, VIEWED, CONFIRMED, ESCALATED
- Library docs: DRAFT, PUBLISHED, UPDATED, ARCHIVED

---

## Sprint GOV-D11 — Delegação Temporária de Supervisão (base, COMPLETO)
**Nota:** Expandido e corrigido pelo Sprint 20. Os nomes de colunas do banco (`delegatorId` etc.) invalidaram o schema antigo.

### Convenções estabelecidas no GOV-D11 (ainda válidas)
- Para checar delegate em daily-book (sem operationId direto), fazer join `scalesTable` via `book.scaleId` para obter `operationId`.
- MANAGER_ROLES = ["ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"] definido localmente em cada rota.

---

## Sprint 18 — S-18 Tarefas Operacionais (COMPLETO)

### Convenções estabelecidas no Sprint 18
- Após orval codegen, SEMPRE rodar `pnpm --filter @workspace/api-client-react exec tsc -p tsconfig.json` para atualizar dist/ (project references exigem compilação).
- `useListUsers()` sem argumentos (não `useListUsers({}, {})`).
- Mutations de tasks: `approveTask({taskId})`, `requestChanges({taskId, data:{comment}})`, `cancelTask({taskId, data?:{reason}})`, `startTask({taskId})`, `submitTaskForApproval({taskId})`.

---

## Sprint 17 — Branding & Identity (COMPLETO)

### Convenções estabelecidas no Sprint 17
- Calendário de agenda usa `getWeekStart(d)` com segunda como início de semana (padrão BR).
- `useListAvisos` NÃO existe — o hook correto é `useListNotices`.
- LoadingScreen usa `Animated.loop(Sequence([timing→0.7, timing→1]))` para pulsar a asinha.

---

## Architecture decisions worth preserving

### Visual Identity — MyASA Official Palette
Primary = #7C3AED (violet), gradient = linear-gradient(135deg, #7C3AED 0%, #2563EB 100%).
CSS utilities `.bg-myasa-gradient` e `.text-myasa-gradient` em index.css.

### Role enum values (critical)
Actual roles: "ADMIN", "SUPERVISOR_A", "SUPERVISOR_B", "MEMBER" — NOT "SUPERVISOR".

### api-client-react rebuild after codegen
After running codegen, always run `pnpm --filter @workspace/api-client-react exec tsc -p tsconfig.json`
to update dist/. Without this, web-admin/mobile see stale type exports even though src is correct.

### drizzle-kit push
ALWAYS fails without TTY — apply schema changes manually via psql. post-merge.sh skips drizzle push.

### Vite Fast Refresh
Never mix components + non-components in the same file (causes "hooks called outside component" warning).

## Roadmap / Feedback de Campo

### feedback-campo-001 — 4 itens identificados
1. **Livro do Show como Bíblia Operacional** — expandir S-13 com anotações operacionais, alertas recorrentes e histórico versionado; sem nova rota.
2. **Check-in Operacional** — registro de presença por Supervisor no dia do evento; vinculado à Escala; dados individuais não expostos publicamente.
3. **Insights da Biblioteca** — dashboards agregados; nova superfície `/admin/insights`; somente Admin/Supervisor. ✅ IMPLEMENTADO Sprint 19
4. **Google Calendar** — iniciar por exportação iCal (sem OAuth); OAuth Google em ciclo posterior.

## Sprints anteriores
- Sprint 2: CRUD completo usuários/operações/grupos no web-admin, mobile atualizado
- Sprint 3–4: Show Book, Agenda, Escalas
- Sprint 5: Livro do Dia — 5 tables, 13 endpoints /daily-book
- Sprint 6: Padronização Visual Oficial
- Sprint 7: Painel Operacional
- Sprint 11: Mensagens / S-09
- Sprint 12: Entregas / S-07
- Sprint 13: Biblioteca / S-14
- Sprint 16: Solicitações / S-06
