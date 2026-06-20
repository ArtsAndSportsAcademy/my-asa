import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Plus } from "lucide-react";
import AdminLayout from "@/components/admin-layout";

const RESTRICTION_TYPES = [
  { value: "HEALTH", label: "Saúde" },
  { value: "PHYSICAL", label: "Física" },
  { value: "ROLE", label: "Função" },
  { value: "SCHEDULE", label: "Disponibilidade" },
  { value: "TECHNICAL", label: "Técnica" },
  { value: "PERSONAL", label: "Pessoal" },
];

const TYPE_COLORS: Record<string, string> = {
  HEALTH: "bg-red-100 text-red-800 border-red-200",
  PHYSICAL: "bg-orange-100 text-orange-800 border-orange-200",
  ROLE: "bg-purple-100 text-purple-800 border-purple-200",
  SCHEDULE: "bg-blue-100 text-blue-800 border-blue-200",
  TECHNICAL: "bg-yellow-100 text-yellow-800 border-yellow-200",
  PERSONAL: "bg-gray-100 text-gray-800 border-gray-200",
};

interface RestrictionItem {
  id: string;
  userId: string;
  userName: string;
  type: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  notes: string | null;
  createdAt: string;
}

interface UserItem { id: string; name: string; }

export default function SupervisorRestrictionsPage() {
  const { roles } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const operationId = roles[0]?.operationId ?? "";

  const [showNew, setShowNew] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("ACTIVE");

  const [form, setForm] = useState({
    userId: "",
    type: "HEALTH",
    periodStart: "",
    periodEnd: "",
    notes: "",
  });

  const [editForm, setEditForm] = useState({
    periodStart: "",
    periodEnd: "",
    notes: "",
    type: "HEALTH",
  });

  const { data: restrictionsData, isLoading } = useQuery({
    queryKey: ["restrictions", operationId, statusFilter],
    queryFn: () => customFetch<{ restrictions: RestrictionItem[] }>(
      `/api/restrictions?operationId=${operationId}${statusFilter ? `&status=${statusFilter}` : ""}`
    ),
    enabled: !!operationId,
  });

  const { data: usersData } = useQuery({
    queryKey: ["users-op", operationId],
    queryFn: () => customFetch<{ users: UserItem[] }>(`/api/users?operationId=${operationId}`),
    enabled: !!operationId,
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof form) =>
      customFetch("/api/restrictions", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      toast({ title: "Indisponibilidade registrada" });
      qc.invalidateQueries({ queryKey: ["restrictions"] });
      setShowNew(false);
      setForm({ userId: "", type: "HEALTH", periodStart: "", periodEnd: "", notes: "" });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Erro ao criar restrição";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<typeof editForm> }) =>
      customFetch(`/api/restrictions/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => {
      toast({ title: "Indisponibilidade atualizada" });
      qc.invalidateQueries({ queryKey: ["restrictions"] });
      setEditId(null);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Erro ao atualizar";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    },
  });

  const encerrarMutation = useMutation({
    mutationFn: (id: string) =>
      customFetch(`/api/restrictions/${id}/encerrar`, { method: "POST" }),
    onSuccess: () => {
      toast({ title: "Indisponibilidade encerrada" });
      qc.invalidateQueries({ queryKey: ["restrictions"] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Erro ao encerrar";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    },
  });

  const restrictions = restrictionsData?.restrictions ?? [];
  const users = usersData?.users ?? [];

  const openEdit = (r: RestrictionItem) => {
    setEditId(r.id);
    setEditForm({ periodStart: r.periodStart, periodEnd: r.periodEnd, notes: r.notes ?? "", type: r.type });
  };

  return (
    <AdminLayout title="Indisponibilidades" subtitle="Registre e gerencie impedimentos temporários de membros da equipe.">
    <div className="max-w-4xl space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => setShowNew(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Nova Indisponibilidade
        </Button>
      </div>

      <div className="flex gap-2">
        {(["ACTIVE", "EXPIRED", ""] as const).map((s) => (
          <Button key={s} variant={statusFilter === s ? "default" : "outline"} size="sm" onClick={() => setStatusFilter(s)}>
            {s === "ACTIVE" ? "Ativas" : s === "EXPIRED" ? "Encerradas" : "Todas"}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Carregando...</div>
      ) : restrictions.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border rounded-lg">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p>Nenhuma restrição encontrada.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {restrictions.map((r) => (
            <div key={r.id} className="border rounded-lg p-4 bg-white shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{r.userName}</span>
                    <Badge className={`text-xs border ${TYPE_COLORS[r.type] ?? ""}`}>
                      {RESTRICTION_TYPES.find(t => t.value === r.type)?.label ?? r.type}
                    </Badge>
                    <Badge variant={r.status === "ACTIVE" ? "destructive" : "secondary"} className="text-xs">
                      {r.status === "ACTIVE" ? "Ativa" : "Encerrada"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{r.periodStart} → {r.periodEnd}</p>
                  {r.notes && <p className="text-xs text-muted-foreground italic">{r.notes}</p>}
                </div>
                {r.status === "ACTIVE" && (
                  <div className="flex gap-2 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => openEdit(r)}>Editar</Button>
                    <Button variant="destructive" size="sm" onClick={() => encerrarMutation.mutate(r.id)}>Encerrar</Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nova Indisponibilidade</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Membro</Label>
              <Select value={form.userId} onValueChange={v => setForm(f => ({ ...f, userId: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar membro" /></SelectTrigger>
                <SelectContent>
                  {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RESTRICTION_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Início</Label>
                <Input type="date" value={form.periodStart} onChange={e => setForm(f => ({ ...f, periodStart: e.target.value }))} />
              </div>
              <div>
                <Label>Término</Label>
                <Input type="date" value={form.periodEnd} onChange={e => setForm(f => ({ ...f, periodEnd: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Detalhes opcionais..." />
            </div>
            <Button className="w-full" onClick={() => createMutation.mutate(form)} disabled={!form.userId || !form.periodStart || !form.periodEnd || createMutation.isPending}>
              {createMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editId} onOpenChange={() => setEditId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Editar Indisponibilidade</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Tipo</Label>
              <Select value={editForm.type} onValueChange={v => setEditForm(f => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RESTRICTION_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Início</Label>
                <Input type="date" value={editForm.periodStart} onChange={e => setEditForm(f => ({ ...f, periodStart: e.target.value }))} />
              </div>
              <div>
                <Label>Término</Label>
                <Input type="date" value={editForm.periodEnd} onChange={e => setEditForm(f => ({ ...f, periodEnd: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea rows={3} value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <Button className="w-full" onClick={() => editId && updateMutation.mutate({ id: editId, data: editForm })} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </AdminLayout>
  );
}
