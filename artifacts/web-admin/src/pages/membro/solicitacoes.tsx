import { useState } from "react";
import {
  useListRequests,
  useCreateRequest,
  useUpdateRequest,
  useListFolgas,
  useGetOperations,
  type RequestType,
  type RequestItem,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/admin-layout";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Plus,
  RefreshCw,
  Calendar,
  ClipboardList,
  Check,
  X,
  Palmtree,
} from "lucide-react";

// ─── Labels & Config ────────────────────────────────────────────────────────────

const REQUEST_TYPE_LABELS: Record<string, string> = {
  LEAVE: "Folga",
  ROLE_RESTRICTION: "Restrição de Função",
  PHYSICAL_RESTRICTION: "Restrição Física",
  HEALTH_RESTRICTION: "Restrição de Saúde",
  SCHEDULE_CHANGE: "Mudança de Escala",
  SWAP: "Troca",
  OTHER: "Outro",
};

const REQUEST_STATUS_LABELS: Record<string, string> = {
  PENDING: "Aguardando",
  APPROVED: "Aprovada",
  DENIED: "Negada",
  ALTERNATIVE_PROPOSED: "Alternativa Proposta",
  ALTERNATIVE_ACCEPTED: "Alternativa Aceita",
  ALTERNATIVE_REJECTED: "Alternativa Rejeitada",
  EXPIRED: "Expirada",
};

const STATUS_BADGES: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  APPROVED: "bg-green-100 text-green-700",
  DENIED: "bg-red-100 text-red-700",
  ALTERNATIVE_PROPOSED: "bg-blue-100 text-blue-800",
  ALTERNATIVE_ACCEPTED: "bg-green-100 text-green-700",
  ALTERNATIVE_REJECTED: "bg-red-100 text-red-700",
  EXPIRED: "bg-gray-100 text-gray-600",
};

const REQUEST_TYPES: { value: RequestType; label: string }[] = [
  { value: "LEAVE", label: "Folga" },
  { value: "ROLE_RESTRICTION", label: "Restrição de Função" },
  { value: "PHYSICAL_RESTRICTION", label: "Restrição Física" },
  { value: "HEALTH_RESTRICTION", label: "Restrição de Saúde" },
  { value: "SCHEDULE_CHANGE", label: "Mudança de Escala" },
  { value: "SWAP", label: "Troca" },
  { value: "OTHER", label: "Outro" },
];

const FOLGA_TYPE_LABELS: Record<string, string> = {
  DAY_OFF: "Folga",
  NO_SHOW: "No-show",
  RECESSO: "Recesso",
  AFASTAMENTO: "Afastamento",
  RESTRICAO: "Restrição",
  OUTRO: "Outro",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

function formatFolgaDate(value: string | Date): string {
  const iso = typeof value === "string" ? value : value.toISOString();
  return formatDate(iso.slice(0, 10));
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── Request Card ───────────────────────────────────────────────────────────────

function RequestCard({
  req,
  onAccept,
  onReject,
  responding,
}: {
  req: RequestItem;
  onAccept?: () => void;
  onReject?: () => void;
  responding?: boolean;
}) {
  const badge = STATUS_BADGES[req.status] ?? "bg-gray-100 text-gray-600";
  const isAlternative = req.status === "ALTERNATIVE_PROPOSED";

  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm font-semibold">
            {REQUEST_TYPE_LABELS[req.type] ?? req.type}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${badge}`}>
            {REQUEST_STATUS_LABELS[req.status] ?? req.status}
          </span>
        </div>

        {req.targetDates.length > 0 && (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Calendar className="h-3 w-3" />
            {req.targetDates.map(formatDate).join(", ")}
          </p>
        )}

        {req.operationName && (
          <p className="text-xs text-muted-foreground">{req.operationName}</p>
        )}

        {req.reason && <p className="text-sm text-foreground">{req.reason}</p>}

        {isAlternative && onAccept && onReject && (
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs text-green-700 border-green-200 hover:bg-green-50"
              disabled={responding}
              onClick={onAccept}
            >
              <Check className="h-3.5 w-3.5 mr-1" /> Aceitar
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs text-red-600 border-red-200 hover:bg-red-50"
              disabled={responding}
              onClick={onReject}
            >
              <X className="h-3.5 w-3.5 mr-1" /> Rejeitar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MembroSolicitacoesPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;

  const [createOpen, setCreateOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<RequestType>("LEAVE");
  const [selectedOperationId, setSelectedOperationId] = useState("");
  const [datesText, setDatesText] = useState(today());
  const [reason, setReason] = useState("");

  const { data: opsData } = useGetOperations();
  const operations = opsData?.operations ?? [];

  const {
    data,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useListRequests(undefined as any, {
    query: { refetchOnWindowFocus: true } as any,
  });
  const requests = data?.requests ?? [];

  const folgaParams = { userId, status: "ACTIVE" as const };
  const {
    data: folgasData,
    isLoading: folgasLoading,
  } = useListFolgas(folgaParams, {
    query: { enabled: !!userId } as any,
  });
  const folgas = folgasData?.folgas ?? [];

  const createMutation = useCreateRequest({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
        setCreateOpen(false);
        setSelectedType("LEAVE");
        setSelectedOperationId("");
        setDatesText(today());
        setReason("");
        refetch();
      },
    },
  });

  const updateMutation = useUpdateRequest({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
        refetch();
      },
    },
  });

  const targetDates = datesText
    .split(/[,\s]+/)
    .map((d) => d.trim())
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));

  const canSubmit = !!selectedOperationId && targetDates.length > 0;

  const handleCreate = () => {
    if (!canSubmit) return;
    createMutation.mutate({
      data: {
        type: selectedType,
        operationId: selectedOperationId,
        targetDates,
        reason: reason.trim() || undefined,
      },
    });
  };

  const respondToAlternative = (req: RequestItem, accept: boolean) => {
    updateMutation.mutate({
      id: req.id,
      data: { status: accept ? "ALTERNATIVE_ACCEPTED" : "ALTERNATIVE_REJECTED" },
    });
  };

  const pending = requests.filter((r) => r.status === "PENDING");
  const waiting = requests.filter((r) => r.status === "ALTERNATIVE_PROPOSED");
  const resolved = requests.filter((r) =>
    ["APPROVED", "DENIED", "ALTERNATIVE_ACCEPTED", "ALTERNATIVE_REJECTED", "EXPIRED"].includes(r.status)
  );

  return (
    <AdminLayout title="Solicitações" subtitle="Folgas, trocas e indisponibilidades">
      <div className="max-w-3xl space-y-4">
        <Tabs defaultValue="solicitacoes">
          <div className="flex items-center gap-2 flex-wrap">
            <TabsList>
              <TabsTrigger value="solicitacoes">Minhas Solicitações</TabsTrigger>
              <TabsTrigger value="folgas">Minhas Folgas</TabsTrigger>
            </TabsList>
            <div className="flex-1" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Nova Solicitação
            </Button>
          </div>

          {/* ── Minhas Solicitações ── */}
          <TabsContent value="solicitacoes" className="space-y-4">
            {isLoading ? (
              <div className="flex justify-center py-16">
                <RefreshCw className="h-7 w-7 animate-spin text-muted-foreground" />
              </div>
            ) : isError ? (
              <Card>
                <CardContent className="p-8 text-center space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Não foi possível carregar suas solicitações.
                  </p>
                  <Button variant="outline" size="sm" onClick={() => refetch()}>
                    Tentar novamente
                  </Button>
                </CardContent>
              </Card>
            ) : requests.length === 0 ? (
              <div className="text-center py-16">
                <ClipboardList className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  Sem solicitações por aqui. Precisou de folga ou quer trocar uma escala?
                  Clique em "Nova Solicitação".
                </p>
              </div>
            ) : (
              <>
                {waiting.length > 0 && (
                  <div className="space-y-2">
                    <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      Aguardando sua resposta
                    </h2>
                    {waiting.map((req) => (
                      <RequestCard
                        key={req.id}
                        req={req}
                        responding={updateMutation.isPending}
                        onAccept={() => respondToAlternative(req, true)}
                        onReject={() => respondToAlternative(req, false)}
                      />
                    ))}
                  </div>
                )}

                {pending.length > 0 && (
                  <div className="space-y-2">
                    <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      Pendentes
                    </h2>
                    {pending.map((req) => (
                      <RequestCard key={req.id} req={req} />
                    ))}
                  </div>
                )}

                {resolved.length > 0 && (
                  <div className="space-y-2">
                    <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      Resolvidas
                    </h2>
                    {resolved.map((req) => (
                      <RequestCard key={req.id} req={req} />
                    ))}
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* ── Minhas Folgas ── */}
          <TabsContent value="folgas" className="space-y-4">
            {folgasLoading ? (
              <div className="flex justify-center py-16">
                <RefreshCw className="h-7 w-7 animate-spin text-muted-foreground" />
              </div>
            ) : folgas.length === 0 ? (
              <div className="text-center py-16">
                <Palmtree className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  Você não tem folgas registradas.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {folgas.map((f) => (
                  <Card key={f.id}>
                    <CardContent className="p-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex items-center gap-1.5 shrink-0 rounded-lg bg-primary/10 px-2.5 py-1.5">
                          <Calendar className="h-3.5 w-3.5 text-primary" />
                          <span className="text-xs font-medium text-primary whitespace-nowrap">
                            {formatFolgaDate(f.startDate)}
                            {formatFolgaDate(f.endDate) !== formatFolgaDate(f.startDate)
                              ? ` — ${formatFolgaDate(f.endDate)}`
                              : ""}
                          </span>
                        </div>
                        <div className="min-w-0">
                          {f.operationName && (
                            <p className="text-sm font-medium truncate">{f.operationName}</p>
                          )}
                          {f.notes && (
                            <p className="text-xs text-muted-foreground truncate">{f.notes}</p>
                          )}
                        </div>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-50 text-green-700 border border-green-200 whitespace-nowrap shrink-0">
                        {FOLGA_TYPE_LABELS[f.type] ?? f.type}
                      </span>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Create Dialog ── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova Solicitação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Tipo de solicitação</Label>
              <Select value={selectedType} onValueChange={(v) => setSelectedType(v as RequestType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REQUEST_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Operação *</Label>
              <Select value={selectedOperationId} onValueChange={setSelectedOperationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar operação..." />
                </SelectTrigger>
                <SelectContent>
                  {(operations as any[]).map((op) => (
                    <SelectItem key={op.id} value={op.id}>
                      {op.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Datas (AAAA-MM-DD, separe por vírgula) *</Label>
              <Input
                value={datesText}
                onChange={(e) => setDatesText(e.target.value)}
                placeholder="ex: 2025-07-10, 2025-07-11"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Motivo (opcional)</Label>
              <Textarea
                rows={4}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Descreva o motivo da solicitação..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={!canSubmit || createMutation.isPending}>
              {createMutation.isPending ? "Enviando..." : "Enviar Solicitação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
