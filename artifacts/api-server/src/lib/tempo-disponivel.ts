/**
 * Tempo disponível (pacote G): cada local liga ou desliga o aviso "fulano fica livre" da Atenção do dia e escolhe a partir de quantos minutos
 * ele vale. Padrão: ligado, 30 minutos. O "dia dividido" (buraco de 3 horas ou mais) é fixo, não se configura.
 */
export const TEMPO_DISPONIVEL_PADRAO = { ligado: true, minutos: 30 } as const;
export const TEMPO_DISPONIVEL_MINIMO = 5;
export const TEMPO_DISPONIVEL_MAXIMO = 240;
/** A partir daqui o buraco não é "tempo para aproveitar", é um dia dividido (manhã e noite, por exemplo): sai da lista principal. */
export const DIA_DIVIDIDO_MINUTOS = 180;

export type TempoDisponivelDoLocal = { ligado: boolean; minutos: number };

export function tempoDisponivelDoLocal(local: { tempoDisponivelLigado: boolean; tempoDisponivelMinutos: number }): TempoDisponivelDoLocal {
  return { ligado: local.tempoDisponivelLigado, minutos: local.tempoDisponivelMinutos };
}

/** Confere o que a tela mandou; devolve a frase do que vale, em português, ou null se está certo. */
export function fraseDoTempoDisponivelInvalido(ligado: unknown, minutos: unknown): { error: string; message: string } | null {
  if (typeof ligado !== "boolean") return { error: "CAMPOS_INVALIDOS", message: "Diga se o aviso de tempo disponível fica ligado ou desligado." };
  if (typeof minutos !== "number" || !Number.isInteger(minutos) || minutos < TEMPO_DISPONIVEL_MINIMO || minutos > TEMPO_DISPONIVEL_MAXIMO) {
    return { error: "CAMPOS_INVALIDOS", message: `Escreva os minutos como um número inteiro, de ${TEMPO_DISPONIVEL_MINIMO} a ${TEMPO_DISPONIVEL_MAXIMO} (o padrão é ${TEMPO_DISPONIVEL_PADRAO.minutos}). O aviso vale a partir desse tempo livre entre duas atividades.` };
  }
  return null;
}
