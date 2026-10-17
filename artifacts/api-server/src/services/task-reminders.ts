/**
 * Tarefas — lembretes de prazo, atrasada e parada. Rodam no ciclo operacional (uma vez por minuto), e cada aviso leva
 * uma chave de deduplicação: o ciclo pode passar mil vezes no dia que o aviso sai uma vez só.
 *
 * Quem recebe: só a pessoa da etapa que está com a vez (etapa que espera não recebe). O prazo vale o da etapa; sem ele,
 * o da tarefa (com período, o fim do período). Sem prazo nenhum, não há lembrete. Tarefa cancelada, concluída ou com a
 * etapa dispensada nunca avisa. Antes das 8h do horário local ninguém recebe, para o lembrete não acordar ninguém.
 */
import { and, eq, inArray, lte, notInArray } from "drizzle-orm";
import { db, taskStepsTable, tasksTable } from "@workspace/db";
import { OPERATIONAL_TIME_ZONE, operationalDate } from "../lib/operational-date.js";
import { enqueueNotification } from "./undo.js";

/** Dias sem ninguém mexer para a tarefa contar como "parada". Hoje fixo; a Administração poderá configurar. */
export const DIAS_PARADA = 3;
const HORA_MINIMA = 8;
const ENCERRADAS = ["APPROVED", "COMPLETED", "CANCELLED", "EXPIRED"] as const;

function minutosDoRelogio(now: Date) {
  const [hora, minuto] = new Intl.DateTimeFormat("en-GB", { timeZone: OPERATIONAL_TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now).split(":").map(Number);
  return hora! * 60 + minuto!;
}
const diaSeguinte = (iso: string) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };
const diasEntre = (de: string, ate: string) => Math.round((new Date(`${ate}T12:00:00Z`).getTime() - new Date(`${de}T12:00:00Z`).getTime()) / 86_400_000);
const curto = (iso: string) => iso.split("-").reverse().slice(0, 2).join("/");

export async function enqueueTaskReminders(now = new Date(), organizationId?: string) {
  const contagem = { aviso: 0, hoje: 0, atrasada: 0, parada: 0 };
  if (minutosDoRelogio(now) < HORA_MINIMA * 60) return contagem;
  const hoje = operationalDate(now), amanha = diaSeguinte(hoje);
  const filtroOrg = organizationId ? [eq(tasksTable.organizationId, organizationId)] : [];

  const ativas = await db.select({
    stepId: taskStepsTable.id, taskId: tasksTable.id, title: tasksTable.title, etapa: taskStepsTable.title, assigneeId: taskStepsTable.assigneeId,
    creatorId: tasksTable.creatorId, prazoEtapa: taskStepsTable.dueDate, prazoTarefa: tasksTable.dueDate,
  }).from(taskStepsTable).innerJoin(tasksTable, eq(tasksTable.id, taskStepsTable.taskId))
    .where(and(eq(taskStepsTable.active, true), eq(taskStepsTable.status, "ACTIVE"), notInArray(tasksTable.status, [...ENCERRADAS]), ...filtroOrg));

  const avisar = async (userId: string, type: string, title: string, message: string, taskId: string, chave: string) => {
    await db.transaction((tx) => enqueueNotification(tx, { userId, type, title, message, priority: "NORMAL", category: "responsibility", entityType: "task", entityId: taskId, actionUrl: "/responsabilidades" }, now, { deduplicationKey: chave }));
  };

  for (const etapa of ativas) {
    const prazo = etapa.prazoEtapa ?? etapa.prazoTarefa;
    if (!prazo) continue;
    const texto = `${etapa.title} — ${etapa.etapa}`;
    if (prazo === amanha) { await avisar(etapa.assigneeId, "task.due_soon", "Tarefa vence amanhã", `${texto} (até ${curto(prazo)}).`, etapa.taskId, `task-due-1:${etapa.stepId}:${prazo}`); contagem.aviso++; }
    else if (prazo === hoje) { await avisar(etapa.assigneeId, "task.due_today", "Tarefa vence hoje", `${texto}.`, etapa.taskId, `task-due-0:${etapa.stepId}:${prazo}`); contagem.hoje++; }
    else if (prazo < hoje) {
      // Atrasada: avisa no primeiro dia e depois a cada 3 dias, a pessoa da etapa e quem criou (uma vez só se for a mesma).
      const atraso = diasEntre(prazo, hoje);
      if (atraso % DIAS_PARADA !== 1) continue;
      const destinatarios = new Set([etapa.assigneeId, etapa.creatorId]);
      for (const userId of destinatarios) {
        await avisar(userId, "task.overdue", "Tarefa atrasada", `${texto} venceu em ${curto(prazo)}.`, etapa.taskId, `task-late:${etapa.stepId}:${userId}:${hoje}`);
      }
      contagem.atrasada++;
    }
  }

  // Parada: ninguém mexeu há DIAS_PARADA dias ou mais. Avisa quem criou, uma vez a cada bloco de 3 dias.
  const limite = new Date(now.getTime() - DIAS_PARADA * 86_400_000);
  const paradas = await db.select({ id: tasksTable.id, title: tasksTable.title, creatorId: tasksTable.creatorId, ultima: tasksTable.lastActivityAt })
    .from(tasksTable).where(and(notInArray(tasksTable.status, [...ENCERRADAS]), lte(tasksTable.lastActivityAt, limite), ...filtroOrg));
  for (const tarefa of paradas) {
    const dias = Math.floor((now.getTime() - tarefa.ultima.getTime()) / 86_400_000);
    await avisar(tarefa.creatorId, "task.stalled", "Tarefa parada", `${tarefa.title} está há ${dias} dias sem ninguém mexer.`, tarefa.id, `task-stalled:${tarefa.id}:${Math.floor(dias / DIAS_PARADA)}`);
    contagem.parada++;
  }
  return contagem;
}
