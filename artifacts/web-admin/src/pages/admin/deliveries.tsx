import { useState } from "react";
import {
  useListDeliveries,
  useGetDelivery,
  useCreateDelivery,
  usePublishDelivery,
  useCancelDelivery,
  useListDeliveryMembers,
  getListDeliveriesQueryKey,
  getGetDeliveryQueryKey,
} from "@workspace/api-client-react";
import type { DeliveryItem, DeliveryDetail, DeliveryAssignmentItem, DeliveryMember } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Package, Plus, RefreshCw, Send, X, CheckCircle2, Clock, Eye,
  Users, AlertCircle, Ban, BookOpen, Tag, ChevronRight,
} from "lucide-react";

// ─── Config ────────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  MANDATORY_READ:     "Leitura Obrigatória",
  MANDATORY_VIDEO:    "Vídeo Obrigatório",
  OPERATIONAL_UPDATE: "Atualização Operacional",
  CHECKLIST:          "Checklist",
  READING:            "Leitura",
  VIDEO:              "Vídeo",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT:     "Rascunho",
  PUBLISHED: "Publicada",
  RECEIVED:  "Recebida",
  VIEWED:    "Visualizada",
  COMPLETED: "Concluída",
  LATE:      "Atrasada",
  EXPIRED:   "Expirada",
  CANCELLED: "Cancelada",
};

const ASSIGNMENT_STATUS_LABELS: Record<string, string> = {
  PUBLISHED: "Aguardando",
  RECEIVED:  "Recebida",
  VIEWED:    "Visualizada",
  COMPLETED: "Concluída",
  OVERDUE:   "Atrasada",
  EXPIRED:   "Expirada",
};

type DeliveryStatus = "DRAFT" | "PUBLISHED" | "RECEIVED" | "VIEWED" | "COMPLETED" | "LATE" | "EXPIRED" | "CANCELLED";

function statusColor(s: string): string {
  switch (s) {
    case "DRAFT":     return "bg-gray-100 text-gray-600";
    case "PUBLISHED": return "bg-blue-100 text-blue-700";
    case "RECEIVED":  return "bg-indigo-100 text-indigo-700";
    case "VIEWED":    return "bg-violet-100 text-violet-700";
    case "COMPLETED": return "bg-green-100 text-green-700";
    case "LATE":      case "OVERDUE": return "bg-amber-100 text-amber-700";
    case "EXPIRED":   return "bg-orange-100 text-orange-700";
    case "CANCELLED": return "bg-red-100 text-red-700";
    default:          return "bg-gray-100 text-gray-600";
  }
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function ProgressBar({ assignments }: { assignments: DeliveryAssignmentItem[] }) {
  const total = assignments.length;
  if (total === 0) return <p className="text-xs text-gray-400">Sem destinatários</p>;

  const completed = assignments.filter((a) => a.status === "COMPLETED").length;
  const viewed    = assignments.filter((a) => a.status === "VIEWED").length;
  const received  = assignments.filter((a) => a.status === "RECEIVED").length;
  const pct = Math.round(((completed) / total) * 100);

  return (
    <div>
      <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
        <span>{completed}/{total} concluídas</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex gap-3 mt-1.5 text-xs text-gray-400">
        <span className="flex items-center gap-1"><Eye size={10}/> {viewed} vis.</span>
        <span className="flex items-center gap-1"><Clock size={10}/> {received} rec.</span>
        <span className="flex items-center gap-1"><AlertCircle size={10}/> {total - completed - viewed - received} aguard.</span>
      </div>
    </div>
  );
}

// ─── Delivery Card ────────────────────────────────────────────────────────────

function DeliveryCard({ delivery, selected, onSelect }: {
  delivery: DeliveryItem;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left px-4 py-3 border-b transition-colors ${
        selected ? "bg-violet-50 border-l-2 border-l-violet-600" : "hover:bg-gray-50"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-gray-900 truncate flex-1">{delivery.title}</p>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${statusColor(delivery.status)}`}>
          {STATUS_LABELS[delivery.status] ?? delivery.status}
        </span>
      </div>
      <div className="flex items-center gap-2 mt-1">
        <span className="text-xs bg-violet-50 text-violet-700 px-1.5 py-0.5 rounded">
          {TYPE_LABELS[delivery.type] ?? delivery.type}
        </span>
        <span className="text-xs text-gray-400">Prazo: {fmtDate(delivery.dueDate)}</span>
      </div>
    </button>
  );
}

// ─── Create Delivery Dialog ───────────────────────────────────────────────────

function CreateDeliveryDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const createMut = useCreateDelivery();

  const [form, setForm] = useState({
    title: "",
    description: "",
    type: "MANDATORY_READ",
    dueDate: "",
    maxDueDate: "",
  });
  const [checklistItems, setChecklistItems] = useState<{ id: string; label: string }[]>([]);
  const [newItem, setNewItem] = useState("");

  const isChecklist = form.type === "CHECKLIST";

  const addItem = () => {
    if (!newItem.trim()) return;
    setChecklistItems((p) => [...p, { id: crypto.randomUUID(), label: newItem.trim() }]);
    setNewItem("");
  };

  const handleCreate = () => {
    if (!form.title || !form.dueDate || !form.maxDueDate) return;
    createMut.mutate(
      {
        data: {
          title: form.title,
          description: form.description || undefined,
          type: form.type,
          dueDate: form.dueDate,
          maxDueDate: form.maxDueDate,
          checklistItems: isChecklist && checklistItems.length > 0 ? checklistItems : undefined,
          content: {},
        },
      },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListDeliveriesQueryKey() });
          onClose();
        },
      }
    );
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova Entrega</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2 max-h-[70vh] overflow-y-auto pr-1">
          <div>
            <Label>Título</Label>
            <Input className="mt-1" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="Ex: Leitura obrigatória — Manual de Segurança" />
          </div>
          <div>
            <Label>Descrição (opcional)</Label>
            <Textarea className="mt-1 resize-none" rows={2} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
          </div>
          <div>
            <Label>Tipo</Label>
            <Select value={form.type} onValueChange={(v) => setForm((p) => ({ ...p, type: v }))}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(TYPE_LABELS).filter(([k]) => ["MANDATORY_READ","MANDATORY_VIDEO","OPERATIONAL_UPDATE","CHECKLIST"].includes(k)).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Prazo Principal</Label>
              <Input className="mt-1" type="date" value={form.dueDate} onChange={(e) => setForm((p) => ({ ...p, dueDate: e.target.value }))} />
            </div>
            <div>
              <Label>Prazo Máximo</Label>
              <Input className="mt-1" type="date" value={form.maxDueDate} onChange={(e) => setForm((p) => ({ ...p, maxDueDate: e.target.value }))} />
            </div>
          </div>
          {isChecklist && (
            <div>
              <Label>Itens do Checklist</Label>
              <div className="mt-1 space-y-1.5">
                {checklistItems.map((item, i) => (
                  <div key={item.id} className="flex items-center gap-2 text-sm">
                    <span className="text-gray-400 text-xs w-5 text-right">{i+1}.</span>
                    <span className="flex-1">{item.label}</span>
                    <button onClick={() => setChecklistItems((p) => p.filter((x) => x.id !== item.id))} className="text-gray-300 hover:text-red-400">
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <Input className="h-7 text-xs flex-1" placeholder="Novo item..." value={newItem} onChange={(e) => setNewItem(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem(); } }} />
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={addItem}>+ Add</Button>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={handleCreate}
            disabled={createMut.isPending || !form.title || !form.dueDate || !form.maxDueDate}
            className="bg-violet-700 hover:bg-violet-800 text-white"
          >
            {createMut.isPending ? "Criando..." : "Criar Rascunho"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Publish Dialog ───────────────────────────────────────────────────────────

function PublishDialog({ deliveryId, onClose }: { deliveryId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: membersData } = useListDeliveryMembers();
  const publishMut = usePublishDelivery();
  const members = membersData?.members ?? [];
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggleAll = () => {
    if (selectedIds.length === members.length) setSelectedIds([]);
    else setSelectedIds(members.map((m) => m.id));
  };

  const toggle = (id: string) =>
    setSelectedIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const handlePublish = () => {
    if (selectedIds.length === 0) return;
    publishMut.mutate(
      { deliveryId, data: { targetUserIds: selectedIds } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListDeliveriesQueryKey() });
          qc.invalidateQueries({ queryKey: getGetDeliveryQueryKey(deliveryId) });
          onClose();
        },
      }
    );
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Publicar Entrega</DialogTitle>
        </DialogHeader>
        <div className="py-2">
          <p className="text-sm text-gray-600 mb-3">Selecione quem deve receber esta entrega:</p>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500">{selectedIds.length} selecionado(s)</span>
            <button className="text-xs text-violet-600 hover:underline" onClick={toggleAll}>
              {selectedIds.length === members.length ? "Desmarcar todos" : "Selecionar todos"}
            </button>
          </div>
          <div className="max-h-56 overflow-y-auto border rounded-md divide-y">
            {members.map((m) => (
              <label key={m.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50">
                <input type="checkbox" className="accent-violet-600" checked={selectedIds.includes(m.id)} onChange={() => toggle(m.id)} />
                <div>
                  <p className="text-sm font-medium">{m.name ?? m.email}</p>
                  <p className="text-xs text-gray-500">{m.role}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={handlePublish}
            disabled={publishMut.isPending || selectedIds.length === 0}
            className="bg-violet-700 hover:bg-violet-800 text-white"
          >
            {publishMut.isPending ? "Publicando..." : `Publicar para ${selectedIds.length}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

function DeliveryPanel({ deliveryId, onClose }: { deliveryId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { data, isLoading, refetch } = useGetDelivery(deliveryId);
  const cancelMut = useCancelDelivery();
  const [publishOpen, setPublishOpen] = useState(false);

  const delivery = data?.delivery as DeliveryDetail | undefined;
  const assignments = (data?.assignments ?? []) as DeliveryAssignmentItem[];

  const handleCancel = () => {
    if (!confirm("Cancelar esta entrega?")) return;
    cancelMut.mutate(
      { deliveryId },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListDeliveriesQueryKey() });
          qc.invalidateQueries({ queryKey: getGetDeliveryQueryKey(deliveryId) });
        },
      }
    );
  };

  if (isLoading) return <div className="flex-1 flex items-center justify-center"><RefreshCw size={20} className="animate-spin text-gray-400" /></div>;
  if (!delivery) return null;

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
      {/* Header */}
      <div className="flex items-start justify-between px-6 py-4 border-b bg-white sticky top-0 z-10">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base font-bold text-gray-900">{delivery.title}</h2>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(delivery.status)}`}>
              {STATUS_LABELS[delivery.status] ?? delivery.status}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
            <span className="bg-violet-50 text-violet-700 px-1.5 py-0.5 rounded">
              {TYPE_LABELS[delivery.type] ?? delivery.type}
            </span>
            <span>Prazo: {fmtDate(delivery.dueDate)}</span>
            <span>Máx: {fmtDate(delivery.maxDueDate)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-4">
          {delivery.status === "DRAFT" && (
            <Button size="sm" className="bg-violet-700 hover:bg-violet-800 text-white text-xs" onClick={() => setPublishOpen(true)}>
              <Send size={12} className="mr-1" /> Publicar
            </Button>
          )}
          {delivery.status !== "CANCELLED" && delivery.status !== "DRAFT" && (
            <Button size="sm" variant="outline" className="text-xs text-red-600 border-red-200 hover:bg-red-50" onClick={handleCancel} disabled={cancelMut.isPending}>
              Cancelar
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => refetch()}><RefreshCw size={14} /></Button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Description */}
        {delivery.description && (
          <p className="text-sm text-gray-600">{delivery.description}</p>
        )}

        {/* Checklist items preview */}
        {delivery.checklistItems && delivery.checklistItems.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Itens do Checklist</h3>
            <div className="space-y-1">
              {delivery.checklistItems.map((item, i) => (
                <div key={item.id} className="flex items-center gap-2 text-sm text-gray-700">
                  <span className="w-5 h-5 rounded border border-gray-300 flex items-center justify-center text-xs text-gray-400">{i+1}</span>
                  {item.label}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Progress summary */}
        {assignments.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Progresso Geral</h3>
            <ProgressBar assignments={assignments} />
          </div>
        )}

        {/* Assignments table */}
        {assignments.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Destinatários ({assignments.length})</h3>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="text-left px-4 py-2">Membro</th>
                    <th className="text-left px-4 py-2">Status</th>
                    <th className="text-left px-4 py-2">Concluído em</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {assignments.map((a) => (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5">
                        <p className="font-medium">{a.userName ?? "—"}</p>
                        <p className="text-xs text-gray-400">{a.userEmail}</p>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(a.status)}`}>
                          {ASSIGNMENT_STATUS_LABELS[a.status] ?? a.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-500">
                        {a.completedAt ? fmtDate(a.completedAt) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {delivery.status === "DRAFT" && assignments.length === 0 && (
          <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center">
            <Send size={28} className="mx-auto mb-3 text-gray-300" />
            <p className="text-sm font-medium text-gray-500">Pronto para publicar</p>
            <p className="text-xs text-gray-400 mt-1">Clique em "Publicar" para enviar esta entrega aos membros</p>
            <Button size="sm" className="mt-4 bg-violet-700 hover:bg-violet-800 text-white text-xs" onClick={() => setPublishOpen(true)}>
              <Send size={12} className="mr-1" /> Publicar agora
            </Button>
          </div>
        )}
      </div>

      {publishOpen && <PublishDialog deliveryId={deliveryId} onClose={() => setPublishOpen(false)} />}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminDeliveriesPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data, isLoading } = useListDeliveries();
  const deliveries = (data?.deliveries ?? []) as DeliveryItem[];
  const filtered = deliveries.filter((d) => !search || d.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <AdminLayout title="Entregas">
      <div className="flex h-[calc(100vh-64px)] overflow-hidden">
        {/* Sidebar */}
        <div className="w-80 flex flex-col border-r bg-white">
          <div className="px-4 py-3 border-b">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Package size={16} className="text-violet-600" /> Entregas
              </h1>
              <Button size="sm" className="bg-violet-700 hover:bg-violet-800 text-white h-7 text-xs" onClick={() => setCreateOpen(true)}>
                <Plus size={12} className="mr-1" /> Nova
              </Button>
            </div>
            <Input placeholder="Buscar..." className="h-7 text-xs" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex-1 overflow-y-auto">
            {isLoading && <div className="flex justify-center py-8"><RefreshCw size={18} className="animate-spin text-gray-400" /></div>}
            {!isLoading && filtered.length === 0 && (
              <div className="text-center py-10 text-gray-400">
                <Package size={28} className="mx-auto mb-2 opacity-30" />
                <p className="text-xs">Nenhuma entrega registrada ainda. As entregas da operação aparecerão aqui.</p>
              </div>
            )}
            {filtered.map((d) => (
              <DeliveryCard key={d.id} delivery={d} selected={d.id === selectedId} onSelect={() => setSelectedId(d.id)} />
            ))}
          </div>
        </div>

        {/* Detail */}
        {selectedId ? (
          <DeliveryPanel deliveryId={selectedId} onClose={() => setSelectedId(null)} />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center text-gray-400">
              <Package size={48} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium text-gray-500">Selecione uma entrega</p>
              <p className="text-xs mt-1">ou crie uma nova para começar</p>
            </div>
          </div>
        )}
      </div>
      {createOpen && <CreateDeliveryDialog onClose={() => setCreateOpen(false)} />}
    </AdminLayout>
  );
}
