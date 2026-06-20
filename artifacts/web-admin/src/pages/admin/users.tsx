import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListUsers,
  getListUsersQueryKey,
  useCreateUser,
  useUpdateUser,
  useUpdateUserStatus,
  useDeleteUser,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, MoreHorizontal, Pencil, UserCheck, UserX, AlertCircle, Trash2 } from "lucide-react";
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
  const deleteMutation = useDeleteUser();

  const [filterSpec, setFilterSpec] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [createdUser, setCreatedUser] = useState<User | null>(null);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

  const [createForm, setCreateForm] = useState({ name: "", email: "", password: "", specialization: "", birthDate: "" });
  const [editForm, setEditForm] = useState({ name: "", email: "", username: "", specialization: "", birthDate: "" });

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
          ...(createForm.birthDate ? { birthDate: createForm.birthDate as any } : {}),
        },
      },
      {
        onSuccess: (res) => {
          toast({ title: "Usuário criado com sucesso" });
          setCreateOpen(false);
          setCreateForm({ name: "", email: "", password: "", specialization: "", birthDate: "" });
          if (res?.user) setCreatedUser(res.user as User);
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
    const { name, email, username, specialization, birthDate } = editForm;
    updateMutation.mutate(
      {
        id: editUser.id,
        data: {
          name: name.trim() || undefined,
          email: email.trim() || undefined,
          username: username.trim() || undefined,
          specialization: (specialization || null) as any,
          ...(birthDate !== undefined ? { birthDate: (birthDate || null) as any } : {}),
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

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => {
        toast({ title: "Usuário excluído" });
        setDeleteTarget(null);
        invalidate();
      },
      onError: (err: any) => {
        const msg = err?.data?.message ?? err?.response?.data?.message ?? "Erro ao excluir usuário";
        toast({ title: msg, variant: "destructive" });
      },
    });
  };

  const openEdit = (user: User) => {
    setEditUser(user);
    setEditForm({
      name: user.name,
      email: user.email,
      username: user.username ?? "",
      specialization: user.specialization ?? "",
      birthDate: (user as any).birthDate ?? "",
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
                <TableHead>Nome de usuário</TableHead>
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
                    <TableCell><div className="h-4 bg-muted animate-pulse rounded w-32" /></TableCell>
                    <TableCell><div className="h-4 bg-muted animate-pulse rounded w-48" /></TableCell>
                    <TableCell><div className="h-4 bg-muted animate-pulse rounded w-24" /></TableCell>
                    <TableCell><div className="h-4 bg-muted animate-pulse rounded w-16" /></TableCell>
                    {isAdmin && <TableCell />}
                  </TableRow>
                ))
              ) : filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 6 : 5} className="py-0">
                    <AsaEmptyState
                      title={users.length === 0 ? "Nenhum membro cadastrado ainda! 👋" : "Nenhum membro corresponde ao filtro"}
                      subtitle={users.length === 0
                        ? "Adicione os primeiros membros para começar a organizar sua equipe na ASA. Vamos lá!"
                        : "Tente ajustar os filtros — seus membros estão por aqui, prometo! 😉"}
                      pose="duvida"
                    />
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => (
                  <TableRow key={user.id} className={user.status === "INACTIVE" ? "opacity-60" : ""}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>
                      {user.username ? (
                        <code className="text-sm font-mono text-muted-foreground">{user.username}</code>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
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
                            {user.id !== auth.user?.id && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => setDeleteTarget(user)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Excluir
                                </DropdownMenuItem>
                              </>
                            )}
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
            <div className="space-y-2">
              <Label>Data de nascimento <span className="text-muted-foreground text-xs">(opcional — para alertas de aniversário)</span></Label>
              <Input
                type="date"
                value={createForm.birthDate}
                onChange={(e) => setCreateForm((f) => ({ ...f, birthDate: e.target.value }))}
              />
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

      <Dialog open={!!createdUser} onOpenChange={(o) => !o && setCreatedUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Usuário criado</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              O nome de usuário foi gerado automaticamente. Use-o para informar o login a{" "}
              <strong className="text-foreground">{createdUser?.name}</strong>.
            </p>
            <div className="space-y-2">
              <Label>Nome de usuário (login)</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-md border bg-muted px-3 py-2 text-sm font-mono">
                  {createdUser?.username ?? "—"}
                </code>
                {createdUser?.username && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard?.writeText(createdUser.username ?? "");
                      toast({ title: "Nome de usuário copiado" });
                    }}
                  >
                    Copiar
                  </Button>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setCreatedUser(null)}>Fechar</Button>
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
              <Label>Nome de usuário <span className="text-muted-foreground text-xs">(login)</span></Label>
              <Input
                placeholder="nome.sobrenome"
                autoCapitalize="none"
                autoComplete="off"
                value={editForm.username}
                onChange={(e) => setEditForm((f) => ({ ...f, username: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Apenas letras, números e pontos. Acentos e espaços são convertidos automaticamente.
              </p>
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
            <div className="space-y-2">
              <Label>Data de nascimento <span className="text-muted-foreground text-xs">(opcional — para alertas de aniversário)</span></Label>
              <Input
                type="date"
                value={editForm.birthDate}
                onChange={(e) => setEditForm((f) => ({ ...f, birthDate: e.target.value }))}
              />
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
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && (
                <>
                  Esta ação remove <strong>{deleteTarget.name}</strong> ({deleteTarget.email}) da lista
                  permanentemente e não pode ser desfeita. Se o usuário já tiver dados vinculados
                  (tarefas, escalas, registros), use <strong>Desativar</strong> em vez de excluir.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
