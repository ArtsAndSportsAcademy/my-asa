import { useState } from "react";
import {
  useListHistory,
  useListHistoryNarratives,
  useCreateHistoryNarrative,
  useUpdateHistoryNarrative,
  getListHistoryQueryKey,
  getListHistoryNarrativesQueryKey,
} from "@workspace/api-client-react";
import type {
  HistoryEvent,
  HistoryNarrative,
  HistoryNarrativeStatus,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Clock,
  Filter,
  RefreshCw,
  BookOpen,
  Plus,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Bell,
  FileText,
  Users,
  Package,
  MessageSquare,
  Activity,
} from "lucide-react";

// ─── Config ────────────────────────────────────────────────────────────────────

const CATEGORY_CFG: Record<string, { label: string; badge: string; Icon: React.ElementType }> = {
  SCALE:              { label: "Escala",       badge: "bg-violet-100 text-violet-800",  Icon: Users },
  DAILY_BOOK:         { label: "Livro do Dia", badge: "bg-blue-100 text-blue-800",      Icon: FileText },
  NOTICE:             { label: "Aviso",        badge: "bg-amber-100 text-amber-800",    Icon: Bell },
  AGENDA:             { label: "Agenda",       badge: "bg-green-100 text-green-800",    Icon: Calendar },
  REQUEST:            { label: "Solicitação",  badge: "bg-orange-100 text-orange-800",  Icon: Activity },
  DELIVERY:           { label: "Entrega",      badge: "bg-teal-100 text-teal-800",      Icon: Package },
  MESSAGE:            { label: "Mensagem",     badge: "bg-sky-100 text-sky-800",        Icon: MessageSquare },
  OPERATIONAL_CHANGE: { label: "MO",           badge: "bg-red-100 text-red-800",        Icon: AlertCircle },
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
};

const NARRATIVE_STATUS_CFG: Record<string, { label: string; badge: string }> = {
  OPEN:     { label: "Aberto",   badge: "bg-blue-100 text-blue-700" },
  RESOLVED: { label: "Resolvido", badge: "bg-green-100 text-green-700" },
  CLOSED:   { label: "Fechado",  badge: "bg-gray-100 text-gray-700" },
};

function fmtDateTime(dt: string | undefined | null) {
  if (!dt) return "—";
  const d = new Date(dt);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ─── Event Card ───────────────────────────────────────────────────────────────

function EventCard({ event }: { event: HistoryEvent }) {
  const cfg = CATEGORY_CFG[event.category] ?? { label: event.category, badge: "bg-gray-100 text-gray-700", Icon: Activity };
  const Icon = cfg.Icon;
  return (
    <div className="flex gap-3 py-3 border-b last:border-0">
      <div className="mt-0.5 p-2 rounded-full bg-gray-100 shrink-0">
        <Icon size={14} className="text-gray-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.badge}`}>{cfg.label}</span>
          <span className="text-xs text-gray-500 font-medium">{ACTION_LABELS[event.action] ?? event.action}</span>
        </div>
        <p className="text-sm font-medium text-gray-900 truncate">{event.title}</p>
        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{event.narrative}</p>
        <div className="flex items-center gap-3 mt-1.5">
          {event.actorName && (
            <span className="text-xs text-gray-400">{event.actorName}</span>
          )}
          <span className="text-xs text-gray-400">{fmtDateTime(event.occurredAt)}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Narrative Card ───────────────────────────────────────────────────────────

function NarrativeCard({
  narrative,
  onSelect,
}: {
  narrative: HistoryNarrative;
  onSelect: (n: HistoryNarrative) => void;
}) {
  const stCfg = NARRATIVE_STATUS_CFG[narrative.status] ?? { label: narrative.status, badge: "bg-gray-100 text-gray-700" };
  return (
    <button
      onClick={() => onSelect(narrative)}
      className="w-full text-left p-3 rounded-lg border hover:border-violet-300 hover:bg-violet-50/40 transition-colors group"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-gray-900 flex-1">{narrative.title}</p>
        <ChevronRight size={14} className="text-gray-400 group-hover:text-violet-600 mt-0.5 shrink-0" />
      </div>
      <div className="flex items-center gap-2 mt-1.5">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${stCfg.badge}`}>{stCfg.label}</span>
        <span className="text-xs text-gray-400">{fmtDateTime(narrative.createdAt)}</span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        {[
          ["Causa", narrative.cause],
          ["Decisão", narrative.decision],
          ["Impacto", narrative.impact],
          ["Resolução", narrative.resolution],
        ].map(([label, val]) => (
          <div key={label} className="text-xs">
            <span className="font-medium text-gray-500">{label}: </span>
            <span className={val ? "text-gray-700" : "text-gray-300 italic"}>
              {val ?? "—"}
            </span>
          </div>
        ))}
      </div>
    </button>
  );
}

// ─── Narrative Detail Dialog ──────────────────────────────────────────────────

function NarrativeDetailDialog({
  narrative,
  onClose,
}: {
  narrative: HistoryNarrative;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const updateMut = useUpdateHistoryNarrative();
  const [form, setForm] = useState({
    cause:      narrative.cause ?? "",
    decision:   narrative.decision ?? "",
    impact:     narrative.impact ?? "",
    resolution: narrative.resolution ?? "",
    status:     narrative.status,
  });

  const handleSave = () => {
    updateMut.mutate(
      { narrativeId: narrative.id, data: form },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListHistoryNarrativesQueryKey() });
          onClose();
        },
      }
    );
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen size={18} className="text-violet-600" />
            {narrative.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {(["cause", "decision", "impact", "resolution"] as const).map((field) => {
            const labels: Record<string, string> = {
              cause: "Causa", decision: "Decisão", impact: "Impacto", resolution: "Resolução",
            };
            return (
              <div key={field}>
                <Label className="text-sm font-semibold text-gray-700 mb-1.5 block">{labels[field]}</Label>
                <Textarea
                  className="resize-none text-sm"
                  rows={3}
                  placeholder={`Descreva a ${labels[field].toLowerCase()}...`}
                  value={form[field]}
                  onChange={(e) => setForm((p) => ({ ...p, [field]: e.target.value }))}
                />
              </div>
            );
          })}

          <div>
            <Label className="text-sm font-semibold text-gray-700 mb-1.5 block">Status</Label>
            <Select
              value={form.status}
              onValueChange={(v) => setForm((p) => ({ ...p, status: v as HistoryNarrativeStatus }))}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="OPEN">Aberto</SelectItem>
                <SelectItem value="RESOLVED">Resolvido</SelectItem>
                <SelectItem value="CLOSED">Fechado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          <Button
            onClick={handleSave}
            disabled={updateMut.isPending}
            className="bg-violet-700 hover:bg-violet-800 text-white"
          >
            {updateMut.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Create Narrative Dialog ──────────────────────────────────────────────────

function CreateNarrativeDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const createMut = useCreateHistoryNarrative();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("OPERATIONAL_CHANGE");

  const handleCreate = () => {
    if (!title.trim()) return;
    createMut.mutate(
      { data: { title, category } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListHistoryNarrativesQueryKey() });
          onClose();
        },
      }
    );
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Investigação</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Título</Label>
            <Input
              className="mt-1"
              placeholder="Ex: Republicação de escala — 20/06"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div>
            <Label>Categoria</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CATEGORY_CFG).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={handleCreate}
            disabled={createMut.isPending || !title.trim()}
            className="bg-violet-700 hover:bg-violet-800 text-white"
          >
            {createMut.isPending ? "Criando..." : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminHistoryPage() {
  const qc = useQueryClient();

  const [activeTab, setActiveTab]       = useState<"timeline" | "narratives">("timeline");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [dateFrom, setDateFrom]         = useState("");
  const [dateTo, setDateTo]             = useState("");
  const [selectedNarrative, setSelectedNarrative] = useState<HistoryNarrative | null>(null);
  const [createOpen, setCreateOpen]     = useState(false);

  const eventsParams = {
    ...(categoryFilter ? { category: categoryFilter } : {}),
    ...(dateFrom ? { dateFrom } : {}),
    ...(dateTo ? { dateTo } : {}),
    limit: 100,
  };

  const { data: eventsData, isLoading: evLoading, refetch: refetchEvents } =
    useListHistory(eventsParams);

  const { data: narrativesData, isLoading: narLoading, refetch: refetchNarratives } =
    useListHistoryNarratives({ limit: 50 });

  const events    = eventsData?.events    ?? [];
  const narratives = narrativesData?.narratives ?? [];

  const handleRefresh = () => {
    if (activeTab === "timeline") {
      qc.invalidateQueries({ queryKey: getListHistoryQueryKey(eventsParams) });
    } else {
      qc.invalidateQueries({ queryKey: getListHistoryNarrativesQueryKey() });
    }
  };

  return (
    <AdminLayout title="Histórico Operacional">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Clock size={22} className="text-violet-600" />
              Histórico Operacional
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Memória oficial da operação — o que aconteceu, por que e como terminou
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw size={14} className="mr-1.5" /> Atualizar
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit">
          {[
            { key: "timeline", label: "Linha do Tempo" },
            { key: "narratives", label: "Investigações" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "bg-white text-violet-700 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Tab: Linha do Tempo ── */}
        {activeTab === "timeline" && (
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
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
              </CardContent>
            </Card>

            {/* Lista de eventos */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  {evLoading
                    ? "Carregando..."
                    : `${events.length} evento${events.length !== 1 ? "s" : ""}`}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {evLoading ? (
                  <div className="flex justify-center py-10">
                    <RefreshCw size={20} className="animate-spin text-gray-400" />
                  </div>
                ) : events.length === 0 ? (
                  <div className="text-center py-10 text-gray-400">
                    <Clock size={32} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Nenhum registro no histórico ainda.</p>
                    <p className="text-xs mt-1">As ações operacionais da sua equipe serão registradas aqui automaticamente.</p>
                  </div>
                ) : (
                  <div>
                    {events.map((event) => (
                      <EventCard key={event.id} event={event} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Tab: Investigações ── */}
        {activeTab === "narratives" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-600">
                Registros estruturados de investigação: Causa → Decisão → Impacto → Resolução
              </p>
              <Button
                size="sm"
                className="bg-violet-700 hover:bg-violet-800 text-white"
                onClick={() => setCreateOpen(true)}
              >
                <Plus size={14} className="mr-1.5" /> Nova Investigação
              </Button>
            </div>

            {narLoading ? (
              <div className="flex justify-center py-10">
                <RefreshCw size={20} className="animate-spin text-gray-400" />
              </div>
            ) : narratives.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <BookOpen size={36} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nenhuma investigação registrada ainda</p>
                <p className="text-xs mt-1">Crie a primeira investigação para documentar uma ocorrência operacional</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {narratives.map((n) => (
                  <NarrativeCard key={n.id} narrative={n} onSelect={setSelectedNarrative} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {selectedNarrative && (
        <NarrativeDetailDialog
          narrative={selectedNarrative}
          onClose={() => setSelectedNarrative(null)}
        />
      )}
      {createOpen && (
        <CreateNarrativeDialog onClose={() => setCreateOpen(false)} />
      )}
    </AdminLayout>
  );
}
