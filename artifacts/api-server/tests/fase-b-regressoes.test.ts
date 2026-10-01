/** Fase B do plano de lançamento — regressões encontradas na auditoria de 30/09/2026, contra PostgreSQL real de teste. */
import http from "node:http";
import { and, eq, inArray, or } from "drizzle-orm";
import {
  areaLocalSupervisorsTable,
  areasTable,
  dayCheckInsTable,
  db,
  historyEventsTable,
  locationsTable,
  notificationOutboxTable,
  operationLocationsTable,
  operationsTable,
  organizationsTable,
  pool,
  programacaoBlocosTable,
  programacoesTable,
  refreshTokensTable,
  responsibilitiesTable,
  scalesTable,
  tasksTable,
  userNotificationsTable,
  userRolesTable,
  usersTable,
} from "@workspace/db";
import app from "../src/application.js";
import { hashToken, signAccessToken, signRefreshToken } from "../src/lib/jwt.service.js";
import { normalizeActionUrl } from "../src/lib/app-routes.js";
import { createNotification } from "../src/services/notificationService.js";

let passed = 0;
const failures: string[] = [];
function assert(condition: boolean, message: string) {
  if (condition) passed += 1;
  else { failures.push(message); console.error(`  ✗ ${message}`); }
}

async function run() {
  // ---------- B4 · links dos avisos (sem banco) ----------
  const legacy: [string, string, string][] = [
    ["/(tabs)/daily-book", "book.published", "/livro-do-dia"],
    ["/(tabs)/scale", "scale.published", "/escalas"],
    ["/membro/escala", "scale.published", "/escalas"],
    ["/admin/home", "checkin.shift_reminder", "/check-in"],
    ["/(tabs)/agenda", "agenda.invite", "/agenda"],
    ["/(tabs)/mensagens", "message.new", "/mensagens"],
    ["/(tabs)/avisos", "notice.published", "/mural"],
    ["/membro/avisos", "notice.requires_ack", "/mural"],
    // Desde 01/10 Solicitações tem tela própria; folga antiga continua indo para Folgas.
    ["/(tabs)/solicitacoes", "request.denied", "/solicitacoes"],
    ["/membro/solicitacoes", "request.approved", "/solicitacoes"],
    ["/membro/folgas", "leave.approved", "/folgas"],
    ["/(tabs)/mais", "delegation.created", "/responsabilidades"],
  ];
  for (const [from, type, to] of legacy) assert(normalizeActionUrl(from, type) === to, `aviso ${type} com link antigo ${from} vai para ${to}`);
  assert(normalizeActionUrl("/agenda?date=2026-10-01", "agenda.invite") === "/agenda?date=2026-10-01", "link atual é mantido, com a query");
  assert(normalizeActionUrl(undefined, "scale.republished") === "/escalas", "aviso sem link ganha a tela do tipo");
  assert(normalizeActionUrl("/qualquer/coisa", "desconhecido") === "/meu-dia", "link desconhecido de tipo desconhecido cai no Meu Dia");

  const tag = `faseb_${Date.now()}`;
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [operation] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const [local] = await db.insert(locationsTable).values({ organizationId: org!.id, name: `${tag}_Snowland` }).returning();
  await db.insert(operationLocationsTable).values({ operationId: operation!.id, locationId: local!.id });
  const [area] = await db.insert(areasTable).values({ organizationId: org!.id, name: `${tag}_Patinadores` }).returning();
  const mk = async (suffix: string, role: "ADMIN" | "SUPERVISOR_A" | "MEMBER") => {
    const [u] = await db.insert(usersTable).values({ organizationId: org!.id, name: `${tag}_${suffix}`, username: `${tag}_${suffix}`, areaId: area!.id, defaultLocationId: local!.id }).returning();
    await db.insert(userRolesTable).values({ userId: u!.id, operationId: operation!.id, role, active: true });
    return u!;
  };
  const admin = await mk("barbara", "ADMIN");
  const sup = await mk("deborah", "SUPERVISOR_A");
  const julia = await mk("julia", "MEMBER");
  const everyone = [admin, sup, julia].map((u) => u.id);
  await db.insert(areaLocalSupervisorsTable).values({ areaId: area!.id, locationId: local!.id, supervisorId: sup.id });

  let server: http.Server | null = null;
  try {
    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("servidor de teste não iniciou");
    const base = `http://127.0.0.1:${address.port}/api`;
    const as = (userId: string, role: string) => {
      const token = signAccessToken({ sub: userId, jti: `${tag}_${userId}_${Math.random()}`, organizationId: org!.id, role, operationIds: [operation!.id] });
      return (path: string, init: RequestInit = {}) => fetch(`${base}${path}`, { signal: AbortSignal.timeout(60_000), ...init, headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(init.headers ?? {}) } });
    };
    const asAdmin = as(admin.id, "ADMIN"), asSup = as(sup.id, "SUPERVISOR_A"), asJulia = as(julia.id, "MEMBER");
    const today = new Date().toISOString().slice(0, 10);

    // ---------- B1 · check-in abre com o local real ----------
    const locais = (await (await asSup("/escalas/locais")).json()) as { locais: { id: string }[] };
    assert(locais.locais.length === 1 && locais.locais[0]!.id === local!.id, "a Supervisão recebe o local real (código do banco) para escolher no check-in");
    const real = await asSup(`/day-checkins?locationId=${locais.locais[0]!.id}&date=${today}`);
    assert(real.status === 200, "check-in do local real abre para a Supervisão (200)");
    const sample = await asSup(`/day-checkins?locationId=snowland&date=${today}`);
    assert(sample.status === 403, "o código de amostra 'snowland' é recusado com 403, sem erro interno");
    assert((await asAdmin(`/day-checkins?locationId=${local!.id}&date=${today}`)).status === 200, "check-in do local real abre para a Administração (200)");

    // Escala do dia publicada com um bloco em que todos entram: a Supervisão registra presença pela tela.
    const [prog] = await db.insert(programacoesTable).values({ organizationId: org!.id, locationId: local!.id, nome: `${tag}_molde`, vigenciaInicio: today, vigenciaFim: today, createdBy: admin.id }).returning();
    await db.insert(programacaoBlocosTable).values({ programacaoId: prog!.id, weekday: new Date(`${today}T12:00:00Z`).getUTCDay(), inicio: "09:40", fim: "11:00", rotulo: "TREINO GELO", regra: "todos" });
    const [escala] = await db.insert(scalesTable).values({ operationId: operation!.id, locationId: local!.id, title: `${tag}_escala`, periodStart: today, periodEnd: today, status: "PUBLISHED", publishedAt: new Date(), createdBy: admin.id }).returning();
    const day = (await (await asSup(`/day-checkins?locationId=${local!.id}&date=${today}`)).json()) as { blocks: { key: string; scaleId?: string; pessoaIds: string[] }[] };
    const treino = day.blocks.find((b) => b.pessoaIds.includes(julia.id));
    assert(Boolean(treino) && treino!.scaleId === escala!.id, "cada bloco do check-in da Supervisão traz o código da Escala do dia");
    // Mesmo corpo que a tela manda (etaMinutes e reason nulos na chegada).
    const mark = await asSup("/day-checkins", { method: "POST", body: JSON.stringify({ scaleId: treino?.scaleId, sourceKey: treino?.key, userId: julia.id, status: "CHECKED_IN", reason: null, etaMinutes: null, date: today }) });
    assert(mark.status === 200, "a Supervisão registra a chegada da Julia pela tela (200)");

    // ---------- B2 · minhas tarefas (com responsabilidade ligada) ----------
    const [resp] = await db.insert(responsibilitiesTable).values({ orgId: org!.id, title: `${tag}_Figurinos` } as never).returning();
    await db.insert(tasksTable).values({ organizationId: org!.id, operationId: operation!.id, responsibilityId: resp!.id, title: `${tag}_passar figurino`, creatorId: admin.id, assigneeId: julia.id, dueDate: today });
    const mine = await asJulia("/tasks/my");
    const mineBody = (await mine.json()) as { tasks?: { title: string; responsibilityTitle: string | null }[] };
    assert(mine.status === 200, "/tasks/my responde 200 (antes: 500 pelo join duplicado)");
    assert(mineBody.tasks?.length === 1 && mineBody.tasks[0]!.responsibilityTitle === `${tag}_Figurinos`, "a tarefa vem com o nome da responsabilidade");
    assert((await asAdmin("/tasks/my")).status === 200 && (await asSup("/tasks/my")).status === 200, "/tasks/my responde 200 para Administração e Supervisão");

    // ---------- B4 · o link gravado no aviso é o da tela nova ----------
    const created = await createNotification({ userId: julia.id, type: "book.published", title: "Livro do Dia publicado", message: "teste", category: "book", actionUrl: "/(tabs)/daily-book" });
    assert(created.actionUrl === "/livro-do-dia", "aviso criado com link antigo é gravado com /livro-do-dia");
    const bell = (await (await asJulia("/notifications")).json()) as { notifications: { actionUrl: string | null }[] };
    assert(bell.notifications.some((n) => n.actionUrl === "/livro-do-dia") && !bell.notifications.some((n) => n.actionUrl?.startsWith("/(tabs)")), "a lista de avisos da Julia não tem link antigo");

    // ---------- B3 · sair derruba a sessão no servidor ----------
    const { token: refreshToken, expiresAt } = signRefreshToken(julia.id);
    await db.insert(refreshTokensTable).values({ userId: julia.id, tokenHash: hashToken(refreshToken), expiresAt });
    const refreshed = await fetch(`${base}/auth/refresh`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ refreshToken }) });
    const rotated = ((await refreshed.json()) as { refreshToken?: string }).refreshToken;
    assert(refreshed.status === 200 && Boolean(rotated), "a sessão da Julia renova enquanto está aberta");
    const logout = await asJulia("/auth/logout", { method: "POST", body: JSON.stringify({ refreshToken: rotated }) });
    assert(logout.status === 200 || logout.status === 204, "Sair responde com sucesso");
    const after = await fetch(`${base}/auth/refresh`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ refreshToken: rotated }) });
    assert(after.status === 401, "depois de Sair, a sessão não renova mais (401)");
  } finally {
    if (server) { server.closeAllConnections?.(); await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve())); }
    await db.delete(historyEventsTable).where(or(eq(historyEventsTable.orgId, org!.id), inArray(historyEventsTable.actorId, everyone)));
    await db.delete(notificationOutboxTable).where(inArray(notificationOutboxTable.userId, everyone));
    await db.delete(userNotificationsTable).where(inArray(userNotificationsTable.userId, everyone));
    await pool.query(`delete from security_audit_log where actor_id = any($1::uuid[])`, [everyone]).catch(() => undefined);
    await db.delete(refreshTokensTable).where(inArray(refreshTokensTable.userId, everyone));
    const scales = await db.select({ id: scalesTable.id }).from(scalesTable).where(eq(scalesTable.operationId, operation!.id));
    if (scales.length) await db.delete(dayCheckInsTable).where(inArray(dayCheckInsTable.scaleId, scales.map((s) => s.id)));
    await db.delete(scalesTable).where(eq(scalesTable.operationId, operation!.id));
    const progs = await db.select({ id: programacoesTable.id }).from(programacoesTable).where(eq(programacoesTable.locationId, local!.id));
    if (progs.length) await db.delete(programacaoBlocosTable).where(inArray(programacaoBlocosTable.programacaoId, progs.map((p) => p.id)));
    await db.delete(programacoesTable).where(eq(programacoesTable.locationId, local!.id));
    await db.delete(tasksTable).where(eq(tasksTable.organizationId, org!.id));
    await db.delete(responsibilitiesTable).where(eq(responsibilitiesTable.orgId, org!.id));
    await db.delete(areaLocalSupervisorsTable).where(eq(areaLocalSupervisorsTable.locationId, local!.id));
    await db.delete(userRolesTable).where(eq(userRolesTable.operationId, operation!.id));
    await db.delete(usersTable).where(inArray(usersTable.id, everyone));
    await db.delete(areasTable).where(eq(areasTable.id, area!.id));
    await db.delete(operationLocationsTable).where(and(eq(operationLocationsTable.locationId, local!.id), eq(operationLocationsTable.operationId, operation!.id)));
    await db.delete(locationsTable).where(eq(locationsTable.id, local!.id));
    await db.delete(operationsTable).where(eq(operationsTable.id, operation!.id));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, org!.id));
  }
  if (failures.length > 0) throw new Error(`${failures.length} falha(s) na Fase B`);
  process.stdout.write(`fase-b-regressoes: ${passed} asserts passed\n`);
}

process.stdout.write("fase-b-regressoes: starting\n");
try {
  await run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
