import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListShowBooks,
  useGetShowBook,
  useListShowBookVersions,
  useCreateShowBook,
  useUpdateShowBook,
  useUpdateShowBookStatus,
  useCreateShowBookScene,
  useDeleteShowBookScene,
  useCreateShowBookBlock,
  useDeleteShowBookBlock,
  useCreateShowBookPosition,
  useDeleteShowBookPosition,
  useListShowBookPositionRefs,
  useAddShowBookPositionRef,
  useDeleteShowBookPositionRef,
  useListLibraryDocuments,
  getListShowBooksQueryKey,
  getGetShowBookQueryKey,
  getListShowBookVersionsQueryKey,
  getListShowBookPositionRefsQueryKey,
  getListLibraryDocumentsQueryKey,
} from "@workspace/api-client-react";
import type {
  ShowBook,
  ShowBookVersion,
  ShowBookPositionRefWithDoc,
  LibraryDocumentItem,
} from "@workspace/api-client-react";
import AdminLayout from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import {
  Plus, ChevronRight, ChevronDown, History, BookOpen, Layers, Layout,
  AlignLeft, Settings, Trash2, Library,
} from "lucide-react";

const STATUS_LABELS: Record<string, string> = { DRAFT: "Rascunho", PUBLISHED: "Publicado", ARCHIVED: "Arquivado" };
const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  DRAFT: "secondary", PUBLISHED: "default", ARCHIVED: "outline",
};
const CHANGE_TYPE_LABELS: Record<string, string> = { STRUCTURAL: "Estrutural", CONFIG: "Configuração" };

const DOC_TYPE_LABELS: Record<string, string> = {
  OPERATIONAL_PROCEDURE: "Procedimento",
  RULES_AND_POLICIES: "Normas",
  CHARACTER_REFERENCE: "Personagem",
  COSTUME_REFERENCE: "Figurino",
  ONBOARDING_MATERIAL: "Onboarding",
  SAFETY_PROCEDURE: "Segurança",
};
const DOC_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Rascunho", PUBLISHED: "Publicado", UPDATED: "Atualizado", ARCHIVED: "Arquivado",
};
const DOC_STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  DRAFT: "secondary", PUBLISHED: "default", UPDATED: "default", ARCHIVED: "outline",
};

function TreeNode({
  label, icon: Icon, depth = 0, onDelete, deleteLabel, onRefs, children, badge,
}: {
  label: string; icon: React.ElementType; depth?: number; onDelete?: () => void;
  deleteLabel?: string; onRefs?: () => void; children?: React.ReactNode; badge?: string;
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
        {hasChildren ? (
          open ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />
        ) : <span className="w-3" />}
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-sm flex-1 truncate">{label}</span>
        {badge && <span className="text-xs text-muted-foreground">cob.{badge}</span>}
        {onRefs && (
          <button
            onClick={(e) => { e.stopPropagation(); onRefs(); }}
            className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-primary rounded"
            title="Referências oficiais"
          >
            <Library className="h-3 w-3" />
          </button>
        )}
        {onDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-destructive rounded"
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

export default function ShowBookPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const auth = useAuth();
  const isAdmin = auth.roles.some((r) => r.role === "ADMIN" || r.role === "SUPERVISOR_A");

  const operationId = auth.roles.find((r) => r.operationId)?.operationId;

  const { data: listData, isLoading } = useListShowBooks({ operationId });
  const books: ShowBook[] = listData?.showBooks ?? [];

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [addSceneOpen, setAddSceneOpen] = useState(false);
  const [addBlockOpen, setAddBlockOpen] = useState(false);
  const [addPositionOpen, setAddPositionOpen] = useState(false);
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [selectedPositionId, setSelectedPositionId] = useState<string | null>(null);
  const [selectedPositionName, setSelectedPositionName] = useState<string>("");
  const [refsSheetOpen, setRefsSheetOpen] = useState(false);
  const [refSearchQuery, setRefSearchQuery] = useState("");

  const { data: bookData } = useGetShowBook(selectedId ?? "", {
    query: { enabled: !!selectedId, queryKey: getGetShowBookQueryKey(selectedId ?? "") },
  });
  const selectedBook = bookData?.showBook;

  const { data: versionsData } = useListShowBookVersions(selectedId ?? "", {
    query: { enabled: !!selectedId && versionsOpen, queryKey: getListShowBookVersionsQueryKey(selectedId ?? "") },
  });
  const versions: ShowBookVersion[] = versionsData?.versions ?? [];

  const { data: refsData, isLoading: refsLoading } = useListShowBookPositionRefs(
    selectedId ?? "",
    selectedPositionId ?? "",
    {
      query: {
        enabled: !!selectedId && !!selectedPositionId && refsSheetOpen,
        queryKey: getListShowBookPositionRefsQueryKey(selectedId ?? "", selectedPositionId ?? ""),
      },
    }
  );
  const refs: ShowBookPositionRefWithDoc[] = refsData?.refs ?? [];
  const linkedDocIds = new Set(refs.map((r) => r.documentId));

  const libDocsParams = { q: refSearchQuery || undefined };
  const { data: libDocsData } = useListLibraryDocuments(
    libDocsParams,
    { query: { enabled: refsSheetOpen && isAdmin, queryKey: getListLibraryDocumentsQueryKey(libDocsParams) } }
  );
  const libDocs: LibraryDocumentItem[] = libDocsData?.documents ?? [];
  const availableDocs = libDocs.filter(
    (d) => !linkedDocIds.has(d.id) && (d.status === "PUBLISHED" || d.status === "UPDATED")
  );

  const createMutation = useCreateShowBook();
  const statusMutation = useUpdateShowBookStatus();
  const createSceneMutation = useCreateShowBookScene();
  const deleteSceneMutation = useDeleteShowBookScene();
  const createBlockMutation = useCreateShowBookBlock();
  const deleteBlockMutation = useDeleteShowBookBlock();
  const createPositionMutation = useCreateShowBookPosition();
  const deletePositionMutation = useDeleteShowBookPosition();
  const addRefMutation = useAddShowBookPositionRef();
  const deleteRefMutation = useDeleteShowBookPositionRef();

  void useUpdateShowBook;

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getListShowBooksQueryKey({ operationId }) });
    if (selectedId) queryClient.invalidateQueries({ queryKey: getGetShowBookQueryKey(selectedId) });
  };

  const invalidateRefs = () => {
    if (selectedId && selectedPositionId) {
      queryClient.invalidateQueries({
        queryKey: getListShowBookPositionRefsQueryKey(selectedId, selectedPositionId),
      });
    }
  };

  const [createForm, setCreateForm] = useState({ title: "", description: "" });
  const [statusForm, setStatusForm] = useState({ status: "PUBLISHED", reason: "" });
  const [sceneForm, setSceneForm] = useState({ name: "", order: "1", reason: "" });
  const [blockForm, setBlockForm] = useState({ name: "", order: "1", reason: "" });
  const [positionForm, setPositionForm] = useState({ name: "", minimumCoverage: "1", reason: "" });

  const handleCreate = () => {
    if (!operationId) { toast({ title: "Nenhuma operação ativa", variant: "destructive" }); return; }
    if (!createForm.title.trim()) { toast({ title: "Título obrigatório", variant: "destructive" }); return; }
    createMutation.mutate(
      { data: { operationId, title: createForm.title.trim(), description: createForm.description || undefined, type: "STRUCTURED" } },
      {
        onSuccess: (data) => {
          toast({ title: "Livro criado com sucesso" });
          setCreateOpen(false);
          setCreateForm({ title: "", description: "" });
          invalidateAll();
          setSelectedId(data.showBook.id);
        },
        onError: () => toast({ title: "Erro ao criar livro", variant: "destructive" }),
      }
    );
  };

  const handleStatus = () => {
    if (!selectedId || !statusForm.reason) { toast({ title: "Motivo obrigatório", variant: "destructive" }); return; }
    statusMutation.mutate(
      { id: selectedId, data: { status: statusForm.status as any, reason: statusForm.reason } },
      {
        onSuccess: () => { toast({ title: "Status atualizado" }); setStatusOpen(false); invalidateAll(); },
        onError: () => toast({ title: "Erro ao atualizar status", variant: "destructive" }),
      }
    );
  };

  const handleAddScene = () => {
    if (!selectedId || !sceneForm.name.trim() || !sceneForm.reason.trim()) {
      toast({ title: "Nome e motivo são obrigatórios", variant: "destructive" }); return;
    }
    createSceneMutation.mutate(
      { id: selectedId, data: { name: sceneForm.name.trim(), order: parseInt(sceneForm.order), reason: sceneForm.reason } },
      {
        onSuccess: () => { toast({ title: "Cena adicionada" }); setAddSceneOpen(false); setSceneForm({ name: "", order: "1", reason: "" }); invalidateAll(); },
        onError: () => toast({ title: "Erro ao adicionar cena", variant: "destructive" }),
      }
    );
  };

  const handleDeleteScene = (sceneId: string) => {
    if (!selectedId) return;
    const reason = window.prompt("Motivo da remoção:");
    if (!reason) return;
    deleteSceneMutation.mutate(
      { id: selectedId, sceneId, data: { reason } },
      {
        onSuccess: () => { toast({ title: "Cena removida" }); invalidateAll(); },
        onError: () => toast({ title: "Erro ao remover cena", variant: "destructive" }),
      }
    );
  };

  const handleAddBlock = () => {
    if (!selectedId || !blockForm.name.trim() || !blockForm.reason.trim()) {
      toast({ title: "Nome e motivo são obrigatórios", variant: "destructive" }); return;
    }
    createBlockMutation.mutate(
      { id: selectedId, data: { name: blockForm.name.trim(), order: parseInt(blockForm.order), sceneId: activeSceneId ?? undefined, reason: blockForm.reason } },
      {
        onSuccess: () => { toast({ title: "Bloco adicionado" }); setAddBlockOpen(false); setBlockForm({ name: "", order: "1", reason: "" }); invalidateAll(); },
        onError: () => toast({ title: "Erro ao adicionar bloco", variant: "destructive" }),
      }
    );
  };

  const handleDeleteBlock = (blockId: string) => {
    if (!selectedId) return;
    const reason = window.prompt("Motivo da remoção:");
    if (!reason) return;
    deleteBlockMutation.mutate(
      { id: selectedId, blockId, data: { reason } },
      {
        onSuccess: () => { toast({ title: "Bloco removido" }); invalidateAll(); },
        onError: () => toast({ title: "Erro ao remover bloco", variant: "destructive" }),
      }
    );
  };

  const handleAddPosition = () => {
    if (!selectedId || !positionForm.name.trim() || !positionForm.reason.trim()) {
      toast({ title: "Nome e motivo são obrigatórios", variant: "destructive" }); return;
    }
    createPositionMutation.mutate(
      { id: selectedId, data: { name: positionForm.name.trim(), order: 1, blockId: activeBlockId ?? undefined, minimumCoverage: parseInt(positionForm.minimumCoverage), reason: positionForm.reason } },
      {
        onSuccess: () => { toast({ title: "Posição adicionada" }); setAddPositionOpen(false); setPositionForm({ name: "", minimumCoverage: "1", reason: "" }); invalidateAll(); },
        onError: () => toast({ title: "Erro ao adicionar posição", variant: "destructive" }),
      }
    );
  };

  const handleDeletePosition = (positionId: string) => {
    if (!selectedId) return;
    const reason = window.prompt("Motivo da remoção:");
    if (!reason) return;
    deletePositionMutation.mutate(
      { id: selectedId, positionId, data: { reason } },
      {
        onSuccess: () => { toast({ title: "Posição removida" }); invalidateAll(); },
        onError: () => toast({ title: "Erro ao remover posição", variant: "destructive" }),
      }
    );
  };

  const handleOpenRefs = (posId: string, posName: string) => {
    setSelectedPositionId(posId);
    setSelectedPositionName(posName);
    setRefSearchQuery("");
    setRefsSheetOpen(true);
  };

  const handleAddRef = (documentId: string) => {
    if (!selectedId || !selectedPositionId) return;
    addRefMutation.mutate(
      { id: selectedId, positionId: selectedPositionId, data: { documentId } },
      {
        onSuccess: () => { toast({ title: "Referência adicionada" }); invalidateRefs(); },
        onError: () => toast({ title: "Erro ao adicionar referência", variant: "destructive" }),
      }
    );
  };

  const handleRemoveRef = (refId: string) => {
    if (!selectedId || !selectedPositionId) return;
    deleteRefMutation.mutate(
      { id: selectedId, positionId: selectedPositionId, refId },
      {
        onSuccess: () => { toast({ title: "Referência removida" }); invalidateRefs(); },
        onError: () => toast({ title: "Erro ao remover referência", variant: "destructive" }),
      }
    );
  };

  return (
    <AdminLayout title="Livro do Show" subtitle="Gerencie a hierarquia do espetáculo">
      <div className="flex items-center justify-between mb-4 p-3 rounded-lg bg-muted/30 border border-dashed text-sm">
        <span className="text-muted-foreground">Posições do Livro do Show poderão referenciar documentos da Biblioteca</span>
        <Button variant="outline" size="sm" onClick={() => setLocation("/admin/library")}>
          <Library className="w-4 h-4 mr-2" />
          Biblioteca
        </Button>
      </div>

      <div className="flex gap-4 h-full">
        {/* Lista de livros */}
        <div className="w-72 shrink-0 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Livros</span>
            {isAdmin && (
              <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Novo
              </Button>
            )}
          </div>
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          ) : books.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <BookOpen className="h-8 w-8 opacity-30" />
              <p className="text-sm">Nenhum livro criado</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {books.map((book) => (
                <button
                  key={book.id}
                  onClick={() => setSelectedId(book.id)}
                  className={`text-left p-3 rounded-lg border transition-colors ${selectedId === book.id ? "bg-primary/10 border-primary/30" : "bg-card hover:bg-muted/50 border-border"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium leading-tight">{book.title}</span>
                    <Badge variant={STATUS_VARIANTS[book.status]} className="text-[10px] shrink-0">
                      {STATUS_LABELS[book.status]}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground mt-1">v{book.version} · {book.type}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <Separator orientation="vertical" />

        {/* Painel do livro selecionado */}
        <div className="flex-1 min-w-0">
          {!selectedBook ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-3">
              <BookOpen className="h-12 w-12 opacity-20" />
              <p className="text-sm">Selecione um livro para visualizar a hierarquia</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">{selectedBook.title}</h2>
                  {selectedBook.description && <p className="text-sm text-muted-foreground">{selectedBook.description}</p>}
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={STATUS_VARIANTS[selectedBook.status]}>{STATUS_LABELS[selectedBook.status]}</Badge>
                    <span className="text-xs text-muted-foreground">Versão {selectedBook.version}</span>
                    <span className="text-xs text-muted-foreground">· {selectedBook.type}</span>
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => setVersionsOpen(true)}>
                      <History className="h-3.5 w-3.5 mr-1.5" /> Histórico
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setStatusOpen(true)}>
                      <Settings className="h-3.5 w-3.5 mr-1.5" /> Status
                    </Button>
                  </div>
                )}
              </div>

              <Separator />

              {isAdmin && (
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="outline" onClick={() => setAddSceneOpen(true)}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Cena
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setActiveSceneId(null); setAddBlockOpen(true); }}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Bloco
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setActiveBlockId(null); setAddPositionOpen(true); }}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Posição
                  </Button>
                </div>
              )}

              <div className="border rounded-lg p-2 bg-muted/10">
                {selectedBook.scenes && selectedBook.scenes.length > 0 ? (
                  selectedBook.scenes.map((scene: any) => (
                    <TreeNode
                      key={scene.id}
                      label={scene.name}
                      icon={Layers}
                      onDelete={isAdmin ? () => handleDeleteScene(scene.id) : undefined}
                      deleteLabel="Remover cena"
                    >
                      {isAdmin && (
                        <div className="flex gap-1 ml-8 my-1">
                          <Button size="sm" variant="ghost" className="h-6 text-xs"
                            onClick={() => { setActiveSceneId(scene.id); setAddBlockOpen(true); }}>
                            <Plus className="h-3 w-3 mr-0.5" /> Bloco
                          </Button>
                        </div>
                      )}
                      {scene.blocks?.map((block: any) => (
                        <TreeNode
                          key={block.id}
                          label={block.name}
                          icon={Layout}
                          depth={1}
                          onDelete={isAdmin ? () => handleDeleteBlock(block.id) : undefined}
                          deleteLabel="Remover bloco"
                        >
                          {isAdmin && (
                            <div className="flex gap-1 ml-12 my-1">
                              <Button size="sm" variant="ghost" className="h-6 text-xs"
                                onClick={() => { setActiveBlockId(block.id); setAddPositionOpen(true); }}>
                                <Plus className="h-3 w-3 mr-0.5" /> Posição
                              </Button>
                            </div>
                          )}
                          {block.positions?.map((pos: any) => (
                            <TreeNode
                              key={pos.id}
                              label={pos.name}
                              icon={AlignLeft}
                              depth={2}
                              badge={String(pos.minimumCoverage)}
                              onDelete={isAdmin ? () => handleDeletePosition(pos.id) : undefined}
                              deleteLabel="Remover posição"
                              onRefs={() => handleOpenRefs(pos.id, pos.name)}
                            >
                              {pos.lines?.map((line: any) => (
                                <TreeNode key={line.id} label={line.type} icon={AlignLeft} depth={3} />
                              ))}
                            </TreeNode>
                          ))}
                        </TreeNode>
                      ))}
                    </TreeNode>
                  ))
                ) : (
                  <div className="text-sm text-muted-foreground text-center py-6">
                    Nenhuma cena — use os botões acima para estruturar o livro
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sheet: histórico de versões */}
      <Sheet open={versionsOpen} onOpenChange={setVersionsOpen}>
        <SheetContent>
          <SheetHeader><SheetTitle>Histórico de Versões</SheetTitle></SheetHeader>
          <div className="mt-4 flex flex-col gap-3">
            {versions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma versão registrada.</p>
            ) : (
              versions.slice().reverse().map((v) => (
                <div key={v.id} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">v{v.version}</span>
                    <Badge variant={v.changeType === "STRUCTURAL" ? "default" : "secondary"} className="text-xs">
                      {CHANGE_TYPE_LABELS[v.changeType]}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{v.reason}</p>
                  <p className="text-xs text-muted-foreground">{new Date(v.createdAt).toLocaleString("pt-BR")}</p>
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Sheet: referências oficiais da posição */}
      <Sheet open={refsSheetOpen} onOpenChange={setRefsSheetOpen}>
        <SheetContent className="w-[480px] sm:max-w-[480px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Library className="h-4 w-4 text-primary" />
              Referências Oficiais
            </SheetTitle>
            {selectedPositionName && (
              <p className="text-sm text-muted-foreground">{selectedPositionName}</p>
            )}
          </SheetHeader>
          <div className="mt-4 flex flex-col gap-4">
            {/* Documentos vinculados */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Documentos vinculados
              </p>
              {refsLoading ? (
                <div className="flex justify-center py-4">
                  <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                </div>
              ) : refs.length === 0 ? (
                <p className="text-sm text-muted-foreground py-3 text-center border rounded-lg bg-muted/10">
                  Nenhum documento vinculado
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {refs.map((ref) => (
                    <div key={ref.id} className="flex items-start gap-2 p-2.5 rounded-lg border bg-muted/20">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge variant="outline" className="text-[10px]">
                            {DOC_TYPE_LABELS[ref.document.type] ?? ref.document.type}
                          </Badge>
                          <Badge
                            variant={DOC_STATUS_VARIANTS[ref.document.status] ?? "secondary"}
                            className="text-[10px]"
                          >
                            {DOC_STATUS_LABELS[ref.document.status] ?? ref.document.status}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">v{ref.document.version}</span>
                        </div>
                        <p className="text-sm font-medium mt-0.5 truncate">{ref.document.title}</p>
                        {ref.label && (
                          <p className="text-xs text-muted-foreground mt-0.5 italic">"{ref.label}"</p>
                        )}
                        {ref.document.summary && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {ref.document.summary}
                          </p>
                        )}
                      </div>
                      {isAdmin && (
                        <button
                          onClick={() => handleRemoveRef(ref.id)}
                          className="p-1 text-muted-foreground hover:text-destructive rounded shrink-0 mt-0.5"
                          title="Remover referência"
                          disabled={deleteRefMutation.isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Vincular novo documento (somente admin) */}
            {isAdmin && (
              <>
                <Separator />
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Vincular documento da Biblioteca
                  </p>
                  <Input
                    placeholder="Pesquisar documentos publicados..."
                    value={refSearchQuery}
                    onChange={(e) => setRefSearchQuery(e.target.value)}
                    className="mb-3"
                  />
                  <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto pr-0.5">
                    {availableDocs.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-3 border rounded-lg bg-muted/10">
                        {refSearchQuery ? "Nenhum resultado para a busca" : "Nenhum documento publicado disponível"}
                      </p>
                    ) : (
                      availableDocs.map((doc) => (
                        <button
                          key={doc.id}
                          className="flex items-center gap-2 p-2.5 rounded-lg border hover:bg-muted/30 text-left w-full group transition-colors"
                          onClick={() => handleAddRef(doc.id)}
                          disabled={addRefMutation.isPending}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <Badge variant="outline" className="text-[10px]">
                                {DOC_TYPE_LABELS[doc.type] ?? doc.type}
                              </Badge>
                            </div>
                            <p className="text-sm font-medium mt-0.5 truncate">{doc.title}</p>
                            {doc.summary && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{doc.summary}</p>
                            )}
                          </div>
                          <Plus className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:text-primary shrink-0" />
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Dialog: criar livro */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Livro do Show</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-3">
            <div>
              <Label>Título *</Label>
              <Input value={createForm.title} onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))} placeholder="Nome do espetáculo" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Input value={createForm.description} onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))} placeholder="Descrição opcional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>Criar Livro</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: status */}
      <Dialog open={statusOpen} onOpenChange={setStatusOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Alterar Status</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-3">
            <div>
              <Label>Novo Status *</Label>
              <Select value={statusForm.status} onValueChange={(v) => setStatusForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DRAFT">Rascunho</SelectItem>
                  <SelectItem value="PUBLISHED">Publicar</SelectItem>
                  <SelectItem value="ARCHIVED">Arquivar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Motivo *</Label>
              <Input value={statusForm.reason} onChange={(e) => setStatusForm((f) => ({ ...f, reason: e.target.value }))} placeholder="Justificativa da mudança" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusOpen(false)}>Cancelar</Button>
            <Button onClick={handleStatus} disabled={statusMutation.isPending}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: adicionar cena */}
      <Dialog open={addSceneOpen} onOpenChange={setAddSceneOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar Cena</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-3">
            <div><Label>Nome *</Label><Input value={sceneForm.name} onChange={(e) => setSceneForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ex: Ato I — Abertura" /></div>
            <div><Label>Ordem</Label><Input type="number" value={sceneForm.order} onChange={(e) => setSceneForm((f) => ({ ...f, order: e.target.value }))} /></div>
            <div><Label>Motivo *</Label><Input value={sceneForm.reason} onChange={(e) => setSceneForm((f) => ({ ...f, reason: e.target.value }))} placeholder="Justificativa da mudança estrutural" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddSceneOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddScene} disabled={createSceneMutation.isPending}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: adicionar bloco */}
      <Dialog open={addBlockOpen} onOpenChange={setAddBlockOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar Bloco{activeSceneId && " à Cena"}</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-3">
            <div><Label>Nome *</Label><Input value={blockForm.name} onChange={(e) => setBlockForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ex: Palco principal" /></div>
            <div><Label>Ordem</Label><Input type="number" value={blockForm.order} onChange={(e) => setBlockForm((f) => ({ ...f, order: e.target.value }))} /></div>
            <div><Label>Motivo *</Label><Input value={blockForm.reason} onChange={(e) => setBlockForm((f) => ({ ...f, reason: e.target.value }))} placeholder="Justificativa da mudança estrutural" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddBlockOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddBlock} disabled={createBlockMutation.isPending}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: adicionar posição */}
      <Dialog open={addPositionOpen} onOpenChange={setAddPositionOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar Posição</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-3">
            <div><Label>Nome *</Label><Input value={positionForm.name} onChange={(e) => setPositionForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ex: Diretor de Palco" /></div>
            <div><Label>Cobertura mínima</Label><Input type="number" min={1} value={positionForm.minimumCoverage} onChange={(e) => setPositionForm((f) => ({ ...f, minimumCoverage: e.target.value }))} /></div>
            <div><Label>Motivo *</Label><Input value={positionForm.reason} onChange={(e) => setPositionForm((f) => ({ ...f, reason: e.target.value }))} placeholder="Justificativa da mudança estrutural" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddPositionOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddPosition} disabled={createPositionMutation.isPending}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
