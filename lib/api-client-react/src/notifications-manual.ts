import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { UseQueryOptions, UseMutationOptions, QueryKey } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";

// ─── Types ────────────────────────────────────────────────────────────────────

export type UserNotificationPriority = "LOW" | "NORMAL" | "IMPORTANT" | "CRITICAL";
export type UserNotificationCategory =
  | "schedule"
  | "book"
  | "notice"
  | "approval"
  | "absence"
  | "rehearsal"
  | "responsibility"
  | "message"
  | "system";

export interface UserNotificationItem {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  priority: UserNotificationPriority;
  category: UserNotificationCategory;
  entityType: string | null;
  entityId: string | null;
  actionUrl: string | null;
  readAt: string | null;
  createdAt: string;
  expiresAt: string | null;
}

export interface GetNotificationsParams {
  category?: UserNotificationCategory;
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
}

export interface GetNotificationsResponse {
  notifications: UserNotificationItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface UnreadCountResponse {
  count: number;
}

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const getNotificationsQueryKey = (params?: GetNotificationsParams): QueryKey =>
  ["/api/notifications", ...(params ? [params] : [])];

export const getUnreadCountQueryKey = (): QueryKey => ["/api/notifications/unread-count"];

// ─── Fetch functions ──────────────────────────────────────────────────────────

async function fetchNotifications(
  params?: GetNotificationsParams,
): Promise<GetNotificationsResponse> {
  const p = new URLSearchParams();
  if (params?.category) p.set("category", params.category);
  if (params?.unreadOnly) p.set("unreadOnly", "true");
  if (params?.limit != null) p.set("limit", String(params.limit));
  if (params?.offset != null) p.set("offset", String(params.offset));
  const qs = p.toString();
  return customFetch<GetNotificationsResponse>(`/api/notifications${qs ? `?${qs}` : ""}`, {
    method: "GET",
  });
}

async function fetchUnreadCount(): Promise<UnreadCountResponse> {
  return customFetch<UnreadCountResponse>("/api/notifications/unread-count", { method: "GET" });
}

async function markNotificationRead(id: string): Promise<{ notification: UserNotificationItem }> {
  return customFetch<{ notification: UserNotificationItem }>(
    `/api/notifications/${id}/read`,
    { method: "PATCH" },
  );
}

async function markAllNotificationsRead(): Promise<{ marked: number }> {
  return customFetch<{ marked: number }>("/api/notifications/read-all", { method: "PATCH" });
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useGetNotifications(
  params?: GetNotificationsParams,
  options?: { query?: UseQueryOptions<GetNotificationsResponse, Error> },
) {
  return useQuery<GetNotificationsResponse, Error>({
    queryKey: getNotificationsQueryKey(params),
    queryFn: () => fetchNotifications(params),
    ...options?.query,
  });
}

export function useGetUnreadCount(
  options?: {
    query?: UseQueryOptions<UnreadCountResponse, Error>;
    refetchInterval?: number;
  },
) {
  return useQuery<UnreadCountResponse, Error>({
    queryKey: getUnreadCountQueryKey(),
    queryFn: fetchUnreadCount,
    refetchInterval: options?.refetchInterval ?? 30_000,
    ...options?.query,
  });
}

export function useMarkNotificationRead(
  options?: UseMutationOptions<{ notification: UserNotificationItem }, Error, string>,
) {
  const qc = useQueryClient();
  return useMutation<{ notification: UserNotificationItem }, Error, string>({
    mutationFn: markNotificationRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: getUnreadCountQueryKey() });
      qc.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
    ...options,
  });
}

export function useMarkAllNotificationsRead(
  options?: UseMutationOptions<{ marked: number }, Error, void>,
) {
  const qc = useQueryClient();
  return useMutation<{ marked: number }, Error, void>({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: getUnreadCountQueryKey() });
      qc.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
    ...options,
  });
}
