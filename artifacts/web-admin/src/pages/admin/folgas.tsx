import { useState, useCallback } from "react";
import AdminLayout from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MemberCombobox } from "@/components/member-combobox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListFolgas,
  useCreateFolga,
  useUpdateFolga,
  useCancelFolga,
  useBulkFillFolgas,
  useResetFolgasGrid,
  useGetOperations,
  useGetFolgasGrid,
  useListUsers,
  getListFolgasQueryKey,
  getGetFolgasGridQueryKey,
} from "@workspace/api-client-react";
import type { FolgaItem } from "@workspace/api-client-react";
import { FolgasGrid, MONTH_NAMES } from "@/components/folgas-grid";
import { Palmtree, Plus, Pencil, XCircle, Loader2, ChevronLeft, ChevronRight, Grid3X3, List, Users } from "lucide-react";
import { AsaAvatar } from "@/components/AsaAvatar";
import { AsaConfirmDialog } from "@/components/AsaConfirmDialog";

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  DAY_OFF:     "Folga",
  NO_SHOW:     "Folga",
  RECESSO:     "Recesso",
  AFASTAMENTO: "Afastamento",
  RESTRICAO:   "Restrição",
  OUTRO:       "Outro",
};

const TYPE_OPTIONS = [
  { value: "__all__", label: "Todos os tipos" },
  { value: "DAY_OFF",     label: "Folga" },
  { value: "RECESSO",     label: "Recesso" },
  { value: "AFASTAMENTO", label: "Afastamento" },
  { value: "RESTRICAO",   label: "Restrição" },
  { value: "OUTRO",       label: "Outro" },
];

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:    "bg-green-100 text-green-800 border-green-200",
  CANCELLED: "bg-red-100 text-red-800 border-red-200",
};

const ORIGEM_LABELS: Record<string, string> = {
  MANUAL:      "Manual",
  SOLICITACAO: "Solicitação",
};

const GRID_TYPE_OPTIONS = [
  { value: "DAY_OFF", label: "F — Folga" },
  { value: "RECESSO", label: "R — Recesso" },
  { value: "OUTRO",   label: "O — Outro" },
];

// ─── Create/Edit modal ────────────────────────────────────────────────────────

function FolgaModal({
  open, onClose, operationId: defaultOpId, editing,
}: {
  open: boolean;
  onClose: () => void;
  operationId?: string;
  editing?: FolgaItem;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: opsData } = useGetOperations();
  const operations = opsData?.operations ?? [];
  const { data: usersData } = useListUsers();
  const users = usersData?.users ?? [];

  const [userId,      setUserId]      = useState(editing?.userId      ?? "");
  const [operationId, setOperationId] = useState(editing?.operationId ?? defaultOpId ?? "");
  const [type,        setType]        = useState<string>(editing?.type ?? "DAY_OFF");
  const [startDate,   setStartDate]   = useState(editing?.startDate   ?? "");
  const [endDate,     setEndDate]     = useState(editing?.endDate     ?? "");
  const [notes,       setNotes]       = useState(editing?.notes       ?? "");

  const { mutate: createFolga, isPending: isCreating } = useCreateFolga({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListFolgasQueryKey() });
        toast({ title: "Folga registrada com sucesso" });
        onClose();
      },
      onError: () => toast({ title: "Erro ao registrar folga", variant: "destructive" }),
    },
  });

  const { mutate: updateFolga, isPending: isUpdating } = useUpdateFolga({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListFolgasQueryKey() });
        toast({ title: "Folga atualizada" });
        onClose();
      },
      onError: () => toast({ title: "Erro ao atualizar folga", variant: "destructive" }),
    },
  });

  const isPending = isCreating || isUpdating;

  function handleSubmit() {
    if (!userId || !operationId || !startDate || !endDate) {
      toast({ title: "Preencha todos os campos obrigatórios", variant: "destructive" });
      return;
    }
    if (editing) {
      updateFolga({ id: editing.id, data: { type: type as any, startDate, endDate, notes } });
    } else {
      createFolga({ data: { userId, operationId, type: type as any, startDate, endDate, notes } });
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar Folga" : "Nova Folga"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {!editing && (
            <>
              <div className="space-y-1">
                <Label>Membro <span className="text-destructive">*</span></Label>
                <MemberCombobox value={userId} onChange={setUserId} users={users} placeholder="Selecione o membro" />
              </div>
              <div className="space-y-1">
                <Label>Operação <span className="text-destructive">*</span></Label>
                <Select value={operationId} onValueChange={setOperationId}>
                  <SelectTrigger><SelectValue placeholder="Selecione a operação" /></SelectTrigger>
                  <SelectContent>
                    {operations.map((op) => (
                      <SelectItem key={op.id} value={op.id}>{op.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          <div className="space-y-1">
            <Label>Tipo <span className="text-destructive">*</span></Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.filter((o) => o.value !== "__all__").map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Início <span className="text-destructive">*</span></Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Fim <span className="text-destructive">*</span></Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Observações</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {editing ? "Salvar" : "Registrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Fill Period dialog ───────────────────────────────────────────────────────

function FillPeriodDialog({
  open, onClose, operationId, year, month,
}: {
  open: boolean; onClose: () => void;
  operationId: string; year: number; month: number;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: gridData } = useGetFolgasGrid(
    { operationId, year, month },
    { query: { enabled: !!operationId } } as any,
  );
  const members = gridData?.members ?? [];

  const [userId,    setUserId]    = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate,   setEndDate]   = useState("");
  const [type,      setType]      = useState("DAY_OFF");

  const { mutate: bulkFill, isPending } = useBulkFillFolgas({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetFolgasGridQueryKey({ operationId, year, month }) });
        toast({ title: "Período preenchido com sucesso" });
        onClose();
        setUserId(""); setStartDate(""); setEndDate("");
      },
      onError: () => toast({ title: "Erro ao preencher período", variant: "destructive" }),
    },
  });

  function handleSubmit() {
    if (!userId || !startDate || !endDate) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }
    const dates: string[] = [];
    const cur = new Date(startDate + "T00:00:00Z");
    const end = new Date(endDate + "T00:00:00Z");
    while (cur <= end) {
      dates.push(cur.toISOString().slice(0, 10));
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    if (dates.length === 0) {
      toast({ title: "Intervalo inválido", variant: "destructive" });
      return;
    }
    bulkFill({ data: { userId, operationId, dates, type: type as any } });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Preencher Período</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Membro <span className="text-destructive">*</span></Label>
            <MemberCombobox value={userId} onChange={setUserId} users={members.map(m => ({ id: m.userId, name: m.name }))} placeholder="Selecione o membro" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Data inicial <span className="text-destructive">*</span></Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Data final <span className="text-destructive">*</span></Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Tipo <span className="text-destructive">*</span></Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {GRID_TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Preencher
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Clear Period dialog ──────────────────────────────────────────────────────

function ClearPeriodDialog({
  open, onClose, operationId, year, month,
}: {
  open: boolean; onClose: () => void;
  operationId: string; year: number; month: number;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: gridDataClear } = useGetFolgasGrid(
    { operationId, year, month },
    { query: { enabled: !!operationId } } as any,
  );
  const membersClear = gridDataClear?.members ?? [];

  const [userId,    setUserId]    = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate,   setEndDate]   = useState("");

  const { mutate: bulkFill, isPending } = useBulkFillFolgas({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetFolgasGridQueryKey({ operationId, year, month }) });
        toast({ title: "Período limpo com sucesso" });
        onClose();
        setUserId(""); setStartDate(""); setEndDate("");
      },
      onError: () => toast({ title: "Erro ao limpar período", variant: "destructive" }),
    },
  });

  function handleSubmit() {
    if (!userId || !startDate || !endDate) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }
    const dates: string[] = [];
    const cur = new Date(startDate + "T00:00:00Z");
    const end = new Date(endDate + "T00:00:00Z");
    while (cur <= end) {
      dates.push(cur.toISOString().slice(0, 10));
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    if (dates.length === 0) {
      toast({ title: "Intervalo inválido", variant: "destructive" });
      return;
    }
    bulkFill({ data: { userId, operationId, dates, type: undefined } });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Limpar Período</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Membro <span className="text-destructive">*</span></Label>
            <MemberCombobox value={userId} onChange={setUserId} users={membersClear.map(m => ({ id: m.userId, name: m.name }))} placeholder="Selecione o membro" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Data inicial <span className="text-destructive">*</span></Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Data final <span className="text-destructive">*</span></Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancelar</Button>
          <Button variant="destructive" onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Limpar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Reset confirm dialog ─────────────────────────────────────────────────────

function ResetDialog({
  open, onClose, operationId, year, month,
}: {
  open: boolean; onClose: () => void;
  operationId: string; year: number; month: number;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { mutate: reset, isPending } = useResetFolgasGrid({
    mutation: {
      onSuccess: (data) => {
        qc.invalidateQueries({ queryKey: getGetFolgasGridQueryKey({ operationId, year, month }) });
        toast({ title: `${(data as any).cancelled ?? 0} folgas canceladas` });
        onClose();
      },
      onError: () => toast({ title: "Erro ao resetar mês", variant: "destructive" }),
    },
  });

  return (
    <AsaConfirmDialog
      open={open}
      onClose={onClose}
      title="Resetar Folgas do Mês"
      bubbleText="Tem certeza? Isso cancela todas as folgas ativas do mês e não pode ser desfeito. ⚠️"
      description={
        <>
          Esta ação vai <strong>cancelar todas as folgas ativas</strong> da operação em{" "}
          <strong>{MONTH_NAMES[month - 1]} {year}</strong>.
        </>
      }
      confirmLabel="Resetar mês"
      isPending={isPending}
      onConfirm={() => reset({ params: { operationId, year, month } })}
    />
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function FolgasContent() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const today = new Date();
  const [view, setView] = useState<"grid" | "records">("grid");
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  const [operationId,  setOperationId]  = useState("__all__");
  const [memberFilter, setMemberFilter] = useState("");
  const [groupByGroup, setGroupByGroup] = useState(false);

  const [type,        setType]        = useState("__all__");
  const [status,      setStatus]      = useState("ACTIVE");
  const [dateFrom,    setDateFrom]    = useState("");
  const [dateTo,      setDateTo]      = useState("");

  const [modalOpen,       setModalOpen]       = useState(false);
  const [editing,         setEditing]         = useState<FolgaItem | undefined>();
  const [fillOpen,        setFillOpen]        = useState(false);
  const [clearOpen,       setClearOpen]       = useState(false);
  const [resetOpen,       setResetOpen]       = useState(false);
  const [cancelTarget,    setCancelTarget]    = useState<FolgaItem | undefined>();

  const { data: opsData } = useGetOperations();
  const operations = opsData?.operations ?? [];

  const activeOpId = operationId === "__all__" ? "" : operationId;

  const params = {
    ...(operationId !== "__all__" ? { operationId } : {}),
    ...(type !== "__all__"        ? { type: type as any } : {}),
    ...(status !== "__all__"      ? { status: status as any } : {}),
    ...(dateFrom ? { dateFrom } : {}),
    ...(dateTo   ? { dateTo }   : {}),
  };

  const { data, isLoading } = useListFolgas(params, { query: { enabled: view === "records" } } as any);
  const folgas = data?.folgas ?? [];

  const { mutate: cancelFolga, isPending: isCancelling } = useCancelFolga({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListFolgasQueryKey() });
        toast({ title: "Folga cancelada" });
        setCancelTarget(undefined);
      },
      onError: () => toast({ title: "Erro ao cancelar folga", variant: "destructive" }),
    },
  });

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  }

  return (
    <>
      <div className="max-w-[1400px] mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <Palmtree className="w-5 h-5 text-green-700" />
            </div>
            <div>
              <h1 className="text-2xl font-serif font-bold">Folgas</h1>
              <p className="text-sm text-muted-foreground">Quem estará ausente e quando?</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {view === "grid" && activeOpId && (
              <>
                <Button variant="outline" size="sm" onClick={() => setFillOpen(true)}>
                  Preencher Período
                </Button>
                <Button variant="outline" size="sm" onClick={() => setClearOpen(true)}>
                  Limpar Período
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive border-destructive/40 hover:bg-destructive/5"
                  onClick={() => setResetOpen(true)}
                >
                  Resetar Mês
                </Button>
              </>
            )}
            <Button size="sm" className="gap-2" onClick={() => { setEditing(undefined); setModalOpen(true); }}>
              <Plus className="w-4 h-4" />
              Nova Folga
            </Button>
          </div>
        </div>

        {/* View toggle + month nav + filters */}
        <Card>
          <CardContent className="pt-4 pb-3 space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              {/* View toggle */}
              <div className="flex items-center rounded-lg border border-border p-0.5 bg-muted/30">
                <button
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    view === "grid" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setView("grid")}
                >
                  <Grid3X3 className="w-3.5 h-3.5" />
                  Planilha
                </button>
                <button
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    view === "records" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setView("records")}
                >
                  <List className="w-3.5 h-3.5" />
                  Registros
                </button>
              </div>

              {/* Month navigation (grid only) */}
              {view === "grid" && (
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevMonth}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm font-medium min-w-[120px] text-center">
                    {MONTH_NAMES[month - 1]} {year}
                  </span>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextMonth}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}

              {/* Separator */}
              <div className="flex-1" />

              {/* Filters */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="space-y-1">
                  <Select value={operationId} onValueChange={setOperationId}>
                    <SelectTrigger className="h-8 text-sm w-[160px]"><SelectValue placeholder="Operação" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Todas operações</SelectItem>
                      {operations.map((op) => (
                        <SelectItem key={op.id} value={op.id}>{op.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {view === "grid" && (
                  <Input
                    className="h-8 text-sm w-[160px]"
                    placeholder="Filtrar membro..."
                    value={memberFilter}
                    onChange={(e) => setMemberFilter(e.target.value)}
                  />
                )}

                {view === "grid" && (
                  <button
                    type="button"
                    onClick={() => setGroupByGroup((v) => !v)}
                    title="Organizar a planilha por grupos"
                    className={`flex items-center gap-1.5 h-8 px-3 rounded-md border text-sm font-medium transition-colors ${
                      groupByGroup
                        ? "bg-primary/10 border-primary/40 text-primary"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    Por grupo
                  </button>
                )}

                {view === "records" && (
                  <>
                    <Select value={type} onValueChange={setType}>
                      <SelectTrigger className="h-8 text-sm w-[130px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TYPE_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={status} onValueChange={setStatus}>
                      <SelectTrigger className="h-8 text-sm w-[120px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">Todos status</SelectItem>
                        <SelectItem value="ACTIVE">Ativa</SelectItem>
                        <SelectItem value="CANCELLED">Cancelada</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input type="date" className="h-8 text-sm w-[130px]" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                    <Input type="date" className="h-8 text-sm w-[130px]" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Content */}
        {view === "grid" ? (
          <Card className="overflow-hidden">
            {!activeOpId ? (
              <CardContent className="py-16 text-center text-muted-foreground text-sm">
                <Grid3X3 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p>Selecione uma operação para visualizar a grade mensal.</p>
              </CardContent>
            ) : (
              <FolgasGrid
                operationId={activeOpId}
                year={year}
                month={month}
                memberFilter={memberFilter}
                groupBy={groupByGroup}
              />
            )}
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {isLoading ? "Carregando..." : `${folgas.length} folga${folgas.length !== 1 ? "s" : ""}`}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : folgas.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <Palmtree className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Nenhuma folga encontrada para os filtros selecionados.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Membro</th>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Operação</th>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Tipo</th>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Período</th>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Origem</th>
                        <th className="text-right py-3 px-4 font-medium text-muted-foreground">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {folgas.map((f) => (
                        <tr key={f.id} className="border-b hover:bg-muted/20 transition-colors">
                          <td className="py-3 px-4 font-medium">
                            {(() => {
                              const today = new Date().toISOString().slice(0, 10);
                              const isOnLeaveToday =
                                f.status === "ACTIVE" &&
                                f.startDate <= today &&
                                today <= f.endDate;
                              return (
                                <div className="flex items-center gap-2">
                                  {isOnLeaveToday && <AsaAvatar size="small" pose="bomdia" />}
                                  {f.userName}
                                </div>
                              );
                            })()}
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">{f.operationName}</td>
                          <td className="py-3 px-4">
                            <Badge variant="outline" className="text-xs">
                              {TYPE_LABELS[f.type] ?? f.type}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">
                            {f.startDate === f.endDate
                              ? f.startDate
                              : `${f.startDate} → ${f.endDate}`}
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant="outline" className={`text-xs ${STATUS_COLORS[f.status] ?? ""}`}>
                              {f.status === "ACTIVE" ? "Ativa" : "Cancelada"}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-muted-foreground text-xs">
                            {ORIGEM_LABELS[f.origem] ?? f.origem}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-end gap-2">
                              {f.status === "ACTIVE" && (
                                <>
                                  <Button
                                    size="sm" variant="ghost" className="h-7 px-2 gap-1 text-xs"
                                    onClick={() => { setEditing(f); setModalOpen(true); }}
                                  >
                                    <Pencil className="w-3 h-3" />Editar
                                  </Button>
                                  <Button
                                    size="sm" variant="ghost"
                                    className="h-7 px-2 gap-1 text-xs text-destructive hover:text-destructive"
                                    onClick={() => setCancelTarget(f)}
                                  >
                                    <XCircle className="w-3 h-3" />Cancelar
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <FolgaModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(undefined); }}
        editing={editing}
        operationId={activeOpId || undefined}
      />

      {activeOpId && (
        <>
          <FillPeriodDialog
            open={fillOpen}
            onClose={() => setFillOpen(false)}
            operationId={activeOpId}
            year={year}
            month={month}
          />
          <ClearPeriodDialog
            open={clearOpen}
            onClose={() => setClearOpen(false)}
            operationId={activeOpId}
            year={year}
            month={month}
          />
          <ResetDialog
            open={resetOpen}
            onClose={() => setResetOpen(false)}
            operationId={activeOpId}
            year={year}
            month={month}
          />
        </>
      )}

      <AsaConfirmDialog
        open={!!cancelTarget}
        onClose={() => setCancelTarget(undefined)}
        title="Cancelar Folga"
        bubbleText="Tem certeza? Essa folga será cancelada e a ação não pode ser desfeita. ⚠️"
        description={
          cancelTarget && (
            <>
              A folga de <strong>{cancelTarget.userName}</strong> será cancelada.
            </>
          )
        }
        confirmLabel="Cancelar folga"
        cancelLabel="Voltar"
        isPending={isCancelling}
        onConfirm={() => cancelTarget && cancelFolga({ id: cancelTarget.id })}
      />
    </>
  );
}

export default function AdminFolgasPage() {
  return (
    <AdminLayout title="Folgas">
      <FolgasContent />
    </AdminLayout>
  );
}
