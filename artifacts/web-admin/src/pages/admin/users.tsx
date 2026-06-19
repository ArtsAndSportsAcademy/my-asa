import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListUsers,
  getListUsersQueryKey,
  useCreateUser,
  useUpdateUser,
  useUpdateUserStatus,
} from "@workspace/api-client-react";
import type { User } from "@workspace/api-client-react";
import AdminLayout from "@/components/admin-layout";
import { AsaEmptyState } from "@/components/AsaEmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, MoreHorizontal, Pencil, UserCheck, UserX, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

const SPECIALIZATION_LABELS: Record<string, string> = {
  PERFORMER:          "Performer",
  PROFESSOR:          "Professor",
  TRAINER:            "Treinador",
  PHYSIOTHERAPIST:    "Fisioterapeuta",
  STRENGTH_COACH:     "Preparador Físico",
  TECHNICAL_OPERATOR: "Técnico Operacional",
  OTHER:              "Outro",
};

const ALL_SPECIALIZATIONS = [
  "PERFORMER",
  "PROFESSOR",
  "TRAINER",
  "PHYSIOTHERAPIST",
  "STRENGTH_COACH",
  "TECHNICAL_OPERATOR",
  "OTHER",
] as const;

export default function UsersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const auth = useAuth();

  const isAdmin = auth.roles.some((r) => r.role === "ADMIN");

  const { data, isLoading, error } = useListUsers();
  const users: User[] = data?.users ?? [];

  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();
  const statusMutation = useUpdateUserStatus();

  const [filterSpec, setFilterSpec] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);

  const [createForm, setCreateForm] = useState({ name: "", email: "", password: "", specialization: "" });
  const [editForm, setEditForm] = useState({ name: "", email: "", specialization: "" });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });

  const filteredUsers = users.filter((u) => {
    if (filterSpec && u.specialization !== filterSpec) return false;
    return true;
  });

  const handleCreate = () => {
    const { name, email, password, specialization } = createForm;
    if (!name.trim() || !email.trim() || !password) {
      toast({ title: "Preencha todos os campos obrigatórios", variant: "destructive" });
      return;
    }
    createMutation.mutate(
      {
        data: {
          name: name.trim(),
          email: email.trim(),
          password,
          specialization: (specialization || undefined) as any,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Usuário criado com sucesso" });
          setCreateOpen(false);
          setCreateForm({ name: "", email: "", password: "", specialization: "" });
          invalidate();
        },
        onError: (err: any) => {
          const msg = err?.response?.data?.message ?? "Erro ao criar usuário";
          toast({ title: msg, variant: "destructive" });
        },
      }
    );
  };

  const handleEdit = () => {
    if (!editUser) return;
    const { name, email, specialization } = editForm;
    if (!name.trim() && !email.trim() && specialization === (editUser.specialization ?? "")) return;
    updateMutation.mutate(
      {
        id: editUser.id,
        data: {
          name: name.trim() || undefined,
          email: email.trim() || undefined,
          specialization: (specialization || null) as any,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Usuário atualizado" });
          setEditUser(null);
          invalidate();
        },
        onError: (err: any) => {
          const msg = err?.response?.data?.message ?? "Erro ao atualizar";
          toast({ title: msg, variant: "destructive" });
        },
      }
    );
  };

  const handleToggleStatus = (user: User) => {
    const newStatus = user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    statusMutation.mutate(
      { id: user.id, data: { status: newStatus as never } },
      {
        onSuccess: () => {
          toast({ title: `Usuário ${newStatus === "ACTIVE" ? "ativado" : "desativado"}` });
          invalidate();
        },
        onError: (err: any) => {
          const msg = err?.response?.data?.message ?? "Erro ao alterar status";
          toast({ title: msg, variant: "destructive" });
        },
      }
    );
  };

  const openEdit = (user: User) => {
    setEditUser(user);
    setEditForm({
      name: user.name,
      email: user.email,
      specialization: user.specialization ?? "",
    });
  };

  return (
    <AdminLayout title="Usuários" subtitle="Gerencie os membros e administradores da organização">
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="flex gap-2">
            <select
              className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              value={filterSpec}
              onChange={(e) => setFilterSpec(e.target.value)}
            >
              <option value="">Todas as especializações</option>
              {ALL_SPECIALIZATIONS.map((s) => (
                <option key={s} value={s}>{SPECIALIZATION_LABELS[s]}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-sm text-muted-foreground">{filteredUsers.length} usuário(s)</p>
            {isAdmin && (
              <Button onClick={() => setCreateOpen(true)} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Novo Usuário
              </Button>
            )}
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-4 border border-destructive/30 bg-destructive/10 rounded-lg text-sm text-destructive">
            <AlertCircle className="w-4 h-4" />
            Erro ao carregar usuários
          </div>
        )}

        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Especialização</TableHead>
                <TableHead>Status</TableHead>
                {isAdmin && <TableHead className="w-[80px]">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(4)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><div className="h-4 bg-muted animate-pulse rounded w-36" /></TableCell>
                    <TableCell><div className="h-4 bg-muted animate-pulse rounded w-48" /></TableCell>
                    <TableCell><div className="h-4 bg-muted animate-pulse rounded w-24" /></TableCell>
                    <TableCell><div className="h-4 bg-muted animate-pulse rounded w-16" /></TableCell>
                    {isAdmin && <TableCell />}
                  </TableRow>
                ))
              ) : filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 5 : 4} className="py-0">
                    <AsaEmptyState
                      title={users.length === 0 ? "Nenhum membro cadastrado ainda! 👋" : "Nenhum membro corresponde ao filtro"}
                      subtitle={users.length === 0
                        ? "Adicione os primeiros membros para começar a organizar sua equipe na ASA. Vamos lá!"
                        : "Tente ajustar os filtros — seus membros estão por aqui, prometo! 😉"}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => (
                  <TableRow key={user.id} className={user.status === "INACTIVE" ? "opacity-60" : ""}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell className="text-muted-foreground">{user.email}</TableCell>
                    <TableCell>
                      {user.specialization ? (
                        <Badge variant="outline">
                          {SPECIALIZATION_LABELS[user.specialization] ?? user.specialization}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.status === "ACTIVE" ? "default" : "secondary"}>
                        {user.status === "ACTIVE" ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(user)}>
                              <Pencil className="w-4 h-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleToggleStatus(user)}
                              className={user.status === "ACTIVE" ? "text-destructive" : "text-green-600"}
                            >
                              {user.status === "ACTIVE" ? (
                                <><UserX className="w-4 h-4 mr-2" />Desativar</>
                              ) : (
                                <><UserCheck className="w-4 h-4 mr-2" />Ativar</>
                              )}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome completo</Label>
              <Input
                placeholder="Ana Paula Silva"
                value={createForm.name}
                onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input
                type="email"
                placeholder="ana@minhaasa.com.br"
                value={createForm.email}
                onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Senha provisória</Label>
              <Input
                type="password"
                placeholder="Mínimo 8 caracteres"
                value={createForm.password}
                onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Especialização <span className="text-muted-foreground text-xs">(opcional)</span></Label>
              <select
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                value={createForm.specialization}
                onChange={(e) => setCreateForm((f) => ({ ...f, specialization: e.target.value }))}
              >
                <option value="">Sem especialização</option>
                {ALL_SPECIALIZATIONS.map((s) => (
                  <option key={s} value={s}>{SPECIALIZATION_LABELS[s]}</option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Criando..." : "Criar usuário"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editUser} onOpenChange={(o) => !o && setEditUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome completo</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Especialização <span className="text-muted-foreground text-xs">(opcional)</span></Label>
              <select
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                value={editForm.specialization}
                onChange={(e) => setEditForm((f) => ({ ...f, specialization: e.target.value }))}
              >
                <option value="">Sem especialização</option>
                {ALL_SPECIALIZATIONS.map((s) => (
                  <option key={s} value={s}>{SPECIALIZATION_LABELS[s]}</option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>Cancelar</Button>
            <Button onClick={handleEdit} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
