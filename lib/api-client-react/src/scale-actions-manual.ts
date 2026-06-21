import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";
import { getListScalesQueryKey, getListScaleAllocationsQueryKey } from "./generated/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ScaleHistoryEvent {
  id: string;
  category: string;
  action: string;
  title: string;
  narrative: string;
  entityType: string;
  entityId: string;
  actorId: string | null;
  actorName: string | null;
  actorType: string;
  operationId: string | null;
  occurredAt: string;
  createdAt: string;
}

// ─── useCreateWeekScale ───────────────────────────────────────────────────────
// Period-based scale creation (no agenda event / show book required).

export function useCreateWeekScale() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      operationId,
      periodStart,
      periodEnd,
      title,
    }: {
      operationId: string;
      periodStart: string;
      periodEnd: string;
      title?: string;
    }) => {
      return customFetch<{ scale: { id: string } }>(`/api/scales/generate`, {
        method: "POST",
        body: JSON.stringify({ operationId, periodStart, periodEnd, title }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getListScalesQueryKey() });
    },
  });
}

// ─── useDeleteScale ───────────────────────────────────────────────────────────

export function useDeleteScale() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ scaleId }: { scaleId: string }) => {
      return customFetch<{ ok: boolean }>(`/api/scales/${scaleId}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getListScalesQueryKey() });
    },
  });
}

// ─── useSetPublishDeadline ────────────────────────────────────────────────────

export function useSetPublishDeadline() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      scaleId,
      publishDeadline,
    }: {
      scaleId: string;
      publishDeadline: string | null;
    }) => {
      return customFetch<{ scale: unknown }>(`/api/scales/${scaleId}`, {
        method: "PATCH",
        body: JSON.stringify({ publishDeadline }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getListScalesQueryKey() });
    },
  });
}

// ─── useDuplicatePreviousWeek ─────────────────────────────────────────────────

export function useDuplicatePreviousWeek() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ scaleId }: { scaleId: string }) => {
      return customFetch<{ ok: boolean; copied: number }>(
        `/api/scales/${scaleId}/duplicate-previous`,
        { method: "POST", body: JSON.stringify({}) }
      );
    },
    onSuccess: (_, { scaleId }) => {
      queryClient.invalidateQueries({ queryKey: getListScaleAllocationsQueryKey(scaleId) });
    },
  });
}

// ─── useGetScaleHistory ───────────────────────────────────────────────────────

export const getScaleHistoryQueryKey = (scaleId: string): QueryKey => [
  "/api/history",
  { entityType: "scale", entityId: scaleId },
];

export function useGetScaleHistory(
  scaleId: string,
  options?: { query?: { enabled?: boolean } }
) {
  return useQuery({
    queryKey: getScaleHistoryQueryKey(scaleId),
    queryFn: async () => {
      const res = await customFetch<{ events: ScaleHistoryEvent[] }>(
        `/api/history?entityType=scale&limit=200`
      );
      return {
        events: (res.events ?? []).filter((e) => e.entityId === scaleId),
      };
    },
    enabled: options?.query?.enabled ?? !!scaleId,
  });
}
