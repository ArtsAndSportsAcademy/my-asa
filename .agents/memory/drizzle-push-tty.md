---
name: drizzle-kit push TTY requirement
description: drizzle-kit push (mesmo com --force) falha em TTY não-interativo; solução via SQL direto
---

## Regra

`pnpm --filter @workspace/db run push-force` falha com "Interactive prompts require a TTY terminal" quando há conflitos de enums ou novos objetos que exigem confirmação interativa — mesmo com flag `--force`.

## Por que acontece

O drizzle-kit usa prompts interativos (enquête) para resolver conflitos de schema (ex: novos enums, renomeações). O ambiente de execução dos agentes não tem TTY.

## Solução adotada (preferida): generate + migrate

`push` foi **substituído** pelo fluxo não-interativo `generate` + `migrate`:
- `pnpm --filter @workspace/db run generate` — cria a migration SQL a partir do schema
- `pnpm --filter @workspace/db run migrate` — aplica via `drizzle-orm/node-postgres/migrator` (script `lib/db/src/migrate.ts`), 100% sem TTY

O `scripts/post-merge.sh` agora roda `migrate` (antes tinha `echo "skipping drizzle push"` → causa raiz do drift que "desandava sozinho"). O DB tem baseline em `drizzle.__drizzle_migrations` (migrations 0000-0004 marcadas como aplicadas). `push` (diff) ainda serve para reparo manual quando o DB drifta, MAS trava no TTY se houver conflito de coluna/rename — só roda sem prompts quando o diff é só de adições puras (CREATE).

## Como aplicar (reparo manual antigo, via SQL direto)

Para adicionar **novas tabelas sem migration files**, use o sandbox `code_execution` com `executeSql`:

```javascript
const result = await executeSql({
  sqlQuery: `
    CREATE TABLE IF NOT EXISTS minha_tabela (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ...
    );
    CREATE INDEX IF NOT EXISTS idx_name ON minha_tabela(coluna);
  `
});
```

Para **adicionar colunas** a tabelas existentes:
```sql
ALTER TABLE tabela ADD COLUMN IF NOT EXISTS nova_coluna TEXT;
```

**Alternativa com migration files** (mais robusto):
1. Adicionar ao schema em lib/db/src/schema/*.ts
2. Criar arquivo em lib/db/drizzle/<timestamp>_description.sql manualmente
3. Executar via executeSql

**Nota**: O schema Drizzle ainda deve ser atualizado para que o ORM reconheça a tabela em TypeScript.
