import { Feather } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import React, { useRef, useState, useCallback, useEffect } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";

import { useColors } from "@/hooks/useColors";
import { BackButton } from "@/components/BackButton";
import { AsaEmptyState } from "@/components/AsaEmptyState";
import {
  useGetNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  getNotificationsQueryKey,
  getUnreadCountQueryKey,
} from "@workspace/api-client-react";
import type {
  UserNotificationItem,
  UserNotificationCategory,
} from "@workspace/api-client-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<UserNotificationCategory, string> = {
  schedule: "Escala",
  book: "Livro do Dia",
  notice: "Aviso",
  approval: "Aprovação",
  absence: "Folga",
  rehearsal: "Ensaio",
  responsibility: "Responsabilidade",
  message: "Mensagem",
  system: "Sistema",
};

const CATEGORY_ICONS: Record<UserNotificationCategory, string> = {
  schedule: "clipboard",
  book: "book-open",
  notice: "bell",
  approval: "check-circle",
  absence: "calendar",
  rehearsal: "music",
  responsibility: "shield",
  message: "message-square",
  system: "settings",
};

const PRIORITY_COLORS: Record<string, { dot: string; border: string }> = {
  LOW:       { dot: "#9CA3AF", border: "#F3F4F6" },
  NORMAL:    { dot: "#6B7280", border: "#E5E7EB" },
  IMPORTANT: { dot: "#F59E0B", border: "#FEF3C7" },
  CRITICAL:  { dot: "#EF4444", border: "#FEE2E2" },
};

const CATEGORIES: Array<UserNotificationCategory | "all"> = [
  "all", "schedule", "book", "notice", "approval", "absence",
  "rehearsal", "responsibility", "message", "system",
];

const CATEGORY_FILTER_LABELS: Record<string, string> = {
  all: "Todas",
  ...CATEGORY_LABELS,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function groupByDate(notifications: UserNotificationItem[]): {
  today: UserNotificationItem[];
  thisWeek: UserNotificationItem[];
  older: UserNotificationItem[];
} {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);

  const today: UserNotificationItem[] = [];
  const thisWeek: UserNotificationItem[] = [];
  const older: UserNotificationItem[] = [];

  for (const n of notifications) {
    const d = new Date(n.createdAt);
    if (d >= todayStart) today.push(n);
    else if (d >= weekStart) thisWeek.push(n);
    else older.push(n);
  }

  return { today, thisWeek, older };
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

// ─── Notification Card ────────────────────────────────────────────────────────

function NotificationCard({
  item,
  colors,
  onPress,
  onMarkRead,
}: {
  item: UserNotificationItem;
  colors: ReturnType<typeof useColors>;
  onPress: (item: UserNotificationItem) => void;
  onMarkRead: (id: string) => void;
}) {
  const isRead = !!item.readAt;
  const priorityCfg = PRIORITY_COLORS[item.priority] ?? PRIORITY_COLORS.NORMAL;
  const icon = CATEGORY_ICONS[item.category] ?? "bell";
  const isToday = new Date(item.createdAt) >= new Date(new Date().setHours(0, 0, 0, 0));
  const swipeRef = useRef<Swipeable>(null);

  function renderRightActions(progress: Animated.AnimatedInterpolation<number>) {
    const translateX = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [80, 0],
    });
    return (
      <Animated.View style={{ transform: [{ translateX }] }}>
        <TouchableOpacity
          style={styles.swipeReadAction}
          onPress={() => {
            swipeRef.current?.close();
            onMarkRead(item.id);
          }}
        >
          <Feather name="check" size={18} color="#fff" />
          <Text style={styles.swipeReadText}>Lido</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  const cardContent = (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: priorityCfg.border,
          borderLeftWidth: isRead ? 2 : 4,
          borderLeftColor: priorityCfg.dot,
          opacity: isRead ? 0.75 : 1,
        },
      ]}
      onPress={() => onPress(item)}
      activeOpacity={0.75}
    >
      <View style={styles.cardRow}>
        <View style={[styles.iconCircle, { backgroundColor: priorityCfg.border }]}>
          <Feather name={icon as any} size={16} color={priorityCfg.dot} />
        </View>
        <View style={styles.cardContent}>
          <View style={styles.cardTitleRow}>
            <Text
              style={[
                styles.cardTitle,
                { color: colors.foreground, fontWeight: isRead ? "400" : "600" },
              ]}
              numberOfLines={1}
            >
              {item.title}
            </Text>
            <Text style={[styles.cardTime, { color: colors.mutedForeground }]}>
              {isToday ? formatTime(item.createdAt) : formatDate(item.createdAt)}
            </Text>
          </View>
          <Text
            style={[styles.cardMessage, { color: colors.mutedForeground }]}
            numberOfLines={2}
          >
            {item.message}
          </Text>
          <View style={styles.cardMeta}>
            <View style={[styles.categoryPill, { backgroundColor: priorityCfg.border }]}>
              <Text style={[styles.categoryText, { color: priorityCfg.dot }]}>
                {CATEGORY_LABELS[item.category]}
              </Text>
            </View>
            {!isRead && (
              <View style={[styles.unreadDot, { backgroundColor: priorityCfg.dot }]} />
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (isRead) return cardContent;

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={renderRightActions}
      rightThreshold={40}
      overshootRight={false}
    >
      {cardContent}
    </Swipeable>
  );
}

// ─── Section ─────────────────────────────────────────────────────────────────

function Section({
  title,
  items,
  colors,
  onPressItem,
  onMarkRead,
}: {
  title: string;
  items: UserNotificationItem[];
  colors: ReturnType<typeof useColors>;
  onPressItem: (item: UserNotificationItem) => void;
  onMarkRead: (id: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <View style={{ marginBottom: 4 }}>
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>{title}</Text>
      {items.map((item) => (
        <NotificationCard
          key={item.id}
          item={item}
          colors={colors}
          onPress={onPressItem}
          onMarkRead={onMarkRead}
        />
      ))}
    </View>
  );
}

// ─── Filter Chips ─────────────────────────────────────────────────────────────

function FilterChips({
  selected,
  onSelect,
  colors,
}: {
  selected: string;
  onSelect: (c: string) => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipsContainer}
    >
      {CATEGORIES.map((c) => {
        const active = selected === c;
        return (
          <Pressable
            key={c}
            style={[
              styles.chip,
              {
                backgroundColor: active ? colors.primary : colors.muted,
                borderColor: active ? colors.primary : colors.border,
              },
            ]}
            onPress={() => onSelect(c)}
          >
            <Text
              style={[
                styles.chipText,
                { color: active ? "#fff" : colors.mutedForeground },
              ]}
            >
              {CATEGORY_FILTER_LABELS[c]}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function NotificacoesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [refreshing, setRefreshing] = useState(false);

  const category = selectedCategory === "all" ? undefined : (selectedCategory as UserNotificationCategory);

  const { data, isLoading, isError, refetch } = useGetNotifications(
    { category, limit: 100 },
    { query: { queryKey: getNotificationsQueryKey({ category, limit: 100 }) } },
  );

  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const notifications = data?.notifications ?? [];
  const grouped = groupByDate(notifications);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    await queryClient.invalidateQueries({ queryKey: getUnreadCountQueryKey() });
    await refetch();
    setRefreshing(false);
  }, [queryClient, refetch]);

  function handlePressItem(item: UserNotificationItem) {
    if (!item.readAt) {
      markRead.mutate(item.id);
    }
    if (item.actionUrl) {
      router.push(item.actionUrl as any);
    }
  }

  // Refresh data when screen is focused so badge stays accurate.
  // We do NOT auto-mark-all-read here — read state is only mutated by
  // explicit swipe-to-read or the "Marcar todas" button.
  useFocusEffect(
    useCallback(() => {
      queryClient.invalidateQueries({ queryKey: getUnreadCountQueryKey() });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    }, [queryClient]),
  );

  function handleMarkRead(id: string) {
    markRead.mutate(id);
  }

  function handleMarkAllRead() {
    markAllRead.mutate();
  }

  const totalUnread = notifications.filter((n) => !n.readAt).length;

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
        <View style={styles.headerRow}>
          <BackButton />
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            Notificações
            {totalUnread > 0 && (
              <Text style={{ color: colors.primary }}> ({totalUnread})</Text>
            )}
          </Text>
          {totalUnread > 0 && (
            <TouchableOpacity onPress={handleMarkAllRead} activeOpacity={0.7}>
              <Text style={[styles.markAllText, { color: colors.primary }]}>
                Marcar todas
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <FilterChips
          selected={selectedCategory}
          onSelect={setSelectedCategory}
          colors={colors}
        />
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Erro ao carregar notificações
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: insets.bottom + 100 },
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {notifications.length === 0 ? (
            <AsaEmptyState
              title="Tudo em dia! 🎉"
              subtitle="Estou de olho em tudo por aqui. Quando algo importante aparecer, você vai saber na hora!"
              pose="feliz"
            />
          ) : (
            <>
              <Section
                title="Hoje"
                items={grouped.today}
                colors={colors}
                onPressItem={handlePressItem}
                onMarkRead={handleMarkRead}
              />
              <Section
                title="Esta semana"
                items={grouped.thisWeek}
                colors={colors}
                onPressItem={handlePressItem}
                onMarkRead={handleMarkRead}
              />
              <Section
                title="Anteriores"
                items={grouped.older}
                colors={colors}
                onPressItem={handlePressItem}
                onMarkRead={handleMarkRead}
              />
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  headerTitle: { fontSize: 24, fontWeight: "700" },
  markAllText: { fontSize: 14, fontWeight: "500" },
  chipsContainer: { paddingBottom: 8, gap: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  chipText: { fontSize: 12, fontWeight: "500" },
  scroll: { padding: 16, gap: 8 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyState: { alignItems: "center", paddingTop: 80, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "600" },
  emptyText: { fontSize: 14, textAlign: "center" },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 12,
  },
  card: {
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
    overflow: "hidden",
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 12,
    gap: 10,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  cardContent: { flex: 1 },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 2,
  },
  cardTitle: { fontSize: 14, flex: 1 },
  cardTime: { fontSize: 11, flexShrink: 0 },
  cardMessage: { fontSize: 13, lineHeight: 18, marginBottom: 6 },
  cardMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  categoryPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  categoryText: { fontSize: 10, fontWeight: "600" },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  swipeReadAction: {
    backgroundColor: "#10B981",
    justifyContent: "center",
    alignItems: "center",
    width: 72,
    borderRadius: 10,
    marginBottom: 8,
    gap: 2,
  },
  swipeReadText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
});
