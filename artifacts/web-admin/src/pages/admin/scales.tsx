import { useState, useMemo, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListScales,
  useGetOperations,
  useListScaleAllocations,
  useListFolgas,
  useListUsers,
  useCreateScaleEntry,
  useDeleteScaleEntry,
  usePublishScale,
  useRepublishScale,
  useRegenerateScale,
  useCreateWeekScale,
  useDeleteScale,
  useSetPublishDeadline,
  useDuplicatePreviousWeek,
  useGetScaleHistory,
  useListScaleExceptions,
  useListTasks,
  getListScalesQueryKey,
  getListScaleAllocationsQueryKey,
  getListFolgasQueryKey,
  getListUsersQueryKey,
  getScaleHistoryQueryKey,
  getListScaleExceptionsQueryKey,
  getListTasksQueryKey,
  useListAgendaEvents,
  getListAgendaEventsQueryKey,
  useListResponsibilities,
  getListResponsibilitiesQueryKey,
} from "@workspace/api-client-react";
import type {
  ScaleSummary,
  ScaleAllocationWithCandidates,
  User as UserModel,
  Operation,
  FolgaItem,
  AgendaEvent,
  TaskItem,
  ResponsibilityItem,
} from "@workspace/api-client-react";
import AdminLayout from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  Plus, Send, AlertTriangle, ChevronLeft, ChevronRight, ChevronRight as ChevR,
  History, ShieldCheck, Trash2, Copy, Clock, Zap, X, CalendarRange,
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Rascunho", PUBLISHED: "Publicada", REPUBLISHED: "Republicada", ARCHIVED: "Arquivada",
};
const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  DRAFT: "secondary", PUBLISHED: "default", REPUBLISHED: "default", ARCHIVED: "outline",
};
const FOLGA_LABELS: Record<string, string> = {
  DAY_OFF: "FOLGA", NO_SHOW: "FOLGA", RECESSO: "RECESSO",
  AFASTAMENTO: "AFASTAMENTO", RESTRICAO: "RESTRIÇÃO", OUTRO: "OUTRO",
};
const AGENDA_TYPE_LABELS: Record<string, string> = {
  SHOW: "Show", REHEARSAL: "Ensaio", MEETING: "Reunião",
  OPERATIONAL_BLOCK: "Bloqueio", COLLECTIVE_VACATION: "Férias coletivas",
};
const MONTHS = [
  "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO",
  "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO",
];
const YEARS = [2025, 2026, 2027];
const AVATAR_COLORS = [
  "#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#3b82f6",
];

// ─── Date helpers ───────────────────────────────────────────────────────────

function parseDate(d: string): Date {
  return new Date(d + "T12:00:00");
}
function toISO(dt: Date): string {
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function addDays(d: string, n: number): string {
  const dt = parseDate(d);
  dt.setDate(dt.getDate() + n);
  return toISO(dt);
}
// Thursday that starts the Thu→Wed week containing `d`.
function thursdayOf(d: string): string {
  const dt = parseDate(d);
  const offset = (dt.getDay() - 4 + 7) % 7; // 4 = Thursday
  dt.setDate(dt.getDate() - offset);
  return toISO(dt);
}
function buildDateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const s = parseDate(start);
  const e = parseDate(end);
  while (s <= e) {
    dates.push(toISO(s));
    s.setDate(s.getDate() + 1);
  }
  return dates;
}
function fmtDDMM(d: string): string {
  const dt = parseDate(d);
  return `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}`;
}
function fmtWeekdayLong(d: string): string {
  return parseDate(d).toLocaleDateString("pt-BR", { weekday: "long" });
}
function fmtFullDate(d: string): string {
  return parseDate(d).toLocaleDateString("pt-BR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}
function fmtDayCard(d: string) {
  const dt = parseDate(d);
  return {
    wd: dt.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "").slice(0, 3).toUpperCase(),
    day: dt.getDate(),
    mon: dt.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
  };
}
function fmtTime(t?: string | null) {
  if (!t) return "";
  return t.slice(0, 5);
}

// ─── Tempo livre (deteção de buracos) ───────────────────────────────────────
// O "dia de trabalho" de cada pessoa vai da PRIMEIRA até a ÚLTIMA atividade dela
// nesse dia (como num check-in/check-out) — não há janela fixa. Tempo livre são
// só os buracos ENTRE atividades. MANTER EM SINCRONIA com o backend
// (artifacts/api-server/src/services/scale-merge.ts).
const MIN_FREE_GAP_MIN = 60; // só sugerir buracos de pelo menos 1 hora

function hhmmToMin(t?: string | null): number | null {
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(t);
  if (!m) return null;
  return parseInt(m[1]!, 10) * 60 + parseInt(m[2]!, 10);
}
function minToHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

interface FreeGap {
  start: string; // HH:MM
  end: string; // HH:MM
}

// Calcula os intervalos livres de um membro num dia ENTRE a primeira e a última
// atividade dele, a partir dos blocos que têm hora de início e fim.
function computeFreeGaps(
  entries: ScaleAllocationWithCandidates[]
): FreeGap[] {
  const intervals: { s: number; e: number }[] = [];
  for (const e of entries) {
    const s = hhmmToMin((e as any).startTime ?? (e as any).eventStartTime);
    const en = hhmmToMin((e as any).endTime ?? (e as any).eventEndTime);
    // Se um bloco não tem horário, não dá para saber o tempo realmente livre:
    // ocultamos as sugestões para não induzir preenchimento indevido.
    if (s == null || en == null) return [];
    if (en > s) intervals.push({ s, e: en });
  }
  if (intervals.length === 0) return [];
  intervals.sort((a, b) => a.s - b.s);
  // Merge sobrepostos
  const merged: { s: number; e: number }[] = [];
  for (const iv of intervals) {
    const last = merged[merged.length - 1];
    if (last && iv.s <= last.e) last.e = Math.max(last.e, iv.e);
    else merged.push({ ...iv });
  }
  // Buracos só ENTRE atividades (da 1ª à última); fora desse intervalo não conta.
  const gaps: FreeGap[] = [];
  for (let i = 1; i < merged.length; i++) {
    const gapStart = merged[i - 1]!.e;
    const gapEnd = merged[i]!.s;
    if (gapEnd - gapStart >= MIN_FREE_GAP_MIN) {
      gaps.push({ start: minToHHMM(gapStart), end: minToHHMM(gapEnd) });
    }
  }
  return gaps;
}
function fmtDateTime(d: string): string {
  return new Date(d).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}
function colorFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length]!;
}

// ─── Derived types ────────────────────────────────────────────────────────────

interface WeekRow {
  key: string;       // thursday ISO
  periodStart: string;
  periodEnd: string;
  monthIdx: number;
  scales: ScaleSummary[];
}

interface AddEntryFormState {
  memberId: string;
  memberName: string;
  date: string;
  label: string;
  startTime: string;
  endTime: string;
  notes: string;
  force: boolean;
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function InitialsAvatar({ id, name, dim = false }: { id: string; name: string; dim?: boolean }) {
  return (
    <div
      className="flex items-center justify-center rounded-full text-white text-sm font-bold"
      style={{ width: 40, height: 40, backgroundColor: colorFor(id), opacity: dim ? 0.4 : 1 }}
    >
      {initials(name)}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ScalesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const auth = useAuth();
  const isManager = auth.roles.some((r) =>
    ["ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"].includes(r.role)
  );

  const [year, setYear] = useState<number>(2026);
  const [opTab, setOpTab] = useState<string>("all");
  const [view, setView] = useState<"list" | "detail">("list");
  const [selectedScale, setSelectedScale] = useState<ScaleSummary | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const [showAddEntry, setShowAddEntry] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showHealth, setShowHealth] = useState(false);
  const [showDeadline, setShowDeadline] = useState(false);
  const [deadlineValue, setDeadlineValue] = useState<string>("");
  const [addEntryForm, setAddEntryForm] = useState<AddEntryFormState>({
    memberId: "", memberName: "", date: "", label: "", startTime: "", endTime: "", notes: "", force: false,
  });
  const [showAddAgenda, setShowAddAgenda] = useState(false);
  const [agendaEventId, setAgendaEventId] = useState<string>("");
  const [agendaMemberIds, setAgendaMemberIds] = useState<Set<string>>(new Set());
  const [freeSlot, setFreeSlot] = useState<{
    memberId: string;
    memberName: string;
    date: string;
    start: string;
    end: string;
  } | null>(null);

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: opsData } = useGetOperations();
  const operations = useMemo<Operation[]>(() => opsData?.operations ?? [], [opsData]);

  const { data: scalesData, isLoading: scalesLoading } = useListScales(undefined as any, {
    query: { queryKey: getListScalesQueryKey() },
  });

  const { data: usersData } = useListUsers({
    query: { queryKey: getListUsersQueryKey() },
  });

  const { data: allocationsData } = useListScaleAllocations(
    selectedScale?.id ?? "",
    {
      query: {
        queryKey: getListScaleAllocationsQueryKey(selectedScale?.id ?? ""),
        enabled: !!selectedScale?.id,
      },
    }
  );

  const folgasEnabled = view === "detail" && !!selectedScale;
  const folgasParams = {
    operationId: selectedScale?.operationId,
    dateFrom: selectedScale?.periodStart,
    dateTo: selectedScale?.periodEnd,
    status: "ACTIVE" as any,
  };
  const { data: folgasData } = useListFolgas(folgasParams as any, {
    query: { queryKey: getListFolgasQueryKey(folgasParams as any), enabled: folgasEnabled },
  });

  const agendaParams = {
    operationId: selectedScale?.operationId,
    from: selectedScale?.periodStart,
    to: selectedScale?.periodEnd,
  };
  const { data: agendaData } = useListAgendaEvents(agendaParams as any, {
    query: { queryKey: getListAgendaEventsQueryKey(agendaParams as any), enabled: folgasEnabled },
  });
  const agendaEvents = useMemo<AgendaEvent[]>(
    () => (agendaData?.events ?? []) as AgendaEvent[],
    [agendaData]
  );

  const { data: historyData, isLoading: historyLoading } = useGetScaleHistory(
    selectedScale?.id ?? "",
    { query: { enabled: showHistory && !!selectedScale?.id } }
  );

  const { data: exceptionsData, isLoading: exceptionsLoading } = useListScaleExceptions(
    selectedScale?.id ?? "",
    {
      query: {
        queryKey: getListScaleExceptionsQueryKey(selectedScale?.id ?? ""),
        enabled: showHealth && !!selectedScale?.id,
      },
    }
  );

  // Tarefas pendentes da operação, para sugerir no tempo livre.
  const tasksParams = {
    operationId: selectedScale?.operationId,
    status: "CREATED,IN_PROGRESS",
  };
  const { data: tasksData } = useListTasks(tasksParams as any, {
    query: {
      queryKey: getListTasksQueryKey(tasksParams as any),
      enabled: folgasEnabled && !!selectedScale?.operationId,
    },
  });

  // Responsabilidades da operação, para sugerir no tempo livre.
  const respParams = { operationId: selectedScale?.operationId };
  const { data: respData } = useListResponsibilities(respParams, {
    query: {
      enabled: folgasEnabled && !!selectedScale?.operationId,
    },
  });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const createWeekMut = useCreateWeekScale();
  const publishMut = usePublishScale();
  const republishMut = useRepublishScale();
  const regenerateMut = useRegenerateScale();
  const deleteScaleMut = useDeleteScale();
  const deadlineMut = useSetPublishDeadline();
  const duplicateMut = useDuplicatePreviousWeek();
  const createEntryMut = useCreateScaleEntry();
  const deleteEntryMut = useDeleteScaleEntry();

  function invalidateScales() {
    queryClient.invalidateQueries({ queryKey: getListScalesQueryKey() });
  }
  function invalidateAllocations() {
    if (selectedScale?.id) {
      queryClient.invalidateQueries({ queryKey: getListScaleAllocationsQueryKey(selectedScale.id) });
    }
  }

  // ── Derived: operation name map ──────────────────────────────────────────
  const opName = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of operations) m.set(o.id, o.name);
    return m;
  }, [operations]);

  // ── Derived: scales filtered by year + tab, grouped into weeks ───────────
  const allScales = useMemo(() => scalesData?.scales ?? [], [scalesData]);

  // Keep the open scale's summary (coverage counts/status) in sync with the
  // refreshed backend list after regenerate / manual entry / publish actions.
  useEffect(() => {
    if (!selectedScale) return;
    const fresh = allScales.find((s) => s.id === selectedScale.id);
    if (!fresh) return;
    if (
      fresh.status !== selectedScale.status ||
      fresh.assignedCount !== selectedScale.assignedCount ||
      fresh.openCount !== selectedScale.openCount ||
      fresh.conflictCount !== selectedScale.conflictCount ||
      fresh.exceptionCount !== selectedScale.exceptionCount ||
      fresh.totalAllocations !== selectedScale.totalAllocations
    ) {
      setSelectedScale(fresh);
    }
  }, [allScales, selectedScale]);

  const weeksByMonth = useMemo(() => {
    // Index existing scales by their week's Thursday (filtered by year + op tab).
    const scalesByThu = new Map<string, ScaleSummary[]>();
    for (const s of allScales) {
      if (s.status === "ARCHIVED") continue;
      if (opTab !== "all" && s.operationId !== opTab) continue;
      const thu = thursdayOf(s.periodStart);
      if (parseDate(thu).getFullYear() !== year) continue;
      const list = scalesByThu.get(thu) ?? [];
      list.push(s);
      scalesByThu.set(thu, list);
    }

    // Build the FULL year matrix of weeks (Thu→Wed), independent of whether a
    // scale already exists — so "+ OPERAÇÃO" works on any week of the year.
    const weeks = new Map<string, WeekRow>();
    let cursor = thursdayOf(`${year}-01-01`);
    if (parseDate(cursor).getFullYear() < year) cursor = addDays(cursor, 7);
    while (parseDate(cursor).getFullYear() === year) {
      weeks.set(cursor, {
        key: cursor,
        periodStart: cursor,
        periodEnd: addDays(cursor, 6),
        monthIdx: parseDate(cursor).getMonth(),
        scales: scalesByThu.get(cursor) ?? [],
      });
      cursor = addDays(cursor, 7);
    }

    const byMonth = new Map<number, WeekRow[]>();
    for (const w of weeks.values()) {
      if (!byMonth.has(w.monthIdx)) byMonth.set(w.monthIdx, []);
      byMonth.get(w.monthIdx)!.push(w);
    }
    for (const list of byMonth.values()) {
      list.sort((a, b) => a.key.localeCompare(b.key));
    }
    return byMonth;
  }, [allScales, year, opTab]);

  const registeredWeeks = useMemo(() => {
    let n = 0;
    for (const list of weeksByMonth.values()) {
      n += list.filter((w) => w.scales.length > 0).length;
    }
    return n;
  }, [weeksByMonth]);

  const multiOpWeeks = useMemo(() => {
    let n = 0;
    for (const list of weeksByMonth.values()) {
      for (const w of list) {
        const ops = new Set(w.scales.map((s) => s.operationId));
        if (ops.size > 1) n++;
      }
    }
    return n;
  }, [weeksByMonth]);

  // ── Derived: members ────────────────────────────────────────────────────
  // Apenas membros escaláveis (Performers comuns) figuram nas escalas:
  // administradores (isAdmin) e membros especiais (specialization != PERFORMER)
  // são excluídos, em consonância com o filtro do servidor.
  const members = useMemo<{ userId: string; userName: string }[]>(() => {
    const opId = selectedScale?.operationId;
    return (usersData?.users ?? [])
      .filter((u: UserModel) => u.status !== "INACTIVE")
      .filter((u: UserModel) => {
        const isAdmin = (u as { isAdmin?: boolean }).isAdmin === true;
        const spec = u.specialization;
        const isSpecial = spec != null && spec !== "PERFORMER";
        return !isAdmin && !isSpecial;
      })
      .filter((u: UserModel) => {
        if (!opId) return true;
        const opIds = (u as { operationIds?: string[] }).operationIds;
        return Array.isArray(opIds) && opIds.includes(opId);
      })
      .map((u: UserModel) => ({ userId: u.id, userName: u.name }))
      .sort((a, b) => a.userName.localeCompare(b.userName, "pt-BR"));
  }, [usersData, selectedScale]);

  // ── Derived: allocations / manual entries ────────────────────────────────
  const allocations = useMemo(() => allocationsData?.allocations ?? [], [allocationsData]);

  // date → userId → entries[]
  const entriesByDateMember = useMemo(() => {
    const result = new Map<string, Map<string, ScaleAllocationWithCandidates[]>>();
    for (const a of allocations) {
      if (!a.userId) continue;
      const date = ((a as any).manualDate ?? (a as any).eventDate) as string | null;
      if (!date) continue;
      if (!result.has(date)) result.set(date, new Map());
      const byMember = result.get(date)!;
      if (!byMember.has(a.userId)) byMember.set(a.userId, []);
      byMember.get(a.userId)!.push(a);
    }
    return result;
  }, [allocations]);

  const entriesCountByDate = useMemo(() => {
    const m = new Map<string, number>();
    for (const [date, byMember] of entriesByDateMember) {
      let c = 0;
      for (const list of byMember.values()) c += list.length;
      m.set(date, c);
    }
    return m;
  }, [entriesByDateMember]);

  // userId → responsabilidades activas (para sugerir no tempo livre)
  const responsibilitiesByMember = useMemo(() => {
    const m = new Map<string, ResponsibilityItem[]>();
    for (const r of (respData?.responsibilities ?? []) as ResponsibilityItem[]) {
      for (const a of r.assignments) {
        if (!a.active) continue;
        if (!m.has(a.memberId)) m.set(a.memberId, []);
        m.get(a.memberId)!.push(r);
      }
    }
    return m;
  }, [respData]);

  // userId → tarefas pendentes (para sugerir no tempo livre)
  const pendingTasksByMember = useMemo(() => {
    const m = new Map<string, TaskItem[]>();
    for (const t of (tasksData?.tasks ?? []) as TaskItem[]) {
      if (!t.assigneeId) continue;
      if (!m.has(t.assigneeId)) m.set(t.assigneeId, []);
      m.get(t.assigneeId)!.push(t);
    }
    for (const list of m.values()) {
      list.sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));
    }
    return m;
  }, [tasksData]);

  // date → userId → folgaType
  const folgaByDateMember = useMemo(() => {
    const result = new Map<string, Map<string, string>>();
    for (const f of ((folgasData as any)?.folgas ?? []) as FolgaItem[]) {
      if (f.status !== "ACTIVE" || !f.startDate || !f.endDate) continue;
      const dates = buildDateRange(
        String(f.startDate).slice(0, 10),
        String(f.endDate).slice(0, 10)
      );
      for (const d of dates) {
        if (!result.has(d)) result.set(d, new Map());
        result.get(d)!.set(String(f.userId), String(f.type));
      }
    }
    return result;
  }, [folgasData]);

  const unavailableCountByDate = useMemo(() => {
    const m = new Map<string, number>();
    for (const [date, byMember] of folgaByDateMember) m.set(date, byMember.size);
    return m;
  }, [folgaByDateMember]);

  const totalEntries = useMemo(() => {
    let n = 0;
    for (const c of entriesCountByDate.values()) n += c;
    return n;
  }, [entriesCountByDate]);

  // ── Navigation handlers ──────────────────────────────────────────────────
  function openScale(scale: ScaleSummary) {
    setSelectedScale(scale);
    setSelectedDay(scale.periodStart);
    setView("detail");
  }
  function backToList() {
    setView("list");
    setSelectedScale(null);
    setSelectedDay(null);
  }

  const adjacentScale = (deltaWeeks: number): ScaleSummary | null => {
    if (!selectedScale) return null;
    const targetThu = addDays(thursdayOf(selectedScale.periodStart), deltaWeeks * 7);
    return (
      allScales.find(
        (s) =>
          s.operationId === selectedScale.operationId &&
          thursdayOf(s.periodStart) === targetThu &&
          s.status !== "ARCHIVED"
      ) ?? null
    );
  };
  const prevScale = useMemo(() => adjacentScale(-1), [selectedScale, allScales]);
  const nextScale = useMemo(() => adjacentScale(1), [selectedScale, allScales]);

  // ── Action handlers ──────────────────────────────────────────────────────
  async function handleCreateWeek(operationId: string, week: WeekRow) {
    try {
      const res = await createWeekMut.mutateAsync({
        operationId,
        periodStart: week.periodStart,
        periodEnd: week.periodEnd,
        title: `Semana ${fmtDDMM(week.periodStart)}`,
      });
      toast({ title: "Escala criada" });
      invalidateScales();
      const newScale: ScaleSummary = {
        id: res.scale.id,
        operationId,
        title: `Semana ${fmtDDMM(week.periodStart)}`,
        periodStart: week.periodStart,
        periodEnd: week.periodEnd,
        status: "DRAFT" as any,
        totalAllocations: 0, assignedCount: 0, openCount: 0,
        conflictCount: 0, exceptionCount: 0,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      };
      openScale(newScale);
    } catch (e: any) {
      toast({ title: e?.message ?? "Erro ao criar escala", variant: "destructive" });
    }
  }

  async function handlePublish() {
    if (!selectedScale?.id) return;
    try {
      const isDraft = selectedScale.status === "DRAFT";
      if (isDraft) await publishMut.mutateAsync({ id: selectedScale.id });
      else await republishMut.mutateAsync({ id: selectedScale.id });
      toast({ title: isDraft ? "Escala publicada" : "Escala republicada" });
      invalidateScales();
      setSelectedScale({
        ...selectedScale,
        status: (isDraft ? "PUBLISHED" : "REPUBLISHED") as any,
      });
    } catch { toast({ title: "Erro ao publicar", variant: "destructive" }); }
  }

  async function handleDeleteScale() {
    if (!selectedScale?.id) return;
    try {
      await deleteScaleMut.mutateAsync({ scaleId: selectedScale.id });
      toast({ title: "Rascunho deletado" });
      invalidateScales();
      backToList();
    } catch (e: any) {
      toast({ title: e?.message ?? "Erro ao deletar", variant: "destructive" });
    }
  }

  async function handleDuplicate() {
    if (!selectedScale?.id) return;
    try {
      const res = await duplicateMut.mutateAsync({ scaleId: selectedScale.id });
      toast({
        title: "Semana anterior duplicada",
        description: `${res.copied} entrada(s) copiada(s).`,
      });
      invalidateAllocations();
    } catch (e: any) {
      toast({ title: e?.message ?? "Nenhuma semana anterior encontrada", variant: "destructive" });
    }
  }

  async function handleSaveDeadline() {
    if (!selectedScale?.id) return;
    try {
      await deadlineMut.mutateAsync({
        scaleId: selectedScale.id,
        publishDeadline: deadlineValue ? new Date(deadlineValue).toISOString() : null,
      });
      toast({ title: deadlineValue ? "Prazo definido" : "Prazo removido" });
      invalidateScales();
      setShowDeadline(false);
    } catch { toast({ title: "Erro ao definir prazo", variant: "destructive" }); }
  }

  async function handleRegenerate() {
    if (!selectedScale?.id) return;
    try {
      const result = await regenerateMut.mutateAsync({ id: selectedScale.id });
      toast({
        title: "Auto-gerado",
        description:
          result.engine.totalPositions === 0
            ? "Nenhuma cobertura automática disponível para esta semana. Continue manualmente."
            : `${result.engine.assignedPositions}/${result.engine.totalPositions} posições alocadas.`,
      });
      invalidateAllocations();
      invalidateScales();
    } catch { toast({ title: "Erro ao gerar automaticamente", variant: "destructive" }); }
  }

  function openAddEntry(memberId: string, memberName: string, date: string, force = false) {
    setAddEntryForm({ memberId, memberName, date, label: "", startTime: "", endTime: "", notes: "", force });
    setShowAddEntry(true);
  }

  async function handleAddEntry() {
    if (!selectedScale?.id || !addEntryForm.memberId || !addEntryForm.date || !addEntryForm.label) return;
    try {
      await createEntryMut.mutateAsync({
        scaleId: selectedScale.id,
        memberId: addEntryForm.memberId,
        date: addEntryForm.date,
        label: addEntryForm.label,
        startTime: addEntryForm.startTime || undefined,
        endTime: addEntryForm.endTime || undefined,
        notes: addEntryForm.notes || undefined,
      } as any);
      toast({ title: "Entrada adicionada" });
      invalidateAllocations();
      setShowAddEntry(false);
    } catch (e: any) {
      toast({ title: e?.message ?? "Erro ao adicionar entrada", variant: "destructive" });
    }
  }

  async function handleFillFreeSlot(label: string, notes?: string) {
    if (!selectedScale?.id || !freeSlot) return;
    try {
      await createEntryMut.mutateAsync({
        scaleId: selectedScale.id,
        memberId: freeSlot.memberId,
        date: freeSlot.date,
        label,
        startTime: freeSlot.start || undefined,
        endTime: freeSlot.end || undefined,
        notes: notes || undefined,
      } as any);
      toast({ title: "Tempo livre preenchido" });
      invalidateAllocations();
      setFreeSlot(null);
    } catch (e: any) {
      toast({ title: e?.message ?? "Erro ao preencher tempo livre", variant: "destructive" });
    }
  }

  function openAddFromAgenda() {
    setAgendaEventId("");
    setAgendaMemberIds(new Set());
    setShowAddAgenda(true);
  }
  function toggleAgendaMember(memberId: string) {
    setAgendaMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
  }
  async function handleAddFromAgenda() {
    if (!selectedScale?.id || !agendaEventId || agendaMemberIds.size === 0) return;
    const ev = agendaEvents.find((e) => e.id === agendaEventId);
    if (!ev) return;
    try {
      for (const memberId of agendaMemberIds) {
        await createEntryMut.mutateAsync({
          scaleId: selectedScale.id,
          memberId,
          date: ev.date,
          label: ev.title,
          startTime: ev.startTime || undefined,
          endTime: ev.endTime || undefined,
          notes: ev.location || undefined,
        } as any);
      }
      toast({ title: `Atividade adicionada para ${agendaMemberIds.size} pessoa(s)` });
      invalidateAllocations();
      setShowAddAgenda(false);
    } catch (e: any) {
      toast({ title: e?.message ?? "Erro ao adicionar da agenda", variant: "destructive" });
    }
  }

  async function handleDeleteEntry(entryId: string) {
    if (!selectedScale?.id) return;
    try {
      await deleteEntryMut.mutateAsync({ scaleId: selectedScale.id, entryId } as any);
      toast({ title: "Entrada removida" });
      invalidateAllocations();
    } catch (e: any) {
      toast({ title: e?.message ?? "Erro ao remover entrada", variant: "destructive" });
    }
  }

  // ── Render: List view ────────────────────────────────────────────────────
  if (view === "list") {
    const tabLabel = opTab === "all" ? "todas as operações" : (opName.get(opTab) ?? "operação");
    return (
      <AdminLayout title="Escalas" subtitle={`${registeredWeeks} semana(s) cadastrada(s) · ${tabLabel}`}>
        {/* Year selector */}
        <div className="flex items-center justify-end gap-1 mb-4">
          {YEARS.map((y) => (
            <Button
              key={y}
              variant={y === year ? "default" : "outline"}
              size="sm"
              onClick={() => setYear(y)}
            >
              {y}
            </Button>
          ))}
        </div>

        {/* Operation tabs */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <Button
            variant={opTab === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setOpTab("all")}
          >
            Todas
          </Button>
          {operations.map((o) => (
            <Button
              key={o.id}
              variant={opTab === o.id ? "default" : "outline"}
              size="sm"
              onClick={() => setOpTab(o.id)}
            >
              <span
                className="inline-block w-2 h-2 rounded-full mr-2"
                style={{ backgroundColor: colorFor(o.id) }}
              />
              {o.name}
            </Button>
          ))}
        </div>

        {/* Multi-op banner */}
        {opTab === "all" && (
          <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 mb-6 text-sm text-muted-foreground">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-500" />
            <p>
              Mostrando escalas de todas as operações.{" "}
              {multiOpWeeks > 0 && (
                <span className="text-amber-600 font-medium">
                  {multiOpWeeks} semana(s) com escalas em múltiplas operações.
                </span>
              )}{" "}
              Para criar uma escala, selecione uma operação acima.
            </p>
          </div>
        )}

        {scalesLoading ? (
          <p className="text-muted-foreground">Carregando...</p>
        ) : (
          <div className="space-y-1">
            {MONTHS.map((monthName, idx) => {
              const weeks = weeksByMonth.get(idx) ?? [];
              return (
                <div key={monthName}>
                  <h3 className="text-xs font-semibold tracking-widest text-muted-foreground mt-6 mb-2">
                    {monthName}
                  </h3>
                  {weeks.map((week) => (
                    <WeekRowItem
                      key={week.key}
                      week={week}
                      opTab={opTab}
                      operations={operations}
                      opName={opName}
                      onOpenScale={openScale}
                      onCreate={handleCreateWeek}
                      creating={createWeekMut.isPending}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </AdminLayout>
    );
  }

  // ── Render: Detail view ──────────────────────────────────────────────────
  if (!selectedScale) {
    backToList();
    return null;
  }

  const weekDays = buildDateRange(selectedScale.periodStart, selectedScale.periodEnd);
  const status = selectedScale.status as string;
  const isDraft = status === "DRAFT";

  const daySelected = selectedDay ?? selectedScale.periodStart;
  const dayFolgas = folgaByDateMember.get(daySelected) ?? new Map<string, string>();
  const dayEntries = entriesByDateMember.get(daySelected) ?? new Map<string, ScaleAllocationWithCandidates[]>();
  const dayUnavailable = dayFolgas.size;
  const dayEntryCount = entriesCountByDate.get(daySelected) ?? 0;

  return (
    <AdminLayout title="Escalas">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" size="sm" onClick={backToList}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Escalas
        </Button>
        <div className="flex items-center gap-2 text-sm">
          <Button
            variant="outline" size="sm"
            disabled={!prevScale}
            onClick={() => prevScale && openScale(prevScale)}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            {fmtDDMM(addDays(thursdayOf(selectedScale.periodStart), -7))}
          </Button>
          <span className="text-muted-foreground px-1">
            {fmtDDMM(selectedScale.periodStart)} – {fmtDDMM(selectedScale.periodEnd)}
          </span>
          <Button
            variant="outline" size="sm"
            disabled={!nextScale}
            onClick={() => nextScale && openScale(nextScale)}
          >
            {fmtDDMM(addDays(thursdayOf(selectedScale.periodStart), 7))}
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>

      {/* Title + actions */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-2">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-serif font-bold">
              Escala {fmtDDMM(selectedScale.periodStart)} a {fmtDDMM(selectedScale.periodEnd)}
            </h2>
            <Badge variant={STATUS_VARIANTS[status] ?? "secondary"}>
              {STATUS_LABELS[status] ?? status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1 capitalize">
            {fmtFullDate(selectedScale.periodStart)} · {totalEntries} entrada(s)
          </p>
        </div>
        {isManager && (
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setShowHistory(true)}>
              <History className="h-4 w-4 mr-1" /> Histórico
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowHealth(true)}>
              <ShieldCheck className="h-4 w-4 mr-1" /> Saúde
            </Button>
            {isDraft && (
              <Button
                variant="outline" size="sm"
                className="text-destructive hover:text-destructive"
                onClick={handleDeleteScale}
              >
                <Trash2 className="h-4 w-4 mr-1" /> Deletar rascunho
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleDuplicate}>
              <Copy className="h-4 w-4 mr-1" /> Duplicar anterior
            </Button>
            <Button size="sm" onClick={handlePublish}>
              <Send className="h-4 w-4 mr-1" /> {isDraft ? "Enviar" : "Republicar"}
            </Button>
          </div>
        )}
      </div>

      {isManager && (
        <button
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6"
          onClick={() => {
            setDeadlineValue("");
            setShowDeadline(true);
          }}
        >
          <Clock className="h-4 w-4" /> Definir prazo de publicação
        </button>
      )}

      {/* 7-day cards */}
      <div className="grid grid-cols-7 gap-2 mb-6">
        {weekDays.map((d) => {
          const card = fmtDayCard(d);
          const entries = entriesCountByDate.get(d) ?? 0;
          const unavail = unavailableCountByDate.get(d) ?? 0;
          const active = d === daySelected;
          return (
            <button
              key={d}
              onClick={() => setSelectedDay(d)}
              className={`rounded-xl border p-3 text-center transition-colors ${
                active ? "border-primary ring-2 ring-primary/40 bg-primary/5" : "border-border hover:border-primary/40"
              }`}
            >
              <p className="text-[10px] font-semibold tracking-wider text-muted-foreground">{card.wd}</p>
              <p className="text-2xl font-bold text-primary leading-tight">{card.day}</p>
              <p className="text-[10px] text-muted-foreground capitalize">{card.mon}</p>
              <p className={`text-[11px] mt-1 ${entries > 0 ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                {entries > 0 ? `${entries} entrada(s)` : "vazio"}
              </p>
              {unavail > 0 && (
                <p className="text-[10px] text-red-500 mt-0.5">● {unavail}</p>
              )}
            </button>
          );
        })}
      </div>

      {/* Day header */}
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost" size="icon"
            disabled={daySelected === selectedScale.periodStart}
            onClick={() => setSelectedDay(addDays(daySelected, -1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost" size="icon"
            disabled={daySelected === selectedScale.periodEnd}
            onClick={() => setSelectedDay(addDays(daySelected, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <div>
            <p className="font-semibold capitalize">
              {fmtWeekdayLong(daySelected)}, {parseDate(daySelected).getDate()} de{" "}
              {parseDate(daySelected).toLocaleDateString("pt-BR", { month: "long" })}
            </p>
            <p className="text-sm text-muted-foreground">
              {dayEntryCount} entrada(s)
              {dayUnavailable > 0 && (
                <span className="text-amber-600"> · ● {dayUnavailable} indisponível(is)</span>
              )}
            </p>
          </div>
        </div>
        {isManager && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={openAddFromAgenda}>
              <CalendarRange className="h-4 w-4 mr-1" /> Adicionar da agenda
            </Button>
            <Button variant="outline" size="sm" onClick={handleRegenerate} disabled={regenerateMut.isPending}>
              <Zap className="h-4 w-4 mr-1" /> Auto-gerar
            </Button>
          </div>
        )}
      </div>

      {/* Member columns */}
      <div className="overflow-x-auto pb-3">
        <div className="flex gap-3 min-w-min">
          {members.length === 0 && (
            <p className="text-muted-foreground">Nenhum membro encontrado.</p>
          )}
          {members.map((m) => {
            const folgaType = dayFolgas.get(m.userId);
            const unavailable = !!folgaType;
            const memberEntries = dayEntries.get(m.userId) ?? [];
            const freeGaps =
              isManager && !unavailable && status !== "ARCHIVED"
                ? computeFreeGaps(memberEntries)
                : [];
            return (
              <div
                key={m.userId}
                className={`w-44 shrink-0 rounded-xl border ${
                  unavailable ? "border-border bg-muted/30" : "border-border bg-card"
                }`}
              >
                <div className="flex flex-col items-center gap-1 p-3 border-b border-border">
                  <InitialsAvatar id={m.userId} name={m.userName} dim={unavailable} />
                  <p className={`text-sm font-medium text-center leading-tight ${unavailable ? "text-muted-foreground" : ""}`}>
                    {m.userName}
                  </p>
                  {unavailable && (
                    <Badge variant="outline" className="text-[10px] text-red-500 border-red-500/40">
                      {FOLGA_LABELS[folgaType!] ?? folgaType}
                    </Badge>
                  )}
                </div>

                <div className="p-2 space-y-1.5">
                  {memberEntries.map((e) => {
                    const agendaParticipant = !!(e as any).isAgendaParticipant;
                    const dailyBookParticipant = !!(e as any).isDailyBookParticipant;
                    const recurringActivity = !!(e as any).isRecurringActivity;
                    const generated =
                      !agendaParticipant &&
                      !dailyBookParticipant &&
                      !recurringActivity &&
                      !!(e as any).agendaEventId;
                    const label =
                      (e as any).manualLabel ??
                      (e as any).eventTitle ??
                      (e as any).positionName ??
                      "—";
                    const role = (e as any).positionName as string | null;
                    const start = (e as any).startTime ?? (e as any).eventStartTime;
                    const end = (e as any).endTime ?? (e as any).eventEndTime;
                    return (
                      <div
                        key={e.id}
                        className={`group relative rounded-lg border px-2 py-1.5 ${
                          dailyBookParticipant
                            ? "bg-emerald-500/10 border-emerald-500/30"
                            : agendaParticipant
                            ? "bg-sky-500/10 border-sky-500/30"
                            : recurringActivity
                            ? "bg-violet-500/10 border-violet-500/30"
                            : generated
                            ? "bg-amber-500/10 border-amber-500/30"
                            : "bg-primary/10 border-primary/20"
                        }`}
                      >
                        <p className="text-xs font-semibold uppercase leading-tight truncate pr-4">
                          {label}
                        </p>
                        {(generated || dailyBookParticipant) && role && label !== role && (
                          <p className="text-[10px] text-muted-foreground truncate">{role}</p>
                        )}
                        {(start || end) && (
                          <p className="text-[10px] text-muted-foreground">
                            {fmtTime(start)}
                            {end ? ` – ${fmtTime(end)}` : ""}
                          </p>
                        )}
                        {agendaParticipant && (
                          <Badge
                            variant="outline"
                            className="mt-1 text-[9px] text-sky-600 border-sky-500/40 px-1 py-0"
                          >
                            Agenda
                          </Badge>
                        )}
                        {generated && (
                          <Badge
                            variant="outline"
                            className="mt-1 text-[9px] text-amber-600 border-amber-500/40 px-1 py-0"
                          >
                            Auto
                          </Badge>
                        )}
                        {dailyBookParticipant && (
                          <Badge
                            variant="outline"
                            className="mt-1 text-[9px] text-emerald-600 border-emerald-500/40 px-1 py-0"
                          >
                            Livro do Dia
                          </Badge>
                        )}
                        {recurringActivity && (
                          <Badge
                            variant="outline"
                            className="mt-1 text-[9px] text-violet-600 border-violet-500/40 px-1 py-0"
                          >
                            Atividade
                          </Badge>
                        )}
                        {isManager && !agendaParticipant && !dailyBookParticipant && !recurringActivity && (
                          <button
                            onClick={() => handleDeleteEntry(e.id)}
                            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {freeGaps.map((g) => (
                    <button
                      key={`free-${g.start}-${g.end}`}
                      onClick={() =>
                        setFreeSlot({
                          memberId: m.userId,
                          memberName: m.userName,
                          date: daySelected,
                          start: g.start,
                          end: g.end,
                        })
                      }
                      className="w-full rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20 px-2 py-1.5 text-left hover:border-primary/40 hover:bg-primary/5 transition-colors"
                    >
                      <p className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wide">
                        Tempo livre
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {g.start} – {g.end}
                      </p>
                      <span className="mt-0.5 inline-flex items-center gap-0.5 text-[10px] text-primary">
                        <Plus className="h-3 w-3" /> Preencher
                      </span>
                    </button>
                  ))}

                  {isManager && !unavailable && (
                    <button
                      onClick={() => openAddEntry(m.userId, m.userName, daySelected, false)}
                      className="w-full flex flex-col items-center gap-0.5 rounded-lg border border-dashed border-border py-3 text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                      <span className="text-[11px]">Adicionar</span>
                    </button>
                  )}

                  {isManager && unavailable && (
                    <button
                      onClick={() => openAddEntry(m.userId, m.userName, daySelected, true)}
                      className="w-full text-[10px] text-muted-foreground hover:text-foreground py-1"
                    >
                      + Adicionar mesmo assim
                    </button>
                  )}

                  {!isManager && memberEntries.length === 0 && (
                    <p className="text-[11px] text-muted-foreground text-center py-3">—</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add entry dialog */}
      <Dialog open={showAddEntry} onOpenChange={setShowAddEntry}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar entrada</DialogTitle>
            <DialogDescription>
              {addEntryForm.memberName} · {fmtDDMM(addEntryForm.date)}
              {addEntryForm.force && (
                <span className="block text-amber-600 mt-1">
                  Este membro está marcado como indisponível neste dia.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Atividade / Função *</Label>
              <Input
                value={addEntryForm.label}
                onChange={(e) => setAddEntryForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="Ex.: Recepção, Caixa, Monitor..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Início</Label>
                <Input
                  type="time"
                  value={addEntryForm.startTime}
                  onChange={(e) => setAddEntryForm((f) => ({ ...f, startTime: e.target.value }))}
                />
              </div>
              <div>
                <Label>Fim</Label>
                <Input
                  type="time"
                  value={addEntryForm.endTime}
                  onChange={(e) => setAddEntryForm((f) => ({ ...f, endTime: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea
                value={addEntryForm.notes}
                onChange={(e) => setAddEntryForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddEntry(false)}>Cancelar</Button>
            <Button onClick={handleAddEntry} disabled={!addEntryForm.label || createEntryMut.isPending}>
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Free-time fill dialog */}
      <Dialog open={!!freeSlot} onOpenChange={(o) => !o && setFreeSlot(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Sugestão de função</DialogTitle>
            <DialogDescription>
              {freeSlot?.memberName} · {freeSlot && fmtDDMM(freeSlot.date)} ·{" "}
              {freeSlot?.start} – {freeSlot?.end}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            {/* Responsabilidades cadastradas */}
            {(() => {
              const resps = freeSlot
                ? (responsibilitiesByMember.get(freeSlot.memberId) ?? [])
                : [];
              if (resps.length > 0) {
                return (
                  <div>
                    <Label className="text-xs text-muted-foreground">Responsabilidades</Label>
                    <div className="mt-1 space-y-1.5">
                      {resps.map((r) => (
                        <button
                          key={r.id}
                          disabled={createEntryMut.isPending}
                          onClick={() =>
                            handleFillFreeSlot(r.title, r.description ?? undefined)
                          }
                          className="w-full rounded-lg border border-border px-3 py-2 text-left hover:border-primary/40 hover:bg-primary/5 transition-colors disabled:opacity-50"
                        >
                          <p className="text-sm font-medium leading-tight">{r.title}</p>
                          {r.description && (
                            <p className="text-[11px] text-muted-foreground truncate">
                              {r.description}
                            </p>
                          )}
                          <Badge variant="outline" className="mt-1 text-[10px] px-1.5 py-0">
                            {r.category}
                          </Badge>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              }
              return null;
            })()}

            {/* Sugestão rápida */}
            <div>
              <Label className="text-xs text-muted-foreground">Sugestão rápida</Label>
              <Button
                variant="outline"
                className="w-full justify-start mt-1"
                disabled={createEntryMut.isPending}
                onClick={() => handleFillFreeSlot("ADM")}
              >
                <Plus className="h-4 w-4 mr-2" /> ADM (trabalho administrativo)
              </Button>
            </div>

            {/* Tarefas pendentes */}
            {(() => {
              const tasks = freeSlot
                ? pendingTasksByMember.get(freeSlot.memberId) ?? []
                : [];
              if (tasks.length === 0) {
                return (
                  <p className="text-xs text-muted-foreground">
                    Sem tarefas pendentes para esta pessoa.
                  </p>
                );
              }
              return (
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Tarefas pendentes
                  </Label>
                  <div className="mt-1 space-y-1.5">
                    {tasks.map((t) => (
                      <button
                        key={t.id}
                        disabled={createEntryMut.isPending}
                        onClick={() =>
                          handleFillFreeSlot(`Tarefa: ${t.title}`, t.title)
                        }
                        className="w-full rounded-lg border border-border px-3 py-2 text-left hover:border-primary/40 hover:bg-primary/5 transition-colors disabled:opacity-50"
                      >
                        <p className="text-sm font-medium leading-tight">{t.title}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {t.priority} · vence {fmtDDMM(String(t.dueDate).slice(0, 10))}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFreeSlot(null)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Publish deadline dialog */}
      <Dialog open={showAddAgenda} onOpenChange={setShowAddAgenda}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar da agenda</DialogTitle>
            <DialogDescription>
              <span className="capitalize">{fmtWeekdayLong(daySelected)}</span>, {fmtDDMM(daySelected)} · escolha a atividade e para quem ela aparece
            </DialogDescription>
          </DialogHeader>

          {(() => {
            const dayAgenda = agendaEvents.filter(
              (e) => e.date === daySelected && e.type !== "SHOW" && e.status !== "CANCELLED"
            );
            if (dayAgenda.length === 0) {
              return (
                <p className="text-sm text-muted-foreground py-4">
                  Nenhuma atividade da agenda neste dia (os shows já entram sozinhos).
                </p>
              );
            }
            return (
              <div className="space-y-4">
                <div>
                  <Label className="text-xs">Atividade</Label>
                  <div className="mt-1 space-y-1.5 max-h-40 overflow-y-auto">
                    {dayAgenda.map((e) => {
                      const sel = agendaEventId === e.id;
                      return (
                        <button
                          key={e.id}
                          onClick={() => setAgendaEventId(e.id)}
                          className={`w-full text-left rounded-lg border px-3 py-2 transition-colors ${
                            sel ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                          }`}
                        >
                          <p className="text-sm font-medium">{e.title}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {AGENDA_TYPE_LABELS[e.type] ?? e.type}
                            {e.startTime ? ` · ${fmtTime(e.startTime)}` : ""}
                            {e.endTime ? ` – ${fmtTime(e.endTime)}` : ""}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Para quem aparece</Label>
                    <button
                      className="text-[11px] text-muted-foreground hover:text-foreground"
                      onClick={() =>
                        setAgendaMemberIds(
                          agendaMemberIds.size === members.length
                            ? new Set()
                            : new Set(members.map((m) => m.userId))
                        )
                      }
                    >
                      {agendaMemberIds.size === members.length ? "Limpar" : "Selecionar todos"}
                    </button>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5 max-h-44 overflow-y-auto">
                    {members.map((m) => {
                      const sel = agendaMemberIds.has(m.userId);
                      return (
                        <button
                          key={m.userId}
                          onClick={() => toggleAgendaMember(m.userId)}
                          className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                            sel
                              ? "border-primary bg-primary/10 text-foreground"
                              : "border-border text-muted-foreground hover:border-primary/40"
                          }`}
                        >
                          {m.userName}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })()}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddAgenda(false)}>Cancelar</Button>
            <Button
              onClick={handleAddFromAgenda}
              disabled={!agendaEventId || agendaMemberIds.size === 0 || createEntryMut.isPending}
            >
              Adicionar{agendaMemberIds.size > 0 ? ` (${agendaMemberIds.size})` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeadline} onOpenChange={setShowDeadline}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Prazo de publicação</DialogTitle>
            <DialogDescription>
              Defina até quando esta escala deve ser publicada.
            </DialogDescription>
          </DialogHeader>
          <Input
            type="datetime-local"
            value={deadlineValue}
            onChange={(e) => setDeadlineValue(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeadline(false)}>Cancelar</Button>
            <Button onClick={handleSaveDeadline} disabled={deadlineMut.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History dialog */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Histórico da escala</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto space-y-2">
            {historyLoading && <p className="text-muted-foreground">Carregando...</p>}
            {!historyLoading && (historyData?.events ?? []).length === 0 && (
              <p className="text-muted-foreground">Nenhum evento registrado.</p>
            )}
            {(historyData?.events ?? []).map((ev) => (
              <div key={ev.id} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{ev.title}</p>
                  <span className="text-xs text-muted-foreground">{fmtDateTime(ev.occurredAt)}</span>
                </div>
                {ev.narrative && <p className="text-xs text-muted-foreground mt-1">{ev.narrative}</p>}
                {ev.actorName && <p className="text-[11px] text-muted-foreground mt-1">por {ev.actorName}</p>}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Health dialog */}
      <Dialog open={showHealth} onOpenChange={setShowHealth}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Saúde da escala</DialogTitle>
            <DialogDescription>Cobertura e lacunas desta semana.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Coverage summary from the backend scale summary */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg border border-border px-3 py-2 text-center">
                <div className="text-lg font-semibold text-foreground">{selectedScale.assignedCount}</div>
                <div className="text-xs text-muted-foreground">Alocadas</div>
              </div>
              <div className="rounded-lg border border-border px-3 py-2 text-center">
                <div className={`text-lg font-semibold ${selectedScale.openCount > 0 ? "text-amber-600" : "text-foreground"}`}>
                  {selectedScale.openCount}
                </div>
                <div className="text-xs text-muted-foreground">Em aberto</div>
              </div>
              <div className="rounded-lg border border-border px-3 py-2 text-center">
                <div className={`text-lg font-semibold ${selectedScale.conflictCount > 0 ? "text-red-500" : "text-foreground"}`}>
                  {selectedScale.conflictCount}
                </div>
                <div className="text-xs text-muted-foreground">Conflitos</div>
              </div>
            </div>

            {/* Real backend lacunas (allocation exceptions) */}
            <div className="space-y-2">
              <div className="text-sm font-medium flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-500" /> Lacunas
              </div>
              {exceptionsLoading ? (
                <p className="text-sm text-muted-foreground">Carregando…</p>
              ) : (exceptionsData?.exceptions?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma lacuna registrada.</p>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {exceptionsData!.exceptions.map((ex) => (
                    <div key={ex.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                      <div className="font-medium">{ex.positionName ?? ex.type}</div>
                      <div className="text-xs text-muted-foreground">{ex.reason}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Per-day breakdown from actual entries + folgas */}
            <div className="space-y-2">
              <div className="text-sm font-medium flex items-center gap-1.5">
                <CalendarRange className="h-4 w-4" /> Por dia
              </div>
              {weekDays.map((d) => {
                const entries = entriesCountByDate.get(d) ?? 0;
                const unavail = unavailableCountByDate.get(d) ?? 0;
                const card = fmtDayCard(d);
                return (
                  <div key={d} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                    <span className="text-sm capitalize">
                      {card.wd} {card.day}/{card.mon}
                    </span>
                    <div className="flex items-center gap-3 text-sm">
                      <span className={entries === 0 ? "text-amber-600" : "text-foreground"}>
                        {entries} entrada(s)
                      </span>
                      {unavail > 0 && <span className="text-red-500">● {unavail} fora</span>}
                    </div>
                  </div>
                );
              })}
              <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm font-medium">
                <span>Total na semana</span>
                <span>{totalEntries} entrada(s)</span>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

// ─── Week row ─────────────────────────────────────────────────────────────────

function WeekRowItem({
  week, opTab, operations, opName, onOpenScale, onCreate, creating,
}: {
  week: WeekRow;
  opTab: string;
  operations: Operation[];
  opName: Map<string, string>;
  onOpenScale: (s: ScaleSummary) => void;
  onCreate: (operationId: string, week: WeekRow) => void;
  creating: boolean;
}) {
  const isCurrent = thursdayOf(toISO(new Date())) === week.key;
  const opsWithScale = new Set(week.scales.map((s) => s.operationId));
  const multiOp = opsWithScale.size > 1;
  const missingOps =
    opTab === "all"
      ? operations.filter((o) => !opsWithScale.has(o.id))
      : operations.filter((o) => o.id === opTab && !opsWithScale.has(o.id));

  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 mb-2 ${
        isCurrent ? "border-primary/60 bg-primary/5" : "border-border"
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        {multiOp && <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />}
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          qui., {fmtDDMM(week.periodStart)} <ChevR className="inline h-3 w-3" /> qua., {fmtDDMM(week.periodEnd)}
        </span>
      </div>

      <div className="flex items-center gap-2 flex-wrap justify-end">
        {isCurrent && (
          <Badge variant="outline" className="text-[10px] border-primary/50 text-primary">
            esta semana
          </Badge>
        )}
        {week.scales.map((s) => {
          const name = opName.get(s.operationId);
          const label = opTab === "all" && name
            ? `${name} — Sem. ${fmtDDMM(s.periodStart)}`
            : `Semana ${fmtDDMM(s.periodStart)}`;
          return (
            <button
              key={s.id}
              onClick={() => onOpenScale(s)}
              className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm hover:border-primary/50 transition-colors"
            >
              {opTab === "all" && (
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{ backgroundColor: colorFor(s.operationId) }}
                />
              )}
              <span className="font-medium">{label}</span>
              <Badge variant={STATUS_VARIANTS[s.status as string] ?? "secondary"} className="text-[10px]">
                {STATUS_LABELS[s.status as string] ?? s.status}
              </Badge>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          );
        })}
        {missingOps.map((o) => (
          <Button
            key={o.id}
            variant="ghost"
            size="sm"
            disabled={creating}
            onClick={() => onCreate(o.id, week)}
            className="text-muted-foreground"
          >
            <span
              className="inline-block w-2 h-2 rounded-full mr-1.5"
              style={{ backgroundColor: colorFor(o.id) }}
            />
            <Plus className="h-3 w-3 mr-1" /> {o.name}
          </Button>
        ))}
      </div>
    </div>
  );
}
