import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListShowBooks,
  useAssignShowBookResponsible,
  useGetShowBook,
  useListShowBookVersions,
  useCreateShowBook,
  useUpdateShowBook,
  useUpdateShowBookStatus,
  useDeleteShowBook,
  useCreateShowBookScene,
  useUpdateShowBookScene,
  useDeleteShowBookScene,
  useCreateShowBookBlock,
  useUpdateShowBookBlock,
  useDeleteShowBookBlock,
  useCreateShowBookPosition,
  useUpdateShowBookPosition,
  useDeleteShowBookPosition,
  useCreateShowBookLine,
  useUpdateShowBookLine,
  useDeleteShowBookLine,
  useListShowBookPositionRefs,
  useAddShowBookPositionRef,
  useDeleteShowBookPositionRef,
  useListLibraryDocuments,
  useListUsers,
  useGetOperations,
  getListShowBooksQueryKey,
  getGetShowBookQueryKey,
  getListShowBookVersionsQueryKey,
  getListShowBookPositionRefsQueryKey,
  getListLibraryDocumentsQueryKey,
  getListUsersQueryKey,
  useResolveShowBook,
} from "@workspace/api-client-react";
import type {
  ResolveResult,
  ResolvedScene,
  ResolvedLine,
} from "@workspace/api-client-react";
import type {
  ShowBook,
  ShowBookVersion,
  ShowBookPositionRefWithDoc,
  LibraryDocumentItem,
  User,
} from "@workspace/api-client-react";
import AdminLayout from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import {
  Plus, History, BookOpen, Layers, Settings, Trash2, Library,
  Pencil, Check, X, ChevronUp, ChevronDown, ChevronRight, LayoutGrid,
  Sliders, UserPlus, Star, CalendarCheck, AlertTriangle, UserCheck, Clock,
  Folder, FolderOpen,
} from "lucide-react";

const STATUS_LABELS: Record<string, string> = { DRAFT: "Rascunho", PUBLISHED: "Publicado", ARCHIVED: "Arquivado" };
const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  DRAFT: "secondary", PUBLISHED: "default", ARCHIVED: "outline",
};
const CHANGE_TYPE_LABELS: Record<string, string> = { STRUCTURAL: "Estrutural", CONFIG: "Configuração" };

const DOC_TYPE_LABELS: Record<string, string> = {
  OPERATIONAL_PROCEDURE: "Procedimento",
  RULES_AND_POLICIES: "Normas",
  CHARACTER_REFERENCE: "Personagem",
  COSTUME_REFERENCE: "Figurino",
  ONBOARDING_MATERIAL: "Onboarding",
  SAFETY_PROCEDURE: "Segurança",
};
const DOC_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Rascunho", PUBLISHED: "Publicado", UPDATED: "Atualizado", ARCHIVED: "Arquivado",
};
const DOC_STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  DRAFT: "secondary", PUBLISHED: "default", UPDATED: "default", ARCHIVED: "outline",
};

const LINE_TYPE_LABELS: Record<string, string> = {
  FIXED_PERSON: "Titular fixo",
  TITULAR_SUBSTITUTE: "Titular + substitutos",
  ROTATION: "Rodízio",
  DAY_OF_WEEK: "Por dia da semana",
  FUNCTION: "Por função",
  CHARACTER: "Por personagem",
  MANUAL: "Manual",
};
// Tipos de linha oferecidos ao montar/editar uma linha (modelo simplificado).
const SELECTABLE_LINE_TYPES = ["TITULAR_SUBSTITUTE", "ROTATION", "DAY_OF_WEEK"];
// Opções para um dropdown, incluindo o tipo atual da linha caso seja legado.
function lineTypeOptions(current?: string): { value: string; label: string }[] {
  const values = current && !SELECTABLE_LINE_TYPES.includes(current)
    ? [current, ...SELECTABLE_LINE_TYPES]
    : SELECTABLE_LINE_TYPES;
  return values.map((value) => ({ value, label: LINE_TYPE_LABELS[value] ?? value }));
}
const LINE_TYPE_COLORS: Record<string, string> = {
  ROTATION: "bg-purple-500/15 text-purple-600 dark:text-purple-300 border-purple-500/30",
  TITULAR_SUBSTITUTE: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30",
};
const DEFAULT_LINE_TYPE = "TITULAR_SUBSTITUTE";

// Tipos de linha que possuem configuração editável
const CONFIGURABLE_TYPES = new Set([
  "FIXED_PERSON", "TITULAR_SUBSTITUTE", "ROTATION", "DAY_OF_WEEK", "FUNCTION", "CHARACTER",
]);

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

type LineConfig = {
  userId?: string | null;
  titularId?: string | null;
  substituteIds?: string[];
  memberIds?: string[];
  executionCounts?: Record<string, number>;
  days?: number[];
  dayAssignments?: Record<string, string>;
  functionLabel?: string;
  characterName?: string;
  fixedForDay?: boolean;
};

type Member = { id: string; name: string };

function memberName(members: Member[], id?: string | null): string {
  if (!id) return "";
  return members.find((m) => m.id === id)?.name ?? "(membro removido)";
}

// Resumo legível da config (mostrado no cabeçalho da linha)
function configSummary(type: string, config: LineConfig, members: Member[]): string {
  switch (type) {
    case "FIXED_PERSON":
      return config.userId ? memberName(members, config.userId) : "sem titular";
    case "TITULAR_SUBSTITUTE": {
      const tit = config.titularId ? memberName(members, config.titularId) : "—";
      const subs = (config.substituteIds ?? []).length;
      return `${tit}${subs ? ` +${subs} subst.` : ""}`;
    }
    case "ROTATION": {
      const n = (config.memberIds ?? []).length;
      return n ? `${n} no rodízio` : "sem pessoas";
    }
    case "DAY_OF_WEEK": {
      const assignments = config.dayAssignments ?? {};
      const entries = Object.entries(assignments).filter(([, id]) => !!id);
      if (entries.length > 0) {
        return entries
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([d, id]) => `${WEEKDAY_LABELS[Number(d)]}: ${memberName(members, id)}`)
          .join(", ");
      }
      // Compat: linhas antigas que só tinham dias (sem pessoas)
      const days = config.days ?? [];
      return days.length ? days.slice().sort((a, b) => a - b).map((d) => WEEKDAY_LABELS[d]).join(", ") : "sem dias";
    }
    case "FUNCTION":
      return config.functionLabel?.trim() || "sem função";
    case "CHARACTER":
      return config.characterName?.trim() || "sem personagem";
    default:
      return "";
  }
}

function configIncomplete(type: string, config: LineConfig): boolean {
  switch (type) {
    case "FIXED_PERSON": return !config.userId;
    case "TITULAR_SUBSTITUTE": return !config.titularId;
    case "ROTATION": return (config.memberIds ?? []).length < 2;
    case "DAY_OF_WEEK":
      return Object.values(config.dayAssignments ?? {}).filter(Boolean).length === 0
        && (config.days ?? []).length === 0;
    case "FUNCTION": return !config.functionLabel?.trim();
    case "CHARACTER": return !config.characterName?.trim();
    default: return false;
  }
}

// Seletor de uma pessoa
function PersonPicker({
  value, members, onChange, placeholder = "Selecionar pessoa",
}: { value?: string | null; members: Member[]; onChange: (id: string | null) => void; placeholder?: string }) {
  return (
    <Select value={value ?? "__none"} onValueChange={(v) => onChange(v === "__none" ? null : v)}>
      <SelectTrigger className="h-7 text-xs w-56"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        <SelectItem value="__none" className="text-xs text-muted-foreground">Ninguém</SelectItem>
        {members.map((m) => (
          <SelectItem key={m.id} value={m.id} className="text-xs">{m.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Lista ordenável de pessoas (rodízio / substitutos)
function PeopleOrderedList({
  ids, members, onChange, ordered = true,
}: { ids: string[]; members: Member[]; onChange: (ids: string[]) => void; ordered?: boolean }) {
  const available = members.filter((m) => !ids.includes(m.id));
  const move = (i: number, dir: -1 | 1) => {
    const t = i + dir;
    if (t < 0 || t >= ids.length) return;
    const next = ids.slice();
    [next[i], next[t]] = [next[t]!, next[i]!];
    onChange(next);
  };
  return (
    <div className="flex flex-col gap-1">
      {ids.length === 0 && <p className="text-[11px] text-muted-foreground">Nenhuma pessoa adicionada.</p>}
      {ids.map((id, i) => (
        <div key={id} className="flex items-center gap-1.5 text-xs">
          {ordered && (
            <span className="w-4 text-right text-[10px] text-muted-foreground tabular-nums">{i + 1}.</span>
          )}
          <span className="flex-1 truncate">{memberName(members, id)}</span>
          {ordered && (
            <ReorderButtons
              onUp={() => move(i, -1)}
              onDown={() => move(i, 1)}
              canUp={i > 0}
              canDown={i < ids.length - 1}
            />
          )}
          <button
            onClick={() => onChange(ids.filter((x) => x !== id))}
            className="p-0.5 text-muted-foreground hover:text-destructive"
            title="Remover"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      {available.length > 0 && (
        <Select value="__add" onValueChange={(v) => { if (v !== "__add") onChange([...ids, v]); }}>
          <SelectTrigger className="h-7 text-xs w-56 mt-0.5">
            <span className="flex items-center gap-1 text-muted-foreground"><UserPlus className="h-3 w-3" /> Adicionar pessoa</span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__add" className="text-xs text-muted-foreground" disabled>Adicionar pessoa</SelectItem>
            {available.map((m) => (
              <SelectItem key={m.id} value={m.id} className="text-xs">{m.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

// Atribuição de pessoa por dia da semana
function WeekdayPeoplePicker({
  assignments, members, onChange,
}: { assignments: Record<string, string>; members: Member[]; onChange: (next: Record<string, string>) => void }) {
  const setDay = (d: number, id: string | null) => {
    const next = { ...assignments };
    if (id) next[String(d)] = id;
    else delete next[String(d)];
    onChange(next);
  };
  return (
    <div className="flex flex-col gap-1.5">
      {WEEKDAY_LABELS.map((label, d) => (
        <div key={d} className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground w-9">{label}</span>
          <PersonPicker
            value={assignments[String(d)] ?? null}
            members={members}
            onChange={(id) => setDay(d, id)}
            placeholder="— ninguém"
          />
        </div>
      ))}
    </div>
  );
}

// Campo de texto com commit no blur (função / personagem)
function ConfigTextField({
  value, placeholder, onSave,
}: { value: string; placeholder: string; onSave: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  return (
    <Input
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { if (draft.trim() !== value) onSave(draft.trim()); }}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      className="h-7 text-xs w-64"
    />
  );
}

// Editor de configuração da linha conforme o tipo
function LineConfigEditor({
  type, config, members, onSave,
}: { type: string; config: LineConfig; members: Member[]; onSave: (config: LineConfig) => void }) {
  switch (type) {
    case "FIXED_PERSON":
      return (
        <div className="flex items-center gap-2">
          <Label className="text-[11px] text-muted-foreground w-16">Titular</Label>
          <PersonPicker value={config.userId} members={members} onChange={(id) => onSave({ ...config, userId: id })} />
        </div>
      );
    case "TITULAR_SUBSTITUTE":
      return (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Label className="text-[11px] text-muted-foreground w-16 flex items-center gap-1"><Star className="h-3 w-3" /> Titular</Label>
            <PersonPicker value={config.titularId} members={members} onChange={(id) => onSave({ ...config, titularId: id })} />
          </div>
          <div className="flex items-start gap-2">
            <Label className="text-[11px] text-muted-foreground w-16 pt-1">Substitutos</Label>
            <PeopleOrderedList
              ids={config.substituteIds ?? []}
              members={members.filter((m) => m.id !== config.titularId)}
              onChange={(ids) => onSave({ ...config, substituteIds: ids })}
            />
          </div>
        </div>
      );
    case "ROTATION":
      return (
        <div className="flex flex-col gap-2">
          <div className="flex items-start gap-2">
            <Label className="text-[11px] text-muted-foreground w-16 pt-1">Ordem</Label>
            <PeopleOrderedList
              ids={config.memberIds ?? []}
              members={members}
              onChange={(ids) => onSave({ ...config, memberIds: ids, executionCounts: config.executionCounts ?? {} })}
            />
          </div>
          <label className="flex items-center gap-2 pl-[4.5rem] text-[11px] text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 accent-primary"
              checked={config.fixedForDay !== false}
              onChange={(e) => onSave({ ...config, fixedForDay: e.target.checked })}
            />
            Fixo do dia (mesma pessoa em todos os shows do dia)
          </label>
        </div>
      );
    case "DAY_OF_WEEK":
      return (
        <div className="flex items-start gap-2">
          <Label className="text-[11px] text-muted-foreground w-16 pt-1">Por dia</Label>
          <WeekdayPeoplePicker
            assignments={config.dayAssignments ?? {}}
            members={members}
            onChange={(dayAssignments) =>
              onSave({
                ...config,
                dayAssignments,
                days: Object.keys(dayAssignments).map(Number).sort((a, b) => a - b),
              })
            }
          />
        </div>
      );
    case "FUNCTION":
      return (
        <div className="flex items-center gap-2">
          <Label className="text-[11px] text-muted-foreground w-16">Função</Label>
          <ConfigTextField value={config.functionLabel ?? ""} placeholder="Ex.: Operador de luz" onSave={(v) => onSave({ ...config, functionLabel: v })} />
        </div>
      );
    case "CHARACTER":
      return (
        <div className="flex items-center gap-2">
          <Label className="text-[11px] text-muted-foreground w-16">Personagem</Label>
          <ConfigTextField value={config.characterName ?? ""} placeholder="Ex.: Palhaço" onSave={(v) => onSave({ ...config, characterName: v })} />
        </div>
      );
    default:
      return null;
  }
}

// ── Editable inline text ──────────────────────────────────────────────────────
function EditableName({
  value, onSave, className = "", placeholder, disabled,
}: {
  value: string; onSave: (v: string) => void; className?: string; placeholder?: string; disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (disabled) return <span className={className}>{value}</span>;

  if (editing) {
    const commit = () => {
      const trimmed = draft.trim();
      if (trimmed && trimmed !== value) onSave(trimmed);
      setEditing(false);
    };
    return (
      <span className="flex items-center gap-1">
        <Input
          autoFocus
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") { setDraft(value); setEditing(false); }
          }}
          className="h-7 text-sm py-0"
        />
        <button onClick={commit} className="p-0.5 text-emerald-600 hover:opacity-70" title="Salvar">
          <Check className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => { setDraft(value); setEditing(false); }} className="p-0.5 text-muted-foreground hover:opacity-70" title="Cancelar">
          <X className="h-3.5 w-3.5" />
        </button>
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1 group/name">
      <button
        type="button"
        onClick={() => { setDraft(value); setEditing(true); }}
        className={`text-left rounded-sm hover:text-primary hover:underline decoration-dotted underline-offset-2 ${className}`}
        title="Clique para renomear"
      >
        {value}
      </button>
      <button
        type="button"
        onClick={() => { setDraft(value); setEditing(true); }}
        className="shrink-0 p-0.5 text-muted-foreground/60 hover:text-primary"
        title="Renomear"
      >
        <Pencil className="h-3 w-3" />
      </button>
    </span>
  );
}

// ── Reorder arrows ────────────────────────────────────────────────────────────
function ReorderButtons({
  onUp, onDown, canUp, canDown,
}: { onUp: () => void; onDown: () => void; canUp: boolean; canDown: boolean }) {
  return (
    <div className="flex flex-col">
      <button onClick={onUp} disabled={!canUp} className="p-0 disabled:opacity-20 text-muted-foreground hover:text-foreground" title="Mover para cima">
        <ChevronUp className="h-3.5 w-3.5" />
      </button>
      <button onClick={onDown} disabled={!canDown} className="p-0 disabled:opacity-20 text-muted-foreground hover:text-foreground" title="Mover para baixo">
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

type Actions = {
  isAdmin: boolean;
  members: Member[];
  updateScene: (sceneId: string, name: string) => void;
  deleteScene: (sceneId: string) => void;
  addBlock: (sceneId: string, name: string) => void;
  updateBlock: (blockId: string, name: string) => void;
  deleteBlock: (blockId: string) => void;
  addLine: (blockId: string, name: string, type: string) => void;
  updatePositionName: (positionId: string, name: string) => void;
  updatePositionCoverage: (positionId: string, coverage: number) => void;
  setLineType: (positionId: string, lineId: string | null, type: string) => void;
  updateLineConfig: (lineId: string, config: LineConfig) => void;
  deletePosition: (positionId: string) => void;
  reorder: (kind: "scene" | "block" | "position", items: any[], index: number, dir: "up" | "down") => void;
  openRefs: (positionId: string, name: string) => void;
};

// ── Single line (= posição + sua linha de tipo) ───────────────────────────────
function LineRow({
  pos, siblings, index, actions,
}: { pos: any; siblings: any[]; index: number; actions: Actions }) {
  const line = pos.lines?.[0];
  const type = line?.type ?? DEFAULT_LINE_TYPE;
  const config: LineConfig = (line?.config ?? {}) as LineConfig;
  const refCount = pos.refsCount ?? 0;
  const [coverage, setCoverage] = useState(String(pos.minimumCoverage ?? 1));
  const [configOpen, setConfigOpen] = useState(false);

  const hasConfig = CONFIGURABLE_TYPES.has(type);
  const incomplete = hasConfig && configIncomplete(type, config);
  const summary = hasConfig ? configSummary(type, config, actions.members) : "";

  const commitCoverage = () => {
    const n = parseInt(coverage, 10);
    if (!isNaN(n) && n >= 1 && n !== pos.minimumCoverage) actions.updatePositionCoverage(pos.id, n);
    else setCoverage(String(pos.minimumCoverage ?? 1));
  };

  return (
    <div className="rounded hover:bg-muted/40 group">
      <div className="flex items-center gap-2 py-1.5 px-2">
        <EditableName
          value={pos.name}
          onSave={(v) => actions.updatePositionName(pos.id, v)}
          className="text-sm font-medium"
          disabled={!actions.isAdmin}
        />
        {actions.isAdmin ? (
          <Select value={type} onValueChange={(v) => actions.setLineType(pos.id, line?.id ?? null, v)}>
            <SelectTrigger className={`h-6 text-[11px] px-2 w-auto gap-1 border ${LINE_TYPE_COLORS[type] ?? ""}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {lineTypeOptions(type).map((o) => (
                <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Badge variant="outline" className={`text-[10px] ${LINE_TYPE_COLORS[type] ?? ""}`}>
            {LINE_TYPE_LABELS[type] ?? type}
          </Badge>
        )}

        {/* Botão de configuração / resumo */}
        {hasConfig && (
          actions.isAdmin && line?.id ? (
            <button
              onClick={() => setConfigOpen((o) => !o)}
              className={`flex items-center gap-1 h-6 px-1.5 rounded border text-[11px] transition-colors ${
                incomplete
                  ? "border-amber-500/40 text-amber-600 dark:text-amber-300 bg-amber-500/10"
                  : "border-border text-muted-foreground hover:bg-muted/60"
              }`}
              title="Configurar linha"
            >
              <Sliders className="h-3 w-3" />
              <span className="max-w-[160px] truncate">{summary}</span>
            </button>
          ) : (
            <span className="text-[11px] text-muted-foreground truncate max-w-[200px]">{summary}</span>
          )
        )}

        {actions.isAdmin ? (
          <div className="flex items-center gap-1">
            <Input
              type="number"
              min={1}
              value={coverage}
              onChange={(e) => setCoverage(e.target.value)}
              onBlur={commitCoverage}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
              className="h-6 w-14 text-[11px] px-1 py-0 text-center"
            />
            <span className="text-[11px] text-muted-foreground">pessoas</span>
          </div>
        ) : (
          <span className="text-[11px] text-muted-foreground">{pos.minimumCoverage} pessoas</span>
        )}

        <div className="flex-1" />

        {refCount > 0 && (
          <span className="flex items-center gap-0.5 text-[11px] text-primary">
            <Library className="h-3 w-3" /> {refCount}
          </span>
        )}

        {actions.isAdmin && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
            <ReorderButtons
              onUp={() => actions.reorder("position", siblings, index, "up")}
              onDown={() => actions.reorder("position", siblings, index, "down")}
              canUp={index > 0}
              canDown={index < siblings.length - 1}
            />
            <button onClick={() => actions.openRefs(pos.id, pos.name)} className="p-0.5 text-muted-foreground hover:text-primary" title="Referências oficiais">
              <Library className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => actions.deletePosition(pos.id)} className="p-0.5 text-muted-foreground hover:text-destructive" title="Remover linha">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Editor de configuração inline */}
      {actions.isAdmin && hasConfig && configOpen && line?.id && (
        <div className="mx-2 mb-2 ml-6 px-3 py-2.5 rounded-lg border bg-muted/20 flex flex-col gap-2">
          <LineConfigEditor
            type={type}
            config={config}
            members={actions.members}
            onSave={(c) => actions.updateLineConfig(line.id, c)}
          />
        </div>
      )}
    </div>
  );
}

// ── Editor de horário único do show ───────────────────────────────────────────
function ShowTimeEditor({
  startTime, endTime, disabled, onSave,
}: {
  startTime: string | null; endTime: string | null; disabled: boolean;
  onSave: (s: string | null, e: string | null) => void;
}) {
  const [start, setStart] = useState<string>(startTime ?? "");
  const [end, setEnd] = useState<string>(endTime ?? "");
  useEffect(() => { setStart(startTime ?? ""); }, [startTime]);
  useEffect(() => { setEnd(endTime ?? ""); }, [endTime]);
  const save = (s: string, e: string) => {
    if ((s || null) === (startTime ?? null) && (e || null) === (endTime ?? null)) return;
    onSave(s || null, e || null);
  };
  return (
    <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
      <Clock className="h-3.5 w-3.5" />
      <span>Horário do show:</span>
      <input
        type="time"
        value={start}
        disabled={disabled}
        onChange={(e) => setStart(e.target.value)}
        onBlur={() => save(start, end)}
        className="h-7 w-[80px] rounded border bg-background px-1.5 text-xs disabled:opacity-60"
        title="Hora de início"
      />
      <span>–</span>
      <input
        type="time"
        value={end}
        disabled={disabled}
        onChange={(e) => setEnd(e.target.value)}
        onBlur={() => save(start, end)}
        className="h-7 w-[80px] rounded border bg-background px-1.5 text-xs disabled:opacity-60"
        title="Hora de fim"
      />
    </div>
  );
}

// ── Block (= bloco com suas linhas) ───────────────────────────────────────────
function BlockCard({
  block, siblings, index, actions,
}: { block: any; siblings: any[]; index: number; actions: Actions }) {
  const positions: any[] = block.positions ?? [];
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState(DEFAULT_LINE_TYPE);

  const addLine = () => {
    if (!newName.trim()) return;
    actions.addLine(block.id, newName.trim(), newType);
    setNewName("");
  };

  return (
    <div className="border rounded-lg bg-card">
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30 rounded-t-lg">
        <Layers className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <EditableName
          value={block.name}
          onSave={(v) => actions.updateBlock(block.id, v)}
          className="text-sm font-semibold"
          disabled={!actions.isAdmin}
        />
        <Badge variant="secondary" className="text-[10px]">
          {positions.length} {positions.length === 1 ? "linha" : "linhas"}
        </Badge>
        <div className="flex-1" />
        {actions.isAdmin && (
          <div className="flex items-center gap-0.5">
            <ReorderButtons
              onUp={() => actions.reorder("block", siblings, index, "up")}
              onDown={() => actions.reorder("block", siblings, index, "down")}
              canUp={index > 0}
              canDown={index < siblings.length - 1}
            />
            <button onClick={() => actions.deleteBlock(block.id)} className="p-0.5 text-muted-foreground hover:text-destructive" title="Remover bloco">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      <div className="px-2 py-1.5">
        {positions.length === 0 && (
          <p className="text-xs text-muted-foreground px-2 py-1.5">Nenhuma linha neste bloco ainda.</p>
        )}
        {positions.map((pos, i) => (
          <LineRow key={pos.id} pos={pos} siblings={positions} index={i} actions={actions} />
        ))}

        {actions.isAdmin && (
          <div className="flex items-center gap-2 mt-1.5 px-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addLine(); }}
              placeholder="Nova linha (ex.: Personagem A)"
              className="h-8 text-sm flex-1"
            />
            <Select value={newType} onValueChange={setNewType}>
              <SelectTrigger className="h-8 text-xs w-44 shrink-0"><SelectValue /></SelectTrigger>
              <SelectContent>
                {lineTypeOptions(newType).map((o) => (
                  <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" className="h-8 px-2 shrink-0" onClick={addLine} disabled={!newName.trim()}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Scene (= cena com seus blocos) ────────────────────────────────────────────
function SceneCard({
  scene, siblings, index, actions,
}: { scene: any; siblings: any[]; index: number; actions: Actions }) {
  const blocks: any[] = scene.blocks ?? [];
  const [newBlock, setNewBlock] = useState("");

  const addBlock = () => {
    if (!newBlock.trim()) return;
    actions.addBlock(scene.id, newBlock.trim());
    setNewBlock("");
  };

  return (
    <div className="border rounded-lg bg-muted/10">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b">
        <LayoutGrid className="h-4 w-4 text-primary shrink-0" />
        <EditableName
          value={scene.name}
          onSave={(v) => actions.updateScene?.(scene.id, v)}
          className="text-base font-semibold"
          disabled={!actions.isAdmin}
        />
        {scene.isOptional && <span className="text-[10px] text-muted-foreground">opcional</span>}
        <div className="flex-1" />
        {actions.isAdmin && (
          <div className="flex items-center gap-0.5">
            <ReorderButtons
              onUp={() => actions.reorder("scene", siblings, index, "up")}
              onDown={() => actions.reorder("scene", siblings, index, "down")}
              canUp={index > 0}
              canDown={index < siblings.length - 1}
            />
            <button onClick={() => actions.deleteScene?.(scene.id)} className="p-0.5 text-muted-foreground hover:text-destructive" title="Remover cena">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      <div className="p-3 flex flex-col gap-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Layers className="h-3.5 w-3.5" /> Construtor de Blocos
          <span className="ml-auto">{blocks.length} {blocks.length === 1 ? "bloco" : "blocos"}</span>
        </div>
        {blocks.map((block, i) => (
          <BlockCard key={block.id} block={block} siblings={blocks} index={i} actions={actions} />
        ))}

        {actions.isAdmin && (
          <div className="flex items-center gap-2 mt-1">
            <Input
              value={newBlock}
              onChange={(e) => setNewBlock(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addBlock(); }}
              placeholder="Nome do bloco (ex.: Abertura, Cena Principal...)"
              className="h-8 text-sm flex-1"
            />
            <Button size="sm" variant="outline" className="h-8 shrink-0" onClick={addBlock} disabled={!newBlock.trim()}>
              <Plus className="h-4 w-4 mr-1" /> Bloco
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function ResolveLineRow({ line }: { line: ResolvedLine }) {
  const isUncovered = line.status === "UNCOVERED";
  const isInactive = line.status === "INACTIVE";
  return (
    <div className="flex items-start justify-between gap-2 text-sm py-1">
      <div className="flex items-center gap-2 min-w-0">
        {isUncovered ? (
          <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
        ) : isInactive ? (
          <X className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        ) : (
          <UserCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
        )}
        <span className={isInactive ? "text-muted-foreground" : ""}>
          {line.people.length > 0
            ? line.people.map((p) => p.name).join(", ")
            : isUncovered
              ? "Sem cobertura"
              : line.note ?? "—"}
        </span>
        {line.fixedForDay && line.people.length > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30 shrink-0">
            Fixo do dia
          </span>
        )}
      </div>
      {line.note && line.people.length > 0 && (
        <span className="text-xs text-muted-foreground shrink-0">{line.note}</span>
      )}
    </div>
  );
}

function ResolveSceneView({ scene }: { scene: ResolvedScene }) {
  return (
    <div className="border rounded-lg p-3">
      <h4 className="text-sm font-semibold mb-2">{scene.name}</h4>
      <div className="flex flex-col gap-3">
        {scene.blocks.map((block) => (
          <div key={block.blockId}>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              {block.name}
            </p>
            <div className="flex flex-col gap-2 pl-2">
              {block.positions.map((pos) => (
                <div key={pos.positionId}>
                  <p className="text-xs font-medium">{pos.name}</p>
                  <div className="pl-2">
                    {pos.lines.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-1">Sem linhas configuradas</p>
                    ) : (
                      pos.lines.map((line) => <ResolveLineRow key={line.lineId} line={line} />)
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ShowBookPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const auth = useAuth();
  const isAdmin = auth.roles.some((r) => ["ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"].includes(r.role));
  const isFullAdmin = auth.roles.some((r) => r.role === "ADMIN");

  const MANAGER_ROLES = ["ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"];
  const myOperationIds = Array.from(
    new Set(
      auth.roles
        .filter((r) => MANAGER_ROLES.includes(r.role) && r.operationId)
        .map((r) => r.operationId as string)
    )
  );
  const { data: operationsData } = useGetOperations();
  // Operações em que o gestor pode CRIAR livros: admin total vê todas as
  // operações da org; gestor não-admin vê só onde tem papel de gestão.
  const allOperations = operationsData?.operations ?? [];
  const manageableOperations = isFullAdmin
    ? allOperations
    : allOperations.filter((o) => myOperationIds.includes(o.id));
  const operationNameById = new Map(allOperations.map((o) => [o.id, o.name]));

  // Busca TODOS os livros visíveis (sem filtrar por operação) para os agrupar
  // em pastas por operação. O backend já aplica o escopo de leitura por ator.
  const { data: listData, isLoading } = useListShowBooks(undefined, {
    query: { queryKey: getListShowBooksQueryKey() },
  });
  const books: ShowBook[] = listData?.showBooks ?? [];
  const currentUserId = auth.user?.id ?? null;
  // Admin total vê todos os shows; gestor não-admin vê só os shows pelos quais é
  // responsável + os sem responsável (comportamento legado por operação).
  const visibleBooks: ShowBook[] = isFullAdmin
    ? books
    : books.filter((b) => !b.responsibleId || b.responsibleId === currentUserId);

  // Agrupa os livros em pastas por operação. Cada pasta usa o nome da operação
  // (ou "Operação" como fallback se a operação não estiver acessível).
  const bookFolders = (() => {
    const byOp = new Map<string, ShowBook[]>();
    for (const b of visibleBooks) {
      const arr = byOp.get(b.operationId) ?? [];
      arr.push(b);
      byOp.set(b.operationId, arr);
    }
    return Array.from(byOp.entries())
      .map(([opId, opBooks]) => ({
        opId,
        opName: operationNameById.get(opId) ?? "Operação",
        books: [...opBooks].sort((a, b) => a.title.localeCompare(b.title, "pt")),
      }))
      .sort((a, b) => a.opName.localeCompare(b.opName, "pt"));
  })();

  const [collapsedOps, setCollapsedOps] = useState<Set<string>>(new Set());
  const toggleFolder = (opId: string) =>
    setCollapsedOps((prev) => {
      const next = new Set(prev);
      if (next.has(opId)) next.delete(opId);
      else next.add(opId);
      return next;
    });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedPositionId, setSelectedPositionId] = useState<string | null>(null);
  const [selectedPositionName, setSelectedPositionName] = useState<string>("");
  const [refsSheetOpen, setRefsSheetOpen] = useState(false);
  const [refSearchQuery, setRefSearchQuery] = useState("");
  const [newSceneName, setNewSceneName] = useState("");
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolveDate, setResolveDate] = useState(() => new Date().toISOString().slice(0, 10));

  const { data: bookData } = useGetShowBook(selectedId ?? "", {
    query: { enabled: !!selectedId, queryKey: getGetShowBookQueryKey(selectedId ?? "") },
  });
  const selectedBook = bookData?.showBook;

  const { data: usersData } = useListUsers({
    query: { enabled: !!selectedId && isAdmin, queryKey: getListUsersQueryKey() },
  });
  const members: Member[] = ((usersData?.users ?? []) as User[])
    .filter((u) => u.status === "ACTIVE")
    .map((u) => ({ id: u.id, name: u.name }));

  // O responsável de um show tem de ser supervisor (A/B) da operação do show.
  // Mostrar só candidatos elegíveis evita atribuir um membro por engano (o
  // backend rejeita, mas filtrar a lista previne a confusão na origem).
  const responsibleOperationId = selectedBook?.operationId;
  const eligibleResponsibles: Member[] = ((usersData?.users ?? []) as User[])
    .filter((u) => u.status === "ACTIVE")
    .filter((u) =>
      responsibleOperationId
        ? (u.supervisorOperationIds ?? []).includes(responsibleOperationId)
        : false,
    )
    .map((u) => ({ id: u.id, name: u.name }));

  const { data: versionsData } = useListShowBookVersions(selectedId ?? "", {
    query: { enabled: !!selectedId && versionsOpen, queryKey: getListShowBookVersionsQueryKey(selectedId ?? "") },
  });
  const versions: ShowBookVersion[] = versionsData?.versions ?? [];

  const { data: resolution, isLoading: resolveLoading } = useResolveShowBook(
    selectedId ?? "",
    resolveDate,
    { query: { enabled: !!selectedId && resolveOpen && !!resolveDate } }
  );

  const { data: refsData, isLoading: refsLoading } = useListShowBookPositionRefs(
    selectedId ?? "",
    selectedPositionId ?? "",
    {
      query: {
        enabled: !!selectedId && !!selectedPositionId && refsSheetOpen,
        queryKey: getListShowBookPositionRefsQueryKey(selectedId ?? "", selectedPositionId ?? ""),
      },
    }
  );
  const refs: ShowBookPositionRefWithDoc[] = refsData?.refs ?? [];
  const linkedDocIds = new Set(refs.map((r) => r.documentId));

  const libDocsParams = { q: refSearchQuery || undefined };
  const { data: libDocsData } = useListLibraryDocuments(
    libDocsParams,
    { query: { enabled: refsSheetOpen && isAdmin, queryKey: getListLibraryDocumentsQueryKey(libDocsParams) } }
  );
  const libDocs: LibraryDocumentItem[] = libDocsData?.documents ?? [];
  const availableDocs = libDocs.filter(
    (d) => !linkedDocIds.has(d.id) && (d.status === "PUBLISHED" || d.status === "UPDATED")
  );

  const createMutation = useCreateShowBook();
  const statusMutation = useUpdateShowBookStatus();
  const deleteMutation = useDeleteShowBook();
  const createSceneMutation = useCreateShowBookScene();
  const updateBookMutation = useUpdateShowBook();
  const updateSceneMutation = useUpdateShowBookScene();
  const deleteSceneMutation = useDeleteShowBookScene();
  const createBlockMutation = useCreateShowBookBlock();
  const updateBlockMutation = useUpdateShowBookBlock();
  const deleteBlockMutation = useDeleteShowBookBlock();
  const createPositionMutation = useCreateShowBookPosition();
  const updatePositionMutation = useUpdateShowBookPosition();
  const deletePositionMutation = useDeleteShowBookPosition();
  const createLineMutation = useCreateShowBookLine();
  const updateLineMutation = useUpdateShowBookLine();
  const deleteLineMutation = useDeleteShowBookLine();
  const addRefMutation = useAddShowBookPositionRef();
  const deleteRefMutation = useDeleteShowBookPositionRef();
  const assignResponsibleMutation = useAssignShowBookResponsible();

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getListShowBooksQueryKey() });
    if (selectedId) queryClient.invalidateQueries({ queryKey: getGetShowBookQueryKey(selectedId) });
  };

  const invalidateRefs = () => {
    if (selectedId && selectedPositionId) {
      queryClient.invalidateQueries({
        queryKey: getListShowBookPositionRefsQueryKey(selectedId, selectedPositionId),
      });
    }
  };

  const [createForm, setCreateForm] = useState({ title: "", description: "" });
  const [createOpId, setCreateOpId] = useState<string>("");
  const openCreate = (opId?: string) => {
    setCreateOpId(opId ?? manageableOperations[0]?.id ?? "");
    setCreateForm({ title: "", description: "" });
    setCreateOpen(true);
  };
  const [statusForm, setStatusForm] = useState({ status: "PUBLISHED", reason: "" });

  const failToast = (msg: string) => toast({ title: msg, variant: "destructive" });

  const handleAssignResponsible = (val: string) => {
    if (!selectedId) return;
    const responsibleId = val === "__none__" ? null : val;
    assignResponsibleMutation.mutate(
      { id: selectedId, responsibleId },
      {
        onSuccess: () => { toast({ title: "Responsável atualizado" }); invalidateAll(); },
        onError: () => failToast("Erro ao definir responsável"),
      }
    );
  };

  const handleCreate = () => {
    if (!createOpId) { failToast("Selecione uma operação"); return; }
    if (!createForm.title.trim()) { failToast("Título obrigatório"); return; }
    createMutation.mutate(
      { data: { operationId: createOpId, title: createForm.title.trim(), description: createForm.description || undefined, type: "STRUCTURED" } },
      {
        onSuccess: (data) => {
          toast({ title: "Livro criado com sucesso" });
          setCreateOpen(false);
          setCreateForm({ title: "", description: "" });
          invalidateAll();
          setSelectedId(data.showBook.id);
        },
        onError: () => failToast("Erro ao criar livro"),
      }
    );
  };

  const handleStatus = () => {
    if (!selectedId || !statusForm.reason) { failToast("Motivo obrigatório"); return; }
    statusMutation.mutate(
      { id: selectedId, data: { status: statusForm.status as any, reason: statusForm.reason } },
      {
        onSuccess: () => { toast({ title: "Status atualizado" }); setStatusOpen(false); invalidateAll(); },
        onError: () => failToast("Erro ao atualizar status"),
      }
    );
  };

  const handleDelete = () => {
    if (!selectedId) return;
    deleteMutation.mutate(
      { id: selectedId },
      {
        onSuccess: () => {
          toast({ title: "Livro apagado" });
          setDeleteOpen(false);
          setSelectedId(null);
          invalidateAll();
        },
        onError: (err: any) => {
          const msg = err?.error ?? err?.response?.data?.error ?? "Erro ao apagar o livro";
          failToast(msg);
        },
      }
    );
  };

  // ── Builder actions ─────────────────────────────────────────────────────────
  const addScene = () => {
    if (!selectedId || !newSceneName.trim()) return;
    const order = (selectedBook?.scenes?.length ?? 0) + 1;
    createSceneMutation.mutate(
      { id: selectedId, data: { name: newSceneName.trim(), order } },
      {
        onSuccess: () => { setNewSceneName(""); invalidateAll(); },
        onError: () => failToast("Erro ao adicionar cena"),
      }
    );
  };

  const renameBook = (title: string) => {
    if (!selectedId) return;
    updateBookMutation.mutate(
      { id: selectedId, data: { title, reason: "Renomeação" } },
      {
        onSuccess: () => { toast({ title: "Nome atualizado" }); invalidateAll(); },
        onError: () => failToast("Erro ao renomear livro"),
      }
    );
  };

  const updateShowTime = (startTime: string | null, endTime: string | null) => {
    if (!selectedId) return;
    updateBookMutation.mutate(
      { id: selectedId, data: { startTime, endTime, reason: "Horário do show" } },
      {
        onSuccess: () => { toast({ title: "Horário atualizado" }); invalidateAll(); },
        onError: () => failToast("Erro ao atualizar horário"),
      }
    );
  };

  const updateScene = (sceneId: string, name: string) => {
    if (!selectedId) return;
    updateSceneMutation.mutate(
      { id: selectedId, sceneId, data: { name } },
      { onSuccess: invalidateAll, onError: () => failToast("Erro ao renomear cena") }
    );
  };

  const deleteScene = (sceneId: string) => {
    if (!selectedId) return;
    deleteSceneMutation.mutate(
      { id: selectedId, sceneId, data: {} },
      { onSuccess: () => { toast({ title: "Cena removida" }); invalidateAll(); }, onError: () => failToast("Erro ao remover cena") }
    );
  };

  const addBlock = (sceneId: string, name: string) => {
    if (!selectedId) return;
    const scene = selectedBook?.scenes?.find((s: any) => s.id === sceneId);
    const order = (scene?.blocks?.length ?? 0) + 1;
    createBlockMutation.mutate(
      { id: selectedId, data: { name, order, sceneId } },
      { onSuccess: invalidateAll, onError: () => failToast("Erro ao adicionar bloco") }
    );
  };

  const updateBlock = (blockId: string, name: string) => {
    if (!selectedId) return;
    updateBlockMutation.mutate(
      { id: selectedId, blockId, data: { name } },
      { onSuccess: invalidateAll, onError: () => failToast("Erro ao renomear bloco") }
    );
  };

  const deleteBlock = (blockId: string) => {
    if (!selectedId) return;
    deleteBlockMutation.mutate(
      { id: selectedId, blockId, data: {} },
      { onSuccess: () => { toast({ title: "Bloco removido" }); invalidateAll(); }, onError: () => failToast("Erro ao remover bloco") }
    );
  };

  const addLine = (blockId: string, name: string, type: string) => {
    if (!selectedId) return;
    const block = selectedBook?.scenes
      ?.flatMap((s: any) => s.blocks ?? [])
      .find((b: any) => b.id === blockId);
    const order = (block?.positions?.length ?? 0) + 1;
    createPositionMutation.mutate(
      { id: selectedId, data: { name, order, blockId, minimumCoverage: 1 } },
      {
        onSuccess: (data: any) => {
          const positionId = data?.position?.id;
          if (positionId) {
            createLineMutation.mutate(
              { id: selectedId, positionId, data: { type: type as any } },
              { onSuccess: invalidateAll, onError: invalidateAll }
            );
          } else {
            invalidateAll();
          }
        },
        onError: () => failToast("Erro ao adicionar linha"),
      }
    );
  };

  const updatePositionName = (positionId: string, name: string) => {
    if (!selectedId) return;
    updatePositionMutation.mutate(
      { id: selectedId, positionId, data: { name } },
      { onSuccess: invalidateAll, onError: () => failToast("Erro ao renomear linha") }
    );
  };

  const updatePositionCoverage = (positionId: string, coverage: number) => {
    if (!selectedId) return;
    updatePositionMutation.mutate(
      { id: selectedId, positionId, data: { minimumCoverage: coverage } },
      { onSuccess: invalidateAll, onError: () => failToast("Erro ao atualizar cobertura") }
    );
  };

  const setLineType = (positionId: string, lineId: string | null, type: string) => {
    if (!selectedId) return;
    if (lineId) {
      updateLineMutation.mutate(
        { id: selectedId, lineId, data: { type: type as any } },
        { onSuccess: invalidateAll, onError: () => failToast("Erro ao atualizar tipo") }
      );
    } else {
      createLineMutation.mutate(
        { id: selectedId, positionId, data: { type: type as any } },
        { onSuccess: invalidateAll, onError: () => failToast("Erro ao definir tipo") }
      );
    }
  };

  const updateLineConfig = (lineId: string, config: LineConfig) => {
    if (!selectedId) return;
    updateLineMutation.mutate(
      { id: selectedId, lineId, data: { config: config as any, changeType: "CONFIG" } },
      { onSuccess: invalidateAll, onError: () => failToast("Erro ao salvar configuração") }
    );
  };

  const deletePosition = (positionId: string) => {
    if (!selectedId) return;
    deletePositionMutation.mutate(
      { id: selectedId, positionId, data: {} },
      { onSuccess: () => { toast({ title: "Linha removida" }); invalidateAll(); }, onError: () => failToast("Erro ao remover linha") }
    );
  };

  const reorder = (kind: "scene" | "block" | "position", items: any[], index: number, dir: "up" | "down") => {
    if (!selectedId) return;
    const target = index + (dir === "up" ? -1 : 1);
    if (target < 0 || target >= items.length) return;
    const a = items[index];
    const b = items[target];
    const aOrder = a.order ?? index;
    const bOrder = b.order ?? target;
    const opts = { onSuccess: invalidateAll, onError: () => failToast("Erro ao reordenar") };
    if (kind === "scene") {
      updateSceneMutation.mutate({ id: selectedId, sceneId: a.id, data: { order: bOrder } }, { onError: opts.onError });
      updateSceneMutation.mutate({ id: selectedId, sceneId: b.id, data: { order: aOrder } }, opts);
    } else if (kind === "block") {
      updateBlockMutation.mutate({ id: selectedId, blockId: a.id, data: { order: bOrder } }, { onError: opts.onError });
      updateBlockMutation.mutate({ id: selectedId, blockId: b.id, data: { order: aOrder } }, opts);
    } else {
      updatePositionMutation.mutate({ id: selectedId, positionId: a.id, data: { order: bOrder } }, { onError: opts.onError });
      updatePositionMutation.mutate({ id: selectedId, positionId: b.id, data: { order: aOrder } }, opts);
    }
  };

  const handleOpenRefs = (posId: string, posName: string) => {
    setSelectedPositionId(posId);
    setSelectedPositionName(posName);
    setRefSearchQuery("");
    setRefsSheetOpen(true);
  };

  const handleAddRef = (documentId: string) => {
    if (!selectedId || !selectedPositionId) return;
    addRefMutation.mutate(
      { id: selectedId, positionId: selectedPositionId, data: { documentId } },
      {
        onSuccess: () => { toast({ title: "Referência adicionada" }); invalidateRefs(); },
        onError: () => failToast("Erro ao adicionar referência"),
      }
    );
  };

  const handleRemoveRef = (refId: string) => {
    if (!selectedId || !selectedPositionId) return;
    deleteRefMutation.mutate(
      { id: selectedId, positionId: selectedPositionId, refId },
      {
        onSuccess: () => { toast({ title: "Referência removida" }); invalidateRefs(); },
        onError: () => failToast("Erro ao remover referência"),
      }
    );
  };

  const actions: Actions = {
    isAdmin,
    members,
    updateScene, deleteScene,
    addBlock, updateBlock, deleteBlock,
    addLine, updatePositionName, updatePositionCoverage, setLineType, updateLineConfig, deletePosition,
    reorder, openRefs: handleOpenRefs,
  };

  return (
    <AdminLayout title="Livro do Show" subtitle="Gerencie a hierarquia do espetáculo">
      <div className="flex items-center justify-between mb-4 p-3 rounded-lg bg-muted/30 border border-dashed text-sm">
        <span className="text-muted-foreground">Posições do Livro do Show poderão referenciar documentos da Biblioteca</span>
        <Button variant="outline" size="sm" onClick={() => setLocation("/admin/library")}>
          <Library className="w-4 h-4 mr-2" />
          Biblioteca
        </Button>
      </div>

      <div className="flex gap-4 h-full">
        {/* Livros organizados em pastas por operação */}
        <div className="w-72 shrink-0 flex flex-col gap-2 overflow-y-auto">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Livros por operação</span>
            {isAdmin && (
              <Button size="sm" variant="outline" onClick={() => openCreate()}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Novo
              </Button>
            )}
          </div>
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          ) : bookFolders.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <BookOpen className="h-8 w-8 opacity-30" />
              <p className="text-sm">Nenhum Livro do Show criado ainda. Crie o primeiro livro para estruturar a produção da sua operação.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {bookFolders.map((folder) => {
                const collapsed = collapsedOps.has(folder.opId);
                return (
                  <div key={folder.opId} className="flex flex-col">
                    <div className="flex items-center gap-1 group">
                      <button
                        onClick={() => toggleFolder(folder.opId)}
                        className="flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-md hover:bg-muted/50 text-left"
                      >
                        {collapsed ? <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                        {collapsed ? <Folder className="h-4 w-4 shrink-0 text-muted-foreground" /> : <FolderOpen className="h-4 w-4 shrink-0 text-primary" />}
                        <span className="text-sm font-medium truncate">{folder.opName}</span>
                        <span className="text-[10px] text-muted-foreground ml-auto shrink-0">{folder.books.length}</span>
                      </button>
                      {isAdmin && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100"
                          title={`Novo livro em ${folder.opName}`}
                          onClick={() => openCreate(folder.opId)}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                    {!collapsed && (
                      <div className="flex flex-col gap-1 pl-3 mt-1">
                        {folder.books.map((book) => (
                          <button
                            key={book.id}
                            onClick={() => setSelectedId(book.id)}
                            className={`text-left p-3 rounded-lg border transition-colors ${selectedId === book.id ? "bg-primary/10 border-primary/30" : "bg-card hover:bg-muted/50 border-border"}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-sm font-medium leading-tight">{book.title}</span>
                              <Badge variant={STATUS_VARIANTS[book.status]} className="text-[10px] shrink-0">
                                {STATUS_LABELS[book.status]}
                              </Badge>
                            </div>
                            <span className="text-xs text-muted-foreground mt-1">v{book.version} · {book.type}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <Separator orientation="vertical" />

        {/* Painel do livro selecionado */}
        <div className="flex-1 min-w-0">
          {!selectedBook ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-3">
              <BookOpen className="h-12 w-12 opacity-20" />
              <p className="text-sm">Selecione um livro para visualizar a hierarquia</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <EditableName
                    value={selectedBook.title}
                    onSave={renameBook}
                    disabled={!isAdmin}
                    className="text-lg font-semibold"
                  />
                  {selectedBook.description && <p className="text-sm text-muted-foreground">{selectedBook.description}</p>}
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={STATUS_VARIANTS[selectedBook.status]}>{STATUS_LABELS[selectedBook.status]}</Badge>
                    <span className="text-xs text-muted-foreground">Versão {selectedBook.version}</span>
                    <span className="text-xs text-muted-foreground">· {selectedBook.type}</span>
                  </div>
                  <ShowTimeEditor
                    startTime={(selectedBook as any).startTime ?? null}
                    endTime={(selectedBook as any).endTime ?? null}
                    disabled={!isAdmin}
                    onSave={updateShowTime}
                  />
                  {isFullAdmin && (
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-muted-foreground">Responsável:</span>
                      <Select value={selectedBook.responsibleId ?? "__none__"} onValueChange={handleAssignResponsible}>
                        <SelectTrigger className="h-7 w-56 text-xs"><SelectValue placeholder="Sem responsável" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Sem responsável (legado)</SelectItem>
                          {eligibleResponsibles.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                {isAdmin && (
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => setResolveOpen(true)}>
                      <CalendarCheck className="h-3.5 w-3.5 mr-1.5" /> Conferir por data
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setVersionsOpen(true)}>
                      <History className="h-3.5 w-3.5 mr-1.5" /> Histórico
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setStatusOpen(true)}>
                      <Settings className="h-3.5 w-3.5 mr-1.5" /> Status
                    </Button>
                    {isFullAdmin && (
                      <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => setDeleteOpen(true)}>
                        <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Apagar
                      </Button>
                    )}
                  </div>
                )}
              </div>

              <Separator />

              <div className="flex flex-col gap-3">
                {selectedBook.scenes && selectedBook.scenes.length > 0 ? (
                  selectedBook.scenes.map((scene: any, i: number) => (
                    <SceneCard
                      key={scene.id}
                      scene={scene}
                      siblings={selectedBook.scenes as any[]}
                      index={i}
                      actions={actions}
                    />
                  ))
                ) : (
                  <div className="text-sm text-muted-foreground text-center py-6 border rounded-lg bg-muted/10">
                    Nenhuma cena criada ainda — adicione a primeira cena abaixo para estruturar o Livro do Show
                  </div>
                )}

                {isAdmin && (
                  <div className="flex items-center gap-2">
                    <Input
                      value={newSceneName}
                      onChange={(e) => setNewSceneName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") addScene(); }}
                      placeholder="Nome da cena (ex.: Ato I — Abertura)"
                      className="h-9 text-sm flex-1"
                    />
                    <Button size="sm" variant="outline" className="h-9 shrink-0" onClick={addScene} disabled={!newSceneName.trim()}>
                      <Plus className="h-4 w-4 mr-1" /> Cena
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sheet: conferência por data */}
      <Sheet open={resolveOpen} onOpenChange={setResolveOpen}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Conferência por data</SheetTitle>
          </SheetHeader>
          <div className="mt-4 flex flex-col gap-4">
            <div className="flex items-end gap-2">
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Data do show</Label>
                <Input
                  type="date"
                  value={resolveDate}
                  onChange={(e) => setResolveDate(e.target.value)}
                  className="h-9 w-44"
                />
              </div>
              {resolution && (
                resolution.uncoveredCount > 0 ? (
                  <Badge variant="destructive" className="mb-1">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {resolution.uncoveredCount} linha(s) sem cobertura
                  </Badge>
                ) : (
                  <Badge className="mb-1">
                    <Check className="h-3 w-3 mr-1" /> Tudo coberto
                  </Badge>
                )
              )}
            </div>

            {resolveLoading ? (
              <p className="text-sm text-muted-foreground">Resolvendo elenco…</p>
            ) : !resolution || resolution.scenes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma cena para resolver nesta data.</p>
            ) : (
              <div className="flex flex-col gap-4">
                {resolution.scenes.map((scene) => (
                  <ResolveSceneView key={scene.sceneId} scene={scene} />
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Sheet: histórico de versões */}
      <Sheet open={versionsOpen} onOpenChange={setVersionsOpen}>
        <SheetContent>
          <SheetHeader><SheetTitle>Histórico de Versões</SheetTitle></SheetHeader>
          <div className="mt-4 flex flex-col gap-3">
            {versions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma versão registrada.</p>
            ) : (
              versions.slice().reverse().map((v) => (
                <div key={v.id} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">v{v.version}</span>
                    <Badge variant={v.changeType === "STRUCTURAL" ? "default" : "secondary"} className="text-xs">
                      {CHANGE_TYPE_LABELS[v.changeType]}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{v.reason}</p>
                  <p className="text-xs text-muted-foreground">{new Date(v.createdAt).toLocaleString("pt-BR")}</p>
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Sheet: referências oficiais da posição */}
      <Sheet open={refsSheetOpen} onOpenChange={setRefsSheetOpen}>
        <SheetContent className="w-[480px] sm:max-w-[480px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Library className="h-4 w-4 text-primary" />
              Referências Oficiais
            </SheetTitle>
            {selectedPositionName && (
              <p className="text-sm text-muted-foreground">{selectedPositionName}</p>
            )}
          </SheetHeader>
          <div className="mt-4 flex flex-col gap-4">
            {/* Documentos vinculados */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Documentos vinculados
              </p>
              {refsLoading ? (
                <div className="flex justify-center py-4">
                  <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                </div>
              ) : refs.length === 0 ? (
                <p className="text-sm text-muted-foreground py-3 text-center border rounded-lg bg-muted/10">
                  Nenhum documento vinculado a esta posição ainda
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {refs.map((ref) => (
                    <div key={ref.id} className="flex items-start gap-2 p-2.5 rounded-lg border bg-muted/20">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge variant="outline" className="text-[10px]">
                            {DOC_TYPE_LABELS[ref.document.type] ?? ref.document.type}
                          </Badge>
                          <Badge
                            variant={DOC_STATUS_VARIANTS[ref.document.status] ?? "secondary"}
                            className="text-[10px]"
                          >
                            {DOC_STATUS_LABELS[ref.document.status] ?? ref.document.status}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">v{ref.document.version}</span>
                        </div>
                        <p className="text-sm font-medium mt-0.5 truncate">{ref.document.title}</p>
                        {ref.label && (
                          <p className="text-xs text-muted-foreground mt-0.5 italic">"{ref.label}"</p>
                        )}
                        {ref.document.summary && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {ref.document.summary}
                          </p>
                        )}
                      </div>
                      {isAdmin && (
                        <button
                          onClick={() => handleRemoveRef(ref.id)}
                          className="p-1 text-muted-foreground hover:text-destructive rounded shrink-0 mt-0.5"
                          title="Remover referência"
                          disabled={deleteRefMutation.isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Vincular novo documento (somente admin) */}
            {isAdmin && (
              <>
                <Separator />
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Vincular documento da Biblioteca
                  </p>
                  <Input
                    placeholder="Pesquisar documentos publicados..."
                    value={refSearchQuery}
                    onChange={(e) => setRefSearchQuery(e.target.value)}
                    className="mb-3"
                  />
                  <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto pr-0.5">
                    {availableDocs.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-3 border rounded-lg bg-muted/10">
                        {refSearchQuery ? "Nenhum documento encontrado para esta busca" : "Nenhum documento publicado na Biblioteca ainda"}
                      </p>
                    ) : (
                      availableDocs.map((doc) => (
                        <button
                          key={doc.id}
                          className="flex items-center gap-2 p-2.5 rounded-lg border hover:bg-muted/30 text-left w-full group transition-colors"
                          onClick={() => handleAddRef(doc.id)}
                          disabled={addRefMutation.isPending}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <Badge variant="outline" className="text-[10px]">
                                {DOC_TYPE_LABELS[doc.type] ?? doc.type}
                              </Badge>
                            </div>
                            <p className="text-sm font-medium mt-0.5 truncate">{doc.title}</p>
                            {doc.summary && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{doc.summary}</p>
                            )}
                          </div>
                          <Plus className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:text-primary shrink-0" />
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Dialog: criar livro */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Livro do Show</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-3">
            <div>
              <Label>Operação *</Label>
              <Select value={createOpId} onValueChange={setCreateOpId}>
                <SelectTrigger><SelectValue placeholder="Selecione a operação" /></SelectTrigger>
                <SelectContent>
                  {manageableOperations.map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Título *</Label>
              <Input value={createForm.title} onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))} placeholder="Nome do espetáculo" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Input value={createForm.description} onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))} placeholder="Descrição opcional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>Criar Livro</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: status */}
      <Dialog open={statusOpen} onOpenChange={setStatusOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Alterar Status</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-3">
            <div>
              <Label>Novo Status *</Label>
              <Select value={statusForm.status} onValueChange={(v) => setStatusForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DRAFT">Rascunho</SelectItem>
                  <SelectItem value="PUBLISHED">Publicar</SelectItem>
                  <SelectItem value="ARCHIVED">Arquivar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Motivo *</Label>
              <Input value={statusForm.reason} onChange={(e) => setStatusForm((f) => ({ ...f, reason: e.target.value }))} placeholder="Justificativa da mudança" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusOpen(false)}>Cancelar</Button>
            <Button onClick={handleStatus} disabled={statusMutation.isPending}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: apagar livro */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Apagar Livro do Show</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <p>
                Esta ação é <strong>permanente</strong>. O livro <strong>{selectedBook?.title}</strong> e todo o seu conteúdo
                (cenas, blocos, posições e linhas) serão apagados de vez. Não é possível desfazer.
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Se o livro estiver a ser usado em escalas, agenda ou livro do dia, não será possível apagar — nesse caso, arquive-o.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
              <Trash2 className="h-4 w-4 mr-1.5" /> Apagar de vez
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
