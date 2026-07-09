import { useQuery } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";

export interface ScaleSuggestionResponsibility {
  id: string;
  title: string;
  description: string | null;
  category: string;
}

export interface ScaleSuggestion {
  userId: string;
  userName: string;
  freeGaps: Array<{ start: string; end: string }>;
  responsibilities: ScaleSuggestionResponsibility[];
}

export interface GetScaleSuggestionsResponse {
  suggestions: ScaleSuggestion[];
}

export function getScaleSuggestionsQueryKey(scaleId?: string, date?: string) {
  return ["scale-suggestions", scaleId ?? "", date ?? ""];
}

export function useGetScaleSuggestions(
  scaleId: string | undefined,
  date: string | undefined,
  options?: { query?: { enabled?: boolean } }
) {
  const enabled =
    options?.query?.enabled !== undefined
      ? options.query.enabled
      : !!(scaleId && date);

  return useQuery({
    queryKey: getScaleSuggestionsQueryKey(scaleId, date),
    queryFn: () =>
      customFetch<GetScaleSuggestionsResponse>(
        `/api/scales/${scaleId}/suggestions?date=${date}`
      ),
    enabled,
  });
}
