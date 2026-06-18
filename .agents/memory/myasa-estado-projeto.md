---
name: MyASA 2.0 — Estado do Projeto
description: Contexto acumulado, decisões e fase atual do produto MyASA 2.0
---

## Produto
MyASA 2.0 — plataforma operacional para operações artísticas, shows e equipes.
Comunicação e documentação em Português Brasileiro.

## Fase atual
**Sprint 1 CONCLUÍDO** — Auth + Organização Base implementados e funcionando.
Próxima fase: Sprint 2 (Gerenciamento de Usuários e Operações — CRUD completo).

## Stack técnica
- **API**: Express + TypeScript, Drizzle ORM + PostgreSQL (`artifacts/api-server`, porta `$PORT`)
- **Web Admin**: React + Vite + wouter + shadcn/ui (`artifacts/web-admin`, path `/`)
- **Mobile**: Expo Router + React Native (`artifacts/mobile`, path `/mobile`)
- **Monorepo**: pnpm workspace; codegen via Orval (OpenAPI → hooks React Query + tipos Zod)

## Auth Pattern (Sprint 1)
- JWT: ACCESS 15min, REFRESH 30 dias (hash SHA-256 em `refresh_tokens` table)
- Web admin: tokens em `localStorage` (`myasa_access_token`, `myasa_refresh_token`) + `setAuthTokenGetter`
- Mobile: tokens em `AsyncStorage` + `setAuthTokenGetter`; `setBaseUrl` com `EXPO_PUBLIC_DOMAIN`
- Segredos: `ACCESS_SECRET` / `REFRESH_SECRET` via env (fallback dev)

## Colisão Orval — REGRA IMPORTANTE
- Nunca nomeie schema de componente `<OperationIdPascal>Response` ou `<OperationIdPascal>Body`
- Exemplo resolvido: `LoginResponse` → renomeado para `LoginResult` (colide com auto-gerado pelo Orval)
- **Why**: Orval gera `<OperationId>Response` e `<OperationId>Body` como Zod validators internos; se o componente tiver o mesmo nome, ambos são exportados pelo barrel e TypeScript falha com "duplicate identifier"

## Endpoints implementados (Sprint 1)
- `POST /api/auth/login` → LoginResult (accessToken, refreshToken, user, roles)
- `POST /api/auth/refresh` → TokensResponse
- `POST /api/auth/logout` → 204
- `GET /api/auth/me` → MeResponse
- `GET /api/organizations/current` → CurrentOrganization (+ operations, groups)
- `GET /api/operations` → { operations }
- `GET /api/operational-groups` → { groups }
- `GET /api/users/me/context` → UserContext

## Credenciais Demo
- `admin@myasa.demo` / `myasa123` (ADMIN)
- `supervisor@myasa.demo` / `myasa123` (SUPERVISOR_A)
- `membro01..05@myasa.demo` / `myasa123` (MEMBER)

## Comandos úteis
- `pnpm --filter @workspace/db run seed` — upsert de senhas se dados já existem, seed completo se DB vazio
- `pnpm --filter @workspace/db run push-force` — aplica schema ao DB sem migration
- `pnpm --filter @workspace/api-spec run codegen` — gera hooks + tipos do OpenAPI

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
