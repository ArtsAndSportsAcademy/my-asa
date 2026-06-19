import { useQuery } from "@tanstack/react-query";
import type { UseQueryOptions, QueryKey } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CheckInInsights {
  period: string;
  total: number;
  checkedIn: number;
  late: number;
  absent: number;
  excused: number;
  expected: number;
  rates: { presence: number; late: number; absence: number; excused: number };
  byOperation: { operationId: string; operationName: string; total: number; checkedIn: number; late: number; absent: number; presenceRate: number }[];
}

export interface RequestInsights {
  total: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  avgResponseHours: number | null;
}

export interface TaskInsights {
  total: number;
  byStatus: Record<string, number>;
  overdue: number;
  avgCompletionHours: number | null;
  approvalRate: number | null;
  reworkRate: number | null;
}

export interface WorkloadEntry {
  assigneeId: string;
  assigneeName: string;
  openTasks: number;
  overdueTasks: number;
  pendingRequests: number;
}

export interface WorkloadInsights {
  byAssignee: WorkloadEntry[];
}

export interface NoticeInsights {
  total: number;
  requiresConfirmation: number;
  confirmationRate: number;
  viewed: number;
  ignored: number;
  escalated: number;
  avgConfirmationHours: number | null;
}

export interface LibraryInsights {
  totalDocs: number;
  byStatus: Record<string, number>;
  byCategory: { categoryId: string; categoryName: string; docCount: number }[];
}

export interface TrendsWeek {
  week: string;
  label: string;
  checkInsPresent: number;
  checkInsTotal: number;
  tasksCreated: number;
  tasksCompleted: number;
  requestsTotal: number;
  requestsApproved: number;
  presenceRate: number;
}

export interface TrendsInsights {
  weekly: TrendsWeek[];
}

// ─── Query Key Factories ──────────────────────────────────────────────────────

export const getCheckInInsightsQueryKey = (params: { period?: string; operationId?: string }): QueryKey =>
  ["/api/insights/check-ins", params];
export const getRequestInsightsQueryKey = (params: { period?: string; operationId?: string }): QueryKey =>
  ["/api/insights/requests", params];
export const getTaskInsightsQueryKey = (params: { period?: string; operationId?: string }): QueryKey =>
  ["/api/insights/tasks", params];
export const getWorkloadInsightsQueryKey = (params: { operationId?: string }): QueryKey =>
  ["/api/insights/workload", params];
export const getNoticeInsightsQueryKey = (params: { period?: string; operationId?: string }): QueryKey =>
  ["/api/insights/notices", params];
export const getLibraryInsightsQueryKey = (params: { operationId?: string }): QueryKey =>
  ["/api/insights/library", params];
export const getTrendsInsightsQueryKey = (params: { operationId?: string }): QueryKey =>
  ["/api/insights/trends", params];

// ─── Fetch Functions ──────────────────────────────────────────────────────────

function buildQs(params: Record<string, string | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : "";
}

const fetchCheckInInsights = (params: { period?: string; operationId?: string }) =>
  customFetch<CheckInInsights>(`/api/insights/check-ins${buildQs(params)}`, { method: "GET" });

const fetchRequestInsights = (params: { period?: string; operationId?: string }) =>
  customFetch<RequestInsights>(`/api/insights/requests${buildQs(params)}`, { method: "GET" });

const fetchTaskInsights = (params: { period?: string; operationId?: string }) =>
  customFetch<TaskInsights>(`/api/insights/tasks${buildQs(params)}`, { method: "GET" });

const fetchWorkloadInsights = (params: { operationId?: string }) =>
  customFetch<WorkloadInsights>(`/api/insights/workload${buildQs(params)}`, { method: "GET" });

const fetchNoticeInsights = (params: { period?: string; operationId?: string }) =>
  customFetch<NoticeInsights>(`/api/insights/notices${buildQs(params)}`, { method: "GET" });

const fetchLibraryInsights = (params: { operationId?: string }) =>
  customFetch<LibraryInsights>(`/api/insights/library${buildQs(params)}`, { method: "GET" });

const fetchTrendsInsights = (params: { operationId?: string }) =>
  customFetch<TrendsInsights>(`/api/insights/trends${buildQs(params)}`, { method: "GET" });

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useGetCheckInInsights(
  params: { period?: string; operationId?: string },
  options?: { query?: UseQueryOptions<CheckInInsights, Error> }
) {
  return useQuery<CheckInInsights, Error>({ queryKey: getCheckInInsightsQueryKey(params), queryFn: () => fetchCheckInInsights(params), ...options?.query });
}

export function useGetRequestInsights(
  params: { period?: string; operationId?: string },
  options?: { query?: UseQueryOptions<RequestInsights, Error> }
) {
  return useQuery<RequestInsights, Error>({ queryKey: getRequestInsightsQueryKey(params), queryFn: () => fetchRequestInsights(params), ...options?.query });
}

export function useGetTaskInsights(
  params: { period?: string; operationId?: string },
  options?: { query?: UseQueryOptions<TaskInsights, Error> }
) {
  return useQuery<TaskInsights, Error>({ queryKey: getTaskInsightsQueryKey(params), queryFn: () => fetchTaskInsights(params), ...options?.query });
}

export function useGetWorkloadInsights(
  params: { operationId?: string },
  options?: { query?: UseQueryOptions<WorkloadInsights, Error> }
) {
  return useQuery<WorkloadInsights, Error>({ queryKey: getWorkloadInsightsQueryKey(params), queryFn: () => fetchWorkloadInsights(params), ...options?.query });
}

export function useGetNoticeInsights(
  params: { period?: string; operationId?: string },
  options?: { query?: UseQueryOptions<NoticeInsights, Error> }
) {
  return useQuery<NoticeInsights, Error>({ queryKey: getNoticeInsightsQueryKey(params), queryFn: () => fetchNoticeInsights(params), ...options?.query });
}

export function useGetLibraryInsights(
  params: { operationId?: string },
  options?: { query?: UseQueryOptions<LibraryInsights, Error> }
) {
  return useQuery<LibraryInsights, Error>({ queryKey: getLibraryInsightsQueryKey(params), queryFn: () => fetchLibraryInsights(params), ...options?.query });
}

export function useGetTrendsInsights(
  params: { operationId?: string },
  options?: { query?: UseQueryOptions<TrendsInsights, Error> }
) {
  return useQuery<TrendsInsights, Error>({ queryKey: getTrendsInsightsQueryKey(params), queryFn: () => fetchTrendsInsights(params), ...options?.query });
}
