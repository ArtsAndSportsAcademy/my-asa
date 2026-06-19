import { useState } from "react";
import {
  useListHistory,
  getListHistoryQueryKey,
} from "@workspace/api-client-react";
import type { HistoryEvent } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Clock,
  Filter,
  RefreshCw,
  AlertCircle,
  Calendar,
  Bell,
  FileText,
  Users,
  Package,
  MessageSquare,
  Activity,
  CheckCircle,
} from "lucide-react";

// ─── Config ────────────────────────────────────────────────────────────────────

const CATEGORY_CFG: Record<string, { label: string; badge: string; dot: string; Icon: React.ElementType }> = {
  SCALE:              { label: "Escala",       badge: "bg-violet-100 text-violet-800",  dot: "bg-violet-500",  Icon: Users },
  DAILY_BOOK:         { label: "Livro do Dia", badge: "bg-blue-100 text-blue-800",      dot: "bg-blue-500",    Icon: FileText },
  NOTICE:             { label: "Aviso",        badge: "bg-amber-100 text-amber-800",    dot: "bg-amber-500",   Icon: Bell },
  AGENDA:             { label: "Agenda",       badge: "bg-green-100 text-green-800",    dot: "bg-green-500",   Icon: Calendar },
  REQUEST:            { label: "Solicitação",  badge: "bg-orange-100 text-orange-800",  dot: "bg-orange-500",  Icon: Activity },
  DELIVERY:           { label: "Entrega",      badge: "bg-teal-100 text-teal-800",      dot: "bg-teal-500",    Icon: Package },
  MESSAGE:            { label: "Mensagem",     badge: "bg-sky-100 text-sky-800",        dot: "bg-sky-500",     Icon: MessageSquare },
  OPERATIONAL_CHANGE: { label: "MO",           badge: "bg-red-100 text-red-800",        dot: "bg-red-500",     Icon: AlertCircle },
  TASK:               { label: "Tarefa",       badge: "bg-purple-100 text-purple-800",  dot: "bg-purple-500",  Icon: CheckCircle },
};

const ACTION_LABELS: Record<string, string> = {
  published:   "Publicado",
  republished: "Republicado",
  confirmed:   "Confirmado",
  escalated:   "Escalado",
  cancelled:   "Cancelado",
  suspended:   "Suspenso",
  updated:     "Atualizado",
  completed:   "Concluído",
  created:     "Criada",
  started:     "Iniciada",
  approved:    "Aprovada",
  expired:     "Expirada",
};

function fmtDateTime(dt: string | undefined | null) {
  if (!dt) return "—";
  return new Date(dt).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ─── Timeline Entry ───────────────────────────────────────────────────────────

function TimelineEntry({ event, isLast }: { event: HistoryEvent; isLast: boolean }) {
  const cfg = CATEGORY_CFG[event.category] ?? {
    label: event.category, badge: "bg-gray-100 text-gray-700", dot: "bg-gray-400", Icon: Activity,
  };
  const Icon = cfg.Icon;

  return (
    <div className="relative flex gap-4">
      {/* Vertical line */}
      {!isLast && (
        <div className="absolute left-[19px] top-9 bottom-0 w-0.5 bg-gray-100" />
      )}
      <div className="shrink-0 w-10 h-10 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center mt-0.5">
        <Icon size={16} className="text-gray-600" />
      </div>
      <div className="flex-1 pb-5">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.badge}`}>
            {cfg.label}
          </span>
          <span className="text-xs font-semibold text-gray-600">
            {ACTION_LABELS[event.action] ?? event.action}
          </span>
          <span className="text-xs text-gray-400 ml-auto">{fmtDateTime(event.occurredAt)}</span>
        </div>
        <p className="text-sm font-medium text-gray-900">{event.title}</p>
        <p className="text-xs text-gray-500 mt-0.5">{event.narrative}</p>
        {event.actorName && (
          <p className="text-xs text-gray-400 mt-1">por {event.actorName}</p>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SupervisorHistoryPage() {
  const qc = useQueryClient();

  const [categoryFilter, setCategoryFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo]     = useState("");

  const params = {
    ...(categoryFilter ? { category: categoryFilter } : {}),
    ...(dateFrom ? { dateFrom } : {}),
    ...(dateTo ? { dateTo } : {}),
    limit: 100,
  };

  const { data, isLoading } = useListHistory(params);
  const events = data?.events ?? [];

  const handleRefresh = () => {
    qc.invalidateQueries({ queryKey: getListHistoryQueryKey(params) });
  };

  return (
    <AdminLayout title="Histórico — Supervisor">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Clock size={22} className="text-violet-600" />
              Histórico — Supervisor
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Linha do tempo operacional da sua área de atuação
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw size={14} className="mr-1.5" /> Atualizar
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
          {/* Filtros */}
          <Card className="h-fit sticky top-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Filter size={14} /> Filtros
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs text-gray-600">Categoria</Label>
                <Select
                  value={categoryFilter || "ALL"}
                  onValueChange={(v) => setCategoryFilter(v === "ALL" ? "" : v)}
                >
                  <SelectTrigger className="mt-1 h-8 text-xs">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todas</SelectItem>
                    {Object.entries(CATEGORY_CFG).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-gray-600">De</Label>
                <Input
                  type="date"
                  className="mt-1 h-8 text-xs"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs text-gray-600">Até</Label>
                <Input
                  type="date"
                  className="mt-1 h-8 text-xs"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={() => { setCategoryFilter(""); setDateFrom(""); setDateTo(""); }}
              >
                Limpar filtros
              </Button>

              {/* Quick stats */}
              <div className="pt-2 border-t">
                <p className="text-xs font-semibold text-gray-500 mb-2">Resumo</p>
                {Object.entries(CATEGORY_CFG).map(([key, cfg]) => {
                  const count = events.filter((e) => e.category === key).length;
                  if (count === 0) return null;
                  return (
                    <div key={key} className="flex items-center justify-between py-0.5">
                      <span className="text-xs text-gray-600">{cfg.label}</span>
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${cfg.badge}`}>{count}</span>
                    </div>
                  );
                })}
                {events.length === 0 && (
                  <p className="text-xs text-gray-400 italic">Sem dados</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                {isLoading
                  ? "Carregando..."
                  : `${events.length} evento${events.length !== 1 ? "s" : ""} na linha do tempo`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-10">
                  <RefreshCw size={20} className="animate-spin text-gray-400" />
                </div>
              ) : events.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Clock size={36} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Nenhum registro no histórico ainda.</p>
                  <p className="text-xs mt-1">As ações da sua operação serão registradas aqui automaticamente.</p>
                </div>
              ) : (
                <div className="pl-2">
                  {events.map((event, i) => (
                    <TimelineEntry
                      key={event.id}
                      event={event}
                      isLast={i === events.length - 1}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
