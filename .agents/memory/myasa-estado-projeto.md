---
name: MyASA 2.0 — Estado do Projeto
description: Contexto acumulado, decisões e fase atual do produto MyASA 2.0
---

## Produto
MyASA 2.0 — plataforma operacional para operações artísticas, shows e equipes.
Comunicação e documentação em Português Brasileiro.

## Fase atual
**Sprint 2 CONCLUÍDO** — CRUD completo de Usuários, Papéis, Operações e Grupos implementado e funcionando.
Próxima fase: Design de Interface (Bloco 1 — S-01 Meu Dia, S-02 Painel Operacional, S-04 Escala).

## Stack técnica
- **API**: Express + TypeScript, Drizzle ORM + PostgreSQL (`artifacts/api-server`, porta 8080 em dev)
- **Web Admin**: React + Vite + wouter + shadcn/ui (`artifacts/web-admin`, path `/`)
- **Mobile**: Expo Router + React Native (`artifacts/mobile`, path `/mobile`)
- **Monorepo**: pnpm workspace; codegen via Orval (OpenAPI → hooks React Query + tipos Zod)

## Auth Pattern
- JWT: ACCESS 15min, REFRESH 30 dias (hash SHA-256 em `refresh_tokens` table)
- Web admin: tokens em `localStorage` (`myasa_access_token`, `myasa_refresh_token`) + `setAuthTokenGetter`
- Mobile: tokens em `AsyncStorage` + `setAuthTokenGetter`; `setBaseUrl` com `EXPO_PUBLIC_DOMAIN`
- Segredos: `ACCESS_SECRET` / `REFRESH_SECRET` via env (fallback dev)

## Colisão Orval — REGRA IMPORTANTE
- Nunca nomeie schema de componente `<OperationIdPascal>Response` ou `<OperationIdPascal>Body`
- Exemplo resolvido: `LoginResponse` → renomeado para `LoginResult`
- **Why**: Orval gera esses nomes internamente; duplicata causa erro TS "duplicate identifier"

## Endpoints Sprint 1
- `POST /api/auth/login` → LoginResult
- `POST /api/auth/refresh` → TokensResponse
- `POST /api/auth/logout` → 204
- `GET /api/auth/me` → MeResponse
- `GET /api/organizations/current` → CurrentOrganization
- `GET /api/operations` → { operations }
- `GET /api/operational-groups` → { groups }
- `GET /api/users/me/context` → UserContext

## Endpoints Sprint 2 (novos)
- `GET/POST /api/users` + `GET/PATCH /api/users/:id` + `PATCH /api/users/:id/status`
- `GET/POST /api/users/:id/roles` + `DELETE /api/users/:id/roles/:roleId`
- `GET/POST /api/operations` + `GET/PATCH /api/operations/:id` + `PATCH /api/operations/:id/status`
- `GET/POST /api/operational-groups` + `GET/PATCH /api/operational-groups/:id` + `PATCH /api/operational-groups/:id/status`
- `POST/DELETE /api/operational-groups/:id/members/:userId`
- `POST/DELETE /api/operational-groups/:id/supervisors/:userId`

## Credenciais Demo
- `admin@myasa.demo` / `myasa123` (ADMIN)
- `supervisor@myasa.demo` / `myasa123` (SUPERVISOR_A)
- `membro01..05@myasa.demo` / `myasa123` (MEMBER)

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
