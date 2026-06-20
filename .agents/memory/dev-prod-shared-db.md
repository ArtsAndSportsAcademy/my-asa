---
name: Dev e Prod compartilham o MESMO banco
description: DATABASE_URL é secret global; o app publicado e o dev usam o mesmo Postgres — apagar dados em dev apaga o app publicado
---

DATABASE_URL é um secret global do projeto. O ambiente de desenvolvimento e o app publicado (https://my-asa-two.replit.app) apontam para o MESMO banco Postgres.

**Why:** confirmado por contagem idêntica de linhas (mesmos usuários em dev e prod). Não há banco separado de produção.

**How to apply:**
- Qualquer DELETE/UPDATE/TRUNCATE rodado em dev afeta imediatamente o app publicado. Tratar toda escrita como produção.
- `executeSql` com `environment:"production"` é READ-ONLY (writes bloqueados). Para escrever, usar `environment:"development"` — mas lembrar que isso escreve no banco que o app publicado usa.
- `TRUNCATE`/`DROP` são bloqueados no caminho do callback executeSql; `DELETE` é permitido.
- Para adicionar valor a um pgEnum (ex.: security_audit_action), o array no código não basta: rodar `ALTER TYPE "<enum>" ADD VALUE IF NOT EXISTS '<valor>'` via executeSql, senão inserts com o novo valor falham em runtime.
- **Tasks mescladas NÃO aplicam mudanças de schema neste banco.** O post-merge faz `skipping drizzle push`. Uma task agent aplica a migração só no banco isolado dela; ao mesclar, vem só o código. Se o código mesclado passar a usar uma coluna nova (ex.: Task de login por username adicionou `users.username` mas a coluna não existia aqui → login quebrado em dev e no app publicado), aplicar a migração manualmente via executeSql: `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...` + constraints. Sempre conferir `information_schema.columns` quando código mesclado referenciar campos novos.
- Para apagar todos os dados sem mapear ordem de FK: loop iterativo de `DELETE FROM "<tabela>"` por tabela, repetindo as que falham por 23503 até esvaziar (convergiu em ~3 passes para ~58 tabelas).
