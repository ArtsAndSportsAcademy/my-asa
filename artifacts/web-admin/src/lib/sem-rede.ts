import { ApiError } from "@workspace/api-client-react";

/** A requisição nem chegou ao servidor: o fetch do navegador lança TypeError, não ApiError. */
export function semRede(err: unknown) {
  return !(err instanceof ApiError) && (err instanceof TypeError || (typeof navigator !== "undefined" && !navigator.onLine));
}
