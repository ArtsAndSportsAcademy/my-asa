import { useState } from "react";
import {
  useListDeliveries,
  useGetDelivery,
  getListDeliveriesQueryKey,
  getGetDeliveryQueryKey,
} from "@workspace/api-client-react";
import type { DeliveryItem, DeliveryDetail, DeliveryAssignmentItem } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshCw, Package, Eye, Clock, CheckCircle2, AlertCircle, Users } from "lucide-react";

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

function ProgressBar({ assignments }: { assignments: DeliveryAssignmentItem[] }) {
  const total = assignments.length;
  if (total === 0) return <p className="text-xs text-gray-400">Sem destinatários</p>;
  const completed = assignments.filter((a) => a.status === "COMPLETED").length;
  const pct = Math.round((completed / total) * 100);
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>{completed}/{total} concluídas</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full bg-green-500 rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function DeliveryCard({ delivery, selected, onSelect }: { delivery: DeliveryItem; selected: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left px-4 py-3 border-b transition-colors ${selected ? "bg-violet-50 border-l-2 border-l-violet-600" : "hover:bg-gray-50"}`}
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

function SupervisorDeliveryPanel({ deliveryId }: { deliveryId: string }) {
  const { data, isLoading, refetch } = useGetDelivery(deliveryId);
  const delivery = data?.delivery as DeliveryDetail | undefined;
  const assignments = (data?.assignments ?? []) as DeliveryAssignmentItem[];

  if (isLoading) return <div className="flex-1 flex items-center justify-center"><RefreshCw size={20} className="animate-spin text-gray-400" /></div>;
  if (!delivery) return null;

  const pending   = assignments.filter((a) => a.status === "PUBLISHED");
  const received  = assignments.filter((a) => a.status === "RECEIVED");
  const viewed    = assignments.filter((a) => a.status === "VIEWED");
  const completed = assignments.filter((a) => a.status === "COMPLETED");
  const late      = assignments.filter((a) => a.status === "OVERDUE" || a.status === "EXPIRED");

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
      {/* Header */}
      <div className="flex items-start justify-between px-6 py-4 border-b bg-white sticky top-0 z-10">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-gray-900">{delivery.title}</h2>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(delivery.status)}`}>
              {STATUS_LABELS[delivery.status] ?? delivery.status}
            </span>
          </div>
          <div className="flex gap-3 mt-1 text-xs text-gray-500">
            <span className="bg-violet-50 text-violet-700 px-1.5 py-0.5 rounded">{TYPE_LABELS[delivery.type] ?? delivery.type}</span>
            <span>Prazo: {fmtDate(delivery.dueDate)}</span>
            <span>Máx: {fmtDate(delivery.maxDueDate)}</span>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => refetch()}><RefreshCw size={14} /></Button>
      </div>

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Concluídas", value: completed.length, color: "text-green-600", bg: "bg-green-50" },
            { label: "Visualizadas", value: viewed.length, color: "text-violet-600", bg: "bg-violet-50" },
            { label: "Recebidas", value: received.length, color: "text-blue-600", bg: "bg-blue-50" },
            { label: "Pendentes", value: pending.length, color: "text-gray-600", bg: "bg-gray-50" },
          ].map((s) => (
            <div key={s.label} className={`${s.bg} rounded-xl p-3 text-center`}>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Progress */}
        {assignments.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Progresso</h3>
            <ProgressBar assignments={assignments} />
          </div>
        )}

        {/* Description */}
        {delivery.description && <p className="text-sm text-gray-600">{delivery.description}</p>}

        {/* Pending list */}
        {pending.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-amber-600 uppercase mb-2 flex items-center gap-1">
              <AlertCircle size={12} /> Aguardando ({pending.length})
            </h3>
            <div className="border rounded-lg overflow-hidden">
              {pending.map((a) => (
                <div key={a.id} className="flex items-center justify-between px-4 py-2.5 border-b last:border-0 bg-amber-50/50">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{a.userName ?? "—"}</p>
                    <p className="text-xs text-gray-400">{a.userEmail}</p>
                  </div>
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Aguardando</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* All assignments */}
        {assignments.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Todos os destinatários</h3>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="text-left px-4 py-2">Membro</th>
                    <th className="text-left px-4 py-2">Status</th>
                    <th className="text-left px-4 py-2">Concluído</th>
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
      </div>
    </div>
  );
}

export default function SupervisorDeliveriesPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const { data, isLoading } = useListDeliveries();
  const deliveries = (data?.deliveries ?? []) as DeliveryItem[];
  const filtered = deliveries.filter((d) => d.status !== "DRAFT" && (!search || d.title.toLowerCase().includes(search.toLowerCase())));

  return (
    <AdminLayout title="Entregas — Supervisor">
      <div className="flex h-[calc(100vh-64px)] overflow-hidden">
        <div className="w-80 flex flex-col border-r bg-white">
          <div className="px-4 py-3 border-b">
            <h1 className="text-base font-bold text-gray-900 flex items-center gap-2 mb-2">
              <Package size={16} className="text-violet-600" /> Acompanhar Entregas
            </h1>
            <Input placeholder="Buscar..." className="h-7 text-xs" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex-1 overflow-y-auto">
            {isLoading && <div className="flex justify-center py-8"><RefreshCw size={18} className="animate-spin text-gray-400" /></div>}
            {!isLoading && filtered.length === 0 && (
              <div className="text-center py-10 text-gray-400">
                <Package size={28} className="mx-auto mb-2 opacity-30" />
                <p className="text-xs">Nenhuma entrega publicada ainda. As entregas da operação aparecerão aqui após serem registradas.</p>
              </div>
            )}
            {filtered.map((d) => (
              <DeliveryCard key={d.id} delivery={d} selected={d.id === selectedId} onSelect={() => setSelectedId(d.id)} />
            ))}
          </div>
        </div>
        {selectedId ? (
          <SupervisorDeliveryPanel deliveryId={selectedId} />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center text-gray-400">
              <Package size={48} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium text-gray-500">Selecione uma entrega</p>
              <p className="text-xs mt-1">para ver o progresso dos membros</p>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
