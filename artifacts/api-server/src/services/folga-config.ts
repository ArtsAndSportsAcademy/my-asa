/**
 * Regras do pedido de folga que a Administração ajusta (Etapa 3). Até a tarefa de configuração
 * existir no banco, valem os padrões abaixo: prazo de 3 dias para a Supervisão responder e nenhum
 * limite de folgas por área (o aviso de cobertura só aparece quando há limite).
 */
export type ConfigFolga = {
  /** A Administração passa a poder decidir quando faltam N dias (corridos) para a data pedida. */
  prazoSupervisaoDias: number;
  /** areaId → quantas pessoas da área podem estar de folga no mesmo dia antes de avisar. */
  limiteFolgaPorArea: Record<string, number>;
};

export const CONFIG_FOLGA_PADRAO: ConfigFolga = { prazoSupervisaoDias: 3, limiteFolgaPorArea: {} };

export async function lerConfigFolga(_organizationId: string): Promise<ConfigFolga> {
  return { ...CONFIG_FOLGA_PADRAO, limiteFolgaPorArea: {} };
}
