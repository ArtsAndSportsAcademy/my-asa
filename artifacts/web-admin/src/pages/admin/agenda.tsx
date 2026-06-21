import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListAgendaEvents,
  useCreateAgendaEvent,
  useUpdateAgendaEvent,
  useDeleteAgendaEvent,
  useConfirmAgendaEvent,
  useSuspendAgendaEvent,
  useCancelAgendaEvent,
  useCompleteAgendaEvent,
  getListAgendaEventsQueryKey,
  useListUsers,
  getListUsersQueryKey,
} from "@workspace/api-client-react";
import type { AgendaEvent, User as UserModel } from "@workspace/api-client-react";
import AdminLayout from "@/components/admin-layout";
import { AsaEmptyState } from "@/components/AsaEmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  Plus, MoreHorizontal, CheckCircle, PauseCircle, XCircle, Flag, Pencil, Trash2,
  CalendarDays, ChevronLeft, ChevronRight, List, Calendar, Eye, EyeOff,
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  SHOW: "Apresentação", REHEARSAL: "Ensaio", MEETING: "Reunião",
  OPERATIONAL_BLOCK: "Bloco Operacional", COLLECTIVE_VACATION: "Férias Coletivas",
};
const TYPE_COLORS: Record<string, string> = {
  SHOW: "bg-violet-100 text-violet-800",
  REHEARSAL: "bg-blue-100 text-blue-800",
  MEETING: "bg-amber-100 text-amber-800",
  OPERATIONAL_BLOCK: "bg-indigo-100 text-indigo-800",
  COLLECTIVE_VACATION: "bg-green-100 text-green-800",
};
const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Rascunho", CONFIRMED: "Confirmado", SUSPENDED: "Suspenso",
  CANCELLED: "Cancelado", COMPLETED: "Realizado",
};
const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  DRAFT: "secondary", CONFIRMED: "default", SUSPENDED: "outline",
  CANCELLED: "destructive", COMPLETED: "secondary",
};
const VISIBILITY_LABELS: Record<string, string> = {
  OPERATION: "Todos da operação",
  MANAGEMENT: "Somente supervisão e administração",
};
const EVENT_TYPES = ["SHOW", "REHEARSAL", "MEETING", "OPERATIONAL_BLOCK", "COLLECTIVE_VACATION"] as const;
const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

// ─── Calendar helpers ─────────────────────────────────────────────────────────

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

function getWeekStart(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
}

function getWeekEnd(d: Date): Date {
  const start = getWeekStart(d);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return end;
}

function getMonthStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function getMonthEnd(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function buildMonthGrid(d: Date): Date[] {
  const year = d.getFullYear();
  const month = d.getMonth();
  const firstDay = new Date(year, month, 1);
  const offset = (firstDay.getDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, i) => new Date(year, month, 1 - offset + i));
}

function buildWeekDays(d: Date): Date[] {
  const start = getWeekStart(d);
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(start);
    day.setDate(day.getDate() + i);
    return day;
  });
}

function groupByDate(events: AgendaEvent[]): Record<string, AgendaEvent[]> {
  const map: Record<string, AgendaEvent[]> = {};
  for (const ev of events) {
    if (!map[ev.date]) map[ev.date] = [];
    map[ev.date].push(ev);
  }
  return map;
}

// ─── Month Calendar ───────────────────────────────────────────────────────────

function MonthCalendar({ currentDate, events }: { currentDate: Date; events: AgendaEvent[] }) {
  const grid = useMemo(() => buildMonthGrid(currentDate), [currentDate]);
  const byDate = useMemo(() => groupByDate(events), [events]);
  const todayStr = toDateStr(new Date());

  return (
    <div>
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((d) => (
          <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-2">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px bg-border rounded-xl overflow-hidden border border-border">
        {grid.map((day, i) => {
          const dateStr = toDateStr(day);
          const dayEvents = byDate[dateStr] ?? [];
          const isCurrentMonth = day.getMonth() === currentDate.getMonth();
          const isToday = dateStr === todayStr;
          return (
            <div
              key={i}
              className={`bg-card min-h-[100px] p-1.5 ${!isCurrentMonth ? "bg-muted/30" : ""}`}
            >
              <div
                className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full mb-1 ${
                  isToday
                    ? "bg-primary text-primary-foreground"
                    : isCurrentMonth
                    ? "text-foreground"
                    : "text-muted-foreground/40"
                }`}
              >
                {day.getDate()}
              </div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map((ev) => (
                  <div
                    key={ev.id}
                    title={ev.title}
                    className={`text-[10px] px-1.5 py-0.5 rounded truncate leading-tight font-medium ${
                      TYPE_COLORS[ev.type] ?? "bg-gray-100 text-gray-800"
                    } ${ev.visibility === "MANAGEMENT" ? "opacity-70 italic" : ""}`}
                  >
                    {ev.startTime ? `${ev.startTime} ` : ""}
                    {ev.title}
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-[10px] text-muted-foreground pl-1">
                    +{dayEvents.length - 3} mais
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Week Calendar (Google Calendar style) ────────────────────────────────────

const CAL_START = 7;
const CAL_END = 22;
const HOUR_PX = 64;

const TYPE_BG_SOLID: Record<string, string> = {
  SHOW:               "bg-violet-500 border-violet-700",
  REHEARSAL:          "bg-blue-500 border-blue-700",
  MEETING:            "bg-amber-500 border-amber-700",
  OPERATIONAL_BLOCK:  "bg-indigo-500 border-indigo-700",
  COLLECTIVE_VACATION:"bg-green-500 border-green-700",
};

function timeToMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function evTop(startTime: string): number {
  return Math.max(0, (timeToMin(startTime) / 60 - CAL_START) * HOUR_PX);
}

function evHeight(startTime: string, endTime: string | undefined | null): number {
  if (!endTime) return 32;
  return Math.max(24, (timeToMin(endTime) - timeToMin(startTime)) * (HOUR_PX / 60));
}

function WeekCalendar({ currentDate, events }: { currentDate: Date; events: AgendaEvent[] }) {
  const days = useMemo(() => buildWeekDays(currentDate), [currentDate]);
  const byDate = useMemo(() => groupByDate(events), [events]);
  const todayStr = toDateStr(new Date());
  const hours = Array.from({ length: CAL_END - CAL_START }, (_, i) => CAL_START + i);
  const totalH = (CAL_END - CAL_START) * HOUR_PX;

  const hasAllDay = days.some((d) => (byDate[toDateStr(d)] ?? []).some((e) => !e.startTime));

  return (
    <div className="bg-card border rounded-xl overflow-hidden shadow-sm select-none">

      {/* ── Day header ── */}
      <div className="flex border-b bg-muted/30 sticky top-0 z-20">
        <div className="w-14 shrink-0 border-r" />
        {days.map((day, i) => {
          const isToday = toDateStr(day) === todayStr;
          return (
            <div key={i} className={`flex-1 text-center py-2.5 border-r last:border-r-0 ${isToday ? "bg-primary/5" : ""}`}>
              <p className={`text-[10px] uppercase font-semibold tracking-widest ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                {WEEKDAYS[i]}
              </p>
              <div className={`mx-auto mt-0.5 w-8 h-8 flex items-center justify-center rounded-full text-lg font-bold ${
                isToday ? "bg-primary text-white" : "text-foreground"
              }`}>
                {day.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── All-day strip ── */}
      {hasAllDay && (
        <div className="flex border-b">
          <div className="w-14 shrink-0 border-r flex items-center justify-end pr-2 py-1">
            <span className="text-[9px] uppercase text-muted-foreground rotate-0">dia todo</span>
          </div>
          {days.map((day, i) => {
            const dateStr = toDateStr(day);
            const allDay = (byDate[dateStr] ?? []).filter((e) => !e.startTime);
            const isToday = dateStr === todayStr;
            return (
              <div key={i} className={`flex-1 border-r last:border-r-0 p-1 space-y-0.5 ${isToday ? "bg-primary/5" : ""}`}>
                {allDay.map((ev) => (
                  <div key={ev.id}
                    className={`text-[10px] px-1.5 py-0.5 rounded font-medium truncate cursor-default ${TYPE_COLORS[ev.type] ?? "bg-gray-100 text-gray-700"}`}
                    title={ev.title}
                  >
                    {ev.title}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Time grid ── */}
      <div className="flex overflow-y-auto" style={{ maxHeight: 580 }}>

        {/* Time labels */}
        <div className="w-14 shrink-0 border-r relative bg-card" style={{ height: totalH }}>
          {hours.map((h) => (
            <div key={h} className="absolute right-0 left-0 flex justify-end pr-2"
              style={{ top: (h - CAL_START) * HOUR_PX - 9 }}>
              <span className="text-[10px] text-muted-foreground font-medium tabular-nums">
                {String(h).padStart(2, "0")}:00
              </span>
            </div>
          ))}
        </div>

        {/* Day columns */}
        {days.map((day, i) => {
          const dateStr = toDateStr(day);
          const timed = (byDate[dateStr] ?? []).filter((e) => !!e.startTime);
          const isToday = dateStr === todayStr;
          return (
            <div key={i} className={`flex-1 border-r last:border-r-0 relative ${isToday ? "bg-primary/[0.03]" : ""}`}
              style={{ height: totalH }}>

              {/* Hour lines */}
              {hours.map((h) => (
                <div key={h} className="absolute left-0 right-0 border-t border-border/40"
                  style={{ top: (h - CAL_START) * HOUR_PX }} />
              ))}
              {/* Half-hour lines */}
              {hours.map((h) => (
                <div key={`h${h}`} className="absolute left-0 right-0 border-t border-border/20 border-dashed"
                  style={{ top: (h - CAL_START) * HOUR_PX + HOUR_PX / 2 }} />
              ))}

              {/* Events */}
              {timed.map((ev) => {
                const top = evTop(ev.startTime!);
                const height = evHeight(ev.startTime!, ev.endTime);
                const bgCls = TYPE_BG_SOLID[ev.type] ?? "bg-gray-500 border-gray-700";
                return (
                  <div key={ev.id}
                    className={`absolute left-0.5 right-0.5 rounded border-l-2 px-1.5 py-1 text-white overflow-hidden cursor-default ${bgCls} ${ev.visibility === "MANAGEMENT" ? "opacity-70" : ""}`}
                    style={{ top, height }}
                    title={`${ev.title}${ev.location ? ` · ${ev.location}` : ""}\n${ev.startTime}${ev.endTime ? ` – ${ev.endTime}` : ""}`}
                  >
                    <p className="text-[10px] font-semibold leading-tight truncate">{ev.title}</p>
                    {height >= 36 && (
                      <p className="text-[9px] opacity-80 mt-0.5 tabular-nums">
                        {ev.startTime}{ev.endTime ? ` – ${ev.endTime}` : ""}
                      </p>
                    )}
                    {height >= 52 && ev.location && (
                      <p className="text-[9px] opacity-70 mt-0.5 truncate">{ev.location}</p>
                    )}
                  </div>
                );
              })}

              {/* Now line (today only) */}
              {isToday && (() => {
                const now = new Date();
                const nowTop = (now.getHours() * 60 + now.getMinutes()) / 60;
                const lineTop = (nowTop - CAL_START) * HOUR_PX;
                if (lineTop < 0 || lineTop > totalH) return null;
                return (
                  <div className="absolute left-0 right-0 z-10 flex items-center" style={{ top: lineTop }}>
                    <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 shrink-0" />
                    <div className="flex-1 h-px bg-red-500" />
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Form types ───────────────────────────────────────────────────────────────

interface EventFormState {
  title: string; type: string; date: string; endDate: string;
  startTime: string; endTime: string; location: string; notes: string;
  visibility: "OPERATION" | "MANAGEMENT";
  participantIds: string[];
}

const emptyForm: EventFormState = {
  title: "", type: "SHOW", date: "", endDate: "",
  startTime: "", endTime: "", location: "", notes: "",
  visibility: "OPERATION",
  participantIds: [],
};

// ─── Main page ────────────────────────────────────────────────────────────────

type ViewMode = "list" | "week" | "month";

export default function AgendaPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const auth = useAuth();
  const isAdmin = auth.roles.some((r) => ["ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"].includes(r.role));
  const operationId = auth.roles.find((r) => r.operationId)?.operationId;

  // ── View state ──
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [calendarDate, setCalendarDate] = useState(() => new Date());

  // ── List filters (only active in list mode) ──
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  // ── Effective date range ──
  const effectiveFrom = viewMode === "month"
    ? toDateStr(getMonthStart(calendarDate))
    : viewMode === "week"
    ? toDateStr(getWeekStart(calendarDate))
    : filterFrom || undefined;

  const effectiveTo = viewMode === "month"
    ? toDateStr(getMonthEnd(calendarDate))
    : viewMode === "week"
    ? toDateStr(getWeekEnd(calendarDate))
    : filterTo || undefined;

  const queryParams = {
    operationId,
    status: (filterStatus === "ALL" || !filterStatus ? undefined : filterStatus) as any,
    type: (filterType === "ALL" || !filterType ? undefined : filterType) as any,
    from: effectiveFrom,
    to: effectiveTo,
  };

  const { data, isLoading } = useListAgendaEvents(queryParams, {
    query: { queryKey: getListAgendaEventsQueryKey(queryParams) },
  });
  const events: AgendaEvent[] = data?.events ?? [];

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListAgendaEventsQueryKey({ operationId }) });

  // ── Membros da operação (para escolher participantes) ──
  const { data: usersData } = useListUsers({
    query: { queryKey: getListUsersQueryKey() },
  });
  const members = useMemo<{ id: string; name: string }[]>(() => {
    return (usersData?.users ?? [])
      .filter((u: UserModel) => u.status !== "INACTIVE")
      .map((u: UserModel) => ({ id: u.id, name: u.name }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [usersData]);

  const toggleParticipant = (userId: string) =>
    setForm((f) => ({
      ...f,
      participantIds: f.participantIds.includes(userId)
        ? f.participantIds.filter((id) => id !== userId)
        : [...f.participantIds, userId],
    }));

  // ── Mutations ──
  const createMutation = useCreateAgendaEvent();
  const updateMutation = useUpdateAgendaEvent();
  const deleteMutation = useDeleteAgendaEvent();
  const confirmMutation = useConfirmAgendaEvent();
  const suspendMutation = useSuspendAgendaEvent();
  const cancelMutation = useCancelAgendaEvent();
  const completeMutation = useCompleteAgendaEvent();

  // ── Dialog state ──
  const [createOpen, setCreateOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<AgendaEvent | null>(null);
  const [form, setForm] = useState<EventFormState>(emptyForm);
  const [reasonDialog, setReasonDialog] = useState<{ eventId: string; action: "suspend" | "cancel" } | null>(null);
  const [reason, setReason] = useState("");

  const setField =
    (k: keyof EventFormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  // ── Navigation ──
  const prevPeriod = () => {
    setCalendarDate((d) => {
      const n = new Date(d);
      if (viewMode === "month") n.setMonth(n.getMonth() - 1);
      else n.setDate(n.getDate() - 7);
      return n;
    });
  };
  const nextPeriod = () => {
    setCalendarDate((d) => {
      const n = new Date(d);
      if (viewMode === "month") n.setMonth(n.getMonth() + 1);
      else n.setDate(n.getDate() + 7);
      return n;
    });
  };

  const periodLabel =
    viewMode === "month"
      ? calendarDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
      : viewMode === "week"
      ? (() => {
          const start = getWeekStart(calendarDate);
          const end = getWeekEnd(calendarDate);
          return `${start.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} – ${end.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}`;
        })()
      : "";

  // ── Handlers ──
  const handleCreate = () => {
    if (!operationId) { toast({ title: "Nenhuma operação ativa", variant: "destructive" }); return; }
    if (!form.title.trim() || !form.date) { toast({ title: "Título e data são obrigatórios", variant: "destructive" }); return; }
    createMutation.mutate(
      {
        data: {
          operationId, title: form.title.trim(), type: form.type as any, date: form.date,
          endDate: form.endDate || undefined, startTime: form.startTime || undefined,
          endTime: form.endTime || undefined, location: form.location || undefined,
          notes: form.notes || undefined,
          visibility: form.visibility as any,
          participantIds: form.participantIds,
        } as any,
      },
      {
        onSuccess: () => { toast({ title: "Evento criado" }); setCreateOpen(false); setForm(emptyForm); invalidate(); },
        onError: () => toast({ title: "Erro ao criar evento", variant: "destructive" }),
      }
    );
  };

  const handleEdit = () => {
    if (!editEvent) return;
    updateMutation.mutate(
      {
        id: editEvent.id,
        data: {
          title: form.title || undefined, date: form.date || undefined,
          endDate: form.endDate || undefined, startTime: form.startTime || undefined,
          endTime: form.endTime || undefined, location: form.location || undefined,
          notes: form.notes || undefined,
          visibility: form.visibility as any,
          participantIds: form.participantIds,
        } as any,
      },
      {
        onSuccess: () => { toast({ title: "Evento atualizado" }); setEditEvent(null); setForm(emptyForm); invalidate(); },
        onError: (err: any) => toast({ title: err?.response?.data?.error ?? "Erro ao atualizar", variant: "destructive" }),
      }
    );
  };

  const handleConfirm = (id: string) => {
    confirmMutation.mutate({ id }, {
      onSuccess: () => { toast({ title: "Evento confirmado" }); invalidate(); },
      onError: (err: any) => toast({ title: err?.response?.data?.error ?? "Erro ao confirmar", variant: "destructive" }),
    });
  };

  const handleTransitionWithReason = () => {
    if (!reasonDialog || !reason.trim()) { toast({ title: "Motivo obrigatório", variant: "destructive" }); return; }
    const { eventId, action } = reasonDialog;
    const mutation = action === "suspend" ? suspendMutation : cancelMutation;
    mutation.mutate({ id: eventId, data: { reason } }, {
      onSuccess: () => {
        toast({ title: action === "suspend" ? "Evento suspenso" : "Evento cancelado" });
        setReasonDialog(null); setReason(""); invalidate();
      },
      onError: (err: any) => toast({ title: err?.response?.data?.error ?? "Erro", variant: "destructive" }),
    });
  };

  const handleComplete = (id: string) => {
    completeMutation.mutate({ id }, {
      onSuccess: () => { toast({ title: "Evento marcado como realizado" }); invalidate(); },
      onError: (err: any) => toast({ title: err?.response?.data?.error ?? "Erro", variant: "destructive" }),
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm("Confirma a exclusão do evento?")) return;
    deleteMutation.mutate({ id }, {
      onSuccess: () => { toast({ title: "Evento excluído" }); invalidate(); },
      onError: (err: any) => toast({ title: err?.response?.data?.error ?? "Erro ao excluir", variant: "destructive" }),
    });
  };

  const openEdit = (event: AgendaEvent) => {
    setEditEvent(event);
    setForm({
      title: event.title, type: event.type, date: event.date, endDate: event.endDate ?? "",
      startTime: event.startTime ?? "", endTime: event.endTime ?? "",
      location: event.location ?? "", notes: event.notes ?? "",
      visibility: (event.visibility as "OPERATION" | "MANAGEMENT") ?? "OPERATION",
      participantIds: ((event as any).participantIds as string[] | undefined) ?? [],
    });
  };

  const sortedEvents = [...events].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <AdminLayout title="Agenda" subtitle="Apresentações, ensaios e eventos da operação">
      <div className="flex flex-col gap-4">

        {/* ── Toolbar ── */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* View toggle */}
          <div className="flex items-center rounded-lg border bg-card overflow-hidden">
            <button
              onClick={() => setViewMode("list")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors ${
                viewMode === "list"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <List className="h-3.5 w-3.5" />
              Lista
            </button>
            <button
              onClick={() => setViewMode("week")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors border-x ${
                viewMode === "week"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              Semana
            </button>
            <button
              onClick={() => setViewMode("month")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors ${
                viewMode === "month"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Calendar className="h-3.5 w-3.5" />
              Mês
            </button>
          </div>

          {/* Calendar navigation */}
          {viewMode !== "list" && (
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={prevPeriod}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setCalendarDate(new Date())}
              >
                Hoje
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={nextPeriod}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium capitalize ml-1">{periodLabel}</span>
            </div>
          )}

          {/* List filters (only in list mode) */}
          {viewMode === "list" && (
            <>
              <Select value={filterType || "ALL"} onValueChange={(v) => setFilterType(v === "ALL" ? "" : v)}>
                <SelectTrigger className="w-48 h-8 text-sm"><SelectValue placeholder="Tipo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos os tipos</SelectItem>
                  {EVENT_TYPES.map((t) => <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterStatus || "ALL"} onValueChange={(v) => setFilterStatus(v === "ALL" ? "" : v)}>
                <SelectTrigger className="w-44 h-8 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos os status</SelectItem>
                  {["DRAFT", "CONFIRMED", "SUSPENDED", "CANCELLED", "COMPLETED"].map((s) => (
                    <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input type="date" className="w-36 h-8 text-sm" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
              <span className="text-muted-foreground text-xs">até</span>
              <Input type="date" className="w-36 h-8 text-sm" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
              {(filterType || filterStatus || filterFrom || filterTo) && (
                <Button variant="ghost" size="sm" className="h-8" onClick={() => { setFilterType(""); setFilterStatus(""); setFilterFrom(""); setFilterTo(""); }}>
                  Limpar
                </Button>
              )}
            </>
          )}

          <div className="flex-1" />
          {isAdmin && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Novo Evento
            </Button>
          )}
        </div>

        {/* ── Calendar / List view ── */}
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : viewMode === "month" ? (
          events.length === 0 && !isLoading ? (
            <div>
              <MonthCalendar currentDate={calendarDate} events={[]} />
              <p className="text-sm text-muted-foreground text-center mt-4">
                Nenhum evento neste mês.
              </p>
            </div>
          ) : (
            <MonthCalendar currentDate={calendarDate} events={events} />
          )
        ) : viewMode === "week" ? (
          <WeekCalendar currentDate={calendarDate} events={events} />
        ) : sortedEvents.length === 0 ? (
          <AsaEmptyState
            title="Nenhum evento na agenda ainda 🗓️"
            subtitle="Crie o primeiro evento para organizar a programação da operação. Fico ansiosa para ver a agenda cheia!"
            pose="planejando"
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Horário</TableHead>
                <TableHead>Local</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Visibilidade</TableHead>
                {isAdmin && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedEvents.map((event) => (
                <TableRow key={event.id}>
                  <TableCell className="text-sm font-medium">
                    {new Date(event.date + "T12:00:00").toLocaleDateString("pt-BR", {
                      day: "2-digit", month: "short", year: "numeric",
                    })}
                  </TableCell>
                  <TableCell className="text-sm">
                    <div>
                      <span className="font-medium">{event.title}</span>
                      {event.reason && (
                        <p className="text-xs text-muted-foreground truncate max-w-xs">{event.reason}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[event.type] ?? "bg-gray-100 text-gray-800"}`}>
                      {TYPE_LABELS[event.type] ?? event.type}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {event.startTime ? `${event.startTime}${event.endTime ? ` – ${event.endTime}` : ""}` : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{event.location ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANTS[event.status]}>{STATUS_LABELS[event.status]}</Badge>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center gap-1 text-xs ${
                      event.visibility === "MANAGEMENT"
                        ? "text-amber-700 font-medium"
                        : "text-muted-foreground"
                    }`}>
                      {event.visibility === "MANAGEMENT"
                        ? <><EyeOff className="h-3 w-3" /> Gestão</>
                        : <><Eye className="h-3 w-3" /> Operação</>
                      }
                    </span>
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {!["CANCELLED", "COMPLETED"].includes(event.status) && (
                            <DropdownMenuItem onClick={() => openEdit(event)}>
                              <Pencil className="h-3.5 w-3.5 mr-2" /> Editar
                            </DropdownMenuItem>
                          )}
                          {["DRAFT", "SUSPENDED"].includes(event.status) && (
                            <DropdownMenuItem onClick={() => handleConfirm(event.id)}>
                              <CheckCircle className="h-3.5 w-3.5 mr-2 text-green-600" /> Confirmar
                            </DropdownMenuItem>
                          )}
                          {event.status === "CONFIRMED" && (
                            <>
                              <DropdownMenuItem onClick={() => setReasonDialog({ eventId: event.id, action: "suspend" })}>
                                <PauseCircle className="h-3.5 w-3.5 mr-2 text-amber-600" /> Suspender
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleComplete(event.id)}>
                                <Flag className="h-3.5 w-3.5 mr-2 text-blue-600" /> Marcar como realizado
                              </DropdownMenuItem>
                            </>
                          )}
                          {!["CANCELLED", "COMPLETED"].includes(event.status) && (
                            <DropdownMenuItem
                              onClick={() => setReasonDialog({ eventId: event.id, action: "cancel" })}
                              className="text-destructive"
                            >
                              <XCircle className="h-3.5 w-3.5 mr-2" /> Cancelar
                            </DropdownMenuItem>
                          )}
                          {event.status === "DRAFT" && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleDelete(event.id)} className="text-destructive">
                                <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Dialog: criar evento */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Novo Evento</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Título *</Label>
              <Input value={form.title} onChange={setField("title")} placeholder="Nome do evento" />
            </div>
            <div>
              <Label>Tipo *</Label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((t) => <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data *</Label>
              <Input type="date" value={form.date} onChange={setField("date")} />
            </div>
            <div>
              <Label>Horário início</Label>
              <Input type="time" value={form.startTime} onChange={setField("startTime")} />
            </div>
            <div>
              <Label>Horário fim</Label>
              <Input type="time" value={form.endTime} onChange={setField("endTime")} />
            </div>
            <div className="col-span-2">
              <Label>Local</Label>
              <Input value={form.location} onChange={setField("location")} placeholder="Ex: Teatro Principal" />
            </div>
            <div className="col-span-2">
              <Label>Notas</Label>
              <Textarea value={form.notes} onChange={setField("notes")} placeholder="Informações adicionais" rows={2} />
            </div>
            <div className="col-span-2">
              <Label>Visibilidade</Label>
              <Select
                value={form.visibility}
                onValueChange={(v) => setForm((f) => ({ ...f, visibility: v as "OPERATION" | "MANAGEMENT" }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OPERATION">
                    <span className="flex items-center gap-2">
                      <Eye className="h-3.5 w-3.5" />
                      {VISIBILITY_LABELS.OPERATION}
                    </span>
                  </SelectItem>
                  <SelectItem value="MANAGEMENT">
                    <span className="flex items-center gap-2">
                      <EyeOff className="h-3.5 w-3.5" />
                      {VISIBILITY_LABELS.MANAGEMENT}
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {form.visibility === "MANAGEMENT"
                  ? "Apenas supervisores e administradores verão este evento."
                  : "Todos os membros da operação poderão ver este evento."}
              </p>
            </div>
            <div className="col-span-2">
              <div className="flex items-center justify-between">
                <Label>Participantes</Label>
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      participantIds:
                        f.participantIds.length === members.length ? [] : members.map((m) => m.id),
                    }))
                  }
                >
                  {form.participantIds.length === members.length && members.length > 0
                    ? "Limpar"
                    : "Selecionar todos"}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mb-1.5">
                Quem você marcar aqui aparece automaticamente na Escala Semanal.
              </p>
              <div className="max-h-40 overflow-y-auto rounded-lg border p-2 space-y-0.5">
                {members.length === 0 && (
                  <p className="text-xs text-muted-foreground py-1">Nenhum membro disponível.</p>
                )}
                {members.map((m) => (
                  <label
                    key={m.id}
                    className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-muted cursor-pointer text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={form.participantIds.includes(m.id)}
                      onChange={() => toggleParticipant(m.id)}
                    />
                    <span className="truncate">{m.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>Criar Evento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: editar evento */}
      <Dialog open={!!editEvent} onOpenChange={(o) => { if (!o) { setEditEvent(null); setForm(emptyForm); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Editar Evento</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Título</Label>
              <Input value={form.title} onChange={setField("title")} />
            </div>
            <div>
              <Label>Data</Label>
              <Input type="date" value={form.date} onChange={setField("date")} />
            </div>
            <div>
              <Label>Data fim</Label>
              <Input type="date" value={form.endDate} onChange={setField("endDate")} />
            </div>
            <div>
              <Label>Horário início</Label>
              <Input type="time" value={form.startTime} onChange={setField("startTime")} />
            </div>
            <div>
              <Label>Horário fim</Label>
              <Input type="time" value={form.endTime} onChange={setField("endTime")} />
            </div>
            <div className="col-span-2">
              <Label>Local</Label>
              <Input value={form.location} onChange={setField("location")} />
            </div>
            <div className="col-span-2">
              <Label>Notas</Label>
              <Textarea value={form.notes} onChange={setField("notes")} rows={2} />
            </div>
            <div className="col-span-2">
              <Label>Visibilidade</Label>
              <Select
                value={form.visibility}
                onValueChange={(v) => setForm((f) => ({ ...f, visibility: v as "OPERATION" | "MANAGEMENT" }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OPERATION">
                    <span className="flex items-center gap-2">
                      <Eye className="h-3.5 w-3.5" />
                      {VISIBILITY_LABELS.OPERATION}
                    </span>
                  </SelectItem>
                  <SelectItem value="MANAGEMENT">
                    <span className="flex items-center gap-2">
                      <EyeOff className="h-3.5 w-3.5" />
                      {VISIBILITY_LABELS.MANAGEMENT}
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {form.visibility === "MANAGEMENT"
                  ? "Apenas supervisores e administradores verão este evento."
                  : "Todos os membros da operação poderão ver este evento."}
              </p>
            </div>
            <div className="col-span-2">
              <div className="flex items-center justify-between">
                <Label>Participantes</Label>
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      participantIds:
                        f.participantIds.length === members.length ? [] : members.map((m) => m.id),
                    }))
                  }
                >
                  {form.participantIds.length === members.length && members.length > 0
                    ? "Limpar"
                    : "Selecionar todos"}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mb-1.5">
                Quem você marcar aqui aparece automaticamente na Escala Semanal.
              </p>
              <div className="max-h-40 overflow-y-auto rounded-lg border p-2 space-y-0.5">
                {members.length === 0 && (
                  <p className="text-xs text-muted-foreground py-1">Nenhum membro disponível.</p>
                )}
                {members.map((m) => (
                  <label
                    key={m.id}
                    className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-muted cursor-pointer text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={form.participantIds.includes(m.id)}
                      onChange={() => toggleParticipant(m.id)}
                    />
                    <span className="truncate">{m.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditEvent(null); setForm(emptyForm); }}>Cancelar</Button>
            <Button onClick={handleEdit} disabled={updateMutation.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: motivo */}
      <Dialog open={!!reasonDialog} onOpenChange={(o) => { if (!o) { setReasonDialog(null); setReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reasonDialog?.action === "suspend" ? "Suspender Evento" : "Cancelar Evento"}
            </DialogTitle>
          </DialogHeader>
          <div>
            <Label>Motivo *</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Descreva o motivo" rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setReasonDialog(null); setReason(""); }}>Cancelar</Button>
            <Button
              variant={reasonDialog?.action === "cancel" ? "destructive" : "default"}
              onClick={handleTransitionWithReason}
              disabled={suspendMutation.isPending || cancelMutation.isPending}
            >
              {reasonDialog?.action === "suspend" ? "Suspender" : "Cancelar Evento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
