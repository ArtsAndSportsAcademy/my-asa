import { useState } from "react";
import {
  useListShowBooks,
  useListShowBookVersions,
  getListShowBooksQueryKey,
  getListShowBookVersionsQueryKey,
} from "@workspace/api-client-react";
import type { ShowBook, ShowBookVersion } from "@workspace/api-client-react";
import AdminLayout from "@/components/admin-layout";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { History, BookOpen, Calendar } from "lucide-react";

const CHANGE_TYPE_LABELS: Record<string, string> = {
  STRUCTURAL: "Estrutural",
  CONFIG: "Configuração",
};
const CHANGE_TYPE_VARIANTS: Record<string, "default" | "secondary"> = {
  STRUCTURAL: "default",
  CONFIG: "secondary",
};

export default function AuditoriaPage() {
  const auth = useAuth();
  const operationId = auth.roles.find((r) => r.operationId)?.operationId;

  const [selectedBookId, setSelectedBookId] = useState<string>("ALL");

  const { data: listData, isLoading: booksLoading } = useListShowBooks(
    { operationId },
    { query: { queryKey: getListShowBooksQueryKey({ operationId }) } }
  );
  const books: ShowBook[] = listData?.showBooks ?? [];

  const targetId = selectedBookId !== "ALL" ? selectedBookId : books[0]?.id ?? "";

  const { data: versionsData, isLoading: versionsLoading } = useListShowBookVersions(
    targetId,
    {
      query: {
        queryKey: getListShowBookVersionsQueryKey(targetId),
        enabled: !!targetId,
      },
    }
  );
  const versions: ShowBookVersion[] = [...(versionsData?.versions ?? [])].reverse();

  const isLoading = booksLoading || versionsLoading;

  return (
    <AdminLayout title="Auditoria" subtitle="Histórico de alterações estruturais">
      <div className="flex flex-col gap-6">
        {/* Seção: Versões do Livro do Show */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <History className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Versões do Livro do Show</h2>
              <p className="text-sm text-muted-foreground">
                Cada mudança estrutural ou de configuração gera uma nova versão
              </p>
            </div>
            <div className="ml-auto">
              <Select
                value={selectedBookId}
                onValueChange={setSelectedBookId}
              >
                <SelectTrigger className="w-56 h-8 text-sm">
                  <SelectValue placeholder="Selecione o livro" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">
                    {books[0]?.title ?? "Selecione um livro"}
                  </SelectItem>
                  {books.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          ) : !targetId ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground gap-2">
              <BookOpen className="h-8 w-8 opacity-20" />
              <p className="text-sm">Nenhum livro disponível para auditar</p>
            </div>
          ) : versions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground gap-2">
              <History className="h-8 w-8 opacity-20" />
              <p className="text-sm">Sem versões registradas para este livro</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Versão</TableHead>
                  <TableHead className="w-32">Tipo</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead className="w-44">Data / Hora</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {versions.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell>
                      <span className="font-mono font-semibold text-sm">v{v.version}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={CHANGE_TYPE_VARIANTS[v.changeType]}>
                        {CHANGE_TYPE_LABELS[v.changeType] ?? v.changeType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-foreground">{v.reason}</TableCell>
                    <TableCell className="text-sm text-muted-foreground tabular-nums">
                      {new Date(v.createdAt).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <Separator />

        {/* Seção informativa */}
        <div className="rounded-lg border bg-muted/30 p-4">
          <div className="flex items-start gap-3">
            <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-sm font-medium">Rastreabilidade completa</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                Toda alteração no Livro do Show — adição ou remoção de Cenas, Blocos, Posições
                e Linhas — registra automaticamente uma versão com motivo e responsável.
                Mudanças de configuração (type CONFIG) e mudanças estruturais (type STRUCTURAL)
                são diferenciadas para facilitar revisões técnicas e artísticas.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
