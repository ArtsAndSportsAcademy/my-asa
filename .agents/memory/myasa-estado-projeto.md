---
name: MyASA 2.0 — Estado do Projeto
description: Sprint progress, architectural decisions, and key conventions for the MyASA 2.0 system
---

## Sprint 9 — Avisos / S-08 (COMPLETO, todos os 4 blocos entregues)
**Objetivo:** "O que mudou e quem precisa saber?" — canal oficial de comunicação operacional.

### T001 — Editar Rascunho ✅
- Botão "Editar" em cards DRAFT (admin + supervisor avisos) e no footer do dialog de detalhe.
- Dialog de edição busca detalhe via `useGetNotice(editId)` com flag `editFormReady` para evitar sobrescrever edições do usuário.
- Campos: title, content, urgency, type, requiresConfirmation + ERA/AGORA delta.

### T002 — ERA → AGORA delta ✅
- Backend: `deltaJson JSONB` em `noticesTable` armazena `{before, after}`. PATCH extrai `changeBefore`/`changeAfter` do body e só atualiza se ao menos um não for undefined.
- OpenAPI: `changeBefore`/`changeAfter` em NoticeDetail, MyNoticeItem, CreateNoticeRequest, UpdateNoticeRequest.
- Web: box visual "ERA/AGORA" com fundo vermelho/verde no detail dialog (admin + supervisor).
- Mobile: bloco ERA/AGORA no modal de leitura; styles deltaBox/deltaItem/deltaLabel/deltaText adicionados.

### T003 — Fluxo de Escalação ✅
- Endpoint: `POST /notices/:id/escalate` — marca notice como ESCALATED, marca todos os recipients não-confirmados como ESCALATED, insere em `notice_escalations`.
- Hook: `useEscalateNotice` gerado via codegen (linha 7620 em api.ts).
- Web: botão "Escalar" aparece para PUBLISHED + requiresConfirmation (card list + detail footer). Usa `window.confirm`.
- Mobile: badge "Escalado" em cards com `notice.type === "ESCALATED"`.

### T004 — Integração Meu Dia ✅
- Backend: `my-day.ts` busca avisos IMPORTANT/PERSISTENT/ESCALATED não-confirmados do usuário; campo `pendingNotices` na resposta.
- OpenAPI: `pendingNotices: MyDayNoticeItem[]` em MyDayResponse; schema MyDayNoticeItem com id/title/content/urgency/type/requiresConfirmation/recipientStatus.
- Web Admin `meu-dia.tsx`: seção "Avisos Pendentes" antes de "Ação Imediata"; componente `PendingNoticeCard`; ícones Bell + AlertCircle importados.
- Mobile `meu-dia.tsx`: seção "Avisos Pendentes" + `PendingNoticeCard` componente + estilos pendingNoticeCard/Row/Badges/Title/Content.
- TypeScript: ambos typechecks (web-admin + mobile) passaram limpos.

### Convenções estabelecidas no Sprint 9
- **Convenção (TS7030):** Express async handlers devem ter tipo `: Promise<void>` explícito.
- **Convenção (req.params):** Usar `String(req.params.noticeId)` para evitar `string | string[]`.
- **Convenção (drizzle .set spread):** `...(condition && { field })` causa TS2769. Usar `const updates: Record<string, unknown> = {}` + `.set(updates as any)`.
- **Convenção (useGetNotice enabled):** passar `queryKey: getGetNoticeQueryKey(id)` junto com `enabled` (react-query v5).
- **Convenção (edit dialog):** Flag `editFormReady` + useEffect para popular form — evita sobrescrever edição do usuário quando detail é re-fetched.
- Histórico e IA de Avisos: **NÃO implementar** ainda.

## Sprint 7 — Painel Operacional (COMPLETO)
**Objetivo:** "O que exige minha atenção neste momento?" para Supervisores.
- Backend: `GET /operational-panel` em operational-panel.ts — consolida agenda/escalas/alocações/exceções/livros, computa HEALTHY/ATTENTION/RISK/CRITICAL, cobertura geral+grupo+evento.
- LOG_DOMAIN.OPERATIONAL_PANEL adicionado em lib/shared/src/constants.ts.
- 9 schemas OpenAPI; codegen + api-client-react rebuild concluídos.
- Web Admin: `/admin/operational-panel` e `/supervisor/operational-panel`. Mobile: Tab "Painel".
- **Convenção:** `refetchInterval` não funciona em `query: { refetchInterval }` no orval gerado. Usar botão manual.
- **Convenção:** showBookRolesTable só tem `id` e `name` — sem campo `label`.

## Sprint 6 — Padronização Visual Oficial (concluído)
- Primary: #7C3AED (violet), gradiente from #7C3AED to #2563EB. Background: #F5F5F7.
- Amber (#F59E0B) apenas para estados semânticos de atenção.

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
