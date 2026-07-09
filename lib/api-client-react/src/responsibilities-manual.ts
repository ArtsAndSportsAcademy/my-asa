import { useQuery } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";

export interface ResponsibilityAssignmentItem {
  id: string;
  memberId: string;
  role: "PRIMARY" | "SECONDARY";
  memberName: string;
  active: boolean;
}

export interface ResponsibilityItem {
  id: string;
  title: string;
  description: string | null;
  category: string;
  operationId: string | null;
  assignments: ResponsibilityAssignmentItem[];
}

export function getListResponsibilitiesQueryKey(params?: { operationId?: string; memberId?: string }) {
  return ["responsibilities", params ?? {}] as const;
}

export function useListResponsibilities(
  params?: { operationId?: string; memberId?: string },
  options?: { query?: { enabled?: boolean } }
) {
  return useQuery({
    queryKey: getListResponsibilitiesQueryKey(params),
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (params?.operationId) qs.set("operationId", params.operationId);
      if (params?.memberId) qs.set("memberId", params.memberId);
      const q = qs.toString();
      return customFetch<{ responsibilities: ResponsibilityItem[] }>(
        `/api/responsibilities${q ? `?${q}` : ""}`
      );
    },
    enabled: options?.query?.enabled ?? true,
  });
}
