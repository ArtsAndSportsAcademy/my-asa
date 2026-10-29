/**
 * Equipe por local no Livro do Dia (0088, pacote O, passo O4): quem tem atividade em OUTRO local no horário do show conta como indisponível,
 * como na folga, e a reserva entra; a frase diz onde a pessoa está. A regra só liga quando a casa já usa equipe naquele dia (sem marca
 * nenhuma, nada muda). PostgreSQL real de teste.
 */
import { eq, inArray, or } from "drizzle-orm";
import {
  agendaEventsTable, areasTable, characterCastTable, charactersTable, db, historyEventsTable, locationsTable, operationLocationsTable, operationsTable,
  organizationsTable, pool, programacaoBlocosTable, programacaoEquipeTable, programacoesTable, showBookBlocksTable, showBookLinesTable, showBookRolesTable,
  showBookScenesTable, showBooksTable, userRolesTable, usersTable,
} from "@workspace/db";
import { carregarRegrasDoDia, codigoDaExcecao } from "../src/services/regras-de-escala.js";
import { resolveAssignmentsByRole } from "../src/services/line-resolver.js";

let passed = 0;
const failures: string[] = [];
function assert(condition: boolean, message: string) {
  if (condition) passed += 1;
  else { failures.push(message); console.error(`  ✗ ${message}`); }
}
const somarDias = (iso: string, dias: number) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + dias); return d.toISOString().slice(0, 10); };

async function run() {
  const tag = `livroeq_${Date.now()}`;
  const hoje = new Date().toISOString().slice(0, 10);
  let quinta = somarDias(hoje, 2);
  while (new Date(`${quinta}T12:00:00Z`).getUTCDay() !== 4) quinta = somarDias(quinta, 1);
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [operation] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const [snow, acqua] = await db.insert(locationsTable).values([{ organizationId: org!.id, name: `${tag}_Snowland` }, { organizationId: org!.id, name: `${tag}_Acqua` }]).returning();
  await db.insert(operationLocationsTable).values([{ operationId: operation!.id, locationId: snow!.id }, { operationId: operation!.id, locationId: acqua!.id }]);
  const [area] = await db.insert(areasTable).values({ organizationId: org!.id, name: `${tag}_Patinadores` }).returning();
  const mk = async (suffix: string, areaId: string | null) => (await db.insert(usersTable).values({ organizationId: org!.id, name: `${tag}_${suffix}`, username: `${tag}_${suffix}`, areaId }).returning())[0]!;
  const admin = await mk("admin", null), m1 = await mk("m1", area!.id), m2 = await mk("m2", area!.id), m3 = await mk("m3", area!.id);
  const todos = [admin, m1, m2, m3];
  await db.insert(userRolesTable).values([
    { userId: admin.id, operationId: operation!.id, role: "ADMIN", active: true },
    ...[m1, m2, m3].map((u) => ({ userId: u.id, operationId: operation!.id, role: "MEMBER" as const, active: true })),
  ]);
  // O show é da Acqua: uma vaga em rodízio, com a fila m1, m2, m3.
  const [personagem] = await db.insert(charactersTable).values({ name: `${tag}_Personagem`, locationId: acqua!.id, mode: "rodizio" }).returning();
  await db.insert(characterCastTable).values([m1, m2, m3].map((p, order) => ({ characterId: personagem!.id, personId: p.id, order })));
  const [show] = await db.insert(showBooksTable).values({ operationId: operation!.id, locationId: acqua!.id, title: `${tag}_Show`, createdBy: admin.id }).returning();
  const [cena] = await db.insert(showBookScenesTable).values({ showBookId: show!.id, name: "Cena", order: 0 }).returning();
  const [bloco] = await db.insert(showBookBlocksTable).values({ showBookId: show!.id, sceneId: cena!.id, name: "Palco", order: 0 }).returning();
  const [vaga] = await db.insert(showBookRolesTable).values({ showBookId: show!.id, blockId: bloco!.id, name: `${tag}_vaga`, order: 0 }).returning();
  await db.insert(showBookLinesTable).values({ positionId: vaga!.id, type: "CHARACTER", characterId: personagem!.id, config: {}, order: 0 });
  const evento = async (inicio: string, fim: string) => (await db.insert(agendaEventsTable).values({
    operationId: operation!.id, showBookId: show!.id, type: "SHOW", title: `${tag}_evento_${inicio}`, date: quinta, startTime: inicio, endTime: fim,
    status: "CONFIRMED", visibility: "MANAGEMENT", createdBy: admin.id,
  }).returning())[0]!;
  const quemFaz = async (eventId: string) => {
    const { byRole } = await resolveAssignmentsByRole(show!.id, operation!.id, quinta, { dedupPerScene: true, eventId });
    return (byRole.get(vaga!.id)?.people ?? []).map((p) => p.name.replace(`${tag}_`, ""));
  };

  try {
    const vigencia = { vigenciaInicio: somarDias(hoje, -5), vigenciaFim: somarDias(hoje, 60) };
    const [progS, progA] = await db.insert(programacoesTable).values([
      { organizationId: org!.id, locationId: snow!.id, nome: "Natal", ...vigencia, createdBy: admin.id },
      { organizationId: org!.id, locationId: acqua!.id, nome: "Natal Acqua", ...vigencia, createdBy: admin.id },
    ]).returning();
    // Snowland tem um treino da área das 09:30 às 11:00 na quinta.
    await db.insert(programacaoBlocosTable).values({ programacaoId: progS!.id, weekday: 4, inicio: "09:30", fim: "11:00", rotulo: "Treino", regra: "area", areaIds: [area!.id], createdBy: admin.id });
    const manha = await evento("10:00", "10:30");
    const tarde = await evento("14:00", "14:30");

    // Sem nenhuma marca de equipe, nada muda: a fila segue a ordem (m1 primeiro), mesmo com o treino em Snowland.
    assert((await quemFaz(manha.id))[0] === "m1", "sem equipe marcada a regra fica desligada: o rodízio escolhe a m1, como sempre");
    assert((await carregarRegrasDoDia({ eventId: manha.id, userIds: [m1.id], date: quinta, operationId: operation!.id })).bloqueios.size === 0, "sem equipe marcada, ninguém é barrado por estar em outro local");

    // Com equipe: a m1 trabalha em Snowland, a m2 na Acqua; a m3 não tem marca (como antes, entra em tudo).
    await db.insert(programacaoEquipeTable).values([
      { programacaoId: progS!.id, userId: m1.id, weekday: 4, createdBy: admin.id },
      { programacaoId: progA!.id, userId: m2.id, weekday: 4, createdBy: admin.id },
    ]);
    const regras = await carregarRegrasDoDia({ eventId: manha.id, userIds: [m1.id, m2.id, m3.id], date: quinta, operationId: operation!.id });
    const frase = regras.bloqueios.get(m1.id) ?? "";
    assert(regras.bloqueios.has(m1.id) && /Snowland/.test(frase) && /Treino/.test(frase) && /09:30–11:00/.test(frase), `a m1 é barrada com a frase de onde ela está (veio: ${frase})`);
    assert(!regras.bloqueios.has(m2.id), "a m2 (marcada na Acqua, onde é o show) fica livre");
    assert(regras.bloqueios.has(m3.id), "a m3, sem marca nenhuma, segue a regra de antes: entra no treino de Snowland e por isso também está ocupada");
    assert(regras.motivos.get(m1.id)?.[0]?.regra === "ATIVIDADE_EM_OUTRO_LOCAL" && codigoDaExcecao(regras.motivos.get(m1.id)!) === "PESSOA_EM_OUTRO_LOCAL", "a exceção à mão fala o código próprio (PESSOA_EM_OUTRO_LOCAL)");
    assert((await quemFaz(manha.id))[0] === "m2", "o rodízio pula a m1 (em Snowland) e a reserva m2 faz o show");

    // Fora do horário do treino a m1 volta a ser opção.
    assert((await quemFaz(tarde.id))[0] === "m1", "às 14:00, sem atividade em Snowland, a m1 volta a ser a primeira da fila");
    assert((await carregarRegrasDoDia({ eventId: tarde.id, userIds: [m1.id], date: quinta, operationId: operation!.id })).bloqueios.size === 0, "às 14:00 ninguém é barrado");
  } finally {
    const ids = todos.map((u) => u.id);
    await db.delete(historyEventsTable).where(or(eq(historyEventsTable.orgId, org!.id), inArray(historyEventsTable.actorId, ids)));
    await db.delete(agendaEventsTable).where(eq(agendaEventsTable.operationId, operation!.id));
    const progs = await db.select({ id: programacoesTable.id }).from(programacoesTable).where(inArray(programacoesTable.locationId, [snow!.id, acqua!.id]));
    if (progs.length) {
      await db.delete(programacaoEquipeTable).where(inArray(programacaoEquipeTable.programacaoId, progs.map((p) => p.id)));
      await db.delete(programacaoBlocosTable).where(inArray(programacaoBlocosTable.programacaoId, progs.map((p) => p.id)));
    }
    await db.delete(programacoesTable).where(inArray(programacoesTable.locationId, [snow!.id, acqua!.id]));
    await db.delete(showBookLinesTable).where(eq(showBookLinesTable.positionId, vaga!.id));
    await db.delete(showBookRolesTable).where(eq(showBookRolesTable.showBookId, show!.id));
    await db.delete(showBookBlocksTable).where(eq(showBookBlocksTable.showBookId, show!.id));
    await db.delete(showBookScenesTable).where(eq(showBookScenesTable.showBookId, show!.id));
    await db.delete(showBooksTable).where(eq(showBooksTable.id, show!.id));
    await db.delete(characterCastTable).where(eq(characterCastTable.characterId, personagem!.id));
    await db.delete(charactersTable).where(eq(charactersTable.id, personagem!.id));
    await db.delete(userRolesTable).where(eq(userRolesTable.operationId, operation!.id));
    await db.delete(usersTable).where(inArray(usersTable.id, ids));
    await db.delete(areasTable).where(eq(areasTable.id, area!.id));
    await db.delete(operationLocationsTable).where(inArray(operationLocationsTable.locationId, [snow!.id, acqua!.id]));
    await db.delete(locationsTable).where(inArray(locationsTable.id, [snow!.id, acqua!.id]));
    await db.delete(operationsTable).where(eq(operationsTable.id, operation!.id));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, org!.id));
  }
  if (failures.length > 0) throw new Error(`${failures.length} falha(s) em livro-equipe-outro-local`);
  process.stdout.write(`livro-equipe-outro-local: ${passed} asserts passed\n`);
}

process.stdout.write("livro-equipe-outro-local: starting\n");
try {
  await run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
