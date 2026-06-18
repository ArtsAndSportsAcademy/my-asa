import { Feather } from "@expo/vector-icons";
import {
  useGetMyDeliveries,
  useViewDelivery,
  useCompleteDelivery,
  useUpdateDeliveryChecklist,
  getGetMyDeliveriesQueryKey,
} from "@workspace/api-client-react";
import type { MyDeliveryAssignmentItem } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
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

// ─── Config ────────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  MANDATORY_READ:     "Leitura Obrigatória",
  MANDATORY_VIDEO:    "Vídeo Obrigatório",
  OPERATIONAL_UPDATE: "Atualização Operacional",
  CHECKLIST:          "Checklist",
  READING:            "Leitura",
  VIDEO:              "Vídeo",
};

const STATUS_LABELS: Record<string, string> = {
  PUBLISHED: "Aguardando",
  RECEIVED:  "Recebida",
  VIEWED:    "Visualizada",
  COMPLETED: "Concluída",
  OVERDUE:   "Atrasada",
  EXPIRED:   "Expirada",
};

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

function isLate(assignment: MyDeliveryAssignmentItem): boolean {
  if (assignment.status === "COMPLETED") return false;
  return new Date(assignment.deliveryDueDate) < new Date();
}

// ─── Tab bar ──────────────────────────────────────────────────────────────────

type Tab = "pending" | "completed" | "late";

function TabBar({ tab, onChange, counts }: { tab: Tab; onChange: (t: Tab) => void; counts: Record<Tab, number> }) {
  const tabs: { key: Tab; label: string }[] = [
    { key: "pending",   label: "Pendentes" },
    { key: "completed", label: "Concluídas" },
    { key: "late",      label: "Atrasadas" },
  ];
  return (
    <View style={styles.tabBar}>
      {tabs.map((t) => (
        <TouchableOpacity
          key={t.key}
          style={[styles.tabBtn, tab === t.key && styles.tabBtnActive]}
          onPress={() => onChange(t.key)}
        >
          <Text style={[styles.tabBtnText, tab === t.key && styles.tabBtnTextActive]}>
            {t.label}
            {counts[t.key] > 0 ? ` (${counts[t.key]})` : ""}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Assignment Card ──────────────────────────────────────────────────────────

function AssignmentCard({
  assignment,
  onPress,
  colors,
}: {
  assignment: MyDeliveryAssignmentItem;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  const late = isLate(assignment);

  let statusBg = "#F3F4F6";
  let statusText = "#6B7280";
  if (assignment.status === "COMPLETED") { statusBg = "#DCFCE7"; statusText = "#16A34A"; }
  else if (assignment.status === "VIEWED") { statusBg = "#EDE9FE"; statusText = "#7C3AED"; }
  else if (assignment.status === "RECEIVED") { statusBg = "#DBEAFE"; statusText = "#2563EB"; }
  else if (late || assignment.status === "OVERDUE") { statusBg = "#FEF3C7"; statusText = "#D97706"; }

  return (
    <TouchableOpacity
      style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.cardLeft}>
        <View style={styles.cardIcon}>
          <Feather
            name={
              assignment.deliveryType === "MANDATORY_READ" ? "book-open" :
              assignment.deliveryType === "CHECKLIST" ? "check-square" :
              assignment.deliveryType === "MANDATORY_VIDEO" ? "play-circle" : "package"
            }
            size={18}
            color="#7C3AED"
          />
        </View>
      </View>
      <View style={styles.cardContent}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={2}>
          {assignment.deliveryTitle}
        </Text>
        <View style={styles.cardMeta}>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>{TYPE_LABELS[assignment.deliveryType] ?? assignment.deliveryType}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
            <Text style={[styles.statusBadgeText, { color: statusText }]}>
              {late && assignment.status !== "COMPLETED" ? "Atrasada" : (STATUS_LABELS[assignment.status] ?? assignment.status)}
            </Text>
          </View>
        </View>
        <Text style={[styles.cardDate, { color: colors.mutedForeground }]}>
          Prazo: {fmtDate(assignment.deliveryDueDate)}
        </Text>
      </View>
      <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
    </TouchableOpacity>
  );
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────

function AssignmentDetailModal({
  assignment,
  onClose,
  colors,
  insets,
}: {
  assignment: MyDeliveryAssignmentItem;
  onClose: () => void;
  colors: ReturnType<typeof useColors>;
  insets: { top: number; bottom: number };
}) {
  const qc = useQueryClient();
  const viewMut = useViewDelivery();
  const completeMut = useCompleteDelivery();
  const checklistMut = useUpdateDeliveryChecklist();

  const [checklistProgress, setChecklistProgress] = useState<Record<string, boolean>>(
    assignment.checklistProgress ?? {}
  );

  const deliveryId = assignment.deliveryId;
  const isChecklist = assignment.deliveryType === "CHECKLIST";
  const items = assignment.deliveryChecklistItems ?? [];
  const isDone = assignment.status === "COMPLETED";

  const allChecked = items.length > 0 && items.every((i) => checklistProgress[i.id]);

  const handleView = useCallback(() => {
    if (assignment.status !== "PUBLISHED" && assignment.status !== "RECEIVED") return;
    viewMut.mutate(
      { deliveryId },
      { onSuccess: () => qc.invalidateQueries({ queryKey: getGetMyDeliveriesQueryKey() }) }
    );
  }, [assignment.status, deliveryId]);

  const handleComplete = useCallback(() => {
    completeMut.mutate(
      { deliveryId },
      { onSuccess: () => { qc.invalidateQueries({ queryKey: getGetMyDeliveriesQueryKey() }); onClose(); } }
    );
  }, [deliveryId]);

  const toggleItem = (itemId: string) => {
    const newProgress = { ...checklistProgress, [itemId]: !checklistProgress[itemId] };
    setChecklistProgress(newProgress);
    checklistMut.mutate({ deliveryId, data: { progress: newProgress } }, {
      onSuccess: () => qc.invalidateQueries({ queryKey: getGetMyDeliveriesQueryKey() }),
    });
  };

  // Auto-mark as viewed when opening
  React.useEffect(() => {
    if (assignment.status === "PUBLISHED" || assignment.status === "RECEIVED") {
      handleView();
    }
  }, []);

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <ScrollView
        style={[styles.modal, { backgroundColor: colors.background }]}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={[styles.modalHeader, { paddingTop: insets.top + 12, borderColor: colors.border, backgroundColor: colors.card }]}>
          <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]} numberOfLines={2}>
              {assignment.deliveryTitle}
            </Text>
            <Text style={[styles.modalSubtitle, { color: "#7C3AED" }]}>
              {TYPE_LABELS[assignment.deliveryType] ?? assignment.deliveryType}
            </Text>
          </View>
        </View>

        <View style={{ padding: 20, gap: 20 }}>
          {/* Status row */}
          <View style={[styles.infoBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Status</Text>
              <Text style={[styles.infoValue, { color: colors.foreground }]}>
                {isDone ? "✓ Concluída" : (STATUS_LABELS[assignment.status] ?? assignment.status)}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Prazo</Text>
              <Text style={[styles.infoValue, { color: isLate(assignment) ? "#D97706" : colors.foreground }]}>
                {fmtDate(assignment.deliveryDueDate)}
                {isLate(assignment) && !isDone ? " ⚠ Atrasada" : ""}
              </Text>
            </View>
            <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
              <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Prazo Máximo</Text>
              <Text style={[styles.infoValue, { color: colors.foreground }]}>{fmtDate(assignment.deliveryMaxDueDate)}</Text>
            </View>
          </View>

          {/* Description */}
          {assignment.deliveryDescription && (
            <View>
              <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>Descrição</Text>
              <Text style={[styles.description, { color: colors.foreground }]}>{assignment.deliveryDescription}</Text>
            </View>
          )}

          {/* Checklist */}
          {isChecklist && items.length > 0 && (
            <View>
              <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>Checklist</Text>
              <View style={[styles.checklistBox, { borderColor: colors.border }]}>
                {items.map((item, i) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.checklistItem,
                      { borderColor: colors.border },
                      i < items.length - 1 && styles.checklistItemBorder,
                    ]}
                    onPress={() => !isDone && toggleItem(item.id)}
                    disabled={isDone}
                    activeOpacity={0.7}
                  >
                    <View style={[
                      styles.checkbox,
                      { borderColor: checklistProgress[item.id] ? "#7C3AED" : colors.border },
                      checklistProgress[item.id] && { backgroundColor: "#7C3AED" },
                    ]}>
                      {checklistProgress[item.id] && <Feather name="check" size={11} color="#fff" />}
                    </View>
                    <Text style={[
                      styles.checklistLabel,
                      { color: checklistProgress[item.id] ? colors.mutedForeground : colors.foreground },
                      checklistProgress[item.id] && { textDecorationLine: "line-through" },
                    ]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* CTA */}
          {!isDone && (
            <TouchableOpacity
              style={[
                styles.completeBtn,
                { opacity: (isChecklist && !allChecked) ? 0.4 : 1 },
              ]}
              onPress={handleComplete}
              disabled={completeMut.isPending || (isChecklist && !allChecked)}
            >
              <Feather name="check-circle" size={20} color="#fff" />
              <Text style={styles.completeBtnText}>
                {completeMut.isPending ? "Concluindo..." :
                 isChecklist && !allChecked ? `Conclua todos os ${items.length} itens` :
                 "Confirmar Conclusão"}
              </Text>
            </TouchableOpacity>
          )}

          {isDone && (
            <View style={styles.doneBox}>
              <Feather name="check-circle" size={28} color="#16A34A" />
              <Text style={styles.doneText}>Concluída em {fmtDate(assignment.completedAt)}</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function EntregasScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const qc = useQueryClient();

  const [tab, setTab] = useState<Tab>("pending");
  const [selected, setSelected] = useState<MyDeliveryAssignmentItem | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading } = useGetMyDeliveries();
  const all = (data?.assignments ?? []) as MyDeliveryAssignmentItem[];

  const pending   = all.filter((a) => a.status !== "COMPLETED" && !isLate(a) && a.status !== "OVERDUE" && a.status !== "EXPIRED");
  const completed = all.filter((a) => a.status === "COMPLETED");
  const late      = all.filter((a) => a.status !== "COMPLETED" && (isLate(a) || a.status === "OVERDUE" || a.status === "EXPIRED"));

  const counts: Record<Tab, number> = { pending: pending.length, completed: completed.length, late: late.length };
  const displayed = tab === "pending" ? pending : tab === "completed" ? completed : late;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await qc.invalidateQueries({ queryKey: getGetMyDeliveriesQueryKey() });
    setRefreshing(false);
  }, [qc]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            <Feather name="package" size={20} color="#7C3AED" />
          </View>
          <View>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>Entregas</Text>
            <Text style={[styles.headerSubtitle, { color: colors.mutedForeground }]}>Conteúdo obrigatório</Text>
          </View>
        </View>
      </View>

      {/* Tab bar */}
      <TabBar tab={tab} onChange={setTab} counts={counts} />

      {/* List */}
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7C3AED" />}
      >
        {isLoading && (
          <View style={styles.center}><ActivityIndicator color="#7C3AED" /></View>
        )}
        {!isLoading && displayed.length === 0 && (
          <View style={styles.emptyState}>
            <Feather
              name={tab === "completed" ? "check-circle" : tab === "late" ? "alert-circle" : "inbox"}
              size={36}
              color={colors.mutedForeground}
              style={{ opacity: 0.3, marginBottom: 12 }}
            />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              {tab === "pending" ? "Nenhuma entrega pendente" :
               tab === "completed" ? "Nenhuma entrega concluída" :
               "Nenhuma entrega atrasada"}
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
              {tab === "pending" ? "Você está em dia!" :
               tab === "completed" ? "Conclua suas entregas para vê-las aqui" :
               "Ótimo! Tudo em dia."}
            </Text>
          </View>
        )}
        {displayed.map((a) => (
          <AssignmentCard key={a.id} assignment={a} onPress={() => setSelected(a)} colors={colors} />
        ))}
      </ScrollView>

      {selected && (
        <AssignmentDetailModal
          assignment={selected}
          onClose={() => setSelected(null)}
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
  center: { paddingTop: 60, alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  headerIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: "#F5F3FF", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 20, fontWeight: "700" },
  headerSubtitle: { fontSize: 12, marginTop: 1 },
  tabBar: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#E5E7EB" },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabBtnActive: { borderBottomColor: "#7C3AED" },
  tabBtnText: { fontSize: 13, fontWeight: "500", color: "#6B7280" },
  tabBtnTextActive: { color: "#7C3AED", fontWeight: "700" },
  card: { marginHorizontal: 12, marginTop: 10, borderWidth: 1, borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  cardLeft: {},
  cardIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: "#F5F3FF", alignItems: "center", justifyContent: "center" },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 14, fontWeight: "600", marginBottom: 4 },
  cardMeta: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginBottom: 4 },
  typeBadge: { backgroundColor: "#F5F3FF", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 100 },
  typeBadgeText: { fontSize: 10, color: "#7C3AED", fontWeight: "600" },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 100 },
  statusBadgeText: { fontSize: 10, fontWeight: "600" },
  cardDate: { fontSize: 11 },
  emptyState: { alignItems: "center", paddingTop: 80, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 16, fontWeight: "600", marginBottom: 6, textAlign: "center" },
  emptySubtitle: { fontSize: 13, textAlign: "center", lineHeight: 19 },
  // Modal
  modal: { flex: 1 },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 17, fontWeight: "700", lineHeight: 24 },
  modalSubtitle: { fontSize: 12, fontWeight: "600", marginTop: 3 },
  infoBox: { borderWidth: 1, borderRadius: 12, overflow: "hidden" },
  infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1 },
  infoLabel: { fontSize: 13 },
  infoValue: { fontSize: 13, fontWeight: "600" },
  sectionTitle: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  description: { fontSize: 14, lineHeight: 21 },
  checklistBox: { borderWidth: 1, borderRadius: 12, overflow: "hidden" },
  checklistItem: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 14 },
  checklistItemBorder: { borderBottomWidth: 1 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  checklistLabel: { fontSize: 14, flex: 1 },
  completeBtn: { backgroundColor: "#7C3AED", borderRadius: 14, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  completeBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  doneBox: { alignItems: "center", paddingVertical: 24, gap: 10 },
  doneText: { fontSize: 15, fontWeight: "600", color: "#16A34A" },
});
