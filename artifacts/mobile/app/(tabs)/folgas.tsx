import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState, useRef } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  TextInput,
  Modal,
  TouchableOpacity,
  FlatList,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import {
  useListFolgas,
  useGetFolgasGrid,
  useBulkFillFolgas,
  useToggleFolgaCell,
  getGetFolgasGridQueryKey,
  getListFolgasQueryKey,
} from "@workspace/api-client-react";
import type { GridBulkRequestType, ListFolgasStatus } from "@workspace/api-client-react";

const MANAGER_ROLES = ["ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"];

const TYPE_LABELS: Record<string, string> = {
  DAY_OFF:     "Folga",
  NO_SHOW:     "Folga",
  RECESSO:     "Recesso",
  AFASTAMENTO: "Afastamento",
  RESTRICAO:   "Restrição",
  OUTRO:       "Outro",
};

const GRID_TYPES = [
  { value: "DAY_OFF", abbr: "F",  label: "Folga",     color: "#3b82f6", bg: "#dbeafe" },
  { value: "RECESSO", abbr: "R",  label: "Recesso",   color: "#f97316", bg: "#ffedd5" },
  { value: "OUTRO",   abbr: "O",  label: "Outro",     color: "#6b7280", bg: "#f3f4f6" },
] as const;

const TYPE_COLORS: Record<string, { color: string; bg: string; abbr: string }> = {
  NO_SHOW:     { color: "#3b82f6", bg: "#dbeafe", abbr: "F" },
  RECESSO:     { color: "#f97316", bg: "#ffedd5", abbr: "R" },
  OUTRO:       { color: "#6b7280", bg: "#f3f4f6", abbr: "O" },
  DAY_OFF:     { color: "#3b82f6", bg: "#dbeafe", abbr: "F" },
  AFASTAMENTO: { color: "#8b5cf6", bg: "#ede9fe", abbr: "Af" },
  RESTRICAO:   { color: "#ca8a04", bg: "#fef9c3", abbr: "Rs" },
};

const MONTH_NAMES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const DAY_ABBR = ["D","S","T","Q","Q","S","S"];

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getDayOfWeek(year: number, month: number, day: number): number {
  return new Date(year, month - 1, day).getDay();
}

function isWeekend(year: number, month: number, day: number): boolean {
  const dow = getDayOfWeek(year, month, day);
  return dow === 0 || dow === 6;
}

// ─── Fill Period Modal ────────────────────────────────────────────────────────

function FillPeriodModal({
  visible, onClose, operationId, year, month, preselectedUserId,
}: {
  visible: boolean; onClose: () => void;
  operationId: string; year: number; month: number;
  preselectedUserId?: string;
}) {
  const colors = useColors();
  const qc = useQueryClient();
  const [userId,    setUserId]    = useState(preselectedUserId ?? "");
  const [startDate, setStartDate] = useState("");
  const [endDate,   setEndDate]   = useState("");
  const [type,      setType]      = useState<string>("DAY_OFF");

  const { mutate: bulkFill, isPending } = useBulkFillFolgas({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetFolgasGridQueryKey({ operationId, year, month }) });
        onClose();
        setStartDate(""); setEndDate("");
      },
    },
  });

  function handleSubmit() {
    if (!userId || !startDate || !endDate) return;
    const dates: string[] = [];
    const cur = new Date(startDate + "T00:00:00Z");
    const end = new Date(endDate + "T00:00:00Z");
    while (cur <= end) {
      dates.push(cur.toISOString().slice(0, 10));
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    bulkFill({ data: { userId, operationId, dates, type: type as any } });
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { backgroundColor: colors.card, maxHeight: "90%" }]}>
          <KeyboardAwareScrollViewCompat
            contentContainerStyle={{ gap: 8 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bottomOffset={24}
          >
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>Preencher Período</Text>

          {!preselectedUserId && (
            <>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>UUID do Membro</Text>
              <TextInput
                style={[styles.textInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                value={userId}
                onChangeText={setUserId}
                placeholder="UUID"
                placeholderTextColor={colors.mutedForeground}
              />
            </>
          )}

          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Data Inicial (AAAA-MM-DD)</Text>
          <TextInput
            style={[styles.textInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
            value={startDate}
            onChangeText={setStartDate}
            placeholder="2024-06-01"
            placeholderTextColor={colors.mutedForeground}
          />

          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Data Final (AAAA-MM-DD)</Text>
          <TextInput
            style={[styles.textInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
            value={endDate}
            onChangeText={setEndDate}
            placeholder="2024-06-07"
            placeholderTextColor={colors.mutedForeground}
          />

          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Tipo</Text>
          <View style={styles.typeRow}>
            {GRID_TYPES.map((t) => (
              <TouchableOpacity
                key={t.value}
                style={[
                  styles.typeChip,
                  { backgroundColor: type === t.value ? t.bg : colors.muted, borderColor: type === t.value ? t.color : "transparent", borderWidth: 2 },
                ]}
                onPress={() => setType(t.value)}
              >
                <Text style={[styles.typeChipText, { color: type === t.value ? t.color : colors.mutedForeground }]}>
                  {t.abbr} — {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.modalButtons}>
            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.muted }]} onPress={onClose}>
              <Text style={[styles.modalBtnText, { color: colors.foreground }]}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: colors.primary, opacity: isPending ? 0.6 : 1 }]}
              onPress={handleSubmit}
              disabled={isPending}
            >
              <Text style={[styles.modalBtnText, { color: "#fff" }]}>
                {isPending ? "Aplicando..." : "Preencher"}
              </Text>
            </TouchableOpacity>
          </View>
          </KeyboardAwareScrollViewCompat>
        </View>
      </View>
    </Modal>
  );
}

// ─── Cell Type Menu ───────────────────────────────────────────────────────────

function CellTypeMenu({
  visible, onClose, onSelect,
}: {
  visible: boolean; onClose: () => void;
  onSelect: (type: string | null) => void;
}) {
  const colors = useColors();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={onClose}>
        <View style={[styles.menuCard, { backgroundColor: colors.card }]}>
          {GRID_TYPES.map((t) => (
            <TouchableOpacity
              key={t.value}
              style={[styles.menuItem, { backgroundColor: t.bg }]}
              onPress={() => { onSelect(t.value); onClose(); }}
            >
              <Text style={[styles.menuItemText, { color: t.color }]}>
                {t.abbr} — {t.label}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[styles.menuItem, { backgroundColor: colors.muted, marginTop: 4 }]}
            onPress={() => { onSelect(null); onClose(); }}
          >
            <Text style={[styles.menuItemText, { color: colors.mutedForeground }]}>Limpar</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Manager Grid View ────────────────────────────────────────────────────────

function ManagerGridView({
  operationId, year, month,
}: {
  operationId: string; year: number; month: number;
}) {
  const colors = useColors();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const today = new Date();
  const todayDay = today.getDate();
  const todayMonth = today.getMonth() + 1;
  const todayYear = today.getFullYear();

  const gridQueryKey = getGetFolgasGridQueryKey({ operationId, year, month });
  const { data, isLoading, refetch, isRefetching } = useGetFolgasGrid(
    { operationId, year, month },
    { query: { enabled: !!operationId, queryKey: gridQueryKey } },
  );

  const members = data?.members ?? [];
  const daysInMonth = data?.daysInMonth ?? 30;
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const [fillModal, setFillModal] = useState<{ visible: boolean; userId?: string }>({ visible: false });
  const [cellMenu, setCellMenu] = useState<{ visible: boolean; userId: string; day: number } | null>(null);
  const [weekFillMenu, setWeekFillMenu] = useState<{ visible: boolean; userId: string }>({ visible: false, userId: "" });
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);

  const { mutate: toggleCell } = useToggleFolgaCell({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: getGetFolgasGridQueryKey({ operationId, year, month }) }),
    },
  });

  const { mutate: bulkFill } = useBulkFillFolgas({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: getGetFolgasGridQueryKey({ operationId, year, month }) }),
    },
  });

  function handleCellLongPress(userId: string, day: number) {
    setCellMenu({ visible: true, userId, day });
  }

  function handleCellMenuSelect(type: string | null) {
    if (!cellMenu) return;
    toggleCell({
      data: {
        userId: cellMenu.userId,
        operationId,
        date: isoDate(year, month, cellMenu.day),
        type: type as any ?? undefined,
      },
    });
    setCellMenu(null);
  }

  function handleFillWeek(userId: string, type: string) {
    const today2 = new Date();
    const refDay = (today2.getFullYear() === year && today2.getMonth() + 1 === month)
      ? today2.getDate()
      : 1;
    const refDate = new Date(year, month - 1, refDay);
    const dow = refDate.getDay();
    const monday = refDay - ((dow + 6) % 7);
    const weekDates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = monday + i;
      if (d >= 1 && d <= daysInMonth) {
        weekDates.push(isoDate(year, month, d));
      }
    }
    bulkFill({ data: { userId, operationId, dates: weekDates, type: type as GridBulkRequestType } });
  }

  if (isLoading) {
    return (
      <View style={[styles.center, { paddingVertical: 48 }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (members.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={[styles.empty, { color: colors.mutedForeground }]}>Nenhum membro ativo na operação.</Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        <ScrollView horizontal showsHorizontalScrollIndicator>
          <View>
            {/* Header row */}
          <View style={[styles.gridRow, { borderBottomWidth: 1, borderColor: colors.border }]}>
            <View style={[styles.memberCell, { backgroundColor: colors.card }]}>
              <Text style={[styles.headerText, { color: colors.mutedForeground }]}>Membro</Text>
            </View>
            {days.map((d) => {
              const weekend = isWeekend(year, month, d);
              const isToday = todayYear === year && todayMonth === month && todayDay === d;
              return (
                <View
                  key={d}
                  style={[
                    styles.dayHeaderCell,
                    { backgroundColor: isToday ? colors.primary + "22" : weekend ? colors.muted : colors.card },
                  ]}
                >
                  <Text style={[styles.dayNum, { color: isToday ? colors.primary : weekend ? colors.mutedForeground : colors.foreground }]}>
                    {d}
                  </Text>
                  <Text style={[styles.dayAbbr, { color: colors.mutedForeground }]}>
                    {DAY_ABBR[getDayOfWeek(year, month, d)]}
                  </Text>
                </View>
              );
            })}
            <View style={[styles.totalsCell, { backgroundColor: colors.card }]}>
              <Text style={[styles.headerText, { color: colors.mutedForeground }]}>Total</Text>
            </View>
          </View>

          {/* Member rows */}
          {members.map((m) => (
              <View key={m.userId} style={[styles.gridRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border }]}>
                <View style={[styles.memberCell, { backgroundColor: colors.card }]}>
                  <Text style={[styles.memberName, { color: colors.foreground }]} numberOfLines={1}>
                    {m.name}
                  </Text>
                  <TouchableOpacity onPress={() => setWeekFillMenu({ visible: true, userId: m.userId })}>
                    <Text style={[styles.fillWeekBtn, { color: colors.primary }]}>+ semana</Text>
                  </TouchableOpacity>
                </View>
                {days.map((d) => {
                  const type = m.days[String(d)];
                  const info = type ? TYPE_COLORS[type] : null;
                  const weekend = isWeekend(year, month, d);
                  return (
                    <Pressable
                      key={d}
                      style={[
                        styles.cell,
                        { backgroundColor: info ? info.bg : weekend ? colors.muted + "44" : colors.card },
                      ]}
                      onLongPress={() => handleCellLongPress(m.userId, d)}
                      delayLongPress={400}
                    >
                      {info && (
                        <Text style={[styles.cellAbbr, { color: info.color }]}>{info.abbr}</Text>
                      )}
                    </Pressable>
                  );
                })}
                <TouchableOpacity
                  style={[styles.totalsCell, { backgroundColor: colors.card }]}
                  onPress={() => setFillModal({ visible: true, userId: m.userId })}
                >
                  {GRID_TYPES.filter((t) => (m.totals[t.value] ?? 0) > 0).map((t) => (
                    <Text key={t.value} style={[styles.totalText, { color: t.color }]}>
                      {t.abbr}:{m.totals[t.value]}
                    </Text>
                  ))}
                  {Object.values(m.totals).every((v) => v === 0) && (
                    <Text style={[styles.totalText, { color: colors.mutedForeground }]}>—</Text>
                  )}
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </ScrollView>
      </ScrollView>

      {fillModal.visible && (
        <FillPeriodModal
          visible
          onClose={() => setFillModal({ visible: false })}
          operationId={operationId}
          year={year}
          month={month}
          preselectedUserId={fillModal.userId}
        />
      )}

      {cellMenu?.visible && (
        <CellTypeMenu
          visible
          onClose={() => setCellMenu(null)}
          onSelect={handleCellMenuSelect}
        />
      )}

      {weekFillMenu.visible && (
        <CellTypeMenu
          visible
          onClose={() => setWeekFillMenu({ visible: false, userId: "" })}
          onSelect={(type) => {
            if (type) handleFillWeek(weekFillMenu.userId, type);
            setWeekFillMenu({ visible: false, userId: "" });
          }}
        />
      )}
    </>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function FolgasScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, roles } = useAuth();

  const isManager = roles.some((r) => MANAGER_ROLES.includes(r.role));
  const operationId = roles.find((r) => r.operationId)?.operationId ?? undefined;

  const today = new Date();
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [fillOpen, setFillOpen] = useState(false);

  const userId = user?.id;
  const params = isManager
    ? { operationId, status: "ACTIVE" as ListFolgasStatus }
    : { userId, status: "ACTIVE" as ListFolgasStatus };

  const { data, isLoading, refetch, isRefetching } = useListFolgas(params, {
    query: { enabled: !!userId && !isManager, queryKey: getListFolgasQueryKey(params) },
  });

  const folgas = data?.folgas ?? [];

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  }

  if (isManager) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.iconWrap, { backgroundColor: colors.primary + "18" }]}>
            <Feather name="calendar" size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.foreground }]}>Folgas da Equipe</Text>
          </View>
          <TouchableOpacity
            style={[styles.fillBtn, { backgroundColor: colors.primary + "15" }]}
            onPress={() => setFillOpen(true)}
          >
            <Text style={[styles.fillBtnText, { color: colors.primary }]}>+ Período</Text>
          </TouchableOpacity>
        </View>

        {/* Month nav */}
        <View style={[styles.monthNav, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
          <TouchableOpacity style={styles.navBtn} onPress={prevMonth}>
            <Feather name="chevron-left" size={18} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.monthLabel, { color: colors.foreground }]}>
            {MONTH_NAMES[month - 1]} {year}
          </Text>
          <TouchableOpacity style={styles.navBtn} onPress={nextMonth}>
            <Feather name="chevron-right" size={18} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        {/* Legend */}
        <View style={[styles.legend, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          {GRID_TYPES.map((t) => (
            <View key={t.value} style={styles.legendItem}>
              <View style={[styles.legendBadge, { backgroundColor: t.bg }]}>
                <Text style={[styles.legendAbbr, { color: t.color }]}>{t.abbr}</Text>
              </View>
              <Text style={[styles.legendLabel, { color: colors.mutedForeground }]}>{t.label}</Text>
            </View>
          ))}
          <Text style={[styles.legendHint, { color: colors.mutedForeground }]}>Toque longo</Text>
        </View>

        {/* Grid */}
        <View style={{ flex: 1 }}>
          {operationId ? (
            <ManagerGridView operationId={operationId} year={year} month={month} />
          ) : (
            <View style={styles.center}>
              <Text style={[styles.empty, { color: colors.mutedForeground }]}>Sem operação associada.</Text>
            </View>
          )}
        </View>

        {fillOpen && operationId && (
          <FillPeriodModal
            visible
            onClose={() => setFillOpen(false)}
            operationId={operationId}
            year={year}
            month={month}
          />
        )}
      </View>
    );
  }

  // Regular member view
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 100, paddingTop: 16 }}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
    >
      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: colors.primary + "18" }]}>
          <Feather name="calendar" size={22} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.foreground }]}>Minhas Folgas</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Dias de descanso e ausências</Text>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : folgas.length === 0 ? (
          <View style={styles.center}>
            <Feather name="calendar" size={32} color={colors.mutedForeground} style={{ opacity: 0.4, marginBottom: 8 }} />
            <Text style={[styles.empty, { color: colors.mutedForeground }]}>Você não tem folgas registradas.</Text>
            <Pressable
              style={({ pressed }) => [styles.linkBtn, { opacity: pressed ? 0.6 : 1 }]}
              onPress={() => router.push("/(tabs)/solicitacoes")}
            >
              <Text style={[styles.linkText, { color: colors.primary }]}>Solicitar folga →</Text>
            </Pressable>
          </View>
        ) : (
          folgas.map((f, index) => (
            <React.Fragment key={f.id}>
              <View style={styles.row}>
                <View style={[styles.dateBadge, { backgroundColor: colors.primary + "14" }]}>
                  <Feather name="calendar" size={14} color={colors.primary} />
                  <Text style={[styles.dateText, { color: colors.primary }]}>
                    {f.startDate === f.endDate
                      ? f.startDate
                      : `${f.startDate.slice(5)}\n→ ${f.endDate.slice(5)}`}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.badges}>
                    <View style={[styles.typeBadge, { backgroundColor: colors.primary + "14" }]}>
                      <Text style={[styles.typeText, { color: colors.primary }]}>
                        {TYPE_LABELS[f.type] ?? f.type}
                      </Text>
                    </View>
                  </View>
                  {!!f.notes && (
                    <Text style={[styles.notes, { color: colors.mutedForeground }]} numberOfLines={2}>
                      {f.notes}
                    </Text>
                  )}
                </View>
              </View>
              {index < folgas.length - 1 && (
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
              )}
            </React.Fragment>
          ))
        )}
      </View>

      {folgas.length > 0 && (
        <Pressable
          style={({ pressed }) => [styles.footerLink, { opacity: pressed ? 0.6 : 1 }]}
          onPress={() => router.push("/(tabs)/solicitacoes")}
        >
          <Text style={[styles.linkText, { color: colors.primary }]}>+ Solicitar nova folga</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 1,
  },
  fillBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  fillBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  navBtn: {
    padding: 8,
  },
  monthLabel: {
    fontSize: 15,
    fontWeight: "600",
    minWidth: 110,
    textAlign: "center",
  },
  legend: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexWrap: "wrap",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendBadge: {
    width: 22,
    height: 18,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  legendAbbr: {
    fontSize: 10,
    fontWeight: "700",
  },
  legendLabel: {
    fontSize: 11,
  },
  legendHint: {
    fontSize: 10,
    marginLeft: "auto",
    fontStyle: "italic",
  },
  gridRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  memberCell: {
    width: 110,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: "#e5e7eb",
    justifyContent: "center",
  },
  memberName: {
    fontSize: 12,
    fontWeight: "600",
  },
  fillWeekBtn: {
    fontSize: 10,
    marginTop: 2,
  },
  dayHeaderCell: {
    width: 34,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: "#e5e7eb",
  },
  dayNum: {
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 14,
  },
  dayAbbr: {
    fontSize: 9,
    lineHeight: 12,
  },
  headerText: {
    fontSize: 10,
    fontWeight: "600",
  },
  cell: {
    width: 34,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: "#e5e7eb",
  },
  cellAbbr: {
    fontSize: 10,
    fontWeight: "700",
  },
  totalsCell: {
    width: 60,
    paddingHorizontal: 4,
    paddingVertical: 4,
    alignItems: "center",
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: "#e5e7eb",
    flexWrap: "wrap",
    flexDirection: "row",
    gap: 2,
  },
  totalText: {
    fontSize: 10,
    fontWeight: "600",
  },
  card: {
    marginHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  center: {
    paddingVertical: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: {
    fontSize: 14,
    textAlign: "center",
    paddingHorizontal: 24,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 16,
  },
  dateBadge: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
    minWidth: 62,
  },
  dateText: {
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 15,
  },
  badges: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
  },
  typeBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  typeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  notes: {
    fontSize: 12,
    marginTop: 6,
    lineHeight: 17,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
  },
  linkBtn: {
    marginTop: 12,
  },
  linkText: {
    fontSize: 14,
    fontWeight: "600",
  },
  footerLink: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalCard: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
    gap: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: 4,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  typeRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 4,
  },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  typeChipText: {
    fontSize: 13,
    fontWeight: "600",
  },
  modalButtons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  modalBtnText: {
    fontSize: 15,
    fontWeight: "600",
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  menuCard: {
    borderRadius: 14,
    padding: 12,
    width: 200,
    gap: 4,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  menuItem: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
