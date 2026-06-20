import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { AsaAvatar } from "@/components/AsaAvatar";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  tools?: string[];
  streaming?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getBaseUrl(): Promise<string> {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}`;
  return "";
}

const TOOL_LABELS: Record<string, string> = {
  consultar_agenda:            "📅 Consultando agenda",
  consultar_escalas:           "📋 Consultando escalas",
  consultar_responsabilidades: "👥 Consultando responsabilidades",
  consultar_notificacoes:      "🔔 Consultando notificações",
  consultar_avisos:            "📢 Consultando avisos",
  consultar_tarefas:           "✅ Consultando tarefas",
  consultar_memorias:          "🧠 Consultando memórias",
  consultar_folgas:            "🌴 Consultando folgas",
  consultar_ausencias_do_dia:  "🌴 Verificando ausências",
  consultar_disponibilidade:   "🔍 Verificando disponibilidade",
  consultar_membros:           "👤 Buscando membro",
  criar_aviso_rascunho:        "✏️ Criando rascunho de aviso",
  criar_ensaio_rascunho:       "🎭 Criando rascunho de ensaio",
  criar_entrada_escala:        "📋 Adicionando à escala",
  criar_tarefa:                "✅ Criando tarefa",
  consultar_biblioteca:        "📚 Consultando biblioteca",
  gerar_resumo_do_dia:         "☀️ Gerando resumo do dia",
  consultar_aniversarios:      "🎉 Consultando aniversários",
  consultar_clima:             "🌤️ Consultando clima",
  sugerir_memoria:             "💡 Sugerindo memória",
  consultar_reconhecimentos:   "🏆 Consultando reconhecimentos",
  criar_reconhecimento:        "🎖️ Criando reconhecimento",
  detectar_marcos:             "⭐ Detectando marcos",
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
  "Bom dia! Qual é o panorama de hoje?",
  "Quem está de folga hoje?",
  "Quais são os riscos operacionais do dia?",
  "Detectar marcos da equipe hoje.",
  "Quem faz aniversário essa semana?",
  "Gerar relatório da semana.",
];

const SUGGESTIONS_MEMBER = [
  "Qual é minha escala essa semana?",
  "Quais são meus avisos ativos?",
  "Quem faz aniversário essa semana?",
  "Quais tarefas tenho pendentes?",
];

// ─── Message Bubble ────────────────────────────────────────────────────────────

function MessageBubble({ msg, colors }: { msg: Message; colors: ReturnType<typeof useColors> }) {
  const isUser = msg.role === "user";

  return (
    <View style={[styles.messageRow, isUser && styles.messageRowUser]}>
      {!isUser && (
        <Image
          source={require("@/assets/images/asa-avatar.png")}
          style={{ width: 30, height: 30, borderRadius: 15, marginBottom: 2 }}
          resizeMode="cover"
        />
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
          <Text style={[
            styles.bubbleText,
            { color: isUser ? "#fff" : colors.foreground },
          ]}>
            {msg.content}
          </Text>
        ) : msg.streaming ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>Pensando…</Text>
          </View>
        ) : null}
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
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const { roles } = useAuth();
  const isManager = roles.some((r) =>
    ["ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"].includes(r.role)
  );
  const suggestions = isManager ? SUGGESTIONS_MANAGER : SUGGESTIONS_MEMBER;

  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  useEffect(() => { createConversation(); }, []);
  useEffect(() => { scrollToBottom(); }, [messages]);

  async function createConversation() {
    try {
      const [token, baseUrl] = await Promise.all([
        AsyncStorage.getItem("myasa_access_token"),
        getBaseUrl(),
      ]);
      const res = await fetch(`${baseUrl}/api/anthropic/conversations`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token ?? ""}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: `Conversa ASA ${new Date().toLocaleString("pt-BR")}` }),
      });
      if (!res.ok) throw new Error("Falha ao criar conversa");
      const data = await res.json();
      setConversationId(data.id);
      setMessages([]);
      setError(null);
    } catch {
      setError("Não foi possível iniciar a conversa. Tente novamente.");
    }
  }

  async function sendMessage(text?: string) {
    const content = (text ?? input).trim();
    if (!content || streaming || !conversationId) return;

    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", content };
    const asstId = `a-${Date.now()}`;
    const asstMsg: Message = { id: asstId, role: "assistant", content: "", tools: [], streaming: true };

    setMessages(prev => [...prev, userMsg, asstMsg]);
    setInput("");
    setStreaming(true);
    setError(null);

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
        body: JSON.stringify({ content }),
      });

      if (!res.ok) throw new Error(`Erro ${res.status}`);

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
            if (json.content) {
              setMessages(prev => prev.map(m =>
                m.id === asstId ? { ...m, content: m.content + json.content } : m
              ));
            } else if (json.tool) {
              setMessages(prev => prev.map(m =>
                m.id === asstId ? { ...m, tools: [...(m.tools ?? []), json.tool] } : m
              ));
            } else if (json.done || json.error) {
              setMessages(prev => prev.map(m =>
                m.id === asstId ? { ...m, streaming: false } : m
              ));
            }
          } catch {}
        }
      }

      setMessages(prev => prev.map(m =>
        m.id === asstId ? { ...m, streaming: false } : m
      ));
    } catch (err) {
      setError(`Erro: ${String(err)}`);
      setMessages(prev => prev.filter(m => m.id !== asstId));
    } finally {
      setStreaming(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
    >
      {/* ── Header ── */}
      <View style={[styles.header, {
        paddingTop: insets.top + 8,
        backgroundColor: colors.card,
        borderBottomColor: colors.border,
      }]}>
        <View style={styles.headerLeft}>
          <AsaAvatar size="small" />
          <View>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>ASA</Text>
            <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>Assistente Operacional</Text>
          </View>
        </View>
        <Pressable
          onPress={createConversation}
          style={({ pressed }) => [styles.newBtn, { borderColor: colors.border, opacity: pressed ? 0.6 : 1 }]}
        >
          <Feather name="plus" size={14} color={colors.primary} />
          <Text style={[styles.newBtnText, { color: colors.primary }]}>Nova</Text>
        </Pressable>
      </View>

      {/* ── Messages ── */}
      {messages.length === 0 ? (
        <View style={styles.empty}>
          <View style={{ marginBottom: 16 }}>
            <AsaAvatar size="large" />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Olá! Eu sou a ASA 😊</Text>
          <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
            Posso consultar agenda, escalas, tarefas e avisos — e também criar entradas, tarefas e muito mais. É só me pedir!
          </Text>
          {error && (
            <Pressable onPress={createConversation} style={[styles.errorBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="refresh-cw" size={14} color={colors.primary} />
              <Text style={[{ color: colors.primary, fontSize: 13, marginLeft: 6 }]}>Tentar novamente</Text>
            </Pressable>
          )}
          <View style={styles.suggestions}>
            {suggestions.map((s) => (
              <Pressable
                key={s}
                onPress={() => sendMessage(s)}
                style={({ pressed }) => [
                  styles.suggestionChip,
                  { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Text style={[styles.suggestionText, { color: colors.mutedForeground }]}>{s}</Text>
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
          renderItem={({ item }) => <MessageBubble msg={item} colors={colors} />}
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
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  asaAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
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
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginBottom: 16,
  },
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
