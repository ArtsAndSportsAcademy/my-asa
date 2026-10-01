import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { BackButton } from "@/components/BackButton";
import { AsaAvatar, type AsaPose } from "@/components/AsaAvatar";
import { AsaSpeechBubble } from "@/components/AsaSpeechBubble";
import { selectAsaSuggestions, type AsaProactivityLevel, type AsaSuggestionFrequency, type AsaSuggestionMode } from "@workspace/shared";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  tools?: string[];
  streaming?: boolean;
  proposal?: AsaProposal;
  undo?: AsaUndo;
  undoState?: "UNDONE";
  undoError?: string;
}

interface AsaUndo {
  id: string;
  expiresAt: string;
  windowSeconds: number;
}

interface AsaProposal {
  id: string;
  actionType: string;
  title: string;
  recipientName?: string;
  recipientNames?: string[];
  previousResponsibilityTitle?: string | null;
  newResponsibilityTitle?: string | null;
  newTitle?: string;
  previousTitle?: string;
  previousStatus?: string;
  expectedStatus?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  content?: string;
  evidenceUrl?: string;
  evidenceDescription?: string;
  previousContent?: string;
  announcementContent?: string;
  reaction?: string;
  previousReaction?: string | null;
  operationName: string;
  recipientCount?: number;
  assigneeName?: string;
  checklistLabels?: string[];
  checklistItemLabel?: string;
  checklistKind?: "mandatory" | "operational";
  checklistCompleted?: boolean;
  previousChecklistCompleted?: boolean;
  mandatoryEvidences?: Array<{ type: string; description: string }>;
  previousChecklistLabels?: string[];
  previousMandatoryEvidences?: Array<{ type?: string; description?: string }>;
  previousAssigneeName?: string;
  previousDate?: string;
  previousStartTime?: string | null;
  previousEndTime?: string | null;
  previousNotes?: string | null;
  notes?: string | null;
  dueDate?: string;
  previousDueDate?: string;
  previousPriority?: string;
  priority?: string;
  previousMode?: string;
  mode?: string;
  changes?: Array<{ key: string; label: string; before: string; after: string }>;
  previousDescription?: string | null;
  description?: string;
  responsibilityTitle?: string;
  expiresAt: string;
  state: string;
}

interface AsaSuggestionChip {
  label: string;
  prompt: string;
}

function taskPriorityLabel(priority?: string) {
  return ({ LOW: "baixa", MEDIUM: "média", HIGH: "alta", CRITICAL: "crítica" } as Record<string, string>)[priority ?? "MEDIUM"] ?? "média";
}

function proposalConfirmLabel(actionType: string) {
  return ({
    TASK_COMMENT_CREATE: "Publicar comentário", TASK_EVIDENCE_LINK_ADD: "Anexar link", TASK_CHECKLIST_UPDATE: "Atualizar item", TASK_CANCEL: "Cancelar tarefa",
    ASA_PREFERENCE_UPDATE: "Atualizar preferências", AGENDA_DRAFT_NOTES_UPDATE: "Atualizar observações",
    AGENDA_DRAFT_SCHEDULE_UPDATE: "Atualizar horário", AGENDA_DRAFT_RENAME: "Renomear rascunho",
    NOTICE_DRAFT_UPDATE: "Atualizar rascunho", MURAL_ACK: "Registrar ciente", AGENDA_MEETING_CREATE: "Criar reunião",
    TASK_CREATE: "Criar tarefa", TASK_START: "Iniciar tarefa", TASK_READY_FOR_APPROVAL: "Enviar para aprovação",
    TASK_COMPLETE: "Concluir tarefa", TASK_UPDATE_DUE_DATE: "Atualizar prazo", TASK_UPDATE_ASSIGNEE: "Atualizar responsável",
    TASK_UPDATE_PRIORITY: "Atualizar prioridade", TASK_UPDATE_DESCRIPTION: "Atualizar descrição",
    TASK_UPDATE_TITLE: "Atualizar título", TASK_UPDATE_REQUIREMENTS: "Atualizar requisitos",
    TASK_UPDATE_RESPONSIBILITY: "Atualizar vínculo",
  } as Record<string, string>)[actionType] ?? "Criar rascunho";
}

function proposalStateLabel(actionType: string, state: string, expectedStatus?: string) {
  if (state === "PENDING") return "Prévia expirada";
  if (state === "CANCELLED") return "Proposta cancelada";
  if (state !== "CONFIRMED") return "Proposta não está mais disponível";
  const labels: Record<string, string> = {
    TASK_COMMENT_CREATE: "Comentário publicado", TASK_EVIDENCE_LINK_ADD: "Link complementar anexado", TASK_CHECKLIST_UPDATE: "Checklist atualizada", TASK_CANCEL: "Tarefa cancelada",
    AGENDA_DRAFT_NOTES_UPDATE: "Observações atualizadas; rascunho não confirmado",
    AGENDA_DRAFT_SCHEDULE_UPDATE: "Data e horário atualizados; rascunho não confirmado",
    AGENDA_DRAFT_RENAME: "Rascunho renomeado; não confirmado", NOTICE_DRAFT_UPDATE: "Rascunho atualizado; não publicado",
    ASA_PREFERENCE_UPDATE: "Preferências atualizadas", MURAL_ACK: "Ciente registrado", TASK_CREATE: "Tarefa criada; aprovação após a conclusão",
    TASK_START: "Tarefa iniciada", TASK_READY_FOR_APPROVAL: "Enviada para aprovação", TASK_COMPLETE: "Tarefa concluída",
    TASK_UPDATE_DUE_DATE: "Prazo atualizado", TASK_UPDATE_ASSIGNEE: "Responsável atualizado",
    TASK_UPDATE_PRIORITY: "Prioridade atualizada", TASK_UPDATE_DESCRIPTION: "Descrição atualizada",
    TASK_UPDATE_TITLE: "Título atualizado", TASK_UPDATE_REQUIREMENTS: "Requisitos atualizados",
    TASK_UPDATE_RESPONSIBILITY: "Responsabilidade atualizada",
  };
  if (actionType === "AGENDA_MEETING_CREATE") return expectedStatus === "PROPOSED" ? "Proposta enviada à Supervisão" : "Rascunho criado na Agenda";
  return labels[actionType] ?? "Rascunho criado, não publicado";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getBaseUrl(): Promise<string> {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}`;
  return "";
}

// ─── Tool → Pose map ──────────────────────────────────────────────────────────

const BASE_TOOL_POSE: Record<string, AsaPose> = {
  consultar_agenda:               "analisando",
  consultar_meu_dia:              "analisando",
  consultar_meu_checkin:          "analisando",
  consultar_checkins_equipe:      "analisando",
  consultar_escalas:              "analisando",
  consultar_responsabilidades:    "analisando",
  consultar_pessoas:              "analisando",
  consultar_locais:               "analisando",
  consultar_entregas:              "analisando",
  consultar_notificacoes:         "analisando",
  consultar_avisos:               "analisando",
  consultar_tarefas:              "analisando",
  consultar_tarefas_equipe:       "analisando",
  consultar_memorias:             "analisando",
  consultar_folgas:               "analisando",
  consultar_tempo_livre:           "analisando",
  consultar_ausencias_do_dia:     "analisando",
  consultar_disponibilidade:      "analisando",
  consultar_membros:              "analisando",
  consultar_reconhecimentos:      "analisando",
  consultar_marcos:               "analisando",
  consultar_historico_membro:     "analisando",
  consultar_estatisticas:         "analisando",
  consultar_indicadores:          "analisando",
  consultar_desempenho:           "analisando",
  consultar_ausencias_historicas: "analisando",
  consultar_tarefas_historicas:   "analisando",
  consultar_carga_historica:      "analisando",
  consultar_carga_operacional:    "analisando",
  consultar_riscos_operacionais:  "analisando",
  consultar_posicoes_abertas:     "analisando",
  consultar_tarefas_criticas:     "analisando",
  consultar_conflitos:            "analisando",
  consultar_padroes:              "analisando",
  consultar_aprendizados:         "analisando",
  consultar_riscos_recorrentes:   "analisando",
  analisar_conversa:              "analisando",
  resumir_conversa:               "analisando",
  destacar_itens:                 "analisando",
  detectar_conquistas:            "analisando",
  detectar_eventos:               "analisando",
  detectar_tarefas:               "analisando",
  detectar_ausencias:             "analisando",
  detectar_trocas:                "analisando",
  detectar_marcos:                "analisando",
  enviar_push:                    "carregando",
  consultar_biblioteca:           "biblioteca",
  consultar_estado_biblioteca:    "biblioteca",
  resumir_documento:              "biblioteca",
  comparar_documentos:            "biblioteca",
  consultar_perguntas_frequentes: "biblioteca",
  consultar_documentos_populares: "biblioteca",
  sugerir_leituras:               "biblioteca",
  consultar_leituras_biblioteca:  "biblioteca",
  gerar_resumo_do_dia:            "planejando",
  consultar_tendencias:           "planejando",
  gerar_relatorio_asa:            "planejando",
  consultar_clima:                "analisando",
  sugerir_memoria:                "recomendacao",
  sugerir_cobertura:              "recomendacao",
  consultar_aniversarios:         "comemoracao",
  criar_aviso_rascunho:           "enviando",
  criar_ensaio_rascunho:          "enviando",
  criar_entrada_escala:           "enviando",
  criar_tarefa:                   "enviando",
  publicar_aviso:                 "enviando",
  publicar_escala:                "enviando",
  criar_bloco_agenda:             "enviando",
  criar_reconhecimento:           "enviando",
  criar_reconhecimento_automatico:"enviando",
  criar_solicitacao_troca:        "enviando",
  registrar_ausencia:             "enviando",
  cancelar_ausencia:              "enviando",
  cancelar_tarefa:                "enviando",
  remover_entrada_escala:         "enviando",
};

interface ClimaResult {
  weatherCode?: number;
  temp?: number;
}

const RAIN_CODES = [45, 48, 51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99];
const SNOW_CODES = [71, 73, 75, 77, 85, 86];

function climaPose(result: ClimaResult): AsaPose {
  const { weatherCode: code, temp } = result;
  if (code != null && RAIN_CODES.includes(code)) return "chuva";
  if (code != null && SNOW_CODES.includes(code)) return "frio";
  if (temp != null && temp < 15) return "frio";
  return "bomdia";
}

function toolResultToPose(tool: string | null, result?: ClimaResult | null): AsaPose {
  if (!tool) return "analisando";
  if (tool === "consultar_clima" && result) return climaPose(result);
  return BASE_TOOL_POSE[tool] ?? "analisando";
}

function deriveFinishedPose(tools: string[], content: string, climaResult?: ClimaResult | null): AsaPose {
  if (tools.includes("consultar_clima")) {
    if (climaResult) return climaPose(climaResult);
    const lower = content.toLowerCase();
    const rainWords = ["chuva", "chuvoso", "tempestade", "garoa", "neblina", "nublado", "precipitação"];
    const coldWords = ["frio", "gélido", "gelado"];
    if (rainWords.some((w) => lower.includes(w))) return "chuva";
    if (coldWords.some((w) => lower.includes(w))) return "frio";
    const tempMatch = lower.match(/(\d+)\s*°/);
    if (tempMatch && parseInt(tempMatch[1]) < 15) return "frio";
    return "bomdia";
  }
  if (tools.includes("consultar_aniversarios") || tools.includes("detectar_marcos")) return "comemoracao";
  if (
    tools.some((t) =>
      ["criar_tarefa", "publicar_aviso", "publicar_escala", "registrar_ausencia", "criar_entrada_escala"].includes(t)
    )
  ) return "tarefa_concluida";
  return "feliz";
}

// ─── Tool Labels ───────────────────────────────────────────────────────────────

const TOOL_LABELS: Record<string, string> = {
  consultar_agenda:            "📅 Consultando agenda",
  consultar_meu_dia:           "☀️ Consultando seu dia",
  consultar_meu_checkin:       "✅ Consultando seu check-in",
  consultar_checkins_equipe:   "✅ Consultando check-ins da equipe",
  consultar_escalas:           "📋 Consultando escalas",
  consultar_responsabilidades: "👥 Consultando responsabilidades",
  consultar_notificacoes:      "🔔 Consultando notificações",
  consultar_avisos:            "📢 Consultando avisos",
  consultar_tarefas:           "✅ Consultando tarefas",
  consultar_tarefas_equipe:    "👥 Consultando tarefas da equipe",
  consultar_memorias:          "🧠 Consultando memórias",
  consultar_folgas:            "🌴 Consultando folgas",
  consultar_tempo_livre:        "🕒 Consultando intervalos livres",
  consultar_ausencias_do_dia:  "🌴 Verificando ausências",
  consultar_disponibilidade:   "🔍 Verificando disponibilidade",
  consultar_membros:           "👤 Buscando membro",
  criar_aviso_rascunho:        "✏️ Criando rascunho de aviso",
  criar_ensaio_rascunho:       "🎭 Criando rascunho de ensaio",
  criar_entrada_escala:        "📋 Adicionando à escala",
  criar_tarefa:                "✅ Criando tarefa",
  consultar_biblioteca:        "📚 Consultando biblioteca",
  consultar_estado_biblioteca: "📚 Verificando estado da Biblioteca",
  gerar_resumo_do_dia:         "☀️ Gerando resumo do dia",
  consultar_aniversarios:      "🎉 Consultando aniversários",
  consultar_clima:             "🌤️ Consultando clima",
  sugerir_memoria:             "💡 Sugerindo memória",
  consultar_reconhecimentos:   "🏆 Consultando reconhecimentos",
  criar_reconhecimento:        "🎖️ Criando reconhecimento",
  detectar_marcos:             "⭐ Detectando marcos",
  enviar_push:                 "🔔 Enviando notificação push",
  registrar_ausencia:          "📋 Registrando ausência",
  criar_solicitacao_troca:     "🔄 Criando solicitação de troca",
  consultar_riscos_operacionais: "⚠️ Analisando riscos",
  consultar_posicoes_abertas:  "🔍 Verificando posições abertas",
  consultar_tarefas_criticas:  "📌 Verificando tarefas críticas",
  consultar_conflitos:         "⚡ Verificando conflitos",
  sugerir_cobertura:           "💡 Sugerindo cobertura",
  consultar_carga_operacional: "📊 Analisando carga operacional",
  detectar_conquistas:            "🏆 Detectando conquistas",
  consultar_marcos:               "⭐ Consultando marcos futuros",
  criar_reconhecimento_automatico:"🎖️ Criando reconhecimento automático",
  consultar_historico_membro:     "📋 Consultando histórico do membro",
  analisar_conversa:              "💬 Analisando conversa",
  detectar_eventos:               "📅 Detectando eventos",
  detectar_tarefas:               "📌 Detectando tarefas",
  detectar_ausencias:             "🌴 Detectando ausências",
  detectar_trocas:                "🔄 Detectando trocas",
  resumir_conversa:               "📋 Resumindo conversa",
  destacar_itens:                 "⚠️ Destacando itens importantes",
  consultar_estatisticas:         "📈 Consultando estatísticas",
  consultar_indicadores:          "📊 Consultando indicadores",
  consultar_desempenho:           "🏅 Analisando desempenho",
  consultar_ausencias_historicas: "🌴 Analisando histórico de ausências",
  consultar_tarefas_historicas:   "📌 Analisando histórico de tarefas",
  consultar_carga_historica:      "📊 Analisando carga histórica",
  resumir_documento:              "📚 Resumindo documento",
  comparar_documentos:            "🔍 Comparando documentos",
  consultar_perguntas_frequentes: "❓ Consultando perguntas frequentes",
  consultar_documentos_populares: "📋 Consultando documentos da biblioteca",
  sugerir_leituras:               "💡 Buscando leituras relevantes",
  publicar_aviso:                 "📢 Publicando aviso",
  publicar_escala:                "📅 Publicando escala",
  criar_bloco_agenda:             "🟦 Criando bloco na agenda",
  consultar_leituras_biblioteca:  "📖 Verificando leituras da biblioteca",
  cancelar_ausencia:              "🌴 Cancelando ausência",
  cancelar_tarefa:                "📌 Cancelando tarefa",
  remover_entrada_escala:         "📅 Removendo entrada da escala",
  consultar_tendencias:           "📈 Analisando tendências",
  consultar_padroes:              "🔍 Identificando padrões",
  consultar_aprendizados:         "💡 Consultando aprendizados",
  consultar_riscos_recorrentes:   "⚠️ Identificando riscos recorrentes",
  gerar_relatorio_asa:            "📊 Gerando relatório",
};

const SUGGESTIONS_MANAGER = [
  "Quem está de folga hoje?",
  "Mostra as tarefas pendentes da equipe",
  "Mostra os check-ins da equipe hoje",
  "Mostra o Livro do Dia de hoje",
];

const SUGGESTIONS_MEMBER = [
  "Qual é minha escala essa semana?",
  "Quais são meus avisos ativos?",
  "Quais tarefas tenho pendentes?",
];

const ASA_PAGE_CONTEXT: Record<string, string> = {
  "(stack)/index": "/meu-dia",
  "(stack)/insights": "/supervisor/insights",
  "(tabs)/meu-dia": "/meu-dia",
  "(tabs)/mensagens": "/membro/mensagens",
  "(stack)/agenda": "/agenda",
  "(stack)/folgas": "/folgas",
  "(stack)/responsabilidades": "/responsabilidades",
  "(stack)/scale": "/escalas",
  "(stack)/tarefas": "/membro/tarefas",
  "(stack)/entregas": "/membro/entregas",
  "(stack)/solicitacoes": "/membro/solicitacoes",
  "(stack)/notificacoes": "/notificacoes",
  "(stack)/biblioteca": "/membro/biblioteca",
  "(stack)/daily-book": "/membro/livro-do-dia",
  "(stack)/show-book": "/admin/show-book",
  "(tabs)/avisos": "/membro/avisos",
};

const PAGE_SUGGESTIONS: Record<string, string[]> = {
  "/meu-dia": ["O que tenho aqui?", "Meu dia hoje"],
  "/supervisor/insights": ["O que tenho aqui?", "Mostra os check-ins da equipe hoje", "Mostra as tarefas pendentes da equipe"],
  "/membro/mensagens": ["Minhas mensagens não lidas", "Busque nas mensagens por ‘figurino’"],
  "/agenda": ["O que tenho aqui?", "Mostra a agenda de hoje"],
  "/folgas": ["O que tenho aqui?", "Minhas folgas deste mês"],
  "/responsabilidades": ["O que tenho aqui?", "Quais são minhas tarefas pendentes?"],
  "/escalas": ["O que tenho aqui?", "Qual é minha escala essa semana?"],
  "/membro/tarefas": ["O que tenho aqui?", "Quais são minhas tarefas pendentes?"],
  "/membro/entregas": ["O que tenho aqui?", "Minhas entregas"],
  "/membro/solicitacoes": ["O que tenho aqui?", "Minhas solicitações"],
  "/notificacoes": ["O que tenho aqui?", "Minhas notificações não lidas"],
  "/membro/biblioteca": ["Quais leituras estão pendentes na Biblioteca?", "Buscar na biblioteca “escala”", "Buscar na biblioteca “figurino”"],
  "/membro/livro-do-dia": ["O que tenho aqui?", "Mostra o Livro do Dia de hoje"],
  "/admin/show-book": ["O que tenho aqui?", "Quais Livros do Show estão disponíveis?"],
  "/membro/avisos": ["O que tenho aqui?", "Meus avisos"],
};

// ─── Message Bubble ────────────────────────────────────────────────────────────

function MessageBubble({
  msg,
  colors,
  streamingPose,
  proposalBusy,
  onResolveProposal,
  undoBusy,
  undoNow,
  onUndo,
}: {
  msg: Message;
  colors: ReturnType<typeof useColors>;
  streamingPose: AsaPose;
  proposalBusy: boolean;
  onResolveProposal: (proposal: AsaProposal, action: "confirm" | "cancel") => void;
  undoBusy: boolean;
  undoNow: number;
  onUndo: (undo: AsaUndo) => void;
}) {
  const router = useRouter();
  const isUser = msg.role === "user";
  const bubblePose: AsaPose = msg.streaming ? streamingPose : "idle";
  const contentParts = (msg.content || "").split(/(\/admin\/search\?document=[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi);

  return (
    <View style={[styles.messageRow, isUser && styles.messageRowUser]}>
      {!isUser && (
        <AsaAvatar size="small" pose={bubblePose} />
      )}
      <View style={[
        styles.bubble,
        isUser
          ? [styles.bubbleUser, { backgroundColor: colors.primary }]
          : [styles.bubbleAssistant, { backgroundColor: colors.card, borderColor: colors.border }],
        { maxWidth: "80%" },
      ]}>
        {msg.tools && msg.tools.length > 0 && (
          <View style={styles.toolsRow}>
            {msg.tools.map((t, i) => (
              <View key={i} style={[styles.toolBadge, { backgroundColor: colors.muted }]}>
                <Text style={[styles.toolBadgeText, { color: colors.mutedForeground }]}>
                  {TOOL_LABELS[t] ?? t}
                </Text>
              </View>
            ))}
          </View>
        )}
        {msg.content ? (
          <Text style={[styles.bubbleText, { color: isUser ? "#fff" : colors.foreground }]}>
            {contentParts.map((part, index) => {
              const documentId = part.match(/^\/admin\/search\?document=([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i)?.[1];
              return documentId
                ? <Text key={`${documentId}-${index}`} accessibilityRole="link" onPress={() => router.push({ pathname: "/(stack)/biblioteca", params: { document: documentId } })} style={{ color: colors.primary, textDecorationLine: "underline" }}>Abrir documento</Text>
                : part;
            })}
          </Text>
        ) : msg.streaming ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>Pensando…</Text>
          </View>
        ) : null}
        {(msg.proposal?.actionType === "MESSAGE_DIRECT_CREATE" || msg.proposal?.actionType === "MESSAGE_REPLY") && (
          <View style={[styles.proposalBox, { borderColor: colors.border, backgroundColor: colors.background }]}>
            <Text style={[styles.proposalTitle, { color: colors.foreground }]}>{msg.proposal.actionType === "MESSAGE_REPLY" ? `Resposta para ${(msg.proposal.recipientNames ?? []).join(", ")}` : `Mensagem para ${msg.proposal.recipientName}`}</Text>
            <Text style={[styles.proposalMeta, { color: colors.mutedForeground }]}>{msg.proposal.actionType === "MESSAGE_REPLY" ? `Conversa: ${msg.proposal.title}` : `Assunto: ${msg.proposal.title}`}</Text>
            <Text style={[styles.proposalMeta, { color: colors.foreground }]}>{msg.proposal.content}</Text>
            <Text style={[styles.proposalMeta, { color: colors.mutedForeground }]}>Expira {new Date(msg.proposal.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Text>
            {msg.proposal.state === "PENDING" && Date.parse(msg.proposal.expiresAt) > Date.now() ? (
              <View style={styles.proposalActions}>
                <Pressable disabled={proposalBusy} onPress={() => onResolveProposal(msg.proposal!, "confirm")} style={[styles.proposalButton, { backgroundColor: "#246a55", opacity: proposalBusy ? 0.6 : 1 }]}>
                  <Feather name="check" size={14} color="#fff" />
                  <Text style={styles.proposalButtonText}>{msg.proposal.actionType === "MESSAGE_REPLY" ? "Enviar resposta" : "Enviar mensagem"}</Text>
                </Pressable>
                <Pressable disabled={proposalBusy} onPress={() => onResolveProposal(msg.proposal!, "cancel")} style={[styles.proposalButton, { borderColor: colors.border, opacity: proposalBusy ? 0.6 : 1 }]}>
                  <Feather name="x" size={14} color={colors.foreground} />
                  <Text style={[styles.proposalButtonText, { color: colors.foreground }]}>Cancelar</Text>
                </Pressable>
              </View>
            ) : (
              <Text style={[styles.proposalMeta, { color: colors.mutedForeground }]}>{msg.proposal.state === "CONFIRMED" ? msg.proposal.actionType === "MESSAGE_REPLY" ? "Resposta enviada" : "Mensagem enviada" : msg.proposal.state === "CANCELLED" ? "Proposta cancelada" : "Prévia expirada ou indisponível"}</Text>
            )}
          </View>
        )}
        {msg.proposal?.actionType === "MURAL_REACT" && (
          <View style={[styles.proposalBox, { borderColor: colors.border, backgroundColor: colors.background }]}>
            <Text style={[styles.proposalTitle, { color: colors.foreground }]}>Reação no Mural</Text>
            <Text style={[styles.proposalMeta, { color: colors.mutedForeground }]}>Publicação: {msg.proposal.title}</Text>
            <Text style={[styles.proposalMeta, { color: colors.foreground }]}>Reação: {msg.proposal.reaction} (coração){msg.proposal.previousReaction ? ` · substitui ${msg.proposal.previousReaction}` : ""}</Text>
            <Text style={[styles.proposalMeta, { color: colors.mutedForeground }]}>Expira {new Date(msg.proposal.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Text>
            {msg.proposal.state === "PENDING" && Date.parse(msg.proposal.expiresAt) > Date.now() ? (
              <View style={styles.proposalActions}>
                <Pressable disabled={proposalBusy} onPress={() => onResolveProposal(msg.proposal!, "confirm")} style={[styles.proposalButton, { backgroundColor: "#246a55", opacity: proposalBusy ? 0.6 : 1 }]}>
                  <Feather name="heart" size={14} color="#fff" />
                  <Text style={styles.proposalButtonText}>Reagir</Text>
                </Pressable>
                <Pressable disabled={proposalBusy} onPress={() => onResolveProposal(msg.proposal!, "cancel")} style={[styles.proposalButton, { borderColor: colors.border, opacity: proposalBusy ? 0.6 : 1 }]}>
                  <Feather name="x" size={14} color={colors.foreground} />
                  <Text style={[styles.proposalButtonText, { color: colors.foreground }]}>Cancelar</Text>
                </Pressable>
              </View>
            ) : (
              <Text style={[styles.proposalMeta, { color: colors.mutedForeground }]}>{msg.proposal.state === "CONFIRMED" ? "Reação registrada" : msg.proposal.state === "CANCELLED" ? "Proposta cancelada" : "Prévia expirada ou indisponível"}</Text>
            )}
          </View>
        )}
        {msg.proposal?.actionType === "MURAL_COMMENT_CREATE" && (
          <View style={[styles.proposalBox, { borderColor: colors.border, backgroundColor: colors.background }]}>
            <Text style={[styles.proposalTitle, { color: colors.foreground }]}>Comentário no Mural</Text>
            <Text style={[styles.proposalMeta, { color: colors.mutedForeground }]}>Publicação: {msg.proposal.title}</Text>
            <Text style={[styles.proposalMeta, { color: colors.foreground }]}>Comentário: {msg.proposal.content}</Text>
            <Text style={[styles.proposalMeta, { color: colors.mutedForeground }]}>Expira {new Date(msg.proposal.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Text>
            {msg.proposal.state === "PENDING" && Date.parse(msg.proposal.expiresAt) > Date.now() ? (
              <View style={styles.proposalActions}>
                <Pressable disabled={proposalBusy} onPress={() => onResolveProposal(msg.proposal!, "confirm")} style={[styles.proposalButton, { backgroundColor: "#246a55", opacity: proposalBusy ? 0.6 : 1 }]}>
                  <Feather name="message-circle" size={14} color="#fff" />
                  <Text style={styles.proposalButtonText}>Publicar comentário</Text>
                </Pressable>
                <Pressable disabled={proposalBusy} onPress={() => onResolveProposal(msg.proposal!, "cancel")} style={[styles.proposalButton, { borderColor: colors.border, opacity: proposalBusy ? 0.6 : 1 }]}>
                  <Feather name="x" size={14} color={colors.foreground} />
                  <Text style={[styles.proposalButtonText, { color: colors.foreground }]}>Cancelar</Text>
                </Pressable>
              </View>
            ) : (
              <Text style={[styles.proposalMeta, { color: colors.mutedForeground }]}>{msg.proposal.state === "CONFIRMED" ? "Comentário publicado" : msg.proposal.state === "CANCELLED" ? "Proposta cancelada" : "Prévia expirada ou indisponível"}</Text>
            )}
          </View>
        )}
        {msg.proposal && msg.proposal.actionType !== "MESSAGE_DIRECT_CREATE" && msg.proposal.actionType !== "MESSAGE_REPLY" && msg.proposal.actionType !== "MURAL_REACT" && msg.proposal.actionType !== "MURAL_COMMENT_CREATE" && (
          <View style={[styles.proposalBox, { borderColor: colors.border, backgroundColor: colors.background }]}>
            {msg.proposal.actionType === "TASK_COMMENT_CREATE" ? <Text style={[styles.proposalTitle, { color: colors.foreground }]}>Comentar tarefa · {msg.proposal.operationName}</Text> : null}
            <Text style={[styles.proposalTitle, { color: colors.foreground }]}>{msg.proposal.actionType === "TASK_CHECKLIST_UPDATE" ? `Atualizar checklist · ${msg.proposal.title}` : msg.proposal.actionType === "TASK_EVIDENCE_LINK_ADD" ? `Anexar link complementar · ${msg.proposal.operationName}` : msg.proposal.actionType === "ASA_PREFERENCE_UPDATE" ? "Preferências pessoais da ASA" : msg.proposal.actionType === "MURAL_ACK" ? "Confirmação do Mural" : msg.proposal.actionType === "NOTICE_DRAFT_UPDATE" ? `Editar rascunho · ${msg.proposal.operationName}` : msg.proposal.actionType === "AGENDA_DRAFT_RENAME" ? `Renomear reunião · ${msg.proposal.operationName}` : msg.proposal.actionType === "AGENDA_DRAFT_SCHEDULE_UPDATE" ? `Alterar data e horário · ${msg.proposal.operationName}` : msg.proposal.actionType === "AGENDA_DRAFT_NOTES_UPDATE" ? `Alterar observações · ${msg.proposal.operationName}` : msg.proposal.actionType === "AGENDA_MEETING_CREATE" ? `Reunião · ${msg.proposal.operationName}` : msg.proposal.actionType === "TASK_CREATE" ? `Tarefa · ${msg.proposal.title}` : msg.proposal.actionType === "TASK_START" ? `Iniciar tarefa · ${msg.proposal.title}` : msg.proposal.actionType === "TASK_READY_FOR_APPROVAL" ? `Enviar para aprovação · ${msg.proposal.title}` : msg.proposal.actionType === "TASK_COMPLETE" ? `Concluir tarefa · ${msg.proposal.title}` : msg.proposal.actionType === "TASK_UPDATE_DUE_DATE" ? `Alterar prazo · ${msg.proposal.title}` : msg.proposal.actionType === "TASK_UPDATE_ASSIGNEE" ? `Alterar responsável · ${msg.proposal.title}` : msg.proposal.actionType === "TASK_UPDATE_PRIORITY" ? `Alterar prioridade · ${msg.proposal.title}` : msg.proposal.actionType === "TASK_UPDATE_DESCRIPTION" ? `Alterar descrição · ${msg.proposal.title}` : msg.proposal.actionType === "TASK_UPDATE_TITLE" ? `Alterar título · ${msg.proposal.title}` : msg.proposal.actionType === "TASK_UPDATE_REQUIREMENTS" ? `Alterar requisitos · ${msg.proposal.title}` : msg.proposal.actionType === "TASK_UPDATE_RESPONSIBILITY" ? `Alterar responsabilidade · ${msg.proposal.title}` : msg.proposal.title}</Text>
            <Text style={[styles.proposalMeta, { color: colors.mutedForeground }]}>{msg.proposal.actionType === "TASK_COMMENT_CREATE"
              ? `${msg.proposal.title}\nComentário:\n${msg.proposal.content}\nSó será publicado após confirmar.`
              : msg.proposal.actionType === "TASK_CHECKLIST_UPDATE"
              ? `Checklist ${msg.proposal.checklistKind === "mandatory" ? "obrigatória" : "operacional"} · ${msg.proposal.checklistItemLabel}\n${msg.proposal.previousChecklistCompleted ? "Concluído" : "Pendente"} → ${msg.proposal.checklistCompleted ? "Concluído" : "Pendente"}\nSó a pessoa responsável pode atualizar este item.`
              : msg.proposal.actionType === "TASK_EVIDENCE_LINK_ADD"
              ? `${msg.proposal.title}\nLink complementar: ${msg.proposal.evidenceDescription}\n${msg.proposal.evidenceUrl}\nNão contará como evidência obrigatória; só será anexado após confirmar.`
              : msg.proposal.actionType === "TASK_CANCEL"
              ? `${msg.proposal.title} · ${msg.proposal.assigneeName ?? "Responsável"} · Estado atual: ${msg.proposal.previousStatus}. A tarefa só será cancelada após a confirmação.`
              : msg.proposal.actionType === "ASA_PREFERENCE_UPDATE"
              ? msg.proposal.changes?.map((change) => `${change.label}: ${change.before} → ${change.after}`).join("\n") ?? `Sugestões: ${msg.proposal.previousMode === "SILENT" ? "Pausadas" : msg.proposal.previousMode === "PROACTIVE" ? "Proativas" : "Equilibradas"} → ${msg.proposal.mode === "SILENT" ? "Pausadas" : msg.proposal.mode === "PROACTIVE" ? "Proativas" : "Equilibradas"}`
              : msg.proposal.actionType === "MURAL_ACK"
              ? `Aviso: ${msg.proposal.title}`
              : msg.proposal.actionType === "NOTICE_DRAFT_UPDATE"
              ? `Título: ${msg.proposal.previousTitle} → ${msg.proposal.newTitle}\n\nTexto atual:\n${msg.proposal.previousContent}\n\nNovo texto:\n${msg.proposal.content}\n\nPermanece como rascunho; não será publicado.`
              : msg.proposal.actionType === "AGENDA_DRAFT_RENAME"
              ? `${msg.proposal.previousTitle} → ${msg.proposal.newTitle}\n${msg.proposal.date ? new Date(`${msg.proposal.date}T12:00:00`).toLocaleDateString("pt-BR") : "data"} · ${msg.proposal.startTime}–${msg.proposal.endTime}\nSomente o título muda; o evento continua como rascunho.`
              : msg.proposal.actionType === "AGENDA_DRAFT_SCHEDULE_UPDATE"
              ? `${msg.proposal.title}\nData: ${msg.proposal.previousDate ? new Date(`${msg.proposal.previousDate}T12:00:00`).toLocaleDateString("pt-BR") : "data não definida"} → ${msg.proposal.date ? new Date(`${msg.proposal.date}T12:00:00`).toLocaleDateString("pt-BR") : "data"}\nHorário: ${msg.proposal.previousStartTime ?? "—"}–${msg.proposal.previousEndTime ?? "—"} → ${msg.proposal.startTime}–${msg.proposal.endTime}\nContinua como rascunho; não será confirmado nem publicado.`
              : msg.proposal.actionType === "AGENDA_DRAFT_NOTES_UPDATE"
              ? `${msg.proposal.title}\nObservações atuais: ${msg.proposal.previousNotes || "nenhuma"}\nNovas observações: ${msg.proposal.notes ?? "nenhuma (serão removidas)"}\nSomente as observações mudam; continua como rascunho.`
              : msg.proposal.actionType === "AGENDA_MEETING_CREATE"
              ? `${msg.proposal.title} · ${msg.proposal.date ? new Date(`${msg.proposal.date}T12:00:00`).toLocaleDateString("pt-BR") : "data"} · ${msg.proposal.startTime}–${msg.proposal.endTime} · ${msg.proposal.expectedStatus === "PROPOSED" ? "Proposta para análise" : "Rascunho não publicado"}`
              : msg.proposal.actionType === "TASK_CREATE"
              ? `${msg.proposal.operationName} · ${msg.proposal.assigneeName} · prazo ${msg.proposal.dueDate ? new Date(`${msg.proposal.dueDate}T12:00:00`).toLocaleDateString("pt-BR") : "não informado"} · prioridade ${taskPriorityLabel(msg.proposal.priority)}${msg.proposal.checklistLabels?.length ? ` · checklist: ${msg.proposal.checklistLabels.join("; ")}` : ""}${msg.proposal.mandatoryEvidences?.length ? ` · evidências: ${msg.proposal.mandatoryEvidences.map((item) => `${item.type}: ${item.description}`).join("; ")}` : ""}`
              : msg.proposal.actionType === "TASK_UPDATE_DUE_DATE"
              ? `${msg.proposal.operationName} · ${msg.proposal.previousDueDate ? new Date(`${msg.proposal.previousDueDate}T12:00:00`).toLocaleDateString("pt-BR") : "prazo atual indisponível"} → ${msg.proposal.dueDate ? new Date(`${msg.proposal.dueDate}T12:00:00`).toLocaleDateString("pt-BR") : "novo prazo indisponível"}`
              : msg.proposal.actionType === "TASK_UPDATE_ASSIGNEE"
              ? `${msg.proposal.operationName} · ${msg.proposal.previousAssigneeName ?? "responsável atual"} → ${msg.proposal.assigneeName ?? "novo responsável"}`
              : msg.proposal.actionType === "TASK_UPDATE_PRIORITY"
              ? `${msg.proposal.operationName} · ${msg.proposal.title} · ${taskPriorityLabel(msg.proposal.previousPriority)} → ${taskPriorityLabel(msg.proposal.priority)}`
              : msg.proposal.actionType === "TASK_UPDATE_DESCRIPTION"
              ? `${msg.proposal.operationName} · ${(msg.proposal.previousDescription || "sem descrição").slice(0, 120)} → ${(msg.proposal.description || "").slice(0, 120)}`
              : msg.proposal.actionType === "TASK_UPDATE_TITLE"
              ? `${msg.proposal.previousTitle ?? msg.proposal.title} → ${msg.proposal.newTitle}`
              : msg.proposal.actionType === "TASK_UPDATE_REQUIREMENTS"
              ? `${msg.proposal.operationName} · checklist: ${msg.proposal.checklistLabels?.join("; ") || "nenhuma"} · evidências: ${msg.proposal.mandatoryEvidences?.map((item) => `${item.type}: ${item.description}`).join("; ") || "nenhuma"}`
              : msg.proposal.actionType === "TASK_UPDATE_RESPONSIBILITY"
              ? `${msg.proposal.operationName} · ${msg.proposal.previousResponsibilityTitle ?? "sem responsabilidade"} → ${msg.proposal.newResponsibilityTitle ?? "sem responsabilidade"}`
              : msg.proposal.actionType === "TASK_START"
              ? `${msg.proposal.assigneeName ?? "Responsável"} · ${msg.proposal.previousStatus === "CHANGES_REQUESTED" ? "Ajustes solicitados" : "Pendente"} → Em andamento`
              : msg.proposal.actionType === "TASK_READY_FOR_APPROVAL"
              ? `${msg.proposal.title} · Em andamento → Aguardando aprovação`
              : msg.proposal.actionType === "TASK_COMPLETE"
              ? `${msg.proposal.title} · Em andamento → Concluída`
              : `${msg.proposal.operationName} · ${msg.proposal.recipientCount ?? 0} destinatário(s)`}</Text>
            {msg.proposal.actionType === "TASK_CREATE" && msg.proposal.responsibilityTitle ? <Text style={[styles.proposalMeta, { color: colors.mutedForeground }]}>Responsabilidade: {msg.proposal.responsibilityTitle}</Text> : null}
            {msg.proposal.actionType === "TASK_UPDATE_RESPONSIBILITY" ? <Text style={[styles.proposalMeta, { color: colors.mutedForeground }]}>Vínculo: {msg.proposal.previousResponsibilityTitle ?? "nenhuma"} → {msg.proposal.newResponsibilityTitle ?? "nenhuma"}</Text> : null}
            {msg.proposal.state === "PENDING" && Date.parse(msg.proposal.expiresAt) > Date.now() ? (
              <View style={styles.proposalActions}>
                <Pressable disabled={proposalBusy} onPress={() => onResolveProposal(msg.proposal!, "confirm")} style={[styles.proposalButton, { backgroundColor: "#246a55", opacity: proposalBusy ? 0.6 : 1 }]}>
                  <Feather name="check" size={14} color="#fff" />
                  <Text style={styles.proposalButtonText}>{proposalConfirmLabel(msg.proposal.actionType)}</Text>
                </Pressable>
                <Pressable disabled={proposalBusy} onPress={() => onResolveProposal(msg.proposal!, "cancel")} style={[styles.proposalButton, { borderColor: colors.border, opacity: proposalBusy ? 0.6 : 1 }]}>
                  <Feather name="x" size={14} color={colors.foreground} />
                  <Text style={[styles.proposalButtonText, { color: colors.foreground }]}>Cancelar</Text>
                </Pressable>
              </View>
            ) : (
              <Text style={[styles.proposalMeta, { color: colors.mutedForeground }]}>{proposalStateLabel(msg.proposal.actionType, msg.proposal.state, msg.proposal.expectedStatus)}</Text>
            )}
          </View>
        )}
        {msg.undo && (
          <View style={[styles.undoBox, { borderColor: colors.border, backgroundColor: colors.background }]}>
            {msg.undoState === "UNDONE" ? (
              <Text style={[styles.proposalMeta, { color: colors.mutedForeground }]}>Remoção desfeita</Text>
            ) : Date.parse(msg.undo.expiresAt) > undoNow ? (
              <Pressable accessibilityLabel="Desfazer remoção de integrante" accessibilityRole="button" disabled={undoBusy} onPress={() => onUndo(msg.undo!)} style={[styles.undoButton, { borderColor: colors.border, opacity: undoBusy ? 0.6 : 1 }]}>
                <Feather name="rotate-ccw" size={14} color={colors.foreground} />
                <Text style={[styles.undoButtonText, { color: colors.foreground }]}>{undoBusy ? "Desfazendo…" : `Desfazer · ${Math.ceil((Date.parse(msg.undo.expiresAt) - undoNow) / 1000)} s`}</Text>
              </Pressable>
            ) : (
              <Text style={[styles.proposalMeta, { color: colors.mutedForeground }]}>Janela para desfazer encerrada</Text>
            )}
            {msg.undoError && <Text accessibilityRole="alert" style={[styles.proposalMeta, { color: colors.destructive }]}>{msg.undoError}</Text>}
          </View>
        )}
      </View>
      {isUser && (
        <View style={[styles.avatar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="user" size={14} color={colors.primary} />
        </View>
      )}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AsaScreen() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  const pageContext = ASA_PAGE_CONTEXT[String(from ?? "")] ?? undefined;
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const { roles, user } = useAuth();
  const currentUserIdRef = useRef<string | null>(null);
  currentUserIdRef.current = user?.id ?? null;
  const isManager = roles.some((r) =>
    ["ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"].includes(r.role)
  );
  const suggestions = pageContext === "/folgas" && isManager
    ? ["O que tenho aqui?", "Quem está de folga hoje?"]
    : PAGE_SUGGESTIONS[pageContext ?? ""] ?? (isManager ? SUGGESTIONS_MANAGER : SUGGESTIONS_MEMBER);

  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [activeToolResult, setActiveToolResult] = useState<ClimaResult | null>(null);
  const [hasError, setHasError] = useState(false);
  const [finishedPose, setFinishedPose] = useState<AsaPose>("feliz");
  const [operations, setOperations] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedOperationId, setSelectedOperationId] = useState("");
  const [showOperationPicker, setShowOperationPicker] = useState(false);
  const [proposalBusyId, setProposalBusyId] = useState<string | null>(null);
  const [undoBusyId, setUndoBusyId] = useState<string | null>(null);
  const [undoNow, setUndoNow] = useState(Date.now());
  const [asaMode, setAsaMode] = useState<AsaSuggestionMode>("BALANCED");
  const [suggestionFrequency, setSuggestionFrequency] = useState<AsaSuggestionFrequency>("DAILY");
  const [proactivityLevel, setProactivityLevel] = useState<AsaProactivityLevel>("MEDIUM");
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [preferenceBusy, setPreferenceBusy] = useState(false);
  const [visibleSuggestions, setVisibleSuggestions] = useState<AsaSuggestionChip[]>([]);

  const chatPose: AsaPose = hasError
    ? "duvida"
    : streaming
    ? toolResultToPose(activeTool, activeToolResult)
    : messages.length > 0
    ? finishedPose
    : "feliz";

  const chatBubbleText = streaming && activeTool
    ? (TOOL_LABELS[activeTool] ?? "Processando…")
    : "";

  const scrollToBottom = useCallback(() => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setConversationId(null);
      setMessages([]);
      setOperations([]);
      setSelectedOperationId("");
      setInput("");
      setStreaming(false);
      setError(null);
      setPreferencesLoaded(false);
      setPreferencesOpen(false);
      setVisibleSuggestions([]);
      return;
    }
    setPreferencesLoaded(false);
    setPreferencesOpen(false);
    setVisibleSuggestions([]);
    setConversationId(null);
    setMessages([]);
    setStreaming(false);
    setError(null);
    void createConversation(user.id);
    void loadOperationContext(user.id);
    void loadAsaPreferences(user.id);
  }, [user?.id]);
  useEffect(() => { scrollToBottom(); }, [messages]);

  useEffect(() => {
    const nextExpiry = messages
      .filter(message => message.undo && !message.undoState)
      .map(message => Date.parse(message.undo!.expiresAt))
      .filter(expiresAt => expiresAt > undoNow)
      .sort((a, b) => a - b)[0];
    if (!nextExpiry) return;
    const timer = setTimeout(() => setUndoNow(Date.now()), Math.max(0, nextExpiry - Date.now() + 25));
    return () => clearTimeout(timer);
  }, [messages, undoNow]);

  useEffect(() => {
    let active = true;
    if (!user?.id || !preferencesLoaded || !conversationId || messages.length > 0) {
      setVisibleSuggestions([]);
      return () => { active = false; };
    }
    void (async () => {
      const key = `myasa_asa_suggestions_shown_${user.id}`;
      const previous = Number(await AsyncStorage.getItem(key));
      const lastShownAt = Number.isFinite(previous) && previous > 0 ? previous : null;
      const now = Date.now();
      const eligible = selectAsaSuggestions(suggestions, asaMode, suggestionFrequency, proactivityLevel, lastShownAt, now);
      if (!eligible.length) {
        if (active && currentUserIdRef.current === user.id) setVisibleSuggestions([]);
        return;
      }

      let proactive: AsaSuggestionChip[] = [];
      if (asaMode === "PROACTIVE") {
        try {
          const [accessToken, baseUrl] = await Promise.all([
            AsyncStorage.getItem("myasa_access_token"),
            getBaseUrl(),
          ]);
          const response = await fetch(`${baseUrl}/api/asa/proactive-suggestions`, {
            headers: { Authorization: `Bearer ${accessToken ?? ""}` },
          });
          if (response.ok) {
            const counts = await response.json() as { overdueCount?: number; dueTodayCount?: number; dueSoonCount?: number };
            if (counts.overdueCount && counts.overdueCount > 0) {
              const taskLabel = counts.overdueCount === 1 ? "tarefa vencida" : "tarefas vencidas";
              proactive.push({ label: `Você tem ${counts.overdueCount} ${taskLabel}. Ver?`, prompt: "Mostra minhas tarefas vencidas" });
            }
            if (counts.dueTodayCount && counts.dueTodayCount > 0) {
              const taskLabel = counts.dueTodayCount === 1 ? "tarefa com prazo hoje" : "tarefas com prazo hoje";
              proactive.push({ label: `Você tem ${counts.dueTodayCount} ${taskLabel}. Ver?`, prompt: "Quais são minhas tarefas para hoje?" });
            }
            if (counts.dueSoonCount && counts.dueSoonCount > 0) {
              const taskLabel = counts.dueSoonCount === 1 ? "tarefa com prazo nos próximos 3 dias" : "tarefas com prazo nos próximos 3 dias";
              proactive.push({ label: `Você tem ${counts.dueSoonCount} ${taskLabel}. Ver?`, prompt: "Quais tarefas tenho com prazo nos próximos 3 dias?" });
            }
          }
        } catch {
          // Keep the ordinary suggestions available when the summary is offline.
        }
      }
      if (!active || currentUserIdRef.current !== user.id) return;
      const allSuggestions = [
        ...proactive,
        ...suggestions.map((suggestion) => ({ label: suggestion, prompt: suggestion })),
      ];
      const selected = selectAsaSuggestions(allSuggestions, asaMode, suggestionFrequency, proactivityLevel, lastShownAt, now);
      setVisibleSuggestions(selected);
      if (selected.length > 0) await AsyncStorage.setItem(key, String(now));
    })();
    return () => { active = false; };
  }, [asaMode, conversationId, messages.length, preferencesLoaded, proactivityLevel, suggestionFrequency, suggestions, user?.id]);

  async function loadOperationContext(userId: string) {
    try {
      const [token, baseUrl] = await Promise.all([
        AsyncStorage.getItem("myasa_access_token"),
        getBaseUrl(),
      ]);
      const response = await fetch(`${baseUrl}/api/asa/context`, {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (!response.ok) return;
      const data = await response.json() as { operations: Array<{ id: string; name: string }> };
      if (currentUserIdRef.current !== userId) return;
      const available = Array.isArray(data.operations) ? data.operations : [];
      setOperations(available);
      const saved = await AsyncStorage.getItem(`myasa_asa_operation_${userId}`);
      if (currentUserIdRef.current !== userId) return;
      const selected = available.some((operation) => operation.id === saved)
        ? saved!
        : available.length === 1 ? available[0]!.id : "";
      setSelectedOperationId(selected);
      if (selected) await AsyncStorage.setItem(`myasa_asa_operation_${userId}`, selected);
      else await AsyncStorage.removeItem(`myasa_asa_operation_${userId}`);
    } catch {
      if (currentUserIdRef.current === userId) setError("Não consegui carregar suas operações agora.");
    }
  }

  async function loadAsaPreferences(userId: string) {
    try {
      const [accessToken, baseUrl] = await Promise.all([
        AsyncStorage.getItem("myasa_access_token"),
        getBaseUrl(),
      ]);
      const response = await fetch(`${baseUrl}/api/asa/preferences`, {
        headers: { Authorization: `Bearer ${accessToken ?? ""}` },
      });
      if (!response.ok) return;
      const preferences = await response.json() as { mode?: AsaSuggestionMode; messageFrequency?: AsaSuggestionFrequency; proactivityLevel?: AsaProactivityLevel };
      if (currentUserIdRef.current !== userId) return;
      setAsaMode(preferences.mode ?? "BALANCED");
      setSuggestionFrequency(preferences.messageFrequency ?? "DAILY");
      setProactivityLevel(preferences.proactivityLevel ?? "MEDIUM");
    } catch {
      if (currentUserIdRef.current === userId) setError("Não consegui carregar as preferências da ASA.");
    } finally {
      if (currentUserIdRef.current === userId) setPreferencesLoaded(true);
    }
  }

  async function updateAsaPreferences(patch: { mode?: AsaSuggestionMode; messageFrequency?: AsaSuggestionFrequency; proactivityLevel?: AsaProactivityLevel }) {
    if (!user?.id || preferenceBusy) return;
    setPreferenceBusy(true);
    try {
      const [accessToken, baseUrl] = await Promise.all([
        AsyncStorage.getItem("myasa_access_token"),
        getBaseUrl(),
      ]);
      const response = await fetch(`${baseUrl}/api/asa/preferences`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken ?? ""}`, "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!response.ok) throw new Error("Não consegui salvar as preferências da ASA.");
      const saved = await response.json() as { mode?: AsaSuggestionMode; messageFrequency?: AsaSuggestionFrequency; proactivityLevel?: AsaProactivityLevel };
      if (currentUserIdRef.current !== user.id) return;
      if (saved.mode) setAsaMode(saved.mode);
      if (saved.messageFrequency) setSuggestionFrequency(saved.messageFrequency);
      if (saved.proactivityLevel) setProactivityLevel(saved.proactivityLevel);
    } catch {
      if (currentUserIdRef.current === user.id) setError("Não consegui salvar as preferências da ASA.");
    } finally {
      setPreferenceBusy(false);
    }
  }

  async function createConversation(userId: string, forceNew = false) {
    setHasError(false);
    try {
      const [token, baseUrl] = await Promise.all([
        AsyncStorage.getItem("myasa_access_token"),
        getBaseUrl(),
      ]);
      const storageKey = `myasa_asa_conversation_${userId}`;
      if (forceNew) await AsyncStorage.removeItem(storageKey);
      const savedId = Number(await AsyncStorage.getItem(storageKey));
      if (!forceNew && Number.isInteger(savedId) && savedId > 0) {
        const historyResponse = await fetch(`${baseUrl}/api/asa/conversations/${savedId}/messages`, {
          headers: { Authorization: `Bearer ${token ?? ""}` },
        });
        if (historyResponse.ok) {
          const history = await historyResponse.json() as { messages: Array<{ id: number; role: string; content: string; proposal?: AsaProposal }> };
          if (currentUserIdRef.current !== userId) return;
          setConversationId(savedId);
          setMessages((history.messages ?? []).filter((message) => message.role === "user" || message.role === "assistant")
            .map((message) => ({ id: String(message.id), role: message.role as "user" | "assistant", content: message.content, tools: [], proposal: message.proposal })));
          setError(null);
          return;
        }
        await AsyncStorage.removeItem(storageKey);
      }
      const res = await fetch(`${baseUrl}/api/asa/conversations`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token ?? ""}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: `Conversa ASA ${new Date().toLocaleString("pt-BR")}` }),
      });
      if (!res.ok) throw new Error("Falha ao criar conversa");
      const data = await res.json();
      if (currentUserIdRef.current !== userId) return;
      setConversationId(data.id);
      await AsyncStorage.setItem(storageKey, String(data.id));
      if (currentUserIdRef.current !== userId) return;
      setMessages([]);
      setError(null);
    } catch {
      if (currentUserIdRef.current === userId) setError("Não foi possível iniciar a conversa. Tente novamente.");
    }
  }

  async function sendMessage(text?: string) {
    const content = (text ?? input).trim();
    const senderId = user?.id;
    if (!content || streaming || !conversationId || !senderId) return;
    const isCurrentSession = () => currentUserIdRef.current === senderId;

    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", content };
    const asstId = `a-${Date.now()}`;
    const asstMsg: Message = { id: asstId, role: "assistant", content: "", tools: [], streaming: true };

    setMessages(prev => isCurrentSession() ? [...prev, userMsg, asstMsg] : prev);
    setInput("");
    setStreaming(true);
    setActiveTool(null);
    setActiveToolResult(null);
    setHasError(false);
    setError(null);

    let climaResult: ClimaResult | null = null;

    try {
      const [token, baseUrl] = await Promise.all([
        AsyncStorage.getItem("myasa_access_token"),
        getBaseUrl(),
      ]);

      const res = await fetch(`${baseUrl}/api/asa/chat/${conversationId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token ?? ""}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content, context: { page: pageContext, operationId: selectedOperationId || undefined } }),
      });

      if (!res.ok) throw new Error(`Erro ${res.status}`);
      if (!isCurrentSession()) return;

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const json = JSON.parse(line.slice(6));
            if (!isCurrentSession()) continue;
            if (json.undo) {
              setMessages(prev => !isCurrentSession() ? prev : prev.map(m => m.id === asstId ? { ...m, undo: json.undo, undoState: undefined, undoError: undefined } : m));
            } else if (json.proposal) {
              setMessages(prev => !isCurrentSession() ? prev : prev.map(m => m.id === asstId ? { ...m, proposal: json.proposal } : m));
            } else if (json.content) {
              setMessages(prev => !isCurrentSession() ? prev : prev.map(m =>
                m.id === asstId ? { ...m, content: m.content + json.content } : m
              ));
            } else if (json.tool) {
              setActiveTool(json.tool);
              setActiveToolResult(null);
              setMessages(prev => !isCurrentSession() ? prev : prev.map(m =>
                m.id === asstId ? { ...m, tools: [...(m.tools ?? []), json.tool] } : m
              ));
            } else if (json.toolResult) {
              if (json.toolResult.name === "consultar_clima") {
                climaResult = { weatherCode: json.toolResult.weatherCode, temp: json.toolResult.temp };
                setActiveToolResult(climaResult);
              }
            } else if (json.done) {
              setActiveTool(null);
              setMessages(prev => !isCurrentSession() ? prev : prev.map(m =>
                m.id === asstId ? { ...m, streaming: false } : m
              ));
            } else if (json.error) {
              setHasError(true);
              setActiveTool(null);
              setMessages(prev => !isCurrentSession() ? prev : prev.map(m =>
                m.id === asstId ? { ...m, streaming: false } : m
              ));
            }
          } catch {}
        }
      }

      setMessages(prev => {
        if (!isCurrentSession()) return prev;
        const updated = prev.map(m =>
          m.id === asstId ? { ...m, streaming: false } : m
        );
        const asstFinal = updated.find(m => m.id === asstId);
        if (asstFinal) {
          const tools   = asstFinal.tools ?? [];
          const content = asstFinal.content;
          setFinishedPose(deriveFinishedPose(tools, content, climaResult));
        }
        return updated;
      });
      setActiveTool(null);
    } catch (err) {
      if (isCurrentSession()) {
        setError(`Erro: ${String(err)}`);
        setHasError(true);
        setActiveTool(null);
        setMessages(prev => isCurrentSession() ? prev.filter(m => m.id !== asstId) : prev);
      }
    } finally {
      if (isCurrentSession()) setStreaming(false);
    }
  }

  async function resolveProposal(proposal: AsaProposal, action: "confirm" | "cancel") {
    if (proposalBusyId) return;
    setProposalBusyId(proposal.id);
    try {
      const [token, baseUrl] = await Promise.all([AsyncStorage.getItem("myasa_access_token"), getBaseUrl()]);
      const response = await fetch(`${baseUrl}/api/asa/actions/${proposal.id}/${action}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      const result = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Não consegui atualizar a proposta.");
      setMessages((current) => current.map((message) => message.proposal?.id === proposal.id
        ? { ...message, proposal: { ...message.proposal, state: action === "confirm" ? "CONFIRMED" : "CANCELLED" }, content: `${message.content}\n\n${result.message ?? "Concluído."}` }
        : message));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não consegui atualizar a proposta.");
    } finally {
      setProposalBusyId(null);
    }
  }

  async function undoAsaAction(undo: AsaUndo) {
    if (undoBusyId) return;
    setUndoBusyId(undo.id);
    try {
      const [token, baseUrl] = await Promise.all([AsyncStorage.getItem("myasa_access_token"), getBaseUrl()]);
      const response = await fetch(`${baseUrl}/api/actions/${undo.id}/undo`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Não consegui desfazer essa alteração.");
      setMessages(current => current.map(message => message.undo?.id === undo.id
        ? { ...message, undoState: "UNDONE", undoError: undefined }
        : message));
      setError(null);
    } catch (cause) {
      const undoError = cause instanceof Error ? cause.message : "Não consegui desfazer essa alteração.";
      setMessages(current => current.map(message => message.undo?.id === undo.id ? { ...message, undoError } : message));
    } finally {
      setUndoBusyId(null);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      {/* ── Header ── */}
      <View style={[styles.header, {
        paddingTop: insets.top + 8,
        backgroundColor: colors.card,
        borderBottomColor: colors.border,
      }]}>
        <View style={styles.headerLeft}>
          <BackButton />
          <AsaAvatar size="small" pose={chatPose} />
          <View>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>ASA</Text>
            <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
              {streaming && activeTool
                ? (TOOL_LABELS[activeTool] ?? "Processando…")
                : streaming
                ? "Pensando…"
                : "Assistente Operacional"}
            </Text>
          </View>
        {!!chatBubbleText && (
            <AsaSpeechBubble
              text={chatBubbleText}
              visible={!!chatBubbleText}
              duration={600000}
              style={{ marginLeft: 4, flexShrink: 1 }}
            />
          )}
        </View>
        {operations.length > 1 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Selecionar operação da ASA"
            onPress={() => setShowOperationPicker(true)}
            style={[styles.operationButton, { backgroundColor: colors.background, borderColor: colors.border }]}
          >
            <Feather name="layers" size={14} color={colors.primary} />
            <Text numberOfLines={1} style={[styles.operationButtonText, { color: colors.foreground }]}>
              {operations.find((operation) => operation.id === selectedOperationId)?.name ?? "Operação"}
            </Text>
            <Feather name="chevron-down" size={14} color={colors.mutedForeground} />
          </Pressable>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Perguntar o que a ASA pode fazer"
          accessibilityHint="Mostra as consultas e ações disponíveis para seu perfil."
          disabled={streaming || !conversationId}
          onPress={() => void sendMessage("O que você consegue fazer?")}
          style={[styles.settingsButton, { borderColor: colors.border, opacity: streaming || !conversationId ? 0.55 : 1 }]}
        >
          <Feather name="help-circle" size={17} color={colors.foreground} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Preferências da ASA"
          accessibilityState={{ expanded: preferencesOpen }}
          onPress={() => setPreferencesOpen((value) => !value)}
          style={[styles.settingsButton, { borderColor: colors.border }]}
        >
          <Feather name="sliders" size={16} color={colors.foreground} />
        </Pressable>
        <Pressable
          onPress={() => user?.id && void createConversation(user.id, true)}
          style={({ pressed }) => [styles.newBtn, { borderColor: colors.border, opacity: pressed ? 0.6 : 1 }]}
        >
          <Feather name="plus" size={14} color={colors.primary} />
          <Text style={[styles.newBtnText, { color: colors.primary }]}>Nova</Text>
        </Pressable>
      </View>

      {preferencesOpen && user?.id && (
        <View style={[styles.preferencePanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.preferenceGroup}>
            <Text style={[styles.preferenceLabel, { color: colors.mutedForeground }]}>Sugestões</Text>
            <View style={[styles.preferenceSegments, { borderColor: colors.border }]}>
              {([{ value: "SILENT", label: "Pausadas" }, { value: "BALANCED", label: "Pontuais" }, { value: "PROACTIVE", label: "Proativas" }] as const).map((option) => (
                <Pressable key={option.value} accessibilityRole="button" accessibilityState={{ selected: asaMode === option.value }} disabled={preferenceBusy || !preferencesLoaded}
                  onPress={() => void updateAsaPreferences({ mode: option.value })}
                  style={[styles.preferenceSegment, { backgroundColor: asaMode === option.value ? colors.primary : "transparent", opacity: preferenceBusy ? 0.6 : 1 }]}>
                  <Text style={[styles.preferenceSegmentText, { color: asaMode === option.value ? "#fff" : colors.foreground }]}>{option.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={styles.preferenceGroup}>
            <Text style={[styles.preferenceLabel, { color: colors.mutedForeground }]}>Frequência</Text>
            <View style={[styles.preferenceSegments, { borderColor: colors.border }]}>
              {([{ value: "REALTIME", label: "Sempre" }, { value: "DAILY", label: "Diária" }, { value: "WEEKLY", label: "Semanal" }] as const).map((option) => (
                <Pressable key={option.value} accessibilityRole="button" accessibilityState={{ selected: suggestionFrequency === option.value }} disabled={preferenceBusy || !preferencesLoaded}
                  onPress={() => void updateAsaPreferences({ messageFrequency: option.value })}
                  style={[styles.preferenceSegment, { backgroundColor: suggestionFrequency === option.value ? colors.primary : "transparent", opacity: preferenceBusy ? 0.6 : 1 }]}>
                  <Text style={[styles.preferenceSegmentText, { color: suggestionFrequency === option.value ? "#fff" : colors.foreground }]}>{option.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={styles.preferenceGroup}>
            <Text style={[styles.preferenceLabel, { color: colors.mutedForeground }]}>Nível</Text>
            <View style={[styles.preferenceSegments, { borderColor: colors.border }]}>
              {([{ value: "LOW", label: "Baixo" }, { value: "MEDIUM", label: "Médio" }, { value: "HIGH", label: "Alto" }] as const).map((option) => (
                <Pressable key={option.value} accessibilityRole="button" accessibilityState={{ selected: proactivityLevel === option.value }} disabled={preferenceBusy || !preferencesLoaded}
                  onPress={() => void updateAsaPreferences({ proactivityLevel: option.value })}
                  style={[styles.preferenceSegment, { backgroundColor: proactivityLevel === option.value ? colors.primary : "transparent", opacity: preferenceBusy ? 0.6 : 1 }]}>
                  <Text style={[styles.preferenceSegmentText, { color: proactivityLevel === option.value ? "#fff" : colors.foreground }]}>{option.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      )}

      {/* ── Messages ── */}
      {messages.length === 0 ? (
        <View style={styles.empty}>
          <View style={{ marginBottom: 16 }}>
            <AsaAvatar size="large" pose={error ? "duvida" : "feliz"} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Olá! Eu sou a ASA 😊</Text>
          <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
            Posso consultar informações disponíveis para seu perfil e ajudar com algumas tarefas. Quando uma ação for permitida, mostro uma prévia para você revisar e confirmar.
          </Text>
          {error && (
            <Pressable onPress={() => user?.id && void createConversation(user.id)} style={[styles.errorBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="refresh-cw" size={14} color={colors.primary} />
              <Text style={[{ color: colors.primary, fontSize: 13, marginLeft: 6 }]}>Tentar novamente</Text>
            </Pressable>
          )}
          <View style={styles.suggestions}>
            {visibleSuggestions.map((s) => (
              <Pressable
                key={`${s.label}-${s.prompt}`}
                onPress={() => sendMessage(s.prompt)}
                style={({ pressed }) => [
                  styles.suggestionChip,
                  { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Text style={[styles.suggestionText, { color: colors.mutedForeground }]}>{s.label}</Text>
              </Pressable>
            ))}
        </View>
      </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 16 }}
          renderItem={({ item }) => (
            <MessageBubble msg={item} colors={colors} streamingPose={chatPose} proposalBusy={proposalBusyId === item.proposal?.id} onResolveProposal={(proposal, action) => void resolveProposal(proposal, action)} undoBusy={undoBusyId === item.undo?.id} undoNow={undoNow} onUndo={(undo) => void undoAsaAction(undo)} />
          )}
          onContentSizeChange={scrollToBottom}
        />
      )}

      {/* ── Error strip ── */}
      {error && messages.length > 0 && (
        <View style={[styles.errorStrip, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <Feather name="alert-circle" size={14} color="#ef4444" />
          <Text style={[styles.errorText, { color: "#ef4444" }]} numberOfLines={1}>{error}</Text>
        </View>
      )}

      {/* ── Input ── */}
      <View style={[
        styles.inputBar,
        {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          paddingBottom: insets.bottom + 8,
        },
      ]}>
        <TextInput
          ref={inputRef}
          value={input}
          onChangeText={setInput}
          placeholder="Mensagem para a ASA…"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.textInput, {
            backgroundColor: colors.background,
            borderColor: colors.border,
            color: colors.foreground,
          }]}
          multiline
          maxLength={2000}
          editable={!streaming && !!conversationId}
          returnKeyType="send"
          onSubmitEditing={() => sendMessage()}
          blurOnSubmit={false}
        />
        <Pressable
          onPress={() => sendMessage()}
          disabled={!input.trim() || streaming || !conversationId}
          style={({ pressed }) => [
            styles.sendBtn,
            { backgroundColor: colors.primary, opacity: (!input.trim() || streaming) ? 0.4 : pressed ? 0.8 : 1 },
          ]}
        >
          {streaming ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Feather name="send" size={16} color="#fff" />
          )}
        </Pressable>
      </View>
      <Modal visible={showOperationPicker} transparent animationType="fade" onRequestClose={() => setShowOperationPicker(false)}>
        <View style={styles.operationModalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowOperationPicker(false)} accessibilityLabel="Fechar seleção" />
          <View style={[styles.operationSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.operationSheetTitle, { color: colors.foreground }]}>Operação</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {operations.map((operation) => (
                <Pressable
                  key={operation.id}
                  style={[styles.operationOption, { borderBottomColor: colors.border }]}
                  onPress={() => {
                    setSelectedOperationId(operation.id);
                    if (user?.id) void AsyncStorage.setItem(`myasa_asa_operation_${user.id}`, operation.id);
                    setShowOperationPicker(false);
                  }}
                >
                  <Text style={[styles.operationOptionText, { color: colors.foreground }]}>{operation.name}</Text>
                  {selectedOperationId === operation.id && <Feather name="check" size={17} color={colors.primary} />}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    rowGap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 1, minWidth: 160 },
  settingsButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: 7 },
  preferencePanel: { gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  preferenceGroup: { gap: 5 },
  preferenceLabel: { fontSize: 12, fontWeight: "600" },
  preferenceSegments: { flexDirection: "row", borderWidth: 1, borderRadius: 7, overflow: "hidden" },
  preferenceSegment: { minHeight: 38, flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  preferenceSegmentText: { fontSize: 11, fontWeight: "600", textAlign: "center" },
  operationButton: { maxWidth: 138, minHeight: 38, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, borderWidth: 1, borderRadius: 7 },
  operationButtonText: { flexShrink: 1, fontSize: 12, fontWeight: "600" },
  operationModalBackdrop: { flex: 1, justifyContent: "flex-end", padding: 16, backgroundColor: "rgba(12, 10, 20, 0.35)" },
  operationSheet: { maxHeight: "70%", borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingTop: 18, paddingBottom: 6 },
  operationSheetTitle: { marginBottom: 8, fontSize: 16, fontWeight: "700" },
  operationOption: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: StyleSheet.hairlineWidth },
  operationOptionText: { flex: 1, paddingVertical: 10, fontSize: 14 },
  headerTitle: { fontSize: 16, fontWeight: "700" },
  headerSub: { fontSize: 12, marginTop: 1 },
  newBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  newBtnText: { fontSize: 13, fontWeight: "600" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  emptyTitle: { fontSize: 17, fontWeight: "600", marginBottom: 6 },
  emptySubtitle: { fontSize: 14, textAlign: "center", lineHeight: 20, marginBottom: 24 },
  suggestions: { gap: 8, width: "100%" },
  suggestionChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
  },
  suggestionText: { fontSize: 13 },
  errorBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 16,
  },
  errorStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  errorText: { fontSize: 12, flex: 1 },
  messageRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    marginBottom: 4,
  },
  messageRowUser: { flexDirection: "row-reverse" },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginBottom: 2,
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  bubbleUser: { borderRadius: 18, borderTopRightRadius: 4 },
  bubbleAssistant: { borderRadius: 18, borderTopLeftRadius: 4 },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  proposalBox: { gap: 7, padding: 10, borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, marginTop: 8 },
  proposalTitle: { fontSize: 13, fontWeight: "600" },
  proposalMeta: { fontSize: 12, lineHeight: 17 },
  proposalActions: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 2 },
  proposalButton: { minHeight: 36, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingHorizontal: 9, borderWidth: StyleSheet.hairlineWidth, borderRadius: 5 },
  proposalButtonText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  undoBox: { gap: 7, padding: 8, borderWidth: StyleSheet.hairlineWidth, borderRadius: 6, marginTop: 8 },
  undoButton: { minHeight: 36, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 9, borderWidth: StyleSheet.hairlineWidth, borderRadius: 5 },
  undoButtonText: { fontSize: 12, fontWeight: "600" },
  toolsRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginBottom: 6 },
  toolBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  toolBadgeText: { fontSize: 11 },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingTop: 10,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === "ios" ? 10 : 8,
    fontSize: 14,
    maxHeight: 100,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
});
