import http from "node:http";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
  db, pool, organizationsTable, operationsTable, usersTable, userRolesTable,
  showBooksTable, showBookScenesTable, showBookBlocksTable, showBookRolesTable,
  showBookLinesTable, showBookDriveLinksTable, historyEventsTable,
} from "@workspace/db";
import app from "../src/application.js";
import { signAccessToken } from "../src/lib/jwt.service.js";

let passed = 0;
const failures: string[] = [];
const assert = (value: unknown, message: string) => {
  if (value) { passed++; console.log(`  ✓ ${message}`); }
  else { failures.push(message); console.error(`  ✗ ${message}`); }
};

async function run() {
  const tag = `book_slots_${Date.now()}`;
  const [org] = await db.insert(organizationsTable).values({ name: tag }).returning();
  const [operation] = await db.insert(operationsTable).values({ organizationId: org!.id, name: tag, status: "ACTIVE" }).returning();
  const [admin] = await db.insert(usersTable).values({ organizationId: org!.id, name: "Admin do Livro" }).returning();
  const people = await db.insert(usersTable).values([
    { organizationId: org!.id, name: "Titular" },
    { organizationId: org!.id, name: "Primeiro substituto" },
    { organizationId: org!.id, name: "Segundo substituto" },
  ]).returning();
  const [titular, substituteOne, substituteTwo] = people;
  let server: http.Server | undefined;
  try {
    await db.insert(userRolesTable).values({ userId: admin!.id, operationId: operation!.id, role: "ADMIN" });
    const [book] = await db.insert(showBooksTable).values({ operationId: operation!.id, title: tag, createdBy: admin!.id }).returning();
    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address(); if (!address || typeof address === "string") throw new Error("Servidor não iniciou");
    const token = signAccessToken({ sub: admin!.id, jti: randomUUID(), role: "ADMIN", organizationId: org!.id, operationIds: [operation!.id] });
    const request = (path: string, method = "GET", body?: unknown) => fetch(`http://127.0.0.1:${address.port}/api${path}`, { method, headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });

    const sceneResponse = await request(`/show-books/${book!.id}/scenes`, "POST", { name: "Bandeiras", order: 0, reason: "Estrutura inicial" });
    const sceneBody = await sceneResponse.json() as any;
    const defaultGroups = await db.select().from(showBookBlocksTable).where(and(eq(showBookBlocksTable.sceneId, sceneBody.scene.id), eq(showBookBlocksTable.active, true))).orderBy(showBookBlocksTable.order);
    assert(sceneResponse.status === 201 && defaultGroups.length === 0, "Cena nova nasce sem grupos: quem monta escolhe e dá o nome de cada um");

    const leftResponse = await request(`/show-books/${book!.id}/blocks`, "POST", { sceneId: sceneBody.scene.id, name: "Backstage left", prefix: "BL", zone: "BACKSTAGE LEFT", order: 0, reason: "Grupo escolhido pela pessoa" });
    const left = (await leftResponse.json() as any).block;
    assert(leftResponse.status === 201 && left.prefix === "BL" && left.zone === "BACKSTAGE LEFT", "Grupo criado pelo botão tem o nome, a zona e o prefixo escolhidos");
    const positionResponse = await request(`/show-books/${book!.id}/positions`, "POST", { name: "BL 01", order: 0, blockId: left.id, reason: "Slot-base" });
    const position = (await positionResponse.json() as any).position;
    const castResponse = await request(`/show-books/${book!.id}/positions/${position.id}/cast`, "PUT", { titularId: titular!.id, substituteIds: [substituteOne!.id, substituteTwo!.id], reason: "Elenco do slot" });
    const cast = await castResponse.json() as any;
    const [savedLine] = await db.select().from(showBookLinesTable).where(and(eq(showBookLinesTable.positionId, position.id), eq(showBookLinesTable.type, "TITULAR_SUBSTITUTE")));
    assert(castResponse.status === 200 && cast.line.config.titularId === titular!.id && cast.line.config.substituteIds.join("|") === `${substituteOne!.id}|${substituteTwo!.id}`, "Titular e substitutos persistem numa linha ligada ao slot, em ordem");
    assert(savedLine?.active && (savedLine.config as any).substituteIds[0] === substituteOne!.id, "Trocar titular não desloca a lista de substitutos do slot");
    const history = await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.entityId, position.id), eq(historyEventsTable.action, "show_book.slot_cast.updated")));
    assert(history.length === 1, "Alteração de titular/substitutos entra no Registro operacional");

    const groupResponse = await request(`/show-books/${book!.id}/blocks`, "POST", { sceneId: sceneBody.scene.id, name: "Pista", zone: "CENTRO", order: 3, reason: "Grupo para Acquamotion" });
    const group = (await groupResponse.json() as any).block;
    assert(groupResponse.status === 201 && group.prefix === "PI", "Prefixo de grupo novo deriva do nome: Pista gera PI");
    await request(`/show-books/${book!.id}/blocks/${left.id}/group`, "PATCH", { name: "Coxia esquerda", zone: "STAGE LEFT", prefix: "BL", reason: "Nome do grupo ajustado" });
    const [renamed] = await db.select().from(showBookBlocksTable).where(eq(showBookBlocksTable.id, left.id));
    const [unchangedPosition] = await db.select().from(showBookRolesTable).where(eq(showBookRolesTable.id, position.id));
    assert(renamed?.prefix === "BL" && unchangedPosition?.name === "BL 01", "Renomear grupo preserva prefixo e rótulo de slot já usado em quadros-chave");
    const rejectRemove = await request(`/show-books/${book!.id}/blocks/${left.id}`, "DELETE", { reason: "Teste de confirmação" });
    assert(rejectRemove.status === 409, "Remover grupo com slots exige confirmação e informa a quantidade");

    const createdLink = await request(`/show-books/${book!.id}/drive-links`, "POST", { label: "Roteiro", url: "", type: "Documento", scope: "Musical", order: 0, reason: "Acervo cadastrado" });
    const link = (await createdLink.json() as any).link;
    const updatedLink = await request(`/show-books/${book!.id}/drive-links/${link.id}`, "PATCH", { url: "https://drive.google.com/example", order: 1, reason: "URL cadastrada" });
    assert(createdLink.status === 201 && link.url === null && updatedLink.status === 200, "Link do Drive pode nascer aguardando URL e ser completado depois");
    const linkHistory = await db.select().from(historyEventsTable).where(eq(historyEventsTable.entityId, link.id));
    assert(linkHistory.length >= 2, "Criar e editar link do Drive gravam Registro");

    const noteResponse = await request(`/show-books/${book!.id}`, "PATCH", { description: "Trocar faixas antes do ensaio.", reason: "Observações atualizadas" });
    const noteBody = await noteResponse.json() as any;
    assert(noteResponse.status === 200 && noteBody.showBook.description === "Trocar faixas antes do ensaio.", "Observações são texto editável e persistem no Livro do Show");

    // Revisão 4: toda edição estrutural (cena, grupo, slot, linha, tag) grava Registro com o motivo.
    const registroDe = async (entityId: string, action: string) =>
      db.select().from(historyEventsTable).where(and(eq(historyEventsTable.entityId, entityId), eq(historyEventsTable.action, action)));
    assert((await registroDe(group.id, "show_book.block.created")).length === 1, "Criar grupo grava Registro");
    const grupoAlterado = await request(`/show-books/${book!.id}/blocks/${group.id}`, "PATCH", { name: "Pista central", reason: "Nome mais claro" });
    const registroGrupo = await registroDe(group.id, "show_book.block.updated");
    assert(grupoAlterado.status === 200 && registroGrupo.length === 1 && (registroGrupo[0]!.metadata as any).reason === "Nome mais claro", "Alterar grupo grava Registro com o motivo escrito");
    const cenaAlterada = await request(`/show-books/${book!.id}/scenes/${sceneBody.scene.id}`, "PATCH", { name: "Bandeiras e fitas", reason: "Cena renomeada" });
    assert(cenaAlterada.status === 200 && (await registroDe(sceneBody.scene.id, "show_book.scene.updated")).length === 1, "Alterar cena grava Registro");
    const slotAlterado = await request(`/show-books/${book!.id}/positions/${position.id}`, "PATCH", { name: "BL 01 (reserva)", reason: "Slot renomeado" });
    assert(slotAlterado.status === 200 && (await registroDe(position.id, "show_book.position.updated")).length === 1, "Alterar slot grava Registro");
    const slotNovo = await request(`/show-books/${book!.id}/positions`, "POST", { name: "BL 02", order: 1, blockId: left.id, reason: "Mais um slot" });
    const slotNovoId = (await slotNovo.json() as any).position.id as string;
    assert(slotNovo.status === 201 && (await registroDe(slotNovoId, "show_book.position.created")).length === 1, "Criar slot grava Registro");
    const tipoErrado = await request(`/show-books/${book!.id}/positions/${slotNovoId}/lines`, "POST", { type: "TEXT", reason: "Tipo inexistente" });
    assert(tipoErrado.status === 400 && /não existe/.test((await tipoErrado.json() as any).message), "Tipo de linha inexistente responde 400 com a lista, não 500");
    const linhaNova = await request(`/show-books/${book!.id}/positions/${slotNovoId}/lines`, "POST", { type: "MANUAL", config: { texto: "a" }, order: 0, reason: "Linha de teste" });
    const linhaId = (await linhaNova.json() as any).line.id as string;
    assert(linhaNova.status === 201 && (await registroDe(linhaId, "show_book.line.created")).length === 1, "Criar linha grava Registro");
    await request(`/show-books/${book!.id}/lines/${linhaId}`, "PATCH", { config: { texto: "b" }, reason: "Texto corrigido" });
    assert((await registroDe(linhaId, "show_book.line.updated")).length === 1, "Alterar linha grava Registro");
    await request(`/show-books/${book!.id}/lines/${linhaId}`, "DELETE", { reason: "Linha desnecessária" });
    assert((await registroDe(linhaId, "show_book.line.removed")).length === 1, "Remover linha grava Registro");
    await request(`/show-books/${book!.id}/positions/${slotNovoId}`, "DELETE", { reason: "Slot desnecessário" });
    assert((await registroDe(slotNovoId, "show_book.position.removed")).length === 1, "Remover slot grava Registro");
    const grupoRemovido = await request(`/show-books/${book!.id}/blocks/${group.id}`, "DELETE", { reason: "Grupo desnecessário", confirm: true });
    assert(grupoRemovido.status === 204 && (await registroDe(group.id, "show_book.block.removed")).length === 1, "Remover grupo grava Registro");
    const cenaRemovida = await request(`/show-books/${book!.id}/scenes/${sceneBody.scene.id}`, "DELETE", { reason: "Cena desnecessária" });
    assert(cenaRemovida.status === 204 && (await registroDe(sceneBody.scene.id, "show_book.scene.removed")).length === 1, "Remover cena grava Registro");
    const tagCriada = await request(`/operations/${operation!.id}/tags`, "POST", { category: "ARTISTIC_SKILL", label: "Equilíbrio" });
    const tagId = (await tagCriada.json() as any).tag.id as string;
    assert(tagCriada.status === 201 && (await registroDe(tagId, "show_book_tag.created")).length === 1, "Criar tag grava Registro");
    const tagDada = await request(`/users/${titular!.id}/tags`, "POST", { tagId });
    const tagDadaId = (await tagDada.json() as any).userTag.id as string;
    assert(tagDada.status === 201 && (await registroDe(tagDadaId, "user_tag.assigned")).length === 1, "Dar tag a uma pessoa grava Registro");
  } finally {
    if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
    await pool.query("DELETE FROM history_events WHERE org_id = $1", [org!.id]);
    await pool.query("DELETE FROM show_book_versions WHERE show_book_id IN (SELECT id FROM show_books WHERE operation_id = $1)", [operation!.id]);
    await pool.query("DELETE FROM show_book_drive_links WHERE show_book_id IN (SELECT id FROM show_books WHERE operation_id = $1)", [operation!.id]);
    await pool.query("DELETE FROM show_book_lines WHERE position_id IN (SELECT id FROM show_book_roles WHERE show_book_id IN (SELECT id FROM show_books WHERE operation_id = $1))", [operation!.id]);
    await pool.query("DELETE FROM show_book_roles WHERE show_book_id IN (SELECT id FROM show_books WHERE operation_id = $1)", [operation!.id]);
    await pool.query("DELETE FROM show_book_blocks WHERE show_book_id IN (SELECT id FROM show_books WHERE operation_id = $1)", [operation!.id]);
    await pool.query("DELETE FROM show_book_scenes WHERE show_book_id IN (SELECT id FROM show_books WHERE operation_id = $1)", [operation!.id]);
    await pool.query("DELETE FROM show_books WHERE operation_id = $1", [operation!.id]);
    await pool.query("DELETE FROM user_tags WHERE user_id IN (SELECT id FROM users WHERE organization_id = $1)", [org!.id]);
    await pool.query("DELETE FROM show_book_tags WHERE operation_id = $1", [operation!.id]);
    await pool.query("DELETE FROM user_roles WHERE operation_id = $1", [operation!.id]);
    await pool.query("DELETE FROM users WHERE organization_id = $1", [org!.id]);
    await pool.query("DELETE FROM operations WHERE id = $1", [operation!.id]);
    await pool.query("DELETE FROM organizations WHERE id = $1", [org!.id]);
  }
  console.log(`\n${passed} asserts passaram, ${failures.length} falharam.`);
  if (failures.length) process.exitCode = 1;
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
