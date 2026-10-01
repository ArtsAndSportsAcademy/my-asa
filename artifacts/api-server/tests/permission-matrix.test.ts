/**
 * G1 — matriz HTTP real.
 *
 * O inventário é extraído dos próprios arquivos de rotas: cada declaração
 * router.<método>(...) protegida precisa devolver 401 sem Bearer token. Os
 * casos adicionais exercitam perfis, operação e organização com dados reais.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import http from "node:http";
import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  pool,
  organizationsTable,
  operationsTable,
  usersTable,
  userRolesTable,
  showBooksTable,
  operationalGroupsTable,
  areasTable,
  locationsTable,
  areaLocalSupervisorsTable,
  scalesTable,
  historyEventsTable,
  requestsTable,
  libraryDocumentsTable,
  libraryDocumentVersionsTable,
} from "@workspace/db";
import app from "../src/application.js";
import { signAccessToken } from "../src/lib/jwt.service.js";

let passed = 0;
const failures: string[] = [];
// Erros de asserção precisam ficar visíveis, inclusive se houver cleanup.
const nativeConsoleError = console.error;

function assert(condition: boolean, message: string) {
  if (condition) passed += 1;
  else {
    failures.push(message);
    console.error(`  ✗ ${message}`);
  }
}

type RouteCase = { file: string; method: string; route: string; public: boolean };

async function walk(directory: string): Promise<string[]> {
  const output: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await walk(full));
    else if (entry.name.endsWith(".ts")) output.push(full);
  }
  return output;
}

async function inventoryRoutes(routeDir: string): Promise<RouteCase[]> {
  const routeCases: RouteCase[] = [];
  const declaration = /router\.(get|post|patch|put|delete)\s*\(\s*["`]([^"`]+)["`]/g;
  for (const file of await walk(routeDir)) {
    const source = await readFile(file, "utf8");
    for (const match of source.matchAll(declaration)) {
      const method = match[1]!.toUpperCase();
      const route = match[2]!;
      const basename = path.basename(file);
      const publicRoute = basename === "health.ts"
        || (basename === "auth.ts" && (route === "/login" || route === "/refresh"));
      routeCases.push({ file, method, route: basename === "auth.ts" ? `/auth${route}` : route, public: publicRoute });
    }
  }
  return routeCases;
}

function concretePath(route: string): string {
  return route.replace(/:([^/]+)/g, "00000000-0000-4000-8000-000000000000");
}

function tokenFor(user: { id: string; organizationId: string }, role: string, operationIds: string[]) {
  return signAccessToken({
    sub: user.id,
    jti: `permission-matrix-${user.id}`,
    organizationId: user.organizationId,
    role,
    operationIds,
  });
}

async function inBatches<T>(items: T[], size: number, action: (item: T) => Promise<void>) {
  for (let index = 0; index < items.length; index += size) {
    await Promise.all(items.slice(index, index + size).map(action));
  }
}

async function run() {
  process.stdout.write("permission-matrix: iniciando\n");
  const tag = `block5_permissions_${Date.now()}`;
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [org2] = await db.insert(organizationsTable).values({ name: `${tag}_other_org` }).returning();
  const [operation] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const [operation2] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op2`, status: "ACTIVE" }).returning();
  const [otherOperation] = await db.insert(operationsTable).values({ organizationId: org2!.id, name: `${tag}_other_op`, status: "ACTIVE" }).returning();
  const [bailarinos] = await db.insert(operationalGroupsTable).values({ organizationId: org!.id, operationId: operation!.id, name: `${tag}_bailarinos` }).returning();
  const [patinadores] = await db.insert(operationalGroupsTable).values({ organizationId: org!.id, operationId: operation!.id, name: `${tag}_patinadores` }).returning();
  const [snowland] = await db.insert(locationsTable).values({ organizationId: org!.id, name: `${tag}_snowland` }).returning();
  const [acquamotion] = await db.insert(locationsTable).values({ organizationId: org!.id, name: `${tag}_acquamotion` }).returning();
  const [bailarinosArea] = await db.insert(areasTable).values({ organizationId: org!.id, name: `${tag}_area_bailarinos` }).returning();
  const [admin] = await db.insert(usersTable).values({ organizationId: org!.id, name: `${tag}_admin`, username: `${tag}_admin` }).returning();
  const [supervisor] = await db.insert(usersTable).values({ organizationId: org!.id, name: `${tag}_supervisor`, username: `${tag}_supervisor`, areaId: bailarinosArea!.id }).returning();
  const [supervisorB] = await db.insert(usersTable).values({ organizationId: org!.id, name: `${tag}_supervisor_b`, username: `${tag}_supervisor_b`, areaId: bailarinosArea!.id }).returning();
  const [member] = await db.insert(usersTable).values({ organizationId: org!.id, name: `${tag}_member`, username: `${tag}_member`, areaId: bailarinosArea!.id }).returning();
  const [trainer] = await db.insert(usersTable).values({ organizationId: org!.id, name: `${tag}_trainer`, username: `${tag}_trainer` }).returning();
  const [director] = await db.insert(usersTable).values({ organizationId: org!.id, name: `${tag}_director`, username: `${tag}_director` }).returning();
  const [otherAdmin] = await db.insert(usersTable).values({ organizationId: org2!.id, name: `${tag}_other_admin`, username: `${tag}_other_admin` }).returning();
  const [otherBook] = await db.insert(showBooksTable).values({ operationId: otherOperation!.id, title: `${tag}_other_book`, createdBy: otherAdmin!.id }).returning();
  const [otherRequest] = await db.insert(requestsTable).values({ requesterId: otherAdmin!.id, operationId: otherOperation!.id, type: "LEAVE", targetDates: ["2026-09-20"], reason: "fora da organização" }).returning();
  const [otherDocument] = await db.insert(libraryDocumentsTable).values({ orgId: org2!.id, type: "ONBOARDING_MATERIAL", title: `${tag}_other_document`, body: "privado", createdBy: otherAdmin!.id }).returning();
  await db.insert(libraryDocumentVersionsTable).values({ documentId: otherDocument!.id, version: 1, title: otherDocument!.title, body: otherDocument!.body, createdBy: otherAdmin!.id });

  let server: http.Server | null = null;
  let lifecycleUserId: string | null = null;
  let lifecycleAreaId: string | null = null;
  let lifecycleLocationId: string | null = null;
  try {
    await db.insert(userRolesTable).values([
      { userId: admin!.id, operationId: operation!.id, role: "ADMIN", active: true },
      { userId: supervisor!.id, operationId: operation!.id, groupId: bailarinos!.id, role: "SUPERVISOR_A", active: true },
      { userId: supervisorB!.id, operationId: operation!.id, groupId: bailarinos!.id, role: "SUPERVISOR_B", active: true },
      { userId: member!.id, operationId: operation!.id, groupId: bailarinos!.id, role: "MEMBER", active: true },
      { userId: trainer!.id, operationId: operation!.id, groupId: bailarinos!.id, role: "TRAINER", active: true },
      { userId: director!.id, operationId: operation!.id, role: "DIR", active: true },
      { userId: otherAdmin!.id, operationId: otherOperation!.id, role: "ADMIN", active: true },
    ]);
    await db.insert(areaLocalSupervisorsTable).values([
      { areaId: bailarinosArea!.id, locationId: snowland!.id, supervisorId: supervisor!.id, active: true },
      { areaId: bailarinosArea!.id, locationId: acquamotion!.id, supervisorId: supervisorB!.id, active: true },
    ]);

    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("servidor de teste não iniciou");
    const base = `http://127.0.0.1:${address.port}/api`;

    const routeCases = await inventoryRoutes(path.resolve(process.cwd(), "src/routes"));
    const allProtectedRoutes = routeCases.filter((route) => !route.public);
    // Cada faixa é executável isoladamente contra o pool pequeno do Supabase.
    // A CI roda a matriz inteira; localmente, as faixas impedem que 2.500
    // leituras de autenticação esgotem as conexões da instância de teste.
    const routeOffset = Math.max(0, Number(process.env.PERMISSION_ROUTE_OFFSET ?? "0"));
    const routeLimit = Math.max(1, Number(process.env.PERMISSION_ROUTE_LIMIT ?? String(allProtectedRoutes.length)));
    const protectedRoutes = allProtectedRoutes.slice(routeOffset, routeOffset + routeLimit);
    if (protectedRoutes.length === 0) throw new Error("Faixa de rotas de permissão vazia");
    let unauthenticatedPassed = 0;
    for (const route of protectedRoutes) {
      const response = await fetch(`${base}${concretePath(route.route)}`, { method: route.method });
      if (response.status === 401) unauthenticatedPassed += 1;
      else { failures.push(`${route.method} ${route.route} sem autenticação devolveu ${response.status}, esperado 401`); console.error(`  ✗ ${failures.at(-1)}`); }
    }
    assert(unauthenticatedPassed === protectedRoutes.length, `todas as ${protectedRoutes.length} rotas protegidas rejeitam chamadas sem autenticação (401)`);

    const adminToken = tokenFor(admin!, "ADMIN", [operation!.id, operation2!.id]);
    const supervisorToken = tokenFor(supervisor!, "SUPERVISOR_A", [operation!.id]);
    const supervisorBToken = tokenFor(supervisorB!, "SUPERVISOR_B", [operation!.id]);
    const memberToken = tokenFor(member!, "MEMBER", [operation!.id]);
    const trainerToken = tokenFor(trainer!, "TRAINER", [operation!.id]);
    const directorToken = tokenFor(director!, "DIR", [operation!.id]);
    const auth = (token: string) => ({ authorization: `Bearer ${token}`, "content-type": "application/json" });

    // Grupo A: o diretório é filtrado no servidor. A tela aplica o mesmo
    // recorte visual, mas não recebe pessoas fora do perfil autenticado.
    const [directoryByAdmin, directoryByDirector, directoryBySupervisor, directoryByMember] = await Promise.all([
      fetch(`${base}/users`, { headers: auth(adminToken) }), fetch(`${base}/users`, { headers: auth(directorToken) }),
      fetch(`${base}/users`, { headers: auth(supervisorToken) }), fetch(`${base}/users`, { headers: auth(memberToken) }),
    ]);
    const memberDirectory = await directoryByMember.json() as { users: { areaId?: string | null }[] };
    assert(directoryByAdmin.status === 200 && directoryByDirector.status === 200, "ADM e DIR consultam o diretório de Pessoas");
    assert(directoryBySupervisor.status === 200 && memberDirectory.users.every((person) => person.areaId === bailarinosArea!.id), "SUP e MEM só recebem pessoas da própria área no diretório");

    // Validação de persistência: o fluxo que a tela usa cria, atribui escopo,
    // edita e desliga no Postgres de teste — sem apagar a linha histórica.
    const createdDirectoryPerson = await fetch(`${base}/users`, { method: "POST", headers: auth(adminToken), body: JSON.stringify({ fullName: `${tag} pessoa de cadastro`, email: `${tag}@example.test`, password: "senha-teste-grupo-a" }) });
    const createdDirectoryPayload = await createdDirectoryPerson.json() as { user?: { id: string } };
    lifecycleUserId = createdDirectoryPayload.user?.id ?? null;
    assert(createdDirectoryPerson.status === 201 && !!lifecycleUserId, "ADM cria pessoa pelo cadastro");
    const scopeDirectoryPerson = lifecycleUserId ? await fetch(`${base}/users/${lifecycleUserId}/operational-scope`, { method: "PUT", headers: auth(adminToken), body: JSON.stringify({ areaId: bailarinosArea!.id }) }) : null;
    const editedDirectoryPerson = lifecycleUserId ? await fetch(`${base}/users/${lifecycleUserId}`, { method: "PATCH", headers: auth(adminToken), body: JSON.stringify({ fullName: `${tag} pessoa editada` }) }) : null;
    const deactivatedDirectoryPerson = lifecycleUserId ? await fetch(`${base}/users/${lifecycleUserId}`, { method: "DELETE", headers: auth(adminToken), body: JSON.stringify({ reason: "Validação do cadastro Grupo A" }) }) : null;
    const [keptDirectoryPerson] = lifecycleUserId ? await db.select().from(usersTable).where(eq(usersTable.id, lifecycleUserId)).limit(1) : [];
    assert(scopeDirectoryPerson?.status === 200 && editedDirectoryPerson?.status === 200 && deactivatedDirectoryPerson?.status === 200, "ADM atribui escopo, edita e desliga pessoa pelo cadastro");
    assert(keptDirectoryPerson?.status === "INACTIVE" && keptDirectoryPerson.personStatus === "ARCHIVED", "desligar pessoa preserva a linha como inativa no banco");

    const createdDirectoryLocation = await fetch(`${base}/locations`, { method: "POST", headers: auth(adminToken), body: JSON.stringify({ name: `${tag} local de cadastro`, type: "teste" }) });
    const createdDirectoryLocationPayload = await createdDirectoryLocation.json() as { location?: { id: string } };
    lifecycleLocationId = createdDirectoryLocationPayload.location?.id ?? null;
    const editedDirectoryLocation = lifecycleLocationId ? await fetch(`${base}/locations/${lifecycleLocationId}`, { method: "PATCH", headers: auth(adminToken), body: JSON.stringify({ name: `${tag} local editado` }) }) : null;
    const closedDirectoryLocation = lifecycleLocationId ? await fetch(`${base}/locations/${lifecycleLocationId}`, { method: "DELETE", headers: auth(adminToken), body: JSON.stringify({ reason: "Validação do cadastro Grupo A" }) }) : null;
    const [keptDirectoryLocation] = lifecycleLocationId ? await db.select().from(locationsTable).where(eq(locationsTable.id, lifecycleLocationId)).limit(1) : [];
    assert(createdDirectoryLocation.status === 201 && editedDirectoryLocation?.status === 200 && closedDirectoryLocation?.status === 200, "ADM cria, edita e encerra Local pelo cadastro");
    assert(keptDirectoryLocation?.closed === true, "encerrar Local preserva a linha no banco");

    const createdDirectoryArea = await fetch(`${base}/areas`, { method: "POST", headers: auth(adminToken), body: JSON.stringify({ name: `${tag} área de cadastro` }) });
    const createdDirectoryAreaPayload = await createdDirectoryArea.json() as { area?: { id: string } };
    lifecycleAreaId = createdDirectoryAreaPayload.area?.id ?? null;
    const editedDirectoryArea = lifecycleAreaId ? await fetch(`${base}/areas/${lifecycleAreaId}`, { method: "PATCH", headers: auth(adminToken), body: JSON.stringify({ name: `${tag} área editada` }) }) : null;
    const deactivatedDirectoryArea = lifecycleAreaId ? await fetch(`${base}/areas/${lifecycleAreaId}`, { method: "DELETE", headers: auth(adminToken), body: JSON.stringify({}) }) : null;
    const [keptDirectoryArea] = lifecycleAreaId ? await db.select().from(areasTable).where(eq(areasTable.id, lifecycleAreaId)).limit(1) : [];
    assert(createdDirectoryArea.status === 201 && editedDirectoryArea?.status === 200 && deactivatedDirectoryArea?.status === 200, "ADM cria, edita e desativa Área pelo cadastro");
    assert(keptDirectoryArea?.active === false, "desativar Área preserva a linha no banco");

    // A varredura acima prova somente 401. Permissões são provadas abaixo
    // com recursos reais e na matriz do Bloco 6, sem bypass em requireAuth.

    if (process.env.PERMISSION_INCLUDE_CASES !== "0") {
    const memberOtherProfile = await fetch(`${base}/users/${admin!.id}/roles`, { headers: auth(memberToken) });
    assert(memberOtherProfile.status === 403, "MEM autenticado lendo ficha de outra pessoa devolve 403");

    const memberScale = await fetch(`${base}/scales/generate`, {
      method: "POST", headers: auth(memberToken),
      body: JSON.stringify({ operationId: operation!.id, periodStart: "2026-09-20", periodEnd: "2026-09-20" }),
    });
    assert(memberScale.status === 403, "MEM salvando Escala devolve 403");

    const memberDailyBook = await fetch(`${base}/daily-book/generate`, {
      method: "POST", headers: auth(memberToken),
      body: JSON.stringify({ showBookId: otherBook!.id, date: "2026-09-20" }),
    });
    assert([403, 404].includes(memberDailyBook.status), "MEM não consegue gerar Livro do Dia fora do próprio escopo");

    const memberShowBook = await fetch(`${base}/show-books`, {
      method: "POST", headers: auth(memberToken),
      body: JSON.stringify({ operationId: operation!.id, title: "não deve criar" }),
    });
    assert(memberShowBook.status === 403, "MEM salvando Livro do Show devolve 403");

    const supervisorOtherOperation = await fetch(`${base}/scales/generate`, {
      method: "POST", headers: auth(supervisorToken),
      body: JSON.stringify({ operationId: operation2!.id, periodStart: "2026-09-20", periodEnd: "2026-09-20" }),
    });
    assert(supervisorOtherOperation.status === 403, "SUP de uma operação não salva Escala de outra operação");

    const supervisorOtherGroup = await fetch(`${base}/scales/generate`, {
      method: "POST", headers: auth(supervisorToken),
      body: JSON.stringify({ operationId: operation!.id, groupId: patinadores!.id, periodStart: "2026-09-20", periodEnd: "2026-09-20" }),
    });
    assert(supervisorOtherGroup.status === 403, "SUP de Bailarinos não salva Escala de Patinadores na mesma operação");

    const victorSnowland = await fetch(`${base}/scales/generate`, {
      method: "POST", headers: auth(supervisorToken),
      body: JSON.stringify({ operationId: operation!.id, groupId: bailarinos!.id, areaId: bailarinosArea!.id, locationId: snowland!.id, periodStart: "2026-09-20", periodEnd: "2026-09-20" }),
    });
    const victorAcquamotion = await fetch(`${base}/scales/generate`, {
      method: "POST", headers: auth(supervisorToken),
      body: JSON.stringify({ operationId: operation!.id, groupId: bailarinos!.id, areaId: bailarinosArea!.id, locationId: acquamotion!.id, periodStart: "2026-09-20", periodEnd: "2026-09-20" }),
    });
    const stephaniSnowland = await fetch(`${base}/scales/generate`, {
      method: "POST", headers: auth(supervisorBToken),
      body: JSON.stringify({ operationId: operation!.id, groupId: bailarinos!.id, areaId: bailarinosArea!.id, locationId: snowland!.id, periodStart: "2026-09-20", periodEnd: "2026-09-20" }),
    });
    const stephaniAcquamotion = await fetch(`${base}/scales/generate`, {
      method: "POST", headers: auth(supervisorBToken),
      body: JSON.stringify({ operationId: operation!.id, groupId: bailarinos!.id, areaId: bailarinosArea!.id, locationId: acquamotion!.id, periodStart: "2026-09-20", periodEnd: "2026-09-20" }),
    });
    assert(victorSnowland.status === 201 && victorAcquamotion.status === 403 && stephaniSnowland.status === 403 && stephaniAcquamotion.status === 201, "ÁreaLocalSupervisor impede que Victor e Stephani salvem Escala fora do próprio local");

    const directorScale = await fetch(`${base}/scales/generate`, {
      method: "POST", headers: auth(directorToken),
      body: JSON.stringify({ operationId: operation!.id, periodStart: "2026-09-20", periodEnd: "2026-09-20" }),
    });
    assert(directorScale.status === 403, "DIR é leitura e não salva Escala");

    const memberFormation = await fetch(`${base}/formations/from-scene`, {
      method: "POST", headers: auth(memberToken), body: JSON.stringify({ sceneId: "00000000-0000-4000-8000-000000000000", name: "x" }),
    });
    assert(memberFormation.status === 403, "MEM não grava Formação");

    const memberConflict = await fetch(`${base}/schedule-conflicts/00000000-0000-4000-8000-000000000000/acknowledge`, {
      method: "POST", headers: auth(memberToken), body: JSON.stringify({ reason: "não" }),
    });
    assert(memberConflict.status === 403, "MEM não reconhece conflito de horário");

    const otherOrgBook = await fetch(`${base}/show-books/${otherBook!.id}`, { headers: auth(adminToken) });
    // O contrato anterior usa 404 para não revelar a existência cross-org;
    // nenhum dado é devolvido. O caso fica explicitamente registrado para a decisão
    // futura entre 403 explícito e 404 anti-enumeração.
    assert(otherOrgBook.status === 404, "acesso cross-org ao Livro do Show não revela dado (404 anti-enumeração)");

    const [foreignRequestForAdmin, foreignRequestForSupervisor, foreignVersionsForAdmin, foreignVersionsForSupervisor] = await Promise.all([
      fetch(`${base}/requests/${otherRequest!.id}`, { headers: auth(adminToken) }),
      fetch(`${base}/requests/${otherRequest!.id}`, { headers: auth(supervisorToken) }),
      fetch(`${base}/library/documents/${otherDocument!.id}/versions`, { headers: auth(adminToken) }),
      fetch(`${base}/library/documents/${otherDocument!.id}/versions`, { headers: auth(supervisorToken) }),
    ]);
    assert(
      foreignRequestForAdmin.status === 403
        && foreignRequestForSupervisor.status === 403
        && foreignVersionsForAdmin.status === 403
        && foreignVersionsForSupervisor.status === 403,
      "Solicitações e versões da Biblioteca recusam ADMIN e SUP de outra organização (403)",
    );
    await Promise.all([
      foreignRequestForAdmin.arrayBuffer(),
      foreignRequestForSupervisor.arrayBuffer(),
      foreignVersionsForAdmin.arrayBuffer(),
      foreignVersionsForSupervisor.arrayBuffer(),
    ]);

    const directorRead = await fetch(`${base}/areas`, { headers: auth(directorToken) });
    assert(directorRead.status === 200, "DIR lê Áreas pela rota real");
    }

    process.stdout.write(`permission-matrix: ${protectedRoutes.length}/${allProtectedRoutes.length} rotas protegidas verificadas sem autenticação (401); ${routeCases.filter((route) => route.public).length} públicas; casos de autorização reais abaixo; ${failures.length} falhas\n`);
  } finally {
    if (server) {
      // As 1.250 sondagens usam keep-alive do fetch; encerra conexões ociosas
      // antes de aguardar o close para que o processo do teste termine.
      server.closeAllConnections?.();
      await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve()));
    }
    await db.delete(historyEventsTable).where(eq(historyEventsTable.orgId, org!.id));
    await db.delete(scalesTable).where(inArray(scalesTable.operationId, [operation!.id, operation2!.id]));
    if (otherDocument) await db.delete(libraryDocumentVersionsTable).where(eq(libraryDocumentVersionsTable.documentId, otherDocument.id));
    if (otherDocument) await db.delete(libraryDocumentsTable).where(eq(libraryDocumentsTable.id, otherDocument.id));
    if (otherRequest) await db.delete(requestsTable).where(eq(requestsTable.id, otherRequest.id));
    if (otherBook) await db.delete(showBooksTable).where(eq(showBooksTable.id, otherBook.id));
    if (admin || supervisor || supervisorB || member || trainer || director || otherAdmin) {
      await db.delete(userRolesTable).where(eq(userRolesTable.operationId, operation!.id));
      await db.delete(userRolesTable).where(eq(userRolesTable.operationId, operation2!.id));
      await db.delete(userRolesTable).where(eq(userRolesTable.operationId, otherOperation!.id));
    }
    if (supervisor && supervisorB) await db.delete(areaLocalSupervisorsTable).where(inArray(areaLocalSupervisorsTable.supervisorId, [supervisor.id, supervisorB.id]));
    if (lifecycleUserId) await db.delete(usersTable).where(eq(usersTable.id, lifecycleUserId));
    for (const user of [admin, supervisor, supervisorB, member, trainer, director, otherAdmin]) if (user) await db.delete(usersTable).where(eq(usersTable.id, user.id));
    if (bailarinos) await db.delete(operationalGroupsTable).where(eq(operationalGroupsTable.id, bailarinos.id));
    if (patinadores) await db.delete(operationalGroupsTable).where(eq(operationalGroupsTable.id, patinadores.id));
    if (lifecycleAreaId) await db.delete(areasTable).where(eq(areasTable.id, lifecycleAreaId));
    if (bailarinosArea) await db.delete(areasTable).where(eq(areasTable.id, bailarinosArea.id));
    if (lifecycleLocationId) await db.delete(locationsTable).where(eq(locationsTable.id, lifecycleLocationId));
    if (snowland && acquamotion) await db.delete(locationsTable).where(inArray(locationsTable.id, [snowland.id, acquamotion.id]));
    if (operation) await db.delete(operationsTable).where(eq(operationsTable.id, operation.id));
    if (operation2) await db.delete(operationsTable).where(eq(operationsTable.id, operation2.id));
    if (otherOperation) await db.delete(operationsTable).where(eq(operationsTable.id, otherOperation.id));
    if (org) await db.delete(organizationsTable).where(eq(organizationsTable.id, org.id));
    if (org2) await db.delete(organizationsTable).where(eq(organizationsTable.id, org2.id));
  }

  console.error = nativeConsoleError;
  if (failures.length > 0) throw new Error(`${failures.length} falha(s) na matriz HTTP`);
  process.stdout.write(`permission-matrix: ${passed} asserts passed\n`);
}

run()
  .catch((error) => {
    console.error = nativeConsoleError;
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
