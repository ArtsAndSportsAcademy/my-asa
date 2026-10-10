/** Cadastro pontual autorizado pela Babi em 10/10/2026.
 * Usa uma só transação no banco e identifica o agente no Registro.
 * Sem --aplicar, apenas confere. Nunca registra a URL do banco nem credenciais.
 */
import { and, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db, pool, charactersTable, characterCastTable, locationsTable, operationsTable, showBooksTable,
  showBookScenesTable, showBookBlocksTable, showBookRolesTable, showBookLinesTable,
  showBookVersionsTable, usersTable } from "@workspace/db";
import { buildShowBookTree } from "../src/services/line-resolver.js";
import { writeHistoryEvent } from "../src/lib/history-helper.js";
import { cadastro, regrasNoiteAlema, resolverPessoa } from "./vagas-buona-bella.mjs";

const orgId = "77ea430d-3548-4952-b9da-22587d016da3";
const ensaiar = process.argv.includes("--ensaiar");
const aplicar = process.argv.includes("--aplicar") || ensaiar;
if (ensaiar && process.argv.includes("--aplicar")) throw new Error("Escolha --ensaiar ou --aplicar, não ambos.");
const nomes = [...new Set(cadastro.flatMap((item) => item.fila))];
type Transacao = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function executar(tx: Transacao) {
  if (aplicar) await tx.execute(sql`select pg_advisory_xact_lock(667911, 11)`);
  const prefixos = [...new Set(nomes.map((nome) => nome.split(" ")[0]!.normalize("NFD").replace(/[\u0300-\u036f]/g, "")))];
  const pessoas = await tx.select({ id: usersTable.id, fullName: usersTable.fullName,
    name: usersTable.name, status: usersTable.status })
    .from(usersTable).where(and(eq(usersTable.organizationId, orgId), eq(usersTable.status, "ACTIVE"),
      or(...prefixos.flatMap((prefixo) => [ilike(usersTable.fullName, `${prefixo}%`), ilike(usersTable.name, `${prefixo}%`)]))));
  // Os nomes oficiais com acento também são necessários para resolver Isadora, Vinícius e Cássia.
  const acentuados = nomes.filter((nome) => nome !== nome.normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
  const extras = await tx.select({ id: usersTable.id, fullName: usersTable.fullName,
    name: usersTable.name, status: usersTable.status })
    .from(usersTable).where(and(eq(usersTable.organizationId, orgId), eq(usersTable.status, "ACTIVE"),
      or(...acentuados.flatMap((nome) => [ilike(usersTable.fullName, `${nome}%`), ilike(usersTable.name, `${nome}%`)]))));
  const unicas = [...new Map([...pessoas, ...extras].map((pessoa) => [pessoa.id, pessoa])).values()];
  const planos = [];
  for (const item of cadastro) {
    const livros = await tx.select({ show: showBooksTable, local: locationsTable })
      .from(showBooksTable)
      .innerJoin(locationsTable, eq(showBooksTable.locationId, locationsTable.id))
      .innerJoin(operationsTable, eq(showBooksTable.operationId, operationsTable.id))
      .where(and(eq(operationsTable.organizationId, orgId), eq(locationsTable.organizationId, orgId),
        eq(locationsTable.name, item.local), eq(showBooksTable.title, item.show)));
    if (livros.length !== 1) throw new Error(`${item.local} / ${item.show}: show ausente ou duplicado.`);
    const { show, local } = livros[0]!;
    if (show.status === "ARCHIVED" || show.type !== "CHARACTERS_ONLY") throw new Error(`${item.show}: estado ou tipo inesperado.`);
    const memberIds = item.fila.map((nome) => resolverPessoa(unicas, nome));
    if (new Set(memberIds).size !== memberIds.length) throw new Error(`${item.show}: pessoa repetida na fila.`);
    const anteriores = await tx.select({ id: charactersTable.id }).from(charactersTable)
      .where(and(eq(charactersTable.showBookId, show.id), eq(charactersTable.active, true)));
    const posicoes = await tx.select({ id: showBookRolesTable.id }).from(showBookRolesTable)
      .where(and(eq(showBookRolesTable.showBookId, show.id), eq(showBookRolesTable.active, true)));
    if (anteriores.length || posicoes.length) throw new Error(`${item.show}: já há vagas ou posições. Nada foi alterado; conferir manualmente.`);
    if (item.show === "Noite Alemã" && show.description && !show.description.includes(regrasNoiteAlema)) {
      // As observações anteriores entram junto no novo texto; nunca são substituídas.
      console.log(`${item.show}: observações existentes serão preservadas.`);
    }
    planos.push({ item, show, local, memberIds });
  }
  console.log(`Conferidos ${planos.length} shows, ${nomes.length} pessoas e 11 vagas novas na organização correta.`);
  if (!aplicar) return;

  for (const { item, show, local, memberIds } of planos) {
    let versao = show.version;
    const registrarVersao = async (motivo: string, tipo: "CONFIG" | "STRUCTURAL") => {
      versao++;
      await tx.update(showBooksTable).set({ version: versao, updatedAt: new Date() }).where(eq(showBooksTable.id, show.id));
      const snapshot = await buildShowBookTree(show.id, tx as any);
      await tx.insert(showBookVersionsTable).values({ showBookId: show.id, version: versao,
        changeType: tipo, reason: motivo, snapshot, createdBy: show.createdBy });
    };
    if (item.show === "Noite Alemã" && !show.description?.includes(regrasNoiteAlema)) {
      const novoTexto = [show.description, regrasNoiteAlema].filter(Boolean).join("\n\n");
      await tx.update(showBooksTable).set({ description: novoTexto, updatedAt: new Date() }).where(eq(showBooksTable.id, show.id));
      await writeHistoryEvent({ category: "OPERATIONAL_CHANGE", action: "show_book.updated",
        title: "Regras da Noite Alemã registradas",
        narrative: "As restrições de Frida, da dupla e das férias escolares foram registradas como conferência manual antes da publicação.",
        entityType: "show_book", entityId: show.id, actorType: "DETERMINISTIC_ENGINE",
        actorName: "Codex, com autorização da Administração", operationId: show.operationId,
        orgId, beforeState: { description: show.description }, afterState: { description: novoTexto },
        metadata: { reason: "Autorizado pela Babi em 10/10/2026 para o cadastro de Buona e Bella" },
      }, tx as any);
      await registrarVersao("Regras da Noite Alemã — conferência manual", "CONFIG");
    }
    const [scene] = await tx.insert(showBookScenesTable).values({ showBookId: show.id,
      name: "Personagens do show", order: 0, isCastRoster: true }).returning();
    const [block] = await tx.insert(showBookBlocksTable).values({ showBookId: show.id,
      sceneId: scene!.id, name: "Personagens", order: 0, zone: "CENTRO", prefix: "PER" }).returning();
    for (const [order, name] of item.vagas.entries()) {
      const [character] = await tx.insert(charactersTable).values({ name, locationId: local.id,
        mode: "rodizio", showBookId: show.id, active: true }).returning();
      await tx.insert(characterCastTable).values(memberIds.map((personId, index) => ({
        characterId: character!.id, personId, order: index, timesDone: 0, active: true,
      })));
      const [position] = await tx.insert(showBookRolesTable).values({ showBookId: show.id,
        blockId: block!.id, name, order }).returning();
      await tx.insert(showBookLinesTable).values({ positionId: position!.id,
        characterId: character!.id, type: "CHARACTER", config: {}, order: 0 });
      await writeHistoryEvent({ category: "OPERATIONAL_CHANGE", action: "show_book.vaga.created",
        title: "Vaga criada no show", narrative: `${item.show}: ${name} (rodízio) criada no show com a fila aprovada.`,
        entityType: "show_book_position", entityId: position!.id, actorType: "DETERMINISTIC_ENGINE",
        actorName: "Codex, com autorização da Administração", operationId: show.operationId, orgId,
        beforeState: null, afterState: { position, character, fila: memberIds },
        metadata: { reason: "Quantidades e filas confirmadas pela Babi em 10/10/2026" },
      }, tx as any);
      await registrarVersao("Vaga de personagem acrescentada", "STRUCTURAL");
    }
    console.log(`${item.local} / ${item.show}: ${item.vagas.length} vaga(s), Registro e versão criados.`);
  }
}

try {
  await db.transaction(async (tx) => {
    await executar(tx);
    if (ensaiar) throw new Error("ENSAIO_REVERTER");
  });
  console.log(aplicar ? "Cadastro de produção concluído em uma transação." : "Somente leitura; nenhuma escrita realizada.");
} catch (erro) {
  if (ensaiar && (erro as Error).message === "ENSAIO_REVERTER") {
    console.log("Ensaio completo: todas as 11 vagas e os Registros foram criados e revertidos na transação.");
  } else {
    console.error("Cadastro interrompido; a transação foi revertida. Causa:", (erro as Error).message);
    process.exitCode = 1;
  }
} finally {
  await pool.end();
}
