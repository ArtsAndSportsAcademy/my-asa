/** Folgas por equipe (08/10): Supervisão vê todo mundo, altera só a própria equipe e nunca a própria folga. */
import http from "node:http";
import { and, eq, inArray } from "drizzle-orm";
import {
  areaLocalSupervisorsTable,
  areasTable,
  db,
  folgasTable,
  folgaGruposTable,
  historyEventsTable,
  locationsTable,
  operationsTable,
  organizationsTable,
  pool,
  userRolesTable,
  usersTable,
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
  const tag = `folgaeq${Date.now()}`;
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [op] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const [snow, acqua] = await db.insert(locationsTable).values([
    { organizationId: org!.id, name: `${tag}_snow` }, { organizationId: org!.id, name: `${tag}_acqua` },
  ]).returning();
  const [pat, bai] = await db.insert(areasTable).values([
    { organizationId: org!.id, name: `${tag}_pat` }, { organizationId: org!.id, name: `${tag}_bai` },
  ]).returning();
  const mk = async (key: string, areaId: string | null, locationId: string | null, role: string) => {
    const [u] = await db.insert(usersTable).values({ organizationId: org!.id, name: `${tag}_${key}`, username: `${tag}${key}`, areaId, defaultLocationId: locationId }).returning();
    await db.insert(userRolesTable).values({ userId: u!.id, operationId: op!.id, role: role as never, active: true });
    return u!;
  };
  const admin = await mk("admin", null, null, "ADMIN");
  const deb = await mk("deb", pat!.id, snow!.id, "SUPERVISOR_A");
  const ju = await mk("ju", pat!.id, snow!.id, "MEMBER");          // equipe da Deb
  const semLocal = await mk("semlocal", pat!.id, null, "MEMBER");  // área dela, sem local: vale a área
  const louis = await mk("louis", bai!.id, snow!.id, "MEMBER");    // outra área
  const lela = await mk("lela", bai!.id, acqua!.id, "MEMBER");     // outra área e outro local
  const patAcqua = await mk("patacqua", pat!.id, acqua!.id, "MEMBER"); // mesma área, outro local
  const ids = [admin, deb, ju, semLocal, louis, lela, patAcqua].map((u) => u.id);
  await db.insert(areaLocalSupervisorsTable).values({ areaId: pat!.id, locationId: snow!.id, supervisorId: deb.id, active: true });

  let server: http.Server | null = null;
  try {
    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("servidor de teste não iniciou");
    const base = `http://127.0.0.1:${address.port}/api`;
    const token = (user: { id: string }, role: string) => signAccessToken({ sub: user.id, jti: `${tag}_${user.id}`, organizationId: org!.id, role, operationIds: [op!.id] });
    const asDeb = token(deb, "SUPERVISOR_A"), asAdmin = token(admin, "ADMIN"), asJu = token(ju, "MEMBER");
    const call = async (method: string, path: string, auth: string, body?: unknown) => {
      const r = await fetch(`${base}${path}`, { method, signal: AbortSignal.timeout(60_000), headers: { authorization: `Bearer ${auth}`, "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
      const text = await r.text();
      return { status: r.status, body: (text ? JSON.parse(text) : {}) as Record<string, any> };
    };
    const toggle = (auth: string, userId: string, date = "2026-10-20") => call("POST", "/folgas/grid/toggle", auth, { userId, operationId: op!.id, date, type: "DAY_OFF" });

    assert((await toggle(asDeb, ju.id)).status === 200, "Supervisão altera folga de quem é da sua área no seu local");
    assert((await toggle(asDeb, semLocal.id)).status === 200, "pessoa da área sem local de costume: vale a área");
    assert((await toggle(asDeb, louis.id)).status === 403, "outra área: recusado (403)");
    assert((await toggle(asDeb, lela.id)).status === 403, "outra área e outro local: recusado (403)");
    assert((await toggle(asDeb, patAcqua.id)).status === 403, "mesma área em outro local: recusado (403)");
    const propria = await toggle(asDeb, deb.id);
    assert(propria.status === 403 && /própria folga/.test(propria.body.message ?? ""), "a própria folga só a Administração altera");
    assert((await toggle(asAdmin, deb.id)).status === 200, "Administração altera a folga do supervisor");
    assert((await call("POST", "/folgas/grid/bulk", asDeb, { userId: lela.id, operationId: op!.id, dates: ["2026-10-21"], type: "DAY_OFF" })).status === 403, "lote para quem não é da equipe: recusado");
    assert((await call("POST", "/folgas/grid/bulk", asDeb, { userId: ju.id, operationId: op!.id, dates: ["2026-10-22"], type: "DAY_OFF" })).status === 200, "lote para a própria equipe: ok");

    // Lote de várias pessoas de uma vez: ou vale para todas, ou não escreve nada para ninguém.
    const loteMisto = await call("POST", "/folgas/grid/bulk", asDeb, { userIds: [ju.id, lela.id], operationId: op!.id, dates: ["2026-10-27"], type: "DAY_OFF" });
    assert(loteMisto.status === 403, "lote com alguém de fora da equipe: recusado inteiro");
    const sobrouAlgo = await db.select().from(folgasTable).where(and(eq(folgasTable.userId, ju.id), eq(folgasTable.startDate, "2026-10-27")));
    assert(sobrouAlgo.length === 0, "lote recusado não deixa folga escrita para quem era da equipe");
    const loteVarias = await call("POST", "/folgas/grid/bulk", asDeb, { userIds: [ju.id, semLocal.id], operationId: op!.id, dates: ["2026-10-27", "2026-10-28"], type: "DAY_OFF", motivo: "ensaio do lote" });
    assert(loteVarias.status === 200 && loteVarias.body.pessoas === 2 && loteVarias.body.dias === 2 && loteVarias.body.processed === 4, "lote de 2 pessoas × 2 dias grava as 4 marcações");
    const marcadas = await db.select().from(folgasTable).where(and(eq(folgasTable.operationId, op!.id), eq(folgasTable.startDate, "2026-10-28")));
    assert(marcadas.length === 2, "as duas pessoas ficaram com folga no dia 28");

    const [folgaLela] = await db.insert(folgasTable).values({ userId: lela.id, operationId: op!.id, type: "DAY_OFF", startDate: "2026-10-23", endDate: "2026-10-23", createdBy: admin.id }).returning();
    assert((await call("PATCH", `/folgas/${folgaLela!.id}`, asDeb, { notes: "x" })).status === 403, "editar folga de quem não é da equipe: recusado");
    assert((await call("POST", `/folgas/${folgaLela!.id}/cancelar`, asDeb, { reason: "x" })).status === 403, "cancelar folga de quem não é da equipe: recusado");

    // Grupos de folga: padrão (pessoas + dois dias), por equipe, restaurável.
    const grupoFora = await call("POST", "/folgas/grupos", asDeb, { operationId: op!.id, nome: "G com estranho", diasFolga: [1, 2], pessoaIds: [ju.id, lela.id] });
    assert(grupoFora.status === 403, "grupo com alguém de fora da equipe: recusado");
    const semGrupoFora = await db.select().from(folgaGruposTable).where(eq(folgaGruposTable.nome, "G com estranho"));
    assert(semGrupoFora.length === 0, "grupo recusado não deixa nada gravado");
    const grupoBad = await call("POST", "/folgas/grupos", asDeb, { operationId: op!.id, nome: "G", diasFolga: [7], pessoaIds: [ju.id] });
    assert(grupoBad.status === 400, "dia da semana fora de 0..6: recusado");
    const grupoOk = await call("POST", "/folgas/grupos", asDeb, { operationId: op!.id, nome: "Grupo 1 seg/ter", diasFolga: [1, 2], pessoaIds: [ju.id, semLocal.id] });
    assert(grupoOk.status === 201 && typeof grupoOk.body.id === "string", "grupo da própria equipe: criado");
    const grupoId = grupoOk.body.id as string;

    const listaDeb = await call("GET", `/folgas/grupos?operationId=${op!.id}`, asDeb);
    const g = (listaDeb.body.grupos as { id: string; diasFolga: number[]; pessoas: { id: string; name: string }[]; editavel: boolean }[]).find((x) => x.id === grupoId);
    assert(listaDeb.status === 200 && g !== undefined, "o grupo criado aparece na lista");
    assert(g!.diasFolga.join(",") === "1,2" && g!.pessoas.length === 2 && g!.pessoas.every((p) => p.name && p.name !== "—"), "lista traz os dois dias e as pessoas com nome");
    assert(g!.editavel === true, "a Supervisão pode editar o grupo da sua equipe");

    const edit = await call("PATCH", `/folgas/grupos/${grupoId}`, asDeb, { nome: "Grupo 1 — seg e ter", pessoaIds: [ju.id, semLocal.id, lela.id] });
    assert(edit.status === 403, "editar incluindo alguém de fora: recusado");
    const editOk = await call("PATCH", `/folgas/grupos/${grupoId}`, asDeb, { nome: "Grupo 1 — seg e ter", diasFolga: [1, 2] });
    assert(editOk.status === 200, "editar dentro da equipe: ok");

    const arquivar = await call("DELETE", `/folgas/grupos/${grupoId}`, asDeb);
    assert(arquivar.status === 200, "arquivar o grupo: ok");
    const listaSemArquivados = await call("GET", `/folgas/grupos?operationId=${op!.id}`, asDeb);
    assert((listaSemArquivados.body.grupos as { id: string }[]).every((x) => x.id !== grupoId), "arquivado some da lista normal");
    const listaComArquivados = await call("GET", `/folgas/grupos?operationId=${op!.id}&incluirArquivados=1`, asDeb);
    assert((listaComArquivados.body.grupos as { id: string; active: boolean }[]).some((x) => x.id === grupoId && x.active === false), "arquivado aparece quando se pede os arquivados");
    const restaurar = await call("POST", `/folgas/grupos/${grupoId}/restaurar`, asDeb);
    assert(restaurar.status === 200, "restaurar o grupo: ok");
    const [grupoRestaurado] = await db.select().from(folgaGruposTable).where(eq(folgaGruposTable.id, grupoId));
    assert(grupoRestaurado?.active === true, "o grupo voltou a ficar ativo");

    const grid = await call("GET", `/folgas/grid?operationId=${op!.id}&year=2026&month=10`, asDeb);
    const flag = (userId: string) => (grid.body.members as { userId: string; editable: boolean }[]).find((m) => m.userId === userId)?.editable;
    assert(grid.status === 200 && (grid.body.members as unknown[]).length >= 6, "Supervisão vê o mapa de todo mundo");
    assert(flag(ju.id) === true && flag(semLocal.id) === true, "a grade marca a equipe como editável");
    assert(flag(lela.id) === false && flag(louis.id) === false && flag(patAcqua.id) === false && flag(deb.id) === false, "a grade trava quem não é da equipe e a própria linha");
    const gridAdmin = await call("GET", `/folgas/grid?operationId=${op!.id}&year=2026&month=10`, asAdmin);
    assert((gridAdmin.body.members as { editable: boolean }[]).every((m) => m.editable), "Administração edita todas as linhas");

    const [folgaEntreMeses] = await db.insert(folgasTable).values({ userId: ju.id, operationId: op!.id, type: "NO_SHOW", startDate: "2026-09-29", endDate: "2026-10-02", createdBy: admin.id }).returning();
    const minhasFolgas = await call("GET", "/folgas?status=ACTIVE&dateFrom=2026-10-01&dateTo=2026-10-31", asJu);
    assert(minhasFolgas.status === 200 && (minhasFolgas.body.folgas as unknown[]).length === 0, "consulta antiga não revela folga ainda não publicada");
    const folgasDeOutraPessoa = await call("GET", `/folgas?status=ACTIVE&dateFrom=2026-10-01&dateTo=2026-10-31&userId=${lela.id}`, asJu);
    assert((folgasDeOutraPessoa.body.folgas as { userId: string }[]).every((folga) => folga.userId === ju.id), "Elenco não consulta folgas de outra pessoa pelo filtro");

    const publishedPath = "/folgas/publicadas?year=2026&month=10";
    const beforePublication = await call("GET", publishedPath, asJu);
    assert(beforePublication.status === 200 && beforePublication.body.publicada === false && beforePublication.body.folgas.length === 0, "Elenco não vê o mapa antes da publicação");
    const publish = () => call("POST", "/folgas/grid/publicar", asAdmin, { operationId: op!.id, year: 2026, month: 10 });
    assert((await publish()).status === 200, "Administração publica o mês com retrato das folgas");
    const firstSnapshot = await call("GET", publishedPath, asJu);
    assert(firstSnapshot.body.publicada === true && firstSnapshot.body.folgas.some((folga: { id: string }) => folga.id === folgaEntreMeses!.id), "Elenco lê a folga do retrato publicado, inclusive a que começou no mês anterior");
    const antigasPublicadas = await call("GET", "/folgas?status=ACTIVE&dateFrom=2026-10-01&dateTo=2026-10-31", asJu);
    assert(antigasPublicadas.body.folgas.some((folga: { id: string }) => folga.id === folgaEntreMeses!.id), "consulta antiga também respeita a publicação e a virada do mês");
    assert(firstSnapshot.body.folgas.every((folga: { userId: string }) => folga.userId === ju.id), "Retrato publicado não revela folgas de outras pessoas");
    assert((await toggle(asAdmin, ju.id, "2026-10-24")).status === 200, "gestão altera o mapa depois de publicar");
    const oldSnapshot = await call("GET", publishedPath, asJu);
    assert(!oldSnapshot.body.folgas.some((folga: { startDate: string }) => folga.startDate === "2026-10-24"), "edição não aparece ao Elenco antes da republicação");
    assert((await publish()).status === 200, "Administração republica o mês alterado");
    const newSnapshot = await call("GET", publishedPath, asJu);
    assert(newSnapshot.body.folgas.some((folga: { startDate: string }) => folga.startDate === "2026-10-24"), "republicação entrega a folga nova ao Elenco");

    // Quem é avisado: a primeira publicação é do mês inteiro, a republicação é de quem foi mexido.
    const avisos = async (tipo: string) => (await pool.query(
      `select user_id, payload->>'message' as mensagem from notification_outbox
        where user_id = any($1::uuid[]) and payload->>'type' = $2`, [ids, tipo])).rows;
    const avisosPublicacao = await avisos("folga.month_published");
    const naPrimeira = avisosPublicacao.filter((a) => /está pronto/.test(a.mensagem));
    const naRepublicacao = avisosPublicacao.filter((a) => !/está pronto/.test(a.mensagem));
    assert(naPrimeira.length === ids.length - 1 && !naPrimeira.some((a) => a.user_id === admin.id), "a primeira publicação do mês avisa a operação inteira, menos quem publicou");
    assert(naRepublicacao.length === 1 && naRepublicacao[0]!.user_id === ju.id, "a republicação avisa só quem teve a própria folga mexida");
    assert(/24\/10/.test(naRepublicacao[0]!.mensagem) && /entrou/.test(naRepublicacao[0]!.mensagem), "o aviso diz o que mudou para ela, não só que o mapa mudou");

    assert((await toggle(asAdmin, ju.id, "2026-11-05")).status === 200, "gestão prepara folga antes da primeira publicação de novembro");
    const [folgaNovembro] = await db.select().from(folgasTable).where(and(eq(folgasTable.operationId, op!.id), eq(folgasTable.startDate, "2026-11-05")));
    if (!folgaNovembro) throw new Error("folga de teste não encontrada");
    await db.insert(historyEventsTable).values({
      orgId: org!.id, category: "ABSENCE", title: "Retrato inicial de teste", narrative: "Preserva a folga anterior à primeira publicação.",
      entityType: "folga_mes", entityId: `${op!.id}:2026-11`, actorId: admin.id, operationId: op!.id,
      action: "FOLGA_MONTH_BASELINE", afterState: { folgas: [{ id: folgaNovembro.id, userId: ju.id, userName: ju.name,
        operationId: op!.id, type: folgaNovembro.type, startDate: folgaNovembro.startDate, endDate: folgaNovembro.endDate, status: "ACTIVE" }] },
    });
    const novembro = "/folgas/publicadas?year=2026&month=11";
    const retratoInicial = await call("GET", novembro, asJu);
    assert(retratoInicial.body.publicada === false && retratoInicial.body.retratoInicial === true && retratoInicial.body.folgas.some((folga: { id: string }) => folga.id === folgaNovembro.id), "retrato inicial mantém a folga visível sem dizer que o mês foi publicado");
    assert((await toggle(asAdmin, ju.id, "2026-11-06")).status === 200, "gestão altera o mapa ainda sem primeira publicação");
    const antesDaPrimeiraPublicacao = await call("GET", novembro, asJu);
    assert(!antesDaPrimeiraPublicacao.body.folgas.some((folga: { startDate: string }) => folga.startDate === "2026-11-06"), "edição após o retrato inicial espera a primeira publicação");
    assert((await call("POST", "/folgas/grid/publicar", asAdmin, { operationId: op!.id, year: 2026, month: 11 })).status === 200, "Administração faz a primeira publicação após o retrato inicial");
    const novembroPublicado = await call("GET", novembro, asJu);
    assert(novembroPublicado.body.publicada === true && novembroPublicado.body.retratoInicial === false && novembroPublicado.body.folgas.some((folga: { startDate: string }) => folga.startDate === "2026-11-06"), "primeira publicação substitui o retrato inicial pelo mapa novo");

    for (const [method, path, body] of [["POST", "/folgas/grid/publicar", { operationId: op!.id, year: 2026, month: 10 }], ["POST", "/folgas/grid/repeat", { operationId: op!.id, year: 2026, month: 11 }], ["DELETE", `/folgas/grid/reset?operationId=${op!.id}&year=2026&month=10`, { operationId: op!.id, year: 2026, month: 10 }]] as const) {
      assert((await call(method, path, asDeb, body)).status === 403, `${path.split("?")[0]} no mês inteiro é só da Administração`);
    }
  } finally {
    if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
    await pool.query(`delete from history_events where actor_id = any($1::uuid[]) or mo_id in (select id from operational_changes where actor_id = any($1::uuid[]))`, [ids]);
    await pool.query(`delete from operational_changes where actor_id = any($1::uuid[])`, [ids]);
    await pool.query(`delete from user_notifications where user_id = any($1::uuid[])`, [ids]).catch(() => undefined);
    await pool.query(`delete from notification_outbox where user_id = any($1::uuid[])`, [ids]);
    await db.delete(folgaGruposTable).where(eq(folgaGruposTable.operationId, op!.id));
    await db.delete(folgasTable).where(eq(folgasTable.operationId, op!.id));
    await db.delete(areaLocalSupervisorsTable).where(eq(areaLocalSupervisorsTable.supervisorId, deb.id));
    await db.delete(userRolesTable).where(inArray(userRolesTable.userId, ids));
    await db.delete(usersTable).where(inArray(usersTable.id, ids));
    await db.delete(areasTable).where(inArray(areasTable.id, [pat!.id, bai!.id]));
    await db.delete(locationsTable).where(inArray(locationsTable.id, [snow!.id, acqua!.id]));
    await db.delete(operationsTable).where(eq(operationsTable.id, op!.id));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, org!.id));
  }
}

await (async () => {
  try {
    await run();
  } catch (err) {
    console.error("Erro inesperado nos testes:", err);
    failures.push(`erro inesperado: ${(err as Error)?.message ?? err}`);
  } finally {
    await pool.end();
  }
  console.log(`\n${passed} asserts passaram, ${failures.length} falharam.`);
  if (failures.length) {
    console.log("FALHAS:");
    for (const failure of failures) console.log(` - ${failure}`);
    process.exit(1);
  }
})();
