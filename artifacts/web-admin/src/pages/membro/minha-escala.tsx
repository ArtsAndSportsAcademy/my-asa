import { useState, useMemo } from "react";
import {
  useListMyAllocations,
  getListMyAllocationsQueryKey,
  useListFolgas,
  getListFolgasQueryKey,
} from "@workspace/api-client-react";
import type { MyAllocation } from "@workspace/api-client-react";

type AllocationWithOp = MyAllocation & { operationId?: string | null; operationName?: string | null };
import AdminLayout from "@/components/admin-layout";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  Clock,
  MapPin,
  UserCheck,
  Palmtree,
  RefreshCw,
  Building2,
} from "lucide-react";

import { SCALE_STATUS_LABELS } from "@/lib/operational-constants";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FolgaLike {
  id: string;
  userId: string;
  type: string;
  startDate: string;
  endDate: string;
  status: string;
  notes?: string | null;
}

type FilterValue = "upcoming" | "all";

const FILTER_TABS: { label: string; value: FilterValue }[] = [
  { label: "Próximas", value: "upcoming" },
  { label: "Todas", value: "all" },
];

const FOLGA_TYPE_LABELS: Record<string, string> = {
  DAY_OFF:     "Folga",
  NO_SHOW:     "Folga",
  RECESSO:     "Recesso",
  AFASTAMENTO: "Afastamento",
  RESTRICAO:   "Restrição",
  OUTRO:       "Outro",
};

// Old model: week runs Thursday → Wednesday
const WEEKDAY_LABELS = ["QUI", "SEX", "SÁB", "DOM", "SEG", "TER", "QUA"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

function formatShort(dateStr: string): string {
  const [, month, day] = dateStr.split("-");
  return `${day}/${month}`;
}

function formatTime(timeStr: string | null | undefined): string {
  if (!timeStr) return "";
  return timeStr.slice(0, 5);
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

// Snap any date back to its week's Thursday (old MyASA model)
function thursdayOf(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const dow = d.getDay(); // 0=Sun..6=Sat; Thursday=4
  const diff = (dow - 4 + 7) % 7;
  d.setDate(d.getDate() - diff);
  return d.toISOString().slice(0, 10);
}

function folgaTypeOn(date: string, folgas: FolgaLike[]): string | null {
  const f = folgas.find(
    (x) => x.status === "ACTIVE" && x.startDate <= date && date <= x.endDate
  );
  return f ? f.type : null;
}

// ─── Day row (within a week) ───────────────────────────────────────────────────

function DayRow({
  label,
  date,
  entries,
  folgaType,
  showOp,
}: {
  label: string;
  date: string;
  entries: AllocationWithOp[];
  folgaType: string | null;
  showOp: boolean;
}) {
  const hasEntries = entries.length > 0;
  return (
    <div className="flex gap-3 py-2.5 border-b last:border-b-0">
      {/* Day pill */}
      <div className="w-14 shrink-0 text-center">
        <p className="text-[11px] font-semibold text-muted-foreground">{label}</p>
        <p className="text-xs font-medium">{formatShort(date)}</p>
      </div>

      {/* Day body */}
      <div className="flex-1 min-w-0 space-y-1.5">
        {folgaType && (
          <Badge className="bg-green-100 text-green-700 border border-green-200 text-xs gap-1">
            <Palmtree className="w-3 h-3" />
            {FOLGA_TYPE_LABELS[folgaType] ?? folgaType}
          </Badge>
        )}

        {hasEntries ? (
          entries.map((e) => (
            <div key={e.id} className="rounded-md border bg-card px-3 py-2">
              <p className="text-sm font-semibold leading-tight">
                {e.eventTitle ?? "Escala"}
              </p>
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                {e.eventStartTime && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {formatTime(e.eventStartTime)}
                    {e.eventEndTime ? ` — ${formatTime(e.eventEndTime)}` : ""}
                  </span>
                )}
                {e.eventLocation && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="w-3 h-3" />
                    {e.eventLocation}
                  </span>
                )}
                {e.positionName && (
                  <span className="flex items-center gap-1 text-xs text-primary font-medium">
                    <UserCheck className="w-3 h-3" />
                    {e.positionName}
                  </span>
                )}
                {showOp && e.operationName && (
                  <span className="flex items-center gap-1 text-xs text-blue-600 font-medium">
                    <Building2 className="w-3 h-3" />
                    {e.operationName}
                  </span>
                )}
              </div>
            </div>
          ))
        ) : (
          !folgaType && (
            <p className="text-xs text-muted-foreground/70 py-1">Sem escala</p>
          )
        )}
      </div>
    </div>
  );
}

// ─── Week card ─────────────────────────────────────────────────────────────────

function WeekCard({
  weekStart,
  allocations,
  folgas,
  showOp,
}: {
  weekStart: string;
  allocations: AllocationWithOp[];
  folgas: FolgaLike[];
  showOp: boolean;
}) {
  const weekEnd = addDays(weekStart, 6);

  const byDate = useMemo(() => {
    const m = new Map<string, AllocationWithOp[]>();
    for (const a of allocations) {
      if (!a.eventDate) continue;
      const list = m.get(a.eventDate) ?? [];
      list.push(a);
      m.set(a.eventDate, list);
    }
    for (const list of m.values()) {
      list.sort((x, y) =>
        (x.eventStartTime ?? "").localeCompare(y.eventStartTime ?? "")
      );
    }
    return m;
  }, [allocations]);

  // status: most-relevant scale status present this week
  const status = allocations.find((a) => a.scaleStatus)?.scaleStatus ?? null;
  const totalEntries = allocations.length;

  return (
    <Card className="border">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold">
              Escala {formatShort(weekStart)} a {formatShort(weekEnd)}
            </h3>
          </div>
          {status && (
            <Badge variant="outline" className="text-xs">
              {SCALE_STATUS_LABELS[status] ?? status}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mb-2">
          {totalEntries} entrada{totalEntries === 1 ? "" : "s"} nesta semana
        </p>

        <div>
          {WEEKDAY_LABELS.map((label, i) => {
            const date = addDays(weekStart, i);
            return (
              <DayRow
                key={date}
                label={label}
                date={date}
                entries={byDate.get(date) ?? []}
                folgaType={folgaTypeOn(date, folgas)}
                showOp={showOp}
              />
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MinhaEscalaPage() {
  const auth = useAuth();
  const [activeFilter, setActiveFilter] = useState<FilterValue>("upcoming");

  const userId = auth.user?.id;

  const queryParams = {};

  const { data, isLoading, isError } = useListMyAllocations(queryParams, {
    query: {
      queryKey: getListMyAllocationsQueryKey(queryParams),
      enabled: !!userId,
    },
  });

  const folgaParams = {
    ...(userId ? { userId } : {}),
    status: "ACTIVE",
  };
  const { data: folgaData } = useListFolgas(folgaParams as any, {
    query: {
      queryKey: getListFolgasQueryKey(folgaParams as any),
      enabled: !!userId,
    },
  });

  const activeFolgas = useMemo<FolgaLike[]>(
    () => ((folgaData as any)?.folgas as FolgaLike[] | undefined) ?? [],
    [folgaData]
  );

  const allAllocations = useMemo<AllocationWithOp[]>(
    () => (data?.allocations as AllocationWithOp[] | undefined) ?? [],
    [data]
  );
  const isMultiOp = useMemo(
    () => new Set(allAllocations.map((a) => a.operationId).filter(Boolean)).size > 1,
    [allAllocations]
  );

  // Group allocations into weeks (Thu→Wed). Inject weeks that only have folgas too.
  const weeks = useMemo(() => {
    const byWeek = new Map<string, AllocationWithOp[]>();
    for (const a of allAllocations) {
      if (!a.eventDate) continue;
      const ws = thursdayOf(a.eventDate);
      const list = byWeek.get(ws) ?? [];
      list.push(a);
      byWeek.set(ws, list);
    }
    for (const f of activeFolgas) {
      if (f.status !== "ACTIVE") continue;
      let cursor = thursdayOf(f.startDate);
      const end = f.endDate;
      while (cursor <= end) {
        if (!byWeek.has(cursor)) byWeek.set(cursor, []);
        cursor = addDays(cursor, 7);
      }
    }
    return Array.from(byWeek.entries())
      .map(([weekStart, allocations]) => ({ weekStart, allocations }))
      .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  }, [allAllocations, activeFolgas]);

  const today = new Date().toISOString().slice(0, 10);
  const displayedWeeks =
    activeFilter === "upcoming"
      ? weeks.filter((w) => addDays(w.weekStart, 6) >= today)
      : weeks;

  const activeFolgaCount = useMemo(
    () => activeFolgas.filter((f) => f.endDate >= today).length,
    [activeFolgas, today]
  );

  const subtitle =
    `${allAllocations.length} entrada${allAllocations.length === 1 ? "" : "s"} no total` +
    (activeFolgaCount > 0
      ? ` · ${activeFolgaCount} folga${activeFolgaCount > 1 ? "s" : ""} ativa${activeFolgaCount > 1 ? "s" : ""}`
      : "");

  return (
    <AdminLayout title="Minha Escala" subtitle={subtitle}>
      <div className="max-w-3xl space-y-4">
        {/* Filter tabs */}
        <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveFilter(tab.value)}
              className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeFilter === tab.value
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <RefreshCw className="h-7 w-7 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-sm text-muted-foreground">
                Não foi possível carregar sua escala. Tente novamente em instantes.
              </p>
            </CardContent>
          </Card>
        ) : displayedWeeks.length === 0 ? (
          <div className="text-center py-16">
            <Calendar className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium">
              {activeFilter === "upcoming"
                ? "Nenhuma escala futura ainda"
                : "Nenhuma escala registrada ainda"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {activeFilter === "upcoming"
                ? "Quando o supervisor publicar sua escala, cada semana aparecerá aqui dia a dia."
                : "Você ainda não foi alocado em nenhuma escala. Fique ligado!"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayedWeeks.map((w) => (
              <WeekCard
                key={w.weekStart}
                weekStart={w.weekStart}
                allocations={w.allocations}
                folgas={activeFolgas}
                showOp={isMultiOp}
              />
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
