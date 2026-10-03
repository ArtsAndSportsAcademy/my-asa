/**
 * 17 Meu Dia — a tela que abre depois do login, nos quatro perfis. Mesma estrutura sempre (referência
 * `17 Meu Dia.dc.html`): quem fala com você, o que vem agora, o dia em linha do tempo, o que depende de
 * você e três linhas do Mural. Tudo lido da Escala do dia (tela 15), do check-in, das tarefas, das
 * folgas e do Mural; a tela só desenha.
 *
 * Dado sensível (doc 12): ocorrência só aparece com nome para a própria pessoa, a supervisão dela e a
 * Administração. A Direção vê número, nunca nome.
 */
import { and, desc, eq, gte, inArray, isNull, lte, notInArray, or, sql } from "drizzle-orm";
import {
  announcementsTable,
  dayCheckInsTable,
  db,
  leaveRequestsTable,
  locationsTable,
  occurrencesTable,
  responsibilitiesTable,
  responsibilityAssignmentsTable,
  tasksTable,
  usersTable,
} from "@workspace/db";
import { operationalDate, OPERATIONAL_TIME_ZONE, shiftOperationalDate } from "../lib/operational-date.js";
import { APP_ROUTES } from "../lib/app-routes.js";
import { escalaPublicada, montarEscalaDoDia, type BlocoDia, type EscalaDia } from "./escala-dia.js";
import { listAreaLocalScopes } from "./area-local-scope.js";
import { canReadAnnouncement } from "./announcement-access.js";
import { aniversariosDaCasa } from "./aniversarios.js";
import { pedidosEsperando } from "./solicitacoes.js";

export type Perfil = "adm" | "dir" | "sup" | "mem";
type Tom = "ok" | "warn" | "mute" | "mine";
export type Mascote = "bom-dia" | "aviso-importante" | "estudando" | "consultando" | "tarefa-concluida" | "lembrete" | "duvida" | "sonolenta";
export type LinhaDoDia = { time: string; title: string; sub: string; tag: string; tone: Tom; href?: string };
export type Pendencia = { count: number; title: string; sub: string; tone: Exclude<Tom, "mine">; href: string };
export type Acao = { label: string; href: string } | { label: string; checkIn: { scaleId: string; sourceKey: string; date: string } };
export type MeuDia = {
  perfil: Perfil; nome: string; data: string; hora: string;
  saudacao: { titulo: string; texto: string; mascote: Mascote; acao: Acao | null };
  proximo: { rotulo: string; link: string; href: string; time: string; rel: string; title: string; sub: string; chips: string[] } | null;
  linhaDoTempo: { rotulo: string; dica: string; itens: LinhaDoDia[] };
  pendencias: { titulo: string; mascote: Mascote; itens: Pendencia[] };
  mural: { icone: "vencemos" | "atencao" | "olhos-de-estrela"; texto: string }[];
};

const OPEN_TASK = ["CREATED", "IN_PROGRESS", "READY_FOR_APPROVAL", "CHANGES_REQUESTED"] as const;
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const curta = (iso: string) => { const [, m, d] = iso.split("-").map(Number); return `${d} ${MESES[m! - 1]}`; };
const min = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return h! * 60 + (m ?? 0); };
const fimDe = (b: Pick<BlocoDia, "inicio" | "fim">) => b.fim ? min(b.fim) : min(b.inicio) + 60;
const texto = (b: Pick<BlocoDia, "rotulo" | "inicio" | "regra">) => b.regra === "livro" && !b.rotulo.includes(":") ? `${b.rotulo} ${b.inicio}` : b.rotulo;
const plural = (n: number, um: string, muitos: string) => `${n} ${n === 1 ? um : muitos}`;
function relogio(now: Date) {
  const hhmm = new Intl.DateTimeFormat("en-GB", { timeZone: OPERATIONAL_TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now);
  return { hhmm, minutos: min(hhmm) };
}
function rel(inicio: string, agora: number) {
  const d = min(inicio) - agora;
  if (d <= 0) return "agora";
  if (d < 60) return `em ${d} min`;
  const h = Math.floor(d / 60), m = d % 60;
  return `em ${h}h${m ? String(m).padStart(2, "0") : ""}`;
}
const saudar = (agora: number, nome: string) => `${agora < 12 * 60 ? "Bom dia" : agora < 18 * 60 ? "Boa tarde" : "Boa noite"}, ${nome.split(" ")[0]}!`;

async function mural(actor: { sub: string; organizationId: string; role: string }): Promise<MeuDia["mural"]> {
  const rows = await db.select({
    id: announcementsTable.id, type: announcementsTable.type, scope: announcementsTable.scope, title: announcementsTable.title, body: announcementsTable.body,
    areaId: announcementsTable.areaId, locationId: announcementsTable.locationId, recipientId: announcementsTable.recipientId, authorId: announcementsTable.authorId, authorName: usersTable.name,
  }).from(announcementsTable).innerJoin(usersTable, eq(announcementsTable.authorId, usersTable.id))
    .where(and(eq(announcementsTable.orgId, actor.organizationId), eq(announcementsTable.active, true), isNull(announcementsTable.cancelledAt)))
    .orderBy(desc(announcementsTable.publishedAt)).limit(20);
  const out: MeuDia["mural"] = [];
  // Aniversário de hoje sobe para o alto (só quem escolheu "mural no meu dia"; dia e mês, nunca o ano).
  const { hoje: aniversarios } = await aniversariosDaCasa(actor.organizationId);
  if (aniversarios.length) out.push({ icone: "olhos-de-estrela", texto: aniversarios.length === 1 ? `Hoje é aniversário de ${aniversarios[0]!.nome}! 🎂` : `Hoje é aniversário de ${aniversarios.slice(0, -1).map((p) => p.nome).join(", ")} e ${aniversarios.at(-1)!.nome}! 🎂` });
  for (const post of rows) {
    if (out.length === 3) break;
    if (!(await canReadAnnouncement({ userId: actor.sub, organizationId: actor.organizationId, role: actor.role }, post))) continue;
    const corpo = (post.title ?? post.body).replace(/\s+/g, " ").trim();
    out.push({ icone: post.type === "RECOGNITION" ? "vencemos" : "atencao", texto: `${corpo.length > 110 ? `${corpo.slice(0, 107)}…` : corpo} — ${post.authorName}` });
  }
  return out;
}

async function tarefasDe(userId: string, hoje: string) {
  const rows = await db.select({ dueDate: tasksTable.dueDate, evid: tasksTable.mandatoryEvidences }).from(tasksTable)
    .where(and(eq(tasksTable.assigneeId, userId), inArray(tasksTable.status, [...OPEN_TASK]), lte(tasksTable.dueDate, hoje)));
  return { total: rows.length, atrasadas: rows.filter((r) => r.dueDate < hoje).length, comEvidencia: rows.filter((r) => Array.isArray(r.evid) && r.evid.length > 0).length };
}

type Dias = { hoje: EscalaDia | null; amanha: EscalaDia | null };
async function diasDoLocal(orgId: string, locationId: string, hoje: string, amanha: string): Promise<Dias> {
  const [a, b] = await Promise.all([montarEscalaDoDia(orgId, locationId, hoje), montarEscalaDoDia(orgId, locationId, amanha)]);
  return { hoje: a, amanha: b };
}
async function feitosNaEscala(scaleId: string | undefined) {
  if (!scaleId) return new Map<string, { status: string; at: Date | null }[]>();
  const rows = await db.select({ userId: dayCheckInsTable.userId, status: dayCheckInsTable.status, sourceKey: dayCheckInsTable.sourceKey, at: dayCheckInsTable.checkedInAt }).from(dayCheckInsTable).where(eq(dayCheckInsTable.scaleId, scaleId));
  const out = new Map<string, { status: string; at: Date | null; sourceKey: string }[]>();
  for (const r of rows) out.set(r.userId, [...(out.get(r.userId) ?? []), r]);
  return out;
}
const chegou = (rows: { status: string }[] | undefined) => (rows ?? []).some((r) => r.status === "CHECKED_IN" || r.status === "LATE");

/** Check-in em falta: pessoa cujo primeiro bloco já começou e ainda não marcou presença. */
function faltandoCheckIn(dia: EscalaDia, feitos: Map<string, { status: string }[]>, agora: number, pessoas: Set<string> | null) {
  const primeiro = new Map<string, BlocoDia>();
  for (const b of [...dia.blocos].sort((x, y) => x.inicio.localeCompare(y.inicio))) for (const p of b.pessoaIds) if (!primeiro.has(p)) primeiro.set(p, b);
  return [...primeiro].filter(([p, b]) => (!pessoas || pessoas.has(p)) && min(b.inicio) <= agora && !chegou(feitos.get(p))).map(([p, b]) => ({ pessoa: p, bloco: b }));
}

export async function montarMeuDia(actor: { sub: string; organizationId: string; role: string }, perfil: Perfil, now = new Date()): Promise<MeuDia> {
  const hoje = operationalDate(now), amanha = shiftOperationalDate(hoje, 1);
  const { hhmm, minutos: agora } = relogio(now);
  const [me] = await db.select({ name: usersTable.name, areaId: usersTable.areaId, locationId: usersTable.defaultLocationId }).from(usersTable).where(eq(usersTable.id, actor.sub)).limit(1);
  const nome = me?.name ?? "";
  const muralP = mural(actor);

  if (perfil === "mem") return { ...(await elenco(actor, nome, me?.locationId ?? null, hoje, amanha, agora)), perfil, nome, data: hoje, hora: hhmm, mural: await muralP };
  if (perfil === "sup") return { ...(await supervisao(actor, nome, hoje, amanha, agora)), perfil, nome, data: hoje, hora: hhmm, mural: await muralP };
  return { ...(await gestao(actor, nome, perfil, hoje, amanha, agora)), perfil, nome, data: hoje, hora: hhmm, mural: await muralP };
}

type Parte = Omit<MeuDia, "perfil" | "nome" | "data" | "hora" | "mural">;

async function elenco(actor: { sub: string; organizationId: string; role: string }, nome: string, locationId: string | null, hoje: string, amanha: string, agora: number): Promise<Parte> {
  const dias = locationId ? await diasDoLocal(actor.organizationId, locationId, hoje, amanha) : { hoje: null, amanha: null };
  const pub = dias.hoje && escalaPublicada(dias.hoje.escala?.status) ? dias.hoje : null;
  const meus = (pub?.blocos ?? []).filter((b) => b.pessoaIds.includes(actor.sub)).sort((a, b) => a.inicio.localeCompare(b.inicio));
  const amanhaPub = dias.amanha && escalaPublicada(dias.amanha.escala?.status) ? dias.amanha.blocos.filter((b) => b.pessoaIds.includes(actor.sub)).sort((a, b) => a.inicio.localeCompare(b.inicio)) : [];
  const folga = pub?.pessoas.find((p) => p.id === actor.sub)?.folga ?? dias.hoje?.pessoas.find((p) => p.id === actor.sub)?.folga ?? null;
  const feitos = (await feitosNaEscala(pub?.escala?.id)).get(actor.sub) ?? [];
  const jaChegou = feitos.find((r) => r.status === "CHECKED_IN" || r.status === "LATE");
  const local = pub?.location.name ?? dias.hoje?.location.name ?? "";

  const alvo = meus.find((b) => fimDe(b) > agora) ?? null;
  let saudacao: Parte["saudacao"];
  if (folga) saudacao = { titulo: saudar(agora, nome), texto: "Hoje é o seu dia de folga. Nenhum bloco para você — descansa.", mascote: "sonolenta", acao: { label: "Ver minha escala", href: APP_ROUTES.escalas } };
  else if (!meus.length) saudacao = { titulo: saudar(agora, nome), texto: pub ? "Você não tem nenhum bloco na escala de hoje." : "A escala de hoje ainda não foi publicada. Quando sair, seu dia aparece aqui.", mascote: "sonolenta", acao: { label: "Ver minha escala", href: APP_ROUTES.escalas } };
  else if (jaChegou) saudacao = { titulo: "Tudo certo por aqui!", texto: `Check-in feito${jaChegou.at ? ` às ${new Intl.DateTimeFormat("pt-BR", { timeZone: OPERATIONAL_TIME_ZONE, hour: "2-digit", minute: "2-digit" }).format(jaChegou.at)}` : ""}${jaChegou.status === "LATE" ? ", com atraso avisado" : ""} — bom trabalho hoje!`, mascote: "tarefa-concluida", acao: { label: "Ver minha escala", href: APP_ROUTES.escalas } };
  else if (alvo) saudacao = { titulo: saudar(agora, nome), texto: `Você entra às ${meus[0]!.inicio} em ${texto(meus[0]!)}. Faz o check-in por aqui mesmo — leva um toque.`, mascote: "bom-dia", acao: { label: "Fazer check-in", checkIn: { scaleId: pub!.escala!.id, sourceKey: alvo.key, date: hoje } } };
  else saudacao = { titulo: saudar(agora, nome), texto: "Seus blocos de hoje já terminaram.", mascote: "tarefa-concluida", acao: { label: "Ver minha escala", href: APP_ROUTES.escalas } };

  const prox = alvo;
  const proximo: Parte["proximo"] = prox
    ? { rotulo: "Sua próxima atividade", link: prox.dailyBookId ? "abrir Livro do Dia" : "ver minha escala", href: prox.dailyBookId ? APP_ROUTES.livroDoDia : APP_ROUTES.escalas, time: prox.inicio, rel: rel(prox.inicio, agora), title: texto(prox), sub: `${local}${prox.fim ? ` · até ${prox.fim}` : ""}${prox.dailyBookId ? " · Livro do Dia" : ""}`, chips: [local].filter(Boolean) }
    : amanhaPub[0] ? { rotulo: "Sua próxima atividade", link: "ver minha escala", href: APP_ROUTES.escalas, time: amanhaPub[0].inicio, rel: "amanhã", title: texto(amanhaPub[0]), sub: `${dias.amanha?.location.name ?? ""} · escala de amanhã publicada`, chips: [] } : null;

  const itens: LinhaDoDia[] = meus.map((b) => {
    const passou = fimDe(b) <= agora, emCurso = min(b.inicio) <= agora && !passou;
    return { time: b.inicio, title: texto(b), sub: b.fim ? `até ${b.fim}` : local, tag: emCurso ? "agora" : passou ? "passou" : b.dailyBookId ? "show" : "", tone: emCurso ? "ok" : passou ? "mute" : b.dailyBookId ? "mine" : "mute", href: b.dailyBookId ? APP_ROUTES.livroDoDia : undefined };
  });

  const [tarefas, folgas, pedidos] = await Promise.all([
    tarefasDe(actor.sub, hoje),
    db.select({ startDate: leaveRequestsTable.startDate, endDate: leaveRequestsTable.endDate }).from(leaveRequestsTable).where(and(eq(leaveRequestsTable.userId, actor.sub), eq(leaveRequestsTable.status, "PENDING"))),
    pedidosEsperando(actor),
  ]);
  const pend: Pendencia[] = [];
  if (pedidos.colegaEspera) pend.push({ count: pedidos.colegaEspera, title: pedidos.colegaEspera === 1 ? "Troca esperando você" : "Trocas esperando você", sub: "uma colega pediu para trocar", tone: "warn", href: APP_ROUTES.solicitacoes });
  if (pedidos.meusEmAnalise) pend.push({ count: pedidos.meusEmAnalise, title: pedidos.meusEmAnalise === 1 ? "Pedido em análise" : "Pedidos em análise", sub: "em Solicitações", tone: "mute", href: APP_ROUTES.solicitacoes });
  if (tarefas.total) pend.push({ count: tarefas.total, title: tarefas.total === 1 ? "Tarefa para hoje" : "Tarefas para hoje", sub: tarefas.atrasadas ? `${plural(tarefas.atrasadas, "atrasada", "atrasadas")}` : tarefas.comEvidencia ? `${plural(tarefas.comEvidencia, "pede evidência", "pedem evidência")}` : "vencem hoje", tone: tarefas.atrasadas ? "warn" : "warn", href: APP_ROUTES.responsabilidades });
  if (folgas.length) pend.push({ count: folgas.length, title: folgas.length === 1 ? "Pedido de folga em análise" : "Pedidos de folga em análise", sub: folgas.map((f) => f.startDate === f.endDate ? curta(f.startDate) : `${curta(f.startDate)} a ${curta(f.endDate)}`).join(" · "), tone: "mute", href: APP_ROUTES.folgas });
  if (amanhaPub.length) pend.push({ count: amanhaPub.length, title: "Escala de amanhã publicada", sub: `entrada às ${amanhaPub[0]!.inicio}`, tone: "mute", href: APP_ROUTES.escalas });

  return {
    saudacao, proximo,
    linhaDoTempo: { rotulo: "Seu dia", dica: meus.length ? "só os seus itens — a grade completa fica na escala" : "nada escalado para você hoje", itens },
    pendencias: { titulo: "Do seu lado", mascote: "lembrete", itens: pend },
  };
}

async function supervisao(actor: { sub: string; organizationId: string; role: string }, nome: string, hoje: string, amanha: string, agora: number): Promise<Parte> {
  const scopes = await listAreaLocalScopes(actor.sub, actor.organizationId);
  const areas = new Set(scopes.map((s) => s.areaId));
  const locais = [...new Set(scopes.map((s) => s.locationId))];
  const dias = await Promise.all(locais.map((l) => diasDoLocal(actor.organizationId, l, hoje, amanha)));
  const minhasPessoas = new Set(dias.flatMap((d) => (d.hoje?.pessoas ?? []).filter((p) => p.areaId && areas.has(p.areaId)).map((p) => p.id)));
  const pessoasDaArea = areas.size ? (await db.select({ id: usersTable.id }).from(usersTable).where(and(eq(usersTable.organizationId, actor.organizationId), inArray(usersTable.areaId, [...areas])))).map((u) => u.id) : [];

  const faltas: { pessoa: string; bloco: BlocoDia; local: string }[] = [];
  for (const d of dias) {
    if (!d.hoje?.escala || !escalaPublicada(d.hoje.escala.status)) continue;
    const feitos = await feitosNaEscala(d.hoje.escala.id);
    for (const f of faltandoCheckIn(d.hoje, feitos, agora, minhasPessoas)) faltas.push({ ...f, local: d.hoje.location.name });
  }
  const [folgas, ocorrencias, pedidos] = await Promise.all([
    pessoasDaArea.length ? db.select({ id: leaveRequestsTable.id, startDate: leaveRequestsTable.startDate, endDate: leaveRequestsTable.endDate, name: usersTable.name }).from(leaveRequestsTable).innerJoin(usersTable, eq(leaveRequestsTable.userId, usersTable.id))
      .where(and(eq(leaveRequestsTable.status, "PENDING"), inArray(leaveRequestsTable.userId, pessoasDaArea))).orderBy(leaveRequestsTable.startDate) : Promise.resolve([]),
    pessoasDaArea.length ? db.select({ id: occurrencesTable.id, type: occurrencesTable.type, name: usersTable.name, createdAt: occurrencesTable.createdAt }).from(occurrencesTable).innerJoin(usersTable, eq(occurrencesTable.personId, usersTable.id))
      .where(and(eq(occurrencesTable.active, true), inArray(occurrencesTable.state, ["aberta", "em_analise"]), inArray(occurrencesTable.personId, pessoasDaArea))).orderBy(desc(occurrencesTable.createdAt)) : Promise.resolve([]),
    pedidosEsperando(actor),
  ]);
  const escalaAmanha = dias.map((d) => d.amanha).filter((d): d is EscalaDia => Boolean(d)).map((d) => {
    const minhas = d.areas.filter((a) => areas.has(a.id));
    const faltaMinha = minhas.filter((a) => !a.pronta);
    return { local: d.location.name, publicada: escalaPublicada(d.escala?.status), faltaMinha, temBlocos: d.blocos.length > 0 };
  }).filter((e) => e.temBlocos && !e.publicada);

  const pend: Pendencia[] = [];
  if (ocorrencias.length) pend.push({ count: ocorrencias.length, title: ocorrencias.length === 1 ? "Ocorrência aberta" : "Ocorrências abertas", sub: ocorrencias.slice(0, 2).map((o) => `${o.name} — ${o.type}`).join(" · "), tone: "warn", href: APP_ROUTES.checkIn });
  if (folgas.length) pend.push({ count: folgas.length, title: folgas.length === 1 ? "Folga a decidir" : "Folgas a decidir", sub: folgas.slice(0, 2).map((f) => `${f.name} · ${f.startDate === f.endDate ? curta(f.startDate) : `${curta(f.startDate)} a ${curta(f.endDate)}`}`).join(" · "), tone: "warn", href: APP_ROUTES.folgas });
  if (pedidos.paraDecidir) pend.push({ count: pedidos.paraDecidir, title: pedidos.paraDecidir === 1 ? "Pedido a decidir" : "Pedidos a decidir", sub: "horário, troca, restrição… em Solicitações", tone: "warn", href: APP_ROUTES.solicitacoes });
  if (pedidos.colegaEspera) pend.push({ count: pedidos.colegaEspera, title: "Troca esperando você", sub: "uma colega pediu para trocar", tone: "warn", href: APP_ROUTES.solicitacoes });
  if (faltas.length) pend.push({ count: faltas.length, title: faltas.length === 1 ? "Check-in em falta" : "Check-ins em falta", sub: [...new Set(faltas.map((f) => `${texto(f.bloco)} ${f.bloco.inicio}`))].slice(0, 2).join(" · "), tone: "warn", href: APP_ROUTES.checkIn });
  for (const e of escalaAmanha) pend.push({ count: 1, title: `Escala de amanhã · ${e.local}`, sub: e.faltaMinha.length ? `falta marcar ${e.faltaMinha.map((a) => a.name).join(", ")} como pronta` : "sua área está pronta · aguardando a Administração", tone: e.faltaMinha.length ? "warn" : "mute", href: APP_ROUTES.escalas });

  const decisoes = ocorrencias.length + folgas.length + pedidos.paraDecidir;
  const principal = dias.find((d) => d.hoje?.escala && escalaPublicada(d.hoje.escala.status))?.hoje ?? dias[0]?.hoje ?? null;
  const feitosPrincipal = await feitosNaEscala(principal?.escala?.id);
  const blocosArea = (principal?.blocos ?? []).filter((b) => b.vazio || b.pessoaIds.some((p) => minhasPessoas.has(p))).sort((a, b) => a.inicio.localeCompare(b.inicio));
  const prox = blocosArea.find((b) => fimDe(b) > agora && !b.vazio);
  const daArea = (b: BlocoDia) => b.pessoaIds.filter((p) => minhasPessoas.has(p));
  const semCheckIn = (b: BlocoDia) => daArea(b).filter((p) => !chegou(feitosPrincipal.get(p))).length;

  const partes = [ocorrencias.length ? plural(ocorrencias.length, "ocorrência", "ocorrências") : "", folgas.length ? plural(folgas.length, "folga", "folgas") : "", pedidos.paraDecidir ? plural(pedidos.paraDecidir, "pedido", "pedidos") : ""].filter(Boolean);
  const saudacao: Parte["saudacao"] = decisoes
    ? { titulo: saudar(agora, nome), texto: `${decisoes === 1 ? "Uma decisão espera" : `${decisoes} decisões esperam`} por você${prox ? ` antes de ${texto(prox)} às ${prox.inicio}` : ""}: ${partes.join(" e ")}.`, mascote: "aviso-importante", acao: { label: "Abrir as decisões", href: ocorrencias.length ? APP_ROUTES.checkIn : folgas.length ? APP_ROUTES.folgas : APP_ROUTES.solicitacoes } }
    : faltas.length ? { titulo: saudar(agora, nome), texto: `${plural(faltas.length, "pessoa da sua área ainda não fez", "pessoas da sua área ainda não fizeram")} check-in.`, mascote: "aviso-importante", acao: { label: "Abrir o check-in", href: APP_ROUTES.checkIn } }
      : { titulo: saudar(agora, nome), texto: principal?.escala && escalaPublicada(principal.escala.status) ? "Nada esperando decisão sua agora. A escala de hoje está publicada." : "Nada esperando decisão sua agora.", mascote: "bom-dia", acao: { label: "Ver a escala de hoje", href: APP_ROUTES.escalas } };

  const proximo: Parte["proximo"] = prox ? {
    rotulo: "Próximo na sua área", link: prox.dailyBookId ? "abrir Livro do Dia" : "abrir a escala", href: prox.dailyBookId ? APP_ROUTES.livroDoDia : APP_ROUTES.escalas,
    time: prox.inicio, rel: rel(prox.inicio, agora), title: texto(prox), sub: `${principal?.location.name ?? ""} · ${daArea(prox).length - semCheckIn(prox)} de ${daArea(prox).length} com check-in`,
    chips: [principal?.location.name ?? "", semCheckIn(prox) && min(prox.inicio) - agora <= 60 ? `${semCheckIn(prox)} sem check-in` : ""].filter(Boolean),
  } : null;

  const itens: LinhaDoDia[] = blocosArea.slice(0, 8).map((b) => {
    const emCurso = min(b.inicio) <= agora && fimDe(b) > agora, faltam = semCheckIn(b), voce = b.pessoaIds.includes(actor.sub);
    if (b.vazio) return { time: b.inicio, title: texto(b), sub: b.sinal ?? "sem ninguém", tag: "sem ninguém", tone: "warn" as const, href: APP_ROUTES.escalas };
    if (emCurso && faltam) return { time: b.inicio, title: texto(b), sub: `${daArea(b).length} da sua área`, tag: `${faltam} sem check-in`, tone: "warn" as const, href: APP_ROUTES.checkIn };
    if (b.dailyBookId) return { time: b.inicio, title: texto(b), sub: `Livro do Dia ${b.dailyBookStatus === "DRAFT" ? "em rascunho" : "publicado"}`, tag: b.dailyBookStatus === "DRAFT" ? "livro em rascunho" : "publicado", tone: b.dailyBookStatus === "DRAFT" ? "warn" as const : "ok" as const, href: APP_ROUTES.livroDoDia };
    return { time: b.inicio, title: texto(b), sub: `${daArea(b).length} da sua área${voce ? " · você também" : ""}`, tag: emCurso ? "em curso" : voce ? "você" : "", tone: emCurso ? "ok" as const : voce ? "mine" as const : "mute" as const };
  });

  return {
    saudacao, proximo,
    linhaDoTempo: { rotulo: `Grade de hoje${principal ? ` — ${principal.location.name}` : ""}`, dica: !principal?.escala ? "a escala de hoje ainda não existe" : escalaPublicada(principal.escala.status) ? "gerada pela Programação, ajustada por você" : "escala de hoje ainda em rascunho", itens },
    pendencias: { titulo: "Decisões suas", mascote: "aviso-importante", itens: pend },
  };
}

async function gestao(actor: { sub: string; organizationId: string; role: string }, nome: string, perfil: "adm" | "dir", hoje: string, amanha: string, agora: number): Promise<Parte> {
  const locais = await db.select({ id: locationsTable.id, name: locationsTable.name }).from(locationsTable).where(and(eq(locationsTable.organizationId, actor.organizationId), eq(locationsTable.closed, false)));
  const dias = await Promise.all(locais.map((l) => diasDoLocal(actor.organizationId, l.id, hoje, amanha)));
  const org = (await db.select({ id: usersTable.id }).from(usersTable).where(and(eq(usersTable.organizationId, actor.organizationId), eq(usersTable.status, "ACTIVE")))).map((u) => u.id);

  const porLocal = await Promise.all(dias.map(async (d) => {
    const h = d.hoje, pub = h?.escala && escalaPublicada(h.escala.status);
    const feitos = pub ? await feitosNaEscala(h!.escala!.id) : new Map();
    const escalados = new Set((pub ? h!.blocos : []).flatMap((b) => b.pessoaIds));
    const faltas = pub ? faltandoCheckIn(h!, feitos, agora, null) : [];
    const esperados = pub ? faltandoCheckIn(h!, new Map(), agora, null).length : 0;
    const shows = (h?.blocos ?? []).filter((b) => b.dailyBookId);
    return { dia: h, amanha: d.amanha, pub, escalados, faltas, esperados, shows };
  }));
  const [ocorr, folgasPend, folgasHoje, tarefasAtrasadas, respSemDono] = await Promise.all([
    org.length ? db.select({ n: sql<number>`count(*)::int` }).from(occurrencesTable).where(and(eq(occurrencesTable.active, true), inArray(occurrencesTable.state, ["aberta", "em_analise"]), inArray(occurrencesTable.personId, org))) : Promise.resolve([{ n: 0 }]),
    db.select({ n: sql<number>`count(*)::int` }).from(leaveRequestsTable).where(and(eq(leaveRequestsTable.organizationId, actor.organizationId), eq(leaveRequestsTable.status, "PENDING"))),
    db.select({ n: sql<number>`count(*)::int` }).from(leaveRequestsTable).where(and(eq(leaveRequestsTable.organizationId, actor.organizationId), notInArray(leaveRequestsTable.status, ["PENDING"]), gte(leaveRequestsTable.decidedAt, new Date(`${hoje}T00:00:00-03:00`)))),
    db.select({ n: sql<number>`count(*)::int` }).from(tasksTable).where(and(eq(tasksTable.organizationId, actor.organizationId), inArray(tasksTable.status, [...OPEN_TASK]), sql`${tasksTable.dueDate} < ${hoje}`)),
    db.select({ id: responsibilitiesTable.id, title: responsibilitiesTable.title }).from(responsibilitiesTable)
      .where(and(eq(responsibilitiesTable.orgId, actor.organizationId), eq(responsibilitiesTable.active, true), sql`not exists (select 1 from ${responsibilityAssignmentsTable} ra where ra.responsibility_id = ${responsibilitiesTable.id} and ra.active)`)),
  ]);
  const nOcorr = ocorr[0]?.n ?? 0, nFolgas = folgasPend[0]?.n ?? 0;
  const amanhaPendente = porLocal.filter((l) => l.amanha && l.amanha.blocos.length && !escalaPublicada(l.amanha.escala?.status));
  const shows = porLocal.flatMap((l) => l.shows.map((b) => ({ b, local: l.dia!.location.name }))).sort((a, b) => a.b.inicio.localeCompare(b.b.inicio));
  const prox = shows.find((s) => fimDe(s.b) > agora);
  const comEscala = porLocal.filter((l) => l.pub);
  const escalados = new Set(porLocal.flatMap((l) => [...l.escalados]));
  const faltasTotal = porLocal.reduce((n, l) => n + l.faltas.length, 0);

  const proximo: Parte["proximo"] = prox ? {
    rotulo: perfil === "dir" ? "Acontecendo na empresa" : "Primeiro compromisso da organização", link: perfil === "dir" ? "abrir Painel" : "abrir Livro do Dia", href: perfil === "dir" ? APP_ROUTES.painel : APP_ROUTES.livroDoDia,
    time: prox.b.inicio, rel: rel(prox.b.inicio, agora), title: `${texto(prox.b)} — ${prox.local}`, sub: `Livro do Dia ${prox.b.dailyBookStatus === "DRAFT" ? "em rascunho" : "publicado"} · ${plural(prox.b.pessoaIds.length, "pessoa", "pessoas")}`, chips: [prox.local],
  } : null;

  if (perfil === "dir") {
    const itens: LinhaDoDia[] = porLocal.filter((l) => l.dia).map((l) => {
      const cobertura = l.esperados ? `${Math.round(100 * (l.esperados - l.faltas.length) / l.esperados)}%` : "—";
      return { time: cobertura, title: l.dia!.location.name, sub: `${plural(l.escalados.size, "escalado", "escalados")} · ${plural(l.shows.length, "show", "shows")} hoje`, tag: !l.dia!.escala ? "sem escala" : l.pub ? (l.faltas.length ? "atenção" : "saudável") : "escala em rascunho", tone: !l.dia!.escala ? "mute" : l.pub && !l.faltas.length ? "ok" : "warn" };
    });
    if (nOcorr) itens.push({ time: String(nOcorr), title: nOcorr === 1 ? "Ocorrência aberta" : "Ocorrências abertas", sub: "em análise pela supervisão", tag: "acompanhando", tone: "warn" });
    return {
      saudacao: { titulo: saudar(agora, nome), texto: `A ASA hoje: ${plural(comEscala.length, "local com escala publicada", "locais com escala publicada")}, ${plural(escalados.size, "pessoa escalada", "pessoas escaladas")}, ${plural(shows.length, "show", "shows")}${nOcorr ? `, ${plural(nOcorr, "ocorrência aberta", "ocorrências abertas")}` : ""}.`, mascote: "consultando", acao: { label: "Abrir o Painel", href: APP_ROUTES.painel } },
      proximo,
      linhaDoTempo: { rotulo: "A empresa hoje, local por local", dica: "panorama — abra o Painel para o detalhe", itens },
      pendencias: { titulo: "Sinais da empresa", mascote: "consultando", itens: [
        { count: nOcorr, title: nOcorr === 1 ? "Ocorrência aberta" : "Ocorrências abertas", sub: "sem nomes — detalhe fica com a supervisão", tone: nOcorr ? "warn" : "ok", href: APP_ROUTES.painel },
        { count: folgasHoje[0]?.n ?? 0, title: "Folgas decididas hoje", sub: `${plural(nFolgas, "pedido esperando", "pedidos esperando")}`, tone: "mute", href: APP_ROUTES.folgas },
        { count: tarefasAtrasadas[0]?.n ?? 0, title: "Tarefas atrasadas", sub: "na organização", tone: (tarefasAtrasadas[0]?.n ?? 0) ? "warn" : "ok", href: APP_ROUTES.responsabilidades },
        { count: org.length, title: "Pessoas ativas", sub: `${escalados.size} escaladas hoje`, tone: "mute", href: APP_ROUTES.painel },
      ] },
    };
  }

  const pend: Pendencia[] = [];
  for (const l of amanhaPendente) { const faltam = l.amanha!.areas.filter((a) => !a.pronta).map((a) => a.name); pend.push({ count: 1, title: `Escala de amanhã · ${l.amanha!.location.name}`, sub: faltam.length ? `falta ${faltam.join(", ")} marcar pronta` : "todas as áreas prontas · só falta publicar", tone: faltam.length ? "mute" : "warn", href: APP_ROUTES.escalas }); }
  if (respSemDono.length) pend.push({ count: respSemDono.length, title: respSemDono.length === 1 ? "Responsabilidade sem dono" : "Responsabilidades sem dono", sub: respSemDono.slice(0, 2).map((r) => r.title).join(" · "), tone: "warn", href: APP_ROUTES.responsabilidades });
  if (nFolgas) pend.push({ count: nFolgas, title: nFolgas === 1 ? "Folga a decidir" : "Folgas a decidir", sub: "na organização", tone: "warn", href: APP_ROUTES.folgas });
  const pedidos = await pedidosEsperando(actor);
  if (pedidos.paraDecidir) pend.push({ count: pedidos.paraDecidir, title: pedidos.paraDecidir === 1 ? "Pedido a decidir" : "Pedidos a decidir", sub: "em Solicitações · normalmente com a supervisão de cada área", tone: "warn", href: APP_ROUTES.solicitacoes });
  if (nOcorr) pend.push({ count: nOcorr, title: nOcorr === 1 ? "Ocorrência aberta" : "Ocorrências abertas", sub: "com a supervisão de cada área", tone: "warn", href: APP_ROUTES.checkIn });
  if (faltasTotal) pend.push({ count: faltasTotal, title: faltasTotal === 1 ? "Check-in em falta" : "Check-ins em falta", sub: "blocos que já começaram", tone: "warn", href: APP_ROUTES.checkIn });

  const suas = amanhaPendente.filter((l) => l.amanha!.areas.every((a) => a.pronta)).length + respSemDono.length;
  const itens: LinhaDoDia[] = [];
  for (const l of porLocal) {
    if (!l.dia) continue;
    if (!l.dia.escala) { itens.push({ time: "—", title: l.dia.location.name, sub: "sem escala para hoje", tag: "sem escala", tone: "mute", href: APP_ROUTES.escalas }); continue; }
    if (!l.pub) itens.push({ time: "—", title: l.dia.location.name, sub: "escala de hoje ainda não publicada", tag: "escala em rascunho", tone: "warn", href: APP_ROUTES.escalas });
    for (const b of l.shows) itens.push({ time: b.inicio, title: texto(b), sub: l.dia.location.name, tag: b.dailyBookStatus === "DRAFT" ? "livro em rascunho" : "publicado", tone: b.dailyBookStatus === "DRAFT" ? "warn" : "ok", href: APP_ROUTES.livroDoDia });
  }
  itens.sort((a, b) => a.time.localeCompare(b.time));
  return {
    saudacao: { titulo: saudar(agora, nome), texto: `${comEscala.length ? plural(comEscala.length, "local com escala publicada hoje", "locais com escala publicada hoje") : locais.length ? "Nenhum local com escala publicada hoje" : "Ainda não há locais cadastrados — comece por Locais, Áreas e Pessoas"}.${suas ? ` ${suas === 1 ? "Uma coisa só você resolve" : `${suas} coisas só você resolve`}: ${[amanhaPendente.some((l) => l.amanha!.areas.every((a) => a.pronta)) ? "publicar a escala de amanhã" : "", respSemDono.length ? "dar dono a uma responsabilidade" : ""].filter(Boolean).join(" e ")}.` : pend.length ? " Nada que só você resolve — o resto da lista está com a supervisão de cada área." : " Nada esperando por você."}`, mascote: suas ? "estudando" : "bom-dia", acao: !locais.length ? { label: "Cadastrar os locais", href: "/locais" } : amanhaPendente.length ? { label: "Revisar a escala de amanhã", href: APP_ROUTES.escalas } : { label: "Abrir o Painel", href: APP_ROUTES.painel } },
    proximo,
    linhaDoTempo: { rotulo: "Hoje, nos locais", dica: "só o que pede atenção da administração", itens: itens.slice(0, 8) },
    pendencias: { titulo: "Depende da administração", mascote: "estudando", itens: pend },
  };
}

void or;
