/**
 * Restrição de horário por pessoa (16/10/2026): "só pode trabalhar das X às Y, nestes dias, neste período"
 * (ex.: escola). O motor do Livro do Dia trata como proibição; quem escala mesmo assim passa por exceção, com
 * motivo escrito (ver services/regras-de-escala.ts).
 *
 * Quem cadastra, encerra e reabre: Administração, e a Supervisão só para gente da própria área. Direção lê tudo
 * sem editar; Elenco vê só as próprias. Nada é apagado: encerrar muda o status e dá para reabrir. Toda escrita
 * grava no Registro na mesma transação, e o cadastro avisa no sino a pessoa, a Supervisão dela e a Administração
 * (um aviso por pedido, mesmo que o pedido traga várias pessoas).
 */
import { Router, type IRouter, type Request, type Response } from "express";
import { and, desc, eq, inArray } from "drizzle-orm";
import { areaLocalSupervisorsTable, db, restricoesHorarioTable, userRolesTable, usersTable } from "@workspace/db";
import { requireAuth, requireOrganization } from "../middlewares/auth.js";
import { writeHistoryEvent, type HistoryExecutor } from "../lib/history-helper.js";
import { enqueueNotification } from "../services/undo.js";
import { listAreaLocalScopes } from "../services/area-local-scope.js";
import { APP_ROUTES } from "../lib/app-routes.js";

const router: IRouter = Router();
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const SUPERVISAO = ["SUPERVISOR_A", "SUPERVISOR_B"];
const hhmm = (hora: string) => hora.slice(0, 5);
const dataCurta = (iso: string) => iso.split("-").reverse().slice(0, 2).join("/");

type Ator = NonNullable<Express.Request["user"]>;

/** Áreas que a Supervisão cobre (em qualquer local); Administração cobre todas (null). */
async function areasDoAtor(ator: Ator): Promise<Set<string> | null> {
  if (ator.role === "ADMIN") return null;
  if (!SUPERVISAO.includes(ator.role)) return new Set();
  return new Set((await listAreaLocalScopes(ator.sub, ator.organizationId)).map((s) => s.areaId));
}
const podeGerir = (areas: Set<string> | null, areaDaPessoa: string | null) => areas === null || (Boolean(areaDaPessoa) && areas.has(areaDaPessoa!));

function resumo(r: { diasSemana: number[]; horaInicio: string; horaFim: string; periodStart: string; periodEnd: string | null; motivo: string }) {
  const dias = [...r.diasSemana].sort((a, b) => a - b).map((d) => DIAS[d]).join(", ");
  const periodo = r.periodEnd ? `de ${dataCurta(r.periodStart)} a ${dataCurta(r.periodEnd)}` : `a partir de ${dataCurta(r.periodStart)}`;
  return `só pode das ${hhmm(r.horaInicio)} às ${hhmm(r.horaFim)} (${dias}), ${periodo}. Motivo: ${r.motivo}`;
}

const listar = (where: ReturnType<typeof and> | undefined) => db.select({
  id: restricoesHorarioTable.id, userId: restricoesHorarioTable.userId, userName: usersTable.name, areaId: usersTable.areaId,
  diasSemana: restricoesHorarioTable.diasSemana, horaInicio: restricoesHorarioTable.horaInicio, horaFim: restricoesHorarioTable.horaFim,
  periodStart: restricoesHorarioTable.periodStart, periodEnd: restricoesHorarioTable.periodEnd, motivo: restricoesHorarioTable.motivo,
  status: restricoesHorarioTable.status, createdBy: restricoesHorarioTable.createdBy, createdAt: restricoesHorarioTable.createdAt,
  endedBy: restricoesHorarioTable.endedBy, endedAt: restricoesHorarioTable.endedAt,
}).from(restricoesHorarioTable).innerJoin(usersTable, eq(restricoesHorarioTable.userId, usersTable.id)).where(where).orderBy(desc(restricoesHorarioTable.createdAt));

router.get("/restricoes-horario", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  const ator = req.user!;
  const userId = typeof req.query.userId === "string" ? req.query.userId : undefined;
  const daOrganizacao = eq(usersTable.organizationId, ator.organizationId);
  const areas = await areasDoAtor(ator);
  const leTudo = ator.role === "ADMIN" || ator.role === "DIR";
  let linhas = await listar(userId && leTudo ? and(daOrganizacao, eq(restricoesHorarioTable.userId, userId)) : daOrganizacao);
  if (!leTudo && !SUPERVISAO.includes(ator.role)) {
    linhas = linhas.filter((l) => l.userId === ator.sub); // Elenco: só as próprias, mesmo pedindo outra pessoa
  } else if (!leTudo) {
    if (userId) {
      const pessoa = linhas.find((l) => l.userId === userId);
      const [dono] = pessoa ? [{ areaId: pessoa.areaId }] : await db.select({ areaId: usersTable.areaId }).from(usersTable).where(and(eq(usersTable.id, userId), daOrganizacao)).limit(1);
      if (dono && !podeGerir(areas, dono.areaId)) { res.status(403).json({ error: "Forbidden", message: "Você só consulta restrição de pessoas da sua área." }); return; }
      linhas = linhas.filter((l) => l.userId === userId);
    } else {
      linhas = linhas.filter((l) => podeGerir(areas, l.areaId));
    }
  }
  res.json({
    restricoes: linhas.map(({ areaId: _areaId, horaInicio, horaFim, ...resto }) => ({ ...resto, horaInicio: hhmm(horaInicio), horaFim: hhmm(horaFim) })),
    podeEditar: ator.role === "ADMIN" || SUPERVISAO.includes(ator.role),
  });
});

router.post("/restricoes-horario", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  const ator = req.user!;
  if (ator.role !== "ADMIN" && !SUPERVISAO.includes(ator.role)) {
    res.status(403).json({ error: "Forbidden", message: "Só a Administração e a Supervisão cadastram restrição de horário." }); return;
  }
  const b = (req.body ?? {}) as Record<string, unknown>;
  const userIds = Array.isArray(b.userIds) ? [...new Set(b.userIds.filter((x): x is string => typeof x === "string" && x !== ""))] : [];
  const diasSemana = Array.isArray(b.diasSemana) && b.diasSemana.every((d) => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6) ? [...new Set(b.diasSemana as number[])].sort((x, y) => x - y) : [];
  const motivo = typeof b.motivo === "string" ? b.motivo.trim() : "";
  const periodEnd = typeof b.periodEnd === "string" && b.periodEnd ? b.periodEnd : null;
  const erro = (message: string) => res.status(400).json({ error: "Bad Request", message });
  if (!userIds.length) { erro("Escolha pelo menos uma pessoa."); return; }
  if (!diasSemana.length) { erro("Escolha pelo menos um dia da semana (0 = domingo, 6 = sábado)."); return; }
  if (typeof b.horaInicio !== "string" || typeof b.horaFim !== "string" || !HORA.test(b.horaInicio) || !HORA.test(b.horaFim)) { erro("Informe a hora inicial e a final no formato HH:MM."); return; }
  if (b.horaFim <= b.horaInicio) { erro("A hora final precisa ser depois da inicial: é a janela em que a pessoa pode trabalhar."); return; }
  if (typeof b.periodStart !== "string" || !DATE.test(b.periodStart) || (periodEnd !== null && !DATE.test(periodEnd))) { erro("Informe o período em que a restrição vale (início e, se houver, fim)."); return; }
  if (periodEnd !== null && periodEnd < b.periodStart) { erro("O fim do período não pode ser antes do início."); return; }
  if (motivo.length < 3) { erro("Escreva o motivo da restrição (ex.: escola)."); return; }

  const pessoas = await db.select({ id: usersTable.id, name: usersTable.name, areaId: usersTable.areaId }).from(usersTable)
    .where(and(inArray(usersTable.id, userIds), eq(usersTable.organizationId, ator.organizationId)));
  if (pessoas.length !== userIds.length) { res.status(404).json({ error: "Not Found", message: "Uma das pessoas escolhidas não existe nesta organização." }); return; }
  const areas = await areasDoAtor(ator);
  if (pessoas.some((p) => !podeGerir(areas, p.areaId))) {
    res.status(403).json({ error: "Forbidden", message: "Você só cadastra restrição de pessoas da sua área." }); return;
  }

  const criadas = await db.transaction(async (tx) => {
    const linhas: { row: typeof restricoesHorarioTable.$inferSelect; pessoa: (typeof pessoas)[number] }[] = [];
    for (const pessoa of pessoas) {
      const [row] = await tx.insert(restricoesHorarioTable).values({
        userId: pessoa.id, diasSemana, horaInicio: b.horaInicio as string, horaFim: b.horaFim as string, periodStart: b.periodStart as string, periodEnd,
        motivo, status: "ACTIVE", createdBy: ator.sub,
      }).returning();
      await writeHistoryEvent({
        category: "RESTRICTION", action: "restricao_horario.criada", title: `Restrição de horário: ${pessoa.name}`,
        narrative: `${pessoa.name}: ${resumo(row!)}.`, entityType: "restricao_horario", entityId: row!.id, actorId: ator.sub, actorType: "HUMAN", orgId: ator.organizationId,
        beforeState: null, afterState: row,
      }, tx as unknown as HistoryExecutor);
      linhas.push({ row: row!, pessoa });
    }
    // Um aviso por pedido e por destinatário: a pessoa, a Supervisão da área dela e a Administração (menos quem cadastrou).
    const supervisores = await tx.select({ areaId: areaLocalSupervisorsTable.areaId, supervisorId: areaLocalSupervisorsTable.supervisorId }).from(areaLocalSupervisorsTable)
      .where(and(inArray(areaLocalSupervisorsTable.areaId, [...new Set(pessoas.map((p) => p.areaId).filter((a): a is string => Boolean(a)))]), eq(areaLocalSupervisorsTable.active, true)));
    const admins = await tx.select({ userId: userRolesTable.userId }).from(userRolesTable).innerJoin(usersTable, eq(userRolesTable.userId, usersTable.id))
      .where(and(eq(userRolesTable.role, "ADMIN"), eq(userRolesTable.active, true), eq(usersTable.organizationId, ator.organizationId)));
    const destinatarios = new Map<string, typeof linhas>();
    const entrega = (userId: string, item: (typeof linhas)[number]) => { if (userId !== ator.sub) destinatarios.set(userId, [...(destinatarios.get(userId) ?? []), item]); };
    for (const item of linhas) {
      entrega(item.pessoa.id, item);
      for (const s of supervisores.filter((x) => x.areaId === item.pessoa.areaId)) entrega(s.supervisorId, item);
      for (const a of admins) entrega(a.userId, item);
    }
    const primeira = linhas[0]!.row.id;
    for (const [userId, itens] of destinatarios) {
      const propria = itens.length === 1 && itens[0]!.pessoa.id === userId;
      const nomes = itens.map((i) => i.pessoa.name).join(", ");
      await enqueueNotification(tx as never, {
        userId, type: "restricao_horario.criada", category: "schedule", priority: "IMPORTANT",
        title: propria ? "Você tem uma restrição de horário" : `Restrição de horário cadastrada: ${nomes}`,
        message: propria ? `Você ${resumo(itens[0]!.row)}.` : `${nomes} ${resumo(itens[0]!.row)}.`,
        entityType: "restricao_horario", entityId: primeira, actionUrl: propria ? APP_ROUTES.meuDia : APP_ROUTES.escalas,
      }, new Date(), { deduplicationKey: `restricao-horario:${primeira}:${userId}` });
    }
    return linhas.map((l) => l.row);
  });
  res.status(201).json({ restricoes: criadas.map((r) => ({ ...r, horaInicio: hhmm(r.horaInicio), horaFim: hhmm(r.horaFim) })) });
});

/** Encerrar e reabrir: mesma permissão do cadastro, olhando a área da pessoa dona da restrição. */
async function mudarStatus(req: Request, res: Response, para: "ENDED" | "ACTIVE") {
  const ator = req.user!;
  const id = (req.params as { id: string }).id;
  const [linha] = await listar(and(eq(restricoesHorarioTable.id, id), eq(usersTable.organizationId, ator.organizationId)));
  if (!linha) { res.status(404).json({ error: "Not Found", message: "Restrição não encontrada." }); return; }
  if (ator.role !== "ADMIN" && !SUPERVISAO.includes(ator.role)) { res.status(403).json({ error: "Forbidden", message: "Só a Administração e a Supervisão encerram ou reabrem restrição de horário." }); return; }
  if (!podeGerir(await areasDoAtor(ator), linha.areaId)) { res.status(403).json({ error: "Forbidden", message: "Você só altera restrição de pessoas da sua área." }); return; }
  const motivo = typeof (req.body ?? {}).motivo === "string" ? (req.body as { motivo: string }).motivo.trim() : "";
  if (para === "ENDED" && motivo.length < 3) { res.status(400).json({ error: "Bad Request", message: "Escreva o motivo de encerrar a restrição." }); return; }
  if (linha.status === para) { res.status(409).json({ error: "Conflict", message: para === "ENDED" ? "Esta restrição já está encerrada." : "Esta restrição já está ativa." }); return; }
  const atualizada = await db.transaction(async (tx) => {
    const [row] = await tx.update(restricoesHorarioTable)
      .set(para === "ENDED" ? { status: "ENDED", endedBy: ator.sub, endedAt: new Date() } : { status: "ACTIVE", endedBy: null, endedAt: null })
      .where(eq(restricoesHorarioTable.id, id)).returning();
    await writeHistoryEvent({
      category: "RESTRICTION", action: para === "ENDED" ? "restricao_horario.encerrada" : "restricao_horario.reaberta",
      title: `${para === "ENDED" ? "Restrição de horário encerrada" : "Restrição de horário reaberta"}: ${linha.userName}`,
      narrative: para === "ENDED" ? `A restrição de ${linha.userName} foi encerrada. Motivo: ${motivo}.` : `A restrição de ${linha.userName} voltou a valer.`,
      entityType: "restricao_horario", entityId: id, actorId: ator.sub, actorType: "HUMAN", orgId: ator.organizationId,
      beforeState: { status: linha.status }, afterState: row, metadata: { motivo: motivo || null },
    }, tx as unknown as HistoryExecutor);
    return row!;
  });
  res.json({ restricao: { ...atualizada, horaInicio: hhmm(atualizada.horaInicio), horaFim: hhmm(atualizada.horaFim) } });
}
router.post("/restricoes-horario/:id/encerrar", requireAuth, requireOrganization, (req, res) => void mudarStatus(req, res, "ENDED"));
router.post("/restricoes-horario/:id/reabrir", requireAuth, requireOrganization, (req, res) => void mudarStatus(req, res, "ACTIVE"));

export default router;
