import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeftRight, Plus, Send, Inbox } from "lucide-react";

type Direction = "sent" | "received";

interface SupervisorRequestItem {
  id: string;
  requestorId: string;
  requestorName: string;
  targetSupervisorId: string | null;
  targetOperationId: string;
  targetOperationName: string;
  requestorOperationId: string;
  memberId: string;
  agendaEventId: string | null;
  reason: string;
  status: string;
  responseReason: string | null;
  respondedAt: string | null;
  createdAt: string;
}

interface UserItem { id: string; name: string; }
interface OperationItem { id: string; name: string; }

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    PENDING: "bg-yellow-100 text-yellow-800",
    APPROVED: "bg-green-100 text-green-800",
    DENIED: "bg-red-100 text-red-800",
  };
  const labels: Record<string, string> = { PENDING: "Pendente", APPROVED: "Aprovada", DENIED: "Negada" };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[status] ?? "bg-gray-100 text-gray-600"}`}>
      {labels[status] ?? status}
    </span>
  );
}

export default function SupervisorInterRequestsPage() {
  const { roles } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const operationId = roles[0]?.operationId ?? "";
  const [direction, setDirection] = useState<Direction>("received");
  const [showNew, setShowNew] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const [newForm, setNewForm] = useState({
    requestorOperationId: operationId,
    targetOperationId: "",
    memberId: "",
    reason: "",
  });

  const [respondForm, setRespondForm] = useState({ decision: "APPROVED", responseReason: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["supervisor-requests", direction],
    queryFn: () => customFetch<{ requests: SupervisorRequestItem[] }>(
      `/api/supervisor-requests?direction=${direction}`
    ),
  });

  const { data: usersData } = useQuery({
    queryKey: ["users-all"],
    queryFn: () => customFetch<{ users: UserItem[] }>("/api/users"),
  });

  const { data: opsData } = useQuery({
    queryKey: ["operations-all"],
    queryFn: () => customFetch<{ operations: OperationItem[] }>("/api/operations"),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof newForm) =>
      customFetch("/api/supervisor-requests", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      toast({ title: "Solicitação enviada" });
      qc.invalidateQueries({ queryKey: ["supervisor-requests"] });
      setShowNew(false);
      setNewForm({ requestorOperationId: operationId, targetOperationId: "", memberId: "", reason: "" });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Erro ao enviar";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    },
  });

  const respondMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof respondForm }) =>
      customFetch(`/api/supervisor-requests/${id}/respond`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      toast({ title: "Resposta registrada" });
      qc.invalidateQueries({ queryKey: ["supervisor-requests"] });
      setRespondingId(null);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Erro ao responder";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    },
  });

  const requests = data?.requests ?? [];
  const users = usersData?.users ?? [];
  const operations = opsData?.operations ?? [];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ArrowLeftRight className="w-6 h-6" /> Solicitações Entre Supervisores
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Solicite ou autorize o uso de membros em outras operações.
          </p>
        </div>
        <Button onClick={() => setShowNew(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Nova Solicitação
        </Button>
      </div>

      <div className="flex gap-2">
        <Button variant={direction === "received" ? "default" : "outline"} size="sm" className="gap-2" onClick={() => setDirection("received")}>
          <Inbox className="w-4 h-4" /> Recebidas
        </Button>
        <Button variant={direction === "sent" ? "default" : "outline"} size="sm" className="gap-2" onClick={() => setDirection("sent")}>
          <Send className="w-4 h-4" /> Enviadas
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Carregando...</div>
      ) : requests.length === 0 ? (
        <div className="text-center py-12 border rounded-lg text-muted-foreground">
          <ArrowLeftRight className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p>Nenhuma solicitação {direction === "received" ? "recebida" : "enviada"}.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <div key={r.id} className="border rounded-lg p-4 bg-white shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={r.status} />
                    <span className="text-xs text-muted-foreground">
                      {new Date(r.createdAt).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                  <p className="font-medium text-sm">Solicitante: {r.requestorName}</p>
                  <p className="text-sm text-muted-foreground">Operação alvo: {r.targetOperationName}</p>
                  <p className="text-sm">{r.reason}</p>
                  {r.responseReason && (
                    <p className="text-xs text-muted-foreground italic">Resposta: {r.responseReason}</p>
                  )}
                </div>
                {direction === "received" && r.status === "PENDING" && (
                  <Button
                    size="sm"
                    onClick={() => {
                      setRespondingId(r.id);
                      setRespondForm({ decision: "APPROVED", responseReason: "" });
                    }}
                  >
                    Responder
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Nova Solicitação */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nova Solicitação Entre Supervisores</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Membro solicitado</Label>
              <Select value={newForm.memberId} onValueChange={v => setNewForm(f => ({ ...f, memberId: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar membro" /></SelectTrigger>
                <SelectContent>
                  {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Operação do membro (origem)</Label>
              <Select value={newForm.targetOperationId} onValueChange={v => setNewForm(f => ({ ...f, targetOperationId: v }))}>
                <SelectTrigger><SelectValue placeholder="Operação de origem" /></SelectTrigger>
                <SelectContent>
                  {operations.map((op) => <SelectItem key={op.id} value={op.id}>{op.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Motivo da solicitação</Label>
              <Textarea
                rows={3}
                placeholder="Explique por que precisa deste membro..."
                value={newForm.reason}
                onChange={e => setNewForm(f => ({ ...f, reason: e.target.value }))}
              />
            </div>
            <Button
              className="w-full"
              onClick={() => createMutation.mutate(newForm)}
              disabled={!newForm.memberId || !newForm.targetOperationId || !newForm.reason || createMutation.isPending}
            >
              {createMutation.isPending ? "Enviando..." : "Enviar Solicitação"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Responder */}
      <Dialog open={!!respondingId} onOpenChange={() => setRespondingId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Responder Solicitação</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Decisão</Label>
              <div className="flex gap-2 mt-1">
                <Button
                  variant={respondForm.decision === "APPROVED" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setRespondForm(f => ({ ...f, decision: "APPROVED" }))}
                >
                  Aprovar
                </Button>
                <Button
                  variant={respondForm.decision === "DENIED" ? "destructive" : "outline"}
                  className="flex-1"
                  onClick={() => setRespondForm(f => ({ ...f, decision: "DENIED" }))}
                >
                  Negar
                </Button>
              </div>
            </div>
            <div>
              <Label>Observação (opcional)</Label>
              <Textarea
                rows={2}
                value={respondForm.responseReason}
                onChange={e => setRespondForm(f => ({ ...f, responseReason: e.target.value }))}
                placeholder="Motivo da decisão..."
              />
            </div>
            <Button
              className="w-full"
              onClick={() => respondingId && respondMutation.mutate({ id: respondingId, data: respondForm })}
              disabled={respondMutation.isPending}
            >
              {respondMutation.isPending ? "Registrando..." : "Confirmar Resposta"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
