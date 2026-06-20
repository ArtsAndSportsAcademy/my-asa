---
name: drizzle-kit push TTY requirement
description: drizzle-kit push (mesmo com --force) falha em TTY não-interativo; solução via SQL direto
---

## Regra

`pnpm --filter @workspace/db run push-force` falha com "Interactive prompts require a TTY terminal" quando há conflitos de enums ou novos objetos que exigem confirmação interativa — mesmo com flag `--force`.

## Por que acontece

O drizzle-kit usa prompts interativos (enquête) para resolver conflitos de schema (ex: novos enums, renomeações). O ambiente de execução dos agentes não tem TTY.

## Como aplicar

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
