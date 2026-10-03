import assert from "node:assert/strict";
import { selectAsaSuggestions } from "@workspace/shared";
import { formatAsaCapabilityReply, formatAsaCommandReply, formatAsaTaskCommentsReply, isAsaCapabilityRequest, isAsaUnrecognizedCommandResolution, normalizeAsaText, parseAsaAgendaMeetingRequest, parseAsaDirectMessageRequest, parseAsaLearningApproval, parseAsaLearningRequest, parseAsaLibrarySearchRequest, parseAsaMessageReplyRequest, parseAsaMuralAckRequest, parseAsaMuralCommentRequest, parseAsaMuralReactionRequest, parseAsaNoticeDraftRequest, parseAsaNoticeDraftUpdateRequest, parseAsaTaskAssigneeUpdate, parseAsaTaskCancellationRequest, parseAsaTaskChecklistUpdateRequest, parseAsaTaskCommentRequest, parseAsaTaskCommentsQuery, parseAsaTaskCompletionRequest, parseAsaTaskDescriptionUpdate, parseAsaTaskDraftRequest, parseAsaTaskDueDateUpdate, parseAsaTaskEvidenceLinkRequest, parseAsaTaskPriorityUpdate, parseAsaTaskRequirementsUpdate, parseAsaTaskResponsibilityUpdate, parseAsaTaskStartRequest, parseAsaTaskSubmitForApprovalRequest, parseAsaTaskTitleUpdate, parseAsaUnrecognizedReviewRequest, resolveAsaAgendaSupervisorScope, resolveAsaCommand, resolveAsaOperationSelection } from "../src/services/asa-command-engine.ts";
import { formatAsaPreferenceValue, parseAsaModeCommand, parseAsaPreferenceCommand, parseAsaPreferencePatch } from "../src/services/asa-preferences.ts";
import { checkInPeriodDates, summarizeCheckIns } from "../src/services/checkin-insights.ts";
import { summarizeTasks, taskPeriodDates } from "../src/services/task-insights.ts";

assert.equal(normalizeAsaText("QUAL É minha escala?"), "qual e minha escala");
assert.equal(parseAsaUnrecognizedReviewRequest("Quais pedidos você não reconheceu?"), true);
assert.equal(parseAsaUnrecognizedReviewRequest("Mostre minhas frases não reconhecidas"), true);
assert.equal(parseAsaUnrecognizedReviewRequest("minhas mensagens não lidas"), false);
assert.equal(isAsaCapabilityRequest("O que você consegue fazer?"), true);
assert.equal(isAsaCapabilityRequest("Como você pode me ajudar?"), true);
assert.equal(isAsaCapabilityRequest("quais comandos posso usar"), true);
assert.equal(isAsaCapabilityRequest("o que você consegue fazer com a escala"), false);
assert.match(formatAsaCapabilityReply("MEMBER"), /o que falta para concluir as suas/i);
assert.doesNotMatch(formatAsaCapabilityReply("MEMBER"), /preparar tarefas|rascunhos de aviso/i);
assert.match(formatAsaCapabilityReply("DIR"), /preparar tarefas/i);
assert.doesNotMatch(formatAsaCapabilityReply("DIR"), /rascunhos de aviso/i);
assert.match(formatAsaCapabilityReply("SUPERVISOR_A"), /rascunhos de aviso/i);
assert.match(formatAsaCapabilityReply("SUPERVISOR_A"), /editar rascunhos de aviso/i);
assert.doesNotMatch(formatAsaCapabilityReply("MEMBER"), /editar rascunhos de aviso/i);
assert.equal(isAsaUnrecognizedCommandResolution(resolveAsaCommand("previsão de meteoros", "2026-09-30", false)), true);
assert.equal(isAsaUnrecognizedCommandResolution(resolveAsaCommand("tarefas da equipe", "2026-09-30", false)), false);
const suggestionSet = ["Meu Dia", "Tarefas", "Mensagens"];
assert.deepEqual(selectAsaSuggestions(suggestionSet, "SILENT", "REALTIME", "HIGH", null, 10), []);
assert.deepEqual(selectAsaSuggestions(suggestionSet, "BALANCED", "REALTIME", "HIGH", null, 10), ["Meu Dia"]);
assert.deepEqual(selectAsaSuggestions(suggestionSet, "PROACTIVE", "REALTIME", "HIGH", null, 10), suggestionSet);
assert.deepEqual(selectAsaSuggestions(suggestionSet, "PROACTIVE", "DAILY", "HIGH", 10, 10 + 60_000), []);
assert.deepEqual(selectAsaSuggestions(suggestionSet, "PROACTIVE", "DAILY", "MEDIUM", 10, 10 + 86_400_000), ["Meu Dia", "Tarefas"]);
assert.deepEqual(selectAsaSuggestions(suggestionSet, "PROACTIVE", "WEEKLY", "LOW", 10, 10 + 60_000), []);
assert.deepEqual(parseAsaPreferencePatch({ mode: "PROACTIVE", messageFrequency: "WEEKLY", proactivityLevel: "HIGH", morningGreeting: false, goodMorningTime: "08:30" }), {
  ok: true, value: { mode: "PROACTIVE", messageFrequency: "WEEKLY", proactivityLevel: "HIGH", morningGreeting: false, goodMorningTime: "08:30" },
});
assert.equal(parseAsaPreferencePatch({ userId: "other-user", mode: "SILENT" }).ok, false);
assert.equal(parseAsaPreferencePatch({ mode: "ALWAYS" }).ok, false);
assert.equal(parseAsaPreferencePatch({ reminders: "false" }).ok, false);
assert.equal(parseAsaPreferencePatch({ goodNightTime: "25:00" }).ok, false);
assert.deepEqual(parseAsaModeCommand("Pause minhas sugestões da ASA"), { kind: "request", mode: "SILENT" });
assert.deepEqual(parseAsaModeCommand("Retome as sugestões da ASA"), { kind: "request", mode: "BALANCED" });
assert.deepEqual(parseAsaModeCommand("Ative sugestões proativas da ASA"), { kind: "request", mode: "PROACTIVE" });
assert.equal(parseAsaModeCommand("pause as sugestões").kind, "incomplete");
assert.equal(parseAsaModeCommand("não pause minhas sugestões da ASA").kind, "not_action");
assert.equal(parseAsaModeCommand("quero entender como pausar sugestões").kind, "not_action");
assert.deepEqual(parseAsaPreferenceCommand("Desative a saudação da manhã"), { kind: "request", patch: { morningGreeting: false } });
assert.deepEqual(parseAsaPreferenceCommand("Mude a frequência da ASA para semanal"), { kind: "request", patch: { messageFrequency: "WEEKLY" } });
assert.deepEqual(parseAsaPreferenceCommand("Altere o horário da saudação da noite para 21:30"), { kind: "request", patch: { goodNightTime: "21:30" } });
assert.deepEqual(parseAsaPreferenceCommand("Mude o modo da ASA para proativo"), { kind: "request", patch: { mode: "PROACTIVE" } });
assert.equal(parseAsaPreferenceCommand("Altere o horário da saudação da noite para 25:30").kind, "incomplete");
assert.equal(parseAsaPreferenceCommand("não desative meus lembretes da ASA").kind, "not_action");
for (const command of [
  'Altere a responsabilidade da tarefa "Inventário" para "Fechamento"',
  'Mude o prazo da tarefa "Preferências da ASA" para 03/10/2026',
  'Altere o título do aviso "Saudação da manhã" para "Boas-vindas"',
  'Defina o responsável da tarefa "Notificações da ASA" para "Ana"',
]) assert.equal(parseAsaPreferenceCommand(command).kind, "not_action", command);
assert.equal(parseAsaPreferenceCommand("Mude a frequência da ASA").kind, "incomplete");
assert.equal(formatAsaPreferenceValue("goodNightTime", null), "Não definido");
assert.deepEqual(parseAsaPreferenceCommand("Ative a saudação da manhã"), { kind: "request", patch: { morningGreeting: true } });
assert.deepEqual(parseAsaPreferenceCommand("Desative a saudação da noite"), { kind: "request", patch: { eveningGreeting: false } });
assert.deepEqual(parseAsaPreferenceCommand("Ative meus lembretes da ASA"), { kind: "request", patch: { reminders: true } });
assert.deepEqual(parseAsaPreferenceCommand("Ative alertas de aniversário"), { kind: "request", patch: { birthdayAlerts: true } });
assert.deepEqual(parseAsaPreferenceCommand("Desative notificações da ASA"), { kind: "request", patch: { notificationsEnabled: false } });
assert.deepEqual(parseAsaPreferenceCommand("Mude a frequência da ASA para tempo real"), { kind: "request", patch: { messageFrequency: "REALTIME" } });
assert.deepEqual(parseAsaPreferenceCommand("Mude a frequência da ASA para diária"), { kind: "request", patch: { messageFrequency: "DAILY" } });
assert.deepEqual(parseAsaPreferenceCommand("Defina a proatividade da ASA como baixa"), { kind: "request", patch: { proactivityLevel: "LOW" } });
assert.deepEqual(parseAsaPreferenceCommand("Defina a proatividade da ASA como média"), { kind: "request", patch: { proactivityLevel: "MEDIUM" } });
assert.deepEqual(parseAsaPreferenceCommand("Altere o horário da saudação da manhã para 08:15"), { kind: "request", patch: { goodMorningTime: "08:15" } });
assert.deepEqual(parseAsaLearningRequest("ensine que ‘minha semana’ significa ‘minha escala desta semana’"), {
  kind: "proposal", phrase: "minha semana", target: "minha escala desta semana",
});
assert.equal(parseAsaLearningRequest("aprenda um atalho").kind, "incomplete");
assert.deepEqual(parseAsaLearningApproval("aprovo o atalho ‘minha semana’"), { kind: "approval", phrase: "minha semana" });
assert.equal(parseAsaLearningApproval("sim").kind, "not_approval");
assert.deepEqual(parseAsaDirectMessageRequest('Crie uma conversa com "Ana Souza" com o título "Troca de horário" e a mensagem "Você pode conversar comigo amanhã?"'), {
  kind: "proposal", recipientName: "Ana Souza", title: "Troca de horário", content: "Você pode conversar comigo amanhã?",
});
assert.equal(parseAsaDirectMessageRequest('Envie uma mensagem para “Ana Souza” com o título “Aviso”').kind, "incomplete");
assert.equal(parseAsaDirectMessageRequest('Minhas mensagens com “Ana Souza”').kind, "not_action");
assert.equal(parseAsaDirectMessageRequest('Crie uma conversa com "Ana" com o título "Oi" e a mensagem "Olá" e "extra"').kind, "incomplete");
assert.deepEqual(parseAsaMessageReplyRequest('Responda na conversa "Troca de horário" com a mensagem "Confirmado para amanhã."'), {
  kind: "proposal", threadTitle: "Troca de horário", content: "Confirmado para amanhã.",
});
assert.equal(parseAsaMessageReplyRequest('Responda na conversa "Troca de horário"').kind, "incomplete");
assert.equal(parseAsaMessageReplyRequest('Minhas mensagens na conversa "Troca de horário"').kind, "not_action");
assert.deepEqual(parseAsaMuralAckRequest('Dê ciente do aviso “Reunião geral”'), { kind: "request", title: "Reunião geral" });
assert.deepEqual(parseAsaMuralAckRequest('Registre minha leitura do aviso "Mudança de horário"'), { kind: "request", title: "Mudança de horário" });
assert.equal(parseAsaMuralAckRequest("dê ciente do aviso").kind, "incomplete");
assert.equal(parseAsaMuralAckRequest('não dê ciente do aviso "Reunião geral"').kind, "not_action");
assert.equal(parseAsaMuralAckRequest('dê ciente do aviso "A" e "B"').kind, "incomplete");
assert.deepEqual(parseAsaMuralReactionRequest('Reaja ao aviso "Reunião geral"'), { kind: "request", title: "Reunião geral" });
assert.deepEqual(parseAsaMuralReactionRequest('Curta a publicação “Mudança de horário”'), { kind: "request", title: "Mudança de horário" });
assert.equal(parseAsaMuralReactionRequest("reaja ao aviso").kind, "incomplete");
assert.equal(parseAsaMuralReactionRequest('não reaja ao aviso "Reunião geral"').kind, "not_action");
assert.equal(parseAsaMuralReactionRequest('mostre a reação no aviso "Reunião geral"').kind, "not_action");
assert.deepEqual(parseAsaMuralCommentRequest('Comente na publicação "Reunião geral" com o comentário "Estarei presente."'), {
  kind: "request", title: "Reunião geral", content: "Estarei presente.",
});
assert.equal(parseAsaMuralCommentRequest('Comente na publicação "Reunião geral"').kind, "incomplete");
assert.equal(parseAsaMuralCommentRequest('não comente na publicação "Reunião geral" com o comentário "Ok"').kind, "not_action");
assert.equal(parseAsaMuralCommentRequest('Meus comentários no Mural').kind, "not_action");
assert.deepEqual(parseAsaTaskStartRequest("Inicie a tarefa ‘Separar figurinos’"), { kind: "request", title: "Separar figurinos" });
assert.equal(parseAsaTaskStartRequest("inicie minha tarefa").kind, "incomplete");
assert.deepEqual(parseAsaTaskSubmitForApprovalRequest("Envie a tarefa ‘Separar figurinos’ para aprovação"), { kind: "request", title: "Separar figurinos" });
assert.deepEqual(parseAsaTaskSubmitForApprovalRequest("Marque a tarefa ‘Separar figurinos’ como pronta para aprovar"), { kind: "request", title: "Separar figurinos" });
assert.equal(parseAsaTaskSubmitForApprovalRequest("envie minha tarefa para aprovação").kind, "incomplete");
assert.equal(parseAsaTaskSubmitForApprovalRequest("conclua a tarefa ‘Separar figurinos’").kind, "not_action");
assert.deepEqual(parseAsaTaskCompletionRequest("conclua a tarefa ‘Separar figurinos’"), { kind: "request", title: "Separar figurinos" });
assert.deepEqual(parseAsaTaskCompletionRequest("marque a tarefa \"Revisar estoque\" como concluída"), { kind: "request", title: "Revisar estoque" });
assert.deepEqual(parseAsaTaskCompletionRequest("Conclua minha tarefa Separar figurinos"), { kind: "request", title: "Separar figurinos" });
assert.deepEqual(parseAsaTaskCompletionRequest("marque a tarefa Separar figurinos como concluída."), { kind: "request", title: "Separar figurinos" });
assert.deepEqual(parseAsaTaskCompletionRequest("conclua a tarefa ‘Revisar aprovação’"), { kind: "request", title: "Revisar aprovação" });
assert.equal(parseAsaTaskCompletionRequest("conclua a tarefa").kind, "incomplete");
assert.deepEqual(parseAsaTaskCancellationRequest('Cancele a tarefa "Revisar figurinos" motivo "A atividade foi cancelada pela produção"'), {
  kind: "request", title: "Revisar figurinos", reason: "A atividade foi cancelada pela produção",
});
assert.equal(parseAsaTaskCancellationRequest('Cancele a tarefa "Revisar figurinos"').kind, "incomplete");
assert.equal(parseAsaTaskCancellationRequest('Cancele a tarefa "Revisar figurinos" motivo').kind, "incomplete");
assert.equal(parseAsaTaskCancellationRequest('Cancele a proposta "Revisar figurinos"').kind, "not_action");
assert.equal(parseAsaTaskCancellationRequest(`Cancele a tarefa "Tarefa" motivo "${"x".repeat(501)}"`).kind, "incomplete");
assert.deepEqual(parseAsaTaskCommentRequest('Comente na tarefa "Revisar figurinos" com o texto "Ajustei o inventário."'), {
  kind: "request", title: "Revisar figurinos", content: "Ajustei o inventário.",
});
assert.equal(parseAsaTaskCommentRequest('Comente na tarefa "Revisar figurinos"').kind, "incomplete");
assert.equal(parseAsaTaskCommentRequest(`Comente na tarefa "Tarefa" com o texto "${"x".repeat(2001)}"`).kind, "incomplete");
assert.deepEqual(parseAsaTaskCommentsQuery('Mostre os comentários da tarefa "Revisar figurinos"'), {
  kind: "request", title: "Revisar figurinos",
});
assert.equal(parseAsaTaskCommentsQuery("Mostre os comentários da tarefa").kind, "incomplete");
assert.equal(parseAsaTaskCommentsQuery('Mostre os comentários da tarefa "A" e "B"').kind, "incomplete");
assert.equal(parseAsaTaskCommentsQuery('Não mostre os comentários da tarefa "Revisar figurinos"').kind, "not_query");
const taskCommentsFormatted = formatAsaTaskCommentsReply("Revisar figurinos", Array.from({ length: 12 }, (_, index) => ({
  body: `Comentário ${12 - index}`, createdAt: new Date(`2026-10-01T${String(15 - index).padStart(2, "0")}:30:00.000Z`),
  authorName: "Lia",
})));
assert.match(taskCommentsFormatted, /Comentários da tarefa “Revisar figurinos” · 10 mais recentes/);
assert.ok(taskCommentsFormatted.indexOf("Comentário 3") < taskCommentsFormatted.indexOf("Comentário 12"));
assert.doesNotMatch(taskCommentsFormatted, /Comentário 1\n|Comentário 2\n/);
assert.match(taskCommentsFormatted, /Lia · 01\/10\/2026/);
assert.match(formatAsaTaskCommentsReply("Tarefa", []), /ainda não tem comentários/);
assert.match(formatAsaTaskCommentsReply("Tarefa", [{
  body: "x".repeat(1201), createdAt: new Date("2026-10-01T12:00:00.000Z"), authorName: null,
}]), /Pessoa da equipe · [\s\S]*texto abreviado/);
assert.deepEqual(parseAsaTaskEvidenceLinkRequest('Anexe o link "https://exemplo.test/final.pdf" à tarefa "Relatório final" com a descrição "Documento de conferência"'), {
  kind: "request", url: "https://exemplo.test/final.pdf", title: "Relatório final", description: "Documento de conferência",
});
assert.equal(parseAsaTaskEvidenceLinkRequest('Anexe o link "javascript:alert(1)" à tarefa "Relatório final" com a descrição "Documento"').kind, "incomplete");
assert.equal(parseAsaTaskEvidenceLinkRequest('Anexe o link "https://usuario:senha@exemplo.test/final.pdf" à tarefa "Relatório final" com a descrição "Documento"').kind, "incomplete");
assert.equal(parseAsaTaskEvidenceLinkRequest('Anexe o link "https://exemplo.test/final.pdf" à tarefa "Relatório final"').kind, "incomplete");
assert.equal(parseAsaTaskEvidenceLinkRequest('Não anexe o link "https://exemplo.test/final.pdf" à tarefa "Relatório final" com a descrição "Documento"').kind, "not_action");
assert.deepEqual(parseAsaTaskChecklistUpdateRequest('Marque o item obrigatório da checklist "Separar comprovantes" da tarefa "Fechar relatório" como concluído'), {
  kind: "request", title: "Fechar relatório", itemLabel: "Separar comprovantes", checklistKind: "mandatory", completed: true,
});
assert.deepEqual(parseAsaTaskChecklistUpdateRequest('Desmarque o item operacional da checklist "Conferir figurino" da tarefa "Preparar show" como pendente'), {
  kind: "request", title: "Preparar show", itemLabel: "Conferir figurino", checklistKind: "operational", completed: false,
});
assert.equal(parseAsaTaskChecklistUpdateRequest('Marque o item da checklist "Separar comprovantes" da tarefa "Fechar relatório" como concluído').kind, "incomplete");
assert.equal(parseAsaTaskChecklistUpdateRequest('Marque o item da checklist "Item operacional" da tarefa "Tarefa obrigatória" como concluído').kind, "incomplete");
assert.equal(parseAsaTaskChecklistUpdateRequest('Marque o item obrigatório da checklist "Separar comprovantes" da tarefa "Fechar relatório" como não concluído').kind, "incomplete");
assert.equal(parseAsaTaskChecklistUpdateRequest('Desmarque o item obrigatório da checklist "Separar comprovantes" da tarefa "Fechar relatório" como concluído').kind, "incomplete");
assert.equal(parseAsaTaskChecklistUpdateRequest('Não marque o item obrigatório da checklist "Separar comprovantes" da tarefa "Fechar relatório" como concluído').kind, "not_action");
assert.equal(parseAsaTaskCompletionRequest("conclua a tarefa ‘Separar figurinos’ para aprovação").kind, "not_action");
assert.equal(parseAsaTaskCompletionRequest("marque a tarefa ‘Separar figurinos’ como não concluída").kind, "not_action");
assert.equal(parseAsaTaskCompletionRequest("minhas tarefas concluídas").kind, "not_action");
assert.deepEqual(parseAsaAgendaMeetingRequest('Agende uma reunião "Revisão semanal" em 01/10/2026 das 14:00 às 15:00'), {
  kind: "request", title: "Revisão semanal", date: "2026-10-01", startTime: "14:00", endTime: "15:00",
});
assert.equal(parseAsaAgendaMeetingRequest('Agende reunião "Revisão" em 31/02/2026 das 14:00 às 15:00').kind, "incomplete");
assert.equal(parseAsaAgendaMeetingRequest('Agende reunião "Revisão" em 01/10/2026 das 15:00 às 14:00').kind, "incomplete");
assert.deepEqual(parseAsaTaskDraftRequest('Crie uma tarefa "Separar figurinos" para "Ana Souza" até 30/09/2026 prioridade alta'), {
  kind: "proposal", title: "Separar figurinos", assigneeName: "Ana Souza", dueDate: "2026-09-30", priority: "HIGH", checklistLabels: [], mandatoryEvidences: [],
});
assert.deepEqual(parseAsaTaskDraftRequest('Crie uma tarefa “Revisar estoque” para “Bia” prazo 01/10/2026'), {
  kind: "proposal", title: "Revisar estoque", assigneeName: "Bia", dueDate: "2026-10-01", priority: "MEDIUM", checklistLabels: [], mandatoryEvidences: [],
});
assert.deepEqual(parseAsaTaskDraftRequest('Crie uma tarefa "Separar figurinos" para "Ana Souza" até 30/09/2026 com descrição "Separar por personagem e conferir etiquetas"'), {
  kind: "proposal", title: "Separar figurinos", assigneeName: "Ana Souza", dueDate: "2026-09-30", priority: "MEDIUM",
  description: "Separar por personagem e conferir etiquetas", checklistLabels: [], mandatoryEvidences: [],
});
assert.deepEqual(parseAsaTaskDraftRequest('Crie uma tarefa "Conferir extintores" para "Ana Souza" até 30/09/2026 vinculada à responsabilidade "Segurança do espaço"'), {
  kind: "proposal", title: "Conferir extintores", assigneeName: "Ana Souza", dueDate: "2026-09-30", priority: "MEDIUM",
  responsibilityTitle: "Segurança do espaço", checklistLabels: [], mandatoryEvidences: [],
});
assert.deepEqual(parseAsaTaskDraftRequest('Crie uma tarefa "Conferir extintores" para "Ana Souza" até 30/09/2026 com descrição "Registrar validade" vinculada à responsabilidade "Segurança do espaço" com checklist obrigatória "Conferir lacre" e evidências obrigatórias "FOTO: equipamento"'), {
  kind: "proposal", title: "Conferir extintores", assigneeName: "Ana Souza", dueDate: "2026-09-30", priority: "MEDIUM",
  description: "Registrar validade", responsibilityTitle: "Segurança do espaço",
  checklistLabels: ["Conferir lacre"], mandatoryEvidences: [{ type: "PHOTO", description: "equipamento" }],
});
assert.deepEqual(parseAsaTaskDraftRequest('Crie uma tarefa "Organizar cenário" para "Ana Souza" até 02/10/2026 com checklist obrigatória "Separar peças; conferir etiquetas"'), {
  kind: "proposal", title: "Organizar cenário", assigneeName: "Ana Souza", dueDate: "2026-10-02", priority: "MEDIUM",
  checklistLabels: ["Separar peças", "conferir etiquetas"], mandatoryEvidences: [],
});
assert.deepEqual(parseAsaTaskDraftRequest('Crie uma tarefa "Fechar relatório" para "Bia" até 03/10/2026 com evidências obrigatórias "PDF: relatório final; FOTO: página assinada"'), {
  kind: "proposal", title: "Fechar relatório", assigneeName: "Bia", dueDate: "2026-10-03", priority: "MEDIUM", checklistLabels: [],
  mandatoryEvidences: [{ type: "PDF", description: "relatório final" }, { type: "PHOTO", description: "página assinada" }],
});
assert.deepEqual(parseAsaTaskDraftRequest('Crie uma tarefa "Fechar relatório" para "Bia" até 03/10/2026 com evidências obrigatórias "PDF: relatório final" com descrição "Conferir os dados antes do envio" com checklist obrigatória "Revisar totais"'), {
  kind: "proposal", title: "Fechar relatório", assigneeName: "Bia", dueDate: "2026-10-03", priority: "MEDIUM",
  description: "Conferir os dados antes do envio", checklistLabels: ["Revisar totais"],
  mandatoryEvidences: [{ type: "PDF", description: "relatório final" }],
});
assert.deepEqual(parseAsaTaskDraftRequest('Crie uma tarefa "Inventário" para "Bia" até 03/10/2026 com checklist "Conferir itens" e evidência obrigatória "DOCUMENTO: planilha"'), {
  kind: "proposal", title: "Inventário", assigneeName: "Bia", dueDate: "2026-10-03", priority: "MEDIUM",
  checklistLabels: ["Conferir itens"], mandatoryEvidences: [{ type: "DOCUMENT", description: "planilha" }],
});
assert.equal(parseAsaTaskDraftRequest('Crie tarefa "Organizar cenário" para "Ana Souza" até 02/10/2026 com checklist "Separar; separar"').kind, "incomplete");
assert.equal(parseAsaTaskDraftRequest('Crie tarefa "Organizar cenário" para "Ana Souza" até 02/10/2026 com checklist obrigatória').kind, "incomplete");
assert.equal(parseAsaTaskDraftRequest('Crie tarefa "Fechar relatório" para "Bia" até 03/10/2026 com evidências obrigatórias "XML: arquivo"').kind, "incomplete");
assert.equal(parseAsaTaskDraftRequest('Crie tarefa "Fechar relatório" para "Bia" até 03/10/2026 com evidências obrigatórias "PDF"').kind, "incomplete");
assert.equal(parseAsaTaskDraftRequest('Crie tarefa "Fechar relatório" para "Bia" até 03/10/2026 com descrição').kind, "incomplete");
assert.equal(parseAsaTaskDraftRequest('Crie tarefa "Conferir extintores" para "Ana Souza" até 30/09/2026 vinculada à responsabilidade').kind, "incomplete");
assert.equal(parseAsaTaskDraftRequest(`Crie tarefa "Fechar relatório" para "Bia" até 03/10/2026 com descrição "${"x".repeat(2001)}"`).kind, "incomplete");
assert.equal(parseAsaTaskDraftRequest('Crie tarefa "Fechar relatório" para "Bia" até 03/10/2026 com evidências obrigatórias "PDF: arquivo; PDF: ARQUIVO"').kind, "incomplete");
assert.deepEqual(parseAsaTaskRequirementsUpdate('Atualize os requisitos da tarefa "Inventário" para checklist obrigatória "Conferir itens; Fotografar estoque" e evidências obrigatórias "PDF: planilha final; FOTO: prateleira"'), {
  kind: "request", title: "Inventário", checklistLabels: ["Conferir itens", "Fotografar estoque"],
  mandatoryEvidences: [{ type: "PDF", description: "planilha final" }, { type: "PHOTO", description: "prateleira" }],
});
assert.deepEqual(parseAsaTaskRequirementsUpdate('Altere os requisitos da tarefa “Inventário” para checklist obrigatória “nenhuma” e evidências obrigatórias “nenhuma”'), {
  kind: "request", title: "Inventário", checklistLabels: [], mandatoryEvidences: [],
});
assert.equal(parseAsaTaskRequirementsUpdate('Atualize os requisitos da tarefa "Inventário" para checklist obrigatória "Conferir" e evidências obrigatórias "XML: arquivo"').kind, "incomplete");
assert.equal(parseAsaTaskRequirementsUpdate('Atualize os requisitos da tarefa "Inventário"').kind, "incomplete");
assert.deepEqual(parseAsaTaskResponsibilityUpdate('Altere a responsabilidade da tarefa "Conferir extintores" para "Segurança do espaço"'), {
  kind: "request", title: "Conferir extintores", responsibilityTitle: "Segurança do espaço",
});
assert.deepEqual(parseAsaTaskResponsibilityUpdate('Remova a responsabilidade da tarefa “Conferir extintores” para “nenhuma”'), {
  kind: "request", title: "Conferir extintores", responsibilityTitle: null,
});
assert.equal(parseAsaTaskResponsibilityUpdate('Altere a responsabilidade da tarefa "Conferir extintores"').kind, "incomplete");
assert.equal(parseAsaTaskDraftRequest('crie uma tarefa "Revisar estoque" para "Bia" prazo 31/02/2026').kind, "incomplete");
assert.equal(parseAsaTaskDraftRequest("crie uma tarefa" ).kind, "incomplete");
assert.deepEqual(parseAsaTaskDueDateUpdate('altere o prazo da tarefa "Separar figurinos" para 03/10/2026'), {
  kind: "request", title: "Separar figurinos", dueDate: "2026-10-03",
});
assert.equal(parseAsaTaskDueDateUpdate('mude a tarefa "Separar figurinos" para 31/02/2026').kind, "incomplete");
assert.equal(parseAsaTaskDueDateUpdate('altere a tarefa "Separar figurinos"').kind, "incomplete");
for (const subject of ["responsabilidade", "requisitos", "título", "nome"]) {
  assert.equal(parseAsaTaskDueDateUpdate(`Altere ${subject} da tarefa "Inventário" para "Novo valor"`).kind, "not_action");
}
assert.equal(parseAsaTaskDueDateUpdate('Altere o prazo da tarefa "Responsabilidade e requisitos" para 03/10/2026').kind, "request");
assert.equal(parseAsaTaskDraftRequest('altere o prazo da tarefa "Separar figurinos" para 03/10/2026').kind, "not_action");
assert.deepEqual(parseAsaTaskAssigneeUpdate('altere o responsável da tarefa "Separar figurinos" para "Ana Souza"'), {
  kind: "request", title: "Separar figurinos", assigneeName: "Ana Souza",
});
assert.deepEqual(parseAsaTaskAssigneeUpdate('troque o responsável da tarefa ‘Revisar estoque’ para ‘Bia’'), {
  kind: "request", title: "Revisar estoque", assigneeName: "Bia",
});
assert.equal(parseAsaTaskAssigneeUpdate('altere o responsável da tarefa "Separar figurinos" para').kind, "incomplete");
assert.equal(parseAsaTaskAssigneeUpdate('altere o responsável da tarefa "Separar figurinos" para "Ana" e "Bia"').kind, "incomplete");
assert.equal(parseAsaTaskDueDateUpdate('altere o responsável da tarefa "Separar figurinos" para "Ana Souza"').kind, "not_action");
assert.deepEqual(parseAsaTaskPriorityUpdate('altere a prioridade da tarefa "Separar figurinos" para alta'), {
  kind: "request", title: "Separar figurinos", priority: "HIGH",
});
assert.deepEqual(parseAsaTaskPriorityUpdate('mude a prioridade da tarefa “Revisar estoque” para crítica'), {
  kind: "request", title: "Revisar estoque", priority: "CRITICAL",
});
assert.deepEqual(parseAsaTaskPriorityUpdate('atualize a prioridade da tarefa “Revisar estoque” para média'), {
  kind: "request", title: "Revisar estoque", priority: "MEDIUM",
});
assert.deepEqual(parseAsaTaskPriorityUpdate('troque prioridade da tarefa “Revisar estoque” para baixa'), {
  kind: "request", title: "Revisar estoque", priority: "LOW",
});
assert.equal(parseAsaTaskPriorityUpdate('altere prioridade da tarefa "Separar figurinos"').kind, "incomplete");
assert.equal(parseAsaTaskPriorityUpdate('altere prioridade da tarefa "Separar figurinos" para urgente').kind, "incomplete");
assert.equal(parseAsaTaskPriorityUpdate('altere prioridade da tarefa "Separar figurinos" para alta e "Revisar estoque"').kind, "incomplete");
assert.equal(parseAsaTaskDueDateUpdate('altere a prioridade da tarefa "Separar figurinos" para alta').kind, "not_action");
assert.deepEqual(parseAsaTaskDescriptionUpdate('altere a descrição da tarefa "Separar figurinos" para "Separar, etiquetar e guardar os figurinos."'), {
  kind: "request", title: "Separar figurinos", description: "Separar, etiquetar e guardar os figurinos.",
});
assert.equal(parseAsaTaskDueDateUpdate('altere a descrição da tarefa "Separar figurinos" para "nova descrição"').kind, "not_action");
assert.equal(parseAsaTaskDescriptionUpdate('altere a descrição da tarefa "Separar figurinos" para "  "').kind, "incomplete");
assert.equal(parseAsaTaskDescriptionUpdate('altere a descrição da tarefa "Separar figurinos" para "texto" e "outro texto"').kind, "incomplete");
assert.equal(parseAsaTaskDescriptionUpdate('altere a prioridade da tarefa "Separar figurinos" para alta').kind, "not_action");
assert.deepEqual(parseAsaTaskTitleUpdate('altere o título da tarefa "Separar figurinos" para "Separar os figurinos"'), {
  kind: "request", title: "Separar figurinos", newTitle: "Separar os figurinos",
});
assert.equal(parseAsaTaskTitleUpdate('renomeie o título da tarefa "Separar figurinos" para "   "').kind, "incomplete");
assert.equal(parseAsaTaskTitleUpdate('altere o título da tarefa "Separar figurinos" para "Novo" e "Outro"').kind, "incomplete");
assert.equal(parseAsaTaskTitleUpdate('altere a descrição da tarefa "Separar figurinos" para "Novo"').kind, "not_action");
assert.deepEqual(parseAsaNoticeDraftRequest("prepare um rascunho de aviso: ‘Horário do ensaio’ ‘O ensaio começa às 18h.’"), {
  kind: "proposal", title: "Horário do ensaio", content: "O ensaio começa às 18h.",
});
assert.equal(parseAsaNoticeDraftRequest("prepare rascunho de aviso").kind, "incomplete");
assert.deepEqual(parseAsaNoticeDraftUpdateRequest('edite o rascunho de aviso "Horário do ensaio" para "Horário atualizado" com o texto "O ensaio começa às 19h."'), {
  kind: "request", title: "Horário do ensaio", newTitle: "Horário atualizado", content: "O ensaio começa às 19h.",
});
assert.equal(parseAsaNoticeDraftUpdateRequest('edite o rascunho de aviso "Horário do ensaio" para "Título"').kind, "incomplete");
assert.equal(parseAsaNoticeDraftUpdateRequest('edite o rascunho de aviso "   " para "Título" com o texto "Texto"').kind, "incomplete");
assert.equal(parseAsaNoticeDraftUpdateRequest('não edite o rascunho de aviso "Horário do ensaio" para "Título" com o texto "Texto"').kind, "not_action");
assert.equal(parseAsaNoticeDraftUpdateRequest('crie um rascunho de aviso "Título" "Texto"').kind, "not_action");
assert.equal(parseAsaNoticeDraftRequest("prepare rascunho de aviso: ‘   ’ ‘texto’").kind, "incomplete");
assert.equal(parseAsaNoticeDraftRequest("prepare rascunho de aviso: ‘título’ ‘   ’").kind, "incomplete");

const thisWeek = resolveAsaCommand("Qual é minha escala dessa semana?", "2026-09-26", false);
assert.equal(thisWeek.kind, "command");
if (thisWeek.kind === "command") {
  assert.equal(thisWeek.command.tool, "consultar_escalas");
  assert.deepEqual(thisWeek.command.input, { dateFrom: "2026-09-21", dateTo: "2026-09-27", limit: 50 });
}
const dailyBookTomorrow = resolveAsaCommand("Mostra o Livro do Dia de amanhã", "2026-09-26", false);
assert.equal(dailyBookTomorrow.kind, "command");
if (dailyBookTomorrow.kind === "command") {
  assert.equal(dailyBookTomorrow.command.tool, "consultar_livro_do_dia");
  assert.deepEqual(dailyBookTomorrow.command.input, { date: "2026-09-27", limit: 10 });
}
const myDayTomorrow = resolveAsaCommand("O que tenho no meu dia amanhã?", "2026-09-26", false);
assert.equal(myDayTomorrow.kind, "command");
if (myDayTomorrow.kind === "command") {
  assert.equal(myDayTomorrow.command.tool, "consultar_meu_dia");
  assert.deepEqual(myDayTomorrow.command.input, { dateFrom: "2026-09-27", dateTo: "2026-09-27", limit: 50 });
}
const agendaMonth = resolveAsaCommand("agenda da operação", "2026-09-26", false);
assert.equal(agendaMonth.kind, "command");
if (agendaMonth.kind === "command") {
  assert.equal(agendaMonth.command.tool, "consultar_agenda");
  assert.deepEqual(agendaMonth.command.input, { dateFrom: "2026-09-26", dateTo: "2026-10-26", limit: 30 });
}
const myMeetingProposals = resolveAsaCommand("Quais são minhas propostas de reunião?", "2026-09-26", false, "/agenda", "MEMBER");
assert.equal(myMeetingProposals.kind, "command");
if (myMeetingProposals.kind === "command") {
  assert.equal(myMeetingProposals.command.tool, "consultar_minhas_propostas_agenda");
  assert.deepEqual(myMeetingProposals.command.input, { limit: 20 });
}
const recurringActivities = resolveAsaCommand("Quais atividades recorrentes temos?", "2026-09-26", true, "", "ADMIN");
assert.equal(recurringActivities.kind, "command");
if (recurringActivities.kind === "command") {
  assert.equal(recurringActivities.command.tool, "consultar_atividades");
  assert.deepEqual(recurringActivities.command.input, { limit: 50 });
}
assert.equal(resolveAsaCommand("atividades recorrentes", "2026-09-26", false, "", "MEMBER").kind, "unsupported");
assert.equal(resolveAsaCommand("o que tenho aqui?", "2026-09-26", true, "/admin/activities", "SUPERVISOR_A").kind, "command");
assert.match(formatAsaCapabilityReply("SUPERVISOR_A"), /atividades recorrentes ativas/);
assert.doesNotMatch(formatAsaCapabilityReply("MEMBER"), /atividades recorrentes/);
assert.match(formatAsaCommandReply("consultar_atividades", JSON.stringify({
  operationName: "Teatro Central",
  total: 1,
  atividades: [{ titulo: "Ensaio", horarios: [{ diaSemana: "Seg", inicio: "18:00:00", fim: "19:30:00" }], designados: [{ nome: "Ana" }, { grupo: "Elenco" }] }],
})), /Atividades recorrentes ativas em Teatro Central \(1\)[\s\S]*Ensaio · Seg 18:00–19:30 · Ana, Elenco/);
assert.match(formatAsaCommandReply("consultar_minhas_propostas_agenda", JSON.stringify({ propostas: [
  { title: "Revisão", date: "2026-10-01", startTime: "14:00:00", endTime: "15:00:00", status: "REJECTED", reason: "Conflito de horário", alternativeDetails: "Tentar à tarde" },
] })), /recusada[\s\S]*Motivo: Conflito de horário[\s\S]*Alternativa: Tentar à tarde/);

const nextDay = resolveAsaCommand("minha escala amanhã", "2026-09-26", false);
assert.equal(nextDay.kind, "command");
if (nextDay.kind === "command") assert.deepEqual(nextDay.command.input, { dateFrom: "2026-09-27", dateTo: "2026-09-27", limit: 50 });

const todayOnly = resolveAsaCommand("minha escala hoje", "2026-09-26", false);
assert.equal(todayOnly.kind, "command");
if (todayOnly.kind === "command") assert.deepEqual(todayOnly.command.input, { dateFrom: "2026-09-26", dateTo: "2026-09-26", limit: 50 });

const nextWeek = resolveAsaCommand("minha escala semana que vem", "2026-09-26", false);
assert.equal(nextWeek.kind, "command");
if (nextWeek.kind === "command") assert.deepEqual(nextWeek.command.input, { dateFrom: "2026-09-28", dateTo: "2026-10-04", limit: 50 });

const teamAbsences = resolveAsaCommand("quem está de folga amanhã?", "2026-09-26", true);
assert.equal(teamAbsences.kind, "command");
if (teamAbsences.kind === "command") assert.deepEqual(teamAbsences.command.input, { date: "2026-09-27" });

const operations = [{ id: "op-a", name: "Teatro Central" }, { id: "op-b", name: "Festival de Inverno" }];
assert.deepEqual(resolveAsaOperationSelection("minha escala", [operations[0]!]), { kind: "selected", operationId: "op-a" });
assert.deepEqual(resolveAsaOperationSelection("folgas da equipe no festival de inverno", operations), { kind: "selected", operationId: "op-b" });
assert.deepEqual(resolveAsaOperationSelection("minha escala", operations, "op-b"), { kind: "selected", operationId: "op-b" });
assert.equal(resolveAsaOperationSelection("minha escala", operations, "op-fora-do-perfil").kind, "unavailable");
assert.equal(resolveAsaOperationSelection("minha escala", operations).kind, "clarification");
assert.equal(resolveAsaOperationSelection("minha escala", []).kind, "unavailable");

assert.equal(resolveAsaCommand("quem está de folga hoje?", "2026-09-26", false).kind, "unsupported");
assert.equal(resolveAsaCommand("minha escala e minhas tarefas", "2026-09-26", false).kind, "clarification");
assert.equal(resolveAsaCommand("não consulte minha escala", "2026-09-26", false).kind, "unsupported");
assert.equal(resolveAsaCommand("crie um aviso agora", "2026-09-26", true).kind, "unsupported");
assert.equal(resolveAsaCommand("crie um compromisso na agenda", "2026-09-26", true).kind, "unsupported");
const pendingTasks = resolveAsaCommand("quais tarefas pendentes tenho?", "2026-09-26", false);
assert.equal(pendingTasks.kind, "command");
if (pendingTasks.kind === "command") assert.equal(pendingTasks.command.input.status, "PENDING");
const tasksToday = resolveAsaCommand("minhas tarefas de hoje", "2026-09-26", false);
assert.equal(tasksToday.kind, "command");
if (tasksToday.kind === "command") assert.deepEqual(tasksToday.command.input, { dateFrom: "2026-09-26", dateTo: "2026-09-26", status: "PENDING", limit: 20 });
const tasksNextThreeDays = resolveAsaCommand("Quais tarefas tenho com prazo nos próximos 3 dias?", "2026-09-26", false);
assert.equal(tasksNextThreeDays.kind, "command");
if (tasksNextThreeDays.kind === "command") assert.deepEqual(tasksNextThreeDays.command.input, { dateFrom: "2026-09-27", dateTo: "2026-09-29", status: "ACTIONABLE", limit: 20 });
const tasksNextThreeDaysSpelled = resolveAsaCommand("Minhas tarefas dos próximos três dias", "2026-09-26", false);
assert.equal(tasksNextThreeDaysSpelled.kind, "command");
if (tasksNextThreeDaysSpelled.kind === "command") assert.deepEqual(tasksNextThreeDaysSpelled.command.input, { dateFrom: "2026-09-27", dateTo: "2026-09-29", status: "ACTIONABLE", limit: 20 });
assert.equal(resolveAsaCommand("tarefas de hoje e dos próximos 3 dias", "2026-09-26", false).kind, "clarification");
const overdueTasks = resolveAsaCommand("tarefas atrasadas", "2026-09-26", false);
assert.equal(overdueTasks.kind, "command");
if (overdueTasks.kind === "command") assert.deepEqual(overdueTasks.command.input, { dateTo: "2026-09-25", status: "PENDING", limit: 20 });
const nextWeekTasks = resolveAsaCommand("todas as minhas tarefas da semana que vem", "2026-09-26", false);
assert.equal(nextWeekTasks.kind, "command");
if (nextWeekTasks.kind === "command") assert.deepEqual(nextWeekTasks.command.input, { dateFrom: "2026-09-28", dateTo: "2026-10-04", limit: 20 });
const thisMonthTasks = resolveAsaCommand("minhas tarefas deste mês", "2026-09-26", false);
assert.equal(thisMonthTasks.kind, "command");
if (thisMonthTasks.kind === "command") assert.deepEqual(thisMonthTasks.command.input, { dateFrom: "2026-09-01", dateTo: "2026-09-30", status: "PENDING", limit: 20 });
const nextMonthTasks = resolveAsaCommand("tarefas do próximo mês", "2026-09-26", false);
assert.equal(nextMonthTasks.kind, "command");
if (nextMonthTasks.kind === "command") assert.deepEqual(nextMonthTasks.command.input, { dateFrom: "2026-10-01", dateTo: "2026-10-31", status: "PENDING", limit: 20 });
const completedTasks = resolveAsaCommand("tarefas concluídas", "2026-09-26", false);
assert.equal(completedTasks.kind, "command");
if (completedTasks.kind === "command") assert.equal(completedTasks.command.input.status, "COMPLETED");
const taskRequirements = resolveAsaCommand('O que falta para concluir a tarefa "Separar figurinos"?', "2026-09-26", false);
assert.equal(taskRequirements.kind, "command");
if (taskRequirements.kind === "command") {
  assert.equal(taskRequirements.command.tool, "consultar_tarefa_requisitos");
  assert.deepEqual(taskRequirements.command.input, { title: "Separar figurinos" });
}
assert.equal(resolveAsaCommand("o que falta para concluir a tarefa", "2026-09-26", false).kind, "clarification");
assert.equal(resolveAsaCommand("tarefas da equipe", "2026-09-26", false, "", "MEMBER").kind, "unsupported");
const teamTasks = resolveAsaCommand("tarefas atrasadas da equipe", "2026-09-26", true);
assert.equal(teamTasks.kind, "command");
if (teamTasks.kind === "command") {
  assert.equal(teamTasks.command.tool, "consultar_tarefas_equipe");
  assert.deepEqual(teamTasks.command.input, { dateTo: "2026-09-25", status: "PENDING", limit: 50 });
}
const teamTasksNextThreeDays = resolveAsaCommand("tarefas da equipe nos próximos 3 dias", "2026-09-26", true);
assert.equal(teamTasksNextThreeDays.kind, "command");
if (teamTasksNextThreeDays.kind === "command") assert.deepEqual(teamTasksNextThreeDays.command.input, { dateFrom: "2026-09-27", dateTo: "2026-09-29", status: "ACTIONABLE", limit: 50 });
const teamTasksAll = resolveAsaCommand("todas as tarefas da equipe", "2026-09-26", true);
assert.equal(teamTasksAll.kind, "command");
if (teamTasksAll.kind === "command") assert.deepEqual(teamTasksAll.command.input, { limit: 50 });
const teamResponsibilities = resolveAsaCommand("mostre as responsabilidades da equipe", "2026-09-26", true, "", "ADMIN");
assert.equal(teamResponsibilities.kind, "command");
if (teamResponsibilities.kind === "command") {
  assert.equal(teamResponsibilities.command.tool, "consultar_responsabilidades_equipe");
  assert.deepEqual(teamResponsibilities.command.input, { unassigned: false, limit: 50 });
}
const unassignedResponsibilities = resolveAsaCommand("Quais responsabilidades da equipe estão sem responsável?", "2026-09-26", true, "", "ADMIN");
assert.equal(unassignedResponsibilities.kind, "command");
if (unassignedResponsibilities.kind === "command") {
  assert.equal(unassignedResponsibilities.command.tool, "consultar_responsabilidades_equipe");
  assert.deepEqual(unassignedResponsibilities.command.input, { unassigned: true, limit: 50 });
}
assert.equal(resolveAsaCommand("responsabilidades da equipe", "2026-09-26", false, "", "MEMBER").kind, "unsupported");
const teamDeliveries = resolveAsaCommand("entregas da equipe", "2026-09-26", true, "", "SUPERVISOR_A");
assert.equal(teamDeliveries.kind, "command");
if (teamDeliveries.kind === "command") assert.deepEqual(teamDeliveries.command.input, { scope: "team", limit: 20 });
assert.equal(resolveAsaCommand("entregas da operação", "2026-09-26", false, "", "MEMBER").kind, "unsupported");
const myDeliveries = resolveAsaCommand("minhas entregas", "2026-09-26", false, "", "MEMBER");
assert.equal(myDeliveries.kind, "command");
if (myDeliveries.kind === "command") assert.deepEqual(myDeliveries.command.input, { limit: 20 });
const myFreeTime = resolveAsaCommand("meus intervalos livres amanhã", "2026-09-26", false);
assert.equal(myFreeTime.kind, "command");
if (myFreeTime.kind === "command") {
  assert.equal(myFreeTime.command.tool, "consultar_tempo_livre");
  assert.deepEqual(myFreeTime.command.input, { date: "2026-09-27", mine: true });
}
const managerMyFreeTime = resolveAsaCommand("meus intervalos livres amanhã", "2026-09-26", true);
assert.equal(managerMyFreeTime.kind, "command");
if (managerMyFreeTime.kind === "command") assert.deepEqual(managerMyFreeTime.command.input, { date: "2026-09-27", mine: true });
const myCheckIn = resolveAsaCommand("qual meu check-in hoje?", "2026-09-26", false);
assert.equal(myCheckIn.kind, "command");
if (myCheckIn.kind === "command") {
  assert.equal(myCheckIn.command.tool, "consultar_meu_checkin");
  assert.deepEqual(myCheckIn.command.input, { date: "2026-09-26" });
}
const myCheckInTomorrow = resolveAsaCommand("minha presença amanhã", "2026-09-26", false);
assert.equal(myCheckInTomorrow.kind, "command");
if (myCheckInTomorrow.kind === "command") assert.deepEqual(myCheckInTomorrow.command.input, { date: "2026-09-27" });
assert.match(formatAsaCommandReply("consultar_meu_checkin", JSON.stringify({ date: "2026-09-26", status: "CHECKED_IN", checkedInAt: "2026-09-26T14:30:00Z" })), /Seu check-in em 26\/09 está registrado às 11:30/);
assert.match(formatAsaCommandReply("consultar_meu_checkin", JSON.stringify({ date: "2026-09-26", message: "Você não tem atividade publicada." })), /não tem atividade publicada/);
const teamCheckIns = resolveAsaCommand("status dos check-ins da equipe amanhã", "2026-09-26", true);
assert.equal(teamCheckIns.kind, "command");
if (teamCheckIns.kind === "command") {
  assert.equal(teamCheckIns.command.tool, "consultar_checkins_equipe");
  assert.deepEqual(teamCheckIns.command.input, { date: "2026-09-27" });
}
assert.equal(resolveAsaCommand("status dos check-ins da equipe", "2026-09-26", false).kind, "unsupported");
assert.match(formatAsaCommandReply("consultar_checkins_equipe", JSON.stringify({ date: "2026-09-26", checkIns: [{ userName: "Ana", status: "CHECKED_IN", checkedInAt: "2026-09-26T14:30:00Z" }, { userName: "Bia", status: "EXPECTED" }] })), /Ana · presente · 11:30/);
const contextualTeamCheckIns = resolveAsaCommand("o que tenho aqui?", "2026-09-26", true, "/supervisor/check-ins", "SUPERVISOR_A");
assert.equal(contextualTeamCheckIns.kind, "command");
if (contextualTeamCheckIns.kind === "command") {
  assert.equal(contextualTeamCheckIns.command.tool, "consultar_checkins_equipe");
  assert.deepEqual(contextualTeamCheckIns.command.input, { date: "2026-09-26" });
}
const contextualMemberFolgas = resolveAsaCommand("o que tenho aqui?", "2026-09-26", false, "/folgas", "MEMBER");
assert.equal(contextualMemberFolgas.kind, "command");
if (contextualMemberFolgas.kind === "command") assert.equal(contextualMemberFolgas.command.tool, "consultar_folgas");
const contextualManagerFolgas = resolveAsaCommand("o que tenho aqui?", "2026-09-26", true, "/folgas", "ADMIN");
assert.equal(contextualManagerFolgas.kind, "command");
if (contextualManagerFolgas.kind === "command") assert.equal(contextualManagerFolgas.command.tool, "consultar_ausencias_do_dia");
for (const page of ["/admin/folgas", "/supervisor/folgas"] as const) {
  const result = resolveAsaCommand("o que tenho aqui?", "2026-09-26", true, page, "SUPERVISOR_A");
  assert.equal(result.kind, "command", page);
  if (result.kind === "command") assert.equal(result.command.tool, "consultar_ausencias_do_dia");
}
for (const page of ["/admin/deliveries", "/supervisor/deliveries"] as const) {
  const result = resolveAsaCommand("o que tenho aqui?", "2026-09-26", true, page, page.startsWith("/admin") ? "ADMIN" : "SUPERVISOR_A");
  assert.equal(result.kind, "command", page);
  if (result.kind === "command") {
    assert.equal(result.command.tool, "consultar_entregas");
    assert.deepEqual(result.command.input, { scope: "team", limit: 20 });
  }
}
const contextualSupervisorInsights = resolveAsaCommand("o que tenho aqui?", "2026-09-26", true, "/supervisor/insights", "SUPERVISOR_A");
assert.equal(contextualSupervisorInsights.kind, "command");
if (contextualSupervisorInsights.kind === "command") assert.equal(contextualSupervisorInsights.command.tool, "consultar_checkins_equipe");
const teamFreeTime = resolveAsaCommand("quem tem intervalo livre amanhã?", "2026-09-26", true);
assert.equal(teamFreeTime.kind, "command");
if (teamFreeTime.kind === "command") assert.deepEqual(teamFreeTime.command.input, { date: "2026-09-27", mine: false });
assert.equal(resolveAsaCommand("quem tem intervalo livre amanhã?", "2026-09-26", false).kind, "unsupported");
assert.equal(resolveAsaCommand("tem intervalo livre amanhã?", "2026-09-26", false).kind, "clarification");
const contextualScale = resolveAsaCommand("o que tenho aqui?", "2026-09-26", false, "/escalas");
assert.equal(contextualScale.kind, "command");
if (contextualScale.kind === "command") assert.deepEqual(contextualScale.command.input, { dateFrom: "2026-09-21", dateTo: "2026-09-27", limit: 50 });
const contextualAgenda = resolveAsaCommand("o que tenho aqui?", "2026-09-26", false, "/agenda");
assert.equal(contextualAgenda.kind, "command");
if (contextualAgenda.kind === "command") assert.equal(contextualAgenda.command.tool, "consultar_agenda");
for (const page of ["/meu-dia", "/admin/meu-dia"]) {
  const contextualMyDay = resolveAsaCommand("o que tenho aqui?", "2026-09-26", false, page);
  assert.equal(contextualMyDay.kind, "command");
  if (contextualMyDay.kind === "command") {
    assert.equal(contextualMyDay.command.tool, "consultar_meu_dia");
    assert.deepEqual(contextualMyDay.command.input, { dateFrom: "2026-09-26", dateTo: "2026-09-26", limit: 50 });
  }
}
for (const page of ["/admin/daily-book", "/supervisor/daily-book", "/membro/livro-do-dia"]) {
  const contextualBook = resolveAsaCommand("o que tenho aqui?", "2026-09-26", false, page);
  assert.equal(contextualBook.kind, "command");
  if (contextualBook.kind === "command") {
    assert.equal(contextualBook.command.tool, "consultar_livro_do_dia");
    assert.deepEqual(contextualBook.command.input, { date: "2026-09-26", limit: 10 });
  }
}
const contextualShellBook = resolveAsaCommand("o que tenho aqui?", "2026-09-26", false, "/livro-do-dia", "MEMBER");
assert.equal(contextualShellBook.kind, "command");
if (contextualShellBook.kind === "command") {
  assert.equal(contextualShellBook.command.tool, "consultar_livro_do_dia");
  assert.deepEqual(contextualShellBook.command.input, { date: "2026-09-26", limit: 10 });
}
const contextualShellCheckIn = resolveAsaCommand("o que tenho aqui?", "2026-09-26", false, "/check-in", "MEMBER");
assert.equal(contextualShellCheckIn.kind, "command");
if (contextualShellCheckIn.kind === "command") {
  assert.equal(contextualShellCheckIn.command.tool, "consultar_meu_checkin");
  assert.deepEqual(contextualShellCheckIn.command.input, { date: "2026-09-26" });
}
const contextualTasks = resolveAsaCommand("resuma esta tela", "2026-09-26", false, "/responsabilidades");
assert.equal(contextualTasks.kind, "command");
if (contextualTasks.kind === "command") assert.deepEqual(contextualTasks.command.input, { status: "PENDING", limit: 20 });
for (const page of ["/admin/responsibilities", "/admin/responsabilidades-delegacoes"]) {
  const contextualResponsibilities = resolveAsaCommand("o que tenho aqui?", "2026-09-26", true, page, "ADMIN");
  assert.equal(contextualResponsibilities.kind, "command");
  if (contextualResponsibilities.kind === "command") {
    assert.equal(contextualResponsibilities.command.tool, "consultar_responsabilidades_equipe");
    assert.deepEqual(contextualResponsibilities.command.input, { unassigned: false, limit: 50 });
  }
}
for (const page of ["/admin/tasks", "/supervisor/tasks"]) {
  const contextualTeamTasks = resolveAsaCommand("o que tenho aqui?", "2026-09-26", true, page);
  assert.equal(contextualTeamTasks.kind, "command");
  if (contextualTeamTasks.kind === "command") {
    assert.equal(contextualTeamTasks.command.tool, "consultar_tarefas_equipe");
    assert.deepEqual(contextualTeamTasks.command.input, { status: "PENDING", limit: 50 });
  }
}
const contextualMessages = resolveAsaCommand("o que tenho aqui?", "2026-09-26", false, "/membro/mensagens");
assert.equal(contextualMessages.kind, "command");
if (contextualMessages.kind === "command") assert.equal(contextualMessages.command.tool, "consultar_mensagens");
const muralCommand = resolveAsaCommand("Mostra o Mural", "2026-09-26", false);
assert.equal(muralCommand.kind, "command");
if (muralCommand.kind === "command") {
  assert.equal(muralCommand.command.tool, "consultar_mural");
  assert.deepEqual(muralCommand.command.input, { limit: 20 });
}
const muralSearch = resolveAsaCommand("Busque no Mural por ‘figurino’", "2026-09-26", false);
assert.equal(muralSearch.kind, "command");
if (muralSearch.kind === "command") assert.deepEqual(muralSearch.command.input, { query: "figurino", limit: 20 });
const contextualMural = resolveAsaCommand("o que tenho aqui?", "2026-09-26", false, "/mural");
assert.equal(contextualMural.kind, "command");
if (contextualMural.kind === "command") assert.equal(contextualMural.command.tool, "consultar_mural");
const peopleSearch = resolveAsaCommand("buscar pessoas por ‘Ana’", "2026-09-26", false);
assert.equal(peopleSearch.kind, "command");
if (peopleSearch.kind === "command") {
  assert.equal(peopleSearch.command.tool, "consultar_pessoas");
  assert.deepEqual(peopleSearch.command.input, { query: "Ana", limit: 20 });
}
assert.equal(resolveAsaCommand("buscar pessoas", "2026-09-26", false).kind, "clarification");
const contextualPeople = resolveAsaCommand("o que tenho aqui?", "2026-09-26", false, "/pessoas");
assert.equal(contextualPeople.kind, "clarification");
const locationSearch = resolveAsaCommand("buscar local ‘Snowland’", "2026-09-26", false);
assert.equal(locationSearch.kind, "command");
if (locationSearch.kind === "command") {
  assert.equal(locationSearch.command.tool, "consultar_locais");
  assert.deepEqual(locationSearch.command.input, { query: "Snowland", limit: 20 });
}
const contextualLocations = resolveAsaCommand("o que tenho aqui?", "2026-09-26", false, "/locais");
assert.equal(contextualLocations.kind, "command");
if (contextualLocations.kind === "command") assert.equal(contextualLocations.command.tool, "consultar_locais");
const personalDeliveries = resolveAsaCommand("Minhas entregas", "2026-09-26", false);
assert.equal(personalDeliveries.kind, "command");
if (personalDeliveries.kind === "command") {
  assert.equal(personalDeliveries.command.tool, "consultar_entregas");
  assert.deepEqual(personalDeliveries.command.input, { limit: 20 });
}
const contextualDeliveries = resolveAsaCommand("o que tenho aqui?", "2026-09-26", false, "/membro/entregas");
assert.equal(contextualDeliveries.kind, "command");
if (contextualDeliveries.kind === "command") assert.equal(contextualDeliveries.command.tool, "consultar_entregas");
const attendanceReport = resolveAsaCommand("Resumo de check-ins da equipe dos últimos 7 dias", "2026-09-26", true, "", "ADMIN");
assert.equal(attendanceReport.kind, "command");
if (attendanceReport.kind === "command") {
  assert.equal(attendanceReport.command.tool, "consultar_relatorio_checkins");
  assert.deepEqual(attendanceReport.command.input, { period: "7d" });
}
assert.equal(resolveAsaCommand("Resumo de check-ins", "2026-09-26", true, "", "SUPERVISOR_A").kind, "unsupported");
const taskReport = resolveAsaCommand("Resumo das tarefas da equipe nos últimos 30 dias", "2026-09-26", true, "", "ADMIN");
assert.equal(taskReport.kind, "command");
if (taskReport.kind === "command") {
  assert.equal(taskReport.command.tool, "consultar_relatorio_tarefas");
  assert.deepEqual(taskReport.command.input, { period: "30d" });
}
assert.equal(resolveAsaCommand("Resumo das tarefas", "2026-09-26", true, "", "SUPERVISOR_A").kind, "unsupported");
assert.deepEqual(taskPeriodDates("7d", "2026-09-28"), { startDate: "2026-09-22", endDate: "2026-09-28" });
assert.deepEqual(summarizeTasks([
  { status: "CREATED", count: 1 }, { status: "IN_PROGRESS", count: 2 },
  { status: "READY_FOR_APPROVAL", count: 1 }, { status: "COMPLETED", count: 3 },
]), { total: 7, pending: 4, inProgress: 2, awaitingApproval: 1, changesRequested: 0, completed: 3, cancelled: 0 });
assert.match(formatAsaCommandReply("consultar_relatorio_tarefas", JSON.stringify({ period: "7d", startDate: "2026-09-22", endDate: "2026-09-28", total: 7, pending: 4, inProgress: 2, awaitingApproval: 1, changesRequested: 0, completed: 3 })), /7 no total, 4 pendentes/);
const contextualCheckInReport = resolveAsaCommand("o que tenho aqui?", "2026-09-26", true, "/admin/insights", "ADMIN");
assert.equal(contextualCheckInReport.kind, "command");
if (contextualCheckInReport.kind === "command") assert.deepEqual(contextualCheckInReport.command.input, { period: "7d" });
assert.deepEqual(checkInPeriodDates("7d", new Date("2026-09-28T12:00:00-03:00")), { startDate: "2026-09-22", endDate: "2026-09-28" });
assert.deepEqual(summarizeCheckIns([{ status: "CHECKED_IN" }, { status: "LATE" }, { status: "ABSENT" }, { status: "EXPECTED" }]), {
  total: 4, checkedIn: 1, late: 1, absent: 1, excused: 0, expected: 1,
  rates: { presence: 33.3, late: 33.3, absence: 33.3, excused: 0 },
});
for (const [suggestion, manager] of [
  ["Meu dia hoje", false],
  ["Minhas mensagens não lidas", false],
  ["Mostra a agenda de hoje", false],
  ["Minhas folgas deste mês", false],
  ["Quais são minhas tarefas pendentes?", false],
  ["Qual é minha escala essa semana?", false],
  ["Minhas solicitações", false],
  ["Minhas notificações não lidas", false],
  ["Buscar na biblioteca escala", false],
  ["Mostra o Livro do Dia de hoje", false],
  ["Meus avisos", false],
  ["Quem está de folga hoje?", true],
  ["Mostra as tarefas pendentes da equipe", true],
  ["Mostra os check-ins da equipe hoje", true],
] as const) {
  assert.notEqual(resolveAsaCommand(suggestion, "2026-09-26", manager).kind, "unsupported", suggestion);
}
const personalRequests = resolveAsaCommand("Minhas solicitações", "2026-09-26", false);
assert.equal(personalRequests.kind, "command");
if (personalRequests.kind === "command") {
  assert.equal(personalRequests.command.tool, "consultar_solicitacoes");
  assert.deepEqual(personalRequests.command.input, { limit: 20 });
}
const contextualRequests = resolveAsaCommand("o que tenho aqui?", "2026-09-26", false, "/membro/solicitacoes");
assert.equal(contextualRequests.kind, "command");
if (contextualRequests.kind === "command") assert.equal(contextualRequests.command.tool, "consultar_solicitacoes");
const contextualNotifications = resolveAsaCommand("o que tenho aqui?", "2026-09-26", false, "/notificacoes");
assert.equal(contextualNotifications.kind, "command");
if (contextualNotifications.kind === "command") assert.deepEqual(contextualNotifications.command.input, { unreadOnly: true, limit: 20 });
const contextualLibrary = resolveAsaCommand("o que tenho aqui?", "2026-09-26", false, "/membro/biblioteca");
assert.equal(contextualLibrary.kind, "clarification");
const contextualShellLibrary = resolveAsaCommand("o que tenho aqui?", "2026-09-26", false, "/biblioteca");
assert.equal(contextualShellLibrary.kind, "clarification", "a Biblioteca do shell atual deve pedir o assunto da busca em vez de rejeitar o contexto");
assert.equal(resolveAsaCommand("o que tenho aqui?", "2026-09-26", true, "/admin/library").kind, "clarification");
assert.equal(resolveAsaCommand("o que tenho aqui?", "2026-09-26", false, "/biblioteca").kind, "clarification");
const librarySearch = resolveAsaCommand("buscar na biblioteca regras de segurança", "2026-09-26", false);
assert.equal(librarySearch.kind, "command");
if (librarySearch.kind === "command") {
  assert.equal(librarySearch.command.tool, "consultar_biblioteca");
  assert.deepEqual(librarySearch.command.input, { query: "regras de seguranca", limit: 10 });
}
const pendingLibraryReads = resolveAsaCommand("Quais leituras estão pendentes na Biblioteca?", "2026-09-26", false);
assert.equal(pendingLibraryReads.kind, "command");
if (pendingLibraryReads.kind === "command") {
  assert.equal(pendingLibraryReads.command.tool, "consultar_minhas_leituras_pendentes_biblioteca");
  assert.deepEqual(pendingLibraryReads.command.input, { limit: 10 });
}
assert.match(formatAsaCommandReply("consultar_minhas_leituras_pendentes_biblioteca", JSON.stringify({ docs: [{ id: "123e4567-e89b-12d3-a456-426614174000", title: "Manual de segurança" }] })), /Manual de segurança/);
assert.match(formatAsaCommandReply("consultar_minhas_leituras_pendentes_biblioteca", JSON.stringify({ docs: [] })), /não tem confirmações de leitura pendentes/i);
const libraryLocationSearch = resolveAsaCommand('Busque na Biblioteca procedimentos de segurança no local "Teatro"', "2026-09-26", false);
assert.equal(libraryLocationSearch.kind, "command");
if (libraryLocationSearch.kind === "command") assert.deepEqual(libraryLocationSearch.command.input, { query: "procedimentos de seguranca", locationName: "Teatro", limit: 10 });
assert.equal(parseAsaLibrarySearchRequest("documentos no local Teatro").kind, "clarification");
assert.deepEqual(parseAsaLibrarySearchRequest('mostre os documentos do local "Teatro"'), { kind: "request", query: "", locationName: "Teatro" });
assert.deepEqual(parseAsaLibrarySearchRequest('documentos no local "Local Central"'), { kind: "request", query: "", locationName: "Local Central" });
assert.equal(parseAsaLibrarySearchRequest('documentos no local "Teatro" e no local "Anexo"').kind, "clarification");
assert.equal(normalizeAsaText("São João"), normalizeAsaText("sao joao"), "comparação exata de local tolera diferenças de acentuação");
assert.equal(resolveAsaCommand("buscar na biblioteca", "2026-09-26", false).kind, "clarification");
const libraryOverview = resolveAsaCommand("qual o estado da biblioteca?", "2026-09-26", true, "", "ADMIN");
assert.equal(libraryOverview.kind, "command");
if (libraryOverview.kind === "command") {
  assert.equal(libraryOverview.command.tool, "consultar_estado_biblioteca");
  assert.deepEqual(libraryOverview.command.input, { limit: 5 });
}
assert.equal(resolveAsaCommand("quais documentos estao desatualizados na biblioteca?", "2026-09-26", false, "", "MEMBER").kind, "unsupported");

const ownFolgas = resolveAsaCommand("quais são minhas folgas?", "2026-09-26", false);
assert.equal(ownFolgas.kind, "command");
if (ownFolgas.kind === "command") {
  assert.equal(ownFolgas.command.tool, "consultar_folgas");
  assert.deepEqual(ownFolgas.command.input, { dateFrom: "2026-09-26", dateTo: "2026-10-26", limit: 20 });
}
const ownFolgasThisWeek = resolveAsaCommand("minhas folgas desta semana", "2026-09-26", false);
assert.equal(ownFolgasThisWeek.kind, "command");
if (ownFolgasThisWeek.kind === "command") assert.deepEqual(ownFolgasThisWeek.command.input, { dateFrom: "2026-09-21", dateTo: "2026-09-27", limit: 20 });
const ownFolgasThisMonth = resolveAsaCommand("minhas folgas deste mês", "2026-09-26", false);
assert.equal(ownFolgasThisMonth.kind, "command");
if (ownFolgasThisMonth.kind === "command") assert.deepEqual(ownFolgasThisMonth.command.input, { dateFrom: "2026-09-01", dateTo: "2026-09-30", limit: 20 });
const ownFolgasNextMonth = resolveAsaCommand("minhas folgas mês que vem", "2026-09-26", false);
assert.equal(ownFolgasNextMonth.kind, "command");
if (ownFolgasNextMonth.kind === "command") assert.deepEqual(ownFolgasNextMonth.command.input, { dateFrom: "2026-10-01", dateTo: "2026-10-31", limit: 20 });
const ownFolgasPreviousMonth = resolveAsaCommand("minhas folgas mês passado", "2026-09-26", false);
assert.equal(ownFolgasPreviousMonth.kind, "command");
if (ownFolgasPreviousMonth.kind === "command") assert.deepEqual(ownFolgasPreviousMonth.command.input, { dateFrom: "2026-08-01", dateTo: "2026-08-31", limit: 20 });
const ownFolgasPreviousYear = resolveAsaCommand("minhas folgas mês passado", "2026-01-15", false);
assert.equal(ownFolgasPreviousYear.kind, "command");
if (ownFolgasPreviousYear.kind === "command") assert.deepEqual(ownFolgasPreviousYear.command.input, { dateFrom: "2025-12-01", dateTo: "2025-12-31", limit: 20 });
const ownResponsibilities = resolveAsaCommand("quais são minhas responsabilidades?", "2026-09-26", false);
assert.equal(ownResponsibilities.kind, "command");
if (ownResponsibilities.kind === "command") {
  assert.equal(ownResponsibilities.command.tool, "consultar_responsabilidades");
  assert.deepEqual(ownResponsibilities.command.input, { mine: true });
}
const unreadMessages = resolveAsaCommand("quais são minhas mensagens não lidas?", "2026-09-26", false);
assert.equal(unreadMessages.kind, "command");
if (unreadMessages.kind === "command") {
  assert.equal(unreadMessages.command.tool, "consultar_mensagens");
  assert.deepEqual(unreadMessages.command.input, { unreadOnly: true, limit: 20 });
}
const senderMessages = resolveAsaCommand("mensagens da Ana", "2026-09-26", false);
assert.equal(senderMessages.kind, "command");
if (senderMessages.kind === "command") assert.deepEqual(senderMessages.command.input, { senderName: "Ana", limit: 20 });
const senderAndTextMessages = resolveAsaCommand("mensagens com a Ana sobre ‘figurino’", "2026-09-26", false);
assert.equal(senderAndTextMessages.kind, "command");
if (senderAndTextMessages.kind === "command") assert.deepEqual(senderAndTextMessages.command.input, { senderName: "Ana", query: "figurino", limit: 20 });
const quotedMessageSearch = resolveAsaCommand("busque nas mensagens por ‘figurino’", "2026-09-26", false);
assert.equal(quotedMessageSearch.kind, "command");
if (quotedMessageSearch.kind === "command") assert.deepEqual(quotedMessageSearch.command.input, { query: "figurino", limit: 20 });
assert.equal(resolveAsaCommand("minhas mensagens", "2026-09-26", false).kind, "clarification");
const ownNotices = resolveAsaCommand("quais são meus avisos?", "2026-09-26", false);
assert.equal(ownNotices.kind, "command");
if (ownNotices.kind === "command") {
  assert.equal(ownNotices.command.tool, "consultar_avisos");
  assert.deepEqual(ownNotices.command.input, { limit: 10 });
}
const ownUnreadNotifications = resolveAsaCommand("minhas notificações não lidas", "2026-09-26", false);
assert.equal(ownUnreadNotifications.kind, "command");
if (ownUnreadNotifications.kind === "command") assert.deepEqual(ownUnreadNotifications.command.input, { unreadOnly: true, limit: 20 });

const formatted = formatAsaCommandReply("consultar_tarefas", JSON.stringify({
  found: true,
  total: 1,
  tarefas: [{ title: "Separar figurinos", dueDate: "2026-09-28", status: "IN_PROGRESS" }],
}));
assert.match(formatted, /Separar figurinos/);
assert.match(formatted, /28\/09/);
const detailedTasksReply = formatAsaCommandReply("consultar_tarefas", JSON.stringify({
  tarefas: [{ title: "Revisar figurinos", dueDate: "2026-09-28", status: "READY_FOR_APPROVAL", priority: "HIGH", responsibilityTitle: "Figurino", operationName: "Teatro Central", origin: "LIBRARY" }],
}));
assert.match(detailedTasksReply, /Revisar figurinos · prazo 28\/09 · aguardando aprovação · prioridade alta · Figurino · Teatro Central · origem biblioteca/);
assert.match(formatAsaCommandReply("consultar_tarefa_requisitos", JSON.stringify({
  found: true,
  title: "Separar figurinos",
  status: "IN_PROGRESS",
  requiresApproval: true,
  itensPendentes: ["Conferir etiquetas"],
  evidenciasPendentes: ["Foto final"],
})), /Checklist obrigatória:\n• Conferir etiquetas\nEvidências obrigatórias:\n• Foto final/);
assert.match(formatAsaCommandReply("consultar_tarefa_requisitos", JSON.stringify({
  found: true,
  title: "Separar figurinos",
  status: "IN_PROGRESS",
  requiresApproval: true,
  itensPendentes: [],
  evidenciasPendentes: [],
})), /Você já pode enviá-la para aprovação/);
const teamTasksReply = formatAsaCommandReply("consultar_tarefas_equipe", JSON.stringify({
  tarefas: [{ title: "Conferir equipamentos", assigneeName: "Lia", dueDate: "2026-09-29", status: "IN_PROGRESS", priority: "CRITICAL", operationName: "Teatro Central" }],
}));
assert.match(teamTasksReply, /Tarefas da equipe \(1\):/);
assert.match(teamTasksReply, /Conferir equipamentos · Lia · prazo 29\/09 · em andamento · prioridade critical · Teatro Central/);
const teamResponsibilitiesReply = formatAsaCommandReply("consultar_responsabilidades_equipe", JSON.stringify({
  responsabilidades: [{ name: "Fechamento da oficina", areaName: "Produção", responsaveis: [{ name: "Lia", role: "PRIMARY" }] }],
}));
assert.match(teamResponsibilitiesReply, /Responsabilidades da equipe \(1\):/);
assert.match(teamResponsibilitiesReply, /Fechamento da oficina · Produção · Lia · principal/);
const freeTimeReply = formatAsaCommandReply("consultar_tempo_livre", JSON.stringify({
  date: "2026-09-27", mine: false, membros: [{ nome: "Lia", livres: [{ inicio: "10:00:00", fim: "11:30:00" }, { inicio: "14:00:00", fim: "15:15:00" }] }],
}));
assert.match(freeTimeReply, /Intervalos livres da equipe em 27\/09/);
assert.match(freeTimeReply, /Lia · 10:00–11:30, 14:00–15:15/);
const personalFreeTimeReply = formatAsaCommandReply("consultar_tempo_livre", JSON.stringify({
  date: "2026-09-27", mine: true, membros: [{ nome: "Lia", livres: [{ inicio: "10:00:00", fim: "11:30:00" }] }],
}));
assert.match(personalFreeTimeReply, /Seus intervalos livres em 27\/09/);
assert.match(personalFreeTimeReply, /Você · 10:00–11:30/);
assert.match(formatAsaCommandReply("consultar_agenda", JSON.stringify({
  eventos: [{ title: "Ensaio geral", date: "2026-09-28", startTime: "14:00:00", endTime: "17:00:00", location: "Galpão" }],
})), /28\/09 · 14:00–17:00 · Ensaio geral · Galpão/);
const dailyBookReply = formatAsaCommandReply("consultar_livro_do_dia", JSON.stringify({
  date: "2026-09-26",
  livros: [{
    showTitle: "A Viagem de Asa", status: "PUBLISHED", startTime: "14:00:00", endTime: "15:00:00",
    scenes: ["Abertura"],
    entries: [
      { sceneName: "Abertura", blockName: "Entrada", startTime: "14:00:00", endTime: "14:15:00", positionName: "Narradora", people: ["Lia"] },
      { sceneName: "Abertura", blockName: "Entrada", positionName: "Luz", people: [] },
    ],
  }],
}));
assert.match(dailyBookReply, /A Viagem de Asa · 14:00–15:00 · publicado/);
assert.match(dailyBookReply, /Abertura · Entrada · 14:00–14:15 · Narradora — Lia/);
assert.match(dailyBookReply, /Luz — posição em aberto/);
const myDayReply = formatAsaCommandReply("consultar_meu_dia", JSON.stringify({
  dateFrom: "2026-09-27",
  entradas: [{ data: "2026-09-27", inicio: "14:00:00", fim: "15:00:00", atividade: "A Viagem de Asa", funcao: "Narradora", origem: "Livro do Dia" }],
}));
assert.match(myDayReply, /Seu dia em 27\/09 \(1 atividade\):/);
assert.match(myDayReply, /14:00–15:00 · A Viagem de Asa · Narradora \(Livro do Dia\)/);
assert.match(formatAsaCommandReply("consultar_folgas", JSON.stringify({
  folgas: [{ startDate: "2026-10-01", endDate: "2026-10-02", type: "DAY_OFF" }],
})), /01\/10 a 02\/10 · folga/);
assert.match(formatAsaCommandReply("consultar_responsabilidades", JSON.stringify({
  responsabilidades: [{ name: "Fechamento da oficina", category: "OPERAÇÃO", role: "PRIMARY", startsAt: "2026-09-01T00:00:00.000Z", endsAt: "2026-10-31T23:59:59.000Z" }],
})), /Fechamento da oficina · operação · principal · vigência desde 01\/09 até 31\/10/);
assert.match(formatAsaCommandReply("consultar_biblioteca", JSON.stringify({
  docs: [{ id: "123e4567-e89b-12d3-a456-426614174000", title: "Segurança no gelo", version: 3, categoryName: "Segurança", locationName: "Teatro", citation: { pageNumber: 12, excerpt: "Use o equipamento fornecido." } }],
})), /Segurança no gelo · v3 · Segurança · Local: Teatro[\s\S]*Use o equipamento fornecido\.[\s\S]*Fonte: p\. 12 · v3/);
assert.match(formatAsaCommandReply("consultar_biblioteca", JSON.stringify({
  docs: [{ id: "123e4567-e89b-12d3-a456-426614174000", title: "Segurança no gelo", version: 3, summary: "Este resumo não deve ser apresentado como citação.", excerpt: "Nem este corpo." }],
})), /ainda não há um trecho com página cadastrada/);
assert.doesNotMatch(formatAsaCommandReply("consultar_biblioteca", JSON.stringify({
  docs: [{ title: "Segurança no gelo", version: 3, summary: "Este resumo não deve ser apresentado como citação.", excerpt: "Nem este corpo." }],
})), /Este resumo|Nem este corpo/);
assert.match(formatAsaCommandReply("consultar_biblioteca", JSON.stringify({
  docs: [{ id: "123e4567-e89b-12d3-a456-426614174000", title: "Segurança no gelo" }],
})), /\/admin\/search\?document=123e4567-e89b-12d3-a456-426614174000/);
assert.doesNotMatch(formatAsaCommandReply("consultar_biblioteca", JSON.stringify({
  docs: [{ id: "nao-e-uuid", title: "Documento" }],
})), /\/admin\/search\?document=/);
assert.match(formatAsaCommandReply("consultar_estado_biblioteca", JSON.stringify({ staleCount: 2, republishCount: 1, draftCount: 3, stale: [{ title: "Plano de evacuação" }], republish: [{ title: "Política revisada" }], drafts: [{ title: "Nova orientação" }] })), /Publicados para revisão há mais de 90 dias: 2[\s\S]*Alterações aguardando republicação: 1[\s\S]*Rascunhos: 3[\s\S]*Plano de evacuação[\s\S]*Política revisada[\s\S]*Nova orientação/);
assert.match(formatAsaCommandReply("consultar_estado_biblioteca", JSON.stringify({ error: "O estado geral da Biblioteca está disponível somente para Administração e Supervisão." })), /somente para Administração e Supervisão/);
assert.match(formatAsaCommandReply("consultar_mensagens", JSON.stringify({
  mensagens: [{ threadTitle: "Figurino", senderName: "Ana", content: "A prova mudou para as 15h.", createdAt: "2026-09-26T12:00:00.000Z" }],
})), /Figurino · Ana/);
assert.match(formatAsaCommandReply("consultar_mensagens", JSON.stringify({
  mensagens: [{ threadTitle: "Figurino", senderName: "Ana", content: "A prova mudou para as 15h." }],
})), /A prova mudou para as 15h/);
assert.match(formatAsaCommandReply("consultar_mensagens", JSON.stringify({ mensagens: [] })), /Não encontrei mensagens nas suas conversas/);
assert.match(formatAsaCommandReply("consultar_mensagens", JSON.stringify({ mensagens: [], unreadOnly: true })), /não tem mensagens não lidas/);
assert.match(formatAsaCommandReply("consultar_mural", JSON.stringify({
  posts: [{ type: "NOTICE", scope: "AREA", areaName: "Patinadores", title: "Troca de entrada", body: "A chamada foi alterada.", authorName: "Joana", publishedAt: "2026-09-26T12:00:00.000Z", requiresConfirmation: true, confirmedAt: null }],
})), /Aviso · Troca de entrada · Patinadores · Joana · 26\/09 · ciente pendente/);
assert.match(formatAsaCommandReply("consultar_mural", JSON.stringify({ posts: [] })), /Não encontrei publicações visíveis no Mural/);
assert.match(formatAsaCommandReply("consultar_pessoas", JSON.stringify({ pessoas: [{ name: "Ana Souza", areaName: "Patinadores", id: "nao-exibir" }] })), /Ana Souza · Patinadores/);
assert.doesNotMatch(formatAsaCommandReply("consultar_pessoas", JSON.stringify({ pessoas: [{ name: "Ana Souza", areaName: "Patinadores", id: "nao-exibir", email: "privado@example.com" }] })), /nao-exibir|privado@example.com/);
assert.match(formatAsaCommandReply("consultar_pessoas", JSON.stringify({ pessoas: [] })), /Não encontrei pessoas ativas/);
assert.match(formatAsaCommandReply("consultar_locais", JSON.stringify({ locais: [{ name: "Snowland", type: "parque" }] })), /Snowland · parque/);
assert.match(formatAsaCommandReply("consultar_locais", JSON.stringify({ locais: [], message: "Somente gestores." })), /Somente gestores/);
assert.match(formatAsaCommandReply("consultar_entregas", JSON.stringify({ entregas: [{ title: "Leitura", type: "MANDATORY_READ", status: "PUBLISHED", dueDate: "2026-10-15" }] })), /Leitura · leitura obrigatória · aguardando · prazo 15\/10/);
assert.match(formatAsaCommandReply("consultar_entregas", JSON.stringify({ entregas: [] })), /Você não tem entregas atribuídas/);
assert.match(formatAsaCommandReply("consultar_entregas", JSON.stringify({ scope: "team", entregas: [{ title: "Treinamento", type: "VIDEO", dueDate: "2026-10-15", assignedCount: 4, completedCount: 2 }] })), /Entregas da equipe \(1\).*Treinamento · vídeo · prazo 15\/10 · 4 pessoas atribuídas, 2 concluídas/s);
assert.match(formatAsaCommandReply("consultar_relatorio_checkins", JSON.stringify({ period: "7d", startDate: "2026-09-22", endDate: "2026-09-28", total: 4, checkedIn: 1, late: 1, absent: 1, excused: 0, expected: 1, rates: { presence: 33.3 } })), /1 presentes, 1 atrasados, 1 ausentes, 0 justificadas e 1 pendentes\. Presença registrada: 33\.3%/);
assert.match(formatAsaCommandReply("consultar_avisos", JSON.stringify({
  avisos: [{ title: "Mudança de entrada", urgency: "IMPORTANT", recipientStatus: "PENDING", content: "Use o portão lateral." }],
})), /Mudança de entrada · important · pending/);
assert.match(formatAsaCommandReply("consultar_solicitacoes", JSON.stringify({
  solicitacoes: [{ type: "LEAVE", status: "ALTERNATIVE_PROPOSED", targetDates: ["2026-10-02", "2026-10-03"], operationName: "Acqua" }],
})), /folga\/ausência · aguardando sua resposta · 02\/10, 03\/10 · Acqua/);
assert.match(formatAsaCommandReply("consultar_solicitacoes", JSON.stringify({ solicitacoes: [] })), /Você não tem solicitações registradas/);
assert.match(formatAsaCommandReply("consultar_ausencias_do_dia", JSON.stringify({
  date: "2026-09-27",
  message: "1 membro(s) ausente(s) em 2026-09-27.",
  ausencias: [{ userName: "Mariela", type: "DAY_OFF" }],
})), /Mariela · folga/);

console.log("ASA command engine tests passed");
