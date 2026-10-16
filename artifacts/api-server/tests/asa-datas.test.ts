/**
 * Leitor de datas em português da ASA (sem modelo de linguagem). Hoje de referência: sexta, 16/10/2026.
 */
import assert from "node:assert/strict";
import { lerDatasEmPortugues } from "../src/services/asa-datas.js";

const hoje = "2026-10-16";
const datas = (texto: string) => {
  const lido = lerDatasEmPortugues(texto, hoje);
  return lido.kind === "ok" ? lido.datas : lido.kind;
};

// datas completas e curtas
assert.deepEqual(datas("no dia 20/11/2026"), ["2026-11-20"]);
assert.deepEqual(datas("20/11"), ["2026-11-20"], "sem ano vale a próxima que vem");
assert.deepEqual(datas("05/01"), ["2027-01-05"], "data que já passou este ano vale para o ano seguinte");
assert.deepEqual(datas("20 de novembro"), ["2026-11-20"]);
assert.deepEqual(datas("20 de nov de 2027"), ["2027-11-20"]);
assert.deepEqual(datas("dia 20"), ["2026-10-20"], "só o dia: este mês se ainda não passou");
assert.deepEqual(datas("dia 10"), ["2026-11-10"], "só o dia que já passou: o mês que vem");
assert.deepEqual(datas("nos dias 20, 21 e 25"), ["2026-10-20", "2026-10-21", "2026-10-25"]);
assert.deepEqual(datas("dias 20 e 22"), ["2026-10-20", "2026-10-22"]);
assert.deepEqual(datas("20/10, 22/10 e 25/10/2026"), ["2026-10-20", "2026-10-22", "2026-10-25"]);

// relativas e dias da semana
assert.deepEqual(datas("hoje"), ["2026-10-16"]);
assert.deepEqual(datas("amanhã"), ["2026-10-17"]);
assert.deepEqual(datas("depois de amanhã"), ["2026-10-18"]);
assert.deepEqual(datas("segunda"), ["2026-10-19"]);
assert.deepEqual(datas("segunda-feira"), ["2026-10-19"]);
assert.deepEqual(datas("sexta"), ["2026-10-16"], "a sexta de hoje é hoje");
assert.deepEqual(datas("próxima sexta"), ["2026-10-23"]);
assert.deepEqual(datas("sábado que vem"), ["2026-10-17"], "o próximo sábado depois de hoje (sexta) é amanhã");
assert.deepEqual(datas("próxima sexta"), ["2026-10-23"], "'próxima' nunca é hoje");

// períodos
assert.deepEqual(datas("de 20/11 a 24/11"), ["2026-11-20", "2026-11-21", "2026-11-22", "2026-11-23", "2026-11-24"]);
assert.deepEqual(datas("do dia 20 ao 22"), ["2026-10-20", "2026-10-21", "2026-10-22"]);
assert.deepEqual(datas("de 20 a 22 de novembro"), ["2026-11-20", "2026-11-21", "2026-11-22"]);
assert.deepEqual(datas("20 a 22/11"), ["2026-11-20", "2026-11-21", "2026-11-22"]);
assert.deepEqual(datas("de segunda a quarta"), ["2026-10-19", "2026-10-20", "2026-10-21"]);
assert.equal(datas("de 24/11 a 20/11"), "invalida", "período ao contrário");

// o que não é data
assert.equal(datas("31/02/2026"), "invalida");
assert.equal(datas("sem nenhuma data aqui"), "nenhuma");

process.stdout.write("asa-datas: ok\n");
