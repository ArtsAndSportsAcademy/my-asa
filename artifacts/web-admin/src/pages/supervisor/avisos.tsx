import { useState } from "react";
import {
  useListNotices,
  useCreateNotice,
  usePublishNotice,
  useCancelNotice,
  useGetNotice,
  getGetNoticeQueryKey,
  useGetOperations,
} from "@workspace/api-client-react";
import type { NoticeListItem, NoticeDetail, CreateNoticeRequest } from "@workspace/api-client-react";
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
} from "lucide-react";

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

export default function SupervisorAvisosPage() {
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [createOpen, setCreateOpen]   = useState(false);
  const [selectedId, setSelectedId]   = useState<string | null>(null);
  const [form, setForm] = useState<Partial<CreateNoticeRequest>>({
    operationId: "",
    title: "",
    content: "",
    urgency: "INFORMATIVE",
    type: "INFORMATIVE",
    requiresConfirmation: false,
  });

  const { data: notices = [], isLoading, refetch, isFetching } = useListNotices(
    statusFilter ? { status: statusFilter } : undefined
  );
  const { data: ops = [] } = useGetOperations({});
  const { data: detail, refetch: refetchDetail } = useGetNotice(selectedId ?? "", {
    query: { enabled: !!selectedId, queryKey: getGetNoticeQueryKey(selectedId ?? "") },
  });

  const createMutation  = useCreateNotice();
  const publishMutation = usePublishNotice();
  const cancelMutation  = useCancelNotice();

  const handleCreate = () => {
    if (!form.operationId || !form.content) return;
    createMutation.mutate(
      { data: form as CreateNoticeRequest },
      {
        onSuccess: () => {
          setCreateOpen(false);
          setForm({ operationId: "", title: "", content: "", urgency: "INFORMATIVE", type: "INFORMATIVE", requiresConfirmation: false });
          refetch();
        },
      }
    );
  };

  const handlePublish = (id: string) => {
    publishMutation.mutate({ noticeId: id }, { onSuccess: () => { refetch(); if (selectedId === id) refetchDetail(); } });
  };

  const handleCancel = (id: string) => {
    cancelMutation.mutate({ noticeId: id }, { onSuccess: () => { refetch(); if (selectedId === id) refetchDetail(); } });
  };

  const FILTER_TABS = [
    { value: undefined, label: "Todos" },
    { value: "DRAFT",     label: "Rascunho" },
    { value: "PUBLISHED", label: "Publicados" },
    { value: "CANCELLED", label: "Cancelados" },
  ];

  return (
    <AdminLayout title="Avisos" subtitle="Comunicação operacional — visão supervisor">

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

      {isLoading ? (
        <div className="flex justify-center py-16">
          <RefreshCw className="h-7 w-7 animate-spin text-muted-foreground" />
        </div>
      ) : (notices as NoticeListItem[]).length === 0 ? (
        <div className="text-center py-16">
          <Bell className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum aviso encontrado</p>
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
                      {n.requiresConfirmation && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 font-medium">Confirmação</span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{n.content}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" />{n.recipientCount}</span>
                      {n.requiresConfirmation && (
                        <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />{n.confirmedCount}/{n.recipientCount}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {n.status === "DRAFT" && (
                      <Button size="sm" className="h-7 text-xs" disabled={publishMutation.isPending} onClick={() => handlePublish(n.id)}>
                        <Send className="h-3 w-3 mr-1" /> Publicar
                      </Button>
                    )}
                    {(n.status === "DRAFT" || n.status === "PUBLISHED") && (
                      <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 border-red-200" disabled={cancelMutation.isPending} onClick={() => handleCancel(n.id)}>
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

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Novo Aviso</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Operação *</Label>
              <Select value={form.operationId ?? ""} onValueChange={(v) => setForm((f) => ({ ...f, operationId: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  {(ops as any[]).map((op) => (
                    <SelectItem key={op.id} value={op.id}>{op.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Título</Label>
              <Input value={form.title ?? ""} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Conteúdo *</Label>
              <Textarea rows={4} value={form.content ?? ""} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} />
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
              <input type="checkbox" id="req-confirm-s" checked={form.requiresConfirmation ?? false} onChange={(e) => setForm((f) => ({ ...f, requiresConfirmation: e.target.checked }))} className="rounded" />
              <Label htmlFor="req-confirm-s" className="font-normal cursor-pointer">Exigir confirmação de leitura</Label>
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

      {/* Detail Dialog */}
      <Dialog open={!!selectedId} onOpenChange={(o) => !o && setSelectedId(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {detail && (() => {
            const d = detail as NoticeDetail;
            const urg  = URGENCY_CFG[d.urgency as keyof typeof URGENCY_CFG] ?? URGENCY_CFG.INFORMATIVE;
            const stat = STATUS_CFG[d.status  as keyof typeof STATUS_CFG]   ?? STATUS_CFG.DRAFT;
            return (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-2 flex-wrap">
                    <DialogTitle>{d.title ?? "Aviso"}</DialogTitle>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${urg.badge}`}>{urg.label}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${stat.badge}`}>{stat.label}</span>
                  </div>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <p className="text-sm">{d.content}</p>
                  {d.recipients && d.recipients.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                          <Users className="h-3.5 w-3.5" /> Destinatários ({d.recipients.length})
                          {d.requiresConfirmation && (
                            <span className="ml-auto text-xs">{d.recipients.filter((r) => r.status === "CONFIRMED").length} confirmaram</span>
                          )}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="divide-y max-h-56 overflow-y-auto">
                          {d.recipients.map((r) => (
                            <div key={r.id} className="px-4 py-2 flex items-center gap-3">
                              <p className="flex-1 text-sm truncate">{r.userName ?? r.userId}</p>
                              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                                r.status === "CONFIRMED" ? "bg-green-100 text-green-700"
                                : r.status === "VIEWED" ? "bg-indigo-100 text-indigo-700"
                                : r.status === "SENT"    ? "bg-blue-100 text-blue-700"
                                : "bg-gray-100 text-gray-600"
                              }`}>{r.status}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
                <DialogFooter>
                  {d.status === "DRAFT" && (
                    <Button size="sm" disabled={publishMutation.isPending} onClick={() => handlePublish(d.id)}>
                      <Send className="h-3.5 w-3.5 mr-1.5" /> Publicar
                    </Button>
                  )}
                  {(d.status === "DRAFT" || d.status === "PUBLISHED") && (
                    <Button size="sm" variant="outline" className="text-red-600 border-red-200" disabled={cancelMutation.isPending} onClick={() => handleCancel(d.id)}>
                      <XCircle className="h-3.5 w-3.5 mr-1.5" /> Cancelar
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => setSelectedId(null)}>Fechar</Button>
                </DialogFooter>
              </>
            );
          })()}
          {!detail && selectedId && <div className="py-8 flex justify-center"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
