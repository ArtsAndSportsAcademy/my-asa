import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetOperations,
  getGetOperationsQueryKey,
  useCreateOperation,
  useUpdateOperation,
  useUpdateOperationStatus,
} from "@workspace/api-client-react";
import type { Operation } from "@workspace/api-client-react";
import AdminLayout from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, MoreHorizontal, Pencil, RefreshCw, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Rascunho",
  ACTIVE: "Ativa",
  PAUSED: "Pausada",
  ARCHIVED: "Arquivada",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  DRAFT: "secondary",
  ACTIVE: "default",
  PAUSED: "outline",
  ARCHIVED: "destructive",
};

const STATUS_OPTIONS = ["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"] as const;

export default function OperationsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useGetOperations();
  const operations: Operation[] = data?.operations ?? [];

  const createMutation = useCreateOperation();
  const updateMutation = useUpdateOperation();
  const updateStatusMutation = useUpdateOperationStatus();

  const [createOpen, setCreateOpen] = useState(false);
  const [editOp, setEditOp] = useState<Operation | null>(null);
  const [statusOp, setStatusOp] = useState<Operation | null>(null);

  const [createForm, setCreateForm] = useState({ name: "", status: "DRAFT" });
  const [editName, setEditName] = useState("");
  const [newStatus, setNewStatus] = useState<string>("");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getGetOperationsQueryKey() });

  const handleCreate = () => {
    if (!createForm.name.trim()) return;
    createMutation.mutate(
      { data: { name: createForm.name.trim(), status: createForm.status as never } },
      {
        onSuccess: () => {
          toast({ title: "Operação criada com sucesso" });
          setCreateOpen(false);
          setCreateForm({ name: "", status: "DRAFT" });
          invalidate();
        },
        onError: () => toast({ title: "Erro ao criar operação", variant: "destructive" }),
      }
    );
  };

  const handleEdit = () => {
    if (!editOp || !editName.trim()) return;
    updateMutation.mutate(
      { id: editOp.id, data: { name: editName.trim() } },
      {
        onSuccess: () => {
          toast({ title: "Operação atualizada" });
          setEditOp(null);
          invalidate();
        },
        onError: () => toast({ title: "Erro ao atualizar operação", variant: "destructive" }),
      }
    );
  };

  const handleStatusChange = () => {
    if (!statusOp || !newStatus) return;
    updateStatusMutation.mutate(
      { id: statusOp.id, data: { status: newStatus as never } },
      {
        onSuccess: () => {
          toast({ title: "Status atualizado" });
          setStatusOp(null);
          invalidate();
        },
        onError: (err: any) => toast({ title: err?.message ?? "Erro ao atualizar status", variant: "destructive" }),
      }
    );
  };

  return (
    <AdminLayout title="Operações" subtitle="Gerencie as produções e espetáculos da organização">
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">{operations.length} operação(ões) encontrada(s)</p>
          <Button onClick={() => setCreateOpen(true)} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Nova Operação
          </Button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-4 border border-destructive/30 bg-destructive/10 rounded-lg text-sm text-destructive">
            <AlertCircle className="w-4 h-4" />
            Erro ao carregar operações
          </div>
        )}

        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(3)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><div className="h-4 bg-muted animate-pulse rounded w-40" /></TableCell>
                    <TableCell><div className="h-4 bg-muted animate-pulse rounded w-20" /></TableCell>
                    <TableCell />
                  </TableRow>
                ))
              ) : operations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-10 text-muted-foreground">
                    Nenhuma operação cadastrada. Crie a primeira!
                  </TableCell>
                </TableRow>
              ) : (
                operations.map((op) => (
                  <TableRow key={op.id}>
                    <TableCell className="font-medium">{op.name}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[op.status] ?? "secondary"}>
                        {STATUS_LABELS[op.status] ?? op.status}
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
                          <DropdownMenuItem onClick={() => { setEditOp(op); setEditName(op.name); }}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Editar nome
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => { setStatusOp(op); setNewStatus(op.status); }}>
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Mudar status
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
          <DialogHeader>
            <DialogTitle>Nova Operação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                placeholder="Ex: Romeu e Julieta 2025"
                value={createForm.name}
                onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Status inicial</Label>
              <Select value={createForm.status} onValueChange={(v) => setCreateForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Criando..." : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editOp} onOpenChange={(o) => !o && setEditOp(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Operação</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Nome</Label>
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOp(null)}>Cancelar</Button>
            <Button onClick={handleEdit} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!statusOp} onOpenChange={(o) => !o && setStatusOp(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mudar Status — {statusOp?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Novo status</Label>
            <Select value={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusOp(null)}>Cancelar</Button>
            <Button onClick={handleStatusChange} disabled={updateStatusMutation.isPending}>
              {updateStatusMutation.isPending ? "Salvando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
