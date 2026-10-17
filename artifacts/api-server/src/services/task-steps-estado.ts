/**
 * Tarefas em etapas — quem tem a vez. Funções puras, sem banco: recebem as etapas como estão e devolvem como ficam.
 *
 * Fila (SEQUENTIAL): só a primeira etapa nasce ativa; concluir uma abre a próxima que não foi dispensada.
 * Solta (FREE): todas as etapas de trabalho nascem ativas; cada aprovação só abre quando todas as outras
 * (que não foram dispensadas) estão feitas.
 * Sem etapa esperando nem ativa, a tarefa terminou.
 */
export type StepKind = "WORK" | "APPROVAL";
export type StepStatus = "WAITING" | "ACTIVE" | "DONE" | "DISPENSED";
export type Ordering = "SEQUENTIAL" | "FREE";
export type TaskStatusValue = "CREATED" | "IN_PROGRESS" | "READY_FOR_APPROVAL" | "CHANGES_REQUESTED" | "COMPLETED";

export type StepLite = { id: string; position: number; kind: StepKind; status: StepStatus; assigneeId: string; startedAt: Date | null };

export type Transicao = { statuses: Map<string, StepStatus>; novasAtivas: string[]; taskStatus: TaskStatusValue };

const porPosicao = <T extends { position: number }>(steps: T[]) => [...steps].sort((a, b) => a.position - b.position);
const copiar = (steps: StepLite[]) => new Map(steps.map((step) => [step.id, step.status] as [string, StepStatus]));

/** Aprovação solta só abre quando toda etapa que não é aprovação e não foi dispensada está feita. */
function aprovacaoPodeAbrir(steps: StepLite[], statuses: Map<string, StepStatus>) {
  return steps.every((step) => step.kind === "APPROVAL" || statuses.get(step.id) === "DONE" || statuses.get(step.id) === "DISPENSED");
}

/** Depois de uma mudança: abre quem tem a vez agora e devolve só o que foi aberto. */
function abrirQuemTemAVez(ordering: Ordering, steps: StepLite[], statuses: Map<string, StepStatus>, antes: Map<string, StepStatus>) {
  const ordenadas = porPosicao(steps);
  if (ordering === "SEQUENTIAL") {
    const jaAtiva = ordenadas.some((step) => statuses.get(step.id) === "ACTIVE");
    if (!jaAtiva) {
      const proxima = ordenadas.find((step) => statuses.get(step.id) === "WAITING");
      if (proxima) statuses.set(proxima.id, "ACTIVE");
    }
  } else {
    for (const step of ordenadas) {
      if (statuses.get(step.id) !== "WAITING") continue;
      if (step.kind === "WORK" || aprovacaoPodeAbrir(steps, statuses)) statuses.set(step.id, "ACTIVE");
    }
  }
  return ordenadas.filter((step) => antes.get(step.id) !== "ACTIVE" && statuses.get(step.id) === "ACTIVE").map((step) => step.id);
}

export function statusDaTarefa(steps: StepLite[], atual: TaskStatusValue): TaskStatusValue {
  const pendentes = steps.filter((step) => step.status === "WAITING" || step.status === "ACTIVE");
  if (!pendentes.length) return "COMPLETED";
  if (pendentes.some((step) => step.status === "ACTIVE" && step.kind === "APPROVAL")) return "READY_FOR_APPROVAL";
  const comecou = steps.some((step) => step.status === "DONE" || step.startedAt);
  const ativasJaComecadas = steps.some((step) => step.status === "ACTIVE" && step.startedAt);
  // Depois de "pedir ajustes", a tarefa fica em Ajustes até alguém começar a etapa devolvida.
  if (atual === "CHANGES_REQUESTED" && !ativasJaComecadas) return "CHANGES_REQUESTED";
  return comecou ? "IN_PROGRESS" : "CREATED";
}

export function statusesIniciais(ordering: Ordering, steps: Pick<StepLite, "id" | "kind" | "position">[]): Map<string, StepStatus> {
  const lite: StepLite[] = steps.map((step) => ({ ...step, status: "WAITING", assigneeId: "", startedAt: null }));
  const statuses = new Map(lite.map((step) => [step.id, "WAITING" as StepStatus]));
  abrirQuemTemAVez(ordering, lite, statuses, new Map());
  return statuses;
}

function transicao(ordering: Ordering, steps: StepLite[], statuses: Map<string, StepStatus>, antes: Map<string, StepStatus>, atual: TaskStatusValue): Transicao {
  const novasAtivas = abrirQuemTemAVez(ordering, steps, statuses, antes);
  const depois = steps.map((step) => ({ ...step, status: statuses.get(step.id)! }));
  return { statuses, novasAtivas, taskStatus: statusDaTarefa(depois, atual) };
}

export function aoConcluir(ordering: Ordering, steps: StepLite[], stepId: string): Transicao {
  const alvo = steps.find((step) => step.id === stepId);
  if (!alvo || alvo.status !== "ACTIVE") throw new Error("A etapa ainda não tem a vez ou já foi encerrada");
  const antes = copiar(steps), statuses = copiar(steps);
  statuses.set(stepId, "DONE");
  return transicao(ordering, steps, statuses, antes, "IN_PROGRESS");
}

export function aoDispensar(ordering: Ordering, steps: StepLite[], stepId: string): Transicao {
  const alvo = steps.find((step) => step.id === stepId);
  if (!alvo || (alvo.status !== "ACTIVE" && alvo.status !== "WAITING")) throw new Error("Só se dispensa uma etapa que ainda não foi feita");
  const antes = copiar(steps), statuses = copiar(steps);
  statuses.set(stepId, "DISPENSED");
  return transicao(ordering, steps, statuses, antes, "IN_PROGRESS");
}

export function aoPedirAjustes(steps: StepLite[], aprovacaoId: string, voltarParaId: string, ordering: Ordering = "SEQUENTIAL"): Transicao & { taskStatus: "CHANGES_REQUESTED" } {
  const aprovacao = steps.find((step) => step.id === aprovacaoId);
  if (!aprovacao || aprovacao.kind !== "APPROVAL" || aprovacao.status !== "ACTIVE") throw new Error("Só se pedem ajustes numa aprovação que está ativa");
  const destino = steps.find((step) => step.id === voltarParaId);
  if (!destino || destino.kind !== "WORK" || destino.position >= aprovacao.position || destino.status === "DISPENSED") throw new Error("Escolha uma etapa de trabalho anterior à aprovação");
  const antes = copiar(steps), statuses = copiar(steps);
  statuses.set(voltarParaId, "ACTIVE");
  for (const step of steps) {
    if (step.id === voltarParaId || step.status === "DISPENSED") continue;
    // Em fila, tudo que vem depois da etapa devolvida refaz o caminho; solta, só as aprovações esperam de novo.
    if (ordering === "SEQUENTIAL" ? step.position > destino.position : step.kind === "APPROVAL") statuses.set(step.id, "WAITING");
  }
  return { statuses, novasAtivas: antes.get(voltarParaId) === "ACTIVE" ? [] : [voltarParaId], taskStatus: "CHANGES_REQUESTED" };
}
