import bcrypt from "bcryptjs";
import { like, eq } from "drizzle-orm";
import { db } from "../index.js";
import {
  organizationsTable,
  operationsTable,
  operationalGroupsTable,
  usersTable,
  userRolesTable,
  showBooksTable,
  showBookScenesTable,
  showBookBlocksTable,
  showBookRolesTable,
  showBookLinesTable,
  showBookVersionsTable,
  showBookTagsTable,
  agendaEventsTable,
} from "./index.js";

const DEFAULT_PASSWORD = "myasa123";

async function seed() {
  console.log("🌱 Iniciando seed do banco de dados...");

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);

  const existingAdmin = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, "admin@myasa.demo"))
    .limit(1);

  if (existingAdmin.length > 0) {
    console.log("🔄 Dados já existem — atualizando password_hash de todos os usuários demo...");
    const updated = await db
      .update(usersTable)
      .set({ passwordHash })
      .where(like(usersTable.email, "%@myasa.demo"))
      .returning({ id: usersTable.id });
    console.log(`✅ ${updated.length} senhas atualizadas para "${DEFAULT_PASSWORD}"`);

    const existingBooks = await db.select().from(showBooksTable).limit(1);
    if (existingBooks.length === 0) {
      console.log("⚠️  Livros do Show ausentes — criando dados de demonstração...");
      const adminUser = existingAdmin[0]!;
      const existingRole = await db.select().from(userRolesTable)
        .where(eq(userRolesTable.userId, adminUser.id)).limit(1);
      if (existingRole.length > 0 && existingRole[0]!.operationId) {
        const opId = existingRole[0]!.operationId;
        const [showBook] = await db.insert(showBooksTable).values({
          operationId: opId,
          title: "Espetáculo Piloto",
          description: "Livro do Show do espetáculo principal da Companhia Demo",
          type: "STRUCTURED",
          version: 1,
          status: "PUBLISHED",
          createdBy: adminUser.id,
        }).returning();
        const [cena1, cena2] = await db.insert(showBookScenesTable).values([
          { showBookId: showBook!.id, name: "Ato I — Abertura", order: 1, isOptional: false },
          { showBookId: showBook!.id, name: "Ato II — Clímax", order: 2, isOptional: true },
        ]).returning();
        const [bloco1, bloco2, bloco3] = await db.insert(showBookBlocksTable).values([
          { showBookId: showBook!.id, sceneId: cena1!.id, name: "Cena de Entrada", order: 1 },
          { showBookId: showBook!.id, sceneId: cena1!.id, name: "Solo Central", order: 2 },
          { showBookId: showBook!.id, sceneId: cena2!.id, name: "Conjunto Final", order: 1 },
        ]).returning();
        const [pos1, pos2, pos3, pos4] = await db.insert(showBookRolesTable).values([
          { showBookId: showBook!.id, blockId: bloco1!.id, name: "Protagonista", minimumCoverage: 1, order: 1, tagsJson: [] },
          { showBookId: showBook!.id, blockId: bloco1!.id, name: "Antagonista", minimumCoverage: 1, order: 2, tagsJson: [] },
          { showBookId: showBook!.id, blockId: bloco2!.id, name: "Solista", minimumCoverage: 1, order: 1, tagsJson: [] },
          { showBookId: showBook!.id, blockId: bloco3!.id, name: "Diretor de Palco", minimumCoverage: 1, order: 1, tagsJson: [] },
        ]).returning();
        await db.insert(showBookVersionsTable).values({
          showBookId: showBook!.id,
          version: 1,
          changeType: "STRUCTURAL",
          reason: "Versão inicial do espetáculo",
          snapshot: {},
          createdBy: adminUser.id,
        });
        const today = new Date();
        const fmt = (d: Date) => d.toISOString().split("T")[0]!;
        await db.insert(agendaEventsTable).values([
          {
            operationId: opId,
            showBookId: showBook!.id,
            type: "SHOW",
            title: "Apresentação Semanal",
            date: fmt(new Date(today.getTime() + 7 * 86400000)),
            startTime: "20:00",
            endTime: "22:00",
            location: "Teatro Principal",
            status: "CONFIRMED",
            createdBy: adminUser.id,
            confirmedBy: adminUser.id,
            confirmedAt: new Date(),
          },
          {
            operationId: opId,
            type: "REHEARSAL",
            title: "Ensaio Técnico",
            date: fmt(new Date(today.getTime() + 3 * 86400000)),
            startTime: "14:00",
            endTime: "17:00",
            location: "Sala de Ensaios",
            status: "CONFIRMED",
            createdBy: adminUser.id,
            confirmedBy: adminUser.id,
            confirmedAt: new Date(),
          },
          {
            operationId: opId,
            showBookId: showBook!.id,
            type: "SHOW",
            title: "Grande Apresentação",
            date: fmt(new Date(today.getTime() + 14 * 86400000)),
            startTime: "19:30",
            endTime: "21:30",
            location: "Teatro Principal",
            status: "DRAFT",
            createdBy: adminUser.id,
          },
        ]);
        console.log(`✅ Livro do Show e 3 eventos de agenda criados para operação ${opId}`);
      }
    }
    return;
  }

  const [org] = await db.insert(organizationsTable).values({
    name: "Companhia MyASA Demo",
  }).returning();

  console.log(`✅ Organização criada: ${org!.id}`);

  const [adminUser] = await db.insert(usersTable).values({
    organizationId: org!.id,
    name: "Admin Demo",
    email: "admin@myasa.demo",
    status: "ACTIVE",
    passwordHash,
  }).returning();

  const [supervisorUser] = await db.insert(usersTable).values({
    organizationId: org!.id,
    name: "Supervisor Demo",
    email: "supervisor@myasa.demo",
    status: "ACTIVE",
    passwordHash,
  }).returning();

  const memberUsers = await db.insert(usersTable).values([
    { organizationId: org!.id, name: "Membro 01", email: "membro01@myasa.demo", passwordHash },
    { organizationId: org!.id, name: "Membro 02", email: "membro02@myasa.demo", passwordHash },
    { organizationId: org!.id, name: "Membro 03", email: "membro03@myasa.demo", passwordHash },
    { organizationId: org!.id, name: "Membro 04", email: "membro04@myasa.demo", passwordHash },
    { organizationId: org!.id, name: "Membro 05", email: "membro05@myasa.demo", passwordHash },
  ]).returning();

  console.log(`✅ ${2 + memberUsers.length} usuários criados`);

  const [operation] = await db.insert(operationsTable).values({
    organizationId: org!.id,
    name: "Operação Piloto",
    status: "ACTIVE",
    healthThresholds: {
      scalePublishedDaysAhead: 7,
      dailyBookPublishedHoursAhead: 24,
      openPositionThreshold: 0,
    },
  }).returning();

  console.log(`✅ Operação criada: ${operation!.id}`);

  const [group] = await db.insert(operationalGroupsTable).values({
    operationId: operation!.id,
    name: "Grupo Principal",
    supervisorId: supervisorUser!.id,
  }).returning();

  console.log(`✅ Grupo criado: ${group!.id}`);

  await db.insert(userRolesTable).values([
    { userId: adminUser!.id, operationId: operation!.id, role: "ADMIN", active: true },
    { userId: supervisorUser!.id, operationId: operation!.id, groupId: group!.id, role: "SUPERVISOR_A", active: true },
    ...memberUsers.map((m) => ({
      userId: m.id,
      operationId: operation!.id,
      groupId: group!.id,
      role: "MEMBER" as const,
      active: true,
    })),
  ]);

  console.log("✅ Papéis atribuídos");

  const [showBook] = await db.insert(showBooksTable).values({
    operationId: operation!.id,
    title: "Espetáculo Piloto",
    description: "Livro do Show do espetáculo principal da Companhia Demo",
    type: "STRUCTURED",
    version: 1,
    status: "PUBLISHED",
    createdBy: adminUser!.id,
  }).returning();

  const [cena1, cena2] = await db.insert(showBookScenesTable).values([
    { showBookId: showBook!.id, name: "Ato I — Abertura", order: 1, isOptional: false },
    { showBookId: showBook!.id, name: "Ato II — Clímax", order: 2, isOptional: true },
  ]).returning();

  const [bloco1, bloco2, bloco3] = await db.insert(showBookBlocksTable).values([
    { showBookId: showBook!.id, sceneId: cena1!.id, name: "Cena de Entrada", order: 1 },
    { showBookId: showBook!.id, sceneId: cena1!.id, name: "Solo Central", order: 2 },
    { showBookId: showBook!.id, sceneId: cena2!.id, name: "Conjunto Final", order: 1 },
  ]).returning();

  const [pos1, pos2, pos3, pos4] = await db.insert(showBookRolesTable).values([
    { showBookId: showBook!.id, blockId: bloco1!.id, name: "Protagonista", minimumCoverage: 1, order: 1, tagsJson: [] },
    { showBookId: showBook!.id, blockId: bloco1!.id, name: "Antagonista", minimumCoverage: 1, order: 2, tagsJson: [] },
    { showBookId: showBook!.id, blockId: bloco2!.id, name: "Solista", minimumCoverage: 1, order: 1, tagsJson: [] },
    { showBookId: showBook!.id, blockId: bloco3!.id, name: "Diretor de Palco", minimumCoverage: 1, order: 1, tagsJson: [] },
  ]).returning();

  await db.insert(showBookLinesTable).values([
    {
      positionId: pos1!.id,
      type: "TITULAR_SUBSTITUTE",
      config: { titularId: memberUsers[0]!.id, substituteIds: [memberUsers[1]!.id] },
      order: 1,
    },
    {
      positionId: pos2!.id,
      type: "ROTATION",
      config: { memberIds: [memberUsers[1]!.id, memberUsers[2]!.id], executionCounts: {} },
      order: 1,
    },
    {
      positionId: pos3!.id,
      type: "FIXED_PERSON",
      config: { userId: memberUsers[0]!.id },
      order: 1,
    },
    {
      positionId: pos4!.id,
      type: "MANUAL",
      config: {},
      order: 1,
    },
  ]);

  await db.insert(showBookVersionsTable).values({
    showBookId: showBook!.id,
    version: 1,
    changeType: "STRUCTURAL",
    reason: "Versão inicial do espetáculo",
    snapshot: {},
    createdBy: adminUser!.id,
  });

  const [tag1, tag2] = await db.insert(showBookTagsTable).values([
    { operationId: operation!.id, category: "ARTISTIC_SKILL", label: "ballet clássico", createdBy: adminUser!.id },
    { operationId: operation!.id, category: "PHYSICAL_REQUIREMENT", label: "impacto em joelhos", createdBy: adminUser!.id },
  ]).returning();

  console.log(`✅ Livro do Show criado com hierarquia completa (${tag1 && tag2 ? 2 : 0} tags)`);

  const today = new Date();
  const nextWeek = new Date(today);
  nextWeek.setDate(today.getDate() + 7);
  const twoWeeks = new Date(today);
  twoWeeks.setDate(today.getDate() + 14);

  const formatDate = (d: Date) => d.toISOString().split("T")[0]!;

  await db.insert(agendaEventsTable).values([
    {
      operationId: operation!.id,
      showBookId: showBook!.id,
      type: "SHOW",
      title: "Apresentação Semanal",
      date: formatDate(nextWeek),
      startTime: "20:00",
      endTime: "22:00",
      location: "Teatro Principal",
      status: "CONFIRMED",
      createdBy: adminUser!.id,
      confirmedBy: adminUser!.id,
      confirmedAt: new Date(),
    },
    {
      operationId: operation!.id,
      type: "REHEARSAL",
      title: "Ensaio Técnico",
      date: formatDate(new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000)),
      startTime: "14:00",
      endTime: "17:00",
      location: "Sala de Ensaios",
      status: "CONFIRMED",
      createdBy: supervisorUser!.id,
      confirmedBy: supervisorUser!.id,
      confirmedAt: new Date(),
    },
    {
      operationId: operation!.id,
      showBookId: showBook!.id,
      type: "SHOW",
      title: "Grande Apresentação",
      date: formatDate(twoWeeks),
      startTime: "19:30",
      endTime: "21:30",
      location: "Teatro Principal",
      status: "DRAFT",
      createdBy: adminUser!.id,
    },
  ]);

  console.log("✅ 3 eventos de agenda criados");

  console.log("\n🎉 Seed concluído com sucesso!");
  console.log("\nCredenciais de acesso (dev):");
  console.log(`  Senha (todos): ${DEFAULT_PASSWORD}`);
  console.log(`  Admin:         admin@myasa.demo`);
  console.log(`  Supervisor:    supervisor@myasa.demo`);
  console.log(`  Membros:       membro01..05@myasa.demo`);
}

seed().catch((err) => {
  console.error("❌ Erro no seed:", err);
  process.exit(1);
});
