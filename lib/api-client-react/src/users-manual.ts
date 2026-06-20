import { useMutation } from "@tanstack/react-query";
import type { UseMutationOptions } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";

const deleteUser = async (id: string): Promise<void> =>
  customFetch<void>(`/api/users/${id}`, { method: "DELETE" });

export function useDeleteUser(
  options?: UseMutationOptions<void, Error, string>,
) {
  return useMutation<void, Error, string>({
    mutationFn: deleteUser,
    ...options,
  });
}
