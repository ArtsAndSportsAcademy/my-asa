import type { Bloco } from "@/pages/escalas";

/** Os sete tipos da planilha de papel. O Tipo gravado na Programação (Etapa 6) vai passar na frente; até lá, o nome decide. */
export type TipoKey = "gelo" | "ensaio" | "show" | "inter" | "prod" | "pausa" | "outra";

export const TIPOS: { key: TipoKey; label: string }[] = [
  { key: "gelo", label: "Treinos no gelo" },
  { key: "ensaio", label: "Ensaios e preparação" },
  { key: "show", label: "Shows e teatro" },
  { key: "inter", label: "Interações e personagens" },
  { key: "prod", label: "Produção e apoio" },
  { key: "pausa", label: "Pausas e almoço" },
  { key: "outra", label: "Outras atividades" },
];

export const nomeDoTipo = (tipo: TipoKey) => TIPOS.find((t) => t.key === tipo)?.label ?? "Outras atividades";

/** Cores de cada tipo: fundo, texto e borda saem do CSS (escala-tokens.css), com contraste de leitura. */
export const toneDoTipo = (tipo: TipoKey) => ({ bg: `var(--esc-t-${tipo}-bg)`, fg: `var(--esc-t-${tipo}-fg)`, bd: `var(--esc-t-${tipo}-bd)` });

export function tipoDoBloco(b: Pick<Bloco, "rotulo" | "regra">): TipoKey {
  if (b.regra === "livro") return "show";
  const r = b.rotulo.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleUpperCase("pt-BR");
  if (/^(ALMOCO|RECESSO|PAUSA|INTERVALO|LANCHE|JANTAR)/.test(r)) return "pausa";
  if (/^(SHOW|TEATRO|MUSICAL|MONTANHA|BOAS)/.test(r)) return "show";
  if (/^(TREINO|AULA|ACROBACIA|FISIO)/.test(r)) return "gelo";
  if (/^(YETI|INTERA|GUARDI|ACOMPANH|PERSONAGEM)/.test(r)) return "inter";
  if (/^(PRODUC|HOTEL|PASSAGEM|AQUECIMENTO|APOIO|DISTANCIAMENTO)/.test(r)) return "prod";
  if (/^(ENSAIO|PREP|REVISAR|ASSISTIR)/.test(r)) return "ensaio";
  return "outra";
}

/** Atividade que foge do padrão do dia: entrada manual, horário só de uma pessoa, pedido aprovado ou bloco de poucas pessoas escolhidas à mão. */
export const ehExcecao = (b: Bloco) => b.origem === "manual" || b.origem === "solicitacao" || Boolean(b.horarioDela) || (b.regra === "pessoas" && b.pessoaIds.length <= 3);

/**
 * Só o primeiro nome cabe em coluna e em resumo; quando duas pessoas da lista começam igual, entra a inicial
 * (ou o número) do resto do nome: "Ana P.", "Pessoa 8".
 */
export const nomesCurtos = (lista: { name: string }[]) => {
  const primeiros = new Map<string, number>();
  for (const p of lista) { const f = p.name.split(" ")[0]; primeiros.set(f, (primeiros.get(f) ?? 0) + 1); }
  return (p: { name: string }) => {
    const [f, ...resto] = p.name.split(" ");
    if ((primeiros.get(f) ?? 0) < 2 || !resto.length) return f;
    return /^\d+$/.test(resto[0]) ? `${f} ${resto[0]}` : `${f} ${resto[0][0]}.`;
  };
};

/** Como a frase chama o dia que a tela mostra: "hoje", "amanhã" ou, em qualquer outro, "neste dia". */
export const quandoDoDia = (iso: string) => {
  const dia = (d: Date) => Math.round(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 86_400_000);
  const [y, m, d] = iso.split("-").map(Number);
  const diff = dia(new Date(y, m - 1, d)) - dia(new Date());
  return diff === 0 ? "hoje" : diff === 1 ? "amanhã" : "neste dia";
};
export const minutosDe =(hora: string) => { const [h, m] = hora.split(":").map(Number); return h * 60 + (m || 0); };
export const horaDe = (minutos: number) => `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
/** Show sem hora de fim cadastrada vale 30 minutos na grade, como em toda a Escala. */
export const fimEmMinutos = (b: Pick<Bloco, "inicio" | "fim">) => (b.fim ? minutosDe(b.fim) : minutosDe(b.inicio) + 30);

/** Texto do bloco na célula: show leva a hora ("MUSICAL 12:30"), a menos que o nome já traga uma. */
export const textoDoBloco = (b: Pick<Bloco, "rotulo" | "inicio" | "regra">) => (b.regra === "livro" && !/\d{1,2}(:|h)\d{0,2}/i.test(b.rotulo) ? `${b.rotulo} ${b.inicio}` : b.rotulo);
export const faixa = (b: Pick<Bloco, "inicio" | "fim">) => (b.fim ? `${b.inicio}–${b.fim}` : b.inicio);
