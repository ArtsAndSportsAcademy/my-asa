import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
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

function MemoryCard({ item, colors }: { item: Memory; colors: ReturnType<typeof useColors> }) {
  const typeLabel: Record<string, string> = {
    PERSONAL: "👤 Pessoal",
    OPERATIONAL: "⚙️ Operacional",
    OFFICIAL: "📋 Oficial",
  };
  const date = new Date(item.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardEmoji}>🧠</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>{item.key}</Text>
          <Text style={[styles.cardDate, { color: colors.mutedForeground }]}>{typeLabel[item.type] ?? item.type} · {date}</Text>
        </View>
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
        const res = await fetch(`${base}/api/asa/memories?status=APPROVED`, { credentials: "include" });
        if (!res.ok) throw new Error("Erro ao carregar memórias");
        const data = await res.json() as Memory[];
        setMemories(Array.isArray(data) ? data : []);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setLoading(false);
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
              : "Nenhuma memória aprovada ainda.\nA ASA aprende com a equipe — pergunte algo novo a ela!"}
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
              : <MemoryCard item={item} colors={colors} />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
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
});
