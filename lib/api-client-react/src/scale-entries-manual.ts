import { useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";
import { getListScaleAllocationsQueryKey } from "./generated/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ManualEntry {
  id: string;
  scaleId: string;
  userId: string | null;
  status: string;
  manualDate: string | null;
  manualLabel: string | null;
  startTime: string | null;
  endTime: string | null;
  notes: string | null;
  userName: string | null;
  agendaEventId: null;
  positionId: null;
  positionName: null;
  overrideReason: string | null;
  candidates: [];
}

export interface CreateScaleEntryBody {
  scaleId: string;
  memberId: string;
  date: string;
  label: string;
  startTime?: string;
  endTime?: string;
  notes?: string;
}

// ─── useCreateScaleEntry ──────────────────────────────────────────────────────

export function useCreateScaleEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ scaleId, ...body }: CreateScaleEntryBody) => {
      return customFetch<{ entry: ManualEntry }>(`/api/scales/${scaleId}/entries`, {
        method: "POST",
        body: JSON.stringify(body),
      });
    },
    onSuccess: (_, { scaleId }) => {
      queryClient.invalidateQueries({ queryKey: getListScaleAllocationsQueryKey(scaleId) });
    },
  });
}

// ─── useDeleteScaleEntry ──────────────────────────────────────────────────────

export function useDeleteScaleEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ scaleId, entryId }: { scaleId: string; entryId: string }) => {
      return customFetch<unknown>(`/api/scales/${scaleId}/entries/${entryId}`, {
        method: "DELETE",
      });
    },
    onSuccess: (_, { scaleId }) => {
      queryClient.invalidateQueries({ queryKey: getListScaleAllocationsQueryKey(scaleId) });
    },
  });
}
