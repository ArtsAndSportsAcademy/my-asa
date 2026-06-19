import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  useGetMyDay,
  getGetMyDayQueryKey,
  useGetMyCheckInStatus,
  usePerformMyCheckIn,
  getGetMyCheckInStatusQueryKey,
  useGetMyActiveDelegations,
  getMyActiveDelegationsQueryKey,
  useGetMyTasks,
  getGetMyTasksQueryKey,
  useGetNotifications,
  useMarkNotificationRead,
  getNotificationsQueryKey,
} from "@workspace/api-client-react";
import type {
  MyDayActivity,
  MyDayResponse,
  MyDayNoticeItem,
  CheckInMyStatusResponse,
  ActiveDelegationItem,
  TaskItem,
  UserNotificationItem,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
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
  PENDING:              "Aguardando",
  ALTERNATIVE_PROPOSED: "Alternativa Proposta",
  APPROVED:             "Aprovada",
  DENIED:               "Negada",
  ALTERNATIVE_ACCEPTED: "Alternativa Aceita",
  ALTERNATIVE_REJECTED: "Alternativa Rejeitada",
  EXPIRED:              "Expirada",
};

const REQUEST_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  PENDING:              { bg: "#FEF3C7", text: "#B45309" },
  ALTERNATIVE_PROPOSED: { bg: "#DBEAFE", text: "#1E40AF" },
  APPROVED:             { bg: "#D1FAE5", text: "#065F46" },
  DENIED:               { bg: "#FEE2E2", text: "#991B1B" },
  ALTERNATIVE_ACCEPTED: { bg: "#D1FAE5", text: "#065F46" },
  ALTERNATIVE_REJECTED: { bg: "#FEE2E2", text: "#991B1B" },
  EXPIRED:              { bg: "#F3F4F6", text: "#6B7280" },
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

// ─── Check-in Card ────────────────────────────────────────────────────────────

const CHECK_IN_STATUS_MOBILE: Record<string, { label: string; bg: string; text: string; icon: string }> = {
  EXPECTED:   { label: "Aguardando check-in", bg: "#F3F4F6", text: "#374151", icon: "clock"          },
  CHECKED_IN: { label: "Presente",            bg: "#DCFCE7", text: "#166534", icon: "check-circle"   },
  LATE:       { label: "Atrasado",            bg: "#FEF3C7", text: "#92400E", icon: "alert-circle"   },
  ABSENT:     { label: "Ausente",             bg: "#FEE2E2", text: "#991B1B", icon: "x-circle"       },
  EXCUSED:    { label: "Justificado",         bg: "#DBEAFE", text: "#1E40AF", icon: "info"           },
};

function CheckInCard({
  colors,
  checkInData,
  onCheckIn,
  isLoading,
}: {
  colors: ReturnType<typeof useColors>;
  checkInData: CheckInMyStatusResponse | undefined;
  onCheckIn: () => void;
  isLoading: boolean;
}) {
  const status = checkInData?.status ?? "EXPECTED";
  const cfg = CHECK_IN_STATUS_MOBILE[status] ?? CHECK_IN_STATUS_MOBILE.EXPECTED;
  const checkIn = checkInData?.checkIn;
  const canCheckIn = status === "EXPECTED";

  return (
    <View
      style={[
        styles.checkInCard,
        { backgroundColor: cfg.bg, borderColor: colors.border },
      ]}
    >
      <View style={styles.checkInRow}>
        <View style={styles.checkInLeft}>
          <Feather name={cfg.icon as any} size={18} color={cfg.text} />
          <View style={{ marginLeft: 8 }}>
            <Text style={[styles.checkInLabel, { color: cfg.text }]}>{cfg.label}</Text>
            {checkIn?.checkedInAt && (
              <Text style={[styles.checkInMeta, { color: cfg.text + "CC" }]}>
                {new Date(checkIn.checkedInAt).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            )}
            {checkIn?.excuseReason && (
              <Text style={[styles.checkInMeta, { color: cfg.text + "CC" }]} numberOfLines={1}>
                {checkIn.excuseReason}
              </Text>
            )}
          </View>
        </View>
        {canCheckIn && (
          <TouchableOpacity
            style={[styles.checkInButton, { backgroundColor: colors.primary }]}
            onPress={onCheckIn}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.checkInButtonText}>Realizar Check-in</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ─── Delegate Banner ──────────────────────────────────────────────────────────

const RESP_LABELS: Record<string, string> = {
  CHECK_INS: "Check-ins",
  REQUESTS: "Solicitações",
  TASK_APPROVALS: "Aprova Tarefas",
  DAILY_BOOK: "Livro do Dia",
  NOTICES: "Avisos",
  OPERATIONAL_MESSAGES: "Mensagens",
  SCALES: "Escalas",
};

const RESP_ACTIONS: Record<string, { label: string; route?: string; webOnly?: boolean }> = {
  CHECK_INS:            { label: "Check-ins",   webOnly: true },
  DAILY_BOOK:           { label: "Livro do Dia", route: "/(tabs)/daily-book" },
  NOTICES:              { label: "Avisos",       route: "/(tabs)/avisos" },
  REQUESTS:             { label: "Solicitações", route: "/(tabs)/solicitacoes" },
  TASK_APPROVALS:       { label: "Tarefas",      route: "/(tabs)/tarefas" },
  SCALES:               { label: "Escalas",      webOnly: true },
  OPERATIONAL_MESSAGES: { label: "Mensagens",    route: "/(tabs)/mensagens" },
};

function DelegateBanner({ delegations, colors }: { delegations: ActiveDelegationItem[]; colors: ReturnType<typeof useColors> }) {
  const router = useRouter();
  if (delegations.length === 0) return null;
  return (
    <View style={[styles.deltaBanner, { backgroundColor: "#EFF6FF", borderColor: "#3B82F6", marginTop: 8, marginBottom: 0 }]}>
      <View style={styles.deltaHeader}>
        <Feather name="shield" size={14} color="#1D4ED8" />
        <Text style={[styles.deltaTitle, { color: "#1D4ED8" }]}>Responsabilidades Delegadas</Text>
      </View>
      {delegations.map((d) => (
        <View key={d.delegationId} style={{ marginTop: 6 }}>
          <Text style={[styles.deltaVal, { color: "#1E40AF", fontWeight: "600" }]}>
            {d.operationName}
          </Text>
          <Text style={[styles.deltaVal, { color: "#1E40AF", fontSize: 11, marginTop: 1 }]}>
            Em nome de {d.supervisorName} · {d.startDate} → {d.endDate}
          </Text>
          {(d.responsibilities as string[]).length > 0 && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
              {(d.responsibilities as string[]).map((r) => {
                const action = RESP_ACTIONS[r];
                if (!action) return null;
                return (
                  <TouchableOpacity
                    key={r}
                    onPress={() => {
                      if (action.webOnly) {
                        Alert.alert(
                          `${action.label} — Web Admin`,
                          `Esta função é executada pelo MyASA Web Admin.\n\nAbra o navegador do seu celular ou computador e acesse o endereço do MyASA Web Admin para gerenciar ${action.label}.`,
                          [{ text: "Entendido" }]
                        );
                      } else if (action.route) {
                        router.push(action.route as any);
                      }
                    }}
                    style={{
                      backgroundColor: "#DBEAFE",
                      borderRadius: 6,
                      paddingHorizontal: 8,
                      paddingVertical: 5,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                    }}
                    activeOpacity={0.7}
                  >
                    <Feather
                      name={action.webOnly ? "monitor" : "arrow-right-circle"}
                      size={10}
                      color="#1D4ED8"
                    />
                    <Text style={{ color: "#1D4ED8", fontSize: 11, fontWeight: "600" }}>
                      {action.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      ))}
    </View>
  );
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

const TASK_PRIORITY_ORDER: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
const TASK_PRIORITY_LABELS: Record<string, string> = { CRITICAL: "Crítica", HIGH: "Alta", MEDIUM: "Média", LOW: "Baixa" };
const TASK_PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  CRITICAL: { bg: "#FEE2E2", text: "#991B1B" },
  HIGH:     { bg: "#FFEDD5", text: "#9A3412" },
  MEDIUM:   { bg: "#FEF3C7", text: "#92400E" },
  LOW:      { bg: "#F3F4F6", text: "#4B5563" },
};
const TASK_STATUS_LABELS: Record<string, string> = {
  CREATED: "Criada", IN_PROGRESS: "Em andamento", READY_FOR_APPROVAL: "Ag. aprovação",
  CHANGES_REQUESTED: "Revisar", APPROVED: "Aprovada", COMPLETED: "Concluída",
  CANCELLED: "Cancelada", EXPIRED: "Expirada",
};
const TASK_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  CREATED:            { bg: "#F3F4F6", text: "#4B5563" },
  IN_PROGRESS:        { bg: "#DBEAFE", text: "#1E40AF" },
  READY_FOR_APPROVAL: { bg: "#EDE9FE", text: "#6D28D9" },
  CHANGES_REQUESTED:  { bg: "#FEF3C7", text: "#92400E" },
  APPROVED:           { bg: "#D1FAE5", text: "#065F46" },
  COMPLETED:          { bg: "#D1FAE5", text: "#065F46" },
  CANCELLED:          { bg: "#F3F4F6", text: "#6B7280" },
  EXPIRED:            { bg: "#FEE2E2", text: "#991B1B" },
};

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
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, isError, refetch } = useGetMyDay({
    query: {
      queryKey: getGetMyDayQueryKey(),
    },
  });

  const { data: checkInStatusData, isLoading: checkInLoading } = useGetMyCheckInStatus(
    undefined,
    { query: { queryKey: getGetMyCheckInStatusQueryKey() } }
  );

  const performCheckInMutation = usePerformMyCheckIn();

  const { data: delegationsData } = useGetMyActiveDelegations();
  const activeDelegations = delegationsData?.delegations ?? [];

  const { data: myTasksData } = useGetMyTasks(
    undefined,
    { query: { queryKey: getGetMyTasksQueryKey() } }
  );
  const myActiveTasks: TaskItem[] = (myTasksData?.tasks ?? [])
    .filter((t) => !["APPROVED", "COMPLETED", "CANCELLED", "EXPIRED"].includes(t.status))
    .sort((a, b) => TASK_PRIORITY_ORDER[a.priority] - TASK_PRIORITY_ORDER[b.priority]);

  // Notifications for Meu Dia — up to 5 IMPORTANT/CRITICAL unread
  const { data: notificationsData } = useGetNotifications(
    { unreadOnly: true, limit: 20 },
    { query: { queryKey: getNotificationsQueryKey({ unreadOnly: true, limit: 20 }) } },
  );
  const markNotifRead = useMarkNotificationRead();
  const PRIORITY_ORDER: Record<string, number> = { CRITICAL: 0, IMPORTANT: 1, NORMAL: 2, LOW: 3 };

  // Required mix for Meu Dia alerts section:
  //   1. CRITICAL notifications (any category) — always surfaced first
  //   2. Pending-action notifications: "approval" and "notice" categories
  //      even at NORMAL priority — these represent actionable items
  //   3. IMPORTANT notifications (other categories)
  // Deduplicate by entityId+entityType, cap 2 per category, max 5 total.
  const urgentNotifications: UserNotificationItem[] = (() => {
    const all = notificationsData?.notifications ?? [];

    // Accept CRITICAL/IMPORTANT of any category, plus approval+notice at NORMAL
    const ACTIONABLE_CATEGORIES = new Set(["approval", "notice"]);
    const raw = all.filter(
      (n) =>
        n.priority === "CRITICAL" ||
        n.priority === "IMPORTANT" ||
        (n.priority === "NORMAL" && ACTIONABLE_CATEGORIES.has(n.category)),
    );

    // Dedup: for the same entity keep only the highest-priority notification
    const entityMap = new Map<string, UserNotificationItem>();
    for (const n of raw) {
      const key = n.entityType && n.entityId ? `${n.entityType}:${n.entityId}` : n.id;
      const existing = entityMap.get(key);
      if (!existing || (PRIORITY_ORDER[n.priority] ?? 3) < (PRIORITY_ORDER[existing.priority] ?? 3)) {
        entityMap.set(key, n);
      }
    }

    // Cap 2 per category to prevent a single domain flooding the section,
    // sorted CRITICAL → IMPORTANT → NORMAL and by createdAt within same priority
    const categoryCounts: Record<string, number> = {};
    const capped: UserNotificationItem[] = [];
    const sorted = [...entityMap.values()].sort((a, b) => {
      const pd = (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3);
      if (pd !== 0) return pd;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    for (const n of sorted) {
      const catCount = categoryCounts[n.category] ?? 0;
      if (catCount < 2) {
        capped.push(n);
        categoryCounts[n.category] = catCount + 1;
      }
    }

    return capped.slice(0, 5);
  })();

  function handleCheckIn() {
    performCheckInMutation.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMyCheckInStatusQueryKey() });
      },
      onError: () => {
        Alert.alert("Erro", "Não foi possível realizar o check-in. Tente novamente.");
      },
    });
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: getGetMyDayQueryKey() });
    await queryClient.invalidateQueries({ queryKey: getGetMyCheckInStatusQueryKey() });
    await queryClient.invalidateQueries({ queryKey: getMyActiveDelegationsQueryKey() });
    await queryClient.invalidateQueries({ queryKey: getGetMyTasksQueryKey() });
    await queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
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
            {/* ── Delegação Ativa ── */}
            <DelegateBanner delegations={activeDelegations} colors={colors} />

            {/* ── Check-in ── */}
            <CheckInCard
              colors={colors}
              checkInData={checkInStatusData}
              onCheckIn={handleCheckIn}
              isLoading={performCheckInMutation.isPending || checkInLoading}
            />

            {/* ── Ação Rápida: Nova Solicitação ── */}
            <Pressable
              onPress={() => router.push("/(tabs)/solicitacoes")}
              style={[
                styles.quickActionRow,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: colors.primary + "18" }]}>
                <Feather name="inbox" size={16} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.quickActionLabel, { color: colors.foreground }]}>
                  Minhas Solicitações
                </Text>
                <Text style={[styles.quickActionSub, { color: colors.mutedForeground }]}>
                  Folgas, trocas e restrições
                </Text>
              </View>
              <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
            </Pressable>

            {/* ── Alertas Operacionais (IMPORTANT/CRITICAL notificações) ── */}
            {urgentNotifications.length > 0 && (
              <>
                <SectionHeader title="Alertas Operacionais" icon="alert-circle" colors={colors} />
                {urgentNotifications.map((n) => {
                  const isCritical = n.priority === "CRITICAL";
                  return (
                    <TouchableOpacity
                      key={n.id}
                      activeOpacity={0.75}
                      onPress={() => {
                        markNotifRead.mutate(n.id);
                        if (n.actionUrl) router.push(n.actionUrl as any);
                      }}
                      style={[
                        styles.notifCard,
                        {
                          backgroundColor: isCritical ? "#FEF2F2" : "#FFFBEB",
                          borderColor: isCritical ? "#FECACA" : "#FDE68A",
                          borderLeftColor: isCritical ? "#EF4444" : "#F59E0B",
                        },
                      ]}
                    >
                      <View style={styles.notifRow}>
                        <Feather
                          name={isCritical ? "alert-octagon" : "alert-triangle"}
                          size={16}
                          color={isCritical ? "#DC2626" : "#B45309"}
                        />
                        <View style={{ flex: 1, marginLeft: 8 }}>
                          <Text
                            style={[styles.notifTitle, { color: isCritical ? "#991B1B" : "#92400E" }]}
                            numberOfLines={1}
                          >
                            {n.title}
                          </Text>
                          <Text
                            style={[styles.notifMsg, { color: isCritical ? "#B91C1C" : "#B45309" }]}
                            numberOfLines={2}
                          >
                            {n.message}
                          </Text>
                        </View>
                        <Feather name="chevron-right" size={14} color={isCritical ? "#DC2626" : "#B45309"} />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </>
            )}

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

            {/* Solicitações */}
            {data.complementaryInfo.pendingRequests.length > 0 && (
              <>
                <View style={styles.subSectionRow}>
                  <Text style={[styles.subSectionTitle, { color: colors.mutedForeground }]}>
                    Solicitações
                  </Text>
                  <Pressable onPress={() => router.push("/(tabs)/solicitacoes")}>
                    <Text style={[styles.subSectionLink, { color: colors.primary }]}>
                      Ver todas
                    </Text>
                  </Pressable>
                </View>
                {data.complementaryInfo.pendingRequests.map((req) => {
                  const statusColor = REQUEST_STATUS_COLORS[req.status] ?? { bg: "#F3F4F6", text: "#6B7280" };
                  return (
                    <View
                      key={req.requestId}
                      style={[styles.complementaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                    >
                      <View style={styles.complementaryHeader}>
                        <Text style={[styles.complementaryTitle, { color: colors.foreground }]}>
                          {REQUEST_TYPE_LABELS[req.type] ?? req.type}
                        </Text>
                        <View style={[styles.statusBadge, { backgroundColor: statusColor.bg }]}>
                          <Text style={[styles.statusText, { color: statusColor.text }]}>
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
                      {req.status === "ALTERNATIVE_PROPOSED" && (
                        <Text style={[styles.alertHint, { color: "#1E40AF" }]}>
                          Supervisão propôs uma alternativa — toque para responder
                        </Text>
                      )}
                    </View>
                  );
                })}
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

            {/* ── Minhas Tarefas (T001) ── */}
            {myActiveTasks.length > 0 && (
              <>
                <SectionHeader title="Minhas Tarefas" icon="check-square" colors={colors} />
                {myActiveTasks.slice(0, 6).map((t) => {
                  const isLate = new Date(t.dueDate) < new Date();
                  const priColor = TASK_PRIORITY_COLORS[t.priority] ?? TASK_PRIORITY_COLORS.LOW;
                  const stsColor = TASK_STATUS_COLORS[t.status] ?? TASK_STATUS_COLORS.CREATED;
                  return (
                    <View
                      key={t.id}
                      style={[
                        styles.complementaryCard,
                        {
                          backgroundColor: isLate ? "#FFF5F5" : colors.card,
                          borderColor: isLate ? "#FCA5A5" : colors.border,
                        },
                      ]}
                    >
                      <View style={styles.complementaryHeader}>
                        <Text
                          style={[styles.complementaryTitle, { color: colors.foreground, flex: 1 }]}
                          numberOfLines={1}
                        >
                          {t.title}
                        </Text>
                        <View style={[styles.statusBadge, { backgroundColor: stsColor.bg }]}>
                          <Text style={[styles.statusText, { color: stsColor.text }]}>
                            {TASK_STATUS_LABELS[t.status] ?? t.status}
                          </Text>
                        </View>
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                        <View style={[styles.statusBadge, { backgroundColor: priColor.bg }]}>
                          <Text style={[styles.statusText, { color: priColor.text }]}>
                            {TASK_PRIORITY_LABELS[t.priority] ?? t.priority}
                          </Text>
                        </View>
                        <Text style={[styles.metaText, { color: isLate ? "#DC2626" : colors.mutedForeground }]}>
                          {isLate ? "⚠ Atrasada · " : "Até "}
                          {new Date(t.dueDate + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </>
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
  subSectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4, marginBottom: 2 },
  subSectionLink: { fontSize: 12, fontWeight: "600" },
  alertHint: { fontSize: 11, fontWeight: "500", marginTop: 4 },
  quickActionRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 10,
  },
  quickActionIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  quickActionLabel: { fontSize: 14, fontWeight: "600" },
  quickActionSub: { fontSize: 12, marginTop: 1 },
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

  // ── Check-in Card ──
  checkInCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
  checkInRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  checkInLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  checkInLabel: {
    fontSize: 14,
    fontWeight: "700",
  },
  checkInMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  checkInButton: {
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 140,
    alignItems: "center",
  },
  checkInButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },

  // ── Operational Notification Cards ──
  notifCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderLeftWidth: 4,
    padding: 12,
    marginBottom: 6,
  },
  notifRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 0,
  },
  notifTitle: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 2,
  },
  notifMsg: {
    fontSize: 12,
    lineHeight: 16,
  },
});
