/**
 * Fase C (C4, continuação) — regras da casa (silêncio e lembrete ajustáveis pela Administração),
 * silêncio noturno adiando só o push, visibilidade em três níveis, foto de perfil e aniversários.
 * PostgreSQL real de teste.
 */
import http from "node:http";
import { and, eq, inArray, or } from "drizzle-orm";
import {
  areaLocalSupervisorsTable,
  areasTable,
  db,
  historyEventsTable,
  locationsTable,
  notificationOutboxTable,
  operationLocationsTable,
  operationsTable,
  organizationsTable,
  pool,
  programacaoBlocosTable,
  programacoesTable,
  scalesTable,
  userNotificationsTable,
  userPhotosTable,
  userRolesTable,
  usersTable,
} from "@workspace/db";
import app from "../src/application.js";
import { signAccessToken } from "../src/lib/jwt.service.js";
import { enqueueEscalaReminders } from "../src/services/operational-jobs.js";
import { processNotificationOutbox } from "../src/services/notification-outbox.js";
import { enqueueNotification } from "../src/services/undo.js";
import { dentroDoSilencio, fimDoSilencio, pushEsperaAte } from "../src/services/regras-casa.js";
import type { CreateNotificationInput } from "../src/services/notificationService.js";

let passed = 0;
const failures: string[] = [];
function assert(condition: boolean, message: string) {
  if (condition) passed += 1;
  else { failures.push(message); console.error(`  ✗ ${message}`); }
}

/** "HH:MM" em São Paulo, deslocado em minutos. */
function hhmmSP(now: Date, somarMin = 0) {
  return new Date(now.getTime() + somarMin * 60_000).toLocaleTimeString("en-GB", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false });
}
function mdSP(now: Date, somarDias = 0) {
  const [dd, mm] = new Date(now.getTime() + somarDias * 86_400_000).toLocaleDateString("en-GB", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" }).split("/");
  return `${mm}-${dd}`;
}

async function run() {
  const tag = `regras_${Date.now()}`;
  const date = "2026-10-14"; // quarta
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [outra] = await db.insert(organizationsTable).values({ name: `${tag}_outra` }).returning();
  const [op] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const [op2] = await db.insert(operationsTable).values({ organizationId: outra!.id, name: `${tag}_op2`, status: "ACTIVE" }).returning();
  const [local] = await db.insert(locationsTable).values({ organizationId: org!.id, name: `${tag}_Snowland` }).returning();
  await db.insert(operationLocationsTable).values({ operationId: op!.id, locationId: local!.id });
  const [area] = await db.insert(areasTable).values({ organizationId: org!.id, name: `${tag}_Patinadores` }).returning();
  const hoje = new Date();
  const mk = async (name: string, role: string, extra: Partial<typeof usersTable.$inferInsert> = {}, orgId = org!.id, opId = op!.id) => {
    const [u] = await db.insert(usersTable).values({ organizationId: orgId, name, fullName: `${name} ${tag}`, username: `${tag}_${name}`.toLowerCase(), areaId: orgId === org!.id ? area!.id : null, ...extra }).returning();
    await db.insert(userRolesTable).values({ userId: u!.id, operationId: opId, role: role as never, active: true });
    return u!;
  };
  const barbara = await mk("Barbara", "ADMIN", { areaId: null });
  const deborah = await mk("Deborah", "SUPERVISOR_A");
  const julia = await mk("Julia", "MEMBER", { phone: "11 90000-0001", email: `${tag}_julia@x.test`, birthDate: `1998-${mdSP(hoje)}` });
  const carol = await mk("Carol", "MEMBER", { phone: "11 90000-0002", email: `${tag}_carol@x.test`, birthDate: `1999-${mdSP(hoje)}`, privacidade: { tel: "gestao", mail: "grupo", bday: "lista" } });
  const dani = await mk("Dani", "MEMBER", { phone: "11 90000-0003", birthDate: `2000-${mdSP(hoje, 3)}`, privacidade: { tel: "asa", mail: "gestao", bday: "mural" } });
  const sofia = await mk("Sofia", "MEMBER", { birthDate: `2001-${mdSP(hoje)}`, privacidade: { tel: "grupo", mail: "gestao", bday: "off" } });
  const alheia = await mk("Alheia", "ADMIN", {}, outra!.id, op2!.id);
  const everyone = [barbara, deborah, julia, carol, dani, sofia, alheia].map((u) => u.id);
  await db.insert(areaLocalSupervisorsTable).values({ areaId: area!.id, locationId: local!.id, supervisorId: deborah.id });
  const [prog] = await db.insert(programacoesTable).values({ organizationId: org!.id, locationId: local!.id, nome: `${tag}_molde`, vigenciaInicio: date, vigenciaFim: date, createdBy: barbara.id }).returning();
  await db.insert(programacaoBlocosTable).values({ programacaoId: prog!.id, weekday, inicio: "09:40", fim: "11:00", rotulo: "TREINO GELO", regra: "area", areaIds: [area!.id] });
  const [escala] = await db.insert(scalesTable).values({ operationId: op!.id, locationId: local!.id, title: `${tag}_escala`, periodStart: date, periodEnd: date, status: "PUBLISHED", publishedAt: new Date(), createdBy: barbara.id }).returning();

  let server: http.Server | null = null;
  try {
    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("servidor de teste não iniciou");
    const base = `http://127.0.0.1:${address.port}/api`;
    const token = (u: { id: string; organizationId: string }, role: string, opId = op!.id) => signAccessToken({ sub: u.id, jti: `${tag}_${Math.random()}`, organizationId: u.organizationId, role, operationIds: [opId] });
    const call = async (method: string, path: string, tk: string, body?: unknown, headers: Record<string, string> = {}) => {
      const r = await fetch(`${base}${path}`, { method, signal: AbortSignal.timeout(60_000), headers: { authorization: `Bearer ${tk}`, ...(body === undefined || Buffer.isBuffer(body) ? {} : { "content-type": "application/json" }), ...headers }, body: body === undefined ? undefined : Buffer.isBuffer(body) ? body : JSON.stringify(body) });
      const buf = Buffer.from(await r.arrayBuffer());
      let json: Record<string, any> = {};
      try { json = JSON.parse(buf.toString("utf8")); } catch { /* binário */ }
      return { status: r.status, body: json, buf, type: r.headers.get("content-type") };
    };
    const asBarbara = token(barbara, "ADMIN"), asDeborah = token(deborah, "SUPERVISOR_A"), asJulia = token(julia, "MEMBER");
    const registro = async (entityId: string, action: string) => db.select().from(historyEventsTable).where(and(eq(historyEventsTable.entityId, entityId), eq(historyEventsTable.action, action)));

    // ---------- Regras da casa ----------
    const padrao = await call("GET", "/organization/regras", asJulia);
    assert(padrao.status === 200 && padrao.body.regras.silencio.de === "22:00" && padrao.body.regras.silencio.ate === "06:00" && padrao.body.regras.lembreteCheckinMin === 30, "regras padrão: silêncio 22h–06h e lembrete 30 min antes");
    assert((await call("PATCH", "/organization/regras", asDeborah, { lembreteCheckinMin: 15 })).status === 403, "Supervisão não muda as regras da casa");
    assert((await call("PATCH", "/organization/regras", asBarbara, { lembreteCheckinMin: 45 })).status === 400, "lembrete só aceita 15, 30 ou 60 min");
    assert((await call("PATCH", "/organization/regras", asBarbara, { silencio: { on: true, de: "25:00", ate: "07:00" } })).status === 400, "silêncio com horário inválido é recusado");
    const mudou = await call("PATCH", "/organization/regras", asBarbara, { lembreteCheckinMin: 15, silencio: { on: true, de: "23:00", ate: "07:00" } });
    assert(mudou.status === 200 && mudou.body.regras.lembreteCheckinMin === 15 && mudou.body.regras.silencio.de === "23:00", "Administração ajusta lembrete e silêncio da casa");
    const [evRegras] = await registro(org!.id, "organization.regras_atualizadas");
    assert(Boolean(evRegras) && evRegras!.actorId === barbara.id && (evRegras!.beforeState as any)?.lembreteCheckinMin === 30 && (evRegras!.afterState as any)?.lembreteCheckinMin === 15, "mudança de regra entra no Registro com antes/depois");

    // ---------- Lembrete segue a regra da casa ----------
    const cedo = await enqueueEscalaReminders(new Date(`${date}T09:20:00-03:00`), org!.id);
    assert(cedo.enqueued === 0, "com a regra de 15 min, às 09:20 ainda não sai lembrete (bloco às 09:40)");
    const naHora = await enqueueEscalaReminders(new Date(`${date}T09:26:00-03:00`), org!.id);
    assert(naHora.enqueued >= 3, "às 09:26 (14 min antes) o lembrete sai para quem está no bloco");

    // ---------- Silêncio noturno ----------
    const casa = { on: true, de: "23:00", ate: "07:00" };
    const madrugada = new Date(`${date}T02:00:00-03:00`);
    assert(dentroDoSilencio(madrugada, casa) && !dentroDoSilencio(new Date(`${date}T12:00:00-03:00`), casa), "janela que vira a noite: 02:00 está dentro, 12:00 fora");
    assert(fimDoSilencio(madrugada, casa).toISOString() === new Date(`${date}T07:00:00-03:00`).toISOString(), "push adiado sai às 07:00 de São Paulo");
    const normal = { userId: julia.id, type: "scale.published", category: "schedule", title: "t", message: "m", priority: "NORMAL" } as CreateNotificationInput;
    assert((await pushEsperaAte(normal, madrugada))?.toISOString() === new Date(`${date}T07:00:00-03:00`).toISOString(), "de madrugada, aviso comum espera o fim do silêncio da casa");
    assert(await pushEsperaAte({ ...normal, priority: "CRITICAL" }, madrugada) === null, "aviso crítico atravessa o silêncio");
    assert(await pushEsperaAte({ ...normal, type: "checkin.shift_reminder" }, madrugada) === null, "lembrete do próprio turno atravessa o silêncio");
    assert((await call("PATCH", "/users/me/preferencias", asJulia, { silencio: { on: false, de: "22:00", ate: "06:00" } })).status === 200, "a pessoa pode desligar o próprio silêncio");
    assert(await pushEsperaAte(normal, madrugada) === null, "silêncio da pessoa desligado: chega na hora");
    await call("PATCH", "/users/me/preferencias", asJulia, { silencio: { on: true, de: "21:00", ate: "05:00" } });
    assert(await pushEsperaAte(normal, new Date(`${date}T06:00:00-03:00`)) === null && (await pushEsperaAte(normal, new Date(`${date}T21:30:00-03:00`))) !== null, "a janela da pessoa substitui a da casa (06:00 livre, 21:30 silêncio)");

    // Na fila: o aviso vai para o app na hora; só o push espera.
    const agora = new Date();
    await call("PATCH", "/users/me/preferencias", asJulia, { silencio: { on: true, de: hhmmSP(agora, -60), ate: hhmmSP(agora, 60) } });
    const entregues: CreateNotificationInput[] = [];
    const capturar = async (input: CreateNotificationInput) => { entregues.push(input); };
    await db.transaction((tx) => enqueueNotification(tx as never, { userId: julia.id, type: "scale.published", category: "schedule", title: `${tag} comum`, message: "m" }, agora, { deduplicationKey: `${tag}:comum` }));
    await db.transaction((tx) => enqueueNotification(tx as never, { userId: julia.id, type: "notice.published", category: "notice", priority: "CRITICAL", title: `${tag} critico`, message: "m" }, agora, { deduplicationKey: `${tag}:critico` }));
    for (let i = 0; i < 5; i++) await processNotificationOutbox(capturar);
    const minhas = entregues.filter((e) => e.userId === julia.id).map((e) => e.title);
    assert(minhas.includes(`${tag} critico`) && !minhas.includes(`${tag} comum`), "durante o silêncio, só o crítico dispara push");
    const noApp = await db.select({ title: userNotificationsTable.title }).from(userNotificationsTable).where(eq(userNotificationsTable.userId, julia.id));
    assert(noApp.some((n) => n.title === `${tag} comum`), "o aviso comum já aparece no app, mesmo com o push esperando");
    const [adiado] = (await db.select().from(notificationOutboxTable).where(eq(notificationOutboxTable.userId, julia.id))).filter((r) => (r.payload as { title: string }).title === `${tag} comum`);
    assert(adiado?.status === "pending" && adiado.dueAt.getTime() > agora.getTime() + 30 * 60_000, "o push comum fica pendente para o fim da janela");
    await call("PATCH", "/users/me/preferencias", asJulia, { silencio: { on: false, de: "22:00", ate: "06:00" } });
    await db.update(notificationOutboxTable).set({ dueAt: new Date(Date.now() - 1000) }).where(eq(notificationOutboxTable.id, adiado!.id));
    for (let i = 0; i < 5; i++) await processNotificationOutbox(capturar);
    assert(entregues.filter((e) => e.title === `${tag} comum`).length === 1, "quando a janela acaba, o push sai uma vez");
    assert(noApp.filter((n) => n.title === `${tag} comum`).length === 1 && (await db.select({ id: userNotificationsTable.id }).from(userNotificationsTable).where(and(eq(userNotificationsTable.userId, julia.id), eq(userNotificationsTable.title, `${tag} comum`)))).length === 1, "adiar o push não duplica o aviso no app");

    // ---------- Visibilidade em três níveis ----------
    assert((await call("PATCH", "/users/me/preferencias", asJulia, { privacidade: { tel: "todos" } })).status === 400, "nível de visibilidade inválido é recusado");
    const vis = await call("PATCH", "/users/me/preferencias", asJulia, { privacidade: { tel: "gestao", mail: "asa", bday: "mural" } });
    assert(vis.status === 200 && vis.body.privacidade.tel === "gestao" && vis.body.privacidade.mail === "asa", "a pessoa escolhe quem vê telefone e e-mail");
    const [jRow] = await db.select({ cv: usersTable.contactVisibility }).from(usersTable).where(eq(usersTable.id, julia.id));
    assert(jRow?.cv.phone === false && jRow?.cv.email === true, "o campo antigo de visibilidade acompanha a escolha");
    assert((await registro(julia.id, "user.preferencias_atualizadas")).length >= 1, "preferências entram no Registro");
    const lista = await call("GET", "/users", token(dani, "MEMBER"));
    const vistaJulia = lista.body.users.find((u: { id: string }) => u.id === julia.id);
    const vistaCarol = lista.body.users.find((u: { id: string }) => u.id === carol.id);
    const vistaPropria = lista.body.users.find((u: { id: string }) => u.id === dani.id);
    assert(vistaJulia && vistaJulia.phone === null && vistaJulia.email === julia.email, "colega não vê telefone 'só gestão'; vê e-mail 'toda a ASA'");
    assert(vistaCarol && vistaCarol.phone === null && vistaCarol.email === carol.email, "colega vê e-mail 'meu grupo' e não vê telefone 'só gestão'");
    assert(vistaPropria?.phone === dani.phone, "a pessoa vê o próprio telefone");
    assert(!JSON.stringify(lista.body).includes('"silencio"'), "o silêncio de cada um não vai para o diretório");
    const gestao = await call("GET", "/users", asDeborah);
    assert(gestao.body.users.find((u: { id: string }) => u.id === julia.id)?.phone === julia.phone, "a Supervisão (gestão) vê o telefone");

    // ---------- Foto ----------
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
    assert((await call("PUT", "/users/me/photo", asJulia, Buffer.from("oi"), { "content-type": "text/plain" })).status === 400, "arquivo que não é imagem é recusado");
    assert((await call("PUT", "/users/me/photo", asJulia, Buffer.alloc(1_100_000, 1), { "content-type": "image/png" })).status === 413, "imagem acima de 1 MB é recusada");
    const foto1 = await call("PUT", "/users/me/photo", asJulia, png, { "content-type": "image/png" });
    assert(foto1.status === 201 && String(foto1.body.photoUrl).startsWith(`/api/users/${julia.id}/photo`), "a pessoa coloca a foto");
    const vista = await call("GET", `/users/${julia.id}/photo`, token(dani, "MEMBER"));
    assert(vista.status === 200 && vista.type === "image/png" && vista.buf.equals(png), "colega da organização vê a foto");
    assert((await call("GET", `/users/${julia.id}/photo`, token(alheia, "ADMIN", op2!.id))).status === 404, "outra organização não vê a foto");
    await call("PUT", "/users/me/photo", asJulia, png, { "content-type": "image/png" });
    const ativas = await db.select({ id: userPhotosTable.id }).from(userPhotosTable).where(and(eq(userPhotosTable.userId, julia.id), eq(userPhotosTable.active, true)));
    const todas = await db.select({ id: userPhotosTable.id }).from(userPhotosTable).where(eq(userPhotosTable.userId, julia.id));
    assert(ativas.length === 1 && todas.length === 2, "trocar a foto desativa a anterior, sem apagar");
    assert((await call("DELETE", "/users/me/photo", asJulia)).status === 200 && (await call("GET", `/users/${julia.id}/photo`, asJulia)).status === 404, "tirar a foto desativa");
    const [semFoto] = await db.select({ photoUrl: usersTable.photoUrl }).from(usersTable).where(eq(usersTable.id, julia.id));
    assert(semFoto?.photoUrl === null && (await registro(julia.id, "user.foto_trocada")).length === 2 && (await registro(julia.id, "user.foto_retirada")).length === 1, "foto no Registro, sem a imagem");
    assert(!JSON.stringify(await registro(julia.id, "user.foto_trocada")).includes("iVBOR"), "o Registro não guarda a imagem");

    // ---------- Aniversários ----------
    const aniv = await call("GET", "/mural/aniversarios", asJulia);
    const hojeIds = aniv.body.hoje.map((p: { id: string }) => p.id), semanaIds = aniv.body.semana.map((p: { id: string }) => p.id);
    assert(hojeIds.includes(julia.id), "'mural no meu dia': sobe para o alto do mural no dia");
    assert(!hojeIds.includes(carol.id) && semanaIds.includes(carol.id), "'só na lista': aparece na lista da semana, sem subir no mural");
    assert(!hojeIds.includes(sofia.id) && !semanaIds.includes(sofia.id), "'não aparece': fica fora de tudo");
    assert(aniv.body.semana.find((p: { id: string }) => p.id === dani.id)?.emDias === 3, "aniversário daqui a 3 dias entra na lista da semana");
    assert(!/199[89]|2000|2001/.test(JSON.stringify(aniv.body)), "o ano (a idade) nunca sai");
    assert(!hojeIds.includes(alheia.id), "só aniversários da própria organização");
  } finally {
    if (server) { server.closeAllConnections?.(); await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve())); }
    await db.delete(historyEventsTable).where(or(inArray(historyEventsTable.orgId, [org!.id, outra!.id]), inArray(historyEventsTable.actorId, everyone), eq(historyEventsTable.entityId, org!.id)));
    await db.delete(notificationOutboxTable).where(inArray(notificationOutboxTable.userId, everyone));
    await db.delete(userNotificationsTable).where(inArray(userNotificationsTable.userId, everyone));
    await db.delete(userPhotosTable).where(inArray(userPhotosTable.userId, everyone));
    await db.delete(scalesTable).where(eq(scalesTable.id, escala!.id));
    await db.delete(programacaoBlocosTable).where(eq(programacaoBlocosTable.programacaoId, prog!.id));
    await db.delete(programacoesTable).where(eq(programacoesTable.id, prog!.id));
    await db.delete(areaLocalSupervisorsTable).where(eq(areaLocalSupervisorsTable.locationId, local!.id));
    await db.delete(userRolesTable).where(inArray(userRolesTable.userId, everyone));
    await db.delete(usersTable).where(inArray(usersTable.id, everyone));
    await db.delete(areasTable).where(eq(areasTable.id, area!.id));
    await db.delete(operationLocationsTable).where(eq(operationLocationsTable.locationId, local!.id));
    await db.delete(locationsTable).where(eq(locationsTable.id, local!.id));
    await db.delete(operationsTable).where(inArray(operationsTable.id, [op!.id, op2!.id]));
    await db.delete(organizationsTable).where(inArray(organizationsTable.id, [org!.id, outra!.id]));
  }
  if (failures.length > 0) throw new Error(`${failures.length} falha(s) nas regras do Perfil`);
  process.stdout.write(`fase-c-perfil-regras: ${passed} asserts passed\n`);
}

process.stdout.write("fase-c-perfil-regras: starting\n");
try {
  await run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
