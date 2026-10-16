/**
 * Quem pode decidir (ou propor troca de) um pedido de folga, e por que não: a mesma regra para a
 * decisão e para a troca. A ordem das barreiras é a de sempre: escopo, já decidido, o próprio
 * pedido e, só para a Administração, o prazo da Supervisão.
 */
import { db } from "@workspace/db";
import { canSupervisorAccessPerson } from "./area-local-scope.js";
import { diaEmQueOPrazoAbre, prazoAdminAberto, supervisoresDaArea } from "./folga-roteamento.js";
import { lerConfigFolga } from "./folga-config.js";
import { operationalDate } from "../lib/operational-date.js";

export type AtorFolga = { sub: string; role: string; organizationId: string };
export type Barreira = { status: number; message: string };

const isAdmin = (role: string) => role === "ADMIN";
const isSupervisor = (role: string) => role === "SUPERVISOR_A" || role === "SUPERVISOR_B" || role === "SUP";

export async function barreiraDeDecisao(ator: AtorFolga, pedido: { userId: string; areaId: string | null; startDate: string; status: string }): Promise<Barreira | null> {
  const dono = isAdmin(ator.role) || (isSupervisor(ator.role) && await canSupervisorAccessPerson({ supervisorId: ator.sub, organizationId: ator.organizationId, personId: pedido.userId }));
  if (!dono) return { status: 403, message: "Só a Supervisão da área da pessoa ou a Administração decidem este pedido." };
  if (pedido.status !== "PENDING") return { status: 409, message: "Este pedido já foi decidido." };
  if (pedido.userId === ator.sub) return { status: 403, message: "Ninguém decide o próprio pedido de folga." };
  // A Supervisão da área decide primeiro. A Administração só entra quando a área não tem Supervisão ou quando o prazo abriu.
  if (isAdmin(ator.role) && (await supervisoresDaArea(db, pedido.areaId)).length > 0) {
    const { prazoSupervisaoDias } = await lerConfigFolga(ator.organizationId);
    if (!prazoAdminAberto(pedido.startDate, operationalDate(), prazoSupervisaoDias)) {
      const quando = diaEmQueOPrazoAbre(pedido.startDate, prazoSupervisaoDias).split("-").reverse().slice(0, 2).join("/");
      return { status: 409, message: `A Supervisão da área tem até ${quando} para responder; a Administração pode decidir a partir daí.` };
    }
  }
  return null;
}
