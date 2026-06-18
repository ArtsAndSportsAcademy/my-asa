---
name: MyASA 2.0 — Estado do Projeto
description: Sprint progress, architectural decisions, and key conventions for the MyASA 2.0 system
---

## Sprint 16 — S-06: Solicitações (COMPLETO)
**Objetivo:** Transformar tabelas requests + request_decisions em superfície operacional completa (Membro cria, Supervisor decide, Admin visualiza).

### O que foi entregue
- **API:** 6 endpoints em `/requests` — lista (admin/supervisor), pendentes (supervisor), detalhe, criar (membro), patch alternativa (membro), decisão (supervisor). writeHistoryEvent em todas as transições de estado.
- **api-client-react:** 7 schemas S-06 + 6 hooks (`useListRequests`, `useListPendingRequests`, `useGetRequest`, `useCreateRequest`, `useUpdateRequest`, `useDecideRequest`) adicionados manualmente ao api.schemas.ts e api.ts.
- **Mobile:** `solicitacoes.tsx` — lista com filtro de status, modal criar, aceitar/rejeitar alternativa.
- **Web Admin:** `supervisor/requests.tsx` — selector de operação, abas de filtro, modal de decisão. `admin/requests.tsx` — visão global somente leitura.
- **Meu Dia:** query expandida para incluir resolvidas nos últimos 7 dias; badge dinâmico por status; link "Ver todas" → solicitacoes; hint azul para ALTERNATIVE_PROPOSED.

### Convenções estabelecidas no Sprint 16
- `req.params as { id: string }` — SEMPRE usar cast explícito para evitar `string | string[]` (mesmo padrão do Sprint 9 `String(req.params.x)`, mas forma mais limpa).
- `UseQueryOptions` do tanstack v5 requer `queryKey` quando passado explicitamente — usar `{ ... } as any` quando só se quer `enabled` sem queryKey (já documentado em Sprint 13 linha 71, agora reforçado).
- Hooks S-06 adicionados MANUALMENTE (não via orval codegen) — mesmo padrão do Sprint 15.

---

## Sprint 15 — FC-02: Check-in Operacional (COMPLETO)
**Objetivo:** Fechar a lacuna entre quem deveria estar (Escala) e quem chegou (Check-in). Sem IA, geolocalização, biometria ou QR Code.

### O que foi entregue
- **DB:** `lib/db/src/schema/checkin.ts` — enum `checkInStatusEnum` + tabela `operational_check_ins`. Aplicado via psql.
- **API:** 5 endpoints em `/check-ins` — lista do dia, resumo de totais, status do membro, check-in próprio (1 toque), correção pelo supervisor (id="new" cria, id real atualiza).
- **api-client-react:** 5 hooks: `useListCheckIns`, `useGetCheckInSummary`, `useGetMyCheckInStatus`, `usePerformMyCheckIn`, `useUpdateCheckIn`.
- **Web Admin (admin + supervisor):** Seção "Check-ins do Dia" no Painel Operacional — pills de resumo + lista com botões de ação rápida (✓/⏰/✗).
- **Mobile:** `CheckInCard` no topo de `meu-dia.tsx` — 1 toque para check-in quando EXPECTED; mostra horário quando CHECKED_IN/LATE.

### Convenções estabelecidas
- `req.user!.organizationId` (não `orgId`) em rotas do api-server — o campo no AccessTokenPayload é `organizationId`.
- PATCH `/check-ins/:id` com id="new" → cria registro novo para o userId informado no body; com UUID real → atualiza existente.
- MANAGER_ROLES = ["ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"] definido localmente na rota (não em shared constants).

---

## Release 13.1 — Navegação por Perfil e UX Cleanup (COMPLETO)
**Objetivo:** Reorganizar experiência por papel (Admin / Supervisor / Membro) sem novas entidades, APIs ou regras de negócio.

### Tarefas concluídas
- **T1 & T2:** Design System constants centralizados — `web-admin/src/lib/operational-constants.ts` e `mobile/lib/operational-constants.ts`
- **T3:** admin-layout.tsx com sidebar por papel e grupos (Admin: PAINÉIS|ORGANIZAÇÃO|CONHECIMENTO|PLANEJAMENTO|GOVERNANÇA; Supervisor: OPERAÇÃO|PLANEJAMENTO|COMUNICAÇÃO|CONHECIMENTO|CONTROLE)
- **T4:** home.tsx role-aware dentro do AdminLayout (Admin: Saúde+Ops; Supervisor: Exceções+Eventos; Membro: simplificado)
- **T5:** Mobile `_layout.tsx` com 5 tabs principais + Mais; rotas secundárias preservadas mas ocultas do tab bar
- **T6:** Mobile `mais.tsx` — tela de navegação secundária (Biblioteca, Agenda, Histórico, Livro do Show, Home)
- **T7:** Cross-surface links — Escalas→LivroDoDia, LivroDoDia(supervisor)→Avisos, Operação↔Grupos (dropdown), ShowBook→Biblioteca(placeholder)
- **T8:** Constantes centralizadas aplicadas em operational-panel(admin+supervisor), meu-dia(web), panel/scale/meu-dia(mobile) — sem duplicação

### Convenções de navegação (web)
- Admin sidebar: usa grupos de label maiúscula sem ver rotas /supervisor/
- Supervisor sidebar: usa grupos distintos, sem ver rotas /admin/ (exceto as compartilhadas como Escalas/MeuDia/Avisos)
- home.tsx detecta role via `auth.roles.some(r => r.role === "ADMIN")`

### Constantes: o que ficou centralizado vs local
- **Centralizado (web):** HEALTH_CONFIG, EVENT_TYPE_LABELS, EVENT_TYPE_BADGES, EXCEPTION_TYPE_LABELS, EXCEPTION_TYPE_BADGES, SCALE_STATUS_LABELS, DOC_STATUS_LABELS, ALLOCATION_STATUS_LABELS
- **Local (web):** ícones Lucide (não ficam em módulo compartilhado), COVERAGE_LABELS, ALLOCATION_STATUS_COLORS (TailwindCSS), status labels de daily-book (REPUBLISHED/EXECUTED/CANCELLED — não mapeiam para centralizados)
- **Centralizado (mobile):** HEALTH_ICON, HEALTH_LABEL, EVENT_TYPE_LABELS, EVENT_TYPE_ICONS, ALLOCATION_STATUS_LABELS, ALLOCATION_STATUS_COLORS, SCALE_STATUS_LABELS, EXCEPTION_TYPE_LABELS, REQUEST_TYPE_LABELS, REQUEST_STATUS_LABELS
- **Local (mobile):** REQUEST_TYPE_LABELS em meu-dia.tsx tem chaves distintas (LEAVE, ROLE_RESTRICTION) — NÃO substituir pelo centralizado

### admin/operational-panel.tsx — padrão HEALTH_ICONS separado
O HEALTH_CONFIG centralizado NÃO contém ícones Lucide. Páginas que precisam de ícone devem declarar:
```ts
const HEALTH_ICONS = { HEALTHY: CheckCircle2, ATTENTION: AlertCircle, RISK: AlertTriangle, CRITICAL: XCircle } as const;
const Icon = HEALTH_ICONS[health.status as keyof typeof HEALTH_ICONS] ?? HEALTH_ICONS.ATTENTION;
```

### supervisor/operational-panel.tsx — `borderL` não `border`
O banner de saúde usa `border-l-4` → usar `cfg.borderL` (não `cfg.border`) do HEALTH_CONFIG centralizado.

---

## Sprint 13 — Biblioteca / S-14 (COMPLETO)
**Objetivo:** Fonte oficial de conhecimento da organização — "Qual é a referência oficial?"
NÃO é Google Drive. NÃO é chat. NÃO é aviso. NÃO é entrega.

### Princípio Fundador
- Biblioteca = conhecimento permanente, documentação operacional, onboarding, procedimentos oficiais
- Entrega referencia documento da Biblioteca — Biblioteca permanece fonte única (sem duplicação)
- FC-01 (Livro do Show Bíblia) poderá referenciar Biblioteca futuramente sem duplicar conteúdo
- FC-03 (Insights da Biblioteca) NÃO implementado nesta sprint

### Convenções estabelecidas no Sprint 13
- `useGetLibraryDocument(id, { query: { queryKey: getGetLibraryDocumentQueryKey(id), enabled: !!id } })` — queryKey obrigatório após rebuild do api-client-react
- Flow-style YAML `{ type: string, nullable: true }` QUEBRA o orval codegen — usar block-style sempre
- useGetDelivery não exige queryKey explícito (dist antigo); useGetLibraryDocument sim (dist novo) — para consistência futura, SEMPRE passar queryKey explicitamente

---

## Sprint 12 — Entregas / S-07 (COMPLETO)
**Objetivo:** Sistema de confirmação obrigatória de conteúdo — "Quem recebeu, visualizou e confirmou?"

### Decisões (respeitar em sprints futuros)
- VISUALIZADA ≠ CONCLUÍDA (estados distintos)
- ATRASADA ≠ EXPIRADA (estados distintos)
- S-18 Tarefas Operacionais poderá existir futuramente sem conflito com S-07
- Entrega referencia conteúdo (contentRef), NÃO duplica conteúdo — Biblioteca será fonte única

### Convenções estabelecidas no Sprint 12
- `useGetDelivery(deliveryId)` — recebe `string` direta
- `getGetDeliveryQueryKey(deliveryId)` — idem
- Checklist auto-salva via `useUpdateDeliveryChecklist` a cada toggle; conclusão requer todos os itens marcados
- `userRolesTable` NÃO tem `organizationId` — filtrar por org usando `usersTable.organizationId`

---

## Sprint 11 — Mensagens / S-09 (COMPLETO)

### Convenções estabelecidas no Sprint 11
- **`useGetMessageThread(threadId)`** — assinatura gerada recebe `string` direta (não `{ threadId }`)
- **`getGetMessageThreadQueryKey(threadId)`** — idem, `string` direta
- **Mobile `useAuth`** — importar de `@/contexts/AuthContext`; `AuthUser` tem campo `.id` (não `.userId`)

---

## Sprint 10 — Histórico / S-11 (COMPLETO)

### Convenções estabelecidas no Sprint 10
- **`HistoryNarrativeStatus` cast:** `v as HistoryNarrativeStatus` nos Selects.
- **`AdminLayout` exige `title` prop** — sempre fornecer.
- **FC-01/FC-02/FC-03/FC-04** (IA + Biblioteca): NÃO implementar ainda.

---

## Sprint 9 — Avisos / S-08 (COMPLETO)

### Convenções estabelecidas no Sprint 9
- **Convenção (TS7030):** Express async handlers devem ter tipo `: Promise<void>` explícito.
- **Convenção (req.params):** Usar `String(req.params.noticeId)` para evitar `string | string[]`.
- **Convenção (drizzle .set spread):** usar `const updates: Record<string, unknown> = {}` + `.set(updates as any)`.
- **Convenção (useGetNotice enabled):** passar `queryKey: getGetNoticeQueryKey(id)` junto com `enabled`.
- **Convenção (edit dialog):** Flag `editFormReady` + useEffect para popular form.

## Sprint 7 — Painel Operacional (COMPLETO)
- Backend: `GET /operational-panel` — consolida agenda/escalas/alocações/exceções/livros.
- **Convenção:** `refetchInterval` não funciona no orval gerado — usar botão manual.
- **Convenção:** showBookRolesTable só tem `id` e `name`.

## Sprint 6 — Padronização Visual Oficial (concluído)
- Primary: #7C3AED (violet), gradiente from #7C3AED to #2563EB. Background: #F5F5F7.

## Sprint 5 — Livro do Dia (concluído)
- 5 tables, 13 endpoints /daily-book. Web-admin + Mobile.

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

Itens validados por usuários reais documentados em `.local/roadmap/feedback-campo-001.md`.

### feedback-campo-001 — 4 itens identificados
1. **Livro do Show como Bíblia Operacional** — expandir S-13 com anotações operacionais, alertas recorrentes e histórico versionado; sem nova rota.
2. **Check-in Operacional** — registro de presença por Supervisor no dia do evento; vinculado à Escala; dados individuais não expostos publicamente.
3. **Insights da Biblioteca** — dashboards agregados; nova superfície `/admin/insights`; somente Admin/Supervisor.
4. **Google Calendar** — iniciar por exportação iCal (sem OAuth); OAuth Google em ciclo posterior.

**Ordem sugerida:** Google Calendar (iCal) → Check-in → Livro Show Bíblia → Insights.
**Restrição transversal:** nunca expor dados individuais de desempenho a outros membros.

## Sprints anteriores
- Sprint 2: CRUD completo usuários/operações/grupos no web-admin, mobile atualizado
- Sprint 3–4: Show Book, Agenda, Escalas
