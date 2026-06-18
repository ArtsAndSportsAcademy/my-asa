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
} from "./index.js";

async function seed() {
  console.log("🌱 Iniciando seed do banco de dados...");

  const [org] = await db.insert(organizationsTable).values({
    name: "Companhia MyASA Demo",
  }).returning();

  console.log(`✅ Organização criada: ${org!.id}`);

  const [adminUser] = await db.insert(usersTable).values({
    organizationId: org!.id,
    name: "Admin Demo",
    email: "admin@myasa.demo",
    status: "ACTIVE",
  }).returning();

  const [supervisorUser] = await db.insert(usersTable).values({
    organizationId: org!.id,
    name: "Supervisor Demo",
    email: "supervisor@myasa.demo",
    status: "ACTIVE",
  }).returning();

  const memberUsers = await db.insert(usersTable).values([
    { organizationId: org!.id, name: "Membro 01", email: "membro01@myasa.demo" },
    { organizationId: org!.id, name: "Membro 02", email: "membro02@myasa.demo" },
    { organizationId: org!.id, name: "Membro 03", email: "membro03@myasa.demo" },
    { organizationId: org!.id, name: "Membro 04", email: "membro04@myasa.demo" },
    { organizationId: org!.id, name: "Membro 05", email: "membro05@myasa.demo" },
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
    title: "Livro do Show Padrão",
    version: 1,
    status: "PUBLISHED",
  }).returning();

  const [block1, block2] = await db.insert(showBookBlocksTable).values([
    { showBookId: showBook!.id, name: "Palco", order: 1 },
    { showBookId: showBook!.id, name: "Backstage", order: 2 },
  ]).returning();

  await db.insert(showBookRolesTable).values([
    { showBookId: showBook!.id, blockId: block1!.id, name: "Diretor de Palco", minimumCoverage: 1, order: 1 },
    { showBookId: showBook!.id, blockId: block1!.id, name: "Contrarregra", minimumCoverage: 2, order: 2 },
    { showBookId: showBook!.id, blockId: block2!.id, name: "Camareira", minimumCoverage: 1, order: 3 },
    { showBookId: showBook!.id, blockId: block2!.id, name: "Assistente de Produção", minimumCoverage: 1, order: 4 },
  ]);

  console.log(`✅ Livro do Show criado com 2 blocos e 4 papéis`);
  console.log("\n🎉 Seed concluído com sucesso!");
  console.log("\nCredenciais de acesso (dev):");
  console.log(`  Admin:      admin@myasa.demo`);
  console.log(`  Supervisor: supervisor@myasa.demo`);
  console.log(`  Membros:    membro01..05@myasa.demo`);
}

seed().catch((err) => {
  console.error("❌ Erro no seed:", err);
  process.exit(1);
});
