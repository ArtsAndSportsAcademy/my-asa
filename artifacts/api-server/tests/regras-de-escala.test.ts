/** Regras puras de escala (16/10/2026): restrição de horário e shows colados. Sem banco, roda em segundos. */
import { restricaoImpede, showsColados, type RestricaoDeHorario } from "../src/services/regras-de-escala.js";

let passed = 0;
const failures: string[] = [];
function assert(condition: boolean, message: string) {
  if (condition) passed += 1;
  else { failures.push(message); console.error(`  ✗ ${message}`); }
}

// Sofia: escola. De segunda a sexta só pode a partir das 15:00.
const sofia: RestricaoDeHorario = {
  userId: "sofia", diasSemana: [1, 2, 3, 4, 5], horaInicio: "15:00", horaFim: "23:59",
  periodStart: "2026-10-22", periodEnd: "2026-12-18", motivo: "escola",
};
const outra: RestricaoDeHorario = { ...sofia, userId: "outra", motivo: "outra restrição" };

// Segunda 2026-10-26, sábado 24, domingo 25.
assert(restricaoImpede([sofia], "sofia", "2026-10-26", "11:30")?.motivo === "escola", "segunda às 11:30 a restrição da Sofia impede");
assert(restricaoImpede([sofia], "sofia", "2026-10-26", "11:30:00")?.motivo === "escola", "hora com segundos (formato do banco) também impede");
assert(restricaoImpede([sofia], "sofia", "2026-10-26", "15:30") === null, "segunda às 15:30 está dentro da janela e não impede");
assert(restricaoImpede([sofia], "sofia", "2026-10-26", "15:00") === null, "a hora de início da janela ainda é permitida");
assert(restricaoImpede([sofia], "sofia", "2026-10-24", "11:30") === null, "no sábado a restrição não vale (dia fora de dias da semana)");
assert(restricaoImpede([sofia], "sofia", "2026-10-25", "11:30") === null, "no domingo (dia 0) a restrição não vale");
assert(restricaoImpede([sofia], "sofia", "2026-10-26", null) === null, "show sem horário: a restrição é ignorada, nunca escala às cegas nem derruba");
assert(restricaoImpede([sofia], "sofia", "2026-10-21", "11:30") === null, "antes do período a restrição não vale");
assert(restricaoImpede([sofia], "sofia", "2026-12-21", "11:30") === null, "depois do período a restrição não vale");
assert(restricaoImpede([{ ...sofia, periodEnd: null }], "sofia", "2027-03-01", "11:30") !== null, "período sem fim vale para sempre");
assert(restricaoImpede([outra], "sofia", "2026-10-26", "11:30") === null, "a restrição de outra pessoa não impede a Sofia");
assert(restricaoImpede([], "sofia", "2026-10-26", "11:30") === null, "sem restrição, nada impede");

// Montanha 15:15–15:20 e Teatro 15:30: colados com intervalo mínimo de 20 minutos.
const montanha = { start: "15:15", end: "15:20" };
const teatroTarde = { start: "15:30", end: "16:00" };
const teatroManha = { start: "11:30", end: "12:00" };
assert(showsColados(montanha, teatroTarde, 20) === true, "Montanha às 15:15 e Teatro às 15:30 são colados com intervalo mínimo de 20");
assert(showsColados(teatroTarde, montanha, 20) === true, "a ordem dos dois shows não muda o resultado");
assert(showsColados(montanha, teatroTarde, 10) === false, "com intervalo mínimo de 10 minutos, 10 minutos de folga não é colado");
assert(showsColados(teatroManha, teatroTarde, 20) === false, "Teatro das 11:30 e das 15:30 não são colados");
assert(showsColados({ start: "10:00", end: "11:00" }, { start: "10:30", end: "11:30" }, 0) === true, "shows que se sobrepõem são colados mesmo com intervalo mínimo zero");
assert(showsColados({ start: "10:00", end: null }, { start: "10:20", end: "11:00" }, 20) === true, "show sem fim conta como 30 minutos");
assert(showsColados({ start: "10:00", end: null }, { start: "11:00", end: "11:30" }, 20) === false, "show sem fim, a 30 minutos do outro, não é colado");

if (failures.length > 0) {
  console.error(`${failures.length} falha(s) em regras de escala`);
  process.exitCode = 1;
} else {
  process.stdout.write(`regras-de-escala: ${passed} asserts passed\n`);
}
