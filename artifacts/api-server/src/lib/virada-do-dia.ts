/**
 * Qual dia a Escala mostra ao abrir: cada local escolhe a hora em que a Escala passa a abrir no dia seguinte
 * (a escala de um dia costuma ser feita na noite anterior) e a hora em que volta a abrir em hoje.
 */
export const VIRADA_PADRAO = { abreAmanhaAPartirDe: "18:00", voltaAHojeAPartirDe: "05:00" } as const;
export const HORA_HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export type ViradaDoDia = { abreAmanhaAPartirDe: string; voltaAHojeAPartirDe: string };

export function viradaDoLocal(local: { escalaAbreAmanhaAPartir: string; escalaVoltaAHojeAPartir: string }): ViradaDoDia {
  return { abreAmanhaAPartirDe: local.escalaAbreAmanhaAPartir, voltaAHojeAPartirDe: local.escalaVoltaAHojeAPartir };
}

/** Confere as duas horas; devolve a frase do que vale, em português, ou null se estão certas. */
export function fraseDaViradaInvalida(abre: unknown, volta: unknown): { error: string; message: string } | null {
  if (typeof abre !== "string" || typeof volta !== "string" || !HORA_HHMM.test(abre) || !HORA_HHMM.test(volta)) {
    return { error: "CAMPOS_INVALIDOS", message: "Escreva as duas horas no formato HH:MM, entre 00:00 e 23:59 (por exemplo 18:00 e 05:00)." };
  }
  if (abre === volta) return { error: "HORAS_IGUAIS", message: "As duas horas precisam ser diferentes: uma é a hora em que a Escala passa a abrir no dia seguinte, a outra é a hora em que volta a abrir em hoje." };
  if (volta > abre) return { error: "HORAS_TROCADAS", message: `A hora de voltar a abrir em hoje (${volta}) precisa vir antes da hora de abrir no dia seguinte (${abre}). Exemplo: abre no dia seguinte às 18:00 e volta a hoje às 05:00.` };
  return null;
}
