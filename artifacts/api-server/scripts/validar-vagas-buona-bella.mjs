/** Ensaio de integração na empresa descartável criada por empresa-de-teste.cjs. */
import fs from "node:fs";
import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import { cadastro, preparar, aplicar, regrasNoiteAlema } from "./vagas-buona-bella.mjs";
import { isSupabaseTestDatabaseUrl } from "./test-database-identity.mjs";

if (!isSupabaseTestDatabaseUrl(process.env.DATABASE_URL, process.env.MYASA_TEST_DATABASE_REF)) throw new Error("Este ensaio exige o banco de teste.");
const estado = JSON.parse(fs.readFileSync(new URL("./empresa-de-teste.local.json", import.meta.url), "utf8"));
let token;
async function api(method, path, body) {
  const r = await fetch(`http://localhost:3001/api${path}`, {
    method, headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${method} ${path}: HTTP ${r.status}`);
  return r.status === 204 ? null : r.json();
}

try {
  token = (await api("POST", "/auth/login", { username: estado.pessoas.admin.login, password: estado.pessoas.admin.senha })).accessToken;
  const locais = (await api("GET", "/locations")).locations;
  const livros = (await api("GET", "/show-books")).showBooks;
  for (const local of ["Buona", "Bella"]) {
    let l = locais.find((l) => l.name === local);
    if (!l) l = (await api("POST", "/locations", { name: local })).location;
    for (const item of cadastro.filter((s) => s.local === local)) {
      if (!livros.some((s) => s.title === item.show && s.locationId === l.id)) {
        await api("POST", "/show-books", { title: item.show, type: "CHARACTERS_ONLY", locationId: l.id });
      }
    }
  }
  const pessoas = (await api("GET", "/users")).users;
  const nomes = [...new Set(cadastro.flatMap((s) => s.fila))];
  for (const [indice, nome] of nomes.entries()) {
    if (!pessoas.some((p) => p.fullName === nome)) {
      await api("POST", "/users", { fullName: nome, nomeDeUso: nome, login: `${estado.marca}.fila${indice}`, password: randomBytes(24).toString("base64url"), perfil: "MEM", areaId: estado.baiId });
    }
  }
  const plano = await preparar(api);
  await aplicar(api, plano);
  const depois = await preparar(api);
  assert.equal(depois.reduce((n, p) => n + p.vagas.length, 0), 0);
  assert.ok(depois.every((p) => p.description === null));
  let escritas = 0;
  await aplicar(async (...args) => { escritas++; return api(...args); }, depois);
  assert.equal(escritas, 0, "Reexecutar não pode duplicar vagas nem observações");
  const alema = depois.find((p) => p.show === "Noite Alemã");
  assert.ok((await api("GET", `/show-books/${alema.id}`)).showBook.description.includes(regrasNoiteAlema));
  for (const item of depois) {
    const { resolution } = await api("GET", `/show-books/${item.id}/resolve?date=${estado.hoje}`);
    const escalados = resolution.scenes.flatMap((s) => s.blocks.flatMap((b) => b.positions.flatMap((p) => p.lines.flatMap((l) => l.people.map((p) => p.userId)))));
    assert.equal(escalados.length, cadastro.find((s) => s.show === item.show).vagas.length, `${item.show}: todas as vagas precisam resolver`);
    assert.equal(new Set(escalados).size, escalados.length, `${item.show}: não repetir a mesma pessoa em duas vagas`);
  }
  console.log("PASSOU: 11 vagas, filas completas, observações, resolução sem repetir pessoas e reexecução sem novas escritas, pela API de teste.");
} catch (erro) {
  console.error(erro.message);
  process.exitCode = 1;
}
