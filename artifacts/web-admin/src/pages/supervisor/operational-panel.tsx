import { useGetOperationalPanel } from "@workspace/api-client-react";
import type {
  OperationalHealth,
  OperationalException,
  OperationalPendingBook,
  OperationalUpcomingEvent,
} from "@workspace/api-client-react";
import AdminLayout from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Activity, AlertTriangle, BookMarked, CalendarDays,
  CheckCircle2, XCircle, AlertCircle, Clock, RefreshCw, Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  HEALTH_CONFIG,
  EVENT_TYPE_LABELS,
  EVENT_TYPE_BADGES,
  EXCEPTION_TYPE_LABELS,
  EXCEPTION_TYPE_BADGES,
} from "@/lib/operational-constants";

// ─── Health icon map ───────────────────────────────────────────────────────────

const HEALTH_ICONS = {
  HEALTHY:   CheckCircle2,
  ATTENTION: AlertCircle,
  RISK:      AlertTriangle,
  CRITICAL:  XCircle,
} as const;

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function SupervisorOperationalPanel() {
  const { data, isLoading, refetch, isFetching } = useGetOperationalPanel({});

  if (isLoading) {
    return (
      <AdminLayout title="Painel Operacional">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 text-muted-foreground animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  if (!data) {
    return (
      <AdminLayout title="Painel Operacional">
        <p className="text-center py-12 text-sm text-muted-foreground">Sem dados disponíveis.</p>
      </AdminLayout>
    );
  }

  const { health, exceptions, pendingBooks, upcomingEvents, generatedAt } = data;
  const cfg = HEALTH_CONFIG[health.status as keyof typeof HEALTH_CONFIG] ?? HEALTH_CONFIG.ATTENTION;
  const HealthIcon = HEALTH_ICONS[health.status as keyof typeof HEALTH_ICONS] ?? HEALTH_ICONS.ATTENTION;

  const criticalItems = exceptions.filter(
    (e) => e.type === "OPEN_POSITION" || e.type === "CONFLICT"
  );

  const today = new Date().toISOString().split("T")[0];
  const h48 = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().split("T")[0];
  const urgentEvents = upcomingEvents.filter((e) => e.date <= h48 && (!e.hasDailyBook));

  return (
    <AdminLayout
      title="Painel Operacional"
      subtitle="O que exige minha atenção agora"
    >
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <p className="text-xs text-muted-foreground">
          Atualizado às {new Date(generatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* ── Saúde — banner proeminente ── */}
      <div className={`rounded-xl border-l-4 ${cfg.borderL} ${cfg.bg} p-5 mb-6 flex items-start gap-4`}>
        <HealthIcon className={`h-10 w-10 ${cfg.text} shrink-0 mt-0.5`} />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Activity className={`h-4 w-4 ${cfg.text}`} />
            <span className={`text-lg font-bold ${cfg.text}`}>{cfg.label}</span>
          </div>
          <ul className="space-y-1">
            {health.reasons.map((r, i) => (
              <li key={i} className={`text-sm ${cfg.text}/90`}>• {r}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* ── Ações urgentes — eventos em 48h sem Livro publicado ── */}
      {urgentEvents.length > 0 && (
        <Card className="border-red-200 mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-red-700 flex items-center gap-2">
              <XCircle className="h-4 w-4" /> Ação Imediata — Eventos sem Livro publicado (48h)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {urgentEvents.map((ev: OperationalUpcomingEvent) => (
                <div key={ev.id} className="px-6 py-3 bg-red-50/50 flex items-center gap-3">
                  <CalendarDays className="h-4 w-4 text-red-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{ev.title}</p>
                    <p className="text-xs text-red-600">
                      {new Date(ev.date + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" })}
                      {ev.startTime && ` às ${ev.startTime.slice(0, 5)}`}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${ev.hasScale ? "bg-violet-100 text-violet-700" : "bg-muted text-muted-foreground"}`}>
                      {ev.hasScale ? "Escala ✓" : "Sem escala"}
                    </span>
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">
                      Livro pendente
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Grid: Livros Pendentes + Conflitos ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Pending Books */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <BookMarked className="h-4 w-4" /> Livros Não Publicados
              {pendingBooks.length > 0 && (
                <span className="ml-auto bg-amber-100 text-amber-800 text-xs px-1.5 py-0.5 rounded-full font-medium">
                  {pendingBooks.length}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {pendingBooks.length === 0 ? (
              <div className="px-6 py-5 flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <p className="text-sm text-green-600">Todos publicados</p>
              </div>
            ) : (
              <div className="divide-y max-h-56 overflow-y-auto">
                {pendingBooks.map((book: OperationalPendingBook) => (
                  <div key={book.id} className="px-6 py-3 flex items-center gap-3">
                    <BookMarked className="h-4 w-4 text-amber-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{book.eventTitle}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(book.eventDate + "T00:00:00").toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <span className="text-xs bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full shrink-0">
                      Rascunho
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Critical exceptions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Conflitos e Posições Abertas
              {criticalItems.length > 0 && (
                <span className="ml-auto bg-red-100 text-red-800 text-xs px-1.5 py-0.5 rounded-full font-medium">
                  {criticalItems.length}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {criticalItems.length === 0 ? (
              <div className="px-6 py-5 flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <p className="text-sm text-green-600">Sem conflitos ou abertos</p>
              </div>
            ) : (
              <div className="divide-y max-h-56 overflow-y-auto">
                {criticalItems.map((ex: OperationalException) => (
                  <div key={ex.id} className="px-6 py-3">
                    <div className="flex items-start gap-2 mb-1">
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0 mt-0.5 ${EXCEPTION_TYPE_BADGES[ex.type] ?? "bg-muted text-muted-foreground"}`}>
                        {EXCEPTION_TYPE_LABELS[ex.type] ?? ex.type}
                      </span>
                      {ex.positionName && (
                        <span className="text-sm font-medium truncate">{ex.positionName}</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{ex.reason}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      {ex.eventTitle && <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" />{ex.eventTitle}</span>}
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />
                        {new Date(ex.date + "T00:00:00").toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Próximos eventos ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <CalendarDays className="h-4 w-4" /> Agenda (próximos 14 dias)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {upcomingEvents.length === 0 ? (
            <p className="px-6 py-4 text-sm text-muted-foreground">Nenhum evento próximo</p>
          ) : (
            <div className="divide-y max-h-72 overflow-y-auto">
              {upcomingEvents.map((ev: OperationalUpcomingEvent) => {
                const isUrgent = ev.date <= h48 && !ev.hasDailyBook;
                return (
                  <div key={ev.id} className={`px-6 py-3 flex items-center gap-3 ${isUrgent ? "bg-red-50/40" : ""}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium truncate">{ev.title}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${EVENT_TYPE_BADGES[ev.type] ?? "bg-muted text-muted-foreground"}`}>
                          {EVENT_TYPE_LABELS[ev.type] ?? ev.type}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(ev.date + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" })}
                        {ev.startTime && ` • ${ev.startTime.slice(0, 5)}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {ev.coveragePct !== null && ev.coveragePct !== undefined && (
                        <span className={`text-xs font-medium ${ev.coveragePct >= 100 ? "text-green-600" : ev.coveragePct >= 60 ? "text-amber-600" : "text-red-600"}`}>
                          {ev.coveragePct.toFixed(0)}%
                        </span>
                      )}
                      <Layers className={`h-3.5 w-3.5 ${ev.hasScale ? "text-violet-500" : "text-muted-foreground/40"}`} />
                      <BookMarked className={`h-3.5 w-3.5 ${ev.hasDailyBook ? "text-blue-500" : "text-muted-foreground/40"}`} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </AdminLayout>
  );
}
