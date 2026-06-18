import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  useGetOperations,
  useListRequests,
  useDecideRequest,
  type RequestItem,
  type RequestDecisionType,
} from "@workspace/api-client-react";

// ─── Labels ──────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  LEAVE: "Folga",
  ROLE_RESTRICTION: "Restrição de Função",
  PHYSICAL_RESTRICTION: "Restrição Física",
  HEALTH_RESTRICTION: "Restrição de Saúde",
  SCHEDULE_CHANGE: "Mudança de Escala",
  SWAP: "Troca",
  OTHER: "Outro",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Aguardando",
  APPROVED: "Aprovada",
  DENIED: "Negada",
  ALTERNATIVE_PROPOSED: "Alternativa Proposta",
  ALTERNATIVE_ACCEPTED: "Alternativa Aceita",
  ALTERNATIVE_REJECTED: "Alternativa Rejeitada",
  EXPIRED: "Expirada",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  PENDING: "secondary",
  APPROVED: "default",
  DENIED: "destructive",
  ALTERNATIVE_PROPOSED: "outline",
  ALTERNATIVE_ACCEPTED: "default",
  ALTERNATIVE_REJECTED: "destructive",
  EXPIRED: "outline",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800 border-amber-200",
  APPROVED: "bg-green-100 text-green-800 border-green-200",
  DENIED: "bg-red-100 text-red-800 border-red-200",
  ALTERNATIVE_PROPOSED: "bg-blue-100 text-blue-800 border-blue-200",
  ALTERNATIVE_ACCEPTED: "bg-green-100 text-green-800 border-green-200",
  ALTERNATIVE_REJECTED: "bg-red-100 text-red-800 border-red-200",
  EXPIRED: "bg-gray-100 text-gray-600 border-gray-200",
};

const FILTER_OPTIONS = [
  { value: "PENDING,ALTERNATIVE_REJECTED", label: "Pendentes" },
  { value: "APPROVED,ALTERNATIVE_ACCEPTED", label: "Aprovadas" },
  { value: "DENIED", label: "Negadas" },
  { value: "ALTERNATIVE_PROPOSED", label: "Alternativas" },
] as const;

// ─── Component ───────────────────────────────────────────────────────────────

export default function SupervisorRequestsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [operationId, setOperationId] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("PENDING,ALTERNATIVE_REJECTED");
  const [deciding, setDeciding] = useState<RequestItem | null>(null);
  const [decisionType, setDecisionType] = useState<RequestDecisionType>("APPROVED");
  const [decisionReason, setDecisionReason] = useState("");
  const [alternativeDetails, setAlternativeDetails] = useState("");

  const { data: opsData } = useGetOperations();
  const operations = opsData?.operations ?? [];

  const { data, isLoading } = useListRequests(
    { operationId: operationId || undefined, status: statusFilter },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { query: { enabled: !!operationId } as any }
  );
  const requests = data?.requests ?? [];

  const decideMutation = useDecideRequest({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["listRequests"] });
        queryClient.invalidateQueries({ queryKey: ["listPendingRequests"] });
        toast({ title: "Decisão registrada com sucesso" });
        setDeciding(null);
        setDecisionReason("");
        setAlternativeDetails("");
      },
      onError: () => toast({ title: "Erro ao registrar decisão", variant: "destructive" }),
    },
  });

  function openDecide(req: RequestItem) {
    setDeciding(req);
    setDecisionType("APPROVED");
    setDecisionReason("");
    setAlternativeDetails("");
  }

  function submitDecision() {
    if (!deciding) return;
    decideMutation.mutate({
      id: deciding.id,
      data: {
        decision: decisionType,
        reason: decisionReason || undefined,
        alternativeDetails: decisionType === "ALTERNATIVE_PROPOSED" ? alternativeDetails : undefined,
      },
    });
  }

  function formatDates(dates: string[]) {
    return dates.map((d) => new Date(d + "T12:00:00").toLocaleDateString("pt-BR")).join(", ");
  }

  return (
    <AdminLayout title="Solicitações">
      <div className="space-y-6">
        {/* Filtros */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filtros</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <Label className="mb-1.5 block text-sm">Operação</Label>
              <Select value={operationId} onValueChange={setOperationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar operação" />
                </SelectTrigger>
                <SelectContent>
                  {operations.map((op) => (
                    <SelectItem key={op.id} value={op.id}>{op.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <Label className="mb-1.5 block text-sm">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FILTER_OPTIONS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Lista */}
        {!operationId ? (
          <div className="text-center py-16 text-muted-foreground">
            Selecione uma operação para visualizar as solicitações.
          </div>
        ) : isLoading ? (
          <div className="text-center py-16 text-muted-foreground">Carregando...</div>
        ) : requests.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">Nenhuma solicitação encontrada.</div>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => (
              <Card key={req.id}>
                <CardContent className="pt-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-semibold text-sm">{req.requesterName}</span>
                        <Badge className={`text-xs border ${STATUS_COLORS[req.status] ?? ""}`} variant="outline">
                          {STATUS_LABELS[req.status] ?? req.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                          {TYPE_LABELS[req.type] ?? req.type}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{formatDates(req.targetDates)}</p>
                      {req.reason && (
                        <p className="text-sm text-foreground/70 mt-1 line-clamp-2">{req.reason}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        {new Date(req.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                      </p>
                    </div>
                    {(req.status === "PENDING" || req.status === "ALTERNATIVE_REJECTED") && (
                      <Button size="sm" onClick={() => openDecide(req)}>
                        Decidir
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Modal de decisão */}
      <Dialog open={!!deciding} onOpenChange={(open) => !open && setDeciding(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Decisão</DialogTitle>
          </DialogHeader>
          {deciding && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
                <p className="font-medium text-foreground">{deciding.requesterName}</p>
                <p>{TYPE_LABELS[deciding.type] ?? deciding.type} — {formatDates(deciding.targetDates)}</p>
                {deciding.reason && <p className="mt-1 text-xs">{deciding.reason}</p>}
              </div>

              <div>
                <Label className="mb-1.5 block">Decisão</Label>
                <Select value={decisionType} onValueChange={(v) => setDecisionType(v as RequestDecisionType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="APPROVED">✅ Aprovar</SelectItem>
                    <SelectItem value="DENIED">❌ Negar</SelectItem>
                    <SelectItem value="ALTERNATIVE_PROPOSED">🔄 Propor alternativa</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="mb-1.5 block">Motivo (opcional)</Label>
                <Textarea
                  value={decisionReason}
                  onChange={(e) => setDecisionReason(e.target.value)}
                  placeholder="Descreva o motivo da decisão..."
                  rows={3}
                />
              </div>

              {decisionType === "ALTERNATIVE_PROPOSED" && (
                <div>
                  <Label className="mb-1.5 block">Detalhes da alternativa</Label>
                  <Textarea
                    value={alternativeDetails}
                    onChange={(e) => setAlternativeDetails(e.target.value)}
                    placeholder="Descreva a alternativa proposta..."
                    rows={3}
                  />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeciding(null)}>Cancelar</Button>
            <Button onClick={submitDecision} disabled={decideMutation.isPending}>
              {decideMutation.isPending ? "Salvando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
