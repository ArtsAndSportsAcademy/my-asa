import { Feather } from "@expo/vector-icons";
import {
  useListMyAllocations,
  getListMyAllocationsQueryKey,
} from "@workspace/api-client-react";
import type { MyAllocation } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import React, { useState, useCallback } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

import {
  ALLOCATION_STATUS_LABELS,
  ALLOCATION_STATUS_COLORS,
  SCALE_STATUS_LABELS,
  EVENT_TYPE_ICONS,
} from "@/lib/operational-constants";

type FilterValue = "upcoming" | "all";

const FILTER_TABS: { label: string; value: FilterValue }[] = [
  { label: "Próximas", value: "upcoming" },
  { label: "Todas", value: "all" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

function formatTime(timeStr: string | null | undefined): string {
  if (!timeStr) return "";
  return timeStr.slice(0, 5);
}

function isUpcoming(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const eventDate = new Date(dateStr + "T00:00:00");
  return eventDate >= today;
}

// ─── Allocation Card ──────────────────────────────────────────────────────────

function AllocationCard({ alloc, colors }: { alloc: MyAllocation; colors: ReturnType<typeof useColors> }) {
  const iconName = EVENT_TYPE_ICONS[alloc.eventType ?? ""] ?? "calendar";
  const statusColor = ALLOCATION_STATUS_COLORS[alloc.status] ?? "#6B7280";

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      {/* Date pill + status */}
      <View style={styles.cardHeader}>
        <View style={[styles.datePill, { backgroundColor: colors.primary + "15" }]}>
          <Text style={[styles.datePillText, { color: colors.primary }]}>
            {formatDate(alloc.eventDate)}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + "20" }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>
            {ALLOCATION_STATUS_LABELS[alloc.status] ?? alloc.status}
          </Text>
        </View>
      </View>

      {/* Event info */}
      <View style={styles.cardBody}>
        <View style={styles.iconRow}>
          <Feather name={iconName as any} size={14} color={colors.mutedForeground} />
          <Text style={[styles.eventTitle, { color: colors.foreground }]} numberOfLines={1}>
            {alloc.eventTitle ?? "Evento"}
          </Text>
        </View>

        {/* Time + Location */}
        {(alloc.eventStartTime || alloc.eventLocation) && (
          <View style={styles.metaRow}>
            {alloc.eventStartTime && (
              <View style={styles.metaItem}>
                <Feather name="clock" size={12} color={colors.mutedForeground} />
                <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                  {formatTime(alloc.eventStartTime)}
                  {alloc.eventEndTime ? ` — ${formatTime(alloc.eventEndTime)}` : ""}
                </Text>
              </View>
            )}
            {alloc.eventLocation && (
              <View style={styles.metaItem}>
                <Feather name="map-pin" size={12} color={colors.mutedForeground} />
                <Text style={[styles.metaText, { color: colors.mutedForeground }]} numberOfLines={1}>
                  {alloc.eventLocation}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Position */}
        {alloc.positionName && (
          <View style={styles.positionRow}>
            <Feather name="user-check" size={12} color={colors.primary} />
            <Text style={[styles.positionText, { color: colors.primary }]}>
              {alloc.positionName}
            </Text>
          </View>
        )}

        {/* Scale info */}
        {alloc.scaleTitle && (
          <Text style={[styles.scaleLabel, { color: colors.mutedForeground }]} numberOfLines={1}>
            Escala: {alloc.scaleTitle}
            {alloc.scaleStatus ? ` · ${SCALE_STATUS_LABELS[alloc.scaleStatus] ?? alloc.scaleStatus}` : ""}
          </Text>
        )}
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ScaleScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const auth = useAuth();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterValue>("upcoming");

  const operationId = auth.roles.find((r) => r.operationId)?.operationId;

  const queryParams = { operationId };

  const { data, isLoading, refetch } = useListMyAllocations(queryParams, {
    query: {
      queryKey: getListMyAllocationsQueryKey(queryParams),
      enabled: !!operationId,
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({
      queryKey: getListMyAllocationsQueryKey(queryParams),
    });
    await refetch();
    setRefreshing(false);
  }, [queryClient, refetch]);

  const allAllocations = data?.allocations ?? [];
  const displayed = activeFilter === "upcoming"
    ? allAllocations.filter((a) => isUpcoming(a.eventDate))
    : allAllocations;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 12,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Minha Escala</Text>
        <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
          {allAllocations.length} alocaç{allAllocations.length === 1 ? "ão" : "ões"} no total
        </Text>

        {/* Filter tabs */}
        <View style={[styles.filterBar, { backgroundColor: colors.muted }]}>
          {FILTER_TABS.map((tab) => (
            <View
              key={tab.value}
              style={[
                styles.filterTab,
                activeFilter === tab.value && {
                  backgroundColor: colors.background,
                  shadowColor: "#000",
                  shadowOpacity: 0.06,
                  shadowRadius: 3,
                  shadowOffset: { width: 0, height: 1 },
                  elevation: 2,
                },
              ]}
            >
              <Text
                onPress={() => setActiveFilter(tab.value)}
                style={[
                  styles.filterTabText,
                  { color: activeFilter === tab.value ? colors.foreground : colors.mutedForeground },
                ]}
              >
                {tab.label}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : displayed.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="calendar" size={36} color={colors.mutedForeground} style={{ opacity: 0.4 }} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              {activeFilter === "upcoming" ? "Nenhuma alocação futura na sua escala" : "Nenhuma alocação registrada ainda"}
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
              {activeFilter === "upcoming"
                ? "Você não tem escalas futuras no momento."
                : "Você ainda não foi alocado em nenhuma escala."}
            </Text>
          </View>
        ) : (
          displayed.map((alloc) => (
            <AllocationCard key={alloc.id} alloc={alloc} colors={colors} />
          ))
        )}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 24, fontWeight: "700", marginBottom: 2 },
  headerSub: { fontSize: 13, marginBottom: 12 },
  filterBar: {
    flexDirection: "row",
    borderRadius: 10,
    padding: 3,
    marginBottom: 4,
  },
  filterTab: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 6,
    alignItems: "center",
  },
  filterTabText: { fontSize: 13, fontWeight: "500" },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 12 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60 },
  emptyState: {
    alignItems: "center",
    paddingTop: 60,
    gap: 8,
  },
  emptyTitle: { fontSize: 16, fontWeight: "600" },
  emptySubtitle: { fontSize: 13, textAlign: "center", maxWidth: 260 },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
  },
  datePill: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  datePillText: { fontSize: 12, fontWeight: "600" },
  statusBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusText: { fontSize: 11, fontWeight: "600" },
  cardBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 5,
  },
  iconRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  eventTitle: { fontSize: 15, fontWeight: "600", flex: 1 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 2 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 12 },
  positionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 4,
  },
  positionText: { fontSize: 13, fontWeight: "600" },
  scaleLabel: { fontSize: 11, marginTop: 2 },
});
