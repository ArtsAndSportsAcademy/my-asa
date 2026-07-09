import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

const MANAGER_ROLES = ["ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"];

export function ManagerOnlyRoute({ children }: { children: React.ReactNode }) {
  const { roles } = useAuth();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const isManager = roles.some((r) => MANAGER_ROLES.includes(r.role));

  if (!isManager) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 32,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          gap: 16,
        }}
      >
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            backgroundColor: colors.muted,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Feather name="lock" size={28} color={colors.mutedForeground} />
        </View>
        <Text
          style={{ fontSize: 18, fontWeight: "700", color: colors.foreground, textAlign: "center" }}
        >
          Acesso não autorizado
        </Text>
        <Text
          style={{ fontSize: 14, color: colors.mutedForeground, textAlign: "center", lineHeight: 20 }}
        >
          Este ecrã é exclusivo para gestores e supervisores da operação.
        </Text>
        <TouchableOpacity
          onPress={() => router.replace("/(tabs)/mais" as any)}
          style={{
            marginTop: 8,
            backgroundColor: colors.primary,
            borderRadius: 10,
            paddingHorizontal: 24,
            paddingVertical: 12,
          }}
          activeOpacity={0.8}
        >
          <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>Voltar ao menu</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return <>{children}</>;
}
