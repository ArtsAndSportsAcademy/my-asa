import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
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
import { useListFolgas } from "@workspace/api-client-react";

const MANAGER_ROLES = ["ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"];

const TYPE_LABELS: Record<string, string> = {
  DAY_OFF:     "Folga",
  NO_SHOW:     "No-show",
  RECESSO:     "Recesso",
  AFASTAMENTO: "Afastamento",
  RESTRICAO:   "Restrição",
  OUTRO:       "Outro",
};

const ORIGEM_LABELS: Record<string, string> = {
  MANUAL:      "Manual",
  SOLICITACAO: "Via Solicitação",
};

export default function FolgasScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { sub, roles } = useAuth();

  const isManager = roles.some((r) => MANAGER_ROLES.includes(r.role));
  const operationId = roles[0]?.operationId ?? undefined;

  const params = isManager
    ? { operationId, status: "ACTIVE" }
    : { userId: sub, status: "ACTIVE" };

  const { data, isLoading, refetch, isRefetching } = useListFolgas(params, {
    query: { enabled: !!sub },
  });

  const folgas = data?.folgas ?? [];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 100, paddingTop: 16 }}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: colors.primary + "18" }]}>
          <Feather name="calendar" size={22} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.foreground }]}>
            {isManager ? "Folgas da Equipe" : "Minhas Folgas"}
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {isManager ? "Ausências ativas na operação" : "Dias de descanso e ausências"}
          </Text>
        </View>
      </View>

      {/* Content */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : folgas.length === 0 ? (
          <View style={styles.center}>
            <Feather name="calendar" size={32} color={colors.mutedForeground} style={{ opacity: 0.4, marginBottom: 8 }} />
            <Text style={[styles.empty, { color: colors.mutedForeground }]}>
              {isManager ? "Nenhuma folga ativa na equipe." : "Você não tem folgas registradas."}
            </Text>
            {!isManager && (
              <Pressable
                style={({ pressed }) => [styles.linkBtn, { opacity: pressed ? 0.6 : 1 }]}
                onPress={() => router.push("/(tabs)/solicitacoes")}
              >
                <Text style={[styles.linkText, { color: colors.primary }]}>
                  Solicitar folga →
                </Text>
              </Pressable>
            )}
          </View>
        ) : (
          folgas.map((f, index) => (
            <React.Fragment key={f.id}>
              <View style={styles.row}>
                {/* Date badge */}
                <View style={[styles.dateBadge, { backgroundColor: colors.primary + "14" }]}>
                  <Feather name="calendar" size={14} color={colors.primary} />
                  <Text style={[styles.dateText, { color: colors.primary }]}>
                    {f.startDate === f.endDate
                      ? f.startDate
                      : `${f.startDate.slice(5)}\n→ ${f.endDate.slice(5)}`}
                  </Text>
                </View>

                {/* Info */}
                <View style={{ flex: 1 }}>
                  {isManager && (
                    <Text style={[styles.memberName, { color: colors.foreground }]}>
                      {f.userName}
                    </Text>
                  )}
                  <View style={styles.badges}>
                    <View style={[styles.typeBadge, { backgroundColor: colors.primary + "14" }]}>
                      <Text style={[styles.typeText, { color: colors.primary }]}>
                        {TYPE_LABELS[f.type] ?? f.type}
                      </Text>
                    </View>
                    <View style={[styles.origemBadge, { backgroundColor: colors.muted }]}>
                      <Text style={[styles.origemText, { color: colors.mutedForeground }]}>
                        {ORIGEM_LABELS[f.origem] ?? f.origem}
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

      {/* Hint for members */}
      {!isManager && folgas.length > 0 && (
        <Pressable
          style={({ pressed }) => [styles.footerLink, { opacity: pressed ? 0.6 : 1 }]}
          onPress={() => router.push("/(tabs)/solicitacoes")}
        >
          <Text style={[styles.linkText, { color: colors.primary }]}>
            + Solicitar nova folga
          </Text>
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
    marginBottom: 16,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  card: {
    marginHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  center: {
    paddingVertical: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: {
    fontSize: 14,
    textAlign: "center",
    paddingHorizontal: 24,
  },
  linkBtn: {
    marginTop: 12,
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
  memberName: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 6,
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
  origemBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  origemText: {
    fontSize: 11,
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
  footerLink: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  linkText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
