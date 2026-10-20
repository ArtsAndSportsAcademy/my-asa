/**
 * Mural aberto (14/10/2026): o Elenco publica, o destino é misturável, reconhecer vale para várias
 * pessoas, o que foi publicado se edita, se remove e volta, as reações têm emoji, o Mural só mostra o
 * mês atual e o seguinte, e a Administração/Direção cadastram datas especiais.
 */
import http from "node:http";
import { and, eq, inArray, like } from "drizzle-orm";
import { announcementCommentsTable, announcementReadsTable, announcementRecipientsTable, announcementsTable, areasTable, db, historyEventsTable, muralDatasEspeciaisTable, notificationOutboxTable, operationsTable, organizationsTable, pool, userNotificationsTable, userRolesTable, usersTable } from "@workspace/db";
import app from "../src/application.js";
import { signAccessToken } from "../src/lib/jwt.service.js";
import { hojeSaoPaulo, janelaDoMural } from "../src/services/mural-janela.js";

let passed = 0; const failures: string[] = [];
const assert = (condition: boolean, label: string) => { if (condition) passed++; else { failures.push(label); console.error(`  ✗ ${label}`); } };

type Payload = { type: string; title: string; message: string; priority: string };
type FeedPost = { id: string; type: string; scope: string; body: string; title?: string | null; editedAt?: string | null; destinationLabel?: string | null; recipientNames?: string[]; canCancel: boolean; canEdit: boolean; ehMeu: boolean; reactions: { emoji: string; count: number }[]; mine?: { reaction?: string | null; confirmedAt?: string | null } | null };

async function run() {
  const tag = `mural_aberto_${Date.now()}`;
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [areaA, areaB] = await db.insert(areasTable).values([{ organizationId: org!.id, name: `${tag}_A` }, { organizationId: org!.id, name: `${tag}_B` }]).returning();
  const makeUser = async (name: string, areaId: string | null) => (await db.insert(usersTable).values({ organizationId: org!.id, name: `${tag}_${name}`, fullName: `${tag}_${name}`, username: `${tag}_${name}`, areaId, status: "ACTIVE", personStatus: "ACTIVE" }).returning())[0]!;
  const admin = await makeUser("admin", null), dir = await makeUser("dir", null), sup = await makeUser("sup", areaA!.id), mem = await makeUser("mem", areaA!.id), mem2 = await makeUser("mem2", areaA!.id), outra = await makeUser("outra", areaB!.id);
  const all = [admin, dir, sup, mem, mem2, outra];
  const [operation] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  let server: http.Server | null = null;
  try {
    await db.insert(userRolesTable).values([
      { userId: admin.id, operationId: operation!.id, role: "ADMIN", active: true },
      { userId: dir.id, operationId: operation!.id, role: "DIR", active: true },
      { userId: sup.id, operationId: operation!.id, role: "SUPERVISOR_A", active: true },
      ...[mem, mem2, outra].map(user => ({ userId: user.id, operationId: operation!.id, role: "MEMBER" as const, active: true })),
    ]);
    server = http.createServer(app); await new Promise<void>(resolve => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address(); if (!address || typeof address === "string") throw new Error("servidor não iniciou");
    const base = `http://127.0.0.1:${address.port}/api`;
    const as = (userId: string, role: string) => (path: string, init: RequestInit = {}) => fetch(`${base}${path}`, { ...init, signal: AbortSignal.timeout(60_000), headers: { authorization: `Bearer ${signAccessToken({ sub: userId, jti: `${tag}_${userId}`, organizationId: org!.id, role, operationIds: [operation!.id] })}`, "content-type": "application/json", ...(init.headers ?? {}) } });
    const adminApi = as(admin.id, "ADMIN"), dirApi = as(dir.id, "DIR"), supApi = as(sup.id, "SUPERVISOR_A"), memApi = as(mem.id, "MEMBER"), mem2Api = as(mem2.id, "MEMBER"), outraApi = as(outra.id, "MEMBER");
    type Api = typeof adminApi;
    const send = (method: string) => (api: Api, path: string, body?: unknown) => api(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });
    const post = send("POST"), patch = send("PATCH"), del = send("DELETE");
    const feedOf = async (api: Api) => ((await (await api("/communication/mural")).json()) as { posts: FeedPost[]; datasEspeciais: { nome: string; emDias: number }[] });
    const avisosDe = async (chave: string) => db.select().from(notificationOutboxTable).where(like(notificationOutboxTable.deduplicationKey, `${chave}:%`));
    const quem = (rows: { userId: string }[]) => rows.map(row => row.userId).sort().join(",");
    const ids = (...users: { id: string }[]) => users.map(user => user.id).sort().join(",");
    const publicar = async (api: Api, corpo: Record<string, unknown>) => { const r = await post(api, "/communication/mural", corpo); const j = await r.json() as { post?: { id: string }; error?: string }; return { status: r.status, id: j.post?.id ?? "", erro: j.error }; };
    const linha = async (id: string) => (await db.select().from(announcementsTable).where(eq(announcementsTable.id, id)))[0]!;

    // ── 1. O Elenco publica para a casa; a casa inteira não recebe push de publicação ──
    const casa = await publicar(memApi, { type: "POST", scope: "HOUSE", body: `${tag} oi, casa`, requiresConfirmation: true });
    assert(casa.status === 201, `Elenco publica para a casa (${casa.status}: ${casa.erro})`);
    const casaLinha = await linha(casa.id);
    assert(casaLinha.type === "POST" && casaLinha.requiresConfirmation === false, "Publicação do Elenco não pede ciente, mesmo que peçam");
    assert((await avisosDe(`mural:${casa.id}:publicado`)).length === 0, "Publicação para a casa inteira não toca o sino de ninguém");
    const feedOutra = (await feedOf(outraApi)).posts, feedMem = (await feedOf(memApi)).posts;
    assert(feedOutra.some(item => item.id === casa.id) && feedOutra.find(item => item.id === casa.id)?.canEdit === false && feedOutra.find(item => item.id === casa.id)?.canCancel === false, "Os outros veem a publicação, sem poder editar nem remover");
    assert(feedMem.find(item => item.id === casa.id)?.ehMeu === true && feedMem.find(item => item.id === casa.id)?.canEdit === true && feedMem.find(item => item.id === casa.id)?.canCancel === true, "Quem publicou pode editar e remover");
    assert((await post(memApi, "/communication/mural", { type: "NOTICE", scope: "HOUSE", body: "Aviso oficial do Elenco" })).status === 403, "Aviso oficial continua sendo da gestão");

    // ── 2. Um destino só (uma área) continua dinâmico; só quem é da área é avisado ──
    const daArea = await publicar(memApi, { type: "POST", destinos: { areaIds: [areaA!.id] }, body: `${tag} só da área A` });
    const daAreaLinha = await linha(daArea.id);
    assert(daArea.status === 201 && daAreaLinha.scope === "AREA" && daAreaLinha.areaId === areaA!.id && daAreaLinha.destinationLabel === null, "Uma área só: destino dinâmico, sem texto de destino");
    assert(quem(await avisosDe(`mural:${daArea.id}:publicado`)) === ids(sup, mem2), "Publicação para uma área avisa só a área, sem quem publicou");
    assert(!(await feedOf(outraApi)).posts.some(item => item.id === daArea.id), "Quem é de outra área não vê");

    // ── 3. Mistura (área + pessoa): vira lista de pessoas, com o texto do destino ──
    const mistura = await publicar(memApi, { type: "POST", destinos: { areaIds: [areaA!.id], pessoaIds: [outra.id] }, body: `${tag} mistura` });
    const misturaLinha = await linha(mistura.id);
    const misturaPessoas = await db.select({ userId: announcementRecipientsTable.userId }).from(announcementRecipientsTable).where(eq(announcementRecipientsTable.announcementId, mistura.id));
    assert(mistura.status === 201 && misturaLinha.scope === "PEOPLE" && misturaLinha.destinationLabel === `${tag}_A e 1 pessoa`, `Mistura vira lista de pessoas e o cartão diz para quem foi (${misturaLinha.destinationLabel})`);
    assert(quem(misturaPessoas) === ids(sup, mem2, outra), "A lista guarda a área expandida mais a pessoa, sem repetir e sem quem publicou");
    assert(quem(await avisosDe(`mural:${mistura.id}:publicado`)) === ids(sup, mem2, outra), "A mistura avisa todas essas pessoas");
    assert((await feedOf(outraApi)).posts.some(item => item.id === mistura.id), "A pessoa marcada de outra área vê");

    // ── 4. Direção age como a Administração; destinos inválidos explicam ──
    const dirAviso = await publicar(dirApi, { type: "NOTICE", destinos: { areaIds: [areaA!.id, areaB!.id] }, body: `${tag} aviso da direção`, title: "Duas áreas" });
    const dirAvisoLinha = await linha(dirAviso.id);
    assert(dirAviso.status === 201 && dirAvisoLinha.destinationLabel === `${tag}_A e ${tag}_B`, "Direção publica aviso oficial para duas áreas misturadas");
    assert(quem(await avisosDe(`mural:${dirAviso.id}:publicado`)) === ids(sup, mem, mem2, outra), "O aviso da Direção avisa as duas áreas");
    assert((await publicar(memApi, { type: "POST", destinos: {}, body: "sem destino" })).status === 400, "Sem marcar ninguém é recusado");
    assert((await publicar(memApi, { type: "POST", destinos: { areaIds: ["00000000-0000-4000-8000-000000000000"] }, body: "área estranha" })).status === 404, "Área de fora da organização é recusada");

    // ── 5. Reconhecer várias pessoas: pessoa + grupo, num post só ──
    const lote = await publicar(memApi, { type: "RECOGNITION", destinos: { pessoaIds: [sup.id], areaIds: [areaB!.id] }, reason: "Cuidado com a equipe", body: "Obrigada!" });
    const loteLinha = await linha(lote.id);
    assert(lote.status === 201 && loteLinha.scope === "HOUSE" && loteLinha.recipientId !== null, `Reconhecimento em lote é publicado (${lote.status}: ${lote.erro})`);
    assert(quem(await avisosDe(`mural:${lote.id}:publicado`)) === ids(sup, outra), "Cada pessoa reconhecida é avisada, e quem reconheceu não");
    const loteFeed = (await feedOf(mem2Api)).posts.find(item => item.id === lote.id);
    assert(Boolean(loteFeed) && JSON.stringify((loteFeed?.recipientNames ?? []).sort()) === JSON.stringify([`${tag}_outra`, `${tag}_sup`]), "O Mural mostra todas as pessoas reconhecidas, e todo mundo vê o reconhecimento");
    assert((await publicar(memApi, { type: "RECOGNITION", destinos: { casa: true }, reason: "x", body: "para a casa" })).status === 400, "Reconhecimento não vai para a casa toda");

    // ── 6. Editar ──
    const editou = await patch(memApi, `/communication/mural/${casa.id}`, { body: `${tag} oi, casa (corrigido)` });
    const editouBody = await editou.json() as { post: { body: string; editedAt: string | null } };
    assert(editou.status === 200 && editouBody.post.body.endsWith("(corrigido)") && editouBody.post.editedAt !== null, "Quem publicou edita, e o cartão passa a ter a marca de editado");
    // Revisão 4 (concorrência): quem abriu a versão antiga não apaga, em silêncio, a edição que já foi salva.
    const textoSalvo = (await linha(casa.id)).body;
    const velha = await patch(memApi, `/communication/mural/${casa.id}`, { body: `${tag} edição de quem abriu antes`, baseEditedAt: null });
    const velhaBody = await velha.json() as { message?: string; code?: string };
    assert(velha.status === 409 && velhaBody.code === "VERSAO_MUDOU" && /Nada foi salvo/.test(velhaBody.message ?? "") && (await linha(casa.id)).body === textoSalvo, "Edição sobre versão velha é recusada com frase e não apaga a edição que já estava salva");
    const emDia = await patch(memApi, `/communication/mural/${casa.id}`, { body: textoSalvo, baseEditedAt: editouBody.post.editedAt });
    assert(emDia.status === 400, "Sobre a versão que está salva, a checagem de versão passa (e a recusa é só a de 'nada mudou')");
    assert((await patch(mem2Api, `/communication/mural/${casa.id}`, { body: "invasão" })).status === 403, "Outra pessoa não edita publicação alheia");
    assert((await patch(adminApi, `/communication/mural/${casa.id}`, { body: "invasão" })).status === 403, "A Administração derruba, mas não reescreve a publicação do Elenco");
    assert((await patch(memApi, `/communication/mural/${casa.id}`, { body: "   " })).status === 400, "Texto vazio na edição é recusado");
    assert((await patch(memApi, `/communication/mural/${casa.id}`, { body: `${tag} oi, casa (corrigido)` })).status === 400, "Edição que não muda nada é recusada");
    const [antes] = await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.entityId, casa.id), eq(historyEventsTable.action, "mural.edited")));
    assert(Boolean(antes) && (antes!.beforeState as { body: string }).body === `${tag} oi, casa`, "A edição entra no Registro com o texto de antes");

    // aviso que pede ciente: edição silenciosa x pedir ciente de novo
    const oficial = await publicar(supApi, { type: "NOTICE", scope: "HOUSE", body: `${tag} aviso com ciente`, requiresConfirmation: true });
    assert((await post(memApi, `/communication/mural/${oficial.id}/ack`)).status === 200, "Elenco dá ciente");
    const silenciosa = await patch(adminApi, `/communication/mural/${oficial.id}`, { title: "Título novo" });
    assert(silenciosa.status === 200 && (await avisosDe(`mural:${oficial.id}:editado`)).length === 0, "A Administração edita o aviso oficial e a edição é silenciosa por padrão");
    const aindaCiente = (await db.select().from(announcementReadsTable).where(and(eq(announcementReadsTable.announcementId, oficial.id), eq(announcementReadsTable.userId, mem.id))))[0];
    assert(Boolean(aindaCiente?.confirmedAt), "Edição silenciosa mantém o ciente de quem já deu");
    assert((await patch(memApi, `/communication/mural/${oficial.id}`, { body: "invasão" })).status === 403, "Elenco não edita aviso oficial");
    const denovo = await patch(dirApi, `/communication/mural/${oficial.id}`, { body: `${tag} aviso com ciente (mudou o horário)`, pedirCienteDeNovo: true });
    assert(denovo.status === 200, "A Direção edita o aviso oficial como a Administração");
    const depois = (await db.select().from(announcementReadsTable).where(and(eq(announcementReadsTable.announcementId, oficial.id), eq(announcementReadsTable.userId, mem.id))))[0];
    assert(depois?.confirmedAt === null, "Pedir ciente de novo zera o ciente de todo mundo");
    const reAvisos = await avisosDe(`mural:${oficial.id}:editado`);
    assert(quem(reAvisos) === ids(admin, sup, mem, mem2, outra), `Pedir ciente de novo avisa o público e quem publicou, menos quem editou (${reAvisos.length} avisos)`);
    assert((reAvisos[0]?.payload as Payload | undefined)?.type === "notice.requires_ack", "O aviso de ciente novo sai como alerta");

    // ── 7. Remover e trazer de volta ──
    assert((await post(outraApi, `/communication/mural/${casa.id}/cancel`, { reason: "não gostei" })).status === 403, "Outra pessoa do Elenco não remove publicação alheia");
    assert((await post(memApi, `/communication/mural/${casa.id}/cancel`, {})).status === 400, "Remover pede motivo");
    assert((await post(memApi, `/communication/mural/${casa.id}/cancel`, { reason: "publiquei sem querer" })).status === 200, "Quem publicou remove a própria publicação");
    assert(!(await feedOf(outraApi)).posts.some(item => item.id === casa.id), "A publicação removida some do Mural");
    const removidosMem = ((await (await memApi("/communication/mural/removidos")).json()) as { removidos: { id: string; canRestore: boolean; motivo: string }[] }).removidos;
    const removidosOutra = ((await (await outraApi("/communication/mural/removidos")).json()) as { removidos: { id: string }[] }).removidos;
    assert(removidosMem.find(item => item.id === casa.id)?.canRestore === true && removidosMem.find(item => item.id === casa.id)?.motivo === "publiquei sem querer", "Quem publicou vê o que removeu, com o motivo, e pode trazer de volta");
    assert(!removidosOutra.some(item => item.id === casa.id), "Quem não publicou não vê a remoção alheia");
    assert((await post(memApi, `/communication/mural/${casa.id}/restore`)).status === 200 && (await feedOf(outraApi)).posts.some(item => item.id === casa.id), "Desfazer a própria remoção devolve a publicação ao Mural");
    assert((await post(adminApi, `/communication/mural/${casa.id}/cancel`, { reason: "fora do tom da casa" })).status === 200, "A Administração derruba a publicação do Elenco");
    const bloqueio = await post(memApi, `/communication/mural/${casa.id}/restore`);
    assert(bloqueio.status === 403 && /Administração ou a Direção/.test(((await bloqueio.json()) as { error: string }).error), "Quem publicou não desfaz a decisão da Administração, e a recusa explica");
    const removidosAdmin = ((await (await adminApi("/communication/mural/removidos")).json()) as { removidos: { id: string; removidoPor: string | null; canRestore: boolean }[] }).removidos;
    assert(removidosAdmin.find(item => item.id === casa.id)?.removidoPor === `${tag}_admin` && removidosAdmin.find(item => item.id === casa.id)?.canRestore === true, "A Administração vê quem removeu e restaura");
    const autorAvisado = await avisosDe(`mural:${casa.id}:cancelado`);
    assert(quem(autorAvisado) === ids(mem) && (autorAvisado[0]?.payload as Payload).message.includes("fora do tom da casa") && (autorAvisado[0]?.payload as Payload).message.includes(`${tag}_admin`), "Quem teve a publicação derrubada é avisado, com quem derrubou e o motivo");
    assert((await post(dirApi, `/communication/mural/${casa.id}/restore`)).status === 200, "A Direção também traz de volta");
    assert((await post(dirApi, `/communication/mural/${casa.id}/restore`)).status === 404, "Trazer de volta o que não está removido é recusado");
    // dentro dos 10 s o aviso de remoção ainda não saiu e cai junto com o desfazer
    assert((await post(memApi, `/communication/mural/${daArea.id}/cancel`, { reason: "errei a área" })).status === 200, "Remove publicação para uma área");
    const pendentes = await avisosDe(`mural:${daArea.id}:cancelado`);
    assert(pendentes.length > 0 && pendentes.every(row => row.status === "pending" && row.dueAt.getTime() > Date.now()), "O aviso de remoção espera a janela do desfazer");
    assert((await post(memApi, `/communication/mural/${daArea.id}/restore`)).status === 200, "Desfaz a remoção");
    assert((await avisosDe(`mural:${daArea.id}:cancelado`)).every(row => row.status === "cancelled"), "Desfazer dentro da janela cancela os avisos de remoção que ainda não saíram");

    // ── 8. Reações ──
    assert((await post(outraApi, `/communication/mural/${casa.id}/react`, { reaction: "💩" })).status === 400, "Emoji fora da lista é recusado");
    assert((await post(outraApi, `/communication/mural/${casa.id}/react`, { reaction: "❤️" })).status === 200, "Reage com ❤️");
    assert((await post(mem2Api, `/communication/mural/${casa.id}/react`, { reaction: "👏" })).status === 200 && (await post(outraApi, `/communication/mural/${casa.id}/react`, { reaction: "👏" })).status === 200, "Mudar de reação vale (uma por pessoa)");
    const reagido = (await feedOf(memApi)).posts.find(item => item.id === casa.id);
    assert(JSON.stringify(reagido?.reactions) === JSON.stringify([{ emoji: "👏", count: 2 }]), `O cartão conta as reações por emoji (${JSON.stringify(reagido?.reactions)})`);
    const quemReagiu = (await (await memApi(`/communication/mural/${casa.id}/reacoes`)).json()) as { reacoes: { emoji: string; pessoas: string[] }[] };
    assert(quemReagiu.reacoes[0]?.emoji === "👏" && quemReagiu.reacoes[0]?.pessoas.length === 2, "Dá para ver quem reagiu com o quê");
    assert((await post(outraApi, `/communication/mural/${casa.id}/react`, { reaction: null })).status === 200, "Tirar a reação");
    assert(JSON.stringify((await feedOf(memApi)).posts.find(item => item.id === casa.id)?.reactions) === JSON.stringify([{ emoji: "👏", count: 1 }]), "Tirar a reação desconta do cartão");
    assert((await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.entityId, casa.id), like(historyEventsTable.action, "%react%")))).length === 0, "Reagir não entra no Registro (decisão de 14/10)");

    // ── 9. Janela: só o mês atual e o seguinte ──
    const janela = janelaDoMural();
    const [anoFim, mesFim] = janela.fimYmd.split("-").map(Number) as [number, number];
    const quinzeDoMesQueVem = new Date(Date.UTC(anoFim, mesFim - 2, 15)).toISOString().slice(0, 10);
    const antigo = new Date(Date.now() - 70 * 86_400_000);
    const inserir = async (valores: Partial<typeof announcementsTable.$inferInsert>) => (await db.insert(announcementsTable).values({ orgId: org!.id, authorId: admin.id, type: "NOTICE", scope: "HOUSE", body: `${tag} ${Math.random()}`, ...valores }).returning())[0]!.id;
    const velho = await inserir({ publishedAt: antigo, title: "velho" });
    const velhoComCiente = await inserir({ publishedAt: antigo, title: "velho com ciente", requiresConfirmation: true });
    const velhoComEvento = await inserir({ publishedAt: antigo, title: "velho com evento no mês que vem", eventDate: quinzeDoMesQueVem });
    const eventoLonge = await inserir({ title: "evento depois do mês que vem", eventDate: janela.fimYmd });
    const feedJanela = (await feedOf(memApi)).posts.map(item => item.id);
    assert(!feedJanela.includes(velho), "Publicação de antes do mês atual sai do Mural");
    assert(feedJanela.includes(velhoComCiente), "Aviso antigo que ainda pede o meu ciente continua aparecendo");
    assert(feedJanela.includes(velhoComEvento), "Publicação antiga com evento no mês que vem continua");
    assert(!feedJanela.includes(eventoLonge), "Evento depois do mês que vem ainda não aparece");
    assert(!(await feedOf(adminApi)).posts.some(item => item.id === velhoComCiente), "Quem gerencia não fica com o aviso antigo preso no topo");
    assert((await post(memApi, `/communication/mural/${velhoComCiente}/ack`)).status === 200 && !(await feedOf(memApi)).posts.some(item => item.id === velhoComCiente), "Depois do ciente, o aviso antigo sai");

    // ── 10. Datas especiais ──
    const hoje = hojeSaoPaulo();
    assert((await post(memApi, "/communication/datas-especiais", { nome: "Dia do Elenco", mes: hoje.m, dia: hoje.d })).status === 403, "Elenco não cadastra data especial");
    assert((await memApi("/communication/datas-especiais")).status === 403, "Elenco não lista o cadastro de datas");
    const criada = await post(dirApi, "/communication/datas-especiais", { nome: `${tag} Dia do Teatro`, mensagem: "Hoje é nosso dia", mes: hoje.m, dia: hoje.d });
    const criadaBody = await criada.json() as { data: { id: string } };
    assert(criada.status === 201, `A Direção cadastra a data especial (${criada.status})`);
    assert((await post(dirApi, "/communication/datas-especiais", { nome: "Dia impossível", mes: 2, dia: 31 })).status === 400, "Dia que não existe no mês é recusado");
    const hojeFeed = (await feedOf(memApi)).datasEspeciais.find(item => item.nome === `${tag} Dia do Teatro`);
    assert(hojeFeed?.emDias === 0, "A data especial aparece no Mural no próprio dia");
    const amanha = new Date(Date.UTC(hoje.y, hoje.m - 1, hoje.d + 5));
    const futura = await post(adminApi, "/communication/datas-especiais", { nome: `${tag} Dia da Dança`, mes: amanha.getUTCMonth() + 1, dia: amanha.getUTCDate() });
    const futuraId = ((await futura.json()) as { data: { id: string } }).data.id;
    assert((await feedOf(memApi)).datasEspeciais.find(item => item.nome === `${tag} Dia da Dança`)?.emDias === 5, "E aparece na semana, contando os dias");
    const longe = new Date(Date.UTC(hoje.y, hoje.m - 1, hoje.d + 20));
    await post(adminApi, "/communication/datas-especiais", { nome: `${tag} Dia distante`, mes: longe.getUTCMonth() + 1, dia: longe.getUTCDate() });
    assert(!(await feedOf(memApi)).datasEspeciais.some(item => item.nome === `${tag} Dia distante`), "Data a mais de uma semana ainda não aparece");
    assert((await patch(dirApi, `/communication/datas-especiais/${criadaBody.data.id}`, { nome: `${tag} Dia do Teatro`, mensagem: "Parabéns, elenco", mes: hoje.m, dia: hoje.d })).status === 200, "Edita a data especial");
    assert((await del(adminApi, `/communication/datas-especiais/${futuraId}`)).status === 200 && !(await feedOf(memApi)).datasEspeciais.some(item => item.nome === `${tag} Dia da Dança`), "Remover tira a data do Mural (remoção lógica)");
    const lista = ((await (await adminApi("/communication/datas-especiais")).json()) as { datas: { id: string; active: boolean }[] }).datas;
    assert(lista.find(item => item.id === futuraId)?.active === false, "A data removida continua no cadastro, marcada como removida");
    assert((await post(adminApi, `/communication/datas-especiais/${futuraId}/restore`)).status === 200 && (await feedOf(memApi)).datasEspeciais.some(item => item.nome === `${tag} Dia da Dança`), "Restaurar traz a data de volta");
    const eventosData = await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.orgId, org!.id), like(historyEventsTable.action, "mural.date_%")));
    assert(["mural.date_created", "mural.date_updated", "mural.date_removed", "mural.date_restored"].every(action => eventosData.some(event => event.action === action)), "Cadastrar, editar, remover e restaurar data entram no Registro");

    // Regressão: id inválido na data especial devolve 404, não 500
    assert((await post(adminApi, `/communication/datas-especiais/undefined/restore`)).status === 404, "Restaurar data com id inválido devolve 404");
  } finally {
    if (server) { (server as http.Server & { closeAllConnections?: () => void }).closeAllConnections?.(); await new Promise<void>(resolve => server!.close(() => resolve())); }
    const userIds = all.map(user => user.id);
    await db.delete(notificationOutboxTable).where(inArray(notificationOutboxTable.userId, userIds));
    await db.delete(userNotificationsTable).where(inArray(userNotificationsTable.userId, userIds));
    await db.delete(historyEventsTable).where(eq(historyEventsTable.orgId, org!.id));
    await db.delete(muralDatasEspeciaisTable).where(eq(muralDatasEspeciaisTable.orgId, org!.id));
    await db.delete(announcementCommentsTable).where(inArray(announcementCommentsTable.authorId, userIds));
    await db.delete(announcementReadsTable).where(inArray(announcementReadsTable.userId, userIds));
    await db.delete(announcementRecipientsTable).where(inArray(announcementRecipientsTable.userId, userIds));
    await db.delete(announcementsTable).where(eq(announcementsTable.orgId, org!.id));
    await db.delete(userRolesTable).where(inArray(userRolesTable.userId, userIds));
    await db.delete(usersTable).where(inArray(usersTable.id, userIds));
    await db.delete(operationsTable).where(eq(operationsTable.organizationId, org!.id));
    await db.delete(areasTable).where(eq(areasTable.organizationId, org!.id));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, org!.id));
    await pool.end();
  }
  if (failures.length) { console.error(`\n${failures.length} falha(s); ${passed} verificações passaram.`); process.exit(1); }
  console.log(`✓ Mural aberto: ${passed} verificações passaram.`);
}
run().catch(error => { console.error(error); process.exit(1); });
