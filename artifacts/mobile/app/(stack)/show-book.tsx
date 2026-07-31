import { Feather } from "@expo/vector-icons";
import {
  useListShowBooks,
  useGetShowBook,
  useListShowBookRefs,
  getListShowBooksQueryKey,
  getGetShowBookQueryKey,
  getListShowBookRefsQueryKey,
} from "@workspace/api-client-react";
import type {
  ShowBook,
  ShowBookSceneWithBlocks,
  ShowBookBlockWithPositions,
  ShowBookPositionWithLines,
  ShowBookPositionRefWithDoc,
  ShowBookMemberRef,
} from "@workspace/api-client-react";
import React, { useState, useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { BackButton } from "@/components/BackButton";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Rascunho", PUBLISHED: "Publicado", ARCHIVED: "Arquivado",
};
const STATUS_COLORS: Record<string, string> = {
  DRAFT: "#6B7280", PUBLISHED: "#16A34A", ARCHIVED: "#9CA3AF",
};

const LINE_TYPE_LABELS: Record<string, string> = {
  FIXED_PERSON: "Titular Fixo",
  TITULAR_SUBSTITUTE: "Titular c/ Substituto",
  ROTATION: "Rodízio",
  DAY_OF_WEEK: "Por Dia da Semana",
  FUNCTION: "Por Função",
  CHARACTER: "Por Personagem",
  MANUAL: "Manual",
};

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

type ConfigRow = { label: string; value: string };

function buildConfigRows(
  type: string,
  config: Record<string, unknown> | null | undefined,
  nameOf: (id: string) => string,
): ConfigRow[] {
  const c = (config ?? {}) as Record<string, unknown>;
  switch (type) {
    case "FIXED_PERSON": {
      const userId = c.userId as string | null | undefined;
      return [{ label: "Titular", value: userId ? nameOf(userId) : "— não definido" }];
    }
    case "TITULAR_SUBSTITUTE": {
      const titularId = c.titularId as string | null | undefined;
      const subs = Array.isArray(c.substituteIds) ? (c.substituteIds as string[]) : [];
      return [
        { label: "Titular", value: titularId ? nameOf(titularId) : "— não definido" },
        {
          label: "Substitutos",
          value: subs.length ? subs.map(nameOf).join(", ") : "— nenhum",
        },
      ];
    }
    case "ROTATION": {
      const ids = Array.isArray(c.memberIds) ? (c.memberIds as string[]) : [];
      return [
        {
          label: "Rodízio",
          value: ids.length ? ids.map((id, i) => `${i + 1}. ${nameOf(id)}`).join("  ") : "— nenhum membro",
        },
      ];
    }
    case "DAY_OF_WEEK": {
      const assignments =
        c.dayAssignments && typeof c.dayAssignments === "object"
          ? (c.dayAssignments as Record<string, string>)
          : {};
      const entries = Object.entries(assignments)
        .filter(([, id]) => !!id)
        .sort(([a], [b]) => Number(a) - Number(b));
      if (entries.length > 0) {
        return entries.map(([d, id]) => ({
          label: WEEKDAY_LABELS[Number(d)] ?? `?${d}`,
          value: nameOf(id),
        }));
      }
      const days = Array.isArray(c.days) ? (c.days as number[]) : [];
      const sorted = [...days].sort((a, b) => a - b);
      return [
        {
          label: "Dias",
          value: sorted.length ? sorted.map((d) => WEEKDAY_LABELS[d] ?? `?${d}`).join(", ") : "— nenhum dia",
        },
      ];
    }
    case "FUNCTION": {
      const fn = (c.functionLabel as string | undefined)?.trim();
      return [{ label: "Função", value: fn || "— não definida" }];
    }
    case "CHARACTER": {
      const ch = (c.characterName as string | undefined)?.trim();
      return [{ label: "Personagem", value: ch || "— não definido" }];
    }
    default:
      return [];
  }
}

const DOC_TYPE_LABELS: Record<string, string> = {
  OPERATIONAL_PROCEDURE: "Procedimento",
  RULES_AND_POLICIES: "Normas",
  CHARACTER_REFERENCE: "Personagem",
  COSTUME_REFERENCE: "Figurino",
  ONBOARDING_MATERIAL: "Onboarding",
  SAFETY_PROCEDURE: "Segurança",
};

const DOC_TYPE_ICONS: Record<string, React.ComponentProps<typeof Feather>["name"]> = {
  OPERATIONAL_PROCEDURE: "settings",
  RULES_AND_POLICIES: "file-text",
  CHARACTER_REFERENCE: "book",
  COSTUME_REFERENCE: "tag",
  ONBOARDING_MATERIAL: "book-open",
  SAFETY_PROCEDURE: "shield",
};

const DOC_STATUS_COLORS: Record<string, string> = {
  DRAFT: "#6B7280",
  PUBLISHED: "#16A34A",
  UPDATED: "#2563EB",
  ARCHIVED: "#9CA3AF",
};

export default function ShowBookScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const auth = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [docModal, setDocModal] = useState<ShowBookPositionRefWithDoc | null>(null);

  const operationId = auth.roles.find((r) => r.operationId)?.operationId;

  const { data: listData, isLoading: listLoading, refetch: refetchList } = useListShowBooks(
    { operationId },
    { query: { queryKey: getListShowBooksQueryKey({ operationId }), enabled: !!operationId } }
  );
  const books: ShowBook[] = listData?.showBooks ?? [];

  const { data: bookData, isLoading: bookLoading, refetch: refetchBook } = useGetShowBook(
    selectedBookId ?? "",
    { query: { queryKey: getGetShowBookQueryKey(selectedBookId ?? ""), enabled: !!selectedBookId } }
  );
  const selectedBook = bookData?.showBook;

  const memberNameById = useMemo(() => {
    const map: Record<string, string> = {};
    const dir = (selectedBook as { memberDirectory?: ShowBookMemberRef[] } | undefined)?.memberDirectory ?? [];
    dir.forEach((m) => { map[m.id] = m.name; });
    return map;
  }, [selectedBook]);
  const nameOf = useCallback(
    (id: string) => memberNameById[id] ?? "Membro removido",
    [memberNameById],
  );

  const { data: refsData, refetch: refetchRefs } = useListShowBookRefs(
    selectedBookId ?? "",
    { query: { queryKey: getListShowBookRefsQueryKey(selectedBookId ?? ""), enabled: !!selectedBookId } }
  );
  const allRefs: ShowBookPositionRefWithDoc[] = refsData?.refs ?? [];

  const refsByPosition = useMemo(() => {
    const map: Record<string, ShowBookPositionRefWithDoc[]> = {};
    allRefs.forEach((r) => {
      if (!map[r.positionId]) map[r.positionId] = [];
      map[r.positionId]!.push(r);
    });
    return map;
  }, [allRefs]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetchList();
      if (selectedBookId) {
        await refetchBook();
        await refetchRefs();
      }
    } finally {
      setRefreshing(false);
    }
  }, [refetchList, refetchBook, refetchRefs, selectedBookId]);

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingTop: insets.top + 8,
      paddingBottom: 12,
      paddingHorizontal: 20,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: { fontSize: 22, fontWeight: "700", color: colors.foreground },
    headerSub: { fontSize: 13, color: colors.mutedForeground, marginTop: 2 },
    bookList: { paddingHorizontal: 16, paddingTop: 8, gap: 8 },
    bookCard: {
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      padding: 12,
    },
    bookCardActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + "15",
    },
    bookTitle: { fontSize: 14, fontWeight: "600", color: colors.foreground },
    bookMeta: { fontSize: 11, color: colors.mutedForeground, marginTop: 2 },
    statusBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8, alignSelf: "flex-start", marginTop: 4 },
    statusText: { fontSize: 10, fontWeight: "600", color: "#FFFFFF" },
    treePadding: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: insets.bottom + 90 },
    sectionLabel: {
      fontSize: 11, fontWeight: "700", letterSpacing: 0.5, color: colors.mutedForeground,
      textTransform: "uppercase", marginBottom: 6, marginTop: 12,
    },
    treeCard: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      marginBottom: 8,
      overflow: "hidden",
    },
    sceneHeader: {
      flexDirection: "row",
      alignItems: "center",
      padding: 12,
      backgroundColor: colors.muted,
      gap: 8,
    },
    sceneTitle: { fontSize: 14, fontWeight: "700", color: colors.foreground, flex: 1 },
    blockWrapper: { paddingLeft: 12, borderTopWidth: 1, borderTopColor: colors.border },
    blockHeader: { flexDirection: "row", alignItems: "center", paddingVertical: 8, paddingHorizontal: 10, gap: 8 },
    blockTitle: { fontSize: 13, fontWeight: "600", color: colors.foreground, flex: 1 },
    positionRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 6,
      paddingHorizontal: 10,
      paddingLeft: 22,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      gap: 8,
    },
    positionName: { fontSize: 12, color: colors.foreground, flex: 1 },
    coverage: { fontSize: 11, color: colors.mutedForeground },
    lineRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 4,
      paddingHorizontal: 10,
      paddingLeft: 36,
      gap: 6,
    },
    lineType: { fontSize: 11, color: colors.mutedForeground, fontStyle: "italic" },
    configBox: {
      marginLeft: 52,
      marginRight: 10,
      marginTop: 2,
      marginBottom: 2,
      paddingVertical: 6,
      paddingHorizontal: 10,
      backgroundColor: colors.muted,
      borderRadius: 8,
      gap: 3,
    },
    configRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
    configLabel: {
      fontSize: 10,
      fontWeight: "600",
      color: colors.mutedForeground,
      width: 78,
    },
    configValue: { fontSize: 11, color: colors.foreground, flex: 1, lineHeight: 16 },
    refRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 5,
      paddingHorizontal: 10,
      paddingLeft: 36,
      gap: 6,
      borderTopWidth: 1,
      borderTopColor: colors.border + "50",
    },
    refLabel: { fontSize: 11, color: colors.primary, flex: 1 },
    refTypeBadge: {
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: 4,
      backgroundColor: colors.primary + "15",
    },
    refTypeBadgeText: { fontSize: 9, color: colors.primary, fontWeight: "600" },
    empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 8 },
    emptyText: { fontSize: 15, color: colors.mutedForeground },
    selectHint: { fontSize: 13, color: colors.mutedForeground, textAlign: "center", marginTop: 12, paddingHorizontal: 32 },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.55)",
      justifyContent: "flex-end",
    },
    modalCard: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingBottom: insets.bottom + 16,
      maxHeight: "80%",
    },
    modalHandle: {
      width: 36,
      height: 4,
      backgroundColor: colors.border,
      borderRadius: 2,
      alignSelf: "center",
      marginTop: 10,
      marginBottom: 6,
    },
    modalHeader: {
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 4,
    },
    modalTitle: { fontSize: 16, fontWeight: "700", color: colors.foreground },
    modalSubtitle: { fontSize: 12, color: colors.mutedForeground },
    modalBadgeRow: { flexDirection: "row", gap: 6, marginTop: 4, flexWrap: "wrap" },
    modalBody: { paddingHorizontal: 20, paddingTop: 12 },
    modalBodyText: { fontSize: 14, color: colors.foreground, lineHeight: 21 },
    modalSummary: { fontSize: 13, color: colors.mutedForeground, marginBottom: 8, lineHeight: 19 },
    modalClose: {
      margin: 16,
      marginBottom: 4,
      padding: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
    },
    modalCloseText: { fontSize: 14, fontWeight: "600", color: colors.foreground },
    docStatusDot: {
      width: 8, height: 8, borderRadius: 4,
    },
  });

  if (!operationId) {
    return (
      <View style={[styles.container, styles.empty]}>
        <Feather name="alert-circle" size={40} color={colors.mutedForeground} />
        <Text style={styles.emptyText}>Sem operação ativa</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <BackButton />
          <Text style={styles.headerTitle}>Livro do Show</Text>
        </View>
        <Text style={styles.headerSub}>Estrutura oficial do espetáculo</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 90 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
      >
        {listLoading ? (
          <View style={styles.empty}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : (
          <>
            {books.length > 0 && (
              <View style={styles.bookList}>
                <Text style={[styles.sectionLabel, { marginTop: 8 }]}>Selecione o livro</Text>
                {books.map((book) => (
                  <Pressable
                    key={book.id}
                    style={[styles.bookCard, selectedBookId === book.id && styles.bookCardActive]}
                    onPress={() => setSelectedBookId(book.id)}
                  >
                    <Text style={styles.bookTitle}>{book.title}</Text>
                    <Text style={styles.bookMeta}>v{book.version} · {book.type}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[book.status] ?? "#6B7280" }]}>
                      <Text style={styles.statusText}>{STATUS_LABELS[book.status]}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            )}

            {books.length === 0 && (
              <View style={styles.empty}>
                <Feather name="book-open" size={40} color={colors.mutedForeground} />
                <Text style={styles.emptyText}>Nenhum Livro do Show disponível ainda. O administrador criará o livro assim que a operação for configurada.</Text>
              </View>
            )}

            {selectedBookId && (
              <View style={styles.treePadding}>
                <Text style={styles.sectionLabel}>Hierarquia do espetáculo</Text>
                {bookLoading ? (
                  <ActivityIndicator color={colors.primary} size="small" style={{ marginTop: 20 }} />
                ) : !selectedBook?.scenes?.length ? (
                  <Text style={styles.selectHint}>Livro sem cenas cadastradas.</Text>
                ) : (
                  selectedBook.scenes.map((scene: ShowBookSceneWithBlocks) => (
                    <View key={scene.id} style={styles.treeCard}>
                      <View style={styles.sceneHeader}>
                        <Feather name="layers" size={14} color={colors.primary} />
                        <Text style={styles.sceneTitle}>{scene.name}</Text>
                        {scene.isOptional && (
                          <Text style={{ fontSize: 10, color: colors.mutedForeground }}>opcional</Text>
                        )}
                      </View>
                      {scene.blocks?.map((block: ShowBookBlockWithPositions) => (
                        <View key={block.id} style={styles.blockWrapper}>
                          <View style={styles.blockHeader}>
                            <Feather name="layout" size={12} color={colors.mutedForeground} />
                            <Text style={styles.blockTitle}>{block.name}</Text>
                          </View>
                          {block.positions?.map((pos: ShowBookPositionWithLines) => {
                            const posRefs = refsByPosition[pos.id] ?? [];
                            return (
                              <View key={pos.id}>
                                <View style={styles.positionRow}>
                                  <Feather name="user" size={11} color={colors.mutedForeground} />
                                  <Text style={styles.positionName}>{pos.name}</Text>
                                  <Text style={styles.coverage}>min {pos.minimumCoverage}</Text>
                                  {posRefs.length > 0 && (
                                    <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                                      <Feather name="book-open" size={10} color={colors.primary} />
                                      <Text style={{ fontSize: 10, color: colors.primary, fontWeight: "600" }}>
                                        {posRefs.length}
                                      </Text>
                                    </View>
                                  )}
                                </View>
                                {pos.lines?.map((line) => {
                                  const configRows = buildConfigRows(line.type, line.config, nameOf);
                                  return (
                                    <View key={line.id}>
                                      <View style={styles.lineRow}>
                                        <Feather name="arrow-right" size={10} color={colors.mutedForeground} />
                                        <Text style={styles.lineType}>{LINE_TYPE_LABELS[line.type] ?? line.type}</Text>
                                      </View>
                                      {configRows.length > 0 && (
                                        <View style={styles.configBox}>
                                          {configRows.map((row) => (
                                            <View key={row.label} style={styles.configRow}>
                                              <Text style={styles.configLabel}>{row.label}</Text>
                                              <Text style={styles.configValue}>{row.value}</Text>
                                            </View>
                                          ))}
                                        </View>
                                      )}
                                    </View>
                                  );
                                })}
                                {posRefs.map((ref) => (
                                  <Pressable
                                    key={ref.id}
                                    style={({ pressed }) => [styles.refRow, pressed && { opacity: 0.7 }]}
                                    onPress={() => setDocModal(ref)}
                                  >
                                    <Feather
                                      name={DOC_TYPE_ICONS[ref.document.type] ?? "file-text"}
                                      size={11}
                                      color={colors.primary}
                                    />
                                    <Text style={styles.refLabel} numberOfLines={1}>
                                      {ref.document.title}
                                    </Text>
                                    <View style={styles.refTypeBadge}>
                                      <Text style={styles.refTypeBadgeText}>
                                        {DOC_TYPE_LABELS[ref.document.type] ?? ref.document.type}
                                      </Text>
                                    </View>
                                  </Pressable>
                                ))}
                              </View>
                            );
                          })}
                        </View>
                      ))}
                    </View>
                  ))
                )}
              </View>
            )}

            {!selectedBookId && books.length > 0 && (
              <Text style={styles.selectHint}>Selecione um livro acima para ver sua estrutura</Text>
            )}
          </>
        )}
      </ScrollView>

      {/* Modal de leitura do documento */}
      <Modal
        visible={!!docModal}
        transparent
        animationType="slide"
        onRequestClose={() => setDocModal(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setDocModal(null)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHandle} />
            {docModal && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle} numberOfLines={2}>{docModal.document.title}</Text>
                  <View style={styles.modalBadgeRow}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <View style={[styles.docStatusDot, { backgroundColor: DOC_STATUS_COLORS[docModal.document.status] ?? "#6B7280" }]} />
                      <Text style={styles.modalSubtitle}>
                        {DOC_TYPE_LABELS[docModal.document.type] ?? docModal.document.type}
                        {" · "}v{docModal.document.version}
                      </Text>
                    </View>
                  </View>
                  {docModal.label && (
                    <Text style={[styles.modalSubtitle, { fontStyle: "italic" }]}>"{docModal.label}"</Text>
                  )}
                </View>
                <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                  {docModal.document.summary ? (
                    <Text style={styles.modalSummary}>{docModal.document.summary}</Text>
                  ) : null}
                </ScrollView>
                <Pressable style={styles.modalClose} onPress={() => setDocModal(null)}>
                  <Text style={styles.modalCloseText}>Fechar</Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
