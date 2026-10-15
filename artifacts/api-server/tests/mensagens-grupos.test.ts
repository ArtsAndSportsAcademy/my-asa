/**
 * Mensagens estilo WhatsApp, versão profissional (15/10/2026): conversa direta que se reaproveita, grupos
 * criados por qualquer pessoa e grupos da casa, figurinhas, reações, "visto por", aviso único por conversa,
 * folga sem push, arquivar — e a privacidade: a Administração não lê conversa de ninguém, nem pelo Registro.
 */
import http from "node:http";
import { and, eq, inArray } from "drizzle-orm";
import { areasTable, db, folgasTable, historyEventsTable, messageReactionsTable, messageThreadParticipantsTable, messageThreadPreferencesTable, messageThreadsTable, messagesTable, notificationOutboxTable, operationsTable, organizationsTable, pool, userNotificationsTable, userRolesTable, usersTable } from "@workspace/db";
import app from "../src/application.js";
import { signAccessToken } from "../src/lib/jwt.service.js";
import { operationalDate } from "../src/lib/operational-date.js";

let passed = 0; const failures: string[] = [];
const assert = (condition: boolean, label: string) => { if (condition) passed++; else { failures.push(label); console.error(`  ✗ ${label}`); } };

type Payload = { type: string; title: string; message: string; semPush?: boolean; entityId: string };
type Mensagem = { id: string; content: string; kind: string; senderId: string; reacoes: { emoji: string; count: number; pessoas: string[] }[]; minhaReacao: string | null; vistoPor?: string[] };

async function run() {
  const tag = `msg_grupos_${Date.now()}`;
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [areaA, areaB] = await db.insert(areasTable).values([{ organizationId: org!.id, name: `${tag}_A` }, { organizationId: org!.id, name: `${tag}_B` }]).returning();
  const makeUser = async (name: string, areaId: string | null) => (await db.insert(usersTable).values({ organizationId: org!.id, name: `${tag}_${name}`, fullName: `${tag}_${name}`, username: `${tag}_${name}`, email: `${tag}_${name}@exemplo.test`, areaId, status: "ACTIVE", personStatus: "ACTIVE" }).returning())[0]!;
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
    const json = async <T>(response: Response) => (await response.json()) as T;
    const fila = async (userIds: string[], threadId: string, tipo?: string) => (await db.select().from(notificationOutboxTable).where(inArray(notificationOutboxTable.userId, userIds))).filter(row => (row.payload as Payload).entityId === threadId && (!tipo || (row.payload as Payload).type === tipo));
    const quem = (rows: { userId: string }[]) => rows.map(row => row.userId).sort().join(",");
    const ids = (...users: { id: string }[]) => users.map(user => user.id).sort().join(",");
    const novaConversa = async (api: Api, corpo: Record<string, unknown>) => { const r = await post(api, "/messages/threads", corpo); const j = await json<{ thread?: { id: string; contextType: string; title: string }; existente?: boolean; error?: string }>(r); return { status: r.status, id: j.thread?.id ?? "", tipo: j.thread?.contextType, existente: j.existente, erro: j.error }; };
    const enviar = async (api: Api, threadId: string, corpo: Record<string, unknown>) => { const r = await post(api, `/messages/threads/${threadId}/messages`, corpo); const j = await json<{ message?: Mensagem; error?: string }>(r); return { status: r.status, id: j.message?.id ?? "", erro: j.error }; };
    const abrir = async (api: Api, threadId: string, query = "") => { const r = await api(`/messages/threads/${threadId}${query}`); return { status: r.status, corpo: await json<{ messages: Mensagem[]; participants: { userId: string; lastReadAt?: string }[]; thread: { podeGerir: boolean; souDono: boolean } }>(r) }; };

    // ── 1. Conversa direta: a mesma entre duas pessoas, e cada uma vê o nome da OUTRA ──
    const dm = await novaConversa(memApi, { title: "qualquer coisa", participantIds: [mem2.id] });
    assert(dm.status === 201 && dm.tipo === "DIRECT" && dm.existente === false, `Conversa direta é criada (${dm.status}: ${dm.erro})`);
    const dmDeNovo = await novaConversa(memApi, { title: "outra vez", participantIds: [mem2.id] });
    const dmInversa = await novaConversa(mem2Api, { participantIds: [mem.id] });
    assert(dmDeNovo.status === 200 && dmDeNovo.id === dm.id && dmDeNovo.existente === true && dmInversa.id === dm.id, "Abrir conversa com a mesma pessoa volta à existente, de qualquer um dos lados");
    const listaMem2 = (await json<{ threads: { id: string; title: string }[] }>(await mem2Api("/messages/threads"))).threads;
    const listaMem = (await json<{ threads: { id: string; title: string }[] }>(await memApi("/messages/threads"))).threads;
    assert(listaMem2.find(item => item.id === dm.id)?.title === `${tag}_mem` && listaMem.find(item => item.id === dm.id)?.title === `${tag}_mem2`, "Cada pessoa vê o nome da outra como título da conversa direta");
    const recipients = await json<{ recipients: Record<string, unknown>[] }>(await memApi("/messages/recipients"));
    assert(recipients.recipients.length > 0 && recipients.recipients.every(item => !("email" in item)), "A lista de colegas não entrega o e-mail de ninguém");

    // ── 2. Grupo criado por qualquer pessoa: ela é a dona ──
    assert((await novaConversa(memApi, { participantIds: [mem2.id, outra.id] })).status === 400, "Grupo sem nome é recusado");
    const grupo = await novaConversa(memApi, { title: `${tag} Mídias`, participantIds: [mem2.id, outra.id] });
    assert(grupo.status === 201 && grupo.tipo === "GROUP", `Qualquer pessoa cria grupo (${grupo.status}: ${grupo.erro})`);
    assert(quem(await fila([mem2.id, outra.id, mem.id], grupo.id, "message.group")) === ids(mem2, outra), "Quem entra no grupo é avisado, e quem criou não");
    const dono = await abrir(memApi, grupo.id), naoDono = await abrir(mem2Api, grupo.id);
    assert(dono.corpo.thread.souDono === true && dono.corpo.thread.podeGerir === true && naoDono.corpo.thread.souDono === false && naoDono.corpo.thread.podeGerir === false, "Quem criou o grupo é o dono; os outros não gerenciam");

    // ── 3. Mensagem: aviso único por conversa, sem texto no Registro ──
    const segredo = `${tag} texto que a Administração não pode ler`;
    const m1 = await enviar(mem2Api, grupo.id, { content: segredo });
    assert(m1.status === 201, `Escreve no grupo (${m1.status}: ${m1.erro})`);
    const avisos1 = await fila([mem.id, outra.id, mem2.id], grupo.id, "message.new");
    assert(quem(avisos1) === ids(mem, outra) && (avisos1[0]!.payload as Payload).title === `${tag} Mídias` && (avisos1[0]!.payload as Payload).message.startsWith(`${tag}_mem2: `), `Quem está no grupo é avisado da mensagem, menos quem escreveu (${avisos1.length})`);
    const m2 = await enviar(mem2Api, grupo.id, { content: "e uma segunda mensagem" });
    const avisos2 = await fila([mem.id, outra.id], grupo.id, "message.new");
    assert(m2.status === 201 && avisos2.length === 2 && avisos2.every(row => (row.payload as Payload).message.endsWith("e uma segunda mensagem")), `Segunda mensagem atualiza o aviso em vez de criar outro (${avisos2.length} avisos)`);
    const registroDaMensagem = await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.orgId, org!.id), eq(historyEventsTable.entityId, m1.id)));
    assert(registroDaMensagem.length === 1 && !JSON.stringify(registroDaMensagem).includes("Administração não pode ler"), "O Registro guarda que houve mensagem, nunca o texto");
    assert((await enviar(memApi, grupo.id, { content: "   " })).status === 400 && (await enviar(memApi, grupo.id, { content: "x".repeat(4001) })).status === 400, "Mensagem vazia ou enorme é recusada");
    const outraConversa = await novaConversa(memApi, { participantIds: [sup.id] });
    const deOutraConversa = await enviar(supApi, outraConversa.id, { content: "mensagem de outra conversa" });
    assert((await enviar(memApi, grupo.id, { content: "citando de outra", quotedMessageId: deOutraConversa.id })).status === 400, "Só se cita mensagem da própria conversa");
    assert((await enviar(memApi, grupo.id, { content: "respondendo", quotedMessageId: m1.id })).status === 201, "Citar mensagem da conversa vale");
    // silenciar: não recebe aviso
    await patch(outraApi, `/messages/threads/${grupo.id}/preferences`, { muted: true });
    const grupoMudo = await novaConversa(memApi, { title: `${tag} Silêncio`, participantIds: [outra.id, mem2.id] });
    await patch(outraApi, `/messages/threads/${grupoMudo.id}/preferences`, { muted: true });
    await enviar(memApi, grupoMudo.id, { content: "oi" });
    assert(quem(await fila([outra.id, mem2.id], grupoMudo.id, "message.new")) === ids(mem2), "Quem silenciou o grupo não recebe aviso");

    // ── 4. Figurinhas ──
    const figurinha = await enviar(mem2Api, grupo.id, { content: "vencemos", kind: "STICKER" });
    assert(figurinha.status === 201 && (await abrir(memApi, grupo.id)).corpo.messages.find(item => item.id === figurinha.id)?.kind === "STICKER", "Figurinha da ASA é enviada e volta como figurinha");
    assert((await enviar(mem2Api, grupo.id, { content: "figurinha-que-nao-existe", kind: "STICKER" })).status === 400, "Figurinha desconhecida é recusada");

    // ── 5. Folga: o aviso chega ao sino, mas o celular não toca ──
    await db.insert(folgasTable).values({ userId: outra.id, operationId: operation!.id, type: "DAY_OFF", startDate: operationalDate(), endDate: operationalDate(), status: "ACTIVE", createdBy: admin.id });
    const grupoFolga = await novaConversa(memApi, { title: `${tag} Folga`, participantIds: [outra.id, mem2.id] });
    await enviar(memApi, grupoFolga.id, { content: "alguém aí?" });
    const avisosFolga = await fila([outra.id, mem2.id], grupoFolga.id, "message.new");
    assert(avisosFolga.find(row => row.userId === outra.id)?.payload && (avisosFolga.find(row => row.userId === outra.id)!.payload as Payload).semPush === true && (avisosFolga.find(row => row.userId === mem2.id)!.payload as Payload).semPush === false, "Quem está de folga recebe no sino, sem push; os outros recebem normalmente");

    // ── 6. "Visto por": só quem enviou vê, e só quando a pessoa abriu de verdade ──
    const dmMsg = await enviar(memApi, dm.id, { content: "você viu?" });
    const antes = (await abrir(memApi, dm.id, "?semLer=1")).corpo.messages.find(item => item.id === dmMsg.id);
    assert(Array.isArray(antes?.vistoPor) && antes!.vistoPor!.length === 0, "Antes de a outra pessoa abrir, ninguém viu");
    const vistaPelaOutra = await abrir(mem2Api, dm.id, "?semLer=1");
    const aindaNao = (await abrir(memApi, dm.id, "?semLer=1")).corpo.messages.find(item => item.id === dmMsg.id);
    assert(aindaNao!.vistoPor!.length === 0, "A tela se atualizando sozinha (semLer) não marca como visto");
    assert(vistaPelaOutra.corpo.messages.find(item => item.id === dmMsg.id)?.vistoPor === undefined, "Quem recebe não vê o 'visto por' das mensagens dos outros");
    await abrir(mem2Api, dm.id);
    const depoisDeAbrir = (await abrir(memApi, dm.id, "?semLer=1")).corpo.messages.find(item => item.id === dmMsg.id);
    assert(JSON.stringify(depoisDeAbrir?.vistoPor) === JSON.stringify([`${tag}_mem2`]), "Depois que a outra pessoa abre a conversa, quem enviou vê o 'visto por'");
    const ptDoOutro = (await abrir(memApi, dm.id)).corpo.participants.find(item => item.userId === mem2.id);
    assert(ptDoOutro !== undefined && ptDoOutro.lastReadAt === undefined, "O horário em que cada pessoa leu não vai para os outros");
    // em grupo: lista quem viu
    await abrir(outraApi, grupo.id); await abrir(mem2Api, grupo.id);
    const noGrupo = (await abrir(mem2Api, grupo.id, "?semLer=1")).corpo.messages.find(item => item.id === m1.id);
    // Quem escreveu depois de m1 (a dona) também já a tinha visto; a outra pessoa abriu a conversa.
    assert((noGrupo?.vistoPor ?? []).includes(`${tag}_outra`) && (noGrupo?.vistoPor ?? []).includes(`${tag}_mem`), `Em grupo, quem enviou vê quem já viu (${JSON.stringify(noGrupo?.vistoPor)})`);
    const visto = (await abrir(memApi, grupo.id, "?semLer=1")).corpo.messages.find(item => item.id === m1.id);
    assert(visto?.vistoPor === undefined, "Quem não enviou a mensagem não vê o 'visto por' dela");
    // Aviso de mensagem nova já no sino: abrir a conversa marca como lido; e uma mensagem nova num aviso ainda aberto só o atualiza.
    const grupoAberto = await novaConversa(memApi, { title: `${tag} Aviso aberto`, participantIds: [mem2.id, outra.id] });
    await db.insert(userNotificationsTable).values([
      { userId: mem2.id, type: "message.new", title: "Antigo", message: "texto antigo", category: "message", entityType: "thread", entityId: grupoAberto.id },
      { userId: outra.id, type: "message.new", title: "Antigo", message: "texto antigo", category: "message", entityType: "thread", entityId: grupoAberto.id },
    ]);
    await enviar(memApi, grupoAberto.id, { content: "mensagem nova" });
    const noSino = await db.select().from(userNotificationsTable).where(and(eq(userNotificationsTable.entityId, grupoAberto.id), eq(userNotificationsTable.type, "message.new")));
    assert(noSino.length === 2 && noSino.every(item => item.message.endsWith("mensagem nova")) && (await fila([mem2.id, outra.id], grupoAberto.id, "message.new")).length === 0, "Quem já tem aviso aberto desta conversa no sino só tem o texto atualizado, sem aviso novo");
    await abrir(outraApi, grupoAberto.id);
    const depoisDeAbrirGrupo = await db.select().from(userNotificationsTable).where(and(eq(userNotificationsTable.entityId, grupoAberto.id), eq(userNotificationsTable.userId, outra.id)));
    assert(depoisDeAbrirGrupo.length === 1 && depoisDeAbrirGrupo[0]!.readAt !== null, "Abrir a conversa marca como lido o aviso dela no sino");

    // ── 7. Reações ──
    assert((await post(mem2Api, `/messages/threads/${grupo.id}/messages/${m1.id}/react`, { reaction: "💩" })).status === 400, "Reação fora da lista é recusada");
    assert((await post(mem2Api, `/messages/threads/${grupo.id}/messages/${m1.id}/react`, { reaction: "❤️" })).status === 200 && (await post(outraApi, `/messages/threads/${grupo.id}/messages/${m1.id}/react`, { reaction: "👏" })).status === 200, "Reagir a uma mensagem");
    const comReacao = (await abrir(memApi, grupo.id, "?semLer=1")).corpo.messages.find(item => item.id === m1.id);
    assert(comReacao?.reacoes.length === 2 && comReacao.reacoes.every(item => item.count === 1 && item.pessoas.length === 1), `A mensagem mostra as reações com quem reagiu (${JSON.stringify(comReacao?.reacoes)})`);
    assert((await abrir(mem2Api, grupo.id, "?semLer=1")).corpo.messages.find(item => item.id === m1.id)?.minhaReacao === "❤️", "Cada pessoa vê a própria reação");
    assert((await post(outraApi, `/messages/threads/${grupo.id}/messages/${m1.id}/react`, { reaction: "🎉" })).status === 200 && (await post(mem2Api, `/messages/threads/${grupo.id}/messages/${m1.id}/react`, { reaction: null })).status === 200, "Trocar e tirar a reação");
    const reacoesFinais = (await abrir(memApi, grupo.id, "?semLer=1")).corpo.messages.find(item => item.id === m1.id)?.reacoes;
    assert(JSON.stringify(reacoesFinais?.map(item => item.emoji)) === JSON.stringify(["🎉"]), "Depois de trocar e tirar, sobra só a reação certa");
    assert((await post(supApi, `/messages/threads/${grupo.id}/messages/${m1.id}/react`, { reaction: "❤️" })).status === 403, "Quem não está na conversa não reage");
    assert((await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.orgId, org!.id), eq(historyEventsTable.entityId, m1.id)))).length === 1, "Reagir não entra no Registro");

    // ── 8. A Administração não lê conversa de ninguém ──
    assert((await abrir(adminApi, grupo.id)).status === 403 && (await abrir(dirApi, dm.id)).status === 403, "Administração e Direção não abrem conversa da qual não participam");
    const listaAdmin = (await json<{ threads: { id: string }[] }>(await adminApi("/messages/threads"))).threads;
    assert(!listaAdmin.some(item => item.id === grupo.id || item.id === dm.id), "A conversa dos outros não aparece nas Mensagens da Administração");
    const listaDeGrupos = await adminApi("/messages/grupos"); const listaDeGruposBody = await json<{ grupos: { id: string; integrantes: { name: string }[]; total: number; tipo: string }[] }>(listaDeGrupos);
    const grupoNaLista = listaDeGruposBody.grupos.find(item => item.id === grupo.id);
    assert(listaDeGrupos.status === 200 && grupoNaLista?.total === 3 && grupoNaLista.tipo === "GROUP", "A Administração vê a lista de grupos e quem está em cada um");
    assert(!JSON.stringify(listaDeGruposBody).includes("segunda mensagem") && !JSON.stringify(listaDeGruposBody).includes("Administração não pode ler") && !JSON.stringify(listaDeGruposBody).includes("content"), "A lista de grupos não traz nenhum texto de conversa");
    assert((await memApi("/messages/grupos")).status === 403 && (await dirApi("/messages/grupos")).status === 200, "A lista de grupos é da Administração e da Direção");
    // Registro: linha antiga com texto fica mascarada, na leitura e na busca
    await db.insert(historyEventsTable).values({ category: "MESSAGE", action: "message_sent", title: "Mensagem enviada", narrative: `${tag} segredo-antigo escrito antes`, entityType: "message", entityId: m1.id, actorId: mem.id, orgId: org!.id, afterState: { id: m1.id, content: `${tag} segredo-antigo escrito antes` } });
    const registro = await json<{ events: { entityType: string; narrative: string; afterState: Record<string, unknown> | null }[] }>(await adminApi("/history?entityType=message&limit=200"));
    assert(registro.events.length > 0 && registro.events.every(item => item.narrative === "Mensagem enviada." && !JSON.stringify(item).includes("segredo-antigo") && !JSON.stringify(item).includes("Administração não pode ler")), "No Registro, nenhuma linha de mensagem mostra o texto — nem as antigas");
    const busca = await json<{ events: unknown[] }>(await adminApi(`/history?q=${encodeURIComponent("segredo-antigo")}`));
    assert(busca.events.length === 0, "A busca do Registro não acha o que alguém escreveu numa conversa");

    // ── 9. Gerenciar o grupo ──
    assert((await patch(mem2Api, `/messages/threads/${grupo.id}`, { title: "invasão" })).status === 403 && (await patch(adminApi, `/messages/threads/${grupo.id}`, { title: "invasão" })).status === 403, "Só a dona renomeia o grupo de uma pessoa (nem a Administração)");
    assert((await patch(memApi, `/messages/threads/${grupo.id}`, { title: `${tag} Mídias e Fotos` })).status === 200, "A dona renomeia");
    assert((await post(mem2Api, `/messages/threads/${grupo.id}/members`, { userIds: [sup.id] })).status === 403, "Quem não é dona não convida");
    assert((await post(memApi, `/messages/threads/${grupo.id}/members`, { userIds: [sup.id] })).status === 201 && (await post(memApi, `/messages/threads/${grupo.id}/members`, { userIds: [sup.id] })).status === 400, "A dona convida, e convidar quem já está é recusado");
    assert(quem(await fila([sup.id], grupo.id, "message.group")) === ids(sup), "Quem foi convidado depois é avisado");
    assert((await del(mem2Api, `/messages/threads/${grupo.id}/members/${outra.id}`)).status === 403, "Quem não é dona não tira ninguém");
    assert((await del(memApi, `/messages/threads/${grupo.id}/members/${outra.id}`)).status === 200 && (await abrir(outraApi, grupo.id)).status === 403, "A dona tira alguém, que deixa de ter acesso");
    assert((await del(mem2Api, `/messages/threads/${grupo.id}/members/${mem2.id}`)).status === 200, "Qualquer pessoa sai do grupo de pessoa");
    const saiDona = await novaConversa(memApi, { title: `${tag} Troca de dona`, participantIds: [mem2.id, sup.id] });
    assert((await del(memApi, `/messages/threads/${saiDona.id}/members/${mem.id}`)).status === 200, "A dona pode sair");
    const novaDona = (await db.select().from(messageThreadParticipantsTable).where(and(eq(messageThreadParticipantsTable.threadId, saiDona.id), eq(messageThreadParticipantsTable.role, "INITIATOR"))));
    assert(novaDona.length === 1, "Quando a dona sai, o grupo passa para outra pessoa");
    const areaGroup = (await json<{ threads: { id: string; contextType: string }[] }>(await memApi("/messages/threads"))).threads.find(item => item.contextType === "AREA_GROUP");
    assert(Boolean(areaGroup), "O grupo da área existe");
    assert((await post(memApi, `/messages/threads/${areaGroup!.id}/members`, { userIds: [outra.id] })).status === 400 && (await del(mem2Api, `/messages/threads/${areaGroup!.id}/members/${mem2.id}`)).status === 400, "O grupo da área segue o cadastro: ninguém entra nem sai à mão");
    assert((await post(adminApi, `/messages/threads/${areaGroup!.id}/arquivar`, { reason: "teste" })).status === 400, "O grupo da área não se arquiva");

    // ── 10. Grupo da casa: criado pela Administração, que NÃO entra sozinha ──
    assert((await post(memApi, "/messages/grupos", { nome: "Meninas", pessoaIds: [mem.id] })).status === 403, "Elenco não cria grupo da casa");
    assert((await post(adminApi, "/messages/grupos", { nome: "Meninas" })).status === 400, "Grupo da casa sem ninguém é recusado");
    const casaCriada = await post(adminApi, "/messages/grupos", { nome: `${tag} Meninas`, pessoaIds: [mem.id, mem2.id], areaIds: [areaB!.id] });
    const casaId = (await json<{ thread: { id: string } }>(casaCriada)).thread.id;
    assert(casaCriada.status === 201, `A Administração cria um grupo da casa (${casaCriada.status})`);
    const integrantesCasa = (await db.select().from(messageThreadParticipantsTable).where(eq(messageThreadParticipantsTable.threadId, casaId))).map(row => row.userId);
    assert(ids(...all.filter(user => integrantesCasa.includes(user.id))) === ids(mem, mem2, outra), "O grupo reúne as pessoas marcadas e a área marcada, sem a Administração");
    assert((await abrir(adminApi, casaId)).status === 403, "Quem criou o grupo da casa não lê o grupo se não entrar de propósito");
    assert((await post(dirApi, "/messages/grupos", { nome: `${tag} Meninos`, pessoaIds: [sup.id] })).status === 201, "A Direção também cria grupo da casa");
    assert((await post(memApi, `/messages/threads/${casaId}/members`, { userIds: [sup.id] })).status === 403 && (await post(adminApi, `/messages/threads/${casaId}/members`, { userIds: [sup.id] })).status === 201, "Só a Administração e a Direção mexem nos integrantes do grupo da casa");
    assert((await del(mem2Api, `/messages/threads/${casaId}/members/${mem2.id}`)).status === 403, "Quem está num grupo da casa não sai: pode silenciar");
    assert((await del(dirApi, `/messages/threads/${casaId}/members/${outra.id}`)).status === 200, "A Direção tira alguém do grupo da casa");
    assert((await post(adminApi, `/messages/threads/${casaId}/members`, { userIds: [admin.id] })).status === 201 && (await abrir(adminApi, casaId)).status === 200, "A Administração lê o grupo da casa só depois de entrar nele, à vista de todos");

    // ── 11. Arquivar e trazer de volta ──
    assert((await post(outraApi, `/messages/threads/${casaId}/arquivar`, { reason: "x" })).status === 403, "Quem não gerencia não arquiva");
    assert((await post(memApi, `/messages/threads/${saiDona.id}/arquivar`, { reason: "x" })).status === 403, "Quem saiu do grupo não arquiva mais");
    const semMotivo = await post(adminApi, `/messages/threads/${casaId}/arquivar`, {});
    assert(semMotivo.status === 400, "Arquivar pede motivo");
    assert((await post(adminApi, `/messages/threads/${casaId}/arquivar`, { reason: "Grupo não usado mais" })).status === 200, "A Administração arquiva o grupo da casa, com motivo");
    assert((await enviar(mem2Api, casaId, { content: "alguém?" })).status === 400, "Em grupo arquivado não se escreve");
    assert(quem(await fila([mem.id, mem2.id], casaId, "message.group")).includes(mem.id) && (await fila([mem.id], casaId, "message.group")).some(row => (row.payload as Payload).message.includes("Grupo não usado mais")), "Os integrantes são avisados do arquivamento, com o motivo");
    assert((await post(mem2Api, `/messages/threads/${casaId}/restaurar`)).status === 403 && (await post(dirApi, `/messages/threads/${casaId}/restaurar`)).status === 200, "Só a Administração/Direção traz o grupo da casa de volta");
    assert((await enviar(mem2Api, casaId, { content: "voltamos" })).status === 201, "Depois de trazido de volta, o grupo recebe mensagem");
    const pessoaArquiva = await post(memApi, `/messages/threads/${grupo.id}/arquivar`, { reason: "acabou o projeto" });
    assert(pessoaArquiva.status === 200, "A dona arquiva o próprio grupo");
    assert((await post(adminApi, `/messages/threads/${grupo.id}/restaurar`)).status === 200, "A Administração restaura qualquer grupo");
    const eventos = await db.select().from(historyEventsTable).where(and(eq(historyEventsTable.orgId, org!.id), inArray(historyEventsTable.action, ["message.group_created", "message.group_archived", "message.group_restored", "message.group_member_added", "message.group_member_removed", "message.group_left", "message.group_renamed"])));
    assert(["message.group_created", "message.group_archived", "message.group_restored", "message.group_member_added", "message.group_member_removed", "message.group_left", "message.group_renamed"].every(action => eventos.some(evento => evento.action === action)), "Criar, renomear, convidar, tirar, sair, arquivar e restaurar entram no Registro");
  } finally {
    if (server) { (server as http.Server & { closeAllConnections?: () => void }).closeAllConnections?.(); await new Promise<void>(resolve => server!.close(() => resolve())); }
    const userIds = all.map(user => user.id);
    const threadIds = (await db.select({ id: messageThreadsTable.id }).from(messageThreadsTable).where(eq(messageThreadsTable.orgId, org!.id))).map(row => row.id);
    await db.delete(notificationOutboxTable).where(inArray(notificationOutboxTable.userId, userIds));
    await db.delete(userNotificationsTable).where(inArray(userNotificationsTable.userId, userIds));
    await db.delete(historyEventsTable).where(eq(historyEventsTable.orgId, org!.id));
    if (threadIds.length) {
      const messageIds = (await db.select({ id: messagesTable.id }).from(messagesTable).where(inArray(messagesTable.threadId, threadIds))).map(row => row.id);
      if (messageIds.length) await db.delete(messageReactionsTable).where(inArray(messageReactionsTable.messageId, messageIds));
      await db.delete(messagesTable).where(inArray(messagesTable.threadId, threadIds));
      await db.delete(messageThreadPreferencesTable).where(inArray(messageThreadPreferencesTable.threadId, threadIds));
      await db.delete(messageThreadParticipantsTable).where(inArray(messageThreadParticipantsTable.threadId, threadIds));
      await db.delete(messageThreadsTable).where(inArray(messageThreadsTable.id, threadIds));
    }
    await db.delete(folgasTable).where(eq(folgasTable.operationId, operation!.id));
    await db.delete(userRolesTable).where(inArray(userRolesTable.userId, userIds));
    await db.delete(usersTable).where(inArray(usersTable.id, userIds));
    await db.delete(operationsTable).where(eq(operationsTable.organizationId, org!.id));
    await db.delete(areasTable).where(eq(areasTable.organizationId, org!.id));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, org!.id));
    await pool.end();
  }
  if (failures.length) { console.error(`\n${failures.length} falha(s); ${passed} verificações passaram.`); process.exit(1); }
  console.log(`✓ Mensagens e grupos: ${passed} verificações passaram.`);
}
run().catch(error => { console.error(error); process.exit(1); });
