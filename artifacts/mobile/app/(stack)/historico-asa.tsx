import { Feather } from "@expo/vector-icons";
import { customFetch } from "@workspace/api-client-react";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

function getBaseUrl(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}`;
  return "";
}

type Recognition = {
  id: string;
  type: string;
  title: string;
  message: string;
  publishedAt: string | null;
  createdAt: string;
};

type Memory = {
  id: string;
  type: string;
  key: string;
  value: string;
  createdAt: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "DISABLED";
};

const TYPE_EMOJI: Record<string, string> = {
  BIRTHDAY:       "🎂",
  ONE_YEAR:       "🎖️",
  TWO_YEARS:      "🥇",
  SIX_MONTHS:     "⭐",
  THREE_MONTHS:   "✨",
  TASK_COMPLETED: "✅",
  CUSTOM:         "🏆",
};

function RecognitionCard({ item, colors }: { item: Recognition; colors: ReturnType<typeof useColors> }) {
  const emoji = TYPE_EMOJI[item.type] ?? "🏆";
  const date = item.publishedAt
    ? new Date(item.publishedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
    : new Date(item.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardEmoji}>{emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>{item.title}</Text>
          <Text style={[styles.cardDate, { color: colors.mutedForeground }]}>{date}</Text>
        </View>
      </View>
      <Text style={[styles.cardMessage, { color: colors.foreground }]}>{item.message}</Text>
    </View>
  );
}

function MemoryCard({ item, colors, onEdit, onRemove, onToggle }: { item: Memory; colors: ReturnType<typeof useColors>; onEdit: (memory: Memory) => void; onRemove: (memory: Memory) => void; onToggle: (memory: Memory) => void }) {
  const typeLabel: Record<string, string> = {
    PERSONAL: "👤 Pessoal",
    OPERATIONAL: "⚙️ Operacional",
    OFFICIAL: "📋 Oficial",
  };
  const date = new Date(item.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  const isAlias = item.key.startsWith("ASA_COMMAND_ALIAS:");
  const title = isAlias ? `Atalho: ${item.key.slice("ASA_COMMAND_ALIAS:".length)}` : item.key;
  const learningType = isAlias ? "atalho" : "aprendizado";
  const statusLabel = item.status === "APPROVED" ? "Ativo" : item.status === "PENDING" ? "Aguardando aprovação" : item.status === "DISABLED" ? "Desativado" : "Rejeitado";

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardEmoji}>🧠</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>{title}</Text>
          <Text style={[styles.cardDate, { color: colors.mutedForeground }]}>{statusLabel} · {typeLabel[item.type] ?? item.type} · {date}</Text>
        </View>
        {(item.status === "APPROVED" || item.status === "DISABLED") && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${item.status === "APPROVED" ? "Desativar" : "Reativar"} ${learningType}`}
            onPress={() => onToggle(item)}
            hitSlop={10}
            style={styles.removeButton}
          >
            <Feather name={item.status === "APPROVED" ? "pause-circle" : "play-circle"} size={18} color={item.status === "APPROVED" ? colors.mutedForeground : colors.primary} />
          </Pressable>
        )}
        {isAlias && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Editar o atalho ${item.key.slice("ASA_COMMAND_ALIAS:".length)}`}
            onPress={() => onEdit(item)}
            hitSlop={10}
            style={styles.removeButton}
          >
            <Feather name="edit-2" size={17} color={colors.primary} />
          </Pressable>
        )}
        {isAlias && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remover o atalho ${item.key.slice("ASA_COMMAND_ALIAS:".length)}`}
            onPress={() => Alert.alert("Remover atalho?", "A ASA deixará de reconhecer esta frase.", [
              { text: "Manter", style: "cancel" },
              { text: "Remover", style: "destructive", onPress: () => onRemove(item) },
            ])}
            hitSlop={10}
            style={styles.removeButton}
          >
            <Feather name="trash-2" size={17} color={colors.destructive} />
          </Pressable>
        )}
      </View>
      <Text style={[styles.cardMessage, { color: colors.foreground }]}>{item.value}</Text>
    </View>
  );
}

type Tab = "reconhecimentos" | "memorias";

export default function HistoricoAsaScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("reconhecimentos");
  const [recognitions, setRecognitions] = useState<Recognition[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingMemory, setEditingMemory] = useState<Memory | null>(null);
  const [draftValue, setDraftValue] = useState("");
  const [savingMemory, setSavingMemory] = useState(false);

  const base = getBaseUrl();

  useEffect(() => {
    fetchData();
  }, [tab]);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      if (tab === "reconhecimentos") {
        const res = await fetch(`${base}/api/asa/recognitions`, { credentials: "include" });
        if (!res.ok) throw new Error("Erro ao carregar reconhecimentos");
        const data = await res.json() as { recognitions: Recognition[] };
        setRecognitions(data.recognitions ?? []);
      } else {
        const data = await customFetch<Memory[]>("/api/asa/memories?type=PERSONAL");
        setMemories(Array.isArray(data) ? data : []);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }

  async function removeMemory(memory: Memory) {
    try {
      await customFetch(`/api/asa/memories/${memory.id}`, { method: "DELETE" });
      setMemories((current) => current.filter((item) => item.id !== memory.id));
    } catch {
      setError("Não consegui remover esse atalho agora.");
    }
  }

  async function toggleMemory(memory: Memory) {
    const enabling = memory.status === "DISABLED";
    const isAlias = memory.key.startsWith("ASA_COMMAND_ALIAS:");
    const kind = isAlias ? "atalho" : "aprendizado";
    Alert.alert(`${enabling ? "Reativar" : "Desativar"} ${kind}?`, enabling
      ? `A ASA voltará a ${isAlias ? "reconhecer esta frase" : "usar este aprendizado"}.`
      : `O ${kind} continuará salvo, mas a ASA deixará de ${isAlias ? "reconhecer esta frase" : "usá-lo"}.`, [
      { text: "Cancelar", style: "cancel" },
      { text: enabling ? "Reativar" : "Desativar", style: enabling ? "default" : "destructive", onPress: async () => {
        try {
          const updated = await customFetch<Memory>(`/api/asa/memories/${memory.id}`, {
            method: "PATCH",
            body: JSON.stringify({ status: enabling ? "APPROVED" : "DISABLED" }),
          });
          setMemories((current) => current.map((item) => item.id === updated.id ? updated : item));
        } catch {
          setError("Não consegui alterar o estado desse aprendizado agora.");
        }
      } },
    ]);
  }

  function startEditingMemory(memory: Memory) {
    setEditingMemory(memory);
    setDraftValue(memory.value);
  }

  async function saveMemory() {
    if (!editingMemory || !draftValue.trim()) return;
    setSavingMemory(true);
    setError(null);
    try {
      const updated = await customFetch<Memory>(`/api/asa/memories/${editingMemory.id}`, {
        method: "PATCH",
        body: JSON.stringify({ value: draftValue.trim() }),
      });
      setMemories((current) => current.map((item) => item.id === updated.id ? updated : item));
      setEditingMemory(null);
    } catch {
      setError("Não consegui salvar essa memória agora.");
    } finally {
      setSavingMemory(false);
    }
  }

  const data = tab === "reconhecimentos" ? recognitions : memories;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Text style={[styles.backText, { color: colors.primary }]}>← Voltar</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Histórico ASA</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Tabs */}
      <View style={[styles.tabRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {(["reconhecimentos", "memorias"] as Tab[]).map((t) => (
          <Pressable
            key={t}
            style={[styles.tab, tab === t && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, { color: tab === t ? colors.primary : colors.mutedForeground }]}>
              {t === "reconhecimentos" ? "🏆 Reconhecimentos" : "🧠 Memórias"}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
          <Pressable onPress={fetchData} style={[styles.retryBtn, { backgroundColor: colors.primary }]}>
            <Text style={styles.retryText}>Tentar novamente</Text>
          </Pressable>
        </View>
      ) : data.length === 0 ? (
        <View style={styles.center}>
          <Text style={[styles.emptyEmoji]}>
            {tab === "reconhecimentos" ? "🏆" : "🧠"}
          </Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            {tab === "reconhecimentos"
              ? "Nenhum reconhecimento registrado ainda.\nA ASA cria reconhecimentos automaticamente ao detectar marcos da equipe."
              : "Nenhuma memória pessoal foi registrada ainda."}
          </Text>
        </View>
      ) : (
        <FlatList
          data={data as any[]}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100 }}
          renderItem={({ item }) =>
            tab === "reconhecimentos"
              ? <RecognitionCard item={item} colors={colors} />
              : <MemoryCard item={item} colors={colors} onEdit={startEditingMemory} onRemove={removeMemory} onToggle={toggleMemory} />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
      <Modal visible={!!editingMemory} transparent animationType="fade" onRequestClose={() => !savingMemory && setEditingMemory(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Editar atalho</Text>
            <Text style={[styles.modalHint, { color: colors.mutedForeground }]}>A frase do atalho permanece igual. Ao salvar, a ASA pedirá nova aprovação antes de usar o conteúdo editado.</Text>
            <TextInput
              accessibilityLabel="Destino do atalho"
              multiline
              maxLength={160}
              value={draftValue}
              onChangeText={setDraftValue}
              placeholder="Intenção que a ASA deve reconhecer"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.editor, { color: colors.foreground, borderColor: colors.border }]}
              textAlignVertical="top"
            />
            <View style={styles.modalActions}>
              <Pressable accessibilityRole="button" disabled={savingMemory} onPress={() => setEditingMemory(null)} style={styles.modalButton}>
                <Text style={{ color: colors.mutedForeground, fontWeight: "600" }}>Cancelar</Text>
              </Pressable>
              <Pressable accessibilityRole="button" disabled={savingMemory || !draftValue.trim()} onPress={saveMemory} style={[styles.modalButton, { backgroundColor: colors.primary }]}>
                {savingMemory ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveText}>Salvar</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 60 },
  backText: { fontSize: 15, fontWeight: "500" },
  headerTitle: { fontSize: 17, fontWeight: "700" },
  tabRow: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
  },
  tabText: { fontSize: 14, fontWeight: "600" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  errorText: { fontSize: 14, textAlign: "center", marginBottom: 12 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  retryText: { color: "#fff", fontWeight: "600" },
  card: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    marginBottom: 12,
    gap: 8,
  },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  cardEmoji: { fontSize: 24, marginTop: 2 },
  cardTitle: { fontSize: 15, fontWeight: "600", lineHeight: 20 },
  cardDate: { fontSize: 12, marginTop: 2 },
  cardMessage: { fontSize: 14, lineHeight: 20 },
  removeButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  modalBackdrop: { flex: 1, justifyContent: "center", padding: 20, backgroundColor: "rgba(0,0,0,0.5)" },
  modalContent: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 18, gap: 12 },
  modalTitle: { fontSize: 18, fontWeight: "700" },
  modalHint: { fontSize: 13, lineHeight: 19 },
  editor: { minHeight: 110, maxHeight: 220, borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, padding: 12, fontSize: 15, lineHeight: 21 },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10 },
  modalButton: { minWidth: 88, minHeight: 40, alignItems: "center", justifyContent: "center", borderRadius: 8, paddingHorizontal: 14 },
  saveText: { color: "#fff", fontWeight: "700" },
});
