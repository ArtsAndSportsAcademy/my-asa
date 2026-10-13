/**
 * Vagas de personagem do Acquamotion, da aba Personagens da planilha, confirmadas pela Babi em
 * 13/10/2026. Mesma mecânica do cadastro de Buona e Bella, com uma diferença: Floris, Ales e Veron
 * são o mesmo personagem no Boas Vindas e no Musical — uma fila só, contada entre os dois shows,
 * como a Astrid é entre o Musical e a Patinação de Snowland.
 *
 *   node --env-file=../../.env.test  ... vagas-acquamotion.ts            → só confere
 *   ... --ensaiar                                                        → cria tudo e reverte
 *   ... --aplicar                                                        → grava, em uma transação
 *
 * A URL do banco vem do arquivo de ambiente passado na linha de comando; nada de credencial aqui.
 */
import { and, eq, ilike, isNull, or } from "drizzle-orm";
import {
  charactersTable, characterCastTable, db, locationsTable, operationsTable, pool,
  showBookBlocksTable, showBookLinesTable, showBookRolesTable, showBookScenesTable,
  showBookVersionsTable, showBooksTable, usersTable,
} from "@workspace/db";
import { buildShowBookTree } from "../src/services/line-resolver.js";
import { writeHistoryEvent } from "../src/lib/history-helper.js";
import { resolverPessoa } from "./vagas-buona-bella.mjs";

const LOCAL = "Acquamotion";
const MOTIVO = "Planilha de personagens do Acquamotion, confirmada pela Administração em 13/10/2026";

/** Fila dos mergulhadores e da produção: o elenco do Acqua inteiro. */
const ELENCO = ["Mariela", "Luize", "Geovani", "Mattheus", "Daniel", "Victor Massalai", "Sthefany"];
type Vaga = { nome: string; fila: string[]; compartilhado?: boolean };
export const cadastroAcqua: { show: string; vagas: Vaga[] }[] = [
  { show: "Opening", vagas: [
    { nome: "Mergulhador 1", fila: ELENCO },
    { nome: "Mergulhador 2", fila: ELENCO },
  ] },
  { show: "Boas Vindas", vagas: [
    { nome: "Floris", fila: ["Mariela", "Luize"], compartilhado: true },
    { nome: "Ales", fila: ["Mattheus", "Geovani", "Miguel", "Victor Massalai"], compartilhado: true },
    { nome: "Veron", fila: ["Victor Massalai", "Daniel", "Geovani"], compartilhado: true },
  ] },
  { show: "Musical", vagas: [
    { nome: "Floris", fila: ["Mariela", "Luize"], compartilhado: true },
    { nome: "Ales", fila: ["Mattheus", "Geovani", "Miguel", "Victor Massalai"], compartilhado: true },
    { nome: "Veron", fila: ["Victor Massalai", "Daniel", "Geovani"], compartilhado: true },
  ] },
  // A planilha tem Acquashow de inverno e de primavera; o que está em cartaz é o de primavera.
  { show: "Acquashow", vagas: [
    { nome: "Agua", fila: ["Mariela", "Sthefany"] },
    { nome: "Menino Duo", fila: ["Geovani", "Daniel"] },
    { nome: "Menina Trio", fila: ["Luize", "Mariela"] },
    { nome: "Menino Trio 1", fila: ["Victor Massalai", "Mattheus"] },
    { nome: "Menino Trio 2", fila: ["Daniel", "Miguel", "Geovani"] },
  ] },
  { show: "Goodbye", vagas: [
    { nome: "Mergulhador 1", fila: ELENCO },
    { nome: "Mergulhador 2", fila: ELENCO },
    { nome: "Produção 1", fila: ELENCO },
    { nome: "Produção 2", fila: ELENCO },
  ] },
];

const ensaiar = process.argv.includes("--ensaiar");
const aplicar = process.argv.includes("--aplicar") || ensaiar;
if (ensaiar && process.argv.includes("--aplicar")) throw new Error("Escolha --ensaiar ou --aplicar, não ambos.");
type Transacao = Parameters<Parameters<typeof db.transaction>[0]>[0];
const semAcento = (valor: string) => valor.normalize("NFD").replace(/[̀-ͯ]/g, "");

async function executar(tx: Transacao) {
  const [local] = await tx.select({ id: locationsTable.id, organizationId: locationsTable.organizationId })
    .from(locationsTable).where(eq(locationsTable.name, LOCAL));
  if (!local) throw new Error(`Local ${LOCAL} não encontrado.`);
  const orgId = local.organizationId;

  const nomes = [...new Set(cadastroAcqua.flatMap((item) => item.vagas.flatMap((v) => v.fila)))];
  const prefixos = [...new Set(nomes.map((nome) => semAcento(nome.split(" ")[0]!)))];
  const pessoas = await tx.select({ id: usersTable.id, fullName: usersTable.fullName, name: usersTable.name, status: usersTable.status })
    .from(usersTable).where(and(eq(usersTable.organizationId, orgId), eq(usersTable.status, "ACTIVE"),
      or(...prefixos.flatMap((p) => [ilike(usersTable.fullName, `${p}%`), ilike(usersTable.name, `${p}%`)]))));

  const planos = [];
  for (const item of cadastroAcqua) {
    const livros = await tx.select({ show: showBooksTable }).from(showBooksTable)
      .innerJoin(operationsTable, eq(showBooksTable.operationId, operationsTable.id))
      .where(and(eq(operationsTable.organizationId, orgId), eq(showBooksTable.locationId, local.id), eq(showBooksTable.title, item.show)));
    if (livros.length !== 1) throw new Error(`${LOCAL} / ${item.show}: show ausente ou duplicado.`);
    const show = livros[0]!.show;
    if (show.status === "ARCHIVED") throw new Error(`${item.show}: show arquivado.`);
    const posicoes = await tx.select({ id: showBookRolesTable.id }).from(showBookRolesTable)
      .where(and(eq(showBookRolesTable.showBookId, show.id), eq(showBookRolesTable.active, true)));
    if (posicoes.length) throw new Error(`${item.show}: já há vagas. Nada foi alterado; confira pela tela.`);
    const vagas = item.vagas.map((vaga) => {
      const memberIds = vaga.fila.map((nome) => resolverPessoa(pessoas, nome));
      if (new Set(memberIds).size !== memberIds.length) throw new Error(`${item.show} / ${vaga.nome}: pessoa repetida na fila.`);
      return { ...vaga, memberIds };
    });
    planos.push({ item, show, vagas });
  }
  const totalVagas = planos.reduce((n, p) => n + p.vagas.length, 0);
  const compartilhados = [...new Set(planos.flatMap((p) => p.vagas.filter((v) => v.compartilhado).map((v) => v.nome)))];
  console.log(`Conferidos ${planos.length} shows, ${nomes.length} pessoas e ${totalVagas} vagas; compartilhados entre shows: ${compartilhados.join(", ")}.`);
  if (!aplicar) return;

  // Um personagem compartilhado é criado uma vez só e reaproveitado no segundo show: é isso que
  // faz o rodízio contar a fila entre os dois, em vez de duas filas com o mesmo nome.
  const jaCriados = new Map<string, string>();
  for (const { item, show, vagas } of planos) {
    let versao = show.version;
    const registrarVersao = async (motivo: string) => {
      versao++;
      await tx.update(showBooksTable).set({ version: versao, updatedAt: new Date() }).where(eq(showBooksTable.id, show.id));
      const snapshot = await buildShowBookTree(show.id, tx as never);
      await tx.insert(showBookVersionsTable).values({ showBookId: show.id, version: versao, changeType: "STRUCTURAL", reason: motivo, snapshot, createdBy: show.createdBy });
    };
    const [scene] = await tx.insert(showBookScenesTable).values({ showBookId: show.id, name: "Personagens do show", order: 0, isCastRoster: true }).returning();
    const [block] = await tx.insert(showBookBlocksTable).values({ showBookId: show.id, sceneId: scene!.id, name: "Personagens", order: 0, zone: "CENTRO", prefix: "PER" }).returning();
    for (const [order, vaga] of vagas.entries()) {
      let characterId = vaga.compartilhado ? jaCriados.get(vaga.nome) : undefined;
      if (!characterId) {
        const existente = vaga.compartilhado
          ? await tx.select({ id: charactersTable.id }).from(charactersTable)
            .where(and(eq(charactersTable.locationId, local.id), eq(charactersTable.name, vaga.nome), isNull(charactersTable.showBookId), eq(charactersTable.active, true)))
          : [];
        if (existente.length) characterId = existente[0]!.id;
        else {
          const [criado] = await tx.insert(charactersTable).values({
            name: vaga.nome, locationId: local.id, mode: "rodizio", active: true,
            // Compartilhado não pertence a um show: é do local, e os shows o referenciam.
            showBookId: vaga.compartilhado ? null : show.id,
          }).returning();
          characterId = criado!.id;
          await tx.insert(characterCastTable).values(vaga.memberIds.map((personId, index) => ({
            characterId: criado!.id, personId, order: index, timesDone: 0, active: true,
          })));
        }
        if (vaga.compartilhado) jaCriados.set(vaga.nome, characterId!);
      }
      const [position] = await tx.insert(showBookRolesTable).values({ showBookId: show.id, blockId: block!.id, name: vaga.nome, order }).returning();
      await tx.insert(showBookLinesTable).values({ positionId: position!.id, characterId, type: "CHARACTER", config: {}, order: 0 });
      await writeHistoryEvent({
        category: "OPERATIONAL_CHANGE", action: "show_book.vaga.created", title: "Vaga criada no show",
        narrative: `${item.show}: ${vaga.nome} (rodízio${vaga.compartilhado ? ", personagem compartilhado do local" : ""}) criada com a fila da planilha.`,
        entityType: "show_book_position", entityId: position!.id, actorType: "DETERMINISTIC_ENGINE",
        actorName: "Claude, com autorização da Administração", operationId: show.operationId, orgId,
        beforeState: null, afterState: { position, characterId, fila: vaga.memberIds, compartilhado: Boolean(vaga.compartilhado) },
        metadata: { reason: MOTIVO },
      }, tx as never);
      await registrarVersao("Vaga de personagem acrescentada");
    }
    console.log(`${LOCAL} / ${item.show}: ${vagas.length} vaga(s), Registro e versão criados.`);
  }
}

try {
  await db.transaction(async (tx) => {
    await executar(tx);
    if (ensaiar) throw new Error("ENSAIO_REVERTER");
  });
  console.log(aplicar ? "Cadastro concluído em uma transação." : "Somente leitura; nenhuma escrita realizada.");
} catch (erro) {
  if (ensaiar && (erro as Error).message === "ENSAIO_REVERTER") {
    console.log("Ensaio completo: tudo foi criado e revertido dentro da transação.");
  } else {
    console.error("Cadastro interrompido; a transação foi revertida. Causa:", (erro as Error).message);
    process.exitCode = 1;
  }
} finally {
  await pool.end();
}
