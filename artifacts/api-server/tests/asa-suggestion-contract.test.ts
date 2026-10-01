import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { resolveAsaCommand } from "../src/services/asa-command-engine.ts";

const apiRoot = process.cwd().replace(/[\\/]$/, "").endsWith("api-server")
  ? process.cwd()
  : resolve(process.cwd(), "artifacts", "api-server");
const workspaceRoot = resolve(apiRoot, "..", "..");

function readSuggestionMap(path: string, start: string, end: string) {
  const source = readFileSync(resolve(workspaceRoot, path), "utf8");
  const startAt = source.indexOf(start);
  assert.notEqual(startAt, -1, `Missing ${start} in ${path}`);
  const endAt = source.indexOf(end, startAt);
  assert.notEqual(endAt, -1, `Missing ${end} in ${path}`);
  const block = source.slice(startAt, endAt);
  const entries: Array<{ page: string; prompts: string[] }> = [];
  for (const match of block.matchAll(/"([^\"]+)"\s*:\s*\[([^\]]*)\]/g)) {
    entries.push({
      page: match[1]!,
      prompts: [...match[2]!.matchAll(/"([^\"]*)"/g)].map((prompt) => prompt[1]!),
    });
  }
  assert.ok(entries.length > 0, `No page suggestions found in ${path}`);
  return entries;
}

const sources = [
  {
    surface: "web",
    path: "artifacts/web-admin/src/components/global-asa-assistant.tsx",
    start: "const pageSuggestions",
    end: "const pageNames",
  },
  {
    surface: "mobile",
    path: "artifacts/mobile/app/(stack)/asa.tsx",
    start: "const PAGE_SUGGESTIONS",
    end: "// ─── Message Bubble",
  },
];

let checked = 0;
for (const source of sources) {
  for (const { page, prompts } of readSuggestionMap(source.path, source.start, source.end)) {
    if (source.surface === "web" && page === "/biblioteca") {
      assert.equal(prompts[0], "Quais leituras estão pendentes na Biblioteca?", "modo equilibrado deve priorizar uma consulta acionável na Biblioteca do shell");
    }
    if (source.surface === "mobile" && page === "/membro/biblioteca") {
      assert.equal(prompts[0], "Quais leituras estão pendentes na Biblioteca?", "modo equilibrado deve expor a consulta de leitura pendente na Biblioteca mobile");
    }
    const isManager = page.startsWith("/admin/") || page.startsWith("/supervisor/");
    const role = page.startsWith("/admin/") ? "ADMIN"
      : page.startsWith("/supervisor/") ? "SUPERVISOR_A"
        : page.startsWith("/membro/") ? "MEMBER" : undefined;
    for (const prompt of [...prompts, "O que tenho aqui?"]) {
      const result = resolveAsaCommand(prompt, "2026-09-30", isManager, page, role);
      assert.notEqual(result.kind, "unsupported", `${source.surface} ${page}: ${prompt}`);
      checked++;
    }
  }
}

for (const prompt of ["Mostra minhas tarefas vencidas", "Quais são minhas tarefas para hoje?"]) {
  const result = resolveAsaCommand(prompt, "2026-09-30", false, "/membro/tarefas", "MEMBER");
  assert.equal(result.kind, "command", `Proactive task suggestion: ${prompt}`);
  if (result.kind === "command") assert.equal(result.command.tool, "consultar_tarefas");
  checked++;
}

console.log(`ASA screen suggestion contract: ${checked} prompts recognized or routed to clarification.`);
