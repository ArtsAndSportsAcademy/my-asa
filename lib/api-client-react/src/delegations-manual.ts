import { useQuery, useMutation } from "@tanstack/react-query";
import type { UseQueryOptions, UseMutationOptions, QueryKey } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DelegatedResponsibility =
  | "CHECK_INS"
  | "REQUESTS"
  | "TASK_APPROVALS"
  | "DAILY_BOOK"
  | "NOTICES"
  | "OPERATIONAL_MESSAGES"
  | "SCALES";

export const ALL_RESPONSIBILITIES: DelegatedResponsibility[] = [
  "CHECK_INS",
  "REQUESTS",
  "TASK_APPROVALS",
  "DAILY_BOOK",
  "NOTICES",
  "OPERATIONAL_MESSAGES",
  "SCALES",
];

export const RESPONSIBILITY_LABELS: Record<DelegatedResponsibility, string> = {
  CHECK_INS: "Check-ins",
  REQUESTS: "Solicitações",
  TASK_APPROVALS: "Aprovação de Tarefas",
  DAILY_BOOK: "Livro do Dia",
  NOTICES: "Avisos",
  OPERATIONAL_MESSAGES: "Mensagens Operacionais",
  SCALES: "Escalas",
};

export interface DelegationItem {
  id: string;
  supervisorId: string;
  supervisorName?: string | null;
  delegateId: string;
  delegateeName?: string | null;
  operationId: string;
  operationName?: string | null;
  startDate: string;
  endDate: string;
  reason?: string | null;
  responsibilities: DelegatedResponsibility[];
  status: "PENDING" | "ACTIVE" | "EXPIRED" | "CANCELLED";
  createdAt: string;
}

export interface ActiveDelegationItem {
  delegationId: string;
  supervisorId: string;
  supervisorName?: string | null;
  operationId: string;
  operationName?: string | null;
  startDate: string;
  endDate: string;
  responsibilities: DelegatedResponsibility[];
  reason?: string | null;
}

export interface CreateDelegationInput {
  delegateId: string;
  operationId: string;
  startDate: string;
  endDate: string;
  reason?: string;
  responsibilities: DelegatedResponsibility[];
}

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const getListDelegationsQueryKey = (): QueryKey => ["/api/delegations"];
export const getMyActiveDelegationsQueryKey = (): QueryKey => ["/api/delegations/my-active"];

// ─── Fetch functions ──────────────────────────────────────────────────────────

const listDelegations = async (): Promise<{ delegations: DelegationItem[] }> =>
  customFetch<{ delegations: DelegationItem[] }>("/api/delegations", { method: "GET" });

const getMyActiveDelegations = async (): Promise<{ delegations: ActiveDelegationItem[] }> =>
  customFetch<{ delegations: ActiveDelegationItem[] }>("/api/delegations/my-active", { method: "GET" });

const createDelegation = async (data: CreateDelegationInput): Promise<{ delegation: DelegationItem }> =>
  customFetch<{ delegation: DelegationItem }>("/api/delegations", {
    method: "POST",
    body: JSON.stringify(data),
  });

const cancelDelegation = async (id: string): Promise<{ delegation: DelegationItem }> =>
  customFetch<{ delegation: DelegationItem }>(`/api/delegations/${id}/cancel`, { method: "PATCH" });

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

export function useGetMyActiveDelegations(
  options?: { query?: UseQueryOptions<{ delegations: ActiveDelegationItem[] }, Error> }
) {
  return useQuery<{ delegations: ActiveDelegationItem[] }, Error>({
    queryKey: getMyActiveDelegationsQueryKey(),
    queryFn: getMyActiveDelegations,
    ...options?.query,
  });
}

export function useCreateDelegation(
  options?: UseMutationOptions<{ delegation: DelegationItem }, Error, CreateDelegationInput>
) {
  return useMutation<{ delegation: DelegationItem }, Error, CreateDelegationInput>({
    mutationFn: createDelegation,
    ...options,
  });
}

export function useCancelDelegation(
  options?: UseMutationOptions<{ delegation: DelegationItem }, Error, string>
) {
  return useMutation<{ delegation: DelegationItem }, Error, string>({
    mutationFn: cancelDelegation,
    ...options,
  });
}
