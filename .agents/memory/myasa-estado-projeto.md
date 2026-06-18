---
name: MyASA 2.0 — Estado do Projeto
description: Sprint progress, architectural decisions, and key conventions for the MyASA 2.0 system
---

## Sprint 11 — Mensagens / S-09 (COMPLETO)
**Objetivo:** Canal oficial de coordenação operacional — "Como as pessoas se coordenam sem sair do sistema?"

### Decisões de design (respeitar em sprints futuros)
- **MSG-D03:** MEMBER → MEMBER bloqueado (API retorna 403)
- **MSG-D04:** Mensagens imutáveis — sem edição/exclusão
- **MSG-D06:** IA NÃO participa de threads
- **MSG-D10:** Admin → Organização = Aviso, não Mensagem
- **Matrix de permissões:** MEMBER→[SUP_A,SUP_B], SUPERVISOR_A/B→[MEMBER,SUP_A,SUP_B,ADMIN], ADMIN→[SUP_A,SUP_B,ADMIN]

### T001 — DB Migration ✅
- ENUMs: `message_thread_status` (OPEN, CLOSED), `message_participant_role` (INITIATOR, PARTICIPANT)
- Tables: `message_threads`, `message_thread_participants`
- `messages` table altered: `thread_id UUID REFERENCES message_threads(id)`, `sender_name TEXT`

### T002 — lib/db schema ✅
- `lib/db/src/schema/communication.ts` — `messageThreadsTable`, `messageThreadParticipantsTable`, `messagesTable` estendida
- rebuild: `cd lib/db && pnpm tsc --build tsconfig.json`

### T003 — routes/messages.ts ✅
- 7 endpoints: POST/GET /messages/threads, GET/POST/PATCH(close/read) /messages/threads/:id(/messages), GET /messages/recipients
- Registrado em `routes/index.ts`

### T004 — OpenAPI + Codegen ✅
- 6 paths + 13 schemas no spec
- Hooks gerados: `useListMessageThreads`, `useGetMessageThread`, `useCreateMessageThread`, `useSendMessage`, `useCloseMessageThread`, `useListMessageRecipients`
- Query keys: `getListMessageThreadsQueryKey()`, `getGetMessageThreadQueryKey(threadId)` — recebe `string` direta, NÃO objeto `{threadId}`

### T005 — Web Admin ✅
- `pages/admin/messages.tsx`: layout 2 colunas, lista threads + thread panel com bolhas, criar conversa, encerrar, busca
- `pages/supervisor/messages.tsx`: idem, sem botão "Encerrar"
- Rotas em `App.tsx` + links no sidebar `admin-layout.tsx` (MessageSquare de lucide-react)

### T006 — Mobile ✅
- `app/(tabs)/mensagens.tsx`: FlatList de threads + Modal de conversa (bolhas) + Modal de criação
- `_layout.tsx`: tab "Mensagens" em NativeTabs (sf: "message"/"message.fill") + ClassicTabLayout (Feather "message-square")

### Convenções estabelecidas no Sprint 11
- **`useGetMessageThread(threadId)`** — assinatura gerada recebe `string` direta (não `{ threadId }`)
- **`getGetMessageThreadQueryKey(threadId)`** — idem, `string` direta
- **Mobile `useAuth`** — importar de `@/contexts/AuthContext`; `AuthUser` tem campo `.id` (não `.userId`)

---

## Sprint 10 — Histórico / S-11 (COMPLETO)
**Objetivo:** Memória operacional oficial — "O que aconteceu, por que aconteceu e como terminou?"

### T001 — DB Schema ✅
- `history_events`: alterada para `mo_id` nullable + novas colunas `actor_name`, `entity_label`, `meta`.
- `history_relations`: tabela de relações N:N entre eventos e entidades.
- `history_narratives`: investigações estruturadas com `cause`/`decision`/`impact`/`resolution`/`status` (OPEN/RESOLVED/CLOSED).
- Aplicadas manualmente via psql (drizzle-kit push não funciona sem TTY).

### T002 — API ✅
- `lib/history-helper.ts`: `writeHistoryEvent()` fire-and-forget; nunca lança.
- `routes/history.ts`: 7 endpoints — GET /history, GET /my-history, GET+POST /history/narratives, GET+PATCH /history/narratives/:id, GET /history/:eventId.

### T003 — Event Bus ✅
- 4 rotas wired: `notices.ts` (publish/escalate/confirm), `scales.ts` (publish/republish), `daily-book.ts` (publish/republish), `agenda.ts` (suspend/cancel).
- Todas fire-and-forget com `.catch(() => {})`.

### T004 — OpenAPI + Codegen ✅
- 7 paths + 8 schemas adicionados ao spec.
- Hooks gerados: `useListHistory`, `useGetMyHistory`, `useListHistoryNarratives`, `useCreateHistoryNarrative`, `useUpdateHistoryNarrative`, `useGetHistoryEvent`.

### T005 — Web Admin ✅
- `pages/admin/history.tsx`: tabs "Linha do Tempo" + "Investigações".
- `pages/supervisor/history.tsx`: timeline visual com quick stats.

### T006 — Mobile ✅
- `app/(tabs)/historico.tsx`: Meu Histórico pessoal com modal de detalhe.
- `_layout.tsx`: tab "Histórico" adicionada em NativeTabs + ClassicTabLayout.

### Convenções estabelecidas no Sprint 10
- **`HistoryNarrativeStatus` cast:** `v as HistoryNarrativeStatus` nos Selects.
- **`AdminLayout` exige `title` prop** — sempre fornecer.
- **FC-01/FC-02/FC-03/FC-04** (IA + Biblioteca): NÃO implementar ainda.

---

## Sprint 9 — Avisos / S-08 (COMPLETO, todos os 4 blocos entregues)
**Objetivo:** "O que mudou e quem precisa saber?" — canal oficial de comunicação operacional.

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
