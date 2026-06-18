import { Feather } from "@expo/vector-icons";
import { useGetOperationalPanel } from "@workspace/api-client-react";
import type {
  OperationalException,
  OperationalPendingBook,
  OperationalUpcomingEvent,
} from "@workspace/api-client-react";
import React from "react";
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

// ─── Health config ─────────────────────────────────────────────────────────────

const HEALTH_ICON: Record<string, string> = {
  HEALTHY: "check-circle", ATTENTION: "alert-circle", RISK: "alert-triangle", CRITICAL: "x-circle",
};
const HEALTH_LABEL: Record<string, string> = {
  HEALTHY: "Saudável", ATTENTION: "Atenção", RISK: "Risco", CRITICAL: "Crítico",
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  SHOW: "Apresentação", REHEARSAL: "Ensaio", MEETING: "Reunião",
  OPERATIONAL_BLOCK: "Bloco", COLLECTIVE_VACATION: "Férias",
};
const EX_TYPE_LABELS: Record<string, string> = {
  ALLOCATION_EXCEPTION: "Exceção", OPEN_POSITION: "Aberto",
  CONFLICT: "Conflito", MANUAL_OVERRIDE: "Substituição",
};

export default function PanelScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = React.useState(false);

  const { data, isLoading, refetch } = useGetOperationalPanel({});

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  // Dynamic health colors
  function healthColor(status: string) {
    switch (status) {
      case "HEALTHY": return "#22C55E";
      case "ATTENTION": return "#F59E0B";
      case "RISK": return "#F97316";
      case "CRITICAL": return "#EF4444";
      default: return colors.mutedForeground;
    }
  }

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16, paddingBottom: insets.bottom + 100 },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
    title: { fontSize: 20, fontWeight: "700", color: colors.foreground },
    subtitle: { fontSize: 12, color: colors.mutedForeground, marginTop: 2 },
    section: { marginBottom: 12 },
    sectionTitle: { fontSize: 12, fontWeight: "600", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
    card: { backgroundColor: colors.card, borderRadius: colors.radius, padding: 16, borderWidth: 1, borderColor: colors.border },
    row: { flexDirection: "row", alignItems: "center", gap: 8 },
    divider: { height: 1, backgroundColor: colors.border, marginVertical: 0 },
    itemPad: { padding: 12 },
    badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 100, alignSelf: "flex-start" },
    badgeText: { fontSize: 11, fontWeight: "600" },
    emptyText: { fontSize: 13, color: colors.mutedForeground, textAlign: "center", paddingVertical: 12 },
    coverBar: { height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: "hidden", marginTop: 6 },
    coverFill: { height: 6, borderRadius: 3 },
  });

  if (isLoading) {
    return (
      <View style={[s.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={{ color: colors.mutedForeground, marginTop: 12, fontSize: 13 }}>
          Consolidando painel…
        </Text>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={[s.container, { justifyContent: "center", alignItems: "center" }]}>
        <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>Sem dados disponíveis.</Text>
      </View>
    );
  }

  const { health, coverage, exceptions, pendingBooks, upcomingEvents, generatedAt } = data;
  const hColor = healthColor(health.status);
  const hIcon = HEALTH_ICON[health.status] ?? "alert-circle";
  const h48 = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().split("T")[0];

  const criticalExceptions = exceptions.filter(
    (e) => e.type === "OPEN_POSITION" || e.type === "CONFLICT"
  );
  const urgentEvents = upcomingEvents.filter((e) => e.date <= h48 && !e.hasDailyBook);

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
      }
    >
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.title}>Painel Operacional</Text>
          <Text style={s.subtitle}>
            Atualizado às {new Date(generatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </Text>
        </View>
      </View>

      {/* ── Saúde ── */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Saúde Operacional</Text>
        <View style={[s.card, { borderLeftWidth: 4, borderLeftColor: hColor }]}>
          <View style={s.row}>
            <Feather name={hIcon as any} size={24} color={hColor} />
            <Text style={{ fontSize: 18, fontWeight: "700", color: hColor }}>
              {HEALTH_LABEL[health.status]}
            </Text>
          </View>
          {health.reasons.map((r, i) => (
            <Text key={i} style={{ fontSize: 13, color: colors.mutedForeground, marginTop: 4 }}>
              • {r}
            </Text>
          ))}
        </View>
      </View>

      {/* ── Alertas críticos: eventos em 48h sem livro ── */}
      {urgentEvents.length > 0 && (
        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: "#EF4444" }]}>⚠ Ação Imediata (48h)</Text>
          <View style={[s.card, { borderColor: "#FCA5A5", borderWidth: 1 }]}>
            {urgentEvents.map((ev: OperationalUpcomingEvent, idx: number) => (
              <View key={ev.id}>
                {idx > 0 && <View style={s.divider} />}
                <View style={[s.itemPad, { flexDirection: "row", alignItems: "center", gap: 10 }]}>
                  <Feather name="calendar" size={16} color="#EF4444" />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }}>
                      {ev.title}
                    </Text>
                    <Text style={{ fontSize: 12, color: "#EF4444", marginTop: 2 }}>
                      {new Date(ev.date + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" })}
                      {ev.startTime && ` às ${ev.startTime.slice(0, 5)}`}
                      {" · Livro pendente"}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* ── Cobertura resumida ── */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Cobertura</Text>
        <View style={s.card}>
          <View style={[s.row, { justifyContent: "space-between" }]}>
            <Text style={{ fontSize: 28, fontWeight: "700", color: colors.foreground }}>
              {coverage.overall.pct.toFixed(0)}%
            </Text>
            <View style={[s.badge, {
              backgroundColor: coverage.overall.status === "COMPLETE" ? "#DCFCE7" :
                coverage.overall.status === "PARTIAL" ? "#FEF3C7" : "#FEE2E2"
            }]}>
              <Text style={[s.badgeText, {
                color: coverage.overall.status === "COMPLETE" ? "#16A34A" :
                  coverage.overall.status === "PARTIAL" ? "#D97706" : "#DC2626"
              }]}>
                {coverage.overall.status === "COMPLETE" ? "Completa" :
                  coverage.overall.status === "PARTIAL" ? "Parcial" : "Insuficiente"}
              </Text>
            </View>
          </View>
          <View style={s.coverBar}>
            <View style={[s.coverFill, {
              width: `${Math.min(coverage.overall.pct, 100)}%`,
              backgroundColor: coverage.overall.status === "COMPLETE" ? "#22C55E" :
                coverage.overall.status === "PARTIAL" ? "#F59E0B" : "#EF4444",
            }]} />
          </View>
          <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 6 }}>
            {coverage.overall.covered} de {coverage.overall.total} posições cobertas
          </Text>
        </View>
      </View>

      {/* ── Conflitos e abertos ── */}
      {criticalExceptions.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Conflitos e Posições Abertas ({criticalExceptions.length})</Text>
          <View style={s.card}>
            {criticalExceptions.slice(0, 5).map((ex: OperationalException, idx: number) => (
              <View key={ex.id}>
                {idx > 0 && <View style={s.divider} />}
                <View style={s.itemPad}>
                  <View style={[s.row, { marginBottom: 4 }]}>
                    <View style={[s.badge, {
                      backgroundColor: ex.type === "CONFLICT" ? "#FFEDD5" : "#FEE2E2"
                    }]}>
                      <Text style={[s.badgeText, {
                        color: ex.type === "CONFLICT" ? "#EA580C" : "#DC2626"
                      }]}>
                        {EX_TYPE_LABELS[ex.type] ?? ex.type}
                      </Text>
                    </View>
                    {ex.positionName && (
                      <Text style={{ fontSize: 13, fontWeight: "600", color: colors.foreground, flex: 1 }} numberOfLines={1}>
                        {ex.positionName}
                      </Text>
                    )}
                  </View>
                  <Text style={{ fontSize: 12, color: colors.mutedForeground }}>{ex.reason}</Text>
                  {ex.eventTitle && (
                    <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 2 }}>
                      {ex.eventTitle} · {new Date(ex.date + "T00:00:00").toLocaleDateString("pt-BR")}
                    </Text>
                  )}
                </View>
              </View>
            ))}
            {criticalExceptions.length > 5 && (
              <Text style={{ fontSize: 12, color: colors.mutedForeground, padding: 12, textAlign: "center" }}>
                +{criticalExceptions.length - 5} mais no painel web
              </Text>
            )}
          </View>
        </View>
      )}

      {/* ── Próximos eventos ── */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Próximos Eventos</Text>
        {upcomingEvents.length === 0 ? (
          <View style={s.card}>
            <Text style={s.emptyText}>Nenhum evento próximo</Text>
          </View>
        ) : (
          <View style={s.card}>
            {upcomingEvents.slice(0, 7).map((ev: OperationalUpcomingEvent, idx: number) => (
              <View key={ev.id}>
                {idx > 0 && <View style={s.divider} />}
                <View style={[s.itemPad, { flexDirection: "row", alignItems: "center", gap: 10 }]}>
                  <Feather name="calendar" size={14} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: "500", color: colors.foreground }} numberOfLines={1}>
                      {ev.title}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 2 }}>
                      {new Date(ev.date + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" })}
                      {ev.startTime && ` · ${ev.startTime.slice(0, 5)}`}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    {ev.coveragePct !== null && ev.coveragePct !== undefined && (
                      <Text style={{
                        fontSize: 12, fontWeight: "600",
                        color: ev.coveragePct >= 100 ? "#22C55E" : ev.coveragePct >= 60 ? "#F59E0B" : "#EF4444"
                      }}>
                        {ev.coveragePct.toFixed(0)}%
                      </Text>
                    )}
                    <View style={[s.row, { gap: 4 }]}>
                      <Feather name="layers" size={12} color={ev.hasScale ? colors.primary : colors.border} />
                      <Feather name="book-open" size={12} color={ev.hasDailyBook ? "#2563EB" : colors.border} />
                    </View>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* ── Livros pendentes ── */}
      {pendingBooks.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Livros Não Publicados ({pendingBooks.length})</Text>
          <View style={s.card}>
            {pendingBooks.map((book: OperationalPendingBook, idx: number) => (
              <View key={book.id}>
                {idx > 0 && <View style={s.divider} />}
                <View style={[s.itemPad, { flexDirection: "row", alignItems: "center", gap: 10 }]}>
                  <Feather name="book" size={14} color="#F59E0B" />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: "500", color: colors.foreground }} numberOfLines={1}>
                      {book.eventTitle}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 2 }}>
                      {new Date(book.eventDate + "T00:00:00").toLocaleDateString("pt-BR")} · Rascunho v{book.version}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}
