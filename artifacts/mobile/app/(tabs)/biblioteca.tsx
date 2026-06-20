import { Feather } from "@expo/vector-icons";
import {
  useListLibraryDocuments,
  useListLibraryCategories,
  useGetLibraryDocument,
  getGetLibraryDocumentQueryKey,
} from "@workspace/api-client-react";
import type { LibraryDocumentItem, LibraryDocumentDetail, LibraryCategory } from "@workspace/api-client-react";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { AsaEmptyState } from "@/components/AsaEmptyState";

// ─── Config ────────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  OPERATIONAL_PROCEDURE: "Procedimento Operacional",
  RULES_AND_POLICIES:    "Regras e Políticas",
  CHARACTER_REFERENCE:   "Ref. Personagens",
  COSTUME_REFERENCE:     "Ref. Figurinos",
  ONBOARDING_MATERIAL:   "Onboarding",
  SAFETY_PROCEDURE:      "Segurança",
};

const TYPE_SHORT: Record<string, string> = {
  OPERATIONAL_PROCEDURE: "Proc. Op.",
  RULES_AND_POLICIES:    "Regras",
  CHARACTER_REFERENCE:   "Personagens",
  COSTUME_REFERENCE:     "Figurinos",
  ONBOARDING_MATERIAL:   "Onboarding",
  SAFETY_PROCEDURE:      "Segurança",
};

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

// ─── Tab filtro por tipo ───────────────────────────────────────────────────────

const TYPE_FILTERS = [
  { key: "all",                    label: "Todos" },
  { key: "OPERATIONAL_PROCEDURE",  label: "Proc. Op." },
  { key: "RULES_AND_POLICIES",     label: "Regras" },
  { key: "CHARACTER_REFERENCE",    label: "Personagens" },
  { key: "COSTUME_REFERENCE",      label: "Figurinos" },
  { key: "ONBOARDING_MATERIAL",    label: "Onboarding" },
  { key: "SAFETY_PROCEDURE",       label: "Segurança" },
];

// ─── Componente Principal ──────────────────────────────────────────────────────

export default function BibliotecaTab() {
  const insets = useSafeAreaInsets();
  const colors = useColors();

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const { data: docsData, isLoading, refetch } = useListLibraryDocuments({
    q: search || undefined,
    type: filterType !== "all" ? filterType : undefined,
  });
  const detailQueryKey = getGetLibraryDocumentQueryKey(selectedId ?? "");
  const { data: detailData, isLoading: loadingDetail } = useGetLibraryDocument(
    selectedId ?? "",
    { query: { queryKey: detailQueryKey, enabled: !!selectedId } }
  );

  const documents = (docsData?.documents ?? []) as LibraryDocumentItem[];
  const detail = detailData?.document as LibraryDocumentDetail | undefined;

  async function handleRefresh() {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }

  const s = makeStyles(colors);

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* ── Header ── */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Biblioteca</Text>
        <Text style={s.headerSub}>Referência oficial da organização</Text>
      </View>

      {/* ── Search ── */}
      <View style={s.searchRow}>
        <View style={s.searchBox}>
          <Feather name="search" size={14} color={colors.mutedForeground} style={s.searchIcon} />
          <TextInput
            style={s.searchInput}
            placeholder="Pesquisar documentos..."
            placeholderTextColor={colors.mutedForeground}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")}>
              <Feather name="x" size={14} color={colors.mutedForeground} />
            </Pressable>
          )}
        </View>
      </View>

      {/* ── Filtros por tipo ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.filterScroll}
        contentContainerStyle={s.filterContent}
      >
        {TYPE_FILTERS.map((f) => (
          <Pressable
            key={f.key}
            onPress={() => setFilterType(f.key)}
            style={[s.filterChip, filterType === f.key && s.filterChipActive]}
          >
            <Text style={[s.filterChipText, filterType === f.key && s.filterChipTextActive]}>
              {f.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* ── Lista ── */}
      {isLoading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={s.list}
          contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
        >
          {documents.length === 0 ? (
            <AsaEmptyState
              title="Biblioteca ainda vazia 📚"
              subtitle="Em breve o administrador vai adicionar materiais aqui. Por enquanto, pode contar comigo! 😊"
              pose="biblioteca"
            />
          ) : (
            documents.map((doc) => (
              <Pressable key={doc.id} onPress={() => setSelectedId(doc.id)} style={s.card}>
                <View style={s.cardHeader}>
                  <Text style={s.cardTitle} numberOfLines={2}>{doc.title}</Text>
                  <View style={s.badge}>
                    <Text style={s.badgeText}>{TYPE_SHORT[doc.type] ?? doc.type}</Text>
                  </View>
                </View>
                {doc.summary ? (
                  <Text style={s.cardSummary} numberOfLines={2}>{doc.summary}</Text>
                ) : null}
                <View style={s.cardMeta}>
                  <Text style={s.metaText}>v{doc.version}</Text>
                  {doc.responsibleName ? <Text style={s.metaText}>· {doc.responsibleName}</Text> : null}
                  {doc.publishedAt ? <Text style={s.metaText}>· {fmtDate(doc.publishedAt)}</Text> : null}
                </View>
              </Pressable>
            ))
          )}
        </ScrollView>
      )}

      {/* ── Modal de Detalhe ── */}
      <Modal
        visible={!!selectedId}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedId(null)}
      >
        <View style={[s.modal, { paddingTop: Platform.OS === "ios" ? 8 : insets.top }]}>
          {/* Handle bar */}
          <View style={s.modalHandle} />

          {/* Toolbar */}
          <View style={s.modalToolbar}>
            <Text style={s.modalTitle} numberOfLines={1}>{detail?.title ?? "Carregando..."}</Text>
            <TouchableOpacity onPress={() => setSelectedId(null)} style={s.closeBtn}>
              <Feather name="x" size={20} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          {loadingDetail || !detail ? (
            <View style={s.center}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <ScrollView style={s.modalBody} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
              {/* Meta */}
              <View style={s.metaRow}>
                <View style={s.badge}>
                  <Text style={s.badgeText}>{TYPE_LABELS[detail.type] ?? detail.type}</Text>
                </View>
                <View style={s.versionBadge}>
                  <Feather name="git-branch" size={10} color={colors.primary} />
                  <Text style={s.versionText}>v{detail.version}</Text>
                </View>
                {detail.publishedAt && (
                  <View style={s.versionBadge}>
                    <Feather name="check-circle" size={10} color="#16a34a" />
                    <Text style={[s.versionText, { color: "#16a34a" }]}>{fmtDate(detail.publishedAt)}</Text>
                  </View>
                )}
              </View>

              {detail.responsibleName ? (
                <Text style={s.responsible}>Responsável: {detail.responsibleName}</Text>
              ) : null}

              {/* Sumário */}
              {detail.summary ? (
                <View style={s.summaryBox}>
                  <Text style={s.summaryText}>{detail.summary}</Text>
                </View>
              ) : null}

              {/* Conteúdo */}
              <View style={s.bodyBox}>
                <Text style={s.bodyLabel}>
                  <Feather name="file-text" size={13} /> Conteúdo do Documento
                </Text>
                <Text style={s.bodyText}>
                  {detail.body || "Sem conteúdo disponível."}
                </Text>
              </View>
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(colors: ReturnType<typeof useColors>) {
  const isIOS = Platform.OS === "ios";
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 8,
    },
    headerTitle: {
      fontSize: 26,
      fontWeight: "700",
      color: colors.foreground,
      letterSpacing: -0.5,
    },
    headerSub: {
      fontSize: 12,
      color: colors.mutedForeground,
      marginTop: 2,
    },
    searchRow: {
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    searchBox: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.muted,
      borderRadius: 12,
      paddingHorizontal: 12,
      height: 40,
      gap: 8,
    },
    searchIcon: {},
    searchInput: {
      flex: 1,
      fontSize: 14,
      color: colors.foreground,
    },
    filterScroll: {
      maxHeight: 40,
    },
    filterContent: {
      paddingHorizontal: 16,
      gap: 8,
      alignItems: "center",
    },
    filterChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      backgroundColor: colors.muted,
      borderWidth: 1,
      borderColor: colors.border,
    },
    filterChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    filterChipText: {
      fontSize: 12,
      color: colors.mutedForeground,
      fontWeight: "500",
    },
    filterChipTextActive: {
      color: "#fff",
    },
    list: {
      flex: 1,
      paddingHorizontal: 16,
      paddingTop: 12,
    },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 48,
    },
    empty: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 48,
    },
    emptyText: {
      fontSize: 14,
      color: colors.mutedForeground,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      marginBottom: 10,
    },
    cardHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
    },
    cardTitle: {
      flex: 1,
      fontSize: 14,
      fontWeight: "600",
      color: colors.foreground,
      lineHeight: 20,
    },
    badge: {
      backgroundColor: colors.primary + "18",
      borderRadius: 6,
      paddingHorizontal: 7,
      paddingVertical: 2,
    },
    badgeText: {
      fontSize: 10,
      color: colors.primary,
      fontWeight: "600",
    },
    cardSummary: {
      fontSize: 12,
      color: colors.mutedForeground,
      marginTop: 4,
      lineHeight: 17,
    },
    cardMeta: {
      flexDirection: "row",
      gap: 4,
      marginTop: 8,
    },
    metaText: {
      fontSize: 10,
      color: colors.mutedForeground,
    },
    // Modal
    modal: {
      flex: 1,
      backgroundColor: colors.background,
    },
    modalHandle: {
      width: 40,
      height: 4,
      backgroundColor: colors.border,
      borderRadius: 2,
      alignSelf: "center",
      marginBottom: 8,
    },
    modalToolbar: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 8,
    },
    modalTitle: {
      flex: 1,
      fontSize: 16,
      fontWeight: "700",
      color: colors.foreground,
    },
    closeBtn: {
      padding: 6,
    },
    modalBody: {
      flex: 1,
      paddingHorizontal: 16,
      paddingTop: 16,
    },
    metaRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 8,
    },
    versionBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: colors.muted,
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    versionText: {
      fontSize: 11,
      color: colors.primary,
      fontWeight: "600",
    },
    responsible: {
      fontSize: 12,
      color: colors.mutedForeground,
      marginBottom: 12,
    },
    summaryBox: {
      backgroundColor: colors.primary + "10",
      borderLeftWidth: 3,
      borderLeftColor: colors.primary,
      borderRadius: 8,
      padding: 12,
      marginBottom: 16,
    },
    summaryText: {
      fontSize: 13,
      color: colors.foreground,
      fontStyle: "italic",
      lineHeight: 19,
    },
    bodyBox: {
      backgroundColor: colors.muted,
      borderRadius: 12,
      padding: 16,
    },
    bodyLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.mutedForeground,
      marginBottom: 12,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    bodyText: {
      fontSize: 14,
      color: colors.foreground,
      lineHeight: 22,
    },
  });
}
