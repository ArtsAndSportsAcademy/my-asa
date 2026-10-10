import { test } from "node:test";
import assert from "node:assert/strict";
import { cadastro, preparar, resolverPessoa } from "../scripts/vagas-buona-bella.mjs";

test("não confunde Victor Massalai com outro Victor, nem escolhe homônimo", () => {
  const pessoas = [
    { id: "certo", status: "ACTIVE", name: "Vitor", fullName: "Victor Emanuel Massalai" },
    { id: "outro", status: "ACTIVE", name: "Vitinho", fullName: "Victor Oliveira Ramos Santos" },
  ];
  assert.equal(resolverPessoa(pessoas, "Victor Massalai"), "certo");
  assert.throws(() => resolverPessoa(pessoas, "Victor"), /encontrei 2/);
  assert.throws(() => resolverPessoa(pessoas, "Ausente"), /encontrei 0/);
});

test("conferência só lê e recusa o último show ausente antes de cadastrar qualquer vaga", async () => {
  const users = [...new Set(cadastro.flatMap((s) => s.fila))].map((name) => ({ id: name, name, status: "ACTIVE" }));
  const showBooks = cadastro.slice(0, -1).map((s) => ({ id: s.show, title: s.show, locationName: s.local }));
  const api = async (method, path) => {
    assert.equal(method, "GET");
    if (path === "/users") return { users };
    if (path === "/show-books") return { showBooks };
    if (path.startsWith("/characters")) return { characters: [] };
    return { showBook: { id: path.split("/").at(-1), type: "CHARACTERS_ONLY", locationId: "local", scenes: [] } };
  };
  await assert.rejects(preparar(api), /Zuca: show ausente/);
});
