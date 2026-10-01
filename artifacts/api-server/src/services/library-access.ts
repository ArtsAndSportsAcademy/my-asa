export type LibraryRole = "MEMBER" | "SUPERVISOR_A" | "SUPERVISOR_B" | "ADMIN" | "DIRECTOR" | "DIR";
export type LibraryDocumentScope = { scopeType: string; areaId: string | null; locationId: string | null };

export const LIBRARY_MANAGER_ROLES: LibraryRole[] = ["ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"];

export function isLibraryManager(role: LibraryRole | null): boolean {
  return role !== null && LIBRARY_MANAGER_ROLES.includes(role);
}

export function isLibraryFullReader(role: LibraryRole | null): boolean {
  return isLibraryManager(role) || role === "DIRECTOR" || role === "DIR";
}

export function canReadLibraryScope(document: LibraryDocumentScope, fullReader: boolean, areaId: string | null): boolean {
  if (fullReader) return true;
  // Pessoa não tem local permanente autorizado; LOCATION exige contexto próprio, não inferência.
  return document.scopeType === "HOUSE" || (document.scopeType === "AREA" && document.areaId === areaId);
}
