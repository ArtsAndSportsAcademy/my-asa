---
name: api-client-react build requerido
description: Lib api-client-react precisa ser compilada antes do typecheck do web-admin (project references)
---

## Regra
Sempre que o orval regenerar `lib/api-client-react/src/generated/api.ts` (novos hooks), rodar:

```bash
cd workspace && pnpm --filter @workspace/api-client-react exec tsc -p tsconfig.json
```

Antes de executar `pnpm --filter @workspace/web-admin typecheck`.

## Por quê
O `tsconfig.json` do `api-client-react` usa `"composite": true` + `"emitDeclarationOnly": true`. O web-admin tem referência TypeScript para essa lib (`"references": [{ "path": "../../lib/api-client-react" }]`). Sem a compilação prévia (que gera os `.d.ts` em `dist/`), o TypeScript não acha os novos exports e reporta `Module '"@workspace/api-client-react"' has no exported member 'useXxx'`.

## Como aplicar
- Após qualquer rodada de codegen orval
- O erro característico é: `Module '"@workspace/api-client-react"' has no exported member 'useXxx'`
- Se o hook existe em `lib/api-client-react/src/generated/api.ts` mas o typecheck falha, sempre compilar a lib primeiro
