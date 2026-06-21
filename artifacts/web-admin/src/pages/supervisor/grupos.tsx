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
  useAddGroupMember,
  useRemoveGroupMember,
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, MoreHorizontal, Users, AlertCircle, UserPlus, RefreshCw, Pencil, Trash2, Search, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const GROUP_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Ativo",
  INACTIVE: "Inativo",
  ARCHIVED: "Arquivado",
};

const GROUP_STATUS_OPTIONS = ["ACTIVE", "INACTIVE", "ARCHIVED"] as const;

export default function SupervisorGruposPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  const [createOpen, setCreateOpen] = useState(false);
  const [statusGroup, setStatusGroup] = useState<OperationalGroup | null>(null);
  const [editGroup, setEditGroup] = useState<OperationalGroup | null>(null);
  const [membersGroup, setMembersGroup] = useState<OperationalGroup | null>(null);

  const [createForm, setCreateForm] = useState({ name: "", operationId: "", status: "ACTIVE" });
  const [newStatus, setNewStatus] = useState("");
  const [editName, setEditName] = useState("");
  const [memberSearch, setMemberSearch] = useState("");

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

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getGetOperationalGroupsQueryKey() });
  const invalidateDetail = () => {
    if (membersGroup) queryClient.invalidateQueries({ queryKey: getGetOperationalGroupQueryKey(membersGroup.id) });
  };

  const getOperationName = (opId: string) => operations.find((o) => o.id === opId)?.name ?? opId.slice(0, 8);

  // Supervisor só gere grupos da própria operação (scope OPERATION).
  const ownGroups = groups.filter((g) => g.scope === "OPERATION");

  const describeCoverage = (group: OperationalGroup): string => {
    if (group.scope === "ALL") return "Todas as operações";
    const ids = group.operationIds ?? (group.operationId ? [group.operationId] : []);
    if (ids.length === 0) return "—";
    return ids.map((id) => getOperationName(id)).join(", ");
  };

  // Usuários ativos que ainda não são membros, filtrados pela busca por nome.
  const candidateUsers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    return users
      .filter((u) => u.status === "ACTIVE" && !memberIds.has(u.id))
      .filter((u) => (q ? u.name.toLowerCase().includes(q) : true))
      .slice(0, 30);
  }, [users, memberIds, memberSearch]);

  const handleCreate = () => {
    const { name, operationId, status } = createForm;
    if (!name.trim() || !operationId) {
      toast({ title: "Nome e operação são obrigatórios", variant: "destructive" });
      return;
    }
    createMutation.mutate(
      { data: { name: name.trim(), scope: "OPERATION", operationId, status: status as never } },
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

  const handleEditName = () => {
    if (!editGroup || !editName.trim()) return;
    updateMutation.mutate(
      { id: editGroup.id, data: { name: editName.trim() } },
      {
        onSuccess: () => { toast({ title: "Nome atualizado" }); setEditGroup(null); invalidate(); },
        onError: (err: any) => toast({ title: err?.response?.data?.message ?? "Erro ao renomear grupo", variant: "destructive" }),
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

  return (
    <AdminLayout title="Grupos da Operação" subtitle="Crie e organize grupos dentro da sua operação">
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">{ownGroups.length} grupo(s) na sua operação</p>
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
              ) : ownGroups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                    Nenhum grupo criado ainda. Crie o primeiro grupo para organizar sua equipe.
                  </TableCell>
                </TableRow>
              ) : (
                ownGroups.map((group) => (
                  <TableRow key={group.id}>
                    <TableCell className="font-medium">{group.name}</TableCell>
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
                          <DropdownMenuItem onClick={() => { setEditGroup(group); setEditName(group.name); }}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Renomear
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setStatusGroup(group); setNewStatus(group.status); }}>
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Mudar status
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setMembersGroup(group); setMemberSearch(""); }}>
                            <Users className="w-4 h-4 mr-2" />
                            Gerenciar membros
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
          <DialogHeader><DialogTitle>Novo Grupo da Operação</DialogTitle></DialogHeader>
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
          <DialogHeader><DialogTitle>Renomear Grupo</DialogTitle></DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Nome do grupo</Label>
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleEditName()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditGroup(null)}>Cancelar</Button>
            <Button onClick={handleEditName} disabled={!editName.trim() || updateMutation.isPending}>
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
            <SheetTitle>Membros — {membersGroup?.name}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-6">
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
                Membros do grupo ({groupMembers.length})
              </p>
              {groupMembers.length === 0 ? (
                <p className="text-sm text-muted-foreground border rounded-md px-3 py-4 text-center">
                  Nenhum membro ainda. Use a busca acima para adicionar pessoas.
                </p>
              ) : (
                <div className="border rounded-md divide-y">
                  {groupMembers.map((m) => (
                    <div key={m.id} className="flex items-center justify-between px-3 py-2">
                      <span className="text-sm">{m.name}</span>
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
              Adicione ou remova membros da sua operação neste grupo. A gestão de supervisores do grupo é feita pelo administrador.
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </AdminLayout>
  );
}
