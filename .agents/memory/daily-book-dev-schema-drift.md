---
name: Daily Book — drift de schema no banco DEV
description: o banco DEV tinha as tabelas daily_book_* numa geração antiga; integração pela rota real falhava
---

Ao escrever testes de integração que exercitam a ROTA real de geração/publicação do
Livro do Dia (`/api/daily-book/generate` + `/api/daily-book/:id/publish`), o banco DEV
estava com as tabelas `daily_book_*` numa geração ANTIGA, incompatível com o schema
Drizzle atual (`lib/db/src/schema/daily-book.ts`):

- faltavam por completo `daily_book_scenes`, `daily_book_blocks`, `daily_book_assignments`;
- `daily_book_positions` existia mas com o schema velho (`show_book_role_id`/`position_status`)
  em vez de `block_id`/`name`/`minimum_coverage`/`source_role_id`/`is_removed`.

Resultado: `generate` dava 500 (`relation ... does not exist` / `column "block_id" does not exist`).
A feature nunca rodou de verdade contra o DEV (positions/assignments com 0 linhas; daily_books
só com órfãos de gerações que falharam).

**Why:** drizzle-kit push exige TTY (não roda no ambiente não-interativo), então o DEV
acumulou drift. As tabelas filhas foram (re)criadas via psql direto (`$DATABASE_URL`)
batendo 1:1 com o schema Drizzle, e os órfãos limpos.

**How to apply:** antes de testar/usar o fluxo real do Livro do Dia no DEV, conferir
`\d daily_book_positions` etc. Se divergir do schema, recriar via psql (DEV não tem dado
real nessas tabelas). Lembrar que `generate` NÃO é transacional → falhas deixam órfãos
em daily_books/scenes/blocks que precisam de limpeza manual.

Limpeza de fixtures de teste que passam pela rota: a publicação grava em cascata
`operational_changes` (actor_id), `history_events` (actor_id + mo_id→operational_changes),
`user_notifications` e `notifications` (user_id). Apagar TUDO isso antes dos usuários,
senão o teardown quebra por FK.
