/**
 * Conta ASA: a segunda Administração, de reserva.
 *
 * Hoje a organização tem uma única pessoa com perfil de Administração. Se ela perder o acesso,
 * ninguém consegue devolver — o "Esqueci minha senha" pede justamente à Administração. Esta conta
 * existe para esse caso, e para tarefas de manutenção que não devem aparecer como ação de uma
 * pessoa.
 *
 * Ela nasce **sem senha**: quem a usa define a senha pelo próprio app (Cadastros → ASA → Redefinir
 * senha, que mostra uma provisória para trocar no primeiro acesso). Nenhuma senha é gerada,
 * escrita ou transportada por aqui.
 *
 * Sem área e sem local de costume de propósito: Administração já não entra em show (o resolvedor
 * exclui ADMIN e DIR), e sem área ela também não entra em bloco de área nem na grade de folgas.
 *
 *   ... conta-asa-reserva.ts             → só confere
 *   ... conta-asa-reserva.ts --ensaiar   → cria e reverte na transação
 *   ... conta-asa-reserva.ts --aplicar   → grava
 */
import { and, eq } from "drizzle-orm";
import { db, operationsTable, organizationsTable, pool, userRolesTable, usersTable } from "@workspace/db";
import { writeHistoryEvent } from "../src/lib/history-helper.js";

const USUARIO = "asa";
const EXIBICAO = "ASA";
const COMPLETO = "Conta ASA (administração de reserva)";
const ensaiar = process.argv.includes("--ensaiar");
const aplicar = process.argv.includes("--aplicar") || ensaiar;
if (ensaiar && process.argv.includes("--aplicar")) throw new Error("Escolha --ensaiar ou --aplicar, não ambos.");

try {
  await db.transaction(async (tx) => {
    const organizacoes = await tx.select({ id: organizationsTable.id, name: organizationsTable.name }).from(organizationsTable);
    if (organizacoes.length !== 1) throw new Error(`Esperava uma organização, encontrei ${organizacoes.length}.`);
    const org = organizacoes[0]!;
    const operacoes = await tx.select({ id: operationsTable.id }).from(operationsTable)
      .where(and(eq(operationsTable.organizationId, org.id), eq(operationsTable.status, "ACTIVE")));
    if (operacoes.length !== 1) throw new Error(`Esperava uma operação ativa, encontrei ${operacoes.length}.`);

    const existente = await tx.select({ id: usersTable.id }).from(usersTable)
      .where(and(eq(usersTable.organizationId, org.id), eq(usersTable.username, USUARIO)));
    if (existente.length) throw new Error("A conta ASA já existe; nada foi alterado.");

    const admins = await tx.select({ id: userRolesTable.id }).from(userRolesTable)
      .innerJoin(usersTable, eq(usersTable.id, userRolesTable.userId))
      .where(and(eq(usersTable.organizationId, org.id), eq(userRolesTable.role, "ADMIN"), eq(userRolesTable.active, true)));
    console.log(`Organização ${org.name}: ${admins.length} conta(s) de Administração hoje. A conta ASA fica sem área e sem local.`);
    if (!aplicar) return;

    const [pessoa] = await tx.insert(usersTable).values({
      organizationId: org.id, name: EXIBICAO, fullName: COMPLETO, username: USUARIO,
      areaId: null, defaultLocationId: null,
      // Sem senha: quem for usar define pelo app, em Cadastros → Redefinir senha.
      mustChangePassword: true,
    }).returning();
    await tx.insert(userRolesTable).values({ userId: pessoa!.id, operationId: operacoes[0]!.id, role: "ADMIN", active: true });
    await writeHistoryEvent({
      category: "OPERATIONAL_CHANGE", action: "user.created", title: "Conta ASA de reserva criada",
      narrative: "Segunda conta de Administração, para o caso de a Administração principal perder o acesso. Nasce sem senha: quem for usar define pelo app.",
      entityType: "user", entityId: pessoa!.id, actorType: "DETERMINISTIC_ENGINE",
      actorName: "Claude, com autorização da Administração", orgId: org.id, operationId: operacoes[0]!.id,
      beforeState: null, afterState: { username: USUARIO, role: "ADMIN", areaId: null, defaultLocationId: null },
      metadata: { reason: "Pedido da Administração em 13/10/2026: conta de reserva para recuperação de acesso" },
    }, tx as never);
    console.log(`Conta ${USUARIO} criada como Administração, sem senha. Defina a senha pelo app antes de usar.`);
    if (ensaiar) throw new Error("ENSAIO_REVERTER");
  });
  console.log(aplicar ? "Concluído." : "Somente leitura; nenhuma escrita realizada.");
} catch (erro) {
  if (ensaiar && (erro as Error).message === "ENSAIO_REVERTER") console.log("Ensaio completo: a conta foi criada e revertida dentro da transação.");
  else { console.error("Interrompido; a transação foi revertida. Causa:", (erro as Error).message); process.exitCode = 1; }
} finally {
  await pool.end();
}
