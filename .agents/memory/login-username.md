---
name: Login por nome de usuário (username)
description: Como o login por username funciona — geração, backfill, schema e migração via SQL
---

# Login por username

O login (mobile + web-admin) usa `username` em vez de `email`. Email continua existindo como dado da pessoa.

## Schema
- `users.username` é `text unique` **nullable** (em `lib/db/src/schema/identity.ts`).
- **Why nullable:** evita quebrar linhas existentes antes do backfill; novos usuários e backfill sempre preenchem.
- Constraint de unicidade: `users_username_unique`.

## Geração
- `lib/db/src/username.ts`: `normalizeUsernameBase(name)` (minúsculas, sem acentos via NFD, espaços→ponto, só `[a-z0-9.]`) e `resolveUniqueUsername(base, takenSet)` (sufixo numérico a partir de 2).
- Exportados pelo `@workspace/db` (index.ts re-exporta `./username`).
- Ex.: "Lucas Fernandes" → `lucas.fernandes`; colisão → `lucas.fernandes2`.

## Backfill
- `lib/db/src/backfill-usernames.ts` (`backfillUsernames()`), idempotente — só preenche quem tem username null. Script tsx: `pnpm --filter @workspace/db run backfill-usernames`.
- Chamado também por seed.ts e seed-simulation.ts (inclusive nos early-returns idempotentes).

## Migração (drizzle push não funciona — precisa TTY)
- Aplicar via executeSql no sandbox code_execution:
  1. `ALTER TABLE users ADD COLUMN IF NOT EXISTS username text;`
  2. rodar backfill
  3. `ALTER TABLE users ADD CONSTRAINT users_username_unique UNIQUE (username);`

## API
- `LoginRequest` em openapi.yaml passou `email`→`username`; regenerar orval com `cd lib/api-spec && pnpm run codegen`.
- `loginUser(username, password)` busca por `eq(usersTable.username, normalized)` (lowercase+trim).
- Criação de usuário (`POST /users`) gera username único: busca conflitos com `like(username, base%)`, monta Set, resolve.

## Credenciais demo (após backfill)
- Admin: `cris.fontana` / Teste@123 — Supervisor: `rafael.torres` / Teste@123.
- Seed simples (myasa.demo): `admin.demo`, `supervisor.demo`, `membro.01..05` / myasa123.
