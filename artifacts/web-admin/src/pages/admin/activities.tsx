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
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
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
import type { Activity, ActivityScheduleInput } from "@workspace/api-client-react";
import { Plus, Pencil, Trash2, Users2, User, Clock, Loader2, X, CalendarDays } from "lucide-react";
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

// ── Schedule row in the form ───────────────────────────────────────────────────

type ScheduleRow = {
  _key: string; // React list key, not sent to API
  mode: "weekly" | "single";
  weekday: number;
  specificDate: string;
  startTime: string;
  endTime: string;
};

let _keySeq = 0;
function newKey() {
  return String(++_keySeq);
}

function emptySchedule(mode: "weekly" | "single" = "weekly"): ScheduleRow {
  return { _key: newKey(), mode, weekday: 1, specificDate: "", startTime: "", endTime: "" };
}

function scheduleToApi(s: ScheduleRow): ActivityScheduleInput {
  return {
    weekday: s.mode === "weekly" ? s.weekday : null,
    specificDate: s.mode === "single" ? s.specificDate || null : null,
    startTime: s.startTime || null,
    endTime: s.endTime || null,
  };
}

function scheduleLabel(s: ScheduleRow | ActivityScheduleInput & { id?: string }): string {
  const isWeekly = "mode" in s ? s.mode === "weekly" : s.weekday != null;
  const wd = "weekday" in s ? s.weekday : null;
  const sd = "specificDate" in s ? s.specificDate : null;
  const st = "startTime" in s ? s.startTime : null;
  const et = "endTime" in s ? s.endTime : null;
  const dayPart = isWeekly ? weekdayLabel(wd as number) : sd ? fmtDate(sd) : "?";
  const timePart = st ? `${st}${et ? `–${et}` : ""}` : "";
  return timePart ? `${dayPart} ${timePart}` : dayPart;
}

// ── Form state ─────────────────────────────────────────────────────────────────

type FormState = {
  id?: string;
  title: string;
  schedules: ScheduleRow[];
  active: boolean;
  userIds: Set<string>;
  groupIds: Set<string>;
};

function emptyForm(): FormState {
  return {
    title: "",
    schedules: [emptySchedule()],
    active: true,
    userIds: new Set(),
    groupIds: new Set(),
  };
}

// ── ScheduleEditor sub-component ───────────────────────────────────────────────

function ScheduleEditor({
  schedules,
  onChange,
}: {
  schedules: ScheduleRow[];
  onChange: (s: ScheduleRow[]) => void;
}) {
  // Multi-day shortcut: user can tick multiple weekdays at once and pick one time
  const [multiMode, setMultiMode] = useState(false);
  const [multiDays, setMultiDays] = useState<Set<number>>(new Set());
  const [multiStart, setMultiStart] = useState("");
  const [multiEnd, setMultiEnd] = useState("");

  function addMultiDays() {
    if (multiDays.size === 0) return;
    const newRows: ScheduleRow[] = [...multiDays].map((wd) => ({
      _key: newKey(),
      mode: "weekly" as const,
      weekday: wd,
      specificDate: "",
      startTime: multiStart,
      endTime: multiEnd,
    }));
    // avoid exact duplicates (same weekday+time already in list)
    const existing = new Set(
      schedules
        .filter((s) => s.mode === "weekly")
        .map((s) => `${s.weekday}:${s.startTime}:${s.endTime}`),
    );
    const toAdd = newRows.filter(
      (r) => !existing.has(`${r.weekday}:${r.startTime}:${r.endTime}`),
    );
    if (toAdd.length > 0) onChange([...schedules, ...toAdd]);
    setMultiMode(false);
    setMultiDays(new Set());
    setMultiStart("");
    setMultiEnd("");
  }

  function update(key: string, patch: Partial<ScheduleRow>) {
    onChange(schedules.map((s) => (s._key === key ? { ...s, ...patch } : s)));
  }

  function remove(key: string) {
    if (schedules.length <= 1) return; // keep at least one
    onChange(schedules.filter((s) => s._key !== key));
  }

  return (
    <div className="space-y-3">
      {schedules.map((s, idx) => (
        <div key={s._key} className="rounded-md border p-3 space-y-2 bg-muted/30">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">Horário {idx + 1}</span>
            <div className="flex items-center gap-2">
              <div className="flex rounded-md overflow-hidden border text-xs">
                <button
                  type="button"
                  className={`px-2 py-1 ${s.mode === "weekly" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
                  onClick={() => update(s._key, { mode: "weekly" })}
                >
                  Semanal
                </button>
                <button
                  type="button"
                  className={`px-2 py-1 ${s.mode === "single" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
                  onClick={() => update(s._key, { mode: "single" })}
                >
                  Data única
                </button>
              </div>
              {schedules.length > 1 && (
                <button
                  type="button"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => remove(s._key)}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-center">
            {s.mode === "weekly" ? (
              <Select
                value={String(s.weekday)}
                onValueChange={(v) => update(s._key, { weekday: Number(v) })}
              >
                <SelectTrigger className="h-8 text-sm">
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
            ) : (
              <Input
                type="date"
                className="h-8 text-sm"
                value={s.specificDate}
                onChange={(e) => update(s._key, { specificDate: e.target.value })}
              />
            )}
            <Input
              type="time"
              className="h-8 w-24 text-sm"
              value={s.startTime}
              onChange={(e) => update(s._key, { startTime: e.target.value })}
              placeholder="Início"
            />
            <Input
              type="time"
              className="h-8 w-24 text-sm"
              value={s.endTime}
              onChange={(e) => update(s._key, { endTime: e.target.value })}
              placeholder="Fim"
            />
          </div>
        </div>
      ))}

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...schedules, emptySchedule("weekly")])}
        >
          <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar horário
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setMultiMode((v) => !v)}
        >
          <CalendarDays className="h-3.5 w-3.5 mr-1" /> Vários dias
        </Button>
      </div>

      {/* Multi-day shortcut */}
      {multiMode && (
        <div className="rounded-md border p-3 space-y-3 bg-muted/20">
          <p className="text-xs font-medium text-muted-foreground">
            Marque os dias e opcionalmente o horário — serão adicionados de uma vez.
          </p>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((d) => (
              <label key={d.value} className="flex items-center gap-1.5 cursor-pointer">
                <Checkbox
                  checked={multiDays.has(d.value)}
                  onCheckedChange={(chk) => {
                    const next = new Set(multiDays);
                    if (chk) next.add(d.value);
                    else next.delete(d.value);
                    setMultiDays(next);
                  }}
                />
                <span className="text-sm">{d.label}</span>
              </label>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="time"
              className="h-8 w-28 text-sm"
              value={multiStart}
              onChange={(e) => setMultiStart(e.target.value)}
              placeholder="Início"
            />
            <span className="text-muted-foreground text-sm">–</span>
            <Input
              type="time"
              className="h-8 w-28 text-sm"
              value={multiEnd}
              onChange={(e) => setMultiEnd(e.target.value)}
              placeholder="Fim"
            />
          </div>
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={addMultiDays} disabled={multiDays.size === 0}>
              Adicionar {multiDays.size > 0 ? `${multiDays.size} dia${multiDays.size > 1 ? "s" : ""}` : "dias"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setMultiMode(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

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
    const schedules: ScheduleRow[] =
      a.schedules.length > 0
        ? a.schedules.map((s) => ({
            _key: newKey(),
            mode: s.weekday != null ? "weekly" : "single",
            weekday: s.weekday ?? 1,
            specificDate: s.specificDate ?? "",
            startTime: s.startTime ?? "",
            endTime: s.endTime ?? "",
          }))
        : [emptySchedule()];
    setForm({
      id: a.id,
      title: a.title,
      schedules,
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
    for (const s of form.schedules) {
      if (s.mode === "single" && !s.specificDate) {
        toast({ title: "Escolha a data em todos os horários", variant: "destructive" });
        return;
      }
    }
    if (form.schedules.length === 0) {
      toast({ title: "Adicione pelo menos um horário", variant: "destructive" });
      return;
    }

    const assignees = [
      ...[...form.userIds].map((userId) => ({ userId })),
      ...[...form.groupIds].map((groupId) => ({ groupId })),
    ];
    const schedules = form.schedules.map(scheduleToApi);

    if (form.id) {
      updateActivity({ id: form.id, data: { title: form.title.trim(), schedules, active: form.active, assignees } });
    } else {
      createActivity({ data: { operationId: effectiveOpId, title: form.title.trim(), schedules, active: form.active, assignees } });
    }
  }

  const filteredUsers = users.filter((u) =>
    (u.name ?? "").toLowerCase().includes(userSearch.toLowerCase()),
  );

  return (
    <AdminLayout
      title="Atividades"
      subtitle="Atividades recorrentes ou avulsas que entram sozinhas na Escala. Cada atividade pode ter múltiplos dias e horários."
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
                    <h3 className="font-semibold leading-tight">{a.title}</h3>
                    <div className="flex items-center gap-1 shrink-0">
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

                  {/* Schedules */}
                  <div className="flex flex-wrap gap-1.5">
                    {a.schedules.length === 0 ? (
                      <span className="text-xs text-muted-foreground">Sem horário definido</span>
                    ) : (
                      a.schedules.map((s) => (
                        <Badge key={s.id} variant="secondary" className="gap-1 font-normal text-xs">
                          <Clock className="h-3 w-3" />
                          {s.weekday != null
                            ? weekdayLabel(s.weekday)
                            : s.specificDate
                              ? fmtDate(s.specificDate)
                              : "?"}
                          {s.startTime && ` ${s.startTime}${s.endTime ? `–${s.endTime}` : ""}`}
                        </Badge>
                      ))
                    )}
                  </div>

                  {/* Assignees */}
                  <Separator />
                  <div className="flex flex-wrap gap-1">
                    {a.assignees.length === 0 && (
                      <span className="text-xs text-muted-foreground">Sem pessoas</span>
                    )}
                    {a.assignees.map((x) => (
                      <Badge key={x.id} variant="outline" className="font-normal gap-1 text-xs">
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
          <div className="space-y-5">
            {/* Title */}
            <div className="space-y-1.5">
              <Label>Título</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Ex.: Aquecimento vocal"
              />
            </div>

            {/* Schedules */}
            <div className="space-y-2">
              <Label>Dias e horários</Label>
              <ScheduleEditor
                schedules={form.schedules}
                onChange={(schedules) => setForm((f) => ({ ...f, schedules }))}
              />
            </div>

            {/* Groups */}
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

            {/* People */}
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

            {/* Active toggle */}
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
