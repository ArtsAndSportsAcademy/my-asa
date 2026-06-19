import { Feather } from "@expo/vector-icons";
import {
  useListDailyBook,
  useGetDailyBook,
  usePublishDailyBook,
  useRepublishDailyBook,
  getListDailyBookQueryKey,
  getGetDailyBookQueryKey,
  useGetMyActiveDelegations,
} from "@workspace/api-client-react";
import type {
  DailyBook,
  DailyBookWithScenes,
  DailyBookSceneWithBlocks,
  DailyBookBlockWithPositions,
  DailyBookPositionWithAssignments,
  DailyBookAssignment,
} from "@workspace/api-client-react";
import React, { useState, useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Rascunho",
  PUBLISHED: "Publicado",
  REPUBLISHED: "Republicado",
  EXECUTED: "Executado",
  CANCELLED: "Cancelado",
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "#6B7280",
  PUBLISHED: "#16A34A",
  REPUBLISHED: "#0284C7",
  EXECUTED: "#7C3AED",
  CANCELLED: "#DC2626",
};

const ASSIGNMENT_COLORS: Record<string, string> = {
  ASSIGNED: "#16A34A",
  AT_RISK: "#D97706",
  OPEN: "#DC2626",
  REMOVED: "#9CA3AF",
};

const ASSIGNMENT_LABELS: Record<string, string> = {
  ASSIGNED: "Escalado",
  AT_RISK: "Em Risco",
  OPEN: "Aberto",
  REMOVED: "Removido",
};

interface MyPosition {
  assignment: DailyBookAssignment;
  position: DailyBookPositionWithAssignments;
  block: DailyBookBlockWithPositions;
  scene: DailyBookSceneWithBlocks;
}

export default function DailyBookScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const auth = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [expandedScenes, setExpandedScenes] = useState<Record<string, boolean>>({});
  const [expandedBlocks, setExpandedBlocks] = useState<Record<string, boolean>>({});

  const currentUserId = auth.user?.id ?? null;
  const isSupervisor = auth.roles.some((r) =>
    ["ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"].includes(r.role)
  );

  const { data: delegData } = useGetMyActiveDelegations({ query: { retry: false } as any });
  const dailyBookDelegation = (delegData?.delegations ?? []).find(
    (d) => (d.responsibilities as string[]).includes("DAILY_BOOK")
  );
  const isCapitaoDailyBook = !!dailyBookDelegation && !isSupervisor;

  const {
    data: listData,
    isLoading: listLoading,
    refetch: refetchList,
  } = useListDailyBook(
    {},
    { query: { queryKey: getListDailyBookQueryKey({}) } }
  );

  const books: DailyBook[] = (listData as any)?.dailyBooks ?? [];
  const visibleBooks = isCapitaoDailyBook
    ? books
    : books.filter((b) => b.status === "PUBLISHED" || b.status === "REPUBLISHED");

  const {
    data: bookData,
    isLoading: bookLoading,
    refetch: refetchBook,
  } = useGetDailyBook(selectedBookId ?? "", {
    query: {
      queryKey: getGetDailyBookQueryKey(selectedBookId ?? ""),
      enabled: !!selectedBookId,
    },
  });
  const selectedBook = (bookData as any)?.dailyBook as DailyBookWithScenes | undefined;

  const publishMutation = usePublishDailyBook();
  const republishMutation = useRepublishDailyBook();

  const handlePublish = useCallback(() => {
    if (!selectedBookId) return;
    Alert.alert("Publicar Livro do Dia", "Confirmar publicação? Os membros serão notificados.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Publicar",
        onPress: () =>
          publishMutation.mutate(
            { id: selectedBookId },
            {
              onSuccess: () => { refetchList(); refetchBook(); },
              onError: () => Alert.alert("Erro", "Não foi possível publicar o livro."),
            }
          ),
      },
    ]);
  }, [selectedBookId, publishMutation, refetchList, refetchBook]);

  const handleRepublish = useCallback(() => {
    if (!selectedBookId) return;
    Alert.alert("Republicar Livro do Dia", "Confirmar republicação? Os membros serão notificados das alterações.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Republicar",
        onPress: () =>
          republishMutation.mutate(
            { id: selectedBookId },
            {
              onSuccess: () => { refetchList(); refetchBook(); },
              onError: () => Alert.alert("Erro", "Não foi possível republicar o livro."),
            }
          ),
      },
    ]);
  }, [selectedBookId, republishMutation, refetchList, refetchBook]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetchList();
      if (selectedBookId) await refetchBook();
    } finally {
      setRefreshing(false);
    }
  }, [refetchList, refetchBook, selectedBookId]);

  const toggleScene = (sceneId: string) =>
    setExpandedScenes((prev) => ({ ...prev, [sceneId]: !prev[sceneId] }));

  const toggleBlock = (blockId: string) =>
    setExpandedBlocks((prev) => ({ ...prev, [blockId]: !prev[blockId] }));

  const myPositions: MyPosition[] = useMemo(() => {
    if (!selectedBook || isSupervisor || !currentUserId) return [];
    const result: MyPosition[] = [];
    const scenes: DailyBookSceneWithBlocks[] = (selectedBook.scenes as any) ?? [];
    scenes.filter((s) => !s.isRemoved).forEach((scene) => {
      scene.blocks.filter((b) => !b.isRemoved).forEach((block) => {
        block.positions.filter((p) => !p.isRemoved).forEach((position) => {
          position.assignments
            .filter((a) => a.userId === currentUserId && a.status !== "REMOVED")
            .forEach((assignment) => {
              result.push({ assignment, position, block, scene });
            });
        });
      });
    });
    return result;
  }, [selectedBook, isSupervisor, currentUserId]);

  const scenes: DailyBookSceneWithBlocks[] = ((selectedBook?.scenes as any) ?? []).filter(
    (s: DailyBookSceneWithBlocks) => !s.isRemoved
  );

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
    sectionTitle: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.mutedForeground,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 6,
    },
    bookCard: {
      marginHorizontal: 16,
      marginBottom: 8,
      padding: 12,
      borderRadius: 10,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    bookCardSelected: { borderColor: colors.primary, backgroundColor: colors.primary + "10" },
    bookCardRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    bookTitle: { flex: 1, fontSize: 14, fontWeight: "600", color: colors.foreground },
    bookMeta: { fontSize: 12, color: colors.mutedForeground, marginTop: 2 },
    versionBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 8,
      backgroundColor: colors.muted,
    },
    versionText: { fontSize: 11, color: colors.mutedForeground },
    myPositionCard: {
      marginHorizontal: 16,
      marginBottom: 10,
      borderRadius: 10,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    },
    myPositionHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: colors.primary + "15",
    },
    myPositionName: { flex: 1, fontSize: 14, fontWeight: "700", color: colors.foreground },
    myPositionBreadcrumb: {
      fontSize: 11,
      color: colors.mutedForeground,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 12,
    },
    statusText: { fontSize: 11, fontWeight: "700", color: "#fff" },
    emptyCard: {
      marginHorizontal: 16,
      padding: 20,
      borderRadius: 10,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      gap: 8,
    },
    emptyText: { color: colors.mutedForeground, fontSize: 14, textAlign: "center" },
    separator: { height: 1, backgroundColor: colors.border, marginHorizontal: 16 },
    sceneRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 8,
      backgroundColor: colors.muted + "80",
      gap: 6,
    },
    sceneName: { flex: 1, fontSize: 14, fontWeight: "600", color: colors.foreground },
    blockRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingLeft: 28,
      paddingRight: 16,
      paddingVertical: 6,
      gap: 6,
      borderBottomWidth: 1,
      borderBottomColor: colors.border + "40",
    },
    blockName: { flex: 1, fontSize: 13, fontWeight: "500", color: colors.foreground },
    positionRow: {
      paddingLeft: 44,
      paddingRight: 16,
      paddingVertical: 5,
      borderBottomWidth: 1,
      borderBottomColor: colors.border + "20",
    },
    positionName: { fontSize: 12, color: colors.foreground, marginBottom: 2 },
    coverageText: { fontSize: 11, color: colors.mutedForeground },
    assignmentRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingLeft: 52,
      paddingRight: 16,
      paddingVertical: 3,
      gap: 6,
    },
    assignmentName: { flex: 1, fontSize: 11, color: colors.foreground },
    assignmentBadge: {
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: 8,
    },
    assignmentBadgeText: { fontSize: 10, fontWeight: "500", color: "#fff" },
    loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  });

  if (listLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Livro do Dia</Text>
        <Text style={styles.headerSub}>
          {isSupervisor
            ? "Roteiro operacional do dia"
            : isCapitaoDailyBook
            ? `Capitão · em nome de ${dailyBookDelegation?.supervisorName ?? "Supervisor"}`
            : "Roteiro operacional do dia"}
        </Text>
      </View>

      {isCapitaoDailyBook && (
        <View style={{ backgroundColor: "#EFF6FF", borderWidth: 1, borderColor: "#3B82F6", borderRadius: 10, marginHorizontal: 16, marginBottom: 12, padding: 10, flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Feather name="shield" size={14} color="#1D4ED8" />
          <Text style={{ color: "#1E40AF", fontSize: 12, fontWeight: "600", flex: 1 }}>
            Você está operando o Livro do Dia como Capitão delegado.
          </Text>
        </View>
      )}

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* Book selector */}
        <Text style={styles.sectionTitle}>Selecionar Livro</Text>
        {visibleBooks.length === 0 ? (
          <View style={styles.emptyCard}>
            <Feather name="book-open" size={28} color={colors.mutedForeground} />
            <Text style={styles.emptyText}>Nenhum Livro do Dia publicado ainda. Aguarde o supervisor gerar o livro do próximo evento.</Text>
          </View>
        ) : (
          visibleBooks.map((book) => {
            const selected = selectedBookId === book.id;
            const statusColor = STATUS_COLORS[book.status] ?? "#6B7280";
            return (
              <Pressable
                key={book.id}
                style={[styles.bookCard, selected && styles.bookCardSelected]}
                onPress={() => setSelectedBookId(book.id)}
              >
                <View style={styles.bookCardRow}>
                  <Feather name="book-open" size={16} color={statusColor} />
                  <Text style={styles.bookTitle} numberOfLines={1}>
                    Evento {book.agendaEventId.slice(0, 8)}
                  </Text>
                  <View style={styles.versionBadge}>
                    <Text style={styles.versionText}>v{book.version}</Text>
                  </View>
                </View>
                <Text style={styles.bookMeta}>{STATUS_LABELS[book.status] ?? book.status}</Text>
                {book.publishedAt && (
                  <Text style={styles.bookMeta}>
                    {new Date(book.publishedAt).toLocaleString("pt-BR")}
                  </Text>
                )}
              </Pressable>
            );
          })
        )}

        {/* Detail section */}
        {selectedBookId && (
          <>
            <View style={{ height: 12 }} />
            <View style={styles.separator} />

            {bookLoading ? (
              <View style={{ padding: 32, alignItems: "center" }}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : !selectedBook ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>Livro não encontrado</Text>
              </View>
            ) : (isSupervisor || isCapitaoDailyBook) ? (
              <>
                {/* Supervisor/Capitão: full tree */}
                {isCapitaoDailyBook && selectedBook.status === "DRAFT" && (
                  <TouchableOpacity
                    onPress={handlePublish}
                    disabled={publishMutation.isPending}
                    style={{ marginHorizontal: 16, marginBottom: 10, backgroundColor: "#16A34A", borderRadius: 10, paddingVertical: 12, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 }}
                  >
                    <Feather name="send" size={15} color="#fff" />
                    <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>
                      {publishMutation.isPending ? "Publicando…" : "Publicar Livro do Dia"}
                    </Text>
                  </TouchableOpacity>
                )}
                {isCapitaoDailyBook && selectedBook.status === "PUBLISHED" && (
                  <TouchableOpacity
                    onPress={handleRepublish}
                    disabled={republishMutation.isPending}
                    style={{ marginHorizontal: 16, marginBottom: 10, backgroundColor: "#0284C7", borderRadius: 10, paddingVertical: 12, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 }}
                  >
                    <Feather name="refresh-cw" size={15} color="#fff" />
                    <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>
                      {republishMutation.isPending ? "Republicando…" : "Republicar Livro do Dia"}
                    </Text>
                  </TouchableOpacity>
                )}
                <Text style={styles.sectionTitle}>
                  Livro do Dia v{selectedBook.version} — Visão Completa
                </Text>
                {scenes.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyText}>Nenhuma cena ativa neste Livro do Dia. O supervisor ainda não estruturou as cenas do evento.</Text>
                  </View>
                ) : (
                  scenes.map((scene: DailyBookSceneWithBlocks) => {
                    const sceneExpanded = expandedScenes[scene.id] !== false;
                    const allPositions = scene.blocks.flatMap((b) =>
                      b.positions.filter((p) => !p.isRemoved)
                    );
                    const covered = allPositions.filter((p) =>
                      p.assignments.some((a) => a.status === "ASSIGNED")
                    ).length;
                    return (
                      <View key={scene.id}>
                        <Pressable style={styles.sceneRow} onPress={() => toggleScene(scene.id)}>
                          <Feather
                            name={sceneExpanded ? "chevron-down" : "chevron-right"}
                            size={14}
                            color={colors.mutedForeground}
                          />
                          <Feather name="layers" size={14} color={colors.primary} />
                          <Text style={styles.sceneName}>{scene.name}</Text>
                          <Text style={[styles.coverageText, { fontSize: 12 }]}>
                            {covered}/{allPositions.length}
                          </Text>
                        </Pressable>

                        {sceneExpanded &&
                          scene.blocks
                            .filter((b) => !b.isRemoved)
                            .map((block: DailyBookBlockWithPositions) => {
                              const blockExpanded = expandedBlocks[block.id] !== false;
                              return (
                                <View key={block.id}>
                                  <Pressable
                                    style={styles.blockRow}
                                    onPress={() => toggleBlock(block.id)}
                                  >
                                    <Feather
                                      name={blockExpanded ? "chevron-down" : "chevron-right"}
                                      size={12}
                                      color={colors.mutedForeground}
                                    />
                                    <Feather name="layout" size={12} color={colors.mutedForeground} />
                                    <Text style={styles.blockName}>{block.name}</Text>
                                  </Pressable>

                                  {blockExpanded &&
                                    block.positions
                                      .filter((p) => !p.isRemoved)
                                      .map((position: DailyBookPositionWithAssignments) => {
                                        const assigned = position.assignments.filter(
                                          (a) => a.status === "ASSIGNED"
                                        ).length;
                                        const isCovered = assigned >= position.minimumCoverage;
                                        return (
                                          <View key={position.id}>
                                            <View style={styles.positionRow}>
                                              <Text style={styles.positionName}>{position.name}</Text>
                                              <Text
                                                style={[
                                                  styles.coverageText,
                                                  { color: isCovered ? "#16A34A" : "#DC2626" },
                                                ]}
                                              >
                                                {assigned}/{position.minimumCoverage} escalado(s)
                                              </Text>
                                            </View>
                                            {position.assignments
                                              .filter((a) => a.status !== "REMOVED")
                                              .map((assignment: DailyBookAssignment) => (
                                                <View key={assignment.id} style={styles.assignmentRow}>
                                                  <Feather name="user" size={10} color={colors.mutedForeground} />
                                                  <Text style={styles.assignmentName} numberOfLines={1}>
                                                    {assignment.userId
                                                      ? assignment.userId.slice(0, 8)
                                                      : "Não escalado"}
                                                  </Text>
                                                  <View
                                                    style={[
                                                      styles.assignmentBadge,
                                                      { backgroundColor: ASSIGNMENT_COLORS[assignment.status] ?? "#6B7280" },
                                                    ]}
                                                  >
                                                    <Text style={styles.assignmentBadgeText}>
                                                      {ASSIGNMENT_LABELS[assignment.status] ?? assignment.status}
                                                    </Text>
                                                  </View>
                                                </View>
                                              ))}
                                          </View>
                                        );
                                      })}
                                </View>
                              );
                            })}
                      </View>
                    );
                  })
                )}
              </>
            ) : (
              <>
                {/* Member: only MY assignments */}
                <Text style={styles.sectionTitle}>Meus Escalamentos</Text>
                {myPositions.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Feather name="user-x" size={28} color={colors.mutedForeground} />
                    <Text style={styles.emptyText}>
                      Você não tem escalamentos neste Livro do Dia
                    </Text>
                  </View>
                ) : (
                  myPositions.map(({ assignment, position, block, scene }) => {
                    const statusColor = ASSIGNMENT_COLORS[assignment.status] ?? "#6B7280";
                    const isRepublished = selectedBook.status === "REPUBLISHED";
                    return (
                      <View key={assignment.id} style={styles.myPositionCard}>
                        <View style={styles.myPositionHeader}>
                          <Feather name="map-pin" size={16} color={colors.primary} />
                          <Text style={styles.myPositionName}>{position.name}</Text>
                          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
                            <Text style={styles.statusText}>
                              {ASSIGNMENT_LABELS[assignment.status] ?? assignment.status}
                            </Text>
                          </View>
                          {isRepublished && (
                            <View style={[styles.statusBadge, { backgroundColor: "#0284C7" }]}>
                              <Text style={styles.statusText}>Atualizado</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.myPositionBreadcrumb} numberOfLines={2}>
                          {scene.name} › {block.name}
                        </Text>
                      </View>
                    );
                  })
                )}
              </>
            )}
          </>
        )}
        <View style={{ height: insets.bottom + 80 }} />
      </ScrollView>
    </View>
  );
}
