import { useQuery, type QueryKey } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ResolvedStatus = "COVERED" | "UNCOVERED" | "INACTIVE";

export interface ResolvedPerson {
  userId: string;
  name: string;
}

export interface ResolvedLine {
  lineId: string;
  type: string;
  status: ResolvedStatus;
  people: ResolvedPerson[];
  note?: string;
  rotationAdvanceUserId?: string;
  fixedForDay?: boolean;
}

export interface ResolvedPosition {
  positionId: string;
  name: string;
  minimumCoverage: number;
  lines: ResolvedLine[];
}

export interface ResolvedBlock {
  blockId: string;
  name: string;
  positions: ResolvedPosition[];
}

export interface ResolvedScene {
  sceneId: string;
  name: string;
  blocks: ResolvedBlock[];
}

export interface ResolveResult {
  date: string;
  weekday: number;
  scenes: ResolvedScene[];
  uncoveredCount: number;
}

// ─── useResolveShowBook ───────────────────────────────────────────────────────
// Resolve o elenco concreto de cada linha do Livro do Show numa data específica.

export const getResolveShowBookQueryKey = (showBookId: string, date: string): QueryKey => [
  "/api/show-books",
  showBookId,
  "resolve",
  { date },
];

export function useResolveShowBook(
  showBookId: string,
  date: string,
  options?: { query?: { enabled?: boolean } }
) {
  return useQuery({
    queryKey: getResolveShowBookQueryKey(showBookId, date),
    queryFn: async () => {
      const res = await customFetch<{ resolution: ResolveResult }>(
        `/api/show-books/${showBookId}/resolve?date=${encodeURIComponent(date)}`
      );
      return res.resolution;
    },
    enabled: (options?.query?.enabled ?? true) && !!showBookId && !!date,
  });
}
