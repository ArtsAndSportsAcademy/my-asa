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
  getListScalesQueryKey,
  getListScaleAllocationsQueryKey,
  getListScaleExceptionsQueryKey,
  getListAgendaEventsQueryKey,
  getListShowBooksQueryKey,
  getListFolgasQueryKey,
} from "@workspace/api-client-react";
import type {
  ScaleSummary,
  ScaleAllocationWithCandidates,
  AllocationException,
  AgendaEvent,
  FolgaItem,
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
  ChevronLeft, ChevronRight, Star,
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
  const wd = dt.toLocaleDateString("pt-BR", { weekday: "short" });
  const day = dt.getDate();
  return { wd: wd.replace(".", "").slice(0, 3), day };
}

function fmtTime(t?: string | null) {
  if (!t) return "";
  return t.slice(0, 5);
}

// ─── Form interfaces ──────────────────────────────────────────────────────────

interface GenerateFormState { agendaEventId: string; showBookId: string; title: string; }
interface OverrideFormState { userId: string; reason: string; notes: string; }

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

  // ── Open slot candidate panel ──────────────────────────────────────────────
  const [openSlotAlloc, setOpenSlotAlloc] = useState<ScaleAllocationWithCandidates | null>(null);

  // ── Dialog state ───────────────────────────────────────────────────────────
  const [showGenerate, setShowGenerate] = useState(false);
  const [showOverride, setShowOverride] = useState(false);

  // ── Form state ─────────────────────────────────────────────────────────────
  const [generateForm, setGenerateForm] = useState<GenerateFormState>({
    agendaEventId: "", showBookId: "", title: "",
  });
  const [overrideForm, setOverrideForm] = useState<OverrideFormState>({
    userId: "", reason: "", notes: "",
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

  const folgasEnabled = !!operationId && !!selectedDay;
  const folgasParams = { operationId, dateFrom: selectedDay ?? undefined, dateTo: selectedDay ?? undefined, status: "APPROVED" as any };
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
    setOpenSlotAlloc(null);
  }

  async function handleGenerate() {
    if (!generateForm.agendaEventId || !generateForm.showBookId || !operationId) return;
    try {
      const result = await generateMut.mutateAsync({
        data: {
          agendaEventId: generateForm.agendaEventId,
          showBookId: generateForm.showBookId,
          operationId,
          title: generateForm.title || undefined,
        },
      });
      toast({ title: "Escala gerada", description: `${result.engine.assignedPositions}/${result.engine.totalPositions} posições alocadas.` });
      invalidateScales();
      setShowGenerate(false);
      setGenerateForm({ agendaEventId: "", showBookId: "", title: "" });
      pickScale(result.scale);
    } catch {
      toast({ title: "Erro ao gerar escala", variant: "destructive" });
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
    if (!selectedScale?.id || !openSlotAlloc?.id) return;
    try {
      await overrideMut.mutateAsync({
        id: selectedScale.id,
        allocationId: openSlotAlloc.id,
        data: { userId: candidate.userId, reason: "Selecionado via painel de candidatos" },
      });
      toast({ title: `${candidate.userName ?? "Membro"} alocado com sucesso` });
      invalidateAllocations();
      setOpenSlotAlloc(null);
    } catch { toast({ title: "Erro ao alocar", variant: "destructive" }); }
  }

  async function handleManualOverride() {
    if (!selectedScale?.id || !openSlotAlloc?.id || !overrideForm.userId || !overrideForm.reason) return;
    try {
      await overrideMut.mutateAsync({
        id: selectedScale.id,
        allocationId: openSlotAlloc.id,
        data: { userId: overrideForm.userId, reason: overrideForm.reason, notes: overrideForm.notes || undefined },
      });
      toast({ title: "Override aplicado" });
      invalidateAllocations();
      setShowOverride(false);
      setOpenSlotAlloc(null);
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

  // ── Derived data ───────────────────────────────────────────────────────────
  const scales = useMemo(() => scalesData?.scales ?? [], [scalesData]);
  const allocations = useMemo(() => allocationsData?.allocations ?? [], [allocationsData]);
  const exceptions = useMemo(() => exceptionsData?.exceptions ?? [], [exceptionsData]);
  const folgas: FolgaItem[] = useMemo(() => (folgasData as any)?.folgas ?? [], [folgasData]);
  const folgaUserIds = useMemo(() => new Set(folgas.map((f) => f.userId)), [folgas]);

  const members = useMemo(() => {
    const seen = new Set<string>();
    const result: { userId: string; userName: string }[] = [];
    for (const a of allocations) {
      if (a.userId && !seen.has(a.userId)) {
        seen.add(a.userId);
        result.push({ userId: a.userId, userName: a.userName ?? a.userId.slice(0, 8) });
      }
    }
    return result;
  }, [allocations]);

  const openSlots = useMemo(() => allocations.filter((a) => a.status === "OPEN"), [allocations]);

  const memberAllocMap = useMemo(() => {
    const map: Record<string, ScaleAllocationWithCandidates> = {};
    for (const a of allocations) {
      if (a.userId) map[a.userId] = a;
    }
    return map;
  }, [allocations]);

  const dayRange = useMemo(() => {
    if (!selectedScale) return [];
    return buildDateRange(selectedScale.periodStart, selectedScale.periodEnd);
  }, [selectedScale]);

  const scaleEvent = useMemo((): AgendaEvent | null => {
    const eid = selectedScale?.agendaEventId;
    if (!eid || !eventsData?.events) return null;
    return eventsData.events.find((e) => e.id === eid) ?? null;
  }, [selectedScale, eventsData]);

  const unresolvedExceptions = useMemo(
    () => exceptions.filter((e) => !e.resolvedAt),
    [exceptions]
  );

  const problems = selectedScale ? (selectedScale.openCount + selectedScale.exceptionCount) : 0;
  const exclamations = problems >= 3 ? "!!!" : problems === 2 ? "!!" : problems === 1 ? "!" : "";

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <AdminLayout title="Escalas">
      <div className="flex flex-col overflow-hidden" style={{ height: "calc(100vh - 4rem)" }}>

        {/* ── Top bar: scale selector + action buttons ── */}
        <div className="bg-white border-b px-6 py-2.5 flex items-center gap-3 shrink-0">
          {/* Scale selector dropdown */}
          <div className="flex items-center gap-2 flex-1 min-w-0 max-w-sm">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              disabled={!selectedScale}
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
              <SelectTrigger className="h-8 text-sm font-medium border-0 shadow-none focus:ring-0 px-1">
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
              disabled={!selectedScale}
              onClick={() => {
                const idx = scales.findIndex((s) => s.id === selectedScale?.id);
                if (idx < scales.length - 1) pickScale(scales[idx + 1]!);
              }}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="h-5 border-l shrink-0" />

          {/* Gerar button */}
          {isSupervisor && (
            <Button size="sm" className="h-8" onClick={() => setShowGenerate(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Gerar
            </Button>
          )}

          {/* Actions for selected scale */}
          {selectedScale && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground"
                onClick={() => setLocation(isAdminRole ? "/admin/daily-book" : "/supervisor/daily-book")}
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
                      <DropdownMenuItem onClick={handleRegenerate} disabled={regenerateMut.isPending}>
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

        {/* ── Day strip (only when scale selected) ── */}
        {selectedScale && dayRange.length > 0 && (
          <div className="bg-white border-b px-6 shrink-0">
            <div className="flex gap-1 py-2 overflow-x-auto">
              {dayRange.map((day) => {
                const isSelected = day === selectedDay;
                const isEventDay = scaleEvent?.date === day;
                const { wd, day: d } = fmtDayShort(day);
                const hasIssues = isEventDay && (selectedScale.openCount > 0 || selectedScale.exceptionCount > 0);
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
                    <div className="flex items-center gap-0.5 h-2">
                      {isEventDay && (
                        <Star
                          className="h-2.5 w-2.5"
                          fill={isSelected ? "currentColor" : "none"}
                          style={{ opacity: isSelected ? 0.7 : 0.5 }}
                        />
                      )}
                      {hasIssues && (
                        <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-amber-300" : "bg-amber-400"}`} />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Main content: grid or empty state ── */}
        <div className="flex-1 overflow-hidden">
          {!selectedScale ? (
            <EmptyState isSupervisor={isSupervisor} scalesLoading={scalesLoading} onGenerate={() => setShowGenerate(true)} />
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
                openSlots={openSlots}
                memberAllocMap={memberAllocMap}
                folgaUserIds={folgaUserIds}
                scaleEvent={scaleEvent}
                unresolvedExceptions={unresolvedExceptions}
                isSupervisor={isSupervisor}
                onOpenSlotClick={(alloc) => setOpenSlotAlloc(alloc)}
                onResolveException={handleResolveException}
                resolvePending={resolveMut.isPending}
              />
            </div>
          )}
        </div>

        {/* ── Validation bar (fixed bottom, only when scale selected) ── */}
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
            <DialogTitle>Gerar Nova Escala</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Evento da Agenda *</Label>
              <Select
                value={generateForm.agendaEventId}
                onValueChange={(v) => setGenerateForm((f) => ({ ...f, agendaEventId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o evento" />
                </SelectTrigger>
                <SelectContent>
                  {(eventsData?.events ?? []).map((ev) => (
                    <SelectItem key={ev.id} value={ev.id}>
                      {ev.date} · {ev.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Livro do Show *</Label>
              <Select
                value={generateForm.showBookId}
                onValueChange={(v) => setGenerateForm((f) => ({ ...f, showBookId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o show book" />
                </SelectTrigger>
                <SelectContent>
                  {((showBooksData as any)?.showBooks ?? []).map((sb: any) => (
                    <SelectItem key={sb.id} value={sb.id}>{sb.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Título (opcional)</Label>
              <Input
                placeholder="Será gerado automaticamente se vazio"
                value={generateForm.title}
                onChange={(e) => setGenerateForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenerate(false)}>Cancelar</Button>
            <Button
              onClick={handleGenerate}
              disabled={!generateForm.agendaEventId || !generateForm.showBookId || generateMut.isPending}
            >
              <Zap className="h-4 w-4 mr-1.5" />
              {generateMut.isPending ? "Gerando..." : "Gerar Escala"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Candidate Panel (Sheet) ── */}
      <Sheet open={!!openSlotAlloc} onOpenChange={(open) => { if (!open) setOpenSlotAlloc(null); }}>
        <SheetContent className="w-[420px] sm:w-[480px] overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle className="flex flex-col gap-1">
              <span>Candidatos</span>
              <span className="text-sm font-normal text-muted-foreground">
                Posição: <strong>{openSlotAlloc?.positionName ?? "—"}</strong>
              </span>
            </SheetTitle>
          </SheetHeader>

          {openSlotAlloc && (
            <CandidateList
              alloc={openSlotAlloc}
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
              Posição: <strong>{openSlotAlloc?.positionName ?? "—"}</strong>
            </p>
            <div className="space-y-1.5">
              <Label>ID do Membro *</Label>
              <Input
                value={overrideForm.userId}
                onChange={(e) => setOverrideForm((f) => ({ ...f, userId: e.target.value }))}
                placeholder="UUID do usuário"
              />
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

// ─── ScaleGrid ────────────────────────────────────────────────────────────────

const LABEL_COL = 220;
const MEMBER_COL = 148;
const OPEN_COL = 168;

interface ScaleGridProps {
  scale: ScaleSummary;
  allocations: ScaleAllocationWithCandidates[];
  members: { userId: string; userName: string }[];
  openSlots: ScaleAllocationWithCandidates[];
  memberAllocMap: Record<string, ScaleAllocationWithCandidates>;
  folgaUserIds: Set<string>;
  scaleEvent: AgendaEvent | null;
  unresolvedExceptions: AllocationException[];
  isSupervisor: boolean;
  onOpenSlotClick: (alloc: ScaleAllocationWithCandidates) => void;
  onResolveException: (id: string) => void;
  resolvePending: boolean;
}

function ScaleGrid({
  scale, allocations, members, openSlots, memberAllocMap, folgaUserIds,
  scaleEvent, unresolvedExceptions, isSupervisor, onOpenSlotClick,
  onResolveException, resolvePending,
}: ScaleGridProps) {
  const hasOpenCols = openSlots.length > 0;
  const totalWidth = LABEL_COL + members.length * MEMBER_COL + (hasOpenCols ? OPEN_COL : 0);

  if (allocations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
        <Zap className="h-10 w-10 opacity-15" />
        <p className="text-sm">Nenhuma alocação nesta escala.</p>
      </div>
    );
  }

  const eventTitle = scaleEvent?.title ?? scale.title;
  const eventTime = fmtTime(scaleEvent?.startTime);
  const eventEndTime = fmtTime(scaleEvent?.endTime);
  const eventLocation = scaleEvent?.location ?? "";
  const eventDate = scaleEvent?.date ?? scale.periodStart;

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

      {/* Matrix grid */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <div style={{ minWidth: totalWidth }}>

            {/* ── Header row ── */}
            <div className="flex border-b bg-gray-50/80">
              {/* Fixed label column header */}
              <div
                className="flex items-center px-4 py-2.5 border-r bg-gray-50/80 shrink-0 sticky left-0 z-10"
                style={{ width: LABEL_COL, minWidth: LABEL_COL }}
              >
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Atividade
                </span>
              </div>

              {/* Member columns */}
              {members.map((m) => (
                <div
                  key={m.userId}
                  style={{ width: MEMBER_COL, minWidth: MEMBER_COL }}
                  className="flex flex-col items-center justify-center px-2 py-2.5 border-r shrink-0"
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

              {/* Open slots header */}
              {hasOpenCols && (
                <div
                  style={{ width: OPEN_COL, minWidth: OPEN_COL }}
                  className="flex items-center px-3 py-2.5 shrink-0"
                >
                  <span className="text-xs font-semibold text-red-600 uppercase tracking-wide">
                    Em Aberto ({openSlots.length})
                  </span>
                </div>
              )}
            </div>

            {/* ── Activity row ── */}
            <div className="flex">
              {/* Fixed activity label */}
              <div
                className="flex flex-col justify-center px-4 py-5 border-r bg-white shrink-0 sticky left-0 z-10"
                style={{ width: LABEL_COL, minWidth: LABEL_COL }}
              >
                <div className="flex items-start gap-2">
                  {scaleEvent?.type === "SHOW" && (
                    <Star className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" fill="currentColor" />
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-gray-900 leading-tight line-clamp-2">
                      {eventTitle}
                    </p>
                    {(eventTime || eventLocation) && (
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        {eventTime && (
                          <span>{eventTime}{eventEndTime ? ` — ${eventEndTime}` : ""}</span>
                        )}
                        {eventTime && eventLocation && " · "}
                        {eventLocation && <span>{eventLocation}</span>}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5">{eventDate}</p>
                  </div>
                </div>
              </div>

              {/* Member cells */}
              {members.map((m) => {
                const alloc = memberAllocMap[m.userId];
                const hasFolga = folgaUserIds.has(m.userId);

                if (hasFolga) {
                  return (
                    <MemberCell key={m.userId} state="folga" label="" />
                  );
                }
                if (!alloc) {
                  return <MemberCell key={m.userId} state="empty" label="" />;
                }
                if (alloc.status === "CONFLICT") {
                  return <MemberCell key={m.userId} state="conflict" label={alloc.positionName ?? "—"} />;
                }
                return (
                  <MemberCell
                    key={m.userId}
                    state={alloc.status === "MANUAL_OVERRIDE" ? "override" : "assigned"}
                    label={alloc.positionName ?? "—"}
                  />
                );
              })}

              {/* Open slots */}
              {hasOpenCols && (
                <div
                  style={{ width: OPEN_COL, minWidth: OPEN_COL }}
                  className="px-3 py-4 flex flex-col gap-2 shrink-0"
                >
                  {openSlots.map((slot) => (
                    <button
                      key={slot.id}
                      onClick={() => onOpenSlotClick(slot)}
                      className="w-full text-left rounded-lg border-2 border-dashed border-red-300 bg-red-50 px-3 py-2 hover:bg-red-100 hover:border-red-400 transition-colors group"
                    >
                      <p className="text-xs font-semibold text-red-700 leading-snug">
                        {slot.positionName ?? "Posição"}
                      </p>
                      <p className="text-[10px] text-red-500 mt-0.5 group-hover:text-red-600">
                        {slot.candidates.length > 0
                          ? `${slot.candidates.length} candidato${slot.candidates.length !== 1 ? "s" : ""} · ver`
                          : "Sem candidatos"}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* Legend */}
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
          <span className="w-3 h-3 rounded border-2 border-dashed border-red-400 inline-block" /> Em aberto
        </span>
      </div>
    </div>
  );
}

// ─── MemberCell ───────────────────────────────────────────────────────────────

type CellState = "empty" | "assigned" | "conflict" | "override" | "folga";

function MemberCell({ state, label }: { state: CellState; label: string }) {
  const base = "shrink-0 border-r flex items-center justify-center px-2 py-5";
  const configs: Record<CellState, { bg: string; badge: string }> = {
    empty: { bg: "bg-white", badge: "" },
    assigned: { bg: "bg-green-50", badge: "bg-green-100 text-green-800" },
    conflict: { bg: "bg-amber-50", badge: "bg-amber-100 text-amber-800" },
    override: { bg: "bg-purple-50", badge: "bg-purple-100 text-purple-800" },
    folga: { bg: "bg-gray-50", badge: "" },
  };
  const cfg = configs[state];

  return (
    <div
      className={`${base} ${cfg.bg}`}
      style={{ width: MEMBER_COL, minWidth: MEMBER_COL }}
    >
      {state === "folga" && (
        <div className="flex flex-col items-center gap-1 text-gray-400">
          <Palmtree className="h-4 w-4" />
          <span className="text-[10px]">Folga</span>
        </div>
      )}
      {state === "conflict" && label && (
        <div className="flex flex-col items-center gap-1 text-center">
          <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${cfg.badge} leading-tight`}>
            {label}
          </span>
          <AlertTriangle className="h-3 w-3 text-amber-500" />
        </div>
      )}
      {(state === "assigned" || state === "override") && label && (
        <div className="text-center">
          <span className={`text-xs font-medium px-1.5 py-0.5 rounded leading-tight ${cfg.badge}`}>
            {label}
          </span>
          {state === "override" && (
            <p className="text-[9px] text-purple-500 mt-0.5">override</p>
          )}
        </div>
      )}
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

function CandidateList({ alloc, isSupervisor, isArchived, isPending, onAssign, onManualOverride }: CandidateListProps) {
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
              isTop ? "border-green-500 bg-green-50" :
              isModerate ? "border-amber-400 bg-amber-50/50" :
              "border-gray-200 bg-gray-50 opacity-75"
            }`}
          >
            {/* Tag row */}
            <div className="flex items-center justify-between mb-2">
              {isTop && (
                <Badge className="bg-green-600 text-white text-xs">✓ Recomendada</Badge>
              )}
              {isModerate && !isTop && (
                <Badge className="bg-amber-500 text-white text-xs">⚠ Risco moderado</Badge>
              )}
              {isHigh && (
                <Badge className="bg-red-500 text-white text-xs">✕ Risco alto</Badge>
              )}
              <span className="text-xs text-muted-foreground ml-auto">#{c.rank}</span>
            </div>

            {/* Name */}
            <p className={`font-bold mb-1 ${isTop ? "text-xl" : isModerate ? "text-lg" : "text-base"}`}>
              {c.userName ?? "Membro"}
            </p>

            {/* Attributes */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              {c.compatible && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700">Compatível</span>
              )}
              {c.eligible && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700">Elegível</span>
              )}
              {!c.compatible && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">Incompatível</span>
              )}
              {!c.eligible && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700">Inelegível</span>
              )}
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                Score: {c.priorityScore}
              </span>
            </div>

            {/* Rejection reason */}
            {c.rejectionReason && (
              <p className="text-xs text-muted-foreground italic mb-2 leading-relaxed">{c.rejectionReason}</p>
            )}

            {/* Action button */}
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

      {/* Manual override link */}
      {isSupervisor && !isArchived && (
        <div className="pt-2 border-t">
          <Button variant="ghost" size="sm" className="w-full text-muted-foreground text-xs" onClick={onManualOverride}>
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

function ValidationBar({ scale, exclamations, isSupervisor, onPublish, onRepublish, publishPending, republishPending }: ValidationBarProps) {
  return (
    <div className="bg-white border-t px-6 py-3 flex items-center justify-between gap-4 shrink-0">
      {/* Left: status + counts */}
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

      {/* Right: publish action */}
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
