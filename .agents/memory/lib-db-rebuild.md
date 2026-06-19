---
name: lib/db rebuild após mudança de schema
description: Após alterar qualquer arquivo em lib/db/src/schema/, o dist/ precisa ser recompilado para que pacotes dependentes (api-server, etc.) enxerguem as mudanças corretas nos tipos.
---

## Regra

Sempre que um arquivo em `lib/db/src/schema/` for criado ou modificado, execute:

```bash
pnpm --filter @workspace/db exec tsc -p tsconfig.json
```

Antes de rodar qualquer typecheck downstream (`api-server`, `web-admin`, etc.).

**Why:** `lib/db` usa `composite: true` e `emitDeclarationOnly: true`. O TypeScript dos pacotes dependentes lê o `dist/` compilado, não o `src/`. Sem o rebuild, o compilador usa o binário antigo e reporta erros incorretos (ex: "property X does not exist" quando X foi adicionado).

**How to apply:** Imediatamente após qualquer edição em `lib/db/src/schema/*.ts`. Fazer parte do workflow de typecheck: `db → api-server → web-admin → mobile`.
