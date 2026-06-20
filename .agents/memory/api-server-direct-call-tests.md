---
name: api-server direct-call tests
description: How to run direct-call/unit-style tests against api-server handlers (no test framework installed)
---

O artifact `artifacts/api-server` NÃO tem framework de testes (sem vitest/jest, sem script `test`, sem `tsx`). Para testar handlers diretamente contra o banco dev:

**Padrão:**
1. Exportar a função alvo (ex: `executeTool` em `src/routes/asa.ts` é `export async function`).
2. Criar um entry `.ts` temporário em `src/` que importa a função + `db` e roda asserts, fazendo seed/cleanup das linhas no banco dev (DATABASE_URL já presente no ambiente).
3. Bundlar com esbuild (copiar de `build.mjs`) e rodar com `node`.

**Armadilha:** o `esbuild-plugin-pino` gera múltiplos arquivos de saída, então o esbuild EXIGE `outdir` (com `outExtension: { ".js": ".mjs" }`) — `outfile` falha com "Must use outdir when there are multiple input files".

**Why:** importar `asa.ts` é seguro — ele só monta um `Router`, o `app.listen` fica em `index.ts`. Importar dispara o import de `@workspace/integrations-anthropic-ai`, mas isso não exige API key em tempo de import.

**How to apply:** sempre remover os arquivos temporários (entry de teste, build script, dist-test/) ao final e re-rodar o typecheck, pois um `.ts` deixado em `src/` entra no typecheck do projeto.
