import { Feather } from "@expo/vector-icons";
import {
  useListMyAllocations,
  getListMyAllocationsQueryKey,
  useListFolgas,
} from "@workspace/api-client-react";
import type { MyAllocation } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import React, { useState, useCallback, useMemo } from "react";
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
import { AsaEmptyState } from "@/components/AsaEmptyState";

import {
  ALLOCATION_STATUS_LABELS,
  ALLOCATION_STATUS_COLORS,
  SCALE_STATUS_LABELS,
  EVENT_TYPE_ICONS,
} from "@/lib/operational-constants";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FolgaItem {
  id: string;
  userId: string;
  type: string;
  startDate: string;
  endDate: string;
  status: string;
  notes?: string | null;
}

type FilterValue = "upcoming" | "all";

const FILTER_TABS: { label: string; value: FilterValue }[] = [
  { label: "Próximas", value: "upcoming" },
  { label: "Todas", value: "all" },
];

const FOLGA_TYPE_LABELS: Record<string, string> = {
  DAY_OFF:     "Folga",
  NO_SHOW:     "No-show",
  RECESSO:     "Recesso",
  AFASTAMENTO: "Afastamento",
  RESTRICAO:   "Restrição",
  OUTRO:       "Outro",
};

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

function isDateInFolga(date: string, folgas: FolgaItem[]): boolean {
  return folgas.some(
    (f) => f.status === "ACTIVE" && f.startDate <= date && date <= f.endDate
  );
}

// ─── Folga Card ───────────────────────────────────────────────────────────────

function FolgaCard({ folga, colors }: { folga: FolgaItem; colors: ReturnType<typeof useColors> }) {
  const isSingleDay = folga.startDate === folga.endDate;
  const periodoLabel = isSingleDay
    ? formatDate(folga.startDate)
    : `${formatDate(folga.startDate)} — ${formatDate(folga.endDate)}`;

  return (
    <View style={[styles.folgaCard, { backgroundColor: colors.card, borderColor: "#86efac" }]}>
      <View style={styles.folgaHeader}>
        <Text style={styles.folgaEmoji}>🌴</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.folgaTitle, { color: "#16a34a" }]}>
            Você está de folga neste período
          </Text>
          <Text style={[styles.folgaMeta, { color: "#15803d" }]}>
            {FOLGA_TYPE_LABELS[folga.type] ?? folga.type} · {periodoLabel}
          </Text>
        </View>
      </View>
      {folga.notes && (
        <Text style={[styles.folgaNotes, { color: "#166534" }]} numberOfLines={2}>
          {folga.notes}
        </Text>
      )}
    </View>
  );
}

// ─── Allocation Card ──────────────────────────────────────────────────────────

function AllocationCard({
  alloc,
  colors,
  hasFolga,
}: {
  alloc: MyAllocation;
  colors: ReturnType<typeof useColors>;
  hasFolga?: boolean;
}) {
  const iconName = EVENT_TYPE_ICONS[alloc.eventType ?? ""] ?? "calendar";
  const statusColor = ALLOCATION_STATUS_COLORS[alloc.status] ?? "#6B7280";

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      {/* Date pill + status + optional folga indicator */}
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <View style={[styles.datePill, { backgroundColor: colors.primary + "15" }]}>
            <Text style={[styles.datePillText, { color: colors.primary }]}>
              {formatDate(alloc.eventDate)}
            </Text>
          </View>
          {hasFolga && (
            <View style={[styles.folgaBadge, { backgroundColor: "#dcfce7" }]}>
              <Text style={styles.folgaBadgeText}>🌴 Folga</Text>
            </View>
          )}
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
  const userId = auth.user?.id;
  const userRole = auth.roles[0]?.role;
  const isManager = userRole === "ADMIN" || userRole === "SUPERVISOR_A" || userRole === "SUPERVISOR_B";

  const queryParams = { operationId };

  const { data, isLoading, refetch } = useListMyAllocations(queryParams, {
    query: {
      queryKey: getListMyAllocationsQueryKey(queryParams),
      enabled: !!operationId,
    },
  });

  // Fetch current user's active folgas
  const folgaParams = {
    ...(isManager && operationId ? { operationId } : {}),
    ...(userId ? { userId } : {}),
    status: "ACTIVE",
  };
  const { data: folgaData } = useListFolgas(folgaParams as any, {
    query: { enabled: !!userId },
  });
  const activeFolgas = useMemo<FolgaItem[]>(
    () => ((folgaData as any)?.folgas as FolgaItem[] | undefined) ?? [],
    [folgaData]
  );

  // Upcoming active folgas (end date >= today or start date >= today)
  const today = new Date().toISOString().slice(0, 10);
  const upcomingFolgas = useMemo(
    () => activeFolgas.filter((f) => f.endDate >= today),
    [activeFolgas, today]
  );

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

  // Folgas that have no allocations on any day in their range (pure rest days)
  const allocationDates = useMemo(
    () => new Set(allAllocations.map((a) => a.eventDate).filter(Boolean)),
    [allAllocations]
  );

  const pureFolgas = useMemo(
    () => upcomingFolgas.filter((f) => {
      // Check if there's any allocation overlapping this folga's range
      for (const d of allocationDates) {
        if (d && f.startDate <= d && d <= f.endDate) return false;
      }
      return true;
    }),
    [upcomingFolgas, allocationDates]
  );

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
          {upcomingFolgas.length > 0 && ` · 🌴 ${upcomingFolgas.length} folga${upcomingFolgas.length > 1 ? "s" : ""} ativa${upcomingFolgas.length > 1 ? "s" : ""}`}
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
        ) : (
          <>
            {/* Pure folga cards — rest days with no allocations */}
            {activeFilter === "upcoming" && pureFolgas.map((f) => (
              <FolgaCard key={f.id} folga={f} colors={colors} />
            ))}

            {/* Allocation cards with folga indicators */}
            {displayed.length === 0 && pureFolgas.length === 0 ? (
              <AsaEmptyState
                title={activeFilter === "upcoming" ? "Nenhuma escala futura ainda 📅" : "Nenhuma escala registrada ainda 📅"}
                subtitle={activeFilter === "upcoming"
                  ? "Quando o supervisor publicar sua escala, eu apareço aqui com tudo organizado!"
                  : "Você ainda não foi alocado em nenhuma escala. Fique ligado! 😊"}
              />
            ) : (
              displayed.map((alloc) => (
                <AllocationCard
                  key={alloc.id}
                  alloc={alloc}
                  colors={colors}
                  hasFolga={isDateInFolga(alloc.eventDate ?? "", activeFolgas)}
                />
              ))
            )}
          </>
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

  // Folga Card
  folgaCard: {
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 14,
    gap: 6,
  },
  folgaHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  folgaEmoji: { fontSize: 20, marginTop: 1 },
  folgaTitle: { fontSize: 14, fontWeight: "700" },
  folgaMeta: { fontSize: 12, marginTop: 2 },
  folgaNotes: { fontSize: 11, marginTop: 4, fontStyle: "italic", paddingLeft: 30 },

  // Allocation Card
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
  cardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  datePill: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  datePillText: { fontSize: 12, fontWeight: "600" },
  folgaBadge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  folgaBadgeText: { fontSize: 10, fontWeight: "600", color: "#16a34a" },
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
