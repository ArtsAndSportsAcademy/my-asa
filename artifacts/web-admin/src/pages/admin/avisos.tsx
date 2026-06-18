import { useState, useEffect } from "react";
import {
  useListNotices,
  useCreateNotice,
  useUpdateNotice,
  usePublishNotice,
  useCancelNotice,
  useEscalateNotice,
  useGetNotice,
  getGetNoticeQueryKey,
  useGetOperations,
} from "@workspace/api-client-react";
import type { NoticeListItem, NoticeDetail, CreateNoticeRequest, UpdateNoticeRequest } from "@workspace/api-client-react";
import AdminLayout from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bell,
  Plus,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Users,
  Send,
  AlertTriangle,
  Info,
  AlertCircle,
  Pencil,
  ArrowRightCircle,
} from "lucide-react";

// ─── Config ────────────────────────────────────────────────────────────────────

const URGENCY_CFG = {
  INFORMATIVE: { label: "Informativo", border: "border-l-blue-400",  bg: "bg-blue-50/60",  badge: "bg-blue-100 text-blue-800",   Icon: Info },
  IMPORTANT:   { label: "Importante",  border: "border-l-amber-400", bg: "bg-amber-50/60", badge: "bg-amber-100 text-amber-800", Icon: AlertCircle },
  CRITICAL:    { label: "Crítico",     border: "border-l-red-500",   bg: "bg-red-50/60",   badge: "bg-red-100 text-red-800",     Icon: AlertTriangle },
} as const;

const STATUS_CFG = {
  DRAFT:     { label: "Rascunho",  badge: "bg-gray-100 text-gray-700" },
  PUBLISHED: { label: "Publicado", badge: "bg-green-100 text-green-700" },
  EXPIRED:   { label: "Expirado",  badge: "bg-orange-100 text-orange-700" },
  CANCELLED: { label: "Cancelado", badge: "bg-red-100 text-red-700" },
} as const;

const TYPE_LABELS: Record<string, string> = {
  INFORMATIVE: "Informativo",
  IMPORTANT:   "Importante",
  PERSISTENT:  "Persistente",
  ESCALATED:   "Escalado",
};

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminAvisosPage() {
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editOpen, setEditOpen]     = useState(false);
  const [editId, setEditId]         = useState<string | null>(null);
  const [editFormReady, setEditFormReady] = useState(false);
  const [editForm, setEditForm]     = useState<Partial<UpdateNoticeRequest>>({});
  const [form, setForm] = useState<Partial<CreateNoticeRequest>>({
    operationId: "", title: "", content: "",
    urgency: "INFORMATIVE", type: "INFORMATIVE",
    requiresConfirmation: false, recipientUserIds: [],
  });

  const { data: notices = [], isLoading, refetch, isFetching } = useListNotices(
    statusFilter ? { status: statusFilter } : undefined
  );
  const { data: ops = [] } = useGetOperations({});
  const { data: detail, refetch: refetchDetail } = useGetNotice(selectedId ?? "", {
    query: { enabled: !!selectedId, queryKey: getGetNoticeQueryKey(selectedId ?? "") },
  });
  const { data: editDetail } = useGetNotice(editId ?? "", {
    query: { enabled: !!editId && editOpen, queryKey: getGetNoticeQueryKey(editId ?? "") },
  });

  useEffect(() => {
    if (!editOpen || editFormReady) return;
    const src = editDetail as (NoticeDetail & { changeBefore?: string; changeAfter?: string }) | undefined;
    if (!src) return;
    setEditForm({
      title: src.title ?? "",
      content: src.content,
      urgency: src.urgency as any,
      type: src.type as any,
      requiresConfirmation: src.requiresConfirmation,
      changeBefore: src.changeBefore ?? "",
      changeAfter:  src.changeAfter  ?? "",
    });
    setEditFormReady(true);
  }, [editDetail, editOpen, editFormReady]);

  const createMutation   = useCreateNotice();
  const updateMutation   = useUpdateNotice();
  const publishMutation  = usePublishNotice();
  const cancelMutation   = useCancelNotice();
  const escalateMutation = useEscalateNotice();

  const openEdit = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditId(id);
    setEditForm({});
    setEditFormReady(false);
    setEditOpen(true);
  };

  const closeEdit = () => { setEditOpen(false); setEditId(null); setEditForm({}); setEditFormReady(false); };

  const handleCreate = () => {
    if (!form.operationId || !form.content) return;
    createMutation.mutate({ data: form as CreateNoticeRequest }, {
      onSuccess: () => {
        setCreateOpen(false);
        setForm({ operationId: "", title: "", content: "", urgency: "INFORMATIVE", type: "INFORMATIVE", requiresConfirmation: false });
        refetch();
      },
    });
  };

  const handleSaveEdit = () => {
    if (!editId || !editForm.content) return;
    updateMutation.mutate({ noticeId: editId, data: editForm as UpdateNoticeRequest }, {
      onSuccess: () => {
        closeEdit();
        refetch();
        if (selectedId) refetchDetail();
      },
    });
  };

  const handlePublish = (id: string) => {
    publishMutation.mutate({ noticeId: id }, { onSuccess: () => { refetch(); if (selectedId === id) refetchDetail(); } });
  };

  const handleCancel = (id: string) => {
    cancelMutation.mutate({ noticeId: id }, { onSuccess: () => { refetch(); if (selectedId === id) refetchDetail(); } });
  };

  const handleEscalate = (id: string) => {
    if (!window.confirm("Escalar este aviso? Todos os destinatários não-confirmados serão marcados como escalados.")) return;
    escalateMutation.mutate({ noticeId: id }, { onSuccess: () => { refetch(); if (selectedId === id) refetchDetail(); } });
  };

  const FILTER_TABS = [
    { value: undefined,   label: "Todos" },
    { value: "DRAFT",     label: "Rascunho" },
    { value: "PUBLISHED", label: "Publicados" },
    { value: "CANCELLED", label: "Cancelados" },
  ];

  return (
    <AdminLayout title="Avisos" subtitle="O que mudou e quem precisa saber">

      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <div className="flex gap-1 p-1 bg-muted rounded-lg">
          {FILTER_TABS.map((t) => (
            <button
              key={String(t.value)}
              onClick={() => setStatusFilter(t.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                statusFilter === t.value
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Novo Aviso
        </Button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <RefreshCw className="h-7 w-7 animate-spin text-muted-foreground" />
        </div>
      ) : (notices as NoticeListItem[]).length === 0 ? (
        <div className="text-center py-16">
          <Bell className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum aviso publicado ainda. Os avisos da sua operação aparecerão aqui.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(notices as NoticeListItem[]).map((n) => {
            const urg  = URGENCY_CFG[n.urgency as keyof typeof URGENCY_CFG] ?? URGENCY_CFG.INFORMATIVE;
            const stat = STATUS_CFG[n.status  as keyof typeof STATUS_CFG]   ?? STATUS_CFG.DRAFT;
            const UrgIcon = urg.Icon;
            return (
              <div
                key={n.id}
                className={`border border-border rounded-xl border-l-4 ${urg.border} ${urg.bg} p-4 cursor-pointer hover:shadow-sm transition-shadow`}
                onClick={() => setSelectedId(n.id)}
              >
                <div className="flex items-start gap-3">
                  <UrgIcon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {n.title && <span className="text-sm font-semibold truncate">{n.title}</span>}
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${urg.badge}`}>{urg.label}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${stat.badge}`}>{stat.label}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                        {TYPE_LABELS[n.type] ?? n.type}
                      </span>
                      {n.requiresConfirmation && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 font-medium">Confirmação</span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{n.content}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" />{n.recipientCount} dest.</span>
                      {n.requiresConfirmation && (
                        <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />{n.confirmedCount}/{n.recipientCount} confirmaram</span>
                      )}
                      {n.publishedAt && (
                        <span className="flex items-center gap-1">
                          <Send className="h-3 w-3" />
                          {new Date(n.publishedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                      {!n.publishedAt && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(n.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {n.status === "DRAFT" && (
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={(e) => openEdit(n.id, e)}>
                        <Pencil className="h-3 w-3 mr-1" /> Editar
                      </Button>
                    )}
                    {n.status === "DRAFT" && (
                      <Button size="sm" variant="default" className="h-7 text-xs" disabled={publishMutation.isPending} onClick={() => handlePublish(n.id)}>
                        <Send className="h-3 w-3 mr-1" /> Publicar
                      </Button>
                    )}
                    {n.status === "PUBLISHED" && n.requiresConfirmation && (
                      <Button size="sm" variant="outline" className="h-7 text-xs text-orange-600 border-orange-200 hover:bg-orange-50" disabled={escalateMutation.isPending} onClick={() => handleEscalate(n.id)}>
                        <ArrowRightCircle className="h-3 w-3 mr-1" /> Escalar
                      </Button>
                    )}
                    {(n.status === "DRAFT" || n.status === "PUBLISHED") && (
                      <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50" disabled={cancelMutation.isPending} onClick={() => handleCancel(n.id)}>
                        <XCircle className="h-3 w-3 mr-1" /> Cancelar
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Create Dialog ── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Novo Aviso</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Operação *</Label>
              <Select value={form.operationId ?? ""} onValueChange={(v) => setForm((f) => ({ ...f, operationId: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar operação..." /></SelectTrigger>
                <SelectContent>
                  {(ops as any[]).map((op) => (
                    <SelectItem key={op.id} value={op.id}>{op.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Título (opcional)</Label>
              <Input placeholder="Ex: Mudança no espetáculo de sábado" value={form.title ?? ""} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Conteúdo *</Label>
              <Textarea placeholder="Descreva o aviso..." rows={4} value={form.content ?? ""} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Urgência</Label>
                <Select value={form.urgency ?? "INFORMATIVE"} onValueChange={(v) => setForm((f) => ({ ...f, urgency: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INFORMATIVE">Informativo</SelectItem>
                    <SelectItem value="IMPORTANT">Importante</SelectItem>
                    <SelectItem value="CRITICAL">Crítico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={form.type ?? "INFORMATIVE"} onValueChange={(v) => setForm((f) => ({ ...f, type: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INFORMATIVE">Informativo</SelectItem>
                    <SelectItem value="IMPORTANT">Importante</SelectItem>
                    <SelectItem value="PERSISTENT">Persistente</SelectItem>
                    <SelectItem value="ESCALATED">Escalado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="req-confirm" checked={form.requiresConfirmation ?? false} onChange={(e) => setForm((f) => ({ ...f, requiresConfirmation: e.target.checked }))} className="rounded" />
              <Label htmlFor="req-confirm" className="font-normal cursor-pointer">Exigir confirmação de leitura</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!form.operationId || !form.content || createMutation.isPending}>
              {createMutation.isPending ? "Criando..." : "Criar Rascunho"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ── */}
      <Dialog open={editOpen} onOpenChange={(o) => { if (!o) closeEdit(); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar Rascunho</DialogTitle></DialogHeader>
          {!editFormReady ? (
            <div className="py-8 flex justify-center">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Título</Label>
                <Input value={editForm.title ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Conteúdo *</Label>
                <Textarea rows={4} value={editForm.content ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, content: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Urgência</Label>
                  <Select value={editForm.urgency ?? "INFORMATIVE"} onValueChange={(v) => setEditForm((f) => ({ ...f, urgency: v as any }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INFORMATIVE">Informativo</SelectItem>
                      <SelectItem value="IMPORTANT">Importante</SelectItem>
                      <SelectItem value="CRITICAL">Crítico</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Tipo</Label>
                  <Select value={editForm.type ?? "INFORMATIVE"} onValueChange={(v) => setEditForm((f) => ({ ...f, type: v as any }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INFORMATIVE">Informativo</SelectItem>
                      <SelectItem value="IMPORTANT">Importante</SelectItem>
                      <SelectItem value="PERSISTENT">Persistente</SelectItem>
                      <SelectItem value="ESCALATED">Escalado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="edit-req-confirm" checked={editForm.requiresConfirmation ?? false} onChange={(e) => setEditForm((f) => ({ ...f, requiresConfirmation: e.target.checked }))} className="rounded" />
                <Label htmlFor="edit-req-confirm" className="font-normal cursor-pointer">Exigir confirmação de leitura</Label>
              </div>
              {/* ERA → AGORA delta */}
              <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50/50 p-3 space-y-3">
                <p className="text-xs font-semibold text-amber-700 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  ERA → AGORA <span className="font-normal text-amber-600">(opcional — para avisos de mudança)</span>
                </p>
                <div className="space-y-1.5">
                  <Label className="text-xs text-red-600">ERA (situação anterior)</Label>
                  <Textarea placeholder="Ex: Espetáculo às 20h no Teatro A" rows={2} value={editForm.changeBefore ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, changeBefore: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-green-700">AGORA (nova situação)</Label>
                  <Textarea placeholder="Ex: Espetáculo às 19h no Teatro B" rows={2} value={editForm.changeAfter ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, changeAfter: e.target.value }))} />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeEdit}>Cancelar</Button>
            <Button onClick={handleSaveEdit} disabled={!editForm.content || updateMutation.isPending}>
              {updateMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Detail Dialog ── */}
      <Dialog open={!!selectedId} onOpenChange={(o) => !o && setSelectedId(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {detail && (() => {
            const d = detail as NoticeDetail & { changeBefore?: string; changeAfter?: string };
            const urg  = URGENCY_CFG[d.urgency as keyof typeof URGENCY_CFG] ?? URGENCY_CFG.INFORMATIVE;
            const stat = STATUS_CFG[d.status  as keyof typeof STATUS_CFG]   ?? STATUS_CFG.DRAFT;
            return (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-2 flex-wrap">
                    <DialogTitle>{d.title ?? "Aviso"}</DialogTitle>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${urg.badge}`}>{urg.label}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${stat.badge}`}>{stat.label}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">{TYPE_LABELS[d.type] ?? d.type}</span>
                  </div>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <p className="text-sm">{d.content}</p>

                  {/* ERA → AGORA */}
                  {(d.changeBefore || d.changeAfter) && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        <span className="text-xs font-bold text-amber-700 uppercase tracking-wide">O que mudou</span>
                      </div>
                      {d.changeBefore && (
                        <div className="rounded bg-red-50 border border-red-100 px-3 py-2">
                          <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider">ERA</span>
                          <p className="text-sm text-red-800 mt-0.5">{d.changeBefore}</p>
                        </div>
                      )}
                      {d.changeAfter && (
                        <div className="rounded bg-green-50 border border-green-100 px-3 py-2">
                          <span className="text-[10px] font-bold text-green-600 uppercase tracking-wider">AGORA</span>
                          <p className="text-sm text-green-800 mt-0.5">{d.changeAfter}</p>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                    {d.authorName && <span>Autor: <strong className="text-foreground">{d.authorName}</strong></span>}
                    {d.publishedAt && <span>Publicado: <strong className="text-foreground">{new Date(d.publishedAt).toLocaleString("pt-BR")}</strong></span>}
                    {d.expiresAt   && <span>Expira em: <strong className="text-foreground">{new Date(d.expiresAt).toLocaleDateString("pt-BR")}</strong></span>}
                    {d.cancelledAt && <span>Cancelado: <strong className="text-foreground">{new Date(d.cancelledAt).toLocaleString("pt-BR")}</strong></span>}
                  </div>

                  {d.recipients && d.recipients.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                          <Users className="h-3.5 w-3.5" />
                          Destinatários ({d.recipients.length})
                          {d.requiresConfirmation && (
                            <span className="ml-auto text-xs">
                              {d.recipients.filter((r) => r.status === "CONFIRMED").length} confirmaram
                            </span>
                          )}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="divide-y max-h-56 overflow-y-auto">
                          {d.recipients.map((r) => (
                            <div key={r.id} className="px-4 py-2 flex items-center gap-3">
                              <p className="flex-1 text-sm font-medium truncate">{r.userName ?? r.userId}</p>
                              <RecipientStatusBadge status={r.status} />
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
                <DialogFooter>
                  {d.status === "DRAFT" && (
                    <Button size="sm" variant="outline" onClick={() => { setSelectedId(null); openEdit(d.id); }}>
                      <Pencil className="h-3.5 w-3.5 mr-1.5" /> Editar
                    </Button>
                  )}
                  {d.status === "DRAFT" && (
                    <Button size="sm" disabled={publishMutation.isPending} onClick={() => handlePublish(d.id)}>
                      <Send className="h-3.5 w-3.5 mr-1.5" /> Publicar
                    </Button>
                  )}
                  {d.status === "PUBLISHED" && d.requiresConfirmation && (
                    <Button size="sm" variant="outline" className="text-orange-600 border-orange-200 hover:bg-orange-50" disabled={escalateMutation.isPending} onClick={() => handleEscalate(d.id)}>
                      <ArrowRightCircle className="h-3.5 w-3.5 mr-1.5" /> Escalar
                    </Button>
                  )}
                  {(d.status === "DRAFT" || d.status === "PUBLISHED") && (
                    <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" disabled={cancelMutation.isPending} onClick={() => handleCancel(d.id)}>
                      <XCircle className="h-3.5 w-3.5 mr-1.5" /> Cancelar
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => setSelectedId(null)}>Fechar</Button>
                </DialogFooter>
              </>
            );
          })()}
          {!detail && selectedId && (
            <div className="py-8 flex justify-center">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
        </DialogContent>
      </Dialog>

    </AdminLayout>
  );
}

// ─── Recipient Status Badge ─────────────────────────────────────────────────────

function RecipientStatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { label: string; cls: string; Icon: React.ComponentType<any> }> = {
    PENDING:   { label: "Pendente",    cls: "bg-gray-100 text-gray-600",     Icon: Clock },
    SENT:      { label: "Enviado",     cls: "bg-blue-100 text-blue-700",     Icon: Send },
    VIEWED:    { label: "Visualizado", cls: "bg-indigo-100 text-indigo-700", Icon: Bell },
    CONFIRMED: { label: "Confirmado",  cls: "bg-green-100 text-green-700",   Icon: CheckCircle2 },
    ESCALATED: { label: "Escalado",    cls: "bg-red-100 text-red-700",       Icon: AlertTriangle },
  };
  const c = cfg[status] ?? cfg.PENDING;
  const Icon = c.Icon;
  return (
    <span className={`flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-medium ${c.cls}`}>
      <Icon className="h-3 w-3" />
      {c.label}
    </span>
  );
}
