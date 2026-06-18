import { Feather } from "@expo/vector-icons";
import { useGetUserContext, getGetUserContextQueryKey } from "@workspace/api-client-react";
import { useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
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
  SUPERVISOR_A: "Supervisor A",
  SUPERVISOR_B: "Supervisor B",
  MEMBER: "Membro",
};

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const auth = useAuth();

  const { data: context, isLoading } = useGetUserContext({
    query: { queryKey: getGetUserContextQueryKey() },
  });

  const handleLogout = async () => {
    await auth.signOut();
    router.replace("/login");
  };

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
    logoutButton: {
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
    cardTitle: {
      fontSize: 11,
      fontWeight: "700" as const,
      color: colors.mutedForeground,
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
  });

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  const primaryRole = context?.roles?.[0];
  const roleLabel = primaryRole ? ROLE_LABELS[primaryRole.role] ?? primaryRole.role : "—";

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.header}>
        <View>
          <Text style={styles.appName}>MyASA</Text>
          <Text style={styles.greeting} testID="text-greeting">
            Olá, {context?.user?.name?.split(" ")[0] ?? auth.user?.name?.split(" ")[0] ?? "Usuário"}
          </Text>
        </View>
        <Pressable style={styles.logoutButton} onPress={handleLogout} testID="button-logout">
          <Feather name="log-out" size={18} color={colors.mutedForeground} />
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Perfil</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Email</Text>
          <Text style={styles.infoValue} testID="text-email">
            {context?.user?.email ?? auth.user?.email ?? "—"}
          </Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Papel</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText} testID="text-role">{roleLabel}</Text>
          </View>
        </View>
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
                {op.status === "ACTIVE" ? "Ativa" : "Arquivada"}
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
