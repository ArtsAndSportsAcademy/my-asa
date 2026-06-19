import { useQuery, useMutation } from "@tanstack/react-query";
import type { UseQueryOptions, UseMutationOptions, QueryKey } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CheckInItem {
  userId: string | null;
  userName: string | null;
  userPhotoUrl?: string | null;
  earliestStart: string | null;
  checkInId: string | null;
  status: "EXPECTED" | "CHECKED_IN" | "LATE" | "ABSENT" | "EXCUSED";
  checkedInAt: string | null;
  excuseReason?: string | null;
  registeredBy?: string | null;
}

export interface CheckInSummary {
  total: number;
  checkedIn: number;
  late: number;
  absent: number;
  excused: number;
  expected: number;
}

export interface ListCheckInsParams {
  date: string;
  operationId: string;
}

export interface UpdateCheckInData {
  status: string;
  userId: string;
  operationId: string;
  date: string;
  excuseReason?: string;
}

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const getListCheckInsQueryKey = (params?: ListCheckInsParams): QueryKey =>
  ["/api/check-ins", ...(params ? [params] : [])];

export const getGetCheckInSummaryQueryKey = (params?: ListCheckInsParams): QueryKey =>
  ["/api/check-ins/summary", ...(params ? [params] : [])];

// ─── Fetch functions ──────────────────────────────────────────────────────────

const listCheckIns = async (params: ListCheckInsParams): Promise<{ checkIns: CheckInItem[] }> => {
  const p = new URLSearchParams({ date: params.date, operationId: params.operationId });
  return customFetch<{ checkIns: CheckInItem[] }>(`/api/check-ins?${p}`, { method: "GET" });
};

const getCheckInSummary = async (params: ListCheckInsParams): Promise<{ summary: CheckInSummary }> => {
  const p = new URLSearchParams({ date: params.date, operationId: params.operationId });
  return customFetch<{ summary: CheckInSummary }>(`/api/check-ins/summary?${p}`, { method: "GET" });
};

const updateCheckIn = async ({ id, data }: { id: string; data: UpdateCheckInData }): Promise<unknown> => {
  if (id === "new") {
    return customFetch<unknown>(`/api/check-ins`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }
  return customFetch<unknown>(`/api/check-ins/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useListCheckIns(
  params: ListCheckInsParams,
  options?: {
    query?: UseQueryOptions<{ checkIns: CheckInItem[] }, Error>;
  }
) {
  return useQuery<{ checkIns: CheckInItem[] }, Error>({
    queryKey: getListCheckInsQueryKey(params),
    queryFn: () => listCheckIns(params),
    enabled: !!params.operationId,
    ...options?.query,
  });
}

export function useGetCheckInSummary(
  params: ListCheckInsParams,
  options?: {
    query?: UseQueryOptions<{ summary: CheckInSummary }, Error>;
  }
) {
  return useQuery<{ summary: CheckInSummary }, Error>({
    queryKey: getGetCheckInSummaryQueryKey(params),
    queryFn: () => getCheckInSummary(params),
    enabled: !!params.operationId,
    ...options?.query,
  });
}

export function useUpdateCheckIn(
  options?: UseMutationOptions<unknown, Error, { id: string; data: UpdateCheckInData }>
) {
  return useMutation<unknown, Error, { id: string; data: UpdateCheckInData }>({
    mutationFn: updateCheckIn,
    ...options,
  });
}
