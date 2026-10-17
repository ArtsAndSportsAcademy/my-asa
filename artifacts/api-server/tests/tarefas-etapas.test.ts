/**
 * Tarefas em etapas (API) — o que o desenho de 16/10/2026 promete a quem usa.
 * Cobre: o Elenco cria tarefa para colegas; só quem tem a vez recebe o aviso; quem concluiu não se avisa; a mesma pessoa
 * em duas etapas recebe um aviso só; quem não é da tarefa não a vê; Direção cria e vê; dispensar e reatribuir pedem
 * motivo e pessoa ativa; pedir ajustes devolve à etapa escolhida; o corpo antigo (uma pessoa, uma data) segue valendo;
 * tarefa sem prazo; limite de etapas; tudo no Registro.
 */
import http from "node:http";
import { and, eq, inArray } from "drizzle-orm";
import { db, historyEventsTable, notificationOutboxTable, operationsTable, organizationsTable, pool, taskStepsTable, tasksTable, userNotificationsTable, userRolesTable, usersTable } from "@workspace/db";
import app from "../src/application.js";
import { signAccessToken } from "../src/lib/jwt.service.js";
import { processNotificationOutbox } from "../src/services/notification-outbox.js";

let passed = 0; const failures: string[] = [];
const assert = (condition: boolean, label: string) => { if (condition) passed++; else { failures.push(label); console.error(`  ✗ ${label}`); } };

async function run() {
  const tag = `tarefas_etapas_${Date.now()}`;
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const makeUser = async (name: string, status: "ACTIVE" | "INACTIVE" = "ACTIVE") => (await db.insert(usersTable).values({ organizationId: org!.id, name: `${tag}_${name}`, fullName: `${tag}_${name}`, username: `${tag}_${name}`, status, personStatus: "ACTIVE" }).returning())[0]!;
  const admin = await makeUser("admin"), dir = await makeUser("dir"), ana = await makeUser("ana"), bia = await makeUser("bia"), cris = await makeUser("cris"), dan = await makeUser("dan"), eva = await makeUser("eva"), saiu = await makeUser("saiu", "INACTIVE");
  const todos = [admin, dir, ana, bia, cris, dan, eva, saiu];
  const [operation] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  let server: http.Server | null = null;
  try {
    await db.insert(userRolesTable).values([
      { userId: admin.id, operationId: operation!.id, role: "ADMIN", active: true },
      { userId: dir.id, operationId: operation!.id, role: "DIR", active: true },
      ...[ana, bia, cris, dan, eva, saiu].map((person) => ({ userId: person.id, operationId: operation!.id, role: "MEMBER" as const, active: true })),
    ]);
    server = http.createServer(app); await new Promise<void>(resolve => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address(); if (!address || typeof address === "string") throw new Error("servidor não iniciou");
    const base = `http://127.0.0.1:${address.port}/api`;
    const as = (userId: string, role: string) => async (path: string, init: { method?: string; body?: unknown } = {}) => {
      const response = await fetch(`${base}${path}`, { method: init.method ?? "GET", body: init.body === undefined ? undefined : JSON.stringify(init.body), signal: AbortSignal.timeout(60_000), headers: { authorization: `Bearer ${signAccessToken({ sub: userId, jti: `${tag}_${userId}`, organizationId: org!.id, role, operationIds: [operation!.id] })}`, "content-type": "application/json" } });
      const text = await response.text();
      let json: any = null; try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
      return { status: response.status, json };
    };
    const adminApi = as(admin.id, "ADMIN"), dirApi = as(dir.id, "DIR"), anaApi = as(ana.id, "MEMBER"), biaApi = as(bia.id, "MEMBER"), crisApi = as(cris.id, "MEMBER"), danApi = as(dan.id, "MEMBER"), evaApi = as(eva.id, "MEMBER");
    // A rota já tenta entregar os avisos na hora (sem esperar a resposta); aqui a gente espera tudo terminar de sair.
    const userIds = todos.map((person) => person.id);
    const entrega = async () => {
      for (let i = 0; i < 60; i++) {
        await processNotificationOutbox(async () => {});
        const faltam = await db.select({ id: notificationOutboxTable.id }).from(notificationOutboxTable).where(and(inArray(notificationOutboxTable.userId, userIds), inArray(notificationOutboxTable.status, ["pending", "sending"])));
        if (!faltam.length) return;
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    };
    const avisos = (userId: string, type: string) => db.select().from(userNotificationsTable).where(and(eq(userNotificationsTable.userId, userId), eq(userNotificationsTable.type, type)));
    const etapasDe = (taskId: string) => db.select().from(taskStepsTable).where(eq(taskStepsTable.taskId, taskId)).orderBy(taskStepsTable.position);
    const estados = async (taskId: string) => (await etapasDe(taskId)).map((step) => step.status).join(",");

    // ── O Elenco cria tarefa de 4 etapas para colegas ───────────────────────────────
    const criada = await anaApi("/tasks", { method: "POST", body: { operationId: operation!.id, title: "Vídeo de Natal", description: "Para o TikTok", dueDate: "2026-12-30", steps: [
      { title: "Roteiro", assigneeId: bia.id, description: "Falas e cenas", checklist: ["Ideia", "Texto"] },
      { title: "Gravar", assigneeId: cris.id },
      { title: "Editar", assigneeId: dan.id, dueDate: "2026-12-28" },
      { title: "Aprovar", kind: "APPROVAL", assigneeId: admin.id },
    ] } });
    assert(criada.status === 201 && criada.json?.steps?.length === 4, `Elenco cria tarefa de 4 etapas para colegas (${criada.status} ${JSON.stringify(criada.json).slice(0, 160)})`);
    const tarefaId: string = criada.json?.task?.id;
    const etapas = await etapasDe(tarefaId);
    assert(etapas.map((step) => step.status).join(",") === "ACTIVE,WAITING,WAITING,WAITING", `Em fila só a primeira etapa nasce ativa (${etapas.map((step) => step.status).join(",")})`);
    assert(etapas[0]?.checklist.length === 2 && etapas[0]?.checklist[0]?.completed === false && etapas[0]?.description === "Falas e cenas", "A etapa guarda checklist e descrição");
    const [tarefa] = await db.select().from(tasksTable).where(eq(tasksTable.id, tarefaId));
    assert(tarefa?.status === "CREATED" && tarefa?.assigneeId === bia.id && tarefa?.creatorId === ana.id && tarefa?.requiresApproval === true, `A tarefa guarda a pessoa da vez (${tarefa?.status} ${tarefa?.assigneeId === bia.id})`);

    await entrega();
    assert((await avisos(bia.id, "task.step_ready")).length === 1, "Quem tem a vez recebe o aviso na criação");
    assert((await avisos(cris.id, "task.step_ready")).length === 0 && (await avisos(dan.id, "task.step_ready")).length === 0, "Quem ainda espera não recebe aviso");
    assert((await avisos(ana.id, "task.step_ready")).length === 0, "Quem criou não se avisa");

    // ── Quem pode ver e quem pode agir ──────────────────────────────────────────────
    const intrusa = await evaApi(`/tasks/${tarefaId}`);
    assert(intrusa.status === 403 && /não é sua|não participa|sem acesso/i.test(`${intrusa.json?.message ?? ""}`), `Quem não é da tarefa não a vê, com uma frase que explica (${intrusa.status} ${intrusa.json?.message})`);
    const veAdmin = await adminApi(`/tasks/${tarefaId}`), veDir = await dirApi(`/tasks/${tarefaId}`), veCria = await anaApi(`/tasks/${tarefaId}`);
    assert(veAdmin.status === 200 && veAdmin.json?.steps?.length === 4 && veDir.status === 200 && veCria.status === 200, "Administração, Direção e quem criou veem a tarefa com as etapas");
    const dirCria = await dirApi("/tasks", { method: "POST", body: { operationId: operation!.id, title: "Direção pede", steps: [{ title: "Fazer", assigneeId: eva.id }] } });
    assert(dirCria.status === 201 && dirCria.json?.task?.dueDate === null, `Direção cria, e a tarefa pode ficar sem prazo (${dirCria.status} ${dirCria.json?.task?.dueDate})`);

    const etapa1 = etapas[0]!, etapa2 = etapas[1]!, etapa3 = etapas[2]!, etapa4 = etapas[3]!;
    const outraPessoa = await crisApi(`/tasks/${tarefaId}/steps/${etapa1.id}/complete`, { method: "POST", body: {} });
    assert(outraPessoa.status === 403 && /sua/i.test(`${outraPessoa.json?.message ?? ""}`), `Etapa de outra pessoa não é concluída por você (${outraPessoa.status} ${outraPessoa.json?.message})`);
    const semAVez = await crisApi(`/tasks/${tarefaId}/steps/${etapa2.id}/complete`, { method: "POST", body: {} });
    assert(semAVez.status === 409, `Etapa que ainda não tem a vez não se conclui (${semAVez.status})`);

    // Checklist da etapa: só conclui com tudo marcado.
    const incompleto = await biaApi(`/tasks/${tarefaId}/steps/${etapa1.id}/complete`, { method: "POST", body: {} });
    assert(incompleto.status === 422, `Checklist da etapa incompleto impede concluir (${incompleto.status})`);
    const marcado = await biaApi(`/tasks/${tarefaId}/steps/${etapa1.id}`, { method: "PATCH", body: { checklist: etapa1.checklist.map((item) => ({ ...item, completed: true })) } });
    assert(marcado.status === 200, `Quem tem a etapa marca o checklist (${marcado.status})`);

    // ── Concluir passa a vez, sem avisar quem concluiu ──────────────────────────────
    const concluiu = await biaApi(`/tasks/${tarefaId}/steps/${etapa1.id}/complete`, { method: "POST", body: {} });
    assert(concluiu.status === 200 && (await estados(tarefaId)) === "DONE,ACTIVE,WAITING,WAITING", `Concluir a etapa 1 abre a 2 (${concluiu.status} ${await estados(tarefaId)})`);
    await entrega();
    assert((await avisos(cris.id, "task.step_ready")).length === 1 && (await avisos(bia.id, "task.step_ready")).length === 1, "Só a pessoa da etapa 2 é avisada; quem concluiu não");
    const [emAndamento] = await db.select().from(tasksTable).where(eq(tasksTable.id, tarefaId));
    assert(emAndamento?.status === "IN_PROGRESS" && emAndamento?.assigneeId === cris.id, `A tarefa passa a Em andamento com a pessoa da vez (${emAndamento?.status})`);

    // ── Dispensar e reatribuir ──────────────────────────────────────────────────────
    const semMotivo = await adminApi(`/tasks/${tarefaId}/steps/${etapa2.id}/dispense`, { method: "POST", body: {} });
    assert(semMotivo.status === 400, `Dispensar sem motivo é recusado (${semMotivo.status})`);
    const intrusaDispensa = await evaApi(`/tasks/${tarefaId}/steps/${etapa2.id}/dispense`, { method: "POST", body: { reason: "quero" } });
    assert(intrusaDispensa.status === 403, `Quem não é da gestão não dispensa etapa (${intrusaDispensa.status})`);
    const paraDesligada = await adminApi(`/tasks/${tarefaId}/steps/${etapa3.id}/reassign`, { method: "POST", body: { assigneeId: saiu.id, reason: "teste" } });
    assert(paraDesligada.status === 400 && /ativa/i.test(`${paraDesligada.json?.message ?? ""}`), `Passar a etapa para pessoa desligada é recusado com a frase (${paraDesligada.status} ${paraDesligada.json?.message})`);
    const dispensou = await adminApi(`/tasks/${tarefaId}/steps/${etapa2.id}/dispense`, { method: "POST", body: { reason: "A Cris grava junto com o Dan" } });
    assert(dispensou.status === 200 && (await estados(tarefaId)) === "DONE,DISPENSED,ACTIVE,WAITING", `Dispensar a etapa ativa abre a seguinte (${dispensou.status} ${await estados(tarefaId)})`);
    await entrega();
    assert((await avisos(dan.id, "task.step_ready")).length === 1, "Quem recebe a vez por causa da dispensa é avisado");

    // ── Aprovação como etapa e pedir ajustes ───────────────────────────────────────
    const danConclui = await danApi(`/tasks/${tarefaId}/steps/${etapa3.id}/complete`, { method: "POST", body: {} });
    const [aguardando] = await db.select().from(tasksTable).where(eq(tasksTable.id, tarefaId));
    assert(danConclui.status === 200 && aguardando?.status === "READY_FOR_APPROVAL", `Concluída a última etapa de trabalho, a tarefa aguarda aprovação (${aguardando?.status})`);
    const semComentario = await adminApi(`/tasks/${tarefaId}/request-changes`, { method: "POST", body: { backToStepId: etapa1.id } });
    assert(semComentario.status === 400, `Pedir ajustes exige explicar o que falta (${semComentario.status})`);
    const ajustes = await adminApi(`/tasks/${tarefaId}/request-changes`, { method: "POST", body: { comment: "O roteiro precisa de final", backToStepId: etapa1.id } });
    const [ajustando] = await db.select().from(tasksTable).where(eq(tasksTable.id, tarefaId));
    assert(ajustes.status === 200 && ajustando?.status === "CHANGES_REQUESTED" && (await estados(tarefaId)) === "ACTIVE,DISPENSED,WAITING,WAITING", `Pedir ajustes devolve à etapa escolhida (${ajustes.status} ${ajustando?.status} ${await estados(tarefaId)})`);
    await entrega();
    assert((await avisos(bia.id, "task.step_ready")).length === 2, "A pessoa da etapa devolvida é avisada de novo");

    // ── Até o fim, com a aprovação concluindo a tarefa ──────────────────────────────
    await biaApi(`/tasks/${tarefaId}/steps/${etapa1.id}/complete`, { method: "POST", body: {} });
    await danApi(`/tasks/${tarefaId}/steps/${etapa3.id}/complete`, { method: "POST", body: {} });
    const naoAprova = await anaApi(`/tasks/${tarefaId}/steps/${etapa4.id}/complete`, { method: "POST", body: {} });
    assert(naoAprova.status === 403, `Só quem aprova conclui a aprovação (${naoAprova.status})`);
    const aprovou = await adminApi(`/tasks/${tarefaId}/steps/${etapa4.id}/complete`, { method: "POST", body: {} });
    const [fim] = await db.select().from(tasksTable).where(eq(tasksTable.id, tarefaId));
    assert(aprovou.status === 200 && ["APPROVED", "COMPLETED"].includes(fim?.status ?? "") && !!fim?.completedAt, `A última etapa concluída encerra a tarefa (${aprovou.status} ${fim?.status})`);
    const minhas = await biaApi("/tasks/my");
    assert(minhas.status === 200 && minhas.json?.tasks?.some((task: any) => task.id === tarefaId), "A tarefa continua na lista de quem fez uma etapa, mesmo depois de concluída");

    // ── A mesma pessoa em duas etapas ───────────────────────────────────────────────
    const solta = await adminApi("/tasks", { method: "POST", body: { operationId: operation!.id, title: "Duas para a Bia", ordering: "FREE", steps: [{ title: "Parte 1", assigneeId: bia.id }, { title: "Parte 2", assigneeId: bia.id }] } });
    await entrega();
    const avisosSolta = (await avisos(bia.id, "task.step_ready")).filter((aviso) => aviso.entityId === solta.json?.task?.id);
    assert(solta.status === 201 && avisosSolta.length === 1, `Duas etapas ativas da mesma pessoa geram um aviso só (${avisosSolta.length})`);
    const fila = await adminApi("/tasks", { method: "POST", body: { operationId: operation!.id, title: "Em fila para a Bia", steps: [{ title: "Primeira", assigneeId: bia.id }, { title: "Segunda", assigneeId: bia.id }] } });
    const filaEtapas = await etapasDe(fila.json?.task?.id);
    await entrega();
    await biaApi(`/tasks/${fila.json?.task?.id}/steps/${filaEtapas[0]!.id}/complete`, { method: "POST", body: {} });
    await entrega();
    const avisosFila = (await avisos(bia.id, "task.step_ready")).filter((aviso) => aviso.entityId === fila.json?.task?.id);
    assert(avisosFila.length === 1, `Em fila, quem conclui a primeira não é avisada da segunda que também é dela (${avisosFila.length})`);

    // ── Corpo antigo e limites ──────────────────────────────────────────────────────
    const antigo = await adminApi("/tasks", { method: "POST", body: { operationId: operation!.id, title: "Jeito antigo", assigneeId: cris.id, dueDate: "2026-12-30", requiresApproval: true, approverId: admin.id, mandatoryChecklist: [{ id: "c1", label: "Conferir", completed: false }] } });
    const antigoEtapas = await etapasDe(antigo.json?.task?.id);
    assert(antigo.status === 201 && antigoEtapas.length === 2 && antigoEtapas[0]?.kind === "WORK" && antigoEtapas[1]?.kind === "APPROVAL" && antigoEtapas[1]?.assigneeId === admin.id && antigoEtapas[0]?.checklist.length === 1, `O corpo antigo (uma pessoa, uma data, aprovação) vira duas etapas (${antigo.status} ${antigoEtapas.length})`);
    const muitas = await adminApi("/tasks", { method: "POST", body: { operationId: operation!.id, title: "Demais", steps: Array.from({ length: 21 }, (_, i) => ({ title: `E${i}`, assigneeId: bia.id })) } });
    assert(muitas.status === 400 && /20/.test(`${muitas.json?.message ?? ""}`), `Mais de 20 etapas é recusado com a frase (${muitas.status} ${muitas.json?.message})`);
    const semTitulo = await adminApi("/tasks", { method: "POST", body: { operationId: operation!.id, title: "  ", steps: [{ title: "x", assigneeId: bia.id }] } });
    const paraDesligadaNova = await adminApi("/tasks", { method: "POST", body: { operationId: operation!.id, title: "Para quem saiu", steps: [{ title: "x", assigneeId: saiu.id }] } });
    assert(semTitulo.status === 400 && paraDesligadaNova.status === 400, `Sem título, ou para pessoa desligada, a tarefa não nasce (${semTitulo.status} ${paraDesligadaNova.status})`);

    // ── Registro ────────────────────────────────────────────────────────────────────
    const registro = await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.entityId, tarefaId), eq(historyEventsTable.orgId, org!.id)));
    const acoes = new Set(registro.map((evento) => evento.action));
    assert(["task.created", "task.step_completed", "task.step_dispensed", "task.changes_requested"].every((acao) => acoes.has(acao)), `Cada passo gravou no Registro (${[...acoes].join(", ")})`);
    const dispensa = registro.find((evento) => evento.action === "task.step_dispensed");
    assert(JSON.stringify(dispensa?.metadata ?? {}).includes("A Cris grava junto com o Dan"), "O motivo da dispensa está no Registro");
  } finally {
    const orgTasks = await db.select({ id: tasksTable.id }).from(tasksTable).where(eq(tasksTable.organizationId, org!.id));
    const ids = orgTasks.map((task) => task.id);
    const userIds = todos.map((person) => person.id);
    await db.delete(notificationOutboxTable).where(inArray(notificationOutboxTable.userId, userIds));
    await db.delete(userNotificationsTable).where(inArray(userNotificationsTable.userId, userIds));
    await db.delete(historyEventsTable).where(eq(historyEventsTable.orgId, org!.id));
    if (ids.length) await db.delete(taskStepsTable).where(inArray(taskStepsTable.taskId, ids));
    await db.delete(tasksTable).where(eq(tasksTable.organizationId, org!.id));
    await db.delete(userRolesTable).where(inArray(userRolesTable.userId, userIds));
    await db.delete(usersTable).where(inArray(usersTable.id, userIds));
    await db.delete(operationsTable).where(eq(operationsTable.organizationId, org!.id));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, org!.id));
    if (server) await new Promise<void>(resolve => server!.close(() => resolve()));
    await pool.end();
  }
  if (failures.length) { console.error(`\n${failures.length} falha(s); ${passed} verificações passaram.`); process.exit(1); }
  console.log(`✓ Tarefas em etapas (API): ${passed} verificações passaram.`);
}
run().catch(error => { console.error(error); process.exit(1); });
