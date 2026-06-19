import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";

import { useColors } from "@/hooks/useColors";
import { AsaEmptyState } from "@/components/AsaEmptyState";
import {
  useGetMyTasks,
  useStartTask,
  useSubmitTaskForApproval,
  useUpdateTask,
  useGetMyActiveDelegations,
  useListTasks,
  useApproveTask,
  useAddTaskEvidence,
  useDeleteTaskEvidence,
  useGetTask,
  getListTasksQueryKey,
} from "@workspace/api-client-react";
import type { TaskItem, TaskEvidence } from "@workspace/api-client-react";

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

// ─── Evidence Section ─────────────────────────────────────────────────────────

function EvidenceSection({
  taskId,
  taskStatus,
  colors,
  onEvidenceAdded,
}: {
  taskId: string;
  taskStatus: string;
  colors: ReturnType<typeof useColors>;
  onEvidenceAdded: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");

  const { data: taskDetail, refetch: refetchDetail } = useGetTask(taskId, {
    query: { enabled: expanded } as any,
  });
  const evidences: TaskEvidence[] = (taskDetail as any)?.evidences ?? [];

  const addMutation = useAddTaskEvidence({
    mutation: {
      onSuccess: () => {
        refetchDetail();
        onEvidenceAdded();
        setShowForm(false);
        setUrl("");
        setDescription("");
      },
      onError: () => Alert.alert("Erro", "Não foi possível adicionar a evidência."),
    },
  });

  const deleteMutation = useDeleteTaskEvidence({
    mutation: {
      onSuccess: () => refetchDetail(),
      onError: () => Alert.alert("Erro", "Não foi possível remover a evidência."),
    },
  });

  const canEdit = ["IN_PROGRESS", "CHANGES_REQUESTED"].includes(taskStatus);

  return (
    <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, marginTop: 4, gap: 8 }}>
      <Pressable
        style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
        onPress={() => setExpanded(!expanded)}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Feather name="paperclip" size={12} color={colors.mutedForeground} />
          <Text style={{ fontSize: 11, fontWeight: "600", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Evidências{evidences.length > 0 ? ` (${evidences.length})` : ""}
          </Text>
        </View>
        <Feather name={expanded ? "chevron-up" : "chevron-down"} size={14} color={colors.mutedForeground} />
      </Pressable>

      {expanded && (
        <View style={{ gap: 8 }}>
          {evidences.length === 0 && !showForm && (
            <Text style={{ fontSize: 12, color: colors.mutedForeground, fontStyle: "italic" }}>
              Nenhuma evidência anexada ainda.
            </Text>
          )}

          {evidences.map((ev: TaskEvidence) => (
            <View
              key={ev.id}
              style={{ flexDirection: "row", alignItems: "flex-start", backgroundColor: colors.muted, borderRadius: 8, padding: 10, gap: 8 }}
            >
              <Feather name="link" size={13} color="#7c3aed" style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, color: "#7c3aed", fontWeight: "500" }} numberOfLines={2}>{ev.url}</Text>
                {ev.description ? (
                  <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 2 }}>{ev.description}</Text>
                ) : null}
                <Text style={{ fontSize: 10, color: colors.mutedForeground, marginTop: 2 }}>
                  {new Date(ev.createdAt).toLocaleDateString("pt-BR")}
                </Text>
              </View>
              {canEdit && (
                <Pressable
                  hitSlop={8}
                  onPress={() =>
                    Alert.alert("Remover evidência?", "Esta ação não pode ser desfeita.", [
                      { text: "Cancelar", style: "cancel" },
                      { text: "Remover", style: "destructive", onPress: () => deleteMutation.mutate({ taskId, evidenceId: ev.id }) },
                    ])
                  }
                >
                  <Feather name="trash-2" size={13} color="#ef4444" />
                </Pressable>
              )}
            </View>
          ))}

          {canEdit && !showForm && (
            <Pressable
              style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4 }}
              onPress={() => setShowForm(true)}
            >
              <Feather name="plus-circle" size={14} color="#7c3aed" />
              <Text style={{ fontSize: 13, color: "#7c3aed", fontWeight: "500" }}>Adicionar Evidência</Text>
            </Pressable>
          )}

          {showForm && (
            <View style={{ gap: 8 }}>
              <TextInput
                style={[evidenceStyles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]}
                placeholder="URL / Link (Drive, YouTube, OneDrive...)"
                placeholderTextColor={colors.mutedForeground}
                value={url}
                onChangeText={setUrl}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              <TextInput
                style={[evidenceStyles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card, minHeight: 60 }]}
                placeholder="Descrição ou observação (opcional)"
                placeholderTextColor={colors.mutedForeground}
                value={description}
                onChangeText={setDescription}
                multiline
              />
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable
                  style={{ flex: 1, backgroundColor: colors.muted, borderRadius: 8, paddingVertical: 9, alignItems: "center" }}
                  onPress={() => { setShowForm(false); setUrl(""); setDescription(""); }}
                >
                  <Text style={{ fontSize: 13, color: colors.mutedForeground, fontWeight: "500" }}>Cancelar</Text>
                </Pressable>
                <Pressable
                  style={{
                    flex: 2, backgroundColor: "#7c3aed", borderRadius: 8, paddingVertical: 9, alignItems: "center",
                    opacity: !url.trim() || addMutation.isPending ? 0.5 : 1,
                  }}
                  onPress={() => {
                    if (!url.trim()) return;
                    addMutation.mutate({ taskId, data: { type: "LINK", url: url.trim(), description: description.trim() || undefined } });
                  }}
                  disabled={!url.trim() || addMutation.isPending}
                >
                  {addMutation.isPending
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={{ fontSize: 13, color: "#fff", fontWeight: "600" }}>Salvar</Text>
                  }
                </Pressable>
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const evidenceStyles = StyleSheet.create({
  input: {
    borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 9,
    fontSize: 13, textAlignVertical: "top",
  },
});

// ─── Task Card ────────────────────────────────────────────────────────────────

function TaskCard({
  task,
  colors,
  onStart,
  onSubmit,
  onToggleChecklist,
  onEvidenceAdded,
  loading,
}: {
  task: TaskItem;
  colors: ReturnType<typeof useColors>;
  onStart: (id: string) => void;
  onSubmit: (id: string) => void;
  onToggleChecklist: (task: TaskItem, itemId: string, completed: boolean) => void;
  onEvidenceAdded: () => void;
  loading: string | null;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const isLate = !["APPROVED", "COMPLETED", "CANCELLED"].includes(task.status) && task.dueDate < today;
  const checklist = (task.operationalChecklist ?? []).concat(task.mandatoryChecklist ?? []);
  const completedCount = checklist.filter((i) => i.completed).length;
  const checklistDone = checklist.length === 0 || completedCount === checklist.length;
  const canSubmit = task.status === "IN_PROGRESS" && checklistDone;
  const showEvidenceSection = ["IN_PROGRESS", "CHANGES_REQUESTED", "READY_FOR_APPROVAL"].includes(task.status);

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

      {/* Evidências */}
      {showEvidenceSection && (
        <EvidenceSection
          taskId={task.id}
          taskStatus={task.status}
          colors={colors}
          onEvidenceAdded={onEvidenceAdded}
        />
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
          <>
            <View style={[styles.alertBox, { backgroundColor: "#fef3c7", borderColor: "#fde68a" }]}>
              <Feather name="alert-circle" size={14} color="#d97706" />
              <Text style={[styles.alertText, { color: "#92400e" }]}>Ajustes solicitados — atualize as evidências e reenvie.</Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.btn, styles.btnSuccess, pressed && { opacity: 0.75 }, loading === task.id && { opacity: 0.5 }]}
              onPress={() => onSubmit(task.id)}
              disabled={loading === task.id}
            >
              {loading === task.id
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.btnPrimaryText}>Reenviar para Aprovação</Text>
              }
            </Pressable>
          </>
        )}
        {task.status === "READY_FOR_APPROVAL" && (
          <View style={[styles.alertBox, { backgroundColor: "#ede9fe", borderColor: "#c4b5fd" }]}>
            <Feather name="clock" size={14} color="#7c3aed" />
            <Text style={[styles.alertText, { color: "#5b21b6" }]}>Aguardando aprovação do supervisor.</Text>
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
  const [activeTab, setActiveTab] = useState<"minhas" | "aprovar">("minhas");
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useGetMyTasks(
    statusFilter ? { status: statusFilter } : undefined
  );
  const tasks: TaskItem[] = (data?.tasks ?? []) as TaskItem[];

  const { mutateAsync: startTask } = useStartTask();
  const { mutateAsync: submitTask } = useSubmitTaskForApproval();
  const { mutateAsync: updateTask } = useUpdateTask();

  const { data: delegData } = useGetMyActiveDelegations({ query: { retry: false } as any });
  const hasTaskApprovalsDelegation = (delegData?.delegations ?? []).some(
    (d) => (d.responsibilities as string[]).includes("TASK_APPROVALS")
  );

  const { data: approvalData, isLoading: approvalLoading, refetch: refetchApproval } = useListTasks(
    { status: "READY_FOR_APPROVAL" } as any,
    { query: { enabled: hasTaskApprovalsDelegation } as any }
  );
  const approvalTasks: TaskItem[] = ((approvalData as any)?.tasks ?? []) as TaskItem[];

  const approveMutation = useApproveTask({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
        refetchApproval();
        Alert.alert("Aprovada", "Tarefa aprovada com sucesso.");
      },
      onError: () => Alert.alert("Erro", "Não foi possível aprovar a tarefa."),
    },
  });

  async function handleStart(id: string) {
    setLoading(id);
    try { await startTask({ taskId: id }); await refetch(); }
    catch { Alert.alert("Erro", "Não foi possível iniciar a tarefa."); }
    finally { setLoading(null); }
  }

  async function handleSubmit(id: string) {
    setLoading(id);
    try {
      await submitTask({ taskId: id });
      await refetch();
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? "Verifique se o checklist está completo e as evidências obrigatórias foram anexadas.";
      Alert.alert("Não foi possível enviar", msg);
    } finally {
      setLoading(null);
    }
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

      {/* Tab bar — Capitão com TASK_APPROVALS */}
      {hasTaskApprovalsDelegation && (
        <View style={{ flexDirection: "row", paddingHorizontal: 16, marginBottom: 8, gap: 8 }}>
          <Pressable
            onPress={() => setActiveTab("minhas")}
            style={{
              flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 8,
              backgroundColor: activeTab === "minhas" ? colors.primary : colors.card,
              borderWidth: 1, borderColor: activeTab === "minhas" ? colors.primary : colors.border,
            }}
          >
            <Text style={{ color: activeTab === "minhas" ? "#fff" : colors.mutedForeground, fontSize: 13, fontWeight: "500" }}>
              Minhas Tarefas
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveTab("aprovar")}
            style={{
              flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 8,
              backgroundColor: activeTab === "aprovar" ? colors.primary : colors.card,
              borderWidth: 1, borderColor: activeTab === "aprovar" ? colors.primary : colors.border,
            }}
          >
            <Text style={{ color: activeTab === "aprovar" ? "#fff" : colors.mutedForeground, fontSize: 13, fontWeight: "500" }}>
              Para Aprovar{approvalTasks.length > 0 ? ` (${approvalTasks.length})` : ""}
            </Text>
          </Pressable>
        </View>
      )}

      <View style={styles.list}>
        {activeTab === "aprovar" ? (
          approvalLoading ? (
            <ActivityIndicator style={{ marginTop: 48 }} color={colors.primary} />
          ) : approvalTasks.length === 0 ? (
            <AsaEmptyState
              title="Tudo em dia por aqui! ✅"
              subtitle="Nenhuma tarefa aguardando sua aprovação no momento."
            />
          ) : (
            approvalTasks.map((task) => (
              <ApprovalCard
                key={task.id}
                task={task}
                colors={colors}
                onApprove={() => approveMutation.mutate({ taskId: task.id })}
              />
            ))
          )
        ) : isLoading ? (
          <ActivityIndicator style={{ marginTop: 48 }} color={colors.primary} />
        ) : tasks.length === 0 ? (
          <AsaEmptyState
            title="Sem tarefas por enquanto 🎉"
            subtitle="Quando você receber uma tarefa, ela vai aparecer aqui. Aproveite a calmaria!"
          />
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              colors={colors}
              onStart={handleStart}
              onSubmit={handleSubmit}
              onToggleChecklist={handleToggleChecklist}
              onEvidenceAdded={refetch}
              loading={loading}
            />
          ))
        )}
      </View>
    </ScrollView>
  );
}

// ─── Approval Card (Para Aprovar tab) ────────────────────────────────────────

function ApprovalCard({
  task,
  colors,
  onApprove,
}: {
  task: TaskItem;
  colors: ReturnType<typeof useColors>;
  onApprove: () => void;
}) {
  const [showEvidence, setShowEvidence] = useState(false);
  const { data: taskDetail } = useGetTask(task.id, {
    query: { enabled: showEvidence } as any,
  });
  const evidences: TaskEvidence[] = (taskDetail as any)?.evidences ?? [];

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.taskTitle, { color: colors.foreground }]} numberOfLines={2}>{task.title}</Text>
      <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 2 }}>
        Vence: {new Date(task.dueDate + "T12:00:00").toLocaleDateString("pt-BR")}
      </Text>
      {(task as any).assigneeName && (
        <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
          Responsável: {(task as any).assigneeName}
        </Text>
      )}

      {/* Evidências do aprovador */}
      <Pressable
        style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6 }}
        onPress={() => setShowEvidence(!showEvidence)}
      >
        <Feather name="paperclip" size={12} color={colors.mutedForeground} />
        <Text style={{ fontSize: 12, color: colors.mutedForeground, fontWeight: "500" }}>
          Ver Evidências{evidences.length > 0 ? ` (${evidences.length})` : ""}
        </Text>
        <Feather name={showEvidence ? "chevron-up" : "chevron-down"} size={12} color={colors.mutedForeground} />
      </Pressable>
      {showEvidence && (
        <View style={{ gap: 6 }}>
          {evidences.length === 0 ? (
            <Text style={{ fontSize: 12, color: colors.mutedForeground, fontStyle: "italic" }}>Sem evidências anexadas.</Text>
          ) : (
            evidences.map((ev: TaskEvidence) => (
              <View key={ev.id} style={{ flexDirection: "row", alignItems: "flex-start", backgroundColor: colors.muted, borderRadius: 8, padding: 10, gap: 8 }}>
                <Feather name="link" size={13} color="#7c3aed" style={{ marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, color: "#7c3aed" }} numberOfLines={2}>{ev.url}</Text>
                  {ev.description ? (
                    <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 2 }}>{ev.description}</Text>
                  ) : null}
                </View>
              </View>
            ))
          )}
        </View>
      )}

      <Pressable
        style={{ marginTop: 8, backgroundColor: "#16A34A", borderRadius: 8, paddingVertical: 9, alignItems: "center" }}
        onPress={() =>
          Alert.alert("Aprovar tarefa?", `"${task.title}" será marcada como aprovada.`, [
            { text: "Cancelar", style: "cancel" },
            { text: "Aprovar", onPress: onApprove },
          ])
        }
      >
        <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}>Aprovar</Text>
      </Pressable>
    </View>
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
