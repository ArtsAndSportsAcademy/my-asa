import { useMemo, useState } from "react";
import AdminLayout from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetActivities,
  useCreateActivity,
  useUpdateActivity,
  useDeleteActivity,
  getGetActivitiesQueryKey,
  useGetOperations,
  useListUsers,
  useGetOperationalGroups,
} from "@workspace/api-client-react";
import type { Activity } from "@workspace/api-client-react";
import { Plus, Pencil, Trash2, Users2, User, Clock, Loader2 } from "lucide-react";
import { AsaConfirmDialog } from "@/components/AsaConfirmDialog";

const WEEKDAYS = [
  { value: 1, label: "Segunda" },
  { value: 2, label: "Terça" },
  { value: 3, label: "Quarta" },
  { value: 4, label: "Quinta" },
  { value: 5, label: "Sexta" },
  { value: 6, label: "Sábado" },
  { value: 0, label: "Domingo" },
];

function weekdayLabel(w: number | null | undefined): string {
  return WEEKDAYS.find((d) => d.value === w)?.label ?? "";
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

type FormState = {
  id?: string;
  title: string;
  mode: "weekly" | "single";
  weekday: number;
  specificDate: string;
  startTime: string;
  endTime: string;
  active: boolean;
  userIds: Set<string>;
  groupIds: Set<string>;
};

function emptyForm(): FormState {
  return {
    title: "",
    mode: "weekly",
    weekday: 1,
    specificDate: "",
    startTime: "",
    endTime: "",
    active: true,
    userIds: new Set(),
    groupIds: new Set(),
  };
}

export default function ActivitiesPage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: opsData } = useGetOperations();
  const operations = opsData?.operations ?? [];
  const [operationId, setOperationId] = useState<string>("");

  const effectiveOpId = operationId || operations[0]?.id || "";

  const { data: activitiesData, isLoading } = useGetActivities(
    { operationId: effectiveOpId },
    { query: { enabled: !!effectiveOpId, queryKey: getGetActivitiesQueryKey({ operationId: effectiveOpId }) } },
  );
  const activities = useMemo<Activity[]>(
    () => (activitiesData?.activities ?? []) as Activity[],
    [activitiesData],
  );

  const { data: usersData } = useListUsers();
  const users = useMemo(
    () =>
      (usersData?.users ?? []).filter(
        (u) => !u.isAdmin && (u.operationIds ?? []).includes(effectiveOpId),
      ),
    [usersData, effectiveOpId],
  );
  const { data: groupsData } = useGetOperationalGroups();
  const groups = useMemo(
    () =>
      (groupsData?.groups ?? []).filter(
        (g) => g.scope === "ALL" || (g.operationIds ?? []).includes(effectiveOpId),
      ),
    [groupsData, effectiveOpId],
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [userSearch, setUserSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Activity | null>(null);

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: getGetActivitiesQueryKey({ operationId: effectiveOpId }) });

  const { mutate: createActivity, isPending: isCreating } = useCreateActivity({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast({ title: "Atividade criada" });
        setDialogOpen(false);
      },
      onError: () => toast({ title: "Erro ao criar atividade", variant: "destructive" }),
    },
  });
  const { mutate: updateActivity, isPending: isUpdating } = useUpdateActivity({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast({ title: "Atividade atualizada" });
        setDialogOpen(false);
      },
      onError: () => toast({ title: "Erro ao atualizar atividade", variant: "destructive" }),
    },
  });
  const { mutate: deleteActivity } = useDeleteActivity({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast({ title: "Atividade removida" });
        setDeleteTarget(null);
      },
      onError: () => toast({ title: "Erro ao remover atividade", variant: "destructive" }),
    },
  });

  function openCreate() {
    setForm(emptyForm());
    setUserSearch("");
    setDialogOpen(true);
  }

  function openEdit(a: Activity) {
    setForm({
      id: a.id,
      title: a.title,
      mode: a.weekday != null ? "weekly" : "single",
      weekday: a.weekday ?? 1,
      specificDate: a.specificDate ?? "",
      startTime: a.startTime ?? "",
      endTime: a.endTime ?? "",
      active: a.active,
      userIds: new Set(a.assignees.filter((x) => x.userId).map((x) => x.userId as string)),
      groupIds: new Set(a.assignees.filter((x) => x.groupId).map((x) => x.groupId as string)),
    });
    setUserSearch("");
    setDialogOpen(true);
  }

  function toggleSet(set: Set<string>, id: string): Set<string> {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  }

  function handleSubmit() {
    if (!form.title.trim()) {
      toast({ title: "Informe um título", variant: "destructive" });
      return;
    }
    if (form.mode === "single" && !form.specificDate) {
      toast({ title: "Escolha a data da atividade avulsa", variant: "destructive" });
      return;
    }
    if (form.userIds.size === 0 && form.groupIds.size === 0) {
      toast({ title: "Escolha pelo menos uma pessoa ou grupo", variant: "destructive" });
      return;
    }
    const assignees = [
      ...[...form.userIds].map((userId) => ({ userId })),
      ...[...form.groupIds].map((groupId) => ({ groupId })),
    ];
    const base = {
      title: form.title.trim(),
      weekday: form.mode === "weekly" ? form.weekday : null,
      specificDate: form.mode === "single" ? form.specificDate : null,
      startTime: form.startTime || null,
      endTime: form.endTime || null,
      active: form.active,
      assignees,
    };
    if (form.id) {
      updateActivity({ id: form.id, data: base });
    } else {
      createActivity({ data: { operationId: effectiveOpId, ...base } });
    }
  }

  const filteredUsers = users.filter((u) =>
    (u.name ?? "").toLowerCase().includes(userSearch.toLowerCase()),
  );

  return (
    <AdminLayout
      title="Atividades"
      subtitle="Atividades recorrentes (toda semana) ou avulsas que entram sozinhas na Escala para as pessoas e grupos escolhidos."
    >
      <div className="space-y-6">
        <div className="flex items-center justify-end gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Select value={effectiveOpId} onValueChange={setOperationId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Operação" />
              </SelectTrigger>
              <SelectContent>
                {operations.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={openCreate} disabled={!effectiveOpId}>
              <Plus className="h-4 w-4 mr-1" /> Nova atividade
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> A carregar…
          </div>
        ) : activities.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Nenhuma atividade ainda. Crie a primeira para que ela apareça automaticamente
              na Escala.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {activities.map((a) => (
              <Card key={a.id} className={a.active ? "" : "opacity-60"}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold leading-tight">{a.title}</h3>
                      <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                        {a.weekday != null ? (
                          <Badge variant="secondary">Toda {weekdayLabel(a.weekday)}</Badge>
                        ) : (
                          <Badge variant="outline">{a.specificDate ? fmtDate(a.specificDate) : "Avulsa"}</Badge>
                        )}
                        {(a.startTime || a.endTime) && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {a.startTime ?? "?"}
                            {a.endTime ? `–${a.endTime}` : ""}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(a)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(a)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {a.assignees.length === 0 && (
                      <span className="text-xs text-muted-foreground">Sem pessoas</span>
                    )}
                    {a.assignees.map((x) => (
                      <Badge key={x.id} variant="outline" className="font-normal gap-1">
                        {x.groupId ? <Users2 className="h-3 w-3" /> : <User className="h-3 w-3" />}
                        {x.groupName ?? x.userName ?? "—"}
                      </Badge>
                    ))}
                  </div>
                  {!a.active && <Badge variant="secondary">Pausada</Badge>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar atividade" : "Nova atividade"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Título</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Ex.: Aquecimento vocal"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Quando acontece</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={form.mode === "weekly" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setForm((f) => ({ ...f, mode: "weekly" }))}
                >
                  Toda semana
                </Button>
                <Button
                  type="button"
                  variant={form.mode === "single" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setForm((f) => ({ ...f, mode: "single" }))}
                >
                  Data específica
                </Button>
              </div>
            </div>

            {form.mode === "weekly" ? (
              <div className="space-y-1.5">
                <Label>Dia da semana</Label>
                <Select
                  value={String(form.weekday)}
                  onValueChange={(v) => setForm((f) => ({ ...f, weekday: Number(v) }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WEEKDAYS.map((d) => (
                      <SelectItem key={d.value} value={String(d.value)}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Data</Label>
                <Input
                  type="date"
                  value={form.specificDate}
                  onChange={(e) => setForm((f) => ({ ...f, specificDate: e.target.value }))}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Início</Label>
                <Input
                  type="time"
                  value={form.startTime}
                  onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Fim</Label>
                <Input
                  type="time"
                  value={form.endTime}
                  onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                />
              </div>
            </div>

            {groups.length > 0 && (
              <div className="space-y-1.5">
                <Label>Grupos</Label>
                <div className="flex flex-wrap gap-1.5">
                  {groups.map((g) => {
                    const on = form.groupIds.has(g.id);
                    return (
                      <Badge
                        key={g.id}
                        variant={on ? "default" : "outline"}
                        className="cursor-pointer gap-1"
                        onClick={() => setForm((f) => ({ ...f, groupIds: toggleSet(f.groupIds, g.id) }))}
                      >
                        <Users2 className="h-3 w-3" />
                        {g.name}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Pessoas</Label>
              <Input
                placeholder="Procurar pessoa…"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
              />
              <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto rounded-md border p-2">
                {filteredUsers.length === 0 && (
                  <span className="text-xs text-muted-foreground">Nenhuma pessoa encontrada</span>
                )}
                {filteredUsers.map((u) => {
                  const on = form.userIds.has(u.id);
                  return (
                    <Badge
                      key={u.id}
                      variant={on ? "default" : "outline"}
                      className="cursor-pointer gap-1"
                      onClick={() => setForm((f) => ({ ...f, userIds: toggleSet(f.userIds, u.id) }))}
                    >
                      <User className="h-3 w-3" />
                      {u.name}
                    </Badge>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label>Ativa</Label>
                <p className="text-xs text-muted-foreground">
                  Quando pausada, não aparece na Escala.
                </p>
              </div>
              <Switch
                checked={form.active}
                onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={isCreating || isUpdating}>
              {(isCreating || isUpdating) && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {form.id ? "Guardar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AsaConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Remover atividade?"
        description={`A atividade "${deleteTarget?.title ?? ""}" deixará de aparecer na Escala.`}
        confirmLabel="Remover"
        onConfirm={() => deleteTarget && deleteActivity({ id: deleteTarget.id })}
      />
    </AdminLayout>
  );
}
