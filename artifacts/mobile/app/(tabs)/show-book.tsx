import { Feather } from "@expo/vector-icons";
import {
  useListShowBooks,
  useGetShowBook,
  getListShowBooksQueryKey,
  getGetShowBookQueryKey,
} from "@workspace/api-client-react";
import type { ShowBook, ShowBookSceneWithBlocks, ShowBookBlockWithPositions, ShowBookPositionWithLines } from "@workspace/api-client-react";
import React, { useState, useCallback } from "react";
import {
  ActivityIndicator,
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

export default function ShowBookScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const auth = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);

  const operationId = auth.roles.find((r) => r.operationId)?.operationId;

  const { data: listData, isLoading: listLoading, refetch: refetchList } = useListShowBooks(
    { operationId },
    { query: { queryKey: getListShowBooksQueryKey({ operationId }), enabled: !!operationId } }
  );

  const books: ShowBook[] = listData?.showBooks ?? [];
  const publishedBooks = books.filter((b) => b.status === "PUBLISHED");

  const { data: bookData, isLoading: bookLoading, refetch: refetchBook } = useGetShowBook(
    selectedBookId ?? "",
    { query: { queryKey: getGetShowBookQueryKey(selectedBookId ?? ""), enabled: !!selectedBookId } }
  );
  const selectedBook = bookData?.showBook;

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetchList();
      if (selectedBookId) await refetchBook();
    } finally {
      setRefreshing(false);
    }
  }, [refetchList, refetchBook, selectedBookId]);

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
    sectionLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5, color: colors.mutedForeground, textTransform: "uppercase", marginBottom: 6, marginTop: 12 },
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
    empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 8 },
    emptyText: { fontSize: 15, color: colors.mutedForeground },
    selectHint: { fontSize: 13, color: colors.mutedForeground, textAlign: "center", marginTop: 12, paddingHorizontal: 32 },
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
        <Text style={styles.headerTitle}>Livro do Show</Text>
        <Text style={styles.headerSub}>Estrutura do espetáculo</Text>
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
            {/* Seletor de livro */}
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
                <Text style={styles.emptyText}>Nenhum livro disponível</Text>
              </View>
            )}

            {/* Árvore do livro selecionado */}
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
                          {block.positions?.map((pos: ShowBookPositionWithLines) => (
                            <View key={pos.id}>
                              <View style={styles.positionRow}>
                                <Feather name="user" size={11} color={colors.mutedForeground} />
                                <Text style={styles.positionName}>{pos.name}</Text>
                                <Text style={styles.coverage}>min {pos.minimumCoverage}</Text>
                              </View>
                              {pos.lines?.map((line) => (
                                <View key={line.id} style={styles.lineRow}>
                                  <Feather name="arrow-right" size={10} color={colors.mutedForeground} />
                                  <Text style={styles.lineType}>{LINE_TYPE_LABELS[line.type] ?? line.type}</Text>
                                </View>
                              ))}
                            </View>
                          ))}
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
    </View>
  );
}
