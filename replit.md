# [Project name]

_Replace the heading above with the project's name, and this line with one sentence describing what this app does for users._

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Changelog técnico

### MSG-S01 (2026-06-19) — Badge de mensagens não-lidas + Avisos CRITICAL/IMPORTANT em Meu Dia
- `artifacts/api-server/src/routes/messages.ts` — `GET /messages/threads`: `unreadCount` calculado via SQL (JOIN messages × message_thread_participants por lastReadAt) em vez de hardcoded `0`.
- `artifacts/api-server/src/routes/my-day.ts` — pendingNotices agora filtra por `urgency IN ('CRITICAL','IMPORTANT')` e exclui avisos com `expiresAt` no passado (antes filtrava por `type`, perdendo CRITICAL).
- `artifacts/mobile/hooks/useUnreadMessages.ts` — hook `useUnreadMessagesCount()` soma unreadCount de todos os threads.
- `artifacts/mobile/app/(tabs)/_layout.tsx` — `tabBarBadge` na aba Mensagens (ClassicTabLayout: Android/Web/iOS <26).
- `artifacts/mobile/app/(tabs)/mensagens.tsx` — ThreadCard exibe badge roxo com contagem de não-lidas; título fica bold quando há mensagens novas.

### PILOT-FIX-01 (2026-06-19) — Correções críticas de navegação e estabilidade
- Admin sidebar: Restrições, Check-ins e Aprovações entre Supervisores adicionados ao grupo "OPERAÇÃO".
- Mobile Mais: Painel e Indicadores ocultos para MEMBER (`managerOnly: true`); entrada "Meu Perfil" adicionada.
- `daily_books`: migration aplicada via psql — 8 colunas faltando adicionadas (snapshot_json, republish_delta_json, generated_at/by, executed_at/by, cancelled_at/by).
- `insights.tsx` e `panel.tsx`: tela de acesso restrito com cadeado para MEMBER.
- `meu-dia.tsx`: Alert webOnly com título e instrução claros.

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
