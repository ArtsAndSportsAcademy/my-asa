export type AsaSuggestionMode = "SILENT" | "BALANCED" | "PROACTIVE";
export type AsaSuggestionFrequency = "REALTIME" | "DAILY" | "WEEKLY";
export type AsaProactivityLevel = "LOW" | "MEDIUM" | "HIGH";

export function selectAsaSuggestions<T>(
  suggestions: T[],
  mode: AsaSuggestionMode,
  frequency: AsaSuggestionFrequency,
  level: AsaProactivityLevel,
  lastShownAt: number | null,
  now = Date.now(),
): T[] {
  if (mode === "SILENT" || suggestions.length === 0) return [];
  const interval = frequency === "WEEKLY" ? 7 * 24 * 60 * 60 * 1000
    : frequency === "DAILY" ? 24 * 60 * 60 * 1000 : 0;
  if (interval > 0 && lastShownAt !== null && Number.isFinite(lastShownAt)
    && lastShownAt <= now && now - lastShownAt < interval) return [];
  const limit = mode === "BALANCED" ? 1 : level === "LOW" ? 1 : level === "MEDIUM" ? 2 : 3;
  return suggestions.slice(0, limit);
}
