/**
 * Tarefas em etapas — as regras de quem tem a vez, sem banco.
 * Cobre o desenho de 16/10/2026: em fila só a primeira etapa nasce ativa e concluir abre a próxima; solta, todas as de
 * trabalho nascem ativas; a aprovação é uma etapa que só abre depois das outras; pedir ajustes volta para a etapa
 * escolhida; dispensar etapa pula para a seguinte; sem etapa pendente a tarefa termina.
 */
import {
  aoConcluir,
  aoDispensar,
  aoPedirAjustes,
  aoReavaliar,
  statusDaTarefa,
  statusesIniciais,
  type StepLite,
} from "../src/services/task-steps-estado.js";

let passed = 0; const failures: string[] = [];
const assert = (condition: boolean, label: string) => { if (condition) passed++; else { failures.push(label); console.error(`  ✗ ${label}`); } };
const dizer = (mapa: Map<string, string>, ids: string[]) => ids.map((id) => mapa.get(id)).join(",");

const etapa = (id: string, position: number, kind: "WORK" | "APPROVAL", status: StepLite["status"], assigneeId = "p" + position, startedAt: Date | null = null): StepLite => ({ id, position, kind, status, assigneeId, startedAt });

// ── Estado inicial ──────────────────────────────────────────────────────────────
{
  const fila = statusesIniciais("SEQUENTIAL", [{ id: "a", position: 1, kind: "WORK" }, { id: "b", position: 2, kind: "WORK" }, { id: "c", position: 3, kind: "APPROVAL" }]);
  assert(dizer(fila, ["a", "b", "c"]) === "ACTIVE,WAITING,WAITING", `fila: só a primeira nasce ativa (${dizer(fila, ["a", "b", "c"])})`);
  const solta = statusesIniciais("FREE", [{ id: "a", position: 1, kind: "WORK" }, { id: "b", position: 2, kind: "WORK" }, { id: "c", position: 3, kind: "APPROVAL" }]);
  assert(dizer(solta, ["a", "b", "c"]) === "ACTIVE,ACTIVE,WAITING", `solta: as de trabalho nascem ativas e a aprovação espera (${dizer(solta, ["a", "b", "c"])})`);
  const soAprovacao = statusesIniciais("FREE", [{ id: "x", position: 1, kind: "APPROVAL" }]);
  assert(soAprovacao.get("x") === "ACTIVE", "solta: uma tarefa que só tem aprovação já nasce com a aprovação ativa");
}

// ── Concluir ────────────────────────────────────────────────────────────────────
{
  const passos = [etapa("a", 1, "WORK", "ACTIVE"), etapa("b", 2, "WORK", "WAITING"), etapa("c", 3, "APPROVAL", "WAITING")];
  const depois = aoConcluir("SEQUENTIAL", passos, "a");
  assert(dizer(depois.statuses, ["a", "b", "c"]) === "DONE,ACTIVE,WAITING", `fila: concluir a ativa abre a próxima (${dizer(depois.statuses, ["a", "b", "c"])})`);
  assert(depois.novasAtivas.length === 1 && depois.novasAtivas[0] === "b", `fila: só a próxima é avisada (${depois.novasAtivas.join(",")})`);
  assert(depois.taskStatus === "IN_PROGRESS", `a tarefa passa a Em andamento (${depois.taskStatus})`);

  const antesDaAprovacao = [etapa("a", 1, "WORK", "DONE"), etapa("b", 2, "WORK", "ACTIVE"), etapa("c", 3, "APPROVAL", "WAITING")];
  const aprovando = aoConcluir("SEQUENTIAL", antesDaAprovacao, "b");
  assert(aprovando.statuses.get("c") === "ACTIVE" && aprovando.taskStatus === "READY_FOR_APPROVAL", `a aprovação ativa deixa a tarefa pronta para aprovar (${aprovando.taskStatus})`);

  const ultima = aoConcluir("SEQUENTIAL", [etapa("a", 1, "WORK", "DONE"), etapa("c", 2, "APPROVAL", "ACTIVE")], "c");
  assert(ultima.taskStatus === "COMPLETED" && ultima.novasAtivas.length === 0, `a última etapa concluída fecha a tarefa (${ultima.taskStatus})`);

  const soltaDuas = [etapa("a", 1, "WORK", "ACTIVE"), etapa("b", 2, "WORK", "ACTIVE"), etapa("c", 3, "APPROVAL", "WAITING")];
  const umaFeita = aoConcluir("FREE", soltaDuas, "a");
  assert(umaFeita.statuses.get("c") === "WAITING" && umaFeita.novasAtivas.length === 0, "solta: com uma das duas feitas a aprovação continua esperando");
  const duasFeitas = aoConcluir("FREE", [etapa("a", 1, "WORK", "DONE"), etapa("b", 2, "WORK", "ACTIVE"), etapa("c", 3, "APPROVAL", "WAITING")], "b");
  assert(duasFeitas.statuses.get("c") === "ACTIVE" && duasFeitas.novasAtivas[0] === "c", "solta: a aprovação abre quando todas as outras terminaram");

  let recusou = false;
  try { aoConcluir("SEQUENTIAL", passos, "b"); } catch { recusou = true; }
  assert(recusou, "não dá para concluir uma etapa que ainda não tem a vez");

  const mesmaPessoa = [etapa("a", 1, "WORK", "ACTIVE", "ana"), etapa("b", 2, "WORK", "WAITING", "ana")];
  const seguinte = aoConcluir("SEQUENTIAL", mesmaPessoa, "a");
  assert(seguinte.novasAtivas.length === 1 && seguinte.statuses.get("b") === "ACTIVE", "a mesma pessoa em duas etapas seguidas: a segunda abre (quem concluiu não é avisada, regra da camada de aviso)");
  const soltaMesma = statusesIniciais("FREE", [{ id: "a", position: 1, kind: "WORK" }, { id: "b", position: 2, kind: "WORK" }]);
  assert(dizer(soltaMesma, ["a", "b"]) === "ACTIVE,ACTIVE", "solta: a mesma pessoa pode ter duas etapas ativas ao mesmo tempo");
}

// ── Dispensar ───────────────────────────────────────────────────────────────────
{
  const passos = [etapa("a", 1, "WORK", "ACTIVE"), etapa("b", 2, "WORK", "WAITING"), etapa("c", 3, "APPROVAL", "WAITING")];
  const pulou = aoDispensar("SEQUENTIAL", passos, "a");
  assert(dizer(pulou.statuses, ["a", "b", "c"]) === "DISPENSED,ACTIVE,WAITING" && pulou.novasAtivas[0] === "b", `dispensar a etapa ativa da fila pula para a seguinte (${dizer(pulou.statuses, ["a", "b", "c"])})`);

  const ultimaPendente = aoDispensar("SEQUENTIAL", [etapa("a", 1, "WORK", "DONE"), etapa("b", 2, "WORK", "ACTIVE")], "b");
  assert(ultimaPendente.taskStatus === "COMPLETED", `dispensar a última etapa pendente fecha a tarefa (${ultimaPendente.taskStatus})`);

  const todas = aoDispensar("SEQUENTIAL", [etapa("a", 1, "WORK", "DISPENSED"), etapa("b", 2, "WORK", "ACTIVE")], "b");
  assert(todas.taskStatus === "COMPLETED", "dispensar todas as etapas deixa a tarefa concluída, sem nenhuma etapa ativa");

  const soltaDispensa = aoDispensar("FREE", [etapa("a", 1, "WORK", "DONE"), etapa("b", 2, "WORK", "ACTIVE"), etapa("c", 3, "APPROVAL", "WAITING")], "b");
  assert(soltaDispensa.statuses.get("c") === "ACTIVE", "solta: dispensar a última de trabalho abre a aprovação");
}

// ── Pedir ajustes ───────────────────────────────────────────────────────────────
{
  const aprovando = [etapa("a", 1, "WORK", "DONE"), etapa("b", 2, "WORK", "DONE"), etapa("c", 3, "WORK", "DONE"), etapa("d", 4, "APPROVAL", "ACTIVE")];
  const volta = aoPedirAjustes(aprovando, "d", "b");
  assert(dizer(volta.statuses, ["a", "b", "c", "d"]) === "DONE,ACTIVE,WAITING,WAITING", `pedir ajustes volta para a etapa escolhida e as seguintes esperam (${dizer(volta.statuses, ["a", "b", "c", "d"])})`);
  assert(volta.taskStatus === "CHANGES_REQUESTED" && volta.novasAtivas.length === 1 && volta.novasAtivas[0] === "b", "a tarefa fica em Ajustes e só a pessoa da etapa escolhida é avisada");

  let recusou = false;
  try { aoPedirAjustes(aprovando, "d", "d"); } catch { recusou = true; }
  assert(recusou, "não dá para devolver a tarefa à própria etapa de aprovação");
  let semAprovacaoAtiva = false;
  try { aoPedirAjustes([etapa("a", 1, "WORK", "ACTIVE"), etapa("d", 2, "APPROVAL", "WAITING")], "d", "a"); } catch { semAprovacaoAtiva = true; }
  assert(semAprovacaoAtiva, "só se pede ajustes numa aprovação que está ativa");

  const solta = aoPedirAjustes([etapa("a", 1, "WORK", "DONE"), etapa("b", 2, "WORK", "DONE"), etapa("d", 3, "APPROVAL", "ACTIVE")], "d", "a", "FREE");
  assert(dizer(solta.statuses, ["a", "b", "d"]) === "ACTIVE,DONE,WAITING", `solta: só a etapa escolhida reabre, as outras continuam feitas (${dizer(solta.statuses, ["a", "b", "d"])})`);
}

// ── Reavaliar (depois de acrescentar uma etapa) ─────────────────────────────────
{
  const solta = aoReavaliar("FREE", [etapa("a", 1, "WORK", "ACTIVE"), etapa("b", 2, "WORK", "WAITING"), etapa("c", 3, "APPROVAL", "WAITING")]);
  assert(solta.statuses.get("b") === "ACTIVE" && solta.novasAtivas[0] === "b" && solta.statuses.get("c") === "WAITING", "solta: uma etapa de trabalho acrescentada já nasce ativa e a aprovação continua esperando");
  const fila = aoReavaliar("SEQUENTIAL", [etapa("a", 1, "WORK", "ACTIVE"), etapa("b", 2, "WORK", "WAITING")]);
  assert(fila.novasAtivas.length === 0 && fila.statuses.get("b") === "WAITING", "fila: acrescentar uma etapa não tira a vez de quem está com ela");
  // A etapa nova entra antes de uma aprovação que já estava na vez: a aprovação volta a esperar.
  const aprovacaoAtiva = aoReavaliar("FREE", [etapa("a", 1, "WORK", "DONE"), etapa("b", 2, "WORK", "WAITING"), etapa("c", 3, "APPROVAL", "ACTIVE")]);
  assert(aprovacaoAtiva.statuses.get("b") === "ACTIVE" && aprovacaoAtiva.statuses.get("c") === "WAITING" && aprovacaoAtiva.novasAtivas.join() === "b", `solta: acrescentar trabalho com a aprovação já ativa devolve a aprovação a esperar (${dizer(aprovacaoAtiva.statuses, ["a", "b", "c"])})`);
  const filaAprovacao = aoReavaliar("SEQUENTIAL", [etapa("a", 1, "WORK", "DONE"), etapa("n", 2, "WORK", "WAITING"), etapa("c", 3, "APPROVAL", "ACTIVE")]);
  assert(filaAprovacao.statuses.get("n") === "ACTIVE" && filaAprovacao.statuses.get("c") === "WAITING", `fila: etapa de trabalho acrescentada antes da aprovação ativa passa na frente (${dizer(filaAprovacao.statuses, ["a", "n", "c"])})`);
  const filaParada = aoReavaliar("SEQUENTIAL", [etapa("a", 1, "WORK", "DONE"), etapa("b", 2, "WORK", "WAITING")]);
  assert(filaParada.statuses.get("b") === "ACTIVE", "fila: se ninguém tinha a vez, a etapa acrescentada recebe a vez");
}

// ── Status da tarefa ────────────────────────────────────────────────────────────
{
  assert(statusDaTarefa([etapa("a", 1, "WORK", "ACTIVE")], "CREATED") === "CREATED", "nada começou: a tarefa é A fazer");
  assert(statusDaTarefa([etapa("a", 1, "WORK", "ACTIVE", "p1", new Date())], "CREATED") === "IN_PROGRESS", "alguém começou uma etapa: Em andamento");
  assert(statusDaTarefa([etapa("a", 1, "WORK", "ACTIVE")], "CHANGES_REQUESTED") === "CHANGES_REQUESTED", "depois de pedir ajustes, fica em Ajustes até alguém começar a etapa devolvida");
  assert(statusDaTarefa([etapa("a", 1, "WORK", "ACTIVE", "p1", new Date())], "CHANGES_REQUESTED") === "IN_PROGRESS", "quando a etapa devolvida começa, volta a Em andamento");
  assert(statusDaTarefa([etapa("a", 1, "WORK", "DONE"), etapa("b", 2, "WORK", "WAITING")], "CREATED") === "IN_PROGRESS", "uma etapa já feita e outra esperando: Em andamento");
}

if (failures.length) { console.error(`\n${failures.length} falha(s); ${passed} verificações passaram.`); process.exit(1); }
console.log(`✓ Tarefas em etapas (estado, sem banco): ${passed} verificações passaram.`);
