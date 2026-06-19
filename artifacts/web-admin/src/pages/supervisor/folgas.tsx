import { useState } from "react";
import AdminLayout from "@/components/admin-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import {
  useListFolgas,
  useCancelFolga,
  getListFolgasQueryKey,
} from "@workspace/api-client-react";
import { Palmtree, Loader2, XCircle } from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  DAY_OFF:     "Folga",
  NO_SHOW:     "No-show",
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
  { value: "NO_SHOW",     label: "No-show" },
  { value: "RECESSO",     label: "Recesso" },
  { value: "AFASTAMENTO", label: "Afastamento" },
  { value: "RESTRICAO",   label: "Restrição" },
  { value: "OUTRO",       label: "Outro" },
];

export default function SupervisorFolgasPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { roles } = useAuth();

  const operationId = roles[0]?.operationId ?? "";

  const [type,     setType]     = useState("__all__");
  const [status,   setStatus]   = useState("ACTIVE");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo,   setDateTo]   = useState("");

  const params = {
    operationId,
    ...(type !== "__all__" ? { type: type as any } : {}),
    ...(status !== "__all__" ? { status: status as any } : {}),
    ...(dateFrom ? { dateFrom } : {}),
    ...(dateTo   ? { dateTo }   : {}),
  };

  const { data, isLoading } = useListFolgas(params, { query: { enabled: !!operationId } } as any);
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

  return (
    <AdminLayout title="Folgas da Equipe">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
            <Palmtree className="w-5 h-5 text-green-700" />
          </div>
          <div>
            <h1 className="text-2xl font-serif font-bold">Folgas da Equipe</h1>
            <p className="text-sm text-muted-foreground">Ausências e dias de descanso da operação</p>
          </div>
        </div>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
                    <SelectItem value="__all__">Todos</SelectItem>
                    <SelectItem value="ACTIVE">Ativa</SelectItem>
                    <SelectItem value="CANCELLED">Cancelada</SelectItem>
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
                        <td className="py-3 px-4 font-medium">{f.userName}</td>
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
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 gap-1 text-xs text-destructive hover:text-destructive"
                              onClick={() => cancelFolga({ id: f.id })}
                            >
                              <XCircle className="w-3 h-3" />
                              Cancelar
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
      </div>
    </AdminLayout>
  );
}
