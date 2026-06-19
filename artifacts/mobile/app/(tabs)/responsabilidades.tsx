import { Feather } from "@expo/vector-icons";
import React, { useState, useCallback } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { customFetch } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Assignment {
  id: string;
  memberId: string;
  memberName: string;
  role: "PRIMARY" | "SECONDARY";
  substituteName: string | null;
  active: boolean;
}

interface Responsibility {
  id: string;
  title: string;
  description: string | null;
  category: string;
  operationName: string | null;
  assignments: Assignment[];
}

// ─── Config ───────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  "OPERAÇÃO":       { bg: "#F5F3FF", text: "#7C3AED" },
  "TREINAMENTO":    { bg: "#EFF6FF", text: "#2563EB" },
  "MANUTENÇÃO":     { bg: "#FFF7ED", text: "#EA580C" },
  "COMUNICAÇÃO":    { bg: "#F0FDF4", text: "#16A34A" },
  "ARTÍSTICO":      { bg: "#FDF2F8", text: "#DB2777" },
  "EQUIPAMENTOS":   { bg: "#FEFCE8", text: "#CA8A04" },
  "ADMINISTRATIVO": { bg: "#F9FAFB", text: "#4B5563" },
};

const MANAGER_ROLES = ["ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"];

// ─── Fetch ────────────────────────────────────────────────────────────────────

async function fetchResponsibilities(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString();
  const r = await customFetch(`/api/responsibilities${qs ? `?${qs}` : ""}`);
  if (!r.ok) throw new Error("Erro ao carregar responsabilidades");
  return r.json() as Promise<{ responsibilities: Responsibility[] }>;
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ResponsabilidadesScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { user } = useAuth();
  const isManager = MANAGER_ROLES.includes(user?.role ?? "");

  const [filter, setFilter] = useState<"all" | "unassigned" | "mine">("all");
  const [refreshing, setRefreshing] = useState(false);

  const params: Record<string, string> = {};
  if (filter === "unassigned") params.unassigned = "true";
  if (filter === "mine" && user?.id) params.memberId = user.id;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["responsibilities-mobile", filter, user?.id],
    queryFn: () => fetchResponsibilities(params),
  });

  const responsibilities = data?.responsibilities ?? [];

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  // Group by category
  const grouped: Record<string, Responsibility[]> = {};
  for (const r of responsibilities) {
    grouped[r.category] = grouped[r.category] ?? [];
    grouped[r.category].push(r);
  }

  const total = responsibilities.length;
  const uncovered = responsibilities.filter((r) => r.assignments.length === 0).length;
  const withOwner = total - uncovered;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, borderColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            <Feather name="users" size={20} color="#7C3AED" />
          </View>
          <View>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>Responsabilidades</Text>
            <Text style={[styles.headerSubtitle, { color: colors.mutedForeground }]}>Funções permanentes da operação</Text>
          </View>
        </View>
      </View>

      {/* Stats (managers only) */}
      {isManager && (
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statNumber, { color: "#7C3AED" }]}>{total}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Total</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statNumber, { color: "#16A34A" }]}>{withOwner}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Com dono</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statNumber, { color: "#DC2626" }]}>{uncovered}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Sem dono</Text>
          </View>
        </View>
      )}

      {/* Filter tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
        {(isManager
          ? [
              { key: "all", label: "Todas" },
              { key: "unassigned", label: "Sem responsável" },
              { key: "mine", label: "Minhas" },
            ]
          : [{ key: "mine", label: "Minhas" }]
        ).map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
            onPress={() => setFilter(f.key as typeof filter)}
          >
            <Text style={[styles.filterChipText, filter === f.key && styles.filterChipTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* List */}
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 32, paddingHorizontal: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7C3AED" />}
      >
        {isLoading && (
          <View style={styles.center}>
            <ActivityIndicator color="#7C3AED" />
          </View>
        )}

        {!isLoading && responsibilities.length === 0 && (
          <View style={styles.emptyState}>
            <Feather name="users" size={36} color={colors.mutedForeground} style={{ opacity: 0.3, marginBottom: 12 }} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              {filter === "unassigned" ? "Nenhuma responsabilidade descoberta" :
               filter === "mine" ? "Você não tem responsabilidades atribuídas" :
               "Nenhuma responsabilidade cadastrada"}
            </Text>
          </View>
        )}

        {Object.entries(grouped).map(([category, items]) => {
          const catColor = CATEGORY_COLORS[category] ?? { bg: "#F9FAFB", text: "#4B5563" };
          return (
            <View key={category} style={styles.categorySection}>
              <View style={styles.categoryHeader}>
                <View style={[styles.categoryBadge, { backgroundColor: catColor.bg }]}>
                  <Text style={[styles.categoryBadgeText, { color: catColor.text }]}>{category}</Text>
                </View>
                <Text style={[styles.categoryCount, { color: colors.mutedForeground }]}>{items.length}</Text>
              </View>
              {items.map((r) => (
                <ResponsibilityCard key={r.id} r={r} colors={colors} />
              ))}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ─── Responsibility Card ───────────────────────────────────────────────────────

function ResponsibilityCard({ r, colors }: { r: Responsibility; colors: ReturnType<typeof useColors> }) {
  const uncovered = r.assignments.length === 0;
  const primary = r.assignments.filter((a) => a.active && a.role === "PRIMARY");
  const secondary = r.assignments.filter((a) => a.active && a.role === "SECONDARY");

  return (
    <View style={[
      styles.card,
      { borderColor: uncovered ? "#FECACA" : colors.border, backgroundColor: uncovered ? "#FEF2F2" : colors.card },
    ]}>
      <View style={styles.cardRow}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={1}>{r.title}</Text>
        {uncovered && (
          <View style={styles.uncoveredBadge}>
            <Feather name="alert-circle" size={10} color="#DC2626" />
            <Text style={styles.uncoveredText}>Descoberta</Text>
          </View>
        )}
      </View>
      {r.description && (
        <Text style={[styles.cardDesc, { color: colors.mutedForeground }]} numberOfLines={2}>{r.description}</Text>
      )}
      {r.operationName && (
        <Text style={[styles.cardOp, { color: colors.mutedForeground }]}>{r.operationName}</Text>
      )}
      {r.assignments.filter((a) => a.active).length > 0 && (
        <View style={styles.assigneeRow}>
          {primary.map((a) => (
            <View key={a.id} style={styles.assigneePill}>
              <Feather name="user" size={10} color="#7C3AED" />
              <Text style={styles.assigneeName}>{a.memberName}</Text>
              {a.substituteName && <Text style={styles.substituteText}>· sub: {a.substituteName}</Text>}
            </View>
          ))}
          {secondary.map((a) => (
            <View key={a.id} style={[styles.assigneePill, styles.assigneePillSecondary]}>
              <Feather name="user" size={10} color="#2563EB" />
              <Text style={[styles.assigneeName, { color: "#2563EB" }]}>{a.memberName}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  headerIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: "#F5F3FF", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 20, fontWeight: "700" },
  headerSubtitle: { fontSize: 12, marginTop: 1 },
  statsRow: { flexDirection: "row", gap: 8, paddingHorizontal: 12, paddingVertical: 10 },
  statCard: { flex: 1, borderRadius: 10, borderWidth: 1, paddingVertical: 8, alignItems: "center" },
  statNumber: { fontSize: 20, fontWeight: "700" },
  statLabel: { fontSize: 10, marginTop: 1 },
  filterScroll: { maxHeight: 44 },
  filterContent: { flexDirection: "row", paddingHorizontal: 12, gap: 8, alignItems: "center", paddingVertical: 6 },
  filterChip: { borderRadius: 100, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: "#E5E7EB", backgroundColor: "transparent" },
  filterChipActive: { backgroundColor: "#7C3AED", borderColor: "#7C3AED" },
  filterChipText: { fontSize: 13, color: "#6B7280", fontWeight: "500" },
  filterChipTextActive: { color: "#fff" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60 },
  emptyState: { alignItems: "center", paddingTop: 80, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 15, fontWeight: "600", textAlign: "center", marginBottom: 6 },
  categorySection: { marginTop: 16 },
  categoryHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  categoryBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 100 },
  categoryBadgeText: { fontSize: 11, fontWeight: "700" },
  categoryCount: { fontSize: 11 },
  card: { borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 8 },
  cardRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6 },
  cardTitle: { fontSize: 14, fontWeight: "600", flex: 1 },
  cardDesc: { fontSize: 12, marginTop: 2, lineHeight: 16 },
  cardOp: { fontSize: 11, marginTop: 2, fontStyle: "italic" },
  uncoveredBadge: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#FEE2E2", borderRadius: 100, paddingHorizontal: 6, paddingVertical: 2, flexShrink: 0 },
  uncoveredText: { fontSize: 10, color: "#DC2626", fontWeight: "600" },
  assigneeRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 8 },
  assigneePill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#F5F3FF", borderRadius: 100, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: "#DDD6FE" },
  assigneePillSecondary: { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" },
  assigneeName: { fontSize: 11, fontWeight: "600", color: "#7C3AED" },
  substituteText: { fontSize: 10, color: "#9CA3AF" },
});
