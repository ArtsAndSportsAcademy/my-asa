import { and, eq, inArray } from "drizzle-orm";
import { db, areasTable, locationsTable, usersTable } from "@workspace/db";
import { announcementAudienceIds } from "./announcement-audience.js";

/**
 * Para quem vai uma publicação do Mural. Quem escreve marca o que quiser, misturado: a casa, áreas,
 * locais e pessoas. Daqui sai uma de duas formas:
 *   - destino simples (a casa, uma área ou um local) continua DINÂMICO: quem entrar na área depois
 *     também vê;
 *   - qualquer mistura vira uma lista de PESSOAS gravada na hora da publicação, mais um texto que diz,
 *     no cartão, para quem foi ("Patinadores, Bailarinos e 2 pessoas").
 * Para reconhecimento o destino é sempre a lista de pessoas (nunca a casa): o reconhecimento é visto
 * por todos, mas é "para" alguém.
 */
export type Destinos = { casa?: boolean; areaIds?: unknown; locationIds?: unknown; pessoaIds?: unknown };
export type Alvo = {
  scope: "HOUSE" | "AREA" | "LOCATION" | "PEOPLE";
  areaId: string | null;
  locationId: string | null;
  /** Lista explícita de pessoas (sem quem publicou). Vazia quando o destino é dinâmico. */
  pessoaIds: string[];
  label: string | null;
};
export type AlvoResolvido = { ok: true; alvo: Alvo } | { ok: false; status: number; error: string };

export const MAX_DESTINATARIOS = 300;

const ids = (value: unknown): string[] =>
  Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === "string" && id.length > 0))] : [];

const lista = (nomes: string[]) =>
  nomes.length <= 1 ? (nomes[0] ?? "") : `${nomes.slice(0, -1).join(", ")} e ${nomes.at(-1)}`;

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export async function resolverDestinos(input: {
  orgId: string;
  autorId: string;
  destinos: Destinos;
  /** Reconhecimento não vai "para a casa". */
  permitirCasa: boolean;
  /** Reconhecimento precisa da lista de pessoas mesmo quando marcaram uma área só. */
  expandir: boolean;
}): Promise<AlvoResolvido> {
  const { orgId, autorId, destinos, permitirCasa, expandir } = input;
  if (destinos.casa) {
    if (!permitirCasa) return { ok: false, status: 400, error: "Reconhecimento é para pessoas ou grupos, não para a casa toda. Marque quem você quer reconhecer." };
    return { ok: true, alvo: { scope: "HOUSE", areaId: null, locationId: null, pessoaIds: [], label: null } };
  }
  const areaIds = ids(destinos.areaIds), locationIds = ids(destinos.locationIds), pessoaIds = ids(destinos.pessoaIds).filter(id => id !== autorId);
  if (!areaIds.length && !locationIds.length && !pessoaIds.length) {
    return { ok: false, status: 400, error: "Marque para quem vai: a casa, uma área, um local ou pessoas." };
  }

  // Tudo o que foi marcado precisa existir nesta organização (e as pessoas estar ativas).
  const areas = areaIds.length ? await db.select({ id: areasTable.id, name: areasTable.name }).from(areasTable).where(and(inArray(areasTable.id, areaIds), eq(areasTable.organizationId, orgId))) : [];
  if (areas.length !== areaIds.length) return { ok: false, status: 404, error: "Alguma área escolhida não foi encontrada." };
  const locais = locationIds.length ? await db.select({ id: locationsTable.id, name: locationsTable.name }).from(locationsTable).where(and(inArray(locationsTable.id, locationIds), eq(locationsTable.organizationId, orgId))) : [];
  if (locais.length !== locationIds.length) return { ok: false, status: 404, error: "Algum local escolhido não foi encontrado." };
  const pessoas = pessoaIds.length ? await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(and(inArray(usersTable.id, pessoaIds), eq(usersTable.organizationId, orgId), eq(usersTable.status, "ACTIVE"))) : [];
  if (pessoas.length !== pessoaIds.length) return { ok: false, status: 404, error: "Alguma pessoa escolhida não foi encontrada ou não está ativa." };

  // Um destino só, simples: continua dinâmico (a menos que a lista de pessoas seja necessária).
  if (!expandir) {
    if (areas.length === 1 && !locais.length && !pessoas.length) return { ok: true, alvo: { scope: "AREA", areaId: areas[0]!.id, locationId: null, pessoaIds: [], label: null } };
    if (locais.length === 1 && !areas.length && !pessoas.length) return { ok: true, alvo: { scope: "LOCATION", areaId: null, locationId: locais[0]!.id, pessoaIds: [], label: null } };
  }

  // Mistura (ou lista pedida): vira uma lista de pessoas, sem repetir ninguém e sem quem publicou.
  const todas = new Set<string>(pessoaIds);
  if (areas.length) {
    const daArea = await db.select({ id: usersTable.id }).from(usersTable).where(and(eq(usersTable.organizationId, orgId), eq(usersTable.status, "ACTIVE"), inArray(usersTable.areaId, areaIds)));
    for (const row of daArea) todas.add(row.id);
  }
  for (const local of locais) {
    const doLocal = await announcementAudienceIds({ id: "", orgId, authorId: autorId, scope: "LOCATION", areaId: null, locationId: local.id });
    for (const id of doLocal) todas.add(id);
  }
  todas.delete(autorId);
  if (!todas.size) return { ok: false, status: 400, error: "Esses destinos ainda não têm ninguém. Confira se há gente na área ou escalada no local." };
  if (todas.size > MAX_DESTINATARIOS) return { ok: false, status: 400, error: `Esses destinos somam ${todas.size} pessoas; o máximo é ${MAX_DESTINATARIOS}. Para mais gente, mande para uma área ou para toda a casa.` };

  const grupos = [...areas.map(area => area.name), ...locais.map(local => local.name)];
  const partes = [...grupos, ...(pessoas.length ? (pessoas.length <= 2 && !grupos.length ? pessoas.map(p => p.name) : [plural(pessoas.length, "pessoa", "pessoas")]) : [])];
  const rotulo = lista(partes);
  // Uma pessoa só, sem grupo: o cartão já mostra o nome dela; não precisa de texto de destino.
  const label = grupos.length || pessoas.length > 1 ? (rotulo.length > 120 ? `${rotulo.slice(0, 119).trimEnd()}…` : rotulo) : null;
  return { ok: true, alvo: { scope: "PEOPLE", areaId: null, locationId: null, pessoaIds: [...todas], label } };
}
