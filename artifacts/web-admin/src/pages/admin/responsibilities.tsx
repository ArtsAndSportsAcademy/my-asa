import { useState, useCallback } from "react";
import { Users, UserPlus, Trash2, Plus, Edit2, AlertCircle, X, ChevronDown } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { customFetch } from "@workspace/api-client-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Assignment {
  id: string;
  memberId: string;
  memberName: string;
  role: "PRIMARY" | "SECONDARY" | "VIEWER";
  substituteMemberId: string | null;
  substituteName: string | null;
  active: boolean;
}

interface Responsibility {
  id: string;
  title: string;
  description: string | null;
  category: string;
  operationId: string | null;
  operationName: string | null;
  active: boolean;
  assignments: Assignment[];
}

interface OrgUser { id: string; name: string; role: string; }
interface Operation { id: string; name: string; }

const CATEGORIES = ["OPERAÇÃO", "TREINAMENTO", "MANUTENÇÃO", "COMUNICAÇÃO", "ARTÍSTICO", "EQUIPAMENTOS", "ADMINISTRATIVO"];

const CATEGORY_COLORS: Record<string, string> = {
  "OPERAÇÃO":       "bg-violet-100 text-violet-800",
  "TREINAMENTO":    "bg-blue-100 text-blue-800",
  "MANUTENÇÃO":     "bg-orange-100 text-orange-800",
  "COMUNICAÇÃO":    "bg-green-100 text-green-800",
  "ARTÍSTICO":      "bg-pink-100 text-pink-800",
  "EQUIPAMENTOS":   "bg-yellow-100 text-yellow-800",
  "ADMINISTRATIVO": "bg-gray-100 text-gray-800",
};

// ─── Fetch helpers ────────────────────────────────────────────────────────────

async function fetchResponsibilities(params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  return customFetch<{ responsibilities: Responsibility[] }>(`/api/responsibilities${qs ? `?${qs}` : ""}`);
}

async function fetchUsers() {
  const d = await customFetch<{ users?: OrgUser[] }>("/api/users");
  return d.users ?? [];
}

async function fetchOperations() {
  const d = await customFetch<{ operations?: Operation[] }>("/api/operations");
  return d.operations ?? [];
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ResponsibilitiesContent() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { user, roles } = useAuth();
  const isAdmin = roles.some((ur) => ur.role === "ADMIN");

  const [filterCategory, setFilterCategory] = useState("");
  const [filterUnassigned, setFilterUnassigned] = useState(false);
  const [filterMemberId, setFilterMemberId] = useState("");

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem] = useState<Responsibility | null>(null);
  const [assignItem, setAssignItem] = useState<Responsibility | null>(null);

  // Form state
  const [form, setForm] = useState({ title: "", description: "", category: "OPERAÇÃO", operationId: "" });
  const [assignForm, setAssignForm] = useState({ memberId: "", role: "PRIMARY" as "PRIMARY" | "SECONDARY" | "VIEWER", substituteMemberId: "" });

  const params: Record<string, string> = {};
  if (filterCategory) params.category = filterCategory;
  if (filterUnassigned) params.unassigned = "true";
  if (filterMemberId) params.memberId = filterMemberId;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["responsibilities", params],
    queryFn: () => fetchResponsibilities(params),
  });

  const { data: users = [] } = useQuery({ queryKey: ["users"], queryFn: fetchUsers });
  const { data: operations = [] } = useQuery({ queryKey: ["operations"], queryFn: fetchOperations });

  const responsibilities = data?.responsibilities ?? [];

  // ── Mutations ──

  const createMut = useMutation({
    mutationFn: (body: object) =>
      customFetch("/api/responsibilities", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["responsibilities"] }); setShowCreate(false); setForm({ title: "", description: "", category: "OPERAÇÃO", operationId: "" }); toast({ title: "Responsabilidade criada" }); },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: object }) =>
      customFetch(`/api/responsibilities/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["responsibilities"] }); setEditItem(null); toast({ title: "Responsabilidade atualizada" }); },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) =>
      customFetch(`/api/responsibilities/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["responsibilities"] }); toast({ title: "Responsabilidade removida" }); },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const assignMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: object }) =>
      customFetch(`/api/responsibilities/${id}/assignments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["responsibilities"] }); setAssignForm({ memberId: "", role: "PRIMARY", substituteMemberId: "" }); toast({ title: "Pessoa atribuída" }); refetch(); },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const removeAssignMut = useMutation({
    mutationFn: ({ respId, assignId }: { respId: string; assignId: string }) =>
      customFetch(`/api/responsibilities/${respId}/assignments/${assignId}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["responsibilities"] }); toast({ title: "Atribuição removida" }); },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  // ── Group by category ──

  const grouped = responsibilities.reduce<Record<string, Responsibility[]>>((acc, r) => {
    const k = r.category;
    acc[k] = acc[k] ?? [];
    acc[k].push(r);
    return acc;
  }, {});

  return (
    <>
      <div className="p-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="text-violet-600" size={24} />
              Responsabilidades
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Funções permanentes e recorrentes da operação</p>
          </div>
          {isAdmin && (
            <Button onClick={() => setShowCreate(true)} className="gap-2">
              <Plus size={16} /> Nova Responsabilidade
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6 p-4 bg-muted/40 rounded-lg border">
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Categoria</Label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="h-8 rounded border border-input bg-background px-2 text-sm"
            >
              <option value="">Todas</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Pessoa</Label>
            <select
              value={filterMemberId}
              onChange={(e) => setFilterMemberId(e.target.value)}
              className="h-8 rounded border border-input bg-background px-2 text-sm"
            >
              <option value="">Todos</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <label className="flex items-center gap-2 cursor-pointer text-sm mb-1">
              <input
                type="checkbox"
                checked={filterUnassigned}
                onChange={(e) => setFilterUnassigned(e.target.checked)}
                className="rounded"
              />
              Sem responsável
            </label>
          </div>
          {(filterCategory || filterMemberId || filterUnassigned) && (
            <div className="flex items-end">
              <Button variant="ghost" size="sm" onClick={() => { setFilterCategory(""); setFilterMemberId(""); setFilterUnassigned(false); }}>
                Limpar filtros
              </Button>
            </div>
          )}
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-card rounded-lg border p-3 text-center">
            <div className="text-2xl font-bold text-violet-600">{responsibilities.length}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </div>
          <div className="bg-card rounded-lg border p-3 text-center">
            <div className="text-2xl font-bold text-green-600">{responsibilities.filter((r) => r.assignments.length > 0).length}</div>
            <div className="text-xs text-muted-foreground">Com responsável</div>
          </div>
          <div className="bg-card rounded-lg border p-3 text-center">
            <div className="text-2xl font-bold text-red-500">{responsibilities.filter((r) => r.assignments.length === 0).length}</div>
            <div className="text-xs text-muted-foreground">Sem responsável</div>
          </div>
        </div>

        {isLoading && <div className="text-center py-12 text-muted-foreground">Carregando…</div>}

        {!isLoading && responsibilities.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Users size={40} className="mx-auto mb-3 opacity-20" />
            <p className="font-medium">Nenhuma responsabilidade cadastrada</p>
            {isAdmin && <p className="text-sm mt-1">Clique em "Nova Responsabilidade" para começar.</p>}
          </div>
        )}

        {/* Grouped list */}
        {Object.entries(grouped).map(([cat, items]) => (
          <div key={cat} className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[cat] ?? "bg-gray-100 text-gray-700"}`}>{cat}</span>
              <span className="text-xs text-muted-foreground">{items.length} responsabilidade{items.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="space-y-3">
              {items.map((r) => (
                <ResponsibilityCard
                  key={r.id}
                  r={r}
                  isAdmin={isAdmin}
                  onEdit={() => { setEditItem(r); setForm({ title: r.title, description: r.description ?? "", category: r.category, operationId: r.operationId ?? "" }); }}
                  onDelete={() => { if (confirm(`Remover "${r.title}"?`)) deleteMut.mutate(r.id); }}
                  onAssign={() => setAssignItem(r)}
                  onRemoveAssignment={(assignId) => removeAssignMut.mutate({ respId: r.id, assignId })}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ── Create Modal ── */}
      {(showCreate || editItem) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl border shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{editItem ? "Editar Responsabilidade" : "Nova Responsabilidade"}</h2>
              <Button variant="ghost" size="icon" onClick={() => { setShowCreate(false); setEditItem(null); }}><X size={18} /></Button>
            </div>
            <div className="space-y-3">
              <div>
                <Label>Título *</Label>
                <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Ex: Instagram ASA" />
              </div>
              <div>
                <Label>Descrição</Label>
                <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Descreva a responsabilidade" />
              </div>
              <div>
                <Label>Categoria</Label>
                <select
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  className="w-full h-9 rounded border border-input bg-background px-2 text-sm"
                >
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <Label>Operação</Label>
                <select
                  value={form.operationId}
                  onChange={(e) => setForm((f) => ({ ...f, operationId: e.target.value }))}
                  className="w-full h-9 rounded border border-input bg-background px-2 text-sm"
                >
                  <option value="">Todas as operações</option>
                  {operations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-5 justify-end">
              <Button variant="outline" onClick={() => { setShowCreate(false); setEditItem(null); }}>Cancelar</Button>
              <Button
                onClick={() => {
                  const body = { title: form.title, description: form.description || undefined, category: form.category, operationId: form.operationId || undefined };
                  if (editItem) { updateMut.mutate({ id: editItem.id, body }); }
                  else { createMut.mutate(body); }
                }}
                disabled={!form.title.trim() || createMut.isPending || updateMut.isPending}
              >
                {editItem ? "Salvar" : "Criar"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Assign Modal ── */}
      {assignItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl border shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-semibold">Atribuir Responsável</h2>
              <Button variant="ghost" size="icon" onClick={() => setAssignItem(null)}><X size={18} /></Button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">{assignItem.title}</p>
            <div className="space-y-3">
              <div>
                <Label>Pessoa *</Label>
                <select
                  value={assignForm.memberId}
                  onChange={(e) => setAssignForm((f) => ({ ...f, memberId: e.target.value }))}
                  className="w-full h-9 rounded border border-input bg-background px-2 text-sm"
                >
                  <option value="">Selecionar pessoa</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div>
                <Label>Papel</Label>
                <select
                  value={assignForm.role}
                  onChange={(e) => setAssignForm((f) => ({ ...f, role: e.target.value as "PRIMARY" | "SECONDARY" | "VIEWER" }))}
                  className="w-full h-9 rounded border border-input bg-background px-2 text-sm"
                >
                  <option value="PRIMARY">Principal</option>
                  <option value="SECONDARY">Auxiliar</option>
                  <option value="VIEWER">Somente leitura</option>
                </select>
              </div>
              <div>
                <Label>Substituto (opcional)</Label>
                <select
                  value={assignForm.substituteMemberId}
                  onChange={(e) => setAssignForm((f) => ({ ...f, substituteMemberId: e.target.value }))}
                  className="w-full h-9 rounded border border-input bg-background px-2 text-sm"
                >
                  <option value="">Sem substituto</option>
                  {users.filter((u) => u.id !== assignForm.memberId).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-5 justify-end">
              <Button variant="outline" onClick={() => setAssignItem(null)}>Cancelar</Button>
              <Button
                onClick={() => {
                  assignMut.mutate({ id: assignItem.id, body: { memberId: assignForm.memberId, role: assignForm.role, substituteMemberId: assignForm.substituteMemberId || undefined } });
                }}
                disabled={!assignForm.memberId || assignMut.isPending}
              >
                Atribuir
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function ResponsibilitiesPage() {
  return (
    <AdminLayout title="Responsabilidades">
      <ResponsibilitiesContent />
    </AdminLayout>
  );
}

// ─── Responsibility Card ───────────────────────────────────────────────────────

function ResponsibilityCard({
  r, isAdmin, onEdit, onDelete, onAssign, onRemoveAssignment,
}: {
  r: Responsibility;
  isAdmin: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onAssign: () => void;
  onRemoveAssignment: (assignId: string) => void;
}) {
  const primary = r.assignments.filter((a) => a.active && a.role === "PRIMARY");
  const secondary = r.assignments.filter((a) => a.active && a.role === "SECONDARY");
  const viewers = r.assignments.filter((a) => a.active && a.role === "VIEWER");
  const uncovered = r.assignments.length === 0;

  return (
    <div className={`bg-card border rounded-lg p-4 ${uncovered ? "border-red-200 bg-red-50/30 dark:bg-red-950/10" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{r.title}</span>
            {uncovered && (
              <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
                <AlertCircle size={12} /> Sem responsável
              </span>
            )}
            {r.operationName && (
              <span className="text-xs text-muted-foreground">· {r.operationName}</span>
            )}
          </div>
          {r.description && <p className="text-xs text-muted-foreground mt-0.5">{r.description}</p>}

          {/* Assignments */}
          {r.assignments.filter((a) => a.active).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {primary.map((a) => (
                <div key={a.id} className="flex items-center gap-1 bg-violet-50 border border-violet-200 rounded-full px-2 py-0.5 text-xs dark:bg-violet-950/30">
                  <span className="font-medium text-violet-700 dark:text-violet-400">{a.memberName}</span>
                  <span className="text-violet-500">Principal</span>
                  {a.substituteName && <span className="text-violet-400">· sub: {a.substituteName}</span>}
                  {isAdmin && (
                    <button onClick={() => onRemoveAssignment(a.id)} className="text-red-400 hover:text-red-600 ml-0.5"><X size={10} /></button>
                  )}
                </div>
              ))}
              {secondary.map((a) => (
                <div key={a.id} className="flex items-center gap-1 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5 text-xs dark:bg-blue-950/30">
                  <span className="font-medium text-blue-700 dark:text-blue-400">{a.memberName}</span>
                  <span className="text-blue-500">Auxiliar</span>
                  {isAdmin && (
                    <button onClick={() => onRemoveAssignment(a.id)} className="text-red-400 hover:text-red-600 ml-0.5"><X size={10} /></button>
                  )}
                </div>
              ))}
              {viewers.map((a) => (
                <div key={a.id} className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-full px-2 py-0.5 text-xs dark:bg-slate-950/30">
                  <span className="font-medium text-slate-700 dark:text-slate-300">{a.memberName}</span>
                  <span className="text-slate-500">Somente leitura</span>
                  {isAdmin && (
                    <button onClick={() => onRemoveAssignment(a.id)} className="text-red-400 hover:text-red-600 ml-0.5"><X size={10} /></button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {isAdmin && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onAssign}><UserPlus size={14} /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}><Edit2 size={14} /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700" onClick={onDelete}><Trash2 size={14} /></Button>
          </div>
        )}
      </div>
    </div>
  );
}
