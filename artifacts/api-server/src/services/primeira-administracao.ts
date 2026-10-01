/**
 * D2 do plano de lançamento: cria a primeira conta de Administração num banco novo, sem apagar nada.
 * - Cria a organização e a operação se ainda não existirem (pelo nome).
 * - Recusa se a organização já tem alguém com perfil ADMIN ativo: roda uma vez só.
 * - Gera senha provisória (mostrada uma vez); a pessoa troca no primeiro login.
 * - Tudo numa transação, com o Registro.
 * Substitui o antigo RESET_PROD_DB, que zerava o banco inteiro.
 */
import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { and, eq, like } from "drizzle-orm";
import { db, normalizeUsernameBase, operationsTable, organizationsTable, resolveUniqueUsername, userRolesTable, usersTable } from "@workspace/db";
import { writeHistoryEvent } from "../lib/history-helper.js";

export type PrimeiraAdministracao = { organizacao: string; operacao: string; nomeCompleto: string; nomeDeUso?: string; email?: string };

export class JaTemAdministracao extends Error {
  constructor(organizacao: string) { super(`A organização "${organizacao}" já tem Administração. Nada foi criado.`); }
}

function senhaProvisoria() {
  const letras = "abcdefghjkmnpqrstuvwxyz", digitos = "23456789";
  const pick = (from: string) => from[randomInt(from.length)]!;
  return `${Array.from({ length: 4 }, () => pick(letras)).join("")}-${Array.from({ length: 4 }, () => pick(digitos)).join("")}`;
}

export async function criarPrimeiraAdministracao(input: PrimeiraAdministracao) {
  const organizacao = input.organizacao.trim(), operacao = input.operacao.trim(), nomeCompleto = input.nomeCompleto.trim();
  if (!organizacao || !operacao || !nomeCompleto) throw new Error("Organização, operação e nome completo são obrigatórios.");
  const nomeDeUso = input.nomeDeUso?.trim() || nomeCompleto.split(/\s+/)[0]!;
  const senha = senhaProvisoria();
  const passwordHash = await bcrypt.hash(senha, 12);

  return db.transaction(async (tx) => {
    let [org] = await tx.select().from(organizationsTable).where(eq(organizationsTable.name, organizacao)).limit(1);
    if (org) {
      const [admin] = await tx.select({ id: userRolesTable.id }).from(userRolesTable)
        .innerJoin(usersTable, eq(usersTable.id, userRolesTable.userId))
        .where(and(eq(usersTable.organizationId, org.id), eq(userRolesTable.role, "ADMIN"), eq(userRolesTable.active, true))).limit(1);
      if (admin) throw new JaTemAdministracao(organizacao);
    } else {
      [org] = await tx.insert(organizationsTable).values({ name: organizacao }).returning();
    }
    let [op] = await tx.select().from(operationsTable).where(and(eq(operationsTable.organizationId, org!.id), eq(operationsTable.name, operacao))).limit(1);
    if (!op) [op] = await tx.insert(operationsTable).values({ organizationId: org!.id, name: operacao, status: "ACTIVE" }).returning();

    const base = normalizeUsernameBase(nomeCompleto);
    const ocupados = new Set((await tx.select({ u: usersTable.username }).from(usersTable).where(like(usersTable.username, `${base}%`))).map((r) => r.u).filter((u): u is string => Boolean(u)));
    const username = resolveUniqueUsername(base, ocupados);
    const [pessoa] = await tx.insert(usersTable).values({
      organizationId: org!.id, fullName: nomeCompleto, name: nomeDeUso, email: input.email?.trim().toLowerCase() || null,
      username, passwordHash, mustChangePassword: true, status: "ACTIVE",
    }).returning({ id: usersTable.id });
    await tx.insert(userRolesTable).values({ userId: pessoa!.id, operationId: op!.id, role: "ADMIN", active: true });
    await writeHistoryEvent({
      category: "OPERATIONAL_CHANGE", action: "organization.primeira_administracao", title: "Primeira Administração criada",
      narrative: `${nomeCompleto} foi cadastrada como a primeira Administração de ${organizacao}, pelo comando de instalação. Troca a senha provisória no primeiro login.`,
      entityType: "user", entityId: pessoa!.id, orgId: org!.id, actorType: "DETERMINISTIC_ENGINE", actorName: "instalação",
      beforeState: null, afterState: { organizacao, operacao, nomeCompleto, username, perfil: "ADMIN" },
    }, tx as never);
    return { organizationId: org!.id, operationId: op!.id, userId: pessoa!.id, username, senhaProvisoria: senha };
  });
}
