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
const SUPERVISOR_ROLES = ["SUPERVISOR_A", "SUPERVISOR_B"];

type SectionItem = {
  label: string;
  subtitle?: string;
  icon: string;
  route?: string;
  disabled?: boolean;
  badge?: string;
};

type Section = { title: string; items: SectionItem[] };

function buildManagerSections(isSupervisor: boolean): Section[] {
  return [
    {
      title: "Operação",
      items: [
        { label: "Escala",        subtitle: "Escala completa da operação",    icon: "list",        route: "/(tabs)/scale"             },
        { label: "Atividades",    subtitle: "Atividades da operação",         icon: "activity",    disabled: true, badge: "Em breve" },
        { label: "Livro do Dia",  subtitle: "Roteiro operacional do dia",     icon: "file-text",   route: "/(tabs)/daily-book"        },
        { label: "Tarefas",       subtitle: "Tarefas atribuídas",             icon: "check-square",route: "/(tabs)/tarefas"           },
        { label: "Folgas & Indisponibilidades", subtitle: "Ausências e restrições", icon: "calendar", route: "/(tabs)/folgas"        },
        { label: "Solicitações",                                               icon: "inbox",       route: "/(tabs)/solicitacoes"     },
        { label: "Check-ins",     subtitle: "Registo de presença no local",   icon: "map-pin",     disabled: true, badge: "Em breve" },
        { label: "Responsabilidades & Delegações", subtitle: "Funções permanentes da operação", icon: "users", route: "/(tabs)/responsabilidades" },
      ],
    },
    {
      title: "Equipe",
      items: isSupervisor
        ? [
            { label: "Equipe",  subtitle: "Membros da operação", icon: "user-check", disabled: true, badge: "Em breve" },
            { label: "Grupos",  subtitle: "Grupos da operação",  icon: "users",      disabled: true, badge: "Em breve" },
          ]
        : [
            { label: "Equipe",  subtitle: "Membros da operação", icon: "user-check", disabled: true, badge: "Em breve" },
          ],
    },
    {
      title: "Planejamento",
      items: [
        { label: "Agenda",        icon: "calendar",  route: "/(tabs)/agenda"     },
        { label: "Livro do Show", subtitle: "Estrutura oficial do espetáculo", icon: "book-open", route: "/(tabs)/show-book" },
      ],
    },
    {
      title: "Comunicação",
      items: [
        { label: "Marketing", subtitle: "Ferramentas de comunicação externa", icon: "send", disabled: true, badge: "Em breve" },
      ],
    },
    {
      title: "Conhecimento",
      items: [
        { label: "Biblioteca", icon: "book", route: "/(tabs)/biblioteca" },
      ],
    },
    {
      title: "Gestão",
      items: [
        { label: "Painel",       subtitle: "Saúde e cobertura operacional",   icon: "activity",    route: "/(tabs)/panel"    },
        { label: "Indicadores",  subtitle: "Métricas da gestão operacional",  icon: "trending-up", route: "/(tabs)/insights" },
      ],
    },
    {
      title: "ASA",
      items: [
        { label: "ASA", subtitle: "Assistente operacional inteligente", icon: "cpu", route: "/(tabs)/asa" },
      ],
    },
  ];
}

const ELENCO_SECTIONS: Section[] = [
  {
    title: "Meu Dia a Dia",
    items: [
      { label: "Escala",       subtitle: "Minha escala e atividades",   icon: "list",        route: "/(tabs)/scale"        },
      { label: "Livro do Dia", subtitle: "Roteiro do dia",              icon: "file-text",   route: "/(tabs)/daily-book"   },
      { label: "Tarefas",      subtitle: "Tarefas atribuídas a você",   icon: "check-square",route: "/(tabs)/tarefas"      },
      { label: "Folgas",       subtitle: "Ausências e dias de descanso",icon: "calendar",    route: "/(tabs)/folgas"       },
      { label: "Solicitações",                                           icon: "inbox",       route: "/(tabs)/solicitacoes" },
    ],
  },
  {
    title: "Planejamento",
    items: [
      { label: "Agenda", icon: "calendar", route: "/(tabs)/agenda" },
    ],
  },
  {
    title: "Conhecimento",
    items: [
      { label: "Biblioteca",    icon: "book",      route: "/(tabs)/biblioteca" },
      { label: "Livro do Show", subtitle: "Estrutura oficial do espetáculo", icon: "book-open", route: "/(tabs)/show-book" },
    ],
  },
  {
    title: "ASA",
    items: [
      { label: "ASA", subtitle: "Assistente operacional inteligente", icon: "cpu", route: "/(tabs)/asa" },
    ],
  },
];

const TRAINER_SECTIONS: Section[] = [
  {
    title: "Minhas Aulas",
    items: [
      { label: "Escala", subtitle: "Minhas aulas e sessões", icon: "list", route: "/(tabs)/scale" },
    ],
  },
];

export default function MaisScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { roles } = useAuth();

  const isManager    = roles.some((r) => MANAGER_ROLES.includes(r.role));
  const isSupervisor = !roles.some((r) => r.role === "ADMIN") && roles.some((r) => SUPERVISOR_ROLES.includes(r.role));
  const isTrainer    = !isManager && roles.some((r) => r.role === "TRAINER");

  const sections: Section[] = isManager
    ? buildManagerSections(isSupervisor)
    : isTrainer
    ? TRAINER_SECTIONS
    : ELENCO_SECTIONS;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingBottom: insets.bottom + 100,
        paddingTop: insets.top + 16,
      }}
      showsVerticalScrollIndicator={false}
    >
      {sections.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
            {section.title.toUpperCase()}
          </Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {section.items.map((item, index) => (
              <React.Fragment key={item.route ?? item.label}>
                <Pressable
                  style={({ pressed }) => [
                    styles.row,
                    item.disabled && styles.rowDisabled,
                    pressed && !item.disabled && { opacity: 0.65 },
                  ]}
                  onPress={() => {
                    if (!item.disabled && item.route) {
                      router.push(item.route as any);
                    }
                  }}
                  disabled={item.disabled}
                >
                  <View style={[styles.iconWrap, { backgroundColor: item.disabled ? colors.muted : colors.primary + "18" }]}>
                    <Feather
                      name={item.icon as any}
                      size={18}
                      color={item.disabled ? colors.mutedForeground : colors.primary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowLabel, { color: item.disabled ? colors.mutedForeground : colors.foreground }]}>
                      {item.label}
                    </Text>
                    {item.subtitle && (
                      <Text style={[styles.rowSubtitle, { color: colors.mutedForeground }]}>
                        {item.subtitle}
                      </Text>
                    )}
                  </View>
                  {item.badge ? (
                    <View style={[styles.badge, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                      <Text style={[styles.badgeText, { color: colors.mutedForeground }]}>{item.badge}</Text>
                    </View>
                  ) : !item.disabled ? (
                    <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                  ) : null}
                </Pressable>
                {index < section.items.length - 1 && (
                  <View style={[styles.divider, { backgroundColor: colors.border }]} />
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
  rowDisabled: {
    opacity: 0.55,
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
  badge: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
});
