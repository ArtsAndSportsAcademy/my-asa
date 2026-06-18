import { useState } from "react";
import {
  useListLibraryDocuments,
  useListLibraryCategories,
  useGetLibraryDocument,
  useCreateLibraryDocument,
  useUpdateLibraryDocument,
  usePublishLibraryDocument,
  useNewLibraryDocumentVersion,
  useArchiveLibraryDocument,
  useCreateLibraryCategory,
  getListLibraryDocumentsQueryKey,
  getGetLibraryDocumentQueryKey,
} from "@workspace/api-client-react";
import type {
  LibraryDocumentItem,
  LibraryDocumentDetail,
  LibraryCategory,
  LibraryDocumentVersion,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Library,
  Plus,
  Search,
  RefreshCw,
  BookOpen,
  FileText,
  Tag,
  Archive,
  GitBranch,
  Eye,
  Edit2,
  CheckCircle2,
  Clock,
  FolderOpen,
} from "lucide-react";

// ─── Config ───────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  OPERATIONAL_PROCEDURE: "Procedimento Operacional",
  RULES_AND_POLICIES:    "Regras e Políticas",
  CHARACTER_REFERENCE:   "Referência de Personagens",
  COSTUME_REFERENCE:     "Referência de Figurinos",
  ONBOARDING_MATERIAL:   "Material de Onboarding",
  SAFETY_PROCEDURE:      "Procedimento de Segurança",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT:     "Rascunho",
  PUBLISHED: "Publicado",
  UPDATED:   "Atualizado",
  ARCHIVED:  "Arquivado",
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT:     "bg-gray-100 text-gray-700",
  PUBLISHED: "bg-green-100 text-green-700",
  UPDATED:   "bg-blue-100 text-blue-700",
  ARCHIVED:  "bg-orange-100 text-orange-700",
};

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function AdminLibraryPage() {
  const qc = useQueryClient();

  // ── Filtros ──
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // ── Seleção ──
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // ── Diálogos ──
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showVersion, setShowVersion] = useState(false);
  const [showCreateCat, setShowCreateCat] = useState(false);

  // ── Formulários ──
  const [form, setForm] = useState({ title: "", type: "", summary: "", body: "", categoryId: "", responsibleId: "" });
  const [editForm, setEditForm] = useState({ title: "", summary: "", body: "", categoryId: "", responsibleId: "" });
  const [versionForm, setVersionForm] = useState({ title: "", body: "", summary: "" });
  const [catForm, setCatForm] = useState({ name: "", description: "" });

  // ── Queries ──
  const { data: docsData, isLoading, refetch } = useListLibraryDocuments({
    q: search || undefined,
    type: filterType !== "all" ? filterType : undefined,
    status: filterStatus !== "all" ? filterStatus : undefined,
  });
  const { data: catsData } = useListLibraryCategories();
  const detailQueryKey = getGetLibraryDocumentQueryKey(selectedId ?? "");
  const { data: detailData } = useGetLibraryDocument(selectedId ?? "", { query: { queryKey: detailQueryKey, enabled: !!selectedId } });

  const documents = (docsData?.documents ?? []) as LibraryDocumentItem[];
  const categories = (catsData?.categories ?? []) as LibraryCategory[];
  const detail = detailData?.document as LibraryDocumentDetail | undefined;
  const versions = (detailData?.versions ?? []) as LibraryDocumentVersion[];

  // ── Mutations ──
  const createDoc    = useCreateLibraryDocument();
  const updateDoc    = useUpdateLibraryDocument();
  const publishDoc   = usePublishLibraryDocument();
  const versionDoc   = useNewLibraryDocumentVersion();
  const archiveDoc   = useArchiveLibraryDocument();
  const createCat    = useCreateLibraryCategory();

  function invalidate() {
    qc.invalidateQueries({ queryKey: getListLibraryDocumentsQueryKey() });
    if (selectedId) qc.invalidateQueries({ queryKey: getGetLibraryDocumentQueryKey(selectedId) });
  }

  // ── Handlers ──
  function handleCreate() {
    if (!form.title || !form.type) return;
    createDoc.mutate(
      { data: { title: form.title, type: form.type, summary: form.summary || undefined, body: form.body || undefined, categoryId: form.categoryId || undefined } },
      { onSuccess: () => { setShowCreate(false); setForm({ title: "", type: "", summary: "", body: "", categoryId: "", responsibleId: "" }); invalidate(); } }
    );
  }

  function openEdit() {
    if (!detail) return;
    setEditForm({ title: detail.title, summary: detail.summary ?? "", body: detail.body, categoryId: detail.categoryId ?? "", responsibleId: detail.responsibleId ?? "" });
    setShowEdit(true);
  }

  function handleEdit() {
    if (!selectedId) return;
    updateDoc.mutate(
      { documentId: selectedId, data: { title: editForm.title || undefined, summary: editForm.summary || undefined, body: editForm.body || undefined, categoryId: editForm.categoryId || undefined } },
      { onSuccess: () => { setShowEdit(false); invalidate(); } }
    );
  }

  function handlePublish() {
    if (!selectedId) return;
    publishDoc.mutate(
      { documentId: selectedId },
      { onSuccess: () => invalidate() }
    );
  }

  function handleVersion() {
    if (!selectedId || !versionForm.title || !versionForm.body) return;
    versionDoc.mutate(
      { documentId: selectedId, data: { title: versionForm.title, body: versionForm.body, summary: versionForm.summary || undefined } },
      { onSuccess: () => { setShowVersion(false); setVersionForm({ title: "", body: "", summary: "" }); invalidate(); } }
    );
  }

  function handleArchive() {
    if (!selectedId || !confirm("Arquivar este documento? Arquivado ≠ excluído — o documento pode ser consultado no histórico.")) return;
    archiveDoc.mutate(
      { documentId: selectedId },
      { onSuccess: () => invalidate() }
    );
  }

  function handleCreateCat() {
    if (!catForm.name) return;
    createCat.mutate(
      { data: { name: catForm.name, description: catForm.description || undefined } },
      { onSuccess: () => { setShowCreateCat(false); setCatForm({ name: "", description: "" }); qc.invalidateQueries({ queryKey: ["listLibraryCategories"] }); } }
    );
  }

  return (
    <AdminLayout title="Biblioteca" subtitle="Fonte oficial de conhecimento da organização">
      <div className="flex gap-6 h-[calc(100vh-14rem)]">

        {/* ── Coluna Esquerda — Lista ── */}
        <div className="w-96 shrink-0 flex flex-col gap-3">
          {/* Filtros */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex gap-2">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="h-8 text-xs flex-1">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                {Object.entries(TYPE_LABELS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-8 text-xs flex-1">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {Object.entries(STATUS_LABELS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Ações */}
          <div className="flex gap-2">
            <Button size="sm" className="flex-1 h-8 text-xs" onClick={() => setShowCreate(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Novo Documento
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-xs px-2" onClick={() => setShowCreateCat(true)}>
              <FolderOpen className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Lista */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              </div>
            ) : documents.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">
                <Library className="h-8 w-8 mx-auto mb-2 opacity-30" />
                Nenhum documento na biblioteca ainda. Adicione materiais para compartilhar com sua equipe.
              </div>
            ) : (
              documents.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => setSelectedId(doc.id)}
                  className={`w-full text-left rounded-lg border p-3 transition-all ${
                    selectedId === doc.id
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium text-sm leading-snug line-clamp-2">{doc.title}</span>
                    <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded font-medium ${STATUS_COLORS[doc.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {STATUS_LABELS[doc.status] ?? doc.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] text-muted-foreground">{TYPE_LABELS[doc.type] ?? doc.type}</span>
                    <span className="text-[10px] text-muted-foreground">·</span>
                    <span className="text-[10px] text-muted-foreground">v{doc.version}</span>
                    {doc.responsibleName && (
                      <>
                        <span className="text-[10px] text-muted-foreground">·</span>
                        <span className="text-[10px] text-muted-foreground truncate">{doc.responsibleName}</span>
                      </>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* ── Coluna Direita — Detalhe ── */}
        <div className="flex-1 flex flex-col gap-4 overflow-y-auto min-w-0">
          {!selectedId ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <BookOpen className="h-10 w-10 mx-auto mb-2 opacity-20" />
                <p className="text-sm">Selecione um documento para visualizar</p>
              </div>
            </div>
          ) : !detail ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          ) : (
            <>
              {/* Header do documento */}
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-serif font-bold leading-snug">{detail.title}</h2>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[detail.status] ?? ""}`}>
                      {STATUS_LABELS[detail.status] ?? detail.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1"><Tag className="h-3 w-3" />{TYPE_LABELS[detail.type] ?? detail.type}</span>
                    <span className="flex items-center gap-1"><GitBranch className="h-3 w-3" />v{detail.version}</span>
                    {detail.responsibleName && <span>{detail.responsibleName}</span>}
                    {detail.publishedAt && <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />Pub. {fmtDate(detail.publishedAt)}</span>}
                    {detail.archivedAt && <span className="flex items-center gap-1"><Archive className="h-3 w-3" />Arq. {fmtDate(detail.archivedAt)}</span>}
                  </div>
                </div>

                {/* Ações */}
                <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                  {detail.status !== "ARCHIVED" && (
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={openEdit}>
                      <Edit2 className="h-3.5 w-3.5 mr-1" /> Editar
                    </Button>
                  )}
                  {detail.status === "DRAFT" && (
                    <Button size="sm" className="h-8 text-xs" onClick={handlePublish} disabled={publishDoc.isPending}>
                      <Eye className="h-3.5 w-3.5 mr-1" /> Publicar
                    </Button>
                  )}
                  {(detail.status === "PUBLISHED" || detail.status === "UPDATED") && (
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => { setVersionForm({ title: detail.title, body: detail.body, summary: detail.summary ?? "" }); setShowVersion(true); }}>
                      <GitBranch className="h-3.5 w-3.5 mr-1" /> Nova Versão
                    </Button>
                  )}
                  {detail.status !== "ARCHIVED" && (
                    <Button size="sm" variant="ghost" className="h-8 text-xs text-orange-600 hover:text-orange-700" onClick={handleArchive} disabled={archiveDoc.isPending}>
                      <Archive className="h-3.5 w-3.5 mr-1" /> Arquivar
                    </Button>
                  )}
                </div>
              </div>

              {/* Sumário */}
              {detail.summary && (
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="py-3 px-4">
                    <p className="text-sm text-foreground/80 italic">{detail.summary}</p>
                  </CardContent>
                </Card>
              )}

              {/* Corpo */}
              <Card className="flex-1">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4" /> Conteúdo
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed font-mono bg-muted/30 rounded-lg p-4 max-h-80 overflow-y-auto">
                    {detail.body || <span className="text-muted-foreground italic">Sem conteúdo</span>}
                  </div>
                </CardContent>
              </Card>

              {/* Histórico de versões */}
              {versions.length > 0 && (
                <Card>
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Clock className="h-4 w-4" /> Histórico de Versões
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <div className="space-y-2">
                      {versions.map((v) => (
                        <div key={v.id} className="flex items-center gap-3 text-sm border rounded-lg px-3 py-2">
                          <span className="font-mono font-semibold text-primary text-xs w-8">v{v.version}</span>
                          <span className="font-medium flex-1 truncate">{v.title}</span>
                          {v.summary && <span className="text-xs text-muted-foreground truncate max-w-40">{v.summary}</span>}
                          <span className="text-xs text-muted-foreground shrink-0">{fmtDate(v.createdAt)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Diálogo: Criar Documento ── */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Documento da Biblioteca</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Título *</Label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Ex: Procedimento de Abertura de Portas" />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo *</Label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={form.categoryId} onValueChange={(v) => setForm((f) => ({ ...f, categoryId: v }))}>
                <SelectTrigger><SelectValue placeholder="Sem categoria" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Resumo</Label>
              <Input value={form.summary} onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))} placeholder="Breve descrição do documento" />
            </div>
            <div className="space-y-1.5">
              <Label>Conteúdo</Label>
              <Textarea rows={8} value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} placeholder="Conteúdo do documento..." className="font-mono text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={createDoc.isPending || !form.title || !form.type}>
              {createDoc.isPending ? "Salvando..." : "Salvar Rascunho"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Diálogo: Editar Documento ── */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Documento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Título</Label>
              <Input value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={editForm.categoryId} onValueChange={(v) => setEditForm((f) => ({ ...f, categoryId: v }))}>
                <SelectTrigger><SelectValue placeholder="Sem categoria" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Resumo</Label>
              <Input value={editForm.summary} onChange={(e) => setEditForm((f) => ({ ...f, summary: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Conteúdo</Label>
              <Textarea rows={10} value={editForm.body} onChange={(e) => setEditForm((f) => ({ ...f, body: e.target.value }))} className="font-mono text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEdit(false)}>Cancelar</Button>
            <Button onClick={handleEdit} disabled={updateDoc.isPending}>
              {updateDoc.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Diálogo: Nova Versão ── */}
      <Dialog open={showVersion} onOpenChange={setShowVersion}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Versão do Documento</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Uma nova versão cria um snapshot imutável da versão atual antes de publicar as mudanças.</p>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Título *</Label>
              <Input value={versionForm.title} onChange={(e) => setVersionForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Resumo da atualização</Label>
              <Input value={versionForm.summary} onChange={(e) => setVersionForm((f) => ({ ...f, summary: e.target.value }))} placeholder="O que mudou nesta versão?" />
            </div>
            <div className="space-y-1.5">
              <Label>Conteúdo *</Label>
              <Textarea rows={10} value={versionForm.body} onChange={(e) => setVersionForm((f) => ({ ...f, body: e.target.value }))} className="font-mono text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVersion(false)}>Cancelar</Button>
            <Button onClick={handleVersion} disabled={versionDoc.isPending || !versionForm.title || !versionForm.body}>
              {versionDoc.isPending ? "Publicando..." : "Publicar Nova Versão"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Diálogo: Criar Categoria ── */}
      <Dialog open={showCreateCat} onOpenChange={setShowCreateCat}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Categoria</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input value={catForm.name} onChange={(e) => setCatForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ex: Produção de Palco" />
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Input value={catForm.description} onChange={(e) => setCatForm((f) => ({ ...f, description: e.target.value }))} placeholder="Breve descrição" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateCat(false)}>Cancelar</Button>
            <Button onClick={handleCreateCat} disabled={createCat.isPending || !catForm.name}>
              {createCat.isPending ? "Criando..." : "Criar Categoria"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
