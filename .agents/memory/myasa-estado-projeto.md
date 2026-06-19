---
name: MyASA 2.0 — Estado do Projeto
description: Estado atual do produto, sprints concluídas e decisões de arquitetura duráveis
---

## Sprint atual
AI-D01 — Auditoria da Inteligência Operacional — **COMPLETO** (docs/specs/AI-D01-audit.md)

## Sprints concluídas
- Sprint 18.1 — Task Integration & Audit
- Sprint 19 — Insights Operacionais (7 endpoints + web-admin + mobile)
- Sprint 20 — GOV-D11.1 Delegação por Responsabilidade Granular
- Sprint 21 — PERF-D01 Especializações Profissionais (coluna já existia)
- Sprint 22 — Estabilização Operacional (customFetch exportado, 3 páginas supervisor reescritas)
- CAP-D03 — Experiência Capitão completa (web-admin + mobile + API)
- TASK-D01 — Evidências de tarefas (EvidenceSection mobile + EvidenceViewer web-admin)
- ROADMAP-A01 — Auditoria de prontidão para piloto (relatório entregue, 6 itens 🔴 identificados)
- NAV-D01 — Ajustes de navegação e linguagem pré-piloto (todos os itens 🔴 implementados)
- AGENDA-FIX-01 — RBAC + visibilidade da Agenda (campo visibility, filtros por papel, MEMBER bloqueado)
- PILOT-FIX-01 — Correções críticas pré-piloto (Admin NAV, Mobile Mais, daily_books migration, webOnly Alert, guards de telas)
- MSG-D01 — Especificação de Comunicação v1.1 (docs/specs/MSG-D01-spec.md)
- MSG-S01 — Badge de mensagens não-lidas + Avisos CRITICAL/IMPORTANT em Meu Dia
- RESPONSIBILITIES-D01 — Schema + API + Web Admin + Mobile + Meu Dia (responsabilidades permanentes)
- AI-D01 — Auditoria completa da inteligência operacional (docs/specs/AI-D01-audit.md)

---

## NAV-D01 — O que foi feito (COMPLETO)

1. **Tabs mobile** (`_layout.tsx`): Tarefas → tab 5 principal; Entregas → hidden (secundária). NativeTabs não suporta `.Screen` — não usar; apenas `Trigger` define tabs visíveis.
2. **Solicitações** (`meu-dia.tsx`): shortcut "Minhas Solicitações" visível em Meu Dia (após CheckInCard), subtítulo "Folgas, trocas e restrições". Estilos: `quickActionRow`, `quickActionIcon`, `quickActionLabel`, `quickActionSub`.
3. **Subtítulo Livro do Dia**: "Roteiro operacional do dia" — `daily-book.tsx` mobile header + `AdminLayout` admin e supervisor web.
4. **Subtítulo Livro do Show**: "Estrutura oficial do espetáculo" — `show-book.tsx` mobile header.
5. **Mais** (`mais.tsx`): Solicitações primeiro em Operacional; Tarefas removida (agora tab); Entregas adicionada com subtitle; suporte a `subtitle?` nos itens; "Insights" → "Indicadores".
6. **Capitão DAILY_BOOK mobile** (`daily-book.tsx`): `visibleBooks` inclui livros DRAFT para capitão; botão Publicar (verde) para DRAFT, Republicar (azul) para PUBLISHED; `usePublishDailyBook` / `useRepublishDailyBook` usam `{ id: string }`.
7. **Capitão webOnly alerts** (`meu-dia.tsx`): mensagem inclui "Acesse o web admin pelo navegador do seu celular ou computador."
8. **Linguagem web admin** (`admin-layout.tsx`): "Entre Supervisores" → "Aprovações entre Supervisores"; "Insights" → "Indicadores" (GOVERNANÇA admin + CONTROLE supervisor).

### Cuidados técnicos NAV-D01
- `usePublishDailyBook` / `useRepublishDailyBook` esperam `{ id: string }` (não `dailyBookId`).
- Handlers que usam `refetchBook` devem ser declarados APÓS `useGetDailyBook` na ordem do componente (regra de hoisting dos hooks).
- Erros pré-existentes em meu-dia.tsx (`useGetMyCheckInStatus`) e solicitacoes.tsx (`useCreateRequest`) não pertencem ao NAV-D01.

---

## CAP-D03 — Experiência Capitão (COMPLETO)

**Regra central:** MEMBER + delegação ativa = Capitão. Sem nova role, sem novas tabelas.

### O que foi entregue
- **`App.tsx` (web-admin):** `RoleRoute` checa `useGetMyActiveDelegations`; acesso a `/supervisor/*` é concedido dinamicamente se o MEMBER tiver a responsabilidade correspondente. Mapa `ROUTE_RESPONSIBILITY`: `/supervisor/check-ins→CHECK_INS`, `/supervisor/requests→REQUESTS`, `/supervisor/tasks→TASK_APPROVALS`, `/supervisor/daily-book→DAILY_BOOK`, `/supervisor/avisos→NOTICES`, `/admin/scales→SCALES`, `/supervisor/messages→OPERATIONAL_MESSAGES`.
- **`admin-layout.tsx` (web-admin):** seção CAPITÃO construída dinamicamente com responsabilidades ativas; `roleLabel` mostra "Capitão".
- **`meu-dia.tsx` (mobile):** `DelegateBanner` com botões acionáveis por responsabilidade — mobile navega direto para a tab; CHECK_INS e SCALES mostram Alert "disponível no Web Admin".
- **`avisos.tsx` (mobile):** botão "Novo Aviso" visível apenas se tem delegação NOTICES.
- **`solicitacoes.tsx` (mobile):** tab "Para Decidir" com contador.
- **`tarefas.tsx` (mobile):** tab "Para Aprovar" com contador.
- **`daily-book.tsx` (mobile):** banner "Modo Capitão" + botões de publicação (NAV-D01).
- **`delegations.ts` (API):** aviso automático (fire-and-forget) ao Capitão delegado após criação.
- **`delegations-manual.ts`:** hooks `useListDelegations` e `useGetMyActiveDelegations` — usar `{ query: { ... } as any }` nos call sites.

### Convenções CAP-D03
- `useGetMyActiveDelegations` — hook sem parâmetros obrigatórios; usar `{ query: { ... } as any }` nos call sites.
- `useDecideRequest` aceita `{ decision: "APPROVED"|"DENIED" }` (não `status`).

---

## Sprint 20 — GOV-D11.1 Delegação por Responsabilidade Granular (COMPLETO)

- Schema Drizzle de delegações usa nomes de colunas reais (`delegatorId`, `delegateeId`, `validFrom`, `validUntil`, `revokedAt`).
- Status computado em runtime (PENDING/ACTIVE/EXPIRED/CANCELLED) — não armazenado.
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
