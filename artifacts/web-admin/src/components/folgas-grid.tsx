import { Fragment, useRef, useState, useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Eraser, Loader2, Lock } from "lucide-react";
import { mensagemDoErro } from "@/lib/mensagem-do-erro";
import {
  type FolgasGridMember,
  customFetch,
  useGetFolgasGrid,
  useToggleFolgaCell,
  useBulkFillFolgas,
  getGetFolgasGridQueryKey,
} from "@workspace/api-client-react";

// ─── Types & constants ────────────────────────────────────────────────────────

export type GridType = "DAY_OFF" | "RECESSO" | "AFASTAMENTO" | "OUTRO";
export const GRID_TYPES: { value: GridType; label: string; abbr: string; bg: string; text: string }[] = [
  { value: "DAY_OFF", label: "Folga",   abbr: "F",  bg: "bg-blue-100", text: "text-blue-800" },
  { value: "RECESSO", label: "Recesso", abbr: "R",  bg: "bg-orange-100", text: "text-orange-800" },
  { value: "AFASTAMENTO", label: "Afastamento", abbr: "A", bg: "bg-purple-100", text: "text-purple-800" },
  { value: "OUTRO",   label: "Outro",   abbr: "O",  bg: "bg-gray-200",  text: "text-gray-700" },
];

const ALL_TYPE_INFO: Record<string, { abbr: string; bg: string; text: string }> = {
  NO_SHOW:     { abbr: "F",  bg: "bg-blue-100",   text: "text-blue-800" },
  RECESSO:     { abbr: "R",  bg: "bg-orange-100",  text: "text-orange-800" },
  OUTRO:       { abbr: "O",  bg: "bg-gray-200",    text: "text-gray-700" },
  DAY_OFF:     { abbr: "F",  bg: "bg-blue-100",    text: "text-blue-800" },
  AFASTAMENTO: { abbr: "Af", bg: "bg-purple-100",  text: "text-purple-800" },
  RESTRICAO:   { abbr: "Rs", bg: "bg-yellow-100",  text: "text-yellow-800" },
};

/** Totais do mês agrupados pela letra que aparece na grade (F soma folga e no show). */
function totalPorLetra(totals: Record<string, number>) {
  const porLetra = new Map<string, { abbr: string; n: number; text: string }>();
  for (const [tipo, n] of Object.entries(totals)) {
    if (!n) continue;
    const info = ALL_TYPE_INFO[tipo];
    if (!info) continue;
    const atual = porLetra.get(info.abbr);
    porLetra.set(info.abbr, { abbr: info.abbr, n: (atual?.n ?? 0) + n, text: info.text });
  }
  return [...porLetra.values()];
}

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
      <p className="text-xs text-muted-foreground px-2 py-1 font-medium">Tipo para a semana</p>
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
  /** "Publicar mês" (desenho 18): a tela mostra se o mês foi publicado e se mudou depois. */
  onPublicacao?: (publicacao: FolgasPublicacao) => void;
  refreshKey?: number;
}
export type FolgasPublicacao = { publishedAt: string | null; publishedBy: string | null; changedSince: boolean };

const NO_AREA_LABEL = "Sem área";

/** Três tamanhos para a mesma tabela: o compacto cabe o mês inteiro numa tela, o grande é para editar com calma. */
const TAMANHOS = {
  compacto: { rotulo: "Compacto", nome: "min-w-[104px] max-w-[130px]", dia: "min-w-[25px] px-0", linha: "h-6", selo: "w-5 h-4 text-[10px]", texto: "text-[10px]", semana: "min-h-[22px]" },
  normal:   { rotulo: "Normal",   nome: "min-w-[130px] max-w-[180px]", dia: "min-w-[34px] px-0.5", linha: "h-8", selo: "w-7 h-5 text-xs", texto: "text-xs", semana: "min-h-[30px]" },
  grande:   { rotulo: "Grande",   nome: "min-w-[170px] max-w-[220px]", dia: "min-w-[46px] px-1", linha: "h-11", selo: "w-8 h-6 text-sm", texto: "text-sm", semana: "min-h-[44px]" },
} as const;
type Tamanho = keyof typeof TAMANHOS;
const CHAVE_TAMANHO = "myasa-folgas-tamanho";
const CHAVE_AGRUPAR = "myasa-folgas-agrupar";

function lerPreferencia(chave: string): string | null {
  try { return localStorage.getItem(chave); } catch { return null; }
}
function guardarPreferencia(chave: string, valor: string) {
  try { localStorage.setItem(chave, valor); } catch { /* sem armazenamento: a escolha vale só até recarregar */ }
}

/** O que a limpeza do mês pergunta: cada letra da grade, com os tipos do servidor que ela reúne. */
const GRUPOS_DE_TIPO = [
  { id: "F", rotulo: "Folga (F)", tipos: ["DAY_OFF", "NO_SHOW"] },
  { id: "R", rotulo: "Recesso (R)", tipos: ["RECESSO"] },
  { id: "A", rotulo: "Afastamento (A)", tipos: ["AFASTAMENTO"] },
  { id: "O", rotulo: "Outro (O)", tipos: ["OUTRO", "RESTRICAO"] },
] as const;

/** O servidor manda área, local e se a linha é editável; o tipo gerado só os conhece depois de gerar o cliente de novo. */
type GridMember = FolgasGridMember & { areaName?: string | null; localName?: string | null; editable?: boolean };
type ResultadoLimpeza = { ok: boolean; eventId: string | null; dias: number; pessoas: number; diasDePedido: number };
type AvisoLimpeza = { texto: string; eventId: string | null };

function LimparFolgasDialog({ candidatas, descricaoFiltro, semFiltro, todosEditaveis, operationId, year, month, onClose, onFeito }: {
  candidatas: GridMember[]; descricaoFiltro: string; semFiltro: boolean; todosEditaveis: boolean;
  operationId: string; year: number; month: number; onClose: () => void; onFeito: (r: ResultadoLimpeza) => void;
}) {
  const [escopo, setEscopo] = useState<"todas" | "escolher">("todas");
  const [escolhidas, setEscolhidas] = useState<Set<string>>(new Set());
  const [tipos, setTipos] = useState<Set<string>>(new Set(GRUPOS_DE_TIPO.map((g) => g.id)));
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  useEffect(() => {
    const fechaComEsc = (e: KeyboardEvent) => { if (e.key === "Escape" && !enviando) onClose(); };
    document.addEventListener("keydown", fechaComEsc);
    return () => document.removeEventListener("keydown", fechaComEsc);
  }, [enviando, onClose]);

  const tiposDoServidor = GRUPOS_DE_TIPO.filter((g) => tipos.has(g.id)).flatMap((g) => g.tipos as readonly string[]);
  const alvo = escopo === "todas" ? candidatas : candidatas.filter((m) => escolhidas.has(m.userId));
  const dias = alvo.reduce((n, m) => n + Object.values(m.days).filter((t) => tiposDoServidor.includes(t)).length, 0);
  const pessoasComDia = alvo.filter((m) => Object.values(m.days).some((t) => tiposDoServidor.includes(t))).length;
  const mesPorExtenso = `${MONTH_NAMES[month - 1]} de ${year}`;

  async function limpar(e: React.FormEvent) {
    e.preventDefault();
    if (enviando || !alvo.length || !tiposDoServidor.length) return;
    setEnviando(true); setErro("");
    // Administração olhando o mapa todo, sem filtro: manda o mês inteiro sem listar ninguém (uma rota só, sem 100 conferências).
    const mesInteiro = escopo === "todas" && semFiltro && todosEditaveis;
    try {
      const r = await customFetch<ResultadoLimpeza>("/api/folgas/grid/limpar", {
        method: "POST",
        body: JSON.stringify({ operationId, year, month, tipos: tiposDoServidor, motivo: motivo.trim() || undefined, ...(mesInteiro ? {} : { userIds: alvo.map((m) => m.userId) }) }),
      });
      onFeito(r);
    } catch (err) {
      setErro(mensagemDoErro(err, "Não consegui limpar agora. Nada foi alterado; tente de novo."));
      setEnviando(false);
    }
  }

  return (
    <div className="cycle-modal" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !enviando) onClose(); }}>
      <form onSubmit={limpar} role="dialog" aria-modal="true" aria-label="Limpar folgas do mês">
        <header><h2>Limpar folgas</h2><button type="button" aria-label="Fechar" onClick={onClose}>×</button></header>
        <p className="cycle-ajuda">Volta {mesPorExtenso} ao branco. O que veio de um pedido aprovado em Solicitações não sai daqui. Dá para desfazer logo depois.</p>
        <fieldset>
          <legend>De quem</legend>
          <label><input type="radio" name="escopo" checked={escopo === "todas"} onChange={() => setEscopo("todas")}/> {descricaoFiltro ? `As ${candidatas.length} pessoas que aparecem agora (${descricaoFiltro})` : candidatas.length === 1 ? "A pessoa da tabela" : `Todas as ${candidatas.length} pessoas da tabela`}</label>
          <label><input type="radio" name="escopo" checked={escopo === "escolher"} onChange={() => setEscopo("escolher")}/> Só as pessoas que eu escolher</label>
        </fieldset>
        {escopo === "escolher" && (
          <div className="rounded-lg border border-border" style={{ maxHeight: 190, overflow: "auto" }}>
            <label className="sticky top-0 bg-white" style={{ display: "flex", gap: 8, padding: "8px 10px", borderBottom: "1px solid var(--asa-line)" }}>
              <input type="checkbox" checked={escolhidas.size === candidatas.length} onChange={(e) => setEscolhidas(e.target.checked ? new Set(candidatas.map((m) => m.userId)) : new Set())} style={{ minHeight: 0, width: 18, height: 18 }}/> Todas
            </label>
            {candidatas.map((m) => (
              <label key={m.userId} style={{ display: "flex", gap: 8, padding: "8px 10px", alignItems: "center" }}>
                <input type="checkbox" checked={escolhidas.has(m.userId)} onChange={(e) => setEscolhidas((atual) => { const prox = new Set(atual); if (e.target.checked) prox.add(m.userId); else prox.delete(m.userId); return prox; })} style={{ minHeight: 0, width: 18, height: 18 }}/>
                <span>{m.name}{m.areaName ? <small style={{ opacity: .6 }}> · {m.areaName}</small> : null}</span>
              </label>
            ))}
          </div>
        )}
        <fieldset>
          <legend>O que sai</legend>
          {GRUPOS_DE_TIPO.map((g) => (
            <label key={g.id}><input type="checkbox" checked={tipos.has(g.id)} onChange={(e) => setTipos((atual) => { const prox = new Set(atual); if (e.target.checked) prox.add(g.id); else prox.delete(g.id); return prox; })}/> {g.rotulo}</label>
          ))}
        </fieldset>
        <label>Motivo (opcional, fica no Registro)<input value={motivo} maxLength={600} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: recomeçar o mês do zero"/></label>
        <p role="status" className="cycle-ajuda">{dias ? `Vão sair até ${dias} ${dias === 1 ? "dia marcado" : "dias marcados"} de ${pessoasComDia} ${pessoasComDia === 1 ? "pessoa" : "pessoas"}.` : alvo.length ? "Não há dia marcado para limpar com essas escolhas." : "Escolha pelo menos uma pessoa."}</p>
        {erro && <p className="cycle-erro-janela" role="alert">{erro}</p>}
        <footer>
          <button type="button" className="cycle-secondary" onClick={onClose}>Cancelar</button>
          <button className="cycle-primary" disabled={enviando || !dias}>{enviando ? "Limpando…" : dias ? `Limpar ${dias} ${dias === 1 ? "dia" : "dias"}` : "Limpar"}</button>
        </footer>
      </form>
    </div>
  );
}

export function FolgasGrid({ operationId, year, month, memberFilter, onPublicacao, refreshKey = 0 }: FolgasGridProps) {
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

  const publicacao = (data as { publicacao?: FolgasPublicacao } | undefined)?.publicacao;
  useEffect(() => { if (publicacao) onPublicacao?.(publicacao); }, [publicacao?.publishedAt, publicacao?.changedSince]);
  const [tamanho, setTamanho] = useState<Tamanho>(() => { const v = lerPreferencia(CHAVE_TAMANHO); return v && v in TAMANHOS ? (v as Tamanho) : window.innerWidth < 640 ? "compacto" : "normal"; });
  const [agrupar, setAgrupar] = useState(() => lerPreferencia(CHAVE_AGRUPAR) !== "0");
  const [areaFiltro, setAreaFiltro] = useState("");
  const [localFiltro, setLocalFiltro] = useState("");
  const [limparAberto, setLimparAberto] = useState(false);
  const [aviso, setAviso] = useState<AvisoLimpeza | null>(null);
  const [desfazendo, setDesfazendo] = useState(false);
  const t = TAMANHOS[tamanho];

  const todos = ((data?.members ?? []) as GridMember[]);
  const areas = [...new Set(todos.map((m) => m.areaName).filter((a): a is string => !!a))].sort((a, b) => a.localeCompare(b, "pt"));
  const locais = [...new Set(todos.map((m) => m.localName).filter((l): l is string => !!l))].sort((a, b) => a.localeCompare(b, "pt"));
  const filteredMembers = todos.filter((m) => {
    if (areaFiltro && m.areaName !== areaFiltro) return false;
    if (localFiltro && m.localName !== localFiltro) return false;
    if (!memberFilter) return true;
    return m.name.toLowerCase().includes(memberFilter.toLowerCase());
  });
  // Agrupado, a tabela se organiza por área ("Sem área" no fim) e depois por nome. A ordem do array
  // é usada também pela seleção por arraste.
  const members = agrupar
    ? [...filteredMembers].sort((a, b) => {
        const aNo = a.areaName ? 0 : 1;
        const bNo = b.areaName ? 0 : 1;
        if (aNo !== bNo) return aNo - bNo;
        const g = (a.areaName ?? "").localeCompare(b.areaName ?? "", "pt");
        if (g !== 0) return g;
        return a.name.localeCompare(b.name, "pt");
      })
    : filteredMembers;
  const pessoasPorArea = new Map<string, number>();
  for (const m of members) pessoasPorArea.set(m.areaName ?? NO_AREA_LABEL, (pessoasPorArea.get(m.areaName ?? NO_AREA_LABEL) ?? 0) + 1);
  const descricaoFiltro = [areaFiltro && `área ${areaFiltro}`, localFiltro && `local ${localFiltro}`, memberFilter && `busca "${memberFilter}"`].filter(Boolean).join(", ");
  const candidatasAoLimpar = filteredMembers.filter((m) => m.editable !== false);
  const daysInMonth = data?.daysInMonth ?? 30;
  // 08/10: a Supervisão vê todo mundo, mas só altera a própria equipe (a API manda `editable`).
  const editable = (userId: string) => (members.find((m) => m.userId === userId) as { editable?: boolean } | undefined)?.editable !== false;

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
  useEffect(() => { if (refreshKey) invalidate(); }, [refreshKey, invalidate]);

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
    if (!editable(userId)) return;
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
      if (!m || !editable(m.userId)) continue;
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

  function mudarTamanho(novo: Tamanho) { setTamanho(novo); guardarPreferencia(CHAVE_TAMANHO, novo); }
  function alternarAgrupar() { setAgrupar((v) => { guardarPreferencia(CHAVE_AGRUPAR, v ? "0" : "1"); return !v; }); }

  function limpezaFeita(r: ResultadoLimpeza) {
    setLimparAberto(false);
    invalidate();
    const resto = r.diasDePedido ? ` ${r.diasDePedido} ${r.diasDePedido === 1 ? "dia vindo" : "dias vindos"} de pedido aprovado ficaram.` : "";
    setAviso(r.dias
      ? { texto: `Limpei ${r.dias} ${r.dias === 1 ? "dia" : "dias"} de ${r.pessoas} ${r.pessoas === 1 ? "pessoa" : "pessoas"}.${resto}`, eventId: r.eventId }
      : { texto: `Não havia dia marcado à mão para limpar.${resto}`, eventId: null });
  }

  async function desfazerLimpeza() {
    if (!aviso?.eventId || desfazendo) return;
    setDesfazendo(true);
    try {
      const r = await customFetch<{ devolvidos: number; jaOcupados: number }>("/api/folgas/grid/limpar/desfazer", { method: "POST", body: JSON.stringify({ eventId: aviso.eventId }) });
      invalidate();
      setAviso({ texto: `Devolvi ${r.devolvidos} ${r.devolvidos === 1 ? "dia" : "dias"}.${r.jaOcupados ? ` ${r.jaOcupados} ${r.jaOcupados === 1 ? "dia já tinha" : "dias já tinham"} outra marcação e ficaram como estavam.` : ""}`, eventId: null });
    } catch (err) {
      setAviso({ texto: mensagemDoErro(err, "Não consegui desfazer agora. Nada foi alterado; tente de novo."), eventId: aviso.eventId });
    } finally {
      setDesfazendo(false);
    }
  }

  // Mudar de mês ou de operação troca a tabela: o aviso do mês anterior deixaria de fazer sentido.
  useEffect(() => { setAviso(null); }, [operationId, year, month]);

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

  if (todos.length === 0) {
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

      {/* Barra de controles: legenda à esquerda; filtros, tamanho e limpar à direita. */}
      <div className="flex items-center gap-x-4 gap-y-2 px-4 py-2.5 border-b bg-muted/20 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          {GRID_TYPES.map((tipo) => (
            <div key={tipo.value} className="flex items-center gap-1.5">
              <span className={`inline-flex items-center justify-center w-6 h-5 rounded text-xs font-bold ${tipo.bg} ${tipo.text}`}>
                {tipo.abbr}
              </span>
              <span className="text-xs text-muted-foreground">{tipo.label}</span>
            </div>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {areas.length > 0 && <select aria-label="Filtrar por área" value={areaFiltro} onChange={(e) => setAreaFiltro(e.target.value)} className="h-11 sm:h-9 rounded-full border border-border bg-white px-3 text-xs font-medium text-foreground">
            <option value="">Todas as áreas</option>
            {areas.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>}
          {locais.length > 0 && <select aria-label="Filtrar por local" value={localFiltro} onChange={(e) => setLocalFiltro(e.target.value)} className="h-11 sm:h-9 rounded-full border border-border bg-white px-3 text-xs font-medium text-foreground">
            <option value="">Todos os locais</option>
            {locais.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>}
          <div role="group" aria-label="Tamanho da tabela" className="inline-flex rounded-full border border-border bg-white p-0.5">
            {(Object.keys(TAMANHOS) as Tamanho[]).map((chave) => (
              <button key={chave} type="button" aria-pressed={tamanho === chave} onClick={() => mudarTamanho(chave)}
                className={`h-10 sm:h-8 px-3 rounded-full text-xs font-semibold transition-colors ${tamanho === chave ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {TAMANHOS[chave].rotulo}
              </button>
            ))}
          </div>
          <button type="button" aria-pressed={agrupar} onClick={alternarAgrupar} title="Separar a tabela por área"
            className={`h-11 sm:h-9 rounded-full border px-3 text-xs font-semibold transition-colors ${agrupar ? "border-primary text-primary bg-primary/5" : "border-border bg-white text-muted-foreground"}`}>
            Por área
          </button>
          {candidatasAoLimpar.length > 0 && (
            <button type="button" onClick={() => setLimparAberto(true)} className="inline-flex items-center gap-1.5 h-11 sm:h-9 rounded-full border border-border bg-white px-3 text-xs font-semibold text-foreground hover:bg-muted">
              <Eraser className="w-3.5 h-3.5"/> Limpar…
            </button>
          )}
        </div>
      </div>

      {aviso && (
        <div role="status" className="flex items-center gap-3 flex-wrap px-4 py-2 border-b bg-emerald-50 text-xs text-emerald-900">
          <span>{aviso.texto}</span>
          {aviso.eventId && <button type="button" disabled={desfazendo} onClick={() => void desfazerLimpeza()} className="font-bold underline min-h-[44px] sm:min-h-0">{desfazendo ? "Desfazendo…" : "Desfazer"}</button>}
          <button type="button" onClick={() => setAviso(null)} className="ml-auto font-semibold min-h-[44px] sm:min-h-0">Fechar</button>
        </div>
      )}

      {members.length === 0 && (
        <div className="text-center py-16 text-muted-foreground text-sm">
          Ninguém aparece com esses filtros.{" "}
          <button type="button" className="underline font-semibold" onClick={() => { setAreaFiltro(""); setLocalFiltro(""); }}>Tirar os filtros de área e local</button>
        </div>
      )}

      {/* Grade: rola por dentro (cabeçalho dos dias e coluna dos nomes ficam fixos). */}
      <div className={members.length === 0 ? "hidden" : "overflow-auto"} style={{ maxHeight: "calc(100dvh - 280px)", minHeight: 280 }}>
        <table className={`${t.texto} border-separate border-spacing-0`} style={{ minWidth: "max-content" }}>
          <thead>
            <tr>
              <th className={`sticky left-0 top-0 z-30 bg-white border-r border-b border-border px-3 py-2 text-left font-medium text-muted-foreground ${t.nome}`}>
                Membro
              </th>
              {days.map((d) => {
                const weekend = isWeekend(year, month, d);
                const isToday = todayYear === year && todayMonth === month && todayDay === d;
                return (
                  <th
                    key={d}
                    className={`sticky top-0 z-20 border-b border-r border-border py-1 text-center font-medium ${t.dia} ${
                      weekend ? "bg-slate-50 text-slate-400" : "bg-white text-muted-foreground"
                    } ${isToday ? "bg-blue-50 text-blue-600 font-bold" : ""}`}
                  >
                    <div className="leading-none">{d}</div>
                    <div className="text-xs leading-tight opacity-70 mt-0.5">{getDayAbbr(year, month, d)}</div>
                  </th>
                );
              })}
              <th className="sticky top-0 z-20 border-b border-l border-border px-3 py-2 text-left font-medium text-muted-foreground bg-white min-w-[100px]">
                Totais
              </th>
              <th className="sticky top-0 z-20 border-b border-l border-border px-2 py-2 bg-white min-w-[70px]" />
            </tr>
          </thead>
          <tbody>
            {members.map((m, rowIdx) => {
              const prev = rowIdx > 0 ? members[rowIdx - 1] : undefined;
              const showGroupHeader =
                agrupar && (rowIdx === 0 || (prev?.areaName ?? null) !== (m.areaName ?? null));
              const groupLabel = m.areaName ?? NO_AREA_LABEL;
              return (
              <Fragment key={m.userId}>
              {showGroupHeader && (
                <tr>
                  <td
                    colSpan={days.length + 3}
                    className="sticky left-0 z-10 bg-slate-100 border-b border-border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    {groupLabel} <span className="normal-case font-normal opacity-70">· {pessoasPorArea.get(groupLabel) ?? 0} {(pessoasPorArea.get(groupLabel) ?? 0) === 1 ? "pessoa" : "pessoas"}</span>
                  </td>
                </tr>
              )}
              <tr className={rowIdx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                <td title={editable(m.userId) ? m.name : "Só a Administração altera a folga desta pessoa"} className={`sticky left-0 z-10 border-r border-b border-border px-3 py-1.5 font-medium ${m.name.endsWith("(desligado)") ? "whitespace-normal break-words leading-tight" : "truncate"} ${t.nome} ${
                  rowIdx % 2 === 0 ? "bg-white" : "bg-slate-50"
                }`}>
                  {!editable(m.userId) && <Lock className="inline w-3 h-3 mr-1 text-muted-foreground" aria-label="Só a Administração altera" />}{m.name}
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
                      className={`border-b border-r border-border text-center ${editable(m.userId) ? "cursor-pointer" : "cursor-not-allowed opacity-70"} transition-colors ${t.linha} ${
                        weekend && !type ? "bg-slate-50/80" : ""
                      } ${isToday && !type ? "bg-blue-50/50" : ""} ${
                        isSelected ? "ring-2 ring-inset ring-primary bg-primary/10" : ""
                      } ${!isSelected ? "hover:bg-muted/30" : ""}`}
                      onMouseDown={(e) => handleCellMouseDown(e, m.userId, d)}
                      onMouseEnter={() => handleCellMouseEnter(m.userId, d)}
                      onMouseUp={(e) => handleCellMouseUp(e, m.userId, d)}
                    >
                      {info && (
                        <span className={`inline-flex items-center justify-center ${t.selo} rounded font-bold ${info.bg} ${info.text}`}>
                          {info.abbr}
                        </span>
                      )}
                    </td>
                  );
                })}
                <td className="border-b border-l border-border px-3 py-1.5 whitespace-nowrap text-muted-foreground">
                  {/* Soma por letra, não por tipo: folga e no show aparecem os dois como "F" na
                      grade, então contá-los em separado daria um total menor do que o que está
                      desenhado ali — e a conta do mês é justamente o que a Administração confere. */}
                  {totalPorLetra(m.totals).map(({ abbr, n, text }) => (
                    <span key={abbr} className={`inline-flex items-center gap-0.5 mr-1.5 ${text}`}>
                      <span className="font-bold">{abbr}:</span>{n}
                    </span>
                  ))}
                  {Object.values(m.totals).every((v) => v === 0) && (
                    <span className="text-xs opacity-40">—</span>
                  )}
                </td>
                <td className="border-b border-l border-border px-2 py-1">
                  {editable(m.userId) && <button
                    className="text-muted-foreground hover:text-foreground whitespace-nowrap px-2 ${t.semana} rounded hover:bg-muted transition-colors"
                    onClick={(e) => handleFillWeekClick(e, m.userId)}
                    title="Preencher semana visível"
                  >
                    + semana
                  </button>}
                </td>
              </tr>
              </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {limparAberto && (
        <LimparFolgasDialog
          candidatas={candidatasAoLimpar}
          descricaoFiltro={descricaoFiltro}
          semFiltro={!descricaoFiltro}
          todosEditaveis={todos.every((m) => m.editable !== false)}
          operationId={operationId}
          year={year}
          month={month}
          onClose={() => setLimparAberto(false)}
          onFeito={limpezaFeita}
        />
      )}

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
