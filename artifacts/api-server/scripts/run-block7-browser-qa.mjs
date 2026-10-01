import { build } from "esbuild";
import esbuildPluginPino from "esbuild-plugin-pino";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
globalThis.require = createRequire(import.meta.url);
await build({ entryPoints: ["scripts/block7-browser-qa.ts"], bundle: true, platform: "node", format: "esm", outdir: "../../.tmp/block7-browser-qa", outExtension: { ".js": ".mjs" }, external: ["pg-native"], plugins: [esbuildPluginPino({ transports: ["pino-pretty"] })], banner: { js: "import { createRequire } from 'node:module'; globalThis.require=createRequire(import.meta.url);" } });
const child = spawn(process.execPath, ["../../.tmp/block7-browser-qa/block7-browser-qa.mjs"], { stdio: "inherit", env: process.env });
process.on("SIGINT", () => child.kill("SIGINT"));
child.on("exit", code => process.exit(code ?? 1));
