import { useState } from "react";
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
  getListScalesQueryKey,
  getListScaleAllocationsQueryKey,
  getListScaleExceptionsQueryKey,
  getListAgendaEventsQueryKey,
  getListShowBooksQueryKey,
} from "@workspace/api-client-react";
import type {
  ScaleSummary,
  ScaleAllocationWithCandidates,
  AllocationException,
} from "@workspace/api-client-react";
import AdminLayout from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  Plus, RefreshCw, Send, AlertTriangle, CheckCircle,
  Clock, Users, MoreHorizontal, Archive, Zap, ChevronRight,
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Rascunho", PUBLISHED: "Publicada", REPUBLISHED: "Republicada", ARCHIVED: "Arquivada",
};
const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  DRAFT: "secondary", PUBLISHED: "default", REPUBLISHED: "default", ARCHIVED: "outline",
};
const ALLOC_STATUS_LABELS: Record<string, string> = {
  ASSIGNED: "Alocado", OPEN: "Em Aberto", CONFLICT: "Conflito", MANUAL_OVERRIDE: "Override Manual",
};
const ALLOC_STATUS_COLORS: Record<string, string> = {
  ASSIGNED: "bg-green-100 text-green-800",
  OPEN: "bg-gray-100 text-gray-700",
  CONFLICT: "bg-yellow-100 text-yellow-800",
  MANUAL_OVERRIDE: "bg-purple-100 text-purple-800",
};
const EXC_TYPE_LABELS: Record<string, string> = {
  NO_CANDIDATE: "Sem Candidato", RESTRICTION: "Restrição", CONFLICT: "Conflito",
  INSUFFICIENT_COVERAGE: "Cobertura Insuficiente", SUPERVISOR_OVERRIDE: "Override Supervisor",
};

interface GenerateFormState {
  agendaEventId: string;
  showBookId: string;
  title: string;
}
interface OverrideFormState {
  userId: string;
  reason: string;
  notes: string;
}

export default function ScalesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const auth = useAuth();
  const operationId = auth.roles.find((r) => r.operationId)?.operationId;
  const isSupervisor = auth.roles.some((r) =>
    ["ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"].includes(r.role)
  );

  // List filters
  const [filterStatus, setFilterStatus] = useState<string>("");

  // Selected scale
  const [selectedScale, setSelectedScale] = useState<ScaleSummary | null>(null);
  const [detailTab, setDetailTab] = useState<"allocations" | "exceptions">("allocations");

  // Selected allocation for override
  const [selectedAllocation, setSelectedAllocation] = useState<ScaleAllocationWithCandidates | null>(null);

  // Dialogs
  const [showGenerate, setShowGenerate] = useState(false);
  const [showOverride, setShowOverride] = useState(false);

  // Forms
  const [generateForm, setGenerateForm] = useState<GenerateFormState>({
    agendaEventId: "", showBookId: "", title: "",
  });
  const [overrideForm, setOverrideForm] = useState<OverrideFormState>({
    userId: "", reason: "", notes: "",
  });

  // Queries
  const scalesParams = {
    operationId,
    status: (filterStatus === "ALL" || !filterStatus) ? undefined : filterStatus as any,
  };
  const { data: scalesData, isLoading: scalesLoading } = useListScales(scalesParams, {
    query: { queryKey: getListScalesQueryKey(scalesParams), enabled: !!operationId },
  });

  const { data: allocationsData, isLoading: allocLoading } = useListScaleAllocations(
    selectedScale?.id ?? "",
    {
      query: {
        queryKey: getListScaleAllocationsQueryKey(selectedScale?.id ?? ""),
        enabled: !!selectedScale?.id,
      },
    }
  );

  const { data: exceptionsData, isLoading: excLoading } = useListScaleExceptions(
    selectedScale?.id ?? "",
    {
      query: {
        queryKey: getListScaleExceptionsQueryKey(selectedScale?.id ?? ""),
        enabled: !!selectedScale?.id,
      },
    }
  );

  // Events and show books for generate form
  const eventsParams = { operationId };
  const { data: eventsData } = useListAgendaEvents(eventsParams, {
    query: { queryKey: getListAgendaEventsQueryKey(eventsParams), enabled: !!operationId && showGenerate },
  });
  const showBooksParams = { operationId } as any;
  const { data: showBooksData } = useListShowBooks(showBooksParams, {
    query: { queryKey: getListShowBooksQueryKey(showBooksParams), enabled: !!operationId && showGenerate },
  });

  // Mutations
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

  // Generate scale
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
      setSelectedScale(result.scale);
    } catch {
      toast({ title: "Erro ao gerar escala", variant: "destructive" });
    }
  }

  // Publish
  async function handlePublish(scaleId: string) {
    try {
      await publishMut.mutateAsync({ id: scaleId });
      toast({ title: "Escala publicada" });
      invalidateScales();
    } catch {
      toast({ title: "Erro ao publicar", variant: "destructive" });
    }
  }

  // Republish
  async function handleRepublish(scaleId: string) {
    try {
      await republishMut.mutateAsync({ id: scaleId });
      toast({ title: "Escala republicada" });
      invalidateScales();
    } catch {
      toast({ title: "Erro ao republicar", variant: "destructive" });
    }
  }

  // Archive
  async function handleArchive(scaleId: string) {
    try {
      await archiveMut.mutateAsync({ id: scaleId });
      toast({ title: "Escala arquivada" });
      invalidateScales();
      if (selectedScale?.id === scaleId) setSelectedScale(null);
    } catch {
      toast({ title: "Erro ao arquivar", variant: "destructive" });
    }
  }

  // Regenerate
  async function handleRegenerate(scaleId: string) {
    try {
      const result = await regenerateMut.mutateAsync({ id: scaleId });
      toast({ title: "Escala regenerada", description: `${result.engine.assignedPositions}/${result.engine.totalPositions} posições alocadas.` });
      invalidateScales();
      invalidateAllocations();
    } catch {
      toast({ title: "Erro ao regenerar", variant: "destructive" });
    }
  }

  // Manual override
  async function handleOverride() {
    if (!selectedScale?.id || !selectedAllocation?.id || !overrideForm.userId || !overrideForm.reason) return;
    try {
      await overrideMut.mutateAsync({
        id: selectedScale.id,
        allocationId: selectedAllocation.id,
        data: { userId: overrideForm.userId, reason: overrideForm.reason, notes: overrideForm.notes || undefined },
      });
      toast({ title: "Alocação substituída manualmente" });
      invalidateAllocations();
      setShowOverride(false);
      setOverrideForm({ userId: "", reason: "", notes: "" });
    } catch {
      toast({ title: "Erro no override", variant: "destructive" });
    }
  }

  // Resolve exception
  async function handleResolveException(excId: string) {
    if (!selectedScale?.id) return;
    try {
      await resolveMut.mutateAsync({ id: selectedScale.id, exceptionId: excId });
      toast({ title: "Exceção resolvida" });
      invalidateAllocations();
    } catch {
      toast({ title: "Erro ao resolver exceção", variant: "destructive" });
    }
  }

  const scales = scalesData?.scales ?? [];
  const allocations = allocationsData?.allocations ?? [];
  const exceptions = exceptionsData?.exceptions ?? [];

  return (
    <AdminLayout title="Escalas">
      <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
        {/* ── Left Panel: Scale List ── */}
        <div className="w-80 border-r flex flex-col bg-background shrink-0">
          {/* Header */}
          <div className="p-4 border-b space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-lg">Escalas</h2>
              {isSupervisor && (
                <Button size="sm" onClick={() => setShowGenerate(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Gerar
                </Button>
              )}
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos os status</SelectItem>
                <SelectItem value="DRAFT">Rascunho</SelectItem>
                <SelectItem value="PUBLISHED">Publicada</SelectItem>
                <SelectItem value="REPUBLISHED">Republicada</SelectItem>
                <SelectItem value="ARCHIVED">Arquivada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Scale list */}
          <div className="flex-1 overflow-y-auto">
            {scalesLoading ? (
              <div className="p-4 text-center text-muted-foreground text-sm">Carregando...</div>
            ) : scales.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                <Zap className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p>Nenhuma escala encontrada.</p>
                {isSupervisor && (
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => setShowGenerate(true)}>
                    Gerar primeira escala
                  </Button>
                )}
              </div>
            ) : (
              scales.map((scale) => (
                <button
                  key={scale.id}
                  onClick={() => { setSelectedScale(scale); setDetailTab("allocations"); }}
                  className={`w-full text-left px-4 py-3 border-b hover:bg-muted/50 transition-colors ${selectedScale?.id === scale.id ? "bg-muted" : ""}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{scale.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {scale.periodStart} → {scale.periodEnd}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge variant={STATUS_VARIANTS[scale.status] ?? "secondary"} className="text-xs">
                        {STATUS_LABELS[scale.status] ?? scale.status}
                      </Badge>
                      {scale.exceptionCount > 0 && (
                        <span className="text-xs text-amber-600 flex items-center gap-0.5">
                          <AlertTriangle className="h-3 w-3" />{scale.exceptionCount}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-3 mt-1.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-0.5">
                      <CheckCircle className="h-3 w-3 text-green-500" /> {scale.assignedCount}
                    </span>
                    <span className="flex items-center gap-0.5">
                      <Clock className="h-3 w-3 text-gray-400" /> {scale.openCount}
                    </span>
                    {scale.conflictCount > 0 && (
                      <span className="flex items-center gap-0.5">
                        <AlertTriangle className="h-3 w-3 text-amber-500" /> {scale.conflictCount}
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* ── Right Panel: Detail ── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!selectedScale ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <ChevronRight className="h-10 w-10 mx-auto mb-2 opacity-20" />
                <p className="text-sm">Selecione uma escala para ver detalhes</p>
              </div>
            </div>
          ) : (
            <>
              {/* Scale header */}
              <div className="p-4 border-b flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{selectedScale.title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {selectedScale.periodStart} → {selectedScale.periodEnd} ·{" "}
                    <Badge variant={STATUS_VARIANTS[selectedScale.status] ?? "secondary"} className="text-xs">
                      {STATUS_LABELS[selectedScale.status]}
                    </Badge>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {isSupervisor && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {selectedScale.status === "DRAFT" && (
                          <>
                            <DropdownMenuItem onClick={() => handleRegenerate(selectedScale.id)} disabled={regenerateMut.isPending}>
                              <RefreshCw className="h-4 w-4 mr-2" /> Regenerar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handlePublish(selectedScale.id)} disabled={publishMut.isPending}>
                              <Send className="h-4 w-4 mr-2" /> Publicar
                            </DropdownMenuItem>
                          </>
                        )}
                        {(selectedScale.status === "PUBLISHED" || selectedScale.status === "REPUBLISHED") && (
                          <DropdownMenuItem onClick={() => handleRepublish(selectedScale.id)} disabled={republishMut.isPending}>
                            <Send className="h-4 w-4 mr-2" /> Republicar
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleArchive(selectedScale.id)}
                          className="text-destructive"
                          disabled={archiveMut.isPending}
                        >
                          <Archive className="h-4 w-4 mr-2" /> Arquivar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>

              {/* Stats bar */}
              <div className="px-4 py-2 border-b flex gap-6 text-sm">
                <span className="flex items-center gap-1.5 text-green-700">
                  <CheckCircle className="h-4 w-4" />
                  <strong>{selectedScale.assignedCount}</strong> alocados
                </span>
                <span className="flex items-center gap-1.5 text-gray-500">
                  <Clock className="h-4 w-4" />
                  <strong>{selectedScale.openCount}</strong> em aberto
                </span>
                {selectedScale.conflictCount > 0 && (
                  <span className="flex items-center gap-1.5 text-amber-600">
                    <AlertTriangle className="h-4 w-4" />
                    <strong>{selectedScale.conflictCount}</strong> conflitos
                  </span>
                )}
                {selectedScale.exceptionCount > 0 && (
                  <span className="flex items-center gap-1.5 text-red-600">
                    <AlertTriangle className="h-4 w-4" />
                    <strong>{selectedScale.exceptionCount}</strong> exceções abertas
                  </span>
                )}
              </div>

              {/* Tabs */}
              <Tabs value={detailTab} onValueChange={(v) => setDetailTab(v as any)} className="flex-1 flex flex-col overflow-hidden">
                <TabsList className="mx-4 mt-3 w-fit">
                  <TabsTrigger value="allocations">
                    <Users className="h-3.5 w-3.5 mr-1.5" /> Alocações ({selectedScale.totalAllocations})
                  </TabsTrigger>
                  <TabsTrigger value="exceptions">
                    <AlertTriangle className="h-3.5 w-3.5 mr-1.5" /> Exceções ({selectedScale.exceptionCount})
                  </TabsTrigger>
                </TabsList>

                {/* Allocations tab */}
                <TabsContent value="allocations" className="flex-1 overflow-auto px-4 pb-4 mt-2">
                  {allocLoading ? (
                    <p className="text-center text-sm text-muted-foreground py-8">Carregando alocações...</p>
                  ) : allocations.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-8">Nenhuma alocação encontrada.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Posição</TableHead>
                          <TableHead>Alocado</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Candidatos</TableHead>
                          {isSupervisor && <TableHead className="w-16"></TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {allocations.map((alloc) => (
                          <TableRow key={alloc.id}>
                            <TableCell className="font-medium text-sm">
                              {alloc.positionName ?? "—"}
                            </TableCell>
                            <TableCell className="text-sm">
                              {alloc.userName ?? <span className="text-muted-foreground italic">Sem alocação</span>}
                            </TableCell>
                            <TableCell>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ALLOC_STATUS_COLORS[alloc.status] ?? "bg-gray-100 text-gray-700"}`}>
                                {ALLOC_STATUS_LABELS[alloc.status] ?? alloc.status}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {alloc.candidates.length > 0 ? (
                                <span>{alloc.candidates.filter((c) => c.compatible).length} compatíveis</span>
                              ) : "—"}
                            </TableCell>
                            {isSupervisor && selectedScale.status !== "ARCHIVED" && (
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => { setSelectedAllocation(alloc); setShowOverride(true); }}
                                >
                                  Override
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>

                {/* Exceptions tab */}
                <TabsContent value="exceptions" className="flex-1 overflow-auto px-4 pb-4 mt-2">
                  {excLoading ? (
                    <p className="text-center text-sm text-muted-foreground py-8">Carregando exceções...</p>
                  ) : exceptions.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500 opacity-70" />
                      <p className="text-sm">Nenhuma exceção registrada.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {exceptions.map((exc) => (
                        <div
                          key={exc.id}
                          className={`rounded-lg border p-4 ${exc.resolvedAt ? "opacity-60" : ""}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-semibold bg-red-100 text-red-700 px-2 py-0.5 rounded">
                                  {EXC_TYPE_LABELS[exc.type] ?? exc.type}
                                </span>
                                {exc.positionName && (
                                  <span className="text-xs text-muted-foreground">· {exc.positionName}</span>
                                )}
                              </div>
                              <p className="text-sm">{exc.reason}</p>
                              {exc.impact && (
                                <p className="text-xs text-muted-foreground mt-0.5">{exc.impact}</p>
                              )}
                              {exc.resolvedAt && (
                                <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                                  <CheckCircle className="h-3 w-3" /> Resolvida
                                </p>
                              )}
                            </div>
                            {isSupervisor && !exc.resolvedAt && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs shrink-0"
                                disabled={resolveMut.isPending}
                                onClick={() => handleResolveException(exc.id)}
                              >
                                Resolver
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>
      </div>

      {/* ── Generate Scale Dialog ── */}
      <Dialog open={showGenerate} onOpenChange={setShowGenerate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Gerar Nova Escala</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Evento da Agenda *</Label>
              <Select value={generateForm.agendaEventId} onValueChange={(v) => setGenerateForm((f) => ({ ...f, agendaEventId: v }))}>
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
              <Select value={generateForm.showBookId} onValueChange={(v) => setGenerateForm((f) => ({ ...f, showBookId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o show book" />
                </SelectTrigger>
                <SelectContent>
                  {(showBooksData?.showBooks ?? []).map((sb) => (
                    <SelectItem key={sb.id} value={sb.id}>
                      {sb.title}
                    </SelectItem>
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

      {/* ── Override Allocation Dialog ── */}
      <Dialog open={showOverride} onOpenChange={setShowOverride}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Override Manual</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Substituindo alocação da posição: <strong>{selectedAllocation?.positionName ?? "—"}</strong>
            </p>
            <div className="space-y-1.5">
              <Label>ID do Novo Membro *</Label>
              <Input
                placeholder="UUID do usuário"
                value={overrideForm.userId}
                onChange={(e) => setOverrideForm((f) => ({ ...f, userId: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Motivo *</Label>
              <Input
                placeholder="Ex: Titular indisponível de última hora"
                value={overrideForm.reason}
                onChange={(e) => setOverrideForm((f) => ({ ...f, reason: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Notas</Label>
              <Textarea
                placeholder="Observações adicionais..."
                rows={2}
                value={overrideForm.notes}
                onChange={(e) => setOverrideForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOverride(false)}>Cancelar</Button>
            <Button
              onClick={handleOverride}
              disabled={!overrideForm.userId || !overrideForm.reason || overrideMut.isPending}
            >
              {overrideMut.isPending ? "Salvando..." : "Confirmar Override"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
