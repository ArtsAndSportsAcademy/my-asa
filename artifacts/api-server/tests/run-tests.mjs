// Bundla e executa os testes de chamada direta do api-server.
// Não há framework de testes instalado; seguimos o padrão de bundle via esbuild
// (igual ao build.mjs) porque o api-server depende de pacotes cjs/native (pino, etc.).
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import esbuildPluginPino from "esbuild-plugin-pino";
import { rm } from "node:fs/promises";
import { spawn } from "node:child_process";

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

async function main() {
  const outDir = path.resolve(testsDir, ".dist");
  await rm(outDir, { recursive: true, force: true });
  const testSources = process.env.TEST_FILE
    ? [process.env.TEST_FILE]
    : ["operation-lifecycle.test.ts", "daily-book-fill.test.ts"];

  // esbuild-plugin-pino emite múltiplos arquivos → exige outdir (não outfile).
  await esbuild({
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

  const entries = testSources.map((file) => file.replace(/\.ts$/, ".mjs"));
  for (const entryName of entries) {
    const entry = path.resolve(outDir, entryName);
    const code = await new Promise((resolve) => {
      const child = spawn(process.execPath, ["--enable-source-maps", entry], {
        stdio: "inherit",
        cwd: artifactDir,
        env: process.env,
      });
      child.on("exit", (exitCode) => resolve(exitCode ?? 1));
    });
    if (code !== 0) {
      await rm(outDir, { recursive: true, force: true });
      process.exit(code);
    }
  }
  await rm(outDir, { recursive: true, force: true });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
