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
import type { DelegatedResponsibility } from "@workspace/api-client-react";
import {
  ALL_RESPONSIBILITIES,
  RESPONSIBILITY_LABELS,
} from "@workspace/api-client-react";
import AdminLayout from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MemberCombobox } from "@/components/member-combobox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, X, AlertCircle, Loader2, ShieldCheck, ChevronDown, ChevronUp } from "lucide-react";

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

function ResponsibilityChips({ responsibilities }: { responsibilities: DelegatedResponsibility[] }) {
  if (responsibilities.length === 0) return <span className="text-xs text-muted-foreground">Nenhuma</span>;
  if (responsibilities.length === ALL_RESPONSIBILITIES.length) {
    return <Badge variant="secondary" className="text-xs">Todas</Badge>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {responsibilities.map((r) => (
        <Badge key={r} variant="outline" className="text-xs px-1.5 py-0">
          {RESPONSIBILITY_LABELS[r]}
        </Badge>
      ))}
    </div>
  );
}

function ResponsibilityDetail({ delegateName, responsibilities }: { delegateName: string; responsibilities: DelegatedResponsibility[] }) {
  return (
    <div className="mt-1 space-y-0.5">
      <p className="text-xs font-medium text-muted-foreground">{delegateName} possui:</p>
      <div className="grid grid-cols-2 gap-0.5">
        {ALL_RESPONSIBILITIES.map((r) => {
          const has = responsibilities.includes(r);
          return (
            <span key={r} className={`text-xs ${has ? "text-green-700" : "text-red-400 line-through"}`}>
              {has ? "✓" : "✗"} {RESPONSIBILITY_LABELS[r]}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function DelegationsContent() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [delegateId, setDelegateId] = useState("");
  const [operationId, setOperationId] = useState("");
  const [startDate, setStartDate]   = useState("");
  const [endDate, setEndDate]       = useState("");
  const [reason, setReason]         = useState("");
  const [selectedResp, setSelectedResp] = useState<DelegatedResponsibility[]>([]);
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
    setDelegateId(""); setOperationId(""); setStartDate(""); setEndDate("");
    setReason(""); setSelectedResp([]); setFormError("");
  };

  const toggleResp = (r: DelegatedResponsibility) => {
    setSelectedResp((prev) =>
      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]
    );
  };

  const toggleAll = () => {
    setSelectedResp((prev) =>
      prev.length === ALL_RESPONSIBILITIES.length ? [] : [...ALL_RESPONSIBILITIES]
    );
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
    if (selectedResp.length === 0) {
      setFormError("Selecione ao menos uma responsabilidade.");
      return;
    }
    setFormError("");
    createMutation.mutate(
      {
        delegateId,
        operationId,
        startDate,
        endDate,
        reason: reason || undefined,
        responsibilities: selectedResp,
      },
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
      onError: () => setCancelId(null),
    });
  };

  return (
    <>
      <div className="p-6 max-w-5xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Delegações de Responsabilidade</h2>
            <p className="text-sm text-muted-foreground">
              O Capitão é um membro com responsabilidades específicas delegadas — sem mudança de papel.
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
                  <TableHead>Membro (Capitão)</TableHead>
                  <TableHead>Operação</TableHead>
                  <TableHead>Responsabilidades</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {delegations.map((d) => (
                  <>
                    <TableRow key={d.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setExpandedId(expandedId === d.id ? null : d.id)}>
                      <TableCell className="font-medium">{d.delegateeName}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{d.operationName}</TableCell>
                      <TableCell>
                        <ResponsibilityChips responsibilities={d.responsibilities ?? []} />
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {fmtDate(d.startDate)} – {fmtDate(d.endDate)}
                      </TableCell>
                      <TableCell><StatusBadge status={d.status} /></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            {expandedId === d.id
                              ? <ChevronUp className="w-3.5 h-3.5" />
                              : <ChevronDown className="w-3.5 h-3.5" />
                            }
                          </Button>
                          {["PENDING", "ACTIVE"].includes(d.status) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={(e) => { e.stopPropagation(); setCancelId(d.id); }}
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    {expandedId === d.id && (
                      <TableRow key={`${d.id}-detail`} className="bg-muted/20">
                        <TableCell colSpan={6} className="py-3 px-4">
                          <ResponsibilityDetail
                            delegateName={d.delegateeName ?? "Membro"}
                            responsibilities={d.responsibilities ?? []}
                          />
                          {d.reason && (
                            <p className="text-xs text-muted-foreground mt-2">Motivo: {d.reason}</p>
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </>
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova Delegação de Responsabilidade</DialogTitle>
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
              <Label>Membro (Capitão) *</Label>
              <MemberCombobox value={delegateId} onChange={setDelegateId} users={users} placeholder="Selecione o membro" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Início *</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Término *</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Responsabilidades *</Label>
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={toggleAll}
                >
                  {selectedResp.length === ALL_RESPONSIBILITIES.length ? "Desmarcar todas" : "Selecionar todas"}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 border rounded-md p-3 bg-muted/30">
                {ALL_RESPONSIBILITIES.map((r) => (
                  <div key={r} className="flex items-center gap-2">
                    <Checkbox
                      id={`resp-${r}`}
                      checked={selectedResp.includes(r)}
                      onCheckedChange={() => toggleResp(r)}
                    />
                    <label
                      htmlFor={`resp-${r}`}
                      className="text-sm cursor-pointer select-none"
                    >
                      {RESPONSIBILITY_LABELS[r]}
                    </label>
                  </div>
                ))}
              </div>
              {selectedResp.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {selectedResp.length} responsabilidade{selectedResp.length !== 1 ? "s" : ""} selecionada{selectedResp.length !== 1 ? "s" : ""}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Motivo (opcional)</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ex: viagem, licença médica, ausência planejada..."
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
            Tem certeza? O membro perderá imediatamente acesso às responsabilidades delegadas.
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
    </>
  );
}

export default function SupervisorDelegationsPage() {
  return (
    <AdminLayout title="Delegações" subtitle="Delegue responsabilidades operacionais específicas a membros da equipe">
      <DelegationsContent />
    </AdminLayout>
  );
}
