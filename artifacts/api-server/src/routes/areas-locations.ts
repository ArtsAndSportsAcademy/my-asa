import { Router, type IRouter } from "express";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import {
  areaLocalSupervisorsTable,
  areasTable,
  db,
  locaisDeslocamentoTable,
  locationsTable,
  operationLocationsTable,
  operationsTable,
  organizationsTable,
  userRolesTable,
  usersTable,
} from "@workspace/db";
import { requireAuth, requireOrganization, requireRole } from "../middlewares/auth.js";
import { requireReason } from "../lib/reason.js";
import { writeEntityHistory } from "../lib/entity-history.js";
import { listAreaLocalScopes } from "../services/area-local-scope.js";
import { listReadableLocations } from "../services/location-directory.js";
import { isUniqueViolation } from "../lib/erro-de-banco.js";
import { exigirUuidNosParametros } from "../lib/uuid.js";
import { FRASE_DESLOCAMENTO_MUDOU, FRASE_DESLOCAMENTO_SEM_VERSAO, diferencaDosPares, lerPares, paresGuardados, versaoDoDeslocamento } from "../services/escala-deslocamento.js";
import { VIRADA_PADRAO, fraseDaViradaInvalida, viradaDoLocal } from "../lib/virada-do-dia.js";

const router: IRouter = Router();
exigirUuidNosParametros(router, { id: "Registro não encontrado.", locationId: "Local não encontrado.", operationId: "Operação não encontrada." });

/** Um id que nem tem cara de id é "não encontrada", não erro do servidor. */
router.param("operationId", (_req, res, next, id) => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id))) { res.status(404).json({ error: "NOT_FOUND", message: "Operação não encontrada." }); return; }
  next();
});
const SUPERVISOR_ROLES = new Set(["SUPERVISOR_A", "SUPERVISOR_B"]);

function mayReadReference(role: string) { return role === "ADMIN" || role === "DIR" || SUPERVISOR_ROLES.has(role); }

async function areaInOrg(id: string, organizationId: string) {
  const [area] = await db.select().from(areasTable).where(and(eq(areasTable.id, id), eq(areasTable.organizationId, organizationId))).limit(1);
  return area ?? null;
}
async function locationInOrg(id: string, organizationId: string) {
  const [location] = await db.select().from(locationsTable).where(and(eq(locationsTable.id, id), eq(locationsTable.organizationId, organizationId))).limit(1);
  return location ?? null;
}

router.get("/areas", requireAuth, requireOrganization, async (req, res) => {
  if (!mayReadReference(req.user!.role)) { res.status(403).json({ error: "ACESSO_NEGADO", message: "Sem permissão para esta ação." }); return; }
  const includeInactive = req.query.includeInactive === "true";
  let areas = await db.select().from(areasTable).where(and(
    eq(areasTable.organizationId, req.user!.organizationId),
    includeInactive ? undefined : eq(areasTable.active, true),
  )).orderBy(areasTable.name);
  if (SUPERVISOR_ROLES.has(req.user!.role)) {
    const scopes = await listAreaLocalScopes(req.user!.sub, req.user!.organizationId);
    const ids = new Set(scopes.map((scope) => scope.areaId));
    areas = areas.filter((area) => ids.has(area.id));
  }
  res.json({ areas });
});

router.post("/areas", requireAuth, requireOrganization, requireRole("ADMIN"), async (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (!name) { res.status(400).json({ error: "CAMPOS_INVALIDOS", message: "name é obrigatório." }); return; }
  try {
    const area = await db.transaction(async (tx) => {
      const [created] = await tx.insert(areasTable).values({ organizationId: req.user!.organizationId, name, active: true }).returning();
      if (!created) throw new Error("Área não criada");
      await writeEntityHistory(req, { category: "OPERATIONAL_CHANGE", action: "area.created", title: "Área criada", narrative: "Área operacional criada.", entityType: "area", entityId: created.id, actorId: req.user!.sub, orgId: req.user!.organizationId, beforeState: null, afterState: created }, tx as any);
      return created;
    });
    res.status(201).json({ area });
  } catch (err) {
    if (isUniqueViolation(err)) { res.status(409).json({ error: "CONFLITO", message: "Já existe uma área ativa com este nome." }); return; }
    // Falha de banco ou de rede não é nome repetido: dizer que é faria a pessoa trocar o nome atrás de um problema que não é dela.
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Não consegui salvar agora. Nada foi alterado; tente de novo." });
  }
});

router.patch("/areas/:id", requireAuth, requireOrganization, requireRole("ADMIN"), async (req, res) => {
  const before = await areaInOrg(req.params.id as string, req.user!.organizationId);
  if (!before) { res.status(403).json({ error: "Forbidden", message: "Recurso fora do escopo" }); return; }
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : before.name;
  if (!name) { res.status(400).json({ error: "CAMPOS_INVALIDOS", message: "name não pode ser vazio." }); return; }
  try {
    const area = await db.transaction(async (tx) => {
      const [next] = await tx.update(areasTable).set({ name, active: typeof req.body?.active === "boolean" ? req.body.active : before.active, updatedAt: new Date() }).where(eq(areasTable.id, before.id)).returning();
      if (!next) throw new Error("Área não encontrada");
      await writeEntityHistory(req, { category: "OPERATIONAL_CHANGE", action: "area.updated", title: "Área alterada", narrative: "Área operacional alterada.", entityType: "area", entityId: next.id, actorId: req.user!.sub, orgId: req.user!.organizationId, beforeState: before, afterState: next }, tx as any);
      return next;
    });
    res.json({ area });
  } catch (err) {
    if (isUniqueViolation(err)) { res.status(409).json({ error: "CONFLITO", message: "Já existe uma área ativa com este nome." }); return; }
    // Falha de banco ou de rede não é nome repetido: dizer que é faria a pessoa trocar o nome atrás de um problema que não é dela.
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Não consegui salvar agora. Nada foi alterado; tente de novo." });
  }
});

router.delete("/areas/:id", requireAuth, requireOrganization, requireRole("ADMIN"), async (req, res) => {
  const before = await areaInOrg(req.params.id as string, req.user!.organizationId);
  if (!before) { res.status(403).json({ error: "Forbidden", message: "Recurso fora do escopo" }); return; }
  const area = await db.transaction(async (tx) => {
    const [next] = await tx.update(areasTable).set({ active: false, updatedAt: new Date() }).where(eq(areasTable.id, before.id)).returning();
    if (!next) throw new Error("Área não encontrada");
    await writeEntityHistory(req, { category: "OPERATIONAL_CHANGE", action: "area.deactivated", title: "Área desativada", narrative: "Área preservada no histórico e desativada.", entityType: "area", entityId: next.id, actorId: req.user!.sub, orgId: req.user!.organizationId, beforeState: before, afterState: next }, tx as any);
    return next;
  });
  res.json({ area });
});

router.get("/areas/:id/local-supervisors", requireAuth, requireOrganization, async (req, res) => {
  const area = await areaInOrg(req.params.id as string, req.user!.organizationId);
  if (!area) { res.status(403).json({ error: "Forbidden", message: "Recurso fora do escopo" }); return; }
  if (!mayReadReference(req.user!.role)) { res.status(403).json({ error: "ACESSO_NEGADO", message: "Sem permissão para esta ação." }); return; }
  if (SUPERVISOR_ROLES.has(req.user!.role)) {
    const scopes = await listAreaLocalScopes(req.user!.sub, req.user!.organizationId);
    if (!scopes.some((scope) => scope.areaId === area.id)) { res.status(403).json({ error: "ACESSO_NEGADO", message: "Sem permissão para esta ação." }); return; }
  }
  const rows = await db.select({ mapping: areaLocalSupervisorsTable, locationName: locationsTable.name, supervisorName: usersTable.name })
    .from(areaLocalSupervisorsTable)
    .innerJoin(locationsTable, eq(areaLocalSupervisorsTable.locationId, locationsTable.id))
    .innerJoin(usersTable, eq(areaLocalSupervisorsTable.supervisorId, usersTable.id))
    .where(and(eq(areaLocalSupervisorsTable.areaId, area.id), eq(areaLocalSupervisorsTable.active, true)));
  res.json({ supervisors: rows.map((row) => ({ ...row.mapping, locationName: row.locationName, supervisorName: row.supervisorName })) });
});

router.put("/areas/:id/locations/:locationId/supervisor", requireAuth, requireOrganization, requireRole("ADMIN"), async (req, res) => {
  const area = await areaInOrg(req.params.id as string, req.user!.organizationId);
  const location = await locationInOrg(req.params.locationId as string, req.user!.organizationId);
  const supervisorId = req.body?.supervisorId as string | undefined;
  if (!area || !location) { res.status(403).json({ error: "Forbidden", message: "Recurso fora do escopo" }); return; }
  if (!supervisorId) { res.status(400).json({ error: "CAMPOS_INVALIDOS", message: "supervisorId é obrigatório." }); return; }
  const [[supervisor], [activeRole]] = await Promise.all([
    db.select({ id: usersTable.id }).from(usersTable).where(and(eq(usersTable.id, supervisorId), eq(usersTable.status, "ACTIVE"), eq(usersTable.organizationId, req.user!.organizationId))).limit(1),
    db.select({ id: userRolesTable.id }).from(userRolesTable).innerJoin(operationsTable, eq(userRolesTable.operationId, operationsTable.id)).where(and(eq(operationsTable.organizationId, req.user!.organizationId), eq(userRolesTable.userId, supervisorId), eq(userRolesTable.active, true), inArray(userRolesTable.role, ["SUPERVISOR_A", "SUPERVISOR_B"] as any))).limit(1),
  ]);
  if (!supervisor || !activeRole) { res.status(400).json({ error: "CAMPOS_INVALIDOS", message: "supervisorId precisa ser supervisor ativo da organização." }); return; }
  const mapping = await db.transaction(async (tx) => {
    const [before] = await tx.select().from(areaLocalSupervisorsTable).where(and(eq(areaLocalSupervisorsTable.areaId, area.id), eq(areaLocalSupervisorsTable.locationId, location.id), eq(areaLocalSupervisorsTable.active, true))).limit(1);
    if (before) await tx.update(areaLocalSupervisorsTable).set({ active: false, updatedAt: new Date() }).where(eq(areaLocalSupervisorsTable.id, before.id));
    const [created] = await tx.insert(areaLocalSupervisorsTable).values({ areaId: area.id, locationId: location.id, supervisorId, active: true }).returning();
    if (!created) throw new Error("Supervisão não atribuída");
    await writeEntityHistory(req, { category: "OPERATIONAL_CHANGE", action: "area_local_supervisor.assigned", title: "Supervisão por área e local atribuída", narrative: "Supervisor atribuído à combinação de área e local.", entityType: "area_local_supervisor", entityId: created.id, actorId: req.user!.sub, orgId: req.user!.organizationId, beforeState: before ?? null, afterState: created }, tx as any);
    return created;
  });
  res.status(201).json({ mapping });
});

router.get("/locations", requireAuth, requireOrganization, async (req, res) => {
  const locations = await listReadableLocations(req.user!.organizationId, req.user!.sub, req.user!.role, undefined, undefined, req.query.includeClosed === "true");
  if (!locations) { res.status(403).json({ error: "ACESSO_NEGADO", message: "Sem permissão para esta ação." }); return; }
  // De qual operação é cada local: sem isso, dois "Palco" de operações diferentes ficam iguais na tela (crivo 12).
  const vinculos = locations.length
    ? await db.select({ locationId: operationLocationsTable.locationId, operationName: operationsTable.name })
        .from(operationLocationsTable)
        .innerJoin(operationsTable, eq(operationLocationsTable.operationId, operationsTable.id))
        .where(and(inArray(operationLocationsTable.locationId, locations.map((location) => location.id)), eq(operationLocationsTable.active, true), eq(operationsTable.organizationId, req.user!.organizationId)))
    : [];
  const operacaoDoLocal = new Map(vinculos.map((vinculo) => [vinculo.locationId, vinculo.operationName]));
  res.json({ locations: locations.map((location) => ({ ...location, viradaDoDia: viradaDoLocal(location), operationName: operacaoDoLocal.get(location.id) ?? null })) });
});

/**
 * Tempo de ida de um local a outro (pacote O, O5): quantos minutos leva de Snowland à Acqua, por exemplo. A Escala usa para avisar quando uma
 * pessoa sai de um local e não chega a tempo ao outro, e o Livro do Dia usa para não escalar quem não chega. Lê: Administração, Direção e Supervisão.
 * Grava: só a Administração, o conjunto inteiro de uma vez, com a versão que a tela abriu (outra pessoa salvou antes = 409 com frase).
 */
async function deslocamentoParaTela(organizationId: string, podeEditar: boolean) {
  const [locais, guardados, versao] = await Promise.all([
    db.select({ id: locationsTable.id, name: locationsTable.name }).from(locationsTable).where(and(eq(locationsTable.organizationId, organizationId), eq(locationsTable.closed, false))).orderBy(locationsTable.name),
    paresGuardados(organizationId),
    versaoDoDeslocamento(organizationId),
  ]);
  return { locais, pares: guardados.filter((g) => g.active).map(({ locationAId, locationBId, minutos }) => ({ locationAId, locationBId, minutos })), versao, podeEditar };
}

router.get("/locations/deslocamento", requireAuth, requireOrganization, async (req, res) => {
  if (!mayReadReference(req.user!.role)) { res.status(403).json({ error: "ACESSO_NEGADO", message: "O tempo de ida entre locais é da operação: quem vê é a Administração, a Direção e a Supervisão." }); return; }
  res.json(await deslocamentoParaTela(req.user!.organizationId, req.user!.role === "ADMIN"));
});

router.put("/locations/deslocamento", requireAuth, requireOrganization, async (req, res) => {
  const actor = req.user!;
  if (actor.role !== "ADMIN") { res.status(403).json({ error: "ACESSO_NEGADO", message: `${actor.role === "DIR" ? "A Direção só lê o tempo de ida entre locais." : "Seu perfil não muda o tempo de ida entre locais."} Quem escreve é a Administração.` }); return; }
  const corpo = (req.body ?? {}) as { baseVersao?: unknown; pares?: unknown };
  const baseOk = corpo.baseVersao === null || (typeof corpo.baseVersao === "string" && !Number.isNaN(Date.parse(corpo.baseVersao)));
  if (!baseOk) { res.status(400).json({ error: "CAMPOS_INVALIDOS", message: FRASE_DESLOCAMENTO_SEM_VERSAO }); return; }
  const lidos = lerPares(corpo.pares);
  if (!lidos.ok) { res.status(400).json({ error: "CAMPOS_INVALIDOS", message: lidos.erro }); return; }
  const locais = await db.select({ id: locationsTable.id, name: locationsTable.name }).from(locationsTable).where(eq(locationsTable.organizationId, actor.organizationId));
  const nomes = new Map(locais.map((l) => [l.id, l.name]));
  if (lidos.pares.some((p) => !nomes.has(p.locationAId) || !nomes.has(p.locationBId))) { res.status(400).json({ error: "LOCAL_INVALIDO", message: "Um dos locais do par não é da sua casa. Nada foi salvo." }); return; }
  const resultado = await db.transaction(async (tx) => {
    // Trava a casa enquanto confere e grava: duas pessoas salvando ao mesmo tempo entram uma depois da outra.
    await tx.execute(sql`select id from ${organizationsTable} where id = ${actor.organizationId} for update`);
    const exec = tx as unknown as typeof db;
    if ((await versaoDoDeslocamento(actor.organizationId, exec)) !== (corpo.baseVersao as string | null)) return { tipo: "mudou" as const };
    const antes = await paresGuardados(actor.organizationId, exec);
    const dif = diferencaDosPares(antes, lidos.pares);
    if (!dif.mudou) return { tipo: "igual" as const };
    const agora = new Date();
    if (dif.inserir.length) await tx.insert(locaisDeslocamentoTable).values(dif.inserir.map((p) => ({ organizationId: actor.organizationId, locationAId: p.locationAId, locationBId: p.locationBId, minutos: p.minutos, createdBy: actor.sub, createdAt: agora, updatedAt: agora })));
    for (const p of [...dif.reativar, ...dif.atualizar]) await tx.update(locaisDeslocamentoTable).set({ active: true, minutos: p.novoMinutos, updatedAt: agora }).where(eq(locaisDeslocamentoTable.id, p.id));
    if (dif.remover.length) await tx.update(locaisDeslocamentoTable).set({ active: false, updatedAt: agora }).where(inArray(locaisDeslocamentoTable.id, dif.remover.map((p) => p.id)));
    const nomeDoPar = (p: { locationAId: string; locationBId: string }) => `${nomes.get(p.locationAId) ?? "?"} ↔ ${nomes.get(p.locationBId) ?? "?"}`;
    const partes = [
      ...dif.inserir.map((p) => `${nomeDoPar(p)}: ${p.minutos} min (novo)`),
      ...dif.reativar.map((p) => `${nomeDoPar(p)}: ${p.novoMinutos} min (voltou)`),
      ...dif.atualizar.map((p) => `${nomeDoPar(p)}: de ${p.minutos} para ${p.novoMinutos} min`),
      ...dif.remover.map((p) => `${nomeDoPar(p)}: tempo retirado (era ${p.minutos} min)`),
    ];
    await writeEntityHistory(req, {
      category: "OPERATIONAL_CHANGE", action: "locations.deslocamento_alterado", title: "Tempo de ida entre locais alterado",
      narrative: `Tempo de ida entre locais: ${partes.join("; ")}.`,
      entityType: "organization", entityId: actor.organizationId, actorId: actor.sub, orgId: actor.organizationId,
      beforeState: { pares: antes.filter((g) => g.active).map(({ locationAId, locationBId, minutos }) => ({ locationAId, locationBId, minutos })) }, afterState: { pares: lidos.pares },
    }, tx as any);
    return { tipo: "gravou" as const };
  });
  const atual = await deslocamentoParaTela(actor.organizationId, true);
  if (resultado.tipo === "mudou") { res.status(409).json({ error: "VERSAO_MUDOU", message: FRASE_DESLOCAMENTO_MUDOU, ...atual }); return; }
  res.json({ ...atual, mudou: resultado.tipo === "gravou" });
});

/** Qual dia a Escala mostra ao abrir (a partir de que horas abre no dia seguinte e a partir de que horas volta a hoje). Só a Administração muda. */
router.put("/locations/:id/virada-do-dia", requireAuth, requireOrganization, requireRole("ADMIN"), async (req, res) => {
  const before = await locationInOrg(req.params.id as string, req.user!.organizationId);
  if (!before) { res.status(404).json({ error: "NAO_ENCONTRADO", message: "Local não encontrado." }); return; }
  const voltarAoPadrao = req.body?.padrao === true;
  const abre = voltarAoPadrao ? VIRADA_PADRAO.abreAmanhaAPartirDe : req.body?.abreAmanhaAPartirDe;
  const volta = voltarAoPadrao ? VIRADA_PADRAO.voltaAHojeAPartirDe : req.body?.voltaAHojeAPartirDe;
  const invalida = fraseDaViradaInvalida(abre, volta);
  if (invalida) { res.status(400).json(invalida); return; }
  const antes = viradaDoLocal(before);
  if (antes.abreAmanhaAPartirDe === abre && antes.voltaAHojeAPartirDe === volta) { res.json({ viradaDoDia: antes, alterado: false }); return; }
  try {
    const depois = await db.transaction(async (tx) => {
      const [next] = await tx.update(locationsTable).set({ escalaAbreAmanhaAPartir: abre as string, escalaVoltaAHojeAPartir: volta as string, updatedAt: new Date() }).where(eq(locationsTable.id, before.id)).returning();
      if (!next) throw new Error("Local não encontrado");
      const novo = viradaDoLocal(next);
      await writeEntityHistory(req, {
        category: "OPERATIONAL_CHANGE", action: "location.virada_do_dia_alterada", title: "Dia que a Escala abre alterado",
        narrative: `${before.name}: a Escala passa a abrir no dia seguinte a partir das ${novo.abreAmanhaAPartirDe} (era ${antes.abreAmanhaAPartirDe}) e a voltar a abrir em hoje a partir das ${novo.voltaAHojeAPartirDe} (era ${antes.voltaAHojeAPartirDe}).${voltarAoPadrao ? " Voltou ao padrão." : ""}`,
        entityType: "location", entityId: next.id, actorId: req.user!.sub, orgId: req.user!.organizationId, beforeState: antes, afterState: novo,
      }, tx as any);
      return novo;
    });
    res.json({ viradaDoDia: depois, alterado: true });
  } catch {
    // Falha de banco ou de rede: nada foi alterado, e a frase diz isso (não é erro de quem digitou).
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Não consegui salvar agora. Nada foi alterado; tente de novo." });
  }
});

router.post("/locations", requireAuth, requireOrganization, requireRole("ADMIN"), async (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const type = typeof req.body?.type === "string" && req.body.type.trim() ? req.body.type.trim() : "parque";
  const operatingDays = Array.isArray(req.body?.operatingDays) ? req.body.operatingDays.filter((day: unknown) => Number.isInteger(day) && Number(day) >= 0 && Number(day) <= 6) : [1, 2, 3, 4, 5, 6, 0];
  const openTime = typeof req.body?.openTime === "string" && /^\d{2}:\d{2}$/.test(req.body.openTime) ? req.body.openTime : "08:00";
  const closeTime = typeof req.body?.closeTime === "string" && /^\d{2}:\d{2}$/.test(req.body.closeTime) ? req.body.closeTime : "22:00";
  if (!name) { res.status(400).json({ error: "CAMPOS_INVALIDOS", message: "name é obrigatório." }); return; }
  // A operação dona do local é escolhida no cadastro (operationIds). Sem escolha, só dá para decidir sozinho
  // quando existe uma única operação ativa; com duas ou mais, ligar a todas travaria a Escala do local.
  const escolhidas: string[] | null = Array.isArray(req.body?.operationIds) && req.body.operationIds.every((id: unknown) => typeof id === "string")
    ? [...new Set<string>(req.body.operationIds)] : null;
  const ativasDaCasa = await db.select({ id: operationsTable.id }).from(operationsTable).where(and(eq(operationsTable.organizationId, req.user!.organizationId), eq(operationsTable.status, "ACTIVE")));
  if (escolhidas === null && ativasDaCasa.length > 1) {
    res.status(400).json({ error: "OPERACAO_OBRIGATORIA", message: "Escolha de qual operação é este local. A Escala e os shows dele dependem disso." }); return;
  }
  // Operação em configuração também pode receber locais: sem local aberto ela não passa no checklist de ativação.
  const emConfiguracao = await db.select({ id: operationsTable.id }).from(operationsTable).where(and(eq(operationsTable.organizationId, req.user!.organizationId), eq(operationsTable.status, "DRAFT")));
  if (escolhidas && escolhidas.some((id) => !ativasDaCasa.some((op) => op.id === id) && !emConfiguracao.some((op) => op.id === id))) {
    res.status(400).json({ error: "OPERACAO_INVALIDA", message: "Escolha só operações ativas ou em configuração desta organização." }); return;
  }
  if (escolhidas && escolhidas.length > 1) {
    res.status(400).json({ error: "OPERACAO_UNICA", message: "Um local pertence a uma operação só. Escolha uma." }); return;
  }
  try {
    const location = await db.transaction(async (tx) => {
      const [created] = await tx.insert(locationsTable).values({ organizationId: req.user!.organizationId, name, type, operatingDays, openTime, closeTime, closed: false }).returning();
      if (!created) throw new Error("Local não criado");
      const donas = escolhidas ?? ativasDaCasa.map((op) => op.id);
      if (donas.length) await tx.insert(operationLocationsTable).values(donas.map((operationId) => ({ operationId, locationId: created.id, active: true })));
      await writeEntityHistory(req, { category: "OPERATIONAL_CHANGE", action: "location.created", title: "Local criado", narrative: "Local operacional criado.", entityType: "location", entityId: created.id, actorId: req.user!.sub, orgId: req.user!.organizationId, beforeState: null, afterState: created }, tx as any);
      return created;
    });
    res.status(201).json({ location });
  } catch (err) {
    if (isUniqueViolation(err)) { res.status(409).json({ error: "CONFLITO", message: "Já existe um local com este nome." }); return; }
    // Falha de banco ou de rede não é nome repetido: dizer que é faria a pessoa trocar o nome atrás de um problema que não é dela.
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Não consegui salvar agora. Nada foi alterado; tente de novo." });
  }
});

router.patch("/locations/:id", requireAuth, requireOrganization, requireRole("ADMIN"), async (req, res) => {
  const before = await locationInOrg(req.params.id as string, req.user!.organizationId);
  if (!before) { res.status(403).json({ error: "Forbidden", message: "Recurso fora do escopo" }); return; }
  if (!before.closed && req.body?.closed === true) {
    const semLocal = await operacoesQueFicariamSemLocal(before.id, req.user!.organizationId);
    if (semLocal.length) { res.status(409).json({ error: "ULTIMO_LOCAL", message: `Este é o último local aberto de ${semLocal.join(", ")}, que está ativa: sem local a Escala e os shows dela deixam de existir. Ligue outro local à operação, ou encerre a operação, antes de encerrar este.` }); return; }
  }
  const reopening = before.closed && req.body?.closed === false;
  const reason = reopening ? requireReason(res, req.body?.reason, "reabrir local") : null;
  if (reopening && !reason) return;
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : before.name;
  if (!name) { res.status(400).json({ error: "CAMPOS_INVALIDOS", message: "name não pode ser vazio." }); return; }
  const operatingDays = Array.isArray(req.body?.operatingDays) ? req.body.operatingDays.filter((day: unknown) => Number.isInteger(day) && Number(day) >= 0 && Number(day) <= 6) : before.operatingDays;
  const openTime = typeof req.body?.openTime === "string" && /^\d{2}:\d{2}$/.test(req.body.openTime) ? req.body.openTime : before.openTime;
  const closeTime = typeof req.body?.closeTime === "string" && /^\d{2}:\d{2}$/.test(req.body.closeTime) ? req.body.closeTime : before.closeTime;
  try {
    const location = await db.transaction(async (tx) => {
      const [next] = await tx.update(locationsTable).set({ name, type: typeof req.body?.type === "string" && req.body.type.trim() ? req.body.type.trim() : before.type, operatingDays, openTime, closeTime, closed: typeof req.body?.closed === "boolean" ? req.body.closed : before.closed, closedReason: reopening ? null : (typeof req.body?.closedReason === "string" ? req.body.closedReason.trim() || null : before.closedReason), updatedAt: new Date() }).where(eq(locationsTable.id, before.id)).returning();
      if (!next) throw new Error("Local não encontrado");
      await writeEntityHistory(req, { category: "OPERATIONAL_CHANGE", action: reopening ? "location.reopened" : "location.updated", title: reopening ? "Local reaberto" : "Local alterado", narrative: reopening ? "Local reaberto com motivo." : "Local operacional alterado.", entityType: "location", entityId: next.id, actorId: req.user!.sub, orgId: req.user!.organizationId, beforeState: before, afterState: next, metadata: reason ? { reason } : {} }, tx as any);
      return next;
    });
    res.json({ location });
  } catch (err) {
    if (isUniqueViolation(err)) { res.status(409).json({ error: "CONFLITO", message: "Já existe um local com este nome." }); return; }
    // Falha de banco ou de rede não é nome repetido: dizer que é faria a pessoa trocar o nome atrás de um problema que não é dela.
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Não consegui salvar agora. Nada foi alterado; tente de novo." });
  }
});

/** Operações ATIVAS que ficariam sem nenhum local aberto se este local fechasse. */
async function operacoesQueFicariamSemLocal(locationId: string, organizationId: string) {
  const donas = await db.select({ id: operationsTable.id, name: operationsTable.name }).from(operationLocationsTable)
    .innerJoin(operationsTable, eq(operationLocationsTable.operationId, operationsTable.id))
    .where(and(eq(operationLocationsTable.locationId, locationId), eq(operationLocationsTable.active, true), eq(operationsTable.organizationId, organizationId), eq(operationsTable.status, "ACTIVE")));
  const semLocal: string[] = [];
  for (const dona of donas) {
    const outros = await db.select({ id: locationsTable.id }).from(operationLocationsTable)
      .innerJoin(locationsTable, eq(operationLocationsTable.locationId, locationsTable.id))
      .where(and(eq(operationLocationsTable.operationId, dona.id), eq(operationLocationsTable.active, true), eq(locationsTable.closed, false), ne(locationsTable.id, locationId))).limit(1);
    if (!outros.length) semLocal.push(dona.name);
  }
  return semLocal;
}

router.delete("/locations/:id", requireAuth, requireOrganization, requireRole("ADMIN"), async (req, res) => {
  const before = await locationInOrg(req.params.id as string, req.user!.organizationId);
  if (!before) { res.status(403).json({ error: "Forbidden", message: "Recurso fora do escopo" }); return; }
  if (!before.closed) {
    const semLocal = await operacoesQueFicariamSemLocal(before.id, req.user!.organizationId);
    if (semLocal.length) { res.status(409).json({ error: "ULTIMO_LOCAL", message: `Este é o último local aberto de ${semLocal.join(", ")}, que está ativa: sem local a Escala e os shows dela deixam de existir. Ligue outro local à operação, ou encerre a operação, antes de encerrar este.` }); return; }
  }
  const location = await db.transaction(async (tx) => {
    const [next] = await tx.update(locationsTable).set({ closed: true, closedReason: typeof req.body?.reason === "string" ? req.body.reason.trim() || before.closedReason : before.closedReason, updatedAt: new Date() }).where(eq(locationsTable.id, before.id)).returning();
    if (!next) throw new Error("Local não encontrado");
    await writeEntityHistory(req, { category: "OPERATIONAL_CHANGE", action: "location.closed", title: "Local encerrado", narrative: "Local preservado no histórico e encerrado.", entityType: "location", entityId: next.id, actorId: req.user!.sub, orgId: req.user!.organizationId, beforeState: before, afterState: next }, tx as any);
    return next;
  });
  res.json({ location });
});

router.get("/operations/:operationId/locations", requireAuth, requireOrganization, async (req, res) => {
  const [operation] = await db.select().from(operationsTable).where(and(eq(operationsTable.id, req.params.operationId as string), eq(operationsTable.organizationId, req.user!.organizationId))).limit(1);
  if (!operation) { res.status(403).json({ error: "Forbidden", message: "Recurso fora do escopo" }); return; }
  if (!mayReadReference(req.user!.role)) { res.status(403).json({ error: "ACESSO_NEGADO", message: "Sem permissão para esta ação." }); return; }
  const rows = await db.select({ location: locationsTable }).from(operationLocationsTable).innerJoin(locationsTable, eq(operationLocationsTable.locationId, locationsTable.id)).where(and(eq(operationLocationsTable.operationId, operation.id), eq(operationLocationsTable.active, true), eq(locationsTable.closed, false)));
  res.json({ locations: rows.map((row) => row.location) });
});

router.put("/operations/:operationId/locations", requireAuth, requireOrganization, requireRole("ADMIN"), async (req, res) => {
  const [operation] = await db.select().from(operationsTable).where(and(eq(operationsTable.id, req.params.operationId as string), eq(operationsTable.organizationId, req.user!.organizationId))).limit(1);
  const locationIds: string[] | null = Array.isArray(req.body?.locationIds) && req.body.locationIds.every((id: unknown) => typeof id === "string") ? [...new Set<string>(req.body.locationIds)] : null;
  if (!operation) { res.status(403).json({ error: "Forbidden", message: "Recurso fora do escopo" }); return; }
  if (!locationIds) { res.status(400).json({ error: "CAMPOS_INVALIDOS", message: "locationIds é obrigatório." }); return; }
  if (operation.status === "ARCHIVED") { res.status(409).json({ error: "OPERATION_ARCHIVED", message: "Esta operação está encerrada. Reabra-a antes de mudar os locais." }); return; }
  const locations = locationIds.length === 0 ? [] : await db.select({ id: locationsTable.id }).from(locationsTable).where(and(inArray(locationsTable.id, locationIds), eq(locationsTable.organizationId, req.user!.organizationId), eq(locationsTable.closed, false)));
  if (locations.length !== new Set(locationIds).size) { res.status(400).json({ error: "LOCAIS_INVALIDOS", message: "Todos os locais precisam existir, ser desta organização e estar abertos." }); return; }
  try {
    const resultado = await db.transaction(async (tx) => {
      // Só mexe nos locais abertos: o vínculo de um local encerrado fica como está, para voltar junto se ele reabrir.
      const atuais = await tx.select({ link: operationLocationsTable, closed: locationsTable.closed, name: locationsTable.name })
        .from(operationLocationsTable).innerJoin(locationsTable, eq(operationLocationsTable.locationId, locationsTable.id))
        .where(and(eq(operationLocationsTable.operationId, operation.id), eq(operationLocationsTable.active, true)));
      const abertosAtuais = atuais.filter((row) => !row.closed);
      const paraTirar = abertosAtuais.filter((row) => !locationIds.includes(row.link.locationId));
      const paraPor = locationIds.filter((locationId) => !abertosAtuais.some((row) => row.link.locationId === locationId));
      if (operation.status === "ACTIVE" && locationIds.length === 0) {
        return { erro: { status: 409, error: "ULTIMO_LOCAL", message: `"${operation.name}" está ativa e ficaria sem nenhum local aberto: a Escala e os shows dela deixariam de existir. Ligue outro local antes de tirar este, ou encerre a operação.` } } as const;
      }
      if (paraPor.length) {
        const deOutra = await tx.select({ locationName: locationsTable.name, operationName: operationsTable.name })
          .from(operationLocationsTable)
          .innerJoin(operationsTable, eq(operationLocationsTable.operationId, operationsTable.id))
          .innerJoin(locationsTable, eq(operationLocationsTable.locationId, locationsTable.id))
          .where(and(inArray(operationLocationsTable.locationId, paraPor), eq(operationLocationsTable.active, true), ne(operationLocationsTable.operationId, operation.id)));
        if (deOutra.length) {
          return { erro: { status: 409, error: "LOCAL_DE_OUTRA_OPERACAO", message: `Um local pertence a uma operação só. ${deOutra.map((row) => `"${row.locationName}" já é de ${row.operationName}`).join("; ")}.` } } as const;
        }
      }
      if (paraTirar.length) await tx.update(operationLocationsTable).set({ active: false, updatedAt: new Date() }).where(inArray(operationLocationsTable.id, paraTirar.map((row) => row.link.id)));
      const criados = paraPor.length ? await tx.insert(operationLocationsTable).values(paraPor.map((locationId) => ({ operationId: operation.id, locationId, active: true }))).returning() : [];
      if (paraTirar.length || criados.length) {
        await writeEntityHistory(req, { category: "OPERATIONAL_CHANGE", action: "operation_locations.updated", title: "Locais da operação atualizados", narrative: `Locais de "${operation.name}": ${criados.length} ligado(s), ${paraTirar.length} desligado(s). Nada foi apagado do histórico.`, entityType: "operation", entityId: operation.id, actorId: req.user!.sub, orgId: req.user!.organizationId, operationId: operation.id, beforeState: { locations: abertosAtuais.map((row) => row.link) }, afterState: { locations: criados } }, tx as any);
      }
      return { locations: [...abertosAtuais.filter((row) => !paraTirar.includes(row)).map((row) => row.link), ...criados] } as const;
    });
    const recusa = "erro" in resultado ? resultado.erro : undefined; if (recusa) { res.status(recusa.status).json({ error: recusa.error, message: recusa.message }); return; }
    res.json({ locations: "locations" in resultado ? resultado.locations : [] });
  } catch { res.status(500).json({ error: "INTERNAL_ERROR", message: "Não consegui salvar os locais da operação agora. Nada foi alterado; tente de novo." }); }
});

// Pessoa pertence à ASA e a uma área. O local é definido pela Programação e
// pela Escala em cada dia; esta rota conserva o caminho legado só para área.
router.put("/users/:id/operational-scope", requireAuth, requireOrganization, requireRole("ADMIN"), async (req, res) => {
  const [before] = await db.select().from(usersTable).where(and(eq(usersTable.id, req.params.id as string), eq(usersTable.organizationId, req.user!.organizationId))).limit(1);
  if (!before) { res.status(403).json({ error: "ACESSO_NEGADO", message: "Sem permissão para esta ação." }); return; }
  const { areaId } = req.body ?? {};
  if (typeof areaId !== "string") { res.status(400).json({ error: "CAMPOS_INVALIDOS", message: "areaId é obrigatório." }); return; }
  const area = await areaInOrg(areaId, req.user!.organizationId);
  if (!area?.active) { res.status(403).json({ error: "ACESSO_NEGADO", message: "Área fora do escopo ativo." }); return; }
  const scope = await db.transaction(async (tx) => {
    const [next] = await tx.update(usersTable).set({ areaId, updatedAt: new Date() }).where(eq(usersTable.id, before.id)).returning();
    if (!next) throw new Error("Pessoa não encontrada");
    const previous = { personId: before.id, areaId: before.areaId };
    const current = { personId: next.id, areaId: next.areaId };
    await writeEntityHistory(req, { category: "OPERATIONAL_CHANGE", action: "person.area_updated", title: "Área da pessoa alterada", narrative: "Área da pessoa atualizada.", entityType: "person", entityId: next.id, actorId: req.user!.sub, orgId: req.user!.organizationId, beforeState: previous, afterState: current }, tx);
    return current;
  });
  res.json({ scope });
});

router.delete("/areas/:id/locations/:locationId/supervisor", requireAuth, requireOrganization, requireRole("ADMIN"), async (req, res) => {
  const area = await areaInOrg(req.params.id as string, req.user!.organizationId);
  const location = await locationInOrg(req.params.locationId as string, req.user!.organizationId);
  if (!area || !location) { res.status(403).json({ error: "ACESSO_NEGADO", message: "Sem permissão para esta ação." }); return; }
  const mapping = await db.transaction(async (tx) => {
    const [before] = await tx.select().from(areaLocalSupervisorsTable).where(and(eq(areaLocalSupervisorsTable.areaId, area.id), eq(areaLocalSupervisorsTable.locationId, location.id), eq(areaLocalSupervisorsTable.active, true))).limit(1);
    if (!before) return null;
    const [next] = await tx.update(areaLocalSupervisorsTable).set({ active: false, updatedAt: new Date() }).where(eq(areaLocalSupervisorsTable.id, before.id)).returning();
    await writeEntityHistory(req, { category: "OPERATIONAL_CHANGE", action: "area_local_supervisor.revoked", title: "Supervisão revogada", narrative: "Atribuição desativada sem apagar o histórico.", entityType: "area_local_supervisor", entityId: before.id, actorId: req.user!.sub, orgId: req.user!.organizationId, beforeState: before, afterState: next! }, tx);
    return next;
  });
  res.json({ mapping });
});

export default router;
