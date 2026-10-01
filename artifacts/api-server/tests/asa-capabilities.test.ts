import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getAsaPresenceState } from "../../../lib/shared/src/asa-presence.ts";
import { canManageAsaAgenda, formatAsaCapabilityReply, formatAsaCommandReply, isAsaCapabilityRequest, parseAsaAgendaDraftNotesRequest, parseAsaAgendaDraftRenameRequest, parseAsaAgendaDraftScheduleRequest, parseAsaAgendaMeetingRequest, parseAsaNoticeDraftUpdateRequest, parseAsaTaskChecklistUpdateRequest, parseAsaTaskCompletionRequest, resolveAsaAgendaSupervisorScope, resolveAsaCommand } from "../src/services/asa-command-engine.ts";
import { resolveAsaSummaryTeamOperation } from "../src/services/asa-summary-policy.ts";

const supported = [
  "Ajuda",
  "O que a ASA faz?",
  "O que a ASA consegue fazer?",
  "O que você consegue fazer?",
  "O que você sabe fazer?",
  "Como você pode me ajudar?",
  "Como uso a ASA?",
  "O que posso pedir para a ASA?",
  "Quais comandos posso usar?",
];

for (const [hour, expected] of [
  [0, "boanoite"], [4, "boanoite"], [5, "bomdia"], [11, "bomdia"],
  [12, "feliz"], [17, "feliz"], [18, "boanoite"], [23, "boanoite"],
] as const) {
  assert.equal(getAsaPresenceState(new Date(2026, 0, 1, hour)), expected, `Pose incorreta às ${hour}:00`);
}

for (const prompt of supported) {
  assert.equal(isAsaCapabilityRequest(prompt), true, `Deve reconhecer pedido de ajuda: ${prompt}`);
}

const notHelpRequests = [
  "O que você consegue fazer com a escala?",
  "Como posso ajudar a ASA?",
  "Ajuda para alterar uma tarefa",
  "Quais comandos estão pendentes?",
];

for (const prompt of notHelpRequests) {
  assert.equal(isAsaCapabilityRequest(prompt), false, `Não deve capturar pedido específico: ${prompt}`);
}

assert.deepEqual(parseAsaNoticeDraftUpdateRequest('edite o rascunho de aviso "Horário do ensaio" para "Horário atualizado" com o texto "O ensaio começa às 19h."'), {
  kind: "request", title: "Horário do ensaio", newTitle: "Horário atualizado", content: "O ensaio começa às 19h.",
});
assert.equal(parseAsaNoticeDraftUpdateRequest('edite o rascunho de aviso "Horário do ensaio" para "Título"').kind, "incomplete");
assert.equal(parseAsaNoticeDraftUpdateRequest('não edite o rascunho de aviso "Horário do ensaio" para "Título" com o texto "Texto"').kind, "not_action");
assert.equal(parseAsaNoticeDraftUpdateRequest('crie um rascunho de aviso "Título" "Texto"').kind, "not_action");

const memberReply = formatAsaCapabilityReply("MEMBER");
const directionReply = formatAsaCapabilityReply("DIR");
const supervisorReply = formatAsaCapabilityReply("SUPERVISOR_A");
assert.doesNotMatch(memberReply, /preparar tarefas|rascunhos de aviso/i);
assert.match(directionReply, /preparar tarefas/i);
assert.match(directionReply, /checklist e evidências obrigatórias/i);
assert.match(directionReply, /responsabilidade ativa existente/i);
assert.match(directionReply, /renomear um rascunho de reunião, alterar sua data, horário ou observações/i);
assert.doesNotMatch(memberReply, /alterar sua data, horário ou observações/i);
assert.equal(canManageAsaAgenda("DIR"), true);
assert.equal(canManageAsaAgenda("SUPERVISOR_A"), true);
assert.equal(canManageAsaAgenda("MEMBER"), false);
assert.doesNotMatch(directionReply, /rascunhos de aviso/i);
assert.match(supervisorReply, /preparar tarefas/i);
assert.match(supervisorReply, /rascunhos de aviso/i);
assert.match(memberReply, /concluí-la após checklist/i);
assert.match(memberReply, /proposta na própria área/i);
assert.match(memberReply, /suas propostas de reunião/i);
assert.match(memberReply, /Livros do Show visíveis na operação/i);
assert.match(memberReply, /reagir com coração a uma publicação do Mural/i);
assert.match(memberReply, /comentar em tarefa da qual seja criador, responsável ou aprovador/i);
assert.match(memberReply, /anexar um link complementar a uma tarefa no seu escopo \(não substitui evidência obrigatória\)/i);
assert.match(memberReply, /comentários de uma tarefa no seu escopo/i);
assert.match(memberReply, /comentário explícito para publicação visível no Mural após sua confirmação/i);
assert.match(supervisorReply, /Supervisão autorizada criam um rascunho/i);
assert.match(memberReply, /iniciar uma conversa direta.*só envio após sua confirmação/i);
assert.match(memberReply, /para responder, cite o título exato da conversa/i);
assert.match(memberReply, /Não envio mensagens sem sua confirmação explícita nem altero Agenda ou Escala por conta própria/i);
assert.deepEqual(parseAsaTaskCompletionRequest("conclua a tarefa ‘Separar figurinos’"), { kind: "request", title: "Separar figurinos" });
assert.deepEqual(parseAsaTaskCompletionRequest("Conclua minha tarefa Separar figurinos"), { kind: "request", title: "Separar figurinos" });
assert.deepEqual(parseAsaTaskCompletionRequest("marque a tarefa Separar figurinos como concluída."), { kind: "request", title: "Separar figurinos" });
assert.deepEqual(parseAsaTaskCompletionRequest("conclua a tarefa ‘Revisar aprovação’"), { kind: "request", title: "Revisar aprovação" });
assert.equal(parseAsaTaskCompletionRequest("marque a tarefa ‘Separar figurinos’ para aprovação").kind, "not_action");
assert.equal(parseAsaTaskCompletionRequest("marque a tarefa ‘Separar figurinos’ como não concluída").kind, "not_action");
assert.deepEqual(parseAsaAgendaMeetingRequest('Agende uma reunião "Revisão semanal" em 01/10/2026 das 14:00 às 15:00'), {
  kind: "request", title: "Revisão semanal", date: "2026-10-01", startTime: "14:00", endTime: "15:00",
});
assert.deepEqual(parseAsaAgendaMeetingRequest('Marque reunião "Revisão semanal" em 2026-10-01 das 14:00 as 15:00 na área "Cenografia" no local "Galpão"'), {
  kind: "request", title: "Revisão semanal", date: "2026-10-01", startTime: "14:00", endTime: "15:00", areaName: "Cenografia", locationName: "Galpão",
});
assert.equal(parseAsaAgendaMeetingRequest('Agende reunião "Revisão" em 31/02/2026 das 14:00 às 15:00').kind, "incomplete");
assert.equal(parseAsaAgendaMeetingRequest('Agende reunião "Revisão" em 01/10/2026 das 25:00 às 26:00').kind, "incomplete");
assert.deepEqual(parseAsaAgendaDraftRenameRequest('Renomeie o rascunho da reunião "Revisão semanal" para "Revisão de elenco"'), {
  kind: "request", title: "Revisão semanal", newTitle: "Revisão de elenco",
});
assert.equal(parseAsaAgendaDraftRenameRequest('renomeie o rascunho da reunião "Revisão" para "revisão"').kind, "incomplete");
assert.equal(parseAsaAgendaDraftRenameRequest('não renomeie o rascunho da reunião "Revisão" para "Novo nome"').kind, "not_action");
assert.equal(parseAsaAgendaDraftRenameRequest('renomeie a reunião "Revisão"').kind, "not_action");
assert.deepEqual(parseAsaAgendaDraftNotesRequest('altere as observações do rascunho da reunião "Revisão semanal" para "Levar figurinos e confirmar sala"'), {
  kind: "request", title: "Revisão semanal", notes: "Levar figurinos e confirmar sala",
});
assert.deepEqual(parseAsaAgendaDraftNotesRequest('remova as observações do rascunho da reunião "Revisão semanal"'), {
  kind: "request", title: "Revisão semanal", notes: null,
});
assert.deepEqual(parseAsaAgendaDraftNotesRequest('limpe as observações do rascunho do encontro "Revisão semanal"'), {
  kind: "request", title: "Revisão semanal", notes: null,
});
assert.equal(parseAsaAgendaDraftNotesRequest('altere as observações do rascunho da reunião "Revisão semanal"').kind, "incomplete");
assert.equal(parseAsaAgendaDraftNotesRequest('altere as observações do rascunho da reunião "Revisão semanal" para ""').kind, "incomplete");
assert.equal(parseAsaAgendaDraftNotesRequest('não altere as observações do rascunho da reunião "Revisão" para "Texto"').kind, "not_action");
assert.equal(parseAsaAgendaDraftNotesRequest('não remova as observações do rascunho da reunião "Revisão"').kind, "not_action");
assert.equal(parseAsaAgendaDraftNotesRequest(`altere as observações do rascunho da reunião "Revisão" para "${"x".repeat(2001)}"`).kind, "incomplete");
assert.deepEqual(parseAsaAgendaDraftScheduleRequest('Altere a data e o horário do rascunho da reunião "Revisão semanal" para 02/10/2026 das 09:30 às 10:15'), {
  kind: "request", title: "Revisão semanal", date: "2026-10-02", startTime: "09:30", endTime: "10:15",
});
assert.deepEqual(parseAsaAgendaDraftScheduleRequest('Mude o horário do rascunho da reunião "Revisão 01/10/2026 das 08:00 às 09:00" para 02/10/2026 das 10:00 às 11:00'), {
  kind: "request", title: "Revisão 01/10/2026 das 08:00 às 09:00", date: "2026-10-02", startTime: "10:00", endTime: "11:00",
});
assert.equal(parseAsaAgendaDraftScheduleRequest('altere o horário do rascunho da reunião "Revisão" para 01/10/2026 das 10:00 às 09:00').kind, "incomplete");
assert.equal(parseAsaAgendaDraftScheduleRequest('mude a data do rascunho da reunião "Revisão" para 31/02/2026 das 10:00 às 11:00').kind, "incomplete");
assert.equal(parseAsaAgendaMeetingRequest("Minha agenda de hoje").kind, "not_action");
assert.equal(parseAsaTaskCompletionRequest("conclua a tarefa").kind, "incomplete");
assert.deepEqual(parseAsaTaskChecklistUpdateRequest('Marque o item obrigatório da checklist "Conferir documentos" da tarefa "Fechar relatório" como concluído'), {
  kind: "request", title: "Fechar relatório", itemLabel: "Conferir documentos", checklistKind: "mandatory", completed: true,
});
assert.deepEqual(parseAsaTaskChecklistUpdateRequest('Desmarque o item operacional da checklist "Separar materiais" da tarefa "Fechar relatório" como pendente'), {
  kind: "request", title: "Fechar relatório", itemLabel: "Separar materiais", checklistKind: "operational", completed: false,
});
assert.equal(parseAsaTaskChecklistUpdateRequest('Marque o item obrigatório da checklist "Conferir documentos" da tarefa "Fechar relatório" como pendente').kind, "incomplete");
assert.match(formatAsaCapabilityReply("MEMBER"), /atualizar itens das próprias checklists/);
const authorizedScopes = [
  { areaId: "area-1", areaName: "Cenografia", locationId: "local-1", locationName: "Galpão" },
  { areaId: "area-1", areaName: "Cenografia", locationId: "local-2", locationName: "Teatro" },
];
assert.deepEqual(resolveAsaAgendaSupervisorScope(true, authorizedScopes, "cenografia", "GALPÃO"), {
  kind: "selected", scope: authorizedScopes[0],
});
assert.equal(resolveAsaAgendaSupervisorScope(true, authorizedScopes).kind, "clarification");
assert.equal(resolveAsaAgendaSupervisorScope(true, authorizedScopes, "Cenografia", "Anexo").kind, "clarification");
assert.equal(resolveAsaAgendaSupervisorScope(true, [authorizedScopes[0]!], "Outra área").kind, "clarification");
assert.equal(resolveAsaAgendaSupervisorScope(true, [authorizedScopes[0]!], undefined, "Outro local").kind, "clarification");
assert.equal(resolveAsaAgendaSupervisorScope(false, authorizedScopes, "Cenografia", "Galpão").kind, "unavailable");
assert.equal(resolveAsaAgendaSupervisorScope(true, []).kind, "unavailable");
const ownMeetingProposals = resolveAsaCommand("Quais são minhas propostas de reunião?", "2026-09-30", false, "/agenda", "MEMBER");
assert.equal(ownMeetingProposals.kind, "command");
if (ownMeetingProposals.kind === "command") {
  assert.equal(ownMeetingProposals.command.tool, "consultar_minhas_propostas_agenda");
  assert.deepEqual(ownMeetingProposals.command.input, { limit: 20 });
}
assert.match(formatAsaCommandReply("consultar_minhas_propostas_agenda", JSON.stringify({ propostas: [
  { title: "Revisão", date: "2026-10-01", startTime: "14:00:00", endTime: "15:00:00", status: "REJECTED", reason: "Conflito de horário", alternativeDetails: "Tentar à tarde" },
] })), /recusada[\s\S]*Motivo: Conflito de horário[\s\S]*Alternativa: Tentar à tarde/);

const showBookQuery = resolveAsaCommand("Quais Livros do Show estão disponíveis?", "2026-10-01", false, "/shows", "MEMBER");
assert.equal(showBookQuery.kind, "command");
if (showBookQuery.kind === "command") {
  assert.equal(showBookQuery.command.tool, "consultar_livros_do_show");
  assert.deepEqual(showBookQuery.command.input, { limit: 20 });
}
const dailyBookQuery = resolveAsaCommand("Mostra o Livro do Dia de hoje", "2026-10-01", false, "/shows", "MEMBER");
assert.equal(dailyBookQuery.kind, "command");
if (dailyBookQuery.kind === "command") assert.equal(dailyBookQuery.command.tool, "consultar_livro_do_dia");
const showBookDetail = resolveAsaCommand('Mostre a estrutura do Livro do Show "A Floresta"', "2026-10-01", false, "/shows", "MEMBER");
assert.equal(showBookDetail.kind, "command");
if (showBookDetail.kind === "command") {
  assert.equal(showBookDetail.command.tool, "consultar_livros_do_show");
  assert.deepEqual(showBookDetail.command.input, { title: "A Floresta", limit: 20 });
}
assert.equal(resolveAsaCommand("Mostre as cenas do Livro do Show", "2026-10-01", false, "/shows", "MEMBER").kind, "clarification");
assert.equal(resolveAsaCommand("O que tenho aqui?", "2026-10-01", false, "/admin/show-book", "MEMBER").kind, "command");
const showBookReply = formatAsaCommandReply("consultar_livros_do_show", JSON.stringify({ books: [
  { title: "A Floresta", status: "PUBLISHED", version: 3, locationName: "Teatro" },
] }));
assert.match(showBookReply, /A Floresta · publicado · v3 · Teatro/);
assert.doesNotMatch(showBookReply, /show-book-id|\b[0-9a-f]{8}-[0-9a-f-]{27}\b/i);
const showBookStructureReply = formatAsaCommandReply("consultar_livros_do_show", JSON.stringify({ book: {
  title: "A Floresta", totalScenes: 23, omittedScenes: 3,
  scenes: [{ name: "Abertura", totalBlocks: 3, omittedBlocks: 2, blocks: [{
    name: "Entrada", totalPositions: 3, omittedPositions: 1,
    positions: [{ name: "Narradora", minimumCoverage: 1 }, { name: "Dançarinos", minimumCoverage: 4 }],
  }] }],
} }));
assert.match(showBookStructureReply, /Estrutura de A Floresta \(1 cena\)[\s\S]*Abertura[\s\S]*Entrada — 2 posição\(ões\): Narradora, Dançarinos \(mínimo 4\); mais 1 posição\(ões\) omitida\(s\)[\s\S]*Mais 2 bloco\(s\) omitido\(s\)[\s\S]*Exibindo 1 de 23 cenas; mais 3 omitidas/);
assert.doesNotMatch(showBookStructureReply, /userId|config|show-book-id|\b[0-9a-f]{8}-[0-9a-f-]{27}\b/i);
const unassignedShowPositionReply = formatAsaCommandReply("consultar_livros_do_show", JSON.stringify({ book: {
  title: "A Floresta", totalScenes: 0, scenes: [], totalUnassignedPositions: 1,
  unassignedPositions: [{ name: "Narradora", minimumCoverage: 2 }],
} }));
assert.match(unassignedShowPositionReply, /0 cenas[\s\S]*Posições sem bloco ativo \(1\): Narradora \(mínimo 2\)/);

assert.equal(resolveAsaSummaryTeamOperation("ADMIN", "op-1", ["op-1"]), "op-1");
assert.equal(resolveAsaSummaryTeamOperation("SUPERVISOR_A", "op-1", ["op-1", "op-2"]), "op-1");
assert.equal(resolveAsaSummaryTeamOperation("SUPERVISOR_B", "op-2", ["op-1", "op-2"]), "op-2");
assert.equal(resolveAsaSummaryTeamOperation("MEMBER", "op-1", ["op-1"]), null);
assert.equal(resolveAsaSummaryTeamOperation("DIR", "op-1", ["op-1"]), null);
assert.equal(resolveAsaSummaryTeamOperation("ADMIN", "op-3", ["op-1", "op-2"]), null);
assert.equal(resolveAsaSummaryTeamOperation("ADMIN", null, ["op-1"]), null);

const webShell = readFileSync(resolve(process.cwd(), "../web-admin/src/components/shell-foundation.tsx"), "utf8");
assert.match(webShell, /<Suspense fallback=\{null\}><GlobalAsaAssistant \/><\/Suspense>/, "ASA deve estar montada no shell web autenticado");
assert.match(webShell, /active\.href === "\/biblioteca" \? <LibraryPage role=\{role\}\/>/, "Biblioteca do shell deve usar a página compartilhada ativa");
const webLibrary = readFileSync(resolve(process.cwd(), "../web-admin/src/pages/communication.tsx"), "utf8");
assert.match(webLibrary, /const search = useSearch\(\)/, "Biblioteca web deve aceitar abertura direta de documento pela URL");
assert.match(webLibrary, /customFetch<\{ document: LibraryDoc; citations\?: LibraryCitation\[\]; canManageCitations\?: boolean \}>\(`\/api\/library\/documents\/\$\{selectedDocumentId\}`\)/, "detalhe aberto pela ASA deve usar a rota oficial autenticada da Biblioteca e carregar citações e permissão efetiva");
assert.match(webLibrary, /setLocation\(`\/biblioteca\$\{queryString \? `\?\$\{queryString\}` : ""\}`\)/, "fechar detalhe deve limpar só o documento da URL e preservar o contexto da tela");
assert.match(webLibrary, /selectedDocument\.requiresConfirmation && <button className="comm-primary" onClick=\{\(\) => void confirmSelected\(\)\}>Li e entendi/, "detalhe acessado pela ASA deve manter o ciente explícito do documento");
assert.match(webLibrary, /selectedDocument\.id\}\/citations[\s\S]*canManageCitations && <section/, "gestão de citações deve estar disponível na Biblioteca ativa somente quando o servidor autoriza aquele documento");
assert.match(webLibrary, /setCitations\(result\.citations\)[\s\S]*Página \{citation\.pageNumber\}[\s\S]*Trecho exato/, "Biblioteca ativa deve exibir página/trecho e permitir cadastrar as referências da ASA");
assert.match(webLibrary, /onClick=\{\(\) => setLocation\(`\/biblioteca\?document=\$\{doc\.id\}`\)\}>Detalhes/, "pessoa gestora deve conseguir abrir o detalhe para gerir citações sem iniciar uma busca pela ASA");
const adminLibrary = readFileSync(resolve(process.cwd(), "../web-admin/src/pages/admin/library.tsx"), "utf8");
assert.match(adminLibrary, /customFetch<\{ signals:[\s\S]*?\}>\("\/api\/asa\/library-gaps"\)/, "Biblioteca administrativa deve carregar temas sem documento pela rota autenticada");
assert.match(adminLibrary, /enabled: isAdmin/, "somente Administração deve buscar os temas sem documento");
assert.match(adminLibrary, /onClick=\{\(\) => setSearch\(signal\.topic\)\}/, "tema sem documento deve permitir iniciar sua busca no acervo");
const globalAsa = readFileSync(resolve(process.cwd(), "../web-admin/src/components/global-asa-assistant.tsx"), "utf8");
assert.match(globalAsa, /setLocation\(`\/biblioteca\?document=\$\{documentId\}`\)/, "link da ASA web deve abrir o documento no shell atual, não em uma rota ausente");
const legacyAsa = readFileSync(resolve(process.cwd(), "../web-admin/src/pages/admin/asa.tsx"), "utf8");
assert.match(legacyAsa, /href=\{`\/biblioteca\?document=\$\{documentId\}`\}/, "links de mensagens ASA antigas também devem abrir no shell atual");
const mobileLayout = readFileSync(resolve(process.cwd(), "../mobile/app/_layout.tsx"), "utf8");
assert.match(mobileLayout, /segments\[0\] === "\(tabs\)" \|\| segments\[0\] === "\(stack\)"/, "ASA deve cobrir as rotas autenticadas mobile de abas e pilha");
assert.match(mobileLayout, /const showAsaLauncher = isAuthenticated && !mustChangePassword[\s\S]*segments\.join\("\/"\) !== "\(stack\)\/asa"/, "launcher mobile fica nas telas autenticadas, exceto na própria conversa ASA");
assert.match(mobileLayout, /<AsaAvatar[\s\S]*onPress=\{\(\) => router\.push\(\{ pathname: "\/\(stack\)\/asa"/, "launcher mobile deve abrir a conversa ASA");
const asaRoutes = readFileSync(resolve(process.cwd(), "./src/routes/asa.ts"), "utf8");
const showBookQueryBlock = asaRoutes.match(/if \(name === "consultar_livros_do_show"\) \{([\s\S]*?)\n    \}/);
assert.ok(showBookQueryBlock, "servidor deve implementar a consulta determinística ao Livro do Show");
assert.match(showBookQueryBlock[1]!, /eq\(showBooksTable\.operationId, ctx\.operationId\)/, "consulta do Livro do Show deve usar somente a operação selecionada");
assert.match(showBookQueryBlock[1]!, /eq\(operationsTable\.organizationId, ctx\.organizationId\)/, "consulta do Livro do Show deve permanecer na organização autenticada");
assert.match(showBookQueryBlock[1]!, /eq\(locationsTable\.organizationId, ctx\.organizationId\)/, "nome de local só pode vir da organização autenticada");
assert.match(showBookQueryBlock[1]!, /canViewShowBook\(/, "consulta deve reutilizar a política oficial de visibilidade por responsável");
assert.match(showBookQueryBlock[1]!, /ne\(showBooksTable\.status, "ARCHIVED"\)/, "Livros do Show arquivados não devem entrar na resposta");
assert.match(showBookQueryBlock[1]!, /normalizeAsaText\(book\.title\) === normalizeAsaText\(input\.title as string\)/, "detalhe do Livro do Show deve exigir correspondência exata e visível do título");
assert.match(showBookQueryBlock[1]!, /showBookScenesTable[\s\S]*showBookBlocksTable[\s\S]*showBookRolesTable/, "detalhe deve retornar apenas a estrutura de cenas, blocos e posições");
assert.match(showBookQueryBlock[1]!, /positionsWithoutActiveBlock[\s\S]*unassignedPositions/, "detalhe deve preservar posições sem bloco ativo");
assert.doesNotMatch(showBookQueryBlock[1]!, /showBookLinesTable|config\s*:/, "detalhe não deve expor configurações de elenco ou linhas internas");
const libraryQueryBlock = asaRoutes.match(/if \(name === "consultar_biblioteca"\) \{([\s\S]*?)\n    \}/);
assert.ok(libraryQueryBlock, "servidor deve implementar a pesquisa da Biblioteca pela ASA");
assert.match(libraryQueryBlock[1]!, /listReadableLocations\(/, "busca por local deve resolver locais acessíveis pela política oficial");
assert.match(libraryQueryBlock[1]!, /normalizeAsaText\(location\.name\) === normalizeAsaText\(input\.locationName as string\)/, "busca por local deve exigir nome exato e não ambíguo");
assert.match(libraryQueryBlock[1]!, /document\.scopeType !== "LOCATION" \|\| document\.locationId === selectedLocation!\.id/, "busca contextual não pode incluir documentos de outros locais");
assert.match(libraryQueryBlock[1]!, /canReadLibraryScope\(document, fullReader, areaId\)/, "busca por local deve preservar o escopo geral oficial da Biblioteca");
assert.match(libraryQueryBlock[1]!, /version: libraryDocumentsTable\.version[\s\S]*tags:\s+libraryDocumentsTable\.tags[\s\S]*categoryName: libraryCategoriesTable\.name/, "resultado da Biblioteca deve carregar versão, tags e categoria do documento");
assert.match(libraryQueryBlock[1]!, /\.leftJoin\(libraryCategoriesTable, and\([\s\S]*eq\(libraryCategoriesTable\.orgId, ctx\.organizationId\)[\s\S]*eq\(libraryCategoriesTable\.active, true\)/, "busca de categoria deve ser limitada à organização autenticada e categorias ativas");
assert.match(libraryQueryBlock[1]!, /d\.categoryName \?\? "", \.\.\.d\.tags/, "busca deve considerar categoria e tags além do corpo textual");
assert.match(libraryQueryBlock[1]!, /libraryDocumentPageCitationsTable\.documentId[\s\S]*libraryDocumentPageCitationsTable\.version/, "busca deve ler citações vinculadas ao documento e versão atuais");
assert.match(libraryQueryBlock[1]!, /selectAsaLibraryCitation\(query, currentCitations\.get\(d\.id\)/, "resposta deve usar apenas trecho paginado correspondente à pergunta");
assert.doesNotMatch(libraryQueryBlock[1]!, /excerpt:\s*d\.body|summary:\s*d\.summary/, "busca não deve retornar texto sem âncora como resposta citada");
const libraryRoutes = readFileSync(resolve(process.cwd(), "./src/routes/library.ts"), "utf8");
const libraryCitationsRoute = libraryRoutes.match(/router\.put\("\/library\/documents\/:id\/citations"([\s\S]*?)\n\}\);/);
assert.ok(libraryCitationsRoute, "gestão deve permitir cadastrar citações por página");
assert.match(libraryCitationsRoute[1]!, /MANAGER_ROLES[\s\S]*canManageDocumentScope[\s\S]*payload\.version !== doc\.version/, "edição de citações deve respeitar papel, escopo e versão atual");
assert.match(libraryRoutes, /body !== undefined && body !== doc\.body[\s\S]*delete\(libraryDocumentPageCitationsTable\)/, "edição do texto deve invalidar âncoras antigas");
assert.match(libraryRoutes, /delete\(libraryDocumentPageCitationsTable\)[\s\S]*doc\.version/, "substituição do PDF deve invalidar citações da versão corrente");
assert.match(libraryRoutes, /const canManageCitations = doc\.status !== "ARCHIVED" && await canManageDocumentScope\(role, userId, doc\)[\s\S]*canManageCitations \}\)/, "detalhe da Biblioteca deve devolver a autorização de escrita específica para o documento");
const libraryCitationsMigration = readFileSync(resolve(process.cwd(), "../../lib/db/drizzle/0052_library_page_citations.sql"), "utf8");
assert.match(libraryCitationsMigration, /document_id uuid NOT NULL REFERENCES library_documents\(id\) ON DELETE CASCADE/, "citações devem acompanhar o ciclo de vida do documento");
assert.match(libraryCitationsMigration, /version integer NOT NULL CHECK \(version > 0\)[\s\S]*page_number integer NOT NULL CHECK \(page_number > 0\)/, "migração deve impedir versões e páginas inválidas");
assert.match(libraryCitationsMigration, /length\(btrim\(excerpt\)\) BETWEEN 8 AND 1000/, "migração deve limitar o conteúdo de cada citação");
assert.match(libraryCitationsMigration, /ENABLE ROW LEVEL SECURITY[\s\S]*REVOKE ALL[\s\S]*anon, authenticated, PUBLIC/, "citações devem manter RLS e sem acesso direto pelos papéis da aplicação");
const libraryGapsRoute = asaRoutes.match(/router\.get\("\/asa\/library-gaps"([\s\S]*?)\n\}\);/);
assert.ok(libraryGapsRoute, "Administração deve ter uma rota para sinais agregados de temas sem documento");
assert.match(libraryGapsRoute[1]!, /user\.role !== "ADMIN"/, "sinais de lacuna da Biblioteca devem ser exclusivos de Administração");
assert.match(libraryGapsRoute[1]!, /organizationId, user\.organizationId![\s\S]*gte\(asaAuditLogTable\.createdAt, since\)/, "sinais devem ficar isolados por organização e limitados ao período recente");
assert.match(libraryGapsRoute[1]!, /select\(\{ actionsExecuted: asaAuditLogTable\.actionsExecuted, createdAt: asaAuditLogTable\.createdAt \}\)/, "rota de lacunas não deve ler identidade, conversa ou pergunta original");
assert.match(libraryGapsRoute[1]!, /aggregateAsaLibraryGaps\(rows, 50\)/, "rota deve devolver temas agregados e limitados");
const pendingLibraryReadsBlock = asaRoutes.match(/if \(name === "consultar_minhas_leituras_pendentes_biblioteca"\) \{([\s\S]*?)\n    \}/);
assert.ok(pendingLibraryReadsBlock, "ASA deve consultar as leituras obrigatórias pendentes da própria pessoa");
assert.match(pendingLibraryReadsBlock[1]!, /eq\(libraryDocumentsTable\.orgId, ctx\.organizationId\)[\s\S]*inArray\(libraryDocumentsTable\.status, \["PUBLISHED", "UPDATED"\]\)[\s\S]*eq\(libraryDocumentsTable\.requiresConfirmation, true\)[\s\S]*isNull\(libraryDocumentsTable\.archivedAt\)/, "consulta deve limitar-se a documentos obrigatórios publicados e não arquivados da organização");
assert.match(pendingLibraryReadsBlock[1]!, /canReadLibraryScope\(document, fullReader, areaId\)/, "consulta deve aplicar a política oficial de escopo da Biblioteca");
assert.match(pendingLibraryReadsBlock[1]!, /eq\(libraryViewsTable\.orgId, ctx\.organizationId\)[\s\S]*eq\(libraryViewsTable\.userId, ctx\.userId\)[\s\S]*isNotNull\(libraryViewsTable\.confirmedAt\)/, "só pode descontar confirmações próprias, explícitas e da mesma organização");
assert.doesNotMatch(pendingLibraryReadsBlock[1]!, /insert\(|update\(/, "consulta de pendências não deve gravar nem confirmar leituras");
const activeOperationRoleBlock = asaRoutes.match(/async function activeAsaRoleForOperation\(([\s\S]*?)\n\}/);
assert.ok(activeOperationRoleBlock, "servidor deve resolver o papel ativo por operação");
assert.match(activeOperationRoleBlock[1]!, /eq\(userRolesTable\.active, true\)[\s\S]*eq\(operationsTable\.status, "ACTIVE"\)/, "papel de gestão só pode vir de vínculo e operação ativos");
assert.match(activeOperationRoleBlock[1]!, /eq\(operationsTable\.organizationId, organizationId\)/, "papel deve pertencer à organização pedida");
assert.match(activeOperationRoleBlock[1]!, /eq\(userRolesTable\.operationId, operationId\)/, "papel deve pertencer à operação pedida");
const taskCommentsQueryBlock = asaRoutes.match(/if \(taskCommentsQuery\.kind === "request"\) \{([\s\S]*?)\n    \} else if \(taskComment\.kind === "incomplete"\)/);
assert.ok(taskCommentsQueryBlock, "servidor deve implementar a consulta direta de comentários de tarefa");
assert.match(taskCommentsQueryBlock[1]!, /activeAsaRoleForOperation\(user\.sub, user\.organizationId!, operationSelection\.operationId\)/, "consulta deve revalidar o papel na operação selecionada");
assert.match(taskCommentsQueryBlock[1]!, /eq\(tasksTable\.organizationId, user\.organizationId!\)[\s\S]*eq\(tasksTable\.operationId, operationSelection\.operationId\)[\s\S]*eq\(tasksTable\.title, taskCommentsQuery\.title\)/, "consulta deve filtrar organização, operação e título exato");
assert.match(taskCommentsQueryBlock[1]!, /canManageTasks\([\s\S]*\[task\.creatorId, task\.assigneeId, task\.approverId\]\.includes\(user\.sub\)/, "consulta deve limitar leitura a gestores autorizados ou pessoas envolvidas");
assert.match(taskCommentsQueryBlock[1]!, /taskCommentsTable\.body[\s\S]*taskCommentsTable\.createdAt[\s\S]*usersTable\.name[\s\S]*\.limit\(10\)/, "consulta só pode devolver autor, data e até 10 comentários");
assert.match(taskCommentsQueryBlock[1]!, /action: "ASA_TASK_COMMENTS_READ", taskId: task\.id, count: comments\.length/, "leitura deve registrar apenas tarefa e contagem na auditoria");
assert.doesNotMatch(taskCommentsQueryBlock[1]!, /actionsExecuted\.push\(\{[^}]*body:/, "auditoria da leitura não deve copiar o texto do comentário");
const taskEvidenceLinkBlock = asaRoutes.match(/if \(taskEvidenceLink\.kind === "request"\) \{([\s\S]*?)\n    \} else if \(taskCommentsQuery\.kind === "incomplete"\)/);
assert.ok(taskEvidenceLinkBlock, "servidor deve implementar a prévia de link de evidência complementar");
assert.match(taskEvidenceLinkBlock[1]!, /activeAsaRoleForOperation[\s\S]*eq\(tasksTable\.organizationId, user\.organizationId!\)[\s\S]*eq\(tasksTable\.operationId, operationSelection\.operationId\)[\s\S]*eq\(tasksTable\.title, taskEvidenceLink\.title\)/, "prévia deve revalidar papel ativo e escopo da tarefa");
assert.match(taskEvidenceLinkBlock[1]!, /task\.creatorId === user\.sub \|\| task\.assigneeId === user\.sub/, "prévia da evidência deve restringir pessoas envolvidas ou gestão autorizada");
assert.match(taskEvidenceLinkBlock[1]!, /evidenceType: "LINK"[\s\S]*evidenceDescription: taskEvidenceLink\.description/, "prévia deve restringir a um link complementar descrito");
const taskChecklistPreviewBlock = asaRoutes.match(/if \(taskChecklistUpdate\.kind === "request"\) \{([\s\S]*?)\n    \} else if \(taskEvidenceLink\.kind === "incomplete"\)/);
assert.ok(taskChecklistPreviewBlock, "servidor deve preparar atualização de checklist pela pessoa responsável");
assert.match(taskChecklistPreviewBlock[1]!, /eq\(tasksTable\.organizationId, user\.organizationId!\)[\s\S]*eq\(tasksTable\.operationId, operationSelection\.operationId\)[\s\S]*eq\(tasksTable\.title, taskChecklistUpdate\.title\)/, "prévia deve localizar tarefa por organização, operação e título exato");
assert.match(taskChecklistPreviewBlock[1]!, /task\.assigneeId === user\.sub/, "somente a pessoa responsável pode atualizar item de checklist");
assert.match(taskChecklistPreviewBlock[1]!, /checklistItemId: items\[0\]!\.id[\s\S]*expectedChecklist: JSON\.stringify\(checklist\)/, "prévia deve capturar item exato e snapshot do checklist");
const taskChecklistConfirmBlock = asaRoutes.match(/if \(proposal\.actionType === "TASK_CHECKLIST_UPDATE"\) \{([\s\S]*?)\n      \}\n\n      if \(proposal\.actionType === "TASK_EVIDENCE_LINK_ADD"\)/);
assert.ok(taskChecklistConfirmBlock, "confirmação da checklist deve ter ramo transacional próprio");
assert.match(taskChecklistConfirmBlock[1]!, /\.for\("update"\)[\s\S]*task\.assigneeId !== user\.sub[\s\S]*checklistSnapshotMatches/, "confirmação deve revalidar responsável e snapshot sob bloqueio");
assert.match(taskChecklistConfirmBlock[1]!, /operationalChecklist: updatedChecklist[\s\S]*writeHistoryEvent\([\s\S]*task\.checklist_item_updated[\s\S]*confirmedByUser: true/, "checklist, Histórico e auditoria devem confirmar juntos sem misturar requisitos obrigatórios");
const taskEvidenceConfirmBlock = asaRoutes.match(/if \(proposal\.actionType === "TASK_EVIDENCE_LINK_ADD"\) \{([\s\S]*?)\n      \}\n\n      if \(proposal\.actionType === "TASK_COMMENT_CREATE"\)/);
assert.ok(taskEvidenceConfirmBlock, "confirmação do link de evidência deve ser transacional e independente");
assert.match(taskEvidenceConfirmBlock[1]!, /\.for\("update"\)[\s\S]*task\.updatedAt\.toISOString\(\) !== expectedUpdatedAt/, "confirmação deve bloquear e comparar a versão da tarefa");
assert.match(taskEvidenceConfirmBlock[1]!, /type: "LINK", url: parsedUrl\.toString\(\),[\s\S]*isRequired: false, mandatoryEvidenceRefId: null/, "link ASA não pode satisfazer uma evidência obrigatória");
assert.match(taskEvidenceConfirmBlock[1]!, /writeHistoryEvent\([\s\S]*action: "task\.evidence_added"[\s\S]*confirmedByUser: true/, "evidência, Histórico e auditoria devem confirmar juntos");
const proposalTypeBlock = asaRoutes.match(/const ASA_PROPOSAL_ACTION_TYPES = new Set\(\[([\s\S]*?)\]\);/);
assert.ok(proposalTypeBlock, "servidor deve declarar o conjunto de tipos de proposta recuperáveis");
const serverProposalTypes = [...proposalTypeBlock[1]!.matchAll(/"([A-Z][A-Z0-9_]*)"/g)].map((match) => match[1]!);
const webAssistant = readFileSync(resolve(process.cwd(), "../web-admin/src/components/global-asa-assistant.tsx"), "utf8");
assert.match(webAssistant, /"\/livro-do-dia": \["O que tenho aqui\?", "Mostra o Livro do Dia de hoje"\]/, "Livro do Dia do shell deve sugerir sua consulta contextual implementada");
assert.match(webAssistant, /"\/check-in": \["O que tenho aqui\?", "Meu check-in hoje"\]/, "Check-in do shell deve sugerir a consulta pessoal implementada");
assert.match(webAssistant, /"\/agenda": \["O que tenho aqui\?", "Mostra a agenda"/, "Agenda do shell deve oferecer uma sugestão reconhecida pelo motor");
assert.match(webAssistant, /"\/admin\/responsabilidades-delegacoes": \["O que tenho aqui\?", "Mostre as responsabilidades da equipe"/, "tela administrativa de Responsabilidades deve oferecer consulta de equipe protegida por escopo");
const webPageSuggestionsBlock = webAssistant.match(/const pageSuggestions: Record<string, string\[]> = \{([\s\S]*?)\n\};/);
assert.ok(webPageSuggestionsBlock, "assistente web deve declarar sugestões vinculadas às telas");
const webPageSuggestions = [...webPageSuggestionsBlock[1]!.matchAll(/^\s*"([^\"]+)": \[(.*?)\],?$/gm)];
assert.ok(webPageSuggestions.length > 0, "assistente web deve ter sugestões contextuais configuradas");
for (const [, page, rawSuggestions] of webPageSuggestions) {
  const prompts = [...rawSuggestions!.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((match) => JSON.parse(`"${match[1]}"`) as string);
  assert.ok(prompts.length > 0, `${page}: deve haver ao menos uma sugestão`);
  for (const prompt of prompts) {
    const isSupervisor = page!.startsWith("/supervisor/");
    const isAdmin = page!.startsWith("/admin/");
    const resolution = resolveAsaCommand(prompt, "2026-10-01", isSupervisor || isAdmin, page!, isSupervisor ? "SUPERVISOR_A" : isAdmin ? "ADMIN" : "MEMBER");
    assert.ok(
      resolution.kind === "command" || resolution.kind === "clarification",
      `${page}: a sugestão ${JSON.stringify(prompt)} deve executar uma consulta conhecida ou pedir esclarecimento, recebeu ${resolution.kind}`,
    );
  }
}
const mobileAssistant = readFileSync(resolve(process.cwd(), "../mobile/app/(stack)/asa.tsx"), "utf8");
const mobilePageContextBlock = mobileAssistant.match(/const ASA_PAGE_CONTEXT: Record<string, string> = \{([\s\S]*?)\n\};/);
assert.ok(mobilePageContextBlock, "mobile deve declarar o mapa de contexto da tela de origem");
const mobilePageContexts = [...mobilePageContextBlock[1]!.matchAll(/"([^\"]+)": "([^\"]+)"/g)];
assert.deepEqual(
  mobilePageContexts.map((match) => match[1]!).sort(),
  [
    "(stack)/agenda", "(stack)/daily-book", "(stack)/folgas", "(stack)/index",
    "(stack)/insights", "(stack)/biblioteca", "(stack)/responsabilidades",
    "(stack)/scale", "(stack)/show-book", "(stack)/solicitacoes", "(stack)/tarefas", "(stack)/entregas",
    "(stack)/notificacoes", "(tabs)/avisos", "(tabs)/meu-dia", "(tabs)/mensagens",
  ].sort(),
  "cada tela móvel atualmente mapeada para consultas contextuais deve continuar coberta",
);
for (const [route, page] of mobilePageContexts.map((match) => [match[1]!, match[2]!] as const)) {
  const isSupervisor = page.startsWith("/supervisor/");
  const isAdmin = page.startsWith("/admin/");
  const resolution = resolveAsaCommand(
    "O que tenho aqui?",
    "2026-10-01",
    isSupervisor || isAdmin,
    page,
    isSupervisor ? "SUPERVISOR_A" : isAdmin ? "ADMIN" : "MEMBER",
  );
  assert.ok(
    resolution.kind === "command" || resolution.kind === "clarification",
    `${route} (${page}) deve executar uma consulta conhecida ou pedir o dado que falta`,
  );
}
assert.equal(resolveAsaCommand("O que tenho aqui?", "2026-10-01", false, "/folgas", "MEMBER").kind, "command");
assert.equal(resolveAsaCommand("O que tenho aqui?", "2026-10-01", true, "/folgas", "SUPERVISOR_A").kind, "command");
const genericDraftTypes = ["NOTICE_DRAFT_CREATE"];
for (const [client, source] of [["web", webAssistant], ["mobile", mobileAssistant]] as const) {
  const missing = serverProposalTypes.filter((type) => !source.includes(`"${type}"`));
  assert.deepEqual(missing, genericDraftTypes, `${client}: cada tipo de proposta deve ter UI explícita ou fallback genérico aprovado`);
}
assert.match(webAssistant, /titles\[actionType\] \?\? "Rascunho"\} · \$\{operationName\}/, "web precisa manter um cartão genérico identificável para criar aviso");
assert.match(mobileAssistant, /\?\? "Criar rascunho"/, "mobile precisa manter confirmação genérica para criar aviso");

console.log(`ASA capabilities: ${supported.length} pedidos de ajuda, ${notHelpRequests.length} frases fora do escopo, permissões de três perfis, escopo do resumo diário e presença global web/mobile validados.`);
