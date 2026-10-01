import type { CSSProperties } from "react";

/**
 * Estilo copiado literalmente de um `.dc.html` (design_handoff_my_asa/telas): recebe a string de
 * estilo do arquivo, na mesma ordem, e devolve o objeto React. Única mudança aplicada: o piso de
 * texto do doc 18 / 07 — 12px para texto que se lê, 11px para rótulo em caixa-alta.
 */
const styleCache = new Map<string, CSSProperties>();
export function css(source: string): CSSProperties {
  const cached = styleCache.get(source);
  if (cached) return cached;
  const out: Record<string, string> = {};
  for (const declaration of source.split(";")) {
    const colon = declaration.indexOf(":");
    if (colon < 0) continue;
    const prop = declaration.slice(0, colon).trim();
    if (!prop) continue;
    out[prop.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())] = declaration.slice(colon + 1).trim();
  }
  if (out.fontSize?.endsWith("px")) {
    const floor = out.textTransform === "uppercase" ? 11 : 12;
    if (parseFloat(out.fontSize) < floor) out.fontSize = `${floor}px`;
  }
  styleCache.set(source, out as CSSProperties);
  return out as CSSProperties;
}
