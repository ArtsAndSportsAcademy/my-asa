import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { X } from "lucide-react";
import { ApiError, customFetch } from "@workspace/api-client-react";
import { css } from "@/lib/dc-style";
import {
  addDays, loadSampleEscala, loadSampleProgramacoes, sampleAreasSupervisionadas, sampleDia, sampleLocais, samplePessoas,
  sampleShowsDoLocal, saveSampleEscala, saveSampleProgramacoes, todayISO, vocabularioDoLocal, type SampleEscalaState, type SampleProgramacao,
} from "@/lib/review-escala";
import "./escalas.css";

/* A camada visual é cópia de design_handoff_my_asa/telas/15 Escalas.dc.html (quadro web, sem a
   moldura de documentação): cada string de estilo é a do arquivo, convertida por `css()`.
   Duas abas — Escala (o dia, abre primeiro) e Programação (o molde). Elenco vê só "Minha escala". */

type Role = "adm" | "dir" | "sup" | "mem";
type Regra = "todos" | "ninguem" | "area" | "grupo" | "pessoas" | "livro";
type Bloco = { key: string; rotulo: string; inicio: string; fim: string | null; origem: "programacao" | "livro" | "manual" | "solicitacao"; regra: Regra | null; pessoaIds: string[]; vazio: boolean; sinal: string | null; showBookId: string | null; dailyBookId: string | null; dailyBookStatus: string | null; blocoId: string | null; allocationId?: string | null };
type Pessoa = { id: string; name: string; areaId: string | null; areaName: string | null; folga: string | null };
type Area = { id: string; name: string; supervisores: { id: string; name: string }[]; pronta: { por: string | null; em: string } | null };
type Dia = { date: string; location: { id: string; name: string }; escala: { id: string; status: string; version: number; publishedAt: string | null; alteradaDesde: string | null } | null; programacao: { id: string; nome: string; vigenciaInicio: string; vigenciaFim: string } | null; areas: Area[]; pessoas: Pessoa[]; blocos: Bloco[] };
type Local = { id: string; name: string; podeEditar: boolean; areasSupervisionadas: string[] };
type ProgBloco = SampleProgramacao["blocos"][number];
type Programacao = { id: string; locationId: string; nome: string; vigenciaInicio: string; vigenciaFim: string; blocos: ProgBloco[] };
type MinhaLocal = { location: { id: string; name: string }; publishedAt?: string | null; folga?: string | null; confirmada?: boolean; confirmedAt?: string | null; escalaId: string; escalaVersion: number; blocos: Omit<Bloco, "pessoaIds">[] };
type Minha = { date: string; publicada: boolean; escalas?: MinhaLocal[]; location?: { id: string; name: string } | null; publishedAt?: string | null; folga?: string | null; confirmada?: boolean; confirmedAt?: string | null; escalaId?: string | null; escalaVersion?: number | null; blocos?: Omit<Bloco, "pessoaIds">[] };

/* ---------- valores do .dc.html ---------- */
const T = {
  aula: { bg: "#eef1fd", fg: "#2E3BD6", bd: "#dbe1fa" },
  show: { bg: "#f3ebff", fg: "#6C2BF2", bd: "#e5d8fb" },
  prep: { bg: "#e6f5f3", fg: "#0E7F76", bd: "#cfeae6" },
  refeicao: { bg: "#f4f2fa", fg: "#6b6482", bd: "#e8e4f2" },
  ausente: { bg: "#fdeceb", fg: "#C2453C", bd: "#f7d8d5" },
  ferias: { bg: "#f1eef8", fg: "#7d72a8", bd: "#e2dcf0" },
  vaga: { bg: "#fff4e4", fg: "#B06E00", bd: "#f0d8b0" },
};
type Tone = typeof T.aula;
const STATUS: Record<string, { bg: string; fg: string }> = {
  publicada: { bg: "#e6f5f3", fg: "#0E7F76" },
  rascunho: { bg: "#fff4e4", fg: "#B06E00" },
  "sem escala": { bg: "#f1eef8", fg: "#6b6482" },
  "carregando…": { bg: "#f1eef8", fg: "#6b6482" },
  "não carregou": { bg: "#fdecea", fg: "#a12c2c" },
  "alteração em rascunho": { bg: "#fdeceb", fg: "#C2453C" },
};
const pillBase = "border:none;border-radius:999px;padding:6px 13px;font-size:12px;cursor:pointer;font-family:Manrope,sans-serif;font-weight:600;";
const pillOn = pillBase + "background:#fff;color:#2b2545;font-weight:700;box-shadow:0 1px 3px rgba(40,20,90,.14);";
const pillOff = pillBase + "background:none;color:#6b6482;";
const MONO_TH = "text-align:left;background:#f5f3fb;border-bottom:1px solid #ddd6ee;border-right:1px solid #ddd6ee;padding:9px 11px;font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#6b6482;font-weight:700";
const blockStyle = (tone: Tone, extra = "") => "display:flex;align-items:baseline;gap:6px;border-radius:7px;padding:6px 9px;font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;background:" + tone.bg + ";color:" + tone.fg + ";border:1px solid " + tone.bd + ";" + extra;
const btn = (kind: "primary" | "ghost") => "border-radius:999px;padding:9px 17px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:Manrope,sans-serif;" + (kind === "primary" ? "border:none;background:linear-gradient(135deg,#6C2BF2,#2E3BD6);color:#fff;" : "border:1px solid #e6e1f2;background:#fff;color:#3d3559;");
const chipBase = "border-radius:999px;padding:5px 11px;font-size:11.5px;cursor:pointer;font-family:Manrope,sans-serif;white-space:nowrap;";
const chipOn = chipBase + "border:1px solid #cbb8f7;background:#f6f0ff;color:#6C2BF2;font-weight:700;";
const chipOff = chipBase + "border:1px dashed #ddd6ee;background:#fff;color:#9a93b0;font-weight:600;";
import { REVIEW_PERSON } from "@/lib/amostra";

/* ---------- datas ---------- */
const WEEKDAY_LONG = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
const WEEKDAYS: [number, string][] = [[0, "Dom"], [1, "Seg"], [2, "Ter"], [3, "Qua"], [4, "Qui"], [5, "Sex"], [6, "Sáb"]];
const MONTH = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const MON3 = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const partsOf = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return { y, m, d, dt: new Date(y, m - 1, d) }; };
const weekdayOf = (iso: string) => partsOf(iso).dt.getDay();
const fullDate = (iso: string) => { const { y, m, d } = partsOf(iso); return `${d} de ${MONTH[m - 1]} de ${y}`; };
const shortDate = (iso: string) => { const { m, d } = partsOf(iso); return `${d} ${MON3[m - 1]}`; };
const rangeLabel = (a: string, b: string) => { const x = partsOf(a), y = partsOf(b); return `${x.d} de ${MON3[x.m - 1]} — ${y.d} de ${MON3[y.m - 1]}`; };
const relOf = (iso: string) => {
  const diff = Math.round((partsOf(iso).dt.getTime() - partsOf(todayISO()).dt.getTime()) / 86_400_000);
  return diff === 0 ? "hoje" : diff === 1 ? "amanhã" : diff === -1 ? "ontem" : diff > 1 ? `em ${diff} dias` : `há ${-diff} dias`;
};
const hhmm = (iso: string | null | undefined) => { if (!iso) return ""; const d = new Date(iso); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
const minutes = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + (m || 0); };
const durLabel = (a: string, b: string | null) => { if (!b) return ""; const d = minutes(b) - minutes(a); return d >= 60 ? `${Math.floor(d / 60)}h${d % 60 ? String(d % 60).padStart(2, "0") : ""}` : `${d} min`; };
const initials = (name: string) => name.normalize("NFD").replace(/[̀-ͯ]/g, "").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
const plural = (n: number, um: string, muitos: string) => `${n} ${n === 1 ? um : muitos}`;
const faixa = (b: { inicio: string; fim: string | null }) => b.fim ? `${b.inicio}–${b.fim}` : b.inicio;

/** Tom do bloco pelo vocabulário da escala: show pelo Livro; refeição, treino/ensaio, recesso, no show. */
function toneOf(b: { rotulo: string; regra: Regra | null }): Tone {
  const r = b.rotulo.toLocaleUpperCase("pt-BR");
  if (b.regra === "livro") return T.show;
  if (r.startsWith("ALMOÇO")) return T.refeicao;
  if (r.startsWith("RECESSO")) return T.ferias;
  if (r.startsWith("NO SHOW")) return T.ausente;
  if (/^(TREINO|ENSAIO|AULA|ACROBACIA|FISIO)/.test(r)) return T.aula;
  return T.prep;
}
/** Nome na célula: bloco de show leva a hora ("MUSICAL 12:30") — vocabulário da escala, não nome de show. */
const textoDoBloco = (b: { rotulo: string; inicio: string; regra: Regra | null }) => b.regra === "livro" && !b.rotulo.includes(":") ? `${b.rotulo} ${b.inicio}` : b.rotulo;
const FOLGA: Record<string, { label: string; tone: Tone }> = {
  DAY_OFF: { label: "Folga", tone: T.ausente }, RECESSO: { label: "Recesso", tone: T.ferias }, NO_SHOW: { label: "No show", tone: T.ausente },
  AFASTAMENTO: { label: "Afastamento", tone: T.ferias }, RESTRICAO: { label: "Restrição", tone: T.ausente }, OUTRO: { label: "Fora", tone: T.ferias },
};
const statusLabel = (dia: Dia | null) => !dia?.escala ? "sem escala" : dia.escala.alteradaDesde ? "alteração em rascunho" : dia.escala.status === "DRAFT" ? "rascunho" : "publicada";

export default function EscalasPage({ role, onHeader }: { role: Role; onHeader?: (node: ReactNode) => void }) {
  const sampleRequested = new URLSearchParams(window.location.search).get("amostra") === "1";
  if (sampleRequested) window.sessionStorage.setItem("myasa-review-sample", "1");
  const review = import.meta.env.DEV && (sampleRequested || window.sessionStorage.getItem("myasa-review-sample") === "1");
  const isMem = role === "mem", isDir = role === "dir", isAdm = role === "adm";
  const me = REVIEW_PERSON[role];
  // "minha" (desenho 15): quem gerencia e também trabalha escalado vê a própria escala, como o elenco.
  const [tab, setTab] = useState<"escala" | "prog" | "minha">("escala");
  const showMinha = isMem || tab === "minha";
  const [date, setDate] = useState(addDays(todayISO(), 1));
  const [cal, setCal] = useState(false);
  const [locais, setLocais] = useState<Local[]>([]);
  const [localId, setLocalId] = useState("");
  const [opMenu, setOpMenu] = useState(false);
  const [manual, setManual] = useState(false);
  const [dia, setDia] = useState<Dia | null>(null);
  const [minha, setMinha] = useState<Minha | null>(null);
  const [areasMinhas, setAreasMinhas] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  // Enquanto a lista de locais não chega, a tela ainda está carregando (não é "sem escala").
  const [locaisProntos, setLocaisProntos] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  // Qual ação está em andamento, para o botão dizer "Gerando…"/"Publicando…" enquanto o servidor responde.
  const [busy, setBusy] = useState("");
  const [refresh, setRefresh] = useState(0);

  // Locais visíveis: amostra = locais do JSON; real = /escalas/locais (escopo checado no servidor).
  useEffect(() => {
    if (isMem) return;
    if (review) {
      const list = sampleLocais.map((l) => ({ ...l, podeEditar: isAdm || (role === "sup" && sampleAreasSupervisionadas(me, l.id).length > 0), areasSupervisionadas: role === "sup" ? sampleAreasSupervisionadas(me, l.id) : [] }))
        .filter((l) => role !== "sup" || l.podeEditar);
      setLocais(list); setLocalId((prev) => prev || lembrarLocal(list) || "");
      return;
    }
    customFetch<{ locais: Local[] }>("/api/escalas/locais").then((r) => { setLocais(r.locais); setLocalId((prev) => prev || lembrarLocal(r.locais) || ""); }).catch(() => setError("Não consegui carregar os locais.")).finally(() => setLocaisProntos(true));
  }, [review, role]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError("");
    (async () => {
      try {
        if (showMinha) {
          if (review) {
            const person = samplePessoas("snowland").find((p) => p.id === me);
            const localSample = person ? "snowland" : "";
            const d = localSample ? sampleDia(localSample, date) : null;
            const pub = d?.escala && d.escala.status !== "DRAFT";
            const confirmation = d?.escala ? loadSampleEscala(localSample, date)?.confirmacoes?.[me] : null;
            if (!cancelled) setMinha({ date, location: d?.location ?? null, publicada: Boolean(pub), publishedAt: d?.escala?.publishedAt, folga: person?.folga ?? null, escalaId: d?.escala?.id ?? null, escalaVersion: d?.escala?.version ?? null, confirmada: Boolean(confirmation && confirmation.version === d?.escala?.version), confirmedAt: confirmation?.em ?? null, blocos: pub ? d!.blocos.filter((b) => b.pessoaIds.includes(me)) : [] });
          } else {
            const r = await customFetch<Minha>(`/api/escalas/minha?date=${date}`);
            if (!cancelled) setMinha(r);
          }
          return;
        }
        if (!localId) return;
        if (review) {
          const d = sampleDia(localId, date) as Dia;
          if (!cancelled) { setDia(d); setAreasMinhas(role === "sup" ? sampleAreasSupervisionadas(me, localId) : []); }
          return;
        }
        const r = await customFetch<{ dia: Dia; areasSupervisionadas: string[] }>(`/api/escalas/dia?locationId=${localId}&date=${date}`);
        if (!cancelled) { setDia(r.dia); setAreasMinhas(r.areasSupervisionadas); }
      } catch { if (!cancelled) setError(isMem ? "Não consegui carregar a sua escala." : "Não consegui montar a Escala do dia."); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [review, localId, date, isMem, showMinha, refresh]);

  const local = locais.find((l) => l.id === localId);
  const meusBlocos = minha?.escalas?.flatMap((escala) => escala.blocos) ?? minha?.blocos ?? [];
  const operationLabel = isMem ? (minha?.escalas && minha.escalas.length > 1 ? "Mais de um local" : minha?.escalas?.[0]?.location.name ?? minha?.location?.name ?? "—") : (local?.name ?? "—");

  // Cabeçalho do shell: "somente leitura" (Direção) e o seletor de local, como no quadro.
  useEffect(() => {
    onHeader?.(<div style={css("position:relative;display:flex;align-items:center;gap:12px")}>
      {isDir && <span style={css("font-family:'JetBrains Mono',monospace;font-size:11.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#2E63D6;background:#e9effc;padding:5px 10px;border-radius:999px;")}>somente leitura</span>}
      <button type="button" className="esc-hit" aria-haspopup="menu" aria-expanded={opMenu} disabled={isMem || locais.length < 2} onClick={() => setOpMenu((v) => !v)}
        style={css("display:flex;flex:none;white-space:nowrap;align-items:center;gap:8px;border:1px solid #e6e1f2;background:#fff;border-radius:999px;padding:6px 12px;font-size:13.5px;font-weight:600;color:#3d3559;font-family:Manrope,sans-serif;" + (!isMem && locais.length > 1 ? "cursor:pointer;" : "cursor:default;") + (isMem ? "opacity:.75;" : ""))}>
        <span style={css("width:8px;height:8px;border-radius:50%;background:#0E8F86")}/>
        <span style={css("flex:none;white-space:nowrap")}>{operationLabel}</span>
        {!isMem && locais.length > 1 && <span style={css("flex:none;color:#6b6482;font-weight:500")}>▾</span>}
      </button>
      {opMenu && <div role="menu" style={css("position:absolute;right:0;top:44px;z-index:30;width:206px;background:#fff;border:1px solid #ddd6ee;border-radius:12px;padding:6px;box-shadow:0 22px 40px -20px rgba(40,20,90,.45);display:flex;flex-direction:column;gap:2px;")}>
        {locais.map((l) => <button key={l.id} type="button" role="menuitem" onClick={() => { setLocalId(l.id); guardarLocal(l.id); setOpMenu(false); }}
          style={css("text-align:left;border:none;background:" + (localId === l.id ? "#f3ebff" : "none") + ";color:" + (localId === l.id ? "#6C2BF2" : "#3d3559") + ";border-radius:8px;padding:8px 10px;font-size:12px;font-weight:" + (localId === l.id ? "700" : "600") + ";cursor:pointer;font-family:Manrope,sans-serif;min-height:44px")}>{l.name}</button>)}
      </div>}
    </div>);
    return () => onHeader?.(null);
  }, [operationLabel, locais, localId, opMenu, isDir, isMem]);

  /* ---------- escrita ---------- */
  const errMsg = (err: unknown, fallback: string) => err instanceof ApiError && err.data && typeof err.data === "object" && typeof (err.data as { message?: unknown }).message === "string" ? (err.data as { message: string }).message : fallback;
  const marcarPronta = async (areaId: string, pronta: boolean) => {
    if (!dia) return;
    setSaving(true); setBusy(`pronta:${areaId}`); setError("");
    try {
      if (review) {
        const cur: SampleEscalaState = loadSampleEscala(localId, date) ?? { status: "DRAFT", version: 1, prontas: {}, publishedAt: null, alteradaDesde: null };
        const prontas = { ...cur.prontas };
        if (pronta) prontas[areaId] = { por: me, em: new Date().toISOString() }; else delete prontas[areaId];
        saveSampleEscala(localId, date, { ...cur, prontas });
      } else {
        await customFetch("/api/escalas/dia/pronta", { method: "POST", body: JSON.stringify({ locationId: localId, date, areaId, pronta }) });
      }
      setRefresh((n) => n + 1);
    } catch (err) { setError(errMsg(err, "Não consegui marcar a área.")); } finally { setSaving(false); setBusy(""); }
  };
  const gerarDia = async () => {
    if (!localId) return;
    setSaving(true); setBusy("gerar"); setError("");
    try {
      if (review) {
        const cur: SampleEscalaState = loadSampleEscala(localId, date) ?? { status: "DRAFT", version: 1, prontas: {}, publishedAt: null, alteradaDesde: null };
        saveSampleEscala(localId, date, cur);
      } else {
        await customFetch("/api/escalas/dia/gerar", { method: "POST", body: JSON.stringify({ locationId: localId, date }) });
      }
      setRefresh((n) => n + 1);
    } catch (err) { setError(errMsg(err, "Não consegui gerar a Escala e os Livros do Dia.")); } finally { setSaving(false); setBusy(""); }
  };
  const publicar = async (republicar: boolean) => {
    if (!dia?.escala) return;
    setSaving(true); setBusy("publicar"); setError("");
    try {
      if (review) {
        const cur = loadSampleEscala(localId, date)!;
        const faltam = dia.areas.filter((a) => !a.pronta).map((a) => a.name);
        if (!republicar && faltam.length) { setError(`Faltam áreas marcarem como pronta: ${faltam.join(", ")}.`); return; }
        saveSampleEscala(localId, date, { ...cur, status: republicar ? "REPUBLISHED" : "PUBLISHED", version: cur.version + 1, publishedAt: new Date().toISOString(), alteradaDesde: null });
      } else {
        await customFetch(`/api/escalas/${dia.escala.id}/${republicar ? "republicar" : "publicar"}`, { method: "POST", body: JSON.stringify({ expectedVersion: dia.escala.version }) });
        // Relê o dia antes de liberar o botão: assim a tela não fica mostrando "Rascunho" depois de publicar.
        const r = await customFetch<{ dia: Dia; areasSupervisionadas: string[] }>(`/api/escalas/dia?locationId=${localId}&date=${date}`);
        setDia(r.dia); setAreasMinhas(r.areasSupervisionadas);
        return;
      }
      setRefresh((n) => n + 1);
    } catch (err) { setError(errMsg(err, "Não consegui publicar a escala.")); } finally { setSaving(false); setBusy(""); }
  };
  const ajustarCelula = async (bloco: Bloco, pessoaId: string, action: "ADICIONAR" | "REMOVER") => {
    if (!dia || !localId) return;
    setSaving(true); setError("");
    try {
      if (review) {
        const cur: SampleEscalaState = loadSampleEscala(localId, date) ?? { status: "DRAFT", version: 1, prontas: {}, publishedAt: null, alteradaDesde: null };
        const ajustes = { ...(cur.ajustes ?? {}), [bloco.key]: { ...(cur.ajustes?.[bloco.key] ?? {}), [pessoaId]: action } };
        saveSampleEscala(localId, date, { ...cur, ajustes, alteradaDesde: cur.status === "DRAFT" ? cur.alteradaDesde : (cur.alteradaDesde ?? new Date().toISOString()), version: cur.status === "DRAFT" ? cur.version : cur.version + 1 });
      } else {
        await customFetch("/api/escalas/dia/ajustes", { method: "POST", body: JSON.stringify({ locationId: localId, date, sourceKey: bloco.key, userId: pessoaId, action }) });
      }
      setRefresh((n) => n + 1);
    } catch (err) { setError(errMsg(err, "Não consegui ajustar esta célula.")); } finally { setSaving(false); }
  };
  /** Atividade só deste dia, fora da Programação: entra como entrada manual da própria Escala. */
  const criarEntradaManual = async (v: { pessoaId: string; rotulo: string; inicio: string; fim: string }) => {
    if (!dia?.escala) return;
    setSaving(true); setBusy("manual"); setError("");
    try {
      if (!review) {
        await customFetch(`/api/scales/${dia.escala.id}/entries`, { method: "POST", headers: { "if-match": String(dia.escala.version) },
          body: JSON.stringify({ memberId: v.pessoaId, date, label: v.rotulo, startTime: v.inicio, endTime: v.fim || null }) });
      }
      setManual(false); setRefresh((n) => n + 1);
    } catch (err) { setError(errMsg(err, "Não consegui criar a atividade de hoje.")); } finally { setSaving(false); setBusy(""); }
  };
  const removerEntradaManual = async (allocationId: string) => {
    if (!dia?.escala) return;
    setSaving(true); setBusy(`manual:${allocationId}`); setError("");
    try {
      if (!review) await customFetch(`/api/scales/${dia.escala.id}/entries/${allocationId}`, { method: "DELETE", headers: { "if-match": String(dia.escala.version) } });
      setRefresh((n) => n + 1);
    } catch (err) { setError(errMsg(err, "Não consegui tirar a atividade de hoje.")); } finally { setSaving(false); setBusy(""); }
  };
  const confirmarEscala = async (escala: MinhaLocal) => {
    setSaving(true); setError("");
    try {
      if (review) {
        const localSample = escala.location.id;
        if (!localSample) return;
        const cur = loadSampleEscala(localSample, date);
        if (!cur) return;
        saveSampleEscala(localSample, date, { ...cur, confirmacoes: { ...(cur.confirmacoes ?? {}), [me]: { version: cur.version, em: new Date().toISOString() } } });
      } else await customFetch(`/api/escalas/${escala.escalaId}/confirmar`, { method: "POST" });
      setRefresh((n) => n + 1);
    } catch (err) { setError(errMsg(err, "Não consegui confirmar a escala.")); } finally { setSaving(false); }
  };

  const carregandoTela = loading || (!isMem && !review && !locaisProntos);
  const status = carregandoTela && !dia ? "carregando…" : error && !dia ? "não carregou" : statusLabel(dia);
  const S = STATUS[isMem ? (carregandoTela && !minha ? "carregando…" : error && !minha ? "não carregou" : minha?.publicada ? "publicada" : "sem escala") : status];
  const dateBar = <div className="esc-pad" style={css("display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px;padding:14px 20px 12px;background:#fff;border-bottom:1px solid #ebe6f6;position:relative")}>
    <div style={css("display:flex;align-items:center;gap:4px")}>
      <button type="button" className="esc-hit" aria-label="Dia anterior" onClick={() => { setDate(addDays(date, -1)); setCal(false); }} style={css("width:30px;height:30px;border-radius:9px;border:1px solid #e6e1f2;background:#fff;color:#6b6482;font-size:13px;cursor:pointer")}>‹</button>
      <button type="button" className="esc-hit" aria-label="Próximo dia" onClick={() => { setDate(addDays(date, 1)); setCal(false); }} style={css("width:30px;height:30px;border-radius:9px;border:1px solid #e6e1f2;background:#fff;color:#6b6482;font-size:13px;cursor:pointer")}>›</button>
    </div>
    <div style={css("display:flex;flex-direction:column;gap:3px;flex:none")}>
      <div style={css("display:flex;align-items:baseline;gap:9px;white-space:nowrap;flex-wrap:wrap")}>
        <span style={css("font-family:Outfit,sans-serif;font-size:22px;font-weight:700;letter-spacing:-0.02em;white-space:nowrap")}>{WEEKDAY_LONG[weekdayOf(date)]}</span>
        <span style={css("font-size:13.5px;color:#5b5473;font-weight:500;white-space:nowrap")}>{fullDate(date)}</span>
        <span style={css("font-family:'JetBrains Mono',monospace;font-size:11.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:3px 8px;border-radius:999px;background:#f3ebff;color:#6C2BF2;")}>{relOf(date)}</span>
      </div>
      <div style={css("display:flex;align-items:center;gap:9px;font-size:12px;color:#6b6482;flex-wrap:wrap")}>
        <span>{operationLabel}</span>
        <span>·</span>
        <span>{isMem ? (carregandoTela && !minha ? "carregando…" : error && !minha ? "não carregou" : minha?.publicada ? plural(meusBlocos.length, "bloco seu", "blocos seus") : "ainda não publicada") : dia ? `${dia.pessoas.filter((p) => p.folga).length} fora o dia todo · ${dia.pessoas.filter((p) => !p.folga).length} no local · ${plural(dia.blocos.filter((b) => b.vazio).length, "bloco vazio", "blocos vazios")}` : "—"}</span>
      </div>
    </div>
    <span style={css("flex:1")}/>
    <span style={css("font-family:'JetBrains Mono',monospace;font-size:11.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:5px 10px;border-radius:999px;background:" + S.bg + ";color:" + S.fg + ";")}>{isMem ? (carregandoTela && !minha ? "carregando…" : error && !minha ? "não carregou" : minha?.publicada ? "publicada" : "sem escala") : status}</span>
    <div style={css("display:flex;align-items:center;gap:6px;border:1px solid #e6e1f2;border-radius:999px;padding:3px;background:#f7f5fd;flex:none;white-space:nowrap")}>
      <button type="button" className="esc-hit" onClick={() => { setDate(todayISO()); setCal(false); }} style={css(date === todayISO() ? pillOn : pillOff)}>Hoje</button>
      <button type="button" className="esc-hit" onClick={() => { setDate(addDays(todayISO(), 1)); setCal(false); }} style={css(date === addDays(todayISO(), 1) ? pillOn : pillOff)}>Amanhã</button>
      <button type="button" className="esc-hit" aria-expanded={cal} onClick={() => setCal((v) => !v)} style={css(cal ? pillOn : pillOff)}>Calendário</button>
    </div>
    {!isMem && !review && localId && <a className="esc-hit" href={`/imprimir?local=${encodeURIComponent(localId)}&data=${date}`} target="_blank" rel="noreferrer" style={css("flex:none;white-space:nowrap;border:1px solid #e6e1f2;background:#fff;color:#3d3559;border-radius:999px;padding:6px 13px;font-size:12px;font-weight:700;font-family:Manrope,sans-serif;text-decoration:none")}>Imprimir o dia</a>}
    {cal && <Calendario date={date} onPick={(d) => { setDate(d); setCal(false); }}/>}
  </div>;

  return <section className="esc-root" style={css("position:relative;flex:1;display:flex;flex-direction:column;background:#faf9fe;min-width:0;min-height:calc(100vh - 48px)")}>
    {dateBar}
    {!isMem && <div className="esc-tabs esc-pad" role="tablist" style={css("display:flex;align-items:center;padding:0 20px;border-bottom:1px solid #ebe6f6;background:#fff;")}>
      {([["escala", "Escala do dia"], ["prog", "Programação"], ["minha", "Minha escala"]] as const).map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={tab === key} className="esc-hit" onClick={() => setTab(key)}
        style={css("border:none;background:none;cursor:pointer;font-family:Manrope,sans-serif;font-size:13px;padding:11px 2px 10px;margin-right:22px;white-space:nowrap;" + (tab === key ? "font-weight:700;color:#2b2545;box-shadow:inset 0 -2px 0 0 #6C2BF2;" : "font-weight:600;color:#6b6482;"))}>{label}</button>)}
    </div>}

    <div className="esc-pad" style={css("flex:1;min-width:0;padding:16px 18px 0")}>
      {error && <div role="alert" style={css("display:flex;align-items:center;gap:11px;background:#fdeceb;border:1px solid #f0bcbc;border-radius:12px;padding:10px 14px;margin-bottom:12px")}>
        <img src="/asa/aviso-importante.webp" alt="" style={css("width:30px;height:30px;object-fit:contain;flex:none")}/>
        <span style={css("font-size:12.5px;color:#a12c2c;line-height:1.45;flex:1")}>{error}</span>
        <button type="button" className="esc-hit" onClick={() => { setError(""); setRefresh((n) => n + 1); }} style={css(btn("ghost"))}>Tentar de novo</button>
      </div>}
      {/* Desenho 29: vazio de primeiro uso ensina e oferece a primeira ação. */}
      {!isMem && !review && locaisProntos && !error && locais.length === 0 && tab !== "minha" && <div role="status" style={css("display:flex;align-items:center;gap:12px;background:#fff;border:1px dashed #ddd6ee;border-radius:12px;padding:14px 16px;margin-bottom:12px")}>
        <img src="/asa/oi.webp" alt="" style={css("width:40px;height:40px;object-fit:contain;flex:none")}/>
        <span style={css("font-size:13px;color:#3d3559;line-height:1.5;flex:1")}>{isAdm ? "Ainda não há locais cadastrados. A escala é montada por local — cadastre os locais primeiro." : "Você ainda não tem local para montar escala. A Administração cadastra os locais e define quem supervisiona cada um."}</span>
        {isAdm && <Link href="/locais" className="esc-hit" style={css(btn("primary") + ";text-decoration:none")}>Cadastrar os locais</Link>}
      </div>}
      {carregandoTela && !error && !dia && !minha && <div aria-busy="true" style={css("padding:16px;text-align:center;font-size:12.5px;color:#6b6482;background:#fff;border:1px dashed #ddd6ee;border-radius:12px")}>Montando a escala…</div>}
      {showMinha && minha && <MinhaEscala minha={minha} date={date} onHoje={() => setDate(todayISO())} onConfirm={confirmarEscala} saving={saving}/>}
      {!isMem && tab === "escala" && dia && <EscalaGrid dia={dia} canEdit={isAdm || areasMinhas.length > 0} editableAreaIds={isAdm ? null : areasMinhas} onAdjust={ajustarCelula} onRemoveManual={isAdm ? removerEntradaManual : undefined}/>} 
      {!isMem && tab === "prog" && localId && <ProgramacaoTab review={review} localId={localId} localName={operationLabel} date={date} dia={dia} canEdit={Boolean(local?.podeEditar)} onChanged={() => setRefresh((n) => n + 1)}/>}
    </div>

    {manual && dia && <AtividadeDeHojeDialog pessoas={dia.pessoas} saving={busy === "manual"} onClose={() => setManual(false)} onSubmit={criarEntradaManual}/>}

    <Rodape role={role} tab={tab} onMinha={tab === "minha"} dia={dia} minha={minha} areasMinhas={areasMinhas} saving={saving} busy={busy} onGerar={gerarDia} onPronta={marcarPronta} onPublicar={publicar} onManual={() => setManual(true)}/>
  </section>;
}

/* ---------- calendário (mês da data escolhida) ---------- */
function Calendario({ date, onPick }: { date: string; onPick: (d: string) => void }) {
  const { y, m } = partsOf(date);
  const [cursor, setCursor] = useState({ y, m });
  const first = new Date(cursor.y, cursor.m - 1, 1);
  const days = new Date(cursor.y, cursor.m, 0).getDate();
  const iso = (d: number) => `${cursor.y}-${String(cursor.m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const move = (delta: number) => setCursor((c) => { const n = new Date(c.y, c.m - 1 + delta, 1); return { y: n.getFullYear(), m: n.getMonth() + 1 }; });
  return <div style={css("position:absolute;right:20px;top:70px;z-index:5;width:258px;background:#fff;border:1px solid #ddd6ee;border-radius:14px;padding:13px;box-shadow:0 22px 40px -20px rgba(40,20,90,.45);")}>
    <div style={css("display:flex;align-items:center;justify-content:space-between;margin-bottom:10px")}>
      <span style={css("font-family:Outfit,sans-serif;font-size:14px;font-weight:600")}>{MONTH[cursor.m - 1][0].toUpperCase() + MONTH[cursor.m - 1].slice(1)} {cursor.y}</span>
      <span style={css("display:flex;gap:2px")}>
        <button type="button" className="esc-hit" aria-label="Mês anterior" onClick={() => move(-1)} style={css("border:none;background:none;color:#6b6482;font-size:12px;cursor:pointer;padding:2px 6px")}>‹</button>
        <button type="button" className="esc-hit" aria-label="Próximo mês" onClick={() => move(1)} style={css("border:none;background:none;color:#6b6482;font-size:12px;cursor:pointer;padding:2px 6px")}>›</button>
      </span>
    </div>
    <div style={css("display:grid;grid-template-columns:repeat(7,1fr);gap:3px;margin-bottom:6px")}>
      {["D", "S", "T", "Q", "Q", "S", "S"].map((h, i) => <span key={i} style={css("text-align:center;font-family:'JetBrains Mono',monospace;font-size:9.5px;color:#6b6482")}>{h}</span>)}
    </div>
    <div style={css("display:grid;grid-template-columns:repeat(7,1fr);gap:3px")}>
      {Array.from({ length: first.getDay() }, (_, i) => <span key={`e${i}`} style={css("height:30px")}/>)}
      {Array.from({ length: days }, (_, i) => {
        const d = iso(i + 1), isSel = d === date, isToday = d === todayISO();
        return <button key={d} type="button" onClick={() => onPick(d)} style={css("display:flex;flex-direction:column;align-items:center;gap:2px;height:30px;justify-content:center;border-radius:8px;cursor:pointer;font-family:'JetBrains Mono',monospace;font-size:11.5px;font-weight:600;" + (isSel ? "border:1px solid #6C2BF2;background:#f3ebff;color:#6C2BF2;" : isToday ? "border:1px solid #ddd6ee;background:#fff;color:#2b2545;" : "border:1px solid transparent;background:none;color:#6b6482;"))}>{i + 1}</button>;
      })}
    </div>
  </div>;
}

/* ---------- aba Escala: grade pessoas × horários ---------- */
function EscalaGrid({ dia, canEdit, editableAreaIds, onAdjust, onRemoveManual }: { dia: Dia; canEdit: boolean; editableAreaIds: string[] | null; onAdjust: (bloco: Bloco, pessoaId: string, action: "ADICIONAR" | "REMOVER") => Promise<void>; onRemoveManual?: (allocationId: string) => Promise<void> }) {
  const [view, setView] = useState<"pessoa" | "atividade">("pessoa");
  const [team, setTeam] = useState("todos");
  const [zoom, setZoom] = useState(100);
  const [ajustando, setAjustando] = useState<Bloco | null>(null);
  const [tirando, setTirando] = useState("");
  const cols =dia.pessoas.filter((p) => team === "todos" || p.areaId === team);
  const vazios = dia.blocos.filter((b) => b.vazio);
  const faixas = useMemo(() => {
    const seen = new Map<string, { inicio: string; fim: string | null; blocos: Bloco[] }>();
    for (const b of dia.blocos) { const k = faixa(b); const cur = seen.get(k) ?? { inicio: b.inicio, fim: b.fim, blocos: [] }; cur.blocos.push(b); seen.set(k, cur); }
    return [...seen.values()].sort((a, b) => a.inicio.localeCompare(b.inicio) || (a.fim ?? "").localeCompare(b.fim ?? ""));
  }, [dia.blocos]);
  const blocosDe = (pid: string) => dia.blocos.filter((b) => b.pessoaIds.includes(pid));
  const personName = (id: string) => dia.pessoas.find((p) => p.id === id)?.name ?? id;
  // Mesma pessoa em dois blocos que se cruzam: a escala avisa, não bloqueia (regra de conflito).
  const conflitos = useMemo(() => {
    const out: { pessoa: string; pessoaId: string; areaId: string | null; a: Bloco; b: Bloco }[] = [];
    for (const p of dia.pessoas) {
      const list = dia.blocos.filter((b) => b.pessoaIds.includes(p.id)).sort((x, y) => x.inicio.localeCompare(y.inicio));
      for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        const fimA = a.fim ?? a.inicio;
        if (b.inicio < fimA || (b.inicio === a.inicio && b.fim && a.fim)) out.push({ pessoa: p.name, pessoaId: p.id, areaId: p.areaId, a, b });
      }
    }
    return out;
  }, [dia]);
  const emConflito = new Set(conflitos.flatMap((c) => [`${c.pessoa}|${c.a.key}`, `${c.pessoa}|${c.b.key}`]));
  // Um cartão por par de blocos que se cruzam (ALMOÇO × MUSICAL), com as pessoas dentro — não um por pessoa.
  const gruposDeConflito = useMemo(() => {
    const porPar = new Map<string, { a: Bloco; b: Bloco; pessoas: typeof conflitos }>();
    for (const c of conflitos) { const k = `${c.a.key}|${c.b.key}`; const g = porPar.get(k) ?? { a: c.a, b: c.b, pessoas: [] }; g.pessoas.push(c); porPar.set(k, g); }
    return [...porPar.values()].sort((x, y) => x.a.inicio.localeCompare(y.a.inicio) || y.pessoas.length - x.pessoas.length);
  }, [conflitos]);

  const blockEl = (b: Bloco, extra = "") => {
    const tone = toneOf(b);
    const inner = <>
      {b.dailyBookId && <span title={`Livro do Dia · ${b.dailyBookStatus ?? ""}`} style={css("width:6px;height:6px;border-radius:50%;flex:none;background:" + (b.dailyBookStatus === "DRAFT" ? "#B06E00" : "#0E7F76") + ";")}/>}
      <span style={css("overflow:hidden;text-overflow:ellipsis")}>{textoDoBloco(b)}</span>
      {b.fim && b.regra !== "livro" && <span style={css("font-family:'JetBrains Mono',monospace;font-size:11px;color:" + tone.fg + ";opacity:.75;margin-left:auto;")}>{faixa(b)}</span>}
    </>;
    return b.dailyBookId
      ? <Link key={b.key} href="/livro-do-dia" title="Abrir no Livro do Dia" style={css(blockStyle(tone, "cursor:pointer;text-decoration:none;" + extra))}>{inner}</Link>
      : <div key={b.key} style={css(blockStyle(tone, extra))}>{inner}</div>;
  };

  return <div style={css("display:flex;flex-direction:column;gap:12px")}>
    <div style={css("display:flex;flex-wrap:wrap;align-items:center;gap:9px")}>
      <div style={css("display:flex;align-items:center;gap:3px;border:1px solid #e6e1f2;border-radius:10px;padding:3px;background:#f7f5fd")}>
        {([["pessoa", "Por pessoa"], ["atividade", "Por atividade"]] as const).map(([key, label]) => <button key={key} type="button" className="esc-hit" aria-pressed={view === key} onClick={() => setView(key)}
          style={css("border-radius:8px;padding:6px 12px;font-size:11.5px;cursor:pointer;font-family:Manrope,sans-serif;border:none;" + (view === key ? "background:#fff;color:#2b2545;font-weight:700;box-shadow:0 1px 3px rgba(40,20,90,.14);" : "background:none;color:#6b6482;font-weight:600;"))}>{label}</button>)}
      </div>
      <span style={css("width:1px;height:20px;background:#e6e1f2")}/>
      {[{ id: "todos", name: "Todos os grupos" }, ...dia.areas].map((a) => <button key={a.id} type="button" className="esc-hit" aria-pressed={team === a.id} onClick={() => setTeam(a.id)}
        style={css("border-radius:999px;padding:5px 11px;font-size:11.5px;cursor:pointer;font-family:Manrope,sans-serif;" + (team === a.id ? "border:1px solid #2b2545;background:#2b2545;color:#fff;font-weight:700;" : "border:1px solid #e6e1f2;background:#fff;color:#6b6482;font-weight:600;"))}>{a.name}</button>)}
      <span style={css("flex:1")}/>
      <span style={css("font-size:11px;color:#6b6482")}>{`${cols.length} de ${dia.pessoas.length} pessoas · ${dia.location.name}`}</span>
      <span className="esc-hide-sm" style={css("width:1px;height:20px;background:#e6e1f2")}/>
      <div className="esc-hide-sm" style={css("display:flex;align-items:center;gap:6px")}>
        <button type="button" className="esc-hit" aria-label="Diminuir" onClick={() => setZoom((z) => Math.max(40, z - 15))} style={css("flex:none;width:26px;height:26px;border-radius:8px;border:1px solid #e6e1f2;background:#fff;color:#5b5473;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center")}>−</button>
        <div style={css("display:flex;align-items:center;gap:2px;border:1px solid #e6e1f2;border-radius:10px;padding:3px;background:#f7f5fd")}>
          {[100, 85, 70, 55, 40].map((z) => <button key={z} type="button" className="esc-hit" onClick={() => setZoom(z)} style={css("flex:none;height:26px;padding:0 9px;border-radius:8px;border:none;cursor:pointer;font-family:'JetBrains Mono',monospace;font-size:11.5px;font-weight:700;background:" + (zoom === z ? "#2b2545" : "transparent") + ";color:" + (zoom === z ? "#fff" : "#6b6482"))}>{z}%</button>)}
        </div>
        <button type="button" className="esc-hit" aria-label="Aumentar" onClick={() => setZoom((z) => Math.min(100, z + 15))} style={css("flex:none;width:26px;height:26px;border-radius:8px;border:1px solid #e6e1f2;background:#fff;color:#5b5473;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center")}>+</button>
        <span style={css("flex:none;white-space:nowrap;font-size:11px;color:#6b6482")}>{zoom === 100 ? "escala em tamanho real" : zoom >= 75 ? "cabe mais gente na tela" : "visão geral do dia inteiro"}</span>
      </div>
    </div>

    {vazios.length > 0 && <details className="esc-vazios" style={css("background:#fffaf0;border:1px solid #f0dcb4;border-radius:12px;padding:10px 14px;")}>
      <summary style={css("display:flex;align-items:center;gap:11px;cursor:pointer;list-style:none;min-height:30px")}>
        <img src="/asa/aviso-importante.webp" alt="" style={css("width:30px;height:30px;object-fit:contain;flex:none")}/>
        <span style={css("font-size:12.5px;font-weight:700;color:#8a5a00;flex:1")}>{plural(vazios.length, "bloco sem ninguém", "blocos sem ninguém")}</span>
        <span className="esc-vazios-ver" style={css("font-size:11.5px;font-weight:700;color:#8a5a00")}>ver quais</span>
      </summary>
      <ul style={css("margin:10px 0 2px;padding:0;list-style:none;display:flex;flex-direction:column;gap:5px")}>
        {vazios.map((b) => <li key={b.key} style={css("display:flex;align-items:center;gap:10px;font-size:12px;color:#5b4a1f")}>
          <span style={css("font-family:'JetBrains Mono',monospace;font-weight:700;width:96px;flex:none")}>{faixa(b)}</span>
          <span style={css("flex:1;min-width:0")}>{textoDoBloco(b)}</span>
          {canEdit && b.regra !== "ninguem" && <button type="button" className="esc-cell-adjust esc-hit" onClick={() => setAjustando(b)}>Ajustar</button>}
        </li>)}
      </ul>
    </details>}

    {conflitos.length > 0 && <div style={css("display:flex;flex-direction:column;gap:9px;background:#fff;border:1px solid #f0dcd9;border-radius:14px;padding:13px 15px;")}>
      <div style={css("display:flex;flex-wrap:wrap;align-items:center;gap:10px")}>
        <img src="/asa/aviso-importante.webp" alt="" style={css("width:28px;height:28px;object-fit:contain;flex:none")}/>
        <span style={css("flex:none;font-family:Outfit,sans-serif;font-size:15px;font-weight:600;color:#8a3a33")}>Mesma pessoa em dois lugares</span>
        <span style={css("font-size:11.5px;color:#6b6482")}>{`${plural(new Set(conflitos.map((c) => c.pessoaId)).size, "pessoa em duas coisas", "pessoas em duas coisas")} ao mesmo tempo · eu aviso, quem decide é a supervisão da atividade · alerta — não bloqueia a publicação`}</span>
      </div>
      {gruposDeConflito.map((g) => {
        const ini = g.a.inicio > g.b.inicio ? g.a.inicio : g.b.inicio;
        const fim = [g.a.fim ?? g.a.inicio, g.b.fim ?? g.b.inicio].sort()[0];
        const tiraveis = [g.a, g.b].filter((bloco) => bloco.regra !== "livro");
        return <div key={`${g.a.key}-${g.b.key}`} style={css("display:flex;flex-direction:column;gap:8px;border:1px solid #f2e7e5;background:#fffbfa;border-radius:12px;padding:11px 13px")}>
          <div style={css("display:flex;flex-wrap:wrap;align-items:center;gap:9px")}>
            <span style={css("font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;color:#8a3a33")}>{fim > ini ? `${ini}–${fim}` : ini}</span>
            <span style={css("font-size:13px;font-weight:700;color:#2b2545")}>{`${textoDoBloco(g.a)}  ×  ${textoDoBloco(g.b)}`}</span>
            <span style={css("font-size:11.5px;color:#6b6482")}>{plural(g.pessoas.length, "pessoa", "pessoas")}</span>
          </div>
          <span style={css("font-size:11.5px;color:#6b6482;line-height:1.45;text-wrap:pretty")}>{g.a.regra === "livro" || g.b.regra === "livro" ? "O show tem prioridade, mas não decide sozinho: quem responde pela atividade escolhe de qual a pessoa sai. Tirar do show é no Livro do Dia." : "Duas coisas ao mesmo tempo e nenhuma tem prioridade. Quem responde pela atividade escolhe de qual a pessoa sai."}</span>
          <div style={css("display:flex;flex-wrap:wrap;gap:6px")}>
            {g.pessoas.map((c) => {
              const pode = canEdit && (editableAreaIds === null || (c.areaId !== null && editableAreaIds.includes(c.areaId)));
              return <span key={c.pessoaId} style={css("display:inline-flex;align-items:center;gap:6px;border:1px solid #efe3e1;background:#fff;border-radius:999px;padding:3px 4px 3px 10px;font-size:12px;font-weight:700;color:#2b2545")}>
                {c.pessoa}
                {pode && tiraveis.map((bloco) => <button key={bloco.key} type="button" className="esc-cell-adjust esc-hit" aria-label={`Tirar ${c.pessoa} de ${textoDoBloco(bloco)}`} disabled={tirando === `${c.pessoaId}|${bloco.key}`} onClick={async () => { setTirando(`${c.pessoaId}|${bloco.key}`); try { await onAdjust(bloco, c.pessoaId, "REMOVER"); } finally { setTirando(""); } }}>
                  {tirando === `${c.pessoaId}|${bloco.key}` ? "Tirando…" : `Tirar de ${textoDoBloco(bloco)}`}
                </button>)}
              </span>;
            })}
          </div>
        </div>;
      })}
    </div>}

    {dia.escala?.alteradaDesde && <div style={css("display:flex;align-items:flex-start;gap:12px;background:#fff8ec;border:1px solid #f0dcb8;border-radius:14px;padding:13px 15px;")}>
      <img src="/asa/aviso-importante.webp" alt="" style={css("width:30px;height:30px;object-fit:contain;flex:none")}/>
      <span style={css("font-size:12px;color:#7a5a1c;line-height:1.5;flex:1;text-wrap:pretty")}>{`Um Livro do Dia mudou o elenco depois da publicação (${hhmm(dia.escala.alteradaDesde)}). A escala já foi atualizada sozinha — o livro é a fonte para blocos de show. Republique para avisar quem foi afetado.`}</span>
    </div>}

    {!dia.programacao && <div style={css("padding:16px;text-align:center;font-size:12.5px;color:#6b6482;background:#fff;border:1px dashed #ddd6ee;border-radius:12px")}>{`${dia.location.name} não tem Programação vigente para ${shortDate(dia.date)} — a grade mostra só os Livros do Dia e as entradas manuais.`}</div>}

    <div style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top left", width: `${10000 / zoom}%` }}>
      {view === "pessoa" ? <div className="esc-scroll" style={css("border:1px solid #ddd6ee;border-radius:12px;overflow:auto;background:#fff;")}>
        <table style={css("border-collapse:separate;border-spacing:0;width:100%;font-size:12.5px")}>
          <thead><tr>
            <th style={css("position:sticky;left:0;z-index:2;width:118px;min-width:118px;" + MONO_TH)}>Horário</th>
            {cols.map((p) => {
              const away = p.folga ? FOLGA[p.folga] ?? FOLGA.OUTRO : null;
              const n = blocosDe(p.id).length;
              return <th key={p.id} style={css("text-align:left;background:" + (away ? away.tone.bg : "#f5f3fb") + ";border-bottom:1px solid #ddd6ee;border-right:1px solid #eae5f5;padding:8px 10px;min-width:132px;font-weight:600;")}>
                <div style={css("display:flex;align-items:center;gap:7px")}>
                  <span style={css("width:24px;height:24px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700;color:#fff;" + (away ? "background:#c8c1dd;" : "background:linear-gradient(135deg,#8b5cf6,#3b45d9);"))}>{initials(p.name)}</span>
                  <div style={css("display:flex;flex-direction:column;gap:1px;min-width:0")}>
                    <span style={css("font-size:12.5px;font-weight:700;color:#2b2545")}>{p.name}</span>
                    <span style={css("font-size:11.5px;font-weight:600;" + (away ? "color:" + away.tone.fg + ";" : "color:#6b6482;font-weight:500;"))}>{away ? `${away.label.toLocaleLowerCase("pt-BR")} o dia todo` : `${p.areaName ?? "sem área"} · ${plural(n, "bloco", "blocos")}`}</span>
                  </div>
                </div>
              </th>;
            })}
          </tr></thead>
          <tbody>
            {faixas.map((f, ri) => {
              const vazio = f.blocos.filter((b) => b.vazio);
              return <tr key={faixa(f)}>
                <td style={css("position:sticky;left:0;z-index:1;background:#fbfaff;border-right:1px solid #ddd6ee;border-bottom:1px solid #eee9f7;padding:7px 11px;vertical-align:middle;")}>
                  <span style={css("font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;color:" + (vazio.length ? "#B06E00" : "#3d3559"))}>{faixa(f)}</span>
                </td>
                {cols.map((p) => {
                  const away = p.folga ? FOLGA[p.folga] ?? FOLGA.OUTRO : null;
                  if (away) return <td key={p.id} style={css("position:relative;border-bottom:1px solid " + (ri === faixas.length - 1 ? "#eee9f7" : "transparent") + ";border-right:1px solid #f3f0fa;padding:0 6px;vertical-align:middle;min-width:138px;background:repeating-linear-gradient(135deg," + away.tone.bg + "," + away.tone.bg + " 7px,#ffffff 7px,#ffffff 14px);")}>
                    {ri === 0 && <div style={css("display:flex;align-items:center;justify-content:center;font-family:'JetBrains Mono',monospace;font-size:11.5px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:" + away.tone.fg + ";background:" + away.tone.bg + ";border:1px solid " + away.tone.bd + ";border-radius:7px;padding:6px 4px;white-space:nowrap;")}>{`${away.label} — dia todo`}</div>}
                  </td>;
                  const list = f.blocos.filter((b) => b.pessoaIds.includes(p.id));
                  return <td key={p.id} style={css("position:relative;border-bottom:1px solid #eee9f7;border-right:1px solid #f3f0fa;padding:5px 6px;vertical-align:middle;min-width:138px;")}>
                    {list.length ? <div style={css("display:flex;flex-direction:column;gap:3px;")}>{list.map((b) => blockEl(b, emConflito.has(`${p.name}|${b.key}`) ? "box-shadow:0 0 0 1.5px #C2453C inset;" : ""))}</div> : <span style={css("display:block;padding:6px 9px;font-size:12px;color:#d5cfe4;")}>—</span>}
                  </td>;
                })}
              </tr>;
            })}
            {!faixas.length && <tr><td colSpan={cols.length + 1} style={css("padding:16px;text-align:center;font-size:12.5px;color:#6b6482")}>Nenhum bloco neste dia.</td></tr>}
          </tbody>
        </table>
      </div> : <div style={css("border:1px solid #ddd6ee;border-radius:12px;overflow:hidden;background:#fff;")}>
        <table style={css("border-collapse:separate;border-spacing:0;width:100%;font-size:12.5px")}>
          <thead><tr>
            <th style={css(MONO_TH)}>Horário</th>
            <th style={css(MONO_TH)}>Atividade</th>
            <th style={css(MONO_TH.replace("border-right:1px solid #ddd6ee;", ""))}>Quem faz</th>
          </tr></thead>
          <tbody>
            {faixas.flatMap((f) => f.blocos.map((b, gi) => {
              const tone = toneOf(b);
              const who = b.pessoaIds.filter((id) => team === "todos" || dia.pessoas.find((p) => p.id === id)?.areaId === team);
              return <tr key={b.key}>
                <td style={css("border-right:1px solid #ddd6ee;border-bottom:1px solid #eee9f7;padding:7px 11px;vertical-align:middle;background:#fbfaff;width:130px;")}>
                  {gi === 0 && <div style={css("display:flex;flex-direction:column;gap:1px")}><span style={css("font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;color:#3d3559")}>{faixa(f)}</span></div>}
                </td>
                <td style={css("border-bottom:1px solid #eee9f7;border-right:1px solid #f3f0fa;padding:6px 9px;vertical-align:middle;width:210px;")}>{blockEl(b, "display:inline-flex;")}</td>
                <td style={css("border-bottom:1px solid #eee9f7;padding:6px 9px;vertical-align:middle;")}>
                  <div style={css("display:flex;flex-wrap:wrap;gap:5px;align-items:center")}>
                    {who.map((id) => <span key={id} style={css("display:inline-flex;align-items:center;gap:5px;border:1px solid #e6e1f2;background:#fff;border-radius:999px;padding:3px 10px 3px 4px;font-size:11.5px;font-weight:600;color:#3d3559;")}>
                      <span style={css("width:18px;height:18px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'JetBrains Mono',monospace;font-size:8px;font-weight:700;color:#fff;background:linear-gradient(135deg,#8b5cf6,#3b45d9);")}>{initials(personName(id))}</span>
                      <span>{personName(id)}</span>
                    </span>)}
                    {b.regra !== "ninguem" && (b.vazio ? <span style={css("display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:4px 10px;font-size:11.5px;font-weight:700;background:#fff4e4;color:#B06E00;border:1px dashed #f0d8b0;")}>sem ninguém · defina quem entra</span>
                      : <span style={css("font-size:10.5px;color:#6b6482;margin-left:2px")}>{plural(who.length, "pessoa", "pessoas")}</span>)}
                    {canEdit && b.regra !== "ninguem" && <button type="button" className="esc-cell-adjust esc-hit" onClick={() => setAjustando(b)}>Ajustar</button>}
                    {onRemoveManual && b.origem === "manual" && b.allocationId && <button type="button" className="esc-cell-adjust esc-hit" onClick={() => void onRemoveManual(b.allocationId!)}>Tirar do dia</button>}
                  </div>
                </td>
              </tr>;
            }))}
          </tbody>
        </table>
      </div>}
    </div>
    <div style={css("height:16px")}/>
    {ajustando && <AjusteCelulaDialog bloco={ajustando} pessoas={dia.pessoas} editableAreaIds={editableAreaIds} onClose={() => setAjustando(null)} onAdjust={async (pessoaId, action) => {
      await onAdjust(ajustando, pessoaId, action);
      // A grade recarrega em segundo plano, mas o diálogo continua aberto.
      // Espelha a alteração localmente para não oferecer uma ação desatualizada.
      setAjustando((current) => current ? {
        ...current,
        pessoaIds: action === "ADICIONAR"
          ? [...new Set([...current.pessoaIds, pessoaId])]
          : current.pessoaIds.filter((id) => id !== pessoaId),
      } : current);
    }}/>} 
  </div>;
}

function AjusteCelulaDialog({ bloco, pessoas, editableAreaIds, onClose, onAdjust }: { bloco: Bloco; pessoas: Pessoa[]; editableAreaIds: string[] | null; onClose: () => void; onAdjust: (pessoaId: string, action: "ADICIONAR" | "REMOVER") => Promise<void> }) {
  const [busca, setBusca] = useState("");
  const [saving, setSaving] = useState("");
  const elegiveis = pessoas.filter((p) => !p.folga && (editableAreaIds === null || (p.areaId !== null && editableAreaIds.includes(p.areaId))) && `${p.name} ${p.areaName ?? ""}`.toLocaleLowerCase("pt-BR").includes(busca.toLocaleLowerCase("pt-BR")));
  const executar = async (pessoa: Pessoa, action: "ADICIONAR" | "REMOVER") => {
    setSaving(`${pessoa.id}:${action}`);
    try { await onAdjust(pessoa.id, action); } finally { setSaving(""); }
  };
  return <div className="shows-dialog-backdrop" role="presentation"><div className="shows-dialog" role="dialog" aria-modal="true" aria-label={`Ajustar ${textoDoBloco(bloco)}`}>
    <header className="shows-dialog-header"><div><h2>Ajustar bloco</h2><p>{`${textoDoBloco(bloco)} · ${faixa(bloco)}`}</p></div><button type="button" onClick={onClose} aria-label="Fechar"><X size={18}/></button></header>
    <div className="shows-dialog-content" style={css("display:flex;flex-direction:column;gap:12px")}>
      <p style={css("margin:0;font-size:12.5px;line-height:1.5;color:#5b5473")}>Este ajuste vale só para este dia; a Programação não muda. Em show com Livro do Dia, a vaga muda no Livro também.</p>
      <input autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar pessoa ou área" aria-label="Buscar pessoa para ajustar" style={css("width:100%;box-sizing:border-box;border:1px solid #ddd6ee;border-radius:10px;padding:10px 12px;font:600 12.5px Manrope,sans-serif;color:#2b2545;background:#fff;")}/>
      <div style={css("display:flex;flex-direction:column;gap:7px")}>{elegiveis.map((p) => {
        const entra = bloco.pessoaIds.includes(p.id);
        const action = entra ? "REMOVER" : "ADICIONAR";
        return <div key={p.id} style={css("display:flex;align-items:center;gap:10px;border:1px solid #ebe6f6;border-radius:11px;padding:10px 12px")}> 
          <span style={css("width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#8b5cf6,#3b45d9);color:#fff;font:700 10px 'JetBrains Mono',monospace")}>{initials(p.name)}</span>
          <span style={css("display:flex;flex-direction:column;gap:1px;min-width:0;flex:1")}><strong style={css("font-size:12.5px;color:#2b2545")}>{p.name}</strong><span style={css("font-size:11.5px;color:#6b6482")}>{p.areaName ?? "Sem área"}</span></span>
          <button type="button" className="esc-hit" disabled={Boolean(saving)} onClick={() => void executar(p, action)} style={css(action === "REMOVER" ? btn("ghost") + "padding:7px 12px" : btn("primary") + "padding:7px 12px")}>{saving === `${p.id}:${action}` ? "Salvando…" : action === "REMOVER" ? "Tirar" : "Colocar"}</button>
        </div>;
      })}</div>
      {!elegiveis.length && <span style={css("font-size:12px;color:#6b6482;padding:8px 0")}>Nenhuma pessoa disponível neste filtro.</span>}
    </div>
    <footer className="shows-dialog-footer"><button type="button" onClick={onClose} className="shows-secondary">Concluído</button></footer>
  </div></div>;
}

/* ---------- rodapé: áreas prontas e publicação ---------- */
// O último local escolhido fica guardado neste aparelho; se ele sumir da lista, volta ao primeiro.
const LOCAL_KEY = "myasa-escalas-local";
function lembrarLocal(list: { id: string }[]): string | undefined {
  try { const id = localStorage.getItem(LOCAL_KEY); if (id && list.some((l) => l.id === id)) return id; } catch { /* sem armazenamento */ }
  return list[0]?.id;
}
function guardarLocal(id: string) { try { localStorage.setItem(LOCAL_KEY, id); } catch { /* sem armazenamento */ } }

function Rodape({ role, tab, onMinha = false, dia, minha, areasMinhas, saving, busy = "", onGerar, onPronta, onPublicar, onManual }: { role: Role; tab: string; onMinha?: boolean; dia: Dia | null; minha: Minha | null; areasMinhas: string[]; saving: boolean; busy?: string; onManual?: () => void; onGerar: () => void; onPronta: (areaId: string, pronta: boolean) => void; onPublicar: (republicar: boolean) => void }) {
  const isMem = role === "mem" || onMinha, isDir = role === "dir", isAdm = role === "adm";
  let note = "";
  const actions: ReactNode[] = [];
  // Atalhos do desenho 15: folga e troca moram em Folgas e solicitações; aqui só levam até lá.
  if (!isMem && !isDir && tab === "escala") actions.push(<Link key="folga" href="/folgas" className="esc-hit" style={css(btn("ghost") + ";text-decoration:none")}>Folga</Link>, <Link key="troca" href="/solicitacoes" className="esc-hit" style={css(btn("ghost") + ";text-decoration:none")}>Registrar troca</Link>);
  if (isMem) {
    const minhas = minha?.escalas?.length ? minha.escalas : minha?.escalaId ? [{ confirmada: minha.confirmada, confirmedAt: minha.confirmedAt }] : [];
    const pendente = minhas.some((e) => !e.confirmada);
    const confirmadaEm = minhas.map((e) => e.confirmedAt).filter((v): v is string => Boolean(v)).sort().pop();
    note = minha?.publicada ? `Publicada${minha.publishedAt ? ` às ${hhmm(minha.publishedAt)}` : ""} · ${pendente || !confirmadaEm ? "você ainda não confirmou" : `confirmada às ${hhmm(confirmadaEm)}`}` : "A escala deste dia ainda não foi publicada — quando sair, ela aparece aqui.";
  } else if (dia) {
    const prontas = dia.areas.filter((a) => a.pronta);
    const faltam = dia.areas.filter((a) => !a.pronta);
    const published = dia.escala && dia.escala.status !== "DRAFT";
    if (tab === "prog") note = "Programação é o molde: muda os próximos dias que ainda não foram publicados. Dia publicado não muda sozinho.";
    else if (!dia.escala) note = "Gere o dia para criar a Escala e os Livros dos Shows programados como rascunho.";
    else if (dia.escala.alteradaDesde) note = "Versão publicada preservada · ao republicar, quem foi afetado recebe a escala e o livro atualizados";
    else if (published) note = `Publicada${dia.escala.publishedAt ? ` às ${hhmm(dia.escala.publishedAt)}` : ""} · ${dia.areas.length} ${dia.areas.length === 1 ? "área" : "áreas"} · a mesma escalação está no Livro do Dia`;
    else note = `Rascunho · ${prontas.length} de ${dia.areas.length} áreas prontas${faltam.length ? ` · falta ${faltam.map((a) => a.name).join(", ")}` : ""} · publica a Administração`;
    if (tab === "escala" && isAdm && !dia.escala) actions.push(<button key="generate" type="button" className="esc-hit" disabled={saving} onClick={onGerar} style={css(btn("primary"))}>{busy === "gerar" ? "Gerando Escala e Livros…" : "Gerar Escala e Livros"}</button>);
    // Atividade que só existe hoje (prova de figurino, reunião de última hora): não mexe no molde da Programação.
    if (tab === "escala" && isAdm && dia.escala && onManual) actions.push(<button key="manual" type="button" className="esc-hit" disabled={saving} onClick={onManual} style={css(btn("ghost"))}>Atividade só de hoje</button>);
    if (tab === "escala" && !isDir && !published) {
      for (const areaId of areasMinhas) {
        const area = dia.areas.find((a) => a.id === areaId);
        if (!area) continue;
        actions.push(<button key={areaId} type="button" className="esc-hit" disabled={saving} onClick={() => onPronta(areaId, !area.pronta)} style={css(btn(area.pronta ? "ghost" : "primary"))}>{busy === `pronta:${areaId}` ? "Salvando…" : area.pronta ? `Desmarcar ${area.name}` : `Marcar ${area.name} como pronta`}</button>);
      }
      if (isAdm && dia.escala) actions.push(<button key="pub" type="button" className="esc-hit" disabled={saving || faltam.length > 0} title={faltam.length ? `Faltam: ${faltam.map((a) => a.name).join(", ")}` : undefined} onClick={() => onPublicar(false)}
        style={css(faltam.length ? "border-radius:999px;padding:9px 17px;font-size:12.5px;font-weight:700;font-family:Manrope,sans-serif;border:none;background:#e6e1f2;color:#6b6482;cursor:default" : btn("primary"))}>{faltam.length ? `Publicar conjunto · faltam ${faltam.length}` : busy === "publicar" ? "Publicando…" : "Publicar Escala e Livros"}</button>);
    }
    if (tab === "escala" && isAdm && dia.escala?.alteradaDesde) actions.push(<button key="repub" type="button" className="esc-hit" disabled={saving} onClick={() => onPublicar(true)} style={css(btn("primary"))}>{busy === "publicar" ? "Republicando…" : "Republicar conjunto"}</button>);
  }
  const areas = !isMem && tab === "escala" && dia ? dia.areas : [];
  return <footer className="esc-pad" style={css("display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:12px 20px;border-top:1px solid #ebe6f6;background:#fff")}>
    {areas.length > 0 && <div style={css("display:flex;flex-wrap:wrap;gap:6px;width:100%")}>
      {areas.map((a) => {
        const chip = "display:inline-flex;align-items:center;gap:6px;flex:none;font-size:11.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;white-space:nowrap;padding:3px 9px;border-radius:999px;background:" + (a.pronta ? "#e2f4f2" : "#fdf7e8") + ";color:" + (a.pronta ? "#0b6b64" : "#8a6413");
        const label = `${a.name} · ${a.pronta ? `pronta${a.pronta.por ? ` (${a.pronta.por})` : ""}` : "falta"}`;
        // Administração pode marcar qualquer área (ex.: Produção, cuja supervisão não fica num local só).
        return isAdm && dia && (!dia.escala || dia.escala.status === "DRAFT")
          ? <button key={a.id} type="button" className="esc-hit" disabled={saving} aria-pressed={Boolean(a.pronta)} title={a.pronta ? "Desmarcar" : "Marcar como pronta"} onClick={() => onPronta(a.id, !a.pronta)} style={css(chip + ";border:none;cursor:pointer;font-family:Manrope,sans-serif")}>{label}</button>
          : <span key={a.id} style={css(chip)}>{label}</span>;
      })}
    </div>}
    <span style={css("font-size:12px;color:#6b6482")}>{note}</span>
    <span style={css("flex:1")}/>
    {actions}
  </footer>;
}

/* ---------- Minha escala (Elenco) ---------- */
function MinhaEscala({ minha, date, onHoje, onConfirm, saving }: { minha: Minha; date: string; onHoje: () => void; onConfirm: (escala: MinhaLocal) => Promise<void>; saving: boolean }) {
  if (!minha.publicada) return <div style={css("display:flex;flex-direction:column;gap:12px;max-width:640px;padding-bottom:18px")}>
    <div style={css("padding:16px;text-align:center;font-size:12.5px;color:#6b6482;background:#fff;border:1px dashed #ddd6ee;border-radius:12px")}>{`A escala de ${relOf(date)} ainda não foi publicada. Quando sair, seus blocos aparecem aqui — e só os seus.`}</div>
    {date !== todayISO() && <button type="button" className="esc-hit" onClick={onHoje} style={css(btn("ghost") + "align-self:flex-start;")}>Ver a escala de hoje</button>}
  </div>;
  const escalas = minha.escalas?.length ? minha.escalas : minha.location && minha.escalaId && minha.escalaVersion ? [{ location: minha.location, publishedAt: minha.publishedAt, folga: minha.folga, confirmada: minha.confirmada, confirmedAt: minha.confirmedAt, escalaId: minha.escalaId, escalaVersion: minha.escalaVersion, blocos: minha.blocos ?? [] }] : [];
  return <div style={css("display:flex;flex-direction:column;gap:18px;max-width:640px;padding-bottom:18px")}>{escalas.map((escala) => <MinhaEscalaLocal key={escala.escalaId} minha={escala} date={date} onHoje={onHoje} onConfirm={() => onConfirm(escala)} saving={saving}/>)}</div>;
}

function MinhaEscalaLocal({ minha, date, onHoje, onConfirm, saving }: { minha: MinhaLocal; date: string; onHoje: () => void; onConfirm: () => Promise<void>; saving: boolean }) {
  const primeiro = minha.blocos[0];
  const ultimo = minha.blocos[minha.blocos.length - 1];
  return <div style={css("display:flex;flex-direction:column;gap:12px;max-width:640px;padding-bottom:18px")}>
    <div style={css("display:flex;align-items:center;gap:13px;background:linear-gradient(120deg,#1c1440,#3a2278);border-radius:16px;padding:15px 18px;color:#fff")}>
      <img src="/asa/lembrete.webp" alt="" style={css("width:58px;height:58px;object-fit:contain;flex:none")}/>
      <div style={css("display:flex;flex-direction:column;gap:4px")}>
        <span style={css("font-family:Outfit,sans-serif;font-size:17px;font-weight:600")}>{minha.folga ? `Você está de folga ${relOf(date)}` : `Sua escala de ${relOf(date)} saiu`}</span>
        <span style={css("font-size:13px;color:#d6cff5;line-height:1.45")}>{minha.folga ? "Folga é o dia inteiro — você não entra em nenhum bloco." : primeiro ? `${plural(minha.blocos.length, "bloco", "blocos")}, entrada ${primeiro.inicio} e saída ${ultimo.fim ?? ultimo.inicio}. O check-in abre no seu primeiro horário — ${primeiro.inicio} — e vale para o dia inteiro.` : "Nenhum bloco seu neste dia."}</span>
      </div>
    </div>
    <div style={css("display:flex;align-items:center;gap:11px;border:1px solid " + (minha.confirmada ? "#cfeae6" : "#e6d3ac") + ";background:" + (minha.confirmada ? "#f3fbfa" : "#fffaf0") + ";border-radius:13px;padding:12px 14px;")}>
      <img src={minha.confirmada ? "/asa/tarefa-concluida.webp" : "/asa/lembrete.webp"} alt="" style={css("width:34px;height:34px;object-fit:contain;flex:none")}/>
      <span style={css("display:flex;flex-direction:column;gap:2px;flex:1")}><strong style={css("font-size:12.5px;color:" + (minha.confirmada ? "#0E6E66" : "#7a5a1c"))}>{minha.confirmada ? "Escala confirmada" : "Confira sua escala"}</strong><span style={css("font-size:11.5px;color:#6b6482;line-height:1.4")}>{minha.confirmada ? `Ciente${minha.confirmedAt ? ` às ${hhmm(minha.confirmedAt)}` : ""}.` : `Confirme que você viu os horários de ${relOf(date)}.`}</span></span>
      {!minha.confirmada && <button type="button" className="esc-hit" disabled={saving} onClick={() => void onConfirm()} style={css(btn("primary"))}>{saving ? "Confirmando…" : "Confirmar escala"}</button>}
    </div>
    {!minha.folga && <div style={css("display:flex;flex-wrap:wrap;gap:8px")}>
      <Link href="/check-in" className="esc-hit" style={css(btn("ghost") + "text-decoration:none;")}>Informar ausência</Link>
      <Link href="/solicitacoes" className="esc-hit" style={css(btn("ghost") + "text-decoration:none;")}>Pedir troca ou horário</Link>
    </div>}
    {minha.blocos.map((b) => {
      const tone = toneOf(b);
      const livro = Boolean(b.dailyBookId) && b.dailyBookStatus !== "DRAFT";
      const row = <>
        <div style={css("display:flex;flex-direction:column;gap:2px;width:104px;flex:none")}>
          <span style={css("font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:700;color:#3d3559")}>{b.inicio}</span>
          <span style={css("font-size:10.5px;color:#6b6482")}>{durLabel(b.inicio, b.fim)}</span>
        </div>
        <div style={css("display:flex;flex-direction:column;gap:3px;min-width:0;flex:1")}>
          <span style={css("font-size:14px;font-weight:600")}>{textoDoBloco(b)}</span>
          <span style={css("font-size:12px;color:#6b6482")}>{`${minha.location?.name ?? ""}${b.regra === "livro" ? " · Livro do Dia" + (b.dailyBookStatus === "DRAFT" ? " em preparação" : " publicado") : ""}`}</span>
        </div>
        {livro && <span style={css("flex:none;font-size:11px;font-weight:700;color:#6C2BF2;")}>abrir Livro do Dia →</span>}
        {b.regra === "livro" && <span style={css("flex:none;font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:4px 8px;border-radius:6px;background:" + tone.bg + ";color:" + tone.fg + ";")}>show</span>}
      </>;
      const rowStyle = "display:flex;align-items:center;gap:14px;background:#fff;border:1px solid #e6e1f2;border-radius:13px;padding:13px 16px;text-decoration:none;color:inherit;" + (livro ? "cursor:pointer;" : "");
      return livro ? <Link key={b.key} href="/livro-do-dia" style={css(rowStyle)}>{row}</Link> : <div key={b.key} style={css(rowStyle)}>{row}</div>;
    })}
  </div>;
}

/* ---------- aba Programação: o molde ---------- */
const REGRA_LABEL: Record<Regra, string> = { todos: "Todo mundo do local", ninguem: "Sem participantes", area: "Por área", grupo: "Por grupo", pessoas: "Pessoas específicas", livro: "Show → Livro do Dia" };
function ProgramacaoTab({ review, localId, localName, date, dia, canEdit, onChanged }: { review: boolean; localId: string; localName: string; date: string; dia: Dia | null; canEdit: boolean; onChanged: () => void }) {
  const [list, setList] = useState<Programacao[]>([]);
  const [progId, setProgId] = useState("");
  const [wd, setWd] = useState(weekdayOf(date));
  const [sel, setSel] = useState("");
  const [shows, setShows] = useState<{ id: string; title: string }[]>([]);
  const [dialog, setDialog] = useState<"molde" | "bloco" | null>(null);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  const pessoas = dia?.pessoas ?? (review ? samplePessoas(localId) : []);
  const areas = dia?.areas ?? [];

  useEffect(() => {
    setError("");
    if (review) { const l = loadSampleProgramacoes(localId) as Programacao[]; setList(l); setShows(sampleShowsDoLocal(localId)); return; }
    customFetch<{ programacoes: Programacao[] }>(`/api/programacoes?locationId=${localId}`).then((r) => setList(r.programacoes.map((p) => ({ ...p, blocos: p.blocos.map((b) => ({ ...b, inicio: b.inicio.slice(0, 5), fim: b.fim ? b.fim.slice(0, 5) : null })) })))).catch(() => setError("Não consegui carregar a Programação."));
    customFetch<{ showBooks: { id: string; title: string; locationId?: string | null }[] }>("/api/show-books").then((r) => setShows(r.showBooks.filter((s) => s.locationId === localId))).catch(() => setShows([]));
  }, [review, localId, tick]);

  const hoje = todayISO();
  const estadoDe = (p: Programacao) => p.vigenciaInicio <= hoje && hoje <= p.vigenciaFim ? "vigente" : p.vigenciaInicio > hoje ? "agendado" : "encerrado";
  const prog = list.find((p) => p.id === progId) ?? list.find((p) => estadoDe(p) === "vigente") ?? list[0];
  const blocosDia = (prog?.blocos ?? []).filter((b) => b.weekday === wd && b.active).sort((a, b) => a.inicio.localeCompare(b.inicio) || a.order - b.order);
  const bloco = blocosDia.find((b) => b.id === sel) ?? blocosDia[0];
  const areaName = (id: string) => areas.find((a) => a.id === id)?.name ?? id;
  const personName = (id: string) => pessoas.find((p) => p.id === id)?.name ?? id;
  const resumo = (b: ProgBloco) => b.regra === "todos" ? "todo mundo do local" : b.regra === "ninguem" ? "sem participantes" : b.regra === "livro" ? "Livro do show" : b.regra === "area" ? (b.areaIds.map((a) => `área ${areaName(a)}`).join(" + ") || "sem área escolhida") : b.regra === "grupo" ? (b.grupoIds.length ? plural(b.grupoIds.length, "grupo", "grupos") : "sem grupo escolhido") : (b.pessoaIds.map(personName).join(" + ") || "sem regra de quem entra");
  const resolved = (b: ProgBloco) => {
    const noDia = dia && weekdayOf(dia.date) === b.weekday ? dia.blocos.find((x) => x.blocoId === b.id) : undefined;
    if (noDia) return noDia.pessoaIds;
    if (b.regra === "todos") return pessoas.map((p) => p.id);
    if (b.regra === "area") return pessoas.filter((p) => p.areaId && b.areaIds.includes(p.areaId)).map((p) => p.id);
    if (b.regra === "pessoas") return b.pessoaIds;
    return [];
  };

  const salvarBloco = async (b: ProgBloco, patch: Partial<ProgBloco>) => {
    setError("");
    try {
      if (review) {
        const next = list.map((p) => p.id !== b.programacaoId ? p : { ...p, blocos: p.blocos.map((x) => x.id === b.id ? { ...x, ...patch } : x) });
        saveSampleProgramacoes(localId, next as SampleProgramacao[]); setList(next);
      } else {
        await customFetch(`/api/programacoes/${b.programacaoId}/blocos/${b.id}`, { method: "PATCH", body: JSON.stringify(patch) });
        setTick((n) => n + 1);
      }
      onChanged();
    } catch (err) { setError(err instanceof ApiError && err.data && typeof (err.data as { error?: unknown }).error === "string" ? (err.data as { error: string }).error : "Não consegui salvar o bloco."); }
  };
  const criarMolde = async (nome: string, inicio: string, fim: string) => {
    if (review) {
      const created: Programacao = { id: `sample-prog-${Date.now()}`, locationId: localId, nome, vigenciaInicio: inicio, vigenciaFim: fim, blocos: [] };
      const next = [...list, created]; saveSampleProgramacoes(localId, next as SampleProgramacao[]); setList(next); setProgId(created.id); return;
    }
    const r = await customFetch<{ programacao: Programacao }>("/api/programacoes", { method: "POST", body: JSON.stringify({ locationId: localId, nome, vigenciaInicio: inicio, vigenciaFim: fim }) });
    setProgId(r.programacao.id); setTick((n) => n + 1);
  };
  const criarBloco = async (value: Omit<ProgBloco, "id" | "programacaoId" | "order" | "active" | "grupoIds">) => {
    if (!prog) return;
    if (review) {
      const created: ProgBloco = { ...value, id: `${prog.id}-new-${Date.now()}`, programacaoId: prog.id, order: prog.blocos.length, active: true, grupoIds: [] };
      const next = list.map((p) => p.id === prog.id ? { ...p, blocos: [...p.blocos, created] } : p); saveSampleProgramacoes(localId, next as SampleProgramacao[]); setList(next); setSel(created.id); onChanged(); return;
    }
    const r = await customFetch<{ bloco: ProgBloco }>(`/api/programacoes/${prog.id}/blocos`, { method: "POST", body: JSON.stringify(value) });
    setSel(r.bloco.id); setTick((n) => n + 1); onChanged();
  };

  const estado = prog ? estadoDe(prog) : "encerrado";
  const isShow = bloco?.regra === "livro";
  const quem = bloco ? resolved(bloco) : [];
  return <div style={css("display:flex;flex-direction:column;gap:14px;padding-bottom:18px")}>
    {error && <div role="alert" style={css("padding:11px 13px;border-radius:12px;font-size:12px;line-height:1.5;background:#fdeceb;border:1px solid #f0bcbc;color:#a12c2c")}>{error}</div>}
    <div style={css("display:flex;flex-wrap:wrap;align-items:center;gap:8px")}>
      <span style={css("font-size:11.5px;font-weight:700;color:#6b6482;margin-right:2px")}>Molde</span>
      {list.map((p) => <button key={p.id} type="button" className="esc-hit" aria-pressed={p.id === prog?.id} onClick={() => setProgId(p.id)}
        style={css("border-radius:999px;padding:6px 13px;font-size:12px;cursor:pointer;font-family:Manrope,sans-serif;white-space:nowrap;" + (p.id === prog?.id ? "border:1px solid #6C2BF2;background:#f3ebff;color:#6C2BF2;font-weight:700;" : estadoDe(p) === "encerrado" ? "border:1px solid #ece7f8;background:#fff;color:#6b6482;font-weight:600;" : "border:1px solid #e6e1f2;background:#fff;color:#6b6482;font-weight:600;"))}>
        {`${p.nome} · ${shortDate(p.vigenciaInicio)}–${shortDate(p.vigenciaFim)}${estadoDe(p) === "vigente" ? " ✓" : ""}`}
        {p.id.startsWith("sample-prog-") && <span style={css("margin-left:7px;font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:2px 6px;border-radius:5px;background:#fdf3e4;color:#8a5a00")}>dado de exemplo</span>}
      </button>)}
      {canEdit && <button type="button" className="esc-hit" onClick={() => setDialog("molde")} style={css("border:1px dashed #cbc3e2;background:none;color:#6b6482;border-radius:999px;padding:6px 13px;font-size:12px;font-weight:600;cursor:pointer;font-family:Manrope,sans-serif;")}>+ molde</button>}
    </div>

    {!prog ? <div style={css("padding:16px;text-align:center;font-size:12.5px;color:#6b6482;background:#fff;border:1px dashed #ddd6ee;border-radius:12px")}>{`${localName} ainda não tem Programação. ${canEdit ? "Crie o primeiro molde — ele diz, por dia da semana, os horários e quem entra em cada bloco." : ""}`}</div> : <>
      <div style={css("display:flex;flex-wrap:wrap;align-items:center;gap:14px;background:#fff;border:1px solid #e6e1f2;border-radius:12px;padding:12px 15px")}>
        <div style={css("display:flex;flex-direction:column;gap:2px")}>
          <span style={css("font-family:'JetBrains Mono',monospace;font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:#6b6482")}>Vigência</span>
          <span style={css("font-size:13px;font-weight:600")}>{rangeLabel(prog.vigenciaInicio, prog.vigenciaFim)}</span>
        </div>
        <div style={css("display:flex;flex-direction:column;gap:2px")}>
          <span style={css("font-family:'JetBrains Mono',monospace;font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:#6b6482")}>Local</span>
          <span style={css("font-size:13px;font-weight:600")}>{localName}</span>
        </div>
        <span style={css("flex:none;font-size:11.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;white-space:nowrap;padding:3px 9px;border-radius:999px;background:" + (estado === "vigente" ? "#e2f4f2" : estado === "agendado" ? "#f1eafe" : "#f4f2fa") + ";color:" + (estado === "vigente" ? "#0b6b64" : estado === "agendado" ? "#6C2BF2" : "#6b6482"))}>{estado}</span>
        <span style={css("flex:1;min-width:20px")}/>
        <span style={css("font-size:11.5px;color:#6b6482;max-width:38ch;line-height:1.4;text-wrap:pretty")}>{estado === "agendado" ? "Este molde ainda não entrou em vigor: dá para montá-lo agora sem afetar a escala que está rodando." : estado === "encerrado" ? "Vigência já passou. Fica de histórico e pode ser duplicado para a próxima temporada." : "Molde em vigor: é ele que a Escala usa para abrir as necessidades deste local."}</span>
      </div>

      <div style={css("display:flex;align-items:center;gap:6px;flex-wrap:wrap")}>
        {WEEKDAYS.map(([w, label]) => <button key={w} type="button" className="esc-hit" aria-pressed={wd === w} onClick={() => { setWd(w); setSel(""); }}
          style={css("border-radius:9px;padding:7px 15px;font-size:12px;cursor:pointer;font-family:Manrope,sans-serif;" + (wd === w ? "border:1px solid #2b2545;background:#2b2545;color:#fff;font-weight:700;" : "border:1px solid #e6e1f2;background:#fff;color:#6b6482;font-weight:600;"))}>{label}</button>)}
      </div>

      <div className="esc-scroll" style={css("border:1px solid #ddd6ee;border-radius:12px;overflow:auto;background:#fff;max-width:900px")}>
        <table style={css("border-collapse:separate;border-spacing:0;width:100%;font-size:12.5px")}>
          <thead><tr>
            <th style={css("width:132px;" + MONO_TH)}>Horário</th>
            <th style={css(MONO_TH)}>Atividade</th>
            <th style={css("width:270px;" + MONO_TH.replace("border-right:1px solid #ddd6ee;", ""))}>Quem entra</th>
          </tr></thead>
          <tbody>
            {blocosDia.map((b) => {
              const t = toneOf(b), selected = b.id === bloco?.id;
              const tone = b.regra === "livro" ? "livro" : (b.regra === "ninguem" || (b.regra === "pessoas" && !b.pessoaIds.length)) ? "vazio" : "regra";
              const n = resolved(b).length;
              return <tr key={b.id} onClick={() => setSel(b.id)} style={{ cursor: "pointer" }}>
                <td style={css("border-right:1px solid #ddd6ee;border-bottom:1px solid #eee9f7;padding:8px 12px;font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;color:#3d3559;background:" + (selected ? "#f3ecff" : "#fbfaff") + ";")}>{faixa(b)}</td>
                <td style={css("border-bottom:1px solid #eee9f7;border-right:1px solid #eee9f7;padding:5px 8px;background:" + (selected ? "#faf6ff" : "transparent") + ";")}>
                  <span style={css("display:inline-block;border-radius:7px;padding:6px 10px;font-size:12px;font-weight:600;background:" + t.bg + ";color:" + t.fg + ";border:1px solid " + t.bd + ";")}>{textoDoBloco(b)}</span>
                </td>
                <td style={css("border-bottom:1px solid #eee9f7;padding:6px 12px;background:" + (selected ? "#faf6ff" : "transparent") + ";")}>
                  <span style={css("display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:4px 10px;font-size:11.5px;font-weight:700;max-width:230px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" + (tone === "livro" ? "background:#eef7f6;color:#0E6E66;border:1px solid #cfe8e5;" : tone === "vazio" ? "background:#f4f2fa;color:#6b6482;border:1px dashed #ddd6ee;" : "background:#f6f0ff;color:#6C2BF2;border:1px solid #e5d8fb;"))}>
                    {tone === "livro" && <span style={css("flex:none;font-family:'JetBrains Mono',monospace;font-size:8px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;opacity:.7;")}>fixo</span>}
                    <span>{resumo(b)}</span>
                  </span>
                  <span style={css("display:block;margin-top:3px;font-size:11.5px;color:#6b6482;")}>{b.regra === "livro" ? "o elenco do Livro do Dia" : b.regra === "ninguem" ? "nenhuma pessoa entra" : n ? plural(n, "pessoa", "pessoas") : "fica vazio e sinalizado na escala"}</span>
                </td>
              </tr>;
            })}
            {canEdit && <tr><td colSpan={3} onClick={() => setDialog("bloco")} style={css("padding:9px 12px;font-size:11.5px;color:#6b6482;cursor:pointer")}>+ bloco</td></tr>}
            {!blocosDia.length && !canEdit && <tr><td colSpan={3} style={css("padding:16px;text-align:center;font-size:12.5px;color:#6b6482")}>Nenhum bloco neste dia da semana.</td></tr>}
          </tbody>
        </table>
      </div>

      {bloco && <div style={css("display:flex;flex-direction:column;gap:13px;background:#fff;border:1px solid #ddd6ee;border-radius:14px;padding:15px 17px;max-width:900px;")}>
        <div style={css("display:flex;flex-wrap:wrap;align-items:center;gap:10px")}>
          <span style={css("font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:700;color:#3d3559")}>{faixa(bloco)}</span>
          <span style={css("font-family:Outfit,sans-serif;font-size:16px;font-weight:600")}>{textoDoBloco(bloco)}</span>
          <span style={css("flex:none;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:4px 9px;border-radius:999px;" + (isShow ? "background:#eef7f6;color:#0E6E66;" : "background:#f6f0ff;color:#6C2BF2;"))}>{isShow ? "show · livro manda" : "atividade · você monta"}</span>
          <span style={css("flex:1;min-width:16px")}/>
          <span style={css("font-size:11.5px;color:#6b6482;max-width:42ch;line-height:1.45;text-wrap:pretty")}>{isShow ? "Quem entra vem do livro deste show, no dia. Aqui não se edita: mude o livro e a escala acompanha." : "A escala guarda a regra, não a lista. Quem entra na área depois passa a aparecer sozinho."}</span>
        </div>
        {!isShow && <div style={css("display:flex;flex-direction:column;gap:11px;border-top:1px solid #f0ecf9;padding-top:12px")}>
          <div style={css("display:flex;flex-wrap:wrap;align-items:center;gap:7px")}>
            {(["ninguem", "todos", "area", "pessoas"] as Regra[]).map((r) => <button key={r} type="button" className="esc-hit" disabled={!canEdit} aria-pressed={bloco.regra === r} onClick={() => void salvarBloco(bloco, { regra: r as ProgBloco["regra"] })}
              style={css("border-radius:9px;padding:6px 12px;font-size:11.5px;font-family:Manrope,sans-serif;" + (canEdit ? "cursor:pointer;" : "cursor:default;") + (bloco.regra === r ? "border:1px solid #2b2545;background:#2b2545;color:#fff;font-weight:700;" : "border:1px solid #e6e1f2;background:#fff;color:#6b6482;font-weight:600;"))}>{REGRA_LABEL[r]}</button>)}
          </div>
          {bloco.regra === "area" && <div style={css("display:flex;flex-wrap:wrap;align-items:center;gap:7px")}>
            <span style={css("font-size:11px;font-weight:700;color:#6b6482;width:132px;flex:none")}>Áreas</span>
            {areas.map((a) => { const on = bloco.areaIds.includes(a.id); return <button key={a.id} type="button" className="esc-hit" disabled={!canEdit} aria-pressed={on} onClick={() => void salvarBloco(bloco, { areaIds: on ? bloco.areaIds.filter((x) => x !== a.id) : [...bloco.areaIds, a.id] })} style={css(on ? chipOn : chipOff)}>{a.name}</button>; })}
          </div>}
          {bloco.regra === "pessoas" && <div style={css("display:flex;flex-wrap:wrap;align-items:center;gap:7px")}>
            <span style={css("font-size:11px;font-weight:700;color:#6b6482;width:132px;flex:none")}>Pessoas específicas</span>
            {pessoas.map((p) => { const on = bloco.pessoaIds.includes(p.id); return <button key={p.id} type="button" className="esc-hit" disabled={!canEdit} aria-pressed={on} onClick={() => void salvarBloco(bloco, { pessoaIds: on ? bloco.pessoaIds.filter((x) => x !== p.id) : [...bloco.pessoaIds, p.id] })} style={css(on ? chipOn : chipOff)}>{p.name}</button>; })}
          </div>}
        </div>}
        <div style={css("display:flex;flex-direction:column;gap:8px;border-top:1px solid #f0ecf9;padding-top:12px")}>
          <div style={css("display:flex;flex-wrap:wrap;align-items:baseline;gap:9px")}>
            <span style={css("font-size:12.5px;font-weight:700;color:#2b2545")}>{`Quem entra ${dia && weekdayOf(dia.date) === bloco.weekday ? `em ${WEEKDAY_LONG[bloco.weekday]}, ${shortDate(dia.date)}` : `às ${WEEKDAY_LONG[bloco.weekday]}s`}`}</span>
            <span style={css("font-size:11px;color:#6b6482")}>{`${plural(quem.length, "pessoa entra", "pessoas entram")} · folga e recesso não entram`}</span>
          </div>
          <div style={css("display:grid;grid-template-columns:repeat(auto-fill,minmax(268px,1fr));gap:7px")}>
            {quem.map((id) => <div key={id} style={css("display:flex;align-items:center;gap:10px;padding:7px 10px;border-radius:10px;border:1px solid #e6e1f2;background:#fff;")}>
              <span style={css("width:7px;height:7px;border-radius:50%;flex:none;background:#0E8F86;")}/>
              <span style={css("font-size:13.5px;font-weight:600;flex:1;min-width:0;color:#2b2545;")}>{personName(id)}</span>
              <span style={css("font-size:11.5px;color:#6b6482;flex:none;")}>{isShow ? "no livro deste dia" : bloco.regra === "todos" ? "via todo mundo" : bloco.regra === "area" ? `via área ${pessoas.find((p) => p.id === id)?.areaName ?? ""}` : "pessoa específica"}</span>
            </div>)}
          </div>
          {!quem.length && <span style={css("font-size:11.5px;color:#6b6482;font-style:italic")}>{isShow ? "O Livro do Dia deste show ainda não tem ninguém para este dia." : "Nenhuma pessoa nesta regra — o bloco existe na programação, mas ninguém é convocado. Na escala ele aparece vazio e sinalizado."}</span>}
        </div>
        {canEdit && <div style={css("display:flex;justify-content:flex-end")}>
          <button type="button" className="esc-hit" onClick={() => void salvarBloco(bloco, { active: false })} style={css("border:1px solid #e6e1f2;background:#fff;color:#6b6482;border-radius:999px;padding:4px 10px;font-size:11.5px;font-weight:700;cursor:pointer;font-family:Manrope,sans-serif;flex:none;")}>tirar do molde</button>
        </div>}
      </div>}
    </>}

    {dialog === "molde" && <FormDialog title="Novo molde" onClose={() => setDialog(null)} onSubmit={async (f) => { await criarMolde(f.nome, f.inicio, f.fim); setDialog(null); }}
      fields={[{ name: "nome", label: "Nome (Natal, Normal, Baixa…)", type: "text" }, { name: "inicio", label: "Vigência — início", type: "date" }, { name: "fim", label: "Vigência — fim", type: "date" }]}/>}
    {dialog === "bloco" && <BlocoDialog weekday={wd} vocabulario={vocabularioDoLocal(review ? localId : localName.toLocaleLowerCase("pt-BR"))} areas={areas} shows={shows} onClose={() => setDialog(null)} onSubmit={async (v) => { await criarBloco(v); setDialog(null); }}/>}
  </div>;
}

function FormDialog({ title, fields, onClose, onSubmit }: { title: string; fields: { name: string; label: string; type: string }[]; onClose: () => void; onSubmit: (values: Record<string, string>) => Promise<void> }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => { event.preventDefault(); try { await onSubmit(values); } catch (err) { setError(err instanceof ApiError && err.data && typeof (err.data as { error?: unknown }).error === "string" ? (err.data as { error: string }).error : "Não consegui salvar."); } };
  return <div className="shows-dialog-backdrop"><div className="shows-dialog" role="dialog" aria-modal="true" aria-label={title}>
    <header className="shows-dialog-header"><h2>{title}</h2><button onClick={onClose} aria-label="Fechar"><X size={18}/></button></header>
    <div className="shows-dialog-content"><form id="esc-form" onSubmit={submit} className="shows-form">
      {fields.map((f) => <label key={f.name}>{f.label}<input required type={f.type} value={values[f.name] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}/></label>)}
      {error && <p role="alert" style={css("font-size:12px;color:#a12c2c")}>{error}</p>}
    </form></div>
    <footer className="shows-dialog-footer"><button form="esc-form" className="shows-primary">Salvar</button></footer>
  </div></div>;
}

function BlocoDialog({ weekday, vocabulario, areas, shows, onClose, onSubmit }: { weekday: number; vocabulario: string[]; areas: Area[]; shows: { id: string; title: string }[]; onClose: () => void; onSubmit: (v: Omit<ProgBloco, "id" | "programacaoId" | "order" | "active" | "grupoIds">) => Promise<void> }) {
  const [rotulo, setRotulo] = useState("");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [regra, setRegra] = useState<Regra>("pessoas");
  const [showBookId, setShowBookId] = useState("");
  const [areaIds, setAreaIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try { await onSubmit({ weekday, rotulo: rotulo.trim(), inicio, fim: fim || null, regra: regra as ProgBloco["regra"], showBookId: regra === "livro" ? showBookId || null : null, areaIds: regra === "area" ? areaIds : [], pessoaIds: [] }); }
    catch (err) { setError(err instanceof ApiError && err.data && typeof (err.data as { error?: unknown }).error === "string" ? (err.data as { error: string }).error : "Não consegui criar o bloco."); }
  };
  return <div className="shows-dialog-backdrop"><div className="shows-dialog" role="dialog" aria-modal="true" aria-label="Novo bloco">
    <header className="shows-dialog-header"><h2>{`Novo bloco · ${WEEKDAY_LONG[weekday]}`}</h2><button onClick={onClose} aria-label="Fechar"><X size={18}/></button></header>
    <div className="shows-dialog-content"><form id="esc-bloco" onSubmit={submit} className="shows-form">
      <label>Atividade (vocabulário da escala)<input required list="esc-vocab" value={rotulo} onChange={(e) => setRotulo(e.target.value.toLocaleUpperCase("pt-BR"))}/></label>
      <datalist id="esc-vocab">{vocabulario.map((v) => <option key={v} value={v}/>)}</datalist>
      <label>Início<input required type="time" value={inicio} onChange={(e) => setInicio(e.target.value)}/></label>
      <label>Fim (opcional)<input type="time" value={fim} onChange={(e) => setFim(e.target.value)}/></label>
      <label>Quem entra<select value={regra} onChange={(e) => setRegra(e.target.value as Regra)}>{(["livro", "area", "todos", "pessoas", "ninguem"] as Regra[]).map((r) => <option key={r} value={r}>{REGRA_LABEL[r]}</option>)}</select></label>
      {regra === "livro" && <label>Show<select required value={showBookId} onChange={(e) => setShowBookId(e.target.value)}><option value="">Escolha o show</option>{shows.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}</select></label>}
      {regra === "area" && <fieldset style={css("border:none;padding:0;display:flex;flex-wrap:wrap;gap:7px")}>{areas.map((a) => { const on = areaIds.includes(a.id); return <button key={a.id} type="button" onClick={() => setAreaIds(on ? areaIds.filter((x) => x !== a.id) : [...areaIds, a.id])} style={css(on ? chipOn : chipOff)}>{a.name}</button>; })}</fieldset>}
      {error && <p role="alert" style={css("font-size:12px;color:#a12c2c")}>{error}</p>}
    </form></div>
    <footer className="shows-dialog-footer"><button form="esc-bloco" className="shows-primary">Criar bloco</button></footer>
  </div></div>;
}

/* ---------- atividade só de hoje (entrada manual da Escala) ---------- */
function AtividadeDeHojeDialog({ pessoas, saving, onClose, onSubmit }: { pessoas: Pessoa[]; saving: boolean; onClose: () => void; onSubmit: (v: { pessoaId: string; rotulo: string; inicio: string; fim: string }) => Promise<void> }) {
  const [pessoaId, setPessoaId] = useState("");
  const [rotulo, setRotulo] = useState("");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const pronto = Boolean(pessoaId && rotulo.trim() && /^([01]\d|2[0-3]):[0-5]\d$/.test(inicio));
  const submit = (e: React.FormEvent) => { e.preventDefault(); if (pronto) void onSubmit({ pessoaId, rotulo: rotulo.trim(), inicio, fim }); };
  return <div className="shows-dialog-backdrop"><div className="shows-dialog" role="dialog" aria-modal="true" aria-label="Atividade só de hoje">
    <header className="shows-dialog-header"><div><h2>Atividade só de hoje</h2><p>Vale apenas neste dia — a Programação não muda.</p></div><button type="button" onClick={onClose} aria-label="Fechar"><X size={18}/></button></header>
    <div className="shows-dialog-content"><form id="esc-manual" onSubmit={submit} className="shows-form">
      <label>Quem faz
        <select value={pessoaId} onChange={(e) => setPessoaId(e.target.value)} required>
          <option value="">Escolha a pessoa</option>
          {pessoas.filter((p) => !p.folga).map((p) => <option key={p.id} value={p.id}>{p.areaName ? `${p.name} · ${p.areaName}` : p.name}</option>)}
        </select>
      </label>
      <label>O que é<input value={rotulo} onChange={(e) => setRotulo(e.target.value)} placeholder="Prova de figurino" maxLength={60} required/></label>
      <label>Começa às<input type="time" value={inicio} onChange={(e) => setInicio(e.target.value)} required/></label>
      <label>Termina às (opcional)<input type="time" value={fim} onChange={(e) => setFim(e.target.value)}/></label>
    </form></div>
    <footer className="shows-dialog-footer">
      <button type="button" onClick={onClose} className="shows-secondary">Cancelar</button>
      <button form="esc-manual" className="shows-primary" disabled={!pronto || saving}>{saving ? "Salvando…" : "Pôr no dia"}</button>
    </footer>
  </div></div>;
}