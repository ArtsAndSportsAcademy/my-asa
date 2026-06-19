import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import {
  useGetMyTasks,
  useStartTask,
  useSubmitTaskForApproval,
  useUpdateTask,
} from "@workspace/api-client-react";
import type { TaskItem } from "@workspace/api-client-react";

// ─── Labels ──────────────────────────────────────────────────────────────────

const PRIORITY_LABELS: Record<string, string> = {
  LOW: "Baixa", MEDIUM: "Média", HIGH: "Alta", CRITICAL: "Crítica",
};

const STATUS_LABELS: Record<string, string> = {
  CREATED: "Criada",
  IN_PROGRESS: "Em Andamento",
  READY_FOR_APPROVAL: "Ag. Aprovação",
  CHANGES_REQUESTED: "Ajustes Solicitados",
  APPROVED: "Aprovada",
  COMPLETED: "Concluída",
  CANCELLED: "Cancelada",
  EXPIRED: "Expirada",
};

function priorityDot(p: string): string {
  if (p === "CRITICAL") return "#ef4444";
  if (p === "HIGH")     return "#f59e0b";
  if (p === "MEDIUM")   return "#3b82f6";
  return "#9ca3af";
}

// ─── Task Card ────────────────────────────────────────────────────────────────

function TaskCard({
  task,
  colors,
  onStart,
  onSubmit,
  onToggleChecklist,
  loading,
}: {
  task: TaskItem;
  colors: ReturnType<typeof useColors>;
  onStart: (id: string) => void;
  onSubmit: (id: string) => void;
  onToggleChecklist: (task: TaskItem, itemId: string, completed: boolean) => void;
  loading: string | null;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const isLate = !["APPROVED", "COMPLETED", "CANCELLED"].includes(task.status) && task.dueDate < today;
  const checklist = (task.operationalChecklist ?? []).concat(task.mandatoryChecklist ?? []);
  const completedCount = checklist.filter((i) => i.completed).length;
  const canSubmit = task.status === "IN_PROGRESS" && (!task.requiresApproval || completedCount === checklist.length || checklist.length === 0);

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: isLate ? "#fca5a5" : colors.border }]}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={[styles.priorityDot, { backgroundColor: priorityDot(task.priority) }]} />
        <Text style={[styles.taskTitle, { color: colors.foreground }]} numberOfLines={2}>
          {task.title}
        </Text>
      </View>

      {/* Meta */}
      <View style={styles.metaRow}>
        <View style={[styles.badge, { backgroundColor: colors.muted }]}>
          <Text style={[styles.badgeText, { color: colors.mutedForeground }]}>
            {STATUS_LABELS[task.status] ?? task.status}
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: colors.muted }]}>
          <Text style={[styles.badgeText, { color: colors.mutedForeground }]}>
            {PRIORITY_LABELS[task.priority] ?? task.priority}
          </Text>
        </View>
        {isLate && (
          <View style={[styles.badge, { backgroundColor: "#fee2e2" }]}>
            <Text style={[styles.badgeText, { color: "#dc2626" }]}>Atrasada</Text>
          </View>
        )}
      </View>

      {task.operationName && (
        <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
          Operação: {task.operationName}
        </Text>
      )}
      <Text style={[styles.metaText, { color: isLate ? "#dc2626" : colors.mutedForeground }]}>
        Prazo: {new Date(task.dueDate + "T12:00:00").toLocaleDateString("pt-BR")}
      </Text>

      {/* Checklist */}
      {checklist.length > 0 && (
        <View style={styles.checklist}>
          <Text style={[styles.checklistHeader, { color: colors.mutedForeground }]}>
            Checklist ({completedCount}/{checklist.length})
          </Text>
          {checklist.map((item) => (
            <Pressable
              key={item.id}
              style={styles.checklistItem}
              onPress={() => task.status === "IN_PROGRESS" && onToggleChecklist(task, item.id, !item.completed)}
            >
              <View style={[
                styles.checkbox,
                { borderColor: colors.border, backgroundColor: item.completed ? colors.primary : "transparent" },
              ]}>
                {item.completed && <Feather name="check" size={10} color="#fff" />}
              </View>
              <Text style={[styles.checklistLabel, { color: item.completed ? colors.mutedForeground : colors.foreground, textDecorationLine: item.completed ? "line-through" : "none" }]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        {task.status === "CREATED" && (
          <Pressable
            style={({ pressed }) => [styles.btn, styles.btnPrimary, pressed && { opacity: 0.75 }, loading === task.id && { opacity: 0.5 }]}
            onPress={() => onStart(task.id)}
            disabled={loading === task.id}
          >
            {loading === task.id
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.btnPrimaryText}>Iniciar</Text>
            }
          </Pressable>
        )}
        {canSubmit && (
          <Pressable
            style={({ pressed }) => [styles.btn, styles.btnSuccess, pressed && { opacity: 0.75 }, loading === task.id && { opacity: 0.5 }]}
            onPress={() => onSubmit(task.id)}
            disabled={loading === task.id}
          >
            {loading === task.id
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.btnPrimaryText}>
                  {task.requiresApproval ? "Enviar para Aprovação" : "Concluir"}
                </Text>
            }
          </Pressable>
        )}
        {task.status === "CHANGES_REQUESTED" && (
          <View style={[styles.alertBox, { backgroundColor: "#fef3c7", borderColor: "#fde68a" }]}>
            <Feather name="alert-circle" size={14} color="#d97706" />
            <Text style={[styles.alertText, { color: "#92400e" }]}>Ajustes solicitados pelo aprovador</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TarefasScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [loading, setLoading] = useState<string | null>(null);

  const { data, isLoading, refetch } = useGetMyTasks(
    statusFilter ? { status: statusFilter } : undefined
  );
  const tasks: TaskItem[] = (data?.tasks ?? []) as TaskItem[];

  const { mutateAsync: startTask } = useStartTask();
  const { mutateAsync: submitTask } = useSubmitTaskForApproval();
  const { mutateAsync: updateTask } = useUpdateTask();

  async function handleStart(id: string) {
    setLoading(id);
    try { await startTask({ taskId: id }); await refetch(); }
    catch { /* silently handled */ }
    finally { setLoading(null); }
  }

  async function handleSubmit(id: string) {
    setLoading(id);
    try { await submitTask({ taskId: id }); await refetch(); }
    catch { /* silently handled */ }
    finally { setLoading(null); }
  }

  async function handleToggleChecklist(task: TaskItem, itemId: string, completed: boolean) {
    const currentOperational = task.operationalChecklist ?? [];
    const currentMandatory = task.mandatoryChecklist ?? [];

    const newOperational = currentOperational.map((i) => i.id === itemId ? { ...i, completed } : i);
    const newMandatory = currentMandatory.map((i) => i.id === itemId ? { ...i, completed } : i);

    try {
      await updateTask({ taskId: task.id, data: { operationalChecklist: newOperational, mandatoryChecklist: newMandatory } });
      await refetch();
    } catch { /* silently handled */ }
  }

  const FILTERS = [
    { value: "", label: "Todas" },
    { value: "CREATED", label: "Criadas" },
    { value: "IN_PROGRESS", label: "Em Andamento" },
    { value: "READY_FOR_APPROVAL", label: "Ag. Aprovação" },
    { value: "CHANGES_REQUESTED", label: "Ajustes" },
    { value: "APPROVED", label: "Aprovadas" },
  ];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 100, paddingTop: 16 }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />}
    >
      {/* Filtro de status */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterBar}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
      >
        {FILTERS.map((f) => (
          <Pressable
            key={f.value}
            style={[styles.filterChip, { borderColor: colors.border, backgroundColor: statusFilter === f.value ? colors.primary : colors.card }]}
            onPress={() => setStatusFilter(f.value)}
          >
            <Text style={[styles.filterChipText, { color: statusFilter === f.value ? "#fff" : colors.mutedForeground }]}>
              {f.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.list}>
        {isLoading ? (
          <ActivityIndicator style={{ marginTop: 48 }} color={colors.primary} />
        ) : tasks.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="check-square" size={32} color={colors.mutedForeground} style={{ opacity: 0.4 }} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Nenhuma tarefa encontrada.
            </Text>
          </View>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              colors={colors}
              onStart={handleStart}
              onSubmit={handleSubmit}
              onToggleChecklist={handleToggleChecklist}
              loading={loading}
            />
          ))
        )}
      </View>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  filterBar: { marginBottom: 12 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  filterChipText: { fontSize: 13, fontWeight: "500" },
  list: { paddingHorizontal: 16, gap: 12 },
  card: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 8 },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  priorityDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4, flexShrink: 0 },
  taskTitle: { fontSize: 15, fontWeight: "600", flex: 1, lineHeight: 20 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: "500" },
  metaText: { fontSize: 12 },
  checklist: { gap: 6, marginTop: 2 },
  checklistHeader: { fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  checklistItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  checklistLabel: { fontSize: 13, flex: 1 },
  actions: { marginTop: 4, gap: 8 },
  btn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  btnPrimary: { backgroundColor: "#6d28d9" },
  btnSuccess: { backgroundColor: "#059669" },
  btnPrimaryText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  alertBox: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 8, borderWidth: 1 },
  alertText: { fontSize: 13, flex: 1 },
  empty: { alignItems: "center", justifyContent: "center", paddingVertical: 64, gap: 12 },
  emptyText: { fontSize: 14 },
});
