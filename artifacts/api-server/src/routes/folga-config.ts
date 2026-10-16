/**
 * GET/PUT /folga-config — as regras do pedido de folga que a Administração ajusta: o prazo da
 * Supervisão (em dias corridos) e o limite de folgas por dia em cada área. O limite só avisa na análise
 * do pedido; nunca trava. Lê: Administração, Direção e Supervisão. Grava: só a Administração, com antes
 * e depois no Registro na mesma transação.
 */
import { Router, type IRouter } from "express";
import { and, asc, eq } from "drizzle-orm";
import { areasTable, db, folgaConfigTable } from "@workspace/db";
import { requireAuth, requireOrganization } from "../middlewares/auth.js";
import { isAdmin, isDirector, isSupervisor } from "../services/folga-comum.js";
import { writeHistoryEvent, type HistoryExecutor } from "../lib/history-helper.js";
import { LEMBRETE_MAXIMO_HORAS, LIMITE_MAXIMO_POR_AREA, LIMITE_MAXIMO_TOTAL, PRAZO_MAXIMO_DIAS, lerConfigFolga, type ConfigFolga } from "../services/folga-config.js";

const router: IRouter = Router();

async function areasDaOrganizacao(organizationId: string) {
  return db.select({ id: areasTable.id, name: areasTable.name }).from(areasTable)
    .where(and(eq(areasTable.organizationId, organizationId), eq(areasTable.active, true))).orderBy(asc(areasTable.name));
}

router.get("/folga-config", requireAuth, requireOrganization, async (req, res) => {
  const ator = req.user!;
  if (!isAdmin(ator.role) && !isDirector(ator.role) && !isSupervisor(ator.role)) {
    res.status(403).json({ error: "Forbidden", message: "As regras do pedido de folga só são para quem gerencia: Administração, Direção e Supervisão." }); return;
  }
  res.json({ config: await lerConfigFolga(ator.organizationId), areas: await areasDaOrganizacao(ator.organizationId), podeEditar: isAdmin(ator.role) });
});

router.put("/folga-config", requireAuth, requireOrganization, async (req, res) => {
  const ator = req.user!, body = req.body as Record<string, unknown>;
  if (!isAdmin(ator.role)) { res.status(403).json({ error: "Forbidden", message: "Só a Administração altera as regras do pedido de folga." }); return; }
  const antes = await lerConfigFolga(ator.organizationId);
  const depois: ConfigFolga = { ...antes, limiteFolgaPorArea: { ...antes.limiteFolgaPorArea } };

  if (body.prazoSupervisaoDias !== undefined) {
    const n = body.prazoSupervisaoDias;
    if (typeof n !== "number" || !Number.isInteger(n) || n < 0 || n > PRAZO_MAXIMO_DIAS) {
      res.status(400).json({ error: "Bad Request", message: `O prazo da Supervisão é um número inteiro de dias, de 0 a ${PRAZO_MAXIMO_DIAS}.` }); return;
    }
    depois.prazoSupervisaoDias = n;
  }
  if (body.limiteFolgaPorArea !== undefined) {
    if (!body.limiteFolgaPorArea || typeof body.limiteFolgaPorArea !== "object" || Array.isArray(body.limiteFolgaPorArea)) {
      res.status(400).json({ error: "Bad Request", message: "O limite por área precisa ser uma lista de área e número de pessoas." }); return;
    }
    const validas = new Set((await areasDaOrganizacao(ator.organizationId)).map((a) => a.id));
    const novo: Record<string, number> = {};
    for (const [areaId, valor] of Object.entries(body.limiteFolgaPorArea as Record<string, unknown>)) {
      if (!validas.has(areaId)) { res.status(400).json({ error: "Bad Request", message: "Uma das áreas do limite não existe nesta organização." }); return; }
      if (valor === null) continue; // sem limite para a área
      if (typeof valor !== "number" || !Number.isInteger(valor) || valor < 0 || valor > LIMITE_MAXIMO_POR_AREA) {
        res.status(400).json({ error: "Bad Request", message: `O limite de folgas por dia é um número inteiro de pessoas, de 0 a ${LIMITE_MAXIMO_POR_AREA}.` }); return;
      }
      novo[areaId] = valor;
    }
    depois.limiteFolgaPorArea = novo;
  }

  // Limites ligáveis e desligáveis: o total da casa e o por área, cada um só avisando ou exigindo motivo.
  const ehModo = (v: unknown): v is "REFERENCIA" | "EXIGE_MOTIVO" => v === "REFERENCIA" || v === "EXIGE_MOTIVO";
  if (body.limiteTotalAtivo !== undefined) {
    if (typeof body.limiteTotalAtivo !== "boolean") { res.status(400).json({ error: "Bad Request", message: "Ligar ou desligar o limite total é sim ou não." }); return; }
    depois.limiteTotalAtivo = body.limiteTotalAtivo;
  }
  if (body.limiteTotal !== undefined) {
    const n = body.limiteTotal;
    if (n !== null && (typeof n !== "number" || !Number.isInteger(n) || n < 0 || n > LIMITE_MAXIMO_TOTAL)) {
      res.status(400).json({ error: "Bad Request", message: `O limite total de folgas por dia é um número inteiro de pessoas, de 0 a ${LIMITE_MAXIMO_TOTAL}.` }); return;
    }
    depois.limiteTotal = n as number | null;
  }
  if (body.limiteTotalModo !== undefined) {
    if (!ehModo(body.limiteTotalModo)) { res.status(400).json({ error: "Bad Request", message: "O limite total só avisa (referência) ou exige motivo." }); return; }
    depois.limiteTotalModo = body.limiteTotalModo;
  }
  if (body.limiteAreaAtivo !== undefined) {
    if (typeof body.limiteAreaAtivo !== "boolean") { res.status(400).json({ error: "Bad Request", message: "Ligar ou desligar o limite por área é sim ou não." }); return; }
    depois.limiteAreaAtivo = body.limiteAreaAtivo;
  }
  if (body.limiteAreaModo !== undefined) {
    if (!ehModo(body.limiteAreaModo)) { res.status(400).json({ error: "Bad Request", message: "O limite por área só avisa (referência) ou exige motivo." }); return; }
    depois.limiteAreaModo = body.limiteAreaModo;
  }
  if (body.lembreteRespostaHoras !== undefined) {
    const n = body.lembreteRespostaHoras;
    if (typeof n !== "number" || !Number.isInteger(n) || n < 0 || n > LEMBRETE_MAXIMO_HORAS) {
      res.status(400).json({ error: "Bad Request", message: `O lembrete de resposta é um número inteiro de horas, de 0 (sem lembrete) a ${LEMBRETE_MAXIMO_HORAS}.` }); return;
    }
    depois.lembreteRespostaHoras = n;
  }
  if (depois.limiteTotalAtivo && depois.limiteTotal === null) {
    res.status(400).json({ error: "Bad Request", message: "Para ligar o limite total, diga quantas pessoas podem estar de folga no mesmo dia." }); return;
  }

  await db.transaction(async (tx) => {
    await tx.insert(folgaConfigTable).values({ organizationId: ator.organizationId, prazoSupervisaoDias: depois.prazoSupervisaoDias, limiteFolgaPorArea: depois.limiteFolgaPorArea, limiteTotalAtivo: depois.limiteTotalAtivo, limiteTotal: depois.limiteTotal, limiteTotalModo: depois.limiteTotalModo, limiteAreaAtivo: depois.limiteAreaAtivo, limiteAreaModo: depois.limiteAreaModo, lembreteRespostaHoras: depois.lembreteRespostaHoras, updatedBy: ator.sub, updatedAt: new Date() })
      .onConflictDoUpdate({ target: folgaConfigTable.organizationId, set: { prazoSupervisaoDias: depois.prazoSupervisaoDias, limiteFolgaPorArea: depois.limiteFolgaPorArea, limiteTotalAtivo: depois.limiteTotalAtivo, limiteTotal: depois.limiteTotal, limiteTotalModo: depois.limiteTotalModo, limiteAreaAtivo: depois.limiteAreaAtivo, limiteAreaModo: depois.limiteAreaModo, lembreteRespostaHoras: depois.lembreteRespostaHoras, updatedBy: ator.sub, updatedAt: new Date() } });
    await writeHistoryEvent({
      category: "ABSENCE", action: "folga.config_changed", title: "Regras do pedido de folga alteradas",
      narrative: `Prazo da Supervisão: ${antes.prazoSupervisaoDias} → ${depois.prazoSupervisaoDias} dias. Limites por área: ${Object.keys(depois.limiteFolgaPorArea).length} definido(s), ${depois.limiteAreaAtivo ? "ligados" : "desligados"}. Limite total: ${depois.limiteTotalAtivo ? `${depois.limiteTotal} pessoas por dia` : "desligado"}. Lembrete de resposta: ${depois.lembreteRespostaHoras ? `${depois.lembreteRespostaHoras} h` : "sem lembrete"}.`,
      entityType: "folga_config", entityId: ator.organizationId, actorId: ator.sub, orgId: ator.organizationId, beforeState: antes, afterState: depois,
    }, tx as unknown as HistoryExecutor);
  });
  res.json({ config: depois });
});

export default router;
