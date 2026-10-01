import type { Request, Response } from "express";

export type VersionedSnapshot = Record<string, unknown>;

export class VersionConflictError extends Error {
  constructor(resource: string) {
    super(resource + " foi alterado durante a gravação.");
    this.name = "VersionConflictError";
  }
}

export class VersionedResourceNotFoundError extends Error {
  constructor(resource: string) {
    super(resource + " não encontrado.");
    this.name = "VersionedResourceNotFoundError";
  }
}

export interface SnapshotChange {
  path: string;
  before: unknown;
  after: unknown;
  field: string;
  from: unknown;
  to: unknown;
  message: string;
}

export function readExpectedVersion(req: Request): number | null {
  const bodyValue = req.body && typeof req.body === "object"
    ? (req.body as Record<string, unknown>).expectedVersion
    : undefined;
  const headerValue = req.header("if-match")?.replace(/^W\//, "").replace(/^"|"$/g, "");
  const raw = bodyValue ?? headerValue;
  const value = typeof raw === "string" && raw.trim() !== "" ? Number(raw) : raw;
  return typeof value === "number" && Number.isInteger(value) && value >= 1 ? value : null;
}

export function readBaseSnapshot(req: Request): VersionedSnapshot | null {
  const value = req.body && typeof req.body === "object"
    ? (req.body as Record<string, unknown>).baseSnapshot
    : null;
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as VersionedSnapshot
    : null;
}

export function requireExpectedVersion(
  req: Request,
  res: Response,
  resource: string,
): number | null {
  const expectedVersion = readExpectedVersion(req);
  if (expectedVersion !== null) return expectedVersion;

  res.status(428).json({
    error: "VERSION_REQUIRED",
    message: "A versão recebida ao carregar " + resource + " é obrigatória para salvar.",
  });
  return null;
}

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function isSnapshotObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date);
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "vazio";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return `"${value}"`;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function humanField(path: string): string {
  return path.replace(/^\$\.?/, "").replace(/\[(\d+)\]/g, "[$1]") || "registro";
}

export function diffSnapshots(
  before: VersionedSnapshot | null,
  after: VersionedSnapshot,
): SnapshotChange[] | null {
  if (!before) return null;
  const changes: SnapshotChange[] = [];

  function visit(left: unknown, right: unknown, path: string) {
    if (changes.length >= 200) return;
    if (sameValue(left, right)) return;

    if (isSnapshotObject(left) && isSnapshotObject(right)) {
      const keys = new Set([
        ...Object.keys(left as Record<string, unknown>),
        ...Object.keys(right as Record<string, unknown>),
      ]);
      for (const key of [...keys].sort()) {
        visit(
          (left as Record<string, unknown>)[key],
          (right as Record<string, unknown>)[key],
          path ? path + "." + key : key,
        );
      }
      return;
    }

    const before = left ?? null;
    const after = right ?? null;
    const field = humanField(path);
    changes.push({
      path,
      before,
      after,
      field,
      from: before,
      to: after,
      message: `${field}: de ${formatValue(before)} para ${formatValue(after)}`,
    });
  }

  visit(before, after, "$");
  return changes;
}

export function respondWithVersionConflict(
  res: Response,
  resource: string,
  expectedVersion: number,
  currentVersion: number,
  currentSnapshot: VersionedSnapshot,
  baseSnapshot: VersionedSnapshot | null,
): void {
  res.status(409).json({
    error: "CONCURRENT_MODIFICATION",
    conflict: true,
    resource,
    message: resource + " foi alterado depois que você o carregou.",
    expectedVersion,
    currentVersion,
    changes: diffSnapshots(baseSnapshot, currentSnapshot) ?? [{
      path: "$",
      before: null,
      after: currentSnapshot,
      field: "registro",
      from: null,
      to: currentSnapshot,
      message: `registro: de vazio para ${formatValue(currentSnapshot)}`,
    }],
    submitted: {
      version: expectedVersion,
      snapshot: baseSnapshot,
    },
    current: {
      version: currentVersion,
      snapshot: currentSnapshot,
    },
  });
}
