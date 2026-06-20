/**
 * SEED SIMULAÇÃO — MY ASA
 * Grupo Entretenimento Artístico — Mês 01
 *
 * Cria dados realistas para demonstração do sistema:
 * - 3 Operações: Snowland, Acquamotion, Hotéis
 * - ~35 membros fictícios com habilidades
 * - Escalas das próximas 3 semanas com alocações pessoais
 * - Tarefas atribuídas a membros
 * - Folgas baseadas nos dias de fechamento e folgas individuais
 * - Memórias operacionais aprovadas da ASA
 * - Reconhecimentos de supervisores
 *
 * Idempotente: verifica se a org já existe antes de inserir.
 */

import bcrypt from "bcryptjs";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "../index.js";
import {
  organizationsTable,
  operationsTable,
  operationalGroupsTable,
  usersTable,
  userRolesTable,
  showBooksTable,
  showBookBlocksTable,
  showBookRolesTable,
  showBookVersionsTable,
  agendaEventsTable,
  scalesTable,
  scaleAllocationsTable,
  tasksTable,
  folgasTable,
  asaMemoriesTable,
  recognitionsTable,
} from "./index.js";

const DEMO_PASSWORD = "Teste@123";
const ORG_MARKER    = "Grupo Entretenimento Artístico";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function addDays(base: string, n: number): string {
  const d = new Date(base + "T12:00:00Z");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function weekDay(date: string): number {
  return new Date(date + "T12:00:00Z").getDay(); // 0=Dom, 1=Seg, ..., 6=Sáb
}

function datesForRange(from: string, to: string): string[] {
  const out: string[] = [];
  let cur = from;
  while (cur <= to) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function seedSimulation() {
  console.log("🎭 Iniciando seed de simulação — Grupo Entretenimento Artístico...\n");

  // ── Idempotência ─────────────────────────────────────────────────────────────
  const existing = await db
    .select({ id: organizationsTable.id })
    .from(organizationsTable)
    .where(eq(organizationsTable.name, ORG_MARKER))
    .limit(1);

  if (existing.length > 0) {
    console.log(`✅ Simulação já existe (org: ${existing[0]!.id}). Nada a fazer.`);
    return;
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // Semanas cobertas
  const w1Start = addDays(today, -new Date(today + "T12:00:00Z").getDay());    // início desta semana (domingo)
  const w3End   = addDays(w1Start, 20);                                         // ~3 semanas

  // ── 1. Organização ───────────────────────────────────────────────────────────
  const [org] = await db.insert(organizationsTable).values({
    name: ORG_MARKER,
  }).returning();
  const orgId = org!.id;
  console.log(`✅ Organização criada: ${orgId}`);

  // ── 2. Operações ─────────────────────────────────────────────────────────────
  const [opSnow, opAcqua, opHoteis] = await db.insert(operationsTable).values([
    {
      organizationId: orgId,
      name: "Snowland",
      status: "ACTIVE" as const,
      healthThresholds: { scalePublishedDaysAhead: 7, dailyBookPublishedHoursAhead: 24, openPositionThreshold: 0 },
      timezone: "America/Sao_Paulo",
    },
    {
      organizationId: orgId,
      name: "Acquamotion",
      status: "ACTIVE" as const,
      healthThresholds: { scalePublishedDaysAhead: 7, dailyBookPublishedHoursAhead: 24, openPositionThreshold: 0 },
      timezone: "America/Sao_Paulo",
    },
    {
      organizationId: orgId,
      name: "Hotéis",
      status: "ACTIVE" as const,
      healthThresholds: { scalePublishedDaysAhead: 3, dailyBookPublishedHoursAhead: 12, openPositionThreshold: 0 },
      timezone: "America/Sao_Paulo",
    },
  ]).returning();
  console.log(`✅ 3 operações criadas (Snowland, Acquamotion, Hotéis)`);

  // ── 3. Usuários administração ─────────────────────────────────────────────────
  const [uCris, uBabi] = await db.insert(usersTable).values([
    { organizationId: orgId, name: "Cris Fontana",   email: "cris@entertimento.demo",   passwordHash, status: "ACTIVE", specialization: "OTHER",              birthDate: "1985-03-12" },
    { organizationId: orgId, name: "Babi Carvalho",  email: "babi@entertimento.demo",   passwordHash, status: "ACTIVE", specialization: "OTHER",              birthDate: "1990-07-22" },
  ]).returning();

  // ── 4. Supervisores ──────────────────────────────────────────────────────────
  const [uRafael, uFernanda, uDiego, uMarcos] = await db.insert(usersTable).values([
    { organizationId: orgId, name: "Rafael Torres",    email: "rafael@entertimento.demo",   passwordHash, status: "ACTIVE", specialization: "PERFORMER",  birthDate: "1988-09-04" },
    { organizationId: orgId, name: "Fernanda Lima",    email: "fernanda@entertimento.demo", passwordHash, status: "ACTIVE", specialization: "PERFORMER",  birthDate: "1991-01-17" },
    { organizationId: orgId, name: "Diego Andrade",    email: "diego@entertimento.demo",    passwordHash, status: "ACTIVE", specialization: "TECHNICAL_OPERATOR", birthDate: "1986-11-30" },
    { organizationId: orgId, name: "Marcos Vinicius",  email: "marcos@entertimento.demo",   passwordHash, status: "ACTIVE", specialization: "PERFORMER",  birthDate: "1989-05-20" },
  ]).returning();

  // ── 5. Grupos operacionais ───────────────────────────────────────────────────
  const [grpBailSnow, grpPatSnow, grpProdSnow, grpAcqua, grpHoteis] = await db.insert(operationalGroupsTable).values([
    { operationId: opSnow!.id,   name: "Bailarinos",  supervisorId: uRafael!.id },
    { operationId: opSnow!.id,   name: "Patinação",   supervisorId: uFernanda!.id },
    { operationId: opSnow!.id,   name: "Produção",    supervisorId: uDiego!.id },
    { operationId: opAcqua!.id,  name: "Elenco",      supervisorId: uMarcos!.id },
    { operationId: opHoteis!.id, name: "Hotéis",      supervisorId: uCris!.id },
  ]).returning();

  // ── 6. Membros Snowland — Bailarinos (5) ────────────────────────────────────
  const snowBail = await db.insert(usersTable).values([
    { organizationId: orgId, name: "Ana Clara Sousa",   email: "anaclara@entertimento.demo",   passwordHash, status: "ACTIVE", specialization: "PERFORMER", birthDate: "1999-02-14" },
    { organizationId: orgId, name: "Beatriz Santos",    email: "beatriz@entertimento.demo",    passwordHash, status: "ACTIVE", specialization: "PERFORMER", birthDate: "2000-08-03" },
    { organizationId: orgId, name: "Camila Rocha",      email: "camila@entertimento.demo",     passwordHash, status: "ACTIVE", specialization: "PERFORMER", birthDate: "1998-04-25" },
    { organizationId: orgId, name: "Daniela Freitas",   email: "daniela@entertimento.demo",    passwordHash, status: "ACTIVE", specialization: "PERFORMER", birthDate: "2001-11-08" },
    { organizationId: orgId, name: "Eduardo Silva",     email: "eduardo@entertimento.demo",    passwordHash, status: "ACTIVE", specialization: "PERFORMER", birthDate: "1997-06-19" },
  ]).returning();

  // ── 7. Membros Snowland — Patinadores (15) ──────────────────────────────────
  const snowPat = await db.insert(usersTable).values([
    { organizationId: orgId, name: "Felipe Costa",      email: "felipe@entertimento.demo",     passwordHash, status: "ACTIVE", specialization: "PERFORMER", birthDate: "1996-01-07" },
    { organizationId: orgId, name: "Gabriela Martins",  email: "gabriela@entertimento.demo",   passwordHash, status: "ACTIVE", specialization: "PERFORMER", birthDate: "2000-10-22" },
    { organizationId: orgId, name: "Henrique Souza",    email: "henrique@entertimento.demo",   passwordHash, status: "ACTIVE", specialization: "PERFORMER", birthDate: "1998-07-15" },
    { organizationId: orgId, name: "Isabela Lima",      email: "isabela@entertimento.demo",    passwordHash, status: "ACTIVE", specialization: "PERFORMER", birthDate: "2002-03-30" },
    { organizationId: orgId, name: "João Pedro Alves",  email: "joaopedro@entertimento.demo",  passwordHash, status: "ACTIVE", specialization: "PERFORMER", birthDate: "1999-09-12" },
    { organizationId: orgId, name: "Karla Ribeiro",     email: "karla@entertimento.demo",      passwordHash, status: "ACTIVE", specialization: "PERFORMER", birthDate: "1997-05-04" },
    { organizationId: orgId, name: "Lucas Fernandes",   email: "lucas@entertimento.demo",      passwordHash, status: "ACTIVE", specialization: "PERFORMER", birthDate: "2001-12-18" },
    { organizationId: orgId, name: "Mariana Castro",    email: "mariana@entertimento.demo",    passwordHash, status: "ACTIVE", specialization: "PERFORMER", birthDate: "1998-02-27" },
    { organizationId: orgId, name: "Nathan Oliveira",   email: "nathan@entertimento.demo",     passwordHash, status: "ACTIVE", specialization: "PERFORMER", birthDate: "2000-06-01" },
    { organizationId: orgId, name: "Olívia Ramos",      email: "olivia@entertimento.demo",     passwordHash, status: "ACTIVE", specialization: "PERFORMER", birthDate: "1999-08-16" },
    { organizationId: orgId, name: "Paulo Mendes",      email: "paulo@entertimento.demo",      passwordHash, status: "ACTIVE", specialization: "PERFORMER", birthDate: "1996-04-09" },
    { organizationId: orgId, name: "Quézia Barbosa",    email: "quezia@entertimento.demo",     passwordHash, status: "ACTIVE", specialization: "PERFORMER", birthDate: "2003-01-23" },
    { organizationId: orgId, name: "Ricardo Gomes",     email: "ricardo@entertimento.demo",    passwordHash, status: "ACTIVE", specialization: "PERFORMER", birthDate: "1995-11-14" },
    { organizationId: orgId, name: "Sabrina Teixeira",  email: "sabrina@entertimento.demo",    passwordHash, status: "ACTIVE", specialization: "PERFORMER", birthDate: "2001-07-07" },
    { organizationId: orgId, name: "Thiago Azevedo",    email: "thiago@entertimento.demo",     passwordHash, status: "ACTIVE", specialization: "PERFORMER", birthDate: "1997-03-21" },
  ]).returning();

  // ── 8. Membros Snowland — Produção (3) ──────────────────────────────────────
  const snowProd = await db.insert(usersTable).values([
    { organizationId: orgId, name: "Valentina Cruz",    email: "valentina@entertimento.demo",  passwordHash, status: "ACTIVE", specialization: "TECHNICAL_OPERATOR", birthDate: "1993-09-28" },
    { organizationId: orgId, name: "William Carvalho",  email: "william@entertimento.demo",    passwordHash, status: "ACTIVE", specialization: "TECHNICAL_OPERATOR", birthDate: "1990-04-15" },
    { organizationId: orgId, name: "Ximena Dias",       email: "ximena@entertimento.demo",     passwordHash, status: "ACTIVE", specialization: "TECHNICAL_OPERATOR", birthDate: "1995-12-02" },
  ]).returning();

  // ── 9. Membros Acquamotion — Bailarinos (7) ──────────────────────────────────
  const acquaBail = await db.insert(usersTable).values([
    { organizationId: orgId, name: "Letícia Peixoto",   email: "leticia@entertimento.demo",    passwordHash, status: "ACTIVE", specialization: "PERFORMER", birthDate: "2000-05-11" },
    { organizationId: orgId, name: "Mateus Borges",     email: "mateus@entertimento.demo",     passwordHash, status: "ACTIVE", specialization: "PERFORMER", birthDate: "1999-10-29" },
    { organizationId: orgId, name: "Nathalia Correia",  email: "nathalia@entertimento.demo",   passwordHash, status: "ACTIVE", specialization: "PERFORMER", birthDate: "2002-07-17" },
    { organizationId: orgId, name: "Otoniel Santos",    email: "otoniel@entertimento.demo",    passwordHash, status: "ACTIVE", specialization: "PERFORMER", birthDate: "1998-01-05" },
    { organizationId: orgId, name: "Priscila Magalhães",email: "priscila@entertimento.demo",   passwordHash, status: "ACTIVE", specialization: "PERFORMER", birthDate: "2001-09-22" },
    { organizationId: orgId, name: "Ruan Ferreira",     email: "ruan@entertimento.demo",       passwordHash, status: "ACTIVE", specialization: "PERFORMER", birthDate: "1997-03-08" },
    { organizationId: orgId, name: "Sofia Monteiro",    email: "sofia@entertimento.demo",      passwordHash, status: "ACTIVE", specialization: "PERFORMER", birthDate: "2003-06-14" },
  ]).returning();

  console.log(`✅ ${2 + 4 + 5 + 15 + 3 + 7} usuários criados`);

  // ── 10. Atribuir papéis ───────────────────────────────────────────────────────
  const roleRows: Parameters<typeof db.insert>[0] extends (typeof userRolesTable) ? never : any[] = [];

  // Admins em todas as operações
  for (const opId of [opSnow!.id, opAcqua!.id, opHoteis!.id]) {
    roleRows.push(
      { userId: uCris!.id,  operationId: opId, role: "ADMIN",        active: true },
      { userId: uBabi!.id,  operationId: opId, role: "ADMIN",        active: true },
    );
  }

  // Supervisores
  roleRows.push(
    { userId: uRafael!.id,   operationId: opSnow!.id,   groupId: grpBailSnow!.id, role: "SUPERVISOR_A", active: true },
    { userId: uFernanda!.id, operationId: opSnow!.id,   groupId: grpPatSnow!.id,  role: "SUPERVISOR_A", active: true },
    { userId: uDiego!.id,    operationId: opSnow!.id,   groupId: grpProdSnow!.id, role: "SUPERVISOR_B", active: true },
    { userId: uMarcos!.id,   operationId: opAcqua!.id,  groupId: grpAcqua!.id,    role: "SUPERVISOR_A", active: true },
  );

  // Bailarinos Snowland
  for (const u of snowBail) {
    roleRows.push({ userId: u.id, operationId: opSnow!.id, groupId: grpBailSnow!.id, role: "MEMBER", active: true });
  }
  // Patinadores Snowland
  for (const u of snowPat) {
    roleRows.push({ userId: u.id, operationId: opSnow!.id, groupId: grpPatSnow!.id, role: "MEMBER", active: true });
  }
  // Produção Snowland
  for (const u of snowProd) {
    roleRows.push({ userId: u.id, operationId: opSnow!.id, groupId: grpProdSnow!.id, role: "MEMBER", active: true });
  }
  // Bailarinos Acquamotion
  for (const u of acquaBail) {
    roleRows.push({ userId: u.id, operationId: opAcqua!.id, groupId: grpAcqua!.id, role: "MEMBER", active: true });
  }

  await db.insert(userRolesTable).values(roleRows);
  console.log(`✅ ${roleRows.length} papéis atribuídos`);

  // ── 11. Show Book — Snowland ──────────────────────────────────────────────────
  const [sbSnow] = await db.insert(showBooksTable).values({
    operationId: opSnow!.id,
    title: "Shows Snowland — Temporada 2026",
    description: "Livro oficial dos shows diários do Snowland",
    type: "STRUCTURED",
    version: 1,
    status: "PUBLISHED",
    createdBy: uCris!.id,
  }).returning();

  const snowShowNames = [
    { name: "Boas-vindas",       start: "10:00", end: "10:15", artists: 2 },
    { name: "Teatro",            start: "11:30", end: "12:10", artists: 2 },
    { name: "Musical",           start: "12:30", end: "13:10", artists: 7 },
    { name: "Show de Patinação", start: "14:00", end: "14:40", artists: 20 },
    { name: "Show Montanha",     start: "15:15", end: "15:30", artists: 7 },
  ];

  const snowBlocks = await db.insert(showBookBlocksTable).values(
    snowShowNames.map((s, i) => ({
      showBookId: sbSnow!.id,
      name: s.name,
      order: i + 1,
    }))
  ).returning();

  // Roles básicos por show
  const snowRoleRows: any[] = [];
  snowBlocks.forEach((blk, i) => {
    const n = snowShowNames[i]!.artists;
    for (let r = 1; r <= Math.min(n, 3); r++) {
      snowRoleRows.push({
        showBookId: sbSnow!.id,
        blockId: blk.id,
        name: r === 1 ? "Titular" : r === 2 ? "Cobertura" : "Apoio",
        minimumCoverage: 1,
        order: r,
        tagsJson: [],
      });
    }
  });
  await db.insert(showBookRolesTable).values(snowRoleRows);

  await db.insert(showBookVersionsTable).values({
    showBookId: sbSnow!.id,
    version: 1,
    changeType: "STRUCTURAL",
    reason: "Versão inicial dos shows Snowland",
    snapshot: {},
    createdBy: uCris!.id,
  });

  // ── 12. Show Book — Acquamotion ───────────────────────────────────────────────
  const [sbAcqua] = await db.insert(showBooksTable).values({
    operationId: opAcqua!.id,
    title: "Shows Acquamotion — Temporada 2026",
    description: "Livro oficial dos shows diários do Acquamotion",
    type: "STRUCTURED",
    version: 1,
    status: "PUBLISHED",
    createdBy: uCris!.id,
  }).returning();

  const acquaShowNames = [
    { name: "Boas-vindas Acqua", start: "10:00", end: "10:20", artists: 2 },
    { name: "Musical Acqua",     start: "12:00", end: "12:40", artists: 3 },
    { name: "Show da Água",      start: "15:00", end: "15:40", artists: 5 },
  ];

  const acquaBlocks = await db.insert(showBookBlocksTable).values(
    acquaShowNames.map((s, i) => ({
      showBookId: sbAcqua!.id,
      name: s.name,
      order: i + 1,
    }))
  ).returning();

  const acquaRoleRows: any[] = [];
  acquaBlocks.forEach((blk, i) => {
    const n = acquaShowNames[i]!.artists;
    for (let r = 1; r <= Math.min(n, 2); r++) {
      acquaRoleRows.push({
        showBookId: sbAcqua!.id,
        blockId: blk.id,
        name: r === 1 ? "Titular" : "Cobertura",
        minimumCoverage: 1,
        order: r,
        tagsJson: [],
      });
    }
  });
  await db.insert(showBookRolesTable).values(acquaRoleRows);

  await db.insert(showBookVersionsTable).values({
    showBookId: sbAcqua!.id,
    version: 1,
    changeType: "STRUCTURAL",
    reason: "Versão inicial dos shows Acquamotion",
    snapshot: {},
    createdBy: uCris!.id,
  });

  console.log("✅ Show Books criados (Snowland + Acquamotion)");

  // ── 13. Agenda — Eventos das próximas 3 semanas ──────────────────────────────
  const agendaRows: any[] = [];
  const allDates = datesForRange(today, w3End);

  for (const date of allDates) {
    const wd = weekDay(date);

    // Snowland: fecha quarta-feira (3)
    if (wd !== 3) {
      for (const show of snowShowNames) {
        agendaRows.push({
          operationId: opSnow!.id,
          showBookId: sbSnow!.id,
          type: "SHOW",
          title: show.name,
          date,
          startTime: show.start,
          endTime: show.end,
          location: "Snowland — Palco Principal",
          status: "CONFIRMED",
          createdBy: uCris!.id,
          confirmedBy: uCris!.id,
          confirmedAt: new Date(),
        });
      }
      // Ensaios Snowland: terças e quintas, 09:00–10:00
      if (wd === 2 || wd === 4) {
        agendaRows.push({
          operationId: opSnow!.id,
          type: "REHEARSAL",
          title: "Ensaio Diário — Snowland",
          date,
          startTime: "09:00",
          endTime: "10:00",
          location: "Sala de Ensaios Snowland",
          status: "CONFIRMED",
          createdBy: uRafael!.id,
          confirmedBy: uRafael!.id,
          confirmedAt: new Date(),
        });
      }
    }

    // Acquamotion: fecha segunda-feira (1)
    if (wd !== 1) {
      for (const show of acquaShowNames) {
        agendaRows.push({
          operationId: opAcqua!.id,
          showBookId: sbAcqua!.id,
          type: "SHOW",
          title: show.name,
          date,
          startTime: show.start,
          endTime: show.end,
          location: "Acquamotion — Área Aquática",
          status: "CONFIRMED",
          createdBy: uCris!.id,
          confirmedBy: uCris!.id,
          confirmedAt: new Date(),
        });
      }
      // Ensaios Acqua: quintas, 09:00–10:00
      if (wd === 4) {
        agendaRows.push({
          operationId: opAcqua!.id,
          type: "REHEARSAL",
          title: "Ensaio Semanal — Acquamotion",
          date,
          startTime: "09:00",
          endTime: "10:00",
          location: "Área Aquática",
          status: "CONFIRMED",
          createdBy: uMarcos!.id,
          confirmedBy: uMarcos!.id,
          confirmedAt: new Date(),
        });
      }
    }
  }

  // Eventos especiais (hotel)
  agendaRows.push(
    {
      operationId: opHoteis!.id,
      type: "SHOW",
      title: "Pocket Show — Hotel Intercontinental",
      date: addDays(today, 3),
      startTime: "20:00",
      endTime: "21:00",
      location: "Hotel Intercontinental — Salão Nobre",
      status: "CONFIRMED",
      createdBy: uCris!.id,
      confirmedBy: uCris!.id,
      confirmedAt: new Date(),
    },
    {
      operationId: opHoteis!.id,
      type: "SHOW",
      title: "Apresentação Corporativa — Hotel Golden",
      date: addDays(today, 10),
      startTime: "19:30",
      endTime: "20:30",
      location: "Hotel Golden — Auditório",
      status: "DRAFT",
      createdBy: uBabi!.id,
    },
  );

  await db.insert(agendaEventsTable).values(agendaRows);
  console.log(`✅ ${agendaRows.length} eventos de agenda criados`);

  // ── 14. Escalas ───────────────────────────────────────────────────────────────
  // Uma escala por operação cobrindo as 3 semanas
  const [scSnow] = await db.insert(scalesTable).values({
    operationId: opSnow!.id,
    title: `Escala Snowland — ${today} a ${w3End}`,
    periodStart: today,
    periodEnd: w3End,
    status: "PUBLISHED",
    publishedAt: new Date(),
    publishedBy: uCris!.id,
    createdBy: uCris!.id,
  }).returning();

  const [scAcqua] = await db.insert(scalesTable).values({
    operationId: opAcqua!.id,
    title: `Escala Acquamotion — ${today} a ${w3End}`,
    periodStart: today,
    periodEnd: w3End,
    status: "PUBLISHED",
    publishedAt: new Date(),
    publishedBy: uCris!.id,
    createdBy: uCris!.id,
  }).returning();

  console.log("✅ 2 escalas criadas (Snowland + Acquamotion)");

  // ── 15. Alocações de escala ───────────────────────────────────────────────────
  const allocRows: any[] = [];

  // Folgas individuais fixas por membro (2 por semana, distribuídas)
  // Usaremos as folgas abaixo para EXCLUIR alocações nesses dias
  type FolgaEntry = { userId: string; dayOfWeek: number[] }; // dias da semana com folga
  const snowFolgas: FolgaEntry[] = [
    // Bailarinos
    { userId: snowBail[0]!.id, dayOfWeek: [0, 6] },   // Ana Clara: dom+sáb
    { userId: snowBail[1]!.id, dayOfWeek: [5, 0] },   // Beatriz: sex+dom
    { userId: snowBail[2]!.id, dayOfWeek: [0, 4] },   // Camila: dom+qui
    { userId: snowBail[3]!.id, dayOfWeek: [0, 6] },   // Daniela: dom+sáb
    { userId: snowBail[4]!.id, dayOfWeek: [5, 6] },   // Eduardo: sex+sáb
    // Patinadores (amostra)
    { userId: snowPat[0]!.id,  dayOfWeek: [0, 4] },
    { userId: snowPat[1]!.id,  dayOfWeek: [5, 0] },
    { userId: snowPat[2]!.id,  dayOfWeek: [0, 6] },
    { userId: snowPat[3]!.id,  dayOfWeek: [4, 5] },
    { userId: snowPat[4]!.id,  dayOfWeek: [0, 4] },
    { userId: snowPat[5]!.id,  dayOfWeek: [5, 6] },
    { userId: snowPat[6]!.id,  dayOfWeek: [0, 5] },
    { userId: snowPat[7]!.id,  dayOfWeek: [6, 0] },
    { userId: snowPat[8]!.id,  dayOfWeek: [4, 0] },
    { userId: snowPat[9]!.id,  dayOfWeek: [5, 0] },
    { userId: snowPat[10]!.id, dayOfWeek: [0, 6] },
    { userId: snowPat[11]!.id, dayOfWeek: [4, 5] },
    { userId: snowPat[12]!.id, dayOfWeek: [0, 5] },
    { userId: snowPat[13]!.id, dayOfWeek: [5, 6] },
    { userId: snowPat[14]!.id, dayOfWeek: [0, 4] },
    // Produção
    { userId: snowProd[0]!.id, dayOfWeek: [0, 5] },
    { userId: snowProd[1]!.id, dayOfWeek: [4, 0] },
    { userId: snowProd[2]!.id, dayOfWeek: [5, 0] },
  ];

  const acquaFolgas: FolgaEntry[] = [
    { userId: acquaBail[0]!.id, dayOfWeek: [0, 5] },
    { userId: acquaBail[1]!.id, dayOfWeek: [0, 6] },
    { userId: acquaBail[2]!.id, dayOfWeek: [5, 0] },
    { userId: acquaBail[3]!.id, dayOfWeek: [4, 0] },
    { userId: acquaBail[4]!.id, dayOfWeek: [0, 6] },
    { userId: acquaBail[5]!.id, dayOfWeek: [5, 0] },
    { userId: acquaBail[6]!.id, dayOfWeek: [4, 5] },
  ];

  const hasFolga = (fe: FolgaEntry[], userId: string, date: string) => {
    const entry = fe.find(f => f.userId === userId);
    if (!entry) return false;
    return entry.dayOfWeek.includes(weekDay(date));
  };

  // Alocações Snowland
  for (const date of allDates) {
    const wd = weekDay(date);
    if (wd === 3) continue; // Snowland fechado na quarta

    for (const show of snowShowNames) {
      const label = show.name;
      const isBailShow   = ["Boas-vindas", "Teatro", "Musical", "Show Montanha"].includes(label);
      const isPatShow    = ["Show de Patinação", "Show Montanha", "Musical"].includes(label);
      const isProdShow   = true; // produção em todos

      // Bailarinos neste show
      if (isBailShow) {
        for (const u of snowBail) {
          if (hasFolga(snowFolgas, u.id, date)) continue;
          allocRows.push({
            scaleId: scSnow!.id,
            userId: u.id,
            status: "ASSIGNED",
            manualDate: date,
            manualLabel: label,
            startTime: show.start,
            endTime: show.end,
          });
        }
      }

      // Patinadores no Show de Patinação e Musical
      if (isPatShow) {
        for (const u of snowPat) {
          if (hasFolga(snowFolgas, u.id, date)) continue;
          allocRows.push({
            scaleId: scSnow!.id,
            userId: u.id,
            status: "ASSIGNED",
            manualDate: date,
            manualLabel: label,
            startTime: show.start,
            endTime: show.end,
          });
        }
      }

      // Produção em todos os shows
      if (isProdShow) {
        const prodIdx = allDates.indexOf(date) % snowProd.length;
        const prodUser = snowProd[prodIdx]!;
        if (!hasFolga(snowFolgas, prodUser.id, date)) {
          allocRows.push({
            scaleId: scSnow!.id,
            userId: prodUser.id,
            status: "ASSIGNED",
            manualDate: date,
            manualLabel: `Produção — ${label}`,
            startTime: show.start,
            endTime: show.end,
          });
        }
      }
    }
  }

  // Alocações Acquamotion
  for (const date of allDates) {
    const wd = weekDay(date);
    if (wd === 1) continue; // Acquamotion fechado na segunda

    for (const show of acquaShowNames) {
      const label = show.name;
      for (const u of acquaBail) {
        if (hasFolga(acquaFolgas, u.id, date)) continue;
        allocRows.push({
          scaleId: scAcqua!.id,
          userId: u.id,
          status: "ASSIGNED",
          manualDate: date,
          manualLabel: label,
          startTime: show.start,
          endTime: show.end,
        });
      }
    }
  }

  // Alocações Hotéis — pocket shows
  const pocketMembers = [snowBail[0]!, snowBail[2]!, acquaBail[0]!, acquaBail[3]!];
  for (const pm of pocketMembers) {
    allocRows.push({
      scaleId: scSnow!.id,
      userId: pm.id,
      status: "ASSIGNED",
      manualDate: addDays(today, 3),
      manualLabel: "Pocket Show — Hotel Intercontinental",
      startTime: "20:00",
      endTime: "21:00",
      notes: "Convocação especial. Figurino: gala.",
    });
  }

  // Inserir em lotes de 200
  for (let i = 0; i < allocRows.length; i += 200) {
    await db.insert(scaleAllocationsTable).values(allocRows.slice(i, i + 200));
  }
  console.log(`✅ ${allocRows.length} alocações de escala criadas`);

  // ── 16. Folgas cadastradas no sistema ────────────────────────────────────────
  const folgaRows: any[] = [];

  // Folgas semanais fixas: inserir para esta semana
  const folgasByUser: { userId: string; opId: string; dayOfWeek: number[] }[] = [
    ...snowFolgas.map(f => ({ ...f, opId: opSnow!.id })),
    ...acquaFolgas.map(f => ({ ...f, opId: opAcqua!.id })),
  ];

  for (const date of allDates) {
    for (const fe of folgasByUser) {
      if (fe.dayOfWeek.includes(weekDay(date))) {
        folgaRows.push({
          userId:      fe.userId,
          operationId: fe.opId,
          type:        "DAY_OFF",
          startDate:   date,
          endDate:     date,
          status:      "ACTIVE",
          origem:      "MANUAL",
          createdBy:   uCris!.id,
          notes:       "Folga semanal programada",
        });
      }
    }
  }

  // Atestados / afastamentos especiais
  folgaRows.push(
    {
      userId:      snowPat[3]!.id,   // Isabela Lima
      operationId: opSnow!.id,
      type:        "AFASTAMENTO",
      startDate:   today,
      endDate:     addDays(today, 4),
      status:      "ACTIVE",
      origem:      "MANUAL",
      createdBy:   uFernanda!.id,
      notes:       "Atestado médico — entorse no tornozelo",
    },
    {
      userId:      snowPat[8]!.id,   // Nathan Oliveira
      operationId: opSnow!.id,
      type:        "RESTRICAO",
      startDate:   today,
      endDate:     addDays(today, 7),
      status:      "ACTIVE",
      origem:      "MANUAL",
      createdBy:   uFernanda!.id,
      notes:       "Restrição de impacto — fisioterapia em andamento",
    },
    {
      userId:      acquaBail[2]!.id,  // Nathalia Correia
      operationId: opAcqua!.id,
      type:        "AFASTAMENTO",
      startDate:   addDays(today, 2),
      endDate:     addDays(today, 3),
      status:      "ACTIVE",
      origem:      "MANUAL",
      createdBy:   uMarcos!.id,
      notes:       "Consulta médica programada",
    },
  );

  for (let i = 0; i < folgaRows.length; i += 200) {
    await db.insert(folgasTable).values(folgaRows.slice(i, i + 200));
  }
  console.log(`✅ ${folgaRows.length} registros de folga criados`);

  // ── 17. Tarefas ───────────────────────────────────────────────────────────────
  await db.insert(tasksTable).values([
    {
      organizationId: orgId,
      operationId:    opSnow!.id,
      title:          "Revisar figurinos do Show de Patinação",
      description:    "Verificar estado dos figurinos, listar peças danificadas e solicitar manutenção antes da próxima temporada.",
      creatorId:      uDiego!.id,
      assigneeId:     snowProd[0]!.id,
      approverId:     uDiego!.id,
      requiresApproval: true,
      priority:       "HIGH",
      status:         "IN_PROGRESS",
      dueDate:        addDays(today, 5),
      origin:         "MANUAL",
    },
    {
      organizationId: orgId,
      operationId:    opSnow!.id,
      title:          "Atualizar lista de substituições do Musical",
      description:    "Mapear quais bailarinos podem cobrir cada posição do Musical em caso de ausência.",
      creatorId:      uRafael!.id,
      assigneeId:     snowBail[0]!.id,
      requiresApproval: false,
      priority:       "MEDIUM",
      status:         "CREATED",
      dueDate:        addDays(today, 7),
      origin:         "MANUAL",
    },
    {
      organizationId: orgId,
      operationId:    opSnow!.id,
      title:          "Relatório de presença — semana passada",
      description:    "Compilar check-ins e faltas da semana anterior para envio à administração.",
      creatorId:      uFernanda!.id,
      assigneeId:     snowPat[0]!.id,
      requiresApproval: true,
      approverId:     uFernanda!.id,
      priority:       "MEDIUM",
      status:         "CREATED",
      dueDate:        addDays(today, 2),
      origin:         "MANUAL",
    },
    {
      organizationId: orgId,
      operationId:    opAcqua!.id,
      title:          "Inspecionar equipamentos de som — área aquática",
      description:    "Verificar microfones sem fio e sistema de som. Testar antes do Show da Água.",
      creatorId:      uMarcos!.id,
      assigneeId:     acquaBail[0]!.id,
      requiresApproval: false,
      priority:       "HIGH",
      status:         "IN_PROGRESS",
      dueDate:        addDays(today, 1),
      origin:         "MANUAL",
    },
    {
      organizationId: orgId,
      operationId:    opAcqua!.id,
      title:          "Preparar coreografia pocket show — Hotel Intercontinental",
      description:    "Montar sequência de 20 minutos com os 4 artistas convocados. Confirmar figurino.",
      creatorId:      uMarcos!.id,
      assigneeId:     acquaBail[3]!.id,
      requiresApproval: true,
      approverId:     uCris!.id,
      priority:       "HIGH",
      status:         "IN_PROGRESS",
      dueDate:        addDays(today, 2),
      origin:         "MANUAL",
    },
    {
      organizationId: orgId,
      operationId:    opSnow!.id,
      title:          "Agendar sessão de fisioterapia — Isabela Lima",
      description:    "Entorse no tornozelo. Encaminhar para fisioterapia e acompanhar evolução.",
      creatorId:      uFernanda!.id,
      assigneeId:     snowPat[3]!.id,
      requiresApproval: false,
      priority:       "HIGH",
      status:         "CREATED",
      dueDate:        addDays(today, 1),
      origin:         "AI",
    },
    {
      organizationId: orgId,
      operationId:    opSnow!.id,
      title:          "Renovar contrato de manutenção do piso de gelo",
      description:    "Contrato vence no próximo mês. Solicitar cotação e apresentar à administração.",
      creatorId:      uBabi!.id,
      assigneeId:     uDiego!.id,
      requiresApproval: true,
      approverId:     uCris!.id,
      priority:       "MEDIUM",
      status:         "CREATED",
      dueDate:        addDays(today, 15),
      origin:         "MANUAL",
    },
    {
      organizationId: orgId,
      operationId:    opAcqua!.id,
      title:          "Atualizar ficha de habilidades — elenco Acquamotion",
      description:    "Registrar no sistema as habilidades atualizadas de cada membro: lira, acrobacia, teatro.",
      creatorId:      uCris!.id,
      assigneeId:     uMarcos!.id,
      requiresApproval: false,
      priority:       "LOW",
      status:         "CREATED",
      dueDate:        addDays(today, 10),
      origin:         "AI",
    },
  ]);
  console.log("✅ 8 tarefas criadas");

  // ── 18. Memórias da ASA ───────────────────────────────────────────────────────
  const memRows = [
    // Snowland
    { key: "cobertura:musical:snowland",      value: "Ana Clara Sousa e Eduardo Silva cobrem bem o Musical do Snowland. São as primeiras opções em caso de ausência." },
    { key: "cobertura:boasvindas:snowland",   value: "Beatriz Santos é a melhor escolha para Boas-vindas quando Ana Clara está de folga. Alta energia e boa comunicação com o público." },
    { key: "habilidade:lira:snowland",        value: "Camila Rocha possui habilidade em lira. Pode ser convocada para eventos especiais e hotéis." },
    { key: "habilidade:acrobacia:snowland",   value: "Eduardo Silva tem formação em acrobacia. Útil para eventos corporativos e apresentações diferenciadas." },
    { key: "risco:patinacao:cobertura",       value: "O Show de Patinação é o mais suscetível a problemas de cobertura. Mínimo de 12 patinadores confirmados para realizar o show com segurança." },
    { key: "padrao:falta:segunda",            value: "Segunda-feira apresenta maior índice de faltas no Snowland. Recomenda-se confirmar elenco na sexta anterior." },
    { key: "lesao:isabela:tornozelo",         value: "Isabela Lima (patinadora) está em afastamento por entorse no tornozelo. Previsão de retorno: 5 dias. Não alocar em shows de impacto." },
    { key: "restricao:nathan:fisio",          value: "Nathan Oliveira está em restrição de impacto. Pode participar de ensaios leves mas não de shows de patinação. Fisioterapia em andamento." },
    { key: "cobertura:producao:snowland",     value: "Valentina Cruz é a produção mais experiente do Snowland. Em caso de ausência de William ou Ximena, Valentina assume sem impacto operacional." },
    { key: "carga:alta:snowpat",              value: "Os patinadores Felipe, Mariana e Ricardo apresentam a maior carga semanal do Snowland. Monitorar sinais de fadiga." },
    // Acquamotion
    { key: "cobertura:showdaagua:acqua",      value: "O Show da Água requer mínimo de 4 bailarinos. É o show com maior risco de cobertura no Acquamotion, especialmente às segundas." },
    { key: "habilidade:producao:acqua",       value: "No Acquamotion, a produção é feita por um integrante do elenco. Ruan Ferreira e Sofia Monteiro dominam essa função." },
    { key: "deslocamento:bail:acqua",         value: "Beatriz Santos e Camila Rocha (Snowland) podem ser deslocadas para o Acquamotion. Quando isso ocorre, ficam indisponíveis para o Show de Patinação." },
    { key: "talento:lideranca:marcos",        value: "Marcos Vinicius demonstra excelente liderança operacional no Acquamotion. Candidato natural a coordenador em eventos especiais." },
    { key: "habilidade:hotel:leticia",        value: "Letícia Peixoto tem facilidade em apresentações de hotel. Adaptável a públicos corporativos e boa improvisação cênica." },
    // Hotéis
    { key: "perfil:hotel:elenco",             value: "Para pocket shows em hotéis, priorizar artistas com versatilidade: Ana Clara, Camila (Snowland) e Letícia, Otoniel (Acquamotion)." },
    { key: "padrao:hotel:figurino",           value: "Pocket shows em hotéis requerem figurino de gala. Confirmar disponibilidade de figurino com Diego Andrade (Produção) com 48h de antecedência." },
    // Operacional geral
    { key: "ensaio:participacao:top3",        value: "Os membros com maior participação em ensaios são: Felipe Costa, Ana Clara Sousa e Letícia Peixoto. Esses artistas respondem melhor a mudanças de última hora." },
    { key: "alerta:quarta:snow:fechado",      value: "Snowland fecha às quartas-feiras. Não escalar membros do Snowland para shows nesse dia. Usar o período para ensaios e manutenção." },
    { key: "alerta:segunda:acqua:fechado",    value: "Acquamotion fecha às segundas-feiras. Folgas e fisioterapia devem ser priorizadas nesse dia para os membros do Acquamotion." },
  ];

  await db.insert(asaMemoriesTable).values(
    memRows.map(m => ({
      type:           "OPERATIONAL" as const,
      key:            m.key,
      value:          m.value,
      scope:          `org:${orgId}`,
      organizationId: orgId,
      createdBy:      uCris!.id,
      approvedBy:     uCris!.id,
      approvedAt:     new Date(),
      status:         "APPROVED" as const,
    }))
  );
  console.log(`✅ ${memRows.length} memórias da ASA criadas e aprovadas`);

  // ── 19. Reconhecimentos ───────────────────────────────────────────────────────
  await db.insert(recognitionsTable).values([
    {
      organizationId: orgId,
      userId:         snowBail[0]!.id,   // Ana Clara
      type:           "PERFORMANCE",
      title:          "Estrela da Semana — Ana Clara",
      message:        "Ana Clara brilhou no Musical desta semana! Sua entrega e presença de palco elevaram toda a apresentação. Parabéns!",
      publishedAt:    new Date(),
      createdBy:      uRafael!.id,
    },
    {
      organizationId: orgId,
      userId:         snowPat[0]!.id,    // Felipe Costa
      type:           "DEDICATION",
      title:          "Comprometimento — Felipe Costa",
      message:        "Felipe foi o primeiro a chegar e o último a sair em todos os ensaios desta semana. Exemplo de profissionalismo para toda a equipe.",
      publishedAt:    new Date(),
      createdBy:      uFernanda!.id,
    },
    {
      organizationId: orgId,
      userId:         acquaBail[0]!.id,  // Letícia Peixoto
      type:           "PERFORMANCE",
      title:          "Destaque Acquamotion — Letícia",
      message:        "Letícia substituiu uma colega de última hora no Show da Água e entregou uma performance impecável. Muito obrigado pela disponibilidade e pelo talento!",
      publishedAt:    new Date(),
      createdBy:      uMarcos!.id,
    },
    {
      organizationId: orgId,
      userId:         snowProd[0]!.id,   // Valentina Cruz
      type:           "SUPPORT",
      title:          "Bastidores de Excelência — Valentina",
      message:        "Valentina coordenou a produção de três shows simultâneos sem nenhum imprevisto. Sua organização é fundamental para o sucesso da operação.",
      publishedAt:    new Date(),
      createdBy:      uDiego!.id,
    },
    {
      organizationId: orgId,
      userId:         acquaBail[5]!.id,  // Ruan Ferreira
      type:           "GROWTH",
      title:          "Evolução — Ruan Ferreira",
      message:        "Ruan assumiu a função de produção no Acquamotion com muita competência. Em apenas três semanas já domina todos os processos. Crescimento notável!",
      publishedAt:    new Date(),
      createdBy:      uMarcos!.id,
    },
    {
      organizationId: orgId,
      userId:         snowBail[4]!.id,   // Eduardo Silva
      type:           "PERFORMANCE",
      title:          "1 Ano de Casa — Eduardo Silva 🎉",
      message:        "Eduardo completa 1 ano na equipe! Sua evolução foi incrível — de coadjuvante a titular do Musical. Muito orgulho de ter você na equipe.",
      publishedAt:    new Date(),
      createdBy:      uCris!.id,
    },
  ]);
  console.log("✅ 6 reconhecimentos criados");

  // ── Resumo ────────────────────────────────────────────────────────────────────
  console.log("\n🎉 Seed de simulação concluído com sucesso!\n");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  Organização:  ${ORG_MARKER}`);
  console.log(`  Senha:        ${DEMO_PASSWORD}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Administração:");
  console.log("    cris@entertimento.demo    (Gerente Geral)");
  console.log("    babi@entertimento.demo    (Administradora)");
  console.log("  Supervisores:");
  console.log("    rafael@entertimento.demo  (Snowland — Bailarinos)");
  console.log("    fernanda@entertimento.demo(Snowland — Patinação)");
  console.log("    diego@entertimento.demo   (Snowland — Produção)");
  console.log("    marcos@entertimento.demo  (Acquamotion)");
  console.log("  Membros Snowland:");
  console.log("    anaclara@entertimento.demo | beatriz@entertimento.demo | camila@entertimento.demo");
  console.log("    daniela@entertimento.demo  | eduardo@entertimento.demo");
  console.log("    felipe@entertimento.demo   | gabriela@entertimento.demo | ... (15 patinadores)");
  console.log("    valentina@entertimento.demo| william@entertimento.demo  | ximena@entertimento.demo");
  console.log("  Membros Acquamotion:");
  console.log("    leticia@entertimento.demo | mateus@entertimento.demo | nathalia@entertimento.demo");
  console.log("    otoniel@entertimento.demo | priscila@entertimento.demo| ruan@entertimento.demo | sofia@entertimento.demo");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

seedSimulation().catch((err) => {
  console.error("❌ Erro no seed de simulação:", err);
  process.exit(1);
});
