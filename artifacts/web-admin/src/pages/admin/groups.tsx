import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetOperations,
  useGetOperationalGroups,
  getGetOperationalGroupsQueryKey,
  useCreateOperationalGroup,
  useUpdateOperationalGroup,
  useUpdateOperationalGroupStatus,
  useListUsers,
  useAddGroupMember,
  useRemoveGroupMember,
  useAddGroupSupervisor,
  useRemoveGroupSupervisor,
} from "@workspace/api-client-react";
import type { Operation, OperationalGroup, User } from "@workspace/api-client-react";
import AdminLayout from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useLocation } from "wouter";
import { Plus, MoreHorizontal, Pencil, Users, AlertCircle, Trash2, Shield, UserPlus, RefreshCw, Briefcase } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const GROUP_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Ativo",
  INACTIVE: "Inativo",
  ARCHIVED: "Arquivado",
};

const GROUP_STATUS_OPTIONS = ["ACTIVE", "INACTIVE", "ARCHIVED"] as const;

export default function GroupsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: opsData } = useGetOperations();
  const { data: groupsData, isLoading, error } = useGetOperationalGroups();
  const { data: usersData } = useListUsers();

  const operations: Operation[] = opsData?.operations ?? [];
  const groups: OperationalGroup[] = groupsData?.groups ?? [];
  const users: User[] = usersData?.users ?? [];

  const createMutation = useCreateOperationalGroup();
  const updateMutation = useUpdateOperationalGroup();
  const updateStatusMutation = useUpdateOperationalGroupStatus();
  const addMemberMutation = useAddGroupMember();
  const removeMemberMutation = useRemoveGroupMember();
  const addSupervisorMutation = useAddGroupSupervisor();
  const removeSupervisorMutation = useRemoveGroupSupervisor();

  const [createOpen, setCreateOpen] = useState(false);
  const [editGroup, setEditGroup] = useState<OperationalGroup | null>(null);
  const [statusGroup, setStatusGroup] = useState<OperationalGroup | null>(null);
  const [membersGroup, setMembersGroup] = useState<OperationalGroup | null>(null);

  const [createForm, setCreateForm] = useState({ name: "", operationId: "", status: "ACTIVE" });
  const [editName, setEditName] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [addMemberUserId, setAddMemberUserId] = useState("");
  const [addSupervisorUserId, setAddSupervisorUserId] = useState("");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getGetOperationalGroupsQueryKey() });

  const getOperationName = (opId: string) => operations.find((o) => o.id === opId)?.name ?? opId.slice(0, 8);

  const handleCreate = () => {
    const { name, operationId, status } = createForm;
    if (!name.trim() || !operationId) {
      toast({ title: "Nome e operação são obrigatórios", variant: "destructive" });
      return;
    }
    createMutation.mutate(
      { data: { name: name.trim(), operationId, status: status as never } },
      {
        onSuccess: () => {
          toast({ title: "Grupo criado com sucesso" });
          setCreateOpen(false);
          setCreateForm({ name: "", operationId: "", status: "ACTIVE" });
          invalidate();
        },
        onError: (err: any) => toast({ title: err?.response?.data?.message ?? "Erro ao criar grupo", variant: "destructive" }),
      }
    );
  };

  const handleEdit = () => {
    if (!editGroup || !editName.trim()) return;
    updateMutation.mutate(
      { id: editGroup.id, data: { name: editName.trim() } },
      {
        onSuccess: () => { toast({ title: "Grupo atualizado" }); setEditGroup(null); invalidate(); },
        onError: () => toast({ title: "Erro ao atualizar grupo", variant: "destructive" }),
      }
    );
  };

  const handleStatusChange = () => {
    if (!statusGroup || !newStatus) return;
    updateStatusMutation.mutate(
      { id: statusGroup.id, data: { status: newStatus as never } },
      {
        onSuccess: () => { toast({ title: "Status atualizado" }); setStatusGroup(null); invalidate(); },
        onError: (err: any) => toast({ title: err?.response?.data?.message ?? "Erro ao atualizar status", variant: "destructive" }),
      }
    );
  };

  const handleAddMember = () => {
    if (!membersGroup || !addMemberUserId) return;
    addMemberMutation.mutate(
      { id: membersGroup.id, data: { userId: addMemberUserId } },
      {
        onSuccess: () => { toast({ title: "Membro adicionado" }); setAddMemberUserId(""); invalidate(); },
        onError: (err: any) => toast({ title: err?.response?.data?.message ?? "Erro ao adicionar membro", variant: "destructive" }),
      }
    );
  };

  const handleAddSupervisor = () => {
    if (!membersGroup || !addSupervisorUserId) return;
    addSupervisorMutation.mutate(
      { id: membersGroup.id, data: { userId: addSupervisorUserId } },
      {
        onSuccess: () => { toast({ title: "Supervisor adicionado" }); setAddSupervisorUserId(""); invalidate(); },
        onError: (err: any) => toast({ title: err?.response?.data?.message ?? "Erro ao adicionar supervisor", variant: "destructive" }),
      }
    );
  };

  return (
    <AdminLayout title="Grupos Operacionais" subtitle="Organize equipes dentro das operações">
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">{groups.length} grupo(s) encontrado(s)</p>
          <Button onClick={() => setCreateOpen(true)} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Novo Grupo
          </Button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-4 border border-destructive/30 bg-destructive/10 rounded-lg text-sm text-destructive">
            <AlertCircle className="w-4 h-4" />
            Erro ao carregar grupos
          </div>
        )}

        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Operação</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(3)].map((_, i) => (
                  <TableRow key={i}>
                    {[...Array(4)].map((_, j) => (
                      <TableCell key={j}><div className="h-4 bg-muted animate-pulse rounded w-32" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : groups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                    Nenhum grupo criado ainda. Crie o primeiro grupo para organizar sua equipe na operação.
                  </TableCell>
                </TableRow>
              ) : (
                groups.map((group) => (
                  <TableRow key={group.id}>
                    <TableCell className="font-medium">{group.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{getOperationName(group.operationId)}</TableCell>
                    <TableCell>
                      <Badge variant={group.status === "ACTIVE" ? "default" : group.status === "ARCHIVED" ? "destructive" : "secondary"}>
                        {GROUP_STATUS_LABELS[group.status] ?? group.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setEditGroup(group); setEditName(group.name); }}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Editar nome
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setStatusGroup(group); setNewStatus(group.status); }}>
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Mudar status
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setMembersGroup(group)}>
                            <Users className="w-4 h-4 mr-2" />
                            Gerenciar equipe
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setLocation("/admin/operations")}>
                            <Briefcase className="w-4 h-4 mr-2" />
                            Ver Operação
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Grupo Operacional</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome do grupo</Label>
              <Input
                placeholder="Ex: Equipe de Palco"
                value={createForm.name}
                onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Operação</Label>
              <Select value={createForm.operationId} onValueChange={(v) => setCreateForm((f) => ({ ...f, operationId: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione uma operação" /></SelectTrigger>
                <SelectContent>
                  {operations.map((op) => (
                    <SelectItem key={op.id} value={op.id}>{op.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status inicial</Label>
              <Select value={createForm.status} onValueChange={(v) => setCreateForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GROUP_STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>{GROUP_STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Criando..." : "Criar grupo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editGroup} onOpenChange={(o) => !o && setEditGroup(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Grupo</DialogTitle></DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Nome</Label>
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditGroup(null)}>Cancelar</Button>
            <Button onClick={handleEdit} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!statusGroup} onOpenChange={(o) => !o && setStatusGroup(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mudar Status — {statusGroup?.name}</DialogTitle></DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Novo status</Label>
            <Select value={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {GROUP_STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>{GROUP_STATUS_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusGroup(null)}>Cancelar</Button>
            <Button onClick={handleStatusChange} disabled={updateStatusMutation.isPending}>
              {updateStatusMutation.isPending ? "Salvando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={!!membersGroup} onOpenChange={(o) => !o && setMembersGroup(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Equipe — {membersGroup?.name}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-8">
            <div className="space-y-3">
              <p className="text-sm font-semibold flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                Adicionar Supervisor
              </p>
              <div className="flex gap-2">
                <Select value={addSupervisorUserId} onValueChange={setAddSupervisorUserId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Selecionar usuário" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.filter((u) => u.status === "ACTIVE").map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  onClick={handleAddSupervisor}
                  disabled={!addSupervisorUserId || addSupervisorMutation.isPending}
                >
                  <UserPlus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                Adicionar Membro
              </p>
              <div className="flex gap-2">
                <Select value={addMemberUserId} onValueChange={setAddMemberUserId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Selecionar usuário" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.filter((u) => u.status === "ACTIVE").map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  onClick={handleAddMember}
                  disabled={!addMemberUserId || addMemberMutation.isPending}
                >
                  <UserPlus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="text-xs text-muted-foreground border-t pt-4">
              Use os dropdowns acima para adicionar membros e supervisores a este grupo. Para remover, use a tela de papéis do usuário.
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </AdminLayout>
  );
}
