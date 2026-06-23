import { useState, useMemo } from "react";
import {
  useListDailyBook,
  useGetDailyBook,
  getListDailyBookQueryKey,
  getGetDailyBookQueryKey,
} from "@workspace/api-client-react";
import { groupDailyBooksByOperation, dailyBookLabel } from "@/lib/daily-book-grouping";
import type {
  DailyBook,
  DailyBookWithScenes,
  DailyBookSceneWithBlocks,
  DailyBookBlockWithPositions,
  DailyBookPositionWithAssignments,
  DailyBookAssignment,
} from "@workspace/api-client-react";
import AdminLayout from "@/components/admin-layout";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BookOpen,
  RefreshCw,
  Layers,
  LayoutGrid,
  MapPin,
  ChevronDown,
  ChevronRight,
  UserX,
  Star,
} from "lucide-react";

// ─── Config ────────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Rascunho",
  PUBLISHED: "Publicado",
  REPUBLISHED: "Republicado",
  EXECUTED: "Executado",
  CANCELLED: "Cancelado",
};

const STATUS_BADGES: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  PUBLISHED: "bg-green-100 text-green-700",
  REPUBLISHED: "bg-sky-100 text-sky-700",
  EXECUTED: "bg-violet-100 text-violet-700",
  CANCELLED: "bg-red-100 text-red-700",
};

const ASSIGNMENT_BADGES: Record<string, string> = {
  ASSIGNED: "bg-green-100 text-green-700",
  AT_RISK: "bg-amber-100 text-amber-700",
  OPEN: "bg-red-100 text-red-700",
  REMOVED: "bg-gray-100 text-gray-500",
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

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({
  title,
  icon: Icon,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-center gap-2 pt-2">
      <Icon className="w-4 h-4 text-primary" />
      <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
        {title}
      </h2>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MembroLivroDoDiaPage() {
  const { user } = useAuth();
  const currentUserId = user?.id ?? null;

  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [expandedScenes, setExpandedScenes] = useState<Record<string, boolean>>({});

  const {
    data: listData,
    isLoading: listLoading,
    refetch: refetchList,
    isFetching: listFetching,
  } = useListDailyBook({}, { query: { queryKey: getListDailyBookQueryKey({}) } });

  const books: DailyBook[] = (listData as any)?.dailyBooks ?? [];
  const visibleBooks = books.filter(
    (b) => b.status === "PUBLISHED" || b.status === "REPUBLISHED"
  );

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

  const scenes: DailyBookSceneWithBlocks[] = useMemo(
    () =>
      ((selectedBook?.scenes as any) ?? []).filter(
        (s: DailyBookSceneWithBlocks) => !s.isRemoved
      ),
    [selectedBook]
  );

  const myPositions: MyPosition[] = useMemo(() => {
    if (!selectedBook || !currentUserId) return [];
    const result: MyPosition[] = [];
    scenes.forEach((scene) => {
      scene.blocks
        .filter((b) => !b.isRemoved)
        .forEach((block) => {
          block.positions
            .filter((p) => !p.isRemoved)
            .forEach((position) => {
              position.assignments
                .filter((a) => a.userId === currentUserId && a.status !== "REMOVED")
                .forEach((assignment) => {
                  result.push({ assignment, position, block, scene });
                });
            });
        });
    });
    return result;
  }, [selectedBook, scenes, currentUserId]);

  const toggleScene = (sceneId: string) =>
    setExpandedScenes((prev) => ({ ...prev, [sceneId]: !prev[sceneId] }));

  const handleRefresh = () => {
    refetchList();
    if (selectedBookId) refetchBook();
  };

  const formatBookTitle = (book: DailyBook) => dailyBookLabel(book);

  return (
    <AdminLayout title="Livro do Dia" subtitle="O roteiro do dia e seus escalamentos">
      <div className="max-w-4xl space-y-4">
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={listFetching}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${listFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>

        {/* ── Book selector ── */}
        <SectionHeader title="Selecionar Livro" icon={BookOpen} />
        {listLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-7 h-7 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          </div>
        ) : visibleBooks.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 bg-muted/30 text-center">
            <BookOpen className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              Nenhum Livro do Dia publicado ainda. Aguarde o supervisor gerar o livro
              do próximo evento.
            </p>
          </div>
        ) : (
          groupDailyBooksByOperation(visibleBooks).map((group) => (
          <div key={group.operationName} className="space-y-2">
            <h3 className="text-sm font-bold text-foreground pt-1">{group.operationName}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {group.items.map((book) => {
              const selected = selectedBookId === book.id;
              return (
                <button
                  key={book.id}
                  onClick={() => setSelectedBookId(book.id)}
                  className={`text-left rounded-xl border p-3 transition-colors hover:shadow-sm ${
                    selected
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border bg-background"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-primary shrink-0" />
                    <span className="flex-1 text-sm font-semibold truncate">
                      {formatBookTitle(book)}
                    </span>
                    <Badge variant="outline" className="text-xs shrink-0">
                      v{book.version}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                        STATUS_BADGES[book.status] ?? "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {STATUS_LABELS[book.status] ?? book.status}
                    </span>
                    {book.eventDate && (
                      <span className="text-xs text-muted-foreground">
                        {new Date(book.eventDate + "T00:00:00").toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "short",
                        })}
                      </span>
                    )}
                    {book.publishedAt && (
                      <span className="text-xs text-muted-foreground">
                        {new Date(book.publishedAt).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          </div>
          ))
        )}

        {/* ── Detail ── */}
        {selectedBookId && (
          <>
            {bookLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-7 h-7 rounded-full border-4 border-primary border-t-transparent animate-spin" />
              </div>
            ) : !selectedBook ? (
              <div className="rounded-lg border border-dashed p-8 bg-muted/30 text-center">
                <p className="text-sm text-muted-foreground">Livro não encontrado.</p>
              </div>
            ) : (
              <>
                {/* ── Meus Escalamentos ── */}
                <SectionHeader title="Meus Escalamentos" icon={Star} />
                {myPositions.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-8 bg-muted/30 text-center">
                    <UserX className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">
                      Você não tem escalamentos neste Livro do Dia.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {myPositions.map(({ assignment, position, block, scene }) => {
                      const isRepublished = selectedBook.status === "REPUBLISHED";
                      return (
                        <Card
                          key={assignment.id}
                          className="border-2 border-primary shadow-sm overflow-hidden"
                        >
                          <CardContent className="p-0">
                            <div className="flex items-center gap-2 px-4 py-3 bg-primary/10">
                              <MapPin className="h-4 w-4 text-primary shrink-0" />
                              <span className="flex-1 text-sm font-bold truncate">
                                {position.name}
                              </span>
                              <span
                                className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                                  ASSIGNMENT_BADGES[assignment.status] ??
                                  "bg-gray-100 text-gray-600"
                                }`}
                              >
                                {ASSIGNMENT_LABELS[assignment.status] ?? assignment.status}
                              </span>
                              {isRepublished && (
                                <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold bg-sky-100 text-sky-700">
                                  Atualizado
                                </span>
                              )}
                            </div>
                            <div className="px-4 py-2.5 text-xs text-muted-foreground flex items-center gap-1.5">
                              <span className="font-medium text-foreground">
                                {scene.name}
                              </span>
                              <ChevronRight className="h-3 w-3" />
                              <span>{block.name}</span>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}

                {/* ── Roteiro completo ── */}
                <SectionHeader title={`Roteiro do Dia — v${selectedBook.version}`} icon={Layers} />
                {scenes.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-8 bg-muted/30 text-center">
                    <p className="text-sm text-muted-foreground">
                      Nenhuma cena ativa neste Livro do Dia.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {scenes.map((scene) => {
                      const sceneExpanded = expandedScenes[scene.id] !== false;
                      const activeBlocks = scene.blocks.filter((b) => !b.isRemoved);
                      const allPositions = activeBlocks.flatMap((b) =>
                        b.positions.filter((p) => !p.isRemoved)
                      );
                      const covered = allPositions.filter((p) =>
                        p.assignments.some((a) => a.status === "ASSIGNED")
                      ).length;
                      const mineInScene = myPositions.some(
                        (mp) => mp.scene.id === scene.id
                      );
                      return (
                        <Card key={scene.id} className="overflow-hidden">
                          <button
                            onClick={() => toggleScene(scene.id)}
                            className="w-full flex items-center gap-2 px-4 py-3 bg-muted/50 hover:bg-muted transition-colors text-left"
                          >
                            {sceneExpanded ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                            )}
                            <Layers className="h-4 w-4 text-primary shrink-0" />
                            <span className="flex-1 text-sm font-semibold truncate">
                              {scene.name}
                            </span>
                            {mineInScene && (
                              <Badge className="bg-primary text-primary-foreground text-[10px] gap-1">
                                <Star className="h-3 w-3" />
                                Você
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground shrink-0">
                              {covered}/{allPositions.length}
                            </span>
                          </button>

                          {sceneExpanded && (
                            <div className="divide-y">
                              {activeBlocks.map((block) => (
                                <div key={block.id} className="px-4 py-3">
                                  <div className="flex items-center gap-2 mb-2">
                                    <LayoutGrid className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                    <span className="text-sm font-medium">
                                      {block.name}
                                    </span>
                                  </div>
                                  <div className="space-y-1.5 pl-5">
                                    {block.positions
                                      .filter((p) => !p.isRemoved)
                                      .map((position) => {
                                        const assigned = position.assignments.filter(
                                          (a) => a.status === "ASSIGNED"
                                        ).length;
                                        const isCovered =
                                          assigned >= position.minimumCoverage;
                                        const isMine =
                                          !!currentUserId &&
                                          position.assignments.some(
                                            (a) =>
                                              a.userId === currentUserId &&
                                              a.status !== "REMOVED"
                                          );
                                        return (
                                          <div
                                            key={position.id}
                                            className={`flex items-center gap-2 rounded-md px-2 py-1.5 ${
                                              isMine ? "bg-primary/5" : ""
                                            }`}
                                          >
                                            <span className="flex-1 text-sm truncate">
                                              {position.name}
                                            </span>
                                            {isMine && (
                                              <Star className="h-3.5 w-3.5 text-primary shrink-0" />
                                            )}
                                            <span
                                              className={`text-xs font-medium whitespace-nowrap ${
                                                isCovered
                                                  ? "text-green-600"
                                                  : "text-red-600"
                                              }`}
                                            >
                                              {assigned}/{position.minimumCoverage}{" "}
                                              escalado(s)
                                            </span>
                                          </div>
                                        );
                                      })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}
