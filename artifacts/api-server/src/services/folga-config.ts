/**
 * Regras do pedido de folga que a Administração ajusta (Etapa 3). Uma linha por organização em
 * `folga_config`; sem linha, valem os padrões: prazo de 3 dias para a Supervisão responder e nenhum
 * limite de folgas por área (o aviso de cobertura só aparece quando há limite).
 */
import { eq } from "drizzle-orm";
import { db, folgaConfigTable } from "@workspace/db";

export type ConfigFolga = {
  /** A Administração passa a poder decidir quando faltam N dias (corridos) para a data pedida. */
  prazoSupervisaoDias: number;
  /** areaId → quantas pessoas da área podem estar de folga no mesmo dia antes de avisar. */
  limiteFolgaPorArea: Record<string, number>;
};

export const CONFIG_FOLGA_PADRAO: ConfigFolga = { prazoSupervisaoDias: 3, limiteFolgaPorArea: {} };
export const PRAZO_MAXIMO_DIAS = 30;
export const LIMITE_MAXIMO_POR_AREA = 200;

export async function lerConfigFolga(organizationId: string): Promise<ConfigFolga> {
  const [linha] = await db.select().from(folgaConfigTable).where(eq(folgaConfigTable.organizationId, organizationId)).limit(1);
  if (!linha) return { ...CONFIG_FOLGA_PADRAO, limiteFolgaPorArea: {} };
  return { prazoSupervisaoDias: linha.prazoSupervisaoDias, limiteFolgaPorArea: { ...(linha.limiteFolgaPorArea ?? {}) } };
}
