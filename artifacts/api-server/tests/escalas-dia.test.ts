/** 15 Escalas — Programação, Escala do dia por local, áreas prontas, publicação e as duas ligações com a 14 — contra PostgreSQL real de teste. */
import http from "node:http";
import { and, eq, inArray, or } from "drizzle-orm";
import {
  agendaEventsTable,
  areaLocalSupervisorsTable,
  areasTable,
  dailyBookAssignmentsTable,
  dailyBookBlocksTable,
  dailyBookPositionsTable,
  dailyBookScenesTable,
  dailyBooksTable,
  db,
  escalaAreasProntasTable,
  escalaBlocoAjustesTable,
  folgasTable,
  historyEventsTable,
  locationsTable,
  operationLocationsTable,
  operationalChangesTable,
  operationsTable,
  organizationsTable,
  pool,
  programacaoBlocosTable,
  programacoesTable,
  scaleAllocationsTable,
  scalesTable,
  showBookBlocksTable,
  showBookLinesTable,
  showBookRolesTable,
  showBookScenesTable,
  showBooksTable,
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

type Bloco = { key: string; rotulo: string; inicio: string; pessoaIds: string[]; vazio: boolean; sinal: string | null; origem: string; dailyBookId: string | null };
type Dia = { escala: { id: string; status: string; version: number; alteradaDesde: string | null } | null; areas: { id: string; name: string; pronta: unknown }[]; pessoas: { id: string; folga: string | null }[]; blocos: Bloco[] };

async function run() {
  const tag = `escalas_${Date.now()}`;
  const date = "2026-10-05"; // segunda-feira → weekday 1
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [operation] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const [local] = await db.insert(locationsTable).values({ organizationId: org!.id, name: `${tag}_Snowland` }).returning();
  await db.insert(operationLocationsTable).values({ operationId: operation!.id, locationId: local!.id });
  const [patinadores, bailarinos, producao] = await db.insert(areasTable).values([
    { organizationId: org!.id, name: `${tag}_Patinadores` }, { organizationId: org!.id, name: `${tag}_Bailarinos` }, { organizationId: org!.id, name: `${tag}_Produção` },
  ]).returning();
  const mk = async (suffix: string, areaId: string | null, located = true) => (await db.insert(usersTable).values({
    organizationId: org!.id, name: `${tag}_${suffix}`, username: `${tag}_${suffix}`, areaId, defaultLocationId: located ? local!.id : null,
  }).returning())[0]!;
  const admin = await mk("admin", null, false);
  const dir = await mk("dir", null, false);
  const supPat = await mk("deborah", patinadores!.id);
  const supBai = await mk("victor", bailarinos!.id);
  const pat1 = await mk("julia", patinadores!.id);
  const pat2 = await mk("carol", patinadores!.id);
  const bai1 = await mk("louis", bailarinos!.id);
  const prod1 = await mk("maico", producao!.id);
  const everyone = [admin, dir, supPat, supBai, pat1, pat2, bai1, prod1];
  await db.insert(userRolesTable).values([
    { userId: admin.id, operationId: operation!.id, role: "ADMIN", active: true },
    { userId: dir.id, operationId: operation!.id, role: "DIR", active: true },
    { userId: supPat.id, operationId: operation!.id, role: "SUPERVISOR_A", active: true },
    { userId: supBai.id, operationId: operation!.id, role: "SUPERVISOR_A", active: true },
    ...[pat1, pat2, bai1, prod1].map((u) => ({ userId: u.id, operationId: operation!.id, role: "MEMBER" as const, active: true })),
  ]);
  await db.insert(areaLocalSupervisorsTable).values([
    { areaId: patinadores!.id, locationId: local!.id, supervisorId: supPat.id },
    { areaId: bailarinos!.id, locationId: local!.id, supervisorId: supBai.id },
  ]);
  await db.insert(folgasTable).values({ userId: pat2.id, operationId: operation!.id, type: "DAY_OFF", startDate: date, endDate: date, createdBy: admin.id });

  // Show do local com uma posição fixa em Julia — o Livro do Dia dele convoca Julia.
  const [show] = await db.insert(showBooksTable).values({ operationId: operation!.id, locationId: local!.id, title: `${tag}_Show Patinação`, createdBy: admin.id }).returning();
  const [scene] = await db.insert(showBookScenesTable).values({ showBookId: show!.id, name: "Abertura", order: 0 }).returning();
  const [block] = await db.insert(showBookBlocksTable).values({ showBookId: show!.id, sceneId: scene!.id, name: "Backstage left", zone: "BACKSTAGE LEFT", order: 0 }).returning();
  const [role] = await db.insert(showBookRolesTable).values({ showBookId: show!.id, blockId: block!.id, name: "BL 01", order: 0 }).returning();
  await db.insert(showBookLinesTable).values({ positionId: role!.id, type: "FIXED_PERSON", config: { userId: pat1.id }, order: 0 });

  let server: http.Server | null = null;
  try {
    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("servidor de teste não iniciou");
    const base = `http://127.0.0.1:${address.port}/api`;
    const as = (userId: string, role: string) => {
      const token = signAccessToken({ sub: userId, jti: `${tag}_${userId}`, organizationId: org!.id, role, operationIds: [operation!.id] });
      return (path: string, init: RequestInit = {}) => fetch(`${base}${path}`, { signal: AbortSignal.timeout(60_000), ...init, headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(init.headers ?? {}) } });
    };
    const asAdmin = as(admin.id, "ADMIN"), asDir = as(dir.id, "DIR"), asPat = as(supPat.id, "SUPERVISOR_A"), asBai = as(supBai.id, "SUPERVISOR_A"), asJulia = as(pat1.id, "MEMBER"), asCarol = as(pat2.id, "MEMBER");
    const post = (fn: typeof asAdmin, path: string, body: unknown) => fn(path, { method: "POST", body: JSON.stringify(body) });
    const dia = async (fn = asAdmin) => ((await (await fn(`/escalas/dia?locationId=${local!.id}&date=${date}`)).json()) as { dia: Dia }).dia;
    const bloco = (d: Dia, rotulo: string) => d.blocos.find((b) => b.rotulo === rotulo);

    // ---------- Programação ----------
    const noProg = await post(asJulia, "/programacoes", { locationId: local!.id, nome: "Natal", vigenciaInicio: "2026-10-01", vigenciaFim: "2026-10-31" });
    assert(noProg.status === 403, "Elenco não cria Programação");
    const progRes = await post(asBai, "/programacoes", { locationId: local!.id, nome: "Natal", vigenciaInicio: "2026-10-01", vigenciaFim: "2026-10-31" });
    const prog = ((await progRes.json()) as { programacao: { id: string } }).programacao;
    assert(progRes.status === 201, "Supervisão do local cria a Programação (molde) com vigência");
    const badRegra = await post(asAdmin, `/programacoes/${prog.id}/blocos`, { weekday: 1, inicio: "09:40", rotulo: "X", regra: "qualquer" });
    const livroSemShow = await post(asAdmin, `/programacoes/${prog.id}/blocos`, { weekday: 1, inicio: "14:00", rotulo: "SHOW PATINAÇÃO", regra: "livro" });
    const fimAntes = await post(asAdmin, `/programacoes/${prog.id}/blocos`, { weekday: 1, inicio: "11:00", fim: "10:00", rotulo: "X", regra: "todos" });
    assert(badRegra.status === 400 && livroSemShow.status === 400 && fimAntes.status === 400, "bloco com regra inválida, show→Livro sem show ou fim antes do início é recusado");
    const blocos = [
      { weekday: 1, inicio: "09:40", fim: "11:00", rotulo: "TREINO GELO", regra: "area", areaIds: [patinadores!.id] },
      { weekday: 1, inicio: "10:00", fim: "11:00", rotulo: "ENSAIO", regra: "area", areaIds: [bailarinos!.id] },
      { weekday: 1, inicio: "14:00", rotulo: "SHOW PATINAÇÃO", regra: "livro", showBookId: show!.id },
      { weekday: 1, inicio: "14:30", rotulo: "PRODUÇÃO", regra: "area", areaIds: [producao!.id] },
      { weekday: 1, inicio: "16:00", fim: "17:00", rotulo: "ADM", regra: "pessoas", pessoaIds: [] },
      { weekday: 2, inicio: "09:40", fim: "11:00", rotulo: "TREINO GELO", regra: "area", areaIds: [patinadores!.id] },
    ];
    let created = 0;
    for (const b of blocos) created += (await post(asAdmin, `/programacoes/${prog.id}/blocos`, b)).status === 201 ? 1 : 0;
    assert(created === blocos.length, "Administração cria os blocos com a regra de quem entra");
    const progEvents = await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.entityId, prog.id), inArray(historyEventsTable.action, ["programacao.criada", "programacao.bloco_criado"])));
    assert(progEvents.length === 1 + blocos.length, "cada escrita da Programação grava Registro");

    // Bloco que repete em vários dias da semana, e bloco tirado do molde que pode voltar.
    const varios = await post(asAdmin, `/programacoes/${prog.id}/blocos`, { weekdays: [3, 4, 5], inicio: "08:30", fim: "09:00", rotulo: "AQUECIMENTO", regra: "todos" });
    const variosBody = (await varios.json()) as { blocos: { id: string; weekday: number }[] };
    assert(varios.status === 201 && variosBody.blocos.length === 3 && variosBody.blocos.map((b) => b.weekday).join(",") === "3,4,5", "um bloco criado em três dias da semana de uma vez");
    const tirado = variosBody.blocos[0]!;
    const desativar = await asAdmin(`/programacoes/${prog.id}/blocos/${tirado.id}`, { method: "PATCH", body: JSON.stringify({ active: false }) });
    const listaProg = async () => ((await (await asAdmin(`/programacoes?locationId=${local!.id}`)).json()) as { programacoes: { id: string; blocos: { id: string; active: boolean }[] }[] }).programacoes.flatMap((p) => p.blocos);
    const depoisDeTirar = (await listaProg()).find((b) => b.id === tirado.id);
    assert(desativar.status === 200 && Boolean(depoisDeTirar) && depoisDeTirar!.active === false, "bloco tirado do molde continua na lista, inativo, para poder voltar");
    await asAdmin(`/programacoes/${prog.id}/blocos/${tirado.id}`, { method: "PATCH", body: JSON.stringify({ active: true }) });
    assert((await listaProg()).find((b) => b.id === tirado.id)?.active === true, "bloco devolvido ao molde volta a valer");
    for (const b of variosBody.blocos) await asAdmin(`/programacoes/${prog.id}/blocos/${b.id}`, { method: "PATCH", body: JSON.stringify({ active: false }) });

    // Temporada nova a partir do molde atual.
    const copia = await post(asAdmin, "/programacoes", { locationId: local!.id, nome: "Natal (cópia)", vigenciaInicio: "2026-12-01", vigenciaFim: "2026-12-31", copiarDeId: prog.id });
    const copiaBody = (await copia.json()) as { programacao: { id: string; blocos: unknown[] } };
    assert(copia.status === 201 && copiaBody.programacao.blocos.length === blocos.length, "duplicar o molde traz os blocos ativos para a nova vigência");
    await asAdmin(`/programacoes/${copiaBody.programacao.id}`, { method: "PATCH", body: JSON.stringify({ active: false }) });

    // ---------- Escala do dia montada pelas regras ----------
    assert((await asJulia(`/escalas/dia?locationId=${local!.id}&date=${date}`)).status === 403, "Elenco não abre a grade do local");
    assert((await asDir(`/escalas/dia?locationId=${local!.id}&date=${date}`)).status === 200, "Direção lê a Escala do dia");
    const d0 = await dia(asPat);
    assert(d0.escala === null && d0.areas.length === 3 && d0.areas.every((a) => !a.pronta), "antes de qualquer marca: sem escala criada, 3 áreas, nenhuma pronta");
    assert(d0.blocos.filter((b) => b.origem === "programacao").length === 5, "só os blocos do dia da semana entram (segunda: 5 de 6)");
    const treino = bloco(d0, "TREINO GELO")?.pessoaIds ?? [];
    assert(treino.length === 2 && treino.includes(pat1.id) && treino.includes(supPat.id) && !treino.includes(pat2.id), "TREINO GELO → Patinadores (a supervisora também patina), sem quem está de folga (folga vence tudo)");
    assert(bloco(d0, "ENSAIO")?.pessoaIds.includes(bai1.id) === true && bloco(d0, "PRODUÇÃO")?.pessoaIds.includes(prod1.id) === true, "ENSAIO → Bailarinos; coluna da Produção → PRODUÇÃO");
    assert(bloco(d0, "ADM")?.vazio === true && Boolean(bloco(d0, "ADM")?.sinal), "bloco sem regra clara fica vazio e sinalizado");
    assert(bloco(d0, "SHOW PATINAÇÃO")?.vazio === true && (bloco(d0, "SHOW PATINAÇÃO")?.sinal ?? "").includes("não gerado"), "show→Livro sem Livro do Dia gerado fica vazio e sinalizado");
    assert(d0.pessoas.find((p) => p.id === pat2.id)?.folga === "DAY_OFF", "a folga aparece na pessoa");

    // Gerar o dia materializa a Escala e todos os Livros dos Shows programados
    // em rascunho. A Programação só informa show+horário; posições vêm do Livro
    // do Show, e nenhum membro é convocado nesta etapa.
    assert((await post(asPat, "/escalas/dia/gerar", { locationId: local!.id, date })).status === 403, "Supervisão não gera o dia operacional");
    assert((await post(asJulia, "/escalas/dia/gerar", { locationId: local!.id, date })).status === 403, "Elenco não gera o dia operacional");
    assert((await fetch(`${base}/escalas/dia/gerar`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ locationId: local!.id, date }) })).status === 401, "gerar o dia sem autenticação é recusado");
    const gen = await post(asAdmin, "/escalas/dia/gerar", { locationId: local!.id, date });
    const genBody = (await gen.json()) as { escala: { id: string; status: string }; livros: { id: string; generated: boolean }[] };
    const bookId = genBody.livros[0]!.id;
    const d1 = await dia();
    assert(gen.status === 201 && genBody.escala.status === "DRAFT" && genBody.livros.length === 1 && genBody.livros[0]!.generated, "gerar a Escala cria o Livro do Dia do Show programado como rascunho");
    assert(JSON.stringify(bloco(d1, "SHOW PATINAÇÃO")?.pessoaIds) === JSON.stringify([pat1.id]) && bloco(d1, "SHOW PATINAÇÃO")?.dailyBookId === bookId, "bloco de show lê o elenco do Livro do Dia daquele show");
    const repeatGen = await post(asAdmin, "/escalas/dia/gerar", { locationId: local!.id, date });
    const repeatBody = (await repeatGen.json()) as { livros: { generated: boolean }[] };
    assert(repeatGen.status === 201 && repeatBody.livros.length === 1 && !repeatBody.livros[0]!.generated && (await db.select().from(dailyBooksTable).where(eq(dailyBooksTable.showBookId, show!.id))).length === 1, "gerar o mesmo dia de novo reutiliza o rascunho e não apaga ajustes nem duplica Livro");

    // ---------- Ligação 1: o Livro só publica depois da Escala publicada ----------
    const readBook = async () => (await db.select().from(dailyBooksTable).where(eq(dailyBooksTable.id, bookId)).limit(1))[0]!;
    const blocked = await post(asAdmin, `/daily-book/${bookId}/publish`, { expectedVersion: (await readBook()).version });
    assert(blocked.status === 409 && ((await blocked.json()) as { error: string }).error === "ESCALA_NAO_PUBLICADA", "Livro do Dia não publica sem a Escala do dia publicada");
    assert((await readBook()).status === "DRAFT", "tentativa recusada não muda o Livro");

    // ---------- Áreas prontas ----------
    const other = await post(asPat, "/escalas/dia/pronta", { locationId: local!.id, date, areaId: bailarinos!.id, pronta: true });
    assert(other.status === 403, "Supervisão não marca a área de outra supervisão");
    const mine = await post(asPat, "/escalas/dia/pronta", { locationId: local!.id, date, areaId: patinadores!.id, pronta: true });
    const afterMine = ((await mine.json()) as { dia: Dia }).dia;
    assert(mine.status === 200 && afterMine.escala?.status === "DRAFT" && afterMine.areas.find((a) => a.id === patinadores!.id)?.pronta != null, "Supervisão marca a parte da área dela como pronta (a Escala do dia nasce em rascunho)");
    const scaleId = afterMine.escala!.id;
    const [created1] = await db.select().from(scalesTable).where(eq(scalesTable.id, scaleId));
    assert(created1?.locationId === local!.id && created1.periodStart === date && created1.periodEnd === date, "uma Escala por local e dia");
    assert((await post(asPat, `/escalas/${scaleId}/publicar`, { expectedVersion: 1 })).status === 403, "Supervisão não publica o dia — é a Administração");
    const pending = await post(asAdmin, `/escalas/${scaleId}/publicar`, { expectedVersion: 1 });
    const pendingBody = (await pending.json()) as { error: string; faltam: string[] };
    assert(pending.status === 409 && pendingBody.error === "AREAS_PENDENTES" && pendingBody.faltam.length === 2, "Administração não publica com áreas faltando, e a resposta diz quais");
    await post(asBai, "/escalas/dia/pronta", { locationId: local!.id, date, areaId: bailarinos!.id, pronta: true });
    await post(asAdmin, "/escalas/dia/pronta", { locationId: local!.id, date, areaId: producao!.id, pronta: true });
    const unmark = await post(asPat, "/escalas/dia/pronta", { locationId: local!.id, date, areaId: patinadores!.id, pronta: false });
    assert(unmark.status === 200 && (await db.select().from(escalaAreasProntasTable).where(and(eq(escalaAreasProntasTable.scaleId, scaleId), eq(escalaAreasProntasTable.areaId, patinadores!.id)))).some((r) => !r.active && r.unmarkedBy === supPat.id), "desmarcar não apaga: a linha fica inativa com quem desmarcou");
    await post(asPat, "/escalas/dia/pronta", { locationId: local!.id, date, areaId: patinadores!.id, pronta: true });
    const readyEvents = await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.entityId, scaleId), inArray(historyEventsTable.action, ["escala.area_pronta", "escala.area_desmarcada"])));
    assert(readyEvents.length === 5, "cada marca e desmarca grava Registro");

    // ---------- Minha escala antes de publicar ----------
    const minhaAntes = (await (await asJulia(`/escalas/minha?date=${date}`)).json()) as { publicada: boolean; blocos: unknown[] };
    assert(minhaAntes.publicada === false && minhaAntes.blocos.length === 0, "Elenco não vê a escala antes de publicada");

    // ---------- Publicar o dia ----------
    assert((await post(asAdmin, `/escalas/${scaleId}/publicar`, { expectedVersion: 99 })).status === 409, "publicar com versão velha é recusado (409)");
    const pub = await post(asAdmin, `/escalas/${scaleId}/publicar`, { expectedVersion: 1 });
    assert(pub.status === 200 && ((await pub.json()) as { escala: { status: string } }).escala.status === "PUBLISHED", "Administração publica o dia com todas as áreas prontas");
    assert((await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.entityId, scaleId), eq(historyEventsTable.action, "escala.publicada")))).length === 1, "publicar grava Registro");
    assert((await readBook()).status === "PUBLISHED", "publicar a Escala publica junto o Livro do Dia em rascunho");
    assert((await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.entityId, bookId), eq(historyEventsTable.action, "published")))).length === 1, "publicação conjunta grava Registro também no Livro do Dia");

    const minha = (await (await asJulia(`/escalas/minha?date=${date}`)).json()) as { publicada: boolean; confirmada?: boolean; blocos: { rotulo: string }[] };
    assert(minha.publicada && minha.blocos.some((b) => b.rotulo === "TREINO GELO") && minha.blocos.some((b) => b.rotulo === "SHOW PATINAÇÃO"), "Minha escala: Julia vê só os blocos dela (treino e show)");
    assert(!minha.blocos.some((b) => b.rotulo === "ENSAIO"), "Minha escala não mostra bloco de outra área");
    const carol = (await (await asCarol(`/escalas/minha?date=${date}`)).json()) as { folga: string | null; blocos: unknown[] };
    assert(carol.folga === "DAY_OFF" && carol.blocos.length === 0, "quem está de folga vê a folga e nenhum bloco");

    // Ajuste é uma exceção só deste dia: SUP só mexe em pessoa da própria área; o molde não muda.
    const treinoKey = bloco(await dia(), "TREINO GELO")!.key;
    const outsideScope = await post(asPat, "/escalas/dia/ajustes", { locationId: local!.id, date, sourceKey: treinoKey, userId: bai1.id, action: "ADICIONAR" });
    assert(outsideScope.status === 403, "Supervisão não ajusta pessoa de outra área na célula");
    const removedFromCell = await post(asPat, "/escalas/dia/ajustes", { locationId: local!.id, date, sourceKey: treinoKey, userId: pat1.id, action: "REMOVER" });
    assert(removedFromCell.status === 200 && !(bloco(await dia(), "TREINO GELO")?.pessoaIds ?? []).includes(pat1.id), "Supervisão tira uma pessoa do bloco só neste dia");
    const addedBack = await post(asPat, "/escalas/dia/ajustes", { locationId: local!.id, date, sourceKey: treinoKey, userId: pat1.id, action: "ADICIONAR" });
    assert(addedBack.status === 200 && (bloco(await dia(), "TREINO GELO")?.pessoaIds ?? []).includes(pat1.id), "Supervisão põe a pessoa de volta no bloco sem alterar a Programação");
    assert((await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.entityId, scaleId), inArray(historyEventsTable.action, ["escala.pessoa_adicionada", "escala.pessoa_removida"])))) .length === 2, "cada ajuste de célula grava Registro");

    // Várias pessoas num pedido só: a supervisão tira uma e põe outra na mesma chamada.
    const lote = await post(asPat, "/escalas/dia/ajustes", { locationId: local!.id, date, sourceKey: treinoKey, mudancas: [
      { userId: pat1.id, action: "REMOVER" }, { userId: supPat.id, action: "REMOVER" },
    ] });
    const depoisDoLote = bloco(await dia(), "TREINO GELO")?.pessoaIds ?? [];
    assert(lote.status === 200 && !depoisDoLote.includes(pat1.id) && !depoisDoLote.includes(supPat.id), "um pedido só tira duas pessoas do bloco");
    const loteErrado = await post(asPat, "/escalas/dia/ajustes", { locationId: local!.id, date, sourceKey: treinoKey, mudancas: [
      { userId: pat1.id, action: "ADICIONAR" }, { userId: bai1.id, action: "ADICIONAR" },
    ] });
    assert(loteErrado.status === 403 && (bloco(await dia(), "TREINO GELO")?.pessoaIds ?? []).includes(pat1.id), "no lote, pessoa de outra área é recusada — o que já passou antes dela vale");
    await post(asPat, "/escalas/dia/ajustes", { locationId: local!.id, date, sourceKey: treinoKey, mudancas: [{ userId: supPat.id, action: "ADICIONAR" }] });

    // ---------- Chamar alguém na folga: exceção com motivo, e a folga fica para decidir ----------
    const semMotivo = await post(asPat, "/escalas/dia/ajustes", { locationId: local!.id, date, sourceKey: treinoKey, userId: pat2.id, action: "ADICIONAR" });
    assert(semMotivo.status === 409 && ((await semMotivo.json()) as { error: string }).error === "PESSOA_DE_FOLGA" && !(bloco(await dia(), "TREINO GELO")?.pessoaIds ?? []).includes(pat2.id), "chamar quem está de folga sem motivo é recusado e a pessoa continua fora");
    const comMotivo = await post(asPat, "/escalas/dia/ajustes", { locationId: local!.id, date, sourceKey: treinoKey, userId: pat2.id, action: "ADICIONAR", motivo: "Faltou gente no treino" });
    const diaFolga = await dia();
    const chamada = diaFolga.pessoas.find((p) => p.id === pat2.id)?.chamadaNaFolga;
    assert(comMotivo.status === 200 && (bloco(diaFolga, "TREINO GELO")?.pessoaIds ?? []).includes(pat2.id), "com motivo escrito, a pessoa de folga entra no bloco");
    assert(chamada?.motivo === "Faltou gente no treino" && chamada.decidida === false, "a grade mostra o motivo e a folga fica pendente de decisão");
    assert((await db.select().from(escalaBlocoAjustesTable).where(and(eq(escalaBlocoAjustesTable.scaleId, scaleId), eq(escalaBlocoAjustesTable.userId, pat2.id), eq(escalaBlocoAjustesTable.active, true)))).some((a) => a.mesmoDeFolga && a.motivo === "Faltou gente no treino"), "o ajuste guarda a marca de chamada na folga e o motivo");
    assert((await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.entityId, scaleId), eq(historyEventsTable.action, "escala.pessoa_adicionada")))).some((e) => (e.narrative ?? "").includes("chamada mesmo assim")), "o Registro conta que ela estava de folga e por que foi chamada");
    const resolvePorFora = await post(asJulia, "/escalas/dia/folga-resolvida", { locationId: local!.id, date, userId: pat2.id });
    assert(resolvePorFora.status === 403, "Elenco não resolve a folga de ninguém");
    const resolve = await post(asPat, "/escalas/dia/folga-resolvida", { locationId: local!.id, date, userId: pat2.id });
    assert(resolve.status === 200 && (await dia()).pessoas.find((p) => p.id === pat2.id)?.chamadaNaFolga?.decidida === true, "Supervisão marca a folga como resolvida e a pendência some");
    await post(asPat, "/escalas/dia/ajustes", { locationId: local!.id, date, sourceKey: treinoKey, userId: pat2.id, action: "REMOVER" });
    assert(!(bloco(await dia(), "TREINO GELO")?.pessoaIds ?? []).includes(pat2.id), "tirada do bloco, ela volta a ficar de folga");

    const confirm = await post(asJulia, `/escalas/${scaleId}/confirmar`, {});
    const minhaConfirmada = (await (await asJulia(`/escalas/minha?date=${date}`)).json()) as { confirmada?: boolean };
    assert(confirm.status === 200 && minhaConfirmada.confirmada === true, "Elenco confirma a própria Escala publicada");
    assert((await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.entityId, scaleId), eq(historyEventsTable.action, "escala.confirmada")))).length === 1, "confirmação da Escala grava Registro");

    // ---------- Ligação 2: tirar alguém do Livro tira o bloco da Escala ----------
    const [position] = await db.select().from(dailyBookPositionsTable).where(eq(dailyBookPositionsTable.dailyBookId, bookId));
    const removed = await asAdmin(`/daily-book/${bookId}/positions/${position!.id}`, { method: "DELETE", body: JSON.stringify({ expectedVersion: (await readBook()).version }) });
    const d2 = await dia();
    assert(removed.status === 200 && !(bloco(d2, "SHOW PATINAÇÃO")?.pessoaIds ?? []).includes(pat1.id), "tirar Julia do Livro tira o bloco do show dela da Escala");
    assert(bloco(d2, "TREINO GELO")?.pessoaIds.includes(pat1.id) === true, "os outros blocos dela continuam");
    assert(d2.escala?.alteradaDesde != null, "Escala publicada fica marcada como alterada pelo Livro (pede republicação)");
    assert((await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.entityId, scaleId), eq(historyEventsTable.action, "escala.alterada_pelo_livro")))).length === 1, "a alteração pelo Livro grava Registro na Escala");
    const minha2 = (await (await asJulia(`/escalas/minha?date=${date}`)).json()) as { blocos: { rotulo: string }[] };
    assert(minha2.blocos.some((b) => b.rotulo === "SHOW PATINAÇÃO"), "versão publicada preservada: Julia continua vendo o show até a Administração republicar");
    const restored = await asAdmin(`/daily-book/${bookId}/positions/${position!.id}/restore`, { method: "PATCH", body: JSON.stringify({ expectedVersion: (await readBook()).version }) });
    assert(restored.status === 200 && (bloco(await dia(), "SHOW PATINAÇÃO")?.pessoaIds ?? []).includes(pat1.id), "restaurar a posição no Livro devolve o bloco à Escala");

    // ---------- Ligação 3: trocar alguém na Escala troca a vaga no Livro ----------
    const showKey = bloco(await dia(), "SHOW PATINAÇÃO")!.key;
    const vivas = async () => (await db.select().from(dailyBookAssignmentsTable).where(eq(dailyBookAssignmentsTable.dailyBookId, bookId))).filter((a) => !a.supersededAt && a.status !== "REMOVED");
    const ajustesDoShow = async () => (await db.select().from(escalaBlocoAjustesTable).where(and(eq(escalaBlocoAjustesTable.scaleId, scaleId), eq(escalaBlocoAjustesTable.sourceKey, showKey))));
    const tiraJulia = await post(asPat, "/escalas/dia/ajustes", { locationId: local!.id, date, sourceKey: showKey, userId: pat1.id, action: "REMOVER" });
    const vagaAberta = await vivas();
    assert(tiraJulia.status === 200 && !(bloco(await dia(), "SHOW PATINAÇÃO")?.pessoaIds ?? []).includes(pat1.id), "tirar Julia do show na Escala tira ela do bloco");
    assert(vagaAberta.length === 1 && vagaAberta[0]!.userId === null && vagaAberta[0]!.status === "OPEN", "a vaga dela no Livro do Dia fica aberta");
    assert((await ajustesDoShow()).length === 0, "a troca vai para o Livro, sem ajuste paralelo só na Escala");
    const poeDeborah = await post(asPat, "/escalas/dia/ajustes", { locationId: local!.id, date, sourceKey: showKey, userId: supPat.id, action: "ADICIONAR" });
    const preenchida = await vivas();
    assert(poeDeborah.status === 200 && JSON.stringify(bloco(await dia(), "SHOW PATINAÇÃO")?.pessoaIds) === JSON.stringify([supPat.id]), "pôr Deborah no show na Escala põe ela no bloco");
    assert(preenchida.length === 1 && preenchida[0]!.userId === supPat.id && preenchida[0]!.status === "ASSIGNED", "Deborah ocupa a vaga aberta no Livro do Dia");
    const extra = await post(asAdmin, "/escalas/dia/ajustes", { locationId: local!.id, date, sourceKey: showKey, userId: bai1.id, action: "ADICIONAR" });
    assert(extra.status === 200 && (bloco(await dia(), "SHOW PATINAÇÃO")?.pessoaIds ?? []).includes(bai1.id), "sem vaga aberta, a pessoa entra como extra no bloco da Escala");
    assert(!(await vivas()).some((a) => a.userId === bai1.id) && (await ajustesDoShow()).some((a) => a.active && a.userId === bai1.id), "o extra fica só na Escala e não inventa vaga no Livro");
    assert((await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.entityId, bookId), eq(historyEventsTable.action, "assignment_swap")))).length === 2, "cada troca no Livro pela Escala grava Registro no Livro");
    await post(asAdmin, "/escalas/dia/ajustes", { locationId: local!.id, date, sourceKey: showKey, userId: bai1.id, action: "REMOVER" });
    await post(asPat, "/escalas/dia/ajustes", { locationId: local!.id, date, sourceKey: showKey, userId: supPat.id, action: "REMOVER" });
    await post(asPat, "/escalas/dia/ajustes", { locationId: local!.id, date, sourceKey: showKey, userId: pat1.id, action: "ADICIONAR" });
    assert(JSON.stringify(bloco(await dia(), "SHOW PATINAÇÃO")?.pessoaIds) === JSON.stringify([pat1.id]), "desfazer as trocas devolve Julia ao show");

    // Republicar limpa a marca.
    const v = (await db.select().from(scalesTable).where(eq(scalesTable.id, scaleId)))[0]!.version;
    assert((await post(asPat, `/escalas/${scaleId}/republicar`, { expectedVersion: v })).status === 403, "Supervisão não republica o dia");
    const rep = await post(asAdmin, `/escalas/${scaleId}/republicar`, { expectedVersion: v });
    const [afterRep] = await db.select().from(scalesTable).where(eq(scalesTable.id, scaleId));
    assert(rep.status === 200 && afterRep?.status === "REPUBLISHED" && afterRep.alteradaDesde === null, "Administração republica e a marca de alterada some");
    assert((await readBook()).status === "REPUBLISHED", "republicação da Escala republica junto o Livro do Dia vinculado");
    assert((await post(asPat, "/escalas/dia/pronta", { locationId: local!.id, date, areaId: patinadores!.id, pronta: false })).status === 409, "depois de publicada, marcar/desmarcar área é recusado");

    // ---------- Bloco novo na Programação depois de publicar ----------
    await post(asAdmin, `/programacoes/${prog.id}/blocos`, { weekday: 1, inicio: "18:00", fim: "18:30", rotulo: "REUNIÃO EXTRA", regra: "todos" });
    const d3 = await dia();
    const minha3 = (await (await asJulia(`/escalas/minha?date=${date}`)).json()) as { blocos: { rotulo: string }[] };
    assert(Boolean(bloco(d3, "REUNIÃO EXTRA")) && d3.escala?.alteradaDesde != null, "bloco novo na Programação aparece na grade e a Escala publicada pede republicação");
    assert(!minha3.blocos.some((b) => b.rotulo === "REUNIÃO EXTRA"), "o Elenco só vê o bloco novo depois da republicação");
    const v2 = (await db.select().from(scalesTable).where(eq(scalesTable.id, scaleId)))[0]!.version;
    await post(asAdmin, `/escalas/${scaleId}/republicar`, { expectedVersion: v2 });
    const minha4 = (await (await asJulia(`/escalas/minha?date=${date}`)).json()) as { blocos: { rotulo: string }[] };
    assert(minha4.blocos.some((b) => b.rotulo === "REUNIÃO EXTRA") && (await dia()).escala?.alteradaDesde == null, "republicada, Julia recebe o bloco novo e a marca de alterada some");
  } finally {
    if (server) { server.closeAllConnections?.(); await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve())); }
    const ids = everyone.map((u) => u.id);
    const changes = await db.select({ id: operationalChangesTable.id }).from(operationalChangesTable).where(inArray(operationalChangesTable.actorId, ids));
    await db.delete(historyEventsTable).where(or(eq(historyEventsTable.orgId, org!.id), inArray(historyEventsTable.actorId, ids), inArray(historyEventsTable.moId, changes.map((c) => c.id))));
    await db.delete(operationalChangesTable).where(inArray(operationalChangesTable.actorId, ids));
    // Publicar a Escala agora enfileira o aviso de cada convocado; a fila aponta para a notificação.
    await pool.query(`delete from notification_outbox where user_id = any($1::uuid[])`, [ids]);
    await pool.query(`delete from user_notifications where user_id = any($1::uuid[])`, [ids]);
    await pool.query(`delete from notifications where user_id = any($1::uuid[])`, [ids]);
    const scales = await db.select({ id: scalesTable.id }).from(scalesTable).where(eq(scalesTable.operationId, operation!.id));
    if (scales.length) {
      await db.delete(escalaAreasProntasTable).where(inArray(escalaAreasProntasTable.scaleId, scales.map((s) => s.id)));
      await db.delete(escalaBlocoAjustesTable).where(inArray(escalaBlocoAjustesTable.scaleId, scales.map((s) => s.id)));
      await db.delete(scaleAllocationsTable).where(inArray(scaleAllocationsTable.scaleId, scales.map((s) => s.id)));
    }
    const books = await db.select({ id: dailyBooksTable.id }).from(dailyBooksTable).where(eq(dailyBooksTable.showBookId, show!.id));
    for (const { id } of books) {
      await db.delete(dailyBookAssignmentsTable).where(eq(dailyBookAssignmentsTable.dailyBookId, id));
      await db.delete(dailyBookPositionsTable).where(eq(dailyBookPositionsTable.dailyBookId, id));
      await db.delete(dailyBookBlocksTable).where(eq(dailyBookBlocksTable.dailyBookId, id));
      await db.delete(dailyBookScenesTable).where(eq(dailyBookScenesTable.dailyBookId, id));
      await db.delete(dailyBooksTable).where(eq(dailyBooksTable.id, id));
    }
    await db.delete(scalesTable).where(eq(scalesTable.operationId, operation!.id));
    const progs = await db.select({ id: programacoesTable.id }).from(programacoesTable).where(eq(programacoesTable.locationId, local!.id));
    if (progs.length) await db.delete(programacaoBlocosTable).where(inArray(programacaoBlocosTable.programacaoId, progs.map((p) => p.id)));
    await db.delete(programacoesTable).where(eq(programacoesTable.locationId, local!.id));
    await db.delete(agendaEventsTable).where(eq(agendaEventsTable.showBookId, show!.id));
    await db.delete(showBookLinesTable).where(eq(showBookLinesTable.positionId, role!.id));
    await db.delete(showBookRolesTable).where(eq(showBookRolesTable.showBookId, show!.id));
    await db.delete(showBookBlocksTable).where(eq(showBookBlocksTable.showBookId, show!.id));
    await db.delete(showBookScenesTable).where(eq(showBookScenesTable.showBookId, show!.id));
    await db.delete(showBooksTable).where(eq(showBooksTable.id, show!.id));
    await db.delete(folgasTable).where(eq(folgasTable.operationId, operation!.id));
    await db.delete(areaLocalSupervisorsTable).where(eq(areaLocalSupervisorsTable.locationId, local!.id));
    await db.delete(userRolesTable).where(eq(userRolesTable.operationId, operation!.id));
    await db.delete(usersTable).where(inArray(usersTable.id, ids));
    await db.delete(areasTable).where(inArray(areasTable.id, [patinadores!.id, bailarinos!.id, producao!.id]));
    await db.delete(operationLocationsTable).where(eq(operationLocationsTable.locationId, local!.id));
    await db.delete(locationsTable).where(eq(locationsTable.id, local!.id));
    await db.delete(operationsTable).where(eq(operationsTable.id, operation!.id));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, org!.id));
  }
  if (failures.length > 0) throw new Error(`${failures.length} falha(s) em Escalas`);
  process.stdout.write(`escalas-dia: ${passed} asserts passed\n`);
}

process.stdout.write("escalas-dia: starting\n");
try {
  await run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
