import { and, eq } from "drizzle-orm";
import {
  areaLocalSupervisorsTable,
  areasTable,
  db,
  locationsTable,
  usersTable,
} from "@workspace/db";

export type AreaLocalScope = { areaId: string; locationId: string };

/** A partir da primeira atribuição explícita, o escopo legado não autoriza
 * escritas sem área/local. Inclui atribuições revogadas para não reabrir acesso. */
export async function usesAreaLocalScopes(organizationId: string): Promise<boolean> {
  const [mapping] = await db.select({ id: areaLocalSupervisorsTable.id }).from(areaLocalSupervisorsTable)
    .innerJoin(areasTable, eq(areaLocalSupervisorsTable.areaId, areasTable.id))
    .where(eq(areasTable.organizationId, organizationId)).limit(1);
  return Boolean(mapping);
}

/** Fonte única do escopo de supervisão: área E local, nunca só a área. */
export async function listAreaLocalScopes(
  supervisorId: string,
  organizationId: string,
  executor: Pick<typeof db, "select"> = db,
): Promise<AreaLocalScope[]> {
  return executor
    .select({ areaId: areaLocalSupervisorsTable.areaId, locationId: areaLocalSupervisorsTable.locationId })
    .from(areaLocalSupervisorsTable)
    .innerJoin(areasTable, eq(areaLocalSupervisorsTable.areaId, areasTable.id))
    .innerJoin(locationsTable, eq(areaLocalSupervisorsTable.locationId, locationsTable.id))
    .where(and(
      eq(areaLocalSupervisorsTable.supervisorId, supervisorId),
      eq(areaLocalSupervisorsTable.active, true),
      eq(areasTable.organizationId, organizationId),
      eq(areasTable.active, true),
      eq(locationsTable.organizationId, organizationId),
      eq(locationsTable.closed, false),
    ))
    .for("share");
}

export async function isAreaLocalSupervisor(input: {
  supervisorId: string;
  organizationId: string;
  areaId: string;
  locationId: string;
}): Promise<boolean> {
  const [scope] = await db
    .select({ id: areaLocalSupervisorsTable.id })
    .from(areaLocalSupervisorsTable)
    .innerJoin(areasTable, eq(areaLocalSupervisorsTable.areaId, areasTable.id))
    .innerJoin(locationsTable, eq(areaLocalSupervisorsTable.locationId, locationsTable.id))
    .where(and(
      eq(areaLocalSupervisorsTable.supervisorId, input.supervisorId),
      eq(areaLocalSupervisorsTable.areaId, input.areaId),
      eq(areaLocalSupervisorsTable.locationId, input.locationId),
      eq(areaLocalSupervisorsTable.active, true),
      eq(areasTable.organizationId, input.organizationId),
      eq(areasTable.active, true),
      eq(locationsTable.organizationId, input.organizationId),
      eq(locationsTable.closed, false),
    ))
    .limit(1);
  return Boolean(scope);
}

export async function canSupervisorAccessPerson(input: {
  supervisorId: string;
  organizationId: string;
  personId: string;
}): Promise<boolean> {
  const [person] = await db
    .select({ areaId: usersTable.areaId })
    .from(usersTable)
    .where(and(eq(usersTable.id, input.personId), eq(usersTable.organizationId, input.organizationId)))
    .limit(1);
  if (!person?.areaId) return false;
  // A pessoa pertence à ASA e à área, não a um local fixo. A responsabilidade
  // da Supervisão continua sendo área + local, mas basta supervisionar a área
  // em algum local para poder consultar o cadastro da pessoa.
  const scopes = await listAreaLocalScopes(input.supervisorId, input.organizationId);
  return scopes.some((scope) => scope.areaId === person.areaId);
}
