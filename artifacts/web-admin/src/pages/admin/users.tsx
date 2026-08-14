import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListUsers,
  getListUsersQueryKey,
  useCreateUser,
  useUpdateUser,
  useUpdateUserStatus,
  useDeleteUser,
  useAddUserRole,
  useListUserRoles,
  useRemoveUserRole,
  getListUserRolesQueryKey,
  useGetOperations,
} from "@workspace/api-client-react";
import type { User, UserRole } from "@workspace/api-client-react";
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
  CONVIDADO:          "Convidado",
  PROFESSOR:          "Professor",
  TRAINER:            "Treinador",
  PHYSIOTHERAPIST:    "Fisioterapeuta",
  STRENGTH_COACH:     "Preparador Físico",
  TECHNICAL_OPERATOR: "Técnico Operacional",
  OTHER:              "Outro",
};

const ALL_SPECIALIZATIONS = [
  "PERFORMER",
  "CONVIDADO",
  "PROFESSOR",
  "TRAINER",
  "PHYSIOTHERAPIST",
  "STRENGTH_COACH",
  "TECHNICAL_OPERATOR",
  "OTHER",
] as const;

const ROLE_OPTIONS = [
  { value: "MEMBER",       label: "Elenco" },
  { value: "TRAINER",      label: "Treinador" },
  { value: "SUPERVISOR_A", label: "Supervisor" },
  { value: "ADMIN",        label: "Gerência" },
] as const;

const roleLabel = (role: string): string => {
  switch (role) {
    case "ADMIN":        return "Gerência";
    case "SUPERVISOR_A": return "Supervisor";
    case "SUPERVISOR_B": return "Supervisor (legado)";
    case "TRAINER":      return "Treinador";
    case "MEMBER":       return "Elenco";
    default:             return role;
  }
};

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
  const assignRoleMutation = useAddUserRole();
  const removeRoleMutation = useRemoveUserRole();

  const { data: opsData } = useGetOperations();
  const operations = opsData?.operations ?? [];

  const [filterSpec, setFilterSpec] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [createdUser, setCreatedUser] = useState<User | null>(null);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

  const [createForm, setCreateForm] = useState({
    name: "", preferredName: "", phone: "", password: "", createAccess: true,
    role: "MEMBER", operationId: "", specialization: "", professionalProfile: "MEMBER",
    primaryFunction: "", birthDate: "", entryDate: "", visitUntil: "",
  });
  const [editForm, setEditForm] = useState({
    name: "", preferredName: "", email: "", phone: "", username: "", specialization: "",
    professionalProfile: "", primaryFunction: "", personStatus: "ACTIVE",
    birthDate: "", entryDate: "", visitUntil: "",
  });
  const [addRoleOpId, setAddRoleOpId] = useState("");
  const [addRoleRole, setAddRoleRole] = useState("MEMBER");

  const editRolesQuery = useListUserRoles(editUser?.id ?? "", {
    query: { enabled: !!editUser?.id, queryKey: getListUserRolesQueryKey(editUser?.id ?? "") },
  });
  const editUserRoles: UserRole[] = (editRolesQuery.data?.roles ?? []).filter((r) => r.active);

  const opName = (operationId: string | null | undefined) =>
    operations.find((o: any) => o.id === operationId)?.name ?? "Operação";

  const invalidateRoles = () => {
    if (editUser) {
      queryClient.invalidateQueries({ queryKey: getListUserRolesQueryKey(editUser.id) });
    }
  };

  const handleAddRole = () => {
    if (!editUser) return;
    const operationId = addRoleOpId || operations[0]?.id;
    if (!operationId) {
      toast({ title: "Cadastre uma operação primeiro", variant: "destructive" });
      return;
    }
    assignRoleMutation.mutate(
      { id: editUser.id, data: { operationId, role: addRoleRole as any } },
      {
        onSuccess: () => {
          toast({ title: "Operação adicionada à pessoa" });
          setAddRoleOpId("");
          setAddRoleRole("MEMBER");
          invalidateRoles();
          invalidate();
        },
        onError: (err: any) => {
          const msg = err?.response?.data?.message ?? "Erro ao adicionar operação";
          toast({ title: msg, variant: "destructive" });
        },
      }
    );
  };

  const handleRemoveRole = (roleId: string) => {
    if (!editUser) return;
    removeRoleMutation.mutate(
      { id: editUser.id, roleId },
      {
        onSuccess: () => {
          toast({ title: "Operação removida da pessoa" });
          invalidateRoles();
          invalidate();
        },
        onError: (err: any) => {
          const msg = err?.response?.data?.message ?? "Erro ao remover operação";
          toast({ title: msg, variant: "destructive" });
        },
      }
    );
  };

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });

  const filteredUsers = users.filter((u) => {
    if (filterSpec && u.specialization !== filterSpec) return false;
    return true;
  });

  const resetCreateForm = () =>
    setCreateForm({ name: "", preferredName: "", phone: "", password: "", createAccess: true, role: "MEMBER", operationId: "", specialization: "", professionalProfile: "MEMBER", primaryFunction: "", birthDate: "", entryDate: "", visitUntil: "" });

  const handleCreate = () => {
    const { name, password, role, operationId, specialization } = createForm;
    if (!name.trim() || (createForm.createAccess && password.length < 6)) {
      toast({ title: "Preencha nome e senha provisória", variant: "destructive" });
      return;
    }
    const effectiveOperationId = operationId || operations[0]?.id;
    createMutation.mutate(
      {
        data: {
          name: name.trim(),
          preferredName: createForm.preferredName.trim() || null,
          phone: createForm.phone.trim() || null,
          password: createForm.createAccess ? password : null,
          professionalProfile: createForm.professionalProfile || null,
          primaryFunction: createForm.primaryFunction.trim() || null,
          specialization: (specialization || undefined) as any,
          ...(createForm.birthDate ? { birthDate: createForm.birthDate as any } : {}),
          ...(createForm.entryDate ? { entryDate: createForm.entryDate as any } : {}),
          ...(createForm.visitUntil ? { visitUntil: createForm.visitUntil as any } : {}),
        },
      },
      {
        onSuccess: (res) => {
          const newUser = res?.user as User | undefined;
          if (!newUser) {
            toast({ title: "Usuário criado, mas não foi possível definir o papel", variant: "destructive" });
            setCreateOpen(false);
            resetCreateForm();
            invalidate();
            return;
          }
          if (!effectiveOperationId) {
            toast({ title: createForm.createAccess ? "Pessoa e acesso criados" : "Pessoa cadastrada sem acesso" });
            setCreateOpen(false);
            resetCreateForm();
            setCreatedUser(newUser);
            invalidate();
            return;
          }
          assignRoleMutation.mutate(
            { id: newUser.id, data: { operationId: effectiveOperationId, role: role as any } },
            {
              onSuccess: () => {
                toast({ title: "Usuário criado com sucesso" });
                setCreateOpen(false);
                resetCreateForm();
                setCreatedUser(newUser);
                invalidate();
              },
              onError: (err: any) => {
                const msg = err?.response?.data?.message ?? "Usuário criado, mas falhou ao definir o papel";
                toast({ title: msg, variant: "destructive" });
                setCreateOpen(false);
                resetCreateForm();
                setCreatedUser(newUser);
                invalidate();
              },
            }
          );
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
    const { name, preferredName, email, phone, username, specialization, professionalProfile, primaryFunction, personStatus, birthDate, entryDate, visitUntil } = editForm;
    updateMutation.mutate(
      {
        id: editUser.id,
        data: {
          name: name.trim() || undefined,
          preferredName: preferredName.trim() || null,
          email: email.trim() || undefined,
          phone: phone.trim() || null,
          username: username.trim() || undefined,
          professionalProfile: professionalProfile || null,
          primaryFunction: primaryFunction.trim() || null,
          personStatus: personStatus as any,
          specialization: (specialization || null) as any,
          ...(birthDate !== undefined ? { birthDate: (birthDate || null) as any } : {}),
          ...(entryDate !== undefined ? { entryDate: (entryDate || null) as any } : {}),
          visitUntil: (visitUntil || null) as any,
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
      preferredName: user.preferredName ?? "",
      email: user.email ?? "",
      phone: user.phone ?? "",
      username: user.username ?? "",
      specialization: user.specialization ?? "",
      professionalProfile: user.professionalProfile ?? "",
      primaryFunction: user.primaryFunction ?? "",
      personStatus: user.personStatus ?? "ACTIVE",
      birthDate: (user as any).birthDate ?? "",
      entryDate: user.entryDate ?? "",
      visitUntil: (user as any).visitUntil ?? "",
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
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge
                            variant="outline"
                            className={user.specialization === "CONVIDADO" ? "border-amber-400 text-amber-700 bg-amber-50 dark:bg-amber-950 dark:text-amber-300" : ""}
                          >
                            {SPECIALIZATION_LABELS[user.specialization] ?? user.specialization}
                          </Badge>
                          {user.specialization === "CONVIDADO" && (user as any).visitUntil && (
                            <span className="text-xs text-muted-foreground">
                              até {new Date((user as any).visitUntil + "T12:00:00").toLocaleDateString("pt-BR")}
                            </span>
                          )}
                        </div>
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
              <div className="grid gap-3 sm:grid-cols-2 mb-4">
                <div className="space-y-2"><Label>Nome preferido</Label><Input value={createForm.preferredName} onChange={(e) => setCreateForm((f) => ({ ...f, preferredName: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Telefone</Label><Input value={createForm.phone} onChange={(e) => setCreateForm((f) => ({ ...f, phone: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Perfil na ASA</Label><select className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={createForm.professionalProfile} onChange={(e) => setCreateForm((f) => ({ ...f, professionalProfile: e.target.value }))}><option value="DIRECTION">Direção</option><option value="MANAGEMENT">Gestão</option><option value="SUPERVISOR">Supervisor</option><option value="MEMBER">Elenco</option><option value="TRAINER_TEACHER">Treinador ou professor</option><option value="GUEST">Convidado</option></select></div>
                <div className="space-y-2"><Label>Função principal</Label><Input placeholder="Ex.: Patinadora" value={createForm.primaryFunction} onChange={(e) => setCreateForm((f) => ({ ...f, primaryFunction: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Data de entrada</Label><Input type="date" value={createForm.entryDate} onChange={(e) => setCreateForm((f) => ({ ...f, entryDate: e.target.value }))} /></div>
              </div>
              <label className="mb-4 flex items-start gap-3 rounded-lg border p-3 text-sm"><input type="checkbox" className="mt-0.5" checked={createForm.createAccess} onChange={(e) => setCreateForm((f) => ({ ...f, createAccess: e.target.checked, password: e.target.checked ? f.password : "" }))} /><span><strong>Criar acesso agora</strong><span className="mt-0.5 block text-xs text-muted-foreground">Desmarque para cadastrar somente a pessoa. O acesso poderá ser ativado depois.</span></span></label>
              <Label>Papel técnico inicial</Label>
              <select
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                value={createForm.role}
                onChange={(e) => setCreateForm((f) => ({ ...f, role: e.target.value }))}
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            {operations.length > 1 && (
              <div className="space-y-2">
                <Label>Operação</Label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  value={createForm.operationId || operations[0]?.id || ""}
                  onChange={(e) => setCreateForm((f) => ({ ...f, operationId: e.target.value }))}
                >
                  {operations.map((op: any) => (
                    <option key={op.id} value={op.id}>{op.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Senha provisória</Label>
              <Input
                type="password"
                disabled={!createForm.createAccess}
                placeholder="Mínimo 6 caracteres"
                value={createForm.password}
                onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                A pessoa será obrigada a criar uma senha própria no primeiro acesso.
              </p>
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
            {createForm.specialization === "CONVIDADO" && (
              <div className="space-y-2">
                <Label>Convidado até <span className="text-muted-foreground text-xs">(data prevista de saída)</span></Label>
                <Input
                  type="date"
                  value={createForm.visitUntil}
                  onChange={(e) => setCreateForm((f) => ({ ...f, visitUntil: e.target.value }))}
                />
                <p className="text-xs text-amber-600">
                  Após esta data o convidado será automaticamente marcado como Inativo.
                </p>
              </div>
            )}
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
              <div className="grid gap-3 sm:grid-cols-2 mb-4">
                <div className="space-y-2"><Label>Nome preferido</Label><Input value={editForm.preferredName} onChange={(e) => setEditForm((f) => ({ ...f, preferredName: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Telefone</Label><Input value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Perfil na ASA</Label><select className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={editForm.professionalProfile} onChange={(e) => setEditForm((f) => ({ ...f, professionalProfile: e.target.value }))}><option value="">Não informado</option><option value="DIRECTION">Direção</option><option value="MANAGEMENT">Gestão</option><option value="SUPERVISOR">Supervisor</option><option value="MEMBER">Elenco</option><option value="TRAINER_TEACHER">Treinador ou professor</option><option value="GUEST">Convidado</option></select></div>
                <div className="space-y-2"><Label>Função principal</Label><Input value={editForm.primaryFunction} onChange={(e) => setEditForm((f) => ({ ...f, primaryFunction: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Situação da pessoa</Label><select className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={editForm.personStatus} onChange={(e) => setEditForm((f) => ({ ...f, personStatus: e.target.value }))}><option value="ACTIVE">Ativa</option><option value="ON_LEAVE">Afastada</option><option value="LEFT">Desligada</option><option value="ARCHIVED">Arquivada</option></select></div>
                <div className="space-y-2"><Label>Data de entrada</Label><Input type="date" value={editForm.entryDate} onChange={(e) => setEditForm((f) => ({ ...f, entryDate: e.target.value }))} /></div>
              </div>
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
            {editForm.specialization === "CONVIDADO" && (
              <div className="space-y-2">
                <Label>Convidado até <span className="text-muted-foreground text-xs">(data prevista de saída)</span></Label>
                <Input
                  type="date"
                  value={editForm.visitUntil}
                  onChange={(e) => setEditForm((f) => ({ ...f, visitUntil: e.target.value }))}
                />
                <p className="text-xs text-amber-600">
                  Após esta data o convidado será automaticamente marcado como Inativo.
                </p>
              </div>
            )}

            <div className="space-y-2 border-t pt-4">
              <Label>Operações <span className="text-muted-foreground text-xs">(uma pessoa pode pertencer a várias)</span></Label>
              {editRolesQuery.isLoading ? (
                <p className="text-xs text-muted-foreground">A carregar...</p>
              ) : editUserRoles.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sem operações atribuídas.</p>
              ) : (
                <div className="space-y-2">
                  {editUserRoles.map((r) => (
                    <div key={r.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{opName(r.operationId)}</p>
                        <p className="text-xs text-muted-foreground">{roleLabel(r.role)}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        disabled={removeRoleMutation.isPending}
                        onClick={() => handleRemoveRole(r.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-end gap-2 pt-1">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs text-muted-foreground">Operação</Label>
                  <select
                    className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    value={addRoleOpId || operations[0]?.id || ""}
                    onChange={(e) => setAddRoleOpId(e.target.value)}
                  >
                    {operations.map((op: any) => (
                      <option key={op.id} value={op.id}>{op.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1 space-y-1">
                  <Label className="text-xs text-muted-foreground">Papel</Label>
                  <select
                    className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    value={addRoleRole}
                    onChange={(e) => setAddRoleRole(e.target.value)}
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={assignRoleMutation.isPending || operations.length === 0}
                  onClick={handleAddRole}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Adicionar
                </Button>
              </div>
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
