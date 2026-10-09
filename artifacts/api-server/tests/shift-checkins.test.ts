import assert from "node:assert/strict";
import http from "node:http";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { db, pool, organizationsTable, operationsTable, usersTable, userRolesTable, locationsTable, operationLocationsTable, areasTable, areaLocalSupervisorsTable, scalesTable, scaleAllocationsTable, shiftsTable, operationalCheckInsTable, dayCheckInsTable, historyEventsTable, notificationOutboxTable } from "@workspace/db";
import app from "../src/application.js";
import { signAccessToken } from "../src/lib/jwt.service.js";
import { answerShift, configureShifts, reconcileShiftCheckIns, shiftPlans, shiftsForDate, shiftInstant, visibleShiftPlans } from "../src/services/shift-checkins.js";
import { operationalDate, shiftOperationalDate } from "../src/lib/operational-date.js";

async function run() {
  const tag = `shift_qa_${Date.now()}`;
  const date = operationalDate(), yesterday = shiftOperationalDate(date, -1);
  const [org] = await db.insert(organizationsTable).values({ name: tag }).returning();
  const [op] = await db.insert(operationsTable).values({ organizationId: org!.id, name: tag, status: "ACTIVE" }).returning();
  const [area, otherArea] = await db.insert(areasTable).values([{ organizationId: org!.id, name: "QA área" }, { organizationId: org!.id, name: "QA outra" }]).returning();
  const people = await db.insert(usersTable).values(["admin", "sup", "worker", "late", "absent", "silent", "outside", "director"].map((name, i) => ({ organizationId: org!.id, name: `${tag}_${name}`, fullName: name, username: `${tag}_${name}`, areaId: i === 6 ? otherArea!.id : area!.id }))).returning();
  const [admin, sup, worker, late, absent, silent, outsider, director] = people;
  const [place, place2] = await db.insert(locationsTable).values([{ organizationId: org!.id, name: tag }, { organizationId: org!.id, name: `${tag}_2` }]).returning();
  let server: http.Server | undefined;
  const actor = (p: typeof worker, role = "MEMBER") => ({ sub: p!.id, role, organizationId: org!.id });
  const adminActor = actor(admin, "ADMIN");
  const schedule = [{ name: "Dia", startTime: "07:00", endTime: "18:00" }, { name: "Noite", startTime: "18:00", endTime: "22:00" }];
  try {
    await db.insert(operationLocationsTable).values([place, place2].map(p => ({ operationId: op!.id, locationId: p!.id })));
    await db.insert(userRolesTable).values(people.map((p, i) => ({ userId: p.id, operationId: op!.id, role: (i === 0 ? "ADMIN" : i === 1 ? "SUPERVISOR_A" : i === 7 ? "DIR" : "MEMBER") as "ADMIN" | "SUPERVISOR_A" | "MEMBER" | "DIR", active: true })));
    await db.insert(areaLocalSupervisorsTable).values({ supervisorId: sup!.id, areaId: area!.id, locationId: place!.id });
    const scales = await db.insert(scalesTable).values([place, place2].map(p => ({ operationId: op!.id, locationId: p!.id, title: tag, periodStart: date, periodEnd: date, status: "PUBLISHED" as const, createdBy: admin!.id, publishedAt: new Date() }))).returning();
    await db.insert(scaleAllocationsTable).values([
      ...[worker, late, absent, silent, outsider].map(p => ({ scaleId: scales[0]!.id, userId: p!.id, manualDate: date, manualLabel: "Ensaio", startTime: "10:00", endTime: "11:00", status: "ASSIGNED" as const })),
      { scaleId: scales[1]!.id, userId: worker!.id, manualDate: date, manualLabel: "Preparação", startTime: "12:00", endTime: "13:00", status: "ASSIGNED" },
      { scaleId: scales[0]!.id, userId: worker!.id, manualDate: date, manualLabel: "Extra", startTime: "23:00", endTime: "23:45", status: "ASSIGNED" },
    ]);
    await assert.rejects(configureShifts(actor(sup, "SUPERVISOR_A"), schedule), /Administração/);
    await configureShifts(adminActor, schedule, shiftInstant(yesterday, 600));
    const current = await shiftsForDate(org!.id, date);
    assert.equal(current.length, 2);
    const future = await configureShifts(adminActor, [{ name: "Amanhã", startTime: "06:00", endTime: "23:00" }]);
    assert.equal(future.effectiveFrom, shiftOperationalDate(date, 1));
    assert.deepEqual((await shiftsForDate(org!.id, date)).map(s => s.id), current.map(s => s.id));
    const tomorrowBefore = await shiftsForDate(org!.id, future.effectiveFrom);
    process.env.MYASA_TEST_FAIL_HISTORY = "1";
    await assert.rejects(configureShifts(adminActor, schedule), /Registro/);
    delete process.env.MYASA_TEST_FAIL_HISTORY;
    assert.deepEqual((await shiftsForDate(org!.id, future.effectiveFrom)).map(s => s.id), tomorrowBefore.map(s => s.id));
    const plans = await shiftPlans(org!.id, date);
    const workerDay = plans.find(p => p.userId === worker!.id && p.shiftName === "Dia")!;
    const workerNight = plans.find(p => p.userId === worker!.id && p.shiftName === "Noite")!;
    assert.equal(workerDay.activities.length, 2, "um check-in cobre dois locais");
    assert.equal(workerNight.closesAt.toISOString(), shiftInstant(date, 1425).toISOString());
    assert.equal(workerNight.extended, true);
    assert.equal((await visibleShiftPlans(actor(outsider), plans)).length, 1);
    assert.equal((await visibleShiftPlans(actor(sup, "SUPERVISOR_A"), plans)).some(p => p.userId === outsider!.id), false);
    const request = (p: typeof worker, shiftId = workerDay.shiftId) => ({ date, shiftId, userId: p!.id, action: "READY" as const });
    await assert.rejects(answerShift(actor(worker), request(worker), shiftInstant(date, 479)), /janela/);
    await assert.rejects(answerShift(actor(worker), request(outsider), shiftInstant(date, 600)), /somente/);
    await assert.rejects(answerShift(actor(sup, "SUPERVISOR_A"), request(outsider), shiftInstant(date, 600)), /acesso/);
    await assert.rejects(answerShift(actor(director, "DIR"), request(worker), shiftInstant(date, 600)), /leitura/);
    process.env.MYASA_TEST_FAIL_HISTORY = "1";
    await assert.rejects(answerShift(actor(worker), request(worker), shiftInstant(date, 600)), /Registro/);
    delete process.env.MYASA_TEST_FAIL_HISTORY;
    assert.equal((await db.select().from(operationalCheckInsTable).where(eq(operationalCheckInsTable.orgId, org!.id))).length, 0);
    assert.equal((await db.select().from(dayCheckInsTable).where(eq(dayCheckInsTable.userId, worker!.id))).length, 0);
    const concurrent = await Promise.allSettled([answerShift(actor(worker), request(worker), shiftInstant(date, 615)), answerShift(actor(worker), request(worker), shiftInstant(date, 615))]);
    assert.equal(concurrent.filter(r => r.status === "fulfilled").length, 1);
    const [arrival] = await db.select().from(operationalCheckInsTable).where(eq(operationalCheckInsTable.userId, worker!.id));
    assert.equal(arrival!.lateArrival, false, "15 minutos exatos ainda dentro da tolerância");
    assert.equal((await db.select().from(dayCheckInsTable).where(eq(dayCheckInsTable.userId, worker!.id))).length, 2);
    await answerShift(actor(late), { ...request(late), action: "LATE", etaMinutes: 20 }, shiftInstant(date, 590));
    await assert.rejects(answerShift(actor(absent), { ...request(absent), action: "ABSENT" }, shiftInstant(date, 590)), /motivo/);
    await answerShift(actor(absent), { ...request(absent), action: "ABSENT", reasonCode: "TRANSPORT" }, shiftInstant(date, 590));
    const absenceNotices = await db.select().from(notificationOutboxTable).where(eq(notificationOutboxTable.userId, sup!.id));
    assert.equal(absenceNotices.filter(row => row.payload.type === "checkin.shift_absence").length, 1, "supervisão recebe aviso de falta uma vez");
    const ownerNotices = await db.select().from(notificationOutboxTable).where(eq(notificationOutboxTable.userId, admin!.id));
    assert.equal(ownerNotices.filter(row => row.payload.type === "checkin.shift_absence").length, 1, "responsável pelo bloco manual também recebe aviso");
    const confirmed = await answerShift(actor(outsider), { ...request(outsider), action: "READY" }, shiftInstant(date, 616));
    assert.equal(confirmed.lateArrival, true);
    await answerShift(actor(worker), { ...request(worker, workerNight.shiftId), action: "LATE", etaMinutes: 20 }, shiftInstant(date, 1321));
    const reached = await answerShift(actor(sup, "SUPERVISOR_A"), { ...request(worker, workerNight.shiftId), action: "ARRIVED" }, shiftInstant(date, 1390));
    assert.equal(reached.etaMinutes, 20, "chegada preserva previsão original");
    assert.equal(reached.checkedInAt!.toISOString(), shiftInstant(date, 1390).toISOString());
    const close = await reconcileShiftCheckIns(shiftInstant(date, 1430), org!.id);
    assert.equal(close.closed, 6);
    assert.equal((await reconcileShiftCheckIns(shiftInstant(date, 1431), org!.id)).closed, 0);
    const rows = await db.select().from(operationalCheckInsTable).where(eq(operationalCheckInsTable.orgId, org!.id));
    assert.equal(rows.find(r => r.userId === silent!.id)!.shiftState, "NO_RESPONSE");
    assert.equal(rows.find(r => r.userId === silent!.id)!.status, "EXPECTED", "sem resposta não vira falta");
    assert.equal(rows.find(r => r.userId === late!.id)!.shiftState, "LATE_UNCONFIRMED");
    await assert.rejects(answerShift(actor(late), { ...request(late), action: "ARRIVED" }, shiftInstant(date, 1431)), /janela/);
    await db.update(scalesTable).set({ status: "DRAFT" }).where(eq(scalesTable.id, scales[0]!.id));
    const draftPlans = await shiftPlans(org!.id, date);
    assert.equal(draftPlans.length, 1, "rascunho não convoca; permanece apenas segundo local publicado");
    await db.update(scalesTable).set({ status: "PUBLISHED" }).where(eq(scalesTable.id, scales[0]!.id));

    server = http.createServer(app); await new Promise<void>(resolve => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address() as { port: number };
    const call = async (p: typeof worker, role: string, path: string, method = "GET", body?: unknown) => fetch(`http://127.0.0.1:${address.port}/api${path}`, { method, headers: { authorization: `Bearer ${signAccessToken({ ...actor(p, role), jti: tag, operationIds: [op!.id] })}`, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(60000) });
    assert.equal((await call(worker, "MEMBER", "/shift-checkins/configuration", "PUT", { shifts: schedule })).status, 403);
    assert.equal((await call(admin, "ADMIN", "/shift-checkins/configuration", "PUT", { shifts: [] })).status, 400);
    assert.equal((await call(worker, "MEMBER", "/shift-checkins?date=2026-02-30")).status, 400);
    const own = await call(worker, "MEMBER", `/shift-checkins?date=${date}`);
    assert.equal(own.status, 200);
    assert.equal((await own.json()).items.every((item: { userId: string }) => item.userId === worker!.id), true);
    const directorToday = await (await call(director, "DIR", `/shift-checkins?date=${date}`)).json();
    assert.equal(directorToday.items.length, 0, "Direção não recebe nomes no check-in");
    assert.ok(directorToday.summary.length > 0, "Direção recebe contagens");
    assert.equal((await call(worker, "MEMBER", "/day-checkins", "POST", { date })).status, 409);
    assert.equal((await call(worker, "MEMBER", "/check-ins/my", "POST", { date })).status, 409);
    const history = await call(worker, "MEMBER", `/shift-checkins/history?from=${date}&to=${date}`);
    assert.equal((await history.json()).records.length, 2);
    const directorHistory = await (await call(director, "DIR", `/shift-checkins/history?from=${date}&to=${date}`)).json();
    assert.equal(directorHistory.records.length, 0, "Direção não recebe nomes no histórico");
    assert.ok(directorHistory.aggregate.length > 0);
    const security = await db.execute(sql`SELECT relrowsecurity FROM pg_class WHERE oid = 'public.shifts'::regclass`);
    assert.equal(security.rows[0]!.relrowsecurity, true);
    console.log("✓ Check-in por turno: configuração, transações, concorrência, janela, tolerância, fechamento, escopo, API e RLS aprovados.");
  } finally {
    delete process.env.MYASA_TEST_FAIL_HISTORY;
    if (server) { server.closeAllConnections(); await new Promise<void>(resolve => server!.close(() => resolve())); }
    await db.delete(notificationOutboxTable).where(inArray(notificationOutboxTable.userId, people.map(p => p.id)));
    // A fila vira aviso assim que alguém processa a caixa (um servidor de desenvolvimento apontado
    // para este banco, por exemplo); sem apagar o aviso, a pessoa não pode ser removida no fim.
    const ids = people.map(p => p.id);
    await pool.query(`delete from user_notifications where user_id = any($1::uuid[])`, [ids]);
    await pool.query(`delete from notifications where user_id = any($1::uuid[])`, [ids]);
    await db.delete(historyEventsTable).where(or(eq(historyEventsTable.orgId, org!.id), inArray(historyEventsTable.actorId, people.map(p => p.id))));
    await db.delete(dayCheckInsTable).where(inArray(dayCheckInsTable.userId, people.map(p => p.id)));
    await db.delete(operationalCheckInsTable).where(eq(operationalCheckInsTable.orgId, org!.id));
    await db.delete(shiftsTable).where(eq(shiftsTable.organizationId, org!.id));
    await db.delete(scalesTable).where(eq(scalesTable.operationId, op!.id));
    await db.delete(areaLocalSupervisorsTable).where(eq(areaLocalSupervisorsTable.supervisorId, sup!.id));
    await db.delete(userRolesTable).where(inArray(userRolesTable.userId, people.map(p => p.id)));
    await db.delete(usersTable).where(eq(usersTable.organizationId, org!.id));
    await db.delete(areasTable).where(eq(areasTable.organizationId, org!.id));
    await db.delete(operationLocationsTable).where(eq(operationLocationsTable.operationId, op!.id));
    await db.delete(locationsTable).where(eq(locationsTable.organizationId, org!.id));
    await db.delete(operationsTable).where(eq(operationsTable.organizationId, org!.id));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, org!.id));
    await pool.end();
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
