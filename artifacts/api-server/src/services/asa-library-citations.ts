import { normalizeAsaText } from "./asa-command-engine.js";

export type AsaLibraryCitation = {
  pageNumber: number;
  excerpt: string;
};

export function selectAsaLibraryCitation(query: string, citations: AsaLibraryCitation[]): AsaLibraryCitation | null {
  const ignoredTerms = new Set(["com", "das", "dos", "que", "para", "por", "uma", "uns", "nas", "nos", "sobre", "qual", "quais", "onde", "meu", "minha", "tem", "ter", "como", "mais", "menos"]);
  const terms = [...new Set(normalizeAsaText(query).split(" ").filter((term) => term.length > 2 && !ignoredTerms.has(term)))];
  if (!terms.length) return null;
  const minimumMatches = Math.ceil(terms.length * 0.6);
  const ranked = citations
    .filter((citation) => Number.isInteger(citation.pageNumber) && citation.pageNumber > 0
      && typeof citation.excerpt === "string" && citation.excerpt.trim().length >= 8)
    .map((citation) => {
      const text = normalizeAsaText(citation.excerpt);
      const matches = terms.reduce((count, term) => count + Number(text.includes(term)), 0);
      return { citation, matches };
    })
    .filter((item) => item.matches >= minimumMatches)
    .sort((a, b) => b.matches - a.matches
      || a.citation.pageNumber - b.citation.pageNumber
      || a.citation.excerpt.length - b.citation.excerpt.length);
  return ranked[0]?.citation ?? null;
}
