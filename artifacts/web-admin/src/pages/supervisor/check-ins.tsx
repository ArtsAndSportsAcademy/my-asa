import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ClipboardCheck, UserX, Clock, CheckCircle2, UserCheck } from "lucide-react";
import AdminLayout from "@/components/admin-layout";

const STATUS_OPTIONS = [
  { value: "CHECKED_IN", label: "Presente", color: "bg-green-100 text-green-800" },
  { value: "LATE",       label: "Atrasado", color: "bg-yellow-100 text-yellow-800" },
  { value: "ABSENT",     label: "Ausente",  color: "bg-red-100 text-red-800" },
  { value: "EXCUSED",    label: "Justificado", color: "bg-blue-100 text-blue-800" },
];

interface CheckInItem {
  userId: string;
  userName: string;
  userPhotoUrl: string | null;
  earliestStart: string | null;
  checkInId: string | null;
  status: string;
  checkedInAt: string | null;
  excuseReason: string | null;
}

function StatusBadge({ status }: { status: string }) {
  const opt = STATUS_OPTIONS.find(s => s.value === status);
  const color = opt?.color ?? "bg-gray-100 text-gray-600";
  const label = opt?.label ?? "Esperado";
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>{label}</span>;
}

export default function SupervisorCheckInsPage() {
  const { roles } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const operationId = roles.find((r) => r.operationId)?.operationId ?? "";
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [excuseInput, setExcuseInput] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["check-ins-supervisor", operationId, date],
    queryFn: () => customFetch<{ checkIns: CheckInItem[] }>(
      `/api/check-ins?operationId=${operationId}&date=${date}`
    ),
    enabled: !!operationId && !!date,
  });

  const updateMutation = useMutation({
    mutationFn: ({ checkInId, userId, status, excuseReason }: {
      checkInId: string; userId: string; status: string; excuseReason?: string;
    }) =>
      customFetch(`/api/check-ins/${checkInId}`, {
        method: "PATCH",
        body: JSON.stringify({ status, userId, operationId, date, excuseReason: excuseReason ?? null }),
      }),
    onSuccess: () => {
      toast({ title: "Check-in atualizado" });
      qc.invalidateQueries({ queryKey: ["check-ins-supervisor"] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Erro ao atualizar check-in";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    },
  });

  const checkIns = data?.checkIns ?? [];
  const totalPresent = checkIns.filter(c => ["CHECKED_IN", "LATE"].includes(c.status)).length;
  const totalAbsent = checkIns.filter(c => c.status === "ABSENT").length;
  const totalExcused = checkIns.filter(c => c.status === "EXCUSED").length;
  const totalExpected = checkIns.filter(c => c.status === "EXPECTED").length;

  const handleStatusChange = (item: CheckInItem, status: string) => {
    const excuseReason = status === "EXCUSED" ? (excuseInput[item.userId] ?? "") : undefined;
    updateMutation.mutate({ checkInId: item.checkInId ?? "new", userId: item.userId, status, excuseReason });
  };

  return (
    <AdminLayout title="Check-ins do Dia" subtitle="Visualize e corrija a presença do elenco.">
    <div className="max-w-4xl space-y-6">
      <div className="flex justify-end">
        <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-40" />
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div className="border rounded-lg p-3 text-center bg-green-50">
          <div className="text-2xl font-bold text-green-700">{totalPresent}</div>
          <div className="text-xs text-green-600">Presentes</div>
        </div>
        <div className="border rounded-lg p-3 text-center bg-red-50">
          <div className="text-2xl font-bold text-red-700">{totalAbsent}</div>
          <div className="text-xs text-red-600">Ausentes</div>
        </div>
        <div className="border rounded-lg p-3 text-center bg-blue-50">
          <div className="text-2xl font-bold text-blue-700">{totalExcused}</div>
          <div className="text-xs text-blue-600">Justificados</div>
        </div>
        <div className="border rounded-lg p-3 text-center bg-gray-50">
          <div className="text-2xl font-bold text-gray-700">{totalExpected}</div>
          <div className="text-xs text-gray-500">Aguardando</div>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Carregando check-ins...</div>
      ) : checkIns.length === 0 ? (
        <div className="text-center py-12 border rounded-lg text-muted-foreground">
          <ClipboardCheck className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p>Nenhum membro escalado nesta data.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {checkIns.map((item) => (
            <div key={item.userId} className="border rounded-lg p-4 bg-white shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-semibold">
                    {item.userName?.slice(0, 1)}
                  </div>
                  <div>
                    <div className="font-medium">{item.userName}</div>
                    {item.earliestStart && (
                      <div className="text-xs text-muted-foreground">Entrada prevista: {item.earliestStart}</div>
                    )}
                    {item.checkedInAt && (
                      <div className="text-xs text-muted-foreground">
                        Check-in: {new Date(item.checkedInAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={item.status} />
                  <Select onValueChange={v => handleStatusChange(item, v)}>
                    <SelectTrigger className="w-36 h-8 text-xs">
                      <SelectValue placeholder="Alterar status" />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {item.status === "EXCUSED" && item.excuseReason && (
                <p className="mt-2 text-xs text-blue-700 bg-blue-50 rounded px-2 py-1">
                  Justificativa: {item.excuseReason}
                </p>
              )}
              <div className="mt-2 flex items-center gap-2">
                <Input
                  placeholder="Justificativa (para EXCUSED)"
                  className="h-7 text-xs flex-1"
                  value={excuseInput[item.userId] ?? ""}
                  onChange={e => setExcuseInput(prev => ({ ...prev, [item.userId]: e.target.value }))}
                />
                {excuseInput[item.userId] && (
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleStatusChange(item, "EXCUSED")}>
                    Justificar
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
    </AdminLayout>
  );
}
