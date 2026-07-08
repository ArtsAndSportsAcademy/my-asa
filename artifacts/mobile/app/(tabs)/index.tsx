import { Feather } from "@expo/vector-icons";
import { useGetUserContext, getGetUserContextQueryKey, useUpdateUser } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useState, useCallback } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SvgXml } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

const ASINHA_SVG = `<svg viewBox="0 0 100 112" xmlns="http://www.w3.org/2000/svg" fill="none">
  <defs>
    <linearGradient id="ga" x1="72" y1="6" x2="18" y2="108" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#9333EA"/>
      <stop offset="55%" stop-color="#6D28D9"/>
      <stop offset="100%" stop-color="#2563EB"/>
    </linearGradient>
    <linearGradient id="gb" x1="78" y1="22" x2="20" y2="108" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#7C3AED"/>
      <stop offset="100%" stop-color="#1D4ED8"/>
    </linearGradient>
    <linearGradient id="gc" x1="80" y1="42" x2="22" y2="108" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#6D28D9"/>
      <stop offset="100%" stop-color="#1E40AF"/>
    </linearGradient>
  </defs>
  <path d="M 16,106 C 10,80 8,50 18,22 C 28,2 56,-2 76,10 C 62,18 46,34 36,58 C 28,76 22,92 16,106 Z" fill="url(#ga)" stroke="#0f0a2e" stroke-width="1.5" stroke-linejoin="round"/>
  <path d="M 20,106 C 16,84 18,60 28,40 C 40,18 64,10 82,20 C 68,28 54,46 46,66 C 36,84 28,96 20,106 Z" fill="url(#gb)" stroke="#0f0a2e" stroke-width="1.5" stroke-linejoin="round"/>
  <path d="M 24,106 C 20,88 22,70 32,54 C 44,36 68,28 84,38 C 72,46 60,60 52,78 C 44,92 34,100 24,106 Z" fill="url(#gc)" stroke="#0f0a2e" stroke-width="1.5" stroke-linejoin="round"/>
</svg>`;

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Gerência",
  SUPERVISOR_A: "Supervisor",
  SUPERVISOR_B: "Supervisor",
  TRAINER: "Treinador",
  MEMBER: "Elenco",
};

const SPECIALIZATION_LABELS: Record<string, string> = {
  PERFORMER:          "Performer",
  PROFESSOR:          "Professor",
  TRAINER:            "Treinador",
  PHYSIOTHERAPIST:    "Fisioterapeuta",
  STRENGTH_COACH:     "Preparador Físico",
  TECHNICAL_OPERATOR: "Técnico Operacional",
  OTHER:              "Outro",
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
  const [usernameModalOpen, setUsernameModalOpen] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState("");
  const [usernameError, setUsernameError] = useState<string | null>(null);

  const { data: context, isLoading, refetch } = useGetUserContext({
    query: { queryKey: getGetUserContextQueryKey() },
  });

  const updateUser = useUpdateUser();

  const openUsernameModal = () => {
    setUsernameDraft(context?.user?.username ?? "");
    setUsernameError(null);
    setUsernameModalOpen(true);
  };

  const handleSaveUsername = () => {
    const userId = context?.user?.id;
    if (!userId) return;
    const value = usernameDraft.trim();
    if (!value) {
      setUsernameError("O nome de usuário é obrigatório.");
      return;
    }
    setUsernameError(null);
    updateUser.mutate(
      { id: userId, data: { username: value } },
      {
        onSuccess: async () => {
          setUsernameModalOpen(false);
          await queryClient.invalidateQueries({ queryKey: getGetUserContextQueryKey() });
        },
        onError: (err: any) => {
          const msg =
            err?.data?.message ??
            err?.response?.data?.message ??
            "Não foi possível salvar o nome de usuário.";
          setUsernameError(msg);
        },
      },
    );
  };

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
      alignItems: "center",
    },
    brandRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    greetingBlock: {
      flex: 1,
    },
    greeting: {
      fontSize: 22,
      fontWeight: "700" as const,
      color: colors.foreground,
    },
    greetingSub: {
      fontSize: 13,
      color: colors.mutedForeground,
      marginTop: 2,
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
    usernameValueRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center",
      paddingHorizontal: 24,
    },
    modalCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "700" as const,
      color: colors.foreground,
    },
    modalSubtitle: {
      fontSize: 13,
      color: colors.mutedForeground,
      lineHeight: 18,
    },
    modalInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      color: colors.foreground,
      backgroundColor: colors.background,
    },
    modalError: {
      fontSize: 13,
      color: "#dc2626",
    },
    modalActions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: 10,
      marginTop: 4,
    },
    modalButton: {
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      minWidth: 96,
    },
    modalButtonGhost: {
      backgroundColor: colors.secondary,
    },
    modalButtonGhostText: {
      fontSize: 14,
      fontWeight: "600" as const,
      color: colors.foreground,
    },
    modalButtonPrimary: {
      backgroundColor: colors.primary,
    },
    modalButtonPrimaryText: {
      fontSize: 14,
      fontWeight: "600" as const,
      color: "#fff",
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
  const firstName = context?.user?.name?.split(" ")[0] ?? auth.user?.name?.split(" ")[0] ?? "Usuário";

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
        <View style={styles.brandRow}>
          <SvgXml xml={ASINHA_SVG} width={36} height={40} />
          <View style={styles.greetingBlock}>
            <Text style={styles.greeting} testID="text-greeting">
              Olá, {firstName}
            </Text>
            <Text style={styles.greetingSub}>Tudo da ASA em um só lugar</Text>
          </View>
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
        <View style={styles.divider} />
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Nome de usuário</Text>
          <Pressable
            style={styles.usernameValueRow}
            onPress={openUsernameModal}
            testID="button-edit-username"
          >
            <Text style={styles.infoValue} testID="text-username">
              {context?.user?.username ?? "—"}
            </Text>
            <Feather name="edit-2" size={14} color={colors.primary} />
          </Pressable>
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
        {context?.user?.specialization && (
          <>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Especialização</Text>
              <Text style={styles.infoValue} testID="text-specialization">
                {SPECIALIZATION_LABELS[context.user.specialization] ?? context.user.specialization}
              </Text>
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
          <Text style={styles.emptyText}>
            Nenhuma operação atribuída ao seu perfil ainda.
          </Text>
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
          <Text style={styles.emptyText}>
            Nenhum grupo operacional atribuído ao seu perfil ainda.
          </Text>
        )}
      </View>

      <Modal
        visible={usernameModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setUsernameModalOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Nome de usuário</Text>
            <Text style={styles.modalSubtitle}>
              Use apenas letras, números e pontos. Acentos e espaços são convertidos automaticamente.
            </Text>
            <TextInput
              value={usernameDraft}
              onChangeText={setUsernameDraft}
              placeholder="nome.sobrenome"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              style={styles.modalInput}
              testID="input-username"
            />
            {usernameError && (
              <Text style={styles.modalError} testID="text-username-error">
                {usernameError}
              </Text>
            )}
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalButton, styles.modalButtonGhost]}
                onPress={() => setUsernameModalOpen(false)}
                disabled={updateUser.isPending}
              >
                <Text style={styles.modalButtonGhostText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleSaveUsername}
                disabled={updateUser.isPending}
                testID="button-save-username"
              >
                {updateUser.isPending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalButtonPrimaryText}>Salvar</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}
