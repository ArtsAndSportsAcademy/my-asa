import { useState } from "react";
import AdminLayout from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, LineChart, Line, CartesianGrid,
} from "recharts";
import {
  useGetCheckInInsights,
  useGetRequestInsights,
  useGetTaskInsights,
  useGetWorkloadInsights,
  useGetNoticeInsights,
  useGetLibraryInsights,
  useGetTrendsInsights,
  useGetOperations,
} from "@workspace/api-client-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PERIOD_OPTIONS = [
  { value: "today", label: "Hoje" },
  { value: "7d",    label: "Últimos 7 dias" },
  { value: "30d",   label: "Últimos 30 dias" },
];

const STATUS_LABELS: Record<string, string> = {
  CHECKED_IN: "Presentes", LATE: "Atrasados", ABSENT: "Ausentes", EXCUSED: "Justificados", EXPECTED: "Aguardando",
  PENDING: "Pendente", APPROVED: "Aprovada", DENIED: "Negada",
  ALTERNATIVE_PROPOSED: "Alt. Proposta", ALTERNATIVE_ACCEPTED: "Alt. Aceita", ALTERNATIVE_REJECTED: "Alt. Rejeitada", EXPIRED: "Expirada",
  CREATED: "Criada", IN_PROGRESS: "Em Andamento", READY_FOR_APPROVAL: "Ag. Aprovação",
  CHANGES_REQUESTED: "Revisão", COMPLETED: "Concluída", CANCELLED: "Cancelada",
  DRAFT: "Rascunho", PUBLISHED: "Publicado", UPDATED: "Atualizado", ARCHIVED: "Arquivado",
  LEAVE: "Folga", ROLE_RESTRICTION: "Rest. de Função", PHYSICAL_RESTRICTION: "Rest. Física",
  HEALTH_RESTRICTION: "Rest. de Saúde", SCHEDULE_CHANGE: "Mudança Escala", SWAP: "Troca", OTHER: "Outro",
};

function fmt(n: number | null | undefined, suffix = ""): string {
  if (n === null || n === undefined) return "—";
  return `${n}${suffix}`;
}

function fmtHours(h: number | null | undefined): string {
  if (h === null || h === undefined) return "—";
  if (h < 1) return `${Math.round(h * 60)}min`;
  return `${h.toFixed(1)}h`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className={`text-2xl font-bold ${color ?? ""}`}>{value}</div>
        <div className="text-sm font-medium mt-0.5">{label}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function SectionSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-4">{[0,1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      <Skeleton className="h-60 rounded-xl" />
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground p-6 border rounded-lg border-dashed justify-center">
      <AlertCircle className="w-4 h-4 shrink-0" /> {message}
    </div>
  );
}

// ─── Tab: Presença ────────────────────────────────────────────────────────────

function PresenceTab({ period, operationId }: { period: string; operationId?: string }) {
  const { data, isLoading } = useGetCheckInInsights({ period, operationId });
  if (isLoading) return <SectionSkeleton />;
  if (!data) return <EmptyState message="Sem dados de presença" />;

  const chartData = data.byOperation.map(op => ({
    name: op.operationName.length > 14 ? op.operationName.slice(0, 14) + "…" : op.operationName,
    Presentes: op.checkedIn, Atrasados: op.late, Ausentes: op.absent,
  }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Presentes" value={data.checkedIn} sub={`${data.rates.presence}% do total`} color="text-green-600" />
        <StatCard label="Atrasados" value={data.late} sub={`${data.rates.late}%`} color="text-amber-600" />
        <StatCard label="Ausentes" value={data.absent} sub={`${data.rates.absence}%`} color="text-red-600" />
        <StatCard label="Justificados" value={data.excused} sub={`${data.rates.excused}%`} color="text-blue-600" />
      </div>
      {data.byOperation.length > 1 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Por Operação</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ left: 0, right: 10, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Presentes" fill="#16a34a" radius={[3,3,0,0]} />
                <Bar dataKey="Atrasados" fill="#d97706" radius={[3,3,0,0]} />
                <Bar dataKey="Ausentes" fill="#dc2626" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Tab: Solicitações ────────────────────────────────────────────────────────

function RequestsTab({ period, operationId }: { period: string; operationId?: string }) {
  const { data, isLoading } = useGetRequestInsights({ period, operationId });
  if (isLoading) return <SectionSkeleton />;
  if (!data) return <EmptyState message="Sem dados de solicitações" />;

  const approved = (data.byStatus["APPROVED"] ?? 0) + (data.byStatus["ALTERNATIVE_ACCEPTED"] ?? 0);
  const denied = (data.byStatus["DENIED"] ?? 0) + (data.byStatus["ALTERNATIVE_REJECTED"] ?? 0);
  const pending = data.byStatus["PENDING"] ?? 0;

  const typeData = Object.entries(data.byType).map(([k, v]) => ({ name: STATUS_LABELS[k] ?? k, total: v }))
    .sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total" value={data.total} />
        <StatCard label="Aprovadas" value={approved} color="text-green-600" />
        <StatCard label="Negadas" value={denied} color="text-red-600" />
        <StatCard label="Tempo médio resp." value={fmtHours(data.avgResponseHours)} color={pending > 0 ? "text-amber-600" : undefined} />
      </div>
      {typeData.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Por Tipo</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={typeData} layout="vertical" margin={{ left: 40, right: 10, top: 4, bottom: 4 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={110} />
                <Tooltip />
                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[0,3,3,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Tab: Tarefas ─────────────────────────────────────────────────────────────

function TasksTab({ period, operationId }: { period: string; operationId?: string }) {
  const { data, isLoading } = useGetTaskInsights({ period, operationId });
  if (isLoading) return <SectionSkeleton />;
  if (!data) return <EmptyState message="Sem dados de tarefas" />;

  const completed = (data.byStatus["APPROVED"] ?? 0) + (data.byStatus["COMPLETED"] ?? 0);
  const awaitingApproval = data.byStatus["READY_FOR_APPROVAL"] ?? 0;

  const statusData = Object.entries(data.byStatus)
    .map(([k, v]) => ({ name: STATUS_LABELS[k] ?? k, total: v }))
    .sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total" value={data.total} />
        <StatCard label="Concluídas" value={completed} color="text-green-600" />
        <StatCard label="Atrasadas" value={data.overdue} color={data.overdue > 0 ? "text-red-600" : undefined} />
        <StatCard label="Ag. Aprovação" value={awaitingApproval} color={awaitingApproval > 0 ? "text-amber-600" : undefined} />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Tempo médio conclusão" value={fmtHours(data.avgCompletionHours)} />
        <StatCard label="Taxa de aprovação" value={fmt(data.approvalRate, "%")} color={data.approvalRate !== null && data.approvalRate >= 70 ? "text-green-600" : "text-amber-600"} />
        <StatCard label="Taxa de retrabalho" value={fmt(data.reworkRate, "%")} color={data.reworkRate !== null && data.reworkRate > 20 ? "text-red-600" : undefined} />
      </div>
      {statusData.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Por Status</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={statusData} layout="vertical" margin={{ left: 40, right: 10, top: 4, bottom: 4 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={110} />
                <Tooltip />
                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[0,3,3,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Tab: Carga Operacional ────────────────────────────────────────────────────

function WorkloadTab({ operationId }: { operationId?: string }) {
  const { data, isLoading } = useGetWorkloadInsights({ operationId });
  if (isLoading) return <SectionSkeleton />;
  if (!data || data.byAssignee.length === 0) return <EmptyState message="Nenhum dado de carga operacional" />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Pessoas com carga ativa" value={data.byAssignee.length} />
        <StatCard label="Tarefas abertas (total)" value={data.byAssignee.reduce((s, a) => s + a.openTasks, 0)} />
        <StatCard label="Tarefas atrasadas (total)" value={data.byAssignee.reduce((s, a) => s + a.overdueTasks, 0)} color={data.byAssignee.some(a => a.overdueTasks > 0) ? "text-red-600" : undefined} />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-sm">Por Responsável</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Membro</TableHead>
                <TableHead className="text-right">Tarefas abertas</TableHead>
                <TableHead className="text-right">Atrasadas</TableHead>
                <TableHead className="text-right">Sol. pendentes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.byAssignee.map(a => (
                <TableRow key={a.assigneeId}>
                  <TableCell className="font-medium">{a.assigneeName}</TableCell>
                  <TableCell className="text-right">{a.openTasks}</TableCell>
                  <TableCell className="text-right">
                    {a.overdueTasks > 0
                      ? <Badge variant="destructive" className="text-xs">{a.overdueTasks}</Badge>
                      : <span className="text-muted-foreground">0</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    {a.pendingRequests > 0
                      ? <Badge variant="secondary" className="text-xs">{a.pendingRequests}</Badge>
                      : <span className="text-muted-foreground">0</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Tab: Avisos ──────────────────────────────────────────────────────────────

function NoticesTab({ period, operationId }: { period: string; operationId?: string }) {
  const { data, isLoading } = useGetNoticeInsights({ period, operationId });
  if (isLoading) return <SectionSkeleton />;
  if (!data) return <EmptyState message="Sem dados de avisos" />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Avisos publicados" value={data.total} />
        <StatCard label="Taxa de confirmação" value={fmt(data.confirmationRate, "%")} color={data.confirmationRate >= 80 ? "text-green-600" : "text-amber-600"} />
        <StatCard label="Escalados" value={data.escalated} color={data.escalated > 0 ? "text-red-600" : undefined} />
        <StatCard label="Tempo médio confirm." value={fmtHours(data.avgConfirmationHours)} />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Requerem confirmação" value={data.requiresConfirmation} />
        <StatCard label="Visualizados" value={data.viewed} color="text-blue-600" />
        <StatCard label="Ignorados (sem leitura)" value={data.ignored} color={data.ignored > 0 ? "text-amber-600" : undefined} />
      </div>
    </div>
  );
}

// ─── Tab: Biblioteca ──────────────────────────────────────────────────────────

function LibraryTab({ operationId }: { operationId?: string }) {
  const { data, isLoading } = useGetLibraryInsights({ operationId });
  if (isLoading) return <SectionSkeleton />;
  if (!data) return <EmptyState message="Sem dados de biblioteca" />;

  const published = data.byStatus["PUBLISHED"] ?? 0;
  const draft = data.byStatus["DRAFT"] ?? 0;
  const archived = data.byStatus["ARCHIVED"] ?? 0;

  const catData = data.byCategory.slice(0, 10).map(c => ({
    name: c.categoryName.length > 18 ? c.categoryName.slice(0, 18) + "…" : c.categoryName,
    docs: c.docCount,
  }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total de documentos" value={data.totalDocs} />
        <StatCard label="Publicados" value={published} color="text-green-600" />
        <StatCard label="Rascunhos" value={draft} color="text-muted-foreground" />
        <StatCard label="Arquivados" value={archived} />
      </div>
      {catData.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Por Categoria</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={catData} layout="vertical" margin={{ left: 40, right: 10, top: 4, bottom: 4 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={120} />
                <Tooltip />
                <Bar dataKey="docs" fill="hsl(var(--primary))" radius={[0,3,3,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Tab: Tendências ──────────────────────────────────────────────────────────

function TrendsTab({ operationId }: { operationId?: string }) {
  const { data, isLoading } = useGetTrendsInsights({ operationId });
  if (isLoading) return <SectionSkeleton />;
  if (!data || data.weekly.length === 0) return <EmptyState message="Sem dados de tendências" />;

  const last8 = data.weekly.slice(-8);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-sm">Evolução Semanal — Presença (%)</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={last8} margin={{ left: 0, right: 10, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="week" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} unit="%" domain={[0, 100]} />
              <Tooltip formatter={(v: number) => [`${v}%`, "Presença"]} />
              <Line type="monotone" dataKey="presenceRate" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} name="Presença" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-sm">Evolução Semanal — Tarefas e Solicitações</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={last8} margin={{ left: 0, right: 10, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="week" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="tasksCreated" name="Tarefas criadas" fill="hsl(var(--primary))" radius={[3,3,0,0]} />
              <Bar dataKey="tasksCompleted" name="Tarefas concluídas" fill="#16a34a" radius={[3,3,0,0]} />
              <Bar dataKey="requestsTotal" name="Solicitações" fill="#d97706" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminInsightsPage() {
  const [period, setPeriod] = useState("30d");
  const [operationId, setOperationId] = useState<string>("");

  const { data: opsData } = useGetOperations();
  const operations = (opsData as any)?.operations ?? [];

  return (
    <AdminLayout title="Insights Operacionais" subtitle="Visão consolidada do desempenho operacional">
      {/* ── Filtros ── */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {PERIOD_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setPeriod(opt.value)}
              className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${period === opt.value ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <Select value={operationId} onValueChange={setOperationId}>
          <SelectTrigger className="w-48 h-9">
            <SelectValue placeholder="Todas as operações" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todas as operações</SelectItem>
            {operations.map((op: any) => (
              <SelectItem key={op.id} value={op.id}>{op.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Tabs ── */}
      <Tabs defaultValue="presence">
        <TabsList className="flex-wrap h-auto gap-1 mb-6">
          <TabsTrigger value="presence">Presença</TabsTrigger>
          <TabsTrigger value="requests">Solicitações</TabsTrigger>
          <TabsTrigger value="tasks">Tarefas</TabsTrigger>
          <TabsTrigger value="workload">Carga Operacional</TabsTrigger>
          <TabsTrigger value="notices">Avisos</TabsTrigger>
          <TabsTrigger value="library">Biblioteca</TabsTrigger>
          <TabsTrigger value="trends">Tendências</TabsTrigger>
        </TabsList>
        <TabsContent value="presence">
          <PresenceTab period={period} operationId={operationId || undefined} />
        </TabsContent>
        <TabsContent value="requests">
          <RequestsTab period={period} operationId={operationId || undefined} />
        </TabsContent>
        <TabsContent value="tasks">
          <TasksTab period={period} operationId={operationId || undefined} />
        </TabsContent>
        <TabsContent value="workload">
          <WorkloadTab operationId={operationId || undefined} />
        </TabsContent>
        <TabsContent value="notices">
          <NoticesTab period={period} operationId={operationId || undefined} />
        </TabsContent>
        <TabsContent value="library">
          <LibraryTab operationId={operationId || undefined} />
        </TabsContent>
        <TabsContent value="trends">
          <TrendsTab operationId={operationId || undefined} />
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}
