import { Feather } from "@expo/vector-icons";
import {
  useGetMyNotices,
  useMarkNoticeViewed,
  useConfirmNotice,
  getGetMyNoticesQueryKey,
  useGetMyActiveDelegations,
  useCreateNotice,
  usePublishNotice,
} from "@workspace/api-client-react";
import type { MyNoticeItem } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
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
import { AsaAvatar } from "@/components/AsaAvatar";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";

// ─── Constants ────────────────────────────────────────────────────────────────

const URGENCY_CFG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  INFORMATIVE: { label: "Informativo", color: "#2563EB", bg: "#EFF6FF", icon: "info" },
  IMPORTANT:   { label: "Importante",  color: "#D97706", bg: "#FFFBEB", icon: "alert-circle" },
  CRITICAL:    { label: "Crítico",     color: "#DC2626", bg: "#FEF2F2", icon: "alert-triangle" },
};

const RECIPIENT_STATUS_LABELS: Record<string, string> = {
  PENDING:   "Pendente",
  SENT:      "Recebido",
  VIEWED:    "Visualizado",
  CONFIRMED: "Confirmado",
  ESCALATED: "Escalado",
};

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AvisosScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const qc = useQueryClient();

  const [selectedNotice, setSelectedNotice] = useState<MyNoticeItem | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newUrgency, setNewUrgency] = useState<"INFORMATIVE" | "IMPORTANT" | "CRITICAL">("INFORMATIVE");
  const [creating, setCreating] = useState(false);

  const { data: notices, isLoading } = useGetMyNotices({});
  const viewMutation    = useMarkNoticeViewed();
  const confirmMutation = useConfirmNotice();

  const { data: delegData } = useGetMyActiveDelegations({ query: { retry: false } as any });
  const noticesDelegation = (delegData?.delegations ?? []).find(
    (d) => (d.responsibilities as string[]).includes("NOTICES")
  );
  const canCreateNotice = !!noticesDelegation;
  const noticesOpId = noticesDelegation?.operationId ?? "";

  const createNoticeMutation = useCreateNotice();
  const publishNoticeMutation = usePublishNotice();

  async function handleCreateAndPublish() {
    if (!newContent.trim() || !noticesOpId) {
      Alert.alert("Atenção", "Preencha o conteúdo do aviso.");
      return;
    }
    setCreating(true);
    try {
      const result = await createNoticeMutation.mutateAsync({
        data: {
          operationId: noticesOpId,
          title: newTitle.trim() || undefined,
          content: newContent.trim(),
          urgency: newUrgency,
        },
      });
      await publishNoticeMutation.mutateAsync({ noticeId: result.id });
      qc.invalidateQueries({ queryKey: getGetMyNoticesQueryKey() });
      setShowCreate(false);
      setNewTitle("");
      setNewContent("");
      setNewUrgency("INFORMATIVE");
      Alert.alert("Aviso publicado", "O aviso foi criado e publicado com sucesso.");
    } catch {
      Alert.alert("Erro", "Não foi possível criar o aviso. Verifique sua delegação.");
    } finally {
      setCreating(false);
    }
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await qc.invalidateQueries({ queryKey: getGetMyNoticesQueryKey() });
    setRefreshing(false);
  }, [qc]);

  const handleOpen = (notice: MyNoticeItem) => {
    setSelectedNotice(notice);
    if (notice.recipientStatus === "SENT" || notice.recipientStatus === "PENDING") {
      viewMutation.mutate(
        { noticeId: notice.id },
        { onSettled: () => qc.invalidateQueries({ queryKey: getGetMyNoticesQueryKey() }) }
      );
    }
  };

  const handleConfirm = () => {
    if (!selectedNotice) return;
    confirmMutation.mutate(
      { noticeId: selectedNotice.id },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetMyNoticesQueryKey() });
          setSelectedNotice((prev) => prev ? { ...prev, recipientStatus: "CONFIRMED", confirmedAt: new Date().toISOString() } : prev);
        },
      }
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top, backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const items = (notices ?? []) as MyNoticeItem[];
  const unreadCount = items.filter((n) => n.recipientStatus === "SENT" || n.recipientStatus === "PENDING").length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground, flex: 1 }]}>Mural</Text>
        {unreadCount > 0 && (
          <View style={[styles.badge, { backgroundColor: colors.primary }]}>
            <Text style={styles.badgeText}>{unreadCount}</Text>
          </View>
        )}
        {canCreateNotice && (
          <TouchableOpacity
            onPress={() => setShowCreate(true)}
            style={{ backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, flexDirection: "row", alignItems: "center", gap: 4 }}
            activeOpacity={0.8}
          >
            <Feather name="plus" size={14} color="#fff" />
            <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}>Novo Aviso</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {items.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="bell-off" size={40} color={colors.mutedForeground} style={{ opacity: 0.4 }} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Sem avisos no momento</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {items.map((notice) => {
              const urg = URGENCY_CFG[notice.urgency] ?? URGENCY_CFG.INFORMATIVE;
              const isUnread = notice.recipientStatus === "SENT" || notice.recipientStatus === "PENDING";
              return (
                <TouchableOpacity
                  key={notice.id}
                  onPress={() => handleOpen(notice)}
                  activeOpacity={0.7}
                  style={[
                    styles.card,
                    {
                      backgroundColor: isUnread ? urg.bg : colors.card,
                      borderColor: colors.border,
                      borderLeftColor: urg.color,
                    },
                  ]}
                >
                  <View style={styles.cardRow}>
                    <View style={styles.cardIconWrap}>
                      <Feather name={urg.icon as any} size={16} color={urg.color} />
                    </View>
                    <View style={styles.cardBody}>
                      <View style={styles.cardTitleRow}>
                        {notice.title ? (
                          <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={1}>
                            {notice.title}
                          </Text>
                        ) : null}
                        <View style={[styles.urgBadge, { backgroundColor: urg.bg, borderColor: urg.color + "40" }]}>
                          <Text style={[styles.urgBadgeText, { color: urg.color }]}>{urg.label}</Text>
                        </View>
                        {isUnread && (
                          <View style={[styles.unreadDot, { backgroundColor: urg.color }]} />
                        )}
                      </View>
                      <Text style={[styles.cardContent, { color: colors.mutedForeground }]} numberOfLines={2}>
                        {notice.content}
                      </Text>
                      <View style={styles.cardMeta}>
                        {notice.publishedAt && (
                          <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                            {new Date(notice.publishedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                          </Text>
                        )}
                        <Text style={[styles.metaText, { color: isUnread ? urg.color : colors.mutedForeground }]}>
                          {RECIPIENT_STATUS_LABELS[notice.recipientStatus] ?? notice.recipientStatus}
                        </Text>
                        {notice.requiresConfirmation && notice.recipientStatus !== "CONFIRMED" && (
                          <View style={[styles.confirmBadge, { backgroundColor: "#EDE9FE", borderColor: "#7C3AED30" }]}>
                            <Text style={[styles.confirmBadgeText, { color: "#7C3AED" }]}>Confirmar</Text>
                          </View>
                        )}
                        {notice.type === "ESCALATED" && (
                          <View style={[styles.confirmBadge, { backgroundColor: "#FEF2F2", borderColor: "#FCA5A530" }]}>
                            <Text style={[styles.confirmBadgeText, { color: "#DC2626" }]}>Escalado</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* ── Detail Modal ── */}
      <Modal
        visible={!!selectedNotice}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedNotice(null)}
      >
        {selectedNotice && (() => {
          const urg = URGENCY_CFG[selectedNotice.urgency] ?? URGENCY_CFG.INFORMATIVE;
          const alreadyConfirmed = selectedNotice.recipientStatus === "CONFIRMED";
          return (
            <View style={[styles.modal, { backgroundColor: colors.background, paddingBottom: insets.bottom + 16 }]}>
              {/* Header */}
              <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                <View style={[styles.modalUrgDot, { backgroundColor: urg.color }]} />
                <Text style={[styles.modalTitle, { color: colors.foreground }]} numberOfLines={2}>
                  {selectedNotice.title ?? "Aviso"}
                </Text>
                <Pressable onPress={() => setSelectedNotice(null)} style={styles.modalClose}>
                  <Feather name="x" size={22} color={colors.mutedForeground} />
                </Pressable>
              </View>

              <ScrollView style={styles.modalScroll} contentContainerStyle={{ padding: 20 }}>
                {/* Urgency */}
                <View style={[styles.urgRow, { backgroundColor: urg.bg }]}>
                  <Feather name={urg.icon as any} size={14} color={urg.color} />
                  <Text style={[styles.urgLabel, { color: urg.color }]}>{urg.label}</Text>
                </View>

                {/* Content */}
                <Text style={[styles.modalContent, { color: colors.foreground }]}>
                  {selectedNotice.content}
                </Text>

                {/* ERA → AGORA delta */}
                {((selectedNotice as any).changeBefore || (selectedNotice as any).changeAfter) && (
                  <View style={[styles.deltaBox, { backgroundColor: "#FFFBEB", borderColor: "#F59E0B" }]}>
                    <View style={styles.deltaBoxHeader}>
                      <Feather name="alert-triangle" size={13} color="#B45309" />
                      <Text style={styles.deltaBoxTitle}>O que mudou</Text>
                    </View>
                    {(selectedNotice as any).changeBefore ? (
                      <View style={[styles.deltaItem, { backgroundColor: "#FEF2F2", borderColor: "#FCA5A5" }]}>
                        <Text style={[styles.deltaLabel, { color: "#DC2626" }]}>ERA</Text>
                        <Text style={[styles.deltaText, { color: "#7F1D1D" }]}>{(selectedNotice as any).changeBefore}</Text>
                      </View>
                    ) : null}
                    {(selectedNotice as any).changeAfter ? (
                      <View style={[styles.deltaItem, { backgroundColor: "#F0FDF4", borderColor: "#86EFAC" }]}>
                        <Text style={[styles.deltaLabel, { color: "#15803D" }]}>AGORA</Text>
                        <Text style={[styles.deltaText, { color: "#166534" }]}>{(selectedNotice as any).changeAfter}</Text>
                      </View>
                    ) : null}
                  </View>
                )}

                {/* Meta */}
                <View style={[styles.metaDivider, { borderTopColor: colors.border }]}>
                  {selectedNotice.authorName && (
                    <Text style={[styles.metaLine, { color: colors.mutedForeground }]}>
                      De: <Text style={{ color: colors.foreground }}>{selectedNotice.authorName}</Text>
                    </Text>
                  )}
                  {selectedNotice.publishedAt && (
                    <Text style={[styles.metaLine, { color: colors.mutedForeground }]}>
                      Publicado: <Text style={{ color: colors.foreground }}>
                        {new Date(selectedNotice.publishedAt).toLocaleString("pt-BR")}
                      </Text>
                    </Text>
                  )}
                  {selectedNotice.expiresAt && (
                    <Text style={[styles.metaLine, { color: colors.mutedForeground }]}>
                      Expira: <Text style={{ color: colors.foreground }}>
                        {new Date(selectedNotice.expiresAt).toLocaleDateString("pt-BR")}
                      </Text>
                    </Text>
                  )}
                </View>
              </ScrollView>

              {/* Confirm button */}
              {selectedNotice.requiresConfirmation && !alreadyConfirmed && (
                <View style={[styles.confirmBar, { borderTopColor: colors.border }]}>
                  <TouchableOpacity
                    onPress={handleConfirm}
                    disabled={confirmMutation.isPending}
                    style={[styles.confirmBtn, { backgroundColor: colors.primary }]}
                    activeOpacity={0.8}
                  >
                    {confirmMutation.isPending ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Feather name="check-circle" size={16} color="#fff" />
                        <Text style={styles.confirmBtnText}>Confirmar leitura</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}
              {alreadyConfirmed && (
                <View style={[styles.confirmedRow, { borderTopColor: colors.border }]}>
                  <Feather name="check-circle" size={16} color="#16A34A" />
                  <Text style={{ color: "#16A34A", fontSize: 14, fontWeight: "600", marginLeft: 6 }}>
                    Leitura confirmada
                  </Text>
                </View>
              )}
            </View>
          );
        })()}
      </Modal>

      {/* ─── Modal Novo Aviso (Capitão) ─────────────────────────────────── */}
      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCreate(false)}>
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          {/* Header */}
          <View style={[styles.header, { paddingTop: 20, borderBottomWidth: 1, borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setShowCreate(false)} style={{ padding: 4 }}>
              <Feather name="x" size={22} color={colors.foreground} />
            </TouchableOpacity>
            <AsaAvatar size="small" pose={newUrgency === "CRITICAL" ? "aviso_importante" : "lembrete"} />
            <Text style={[styles.headerTitle, { color: colors.foreground, fontSize: 18, flex: 1, marginLeft: 8 }]}>Novo Aviso</Text>
            <TouchableOpacity
              onPress={handleCreateAndPublish}
              disabled={creating}
              style={{ backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 }}
              activeOpacity={0.8}
            >
              <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>
                {creating ? "Publicando…" : "Publicar"}
              </Text>
            </TouchableOpacity>
          </View>

          <KeyboardAwareScrollViewCompat
            contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: insets.bottom + 48 }}
            keyboardShouldPersistTaps="handled"
            bottomOffset={24}
          >
            {/* Urgência */}
            <View style={{ gap: 6 }}>
              <Text style={{ color: colors.mutedForeground, fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.6 }}>Urgência</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {(["INFORMATIVE", "IMPORTANT", "CRITICAL"] as const).map((u) => (
                  <Pressable
                    key={u}
                    onPress={() => setNewUrgency(u)}
                    style={{
                      flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 8,
                      backgroundColor: newUrgency === u ? colors.primary : colors.card,
                      borderWidth: 1, borderColor: newUrgency === u ? colors.primary : colors.border,
                    }}
                  >
                    <Text style={{ color: newUrgency === u ? "#fff" : colors.mutedForeground, fontSize: 12, fontWeight: "600" }}>
                      {u === "INFORMATIVE" ? "Info" : u === "IMPORTANT" ? "Importante" : "Crítico"}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Título opcional */}
            <View style={{ gap: 6 }}>
              <Text style={{ color: colors.mutedForeground, fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.6 }}>Título (opcional)</Text>
              <TextInput
                value={newTitle}
                onChangeText={setNewTitle}
                placeholder="Título do aviso…"
                placeholderTextColor={colors.mutedForeground}
                style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, color: colors.foreground, fontSize: 15 }}
              />
            </View>

            {/* Conteúdo */}
            <View style={{ gap: 6 }}>
              <Text style={{ color: colors.mutedForeground, fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.6 }}>Conteúdo *</Text>
              <TextInput
                value={newContent}
                onChangeText={setNewContent}
                placeholder="Escreva o aviso aqui…"
                placeholderTextColor={colors.mutedForeground}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, color: colors.foreground, fontSize: 15, minHeight: 120 }}
              />
            </View>
          </KeyboardAwareScrollViewCompat>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered:  { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 10,
  },
  headerTitle: { fontSize: 28, fontWeight: "700" },
  badge: {
    minWidth: 22, height: 22, borderRadius: 11,
    alignItems: "center", justifyContent: "center", paddingHorizontal: 6,
  },
  badgeText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  empty:     { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 14 },
  list:      { padding: 16, gap: 10 },
  card: {
    borderWidth: 1,
    borderLeftWidth: 4,
    borderRadius: 12,
    padding: 14,
  },
  cardRow:     { flexDirection: "row", gap: 10 },
  cardIconWrap:{ paddingTop: 2 },
  cardBody:    { flex: 1, gap: 4 },
  cardTitleRow:{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
  cardTitle:   { fontSize: 14, fontWeight: "600", flexShrink: 1 },
  urgBadge:    { borderWidth: 1, borderRadius: 20, paddingHorizontal: 7, paddingVertical: 2 },
  urgBadgeText:{ fontSize: 10, fontWeight: "600" },
  unreadDot:   { width: 7, height: 7, borderRadius: 4 },
  cardContent: { fontSize: 13, lineHeight: 18 },
  cardMeta:    { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  metaText:    { fontSize: 11 },
  confirmBadge:{ borderWidth: 1, borderRadius: 20, paddingHorizontal: 7, paddingVertical: 2 },
  confirmBadgeText:{ fontSize: 10, fontWeight: "600" },
  modal:       { flex: 1 },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    gap: 10,
  },
  modalUrgDot: { width: 10, height: 10, borderRadius: 5 },
  modalTitle:  { flex: 1, fontSize: 17, fontWeight: "700" },
  modalClose:  { padding: 4 },
  modalScroll: { flex: 1 },
  urgRow:      { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 16 },
  urgLabel:    { fontSize: 13, fontWeight: "600" },
  modalContent:{ fontSize: 15, lineHeight: 24, marginBottom: 24 },
  metaDivider: { borderTopWidth: 1, paddingTop: 16, gap: 6 },
  metaLine:    { fontSize: 13 },
  confirmBar:  { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1 },
  confirmBtn:  {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, borderRadius: 12, paddingVertical: 14,
  },
  confirmBtnText:{ color: "#fff", fontSize: 15, fontWeight: "700" },
  confirmedRow:{ flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: 20, paddingTop: 16, borderTopWidth: 1 },
  deltaBox: { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 16, gap: 8 },
  deltaBoxHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  deltaBoxTitle: { fontSize: 12, fontWeight: "700", color: "#B45309" },
  deltaItem: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  deltaLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5, marginBottom: 3 },
  deltaText:  { fontSize: 13, lineHeight: 18 },
});
