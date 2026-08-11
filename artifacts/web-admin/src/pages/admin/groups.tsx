import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetOperations,
  useGetOperationalGroups,
  getGetOperationalGroupsQueryKey,
  useGetOperationalGroup,
  getGetOperationalGroupQueryKey,
  useCreateOperationalGroup,
  useUpdateOperationalGroup,
  useUpdateOperationalGroupStatus,
  useListUsers,
  useGetEligibleSupervisors,
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
import { MemberCombobox } from "@/components/member-combobox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useLocation } from "wouter";
import { Plus, MoreHorizontal, Pencil, Users, AlertCircle, Trash2, Shield, UserPlus, RefreshCw, Briefcase, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const GROUP_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Ativo",
  INACTIVE: "Inativo",
  ARCHIVED: "Arquivado",
};

const GROUP_STATUS_OPTIONS = ["ACTIVE", "INACTIVE", "ARCHIVED"] as const;

const SCOPE_LABELS: Record<string, string> = {
  OPERATION: "Uma operação",
  MULTI: "Várias operações",
  ALL: "Todas as operações",
};

const SCOPE_OPTIONS = ["OPERATION", "MULTI", "ALL"] as const;

export default function GroupsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: opsData } = useGetOperations();
  const { data: groupsData, isLoading, error } = useGetOperationalGroups();
  const { data: usersData } = useListUsers();
  const { data: eligibleSupervisorsData } = useGetEligibleSupervisors();

  const operations: Operation[] = opsData?.operations ?? [];
  const groups: OperationalGroup[] = groupsData?.groups ?? [];
  const users: User[] = usersData?.users ?? [];
  const eligibleSupervisors = eligibleSupervisorsData?.supervisors ?? [];

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

  const [createForm, setCreateForm] = useState({ name: "", description: "", color: "#6D4AFF", icon: "users", scope: "OPERATION", operationId: "", operationIds: [] as string[], status: "ACTIVE" });
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [addSupervisorUserId, setAddSupervisorUserId] = useState("");

  // Detalhe do grupo aberto (inclui a lista de membros ativos).
  const { data: detailData } = useGetOperationalGroup(membersGroup?.id ?? "", {
    query: {
      enabled: !!membersGroup,
      queryKey: getGetOperationalGroupQueryKey(membersGroup?.id ?? ""),
    },
  });
  const detailGroup = detailData?.group;
  const groupMembers = detailGroup?.members ?? [];
  const memberIds = useMemo(() => new Set(groupMembers.map((m) => m.id)), [groupMembers]);
  const groupSupervisors = detailGroup?.supervisors ?? [];
  const groupSupervisorIds = useMemo(() => new Set(groupSupervisors.map((s) => s.id)), [groupSupervisors]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getGetOperationalGroupsQueryKey() });
  const invalidateDetail = () => {
    if (membersGroup) queryClient.invalidateQueries({ queryKey: getGetOperationalGroupQueryKey(membersGroup.id) });
  };

  // Usuários ativos que ainda não são membros, filtrados pela busca por nome.
  const candidateUsers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    return users
      .filter((u) => u.status === "ACTIVE" && !memberIds.has(u.id))
      .filter((u) => (q ? u.name.toLowerCase().includes(q) : true))
      .slice(0, 30);
  }, [users, memberIds, memberSearch]);

  const getOperationName = (opId: string) => operations.find((o) => o.id === opId)?.name ?? opId.slice(0, 8);

  const handleCreate = () => {
    const { name, description, color, icon, scope, operationId, operationIds, status } = createForm;
    if (!name.trim()) {
      toast({ title: "Nome é obrigatório", variant: "destructive" });
      return;
    }
    if (scope === "OPERATION" && !operationId) {
      toast({ title: "Selecione a operação do grupo", variant: "destructive" });
      return;
    }
    if (scope === "MULTI" && operationIds.length < 1) {
      toast({ title: "Selecione ao menos uma operação", variant: "destructive" });
      return;
    }
    const data: Record<string, unknown> = { name: name.trim(), description: description.trim() || null, color, icon, scope, status };
    if (scope === "OPERATION") data.operationId = operationId;
    if (scope === "MULTI") data.operationIds = operationIds;
    createMutation.mutate(
      { data: data as never },
      {
        onSuccess: () => {
          toast({ title: "Equipe criada com sucesso" });
          setCreateOpen(false);
          setCreateForm({ name: "", description: "", color: "#6D4AFF", icon: "users", scope: "OPERATION", operationId: "", operationIds: [], status: "ACTIVE" });
          invalidate();
        },
        onError: (err: any) => toast({ title: err?.response?.data?.message ?? "Erro ao criar grupo", variant: "destructive" }),
      }
    );
  };

  const describeCoverage = (group: OperationalGroup): string => {
    if (group.scope === "ALL") return "Todas as operações";
    const ids = group.operationIds ?? (group.operationId ? [group.operationId] : []);
    if (ids.length === 0) return "—";
    const names = ids.map((id) => getOperationName(id));
    if (names.length <= 2) return names.join(", ");
    return `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
  };

  const handleEdit = () => {
    if (!editGroup || !editName.trim()) return;
    updateMutation.mutate(
      { id: editGroup.id, data: { name: editName.trim(), description: editDescription.trim() || null } },
      {
        onSuccess: () => { toast({ title: "Equipe atualizada" }); setEditGroup(null); invalidate(); },
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

  const handleAddMember = (userId: string) => {
    if (!membersGroup || !userId) return;
    addMemberMutation.mutate(
      { id: membersGroup.id, data: { userId } },
      {
        onSuccess: () => { toast({ title: "Membro adicionado" }); setMemberSearch(""); invalidateDetail(); },
        onError: (err: any) => toast({ title: err?.response?.data?.message ?? "Erro ao adicionar membro", variant: "destructive" }),
      }
    );
  };

  const handleRemoveMember = (userId: string) => {
    if (!membersGroup) return;
    removeMemberMutation.mutate(
      { id: membersGroup.id, userId },
      {
        onSuccess: () => { toast({ title: "Membro removido" }); invalidateDetail(); },
        onError: (err: any) => toast({ title: err?.response?.data?.message ?? "Erro ao remover membro", variant: "destructive" }),
      }
    );
  };

  const handleAddSupervisor = () => {
    if (!membersGroup || !addSupervisorUserId) return;
    addSupervisorMutation.mutate(
      { id: membersGroup.id, data: { userId: addSupervisorUserId } },
      {
        onSuccess: () => { toast({ title: "Supervisor adicionado" }); setAddSupervisorUserId(""); invalidateDetail(); invalidate(); },
        onError: (err: any) => toast({ title: err?.response?.data?.message ?? "Erro ao adicionar supervisor", variant: "destructive" }),
      }
    );
  };

  const handleRemoveSupervisor = (userId: string) => {
    if (!membersGroup) return;
    removeSupervisorMutation.mutate(
      { id: membersGroup.id, userId },
      {
        onSuccess: () => { toast({ title: "Supervisor removido" }); invalidateDetail(); invalidate(); },
        onError: (err: any) => toast({ title: err?.response?.data?.message ?? "Erro ao remover supervisor", variant: "destructive" }),
      }
    );
  };

  return (
    <AdminLayout title="Equipes da ASA" subtitle="Patinação, Bailarinos, Produção, Gestão e as novas equipes que a ASA criar">
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">{groups.length} equipe(s) cadastrada(s)</p>
          <Button onClick={() => setCreateOpen(true)} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Nova Equipe
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
                <TableHead>Abrangência</TableHead>
                <TableHead>Operações</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(3)].map((_, i) => (
                  <TableRow key={i}>
                    {[...Array(5)].map((_, j) => (
                      <TableCell key={j}><div className="h-4 bg-muted animate-pulse rounded w-32" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : groups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                    Nenhuma equipe criada ainda. Comece por Patinação, Bailarinos, Produção ou Gestão.
                  </TableCell>
                </TableRow>
              ) : (
                groups.map((group) => (
                  <TableRow key={group.id}>
                    <TableCell className="font-medium">{group.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{SCOPE_LABELS[group.scope] ?? group.scope}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{describeCoverage(group)}</TableCell>
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
                          <DropdownMenuItem onClick={() => { setEditGroup(group); setEditName(group.name); setEditDescription(group.description ?? ""); }}>
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
          <DialogHeader><DialogTitle>Nova Equipe</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome da equipe</Label>
              <Input
                placeholder="Ex: Bailarinos"
                value={createForm.name}
                onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input
                placeholder="Ex: Equipe artística de dança da ASA"
                value={createForm.description}
                onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Abrangência</Label>
              <Select value={createForm.scope} onValueChange={(v) => setCreateForm((f) => ({ ...f, scope: v, operationId: "", operationIds: [] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SCOPE_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>{SCOPE_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {createForm.scope === "OPERATION" && "A equipe atua em uma operação."}
                {createForm.scope === "MULTI" && "A equipe atua nas operações escolhidas."}
                {createForm.scope === "ALL" && "A equipe é da ASA e pode atuar em todas as operações."}
              </p>
            </div>

            {createForm.scope === "OPERATION" && (
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
            )}

            {createForm.scope === "MULTI" && (
              <div className="space-y-2">
                <Label>Operações cobertas</Label>
                <div className="max-h-48 overflow-y-auto rounded-md border divide-y">
                  {operations.length === 0 ? (
                    <p className="p-3 text-sm text-muted-foreground">Nenhuma operação disponível.</p>
                  ) : (
                    operations.map((op) => {
                      const checked = createForm.operationIds.includes(op.id);
                      return (
                        <label key={op.id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-muted/50">
                          <input
                            type="checkbox"
                            className="h-4 w-4"
                            checked={checked}
                            onChange={(e) =>
                              setCreateForm((f) => ({
                                ...f,
                                operationIds: e.target.checked
                                  ? [...f.operationIds, op.id]
                                  : f.operationIds.filter((id) => id !== op.id),
                              }))
                            }
                          />
                          {op.name}
                        </label>
                      );
                    })
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{createForm.operationIds.length} operação(ões) selecionada(s)</p>
              </div>
            )}
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
              {createMutation.isPending ? "Criando..." : "Criar equipe"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editGroup} onOpenChange={(o) => !o && setEditGroup(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Equipe</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
            </div>
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
                <MemberCombobox
                  value={addSupervisorUserId}
                  onChange={setAddSupervisorUserId}
                  users={eligibleSupervisors.filter((s) => !groupSupervisorIds.has(s.id))}
                  placeholder="Selecionar supervisor"
                  className="flex-1"
                />
                <Button
                  size="sm"
                  onClick={handleAddSupervisor}
                  disabled={!addSupervisorUserId || addSupervisorMutation.isPending}
                >
                  <UserPlus className="w-4 h-4" />
                </Button>
              </div>
              {groupSupervisors.length === 0 ? (
                <p className="text-sm text-muted-foreground border rounded-md px-3 py-3 text-center">
                  Nenhum supervisor neste grupo ainda.
                </p>
              ) : (
                <div className="border rounded-md divide-y">
                  {groupSupervisors.map((s) => (
                    <div key={s.id} className="flex items-center justify-between px-3 py-2">
                      <span className="text-sm flex items-center gap-2">
                        <Shield className="w-3.5 h-3.5 text-primary" />
                        {s.name}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleRemoveSupervisor(s.id)}
                        disabled={removeSupervisorMutation.isPending}
                        aria-label={`Remover supervisor ${s.name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-primary" />
                Adicionar Membro
              </p>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Buscar pessoa pelo nome..."
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                />
              </div>
              {memberSearch.trim() && (
                <div className="border rounded-md divide-y max-h-56 overflow-y-auto">
                  {candidateUsers.length === 0 ? (
                    <p className="text-sm text-muted-foreground px-3 py-3">Ninguém encontrado.</p>
                  ) : (
                    candidateUsers.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-muted/50 disabled:opacity-50"
                        onClick={() => handleAddMember(u.id)}
                        disabled={addMemberMutation.isPending}
                      >
                        <span>{u.name}</span>
                        <UserPlus className="w-4 h-4 text-primary" />
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                Pessoas da equipe ({groupMembers.length})
              </p>
              {groupMembers.length === 0 ? (
                <p className="text-sm text-muted-foreground border rounded-md px-3 py-4 text-center">
                  Nenhum membro ainda. Use a busca acima para adicionar pessoas.
                </p>
              ) : (
                <div className="border rounded-md divide-y">
                  {groupMembers.map((m) => (
                    <div key={m.id} className="flex items-center justify-between px-3 py-2">
                      <span className="flex items-center gap-2 text-sm">
                        {m.name}
                        {m.isPrimary && <Badge variant="secondary">Equipe principal</Badge>}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleRemoveMember(m.id)}
                        disabled={removeMemberMutation.isPending}
                        aria-label={`Remover ${m.name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="text-xs text-muted-foreground border-t pt-4">
              A primeira equipe de uma pessoa vira a principal. Mudanças ficam preservadas no histórico.
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </AdminLayout>
  );
}
