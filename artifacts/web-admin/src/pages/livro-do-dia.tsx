import { type CSSProperties, type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { ApiError, customFetch } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/useAuth";
import { StageMap, layoutFrame, stageMapApi, type StageDefinition, type StageFormat, type StageSide } from "@/components/stage-map";
import exampleData from "../../../../design_handoff_my_asa/dados-de-exemplo.json";
import { css } from "@/lib/dc-style";
import { markSampleEscalaAlterada, sampleEscalaPublicada } from "@/lib/review-escala";
import "./livro-do-dia.css";

/* A camada visual desta tela é cópia de design_handoff_my_asa/telas/14 Livro do Dia.dc.html: cada
   string de estilo é a do arquivo, na mesma ordem, convertida por css() (lib/dc-style). */
type Role = "adm" | "dir" | "sup" | "mem";
type Tab = "hoje" | "diff" | "forma" | "lista";
type DailyBookStatus = "DRAFT" | "PUBLISHED" | "REPUBLISHED" | "EXECUTED" | "CANCELLED";
type AssignmentStatus = "ASSIGNED" | "AT_RISK" | "OPEN" | "REMOVED";
type Assignment = { id: string; positionId: string; sceneId: string | null; userId: string | null; userName: string | null; status: AssignmentStatus };
type DPosition = { id: string; name: string; minimumCoverage: number; sourceRoleId: string | null; isRemoved: boolean; assignments: Assignment[] };
type DBlock = { id: string; name: string; order: number; sceneId: string | null; sourceBlockId: string | null; isRemoved: boolean; positions: DPosition[] };
type DScene = { id: string; name: string; order: number; sourceSceneId: string | null; isRemoved: boolean; blocks: DBlock[] };
type SessionBlockView = { id: string; name: string; startTime: string; endTime: string; order: number; isRemoved: boolean; stale: boolean; staleReason: string | null };
type DailyBook = { id: string; agendaEventId: string; scaleId: string | null; showBookId: string | null; status: DailyBookStatus; version: number; operationId?: string; operationName?: string; eventTitle?: string; eventDate?: string; showTitle?: string | null; scenes?: DScene[]; sessionBlocks?: SessionBlockView[] };
type PatternDiffRow = { where: string; padrao: string; hoje: string; why: string };
type Formation = { id: string; name: string; peopleCount: number; positions: Record<string, unknown>[]; showId: string | null; sceneId: string | null; sceneName?: string | null; active: boolean; timesUsed: number; lastUsedAt?: string | null; approximate?: boolean };
type CharacterToday = { characterId: string; name: string; selectedName: string | null; why: string };
type ConflictInfo = { expectedVersion: number; currentVersion: number; changes: { message?: string }[] };
type ShowKind = "form" | "mix" | "pers";
type Frame = { name: string; type: string };
type SourceSlot = { roleId: string; label: string; side: StageSide; papel: string | null; characterId: string | null };
type SourceScene = { id: string; name: string; order: number; stageFormat: StageFormat | null; frames: Frame[]; slots: SourceSlot[] };
type ShowSource = { id: string; title: string; kind: ShowKind; version: number; stageFormat: StageFormat; scenes: SourceScene[]; callTimes: Record<string, string> };
type SlotView = { position: DPosition; label: string; side: StageSide; papel: string | null; who: string | null; sub: string | null; out: boolean };
type ShowBookApi = {
  id: string; title: string; type: "SIMPLE" | "COMPLETE" | "CHARACTERS_ONLY"; version: number; stageFormat?: StageFormat | null;
  scenes: { id: string; name: string; order: number; stageFormat?: StageFormat | null; keyframes?: { name: string; type?: string | null; order: number }[]; blocks: { id: string; zone?: string | null; positions: { id: string; name: string; order?: number; positionJson?: Record<string, unknown>; lines?: { type: string; characterId?: string | null }[] }[] }[] }[];
};
type ShowBookRow = { id: string; title: string; type: ShowBookApi["type"]; stageFormat?: StageFormat | null };

/* ---------- valores do .dc.html ---------- */
const EST = {
  rasc: { label: "rascunho", tone: "#B06E00" },
  pub: { label: "publicado", tone: "#0E8F86" },
  exec: { label: "executado", tone: "#6C2BF2" },
  canc: { label: "não ocorreu", tone: "#a12c2c" },
} as const;
type Est = keyof typeof EST;
const estOf = (status: DailyBookStatus): Est => status === "DRAFT" ? "rasc" : status === "EXECUTED" ? "exec" : status === "CANCELLED" ? "canc" : "pub";
const TIPO_META: Record<ShowKind, [string, string, string, string]> = {
  form: ["só formação", "#0E8F86", "Cenas com mapa de posições, sem personagem nomeado.", "O elenco entra por posição."],
  mix: ["formação + personagens", "#6C2BF2", "Cenas com mapa, e dentro delas os personagens do show.", "A cena tem posições, e alguns lugares são de personagem."],
  pers: ["só personagens", "#C97A17", "Sem cena e sem mapa — o livro é a lista de quem faz cada personagem.", "Para trocar quem faz, use Ajustar na Escala do dia."],
};
const MONO_LABEL = "font-family:'JetBrains Mono',monospace;font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:#6b6482";
const CARD = "flex:none;border:1px solid #e6e1f2;border-radius:16px;background:#fff;overflow:hidden";
const PRIMARY = "height:34px;padding:0 15px;border-radius:11px;border:none;background:#6C2BF2;color:#fff;font-size:12.5px;font-weight:700;font-family:Manrope,sans-serif;cursor:pointer;white-space:nowrap";
const GHOST = "height:34px;padding:0 14px;border-radius:11px;border:1px solid #ddd6ee;background:#fff;color:#5b5473;font-size:12.5px;font-weight:600;font-family:Manrope,sans-serif;cursor:pointer;white-space:nowrap";
const SAVE_FORM = "height:30px;padding:0 13px;border-radius:9px;border:1px dashed #ddd0fa;background:#fbf9ff;color:#5B23C9;font-family:Manrope,sans-serif;font-size:11.5px;font-weight:700;cursor:pointer;align-self:flex-start";
const NOTE_OK = "font-size:11px;font-weight:700;color:#0E7F76";
const DASHED_NOTE = "padding:13px 15px;border:1px dashed #d8cff0;border-radius:13px;background:#fdfcff;font-size:12.5px;line-height:1.5;color:#5b5473;max-width:96ch";
const estadoChip = (est: Est, extra = "") => `font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${EST[est].tone};background:${EST[est].tone}1f;padding:3px 9px;border-radius:999px${extra}`;
import { REVIEW_PERSON } from "@/lib/amostra";

/* ---------- datas e nomes ---------- */
const WEEK = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const MONTH = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const MON3 = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const parts = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return { y, m, d, dt: new Date(y, m - 1, d) }; };
const longDate = (iso: string) => { const { m, d, dt } = parts(iso); return `${WEEK[dt.getDay()]}, ${d} de ${MONTH[m - 1]}`; };
const shortDate = (iso?: string) => { if (!iso) return "—"; const { m, d } = parts(iso); return `${d} ${MON3[m - 1]}`; };
const ddmm = (value?: string | null) => { if (!value) return ""; const dt = new Date(value); return `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}`; };
const time = (value: string | null | undefined) => value ? value.slice(0, 5) : "—";
/** Hora local do navegador, não UTC — daily-book.ts:G4 documenta o bug de "hoje" virar amanhã perto da meia-noite com toISOString(). */
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const plural = (n: number, um: string, muitos: string) => `${n} ${n === 1 ? um : muitos}`;
const ORDINAL = ["primeira", "segunda", "terceira", "quarta", "quinta", "sexta"];
const norm = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLocaleLowerCase("pt-BR");
/** Nome de exibição × nome gravado na posição: igual, ou mesmo primeiro nome. */
const samePerson = (a: string | null | undefined, b: string | null | undefined) => {
  if (!a || !b) return false;
  const x = norm(a), y = norm(b);
  return x === y || x.split(/\s+/)[0] === y.split(/\s+/)[0];
};
const editableStatus = (status: DailyBookStatus) => status === "DRAFT" || status === "PUBLISHED" || status === "REPUBLISHED";
const liveAssignments = (position: DPosition) => position.assignments.filter((a) => a.status !== "REMOVED");
const namesOf = (position: DPosition) => liveAssignments(position).map((a) => a.userName).filter((n): n is string => Boolean(n));
const sceneBlocks = (scene: DScene) => scene.blocks.filter((b) => !b.name.startsWith("Sessão "));
function convocadosOf(book: DailyBook) {
  return new Set((book.scenes ?? []).filter((s) => !s.isRemoved).flatMap((s) => sceneBlocks(s).filter((b) => !b.isRemoved).flatMap((b) => b.positions.filter((p) => !p.isRemoved).flatMap(namesOf))));
}
function sideForZone(zone: string | null | undefined): StageSide {
  const normalized = (zone ?? "").toLocaleUpperCase("pt-BR");
  return normalized === "BACKSTAGE LEFT" ? "BL" : normalized === "BACKSTAGE RIGHT" ? "BR" : "PER";
}
const kindOf = (type: ShowBookApi["type"] | undefined): ShowKind => type === "CHARACTERS_ONLY" ? "pers" : type === "SIMPLE" ? "form" : "mix";

/* ---------- amostra (dados-de-exemplo.json) ---------- */
const sampleShows = exampleData.shows as unknown as { nome: string; local: string; tipo: string; formato_palco: string; responsavel?: string; sessoes: { inicio: string; fim: string; chamada?: string }[]; cenas?: { nome: string; personagens: { slot: string; personagem: string; pessoa_hoje: string }[]; slots_bl: string[]; slots_br: string[]; quadros: { nome: string; tipo: string }[] }[] }[];
const sampleLocalName = (id: string) => exampleData.locais.find((l) => l.id === id)?.nome ?? id;
const sampleRoleId = (index: number, ci: number, side: StageSide, i: number) => `sample-role-${index}-${ci}-${side}-${i}`;

function sampleSourceFor(index: number): ShowSource | null {
  const show = sampleShows[index];
  if (!show) return null;
  const kind: ShowKind = show.tipo === "pers" ? "pers" : show.tipo === "form" ? "form" : "mix";
  const scenes: SourceScene[] = (show.cenas ?? []).map((cena, ci) => ({
    id: `sample-scene-${index}-${ci}`, name: cena.nome, order: ci + 1, stageFormat: null,
    frames: cena.quadros.map((q) => ({ name: q.nome, type: q.tipo })),
    slots: [
      ...cena.slots_bl.map((_, i) => ({ roleId: sampleRoleId(index, ci, "BL", i), label: `BL ${String(i + 1).padStart(2, "0")}`, side: "BL" as const, papel: null, characterId: null })),
      ...cena.slots_br.map((_, i) => ({ roleId: sampleRoleId(index, ci, "BR", i), label: `BR ${String(i + 1).padStart(2, "0")}`, side: "BR" as const, papel: null, characterId: null })),
      ...cena.personagens.map((role, i) => ({ roleId: sampleRoleId(index, ci, "PER", i), label: role.slot, side: "PER" as const, papel: role.personagem, characterId: null })),
    ],
  }));
  const callTimes: Record<string, string> = {};
  show.sessoes.forEach((s) => { if (s.chamada) callTimes[s.inicio] = s.chamada; });
  return { id: `sample-show-${index}`, title: show.nome, kind, version: 1, stageFormat: (show.formato_palco || "NONE") as StageFormat, scenes, callTimes };
}

/** Sintetiza um Livro do Dia a partir das cenas de dados-de-exemplo.json — mesmos rótulos de slot do 13 Shows. */
function sampleDailyBookFor(index: number): DailyBook {
  const show = sampleShows[index];
  const source = sampleSourceFor(index)!;
  const scenes: DScene[] = (show.cenas ?? []).map((cena, ci) => {
    const sceneId = `scene-${index}-${ci}`;
    const who = [...cena.slots_bl, ...cena.slots_br, ...cena.personagens.map((p) => p.pessoa_hoje)];
    const positions: DPosition[] = source.scenes[ci].slots.map((slot, si) => {
      const id = `pos-${index}-${ci}-${si}`;
      const person = who[si];
      return { id, name: slot.label, minimumCoverage: 1, sourceRoleId: slot.roleId, isRemoved: false, assignments: [{ id: `a-${id}`, positionId: id, sceneId, userId: person ? `sample-${person}` : null, userName: person || null, status: person ? "ASSIGNED" : "OPEN" }] };
    });
    return { id: sceneId, name: cena.nome, order: ci + 1, sourceSceneId: source.scenes[ci].id, isRemoved: false, blocks: [{ id: `block-${index}-${ci}`, name: cena.nome, order: 1, sceneId, sourceBlockId: null, isRemoved: false, positions }] };
  });
  const sessionBlocks: SessionBlockView[] = show.sessoes.map((s, i) => ({ id: `session-${index}-${i}`, name: `Sessão ${i + 1}`, startTime: s.inicio, endTime: s.fim, order: i, isRemoved: false, stale: false, staleReason: null }));
  const status: DailyBookStatus = index % 4 === 0 ? "PUBLISHED" : index % 4 === 1 ? "DRAFT" : index % 4 === 2 ? "EXECUTED" : "DRAFT";
  return { id: `sample-book-${index}`, agendaEventId: `sample-event-${index}`, scaleId: `sample-scale-${show.local}`, showBookId: `sample-show-${index}`, status, version: 1, operationId: `sample-${show.local}`, operationName: sampleLocalName(show.local), eventTitle: show.nome, eventDate: todayISO(), showTitle: show.nome, scenes, sessionBlocks };
}
function sampleCharactersToday(showTitle: string): CharacterToday[] {
  return exampleData.personagens.filter((p) => p.shows.includes(showTitle)).map((p) => {
    const fila = p.fila as { pessoa: string; vezes?: number }[];
    const chosen = p.modo === "titular" ? fila[0] : [...fila].sort((a, b) => (a.vezes ?? 0) - (b.vezes ?? 0))[0];
    return { characterId: `sample-character-${p.nome}`, name: p.nome, selectedName: chosen?.pessoa ?? null, why: p.modo === "titular" ? "titular" : `rodízio · fez ${chosen?.vezes ?? 0}×, o menor da fila` };
  });
}
function samplePatternDiffFor(book: DailyBook): PatternDiffRow[] {
  const rows: PatternDiffRow[] = [];
  for (const scene of book.scenes ?? []) {
    for (const block of sceneBlocks(scene)) for (const position of block.positions) {
      const where = `${scene.name} · ${position.name}`;
      if (scene.isRemoved || position.isRemoved) rows.push({ where, padrao: namesOf(position).join(", ") || "posição do padrão", hoje: "fora do dia", why: scene.isRemoved ? "Cena removida no ajuste do dia." : "Posição removida no ajuste do dia." });
      else if (!namesOf(position).length) rows.push({ where, padrao: "posição do padrão", hoje: "em aberto", why: "Sem substituto disponível." });
    }
  }
  return rows;
}
const reviewBookKey = (id: string) => `myasa-review-dailybook-v2-${id}`;
const loadReviewBook = (id: string): DailyBook | null => { try { return JSON.parse(window.sessionStorage.getItem(reviewBookKey(id)) ?? "") as DailyBook; } catch { return null; } };
const saveReviewBook = (book: DailyBook) => window.sessionStorage.setItem(reviewBookKey(book.id), JSON.stringify(book));
const reviewFormationsKey = (showId: string) => `myasa-review-formations-v2-${showId}`;
const loadReviewFormations = (showId: string): Formation[] => { try { return JSON.parse(window.sessionStorage.getItem(reviewFormationsKey(showId)) ?? "") as Formation[]; } catch { return []; } };
const saveReviewFormations = (showId: string, formations: Formation[]) => window.sessionStorage.setItem(reviewFormationsKey(showId), JSON.stringify(formations));

/** Mesma regra do backend (`apply-formation`): posição viva com o mesmo código de slot fica, com
 * quem está nela; slot da formação sem correspondência nasce vago; posição que a formação não
 * tem sai do dia. Ninguém é escalado pela ação. */
function applyFormationLocally(book: DailyBook, sceneId: string, formation: Formation): DailyBook {
  const stamp = Date.now();
  return {
    ...book,
    version: book.version + 1,
    scenes: (book.scenes ?? []).map((scene) => {
      if (scene.id !== sceneId) return scene;
      const unmatched = sceneBlocks(scene).flatMap((b) => b.positions.filter((p) => !p.isRemoved).map((p) => p.id));
      const byName = new Map<string, string[]>();
      sceneBlocks(scene).forEach((b) => b.positions.filter((p) => !p.isRemoved).forEach((p) => byName.set(p.name, [...(byName.get(p.name) ?? []), p.id])));
      const created: DPosition[] = [];
      formation.positions.forEach((p, i) => {
        const slot = typeof p.role === "string" && p.role ? p.role : `Posição ${i + 1}`;
        const match = (byName.get(slot) ?? []).find((id) => unmatched.includes(id));
        if (match) { unmatched.splice(unmatched.indexOf(match), 1); return; }
        const id = `pos-applied-${sceneId}-${stamp}-${i}`;
        created.push({ id, name: slot, minimumCoverage: 1, sourceRoleId: typeof p.roleId === "string" ? p.roleId : null, isRemoved: false, assignments: [{ id: `a-${id}`, positionId: id, sceneId, userId: null, userName: null, status: "OPEN" }] });
      });
      const blocks = scene.blocks.map((b) => ({ ...b, positions: b.positions.map((p) => unmatched.includes(p.id) ? { ...p, isRemoved: true, assignments: p.assignments.map((a) => ({ ...a, status: "REMOVED" as const })) } : p) }));
      const target = blocks.findIndex((b) => !b.name.startsWith("Sessão "));
      if (target >= 0) blocks[target] = { ...blocks[target], positions: [...blocks[target].positions, ...created] };
      return { ...scene, blocks };
    }),
  };
}

/** Aplica a mesma escrita do backend localmente, para a amostra ter o mesmo comportamento sem servidor. */
function reviewMutate(book: DailyBook, path: string): DailyBook {
  if (path === "/publish") return { ...book, status: "PUBLISHED", version: book.version + 1 };
  if (path === "/republish") return { ...book, status: "REPUBLISHED", version: book.version + 1 };
  if (path === "/execute") return { ...book, status: "EXECUTED", version: book.version + 1 };
  if (path === "/cancel") return { ...book, status: "CANCELLED", version: book.version + 1 };
  if (path === "/reopen") return { ...book, status: "DRAFT", version: book.version + 1 };
  const sceneMatch = path.match(/^\/scenes\/([^/]+)(\/restore)?$/);
  if (sceneMatch) { const [, id, restore] = sceneMatch; return { ...book, version: book.version + 1, scenes: (book.scenes ?? []).map((s) => s.id === id ? { ...s, isRemoved: !restore } : s) }; }
  const positionMatch = path.match(/^\/positions\/([^/]+)(\/restore)?$/);
  if (positionMatch) {
    const [, id, restore] = positionMatch;
    const isRemoved = !restore;
    return { ...book, version: book.version + 1, scenes: (book.scenes ?? []).map((s) => ({ ...s, blocks: s.blocks.map((b) => ({ ...b, positions: b.positions.map((p) => p.id === id ? { ...p, isRemoved, assignments: p.assignments.map((a) => ({ ...a, status: isRemoved ? "REMOVED" as const : a.status === "REMOVED" ? (a.userName ? "ASSIGNED" as const : "OPEN" as const) : a.status })) } : p) })) })) };
  }
  return book;
}

/** Livro do Show real → a mesma forma da amostra (lado do palco pelo `zone` do bloco, quadros-chave da cena). */
function sourceFromShowBook(show: ShowBookApi, callTimes: Record<string, string>): ShowSource {
  return {
    id: show.id, title: show.title, kind: kindOf(show.type), version: show.version, stageFormat: show.stageFormat ?? "NONE", callTimes,
    scenes: show.scenes.slice().sort((a, b) => a.order - b.order).map((scene) => ({
      id: scene.id, name: scene.name, order: scene.order, stageFormat: scene.stageFormat ?? null,
      frames: (scene.keyframes ?? []).slice().sort((a, b) => a.order - b.order).map((k) => ({ name: k.name, type: k.type ?? "inicial" })),
      slots: scene.blocks.flatMap((block) => block.positions.map((p) => ({ roleId: p.id, label: p.name, side: sideForZone(block.zone), papel: null, characterId: p.lines?.find((l) => l.characterId)?.characterId ?? null }))),
    })),
  };
}

/** Posições de uma cena do dia, com lado do palco e o papel vindos do Livro do Show. Posição sem
 * origem (formação aplicada só hoje) não tem lado gravado: metade vai para cada bastidor. */
function slotsOf(scene: DScene, source: ShowSource | null, subs: Map<string, string>, characterNames: Map<string, string>): SlotView[] {
  const bySource = new Map((source?.scenes ?? []).flatMap((s) => s.slots).map((slot) => [slot.roleId, slot]));
  const positions = sceneBlocks(scene).flatMap((b) => b.positions.map((p) => ({ p, blockOut: b.isRemoved })));
  const orphans = positions.filter(({ p }) => !p.sourceRoleId || !bySource.has(p.sourceRoleId));
  return positions.map(({ p, blockOut }) => {
    const origin = p.sourceRoleId ? bySource.get(p.sourceRoleId) : undefined;
    const orphanIndex = orphans.findIndex((o) => o.p.id === p.id);
    const side: StageSide = origin?.side ?? (orphanIndex < Math.ceil(orphans.length / 2) ? "BL" : "BR");
    const papel = origin?.papel ?? (origin?.characterId ? characterNames.get(origin.characterId) ?? null : null);
    // Posição tirada do dia continua mostrando quem estava nela (riscado), como no desenho.
    const who = (p.isRemoved ? p.assignments.map((a) => a.userName).filter((n): n is string => Boolean(n)) : namesOf(p)).join(", ") || null;
    return { position: p, label: p.name, side, papel, who, sub: subs.get(`${scene.name} · ${p.name}`) ?? null, out: p.isRemoved || blockOut };
  });
}

const formationSides = (positions: Record<string, unknown>[]) => {
  const known = positions.map((p) => p.side === "BL" || p.side === "BR" || p.side === "PER" ? p.side as StageSide : null);
  const unknown = known.filter((s) => !s).length;
  let seen = 0;
  const sides: Record<StageSide, string[]> = { BL: [], BR: [], PER: [] };
  known.forEach((side, i) => {
    const resolved = side ?? (seen++ < Math.ceil(unknown / 2) ? "BL" : "BR");
    sides[resolved].push(typeof positions[i].role === "string" ? positions[i].role as string : String(i + 1));
  });
  return sides;
};

/* ---------- página ---------- */
export default function LivroDoDiaPage({ role, canManage, onHeader }: { role: Role; canManage: boolean; onHeader?: (node: ReactNode) => void }) {
  const sampleRequested = new URLSearchParams(window.location.search).get("amostra") === "1";
  if (sampleRequested) window.sessionStorage.setItem("myasa-review-sample", "1");
  const review = import.meta.env.DEV && (sampleRequested || window.sessionStorage.getItem("myasa-review-sample") === "1");
  const { user } = useAuth();
  const isMem = role === "mem", isDir = role === "dir";
  const me = review ? REVIEW_PERSON[role] : ((user as { displayName?: string } | null)?.displayName ?? user?.name ?? "");
  const [tab, setTab] = useState<Tab>("hoje");
  const [date] = useState(todayISO());
  const [books, setBooks] = useState<DailyBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [allBooks, setAllBooks] = useState<DailyBook[]>([]);
  const [listFilter, setListFilter] = useState<"todos" | Est>("todos");
  const [bookId, setBookId] = useState("");
  const [book, setBook] = useState<DailyBook | null>(null);
  const [source, setSource] = useState<ShowSource | null>(null);
  const [diffs, setDiffs] = useState<PatternDiffRow[]>([]);
  const [hasLiveChanges, setHasLiveChanges] = useState(false);
  const [charactersToday, setCharactersToday] = useState<CharacterToday[]>([]);
  const [formations, setFormations] = useState<Formation[]>([]);
  const [openSceneId, setOpenSceneId] = useState("");
  const [formSel, setFormSel] = useState<Record<string, string>>({});
  const [framesOn, setFramesOn] = useState<Record<string, string[]>>({});
  const [sceneNote, setSceneNote] = useState<{ sceneId: string; text: string } | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState<ConflictInfo | null>(null);
  const [prompt, setPrompt] = useState<{ title: string; label: string; initial?: string; onSubmit: (value: string) => void } | null>(null);

  const handleMutationError = (err: unknown, fallback: string) => {
    if (err instanceof ApiError && err.status === 409 && err.data && typeof err.data === "object") {
      const data = err.data as { expectedVersion?: number; currentVersion?: number; changes?: { message?: string }[] };
      setConflict({ expectedVersion: data.expectedVersion ?? 0, currentVersion: data.currentVersion ?? 0, changes: data.changes ?? [] });
      return;
    }
    setError(err instanceof ApiError && err.data && typeof err.data === "object" && typeof (err.data as { message?: unknown }).message === "string" ? (err.data as { message: string }).message : fallback);
  };

  const load = async () => {
    setError(""); setLoading(true);
    try {
      if (review) { setBooks(sampleShows.map((_, index) => loadReviewBook(`sample-book-${index}`) ?? sampleDailyBookFor(index))); return; }
      const result = await customFetch<{ dailyBooks: DailyBook[] }>(`/api/daily-book?date=${date}`);
      // O cartão de cada show precisa da hora (sessão) e de quantos foram convocados: vêm do detalhe.
      const detailed = await Promise.all(result.dailyBooks.map((b) => customFetch<{ dailyBook: DailyBook }>(`/api/daily-book/${b.id}`).then((r) => ({ ...b, ...r.dailyBook })).catch(() => b)));
      setBooks(detailed);
    } catch { setError("Não consegui carregar os Livros do Dia de hoje."); } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [review]);

  // A troca de perfil só existe na prévia local, mas ela não pode manter uma
  // aba que aquele perfil não possui (por exemplo, Formações para o Elenco).
  // Cada novo perfil sempre começa pelo recorte seguro de Hoje.
  useEffect(() => {
    setTab("hoje");
    setListFilter("todos");
  }, [role]);

  const loadAllBooks = async () => {
    if (review) { setAllBooks(books); return; }
    try { const result = await customFetch<{ dailyBooks: DailyBook[] }>("/api/daily-book"); setAllBooks(result.dailyBooks); } catch { setError("Não consegui carregar a lista de Livros."); }
  };
  useEffect(() => { if (tab === "lista") void loadAllBooks(); }, [tab, review, books]);

  const characterNames = useMemo(() => new Map(charactersToday.map((c) => [c.characterId, c.name])), [charactersToday]);
  const convokedMe = (b: DailyBook) => {
    if ([...convocadosOf(b)].some((name) => samePerson(name, me))) return true;
    return review && sampleCharactersToday(b.showTitle ?? "").some((c) => samePerson(c.selectedName, me));
  };
  const supLocal = review && role === "sup" ? exampleData.pessoas.find((p) => p.nome_de_exibicao === me)?.local ?? null : null;
  const todayBooks = useMemo(() => books.filter((b) => {
    if (isMem) return (b.status === "PUBLISHED" || b.status === "REPUBLISHED" || b.status === "EXECUTED") && (!review || convokedMe(b));
    if (supLocal) return b.operationId === `sample-${supLocal}`;
    return true;
  }).sort((a, b) => time(a.sessionBlocks?.[0]?.startTime).localeCompare(time(b.sessionBlocks?.[0]?.startTime))), [books, isMem, supLocal, me, review]);

  const open = async (id: string) => {
    setError(""); setConflict(null); setBookId(id); setSceneNote(null);
    if (review) {
      const index = Number(id.replace("sample-book-", ""));
      const current = loadReviewBook(id) ?? (sampleShows[index] ? sampleDailyBookFor(index) : null);
      if (!current) return;
      setBook(current); setSource(sampleSourceFor(index)); setOpenSceneId((prev) => current.scenes?.some((s) => s.id === prev) ? prev : current.scenes?.[0]?.id ?? "");
      setDiffs(samplePatternDiffFor(current)); setHasLiveChanges(samplePatternDiffFor(current).length > 0);
      setCharactersToday(sampleCharactersToday(current.showTitle ?? ""));
      setFormations(current.showBookId ? loadReviewFormations(current.showBookId) : []);
      return;
    }
    try {
      const [bookResult, diffResult, deltaResult] = await Promise.all([
        customFetch<{ dailyBook: DailyBook }>(`/api/daily-book/${id}`),
        customFetch<{ diffs: PatternDiffRow[] }>(`/api/daily-book/${id}/pattern-diff`).catch(() => ({ diffs: [] as PatternDiffRow[] })),
        customFetch<{ hasLiveChanges: boolean }>(`/api/daily-book/${id}/delta`).catch(() => ({ hasLiveChanges: false })),
      ]);
      const opened = bookResult.dailyBook;
      setBook(opened); setOpenSceneId((prev) => opened.scenes?.some((s) => s.id === prev) ? prev : opened.scenes?.slice().sort((a, b) => a.order - b.order)[0]?.id ?? "");
      setDiffs(diffResult.diffs); setHasLiveChanges(deltaResult.hasLiveChanges);
      if (!opened.showBookId) { setSource(null); setCharactersToday([]); setFormations([]); return; }
      const [showResult, sessionsResult] = await Promise.all([
        customFetch<{ showBook: ShowBookApi }>(`/api/show-books/${opened.showBookId}`).catch(() => null),
        customFetch<{ sessions: { startTime: string; callTime?: string | null }[] }>(`/api/show-books/${opened.showBookId}/sessions`).catch(() => ({ sessions: [] as { startTime: string; callTime?: string | null }[] })),
      ]);
      const callTimes: Record<string, string> = {};
      sessionsResult.sessions.forEach((s) => { if (s.callTime) callTimes[time(s.startTime)] = time(s.callTime); });
      setSource(showResult ? sourceFromShowBook(showResult.showBook, callTimes) : null);
      // 09/10: quem faz hoje é quem está escalado neste Livro do Dia (vaga a vaga, já com equilíbrio,
      // folgas e ajustes da Escala) — não um novo cálculo por personagem, que repetia a mesma pessoa.
      const escaladosPorVaga = new Map<string, string[]>();
      for (const scene of opened.scenes ?? []) for (const block of scene.blocks) for (const p of block.positions) {
        if (p.sourceRoleId && !p.isRemoved) escaladosPorVaga.set(p.sourceRoleId, [...(escaladosPorVaga.get(p.sourceRoleId) ?? []), ...namesOf(p)]);
      }
      const vagas = (showResult?.showBook.scenes ?? []).flatMap((s) => s.blocks.flatMap((b) => b.positions.flatMap((p) => (p.lines ?? []).filter((l) => l.type === "CHARACTER" && l.characterId).map((l) => ({ positionId: p.id, characterId: l.characterId! })))));
      const modos = new Map<string, { name: string; mode: string }>();
      await Promise.all([...new Set(vagas.map((v) => v.characterId))].map((characterId) =>
        customFetch<{ character: { name: string; mode: string } }>(`/api/characters/${characterId}/resolve?operationId=${opened.operationId}&date=${opened.eventDate}`)
          .then((r) => { modos.set(characterId, r.character); }).catch(() => undefined)));
      setCharactersToday(vagas.filter((v) => modos.has(v.characterId)).map((v) => {
        const quem = escaladosPorVaga.get(v.positionId) ?? [];
        const modo = modos.get(v.characterId)!;
        return { characterId: `${v.positionId}`, name: modo.name, selectedName: quem.join(", ") || null, why: !quem.length ? "sem ninguém escalado hoje" : modo.mode === "titular" ? "titular" : "rodízio" };
      }));
      await customFetch<{ formations: Formation[] }>(`/api/formations/by-show/${opened.showBookId}`).then((r) => setFormations(r.formations)).catch(() => setFormations([]));
    } catch { setError("Não consegui abrir este Livro do Dia."); }
  };

  // O livro aberto é sempre um dos shows de hoje no escopo (como no desenho).
  useEffect(() => {
    if (loading) return;
    if (!todayBooks.length) { setBook(null); setBookId(""); return; }
    if (!todayBooks.some((b) => b.id === bookId)) void open(todayBooks[0].id);
  }, [loading, todayBooks]);

  const refreshOpen = async () => { if (book) { await open(book.id); if (!review) void load(); } };
  const withVersion = (payload: Record<string, unknown> = {}) => JSON.stringify({ ...payload, expectedVersion: book?.version });
  const mutate = async (path: string, method: string, payload: Record<string, unknown>, fallback: string) => {
    if (!book) return;
    setSaving(true); setSceneNote(null);
    try {
      if (review) {
        // Mesmas ligações com a 15 que o servidor aplica: o Livro só publica com a Escala do dia
        // publicada, e mudar o elenco marca a Escala publicada como alterada.
        const localId = (book.operationId ?? "").replace("sample-", "");
        const day = book.eventDate ?? todayISO();
        if (path === "/publish" && !sampleEscalaPublicada(localId, day)) {
          setError("A Escala do dia ainda não foi publicada. Publicar a escala é o que convoca as pessoas — antes disso o livro não tem para quem ir.");
          return;
        }
        if (path.startsWith("/scenes") || path.startsWith("/positions")) markSampleEscalaAlterada(localId, day);
        const next = reviewMutate(book, path);
        saveReviewBook(next); setBook(next); setBooks((current) => current.map((b) => b.id === next.id ? next : b));
        setDiffs(samplePatternDiffFor(next)); setHasLiveChanges(path.startsWith("/scenes") || path.startsWith("/positions") || (hasLiveChanges && path !== "/republish" && path !== "/publish"));
        return;
      }
      await customFetch(`/api/daily-book/${book.id}${path}`, { method, body: withVersion(payload) });
      await refreshOpen();
    } catch (err) { handleMutationError(err, fallback); } finally { setSaving(false); }
  };
  const publish = () => mutate("/publish", "POST", {}, "Não consegui publicar o Livro do Dia.");
  const republish = () => mutate("/republish", "POST", {}, "Não consegui republicar o Livro do Dia.");
  // Executado é o fim da linha: depois disso o Livro vira registro e não se edita mais, então
  // pede uma linha sobre como o show correu — fica no Registro junto com a marcação.
  const execute = () => setPrompt({
    title: "Marcar como executado",
    label: "Como foi? (fica no Registro; depois disso o Livro vira registro e não se edita mais)",
    onSubmit: (nota) => { setPrompt(null); void mutate("/execute", "POST", { nota }, "Não consegui marcar como executado."); },
  });
  const cancel = () => setPrompt({ title: "Marcar que não ocorreu", label: "Motivo", onSubmit: (reason) => { setPrompt(null); void mutate("/cancel", "POST", { reason }, "Não consegui marcar que o show não ocorreu."); } });
  const reopen = () => setPrompt({ title: "Reabrir como rascunho", label: "Motivo", onSubmit: (reason) => { setPrompt(null); void mutate("/reopen", "POST", { reason }, "Não consegui reabrir o Livro do Dia."); } });
  const toggleScene = (scene: DScene) => mutate(`/scenes/${scene.id}${scene.isRemoved ? "/restore" : ""}`, scene.isRemoved ? "PATCH" : "DELETE", {}, "Não consegui ajustar esta cena.");
  const togglePosition = (position: DPosition) => mutate(`/positions/${position.id}${position.isRemoved ? "/restore" : ""}`, position.isRemoved ? "PATCH" : "DELETE", {}, "Não consegui ajustar esta posição.");

  const saveFormationFromScene = (scene: DScene, slots: SlotView[]) => {
    const live = slots.filter((s) => !s.out);
    setPrompt({
      title: "Guardar esta formação no padrão", label: "Nome da formação", initial: `${scene.name} ${live.length}`,
      onSubmit: async (name) => {
        setPrompt(null);
        if (!scene.sourceSceneId || !book) return;
        setSaving(true);
        try {
          if (review) {
            const showId = book.showBookId!;
            const created: Formation = { id: `sample-formation-${Date.now()}`, name, peopleCount: live.length, positions: live.map((s) => ({ role: s.label, function: s.label, coordinate: null, roleId: s.position.sourceRoleId, side: s.side })), showId, sceneId: scene.sourceSceneId, sceneName: scene.name, active: true, timesUsed: 0, lastUsedAt: null };
            const next = [...loadReviewFormations(showId), created];
            saveReviewFormations(showId, next); setFormations(next);
          } else {
            // Guarda a formação de HOJE (posições vivas desta cena no Livro do Dia), não a do Livro do Show.
            await customFetch(`/api/daily-book/${book.id}/scenes/${scene.id}/save-formation`, { method: "POST", body: JSON.stringify({ name }) });
            if (book.showBookId) await customFetch<{ formations: Formation[] }>(`/api/formations/by-show/${book.showBookId}`).then((r) => setFormations(r.formations)).catch(() => {});
          }
          setSceneNote({ sceneId: scene.id, text: "Guardada na biblioteca de formações desta cena." });
        } catch { setError("Não consegui guardar esta formação no padrão."); } finally { setSaving(false); }
      },
    });
  };

  const applyFormationToday = async (formation: Formation) => {
    if (!book) return;
    const targetScene = book.scenes?.find((s) => s.sourceSceneId === formation.sceneId);
    if (!targetScene) { setError("Esta formação não tem uma cena correspondente no Livro de hoje."); return; }
    setSaving(true);
    try {
      if (review) {
        markSampleEscalaAlterada((book.operationId ?? "").replace("sample-", ""), book.eventDate ?? todayISO());
        const next = applyFormationLocally(book, targetScene.id, formation);
        const updated = loadReviewFormations(book.showBookId!).map((f) => f.id === formation.id ? { ...f, timesUsed: f.timesUsed + 1, lastUsedAt: new Date().toISOString() } : f);
        saveReviewFormations(book.showBookId!, updated); setFormations(updated);
        saveReviewBook(next); setBook(next); setBooks((current) => current.map((b) => b.id === next.id ? next : b)); setDiffs(samplePatternDiffFor(next)); setHasLiveChanges(true);
      } else {
        await customFetch(`/api/daily-book/${book.id}/scenes/${targetScene.id}/apply-formation`, { method: "POST", body: withVersion({ formationId: formation.id }) });
        await refreshOpen();
      }
      setOpenSceneId(targetScene.id); setTab("hoje");
      setSceneNote({ sceneId: targetScene.id, text: "Aplicada só hoje — o Livro do Show não muda." });
    } catch (err) { handleMutationError(err, "Não consegui aplicar esta formação para hoje."); } finally { setSaving(false); }
  };

  /* ---------- cabeçalho do shell: escopo e escala, como no quadro ---------- */
  // Elenco: o título já diz "Meus shows" — o cabeçalho não repete.
  const scopeLabel = isMem ? "" : role === "sup"
    ? (review ? (() => { const p = exampleData.pessoas.find((x) => x.nome_de_exibicao === me); return [p?.local ? sampleLocalName(p.local) : "", exampleData.areas.find((a) => a.id === p?.area)?.nome ?? ""].filter(Boolean).join(" · "); })() : [...new Set(books.map((b) => b.operationName).filter(Boolean))].join(" · "))
    : "Todos os locais";
  useEffect(() => {
    onHeader?.(<div style={css("display:flex;align-items:center;gap:12px")}>
      {scopeLabel && <span style={css("font-size:12.5px;color:#6b6482")}>{scopeLabel}</span>}
      <span className="ldd-hide-sm" style={css("font-size:11.5px;color:#6b6482;background:transparent;border:none;font-family:Manrope,sans-serif;padding:0;cursor:default;white-space:nowrap")}>{isMem ? "a mesma escalação está na sua escala" : "a mesma escalação está na Escala do dia"}</span>
    </div>);
    return () => onHeader?.(null);
  }, [scopeLabel, isMem]);

  const tabDefs: [Tab, string][] = isMem ? [["hoje", "Meus shows de hoje"], ["lista", "Meus shows"]] : [["hoje", "Os shows de hoje"], ["diff", "Diferenças do padrão"], ["forma", "Formações"], ["lista", "Livros"]];
  const ruleText = isMem
    ? "Publicado chega só a quem foi convocado. Ser do mesmo local não basta: se você não entra no show, o livro dele não é seu para ver."
    : isDir
      ? "Direção lê qualquer livro de qualquer local, com o estado de cada um — e não edita nenhum. Quem ajusta é quem responde pelo show."
      : role === "sup"
        ? "Você ajusta os livros dos shows sob sua responsabilidade."
        : "Administração faz tudo em qualquer local, inclusive reabrir dia fechado. Tudo o que remove fica recuperável e registrado em auditoria.";

  return <section className="ldd-root" style={css("position:relative;flex:1;display:flex;flex-direction:column;background:#faf9fe;min-width:0;min-height:calc(100vh - 48px)")}>
    <div className="ldd-tabs ldd-pad" role="tablist" style={css("display:flex;align-items:center;padding:0 20px;border-bottom:1px solid #ebe6f6;background:#fff")}>
      {tabDefs.map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={tab === key} className="ldd-hit" onClick={() => setTab(key)}
        style={css(`display:flex;align-items:center;gap:7px;border:none;background:transparent;font-family:Manrope,sans-serif;font-size:13px;font-weight:${tab === key ? 700 : 500};color:${tab === key ? "#6C2BF2" : "#6b6482"};padding:11px 4px;margin-right:14px;cursor:pointer;border-bottom:2px solid ${tab === key ? "#6C2BF2" : "transparent"};white-space:nowrap`)}>
        <span>{label}</span>
        {key === "diff" && book && <span style={css("font-family:'JetBrains Mono',monospace;font-size:9.5px;font-weight:700;padding:2px 6px;border-radius:999px;background:#fdf1dc;color:#8a6413")}>{diffs.length}</span>}
      </button>)}
    </div>

    <div className="ldd-pad" style={css("flex:1;min-height:0;padding:16px 20px 24px;display:flex;flex-direction:column;gap:14px")}>
      {error && <div role="alert" style={css("display:flex;align-items:center;gap:12px;padding:11px 13px;border:1px solid #f0dede;border-radius:12px;background:#fdf7f7")}>
        <span style={css("flex:1;font-size:12.5px;font-weight:700;color:#8a2f2f")}>{error}</span>
        <button type="button" className="ldd-hit" style={css(GHOST)} onClick={() => { setError(""); void (book ? refreshOpen() : load()); }}>Tentar de novo</button>
      </div>}
      {conflict && <ConflictBanner conflict={conflict} onReload={() => { setConflict(null); void refreshOpen(); }}/>}

      {tab === "hoje" && <HojeTab
        role={role} review={review} me={me} date={date} loading={loading} todayBooks={todayBooks} book={book} source={source}
        diffs={diffs} hasLiveChanges={hasLiveChanges} charactersToday={charactersToday} characterNames={characterNames} formations={formations}
        canManage={canManage} saving={saving} openSceneId={openSceneId} setOpenSceneId={setOpenSceneId}
        formSel={formSel} setFormSel={setFormSel} framesOn={framesOn} setFramesOn={setFramesOn} sceneNote={sceneNote} supLocal={supLocal}
        onPick={(id) => void open(id)} onPublish={publish} onRepublish={republish} onExecute={execute} onCancel={cancel} onReopen={reopen}
        onToggleScene={toggleScene} onTogglePosition={togglePosition} onSaveFormation={saveFormationFromScene} onApplyToday={applyFormationToday}
      />}
      {tab === "diff" && !isMem && <DiffTab diffs={diffs} hasBook={Boolean(book)}/>}
      {tab === "forma" && !isMem && <FormacoesTab review={review} scopeLocal={supLocal} currentShowId={book?.showBookId ?? null} currentFormations={formations} canApplyToday={(f) => Boolean(canManage && book && editableStatus(book.status) && book.scenes?.some((s) => s.sourceSceneId === f.sceneId))} saving={saving} onApplyToday={applyFormationToday}/>}
      {tab === "lista" && <ListaTab isMem={isMem} books={isMem ? allBooks.filter((b) => b.status !== "DRAFT" && b.status !== "CANCELLED" && (!review || convokedMe(b))) : supLocal ? allBooks.filter((b) => b.operationId === `sample-${supLocal}`) : allBooks} me={me} review={review} filter={listFilter} onFilter={setListFilter} onOpen={(id) => { setTab("hoje"); void open(id); }}/>}
    </div>

    <div className="ldd-pad" style={css("display:flex;align-items:flex-start;gap:11px;padding:12px 20px;border-top:1px solid #ebe6f6;background:#fff;flex:none")}>
      <span style={css(MONO_LABEL)}>Regra</span>
      <span style={css("font-size:12px;line-height:1.5;color:#5b5473")}>{ruleText}</span>
    </div>

    {prompt && <PromptDialog title={prompt.title} label={prompt.label} initial={prompt.initial} onClose={() => setPrompt(null)} onSubmit={prompt.onSubmit}/>}
  </section>;
}

/* ---------- aba: os shows de hoje ---------- */
function HojeTab(props: {
  role: Role; review: boolean; me: string; date: string; loading: boolean; todayBooks: DailyBook[]; book: DailyBook | null; source: ShowSource | null;
  diffs: PatternDiffRow[]; hasLiveChanges: boolean; charactersToday: CharacterToday[]; characterNames: Map<string, string>; formations: Formation[];
  canManage: boolean; saving: boolean; openSceneId: string; setOpenSceneId: (id: string) => void;
  formSel: Record<string, string>; setFormSel: (fn: (prev: Record<string, string>) => Record<string, string>) => void;
  framesOn: Record<string, string[]>; setFramesOn: (fn: (prev: Record<string, string[]>) => Record<string, string[]>) => void;
  sceneNote: { sceneId: string; text: string } | null; supLocal: string | null;
  onPick: (id: string) => void; onPublish: () => void; onRepublish: () => void; onExecute: () => void; onCancel: () => void; onReopen: () => void;
  onToggleScene: (scene: DScene) => void; onTogglePosition: (position: DPosition) => void; onSaveFormation: (scene: DScene, slots: SlotView[]) => void; onApplyToday: (formation: Formation) => void;
}) {
  const { role, review, me, date, loading, todayBooks, book, source, diffs, hasLiveChanges, charactersToday, characterNames, formations, canManage, saving } = props;
  const isMem = role === "mem", isDir = role === "dir", isAdm = role === "adm";
  const subs = useMemo(() => new Map(diffs.filter((d) => d.hoje !== "fora do dia" && d.hoje !== "em aberto" && d.padrao !== "posição do padrão").map((d) => [d.where, d.padrao])), [diffs]);
  const whyByWhere = useMemo(() => new Map(diffs.map((d) => [d.where, d.why])), [diffs]);

  const dia = {
    title: isMem ? longDate(date) : `${longDate(date)} — shows da casa`,
    sub: isMem
      ? (todayBooks.length === 1 ? "1 show em que você entra hoje" : `${todayBooks.length} shows em que você entra hoje`)
      : (todayBooks.length === 1 ? "1 show na agenda de hoje" : `${todayBooks.length} shows na agenda de hoje, cada um com o seu livro`) + (props.supLocal ? ` · só ${sampleLocalName(props.supLocal)}, o seu escopo` : ""),
    rel: isMem
      ? "Sua escala diz que você trabalha, em que horário e onde. O livro diz o que você faz dentro do show: em que cena entra e em que posição. É a mesma convocação, vista de dois jeitos — não são duas listas para conferir."
      : "Quem entra em cada show sai do Livro do Show (titular primeiro, depois o rodízio), sem quem está de folga. A Escala mostra isso por pessoa e horário; o livro, por personagem e posição. Trocar alguém na Escala troca a vaga aqui também. O livro é publicado junto com a Escala do dia.",
  };

  const header = <div style={css("flex:none;display:flex;flex-direction:column;gap:8px")}>
    <div style={css("display:flex;align-items:baseline;gap:10px;flex-wrap:wrap")}>
      <span style={css("font-family:Outfit,sans-serif;font-size:17px;font-weight:600")}>{dia.title}</span>
      <span style={css("font-size:12px;color:#6b6482")}>{loading ? "carregando os shows de hoje…" : dia.sub}</span>
    </div>
    {!loading && todayBooks.length > 0 && <div style={css("display:flex;gap:9px;flex-wrap:wrap")}>
      {todayBooks.map((b) => {
        const on = b.id === book?.id;
        const e = estOf(b.status);
        const n = convocadosOf(b).size || (review ? sampleCharactersToday(b.showTitle ?? "").length : 0);
        return <button key={b.id} type="button" className="ldd-shrink" onClick={() => props.onPick(b.id)}
          style={css(`display:flex;flex-direction:column;gap:4px;padding:11px 14px;min-width:246px;border-radius:13px;border:1px solid ${on ? "#6C2BF2" : "#e6e1f2"};background:${on ? "#f6f1ff" : "#fff"};cursor:pointer;font-family:Manrope,sans-serif`)}>
          <div style={css("display:flex;align-items:center;gap:9px")}>
            <span style={css(`font-family:'JetBrains Mono',monospace;font-size:14px;font-weight:700;color:${on ? "#6C2BF2" : "#1b1630"}`)}>{time(b.sessionBlocks?.find((s) => !s.isRemoved)?.startTime)}</span>
            <span style={css(`font-size:9.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${EST[e].tone};background:${EST[e].tone}1f;padding:2px 7px;border-radius:999px`)}>{EST[e].label}</span>
          </div>
          <span style={css("font-size:13px;font-weight:700;text-align:left")}>{b.showTitle ?? b.eventTitle}</span>
          <span style={css("font-size:11.5px;color:#6b6482;text-align:left")}>{b.operationName}{n ? ` · ${plural(n, "convocado", "convocados")}` : ""}</span>
        </button>;
      })}
    </div>}
    {!loading && !todayBooks.length && <div style={css(DASHED_NOTE)}>{isMem ? "A escala de hoje ainda não foi publicada — nada foi convocado, então não há livro seu para abrir." : "Nenhum show da casa hoje no seu escopo."}</div>}
    <div style={css("display:flex;flex-direction:column;gap:4px;padding:12px 14px;border:1px dashed #d8cff0;border-radius:13px;background:#fbfaff;margin-top:2px")}>
      <span style={css(MONO_LABEL)}>Isto e a Escala são a mesma escalação</span>
      <span style={css("font-size:12.5px;line-height:1.55;color:#5b5473;max-width:98ch;text-wrap:pretty")}>{dia.rel}</span>
    </div>
  </div>;

  if (!book) return header;

  const kind: ShowKind = source?.kind ?? "mix";
  const soPers = kind === "pers";
  const e = estOf(book.status);
  const locked = e === "exec" || e === "canc";
  const canEdit = canManage && editableStatus(book.status);
  const scenes = (book.scenes ?? []).slice().sort((a, b) => a.order - b.order);
  const slotsByScene = new Map(scenes.map((s) => [s.id, slotsOf(s, source, subs, characterNames)]));
  const liveScenes = scenes.filter((s) => !s.isRemoved);
  const liveSlotsAll = liveScenes.flatMap((s) => (slotsByScene.get(s.id) ?? []).filter((x) => !x.out));
  const nConv = new Set(liveSlotsAll.flatMap((s) => s.who ? s.who.split(", ") : [])).size;
  const nSubs = liveSlotsAll.filter((s) => s.sub).length;
  const nVagas = liveSlotsAll.filter((s) => !s.who).length;
  const removedScenes = scenes.filter((s) => s.isRemoved);
  const removedPositions = scenes.filter((s) => !s.isRemoved).flatMap((s) => (slotsByScene.get(s.id) ?? []).filter((x) => x.position.isRemoved).map((x) => ({ scene: s, slot: x })));
  const nRem = removedScenes.length + removedPositions.length;
  const statCell = (last: boolean) => `flex:1;min-width:120px;display:flex;flex-direction:column;gap:2px;padding:12px 16px;border-right:${last ? "none" : "1px solid #f0ecf9"}`;
  const persTit = charactersToday.filter((p) => p.why.startsWith("titular")).length;
  const persRod = charactersToday.filter((p) => p.why.startsWith("rodízio")).length;
  const persVazio = charactersToday.filter((p) => !p.selectedName).length;
  const stats = soPers
    ? [
        { n: String(charactersToday.length), label: charactersToday.length === 1 ? "personagem hoje" : "personagens hoje", tone: "#6C2BF2" },
        { n: String(persTit), label: persTit === 1 ? "pelo titular" : "pelos titulares", tone: "#1b1630" },
        { n: String(persRod), label: persRod === 1 ? "entrou por rodízio" : "entraram por rodízio", tone: persRod ? "#0E8F86" : "#6b6482" },
        { n: String(persVazio), label: "sem ninguém definido", tone: persVazio ? "#B06E00" : "#6b6482" },
      ]
    : isMem
      // Elenco: o que interessa a quem está no show — sem contagem de gestão.
      ? [
          { n: String(nConv), label: nConv === 1 ? "pessoa no show hoje" : "pessoas no show hoje", tone: "#6C2BF2" },
          { n: String(liveScenes.length), label: liveScenes.length === 1 ? "cena hoje" : "cenas hoje", tone: "#1b1630" },
        ]
      : [
        { n: String(nConv), label: nConv === 1 ? "convocado hoje" : "convocados hoje", tone: "#6C2BF2" },
        { n: `${liveScenes.length}/${scenes.length}`, label: liveScenes.length === scenes.length ? "cenas mantidas" : "cenas mantidas (há cena tirada hoje)", tone: "#1b1630" },
        { n: String(nSubs), label: nSubs === 1 ? "entrou no lugar de alguém" : "entraram no lugar de alguém", tone: nSubs ? "#0E8F86" : "#6b6482" },
        { n: String(nVagas), label: nVagas === 1 ? "posição em aberto" : "posições em aberto", tone: nVagas ? "#B06E00" : "#6b6482" },
        { n: String(nRem), label: nRem === 1 ? "removido, reversível" : "removidos, reversíveis", tone: nRem ? "#a12c2c" : "#6b6482" },
      ];

  const firstSession = book.sessionBlocks?.filter((s) => !s.isRemoved).sort((a, b) => a.order - b.order)[0];
  // A publicação é sempre do conjunto do local: Escala + todos os Livros do
  // Dia preparados. Esta tela revisa o rascunho, mas não oferece atalho para
  // publicar um único show e deixar o restante do dia inconsistente.
  const showPublicar = false;
  const execLabel = e === "pub" ? "Marcar como executado" : e === "rasc" ? "Marcar que não ocorreu" : "Reabrir como rascunho";
  const showExec = canManage && (e === "pub" || isAdm);
  const actionHint = isMem
    ? "Você está na convocação deste show. Seu nome aparece destacado nas cenas."
    : isDir
      ? "Direção lê. Ajustar e publicar é de quem opera o show."
      : locked
        ? isAdm ? "Dia fechado. Para corrigir algo, reabra como rascunho — fica registrado." : "Dia fechado. Reabrir é da Administração — peça a ela e fica registrado quem reabriu."
        : e === "pub"
          ? "Já está com o elenco. Toda mudança depois disso republica e avisa quem foi convocado."
          : isAdm
            ? "Este Livro é revisado aqui e publicado junto com a Escala, no módulo Escalas. Show que não aconteceu: marque que não ocorreu, com o motivo."
            : "Este Livro é revisado aqui e publicado junto com a Escala. Show que não aconteceu só a Administração marca.";

  const tm = TIPO_META[kind];
  const sessions = (book.sessionBlocks ?? []).filter((s) => !s.isRemoved).sort((a, b) => a.order - b.order);
  const openScene = scenes.find((s) => s.id === props.openSceneId) ?? scenes[0];

  return <>
    {header}

    <div style={css(CARD)}>
      <div style={css("display:flex;align-items:flex-start;gap:14px;padding:15px 18px;flex-wrap:wrap")}>
        <div className="ldd-shrink" style={css("display:flex;flex-direction:column;gap:5px;flex:1;min-width:320px")}>
          <div style={css("display:flex;align-items:center;gap:9px;flex-wrap:wrap")}>
            <span style={css("font-family:Outfit,sans-serif;font-size:20px;font-weight:600")}>{book.showTitle ?? book.eventTitle}</span>
            <span style={css(estadoChip(e))}>{EST[e].label}</span>
          </div>
          <span style={css("font-size:13px;color:#5b5473")}>{[longDate(book.eventDate ?? date).toLocaleLowerCase("pt-BR"), firstSession ? time(firstSession.startTime) : "", book.operationName].filter(Boolean).join(" · ")}</span>
          {!isMem && <span style={css("font-size:11.5px;color:#6b6482;font-family:'JetBrains Mono',monospace")}>{`feito a partir do Livro do Show${source ? ` (versão ${source.version})` : ""}${book.eventTitle && book.eventTitle !== book.showTitle ? ` · evento de agenda ${book.eventTitle}` : ""}`}</span>}
        </div>
        <div className="ldd-actions" style={css("display:flex;flex-direction:column;gap:7px;align-items:flex-end")}>
          <div style={css("display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end")}>
            {showPublicar && <button type="button" className="ldd-hit" disabled={saving} onClick={e === "pub" ? props.onRepublish : props.onPublish} style={css(PRIMARY)}>{e === "pub" ? "Republicar com o ajuste" : "Publicar o dia"}</button>}
            {showExec && <button type="button" className="ldd-hit" disabled={saving} onClick={e === "pub" ? props.onExecute : e === "rasc" ? props.onCancel : props.onReopen} style={css(GHOST)}>{execLabel}</button>}
          </div>
          <span style={css("font-size:11.5px;color:#6b6482;max-width:44ch;text-align:right;line-height:1.45")}>{actionHint}</span>
        </div>
      </div>
      <div style={css("display:flex;flex-wrap:wrap;gap:0;border-top:1px solid #f0ecf9")}>
        {stats.map((s, i) => <div key={s.label} style={css(statCell(i === stats.length - 1))}>
          <span style={css(`font-family:'JetBrains Mono',monospace;font-size:19px;font-weight:700;color:${s.tone}`)}>{s.n}</span>
          <span style={css("font-size:11px;font-weight:600;color:#5b5473")}>{s.label}</span>
        </div>)}
      </div>
      {locked && <div style={css("padding:10px 16px;border-top:1px solid #f0ecf9;background:#f7f5fd;font-size:12px;color:#5b5473;line-height:1.5")}>
        {e === "exec" ? "Executado: o dia aconteceu assim. Cena, posição e substituição ficam como registro — nada mais se edita." : "Não ocorreu: o show não aconteceu. Quem marcou foi a Administração, com o motivo — fica no histórico e a agenda foi liberada."}
      </div>}
    </div>

    <div style={css(CARD)}>
      <div style={css("padding:14px 18px;border-bottom:1px solid #f0ecf9;display:flex;align-items:center;gap:12px;flex-wrap:wrap")}>
        <span style={css(`flex:none;font-family:'JetBrains Mono',monospace;font-size:9.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:6px 11px;border-radius:999px;white-space:nowrap;background:${tm[1]}1a;color:${tm[1]}`)}>{tm[0]}</span>
        <span style={css("display:flex;flex-direction:column;gap:2px;flex:1;min-width:220px")}>
          <span style={css("font-family:Outfit,sans-serif;font-size:15px;font-weight:600")}>{tm[2]}</span>
          <span style={css("font-size:11.5px;color:#6b6482;line-height:1.45;text-wrap:pretty")}>{tm[3]}</span>
        </span>
      </div>
      <div style={css("padding:14px 18px;display:flex;flex-wrap:wrap;gap:18px;align-items:flex-start")}>
        <div className="ldd-shrink" style={css("flex:1 1 300px;min-width:260px;display:flex;flex-direction:column;gap:9px")}>
          <span style={css(MONO_LABEL)}>sessões de hoje</span>
          {sessions.map((s, i) => {
            const chamada = source?.callTimes[time(s.startTime)];
            const aviso = s.stale ? s.staleReason : null;
            return <div key={s.id} style={css("display:flex;align-items:center;gap:12px;border-radius:12px;padding:11px 13px;min-height:44px;box-sizing:border-box;" + (aviso ? "background:#fff8f1;border:1px solid #f3ddc4;" : "background:#faf9fe;border:1px solid #e9e4f5;"))}>
              <span style={css("font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:700;color:#1b1630;flex:none")}>{`${time(s.startTime)} — ${time(s.endTime)}`}</span>
              <span style={css("flex:1;min-width:0;display:flex;flex-direction:column;gap:2px")}>
                <span style={css("font-size:13px;font-weight:600;line-height:1.25")}>{sessions.length === 1 ? "sessão única" : `${ORDINAL[i] ?? `${i + 1}ª`} sessão`}</span>
                {aviso && <span style={css("font-size:11.5px;color:#8f5409;line-height:1.4;text-wrap:pretty")}>{aviso}</span>}
              </span>
              {chamada && <span style={css("flex:none;font-size:11px;color:#6b6482;font-family:'JetBrains Mono',monospace")}>chamada {chamada}</span>}
            </div>;
          })}
          {!sessions.length && <span style={css("font-size:11.5px;color:#6b6482")}>Nenhuma sessão deste show cai hoje.</span>}
          <span style={css("font-size:11px;line-height:1.5;color:#6b6482;text-wrap:pretty")}>Uma formação para o dia inteiro. Se alguém falta só numa sessão, o aviso aparece nela e você ajusta à mão.</span>
        </div>
        <div className="ldd-shrink" style={css("flex:1 1 360px;min-width:300px;display:flex;flex-direction:column;gap:9px")}>
          <div style={css("display:flex;align-items:baseline;gap:9px;flex-wrap:wrap")}>
            <span style={css(MONO_LABEL + ";flex:1")}>quem faz cada personagem hoje</span>
            <span style={css("font-size:11.5px;color:#6b6482")}>{charactersToday.length ? plural(charactersToday.length, "personagem", "personagens") : "este show não usa personagens"}</span>
          </div>
          {charactersToday.map((p) => {
            const mine = isMem && samePerson(p.selectedName, me);
            return <div key={p.characterId} style={css("display:flex;align-items:center;gap:11px;flex-wrap:wrap;background:#fff;border:1px solid " + (mine ? "#f2d9e6" : "#e9e4f5") + ";border-radius:12px;padding:11px 13px;min-height:44px;box-sizing:border-box" + (mine ? ";background:#fdf6fa" : ""))}>
              <span style={css("width:9px;height:9px;border-radius:50%;flex:none;background:" + (p.why.includes("rodízio") ? "#C97A17" : "#6C2BF2"))}/>
              <span style={css("flex:1 1 120px;min-width:100px;font-size:13.5px;font-weight:700;line-height:1.25")}>{p.name}</span>
              <span style={css("flex:1 1 130px;min-width:110px;display:flex;flex-direction:column;gap:2px")}>
                <span style={css(`font-size:13px;font-weight:600;line-height:1.25${!p.selectedName ? ";color:#B06E00" : mine ? ";color:#C2508F;font-weight:700" : ""}`)}>{p.selectedName ?? "sem ninguém definido"}</span>
                <span style={css("font-size:11px;color:#6b6482;line-height:1.35;text-wrap:pretty")}>{mine ? `você · ${p.why}` : p.why}</span>
              </span>
            </div>;
          })}
          {charactersToday.length > 0 && <span style={css("font-size:11px;line-height:1.5;color:#6b6482;text-wrap:pretty")}>É quem está escalado neste Livro do Dia e cobre todas as sessões deste show hoje. Para trocar, use Ajustar na Escala.</span>}
        </div>
      </div>
    </div>

    {soPers && <div style={css("flex:none;border:1px dashed #d8cff0;border-radius:16px;background:#fbfaff;padding:15px 18px;display:flex;flex-direction:column;gap:5px")}>
      <span style={css("font-size:13.5px;font-weight:700")}>Este show é só de personagens — o livro do dia é esta lista</span>
      <span style={css("font-size:12.5px;line-height:1.55;color:#5b5473;max-width:92ch;text-wrap:pretty")}>Sem cena, sem mapa de palco e sem biblioteca de formações. O que existe é quem faz cada personagem hoje e o horário de chamada, quando houver. O botão de confirmar fecha o dia direto.</span>
    </div>}

    {!soPers && !scenes.length && <div style={css(DASHED_NOTE)}>Este Livro do Dia nasceu sem cenas — confira o Livro do Show de origem em 13 Shows.</div>}

    {!soPers && openScene && <div style={css("display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap")}>
      <div className="ldd-shrink" style={css("flex:0 0 268px;display:flex;flex-direction:column;gap:8px;min-width:240px")}>
        <span style={css(MONO_LABEL)}>Cenas de hoje</span>
        {scenes.map((c, i) => {
          const live = (slotsByScene.get(c.id) ?? []).filter((s) => !s.out);
          const on = c.id === openScene.id;
          const out = c.isRemoved;
          const nSub = live.filter((s) => s.sub).length;
          const nVago = live.filter((s) => !s.who).length;
          const mineHere = isMem && live.some((s) => s.who?.split(", ").some((w) => samePerson(w, me)));
          const tag = out ? "removida" : nVago ? plural(nVago, "vaga", "vagas") : nSub ? `${nSub} subst.` : "";
          const tagTone = out ? "#a12c2c" : nVago ? "#B06E00" : "#0E8F86";
          return <button key={c.id} type="button" onClick={() => props.setOpenSceneId(c.id)} aria-pressed={on}
            style={css(`display:flex;flex-direction:column;gap:3px;padding:10px 12px;border-radius:12px;border:1px solid ${on ? "#6C2BF2" : "#e6e1f2"};background:${on ? "#f6f1ff" : out ? "#fbfafd" : "#fff"};cursor:pointer;font-family:Manrope,sans-serif;opacity:${out ? ".62" : "1"};min-height:44px`)}>
            <div style={css("display:flex;align-items:baseline;gap:8px;width:100%")}>
              <span style={css("font-family:'JetBrains Mono',monospace;font-size:10px;color:#6b6482")}>{String(i + 1).padStart(2, "0")}</span>
              <span style={css("font-size:13.5px;font-weight:700;flex:1;text-align:left")}>{c.name}</span>
              {tag && <span style={css(`font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:${tagTone}`)}>{tag}</span>}
            </div>
            <span style={css("font-size:11px;color:#6b6482;text-align:left")}>{out ? "fora do dia" : plural(live.length, "posição", "posições") + (mineHere ? " · você entra" : "")}</span>
          </button>;
        })}
        <span style={css("font-size:11px;line-height:1.5;color:#6b6482;padding:2px 2px 0")}>{isMem ? "As cenas em que você entra vêm marcadas. O resto está aqui para você entender o show inteiro." : "Remover uma cena leva os blocos e as posições dela junto — e volta inteira se você restaurar."}</span>
      </div>

      <SceneMapColumn {...props} scene={openScene} slots={slotsByScene.get(openScene.id) ?? []}/>

      <div className="ldd-shrink" style={css("flex:1;min-width:280px;display:flex;flex-direction:column;gap:12px")}>
        <ScenePanel {...props} scene={openScene} slots={slotsByScene.get(openScene.id) ?? []} canEdit={canEdit} whyByWhere={whyByWhere}/>

        {!isMem && nRem > 0 && <div style={css("border:1px solid #f0e4d4;border-radius:16px;background:#fffdf9;padding:15px 17px;display:flex;flex-direction:column;gap:9px")}>
          <div style={css("display:flex;align-items:center;gap:10px;flex-wrap:wrap")}>
            <span style={css("font-family:Outfit,sans-serif;font-size:15px;font-weight:600")}>Removido hoje</span>
            <span style={css("font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:700;color:#8a6413;background:#fdf1dc;padding:2px 7px;border-radius:999px")}>{nRem}</span>
            <span style={css("flex:1")}/>
            <span style={css("font-size:11.5px;color:#6b6482")}>{locked ? "dia fechado — só registro" : "soft-delete: sai do dia, não do padrão"}</span>
          </div>
          {[...removedScenes.map((s) => ({ key: s.id, what: `Cena ${s.name} — e as posições dela`, why: whyByWhere.get(`${s.name} · ${(slotsByScene.get(s.id) ?? [])[0]?.label}`) ?? "Removida no ajuste do dia.", restore: () => props.onToggleScene(s) })),
            ...removedPositions.map(({ scene, slot }) => ({ key: slot.position.id, what: `Posição ${slot.label} · cena ${scene.name}`, why: whyByWhere.get(`${scene.name} · ${slot.label}`) ?? "Tirada no ajuste do dia.", restore: () => props.onTogglePosition(slot.position) }))]
            .map((r) => <div key={r.key} style={css("display:flex;align-items:center;gap:12px;padding:9px 11px;border:1px solid #f0e4d4;border-radius:11px;background:#fffdf9")}>
              <div style={css("display:flex;flex-direction:column;gap:2px;flex:1;min-width:0")}>
                <span style={css("font-size:12.5px;font-weight:700")}>{r.what}</span>
                <span style={css("font-size:11.5px;color:#6b6482")}>{r.why}</span>
              </div>
              {canEdit && <button type="button" className="ldd-hit" disabled={saving} onClick={r.restore} style={css("height:29px;padding:0 12px;border-radius:9px;border:1px solid #ddd6ee;background:#fff;color:#6C2BF2;font-size:11.5px;font-weight:700;font-family:Manrope,sans-serif;cursor:pointer;flex:none")}>restaurar</button>}
            </div>)}
          <span style={css("font-size:11.5px;line-height:1.5;color:#6b6482")}>Nada disso alterou o Livro do Show. O padrão continua com a cena e a posição no lugar.</span>
        </div>}
      </div>
    </div>}
  </>;
}

/** Palco e quadros-chave de uma cena do dia, vindos do Livro do Show (mapa-palco.js desenha). */
function sceneStage(source: ShowSource | null, scene: DScene) {
  const api = stageMapApi();
  const origin = source?.scenes.find((s) => s.id === scene.sourceSceneId);
  const format = origin?.stageFormat ?? source?.stageFormat ?? "NONE";
  const stage: StageDefinition | undefined = format !== "NONE" ? api?.STAGES[format] : undefined;
  const frames: Frame[] = origin?.frames.length ? origin.frames : [{ name: "Posição inicial", type: "inicial" }];
  return { api, stage, origin, frames };
}

/* ---------- coluna do mapa: encolhe até a largura do mapa (stage-map.css) ---------- */
function SceneMapColumn(props: Parameters<typeof HojeTab>[0] & { scene: DScene; slots: SlotView[] }) {
  const { scene, slots, role, me, source } = props;
  const { api, stage, frames } = sceneStage(source, scene);
  if (!api || !stage) return null;
  const out = scene.isRemoved;
  const live = slots.filter((s) => !s.out);
  const isMine = (s: SlotView) => role === "mem" && Boolean(s.who?.split(", ").some((w) => samePerson(w, me)));
  const mapsOn = (props.framesOn[scene.id] ?? [frames.find((f) => f.type === "inicial")?.name ?? frames[0].name]).filter((name) => frames.some((f) => f.name === name));
  return <div className="stage-map-column" style={{ ...css("display:flex;flex-direction:column;gap:9px"), "--stage-ratio": String(stage.ratio ?? 1) } as CSSProperties}>
    <span style={css(MONO_LABEL)}>Quadros desta cena</span>
    <div style={css("display:flex;gap:7px;flex-wrap:wrap")}>
      {frames.map((f) => {
        const on = mapsOn.includes(f.name);
        return <button key={f.name} type="button" className="ldd-hit" aria-pressed={on} onClick={() => props.setFramesOn((prev) => {
          const cur = [...mapsOn];
          const i = cur.indexOf(f.name);
          if (i >= 0) cur.splice(i, 1); else cur.push(f.name);
          return { ...prev, [scene.id]: cur };
        })} style={css(`display:flex;align-items:center;gap:7px;height:30px;padding:0 12px;border-radius:999px;font-family:Manrope,sans-serif;font-size:11.5px;font-weight:700;cursor:pointer;border:1px solid ${on ? "#0E8F86" : "#e6e1f2"};background:${on ? "#e6f5f3" : "#fff"};color:${on ? "#0E7F76" : "#6b6482"}`)}>
          <span style={css(`width:13px;height:13px;border-radius:4px;flex:none;display:flex;align-items:center;justify-content:center;font-size:9px;color:#fff;background:${on ? "#0E8F86" : "#d8d2e8"}`)} aria-hidden="true">{on ? "✓" : ""}</span>
          <span>{f.name}</span>
        </button>;
      })}
    </div>
    {mapsOn.map((name) => {
      const frame = frames.find((f) => f.name === name)!;
      const bySide: Record<StageSide, SlotView[]> = { BL: live.filter((s) => s.side === "BL"), BR: live.filter((s) => s.side === "BR"), PER: live.filter((s) => s.side === "PER") };
      const points = out ? [] : layoutFrame(api, stage, { BL: bySide.BL.map((s) => s.label), BR: bySide.BR.map((s) => s.label), PER: bySide.PER.map((s) => s.label) }, frame.type);
      const seen: Record<StageSide, number> = { BL: 0, BR: 0, PER: 0 };
      const fora = slots.length - points.length;
      return <div key={name} style={css("display:flex;flex-direction:column;gap:5px")}>
        <div style={css("display:flex;align-items:baseline;gap:8px")}>
          <span style={css("font-size:12px;font-weight:700;color:#3c3559")}>{name}</span>
          <span style={css("font-family:'JetBrains Mono',monospace;font-size:9.5px;color:#6b6482")}>{`${points.length} em cena${fora ? ` · ${fora} fora hoje` : ""}`}</span>
        </div>
        <StageMap stage={stage} label={`Mapa de palco · ${scene.name} · ${name}`}>
          {stage.zones.map(([label, x, y]) => {
            const edge = x <= 20 ? " edge-left" : x >= 80 ? " edge-right" : "";
            return <span className={`daily-stage-zone${edge}`} key={label} aria-hidden="true" style={{ ...css("position:absolute;transform:translate(-50%,-50%);font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:700;letter-spacing:.14em;color:#c4bcd8;white-space:nowrap;pointer-events:none;z-index:1"), left: `${x}%`, top: `${y}%` }}>{label}</span>;
          })}
          {points.map((mk) => {
            const s = bySide[mk.side][seen[mk.side]++];
            const isChar = mk.side === "PER";
            const size = isChar ? 28 : 24;
            const person = s?.who ?? "";
            const trocada = Boolean(s?.sub);
            const mine = s ? isMine(s) : false;
            const bg = isChar ? "#C2508F" : person ? "#6C2BF2" : "#fff";
            const fg = isChar || person ? "#fff" : "#B06E00";
            const ring = mine ? "border:2.5px solid #C2508F;box-shadow:0 0 0 4px #C2508F29;z-index:4;" : trocada ? "border:2.5px solid #F2C230;box-shadow:0 0 0 4px #F2C23029;z-index:3;" : person ? "border:1.5px solid rgba(255,255,255,.7);box-shadow:0 3px 8px -2px rgba(40,20,90,.4);z-index:2;" : "border:1.5px dashed #f0d8b0;z-index:2;";
            // O identificador do slot precisa sobreviver no mapa pequeno: "01" dos
            // dois lados deixa BL 01 e BR 01 indistinguíveis no celular.
            const shortLabel = (s?.label ?? mk.label).replace(/\s+/g, "");
            return <span className={`daily-stage-marker side-${mk.side.toLowerCase()}${isChar ? " is-character" : ""}`} key={`${mk.side}-${s?.position.id ?? mk.label}`} title={`${s?.label ?? mk.label}${s?.papel ? ` · ${s.papel}` : ""} · ${person || "vago"}`}
              style={{ ...css(`position:absolute;transform:translate(-50%,-50%);width:${size}px;height:${size}px;padding:0;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:Manrope,sans-serif;box-sizing:border-box;background:${bg};${ring}`), left: `${mk.x}%`, top: `${mk.y}%` }}>
              <span className="daily-stage-marker-label" style={css(`font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700;color:${fg}`)}>{shortLabel}</span>
              <span className="daily-stage-marker-person" style={css(`position:absolute;top:100%;margin-top:3px;font-size:9px;font-weight:700;white-space:nowrap;color:${mine ? "#C2508F" : trocada ? "#B4560B" : "#5b5473"}`)}>{person ? person.split(", ")[0].split(" ")[0] : "vago"}</span>
            </span>;
          })}
        </StageMap>
      </div>;
    })}
    {!mapsOn.length && <span style={css("font-size:11.5px;color:#B06E00;padding:10px 12px;border-radius:11px;background:#fdf7e8;border:1px solid #f0d9a8")}>Escolha ao menos um quadro acima para ver o mapa.</span>}
  </div>;
}

/* ---------- cena aberta: posições, formações e ações ---------- */
function ScenePanel(props: Parameters<typeof HojeTab>[0] & { scene: DScene; slots: SlotView[]; canEdit: boolean; whyByWhere: Map<string, string> }) {
  const { scene, slots, canEdit, role, me, source, formations, saving } = props;
  const isMem = role === "mem";
  const out = scene.isRemoved;
  const { api, stage, origin } = sceneStage(source, scene);
  const live = slots.filter((s) => !s.out);
  const vivos = live.length;
  const isMine = (s: SlotView) => isMem && Boolean(s.who?.split(", ").some((w) => samePerson(w, me)));

  const slotBox = (s: SlotView) => {
    const mine = isMine(s);
    const vago = !s.who;
    const tone = s.out ? "#a12c2c" : mine ? "#C2508F" : vago ? "#B06E00" : s.sub ? "#0E8F86" : "#6C2BF2";
    const note = s.out ? "fora do dia" : s.sub ? `no lugar de ${s.sub}` : s.papel ? s.papel : mine ? "você" : "";
    return <div key={s.position.id} style={css(`display:flex;align-items:center;gap:9px;padding:8px 10px;border:1px solid ${s.out ? "#f0dede" : mine ? "#f2d9e6" : "#e6e1f2"};border-radius:11px;background:${s.out ? "#fdf8f8" : mine ? "#fdf6fa" : "#fff"};min-width:172px;max-width:214px`)}>
      <span style={css(`font-family:'JetBrains Mono',monospace;font-size:11.5px;font-weight:700;color:${tone};background:${tone}18;min-width:24px;text-align:center;padding:3px 5px;border-radius:7px;flex:none;white-space:nowrap`)}>{s.label}</span>
      <div style={css("display:flex;flex-direction:column;gap:2px;min-width:0;flex:1")}>
        <span style={css(`font-size:12.5px;font-weight:${mine ? 700 : 600};color:${vago ? "#B06E00" : mine ? "#C2508F" : "#1b1630"};white-space:nowrap;overflow:hidden;text-overflow:ellipsis${s.out ? ";text-decoration:line-through" : ""}`)}>{s.who ?? "sem titular"}</span>
        {note && <span style={css(`font-size:10.5px;color:${s.out ? "#a12c2c" : s.sub ? "#0E8F86" : mine ? "#C2508F" : "#6b6482"}`)}>{note}</span>}
      </div>
      {canEdit && !out && <button type="button" className="ldd-hit" disabled={saving} onClick={() => props.onTogglePosition(s.position)} title={s.out ? "restaurar esta posição no dia" : "tirar esta posição do dia"} aria-label={`${s.out ? "Restaurar" : "Tirar"} ${s.label} do dia`}
        style={css("border:none;background:transparent;color:#6b6482;font-size:14px;line-height:1;cursor:pointer;padding:2px 4px;flex:none")}>{s.out ? "↺" : "×"}</button>}
    </div>;
  };
  const groups = [
    { title: "Bloco esquerdo", slots: slots.filter((s) => s.side === "BL") },
    { title: "Bloco direito", slots: slots.filter((s) => s.side === "BR") },
    { title: "Papéis nomeados", slots: slots.filter((s) => s.side === "PER") },
  ].filter((g) => g.slots.length);

  // Formações desta cena: a do padrão (Livro do Show) e as da biblioteca guardadas para esta cena.
  const patternCount = origin?.slots.length ?? slots.length;
  const forms = [{ id: "__padrao", name: "Formação do padrão", n: patternCount, formation: null as Formation | null },
    ...formations.filter((f) => f.active && f.sceneId && f.sceneId === scene.sourceSceneId).sort((a, b) => b.peopleCount - a.peopleCount).map((f) => ({ id: f.id, name: f.name, n: f.peopleCount, formation: f as Formation | null }))];
  const suggested = forms.reduce((best, f) => Math.abs(f.n - vivos) < Math.abs(best.n - vivos) ? f : best, forms[0]);
  const selected = forms.find((f) => f.id === props.formSel[scene.id]) ?? suggested;
  // Ajustada hoje: posição tirada, ou posições que não vieram do padrão (formação aplicada só hoje).
  const adjusted = slots.some((s) => s.position.isRemoved || !s.position.sourceRoleId);
  const note = props.sceneNote?.sceneId === scene.id ? props.sceneNote.text : "";

  return <div style={css("border:1px solid #e6e1f2;border-radius:16px;background:#fff;padding:16px 18px;display:flex;flex-direction:column;gap:14px")}>
    <div style={css("display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap")}>
      <div className="ldd-shrink" style={css("display:flex;flex-direction:column;gap:3px;flex:1;min-width:260px")}>
        <span style={css("font-family:Outfit,sans-serif;font-size:17px;font-weight:600")}>{scene.name}</span>
        <span style={css("font-size:12px;color:#6b6482")}>{`${plural(slots.length, "posição", "posições")} no padrão · posição inicial vinda do quadro-chave do Livro do Show`}</span>
      </div>
      {props.canEdit && <button type="button" className="ldd-hit" disabled={saving} onClick={() => props.onToggleScene(scene)}
        style={css(`height:32px;padding:0 13px;border-radius:10px;border:1px solid ${out ? "#cbe6e2" : "#f0dede"};background:#fff;color:${out ? "#0E8F86" : "#a12c2c"};font-size:12px;font-weight:700;font-family:Manrope,sans-serif;cursor:pointer;white-space:nowrap`)}>{out ? "Restaurar cena no dia" : "Tirar cena do dia"}</button>}
    </div>

    {out && <div style={css("display:flex;flex-direction:column;gap:3px;padding:11px 13px;border:1px solid #f0dede;border-radius:12px;background:#fdf7f7")}>
      <span style={css("font-size:12.5px;font-weight:700;color:#8a2f2f")}>Esta cena não vai rolar hoje</span>
      <span style={css("font-size:12px;line-height:1.5;color:#7a4f4f")}>Removida no ajuste do dia. O padrão segue intacto: amanhã ela nasce de novo.</span>
    </div>}

    {groups.map((g) => <div key={g.title} style={css("display:flex;flex-direction:column;gap:7px")}>
      <div style={css("display:flex;align-items:center;gap:8px")}>
        <span style={css(MONO_LABEL)}>{g.title}</span>
        <span style={css("flex:1;height:1px;background:#f0ecf9")}/>
      </div>
      <div style={css("display:flex;flex-wrap:wrap;gap:8px")}>{g.slots.map(slotBox)}</div>
    </div>)}

    {stage && api && <div style={css("display:flex;flex-direction:column;gap:9px;padding:13px 14px;border-radius:13px;border:1px dashed #ddd0fa;background:#fbf9ff")}>
      <>
        <div style={css("display:flex;align-items:baseline;gap:9px;flex-wrap:wrap")}>
          <span style={css("font-family:Outfit,sans-serif;font-size:14px;font-weight:600")}>Formações desta cena</span>
          <span style={css("font-size:11.5px;color:#6b6482")}>{`${vivos}${vivos === 1 ? " pessoa hoje" : " pessoas hoje"} · a ASA sugere a que serve`}</span>
        </div>
        <div style={css("display:flex;gap:8px;flex-wrap:wrap")}>
          {forms.map((f) => {
            const on = f.id === selected.id;
            return <button key={f.id} type="button" aria-pressed={on} onClick={props.canEdit ? () => props.setFormSel((prev) => ({ ...prev, [scene.id]: f.id })) : undefined}
              style={css(`display:flex;flex-direction:column;gap:2px;align-items:flex-start;padding:9px 12px;border-radius:11px;text-align:left;font-family:Manrope,sans-serif;cursor:${props.canEdit ? "pointer" : "default"};border:1px solid ${on ? "#6C2BF2" : "#e6e1f2"};background:${on ? "#f6f1ff" : "#fff"};min-height:44px;color:inherit`)}>
              <span style={css(`font-size:12.5px;font-weight:700;color:${on ? "#5B23C9" : "#1b1630"}`)}>{f.name}</span>
              <span style={css("font-family:'JetBrains Mono',monospace;font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:#6b6482")}>{f.id === "__padrao" ? "do padrão" : `${f.n} pessoas`}</span>
              {f.n === vivos && <span style={css("font-size:10px;font-weight:700;color:#0E8F86")}>serve para hoje</span>}
            </button>;
          })}
        </div>
        {props.canEdit && selected.formation && <div style={css("display:flex;align-items:center;gap:10px;flex-wrap:wrap")}>
          <button type="button" className="ldd-hit" disabled={saving} onClick={() => props.onApplyToday(selected.formation!)} style={css(PRIMARY)}>Aplicar só hoje</button>
          <span style={css("font-size:11.5px;line-height:1.5;color:#5b5473")}>{`${selected.name} vale só para ${longDate(props.book?.eventDate ?? props.date).toLocaleLowerCase("pt-BR")}. Quem já está num slot da formação continua nele; slot sem correspondência fica vago. O Livro do Show não muda.`}</span>
        </div>}
      </>
     {props.canEdit && adjusted && <button type="button" className="ldd-hit" disabled={saving} onClick={() => props.onSaveFormation(scene, slots)} style={css(SAVE_FORM)}>Guardar esta formação no padrão</button>}
      {note && <span style={css(NOTE_OK)}>{note}</span>}
    </div>}

    <span style={css("font-size:11px;line-height:1.5;color:#6b6482;border-top:1px solid #f0ecf9;padding-top:11px")}>O rótulo da posição é a identidade; quem faz é camada. Trocar a pessoa não redesenha o mapa.</span>
  </div>;
}

/* ---------- aba: diferenças do padrão ---------- */
function DiffTab({ diffs, hasBook }: { diffs: PatternDiffRow[]; hasBook: boolean }) {
  const head = "font-family:'JetBrains Mono',monospace;font-size:9.5px;letter-spacing:.13em;text-transform:uppercase;color:#6b6482";
  return <>
    <div style={css("display:flex;flex-direction:column;gap:4px")}>
      <span style={css("font-family:Outfit,sans-serif;font-size:18px;font-weight:600")}>O que hoje tem de diferente do padrão</span>
      <span style={css("font-size:12.5px;line-height:1.5;color:#5b5473;max-width:96ch;text-wrap:pretty")}>Cada linha é uma decisão tomada para esta data. À esquerda o que o Livro do Show manda; à direita o que vai acontecer. Nenhuma delas volta para o padrão.</span>
    </div>
    {!hasBook ? <div style={css(DASHED_NOTE)}>Nenhum show da casa hoje no seu escopo.</div> : !diffs.length ? <div style={css(DASHED_NOTE)}>Hoje é igual ao padrão: nenhuma cena, posição ou substituição diferente do Livro do Show.</div> :
      <div style={css("flex:none;border:1px solid #e6e1f2;border-radius:14px;background:#fff;overflow:hidden")}>
        <div className="ldd-diff-head" style={css("display:flex;padding:9px 14px;background:#fcfbfe;border-bottom:1px solid #ebe6f6")}>
          <span style={css("flex:0 0 118px;" + head)}>Onde</span>
          <span style={css("flex:1;" + head)}>No padrão</span>
          <span style={css("flex:1;" + head)}>Hoje</span>
          <span style={css("flex:0 0 190px;" + head)}>Por quê</span>
        </div>
        {diffs.map((d, i) => <div key={i} className="ldd-diff-row" style={css("display:flex;align-items:flex-start;gap:0;padding:12px 14px;border-bottom:1px solid #f4f1fb")}>
          <span style={css("flex:0 0 118px;font-size:11.5px;font-weight:700;color:#5b5473;padding-right:10px")}>{d.where}</span>
          <span style={css("flex:1;font-size:12.5px;color:#6b6482;padding-right:12px;text-decoration:line-through")}>{d.padrao}</span>
          <span style={css("flex:1;font-size:12.5px;font-weight:600;padding-right:12px")}>{d.hoje}</span>
          <span style={css("flex:0 0 190px;font-size:11.5px;line-height:1.45;color:#5b5473")}>{d.why}</span>
        </div>)}
      </div>}
    <div style={css("display:flex;gap:12px;flex-wrap:wrap;padding:13px 15px;border:1px dashed #d8cff0;border-radius:14px;background:#fbfaff")}>
      <span style={css("font-size:12.5px;line-height:1.55;color:#5b5473;max-width:92ch;text-wrap:pretty")}><strong>Quando uma diferença deixa de ser do dia.</strong> Se a mesma troca aparece três, quatro datas seguidas, ela não é ajuste — é o padrão que mudou. Aí alguém edita o Livro do Show em <strong>13 Shows</strong>, e os dias seguintes já nascem certos. A ASA avisa quando enxerga esse padrão.</span>
    </div>
  </>;
}

/* ---------- aba: biblioteca de formações (show → cena → quantidade) ---------- */
function FormacoesTab({ review, scopeLocal, currentShowId, currentFormations, canApplyToday, saving, onApplyToday }: { review: boolean; scopeLocal: string | null; currentShowId: string | null; currentFormations: Formation[]; canApplyToday: (f: Formation) => boolean; saving: boolean; onApplyToday: (f: Formation) => void }) {
  const [shows, setShows] = useState<ShowBookRow[]>([]);
  const [showId, setShowId] = useState("");
  const [sceneId, setSceneId] = useState("");
  const [query, setQuery] = useState("");
  const [cache, setCache] = useState<Record<string, { source: ShowSource | null; formations: Formation[] }>>({});
  const [error, setError] = useState("");

  useEffect(() => {
    if (review) {
      const rows = sampleShows
        .map((s, index) => ({ id: `sample-show-${index}`, title: s.nome, local: s.local, type: (s.tipo === "pers" ? "CHARACTERS_ONLY" : s.tipo === "form" ? "SIMPLE" : "COMPLETE") as ShowBookApi["type"], stageFormat: s.formato_palco as StageFormat }))
        .filter((s) => s.type !== "CHARACTERS_ONLY" && (!scopeLocal || s.local === scopeLocal));
      setShows(rows);
      setShowId((prev) => rows.some((s) => s.id === prev) ? prev : (currentShowId && rows.some((s) => s.id === currentShowId) ? currentShowId : rows[0]?.id || ""));
      return;
    }
    customFetch<{ showBooks: ShowBookRow[] }>("/api/show-books").then((r) => {
      const rows = r.showBooks.filter((s) => s.type !== "CHARACTERS_ONLY");
      setShows(rows); setShowId((prev) => prev || (currentShowId && rows.some((s) => s.id === currentShowId) ? currentShowId : rows[0]?.id) || "");
    }).catch(() => setError("Não consegui carregar os shows da biblioteca."));
  }, [review, scopeLocal, currentShowId]);

  useEffect(() => {
    if (!showId) return;
    if (review) {
      const index = Number(showId.replace("sample-show-", ""));
      setCache((prev) => ({ ...prev, [showId]: { source: sampleSourceFor(index), formations: loadReviewFormations(showId) } }));
      return;
    }
    Promise.all([
      customFetch<{ showBook: ShowBookApi }>(`/api/show-books/${showId}`).then((r) => sourceFromShowBook(r.showBook, {})).catch(() => null),
      customFetch<{ formations: Formation[] }>(`/api/formations/by-show/${showId}`).then((r) => r.formations).catch(() => [] as Formation[]),
    ]).then(([source, formations]) => setCache((prev) => ({ ...prev, [showId]: { source, formations } })));
  }, [showId, review, currentFormations]);

  const entry = cache[showId];
  const formations = (showId === currentShowId ? currentFormations : entry?.formations ?? []).filter((f) => f.active);
  const scenes = entry?.source?.scenes ?? [];
  const q = norm(query);
  const matches = (text: string) => !q || norm(text).includes(q);
  const visibleScenes = scenes.filter((s) => matches(s.name) || formations.some((f) => f.sceneId === s.id && matches(f.name)));
  const scene = visibleScenes.find((s) => s.id === sceneId) ?? visibleScenes[0];
  const api = stageMapApi();
  const showRow = shows.find((s) => s.id === showId);
  const stageFormat = scene?.stageFormat ?? entry?.source?.stageFormat ?? showRow?.stageFormat ?? "NONE";
  const stage = stageFormat !== "NONE" ? api?.STAGES[stageFormat] : undefined;
  const list = scene ? [
    { id: "__padrao", qtd: scene.slots.length, nome: "Formação do padrão", uso: "padrão do show · herdada do Livro do Show", padrao: true, sides: { BL: scene.slots.filter((s) => s.side === "BL").map((s) => s.label), BR: scene.slots.filter((s) => s.side === "BR").map((s) => s.label), PER: scene.slots.filter((s) => s.side === "PER").map((s) => s.label) }, formation: null as Formation | null },
    ...formations.filter((f) => f.sceneId === scene.id && (matches(f.name) || matches(scene.name))).sort((a, b) => b.peopleCount - a.peopleCount).map((f) => ({
      id: f.id, qtd: f.peopleCount, nome: f.name, padrao: false, formation: f as Formation | null, sides: formationSides(f.positions),
      uso: f.timesUsed ? `usada ${plural(f.timesUsed, "vez", "vezes")}${f.lastUsedAt ? `${f.timesUsed === 1 ? " · única, em " : " · última em "}${ddmm(f.lastUsedAt)}` : ""}` : "ainda não usada",
    })),
  ] : [];
  const qtdCount = new Map<number, number>();
  list.forEach((f) => qtdCount.set(f.qtd, (qtdCount.get(f.qtd) ?? 0) + 1));
  const hasDup = [...qtdCount.values()].some((n) => n > 1);
  const bibNavStyle = (on: boolean) => "display:flex;align-items:center;gap:10px;width:100%;min-height:44px;padding:0 12px;border-radius:11px;cursor:pointer;font-family:Manrope,sans-serif;border:none;text-align:left;" + (on ? "background:#f3ecfe;color:#5B23C9;" : "background:#fff;color:#2b2440;");

  return <>
    <div style={css("display:flex;flex-direction:column;gap:4px")}>
      <span style={css("font-family:Outfit,sans-serif;font-size:17px;font-weight:600")}>Biblioteca de formações</span>
      <span style={css("font-size:12.5px;line-height:1.55;color:#5b5473;max-width:98ch;text-wrap:pretty")}>Mora aqui, junto do dia, porque é aqui que você consulta enquanto resolve. A formação cheia vem do Livro do Show; as reduzidas nascem por repetição — quando uma quantidade se repete, o app reusa a que já existe, e quando é nova ela passa a existir depois que você resolve.</span>
    </div>
    {error && <div style={css(DASHED_NOTE)}>{error}</div>}
    <div style={css("border:1px solid #e6e1f2;border-radius:16px;background:#fff;overflow:hidden")}>
      <div style={css("padding:13px 16px;border-bottom:1px solid #f0ecf9;display:flex;align-items:center;gap:12px;flex-wrap:wrap")}>
        <span style={css(MONO_LABEL + ";flex:none")}>show → cena → quantidade</span>
        <span style={css("flex:1")}/>
        <input aria-label="Buscar cena ou formação" placeholder="Buscar cena ou formação" value={query} onChange={(e) => setQuery(e.target.value)}
          style={css("display:flex;align-items:center;min-height:40px;padding:0 13px;border:1.5px solid #ddd6ee;border-radius:11px;font-size:13px;color:#1b1630;flex:1 1 200px;max-width:300px;font-family:Manrope,sans-serif;box-sizing:border-box;min-height:44px")}/>
      </div>
      <div style={css("display:flex;flex-wrap:wrap")}>
        <div className="ldd-shrink" style={css("flex:0 1 250px;min-width:220px;border-right:1px solid #f0ecf9;padding:12px;display:flex;flex-direction:column;gap:5px")}>
          <span style={css("font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:#6b6482;padding:0 6px 4px")}>show</span>
          {shows.map((s) => {
            const n = cache[s.id]?.source?.scenes.length;
            return <button key={s.id} type="button" onClick={() => { setShowId(s.id); setSceneId(""); }} style={css(bibNavStyle(s.id === showId))}>
              <span style={css("flex:1;min-width:0;font-size:13px;font-weight:600")}>{s.title}</span>
              {n !== undefined && <span style={css("flex:none;font-size:11px;color:#6b6482")}>{plural(n, "cena", "cenas")}</span>}
            </button>;
          })}
        </div>
        <div className="ldd-shrink" style={css("flex:0 1 230px;min-width:200px;border-right:1px solid #f0ecf9;padding:12px;display:flex;flex-direction:column;gap:5px")}>
          <span style={css("font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:#6b6482;padding:0 6px 4px")}>cena</span>
          {visibleScenes.map((s) => <button key={s.id} type="button" onClick={() => setSceneId(s.id)} style={css(bibNavStyle(s.id === scene?.id))}>
            <span style={css("flex:1;min-width:0;font-size:13px;font-weight:600")}>{s.name}</span>
            <span style={css("flex:none;font-size:11px;color:#6b6482")}>{1 + formations.filter((f) => f.sceneId === s.id).length}</span>
          </button>)}
          {entry && !visibleScenes.length && <span style={css("font-size:11.5px;color:#6b6482;padding:0 6px")}>{scenes.length ? "Nenhuma cena com esta busca." : "Este show ainda não tem cenas no Livro do Show."}</span>}
        </div>
        <div className="ldd-shrink" style={css("flex:1 1 420px;min-width:360px;padding:14px 16px;background:#faf9fe;display:flex;flex-direction:column;gap:11px")}>
          <div style={css("display:flex;align-items:baseline;gap:10px;flex-wrap:wrap")}>
            <span style={css("font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:#6b6482;flex:1")}>{scene ? `${scene.name} · ${plural(list.length, "formação", "formações")}` : "formações"}</span>
            <span style={css("font-size:11.5px;color:#6b6482")}>da cheia para a menor</span>
          </div>
          {list.map((f) => <div key={f.id} style={css("background:#fff;border:1px solid #e9e4f5;border-radius:14px;padding:13px 15px;display:flex;flex-direction:column;gap:10px")}>
            <div style={css("display:flex;align-items:center;gap:12px;flex-wrap:wrap")}>
              <span style={css("flex:none;width:40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-family:Outfit,sans-serif;font-size:17px;font-weight:700;" + (f.padrao ? "background:#e3f4f1;color:#0a6f68;" : "background:#f3ecfe;color:#5B23C9;"))}>{f.qtd}</span>
              <span style={css("flex:1 1 170px;min-width:140px;display:flex;flex-direction:column;gap:2px")}>
                <span style={css("font-size:14px;font-weight:700;line-height:1.25")}>{f.nome}</span>
                <span style={css("font-size:11.5px;color:#6b6482;line-height:1.4")}>{f.uso}</span>
              </span>
              {(qtdCount.get(f.qtd) ?? 0) > 1 && <span style={css("flex:none;font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:5px 9px;border-radius:6px;background:#fdf3e4;color:#8f5409")}>{`duas para ${f.qtd}`}</span>}
              {f.formation && canApplyToday(f.formation) && <button type="button" className="ldd-hit" disabled={saving} onClick={() => onApplyToday(f.formation!)} style={css(PRIMARY)}>Aplicar só hoje</button>}
            </div>
            {stage && api && <div style={css("width:220px;max-width:100%")}>
              <StageMap stage={stage} thumb label={`Mapa da formação ${f.nome}`}>
                {layoutFrame(api, stage, f.sides, "inicial").map((mk, i) => <span key={i} aria-hidden="true" style={{ ...css(`position:absolute;transform:translate(-50%,-50%);width:10px;height:10px;border-radius:50%;background:${mk.side === "PER" ? "#C2508F" : "#6C2BF2"};border:1.5px solid rgba(255,255,255,.7);box-sizing:border-box`), left: `${mk.x}%`, top: `${mk.y}%` }}/>)}
              </StageMap>
            </div>}
          </div>)}
          {hasDup && <div style={css("background:#fff;border:1px dashed #ddd6ee;border-radius:13px;padding:13px 15px;display:flex;flex-direction:column;gap:5px")}>
            <span style={css("font-size:13px;font-weight:700")}>Duas formações para a mesma quantidade</span>
            <span style={css("font-size:12px;line-height:1.5;color:#5b5473;text-wrap:pretty")}>O app não escolhe: mostra as duas com o mapa e quantas vezes cada uma foi usada, e você decide.</span>
          </div>}
          {scene && list.length === 1 && <span style={css("font-size:11.5px;line-height:1.5;color:#6b6482")}>Só a formação do padrão por enquanto. As reduzidas aparecem aqui quando alguém guarda uma no Livro do Dia.</span>}
        </div>
      </div>
    </div>
  </>;
}

/* ---------- aba: livros ---------- */
function ListaTab({ isMem, books, me, review, filter, onFilter, onOpen }: { isMem: boolean; books: DailyBook[]; me: string; review: boolean; filter: "todos" | Est; onFilter: (v: "todos" | Est) => void; onOpen: (id: string) => void }) {
  const filtros: ["todos" | Est, string][] = [["todos", "Todos"], ["rasc", "Rascunho"], ["pub", "Publicado"], ["exec", "Executado"], ["canc", "Não ocorreu"]];
  const rows = books.filter((b) => filter === "todos" || estOf(b.status) === filter).sort((a, b) => (b.eventDate ?? "").localeCompare(a.eventDate ?? "") || time(a.sessionBlocks?.[0]?.startTime).localeCompare(time(b.sessionBlocks?.[0]?.startTime)));
  return <>
    <div style={css("display:flex;align-items:flex-end;gap:12px;flex-wrap:wrap")}>
      <div className="ldd-shrink" style={css("display:flex;flex-direction:column;gap:4px;flex:1;min-width:300px")}>
        <span style={css("font-family:Outfit,sans-serif;font-size:18px;font-weight:600")}>{isMem ? "Meus shows" : "Livros do dia"}</span>
        <span style={css("font-size:12.5px;line-height:1.5;color:#5b5473;max-width:96ch;text-wrap:pretty")}>{isMem ? "Só os dias em que você está na convocação. Show da casa em que você não entra não aparece aqui — nem publicado." : "Cada linha é uma data de um show. O estado diz o que se pode fazer: rascunho se ajusta, publicado se republica, executado e não ocorreu só se leem — e quem marca que não ocorreu é a Administração."}</span>
      </div>
      <div style={css("display:flex;gap:6px;flex-wrap:wrap")}>
        {filtros.map(([key, label]) => <button key={key} type="button" className="ldd-hit" aria-pressed={filter === key} onClick={() => onFilter(key)}
          style={css(`padding:6px 12px;border-radius:999px;border:1px solid ${filter === key ? "#6C2BF2" : "#e2ddf0"};background:${filter === key ? "#f3ecff" : "#fff"};color:${filter === key ? "#6C2BF2" : "#5b5473"};font-family:Manrope,sans-serif;font-size:12px;font-weight:${filter === key ? 700 : 500};cursor:pointer`)}>{label}</button>)}
      </div>
    </div>
    <div style={css("display:flex;flex-direction:column;gap:8px")}>
      {rows.map((b) => {
        const e = estOf(b.status);
        const n = convocadosOf(b).size;
        const meIn = [...convocadosOf(b)].some((name) => samePerson(name, me)) || (review && sampleCharactersToday(b.showTitle ?? "").some((c) => samePerson(c.selectedName, me)));
        return <button key={b.id} type="button" onClick={() => onOpen(b.id)} style={css("display:flex;align-items:center;gap:14px;padding:13px 15px;border:1px solid #e6e1f2;border-radius:13px;background:#fff;cursor:pointer;font-family:Manrope,sans-serif;text-align:left;flex-wrap:wrap")}>
          <div style={css("display:flex;flex-direction:column;gap:2px;flex:0 0 92px;text-align:left")}>
            <span style={css("font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:700;color:#6C2BF2")}>{shortDate(b.eventDate)}</span>
            <span style={css("font-family:'JetBrains Mono',monospace;font-size:11px;color:#6b6482")}>{time(b.sessionBlocks?.find((s) => !s.isRemoved)?.startTime)}</span>
          </div>
          <div style={css("display:flex;flex-direction:column;gap:3px;flex:1;min-width:0;text-align:left")}>
            <span style={css("font-size:14px;font-weight:700")}>{b.showTitle ?? b.eventTitle}</span>
            <span style={css("font-size:12px;color:#5b5473")}>{b.operationName}{n ? ` · ${plural(n, "convocado", "convocados")}` : ""}</span>
          </div>
          {meIn && <span style={css("font-size:10.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#C2508F;background:#C2508F1c;padding:3px 8px;border-radius:999px;flex:none")}>você entra</span>}
          <span style={css(estadoChip(e, ";flex:none;min-width:78px;text-align:center"))}>{EST[e].label}</span>
        </button>;
      })}
      {!rows.length && <div style={css(DASHED_NOTE)}>Nenhum Livro com este filtro. Tire ou troque o filtro para ver os outros.</div>}
    </div>
    <span style={css("font-size:11.5px;line-height:1.5;color:#6b6482;max-width:100ch")}>{isMem ? "Abrir um dia mostra as cenas com seu nome destacado. Você não edita nada aqui — se algo estiver errado, é ocorrência ou recado para quem coordena." : "Clicar num livro abre o dia dele no estado em que está."}</span>
  </>;
}

function ConflictBanner({ conflict, onReload }: { conflict: ConflictInfo; onReload: () => void }) {
  return <div role="alert" style={css("display:flex;align-items:flex-start;gap:10px;padding:11px 12px;background:#fff8f1;border:1px solid #f2d7bb;border-radius:14px;flex-wrap:wrap")}>
    <div style={css("display:flex;flex-direction:column;gap:4px;flex:1;min-width:0")}>
      <span style={css("font-size:12.5px;font-weight:700;color:#7d4a10")}>Alguém alterou este Livro do Dia depois que você o abriu</span>
      {conflict.changes.slice(0, 8).map((c, i) => <span key={i} style={css("font-size:12px;line-height:1.45;color:#7d4a10;text-wrap:pretty")}>{c.message ?? "Um campo mudou."}</span>)}
    </div>
    <button type="button" className="ldd-hit" onClick={onReload} style={css(PRIMARY)}>Recarregar antes de salvar</button>
  </div>;
}

function PromptDialog({ title, label, initial, onClose, onSubmit }: { title: string; label: string; initial?: string; onClose: () => void; onSubmit: (value: string) => void }) {
  const [value, setValue] = useState(initial ?? "");
  const submit = (event: FormEvent) => { event.preventDefault(); if (value.trim()) onSubmit(value.trim()); };
  return <div className="shows-dialog-backdrop"><div className="shows-dialog" role="dialog" aria-modal="true" aria-label={title}>
    <header className="shows-dialog-header"><h2>{title}</h2><button onClick={onClose} aria-label="Fechar"><X size={18}/></button></header>
    <div className="shows-dialog-content"><form id="ldd-prompt-form" onSubmit={submit} className="shows-form"><label>{label}<textarea required rows={label === "Motivo" ? 3 : 1} value={value} onChange={(e) => setValue(e.target.value)} autoFocus placeholder={label === "Motivo" ? "Fica registrado no histórico" : undefined}/></label></form></div>
    <footer className="shows-dialog-footer"><button form="ldd-prompt-form" className="shows-primary" disabled={!value.trim()}>Confirmar</button></footer>
  </div></div>;
}
