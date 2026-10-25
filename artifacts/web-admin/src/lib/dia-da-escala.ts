/**
 * Qual dia a Escala mostra ao abrir. A escala de um dia costuma ser feita na noite anterior: a partir de `abreAmanhaAPartirDe` ela abre no
 * dia seguinte, e a partir de `voltaAHojeAPartirDe` (da manhã) volta a abrir em hoje. Cada local escolhe as duas horas (HH:MM).
 */
export type ViradaDoDia = { abreAmanhaAPartirDe: string; voltaAHojeAPartirDe: string };

export const VIRADA_PADRAO: ViradaDoDia = { abreAmanhaAPartirDe: "18:00", voltaAHojeAPartirDe: "05:00" };

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const emMinutos = (hora: string) => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5));
const deMinutos = (minutos: number) => `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/** Soma dias a uma data ISO (AAAA-MM-DD) sem depender do fuso do aparelho. */
export function somaDias(iso: string, dias: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + dias)).toISOString().slice(0, 10);
}

/** A frase do que vale, em português, ou null se as duas horas estão certas. Mesma regra do servidor. */
export function fraseDaViradaInvalida(abre: string, volta: string): string | null {
  if (!HORA.test(abre) || !HORA.test(volta)) return "Escreva as duas horas no formato HH:MM, entre 00:00 e 23:59 (por exemplo 18:00 e 05:00).";
  if (abre === volta) return "As duas horas precisam ser diferentes: uma é a hora em que a Escala passa a abrir no dia seguinte, a outra é a hora em que volta a abrir em hoje.";
  if (volta > abre) return `A hora de voltar a abrir em hoje (${volta}) precisa vir antes da hora de abrir no dia seguinte (${abre}). Exemplo: abre no dia seguinte às 18:00 e volta a hoje às 05:00.`;
  return null;
}

/**
 * O dia (data ISO) que a Escala abre para quem prepara o dia. `hoje` é o dia de hoje no local (AAAA-MM-DD); `agora` dá a hora do relógio.
 * - da hora de abrir no dia seguinte até a meia-noite: abre no dia seguinte;
 * - da meia-noite até a hora de voltar a hoje: a janela começou ontem à noite, então o "dia seguinte" dela é hoje;
 * - no resto do dia: abre hoje;
 * - sem configuração (ou com horas inválidas): abre amanhã, como era antes.
 */
export function diaQueAEscalaAbre(agora: Date, virada: ViradaDoDia | null | undefined, hoje: string): string {
  if (!virada || fraseDaViradaInvalida(virada.abreAmanhaAPartirDe, virada.voltaAHojeAPartirDe)) return somaDias(hoje, 1);
  const t = agora.getHours() * 60 + agora.getMinutes();
  return t >= emMinutos(virada.abreAmanhaAPartirDe) ? somaDias(hoje, 1) : hoje;
}

/** Exemplo vivo para a tela de Locais: o que cada hora faz, com o dia da semana de verdade. */
export function exemploDaVirada(virada: ViradaDoDia, hoje: string): string {
  const dia = (iso: string) => DIAS[new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)))).getUTCDay()]!;
  const noite = deMinutos(Math.min(emMinutos(virada.abreAmanhaAPartirDe) + 90, 23 * 60 + 59));
  const manha = deMinutos(Math.min(emMinutos(virada.voltaAHojeAPartirDe) + 60, 23 * 60 + 59));
  const amanha = somaDias(hoje, 1);
  return `Com estas horas, às ${noite} de ${dia(hoje)} a Escala abre em ${dia(amanha)}. Às ${manha} de ${dia(amanha)}, ela abre em ${dia(amanha)} (hoje).`;
}

export const frasePadrao = (v: ViradaDoDia) => `abre no dia seguinte a partir das ${v.abreAmanhaAPartirDe} e volta a hoje às ${v.voltaAHojeAPartirDe}`;
