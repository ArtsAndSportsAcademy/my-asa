---
name: MyASA 2.0 — Estado do Projeto
description: Estado atual do produto, sprints concluídas e decisões de arquitetura duráveis
---

## Sprint atual
Sprint 19 — Insights Operacionais — **COMPLETO**

## Sprints concluídas
- Sprint 18.1 — Task Integration & Audit
- Sprint 19 — Insights Operacionais (7 endpoints + web-admin admin/supervisor pages + mobile)

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

## Sprint 18 — S-18 Tarefas Operacionais (COMPLETO)
**Objetivo:** Domínio completo de Tarefas Operacionais conforme AUD-D02.

### O que foi entregue
- **DB:** `lib/db/src/schema/tasks.ts` — 4 enums (TaskPriority, TaskStatus, TaskOrigin, TaskEvidenceType) + 3 tabelas (tasks, task_evidences, task_comments). Migração aplicada via psql.
- **API:** `artifacts/api-server/src/routes/tasks.ts` — 13 endpoints (GET /my, GET /, POST /, GET /:id, PATCH /:id, POST /:id/start, POST /:id/ready-for-approval, POST /:id/approve, POST /:id/request-changes, POST /:id/cancel, POST /:id/evidences, DELETE /:id/evidences/:evidenceId, GET /:id/comments, POST /:id/comments). Typecheck limpo.
- **OpenAPI + Codegen:** 14 operationIds + schemas completos em `lib/api-spec/openapi.yaml`. 9 hooks gerados via orval. `api-client-react` recompilado (`tsc -p tsconfig.json`) para atualizar dist/.
- **Web Admin:** `admin/tasks.tsx` + `supervisor/tasks.tsx` — tabs (Todas/Em Aberto/Ag. Aprovação/Atrasadas/Concluídas), filtros de operação/prioridade, dialog de criação com checklist, ações de aprovar/solicitar ajustes/cancelar. Sem erros TS nas novas páginas.
- **Mobile:** `(tabs)/tarefas.tsx` — lista de minhas tarefas, filtro de status, checklist interativo, ações Iniciar/Concluir/Enviar p/ Aprovação. Acessível via mais.tsx "Operacional > Tarefas".
- **Roteamento:** `admin/tasks` (ADMIN) + `supervisor/tasks` (SUPERVISOR_A/B) em App.tsx. CheckSquare em ambos os sidebars (ADMIN_NAV OPERAÇÃO e SUPERVISOR_NAV OPERAÇÃO).

### Convenções estabelecidas no Sprint 18
- Após orval codegen, SEMPRE rodar `pnpm --filter @workspace/api-client-react exec tsc -p tsconfig.json` para atualizar dist/ (project references exigem compilação).
- `useListUsers()` sem argumentos (não `useListUsers({}, {})`).
- Mutations de tasks: `approveTask({taskId})`, `requestChanges({taskId, data:{comment}})`, `cancelTask({taskId, data?:{reason}})`, `startTask({taskId})`, `submitTaskForApproval({taskId})`.
- Erros pré-existentes em home.tsx, operational-panel.tsx, requests.tsx, delegations.tsx são de sprints anteriores (hooks adicionados manualmente no passado) e não bloqueiam o S-18.

---

## Sprint 17 — Branding & Identity (COMPLETO)
**Objetivo:** Transformar o MyASA de plataforma funcional para produto com identidade própria.

### O que foi entregue
- **T001/T008:** "MyASA 2.0" já ausente; login page corrigido para "Bem-vindo ao MyASA" + "Entre com suas credenciais para continuar."
- **T002/T004:** Asinha já presente em login, sidebar, home (web + mobile). Sidebar atualizada com label de papel ("Administrador"/"Supervisor"/"Membro") abaixo de "MyASA".
- **T003:** Home por papel expandida — Admin agora mostra check-ins do dia + pendências (solicitações + livros); Supervisor idem + contador de solicitações pendentes no botão de atalho; Membro tem grade de links rápidos + avisos ativos + próximos eventos + nudge para mobile.
- **T005:** Agenda ganhou calendário (Mês/Semana/Lista) com navegação prev/next/hoje. Default: visão Mês. Calendário de mês: grade 6×7, segunda-feira primeiro, chips coloridos por tipo. Semana: 7 colunas com horário. Lista: tabela original intacta.
- **T007:** `LoadingScreen.tsx` criado (asinha pulsante no fundo roxo). `_layout.tsx` substitui `return null` por `<LoadingScreen />` durante auth loading.
- **T006/T009:** Auditoria: "MyASA 2.0" = zero ocorrências; asinha em todos os pontos principais; plataforma coesa.

### Convenções estabelecidas no Sprint 17
- Calendário de agenda usa `getWeekStart(d)` com segunda como início de semana (padrão BR).
- `useListAvisos` NÃO existe — o hook correto é `useListNotices`.
- LoadingScreen usa `Animated.loop(Sequence([timing→0.7, timing→1]))` para pulsar a asinha.

---

## Sprint GOV-D11 — Delegação Temporária de Supervisão (COMPLETO)
**Objetivo:** Supervisor delega temporariamente responsabilidades operacionais a um membro durante um período específico.

### O que foi entregue
- **DB:** `lib/db/src/schema/delegations.ts` — enum `delegationStatusEnum` + `delegationsTable` (organizationId, supervisorId, delegateId, operationId, startDate/endDate como date string, reason, status). Removido delegationsTable obsoleto de `teams.ts` que causava colisão de nomes. Aplicado via psql.
- **Permission helper:** `artifacts/api-server/src/lib/delegation-check.ts` — `isActiveDelegate(userId, operationId)` verifica delegação ativa pelo dia atual.
- **API:** 4 endpoints em `/delegations` — lista (GET), minhas ativas (GET /my-active), criar (POST, só SUPERVISOR), cancelar (PATCH /:id/cancel).
- **Route patches:** `requests.ts` (GET /pending + POST /decision), `check-ins.ts` (PATCH), `daily-book.ts` (publish + republish) — todos permitem delegate além de MANAGER_ROLES.
- **api-client-react:** 5 schemas + 4 hooks (`useListDelegations`, `useGetMyActiveDelegations`, `useCreateDelegation`, `useCancelDelegation`) adicionados manualmente.
- **Web Admin:** `supervisor/delegations.tsx` — lista de delegações, modal criar (com selects de operação + membro), confirmar cancelamento. Nav item "Delegações" adicionado ao SUPERVISOR_NAV.
- **Mobile:** Banner `DelegateBanner` em `meu-dia.tsx` — exibido quando o usuário tem delegações ativas, mostrando operação e supervisor em nome de quem age.

### Convenções estabelecidas no GOV-D11
- `isActiveDelegate` importado em rotas como `../lib/delegation-check.js` — padrão a seguir para qualquer nova rota que precise de delegate access.
- Para checar delegate em daily-book (sem operationId direto), fazer join `scalesTable` via `book.scaleId` para obter `operationId`.
- Após alterar schema em `lib/db/src/`, SEMPRE rodar `pnpm --filter @workspace/db exec tsc -p tsconfig.json` antes de typechecks dependentes.

---

## Sprint 16 — S-06: Solicitações (COMPLETO)
**Objetivo:** Transformar tabelas requests + request_decisions em superfície operacional completa (Membro cria, Supervisor decide, Admin visualiza).

### Convenções estabelecidas no Sprint 16
- `req.params as { id: string }` — SEMPRE usar cast explícito para evitar `string | string[]` (mesmo padrão do Sprint 9 `String(req.params.x)`, mas forma mais limpa).
- `UseQueryOptions` do tanstack v5 requer `queryKey` quando passado explicitamente — usar `{ ... } as any` quando só se quer `enabled` sem queryKey (já documentado em Sprint 13 linha 71, agora reforçado).
- Hooks S-06 adicionados MANUALMENTE (não via orval codegen) — mesmo padrão do Sprint 15.

---

## Sprint 15 — FC-02: Check-in Operacional (COMPLETO)

### Convenções estabelecidas
- `req.user!.organizationId` (não `orgId`) em rotas do api-server — o campo no AccessTokenPayload é `organizationId`.
- PATCH `/check-ins/:id` com id="new" → cria registro novo para o userId informado no body; com UUID real → atualiza existente.
- MANAGER_ROLES = ["ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"] definido localmente na rota (não em shared constants).

---

## Release 13.1 — Navegação por Perfil e UX Cleanup (COMPLETO)

### Convenções de navegação (web)
- Admin sidebar: usa grupos de label maiúscula sem ver rotas /supervisor/
- Supervisor sidebar: usa grupos distintos, sem ver rotas /admin/ (exceto as compartilhadas como Escalas/MeuDia/Avisos)
- home.tsx detecta role via `auth.roles.some(r => r.role === "ADMIN")`

---

## Sprint 13 — Biblioteca / S-14 (COMPLETO)

### Convenções estabelecidas no Sprint 13
- `useGetLibraryDocument(id, { query: { queryKey: getGetLibraryDocumentQueryKey(id), enabled: !!id } })` — queryKey obrigatório após rebuild do api-client-react
- Flow-style YAML `{ type: string, nullable: true }` QUEBRA o orval codegen — usar block-style sempre

---

## Sprint 12 — Entregas / S-07 (COMPLETO)

### Convenções estabelecidas no Sprint 12
- `useGetDelivery(deliveryId)` — recebe `string` direta
- `userRolesTable` NÃO tem `organizationId` — filtrar por org usando `usersTable.organizationId`

---

## Sprint 11 — Mensagens / S-09 (COMPLETO)

### Convenções estabelecidas no Sprint 11
- **`useGetMessageThread(threadId)`** — assinatura gerada recebe `string` direta (não `{ threadId }`)
- **Mobile `useAuth`** — importar de `@/contexts/AuthContext`; `AuthUser` tem campo `.id` (não `.userId`)

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
