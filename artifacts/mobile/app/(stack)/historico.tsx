import { Feather } from "@expo/vector-icons";
import { useGetMyHistory, getGetMyHistoryQueryKey } from "@workspace/api-client-react";
import type { HistoryEvent } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { BackButton } from "@/components/BackButton";
import { AsaEmptyState } from "@/components/AsaEmptyState";

// ─── Config ────────────────────────────────────────────────────────────────────

const CATEGORY_CFG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  SCALE:              { label: "Escala",       color: "#7C3AED", bg: "#F5F3FF", icon: "users" },
  DAILY_BOOK:         { label: "Livro do Dia", color: "#2563EB", bg: "#EFF6FF", icon: "file-text" },
  NOTICE:             { label: "Aviso",        color: "#D97706", bg: "#FFFBEB", icon: "bell" },
  AGENDA:             { label: "Agenda",       color: "#16A34A", bg: "#F0FDF4", icon: "calendar" },
  REQUEST:            { label: "Solicitação",  color: "#EA580C", bg: "#FFF7ED", icon: "activity" },
  DELIVERY:           { label: "Entrega",      color: "#0891B2", bg: "#ECFEFF", icon: "package" },
  MESSAGE:            { label: "Mensagem",     color: "#0284C7", bg: "#F0F9FF", icon: "message-square" },
  OPERATIONAL_CHANGE: { label: "MO",           color: "#DC2626", bg: "#FEF2F2", icon: "alert-circle" },
};

const ACTION_LABELS: Record<string, string> = {
  published:   "Publicou",
  republished: "Republicou",
  confirmed:   "Confirmou",
  escalated:   "Escalou",
  cancelled:   "Cancelou",
  suspended:   "Suspendeu",
  updated:     "Atualizou",
  completed:   "Concluiu",
};

function fmtDateTime(dt: string | undefined | null): string {
  if (!dt) return "—";
  const d = new Date(dt);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const dDate = d.toDateString();
  const prefix =
    dDate === today.toDateString() ? "Hoje" :
    dDate === yesterday.toDateString() ? "Ontem" :
    d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });

  return `${prefix}, ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

// ─── Event Detail Modal ───────────────────────────────────────────────────────

function EventDetailModal({
  event,
  onClose,
  colors,
}: {
  event: HistoryEvent;
  onClose: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  const cfg = CATEGORY_CFG[event.category] ?? {
    label: event.category, color: colors.primary, bg: "#F5F3FF", icon: "clock",
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose} />
      <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
        <View style={styles.modalHandle} />

        {/* Category badge + action */}
        <View style={[styles.modalBadgeRow]}>
          <View style={[styles.categoryBadge, { backgroundColor: cfg.bg }]}>
            <Feather name={cfg.icon as any} size={12} color={cfg.color} />
            <Text style={[styles.categoryBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
          <Text style={[styles.actionLabel, { color: colors.mutedForeground }]}>
            {ACTION_LABELS[event.action] ?? event.action}
          </Text>
        </View>

        <Text style={[styles.modalTitle, { color: colors.foreground }]}>{event.title}</Text>
        <Text style={[styles.modalNarrative, { color: colors.mutedForeground }]}>{event.narrative}</Text>

        <View style={[styles.modalMeta, { borderColor: colors.border }]}>
          <MetaRow label="Quando" value={fmtDateTime(event.occurredAt)} colors={colors} />
          {event.actorName && <MetaRow label="Por" value={event.actorName} colors={colors} />}
          <MetaRow label="Entidade" value={`${event.entityType} — ${event.entityId.slice(0, 8)}…`} colors={colors} />
        </View>

        <TouchableOpacity
          style={[styles.closeBtn, { backgroundColor: colors.primary }]}
          onPress={onClose}
        >
          <Text style={styles.closeBtnText}>Fechar</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

function MetaRow({ label, value, colors }: { label: string; value: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={styles.metaRow}>
      <Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.metaValue, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
}

// ─── Event Row ────────────────────────────────────────────────────────────────

function EventRow({
  event,
  onPress,
  colors,
}: {
  event: HistoryEvent;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  const cfg = CATEGORY_CFG[event.category] ?? {
    label: event.category, color: colors.primary, bg: "#F5F3FF", icon: "clock",
  };

  return (
    <TouchableOpacity
      style={[styles.eventRow, { borderColor: colors.border, backgroundColor: colors.card }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.eventIcon, { backgroundColor: cfg.bg }]}>
        <Feather name={cfg.icon as any} size={16} color={cfg.color} />
      </View>
      <View style={styles.eventContent}>
        <View style={styles.eventHeader}>
          <View style={[styles.categoryPill, { backgroundColor: cfg.bg }]}>
            <Text style={[styles.categoryPillText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
          <Text style={[styles.actionText, { color: colors.mutedForeground }]}>
            {ACTION_LABELS[event.action] ?? event.action}
          </Text>
        </View>
        <Text style={[styles.eventTitle, { color: colors.foreground }]} numberOfLines={1}>
          {event.title}
        </Text>
        <Text style={[styles.eventNarrative, { color: colors.mutedForeground }]} numberOfLines={2}>
          {event.narrative}
        </Text>
        <Text style={[styles.eventTime, { color: colors.mutedForeground }]}>
          {fmtDateTime(event.occurredAt)}
        </Text>
      </View>
      <Feather name="chevron-right" size={14} color={colors.mutedForeground} style={styles.chevron} />
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function HistoricoScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const qc = useQueryClient();

  const [selected, setSelected] = useState<HistoryEvent | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading } = useGetMyHistory({ limit: 50 });
  const events = data?.events ?? [];

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await qc.invalidateQueries({ queryKey: getGetMyHistoryQueryKey() });
    setRefreshing(false);
  }, [qc]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <BackButton />
          <View style={[styles.headerIcon, { backgroundColor: "#F5F3FF" }]}>
            <Feather name="clock" size={20} color="#7C3AED" />
          </View>
          <View>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>Meu Histórico</Text>
            <Text style={[styles.headerSubtitle, { color: colors.mutedForeground }]}>
              Suas últimas ações operacionais
            </Text>
          </View>
        </View>

        {/* Loading */}
        {isLoading && (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        )}

        {/* Empty */}
        {!isLoading && events.length === 0 && (
          <AsaEmptyState
            title="Histórico vazio por enquanto 📋"
            subtitle="Suas ações operacionais serão registradas aqui automaticamente. Continue arrasando! 💪"
            pose="analisando"
          />
        )}

        {/* Events */}
        {!isLoading && events.length > 0 && (
          <View style={styles.list}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              {events.length} registro{events.length !== 1 ? "s" : ""}
            </Text>
            {events.map((event) => (
              <EventRow
                key={event.id}
                event={event}
                onPress={() => setSelected(event)}
                colors={colors}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {selected && (
        <EventDetailModal
          event={selected}
          onClose={() => setSelected(null)}
          colors={colors}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 16 },
  center: { alignItems: "center", paddingTop: 60 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 },
  headerIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 22, fontWeight: "700" },
  headerSubtitle: { fontSize: 13, marginTop: 2 },
  sectionLabel: { fontSize: 12, fontWeight: "600", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  list: {},
  eventRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    gap: 10,
  },
  eventIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  eventContent: { flex: 1 },
  eventHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  categoryPill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 100 },
  categoryPillText: { fontSize: 10, fontWeight: "700" },
  actionText: { fontSize: 11, fontWeight: "500" },
  eventTitle: { fontSize: 14, fontWeight: "600", marginBottom: 2 },
  eventNarrative: { fontSize: 12, lineHeight: 17, marginBottom: 6 },
  eventTime: { fontSize: 11 },
  chevron: { marginTop: 4 },
  emptyTitle: { fontSize: 16, fontWeight: "600", marginBottom: 6, textAlign: "center" },
  emptySubtitle: { fontSize: 13, textAlign: "center", lineHeight: 19, paddingHorizontal: 24 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 36,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 16,
  },
  modalHandle: {
    width: 40, height: 4,
    borderRadius: 2,
    backgroundColor: "#E5E7EB",
    alignSelf: "center",
    marginBottom: 20,
  },
  modalBadgeRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  categoryBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 100 },
  categoryBadgeText: { fontSize: 11, fontWeight: "700" },
  actionLabel: { fontSize: 12, fontWeight: "500" },
  modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 8, lineHeight: 24 },
  modalNarrative: { fontSize: 14, lineHeight: 21, marginBottom: 20 },
  modalMeta: { borderTopWidth: 1, paddingTop: 16, marginBottom: 20, gap: 8 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  metaLabel: { fontSize: 12, fontWeight: "500" },
  metaValue: { fontSize: 12, fontWeight: "600", maxWidth: "60%", textAlign: "right" },
  closeBtn: { borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  closeBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
