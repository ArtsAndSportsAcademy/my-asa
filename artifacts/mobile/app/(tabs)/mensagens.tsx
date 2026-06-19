import { Feather } from "@expo/vector-icons";
import {
  useListMessageThreads,
  useGetMessageThread,
  useCreateMessageThread,
  useSendMessage,
  useListMessageRecipients,
  getListMessageThreadsQueryKey,
  getGetMessageThreadQueryKey,
} from "@workspace/api-client-react";
import type { MessageThreadListItem, MessageItem, MessageParticipant, MessageRecipient } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";

// ─── Config ────────────────────────────────────────────────────────────────────

const CONTEXT_LABELS: Record<string, string> = {
  SCALE:              "Escala",
  DAILY_BOOK:         "Livro do Dia",
  AGENDA:             "Agenda",
  NOTICE:             "Aviso",
  REQUEST:            "Solicitação",
  OPERATIONAL_CHANGE: "MO",
  DIRECT:             "Direto",
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN:        "Admin",
  SUPERVISOR_A: "Supervisor A",
  SUPERVISOR_B: "Supervisor B",
  MEMBER:       "Membro",
};

function fmtTime(dt: string | undefined | null): string {
  if (!dt) return "";
  const d = new Date(dt);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function fmtFull(dt: string | undefined | null): string {
  if (!dt) return "";
  return new Date(dt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

// ─── Thread Card ──────────────────────────────────────────────────────────────

function ThreadCard({
  thread,
  onPress,
  myId,
  colors,
}: {
  thread: MessageThreadListItem;
  onPress: () => void;
  myId: string;
  colors: ReturnType<typeof useColors>;
}) {
  const others = thread.participants?.filter((p) => p.userId !== myId) ?? [];
  const names = others.map((p) => p.name ?? "—").join(", ");

  return (
    <TouchableOpacity
      style={[styles.threadCard, { borderColor: colors.border, backgroundColor: colors.card }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.threadCardHeader}>
        <View style={styles.threadCardIcon}>
          <Feather name="message-square" size={18} color="#7C3AED" />
        </View>
        <View style={styles.threadCardContent}>
          <View style={styles.threadCardTop}>
            <Text
              style={[
                styles.threadTitle,
                { color: colors.foreground, fontWeight: (thread.unreadCount ?? 0) > 0 ? "700" : "600" },
              ]}
              numberOfLines={1}
            >
              {thread.title}
            </Text>
            <View style={styles.threadTopRight}>
              {(thread.unreadCount ?? 0) > 0 && (
                <View style={styles.unreadDot}>
                  <Text style={styles.unreadDotText}>
                    {(thread.unreadCount ?? 0) > 99 ? "99+" : thread.unreadCount}
                  </Text>
                </View>
              )}
              <Text style={[styles.threadTime, { color: colors.mutedForeground }]}>
                {fmtTime(thread.lastMessage?.createdAt ?? thread.createdAt)}
              </Text>
            </View>
          </View>
          <Text style={[styles.threadNames, { color: colors.mutedForeground }]} numberOfLines={1}>
            {names || "—"}
          </Text>
          {thread.lastMessage && (
            <Text style={[styles.threadPreview, { color: colors.mutedForeground }]} numberOfLines={1}>
              {thread.lastMessage.content}
            </Text>
          )}
          <View style={styles.threadMeta}>
            {thread.status === "CLOSED" && (
              <View style={styles.closedBadge}>
                <Text style={styles.closedBadgeText}>Encerrada</Text>
              </View>
            )}
            {thread.contextType && thread.contextType !== "DIRECT" && (
              <View style={styles.contextBadge}>
                <Text style={styles.contextBadgeText}>
                  {CONTEXT_LABELS[thread.contextType] ?? thread.contextType}
                  {thread.contextTitle ? ` — ${thread.contextTitle}` : ""}
                </Text>
              </View>
            )}
          </View>
        </View>
        <Feather name="chevron-right" size={14} color={colors.mutedForeground} style={{ marginTop: 2 }} />
      </View>
    </TouchableOpacity>
  );
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function Bubble({ msg, isMe, colors }: { msg: MessageItem; isMe: boolean; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={[styles.bubbleWrapper, isMe ? styles.bubbleWrapperRight : styles.bubbleWrapperLeft]}>
      <View style={[
        styles.bubble,
        isMe
          ? { backgroundColor: "#7C3AED", borderBottomRightRadius: 4 }
          : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderBottomLeftRadius: 4 },
      ]}>
        {!isMe && <Text style={styles.bubbleSender}>{msg.senderName ?? "—"}</Text>}
        <Text style={[styles.bubbleText, { color: isMe ? "#fff" : colors.foreground }]}>{msg.content}</Text>
        <Text style={[styles.bubbleTime, { color: isMe ? "rgba(255,255,255,0.6)" : colors.mutedForeground }]}>
          {fmtFull(msg.createdAt)}
        </Text>
      </View>
    </View>
  );
}

// ─── Thread View Modal ────────────────────────────────────────────────────────

function ThreadViewModal({
  threadId,
  myId,
  onClose,
  colors,
  insets,
}: {
  threadId: string;
  myId: string;
  onClose: () => void;
  colors: ReturnType<typeof useColors>;
  insets: { top: number; bottom: number };
}) {
  const qc = useQueryClient();
  const { data, isLoading, refetch } = useGetMessageThread(threadId);
  const sendMut = useSendMessage();
  const [text, setText] = useState("");
  const listRef = useRef<FlatList>(null);

  const thread = data?.thread;
  const messages = data?.messages ?? [];
  const participants = data?.participants ?? [];

  const handleSend = () => {
    const content = text.trim();
    if (!content || !thread || thread.status === "CLOSED") return;
    sendMut.mutate(
      { threadId, data: { content } },
      {
        onSuccess: () => {
          setText("");
          qc.invalidateQueries({ queryKey: getGetMessageThreadQueryKey(threadId) });
          qc.invalidateQueries({ queryKey: getListMessageThreadsQueryKey() });
          setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
        },
      }
    );
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.modal, { backgroundColor: colors.background }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Header */}
        <View style={[styles.modalHeader, { paddingTop: insets.top + 12, borderColor: colors.border, backgroundColor: colors.card }]}>
          <TouchableOpacity onPress={onClose} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <View style={styles.modalHeaderText}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]} numberOfLines={1}>
              {thread?.title ?? "…"}
            </Text>
            {thread?.contextType && thread.contextType !== "DIRECT" && (
              <Text style={[styles.modalSubtitle, { color: "#7C3AED" }]}>
                {CONTEXT_LABELS[thread.contextType]}
                {thread.contextTitle ? ` — ${thread.contextTitle}` : ""}
              </Text>
            )}
          </View>
          {thread?.status === "CLOSED" && (
            <View style={styles.closedPill}>
              <Text style={styles.closedPillText}>Encerrada</Text>
            </View>
          )}
        </View>

        {/* Participants */}
        {participants.length > 0 && (
          <View style={[styles.participantsBar, { borderColor: colors.border, backgroundColor: colors.background }]}>
            <Feather name="users" size={11} color={colors.mutedForeground} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
              {participants.map((p) => (
                <View key={p.userId} style={[styles.participantChip, { borderColor: colors.border }]}>
                  <Text style={[styles.participantChipText, { color: colors.foreground }]}>{p.name ?? "—"}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Messages */}
        {isLoading ? (
          <View style={styles.center}><ActivityIndicator color="#7C3AED" /></View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View style={styles.emptyMessages}>
                <Feather name="message-square" size={32} color={colors.mutedForeground} style={{ opacity: 0.3, marginBottom: 10 }} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Nenhuma mensagem nesta conversa ainda. Envie a primeira mensagem para começar.</Text>
              </View>
            }
            renderItem={({ item }) => (
              <Bubble msg={item} isMe={item.senderId === myId} colors={colors} />
            )}
          />
        )}

        {/* Input */}
        {thread?.status === "OPEN" ? (
          <View style={[styles.inputRow, { borderColor: colors.border, backgroundColor: colors.card, paddingBottom: insets.bottom + 8 }]}>
            <TextInput
              style={[styles.textInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              placeholder="Digite sua mensagem..."
              placeholderTextColor={colors.mutedForeground}
              value={text}
              onChangeText={setText}
              multiline
              returnKeyType="send"
              onSubmitEditing={handleSend}
            />
            <TouchableOpacity
              style={[styles.sendBtn, { opacity: !text.trim() ? 0.5 : 1 }]}
              onPress={handleSend}
              disabled={sendMut.isPending || !text.trim()}
            >
              <Feather name="send" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.closedFooter, { paddingBottom: insets.bottom + 8 }]}>
            <Text style={[styles.closedFooterText, { color: colors.mutedForeground }]}>
              Esta conversa está encerrada
            </Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Create Thread Modal ──────────────────────────────────────────────────────

function CreateThreadModal({
  onClose,
  colors,
  insets,
}: {
  onClose: () => void;
  colors: ReturnType<typeof useColors>;
  insets: { top: number; bottom: number };
}) {
  const qc = useQueryClient();
  const { data: recipientsData } = useListMessageRecipients();
  const createMut = useCreateMessageThread();
  const recipients = recipientsData?.recipients ?? [];

  const [title, setTitle] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [contextType, setContextType] = useState("DIRECT");

  const toggle = (id: string) =>
    setSelectedIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const handleCreate = () => {
    if (!title.trim() || selectedIds.length === 0) return;
    createMut.mutate(
      { data: { title, participantIds: selectedIds, contextType } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListMessageThreadsQueryKey() });
          onClose();
        },
      }
    );
  };

  const contextOptions = Object.entries(CONTEXT_LABELS);

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <ScrollView
        style={[styles.modal, { backgroundColor: colors.background }]}
        contentContainerStyle={{ padding: 20, paddingTop: insets.top + 20, paddingBottom: insets.bottom + 32 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.createHeader}>
          <Text style={[styles.createTitle, { color: colors.foreground }]}>Nova Conversa</Text>
          <TouchableOpacity onPress={onClose}>
            <Feather name="x" size={22} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Assunto</Text>
        <TextInput
          style={[styles.fieldInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
          placeholder="Ex: Dúvida sobre escala de 22/06"
          placeholderTextColor={colors.mutedForeground}
          value={title}
          onChangeText={setTitle}
        />

        <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Participantes</Text>
        {recipients.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.mutedForeground, marginBottom: 16 }]}>
            Nenhum membro da equipe disponível para nova conversa.
          </Text>
        ) : (
          <View style={[styles.recipientList, { borderColor: colors.border }]}>
            {recipients.map((r, i) => (
              <TouchableOpacity
                key={r.id}
                style={[
                  styles.recipientRow,
                  { borderColor: colors.border },
                  i < recipients.length - 1 && styles.recipientRowBorder,
                ]}
                onPress={() => toggle(r.id)}
              >
                <View style={[
                  styles.checkbox,
                  { borderColor: selectedIds.includes(r.id) ? "#7C3AED" : colors.border },
                  selectedIds.includes(r.id) && { backgroundColor: "#7C3AED" },
                ]}>
                  {selectedIds.includes(r.id) && <Feather name="check" size={11} color="#fff" />}
                </View>
                <View>
                  <Text style={[styles.recipientName, { color: colors.foreground }]}>{r.name ?? r.email}</Text>
                  <Text style={[styles.recipientRole, { color: colors.mutedForeground }]}>{ROLE_LABELS[r.role] ?? r.role}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Contexto</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.contextScroll}>
          {contextOptions.map(([k, v]) => (
            <TouchableOpacity
              key={k}
              style={[
                styles.contextChip,
                { borderColor: contextType === k ? "#7C3AED" : colors.border },
                contextType === k && { backgroundColor: "#F5F3FF" },
              ]}
              onPress={() => setContextType(k)}
            >
              <Text style={[styles.contextChipText, { color: contextType === k ? "#7C3AED" : colors.mutedForeground }]}>
                {v}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <TouchableOpacity
          style={[styles.createBtn, { opacity: !title.trim() || selectedIds.length === 0 ? 0.5 : 1 }]}
          onPress={handleCreate}
          disabled={createMut.isPending || !title.trim() || selectedIds.length === 0}
        >
          <Text style={styles.createBtnText}>
            {createMut.isPending ? "Criando..." : "Criar Conversa"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function MensagensScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { user } = useAuth();
  const myId = user?.id ?? "";
  const qc = useQueryClient();

  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading } = useListMessageThreads();
  const threads = (data?.threads ?? []) as MessageThreadListItem[];

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await qc.invalidateQueries({ queryKey: getListMessageThreadsQueryKey() });
    setRefreshing(false);
  }, [qc]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            <Feather name="message-square" size={20} color="#7C3AED" />
          </View>
          <View>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>Mensagens</Text>
            <Text style={[styles.headerSubtitle, { color: colors.mutedForeground }]}>
              Coordenação operacional
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.newBtn}
          onPress={() => setCreateOpen(true)}
        >
          <Feather name="plus" size={16} color="#fff" />
          <Text style={styles.newBtnText}>Nova</Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7C3AED" />
        }
      >
        {isLoading && (
          <View style={styles.center}>
            <ActivityIndicator color="#7C3AED" />
          </View>
        )}
        {!isLoading && threads.length === 0 && (
          <View style={styles.emptyState}>
            <Feather name="message-square" size={36} color={colors.mutedForeground} style={{ opacity: 0.3, marginBottom: 12 }} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Nenhuma conversa iniciada ainda</Text>
            <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
              Toque em "Nova" para se comunicar com sua equipe na ASA.
            </Text>
          </View>
        )}
        {threads.map((t) => (
          <ThreadCard
            key={t.id}
            thread={t}
            onPress={() => setSelectedThreadId(t.id)}
            myId={myId}
            colors={colors}
          />
        ))}
      </ScrollView>

      {selectedThreadId && (
        <ThreadViewModal
          threadId={selectedThreadId}
          myId={myId}
          onClose={() => setSelectedThreadId(null)}
          colors={colors}
          insets={insets}
        />
      )}
      {createOpen && (
        <CreateThreadModal
          onClose={() => setCreateOpen(false)}
          colors={colors}
          insets={insets}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1, flexShrink: 1 },
  headerIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: "#F5F3FF", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 20, fontWeight: "700" },
  headerSubtitle: { fontSize: 12, marginTop: 1 },
  newBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#7C3AED", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, flexShrink: 0 },
  newBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  threadCard: { marginHorizontal: 12, marginTop: 10, borderWidth: 1, borderRadius: 12, padding: 12 },
  threadCardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  threadCardIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#F5F3FF", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  threadCardContent: { flex: 1 },
  threadCardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 4 },
  threadTitle: { fontSize: 14, fontWeight: "600", flex: 1 },
  threadTopRight: { flexDirection: "row", alignItems: "center", gap: 5, flexShrink: 0 },
  unreadDot: { backgroundColor: "#7C3AED", borderRadius: 10, minWidth: 18, height: 18, paddingHorizontal: 4, alignItems: "center", justifyContent: "center" },
  unreadDotText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  threadTime: { fontSize: 11 },
  threadNames: { fontSize: 12, marginTop: 2 },
  threadPreview: { fontSize: 12, marginTop: 2 },
  threadMeta: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 6 },
  closedBadge: { backgroundColor: "#F3F4F6", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 100 },
  closedBadgeText: { fontSize: 10, color: "#6B7280", fontWeight: "600" },
  contextBadge: { backgroundColor: "#F5F3FF", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 100 },
  contextBadgeText: { fontSize: 10, color: "#7C3AED", fontWeight: "600" },
  emptyState: { alignItems: "center", paddingTop: 80, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 16, fontWeight: "600", marginBottom: 6, textAlign: "center" },
  emptySubtitle: { fontSize: 13, textAlign: "center", lineHeight: 19 },
  emptyText: { fontSize: 13, textAlign: "center" },
  emptyMessages: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60 },
  // Modal
  modal: { flex: 1 },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 4 },
  modalHeaderText: { flex: 1 },
  modalTitle: { fontSize: 16, fontWeight: "700" },
  modalSubtitle: { fontSize: 12, fontWeight: "500", marginTop: 2 },
  closedPill: { backgroundColor: "#F3F4F6", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100 },
  closedPillText: { fontSize: 11, color: "#6B7280", fontWeight: "600" },
  participantsBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 6, borderBottomWidth: 1, gap: 8 },
  participantChip: { borderWidth: 1, borderRadius: 100, paddingHorizontal: 8, paddingVertical: 2, marginRight: 4 },
  participantChipText: { fontSize: 11 },
  bubbleWrapper: { marginBottom: 6, flexDirection: "row" },
  bubbleWrapperLeft: { justifyContent: "flex-start" },
  bubbleWrapperRight: { justifyContent: "flex-end" },
  bubble: { maxWidth: "75%", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleSender: { fontSize: 11, fontWeight: "700", color: "#7C3AED", marginBottom: 3 },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  bubbleTime: { fontSize: 10, marginTop: 4 },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 10, paddingHorizontal: 12, paddingTop: 10, borderTopWidth: 1 },
  textInput: { flex: 1, borderWidth: 1, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, maxHeight: 100 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#7C3AED", alignItems: "center", justifyContent: "center" },
  closedFooter: { paddingTop: 12, paddingHorizontal: 16, alignItems: "center" },
  closedFooterText: { fontSize: 13 },
  // Create modal
  createHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 24 },
  createTitle: { fontSize: 20, fontWeight: "700" },
  fieldLabel: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, marginTop: 16 },
  fieldInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
  recipientList: { borderWidth: 1, borderRadius: 10, overflow: "hidden", marginBottom: 4 },
  recipientRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  recipientRowBorder: { borderBottomWidth: 1 },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  recipientName: { fontSize: 14, fontWeight: "500" },
  recipientRole: { fontSize: 12, marginTop: 1 },
  contextScroll: { marginBottom: 24 },
  contextChip: { borderWidth: 1.5, borderRadius: 100, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8, marginBottom: 2 },
  contextChipText: { fontSize: 13, fontWeight: "500" },
  createBtn: { backgroundColor: "#7C3AED", borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  createBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
