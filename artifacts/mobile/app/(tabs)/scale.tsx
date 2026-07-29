import { Feather } from "@expo/vector-icons";
import {
  useListMyAllocations,
  getListMyAllocationsQueryKey,
  useListFolgas,
  getListFolgasQueryKey,
} from "@workspace/api-client-react";
import type { MyAllocation } from "@workspace/api-client-react";

// MyAllocation now includes operationId, operationName and RECURRING_ACTIVITY status.
type AllocationWithOp = MyAllocation;
import { useQueryClient } from "@tanstack/react-query";
import React, { useState, useCallback, useMemo } from "react";
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
import { useRouter } from "expo-router";

import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { AsaEmptyState } from "@/components/AsaEmptyState";

import { SCALE_STATUS_LABELS } from "@/lib/operational-constants";

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
  NO_SHOW:     "Folga",
  RECESSO:     "Recesso",
  AFASTAMENTO: "Afastamento",
  RESTRICAO:   "Restrição",
  OUTRO:       "Outro",
};

// Old model: week runs Thursday → Wednesday
const WEEKDAY_LABELS = ["QUI", "SEX", "SÁB", "DOM", "SEG", "TER", "QUA"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatShort(dateStr: string): string {
  const [, month, day] = dateStr.split("-");
  return `${day}/${month}`;
}

function formatTime(timeStr: string | null | undefined): string {
  if (!timeStr) return "";
  return timeStr.slice(0, 5);
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function thursdayOf(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const dow = d.getDay(); // Thursday=4
  const diff = (dow - 4 + 7) % 7;
  d.setDate(d.getDate() - diff);
  return d.toISOString().slice(0, 10);
}

function folgaTypeOn(date: string, folgas: FolgaItem[]): string | null {
  const f = folgas.find(
    (x) => x.status === "ACTIVE" && x.startDate <= date && date <= x.endDate
  );
  return f ? f.type : null;
}

// ─── Day row ───────────────────────────────────────────────────────────────────

function DayRow({
  label,
  date,
  entries,
  folgaType,
  colors,
  onOpenEvent,
  showOp,
}: {
  label: string;
  date: string;
  entries: AllocationWithOp[];
  folgaType: string | null;
  colors: ReturnType<typeof useColors>;
  onOpenEvent: (agendaEventId: string) => void;
  showOp: boolean;
}) {
  const hasEntries = entries.length > 0;
  return (
    <View style={[styles.dayRow, { borderBottomColor: colors.border }]}>
      <View style={styles.dayPill}>
        <Text style={[styles.dayLabel, { color: colors.mutedForeground }]}>{label}</Text>
        <Text style={[styles.dayDate, { color: colors.foreground }]}>{formatShort(date)}</Text>
      </View>

      <View style={styles.dayBody}>
        {folgaType && (
          <View style={[styles.folgaBadge, { backgroundColor: "#dcfce7" }]}>
            <Text style={styles.folgaBadgeText}>
              🌴 {FOLGA_TYPE_LABELS[folgaType] ?? folgaType}
            </Text>
          </View>
        )}

        {hasEntries ? (
          entries.map((e) => {
            const isRecurring = e.status === "RECURRING_ACTIVITY";
            const canOpenBook = !!e.agendaEventId;
            return (
              <Pressable
                key={e.id}
                onPress={canOpenBook ? () => onOpenEvent(e.agendaEventId!) : undefined}
                style={({ pressed }) => [
                  styles.entry,
                  {
                    backgroundColor: colors.card,
                    borderColor: isRecurring ? colors.border : colors.border,
                    opacity: pressed && canOpenBook ? 0.7 : 1,
                  },
                ]}
              >
                <View style={styles.entryHeader}>
                  <Text
                    style={[styles.entryTitle, { color: colors.foreground, flex: 1 }]}
                    numberOfLines={1}
                  >
                    {e.eventTitle ?? "Escala"}
                  </Text>
                  {canOpenBook && (
                    <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                  )}
                </View>
                <View style={styles.entryMeta}>
                  {e.eventStartTime && (
                    <View style={styles.metaItem}>
                      <Feather name="clock" size={11} color={colors.mutedForeground} />
                      <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                        {formatTime(e.eventStartTime)}
                        {e.eventEndTime ? ` — ${formatTime(e.eventEndTime)}` : ""}
                      </Text>
                    </View>
                  )}
                  {e.eventLocation && (
                    <View style={styles.metaItem}>
                      <Feather name="map-pin" size={11} color={colors.mutedForeground} />
                      <Text
                        style={[styles.metaText, { color: colors.mutedForeground }]}
                        numberOfLines={1}
                      >
                        {e.eventLocation}
                      </Text>
                    </View>
                  )}
                  {e.positionName && (
                    <View style={styles.metaItem}>
                      <Feather name="user-check" size={11} color={colors.primary} />
                      <Text style={[styles.metaText, { color: colors.primary }]}>
                        {e.positionName}
                      </Text>
                    </View>
                  )}
                  {isRecurring && (
                    <View style={styles.metaItem}>
                      <Feather name="repeat" size={11} color={colors.mutedForeground} />
                      <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                        Recorrente
                      </Text>
                    </View>
                  )}
                  {showOp && e.operationName && (
                    <View style={styles.metaItem}>
                      <Feather name="briefcase" size={11} color="#2563eb" />
                      <Text style={[styles.metaText, { color: "#2563eb" }]}>
                        {e.operationName}
                      </Text>
                    </View>
                  )}
                </View>
                {canOpenBook && (
                  <Text style={[styles.entryHint, { color: colors.primary }]}>
                    Ver Livro do Dia →
                  </Text>
                )}
              </Pressable>
            );
          })
        ) : (
          !folgaType && (
            <Text style={[styles.emptyDay, { color: colors.mutedForeground }]}>Sem escala</Text>
          )
        )}
      </View>
    </View>
  );
}

// ─── Week card ─────────────────────────────────────────────────────────────────

function WeekCard({
  weekStart,
  allocations,
  folgas,
  colors,
  onOpenEvent,
  showOp,
}: {
  weekStart: string;
  allocations: AllocationWithOp[];
  folgas: FolgaItem[];
  colors: ReturnType<typeof useColors>;
  onOpenEvent: (agendaEventId: string) => void;
  showOp: boolean;
}) {
  const weekEnd = addDays(weekStart, 6);

  const byDate = useMemo(() => {
    const m = new Map<string, AllocationWithOp[]>();
    for (const a of allocations) {
      if (!a.eventDate) continue;
      const list = m.get(a.eventDate) ?? [];
      list.push(a);
      m.set(a.eventDate, list);
    }
    for (const list of m.values()) {
      list.sort((x, y) =>
        (x.eventStartTime ?? "").localeCompare(y.eventStartTime ?? "")
      );
    }
    return m;
  }, [allocations]);

  const status = allocations.find((a) => a.scaleStatus)?.scaleStatus ?? null;

  return (
    <View style={[styles.weekCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.weekHeader}>
        <View style={styles.weekHeaderLeft}>
          <Feather name="calendar" size={15} color={colors.primary} />
          <Text style={[styles.weekTitle, { color: colors.foreground }]}>
            Escala {formatShort(weekStart)} a {formatShort(weekEnd)}
          </Text>
        </View>
        {status && (
          <View style={[styles.statusBadge, { backgroundColor: colors.muted }]}>
            <Text style={[styles.statusText, { color: colors.mutedForeground }]}>
              {SCALE_STATUS_LABELS[status] ?? status}
            </Text>
          </View>
        )}
      </View>

      <View>
        {WEEKDAY_LABELS.map((label, i) => {
          const date = addDays(weekStart, i);
          return (
            <DayRow
              key={date}
              label={label}
              date={date}
              entries={byDate.get(date) ?? []}
              folgaType={folgaTypeOn(date, folgas)}
              colors={colors}
              onOpenEvent={onOpenEvent}
              showOp={showOp}
            />
          );
        })}
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ScaleScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const auth = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const openEvent = useCallback(
    (agendaEventId: string) => {
      router.push({
        pathname: "/(tabs)/daily-book",
        params: { eventId: agendaEventId, eventNonce: String(Date.now()) },
      });
    },
    [router]
  );
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterValue>("upcoming");

  const userId = auth.user?.id;

  const queryParams = {};

  const { data, isLoading, refetch } = useListMyAllocations(queryParams, {
    query: {
      queryKey: getListMyAllocationsQueryKey(queryParams),
      enabled: !!userId,
    },
  });

  const folgaParams = {
    ...(userId ? { userId } : {}),
    status: "ACTIVE",
  };
  const { data: folgaData } = useListFolgas(folgaParams as any, {
    query: {
      queryKey: getListFolgasQueryKey(folgaParams as any),
      enabled: !!userId,
    },
  });
  const activeFolgas = useMemo<FolgaItem[]>(
    () => ((folgaData as any)?.folgas as FolgaItem[] | undefined) ?? [],
    [folgaData]
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({
      queryKey: getListMyAllocationsQueryKey(queryParams),
    });
    await refetch();
    setRefreshing(false);
  }, [queryClient, refetch]);

  const allAllocations = useMemo<AllocationWithOp[]>(
    () => (data?.allocations as AllocationWithOp[] | undefined) ?? [],
    [data]
  );
  const isMultiOp = useMemo(
    () => new Set(allAllocations.map((a) => a.operationId).filter(Boolean)).size > 1,
    [allAllocations]
  );

  // Group into weeks (Thu→Wed); inject folga-only weeks too.
  const weeks = useMemo(() => {
    const byWeek = new Map<string, AllocationWithOp[]>();
    for (const a of allAllocations) {
      if (!a.eventDate) continue;
      const ws = thursdayOf(a.eventDate);
      const list = byWeek.get(ws) ?? [];
      list.push(a);
      byWeek.set(ws, list);
    }
    for (const f of activeFolgas) {
      if (f.status !== "ACTIVE") continue;
      let cursor = thursdayOf(f.startDate);
      while (cursor <= f.endDate) {
        if (!byWeek.has(cursor)) byWeek.set(cursor, []);
        cursor = addDays(cursor, 7);
      }
    }
    return Array.from(byWeek.entries())
      .map(([weekStart, allocations]) => ({ weekStart, allocations }))
      .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  }, [allAllocations, activeFolgas]);

  const today = new Date().toISOString().slice(0, 10);
  const displayedWeeks =
    activeFilter === "upcoming"
      ? weeks.filter((w) => addDays(w.weekStart, 6) >= today)
      : weeks;

  const activeFolgaCount = useMemo(
    () => activeFolgas.filter((f) => f.endDate >= today).length,
    [activeFolgas, today]
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
          {allAllocations.length} entrada{allAllocations.length === 1 ? "" : "s"} no total
          {activeFolgaCount > 0 && ` · 🌴 ${activeFolgaCount} folga${activeFolgaCount > 1 ? "s" : ""} ativa${activeFolgaCount > 1 ? "s" : ""}`}
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
        ) : displayedWeeks.length === 0 ? (
          <AsaEmptyState
            title={activeFilter === "upcoming" ? "Nenhuma escala futura ainda 📅" : "Nenhuma escala registrada ainda 📅"}
            subtitle={activeFilter === "upcoming"
              ? "Quando o supervisor publicar sua escala, cada semana aparece aqui dia a dia!"
              : "Você ainda não foi alocado em nenhuma escala. Fique ligado! 😊"}
            pose="planejando"
          />
        ) : (
          displayedWeeks.map((w) => (
            <WeekCard
              key={w.weekStart}
              weekStart={w.weekStart}
              allocations={w.allocations}
              folgas={activeFolgas}
              colors={colors}
              onOpenEvent={openEvent}
              showOp={isMultiOp}
            />
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

  // Week card
  weekCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
  weekHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  weekHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
  weekTitle: { fontSize: 14, fontWeight: "700" },
  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: "600" },

  // Day row
  dayRow: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dayPill: { width: 48, alignItems: "center" },
  dayLabel: { fontSize: 10, fontWeight: "700" },
  dayDate: { fontSize: 12, fontWeight: "600", marginTop: 1 },
  dayBody: { flex: 1, gap: 6 },
  emptyDay: { fontSize: 12, paddingVertical: 2 },

  folgaBadge: {
    alignSelf: "flex-start",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  folgaBadgeText: { fontSize: 11, fontWeight: "600", color: "#16a34a" },

  // Entry
  entry: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  entryHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  entryTitle: { fontSize: 14, fontWeight: "600" },
  entryMeta: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4 },
  entryHint: { fontSize: 11, fontWeight: "600", marginTop: 6 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 11 },
});
