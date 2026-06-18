import { Feather } from "@expo/vector-icons";
import { useLogin } from "@workspace/api-client-react";
import { useRouter } from "expo-router";
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

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const auth = useAuth();
  const login = useLogin();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = () => {
    setError(null);
    if (!email.trim() || !password) {
      setError("Preencha email e senha.");
      return;
    }
    login.mutate(
      { data: { email: email.trim().toLowerCase(), password } },
      {
        onSuccess: async (result) => {
          await auth.signIn(
            result.accessToken,
            result.refreshToken,
            result.user as Parameters<typeof auth.signIn>[2],
            result.roles as Parameters<typeof auth.signIn>[3],
          );
          router.replace("/(tabs)");
        },
        onError: (err: unknown) => {
          const apiError = err as { status?: number };
          if (apiError?.status === 401 || apiError?.status === 403) {
            setError("Email ou senha inválidos.");
          } else {
            setError("Erro de conexão. Tente novamente.");
          }
        },
      },
    );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: insets.top,
      paddingBottom: insets.bottom,
      paddingHorizontal: 24,
    },
    header: {
      flex: 1,
      justifyContent: "center",
      marginBottom: 8,
    },
    logo: {
      fontSize: 28,
      fontWeight: "700" as const,
      color: colors.primary,
      letterSpacing: -0.5,
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 15,
      color: colors.mutedForeground,
    },
    form: {
      flex: 2,
      justifyContent: "flex-start",
      paddingTop: 32,
      gap: 16,
    },
    label: {
      fontSize: 13,
      fontWeight: "600" as const,
      color: colors.foreground,
      marginBottom: 6,
    },
    inputWrapper: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      backgroundColor: colors.card,
      paddingHorizontal: 14,
    },
    input: {
      flex: 1,
      height: 48,
      fontSize: 15,
      color: colors.foreground,
    },
    eyeButton: {
      padding: 4,
    },
    fieldGroup: {
      gap: 0,
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
    hint: {
      fontSize: 13,
      color: colors.mutedForeground,
      textAlign: "center",
      marginTop: 16,
    },
    hintBold: {
      fontWeight: "600" as const,
      color: colors.foreground,
    },
  });

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.logo}>MyASA</Text>
          <Text style={styles.subtitle}>Plataforma operacional para produções artísticas</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Email</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="seu@email.com"
                placeholderTextColor={colors.mutedForeground}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                testID="input-email"
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Senha</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={colors.mutedForeground}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                textContentType="password"
                testID="input-password"
              />
              <Pressable
                onPress={() => setShowPassword((v) => !v)}
                style={styles.eyeButton}
                testID="button-toggle-password"
              >
                <Feather
                  name={showPassword ? "eye-off" : "eye"}
                  size={18}
                  color={colors.mutedForeground}
                />
              </Pressable>
            </View>
          </View>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Pressable
            style={[styles.submitButton, login.isPending && styles.submitButtonDisabled]}
            onPress={handleLogin}
            disabled={login.isPending}
            testID="button-login"
          >
            {login.isPending ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Text style={styles.submitText}>Entrar</Text>
            )}
          </Pressable>

          <Text style={styles.hint}>
            Demo:{" "}
            <Text style={styles.hintBold}>admin@myasa.demo</Text>
            {" / "}
            <Text style={styles.hintBold}>myasa123</Text>
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
