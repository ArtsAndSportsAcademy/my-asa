import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListScales,
  useGenerateScale,
  usePublishScale,
  useRepublishScale,
  useArchiveScale,
  useRegenerateScale,
  useListScaleAllocations,
  useListScaleExceptions,
  useOverrideAllocation,
  useResolveScaleException,
  useListAgendaEvents,
  useListShowBooks,
  useListFolgas,
  useListUsers,
  useCreateScaleEntry,
  useDeleteScaleEntry,
  getListScalesQueryKey,
  getListScaleAllocationsQueryKey,
  getListScaleExceptionsQueryKey,
  getListAgendaEventsQueryKey,
  getListShowBooksQueryKey,
  getListFolgasQueryKey,
  getListUsersQueryKey,
} from "@workspace/api-client-react";
import type {
  ScaleSummary,
  ScaleAllocationWithCandidates,
  AllocationException,
  AgendaEvent,
  User as UserModel,
} from "@workspace/api-client-react";
import AdminLayout from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  Plus, RefreshCw, Send, AlertTriangle, CheckCircle, Clock,
  MoreHorizontal, Archive, Zap, BookMarked, Palmtree, User,
  ChevronLeft, ChevronRight, Star, PenLine, X,
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Rascunho", PUBLISHED: "Publicada", REPUBLISHED: "Republicada", ARCHIVED: "Arquivada",
};
const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  DRAFT: "secondary", PUBLISHED: "default", REPUBLISHED: "default", ARCHIVED: "outline",
};
const EXC_TYPE_LABELS: Record<string, string> = {
  NO_CANDIDATE: "Sem Candidato", RESTRICTION: "Restrição", CONFLICT: "Conflito",
  INSUFFICIENT_COVERAGE: "Cobertura Insuficiente", SUPERVISOR_OVERRIDE: "Override Supervisor",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildDateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const s = new Date(start + "T12:00:00");
  const e = new Date(end + "T12:00:00");
  while (s <= e) {
    dates.push(s.toISOString().split("T")[0]!);
    s.setDate(s.getDate() + 1);
  }
  return dates;
}

function fmtDayShort(d: string) {
  const dt = new Date(d + "T12:00:00");
  return {
    wd: dt.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "").slice(0, 3),
    day: dt.getDate(),
  };
}

function fmtTime(t?: string | null) {
  if (!t) return "";
  return t.slice(0, 5);
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface GenerateFormState {
  mode: "period" | "event";
  periodStart: string;
  periodEnd: string;
  agendaEventId: string;
  useShowBook: boolean;
  showBookId: string;
  title: string;
}
interface OverrideFormState { userId: string; reason: string; notes: string; }
interface AddEntryFormState {
  memberId: string;
  date: string;
  label: string;
  startTime: string;
  endTime: string;
  notes: string;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ScalesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const auth = useAuth();
  const operationId = auth.roles.find((r) => r.operationId)?.operationId;
  const isSupervisor = auth.roles.some((r) =>
    ["ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"].includes(r.role)
  );
  const isAdminRole = auth.roles.some((r) => r.role === "ADMIN");

  // ── Selection state ────────────────────────────────────────────────────────
  const [selectedScale, setSelectedScale] = useState<ScaleSummary | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // ── Candidate panel (any allocation, not just open slots) ─────────────────
  const [selectedAlloc, setSelectedAlloc] = useState<ScaleAllocationWithCandidates | null>(null);

  // ── Dialogs ────────────────────────────────────────────────────────────────
  const [showGenerate, setShowGenerate] = useState(false);
  const [showOverride, setShowOverride] = useState(false);
  const [showAddEntry, setShowAddEntry] = useState(false);

  // ── Forms ─────────────────────────────────────────────────────────────────
  const [generateForm, setGenerateForm] = useState<GenerateFormState>({
    mode: "period",
    periodStart: "",
    periodEnd: "",
    agendaEventId: "",
    useShowBook: false,
    showBookId: "",
    title: "",
  });
  const [overrideForm, setOverrideForm] = useState<OverrideFormState>({
    userId: "", reason: "", notes: "",
  });
  const [addEntryForm, setAddEntryForm] = useState<AddEntryFormState>({
    memberId: "", date: "", label: "", startTime: "", endTime: "", notes: "",
  });

  // ── Queries ────────────────────────────────────────────────────────────────
  const scalesParams = { operationId };
  const { data: scalesData, isLoading: scalesLoading } = useListScales(scalesParams, {
    query: { queryKey: getListScalesQueryKey(scalesParams), enabled: !!operationId },
  });

  const { data: allocationsData, isLoading: allocLoading } = useListScaleAllocations(
    selectedScale?.id ?? "",
    { query: { queryKey: getListScaleAllocationsQueryKey(selectedScale?.id ?? ""), enabled: !!selectedScale?.id } }
  );

  const { data: exceptionsData } = useListScaleExceptions(
    selectedScale?.id ?? "",
    { query: { queryKey: getListScaleExceptionsQueryKey(selectedScale?.id ?? ""), enabled: !!selectedScale?.id } }
  );

  const eventsParams = { operationId };
  const { data: eventsData } = useListAgendaEvents(eventsParams, {
    query: { queryKey: getListAgendaEventsQueryKey(eventsParams), enabled: !!operationId },
  });

  const showBooksParams = { operationId } as any;
  const { data: showBooksData } = useListShowBooks(showBooksParams, {
    query: { queryKey: getListShowBooksQueryKey(showBooksParams), enabled: !!operationId && showGenerate },
  });

  const { data: usersData } = useListUsers({
    query: { queryKey: getListUsersQueryKey(), enabled: !!operationId },
  });

  const folgasEnabled = !!operationId && !!selectedDay;
  const folgasParams = {
    operationId,
    dateFrom: selectedDay ?? undefined,
    dateTo: selectedDay ?? undefined,
    status: "APPROVED" as any,
  };
  const { data: folgasData } = useListFolgas(folgasParams, {
    query: { queryKey: getListFolgasQueryKey(folgasParams), enabled: folgasEnabled },
  });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const generateMut = useGenerateScale();
  const publishMut = usePublishScale();
  const republishMut = useRepublishScale();
  const archiveMut = useArchiveScale();
  const regenerateMut = useRegenerateScale();
  const overrideMut = useOverrideAllocation();
  const resolveMut = useResolveScaleException();
  const createEntryMut = useCreateScaleEntry();
  const deleteEntryMut = useDeleteScaleEntry();

  function invalidateScales() {
    queryClient.invalidateQueries({ queryKey: getListScalesQueryKey(scalesParams) });
  }
  function invalidateAllocations() {
    if (selectedScale?.id) {
      queryClient.invalidateQueries({ queryKey: getListScaleAllocationsQueryKey(selectedScale.id) });
      queryClient.invalidateQueries({ queryKey: getListScaleExceptionsQueryKey(selectedScale.id) });
    }
  }

  // ── Handlers ──────────────────────────────────────────────────────────────
  function pickScale(scale: ScaleSummary) {
    setSelectedScale(scale);
    setSelectedDay(scale.periodStart);
    setSelectedAlloc(null);
  }

  function isGenerateFormReady() {
    if (!operationId) return false;
    if (generateForm.mode === "period") {
      if (!generateForm.periodStart || !generateForm.periodEnd) return false;
    } else {
      if (!generateForm.agendaEventId) return false;
    }
    if (generateForm.useShowBook && !generateForm.showBookId) return false;
    return true;
  }

  async function handleGenerate() {
    if (!isGenerateFormReady()) return;
    try {
      const payload: Record<string, unknown> = { operationId, title: generateForm.title || undefined };
      if (generateForm.mode === "event") {
        payload.agendaEventId = generateForm.agendaEventId;
      } else {
        payload.periodStart = generateForm.periodStart;
        payload.periodEnd = generateForm.periodEnd;
      }
      if (generateForm.useShowBook && generateForm.showBookId) {
        payload.showBookId = generateForm.showBookId;
      }
      const result = await generateMut.mutateAsync({ data: payload as any });
      const hasPositions = result.engine.totalPositions > 0;
      toast({
        title: "Escala criada",
        description: hasPositions
          ? `${result.engine.assignedPositions}/${result.engine.totalPositions} posições alocadas.`
          : "Escala operacional criada. Adicione entradas manualmente.",
      });
      invalidateScales();
      setShowGenerate(false);
      setGenerateForm({ mode: "period", periodStart: "", periodEnd: "", agendaEventId: "", useShowBook: false, showBookId: "", title: "" });
      pickScale(result.scale);
    } catch {
      toast({ title: "Erro ao criar escala", variant: "destructive" });
    }
  }

  async function handlePublish() {
    if (!selectedScale?.id) return;
    try {
      await publishMut.mutateAsync({ id: selectedScale.id });
      toast({ title: "Escala publicada" });
      invalidateScales();
    } catch { toast({ title: "Erro ao publicar", variant: "destructive" }); }
  }

  async function handleRepublish() {
    if (!selectedScale?.id) return;
    try {
      await republishMut.mutateAsync({ id: selectedScale.id });
      toast({ title: "Escala republicada" });
      invalidateScales();
    } catch { toast({ title: "Erro ao republicar", variant: "destructive" }); }
  }

  async function handleArchive() {
    if (!selectedScale?.id) return;
    try {
      await archiveMut.mutateAsync({ id: selectedScale.id });
      toast({ title: "Escala arquivada" });
      invalidateScales();
      setSelectedScale(null);
    } catch { toast({ title: "Erro ao arquivar", variant: "destructive" }); }
  }

  async function handleRegenerate() {
    if (!selectedScale?.id) return;
    try {
      const result = await regenerateMut.mutateAsync({ id: selectedScale.id });
      toast({ title: "Escala regenerada", description: `${result.engine.assignedPositions}/${result.engine.totalPositions} posições alocadas.` });
      invalidateScales();
      invalidateAllocations();
    } catch { toast({ title: "Erro ao regenerar", variant: "destructive" }); }
  }

  async function handleAssignCandidate(candidate: { userId: string; userName?: string | null }) {
    if (!selectedScale?.id || !selectedAlloc?.id) return;
    try {
      await overrideMut.mutateAsync({
        id: selectedScale.id,
        allocationId: selectedAlloc.id,
        data: { userId: candidate.userId, reason: "Selecionado via painel de candidatos" },
      });
      toast({ title: `${candidate.userName ?? "Membro"} alocado com sucesso` });
      invalidateAllocations();
      setSelectedAlloc(null);
    } catch { toast({ title: "Erro ao alocar", variant: "destructive" }); }
  }

  async function handleManualOverride() {
    if (!selectedScale?.id || !selectedAlloc?.id || !overrideForm.userId || !overrideForm.reason) return;
    try {
      await overrideMut.mutateAsync({
        id: selectedScale.id,
        allocationId: selectedAlloc.id,
        data: { userId: overrideForm.userId, reason: overrideForm.reason, notes: overrideForm.notes || undefined },
      });
      toast({ title: "Override aplicado" });
      invalidateAllocations();
      setShowOverride(false);
      setSelectedAlloc(null);
      setOverrideForm({ userId: "", reason: "", notes: "" });
    } catch { toast({ title: "Erro no override", variant: "destructive" }); }
  }

  async function handleResolveException(excId: string) {
    if (!selectedScale?.id) return;
    try {
      await resolveMut.mutateAsync({ id: selectedScale.id, exceptionId: excId });
      toast({ title: "Exceção resolvida" });
      invalidateAllocations();
    } catch { toast({ title: "Erro ao resolver exceção", variant: "destructive" }); }
  }

  function handleOpenAddEntry(memberId: string, date: string) {
    setAddEntryForm({ memberId, date, label: "", startTime: "", endTime: "", notes: "" });
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
      });
      toast({ title: "Entrada adicionada" });
      setShowAddEntry(false);
      setAddEntryForm({ memberId: "", date: "", label: "", startTime: "", endTime: "", notes: "" });
    } catch (e: any) {
      toast({ title: e?.message ?? "Erro ao adicionar entrada", variant: "destructive" });
    }
  }

  async function handleDeleteEntry(entryId: string) {
    if (!selectedScale?.id) return;
    try {
      await deleteEntryMut.mutateAsync({ scaleId: selectedScale.id, entryId });
      toast({ title: "Entrada removida" });
    } catch (e: any) {
      toast({ title: e?.message ?? "Erro ao remover entrada", variant: "destructive" });
    }
  }

  // ── Derived data ───────────────────────────────────────────────────────────
  const scales = useMemo(() => scalesData?.scales ?? [], [scalesData]);
  const allocations = useMemo(() => allocationsData?.allocations ?? [], [allocationsData]);
  const exceptions = useMemo(() => exceptionsData?.exceptions ?? [], [exceptionsData]);
  const folgaUserIds = useMemo(
    () => new Set<string>(((folgasData as any)?.folgas ?? []).map((f: any) => String(f.userId))),
    [folgasData]
  );

  // ALL members of the operation — columns of the matrix (most cells will be empty)
  const members = useMemo<{ userId: string; userName: string }[]>(() => {
    return (usersData?.users ?? [])
      .filter((u: UserModel) => u.status !== "INACTIVE")
      .map((u: UserModel) => ({ userId: u.id, userName: u.name }))
      .sort((a, b) => a.userName.localeCompare(b.userName, "pt-BR"));
  }, [usersData]);

  // Cell lookup: eventId → userId → allocation
  const allocByEvent = useMemo(() => {
    const result = new Map<string, Map<string, ScaleAllocationWithCandidates>>();
    for (const a of allocations) {
      if (!a.agendaEventId || !a.userId) continue;
      if (!result.has(a.agendaEventId)) result.set(a.agendaEventId, new Map());
      result.get(a.agendaEventId)!.set(a.userId, a);
    }
    return result;
  }, [allocations]);

  // Manual entries: date → userId → entries[]
  const manualByDateMember = useMemo(() => {
    const result = new Map<string, Map<string, ScaleAllocationWithCandidates[]>>();
    for (const a of allocations) {
      if (a.agendaEventId) continue; // engine allocations handled in allocByEvent
      const date = (a as any).manualDate as string | null;
      if (!date || !a.userId) continue;
      if (!result.has(date)) result.set(date, new Map());
      if (!result.get(date)!.has(a.userId)) result.get(date)!.set(a.userId, []);
      result.get(date)!.get(a.userId)!.push(a);
    }
    return result;
  }, [allocations]);

  // Open slots per event: eventId → open allocations
  const openByEvent = useMemo(() => {
    const result = new Map<string, ScaleAllocationWithCandidates[]>();
    for (const a of allocations) {
      if (a.status !== "OPEN" || !a.agendaEventId) continue;
      if (!result.has(a.agendaEventId)) result.set(a.agendaEventId, []);
      result.get(a.agendaEventId)!.push(a);
    }
    return result;
  }, [allocations]);

  // Unique eventIds in this scale
  const allEventIds = useMemo(
    () => [...new Set(allocations.map((a) => a.agendaEventId).filter(Boolean))] as string[],
    [allocations]
  );

  // Days that have events (for day strip indicators)
  const eventDays = useMemo(() => {
    const days = new Set<string>();
    for (const eid of allEventIds) {
      const ev = eventsData?.events?.find((e) => e.id === eid);
      if (ev?.date) days.add(ev.date);
      else if (selectedScale?.periodStart) days.add(selectedScale.periodStart);
    }
    return days;
  }, [allEventIds, eventsData, selectedScale]);

  // Per-day health aggregation: "ok" | "risk" | "exception" (not global scale counters)
  type DayHealth = "ok" | "risk" | "exception";
  const dayHealth = useMemo(() => {
    const result = new Map<string, DayHealth>();
    // Group scale eventIds by date
    const eventsByDate = new Map<string, string[]>();
    for (const eid of allEventIds) {
      const ev = eventsData?.events?.find((e) => e.id === eid);
      const date = ev?.date ?? selectedScale?.periodStart;
      if (date) {
        if (!eventsByDate.has(date)) eventsByDate.set(date, []);
        eventsByDate.get(date)!.push(eid);
      }
    }
    for (const [date, eids] of eventsByDate) {
      const hasException = exceptions.some(
        (ex) => !ex.resolvedAt && ex.agendaEventId && eids.includes(ex.agendaEventId)
      );
      const hasOpenSlots = eids.some((eid) => (openByEvent.get(eid)?.length ?? 0) > 0);
      if (hasException) result.set(date, "exception");
      else if (hasOpenSlots) result.set(date, "risk");
      else result.set(date, "ok");
    }
    return result;
  }, [allEventIds, eventsData, exceptions, openByEvent, selectedScale]);

  // Rows of the matrix for the selected day: one row per event, sorted by startTime
  const eventRows = useMemo(() => {
    if (!allEventIds.length) return [];
    const rows = allEventIds.map((eventId) => ({
      eventId,
      event: (eventsData?.events?.find((e) => e.id === eventId) ?? null) as AgendaEvent | null,
    }));

    // Filter to selectedDay (if we have event details); if event not found, include anyway
    const filtered = selectedDay
      ? rows.filter((r) => !r.event || r.event.date === selectedDay)
      : rows;

    // Sort chronologically
    return filtered.sort((a, b) => {
      const at = a.event?.startTime ?? "00:00";
      const bt = b.event?.startTime ?? "00:00";
      return at.localeCompare(bt);
    });
  }, [allEventIds, selectedDay, eventsData]);

  const hasAnyOpenSlots = useMemo(
    () => [...openByEvent.values()].some((v) => v.length > 0),
    [openByEvent]
  );

  const unresolvedExceptions = useMemo(
    () => exceptions.filter((e) => !e.resolvedAt),
    [exceptions]
  );

  const dayRange = useMemo(() => {
    if (!selectedScale) return [];
    return buildDateRange(selectedScale.periodStart, selectedScale.periodEnd);
  }, [selectedScale]);

  const problems = selectedScale
    ? selectedScale.openCount + selectedScale.exceptionCount
    : 0;
  const exclamations =
    problems >= 3 ? "!!!" : problems === 2 ? "!!" : problems === 1 ? "!" : "";

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <AdminLayout title="Escalas">
      <div className="flex flex-col overflow-hidden" style={{ height: "calc(100vh - 4rem)" }}>

        {/* ── Top bar ── */}
        <div className="bg-white border-b px-6 py-2.5 flex items-center gap-3 shrink-0">
          {/* Scale selector with prev/next arrows */}
          <div className="flex items-center gap-1 flex-1 min-w-0 max-w-sm">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              disabled={!selectedScale || scales.findIndex((s) => s.id === selectedScale?.id) <= 0}
              onClick={() => {
                const idx = scales.findIndex((s) => s.id === selectedScale?.id);
                if (idx > 0) pickScale(scales[idx - 1]!);
              }}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Select
              value={selectedScale?.id ?? "__none__"}
              onValueChange={(id) => {
                if (id === "__none__") return;
                const s = scales.find((x) => x.id === id);
                if (s) pickScale(s);
              }}
            >
              <SelectTrigger className="h-8 text-sm font-medium border-0 shadow-none focus:ring-0 px-1 flex-1">
                <SelectValue placeholder={scalesLoading ? "Carregando..." : "Selecionar escala..."} />
              </SelectTrigger>
              <SelectContent>
                {scales.length === 0 && (
                  <div className="px-3 py-2 text-sm text-muted-foreground">Nenhuma escala ainda</div>
                )}
                {scales.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    <span className="flex items-center gap-2">
                      <span className="truncate max-w-[200px]">{s.title}</span>
                      <Badge variant={STATUS_VARIANTS[s.status] ?? "secondary"} className="text-xs shrink-0">
                        {STATUS_LABELS[s.status] ?? s.status}
                      </Badge>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              disabled={
                !selectedScale ||
                scales.findIndex((s) => s.id === selectedScale?.id) >= scales.length - 1
              }
              onClick={() => {
                const idx = scales.findIndex((s) => s.id === selectedScale?.id);
                if (idx < scales.length - 1) pickScale(scales[idx + 1]!);
              }}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="h-5 border-l shrink-0" />

          {isSupervisor && (
            <Button size="sm" className="h-8" onClick={() => setShowGenerate(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Gerar
            </Button>
          )}

          {selectedScale && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground"
                onClick={() =>
                  setLocation(isAdminRole ? "/admin/daily-book" : "/supervisor/daily-book")
                }
              >
                <BookMarked className="h-3.5 w-3.5 mr-1.5" /> Livro do Dia
              </Button>
              {isSupervisor && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {selectedScale.status === "DRAFT" && (
                      <DropdownMenuItem
                        onClick={handleRegenerate}
                        disabled={regenerateMut.isPending}
                      >
                        <RefreshCw className="h-4 w-4 mr-2" /> Regenerar
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleArchive}
                      className="text-destructive"
                      disabled={archiveMut.isPending}
                    >
                      <Archive className="h-4 w-4 mr-2" /> Arquivar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </>
          )}
        </div>

        {/* ── Day strip ── */}
        {selectedScale && dayRange.length > 0 && (
          <div className="bg-white border-b px-6 shrink-0">
            <div className="flex gap-1 py-2 overflow-x-auto">
              {dayRange.map((day) => {
                const isSelected = day === selectedDay;
                const hasEvent = eventDays.has(day);
                const health = dayHealth.get(day);
                const { wd, day: d } = fmtDayShort(day);
                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDay(day)}
                    className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-all shrink-0 min-w-[52px] ${
                      isSelected
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    <span className="text-[10px] font-medium uppercase tracking-wide">{wd}</span>
                    <span className="text-base font-bold leading-tight">{d}</span>
                    <div className="flex items-center gap-0.5 h-2.5">
                      {hasEvent && (
                        <Star
                          className="h-2.5 w-2.5"
                          fill={isSelected ? "currentColor" : "none"}
                          style={{ opacity: isSelected ? 0.7 : 0.5 }}
                        />
                      )}
                      {health === "exception" && (
                        <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-red-300" : "bg-red-500"}`} />
                      )}
                      {health === "risk" && (
                        <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-amber-300" : "bg-amber-400"}`} />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Main content ── */}
        <div className="flex-1 overflow-hidden">
          {!selectedScale ? (
            <EmptyState
              isSupervisor={isSupervisor}
              scalesLoading={scalesLoading}
              onGenerate={() => setShowGenerate(true)}
            />
          ) : allocLoading ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <p className="text-sm">Carregando escala...</p>
            </div>
          ) : (
            <div className="h-full overflow-auto">
              <ScaleGrid
                scale={selectedScale}
                allocations={allocations}
                members={members}
                allocByEvent={allocByEvent}
                openByEvent={openByEvent}
                hasAnyOpenSlots={hasAnyOpenSlots}
                eventRows={eventRows}
                folgaUserIds={folgaUserIds}
                unresolvedExceptions={unresolvedExceptions}
                isSupervisor={isSupervisor}
                onCellClick={(alloc) => setSelectedAlloc(alloc)}
                onResolveException={handleResolveException}
                resolvePending={resolveMut.isPending}
                manualByDateMember={manualByDateMember}
                selectedDay={selectedDay}
                onAddEntry={handleOpenAddEntry}
                onDeleteEntry={handleDeleteEntry}
              />
            </div>
          )}
        </div>

        {/* ── Validation bar ── */}
        {selectedScale && (
          <ValidationBar
            scale={selectedScale}
            exclamations={exclamations}
            isSupervisor={isSupervisor}
            onPublish={handlePublish}
            onRepublish={handleRepublish}
            publishPending={publishMut.isPending}
            republishPending={republishMut.isPending}
          />
        )}
      </div>

      {/* ── Generate Dialog ── */}
      <Dialog open={showGenerate} onOpenChange={setShowGenerate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Escala Operacional</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">

            {/* Modo: Por Período ou Por Evento */}
            <div className="flex rounded-md border overflow-hidden text-sm">
              <button
                type="button"
                className={`flex-1 py-1.5 px-3 transition-colors ${
                  generateForm.mode === "period"
                    ? "bg-primary text-primary-foreground font-medium"
                    : "bg-background text-muted-foreground hover:bg-muted"
                }`}
                onClick={() => setGenerateForm((f) => ({ ...f, mode: "period", agendaEventId: "", useShowBook: false, showBookId: "" }))}
              >
                Por Período
              </button>
              <button
                type="button"
                className={`flex-1 py-1.5 px-3 transition-colors ${
                  generateForm.mode === "event"
                    ? "bg-primary text-primary-foreground font-medium"
                    : "bg-background text-muted-foreground hover:bg-muted"
                }`}
                onClick={() => setGenerateForm((f) => ({ ...f, mode: "event", periodStart: "", periodEnd: "" }))}
              >
                Por Evento da Agenda
              </button>
            </div>

            {/* Conteúdo do modo selecionado */}
            {generateForm.mode === "period" ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Data início *</Label>
                    <Input
                      type="date"
                      value={generateForm.periodStart}
                      onChange={(e) => setGenerateForm((f) => ({ ...f, periodStart: e.target.value, periodEnd: f.periodEnd || e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Data fim *</Label>
                    <Input
                      type="date"
                      value={generateForm.periodEnd}
                      min={generateForm.periodStart}
                      onChange={(e) => setGenerateForm((f) => ({ ...f, periodEnd: e.target.value }))}
                    />
                  </div>
                </div>
                {/* Atalhos rápidos */}
                <div className="flex gap-1.5 flex-wrap">
                  {[
                    { label: "Hoje", fn: () => { const d = new Date().toISOString().split("T")[0]!; setGenerateForm((f) => ({ ...f, periodStart: d, periodEnd: d })); } },
                    { label: "Semana atual", fn: () => {
                      const now = new Date();
                      const mon = new Date(now); mon.setDate(now.getDate() - now.getDay() + 1);
                      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
                      setGenerateForm((f) => ({ ...f, periodStart: mon.toISOString().split("T")[0]!, periodEnd: sun.toISOString().split("T")[0]! }));
                    }},
                    { label: "Próx. semana", fn: () => {
                      const now = new Date();
                      const mon = new Date(now); mon.setDate(now.getDate() - now.getDay() + 8);
                      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
                      setGenerateForm((f) => ({ ...f, periodStart: mon.toISOString().split("T")[0]!, periodEnd: sun.toISOString().split("T")[0]! }));
                    }},
                  ].map(({ label, fn }) => (
                    <button key={label} type="button" onClick={fn}
                      className="text-xs px-2 py-0.5 rounded border border-border bg-muted hover:bg-accent transition-colors">
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Evento da Agenda *</Label>
                <Select
                  value={generateForm.agendaEventId}
                  onValueChange={(v) => {
                    const ev = (eventsData?.events ?? []).find((e) => e.id === v);
                    const isShow = (ev as any)?.type === "SHOW";
                    setGenerateForm((f) => ({ ...f, agendaEventId: v, useShowBook: isShow, showBookId: "" }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o evento" />
                  </SelectTrigger>
                  <SelectContent>
                    {(eventsData?.events ?? []).map((ev) => (
                      <SelectItem key={ev.id} value={ev.id}>
                        <span className="text-muted-foreground mr-1">{ev.date}</span> {ev.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Livro do Show — opcional, independente do modo */}
            <div className="rounded-md border px-3 py-2.5 space-y-3">
              <label className="flex items-center justify-between gap-2 cursor-pointer select-none">
                <div>
                  <p className="text-sm font-medium leading-none">Vincular Livro do Show</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {generateForm.useShowBook
                      ? "Posições/personagens serão alocados automaticamente."
                      : "Escala livre — ensaio, aula, reunião, operação."}
                  </p>
                </div>
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary cursor-pointer"
                  checked={generateForm.useShowBook}
                  onChange={(e) => setGenerateForm((f) => ({ ...f, useShowBook: e.target.checked, showBookId: "" }))}
                />
              </label>
              {generateForm.useShowBook && (
                <Select
                  value={generateForm.showBookId}
                  onValueChange={(v) => setGenerateForm((f) => ({ ...f, showBookId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o Livro do Show" />
                  </SelectTrigger>
                  <SelectContent>
                    {((showBooksData as any)?.showBooks ?? []).map((sb: any) => (
                      <SelectItem key={sb.id} value={sb.id}>{sb.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Título (opcional)</Label>
              <Input
                placeholder="Gerado automaticamente se vazio"
                value={generateForm.title}
                onChange={(e) => setGenerateForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenerate(false)}>Cancelar</Button>
            <Button onClick={handleGenerate} disabled={!isGenerateFormReady() || generateMut.isPending}>
              <Zap className="h-4 w-4 mr-1.5" />
              {generateMut.isPending ? "Criando..." : "Criar Escala"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Candidate Panel ── */}
      <Sheet open={!!selectedAlloc} onOpenChange={(open) => { if (!open) setSelectedAlloc(null); }}>
        <SheetContent className="w-[420px] sm:w-[480px] overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle className="flex flex-col gap-1">
              <span>
                {selectedAlloc?.status === "OPEN" ? "Candidatos" : "Reatribuir / Override"}
              </span>
              <span className="text-sm font-normal text-muted-foreground">
                Posição: <strong>{selectedAlloc?.positionName ?? "—"}</strong>
                {selectedAlloc?.userName && (
                  <span> · atual: <em>{selectedAlloc.userName}</em></span>
                )}
              </span>
            </SheetTitle>
          </SheetHeader>
          {selectedAlloc && (
            <CandidateList
              alloc={selectedAlloc}
              isSupervisor={isSupervisor}
              isArchived={selectedScale?.status === "ARCHIVED"}
              isPending={overrideMut.isPending}
              onAssign={handleAssignCandidate}
              onManualOverride={() => setShowOverride(true)}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* ── Manual Override Dialog ── */}
      <Dialog open={showOverride} onOpenChange={setShowOverride}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Override Manual</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Posição: <strong>{selectedAlloc?.positionName ?? "—"}</strong>
            </p>
            <div className="space-y-1.5">
              <Label>Membro *</Label>
              <Select
                value={overrideForm.userId}
                onValueChange={(v) => setOverrideForm((f) => ({ ...f, userId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar membro" />
                </SelectTrigger>
                <SelectContent>
                  {(members as { userId: string; userName: string }[]).map((m) => (
                    <SelectItem key={m.userId} value={m.userId}>{m.userName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Motivo *</Label>
              <Textarea
                value={overrideForm.reason}
                onChange={(e) => setOverrideForm((f) => ({ ...f, reason: e.target.value }))}
                placeholder="Motivo do override..."
                rows={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Notas adicionais</Label>
              <Textarea
                value={overrideForm.notes}
                onChange={(e) => setOverrideForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Opcional..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOverride(false)}>Cancelar</Button>
            <Button
              onClick={handleManualOverride}
              disabled={!overrideForm.userId || !overrideForm.reason || overrideMut.isPending}
            >
              Aplicar Override
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Manual Entry Dialog ── */}
      <Dialog open={showAddEntry} onOpenChange={setShowAddEntry}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Adicionar Entrada</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label>Membro</Label>
              <Select
                value={addEntryForm.memberId}
                onValueChange={(v) => setAddEntryForm((f) => ({ ...f, memberId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar membro" />
                </SelectTrigger>
                <SelectContent>
                  {(members as { userId: string; userName: string }[]).map((m) => (
                    <SelectItem key={m.userId} value={m.userId}>{m.userName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Data *</Label>
              <Input
                type="date"
                value={addEntryForm.date}
                onChange={(e) => setAddEntryForm((f) => ({ ...f, date: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Atividade *</Label>
              <Input
                placeholder="Ex: Ensaio, Montagem, Operação..."
                value={addEntryForm.label}
                onChange={(e) => setAddEntryForm((f) => ({ ...f, label: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Início</Label>
                <Input
                  type="time"
                  value={addEntryForm.startTime}
                  onChange={(e) => setAddEntryForm((f) => ({ ...f, startTime: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Fim</Label>
                <Input
                  type="time"
                  value={addEntryForm.endTime}
                  onChange={(e) => setAddEntryForm((f) => ({ ...f, endTime: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea
                placeholder="Opcional..."
                rows={2}
                value={addEntryForm.notes}
                onChange={(e) => setAddEntryForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddEntry(false)}>Cancelar</Button>
            <Button
              onClick={handleAddEntry}
              disabled={!addEntryForm.memberId || !addEntryForm.date || !addEntryForm.label || createEntryMut.isPending}
            >
              {createEntryMut.isPending ? "Salvando..." : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────

function EmptyState({
  isSupervisor,
  scalesLoading,
  onGenerate,
}: { isSupervisor: boolean; scalesLoading: boolean; onGenerate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4">
      <Zap className="h-14 w-14 opacity-10" />
      <div className="text-center">
        <p className="font-medium text-base text-foreground">
          {scalesLoading ? "Carregando escalas..." : "Nenhuma escala selecionada"}
        </p>
        <p className="text-sm mt-1">
          {scalesLoading ? "" : "Use o seletor acima ou gere uma nova escala"}
        </p>
      </div>
      {isSupervisor && !scalesLoading && (
        <Button variant="outline" onClick={onGenerate}>
          <Plus className="h-4 w-4 mr-1.5" /> Gerar primeira escala
        </Button>
      )}
    </div>
  );
}

// ─── Grid constants ───────────────────────────────────────────────────────────

const LABEL_COL = 224;
const MEMBER_COL = 148;
const OPEN_COL = 180;

// ─── OperationalDayView ───────────────────────────────────────────────────────

interface OperationalDayViewProps {
  members: { userId: string; userName: string }[];
  dayManual: Map<string, ScaleAllocationWithCandidates[]>;
  folgaUserIds: Set<string>;
  isSupervisor: boolean;
  selectedDay: string | null;
  onAddEntry: (memberId: string, date: string) => void;
  onDeleteEntry: (entryId: string) => void;
}

// ── Time-grid constants for OperationalDayView ────────────────────────────────
const OP_START = 7;
const OP_END   = 23;
const OP_HOUR_PX = 56; // pixels per hour

// Palette for manual activity blocks (cycles by index)
const OP_COLORS = [
  "bg-violet-100 border-l-violet-500 text-violet-900",
  "bg-blue-100 border-l-blue-500 text-blue-900",
  "bg-amber-100 border-l-amber-500 text-amber-900",
  "bg-emerald-100 border-l-emerald-500 text-emerald-900",
  "bg-rose-100 border-l-rose-500 text-rose-900",
  "bg-indigo-100 border-l-indigo-500 text-indigo-900",
  "bg-teal-100 border-l-teal-500 text-teal-900",
  "bg-orange-100 border-l-orange-500 text-orange-900",
];

function opTimeToMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function opEntryTop(startTime: string): number {
  return Math.max(0, (opTimeToMin(startTime) / 60 - OP_START) * OP_HOUR_PX);
}

function opEntryHeight(startTime: string, endTime: string | null | undefined): number {
  if (!endTime) return 36;
  return Math.max(28, (opTimeToMin(endTime) - opTimeToMin(startTime)) * (OP_HOUR_PX / 60));
}

function OperationalDayView({
  members,
  dayManual,
  folgaUserIds,
  isSupervisor,
  selectedDay,
  onAddEntry,
  onDeleteEntry,
}: OperationalDayViewProps) {
  const date = selectedDay ?? new Date().toISOString().split("T")[0]!;
  const hours = Array.from({ length: OP_END - OP_START }, (_, i) => OP_START + i);
  const totalH = (OP_END - OP_START) * OP_HOUR_PX;

  const allEntries = useMemo(() => {
    const result: Array<{ memberId: string; entry: any; colorIdx: number }> = [];
    members.forEach((m) => {
      const entries = dayManual.get(m.userId) ?? [];
      entries.forEach((entry, idx) => result.push({ memberId: m.userId, entry, colorIdx: idx % OP_COLORS.length }));
    });
    return result;
  }, [members, dayManual]);

  const labelMap = useMemo(() => {
    const map = new Map<string, number>();
    allEntries.forEach(({ entry, colorIdx }) => {
      const label: string = (entry as any).manualLabel ?? "";
      if (!map.has(label)) map.set(label, colorIdx);
    });
    return map;
  }, [allEntries]);

  return (
    <div>
      {/* Header hint */}
      <div className="flex items-center gap-2 mb-3">
        <PenLine className="h-4 w-4 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Grade do dia — sem eventos de agenda vinculados.{" "}
          {isSupervisor && "Clique em + abaixo de um membro para lançar atividades."}
        </p>
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 640 }}>
          <div className="flex min-w-max">

            {/* ── Time axis column ── */}
            <div className="shrink-0 border-r bg-gray-50/80 sticky left-0 z-20" style={{ width: 52 }}>
              {/* Corner + add-button spacer */}
              <div className="border-b bg-gray-50 flex items-end justify-center pb-2" style={{ height: 88 }}>
                <span className="text-[9px] text-muted-foreground uppercase tracking-widest">hora</span>
              </div>
              {/* Hour labels */}
              <div className="relative" style={{ height: totalH }}>
                {hours.map((h) => (
                  <div key={h}
                    className="absolute right-0 left-0 flex justify-end pr-2 border-t border-border/30"
                    style={{ top: (h - OP_START) * OP_HOUR_PX }}>
                    <span className="text-[10px] text-muted-foreground font-medium tabular-nums -mt-3">
                      {String(h).padStart(2, "0")}:00
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Member columns ── */}
            {members.map((m) => {
              const entries = dayManual.get(m.userId) ?? [];
              const hasFolga = folgaUserIds.has(m.userId);
              const timed   = entries.filter((e: any) => !!(e as any).startTime);
              const untimed = entries.filter((e: any) => !(e as any).startTime);

              return (
                <div key={m.userId} className="flex flex-col border-r last:border-r-0" style={{ minWidth: 148 }}>

                  {/* Member header */}
                  <div className="flex flex-col items-center gap-1 px-3 py-3 border-b bg-gray-50/80 sticky top-0 z-10" style={{ height: 88 }}>
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-primary">
                        {m.userName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="text-xs font-medium text-gray-700 text-center leading-tight line-clamp-2">
                      {m.userName.split(" ")[0]}
                    </span>
                    {hasFolga && (
                      <span className="flex items-center gap-0.5 text-[10px] text-amber-500">
                        <Palmtree className="h-2.5 w-2.5" /> Folga
                      </span>
                    )}
                    {isSupervisor && (
                      <button
                        onClick={() => onAddEntry(m.userId, date)}
                        className="flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-primary transition-colors"
                        title="Adicionar atividade"
                      >
                        <Plus className="h-3 w-3" /> add
                      </button>
                    )}
                  </div>

                  {/* Time grid body */}
                  <div className="relative" style={{ height: totalH }}>

                    {/* Hour grid lines */}
                    {hours.map((h) => (
                      <div key={h} className="absolute left-0 right-0 border-t border-border/30"
                        style={{ top: (h - OP_START) * OP_HOUR_PX }} />
                    ))}
                    {hours.map((h) => (
                      <div key={`h${h}`} className="absolute left-0 right-0 border-t border-border/10 border-dashed"
                        style={{ top: (h - OP_START) * OP_HOUR_PX + OP_HOUR_PX / 2 }} />
                    ))}

                    {/* Untimed entries — float at top as chips */}
                    {untimed.length > 0 && (
                      <div className="absolute left-1 right-1 top-1 flex flex-col gap-0.5 z-10">
                        {untimed.map((entry: any) => {
                          const colorIdx = labelMap.get(entry.manualLabel ?? "") ?? 0;
                          const colorCls = OP_COLORS[colorIdx % OP_COLORS.length];
                          return (
                            <div key={entry.id} className={`group relative rounded border-l-2 px-1.5 py-1 text-[10px] ${colorCls}`}>
                              <p className="font-semibold uppercase leading-tight truncate">{entry.manualLabel ?? "—"}</p>
                              {isSupervisor && (
                                <button onClick={() => onDeleteEntry(entry.id)}
                                  className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 p-0.5">
                                  <X className="h-2.5 w-2.5" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Timed entries — positioned absolutely */}
                    {timed.map((entry: any) => {
                      const top = opEntryTop(entry.startTime);
                      const height = opEntryHeight(entry.startTime, entry.endTime);
                      const colorIdx = labelMap.get(entry.manualLabel ?? "") ?? 0;
                      const colorCls = OP_COLORS[colorIdx % OP_COLORS.length];
                      return (
                        <div key={entry.id}
                          className={`group absolute left-0.5 right-0.5 rounded border-l-2 px-1.5 py-0.5 text-[10px] overflow-hidden ${colorCls}`}
                          style={{ top, height }}
                          title={`${entry.manualLabel ?? ""}${entry.startTime ? ` · ${fmtTime(entry.startTime)}` : ""}${entry.endTime ? ` – ${fmtTime(entry.endTime)}` : ""}`}
                        >
                          <p className="font-semibold uppercase leading-tight truncate">{entry.manualLabel ?? "—"}</p>
                          {height >= 36 && (
                            <p className="opacity-70 tabular-nums mt-0.5">
                              {fmtTime(entry.startTime)}{entry.endTime ? ` – ${fmtTime(entry.endTime)}` : ""}
                            </p>
                          )}
                          {height >= 52 && entry.notes && (
                            <p className="opacity-60 truncate mt-0.5">{entry.notes}</p>
                          )}
                          {isSupervisor && (
                            <button onClick={() => onDeleteEntry(entry.id)}
                              className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 p-0.5">
                              <X className="h-2.5 w-2.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Empty state */}
            {members.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 px-8 text-muted-foreground gap-2">
                <User className="h-8 w-8 opacity-20" />
                <p className="text-sm">Nenhum membro encontrado.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ScaleGrid ────────────────────────────────────────────────────────────────

interface EventRow {
  eventId: string;
  event: AgendaEvent | null;
}

interface ScaleGridProps {
  scale: ScaleSummary;
  allocations: ScaleAllocationWithCandidates[];
  members: { userId: string; userName: string }[];
  allocByEvent: Map<string, Map<string, ScaleAllocationWithCandidates>>;
  openByEvent: Map<string, ScaleAllocationWithCandidates[]>;
  hasAnyOpenSlots: boolean;
  eventRows: EventRow[];
  folgaUserIds: Set<string>;
  unresolvedExceptions: AllocationException[];
  isSupervisor: boolean;
  onCellClick: (alloc: ScaleAllocationWithCandidates) => void;
  onResolveException: (id: string) => void;
  resolvePending: boolean;
  manualByDateMember: Map<string, Map<string, ScaleAllocationWithCandidates[]>>;
  selectedDay: string | null;
  onAddEntry: (memberId: string, date: string) => void;
  onDeleteEntry: (entryId: string) => void;
}

function ScaleGrid({
  scale,
  allocations,
  members,
  allocByEvent,
  openByEvent,
  hasAnyOpenSlots,
  eventRows,
  folgaUserIds,
  unresolvedExceptions,
  isSupervisor,
  onCellClick,
  onResolveException,
  resolvePending,
  manualByDateMember,
  selectedDay,
  onAddEntry,
  onDeleteEntry,
}: ScaleGridProps) {
  const dayManual = selectedDay ? (manualByDateMember.get(selectedDay) ?? new Map()) : new Map();

  if (allocations.length === 0 && !isSupervisor) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
        <Zap className="h-10 w-10 opacity-15" />
        <p className="text-sm">Nenhuma alocação nesta escala.</p>
      </div>
    );
  }

  const totalWidth =
    LABEL_COL + members.length * MEMBER_COL + (hasAnyOpenSlots ? OPEN_COL : 0);

  return (
    <div className="p-5 space-y-4">
      {/* Exception alerts */}
      {unresolvedExceptions.length > 0 && (
        <div className="space-y-2">
          {unresolvedExceptions.map((exc) => (
            <div
              key={exc.id}
              className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5"
            >
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <div className="flex-1 text-sm min-w-0">
                <span className="font-semibold text-amber-800 mr-2">
                  {EXC_TYPE_LABELS[exc.type] ?? exc.type}
                </span>
                {exc.positionName && (
                  <span className="text-amber-700 mr-2">· {exc.positionName}</span>
                )}
                <span className="text-amber-700 truncate">{exc.reason}</span>
              </div>
              {isSupervisor && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs shrink-0"
                  onClick={() => onResolveException(exc.id)}
                  disabled={resolvePending}
                >
                  Resolver
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* No events on selected day: show operational day view with manual entry columns */}
      {eventRows.length === 0 && (
        <OperationalDayView
          members={members}
          dayManual={dayManual}
          folgaUserIds={folgaUserIds}
          isSupervisor={isSupervisor}
          selectedDay={selectedDay}
          onAddEntry={onAddEntry}
          onDeleteEntry={onDeleteEntry}
        />
      )}

      {/* Matrix grid */}
      {eventRows.length > 0 && (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <div style={{ minWidth: totalWidth }}>

              {/* ── Header row ── */}
              <div className="flex border-b bg-gray-50/80 sticky top-0 z-20">
                {/* Sticky label column */}
                <div
                  className="flex items-end px-4 py-2.5 border-r bg-gray-50 shrink-0 sticky left-0 z-30"
                  style={{ width: LABEL_COL, minWidth: LABEL_COL }}
                >
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Atividade
                  </span>
                </div>

                {/* Member column headers */}
                {members.map((m) => (
                  <div
                    key={m.userId}
                    style={{ width: MEMBER_COL, minWidth: MEMBER_COL }}
                    className="flex flex-col items-center justify-end px-2 py-2.5 border-r shrink-0"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mb-1">
                      <span className="text-xs font-bold text-primary">
                        {m.userName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="text-xs font-medium text-gray-700 truncate max-w-full text-center leading-tight">
                      {m.userName.split(" ")[0]}
                    </span>
                    {folgaUserIds.has(m.userId) && (
                      <span className="flex items-center gap-0.5 text-[10px] text-gray-400 mt-0.5">
                        <Palmtree className="h-2.5 w-2.5" /> Folga
                      </span>
                    )}
                  </div>
                ))}

                {/* Open slots column header */}
                {hasAnyOpenSlots && (
                  <div
                    style={{ width: OPEN_COL, minWidth: OPEN_COL }}
                    className="flex items-end px-3 py-2.5 shrink-0"
                  >
                    <span className="text-xs font-semibold text-red-600 uppercase tracking-wide">
                      Em Aberto
                    </span>
                  </div>
                )}
              </div>

              {/* ── Event rows ── */}
              {eventRows.map(({ eventId, event }, rowIdx) => {
                const openSlots = openByEvent.get(eventId) ?? [];
                const memberMap = allocByEvent.get(eventId);
                const isLastRow = rowIdx === eventRows.length - 1;

                return (
                  <div
                    key={eventId}
                    className={`flex ${isLastRow ? "" : "border-b"}`}
                  >
                    {/* Sticky activity label */}
                    <div
                      className="flex flex-col justify-center px-4 py-5 border-r bg-white shrink-0 sticky left-0 z-10"
                      style={{ width: LABEL_COL, minWidth: LABEL_COL }}
                    >
                      <div className="flex items-start gap-2">
                        {event?.type === "SHOW" && (
                          <Star
                            className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0"
                            fill="currentColor"
                          />
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-gray-900 leading-tight line-clamp-2">
                            {event?.title ?? scale.title}
                          </p>
                          {event && (
                            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                              {fmtTime(event.startTime)}
                              {event.endTime && ` — ${fmtTime(event.endTime)}`}
                              {event.location && ` · ${event.location}`}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {event?.date ?? scale.periodStart}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Member cells */}
                    {members.map((m) => {
                      const alloc = memberMap?.get(m.userId) ?? null;
                      const hasFolga = folgaUserIds.has(m.userId);
                      return (
                        <GridCell
                          key={m.userId}
                          alloc={alloc}
                          hasFolga={hasFolga}
                          isSupervisor={isSupervisor}
                          onCellClick={alloc ? onCellClick : undefined}
                        />
                      );
                    })}

                    {/* Open slots for this event row */}
                    {hasAnyOpenSlots && (
                      <div
                        style={{ width: OPEN_COL, minWidth: OPEN_COL }}
                        className="px-3 py-4 flex flex-col gap-2 shrink-0"
                      >
                        {openSlots.map((slot) => (
                          <button
                            key={slot.id}
                            onClick={() => onCellClick(slot)}
                            className="w-full text-left rounded-lg border-2 border-dashed border-red-300 bg-red-50 px-3 py-2 hover:bg-red-100 hover:border-red-400 transition-colors group"
                          >
                            <p className="text-xs font-semibold text-red-700 leading-snug">
                              {slot.positionName ?? "Posição"}
                            </p>
                            <p className="text-[10px] text-red-500 mt-0.5 group-hover:text-red-600">
                              {slot.candidates.length > 0
                                ? `${slot.candidates.length} candidato${
                                    slot.candidates.length !== 1 ? "s" : ""
                                  } · ver`
                                : "Sem candidatos"}
                            </p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      {eventRows.length > 0 && (
        <div className="flex items-center gap-5 text-xs text-muted-foreground px-1">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-green-200 inline-block" /> Alocado
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-amber-200 inline-block" /> Conflito
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-purple-200 inline-block" /> Override
          </span>
          <span className="flex items-center gap-1.5">
            <Palmtree className="h-3 w-3" /> Folga
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded border-2 border-dashed border-red-400 inline-block" />{" "}
            Em aberto
          </span>
        </div>
      )}
    </div>
  );
}

// ─── GridCell ─────────────────────────────────────────────────────────────────

function GridCell({
  alloc,
  hasFolga,
  isSupervisor,
  onCellClick,
}: {
  alloc: ScaleAllocationWithCandidates | null;
  hasFolga: boolean;
  isSupervisor: boolean;
  onCellClick?: (alloc: ScaleAllocationWithCandidates) => void;
}) {
  // Determine background based on allocation status
  let bg = "bg-white";
  if (alloc?.status === "CONFLICT") bg = "bg-amber-50";
  else if (alloc?.status === "MANUAL_OVERRIDE") bg = "bg-purple-50";
  else if (alloc?.status === "ASSIGNED") bg = "bg-green-50";
  else if (!alloc && hasFolga) bg = "bg-gray-50";

  const badgeClass =
    alloc?.status === "CONFLICT"
      ? "bg-amber-100 text-amber-800"
      : alloc?.status === "MANUAL_OVERRIDE"
        ? "bg-purple-100 text-purple-800"
        : "bg-green-100 text-green-800";

  const isClickable = !!alloc && isSupervisor && !!onCellClick;

  const inner = alloc ? (
    // Has allocation: show role badge + optional overlays
    <div className="flex flex-col items-center gap-1 text-center w-full">
      <span className={`text-xs font-medium px-1.5 py-0.5 rounded leading-tight ${badgeClass}`}>
        {alloc.positionName ?? "—"}
      </span>
      <div className="flex items-center gap-1">
        {alloc.status === "CONFLICT" && (
          <AlertTriangle className="h-3 w-3 text-amber-500" />
        )}
        {alloc.status === "MANUAL_OVERRIDE" && (
          <span className="text-[9px] text-purple-500">override</span>
        )}
        {/* Folga is an overlay — shows alongside the allocation state */}
        {hasFolga && (
          <span className="flex items-center gap-0.5 text-[9px] text-gray-400">
            <Palmtree className="h-2.5 w-2.5" />
          </span>
        )}
      </div>
      {isClickable && (
        <span className="text-[9px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
          editar
        </span>
      )}
    </div>
  ) : hasFolga ? (
    // No allocation but on folga
    <div className="flex flex-col items-center gap-1 text-gray-400">
      <Palmtree className="h-4 w-4" />
      <span className="text-[10px]">Folga</span>
    </div>
  ) : null;

  if (isClickable) {
    return (
      <button
        className={`border-r flex items-center justify-center px-2 py-5 shrink-0 group hover:brightness-95 transition-all cursor-pointer ${bg}`}
        style={{ width: MEMBER_COL, minWidth: MEMBER_COL }}
        onClick={() => onCellClick!(alloc!)}
        title="Clique para reatribuir / override"
      >
        {inner}
      </button>
    );
  }

  return (
    <div
      className={`border-r flex items-center justify-center px-2 py-5 shrink-0 ${bg}`}
      style={{ width: MEMBER_COL, minWidth: MEMBER_COL }}
    >
      {inner}
    </div>
  );
}

// ─── CandidateList ────────────────────────────────────────────────────────────

interface CandidateListProps {
  alloc: ScaleAllocationWithCandidates;
  isSupervisor: boolean;
  isArchived?: boolean;
  isPending: boolean;
  onAssign: (c: { userId: string; userName?: string | null }) => void;
  onManualOverride: () => void;
}

function CandidateList({
  alloc,
  isSupervisor,
  isArchived,
  isPending,
  onAssign,
  onManualOverride,
}: CandidateListProps) {
  const sorted = [...alloc.candidates].sort((a, b) => a.rank - b.rank);

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
        <User className="h-10 w-10 opacity-20" />
        <p className="text-sm text-center">Nenhum candidato disponível para esta posição.</p>
        {isSupervisor && !isArchived && (
          <Button variant="outline" size="sm" onClick={onManualOverride}>
            Override Manual
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sorted.map((c, idx) => {
        const isTop = idx === 0 && c.compatible && c.eligible;
        const isModerate = c.eligible && !c.compatible;
        const isHigh = !c.eligible;

        return (
          <div
            key={c.id}
            className={`rounded-xl border-2 p-4 ${
              isTop
                ? "border-green-500 bg-green-50"
                : isModerate
                  ? "border-amber-400 bg-amber-50/50"
                  : "border-gray-200 bg-gray-50 opacity-75"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              {isTop && <Badge className="bg-green-600 text-white text-xs">✓ Recomendada</Badge>}
              {isModerate && !isTop && (
                <Badge className="bg-amber-500 text-white text-xs">⚠ Risco moderado</Badge>
              )}
              {isHigh && <Badge className="bg-red-500 text-white text-xs">✕ Risco alto</Badge>}
              <span className="text-xs text-muted-foreground ml-auto">#{c.rank}</span>
            </div>

            <p className={`font-bold mb-1 ${isTop ? "text-xl" : isModerate ? "text-lg" : "text-base"}`}>
              {c.userName ?? "Membro"}
            </p>

            <div className="flex flex-wrap gap-1.5 mb-2">
              {c.compatible && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700">
                  Compatível
                </span>
              )}
              {c.eligible && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700">
                  Elegível
                </span>
              )}
              {!c.compatible && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                  Incompatível
                </span>
              )}
              {!c.eligible && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700">
                  Inelegível
                </span>
              )}
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                Score: {c.priorityScore}
              </span>
            </div>

            {c.rejectionReason && (
              <p className="text-xs text-muted-foreground italic mb-2 leading-relaxed">
                {c.rejectionReason}
              </p>
            )}

            {isSupervisor && !isArchived && (
              <Button
                size="sm"
                className="w-full mt-1"
                variant={isTop ? "default" : "outline"}
                onClick={() => onAssign({ userId: c.userId, userName: c.userName })}
                disabled={isPending}
              >
                Selecionar {c.userName?.split(" ")[0] ?? ""}
              </Button>
            )}
          </div>
        );
      })}

      {isSupervisor && !isArchived && (
        <div className="pt-2 border-t">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-muted-foreground text-xs"
            onClick={onManualOverride}
          >
            Override Manual (inserir ID do usuário)
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── ValidationBar ────────────────────────────────────────────────────────────

interface ValidationBarProps {
  scale: ScaleSummary;
  exclamations: string;
  isSupervisor: boolean;
  onPublish: () => void;
  onRepublish: () => void;
  publishPending: boolean;
  republishPending: boolean;
}

function ValidationBar({
  scale,
  exclamations,
  isSupervisor,
  onPublish,
  onRepublish,
  publishPending,
  republishPending,
}: ValidationBarProps) {
  return (
    <div className="bg-white border-t px-6 py-3 flex items-center justify-between gap-4 shrink-0">
      <div className="flex items-center gap-4 text-sm flex-wrap">
        <Badge variant={STATUS_VARIANTS[scale.status] ?? "secondary"} className="text-xs">
          {STATUS_LABELS[scale.status] ?? scale.status}
        </Badge>
        {scale.assignedCount > 0 && (
          <span className="flex items-center gap-1.5 text-green-700">
            <CheckCircle className="h-3.5 w-3.5" />
            <span>{scale.assignedCount} alocados</span>
          </span>
        )}
        {scale.openCount > 0 && (
          <span className="flex items-center gap-1.5 text-red-600">
            <Clock className="h-3.5 w-3.5" />
            <span>{scale.openCount} em aberto</span>
          </span>
        )}
        {scale.conflictCount > 0 && (
          <span className="flex items-center gap-1.5 text-amber-600">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>{scale.conflictCount} conflitos</span>
          </span>
        )}
        {scale.exceptionCount > 0 && (
          <span className="flex items-center gap-1.5 text-red-600">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>{scale.exceptionCount} exceções</span>
          </span>
        )}
      </div>

      {isSupervisor && (
        <div className="shrink-0">
          {scale.status === "DRAFT" && (
            <Button size="sm" onClick={onPublish} disabled={publishPending}>
              <Send className="h-3.5 w-3.5 mr-1.5" />
              Publicar{exclamations ? ` (${exclamations})` : ""}
            </Button>
          )}
          {(scale.status === "PUBLISHED" || scale.status === "REPUBLISHED") && (
            <Button size="sm" variant="outline" onClick={onRepublish} disabled={republishPending}>
              <Send className="h-3.5 w-3.5 mr-1.5" />
              Republicar{exclamations ? ` (${exclamations})` : ""}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
