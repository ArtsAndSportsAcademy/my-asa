/**
 * Supervisão que também atua nos shows (23/10/2026): a Administração liga "Participa dos shows" no cadastro da pessoa
 * e ela passa a aparecer nos seletores de personagem e formação (isCharacterEligible) e na Escala do dia.
 * Direção e Administração nunca entram, mesmo com a opção ligada. PostgreSQL real de teste.
 */
import http from "node:http";
import { eq, inArray, or } from "drizzle-orm";
import {
  areasTable, db, historyEventsTable, locationsTable, notificationOutboxTable, operationLocationsTable, operationsTable, organizationsTable,
  pool, securityAuditLogTable, userRolesTable, usersTable,
} from "@workspace/db";
import app from "../src/application.js";
import { signAccessToken } from "../src/lib/jwt.service.js";
import { montarEscalaDoDia } from "../src/services/escala-dia.js";

let passed = 0;
const failures: string[] = [];
function assert(condition: boolean, message: string) {
  if (condition) passed += 1;
  else { failures.push(message); console.error(`  ✗ ${message}`); }
}

async function run() {
  const tag = `psh_${Date.now()}`;
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [op] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const [area] = await db.insert(areasTable).values({ organizationId: org!.id, name: `${tag}_Patinadores` }).returning();
  const [local] = await db.insert(locationsTable).values({ organizationId: org!.id, name: `${tag}_Local` }).returning();
  await db.insert(operationLocationsTable).values({ operationId: op!.id, locationId: local!.id });
  const novo = async (nome: string, role: "ADMIN" | "DIR" | "SUPERVISOR_A" | "MEMBER", comArea = true) => {
    const [u] = await db.insert(usersTable).values({ organizationId: org!.id, name: nome, fullName: `${nome} ${tag}`, username: `${tag}_${nome.toLowerCase()}`, areaId: comArea ? area!.id : null }).returning();
    await db.insert(userRolesTable).values({ userId: u!.id, operationId: op!.id, role, active: true });
    return u!;
  };
  const adm = await novo("Adm", "ADMIN", false), sup = await novo("Sup", "SUPERVISOR_A"), outraSup = await novo("Outrasup", "SUPERVISOR_A");
  const dir = await novo("Dir", "DIR", false), elenco = await novo("Elenco", "MEMBER");
  const todos = [adm.id, sup.id, outraSup.id, dir.id, elenco.id];

  let server: http.Server | null = null;
  try {
    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("servidor de teste não iniciou");
    const base = `http://127.0.0.1:${address.port}/api`;
    const tk = (u: { id: string }, role: string) => signAccessToken({ sub: u.id, jti: `${tag}_${Math.random()}`, organizationId: org!.id, role, operationIds: [op!.id] });
    const call = async (method: string, path: string, token: string, body?: unknown) => {
      const r = await fetch(`${base}${path}`, { method, signal: AbortSignal.timeout(60_000), headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: body === undefined ? undefined : JSON.stringify(body) });
      const text = await r.text();
      return { status: r.status, text, body: (() => { try { return JSON.parse(text) as Record<string, any>; } catch { return {}; } })() };
    };
    const asAdm = tk(adm, "ADMIN"), asSup = tk(sup, "SUPERVISOR_A");
    const eleg = async (id: string) => ((await call("GET", "/users", asAdm)).body.users as { id: string; isCharacterEligible: boolean }[]).find((u) => u.id === id)?.isCharacterEligible;

    assert(await eleg(elenco.id) === true, "Elenco já entra nos seletores");
    assert(await eleg(sup.id) === false, "Supervisão sem a opção não entra nos seletores (como era)");

    assert((await call("PUT", `/users/${sup.id}/cadastro`, asSup, { participaDosShows: true })).status === 403, "Supervisão não liga a opção em si mesma");
    const naoBool = await call("PUT", `/users/${sup.id}/cadastro`, asAdm, { participaDosShows: "sim" });
    assert(naoBool.status === 400 && /ligado ou desligado/.test(naoBool.text), "valor que não é ligado/desligado é 400 com frase");

    const liga = await call("PUT", `/users/${sup.id}/cadastro`, asAdm, { participaDosShows: true });
    assert(liga.status === 200 && liga.body.mudou === true && liga.body.antes?.participaDosShows === false && liga.body.user?.participatesInShows === true, "Administração liga a opção e a resposta traz o valor de antes");
    assert(await eleg(sup.id) === true, "com a opção ligada, a Supervisão entra nos seletores");
    assert(await eleg(outraSup.id) === false, "outra Supervisão, sem a opção, continua de fora");
    const repete = await call("PUT", `/users/${sup.id}/cadastro`, asAdm, { participaDosShows: true });
    assert(repete.status === 200 && repete.body.mudou === false, "ligar de novo não muda nem grava Registro");

    const eventos = await db.select().from(historyEventsTable).where(eq(historyEventsTable.entityId, sup.id));
    const mudancas = eventos.filter((e) => e.action === "user.cadastro_changed");
    assert(mudancas.length === 1 && /participar dos shows/.test(mudancas[0]?.narrative ?? "") && (mudancas[0]?.afterState as any)?.participaDosShows === true, "entrou no Registro uma vez, dizendo o que mudou");

    const escala = await montarEscalaDoDia(org!.id, local!.id, "2026-12-01");
    assert(Boolean(escala?.pessoas.some((p) => p.id === sup.id)), "a Supervisão com a opção aparece na Escala do dia");

    const desfaz = await call("PUT", `/users/${sup.id}/cadastro`, asAdm, { participaDosShows: liga.body.antes.participaDosShows });
    assert(desfaz.status === 200 && await eleg(sup.id) === false, "desfazer devolve a opção desligada");

    // Direção e Administração nunca entram, mesmo com a coluna ligada à força.
    await db.update(usersTable).set({ participatesInShows: true }).where(inArray(usersTable.id, [dir.id, adm.id]));
    assert(await eleg(dir.id) === false && await eleg(adm.id) === false, "Direção e Administração não entram, mesmo com a opção ligada");
  } finally {
    await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
    await db.delete(historyEventsTable).where(or(eq(historyEventsTable.orgId, org!.id), inArray(historyEventsTable.actorId, todos)));
    await db.delete(securityAuditLogTable).where(inArray(securityAuditLogTable.actorId, todos));
    await db.delete(notificationOutboxTable).where(inArray(notificationOutboxTable.userId, todos));
    await db.delete(userRolesTable).where(inArray(userRolesTable.userId, todos));
    await db.delete(usersTable).where(inArray(usersTable.id, todos));
    await db.delete(operationLocationsTable).where(eq(operationLocationsTable.operationId, op!.id));
    await db.delete(locationsTable).where(eq(locationsTable.id, local!.id));
    await db.delete(areasTable).where(eq(areasTable.id, area!.id));
    await db.delete(operationsTable).where(eq(operationsTable.id, op!.id));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, org!.id));
  }
  if (failures.length > 0) throw new Error(`${failures.length} falha(s) em supervisao-participa-dos-shows`);
  process.stdout.write(`supervisao-participa-dos-shows: ${passed} asserts passed\n`);
}

process.stdout.write("supervisao-participa-dos-shows: starting\n");
try {
  await run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
