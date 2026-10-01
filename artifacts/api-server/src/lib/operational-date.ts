/**
 * Calendário operacional do My ASA. Datas de escala, livros, check-in e
 * rodízio são datas civis em São Paulo, não datas UTC do servidor.
 */
export const OPERATIONAL_TIME_ZONE = "America/Sao_Paulo";

function parts(value: Date): { year: number; month: number; day: number } {
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: OPERATIONAL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const valueOf = (type: string) => Number(formatted.find((part) => part.type === type)?.value);
  return { year: valueOf("year"), month: valueOf("month"), day: valueOf("day") };
}

export function operationalDate(now: Date = new Date()): string {
  const { year, month, day } = parts(now);
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Soma dias no calendário de operação, sem aplicar 24h de milissegundos. */
export function shiftOperationalDate(value: string | Date, days: number): string {
  if (typeof value === "string") {
    const [year, month, day] = value.slice(0, 10).split("-").map(Number);
    if (![year, month, day].every(Number.isFinite)) throw new Error("Data operacional inválida");
    const moved = new Date(Date.UTC(year!, month! - 1, day! + days, 12, 0, 0));
    return operationalDate(new Date(moved.getTime() + 12 * 60 * 60 * 1000));
  }
  const { year, month, day } = parts(value);
  const moved = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0));
  return `${String(moved.getUTCFullYear()).padStart(4, "0")}-${String(moved.getUTCMonth() + 1).padStart(2, "0")}-${String(moved.getUTCDate()).padStart(2, "0")}`;
}
