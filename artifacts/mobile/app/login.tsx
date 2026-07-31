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
import { SvgXml } from "react-native-svg";

import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

const asinhaSvg = `<svg viewBox="0 0 100 112" xmlns="http://www.w3.org/2000/svg" fill="none">
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

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const auth = useAuth();
  const login = useLogin();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = () => {
    setError(null);
    if (!username.trim() || !password) {
      setError("Preencha o nome de usuário e a senha.");
      return;
    }
    login.mutate(
      { data: { username: username.trim().toLowerCase(), password } },
      {
        onSuccess: async (result) => {
          await auth.signIn(
            result.accessToken,
            result.refreshToken,
            result.user as Parameters<typeof auth.signIn>[2],
            result.roles as Parameters<typeof auth.signIn>[3],
          );
          router.replace("/(tabs)/meu-dia");
        },
        onError: (err: unknown) => {
          const apiError = err as { status?: number };
          if (apiError?.status === 401 || apiError?.status === 403) {
            setError("Nome de usuário ou senha inválidos.");
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
    asinha: {
      marginBottom: 12,
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
          <SvgXml xml={asinhaSvg} width={56} height={63} style={styles.asinha} />
          <Text style={styles.logo}>MyASA</Text>
          <Text style={styles.subtitle}>Tudo da ASA em um só lugar</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Nome de usuário</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="nome.sobrenome"
                placeholderTextColor={colors.mutedForeground}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="default"
                textContentType="username"
                testID="input-username"
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
            <Text style={styles.hintBold}>cris.fontana</Text>
            {" / "}
            <Text style={styles.hintBold}>Teste@123</Text>
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
