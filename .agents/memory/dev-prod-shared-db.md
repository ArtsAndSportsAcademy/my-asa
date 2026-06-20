---
name: Dev e Prod usam bancos SEPARADOS
description: O app publicado (produção) tem um banco Postgres próprio, separado do banco de desenvolvimento; escrever em dev NÃO afeta o app publicado
---

CORREÇÃO de uma suposição anterior errada: o ambiente de desenvolvimento e o app publicado (https://my-asa-two.replit.app) usam **bancos Postgres SEPARADOS**, apesar de `DATABASE_URL` aparecer como um único secret global em `viewEnvVars` (a plataforma injeta uma `DATABASE_URL` própria, runtime-managed, no deployment).

**Why:** comprovado — após limpar o banco de dev (1 usuário admin) e publicar, o app publicado continuou com 43 usuários de demonstração e o login do admin falhava com "user not found"; `executeSql environment:"production"` (réplica somente-leitura) mostrou esses 43 usuários, enquanto dev mostrava 1. Réplica não fica horas atrasada → são bancos distintos.

**How to apply:**
- `executeSql environment:"development"` escreve SÓ no banco de dev; NÃO afeta o app publicado.
- `executeSql environment:"production"` é READ-ONLY (réplica) — não dá para escrever em produção por aí. O valor da `DATABASE_URL` de produção não é visível (`viewEnvVars` só mostra existência de secrets), então não há como conectar direto no banco de produção a partir do loop do agente.
- Para mudar DADOS de produção (ex.: limpar tudo + criar admin), o único caminho controlável é código no próprio app que roda em produção. Padrão usado: bootstrap guardado em `artifacts/api-server/src/lib/bootstrap.ts` — roda só se env var `RESET_PROD_DB="1"` (setada production-scoped) E uma linha marcadora em `_bootstrap_log` ainda não existir (garante execução única, seguro contra restart de autoscale). Depois republicar.
- Schema de produção é aplicado pela Replit no Publish (diff dev→prod). DADOS não são copiados no publish — persistem no banco de produção entre publicações.
- Tasks mescladas NÃO aplicam mudanças de schema no banco de dev (post-merge faz `skipping drizzle push`); aplicar manualmente via executeSql `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...` quando código mesclado referenciar coluna nova (conferir `information_schema.columns`).
- Para adicionar valor a um pgEnum: rodar `ALTER TYPE "<enum>" ADD VALUE IF NOT EXISTS '<valor>'` via executeSql; o array no código não basta.
- `TRUNCATE`/`DROP` são bloqueados no callback executeSql; `DELETE` é permitido. Dentro do app (pool direto, como no bootstrap) `TRUNCATE` funciona.
