import { Feather } from "@expo/vector-icons";
import { useGetUserContext, getGetUserContextQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useState, useCallback } from "react";
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

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrador",
  SUPERVISOR_A: "Supervisor Sênior",
  SUPERVISOR_B: "Supervisor",
  MEMBER: "Membro",
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Ativa",
  DRAFT: "Rascunho",
  PAUSED: "Pausada",
  ARCHIVED: "Arquivada",
};

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const auth = useAuth();
  const queryClient = useQueryClient();

  const [refreshing, setRefreshing] = useState(false);

  const { data: context, isLoading, refetch } = useGetUserContext({
    query: { queryKey: getGetUserContextQueryKey() },
  });

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const handleLogout = async () => {
    await auth.signOut();
    router.replace("/login");
  };

  const activeRoles = context?.roles?.filter((r) => r.active) ?? [];
  const primaryRole = activeRoles[0];
  const primaryOperation = primaryRole
    ? context?.operations?.find((op) => op.id === primaryRole.operationId)
    : null;
  const primaryGroup = primaryRole?.groupId
    ? context?.groups?.find((g) => g.id === primaryRole.groupId)
    : null;

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingTop: insets.top + 16,
      paddingBottom: insets.bottom + 32,
      gap: 20,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
    },
    appName: {
      fontSize: 13,
      fontWeight: "700" as const,
      color: colors.primary,
      letterSpacing: 1.5,
      textTransform: "uppercase",
    },
    greeting: {
      fontSize: 22,
      fontWeight: "700" as const,
      color: colors.foreground,
      marginTop: 4,
    },
    headerActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    iconButton: {
      padding: 8,
      borderRadius: 8,
      backgroundColor: colors.secondary,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    activeCard: {
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 16,
      borderWidth: 1.5,
      borderColor: colors.primary,
    },
    cardTitle: {
      fontSize: 11,
      fontWeight: "700" as const,
      color: colors.mutedForeground,
      letterSpacing: 1.2,
      textTransform: "uppercase",
      marginBottom: 12,
    },
    activeCardTitle: {
      fontSize: 11,
      fontWeight: "700" as const,
      color: colors.primary,
      letterSpacing: 1.2,
      textTransform: "uppercase",
      marginBottom: 12,
    },
    infoRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 6,
    },
    infoLabel: {
      fontSize: 14,
      color: colors.mutedForeground,
    },
    infoValue: {
      fontSize: 14,
      fontWeight: "600" as const,
      color: colors.foreground,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 2,
    },
    roleBadge: {
      backgroundColor: colors.secondary,
      borderRadius: 6,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    roleBadgePrimary: {
      backgroundColor: colors.primary + "22",
      borderRadius: 6,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderWidth: 1,
      borderColor: colors.primary + "44",
    },
    roleBadgeText: {
      fontSize: 12,
      fontWeight: "600" as const,
      color: colors.primary,
    },
    operationItem: {
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    operationName: {
      fontSize: 15,
      fontWeight: "600" as const,
      color: colors.foreground,
    },
    operationStatus: {
      fontSize: 12,
      color: colors.mutedForeground,
      marginTop: 2,
    },
    groupItem: {
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    groupName: {
      fontSize: 14,
      color: colors.foreground,
    },
    emptyText: {
      fontSize: 14,
      color: colors.mutedForeground,
      fontStyle: "italic",
    },
    loadingContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    activeContextRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 4,
    },
    activeContextLabel: {
      fontSize: 12,
      color: colors.mutedForeground,
      width: 80,
    },
    activeContextValue: {
      fontSize: 13,
      fontWeight: "600" as const,
      color: colors.foreground,
      flex: 1,
    },
  });

  if (isLoading && !context) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  const roleLabel = primaryRole ? ROLE_LABELS[primaryRole.role] ?? primaryRole.role : "—";

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.appName}>MyASA</Text>
          <Text style={styles.greeting} testID="text-greeting">
            Olá, {context?.user?.name?.split(" ")[0] ?? auth.user?.name?.split(" ")[0] ?? "Usuário"}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable style={styles.iconButton} onPress={handleRefresh} disabled={refreshing}>
            <Feather name="refresh-cw" size={16} color={colors.mutedForeground} />
          </Pressable>
          <Pressable style={styles.iconButton} onPress={handleLogout} testID="button-logout">
            <Feather name="log-out" size={16} color={colors.mutedForeground} />
          </Pressable>
        </View>
      </View>

      {primaryRole && (
        <View style={styles.activeCard}>
          <Text style={styles.activeCardTitle}>Contexto Ativo</Text>
          <View style={styles.activeContextRow}>
            <Text style={styles.activeContextLabel}>Papel</Text>
            <View style={styles.roleBadgePrimary}>
              <Text style={styles.roleBadgeText}>{roleLabel}</Text>
            </View>
          </View>
          {primaryOperation && (
            <>
              <View style={styles.divider} />
              <View style={styles.activeContextRow}>
                <Text style={styles.activeContextLabel}>Operação</Text>
                <Text style={styles.activeContextValue}>{primaryOperation.name}</Text>
              </View>
            </>
          )}
          {primaryGroup && (
            <>
              <View style={styles.divider} />
              <View style={styles.activeContextRow}>
                <Text style={styles.activeContextLabel}>Grupo</Text>
                <Text style={styles.activeContextValue}>{primaryGroup.name}</Text>
              </View>
            </>
          )}
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Perfil</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Email</Text>
          <Text style={styles.infoValue} testID="text-email">
            {context?.user?.email ?? auth.user?.email ?? "—"}
          </Text>
        </View>
        {activeRoles.length > 0 && (
          <>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Papéis ({activeRoles.length})</Text>
              <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                {activeRoles.slice(0, 2).map((r) => (
                  <View key={r.id} style={styles.roleBadge}>
                    <Text style={styles.roleBadgeText} testID="text-role">
                      {ROLE_LABELS[r.role] ?? r.role}
                    </Text>
                  </View>
                ))}
                {activeRoles.length > 2 && (
                  <View style={styles.roleBadge}>
                    <Text style={styles.roleBadgeText}>+{activeRoles.length - 2}</Text>
                  </View>
                )}
              </View>
            </View>
          </>
        )}
        {context?.organization && (
          <>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Organização</Text>
              <Text style={styles.infoValue} testID="text-org">
                {context.organization.name}
              </Text>
            </View>
          </>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          Operações ({context?.operations?.length ?? 0})
        </Text>
        {context?.operations?.length ? (
          context.operations.map((op) => (
            <View key={op.id} style={styles.operationItem} testID={`card-operation-${op.id}`}>
              <Text style={styles.operationName}>{op.name}</Text>
              <Text style={styles.operationStatus}>
                {STATUS_LABELS[op.status] ?? op.status}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>Nenhuma operação atribuída</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          Grupos Operacionais ({context?.groups?.length ?? 0})
        </Text>
        {context?.groups?.length ? (
          context.groups.map((g) => (
            <View key={g.id} style={styles.groupItem} testID={`card-group-${g.id}`}>
              <Text style={styles.groupName}>{g.name}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>Nenhum grupo atribuído</Text>
        )}
      </View>
    </ScrollView>
  );
}
