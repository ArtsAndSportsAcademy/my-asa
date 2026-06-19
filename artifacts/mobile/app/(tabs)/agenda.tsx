import { Feather } from "@expo/vector-icons";
import { useListAgendaEvents, getListAgendaEventsQueryKey } from "@workspace/api-client-react";
import type { AgendaEvent } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import React, { useState, useCallback } from "react";
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

import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

const TYPE_LABELS: Record<string, string> = {
  SHOW: "Apresentação",
  REHEARSAL: "Ensaio",
  MEETING: "Reunião",
  OPERATIONAL_BLOCK: "Bloco Operacional",
  COLLECTIVE_VACATION: "Férias Coletivas",
};

const STATUS_LABELS: Record<string, string> = {
  CONFIRMED: "Confirmado",
  CANCELLED: "Cancelado",
  COMPLETED: "Realizado",
};

const STATUS_COLORS: Record<string, string> = {
  CONFIRMED: "#16A34A",
  CANCELLED: "#DC2626",
  COMPLETED: "#2563EB",
};

const TYPE_ICONS: Record<string, string> = {
  SHOW: "star",
  REHEARSAL: "music",
  MEETING: "users",
  OPERATIONAL_BLOCK: "briefcase",
  COLLECTIVE_VACATION: "sun",
};

type FilterStatus = "" | "CONFIRMED" | "CANCELLED" | "COMPLETED";

const FILTER_TABS: { label: string; value: FilterStatus }[] = [
  { label: "Todos", value: "" },
  { label: "Confirmados", value: "CONFIRMED" },
  { label: "Cancelados", value: "CANCELLED" },
  { label: "Realizados", value: "COMPLETED" },
];

export default function AgendaScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const auth = useAuth();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterStatus>("");

  const operationId = auth.roles.find((r) => r.operationId)?.operationId;

  const { data, isLoading, refetch } = useListAgendaEvents(
    { operationId, status: activeFilter || undefined },
    {
      query: {
        queryKey: getListAgendaEventsQueryKey({ operationId, status: activeFilter || undefined }),
        enabled: !!operationId,
      },
    }
  );

  const events: AgendaEvent[] = [...(data?.events ?? [])].sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingTop: insets.top + 8,
      paddingBottom: 12,
      paddingHorizontal: 20,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: { fontSize: 22, fontWeight: "700", color: colors.foreground },
    headerSub: { fontSize: 13, color: colors.mutedForeground, marginTop: 2 },
    filterRow: {
      flexDirection: "row",
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 8,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    filterChip: {
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    filterChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    filterText: { fontSize: 12, color: colors.foreground },
    filterTextActive: { color: "#FFFFFF" },
    list: { flex: 1 },
    empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 8 },
    emptyText: { fontSize: 15, color: colors.mutedForeground },
    emptySubText: { fontSize: 13, color: colors.mutedForeground },
    card: {
      marginHorizontal: 16,
      marginVertical: 6,
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
    },
    cardRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
    iconBox: {
      width: 38,
      height: 38,
      borderRadius: 10,
      backgroundColor: colors.muted,
      alignItems: "center",
      justifyContent: "center",
    },
    cardContent: { flex: 1 },
    cardTitle: { fontSize: 15, fontWeight: "600", color: colors.foreground },
    cardDate: { fontSize: 12, color: colors.mutedForeground, marginTop: 2 },
    cardMeta: { fontSize: 12, color: colors.mutedForeground, marginTop: 1 },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
    statusText: { fontSize: 11, fontWeight: "600", color: "#FFFFFF" },
  });

  if (!operationId) {
    return (
      <View style={[styles.container, styles.empty]}>
        <Feather name="alert-circle" size={40} color={colors.mutedForeground} />
        <Text style={styles.emptyText}>Sem operação ativa</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Agenda</Text>
        <Text style={styles.headerSub}>Consulta de eventos e apresentações</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={{ gap: 8, alignItems: "center" }}>
        {FILTER_TABS.map((tab) => (
          <Pressable
            key={tab.value}
            style={[styles.filterChip, activeFilter === tab.value && styles.filterChipActive]}
            onPress={() => setActiveFilter(tab.value)}
          >
            <Text style={[styles.filterText, activeFilter === tab.value && styles.filterTextActive]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {isLoading ? (
        <View style={styles.empty}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={events.length === 0 ? { flex: 1 } : { paddingBottom: insets.bottom + 90, paddingTop: 8 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
        >
          {events.length === 0 ? (
            <View style={styles.empty}>
              <Feather name="calendar" size={40} color={colors.mutedForeground} />
              <Text style={styles.emptyText}>Nenhum evento na agenda ainda.</Text>
              <Text style={styles.emptySubText}>Tente outro filtro ou aguarde novos eventos da operação.</Text>
            </View>
          ) : (
            events.map((event) => (
              <View key={event.id} style={styles.card}>
                <View style={styles.cardRow}>
                  <View style={styles.iconBox}>
                    <Feather name={(TYPE_ICONS[event.type] ?? "calendar") as any} size={18} color={colors.primary} />
                  </View>
                  <View style={styles.cardContent}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{event.title}</Text>
                    <Text style={styles.cardDate}>{formatDate(event.date)} {event.startTime ? `· ${event.startTime}` : ""}</Text>
                    {event.location ? <Text style={styles.cardMeta}>{event.location}</Text> : null}
                    <Text style={styles.cardMeta}>{TYPE_LABELS[event.type] ?? event.type}</Text>
                    {event.reason ? <Text style={[styles.cardMeta, { fontStyle: "italic" }]}>{event.reason}</Text> : null}
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[event.status] ?? "#6B7280" }]}>
                    <Text style={styles.statusText}>{STATUS_LABELS[event.status] ?? event.status}</Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}
