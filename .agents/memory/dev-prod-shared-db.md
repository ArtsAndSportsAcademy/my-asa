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
