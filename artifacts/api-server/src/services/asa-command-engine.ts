export type AsaCommand = {
  tool: "consultar_agenda" | "consultar_minhas_propostas_agenda" | "consultar_escalas" | "consultar_meu_dia" | "consultar_meu_checkin" | "consultar_checkins_equipe" | "consultar_livro_do_dia" | "consultar_livros_do_show" | "consultar_tarefas" | "consultar_tarefa_requisitos" | "consultar_tarefas_equipe" | "consultar_tempo_livre" | "consultar_notificacoes" | "consultar_avisos" | "consultar_mensagens" | "consultar_mural" | "consultar_pessoas" | "consultar_locais" | "consultar_entregas" | "consultar_relatorio_checkins" | "consultar_relatorio_tarefas" | "consultar_folgas" | "consultar_responsabilidades" | "consultar_responsabilidades_equipe" | "consultar_biblioteca" | "consultar_minhas_leituras_pendentes_biblioteca" | "consultar_estado_biblioteca" | "consultar_ausencias_do_dia" | "consultar_solicitacoes" | "consultar_atividades";
  input: Record<string, unknown>;
  label: string;
};

export type AsaCommandResolution =
  | { kind: "command"; command: AsaCommand }
  | { kind: "clarification"; message: string }
  | { kind: "unsupported"; message: string };

export type AsaOperationOption = { id: string; name: string };

export type AsaOperationSelection =
  | { kind: "selected"; operationId: string }
  | { kind: "clarification"; message: string }
  | { kind: "unavailable"; message: string };

export type AsaLearningParse =
  | { kind: "not_learning" }
  | { kind: "incomplete" }
  | { kind: "proposal"; phrase: string; target: string };

export type AsaLearningApprovalParse =
  | { kind: "not_approval" }
  | { kind: "incomplete" }
  | { kind: "approval"; phrase: string };

export type AsaTaskStartParse =
  | { kind: "not_action" }
  | { kind: "incomplete" }
  | { kind: "request"; title: string };

export type AsaTaskCancellationParse =
  | { kind: "not_action" }
  | { kind: "incomplete" }
  | { kind: "request"; title: string; reason: string };

export type AsaTaskCommentParse =
  | { kind: "not_action" }
  | { kind: "incomplete" }
  | { kind: "request"; title: string; content: string };

export type AsaTaskCommentsQueryParse =
  | { kind: "not_query" }
  | { kind: "incomplete" }
  | { kind: "request"; title: string };

export type AsaTaskEvidenceLinkParse =
  | { kind: "not_action" }
  | { kind: "incomplete" }
  | { kind: "request"; title: string; url: string; description: string };

export type AsaTaskSubmitForApprovalParse =
  | { kind: "not_action" }
  | { kind: "incomplete" }
  | { kind: "request"; title: string };

export type AsaTaskCompletionParse =
  | { kind: "not_action" }
  | { kind: "incomplete" }
  | { kind: "request"; title: string };

export type AsaAgendaMeetingParse =
  | { kind: "not_action" }
  | { kind: "incomplete" }
  | { kind: "request"; title: string; date: string; startTime: string; endTime: string; areaName?: string; locationName?: string };

export type AsaAgendaDraftRenameParse =
  | { kind: "not_action" }
  | { kind: "incomplete" }
  | { kind: "request"; title: string; newTitle: string };

export type AsaAgendaDraftScheduleParse =
  | { kind: "not_action" }
  | { kind: "incomplete" }
  | { kind: "request"; title: string; date: string; startTime: string; endTime: string };

export type AsaAgendaSupervisorScope = {
  areaId: string;
  areaName: string;
  locationId: string;
  locationName: string;
};

export type AsaAgendaSupervisorScopeResolution =
  | { kind: "selected"; scope: AsaAgendaSupervisorScope }
  | { kind: "unavailable" }
  | { kind: "clarification" };

export type AsaMuralAckParse =
  | { kind: "not_action" }
  | { kind: "incomplete" }
  | { kind: "request"; title: string };

export type AsaMuralReactionParse = AsaMuralAckParse;

export type AsaMuralCommentParse =
  | { kind: "not_action" }
  | { kind: "incomplete" }
  | { kind: "request"; title: string; content: string };

export type AsaNoticeDraftParse =
  | { kind: "not_action" }
  | { kind: "incomplete" }
  | { kind: "proposal"; title: string; content: string };

export type AsaNoticeDraftUpdateParse =
  | { kind: "not_action" }
  | { kind: "incomplete" }
  | { kind: "request"; title: string; newTitle: string; content: string };

export type AsaDirectMessageParse =
  | { kind: "not_action" }
  | { kind: "incomplete" }
  | { kind: "proposal"; recipientName: string; title: string; content: string };

export type AsaMessageReplyParse =
  | { kind: "not_action" }
  | { kind: "incomplete" }
  | { kind: "proposal"; threadTitle: string; content: string };

export const ASA_TASK_EVIDENCE_TYPES = ["PHOTO", "VIDEO", "DOCUMENT", "PDF", "LINK", "AUDIO", "PRESENTATION"] as const;
export type AsaTaskEvidenceType = typeof ASA_TASK_EVIDENCE_TYPES[number];

export type AsaTaskDraftParse =
  | { kind: "not_action" }
  | { kind: "incomplete" }
  | { kind: "proposal"; title: string; assigneeName: string; dueDate: string; priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"; description?: string; responsibilityTitle?: string; checklistLabels: string[]; mandatoryEvidences: Array<{ type: AsaTaskEvidenceType; description: string }> };

export type AsaTaskDueDateUpdateParse =
  | { kind: "not_action" }
  | { kind: "incomplete" }
  | { kind: "request"; title: string; dueDate: string };

export type AsaTaskAssigneeUpdateParse =
  | { kind: "not_action" }
  | { kind: "incomplete" }
  | { kind: "request"; title: string; assigneeName: string };

export type AsaTaskPriorityUpdateParse =
  | { kind: "not_action" }
  | { kind: "incomplete" }
  | { kind: "request"; title: string; priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" };

export type AsaTaskDescriptionUpdateParse =
  | { kind: "not_action" }
  | { kind: "incomplete" }
  | { kind: "request"; title: string; description: string };

export type AsaTaskTitleUpdateParse =
  | { kind: "not_action" }
  | { kind: "incomplete" }
  | { kind: "request"; title: string; newTitle: string };

export type AsaTaskRequirementsUpdateParse =
  | { kind: "not_action" }
  | { kind: "incomplete" }
  | { kind: "request"; title: string; checklistLabels: string[]; mandatoryEvidences: Array<{ type: AsaTaskEvidenceType; description: string }> };

export type AsaTaskResponsibilityUpdateParse =
  | { kind: "not_action" }
  | { kind: "incomplete" }
  | { kind: "request"; title: string; responsibilityTitle: string | null };

export type AsaTaskChecklistUpdateParse =
  | { kind: "not_action" }
  | { kind: "incomplete" }
  | { kind: "request"; title: string; itemLabel: string; checklistKind: "mandatory" | "operational"; completed: boolean };

export type AsaLibrarySearchParse =
  | { kind: "clarification"; message: string }
  | { kind: "request"; query: string; locationName?: string };

type Intent = { key: AsaCommand["tool"]; patterns: RegExp[]; label: string };

const INTENTS: Intent[] = [
  { key: "consultar_minhas_propostas_agenda", label: "suas propostas de reunião na Agenda", patterns: [
    /\b(minhas|minha) propostas?\b.*\b(reuniao|reunioes|agenda)\b/,
    /\b(reuniao|reunioes|agenda)\b.*\bpropostas?\b.*\b(minhas|minha)\b/,
  ] },
  { key: "consultar_agenda", label: "a agenda da operação", patterns: [/\bagenda\b/, /\bcompromissos da operacao\b/] },
  { key: "consultar_meu_dia", label: "seu Meu Dia", patterns: [/\bmeu dia\b/, /\bminha programacao\b/] },
  { key: "consultar_meu_checkin", label: "seu check-in", patterns: [/\bmeu check ?-?in\b/, /\bminha presenca\b/, /\bfiz check ?-?in\b/] },
  { key: "consultar_checkins_equipe", label: "check-ins da equipe", patterns: [/\b(check ?-?ins?|presencas?)\b.*\b(da equipe|da operacao|dos membros)\b/, /\b(quem|equipe|membros)\b.*\b(check ?-?in|compareceu|presente)\b/] },
  { key: "consultar_livros_do_show", label: "os Livros do Show disponíveis", patterns: [/\blivros? do show\b/, /\bshows? cadastrados?\b/] },
  { key: "consultar_livro_do_dia", label: "o Livro do Dia", patterns: [/\blivro do dia\b/, /\bconteudo do show\b/, /\broteiro do show\b/] },
  { key: "consultar_atividades", label: "as atividades recorrentes da operação", patterns: [/\batividades recorrentes\b/, /\b(atividades|programacao)\b.*\b(da equipe|da operacao)\b/, /\b(da equipe|da operacao)\b.*\b(atividades|programacao)\b/] },
  { key: "consultar_escalas", label: "sua escala", patterns: [/\bminha escala\b/, /\bescala desta semana\b/, /\bescala dessa semana\b/, /\bescala da semana\b/, /\bonde estou escalad[oa]\b/] },
  { key: "consultar_tarefas_equipe", label: "as tarefas da equipe", patterns: [/\btarefas\b.*\bda equipe\b/, /\btarefas\b.*\bda operacao\b/] },
  { key: "consultar_tarefa_requisitos", label: "o que falta para concluir uma tarefa sua", patterns: [/\bo que falta\b.*\btarefa\b/, /\b(itens?|checklist) pendentes\b.*\btarefa\b/, /\bchecklist\b.*\btarefa\b/] },
  { key: "consultar_tarefas", label: "suas tarefas", patterns: [/\bminhas tarefas\b/, /\btarefas pendentes\b/, /\btarefas\b.*\b(vencidas|atrasadas|hoje|amanha|ontem|esta semana|desta semana|da semana|semana que vem|proxima semana|proximos (3|tres) dias|este mes|deste mes|mes que vem|proximo mes|\d{1,2}\/\d{1,2}|concluidas|finalizadas|em andamento|aguardando aprovacao)\b/, /\bo que tenho para fazer\b/, /\bo que preciso fazer\b/] },
  { key: "consultar_solicitacoes", label: "suas solicitações", patterns: [/\bminhas solicitacoes\b/, /\bmeus pedidos\b/, /\bstatus das minhas solicitacoes\b/, /\bcomo esta minha solicitacao\b/] },
  { key: "consultar_responsabilidades_equipe", label: "as responsabilidades da equipe", patterns: [/\bresponsabilidades\b.*\bda equipe\b/, /\bresponsabilidades\b.*\bda operacao\b/, /\bresponsabilidades\b.*\b(equipe|operacao)\b/, /\bresponsabilidades\b.*\bsem (responsavel|atribuicao)\b/, /\bsem (responsavel|atribuicao)\b.*\bresponsabilidades\b/] },
  { key: "consultar_responsabilidades", label: "suas responsabilidades", patterns: [/\bminhas responsabilidades\b/, /\bpor que sou responsavel\b/, /\bo que sou responsavel\b/] },
  { key: "consultar_minhas_leituras_pendentes_biblioteca", label: "suas leituras pendentes da Biblioteca", patterns: [
    /\b(documentos?|leituras?)\b.*\b(preciso|tenho que|devo)\b.*\b(confirmar|dar ciente|marcar leitura)\b/,
    /\b(confirmacoes?|leituras?)\b.*\bpendentes\b.*\bbiblioteca\b/,
    /\bbiblioteca\b.*\b(leitura|confirmacao|ciente)\b.*\bpendentes?\b/,
  ] },
  { key: "consultar_estado_biblioteca", label: "estado dos documentos da Biblioteca", patterns: [/\b(estado|situacao|status|revisao|desatualizados|rascunhos|atualizacoes)\b.*\bbiblioteca\b/, /\bbiblioteca\b.*\b(estado|situacao|status|revisao|desatualizados|rascunhos|atualizacoes)\b/] },
  { key: "consultar_biblioteca", label: "documentos publicados da biblioteca", patterns: [/\b(buscar|busque|pesquisar|pesquise|procura|procure) na biblioteca\b/, /\bdocumentos? sobre\b/, /\bregulamento de\b/, /\b(biblioteca|documentos?)\b.*\blocal\b/, /\blocal\b.*\b(biblioteca|documentos?)\b/] },
  { key: "consultar_mensagens", label: "suas mensagens", patterns: [/\bminhas mensagens\b/, /\bmensagens\b/, /\bconversas\b/] },
  { key: "consultar_mural", label: "publicações visíveis no Mural", patterns: [/\bmural\b/] },
  { key: "consultar_pessoas", label: "pessoas da organização", patterns: [/\b(buscar|busque|pesquisar|pesquise|procurar|procure) (pessoas|alguem)\b/, /\b(pessoas|alguem) (da area|com nome|chamada|chamado)\b/] },
  { key: "consultar_locais", label: "locais autorizados", patterns: [/\b(locais|local operacional)\b/, /\b(buscar|busque|pesquisar|pesquise|procurar|procure) local\b/] },
  { key: "consultar_entregas", label: "suas entregas", patterns: [/\b(minhas entregas|entregas para mim|o que tenho para entregar)\b/, /\bentregas\b.*\b(da equipe|da operacao)\b/] },
  { key: "consultar_relatorio_checkins", label: "resumo de check-ins dos últimos dias", patterns: [/\b(relatorio|resumo)\b.*\b(check ?-?ins?|presencas?)\b/] },
  { key: "consultar_relatorio_tarefas", label: "resumo agregado de tarefas", patterns: [/\b(relatorio|resumo|indicadores)\b.*\btarefas\b/, /\bcomo estao as tarefas\b/] },
  { key: "consultar_avisos", label: "seus avisos publicados", patterns: [/\bmeus avisos\b/, /\bavisos para mim\b/, /\bavisos publicados para mim\b/] },
  { key: "consultar_notificacoes", label: "suas notificações", patterns: [/\bminhas notificacoes\b/, /\bminhas notificacoes nao lidas\b/, /\bnotificacoes nao lidas\b/] },
  { key: "consultar_folgas", label: "suas folgas", patterns: [/\bminhas folgas\b/, /\bminhas ausencias\b/, /\bestou de folga\b/] },
  { key: "consultar_ausencias_do_dia", label: "as folgas da equipe", patterns: [/\bquem esta de folga\b/, /\bfolgas da equipe\b/] },
  { key: "consultar_tempo_livre", label: "intervalos livres na escala", patterns: [/\bmeu tempo livre\b/, /\bmeus intervalos livres\b/, /\bquando estou livre\b/, /\btenho intervalo livre\b/, /\bintervalo livre\b/, /\btempo livre\b/, /\bquem esta livre\b/, /\btempo livre da equipe\b/, /\bintervalos livres da equipe\b/] },
];

export const ASA_UNRECOGNIZED_COMMAND_REPLY = "Ainda não sei fazer essa consulta. Posso consultar seu Meu Dia, agenda, escala, tarefas, folgas, mensagens, avisos, notificações, Livros do Show, Biblioteca e Mural; alguns dados da equipe dependem da sua permissão.";

export function isAsaCapabilityRequest(value: string): boolean {
  const normalized = normalizeAsaText(value);
  return /^(?:ajuda|me ajude|me ajuda|como uso a asa|como posso usar a asa|o que a asa faz|o que a asa consegue fazer|o que voce consegue fazer|o que voce sabe fazer|como voce pode me ajudar|o que posso pedir para a asa|quais comandos posso usar)$/.test(normalized);
}

export function canManageAsaAgenda(role: string): boolean {
  return ["ADMIN", "DIR", "DIRECTOR", "SUPERVISOR_A", "SUPERVISOR_B"].includes(role);
}

export function formatAsaCapabilityReply(role: string): string {
  const taskManagers = ["ADMIN", "DIR", "SUPERVISOR_A", "SUPERVISOR_B"].includes(role);
  const noticeManagers = ["ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"].includes(role);
  const agendaManagers = canManageAsaAgenda(role);
  const parts = [
    "Posso consultar seu Meu Dia, agenda e suas propostas de reunião, escala, Livro do Dia, Livros do Show visíveis na operação, check-in, tarefas (inclusive o que falta para concluir as suas e os comentários de uma tarefa no seu escopo), responsabilidades, folgas, solicitações, entregas, mensagens, avisos, notificações, Mural visível, documentos da Biblioteca no seu escopo e suas leituras obrigatórias pendentes.",
    "Conforme seu papel, suas delegações e a operação selecionada, também posso consultar dados da equipe e alguns relatórios.",
    "Você pode ajustar suas preferências pessoais da ASA, como sugestões, saudações, lembretes, notificações, frequência e proatividade; toda mudança mostra uma prévia e aguarda sua confirmação. Também pode pedir para iniciar uma tarefa pela qual é responsável, atualizar itens das próprias checklists, concluí-la após checklist/evidências quando ela não exige aprovação, ou submetê-la à aprovação quando ela exige; comentar em tarefa da qual seja criador, responsável ou aprovador, ou na área sob gestão autorizada; anexar um link complementar a uma tarefa no seu escopo (não substitui evidência obrigatória); dar ciente de aviso visível, reagir com coração a uma publicação do Mural ou preparar um comentário explícito para publicação visível no Mural após sua confirmação, ou propor um atalho pessoal para uma consulta existente.",
    "Para iniciar uma conversa direta, informe o nome exato, o assunto e o texto; para responder, cite o título exato da conversa. Em ambos os casos mostro o texto e os destinatários antes e só envio após sua confirmação.",
    "Na Agenda, posso preparar uma reunião: Elenco envia uma proposta na própria área; Administração, Direção e Supervisão autorizada criam um rascunho. Não publico nem convoco pessoas por conta própria.",
  ];
  if (agendaManagers) {
    parts.push("Com gestão autorizada na operação, também posso renomear um rascunho de reunião, alterar sua data, horário ou observações; mostro a prévia e aguardo confirmação. O evento continua como rascunho.");
  }
  if (taskManagers) {
    parts.push("Com escopo autorizado, também posso listar as responsabilidades ativas da equipe e suas atribuições atuais.");
    parts.push("Com autorização de gestão para a operação e a área, você também pode preparar tarefas (inclusive vinculadas a uma responsabilidade ativa existente) e alterar título, responsável, prazo, prioridade, descrição, checklist e evidências obrigatórias; também pode propor cancelamentos com motivo. Sempre mostro uma prévia e aguardo sua confirmação.");
  }
  if (noticeManagers) {
    parts.push("Administração e Supervisão podem preparar e editar rascunhos de aviso identificados pelo título exato; toda edição mostra o antes e depois e aguarda confirmação. Avisos publicados não são editados nem publicados pela ASA.");
  }
  if (["ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"].includes(role)) {
    parts.push("Também posso consultar as atividades recorrentes ativas da operação selecionada.");
  }
  parts.push("Não envio mensagens sem sua confirmação explícita nem altero Agenda ou Escala por conta própria.");
  return parts.join("\n\n");
}

export function normalizeAsaText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^\p{L}\p{N}/\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function resolveAsaAgendaSupervisorScope(
  hasActiveMembership: boolean,
  scopes: AsaAgendaSupervisorScope[],
  areaName?: string,
  locationName?: string,
): AsaAgendaSupervisorScopeResolution {
  if (!hasActiveMembership || scopes.length === 0) return { kind: "unavailable" };
  if (Boolean(areaName) !== Boolean(locationName)) return { kind: "clarification" };
  const matches = areaName && locationName
    ? scopes.filter((scope) => normalizeAsaText(scope.areaName) === normalizeAsaText(areaName)
      && normalizeAsaText(scope.locationName) === normalizeAsaText(locationName))
    : scopes;
  if (matches.length !== 1) return { kind: "clarification" };
  return { kind: "selected", scope: matches[0]! };
}

export function parseAsaUnrecognizedReviewRequest(value: string): boolean {
  const normalized = normalizeAsaText(value);
  return /^(?:quais|mostre|listar|liste|consultar|consulte|ver|quero ver)\b.*\b(pedidos|comandos|consultas|perguntas|frases)\b.*\b(nao reconhecid[oa]s?|nao entendeu|nao reconheceu)\b/.test(normalized)
    || /^o que\b.*\b(nao reconheceu|nao entendeu)\b/.test(normalized);
}

export function isAsaUnrecognizedCommandResolution(resolution: AsaCommandResolution): boolean {
  return resolution.kind === "unsupported" && resolution.message === ASA_UNRECOGNIZED_COMMAND_REPLY;
}

function quotedPhrases(value: string): string[] {
  return [...value.matchAll(/["“‘]([^"”’]+)["”’]/g)]
    .map((match) => match[1]!.trim())
    .filter(Boolean);
}

export function parseAsaLibrarySearchRequest(value: string): AsaLibrarySearchParse {
  const locationMatches = [...value.matchAll(/\b(?:no|na|do|da)\s+local\s+["“‘]([^"”’]+)["”’]/gi)];
  const remainingText = locationMatches.length === 1 ? value.replace(locationMatches[0]![0], " ") : value;
  const unresolvedLocationMention = /\blocal\b/i.test(remainingText);
  if (locationMatches.length > 1 || unresolvedLocationMention) {
    return { kind: "clarification", message: "Para pesquisar documentos de um local, diga o nome exato entre aspas e escolha um local ao qual sua conta tenha acesso. Exemplo: buscar na Biblioteca procedimentos no local \"Teatro\"." };
  }
  const locationName = locationMatches[0]?.[1]?.trim();
  if (locationName && locationName.length > 120) {
    return { kind: "clarification", message: "O nome do local está muito longo. Informe o nome exato e curto do local entre aspas." };
  }
  const withoutLocation = locationMatches.length ? value.replace(locationMatches[0]![0], " ") : value;
  const query = normalizeAsaText(withoutLocation)
    .replace(/^(?:(?:eu\s+)?quero\s+)?(?:buscar|busque|pesquisar|pesquise|procura|procure)\s*/, "")
    .replace(/^(?:(?:eu\s+)?quero\s+)?(?:ver|consultar|mostre|mostrar|liste|listar|o que tem)\s*/, "")
    .replace(/^(?:na|em)\s+biblioteca\s*/, "")
    .replace(/^(?:os?\s+)?(?:documentos?|regulamento)\b\s*/, "")
    .replace(/^(?:sobre|assunto|de)\b\s*/, "")
    .trim();
  return { kind: "request", query, ...(locationName ? { locationName } : {}) };
}

export function parseAsaMuralAckRequest(value: string): AsaMuralAckParse {
  const normalized = normalizeAsaText(value);
  if (!/\b(dar|de|registre|registrar|confirme|confirmar)\b/.test(normalized)
    || !/\b(ciente|leitura)\b/.test(normalized)
    || !/\b(aviso|mural)\b/.test(normalized)
    || /\bnao\b/.test(normalized)) return { kind: "not_action" };
  const phrases = quotedPhrases(value);
  if (phrases.length !== 1 || phrases[0]!.length > 180) return { kind: "incomplete" };
  return { kind: "request", title: phrases[0]!.trim() };
}

export function parseAsaMuralReactionRequest(value: string): AsaMuralReactionParse {
  const normalized = normalizeAsaText(value);
  if (!/^(?:reaja|reagir|reage|curta|curtir)\b/.test(normalized)
    || !/\b(?:aviso|mural|publicacao)\b/.test(normalized)) return { kind: "not_action" };
  if (/\bnao\b/.test(normalized)) return { kind: "not_action" };
  const phrases = quotedPhrases(value);
  if (phrases.length !== 1 || phrases[0]!.length > 180) return { kind: "incomplete" };
  return { kind: "request", title: phrases[0]!.trim() };
}

export function parseAsaMuralCommentRequest(value: string): AsaMuralCommentParse {
  const normalized = normalizeAsaText(value);
  if (!/^(?:comente|comentar|escreva|escrever)\b/.test(normalized)
    || !/\b(?:aviso|mural|publicacao)\b/.test(normalized)) return { kind: "not_action" };
  if (/\bnao\b/.test(normalized)) return { kind: "not_action" };
  if (!/\b(?:comentario|texto)\b/.test(normalized)) return { kind: "incomplete" };
  const phrases = quotedPhrases(value);
  if (phrases.length !== 2) return { kind: "incomplete" };
  const [title, content] = phrases.map((phrase) => phrase.trim());
  if (!title || title.length > 180 || !content || content.length > 2000) return { kind: "incomplete" };
  return { kind: "request", title, content };
}

export function parseAsaLearningRequest(value: string): AsaLearningParse {
  if (!/^(ensine|aprenda|guarde)\b/.test(normalizeAsaText(value))) return { kind: "not_learning" };
  const phrases = quotedPhrases(value);
  if (phrases.length !== 2) return { kind: "incomplete" };
  const [rawPhrase, target] = phrases;
  const phrase = normalizeAsaText(rawPhrase ?? "");
  if (phrase.length < 2 || !target || phrase.length > 80 || target.length > 160) return { kind: "incomplete" };
  return { kind: "proposal", phrase, target };
}

export function parseAsaLearningApproval(value: string): AsaLearningApprovalParse {
  if (!/^(aprovo|confirmo)\b/.test(normalizeAsaText(value))) return { kind: "not_approval" };
  if (!/\b(atalho|aprendizado|regra)\b/.test(normalizeAsaText(value))) return { kind: "not_approval" };
  const [phrase] = quotedPhrases(value);
  return phrase ? { kind: "approval", phrase: normalizeAsaText(phrase) } : { kind: "incomplete" };
}

export function parseAsaTaskStartRequest(value: string): AsaTaskStartParse {
  const normalized = normalizeAsaText(value);
  if (!/^(inicie|iniciar|comece|comecar)\b/.test(normalized)) return { kind: "not_action" };
  if (!/\btarefa\b/.test(normalized)) return { kind: "not_action" };
  const [title] = quotedPhrases(value);
  if (!title || title.length > 160) return { kind: "incomplete" };
  return { kind: "request", title: title.trim() };
}

export function parseAsaTaskCancellationRequest(value: string): AsaTaskCancellationParse {
  const normalized = normalizeAsaText(value);
  if (!/^(?:cancele|cancelar|cancela|interrompa|interromper)\b/.test(normalized)
    || !/\btarefa\b/.test(normalized)
    || /\b(?:proposta|previsao)\b/.test(normalized)) return { kind: "not_action" };
  if (/\bnao\b/.test(normalized)) return { kind: "not_action" };
  const phrases = quotedPhrases(value);
  if (phrases.length !== 2 || !/\bmotivo\b/.test(normalized)) return { kind: "incomplete" };
  const [title, reason] = phrases.map((phrase) => phrase.trim());
  if (!title || title.length > 160 || !reason || reason.length > 500) return { kind: "incomplete" };
  const normalizedBeforeReason = normalizeAsaText(value.slice(0, value.lastIndexOf('"')));
  if (!/\bmotivo\b/.test(normalizedBeforeReason)) return { kind: "incomplete" };
  return { kind: "request", title, reason };
}

export function parseAsaTaskCommentRequest(value: string): AsaTaskCommentParse {
  const normalized = normalizeAsaText(value);
  if (!/^(?:comente|comentar|adicione|adicionar)\b/.test(normalized)
    || !/\btarefa\b/.test(normalized)) return { kind: "not_action" };
  if (/\bnao\b/.test(normalized)) return { kind: "not_action" };
  const phrases = quotedPhrases(value);
  if (phrases.length !== 2 || !/\b(?:com|comentario|texto)\b/.test(normalized)) return { kind: "incomplete" };
  const [title, content] = phrases.map((phrase) => phrase.trim());
  if (!title || title.length > 160 || !content || content.length > 2000) return { kind: "incomplete" };
  return { kind: "request", title, content };
}

export function parseAsaTaskCommentsQuery(value: string): AsaTaskCommentsQueryParse {
  const normalized = normalizeAsaText(value);
  if (!/^(?:mostre|mostrar|liste|listar|consulte|consultar|ver|veja|leia|ler)\b/.test(normalized)
    || !/\bcomentarios?\b/.test(normalized) || !/\btarefa\b/.test(normalized)) return { kind: "not_query" };
  if (/\bnao\b/.test(normalized)) return { kind: "not_query" };
  const phrases = quotedPhrases(value);
  if (phrases.length !== 1) return { kind: "incomplete" };
  const title = phrases[0]!.trim();
  if (!title || title.length > 160) return { kind: "incomplete" };
  return { kind: "request", title };
}

export function formatAsaTaskCommentsReply(
  title: string,
  newestFirst: Array<{ body: string; createdAt: Date; authorName: string | null }>,
): string {
  const comments = newestFirst.slice(0, 10).reverse();
  if (!comments.length) return `A tarefa “${title}” ainda não tem comentários.`;
  const dateTime = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo",
  });
  const lines = comments.map((comment) => {
    const body = comment.body.length > 1200 ? `${comment.body.slice(0, 1200)}… (texto abreviado)` : comment.body;
    return `- ${comment.authorName ?? "Pessoa da equipe"} · ${dateTime.format(comment.createdAt)}\n${body}`;
  });
  return `Comentários da tarefa “${title}” · ${comments.length} mais recentes:\n\n${lines.join("\n\n")}`;
}

export function parseAsaTaskEvidenceLinkRequest(value: string): AsaTaskEvidenceLinkParse {
  const normalized = normalizeAsaText(value);
  if (!/^(?:anexe|anexar|adicione|adicionar|inclua|incluir)\b/.test(normalized)
    || !/\blink\b/.test(normalized) || !/\btarefa\b/.test(normalized)) return { kind: "not_action" };
  if (/\bnao\b/.test(normalized)) return { kind: "not_action" };
  const phrases = quotedPhrases(value);
  if (phrases.length !== 3 || !/\bdescricao\b/.test(normalized)) return { kind: "incomplete" };
  const [url, title, description] = phrases.map((phrase) => phrase.trim());
  if (!url || url.length > 2048 || !title || title.length > 160 || !description || description.length > 240) {
    return { kind: "incomplete" };
  }
  let parsedUrl: URL;
  try { parsedUrl = new URL(url); } catch { return { kind: "incomplete" }; }
  if ((parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:")
    || !parsedUrl.hostname || parsedUrl.username || parsedUrl.password) return { kind: "incomplete" };
  return { kind: "request", url: parsedUrl.toString(), title, description };
}

export function parseAsaTaskChecklistUpdateRequest(value: string): AsaTaskChecklistUpdateParse {
  const normalized = normalizeAsaText(value);
  const markComplete = /^(?:marque|marcar|complete|completar|assinale|assinalar)\b/.test(normalized);
  const markIncomplete = /^(?:desmarque|desmarcar|reabra|reabrir)\b/.test(normalized);
  if ((!markComplete && !markIncomplete) || !/\bchecklist\b/.test(normalized) || !/\btarefa\b/.test(normalized)) {
    return { kind: "not_action" };
  }
  const quoted = [...value.matchAll(/["“‘]([^"”’]+)["”’]/g)];
  if (quoted.length !== 2) return { kind: "incomplete" };
  const beforeFirstQuote = value.slice(0, quoted[0]!.index);
  const afterLastQuote = value.slice(quoted[1]!.index! + quoted[1]![0].length);
  const kindMatch = normalizeAsaText(beforeFirstQuote).match(/\b(obrigatorio|operacional)\b/);
  const stateMatch = normalizeAsaText(afterLastQuote).match(/^\s*[,;:]?\s*como\s+(concluido|feito|pendente|incompleto)\b/);
  if (!kindMatch || !stateMatch) return { kind: "incomplete" };
  const phrases = quoted.map((match) => match[1]!.trim()).filter(Boolean);
  if (phrases.length !== 2) return { kind: "incomplete" };
  const [itemLabel, title] = phrases.map((phrase) => phrase.trim());
  if (!itemLabel || itemLabel.length > 160 || !title || title.length > 160) return { kind: "incomplete" };
  const completed = markComplete;
  if ((completed && !["concluido", "feito"].includes(stateMatch[1]!))
    || (!completed && !["pendente", "incompleto"].includes(stateMatch[1]!))) return { kind: "incomplete" };
  return {
    kind: "request", title, itemLabel,
    checklistKind: kindMatch[1] === "obrigatorio" ? "mandatory" : "operational",
    completed,
  };
}

export function parseAsaTaskSubmitForApprovalRequest(value: string): AsaTaskSubmitForApprovalParse {
  const normalized = normalizeAsaText(value);
  if (!/^(envie|enviar|mande|mandar|submeta|submeter|encaminhe|encaminhar|marque|marcar)\b/.test(normalized)
    || !/\btarefa\b/.test(normalized) || !/\b(aprovacao|aprovar)\b/.test(normalized)) return { kind: "not_action" };
  const [title] = quotedPhrases(value);
  if (!title?.trim() || title.length > 160) return { kind: "incomplete" };
  return { kind: "request", title: title.trim() };
}

export function parseAsaTaskCompletionRequest(value: string): AsaTaskCompletionParse {
  const normalized = normalizeAsaText(value);
  if (!/^(conclua|concluir|finalize|finalizar|complete|completar|marque|marcar)\b/.test(normalized)
    || !/\btarefa\b/.test(normalized) || /\bpara aprovacao\b/.test(normalized)
    || /\bcomo nao (?:concluida|finalizada|completa)\b/.test(normalized)) return { kind: "not_action" };
  const phrases = quotedPhrases(value);
  if (phrases.length > 1) return { kind: "incomplete" };
  const plainTitle = value.trim().match(/^(?:conclua|concluir|finalize|finalizar|complete|completar|marque|marcar)\s+(?:(?:a|minha)\s+)?tarefa\s+(.+?)\s*$/i)?.[1]
    ?.replace(/\s+como\s+(?:conclu[ií]da|finalizada|completa)\s*[.!?]*$/i, "")
    .replace(/[.!?]+$/, "")
    .trim();
  const title = phrases[0]?.trim() ?? plainTitle;
  if (!title || title.length > 160) return { kind: "incomplete" };
  return { kind: "request", title };
}

export function parseAsaAgendaMeetingRequest(value: string): AsaAgendaMeetingParse {
  const normalized = normalizeAsaText(value);
  if (!/^(agende|agendar|marque|marcar|crie|criar)\b/.test(normalized)
    || !/\b(reuniao|encontro)\b/.test(normalized)) return { kind: "not_action" };
  const phrases = quotedPhrases(value);
  const dateMatch = normalized.match(/\b(?:em|dia|para)\s+(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})\b/);
  const timeMatch = value.match(/\b(?:das|de)\s+(\d{2}:\d{2})\s+(?:às|as|ate)\s+(\d{2}:\d{2})\b/i);
  if ((phrases.length !== 1 && phrases.length !== 3) || !dateMatch || !timeMatch) return { kind: "incomplete" };
  const title = phrases[0]!.trim();
  if (!title || title.length > 160) return { kind: "incomplete" };
  const rawDate = dateMatch[1]!;
  let date: string;
  if (rawDate.includes("/")) {
    const [, dayText, monthText, yearText] = rawDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)!;
    const day = Number(dayText);
    const month = Number(monthText);
    const year = Number(yearText);
    const parsed = new Date(Date.UTC(year, month - 1, day, 12));
    if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return { kind: "incomplete" };
    date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  } else {
    const [year, month, day] = rawDate.split("-").map(Number);
    const parsed = new Date(Date.UTC(year!, month! - 1, day!, 12));
    if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month! - 1 || parsed.getUTCDate() !== day) return { kind: "incomplete" };
    date = rawDate;
  }
  const startTime = timeMatch[1]!;
  const endTime = timeMatch[2]!;
  const validTime = (time: string) => {
    const [hour, minute] = time.split(":").map(Number);
    return hour! <= 23 && minute! <= 59;
  };
  if (startTime >= endTime || !validTime(startTime) || !validTime(endTime)) return { kind: "incomplete" };
  if (phrases.length === 3) {
    const areaName = phrases[1]!.trim();
    const locationName = phrases[2]!.trim();
    if (!areaName || !locationName || areaName.length > 120 || locationName.length > 120) return { kind: "incomplete" };
    return { kind: "request", title, date, startTime, endTime, areaName, locationName };
  }
  return { kind: "request", title, date, startTime, endTime };
}

export function parseAsaAgendaDraftRenameRequest(value: string): AsaAgendaDraftRenameParse {
  const normalized = normalizeAsaText(value);
  if (!/^(?:edite|editar|renomeie|renomear|altere|alterar|atualize|atualizar)\b/.test(normalized)
    || !/\brascunho\b/.test(normalized) || !/\b(reuniao|encontro)\b/.test(normalized)) return { kind: "not_action" };
  const phrases = quotedPhrases(value);
  if (phrases.length !== 2) return { kind: "incomplete" };
  const [title, newTitle] = phrases.map((phrase) => phrase.trim());
  if (!title || !newTitle || title.length > 160 || newTitle.length > 160
    || normalizeAsaText(title) === normalizeAsaText(newTitle)) return { kind: "incomplete" };
  return { kind: "request", title, newTitle };
}

export function parseAsaAgendaDraftScheduleRequest(value: string): AsaAgendaDraftScheduleParse {
  const firstQuote = value.search(/["“‘]/);
  const normalized = normalizeAsaText(firstQuote < 0 ? value : value.slice(0, firstQuote));
  if (!/^(?:edite|editar|altere|alterar|atualize|atualizar|mude|mudar)\b/.test(normalized)
    || !/\brascunho\b/.test(normalized) || !/\b(reuniao|encontro)\b/.test(normalized)
    || !/\b(data|horario)\b/.test(normalized)) return { kind: "not_action" };
  const quoted = [...value.matchAll(/["“‘]([^"”’]+)["”’]/g)];
  if (quoted.length !== 1) return { kind: "incomplete" };
  const title = quoted[0]![1]!.trim();
  if (!title || title.length > 160) return { kind: "incomplete" };
  const titleEnd = quoted[0]!.index! + quoted[0]![0]!.length;
  const commandSuffix = value.slice(titleEnd);
  const suffixNormalized = normalizeAsaText(commandSuffix);
  const dateMatch = suffixNormalized.match(/\b(?:em|dia|para)\s+(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})\b/);
  const timeMatch = commandSuffix.match(/\b(?:das|de)\s+(\d{2}:\d{2})\s+(?:às|as|ate|até)\s+(\d{2}:\d{2})\b/i);
  if (!dateMatch || !timeMatch) return { kind: "incomplete" };
  const rawDate = dateMatch[1]!;
  let date: string;
  if (rawDate.includes("/")) {
    const [, dayText, monthText, yearText] = rawDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)!;
    const day = Number(dayText);
    const month = Number(monthText);
    const year = Number(yearText);
    const parsed = new Date(Date.UTC(year, month - 1, day, 12));
    if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return { kind: "incomplete" };
    date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  } else {
    const [year, month, day] = rawDate.split("-").map(Number);
    const parsed = new Date(Date.UTC(year!, month! - 1, day!, 12));
    if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month! - 1 || parsed.getUTCDate() !== day) return { kind: "incomplete" };
    date = rawDate;
  }
  const startTime = timeMatch[1]!;
  const endTime = timeMatch[2]!;
  const validTime = (time: string) => {
    const [hour, minute] = time.split(":").map(Number);
    return hour! <= 23 && minute! <= 59;
  };
  if (!validTime(startTime) || !validTime(endTime) || startTime >= endTime) return { kind: "incomplete" };
  return { kind: "request", title, date, startTime, endTime };
}

export type AsaAgendaDraftNotesParse =
  | { kind: "not_action" }
  | { kind: "incomplete" }
  | { kind: "request"; title: string; notes: string | null };

export function parseAsaAgendaDraftNotesRequest(value: string): AsaAgendaDraftNotesParse {
  const normalized = normalizeAsaText(value);
  const isClear = /^(?:remova|remover|limpe|limpar|apague|apagar)\s+(?:as\s+)?observacoes\b/.test(normalized);
  const isUpdate = /^(?:altere|alterar|atualize|atualizar|edite|editar|mude|mudar)\s+(?:as\s+)?observacoes\b/.test(normalized);
  if ((!isClear && !isUpdate) || !/\brascunho\b/.test(normalized) || !/\b(reuniao|encontro)\b/.test(normalized)) return { kind: "not_action" };
  const phrases = quotedPhrases(value);
  if (isClear) {
    if (phrases.length !== 1) return { kind: "incomplete" };
    const title = phrases[0]!.trim();
    return title && title.length <= 160 ? { kind: "request", title, notes: null } : { kind: "incomplete" };
  }
  if (phrases.length !== 2) return { kind: "incomplete" };
  const [title, notes] = phrases.map((phrase) => phrase.trim());
  if (!title || title.length > 160 || !notes || notes.length > 2000) return { kind: "incomplete" };
  return { kind: "request", title, notes };
}

export function parseAsaNoticeDraftRequest(value: string): AsaNoticeDraftParse {
  const normalized = normalizeAsaText(value);
  if (!/^(prepare|preparar|crie|criar|faca|fazer)\b/.test(normalized)) return { kind: "not_action" };
  if (!/\brascunho\b/.test(normalized) || !/\baviso\b/.test(normalized)) return { kind: "not_action" };
  const [title, content] = quotedPhrases(value);
  const cleanTitle = title?.trim();
  const cleanContent = content?.trim();
  if (!cleanTitle || !cleanContent || cleanTitle.length > 120 || cleanContent.length > 2000) return { kind: "incomplete" };
  return { kind: "proposal", title: cleanTitle, content: cleanContent };
}

export function parseAsaNoticeDraftUpdateRequest(value: string): AsaNoticeDraftUpdateParse {
  const normalized = normalizeAsaText(value);
  if (!/^(?:edite|editar|atualize|atualizar)\b/.test(normalized)
    || !/\brascunho\b/.test(normalized) || !/\baviso\b/.test(normalized)) return { kind: "not_action" };
  const phrases = quotedPhrases(value);
  if (phrases.length !== 3) return { kind: "incomplete" };
  const [title, newTitle, content] = phrases.map((phrase) => phrase.trim());
  if (!title || !newTitle || !content || title.length > 120 || newTitle.length > 120 || content.length > 2000) {
    return { kind: "incomplete" };
  }
  return { kind: "request", title, newTitle, content };
}

export function parseAsaDirectMessageRequest(value: string): AsaDirectMessageParse {
  const normalized = normalizeAsaText(value);
  if (!/^(?:crie|criar|envie|enviar|mande|mandar)\b/.test(normalized)
    || !/\b(mensagem|conversa)\b/.test(normalized)
    || !/\b(?:para|com)\b/.test(normalized)
    || !/\btitulo\b/.test(normalized)) return { kind: "not_action" };
  const phrases = quotedPhrases(value);
  if (phrases.length !== 3) return { kind: "incomplete" };
  const [recipientName, title, content] = phrases.map((phrase) => phrase.trim());
  if (!recipientName || !title || !content || recipientName.length > 120 || title.length > 160 || content.length > 2000) {
    return { kind: "incomplete" };
  }
  return { kind: "proposal", recipientName, title, content };
}

export function parseAsaMessageReplyRequest(value: string): AsaMessageReplyParse {
  const normalized = normalizeAsaText(value);
  if (!/^(?:responda|responder|responde|envie|enviar|mande|mandar)\b/.test(normalized)
    || !/\bconversa\b/.test(normalized)) return { kind: "not_action" };
  if (!/\b(?:mensagem|texto)\b/.test(normalized)) return { kind: "incomplete" };
  const phrases = quotedPhrases(value);
  if (phrases.length !== 2) return { kind: "incomplete" };
  const [threadTitle, content] = phrases.map((phrase) => phrase.trim());
  if (!threadTitle || threadTitle.length > 160 || !content || content.length > 2000) return { kind: "incomplete" };
  return { kind: "proposal", threadTitle, content };
}

export function parseAsaTaskDraftRequest(value: string): AsaTaskDraftParse {
  const normalized = normalizeAsaText(value);
  if (!/^(crie|criar|prepare|preparar)\b/.test(normalized) || !/\btarefa\b/.test(normalized)) return { kind: "not_action" };
  const descriptionMatch = value.match(/\bcom\s+descri[cç][aã]o\s*[:=]?\s*["“‘]([^"”’\n]+)["”’]/i);
  const responsibilityMatch = value.match(/\bvinculad[oa]\s+(?:à|a)\s+responsabilidade\s*[:=]?\s*["“‘]([^"”’\n]+)["”’]/i);
  const checklistMatch = value.match(/\bcom\s+checklist(?:\s+obrigat[oó]ria)?\s*[:=]?\s*["“‘]([^"”’\n]+)["”’]/i);
  const evidenceMatch = value.match(/(?:\bcom|\be)\s+evid[eê]ncias?\s+obrigat[oó]rias?\s*[:=]?\s*["“‘]([^"”’\n]+)["”’]/i);
  const hasDescriptionRequest = /\bcom\s+descricao\b/.test(normalized);
  const hasResponsibilityRequest = /\bvinculad[oa]\s+a\s+responsabilidade\b/.test(normalized);
  const hasChecklistRequest = /\bcom\s+checklist\b/.test(normalized);
  const hasEvidenceRequest = /\b(?:com|e)\s+evidencias?\s+obrigatorias?\b/.test(normalized);
  if (hasDescriptionRequest && !descriptionMatch) return { kind: "incomplete" };
  if (hasResponsibilityRequest && !responsibilityMatch) return { kind: "incomplete" };
  if (hasChecklistRequest && !checklistMatch) return { kind: "incomplete" };
  if (hasEvidenceRequest && !evidenceMatch) return { kind: "incomplete" };
  const phrases = quotedPhrases(value);
  const descriptionText = descriptionMatch?.[1]?.trim();
  const responsibilityText = responsibilityMatch?.[1]?.trim();
  const checklistText = checklistMatch?.[1]?.trim();
  const evidenceText = evidenceMatch?.[1]?.trim();
  const taskPhrases = phrases.slice(0, 2);
  const optionalPhrases = [
    descriptionText ? { text: descriptionText, index: descriptionMatch!.index } : null,
    responsibilityText ? { text: responsibilityText, index: responsibilityMatch!.index } : null,
    checklistText ? { text: checklistText, index: checklistMatch!.index } : null,
    evidenceText ? { text: evidenceText, index: evidenceMatch!.index } : null,
  ]
    .filter((item): item is { text: string; index: number } => item !== null)
    .sort((left, right) => left.index - right.index);
  if (optionalPhrases.some((item, index) => phrases[index + 2] !== item.text)
    || phrases.length !== optionalPhrases.length + 2) return { kind: "incomplete" };
  const dateMatch = normalized.match(/\b(?:ate|prazo)\s+(\d{1,2}\/\d{1,2}\/\d{4})\b/);
  if (taskPhrases.length !== 2 || !/["“‘][^"”’\n]+["”’]\s+para\s+["“‘][^"”’\n]+["”’]/i.test(value) || !dateMatch) return { kind: "incomplete" };
  const [title, assigneeName] = taskPhrases;
  if (!title || title.length > 160 || !assigneeName || assigneeName.length > 120 || (descriptionText && descriptionText.length > 2000)
    || (responsibilityText && responsibilityText.length > 160)) return { kind: "incomplete" };
  const checklistLabels = checklistText ? checklistText.split(";").map((label) => label.trim()) : [];
  if (checklistLabels.length > 12 || checklistLabels.some((label) => !label || label.length > 160)
    || new Set(checklistLabels.map(normalizeAsaText)).size !== checklistLabels.length) return { kind: "incomplete" };
  const evidenceTypeAliases: Record<string, AsaTaskEvidenceType> = {
    foto: "PHOTO", photo: "PHOTO", imagem: "PHOTO",
    video: "VIDEO", documento: "DOCUMENT", pdf: "PDF", link: "LINK",
    audio: "AUDIO", apresentacao: "PRESENTATION",
  };
  const rawEvidenceRequirements = evidenceText ? evidenceText.split(";") : [];
  const mandatoryEvidences: Array<{ type: AsaTaskEvidenceType; description: string }> = [];
  for (const rawRequirement of rawEvidenceRequirements) {
    const separator = rawRequirement.indexOf(":");
    if (separator < 1) return { kind: "incomplete" };
    const type = evidenceTypeAliases[normalizeAsaText(rawRequirement.slice(0, separator))];
    const description = rawRequirement.slice(separator + 1).trim();
    if (!type || !description || description.length > 180) return { kind: "incomplete" };
    mandatoryEvidences.push({ type, description });
  }
  if (mandatoryEvidences.length > 12
    || new Set(mandatoryEvidences.map((item) => `${item.type}:${normalizeAsaText(item.description)}`)).size !== mandatoryEvidences.length) return { kind: "incomplete" };
  const [, dayText, monthText, yearText] = dateMatch[1]!.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)!;
  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);
  const due = new Date(Date.UTC(year, month - 1, day, 12));
  if (due.getUTCFullYear() !== year || due.getUTCMonth() !== month - 1 || due.getUTCDate() !== day) return { kind: "incomplete" };
  const priority = /\bprioridade\s+critica\b/.test(normalized) ? "CRITICAL"
    : /\bprioridade\s+alta\b/.test(normalized) ? "HIGH"
    : /\bprioridade\s+baixa\b/.test(normalized) ? "LOW"
    : "MEDIUM";
  return { kind: "proposal", title, assigneeName, dueDate: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`, priority, ...(descriptionText ? { description: descriptionText } : {}), ...(responsibilityText ? { responsibilityTitle: responsibilityText } : {}), checklistLabels, mandatoryEvidences };
}

export function parseAsaTaskDueDateUpdate(value: string): AsaTaskDueDateUpdateParse {
  const normalized = normalizeAsaText(value);
  const subject = normalizeAsaText(value.split(/["“‘]/, 1)[0]!);
  if (!/^(altere|alterar|mude|mudar|atualize|atualizar|troque|trocar)\b/.test(normalized)
    || !/\btarefa\b/.test(subject) || /\b(responsavel|responsabilidade|requisitos?|titulo|nome|prioridade|descricao|detalhes)\b/.test(subject)) return { kind: "not_action" };
  const [title] = quotedPhrases(value);
  const dateMatch = normalized.match(/\b(?:para|ate|prazo)\s+(\d{1,2}\/\d{1,2}\/\d{4})\b/);
  if (!title || title.length > 160 || !dateMatch) return { kind: "incomplete" };
  const [, dayText, monthText, yearText] = dateMatch[1]!.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)!;
  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);
  const due = new Date(Date.UTC(year, month - 1, day, 12));
  if (due.getUTCFullYear() !== year || due.getUTCMonth() !== month - 1 || due.getUTCDate() !== day) return { kind: "incomplete" };
  return { kind: "request", title: title.trim(), dueDate: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` };
}

export function parseAsaTaskAssigneeUpdate(value: string): AsaTaskAssigneeUpdateParse {
  const normalized = normalizeAsaText(value);
  if (!/^(altere|alterar|mude|mudar|atualize|atualizar|troque|trocar)\b/.test(normalized)
    || !/\btarefa\b/.test(normalized) || !/\bresponsavel\b/.test(normalized)) return { kind: "not_action" };
  const phrases = quotedPhrases(value);
  if (phrases.length !== 2 || !/\bpara\s+["“‘][^"”’\n]+["”’]/i.test(value)) return { kind: "incomplete" };
  const [title, assigneeName] = phrases;
  if (!title || title.length > 160 || !assigneeName || assigneeName.length > 120) return { kind: "incomplete" };
  return { kind: "request", title: title.trim(), assigneeName: assigneeName.trim() };
}

export function parseAsaTaskPriorityUpdate(value: string): AsaTaskPriorityUpdateParse {
  const normalized = normalizeAsaText(value);
  if (!/^(altere|alterar|mude|mudar|atualize|atualizar|troque|trocar)\b/.test(normalized)
    || !/\btarefa\b/.test(normalized) || !/\bprioridade\b/.test(normalized)) return { kind: "not_action" };
  const titles = quotedPhrases(value);
  const [title] = titles;
  const priorityMatch = normalized.match(/\b(?:para|como)\s+(?:prioridade\s+)?(baixa|media|normal|alta|critica)\b/);
  if (titles.length !== 1 || !title || title.length > 160 || !priorityMatch) return { kind: "incomplete" };
  const priority = priorityMatch[1] === "baixa" ? "LOW"
    : priorityMatch[1] === "media" || priorityMatch[1] === "normal" ? "MEDIUM"
      : priorityMatch[1] === "alta" ? "HIGH" : "CRITICAL";
  return { kind: "request", title: title.trim(), priority };
}

export function parseAsaTaskDescriptionUpdate(value: string): AsaTaskDescriptionUpdateParse {
  const normalized = normalizeAsaText(value);
  if (!/^(altere|alterar|mude|mudar|atualize|atualizar)\b/.test(normalized)
    || !/\btarefa\b/.test(normalized) || !/\b(descricao|detalhes)\b/.test(normalized)
    || /\b(prazo|responsavel|prioridade)\b/.test(normalized)) return { kind: "not_action" };
  const phrases = quotedPhrases(value);
  if (phrases.length !== 2 || !/\bpara\s+["“‘][^"”’\n]+["”’]/i.test(value)) return { kind: "incomplete" };
  const [title, description] = phrases;
  if (!title?.trim() || title.length > 160 || !description?.trim() || description.length > 2000) return { kind: "incomplete" };
  return { kind: "request", title: title.trim(), description: description.trim() };
}

export function parseAsaTaskTitleUpdate(value: string): AsaTaskTitleUpdateParse {
  const normalized = normalizeAsaText(value);
  if (!/^(altere|alterar|mude|mudar|atualize|atualizar|troque|trocar|renomeie|renomear)\b/.test(normalized)
    || !/\btarefa\b/.test(normalized) || !/\b(titulo|nome)\b/.test(normalized)
    || /\b(prazo|responsavel|prioridade|descricao|detalhes)\b/.test(normalized)) return { kind: "not_action" };
  const phrases = quotedPhrases(value);
  if (phrases.length !== 2 || !/\bpara\s+["“‘][^"”’\n]+["”’]/i.test(value)) return { kind: "incomplete" };
  const [title, newTitle] = phrases;
  if (!title?.trim() || title.length > 160 || !newTitle?.trim() || newTitle.length > 160) return { kind: "incomplete" };
  return { kind: "request", title: title.trim(), newTitle: newTitle.trim() };
}

export function parseAsaTaskRequirementsUpdate(value: string): AsaTaskRequirementsUpdateParse {
  const normalized = normalizeAsaText(value);
  if (!/^(altere|alterar|mude|mudar|atualize|atualizar|troque|trocar)\b/.test(normalized)
    || !/\brequisitos?\b/.test(normalized) || !/\btarefa\b/.test(normalized)) return { kind: "not_action" };
  const checklistMatch = value.match(/\bchecklist\s+obrigat[oó]ria\s+["“‘]([^"”’\n]+)["”’]/i);
  const evidenceMatch = value.match(/\bevid[eê]ncias?\s+obrigat[oó]rias?\s+["“‘]([^"”’\n]+)["”’]/i);
  const phrases = quotedPhrases(value);
  if (phrases.length !== 3 || !checklistMatch || !evidenceMatch
    || phrases[0] !== value.match(/\brequisitos?\s+da\s+tarefa\s+["“‘]([^"”’\n]+)["”’]/i)?.[1]?.trim()
    || phrases[1] !== checklistMatch[1]?.trim() || phrases[2] !== evidenceMatch[1]?.trim()) return { kind: "incomplete" };
  const [title, checklistText, evidenceText] = phrases;
  if (!title || title.length > 160) return { kind: "incomplete" };
  const checklistLabels = normalizeAsaText(checklistText!) === "nenhuma" ? [] : checklistText!.split(";").map((item) => item.trim());
  if (checklistLabels.length > 12 || checklistLabels.some((item) => !item || item.length > 160)
    || new Set(checklistLabels.map(normalizeAsaText)).size !== checklistLabels.length) return { kind: "incomplete" };
  const aliases: Record<string, AsaTaskEvidenceType> = {
    foto: "PHOTO", photo: "PHOTO", imagem: "PHOTO", video: "VIDEO", documento: "DOCUMENT",
    pdf: "PDF", link: "LINK", audio: "AUDIO", apresentacao: "PRESENTATION",
  };
  const mandatoryEvidences: Array<{ type: AsaTaskEvidenceType; description: string }> = [];
  if (normalizeAsaText(evidenceText!) !== "nenhuma") {
    for (const requirement of evidenceText!.split(";")) {
      const separator = requirement.indexOf(":");
      if (separator < 1) return { kind: "incomplete" };
      const type = aliases[normalizeAsaText(requirement.slice(0, separator))];
      const description = requirement.slice(separator + 1).trim();
      if (!type || !description || description.length > 180) return { kind: "incomplete" };
      mandatoryEvidences.push({ type, description });
    }
  }
  if (mandatoryEvidences.length > 12
    || new Set(mandatoryEvidences.map((item) => `${item.type}:${normalizeAsaText(item.description)}`)).size !== mandatoryEvidences.length) return { kind: "incomplete" };
  return { kind: "request", title: title!, checklistLabels, mandatoryEvidences };
}

export function parseAsaTaskResponsibilityUpdate(value: string): AsaTaskResponsibilityUpdateParse {
  const normalized = normalizeAsaText(value);
  if (!/^(altere|alterar|mude|mudar|atualize|atualizar|troque|trocar|remova|remover)\b/.test(normalized)
    || !/\btarefa\b/.test(normalized) || !/\bresponsabilidade\b/.test(normalized)) return { kind: "not_action" };
  const phrases = quotedPhrases(value);
  if (phrases.length !== 2 || !/\bpara\s+["“‘][^"”’\n]+["”’]/i.test(value)) return { kind: "incomplete" };
  const [title, target] = phrases;
  if (!title || title.length > 160 || !target || target.length > 160) return { kind: "incomplete" };
  return { kind: "request", title, responsibilityTitle: normalizeAsaText(target) === "nenhuma" ? null : target };
}

export function resolveAsaOperationSelection(
  text: string,
  operations: AsaOperationOption[],
  preferredOperationId?: string,
): AsaOperationSelection {
  if (operations.length === 0) {
    return { kind: "unavailable", message: "Não encontrei uma operação ativa no seu perfil." };
  }
  if (preferredOperationId) {
    const selected = operations.find((operation) => operation.id === preferredOperationId);
    return selected
      ? { kind: "selected", operationId: selected.id }
      : { kind: "unavailable", message: "Essa operação não está mais disponível no seu perfil. Atualize a seleção e tente novamente." };
  }
  if (operations.length === 1) return { kind: "selected", operationId: operations[0]!.id };

  const normalized = normalizeAsaText(text);
  const matches = operations.filter((operation) => normalized.includes(normalizeAsaText(operation.name)));
  if (matches.length === 1) return { kind: "selected", operationId: matches[0]!.id };

  const names = operations.map((operation) => operation.name).join(", ");
  return {
    kind: "clarification",
    message: matches.length > 1
      ? `Encontrei mais de uma operação mencionada. Qual delas você quer consultar: ${names}?`
      : `Você tem acesso a mais de uma operação (${names}). Diga o nome da operação que quer consultar.`,
  };
}

function shiftDate(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const shifted = new Date(Date.UTC(year!, month! - 1, day! + days, 12));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(shifted.getUTCDate()).padStart(2, "0")}`;
}

function weekRange(today: string, nextWeek: boolean): { dateFrom: string; dateTo: string } {
  const [year, month, day] = today.split("-").map(Number);
  const current = new Date(Date.UTC(year!, month! - 1, day!, 12));
  const mondayOffset = (current.getUTCDay() + 6) % 7;
  const dateFrom = shiftDate(today, -mondayOffset + (nextWeek ? 7 : 0));
  return { dateFrom, dateTo: shiftDate(dateFrom, 6) };
}

function monthRange(today: string, monthOffset = 0): { dateFrom: string; dateTo: string } {
  const [year, month] = today.split("-").map(Number);
  const first = new Date(Date.UTC(year!, month! - 1 + monthOffset, 1, 12));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0, 12));
  const format = (date: Date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
  return { dateFrom: format(first), dateTo: format(last) };
}

function requestedDate(text: string, today: string): string {
  if (/\bamanha\b/.test(text)) return shiftDate(today, 1);
  if (/\bontem\b/.test(text)) return shiftDate(today, -1);
  const numeric = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\b/);
  if (numeric) {
    const year = Number(numeric[3] ?? today.slice(0, 4));
    const month = Number(numeric[2]);
    const day = Number(numeric[1]);
    const candidate = new Date(Date.UTC(year, month - 1, day, 12));
    if (candidate.getUTCFullYear() === year && candidate.getUTCMonth() === month - 1 && candidate.getUTCDate() === day) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  return today;
}

export function resolveAsaCommand(text: string, today: string, isManager: boolean, page = "", role = ""): AsaCommandResolution {
  const normalized = normalizeAsaText(text);
  if (!normalized) return { kind: "unsupported", message: "Escreva o que você quer consultar." };
  if (/^(nao|cancele|cancela|pare|para|deixa)\b/.test(normalized)) {
    return { kind: "unsupported", message: "Entendi. Não vou executar essa consulta." };
  }
  if (/\b(crie|criar|cria|edite|editar|edita|altere|alterar|altera|mude|mudar|exclua|excluir|apague|apagar|publique|publicar|responda|responder|envie|enviar|marque|marcar|agende|agendar|registre|registrar|adicione|adicionar|remova|remover|inicie|iniciar|comece|comecar)\b/.test(normalized)) {
    return { kind: "unsupported", message: "Ainda não faço alterações por comando. Nada foi modificado; posso consultar informações disponíveis." };
  }

  const pageRequest = /^(o que tenho aqui|o que eu tenho aqui|o que vejo aqui|me ajuda aqui|me ajude aqui|resuma esta tela|resuma essa tela)$/.test(normalized);
  const contextualQuery = pageRequest
      ? ({
        "/meu-dia": "meu dia hoje",
        "/escalas": "minha escala desta semana",
        "/responsabilidades": "minhas tarefas pendentes",
        "/folgas": isManager ? "quem esta de folga hoje" : "minhas folgas",
        "/membro/mensagens": "minhas mensagens nao lidas",
        "/mural": "mural",
        "/pessoas": "buscar pessoas",
        "/locais": "locais",
        "/mensagens": "minhas mensagens nao lidas",
        "/membro/avisos": "meus avisos",
        "/membro/folgas": "minhas folgas",
        "/membro/solicitacoes": "minhas solicitacoes",
        "/membro/escala": "minha escala desta semana",
        "/membro/tarefas": "minhas tarefas pendentes",
        "/membro/entregas": "minhas entregas",
        "/admin/meu-dia": "meu dia hoje",
        "/admin/tasks": "tarefas da equipe pendentes",
        "/admin/responsibilities": "responsabilidades da equipe",
        "/admin/responsabilidades-delegacoes": "responsabilidades da equipe",
        "/supervisor/tasks": "tarefas da equipe pendentes",
        "/admin/activities": "atividades recorrentes da operação",
        "/admin/folgas": "quem esta de folga hoje",
        "/supervisor/folgas": "quem esta de folga hoje",
        "/admin/deliveries": "entregas da equipe",
        "/supervisor/deliveries": "entregas da equipe",
        "/admin/avisos": "mural",
        "/supervisor/avisos": "mural",
        "/admin/messages": "minhas mensagens nao lidas",
        "/supervisor/messages": "minhas mensagens nao lidas",
        "/admin/locations": "locais",
        "/admin/users": "buscar pessoas",
        "/supervisor/equipe": "buscar pessoas",
        "/supervisor/check-ins": "check-ins da equipe hoje",
        "/supervisor/insights": "check-ins da equipe hoje",
        "/admin/agenda": "agenda",
        "/admin/insights": "resumo de check-ins da equipe dos últimos 7 dias",
        "/admin/daily-book": "livro do dia hoje",
        "/supervisor/daily-book": "livro do dia hoje",
        "/membro/livro-do-dia": "livro do dia hoje",
        "/livro-do-dia": "livro do dia hoje",
        "/admin/show-book": "livros do show cadastrados",
        "/shows": "livros do show cadastrados",
        "/admin/library": "buscar na biblioteca",
        "/supervisor/library": "buscar na biblioteca",
        "/membro/biblioteca": "buscar na biblioteca",
        "/biblioteca": "buscar na biblioteca",
        "/notificacoes": "minhas notificacoes nao lidas",
        "/agenda": "agenda",
        "/check-in": "meu check-in hoje",
      } as Record<string, string>)[page]
    : undefined;
  const commandText = contextualQuery ?? normalized;

  let matches = INTENTS.filter((intent) => intent.patterns.some((pattern) => pattern.test(commandText)));
  if (matches.some((intent) => intent.key === "consultar_minhas_propostas_agenda")) {
    matches = matches.filter((intent) => intent.key !== "consultar_agenda");
  }
  if (matches.some((intent) => intent.key === "consultar_relatorio_checkins")) matches = matches.filter((intent) => intent.key !== "consultar_checkins_equipe");
  if (matches.some((intent) => intent.key === "consultar_relatorio_tarefas")) matches = matches.filter((intent) => intent.key !== "consultar_tarefas_equipe");
  if (matches.some((intent) => intent.key === "consultar_tarefas_equipe") && !/\bminhas tarefas\b/.test(commandText)) {
    matches = matches.filter((intent) => intent.key !== "consultar_tarefas");
  }
  if (matches.length > 1) {
    return {
      kind: "clarification",
      message: `Posso consultar ${matches.map((intent) => intent.label).join(" ou ")}. Qual você quer ver primeiro?`,
    };
  }
  if (matches.length === 0) {
    return {
      kind: "unsupported",
      message: ASA_UNRECOGNIZED_COMMAND_REPLY,
    };
  }

  const intent = matches[0]!;
  if (intent.key === "consultar_tarefas_equipe" && !isManager && role !== "DIR") {
    return { kind: "unsupported", message: "A consulta de tarefas da equipe está disponível somente a gestores autorizados. Posso consultar suas próprias tarefas." };
  }
  if (intent.key === "consultar_responsabilidades_equipe" && !["ADMIN", "DIR", "SUPERVISOR_A", "SUPERVISOR_B"].includes(role)) {
    return { kind: "unsupported", message: "A consulta de responsabilidades da equipe está disponível somente para Administração, Direção e Supervisão dentro do próprio escopo. Posso consultar as suas responsabilidades." };
  }
  if (intent.key === "consultar_tarefa_requisitos") {
    const phrases = quotedPhrases(text);
    if (phrases.length !== 1 || phrases[0]!.length > 160) {
      return { kind: "clarification", message: "Diga o título exato da sua tarefa entre aspas para eu conferir os itens obrigatórios. Exemplo: o que falta para concluir a tarefa \"Separar figurinos\"?" };
    }
    return { kind: "command", command: { tool: intent.key, input: { title: phrases[0] }, label: intent.label } };
  }
  if (intent.key === "consultar_atividades" && !["ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"].includes(role)) {
    return { kind: "unsupported", message: "A consulta de atividades recorrentes está disponível somente para Administração e Supervisão com acesso à operação." };
  }
  if (intent.key === "consultar_checkins_equipe" && !isManager) {
    return { kind: "unsupported", message: "A consulta de check-ins da equipe está disponível somente para gestores com acesso à operação. Posso consultar seu próprio check-in." };
  }
  if (intent.key === "consultar_estado_biblioteca") {
    if (!isManager) return { kind: "unsupported", message: "O estado geral da Biblioteca está disponível somente para Administração e Supervisão. Posso ajudar a buscar um documento publicado no seu escopo." };
    return { kind: "command", command: { tool: intent.key, input: { limit: 5 }, label: intent.label } };
  }
  if (intent.key === "consultar_minhas_leituras_pendentes_biblioteca") {
    return { kind: "command", command: { tool: intent.key, input: { limit: 10 }, label: intent.label } };
  }
  if (intent.key === "consultar_checkins_equipe") {
    return { kind: "command", command: { tool: intent.key, input: { date: requestedDate(commandText, today) }, label: intent.label } };
  }
  if (intent.key === "consultar_relatorio_tarefas") {
    if (role !== "ADMIN" && role !== "DIR") return { kind: "unsupported", message: "O resumo agregado de tarefas está disponível somente para Administração e Direção." };
    const period = /\bhoje\b/.test(commandText) ? "today" : /\b(30 dias|ultimo mes|ultimos 30 dias|mes)\b/.test(commandText) ? "30d" : "7d";
    return { kind: "command", command: { tool: intent.key, input: { period }, label: intent.label } };
  }
  if (intent.key === "consultar_ausencias_do_dia") {
    if (!isManager) {
      return { kind: "unsupported", message: "Você pode consultar suas próprias folgas na tela Folgas. A lista de folgas da equipe está disponível somente para gestores." };
    }
    return { kind: "command", command: { tool: intent.key, input: { date: requestedDate(commandText, today) }, label: intent.label } };
  }
  if (intent.key === "consultar_tempo_livre") {
    const personal = /\b(meu|meus|minha|minhas|estou|eu|tenho)\b/.test(commandText);
    const team = /\b(equipe|quem|membros|pessoas)\b/.test(commandText);
    if (personal && team) return { kind: "clarification", message: "Você quer consultar seus próprios intervalos livres ou os da equipe?" };
    if (team && !isManager && role !== "DIR") {
      return { kind: "unsupported", message: "A consulta de intervalos da equipe está disponível somente para gestores com acesso à Escala. Posso consultar seus próprios intervalos." };
    }
    if (!personal && !team) return { kind: "clarification", message: "Você quer ver seus intervalos livres ou os da equipe?" };
    return { kind: "command", command: { tool: intent.key, input: { date: requestedDate(commandText, today), mine: personal }, label: intent.label } };
  }
  if (intent.key === "consultar_minhas_propostas_agenda") {
    return { kind: "command", command: { tool: intent.key, input: { limit: 20 }, label: intent.label } };
  }
  if (intent.key === "consultar_escalas") {
    const hasSpecificDate = /\bhoje\b|\bamanha\b|\bontem\b|\b\d{1,2}\/\d{1,2}(?:\/\d{4})?\b/.test(commandText);
    const dateFrom = hasSpecificDate ? requestedDate(commandText, today) : undefined;
    const range = dateFrom
      ? { dateFrom, dateTo: dateFrom }
      : weekRange(today, /\bsemana que vem\b|\bproxima semana\b/.test(commandText));
    return { kind: "command", command: { tool: intent.key, input: { ...range, limit: 50 }, label: intent.label } };
  }
  if (intent.key === "consultar_agenda") {
    const hasSpecificDate = /\bhoje\b|\bamanha\b|\bontem\b|\b\d{1,2}\/\d{1,2}(?:\/\d{4})?\b/.test(commandText);
    const range = hasSpecificDate
      ? { dateFrom: requestedDate(commandText, today), dateTo: requestedDate(commandText, today) }
      : /\bsemana\b/.test(commandText)
        ? weekRange(today, /\bsemana que vem\b|\bproxima semana\b/.test(commandText))
        : { dateFrom: today, dateTo: shiftDate(today, 30) };
    return { kind: "command", command: { tool: intent.key, input: { ...range, limit: 30 }, label: intent.label } };
  }
  if (intent.key === "consultar_livro_do_dia") {
    return { kind: "command", command: { tool: intent.key, input: { date: requestedDate(commandText, today), limit: 10 }, label: intent.label } };
  }
  if (intent.key === "consultar_livros_do_show") {
    if (/\b(detalhes?|estrutura|cenas|blocos|posicoes|composicao|conteudo)\b/.test(commandText)) {
      const titles = quotedPhrases(text);
      if (titles.length !== 1 || titles[0]!.length > 180) {
        return { kind: "clarification", message: "Qual Livro do Show você quer consultar? Escreva o título exato entre aspas. Exemplo: mostre a estrutura do Livro do Show \"A Floresta\"." };
      }
      return { kind: "command", command: { tool: intent.key, input: { title: titles[0], limit: 20 }, label: `a estrutura do Livro do Show ${titles[0]}` } };
    }
    return { kind: "command", command: { tool: intent.key, input: { limit: 20 }, label: intent.label } };
  }
  if (intent.key === "consultar_meu_checkin") {
    return { kind: "command", command: { tool: intent.key, input: { date: requestedDate(commandText, today) }, label: intent.label } };
  }
  if (intent.key === "consultar_meu_dia") {
    const date = requestedDate(commandText, today);
    return { kind: "command", command: { tool: intent.key, input: { dateFrom: date, dateTo: date, limit: 50 }, label: intent.label } };
  }
  if (intent.key === "consultar_tarefas" || intent.key === "consultar_tarefas_equipe") {
    const nextThreeDays = /\bproximos (3|tres) dias\b/.test(commandText);
    if (nextThreeDays && /\b(vencidas|atrasadas|hoje|amanha|ontem|semana|mes|\d{1,2}\/\d{1,2})\b/.test(commandText)) {
      return { kind: "clarification", message: "Você quer as tarefas dos próximos três dias ou outro período?" };
    }
    const status = /\b(concluidas|finalizadas)\b/.test(commandText) ? "COMPLETED"
      : /\bem andamento\b/.test(commandText) ? "IN_PROGRESS"
      : /\baguardando aprovacao\b/.test(commandText) ? "READY_FOR_APPROVAL"
      : /\bprecisam de ajuste\b/.test(commandText) ? "CHANGES_REQUESTED"
      : (/\btodas as minhas tarefas\b/.test(commandText) || (intent.key === "consultar_tarefas_equipe" && /\btodas as tarefas\b/.test(commandText))) ? undefined
      : nextThreeDays ? "ACTIONABLE"
      : "PENDING";
    let range: Record<string, string> = {};
    if (/\b(vencidas|atrasadas)\b/.test(commandText)) {
      range = { dateTo: shiftDate(today, -1) };
    } else if (nextThreeDays) {
      range = { dateFrom: shiftDate(today, 1), dateTo: shiftDate(today, 3) };
    } else if (/\b(hoje|amanha|ontem)\b|\b\d{1,2}\/\d{1,2}(?:\/\d{4})?\b/.test(commandText)) {
      const date = requestedDate(commandText, today);
      range = { dateFrom: date, dateTo: date };
    } else if (/\bsemana\b/.test(commandText)) {
      range = weekRange(today, /\bsemana que vem\b|\bproxima semana\b/.test(commandText));
    } else if (/\b(mes|este mes|deste mes|mes que vem|proximo mes)\b/.test(commandText)) {
      range = monthRange(today, /\b(mes que vem|proximo mes)\b/.test(commandText) ? 1 : 0);
    }
    return { kind: "command", command: { tool: intent.key, input: { ...range, ...(status ? { status } : {}), limit: intent.key === "consultar_tarefas_equipe" ? 50 : 20 }, label: intent.label } };
  }
  if (intent.key === "consultar_folgas") {
    const hasSpecificDate = /\bhoje\b|\bamanha\b|\bontem\b|\b\d{1,2}\/\d{1,2}(?:\/\d{4})?\b/.test(commandText);
    const range = hasSpecificDate
      ? { dateFrom: requestedDate(commandText, today), dateTo: requestedDate(commandText, today) }
      : /\bsemana\b/.test(commandText)
        ? weekRange(today, /\bsemana que vem\b|\bproxima semana\b/.test(commandText))
        : /\bmes\b/.test(commandText)
          ? monthRange(today, /\b(mes passado|mes anterior)\b/.test(commandText) ? -1 : /\b(mes que vem|proximo mes)\b/.test(commandText) ? 1 : 0)
        : { dateFrom: today, dateTo: shiftDate(today, 30) };
    return { kind: "command", command: { tool: intent.key, input: { ...range, limit: 20 }, label: intent.label } };
  }
  if (intent.key === "consultar_responsabilidades") {
    return { kind: "command", command: { tool: intent.key, input: { mine: true }, label: intent.label } };
  }
  if (intent.key === "consultar_responsabilidades_equipe") {
    if (!isManager && role !== "DIR") {
      return { kind: "unsupported", message: "A consulta de responsabilidades da equipe está disponível somente para Administração, Direção e Supervisão dentro do próprio escopo." };
    }
    const unassigned = /\bsem (responsavel|atribuicao)\b/.test(commandText);
    return { kind: "command", command: { tool: intent.key, input: { unassigned, limit: 50 }, label: intent.label } };
  }
  if (intent.key === "consultar_solicitacoes") {
    return { kind: "command", command: { tool: intent.key, input: { limit: 20 }, label: intent.label } };
  }
  if (intent.key === "consultar_atividades") {
    return { kind: "command", command: { tool: intent.key, input: { limit: 50 }, label: intent.label } };
  }
  if (intent.key === "consultar_biblioteca") {
    const search = parseAsaLibrarySearchRequest(pageRequest ? commandText : text);
    if (search.kind === "clarification") return search;
    if (!search.query && !search.locationName) return { kind: "clarification", message: "Qual assunto você quer pesquisar na biblioteca?" };
    return { kind: "command", command: { tool: intent.key, input: { query: search.query, ...(search.locationName ? { locationName: search.locationName } : {}), limit: 10 }, label: intent.label } };
  }
  if (intent.key === "consultar_mensagens") {
    if (/\b(nao lidas|nao lida|novas|pendentes)\b/.test(commandText)) {
      return { kind: "command", command: { tool: intent.key, input: { unreadOnly: true, limit: 20 }, label: "suas mensagens não lidas" } };
    }
    const quoted = quotedPhrases(text)[0]?.trim();
    const senderMatch = text.match(/\b(?:de|do|da|com)\s+([^"“”'‘’?.!,]+?)(?:\s+(?:sobre|em|no dia|depois|antes)\b|[?.!,]|$)/iu);
    const senderName = senderMatch?.[1]?.trim()
      .replace(/^(?:mensagens?\s+)?/iu, "")
      .replace(/^(?:a|o|as|os|um|uma)\s+/iu, "");
    if (senderName && normalizeAsaText(senderName) !== "mim") {
      return { kind: "command", command: { tool: intent.key, input: { senderName, ...(quoted ? { query: quoted } : {}), limit: 20 }, label: `mensagens de ${senderName}` } };
    }
    if (quoted && /\b(buscar|busque|procurar|procure|pesquisar|pesquise|mensagem|mensagens|conversa|conversas)\b/.test(commandText)) {
      return { kind: "command", command: { tool: intent.key, input: { query: quoted, limit: 20 }, label: "suas mensagens" } };
    }
    return { kind: "clarification", message: "Você quer ver as mensagens não lidas, buscar por uma pessoa ou procurar um trecho? Diga, por exemplo, “mensagens de Ana” ou “busque nas mensagens por ‘figurino’”." };
  }
  if (intent.key === "consultar_mural") {
    const query = quotedPhrases(text)[0]?.trim();
    return { kind: "command", command: { tool: intent.key, input: { ...(query ? { query } : {}), limit: 20 }, label: query ? "publicações do Mural sobre esse trecho" : "publicações visíveis no Mural" } };
  }
  if (intent.key === "consultar_pessoas") {
    const query = quotedPhrases(text)[0]?.trim();
    if (!query) return { kind: "clarification", message: "Qual nome ou área você quer buscar? Escreva o termo entre aspas, por exemplo: buscar pessoas por ‘Ana’." };
    return { kind: "command", command: { tool: intent.key, input: { query, limit: 20 }, label: `pessoas relacionadas a ${query}` } };
  }
  if (intent.key === "consultar_locais") {
    const query = quotedPhrases(text)[0]?.trim();
    return { kind: "command", command: { tool: intent.key, input: { ...(query ? { query } : {}), limit: 20 }, label: query ? `local ${query}` : intent.label } };
  }
  if (intent.key === "consultar_entregas") {
    const teamScope = /\bentregas\b.*\b(da equipe|da operacao)\b/.test(commandText);
    if (teamScope && !["ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"].includes(role)) {
      return { kind: "unsupported", message: "A consulta de entregas da equipe está disponível somente para Administração e Supervisão. Posso consultar suas próprias entregas." };
    }
    return { kind: "command", command: { tool: intent.key, input: { ...(teamScope ? { scope: "team" } : {}), limit: 20 }, label: teamScope ? "entregas da equipe" : intent.label } };
  }
  if (intent.key === "consultar_relatorio_checkins") {
    if (role !== "ADMIN") return { kind: "unsupported", message: "O resumo agregado de check-ins está disponível somente para Administração." };
    const period = /\bhoje\b/.test(commandText) ? "today" : /\b(30 dias|ultimo mes|ultimos 30 dias|mes)\b/.test(commandText) ? "30d" : "7d";
    return { kind: "command", command: { tool: intent.key, input: { period }, label: "resumo de check-ins" } };
  }
  if (intent.key === "consultar_avisos") {
    return { kind: "command", command: { tool: intent.key, input: { limit: 10 }, label: intent.label } };
  }
  return {
    kind: "command",
    command: { tool: intent.key, input: { unreadOnly: /\bnao lidas\b/.test(commandText), limit: 20 }, label: intent.label },
  };
}

function dateLabel(value: unknown): string {
  if (typeof value !== "string") return "";
  const match = value.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}` : value;
}

function statusLabel(value: unknown): string {
  const labels: Record<string, string> = {
    CREATED: "pendente", IN_PROGRESS: "em andamento", READY_FOR_APPROVAL: "aguardando aprovação",
    APPROVED: "aprovada", COMPLETED: "concluída", DONE: "concluída",
    CHANGES_REQUESTED: "precisa de ajuste", CANCELLED: "cancelada", EXPIRED: "expirada",
    PUBLISHED: "aguardando", RECEIVED: "recebida", VIEWED: "visualizada", OVERDUE: "atrasada",
    DAY_OFF: "folga", NO_SHOW: "falta", RECESSO: "recesso", AFASTAMENTO: "afastamento",
    RESTRICAO: "restrição", OUTRO: "outro",
  };
  return typeof value === "string" ? labels[value] ?? value.toLocaleLowerCase("pt-BR") : "";
}

export function formatAsaCommandReply(tool: AsaCommand["tool"], rawResult: string): string {
  let result: Record<string, unknown>;
  try {
    result = JSON.parse(rawResult) as Record<string, unknown>;
  } catch {
    return "Não consegui organizar o resultado dessa consulta.";
  }
  if (typeof result.error === "string") return result.error;

  if (tool === "consultar_agenda") {
    const events = Array.isArray(result.eventos) ? result.eventos as Record<string, unknown>[] : [];
    if (!events.length) return "Não encontrei eventos confirmados e visíveis à operação nesse período.";
    return `Agenda da operação (${events.length} evento(s)):\n${events.map((event) => `• ${dateLabel(event.date)}${event.startTime ? ` · ${String(event.startTime).slice(0, 5)}` : ""}${event.endTime ? `–${String(event.endTime).slice(0, 5)}` : ""} · ${String(event.title ?? "Evento")}${event.location ? ` · ${String(event.location)}` : ""}`).join("\n")}`;
  }
  if (tool === "consultar_minhas_propostas_agenda") {
    const proposals = Array.isArray(result.propostas) ? result.propostas as Record<string, unknown>[] : [];
    if (!proposals.length) return "Não encontrei propostas de reunião suas pendentes ou recusadas nesta operação.";
    const statuses: Record<string, string> = { PROPOSED: "aguardando análise", REJECTED: "recusada" };
    return `Suas propostas de reunião na Agenda (${proposals.length}):\n${proposals.map((proposal) => {
      const date = dateLabel(proposal.date);
      const time = [proposal.startTime, proposal.endTime].filter((part): part is string => typeof part === "string" && part.length > 0).map((part) => part.slice(0, 5)).join("–");
      const reason = typeof proposal.reason === "string" && proposal.reason ? `\n  Motivo: ${proposal.reason}` : "";
      const alternative = typeof proposal.alternativeDetails === "string" && proposal.alternativeDetails ? `\n  Alternativa: ${proposal.alternativeDetails}` : "";
      return `• ${date}${time ? ` · ${time}` : ""} · ${String(proposal.title ?? "Reunião")} · ${statuses[String(proposal.status)] ?? "status não informado"}${reason}${alternative}`;
    }).join("\n")}`;
  }
  if (tool === "consultar_livro_do_dia") {
    const books = Array.isArray(result.livros) ? result.livros as Record<string, unknown>[] : [];
    if (!books.length) return typeof result.message === "string" ? result.message : "Não encontrei Livros do Dia visíveis nessa data.";
    const states: Record<string, string> = { DRAFT: "rascunho", PUBLISHED: "publicado", REPUBLISHED: "republicado", EXECUTED: "executado" };
    return `Livro(s) do Dia em ${dateLabel(result.date)}:\n${books.map((book) => {
      const entries = Array.isArray(book.entries) ? book.entries as Record<string, unknown>[] : [];
      const lines = entries.slice(0, 20).map((entry) => {
        const time = [entry.startTime, entry.endTime].filter((part): part is string => typeof part === "string" && part.length > 0).map((part) => part.slice(0, 5)).join("–");
        const people = Array.isArray(entry.people) ? (entry.people as unknown[]).filter((name): name is string => typeof name === "string") : [];
        return `  • ${[entry.sceneName, entry.blockName, time, entry.positionName].filter(Boolean).join(" · ")} — ${people.length ? people.join(", ") : "posição em aberto"}`;
      });
      if (entries.length > 20) lines.push(`  • Mais ${entries.length - 20} posição(ões).`);
      const scenes = Array.isArray(book.scenes) ? (book.scenes as unknown[]).filter((name): name is string => typeof name === "string") : [];
      const title = String(book.showTitle ?? book.eventTitle ?? "Apresentação");
      const eventTime = [book.startTime, book.endTime].filter((part): part is string => typeof part === "string" && part.length > 0).map((part) => part.slice(0, 5)).join("–");
      return `• ${title}${eventTime ? ` · ${eventTime}` : ""} · ${states[String(book.status)] ?? String(book.status ?? "")}${scenes.length ? `\n  Cenas: ${scenes.join(", ")}` : ""}${lines.length ? `\n${lines.join("\n")}` : "\n  Sem cenas ou posições registradas."}`;
    }).join("\n")}`;
  }
  if (tool === "consultar_livros_do_show") {
    if (result.book && typeof result.book === "object") {
      const book = result.book as Record<string, unknown>;
      const scenes = Array.isArray(book.scenes) ? book.scenes as Record<string, unknown>[] : [];
      const unassignedPositions = Array.isArray(book.unassignedPositions) ? book.unassignedPositions as Record<string, unknown>[] : [];
      if (!scenes.length && !unassignedPositions.length) return `Estrutura de ${String(book.title ?? "Livro do Show")}: nenhum conteúdo ativo registrado.`;
      const formatPosition = (position: Record<string, unknown>) => {
        const minimum = Number(position.minimumCoverage);
        return `${String(position.name ?? "Posição")}${Number.isInteger(minimum) && minimum > 1 ? ` (mínimo ${minimum})` : ""}`;
      };
      const sceneLines = scenes.map((scene) => {
        const blocks = Array.isArray(scene.blocks) ? scene.blocks as Record<string, unknown>[] : [];
        const details = blocks.map((block) => {
          const positions = Array.isArray(block.positions) ? block.positions as Record<string, unknown>[] : [];
          const positionNames = positions.map(formatPosition);
          const omittedPositions = Number(block.omittedPositions) || 0;
          const remainder = omittedPositions > 0 ? `; mais ${omittedPositions} posição(ões) omitida(s)` : "";
          return `  • ${String(block.name ?? "Bloco")} — ${positions.length} posição(ões): ${positionNames.join(", ") || "nenhuma"}${remainder}`;
        });
        const omittedBlocks = Number(scene.omittedBlocks) || 0;
        const blockRemainder = omittedBlocks > 0 ? `\n  Mais ${omittedBlocks} bloco(s) omitido(s).` : "";
        return `• ${String(scene.name ?? "Cena")}${details.length ? `\n${details.join("\n")}` : "\n  Sem blocos ativos."}${blockRemainder}`;
      });
      const sceneCount = `${scenes.length} ${scenes.length === 1 ? "cena" : "cenas"}`;
      const totalScenes = Number(book.totalScenes);
      const omittedScenes = Number(book.omittedScenes) || 0;
      const sceneRemainder = omittedScenes > 0 && Number.isInteger(totalScenes)
        ? `\nExibindo ${scenes.length} de ${totalScenes} cenas; mais ${omittedScenes} omitidas.`
        : "";
      const unassignedPositionsRemainder = Number(book.omittedUnassignedPositions) || 0;
      const unassignedSummary = unassignedPositions.length
        ? `\nPosições sem bloco ativo (${unassignedPositions.length}): ${unassignedPositions.map(formatPosition).join(", ")}${unassignedPositionsRemainder ? `; mais ${unassignedPositionsRemainder} omitidas` : ""}.`
        : "";
      return `Estrutura de ${String(book.title ?? "Livro do Show")} (${sceneCount}):${sceneLines.length ? `\n${sceneLines.join("\n")}` : ""}${sceneRemainder}${unassignedSummary}`;
    }
    const books = Array.isArray(result.books) ? result.books as Record<string, unknown>[] : [];
    if (!books.length) return typeof result.message === "string" ? result.message : "Não encontrei Livros do Show visíveis nessa operação.";
    const statuses: Record<string, string> = { DRAFT: "rascunho", PUBLISHED: "publicado", ARCHIVED: "arquivado" };
    return `Livros do Show visíveis (${books.length}):\n${books.map((book) => {
      const status = statuses[String(book.status)] ?? String(book.status ?? "status não informado");
      const version = Number.isInteger(book.version) ? `v${book.version}` : "versão não informada";
      const location = typeof book.locationName === "string" && book.locationName ? ` · ${book.locationName}` : "";
      const description = typeof book.description === "string" && book.description ? `\n  ${book.description}` : "";
      return `• ${String(book.title ?? "Livro sem título")} · ${status} · ${version}${location}${description}`;
    }).join("\n")}`;
  }
  if (tool === "consultar_meu_dia") {
    const entries = Array.isArray(result.entradas) ? result.entradas as Record<string, unknown>[] : [];
    if (!entries.length) return typeof result.message === "string" ? result.message : `Seu dia em ${dateLabel(result.dateFrom)} está sem atividades escaladas.`;
    const countLabel = entries.length === 1 ? "atividade" : "atividades";
    return `Seu dia em ${dateLabel(result.dateFrom)} (${entries.length} ${countLabel}):\n${entries.map((entry) => {
      const time = [entry.inicio, entry.fim].filter((part): part is string => typeof part === "string" && part.length > 0).map((part) => part.slice(0, 5)).join("–");
      const role = typeof entry.funcao === "string" ? ` · ${entry.funcao}` : "";
      const source = typeof entry.origem === "string" ? ` (${entry.origem})` : "";
      return `• ${time ? `${time} · ` : ""}${String(entry.atividade ?? "Atividade")}${role}${source}`;
    }).join("\n")}`;
  }
  if (tool === "consultar_meu_checkin") {
    if (typeof result.message === "string") return result.message;
    const statuses: Record<string, string> = {
      EXPECTED: "aguardado",
      CHECKED_IN: "registrado",
      LATE: "registrado com atraso",
      ABSENT: "ausência registrada",
      EXCUSED: "ausência justificada",
    };
    const status = typeof result.status === "string" ? statuses[result.status] ?? "não informado" : "não informado";
    const time = typeof result.checkedInAt === "string" ? ` às ${new Date(result.checkedInAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}` : "";
    return `Seu check-in em ${dateLabel(result.date)} está ${status}${time}.`;
  }
  if (tool === "consultar_checkins_equipe") {
    const items = Array.isArray(result.checkIns) ? result.checkIns as Record<string, unknown>[] : [];
    if (!items.length) return typeof result.message === "string" ? result.message : `Ninguém está previsto para check-in em ${dateLabel(result.date)}.`;
    const statuses: Record<string, string> = {
      EXPECTED: "aguardando",
      CHECKED_IN: "presente",
      LATE: "atrasado",
      ABSENT: "ausente",
      EXCUSED: "ausência justificada",
    };
    return `Check-ins da equipe em ${dateLabel(result.date)} (${items.length}):\n${items.map((item) => {
      const status = typeof item.status === "string" ? statuses[item.status] ?? "não informado" : "não informado";
      const time = typeof item.checkedInAt === "string" ? ` · ${new Date(item.checkedInAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}` : "";
      return `• ${String(item.userName ?? "Pessoa")} · ${status}${time}`;
    }).join("\n")}`;
  }
  if (tool === "consultar_escalas") {
    const entries = Array.isArray(result.entradas) ? result.entradas as Record<string, unknown>[] : [];
    if (!entries.length) return "Não encontrei compromissos seus nessa semana.";
    return `Encontrei ${entries.length} compromisso(s) na sua escala:\n${entries.map((entry) => {
      const time = [entry.inicio, entry.fim].filter((part): part is string => typeof part === "string" && part.length > 0).map((part) => part.slice(0, 5)).join("–");
      return `• ${dateLabel(entry.data)}${time ? `, ${time}` : ""}: ${String(entry.atividade ?? "Atividade")}`;
    }).join("\n")}`;
  }
  if (tool === "consultar_atividades") {
    const activities = Array.isArray(result.atividades) ? result.atividades as Record<string, unknown>[] : [];
    if (!activities.length) return typeof result.message === "string" ? result.message : "Não encontrei atividades recorrentes ativas nessa operação.";
    const dayLabels: Record<string, string> = { Dom: "Dom", Seg: "Seg", Ter: "Ter", Qua: "Qua", Qui: "Qui", Sex: "Sex", Sáb: "Sáb" };
    const lines = activities.slice(0, 15).map((activity) => {
      const schedules = Array.isArray(activity.horarios) ? activity.horarios as Record<string, unknown>[] : [];
      const scheduleText = schedules.map((schedule) => {
        const day = typeof schedule.diaSemana === "string" ? dayLabels[schedule.diaSemana] ?? schedule.diaSemana : dateLabel(schedule.dataEspecifica);
        const time = [schedule.inicio, schedule.fim].filter((part): part is string => typeof part === "string" && part.length > 0).map((part) => part.slice(0, 5)).join("–");
        return [day, time].filter(Boolean).join(" ");
      }).filter(Boolean);
      const assignees = Array.isArray(activity.designados) ? (activity.designados as Record<string, unknown>[])
        .map((assignee) => assignee.nome ?? assignee.grupo)
        .filter((name): name is string => typeof name === "string" && name.length > 0) : [];
      return `• ${String(activity.titulo ?? "Atividade")}${scheduleText.length ? ` · ${scheduleText.join(", ")}` : " · sem horário definido"}${assignees.length ? ` · ${assignees.join(", ")}` : ""}`;
    });
    if (activities.length > lines.length) lines.push(`• Mais ${activities.length - lines.length} atividade(s).`);
    return `Atividades recorrentes ativas${result.operationName ? ` em ${String(result.operationName)}` : ""} (${Number(result.total) || activities.length}):\n${lines.join("\n")}`;
  }
  if (tool === "consultar_tarefas") {
    const tasks = Array.isArray(result.tarefas) ? result.tarefas as Record<string, unknown>[] : [];
    if (!tasks.length) return typeof result.message === "string" ? result.message : "Você não tem tarefas atribuídas no momento.";
    const priorities: Record<string, string> = { LOW: "baixa", MEDIUM: "média", HIGH: "alta", CRITICAL: "crítica" };
    const origins: Record<string, string> = { PERSON: "pessoa", ASA: "ASA", MANUAL: "manual", REQUEST: "solicitação", LIBRARY: "biblioteca", AI: "automação" };
    return `Encontrei ${tasks.length} tarefa(s) sua(s):\n${tasks.map((task) => `• ${String(task.title ?? "Tarefa")}${task.dueDate ? ` · prazo ${dateLabel(task.dueDate)}` : ""}${task.status ? ` · ${statusLabel(task.status)}` : ""}${task.priority ? ` · prioridade ${priorities[String(task.priority)] ?? String(task.priority).toLocaleLowerCase("pt-BR")}` : ""}${task.responsibilityTitle ? ` · ${String(task.responsibilityTitle)}` : ""}${task.operationName ? ` · ${String(task.operationName)}` : ""}${task.origin ? ` · origem ${origins[String(task.origin)] ?? String(task.origin).toLocaleLowerCase("pt-BR")}` : ""}`).join("\n")}`;
  }
  if (tool === "consultar_tarefa_requisitos") {
    if (result.found !== true) return typeof result.message === "string" ? result.message : "Não encontrei essa tarefa aberta entre as suas atribuições.";
    const checklist = Array.isArray(result.itensPendentes) ? result.itensPendentes.filter((item): item is string => typeof item === "string") : [];
    const evidences = Array.isArray(result.evidenciasPendentes) ? result.evidenciasPendentes.filter((item): item is string => typeof item === "string") : [];
    if (checklist.length === 0 && evidences.length === 0) {
      if (result.status === "READY_FOR_APPROVAL") return `Os requisitos de “${String(result.title)}” estão completos; a tarefa já aguarda aprovação.`;
      return result.requiresApproval === true
        ? `Os requisitos registrados de “${String(result.title)}” estão completos. Você já pode enviá-la para aprovação.`
        : `Os requisitos registrados de “${String(result.title)}” estão completos. Você já pode concluir a tarefa.`;
    }
    const sections = [
      checklist.length ? `Checklist obrigatória:\n${checklist.map((item) => `• ${item}`).join("\n")}` : "",
      evidences.length ? `Evidências obrigatórias:\n${evidences.map((item) => `• ${item}`).join("\n")}` : "",
    ].filter(Boolean);
    return `Ainda faltam itens para concluir “${String(result.title)}”:\n${sections.join("\n")}`;
  }
  if (tool === "consultar_tarefas_equipe") {
    const tasks = Array.isArray(result.tarefas) ? result.tarefas as Record<string, unknown>[] : [];
    if (!tasks.length) return typeof result.message === "string" ? result.message : "Não encontrei tarefas no escopo autorizado para esse filtro.";
    return `Tarefas da equipe (${tasks.length}):\n${tasks.map((task) => `• ${String(task.title ?? "Tarefa")}${task.assigneeName ? ` · ${String(task.assigneeName)}` : ""}${task.dueDate ? ` · prazo ${dateLabel(task.dueDate)}` : ""}${task.status ? ` · ${statusLabel(task.status)}` : ""}${task.priority ? ` · prioridade ${String(task.priority).toLocaleLowerCase("pt-BR")}` : ""}${task.responsibilityTitle ? ` · ${String(task.responsibilityTitle)}` : ""}${task.operationName ? ` · ${String(task.operationName)}` : ""}`).join("\n")}`;
  }
  if (tool === "consultar_responsabilidades_equipe") {
    const responsibilities = Array.isArray(result.responsabilidades) ? result.responsabilidades as Record<string, unknown>[] : [];
    if (!responsibilities.length) return typeof result.message === "string" ? result.message : "Não encontrei responsabilidades ativas no escopo autorizado.";
    return `Responsabilidades da equipe (${responsibilities.length}):\n${responsibilities.map((item) => {
      const assignees = Array.isArray(item.responsaveis) && item.responsaveis.length
        ? (item.responsaveis as Record<string, unknown>[]).slice(0, 5).map((person) => `${String(person.name ?? "Pessoa")}${person.role ? ` · ${{ PRIMARY: "principal", SECONDARY: "secundária", VIEWER: "observadora" }[String(person.role)] ?? "participante"}` : ""}`).join(", ")
        : "sem responsável ativo";
      const totalAssignees = Array.isArray(item.responsaveis) ? item.responsaveis.length : 0;
      const omitted = totalAssignees > 5 ? `, mais ${totalAssignees - 5}` : "";
      return `• ${String(item.name ?? "Responsabilidade")}${item.areaName ? ` · ${String(item.areaName)}` : ""} · ${assignees}${omitted}`;
    }).join("\n")}`;
  }
  if (tool === "consultar_tempo_livre") {
    const members = Array.isArray(result.membros) ? result.membros as Record<string, unknown>[] : [];
    if (!members.length) return typeof result.message === "string" ? result.message : "Não encontrei intervalos livres nesse dia.";
    const date = dateLabel(result.date);
    const scope = result.mine === true ? "Seus intervalos livres" : "Intervalos livres da equipe";
    return `${scope} em ${date} (janelas de pelo menos uma hora entre atividades publicadas):\n${members.map((member) => {
      const gaps = Array.isArray(member.livres) ? member.livres as Record<string, unknown>[] : [];
      const ranges = gaps.map((gap) => `${String(gap.inicio ?? "").slice(0, 5)}–${String(gap.fim ?? "").slice(0, 5)}`).filter((value) => value !== "–");
      return `• ${result.mine === true ? "Você" : String(member.nome ?? "Pessoa")} · ${ranges.join(", ")}`;
    }).join("\n")}`;
  }
  if (tool === "consultar_notificacoes") {
    const notifications = Array.isArray(result) ? result as Record<string, unknown>[] : [];
    if (!notifications.length) return "Você não tem notificações para mostrar.";
    return `Encontrei ${notifications.length} notificação(ões):\n${notifications.map((item) => `• ${String(item.title ?? "Notificação")}${item.body ? `: ${String(item.body)}` : ""}`).join("\n")}`;
  }
  if (tool === "consultar_avisos") {
    const notices = Array.isArray(result.avisos) ? result.avisos as Record<string, unknown>[] : [];
    if (!notices.length) return "Você não tem avisos publicados e vigentes endereçados a você.";
    return `Seus avisos publicados:\n${notices.map((notice) => `• ${String(notice.title ?? "Aviso")}${notice.urgency ? ` · ${String(notice.urgency).toLocaleLowerCase("pt-BR")}` : ""}${notice.recipientStatus ? ` · ${String(notice.recipientStatus).toLocaleLowerCase("pt-BR")}` : ""}${notice.content ? `\n  ${String(notice.content)}` : ""}`).join("\n")}`;
  }
  if (tool === "consultar_solicitacoes") {
    const requests = Array.isArray(result.solicitacoes) ? result.solicitacoes as Record<string, unknown>[] : [];
    if (!requests.length) return "Você não tem solicitações registradas.";
    const typeLabels: Record<string, string> = {
      LEAVE: "folga/ausência", ROLE_RESTRICTION: "restrição de função", PHYSICAL_RESTRICTION: "restrição física",
      HEALTH_RESTRICTION: "restrição de saúde", SCHEDULE_CHANGE: "alteração de escala", SWAP: "troca", OTHER: "outra solicitação",
    };
    const requestStatusLabels: Record<string, string> = {
      PENDING: "aguardando análise", APPROVED: "aprovada", DENIED: "negada", ALTERNATIVE_PROPOSED: "aguardando sua resposta",
      ALTERNATIVE_ACCEPTED: "alternativa aceita", ALTERNATIVE_REJECTED: "alternativa recusada", EXPIRED: "expirada",
    };
    return `Suas solicitações (${requests.length}):\n${requests.map((item) => {
      const dates = Array.isArray(item.targetDates) ? item.targetDates.slice(0, 5).map(dateLabel).filter(Boolean).join(", ") : "";
      const status = typeof item.status === "string" ? requestStatusLabels[item.status] ?? statusLabel(item.status) : "status desconhecido";
      return `• ${typeLabels[String(item.type)] ?? "Solicitação"} · ${status}${dates ? ` · ${dates}` : ""}${item.operationName ? ` · ${String(item.operationName)}` : ""}`;
    }).join("\n")}`;
  }
  if (tool === "consultar_mensagens") {
    const messages = Array.isArray(result.mensagens) ? result.mensagens as Record<string, unknown>[] : [];
    if (!messages.length) return typeof result.message === "string" ? result.message : result.unreadOnly === true ? "Você não tem mensagens não lidas nas suas conversas." : "Não encontrei mensagens nas suas conversas para esse filtro.";
    const qualifier = result.unreadOnly === true ? " não lida(s)" : "";
    return `Encontrei ${messages.length} mensagem(ns)${qualifier} nas suas conversas:\n${messages.map((item) => `• ${String(item.threadTitle ?? "Conversa")} · ${String(item.senderName ?? "Pessoa")}${item.createdAt ? ` · ${dateLabel(String(item.createdAt))}` : ""}${item.content ? `\n  ${String(item.content)}` : ""}`).join("\n")}`;
  }
  if (tool === "consultar_mural") {
    const posts = Array.isArray(result.posts) ? result.posts as Record<string, unknown>[] : [];
    if (!posts.length) return typeof result.message === "string" ? result.message : "Não encontrei publicações visíveis no Mural para esse filtro.";
    const types: Record<string, string> = { NOTICE: "Aviso", RECOGNITION: "Reconhecimento", BIRTHDAY: "Aniversário", TENURE: "Tempo de casa" };
    return `Publicações visíveis no Mural (${posts.length}):\n${posts.map((post) => {
      const type = types[String(post.type)] ?? "Publicação";
      const title = typeof post.title === "string" && post.title ? ` · ${post.title}` : "";
      const scope = post.scope === "AREA" ? ` · ${String(post.areaName ?? "área")}` : post.scope === "LOCATION" ? ` · ${String(post.locationName ?? "local")}` : " · Casa";
      const ack = post.requiresConfirmation === true ? post.confirmedAt ? " · ciente registrado" : " · ciente pendente" : "";
      const fullBody = typeof post.body === "string" ? post.body : "";
      const body = fullBody.slice(0, 360);
      return `• ${type}${title}${scope} · ${String(post.authorName ?? "Equipe")}${post.publishedAt ? ` · ${dateLabel(String(post.publishedAt))}` : ""}${ack}${body ? `\n  ${body}${fullBody.length > body.length ? "…" : ""}` : ""}`;
    }).join("\n")}`;
  }
  if (tool === "consultar_pessoas") {
    const people = Array.isArray(result.pessoas) ? result.pessoas as Record<string, unknown>[] : [];
    if (!people.length) return typeof result.message === "string" ? result.message : "Não encontrei pessoas ativas com esse nome ou área.";
    return `Pessoas encontradas (${people.length}):\n${people.slice(0, 20).map((person) => `• ${String(person.name ?? "Pessoa")}${person.areaName ? ` · ${String(person.areaName)}` : ""}`).join("\n")}`;
  }
  if (tool === "consultar_locais") {
    const locations = Array.isArray(result.locais) ? result.locais as Record<string, unknown>[] : [];
    if (!locations.length) return typeof result.message === "string" ? result.message : "Não encontrei locais abertos no seu escopo.";
    return `Locais no seu escopo (${locations.length}):\n${locations.slice(0, 20).map((location) => `• ${String(location.name ?? "Local")}${location.type ? ` · ${String(location.type)}` : ""}`).join("\n")}`;
  }
  if (tool === "consultar_entregas") {
    const assignments = Array.isArray(result.entregas) ? result.entregas as Record<string, unknown>[] : [];
    if (result.scope === "team") {
      if (!assignments.length) return typeof result.message === "string" ? result.message : "Não encontrei entregas publicadas na operação selecionada.";
      const types: Record<string, string> = { MANDATORY_READ: "leitura obrigatória", MANDATORY_VIDEO: "vídeo obrigatório", OPERATIONAL_UPDATE: "atualização operacional", CHECKLIST: "checklist", READING: "leitura", VIDEO: "vídeo" };
      return `Entregas da equipe (${assignments.length}):\n${assignments.slice(0, 20).map((item) => {
        const assigned = Number(item.assignedCount) || 0;
        const completed = Number(item.completedCount) || 0;
        const assignedLabel = assigned === 1 ? "1 pessoa atribuída" : `${assigned} pessoas atribuídas`;
        const completedLabel = completed === 1 ? "1 concluída" : `${completed} concluídas`;
        return `• ${String(item.title ?? "Entrega")}${item.type ? ` · ${types[String(item.type)] ?? String(item.type)}` : ""}${item.dueDate ? ` · prazo ${dateLabel(item.dueDate)}` : ""} · ${assignedLabel}, ${completedLabel}`;
      }).join("\n")}`;
    }
    if (!assignments.length) return "Você não tem entregas atribuídas no momento.";
    const types: Record<string, string> = { MANDATORY_READ: "leitura obrigatória", MANDATORY_VIDEO: "vídeo obrigatório", OPERATIONAL_UPDATE: "atualização operacional", CHECKLIST: "checklist", READING: "leitura", VIDEO: "vídeo" };
    return `Suas entregas (${assignments.length}):\n${assignments.slice(0, 20).map((item) => `• ${String(item.title ?? "Entrega")}${item.type ? ` · ${types[String(item.type)] ?? String(item.type)}` : ""}${item.status ? ` · ${statusLabel(item.status)}` : ""}${item.dueDate ? ` · prazo ${dateLabel(item.dueDate)}` : ""}`).join("\n")}`;
  }
  if (tool === "consultar_relatorio_checkins") {
    const total = Number(result.total) || 0;
    if (!total) return `Não encontrei registros de check-in entre ${dateLabel(result.startDate)} e ${dateLabel(result.endDate)}.`;
    const period = result.period === "today" ? "hoje" : result.period === "30d" ? "nos últimos 30 dias" : "nos últimos 7 dias";
    const rates = result.rates && typeof result.rates === "object" ? result.rates as Record<string, unknown> : {};
    return `Resumo de check-ins ${period} (${dateLabel(result.startDate)} a ${dateLabel(result.endDate)}): ${Number(result.checkedIn) || 0} presentes, ${Number(result.late) || 0} atrasados, ${Number(result.absent) || 0} ausentes, ${Number(result.excused) || 0} justificadas e ${Number(result.expected) || 0} pendentes. Presença registrada: ${Number(rates.presence) || 0}%.`;
  }
  if (tool === "consultar_relatorio_tarefas") {
    const total = Number(result.total) || 0;
    if (!total) return `Não encontrei tarefas com prazo entre ${dateLabel(result.startDate)} e ${dateLabel(result.endDate)}.`;
    const period = result.period === "today" ? "hoje" : result.period === "30d" ? "nos últimos 30 dias" : "nos últimos 7 dias";
    return `Resumo de tarefas ${period} (${dateLabel(result.startDate)} a ${dateLabel(result.endDate)}): ${total} no total, ${Number(result.pending) || 0} pendentes, ${Number(result.inProgress) || 0} em andamento, ${Number(result.awaitingApproval) || 0} aguardando aprovação, ${Number(result.changesRequested) || 0} com ajustes solicitados e ${Number(result.completed) || 0} concluídas/aprovadas.`;
  }
  if (tool === "consultar_folgas") {
    const folgas = Array.isArray(result.folgas) ? result.folgas as Record<string, unknown>[] : [];
    if (!folgas.length) return typeof result.message === "string" ? result.message : "Não encontrei folgas suas nesse período.";
    return `Suas folgas registradas:\n${folgas.map((item) => {
      const start = dateLabel(item.startDate);
      const end = dateLabel(item.endDate);
      const period = start === end ? start : `${start} a ${end}`;
      return `• ${period}${item.type ? ` · ${statusLabel(item.type)}` : ""}${item.notes ? ` · ${String(item.notes)}` : ""}`;
    }).join("\n")}`;
  }
  if (tool === "consultar_responsabilidades") {
    const rows = Array.isArray(result.responsabilidades) ? result.responsabilidades as Record<string, unknown>[] : [];
    if (!rows.length) return "Não encontrei responsabilidades ativas atribuídas a você.";
    const roleLabels: Record<string, string> = { PRIMARY: "principal", SECONDARY: "apoio", VIEWER: "consulta" };
    return `Encontrei ${rows.length} responsabilidade(s) sua(s):\n${rows.map((item) => {
      const startsAt = item.startsAt ? dateLabel(String(item.startsAt)) : "";
      const endsAt = item.endsAt ? dateLabel(String(item.endsAt)) : "";
      const validity = startsAt || endsAt ? ` · vigência ${startsAt ? `desde ${startsAt}` : ""}${startsAt && endsAt ? " " : ""}${endsAt ? `até ${endsAt}` : ""}` : "";
      return `• ${String(item.name ?? "Responsabilidade")}${item.category ? ` · ${String(item.category).toLocaleLowerCase("pt-BR")}` : ""}${item.role ? ` · ${roleLabels[String(item.role)] ?? String(item.role).toLocaleLowerCase("pt-BR")}` : ""}${validity}`;
    }).join("\n")}`;
  }
  if (tool === "consultar_biblioteca") {
    const docs = Array.isArray(result.docs) ? result.docs as Record<string, unknown>[] : [];
    if (!docs.length) return typeof result.message === "string" ? result.message : "Não encontrei documentos publicados no seu escopo sobre esse assunto.";
    return `Encontrei ${docs.length} documento(s) publicado(s) no seu escopo:\n${docs.slice(0, 5).map((doc) => {
      const title = String(doc.title ?? "Documento");
      const id = typeof doc.id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(doc.id) ? doc.id : null;
      const version = Number.isInteger(doc.version) && Number(doc.version) > 0 ? ` · v${Number(doc.version)}` : "";
      const category = typeof doc.categoryName === "string" && doc.categoryName ? ` · ${doc.categoryName}` : "";
      const location = typeof doc.locationName === "string" && doc.locationName ? ` · Local: ${doc.locationName}` : "";
      const citation = doc.citation && typeof doc.citation === "object" ? doc.citation as Record<string, unknown> : null;
      const page = citation && Number.isInteger(citation.pageNumber) && Number(citation.pageNumber) > 0 ? `p. ${Number(citation.pageNumber)}` : null;
      const excerpt = citation && typeof citation.excerpt === "string" ? citation.excerpt : null;
      const source = excerpt && page ? `\n  ${excerpt}\n  Fonte: ${page}${version}` : "\n  Encontrei o documento, mas ainda não há um trecho com página cadastrada para citar.";
      return `• ${title}${version}${category}${location}${source}${id ? `\n  /admin/search?document=${id}` : ""}`;
    }).join("\n")}`;
  }
  if (tool === "consultar_minhas_leituras_pendentes_biblioteca") {
    const docs = Array.isArray(result.docs) ? result.docs as Record<string, unknown>[] : [];
    if (!docs.length) return "Você não tem confirmações de leitura pendentes nos documentos publicados da Biblioteca que estão no seu escopo.";
    return `Você tem ${docs.length} leitura(s) obrigatória(s) pendente(s):\n${docs.slice(0, 10).map((doc) => {
      const title = String(doc.title ?? "Documento");
      const id = typeof doc.id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(doc.id) ? doc.id : null;
      return `• ${title}${doc.summary ? ` — ${String(doc.summary)}` : ""}${id ? `\n  /admin/search?document=${id}` : ""}`;
    }).join("\n")}`;
  }
  if (tool === "consultar_estado_biblioteca") {
    if (typeof result.error === "string") return result.error;
    const count = (value: unknown) => Number(value) || 0;
    const samples = (value: unknown) => Array.isArray(value) ? value as Record<string, unknown>[] : [];
    const lines = [
      `Publicados para revisão há mais de 90 dias: ${count(result.staleCount)}`,
      `Alterações aguardando republicação: ${count(result.republishCount)}`,
      `Rascunhos: ${count(result.draftCount)}`,
    ];
    const stale = samples(result.stale);
    const republish = samples(result.republish);
    const drafts = samples(result.drafts);
    if (stale.length) lines.push(`Revisar: ${stale.map((doc) => String(doc.title ?? "Documento")).join(", ")}`);
    if (republish.length) lines.push(`Republicar: ${republish.map((doc) => String(doc.title ?? "Documento")).join(", ")}`);
    if (drafts.length) lines.push(`Rascunhos: ${drafts.map((doc) => String(doc.title ?? "Documento")).join(", ")}`);
    return `Estado da Biblioteca:\n${lines.join("\n")}`;
  }
  const absences = Array.isArray(result.ausencias) ? result.ausencias as Record<string, unknown>[] : [];
  if (!absences.length) return typeof result.message === "string" ? result.message : "Não encontrei folgas da equipe nessa data.";
  return `Folgas registradas para ${dateLabel(result.date)}:\n${absences.map((item) => `• ${String(item.nome ?? item.userName ?? "Pessoa")}${item.type ? ` · ${statusLabel(item.type)}` : ""}`).join("\n")}`;
}
