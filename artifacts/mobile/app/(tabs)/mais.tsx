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

import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

const MANAGER_ROLES = ["ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"];

type SectionItem = {
  label: string;
  subtitle?: string;
  icon: string;
  route: string;
  managerOnly?: boolean;
};

const SECTIONS: { title: string; items: SectionItem[] }[] = [
  {
    title: "Operacional",
    items: [
      { label: "Solicitações",  icon: "inbox",       route: "/(tabs)/solicitacoes" },
      { label: "Livro do Dia",  subtitle: "Roteiro operacional do dia",       icon: "file-text", route: "/(tabs)/daily-book"   },
      { label: "Entregas",      subtitle: "Materiais e conteúdos atribuídos", icon: "package",   route: "/(tabs)/entregas"     },
      { label: "Painel",            subtitle: "Saúde e cobertura operacional",    icon: "activity",  route: "/(tabs)/panel",                managerOnly: true },
      { label: "Responsabilidades", subtitle: "Funções permanentes da operação",  icon: "users",     route: "/(tabs)/responsabilidades" },
    ],
  },
  {
    title: "Consulta",
    items: [
      { label: "Livro do Show", subtitle: "Estrutura oficial do espetáculo", icon: "book-open", route: "/(tabs)/show-book"  },
      { label: "Agenda",        icon: "calendar",   route: "/(tabs)/agenda"     },
      { label: "Biblioteca",    icon: "book",       route: "/(tabs)/biblioteca" },
    ],
  },
  {
    title: "Registro",
    items: [
      { label: "Histórico",    icon: "clock",       route: "/(tabs)/historico" },
      { label: "Indicadores",  subtitle: "Métricas da gestão operacional", icon: "trending-up", route: "/(tabs)/insights", managerOnly: true },
    ],
  },
  {
    title: "Perfil",
    items: [
      { label: "Meu Perfil", subtitle: "Papel, operação, grupos e delegações", icon: "user", route: "/(tabs)/" },
    ],
  },
];

export default function MaisScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { roles } = useAuth();

  const isManager = roles.some((r) => MANAGER_ROLES.includes(r.role));

  const visibleSections = SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.managerOnly || isManager),
  })).filter((section) => section.items.length > 0);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingBottom: insets.bottom + 100,
        paddingTop: 16,
      }}
      showsVerticalScrollIndicator={false}
    >
      {visibleSections.map((section) => (
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
              <React.Fragment key={item.route + item.label}>
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
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowLabel, { color: colors.foreground }]}>
                      {item.label}
                    </Text>
                    {item.subtitle && (
                      <Text style={[styles.rowSubtitle, { color: colors.mutedForeground }]}>
                        {item.subtitle}
                      </Text>
                    )}
                  </View>
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
    paddingVertical: 12,
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
    fontSize: 15,
    fontWeight: "500",
  },
  rowSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  divider: {
    height: 1,
    marginLeft: 64,
  },
});
