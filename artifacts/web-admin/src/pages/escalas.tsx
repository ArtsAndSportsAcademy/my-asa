import { type CSSProperties, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { Plus, Printer, X } from "lucide-react";
import { ApiError, customFetch } from "@workspace/api-client-react";
import { css } from "@/lib/dc-style";
import { GerarMesDialog } from "@/components/gerar-mes-dialog";
import {
  addDays, loadSampleEscala, loadSampleProgramacoes, sampleAreasSupervisionadas, sampleDia, sampleLocais, samplePessoas,
  sampleShowsDoLocal, saveSampleEscala, saveSampleProgramacoes, todayISO, vocabularioDoLocal, type SampleEscalaState, type SampleProgramacao,
} from "@/lib/review-escala";
import { AtencaoDoDia, type ConflitoDaPessoa, type GrupoDeConflito } from "@/components/escala/atencao-do-dia";
import { fraseDoBuraco, type TempoDisponivel } from "@/components/escala/tempo-disponivel";
import { BlocoMenu } from "@/components/escala/bloco-menu";
import { GradePessoa } from "@/components/escala/grade-pessoa";
import { ResumoDoDia, soNoutroLocal, trabalhaNoDia } from "@/components/escala/resumo-do-dia";
import { QuemResumido } from "@/components/escala/quem-resumido";
import { resumirQuem, resumoDoBloco, type PessoaDoDia } from "@/components/escala/resumo-de-quem";
import { TIPOS, ehExcecao, faixa, foraDoChoque, quandoDoDia, resolverTipo, textoDoBloco, textoDoEncurtado, toneDoTipo, type TipoDoLocal } from "@/components/escala/tipos";
import { TipoSelect } from "@/components/escala/tipo-select";
import { ChamadasDialog, ChamadasLista, gravarChamadas, primeiroErro, resumoDaChamada, type ChamadaDaApi, type ChamadaRascunho } from "@/components/escala/chamadas-editor";
import { TiposDialog } from "@/components/escala/tipos-dialog";
import { EquipeDialog } from "@/components/escala/equipe-dialog";
import { LocalDoDiaDialog, type MudarDeLocal } from "@/components/escala/local-do-dia-dialog";
import { EditarAtividadeDialog, type EdicaoDaAtividade } from "@/components/escala/editar-atividade-dialog";
import "@/components/escala/escala-tokens.css";
import { diaQueAEscalaAbre, type ViradaDoDia } from "@/lib/dia-da-escala";
import { SaiuDialog, type PreviaDaSaida, type SaiuApi } from "@/components/escala/saiu-dialog";
import { AtividadeLoteDialog } from "@/components/escala/atividade-lote-dialog";
import { PublicarDialog } from "@/components/escala/publicar-dialog";
import { CopiarDiaDialog, type CopiaFeita } from "@/components/escala/copiar-dia-dialog";
import { TirarShowDialog } from "@/components/escala/tirar-show-dialog";
import { RefazerDiaDialog } from "@/components/escala/refazer-dia-dialog";
import { ShowLinha } from "@/components/escala/show-linha";
import "./shows.css"; // a janela do Ajustar usa .shows-dialog: sem isto ela não rola e o rodapé some quando a Escala abre direto
import "./escalas.css";

/* A camada visual é cópia de design_handoff_my_asa/telas/15 Escalas.dc.html (quadro web, sem a
   moldura de documentação): cada string de estilo é a do arquivo, convertida por `css()`.
   Duas abas — Escala (o dia, abre primeiro) e Programação (o molde). Elenco vê só "Minha escala". */

type Role = "adm" | "dir" | "sup" | "mem";
type Regra = "todos" | "ninguem" | "area" | "grupo" | "pessoas" | "livro";
export type Bloco = { key: string; rotulo: string; inicio: string; fim: string | null; origem: "programacao" | "livro" | "manual" | "solicitacao" | "chamada"; regra: Regra | null; pessoaIds: string[]; vazio: boolean; sinal: string | null; showBookId: string | null; dailyBookId: string | null; dailyBookStatus: string | null; blocoId: string | null; allocationId?: string | null; allocationIds?: string[]; vagas?: VagaDoLivro[]; showTipo?: string | null; tipoId?: string | null; horarioDela?: { chaveOriginal: string; inicio: string; fim: string | null }; /** Bloco flexível: janela, sem nomes e sem choque. */ flexivel?: boolean; /** Quem saiu deste bloco geral por ter atividade específica no mesmo horário. */ cedeu?: { userId: string; para: string }[]; /** Bloco geral encurtado para quem tem outra atividade no começo ou no fim dele. */ encurtado?: { original: { inicio: string; fim: string | null }; por: string[] }; /** Como a Programação convoca o bloco: elenco todo ou áreas (a lista de nomes vira o rótulo curto). */ quemRegra?: "todos" | "area"; areaNomes?: string[]; /** Atividade editada só neste dia (0087): o que a Programação manda e quando foi editada (versão, para dois navegadores não se atropelarem). */ editadoNoDia?: { original: { rotulo: string; inicio: string; fim: string | null; tipoId: string | null }; motivo: string | null; em: string }; /** Chamada (0086): horário em que as pessoas da atividade têm que estar prontas. */ chamada?: { chamadaId: string; nome: string; ocupaTempo: boolean; avisar: boolean; dona: "sessao" | "bloco" | "dia"; atividade: { key: string; rotulo: string; inicio: string } } };
/** Personagem de um bloco que vem de Livro do Dia: quem o faz hoje (ou ninguém, se a vaga está aberta). */
type VagaDoLivro = { assignmentId: string; personagem: string; userId: string | null };
/** Uma mexida no bloco; com `assignmentId`, vale para aquele personagem e não para "a primeira vaga aberta". */
type Mudanca = { userId: string; action: "ADICIONAR" | "REMOVER"; assignmentId?: string };
export type Pessoa = { id: string; name: string; areaId: string | null; areaName: string | null; folga: string | null; chamadaNaFolga?: { motivo: string | null; decidida: boolean }; noutroLocal?: { localId: string; localNome: string; inicio: string; fim: string | null; atividades: number }[]; /** Da equipe de outro local hoje, sem nada aqui: não aparece nem conta nesta Escala. */ foraDoLocal?: true };
type Area = { id: string; name: string; supervisores: { id: string; name: string }[]; pronta: { por: string | null; em: string } | null; prontaTirada?: { por: string | null; em: string } | null };
/** Alguém de outra área mexeu na escala desta pessoa: quem mexeu e o quê, para a Supervisão da pessoa ver. */
export type Mexida = { pessoaId: string; pessoaNome: string; pessoaAreaNome: string | null; porId: string; porNome: string; porAreaNome: string | null; em: string; texto: string };
export type ShowTiradoDoDia = { dailyBookId: string; rotulo: string; inicio: string | null; fim: string | null; porNome: string | null; em: string | null; motivo: string | null };
export type Dia = { date: string; location: { id: string; name: string }; escala: { id: string; status: string; version: number; publishedAt: string | null; alteradaDesde: string | null } | null; programacao: { id: string; nome: string; vigenciaInicio: string; vigenciaFim: string } | null; areas: Area[]; pessoas: Pessoa[]; blocos: Bloco[]; mexidas?: Mexida[]; tipos?: TipoDoLocal[]; fechado?: { motivo: string };
  /** Shows que a Escala tirou deste dia ("Tirar este show do dia"): fora da grade, com o botão de voltar ao dia. */
  showsTirados?: ShowTiradoDoDia[];
  /** Equipe por local (pacote O): quem tem equipe na temporada mas nenhuma neste dia, e quem está em duas coisas em locais diferentes que não cabem. */
  semLocalHoje?: string[]; choquesEntreLocais?: ChoqueEntreLocais[];
  /** Tempo disponível (pacote G): só chega para a Administração e a Supervisão, com o aviso ligado no local. */
  tempoDisponivel?: TempoDisponivel;
  /** Mudanças de local só deste dia (imprevisto): onde a pessoa trabalha hoje em vez do que a Programação manda. */
  imprevistos?: ImprevistoDoDia[] };
export type ImprevistoDoDia = { id: string; pessoaId: string; localId: string; localNome: string; inicio: string | null; fim: string | null; motivo: string | null; porNome: string | null };
type LocalDoDiaApi = { mover: (v: MudarDeLocal & { userId: string }) => Promise<{ erro: string | null; imprevistoId?: string }>; desfazer: (id: string) => Promise<string | null>; locais: { id: string; name: string }[] };
export type ChoqueEntreLocais = { pessoaId: string; tipo: "mesmo_horario" | "sem_tempo"; aqui: { key: string; rotulo: string; inicio: string; fim: string | null }; la: { key: string; localId: string; localNome: string; rotulo: string; inicio: string; fim: string | null }; minutosDeIda?: number; minutosDeFolga?: number };
type Local = { id: string; name: string; podeEditar: boolean; areasSupervisionadas: string[]; viradaDoDia?: ViradaDoDia };
type ProgBloco = SampleProgramacao["blocos"][number] & { tipoId?: string | null; flexivel?: boolean; semSessao?: boolean; chamadas?: ChamadaDaApi[] };
type Programacao = { id: string; locationId: string; nome: string; vigenciaInicio: string; vigenciaFim: string; active?: boolean; blocos: ProgBloco[] };
type MinhaLocal = { location: { id: string; name: string }; publishedAt?: string | null; folga?: string | null; confirmada?: boolean; confirmedAt?: string | null; escalaId: string; escalaVersion: number; blocos: Omit<Bloco, "pessoaIds">[]; tipos?: TipoDoLocal[] };
type Minha = { date: string; publicada: boolean; escalas?: MinhaLocal[]; location?: { id: string; name: string } | null; publishedAt?: string | null; folga?: string | null; confirmada?: boolean; confirmedAt?: string | null; escalaId?: string | null; escalaVersion?: number | null; blocos?: Omit<Bloco, "pessoaIds">[] };

/* ---------- valores do .dc.html ---------- */
const T = {
  aula: { bg: "var(--asa-aula-bg)", fg: "var(--asa-aula-fg)", bd: "var(--asa-aula-bd)" },
  show: { bg: "var(--asa-show-bg)", fg: "var(--asa-purple)", bd: "var(--asa-show-bd)" },
  prep: { bg: "var(--asa-prep-bg)", fg: "var(--asa-prep-fg)", bd: "var(--asa-prep-bd)" },
  refeicao: { bg: "var(--asa-refeicao-bg)", fg: "var(--asa-label)", bd: "var(--asa-refeicao-bd)" },
  ausente: { bg: "var(--asa-ausente-bg)", fg: "var(--asa-ausente-fg)", bd: "var(--asa-ausente-bd)" },
  ferias: { bg: "var(--asa-ferias-bg)", fg: "var(--asa-ferias-fg)", bd: "var(--asa-ferias-bd)" },
  vaga: { bg: "var(--asa-vaga-bg)", fg: "var(--asa-vaga-fg)", bd: "var(--asa-vaga-bd)" },
};
type Tone = typeof T.aula;
const STATUS: Record<string, { bg: string; fg: string }> = {
  publicada: { bg: "var(--asa-prep-bg)", fg: "var(--asa-prep-fg)" },
  rascunho: { bg: "var(--asa-vaga-bg)", fg: "var(--asa-vaga-fg)" },
  "sem escala": { bg: "var(--asa-ferias-bg)", fg: "var(--asa-label)" },
  "carregando…": { bg: "var(--asa-ferias-bg)", fg: "var(--asa-label)" },
  "não carregou": { bg: "var(--asa-error-bg)", fg: "var(--asa-error-fg)" },
  "alteração em rascunho": { bg: "var(--asa-ausente-bg)", fg: "var(--asa-ausente-fg)" },
};
const pillBase = "border:none;border-radius:999px;padding:6px 13px;font-size:12px;cursor:pointer;font-family:Manrope,sans-serif;font-weight:600;";
const pillOn = pillBase + "background:#fff;color:var(--asa-ink-dark);font-weight:700;box-shadow:0 1px 3px rgba(40,20,90,.14);";
const pillOff = pillBase + "background:none;color:var(--asa-label);";
const MONO_TH = "text-align:left;background:var(--asa-bg-tinted);border-bottom:1px solid var(--asa-line-soft);border-right:1px solid var(--asa-line-soft);padding:9px 11px;font-family:'JetBrains Mono',monospace;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--asa-label);font-weight:700";
const blockStyle = (tone: Tone, extra = "") => "display:flex;align-items:baseline;gap:6px;border-radius:7px;padding:6px 9px;font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;background:" + tone.bg + ";color:" + tone.fg + ";border:1px solid " + tone.bd + ";" + extra;
const btn = (kind: "primary" | "ghost") => "border-radius:999px;padding:9px 17px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:Manrope,sans-serif;" + (kind === "primary" ? "border:none;background:linear-gradient(135deg,var(--asa-purple),var(--asa-aula-fg));color:#fff;" : "border:1px solid var(--asa-line);background:#fff;color:var(--asa-ink-medium);");
const chipBase = "border-radius:999px;padding:5px 11px;font-size:12px;cursor:pointer;font-family:Manrope,sans-serif;white-space:nowrap;";
const chipOn = chipBase + "border:1px solid var(--asa-purple-border);background:var(--asa-chip-on);color:var(--asa-purple);font-weight:700;";
const chipOff = chipBase + "border:1px dashed var(--asa-line-soft);background:#fff;color:var(--asa-chip-off);font-weight:600;";
import { REVIEW_PERSON } from "@/lib/amostra";
import { useFecharComEsc } from "@/lib/fechar-com-esc";
import { mensagemDoErro } from "@/lib/mensagem-do-erro";

/* ---------- datas ---------- */
const WEEKDAY_LONG = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
const WEEKDAYS: [number, string][] = [[0, "Dom"], [1, "Seg"], [2, "Ter"], [3, "Qua"], [4, "Qui"], [5, "Sex"], [6, "Sáb"]];
const MONTH = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const MON3 = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const partsOf = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return { y, m, d, dt: new Date(y, m - 1, d) }; };
const weekdayOf = (iso: string) => partsOf(iso).dt.getDay();
const fullDate = (iso: string) => { const { y, m, d } = partsOf(iso); return `${d} de ${MONTH[m - 1]} de ${y}`; };
const shortDate = (iso: string) => { const { m, d } = partsOf(iso); return `${d} ${MON3[m - 1]}`; };
// A vigência leva o ano quando não é o deste ano ("6 de out — 31 de dez de 2027"): sem ele, uma Programação que acaba no ano que vem parecia acabar agora.
const rangeLabel = (a: string, b: string) => {
  const x = partsOf(a), y = partsOf(b), agora = partsOf(todayISO()).y;
  const anoDe = (p: { y: number }) => (x.y !== y.y || p.y !== agora ? ` de ${p.y}` : "");
  return `${x.d} de ${MON3[x.m - 1]}${x.y !== y.y ? anoDe(x) : ""} — ${y.d} de ${MON3[y.m - 1]}${anoDe(y)}`;
};
const relOf = (iso: string) => {
  const diff = Math.round((partsOf(iso).dt.getTime() - partsOf(todayISO()).dt.getTime()) / 86_400_000);
  return diff === 0 ? "hoje" : diff === 1 ? "amanhã" : diff === -1 ? "ontem" : diff > 1 ? `em ${diff} dias` : `há ${-diff} dias`;
};
const hhmm = (iso: string | null | undefined) => { if (!iso) return ""; const d = new Date(iso); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
const minutes = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + (m || 0); };
const durLabel = (a: string, b: string | null) => { if (!b) return ""; const d = minutes(b) - minutes(a); return d >= 60 ? `${Math.floor(d / 60)}h${d % 60 ? String(d % 60).padStart(2, "0") : ""}` : `${d} min`; };
const initials = (name: string) => name.normalize("NFD").replace(/[̀-ͯ]/g, "").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
const plural = (n: number, um: string, muitos: string) => `${n} ${n === 1 ? um : muitos}`;

/** Cor do bloco: vem do tipo (show pelo Livro, almoço, treino, ensaio…), com contraste forte. O nome do tipo continua escrito no bloco. */
function toneOf(b: { rotulo: string; regra: Regra | null; tipoId?: string | null }, tipos?: TipoDoLocal[]): Tone {
  return toneDoTipo(resolverTipo(b, tipos).cor);
}
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
  // Quem prepara o dia abre em amanhã; o Elenco abre em hoje (é o dia do show dele). Um atalho que já sabe
  // o dia (ex.: "Republicar a escala de hoje", no Meu Dia) manda ?data= e a tela abre nele.
  const dataPedida = useMemo(() => { const p = new URLSearchParams(window.location.search).get("data"); return p && /^\d{4}-\d{2}-\d{2}$/.test(p) ? p : null; }, []);
  // Quem já escolheu o dia (atalho com ?data= ou clique) não é levado a outro quando a lista de locais chega.
  const jaEscolheuODia = useRef(Boolean(dataPedida));
  const [date, setDateEscolhido] = useState(() => dataPedida ?? (isMem ? todayISO() : diaQueAEscalaAbre(new Date(), null, todayISO())));
  const setDate = useCallback((d: string) => { jaEscolheuODia.current = true; setDateEscolhido(d); }, []);
  const [cal, setCal] = useState(false);
  const [locais, setLocais] = useState<Local[]>([]);
  const [localId, setLocalId] = useState("");
  const [opMenu, setOpMenu] = useState(false);
  // null = fechado; { bloco: null } = nova atividade; { bloco } = corrigir a atividade daquele bloco.
  const [manual, setManual] = useState<{ bloco: Bloco | null } | null>(null);
  const [chamadasDoDia, setChamadasDoDia] = useState<Bloco | null>(null);
  const [regrasAbertas, setRegrasAbertas] = useState(false);
  const [gerarMesAberto, setGerarMesAberto] = useState(false);
  // "Copiar de outro dia": a janela aberta e, depois de copiar, a faixa com o "Desfazer cópia" (um evento do Registro por dia copiado).
  const [copiarAberto, setCopiarAberto] = useState(false);
  // "Refazer os Livros deste dia": a janela que mostra o que será refeito antes de gravar.
  const [refazerAberto, setRefazerAberto] = useState(false);
  const [copiaFeita, setCopiaFeita] = useState<{ texto: string; eventoIds: string[]; desfazendo: boolean; desfeita?: boolean } | null>(null);
  // Publicar e republicar pedem confirmação: a janela diz quantas pessoas são avisadas, quais Livros saem juntos e o que ainda pede atenção.
  const [confirmandoPublicacao, setConfirmandoPublicacao] = useState<{ republicar: boolean } | null>(null);
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
  // Atividade posta no dia para várias pessoas: o desfazer tira todas as entradas criadas de uma vez.
  const [desfazerLote, setDesfazerLote] = useState<{ texto: string; escalaId: string; ids: string[] } | null>(null);
  const diaRef = useRef<Dia | null>(null);

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

  // O dia em que a Escala abre vem da virada do local (Locais): à noite abre no dia seguinte, de manhã volta a hoje.
  useEffect(() => {
    if (isMem || jaEscolheuODia.current || !localId) return;
    const l = locais.find((x) => x.id === localId);
    if (l) setDateEscolhido(diaQueAEscalaAbre(new Date(), l.viradaDoDia, todayISO()));
  }, [localId, locais, isMem]);

  // Trocar de local ou de dia esvazia a grade na hora: sem isso, a Escala do local anterior ficava na tela
  // por 2 a 3 segundos e dava para ajustar uma pessoa achando que era o outro local.
  useEffect(() => { setDia(null); setMinha(null); }, [localId, date]);

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
          if (!cancelled) { setDia({ ...tempoDeAmostra(extrasDeAmostra({ ...d, mexidas: mexidasDeAmostra(d) }), role) }); setAreasMinhas(role === "sup" ? sampleAreasSupervisionadas(me, localId) : []); }
          return;
        }
        const r = await customFetch<{ dia: Dia; areasSupervisionadas: string[] }>(`/api/escalas/dia?locationId=${localId}&date=${date}`);
        if (!cancelled) { setDia(r.dia); setAreasMinhas(r.areasSupervisionadas); }
      } catch { if (!cancelled) setError(isMem ? "Não consegui carregar a sua escala." : "Não consegui montar a Atividade do dia."); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [review, localId, date, isMem, showMinha, refresh]);

  diaRef.current = dia;
  useEffect(() => { if (!desfazerLote) return; const id = window.setTimeout(() => setDesfazerLote(null), 12000); return () => window.clearTimeout(id); }, [desfazerLote]);
  const local = locais.find((l) => l.id === localId);
  const meusBlocos = minha?.escalas?.flatMap((escala) => escala.blocos) ?? minha?.blocos ?? [];
  const operationLabel = isMem ? (minha?.escalas && minha.escalas.length > 1 ? "Mais de um local" : minha?.escalas?.[0]?.location.name ?? minha?.location?.name ?? "—") : (local?.name ?? "—");

  // O menu de locais fecha com Esc e ao tocar fora dele (no telefone não há outro jeito de sair sem escolher).
  useEffect(() => {
    if (!opMenu) return;
    const fecharComEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpMenu(false); };
    const fecharAoTocarFora = (e: PointerEvent) => { const alvo = e.target as Element | null; if (!alvo?.closest("[role=menu]") && !alvo?.closest("button[aria-haspopup=menu]")) setOpMenu(false); };
    document.addEventListener("keydown", fecharComEsc);
    document.addEventListener("pointerdown", fecharAoTocarFora);
    return () => { document.removeEventListener("keydown", fecharComEsc); document.removeEventListener("pointerdown", fecharAoTocarFora); };
  }, [opMenu]);

  // O seletor de local (e o aviso "somente leitura" da Direção): no computador mora no cabeçalho do shell; no telefone o cabeçalho some
  // e o mesmo seletor entra na barra do dia, para a grade subir (uma linha a menos, ~70 px).
  const seletorDeLocal = (noTelefone: boolean) => <div className={noTelefone ? "esc-db-local esc-so-tel" : "esc-hdr-local"} style={css("position:relative;display:flex;align-items:center;gap:12px")}>
      {isDir && <span style={css("font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--asa-readonly-fg);background:var(--asa-readonly-bg);padding:5px 10px;border-radius:999px;")}>somente leitura</span>}
      <button type="button" className="esc-hit" aria-haspopup="menu" aria-expanded={opMenu} disabled={isMem || locais.length < 2} onClick={() => setOpMenu((v) => !v)}
        style={css("display:flex;flex:none;white-space:nowrap;align-items:center;gap:8px;border:1px solid var(--asa-line);background:#fff;border-radius:999px;padding:6px 12px;font-size:13.5px;font-weight:600;color:var(--asa-ink-medium);font-family:Manrope,sans-serif;" + (!isMem && locais.length > 1 ? "cursor:pointer;" : "cursor:default;") + (isMem ? "opacity:.75;" : ""))}>
        <span style={css("width:8px;height:8px;border-radius:50%;background:var(--asa-ok-fg)")}/>
        <span style={css("flex:none;white-space:nowrap")}>{operationLabel}</span>
        {!isMem && locais.length > 1 && <span style={css("flex:none;color:var(--asa-label);font-weight:500")}>▾</span>}
      </button>
      {opMenu && <div role="menu" style={css("position:absolute;" + (window.innerWidth < 720 ? "left:0;max-width:calc(100vw - 32px);" : "right:0;") + "top:44px;z-index:30;width:206px;background:#fff;border:1px solid var(--asa-line-soft);border-radius:12px;padding:6px;box-shadow:0 22px 40px -20px rgba(40,20,90,.45);display:flex;flex-direction:column;gap:2px;")}>
        {locais.map((l) => <button key={l.id} type="button" role="menuitem" onClick={() => { setLocalId(l.id); guardarLocal(l.id); setOpMenu(false); }}
          style={css("text-align:left;border:none;background:" + (localId === l.id ? "var(--asa-show-bg)" : "none") + ";color:" + (localId === l.id ? "var(--asa-purple)" : "var(--asa-ink-medium)") + ";border-radius:8px;padding:8px 10px;font-size:12px;font-weight:" + (localId === l.id ? "700" : "600") + ";cursor:pointer;font-family:Manrope,sans-serif;min-height:44px")}>{l.name}</button>)}
      </div>}
    </div>;

  // Cabeçalho do shell: "somente leitura" (Direção) e o seletor de local, como no quadro.
  useEffect(() => {
    onHeader?.(seletorDeLocal(false));
    return () => onHeader?.(null);
  }, [operationLabel, locais, localId, opMenu, isDir, isMem]);

  /* ---------- escrita ---------- */
  const errMsg = (err: unknown, fallback: string) => err instanceof ApiError && err.data && typeof err.data === "object" && typeof (err.data as { message?: unknown }).message === "string" ? (err.data as { message: string }).message : fallback;
  const marcarPronta = async (areaIds: string[], pronta: boolean) => {
    if (!dia || !areaIds.length) return;
    setSaving(true); setBusy(areaIds.length > 1 ? "pronta:todas" : `pronta:${areaIds[0]}`); setError("");
    try {
      if (review) {
        const cur: SampleEscalaState = loadSampleEscala(localId, date) ?? { status: "DRAFT", version: 1, prontas: {}, publishedAt: null, alteradaDesde: null };
        const prontas = { ...cur.prontas };
        for (const areaId of areaIds) { if (pronta) prontas[areaId] = { por: me, em: new Date().toISOString() }; else delete prontas[areaId]; }
        saveSampleEscala(localId, date, { ...cur, prontas });
      } else {
        for (const areaId of areaIds) await customFetch("/api/escalas/dia/pronta", { method: "POST", body: JSON.stringify({ locationId: localId, date, areaId, pronta }) });
      }
      setRefresh((n) => n + 1);
    } catch (err) { setError(errMsg(err, "Não consegui marcar a área.")); } finally { setSaving(false); setBusy(""); }
  };
  const aoFecharCopia = (feitas: CopiaFeita[], origemCopiada: string | null) => {
    setCopiarAberto(false);
    const comEvento = feitas.filter((f) => f.eventoId);
    if (!comEvento.length) { if (feitas.length) setRefresh((n) => n + 1); return; }
    const itens = comEvento.reduce((n, f) => n + f.itens, 0);
    setCopiaFeita({
      texto: `Copiei ${plural(itens, "item", "itens")}${origemCopiada ? ` de ${shortDate(origemCopiada)}` : ""} para ${comEvento.length === 1 ? shortDate(comEvento[0]!.date) : `${comEvento.length} dias`}.`,
      eventoIds: comEvento.map((f) => f.eventoId!), desfazendo: false,
    });
    setRefresh((n) => n + 1);
  };
  const desfazerCopia = async () => {
    if (!copiaFeita || copiaFeita.desfazendo) return;
    setCopiaFeita({ ...copiaFeita, desfazendo: true });
    const frases: string[] = [];
    let desfeitos = 0;
    for (const eventoId of copiaFeita.eventoIds) {
      try { const r = await customFetch<{ ok: boolean; message: string }>("/api/escalas/dia/copiar/desfazer", { method: "POST", body: JSON.stringify({ eventoId }) }); if (r.ok) desfeitos += 1; else frases.push(r.message); }
      catch (err) { frases.push(errMsg(err, "Não consegui desfazer um dos dias. Nada foi alterado nele.")); }
    }
    // Quem desfez precisa ver que terminou (crivo 14): a faixa fica alguns segundos com a frase, sem o botão; o que não deu certo vai para o aviso de erro.
    if (desfeitos) {
      const texto = `Desfiz a cópia ${desfeitos === 1 ? "de 1 dia" : `de ${desfeitos} dias`}.${frases.length ? " Em parte dos dias, nem tudo voltou: veja o aviso." : ""}`;
      setCopiaFeita({ texto, eventoIds: [], desfazendo: false, desfeita: true });
      window.setTimeout(() => setCopiaFeita((atual) => (atual?.desfeita ? null : atual)), 6000);
    } else setCopiaFeita(null);
    if (frases.length) setError(frases.join(" "));
    setRefresh((n) => n + 1);
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
        if (!republicar && faltam.length) { setError(`Faltam enviar a parte: ${faltam.join(", ")}.`); return; }
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
  const ajustarCelulaEmLote = async (bloco: Bloco, mudancas: Mudanca[], motivo?: string) => {
    if (!dia || !localId || !mudancas.length) return;
    setSaving(true); setBusy("ajuste"); setError("");
    try {
      if (review) {
        const cur: SampleEscalaState = loadSampleEscala(localId, date) ?? { status: "DRAFT", version: 1, prontas: {}, publishedAt: null, alteradaDesde: null };
        const ajustes = { ...(cur.ajustes ?? {}), [bloco.key]: { ...(cur.ajustes?.[bloco.key] ?? {}), ...Object.fromEntries(mudancas.map((m) => [m.userId, m.action])) } };
        saveSampleEscala(localId, date, { ...cur, ajustes, alteradaDesde: cur.status === "DRAFT" ? cur.alteradaDesde : (cur.alteradaDesde ?? new Date().toISOString()), version: cur.status === "DRAFT" ? cur.version : cur.version + 1 });
      } else {
        await customFetch("/api/escalas/dia/ajustes", { method: "POST", body: JSON.stringify({ locationId: localId, date, sourceKey: bloco.key, mudancas, motivo }) });
      }
      setRefresh((n) => n + 1);
    } catch (err) {
      if (recusaPorRegra(err)) throw err; // o diálogo mostra a regra e pede o motivo
      setError(errMsg(err, "Não consegui ajustar esta célula."));
      setRefresh((n) => n + 1); // se parte do lote chegou a gravar, a grade volta como ficou
    } finally { setSaving(false); setBusy(""); }
  };
  // Horário só de uma pessoa (0080). Devolve a frase do erro (ou null) para a janela mostrar o motivo de verdade.
  const mudarHorario = async (bloco: Bloco, pessoaId: string, horario: { inicio: string; fim: string | null; motivo?: string } | null): Promise<string | null> => {
    if (!dia || !localId) return null;
    setSaving(true); setBusy("ajuste"); setError("");
    try {
      if (review) {
        const cur: SampleEscalaState = loadSampleEscala(localId, date) ?? { status: "DRAFT", version: 1, prontas: {}, publishedAt: null, alteradaDesde: null };
        const horarios = { ...(cur.horarios ?? {}) };
        if (horario) horarios[`${bloco.key}|${pessoaId}`] = { inicio: horario.inicio, fim: horario.fim }; else delete horarios[`${bloco.key}|${pessoaId}`];
        saveSampleEscala(localId, date, { ...cur, horarios, alteradaDesde: cur.status === "DRAFT" ? cur.alteradaDesde : (cur.alteradaDesde ?? new Date().toISOString()), version: cur.status === "DRAFT" ? cur.version : cur.version + 1 });
      } else {
        await customFetch("/api/escalas/dia/horario", { method: "POST", body: JSON.stringify({ locationId: localId, date, sourceKey: bloco.key, userId: pessoaId, ...(horario ? { inicio: horario.inicio, fim: horario.fim, motivo: horario.motivo } : { voltar: true }) }) });
      }
      setRefresh((n) => n + 1);
      return null;
    } catch (err) {
      const frase = errMsg(err, "Não consegui mudar o horário agora. Nada foi alterado; tente de novo.");
      setError(frase);
      setRefresh((n) => n + 1);
      return frase;
    } finally { setSaving(false); setBusy(""); }
  };
  /** Imprevisto do dia (pacote O): mudar uma pessoa de local só por hoje, e desfazer. Devolvem a frase do erro (a janela a mostra) ou null. */
  const moverDeLocal = async (v: MudarDeLocal & { userId: string }): Promise<{ erro: string | null; imprevistoId?: string }> => {
    if (!dia || !localId) return { erro: null };
    if (review) return { erro: "No modo de amostra não dá para mudar a pessoa de local. Abra com a conta de teste para ver." };
    setSaving(true); setBusy("ajuste"); setError("");
    try {
      const r = await customFetch<{ imprevistoId?: string }>("/api/escalas/dia/local-do-dia", { method: "POST", body: JSON.stringify({ locationId: localId, date, userId: v.userId, destinoId: v.destinoId, origemId: v.origemId, inicio: v.inicio, fim: v.fim, motivo: v.motivo || undefined }) });
      setRefresh((n) => n + 1);
      return { erro: null, imprevistoId: r.imprevistoId };
    } catch (err) { return { erro: errMsg(err, "Não consegui mudar a pessoa de local agora. Nada foi alterado; tente de novo.") }; }
    finally { setSaving(false); setBusy(""); }
  };
  const desfazerImprevisto = async (id: string): Promise<string | null> => {
    if (!dia || !localId) return null;
    if (review) return "No modo de amostra não há o que desfazer.";
    setSaving(true); setBusy("ajuste"); setError("");
    try {
      await customFetch("/api/escalas/dia/local-do-dia/desfazer", { method: "POST", body: JSON.stringify({ id, locationId: localId }) });
      setRefresh((n) => n + 1);
      return null;
    } catch (err) { const frase = errMsg(err, "Não consegui desfazer agora. Nada foi alterado; tente de novo."); setError(frase); return frase; }
    finally { setSaving(false); setBusy(""); }
  };
  /** Editar a atividade só neste dia (0087): nome, horário para todos e tipo. Devolve a frase do erro (a janela a mostra) ou null. */
  const editarAtividade = async (bloco: Bloco, edicao: EdicaoDaAtividade | null): Promise<string | null> => {
    if (!dia || !localId) return null;
    if (review) return "No modo de amostra não dá para editar a atividade. Abra com a conta de teste para ver.";
    setSaving(true); setBusy("ajuste"); setError("");
    try {
      await customFetch("/api/escalas/dia/editar", { method: "POST", body: JSON.stringify({ locationId: localId, date, sourceKey: bloco.key, baseEditadaEm: bloco.editadoNoDia?.em ?? null, ...(edicao ? { rotulo: edicao.rotulo, inicio: edicao.inicio, fim: edicao.fim, tipoId: edicao.tipoId, motivo: edicao.motivo } : { voltar: true }) }) });
      setRefresh((n) => n + 1);
      return null;
    } catch (err) {
      const frase = errMsg(err, "Não consegui editar a atividade agora. Nada foi alterado; tente de novo.");
      setRefresh((n) => n + 1);
      return frase;
    } finally { setSaving(false); setBusy(""); }
  };
  /** Tirar este show do dia (30/10/2026): o show normal não vai acontecer neste dia. Devolve a frase do erro (a janela a mostra) ou null. */
  const tirarShow = async (bloco: Bloco, motivo: string): Promise<string | null> => {
    if (!dia || !localId || !bloco.dailyBookId) return null;
    if (review) return "No modo de amostra não dá para tirar o show. Abra com a conta de teste para ver.";
    setSaving(true); setBusy("ajuste"); setError("");
    try {
      await customFetch("/api/escalas/dia/tirar-show", { method: "POST", body: JSON.stringify({ locationId: localId, date, dailyBookId: bloco.dailyBookId, ...(motivo ? { motivo } : {}) }) });
      setRefresh((n) => n + 1);
      return null;
    } catch (err) {
      const frase = errMsg(err, "Não consegui tirar o show do dia agora. Nada foi alterado; tente de novo.");
      setRefresh((n) => n + 1);
      return frase;
    } finally { setSaving(false); setBusy(""); }
  };
  const devolverShow = async (dailyBookId: string): Promise<string | null> => {
    if (!dia || !localId) return null;
    if (review) return "No modo de amostra não há o que desfazer.";
    setSaving(true); setBusy("ajuste"); setError("");
    try {
      await customFetch("/api/escalas/dia/tirar-show/desfazer", { method: "POST", body: JSON.stringify({ locationId: localId, date, dailyBookId }) });
      setRefresh((n) => n + 1);
      return null;
    } catch (err) { const frase = errMsg(err, "Não consegui devolver o show ao dia agora. Nada foi alterado; tente de novo."); setError(frase); setRefresh((n) => n + 1); return frase; }
    finally { setSaving(false); setBusy(""); }
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
  const criarEntradaManual = async (v: { pessoaIds: string[]; rotulo: string; inicio: string; fim: string; tipoId?: string | null; chamadasNovas?: ChamadaRascunho[] }) => {
    if (!dia?.escala) return;
    setSaving(true); setBusy("manual"); setError("");
    try {
      if (!review) {
        const r = await customFetch<{ entries?: { id: string }[] }>(`/api/scales/${dia.escala.id}/entries`, { method: "POST", headers: { "if-match": String(dia.escala.version) },
          body: JSON.stringify({ memberIds: v.pessoaIds, date, label: v.rotulo, startTime: v.inicio, endTime: v.fim || null, tipoId: v.tipoId ?? null }) });
        const ids = (r.entries ?? []).map((e) => e.id);
        // As chamadas da atividade só deste dia ficam ligadas à Escala do dia e ao bloco da atividade (a chave do primeiro registro dela).
        if (v.chamadasNovas?.length && ids.length) {
          try { await gravarChamadas({ scaleId: dia.escala.id, blocoKey: `m:${ids[0]}` }, v.chamadasNovas.map((c) => ({ ...c, id: undefined })), []); }
          catch (err) { setError(`A atividade entrou no dia, mas as chamadas não: ${errMsg(err, "tente de novo")}. Abra a atividade e configure as chamadas por lá.`); }
        }
        if (ids.length) setDesfazerLote({ texto: `${v.rotulo} entrou no dia para ${plural(v.pessoaIds.length, "pessoa", "pessoas")}.`, escalaId: dia.escala.id, ids });
      }
      setManual(null); setRefresh((n) => n + 1);
    } catch (err) { setError(errMsg(err, "Não consegui criar a atividade deste dia.")); } finally { setSaving(false); setBusy(""); }
  };
  const desfazerAtividade = async () => {
    const d = desfazerLote;
    if (!d) return;
    setDesfazerLote(null);
    try {
      await customFetch(`/api/scales/${d.escalaId}/entries/${d.ids[0]}`, { method: "DELETE", headers: { "if-match": String(diaRef.current?.escala?.version ?? "") }, body: JSON.stringify({ entryIds: d.ids }) });
      setRefresh((n) => n + 1);
    } catch (err) { setError(errMsg(err, "Não consegui desfazer. A atividade continua no dia.")); setRefresh((n) => n + 1); }
  };
  const editarEntradaManual = async (allocationIds: string[], v: { rotulo: string; inicio: string; fim: string; tipoId?: string | null }) => {
    if (!dia?.escala || !allocationIds.length) return;
    setSaving(true); setBusy("manual"); setError("");
    try {
      if (!review) {
        await customFetch(`/api/scales/${dia.escala.id}/entries/${allocationIds[0]}`, { method: "PATCH", headers: { "if-match": String(dia.escala.version) },
          body: JSON.stringify({ entryIds: allocationIds, label: v.rotulo, startTime: v.inicio, endTime: v.fim || null, tipoId: v.tipoId ?? null }) });
      }
      setManual(null); setRefresh((n) => n + 1);
    } catch (err) { setError(errMsg(err, "Não consegui mudar a atividade.")); } finally { setSaving(false); setBusy(""); }
  };
  const removerEntradaManual = async (allocationIds: string[]) => {
    if (!dia?.escala || !allocationIds.length) return;
    setSaving(true); setBusy(`manual:${allocationIds[0]}`); setError("");
    try {
      if (!review) await customFetch(`/api/scales/${dia.escala.id}/entries/${allocationIds[0]}`, { method: "DELETE", headers: { "if-match": String(dia.escala.version) }, body: JSON.stringify({ entryIds: allocationIds }) });
      setRefresh((n) => n + 1);
    } catch (err) { setError(errMsg(err, "Não consegui tirar a atividade deste dia.")); } finally { setSaving(false); setBusy(""); }
  };
  const folgaResolvida = async (userId: string) => {
    if (!localId) return;
    setSaving(true); setError("");
    try {
      if (!review) await customFetch("/api/escalas/dia/folga-resolvida", { method: "POST", body: JSON.stringify({ locationId: localId, date, userId }) });
      setRefresh((n) => n + 1);
    } catch (err) { setError(errMsg(err, "Não consegui marcar a folga como resolvida.")); } finally { setSaving(false); }
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

  // "Saiu ou não vem a partir de [hora]": prévia, gravar e desfazer. Em modo amostra a prévia sai do que está na tela e nada é gravado.
  const saiuApi: SaiuApi | undefined = isMem || !localId ? undefined : {
    simular: async (userId, aPartirDe) => review
      ? previaDeAmostra(dia, userId, aPartirDe)
      : customFetch<PreviaDaSaida>("/api/escalas/dia/saiu", { method: "POST", body: JSON.stringify({ locationId: localId, date, userId, aPartirDe, simular: true }) }),
    gravar: async (userId, aPartirDe, motivo, tipo) => {
      if (review) return { saiuId: "amostra" };
      const r = await customFetch<{ saiuId: string }>("/api/escalas/dia/saiu", { method: "POST", body: JSON.stringify({ locationId: localId, date, userId, aPartirDe, motivo, tipo }) });
      setRefresh((n) => n + 1);
      return r;
    },
    desfazer: async (saiuId) => {
      if (review) return;
      const r = await customFetch<{ naoDevolvidas?: string[] }>("/api/escalas/dia/saiu/desfazer", { method: "POST", body: JSON.stringify({ locationId: localId, date, saiuId }) });
      setRefresh((n) => n + 1);
      return r;
    },
  };
  const carregandoTela = loading || (!isMem && !review && !locaisProntos);
  const status = carregandoTela && !dia ? "carregando…" : error && !dia ? "não carregou" : statusLabel(dia);
  const S = STATUS[isMem ? (carregandoTela && !minha ? "carregando…" : error && !minha ? "não carregou" : minha?.publicada ? "publicada" : "sem escala") : status];
  const dateBar = <div className="esc-pad esc-db" style={css("display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px;padding:14px 20px 12px;background:#fff;position:relative;" + (isMem ? "border-bottom:1px solid var(--asa-border-soft);" : ""))}>
    {!isMem && seletorDeLocal(true)}
    <div className="esc-db-nav" style={css("display:flex;align-items:center;gap:4px")}>
      <button type="button" className="esc-hit" aria-label="Dia anterior" onClick={() => { setDate(addDays(date, -1)); setCal(false); }} style={css("width:30px;height:30px;border-radius:9px;border:1px solid var(--asa-line);background:#fff;color:var(--asa-label);font-size:13px;cursor:pointer")}>‹</button>
      <button type="button" className="esc-hit" aria-label="Próximo dia" onClick={() => { setDate(addDays(date, 1)); setCal(false); }} style={css("width:30px;height:30px;border-radius:9px;border:1px solid var(--asa-line);background:#fff;color:var(--asa-label);font-size:13px;cursor:pointer")}>›</button>
    </div>
    <div className="esc-db-titulo" style={css("display:flex;flex-direction:column;gap:3px;flex:0 1 auto;min-width:0;max-width:100%")}>
      <div style={css("display:flex;align-items:baseline;gap:2px 9px;flex-wrap:wrap")}>
        <span style={css("font-family:Outfit,sans-serif;font-size:22px;font-weight:700;letter-spacing:-0.02em;white-space:nowrap")}>{WEEKDAY_LONG[weekdayOf(date)]}</span>
        <span className="esc-db-longa" style={css("font-size:13.5px;color:var(--asa-ink-muted);font-weight:500;white-space:nowrap")}>{fullDate(date)}</span>
        <span className="esc-so-tel" style={css("font-size:14px;color:var(--asa-ink-muted);font-weight:600;white-space:nowrap")}>{date.slice(8, 10)}/{date.slice(5, 7)}</span>
        <span style={css("font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:3px 8px;border-radius:999px;background:var(--asa-show-bg);color:var(--asa-purple);")}>{relOf(date)}</span>
      </div>
      <div className="esc-db-sub" style={css("display:flex;align-items:center;gap:9px;font-size:12px;color:var(--asa-label);flex-wrap:wrap")}>
        <span>{operationLabel}</span>
        <span>·</span>
        <span>{isMem ? (carregandoTela && !minha ? "carregando…" : error && !minha ? "não carregou" : minha?.publicada ? plural(meusBlocos.length, "bloco seu", "blocos seus") : "ainda não publicada") : dia ? plural(dia.pessoas.filter((p) => !p.folga && !p.foraDoLocal).length, "pessoa no dia", "pessoas no dia") : "—"}</span>
      </div>
    </div>
    <span className="esc-db-folga" style={css("flex:1")}/>
    <span className="esc-db-status" style={css("font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:5px 10px;border-radius:999px;background:" + S.bg + ";color:" + S.fg + ";")}>{isMem ? (carregandoTela && !minha ? "carregando…" : error && !minha ? "não carregou" : minha?.publicada ? "publicada" : "sem escala") : status}</span>
    <div className="esc-db-acoes">
    <div className="esc-db-pills" style={css("display:flex;align-items:center;gap:6px;border:1px solid var(--asa-line);border-radius:999px;padding:3px;background:var(--asa-fade);flex:none;white-space:nowrap")}>
      <button type="button" className="esc-hit" onClick={() => { setDate(todayISO()); setCal(false); }} style={css(date === todayISO() ? pillOn : pillOff)}>Hoje</button>
      <button type="button" className="esc-hit" onClick={() => { setDate(addDays(todayISO(), 1)); setCal(false); }} style={css(date === addDays(todayISO(), 1) ? pillOn : pillOff)}>Amanhã</button>
      <button type="button" className="esc-hit" aria-expanded={cal} onClick={() => setCal((v) => !v)} style={css(cal ? pillOn : pillOff)}>Calendário</button>
    </div>
    {!isMem && !review && localId && <a className="esc-hit" href={`/imprimir?local=${encodeURIComponent(localId)}&data=${date}`} target="_blank" rel="noreferrer" style={css("flex:none;white-space:nowrap;border:1px solid var(--asa-line);background:#fff;color:var(--asa-ink-medium);border-radius:999px;padding:6px 13px;font-size:12px;font-weight:700;font-family:Manrope,sans-serif;text-decoration:none")}aria-label="Imprimir o dia"><span className="esc-lbl-pc">Imprimir o dia</span><Printer className="esc-so-tel" size={18} aria-hidden="true"/></a>}
    {(isAdm || areasMinhas.length > 0) && tab === "escala" && dia?.escala && <button type="button" className="esc-hit" disabled={saving} onClick={() => setManual({ bloco: null })} style={css(btn("primary") + "min-height:44px;white-space:nowrap")}aria-label="Atividade só deste dia"><span className="esc-lbl-pc">+ Atividade só deste dia</span><Plus className="esc-so-tel" size={20} aria-hidden="true"/></button>}
    </div>
    {cal && <Calendario date={date} onPick={(d) => { setDate(d); setCal(false); }}/>}
  </div>;

  return <section className="esc-root" style={css("position:relative;flex:1;display:flex;flex-direction:column;background:var(--asa-bg-page);min-width:0;min-height:calc(100vh - 48px)")}>
    {tab === "prog" && !isMem
      ? <div className="esc-pad" style={css("display:flex;align-items:baseline;gap:10px;padding:14px 20px 4px;background:#fff")}>
        <span style={css("font-family:Outfit,sans-serif;font-size:22px;font-weight:700;letter-spacing:-0.02em")}>Programação da semana</span>
        <span style={css("font-size:13px;color:var(--asa-ink-muted)")}>{operationLabel}</span>
      </div>
      : dateBar}
    {!isMem && <div className="esc-tabs esc-pad" role="tablist" style={css("display:flex;align-items:center;padding:0 20px;border-bottom:1px solid var(--asa-border-soft);background:#fff;")}>
      {([["escala", "Atividade do dia"], ["prog", "Programação"], ["minha", "Minha escala"]] as const).map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={tab === key} className="esc-hit" onClick={() => setTab(key)}
        style={css("border:none;background:none;cursor:pointer;font-family:Manrope,sans-serif;font-size:13px;padding:11px 2px 10px;margin-right:22px;white-space:nowrap;" + (tab === key ? "font-weight:700;color:var(--asa-ink-dark);box-shadow:inset 0 -2px 0 0 var(--asa-purple);" : "font-weight:600;color:var(--asa-label);"))}>{label}</button>)}
    </div>}

    <div className="esc-pad" style={css("flex:1;min-width:0;padding:16px 18px 0")}>
      {error && <div role="alert" style={css("display:flex;align-items:center;gap:11px;background:var(--asa-ausente-bg);border:1px solid var(--asa-red-wash);border-radius:12px;padding:10px 14px;margin-bottom:12px")}>
        <img src="/asa/aviso-importante.webp" alt="" style={css("width:30px;height:30px;object-fit:contain;flex:none")}/>
        <span style={css("font-size:12.5px;color:var(--asa-error-fg);line-height:1.45;flex:1")}>{error}</span>
        <button type="button" className="esc-hit" onClick={() => { setError(""); setRefresh((n) => n + 1); }} style={css(btn("ghost"))}>Tentar de novo</button>
      </div>}
      {/* Desenho 29: vazio de primeiro uso ensina e oferece a primeira ação. */}
      {!isMem && !review && locaisProntos && !error && locais.length === 0 && tab !== "minha" && <div role="status" style={css("display:flex;align-items:center;gap:12px;background:#fff;border:1px dashed var(--asa-line-soft);border-radius:12px;padding:14px 16px;margin-bottom:12px")}>
        <img src="/asa/oi.webp" alt="" style={css("width:40px;height:40px;object-fit:contain;flex:none")}/>
        <span style={css("font-size:13px;color:var(--asa-ink-medium);line-height:1.5;flex:1")}>{isAdm ? "Ainda não há locais cadastrados. A escala é montada por local — cadastre os locais primeiro." : "Você ainda não tem local para montar escala. A Administração cadastra os locais e define quem supervisiona cada um."}</span>
        {isAdm && <Link href="/locais" className="esc-hit" style={css(btn("primary") + ";text-decoration:none")}>Cadastrar os locais</Link>}
      </div>}
      {carregandoTela && !error && !dia && !minha && <div aria-busy="true" style={css("padding:16px;text-align:center;font-size:12.5px;color:var(--asa-label);background:#fff;border:1px dashed var(--asa-line-soft);border-radius:12px")}>Montando a escala…</div>}
      {showMinha && minha && <MinhaEscala minha={minha} date={date} onHoje={() => setDate(todayISO())} onConfirm={confirmarEscala} saving={saving}/>}
      {!isMem && tab === "escala" && dia && <EscalaGrid dia={dia} review={review} canEdit={isAdm || areasMinhas.length > 0} editableAreaIds={null} onAdjust={ajustarCelulaEmLote} onHorario={mudarHorario} onEditarAtividade={editarAtividade} onRemoveManual={isAdm || areasMinhas.length > 0 ? removerEntradaManual : undefined} onEditManual={isAdm || areasMinhas.length > 0 ? ((b) => setManual({ bloco: b })) : undefined} onFolgaResolvida={folgaResolvida} saiu={saiuApi} onNovaAtividade={isAdm || areasMinhas.length > 0 ? (() => setManual({ bloco: null })) : undefined} localDoDia={isAdm || areasMinhas.length > 0 ? { mover: moverDeLocal, desfazer: desfazerImprevisto, locais: locais.filter((l) => l.id !== localId) } : undefined} tirarShow={isAdm || areasMinhas.length > 0 ? { tirar: tirarShow, devolver: devolverShow } : undefined}/>} 
      {!isMem && tab === "prog" && localId && <ProgramacaoTab review={review} localId={localId} localName={operationLabel} date={date} dia={dia} canEdit={Boolean(local?.podeEditar)} onChanged={() => setRefresh((n) => n + 1)}/>}
    </div>

    {manual && dia && manual.bloco && <AtividadeDeHojeDialog tipos={dia.tipos ?? []} pessoas={dia.pessoas} bloco={manual.bloco} saving={busy === "manual"} onClose={() => setManual(null)}
      onChamadas={!review && dia.escala ? () => setChamadasDoDia(manual.bloco!) : undefined}
      onSubmit={async (v) => { const alvo = manual.bloco!; await editarEntradaManual(alvo.allocationIds?.length ? alvo.allocationIds : [alvo.allocationId!], v); }}/>}
    {chamadasDoDia && dia?.escala && <ChamadasDialog dona={{ scaleId: dia.escala.id, blocoKey: chamadasDoDia.key }} titulo={`Chamadas · ${chamadasDoDia.rotulo} ${chamadasDoDia.inicio}`} inicioDaAtividade={chamadasDoDia.inicio} onClose={() => setChamadasDoDia(null)} onSalvou={() => setRefresh((n) => n + 1)}/>}
    {manual && dia && !manual.bloco && <AtividadeLoteDialog tipos={dia.tipos ?? []} pessoas={dia.pessoas} areas={dia.areas} blocos={dia.blocos} areasQueSupervisiona={isAdm ? null : areasMinhas} saving={busy === "manual"} onClose={() => setManual(null)} onSubmit={criarEntradaManual}/>}
    {desfazerLote && <div className="ge-desfazer" role="status"><span>{desfazerLote.texto}</span><button type="button" onClick={() => void desfazerAtividade()}>Desfazer</button></div>}
    {copiaFeita && <div className="ge-desfazer" role="status"><span>{copiaFeita.texto}</span>
      {!copiaFeita.desfeita && <button type="button" disabled={copiaFeita.desfazendo} onClick={() => void desfazerCopia()}>{copiaFeita.desfazendo ? "Desfazendo…" : "Desfazer cópia"}</button>}
      <button type="button" disabled={copiaFeita.desfazendo} aria-label="Fechar o aviso" onClick={() => setCopiaFeita(null)}>×</button></div>}
    {refazerAberto && !review && localId && <RefazerDiaDialog localId={localId} localNome={operationLabel} date={date} dataCurta={`${date.slice(8, 10)}/${date.slice(5, 7)}`} onClose={() => setRefazerAberto(false)} onTerminou={() => setRefresh((n) => n + 1)}/>}
    {copiarAberto && !review && localId && <CopiarDiaDialog localId={localId} localNome={operationLabel} dataInicial={date} onClose={aoFecharCopia}/>}

    {regrasAbertas && isAdm && localId && <RegrasDoLocalDialog localId={localId} localNome={locais.find((l) => l.id === localId)?.name ?? "este local"} onClose={() => setRegrasAbertas(false)}/>}
    {gerarMesAberto && isAdm && <GerarMesDialog locais={locais} localInicial={localId} review={review} onClose={() => setGerarMesAberto(false)} onGerou={() => setRefresh((n) => n + 1)}/>}
    <Rodape role={role} tab={tab} onMinha={tab === "minha"} dia={dia} minha={minha} areasMinhas={areasMinhas} saving={saving} busy={busy} onGerar={gerarDia} onGerarMes={() => setGerarMesAberto(true)} onCopiar={review || !(isAdm || areasMinhas.length > 0) ? undefined : () => setCopiarAberto(true)} onRefazer={review || !(isAdm || areasMinhas.length > 0) ? undefined : () => setRefazerAberto(true)} onRegras={review ? undefined : () => setRegrasAbertas(true)} onPronta={marcarPronta} onPublicar={(republicar) => setConfirmandoPublicacao({ republicar })}/>
    {confirmandoPublicacao && dia && <PublicarDialog dia={dia} dataLonga={`${WEEKDAY_LONG[weekdayOf(date)]}, ${fullDate(date)}`} republicar={confirmandoPublicacao.republicar} review={review} ocupado={busy === "publicar"} onClose={() => setConfirmandoPublicacao(null)}
      onConfirmar={() => { const { republicar } = confirmandoPublicacao; setConfirmandoPublicacao(null); void publicar(republicar); }}/>}
  </section>;
}

/**
 * Só no modo amostra: `?tempo=1` põe o tempo disponível na Atenção do dia, como a Administração e a Supervisão o recebem (a Direção e o Elenco
 * não recebem o campo, então o cartão e o número no resumo somem). Usa só os ids das pessoas do dia.
 */
function tempoDeAmostra(d: Dia, role: string): Dia {
  if (new URLSearchParams(window.location.search).get("tempo") !== "1" || (role !== "adm" && role !== "sup")) return d;
  const ids = d.pessoas.filter((p) => !p.folga && !p.foraDoLocal).map((p) => p.id);
  if (ids.length < 7) return d;
  const lado = { rotulo: "Ensaio", localId: d.location.id, localNome: d.location.name };
  const buraco = (i: number, de: string, ate: string, minutos: number, extra: Partial<TempoDisponivel["avisos"][number]> = {}) => ({ pessoaId: ids[i]!, de, ate, minutos, antes: lado, depois: { ...lado, rotulo: "Show" }, ...extra });
  return { ...d, tempoDisponivel: {
    limite: 30,
    avisos: [buraco(0, "10:00", "11:45", 105), buraco(1, "10:30", "12:00", 90), buraco(2, "15:00", "16:00", 60), buraco(3, "09:00", "09:45", 45), buraco(4, "14:15", "14:50", 35), buraco(5, "11:00", "11:30", 30, { minutosDeIda: 30, depois: { rotulo: "Aula", localId: "outro", localNome: "Acquamotion" } })],
    diaDividido: [buraco(6, "09:30", "17:30", 480)],
  } };
}

/** Só no modo amostra: `?tirado=1` mostra um show em "Tirado deste dia"; `?fechado=1` mostra o dia em que o local não abre; `?outro=1` põe duas pessoas "no outro local" (a Escala diz onde estão em vez de contá-las). */
function extrasDeAmostra(d: Dia): Dia {
  const q = new URLSearchParams(window.location.search);
  // `?tirado=1`: o primeiro show do dia aparece como "Tirado deste dia" (fora da grade), para ver a lista e o botão de voltar.
  if (q.get("tirado") === "1") {
    const show = d.blocos.find((b) => b.regra === "livro" && b.dailyBookId);
    if (show) return { ...d, blocos: d.blocos.filter((b) => b !== show), showsTirados: [{ dailyBookId: show.dailyBookId!, rotulo: show.rotulo, inicio: show.inicio, fim: show.fim, porNome: "Supervisão de exemplo", em: null, motivo: "Entrou o show de Halloween no lugar" }] };
  }
  if (q.get("fechado") === "1") return { ...d, escala: null, blocos: [], fechado: { motivo: `${d.location.name} não abre quartas. Não há o que escalar aqui neste dia.` } };
  // `?equipe=1`: duas pessoas são da equipe de outro local hoje (somem da grade e aparecem só em "No outro local").
  if (q.get("equipe") === "1") {
    const deLa = d.pessoas.filter((p) => !p.folga).slice(-2).map((p) => p.id);
    return { ...d,
      pessoas: d.pessoas.map((p) => deLa.includes(p.id) ? { ...p, foraDoLocal: true as const, noutroLocal: [{ localId: "outro", localNome: "Acquamotion", inicio: "08:40", fim: "16:00", atividades: 6 }] } : p),
      blocos: d.blocos.map((b) => ({ ...b, pessoaIds: b.pessoaIds.filter((id) => !deLa.includes(id)) })) };
  }
  if (q.get("outro") !== "1") return d;
  const dois = d.pessoas.filter((p) => !p.folga).slice(-2).map((p) => p.id);
  return { ...d,
    pessoas: d.pessoas.map((p) => dois.includes(p.id) ? { ...p, noutroLocal: [{ localId: "outro", localNome: "Acquamotion", inicio: "08:40", fim: "16:00", atividades: 6 }] } : p),
    blocos: d.blocos.map((b) => ({ ...b, pessoaIds: b.pessoaIds.filter((id) => !dois.includes(id) || b.flexivel) })) };
}

/** Só no modo amostra: uma mexida de exemplo (de uma Supervisão em pessoa de outra área) para ver como a tela mostra "quem mexeu". */
function mexidasDeAmostra(d: Dia): Mexida[] {
  const pessoa = d.pessoas.find((p) => !p.folga && p.areaId);
  const outra = d.areas.find((a) => a.id !== pessoa?.areaId && a.supervisores.length);
  const sup = outra?.supervisores[0];
  const bloco = pessoa ? d.blocos.find((b) => b.pessoaIds.includes(pessoa.id) && b.regra !== "livro") : undefined;
  if (!pessoa || !outra || !sup || !bloco) return [];
  return [{ pessoaId: pessoa.id, pessoaNome: pessoa.name, pessoaAreaNome: pessoa.areaName, porId: sup.id, porNome: sup.name, porAreaNome: outra.name, em: new Date().toISOString(), texto: `tirou de ${textoDoBloco(bloco)}` }];
}

/** Só no modo amostra: o que a prévia de "saiu a partir de" mostraria para a pessoa, calculado do que já está na tela. */
function previaDeAmostra(dia: Dia | null, userId: string, aPartirDe: string): PreviaDaSaida {
  const atividades = (dia?.blocos ?? []).filter((b) => b.pessoaIds.includes(userId)).flatMap((b): PreviaDaSaida["atividades"] => {
    const show = b.regra === "livro";
    if (b.inicio >= aPartirDe) return [{ key: b.key, rotulo: textoDoBloco(b), inicio: b.inicio, fim: b.fim, acao: show ? "SAI_DO_SHOW" : "SAI" }];
    if (b.fim && b.fim > aPartirDe) return [{ key: b.key, rotulo: textoDoBloco(b), inicio: b.inicio, fim: b.fim, acao: show ? "SAI_DO_SHOW" : "TERMINA_MAIS_CEDO", novoFim: show ? undefined : aPartirDe }];
    return [];
  });
  return { atividades, shows: [], semNinguem: atividades.filter((a) => a.acao === "SAI_DO_SHOW").length };
}
/* ---------- calendário (mês da data escolhida) ---------- */
function Calendario({ date, onPick }: { date: string; onPick: (d: string) => void }) {
  const { y, m } = partsOf(date);
  const [cursor, setCursor] = useState({ y, m });
  const first = new Date(cursor.y, cursor.m - 1, 1);
  const days = new Date(cursor.y, cursor.m, 0).getDate();
  const iso = (d: number) => `${cursor.y}-${String(cursor.m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const move = (delta: number) => setCursor((c) => { const n = new Date(c.y, c.m - 1 + delta, 1); return { y: n.getFullYear(), m: n.getMonth() + 1 }; });
  return <div style={css("position:absolute;right:20px;top:70px;z-index:5;width:258px;background:#fff;border:1px solid var(--asa-line-soft);border-radius:14px;padding:13px;box-shadow:0 22px 40px -20px rgba(40,20,90,.45);")}>
    <div style={css("display:flex;align-items:center;justify-content:space-between;margin-bottom:10px")}>
      <span style={css("font-family:Outfit,sans-serif;font-size:14px;font-weight:600")}>{MONTH[cursor.m - 1][0].toUpperCase() + MONTH[cursor.m - 1].slice(1)} {cursor.y}</span>
      <span style={css("display:flex;gap:2px")}>
        <button type="button" className="esc-hit" aria-label="Mês anterior" onClick={() => move(-1)} style={css("border:none;background:none;color:var(--asa-label);font-size:12px;cursor:pointer;padding:2px 6px")}>‹</button>
        <button type="button" className="esc-hit" aria-label="Próximo mês" onClick={() => move(1)} style={css("border:none;background:none;color:var(--asa-label);font-size:12px;cursor:pointer;padding:2px 6px")}>›</button>
      </span>
    </div>
    <div style={css("display:grid;grid-template-columns:repeat(7,1fr);gap:3px;margin-bottom:6px")}>
      {["D", "S", "T", "Q", "Q", "S", "S"].map((h, i) => <span key={i} style={css("text-align:center;font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--asa-label)")}>{h}</span>)}
    </div>
    <div style={css("display:grid;grid-template-columns:repeat(7,1fr);gap:3px")}>
      {Array.from({ length: first.getDay() }, (_, i) => <span key={`e${i}`} style={css("height:30px")}/>)}
      {Array.from({ length: days }, (_, i) => {
        const d = iso(i + 1), isSel = d === date, isToday = d === todayISO();
        return <button key={d} type="button" onClick={() => onPick(d)} style={css("display:flex;flex-direction:column;align-items:center;gap:2px;height:30px;justify-content:center;border-radius:8px;cursor:pointer;font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:600;" + (isSel ? "border:1px solid var(--asa-purple);background:var(--asa-show-bg);color:var(--asa-purple);" : isToday ? "border:1px solid var(--asa-line-soft);background:#fff;color:var(--asa-ink-dark);" : "border:1px solid transparent;background:none;color:var(--asa-label);"))}>{i + 1}</button>;
      })}
    </div>
  </div>;
}

/** Tela de telefone (até 640 px): a grade de pessoas × horários não cabe, então vira um cartão por pessoa. */
function useTelefone() {
  const consulta = "(max-width: 640px)";
  const [telefone, setTelefone] = useState(() => typeof window !== "undefined" && Boolean(window.matchMedia?.(consulta).matches));
  useEffect(() => {
    const mq = window.matchMedia?.(consulta);
    if (!mq) return;
    const aoMudar = () => setTelefone(mq.matches);
    aoMudar();
    mq.addEventListener("change", aoMudar);
    return () => mq.removeEventListener("change", aoMudar);
  }, []);
  return telefone;
}

/* ---------- aba Escala: grade pessoas × horários ---------- */
function EscalaGrid({ dia, review, canEdit, editableAreaIds, onAdjust, onHorario, onEditarAtividade, onRemoveManual, onEditManual, onFolgaResolvida, saiu, localDoDia, onNovaAtividade, tirarShow }: { onNovaAtividade?: () => void; tirarShow?: { tirar: (bloco: Bloco, motivo: string) => Promise<string | null>; devolver: (dailyBookId: string) => Promise<string | null> }; saiu?: SaiuApi; localDoDia?: LocalDoDiaApi; review: boolean; dia: Dia; canEdit: boolean; editableAreaIds: string[] | null; onHorario: (bloco: Bloco, pessoaId: string, horario: { inicio: string; fim: string | null; motivo?: string } | null) => Promise<string | null>; onAdjust: (bloco: Bloco, mudancas: Mudanca[], motivo?: string) => Promise<void>; onEditarAtividade?: (bloco: Bloco, edicao: EdicaoDaAtividade | null) => Promise<string | null>; onRemoveManual?: (allocationIds: string[]) => Promise<void>; onEditManual?: (bloco: Bloco) => void; onFolgaResolvida?: (userId: string) => Promise<void> }) {
  const [view, setView] = useState<"pessoa" | "atividade">("atividade");
  const [team, setTeam] = useState("todos");
  const [busca, setBusca] = useState("");
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [soExcecoes, setSoExcecoes] = useState(false);
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ bloco: Bloco; pessoa: Pessoa; rect: DOMRect } | null>(null);
  const [desfazer, setDesfazer] = useState<{ texto: string; acao: () => Promise<void> } | null>(null);
  const [ajustando, setAjustando] = useState<Bloco | null>(null);
  const [editandoAtividade, setEditandoAtividade] = useState<Bloco | null>(null);
  const [mudandoHorario, setMudandoHorario] = useState<{ pessoaId: string; nome: string; bloco: Bloco; outro: Bloco | null } | null>(null);
  const [confirmarGrade, setConfirmarGrade] = useState<{ titulo: string; texto: string; acao: string; onSim: () => void } | null>(null);
  const [tirando, setTirando] = useState("");
  const [saindo, setSaindo] = useState<{ pessoa: Pessoa; aPartirDe: string } | null>(null);
  const [tirandoShow, setTirandoShow] = useState<Bloco | null>(null);
  const [mudandoLocal, setMudandoLocal] = useState<{ modo: "trazer" | "mandar"; pessoa: Pessoa; origem: { id: string; name: string } | null } | null>(null);
  const telefone = useTelefone();
  const blocosDe = useCallback((pid: string) => dia.blocos.filter((b) => b.pessoaIds.includes(pid)), [dia.blocos]);
  const trabalham = useMemo(() => dia.pessoas.filter((p) => trabalhaNoDia(p, blocosDe)), [dia.pessoas, blocosDe]);
  const cols = trabalham.filter((p) => team === "todos" || p.areaId === team);
  const pessoasDoDia = useMemo<PessoaDoDia[]>(() => trabalham.map((p) => ({ id: p.id, name: p.name, areaId: p.areaId, areaName: p.areaName })), [trabalham]);
  // Sem ninguém: o bloco inteiro vazio, ou show com personagem/posição que ficou aberta (o resto do elenco do show segue escalado).
  const vazios = dia.blocos.filter((b) => b.regra !== "ninguem" && (b.vazio || b.vagas?.some((v) => !v.userId)));
  const faixas = useMemo(() => {
    const seen = new Map<string, { inicio: string; fim: string | null; blocos: Bloco[] }>();
    for (const b of dia.blocos) { const k = faixa(b); const cur = seen.get(k) ?? { inicio: b.inicio, fim: b.fim, blocos: [] }; cur.blocos.push(b); seen.set(k, cur); }
    return [...seen.values()].sort((a, b) => a.inicio.localeCompare(b.inicio) || (a.fim ?? "").localeCompare(b.fim ?? ""));
  }, [dia.blocos]);
  const personName = (id: string) => dia.pessoas.find((p) => p.id === id)?.name ?? id;
  const motivoDaFolga = (p: Pessoa) => (p.folga ? (FOLGA[p.folga] ?? FOLGA.OUTRO).label : "Fora");
  const termo = busca.trim().toLocaleLowerCase("pt-BR");
  const achadas = termo ? dia.pessoas.filter((p) => p.name.toLocaleLowerCase("pt-BR").includes(termo)) : [];
  const buscaIds = termo ? new Set(achadas.map((p) => p.id)) : null;
  const achadasFora = achadas.filter((p) => !trabalhaNoDia(p, blocosDe));
  const podeMexer = (p: Pessoa) => canEdit && (editableAreaIds === null || (p.areaId !== null && editableAreaIds.includes(p.areaId)));
  const frasePorQueNao = (p: Pessoa) => canEdit
    ? `${p.name} é da área ${p.areaName ?? "sem área"}. Só a Supervisão dessa área ou a Administração ajusta.`
    : "A escala só é ajustada pela Administração ou pela Supervisão da área. A Direção, o Elenco e quem não cuida desta área só leem.";
  // Mesma pessoa em dois blocos que se cruzam: a escala avisa, não bloqueia (regra de conflito).
  const conflitos = useMemo(() => {
    const out: ConflitoDaPessoa[] = [];
    for (const p of dia.pessoas) {
      // Bloco flexível (almoço) é janela: nunca cruza com nada.
      const list = dia.blocos.filter((b) => !foraDoChoque(b) && b.pessoaIds.includes(p.id)).sort((x, y) => x.inicio.localeCompare(y.inicio));
      for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        const fimA = a.fim ?? a.inicio;
        if (b.inicio < fimA || (b.inicio === a.inicio && b.fim && a.fim)) out.push({ pessoa: p.name, pessoaId: p.id, areaId: p.areaId, a, b });
      }
    }
    return out;
  }, [dia]);
  const emConflito = new Set(conflitos.flatMap((c) => [`${c.pessoa}|${c.a.key}`, `${c.pessoa}|${c.b.key}`]));
  const temChoque = (p: Pessoa, b: Bloco) => emConflito.has(`${p.name}|${b.key}`);
  // Quem mexeu por último em cada pessoa (Supervisão de outra área): aparece na coluna dela.
  const mexidoPor = (pessoaId: string) => dia.mexidas?.find((m) => m.pessoaId === pessoaId)?.porNome ?? null;
  // Um cartão por par de blocos que se cruzam (ALMOÇO × MUSICAL), com as pessoas dentro — não um por pessoa.
  const gruposDeConflito = useMemo(() => {
    const porPar = new Map<string, GrupoDeConflito>();
    for (const c of conflitos) { const k = `${c.a.key}|${c.b.key}`; const g = porPar.get(k) ?? { a: c.a, b: c.b, pessoas: [] }; g.pessoas.push(c); porPar.set(k, g); }
    return [...porPar.values()].sort((x, y) => x.a.inicio.localeCompare(y.a.inicio) || y.pessoas.length - x.pessoas.length);
  }, [conflitos]);

  const tirarDoBloco = async (bloco: Bloco, pessoa: Pessoa) => {
    setTirando(`${pessoa.id}|${bloco.key}`);
    try {
      await onAdjust(bloco, [{ userId: pessoa.id, action: "REMOVER" }]);
      setDesfazer({ texto: `${pessoa.name} saiu de ${textoDoBloco(bloco)}.`, acao: () => onAdjust(bloco, [{ userId: pessoa.id, action: "ADICIONAR" }]) });
    } finally { setTirando(""); }
  };
  useEffect(() => { if (!desfazer) return; const id = window.setTimeout(() => setDesfazer(null), 9000); return () => window.clearTimeout(id); }, [desfazer]);

  const blockEl = (b: Bloco, extra = "", semHora = false) => {
    const tone = toneOf(b, dia.tipos);
    const inner = <>
      {b.dailyBookId && <span title={`Livro do Dia · ${b.dailyBookStatus ?? ""}`} style={css("width:6px;height:6px;border-radius:50%;flex:none;background:" + (b.dailyBookStatus === "DRAFT" ? "var(--asa-vaga-fg)" : "var(--asa-prep-fg)") + ";")}/>}
      <span style={css("overflow:hidden;text-overflow:ellipsis;min-width:0")}>{textoDoBloco(b)}</span>
      {!semHora && b.fim && b.regra !== "livro" && !b.flexivel && <span style={css("font-family:'JetBrains Mono',monospace;font-size:12px;flex:none;color:" + tone.fg + ";opacity:.75;margin-left:auto;")}>{faixa(b)}</span>}
    </>;
    return b.dailyBookId
      ? <Link key={b.key} href={`/livro-do-dia?data=${dia.date}&livro=${b.dailyBookId}`} title="Abrir no Livro do Dia" className="esc-bloco-link" style={css(blockStyle(tone, "cursor:pointer;text-decoration:none;" + extra))}>{inner}</Link>
      : <div key={b.key} style={css(blockStyle(tone, extra + "max-width:100%;box-sizing:border-box;"))}>{inner}</div>;
  };

  // Legenda de cores: os tipos do local (os arquivados só se ainda pintam algum bloco do dia); sem lista, os sete de fábrica.
  const legenda = dia.tipos?.length ? dia.tipos.filter((t) => t.active || dia.blocos.some((b) => b.tipoId === t.id)) : TIPOS.map((t) => ({ id: t.key, nome: t.label, cor: t.key }));
  const pessoaSelecionada = selecionada ? dia.pessoas.find((p) => p.id === selecionada) ?? null : null;
  const irParaAtencao = () => { window.dispatchEvent(new Event("ge-abrir-atencao")); window.setTimeout(() => document.getElementById("atencao-do-dia")?.scrollIntoView({ behavior: "smooth", block: "start" }), 60); };
  const botaoDeVisao = (ativo: boolean) => "border-radius:8px;padding:8px 14px;font-size:12px;cursor:pointer;font-family:Manrope,sans-serif;border:none;" + (ativo ? "background:#fff;color:var(--asa-ink-dark);font-weight:700;box-shadow:0 1px 3px rgba(40,20,90,.14);" : "background:none;color:var(--asa-label);font-weight:600;");
  const etiquetaDaVisao = telefone ? { pessoa: "Por pessoa", atividade: "Por atividade" } : { pessoa: "Por pessoa", atividade: "Por atividade" };

  return <div style={css("display:flex;flex-direction:column;gap:12px")}>
    <div style={css("display:flex;flex-wrap:wrap;align-items:center;gap:9px")}>
      <div style={css("display:flex;align-items:center;gap:3px;border:1px solid var(--asa-line);border-radius:10px;padding:3px;background:var(--asa-fade)")}>
        {(["pessoa", "atividade"] as const).map((key) => <button key={key} type="button" className="esc-hit" aria-pressed={view === key} onClick={() => setView(key)} style={css(botaoDeVisao(view === key))}>{etiquetaDaVisao[key]}</button>)}
      </div>
      {telefone && <button type="button" className="esc-hit" aria-expanded={filtrosAbertos} onClick={() => setFiltrosAbertos((v) => !v)} style={css("min-height:44px;border-radius:10px;padding:0 14px;font:700 13px Manrope,sans-serif;cursor:pointer;border:1px solid var(--asa-line);background:" + (busca.trim() || team !== "todos" ? "var(--asa-chip-on)" : "#fff") + ";color:var(--asa-ink-dark)")}>{busca.trim() || team !== "todos" ? "Filtrar · ligado" : "Filtrar"}</button>}
      <div className="ge-filtros" data-aberto={!telefone || filtrosAbertos}>
      <input type="search" value={busca} onChange={(e) => { setBusca(e.target.value); const unico = e.target.value.trim() ? trabalham.filter((p) => p.name.toLocaleLowerCase("pt-BR").includes(e.target.value.trim().toLocaleLowerCase("pt-BR"))) : []; if (unico.length === 1) setSelecionada(unico[0]!.id); }} placeholder="Buscar pessoa" aria-label="Buscar pessoa na escala"
        style={css("flex:1 1 180px;min-width:140px;min-height:44px;border:1px solid var(--asa-line);border-radius:999px;padding:0 16px;font:600 13px Manrope,sans-serif;color:var(--asa-ink-dark);background:#fff")}/>
      {dia.areas.length > 1 && <div style={css("display:flex;flex-wrap:wrap;gap:6px")}>
        {[{ id: "todos", name: "Todos os grupos" }, ...dia.areas].map((a) => <button key={a.id} type="button" className="esc-hit" aria-pressed={team === a.id} onClick={() => setTeam(a.id)}
          style={css("border-radius:999px;padding:6px 12px;font-size:12px;cursor:pointer;font-family:Manrope,sans-serif;" + (team === a.id ? "border:1px solid var(--asa-ink-dark);background:var(--asa-ink-dark);color:#fff;font-weight:700;" : "border:1px solid var(--asa-line);background:#fff;color:var(--asa-label);font-weight:600;"))}>{a.name}</button>)}
      </div>}
      <span style={css("flex:1")}/>
      <span style={css("font-size:12px;color:var(--asa-label)")}>{`${cols.length} de ${trabalham.length} pessoas · ${dia.location.name}`}</span>
      </div>
    </div>

    {achadasFora.map((p) => <div key={`fora-${p.id}`} role="status" style={css("font-size:12.5px;color:var(--asa-ink-medium);background:var(--asa-fade);border:1px solid var(--asa-line);border-radius:12px;padding:9px 13px")}>{`${p.name} está de ${motivoDaFolga(p).toLocaleLowerCase("pt-BR")} ${quandoDoDia(dia.date)} e não aparece na grade.`}</div>)}
    {termo && !achadas.length && <div role="status" style={css("font-size:12.5px;color:var(--asa-label);padding:2px 4px")}>{`Ninguém com "${busca.trim()}" no nome.`}</div>}

    {dia.fechado && !dia.escala ? <div role="status" className="esc-fechado"><strong>{dia.fechado.motivo}</strong><span>Para abrir este dia, mude os dias de funcionamento em Locais. Atividades de outros locais continuam aparecendo em Meu Dia.</span></div> :
    <ResumoDoDia data={dia.date} pessoas={dia.pessoas} blocos={dia.blocos} blocosDe={blocosDe} pessoasComChoque={new Set(conflitos.map((c) => c.pessoaId)).size} motivoDaFolga={motivoDaFolga} soExcecoes={soExcecoes} onSoExcecoes={setSoExcecoes} onIrParaAtencao={irParaAtencao} parte={telefone ? "fora" : "tudo"} onTrazer={localDoDia ? ((p) => setMudandoLocal({ modo: "trazer", pessoa: p, origem: p.noutroLocal?.[0] ? { id: p.noutroLocal[0].localId, name: p.noutroLocal[0].localNome } : null })) : undefined}/>}

    {!(dia.fechado && !dia.escala) && <AtencaoDoDia dia={dia} vazios={vazios} grupos={gruposDeConflito} canEdit={canEdit} editableAreaIds={editableAreaIds} tirando={tirando}
      onTirar={(bloco, pessoaId) => { const pessoa = dia.pessoas.find((p) => p.id === pessoaId); return pessoa ? tirarDoBloco(bloco, pessoa) : Promise.resolve(); }}
      onMudarHorario={(pessoaId, nome, bloco, outro) => setMudandoHorario({ pessoaId, nome, bloco, outro })}
      onVoltarHorario={(bloco, pessoaId) => void onHorario({ ...bloco, key: bloco.horarioDela!.chaveOriginal }, pessoaId, null)}
      onAjustarVazio={setAjustando} onFolgaResolvida={onFolgaResolvida} onDesfazerImprevisto={localDoDia ? ((imprevistoId) => void localDoDia.desfazer(imprevistoId)) : undefined}
      onTrazer={localDoDia ? ((pessoaId) => { const p = dia.pessoas.find((x) => x.id === pessoaId); if (p) setMudandoLocal({ modo: "trazer", pessoa: p, origem: null }); }) : undefined}/>}

    {view === "pessoa" && telefone ? <ul className="esc-cartoes" aria-label="Escala por pessoa">
      {cols.filter((p) => !buscaIds || buscaIds.has(p.id)).map((p) => {
        const lista = blocosDe(p.id).sort((a, b) => a.inicio.localeCompare(b.inicio) || (a.fim ?? "").localeCompare(b.fim ?? ""));
        const pode = podeMexer(p);
        return <li key={p.id} className="esc-cartao">
          <header className="esc-cartao-topo" style={{ background: "var(--asa-bg-tinted)" }}>
            <span aria-hidden="true" style={css("width:30px;height:30px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;color:#fff;background:linear-gradient(135deg,var(--asa-violet),var(--asa-indigo));")}>{initials(p.name)}</span>
            <div style={css("display:flex;flex-direction:column;gap:1px;min-width:0")}>
              <strong style={css("font-size:13.5px;color:var(--asa-ink-dark);overflow-wrap:anywhere")}>{p.name}</strong>
              <span style={css("font-size:12px;color:var(--asa-label)")}>{`${p.areaName ?? "sem área"} · ${plural(lista.length, "bloco", "blocos")}`}{p.chamadaNaFolga ? " · chamado na folga" : ""}{p.noutroLocal?.length ? ` · ${soNoutroLocal(p, blocosDe) ? "só na" : "também na"} ${p.noutroLocal[0]!.localNome}` : ""}{mexidoPor(p.id) ? ` · ajustado por ${mexidoPor(p.id)}` : ""}</span>
            </div>
          </header>
          {lista.length ? <ul className="esc-cartao-blocos">
            {lista.filter((b) => !soExcecoes || ehExcecao(b) || temChoque(p, b)).map((b) => <li key={b.key} className="esc-cartao-bloco">
              <span className="esc-cartao-hora">{b.fim && b.regra !== "livro" ? <>{b.inicio}<small>{b.fim}</small></> : b.inicio}</span>
              <div style={css("flex:1;min-width:0;display:flex;flex-wrap:wrap;align-items:center;gap:6px")}>
                {blockEl(b, "white-space:normal;max-width:100%;" + (temChoque(p, b) ? "box-shadow:inset 0 0 0 2px var(--esc-choque);" : ehExcecao(b) ? "box-shadow:inset 0 0 0 2px var(--esc-excecao);" : ""), true)}
                {temChoque(p, b) && <span style={css("font-size:12px;font-weight:700;color:var(--esc-choque)")}>Cruza com outro bloco dela</span>}
                {b.encurtado && <span style={css("font-size:12px;color:var(--asa-label)")}>{textoDoEncurtado(b)}</span>}
                {b.horarioDela && <span style={css("font-size:12px;color:var(--asa-label)")}>{`Horário só desta pessoa · era ${faixa(b.horarioDela)}`}</span>}
                {pode && b.horarioDela && <button type="button" className="esc-cell-adjust esc-hit" onClick={() => void onHorario({ ...b, key: b.horarioDela!.chaveOriginal }, p.id, null)} aria-label={`Voltar ${p.name} ao horário normal de ${textoDoBloco(b)}`}>Voltar ao normal</button>}
                {!b.horarioDela && b.regra !== "ninguem" && <button type="button" className="esc-cell-adjust esc-hit" style={{ minHeight: 44 }} onClick={(e) => setMenu({ bloco: b, pessoa: p, rect: e.currentTarget.getBoundingClientRect() })} aria-label={`Ações de ${textoDoBloco(b)} para ${p.name}`}>Mexer</button>}
              </div>
            </li>)}
          </ul> : <p className="esc-cartao-vazio">Sem blocos neste dia.</p>}
        </li>;
      })}
      {!cols.length && <li className="esc-cartao-vazio">{team === "todos" ? "Ninguém trabalha neste dia." : "Ninguém deste grupo trabalha neste dia."}</li>}
    </ul> : view === "pessoa"
      ? <GradePessoa colunas={cols} blocosDe={blocosDe} temChoque={temChoque} tipos={dia.tipos} mexidoPor={mexidoPor} soExcecoes={soExcecoes} busca={buscaIds} selecionada={selecionada}
          onEscolherPessoa={(id) => setSelecionada((atual) => (atual === id ? null : id))} onTocarBloco={(bloco, pessoa, el) => setMenu({ bloco, pessoa, rect: el.getBoundingClientRect() })}/>
      : <div style={css("border:1px solid var(--asa-line-soft);border-radius:12px;overflow:hidden;background:#fff;")}>
        <table className="esc-tab-atividade" style={css("border-collapse:separate;border-spacing:0;width:100%;font-size:15px")}>
          <thead><tr>
            <th style={css(MONO_TH)}>Horário</th>
            <th style={css(MONO_TH)}>Atividade</th>
            <th style={css(MONO_TH.replace("border-right:1px solid var(--asa-line-soft);", ""))}>Quem faz</th>
          </tr></thead>
          <tbody>
            {faixas.flatMap((f) => f.blocos.map((b, gi) => {
              const who = b.pessoaIds.filter((id) => team === "todos" || dia.pessoas.find((p) => p.id === id)?.areaId === team);
              // Com um grupo escolhido, "todo" e "área" se medem dentro dele; sem filtro, contra o dia inteiro.
              // A chamada de um show grande diz "Elenco do show: N pessoas", como o próprio show; não repete a lista inteira.
              const paiDaChamada = b.chamada ? dia.blocos.find((x) => x.key === b.chamada!.atividade.key) : undefined;
              const resumo = resumoDoBloco(b, who, team === "todos" ? pessoasDoDia : pessoasDoDia.filter((p) => p.areaId === team), paiDaChamada?.vagas?.length ?? 0);
              const resumido = resumo.tipo === "todos" || resumo.tipo === "area" || (Boolean(b.chamada) && resumo.tipo === "show-grande");
              return <tr key={b.key}>
                <td style={css("border-right:1px solid var(--asa-line-soft);border-bottom:1px solid var(--asa-purple-airy);padding:8px 12px;vertical-align:middle;background:var(--asa-card-faint);width:124px;")}>
                  {gi === 0 && <div style={css("display:flex;flex-direction:column;gap:1px")}><span style={css("font-family:'JetBrains Mono',monospace;font-size:14px;font-weight:700;color:var(--asa-ink-medium)")}>{faixa(f)}</span></div>}
                </td>
                <td style={css("border-bottom:1px solid var(--asa-purple-airy);border-right:1px solid var(--asa-purple-lift);padding:6px 12px;vertical-align:middle;width:236px;")}>{blockEl(b, "display:inline-flex;font-size:14px;padding:6px 11px;border-radius:9px;")}</td>
                <td style={css("border-bottom:1px solid var(--asa-purple-airy);padding:6px 12px;vertical-align:middle;")}>
                  <div style={css("display:flex;flex-wrap:wrap;gap:7px;align-items:center")}>
                    {b.flexivel ? <span style={css("font-size:14px;font-weight:600;color:var(--asa-ink-medium)")}>{`Cada um cumpre dentro da janela · ${plural(who.length, "pessoa", "pessoas")}`}</span>
                    : b.regra === "livro" ? <ShowLinha bloco={b} data={dia.date} nomeDe={personName} pessoasDoDia={pessoasDoDia}/> : <>
                    {resumido
                      ? <QuemResumido resumo={resumo}/>
                      : who.map((id) => <span key={id} style={css("display:inline-flex;align-items:center;gap:5px;border:1px solid var(--asa-line);background:#fff;border-radius:999px;padding:3px 11px 3px 3px;font-size:13.5px;font-weight:600;color:var(--asa-ink-medium);")}>
                        <span style={css("width:18px;height:18px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;color:#fff;background:linear-gradient(135deg,var(--asa-violet),var(--asa-indigo));")}>{initials(personName(id))[0]}</span>
                        <span>{personName(id)}</span>
                      </span>)}
                    {b.regra !== "ninguem" && (b.vazio ? <span style={css("display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:4px 10px;font-size:12px;font-weight:700;background:var(--asa-vaga-bg);color:var(--asa-vaga-fg);border:1px dashed var(--asa-vaga-bd);")}>sem ninguém · defina quem entra</span>
                      : !resumido && <span style={css("font-size:12px;color:var(--asa-label);margin-left:2px")}>{plural(who.length, "pessoa", "pessoas")}</span>)}
                    </>}
                    {b.cedeu && b.cedeu.length > 0 && <span style={css("font-size:12px;color:var(--asa-label)")}>{`Saíram daqui por ter atividade específica no mesmo horário: ${b.cedeu.length <= 4 ? b.cedeu.map((c) => `${personName(c.userId)} (${c.para})`).join(", ") : plural(b.cedeu.length, "pessoa", "pessoas")}.`}</span>}
                    {b.encurtado && <span style={css("font-size:12px;color:var(--asa-label)")}>{`${textoDoEncurtado(b)} (o bloco de todos vai das ${b.encurtado.original.inicio}${b.encurtado.original.fim ? ` às ${b.encurtado.original.fim}` : ""}).`}</span>}
                    {b.horarioDela && <span style={css("font-size:12px;color:var(--asa-label)")}>{`Horário só desta pessoa · era ${faixa(b.horarioDela)}`}</span>}
                    {canEdit && b.horarioDela && <button type="button" className="esc-cell-adjust esc-hit" onClick={() => void onHorario({ ...b, key: b.horarioDela!.chaveOriginal }, b.pessoaIds[0]!, null)}>Voltar ao normal</button>}
                    {b.chamada && <span style={css("font-size:12px;color:var(--asa-label)")}>{`${b.chamada.ocupaTempo ? "Ocupa o tempo de quem recebe" : "Só informa a hora, não ocupa tempo"} · segue quem faz ${b.chamada.atividade.rotulo}`}</span>}
                    {b.editadoNoDia && <span style={css("font-size:12px;color:var(--asa-label)")}>{`Editada só neste dia · a Programação manda ${b.editadoNoDia.original.rotulo}, ${faixa(b.editadoNoDia.original)}`}</span>}
                    {canEdit && !b.horarioDela && !b.chamada && b.regra !== "ninguem" && <button type="button" className="esc-cell-adjust esc-hit" onClick={() => setAjustando(b)}>Ajustar</button>}
                    {canEdit && onEditarAtividade && b.origem === "programacao" && b.regra !== "livro" && !b.chamada && <button type="button" className="esc-cell-adjust esc-hit" onClick={() => setEditandoAtividade(b)}>Editar neste dia</button>}
                    {tirarShow && b.regra === "livro" && b.dailyBookId && !b.chamada && b.dailyBookStatus !== "EXECUTED" && <button type="button" className="esc-cell-adjust esc-hit" onClick={() => setTirandoShow(b)}>Tirar este show do dia</button>}
                    {onEditManual && b.origem === "manual" && b.allocationId && <button type="button" className="esc-cell-adjust esc-hit" onClick={() => onEditManual(b)}>Mudar horário</button>}
                    {onRemoveManual && b.origem === "manual" && b.allocationId && <button type="button" className="esc-cell-adjust esc-hit" onClick={() => setConfirmarGrade({ titulo: "Tirar do dia", texto: `"${b.rotulo}" das ${b.inicio} sai do dia para ${b.pessoaIds.length === 1 ? "1 pessoa" : `${b.pessoaIds.length} pessoas`}. A Programação não muda.`, acao: "Tirar do dia", onSim: () => void onRemoveManual(b.allocationIds?.length ? b.allocationIds : [b.allocationId!]) })}>Tirar do dia</button>}
                  </div>
                </td>
              </tr>;
            }))}
            {!faixas.length && <tr><td colSpan={3} style={css("padding:16px;text-align:center;font-size:12.5px;color:var(--asa-label)")}>Nenhum bloco neste dia.</td></tr>}
          </tbody>
        </table>
      </div>}

    {!(dia.fechado && !dia.escala) && (dia.showsTirados?.length ?? 0) > 0 && <section className="ge-tirados" aria-label="Shows tirados deste dia">
      <h3>Tirado deste dia</h3>
      <ul>{dia.showsTirados!.map((t) => <li key={t.dailyBookId}>
        <span><strong>{`${t.rotulo}${t.inicio ? ` · ${t.inicio}` : ""}`}</strong>{` não acontece neste dia${t.porNome ? ` · tirado por ${t.porNome}` : ""}${t.motivo ? ` · ${t.motivo}` : ""}`}</span>
        {tirarShow && <button type="button" className="esc-cell-adjust esc-hit" style={{ minHeight: 44 }} disabled={tirando !== ""} onClick={() => { const { devolver } = tirarShow; setTirando(`livro|${t.dailyBookId}`); void devolver(t.dailyBookId).finally(() => setTirando("")); }}>Voltar ao dia</button>}
      </li>)}</ul>
    </section>}

    {view === "pessoa" && !telefone && <div className="ge-legenda" aria-label="Cores por tipo de atividade">
      {legenda.map((t) => <span key={t.id} style={{ "--bg": `var(--esc-t-${t.cor}-bg)`, "--fg": `var(--esc-t-${t.cor}-fg)` } as CSSProperties}>{t.nome}</span>)}
      <span className="ge-leg-estado"><i style={{ boxShadow: "inset 0 0 0 2px var(--esc-choque)" }}/>choque de horário</span>
      <span className="ge-leg-estado"><i style={{ boxShadow: "inset 0 0 0 2px var(--esc-excecao)" }}/>exceção</span>
    </div>}


    {telefone && !(dia.fechado && !dia.escala) && <div className="ge-depois"><ResumoDoDia data={dia.date} pessoas={dia.pessoas} blocos={dia.blocos} blocosDe={blocosDe} pessoasComChoque={new Set(conflitos.map((c) => c.pessoaId)).size} motivoDaFolga={motivoDaFolga} soExcecoes={soExcecoes} onSoExcecoes={setSoExcecoes} onIrParaAtencao={irParaAtencao} parte="numeros"/></div>}

    {pessoaSelecionada && <section style={css("display:flex;flex-direction:column;gap:8px;background:#fff;border:1px solid var(--asa-line);border-radius:14px;padding:12px 14px")} aria-label={`Dia de ${pessoaSelecionada.name}`}>
      <div style={css("display:flex;flex-wrap:wrap;align-items:center;gap:8px")}>
        <h3 style={css("margin:0;font:600 15px Outfit,sans-serif;color:var(--asa-ink-dark);flex:1;min-width:140px")}>{`Dia de ${pessoaSelecionada.name}`}</h3>
        {saiu && podeMexer(pessoaSelecionada) && <button type="button" className="esc-cell-adjust esc-hit" style={{ minHeight: 44 }} onClick={() => setSaindo({ pessoa: pessoaSelecionada, aPartirDe: blocosDe(pessoaSelecionada.id).sort((a, b) => a.inicio.localeCompare(b.inicio))[0]?.inicio ?? "12:00" })}>Saiu ou não vem…</button>}
        {localDoDia && localDoDia.locais.length > 0 && podeMexer(pessoaSelecionada) && !pessoaSelecionada.folga && <button type="button" className="esc-cell-adjust esc-hit" style={{ minHeight: 44 }} onClick={() => setMudandoLocal({ modo: "mandar", pessoa: pessoaSelecionada, origem: null })}>Mandar para outro local hoje…</button>}
        <button type="button" className="esc-cell-adjust esc-hit" style={{ minHeight: 44 }} onClick={() => setSelecionada(null)}>Fechar</button>
      </div>
      {blocosDe(pessoaSelecionada.id).sort((a, b) => a.inicio.localeCompare(b.inicio)).map((b) => <div key={b.key} style={css("display:flex;align-items:center;gap:10px;font-size:13px;font-weight:600")}>
        <span style={css("font-family:'JetBrains Mono',monospace;font-size:12px;min-width:96px;color:var(--asa-label)")}>{faixa(b)}</span>
        <span style={css(blockStyle(toneOf(b, dia.tipos)))}>{textoDoBloco(b)}</span>
        {temChoque(pessoaSelecionada, b) && <span style={css("font-size:12px;color:var(--esc-choque);font-weight:700")}>choque</span>}
      </div>)}
      {!blocosDe(pessoaSelecionada.id).length && <span style={css("font-size:12.5px;color:var(--asa-label)")}>Sem atividades neste dia.</span>}
      {[...(dia.tempoDisponivel?.avisos ?? []), ...(dia.tempoDisponivel?.diaDividido ?? [])].filter((b) => b.pessoaId === pessoaSelecionada.id).sort((a, b) => a.de.localeCompare(b.de)).map((b) => <div key={`livre-${b.de}`} style={css("display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;font-size:12.5px;line-height:1.5;color:var(--asa-amber-dark);background:var(--asa-amber-pale);border:1px solid var(--asa-amber-stripe);border-radius:12px;padding:6px 11px")}>
        <span style={css("flex:1 1 200px;min-width:0")}><strong>Tempo disponível:</strong>{` ${fraseDoBuraco(b)}.`}</span>
        {onNovaAtividade && podeMexer(pessoaSelecionada) && <button type="button" className="esc-cell-adjust esc-hit" style={{ minHeight: 44 }} onClick={onNovaAtividade}>Adicionar atividade…</button>}
      </div>)}
    </section>}

    <div style={css("height:16px")}/>
    {desfazer && <div className="ge-desfazer" role="status"><span>{desfazer.texto}</span><button type="button" onClick={() => { const { acao } = desfazer; setDesfazer(null); void acao().catch(() => undefined); }}>Desfazer</button></div>}
    {menu && <BlocoMenu bloco={menu.bloco} pessoa={menu.pessoa} ancora={menu.rect} data={dia.date} temChoque={temChoque(menu.pessoa, menu.bloco)} excecao={ehExcecao(menu.bloco)} tipos={dia.tipos} pode={podeMexer(menu.pessoa)} motivoSemPoder={frasePorQueNao(menu.pessoa)} ocupado={tirando !== ""}
      onFechar={() => setMenu(null)}
      onTirar={() => { const { bloco, pessoa } = menu; setMenu(null); void tirarDoBloco(bloco, pessoa); }}
      onMudarHorario={() => { const { bloco, pessoa } = menu; const par = conflitos.find((c) => c.pessoaId === pessoa.id && (c.a.key === bloco.key || c.b.key === bloco.key)); setMenu(null); setMudandoHorario({ pessoaId: pessoa.id, nome: pessoa.name, bloco, outro: par ? (par.a.key === bloco.key ? par.b : par.a) : null }); }}
      onAjustar={() => { const { bloco } = menu; setMenu(null); setAjustando(bloco); }}
      onSaiu={saiu && podeMexer(menu.pessoa) ? () => { const { bloco, pessoa } = menu; setMenu(null); setSaindo({ pessoa, aPartirDe: bloco.inicio }); } : undefined}
      onTirarShow={tirarShow && canEdit && menu.bloco.dailyBookId && menu.bloco.dailyBookStatus !== "EXECUTED" ? () => { const { bloco } = menu; setMenu(null); setTirandoShow(bloco); } : undefined}/>}
    {tirandoShow && tirarShow && <TirarShowDialog rotulo={textoDoBloco(tirandoShow)} dataCurta={`${dia.date.slice(8, 10)}/${dia.date.slice(5, 7)}`} publicada={Boolean(dia.escala && dia.escala.status !== "DRAFT")} onClose={() => setTirandoShow(null)}
      onConfirmar={async (motivo) => {
        const bloco = tirandoShow;
        const frase = await tirarShow.tirar(bloco, motivo);
        if (!frase) { setTirandoShow(null); setDesfazer({ texto: `${textoDoBloco(bloco)} saiu do dia.`, acao: async () => { await tirarShow.devolver(bloco.dailyBookId!); } }); }
        return frase;
      }}/>}
    {saindo && saiu && <SaiuDialog pessoa={saindo.pessoa} inicialAPartirDe={saindo.aPartirDe} api={saiu} onClose={() => setSaindo(null)}
      onFeito={(saiuId, texto) => { setSaindo(null); setDesfazer({ texto, acao: async () => { await saiu.desfazer(saiuId); } }); }}/>}
    {mudandoLocal && localDoDia && <LocalDoDiaDialog modo={mudandoLocal.modo} pessoa={mudandoLocal.pessoa} data={dia.date} localAtual={dia.location} origem={mudandoLocal.origem} destinos={localDoDia.locais} onClose={() => setMudandoLocal(null)}
      onConfirmar={async (v) => {
        const { erro, imprevistoId } = await localDoDia.mover({ ...v, userId: mudandoLocal.pessoa.id });
        if (!erro) {
          const { pessoa, modo } = mudandoLocal;
          const para = modo === "trazer" ? dia.location.name : localDoDia.locais.find((l) => l.id === v.destinoId)?.name ?? "outro local";
          setMudandoLocal(null);
          setDesfazer({ texto: `${pessoa.name} trabalha em ${para} só hoje.`, acao: async () => { if (imprevistoId) await localDoDia.desfazer(imprevistoId); } });
        }
        return erro;
      }}/>}
    {confirmarGrade && <ConfirmDialog {...confirmarGrade} onClose={() => setConfirmarGrade(null)}/>}
    {mudandoHorario && <HorarioDialog nome={mudandoHorario.nome} bloco={mudandoHorario.bloco} outro={mudandoHorario.outro} onClose={() => setMudandoHorario(null)} onSalvar={async (horario) => {
      const erro = await onHorario(mudandoHorario.bloco.horarioDela ? { ...mudandoHorario.bloco, key: mudandoHorario.bloco.horarioDela.chaveOriginal } : mudandoHorario.bloco, mudandoHorario.pessoaId, horario);
      if (!erro) {
        const { nome, bloco, pessoaId } = mudandoHorario;
        setMudandoHorario(null);
        setDesfazer({ texto: `Horário de ${nome} em ${textoDoBloco(bloco)} mudado só para ela.`, acao: async () => { await onHorario(bloco.horarioDela ? { ...bloco, key: bloco.horarioDela.chaveOriginal } : bloco, pessoaId, null); } });
      }
      return erro;
    }}/>}
    {editandoAtividade && onEditarAtividade && <EditarAtividadeDialog bloco={editandoAtividade} tipos={dia.tipos ?? []} publicada={dia.escala?.status === "PUBLISHED" || dia.escala?.status === "REPUBLISHED"} onClose={() => setEditandoAtividade(null)}
      onSalvar={async (v) => { const erro = await onEditarAtividade(editandoAtividade, v); if (!erro) setEditandoAtividade(null); return erro; }}
      onVoltar={async () => { const erro = await onEditarAtividade(editandoAtividade, null); if (!erro) setEditandoAtividade(null); return erro; }}/>}
    {ajustando && <AjusteCelulaDialog bloco={ajustando} pessoas={dia.pessoas} editableAreaIds={editableAreaIds} onClose={() => setAjustando(null)} onAdjust={async (mudancas, motivo) => {
      await onAdjust(ajustando, mudancas, motivo);
      // Aplicado: fecha o diálogo e a grade mostra o resultado, sem versão intermediária na tela.
      setAjustando(null);
    }}/>}
  </div>;
}

/** Restrição de horário e limite de shows do dia são proibição; passar delas à mão é exceção e pede motivo escrito. */
const CODIGOS_DE_REGRA = ["PESSOA_COM_RESTRICAO_DE_HORARIO", "ACIMA_DO_LIMITE_DO_DIA", "PESSOA_EM_OUTRO_LOCAL"];
const recusaPorRegra = (err: unknown): err is ApiError<{ error: string; message?: string }> => err instanceof ApiError && err.status === 409 && CODIGOS_DE_REGRA.includes(String((err.data as { error?: unknown } | null)?.error));

/** Limite de shows por pessoa por dia e intervalo mínimo entre shows: o que o rodízio respeita neste local. */
function RegrasDoLocalDialog({ localId, localNome, onClose }: { localId: string; localNome: string; onClose: () => void }) {
  useFecharComEsc(onClose);
  const [carregando, setCarregando] = useState(true);
  const [limite, setLimite] = useState("");
  const [intervalo, setIntervalo] = useState("20");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  useEffect(() => {
    customFetch<{ limiteShowsDia: number | null; intervaloMinimoMinutos: number }>(`/api/escala-regras?locationId=${localId}`)
      .then((r) => { setLimite(r.limiteShowsDia === null ? "" : String(r.limiteShowsDia)); setIntervalo(String(r.intervaloMinimoMinutos)); })
      .catch((err) => setErro(mensagemDoErro(err, "Não consegui carregar as regras deste local. Feche e tente de novo.")))
      .finally(() => setCarregando(false));
  }, [localId]);
  const salvar = async (e: FormEvent) => {
    e.preventDefault();
    setSalvando(true); setErro("");
    try {
      await customFetch("/api/escala-regras", { method: "PUT", body: JSON.stringify({ locationId: localId, limiteShowsDia: limite.trim() === "" ? null : Number(limite), intervaloMinimoMinutos: Number(intervalo) }) });
      onClose();
    } catch (err) { setErro(mensagemDoErro(err, "Não consegui salvar as regras. Nada mudou; tente de novo.")); } finally { setSalvando(false); }
  };
  return <div className="shows-dialog-backdrop" role="presentation"><form className="shows-dialog" role="dialog" aria-modal="true" aria-label={`Regras de escala de ${localNome}`} onSubmit={(e) => void salvar(e)}>
    <header className="shows-dialog-header"><div><h2>Regras do local</h2><p>{localNome}</p></div><button type="button" onClick={onClose} aria-label="Fechar"><X size={18}/></button></header>
    <div className="shows-dialog-content" style={css("display:flex;flex-direction:column;gap:14px")}>
      {carregando ? <span style={css("font-size:12.5px;color:var(--asa-label)")}>Carregando…</span> : <>
        <label style={css("display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:700;color:var(--asa-ink-dark)")}>Máximo de shows por pessoa no mesmo dia
          <input type="number" inputMode="numeric" min={1} max={20} value={limite} onChange={(e) => setLimite(e.target.value)} placeholder="Sem limite" style={css("min-height:44px;border:1px solid var(--asa-line-soft);border-radius:10px;padding:8px 10px;font:600 13px Manrope,sans-serif;color:var(--asa-ink-dark)")}/>
          <small style={css("font-weight:500;color:var(--asa-label);line-height:1.5")}>{limite.trim() === "" ? "Sem limite: o rodízio só prefere quem tem menos shows." : `O rodízio não escala ninguém num ${Number(limite) + 1}º show do dia. Em emergência, a Administração ou a Supervisão passa do limite à mão, com motivo.`}</small>
        </label>
        <label style={css("display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:700;color:var(--asa-ink-dark)")}>Intervalo mínimo entre dois shows (minutos)
          <input type="number" inputMode="numeric" min={0} max={240} value={intervalo} onChange={(e) => setIntervalo(e.target.value)} style={css("min-height:44px;border:1px solid var(--asa-line-soft);border-radius:10px;padding:8px 10px;font:600 13px Manrope,sans-serif;color:var(--asa-ink-dark)")}/>
          <small style={css("font-weight:500;color:var(--asa-label);line-height:1.5")}>Dois shows mais perto que isso contam como colados: o rodízio evita a mesma pessoa nos dois, mas escala se não houver outra.</small>
        </label>
      </>}
      {erro && <p role="alert" style={css("margin:0;padding:10px 12px;border-left:3px solid var(--asa-red);background:var(--asa-red-airy);color:var(--asa-red-dark);border-radius:8px;font-size:13px;line-height:1.45")}>{erro}</p>}
    </div>
    <footer className="shows-dialog-footer">
      <button type="button" onClick={onClose} className="shows-secondary">Cancelar</button>
      <button type="submit" className="shows-primary" disabled={carregando || salvando}>{salvando ? "Salvando…" : "Salvar regras"}</button>
    </footer>
  </form></div>;
}

const emMinutos = (hora: string) => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5));
const deMinutos = (minutos: number) => `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
/**
 * Sugestão de horário só para uma pessoa em choque: a atividade comece 5 minutos depois que a outra termina. Mantém o mesmo fim se
 * sobrar pelo menos metade do tempo; se sobrar menos, mantém a mesma duração. Show sem hora de fim cadastrada vale 30 minutos (a janela avisa).
 */
export function sugerirHorario(mover: { inicio: string; fim: string | null }, outro: { inicio: string; fim: string | null }): { inicio: string; fim: string | null; aviso: string | null } {
  const outroSemFim = !outro.fim;
  const fimDoOutro = outro.fim ? emMinutos(outro.fim) : emMinutos(outro.inicio) + 30;
  const inicio = Math.min(fimDoOutro + 5, 23 * 60 + 29);
  if (!mover.fim) return { inicio: deMinutos(inicio), fim: null, aviso: outroSemFim ? "A outra atividade não tem hora de fim cadastrada: contei 30 minutos. Confira." : null };
  const duracao = emMinutos(mover.fim) - emMinutos(mover.inicio);
  const sobra = emMinutos(mover.fim) - inicio;
  const fim = Math.min(sobra >= duracao / 2 ? emMinutos(mover.fim) : inicio + duracao, 23 * 60 + 59);
  return { inicio: deMinutos(inicio), fim: deMinutos(fim), aviso: outroSemFim ? "A outra atividade não tem hora de fim cadastrada: contei 30 minutos. Confira." : null };
}

function HorarioDialog({ nome, bloco, outro, onClose, onSalvar }: { nome: string; bloco: Bloco; outro: Bloco | null; onClose: () => void; onSalvar: (horario: { inicio: string; fim: string | null; motivo?: string }) => Promise<string | null> }) {
  useFecharComEsc(onClose);
  const normal = bloco.horarioDela ? { inicio: bloco.horarioDela.inicio, fim: bloco.horarioDela.fim } : { inicio: bloco.inicio, fim: bloco.fim };
  const sugestao = outro ? sugerirHorario(normal, outro) : { inicio: normal.inicio, fim: normal.fim, aviso: null as string | null };
  const [inicio, setInicio] = useState(sugestao.inicio);
  const [fim, setFim] = useState(sugestao.fim ?? "");
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");
  const invalido = !inicio || (fim !== "" && fim <= inicio);
  const salvar = async () => {
    setSaving(true); setErro("");
    try { const frase = await onSalvar({ inicio, fim: fim || null, motivo: motivo.trim() || undefined }); if (frase) setErro(frase); } finally { setSaving(false); }
  };
  const campo = "width:100%;box-sizing:border-box;border:1px solid var(--asa-line-soft);border-radius:10px;padding:10px 12px;font:600 13px Manrope,sans-serif;color:var(--asa-ink-dark)";
  return <div className="shows-dialog-backdrop" role="presentation"><div className="shows-dialog" role="dialog" aria-modal="true" aria-label={`Mudar o horário de ${textoDoBloco(bloco)} só para ${nome}`}>
    <header className="shows-dialog-header"><div><h2>Mudar o horário só desta pessoa</h2><p>{`${nome} · ${textoDoBloco(bloco)}`}</p></div><button type="button" onClick={onClose} aria-label="Fechar"><X size={18}/></button></header>
    <div className="shows-dialog-content" style={css("display:flex;flex-direction:column;gap:12px")}>
      <p style={css("margin:0;font-size:12.5px;line-height:1.5;color:var(--asa-ink-muted)")}>{outro
        ? `${nome} está em ${textoDoBloco(bloco)} (${faixa(normal)}) e em ${textoDoBloco(outro)} (${faixa(outro)}) ao mesmo tempo. Dá para mudar só o horário de ${textoDoBloco(bloco)} para essa pessoa, sem tirar ninguém e sem mexer nos outros. Vale só para este dia; a Programação não muda.`
        : `${nome} faz ${textoDoBloco(bloco)} (${faixa(normal)}). Dá para mudar só o horário dela, sem mexer nos outros. É uma exceção só dela e vale só para este dia; a Programação não muda.`}</p>
      {outro && <div style={css("border:1px solid var(--asa-lavender);background:var(--asa-purple-dawn);border-radius:11px;padding:10px 12px;font-size:12px;line-height:1.5;color:var(--asa-ink-dark)")}>
        <strong>{`Sugestão: ${faixa(sugestao)}`}</strong> — logo depois de {textoDoBloco(outro)}.{sugestao.aviso ? ` ${sugestao.aviso}` : ""}
      </div>}
      <div style={css("display:grid;grid-template-columns:1fr 1fr;gap:10px")}>
        <label style={css("display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--asa-label)")}>Começa às<input type="time" value={inicio} onChange={(e) => setInicio(e.target.value)} style={css(campo)}/></label>
        <label style={css("display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--asa-label)")}>Termina às<input type="time" value={fim} onChange={(e) => setFim(e.target.value)} style={css(campo)}/></label>
      </div>
      {fim !== "" && fim <= inicio && <span role="alert" style={css("font-size:12px;color:var(--asa-ausente-fg)")}>O fim precisa ser depois do início.</span>}
      <label style={css("display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--asa-label)")}>Por quê? (opcional, fica no Registro)
        <textarea rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Tem boas-vindas às 10:00" style={css(campo + ";resize:vertical")}/>
      </label>
      {erro && <p role="alert" style={css("margin:0;font-size:12.5px;line-height:1.5;color:var(--asa-ausente-fg)")}>{erro}</p>}
    </div>
    <footer className="shows-dialog-footer">
      <button type="button" onClick={onClose} className="shows-secondary" disabled={saving}>Cancelar</button>
      <button type="button" className="shows-primary" disabled={invalido || saving} onClick={() => void salvar()}>{saving ? "Salvando…" : "Salvar horário"}</button>
    </footer>
  </div></div>;
}

export function AjusteCelulaDialog({ bloco, pessoas, editableAreaIds, focoVaga, onClose, onAdjust }: { bloco: Bloco; pessoas: Pessoa[]; editableAreaIds: string[] | null; /** Abre já escolhendo quem faz este personagem (vem do botão Trocar do Livro do Dia). */ focoVaga?: string | null; onClose: () => void; onAdjust: (mudancas: Mudanca[], motivo?: string) => Promise<void> }) {
  useFecharComEsc(onClose);
  const [busca, setBusca] = useState("");
  const [saving, setSaving] = useState(false);
  // Marca quem entra e quem sai; vai tudo num pedido só, em vez de esperar uma pessoa de cada vez.
  const [mexidas, setMexidas] = useState<Record<string, boolean>>({});
  // Bloco de Livro do Dia: o ajuste é por personagem. `trocas` guarda, por vaga, quem passa a fazer (null = deixar em aberto).
  const vagas = bloco.vagas ?? [];
  const emVagas = vagas.length > 0;
  const entraAgora = (id: string) => mexidas[id] ?? bloco.pessoaIds.includes(id);
  const [trocas, setTrocas] = useState<Record<string, string | null>>({});
  const [escolhendo, setEscolhendo] = useState<string | null>(focoVaga && vagas.some((v) => v.assignmentId === focoVaga) ? focoVaga : null);
  const quemFaz = (v: VagaDoLivro, t: Record<string, string | null> = trocas) => (v.assignmentId in t ? t[v.assignmentId] : v.userId) ?? null;
  const nomeDe = (id: string | null) => (id ? pessoas.find((p) => p.id === id)?.name ?? "—" : "ninguém");
  /** Tira quem fazia e põe quem vai fazer, vaga a vaga; quem sai vem antes de quem entra para a ordem do pedido não atrapalhar. */
  const mudancasDeTrocas = (t: Record<string, string | null>): Mudanca[] => {
    const sai: Mudanca[] = [], entra: Mudanca[] = [];
    for (const v of vagas) {
      if (!(v.assignmentId in t) || t[v.assignmentId] === v.userId) continue;
      if (v.userId) sai.push({ userId: v.userId, action: "REMOVER", assignmentId: v.assignmentId });
      if (t[v.assignmentId]) entra.push({ userId: t[v.assignmentId]!, action: "ADICIONAR", assignmentId: v.assignmentId });
    }
    return [...sai, ...entra];
  };
  // Escolher alguém que já faz outro personagem move a pessoa: o outro personagem fica em aberto até escolherem quem faz.
  const escolher = (vaga: VagaDoLivro, pessoaId: string | null, t: Record<string, string | null> = trocas) => {
    const novo = { ...t, [vaga.assignmentId]: pessoaId };
    if (pessoaId) for (const outra of vagas) if (outra.assignmentId !== vaga.assignmentId && quemFaz(outra, novo) === pessoaId) novo[outra.assignmentId] = null;
    return novo;
  };
  const porPersonagem = emVagas ? mudancasDeTrocas(trocas) : [];
  const mudancas: Mudanca[] = emVagas ? porPersonagem : Object.entries(mexidas).filter(([id, entra]) => entra !== bloco.pessoaIds.includes(id)).map(([userId, entra]) => ({ userId, action: entra ? "ADICIONAR" as const : "REMOVER" as const }));
  const nTrocas = emVagas ? vagas.filter((v) => v.assignmentId in trocas && trocas[v.assignmentId] !== v.userId).length : mudancas.length;
  const [excecao, setExcecao] = useState<{ mensagem: string; mudancas: Mudanca[]; motivo: string } | null>(null);
  const aplicar = async () => {
    setSaving(true);
    try { await onAdjust(mudancas); } catch (err) {
      if (recusaPorRegra(err)) setExcecao({ mensagem: err.data?.message ?? "Esta pessoa passa de uma regra da escala. Para escalar mesmo assim, escreva o motivo.", mudancas, motivo: "" }); else throw err;
    } finally { setSaving(false); }
  };
  const escalarMesmoAssim = async () => {
    if (!excecao || excecao.motivo.trim().length < 3) return;
    setSaving(true);
    try { await onAdjust(excecao.mudancas, excecao.motivo.trim()); } catch (err) {
      if (recusaPorRegra(err)) setExcecao({ ...excecao, mensagem: err.data?.message ?? excecao.mensagem }); else throw err;
    } finally { setSaving(false); }
  };
  const confirmarChamada = async () => {
    if (!chamar || motivo.trim().length < 3) return;
    setSaving(true);
    const vaga = emVagas ? vagas.find((v) => v.assignmentId === escolhendo) : undefined;
    try { await onAdjust(vaga ? mudancasDeTrocas(escolher(vaga, chamar.id)) : [{ userId: chamar.id, action: "ADICIONAR" }], motivo.trim()); setChamar(null); setMotivo(""); } catch (err) {
      if (recusaPorRegra(err)) setExcecao({ mensagem: err.data?.message ?? "Esta pessoa passa de uma regra da escala. Para escalar mesmo assim, escreva o motivo.", mudancas: vaga ? mudancasDeTrocas(escolher(vaga, chamar.id)) : [{ userId: chamar.id, action: "ADICIONAR" }], motivo: motivo.trim() }); else throw err;
    } finally { setSaving(false); }
  };
  const daMinhaArea = (p: Pessoa) => editableAreaIds === null || (p.areaId !== null && editableAreaIds.includes(p.areaId));
  const naBusca = (p: Pessoa) => `${p.name} ${p.areaName ?? ""}`.toLocaleLowerCase("pt-BR").includes(busca.toLocaleLowerCase("pt-BR"));
  const elegiveis = pessoas.filter((p) => !p.folga && daMinhaArea(p) && naBusca(p));
  // Emergência: quem está de folga pode ser chamado, com motivo escrito.
  const deFolga = pessoas.filter((p) => p.folga && daMinhaArea(p) && naBusca(p) && !bloco.pessoaIds.includes(p.id));
  const [chamar, setChamar] = useState<Pessoa | null>(null);
  const [motivo, setMotivo] = useState("");
  return <div className="shows-dialog-backdrop" role="presentation"><div className="shows-dialog" role="dialog" aria-modal="true" aria-label={`Ajustar ${textoDoBloco(bloco)}`}>
    <header className="shows-dialog-header"><div><h2>Ajustar bloco</h2><p>{`${textoDoBloco(bloco)} · ${faixa(bloco)}`}</p></div><button type="button" onClick={onClose} aria-label="Fechar"><X size={18}/></button></header>
    <div className="shows-dialog-content" style={css("display:flex;flex-direction:column;gap:12px")}>
      <p style={css("margin:0;font-size:12.5px;line-height:1.5;color:var(--asa-ink-muted)")}>{emVagas ? "Escolha o personagem e quem passa a fazê-lo. Vale só para este dia: a Programação não muda e o Livro do Dia muda junto." : "Este ajuste vale só para este dia; a Programação não muda. Em show com Livro do Dia, a vaga muda no Livro também."}</p>
      {emVagas && <div style={css("display:flex;flex-direction:column;gap:7px")}>{vagas.map((v) => {
        const quem = quemFaz(v);
        const mudou = quem !== v.userId;
        const aberta = escolhendo === v.assignmentId;
        const candidatas = elegiveis.filter((p) => p.id !== quem);
        return <div key={v.assignmentId} style={css("display:flex;flex-direction:column;gap:8px;border:1px solid " + (aberta || mudou ? "var(--asa-lavender)" : "var(--asa-border-soft)") + ";background:" + (mudou ? "var(--asa-purple-dawn)" : "#fff") + ";border-radius:11px;padding:10px 12px")}>
          <div style={css("display:flex;align-items:center;gap:10px;flex-wrap:wrap")}>
            <span style={css("display:flex;flex-direction:column;gap:1px;min-width:0;flex:1 1 140px")}>
              <strong style={css("font-size:13px;color:var(--asa-ink-dark)")}>{v.personagem}</strong>
              <span style={css("font-size:12px;color:" + (quem ? "var(--asa-ink-muted)" : "var(--asa-vaga-fg)"))}>{quem ? `${nomeDe(quem)}${mudou ? ` · era ${nomeDe(v.userId)}` : ""}` : `sem ninguém${mudou ? ` · era ${nomeDe(v.userId)}` : ""}`}</span>
            </span>
            {mudou && <button type="button" className="esc-hit" disabled={saving} onClick={() => setTrocas((t) => { const { [v.assignmentId]: _fora, ...resto } = t; return resto; })} style={css(btn("ghost") + "padding:7px 12px")}>Desfazer</button>}
            <button type="button" className="esc-hit" disabled={saving} aria-expanded={aberta} onClick={() => { setEscolhendo(aberta ? null : v.assignmentId); setBusca(""); }} style={css((aberta ? btn("ghost") : btn("primary")) + "padding:7px 12px")}>{aberta ? "Fechar" : quem ? "Trocar" : "Escolher"}</button>
          </div>
          {aberta && <div style={css("display:flex;flex-direction:column;gap:6px;border-top:1px solid var(--asa-book-fade);padding-top:8px")}>
            <input autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={`Quem faz ${v.personagem}? Buscar pessoa ou área`} aria-label={`Buscar quem faz ${v.personagem}`} style={css("width:100%;box-sizing:border-box;border:1px solid var(--asa-line-soft);border-radius:10px;padding:9px 12px;font:600 12.5px Manrope,sans-serif;color:var(--asa-ink-dark);background:#fff;")}/>
            <div style={css("display:flex;flex-direction:column;gap:5px;max-height:240px;overflow:auto")}>
              {candidatas.map((p) => {
                const jaFaz = vagas.find((o) => o.assignmentId !== v.assignmentId && quemFaz(o) === p.id);
                return <button key={p.id} type="button" className="esc-hit" disabled={saving} onClick={() => { setTrocas(escolher(v, p.id)); setEscolhendo(null); setBusca(""); }} style={css("display:flex;align-items:center;gap:10px;text-align:left;border:1px solid var(--asa-border-soft);background:#fff;border-radius:10px;padding:8px 11px;cursor:pointer;font-family:Manrope,sans-serif")}>
                  <span style={css("width:26px;height:26px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,var(--asa-violet),var(--asa-indigo));color:#fff;font:700 12px 'JetBrains Mono',monospace")}>{initials(p.name)}</span>
                  <span style={css("display:flex;flex-direction:column;gap:1px;min-width:0;flex:1")}>
                    <strong style={css("font-size:12.5px;color:var(--asa-ink-dark)")}>{p.name}</strong>
                    <span style={css("font-size:12px;color:" + (jaFaz ? "var(--asa-badge-fg)" : "var(--asa-label)"))}>{jaFaz ? `já faz ${jaFaz.personagem} · ${jaFaz.personagem} fica sem ninguém` : p.areaName ?? "Sem área"}</span>
                  </span>
                </button>;
              })}
              {!candidatas.length && <span style={css("font-size:12px;color:var(--asa-label);padding:6px 0")}>Nenhuma pessoa disponível neste filtro.</span>}
            </div>
            {quem && <button type="button" className="esc-hit" disabled={saving} onClick={() => { setTrocas(escolher(v, null)); setEscolhendo(null); setBusca(""); }} style={css(btn("ghost") + "padding:7px 12px;align-self:flex-start")}>Deixar a vaga aberta</button>}
            {quem && <span style={css("font-size:12px;line-height:1.45;color:var(--asa-label)")}>A vaga fica aberta e o personagem continua no dia. Para tirá-lo do dia de vez, use o botão “Tirar” no Livro do Dia.</span>}
          </div>}
        </div>;
      })}</div>}
      {!emVagas && <input autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar pessoa ou área" aria-label="Buscar pessoa para ajustar" style={css("width:100%;box-sizing:border-box;border:1px solid var(--asa-line-soft);border-radius:10px;padding:10px 12px;font:600 12.5px Manrope,sans-serif;color:var(--asa-ink-dark);background:#fff;")}/>}
      {!emVagas && <div style={css("display:flex;flex-direction:column;gap:7px")}>{elegiveis.map((p) => {
        const entra = entraAgora(p.id);
        const mudou = entra !== bloco.pessoaIds.includes(p.id);
        return <div key={p.id} style={css("display:flex;align-items:center;gap:10px;border:1px solid " + (mudou ? "var(--asa-lavender)" : "var(--asa-border-soft)") + ";background:" + (mudou ? "var(--asa-purple-dawn)" : "#fff") + ";border-radius:11px;padding:10px 12px")}>
          <span style={css("width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,var(--asa-violet),var(--asa-indigo));color:#fff;font:700 12px 'JetBrains Mono',monospace")}>{initials(p.name)}</span>
          <span style={css("display:flex;flex-direction:column;gap:1px;min-width:0;flex:1")}><strong style={css("font-size:12.5px;color:var(--asa-ink-dark)")}>{p.name}</strong><span style={css("font-size:12px;color:" + (mudou ? "var(--asa-purple)" : "var(--asa-label)"))}>{mudou ? (entra ? "vai entrar" : "vai sair") : p.areaName ?? "Sem área"}</span></span>
          <button type="button" className="esc-hit" disabled={saving} onClick={() => setMexidas((m) => ({ ...m, [p.id]: !entra }))} style={css(entra ? btn("ghost") + "padding:7px 12px" : btn("primary") + "padding:7px 12px")}>{entra ? "Tirar" : "Colocar"}</button>
        </div>;
      })}</div>}
      {!emVagas && !elegiveis.length && <span style={css("font-size:12px;color:var(--asa-label);padding:8px 0")}>Nenhuma pessoa disponível neste filtro.</span>}
      {deFolga.length > 0 && (!emVagas || escolhendo) && <details style={css("border-top:1px solid var(--asa-book-fade);padding-top:10px")}>
        <summary style={css("cursor:pointer;list-style:none;font-size:12px;font-weight:700;color:var(--asa-badge-fg)")}>{`${plural(deFolga.length, "pessoa de folga neste dia", "pessoas de folga neste dia")} · chamar em emergência`}</summary>
        <p style={css("margin:8px 0 6px;font-size:12px;line-height:1.5;color:var(--asa-label)")}>Folga vence a escala. Chamar alguém na folga pede o motivo, avisa a pessoa na hora e deixa a folga para a Administração remarcar.</p>
        <div style={css("display:flex;flex-direction:column;gap:6px")}>
          {deFolga.map((p) => <div key={p.id} style={css("display:flex;align-items:center;gap:10px;border:1px dashed var(--asa-vaga-bd);background:var(--asa-late-bg);border-radius:11px;padding:9px 12px")}>
            <span style={css("display:flex;flex-direction:column;gap:1px;min-width:0;flex:1")}><strong style={css("font-size:12.5px;color:var(--asa-ink-dark)")}>{p.name}</strong><span style={css("font-size:12px;color:var(--asa-badge-fg)")}>de folga neste dia</span></span>
            <button type="button" className="esc-hit" disabled={saving} onClick={() => { setChamar(p); setMotivo(""); }} style={css(btn("ghost") + "padding:7px 12px")}>Chamar mesmo assim</button>
          </div>)}
        </div>
      </details>}
      {excecao && <div role="alert" style={css("display:flex;flex-direction:column;gap:7px;border:1px solid var(--asa-vaga-bd);background:var(--asa-late-bg);border-radius:11px;padding:11px 13px")}>
        <strong style={css("font-size:12.5px;color:var(--asa-amber-dark)")}>Passar de uma regra da escala</strong>
        <p style={css("margin:0;font-size:12px;line-height:1.5;color:var(--asa-ink-muted)")}>{excecao.mensagem}</p>
        <label style={css("display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--asa-label)")}>Por quê? (fica no Registro e avisa a Administração e a Supervisão)
          <textarea rows={2} value={excecao.motivo} onChange={(e) => setExcecao({ ...excecao, motivo: e.target.value })} placeholder="Alguém ficou mal de última hora" style={css("border:1px solid var(--asa-line-soft);border-radius:9px;padding:8px 10px;font:600 12.5px Manrope,sans-serif;color:var(--asa-ink-dark);resize:vertical")}/>
        </label>
        <div style={css("display:flex;gap:8px;justify-content:flex-end")}>
          <button type="button" className="esc-hit" disabled={saving} onClick={() => setExcecao(null)} style={css(btn("ghost") + "padding:7px 12px")}>Cancelar</button>
          <button type="button" className="esc-hit" disabled={saving || excecao.motivo.trim().length < 3} onClick={() => void escalarMesmoAssim()} style={css(btn("primary") + "padding:7px 12px")}>{saving ? "Salvando…" : "Escalar mesmo assim"}</button>
        </div>
      </div>}
      {chamar && <div style={css("display:flex;flex-direction:column;gap:7px;border:1px solid var(--asa-vaga-bd);background:var(--asa-late-bg);border-radius:11px;padding:11px 13px")}>
        <strong style={css("font-size:12.5px;color:var(--asa-amber-dark)")}>{`Chamar ${chamar.name} na folga`}</strong>
        <label style={css("display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--asa-label)")}>Por quê? (fica no Registro e vai no aviso para ela)
          <textarea rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Falta de gente no show das 14h" style={css("border:1px solid var(--asa-line-soft);border-radius:9px;padding:8px 10px;font:600 12.5px Manrope,sans-serif;color:var(--asa-ink-dark);resize:vertical")}/>
        </label>
        <div style={css("display:flex;gap:8px;justify-content:flex-end")}>
          <button type="button" className="esc-hit" disabled={saving} onClick={() => setChamar(null)} style={css(btn("ghost") + "padding:7px 12px")}>Cancelar</button>
          <button type="button" className="esc-hit" disabled={saving || motivo.trim().length < 3} onClick={() => void confirmarChamada()} style={css(btn("primary") + "padding:7px 12px")}>{saving ? "Salvando…" : "Chamar e avisar"}</button>
        </div>
      </div>}
    </div>
    <footer className="shows-dialog-footer">
      <button type="button" onClick={onClose} className="shows-secondary">{mudancas.length ? "Cancelar" : "Fechar"}</button>
      <button type="button" className="shows-primary" disabled={!mudancas.length || saving} onClick={() => void aplicar()}>{saving ? "Salvando…" : nTrocas > 1 ? `Aplicar ${nTrocas} mudanças` : "Aplicar"}</button>
    </footer>
  </div></div>;
}

type ItemDoMais = { key: string; label: string; href?: string; onClick?: () => void; disabled?: boolean };

/** Menu "Mais" do rodapé: abre para cima (o rodapé fica embaixo); no telefone vira uma folha acima da barra de baixo, com "Fechar". */
function MenuMais({ itens }: { itens: ItemDoMais[] }) {
  const [aberto, setAberto] = useState(false);
  const botao = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const fechar = useCallback(() => { setAberto(false); botao.current?.focus(); }, []);
  useFecharComEsc(fechar, aberto);
  useEffect(() => { if (aberto) menu.current?.querySelector<HTMLElement>("[role=menuitem]:not([disabled])")?.focus(); }, [aberto]);
  const setas = (e: ReactKeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const lista = [...(menu.current?.querySelectorAll<HTMLElement>("[role=menuitem]:not([disabled])") ?? [])];
    const i = lista.indexOf(document.activeElement as HTMLElement);
    lista[(i + (e.key === "ArrowDown" ? 1 : -1) + lista.length) % lista.length]?.focus();
  };
  return <div className="esc-mais">
    <button ref={botao} type="button" className="esc-hit esc-mais-botao" aria-haspopup="menu" aria-expanded={aberto} onClick={() => setAberto((v) => !v)} style={css(btn("ghost"))}>Mais ▾</button>
    {aberto && <>
      <button type="button" className="esc-mais-fundo" tabIndex={-1} aria-label="Fechar o menu" onClick={fechar}/>
      <div ref={menu} className="esc-mais-menu" role="menu" aria-label="Mais ações da escala" onKeyDown={setas}>
        {itens.map((i) => i.href
          ? <Link key={i.key} href={i.href} role="menuitem" className="esc-mais-item">{i.label}</Link>
          : <button key={i.key} type="button" role="menuitem" className="esc-mais-item" disabled={i.disabled} onClick={() => { setAberto(false); i.onClick?.(); }}>{i.label}</button>)}
        <button type="button" className="esc-mais-fechar" onClick={fechar}>Fechar</button>
      </div>
    </>}
  </div>;
}

/* ---------- rodapé: áreas prontas e publicação ---------- */
// O último local escolhido fica guardado neste aparelho; se ele sumir da lista, volta ao primeiro.
const LOCAL_KEY = "myasa-escalas-local";
function lembrarLocal(list: { id: string }[]): string | undefined {
  // Atalho que já sabe o local (?local=, vindo do Meu Dia) vence o último local aberto.
  const pedido = new URLSearchParams(window.location.search).get("local");
  if (pedido && list.some((l) => l.id === pedido)) return pedido;
  try { const id = localStorage.getItem(LOCAL_KEY); if (id && list.some((l) => l.id === id)) return id; } catch { /* sem armazenamento */ }
  return list[0]?.id;
}
function guardarLocal(id: string) { try { localStorage.setItem(LOCAL_KEY, id); } catch { /* sem armazenamento */ } }

function Rodape({ role, tab, onMinha = false, dia, minha, areasMinhas, saving, busy = "", onGerar, onGerarMes, onCopiar, onRefazer, onRegras, onPronta, onPublicar }: { onRefazer?: () => void; role: Role; tab: string; onMinha?: boolean; dia: Dia | null; minha: Minha | null; areasMinhas: string[]; saving: boolean; busy?: string; onGerar: () => void; onGerarMes?: () => void; onCopiar?: () => void; onRegras?: () => void; onPronta: (areaIds: string[], pronta: boolean) => void; onPublicar: (republicar: boolean) => void }) {
  const isMem = role === "mem" || onMinha, isDir = role === "dir", isAdm = role === "adm";
  let note = "";
  const actions: ReactNode[] = [];
  // Ações de apoio ficam no menu "Mais"; no rodapé sobra só a ação principal (gerar, marcar pronta, publicar).
  const apoio: ItemDoMais[] = [];
  // Atalhos do desenho 15: folga e troca moram em Folgas e solicitações; aqui só levam até lá.
  if (!isMem && !isDir && tab === "escala") apoio.push({ key: "folga", label: "Folga", href: "/folgas" }, { key: "troca", label: "Registrar troca", href: "/solicitacoes" });
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
    else if (!dia.escala && dia.fechado) note = "Local fechado neste dia: não há Escala para gerar.";
    else if (!dia.escala) note = isAdm ? "Gere o dia para criar a Escala e os Livros dos Shows programados como rascunho. Ou copie de outro dia pelo menu Mais." : `Este dia ainda não foi gerado. Quem gera a Escala e os Livros é a Administração.${onCopiar ? " Você pode copiar de outro dia pelo menu Mais." : ""}`;
    else if (dia.escala.alteradaDesde) note = "Mudou depois de publicada · quem faz só recebe a mudança quando você republicar";
    else if (published) note = `Publicada${dia.escala.publishedAt ? ` às ${hhmm(dia.escala.publishedAt)}` : ""} · ${dia.areas.length} ${dia.areas.length === 1 ? "área" : "áreas"} · a mesma escalação está no Livro do Dia`;
    else note = `Rascunho · ${prontas.length} de ${dia.areas.length} ${dia.areas.length === 1 ? "parte enviada" : "partes enviadas"}${faltam.length ? ` · falta ${faltam.map((a) => a.name).join(", ")}` : ""}${faltam.filter((a) => a.prontaTirada).map((a) => ` · ${a.name}: marca tirada por ${a.prontaTirada!.por ?? "alguém"} às ${hhmm(a.prontaTirada!.em)}`).join("")} · publica a Administração`;
    // O mês inteiro de uma vez, em rascunho: a Administração confere depois e publica dia a dia.
    if (tab === "escala" && isAdm && onRegras) apoio.push({ key: "regras", label: "Regras do local", onClick: onRegras, disabled: saving });
    if (tab === "escala" && isAdm && onGerarMes) apoio.push({ key: "gerar-mes", label: "Gerar o mês", onClick: onGerarMes, disabled: saving });
    // Copiar de outro dia: Administração e Supervisão do local; não faz sentido no dia em que o local não abre e não há Escala.
    if (tab === "escala" && onCopiar && !(dia.fechado && !dia.escala)) apoio.push({ key: "copiar", label: "Copiar de outro dia", onClick: onCopiar, disabled: saving });
    // Refazer os Livros deste dia: Administração e Supervisão do local, só com a Escala e os Livros do dia gerados.
    if (tab === "escala" && onRefazer && dia.escala) apoio.push({ key: "refazer", label: "Refazer os Livros deste dia", onClick: onRefazer, disabled: saving });
    if (tab === "escala" && isAdm && !dia.escala && !dia.fechado) actions.push(<button key="generate" type="button" className="esc-hit" disabled={saving} onClick={onGerar} style={css(btn("primary"))}>{busy === "gerar" ? "Gerando Escala e Livros…" : "Gerar Escala e Livros"}</button>);
    // Show que entrou na Programação depois da geração fica sem Livro: dá para gerar o que falta.
    const semLivro = dia.escala ? dia.blocos.filter((b) => b.regra === "livro" && !b.dailyBookId).length : 0;
    if (tab === "escala" && isAdm && semLivro > 0) actions.push(<button key="gerar-faltam" type="button" className="esc-hit" disabled={saving} onClick={onGerar} style={css(btn("primary"))}>{busy === "gerar" ? "Gerando…" : `Gerar ${semLivro === 1 ? "o Livro que falta" : `os ${semLivro} Livros que faltam`}`}</button>);
    if (tab === "escala" && !isDir && !published && !(dia.fechado && !dia.escala)) {
      // Quem cuida de mais de uma área marca todas de uma vez.
      const minhasPendentes = areasMinhas.map((id) => dia.areas.find((a) => a.id === id)).filter((a): a is Area => Boolean(a) && !a!.pronta);
      if (minhasPendentes.length > 1) actions.push(<button key="todas" type="button" className="esc-hit" disabled={saving} onClick={() => onPronta(minhasPendentes.map((a) => a.id), true)} style={css(btn("primary"))}>{busy === "pronta:todas" ? "Enviando…" : `Enviar minhas ${minhasPendentes.length} partes`}</button>);
      for (const areaId of areasMinhas) {
        const area = dia.areas.find((a) => a.id === areaId);
        if (!area) continue;
        actions.push(<button key={areaId} type="button" className="esc-hit" disabled={saving} onClick={() => onPronta([areaId], !area.pronta)} style={css(btn(area.pronta ? "ghost" : "primary"))}>{busy === `pronta:${areaId}` ? (area.pronta ? "Voltando…" : "Enviando…") : area.pronta ? `Voltar a editar · ${area.name}` : `Enviar minha parte · ${area.name}`}</button>);
      }
      if (isAdm && dia.escala) actions.push(<button key="pub" type="button" className="esc-hit" disabled={saving || faltam.length > 0} title={faltam.length ? `Faltam: ${faltam.map((a) => a.name).join(", ")}` : undefined} onClick={() => onPublicar(false)}
        style={css(faltam.length ? "border-radius:999px;padding:9px 17px;font-size:12.5px;font-weight:700;font-family:Manrope,sans-serif;border:none;background:var(--asa-line);color:var(--asa-label);cursor:default" : btn("primary"))}>{faltam.length ? `Publicar · ${faltam.length === 1 ? "falta 1 parte" : `faltam ${faltam.length} partes`}` : busy === "publicar" ? "Publicando…" : `Publicar a escala de ${WEEKDAY_LONG[weekdayOf(dia.date)]!.split("-")[0]} e os Livros`}</button>);
    }
    if (tab === "escala" && isAdm && dia.escala?.alteradaDesde) actions.push(<button key="repub" type="button" className="esc-hit" disabled={saving} onClick={() => onPublicar(true)} style={css(btn("primary"))}>{busy === "publicar" ? "Republicando…" : "Republicar conjunto"}</button>);
  }
  const areas = !isMem && tab === "escala" && dia && !(dia.fechado && !dia.escala) ? dia.areas : [];
  const principais = new Set(["generate", "gerar-faltam", "todas", "pub", "repub", "confirmar", ...areasMinhas]);
  return <footer className="esc-pad ge-barra" style={css("display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:12px 20px;border-top:1px solid var(--asa-border-soft);")}>
    {areas.length > 0 && <div className="ge-areas" style={css("display:flex;flex-wrap:wrap;gap:6px;width:100%")}>
      {areas.map((a) => {
        const chip = "display:inline-flex;align-items:center;gap:6px;flex:none;font-size:12px;font-weight:700;white-space:nowrap;padding:3px 9px;border-radius:999px;background:" + (a.pronta ? "var(--asa-teal-pale)" : "var(--asa-amber-paper)") + ";color:" + (a.pronta ? "var(--asa-teal-dark)" : "var(--asa-badge-fg)");
        const label = `${a.name} · ${a.pronta ? `enviada${a.pronta.por ? ` (${a.pronta.por})` : ""}` : a.prontaTirada ? "voltou a ser editada" : "falta enviar"}`;
        // Administração pode marcar qualquer área (ex.: Produção, cuja supervisão não fica num local só).
        return isAdm && dia && (!dia.escala || dia.escala.status === "DRAFT")
          ? <button key={a.id} type="button" className="esc-hit" disabled={saving} aria-pressed={Boolean(a.pronta)} title={a.pronta ? "Voltar a editar" : "Marcar como enviada"} onClick={() => onPronta([a.id], !a.pronta)} style={css(chip + ";border:none;cursor:pointer;font-family:Manrope,sans-serif")}>{label}</button>
          : <span key={a.id} style={css(chip)}>{label}</span>;
      })}
    </div>}
    <span className="ge-barra-nota" style={css("font-size:12px;color:var(--asa-label)")}>{note}</span>
    <span className="ge-barra-folga" style={css("flex:1")}/>
    {/* Ações de apoio primeiro, à esquerda; a ação principal (gerar, marcar pronta, publicar) sempre por último, à direita. */}
    <div className="ge-barra-acoes" style={css("display:flex;flex-wrap:wrap;align-items:center;justify-content:flex-end;gap:8px;margin-left:auto")}>
      {apoio.length > 0 && <MenuMais itens={apoio}/>}
      {[...actions].sort((a, b) => Number(principais.has(String((a as { key?: string }).key))) - Number(principais.has(String((b as { key?: string }).key))))}</div>
  </footer>;
}

/* ---------- Minha escala (Elenco) ---------- */
function MinhaEscala({ minha, date, onHoje, onConfirm, saving }: { minha: Minha; date: string; onHoje: () => void; onConfirm: (escala: MinhaLocal) => Promise<void>; saving: boolean }) {
  if (!minha.publicada) return <div style={css("display:flex;flex-direction:column;gap:12px;max-width:640px;padding-bottom:18px")}>
    <div style={css("padding:16px;text-align:center;font-size:12.5px;color:var(--asa-label);background:#fff;border:1px dashed var(--asa-line-soft);border-radius:12px")}>{`A escala de ${relOf(date)} ainda não foi publicada. Quando sair, seus blocos aparecem aqui — e só os seus.`}</div>
    {date !== todayISO() && <button type="button" className="esc-hit" onClick={onHoje} style={css(btn("ghost") + "align-self:flex-start;")}>Ver a escala de hoje</button>}
  </div>;
  const escalas = minha.escalas?.length ? minha.escalas : minha.location && minha.escalaId && minha.escalaVersion ? [{ location: minha.location, publishedAt: minha.publishedAt, folga: minha.folga, confirmada: minha.confirmada, confirmedAt: minha.confirmedAt, escalaId: minha.escalaId, escalaVersion: minha.escalaVersion, blocos: minha.blocos ?? [] }] : [];
  return <div style={css("display:flex;flex-direction:column;gap:18px;max-width:640px;padding-bottom:18px")}>{escalas.map((escala) => <MinhaEscalaLocal key={escala.escalaId} minha={escala} date={date} onHoje={onHoje} onConfirm={() => onConfirm(escala)} saving={saving}/>)}</div>;
}

function MinhaEscalaLocal({ minha, date, onHoje, onConfirm, saving }: { minha: MinhaLocal; date: string; onHoje: () => void; onConfirm: () => Promise<void>; saving: boolean }) {
  // O resumo do dia conta atividades: a chamada é aviso de hora, não bloco (e o check-in abre na primeira atividade de verdade).
  const reais = minha.blocos.filter((b) => !b.chamada);
  const primeiro = reais[0];
  const ultimo = reais[reais.length - 1];
  return <div style={css("display:flex;flex-direction:column;gap:12px;max-width:640px;padding-bottom:18px")}>
    <div style={css("display:flex;align-items:center;gap:13px;background:linear-gradient(120deg,var(--asa-deep),var(--asa-hero-to));border-radius:16px;padding:15px 18px;color:#fff")}>
      <img src="/asa/lembrete.webp" alt="" style={css("width:58px;height:58px;object-fit:contain;flex:none")}/>
      <div style={css("display:flex;flex-direction:column;gap:4px")}>
        <span style={css("font-family:Outfit,sans-serif;font-size:17px;font-weight:600")}>{minha.folga ? `Você está de folga ${relOf(date)}` : `Sua escala de ${relOf(date)} saiu`}</span>
        <span style={css("font-size:13px;color:var(--asa-hero-text);line-height:1.45")}>{minha.folga ? "Folga é o dia inteiro — você não entra em nenhum bloco." : primeiro ? `${plural(reais.length, "bloco", "blocos")}, entrada ${primeiro.inicio} e saída ${ultimo.fim ?? ultimo.inicio}. O check-in abre no seu primeiro horário — ${primeiro.inicio} — e vale para o dia inteiro.` : "Nenhum bloco seu neste dia."}</span>
      </div>
    </div>
    <div style={css("display:flex;align-items:center;gap:11px;border:1px solid " + (minha.confirmada ? "var(--asa-prep-bd)" : "var(--asa-late-amber-bd)") + ";background:" + (minha.confirmada ? "var(--asa-swap-ok-bg)" : "var(--asa-late-bg)") + ";border-radius:13px;padding:12px 14px;")}>
      <img src={minha.confirmada ? "/asa/tarefa-concluida.webp" : "/asa/lembrete.webp"} alt="" style={css("width:34px;height:34px;object-fit:contain;flex:none")}/>
      <span style={css("display:flex;flex-direction:column;gap:2px;flex:1")}><strong style={css("font-size:12.5px;color:" + (minha.confirmada ? "var(--asa-teal-medium)" : "var(--asa-amber-dark)"))}>{minha.confirmada ? "Escala confirmada" : "Confira sua escala"}</strong><span style={css("font-size:12px;color:var(--asa-label);line-height:1.4")}>{minha.confirmada ? `Ciente${minha.confirmedAt ? ` às ${hhmm(minha.confirmedAt)}` : ""}.` : `Confirme que você viu os horários de ${relOf(date)}.`}</span></span>
      {!minha.confirmada && <button type="button" className="esc-hit" disabled={saving} onClick={() => void onConfirm()} style={css(btn("primary"))}>{saving ? "Confirmando…" : "Confirmar escala"}</button>}
    </div>
    {!minha.folga && <div style={css("display:flex;flex-wrap:wrap;gap:8px")}>
      <Link href="/check-in" className="esc-hit" style={css(btn("ghost") + "text-decoration:none;")}>Informar ausência</Link>
      <Link href="/solicitacoes" className="esc-hit" style={css(btn("ghost") + "text-decoration:none;")}>Pedir troca ou horário</Link>
    </div>}
    {minha.blocos.map((b) => {
      const tone = toneOf(b, minha.tipos);
      const livro = Boolean(b.dailyBookId) && b.dailyBookStatus !== "DRAFT";
      const row = <>
        <div style={css("display:flex;flex-direction:column;gap:2px;width:104px;flex:none")}>
          <span style={css("font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:700;color:var(--asa-ink-medium)")}>{b.inicio}</span>
          <span style={css("font-size:12px;color:var(--asa-label)")}>{b.flexivel ? "dentro da janela" : durLabel(b.inicio, b.fim)}</span>
        </div>
        {/* No telefone a coluna do meio não pode encolher até sobrar uma palavra por linha. */}
        <div style={css("display:flex;flex-direction:column;gap:3px;flex:1 1 150px;min-width:150px")}>
          <span style={css("font-size:14px;font-weight:600")}>{textoDoBloco(b)}</span>
          {b.encurtado && <span style={css("font-size:12px;color:var(--asa-label);text-wrap:pretty")}>{textoDoEncurtado(b)}</span>}
          <span style={css("font-size:12px;color:var(--asa-label);text-wrap:pretty")}>{`${minha.location?.name ?? ""}${b.regra === "livro" ? " · Livro do Dia" + (b.dailyBookStatus === "DRAFT" ? " em preparação" : " publicado") : ""}`}</span>
        </div>
        {/* No telefone estes dois ficam juntos na direita, sem espremer o nome do bloco. */}
        <span style={css("display:flex;align-items:center;gap:8px;flex:none;white-space:nowrap")}>
          {livro && <span style={css("flex:none;font-size:12px;font-weight:700;color:var(--asa-purple);white-space:nowrap")}>abrir Livro do Dia →</span>}
          {b.regra === "livro" && <span style={css("flex:none;font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:4px 8px;border-radius:6px;background:" + tone.bg + ";color:" + tone.fg + ";")}>show</span>}
        </span>
      </>;
      const rowStyle = "display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px;background:#fff;border:1px solid var(--asa-line);border-radius:13px;padding:13px 16px;text-decoration:none;color:inherit;" + (livro ? "cursor:pointer;" : "");
      return livro ? <Link key={b.key} href={`/livro-do-dia?data=${date}${b.dailyBookId ? `&livro=${b.dailyBookId}` : ""}`} style={css(rowStyle)}>{row}</Link> : <div key={b.key} style={css(rowStyle)}>{row}</div>;
    })}
  </div>;
}

/* ---------- aba Programação: o molde ---------- */

/** Nome, para a pessoa, de cada campo do bloco que ela mudou (aparece no rodapé). */
const ROTULO_DO_CAMPO: Record<string, string> = { flexivel: "se é janela flexível", tipoId: "o tipo", rotulo: "a atividade", inicio: "o início", fim: "o fim", regra: "quem entra", areaIds: "as áreas", pessoaIds: "as pessoas" };
const REGRA_LABEL: Record<Regra, string> = { todos: "Todo mundo do local", ninguem: "Sem participantes", area: "Por área", grupo: "Por grupo", pessoas: "Pessoas específicas", livro: "Show → Livro do Dia" };
function ProgramacaoTab({ review, localId, localName, date, dia, canEdit, onChanged }: { review: boolean; localId: string; localName: string; date: string; dia: Dia | null; canEdit: boolean; onChanged: () => void }) {
  const [list, setList] = useState<Programacao[]>([]);
  const [progId, setProgId] = useState("");
  const [wd, setWd] = useState(weekdayOf(date));
  const [sel, setSel] = useState("");
  const [shows, setShows] = useState<{ id: string; title: string }[]>([]);
  const [tipos, setTipos] = useState<TipoDoLocal[]>([]);
  const [podeEditarTipos, setPodeEditarTipos] = useState(false);
  const [dialog, setDialog] = useState<"molde" | "bloco" | "duplicar" | "vigencia" | "tipos" | "equipe" | null>(null);
  const [confirmar, setConfirmar] = useState<{ titulo: string; texto: string; acao: string; onSim: () => void } | null>(null);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  const [chamadasDoBloco, setChamadasDoBloco] = useState<ProgBloco | null>(null);
  const [rascunho, setRascunho] = useState<{ blocoId: string; campos: Partial<ProgBloco> } | null>(null);
  const [salvando, setSalvando] = useState(false), [erroBloco, setErroBloco] = useState("");
  const [salvoAntes, setSalvoAntes] = useState<{ bloco: ProgBloco; antes: Partial<ProgBloco> } | null>(null);
  const pessoas = dia?.pessoas ?? (review ? samplePessoas(localId) : []);
  const areas = dia?.areas ?? [];

  useEffect(() => {
    setError("");
    if (review) { const l = loadSampleProgramacoes(localId) as Programacao[]; setList(l); setShows(sampleShowsDoLocal(localId)); return; }
    customFetch<{ programacoes: Programacao[]; tipos?: TipoDoLocal[]; podeEditarTipos?: boolean }>(`/api/programacoes?locationId=${localId}`).then((r) => { setTipos(r.tipos ?? []); setPodeEditarTipos(Boolean(r.podeEditarTipos)); setList(r.programacoes.map((p) => ({ ...p, blocos: p.blocos.map((b) => ({ ...b, inicio: b.inicio.slice(0, 5), fim: b.fim ? b.fim.slice(0, 5) : null })) }))); }).catch(() => setError("Não consegui carregar a Programação."));
    customFetch<{ showBooks: { id: string; title: string; locationId?: string | null }[] }>("/api/show-books").then((r) => setShows(r.showBooks.filter((s) => s.locationId === localId))).catch(() => setShows([]));
  }, [review, localId, tick]);

  const hoje = todayISO();
  const estadoDe = (p: Programacao) => p.vigenciaInicio <= hoje && hoje <= p.vigenciaFim ? "vigente" : p.vigenciaInicio > hoje ? "agendado" : "encerrado";
  // Molde arquivado sai da lista de cima e fica guardado para reativar.
  const vivos = list.filter((p) => p.active !== false);
  const arquivados = list.filter((p) => p.active === false);
  const prog = vivos.find((p) => p.id === progId) ?? vivos.find((p) => estadoDe(p) === "vigente") ?? vivos[0];
  const blocosDia = (prog?.blocos ?? []).filter((b) => b.weekday === wd && b.active).sort((a, b) => a.inicio.localeCompare(b.inicio) || a.order - b.order);
  const bloco = blocosDia.find((b) => b.id === sel) ?? blocosDia[0];
  // Mesmo horário, uma linha só: o que acontece junto aparece lado a lado.
  const horariosDoDia = blocosDia.reduce<{ faixa: string; blocos: ProgBloco[] }[]>((acc, b) => { const g = acc.find((x) => x.faixa === faixa(b)); if (g) g.blocos.push(b); else acc.push({ faixa: faixa(b), blocos: [b] }); return acc; }, []);
  // Tirar do molde não apaga: o bloco fica guardado e pode voltar.
  const tiradosDoDia = (prog?.blocos ?? []).filter((b) => b.weekday === wd && !b.active).sort((a, b) => a.inicio.localeCompare(b.inicio));
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

  /** A frase do servidor da última falha ao salvar (por exemplo "outra pessoa alterou este bloco"), para o rodapé dizer o motivo de verdade. */
  const falhaDoServidor = useRef<string | null>(null);
  /** Devolve se salvou: quem chama decide o que mostrar (o rodapé do bloco só limpa o rascunho se deu certo). */
  const salvarBloco = async (b: ProgBloco, patch: Partial<ProgBloco>): Promise<boolean> => {
    setError(""); falhaDoServidor.current = null;
    try {
      if (review) {
        const next = list.map((p) => p.id !== b.programacaoId ? p : { ...p, blocos: p.blocos.map((x) => x.id === b.id ? { ...x, ...patch } : x) });
        saveSampleProgramacoes(localId, next as SampleProgramacao[]); setList(next);
      } else {
        await customFetch(`/api/programacoes/${b.programacaoId}/blocos/${b.id}`, { method: "PATCH", body: JSON.stringify({ ...patch, baseUpdatedAt: (b as { updatedAt?: string }).updatedAt }) });
        setTick((n) => n + 1);
      }
      onChanged();
      return true;
    } catch (err) {
      // Outra pessoa salvou antes: recarrega para a tela mostrar a versão nova (a frase do servidor explica o que houve).
      if (err instanceof ApiError && err.status === 409 && (err.data as { error?: unknown } | null)?.error === "VERSAO_MUDOU") setTick((n) => n + 1);
      const frase = err instanceof ApiError && err.data && typeof (err.data as { message?: unknown }).message === "string" ? (err.data as { message: string }).message : err instanceof ApiError && err.data && typeof (err.data as { error?: unknown }).error === "string" ? (err.data as { error: string }).error : "Não consegui salvar o bloco.";
      falhaDoServidor.current = frase;
      setError(frase);
      return false;
    }
  };

  // Rascunho do bloco aberto: nada vai para o molde enquanto a pessoa não confirmar no rodapé.
  const camposDoRascunho = rascunho && bloco && rascunho.blocoId === bloco.id ? rascunho.campos : {};
  const valorDe = <K extends keyof ProgBloco>(campo: K): ProgBloco[K] => (bloco && campo in camposDoRascunho ? (camposDoRascunho as ProgBloco)[campo] : (bloco as ProgBloco)[campo]);
  const mudancas: Partial<ProgBloco> = bloco ? Object.fromEntries(Object.entries(camposDoRascunho).filter(([campo, valor]) => JSON.stringify(valor) !== JSON.stringify((bloco as unknown as Record<string, unknown>)[campo]))) : {};
  const sujo = Object.keys(mudancas).length > 0;
  const mudarCampo = <K extends keyof ProgBloco>(campo: K, valor: ProgBloco[K]) => { if (!bloco) return; setErroBloco(""); setSalvoAntes(null); setRascunho((atual) => ({ blocoId: bloco.id, campos: { ...(atual && atual.blocoId === bloco.id ? atual.campos : {}), [campo]: valor } })); };
  const descartarRascunho = () => { setRascunho(null); setErroBloco(""); };
  // Trocar de bloco, de dia ou de molde com alteração sem salvar pergunta antes: nada se perde calado.
  const semPerder = (seguir: () => void) => {
    if (!sujo) { seguir(); return; }
    setConfirmar({ titulo: "Alterações sem salvar", texto: "Você mudou este bloco e ainda não salvou. Se continuar, as alterações se perdem.", acao: "Descartar e continuar", onSim: () => { descartarRascunho(); seguir(); } });
  };
  const salvarRascunho = async () => {
    if (!bloco || !sujo) return;
    const patch: Partial<ProgBloco> = { ...mudancas };
    if (typeof patch.rotulo === "string") patch.rotulo = patch.rotulo.toLocaleUpperCase("pt-BR").trim();
    if ("rotulo" in patch && !patch.rotulo) { setErroBloco("Dê um nome à atividade."); return; }
    if ("inicio" in patch && !patch.inicio) { setErroBloco("Escolha a hora de início."); return; }
    const inicio = String(patch.inicio ?? bloco.inicio), fim = "fim" in patch ? (patch.fim ?? null) : bloco.fim;
    if (fim && fim <= inicio) { setErroBloco("O fim precisa ser depois do início."); return; }
    if (("flexivel" in patch ? patch.flexivel : bloco.flexivel) && !fim) { setErroBloco("Uma janela flexível precisa de hora de início e de fim (por exemplo, almoço entre 11:00 e 13:00)."); return; }
    setErroBloco(""); setSalvando(true);
    const antes = Object.fromEntries(Object.keys(patch).map((campo) => [campo, (bloco as unknown as Record<string, unknown>)[campo]])) as Partial<ProgBloco>;
    const deuCerto = await salvarBloco(bloco, patch);
    setSalvando(false);
    if (deuCerto) { setRascunho(null); setSalvoAntes({ bloco, antes }); } else setErroBloco(falhaDoServidor.current ? `${falhaDoServidor.current} O que você mudou continua aqui.` : "Não consegui salvar. O que você mudou continua aqui; tente de novo.");
  };
  const desfazerUltimo = async () => {
    if (!salvoAntes) return;
    setSalvando(true);
    const deuCerto = await salvarBloco(salvoAntes.bloco, salvoAntes.antes);
    setSalvando(false);
    if (deuCerto) setSalvoAntes(null); else setErroBloco("Não consegui desfazer agora. A alteração continua salva.");
  };
  // O "Desfazer" some sozinho depois de um tempo; o histórico de alterações continua no Registro.
  useEffect(() => { if (!salvoAntes) return; const id = window.setTimeout(() => setSalvoAntes(null), 20_000); return () => window.clearTimeout(id); }, [salvoAntes]);
  const mudarMolde = async (nome: string, inicio: string, fim: string) => {
    if (!prog) return;
    if (review) {
      const next = list.map((p) => p.id === prog.id ? { ...p, nome, vigenciaInicio: inicio, vigenciaFim: fim } : p);
      saveSampleProgramacoes(localId, next as SampleProgramacao[]); setList(next); return;
    }
    await customFetch(`/api/programacoes/${prog.id}`, { method: "PATCH", body: JSON.stringify({ nome, vigenciaInicio: inicio, vigenciaFim: fim }) });
    setTick((n) => n + 1); onChanged();
  };
  const duplicarMolde = async (nome: string, inicio: string, fim: string) => {
    if (!prog) return;
    if (review) {
      const copia: Programacao = { ...prog, id: `sample-prog-${Date.now()}`, nome, vigenciaInicio: inicio, vigenciaFim: fim, blocos: prog.blocos.filter((b) => b.active).map((b, i) => ({ ...b, id: `${Date.now()}-${i}` })) };
      const next = [...list, copia]; saveSampleProgramacoes(localId, next as SampleProgramacao[]); setList(next); setProgId(copia.id); return;
    }
    const r = await customFetch<{ programacao: Programacao }>("/api/programacoes", { method: "POST", body: JSON.stringify({ locationId: localId, nome, vigenciaInicio: inicio, vigenciaFim: fim, copiarDeId: prog.id }) });
    setProgId(r.programacao.id); setTick((n) => n + 1); onChanged();
  };
  const arquivarMolde = async (p: Programacao, ativo: boolean) => {
    if (review) {
      const next = list.map((x) => x.id === p.id ? { ...x, active: ativo } : x);
      saveSampleProgramacoes(localId, next as SampleProgramacao[]); setList(next); if (!ativo) setProgId(""); return;
    }
    await customFetch(`/api/programacoes/${p.id}`, { method: "PATCH", body: JSON.stringify({ active: ativo }) });
    if (!ativo) setProgId("");
    setTick((n) => n + 1); onChanged();
  };
  const criarMolde = async (nome: string, inicio: string, fim: string) => {
    if (review) {
      const created: Programacao = { id: `sample-prog-${Date.now()}`, locationId: localId, nome, vigenciaInicio: inicio, vigenciaFim: fim, blocos: [] };
      const next = [...list, created]; saveSampleProgramacoes(localId, next as SampleProgramacao[]); setList(next); setProgId(created.id); return;
    }
    const r = await customFetch<{ programacao: Programacao }>("/api/programacoes", { method: "POST", body: JSON.stringify({ locationId: localId, nome, vigenciaInicio: inicio, vigenciaFim: fim }) });
    setProgId(r.programacao.id); setTick((n) => n + 1);
  };
  const criarBloco = async (valor: Omit<ProgBloco, "id" | "programacaoId" | "order" | "active" | "grupoIds"> & { weekdays?: number[]; chamadasNovas?: ChamadaRascunho[] }) => {
    if (!prog) return;
    const { chamadasNovas, ...value } = valor;
    const dias = value.weekdays?.length ? value.weekdays : [value.weekday];
    if (review) {
      const criados: ProgBloco[] = dias.map((weekday, i) => ({ ...value, weekday, id: `${prog.id}-new-${Date.now()}-${i}`, programacaoId: prog.id, order: prog.blocos.length + i, active: true, grupoIds: [] }));
      const next = list.map((p) => p.id === prog.id ? { ...p, blocos: [...p.blocos, ...criados] } : p); saveSampleProgramacoes(localId, next as SampleProgramacao[]); setList(next); setSel(criados[0]!.id); onChanged(); return;
    }
    const r = await customFetch<{ bloco: ProgBloco; blocos?: ProgBloco[] }>(`/api/programacoes/${prog.id}/blocos`, { method: "POST", body: JSON.stringify({ ...value, weekdays: dias }) });
    setSel(r.bloco.id); setTick((n) => n + 1); onChanged();
    // As chamadas vão para cada bloco criado (um por dia da semana). Se alguma recusar, o bloco já existe: avisa e a pessoa acrescenta pelo painel do bloco.
    if (chamadasNovas?.length) {
      try { for (const b of r.blocos ?? [r.bloco]) await gravarChamadas({ programacaoBlocoId: b.id }, chamadasNovas.map((c) => ({ ...c, id: undefined })), []); setTick((n) => n + 1); }
      catch (err) { setError(`O bloco foi criado, mas as chamadas não: ${err instanceof ApiError && err.data && typeof (err.data as { message?: unknown }).message === "string" ? (err.data as { message: string }).message : "tente de novo"}. Abra o bloco e configure as chamadas por lá.`); }
    }
  };

  const estado = prog ? estadoDe(prog) : "encerrado";
  const isShow = bloco?.regra === "livro";
  const quem = bloco ? resolved(bloco) : [];
  return <div style={css("display:flex;flex-direction:column;gap:14px;padding-bottom:18px")}>
    {error && <div role="alert" style={css("padding:11px 13px;border-radius:12px;font-size:12px;line-height:1.5;background:var(--asa-ausente-bg);border:1px solid var(--asa-red-wash);color:var(--asa-error-fg)")}>{error}</div>}
    <div style={css("display:flex;flex-wrap:wrap;align-items:center;gap:8px")}>
      <span style={css("font-size:12px;font-weight:700;color:var(--asa-label);margin-right:2px")}>Molde</span>
      {vivos.map((p) => <button key={p.id} type="button" className="esc-hit" aria-pressed={p.id === prog?.id} onClick={() => { if (p.id !== prog?.id) semPerder(() => setProgId(p.id)); }}
        style={css("border-radius:999px;padding:6px 13px;font-size:12px;cursor:pointer;font-family:Manrope,sans-serif;white-space:nowrap;" + (p.id === prog?.id ? "border:1px solid var(--asa-purple);background:var(--asa-show-bg);color:var(--asa-purple);font-weight:700;" : estadoDe(p) === "encerrado" ? "border:1px solid var(--asa-purple-soft);background:#fff;color:var(--asa-label);font-weight:600;" : "border:1px solid var(--asa-line);background:#fff;color:var(--asa-label);font-weight:600;"))}>
        {`${p.nome} · ${shortDate(p.vigenciaInicio)}–${shortDate(p.vigenciaFim)}${estadoDe(p) === "vigente" ? " ✓" : ""}`}
        {p.id.startsWith("sample-prog-") && <span style={css("margin-left:7px;font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:2px 6px;border-radius:5px;background:var(--asa-amber-surface);color:var(--asa-amber-mid)")}>dado de exemplo</span>}
      </button>)}
      {arquivados.length > 0 && <details style={css("position:relative")}>
        <summary style={css("cursor:pointer;list-style:none;font-size:12px;font-weight:700;color:var(--asa-label);padding:6px 10px;border:1px dashed var(--asa-line-soft);border-radius:999px")}>{`${arquivados.length} ${arquivados.length === 1 ? "arquivado" : "arquivados"}`}</summary>
        <div style={css("position:absolute;left:0;top:36px;z-index:20;width:300px;background:#fff;border:1px solid var(--asa-line-soft);border-radius:12px;padding:8px;box-shadow:0 22px 40px -20px rgba(40,20,90,.45);display:flex;flex-direction:column;gap:6px")}>
          {arquivados.map((p) => <div key={p.id} style={css("display:flex;align-items:center;gap:9px;font-size:12px;color:var(--asa-ink-muted)")}>
            <span style={css("flex:1;min-width:0")}>{`${p.nome} · ${shortDate(p.vigenciaInicio)}–${shortDate(p.vigenciaFim)}`}</span>
            {canEdit && <button type="button" className="esc-cell-adjust esc-hit" onClick={() => void arquivarMolde(p, true)}>Reativar</button>}
          </div>)}
        </div>
      </details>}
      {canEdit && <button type="button" className="esc-hit" onClick={() => setDialog("molde")} style={css("border:1px dashed var(--asa-lavender-chalk);background:none;color:var(--asa-label);border-radius:999px;padding:6px 13px;font-size:12px;font-weight:600;cursor:pointer;font-family:Manrope,sans-serif;")}>+ molde</button>}
    </div>

    {!prog ? <div style={css("padding:16px;text-align:center;font-size:12.5px;color:var(--asa-label);background:#fff;border:1px dashed var(--asa-line-soft);border-radius:12px")}>{`${localName} ainda não tem Programação. ${canEdit ? "Crie o primeiro molde — ele diz, por dia da semana, os horários e quem entra em cada bloco." : ""}`}</div> : <>
      <div style={css("display:flex;flex-wrap:wrap;align-items:center;gap:14px;background:#fff;border:1px solid var(--asa-line);border-radius:12px;padding:12px 15px")}>
        <div style={css("display:flex;flex-direction:column;gap:2px")}>
          <span style={css("font-family:'JetBrains Mono',monospace;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--asa-label)")}>Vigência</span>
          <span style={css("font-size:13px;font-weight:600")}>{rangeLabel(prog.vigenciaInicio, prog.vigenciaFim)}</span>
        </div>
        <div style={css("display:flex;flex-direction:column;gap:2px")}>
          <span style={css("font-family:'JetBrains Mono',monospace;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--asa-label)")}>Local</span>
          <span style={css("font-size:13px;font-weight:600")}>{localName}</span>
        </div>
        <span style={css("flex:none;font-size:12px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;white-space:nowrap;padding:3px 9px;border-radius:999px;background:" + (estado === "vigente" ? "var(--asa-teal-pale)" : estado === "agendado" ? "var(--asa-purple-blossom)" : "var(--asa-refeicao-bg)") + ";color:" + (estado === "vigente" ? "var(--asa-teal-dark)" : estado === "agendado" ? "var(--asa-purple)" : "var(--asa-label)"))}>{estado}</span>
        <span style={css("flex:1;min-width:20px")}/>
        <button type="button" className="esc-cell-adjust esc-hit" style={{ minHeight: 44 }} onClick={() => setDialog("equipe")}>Equipe do local</button>
        {canEdit && <div style={css("display:flex;flex-wrap:wrap;gap:7px")}>
          {podeEditarTipos && !review && <button type="button" className="esc-cell-adjust esc-hit" style={{ minHeight: 44 }} onClick={() => setDialog("tipos")}>Tipos de atividade</button>}
          <button type="button" className="esc-cell-adjust esc-hit" onClick={() => setDialog("vigencia")}>Mudar nome ou vigência</button>
          <button type="button" className="esc-cell-adjust esc-hit" onClick={() => setDialog("duplicar")}>Duplicar molde</button>
          <button type="button" className="esc-cell-adjust esc-hit" onClick={() => setConfirmar({ titulo: "Arquivar molde", texto: `"${prog.nome}" para de valer para os próximos dias e sai da lista de cima. Fica guardado em "arquivados" e dá para reativar quando quiser.`, acao: "Arquivar", onSim: () => void arquivarMolde(prog, false) })}>Arquivar molde</button>
        </div>}
        <span style={css("font-size:12px;color:var(--asa-label);max-width:38ch;line-height:1.4;text-wrap:pretty")}>{estado === "agendado" ? "Este molde ainda não entrou em vigor: dá para montá-lo agora sem afetar a escala que está rodando." : estado === "encerrado" ? "Vigência já passou. Fica de histórico e pode ser duplicado para a próxima temporada." : "Molde em vigor: é ele que a Escala usa para abrir as necessidades deste local."}</span>
      </div>

      <div style={css("display:flex;align-items:center;gap:6px;flex-wrap:wrap")}>
        {WEEKDAYS.map(([w, label]) => <button key={w} type="button" className="esc-hit" aria-pressed={wd === w} onClick={() => { if (w !== wd) semPerder(() => { setWd(w); setSel(""); }); }}
          style={css("border-radius:9px;padding:7px 15px;font-size:12px;cursor:pointer;font-family:Manrope,sans-serif;" + (wd === w ? "border:1px solid var(--asa-ink-dark);background:var(--asa-ink-dark);color:#fff;font-weight:700;" : "border:1px solid var(--asa-line);background:#fff;color:var(--asa-label);font-weight:600;"))}>{label}</button>)}
        <span style={css("flex:1;min-width:8px")}/>
        {canEdit && <button type="button" className="esc-hit" onClick={() => setDialog("bloco")} style={css(btn("primary") + "min-height:44px;white-space:nowrap")}>+ Bloco</button>}
      </div>

      <div role="list" aria-label={`Blocos de ${WEEKDAY_LONG[wd]}`} style={css("display:flex;flex-direction:column;border:1px solid var(--asa-line-soft);border-radius:12px;background:#fff;max-width:900px;overflow:hidden")}>
        {horariosDoDia.map((g, i) => <div key={g.faixa} role="listitem" style={css("display:flex;flex-wrap:wrap;align-items:flex-start;gap:8px 14px;padding:10px 12px;" + (i ? "border-top:1px solid var(--asa-purple-airy);" : ""))}>
          <span style={css("flex:none;width:96px;padding-top:12px;font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;color:var(--asa-ink-medium)")}>{g.faixa}</span>
          <div style={css("flex:1 1 220px;min-width:0;display:flex;flex-wrap:wrap;gap:8px")}>
            {g.blocos.map((b) => {
              const t = toneOf(b, tipos), selected = b.id === bloco?.id;
              const n = resolved(b).length;
              const quemTexto = b.flexivel ? `janela flexível · ${plural(n, "pessoa", "pessoas")}` : b.regra === "livro" ? "o elenco do Livro do Dia" : b.regra === "ninguem" ? "nenhuma pessoa entra" : n ? `${resumo(b)} · ${plural(n, "pessoa", "pessoas")}` : "fica vazio e sinalizado na escala";
              return <button key={b.id} type="button" className="esc-hit" aria-pressed={selected} onClick={() => { if (b.id !== bloco?.id) semPerder(() => { setSel(b.id); window.setTimeout(() => document.getElementById("esc-bloco-painel")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80); }); }}
                style={css("flex:1 1 190px;max-width:340px;min-height:44px;display:flex;flex-direction:column;align-items:flex-start;gap:2px;text-align:left;border-radius:10px;padding:8px 11px;cursor:pointer;font-family:Manrope,sans-serif;background:" + t.bg + ";color:" + t.fg + ";border:" + (selected ? "2px solid var(--asa-ink-dark)" : "1px solid " + t.bd) + ";")}>
                <span style={css("font-size:12.5px;font-weight:700;line-height:1.25;overflow-wrap:anywhere")}>{textoDoBloco(b)}</span>
                <span style={css("font-size:12px;font-weight:600;line-height:1.3;opacity:.9;overflow-wrap:anywhere")}>{quemTexto}</span>
              </button>;
            })}
          </div>
        </div>)}
        {!blocosDia.length && <div style={css("padding:16px;text-align:center;font-size:12.5px;color:var(--asa-label)")}>{`Nenhum bloco em ${WEEKDAY_LONG[wd]}.${canEdit ? " Use + Bloco para criar o primeiro." : ""}`}</div>}
      </div>
      {tiradosDoDia.length > 0 && <details style={css("background:#fff;border:1px dashed var(--asa-line-soft);border-radius:12px;padding:9px 13px;max-width:900px")}>
        <summary style={css("cursor:pointer;list-style:none;font-size:12px;font-weight:700;color:var(--asa-label)")}>{`${plural(tiradosDoDia.length, "bloco tirado do molde", "blocos tirados do molde")} em ${WEEKDAY_LONG[wd]}s · ver`}</summary>
        <ul style={css("margin:9px 0 2px;padding:0;list-style:none;display:flex;flex-direction:column;gap:6px")}>
          {tiradosDoDia.map((b) => <li key={b.id} style={css("display:flex;align-items:center;gap:10px;font-size:12px;color:var(--asa-ink-muted)")}>
            <span style={css("font-family:\x27JetBrains Mono\x27,monospace;font-weight:700;width:96px;flex:none")}>{faixa(b)}</span>
            <span style={css("flex:1;min-width:0")}>{textoDoBloco(b)}</span>
            {canEdit && <button type="button" className="esc-cell-adjust esc-hit" onClick={() => void salvarBloco(b, { active: true })}>Devolver ao molde</button>}
          </li>)}
        </ul>
      </details>}

      {bloco && <div id="esc-bloco-painel" style={css("display:flex;flex-direction:column;gap:13px;background:#fff;border:1px solid var(--asa-line-soft);border-radius:14px;padding:15px 17px;max-width:900px;scroll-margin-top:12px")}>
        <div style={css("display:flex;flex-wrap:wrap;align-items:center;gap:10px")}>
          <span style={css("font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:700;color:var(--asa-ink-medium)")}>{faixa(bloco)}</span>
          <span style={css("font-family:Outfit,sans-serif;font-size:16px;font-weight:600")}>{textoDoBloco(bloco)}</span>
          <span style={css("flex:none;font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:4px 9px;border-radius:999px;" + (isShow ? "background:var(--asa-teal-glow);color:var(--asa-teal-medium);" : "background:var(--asa-chip-on);color:var(--asa-purple);"))}>{isShow ? "show · livro manda" : "atividade · você monta"}</span>
          <span style={css("flex:1;min-width:16px")}/>
          <span style={css("font-size:12px;color:var(--asa-label);max-width:42ch;line-height:1.45;text-wrap:pretty")}>{isShow ? "Quem entra vem do livro deste show, no dia. Aqui não se edita: mude o livro e a escala acompanha." : "A escala guarda a regra, não a lista. Quem entra na área depois passa a aparecer sozinho."}</span>
        </div>
        {canEdit && <div style={css("display:flex;flex-wrap:wrap;align-items:flex-end;gap:10px;border-top:1px solid var(--asa-book-fade);padding-top:12px")}>
          <label style={css("display:flex;flex-direction:column;gap:3px;font-size:12px;font-weight:700;color:var(--asa-label)")}>Atividade
            <input value={valorDe("rotulo")} onChange={(e) => mudarCampo("rotulo", e.target.value)} maxLength={80}
              style={css("border:1px solid var(--asa-line-soft);border-radius:9px;padding:6px 9px;min-height:44px;box-sizing:border-box;font:600 12.5px Manrope,sans-serif;color:var(--asa-ink-dark);min-width:190px")}/>
          </label>
          <label style={css("display:flex;flex-direction:column;gap:3px;font-size:12px;font-weight:700;color:var(--asa-label)")}>Início
            <input type="time" value={valorDe("inicio")} onChange={(e) => mudarCampo("inicio", e.target.value)}
              style={css("border:1px solid var(--asa-line-soft);border-radius:9px;padding:6px 9px;min-height:44px;box-sizing:border-box;font:600 12.5px Manrope,sans-serif;color:var(--asa-ink-dark)")}/>
          </label>
          <label style={css("display:flex;flex-direction:column;gap:3px;font-size:12px;font-weight:700;color:var(--asa-label)")}>Fim (opcional)
            <input type="time" value={valorDe("fim") ?? ""} onChange={(e) => mudarCampo("fim", e.target.value || null)}
              style={css("border:1px solid var(--asa-line-soft);border-radius:9px;padding:6px 9px;min-height:44px;box-sizing:border-box;font:600 12.5px Manrope,sans-serif;color:var(--asa-ink-dark)")}/>
          </label>
          <label style={css("display:flex;flex-direction:column;gap:3px;font-size:12px;font-weight:700;color:var(--asa-label)")}>Tipo
            <TipoSelect tipos={tipos} value={valorDe("tipoId")} onChange={(id) => mudarCampo("tipoId", id)} style={css("border:1px solid var(--asa-line-soft);border-radius:9px;padding:6px 9px;min-height:44px;box-sizing:border-box;font:600 12.5px Manrope,sans-serif;color:var(--asa-ink-dark);min-width:190px;background:#fff")}/>
          </label>
          <label style={css("display:flex;align-items:center;gap:8px;min-height:44px;font-size:12.5px;font-weight:700;color:var(--asa-ink-dark);flex-basis:100%")}>
            <input type="checkbox" checked={Boolean(valorDe("flexivel"))} disabled={isShow} onChange={(e) => mudarCampo("flexivel", e.target.checked)} style={css("width:20px;height:20px")}/>
            <span>Janela flexível<span style={css("display:block;font-size:12px;font-weight:500;color:var(--asa-label)")}>{isShow ? "Bloco de show do Livro tem hora marcada." : "Para o almoço: cada pessoa cumpre dentro do horário de início e fim, sem hora fixa. Aparece numa linha só, sem nomes, e não gera choque."}</span></span>
          </label>
          <span style={css("font-size:12px;color:var(--asa-label);flex:1;min-width:140px")}>Só vale depois de “Salvar alterações”, e muda apenas os dias que ainda não foram publicados.</span>
        </div>}
        {!isShow && <div style={css("display:flex;flex-direction:column;gap:11px;border-top:1px solid var(--asa-book-fade);padding-top:12px")}>
          <div style={css("display:flex;flex-wrap:wrap;align-items:center;gap:7px")}>
            {(["ninguem", "todos", "area", "pessoas"] as Regra[]).map((r) => <button key={r} type="button" className="esc-hit" disabled={!canEdit} aria-pressed={valorDe("regra") === r} onClick={() => mudarCampo("regra", r as ProgBloco["regra"])}
              style={css("border-radius:9px;padding:6px 12px;font-size:12px;font-family:Manrope,sans-serif;" + (canEdit ? "cursor:pointer;" : "cursor:default;") + (valorDe("regra") === r ?"border:1px solid var(--asa-ink-dark);background:var(--asa-ink-dark);color:#fff;font-weight:700;" : "border:1px solid var(--asa-line);background:#fff;color:var(--asa-label);font-weight:600;"))}>{REGRA_LABEL[r]}</button>)}
          </div>
          {valorDe("regra") === "area" && <div style={css("display:flex;flex-wrap:wrap;align-items:center;gap:7px")}>
            <span style={css("font-size:12px;font-weight:700;color:var(--asa-label);width:132px;flex:none")}>Áreas</span>
            {areas.map((a) => { const marcadas = valorDe("areaIds"); const on = marcadas.includes(a.id); return <button key={a.id} type="button" className="esc-hit" disabled={!canEdit} aria-pressed={on} onClick={() => mudarCampo("areaIds", on ? marcadas.filter((x) => x !== a.id) : [...marcadas, a.id])} style={css(on ? chipOn : chipOff)}>{a.name}</button>; })}
          </div>}
          {valorDe("regra") === "pessoas" && <div style={css("display:flex;flex-wrap:wrap;align-items:center;gap:7px")}>
            <span style={css("font-size:12px;font-weight:700;color:var(--asa-label);width:132px;flex:none")}>Pessoas específicas</span>
            {pessoas.map((p) => { const marcadas = valorDe("pessoaIds"); const on = marcadas.includes(p.id); return <button key={p.id} type="button" className="esc-hit" disabled={!canEdit} aria-pressed={on} onClick={() => mudarCampo("pessoaIds", on ? marcadas.filter((x) => x !== p.id) : [...marcadas, p.id])} style={css(on ? chipOn : chipOff)}>{p.name}</button>; })}
          </div>}
        </div>}
        <div style={css("display:flex;flex-direction:column;gap:8px;border-top:1px solid var(--asa-book-fade);padding-top:12px")}>
          <div style={css("display:flex;flex-wrap:wrap;align-items:baseline;gap:9px")}>
            <span style={css("font-size:12.5px;font-weight:700;color:var(--asa-ink-dark)")}>{`Quem entra ${dia && weekdayOf(dia.date) === bloco.weekday ? `em ${WEEKDAY_LONG[bloco.weekday]}, ${shortDate(dia.date)}` : `às ${WEEKDAY_LONG[bloco.weekday]}s`}`}</span>
            <span style={css("font-size:12px;color:var(--asa-label)")}>{`${plural(quem.length, "pessoa entra", "pessoas entram")} · folga e recesso não entram`}</span>
          </div>
          <div style={css("display:grid;grid-template-columns:repeat(auto-fill,minmax(268px,1fr));gap:7px")}>
            {quem.map((id) => <div key={id} style={css("display:flex;align-items:center;gap:10px;padding:7px 10px;border-radius:10px;border:1px solid var(--asa-line);background:#fff;")}>
              <span style={css("width:7px;height:7px;border-radius:50%;flex:none;background:var(--asa-ok-fg);")}/>
              <span style={css("font-size:13.5px;font-weight:600;flex:1;min-width:0;color:var(--asa-ink-dark);")}>{personName(id)}</span>
              <span style={css("font-size:12px;color:var(--asa-label);flex:none;")}>{isShow ? "no livro deste dia" : bloco.regra === "todos" ? "via todo mundo" : bloco.regra === "area" ? `via área ${pessoas.find((p) => p.id === id)?.areaName ?? ""}` : "pessoa específica"}</span>
            </div>)}
          </div>
          {!quem.length && <span style={css("font-size:12px;color:var(--asa-label);font-style:italic")}>{isShow ? "O Livro do Dia deste show ainda não tem ninguém para este dia." : "Nenhuma pessoa nesta regra — o bloco existe na programação, mas ninguém é convocado. Na escala ele aparece vazio e sinalizado."}</span>}
        </div>
        {!review && !bloco.id.includes("-new-") && <div style={css("display:flex;flex-wrap:wrap;align-items:center;gap:9px;border-top:1px solid var(--asa-book-fade);padding-top:12px")}>
          <span style={css("font-size:12.5px;font-weight:700;color:var(--asa-ink-dark)")}>Chamadas</span>
          <span style={css("font-size:12px;color:var(--asa-label);flex:1;min-width:140px;overflow-wrap:anywhere")}>{isShow && bloco.semSessao ? `Este show não tem sessão às ${bloco.inicio.slice(0, 5)}. As chamadas ficam na sessão: cadastre a sessão na tela do show.` : bloco.chamadas?.length ? `${bloco.chamadas.map((c) => resumoDaChamada(c, bloco.inicio)).join(" · ")}${isShow ? " · da sessão do show" : ""}` : isShow ? "Nenhuma chamada na sessão deste show." : "Nenhuma chamada neste bloco."}</span>
          {!(isShow && bloco.semSessao) && <button type="button" className="esc-hit esc-rodape-sec" style={css("min-height:44px;padding:0 14px;border-radius:10px;cursor:pointer;font:700 13px Manrope,sans-serif;border:1px solid var(--asa-purple-border,#d8cef6);background:#fff;color:var(--asa-purple)")} onClick={() => setChamadasDoBloco(bloco)}>{canEdit ? "Configurar chamadas" : "Ver chamadas"}</button>}
        </div>}
        {canEdit && <div style={css("display:flex;justify-content:flex-end")}>
          <button type="button" className="esc-hit" onClick={() => setConfirmar({ titulo: "Tirar do molde", texto: `"${textoDoBloco(bloco)}" sai de ${WEEKDAY_LONG[bloco.weekday]} e dos dias que ainda não foram publicados. Ele fica guardado e você pode devolver depois.`, acao: "Tirar do molde", onSim: () => void salvarBloco(bloco, { active: false }) })} style={css("border:1px solid var(--asa-line);background:#fff;color:var(--asa-label);border-radius:999px;padding:4px 10px;font-size:12px;font-weight:700;cursor:pointer;font-family:Manrope,sans-serif;flex:none;")}>tirar do molde</button>
        </div>}
        {/* Rodapé do bloco: sempre à vista enquanto se edita. Nada vale no molde até "Salvar alterações". */}
        {canEdit && <div className="esc-rodape" role="group" aria-label="Salvar as alterações do bloco">
          <span className="esc-rodape-texto" role="status">{erroBloco ? <b className="esc-rodape-erro">{erroBloco}</b> : sujo ? `Você mudou: ${Object.keys(mudancas).map((campo) => ROTULO_DO_CAMPO[campo] ?? campo).join(", ")}. Nada vale até salvar.` : salvoAntes ? "Bloco salvo. Vale para os dias que ainda não foram publicados." : "Nenhuma alteração ainda."}</span>
          {salvoAntes && !sujo && <button type="button" className="esc-hit esc-rodape-sec" disabled={salvando} onClick={() => void desfazerUltimo()}>Desfazer</button>}
          <button type="button" className="esc-hit esc-rodape-sec" disabled={!sujo || salvando} onClick={descartarRascunho}>Descartar</button>
          <button type="button" className="esc-hit esc-rodape-pri" disabled={!sujo || salvando} onClick={() => void salvarRascunho()}>{salvando ? "Salvando…" : "Salvar alterações"}</button>
        </div>}
      </div>}
    </>}

    {dialog === "molde" && <FormDialog title="Novo molde" onClose={() => setDialog(null)} onSubmit={async (f) => { await criarMolde(f.nome, f.inicio, f.fim); setDialog(null); }}
      fields={[{ name: "nome", label: "Nome (Natal, Normal, Baixa…)", type: "text" }, { name: "inicio", label: "Vigência — início", type: "date" }, { name: "fim", label: "Vigência — fim", type: "date" }]}/>}
    {confirmar && <ConfirmDialog {...confirmar} onClose={() => setConfirmar(null)}/>}
    {chamadasDoBloco && <ChamadasDialog dona={{ programacaoBlocoId: chamadasDoBloco.id }} titulo={`Chamadas · ${textoDoBloco(chamadasDoBloco)}`} inicioDaAtividade={chamadasDoBloco.inicio.slice(0, 5)} onClose={() => setChamadasDoBloco(null)} onSalvou={() => { setTick((n) => n + 1); onChanged(); }}/>}
    {dialog === "duplicar" && prog && <FormDialog title="Duplicar molde" onClose={() => setDialog(null)} onSubmit={async (f) => { await duplicarMolde(f.nome, f.inicio, f.fim); setDialog(null); }}
      inicial={{ nome: `${prog.nome} (cópia)`, inicio: prog.vigenciaFim, fim: prog.vigenciaFim }} nota={`Copia os ${prog.blocos.filter((b) => b.active).length} blocos deste molde para a nova vigência. O molde atual não muda.`}/>}
    {dialog === "vigencia" && prog && <FormDialog title="Nome e vigência do molde" onClose={() => setDialog(null)} onSubmit={async (f) => { await mudarMolde(f.nome, f.inicio, f.fim); setDialog(null); }}
      inicial={{ nome: prog.nome, inicio: prog.vigenciaInicio, fim: prog.vigenciaFim }} nota="Vale para os dias que ainda não foram publicados."/>}
    {dialog === "equipe" && prog && <EquipeDialog programacaoId={prog.id} programacaoNome={prog.nome} vigencia={rangeLabel(prog.vigenciaInicio, prog.vigenciaFim)} localName={localName} review={review}
      pessoasDaAmostra={review ? samplePessoas(localId).map((p) => ({ id: p.id, nome: p.name, areaId: p.areaId ?? null, areaNome: p.areaName ?? null })) : undefined} editavelNaAmostra={canEdit} onClose={() => setDialog(null)} onSaved={() => { setTick((n) => n + 1); onChanged(); }}/>}
    {dialog === "tipos" && podeEditarTipos && <TiposDialog locationId={localId} locationName={localName} onClose={() => setDialog(null)} onChanged={() => { setTick((n) => n + 1); onChanged(); }}/>}
    {dialog === "bloco" && <BlocoDialog tipos={tipos} weekday={wd} vocabulario={vocabularioDoLocal(review ? localId : localName.toLocaleLowerCase("pt-BR"))} areas={areas} shows={shows} onClose={() => setDialog(null)} onSubmit={async (v) => { await criarBloco(v); setDialog(null); }} pessoas={pessoas}/>}
  </div>;
}

const CAMPOS_MOLDE = [{ name: "nome", label: "Nome (Natal, Normal, Baixa…)", type: "text" }, { name: "inicio", label: "Vigência — início", type: "date" }, { name: "fim", label: "Vigência — fim", type: "date" }];
function FormDialog({ title, fields = CAMPOS_MOLDE, inicial, nota, onClose, onSubmit }: { title: string; fields?: { name: string; label: string; type: string }[]; inicial?: Record<string, string>; nota?: string; onClose: () => void; onSubmit: (values: Record<string, string>) => Promise<void> }) {
  useFecharComEsc(onClose);
  const [values, setValues] = useState<Record<string, string>>(inicial ?? {});
  const [error, setError] = useState("");
  const [salvando, setSalvando] = useState(false);
  const submit = async (event: FormEvent) => { event.preventDefault(); if (salvando) return; setSalvando(true); setError(""); try { await onSubmit(values); } catch (err) { setError(err instanceof ApiError && err.data && typeof (err.data as { error?: unknown }).error === "string" ? (err.data as { error: string }).error : "Não consegui salvar."); } finally { setSalvando(false); } };
  return <div className="shows-dialog-backdrop"><div className="shows-dialog" role="dialog" aria-modal="true" aria-label={title}>
    <header className="shows-dialog-header"><h2>{title}</h2><button type="button" onClick={onClose} aria-label="Fechar"><X size={18}/></button></header>
    <div className="shows-dialog-content"><form id="esc-form" onSubmit={submit} className="shows-form">
      {nota && <p style={css("margin:0 0 2px;font-size:12px;line-height:1.5;color:var(--asa-ink-muted)")}>{nota}</p>}
      {fields.map((f) => <label key={f.name}>{f.label}<input required type={f.type} value={values[f.name] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}/></label>)}
      {error && <p role="alert" style={css("font-size:12px;color:var(--asa-error-fg)")}>{error}</p>}
    </form></div>
    <footer className="shows-dialog-footer">
      <button type="button" onClick={onClose} className="shows-secondary">Cancelar</button>
      <button form="esc-form" className="shows-primary" disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</button>
    </footer>
  </div></div>;
}

function BlocoDialog({ tipos, weekday, vocabulario, areas, shows, pessoas, onClose, onSubmit }: { tipos: TipoDoLocal[]; weekday: number; vocabulario: string[]; areas: Area[]; shows: { id: string; title: string }[]; pessoas: Pessoa[]; onClose: () => void; onSubmit: (v: Omit<ProgBloco, "id" | "programacaoId" | "order" | "active" | "grupoIds"> & { weekdays?: number[]; chamadasNovas?: ChamadaRascunho[] }) => Promise<void> }) {
  useFecharComEsc(onClose);
  const [chamadasNovas, setChamadasNovas] = useState<ChamadaRascunho[]>([]);
  const [rotulo, setRotulo] = useState("");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [regra, setRegra] = useState<Regra>("pessoas");
  const [showBookId, setShowBookId] = useState("");
  const [tipoId, setTipoId] = useState<string | null>(null);
  const [flexivel, setFlexivel] = useState(false);
  const [areaIds, setAreaIds] = useState<string[]>([]);
  const [pessoaIds, setPessoaIds] = useState<string[]>([]);
  // A mesma atividade costuma repetir em vários dias; começa no dia aberto e você marca os outros.
  const [dias, setDias] = useState<number[]>([weekday]);
  const [error, setError] = useState("");
  const [salvando, setSalvando] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (salvando) return;
    if (!dias.length) { setError("Escolha pelo menos um dia da semana."); return; }
    if (flexivel && !fim) { setError("Uma janela flexível precisa de hora de fim (por exemplo, almoço entre 11:00 e 13:00)."); return; }
    const erroDeChamada = primeiroErro(chamadasNovas, inicio || null);
    if (erroDeChamada) { setError(`Chamadas: ${erroDeChamada}`); return; }
    setSalvando(true); setError("");
    try { await onSubmit({ chamadasNovas: regra === "livro" ? [] : chamadasNovas, weekday: dias[0]!, weekdays: dias, rotulo: rotulo.trim(), inicio, fim: fim || null, regra: regra as ProgBloco["regra"], showBookId: regra === "livro" ? showBookId || null : null, tipoId, flexivel: flexivel && regra !== "livro", areaIds: regra === "area" ? areaIds : [], pessoaIds: regra === "pessoas" ? pessoaIds : [] }); }
    catch (err) { setError(err instanceof ApiError && err.data && typeof (err.data as { message?: unknown }).message === "string" ? (err.data as { message: string }).message : err instanceof ApiError && err.data && typeof (err.data as { error?: unknown }).error === "string" ? (err.data as { error: string }).error : "Não consegui criar o bloco."); }
    finally { setSalvando(false); }
  };
  return <div className="shows-dialog-backdrop"><div className="shows-dialog" role="dialog" aria-modal="true" aria-label="Novo bloco">
    <header className="shows-dialog-header"><h2>Novo bloco</h2><button type="button" onClick={onClose} aria-label="Fechar"><X size={18}/></button></header>
    <div className="shows-dialog-content"><form id="esc-bloco" onSubmit={submit} className="shows-form">
      <fieldset style={css("border:none;padding:0;margin:0;display:flex;flex-direction:column;gap:5px")}>
        <legend style={css("padding:0;font-size:12px;font-weight:700;color:var(--asa-label)")}>Em quais dias</legend>
        <div style={css("display:flex;flex-wrap:wrap;gap:6px")}>
          {[1, 2, 3, 4, 5, 6, 0].map((d) => { const on = dias.includes(d); return <button key={d} type="button" aria-pressed={on} onClick={() => setDias(on ? dias.filter((x) => x !== d) : [...dias, d])} style={css(on ? chipOn : chipOff)}>{WEEKDAY_LONG[d]!.slice(0, 3)}</button>; })}
        </div>
        <span style={css("font-size:12px;color:var(--asa-label)")}>{dias.length > 1 ? `Cria o mesmo bloco em ${dias.length} dias da semana.` : "Marque mais dias para repetir o bloco neles."}</span>
      </fieldset>
      <label>Atividade (vocabulário da escala)<input required list="esc-vocab" value={rotulo} onChange={(e) => setRotulo(e.target.value.toLocaleUpperCase("pt-BR"))}/></label>
      <datalist id="esc-vocab">{vocabulario.map((v) => <option key={v} value={v}/>)}</datalist>
      <label>Início<input required type="time" value={inicio} onChange={(e) => setInicio(e.target.value)}/></label>
      <label>Fim (opcional)<input type="time" value={fim} onChange={(e) => setFim(e.target.value)}/></label>
      <label>Tipo (dá a cor na Escala)<TipoSelect tipos={tipos} value={tipoId} onChange={setTipoId}/></label>
      {regra !== "livro" && <label style={css("display:flex;align-items:flex-start;gap:8px;min-height:44px;min-width:0;max-width:100%")}><input type="checkbox" checked={flexivel} onChange={(e) => setFlexivel(e.target.checked)} style={css("width:20px;height:20px;flex:none")}/><span style={css("flex:1;min-width:0;overflow-wrap:anywhere;white-space:normal")}>Janela flexível (almoço): cada pessoa cumpre entre o início e o fim, sem hora fixa; aparece numa linha só, sem nomes, e não gera choque.</span></label>}
      <label>Quem entra<select value={regra} onChange={(e) => setRegra(e.target.value as Regra)}>{(["livro", "area", "todos", "pessoas", "ninguem"] as Regra[]).map((r) => <option key={r} value={r}>{REGRA_LABEL[r]}</option>)}</select></label>
      {regra === "livro" && <label>Show<select required value={showBookId} onChange={(e) => setShowBookId(e.target.value)}><option value="">Escolha o show</option>{shows.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}</select></label>}
      {regra === "area" && <fieldset style={css("border:none;padding:0;display:flex;flex-wrap:wrap;gap:7px")}>{areas.map((a) => { const on = areaIds.includes(a.id); return <button key={a.id} type="button" onClick={() => setAreaIds(on ? areaIds.filter((x) => x !== a.id) : [...areaIds, a.id])} style={css(on ? chipOn : chipOff)}>{a.name}</button>; })}</fieldset>}
      {regra === "pessoas" && <fieldset style={css("border:none;padding:0;display:flex;flex-wrap:wrap;gap:7px;max-height:150px;overflow:auto")}>{pessoas.map((p) => { const on = pessoaIds.includes(p.id); return <button key={p.id} type="button" onClick={() => setPessoaIds(on ? pessoaIds.filter((x) => x !== p.id) : [...pessoaIds, p.id])} style={css(on ? chipOn : chipOff)}>{p.name}</button>; })}</fieldset>}
      {regra === "livro" ? <p style={css("font-size:12px;color:var(--asa-label);margin:0;border-top:1px solid var(--asa-book-fade);padding-top:10px")}>As chamadas de um show ficam na sessão dele, na tela do show. Depois de criar o bloco, elas aparecem aqui também.</p> : <details open={chamadasNovas.length > 0} style={css("border-top:1px solid var(--asa-book-fade);padding-top:10px")}>
        <summary style={css("cursor:pointer;min-height:44px;display:flex;align-items:center;font-size:13px;font-weight:700;color:var(--asa-ink-dark)")}>{chamadasNovas.length ? `Chamadas (${chamadasNovas.length})` : "Tem chamada?"}</summary>
        <ChamadasLista valor={chamadasNovas} onChange={setChamadasNovas} inicioDaAtividade={inicio || null} desabilitado={salvando}/>
      </details>}
      {error && <p role="alert" style={css("font-size:12px;color:var(--asa-error-fg)")}>{error}</p>}
    </form></div>
    <footer className="shows-dialog-footer">
      <button type="button" onClick={onClose} className="shows-secondary">Cancelar</button>
      <button form="esc-bloco" className="shows-primary" disabled={salvando}>{salvando ? "Criando…" : dias.length > 1 ? `Criar em ${dias.length} dias` : "Criar bloco"}</button>
    </footer>
  </div></div>;
}

/* ---------- atividade só de hoje (entrada manual da Escala) ---------- */
function AtividadeDeHojeDialog({ tipos, pessoas, bloco, saving, onClose, onChamadas, onSubmit }: { tipos: TipoDoLocal[]; pessoas: Pessoa[]; bloco: Bloco | null; saving: boolean; onClose: () => void; onChamadas?: () => void; onSubmit: (v: { pessoaIds: string[]; rotulo: string; inicio: string; fim: string; tipoId: string | null }) => Promise<void> }) {
  useFecharComEsc(onClose);
  // Com `bloco`, o diálogo corrige a atividade que já existe: só o horário e o nome mudam.
  const corrigindo = Boolean(bloco);
  const [escolhidas, setEscolhidas] = useState<string[]>(bloco?.pessoaIds ?? []);
  const [busca, setBusca] = useState("");
  const [rotulo, setRotulo] = useState(bloco?.rotulo ?? "");
  const [inicio, setInicio] = useState(bloco?.inicio ?? "");
  const [fim, setFim] = useState(bloco?.fim ?? "");
  const [tipoId, setTipoId] = useState<string | null>(bloco?.tipoId ?? null);
  const disponiveis = pessoas.filter((p) => !p.folga);
  const filtradas = disponiveis.filter((p) => `${p.name} ${p.areaName ?? ""}`.toLocaleLowerCase("pt-BR").includes(busca.toLocaleLowerCase("pt-BR")));
  const marcar = (id: string) => setEscolhidas((atual) => atual.includes(id) ? atual.filter((v) => v !== id) : [...atual, id]);
  const pronto = Boolean(escolhidas.length && rotulo.trim() && /^([01]\d|2[0-3]):[0-5]\d$/.test(inicio));
  const submit = (e: React.FormEvent) => { e.preventDefault(); if (pronto) void onSubmit({ pessoaIds: escolhidas, rotulo: rotulo.trim(), inicio, fim, tipoId }); };
  return <div className="shows-dialog-backdrop"><div className="shows-dialog" role="dialog" aria-modal="true" aria-label="Atividade só deste dia">
    <header className="shows-dialog-header"><div><h2>{corrigindo ? "Mudar a atividade deste dia" : "Atividade só deste dia"}</h2><p>{corrigindo ? "Corrige o horário ou o nome para quem já está nela." : "Vale apenas neste dia — a Programação não muda."}</p></div><button type="button" onClick={onClose} aria-label="Fechar"><X size={18}/></button></header>
    <div className="shows-dialog-content"><form id="esc-manual" onSubmit={submit} className="shows-form">
      {corrigindo
        ? <p style={css("margin:0;font-size:12px;color:var(--asa-ink-muted)")}>{`Quem faz: ${(bloco?.pessoaIds ?? []).map((id) => pessoas.find((p) => p.id === id)?.name ?? "—").join(", ") || "ninguém"} · para mudar quem faz, tire do dia e ponha de novo.`}</p>
        : <label>Quem faz
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar pessoa ou área" aria-label="Buscar pessoa"/>
        </label>}
      {!corrigindo && <div role="group" aria-label="Quem faz esta atividade" style={css("display:flex;flex-direction:column;gap:5px;max-height:208px;overflow:auto;border:1px solid var(--asa-border-soft);border-radius:11px;padding:7px")}>
        {filtradas.map((p) => {
          const marcada = escolhidas.includes(p.id);
          return <button key={p.id} type="button" className="esc-hit" onClick={() => marcar(p.id)} aria-pressed={marcada}
            style={css("display:flex;align-items:center;gap:9px;text-align:left;border:1px solid " + (marcada ? "var(--asa-lavender)" : "var(--asa-purple-veil)") + ";background:" + (marcada ? "var(--asa-purple-snow)" : "#fff") + ";border-radius:10px;padding:7px 10px;cursor:pointer;font-family:Manrope,sans-serif")}>
            <span style={css("width:17px;height:17px;flex:none;border-radius:5px;border:1.5px solid " + (marcada ? "var(--asa-purple)" : "var(--asa-purple-line)") + ";background:" + (marcada ? "var(--asa-purple)" : "#fff") + ";color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center")}>{marcada ? "✓" : ""}</span>
            <span style={css("display:flex;flex-direction:column;gap:1px;min-width:0")}>
              <strong style={css("font-size:12.5px;color:var(--asa-ink-dark)")}>{p.name}</strong>
              <span style={css("font-size:12px;color:var(--asa-label)")}>{p.areaName ?? "Sem área"}</span>
            </span>
          </button>;
        })}
        {!filtradas.length && <span style={css("font-size:12px;color:var(--asa-label);padding:6px 4px")}>Ninguém com esse nome neste dia.</span>}
      </div>}
      {!corrigindo && <span style={css("font-size:12px;color:var(--asa-label);margin-top:-4px")}>{escolhidas.length ? `${escolhidas.length === 1 ? "1 pessoa escolhida" : `${escolhidas.length} pessoas escolhidas`} · quem está de folga não aparece` : "Escolha uma ou mais pessoas · quem está de folga não aparece"}</span>}
      <label>O que é<input value={rotulo} onChange={(e) => setRotulo(e.target.value)} placeholder="Prova de figurino" maxLength={60} required/></label>
      <label>Começa às<input type="time" value={inicio} onChange={(e) => setInicio(e.target.value)} required/></label>
      <label>Termina às (opcional)<input type="time" value={fim} onChange={(e) => setFim(e.target.value)}/></label>
      <label>Tipo (dá a cor na Escala)<TipoSelect tipos={tipos} value={tipoId} onChange={setTipoId}/></label>
      {corrigindo && onChamadas && <button type="button" className="shows-secondary" style={css("align-self:flex-start;min-height:44px")} onClick={onChamadas}>Chamadas desta atividade</button>}
    </form></div>
    <footer className="shows-dialog-footer">
      <button type="button" onClick={onClose} className="shows-secondary">Cancelar</button>
      <button form="esc-manual" className="shows-primary" disabled={!pronto || saving}>{saving ? "Salvando…" : corrigindo ? "Salvar mudança" : escolhidas.length > 1 ? `Pôr no dia · ${escolhidas.length} pessoas` : "Pôr no dia"}</button>
    </footer>
  </div></div>;
}
/* ---------- confirmação (as do navegador não combinam com o resto do app) ---------- */
function ConfirmDialog({ titulo, texto, acao, onClose, onSim }: { titulo: string; texto: string; acao: string; onClose: () => void; onSim: () => void }) {
  useFecharComEsc(onClose);
  return <div className="shows-dialog-backdrop"><div className="shows-dialog" role="dialog" aria-modal="true" aria-label={titulo}>
    <header className="shows-dialog-header"><h2>{titulo}</h2><button type="button" onClick={onClose} aria-label="Fechar"><X size={18}/></button></header>
    <div className="shows-dialog-content"><p style={css("margin:0;font-size:12.5px;line-height:1.6;color:var(--asa-ink-muted);text-wrap:pretty")}>{texto}</p></div>
    <footer className="shows-dialog-footer">
      <button type="button" onClick={onClose} className="shows-secondary">Cancelar</button>
      <button type="button" className="shows-primary" onClick={() => { onSim(); onClose(); }}>{acao}</button>
    </footer>
  </div></div>;
}