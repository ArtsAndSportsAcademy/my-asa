import { useState } from "react";
import AdminLayout from "@/components/admin-layout";
import { useListFolgas } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Palmtree, RefreshCw, Plus } from "lucide-react";
import { Link } from "wouter";

const FOLGA_LABELS: Record<string, string> = {
  DAY_OFF: "Folga",
  RECESSO: "Recesso",
  AFASTAMENTO: "Afastamento",
  RESTRICAO: "Restrição",
  OUTRO: "Outro",
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Ativa",
  CANCELLED: "Cancelada",
};

export default function MembroFolgasPage() {
  const { user } = useAuth();
  const [status, setStatus] = useState("ACTIVE");

  const { data, isLoading, refetch } = useListFolgas(
    { ...(status !== "__all__" ? { status: status as any } : {}) },
    { query: { enabled: true } } as any
  );

  const folgas = (data?.folgas ?? []).filter((f: any) =>
    f.userId === user?.id
  );

  return (
    <AdminLayout title="Minhas Folgas" subtitle="Suas ausências e afastamentos registrados">
      <div className="max-w-2xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <Palmtree className="w-5 h-5 text-green-700" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Folgas & Ausências</h2>
              <p className="text-xs text-gray-500">Visualize suas folgas registradas</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/membro/solicitacoes">
              <Button size="sm" variant="outline" className="gap-2">
                <Plus className="w-4 h-4" />
                Solicitar
              </Button>
            </Link>
            <Button size="sm" variant="ghost" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos</SelectItem>
              <SelectItem value="ACTIVE">Ativas</SelectItem>
              <SelectItem value="CANCELLED">Canceladas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading && (
          <div className="flex justify-center py-12">
            <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        )}

        {!isLoading && folgas.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <Palmtree className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhuma folga registrada.</p>
            <p className="text-xs mt-1">
              Para solicitar uma folga, use a página de{" "}
              <Link href="/membro/solicitacoes" className="text-primary hover:underline">
                Solicitações
              </Link>.
            </p>
          </div>
        )}

        {!isLoading && folgas.length > 0 && (
          <div className="space-y-3">
            {folgas.map((f: any) => (
              <div key={f.id} className="bg-white border rounded-lg p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
                    <Palmtree className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {FOLGA_LABELS[f.type] ?? f.type}
                    </p>
                    <p className="text-xs text-gray-500">
                      {f.startDate} → {f.endDate}
                    </p>
                    {f.notes && (
                      <p className="text-xs text-gray-400 mt-0.5">{f.notes}</p>
                    )}
                  </div>
                </div>
                <Badge
                  variant={f.status === "ACTIVE" ? "default" : "secondary"}
                  className="text-xs shrink-0"
                >
                  {STATUS_LABELS[f.status] ?? f.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
