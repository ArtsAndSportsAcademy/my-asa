/** Regeneração de Escala não apaga: alocações e exceções ficam desativadas, preservadas. PostgreSQL real de teste. */
import http from "node:http";
import { and, eq, inArray, isNull, or } from "drizzle-orm";
import {
  agendaEventsTable,
  allocationCandidatesTable,
  allocationExceptionsTable,
  db,
  historyEventsTable,
  operationalChangesTable,
  operationsTable,
  organizationsTable,
  pool,
  scaleAllocationsTable,
  scalesTable,
  userRolesTable,
  usersTable,
} from "@workspace/db";
import app from "../src/application.js";
import { signAccessToken } from "../src/lib/jwt.service.js";

let passed = 0;
const failures: string[] = [];
function assert(condition: boolean, message: string) {
  if (condition) passed += 1;
  else { failures.push(message); console.error(`  ✗ ${message}`); }
}

async function run() {
  const tag = `scalerm_${Date.now()}`;
  const date = "2026-10-05";
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [operation] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const [admin] = await db.insert(usersTable).values({ organizationId: org!.id, name: `${tag}_admin`, username: `${tag}_admin` }).returning();
  const [memberA] = await db.insert(usersTable).values({ organizationId: org!.id, name: `${tag}_member_a`, username: `${tag}_member_a` }).returning();

  let server: http.Server | null = null;
  let scaleId: string | null = null;
  try {
    await db.insert(userRolesTable).values([{ userId: admin!.id, operationId: operation!.id, role: "ADMIN", active: true }]);

    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("servidor de teste não iniciou");
    const base = `http://127.0.0.1:${address.port}/api`;
    const adminToken = signAccessToken({ sub: admin!.id, jti: `${tag}_admin`, organizationId: org!.id, role: "ADMIN", operationIds: [operation!.id] });
    const request = (path: string, init: RequestInit = {}) => fetch(`${base}${path}`, {
      signal: AbortSignal.timeout(60_000), ...init,
      headers: { authorization: `Bearer ${adminToken}`, "content-type": "application/json", ...(init.headers ?? {}) },
    });
    const version = async (id: string) => (await db.select({ v: scalesTable.version }).from(scalesTable).where(eq(scalesTable.id, id)).limit(1))[0]!.v;

    // Escala por período, sem Livro do Show: o motor não roda (sem posições a gerar).
    // Simulamos um estado já gerado inserindo alocação + exceção + candidato direto no banco.
    const generated = await request("/scales/generate", { method: "POST", body: JSON.stringify({ operationId: operation!.id, periodStart: date, periodEnd: date }) });
    const genBody = await generated.json() as { scale?: { id: string } };
    scaleId = genBody.scale?.id ?? "";
    assert(generated.status === 201 && Boolean(scaleId), "gera a Escala de referência (rascunho, sem Livro do Show)");
    if (!scaleId) throw new Error("geração falhou");

    // Simula uma alocação que o motor teria gerado (com agendaEventId): é essa
    // que a regeneração substitui. Alocação manual (sem agendaEventId) fica de fora — regra preexistente, não deste ajuste.
    const [event] = await db.insert(agendaEventsTable).values({ operationId: operation!.id, type: "OPERATIONAL_BLOCK", title: `${tag}_evento`, date, status: "CONFIRMED", createdBy: admin!.id }).returning();
    const [oldAlloc] = await db.insert(scaleAllocationsTable).values({ scaleId, agendaEventId: event!.id, userId: memberA!.id, status: "ASSIGNED" }).returning();
    const [oldException] = await db.insert(allocationExceptionsTable).values({ scaleId, type: "NO_CANDIDATE", reason: `${tag}_sem_candidato` }).returning();
    const [oldCandidate] = await db.insert(allocationCandidatesTable).values({ scaleId, allocationId: oldAlloc!.id, userId: memberA!.id, rank: 1, eligible: true, compatible: true, priorityScore: 10 }).returning();

    const regenerated = await request(`/scales/${scaleId}/regenerate`, { method: "POST", body: JSON.stringify({ expectedVersion: await version(scaleId) }) });
    assert(regenerated.status === 200, "regenerar a Escala em rascunho responde 200");

    const allocAfter = (await db.select().from(scaleAllocationsTable).where(eq(scaleAllocationsTable.id, oldAlloc!.id)))[0];
    const exceptionAfter = (await db.select().from(allocationExceptionsTable).where(eq(allocationExceptionsTable.id, oldException!.id)))[0];
    const candidateAfter = (await db.select().from(allocationCandidatesTable).where(eq(allocationCandidatesTable.id, oldCandidate!.id)))[0];
    assert(Boolean(allocAfter) && Boolean(exceptionAfter), "nenhuma linha foi apagada: alocação e exceção continuam no banco");
    assert(allocAfter?.active === false && exceptionAfter?.active === false, "alocação e exceção ficam desativadas pela regeneração");
    assert(candidateAfter?.active === true, "candidato ligado à alocação antiga não é tocado (preservado por FK, não por cascade delete)");

    const regeneratedBody = await regenerated.json() as { scale?: { totalAllocations?: number } };
    assert(regeneratedBody.scale?.totalAllocations === 0, "o resumo devolvido pela API não conta a alocação desativada");
    const summary = await request(`/scales/${scaleId}`);
    const summaryBody = await summary.json() as { scale?: { allocations?: unknown[]; exceptions?: unknown[] } };
    assert(summary.status === 200 && summaryBody.scale?.allocations?.length === 0 && summaryBody.scale?.exceptions?.length === 0, "reler a Escala não lista a alocação nem a exceção desativadas");

    const historyEvents = await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.entityId, scaleId), eq(historyEventsTable.action, "regenerated")));
    assert(historyEvents.length === 1, "Registro da regeneração gravado na mesma transação");

    // Regenerar de novo não reativa nem duplica o que já foi desativado.
    const idsBefore = (await db.select({ id: scaleAllocationsTable.id }).from(scaleAllocationsTable).where(eq(scaleAllocationsTable.scaleId, scaleId))).map((r) => r.id).sort();
    const again = await request(`/scales/${scaleId}/regenerate`, { method: "POST", body: JSON.stringify({ expectedVersion: await version(scaleId) }) });
    const idsAfter = (await db.select({ id: scaleAllocationsTable.id }).from(scaleAllocationsTable).where(eq(scaleAllocationsTable.scaleId, scaleId))).map((r) => r.id).sort();
    assert(again.status === 200 && JSON.stringify(idsBefore) === JSON.stringify(idsAfter), "regenerar de novo não duplica nem recria linhas já desativadas");

    // Escala publicada não pode ser regenerada nem apagada (guarda de estado já existente).
    await db.update(scalesTable).set({ status: "PUBLISHED" }).where(eq(scalesTable.id, scaleId));
    const blockedRegen = await request(`/scales/${scaleId}/regenerate`, { method: "POST", body: JSON.stringify({ expectedVersion: await version(scaleId) }) });
    assert(blockedRegen.status === 409, "regenerar Escala publicada é recusado");
    const blockedDelete = await request(`/scales/${scaleId}`, { method: "DELETE", body: JSON.stringify({ expectedVersion: await version(scaleId) }) });
    assert(blockedDelete.status === 409, "apagar Escala publicada é recusado");
    await db.update(scalesTable).set({ status: "DRAFT" }).where(eq(scalesTable.id, scaleId));

    // "Apagar" a Escala em rascunho arquiva; alocações continuam preservadas e desativadas.
    const deleted = await request(`/scales/${scaleId}`, { method: "DELETE", body: JSON.stringify({ expectedVersion: await version(scaleId) }) });
    const scaleRow = (await db.select().from(scalesTable).where(eq(scalesTable.id, scaleId)))[0];
    const allocStillThere = (await db.select().from(scaleAllocationsTable).where(eq(scaleAllocationsTable.id, oldAlloc!.id)))[0];
    assert(deleted.status === 200 && scaleRow?.status === "ARCHIVED" && Boolean(allocStillThere), "apagar a Escala em rascunho arquiva a escala; a linha da alocação continua no banco");
  } finally {
    if (server) { server.closeAllConnections?.(); await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve())); }
    const actors = [admin!.id, memberA!.id];
    const changes = await db.select({ id: operationalChangesTable.id }).from(operationalChangesTable).where(inArray(operationalChangesTable.actorId, actors));
    await db.delete(historyEventsTable).where(or(eq(historyEventsTable.orgId, org!.id), inArray(historyEventsTable.actorId, actors), changes.length ? inArray(historyEventsTable.moId, changes.map((change) => change.id)) : isNull(historyEventsTable.id)));
    await db.delete(operationalChangesTable).where(inArray(operationalChangesTable.actorId, actors));
    if (scaleId) {
      await db.delete(allocationCandidatesTable).where(eq(allocationCandidatesTable.scaleId, scaleId));
      await db.delete(allocationExceptionsTable).where(eq(allocationExceptionsTable.scaleId, scaleId));
      await db.delete(scaleAllocationsTable).where(eq(scaleAllocationsTable.scaleId, scaleId));
      await db.delete(scalesTable).where(eq(scalesTable.id, scaleId));
    }
    await db.delete(agendaEventsTable).where(eq(agendaEventsTable.operationId, operation!.id));
    await db.delete(userRolesTable).where(eq(userRolesTable.operationId, operation!.id));
    await db.delete(usersTable).where(inArray(usersTable.id, actors));
    await db.delete(operationsTable).where(eq(operationsTable.id, operation!.id));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, org!.id));
  }
  if (failures.length > 0) throw new Error(`${failures.length} falha(s) na desativação lógica da Escala`);
  process.stdout.write(`scale-logical-removal: ${passed} asserts passed\n`);
}

process.stdout.write("scale-logical-removal: starting\n");
try {
  await run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
