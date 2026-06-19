import { useQuery, useMutation } from "@tanstack/react-query";
import type { UseQueryOptions, UseMutationOptions, QueryKey } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DelegationItem {
  id: string;
  delegatorId: string;
  delegatorName?: string | null;
  delegateeId: string;
  delegateeName?: string | null;
  operationId: string;
  operationName?: string | null;
  startDate: string;
  endDate: string;
  reason?: string | null;
  status: "PENDING" | "ACTIVE" | "EXPIRED" | "CANCELLED";
  createdAt: string;
  updatedAt: string;
}

export interface CreateDelegationInput {
  delegateId: string;
  operationId: string;
  startDate: string;
  endDate: string;
  reason?: string;
}

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const getListDelegationsQueryKey = (): QueryKey => ["/api/delegations"];

// ─── Fetch functions ──────────────────────────────────────────────────────────

const listDelegations = async (): Promise<{ delegations: DelegationItem[] }> =>
  customFetch<{ delegations: DelegationItem[] }>("/api/delegations", { method: "GET" });

const createDelegation = async (data: CreateDelegationInput): Promise<unknown> =>
  customFetch<unknown>("/api/delegations", {
    method: "POST",
    body: JSON.stringify(data),
  });

const cancelDelegation = async (id: string): Promise<unknown> =>
  customFetch<unknown>(`/api/delegations/${id}/cancel`, { method: "PATCH" });

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useListDelegations(
  options?: { query?: UseQueryOptions<{ delegations: DelegationItem[] }, Error> }
) {
  return useQuery<{ delegations: DelegationItem[] }, Error>({
    queryKey: getListDelegationsQueryKey(),
    queryFn: listDelegations,
    ...options?.query,
  });
}

export function useCreateDelegation(
  options?: UseMutationOptions<unknown, Error, CreateDelegationInput>
) {
  return useMutation<unknown, Error, CreateDelegationInput>({
    mutationFn: createDelegation,
    ...options,
  });
}

export function useCancelDelegation(
  options?: UseMutationOptions<unknown, Error, string>
) {
  return useMutation<unknown, Error, string>({
    mutationFn: cancelDelegation,
    ...options,
  });
}
