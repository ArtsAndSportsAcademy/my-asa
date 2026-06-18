import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListAgendaEvents,
  useCreateAgendaEvent,
  useUpdateAgendaEvent,
  useDeleteAgendaEvent,
  useConfirmAgendaEvent,
  useSuspendAgendaEvent,
  useCancelAgendaEvent,
  useCompleteAgendaEvent,
  getListAgendaEventsQueryKey,
} from "@workspace/api-client-react";
import type { AgendaEvent } from "@workspace/api-client-react";
import AdminLayout from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Plus, MoreHorizontal, CheckCircle, PauseCircle, XCircle, Flag, Pencil, Trash2, CalendarDays } from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  SHOW: "Apresentação", REHEARSAL: "Ensaio", MEETING: "Reunião",
  OPERATIONAL_BLOCK: "Bloco Operacional", COLLECTIVE_VACATION: "Férias Coletivas",
};
const TYPE_COLORS: Record<string, string> = {
  SHOW: "bg-violet-100 text-violet-800",
  REHEARSAL: "bg-blue-100 text-blue-800",
  MEETING: "bg-amber-100 text-amber-800",
  OPERATIONAL_BLOCK: "bg-indigo-100 text-indigo-800",
  COLLECTIVE_VACATION: "bg-green-100 text-green-800",
};
const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Rascunho", CONFIRMED: "Confirmado", SUSPENDED: "Suspenso",
  CANCELLED: "Cancelado", COMPLETED: "Realizado",
};
const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  DRAFT: "secondary", CONFIRMED: "default", SUSPENDED: "outline",
  CANCELLED: "destructive", COMPLETED: "secondary",
};

const EVENT_TYPES = ["SHOW", "REHEARSAL", "MEETING", "OPERATIONAL_BLOCK", "COLLECTIVE_VACATION"] as const;

interface EventFormState {
  title: string; type: string; date: string; endDate: string;
  startTime: string; endTime: string; location: string; notes: string;
}

const emptyForm: EventFormState = { title: "", type: "SHOW", date: "", endDate: "", startTime: "", endTime: "", location: "", notes: "" };

export default function AgendaPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const auth = useAuth();
  const isAdmin = auth.roles.some((r) => ["ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"].includes(r.role));
  const operationId = auth.roles.find((r) => r.operationId)?.operationId;

  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  const queryParams = {
    operationId,
    status: (filterStatus === "ALL" || !filterStatus ? undefined : filterStatus) as any,
    type: (filterType === "ALL" || !filterType ? undefined : filterType) as any,
    from: filterFrom || undefined,
    to: filterTo || undefined,
  };

  const { data, isLoading } = useListAgendaEvents(queryParams, {
    query: { queryKey: getListAgendaEventsQueryKey(queryParams) },
  });
  const events: AgendaEvent[] = data?.events ?? [];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListAgendaEventsQueryKey({ operationId }) });

  const createMutation = useCreateAgendaEvent();
  const updateMutation = useUpdateAgendaEvent();
  const deleteMutation = useDeleteAgendaEvent();
  const confirmMutation = useConfirmAgendaEvent();
  const suspendMutation = useSuspendAgendaEvent();
  const cancelMutation = useCancelAgendaEvent();
  const completeMutation = useCompleteAgendaEvent();

  const [createOpen, setCreateOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<AgendaEvent | null>(null);
  const [form, setForm] = useState<EventFormState>(emptyForm);
  const [reasonDialog, setReasonDialog] = useState<{ eventId: string; action: "suspend" | "cancel" } | null>(null);
  const [reason, setReason] = useState("");

  const setField = (k: keyof EventFormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleCreate = () => {
    if (!operationId) { toast({ title: "Nenhuma operação ativa", variant: "destructive" }); return; }
    if (!form.title.trim() || !form.date) { toast({ title: "Título e data são obrigatórios", variant: "destructive" }); return; }
    createMutation.mutate(
      {
        data: {
          operationId, title: form.title.trim(), type: form.type as any, date: form.date,
          endDate: form.endDate || undefined, startTime: form.startTime || undefined,
          endTime: form.endTime || undefined, location: form.location || undefined, notes: form.notes || undefined,
        },
      },
      {
        onSuccess: () => { toast({ title: "Evento criado" }); setCreateOpen(false); setForm(emptyForm); invalidate(); },
        onError: () => toast({ title: "Erro ao criar evento", variant: "destructive" }),
      }
    );
  };

  const handleEdit = () => {
    if (!editEvent) return;
    updateMutation.mutate(
      {
        id: editEvent.id,
        data: {
          title: form.title || undefined, date: form.date || undefined,
          endDate: form.endDate || undefined, startTime: form.startTime || undefined,
          endTime: form.endTime || undefined, location: form.location || undefined, notes: form.notes || undefined,
        },
      },
      {
        onSuccess: () => { toast({ title: "Evento atualizado" }); setEditEvent(null); setForm(emptyForm); invalidate(); },
        onError: (err: any) => toast({ title: err?.response?.data?.error ?? "Erro ao atualizar", variant: "destructive" }),
      }
    );
  };

  const handleConfirm = (id: string) => {
    confirmMutation.mutate({ id }, {
      onSuccess: () => { toast({ title: "Evento confirmado" }); invalidate(); },
      onError: (err: any) => toast({ title: err?.response?.data?.error ?? "Erro ao confirmar", variant: "destructive" }),
    });
  };

  const handleTransitionWithReason = () => {
    if (!reasonDialog || !reason.trim()) { toast({ title: "Motivo obrigatório", variant: "destructive" }); return; }
    const { eventId, action } = reasonDialog;
    const mutation = action === "suspend" ? suspendMutation : cancelMutation;
    mutation.mutate({ id: eventId, data: { reason } }, {
      onSuccess: () => {
        toast({ title: action === "suspend" ? "Evento suspenso" : "Evento cancelado" });
        setReasonDialog(null); setReason(""); invalidate();
      },
      onError: (err: any) => toast({ title: err?.response?.data?.error ?? "Erro", variant: "destructive" }),
    });
  };

  const handleComplete = (id: string) => {
    completeMutation.mutate({ id }, {
      onSuccess: () => { toast({ title: "Evento marcado como realizado" }); invalidate(); },
      onError: (err: any) => toast({ title: err?.response?.data?.error ?? "Erro", variant: "destructive" }),
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm("Confirma a exclusão do evento?")) return;
    deleteMutation.mutate({ id }, {
      onSuccess: () => { toast({ title: "Evento excluído" }); invalidate(); },
      onError: (err: any) => toast({ title: err?.response?.data?.error ?? "Erro ao excluir", variant: "destructive" }),
    });
  };

  const openEdit = (event: AgendaEvent) => {
    setEditEvent(event);
    setForm({ title: event.title, type: event.type, date: event.date, endDate: event.endDate ?? "", startTime: event.startTime ?? "", endTime: event.endTime ?? "", location: event.location ?? "", notes: event.notes ?? "" });
  };

  const sortedEvents = [...events].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <AdminLayout title="Agenda" subtitle="Gerencie apresentações, ensaios e eventos">
      <div className="flex flex-col gap-4">
        {/* Filtros */}
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={filterType || "ALL"} onValueChange={(v) => setFilterType(v === "ALL" ? "" : v)}>
            <SelectTrigger className="w-48 h-8 text-sm"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos os tipos</SelectItem>
              {EVENT_TYPES.map((t) => <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus || "ALL"} onValueChange={(v) => setFilterStatus(v === "ALL" ? "" : v)}>
            <SelectTrigger className="w-44 h-8 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos os status</SelectItem>
              {["DRAFT", "CONFIRMED", "SUSPENDED", "CANCELLED", "COMPLETED"].map((s) => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" className="w-36 h-8 text-sm" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} placeholder="De" />
          <Input type="date" className="w-36 h-8 text-sm" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} placeholder="Até" />
          {(filterType || filterStatus || filterFrom || filterTo) && (
            <Button variant="ghost" size="sm" className="h-8" onClick={() => { setFilterType(""); setFilterStatus(""); setFilterFrom(""); setFilterTo(""); }}>
              Limpar
            </Button>
          )}
          <div className="flex-1" />
          {isAdmin && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Novo Evento
            </Button>
          )}
        </div>

        {/* Tabela de eventos */}
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : sortedEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
            <CalendarDays className="h-10 w-10 opacity-20" />
            <p className="text-sm">Nenhum evento encontrado</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Horário</TableHead>
                <TableHead>Local</TableHead>
                <TableHead>Status</TableHead>
                {isAdmin && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedEvents.map((event) => (
                <TableRow key={event.id}>
                  <TableCell className="text-sm font-medium">
                    {new Date(event.date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                  </TableCell>
                  <TableCell className="text-sm">
                    <div>
                      <span className="font-medium">{event.title}</span>
                      {event.reason && <p className="text-xs text-muted-foreground truncate max-w-xs">{event.reason}</p>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[event.type] ?? "bg-gray-100 text-gray-800"}`}>
                      {TYPE_LABELS[event.type] ?? event.type}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {event.startTime ? `${event.startTime}${event.endTime ? ` – ${event.endTime}` : ""}` : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{event.location ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANTS[event.status]}>{STATUS_LABELS[event.status]}</Badge>
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {!["CANCELLED", "COMPLETED"].includes(event.status) && (
                            <DropdownMenuItem onClick={() => openEdit(event)}>
                              <Pencil className="h-3.5 w-3.5 mr-2" /> Editar
                            </DropdownMenuItem>
                          )}
                          {["DRAFT", "SUSPENDED"].includes(event.status) && (
                            <DropdownMenuItem onClick={() => handleConfirm(event.id)}>
                              <CheckCircle className="h-3.5 w-3.5 mr-2 text-green-600" /> Confirmar
                            </DropdownMenuItem>
                          )}
                          {event.status === "CONFIRMED" && (
                            <>
                              <DropdownMenuItem onClick={() => setReasonDialog({ eventId: event.id, action: "suspend" })}>
                                <PauseCircle className="h-3.5 w-3.5 mr-2 text-amber-600" /> Suspender
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleComplete(event.id)}>
                                <Flag className="h-3.5 w-3.5 mr-2 text-blue-600" /> Marcar como realizado
                              </DropdownMenuItem>
                            </>
                          )}
                          {!["CANCELLED", "COMPLETED"].includes(event.status) && (
                            <DropdownMenuItem onClick={() => setReasonDialog({ eventId: event.id, action: "cancel" })} className="text-destructive">
                              <XCircle className="h-3.5 w-3.5 mr-2" /> Cancelar
                            </DropdownMenuItem>
                          )}
                          {event.status === "DRAFT" && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleDelete(event.id)} className="text-destructive">
                                <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Dialog: criar evento */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Novo Evento</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Título *</Label>
              <Input value={form.title} onChange={setField("title")} placeholder="Nome do evento" />
            </div>
            <div>
              <Label>Tipo *</Label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((t) => <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data *</Label>
              <Input type="date" value={form.date} onChange={setField("date")} />
            </div>
            <div>
              <Label>Horário início</Label>
              <Input type="time" value={form.startTime} onChange={setField("startTime")} />
            </div>
            <div>
              <Label>Horário fim</Label>
              <Input type="time" value={form.endTime} onChange={setField("endTime")} />
            </div>
            <div className="col-span-2">
              <Label>Local</Label>
              <Input value={form.location} onChange={setField("location")} placeholder="Ex: Teatro Principal" />
            </div>
            <div className="col-span-2">
              <Label>Notas</Label>
              <Textarea value={form.notes} onChange={setField("notes")} placeholder="Informações adicionais" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>Criar Evento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: editar evento */}
      <Dialog open={!!editEvent} onOpenChange={(o) => { if (!o) { setEditEvent(null); setForm(emptyForm); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Editar Evento</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Título</Label>
              <Input value={form.title} onChange={setField("title")} />
            </div>
            <div>
              <Label>Data</Label>
              <Input type="date" value={form.date} onChange={setField("date")} />
            </div>
            <div>
              <Label>Data fim</Label>
              <Input type="date" value={form.endDate} onChange={setField("endDate")} />
            </div>
            <div>
              <Label>Horário início</Label>
              <Input type="time" value={form.startTime} onChange={setField("startTime")} />
            </div>
            <div>
              <Label>Horário fim</Label>
              <Input type="time" value={form.endTime} onChange={setField("endTime")} />
            </div>
            <div className="col-span-2">
              <Label>Local</Label>
              <Input value={form.location} onChange={setField("location")} />
            </div>
            <div className="col-span-2">
              <Label>Notas</Label>
              <Textarea value={form.notes} onChange={setField("notes")} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditEvent(null); setForm(emptyForm); }}>Cancelar</Button>
            <Button onClick={handleEdit} disabled={updateMutation.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: motivo (suspensão/cancelamento) */}
      <Dialog open={!!reasonDialog} onOpenChange={(o) => { if (!o) { setReasonDialog(null); setReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{reasonDialog?.action === "suspend" ? "Suspender Evento" : "Cancelar Evento"}</DialogTitle>
          </DialogHeader>
          <div>
            <Label>Motivo *</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Descreva o motivo" rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setReasonDialog(null); setReason(""); }}>Cancelar</Button>
            <Button
              variant={reasonDialog?.action === "cancel" ? "destructive" : "default"}
              onClick={handleTransitionWithReason}
              disabled={suspendMutation.isPending || cancelMutation.isPending}
            >
              {reasonDialog?.action === "suspend" ? "Suspender" : "Cancelar Evento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
