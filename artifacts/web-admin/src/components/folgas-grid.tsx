import { useRef, useState, useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import {
  useGetFolgasGrid,
  useToggleFolgaCell,
  useBulkFillFolgas,
  getGetFolgasGridQueryKey,
} from "@workspace/api-client-react";

// ─── Types & constants ────────────────────────────────────────────────────────

export type GridType = "NO_SHOW" | "RECESSO" | "OUTRO";
export const GRID_TYPES: { value: GridType; label: string; abbr: string; bg: string; text: string }[] = [
  { value: "NO_SHOW", label: "No-show", abbr: "NS", bg: "bg-red-100", text: "text-red-800" },
  { value: "RECESSO", label: "Recesso", abbr: "R",  bg: "bg-orange-100", text: "text-orange-800" },
  { value: "OUTRO",   label: "Outro",   abbr: "O",  bg: "bg-gray-200",  text: "text-gray-700" },
];

const ALL_TYPE_INFO: Record<string, { abbr: string; bg: string; text: string }> = {
  NO_SHOW:     { abbr: "NS", bg: "bg-red-100",    text: "text-red-800" },
  RECESSO:     { abbr: "R",  bg: "bg-orange-100",  text: "text-orange-800" },
  OUTRO:       { abbr: "O",  bg: "bg-gray-200",    text: "text-gray-700" },
  DAY_OFF:     { abbr: "F",  bg: "bg-blue-100",    text: "text-blue-800" },
  AFASTAMENTO: { abbr: "Af", bg: "bg-purple-100",  text: "text-purple-800" },
  RESTRICAO:   { abbr: "Rs", bg: "bg-yellow-100",  text: "text-yellow-800" },
};

const DAY_ABBR = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTH_NAMES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

function isWeekend(year: number, month: number, day: number): boolean {
  const dow = new Date(year, month - 1, day).getDay();
  return dow === 0 || dow === 6;
}

function getDayAbbr(year: number, month: number, day: number): string {
  return DAY_ABBR[new Date(year, month - 1, day).getDay()]!;
}

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getWeekDays(year: number, month: number): number[] {
  const today = new Date();
  const refDay = (today.getFullYear() === year && today.getMonth() + 1 === month)
    ? today.getDate()
    : 1;
  const refDate = new Date(year, month - 1, refDay);
  const dow = refDate.getDay();
  const monday = refDay - ((dow + 6) % 7);
  const daysInMonth = new Date(year, month, 0).getDate();
  const days: number[] = [];
  for (let i = 0; i < 7; i++) {
    const d = monday + i;
    if (d >= 1 && d <= daysInMonth) days.push(d);
  }
  return days;
}

// ─── Cell mini menu ───────────────────────────────────────────────────────────

interface CellMenuProps {
  x: number; y: number;
  currentType: string | null;
  onSelect: (type: GridType | null) => void;
  onClose: () => void;
}

function CellMenu({ x, y, currentType, onSelect, onClose }: CellMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const menuStyle: React.CSSProperties = {
    position: "fixed",
    left: Math.min(x, window.innerWidth - 180),
    top: Math.min(y, window.innerHeight - 180),
    zIndex: 9999,
  };

  return (
    <div
      ref={ref}
      style={menuStyle}
      className="bg-white border border-border rounded-lg shadow-lg p-1.5 flex flex-col gap-0.5 min-w-[140px]"
    >
      {GRID_TYPES.map((t) => (
        <button
          key={t.value}
          className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium text-left hover:opacity-80 transition-opacity ${
            currentType === t.value ? "ring-2 ring-offset-1 ring-primary" : ""
          } ${t.bg} ${t.text}`}
          onMouseDown={(e) => { e.stopPropagation(); onSelect(t.value); }}
        >
          <span className="font-bold w-5">{t.abbr}</span>
          {t.label}
        </button>
      ))}
      <div className="border-t border-border my-0.5" />
      <button
        className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium text-left text-muted-foreground hover:bg-muted transition-colors"
        onMouseDown={(e) => { e.stopPropagation(); onSelect(null); }}
      >
        Limpar
      </button>
    </div>
  );
}

// ─── Bulk popover ─────────────────────────────────────────────────────────────

interface BulkMenuProps {
  count: number;
  onSelect: (type: GridType | null) => void;
  onClose: () => void;
}

function BulkMenu({ count, onSelect, onClose }: BulkMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      style={{ position: "fixed", left: "50%", top: "50%", transform: "translate(-50%,-50%)", zIndex: 9999 }}
      className="bg-white border border-border rounded-lg shadow-xl p-3 min-w-[200px]"
    >
      <p className="text-xs text-muted-foreground mb-2 font-medium">{count} célula{count !== 1 ? "s" : ""} selecionada{count !== 1 ? "s" : ""}</p>
      <div className="flex flex-col gap-1">
        {GRID_TYPES.map((t) => (
          <button
            key={t.value}
            className={`flex items-center gap-2 px-3 py-2 rounded text-xs font-medium text-left hover:opacity-80 transition-opacity ${t.bg} ${t.text}`}
            onMouseDown={(e) => { e.stopPropagation(); onSelect(t.value); }}
          >
            <span className="font-bold w-5">{t.abbr}</span>
            {t.label}
          </button>
        ))}
        <div className="border-t border-border my-0.5" />
        <button
          className="flex items-center gap-2 px-3 py-2 rounded text-xs font-medium text-left text-muted-foreground hover:bg-muted transition-colors"
          onMouseDown={(e) => { e.stopPropagation(); onSelect(null); }}
        >
          Limpar seleção
        </button>
      </div>
    </div>
  );
}

// ─── Week Fill type menu ──────────────────────────────────────────────────────

interface WeekFillMenuProps {
  x: number; y: number;
  onSelect: (type: GridType) => void;
  onClose: () => void;
}

function WeekFillMenu({ x, y, onSelect, onClose }: WeekFillMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const menuStyle: React.CSSProperties = {
    position: "fixed",
    left: Math.min(x, window.innerWidth - 180),
    top: Math.min(y + 4, window.innerHeight - 160),
    zIndex: 9999,
  };

  return (
    <div
      ref={ref}
      style={menuStyle}
      className="bg-white border border-border rounded-lg shadow-lg p-1.5 flex flex-col gap-0.5 min-w-[150px]"
    >
      <p className="text-[10px] text-muted-foreground px-2 py-1 font-medium">Tipo para a semana</p>
      {GRID_TYPES.map((t) => (
        <button
          key={t.value}
          className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium text-left hover:opacity-80 transition-opacity ${t.bg} ${t.text}`}
          onMouseDown={(e) => { e.stopPropagation(); onSelect(t.value); }}
        >
          <span className="font-bold w-5">{t.abbr}</span>
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ─── Main Grid Component ──────────────────────────────────────────────────────

interface FolgasGridProps {
  operationId: string;
  year: number;
  month: number;
  memberFilter?: string;
}

export function FolgasGrid({ operationId, year, month, memberFilter }: FolgasGridProps) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const today = new Date();
  const todayDay = today.getDate();
  const todayMonth = today.getMonth() + 1;
  const todayYear = today.getFullYear();

  const { data, isLoading, isFetching } = useGetFolgasGrid(
    { operationId, year, month },
    { query: { enabled: !!operationId } } as any,
  );

  const members = (data?.members ?? []).filter((m) => {
    if (!memberFilter) return true;
    return m.name.toLowerCase().includes(memberFilter.toLowerCase());
  });
  const daysInMonth = data?.daysInMonth ?? 30;

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dragStart, setDragStart] = useState<{ userId: string; day: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [cellMenu, setCellMenu] = useState<{
    x: number; y: number; userId: string; day: number; currentType: string | null;
  } | null>(null);
  const [bulkMenuOpen, setBulkMenuOpen] = useState(false);
  const [weekFillMenu, setWeekFillMenu] = useState<{ userId: string; x: number; y: number } | null>(null);

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: getGetFolgasGridQueryKey({ operationId, year, month }) });
  }, [qc, operationId, year, month]);

  const { mutate: toggleCell } = useToggleFolgaCell({
    mutation: {
      onSuccess: invalidate,
      onError: () => toast({ title: "Erro ao atualizar célula", variant: "destructive" }),
    },
  });

  const { mutate: bulkFill } = useBulkFillFolgas({
    mutation: {
      onSuccess: () => { invalidate(); setSelected(new Set()); setBulkMenuOpen(false); },
      onError: () => toast({ title: "Erro ao aplicar bulk", variant: "destructive" }),
    },
  });

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  function cellKey(userId: string, day: number) {
    return `${userId}:${day}`;
  }

  function handleCellMouseDown(e: React.MouseEvent, userId: string, day: number) {
    if (e.shiftKey) {
      const key = cellKey(userId, day);
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key); else next.add(key);
        return next;
      });
      return;
    }
    setDragStart({ userId, day });
    setIsDragging(false);
  }

  function handleCellMouseEnter(userId: string, day: number) {
    if (!dragStart) return;
    setIsDragging(true);
    const startMember = members.find((m) => m.userId === dragStart.userId);
    const endMember = members.find((m) => m.userId === userId);
    if (!startMember || !endMember) return;

    const startMemberIdx = members.indexOf(startMember);
    const endMemberIdx = members.indexOf(endMember);
    const minRow = Math.min(startMemberIdx, endMemberIdx);
    const maxRow = Math.max(startMemberIdx, endMemberIdx);
    const minDay = Math.min(dragStart.day, day);
    const maxDay = Math.max(dragStart.day, day);

    const newSelected = new Set<string>();
    for (let r = minRow; r <= maxRow; r++) {
      const m = members[r];
      if (!m) continue;
      for (let d = minDay; d <= maxDay; d++) {
        newSelected.add(cellKey(m.userId, d));
      }
    }
    setSelected(newSelected);
  }

  function handleCellMouseUp(e: React.MouseEvent, userId: string, day: number) {
    if (!dragStart) return;
    if (isDragging && selected.size > 1) {
      setBulkMenuOpen(true);
      setDragStart(null);
      setIsDragging(false);
      return;
    }
    setDragStart(null);
    setIsDragging(false);

    if (selected.size > 1) {
      setBulkMenuOpen(true);
      return;
    }

    const member = members.find((m) => m.userId === userId);
    const currentType = member?.days[String(day)] ?? null;
    setCellMenu({ x: e.clientX, y: e.clientY, userId, day, currentType });
    setSelected(new Set());
  }

  function handleCellSelect(type: GridType | null) {
    if (!cellMenu) return;
    toggleCell({
      data: {
        userId: cellMenu.userId,
        operationId,
        date: isoDate(year, month, cellMenu.day),
        type: type ?? undefined,
      },
    });
    setCellMenu(null);
  }

  function handleBulkSelect(type: GridType | null) {
    const byMember = new Map<string, number[]>();
    for (const key of selected) {
      const [uid, d] = key.split(":");
      if (!uid || !d) continue;
      if (!byMember.has(uid)) byMember.set(uid, []);
      byMember.get(uid)!.push(parseInt(d, 10));
    }
    byMember.forEach((days, uid) => {
      bulkFill({
        data: {
          userId: uid,
          operationId,
          dates: days.map((d) => isoDate(year, month, d)),
          type: type ?? undefined,
        },
      });
    });
  }

  function handleFillWeekClick(e: React.MouseEvent, userId: string) {
    e.stopPropagation();
    setWeekFillMenu({ userId, x: e.clientX, y: e.clientY });
  }

  function handleFillWeekTypeSelect(userId: string, type: GridType) {
    const weekDays = getWeekDays(year, month);
    bulkFill({
      data: {
        userId,
        operationId,
        dates: weekDays.map((d) => isoDate(year, month, d)),
        type,
      },
    });
    setWeekFillMenu(null);
  }

  useEffect(() => {
    function handleMouseUp() {
      if (isDragging && selected.size > 1) {
        setBulkMenuOpen(true);
      }
      setDragStart(null);
      setIsDragging(false);
    }
    document.addEventListener("mouseup", handleMouseUp);
    return () => document.removeEventListener("mouseup", handleMouseUp);
  }, [isDragging, selected.size]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!operationId) {
    return (
      <div className="text-center py-24 text-muted-foreground text-sm">
        Selecione uma operação para visualizar a grade.
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="text-center py-24 text-muted-foreground text-sm">
        Nenhum membro ativo nesta operação.
      </div>
    );
  }

  return (
    <div className="relative select-none">
      {isFetching && !isLoading && (
        <div className="absolute top-2 right-2 z-10">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-3 px-4 py-2 border-b bg-muted/20 flex-wrap">
        {GRID_TYPES.map((t) => (
          <div key={t.value} className="flex items-center gap-1.5">
            <span className={`inline-flex items-center justify-center w-6 h-5 rounded text-[10px] font-bold ${t.bg} ${t.text}`}>
              {t.abbr}
            </span>
            <span className="text-xs text-muted-foreground">{t.label}</span>
          </div>
        ))}
        <div className="ml-auto text-xs text-muted-foreground italic">
          Clique para editar · Arraste para selecionar múltiplas
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto">
        <table className="text-xs border-collapse" style={{ minWidth: "max-content" }}>
          <thead>
            <tr>
              <th className="sticky left-0 z-20 bg-white border-r border-b border-border px-3 py-2 text-left font-medium text-muted-foreground min-w-[150px] max-w-[200px]">
                Membro
              </th>
              {days.map((d) => {
                const weekend = isWeekend(year, month, d);
                const isToday = todayYear === year && todayMonth === month && todayDay === d;
                return (
                  <th
                    key={d}
                    className={`border-b border-r border-border px-1 py-1 text-center font-medium min-w-[36px] ${
                      weekend ? "bg-slate-50 text-slate-400" : "bg-white text-muted-foreground"
                    } ${isToday ? "bg-blue-50 text-blue-600 font-bold" : ""}`}
                  >
                    <div className="leading-none">{d}</div>
                    <div className="text-[9px] leading-tight opacity-70 mt-0.5">{getDayAbbr(year, month, d)}</div>
                  </th>
                );
              })}
              <th className="border-b border-l border-border px-3 py-2 text-left font-medium text-muted-foreground bg-white min-w-[120px]">
                Totais
              </th>
              <th className="border-b border-l border-border px-2 py-2 bg-white min-w-[80px]" />
            </tr>
          </thead>
          <tbody>
            {members.map((m, rowIdx) => (
              <tr key={m.userId} className={rowIdx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                <td className={`sticky left-0 z-10 border-r border-b border-border px-3 py-1.5 font-medium truncate max-w-[200px] ${
                  rowIdx % 2 === 0 ? "bg-white" : "bg-slate-50"
                }`}>
                  {m.name}
                </td>
                {days.map((d) => {
                  const type = m.days[String(d)];
                  const info = type ? ALL_TYPE_INFO[type] : null;
                  const key = cellKey(m.userId, d);
                  const isSelected = selected.has(key);
                  const weekend = isWeekend(year, month, d);
                  const isToday = todayYear === year && todayMonth === month && todayDay === d;

                  return (
                    <td
                      key={d}
                      className={`border-b border-r border-border text-center cursor-pointer transition-colors h-8 ${
                        weekend && !type ? "bg-slate-50/80" : ""
                      } ${isToday && !type ? "bg-blue-50/50" : ""} ${
                        isSelected ? "ring-2 ring-inset ring-primary bg-primary/10" : ""
                      } ${!isSelected ? "hover:bg-muted/30" : ""}`}
                      onMouseDown={(e) => handleCellMouseDown(e, m.userId, d)}
                      onMouseEnter={() => handleCellMouseEnter(m.userId, d)}
                      onMouseUp={(e) => handleCellMouseUp(e, m.userId, d)}
                    >
                      {info && (
                        <span className={`inline-flex items-center justify-center w-7 h-5 rounded text-[10px] font-bold ${info.bg} ${info.text}`}>
                          {info.abbr}
                        </span>
                      )}
                    </td>
                  );
                })}
                <td className="border-b border-l border-border px-3 py-1.5 whitespace-nowrap text-muted-foreground">
                  {GRID_TYPES.map((t) => {
                    const n = m.totals[t.value] ?? 0;
                    if (n === 0) return null;
                    return (
                      <span key={t.value} className={`inline-flex items-center gap-0.5 mr-1.5 ${t.text}`}>
                        <span className="font-bold">{t.abbr}:</span>{n}
                      </span>
                    );
                  })}
                  {Object.values(m.totals).every((v) => v === 0) && (
                    <span className="text-xs opacity-40">—</span>
                  )}
                </td>
                <td className="border-b border-l border-border px-2 py-1">
                  <button
                    className="text-[10px] text-muted-foreground hover:text-foreground whitespace-nowrap px-1.5 py-0.5 rounded hover:bg-muted transition-colors"
                    onClick={(e) => handleFillWeekClick(e, m.userId)}
                    title="Preencher semana visível"
                  >
                    + semana
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {cellMenu && (
        <CellMenu
          x={cellMenu.x}
          y={cellMenu.y}
          currentType={cellMenu.currentType}
          onSelect={handleCellSelect}
          onClose={() => setCellMenu(null)}
        />
      )}

      {bulkMenuOpen && (
        <BulkMenu
          count={selected.size}
          onSelect={handleBulkSelect}
          onClose={() => { setBulkMenuOpen(false); setSelected(new Set()); }}
        />
      )}

      {weekFillMenu && (
        <WeekFillMenu
          x={weekFillMenu.x}
          y={weekFillMenu.y}
          onSelect={(type) => handleFillWeekTypeSelect(weekFillMenu.userId, type)}
          onClose={() => setWeekFillMenu(null)}
        />
      )}
    </div>
  );
}

export { MONTH_NAMES };
