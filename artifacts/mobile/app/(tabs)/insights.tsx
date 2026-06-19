import React, { useState } from "react";
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import {
  useGetCheckInInsights,
  useGetRequestInsights,
  useGetTaskInsights,
  useGetWorkloadInsights,
  useGetNoticeInsights,
} from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";

// ─── Types ────────────────────────────────────────────────────────────────────

type Period = "today" | "7d" | "30d";

const PERIODS: { value: Period; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "7d",    label: "7d" },
  { value: "30d",   label: "30d" },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  accent,
  colors,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={[s.kpiCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[s.kpiValue, { color: accent ?? colors.foreground }]}>{value}</Text>
      <Text style={[s.kpiLabel, { color: colors.foreground }]}>{label}</Text>
      {sub && <Text style={[s.kpiSub, { color: colors.mutedForeground }]}>{sub}</Text>}
    </View>
  );
}

function SectionHeader({ title, colors }: { title: string; colors: ReturnType<typeof useColors> }) {
  return (
    <Text style={[s.sectionTitle, { color: colors.mutedForeground }]}>{title.toUpperCase()}</Text>
  );
}

function LoadingRow({ colors }: { colors: ReturnType<typeof useColors> }) {
  return (
    <View style={[s.loadingRow]}>
      <ActivityIndicator size="small" color={colors.primary} />
    </View>
  );
}

function fmtHours(h: number | null | undefined): string {
  if (h === null || h === undefined) return "—";
  return h < 1 ? `${Math.round(h * 60)}min` : `${h.toFixed(1)}h`;
}

// ─── Section: Presença ────────────────────────────────────────────────────────

function PresencaSection({ period, operationId, colors }: { period: Period; operationId: string; colors: ReturnType<typeof useColors> }) {
  const { data, isLoading } = useGetCheckInInsights({ period, operationId });
  if (isLoading) return <LoadingRow colors={colors} />;
  if (!data) return null;
  return (
    <View style={s.kpiRow}>
      <KpiCard label="Presentes" value={data.checkedIn} sub={`${data.rates.presence}%`} accent="#16a34a" colors={colors} />
      <KpiCard label="Atrasados" value={data.late} sub={`${data.rates.late}%`} accent="#d97706" colors={colors} />
      <KpiCard label="Ausentes" value={data.absent} sub={`${data.rates.absence}%`} accent="#dc2626" colors={colors} />
    </View>
  );
}

// ─── Section: Solicitações ────────────────────────────────────────────────────

function SolicitacoesSection({ period, operationId, colors }: { period: Period; operationId: string; colors: ReturnType<typeof useColors> }) {
  const { data, isLoading } = useGetRequestInsights({ period, operationId });
  if (isLoading) return <LoadingRow colors={colors} />;
  if (!data) return null;
  const approved = (data.byStatus["APPROVED"] ?? 0) + (data.byStatus["ALTERNATIVE_ACCEPTED"] ?? 0);
  const denied   = (data.byStatus["DENIED"] ?? 0)   + (data.byStatus["ALTERNATIVE_REJECTED"] ?? 0);
  const pending  = data.byStatus["PENDING"] ?? 0;
  return (
    <View style={s.kpiRow}>
      <KpiCard label="Total" value={data.total} colors={colors} />
      <KpiCard label="Aprovadas" value={approved} accent="#16a34a" colors={colors} />
      <KpiCard label="Pendentes" value={pending} accent={pending > 0 ? "#d97706" : undefined} colors={colors} />
    </View>
  );
}

// ─── Section: Tarefas ─────────────────────────────────────────────────────────

function TarefasSection({ period, operationId, colors }: { period: Period; operationId: string; colors: ReturnType<typeof useColors> }) {
  const { data, isLoading } = useGetTaskInsights({ period, operationId });
  if (isLoading) return <LoadingRow colors={colors} />;
  if (!data) return null;
  const completed = (data.byStatus["APPROVED"] ?? 0) + (data.byStatus["COMPLETED"] ?? 0);
  return (
    <View style={s.kpiRow}>
      <KpiCard label="Total" value={data.total} colors={colors} />
      <KpiCard label="Concluídas" value={completed} accent="#16a34a" colors={colors} />
      <KpiCard label="Atrasadas" value={data.overdue} accent={data.overdue > 0 ? "#dc2626" : undefined} colors={colors} />
    </View>
  );
}

// ─── Section: Avisos ──────────────────────────────────────────────────────────

function AvisosSection({ period, operationId, colors }: { period: Period; operationId: string; colors: ReturnType<typeof useColors> }) {
  const { data, isLoading } = useGetNoticeInsights({ period, operationId });
  if (isLoading) return <LoadingRow colors={colors} />;
  if (!data) return null;
  return (
    <View style={s.kpiRow}>
      <KpiCard label="Publicados" value={data.total} colors={colors} />
      <KpiCard label="Confirmação" value={`${data.confirmationRate}%`} accent={data.confirmationRate >= 80 ? "#16a34a" : "#d97706"} colors={colors} />
      <KpiCard label="Escalados" value={data.escalated} accent={data.escalated > 0 ? "#dc2626" : undefined} colors={colors} />
    </View>
  );
}

// ─── Section: Carga ───────────────────────────────────────────────────────────

function CargaSection({ operationId, colors }: { operationId: string; colors: ReturnType<typeof useColors> }) {
  const { data, isLoading } = useGetWorkloadInsights({ operationId });
  if (isLoading) return <LoadingRow colors={colors} />;
  if (!data || data.byAssignee.length === 0) return null;

  const totalOpen    = data.byAssignee.reduce((s, a) => s + a.openTasks, 0);
  const totalOverdue = data.byAssignee.reduce((s, a) => s + a.overdueTasks, 0);

  return (
    <View>
      <View style={s.kpiRow}>
        <KpiCard label="Com carga" value={data.byAssignee.length} colors={colors} />
        <KpiCard label="Tarefas abertas" value={totalOpen} colors={colors} />
        <KpiCard label="Atrasadas" value={totalOverdue} accent={totalOverdue > 0 ? "#dc2626" : undefined} colors={colors} />
      </View>
      <View style={[s.table, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {data.byAssignee.slice(0, 8).map((a, i) => (
          <React.Fragment key={a.assigneeId}>
            <View style={s.tableRow}>
              <Text style={[s.tableName, { color: colors.foreground }]} numberOfLines={1}>{a.assigneeName}</Text>
              <View style={s.tableNums}>
                <Text style={[s.tableNum, { color: colors.foreground }]}>{a.openTasks}</Text>
                <Text style={[s.tableNum, { color: a.overdueTasks > 0 ? "#dc2626" : colors.mutedForeground }]}>{a.overdueTasks}</Text>
              </View>
            </View>
            {i < data.byAssignee.slice(0, 8).length - 1 && (
              <View style={[s.divider, { backgroundColor: colors.border }]} />
            )}
          </React.Fragment>
        ))}
        <View style={[s.tableHeader, { borderTopColor: colors.border }]}>
          <Text style={[s.tableHeaderCell, { color: colors.mutedForeground }]}>Membro</Text>
          <View style={s.tableNums}>
            <Text style={[s.tableHeaderCell, { color: colors.mutedForeground }]}>Abertas</Text>
            <Text style={[s.tableHeaderCell, { color: colors.mutedForeground }]}>Atrasadas</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const MANAGER_ROLES_INSIGHTS = ["ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"];

export default function InsightsScreen() {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const [period, setPeriod] = useState<Period>("30d");

  const { roles } = useAuth();
  const operationId = roles.find(r => r.operationId)?.operationId ?? "";
  const isManager = roles.some(r => MANAGER_ROLES_INSIGHTS.includes(r.role));

  if (!isManager) {
    return (
      <View style={[s.restrictedContainer, { backgroundColor: colors.background }]}>
        <View style={[s.restrictedCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="lock" size={32} color={colors.mutedForeground} style={{ marginBottom: 12 }} />
          <Text style={[s.restrictedTitle, { color: colors.foreground }]}>
            Indicadores de Gestão
          </Text>
          <Text style={[s.restrictedText, { color: colors.mutedForeground }]}>
            Esta tela exibe métricas operacionais disponíveis apenas para supervisores e administradores.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 100, paddingTop: 16 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={[s.pageTitle, { color: colors.foreground }]}>Insights</Text>
          <Text style={[s.pageSubtitle, { color: colors.mutedForeground }]}>Desempenho da operação</Text>
        </View>
        <Feather name="trending-up" size={22} color={colors.primary} />
      </View>

      {/* Period selector */}
      <View style={[s.periodRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
        {PERIODS.map(p => (
          <Pressable
            key={p.value}
            onPress={() => setPeriod(p.value)}
            style={[s.periodBtn, period === p.value && { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <Text style={[s.periodLabel, { color: period === p.value ? colors.foreground : colors.mutedForeground }]}>
              {p.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={s.content}>
        {/* Presença */}
        <SectionHeader title="Presença" colors={colors} />
        <PresencaSection period={period} operationId={operationId} colors={colors} />

        {/* Tarefas */}
        <SectionHeader title="Tarefas" colors={colors} />
        <TarefasSection period={period} operationId={operationId} colors={colors} />

        {/* Solicitações */}
        <SectionHeader title="Solicitações" colors={colors} />
        <SolicitacoesSection period={period} operationId={operationId} colors={colors} />

        {/* Avisos */}
        <SectionHeader title="Avisos" colors={colors} />
        <AvisosSection period={period} operationId={operationId} colors={colors} />

        {/* Carga Operacional */}
        <SectionHeader title="Carga Operacional" colors={colors} />
        <CargaSection operationId={operationId} colors={colors} />
      </View>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: "700",
  },
  pageSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  periodRow: {
    flexDirection: "row",
    marginHorizontal: 16,
    borderRadius: 10,
    padding: 4,
    borderWidth: 1,
    marginBottom: 20,
  },
  periodBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 7,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "transparent",
  },
  periodLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  content: {
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.9,
    marginBottom: 8,
    marginTop: 20,
    marginLeft: 4,
  },
  kpiRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 4,
  },
  kpiCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: "center",
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: "700",
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: "500",
    marginTop: 2,
    textAlign: "center",
  },
  kpiSub: {
    fontSize: 10,
    marginTop: 1,
  },
  loadingRow: {
    height: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  table: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  tableHeaderCell: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginLeft: 8,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  tableName: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
  },
  tableNums: {
    flexDirection: "row",
    gap: 16,
  },
  restrictedContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  restrictedCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 28,
    alignItems: "center",
    gap: 8,
    width: "100%",
  },
  restrictedTitle: {
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
  },
  restrictedText: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  tableNum: {
    fontSize: 14,
    fontWeight: "600",
    width: 40,
    textAlign: "center",
  },
  divider: {
    height: 1,
    marginLeft: 16,
  },
});
