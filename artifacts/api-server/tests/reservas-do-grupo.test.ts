/**
 * Reservas do grupo (0079, 23/10/2026): cada GRUPO da cena tem a sua lista de reservas, que cobre qualquer posição DAQUELE grupo
 * quando o titular não pode. Patinadores e bailarinos da mesma cena têm listas separadas: um bailarino não substitui um patinador.
 * - titular presente continua sendo titular; reserva nunca toma o lugar de quem é titular de outra posição da cena;
 * - a mesma reserva não entra em duas posições; acabando as reservas, a posição fica descoberta;
 * - substituto cadastrado na própria bolinha vem antes das reservas; grupo sem reservas se comporta como antes;
 * - a rota do grupo grava a lista com Registro, recusa lista inválida em português e o detalhe do show devolve lista e nomes.
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
  const tag = `rgr_${Date.now()}`;
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
  // patinadores: t1, t2, t3 titulares; r1, r2 reservas.  bailarinos: d1 titular; b1 reserva.
  const [t1, t2, t3, r1, r2, d1, b1, s1] = await Promise.all(["t1", "t2", "t3", "r1", "r2", "d1", "b1", "s1"].map((n) => pessoa(n, "MEMBER")));
  const todos = [adm.id, t1!.id, t2!.id, t3!.id, r1!.id, r2!.id, d1!.id, b1!.id, s1!.id];

  const [livro] = await db.insert(showBooksTable).values({ operationId: op!.id, title: `${tag}_show`, createdBy: adm.id }).returning();
  const [cena] = await db.insert(showBookScenesTable).values({ showBookId: livro!.id, name: "Formação de 8", order: 0 }).returning();
  const [cenaB] = await db.insert(showBookScenesTable).values({ showBookId: livro!.id, name: "Outra cena", order: 1 }).returning();
  const bloco = async (sceneId: string, nome: string, ordem: number) => (await db.insert(showBookBlocksTable).values({ showBookId: livro!.id, sceneId, name: nome, order: ordem }).returning())[0]!;
  const gPat = await bloco(cena!.id, "Patinadores", 0), gBai = await bloco(cena!.id, "Bailarinos", 1), gSolto = await bloco(cenaB!.id, "Sem reservas", 0);
  const posicoes: string[] = [];
  const vaga = async (blockId: string, nome: string, ordem: number, titularId: string, substituteIds: string[] = []) => {
    const [pos] = await db.insert(showBookRolesTable).values({ showBookId: livro!.id, blockId, name: nome, order: ordem }).returning();
    await db.insert(showBookLinesTable).values({ positionId: pos!.id, type: "TITULAR_SUBSTITUTE", config: { titularId, substituteIds }, order: 0 });
    posicoes.push(pos!.id);
    return pos!.id;
  };
  const p1 = await vaga(gPat.id, "PA 01", 0, t1!.id);
  await vaga(gPat.id, "PA 02", 1, t2!.id);
  await vaga(gPat.id, "PA 03", 2, t3!.id);
  await vaga(gBai.id, "BA 01", 0, d1!.id);
  await vaga(gSolto.id, "SO 01", 0, t1!.id);
  const folgaIds: string[] = [];
  const folga = async (id: string) => {
    const [f] = await db.insert(folgasTable).values({ userId: id, operationId: op!.id, type: "DAY_OFF", startDate: dia, endDate: dia, status: "ACTIVE", createdBy: id }).returning();
    folgaIds.push(f!.id);
  };
  const limparFolgas = async () => { if (folgaIds.length) await db.delete(folgasTable).where(inArray(folgasTable.id, folgaIds.splice(0))); };
  const reservas = (blockId: string, ids: string[]) => db.update(showBookBlocksTable).set({ reserveIds: ids }).where(eq(showBookBlocksTable.id, blockId));
  const quem = async (sceneId: string) => {
    const r = await resolveShowBookCast(livro!.id, op!.id, dia, { dedupPerScene: true });
    const c = r.scenes.find((s) => s.sceneId === sceneId)!;
    const mapa = new Map<string, string>();
    const status = new Map<string, string>();
    for (const b of c.blocks) for (const p of b.positions) { mapa.set(p.name, p.lines[0]?.people[0]?.userId ?? ""); status.set(p.name, p.lines[0]?.status ?? ""); }
    return { mapa, status };
  };
  const nome = (id: string | undefined) => (id ? nomes.get(id) ?? "?" : "");

  let server: http.Server | null = null;
  try {
    // ── sem reservas: como era ──
    await folga(t1!.id);
    let { mapa, status } = await quem(cena!.id);
    assert(nome(mapa.get("PA 01")) === "" && status.get("PA 01") === "UNCOVERED", "sem reservas, titular de folga deixa a posição descoberta (como era)");
    await limparFolgas();

    // ── cada grupo com a sua lista ──
    await reservas(gPat.id, [r1!.id, r2!.id]);
    await reservas(gBai.id, [b1!.id]);
    ({ mapa, status } = await quem(cena!.id));
    assert(nome(mapa.get("PA 01")) === "t1" && nome(mapa.get("PA 02")) === "t2" && nome(mapa.get("PA 03")) === "t3" && nome(mapa.get("BA 01")) === "d1", "todos os titulares presentes: ninguém precisa de reserva");

    await folga(t1!.id);
    ({ mapa } = await quem(cena!.id));
    assert(nome(mapa.get("PA 01")) === "r1" && nome(mapa.get("PA 02")) === "t2", "titular patinador de folga: entra a primeira reserva DOS PATINADORES");
    await limparFolgas();

    await folga(d1!.id);
    ({ mapa } = await quem(cena!.id));
    assert(nome(mapa.get("BA 01")) === "b1", "titular bailarino de folga: entra a reserva DOS BAILARINOS, não a dos patinadores");
    await folga(b1!.id);
    ({ mapa, status } = await quem(cena!.id));
    assert(nome(mapa.get("BA 01")) === "" && status.get("BA 01") === "UNCOVERED", "reservas dos patinadores livres não cobrem um bailarino: a posição fica descoberta");
    await limparFolgas();

    await folga(t1!.id); await folga(t2!.id);
    ({ mapa } = await quem(cena!.id));
    assert(nome(mapa.get("PA 01")) === "r1" && nome(mapa.get("PA 02")) === "r2", "duas posições sem titular usam duas reservas diferentes");
    await folga(t3!.id);
    ({ mapa, status } = await quem(cena!.id));
    assert(nome(mapa.get("PA 03")) === "" && status.get("PA 03") === "UNCOVERED", "acabaram as reservas do grupo: a terceira posição fica descoberta, dizendo a verdade");
    await limparFolgas();

    // reserva que é titular presente de outra posição do mesmo grupo não é tomada
    await reservas(gPat.id, [t3!.id, r2!.id]);
    await folga(t1!.id);
    ({ mapa } = await quem(cena!.id));
    assert(nome(mapa.get("PA 01")) === "r2" && nome(mapa.get("PA 03")) === "t3", "reserva que é titular presente de outra posição não toma o lugar dele");
    await limparFolgas();

    // reserva de folga é pulada
    await reservas(gPat.id, [r1!.id, r2!.id]);
    await folga(t1!.id); await folga(r1!.id);
    ({ mapa } = await quem(cena!.id));
    assert(nome(mapa.get("PA 01")) === "r2", "reserva de folga é pulada e entra a próxima");
    await limparFolgas();

    // substituto da própria bolinha vem antes das reservas
    const linhaP1 = (await db.select().from(showBookLinesTable).where(eq(showBookLinesTable.positionId, p1)))[0]!;
    await db.update(showBookLinesTable).set({ config: { titularId: t1!.id, substituteIds: [s1!.id] } }).where(eq(showBookLinesTable.id, linhaP1.id));
    await folga(t1!.id);
    ({ mapa } = await quem(cena!.id));
    assert(nome(mapa.get("PA 01")) === "s1", "o substituto cadastrado na própria bolinha continua vindo antes das reservas");
    await limparFolgas();
    await db.update(showBookLinesTable).set({ config: { titularId: t1!.id, substituteIds: [] } }).where(eq(showBookLinesTable.id, linhaP1.id));

    // grupo de outra cena, sem reservas, não herda nada
    await folga(t1!.id);
    ({ mapa, status } = await quem(cenaB!.id));
    assert(nome(mapa.get("SO 01")) === "" && status.get("SO 01") === "UNCOVERED", "um grupo sem reservas não herda as de outro grupo");
    await limparFolgas();

    // ── rota do grupo ──
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
    const url = `/show-books/${livro!.id}/blocks/${gSolto.id}`;
    const ruim = await call("PATCH", url, { reserveIds: "r1" });
    assert(ruim.status === 400 && /lista de pessoas/.test(ruim.text), "lista que não é lista é 400 com frase");
    const inexistente = await call("PATCH", url, { reserveIds: ["00000000-0000-4000-8000-000000000000"] });
    assert(inexistente.status === 400 && /não existe ou não está ativa/.test(inexistente.text), "pessoa que não existe é 400 com frase");
    const boa = await call("PATCH", url, { reserveIds: [r2!.id, r1!.id, r2!.id], reason: "Reservas do grupo" });
    assert(boa.status === 200 && JSON.stringify(boa.body.block?.reserveIds) === JSON.stringify([r2!.id, r1!.id]), "grava a lista sem repetir e na ordem escolhida");
    const detalhe = await call("GET", `/show-books/${livro!.id}`);
    const blocoNoDetalhe = (detalhe.body.showBook?.scenes as any[] | undefined)?.flatMap((s) => s.blocks).find((b) => b.id === gSolto.id);
    const diretorio = (detalhe.body.showBook?.memberDirectory as { id: string; name: string }[] | undefined) ?? [];
    assert(JSON.stringify(blocoNoDetalhe?.reserveIds) === JSON.stringify([r2!.id, r1!.id]) && diretorio.some((d) => d.id === r1!.id) && diretorio.some((d) => d.id === r2!.id), "o detalhe do show traz a lista do grupo e os nomes das reservas");
    const eventos = () => db.select().from(historyEventsTable).where(eq(historyEventsTable.entityId, gSolto.id));
    assert((await eventos()).filter((e) => e.action === "show_book.block.reserves_updated" && /2 pessoas/.test(e.narrative ?? "")).length === 1, "a mudança entrou no Registro uma vez, dizendo quantas pessoas");
    const igual = await call("PATCH", url, { reserveIds: [r2!.id, r1!.id] });
    assert(igual.status === 200 && (await eventos()).filter((e) => e.action === "show_book.block.reserves_updated").length === 1, "salvar a mesma lista de novo não grava outro evento de reservas");
    const limpa = await call("PATCH", url, { reserveIds: [] });
    assert(limpa.status === 200 && JSON.stringify(limpa.body.block?.reserveIds) === "[]", "dá para esvaziar a lista");
  } finally {
    await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
    await limparFolgas();
    await db.delete(historyEventsTable).where(or(eq(historyEventsTable.orgId, org!.id), inArray(historyEventsTable.actorId, todos)));
    await db.delete(securityAuditLogTable).where(inArray(securityAuditLogTable.actorId, todos));
    await db.delete(notificationOutboxTable).where(inArray(notificationOutboxTable.userId, todos));
    await db.delete(showBookLinesTable).where(inArray(showBookLinesTable.positionId, posicoes));
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
  if (failures.length > 0) throw new Error(`${failures.length} falha(s) em reservas-do-grupo`);
  process.stdout.write(`reservas-do-grupo: ${passed} asserts passed\n`);
}

process.stdout.write("reservas-do-grupo: starting\n");
try {
  await run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
