import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

const SECTIONS: { title: string; items: { label: string; icon: string; route: string }[] }[] = [
  {
    title: "Operacional",
    items: [
      { label: "Livro do Dia",  icon: "file-text",  route: "/(tabs)/daily-book" },
      { label: "Painel",        icon: "activity",   route: "/(tabs)/panel"      },
    ],
  },
  {
    title: "Consulta",
    items: [
      { label: "Livro do Show", icon: "book-open",  route: "/(tabs)/show-book"  },
      { label: "Agenda",        icon: "calendar",   route: "/(tabs)/agenda"     },
      { label: "Biblioteca",    icon: "book",       route: "/(tabs)/biblioteca" },
    ],
  },
  {
    title: "Registro",
    items: [
      { label: "Histórico",     icon: "clock",      route: "/(tabs)/historico"  },
    ],
  },
];

export default function MaisScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingBottom: insets.bottom + 100,
        paddingTop: 16,
      }}
      showsVerticalScrollIndicator={false}
    >
      {SECTIONS.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text
            style={[
              styles.sectionTitle,
              { color: colors.mutedForeground },
            ]}
          >
            {section.title.toUpperCase()}
          </Text>
          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            {section.items.map((item, index) => (
              <React.Fragment key={item.route}>
                <Pressable
                  style={({ pressed }) => [
                    styles.row,
                    pressed && { opacity: 0.65 },
                  ]}
                  onPress={() => router.push(item.route as any)}
                >
                  <View
                    style={[
                      styles.iconWrap,
                      { backgroundColor: colors.primary + "18" },
                    ]}
                  >
                    <Feather
                      name={item.icon as any}
                      size={18}
                      color={colors.primary}
                    />
                  </View>
                  <Text
                    style={[styles.rowLabel, { color: colors.foreground }]}
                  >
                    {item.label}
                  </Text>
                  <Feather
                    name="chevron-right"
                    size={16}
                    color={colors.mutedForeground}
                  />
                </Pressable>
                {index < section.items.length - 1 && (
                  <View
                    style={[
                      styles.divider,
                      { backgroundColor: colors.border },
                    ]}
                  />
                )}
              </React.Fragment>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.9,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
  },
  divider: {
    height: 1,
    marginLeft: 64,
  },
});
