import { useState, useMemo } from "react";
import {
  useListMyAllocations,
  getListMyAllocationsQueryKey,
  useListFolgas,
  getListFolgasQueryKey,
} from "@workspace/api-client-react";
import type { MyAllocation } from "@workspace/api-client-react";
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
} from "lucide-react";

import {
  ALLOCATION_STATUS_LABELS,
  SCALE_STATUS_LABELS,
} from "@/lib/operational-constants";

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
  NO_SHOW:     "No-show",
  RECESSO:     "Recesso",
  AFASTAMENTO: "Afastamento",
  RESTRICAO:   "Restrição",
  OUTRO:       "Outro",
};

const ALLOCATION_STATUS_BADGES: Record<string, string> = {
  ASSIGNED:        "bg-green-100 text-green-700 border-green-200",
  OPEN:            "bg-gray-100 text-gray-600 border-gray-200",
  CONFLICT:        "bg-amber-100 text-amber-700 border-amber-200",
  MANUAL_OVERRIDE: "bg-purple-100 text-purple-700 border-purple-200",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

function formatTime(timeStr: string | null | undefined): string {
  if (!timeStr) return "";
  return timeStr.slice(0, 5);
}

function isUpcoming(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const eventDate = new Date(dateStr + "T00:00:00");
  return eventDate >= today;
}

function isDateInFolga(date: string, folgas: FolgaLike[]): boolean {
  return folgas.some(
    (f) => f.status === "ACTIVE" && f.startDate <= date && date <= f.endDate
  );
}

// ─── Folga Card ───────────────────────────────────────────────────────────────

function FolgaCard({ folga }: { folga: FolgaLike }) {
  const isSingleDay = folga.startDate === folga.endDate;
  const periodoLabel = isSingleDay
    ? formatDate(folga.startDate)
    : `${formatDate(folga.startDate)} — ${formatDate(folga.endDate)}`;

  return (
    <Card className="border border-green-300 bg-green-50/60">
      <CardContent className="p-4 space-y-1.5">
        <div className="flex items-start gap-3">
          <Palmtree className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-green-700">
              Você está de folga neste período
            </p>
            <p className="text-xs text-green-700/80 mt-0.5">
              {FOLGA_TYPE_LABELS[folga.type] ?? folga.type} · {periodoLabel}
            </p>
          </div>
        </div>
        {folga.notes && (
          <p className="text-xs italic text-green-800 line-clamp-2 pl-8">{folga.notes}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Allocation Card ──────────────────────────────────────────────────────────

function AllocationCard({ alloc, hasFolga }: { alloc: MyAllocation; hasFolga?: boolean }) {
  const statusClass = ALLOCATION_STATUS_BADGES[alloc.status] ?? "bg-gray-100 text-gray-600 border-gray-200";

  return (
    <Card className="border">
      <CardContent className="p-4 space-y-2">
        {/* Header row: date pill + folga indicator + status */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs font-semibold gap-1">
              <Calendar className="w-3 h-3" />
              {formatDate(alloc.eventDate)}
            </Badge>
            {hasFolga && (
              <Badge className="bg-green-100 text-green-700 border border-green-200 text-xs gap-1">
                <Palmtree className="w-3 h-3" />
                Folga
              </Badge>
            )}
          </div>
          <Badge variant="outline" className={`text-xs ${statusClass}`}>
            {ALLOCATION_STATUS_LABELS[alloc.status] ?? alloc.status}
          </Badge>
        </div>

        {/* Event title */}
        <h3 className="text-base font-semibold leading-tight">
          {alloc.eventTitle ?? "Evento"}
        </h3>

        {/* Meta */}
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {alloc.eventStartTime && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              {formatTime(alloc.eventStartTime)}
              {alloc.eventEndTime ? ` — ${formatTime(alloc.eventEndTime)}` : ""}
            </div>
          )}
          {alloc.eventLocation && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="w-3 h-3" />
              {alloc.eventLocation}
            </div>
          )}
          {alloc.positionName && (
            <div className="flex items-center gap-1 text-xs text-primary font-medium">
              <UserCheck className="w-3 h-3" />
              {alloc.positionName}
            </div>
          )}
        </div>

        {/* Scale info */}
        {alloc.scaleTitle && (
          <p className="text-xs text-muted-foreground">
            Escala: {alloc.scaleTitle}
            {alloc.scaleStatus
              ? ` · ${SCALE_STATUS_LABELS[alloc.scaleStatus] ?? alloc.scaleStatus}`
              : ""}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MinhaEscalaPage() {
  const auth = useAuth();
  const [activeFilter, setActiveFilter] = useState<FilterValue>("upcoming");

  const operationId = auth.roles.find((r) => r.operationId)?.operationId;
  const userId = auth.user?.id;
  const userRole = auth.roles[0]?.role;
  const isManager =
    userRole === "ADMIN" || userRole === "SUPERVISOR_A" || userRole === "SUPERVISOR_B";

  const queryParams = { operationId };

  const { data, isLoading, isError } = useListMyAllocations(queryParams, {
    query: {
      queryKey: getListMyAllocationsQueryKey(queryParams),
      enabled: !!operationId,
    },
  });

  const folgaParams = {
    ...(isManager && operationId ? { operationId } : {}),
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

  const today = new Date().toISOString().slice(0, 10);
  const upcomingFolgas = useMemo(
    () => activeFolgas.filter((f) => f.endDate >= today),
    [activeFolgas, today]
  );

  const allAllocations = data?.allocations ?? [];
  const displayed =
    activeFilter === "upcoming"
      ? allAllocations.filter((a) => isUpcoming(a.eventDate))
      : allAllocations;

  const allocationDates = useMemo(
    () => new Set(allAllocations.map((a) => a.eventDate).filter(Boolean)),
    [allAllocations]
  );

  const pureFolgas = useMemo(
    () =>
      upcomingFolgas.filter((f) => {
        for (const d of allocationDates) {
          if (d && f.startDate <= d && d <= f.endDate) return false;
        }
        return true;
      }),
    [upcomingFolgas, allocationDates]
  );

  const subtitle =
    `${allAllocations.length} alocaç${allAllocations.length === 1 ? "ão" : "ões"} no total` +
    (upcomingFolgas.length > 0
      ? ` · ${upcomingFolgas.length} folga${upcomingFolgas.length > 1 ? "s" : ""} ativa${upcomingFolgas.length > 1 ? "s" : ""}`
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
        ) : (
          <div className="space-y-3">
            {/* Pure folga cards — rest days with no allocations */}
            {activeFilter === "upcoming" &&
              pureFolgas.map((f) => <FolgaCard key={f.id} folga={f} />)}

            {/* Allocation cards with folga indicators */}
            {displayed.length === 0 && pureFolgas.length === 0 ? (
              <div className="text-center py-16">
                <Calendar className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm font-medium">
                  {activeFilter === "upcoming"
                    ? "Nenhuma escala futura ainda"
                    : "Nenhuma escala registrada ainda"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {activeFilter === "upcoming"
                    ? "Quando o supervisor publicar sua escala, tudo aparecerá aqui organizado."
                    : "Você ainda não foi alocado em nenhuma escala. Fique ligado!"}
                </p>
              </div>
            ) : (
              displayed.map((alloc) => (
                <AllocationCard
                  key={alloc.id}
                  alloc={alloc}
                  hasFolga={isDateInFolga(alloc.eventDate ?? "", activeFolgas)}
                />
              ))
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
