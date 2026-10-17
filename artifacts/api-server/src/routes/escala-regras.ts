/**
 * GET/PUT /escala-regras — as regras de escala de cada local (16/10/2026): o máximo de shows que uma pessoa faz
 * por dia (vazio = sem limite) e o intervalo mínimo, em minutos, abaixo do qual dois shows do mesmo dia contam
 * como "colados". O motor do Livro do Dia lê essas regras (services/regras-de-escala.ts).
 *
 * Lê: Administração e Direção em qualquer local; Supervisão no local em que responde por alguma área.
 * Grava: só a Administração, com antes e depois no Registro na mesma transação.
 */
import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, escalaRegrasLocalTable, locationsTable } from "@workspace/db";
import { requireAuth, requireOrganization } from "../middlewares/auth.js";
import { writeHistoryEvent, type HistoryExecutor } from "../lib/history-helper.js";
import { listAreaLocalScopes } from "../services/area-local-scope.js";
import { INTERVALO_COLADO_PADRAO_MINUTOS } from "../services/regras-de-escala.js";

const router: IRouter = Router();
const LIMITE_MAXIMO = 20;
const INTERVALO_MAXIMO = 240;

type Regras = { limiteShowsDia: number | null; intervaloMinimoMinutos: number };

async function lerRegras(locationId: string): Promise<Regras> {
  const [linha] = await db.select().from(escalaRegrasLocalTable).where(eq(escalaRegrasLocalTable.locationId, locationId)).limit(1);
  return { limiteShowsDia: linha?.limiteShowsDia ?? null, intervaloMinimoMinutos: linha?.intervaloMinimoMinutos ?? INTERVALO_COLADO_PADRAO_MINUTOS };
}

async function localDaOrganizacao(locationId: string, organizationId: string) {
  const [local] = await db.select({ id: locationsTable.id, name: locationsTable.name }).from(locationsTable)
    .where(and(eq(locationsTable.id, locationId), eq(locationsTable.organizationId, organizationId))).limit(1);
  return local ?? null;
}

router.get("/escala-regras", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  const ator = req.user!;
  const locationId = typeof req.query.locationId === "string" ? req.query.locationId : "";
  if (!locationId) { res.status(400).json({ error: "Bad Request", message: "Informe o local." }); return; }
  if (!(await localDaOrganizacao(locationId, ator.organizationId))) { res.status(404).json({ error: "Not Found", message: "Local não encontrado." }); return; }
  const lePorQualquerLocal = ator.role === "ADMIN" || ator.role === "DIR";
  const supervisaoDoLocal = !lePorQualquerLocal && ["SUPERVISOR_A", "SUPERVISOR_B"].includes(ator.role)
    && (await listAreaLocalScopes(ator.sub, ator.organizationId)).some((s) => s.locationId === locationId);
  if (!lePorQualquerLocal && !supervisaoDoLocal) {
    res.status(403).json({ error: "Forbidden", message: "As regras de escala são só para quem gerencia o local: Administração, Direção e a Supervisão dele." }); return;
  }
  res.json({ ...(await lerRegras(locationId)), podeEditar: ator.role === "ADMIN" });
});

router.put("/escala-regras", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  const ator = req.user!;
  if (ator.role !== "ADMIN") { res.status(403).json({ error: "Forbidden", message: "Só a Administração altera as regras de escala do local." }); return; }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const locationId = typeof body.locationId === "string" ? body.locationId : "";
  if (!locationId) { res.status(400).json({ error: "Bad Request", message: "Informe o local." }); return; }
  const local = await localDaOrganizacao(locationId, ator.organizationId);
  if (!local) { res.status(404).json({ error: "Not Found", message: "Local não encontrado." }); return; }

  const antes = await lerRegras(locationId);
  const depois: Regras = { ...antes };
  if (body.limiteShowsDia !== undefined) {
    const n = body.limiteShowsDia;
    if (n !== null && (typeof n !== "number" || !Number.isInteger(n) || n < 1 || n > LIMITE_MAXIMO)) {
      res.status(400).json({ error: "Bad Request", message: `O limite é de 1 a ${LIMITE_MAXIMO} shows por dia; deixe em branco para não ter limite.` }); return;
    }
    depois.limiteShowsDia = n;
  }
  if (body.intervaloMinimoMinutos !== undefined) {
    const n = body.intervaloMinimoMinutos;
    if (typeof n !== "number" || !Number.isInteger(n) || n < 0 || n > INTERVALO_MAXIMO) {
      res.status(400).json({ error: "Bad Request", message: `O intervalo mínimo entre shows é de 0 a ${INTERVALO_MAXIMO} minutos.` }); return;
    }
    depois.intervaloMinimoMinutos = n;
  }

  await db.transaction(async (tx) => {
    await tx.insert(escalaRegrasLocalTable).values({ locationId, ...depois, updatedBy: ator.sub, updatedAt: new Date() })
      .onConflictDoUpdate({ target: escalaRegrasLocalTable.locationId, set: { ...depois, updatedBy: ator.sub, updatedAt: new Date() } });
    await writeHistoryEvent({
      category: "SCALE", action: "escala_regras.atualizada", title: `Regras de escala atualizadas: ${local.name}`,
      narrative: `${local.name}: limite de shows por dia ${antes.limiteShowsDia ?? "sem limite"} → ${depois.limiteShowsDia ?? "sem limite"}; intervalo mínimo entre shows ${antes.intervaloMinimoMinutos} → ${depois.intervaloMinimoMinutos} minutos.`,
      entityType: "location", entityId: locationId, actorId: ator.sub, actorType: "HUMAN", orgId: ator.organizationId, beforeState: antes, afterState: depois,
    }, tx as unknown as HistoryExecutor);
  });
  res.json({ ...depois, podeEditar: true });
});

export default router;
