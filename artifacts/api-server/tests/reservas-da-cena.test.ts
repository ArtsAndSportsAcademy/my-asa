/**
 * Reservas da cena (0078, 23/10/2026): a cena tem UMA lista de reservas que cobre qualquer posição dela quando o titular não pode.
 * - titular presente continua sendo titular; reserva nunca toma o lugar de quem é titular de outra posição da mesma cena;
 * - a mesma reserva não entra em duas posições; acabando as reservas, a posição fica descoberta;
 * - substituto cadastrado na própria bolinha vem antes das reservas; cena sem reservas se comporta como antes;
 * - a rota da cena grava a lista com Registro, recusa lista inválida em português e devolve os nomes no diretório do show.
 * PostgreSQL real de teste.
 */
import http from "node:http";
import { eq, inArray, or } from "drizzle-orm";
import {
  db, folgasTable, historyEventsTable, notificationOutboxTable, operationsTable, organizationsTable, pool, securityAuditLogTable,
  showBookBlocksTable, showBookLinesTable, showBookRolesTable, showBookScenesTable, showBooksTable, showBookVersionsTable, userRolesTable, usersTable,
} from "@workspace/db";
import app from "../src/application.js";
import { signAccessToken } from "../src/lib/jwt.service.js";
import { resolveShowBookCast } from "../src/services/line-resolver.js";

let passed = 0;
const failures: string[] = [];
function assert(condition: boolean, message: string) {
  if (condition) passed += 1;
  else { failures.push(message); console.error(`  ✗ ${message}`); }
}

async function run() {
  const tag = `res_${Date.now()}`;
  const dia = "2026-12-07";
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [op] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const nomes = new Map<string, string>();
  const pessoa = async (nome: string, role: "ADMIN" | "MEMBER") => {
    const [u] = await db.insert(usersTable).values({ organizationId: org!.id, name: `${tag}_${nome}`, username: `${tag}_${nome}` }).returning();
    await db.insert(userRolesTable).values({ userId: u!.id, operationId: op!.id, role, active: true });
    nomes.set(u!.id, nome);
    return u!;
  };
  const adm = await pessoa("adm", "ADMIN");
  const [t1, t2, t3, r1, r2, s1, fora] = await Promise.all(["t1", "t2", "t3", "r1", "r2", "s1", "fora"].map((n) => pessoa(n, "MEMBER")));
  const todos = [adm.id, t1!.id, t2!.id, t3!.id, r1!.id, r2!.id, s1!.id, fora!.id];

  const [livro] = await db.insert(showBooksTable).values({ operationId: op!.id, title: `${tag}_show`, createdBy: adm.id }).returning();
  const [cenaA] = await db.insert(showBookScenesTable).values({ showBookId: livro!.id, name: "Formação de 8", order: 0 }).returning();
  const [cenaB] = await db.insert(showBookScenesTable).values({ showBookId: livro!.id, name: "Sem reservas", order: 1 }).returning();
  const [blocoA] = await db.insert(showBookBlocksTable).values({ showBookId: livro!.id, sceneId: cenaA!.id, name: "Bloco A", order: 0 }).returning();
  const [blocoB] = await db.insert(showBookBlocksTable).values({ showBookId: livro!.id, sceneId: cenaB!.id, name: "Bloco B", order: 0 }).returning();
  const vaga = async (blockId: string, nome: string, ordem: number, titularId: string, substituteIds: string[] = []) => {
    const [pos] = await db.insert(showBookRolesTable).values({ showBookId: livro!.id, blockId, name: nome, order: ordem }).returning();
    await db.insert(showBookLinesTable).values({ positionId: pos!.id, type: "TITULAR_SUBSTITUTE", config: { titularId, substituteIds }, order: 0 });
    return pos!.id;
  };
  const p1 = await vaga(blocoA!.id, "GU 01", 0, t1!.id), p2 = await vaga(blocoA!.id, "GU 02", 1, t2!.id), p3 = await vaga(blocoA!.id, "GU 03", 2, t3!.id);
  const pB = await vaga(blocoB!.id, "GU 01", 0, t1!.id);
  const folgaIds: string[] = [];
  const folga = async (id: string) => {
    const [f] = await db.insert(folgasTable).values({ userId: id, operationId: op!.id, type: "DAY_OFF", startDate: dia, endDate: dia, status: "ACTIVE", createdBy: id }).returning();
    folgaIds.push(f!.id);
  };
  const limparFolgas = async () => { if (folgaIds.length) await db.delete(folgasTable).where(inArray(folgasTable.id, folgaIds.splice(0))); };
  const quem = async (cenaId: string) => {
    const r = await resolveShowBookCast(livro!.id, op!.id, dia, { dedupPerScene: true });
    const cena = r.scenes.find((s) => s.sceneId === cenaId)!;
    const mapa = new Map<string, string>();
    for (const b of cena.blocks) for (const p of b.positions) mapa.set(p.name, p.lines[0]?.people[0]?.userId ?? "");
    const descobertas = cena.blocks.flatMap((b) => b.positions).filter((p) => p.lines.some((l) => l.status === "UNCOVERED")).length;
    return { r, mapa, descobertas };
  };
  const nome = (id: string | undefined) => (id ? nomes.get(id) ?? "?" : "");

  let server: http.Server | null = null;
  try {
    // ── sem reservas: como era ──
    await folga(t1!.id);
    let { mapa, descobertas } = await quem(cenaA!.id);
    assert(nome(mapa.get("GU 01")) === "" && descobertas === 1, "sem reservas, titular de folga deixa a posição descoberta (como era)");
    await limparFolgas();

    // ── com reservas ──
    await db.update(showBookScenesTable).set({ reserveIds: [r1!.id, r2!.id] }).where(eq(showBookScenesTable.id, cenaA!.id));
    ({ mapa, descobertas } = await quem(cenaA!.id));
    assert(nome(mapa.get("GU 01")) === "t1" && nome(mapa.get("GU 02")) === "t2" && nome(mapa.get("GU 03")) === "t3" && descobertas === 0, "todos os titulares presentes: ninguém precisa de reserva");

    await folga(t1!.id);
    ({ mapa, descobertas } = await quem(cenaA!.id));
    assert(nome(mapa.get("GU 01")) === "r1" && nome(mapa.get("GU 02")) === "t2" && descobertas === 0, "titular de folga: a primeira reserva entra no lugar");

    await folga(t2!.id);
    ({ mapa } = await quem(cenaA!.id));
    assert(nome(mapa.get("GU 01")) === "r1" && nome(mapa.get("GU 02")) === "r2", "duas posições sem titular usam duas reservas diferentes");

    await folga(t3!.id);
    const final = await quem(cenaA!.id); mapa = final.mapa; const r = final.r;
    assert(nome(mapa.get("GU 03")) === "" && r.scenes.find((s) => s.sceneId === cenaA!.id)!.blocks[0]!.positions[2]!.lines[0]!.status === "UNCOVERED", "acabaram as reservas: a terceira posição fica descoberta, dizendo a verdade");
    await limparFolgas();

    // reserva que é titular de outra posição da mesma cena não é tomada
    await db.update(showBookScenesTable).set({ reserveIds: [t3!.id, r2!.id] }).where(eq(showBookScenesTable.id, cenaA!.id));
    await folga(t1!.id);
    ({ mapa } = await quem(cenaA!.id));
    assert(nome(mapa.get("GU 01")) === "r2" && nome(mapa.get("GU 03")) === "t3", "reserva que é titular presente de outra posição não toma o lugar dele");
    await limparFolgas();

    // reserva de folga é pulada
    await db.update(showBookScenesTable).set({ reserveIds: [r1!.id, r2!.id] }).where(eq(showBookScenesTable.id, cenaA!.id));
    await folga(t1!.id); await folga(r1!.id);
    ({ mapa } = await quem(cenaA!.id));
    assert(nome(mapa.get("GU 01")) === "r2", "reserva de folga é pulada e entra a próxima");
    await limparFolgas();

    // substituto da própria bolinha vem antes das reservas
    const linhaP1 = (await db.select().from(showBookLinesTable).where(eq(showBookLinesTable.positionId, p1)))[0]!;
    await db.update(showBookLinesTable).set({ config: { titularId: t1!.id, substituteIds: [s1!.id] } }).where(eq(showBookLinesTable.id, linhaP1.id));
    await folga(t1!.id);
    ({ mapa } = await quem(cenaA!.id));
    assert(nome(mapa.get("GU 01")) === "s1", "o substituto cadastrado na própria bolinha continua vindo antes das reservas");
    await limparFolgas();
    await db.update(showBookLinesTable).set({ config: { titularId: t1!.id, substituteIds: [] } }).where(eq(showBookLinesTable.id, linhaP1.id));

    // outra cena do mesmo show, sem reservas, não é afetada
    await folga(t1!.id);
    ({ mapa } = await quem(cenaB!.id));
    assert(nome(mapa.get("GU 01")) === "", "a cena sem reservas não herda as de outra cena");
    await limparFolgas();

    // ── rota da cena ──
    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("servidor de teste não iniciou");
    const base = `http://127.0.0.1:${address.port}/api`;
    const token = signAccessToken({ sub: adm.id, jti: `${tag}_j`, organizationId: org!.id, role: "ADMIN", operationIds: [op!.id] });
    const call = async (method: string, path: string, body?: unknown) => {
      const resp = await fetch(`${base}${path}`, { method, signal: AbortSignal.timeout(60_000), headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: body === undefined ? undefined : JSON.stringify(body) });
      const text = await resp.text();
      return { status: resp.status, text, body: (() => { try { return JSON.parse(text) as Record<string, any>; } catch { return {}; } })() };
    };
    const ruim = await call("PATCH", `/show-books/${livro!.id}/scenes/${cenaB!.id}`, { reserveIds: "r1" });
    assert(ruim.status === 400 && /lista de pessoas/.test(ruim.text), "lista que não é lista é 400 com frase");
    const inexistente = await call("PATCH", `/show-books/${livro!.id}/scenes/${cenaB!.id}`, { reserveIds: ["00000000-0000-4000-8000-000000000000"] });
    assert(inexistente.status === 400 && /não existe ou não está ativa/.test(inexistente.text), "pessoa que não existe é 400 com frase");
    const boa = await call("PATCH", `/show-books/${livro!.id}/scenes/${cenaB!.id}`, { reserveIds: [r2!.id, r1!.id, r2!.id], reason: "Reservas da formação de 6" });
    assert(boa.status === 200 && JSON.stringify(boa.body.scene?.reserveIds) === JSON.stringify([r2!.id, r1!.id]), "grava a lista sem repetir e na ordem escolhida");
    const detalhe = await call("GET", `/show-books/${livro!.id}`);
    const cenaNoDetalhe = (detalhe.body.showBook?.scenes as any[] | undefined)?.find((s) => s.id === cenaB!.id);
    const diretorio = (detalhe.body.showBook?.memberDirectory as { id: string; name: string }[] | undefined) ?? [];
    assert(JSON.stringify(cenaNoDetalhe?.reserveIds) === JSON.stringify([r2!.id, r1!.id]) && diretorio.some((d) => d.id === r1!.id) && diretorio.some((d) => d.id === r2!.id), "o detalhe do show traz a lista e os nomes das reservas");
    const eventos = (await db.select().from(historyEventsTable).where(eq(historyEventsTable.entityId, cenaB!.id))).filter((e) => e.action === "show_book.scene.reserves_updated");
    assert(eventos.length === 1 && /2 pessoas/.test(eventos[0]?.narrative ?? ""), "a mudança entrou no Registro uma vez, dizendo quantas pessoas");
    const igual = await call("PATCH", `/show-books/${livro!.id}/scenes/${cenaB!.id}`, { reserveIds: [r2!.id, r1!.id] });
    assert(igual.status === 200 && (await db.select().from(historyEventsTable).where(eq(historyEventsTable.entityId, cenaB!.id))).filter((e) => e.action === "show_book.scene.reserves_updated").length === 1, "salvar a mesma lista de novo não grava outro evento de reservas");
    const limpa = await call("PATCH", `/show-books/${livro!.id}/scenes/${cenaB!.id}`, { reserveIds: [] });
    assert(limpa.status === 200 && JSON.stringify(limpa.body.scene?.reserveIds) === "[]", "dá para esvaziar a lista");
  } finally {
    await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
    await limparFolgas();
    await db.delete(historyEventsTable).where(or(eq(historyEventsTable.orgId, org!.id), inArray(historyEventsTable.actorId, todos)));
    await db.delete(securityAuditLogTable).where(inArray(securityAuditLogTable.actorId, todos));
    await db.delete(notificationOutboxTable).where(inArray(notificationOutboxTable.userId, todos));
    await db.delete(showBookLinesTable).where(inArray(showBookLinesTable.positionId, [p1, p2, p3, pB]));
    await db.delete(showBookRolesTable).where(eq(showBookRolesTable.showBookId, livro!.id));
    await db.delete(showBookBlocksTable).where(eq(showBookBlocksTable.showBookId, livro!.id));
    await db.delete(showBookScenesTable).where(eq(showBookScenesTable.showBookId, livro!.id));
    await db.delete(showBookVersionsTable).where(eq(showBookVersionsTable.showBookId, livro!.id));
    await db.delete(showBooksTable).where(eq(showBooksTable.id, livro!.id));
    await db.delete(userRolesTable).where(eq(userRolesTable.operationId, op!.id));
    await db.delete(usersTable).where(inArray(usersTable.id, todos));
    await db.delete(operationsTable).where(eq(operationsTable.id, op!.id));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, org!.id));
  }
  if (failures.length > 0) throw new Error(`${failures.length} falha(s) em reservas-da-cena`);
  process.stdout.write(`reservas-da-cena: ${passed} asserts passed\n`);
}

process.stdout.write("reservas-da-cena: starting\n");
try {
  await run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
