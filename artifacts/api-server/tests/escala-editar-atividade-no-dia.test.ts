/**
 * Editar a atividade só neste dia (0087, 27/10/2026): o nome, o horário (para todos) e o tipo mudados só naquela Escala, sem mexer na
 * Programação. Show não entra. Quem pode: Administração e Supervisão do local. Voltar ao normal, versão, Registro, escala publicada,
 * chamada que acompanha o horário novo. PostgreSQL real de teste.
 */
import http from "node:http";
import { eq, inArray, or } from "drizzle-orm";
import {
  areaLocalSupervisorsTable, areasTable, db, escalaBlocoAjustesTable, escalaBlocoEdicoesTable, escalaChamadasTable, escalaTiposTable, historyEventsTable, locationsTable, operationLocationsTable, operationsTable,
  organizationsTable, pool, programacaoBlocosTable, programacoesTable, scalesTable, showBooksTable, userRolesTable, usersTable,
} from "@workspace/db";
import app from "../src/application.js";
import { signAccessToken } from "../src/lib/jwt.service.js";

let passed = 0;
const failures: string[] = [];
function assert(condition: boolean, message: string) {
  if (condition) passed += 1;
  else { failures.push(message); console.error(`  ✗ ${message}`); }
}

type Bloco = { tipoId?: string | null; editadoNoDia?: { original: { rotulo: string; inicio: string; fim: string | null }; em: string }; chamada?: { nome: string }; key: string; rotulo: string; inicio: string; fim: string | null; pessoaIds: string[]; vazio: boolean; sinal: string | null; horarioDela?: { chaveOriginal: string; inicio: string; fim: string | null } };
type Dia = { escala: { id: string; status: string; version: number; alteradaDesde: string | null } | null; blocos: Bloco[] };

async function run() {
  const tag = `edt_${Date.now()}`;
  const date = "2026-10-05"; // segunda-feira
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [operation] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const [local] = await db.insert(locationsTable).values({ organizationId: org!.id, name: `${tag}_Snowland` }).returning();
  await db.insert(operationLocationsTable).values({ operationId: operation!.id, locationId: local!.id });
  const [pat, bai] = await db.insert(areasTable).values([{ organizationId: org!.id, name: `${tag}_Patinadores` }, { organizationId: org!.id, name: `${tag}_Bailarinos` }]).returning();
  const mk = async (suffix: string, areaId: string | null) => (await db.insert(usersTable).values({ organizationId: org!.id, name: `${tag}_${suffix}`, username: `${tag}_${suffix}`, areaId }).returning())[0]!;
  const admin = await mk("admin", null), dir = await mk("dir", null), supPat = await mk("deborah", pat!.id), supBai = await mk("victor", bai!.id);
  const jeff = await mk("jeff", pat!.id), carol = await mk("carol", pat!.id);
  const todos = [admin, dir, supPat, supBai, jeff, carol];
  await db.insert(userRolesTable).values([
    { userId: admin.id, operationId: operation!.id, role: "ADMIN", active: true },
    { userId: dir.id, operationId: operation!.id, role: "DIR", active: true },
    { userId: supPat.id, operationId: operation!.id, role: "SUPERVISOR_A", active: true },
    { userId: supBai.id, operationId: operation!.id, role: "SUPERVISOR_A", active: true },
    ...[jeff, carol].map((u) => ({ userId: u.id, operationId: operation!.id, role: "MEMBER" as const, active: true })),
  ]);
  await db.insert(areaLocalSupervisorsTable).values([
    { areaId: pat!.id, locationId: local!.id, supervisorId: supPat.id }, { areaId: bai!.id, locationId: local!.id, supervisorId: supBai.id },
  ]);
  const [show] = await db.insert(showBooksTable).values({ operationId: operation!.id, locationId: local!.id, title: `${tag}_Show`, createdBy: admin.id }).returning();

  let server: http.Server | null = null;
  try {
    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("servidor de teste não iniciou");
    const base = `http://127.0.0.1:${address.port}/api`;
    const as = (u: { id: string }, role: string) => {
      const token = signAccessToken({ sub: u.id, jti: `${tag}_${u.id}`, organizationId: org!.id, role, operationIds: [operation!.id] });
      return async (method: string, path: string, body?: unknown) => {
        const r = await fetch(`${base}${path}`, { method, signal: AbortSignal.timeout(60_000), headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
        const text = await r.text();
        return { status: r.status, text, body: (() => { try { return JSON.parse(text) as Record<string, any>; } catch { return {}; } })() };
      };
    };
    const asAdmin = as(admin, "ADMIN"), asDir = as(dir, "DIR"), asPat = as(supPat, "SUPERVISOR_A"), asBai = as(supBai, "SUPERVISOR_A"), asJeff = as(jeff, "MEMBER");

    const prog = (await asAdmin("POST", "/programacoes", { locationId: local!.id, nome: "Natal", vigenciaInicio: "2026-10-01", vigenciaFim: "2026-10-31" })).body.programacao as { id: string };
    for (const b of [
      { weekday: 1, inicio: "10:00", fim: "11:00", rotulo: "TREINO GELO", regra: "pessoas", pessoaIds: [jeff.id, carol.id] },
      { weekday: 1, inicio: "13:00", fim: "13:30", rotulo: "ENSAIO", regra: "pessoas", pessoaIds: [jeff.id] },
      { weekday: 1, inicio: "11:30", fim: "12:00", rotulo: "SHOW TEATRO", regra: "livro", showBookId: show!.id },
    ]) assert((await asAdmin("POST", `/programacoes/${prog.id}/blocos`, b)).status === 201, `bloco ${b.rotulo} criado na Programação`);
    const blocoTreino = (await db.select().from(programacaoBlocosTable).where(eq(programacaoBlocosTable.programacaoId, prog.id))).find((b) => b.rotulo === "TREINO GELO")!;
    const [tipoNovo] = await db.insert(escalaTiposTable).values({ organizationId: org!.id, locationId: local!.id, nome: `${tag}_Aula`, cor: "coral", chave: null, ordem: 90 }).returning();

    const dia = async (fn = asAdmin) => ((await fn("GET", `/escalas/dia?locationId=${local!.id}&date=${date}`)).body.dia as Dia);
    const bloco = (d: Dia, rotulo: string) => d.blocos.find((b) => b.rotulo === rotulo && !b.horarioDela && !b.chamada);
    const edita = (fn: typeof asAdmin, body: Record<string, unknown>) => fn("POST", "/escalas/dia/editar", { locationId: local!.id, date, ...body });

    let d = await dia();
    const treino = bloco(d, "TREINO GELO")!, teatro = bloco(d, "SHOW TEATRO")!;
    assert(Boolean(treino) && treino.inicio === "10:00" && treino.fim === "11:00" && !treino.editadoNoDia, "ponto de partida: treino de gelo das 10:00 às 11:00, sem edição");

    // ── quem pode, e as recusas com frase ──
    assert((await edita(asJeff, { sourceKey: treino.key, rotulo: "TREINO", inicio: "10:30", fim: "11:00" })).status === 403, "Elenco não edita atividade");
    const dirTenta = await edita(asDir, { sourceKey: treino.key, rotulo: "TREINO", inicio: "10:30", fim: "11:00" });
    assert(dirTenta.status === 403 && /Direção/.test(dirTenta.text) && /Administração/.test(dirTenta.text), "Direção é recusada com a frase de quem pode e do perfil de quem tentou");
    const showTenta = await edita(asAdmin, { sourceKey: teatro.key, rotulo: "OUTRO", inicio: "11:40", fim: "12:10" });
    assert(showTenta.status === 409 && /Show não se edita aqui/.test(showTenta.text), "show não se edita aqui: 409 com a frase do porquê");
    assert((await edita(asAdmin, { sourceKey: treino.key, rotulo: "T", inicio: "10:30" })).status === 400, "nome de uma letra só é 400 com frase");
    const feio = await edita(asAdmin, { sourceKey: treino.key, rotulo: "TREINO", inicio: "25:99" });
    assert(feio.status === 400 && /hora de início/.test(feio.text), "hora que não existe é 400 com frase");
    const invertido = await edita(asAdmin, { sourceKey: treino.key, rotulo: "TREINO", inicio: "10:30", fim: "10:10" });
    assert(invertido.status === 400 && /depois do início/.test(invertido.text), "fim antes do início é 400 com frase");
    const fimVelho = await edita(asAdmin, { sourceKey: treino.key, rotulo: "TREINO GELO", inicio: "11:30" });
    assert(fimVelho.status === 400 && /hora de fim/.test(fimVelho.text), "início depois do fim original sem novo fim é 400 pedindo o fim");
    assert((await edita(asAdmin, { sourceKey: treino.key, rotulo: "TREINO GELO", inicio: "10:00", fim: "11:00", tipoId: "nao-e-uuid" })).status === 400, "tipo que não é id é 400");
    assert((await edita(asAdmin, { sourceKey: "p:00000000-0000-0000-0000-000000000000", rotulo: "XX", inicio: "10:00" })).status === 404, "atividade que não existe nesta Escala dá 404");
    assert((await db.select().from(escalaBlocoEdicoesTable)).filter((e) => e.createdBy === admin.id).length === 0, "as recusas não gravaram nada");

    // ── a Supervisão do local edita nome, horário e tipo, para todos, só neste dia ──
    const ok = await edita(asPat, { sourceKey: treino.key, rotulo: "AULA DE PATINAÇÃO", inicio: "10:30", fim: "11:15", tipoId: tipoNovo!.id, motivo: "Gelo atrasou", baseEditadaEm: null });
    assert(ok.status === 200 && ok.body.mudou === true, `Supervisão do local edita a atividade do dia${ok.status === 200 ? "" : ` (veio ${ok.status}: ${ok.text.slice(0, 160)})`}`);
    d = ok.body.dia as Dia;
    const editado = d.blocos.find((b) => b.key === treino.key)!;
    assert(editado.rotulo === "AULA DE PATINAÇÃO" && editado.inicio === "10:30" && editado.fim === "11:15" && editado.tipoId === tipoNovo!.id, "a Escala do dia mostra o nome, o horário e o tipo novos");
    assert(editado.pessoaIds.length === 2 && editado.pessoaIds.includes(jeff.id) && editado.pessoaIds.includes(carol.id), "vale para todos da atividade");
    assert(editado.editadoNoDia?.original.rotulo === "TREINO GELO" && editado.editadoNoDia.original.inicio === "10:00", "o bloco guarda o que a Programação manda, para o 'voltar ao normal'");
    const progDepois = (await db.select().from(programacaoBlocosTable).where(eq(programacaoBlocosTable.id, blocoTreino.id)))[0]!;
    assert(progDepois.rotulo === "TREINO GELO" && progDepois.inicio.slice(0, 5) === "10:00" && (progDepois.fim ?? "").slice(0, 5) === "11:00", "a Programação não mudou");
    assert(!!d.escala, "a Escala do dia nasceu para guardar a edição");

    const eventos = async () => (await db.select().from(historyEventsTable).where(eq(historyEventsTable.entityId, d.escala!.id))).filter((e) => e.action === "escala.atividade_editada");
    assert((await eventos()).length === 1 && /TREINO GELO/.test((await eventos())[0]?.narrative ?? "") && /AULA DE PATINAÇÃO/.test((await eventos())[0]?.narrative ?? "") && /Gelo atrasou/.test((await eventos())[0]?.narrative ?? ""), "entrou no Registro dizendo o que mudou e o motivo");
    const repete = await edita(asPat, { sourceKey: treino.key, rotulo: "AULA DE PATINAÇÃO", inicio: "10:30", fim: "11:30", tipoId: tipoNovo!.id, baseEditadaEm: editado.editadoNoDia!.em });
    assert(repete.status === 200 && (await eventos()).length === 2, "salvar de novo com a versão em dia troca a edição e grava outro evento");

    // ── dois navegadores: versão velha é recusada com a frase de verdade ──
    const velha = await edita(asAdmin, { sourceKey: treino.key, rotulo: "OUTRO NOME", inicio: "10:30", fim: "11:30", baseEditadaEm: editado.editadoNoDia!.em });
    assert(velha.status === 409 && /Outra pessoa editou esta atividade/.test(velha.text), "salvar sobre uma versão velha é 409 com a frase de verdade");
    assert(bloco(await dia(), "AULA DE PATINAÇÃO") !== undefined, "a recusa não apagou a edição da outra pessoa");

    // ── a chamada "X minutos antes" acompanha o horário novo ──
    await db.insert(escalaChamadasTable).values({ organizationId: org!.id, programacaoBlocoId: blocoTreino.id, nome: "Aquecimento", modo: "antes", minutosAntes: 20, duracaoMin: 10, ocupaTempo: true, avisar: true });
    d = await dia();
    const chamBloco = d.blocos.find((b) => b.chamada?.nome === "Aquecimento");
    assert(Boolean(chamBloco) && chamBloco!.inicio === "10:10", `a chamada de 20 minutos antes foi para 10:10, junto com o horário novo (10:30)${chamBloco ? ` (veio ${chamBloco.inicio})` : ""}`);

    // ── voltar ao normal ──
    const volta = await edita(asPat, { sourceKey: treino.key, voltar: true });
    d = volta.body.dia as Dia;
    const normal = d.blocos.find((b) => b.key === treino.key)!;
    assert(volta.status === 200 && normal.rotulo === "TREINO GELO" && normal.inicio === "10:00" && normal.fim === "11:00" && !normal.editadoNoDia, "voltar ao normal devolve o que a Programação manda");
    const todasAsEdicoes = (await db.select().from(escalaBlocoEdicoesTable)).filter((e) => e.scaleId === d.escala!.id);
    assert(todasAsEdicoes.filter((e) => e.active).length === 0 && todasAsEdicoes.length >= 1, "voltar não apaga: a edição fica inativa no banco");
    assert((await db.select().from(historyEventsTable).where(eq(historyEventsTable.entityId, d.escala!.id))).some((e) => e.action === "escala.atividade_restaurada"), "voltar ao normal também entrou no Registro");
    const denovo = await edita(asPat, { sourceKey: treino.key, voltar: true });
    assert(denovo.status === 200 && denovo.body.mudou === false, "voltar ao normal de novo não muda nada");

    // ── editar para igual ao original não vale como edição ──
    const igual = await edita(asPat, { sourceKey: treino.key, rotulo: "TREINO GELO", inicio: "10:00", fim: "11:00" });
    assert(igual.status === 200 && igual.body.mudou === false, "mandar o mesmo que a Programação manda não grava edição");

    // ── escala já publicada: pede republicação ──
    const escalaId = d.escala!.id;
    await db.update(scalesTable).set({ status: "PUBLISHED", publishedAt: new Date() }).where(eq(scalesTable.id, escalaId));
    const antes = (await db.select().from(scalesTable).where(eq(scalesTable.id, escalaId)))[0]!;
    const pub = await edita(asPat, { sourceKey: treino.key, rotulo: "TREINO GELO", inicio: "10:45", fim: "11:30" });
    const depois = (await db.select().from(scalesTable).where(eq(scalesTable.id, escalaId)))[0]!;
    assert(pub.status === 200 && depois.alteradaDesde !== null && depois.version === antes.version + 1, "com a escala publicada, a edição marca 'alterada depois de publicada' e sobe a versão");
    const avisos = await pool.query(`select count(*)::int as n from notification_outbox where user_id = $1 and payload->>'type' = 'scale.needs_republish'`, [admin.id]);
    assert(avisos.rows[0].n >= 1, "a Administração recebe o aviso de que há o que republicar");
  } finally {
    if (server) { server.closeAllConnections?.(); await new Promise<void>((resolve) => server!.close(() => resolve())); }
    const ids = todos.map((u) => u.id);
    await db.delete(historyEventsTable).where(or(eq(historyEventsTable.orgId, org!.id), inArray(historyEventsTable.actorId, ids)));
    await pool.query(`delete from notification_outbox where user_id = any($1::uuid[])`, [ids]);
    await pool.query(`delete from user_notifications where user_id = any($1::uuid[])`, [ids]);
    await pool.query(`delete from notifications where user_id = any($1::uuid[])`, [ids]);
    const escalas = await db.select({ id: scalesTable.id }).from(scalesTable).where(eq(scalesTable.operationId, operation!.id));
    await db.delete(escalaChamadasTable).where(eq(escalaChamadasTable.organizationId, org!.id));
    if (escalas.length) {
      await db.delete(escalaBlocoEdicoesTable).where(inArray(escalaBlocoEdicoesTable.scaleId, escalas.map((s) => s.id)));
      await db.delete(escalaBlocoAjustesTable).where(inArray(escalaBlocoAjustesTable.scaleId, escalas.map((s) => s.id)));
    }
    await db.delete(scalesTable).where(eq(scalesTable.operationId, operation!.id));
    const progs = await db.select({ id: programacoesTable.id }).from(programacoesTable).where(eq(programacoesTable.locationId, local!.id));
    if (progs.length) await db.delete(programacaoBlocosTable).where(inArray(programacaoBlocosTable.programacaoId, progs.map((p) => p.id)));
    await db.delete(programacoesTable).where(eq(programacoesTable.locationId, local!.id));
    await db.delete(showBooksTable).where(eq(showBooksTable.id, show!.id));
    await db.delete(escalaTiposTable).where(eq(escalaTiposTable.organizationId, org!.id));
    await db.delete(areaLocalSupervisorsTable).where(eq(areaLocalSupervisorsTable.locationId, local!.id));
    await db.delete(userRolesTable).where(eq(userRolesTable.operationId, operation!.id));
    await db.delete(usersTable).where(inArray(usersTable.id, ids));
    await db.delete(areasTable).where(inArray(areasTable.id, [pat!.id, bai!.id]));
    await db.delete(operationLocationsTable).where(eq(operationLocationsTable.locationId, local!.id));
    await db.delete(locationsTable).where(eq(locationsTable.id, local!.id));
    await db.delete(operationsTable).where(eq(operationsTable.id, operation!.id));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, org!.id));
  }
  if (failures.length > 0) throw new Error(`${failures.length} falha(s) em escala-editar-atividade-no-dia`);
  process.stdout.write(`escala-editar-atividade-no-dia: ${passed} asserts passed\n`);
}

process.stdout.write("escala-editar-atividade-no-dia: starting\n");
try {
  await run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
