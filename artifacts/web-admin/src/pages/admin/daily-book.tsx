import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListDailyBook,
  useGetDailyBook,
  useGetDailyBookDelta,
  useGenerateDailyBook,
  usePublishDailyBook,
  useRepublishDailyBook,
  useExecuteDailyBook,
  useCancelDailyBook,
  useDeleteDailyBookScene,
  useDeleteDailyBookBlock,
  useDeleteDailyBookPosition,
  usePatchDailyBookAssignment,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  ChevronRight, ChevronDown, BookOpen, Layers, Layout, AlignLeft,
  Users, Trash2, Play, RefreshCw, Send, RotateCcw, CheckCircle, XCircle, User, AlertTriangle,
} from "lucide-react";
import { useListUsers } from "@workspace/api-client-react";
import { useListAgendaEvents } from "@workspace/api-client-react";

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

const ASSIGNMENT_STATUS_LABELS: Record<string, string> = {
  ASSIGNED: "Escalado",
  AT_RISK: "Em Risco",
  OPEN: "Aberto",
  REMOVED: "Removido",
};

function DeltaView({ delta }: { delta: any }) {
  if (!delta || delta.isEmpty) return <p className="text-sm text-muted-foreground">Sem alterações.</p>;
  return (
    <div className="space-y-3 text-sm">
      {(delta.additions ?? []).length > 0 && (
        <div>
          <p className="font-medium text-green-700">Adições ({delta.additions.length})</p>
          <ul className="mt-1 space-y-0.5 pl-4">
            {delta.additions.map((a: any, i: number) => (
              <li key={i} className="text-xs text-muted-foreground">+ {a.type} {a.name ?? a.positionName ?? ""}</li>
            ))}
          </ul>
        </div>
      )}
      {(delta.removals ?? []).length > 0 && (
        <div>
          <p className="font-medium text-red-700">Remoções ({delta.removals.length})</p>
          <ul className="mt-1 space-y-0.5 pl-4">
            {delta.removals.map((r: any, i: number) => (
              <li key={i} className="text-xs text-muted-foreground">- {r.type} {r.name ?? r.positionName ?? ""}</li>
            ))}
          </ul>
        </div>
      )}
      {(delta.structural ?? []).length > 0 && (
        <div>
          <p className="font-medium text-orange-700">Estruturais ({delta.structural.length})</p>
          <ul className="mt-1 space-y-0.5 pl-4">
            {delta.structural.map((s: any, i: number) => (
              <li key={i} className="text-xs text-muted-foreground">△ {s.type} {s.name ?? s.blockName ?? s.positionName ?? ""}</li>
            ))}
          </ul>
        </div>
      )}
      {(delta.swaps ?? []).length > 0 && (
        <div>
          <p className="font-medium text-blue-700">Trocas ({delta.swaps.length})</p>
          <ul className="mt-1 space-y-0.5 pl-4">
            {delta.swaps.map((s: any, i: number) => (
              <li key={i} className="text-xs text-muted-foreground">⇄ atribuição {s.assignmentId?.slice(0, 8)}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const ASSIGNMENT_STATUS_COLORS: Record<string, string> = {
  ASSIGNED: "bg-green-100 text-green-800",
  AT_RISK: "bg-yellow-100 text-yellow-800",
  OPEN: "bg-red-100 text-red-800",
  REMOVED: "bg-gray-100 text-gray-500 line-through",
};

function TreeNode({
  label, icon: Icon, depth = 0, onDelete, deleteLabel, children, badge, extra,
}: {
  label: string; icon: React.ElementType; depth?: number; onDelete?: () => void;
  deleteLabel?: string; children?: React.ReactNode; badge?: React.ReactNode; extra?: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  const hasChildren = !!children;
  return (
    <div>
      <div
        className="flex items-center gap-1 py-1 px-2 rounded hover:bg-muted/50 group cursor-pointer"
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={() => hasChildren && setOpen((o) => !o)}
      >
        {hasChildren
          ? open ? <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
          : <span className="w-3" />}
        <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-sm flex-1 truncate">{label}</span>
        {badge}
        {extra}
        {onDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-destructive rounded ml-1"
            title={deleteLabel}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>
      {hasChildren && open && <div>{children}</div>}
    </div>
  );
}

function AssignmentRow({
  assignment, position, users, onSwap, canEdit,
}: {
  assignment: DailyBookAssignment;
  position: DailyBookPositionWithAssignments;
  users: { id: string; name: string | null }[];
  onSwap: (assignmentId: string, userId: string | null) => void;
  canEdit: boolean;
}) {
  const [swapOpen, setSwapOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(assignment.userId ?? null);

  const statusClass = ASSIGNMENT_STATUS_COLORS[assignment.status] ?? "";
  const currentUser = users.find((u) => u.id === assignment.userId);

  return (
    <div className="flex items-center gap-2 px-2 py-0.5 group" style={{ paddingLeft: `${8 + 4 * 16}px` }}>
      <User className="h-3 w-3 text-muted-foreground shrink-0" />
      <span className="text-xs text-muted-foreground flex-1">
        {currentUser?.name ?? assignment.userId ?? "Não escalado"}
      </span>
      <span className={`text-xs px-1.5 py-0.5 rounded-full ${statusClass}`}>
        {ASSIGNMENT_STATUS_LABELS[assignment.status] ?? assignment.status}
      </span>
      {canEdit && assignment.status !== "REMOVED" && (
        <button
          onClick={() => setSwapOpen(true)}
          className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-primary rounded text-xs"
          title="Trocar escalado"
        >
          <RefreshCw className="h-3 w-3" />
        </button>
      )}
      <Dialog open={swapOpen} onOpenChange={setSwapOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Trocar Escalado — {position.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label>Novo escalado</Label>
            <Select
              value={selectedUserId ?? "__none"}
              onValueChange={(v) => setSelectedUserId(v === "__none" ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um usuário..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">— Sem escalado —</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.name ?? u.id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSwapOpen(false)}>Cancelar</Button>
            <Button onClick={() => { onSwap(assignment.id, selectedUserId); setSwapOpen(false); }}>
              Confirmar troca
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AdminDailyBookPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const auth = useAuth();
  const isAdmin = auth.roles.some((r) => r.role === "ADMIN" || r.role === "SUPERVISOR_A" || r.role === "SUPERVISOR_B");
  const operationId = auth.roles.find((r) => r.operationId)?.operationId;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [republishOpen, setRepublishOpen] = useState(false);
  const [centerTab, setCenterTab] = useState<"cena" | "bloco" | "posicao">("cena");
  const [rightTab, setRightTab] = useState<"impacto" | "alteracoes" | "historico" | "delta">("impacto");
  const [filterStatus, setFilterStatus] = useState<string>("__all");
  const [filterEventId, setFilterEventId] = useState<string>("__all");

  const listParams = {
    ...(filterStatus !== "__all" ? { status: filterStatus } : {}),
    ...(filterEventId !== "__all" ? { agendaEventId: filterEventId } : {}),
  };
  const { data: listData, isLoading } = useListDailyBook(
    listParams,
    { query: { queryKey: getListDailyBookQueryKey(listParams) } }
  );
  const books: DailyBook[] = (listData as any)?.dailyBooks ?? [];

  const { data: bookData } = useGetDailyBook(selectedId ?? "", {
    query: { enabled: !!selectedId, queryKey: getGetDailyBookQueryKey(selectedId ?? "") },
  });
  const selectedBook = (bookData as any)?.dailyBook as DailyBookWithScenes | undefined;

  const { data: eventsData } = useListAgendaEvents({ operationId });
  const events: { id: string; title: string }[] = (eventsData as any)?.events ?? [];

  const { data: usersData } = useListUsers();
  const users: { id: string; name: string | null }[] = (usersData as any)?.users ?? [];

  const bookStatus = selectedBook?.status;
  const needsDelta = !!selectedId && (bookStatus === "PUBLISHED" || bookStatus === "REPUBLISHED");
  const { data: liveDeltaData, isLoading: isDeltaLoading } = useGetDailyBookDelta(selectedId ?? "", {
    query: { enabled: needsDelta, queryKey: getGetDailyBookDeltaQueryKey(selectedId ?? "") },
  });
  const liveDelta = (liveDeltaData as any)?.liveDelta as any;
  const hasLiveChanges = (liveDeltaData as any)?.hasLiveChanges as boolean | undefined;

  const generateMutation = useGenerateDailyBook();
  const publishMutation = usePublishDailyBook();
  const republishMutation = useRepublishDailyBook();
  const executeMutation = useExecuteDailyBook();
  const cancelMutation = useCancelDailyBook();
  const deleteSceneMutation = useDeleteDailyBookScene();
  const deleteBlockMutation = useDeleteDailyBookBlock();
  const deletePositionMutation = useDeleteDailyBookPosition();
  const patchAssignmentMutation = usePatchDailyBookAssignment();

  const invalidate = useCallback((id?: string) => {
    queryClient.invalidateQueries({ queryKey: getListDailyBookQueryKey({}) });
    if (id) queryClient.invalidateQueries({ queryKey: getGetDailyBookQueryKey(id) });
  }, [queryClient]);

  const handleGenerate = async () => {
    if (!selectedEventId) return;
    try {
      const result = await generateMutation.mutateAsync({ data: { agendaEventId: selectedEventId } });
      const newBook = (result as any).dailyBook;
      toast({ title: "Livro do Dia gerado com sucesso!" });
      setGenerateOpen(false);
      setSelectedEventId(null);
      invalidate();
      if (newBook?.id) setSelectedId(newBook.id);
    } catch {
      toast({ title: "Erro ao gerar Livro do Dia", variant: "destructive" });
    }
  };

  const handlePublish = async () => {
    if (!selectedId) return;
    try {
      await publishMutation.mutateAsync({ id: selectedId });
      toast({ title: "Livro do Dia publicado!" });
      setPublishOpen(false);
      invalidate(selectedId);
    } catch {
      toast({ title: "Erro ao publicar", variant: "destructive" });
    }
  };

  const handleRepublish = async () => {
    if (!selectedId) return;
    try {
      const result = await republishMutation.mutateAsync({ id: selectedId });
      toast({ title: `Republicado com delta. Versão ${(result as any).dailyBook?.version}` });
      setRepublishOpen(false);
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
      invalidate(selectedId);
    } catch {
      toast({ title: "Erro ao executar", variant: "destructive" });
    }
  };

  const handleCancel = async () => {
    if (!selectedId || !cancelReason.trim()) return;
    try {
      await cancelMutation.mutateAsync({ id: selectedId, data: { reason: cancelReason } });
      toast({ title: "Livro do Dia cancelado." });
      setCancelOpen(false);
      setCancelReason("");
      invalidate(selectedId);
    } catch {
      toast({ title: "Erro ao cancelar", variant: "destructive" });
    }
  };

  const handleSwapAssignment = async (assignmentId: string, userId: string | null) => {
    if (!selectedId) return;
    try {
      await patchAssignmentMutation.mutateAsync({ id: selectedId, assignmentId, data: { userId } });
      toast({ title: "Escalado atualizado!" });
      invalidate(selectedId);
    } catch {
      toast({ title: "Erro ao trocar escalado", variant: "destructive" });
    }
  };

  const handleDeleteScene = async (sceneId: string) => {
    if (!selectedId) return;
    try {
      await deleteSceneMutation.mutateAsync({ id: selectedId, sceneId });
      toast({ title: "Cena removida do Livro do Dia" });
      invalidate(selectedId);
    } catch {
      toast({ title: "Erro ao remover cena", variant: "destructive" });
    }
  };

  const handleDeleteBlock = async (blockId: string) => {
    if (!selectedId) return;
    try {
      await deleteBlockMutation.mutateAsync({ id: selectedId, blockId });
      toast({ title: "Bloco removido do Livro do Dia" });
      invalidate(selectedId);
    } catch {
      toast({ title: "Erro ao remover bloco", variant: "destructive" });
    }
  };

  const handleDeletePosition = async (positionId: string) => {
    if (!selectedId) return;
    try {
      await deletePositionMutation.mutateAsync({ id: selectedId, positionId });
      toast({ title: "Posição removida do Livro do Dia" });
      invalidate(selectedId);
    } catch {
      toast({ title: "Erro ao remover posição", variant: "destructive" });
    }
  };

  const canEdit = isAdmin && bookStatus !== "EXECUTED" && bookStatus !== "CANCELLED";
  const canPublish = isAdmin && bookStatus === "DRAFT";
  const canRepublish = isAdmin && (bookStatus === "PUBLISHED" || bookStatus === "REPUBLISHED");
  const canExecute = isAdmin && (bookStatus === "PUBLISHED" || bookStatus === "REPUBLISHED");
  const canCancel = isAdmin && bookStatus !== "CANCELLED" && bookStatus !== "EXECUTED";

  const lastDelta = selectedBook?.republishDeltaJson as any;

  return (
    <AdminLayout title="Livro do Dia">
      <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
        {/* Panel 1 — Lista de Livros */}
        <div className="w-64 border-r flex flex-col shrink-0">
          <div className="p-3 border-b flex items-center justify-between">
            <h2 className="font-semibold text-sm">Livro do Dia</h2>
            {isAdmin && (
              <Button size="sm" variant="outline" onClick={() => setGenerateOpen(true)} title="Gerar novo Livro do Dia">
                <Play className="h-3 w-3 mr-1" /> Gerar
              </Button>
            )}
          </div>
          <div className="p-2 border-b space-y-1.5">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-7 text-xs">
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">Todos</SelectItem>
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterEventId} onValueChange={setFilterEventId}>
              <SelectTrigger className="h-7 text-xs">
                <SelectValue placeholder="Todos os eventos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">Todos</SelectItem>
                {events.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.title ?? e.id.slice(0, 8)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="p-4 text-center text-sm text-muted-foreground">Carregando...</div>
            ) : books.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">Nenhum Livro do Dia</div>
            ) : (
              books.map((book) => {
                const eventLabel = book.agendaEventId.slice(0, 8);
                return (
                  <button
                    key={book.id}
                    onClick={() => setSelectedId(book.id)}
                    className={`w-full text-left px-3 py-2.5 border-b hover:bg-muted/50 transition-colors ${selectedId === book.id ? "bg-muted" : ""}`}
                  >
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-sm font-medium truncate flex-1">Evento {eventLabel}</span>
                      <Badge variant={STATUS_VARIANTS[book.status] ?? "secondary"} className="text-xs shrink-0">
                        v{book.version}
                      </Badge>
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground pl-5">
                      {STATUS_LABELS[book.status] ?? book.status}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Panel 2 — Centro: Cena / Bloco / Posição */}
        <div className="w-80 border-r flex flex-col shrink-0">
          {!selectedBook ? (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground p-6 text-center">
              Selecione um Livro do Dia
            </div>
          ) : (
            <>
              <div className="p-3 border-b shrink-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-sm truncate">Estrutura</span>
                  <Badge variant={STATUS_VARIANTS[selectedBook.status] ?? "secondary"}>
                    {STATUS_LABELS[selectedBook.status] ?? selectedBook.status} v{selectedBook.version}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {canPublish && (
                    <Button size="sm" className="h-7 text-xs" onClick={() => setPublishOpen(true)}>
                      <Send className="h-3 w-3 mr-1" /> Publicar
                    </Button>
                  )}
                  {canRepublish && (
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setRepublishOpen(true)}>
                      <RotateCcw className="h-3 w-3 mr-1" /> Republicar
                    </Button>
                  )}
                  {canExecute && (
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleExecute} disabled={executeMutation.isPending}>
                      <CheckCircle className="h-3 w-3 mr-1" /> Executar
                    </Button>
                  )}
                  {canCancel && (
                    <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => setCancelOpen(true)}>
                      <XCircle className="h-3 w-3 mr-1" /> Cancelar
                    </Button>
                  )}
                </div>
                {hasLiveChanges && (
                  <div className="mt-1 flex items-center gap-1 text-xs text-amber-600">
                    <AlertTriangle className="h-3 w-3" />
                    Há alterações locais não republicadas
                  </div>
                )}
              </div>
              <Tabs value={centerTab} onValueChange={(v) => setCenterTab(v as typeof centerTab)} className="flex flex-col flex-1 min-h-0">
                <TabsList className="shrink-0 mx-2 mt-1 h-7 text-xs">
                  <TabsTrigger value="cena" className="text-xs h-6">Cena</TabsTrigger>
                  <TabsTrigger value="bloco" className="text-xs h-6">Bloco</TabsTrigger>
                  <TabsTrigger value="posicao" className="text-xs h-6">Posição</TabsTrigger>
                </TabsList>
                <TabsContent value="cena" className="flex-1 overflow-y-auto p-2 mt-0 data-[state=inactive]:hidden">
                  {(selectedBook.scenes ?? []).filter((s) => !s.isRemoved).map((scene: DailyBookSceneWithBlocks) => (
                    <TreeNode key={scene.id} label={scene.name} icon={Layers} depth={0}
                      onDelete={canEdit ? () => handleDeleteScene(scene.id) : undefined} deleteLabel="Remover cena">
                      {(scene.blocks ?? []).filter((b) => !b.isRemoved).map((block: DailyBookBlockWithPositions) => (
                        <TreeNode key={block.id} label={block.name} icon={Layout} depth={1}
                          onDelete={canEdit ? () => handleDeleteBlock(block.id) : undefined} deleteLabel="Remover bloco">
                          {(block.positions ?? []).filter((p) => !p.isRemoved).map((position: DailyBookPositionWithAssignments) => (
                            <TreeNode key={position.id} label={position.name} icon={AlignLeft} depth={2}
                              onDelete={canEdit ? () => handleDeletePosition(position.id) : undefined} deleteLabel="Remover posição"
                              badge={<span className="text-xs text-muted-foreground">{position.assignments.filter((a) => a.status === "ASSIGNED").length}/{position.minimumCoverage}</span>}>
                              {(position.assignments ?? []).map((assignment: DailyBookAssignment) => (
                                <AssignmentRow key={assignment.id} assignment={assignment} position={position} users={users} onSwap={handleSwapAssignment} canEdit={canEdit} />
                              ))}
                            </TreeNode>
                          ))}
                        </TreeNode>
                      ))}
                    </TreeNode>
                  ))}
                  {(selectedBook.scenes ?? []).filter((s) => !s.isRemoved).length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">Sem cenas neste Livro do Dia</p>
                  )}
                </TabsContent>
                <TabsContent value="bloco" className="flex-1 overflow-y-auto p-2 mt-0 data-[state=inactive]:hidden">
                  {(selectedBook.scenes ?? []).filter((s) => !s.isRemoved).map((scene: DailyBookSceneWithBlocks) => (
                    <div key={scene.id} className="mb-3">
                      <p className="text-xs font-semibold text-muted-foreground px-1 mb-1 flex items-center gap-1"><Layers className="h-3 w-3" />{scene.name}</p>
                      {(scene.blocks ?? []).filter((b) => !b.isRemoved).map((block: DailyBookBlockWithPositions) => (
                        <div key={block.id} className="ml-2 mb-1 rounded border px-2 py-1 text-xs flex items-center justify-between">
                          <span className="flex items-center gap-1"><Layout className="h-3 w-3 text-muted-foreground" />{block.name}</span>
                          <span className="text-muted-foreground">{block.positions.filter((p) => !p.isRemoved).length} pos.</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </TabsContent>
                <TabsContent value="posicao" className="flex-1 overflow-y-auto p-2 mt-0 data-[state=inactive]:hidden">
                  {(selectedBook.scenes ?? []).filter((s) => !s.isRemoved).flatMap((scene: DailyBookSceneWithBlocks) =>
                    (scene.blocks ?? []).filter((b) => !b.isRemoved).flatMap((block: DailyBookBlockWithPositions) =>
                      (block.positions ?? []).filter((p) => !p.isRemoved).map((position: DailyBookPositionWithAssignments) => (
                        <div key={position.id} className="mb-2 rounded border px-2 py-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium flex items-center gap-1"><AlignLeft className="h-3 w-3 text-muted-foreground" />{position.name}</span>
                            <span className="text-xs text-muted-foreground">{position.assignments.filter((a) => a.status === "ASSIGNED").length}/{position.minimumCoverage}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{scene.name} › {block.name}</p>
                        </div>
                      ))
                    )
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>

        {/* Panel 3 — Tabs: Impacto / Alterações / Delta */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!selectedBook ? (
            <div className="flex-1 flex items-center justify-center text-center text-sm text-muted-foreground p-6">
              <div>
                <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Selecione um Livro do Dia para ver os detalhes</p>
              </div>
            </div>
          ) : (
            <Tabs value={rightTab} onValueChange={(v) => setRightTab(v as typeof rightTab)} className="flex flex-col flex-1 min-h-0">
              <div className="px-4 pt-3 border-b shrink-0">
                <div className="mb-2">
                  <h3 className="text-sm font-semibold">Livro do Dia — v{selectedBook.version}</h3>
                  <p className="text-xs text-muted-foreground">Evento: <span className="font-mono">{selectedBook.agendaEventId.slice(0, 8)}</span></p>
                </div>
                <TabsList className="h-8">
                  <TabsTrigger value="impacto" className="text-xs">Impacto</TabsTrigger>
                  <TabsTrigger value="alteracoes" className="text-xs">Alterações</TabsTrigger>
                  <TabsTrigger value="historico" className="text-xs">Histórico</TabsTrigger>
                  <TabsTrigger value="delta" className="text-xs">Delta</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="impacto" className="flex-1 overflow-y-auto p-6 mt-0 data-[state=inactive]:hidden">
                <div className="space-y-6 max-w-2xl">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Status</span>
                      <div className="mt-1"><Badge variant={STATUS_VARIANTS[selectedBook.status] ?? "secondary"}>{STATUS_LABELS[selectedBook.status] ?? selectedBook.status}</Badge></div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Versão</span>
                      <div className="mt-1 font-semibold">{selectedBook.version}</div>
                    </div>
                    {selectedBook.generatedAt && <div><span className="text-muted-foreground">Gerado em</span><div className="mt-1">{new Date(selectedBook.generatedAt).toLocaleString("pt-BR")}</div></div>}
                    {selectedBook.publishedAt && <div><span className="text-muted-foreground">Publicado em</span><div className="mt-1">{new Date(selectedBook.publishedAt).toLocaleString("pt-BR")}</div></div>}
                    {selectedBook.executedAt && <div><span className="text-muted-foreground">Executado em</span><div className="mt-1">{new Date(selectedBook.executedAt).toLocaleString("pt-BR")}</div></div>}
                    {selectedBook.cancelledAt && <div><span className="text-muted-foreground">Cancelado em</span><div className="mt-1">{new Date(selectedBook.cancelledAt).toLocaleString("pt-BR")}</div></div>}
                  </div>
                  <Separator />
                  <div>
                    <h4 className="font-medium mb-3 flex items-center gap-2"><Users className="h-4 w-4" /> Cobertura por Cena</h4>
                    {(selectedBook.scenes ?? []).filter((s) => !s.isRemoved).map((scene: DailyBookSceneWithBlocks) => {
                      const allPositions = scene.blocks.flatMap((b) => b.positions.filter((p) => !p.isRemoved));
                      const covered = allPositions.filter((p) => p.assignments.some((a) => a.status === "ASSIGNED")).length;
                      const total = allPositions.length;
                      const pct = total > 0 ? Math.round((covered / total) * 100) : 100;
                      return (
                        <div key={scene.id} className="mb-3">
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="font-medium">{scene.name}</span>
                            <span className="text-muted-foreground">{covered}/{total} ({pct}%)</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${pct === 100 ? "bg-green-500" : pct >= 70 ? "bg-yellow-500" : "bg-red-500"}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="alteracoes" className="flex-1 overflow-y-auto p-6 mt-0 data-[state=inactive]:hidden">
                <h4 className="font-medium mb-3 flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Alterações locais desde última publicação</h4>
                {isDeltaLoading ? (
                  <p className="text-sm text-muted-foreground">Calculando alterações...</p>
                ) : !needsDelta ? (
                  <p className="text-sm text-muted-foreground">Delta disponível apenas para livros publicados.</p>
                ) : !hasLiveChanges ? (
                  <p className="text-sm text-muted-foreground">Sem alterações locais desde a última publicação.</p>
                ) : (
                  <DeltaView delta={liveDelta} />
                )}
              </TabsContent>

              <TabsContent value="historico" className="flex-1 overflow-y-auto p-6 mt-0 data-[state=inactive]:hidden">
                <h4 className="font-medium mb-3 flex items-center gap-2"><Users className="h-4 w-4" /> Histórico de alterações</h4>
                <div className="space-y-3">
                  {selectedBook.generatedAt && (
                    <div className="flex items-start gap-3 text-sm">
                      <div className="mt-0.5 h-2 w-2 rounded-full bg-blue-500 shrink-0" />
                      <div>
                        <p className="font-medium">Gerado</p>
                        <p className="text-xs text-muted-foreground">{new Date(selectedBook.generatedAt).toLocaleString("pt-BR")}</p>
                      </div>
                    </div>
                  )}
                  {selectedBook.publishedAt && (
                    <div className="flex items-start gap-3 text-sm">
                      <div className="mt-0.5 h-2 w-2 rounded-full bg-green-500 shrink-0" />
                      <div>
                        <p className="font-medium">Publicado — v{selectedBook.version > 1 ? 1 : selectedBook.version}</p>
                        <p className="text-xs text-muted-foreground">{new Date(selectedBook.publishedAt).toLocaleString("pt-BR")}</p>
                      </div>
                    </div>
                  )}
                  {selectedBook.version > 1 && (
                    <div className="flex items-start gap-3 text-sm">
                      <div className="mt-0.5 h-2 w-2 rounded-full bg-amber-500 shrink-0" />
                      <div>
                        <p className="font-medium">Republicado — v{selectedBook.version}</p>
                        <p className="text-xs text-muted-foreground">Versão atual</p>
                      </div>
                    </div>
                  )}
                  {selectedBook.executedAt && (
                    <div className="flex items-start gap-3 text-sm">
                      <div className="mt-0.5 h-2 w-2 rounded-full bg-purple-500 shrink-0" />
                      <div>
                        <p className="font-medium">Executado</p>
                        <p className="text-xs text-muted-foreground">{new Date(selectedBook.executedAt).toLocaleString("pt-BR")}</p>
                      </div>
                    </div>
                  )}
                  {selectedBook.cancelledAt && (
                    <div className="flex items-start gap-3 text-sm">
                      <div className="mt-0.5 h-2 w-2 rounded-full bg-red-500 shrink-0" />
                      <div>
                        <p className="font-medium">Cancelado</p>
                        <p className="text-xs text-muted-foreground">{new Date(selectedBook.cancelledAt).toLocaleString("pt-BR")}</p>
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="delta" className="flex-1 overflow-y-auto p-6 mt-0 data-[state=inactive]:hidden">
                <h4 className="font-medium mb-3 flex items-center gap-2"><RotateCcw className="h-4 w-4" /> Delta da última republicação</h4>
                {lastDelta && !lastDelta.isEmpty ? (
                  <DeltaView delta={lastDelta} />
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhum delta de republicação registrado.</p>
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>

      {/* Dialog — Publicar */}
      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Publicação</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            O Livro do Dia será publicado e ficará visível para os membros escalados. Deseja continuar?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPublishOpen(false)}>Cancelar</Button>
            <Button onClick={handlePublish} disabled={publishMutation.isPending}>
              <Send className="h-3.5 w-3.5 mr-1" />
              {publishMutation.isPending ? "Publicando..." : "Confirmar Publicação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog — Republicar (mostra delta ao vivo antes de confirmar) */}
      <Dialog open={republishOpen} onOpenChange={setRepublishOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirmar Republicação</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            {isDeltaLoading ? (
              <p className="text-sm text-muted-foreground">Calculando alterações desde a última publicação...</p>
            ) : !hasLiveChanges ? (
              <p className="text-sm text-muted-foreground">
                Não há alterações locais desde a última publicação. Não é possível republicar sem alterações.
              </p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">As seguintes alterações serão publicadas na nova versão:</p>
                <div className="max-h-60 overflow-y-auto border rounded p-3 bg-muted/30">
                  <DeltaView delta={liveDelta} />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRepublishOpen(false)}>Cancelar</Button>
            <Button
              variant="outline"
              onClick={handleRepublish}
              disabled={!hasLiveChanges || isDeltaLoading || republishMutation.isPending}
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              {republishMutation.isPending ? "Republicando..." : "Confirmar Republicação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog — Cancelar */}
      <Dialog open={cancelOpen} onOpenChange={(o) => { setCancelOpen(o); if (!o) setCancelReason(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar Livro do Dia</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              O Livro do Dia será cancelado. Esta ação requer um motivo obrigatório.
            </p>
            <div>
              <Label>Motivo do cancelamento <span className="text-destructive">*</span></Label>
              <Textarea
                className="mt-1"
                placeholder="Ex: Show cancelado por força maior..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCancelOpen(false); setCancelReason(""); }}>Voltar</Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={!cancelReason.trim() || cancelMutation.isPending}
            >
              <XCircle className="h-3.5 w-3.5 mr-1" />
              {cancelMutation.isPending ? "Cancelando..." : "Confirmar Cancelamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog — Gerar Livro do Dia */}
      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerar Livro do Dia</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="mb-1.5 block">Evento</Label>
              <Select value={selectedEventId ?? ""} onValueChange={setSelectedEventId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o evento..." />
                </SelectTrigger>
                <SelectContent>
                  {events.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.title ?? e.id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setGenerateOpen(false); setSelectedEventId(null); }}>Cancelar</Button>
            <Button onClick={handleGenerate} disabled={!selectedEventId || generateMutation.isPending}>
              {generateMutation.isPending ? "Gerando..." : "Gerar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </AdminLayout>
  );
}
