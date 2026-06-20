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
      const res = await customFetch(`/api/scales/${scaleId}/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error ?? "Erro ao criar entrada");
      }
      return res.json() as Promise<{ entry: ManualEntry }>;
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
      const res = await customFetch(`/api/scales/${scaleId}/entries/${entryId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error ?? "Erro ao remover entrada");
      }
      return res.json();
    },
    onSuccess: (_, { scaleId }) => {
      queryClient.invalidateQueries({ queryKey: getListScaleAllocationsQueryKey(scaleId) });
    },
  });
}
