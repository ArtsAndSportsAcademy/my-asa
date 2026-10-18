/**
 * Os laços do ciclo por minuto (turnos e lembretes) passaram a rodar locais, casas e pessoas em paralelo.
 * Este teste prova duas coisas, num cenário com 3 locais e a mesma pessoa em mais de um deles:
 *  1. o resultado é o de sempre (planos, ordem das atividades, quantos turnos fecham, o que fica gravado);
 *  2. rodar o ciclo duas vezes ao mesmo tempo não fecha o turno em dobro, não duplica o Registro nem o aviso.
 * Os valores esperados foram escritos à mão a partir das regras (não calculados pelo código), por isso o teste vale
 * igualmente para a versão em fila e para a em paralelo.
 */
import assert from "node:assert/strict";
import { eq, inArray, or } from "drizzle-orm";
import { db, pool, organizationsTable, operationsTable, usersTable, userRolesTable, locationsTable, operationLocationsTable, areasTable, scalesTable, scaleAllocationsTable, shiftsTable, operationalCheckInsTable, dayCheckInsTable, historyEventsTable, notificationOutboxTable } from "@workspace/db";
import { configureShifts, reconcileShiftCheckIns, shiftPlans, shiftInstant } from "../src/services/shift-checkins.js";
import { enqueueEscalaReminders } from "../src/services/operational-jobs.js";
import { operationalDate, shiftOperationalDate } from "../src/lib/operational-date.js";

async function run() {
  const tag = `ciclo_par_${Date.now()}`;
  const date = operationalDate(), yesterday = shiftOperationalDate(date, -1);
  const [org] = await db.insert(organizationsTable).values({ name: tag }).returning();
  const [op] = await db.insert(operationsTable).values({ organizationId: org!.id, name: tag, status: "ACTIVE" }).returning();
  const [area] = await db.insert(areasTable).values([{ organizationId: org!.id, name: "QA área" }]).returning();
  const people = await db.insert(usersTable).values(["admin", "ana", "bia", "caio", "dani", "edu"].map((name) => ({ organizationId: org!.id, name: `${tag}_${name}`, fullName: name, username: `${tag}_${name}`, areaId: area!.id }))).returning();
  const [admin, ana, bia, caio, dani, edu] = people;
  const locais = await db.insert(locationsTable).values([1, 2, 3].map((n) => ({ organizationId: org!.id, name: `${tag}_L${n}` }))).returning();
  const [l1, l2, l3] = locais;
  try {
    await db.insert(operationLocationsTable).values(locais.map((l) => ({ operationId: op!.id, locationId: l.id })));
    await db.insert(userRolesTable).values(people.map((p, i) => ({ userId: p.id, operationId: op!.id, role: (i === 0 ? "ADMIN" : "MEMBER") as "ADMIN" | "MEMBER", active: true })));
    // Uma escala publicada por local, cobrindo ontem e hoje.
    const escalas = await db.insert(scalesTable).values(locais.map((l) => ({ operationId: op!.id, locationId: l.id, title: tag, periodStart: yesterday, periodEnd: date, status: "PUBLISHED" as const, createdBy: admin!.id, publishedAt: new Date() }))).returning();
    const [e1, e2, e3] = escalas;
    const atividade = (escala: typeof e1, pessoa: typeof ana, dia: string, rotulo: string, inicio: string, fim: string) =>
      ({ scaleId: escala!.id, userId: pessoa!.id, manualDate: dia, manualLabel: rotulo, startTime: inicio, endTime: fim, status: "ASSIGNED" as const });
    await db.insert(scaleAllocationsTable).values([
      // Hoje: Ana em dois locais (um check-in só, duas atividades), Bia, Caio e Dani em um local cada.
      atividade(e2, ana, date, "Ensaio B", "10:30", "11:30"),
      atividade(e1, ana, date, "Ensaio A", "10:00", "11:00"),
      atividade(e1, bia, date, "Ensaio A", "10:00", "11:00"),
      atividade(e3, caio, date, "Ensaio C", "10:10", "11:00"),
      atividade(e3, dani, date, "Ensaio C", "10:10", "11:00"),
      // Ontem: Ana, Bia e Edu em locais diferentes (turnos de ontem a fechar).
      atividade(e1, ana, yesterday, "Ontem A", "09:00", "10:00"),
      atividade(e2, bia, yesterday, "Ontem B", "09:00", "10:00"),
      atividade(e3, edu, yesterday, "Ontem C", "09:30", "10:30"),
    ]);
    const adminActor = { sub: admin!.id, role: "ADMIN", organizationId: org!.id };
    await configureShifts(adminActor, [{ name: "Dia", startTime: "07:00", endTime: "18:00" }, { name: "Noite", startTime: "18:00", endTime: "22:00" }], shiftInstant(shiftOperationalDate(yesterday, -1), 600));

    // ── 1. Igualdade: o plano de hoje e o de ontem
    const hoje = await shiftPlans(org!.id, date);
    assert.equal(hoje.length, 4, "hoje: Ana, Bia, Caio e Dani, uma ocorrência por pessoa e turno");
    assert.ok(hoje.every((p) => p.shiftName === "Dia"));
    const daAna = hoje.find((p) => p.userId === ana!.id)!;
    assert.deepEqual(daAna.activities.map((a) => [a.label, a.startTime, a.locationId]), [["Ensaio A", "10:00", l1!.id], ["Ensaio B", "10:30", l2!.id]], "um check-in cobre os dois locais, em ordem de horário");
    assert.deepEqual(hoje.map((p) => p.userId).sort(), [ana!.id, bia!.id, caio!.id, dani!.id].sort());
    assert.deepEqual(daAna.firstActivityAt, shiftInstant(date, 600));
    const ontem = await shiftPlans(org!.id, yesterday);
    assert.deepEqual(ontem.map((p) => p.userId).sort(), [ana!.id, bia!.id, edu!.id].sort());
    assert.equal(ontem.find((p) => p.userId === edu!.id)!.activities[0]!.locationId, l3!.id);

    // ── 2. Fechamento: uma só vez, também com dois ciclos ao mesmo tempo
    const agora = shiftInstant(date, 1430); // fim do dia: o turno Dia de hoje e o de ontem já passaram do limite
    const [c1, c2] = await Promise.all([reconcileShiftCheckIns(agora, org!.id), reconcileShiftCheckIns(agora, org!.id)]);
    assert.equal(c1.closed + c2.closed, 7, "3 turnos de ontem + 4 de hoje, cada um fechado uma vez só entre os dois ciclos");
    const fechados = await db.select().from(operationalCheckInsTable).where(eq(operationalCheckInsTable.orgId, org!.id));
    assert.equal(fechados.length, 7);
    assert.equal(new Set(fechados.map((r) => `${r.userId}:${r.date}:${r.shiftId}`)).size, 7, "nenhuma linha em dobro");
    assert.ok(fechados.every((r) => r.closedAt && r.shiftState === "NO_RESPONSE"));
    const registro = await db.select().from(historyEventsTable).where(eq(historyEventsTable.orgId, org!.id));
    assert.equal(registro.filter((e) => e.action === "checkin.shift_closed").length, 7, "um evento no Registro por turno fechado");
    // Terceiro ciclo: nada a fechar, nada novo no Registro.
    assert.equal((await reconcileShiftCheckIns(agora, org!.id)).closed, 0);
    assert.equal((await db.select().from(historyEventsTable).where(eq(historyEventsTable.orgId, org!.id))).filter((e) => e.action === "checkin.shift_closed").length, 7);

    // ── 3. Lembrete do turno: um por pessoa, mesmo com dois ciclos juntos e repetidos
    await db.delete(operationalCheckInsTable).where(eq(operationalCheckInsTable.orgId, org!.id));
    const aberturaDoDia = shiftInstant(date, 600); // 10:00: dentro da antecedência de todos os planos de hoje
    const [r1, r2] = await Promise.all([enqueueEscalaReminders(aberturaDoDia, org!.id), enqueueEscalaReminders(aberturaDoDia, org!.id)]);
    assert.equal(r1.enqueued, 4);
    assert.equal(r2.enqueued, 4, "cada ciclo tenta os 4, a chave de deduplicação é que impede o segundo aviso");
    await enqueueEscalaReminders(aberturaDoDia, org!.id);
    const avisos = (await db.select().from(notificationOutboxTable).where(inArray(notificationOutboxTable.userId, people.map((p) => p.id))))
      .filter((a) => a.payload.type === "checkin.shift_reminder");
    assert.equal(avisos.length, 4, "um aviso por pessoa, não um por tentativa");
    assert.deepEqual(avisos.map((a) => a.userId).sort(), [ana!.id, bia!.id, caio!.id, dani!.id].sort());
    console.log("✓ Ciclo em paralelo: planos, fechamento único, Registro e lembrete sem duplicar.");
  } finally {
    const ids = people.map((p) => p.id);
    await db.delete(notificationOutboxTable).where(inArray(notificationOutboxTable.userId, ids));
    await pool.query(`delete from user_notifications where user_id = any($1::uuid[])`, [ids]);
    await pool.query(`delete from notifications where user_id = any($1::uuid[])`, [ids]);
    await db.delete(historyEventsTable).where(or(eq(historyEventsTable.orgId, org!.id), inArray(historyEventsTable.actorId, ids)));
    await db.delete(dayCheckInsTable).where(inArray(dayCheckInsTable.userId, ids));
    await db.delete(operationalCheckInsTable).where(eq(operationalCheckInsTable.orgId, org!.id));
    await db.delete(shiftsTable).where(eq(shiftsTable.organizationId, org!.id));
    await db.delete(scalesTable).where(eq(scalesTable.operationId, op!.id));
    await db.delete(userRolesTable).where(inArray(userRolesTable.userId, ids));
    await db.delete(usersTable).where(eq(usersTable.organizationId, org!.id));
    await db.delete(areasTable).where(eq(areasTable.organizationId, org!.id));
    await db.delete(operationLocationsTable).where(eq(operationLocationsTable.operationId, op!.id));
    await db.delete(locationsTable).where(eq(locationsTable.organizationId, org!.id));
    await db.delete(operationsTable).where(eq(operationsTable.organizationId, org!.id));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, org!.id));
    await pool.end();
  }
}
run().catch((e) => { console.error(e); process.exit(1); });
