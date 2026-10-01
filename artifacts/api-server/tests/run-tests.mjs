// Bundla e executa os testes de chamada direta do api-server.
// Não há framework de testes instalado; seguimos o padrão de bundle via esbuild
// (igual ao build.mjs) porque o api-server depende de pacotes cjs/native (pino, etc.).
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import esbuildPluginPino from "esbuild-plugin-pino";
import { access, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { isSupabaseTestDatabaseUrl, sameTestDatabaseOrProject } from "../scripts/test-database-identity.mjs";

globalThis.require = createRequire(import.meta.url);

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const artifactDir = path.resolve(testsDir, "..");

const EXTERNAL = [
  "*.node", "sharp", "better-sqlite3", "sqlite3", "canvas", "bcrypt", "argon2",
  "fsevents", "re2", "farmhash", "xxhash-addon", "bufferutil", "utf-8-validate",
  "ssh2", "cpu-features", "dtrace-provider", "isolated-vm", "lightningcss",
  "pg-native", "oracledb", "mongodb-client-encryption", "nodemailer", "handlebars",
  "knex", "typeorm", "protobufjs", "onnxruntime-node", "@tensorflow/*",
  "@prisma/client", "@mikro-orm/*", "@grpc/*", "@swc/*", "@aws-sdk/*", "@azure/*",
  "@opentelemetry/*", "@google-cloud/*", "@google/*", "googleapis", "firebase-admin",
  "@parcel/watcher", "@sentry/profiling-node", "@tree-sitter/*", "aws-sdk",
  "classic-level", "dd-trace", "ffi-napi", "grpc", "hiredis", "kerberos",
  "leveldown", "miniflare", "mysql2", "newrelic", "odbc", "piscina", "realm",
  "ref-napi", "rocksdb", "sass-embedded", "sequelize", "serialport", "snappy",
  "tinypool", "usb", "workerd", "wrangler", "zeromq", "zeromq-prebuilt",
  "playwright", "puppeteer", "puppeteer-core", "electron",
];

const BANNER = `import { createRequire as __bannerCrReq } from 'node:module';
import __bannerPath from 'node:path';
import __bannerUrl from 'node:url';
globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);`;

function assertSafeTestDatabase() {
  if (process.env.MYASA_TEST_RUNNER !== "1") {
    throw new Error("Recusa de segurança: defina MYASA_TEST_RUNNER=1 para executar a suíte.");
  }

  const testReference = process.env.MYASA_TEST_DATABASE_REF?.trim().toLowerCase();
  if (!testReference) {
    throw new Error("Recusa de segurança: MYASA_TEST_DATABASE_REF deve identificar o projeto Supabase de teste.");
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || databaseUrl.includes("[YOUR-PASSWORD]")) {
    throw new Error("Recusa de segurança: DATABASE_URL de teste ausente ou incompleta.");
  }
  if (!isSupabaseTestDatabaseUrl(databaseUrl, testReference)) {
    throw new Error("Recusa de segurança: DATABASE_URL não aponta para o projeto de teste configurado.");
  }

  const pilotUrl = process.env.DATABASE_URL_PILOTO;
  if (pilotUrl && !pilotUrl.includes("[YOUR-PASSWORD]") && sameTestDatabaseOrProject(databaseUrl, pilotUrl, testReference)) {
    throw new Error("Recusa de segurança: DATABASE_URL de teste e DATABASE_URL_PILOTO apontam para o mesmo banco.");
  }
}

function bundleTests(testSources, outDir) {
  return esbuild({
    entryPoints: testSources.map((file) => path.resolve(testsDir, file)),
    platform: "node",
    bundle: true,
    format: "esm",
    outdir: outDir,
    outExtension: { ".js": ".mjs" },
    logLevel: "info",
    external: EXTERNAL,
    sourcemap: "linked",
    plugins: [esbuildPluginPino({ transports: ["pino-pretty"] })],
    banner: { js: BANNER },
  });
}

async function main() {
  assertSafeTestDatabase();
  const outDir = path.resolve(testsDir, ".dist");
  await rm(outDir, { recursive: true, force: true });
  const testSources = process.env.TEST_FILE
    ? [process.env.TEST_FILE]
    : ["profile-authorization.test.ts", "operation-lifecycle.test.ts", "daily-book-fill.test.ts", "block1-integrity.test.ts", "block2-integrity.test.ts", "block3-integrity.test.ts", "block4-integrity.test.ts", "permission-matrix.test.ts", "block5-integrity.test.ts", "block6-integrity.test.ts", "block7-integrity.test.ts", "show-book-slots-groups.test.ts", "daily-book-session-blocks.test.ts", "logical-removal.test.ts", "scale-logical-removal.test.ts", "daily-book-reopen-and-diff.test.ts", "daily-book-formation-today.test.ts", "escalas-dia.test.ts", "grupo-b-operational-cycle.test.ts", "grupo-c-communication.test.ts", "agenda-group.test.ts", "asa-command-engine.test.ts", "announcement-confirmation.test.ts", "asa-capabilities.test.ts", "asa-suggestion-contract.test.ts", "asa-proposal-state.test.ts", "asa-memory-policy.test.ts", "asa-memory-http.test.ts", "asa-actions-http.test.ts", "library-access.test.ts", "fase-b-regressoes.test.ts", "fase-c-escala-avisos.test.ts", "fase-c-meu-dia.test.ts", "fase-c-perfil-senha.test.ts", "fase-c-registro.test.ts", "fase-c-perfil-regras.test.ts", "fase-d-primeira-administracao.test.ts", "fase-d-seguranca.test.ts", "fase-d-renovacao-tolerancia.test.ts", "fase-e-solicitacoes.test.ts", "fase-e-ciclo.test.ts"];

  // esbuild-plugin-pino emits multiple files, so the output must be a directory.
  await bundleTests(testSources, outDir);

  const entries = testSources.map((file) => file.replace(/\.ts$/, ".mjs"));
  // D4: a suíte roda até o fim mesmo quando um arquivo falha, e mostra o resumo de todos.
  // MYASA_TEST_PARAR_NO_PRIMEIRO=1 mantém o comportamento antigo (para no primeiro erro).
  const pararNoPrimeiro = process.env.MYASA_TEST_PARAR_NO_PRIMEIRO === "1";
  const resultados = [];
  for (const entryName of entries) {
    const inicio = Date.now();
    console.log(`\n=== ${entryName} ===`);
    const entry = path.resolve(outDir, entryName);
    try {
      await access(entry);
    } catch (error) {
      if (!error || typeof error !== "object" || !("code" in error) || error.code !== "ENOENT") throw error;
      const source = testSources.find((file) => file.replace(/\.ts$/, ".mjs") === entryName);
      if (!source) throw new Error(`Fonte do teste não encontrada para ${entryName}`);
      console.warn(`Bundle ${entryName} ausente; recompilando este grupo.`);
      await bundleTests([source], outDir);
      await access(entry);
    }
    const code = await new Promise((resolve) => {
      const child = spawn(process.execPath, ["--enable-source-maps", entry], {
        stdio: "inherit",
        cwd: artifactDir,
        env: process.env,
      });
      child.on("exit", (exitCode) => resolve(exitCode ?? 1));
      child.on("error", (error) => { console.error(error); resolve(1); });
    });
    resultados.push({ arquivo: entryName.replace(/\.mjs$/, ""), ok: code === 0, code, segundos: Math.round((Date.now() - inicio) / 1000) });
    if (code !== 0 && pararNoPrimeiro) break;
  }
  await rm(outDir, { recursive: true, force: true });

  const falhas = resultados.filter((r) => !r.ok);
  const naoRodaram = entries.length - resultados.length;
  console.log("\n=== Resumo da suíte ===");
  for (const r of resultados) console.log(`${r.ok ? "  ok  " : "  FALHOU"}  ${r.arquivo}  (${r.segundos}s${r.ok ? "" : `, saída ${r.code}`})`);
  if (naoRodaram) console.log(`  ${naoRodaram} arquivo(s) não rodaram (MYASA_TEST_PARAR_NO_PRIMEIRO=1).`);
  console.log(`${resultados.length - falhas.length} de ${entries.length} arquivos passaram${falhas.length ? `; falharam: ${falhas.map((r) => r.arquivo).join(", ")}` : "."}`);
  if (falhas.length || naoRodaram) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
