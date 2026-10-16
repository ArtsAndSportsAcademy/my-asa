/**
 * GET /leave-requests/:id/analise — o panorama do dia para quem decide o pedido de folga.
 * Só leitura. Quem lê: Administração, Direção e a Supervisão da área da pessoa. O Elenco não vê
 * a análise: ela mostra a folga e a escala de todo mundo.
 */
import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, leaveRequestsTable } from "@workspace/db";
import { requireAuth, requireOrganization } from "../middlewares/auth.js";
import { canSupervisorAccessPerson } from "../services/area-local-scope.js";
import { analisarPedidoDeFolga } from "../services/analise-folga.js";

const router: IRouter = Router();
const isAdmin = (role: string) => role === "ADMIN";
const isDirector = (role: string) => role === "DIR" || role === "DIRECTOR";
const isSupervisor = (role: string) => role === "SUPERVISOR_A" || role === "SUPERVISOR_B" || role === "SUP";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.get("/leave-requests/:id/analise", requireAuth, requireOrganization, async (req, res) => {
  const actor = req.user!;
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!id || !UUID.test(id)) { res.status(404).json({ error: "Not Found", message: "Pedido não encontrado." }); return; }
  const [pedido] = await db.select().from(leaveRequestsTable).where(and(eq(leaveRequestsTable.id, id), eq(leaveRequestsTable.organizationId, actor.organizationId))).limit(1);
  if (!pedido) { res.status(404).json({ error: "Not Found", message: "Pedido não encontrado." }); return; }
  const pode = isAdmin(actor.role) || isDirector(actor.role)
    || (isSupervisor(actor.role) && pedido.userId !== actor.sub
      && await canSupervisorAccessPerson({ supervisorId: actor.sub, organizationId: actor.organizationId, personId: pedido.userId }));
  if (!pode) { res.status(403).json({ error: "Forbidden", message: "A análise do dia só é para quem decide o pedido: a Supervisão da área, a Administração ou a Direção." }); return; }
  res.json(await analisarPedidoDeFolga({ organizationId: actor.organizationId, userId: pedido.userId, startDate: pedido.startDate, endDate: pedido.endDate }));
});

export default router;
