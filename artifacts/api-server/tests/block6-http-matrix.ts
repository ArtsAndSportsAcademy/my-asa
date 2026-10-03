/** Chamadas HTTP que chegam aos handlers. Nenhum header de bypass. */
import { readFile } from "node:fs/promises";
import { and, eq, inArray } from "drizzle-orm";
import { db, areasTable, locationsTable, charactersTable, characterCastTable, occurrencesTable,
  sessionsTable, historyEventsTable, operationLocationsTable, organizationsTable, usersTable,
  areaLocalSupervisorsTable } from "@workspace/db";

type Input = {
  request: (path: string, token: string, init?: RequestInit) => Promise<Response>;
  assert: (value: boolean, message: string) => void;
  orgId: string; operationId: string; areaId: string; snowId: string; acquaId: string;
  showId: string; personId: string; otherPersonId: string; supervisorId: string; date: string;
  tokens: Record<string, string>;
};

export async function verifyBlock6HttpRoutes(c: Input) {
  const tag = `block6_http_${Date.now()}`;
  const routes: { method: string; pattern: string; regex: RegExp }[] = [];
  for (const file of ["entities", "occurrences", "areas-locations"]) {
    const source = await readFile(`src/routes/${file}.ts`, "utf8");
    for (const match of source.matchAll(/router\.(get|post|patch|put|delete)\("([^"]+)"/g)) {
      routes.push({ method: match[1]!.toUpperCase(), pattern: match[2]!, regex: new RegExp(`^${match[2]!.replace(/:[^/]+/g, "[^/]+")}$`) });
    }
  }
  const covered = new Set<string>();
  const coveredProfiles = new Set<string>();
  let calls = 0;
  async function call(method: string, path: string, profile: string, expected: number, body?: object) {
    const response = await c.request(path, c.tokens[profile]!, { method, ...(body ? { body: JSON.stringify(body) } : {}) });
    const text = await response.text();
    const data = text ? (() => { try { return JSON.parse(text); } catch { return {}; } })() : {};
    c.assert(response.status === expected, `${profile} ${method} ${path.split("?")[0]}: esperado ${expected}, recebido ${response.status}`);
    const route = routes.find((r) => r.method === method && r.regex.test(path.split("?")[0]!));
    if (route) {
      covered.add(`${method} ${route.pattern}`);
      coveredProfiles.add(`${method} ${route.pattern} ${profile}`);
    }
    calls++;
    if (calls % 25 === 0) process.stdout.write(`block6-http-matrix: ${calls} chamadas verificadas\n`);
    return data;
  }
  const [foreignOrg] = await db.insert(organizationsTable).values({ name: `${tag}_foreign` }).returning();
  const [foreignPerson] = await db.insert(usersTable).values({ organizationId: foreignOrg!.id, name: tag, username: tag }).returning();
  const [foreignLocation] = await db.insert(locationsTable).values({ organizationId: foreignOrg!.id, name: tag }).returning();
  const [foreignCharacter] = await db.insert(charactersTable).values({ locationId: foreignLocation!.id, name: tag, mode: "rodizio" }).returning();
  const [foreignOccurrence] = await db.insert(occurrencesTable).values({ personId: foreignPerson!.id, registeredBy: foreignPerson!.id, date: c.date, type: "ausencia", description: "privado", reason: "motivo privado" }).returning();
  let characterId: string | undefined;
  let occurrenceId: string | undefined;
  let areaId: string | undefined;
  let locationId: string | undefined;
  let sessionId: string | undefined;
  const extraCharacters: string[] = [];
  const extraSessions: string[] = [];
  const extraOccurrences: string[] = [];
  try {
    const character = await call("POST", "/characters", "ADMIN", 201, { name: tag, locationId: c.snowId, mode: "rodizio" });
    characterId = character.character.id;
    const cast = await call("POST", `/characters/${characterId}/cast`, "SUPERVISOR_A", 201, { personId: c.personId, order: 0, timesDone: 0 });
    const castId = cast.cast.id;
    const occurrence = await call("POST", "/occurrences", "MEMBER", 201, { personId: c.personId, date: c.date, type: "atraso", description: "Sem check-in", reason: "Motivo privado da pessoa" });
    occurrenceId = occurrence.occurrence.id;
    const otherAreaOccurrence = await call("POST", "/occurrences", "ADMIN", 201, { personId: c.otherPersonId, date: c.date, type: "ausencia", description: "Outra área", reason: "Teste de escopo por área" });
    extraOccurrences.push(otherAreaOccurrence.occurrence.id);
    const session = await call("POST", `/show-books/${c.showId}/sessions`, "SUPERVISOR_A", 201, { startTime: "16:00", endTime: "17:00", callTime: "15:30" });
    sessionId = session.session.id;
    const area = await call("POST", "/areas", "ADMIN", 201, { name: tag });
    areaId = area.area.id;
    const location = await call("POST", "/locations", "ADMIN", 201, { name: tag });
    locationId = location.location.id;

    // Leitura chega ao handler e comprova projeções de próprio/escopo/leitura.
    for (const profile of Object.keys(c.tokens)) {
      const shelf = await call("GET", "/show-books", profile, 200);
      if (profile === "MEMBER") c.assert(!shelf.showBooks.some((book: any) => book.id === c.showId) && shelf.showBooks.every((book: any) => book.status === "PUBLISHED"), "estante do elenco não mostra show em rascunho");
      if (profile === "ADMIN") c.assert(shelf.showBooks.some((book: any) => book.id === c.showId), "Administração vê o show em rascunho");
      await call("GET", "/characters", profile, 200);
      await call("GET", `/characters/${characterId}/cast`, profile, profile === "SUPERVISOR_B" ? 403 : 200);
      await call("GET", `/characters/${characterId}/resolve?operationId=${c.operationId}&date=${c.date}`, profile, profile === "SUPERVISOR_B" ? 403 : 200);
      await call("GET", `/show-books/${c.showId}/sessions`, profile, 200);
      const own = await call("GET", "/occurrences", profile, 200);
      if (profile === "MEMBER") c.assert(own.occurrences.every((row: any) => row.personId === c.personId), "lista MEM só contém ocorrências próprias");
      // A pessoa não tem local fixo: ambos os supervisores de Bailarinos podem
      // consultar uma ocorrência de Bailarinos. O corte operacional é por área;
      // blocos/check-ins acrescentam o local quando ele existe no contexto.
      await call("GET", `/occurrences/${occurrenceId}`, profile, 200);
      await call("GET", "/areas", profile, profile === "MEMBER" ? 403 : 200);
      await call("GET", "/locations", profile, profile === "MEMBER" ? 403 : 200);
      await call("GET", `/areas/${c.areaId}/local-supervisors`, profile, profile === "MEMBER" ? 403 : 200);
      await call("GET", `/operations/${c.operationId}/locations`, profile, profile === "MEMBER" ? 403 : 200);
    }

    const adminOnly: [string, string, object?][] = [
      ["POST", "/areas", { name: `${tag}_denied` }], ["PATCH", `/areas/${areaId}`, { name: tag }], ["DELETE", `/areas/${areaId}`],
      ["POST", "/locations", { name: `${tag}_denied` }], ["PATCH", `/locations/${locationId}`, { name: tag }], ["DELETE", `/locations/${locationId}`],
      ["PUT", `/areas/${areaId}/locations/${locationId}/supervisor`, { supervisorId: c.supervisorId }],
      ["DELETE", `/areas/${areaId}/locations/${locationId}/supervisor`],
      ["PUT", `/operations/${c.operationId}/locations`, { locationIds: [c.snowId, c.acquaId] }],
      ["PUT", `/users/${c.personId}/operational-scope`, { areaId: c.areaId, locationId: c.snowId }],
    ];
    for (const profile of ["DIR", "MEMBER", "SUPERVISOR_A", "SUPERVISOR_B"]) {
      for (const [method, path, body] of adminOnly) await call(method, path, profile, 403, body);
    }
    const writersOnly: [string, string, object?][] = [
      ["POST", "/characters", { name: tag, locationId: c.snowId, mode: "rodizio" }],
      ["PATCH", `/characters/${characterId}`, { name: tag }], ["DELETE", `/characters/${characterId}`],
      ["POST", `/characters/${characterId}/cast`, { personId: c.personId, order: 1 }],
      ["PATCH", `/characters/${characterId}/cast/${castId}`, { order: 0 }], ["DELETE", `/characters/${characterId}/cast/${castId}`],
      ["PUT", `/characters/${characterId}/cast-order`, { queue: [{ id: castId, personId: c.personId, timesDone: 0 }] }],
      ["POST", `/show-books/${c.showId}/sessions`, { startTime: "18:00", endTime: "19:00" }],
      ["PATCH", `/show-books/${c.showId}/sessions/${sessionId}`, { callTime: null }], ["DELETE", `/show-books/${c.showId}/sessions/${sessionId}`],
    ];
    for (const profile of ["DIR", "MEMBER"]) for (const [method, path, body] of writersOnly) await call(method, path, profile, 403, body);
    for (const [method, path, body] of writersOnly.slice(0, 7)) await call(method, path, "SUPERVISOR_B", 403, body);
    for (const [method, path, body] of [
      ["POST", "/occurrences", { personId: c.personId, date: c.date, type: "atraso", description: "x", reason: "x" }],
      ["PATCH", `/occurrences/${occurrenceId}`, { description: "x", reason: "x" }],
      ["PATCH", `/occurrences/${occurrenceId}/state`, { state: "em_analise", reason: "x" }],
      ["DELETE", `/occurrences/${occurrenceId}`, { reason: "x" }],
    ] as [string, string, object][]) await call(method, path, "DIR", 403, body);

    // Isolamento de organização, inclusive IDs estrangeiros em corpos/query.
    for (const profile of Object.keys(c.tokens)) {
      await call("GET", `/occurrences/${foreignOccurrence!.id}`, profile, 403);
      await call("GET", `/occurrences?personId=${foreignPerson!.id}`, profile, 403);
      await call("GET", `/characters/${foreignCharacter!.id}/resolve?operationId=${c.operationId}&date=${c.date}`, profile, 403);
      await call("POST", "/occurrences", profile, 403, { personId: foreignPerson!.id, date: c.date, type: "x", description: "x", reason: "x" });
    }
    await call("PUT", `/areas/${areaId}/locations/${locationId}/supervisor`, "ADMIN", 400, { supervisorId: foreignPerson!.id });
    await call("PUT", `/areas/${areaId}/locations/${locationId}/supervisor`, "ADMIN", 400, { supervisorId: c.personId });
    const areaOnlyScope = await call("PUT", `/users/${c.personId}/operational-scope`, "ADMIN", 200, { areaId: c.areaId });
    c.assert(!Object.prototype.hasOwnProperty.call(areaOnlyScope.scope ?? {}, "locationId"), "cadastro da pessoa mantém somente área; local é definido pela Programação/Escala");
    await call("GET", `/occurrences/${otherAreaOccurrence.occurrence.id}`, "SUPERVISOR_A", 403);
    await call("GET", `/occurrences/${otherAreaOccurrence.occurrence.id}`, "SUPERVISOR_B", 403);

    // Escritas permitidas e ciclo de vida sem exclusões físicas.
    await call("PATCH", `/areas/${areaId}`, "ADMIN", 200, { name: `${tag}_edit` });
    await call("PUT", `/areas/${areaId}/locations/${locationId}/supervisor`, "ADMIN", 201, { supervisorId: c.supervisorId });
    await call("DELETE", `/areas/${areaId}/locations/${locationId}/supervisor`, "ADMIN", 200);
    await call("PUT", `/operations/${c.operationId}/locations`, "ADMIN", 200, { locationIds: [c.snowId, c.acquaId] });
    const locations = await call("GET", `/operations/${c.operationId}/locations`, "ADMIN", 200);
    c.assert(locations.locations.length === 2, "locais da operação consultáveis por FK sem depender do JSON legado");
    await call("PUT", `/users/${c.personId}/operational-scope`, "ADMIN", 200, { areaId: c.areaId, locationId: c.snowId });
    await call("PATCH", `/characters/${characterId}`, "SUPERVISOR_A", 200, { mode: "titular", reason: "Decisão operacional explícita" });
    await call("PATCH", `/characters/${characterId}/cast/${castId}`, "SUPERVISOR_A", 200, { timesDone: 2 });
    for (const profile of ["ADMIN", "SUPERVISOR_A"]) {
      await call("PUT", `/characters/${characterId}/cast-order`, profile, 200, { queue: [{ id: castId, personId: c.personId, timesDone: 2 }] });
    }
    const reasonEvents = await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.entityId, characterId!), eq(historyEventsTable.action, "character.updated")));
    const reflectionEvents = await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.entityId, castId), eq(historyEventsTable.action, "character_cast.updated")));
    c.assert(reasonEvents.some((event) => event.metadata?.reason === "Decisão operacional explícita"), "motivo opcional informado também é preservado no Registro");
    c.assert(reflectionEvents.some((event) => Array.isArray(event.metadata?.reflection) && event.metadata.reflection.length > 0), "motivo opcional em branco registra o reflexo calculado da mudança");
    await call("PATCH", `/show-books/${c.showId}/sessions/${sessionId}`, "SUPERVISOR_B", 200, { callTime: null });
    const [updatedSession] = await db.select().from(sessionsTable).where(eq(sessionsTable.id, sessionId!));
    c.assert(updatedSession?.callTime === null, "horário de chamada opcional pode ser limpo");
    await call("PATCH", `/occurrences/${occurrenceId}`, "MEMBER", 400, { reason: "  ", description: "x" });
    await call("PATCH", `/occurrences/${occurrenceId}`, "MEMBER", 200, { reason: "Correção própria", description: "Descrição corrigida" });
    await call("PATCH", `/occurrences/${occurrenceId}/state`, "SUPERVISOR_A", 200, { state: "em_analise", reason: "Início de análise" });
    await call("PATCH", `/occurrences/${occurrenceId}/state`, "ADMIN", 200, { state: "resolvida", reason: "Análise concluída" });
    await call("DELETE", `/occurrences/${occurrenceId}`, "ADMIN", 400, { reason: "  " });
    await call("DELETE", `/occurrences/${occurrenceId}`, "ADMIN", 200, { reason: "Registro duplicado" });
    const ownList = await call("GET", "/occurrences", "MEMBER", 200);
    c.assert(!ownList.occurrences.some((row: any) => row.id === occurrenceId), "ocorrência desativada sai da lista mas continua consultável");
    await call("GET", `/occurrences/${occurrenceId}`, "MEMBER", 200);

    // As rotas novas usam o mesmo ponto de falha determinístico do Bloco 5.
    process.env.MYASA_TEST_FAIL_HISTORY = "1";
    try {
      const failed = await c.request(`/characters/${characterId}`, c.tokens.ADMIN!, { method: "PATCH", body: JSON.stringify({ name: `${tag}_must_rollback` }) });
      await failed.text();
      c.assert(failed.status >= 400, "falha de Registro é devolvida ao cliente");
    } finally { process.env.MYASA_TEST_FAIL_HISTORY = "0"; }
    const [unchanged] = await db.select().from(charactersTable).where(eq(charactersTable.id, characterId!));
    c.assert(unchanged?.name === tag, "falha no Registro não persiste alteração de Personagem");

    // Fecha o produto cartesiano rota/perfil: cada perfil chega a cada rota
    // nova, inclusive nos caminhos positivos antes cobertos por outro gestor.
    const extraCharacter = await call("POST", "/characters", "SUPERVISOR_A", 201, { name: `${tag}_supervisor`, locationId: c.snowId, mode: "titular" });
    extraCharacters.push(extraCharacter.character.id);
    await call("PATCH", `/characters/${characterId}`, "ADMIN", 200, { name: tag });
    const extraCast = await call("POST", `/characters/${characterId}/cast`, "ADMIN", 201, { personId: c.otherPersonId, order: 1 });
    await call("PATCH", `/characters/${characterId}/cast/${castId}`, "ADMIN", 200, { timesDone: 2 });
    for (const [profile, startTime, endTime] of [["ADMIN", "18:00", "19:00"], ["SUPERVISOR_B", "20:00", "21:00"]]) {
      const extraSession = await call("POST", `/show-books/${c.showId}/sessions`, profile!, 201, { startTime, endTime });
      extraSessions.push(extraSession.session.id);
    }
    for (const profile of ["ADMIN", "SUPERVISOR_A"]) await call("PATCH", `/show-books/${c.showId}/sessions/${sessionId}`, profile, 200, { callTime: null });
    const extraOccurrence = await call("POST", "/occurrences", "SUPERVISOR_A", 201, { personId: c.personId, date: c.date, type: "atraso", description: "Análise própria", reason: "Registro da supervisão" });
    extraOccurrences.push(extraOccurrence.occurrence.id);
    for (const profile of ["ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"]) await call("PATCH", `/occurrences/${extraOccurrence.occurrence.id}`, profile, 200, { description: "Conferida", reason: "Conferência" });
    await call("PATCH", `/occurrences/${extraOccurrence.occurrence.id}/state`, "MEMBER", 200, { state: "em_analise", reason: "Análise própria" });
    await call("PATCH", `/occurrences/${extraOccurrence.occurrence.id}/state`, "SUPERVISOR_B", 200, { state: "resolvida", reason: "Tratativa da supervisão" });
    for (const profile of ["SUPERVISOR_B", "SUPERVISOR_A", "MEMBER"]) await call("DELETE", `/occurrences/${extraOccurrence.occurrence.id}`, profile, 200, { reason: "Registro duplicado" });

    await call("DELETE", `/characters/${characterId}/cast/${castId}`, "SUPERVISOR_A", 200);
    await call("DELETE", `/characters/${characterId}/cast/${extraCast.cast.id}`, "ADMIN", 200);
    await call("DELETE", `/characters/${characterId}`, "SUPERVISOR_A", 200);
    await call("DELETE", `/characters/${characterId}`, "ADMIN", 200);
    await call("DELETE", `/show-books/${c.showId}/sessions/${sessionId}`, "SUPERVISOR_A", 200);
    for (const profile of ["ADMIN", "SUPERVISOR_B"]) await call("DELETE", `/show-books/${c.showId}/sessions/${sessionId}`, profile, 200);
    await call("DELETE", `/locations/${locationId}`, "ADMIN", 200, { reason: "Encerramento" });
    await call("PATCH", `/locations/${locationId}`, "ADMIN", 400, { closed: false, reason: "  " });
    await call("PATCH", `/locations/${locationId}`, "ADMIN", 200, { closed: false, reason: "Retomada da operação" });
    await call("DELETE", `/areas/${areaId}`, "ADMIN", 200);
    const [keptCharacter] = await db.select().from(charactersTable).where(eq(charactersTable.id, characterId!));
    const [keptOccurrence] = await db.select().from(occurrencesTable).where(eq(occurrencesTable.id, occurrenceId!));
    const history = await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.orgId, c.orgId), inArray(historyEventsTable.entityId, [characterId!, occurrenceId!, sessionId!, areaId!, locationId!])));
    c.assert(keptCharacter?.active === false && keptOccurrence?.active === false && history.length >= 10, "desativações mantêm linhas e Registro antes/depois legível");
    const uncovered = routes.filter((r) => !covered.has(`${r.method} ${r.pattern}`));
    c.assert(uncovered.length === 0, `todas as rotas novas passam por handler real; fora: ${uncovered.map((r) => r.pattern).join(", ")}`);
    const missingProfiles = routes.flatMap((r) => Object.keys(c.tokens).map((profile) => `${r.method} ${r.pattern} ${profile}`)).filter((key) => !coveredProfiles.has(key));
    c.assert(missingProfiles.length === 0, `todas as combinações rota/perfil foram chamadas; fora: ${missingProfiles.join(", ")}`);
    process.stdout.write(`block6-http-matrix: ${covered.size}/${routes.length} rotas novas; ${calls} chamadas HTTP reais; ${coveredProfiles.size}/${routes.length * Object.keys(c.tokens).length} combinações rota/perfil; ${uncovered.length} rotas fora\n`);
  } finally {
    process.env.MYASA_TEST_FAIL_HISTORY = "0";
    if (sessionId) await db.delete(sessionsTable).where(eq(sessionsTable.id, sessionId));
    if (extraSessions.length) await db.delete(sessionsTable).where(inArray(sessionsTable.id, extraSessions));
    if (extraOccurrences.length) await db.delete(occurrencesTable).where(inArray(occurrencesTable.id, extraOccurrences));
    if (extraCharacters.length) await db.delete(charactersTable).where(inArray(charactersTable.id, extraCharacters));
    if (occurrenceId) await db.delete(occurrencesTable).where(eq(occurrencesTable.id, occurrenceId));
    if (characterId) {
      await db.delete(characterCastTable).where(eq(characterCastTable.characterId, characterId));
      await db.delete(charactersTable).where(eq(charactersTable.id, characterId));
    }
    if (areaId) {
      await db.delete(areaLocalSupervisorsTable).where(eq(areaLocalSupervisorsTable.areaId, areaId));
      await db.delete(areasTable).where(eq(areasTable.id, areaId));
    }
    await db.delete(operationLocationsTable).where(eq(operationLocationsTable.operationId, c.operationId));
    if (locationId) await db.delete(locationsTable).where(eq(locationsTable.id, locationId));
    await db.delete(occurrencesTable).where(eq(occurrencesTable.id, foreignOccurrence!.id));
    await db.delete(charactersTable).where(eq(charactersTable.id, foreignCharacter!.id));
    await db.delete(locationsTable).where(eq(locationsTable.id, foreignLocation!.id));
    await db.delete(usersTable).where(eq(usersTable.id, foreignPerson!.id));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, foreignOrg!.id));
  }
}
