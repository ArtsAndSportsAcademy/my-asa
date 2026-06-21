import { useChangeMyPassword } from "@workspace/api-client-react";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function ForcePasswordChangeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const auth = useAuth();
  const changePassword = useChangeMyPassword();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    setError(null);
    if (!currentPassword || !newPassword) {
      setError("Preencha todos os campos.");
      return;
    }
    if (newPassword.length < 6) {
      setError("A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("A nova senha e a confirmação não coincidem.");
      return;
    }
    if (newPassword === currentPassword) {
      setError("A nova senha deve ser diferente da senha provisória.");
      return;
    }

    changePassword.mutate(
      { data: { currentPassword, newPassword } },
      {
        onSuccess: async () => {
          await auth.markPasswordChanged();
        },
        onError: (err: unknown) => {
          const apiError = err as { status?: number };
          if (apiError?.status === 401 || apiError?.status === 400) {
            setError("Senha provisória incorreta.");
          } else {
            setError("Não foi possível alterar a senha. Tente novamente.");
          }
        },
      },
    );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: insets.top + 24,
      paddingBottom: insets.bottom,
      paddingHorizontal: 24,
    },
    title: {
      fontSize: 24,
      fontWeight: "700" as const,
      color: colors.foreground,
      marginBottom: 8,
    },
    description: {
      fontSize: 15,
      color: colors.mutedForeground,
      marginBottom: 24,
      lineHeight: 21,
    },
    form: {
      gap: 16,
    },
    label: {
      fontSize: 13,
      fontWeight: "600" as const,
      color: colors.foreground,
      marginBottom: 6,
    },
    inputWrapper: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      backgroundColor: colors.card,
      paddingHorizontal: 14,
    },
    input: {
      height: 48,
      fontSize: 15,
      color: colors.foreground,
    },
    errorBox: {
      backgroundColor: "#FEE2E2",
      borderRadius: 8,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    errorText: {
      color: colors.destructive,
      fontSize: 14,
    },
    submitButton: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      height: 52,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 8,
    },
    submitButtonDisabled: {
      opacity: 0.6,
    },
    submitText: {
      color: colors.primaryForeground,
      fontSize: 16,
      fontWeight: "600" as const,
    },
    signOutButton: {
      alignItems: "center",
      justifyContent: "center",
      height: 44,
    },
    signOutText: {
      color: colors.mutedForeground,
      fontSize: 15,
    },
  });

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.container}>
        <Text style={styles.title}>Crie sua senha</Text>
        <Text style={styles.description}>
          Por segurança, você precisa trocar a senha provisória por uma senha sua antes de continuar.
        </Text>

        <View style={styles.form}>
          <View>
            <Text style={styles.label}>Senha provisória (atual)</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={colors.mutedForeground}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry
                testID="input-current-password"
              />
            </View>
          </View>

          <View>
            <Text style={styles.label}>Nova senha</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="Mínimo 6 caracteres"
                placeholderTextColor={colors.mutedForeground}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                testID="input-new-password"
              />
            </View>
          </View>

          <View>
            <Text style={styles.label}>Confirmar nova senha</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="Repita a nova senha"
                placeholderTextColor={colors.mutedForeground}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                testID="input-confirm-password"
              />
            </View>
          </View>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Pressable
            style={[styles.submitButton, changePassword.isPending && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={changePassword.isPending}
            testID="button-save-password"
          >
            {changePassword.isPending ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Text style={styles.submitText}>Salvar nova senha</Text>
            )}
          </Pressable>

          <Pressable
            style={styles.signOutButton}
            onPress={() => auth.signOut()}
            disabled={changePassword.isPending}
            testID="button-sign-out"
          >
            <Text style={styles.signOutText}>Sair</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
