// D1 do plano de lançamento: nenhum nome do elenco (dados-de-exemplo.json) pode chegar ao build de produção.
// Rode depois de `vite build`: `node scripts/verificar-nomes-build.mjs`. Sai com erro se achar algum nome.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const jsonPath = path.resolve(aqui, "../../../design_handoff_my_asa/dados-de-exemplo.json");
const distDir = path.resolve(aqui, "../dist/public");
if (!existsSync(distDir)) { console.error("Sem build em dist/public. Rode o build antes."); process.exit(2); }

const data = JSON.parse(readFileSync(jsonPath, "utf8"));
const nomes = new Set();
const add = (v) => { if (typeof v === "string" && v.trim().length >= 3) nomes.add(v.trim()); };
for (const p of data.pessoas ?? []) { add(p.nome_de_exibicao); add(p.nome_completo); for (const parte of String(p.nome_completo ?? "").split(/\s+/)) if (parte.length >= 4) add(parte); }
for (const s of data.supervisao_por_area_local ?? []) add(s.supervisor);
for (const c of data.personagens ?? []) for (const f of c.fila ?? []) add(f.pessoa);
for (const s of data.shows ?? []) for (const c of s.cenas ?? []) { for (const n of [...(c.slots_bl ?? []), ...(c.slots_br ?? [])]) add(n); for (const p of c.personagens ?? []) add(p.pessoa_hoje); }
const ignorar = new Set(["Produção", "Bailarinos", "Patinadores"]); // nomes de área, não de pessoa

const arquivos = [];
const walk = (d) => { for (const f of readdirSync(d)) { const p = path.join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/\.(js|css|html|json|map|txt|webmanifest)$/.test(f)) arquivos.push(p); } };
walk(distDir);

const achados = [];
for (const arq of arquivos) {
  const txt = readFileSync(arq, "utf8");
  for (const nome of nomes) {
    if (ignorar.has(nome)) continue;
    const re = new RegExp(`(?<![\\p{L}])${nome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}])`, "u");
    const m = re.exec(txt);
    if (m) achados.push(`${path.relative(distDir, arq)} · ${nome} · …${txt.slice(Math.max(0, m.index - 40), m.index + nome.length + 40).replace(/\s+/g, " ")}…`);
  }
}
if (achados.length) {
  console.error(`D1: ${achados.length} nome(s) do elenco no build de produção:`);
  for (const a of achados.slice(0, 40)) console.error(`- ${a}`);
  process.exit(1);
}
console.log(`D1: nenhum dos ${nomes.size} nomes do elenco no build (${arquivos.length} arquivos).`);
