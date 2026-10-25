/**
 * Posições do momento (25/10/2026): mudar a posição de alguns círculos pela rota PATCH /show-books/:id/keyframes/:keyframeId
 * não pode apagar a posição dos outros. Antes, a tela mandava só os círculos arrastados naquela visita e a rota SUBSTITUÍA o mapa
 * inteiro: a formação do primeiro momento da Montanha voltou ao padrão depois de um único arraste.
 * - mandar só um círculo mantém os demais; mandar de novo o mesmo círculo muda só ele;
 * - posição fora de 4% a 96% continua sendo recusada (400) e nada muda. PostgreSQL real de teste.
 */
import http from "node:http";
import { eq, inArray, or } from "drizzle-orm";
import {
  db, historyEventsTable, locationsTable, notificationOutboxTable, operationsTable, organizationsTable, pool, securityAuditLogTable,
  showBookKeyframesTable, showBookScenesTable, showBooksTable, showBookVersionsTable, userRolesTable, usersTable,
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
  const tag = `kfp_${Date.now()}`;
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [op] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const [local] = await db.insert(locationsTable).values({ organizationId: org!.id, name: `${tag}_local` }).returning();
  const mk = async (nome: string, role: "ADMIN" | "MEMBER") => {
    const [u] = await db.insert(usersTable).values({ organizationId: org!.id, name: `${tag}_${nome}`, username: `${tag}_${nome}` }).returning();
    await db.insert(userRolesTable).values({ userId: u!.id, operationId: op!.id, role, active: true });
    return u!;
  };
  const adm = await mk("adm", "ADMIN"), elenco = await mk("elenco", "MEMBER");
  const todos = [adm.id, elenco.id];
  const [livro] = await db.insert(showBooksTable).values({ operationId: op!.id, locationId: local!.id, title: `${tag}_Show`, createdBy: adm.id, type: "COMPLETE" }).returning();

  const [cena] = await db.insert(showBookScenesTable).values({ showBookId: livro!.id, name: "Sequência", order: 0 }).returning();
  const inicial = { "GU 01": { x: 30, y: 40 }, "GU 02": { x: 50, y: 40 }, "GU 03": { x: 70, y: 40 } };
  const [momento] = await db.insert(showBookKeyframesTable).values({ sceneId: cena!.id, name: "Inicial", order: 0, markerPositions: inicial }).returning();

  let server: http.Server | null = null;
  try {
    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("servidor de teste não iniciou");
    const base = `http://127.0.0.1:${address.port}/api`;
    const token = signAccessToken({ sub: adm.id, jti: `${tag}_${adm.id}`, organizationId: org!.id, role: "ADMIN", operationIds: [op!.id] });
    const headers = { authorization: `Bearer ${token}`, "content-type": "application/json" };
    const patch = async (body: Record<string, unknown>) => {
      const r = await fetch(`${base}/show-books/${livro!.id}/keyframes/${momento!.id}`, { method: "PATCH", signal: AbortSignal.timeout(60_000), headers, body: JSON.stringify({ reason: "teste", ...body }) });
      return { status: r.status, text: await r.text() };
    };
    const posicoes = async () => (await db.select().from(showBookKeyframesTable).where(eq(showBookKeyframesTable.id, momento!.id)))[0]!.markerPositions as Record<string, { x: number; y: number }>;

    const um = await patch({ markerPositions: { "GU 02": { x: 55, y: 60 } } });
    const depois = await posicoes();
    assert(um.status === 200, "mandar a posição de um círculo só é aceito");
    assert(depois["GU 02"]?.x === 55 && depois["GU 02"]?.y === 60, "o círculo mandado muda de lugar");
    assert(depois["GU 01"]?.x === 30 && depois["GU 03"]?.x === 70, "os outros círculos mantêm a posição que já tinham");
    assert(Object.keys(depois).length === 3, "nenhum círculo some do mapa");

    const novo = await patch({ markerPositions: { "GU 04": { x: 20, y: 20 } } });
    assert(novo.status === 200 && Object.keys(await posicoes()).length === 4, "um círculo novo entra sem apagar os antigos");

    const fora = await patch({ markerPositions: { "GU 01": { x: 2, y: 50 } } });
    assert(fora.status === 400 && (await posicoes())["GU 01"]?.x === 30, "posição fora de 4% a 96% é recusada e nada muda");

    const nome = await patch({ name: "Entrada" });
    assert(nome.status === 200 && Object.keys(await posicoes()).length === 4, "mudar só o nome não mexe nas posições");
  } finally {
    if (server) { server.closeAllConnections?.(); await new Promise<void>((resolve) => server!.close(() => resolve())); }
    await db.delete(historyEventsTable).where(or(eq(historyEventsTable.orgId, org!.id), inArray(historyEventsTable.actorId, todos)));
    await db.delete(securityAuditLogTable).where(inArray(securityAuditLogTable.actorId, todos));
    await db.delete(notificationOutboxTable).where(inArray(notificationOutboxTable.userId, todos));
    await db.delete(showBookKeyframesTable).where(eq(showBookKeyframesTable.sceneId, cena!.id));
    await db.delete(showBookScenesTable).where(eq(showBookScenesTable.id, cena!.id));
    await db.delete(showBookVersionsTable).where(eq(showBookVersionsTable.showBookId, livro!.id));
    await db.delete(showBooksTable).where(eq(showBooksTable.id, livro!.id));
    await db.delete(userRolesTable).where(eq(userRolesTable.operationId, op!.id));
    await db.delete(usersTable).where(inArray(usersTable.id, todos));
    await db.delete(locationsTable).where(eq(locationsTable.id, local!.id));
    await db.delete(operationsTable).where(eq(operationsTable.id, op!.id));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, org!.id));
  }
  if (failures.length > 0) throw new Error(`${failures.length} falha(s) em momento-posicoes`);
  process.stdout.write(`momento-posicoes: ${passed} asserts passed\n`);
}

process.stdout.write("momento-posicoes: starting\n");
try {
  await run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
