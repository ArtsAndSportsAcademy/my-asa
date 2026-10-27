// Rodar: node ../../node_modules/.pnpm/tsx@4.21.0/node_modules/tsx/dist/cli.mjs --test src/components/escala/resumo-de-quem.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { emOrdemDeNumero, resumirQuem, type PessoaDoDia } from "./resumo-de-quem";

// Dia com 20 pessoas: 10 da área P (patinadores), 8 da área B (bailarinos), 1 de C e 1 sem área.
const pessoas: PessoaDoDia[] = [
  ...Array.from({ length: 10 }, (_, i) => ({ id: `p${i}`, name: `Pat ${String(i).padStart(2, "0")}`, areaId: "P", areaName: "Patinadores" })),
  ...Array.from({ length: 8 }, (_, i) => ({ id: `b${i}`, name: `Bai ${i}`, areaId: "B", areaName: "Bailarinos" })),
  { id: "c0", name: "Cleo", areaId: "C", areaName: "Cenografia" },
  { id: "s0", name: "Sem Area", areaId: null, areaName: null },
];
const ids = (prefixo: string, n: number) => Array.from({ length: n }, (_, i) => `${prefixo}${i}`);
const doDia = (n: number) => pessoas.slice(0, n);

test("bloco vazio devolve lista sem rótulo", () => {
  const r = resumirQuem([], pessoas);
  assert.deepEqual(r, { tipo: "lista", rotulo: "", extras: [], nomes: [] });
});

test("100% do dia é Elenco do dia, sem número", () => {
  const r = resumirQuem(pessoas.map((p) => p.id), pessoas);
  assert.equal(r.tipo, "todos");
  assert.equal(r.rotulo, "Elenco do dia");
  assert.equal(r.nomes.length, 20);
});

test("80% exato ainda é Elenco todo (16 de 20)", () => {
  const r = resumirQuem(pessoas.slice(0, 16).map((p) => p.id), pessoas);
  assert.equal(r.tipo, "todos");
  assert.equal(r.rotulo, "Elenco do dia");
});

test("79% não é Elenco todo (19 de 24)", () => {
  const dia = [...pessoas, ...Array.from({ length: 4 }, (_, i) => ({ id: `x${i}`, name: `Extra ${i}`, areaId: "C", areaName: "Cenografia" }))];
  const r = resumirQuem(dia.slice(0, 19).map((p) => p.id), dia); // 19/24 = 79,2%
  assert.notEqual(r.tipo, "todos");
});

test("área inteira mostra o nome da área, sem nomes de fora", () => {
  const r = resumirQuem(ids("b", 8), pessoas);
  assert.equal(r.tipo, "area");
  assert.equal(r.rotulo, "Bailarinos");
  assert.deepEqual(r.extras, []);
});

test("80% da área basta, e quem faltou não aparece (8 de 10 patinadores)", () => {
  const r = resumirQuem(ids("p", 8), pessoas);
  assert.equal(r.tipo, "area");
  assert.equal(r.rotulo, "Patinadores");
});

test("79% da área vira lista (7 de 10 patinadores)", () => {
  assert.equal(resumirQuem(ids("p", 7), pessoas).tipo, "lista");
});

test("área com alguém de fora diz quem é", () => {
  const r = resumirQuem([...ids("b", 8), "c0"], pessoas);
  assert.equal(r.tipo, "area");
  assert.equal(r.rotulo, "Bailarinos e Cleo");
  assert.deepEqual(r.extras, ["Cleo"]);
});

test("pessoa sem área, de fora da área, entra como extra", () => {
  const r = resumirQuem([...ids("b", 8), "s0", "c0"], pessoas);
  assert.equal(r.rotulo, "Bailarinos e Cleo e Sem Area");
  assert.deepEqual(r.extras, ["Cleo", "Sem Area"]);
});

test("gente demais de fora deixa de ser 'a área' e lista os nomes", () => {
  const r = resumirQuem([...ids("b", 8), ...ids("p", 4)], pessoas);
  assert.notEqual(r.tipo, "area");
});

test("só pessoas sem área nunca viram área", () => {
  const dia: PessoaDoDia[] = Array.from({ length: 5 }, (_, i) => ({ id: `n${i}`, name: `N${i}`, areaId: null, areaName: null }));
  const r = resumirQuem(["n0", "n1", "n2"], dia);
  assert.equal(r.tipo, "lista");
});

test("poucas pessoas não viram resumo (2 de 2)", () => {
  const dia = doDia(2);
  assert.equal(resumirQuem(dia.map((p) => p.id), dia).tipo, "lista");
});

test("show com 12 posições segue pequeno; com 13 vira Elenco do show", () => {
  const quem = ids("p", 5);
  assert.notEqual(resumirQuem(quem, pessoas, 12).tipo, "show-grande");
  const grande = resumirQuem(quem, pessoas, 13);
  assert.equal(grande.tipo, "show-grande");
  assert.equal(grande.rotulo, "Elenco do show: 5 pessoas");
  assert.equal(grande.nomes.length, 5);
});

test("show grande vale mesmo quando o elenco é quase todo o dia", () => {
  assert.equal(resumirQuem(pessoas.map((p) => p.id), pessoas, 40).tipo, "show-grande");
});

test("nomes saem em ordem alfabética e sem repetição", () => {
  const r = resumirQuem(["b1", "p0", "b1", "b0"], pessoas);
  assert.deepEqual(r.nomes, ["Bai 0", "Bai 1", "Pat 00"]);
});

test("posições numeradas saem em ordem de número (Guardião 1 a 8)", () => {
  const ordem = [7, 2, 3, 8, 4, 5, 1, 6].map((n) => ({ personagem: `Guardião ${n}` }));
  assert.deepEqual(emOrdemDeNumero(ordem, (v) => v.personagem).map((v) => v.personagem), [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `Guardião ${n}`));
  const dez = ["Guardião 10", "Guardião 2", "Guardião 1"].map((personagem) => ({ personagem }));
  assert.deepEqual(emOrdemDeNumero(dez, (v) => v.personagem).map((v) => v.personagem), ["Guardião 1", "Guardião 2", "Guardião 10"], "10 vem depois de 2, não depois de 1");
});

test("personagem com nome não é reordenado; se um só não termina em número, fica como está", () => {
  const musical = ["YETI", "IGNO", "ASTRID"].map((personagem) => ({ personagem }));
  assert.deepEqual(emOrdemDeNumero(musical, (v) => v.personagem), musical);
  const misto = ["Guardião 2", "Tecnico", "Guardião 1"].map((personagem) => ({ personagem }));
  assert.deepEqual(emOrdemDeNumero(misto, (v) => v.personagem), misto);
});
