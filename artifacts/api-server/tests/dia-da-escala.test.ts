/**
 * Função pura "qual dia a Escala mostra ao abrir" (web-admin/src/lib/dia-da-escala.ts, 24/10/2026): o web-admin não tem corredor de teste,
 * então ela é conferida aqui, sem banco.
 */
import assert from "node:assert/strict";
import { VIRADA_PADRAO, diaQueAEscalaAbre, exemploDaVirada, fraseDaViradaInvalida, somaDias } from "../../web-admin/src/lib/dia-da-escala.ts";

const em = (hora: string) => { const [h, m] = hora.split(":").map(Number); return new Date(2026, 9, 26, h, m); }; // segunda, 26/10/2026
const hoje = "2026-10-26";

// Sem configuração: abre amanhã, como era antes.
assert.equal(diaQueAEscalaAbre(em("09:00"), null, hoje), "2026-10-27");
assert.equal(diaQueAEscalaAbre(em("09:00"), undefined, hoje), "2026-10-27");
// Horas inválidas também caem no comportamento antigo, sem quebrar.
assert.equal(diaQueAEscalaAbre(em("09:00"), { abreAmanhaAPartirDe: "x", voltaAHojeAPartirDe: "05:00" }, hoje), "2026-10-27");

// Com o padrão 18:00 e 05:00.
assert.equal(diaQueAEscalaAbre(em("10:00"), VIRADA_PADRAO, hoje), "2026-10-26", "de dia abre hoje");
assert.equal(diaQueAEscalaAbre(em("17:59"), VIRADA_PADRAO, hoje), "2026-10-26", "um minuto antes da virada ainda abre hoje");
assert.equal(diaQueAEscalaAbre(em("18:00"), VIRADA_PADRAO, hoje), "2026-10-27", "na hora da virada abre amanhã");
assert.equal(diaQueAEscalaAbre(em("23:59"), VIRADA_PADRAO, hoje), "2026-10-27", "até a meia-noite abre amanhã");
assert.equal(diaQueAEscalaAbre(em("02:30"), VIRADA_PADRAO, hoje), "2026-10-26", "de madrugada (a janela começou ontem à noite) o dia seguinte dela é hoje");
assert.equal(diaQueAEscalaAbre(em("05:00"), VIRADA_PADRAO, hoje), "2026-10-26", "na hora de voltar abre hoje");

// Horas escolhidas pelo local.
const cedo = { abreAmanhaAPartirDe: "15:30", voltaAHojeAPartirDe: "06:00" };
assert.equal(diaQueAEscalaAbre(em("15:29"), cedo, hoje), "2026-10-26");
assert.equal(diaQueAEscalaAbre(em("15:30"), cedo, hoje), "2026-10-27");

// Virada de mês e de ano.
assert.equal(somaDias("2026-10-31", 1), "2026-11-01");
assert.equal(somaDias("2026-12-31", 1), "2027-01-01");
assert.equal(diaQueAEscalaAbre(new Date(2026, 11, 31, 20, 0), VIRADA_PADRAO, "2026-12-31"), "2027-01-01");

// As frases de erro dizem o que vale.
assert.equal(fraseDaViradaInvalida("18:00", "05:00"), null);
assert.match(fraseDaViradaInvalida("25:99", "05:00") ?? "", /HH:MM/);
assert.match(fraseDaViradaInvalida("18:00", "18:00") ?? "", /precisam ser diferentes/);
assert.match(fraseDaViradaInvalida("05:00", "18:00") ?? "", /precisa vir antes/);

// O exemplo vivo usa o dia da semana de verdade e muda com as horas.
assert.equal(exemploDaVirada(VIRADA_PADRAO, hoje), "Com estas horas, às 19:30 de segunda a Escala abre em terça. Às 06:00 de terça, ela abre em terça (hoje).");
assert.match(exemploDaVirada(cedo, hoje), /às 17:00 de segunda a Escala abre em terça\. Às 07:00 de terça/);

process.stdout.write("dia-da-escala: todas as conferências passaram\n");
