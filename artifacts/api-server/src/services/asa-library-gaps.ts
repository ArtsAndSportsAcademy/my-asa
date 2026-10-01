import { normalizeAsaText } from "./asa-command-engine.js";

export const ASA_LIBRARY_NO_SOURCE_ACTION = "ASA_LIBRARY_NO_SOURCE_V1";

export type AsaLibraryGapAction = {
  action: typeof ASA_LIBRARY_NO_SOURCE_ACTION;
  topic: string;
};

export type AsaLibraryGapSignal = {
  topic: string;
  count: number;
  lastSeen: string;
};

export function createAsaLibraryGapAction(query: string, locationName?: string): AsaLibraryGapAction | null {
  const parts = [query, locationName ? `local ${locationName}` : ""]
    .map((part) => part.trim())
    .filter(Boolean);
  const topic = parts.join(" · ")
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[email]")
    .replace(/\b(?:\+?\d[\d\s().-]{7,}\d)\b/g, "[telefone]")
    .replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi, "[id]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
  if (normalizeAsaText(topic).length < 3) return null;
  return { action: ASA_LIBRARY_NO_SOURCE_ACTION, topic };
}

export function aggregateAsaLibraryGaps(
  rows: Array<{ actionsExecuted: unknown; createdAt: Date | string }>,
  limit = 50,
): AsaLibraryGapSignal[] {
  const grouped = new Map<string, AsaLibraryGapSignal>();
  for (const row of rows) {
    if (!Array.isArray(row.actionsExecuted)) continue;
    const date = row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt);
    if (!Number.isFinite(date.getTime())) continue;
    for (const action of row.actionsExecuted) {
      if (!action || typeof action !== "object") continue;
      const item = action as Record<string, unknown>;
      if (item.action !== ASA_LIBRARY_NO_SOURCE_ACTION || typeof item.topic !== "string") continue;
      const topic = item.topic.replace(/\s+/g, " ").trim().slice(0, 180);
      const key = normalizeAsaText(topic);
      if (!key) continue;
      const existing = grouped.get(key);
      if (existing) {
        existing.count += 1;
        if (date.getTime() > Date.parse(existing.lastSeen)) existing.lastSeen = date.toISOString();
      } else {
        grouped.set(key, { topic, count: 1, lastSeen: date.toISOString() });
      }
    }
  }
  return [...grouped.values()]
    .sort((a, b) => b.count - a.count || Date.parse(b.lastSeen) - Date.parse(a.lastSeen) || a.topic.localeCompare(b.topic, "pt-BR"))
    .slice(0, Math.max(0, Math.min(100, Math.floor(limit))));
}
