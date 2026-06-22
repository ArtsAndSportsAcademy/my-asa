import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListDailyBook,
  useGetDailyBook,
  useGetDailyBookDelta,
  useRepublishDailyBook,
  useExecuteDailyBook,
  getListDailyBookQueryKey,
  getGetDailyBookQueryKey,
  getGetDailyBookDeltaQueryKey,
} from "@workspace/api-client-react";
import type {
  DailyBook,
  DailyBookWithScenes,
  DailyBookSceneWithBlocks,
  DailyBookBlockWithPositions,
  DailyBookPositionWithAssignments,
  DailyBookAssignment,
} from "@workspace/api-client-react";
import AdminLayout from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useListUsers } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import {
  BookOpen, Layers, Layout, User, CheckCircle, AlertTriangle, XCircle,
  ChevronRight, ChevronDown, Play, RotateCcw, Eye, Bell,
} from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Rascunho",
  PUBLISHED: "Publicado",
  REPUBLISHED: "Republicado",
  EXECUTED: "Executado",
  CANCELLED: "Cancelado",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  DRAFT: "secondary",
  PUBLISHED: "default",
  REPUBLISHED: "default",
  EXECUTED: "outline",
  CANCELLED: "destructive",
};

const ASSIGNMENT_COLORS: Record<string, string> = {
  ASSIGNED: "bg-green-100 text-green-800",
  AT_RISK: "bg-yellow-100 text-yellow-800",
  OPEN: "bg-red-100 text-red-800",
  REMOVED: "bg-gray-100 text-gray-400 line-through",
};

const ASSIGNMENT_LABELS: Record<string, string> = {
  ASSIGNED: "Escalado",
  AT_RISK: "Em Risco",
  OPEN: "Aberto",
  REMOVED: "Removido",
};

function CoverageIcon({ covered, total }: { covered: number; total: number }) {
  if (total === 0) return null;
  if (covered >= total) return <CheckCircle className="h-3.5 w-3.5 text-green-600" />;
  if (covered > 0) return <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />;
  return <XCircle className="h-3.5 w-3.5 text-red-500" />;
}

function ReadOnlyTree({ scenes, users }: { scenes: DailyBookSceneWithBlocks[]; users: { id: string; name: string | null }[] }) {
  const [expandedScenes, setExpandedScenes] = useState<Record<string, boolean>>({});
  const [expandedBlocks, setExpandedBlocks] = useState<Record<string, boolean>>({});

  const toggleScene = (id: string) => setExpandedScenes((p) => ({ ...p, [id]: !p[id] }));
  const toggleBlock = (id: string) => setExpandedBlocks((p) => ({ ...p, [id]: !p[id] }));

  const activeScenes = scenes.filter((s) => !s.isRemoved);

  if (activeScenes.length === 0) {
    return <div className="p-6 text-center text-sm text-muted-foreground">Nenhuma cena ativa neste Livro do Dia. O supervisor ainda não estruturou as cenas do evento.</div>;
  }

  return (
    <div className="divide-y">
      {activeScenes.map((scene: DailyBookSceneWithBlocks) => {
        const sceneOpen = expandedScenes[scene.id] !== false;
        const activeBlocks = scene.blocks.filter((b) => !b.isRemoved);
        const allPositions = activeBlocks.flatMap((b) => b.positions.filter((p) => !p.isRemoved));
        const covered = allPositions.filter((p) => p.assignments.some((a) => a.status === "ASSIGNED")).length;

        return (
          <div key={scene.id}>
            <button
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/40 text-left"
              onClick={() => toggleScene(scene.id)}
            >
              {sceneOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
              <Layers className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="text-sm font-semibold flex-1 truncate">{scene.name}</span>
              <CoverageIcon covered={covered} total={allPositions.length} />
              <span className="text-xs text-muted-foreground">{covered}/{allPositions.length}</span>
            </button>

            {sceneOpen && activeBlocks.map((block: DailyBookBlockWithPositions) => {
              const blockOpen = expandedBlocks[block.id] !== false;
              const blockPositions = block.positions.filter((p) => !p.isRemoved);
              const blockCovered = blockPositions.filter((p) => p.assignments.some((a) => a.status === "ASSIGNED")).length;

              return (
                <div key={block.id}>
                  <button
                    className="w-full flex items-center gap-2 pl-8 pr-3 py-1.5 hover:bg-muted/30 text-left border-t border-border/40"
                    onClick={() => toggleBlock(block.id)}
                  >
                    {blockOpen ? <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
                    <Layout className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="text-xs font-medium flex-1 truncate">{block.name}</span>
                    <span className="text-xs text-muted-foreground">{blockCovered}/{blockPositions.length}</span>
                  </button>

                  {blockOpen && blockPositions.map((position: DailyBookPositionWithAssignments) => {
                    const assigned = position.assignments.filter((a) => a.status === "ASSIGNED").length;
                    const isCovered = assigned >= position.minimumCoverage;

                    return (
                      <div key={position.id} className="pl-16 pr-3 py-1 border-t border-border/20 bg-muted/10">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs flex-1 truncate ${isCovered ? "" : "text-red-600"}`}>{position.name}</span>
                          <span className={`text-xs ${isCovered ? "text-green-600" : "text-red-500"}`}>
                            {assigned}/{position.minimumCoverage}
                          </span>
                        </div>
                        {position.assignments.filter((a) => a.status !== "REMOVED").map((assignment: DailyBookAssignment) => {
                          const person = users.find((u) => u.id === assignment.userId);
                          return (
                            <div key={assignment.id} className="flex items-center gap-2 py-0.5 pl-2">
                              <User className="h-3 w-3 text-muted-foreground shrink-0" />
                              <span className="text-xs text-muted-foreground flex-1 truncate">
                                {person?.name ?? assignment.userId ?? "Não escalado"}
                              </span>
                              <span className={`text-xs px-1.5 py-0.5 rounded-full ${ASSIGNMENT_COLORS[assignment.status] ?? ""}`}>
                                {ASSIGNMENT_LABELS[assignment.status] ?? assignment.status}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function DeltaViewer({ delta }: { delta: any }) {
  if (!delta) return <div className="p-4 text-sm text-muted-foreground">Nenhum delta armazenado.</div>;

  const { additions = [], removals = [], swaps = [], structural = [] } = delta;
  const empty = additions.length === 0 && removals.length === 0 && swaps.length === 0 && structural.length === 0;

  if (empty) return <div className="p-4 text-sm text-muted-foreground">Nenhuma alteração registrada.</div>;

  return (
    <div className="p-3 space-y-3 text-xs">
      {structural.length > 0 && (
        <div>
          <div className="font-semibold text-muted-foreground uppercase tracking-wide mb-1">Estrutural ({structural.length})</div>
          {structural.map((s: any, i: number) => (
            <div key={i} className="flex items-center gap-2 py-0.5">
              <span className="px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-800">{s.type}</span>
              <span className="text-muted-foreground truncate">{s.name ?? s.positionName ?? s.blockName ?? s.id}</span>
            </div>
          ))}
        </div>
      )}
      {swaps.length > 0 && (
        <div>
          <div className="font-semibold text-muted-foreground uppercase tracking-wide mb-1">Trocas ({swaps.length})</div>
          {swaps.map((s: any, i: number) => (
            <div key={i} className="py-0.5">
              <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">troca</span>
              <span className="ml-2 text-muted-foreground">{(s.from ?? "vazio").slice(0, 8)} → {(s.to ?? "vazio").slice(0, 8)}</span>
            </div>
          ))}
        </div>
      )}
      {additions.length > 0 && (
        <div>
          <div className="font-semibold text-muted-foreground uppercase tracking-wide mb-1">Adições ({additions.length})</div>
          {additions.map((a: any, i: number) => (
            <div key={i} className="py-0.5">
              <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-800">+ {a.type}</span>
            </div>
          ))}
        </div>
      )}
      {removals.length > 0 && (
        <div>
          <div className="font-semibold text-muted-foreground uppercase tracking-wide mb-1">Remoções ({removals.length})</div>
          {removals.map((r: any, i: number) => (
            <div key={i} className="py-0.5">
              <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-800">− {r.type}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SupervisorDailyBookPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const auth = useAuth();
  const operationId = auth.roles.find((r) => r.operationId)?.operationId;
  const isSupervisor = auth.roles.some((r) => ["ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"].includes(r.role));

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rightTab, setRightTab] = useState<"coverage" | "delta" | "history">("coverage");
  const [republishOpen, setRepublishOpen] = useState(false);
  const [republishReason, setRepublishReason] = useState("");
  const [republishComment, setRepublishComment] = useState("");
  const [executeOpen, setExecuteOpen] = useState(false);

  const { data: listData, isLoading } = useListDailyBook(
    {},
    { query: { queryKey: getListDailyBookQueryKey({}) } }
  );
  const books: DailyBook[] = (listData as any)?.dailyBooks ?? [];
  const publishedBooks = books.filter((b) => ["PUBLISHED", "REPUBLISHED", "EXECUTED"].includes(b.status));

  const { data: bookData, isLoading: bookLoading } = useGetDailyBook(selectedId ?? "", {
    query: { enabled: !!selectedId, queryKey: getGetDailyBookQueryKey(selectedId ?? "") },
  });
  const selectedBook = (bookData as any)?.dailyBook as DailyBookWithScenes | undefined;

  const { data: usersData } = useListUsers();
  const users: { id: string; name: string | null }[] = (usersData as any)?.users ?? [];

  const { data: liveDeltaData, isLoading: isDeltaLoading } = useGetDailyBookDelta(
    selectedId ?? "",
    { query: { enabled: !!selectedId && republishOpen, queryKey: [...getGetDailyBookDeltaQueryKey(selectedId ?? ""), "sup-republish"] } }
  );
  const liveDelta = (liveDeltaData as any)?.liveDelta as any;
  const hasLiveChanges = (liveDeltaData as any)?.hasLiveChanges as boolean | undefined;

  const republishMutation = useRepublishDailyBook();
  const executeMutation = useExecuteDailyBook();

  const invalidate = useCallback((id?: string) => {
    queryClient.invalidateQueries({ queryKey: getListDailyBookQueryKey({}) });
    if (id) queryClient.invalidateQueries({ queryKey: getGetDailyBookQueryKey(id) });
  }, [queryClient]);

  const handleRepublish = async () => {
    if (!selectedId) return;
    try {
      const result = await republishMutation.mutateAsync({ id: selectedId, data: { comment: republishComment.trim() || null } });
      toast({ title: `Republicado! Versão ${(result as any).dailyBook?.version}` });
      setRepublishOpen(false);
      setRepublishReason("");
      setRepublishComment("");
      invalidate(selectedId);
      setRightTab("delta");
    } catch (e: any) {
      toast({ title: e?.response?.data?.error ?? "Erro ao republicar", variant: "destructive" });
    }
  };

  const handleExecute = async () => {
    if (!selectedId) return;
    try {
      await executeMutation.mutateAsync({ id: selectedId });
      toast({ title: "Livro do Dia marcado como Executado!" });
      setExecuteOpen(false);
      invalidate(selectedId);
    } catch {
      toast({ title: "Erro ao executar", variant: "destructive" });
    }
  };

  const bookStatus = selectedBook?.status;
  const canRepublish = isSupervisor && (bookStatus === "PUBLISHED" || bookStatus === "REPUBLISHED");
  const canExecute = isSupervisor && (bookStatus === "PUBLISHED" || bookStatus === "REPUBLISHED");

  const scenes: DailyBookSceneWithBlocks[] = (selectedBook?.scenes as any) ?? [];
  const allPositions = scenes.flatMap((s) => s.blocks.flatMap((b) => b.positions.filter((p) => !p.isRemoved)));
  const coveredPositions = allPositions.filter((p) => p.assignments.some((a) => a.status === "ASSIGNED"));
  const atRiskPositions = allPositions.filter((p) => p.assignments.some((a) => a.status === "AT_RISK"));
  const openPositions = allPositions.filter((p) => !p.assignments.some((a) => ["ASSIGNED", "AT_RISK"].includes(a.status)));

  const lastDelta = selectedBook?.republishDeltaJson as any;

  return (
    <AdminLayout title="Livro do Dia" subtitle="Roteiro operacional do dia">
      <div className="flex items-center justify-end mb-4">
        <Button variant="outline" size="sm" onClick={() => setLocation("/supervisor/avisos")}>
          <Bell className="w-4 h-4 mr-2" />
          Avisos
        </Button>
      </div>
      <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
        {/* Panel 1 — Lista */}
        <div className="w-64 border-r flex flex-col shrink-0">
          <div className="p-3 border-b">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <Eye className="h-4 w-4 text-muted-foreground" />
              Livros Publicados
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="p-4 text-center text-sm text-muted-foreground">Carregando...</div>
            ) : publishedBooks.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">Nenhum Livro do Dia publicado ainda. Aguarde o supervisor gerar e publicar o livro do próximo evento.</div>
            ) : (
              publishedBooks.map((book) => (
                <button
                  key={book.id}
                  onClick={() => setSelectedId(book.id)}
                  className={`w-full text-left px-3 py-2.5 border-b hover:bg-muted/50 transition-colors ${selectedId === book.id ? "bg-muted" : ""}`}
                >
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium truncate flex-1">
                      Evento {book.agendaEventId.slice(0, 8)}
                    </span>
                    <Badge variant={STATUS_VARIANTS[book.status] ?? "secondary"} className="text-xs shrink-0">
                      v{book.version}
                    </Badge>
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground pl-5">
                    {STATUS_LABELS[book.status] ?? book.status}
                    {book.publishedAt ? ` · ${new Date(book.publishedAt).toLocaleDateString("pt-BR")}` : ""}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Panel 2 — Árvore de execução (read-only) */}
        <div className="flex-1 border-r flex flex-col min-w-0">
          {!selectedId ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              Selecione um Livro do Dia
            </div>
          ) : bookLoading ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              Carregando...
            </div>
          ) : !selectedBook ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              Livro não encontrado
            </div>
          ) : (
            <>
              <div className="px-4 py-3 border-b flex items-center justify-between gap-3 shrink-0">
                <div>
                  <div className="font-semibold text-sm flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                    Livro do Dia v{selectedBook.version}
                    <Badge variant={STATUS_VARIANTS[selectedBook.status] ?? "secondary"}>
                      {STATUS_LABELS[selectedBook.status] ?? selectedBook.status}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {selectedBook.publishedAt
                      ? `Publicado em ${new Date(selectedBook.publishedAt).toLocaleString("pt-BR")}`
                      : "Não publicado"}
                  </div>
                  {selectedBook.publishComment && (
                    <div className="text-xs text-foreground italic mt-0.5">
                      “{selectedBook.publishComment}”
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {canRepublish && (
                    <Button size="sm" variant="outline" onClick={() => setRepublishOpen(true)}>
                      <RotateCcw className="h-3.5 w-3.5 mr-1" /> Republicar
                    </Button>
                  )}
                  {canExecute && (
                    <Button size="sm" onClick={() => setExecuteOpen(true)}>
                      <Play className="h-3.5 w-3.5 mr-1" /> Executar
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                <ReadOnlyTree scenes={scenes} users={users} />
              </div>
            </>
          )}
        </div>

        {/* Panel 3 — Impacto / Delta / Histórico */}
        <div className="w-72 flex flex-col shrink-0">
          <div className="flex border-b shrink-0">
            {(["coverage", "delta", "history"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setRightTab(tab)}
                className={`flex-1 py-2 text-xs font-medium transition-colors border-b-2 ${
                  rightTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab === "coverage" ? "Cobertura" : tab === "delta" ? "Delta" : "Histórico"}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            {!selectedBook ? (
              <div className="p-4 text-sm text-muted-foreground text-center">Selecione um livro</div>
            ) : rightTab === "coverage" ? (
              <div className="p-3 space-y-3">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Resumo de Cobertura</div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between rounded-lg p-2 bg-green-50 border border-green-200">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-xs font-medium text-green-800">Cobertos</span>
                    </div>
                    <span className="text-sm font-bold text-green-700">{coveredPositions.length}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg p-2 bg-yellow-50 border border-yellow-200">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      <span className="text-xs font-medium text-yellow-800">Em Risco</span>
                    </div>
                    <span className="text-sm font-bold text-yellow-700">{atRiskPositions.length}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg p-2 bg-red-50 border border-red-200">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-600" />
                      <span className="text-xs font-medium text-red-800">Descobertos</span>
                    </div>
                    <span className="text-sm font-bold text-red-700">{openPositions.length}</span>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground pt-1">
                  Total: {allPositions.length} posição(ões) ativas
                </div>
                <div className="text-xs text-muted-foreground">
                  {scenes.filter((s) => !s.isRemoved).length} cenas · {scenes.flatMap((s) => s.blocks).filter((b) => !b.isRemoved).length} blocos
                </div>
              </div>
            ) : rightTab === "delta" ? (
              <div>
                <div className="p-3 text-xs text-muted-foreground border-b">
                  Delta da última republicação (v{selectedBook.version})
                </div>
                <DeltaViewer delta={lastDelta} />
              </div>
            ) : (
              <div className="p-3 space-y-2">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Histórico</div>
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-2 py-1">
                    <div className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
                    <span className="text-muted-foreground">v{selectedBook.version} — {STATUS_LABELS[selectedBook.status] ?? selectedBook.status}</span>
                  </div>
                  {selectedBook.publishedAt && (
                    <div className="pl-4 text-muted-foreground">
                      {new Date(selectedBook.publishedAt).toLocaleString("pt-BR")}
                    </div>
                  )}
                  {selectedBook.generatedAt && (
                    <div className="flex items-center gap-2 py-1">
                      <div className="w-2 h-2 rounded-full bg-gray-300 shrink-0" />
                      <span className="text-muted-foreground">
                        Gerado: {new Date(selectedBook.generatedAt).toLocaleString("pt-BR")}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Republish Dialog */}
      <Dialog open={republishOpen} onOpenChange={setRepublishOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Republicar Livro do Dia</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Uma nova versão será publicada com o delta das alterações. Esta ação notificará a equipe escalada.
            </p>

            {/* Live delta preview */}
            <div className="border rounded-md p-3 bg-muted/30 max-h-48 overflow-y-auto">
              <p className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Delta de alterações</p>
              {isDeltaLoading ? (
                <p className="text-sm text-muted-foreground">Calculando delta...</p>
              ) : hasLiveChanges === false ? (
                <p className="text-sm text-amber-600 font-medium">Nenhuma alteração detectada. Não há o que republicar.</p>
              ) : liveDelta ? (
                <DeltaViewer delta={liveDelta} />
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma informação de delta disponível.</p>
              )}
            </div>

            <div>
              <Label>Comentário <span className="text-muted-foreground font-normal">(versão do show, opcional)</span></Label>
              <Textarea
                className="mt-1"
                placeholder="Ex: Versão revisada após troca de elenco..."
                value={republishComment}
                onChange={(e) => setRepublishComment(e.target.value)}
                rows={2}
              />
            </div>

            <div>
              <Label>Motivo da republicação <span className="text-muted-foreground font-normal">(opcional)</span></Label>
              <Textarea
                className="mt-1"
                placeholder="Ex: Troca de escalado por imprevisto de última hora..."
                value={republishReason}
                onChange={(e) => setRepublishReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRepublishOpen(false); setRepublishReason(""); setRepublishComment(""); }}>
              Cancelar
            </Button>
            <Button
              onClick={handleRepublish}
              disabled={hasLiveChanges === false || isDeltaLoading || republishMutation.isPending}
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              {republishMutation.isPending ? "Publicando..." : "Republicar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Execute Dialog */}
      <Dialog open={executeOpen} onOpenChange={setExecuteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar como Executado</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Confirme que o show/ensaio foi executado com base neste Livro do Dia. Esta ação não pode ser desfeita.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExecuteOpen(false)}>Cancelar</Button>
            <Button onClick={handleExecute} disabled={executeMutation.isPending}>
              <Play className="h-3.5 w-3.5 mr-1" />
              {executeMutation.isPending ? "Aguarde..." : "Confirmar Execução"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
