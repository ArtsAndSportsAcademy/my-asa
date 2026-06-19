import { useQuery, useMutation } from "@tanstack/react-query";
import type { UseQueryOptions, UseMutationOptions, QueryKey } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";

// ─── Types ────────────────────────────────────────────────────────────────────

export type RequestDecisionType =
  | "APPROVED"
  | "DENIED"
  | "ALTERNATIVE"
  | "ALTERNATIVE_PROPOSED";

export interface RequestItem {
  id: string;
  type: string;
  status: string;
  targetDates: string[];
  reason?: string | null;
  requesterId: string;
  requesterName?: string | null;
  operationId: string;
  operationName?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListRequestsParams {
  operationId?: string;
  status?: string;
  page?: number;
}

export interface DecideRequestInput {
  id: string;
  data: {
    decision: RequestDecisionType;
    reason?: string;
    alternativeDetails?: string;
    alternativeDates?: string[];
    comment?: string;
  };
}

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const getListRequestsQueryKey = (params?: ListRequestsParams): QueryKey =>
  ["/api/requests", ...(params ? [params] : [])];

export const getListPendingRequestsQueryKey = (params?: { operationId?: string }): QueryKey =>
  ["/api/requests/pending", ...(params ? [params] : [])];

// ─── Fetch functions ──────────────────────────────────────────────────────────

const listRequests = async (params: ListRequestsParams): Promise<{ requests: RequestItem[] }> => {
  const p = new URLSearchParams();
  if (params.operationId) p.set("operationId", params.operationId);
  if (params.status) p.set("status", params.status);
  const qs = p.toString();
  return customFetch<{ requests: RequestItem[] }>(`/api/requests${qs ? `?${qs}` : ""}`, { method: "GET" });
};

const listPendingRequests = async (params?: { operationId?: string }): Promise<{ requests: RequestItem[] }> => {
  const p = new URLSearchParams();
  if (params?.operationId) p.set("operationId", params.operationId);
  const qs = p.toString();
  return customFetch<{ requests: RequestItem[] }>(`/api/requests/pending${qs ? `?${qs}` : ""}`, { method: "GET" });
};

const decideRequest = async (input: DecideRequestInput): Promise<unknown> => {
  const { id, data } = input;
  return customFetch<unknown>(`/api/requests/${id}/decide`, {
    method: "POST",
    body: JSON.stringify(data),
  });
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useListRequests(
  params: ListRequestsParams,
  options?: { query?: UseQueryOptions<{ requests: RequestItem[] }, Error> }
) {
  return useQuery<{ requests: RequestItem[] }, Error>({
    queryKey: getListRequestsQueryKey(params),
    queryFn: () => listRequests(params),
    ...options?.query,
  });
}

export function useListPendingRequests(
  params?: { operationId?: string },
  options?: { query?: UseQueryOptions<{ requests: RequestItem[] }, Error> }
) {
  return useQuery<{ requests: RequestItem[] }, Error>({
    queryKey: getListPendingRequestsQueryKey(params),
    queryFn: () => listPendingRequests(params),
    ...options?.query,
  });
}

export function useDecideRequest(
  options?: { mutation?: UseMutationOptions<unknown, Error, DecideRequestInput> }
) {
  return useMutation<unknown, Error, DecideRequestInput>({
    mutationFn: decideRequest,
    ...options?.mutation,
  });
}
