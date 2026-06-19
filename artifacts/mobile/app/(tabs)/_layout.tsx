import { BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Tabs } from "expo-router";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import { SymbolView } from "expo-symbols";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, View, useColorScheme } from "react-native";

import { useColors } from "@/hooks/useColors";
import { useUnreadMessagesCount } from "@/hooks/useUnreadMessages";

// IMPORTANT: iOS 26 uses NativeTabs for native tabs with liquid glass support.
// NativeTabs intentionally does NOT use custom design tokens — liquid glass
// is a system-level appearance provided by iOS and cannot be overridden.
// Custom brand colors are applied only on the ClassicTabLayout path (older iOS / Android / web).

// ─── Native (iOS 26+) ─────────────────────────────────────────────────────────
// Shows 5 primary tabs + Mais. All other screens remain routable but hidden.

function NativeTabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="meu-dia">
        <Icon sf={{ default: "sun.max", selected: "sun.max.fill" }} />
        <Label>Meu Dia</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="avisos">
        <Icon sf={{ default: "bell", selected: "bell.fill" }} />
        <Label>Avisos</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="mensagens">
        <Icon sf={{ default: "message", selected: "message.fill" }} />
        <Label>Mensagens</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="scale">
        <Icon sf={{ default: "list.clipboard", selected: "list.clipboard.fill" }} />
        <Label>Escala</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="tarefas">
        <Icon sf={{ default: "checkmark.square", selected: "checkmark.square.fill" }} />
        <Label>Tarefas</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="mais">
        <Icon sf={{ default: "ellipsis", selected: "ellipsis.circle.fill" }} />
        <Label>Mais</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

// ─── Classic (older iOS / Android / web) ──────────────────────────────────────

function ClassicTabLayout() {
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
        headerShown: true,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : colors.background,
          borderTopWidth: isWeb ? 1 : 0,
          borderTopColor: colors.border,
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground,
      }}
    >
      {/* ── Primary 5 tabs ── */}
      <Tabs.Screen
        name="meu-dia"
        options={{
          title: "Meu Dia",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="sun.max" tintColor={color} size={24} />
            ) : (
              <Feather name="sun" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="avisos"
        options={{
          title: "Avisos",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="bell" tintColor={color} size={24} />
            ) : (
              <Feather name="bell" size={22} color={color} />
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
        name="scale"
        options={{
          title: "Escala",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="list.clipboard" tintColor={color} size={24} />
            ) : (
              <Feather name="clipboard" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="tarefas"
        options={{
          title: "Tarefas",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="checkmark.square" tintColor={color} size={24} />
            ) : (
              <Feather name="check-square" size={22} color={color} />
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

      {/* ── Secondary screens — roteáveis mas ocultos da tab bar ── */}
      <Tabs.Screen name="index"       options={{ tabBarButton: () => null, title: "Home"          }} />
      <Tabs.Screen name="panel"       options={{ tabBarButton: () => null, title: "Painel"        }} />
      <Tabs.Screen name="agenda"      options={{ tabBarButton: () => null, title: "Agenda"        }} />
      <Tabs.Screen name="show-book"   options={{ tabBarButton: () => null, title: "Livro do Show" }} />
      <Tabs.Screen name="daily-book"  options={{ tabBarButton: () => null, title: "Livro do Dia"  }} />
      <Tabs.Screen name="historico"   options={{ tabBarButton: () => null, title: "Histórico"     }} />
      <Tabs.Screen name="biblioteca"  options={{ tabBarButton: () => null, title: "Biblioteca"    }} />
      <Tabs.Screen name="solicitacoes" options={{ tabBarButton: () => null, title: "Solicitações" }} />
      <Tabs.Screen name="entregas"    options={{ tabBarButton: () => null, title: "Entregas"      }} />
    </Tabs>
  );
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export default function TabLayout() {
  if (isLiquidGlassAvailable()) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}
