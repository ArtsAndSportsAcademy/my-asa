import { useState } from "react";
import AdminLayout from "@/components/admin-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListFolgas,
  useCreateFolga,
  useUpdateFolga,
  useCancelFolga,
  useGetOperations,
  getListFolgasQueryKey,
} from "@workspace/api-client-react";
import type { FolgaItem } from "@workspace/api-client-react";
import { Palmtree, Plus, Pencil, XCircle, Loader2 } from "lucide-react";

// ─── Labels ──────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  DAY_OFF:     "Folga",
  NO_SHOW:     "No-show",
  RECESSO:     "Recesso",
  AFASTAMENTO: "Afastamento",
  RESTRICAO:   "Restrição",
  OUTRO:       "Outro",
};

const ORIGEM_LABELS: Record<string, string> = {
  MANUAL:      "Manual",
  SOLICITACAO: "Solicitação",
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:    "bg-green-100 text-green-800 border-green-200",
  CANCELLED: "bg-red-100 text-red-800 border-red-200",
};

const TYPE_OPTIONS = [
  { value: "__all__", label: "Todos os tipos" },
  { value: "DAY_OFF",     label: "Folga" },
  { value: "NO_SHOW",     label: "No-show" },
  { value: "RECESSO",     label: "Recesso" },
  { value: "AFASTAMENTO", label: "Afastamento" },
  { value: "RESTRICAO",   label: "Restrição" },
  { value: "OUTRO",       label: "Outro" },
];

const STATUS_OPTIONS = [
  { value: "__all__", label: "Todos os status" },
  { value: "ACTIVE",    label: "Ativa" },
  { value: "CANCELLED", label: "Cancelada" },
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
                <Label>ID do Membro <span className="text-destructive">*</span></Label>
                <Input placeholder="UUID do membro" value={userId} onChange={(e) => setUserId(e.target.value)} />
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminFolgasPage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [operationId, setOperationId] = useState("__all__");
  const [type,        setType]        = useState("__all__");
  const [status,      setStatus]      = useState("ACTIVE");
  const [dateFrom,    setDateFrom]    = useState("");
  const [dateTo,      setDateTo]      = useState("");
  const [modalOpen,   setModalOpen]   = useState(false);
  const [editing,     setEditing]     = useState<FolgaItem | undefined>();

  const { data: opsData } = useGetOperations();
  const operations = opsData?.operations ?? [];

  const params = {
    ...(operationId !== "__all__" ? { operationId } : {}),
    ...(type !== "__all__"        ? { type: type as any } : {}),
    ...(status !== "__all__"      ? { status: status as any } : {}),
    ...(dateFrom ? { dateFrom } : {}),
    ...(dateTo   ? { dateTo }   : {}),
  };

  const { data, isLoading } = useListFolgas(params);
  const folgas = data?.folgas ?? [];

  const { mutate: cancelFolga } = useCancelFolga({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListFolgasQueryKey() });
        toast({ title: "Folga cancelada" });
      },
      onError: () => toast({ title: "Erro ao cancelar folga", variant: "destructive" }),
    },
  });

  function handleEdit(f: FolgaItem) {
    setEditing(f);
    setModalOpen(true);
  }

  function handleNew() {
    setEditing(undefined);
    setModalOpen(true);
  }

  return (
    <AdminLayout title="Folgas">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <Palmtree className="w-5 h-5 text-green-700" />
            </div>
            <div>
              <h1 className="text-2xl font-serif font-bold">Folgas</h1>
              <p className="text-sm text-muted-foreground">Ausências e dias de descanso da equipe</p>
            </div>
          </div>
          <Button onClick={handleNew} size="sm" className="gap-2">
            <Plus className="w-4 h-4" />
            Nova Folga
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Operação</Label>
                <Select value={operationId} onValueChange={setOperationId}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todas</SelectItem>
                    {operations.map((op) => (
                      <SelectItem key={op.id} value={op.id}>{op.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Tipo</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TYPE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">De</Label>
                <Input type="date" className="h-9" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Até</Label>
                <Input type="date" className="h-9" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
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
                        <td className="py-3 px-4 font-medium">{f.userName}</td>
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
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 gap-1 text-xs"
                                  onClick={() => handleEdit(f)}
                                >
                                  <Pencil className="w-3 h-3" />
                                  Editar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 gap-1 text-xs text-destructive hover:text-destructive"
                                  onClick={() => cancelFolga({ id: f.id })}
                                >
                                  <XCircle className="w-3 h-3" />
                                  Cancelar
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
      </div>

      <FolgaModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(undefined); }}
        editing={editing}
      />
    </AdminLayout>
  );
}
