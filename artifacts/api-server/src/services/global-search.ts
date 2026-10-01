import { and, eq, inArray, or } from "drizzle-orm";
import { db, usersTable, areasTable, libraryDocumentsTable, noticesTable, noticeRecipientsTable, showBooksTable, operationsTable } from "@workspace/db";
import type { AccessTokenPayload } from "../lib/jwt.service.js";
import { operationalDate, shiftOperationalDate } from "../lib/operational-date.js";
import { listAreaLocalScopes } from "./area-local-scope.js";
import { canViewShowBook } from "../lib/show-responsibility.js";

export function normalizeSearch(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim().replace(/\s+/g, " "); }
function oneEdit(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length >= b.length) i++;
    if (b.length >= a.length) j++;
  }
  return edits + (i < a.length || j < b.length ? 1 : 0) <= 1;
}
export function searchRank(query: string, name: string, alias = "") {
  const q = normalizeSearch(query), n = normalizeSearch(name), a = normalizeSearch(alias);
  if (!q) return null;
  const nameWords = n.split(" ");
  const aliasWords = a.split(" ");
  // O nome de exibição é a referência principal da casa. Um começo dele deve
  // sempre ganhar de uma coincidência no sobrenome do nome formal.
  if (n.startsWith(q)) return 0;
  if (a && a.startsWith(q)) return 1;
  if (nameWords.some(word => word.startsWith(q))) return 2;
  if (aliasWords.some(word => word.startsWith(q))) return 3;
  if (n.includes(q)) return 4;
  if (a.includes(q)) return 5;
  if (q.length >= 3 && [n, a, ...nameWords, ...aliasWords].some(word => oneEdit(q, word))) return 6;
  return null;
}
export function searchDate(query: string, now = new Date()): string | null {
  const q = normalizeSearch(query), today = operationalDate(now);
  if (q === "hoje") return today;
  if (q === "ontem") return shiftOperationalDate(today, -1);
  if (q === "amanha") return shiftOperationalDate(today, 1);
  const months = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const slash = q.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/);
  const written = q.match(/^(\d{1,2}) de ([a-z]+)(?: (?:de )?(\d{4}))?$/);
  const iso = q.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const year = Number(iso?.[1] ?? slash?.[3] ?? written?.[3] ?? today.slice(0, 4));
  const month = iso ? Number(iso[2]) : slash ? Number(slash[2]) : written ? months.indexOf(written[2]!) + 1 : 0;
  const day = Number(iso?.[3] ?? slash?.[1] ?? written?.[1] ?? 0);
  if (!year || year < 1900 || year > 2200 || !month || !day) return null;
  const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const parsed = new Date(`${date}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? date : null;
}
export function asaSearchAtTop(query: string, total: number) {
  const q = normalizeSearch(query);
  return q.split(" ").length >= 4 || /^(quem|quando|onde|quantos|por que|como)\b/.test(q) || q.endsWith("?") || total === 0;
}
export type SearchHit = { id: string; label: string; href: string; subtitle?: string };
function ranked<T extends { id: string }>(rows: T[], query: string, name: (row: T) => string, alias: (row: T) => string = () => "", limit = 3) {
  return rows.map(row => ({ row, rank: searchRank(query, name(row), alias(row)) })).filter((item): item is { row: T; rank: number } => item.rank !== null)
    .sort((a, b) => a.rank - b.rank || name(a.row).localeCompare(name(b.row), "pt-BR") || a.row.id.localeCompare(b.row.id)).slice(0, limit).map(item => item.row);
}
export async function directoryPeople(actor: AccessTokenPayload) {
  const scope = [eq(usersTable.organizationId, actor.organizationId), eq(usersTable.status, "ACTIVE")];
  if (!["ADMIN", "DIR"].includes(actor.role)) {
    if (actor.role.startsWith("SUPERVISOR")) {
      const pairs = await listAreaLocalScopes(actor.sub, actor.organizationId);
      const areaIds = [...new Set(pairs.map((pair) => pair.areaId))];
      scope.push(areaIds.length ? or(eq(usersTable.id, actor.sub), ...areaIds.map((areaId) => eq(usersTable.areaId, areaId)))! : eq(usersTable.id, actor.sub));
    } else {
      const [self] = await db.select({ areaId: usersTable.areaId }).from(usersTable).where(eq(usersTable.id, actor.sub));
      scope.push(self?.areaId ? eq(usersTable.areaId, self.areaId) : eq(usersTable.id, actor.sub));
    }
  }
  // Directory projection, not the private person record (which retains its existing 403).
  return db.select({
    id: usersTable.id,
    name: usersTable.name,
    fullName: usersTable.fullName,
    areaId: usersTable.areaId,
    areaName: areasTable.name,
  }).from(usersTable)
    .leftJoin(areasTable, eq(areasTable.id, usersTable.areaId))
    .where(and(...scope));
}
export async function globalSearch(actor: AccessTokenPayload, query: string) {
  const org = actor.organizationId;
  const manager = ["ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"].includes(actor.role);
  const [personRows, showRows, docs, notices] = await Promise.all([
    directoryPeople(actor),
    db.select({ show: showBooksTable }).from(showBooksTable).innerJoin(operationsTable, eq(showBooksTable.operationId, operationsTable.id)).where(and(eq(operationsTable.organizationId, org), or(eq(showBooksTable.status, "DRAFT"), eq(showBooksTable.status, "PUBLISHED")))),
    db.select({ id: libraryDocumentsTable.id, title: libraryDocumentsTable.title }).from(libraryDocumentsTable).where(and(eq(libraryDocumentsTable.orgId, org), manager ? inArray(libraryDocumentsTable.status, ["DRAFT", "PUBLISHED", "UPDATED"]) : inArray(libraryDocumentsTable.status, ["PUBLISHED", "UPDATED"]))),
    db.selectDistinct({ id: noticesTable.id, title: noticesTable.title }).from(noticesTable).innerJoin(operationsTable, eq(noticesTable.operationId, operationsTable.id)).leftJoin(noticeRecipientsTable, eq(noticeRecipientsTable.noticeId, noticesTable.id)).where(and(eq(operationsTable.organizationId, org), eq(noticesTable.status, "PUBLISHED"), ["ADMIN", "DIR"].includes(actor.role) ? undefined : or(eq(noticeRecipientsTable.userId, actor.sub), eq(noticesTable.authorId, actor.sub)))),
  ]);
  const people = ranked(personRows, query, row => row.name, row => row.fullName).map(row => ({
    id: row.id,
    label: row.name,
    subtitle: row.areaName ?? undefined,
    href: `/admin/search?person=${row.id}`,
  }));
  const date = searchDate(query);
  const dates: SearchHit[] = date ? [{ id: date, label: date.split("-").reverse().join("/"), href: `/admin/search?date=${date}` }] : [];
  const visibleShows = [];
  // Authorize only matching candidates, but limit AFTER authorization (no hidden hit counts).
  for (const show of ranked(showRows.map(row => row.show), query, row => row.title, undefined, Infinity)) {
    if (await canViewShowBook(actor, show, show.operationId)) visibleShows.push(show);
    if (visibleShows.length === 3) break;
  }
  const shows = ranked(visibleShows, query, row => row.title).map(row => ({ id: row.id, label: row.title, href: `/admin/search?show=${row.id}` }));
  const documents = ranked(docs, query, row => row.title).map(row => ({ id: row.id, label: row.title, href: `/admin/search?document=${row.id}` }));
  const noticesHits = ranked(notices, query, row => row.title ?? "Aviso").map(row => ({ id: row.id, label: row.title ?? "Aviso", href: `/admin/search?notice=${row.id}` }));
  const groups = [ { key: "people", label: "Pessoas", items: people }, { key: "dates", label: "Datas", items: dates }, { key: "shows", label: "Shows", items: shows }, { key: "documents", label: "Documentos", items: documents }, { key: "notices", label: "Avisos", items: noticesHits } ];
  return { groups, asaAtTop: asaSearchAtTop(query, groups.reduce((sum, group) => sum + group.items.length, 0)) };
}
