import { useState } from "react";
import AdminLayout from "@/components/admin-layout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useGetOperations, useListRequests } from "@workspace/api-client-react";

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

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800 border-amber-200",
  APPROVED: "bg-green-100 text-green-800 border-green-200",
  DENIED: "bg-red-100 text-red-800 border-red-200",
  ALTERNATIVE_PROPOSED: "bg-blue-100 text-blue-800 border-blue-200",
  ALTERNATIVE_ACCEPTED: "bg-green-100 text-green-800 border-green-200",
  ALTERNATIVE_REJECTED: "bg-red-100 text-red-800 border-red-200",
  EXPIRED: "bg-gray-100 text-gray-600 border-gray-200",
};

const ALL_STATUSES = [
  { value: "", label: "Todos os status" },
  { value: "PENDING", label: "Aguardando" },
  { value: "APPROVED", label: "Aprovadas" },
  { value: "DENIED", label: "Negadas" },
  { value: "ALTERNATIVE_PROPOSED", label: "Alternativa Proposta" },
  { value: "ALTERNATIVE_ACCEPTED", label: "Alternativa Aceita" },
  { value: "ALTERNATIVE_REJECTED", label: "Alternativa Rejeitada" },
  { value: "EXPIRED", label: "Expiradas" },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function AdminRequestsPage() {
  const [operationId, setOperationId] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  const { data: opsData } = useGetOperations();
  const operations = opsData?.operations ?? [];

  const { data, isLoading } = useListRequests({
    operationId: operationId || undefined,
    status: statusFilter || undefined,
  });
  const requests = data?.requests ?? [];

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
                  <SelectValue placeholder="Todas as operações" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todas as operações</SelectItem>
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
                  <SelectValue placeholder="Todos os status" />
                </SelectTrigger>
                <SelectContent>
                  {ALL_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Contagem */}
        {!isLoading && (
          <p className="text-sm text-muted-foreground">
            {requests.length} solicitaç{requests.length === 1 ? "ão" : "ões"} encontrada{requests.length !== 1 ? "s" : ""}
          </p>
        )}

        {/* Lista */}
        {isLoading ? (
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
                        <Badge
                          className={`text-xs border ${STATUS_COLORS[req.status] ?? ""}`}
                          variant="outline"
                        >
                          {STATUS_LABELS[req.status] ?? req.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                          {TYPE_LABELS[req.type] ?? req.type}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {req.operationName} · {formatDates(req.targetDates)}
                      </p>
                      {req.reason && (
                        <p className="text-sm text-foreground/70 mt-1 line-clamp-2">{req.reason}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        {new Date(req.createdAt).toLocaleDateString("pt-BR", {
                          day: "2-digit", month: "short", year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
