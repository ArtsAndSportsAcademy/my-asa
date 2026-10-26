/**
 * Tipos de atividade por local (0084, 25/10/2026): cada local tem a sua lista de tipos, que só a Administração cria, renomeia, pinta e
 * arquiva (nada é apagado); a Programação e a atividade só de hoje escolhem um tipo dela; sem escolha, a tela adivinha pelo nome.
 * PostgreSQL real de teste.
 */
import http from "node:http";
import { eq, inArray, or } from "drizzle-orm";
import {
  areaLocalSupervisorsTable, areasTable, db, escalaTiposTable, historyEventsTable, locationsTable, operationLocationsTable, operationsTable,
  organizationsTable, pool, programacaoBlocosTable, programacoesTable, scaleAllocationsTable, scalesTable, userRolesTable, usersTable,
} from "@workspace/db";
import app from "../src/application.js";
import { signAccessToken } from "../src/lib/jwt.service.js";

let passed = 0;
const failures: string[] = [];
function assert(condition: boolean, message: string) {
  if (condition) passed += 1;
  else { failures.push(message); console.error(`  ✗ ${message}`); }
}

type Tipo = { id: string; nome: string; cor: string; chave: string | null; active: boolean };
type Bloco = { key: string; rotulo: string; tipoId?: string | null; origem: string };

async function run() {
  const tag = `tipos_${Date.now()}`;
  const date = "2026-10-05"; // segunda-feira
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [operation] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const [local, outroLocal] = await db.insert(locationsTable).values([{ organizationId: org!.id, name: `${tag}_Snowland` }, { organizationId: org!.id, name: `${tag}_Outro` }]).returning();
  await db.insert(operationLocationsTable).values([{ operationId: operation!.id, locationId: local!.id }, { operationId: operation!.id, locationId: outroLocal!.id }]);
  const [area] = await db.insert(areasTable).values([{ organizationId: org!.id, name: `${tag}_Patinadores` }]).returning();
  const mk = async (suffix: string, areaId: string | null) => (await db.insert(usersTable).values({ organizationId: org!.id, name: `${tag}_${suffix}`, username: `${tag}_${suffix}`, areaId }).returning())[0]!;
  const admin = await mk("admin", null), dir = await mk("dir", null), sup = await mk("sup", area!.id), carol = await mk("carol", area!.id);
  const todos = [admin, dir, sup, carol];
  await db.insert(userRolesTable).values([
    { userId: admin.id, operationId: operation!.id, role: "ADMIN", active: true },
    { userId: dir.id, operationId: operation!.id, role: "DIR", active: true },
    { userId: sup.id, operationId: operation!.id, role: "SUPERVISOR_A", active: true },
    { userId: carol.id, operationId: operation!.id, role: "MEMBER", active: true },
  ]);
  await db.insert(areaLocalSupervisorsTable).values({ areaId: area!.id, locationId: local!.id, supervisorId: sup.id });

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
    const asAdmin = as(admin, "ADMIN"), asDir = as(dir, "DIR"), asSup = as(sup, "SUPERVISOR_A"), asCarol = as(carol, "MEMBER");
    const lista = async (locationId = local!.id) => (await asAdmin("GET", `/escalas/tipos?locationId=${locationId}`)).body.tipos as Tipo[];

    // ── ponto de partida: um local criado agora ainda não tem lista ──
    assert((await lista()).length === 0, "um local novo ainda não tem tipos (a migração só semeia os locais que já existiam)");
    const leSup = await asSup("GET", `/escalas/tipos?locationId=${local!.id}`);
    assert(leSup.status === 200 && leSup.body.podeEditar === false, "a Supervisão do local lê a lista, mas não pode editar");
    assert((await asCarol("GET", `/escalas/tipos?locationId=${local!.id}`)).status === 403, "o Elenco não lê a lista de tipos (ele vê as cores pela Minha escala)");
    assert((await asAdmin("GET", "/escalas/tipos?locationId=nao-e-id")).status === 404, "id de local quebrado é 404 com frase");

    // ── só a Administração mexe na lista, e a recusa explica ──
    const supTenta = await asSup("POST", "/escalas/tipos", { locationId: local!.id, padrao: true });
    assert(supTenta.status === 403 && /Administração/.test(supTenta.text) && /Supervisão/.test(supTenta.text), "a Supervisão é recusada com a frase de quem pode e do perfil de quem tentou");
    assert((await asDir("POST", "/escalas/tipos", { locationId: local!.id, nome: "Ensaio aberto", cor: "coral" })).status === 403, "a Direção não cria tipo");

    // ── os sete tipos prontos ──
    const prontos = await asAdmin("POST", "/escalas/tipos", { locationId: local!.id, padrao: true });
    assert(prontos.status === 201 && prontos.body.criados === 7, "a Administração cria os sete tipos prontos do local");
    let tipos = await lista();
    assert(tipos.length === 7 && tipos.every((t) => t.chave === t.cor && t.active), "os sete nascem ativos, cada um com a cor do seu tipo");
    assert(tipos.map((t) => t.nome).sort().join("|") === ["Almoço", "Ensaio e preparação", "Interação e personagem", "Outras atividades", "Produção e apoio", "Shows", "Treinos e aulas"].sort().join("|"), "os nomes de fábrica são os da planilha de papel (Treinos e aulas, Shows, Almoço…)");
    assert((await asAdmin("POST", "/escalas/tipos", { locationId: local!.id, padrao: true })).status === 409, "repetir os prontos é 409 com frase");
    assert((await lista(outroLocal!.id)).length === 0, "os tipos de um local não aparecem em outro");

    // ── criar tipo novo ──
    const novo = await asAdmin("POST", "/escalas/tipos", { locationId: local!.id, nome: "  Ensaio   aberto ", cor: "coral" });
    assert(novo.status === 201 && novo.body.tipo.nome === "Ensaio aberto" && novo.body.tipo.chave === null, "cria tipo novo (nome limpo, sem chave de tipo pronto)");
    const ensaioAberto = novo.body.tipo as Tipo;
    assert((await asAdmin("POST", "/escalas/tipos", { locationId: local!.id, nome: "ENSAIO ABERTO", cor: "rubi" })).status === 409, "nome repetido (sem contar maiúsculas) é 409");
    const corRuim = await asAdmin("POST", "/escalas/tipos", { locationId: local!.id, nome: "Outro", cor: "azul-bebe" });
    assert(corRuim.status === 400 && /coral/.test(corRuim.text) && /rubi/.test(corRuim.text), "cor fora da lista é 400 e a frase mostra as cores que valem");
    assert((await asAdmin("POST", "/escalas/tipos", { locationId: local!.id, nome: "x", cor: "coral" })).status === 400, "nome curto demais é 400 com frase");

    // ── a Programação escolhe o tipo ──
    const prog = (await asAdmin("POST", "/programacoes", { locationId: local!.id, nome: "Natal", vigenciaInicio: "2026-10-01", vigenciaFim: "2026-10-31" })).body.programacao as { id: string };
    const criaBloco = (corpo: Record<string, unknown>, fn = asAdmin) => fn("POST", `/programacoes/${prog.id}/blocos`, { weekday: 1, inicio: "10:00", fim: "10:30", rotulo: "ENSAIO ABERTO DO SHOW", regra: "todos", ...corpo });
    const comTipo = await criaBloco({ tipoId: ensaioAberto.id });
    assert(comTipo.status === 201 && comTipo.body.bloco.tipoId === ensaioAberto.id, "o bloco da Programação grava o tipo escolhido");
    const semTipo = await criaBloco({ rotulo: "TREINO SEM TIPO", inicio: "11:00", fim: "11:30" });
    assert(semTipo.status === 201 && semTipo.body.bloco.tipoId === null, "sem escolha, o bloco fica sem tipo (a tela adivinha pelo nome)");
    const outroTipo = (await asAdmin("POST", "/escalas/tipos", { locationId: outroLocal!.id, nome: "Do outro local", cor: "marrom" })).body.tipo as Tipo;
    const deOutroLocal = await criaBloco({ tipoId: outroTipo.id, rotulo: "X", inicio: "12:00", fim: "12:30" });
    assert(deOutroLocal.status === 400 && /não existe neste local/.test(deOutroLocal.text), "tipo de outro local é recusado com frase");
    assert((await criaBloco({ tipoId: "lixo", rotulo: "Y", inicio: "13:00", fim: "13:30" })).status === 400, "id de tipo quebrado é 400 com frase");
    const supBloco = await criaBloco({ tipoId: ensaioAberto.id, rotulo: "BLOCO DA SUPERVISAO", inicio: "14:00", fim: "14:30" }, asSup);
    assert(supBloco.status === 201, "a Supervisão do local escolhe tipo no bloco que cria");

    const progs = async () => (await asAdmin("GET", `/programacoes?locationId=${local!.id}`)).body as { programacoes: { blocos: { id: string; rotulo: string; tipoId: string | null }[] }[]; tipos: Tipo[]; podeEditarTipos: boolean };
    const lido = await progs();
    assert(lido.tipos.length === 8 && lido.podeEditarTipos === true && lido.programacoes[0]!.blocos.find((b) => b.rotulo === "ENSAIO ABERTO DO SHOW")?.tipoId === ensaioAberto.id, "a Programação devolve os tipos do local e o tipo de cada bloco");
    assert((await asSup("GET", `/programacoes?locationId=${local!.id}`)).body.podeEditarTipos === false, "a Supervisão vê os tipos na Programação, sem poder editar a lista");

    // ── a Escala do dia traz os tipos e o tipo de cada bloco ──
    const dia = async () => (await asAdmin("GET", `/escalas/dia?locationId=${local!.id}&date=${date}`)).body.dia as { tipos: Tipo[]; blocos: Bloco[]; escala: { id: string; version: number } | null };
    let d = await dia();
    assert(d.tipos.length === 8 && d.blocos.find((b) => b.rotulo === "ENSAIO ABERTO DO SHOW")?.tipoId === ensaioAberto.id && d.blocos.find((b) => b.rotulo === "TREINO SEM TIPO")?.tipoId === null, "o dia traz os tipos do local e o tipo de cada bloco (nulo quando ninguém escolheu)");

    // ── renomear, pintar e arquivar ──
    const renomeia = await asAdmin("PATCH", `/escalas/tipos/${ensaioAberto.id}`, { nome: "Ensaio com público", cor: "magenta" });
    assert(renomeia.status === 200 && renomeia.body.tipo.nome === "Ensaio com público" && renomeia.body.tipo.cor === "magenta", "a Administração renomeia e muda a cor");
    const colide = await asAdmin("PATCH", `/escalas/tipos/${ensaioAberto.id}`, { nome: "shows" });
    assert(colide.status === 409, "renomear para o nome de outro tipo ativo é 409");
    assert((await asSup("PATCH", `/escalas/tipos/${ensaioAberto.id}`, { nome: "Da Supervisão" })).status === 403, "a Supervisão não renomeia tipo");
    const arquiva = await asAdmin("PATCH", `/escalas/tipos/${ensaioAberto.id}`, { active: false });
    assert(arquiva.status === 200 && arquiva.body.tipo.active === false, "a Administração arquiva o tipo (mesmo em uso)");
    assert((await db.select().from(escalaTiposTable).where(eq(escalaTiposTable.id, ensaioAberto.id))).length === 1, "arquivar não apaga a linha");
    d = await dia();
    assert(d.tipos.some((t) => t.id === ensaioAberto.id && !t.active) && d.blocos.find((b) => b.rotulo === "ENSAIO ABERTO DO SHOW")?.tipoId === ensaioAberto.id, "o tipo arquivado continua no dia, e o bloco que o usa continua com ele");
    const blocoComArquivado = (await progs()).programacoes[0]!.blocos.find((b) => b.rotulo === "ENSAIO ABERTO DO SHOW")!;
    const novoComArquivado = await criaBloco({ tipoId: ensaioAberto.id, rotulo: "Z", inicio: "15:00", fim: "15:30" });
    assert(novoComArquivado.status === 400 && /arquivado/.test(novoComArquivado.text), "escolher um tipo arquivado num bloco novo é recusado com frase");
    const mexeHorario = await asAdmin("PATCH", `/programacoes/${prog.id}/blocos/${blocoComArquivado.id}`, { inicio: "10:05", fim: "10:35", tipoId: ensaioAberto.id });
    assert(mexeHorario.status === 200, "mexer num bloco antigo que já tinha o tipo arquivado não é barrado");
    const tiraTipo = await asAdmin("PATCH", `/programacoes/${prog.id}/blocos/${blocoComArquivado.id}`, { tipoId: null });
    assert(tiraTipo.status === 200 && tiraTipo.body.bloco.tipoId === null, "tirar o tipo do bloco volta ao palpite pelo nome");
    // nome tomado enquanto estava arquivado: desarquivar pede outro nome
    const tomado = await asAdmin("POST", "/escalas/tipos", { locationId: local!.id, nome: "Ensaio com público", cor: "oliva" });
    assert(tomado.status === 201, "o nome de um tipo arquivado pode ser usado por outro tipo");
    const desarquivaColide = await asAdmin("PATCH", `/escalas/tipos/${ensaioAberto.id}`, { active: true });
    assert(desarquivaColide.status === 409, "desarquivar quando o nome foi tomado é 409 com frase");
    assert((await asAdmin("PATCH", `/escalas/tipos/${ensaioAberto.id}`, { active: true, nome: "Ensaio aberto (antigo)" })).status === 200, "desarquivar com outro nome funciona");

    // ── atividade só de hoje escolhe o tipo ──
    const gerada = await asAdmin("POST", "/escalas/dia/gerar", { locationId: local!.id, date });
    assert(gerada.status === 201, "a Escala do dia nasce");
    const escalaId = gerada.body.escala.id as string;
    const versao = async () => (await db.select().from(scalesTable).where(eq(scalesTable.id, escalaId)))[0]!.version;
    const manual = await asAdmin("POST", `/scales/${escalaId}/entries`, { memberIds: [carol.id], date, label: "REVISAR FIGURINO", startTime: "16:00", endTime: "16:30", tipoId: tomado.body.tipo.id, expectedVersion: await versao() });
    assert(manual.status === 201 || manual.status === 200, `a atividade só de hoje grava com tipo (recebi ${manual.status})`);
    d = await dia();
    assert(d.blocos.find((b) => b.rotulo === "REVISAR FIGURINO")?.tipoId === tomado.body.tipo.id, "o bloco da atividade só de hoje traz o tipo escolhido");
    await asAdmin("PATCH", `/escalas/tipos/${tomado.body.tipo.id}`, { active: false });
    const arquivadoManual = await asAdmin("POST", `/scales/${escalaId}/entries`, { memberIds: [carol.id], date, label: "OUTRA ATIVIDADE", startTime: "17:00", endTime: "17:30", tipoId: tomado.body.tipo.id, expectedVersion: await versao() });
    assert(arquivadoManual.status === 400 && /arquivado/.test(arquivadoManual.text), "atividade só de hoje com tipo arquivado é recusada com frase");
    const entrada = (await db.select().from(scaleAllocationsTable).where(eq(scaleAllocationsTable.scaleId, escalaId))).find((e) => e.manualLabel === "REVISAR FIGURINO")!;
    const corrige = await asAdmin("PATCH", `/scales/${escalaId}/entries/${entrada.id}`, { tipoId: null, expectedVersion: await versao() });
    assert(corrige.status === 200 && (await dia()).blocos.find((b) => b.rotulo === "REVISAR FIGURINO")?.tipoId === null, "dá para tirar o tipo da atividade só de hoje");

    // ── Registro ──
    const acoes = (await db.select().from(historyEventsTable).where(eq(historyEventsTable.orgId, org!.id))).map((e) => e.action);
    for (const a of ["tipo.padrao_criado", "tipo.criado", "tipo.alterado", "tipo.arquivado", "tipo.desarquivado"]) assert(acoes.includes(a), `o Registro tem o evento ${a}`);
  } finally {
    if (server) { server.closeAllConnections?.(); await new Promise<void>((resolve) => server!.close(() => resolve())); }
    const ids = todos.map((u) => u.id);
    await db.delete(historyEventsTable).where(or(eq(historyEventsTable.orgId, org!.id), inArray(historyEventsTable.actorId, ids)));
    await pool.query(`delete from notification_outbox where user_id = any($1::uuid[])`, [ids]);
    await pool.query(`delete from user_notifications where user_id = any($1::uuid[])`, [ids]);
    await pool.query(`delete from notifications where user_id = any($1::uuid[])`, [ids]);
    const escalas = await db.select({ id: scalesTable.id }).from(scalesTable).where(eq(scalesTable.operationId, operation!.id));
    if (escalas.length) await db.delete(scaleAllocationsTable).where(inArray(scaleAllocationsTable.scaleId, escalas.map((s) => s.id)));
    await db.delete(scalesTable).where(eq(scalesTable.operationId, operation!.id));
    const progs = await db.select({ id: programacoesTable.id }).from(programacoesTable).where(inArray(programacoesTable.locationId, [local!.id, outroLocal!.id]));
    if (progs.length) await db.delete(programacaoBlocosTable).where(inArray(programacaoBlocosTable.programacaoId, progs.map((p) => p.id)));
    await db.delete(programacoesTable).where(inArray(programacoesTable.locationId, [local!.id, outroLocal!.id]));
    await db.delete(escalaTiposTable).where(eq(escalaTiposTable.organizationId, org!.id));
    await db.delete(areaLocalSupervisorsTable).where(eq(areaLocalSupervisorsTable.locationId, local!.id));
    await db.delete(userRolesTable).where(eq(userRolesTable.operationId, operation!.id));
    await db.delete(usersTable).where(inArray(usersTable.id, ids));
    await db.delete(areasTable).where(eq(areasTable.id, area!.id));
    await db.delete(operationLocationsTable).where(inArray(operationLocationsTable.locationId, [local!.id, outroLocal!.id]));
    await db.delete(locationsTable).where(inArray(locationsTable.id, [local!.id, outroLocal!.id]));
    await db.delete(operationsTable).where(eq(operationsTable.id, operation!.id));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, org!.id));
  }
  if (failures.length > 0) throw new Error(`${failures.length} falha(s) em escala-tipos`);
  process.stdout.write(`escala-tipos: ${passed} asserts passed\n`);
}

process.stdout.write("escala-tipos: starting\n");
try {
  await run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
