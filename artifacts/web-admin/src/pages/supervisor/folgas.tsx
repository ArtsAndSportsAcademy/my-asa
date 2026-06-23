import { useState } from "react";
import AdminLayout from "@/components/admin-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import {
  useListFolgas,
  useCancelFolga,
  useBulkFillFolgas,
  useGetFolgasGrid,
  getListFolgasQueryKey,
  getGetFolgasGridQueryKey,
} from "@workspace/api-client-react";
import { FolgasGrid, MONTH_NAMES } from "@/components/folgas-grid";
import { Palmtree, Loader2, XCircle, ChevronLeft, ChevronRight, Grid3X3, List } from "lucide-react";
import { AsaAvatar } from "@/components/AsaAvatar";

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  DAY_OFF:     "Folga",
  NO_SHOW:     "Folga",
  RECESSO:     "Recesso",
  AFASTAMENTO: "Afastamento",
  RESTRICAO:   "Restrição",
  OUTRO:       "Outro",
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:    "bg-green-100 text-green-800 border-green-200",
  CANCELLED: "bg-red-100 text-red-800 border-red-200",
};

const TYPE_OPTIONS = [
  { value: "__all__", label: "Todos os tipos" },
  { value: "DAY_OFF",     label: "Folga" },
  { value: "RECESSO",     label: "Recesso" },
  { value: "AFASTAMENTO", label: "Afastamento" },
  { value: "RESTRICAO",   label: "Restrição" },
  { value: "OUTRO",       label: "Outro" },
];

const GRID_TYPE_OPTIONS = [
  { value: "DAY_OFF", label: "F — Folga" },
  { value: "RECESSO", label: "R — Recesso" },
  { value: "OUTRO",   label: "O — Outro" },
];

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
        toast({ title: "Período preenchido" });
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
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger><SelectValue placeholder="Selecione o membro" /></SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.userId} value={m.userId}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SupervisorFolgasPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { roles } = useAuth();

  const operationId = roles[0]?.operationId ?? "";

  const today = new Date();
  const [view,  setView]  = useState<"grid" | "records">("grid");
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  const [memberFilter, setMemberFilter] = useState("");
  const [type,     setType]     = useState("__all__");
  const [status,   setStatus]   = useState("ACTIVE");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo,   setDateTo]   = useState("");
  const [fillOpen, setFillOpen] = useState(false);

  const params = {
    operationId,
    ...(type !== "__all__" ? { type: type as any } : {}),
    ...(status !== "__all__" ? { status: status as any } : {}),
    ...(dateFrom ? { dateFrom } : {}),
    ...(dateTo   ? { dateTo }   : {}),
  };

  const { data, isLoading } = useListFolgas(params, {
    query: { enabled: !!operationId && view === "records" },
  } as any);
  const folgas = data?.folgas ?? [];

  const { mutate: cancelFolga } = useCancelFolga({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListFolgasQueryKey() });
        toast({ title: "Folga cancelada" });
      },
      onError: () => toast({ title: "Erro ao cancelar", variant: "destructive" }),
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
    <AdminLayout title="Folgas da Equipe">
      <div className="max-w-[1400px] mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <Palmtree className="w-5 h-5 text-green-700" />
            </div>
            <div>
              <h1 className="text-2xl font-serif font-bold">Folgas da Equipe</h1>
              <p className="text-sm text-muted-foreground">Quem estará ausente e quando?</p>
            </div>
          </div>
          {view === "grid" && operationId && (
            <Button variant="outline" size="sm" onClick={() => setFillOpen(true)}>
              Preencher Período
            </Button>
          )}
        </div>

        {/* Controls */}
        <Card>
          <CardContent className="pt-4 pb-3">
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

              <div className="flex-1" />

              {view === "grid" && (
                <Input
                  className="h-8 text-sm w-[160px]"
                  placeholder="Filtrar membro..."
                  value={memberFilter}
                  onChange={(e) => setMemberFilter(e.target.value)}
                />
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
          </CardContent>
        </Card>

        {/* Content */}
        {view === "grid" ? (
          <Card className="overflow-hidden">
            {!operationId ? (
              <CardContent className="py-16 text-center text-muted-foreground text-sm">
                <Grid3X3 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p>Sem operação associada ao seu perfil.</p>
              </CardContent>
            ) : (
              <FolgasGrid
                operationId={operationId}
                year={year}
                month={month}
                memberFilter={memberFilter}
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
                  <p className="text-sm">Nenhuma folga no período.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Membro</th>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Tipo</th>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Período</th>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Origem</th>
                        <th className="text-right py-3 px-4" />
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
                          <td className="py-3 px-4 text-xs text-muted-foreground">
                            {f.origem === "SOLICITACAO" ? "Solicitação" : "Manual"}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {f.status === "ACTIVE" && (
                              <Button
                                size="sm" variant="ghost"
                                className="h-7 px-2 gap-1 text-xs text-destructive hover:text-destructive"
                                onClick={() => cancelFolga({ id: f.id })}
                              >
                                <XCircle className="w-3 h-3" />Cancelar
                              </Button>
                            )}
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

      {operationId && (
        <FillPeriodDialog
          open={fillOpen}
          onClose={() => setFillOpen(false)}
          operationId={operationId}
          year={year}
          month={month}
        />
      )}
    </AdminLayout>
  );
}
