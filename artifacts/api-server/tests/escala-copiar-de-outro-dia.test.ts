/**
 * Copiar de outro dia (H1, 30/10/2026): leva para um dia o que foi feito à mão em outro dia do mesmo local — atividades só do dia, ajustes por
 * pessoa, horário só de uma pessoa, edição da atividade no dia e chamadas — passando pelas regras da casa: folga vence, equipe por local,
 * local fechado, dia publicado espera republicação. Quem fica de fora volta com o motivo. Dá para desfazer enquanto ninguém mexeu nos itens.
 * PostgreSQL real de teste.
 */
import http from "node:http";
import { eq, inArray, or } from "drizzle-orm";
import {
  areaLocalSupervisorsTable, areasTable, db, escalaBlocoAjustesTable, escalaBlocoEdicoesTable, escalaChamadasTable, folgasTable, historyEventsTable,
  locationsTable, operationLocationsTable, operationsTable, organizationsTable, pool, programacaoBlocosTable, programacaoEquipeTable, programacoesTable,
  scaleAllocationsTable, scalesTable, userRolesTable, usersTable,
} from "@workspace/db";
import app from "../src/application.js";
import { signAccessToken } from "../src/lib/jwt.service.js";

let passed = 0;
const failures: string[] = [];
function assert(condition: boolean, message: string) {
  if (condition) passed += 1;
  else { failures.push(message); console.error(`  ✗ ${message}`); }
}

type Bloco = { key: string; rotulo: string; inicio: string; fim: string | null; pessoaIds: string[]; horarioDela?: { chaveOriginal: string }; chamada?: unknown; origem: string };
type Dia = { escala: { id: string; status: string; version: number; alteradaDesde: string | null } | null; blocos: Bloco[]; chamadas?: { nome: string }[] };
type ForaDe = { tipo: string; pessoa?: string; frase: string };
type Resumo = { estado: string; fechado?: string; jaEstava: number; jaTemAjustes: number; copia: { atividades: number; ajustes: number; horarios: number; edicoes: number; chamadas: number }; foraDe: ForaDe[] };

async function run() {
  const tag = `cop_${Date.now()}`;
  const ORIGEM = "2026-10-05"; // segunda
  const DEST1 = "2026-10-12", DEST_PUB = "2026-10-19", DEST_MEXIDO = "2026-10-26", TERCA = "2026-10-06", QUARTA = "2026-10-07";
  const [org] = await db.insert(organizationsTable).values({ name: `${tag}_org` }).returning();
  const [operation] = await db.insert(operationsTable).values({ organizationId: org!.id, name: `${tag}_op`, status: "ACTIVE" }).returning();
  const [local, local2] = await db.insert(locationsTable).values([{ organizationId: org!.id, name: `${tag}_Snowland` }, { organizationId: org!.id, name: `${tag}_Acqua` }]).returning();
  await db.insert(operationLocationsTable).values([{ operationId: operation!.id, locationId: local!.id }, { operationId: operation!.id, locationId: local2!.id }]);
  const [pat] = await db.insert(areasTable).values([{ organizationId: org!.id, name: `${tag}_Patinadores` }]).returning();
  const mk = async (suffix: string, areaId: string | null) => (await db.insert(usersTable).values({ organizationId: org!.id, name: `${tag}_${suffix}`, username: `${tag}_${suffix}`, areaId }).returning())[0]!;
  const admin = await mk("admin", null), dir = await mk("dir", null), supPat = await mk("deborah", pat!.id), supSem = await mk("supsem", null);
  const jeff = await mk("jeff", pat!.id), carol = await mk("carol", pat!.id), dana = await mk("dana", pat!.id), gil = await mk("gil", pat!.id), frank = await mk("frank", pat!.id);
  const todos = [admin, dir, supPat, supSem, jeff, carol, dana, gil, frank];
  await db.insert(userRolesTable).values([
    { userId: admin.id, operationId: operation!.id, role: "ADMIN", active: true },
    { userId: dir.id, operationId: operation!.id, role: "DIR", active: true },
    { userId: supPat.id, operationId: operation!.id, role: "SUPERVISOR_A", active: true },
    { userId: supSem.id, operationId: operation!.id, role: "SUPERVISOR_A", active: true },
    ...[jeff, carol, dana, gil, frank].map((u) => ({ userId: u.id, operationId: operation!.id, role: "MEMBER" as const, active: true })),
  ]);
  await db.insert(areaLocalSupervisorsTable).values([{ areaId: pat!.id, locationId: local!.id, supervisorId: supPat.id }]);
  // O local só abre segunda e terça: a quarta é dia fechado.
  await db.update(locationsTable).set({ operatingDays: [1, 2] }).where(eq(locationsTable.id, local!.id));

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
    const asAdmin = as(admin, "ADMIN"), asDir = as(dir, "DIR"), asPat = as(supPat, "SUPERVISOR_A"), asSem = as(supSem, "SUPERVISOR_A"), asJeff = as(jeff, "MEMBER");

    // Programação: segunda tem TREINO GELO e ENSAIO; terça só o TREINO GELO (mesmo nome e hora, outro bloco).
    const prog = (await asAdmin("POST", "/programacoes", { locationId: local!.id, nome: "Natal", vigenciaInicio: "2026-10-01", vigenciaFim: "2026-10-31" })).body.programacao as { id: string };
    for (const b of [
      { weekday: 1, inicio: "10:00", fim: "11:00", rotulo: "TREINO GELO", regra: "pessoas", pessoaIds: [jeff.id, carol.id] },
      { weekday: 1, inicio: "14:00", fim: "15:00", rotulo: "ENSAIO", regra: "pessoas", pessoaIds: [carol.id] },
      { weekday: 2, inicio: "10:00", fim: "11:00", rotulo: "TREINO GELO", regra: "pessoas", pessoaIds: [carol.id] },
    ]) assert((await asAdmin("POST", `/programacoes/${prog.id}/blocos`, b)).status === 201, `bloco ${b.rotulo} criado`);
    // Equipe por local: o Frank é da equipe do outro local às segundas.
    const prog2 = (await asAdmin("POST", "/programacoes", { locationId: local2!.id, nome: "Natal", vigenciaInicio: "2026-10-01", vigenciaFim: "2026-10-31" })).body.programacao as { id: string };
    const eq1 = await asAdmin("PUT", `/programacoes/${prog2.id}/equipe`, { baseVersao: null, linhas: [{ userId: frank.id, weekday: 1 }] });
    assert(eq1.status === 200, "equipe do outro local gravada");
    // Folga do Gil no destino 1.
    await db.insert(folgasTable).values({ userId: gil.id, operationId: operation!.id, type: "DAY_OFF", startDate: DEST1, endDate: DEST1, status: "ACTIVE", createdBy: admin.id });

    const dia = async (date: string) => ((await asAdmin("GET", `/escalas/dia?locationId=${local!.id}&date=${date}`)).body.dia as Dia);
    const achar = (d: Dia, rotulo: string) => d.blocos.find((b) => b.rotulo === rotulo && !b.horarioDela && !b.chamada);

    // ── monta o dia de origem à mão ──
    let o = await dia(ORIGEM);
    const treino = achar(o, "TREINO GELO")!, ensaio = achar(o, "ENSAIO")!;
    const ajuste = (body: Record<string, unknown>) => asAdmin("POST", "/escalas/dia/ajustes", { locationId: local!.id, date: ORIGEM, ...body });
    assert((await ajuste({ sourceKey: treino.key, userId: dana.id, action: "ADICIONAR" })).status === 200, "origem: Dana entra no treino");
    assert((await ajuste({ sourceKey: treino.key, userId: carol.id, action: "REMOVER" })).status === 200, "origem: Carol sai do treino");
    assert((await ajuste({ sourceKey: treino.key, userId: frank.id, action: "ADICIONAR" })).status === 200, "origem: Frank entra no treino");
    assert((await ajuste({ sourceKey: ensaio.key, userId: gil.id, action: "ADICIONAR" })).status === 200, "origem: Gil entra no ensaio");
    assert((await asAdmin("POST", "/escalas/dia/horario", { locationId: local!.id, date: ORIGEM, sourceKey: treino.key, userId: jeff.id, inicio: "10:20", fim: "11:00" })).status === 200, "origem: horário só do Jeff");
    assert((await asAdmin("POST", "/escalas/dia/editar", { locationId: local!.id, date: ORIGEM, sourceKey: treino.key, rotulo: "TREINO GELO ESPECIAL", inicio: "10:00", fim: "11:00" })).status === 200, "origem: atividade editada só neste dia");
    o = await dia(ORIGEM);
    const escalaOrigem = o.escala!.id;
    const manuaisOrigem = await db.insert(scaleAllocationsTable).values([jeff, gil].map((u) => ({ scaleId: escalaOrigem, userId: u.id, status: "MANUAL_OVERRIDE" as const, manualDate: ORIGEM, manualLabel: "PERUCA", startTime: "14:00", endTime: "14:30", overriddenBy: admin.id }))).returning();
    // A chamada guardada no dia é a da atividade criada só naquele dia (a da Programação mora na Programação).
    await db.insert(escalaChamadasTable).values({ organizationId: org!.id, scaleId: escalaOrigem, blocoKey: `m:${manuaisOrigem[0]!.id}`, nome: "Aquecimento", modo: "fixo", horaFixa: "13:30", duracaoMin: 15, createdBy: admin.id });

    // ── quem pode ──
    const pedido = (extra: Record<string, unknown> = {}) => ({ locationId: local!.id, origem: ORIGEM, destino: DEST1, ...extra });
    const dirTenta = await asDir("POST", "/escalas/dia/copiar", pedido({ simular: true }));
    assert(dirTenta.status === 403 && /Direção/.test(dirTenta.text) && /Supervisão/.test(dirTenta.text), "Direção é recusada, com a frase de quem pode e do perfil de quem tentou");
    assert((await asJeff("POST", "/escalas/dia/copiar", pedido({ simular: true }))).status === 403, "Elenco não copia");
    assert((await asSem("POST", "/escalas/dia/copiar", pedido({ simular: true }))).status === 403, "Supervisão sem acesso ao local não copia");
    assert((await asDir("GET", `/escalas/copia/origens?locationId=${local!.id}&date=${DEST1}`)).status === 403, "Direção também não vê a lista de dias para copiar");
    const semEscala = await asAdmin("POST", "/escalas/dia/copiar", pedido({ origem: "2026-10-14", simular: true }));
    assert(semEscala.status === 409 && /não tem Escala/.test(semEscala.text), "origem sem Escala: 409 com a frase");
    assert((await asAdmin("POST", "/escalas/dia/copiar", pedido({ destino: "2026-13-45" }))).status === 400, "data inválida: 400");

    // ── a lista de dias que servem de origem ──
    const origens = (await asPat("GET", `/escalas/copia/origens?locationId=${local!.id}&date=${DEST1}`)).body.origens as { date: string; ajustes: number; horarios: number; edicoes: number; atividades: number; chamadas: number; diaDaSemana: string }[];
    const daOrigem = origens.find((x) => x.date === ORIGEM);
    assert(Boolean(daOrigem) && daOrigem!.ajustes === 4 && daOrigem!.horarios === 1 && daOrigem!.edicoes === 1 && daOrigem!.atividades === 1 && daOrigem!.chamadas === 1 && daOrigem!.diaDaSemana === "segunda", "a origem aparece na lista com a contagem de cada item");

    // ── prévia: não grava nada ──
    const previa = await asPat("POST", "/escalas/dia/copiar", pedido({ simular: true }));
    const r = previa.body.resumo as Resumo;
    assert(previa.status === 200 && previa.body.gravou === false, "a prévia não grava");
    assert(r.copia.atividades === 1 && r.copia.ajustes === 2 && r.copia.horarios === 1 && r.copia.edicoes === 1 && r.copia.chamadas === 1, "a prévia conta o que vai: 1 atividade, 2 ajustes, 1 horário, 1 edição, 1 chamada");
    assert(r.foraDe.some((f) => f.tipo === "folga" && f.pessoa?.endsWith("gil") && /folga/.test(f.frase)), "o Gil fica de fora pela folga, com a frase");
    assert(r.foraDe.some((f) => f.tipo === "outro_local" && f.pessoa?.endsWith("frank") && /equipe/.test(f.frase)), "o Frank fica de fora por ser da equipe de outro local");
    assert((await db.select().from(escalaBlocoAjustesTable).where(eq(escalaBlocoAjustesTable.userId, dana.id))).length === 1, "depois da prévia só existe o ajuste da origem (nada foi copiado)");

    // ── copia de verdade, pela Supervisão ──
    const copia = await asPat("POST", "/escalas/dia/copiar", pedido());
    assert(copia.status === 201 && copia.body.gravou === true && typeof copia.body.eventoId === "string", "a Supervisão da área copia");
    const eventoCopia1 = copia.body.eventoId as string;
    let d = await dia(DEST1);
    const treino1 = achar(d, "TREINO GELO ESPECIAL");
    assert(Boolean(treino1) && treino1!.pessoaIds.includes(dana.id) && !treino1!.pessoaIds.includes(carol.id) && !treino1!.pessoaIds.includes(frank.id), "no destino: Dana entrou, Carol saiu e o Frank não entrou");
    assert(d.blocos.some((b) => b.horarioDela?.chaveOriginal === treino1!.key && b.pessoaIds.includes(jeff.id) && b.inicio === "10:20"), "no destino: o horário só do Jeff veio junto");
    const peruca = d.blocos.find((b) => b.rotulo === "PERUCA");
    assert(Boolean(peruca) && peruca!.pessoaIds.length === 1 && peruca!.pessoaIds[0] === jeff.id, "no destino: a atividade só do dia veio só com o Jeff (o Gil está de folga)");
    const chamadasDoDestino = await db.select().from(escalaChamadasTable).where(eq(escalaChamadasTable.scaleId, d.escala!.id));
    assert(chamadasDoDestino.length === 1 && chamadasDoDestino[0]!.nome === "Aquecimento" && chamadasDoDestino[0]!.blocoKey?.startsWith("m:") === true && chamadasDoDestino[0]!.blocoKey !== `m:${manuaisOrigem[0]!.id}`, "no destino: a chamada veio junto, ligada à atividade nova do destino");
    assert(d.blocos.some((b) => (b.chamada as { nome?: string } | undefined)?.nome === "Aquecimento" && b.inicio === "13:30"), "no destino: a Escala mostra a chamada das 13:30");
    const evs = (await db.select().from(historyEventsTable).where(eq(historyEventsTable.id, eventoCopia1)));
    assert(evs.length === 1 && evs[0]!.action === "escala.copiada_de_outro_dia" && /2026-10-05/.test(evs[0]!.narrative) && /gil/.test(evs[0]!.narrative), "entrou no Registro dizendo de onde veio e quem ficou de fora");
    assert((await db.select().from(historyEventsTable).where(eq(historyEventsTable.entityId, d.escala!.id))).filter((e) => e.action === "escala.copiada_de_outro_dia").length === 1, "um evento só por dia copiado");

    // Copiar de novo, juntando: nada muda e a janela diz que já estava.
    const repete = await asPat("POST", "/escalas/dia/copiar", pedido());
    assert(repete.status === 200 && repete.body.gravou === false && (repete.body.resumo as Resumo).jaEstava > 0, "copiar de novo não duplica nada: tudo já estava");
    assert((await db.select().from(escalaBlocoAjustesTable).where(eq(escalaBlocoAjustesTable.userId, dana.id))).length === 2, "continua um ajuste da Dana na origem e um no destino");

    // ── "começar do zero": pede motivo, não apaga, e dá para desfazer ──
    const semMotivo = await asPat("POST", "/escalas/dia/copiar", pedido({ modo: "zero" }));
    assert(semMotivo.status === 400 && /motivo/.test(semMotivo.text), "começar do zero sem motivo: 400 com a frase");
    const zero = await asPat("POST", "/escalas/dia/copiar", pedido({ modo: "zero", motivo: "Refazer a partir de segunda" }));
    assert(zero.status === 201, "começar do zero com motivo copia");
    const emptyAntes = (await db.select().from(escalaBlocoAjustesTable).where(eq(escalaBlocoAjustesTable.scaleId, d.escala!.id)));
    assert(emptyAntes.some((a) => !a.active) && emptyAntes.some((a) => a.active), "o que havia ficou inativo (nada apagado) e o novo está ativo");
    const desZero = await asPat("POST", "/escalas/dia/copiar/desfazer", { eventoId: zero.body.eventoId });
    assert(desZero.status === 200 && desZero.body.ok === true, "desfazer o 'do zero' devolve o que havia antes");
    d = await dia(DEST1);
    assert(Boolean(achar(d, "TREINO GELO ESPECIAL")) && d.blocos.some((b) => b.rotulo === "PERUCA"), "o dia voltou a ter o que a primeira cópia trouxe");
    assert((await asPat("POST", "/escalas/dia/copiar/desfazer", { eventoId: zero.body.eventoId })).status === 409, "desfazer duas vezes a mesma cópia: 409");

    // ── outro dia da semana: casa por nome e horário e lista o que não casou ──
    const terca = await asAdmin("POST", "/escalas/dia/copiar", pedido({ destino: TERCA, simular: true }));
    const rt = terca.body.resumo as Resumo;
    assert(rt.copia.ajustes >= 1 && rt.foraDe.some((f) => f.tipo === "sem_atividade" && /ENSAIO/.test(f.frase)), "terça: o treino casa por nome e horário; o ensaio não existe e vai para 'de fora'");

    // ── dia fechado ──
    const quarta = await asAdmin("POST", "/escalas/dia/copiar", pedido({ destino: QUARTA, simular: true }));
    assert((quarta.body.resumo as Resumo).estado === "fechado" && /não abre/.test((quarta.body.resumo as Resumo).fechado ?? ""), "dia fechado: a prévia diz que o local não abre");
    const quartaGrava = await asAdmin("POST", "/escalas/dia/copiar", pedido({ destino: QUARTA }));
    assert(quartaGrava.status === 409 && /não abre/.test(quartaGrava.text), "dia fechado: copiar é recusado com a frase");

    // ── destino já publicado: marca 'alterada depois de publicada' e avisa a Administração ──
    const [pub] = await db.insert(scalesTable).values({ operationId: operation!.id, locationId: local!.id, title: `pub ${DEST_PUB}`, periodStart: DEST_PUB, periodEnd: DEST_PUB, status: "PUBLISHED", publishedAt: new Date(), generatedAt: new Date(), createdBy: admin.id }).returning();
    const pubPrevia = await asPat("POST", "/escalas/dia/copiar", pedido({ destino: DEST_PUB, simular: true }));
    assert((pubPrevia.body.resumo as Resumo).estado === "publicado", "a prévia avisa que o destino está publicado");
    const pubCopia = await asPat("POST", "/escalas/dia/copiar", pedido({ destino: DEST_PUB }));
    const depoisPub = (await db.select().from(scalesTable).where(eq(scalesTable.id, pub!.id)))[0]!;
    assert(pubCopia.status === 201 && depoisPub.alteradaDesde !== null && depoisPub.version === pub!.version + 1, "destino publicado: marca 'alterada depois de publicada' e sobe a versão");
    const avisos = await pool.query(`select count(*)::int as n from notification_outbox where user_id = $1 and payload->>'type' = 'scale.needs_republish'`, [admin.id]);
    assert(avisos.rows[0].n >= 1, "a Administração é avisada de que há o que republicar");
    const desPub = await asPat("POST", "/escalas/dia/copiar/desfazer", { eventoId: pubCopia.body.eventoId });
    assert(desPub.status === 200 && desPub.body.ok === true, "dá para desfazer a cópia no dia publicado");
    assert((await db.select().from(escalaBlocoAjustesTable).where(eq(escalaBlocoAjustesTable.scaleId, pub!.id))).every((a) => !a.active), "depois de desfazer não sobra ajuste ativo no destino");

    // ── alguém mexeu depois: o desfazer diz o que não dá ──
    const mexido = await asPat("POST", "/escalas/dia/copiar", pedido({ destino: DEST_MEXIDO }));
    assert(mexido.status === 201, "cópia para o quarto dia");
    const dm = await dia(DEST_MEXIDO);
    const tm = achar(dm, "TREINO GELO ESPECIAL")!;
    assert((await asAdmin("POST", "/escalas/dia/ajustes", { locationId: local!.id, date: DEST_MEXIDO, sourceKey: tm.key, userId: dana.id, action: "REMOVER" })).status === 200, "alguém tira a Dana do treino depois da cópia");
    const desMexido = await asPat("POST", "/escalas/dia/copiar/desfazer", { eventoId: mexido.body.eventoId });
    assert(desMexido.status === 200 && desMexido.body.ok === false && (desMexido.body.naoDesfeitos as string[]).some((f) => /ajuste/.test(f)), "desfazer diz o que já tinha sido mexido e não pôde voltar");

    // ── versão da origem: se a origem foi publicada e mudou depois, pede a escolha ──
    await db.update(scalesTable).set({ status: "PUBLISHED", publishedAt: new Date(Date.now() - 60_000), alteradaDesde: new Date() }).where(eq(scalesTable.id, escalaOrigem));
    const semVersao = await asPat("POST", "/escalas/dia/copiar", pedido({ destino: DEST_MEXIDO }));
    assert(semVersao.status === 400 && /versão/.test(semVersao.text), "origem publicada que mudou depois: pede qual versão copiar");
  } finally {
    if (server) { server.closeAllConnections?.(); await new Promise<void>((resolve) => server!.close(() => resolve())); }
    const ids = todos.map((u) => u.id);
    await db.delete(historyEventsTable).where(or(eq(historyEventsTable.orgId, org!.id), inArray(historyEventsTable.actorId, ids)));
    await pool.query(`delete from notification_outbox where user_id = any($1::uuid[])`, [ids]);
    await pool.query(`delete from user_notifications where user_id = any($1::uuid[])`, [ids]);
    await pool.query(`delete from notifications where user_id = any($1::uuid[])`, [ids]);
    const escalas = await db.select({ id: scalesTable.id }).from(scalesTable).where(eq(scalesTable.operationId, operation!.id));
    if (escalas.length) {
      const sids = escalas.map((s) => s.id);
      await db.delete(escalaBlocoAjustesTable).where(inArray(escalaBlocoAjustesTable.scaleId, sids));
      await db.delete(escalaBlocoEdicoesTable).where(inArray(escalaBlocoEdicoesTable.scaleId, sids));
      await db.delete(escalaChamadasTable).where(inArray(escalaChamadasTable.scaleId, sids));
      await db.delete(scaleAllocationsTable).where(inArray(scaleAllocationsTable.scaleId, sids));
    }
    await db.delete(scalesTable).where(eq(scalesTable.operationId, operation!.id));
    await db.delete(folgasTable).where(inArray(folgasTable.userId, ids));
    const progs = await db.select({ id: programacoesTable.id }).from(programacoesTable).where(inArray(programacoesTable.locationId, [local!.id, local2!.id]));
    if (progs.length) {
      await db.delete(programacaoEquipeTable).where(inArray(programacaoEquipeTable.programacaoId, progs.map((p) => p.id)));
      await db.delete(programacaoBlocosTable).where(inArray(programacaoBlocosTable.programacaoId, progs.map((p) => p.id)));
    }
    await db.delete(programacoesTable).where(inArray(programacoesTable.locationId, [local!.id, local2!.id]));
    await db.delete(areaLocalSupervisorsTable).where(eq(areaLocalSupervisorsTable.locationId, local!.id));
    await db.delete(userRolesTable).where(eq(userRolesTable.operationId, operation!.id));
    await db.delete(usersTable).where(inArray(usersTable.id, ids));
    await db.delete(areasTable).where(eq(areasTable.id, pat!.id));
    await db.delete(operationLocationsTable).where(inArray(operationLocationsTable.locationId, [local!.id, local2!.id]));
    await db.delete(locationsTable).where(inArray(locationsTable.id, [local!.id, local2!.id]));
    await db.delete(operationsTable).where(eq(operationsTable.id, operation!.id));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, org!.id));
  }
  if (failures.length > 0) throw new Error(`${failures.length} falha(s) em escala-copiar-de-outro-dia`);
  process.stdout.write(`escala-copiar-de-outro-dia: ${passed} asserts passed\n`);
}

process.stdout.write("escala-copiar-de-outro-dia: starting\n");
try {
  await run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
