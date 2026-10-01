import type { Response } from "express";

export function normalizeReason(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const reason = value.trim();
  return reason.length > 0 ? reason : null;
}

export function requireReason(
  res: Response,
  value: unknown,
  action: string,
): string | null {
  const reason = normalizeReason(value);
  if (reason) return reason;

  res.status(400).json({
    error: "REASON_REQUIRED",
    message: "Motivo obrigatório para " + action + ".",
  });
  return null;
}
