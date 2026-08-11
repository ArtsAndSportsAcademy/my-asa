import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetOperations,
  getGetOperationsQueryKey,
  useCreateOperation,
  useUpdateOperation,
  useUpdateOperationStatus,
} from "@workspace/api-client-react";
import type { Operation } from "@workspace/api-client-react";
import AdminLayout from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useLocation } from "wouter";
import {
  Plus, MoreHorizontal, Pencil, RefreshCw, AlertCircle, Users2, MapPin,
  Building2, CalendarDays, Sparkles, Mountain, Waves, Hotel, Theater, Clock, Globe,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Rascunho", ACTIVE: "Ativa", PAUSED: "Pausada", ARCHIVED: "Arquivada",
};
const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  DRAFT: "secondary", ACTIVE: "default", PAUSED: "outline", ARCHIVED: "destructive",
};
const STATUS_OPTIONS = ["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"] as const;
const ICON_OPTIONS = [
  { value: "sparkles", label: "Artístico", Icon: Sparkles },
  { value: "mountain", label: "Parque de neve", Icon: Mountain },
  { value: "waves", label: "Parque aquático", Icon: Waves },
  { value: "hotel", label: "Hotelaria", Icon: Hotel },
  { value: "theater", label: "Espetáculos", Icon: Theater },
] as const;
const ICONS = Object.fromEntries(ICON_OPTIONS.map(({ value, Icon }) => [value, Icon]));

type OperationForm = {
  name: string;
  description: string;
  clientName: string;
  locations: string;
  startDate: string;
  endDate: string;
  color: string;
  icon: string;
  status: string;
  lateThresholdMinutes: number;
  timezone: string;
};

const EMPTY_FORM: OperationForm = {
  name: "", description: "", clientName: "", locations: "", startDate: "", endDate: "",
  color: "#6D4AFF", icon: "sparkles", status: "DRAFT", lateThresholdMinutes: 15,
  timezone: "America/Sao_Paulo",
};

function locationsToArray(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function OperationFields({ form, setForm, includeTechnical = false }: {
  form: OperationForm;
  setForm: (next: OperationForm) => void;
  includeTechnical?: boolean;
}) {
  const update = <K extends keyof OperationForm>(key: K, value: OperationForm[K]) =>
    setForm({ ...form, [key]: value });

  return (
    <div className="space-y-5 py-1">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="operation-name">Nome da operação</Label>
          <Input id="operation-name" value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Ex.: Snowland" />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="operation-description">Descrição</Label>
          <Textarea id="operation-description" value={form.description} onChange={(e) => update("description", e.target.value)} placeholder="O que a ASA realiza nesta operação?" rows={3} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="operation-client">Cliente ou empreendimento</Label>
          <Input id="operation-client" value={form.clientName} onChange={(e) => update("clientName", e.target.value)} placeholder="Ex.: Gramado Parks" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="operation-locations">Locais</Label>
          <Input id="operation-locations" value={form.locations} onChange={(e) => update("locations", e.target.value)} placeholder="Separe os locais por vírgula" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="operation-start">Início</Label>
          <Input id="operation-start" type="date" value={form.startDate} onChange={(e) => update("startDate", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="operation-end">Término, se houver</Label>
          <Input id="operation-end" type="date" value={form.endDate} onChange={(e) => update("endDate", e.target.value)} min={form.startDate || undefined} />
        </div>
        <div className="space-y-2">
          <Label>Ícone</Label>
          <Select value={form.icon} onValueChange={(value) => update("icon", value)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{ICON_OPTIONS.map(({ value, label, Icon }) => (
              <SelectItem key={value} value={value}><span className="flex items-center gap-2"><Icon className="h-4 w-4" />{label}</span></SelectItem>
            ))}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="operation-color">Cor de identificação</Label>
          <div className="flex gap-2">
            <Input id="operation-color" type="color" value={form.color} onChange={(e) => update("color", e.target.value)} className="h-10 w-14 p-1" />
            <Input value={form.color} onChange={(e) => update("color", e.target.value)} maxLength={7} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Situação</Label>
          <Select value={form.status} onValueChange={(value) => update("status", value)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{STATUS_OPTIONS.map((value) => <SelectItem key={value} value={value}>{STATUS_LABELS[value]}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      {includeTechnical && (
        <div className="rounded-xl border bg-muted/30 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Configuração interna</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Clock className="h-4 w-4" />Referência operacional (minutos)</Label>
              <Input type="number" min={0} value={form.lateThresholdMinutes} onChange={(e) => update("lateThresholdMinutes", Math.max(0, Number(e.target.value) || 0))} />
              <p className="text-xs text-muted-foreground">Parâmetro interno; não representa controle de jornada.</p>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Globe className="h-4 w-4" />Fuso horário</Label>
              <Input value={form.timezone} onChange={(e) => update("timezone", e.target.value)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function OperationsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { data, isLoading, error } = useGetOperations();
  const operations: Operation[] = data?.operations ?? [];
  const createMutation = useCreateOperation();
  const updateMutation = useUpdateOperation();
  const updateStatusMutation = useUpdateOperationStatus();
  const [createOpen, setCreateOpen] = useState(false);
  const [editOp, setEditOp] = useState<Operation | null>(null);
  const [statusOp, setStatusOp] = useState<Operation | null>(null);
  const [createForm, setCreateForm] = useState<OperationForm>(EMPTY_FORM);
  const [editForm, setEditForm] = useState<OperationForm>(EMPTY_FORM);
  const [newStatus, setNewStatus] = useState("");
  const invalidate = () => queryClient.invalidateQueries({ queryKey: getGetOperationsQueryKey() });

  const apiData = (form: OperationForm) => ({
    name: form.name.trim(), description: form.description.trim() || null,
    clientName: form.clientName.trim() || null, locations: locationsToArray(form.locations),
    startDate: form.startDate || null, endDate: form.endDate || null, color: form.color,
    icon: form.icon, lateThresholdMinutes: form.lateThresholdMinutes, timezone: form.timezone,
  });

  const openEdit = (op: Operation) => {
    setEditOp(op);
    setEditForm({
      name: op.name, description: op.description ?? "", clientName: op.clientName ?? "",
      locations: (op.locations ?? []).join(", "), startDate: op.startDate ?? "", endDate: op.endDate ?? "",
      color: op.color ?? "#6D4AFF", icon: op.icon ?? "sparkles", status: op.status,
      lateThresholdMinutes: op.lateThresholdMinutes ?? 15, timezone: op.timezone ?? "America/Sao_Paulo",
    });
  };

  const handleCreate = () => {
    if (!createForm.name.trim()) return;
    createMutation.mutate({ data: { ...apiData(createForm), status: createForm.status as never } }, {
      onSuccess: () => { toast({ title: "Operação criada" }); setCreateOpen(false); setCreateForm(EMPTY_FORM); invalidate(); },
      onError: () => toast({ title: "Não foi possível criar a operação", variant: "destructive" }),
    });
  };

  const handleEdit = () => {
    if (!editOp || !editForm.name.trim()) return;
    updateMutation.mutate({ id: editOp.id, data: apiData(editForm) }, {
      onSuccess: () => { toast({ title: "Operação atualizada" }); setEditOp(null); invalidate(); },
      onError: () => toast({ title: "Não foi possível atualizar a operação", variant: "destructive" }),
    });
  };

  const handleStatusChange = () => {
    if (!statusOp || !newStatus) return;
    updateStatusMutation.mutate({ id: statusOp.id, data: { status: newStatus as never } }, {
      onSuccess: () => { toast({ title: newStatus === "ARCHIVED" ? "Operação arquivada" : "Situação atualizada" }); setStatusOp(null); invalidate(); },
      onError: () => toast({ title: "Não foi possível atualizar a situação", variant: "destructive" }),
    });
  };

  return (
    <AdminLayout title="Operações" subtitle="Os ambientes contínuos onde a ASA realiza seu trabalho">
      <div className="space-y-6">
        <section className="relative overflow-hidden rounded-2xl border bg-card p-5">
          <div className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-violet-500 via-fuchsia-500 to-blue-500" />
          <div className="flex flex-col gap-4 pl-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Estrutura ASA</p>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Snowland, Acquamotion e Hotelaria são operações. Shows, ensaios e eventos vivem dentro delas.</p>
            </div>
            <Button onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-4 w-4" />Nova operação</Button>
          </div>
        </section>

        {error && <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"><AlertCircle className="h-4 w-4" />Não foi possível carregar as operações.</div>}

        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {isLoading ? [...Array(3)].map((_, i) => <div key={i} className="h-56 animate-pulse rounded-2xl border bg-muted" />) :
          operations.length === 0 ? <div className="col-span-full rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">Nenhuma operação cadastrada. Crie o primeiro ambiente de trabalho da ASA.</div> :
          operations.map((op) => {
            const Icon = ICONS[op.icon ?? "sparkles"] ?? Sparkles;
            return (
              <article key={op.id} className="group overflow-hidden rounded-2xl border bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="h-1.5" style={{ backgroundColor: op.color ?? "#6D4AFF" }} />
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 gap-3">
                      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl" style={{ backgroundColor: `${op.color ?? "#6D4AFF"}18`, color: op.color ?? "#6D4AFF" }}><Icon className="h-5 w-5" /></div>
                      <div className="min-w-0"><h2 className="truncate text-lg font-semibold">{op.name}</h2><p className="truncate text-sm text-muted-foreground">{op.clientName || "Operação ASA"}</p></div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(op)}><Pencil className="mr-2 h-4 w-4" />Editar cadastro</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setLocation(`/admin/groups?operationId=${op.id}`)}><Users2 className="mr-2 h-4 w-4" />Ver equipes relacionadas</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => { setStatusOp(op); setNewStatus(op.status); }}><RefreshCw className="mr-2 h-4 w-4" />Alterar situação</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <p className="mt-4 line-clamp-2 min-h-10 text-sm text-muted-foreground">{op.description || "Adicione uma descrição para orientar quem consulta esta operação."}</p>
                  <div className="mt-4 space-y-2 text-xs text-muted-foreground">
                    <p className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" />{op.locations?.length ? op.locations.join(" · ") : "Locais ainda não informados"}</p>
                    <p className="flex items-center gap-2"><CalendarDays className="h-3.5 w-3.5" />{op.startDate ? `Desde ${new Date(`${op.startDate}T12:00:00`).toLocaleDateString("pt-BR")}` : "Operação contínua"}{op.endDate ? ` até ${new Date(`${op.endDate}T12:00:00`).toLocaleDateString("pt-BR")}` : ""}</p>
                  </div>
                  <div className="mt-5 flex items-center justify-between border-t pt-4"><Badge variant={STATUS_VARIANTS[op.status] ?? "secondary"}>{STATUS_LABELS[op.status] ?? op.status}</Badge><span className="flex items-center gap-1 text-xs text-muted-foreground"><Building2 className="h-3.5 w-3.5" />ASA</span></div>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>Nova operação</DialogTitle></DialogHeader><OperationFields form={createForm} setForm={setCreateForm} /><DialogFooter><Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button><Button onClick={handleCreate} disabled={!createForm.name.trim() || createMutation.isPending}>{createMutation.isPending ? "Criando..." : "Criar operação"}</Button></DialogFooter></DialogContent>
      </Dialog>

      <Dialog open={!!editOp} onOpenChange={(open) => !open && setEditOp(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>Editar {editOp?.name}</DialogTitle></DialogHeader><OperationFields form={editForm} setForm={setEditForm} includeTechnical /><DialogFooter><Button variant="outline" onClick={() => setEditOp(null)}>Cancelar</Button><Button onClick={handleEdit} disabled={!editForm.name.trim() || updateMutation.isPending}>{updateMutation.isPending ? "Salvando..." : "Salvar alterações"}</Button></DialogFooter></DialogContent>
      </Dialog>

      <Dialog open={!!statusOp} onOpenChange={(open) => !open && setStatusOp(null)}>
        <DialogContent><DialogHeader><DialogTitle>Alterar situação — {statusOp?.name}</DialogTitle></DialogHeader><div className="space-y-3 py-2"><Label>Nova situação</Label><Select value={newStatus} onValueChange={setNewStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STATUS_OPTIONS.map((value) => <SelectItem key={value} value={value}>{STATUS_LABELS[value]}</SelectItem>)}</SelectContent></Select>{newStatus === "ARCHIVED" && <p className="rounded-lg bg-amber-500/10 p-3 text-sm text-amber-800">A operação sairá das áreas ativas, mas todo o histórico será preservado.</p>}</div><DialogFooter><Button variant="outline" onClick={() => setStatusOp(null)}>Cancelar</Button><Button onClick={handleStatusChange} disabled={updateStatusMutation.isPending}>Confirmar</Button></DialogFooter></DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
