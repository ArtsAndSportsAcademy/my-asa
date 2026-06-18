import { Feather } from "@expo/vector-icons";
import { useGetMyDay, getGetMyDayQueryKey } from "@workspace/api-client-react";
import type { MyDayActivity, MyDayResponse, MyDayNoticeItem } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

import {
  EVENT_TYPE_LABELS,
  EVENT_TYPE_ICONS,
  ALLOCATION_STATUS_LABELS,
  ALLOCATION_STATUS_COLORS,
} from "@/lib/operational-constants";

const REQUEST_TYPE_LABELS: Record<string, string> = {
  LEAVE: "Folga",
  ROLE_RESTRICTION: "Restrição de Papel",
  PHYSICAL_RESTRICTION: "Restrição Física",
  HEALTH_RESTRICTION: "Restrição de Saúde",
  SCHEDULE_CHANGE: "Mudança de Horário",
  SWAP: "Troca",
  OTHER: "Outro",
};

const REQUEST_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  ALTERNATIVE_PROPOSED: "Alternativa Proposta",
};

const DELIVERY_TYPE_ICONS: Record<string, string> = {
  READING: "book-open",
  VIDEO: "video",
  OPERATIONAL_UPDATE: "alert-circle",
  CHECKLIST: "check-square",
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

function isToday(dateStr: string): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return dateStr === today;
}

// ─── RepublishDelta Banner ─────────────────────────────────────────────────────

function RepublishDeltaBanner({ delta, colors }: { delta: Record<string, unknown>; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={[styles.deltaBanner, { backgroundColor: "#FEF3C7", borderColor: "#F59E0B" }]}>
      <View style={styles.deltaHeader}>
        <Feather name="alert-triangle" size={14} color="#B45309" />
        <Text style={styles.deltaTitle}>Republicação — O que mudou</Text>
      </View>
      {Object.entries(delta).map(([key, val]) => (
        <View key={key} style={styles.deltaRow}>
          <Text style={styles.deltaKey}>{key}:</Text>
          <Text style={styles.deltaVal}>{JSON.stringify(val)}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Activity Card ────────────────────────────────────────────────────────────

function ActivityCard({
  activity,
  colors,
  highlighted = false,
}: {
  activity: MyDayActivity;
  colors: ReturnType<typeof useColors>;
  highlighted?: boolean;
}) {
  const iconName = EVENT_TYPE_ICONS[activity.eventType ?? ""] ?? "calendar";
  const statusColor = ALLOCATION_STATUS_COLORS[activity.allocationStatus] ?? "#6B7280";
  const isRepublished = activity.scaleStatus === "REPUBLISHED" || activity.dailyBook?.status === "REPUBLISHED";
  const republishDelta = activity.dailyBook?.republishedDelta;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: highlighted ? colors.primary : colors.border,
          borderWidth: highlighted ? 2 : 1,
        },
      ]}
    >
      {/* Card Header */}
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          {highlighted && (
            <View style={[styles.immediatePill, { backgroundColor: colors.primary }]}>
              <Text style={styles.immediatePillText}>AGORA</Text>
            </View>
          )}
          <View style={[styles.datePill, { backgroundColor: colors.primary + "15" }]}>
            <Text style={[styles.datePillText, { color: colors.primary }]}>
              {isToday(activity.eventDate) ? "Hoje" : formatDate(activity.eventDate)}
            </Text>
          </View>
          {isRepublished && (
            <View style={[styles.republishedBadge, { backgroundColor: "#FEF3C7" }]}>
              <Feather name="refresh-cw" size={10} color="#B45309" />
              <Text style={[styles.republishedText, { color: "#B45309" }]}>Republicado</Text>
            </View>
          )}
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + "20" }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>
            {ALLOCATION_STATUS_LABELS[activity.allocationStatus] ?? activity.allocationStatus}
          </Text>
        </View>
      </View>

      {/* Card Body */}
      <View style={styles.cardBody}>
        <View style={styles.iconRow}>
          <Feather name={iconName as any} size={14} color={colors.mutedForeground} />
          <Text style={[styles.eventTitle, { color: colors.foreground }]} numberOfLines={1}>
            {activity.eventTitle}
          </Text>
        </View>

        {/* Time + location */}
        {(activity.eventStartTime || activity.eventLocation) && (
          <View style={styles.metaRow}>
            {activity.eventStartTime && (
              <View style={styles.metaItem}>
                <Feather name="clock" size={12} color={colors.mutedForeground} />
                <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                  {formatTime(activity.eventStartTime)}
                  {activity.eventEndTime ? ` — ${formatTime(activity.eventEndTime)}` : ""}
                </Text>
              </View>
            )}
            {activity.eventLocation && (
              <View style={styles.metaItem}>
                <Feather name="map-pin" size={12} color={colors.mutedForeground} />
                <Text style={[styles.metaText, { color: colors.mutedForeground }]} numberOfLines={1}>
                  {activity.eventLocation}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Position */}
        {activity.positionName && (
          <View style={styles.positionRow}>
            <Feather name="user-check" size={12} color={colors.primary} />
            <Text style={[styles.positionText, { color: colors.primary }]}>
              {activity.positionName}
            </Text>
          </View>
        )}

        {/* Operation / Group */}
        {(activity.operationName || activity.groupName) && (
          <View style={styles.metaItem}>
            <Feather name="briefcase" size={12} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
              {[activity.operationName, activity.groupName].filter(Boolean).join(" · ")}
            </Text>
          </View>
        )}

        {/* Daily book assignments */}
        {activity.dailyBook && activity.dailyBook.myAssignments.length > 0 && (
          <View style={[styles.dailyBookSection, { borderColor: colors.border }]}>
            <Text style={[styles.dailyBookLabel, { color: colors.mutedForeground }]}>
              Livro do Dia — v{activity.dailyBook.version}
            </Text>
            {activity.dailyBook.myAssignments.map((a) => (
              <Text key={a.assignmentId} style={[styles.assignmentText, { color: colors.foreground }]}>
                · {a.positionName}
              </Text>
            ))}
          </View>
        )}

        {/* Republish delta */}
        {isRepublished && republishDelta && Object.keys(republishDelta).length > 0 && (
          <RepublishDeltaBanner delta={republishDelta as Record<string, unknown>} colors={colors} />
        )}
      </View>
    </View>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ title, icon, colors }: { title: string; icon: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={styles.sectionHeader}>
      <Feather name={icon as any} size={14} color={colors.primary} />
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>
    </View>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function PendingNoticeCard({ notice, colors }: { notice: MyDayNoticeItem; colors: ReturnType<typeof useColors> }) {
  const urgColors: Record<string, { border: string; bg: string; text: string }> = {
    INFORMATIVE: { border: "#BFDBFE", bg: "#EFF6FF", text: "#1D4ED8" },
    IMPORTANT:   { border: "#FDE68A", bg: "#FFFBEB", text: "#B45309" },
    CRITICAL:    { border: "#FECACA", bg: "#FEF2F2", text: "#DC2626" },
  };
  const uc = urgColors[notice.urgency] ?? urgColors.INFORMATIVE;
  const isUnread = notice.recipientStatus !== "CONFIRMED" && notice.recipientStatus !== "VIEWED";
  return (
    <View style={[
      styles.pendingNoticeCard,
      { backgroundColor: uc.bg, borderColor: uc.border, borderLeftColor: uc.text },
    ]}>
      <View style={styles.pendingNoticeRow}>
        <View style={styles.pendingNoticeBadges}>
          {notice.type === "ESCALATED" && (
            <View style={{ backgroundColor: "#FEF2F2", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
              <Text style={{ fontSize: 10, fontWeight: "700", color: "#DC2626" }}>ESCALADO</Text>
            </View>
          )}
          {notice.requiresConfirmation && isUnread && (
            <View style={{ backgroundColor: "#EDE9FE", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
              <Text style={{ fontSize: 10, fontWeight: "700", color: "#7C3AED" }}>CONFIRMAR</Text>
            </View>
          )}
        </View>
        <Text style={{ fontSize: 11, color: uc.text, fontWeight: "600" }}>
          {notice.urgency === "INFORMATIVE" ? "Info" : notice.urgency === "IMPORTANT" ? "Importante" : "Crítico"}
        </Text>
      </View>
      {notice.title ? (
        <Text style={[styles.pendingNoticeTitle, { color: colors.foreground }]} numberOfLines={1}>{notice.title}</Text>
      ) : null}
      <Text style={[styles.pendingNoticeContent, { color: colors.mutedForeground }]} numberOfLines={2}>{notice.content}</Text>
    </View>
  );
}

function EmptyState({ message, colors }: { message: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={[styles.emptyCard, { backgroundColor: colors.muted, borderColor: colors.border }]}>
      <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>{message}</Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MeuDiaScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, isError, refetch } = useGetMyDay({
    query: {
      queryKey: getGetMyDayQueryKey(),
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: getGetMyDayQueryKey() });
    await refetch();
    setRefreshing(false);
  }, [queryClient, refetch]);

  const today = new Date().toISOString().slice(0, 10);
  const dayLabel = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

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
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Meu Dia</Text>
        <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
          {dayLabel}
        </Text>
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
        ) : isError || !data ? (
          <View style={styles.centered}>
            <Feather name="wifi-off" size={32} color={colors.mutedForeground} />
            <Text style={[styles.errorText, { color: colors.mutedForeground }]}>
              Não foi possível carregar o Meu Dia
            </Text>
          </View>
        ) : (
          <>
            {/* ── Avisos Pendentes ── */}
            {(data as any).pendingNotices && (data as any).pendingNotices.length > 0 && (
              <>
                <SectionHeader title="Avisos Pendentes" icon="bell" colors={colors} />
                {((data as any).pendingNotices as MyDayNoticeItem[]).map((n) => (
                  <PendingNoticeCard key={n.id} notice={n} colors={colors} />
                ))}
              </>
            )}

            {/* ── Nível 1: Ação Imediata ── */}
            <SectionHeader title="Ação Imediata" icon="zap" colors={colors} />
            {data.immediateAction ? (
              <ActivityCard activity={data.immediateAction} colors={colors} highlighted />
            ) : (
              <EmptyState message="Nenhuma atividade imediata." colors={colors} />
            )}

            {/* ── Nível 2: Próxima Atividade ── */}
            <SectionHeader title="Próxima Atividade" icon="arrow-right-circle" colors={colors} />
            {data.nextActivity ? (
              <ActivityCard activity={data.nextActivity} colors={colors} />
            ) : (
              <EmptyState message="Sem próxima atividade programada." colors={colors} />
            )}

            {/* ── Nível 3: Meu Dia (hoje) ── */}
            <SectionHeader title="Hoje" icon="calendar" colors={colors} />
            {data.todayActivities.length > 0 ? (
              data.todayActivities.map((act) => (
                <ActivityCard key={act.allocationId} activity={act} colors={colors} />
              ))
            ) : (
              <EmptyState message="Nenhuma atividade para hoje." colors={colors} />
            )}

            {/* Future activities (up to 5) */}
            {data.futureActivities.length > 0 && (
              <>
                <SectionHeader title="Próximos Dias" icon="trending-up" colors={colors} />
                {data.futureActivities.map((act) => (
                  <ActivityCard key={act.allocationId} activity={act} colors={colors} />
                ))}
              </>
            )}

            {/* ── Nível 4: Informações Complementares ── */}
            <SectionHeader title="Informações Complementares" icon="info" colors={colors} />

            {/* Pending requests */}
            {data.complementaryInfo.pendingRequests.length > 0 && (
              <>
                <Text style={[styles.subSectionTitle, { color: colors.mutedForeground }]}>
                  Solicitações em andamento
                </Text>
                {data.complementaryInfo.pendingRequests.map((req) => (
                  <View
                    key={req.requestId}
                    style={[styles.complementaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                  >
                    <View style={styles.complementaryHeader}>
                      <Text style={[styles.complementaryTitle, { color: colors.foreground }]}>
                        {REQUEST_TYPE_LABELS[req.type] ?? req.type}
                      </Text>
                      <View style={[styles.statusBadge, { backgroundColor: "#FEF3C7" }]}>
                        <Text style={[styles.statusText, { color: "#B45309" }]}>
                          {REQUEST_STATUS_LABELS[req.status] ?? req.status}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                      {req.targetDates.map(formatDate).join(", ")}
                    </Text>
                    {req.reason && (
                      <Text style={[styles.metaText, { color: colors.mutedForeground }]} numberOfLines={2}>
                        {req.reason}
                      </Text>
                    )}
                  </View>
                ))}
              </>
            )}

            {/* Upcoming deliveries */}
            {data.complementaryInfo.upcomingDeliveries.length > 0 && (
              <>
                <Text style={[styles.subSectionTitle, { color: colors.mutedForeground }]}>
                  Entregas futuras
                </Text>
                {data.complementaryInfo.upcomingDeliveries.map((del) => (
                  <View
                    key={del.assignmentId}
                    style={[styles.complementaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                  >
                    <View style={styles.complementaryHeader}>
                      <View style={styles.iconRow}>
                        <Feather
                          name={(DELIVERY_TYPE_ICONS[del.type] ?? "package") as any}
                          size={14}
                          color={colors.mutedForeground}
                        />
                        <Text style={[styles.complementaryTitle, { color: colors.foreground }]} numberOfLines={1}>
                          {del.title}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.metaItem}>
                      <Feather name="clock" size={12} color={colors.mutedForeground} />
                      <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                        Até {formatDate(del.dueDate)}
                      </Text>
                    </View>
                  </View>
                ))}
              </>
            )}

            {data.complementaryInfo.pendingRequests.length === 0 &&
              data.complementaryInfo.upcomingDeliveries.length === 0 && (
                <EmptyState message="Nenhuma solicitação pendente ou entrega futura." colors={colors} />
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
  headerSub: { fontSize: 13 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 10 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 12 },
  errorText: { fontSize: 14, textAlign: "center", maxWidth: 260 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    marginBottom: 4,
  },
  sectionTitle: { fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  subSectionTitle: { fontSize: 12, fontWeight: "600", marginTop: 4, marginBottom: 2 },
  card: {
    borderRadius: 12,
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
  cardHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  immediatePill: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  immediatePillText: { color: "#fff", fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  datePill: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  datePillText: { fontSize: 12, fontWeight: "600" },
  republishedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  republishedText: { fontSize: 10, fontWeight: "600" },
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
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 2 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 12 },
  positionRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  positionText: { fontSize: 13, fontWeight: "600" },
  dailyBookSection: {
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    gap: 2,
  },
  dailyBookLabel: { fontSize: 11, fontWeight: "600", marginBottom: 2 },
  assignmentText: { fontSize: 13 },
  deltaBanner: {
    marginTop: 8,
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    gap: 4,
  },
  deltaHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  deltaTitle: { fontSize: 12, fontWeight: "700", color: "#B45309" },
  deltaRow: { flexDirection: "row", gap: 4 },
  deltaKey: { fontSize: 11, fontWeight: "600", color: "#92400E" },
  deltaVal: { fontSize: 11, color: "#92400E", flex: 1 },
  pendingNoticeCard: {
    borderWidth: 1, borderLeftWidth: 4, borderRadius: 12, padding: 12, marginBottom: 6,
  },
  pendingNoticeRow: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, marginBottom: 6 },
  pendingNoticeBadges: { flexDirection: "row" as const, gap: 4 },
  pendingNoticeTitle: { fontSize: 14, fontWeight: "600" as const, marginBottom: 2 },
  pendingNoticeContent: { fontSize: 13, lineHeight: 18 },
  emptyCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 16,
    alignItems: "center",
  },
  emptyText: { fontSize: 13 },
  complementaryCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    gap: 5,
  },
  complementaryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  complementaryTitle: { fontSize: 14, fontWeight: "600", flex: 1, marginRight: 8 },
});
