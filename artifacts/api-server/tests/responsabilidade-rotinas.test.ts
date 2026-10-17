/**
 * Lista fixa da responsabilidade — o que se faz sempre, com a repetição que quem cuida escolher.
 * Cobre: a conta da próxima data (diária, semanal, mensal, a cada N dias; fim de mês curto); marcar e desmarcar; o item
 * que não repete fica marcado; o item que repete volta sozinho no dia e avisa só o dono, uma vez; item removido não volta
 * nem avisa e pode ser restaurado; quem é de fora não vê nem mexe; tudo no Registro, remoção com motivo.
 */
import http from "node:http";
import { and, eq, inArray } from "drizzle-orm";
import { db, historyEventsTable, notificationOutboxTable, operationsTable, organizationsTable, pool, responsibilitiesTable, responsibilityAssignmentsTable, responsibilityRoutinesTable, userNotificationsTable, userRolesTable, usersTable } from "@workspace/db";
import app from "../src/application.js";
import { signAccessToken } from "../src/lib/jwt.service.js";
import { operationalDate } from "../src/lib/operational-date.js";
import { proximaData, voltarRotinas } from "../src/services/responsibility-routines.js";

let passed = 0; const failures: string[] = [];
const assert = (condition: boolean, label: string) => { if (condition) passed++; else { failures.push(label); console.error(`  ✗ ${label}`); } };
const lanca = (fn: () => unknown) => { try { fn(); return false; } catch { return true; } };

async function run() {
  // ── A conta da próxima data (sem banco) ────────────────────────────────────────
  assert(proximaData({ kind: "NONE" }, "2026-10-16") === null, "não repete: não há próxima data");
  assert(proximaData({ kind: "DAILY" }, "2026-10-16") === "2026-10-17", "todo dia: amanhã");
  assert(proximaData({ kind: "WEEKLY", weekday: 1 }, "2026-10-16") === "2026-10-19", "toda semana na segunda, a partir de uma sexta: a próxima segunda");
  assert(proximaData({ kind: "WEEKLY", weekday: 5 }, "2026-10-16") === "2026-10-23", "toda semana no mesmo dia da marcação: só na semana seguinte");
  assert(proximaData({ kind: "EVERY_N_DAYS", n: 3 }, "2026-10-16") === "2026-10-19", "a cada 3 dias");
  assert(proximaData({ kind: "MONTHLY" }, "2026-10-16") === "2026-11-16", "todo mês: o mesmo dia do mês seguinte");
  assert(proximaData({ kind: "MONTHLY" }, "2026-01-31") === "2026-02-28", "todo mês a partir do dia 31: vai para o último dia do mês curto");
  assert(proximaData({ kind: "MONTHLY" }, "2026-12-15") === "2027-01-15", "todo mês: vira o ano");
  assert(lanca(() => proximaData({ kind: "EVERY_N_DAYS" }, "2026-10-16")) && lanca(() => proximaData({ kind: "EVERY_N_DAYS", n: 366 }, "2026-10-16")) && lanca(() => proximaData({ kind: "EVERY_N_DAYS", n: 0 }, "2026-10-16")), "a cada N dias exige N de 1 a 365");
  assert(lanca(() => proximaData({ kind: "WEEKLY" }, "2026-10-16")) && lanca(() => proximaData({ kind: "WEEKLY", weekday: 7 }, "2026-10-16")), "toda semana exige o dia da semana (0 a 6)");

  const tag = `resp_rotinas_${Date.now()}`;
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const makeUser = async (name: string) => (await db.insert(usersTable).values({ organizationId: org!.id, name: `${tag}_${name}`, fullName: `${tag}_${name}`, username: `${tag}_${name}`, status: "ACTIVE", personStatus: "ACTIVE" }).returning())[0]!;
  const admin = await makeUser("admin"), ana = await makeUser("ana"), bia = await makeUser("bia"), fora = await makeUser("fora");
  const todos = [admin, ana, bia, fora];
  const [operation] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const [perucas] = await db.insert(responsibilitiesTable).values({ orgId: org!.id, operationId: operation!.id, title: "Perucas" }).returning();
  let server: http.Server | null = null;
  try {
    await db.insert(userRolesTable).values([
      { userId: admin.id, operationId: operation!.id, role: "ADMIN", active: true },
      ...[ana, bia, fora].map((person) => ({ userId: person.id, operationId: operation!.id, role: "MEMBER" as const, active: true })),
    ]);
    await db.insert(responsibilityAssignmentsTable).values([
      { responsibilityId: perucas!.id, memberId: ana.id, role: "PRIMARY", active: true },
      { responsibilityId: perucas!.id, memberId: bia.id, role: "SECONDARY", active: true },
    ]);
    server = http.createServer(app); await new Promise<void>(resolve => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address(); if (!address || typeof address === "string") throw new Error("servidor não iniciou");
    const base = `http://127.0.0.1:${address.port}/api`;
    const as = (userId: string, role: string) => async (path: string, init: { method?: string; body?: unknown } = {}) => {
      const response = await fetch(`${base}${path}`, { method: init.method ?? "GET", body: init.body === undefined ? undefined : JSON.stringify(init.body), signal: AbortSignal.timeout(60_000), headers: { authorization: `Bearer ${signAccessToken({ sub: userId, jti: `${tag}_${userId}`, organizationId: org!.id, role, operationIds: [operation!.id] })}`, "content-type": "application/json" } });
      const text = await response.text(); let json: any = null; try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
      return { status: response.status, json };
    };
    const adminApi = as(admin.id, "ADMIN"), anaApi = as(ana.id, "MEMBER"), biaApi = as(bia.id, "MEMBER"), foraApi = as(fora.id, "MEMBER");
    const rotas = `/responsibilities/${perucas!.id}/routines`;
    const linha = async (id: string) => (await db.select().from(responsibilityRoutinesTable).where(eq(responsibilityRoutinesTable.id, id)))[0]!;
    const hoje = operationalDate(new Date());

    // ── Criar e validar ────────────────────────────────────────────────────────────
    const fixo = await anaApi(rotas, { method: "POST", body: { title: "Conferir o estoque de perucas" } });
    const semanal = await anaApi(rotas, { method: "POST", body: { title: "Lavar as perucas depois do show", repeatKind: "WEEKLY", weekday: 1 } });
    const nDias = await biaApi(rotas, { method: "POST", body: { title: "Revisar as do Natal", repeatKind: "EVERY_N_DAYS", repeatN: 3 } });
    assert(fixo.status === 201 && semanal.status === 201 && nDias.status === 201 && fixo.json?.routine?.repeatKind === "NONE" && fixo.json?.routine?.ownerId === ana.id, `quem cuida cria itens, e o item é de quem criou (${fixo.status} ${semanal.status} ${nDias.status})`);
    const semN = await anaApi(rotas, { method: "POST", body: { title: "x", repeatKind: "EVERY_N_DAYS" } });
    const nGrande = await anaApi(rotas, { method: "POST", body: { title: "x", repeatKind: "EVERY_N_DAYS", repeatN: 400 } });
    const semTitulo = await anaApi(rotas, { method: "POST", body: { title: " " } });
    assert(semN.status === 400 && nGrande.status === 400 && semTitulo.status === 400 && /dias/i.test(semN.json?.message ?? ""), `repetição inválida e item sem título são recusados com a frase (${semN.status} ${nGrande.status} ${semTitulo.status} ${semN.json?.message})`);

    // ── Quem vê ────────────────────────────────────────────────────────────────────
    const deFora = await foraApi(rotas), deForaCria = await foraApi(rotas, { method: "POST", body: { title: "Intrusa" } });
    assert(deFora.status === 403 && deForaCria.status === 403 && /cuida/i.test(deFora.json?.message ?? ""), `quem é de fora não vê nem mexe, com a frase (${deFora.status} ${deForaCria.status})`);
    const lista = await biaApi(rotas), listaAdmin = await adminApi(rotas);
    assert(lista.status === 200 && lista.json?.routines?.length === 3 && listaAdmin.status === 200, "quem cuida e a Administração veem a lista");

    // ── Marcar e desmarcar ─────────────────────────────────────────────────────────
    const marcouFixo = await anaApi(`${rotas}/${fixo.json.routine.id}/check`, { method: "POST", body: {} });
    const fixoDepois = await linha(fixo.json.routine.id);
    assert(marcouFixo.status === 200 && fixoDepois.done && fixoDepois.nextDueOn === null && fixoDepois.lastDoneAt !== null, "o item que não repete fica marcado, sem próxima data");
    const marcouSemanal = await anaApi(`${rotas}/${semanal.json.routine.id}/check`, { method: "POST", body: {} });
    const semanalDepois = await linha(semanal.json.routine.id);
    assert(marcouSemanal.status === 200 && semanalDepois.done && semanalDepois.nextDueOn === proximaData({ kind: "WEEKLY", weekday: 1 }, hoje), `o item semanal agenda a próxima segunda (${semanalDepois.nextDueOn})`);
    const desmarcou = await anaApi(`${rotas}/${semanal.json.routine.id}/uncheck`, { method: "POST", body: {} });
    const desmarcado = await linha(semanal.json.routine.id);
    assert(desmarcou.status === 200 && !desmarcado.done && desmarcado.nextDueOn === null, "desmarcar abre o item de novo e tira a próxima data");
    const marcaDoOutro = await biaApi(`${rotas}/${fixo.json.routine.id}/uncheck`, { method: "POST", body: {} });
    assert(marcaDoOutro.status === 200, "quem cuida da responsabilidade marca e desmarca os itens dela, mesmo sendo de outra pessoa do grupo");

    // ── Editar a repetição ─────────────────────────────────────────────────────────
    const editou = await anaApi(`${rotas}/${fixo.json.routine.id}`, { method: "PATCH", body: { repeatKind: "DAILY" } });
    assert(editou.status === 200 && editou.json?.routine?.repeatKind === "DAILY", `quem cuida muda a repetição do item (${editou.status})`);

    // ── O item volta sozinho, e avisa só o dono, uma vez ────────────────────────────
    const ontem = new Date(Date.parse(`${hoje}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
    await db.update(responsibilityRoutinesTable).set({ done: true, nextDueOn: ontem }).where(eq(responsibilityRoutinesTable.id, semanal.json.routine.id));
    const cedo = await voltarRotinas(new Date("2026-10-20T08:00:00Z"), org!.id);
    assert(cedo.voltaram === 0, "antes das 8h locais nada volta");
    const agora = new Date(Date.parse(`${hoje}T15:00:00Z`));
    for (let i = 0; i < 3; i++) await voltarRotinas(agora, org!.id);
    const voltou = await linha(semanal.json.routine.id);
    const avisosDono = (await db.select().from(notificationOutboxTable).where(eq(notificationOutboxTable.userId, ana.id))).filter((row) => (row.payload as { type: string }).type === "responsibility.routine_back");
    assert(!voltou.done && voltou.nextDueOn === null, "no dia, o item volta a ficar aberto");
    assert(avisosDono.length === 1 && /Lavar as perucas/.test((avisosDono[0]!.payload as { message: string }).message), `o dono recebe um aviso só, mesmo com o ciclo rodando 3 vezes (${avisosDono.length})`);
    assert((await db.select().from(notificationOutboxTable).where(eq(notificationOutboxTable.userId, bia.id))).filter((row) => (row.payload as { type: string }).type === "responsibility.routine_back").length === 0, "o aviso não vai para os outros do grupo");

    // ── Remover (lógico, com motivo) e restaurar ───────────────────────────────────
    const semMotivo = await anaApi(`${rotas}/${nDias.json.routine.id}`, { method: "DELETE", body: {} });
    assert(semMotivo.status === 400, `remover sem motivo é recusado (${semMotivo.status})`);
    await db.update(responsibilityRoutinesTable).set({ done: true, nextDueOn: ontem }).where(eq(responsibilityRoutinesTable.id, nDias.json.routine.id));
    const removeu = await anaApi(`${rotas}/${nDias.json.routine.id}`, { method: "DELETE", body: { reason: "Já foi feito para o Natal" } });
    await voltarRotinas(agora, org!.id);
    const removido = await linha(nDias.json.routine.id);
    assert(removeu.status === 200 && !removido.active && removido.done && removido.removedReason === "Já foi feito para o Natal", "o item removido fica guardado, com o motivo, e não volta sozinho");
    assert((await anaApi(rotas)).json?.routines?.every((item: any) => item.id !== nDias.json.routine.id), "o item removido some da lista");
    const restaurou = await anaApi(`${rotas}/${nDias.json.routine.id}/restore`, { method: "POST", body: {} });
    assert(restaurou.status === 200 && (await linha(nDias.json.routine.id)).active, "dá para trazer o item de volta");

    // ── Registro ───────────────────────────────────────────────────────────────────
    const registro = await db.select().from(historyEventsTable).where(eq(historyEventsTable.orgId, org!.id));
    const acoes = new Set(registro.map((evento) => evento.action));
    assert(["responsibility.routine_created", "responsibility.routine_checked", "responsibility.routine_unchecked", "responsibility.routine_updated", "responsibility.routine_removed", "responsibility.routine_restored"].every((acao) => acoes.has(acao)), `cada passo gravou no Registro (${[...acoes].filter((acao) => acao.includes("routine")).join(", ")})`);
    assert(registro.some((evento) => evento.action === "responsibility.routine_removed" && JSON.stringify(evento.metadata).includes("Já foi feito para o Natal")), "o motivo da remoção está no Registro");
  } finally {
    const userIds = todos.map((person) => person.id);
    await db.delete(notificationOutboxTable).where(inArray(notificationOutboxTable.userId, userIds));
    await db.delete(userNotificationsTable).where(inArray(userNotificationsTable.userId, userIds));
    await db.delete(historyEventsTable).where(eq(historyEventsTable.orgId, org!.id));
    await db.delete(responsibilityRoutinesTable).where(eq(responsibilityRoutinesTable.responsibilityId, perucas!.id));
    await db.delete(responsibilityAssignmentsTable).where(eq(responsibilityAssignmentsTable.responsibilityId, perucas!.id));
    await db.delete(responsibilitiesTable).where(eq(responsibilitiesTable.orgId, org!.id));
    await db.delete(userRolesTable).where(inArray(userRolesTable.userId, userIds));
    await db.delete(usersTable).where(inArray(usersTable.id, userIds));
    await db.delete(operationsTable).where(eq(operationsTable.organizationId, org!.id));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, org!.id));
    if (server) await new Promise<void>(resolve => server!.close(() => resolve()));
    await pool.end();
  }
  if (failures.length) { console.error(`\n${failures.length} falha(s); ${passed} verificações passaram.`); process.exit(1); }
  console.log(`✓ Lista fixa das responsabilidades: ${passed} verificações passaram.`);
}
run().catch(error => { console.error(error); process.exit(1); });
