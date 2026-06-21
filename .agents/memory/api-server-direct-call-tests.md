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

## Variante PERSISTENTE (testes de regressão que ficam no repo)
Para testes que devem PERMANECER, coloque-os em `artifacts/api-server/tests/` (FORA de `src/`).
Isso NÃO polui nada porque `tsconfig.json` tem `include: ["src"]` (logo `pnpm typecheck` não vê tests/)
e `build.mjs` só usa `src/index.ts` como entryPoint (logo não entram no bundle de produção).
Runner: `tests/run-tests.mjs` (copia external/banner/plugin-pino do build.mjs, bundla a entry de teste
para `tests/.dist/` com outdir, roda com node e apaga `.dist` no fim). Script `"test"` no package.json.
**Why:** o api-server não tem framework de teste; e um `.ts` em `src/` quebraria typecheck/build.
**How to apply:** importe alvos com extensão `.js` (ex.: `../src/routes/daily-book.js`); o esbuild resolve.
Faça seed/cleanup no banco dev com TAG única + `finally`; chame `pool.end()` antes de `process.exit`.
