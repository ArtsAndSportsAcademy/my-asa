import { useMutation } from "@tanstack/react-query";
import type { UseMutationOptions } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";
import type { ShowBook } from "./generated/api.schemas";

export interface AssignShowBookResponsibleInput {
  id: string;
  responsibleId: string | null;
}

const assignShowBookResponsible = async (
  input: AssignShowBookResponsibleInput,
): Promise<{ showBook: ShowBook }> =>
  customFetch<{ showBook: ShowBook }>(`/api/show-books/${input.id}/responsible`, {
    method: "PATCH",
    body: JSON.stringify({ responsibleId: input.responsibleId }),
  });

export function useAssignShowBookResponsible(
  options?: UseMutationOptions<{ showBook: ShowBook }, Error, AssignShowBookResponsibleInput>,
) {
  return useMutation<{ showBook: ShowBook }, Error, AssignShowBookResponsibleInput>({
    mutationFn: assignShowBookResponsible,
    ...options,
  });
}
