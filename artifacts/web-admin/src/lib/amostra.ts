/**
 * Nomes da revisão local (`?amostra=1`). D1 do plano de lançamento: nome de pessoa real não vai para
 * o build de produção. `import.meta.env.DEV` vira `false` no build, e o minificador descarta o ramo
 * com os nomes — em produção estas constantes ficam vazias (e a amostra nem liga).
 */
type Role = "adm" | "dir" | "sup" | "mem";

export const REVIEW_PERSON: Record<Role, string> = import.meta.env.DEV
  ? { adm: "Barbara", dir: "Cris", sup: "Deborah", mem: "Julia" }
  : { adm: "", dir: "", sup: "", mem: "" };

/** A folga visível da amostra de Snowland (Patinadores, para aparecer na revisão da Supervisão). */
export const FOLGA_DA_AMOSTRA: string | null = import.meta.env.DEV ? "Sofia" : null;

/** Quem marca área pronta na amostra quando a área não tem supervisão cadastrada. */
export const ADMINISTRACAO_DA_AMOSTRA: string = import.meta.env.DEV ? "Barbara" : "";
