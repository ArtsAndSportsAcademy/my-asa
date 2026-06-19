import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListDelegations,
  useCreateDelegation,
  useCancelDelegation,
  useGetOperations,
  useListUsers,
  getListDelegationsQueryKey,
} from "@workspace/api-client-react";
import AdminLayout from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, X, AlertCircle, Loader2, ShieldCheck } from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  PENDING:   { label: "Pendente",  variant: "outline"      },
  ACTIVE:    { label: "Ativa",     variant: "default"      },
  EXPIRED:   { label: "Expirada",  variant: "secondary"    },
  CANCELLED: { label: "Cancelada", variant: "destructive"  },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

function fmtDate(s: string) {
  try {
    const [y, m, d] = s.split("-");
    return `${d}/${m}/${y}`;
  } catch {
    return s;
  }
}

export default function SupervisorDelegationsPage() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [cancelId, setCancelId] = useState<string | null>(null);

  const [delegateId, setDelegateId] = useState("");
  const [operationId, setOperationId] = useState("");
  const [startDate, setStartDate]   = useState("");
  const [endDate, setEndDate]       = useState("");
  const [reason, setReason]         = useState("");
  const [formError, setFormError]   = useState("");

  const { data, isLoading, error } = useListDelegations();
  const { data: opsData }          = useGetOperations();
  const { data: usersData }        = useListUsers();
  const createMutation             = useCreateDelegation();
  const cancelMutation             = useCancelDelegation();

  const delegations = data?.delegations ?? [];
  const operations  = (opsData as any)?.operations ?? [];
  const users       = usersData?.users ?? [];

  const resetForm = () => {
    setDelegateId(""); setOperationId(""); setStartDate(""); setEndDate(""); setReason(""); setFormError("");
  };

  const handleCreate = () => {
    if (!delegateId || !operationId || !startDate || !endDate) {
      setFormError("Preencha todos os campos obrigatórios.");
      return;
    }
    if (endDate < startDate) {
      setFormError("A data de término deve ser igual ou posterior à data de início.");
      return;
    }
    setFormError("");
    createMutation.mutate(
      { delegateId, operationId, startDate, endDate, reason: reason || undefined },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListDelegationsQueryKey() });
          setShowModal(false);
          resetForm();
        },
        onError: (err: any) => {
          setFormError(err?.message ?? "Erro ao criar delegação.");
        },
      }
    );
  };

  const handleCancel = (id: string) => {
    cancelMutation.mutate(id, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListDelegationsQueryKey() });
        setCancelId(null);
      },
      onError: () => {
        setCancelId(null);
      },
    });
  };

  return (
    <AdminLayout title="Delegações" subtitle="Delegue temporariamente responsabilidades operacionais">
      <div className="p-6 max-w-5xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Delegações Temporárias</h2>
            <p className="text-sm text-muted-foreground">
              Autorize um membro a exercer funções de supervisão durante um período determinado.
            </p>
          </div>
          <Button onClick={() => { resetForm(); setShowModal(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Nova Delegação
          </Button>
        </div>

        {isLoading && (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive p-3 rounded-md border border-destructive/30 bg-destructive/5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            Erro ao carregar delegações.
          </div>
        )}

        {!isLoading && !error && delegations.length === 0 && (
          <div className="text-center py-14 text-muted-foreground">
            <ShieldCheck className="w-10 h-10 mx-auto mb-3 opacity-25" />
            <p className="text-sm">Nenhuma delegação criada.</p>
          </div>
        )}

        {!isLoading && delegations.length > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Membro delegado</TableHead>
                  <TableHead>Operação</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {delegations.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.delegateeName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{d.operationName}</TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {fmtDate(d.startDate)} – {fmtDate(d.endDate)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[180px] truncate">
                      {d.reason ?? "—"}
                    </TableCell>
                    <TableCell><StatusBadge status={d.status} /></TableCell>
                    <TableCell>
                      {["PENDING", "ACTIVE"].includes(d.status) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setCancelId(d.id)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* ── Modal: Criar Delegação ── */}
      <Dialog
        open={showModal}
        onOpenChange={(open) => { if (!open) { setShowModal(false); resetForm(); } }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Delegação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Operação *</Label>
              <Select value={operationId} onValueChange={setOperationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a operação" />
                </SelectTrigger>
                <SelectContent>
                  {operations.map((op: { id: string; name: string }) => (
                    <SelectItem key={op.id} value={op.id}>{op.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Membro delegado *</Label>
              <Select value={delegateId} onValueChange={setDelegateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o membro" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Início *</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Término *</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Motivo (opcional)</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ex: viagem, licença médica..."
                rows={2}
              />
            </div>

            {formError && (
              <p className="text-sm text-destructive flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {formError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowModal(false); resetForm(); }}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Criar Delegação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Confirmar Cancelamento ── */}
      <Dialog open={!!cancelId} onOpenChange={(open) => { if (!open) setCancelId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Cancelar Delegação</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-1">
            Tem certeza? O membro perderá imediatamente acesso às funcionalidades delegadas.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelId(null)}>Voltar</Button>
            <Button
              variant="destructive"
              onClick={() => cancelId && handleCancel(cancelId)}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirmar cancelamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
