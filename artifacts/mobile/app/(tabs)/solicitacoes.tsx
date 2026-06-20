import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";

import { useColors } from "@/hooks/useColors";
import { AsaEmptyState } from "@/components/AsaEmptyState";
import {
  useListRequests,
  useCreateRequest,
  useUpdateRequest,
  useGetOperations,
  useGetMyActiveDelegations,
  useListPendingRequests,
  useDecideRequest,
  type RequestType,
  type RequestItem,
} from "@workspace/api-client-react";

// ─── Labels ───────────────────────────────────────────────────────────────────

const REQUEST_TYPE_LABELS: Record<string, string> = {
  LEAVE: "Folga",
  ROLE_RESTRICTION: "Restrição de Função",
  PHYSICAL_RESTRICTION: "Restrição Física",
  HEALTH_RESTRICTION: "Restrição de Saúde",
  SCHEDULE_CHANGE: "Mudança de Escala",
  SWAP: "Troca",
  OTHER: "Outro",
};

const REQUEST_STATUS_LABELS: Record<string, string> = {
  PENDING: "Aguardando",
  APPROVED: "Aprovada",
  DENIED: "Negada",
  ALTERNATIVE_PROPOSED: "Alternativa Proposta",
  ALTERNATIVE_ACCEPTED: "Alternativa Aceita",
  ALTERNATIVE_REJECTED: "Alternativa Rejeitada",
  EXPIRED: "Expirada",
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  PENDING:              { bg: "#FEF3C7", text: "#B45309" },
  APPROVED:             { bg: "#D1FAE5", text: "#065F46" },
  DENIED:               { bg: "#FEE2E2", text: "#991B1B" },
  ALTERNATIVE_PROPOSED: { bg: "#DBEAFE", text: "#1E40AF" },
  ALTERNATIVE_ACCEPTED: { bg: "#D1FAE5", text: "#065F46" },
  ALTERNATIVE_REJECTED: { bg: "#FEE2E2", text: "#991B1B" },
  EXPIRED:              { bg: "#F3F4F6", text: "#6B7280" },
};

const REQUEST_TYPES: { value: RequestType; label: string }[] = [
  { value: "LEAVE",               label: "Folga" },
  { value: "ROLE_RESTRICTION",    label: "Restrição de Função" },
  { value: "PHYSICAL_RESTRICTION",label: "Restrição Física" },
  { value: "HEALTH_RESTRICTION",  label: "Restrição de Saúde" },
  { value: "SCHEDULE_CHANGE",     label: "Mudança de Escala" },
  { value: "SWAP",                label: "Troca" },
  { value: "OTHER",               label: "Outro" },
];

// ─── Helper ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SolicitacoesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [showCreate, setShowCreate] = useState(false);
  const [selectedType, setSelectedType] = useState<RequestType>("LEAVE");
  const [selectedOperationId, setSelectedOperationId] = useState("");
  const [datesText, setDatesText] = useState(today());
  const [reason, setReason] = useState("");
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [showOpSelector, setShowOpSelector] = useState(false);
  const [activeTab, setActiveTab] = useState<"minhas" | "decidir">("minhas");

  const { data: opsData } = useGetOperations();
  const operations = opsData?.operations ?? [];

  const { data: delegData } = useGetMyActiveDelegations({ query: { retry: false } as any });
  const hasRequestsDelegation = (delegData?.delegations ?? []).some(
    (d) => (d.responsibilities as string[]).includes("REQUESTS")
  );

  const { data: pendingData, isLoading: pendingLoading } = useListPendingRequests(
    {} as any,
    { query: { enabled: hasRequestsDelegation } as any }
  );
  const pendingRequests = pendingData?.requests ?? [];

  const decideMutation = useDecideRequest({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/requests/pending"] });
        Alert.alert("Decisão registrada", "A solicitação foi processada.");
      },
      onError: () => Alert.alert("Erro", "Não foi possível processar a solicitação."),
    },
  });

  const { data, isLoading, refetch } = useListRequests(undefined as any, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query: { refetchOnWindowFocus: true } as any,
  });
  const requests = data?.requests ?? [];

  const createMutation = useCreateRequest({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["listRequests"] });
        setShowCreate(false);
        setSelectedType("LEAVE");
        setSelectedOperationId("");
        setDatesText(today());
        setReason("");
        Alert.alert("Solicitação enviada", "Sua solicitação foi registrada com sucesso.");
      },
      onError: () => Alert.alert("Erro", "Não foi possível criar a solicitação."),
    },
  });

  const updateMutation = useUpdateRequest({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["listRequests"] });
        Alert.alert("Resposta registrada", "Sua resposta foi enviada com sucesso.");
      },
      onError: () => Alert.alert("Erro", "Não foi possível registrar a resposta."),
    },
  });

  function submitCreate() {
    const targetDates = datesText
      .split(/[,\s]+/)
      .map((d) => d.trim())
      .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));

    if (!selectedOperationId) {
      Alert.alert("Atenção", "Selecione uma operação.");
      return;
    }
    if (targetDates.length === 0) {
      Alert.alert("Atenção", "Informe ao menos uma data no formato AAAA-MM-DD.");
      return;
    }

    createMutation.mutate({
      data: {
        type: selectedType,
        operationId: selectedOperationId,
        targetDates,
        reason: reason.trim() || undefined,
      },
    });
  }

  function respondToAlternative(req: RequestItem, accept: boolean) {
    Alert.alert(
      accept ? "Aceitar alternativa?" : "Rejeitar alternativa?",
      accept
        ? "Você confirma aceitar a alternativa proposta pelo supervisor?"
        : "Você confirma rejeitar a alternativa proposta?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: accept ? "Aceitar" : "Rejeitar",
          style: accept ? "default" : "destructive",
          onPress: () =>
            updateMutation.mutate({
              id: req.id,
              data: { status: accept ? "ALTERNATIVE_ACCEPTED" : "ALTERNATIVE_REJECTED" },
            }),
        },
      ]
    );
  }

  const pending   = requests.filter((r) => r.status === "PENDING");
  const waiting   = requests.filter((r) => r.status === "ALTERNATIVE_PROPOSED");
  const resolved  = requests.filter((r) =>
    ["APPROVED", "DENIED", "ALTERNATIVE_ACCEPTED", "ALTERNATIVE_REJECTED", "EXPIRED"].includes(r.status)
  );

  const selectedOp = operations.find((o) => o.id === selectedOperationId);
  const selectedTypeName = REQUEST_TYPES.find((t) => t.value === selectedType)?.label ?? selectedType;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.foreground }]}>
            Minhas Solicitações
          </Text>
          <Pressable
            style={[styles.newButton, { backgroundColor: colors.primary }]}
            onPress={() => setShowCreate(true)}
          >
            <Feather name="plus" size={16} color="#fff" />
            <Text style={styles.newButtonText}>Nova</Text>
          </Pressable>
        </View>

        {/* Tab bar — Capitão com REQUESTS */}
        {hasRequestsDelegation && (
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
                Minhas
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setActiveTab("decidir")}
              style={{
                flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 8,
                backgroundColor: activeTab === "decidir" ? colors.primary : colors.card,
                borderWidth: 1, borderColor: activeTab === "decidir" ? colors.primary : colors.border,
              }}
            >
              <Text style={{ color: activeTab === "decidir" ? "#fff" : colors.mutedForeground, fontSize: 13, fontWeight: "500" }}>
                Para Decidir{pendingRequests.length > 0 ? ` (${pendingRequests.length})` : ""}
              </Text>
            </Pressable>
          </View>
        )}

        {activeTab === "decidir" ? (
          pendingLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
          ) : pendingRequests.length === 0 ? (
            <AsaEmptyState
              title="Nada para decidir agora 👍"
              subtitle="Todas as solicitações da equipe já foram processadas. Boa gestão!"
              pose="feliz"
            />
          ) : (
            <View style={{ paddingHorizontal: 16, gap: 10 }}>
              {pendingRequests.map((req) => (
                <View key={req.id} style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, gap: 8 }}>
                  <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 14 }}>
                    {REQUEST_TYPE_LABELS[req.type] ?? req.type}
                  </Text>
                  {req.targetDates && req.targetDates.length > 0 && (
                    <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                      {req.targetDates.map(formatDate).join(", ")}
                    </Text>
                  )}
                  {(req as any).reason && (
                    <Text style={{ color: colors.mutedForeground, fontSize: 13 }} numberOfLines={2}>
                      {(req as any).reason}
                    </Text>
                  )}
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                    <Pressable
                      style={{ flex: 1, backgroundColor: "#16A34A", borderRadius: 8, paddingVertical: 9, alignItems: "center" }}
                      onPress={() =>
                        Alert.alert("Aprovar?", "Confirmar aprovação desta solicitação?", [
                          { text: "Cancelar", style: "cancel" },
                          { text: "Aprovar", onPress: () => decideMutation.mutate({ id: req.id, data: { decision: "APPROVED" } as any }) },
                        ])
                      }
                    >
                      <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}>Aprovar</Text>
                    </Pressable>
                    <Pressable
                      style={{ flex: 1, backgroundColor: "#DC2626", borderRadius: 8, paddingVertical: 9, alignItems: "center" }}
                      onPress={() =>
                        Alert.alert("Negar?", "Confirmar negação desta solicitação?", [
                          { text: "Cancelar", style: "cancel" },
                          { text: "Negar", style: "destructive", onPress: () => decideMutation.mutate({ id: req.id, data: { decision: "DENIED" } as any }) },
                        ])
                      }
                    >
                      <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}>Negar</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          )
        ) : isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : requests.length === 0 ? (
          <AsaEmptyState
            title="Sem solicitações por aqui 📋"
            subtitle={"Precisou de folga ou quer trocar uma escala? Toque em \"Nova\" e eu te ajudo a registrar!"}
            pose="feliz"
          />
        ) : (
          <>
            {/* Aguardando alternativa */}
            {waiting.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
                  AGUARDANDO SUA RESPOSTA
                </Text>
                {waiting.map((req) => (
                  <RequestCard
                    key={req.id}
                    req={req}
                    colors={colors}
                    onAccept={() => respondToAlternative(req, true)}
                    onReject={() => respondToAlternative(req, false)}
                  />
                ))}
              </View>
            )}

            {/* Pendentes */}
            {pending.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
                  PENDENTES
                </Text>
                {pending.map((req) => (
                  <RequestCard key={req.id} req={req} colors={colors} />
                ))}
              </View>
            )}

            {/* Resolvidas */}
            {resolved.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
                  RESOLVIDAS
                </Text>
                {resolved.map((req) => (
                  <RequestCard key={req.id} req={req} colors={colors} />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Modal: nova solicitação */}
      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              Nova Solicitação
            </Text>
            <Pressable onPress={() => setShowCreate(false)}>
              <Feather name="x" size={22} color={colors.foreground} />
            </Pressable>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {/* Tipo */}
            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Tipo de solicitação</Text>
            <Pressable
              style={[styles.selectBox, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => setShowTypeSelector(true)}
            >
              <Text style={{ color: colors.foreground }}>{selectedTypeName}</Text>
              <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
            </Pressable>

            {/* Operação */}
            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Operação</Text>
            <Pressable
              style={[styles.selectBox, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => setShowOpSelector(true)}
            >
              <Text style={{ color: selectedOp ? colors.foreground : colors.mutedForeground }}>
                {selectedOp?.name ?? "Selecionar operação"}
              </Text>
              <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
            </Pressable>

            {/* Datas */}
            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>
              Datas (AAAA-MM-DD, separe por vírgula)
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
              value={datesText}
              onChangeText={setDatesText}
              placeholder="ex: 2025-07-10, 2025-07-11"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
            />

            {/* Motivo */}
            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>
              Motivo <Text style={{ color: colors.mutedForeground }}>(opcional)</Text>
            </Text>
            <TextInput
              style={[styles.input, styles.textarea, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
              value={reason}
              onChangeText={setReason}
              placeholder="Descreva o motivo da solicitação..."
              placeholderTextColor={colors.mutedForeground}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <Pressable
              style={[styles.submitButton, { backgroundColor: colors.primary }]}
              onPress={submitCreate}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.submitText}>Enviar Solicitação</Text>
              )}
            </Pressable>
          </ScrollView>
        </View>

        {/* Selector: tipo */}
        <Modal visible={showTypeSelector} transparent animationType="fade">
          <Pressable style={styles.overlay} onPress={() => setShowTypeSelector(false)}>
            <View style={[styles.selectorSheet, { backgroundColor: colors.card }]}>
              {REQUEST_TYPES.map((t) => (
                <TouchableOpacity
                  key={t.value}
                  style={[styles.selectorItem, { borderBottomColor: colors.border }]}
                  onPress={() => { setSelectedType(t.value); setShowTypeSelector(false); }}
                >
                  <Text style={[styles.selectorText, { color: colors.foreground }]}>{t.label}</Text>
                  {selectedType === t.value && (
                    <Feather name="check" size={16} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </Pressable>
        </Modal>

        {/* Selector: operação */}
        <Modal visible={showOpSelector} transparent animationType="fade">
          <Pressable style={styles.overlay} onPress={() => setShowOpSelector(false)}>
            <View style={[styles.selectorSheet, { backgroundColor: colors.card }]}>
              {operations.map((op) => (
                <TouchableOpacity
                  key={op.id}
                  style={[styles.selectorItem, { borderBottomColor: colors.border }]}
                  onPress={() => { setSelectedOperationId(op.id); setShowOpSelector(false); }}
                >
                  <Text style={[styles.selectorText, { color: colors.foreground }]}>{op.name}</Text>
                  {selectedOperationId === op.id && (
                    <Feather name="check" size={16} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </Pressable>
        </Modal>
      </Modal>
    </View>
  );
}

// ─── RequestCard ───────────────────────────────────────────────────────────────

function RequestCard({
  req,
  colors,
  onAccept,
  onReject,
}: {
  req: RequestItem;
  colors: ReturnType<typeof useColors>;
  onAccept?: () => void;
  onReject?: () => void;
}) {
  const statusColor = STATUS_COLORS[req.status] ?? { bg: "#F3F4F6", text: "#6B7280" };
  const isAlternative = req.status === "ALTERNATIVE_PROPOSED";

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.cardType, { color: colors.foreground }]}>
          {REQUEST_TYPE_LABELS[req.type] ?? req.type}
        </Text>
        <View style={[styles.badge, { backgroundColor: statusColor.bg }]}>
          <Text style={[styles.badgeText, { color: statusColor.text }]}>
            {REQUEST_STATUS_LABELS[req.status] ?? req.status}
          </Text>
        </View>
      </View>
      <Text style={[styles.cardMeta, { color: colors.mutedForeground }]}>
        {req.targetDates.map(formatDate).join(", ")}
      </Text>
      <Text style={[styles.cardMeta, { color: colors.mutedForeground }]}>
        {req.operationName}
      </Text>
      {req.reason ? (
        <Text style={[styles.cardReason, { color: colors.foreground }]} numberOfLines={2}>
          {req.reason}
        </Text>
      ) : null}

      {isAlternative && onAccept && onReject && (
        <View style={styles.actionRow}>
          <Pressable
            style={[styles.actionBtn, { backgroundColor: "#D1FAE5" }]}
            onPress={onAccept}
          >
            <Feather name="check" size={14} color="#065F46" />
            <Text style={[styles.actionBtnText, { color: "#065F46" }]}>Aceitar</Text>
          </Pressable>
          <Pressable
            style={[styles.actionBtn, { backgroundColor: "#FEE2E2" }]}
            onPress={onReject}
          >
            <Feather name="x" size={14} color="#991B1B" />
            <Text style={[styles.actionBtnText, { color: "#991B1B" }]}>Rejeitar</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { paddingTop: 16, paddingHorizontal: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  title: { fontSize: 22, fontWeight: "700" },
  newButton: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  newButtonText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  emptyWrap: { alignItems: "center", paddingTop: 60, gap: 10 },
  emptyText: { fontSize: 16, fontWeight: "500" },
  emptySubText: { fontSize: 13, textAlign: "center", maxWidth: 260 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8, marginBottom: 10 },
  card: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 10 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 },
  cardType: { fontSize: 14, fontWeight: "600", flex: 1, marginRight: 8 },
  cardMeta: { fontSize: 12, marginTop: 2 },
  cardReason: { fontSize: 13, marginTop: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: "600" },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 8, borderRadius: 8 },
  actionBtnText: { fontSize: 13, fontWeight: "600" },
  // Modal
  modal: { flex: 1 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, paddingTop: 60, borderBottomWidth: 1 },
  modalTitle: { fontSize: 18, fontWeight: "700" },
  modalBody: { padding: 20 },
  fieldLabel: { fontSize: 14, fontWeight: "600", marginBottom: 6, marginTop: 16 },
  selectBox: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  textarea: { height: 100, paddingTop: 12 },
  submitButton: { marginTop: 24, paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  submitText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  selectorSheet: { borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: 32, maxHeight: 400 },
  selectorItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  selectorText: { fontSize: 15 },
});
