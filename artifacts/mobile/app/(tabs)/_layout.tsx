import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, View, useColorScheme } from "react-native";

import { useColors } from "@/hooks/useColors";
import { useUnreadMessagesCount } from "@/hooks/useUnreadMessages";

// 4 abas primárias: Início, Mural, Mensagens, Mais.
// Todos os demais ecrãs continuam roteáveis (a partir do hub "Mais"), mas
// ocultos da barra. Cada ecrã renderiza o seu próprio cabeçalho (insets.top),
// por isso o cabeçalho do navegador fica desativado (headerShown: false) para
// não duplicar.
//
// NOTA: trocámos os NativeTabs (iOS 26, API experimental "unstable") pela barra
// clássica em todas as plataformas. Com 6+ abas, os NativeTabs criavam uma aba
// "More" nativa preta e quebrada e os ecrãs não abriam. A barra clássica mantém
// o visual limpo (blur no iOS) e abre tudo.

export default function TabLayout() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const unreadMessages = useUnreadMessagesCount();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  const tabBarBackground = () =>
    isIOS ? (
      <BlurView
        intensity={100}
        tint={isDark ? "dark" : "light"}
        style={StyleSheet.absoluteFill}
      />
    ) : isWeb ? (
      <View
        style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]}
      />
    ) : null;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : colors.background,
          borderTopWidth: isWeb ? 1 : 0,
          borderTopColor: colors.border,
          elevation: 0,
          ...(isWeb
            ? {
                height: 84,
                flexDirection: "row",
                justifyContent: "space-around",
                alignItems: "center",
              }
            : {}),
        },
        tabBarItemStyle: {
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
        },
        tabBarBackground,
      }}
    >
      {/* ── 4 abas primárias ── */}
      <Tabs.Screen
        name="meu-dia"
        options={{
          title: "Início",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="house" tintColor={color} size={24} />
            ) : (
              <Feather name="home" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="avisos"
        options={{
          title: "Mural",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="megaphone" tintColor={color} size={24} />
            ) : (
              <Feather name="layout" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="mensagens"
        options={{
          title: "Mensagens",
          tabBarBadge: unreadMessages > 0 ? (unreadMessages > 99 ? "99+" : unreadMessages) : undefined,
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="message" tintColor={color} size={24} />
            ) : (
              <Feather name="message-square" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="mais"
        options={{
          title: "Mais",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="ellipsis.circle" tintColor={color} size={24} />
            ) : (
              <Feather name="more-horizontal" size={22} color={color} />
            ),
        }}
      />

    </Tabs>
  );
}
