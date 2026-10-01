import { and, eq, ilike } from "drizzle-orm";
import { db, locationsTable } from "@workspace/db";
import { listAreaLocalScopes } from "./area-local-scope.js";

const LOCATION_READ_ROLES = new Set(["ADMIN", "DIR", "SUPERVISOR_A", "SUPERVISOR_B"]);

export async function listReadableLocations(organizationId: string, userId: string, role: string, query?: string, limit?: number, includeClosed = false) {
  if (!LOCATION_READ_ROLES.has(role)) return null;
  let locations = await db.select()
    .from(locationsTable)
    .where(and(eq(locationsTable.organizationId, organizationId), includeClosed ? undefined : eq(locationsTable.closed, false), query?.trim()
      ? ilike(locationsTable.name, `%${query.trim().slice(0, 120).replace(/[\\%_]/g, "\\$&")}%`)
      : undefined))
    .orderBy(locationsTable.name);
  if (role === "SUPERVISOR_A" || role === "SUPERVISOR_B") {
    const scopes = await listAreaLocalScopes(userId, organizationId);
    const visibleIds = new Set(scopes.map((scope) => scope.locationId));
    locations = locations.filter((location) => visibleIds.has(location.id));
  }
  return limit ? locations.slice(0, Math.min(Math.max(Math.floor(limit), 1), 20)) : locations;
}
