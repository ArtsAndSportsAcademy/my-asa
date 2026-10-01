import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawn } from "node:child_process";

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const apiDir = path.resolve(testsDir, "..");
const loader = path.join(testsDir, "resolve-typescript-sources.mjs");
const registerHooks = `import { register } from "node:module"; register(${JSON.stringify(pathToFileURL(loader).href)});`;
const registerHooksUrl = `data:text/javascript,${encodeURIComponent(registerHooks)}`;
const testFiles = [
  "asa-command-engine.test.ts",
  "asa-capabilities.test.ts",
  "library-access.test.ts",
  "asa-suggestion-contract.test.ts",
  "asa-proposal-state.test.ts",
  "asa-memory-policy.test.ts",
  "asa-library-gaps.test.ts",
  "asa-library-citations.test.ts",
];

let failures = 0;
for (const file of testFiles) {
  console.log(`\n=== ${file} ===`);
  const exitCode = await new Promise((resolve) => {
    const child = spawn(process.execPath, [
      "--import",
      registerHooksUrl,
      "--experimental-strip-types",
      path.join(testsDir, file),
    ], { cwd: apiDir, env: process.env, stdio: "inherit" });
    child.on("error", (error) => {
      console.error(error);
      resolve(1);
    });
    child.on("exit", (code) => resolve(code ?? 1));
  });
  if (exitCode !== 0) failures += 1;
}

if (failures) {
  console.error(`\n${testFiles.length - failures}/${testFiles.length} testes puros da ASA passaram.`);
  process.exitCode = 1;
} else {
  console.log(`\n${testFiles.length}/${testFiles.length} testes puros da ASA passaram.`);
}
