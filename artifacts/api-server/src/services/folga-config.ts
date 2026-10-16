/**
 * Regras do pedido de folga que a Administração ajusta (Etapa 3). Uma linha por organização em
 * `folga_config`; sem linha, valem os padrões: prazo de 3 dias para a Supervisão responder, nenhum
 * limite de folgas e lembrete de resposta depois de 24 horas.
 *
 * Os limites de folga por dia são dois e independentes (cada um liga e desliga):
 *  - total: quantas pessoas da organização inteira podem estar de folga no mesmo dia;
 *  - por área: quantas pessoas de cada área.
 * Cada um tem um modo: REFERENCIA só avisa; EXIGE_MOTIVO deixa passar do limite apenas com motivo escrito.
 * Nenhum dos dois é uma trava absoluta.
 */
import { and, eq, inArray, lte, gte } from "drizzle-orm";
import { db, folgaConfigTable, folgasTable, usersTable } from "@workspace/db";

export type ModoDoLimite = "REFERENCIA" | "EXIGE_MOTIVO";

export type ConfigFolga = {
  /** A Administração passa a poder decidir quando faltam N dias (corridos) para a data pedida. */
  prazoSupervisaoDias: number;
  /** areaId → quantas pessoas da área podem estar de folga no mesmo dia. */
  limiteFolgaPorArea: Record<string, number>;
  limiteAreaAtivo: boolean;
  limiteAreaModo: ModoDoLimite;
  limiteTotalAtivo: boolean;
  /** Pessoas da organização inteira de folga no mesmo dia; null = não definido. */
  limiteTotal: number | null;
  limiteTotalModo: ModoDoLimite;
  /** Horas sem resposta até o lembrete ao colega da troca (ou à pessoa da proposta de dias); 0 = sem lembrete. */
  lembreteRespostaHoras: number;
};

export const CONFIG_FOLGA_PADRAO: ConfigFolga = {
  prazoSupervisaoDias: 3, limiteFolgaPorArea: {}, limiteAreaAtivo: true, limiteAreaModo: "REFERENCIA",
  limiteTotalAtivo: false, limiteTotal: null, limiteTotalModo: "REFERENCIA", lembreteRespostaHoras: 24,
};
export const PRAZO_MAXIMO_DIAS = 30;
export const LIMITE_MAXIMO_POR_AREA = 200;
export const LIMITE_MAXIMO_TOTAL = 2000;
export const LEMBRETE_MAXIMO_HORAS = 168;

export async function lerConfigFolga(organizationId: string): Promise<ConfigFolga> {
  const [linha] = await db.select().from(folgaConfigTable).where(eq(folgaConfigTable.organizationId, organizationId)).limit(1);
  if (!linha) return { ...CONFIG_FOLGA_PADRAO, limiteFolgaPorArea: {} };
  const modo = (valor: string): ModoDoLimite => valor === "EXIGE_MOTIVO" ? "EXIGE_MOTIVO" : "REFERENCIA";
  return {
    prazoSupervisaoDias: linha.prazoSupervisaoDias, limiteFolgaPorArea: { ...(linha.limiteFolgaPorArea ?? {}) },
    limiteAreaAtivo: linha.limiteAreaAtivo, limiteAreaModo: modo(linha.limiteAreaModo),
    limiteTotalAtivo: linha.limiteTotalAtivo, limiteTotal: linha.limiteTotal, limiteTotalModo: modo(linha.limiteTotalModo),
    lembreteRespostaHoras: linha.lembreteRespostaHoras,
  };
}

export type LimiteExcedido = {
  tipo: "TOTAL" | "AREA";
  date: string;
  /** Quantas pessoas ficam de folga nesse dia com o que está sendo pedido. */
  folgam: number;
  limite: number;
  modo: ModoDoLimite;
  areaId?: string;
};

/**
 * Para cada dia, confere os dois limites considerando quem JÁ está de folga (DAY_OFF ativa, em qualquer operação da
 * organização) mais as pessoas que estão sendo colocadas de folga agora. Só devolve o que passou do limite ligado.
 */
export async function limitesExcedidos(input: {
  organizationId: string;
  pessoas: Array<{ id: string; areaId: string | null }>;
  dates: string[];
  config?: ConfigFolga;
}): Promise<LimiteExcedido[]> {
  const config = input.config ?? await lerConfigFolga(input.organizationId);
  const usarTotal = config.limiteTotalAtivo && typeof config.limiteTotal === "number";
  const usarArea = config.limiteAreaAtivo && Object.keys(config.limiteFolgaPorArea).length > 0;
  if (!input.dates.length || !input.pessoas.length || (!usarTotal && !usarArea)) return [];
  const ordenadas = [...input.dates].sort();
  const linhas = await db.select({ userId: folgasTable.userId, startDate: folgasTable.startDate, endDate: folgasTable.endDate, areaId: usersTable.areaId })
    .from(folgasTable).innerJoin(usersTable, eq(usersTable.id, folgasTable.userId))
    .where(and(eq(usersTable.organizationId, input.organizationId), eq(folgasTable.status, "ACTIVE"), eq(folgasTable.type, "DAY_OFF"),
      lte(folgasTable.startDate, ordenadas[ordenadas.length - 1]!), gte(folgasTable.endDate, ordenadas[0]!)));
  const novas = new Map(input.pessoas.map((pessoa) => [pessoa.id, pessoa.areaId]));
  const excedidos: LimiteExcedido[] = [];
  for (const date of ordenadas) {
    const folgam = new Map<string, string | null>();
    for (const linha of linhas) if (linha.startDate <= date && linha.endDate >= date) folgam.set(linha.userId, linha.areaId);
    for (const [id, areaId] of novas) folgam.set(id, areaId);
    if (usarTotal && folgam.size > config.limiteTotal!) excedidos.push({ tipo: "TOTAL", date, folgam: folgam.size, limite: config.limiteTotal!, modo: config.limiteTotalModo });
    if (usarArea) {
      for (const areaId of new Set([...novas.values()].filter((id): id is string => Boolean(id)))) {
        const limite = config.limiteFolgaPorArea[areaId];
        if (typeof limite !== "number") continue;
        const daArea = [...folgam.values()].filter((id) => id === areaId).length;
        if (daArea > limite) excedidos.push({ tipo: "AREA", date, folgam: daArea, limite, modo: config.limiteAreaModo, areaId });
      }
    }
  }
  return excedidos;
}

/** Frase para a gerência, no mesmo tom da análise do pedido. */
export function fraseDoLimite(e: LimiteExcedido, nomeDaArea?: string): string {
  const dia = e.date.split("-").reverse().slice(0, 2).join("/");
  return e.tipo === "TOTAL"
    ? `No ${dia} ficam ${e.folgam} pessoas de folga na casa toda (o limite total é ${e.limite}).`
    : `No ${dia} ${nomeDaArea ?? "a área"} fica com ${e.folgam} de folga (o limite da área é ${e.limite}).`;
}
