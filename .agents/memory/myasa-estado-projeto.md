---
name: MyASA 2.0 — Estado do Projeto
description: Contexto acumulado, decisões e fase atual do produto MyASA 2.0
---

## Produto
MyASA 2.0 — plataforma operacional para operações artísticas, shows e equipes.
Comunicação e documentação em Português Brasileiro.

## Fase atual
**Sprint 4 CONCLUÍDO** — Motor de Cobertura (Escala) + Gestão Web + Mobile consulta.
Próxima fase: Design de Interface (Bloco 1 — S-01 Meu Dia, S-02 Painel Operacional, S-04 Escala).

## Stack técnica
- **API**: Express + TypeScript, Drizzle ORM + PostgreSQL (`artifacts/api-server`, porta 8080 em dev)
- **Web Admin**: React + Vite + wouter + shadcn/ui (`artifacts/web-admin`, path `/`)
- **Mobile**: Expo Router + React Native (`artifacts/mobile`, path `/mobile`)
- **Monorepo**: pnpm workspace; codegen via Orval (OpenAPI → hooks React Query + tipos Zod)

## Auth Pattern
- JWT: ACCESS 15min, REFRESH 30 dias (hash SHA-256 em `refresh_tokens` table)
- Login retorna `{ user, accessToken, refreshToken, roles }` — campo é `accessToken`, não `token`
- Web admin: tokens em `localStorage` (`myasa_access_token`, `myasa_refresh_token`) + `setAuthTokenGetter`
- Mobile: tokens em `AsyncStorage` + `setAuthTokenGetter`; `setBaseUrl` com `EXPO_PUBLIC_DOMAIN`
- Segredos: `ACCESS_SECRET` / `REFRESH_SECRET` via env (fallback dev)

## Colisão Orval — REGRA IMPORTANTE
- Nunca nomeie schema de componente `<OperationIdPascal>Response` ou `<OperationIdPascal>Body`
- Exemplo resolvido: `LoginResponse` → renomeado para `LoginResult`
- **Why**: Orval gera esses nomes internamente; duplicata causa erro TS "duplicate identifier"

## YAML OpenAPI — REGRA IMPORTANTE
- Summaries com `: ` dentro precisam estar entre aspas no openapi.yaml
- **Why**: parser YAML interpreta `: ` como início de chave

## Radix Select — REGRA IMPORTANTE
- `<SelectItem value="">` lança erro em runtime: "value prop must not be empty string"
- Sempre use sentinela como `"ALL"` para a opção "Todos" e normalize ao ler: `value === "ALL" ? undefined : value`

## Override de Alocação — PADRÃO
- Rota: `PATCH /api/scales/:id/allocations/:allocationId` (não POST .../override)
- `.returning()` do Drizzle não inclui campos de joins — re-fetch com leftJoin após update para retornar `userName` + `positionName`
- **Why**: `.returning()` retorna apenas colunas da tabela atualizada, joins devem ser feitos em query separada

## Endpoints Sprint 4 (novos — Escalas)
- `GET /api/scales` — lista escalas da operação
- `POST /api/scales/generate` — gera escala (requer operationId + agendaEventId + showBookId)
- `GET /api/scales/my-allocations` — alocações do usuário logado
- `GET /api/scales/:id` — detalhe da escala com allocations + exceptions
- `PATCH /api/scales/:id` — atualiza metadados (title, notes)
- `POST /api/scales/:id/publish` — DRAFT → PUBLISHED
- `POST /api/scales/:id/republish` — PUBLISHED/REPUBLISHED → REPUBLISHED
- `POST /api/scales/:id/archive` — → ARCHIVED (não PATCH com status)
- `POST /api/scales/:id/regenerate` — regenera mantendo overrides manuais
- `GET /api/scales/:id/allocations` — lista alocações com candidatos
- `PATCH /api/scales/:id/allocations/:allocationId` — override manual
- `GET /api/scales/:id/exceptions` — lista exceções
- `PATCH /api/scales/:id/exceptions/:exceptId` — resolve exceção

## Motor de Cobertura (coverage-engine.ts)
- 3 camadas: Elegibilidade (status ativo, membro da operação) → Compatibilidade (tags/restrições) → Priorização (score)
- Cria `allocationCandidatesTable` para cada posição com ranking
- Cria `allocationExceptionsTable` para NO_CANDIDATE, CONFLICT, INSUFFICIENT_COVERAGE, SUPERVISOR_OVERRIDE
- Override manual gera exceção tipo SUPERVISOR_OVERRIDE automaticamente

## Schema Sprint 4 (lib/db/src/schema/scale.ts)
- `scalesTable`: operationId, agendaEventId, showBookId, title, generatedAt/By, publishedAt/By, republishedAt/By, archivedAt/By
- `scaleAllocationsTable`: positionId, userId, status (ASSIGNED/OPEN/CONFLICT/MANUAL_OVERRIDE), overriddenBy, overrideReason
- `allocationCandidatesTable`: allocationId, userId, rank, eligible, compatible, priorityScore, rejectionReason, candidateData JSONB
- `allocationExceptionsTable`: type (NO_CANDIDATE/RESTRICTION/CONFLICT/INSUFFICIENT_COVERAGE/SUPERVISOR_OVERRIDE), reason, impact, resolvedBy/At

## Páginas Web Admin (Sprint 4)
- `/admin/scales` — 3 painéis: lista de escalas | alocações | candidatos+exceções; gerar/publicar/republicar/arquivar/override

## Tabs Mobile (Sprint 4)
- `(tabs)/scale.tsx` — read-only: minhas alocações com filtro por status, cards com horário e função

## Endpoints Sprint 3 (novos)
- `GET/POST /api/show-books` + `GET /api/show-books/:id` + `PATCH /api/show-books/:id` + `PATCH /api/show-books/:id/status`
- `GET /api/show-books/:id/versions`
- `POST /api/show-books/:id/scenes` + `PATCH/DELETE /api/show-books/:id/scenes/:sceneId`
- `POST /api/show-books/:id/blocks` + `PATCH/DELETE /api/show-books/:id/blocks/:blockId`
- `POST /api/show-books/:id/positions` + `PATCH/DELETE /api/show-books/:id/positions/:positionId`
- `POST /api/show-books/:id/scenes/:sceneId/lines` + `PATCH/DELETE` por lineId
- `GET/POST /api/operations/:operationId/tags` + `DELETE /api/operations/:operationId/tags/:tagId`
- `POST /api/users/:userId/tags` + `DELETE /api/users/:userId/tags/:tagId`
- `GET/POST /api/agenda/events` + `GET /api/agenda/events/:id` + `PATCH /api/agenda/events/:id`
- `DELETE /api/agenda/events/:id` + confirm/suspend/cancel/complete

## Páginas Web Admin (Sprint 3)
- `/admin/show-book` — painel duplo: lista de livros à esquerda + árvore Cenas>Blocos>Posições>Linhas à direita, ações CRUD, histórico de versões em Sheet
- `/admin/agenda` — tabela com filtros por tipo/status/data, CRUD completo, transitions de estado via DropdownMenu
- `/admin/auditoria` — tabela read-only de versões do livro (v1, v2, v3...) com Motivo e Data

## Tabs Mobile (Sprint 3)
- `(tabs)/agenda.tsx` — read-only: lista de eventos com filtro por status, badges coloridas
- `(tabs)/show-book.tsx` — read-only: seletor de livro + árvore hierárquica Cenas>Blocos>Posições>Linhas

## Schema Sprint 3 (lib/db/src/schema/)
- `showbook.ts`: ShowBooks, ShowBookScenes, ShowBookBlocks (sceneId FK), ShowBookRoles/Positions (tagsJson JSONB), ShowBookLines (7 tipos), ShowBookVersions, ShowBookTags, UserTags
- `agenda.ts`: AgendaEvents (5 tipos, 5 estados + auditoria confirmedBy/suspendedBy/cancelledBy/completedBy)
- Versionamento automático: toda mutação estrutural chama `bumpVersion(id, changeType, reason, userId)`

## Seed
- Seed detecta usuários existentes mas livros ausentes → cria show book + hierarquia + 3 eventos automaticamente
- **Why**: banco pode ter usuários de sprint anterior sem dados do Sprint 3

## Credenciais Demo
- `admin@myasa.demo` / `myasa123` (ADMIN)
- `supervisor@myasa.demo` / `myasa123` (SUPERVISOR_A)
- `membro01..05@myasa.demo` / `myasa123` (MEMBER)
- operationId em uso: `43a6a11c-ec85-4e86-b630-b9bb3d35b286`

## Comandos úteis
- `pnpm --filter @workspace/db run seed` — upsert de senhas se dados já existem, seed completo se DB vazio
- `pnpm --filter @workspace/db run push-force` — aplica schema ao DB sem migration
- `pnpm --filter @workspace/api-spec run codegen` — gera hooks + tipos do OpenAPI
- `pnpm --filter @workspace/api-client-react exec tsc -p tsconfig.json` — compilar lib antes do typecheck web-admin

## Documentos de produto (docs/)
- docs/arquitetura-myasa-2.0.md
- docs/ux-diretrizes-obrigatorias.md
- docs/ux-pesquisa-supervisor.md / membro / admin
- docs/jornadas-myasa-2.0.md
- docs/ux-superficies-myasa-2.0.md
- docs/auditoria-consistencia-final.md
- docs/arquitetura-navegacao-myasa-2.0.md

## Decisões críticas de produto
- 3 produtos distintos com dados compartilhados (Membro / Supervisor / Admin)
- Cada produto tem nav separada — nunca a mesma estrutura
- Folgas e Restrições NÃO são superfícies — embutidas em Solicitações e Perfil
- Inbox Unificado NÃO é superfície no MVP
- S-16 + S-17 fundidas em "Administração" na nav do Admin
- S-13 (Livro do Show) é sub-seção de Administração no MVP
- IA embarcada nas superfícies centrais — não aba isolada
- Alteração Operacional Persistente: 4º comportamento de notificação (estado, não evento)

## Nav permanente por perfil
- Membro: [ Meu Dia ] [ Solicitações ] [ Entregas ] [ Mensagens ]
- Supervisor: [ Painel ] [ Escala ] [ Solicitações ] [ Mensagens ]
- Admin: [ Painel de Saúde ] [ Histórico ] [ Avisos ] [ Administração ]

## Ordem de design de interface (16 superfícies, 5 blocos)
- Bloco 1: S-01 Meu Dia, S-02 Painel Operacional, S-04 Escala
- Bloco 2: S-05 Livro do Dia, S-08+S-09 Avisos+Mensagens, S-06 Solicitações
- Bloco 3: S-10 IA embarcada (junto com Bloco 1 e 2)
- Bloco 4: S-03 Painel de Saúde, S-07 Entregas, S-11 Histórico, S-12 Agenda
- Bloco 5: S-15 Equipes/Grupos, S-16+S-17 Administração, S-13 Livro do Show, S-14 Biblioteca, S-10 IA chat

## Identidade visual
- iOS-inspired, modo claro, glassmorphism leve, bordas arredondadas, espaço branco
- Logo: asa gradiente roxo→azul em docs/myasa-asa-logo.png
- PROIBIDO: fundo escuro dentro da interface, estética ERP/RH
- Web admin: acentos roxo/índigo (NOT laranja/cobre)
