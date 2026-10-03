import { type CSSProperties, type FormEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, BookOpen, ChevronRight, Clock3, FileText, GripVertical, History, Link2, MessageSquareText, Pencil, Plus, Search, Sparkles, Star, UserRound, X } from "lucide-react";
import { customFetch } from "@workspace/api-client-react";
import { AsaEmptyState } from "@/components/AsaEmptyState";
import { StageMap } from "@/components/stage-map";
import exampleData from "../../../../design_handoff_my_asa/dados-de-exemplo.json";
import "./shows.css";

type Tab = "shows" | "characters";
type Location = { id: string; name: string; closed?: boolean };
type Area = { id: string; name: string };
type ShowType = "COMPLETE" | "CHARACTERS_ONLY" | "SIMPLE" | "STRUCTURED";
type Session = { id: string; startTime: string; endTime: string; callTime?: string | null; active?: boolean; validFrom?: string | null; validTo?: string | null };
type StageFormat = "L" | "RET" | "QUAD" | "NONE";
type MarkerColor = "purple" | "blue" | "green" | "yellow" | "red" | "pink";
const markerPalette: Record<MarkerColor, { label: string; value: string }> = {
  purple: { label: "Roxo", value: "#6C2BF2" }, blue: { label: "Azul", value: "#2563EB" }, green: { label: "Verde", value: "#16A34A" }, yellow: { label: "Amarelo", value: "#D97706" }, red: { label: "Vermelho", value: "#DC2626" }, pink: { label: "Rosa", value: "#C2508F" },
};
type Show = { id: string; operationId: string; locationId?: string | null; locationName?: string; title: string; description?: string | null; details?: Record<string, string>; responsibleName?: string | null; responsibleId?: string | null; updatedAt?: string; status: "DRAFT" | "PUBLISHED" | "ARCHIVED"; type: ShowType; usesCharacters?: boolean; stageFormat?: StageFormat; version: number };
type Position = { id: string; name: string; minimumCoverage: number; order: number; positionJson?: Record<string, unknown>; lines?: { id: string; type: string; characterId?: string | null; config?: unknown }[] };
type Keyframe = { id: string; order: number; name: string; type?: "inicial" | "splice" | "locacao" | "saida" | null; moment?: string | null; markerPositions?: Record<string, { x: number; y: number }> };
type Scene = { id: string; name: string; order: number; isOptional: boolean; stageFormat?: StageFormat; keyframes?: Keyframe[]; blocks: { id: string; name: string; order: number; zone?: string | null; prefix?: string | null; color?: MarkerColor | null; positions: Position[] }[] };
type ShowTree = Show & { scenes: Scene[] };
type CastMember = { id: string; personId?: string; personName: string; order: number; timesDone: number };
type Character = { id: string; name: string; locationId: string; locationName?: string; mode: "titular" | "rodizio"; cast?: CastMember[]; shows?: { title: string; sessions: Session[] }[] };
type PersonOption = { id: string; displayName?: string; nomeDeExibicao?: string; name?: string; nomeCompleto?: string; fullName?: string; areaId?: string | null; /** Campo legado: não é usado para definir a lotação da pessoa. */ defaultLocationId?: string | null; areaName?: string | null; locationName?: string | null; profile?: string; isCharacterEligible?: boolean };
type DriveLink = { id: string; title: string; type: string; scope: string; note?: string; state?: string; url?: string | null; order?: number };
type Version = { id: string; version: number; reason?: string; changeType?: string; createdAt?: string };

const apiType = (kind: string): ShowType => kind === "pers" ? "CHARACTERS_ONLY" : kind === "form" ? "SIMPLE" : "COMPLETE";
const typeUsesCharacters = (type: ShowType) => type === "COMPLETE" || type === "CHARACTERS_ONLY";
const personName = (person: PersonOption) => person.displayName ?? person.nomeDeExibicao ?? person.name ?? person.nomeCompleto ?? person.fullName ?? "Pessoa";
// Cartão do show (desenho 13): quem responde e quando mudou.
const responsibleOf = (show: Show, people: PersonOption[]) => {
  if (show.responsibleName) return show.responsibleName;
  const person = show.responsibleId ? people.find((candidate) => candidate.id === show.responsibleId) : undefined;
  return person ? personName(person) : null;
};
const updatedLabel = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "numeric", month: "short", timeZone: "America/Sao_Paulo" });
const time = (value: string | null | undefined) => value ? value.slice(0, 5) : "—";
const isStageCastArea = (person: PersonOption) => ["Patinadores", "Bailarinos"].includes(person.areaName ?? "");
const prefixForGroup = (name: string) => {
  const normalized = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
  if (normalized === "BACKSTAGE LEFT") return "BL";
  if (normalized === "BACKSTAGE RIGHT") return "BR";
  if (normalized === "PAPEIS NOMEADOS") return "PER";
  const words = normalized.split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words.map((word) => word[0]).join("") : normalized.slice(0, 2) || "GR").slice(0, 4);
};
/** A ordem persistida é a fonte de verdade; o índice original desempata dados legados sem alterá-los. */
const orderQueue = (queue: CastMember[]) => queue
  .map((member, index) => ({ member: { ...member, order: Number(member.order) }, index }))
  .sort((left, right) => left.member.order - right.member.order || left.index - right.index)
  .map(({ member }) => member);
const sameQueue = (left: CastMember[], right: CastMember[]) => left.length === right.length && left.every((member, index) => member.id === right[index]?.id && member.personId === right[index]?.personId && member.order === right[index]?.order && member.timesDone === right[index]?.timesDone);
const statusLabel = (status: Show["status"]) => status === "PUBLISHED" ? "Publicado" : status === "ARCHIVED" ? "Arquivado" : "Rascunho";
const statusTone = (status: Show["status"]) => status === "PUBLISHED" ? "good" : status === "ARCHIVED" ? "neutral" : "warn";
const typeLabel = (type: ShowType) => type === "CHARACTERS_ONLY" ? "Só personagens" : type === "SIMPLE" ? "Formação" : "Completo";
const byName = <T extends { nome_de_exibicao?: string; name?: string }>(list: T[], name: string) => list.find((item) => (item.nome_de_exibicao ?? item.name) === name);

/** Amostra oficial: a UI deriva pessoas, shows, sessões e filas deste arquivo. */
const sampleLocations: Location[] = exampleData.locais.map((item) => ({ id: item.id, name: item.nome }));
const sampleAreas: Area[] = exampleData.areas.map((item) => ({ id: item.id, name: item.nome }));
const samplePeople: PersonOption[] = exampleData.pessoas.map((person) => ({ id: `sample-${person.nome_de_exibicao}`, displayName: person.nome_de_exibicao, nomeCompleto: person.nome_completo, profile: person.perfil, isCharacterEligible: person.perfil === "MEM", areaId: person.area, areaName: sampleAreas.find((area) => area.id === person.area)?.name ?? null }));
const sampleShows: Show[] = exampleData.shows.map((show, index) => {
  const type = apiType(show.tipo);
  return { id: `sample-show-${index}`, operationId: `sample-${show.local}`, locationId: show.local, locationName: sampleLocations.find((location) => location.id === show.local)?.name, title: show.nome, description: show.descricao, responsibleName: show.responsavel, status: "PUBLISHED", type, usesCharacters: typeUsesCharacters(type), stageFormat: show.formato_palco as StageFormat, version: 1 };
});
const sessionsForSampleShow = (title: string): Session[] => (exampleData.shows.find((show) => show.nome === title)?.sessoes ?? []).map((session, index) => ({ id: `sample-session-${title}-${index}`, startTime: session.inicio, endTime: session.fim, callTime: session.chamada, active: true }));
const sampleShowByTitle = new Map(sampleShows.map((show) => [show.title, show]));
const sampleCharacters: Character[] = exampleData.personagens.map((character) => ({ id: `sample-character-${character.nome}`, name: character.nome, locationId: character.local, locationName: sampleLocations.find((location) => location.id === character.local)?.name, mode: character.modo as Character["mode"], cast: character.fila.map((member, order) => ({ id: `sample-cast-${character.nome}-${order}`, personId: samplePeople.find((person) => personName(person) === member.pessoa)?.id, personName: member.pessoa, order, timesDone: "vezes" in member ? member.vezes : 0 })), shows: character.shows.filter((title) => typeUsesCharacters(sampleShowByTitle.get(title)?.type ?? "SIMPLE")).map((title) => ({ title, sessions: sessionsForSampleShow(title) })) }));
const sampleMusicalBlock = exampleData.blocos_por_local.snowland.find((block) => block === "MUSICAL")!;
const sampleTree = (show: Show): ShowTree => ({ ...show, scenes: show.title === "Musical do Natal" ? [{ id: "sample-scene-musical", name: sampleMusicalBlock, order: 1, isOptional: false, stageFormat: show.stageFormat, blocks: [{ id: "sample-block-musical", name: sampleMusicalBlock, order: 1, positions: (exampleData.personagens.filter((character) => character.shows.includes(show.title)).map((character, index) => ({ id: `sample-position-${character.nome}`, name: character.nome, minimumCoverage: 1, order: index + 1, lines: [{ id: `sample-line-${character.nome}`, type: "CHARACTER", characterId: `sample-character-${character.nome}` }] }))) }] }] : [] });
const sampleLinks = (showTitle: string): DriveLink[] => [
  { id: "drive-main", title: `Pasta do show — ${showTitle}`, type: "pasta principal", scope: "show", note: "Acervo do show no Drive", order: 0 },
];

type ReviewShowPatch = { description?: string; details?: Record<string, string>; links?: DriveLink[]; sessions?: Session[]; slotCasts?: Record<string, SlotCast>; groupColors?: Record<string, MarkerColor>; slotColors?: Record<string, MarkerColor> };
const reviewShowsKey = "myasa-review-created-shows";
const reviewPatchesKey = "myasa-review-show-patches";
const parseReviewValue = <T,>(key: string, fallback: T): T => {
  try { return JSON.parse(window.sessionStorage.getItem(key) ?? "") as T; } catch { return fallback; }
};
const reviewShows = () => parseReviewValue<Show[]>(reviewShowsKey, []);
const saveReviewShows = (shows: Show[]) => window.sessionStorage.setItem(reviewShowsKey, JSON.stringify(shows));
const reviewPatches = () => parseReviewValue<Record<string, ReviewShowPatch>>(reviewPatchesKey, {});
const reviewPatchFor = (showId: string) => reviewPatches()[showId] ?? {};
const updateReviewPatch = (showId: string, patch: Partial<ReviewShowPatch>) => {
  const current = reviewPatches();
  window.sessionStorage.setItem(reviewPatchesKey, JSON.stringify({ ...current, [showId]: { ...current[showId], ...patch } }));
};

export default function ShowsPage({ canManage, onlyPublished = false }: { canManage: boolean; onlyPublished?: boolean }) {
  // Elenco lê a estante: só shows publicados. Na API o servidor já filtra (e mantém o rascunho delegado ao capitão); aqui vale para a amostra.
  const forReader = (list: Show[]) => onlyPublished ? list.filter((show) => show.status === "PUBLISHED") : list;
  const sampleRequested = new URLSearchParams(window.location.search).get("amostra") === "1";
  if (sampleRequested) window.sessionStorage.setItem("myasa-review-sample", "1");
  const review = import.meta.env.DEV && (sampleRequested || window.sessionStorage.getItem("myasa-review-sample") === "1");
  const [tab, setTab] = useState<Tab>("shows"), [shows, setShows] = useState<Show[]>([]), [locations, setLocations] = useState<Location[]>([]), [areas, setAreas] = useState<Area[]>([]), [people, setPeople] = useState<PersonOption[]>([]), [characters, setCharacters] = useState<Character[]>([]);
  const [selected, setSelected] = useState<ShowTree | null>(null), [sessions, setSessions] = useState<Session[]>([]), [links, setLinks] = useState<DriveLink[]>([]), [versions, setVersions] = useState<Version[]>([]);
  const [query, setQuery] = useState(""), [locationFilter, setLocationFilter] = useState(""), [stateFilter, setStateFilter] = useState<"ALL" | Show["status"]>("ALL"), [favoritesOnly, setFavoritesOnly] = useState(false), [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => new Set());
  const [newShow, setNewShow] = useState(false), [newCharacter, setNewCharacter] = useState(false), [editing, setEditing] = useState<Character | null>(null), [newSession, setNewSession] = useState(false), [editingSession, setEditingSession] = useState<Session | null>(null), [newScene, setNewScene] = useState(false), [error, setError] = useState(""), [saving, setSaving] = useState(false);

  // D6: enquanto a primeira carga não volta, a lista diz "carregando", não "nenhum show".
  const [carregou, setCarregou] = useState(false);
  const hydrateCharacters = async (base: Character[]) => Promise.all(base.map(async (character) => {
    try { const result = await customFetch<{ cast: CastMember[] }>(`/api/characters/${character.id}/cast`); return { ...character, cast: result.cast }; } catch { return character; }
  }));
  const load = async () => { setError(""); if (review) { setShows(forReader([...sampleShows, ...reviewShows()])); setLocations(sampleLocations); setAreas(sampleAreas); setPeople(samplePeople); setCharacters(sampleCharacters); setCarregou(true); return; } try {
    const [bookResult, locationResult, areaResult, peopleResult, characterResult] = await Promise.all([
      customFetch<{ showBooks?: Show[]; books?: Show[] }>("/api/show-books"), customFetch<{ locations?: Location[] }>("/api/locations"), customFetch<{ areas?: Area[] }>("/api/areas").catch(() => ({ areas: [] })), customFetch<{ users?: PersonOption[] }>("/api/users").catch(() => ({ users: [] })), customFetch<{ characters?: Character[] }>("/api/characters").catch(() => ({ characters: [] })),
    ]);
    const fetchedAreas = areaResult.areas ?? [], fetchedLocations = locationResult.locations ?? [];
    const contextualPeople = (peopleResult.users ?? []).map((person) => ({ ...person, areaName: fetchedAreas.find((area) => area.id === person.areaId)?.name }));
    setShows(bookResult.showBooks ?? bookResult.books ?? []); setLocations(fetchedLocations); setAreas(fetchedAreas); setPeople(contextualPeople); setCharacters(await hydrateCharacters(characterResult.characters ?? []));
  } catch { setError("Não consegui carregar os shows agora."); } finally { setCarregou(true); } };
  useEffect(() => { void load(); }, [review]);
  const open = async (show: Show) => { setError(""); if (review) { const patch = reviewPatchFor(show.id); const tree = sampleTree(show); setSelected({ ...tree, description: patch.description ?? tree.description, details: patch.details ?? tree.details }); setSessions(patch.sessions ?? sessionsForSampleShow(show.title)); setLinks(patch.links ?? sampleLinks(show.title)); setVersions([{ id: "v1", version: 1, reason: "Livro oficial publicado", changeType: "CONFIG" }]); return; } try {
    const [bookResult, sessionResult, driveResult, versionsResult] = await Promise.all([customFetch<{ showBook: ShowTree }>(`/api/show-books/${show.id}`), customFetch<{ sessions: Session[] }>(`/api/show-books/${show.id}/sessions`), customFetch<{ links?: { id: string; label: string; url?: string | null; type: string; scope: string; order: number }[] }>(`/api/show-books/${show.id}/drive-links`).catch(() => ({ links: [] })), customFetch<{ versions?: Version[] }>(`/api/show-books/${show.id}/versions`).catch(() => ({ versions: [] }))]);
    setSelected(bookResult.showBook); setSessions(sessionResult.sessions); setLinks((driveResult.links ?? []).map((link) => ({ id: link.id, title: link.label, url: link.url, type: link.type, scope: link.scope, order: link.order }))); setVersions(versionsResult.versions ?? []);
  } catch { setError("Não consegui abrir este Livro do Show."); } };
  const filteredShows = useMemo(() => shows.filter((show) => (!locationFilter || show.locationId === locationFilter) && (stateFilter === "ALL" || show.status === stateFilter) && (!favoritesOnly || favoriteIds.has(show.id)) && (!query || show.title.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR")))), [shows, locationFilter, stateFilter, favoritesOnly, favoriteIds, query]);
  const filteredCharacters = useMemo(() => characters.filter((character) => (!locationFilter || character.locationId === locationFilter) && (!query || character.name.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR")))), [characters, locationFilter, query]);
  const createShow = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = new FormData(event.currentTarget); const type = form.get("type") as ShowType; setSaving(true); try {
    if (review) {
      const locationId = String(form.get("locationId") ?? ""), title = String(form.get("title") ?? "").trim();
      const show: Show = { id: `sample-created-${Date.now()}`, operationId: `sample-${locationId}`, locationId, locationName: sampleLocations.find((location) => location.id === locationId)?.name, title, status: "DRAFT", type, usesCharacters: typeUsesCharacters(type), stageFormat: type === "CHARACTERS_ONLY" ? "NONE" : "RET", version: 1 };
      saveReviewShows([...reviewShows(), show]); setShows((current) => [...current, show]); setSelected(sampleTree(show)); setSessions([]); setLinks([]); setVersions([]); setNewShow(false); return;
    }
    const result = await customFetch<{ showBook: Show }>("/api/show-books", { method: "POST", body: JSON.stringify({ title: form.get("title"), locationId: form.get("locationId"), type, usesCharacters: type !== "SIMPLE" }) });
    // O cadastro acabou de responder: abre o Livro imediatamente. A estante é
    // atualizada em segundo plano, sem fazer a pessoa esperar pelas cinco buscas
    // independentes que compõem a tela de lista.
    setNewShow(false); await open(result.showBook); void load();
  } catch { setError("Não consegui criar o show. Confira os campos e tente de novo."); } finally { setSaving(false); } };
  const addCharacter = async (name: string, locationId: string, mode: "titular" | "rodizio", queue: PersonOption[]) => { if (!queue.length) { setError("Escolha pelo menos uma pessoa para a fila."); return; } setSaving(true); try { const result = await customFetch<{ character: Character }>("/api/characters", { method: "POST", body: JSON.stringify({ name, locationId, mode }) }); for (const [order, person] of queue.entries()) await customFetch(`/api/characters/${result.character.id}/cast`, { method: "POST", body: JSON.stringify({ personId: person.id, order, timesDone: 0 }) }); setNewCharacter(false); await load(); } catch { setError("Não consegui criar o personagem. Confira os campos e a fila."); } finally { setSaving(false); } };
  const saveCharacter = async (character: Character, name: string, mode: "titular" | "rodizio", queue: CastMember[]) => { const original = orderQueue(character.cast ?? []); const next = orderQueue(queue); const queueChanged = !sameQueue(original, next); const characterChanged = character.name !== name || character.mode !== mode; if (!queueChanged && !characterChanged) { setEditing(null); return; } setSaving(true); try { if (characterChanged) await customFetch(`/api/characters/${character.id}`, { method: "PATCH", body: JSON.stringify({ name, mode }) }); if (queueChanged) await customFetch(`/api/characters/${character.id}/cast-order`, { method: "PUT", body: JSON.stringify({ queue: next.map((member) => ({ id: member.id.startsWith("draft-") ? undefined : member.id, personId: member.personId, timesDone: member.timesDone })) }) }); setEditing(null); await load(); } catch { setError("Não consegui salvar a fila do personagem."); } finally { setSaving(false); } };
  const addCharacterMember = async (character: Character, person: PersonOption) => { const current = orderQueue(character.cast ?? []); if (current.some((member) => member.personId === person.id)) return; const member: CastMember = { id: `draft-${person.id}`, personId: person.id, personName: personName(person), order: current.length, timesDone: 0 }; if (!review) await customFetch(`/api/characters/${character.id}/cast`, { method: "POST", body: JSON.stringify({ personId: person.id, order: current.length, timesDone: 0 }) }); setCharacters((items) => items.map((item) => item.id === character.id ? { ...item, cast: [...current, member] } : item)); };
  const removeCharacterMember = async (character: Character, member: CastMember) => { if (!window.confirm(`Remover ${member.personName} da fila de ${character.name}? O histórico será preservado.`)) return; if (!review) await customFetch(`/api/characters/${character.id}/cast/${member.id}`, { method: "DELETE" }); setCharacters((items) => items.map((item) => item.id === character.id ? { ...item, cast: orderQueue((item.cast ?? []).filter((entry) => entry.id !== member.id).map((entry, order) => ({ ...entry, order }))) } : item)); };
  const saveSession = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (!selected) return; const form = new FormData(event.currentTarget); const payload = { startTime: String(form.get("startTime") ?? ""), endTime: String(form.get("endTime") ?? ""), callTime: form.get("hasCall") === "on" ? String(form.get("callTime") ?? "") || null : null, validFrom: String(form.get("validFrom") ?? "") || null, validTo: String(form.get("validTo") ?? "") || null, active: form.get("active") === "on" }; setSaving(true); try { if (review) { const current = reviewPatchFor(selected.id).sessions ?? sessions; const next = editingSession ? current.map((item) => item.id === editingSession.id ? { ...item, ...payload } : item) : [...current, { id: `sample-session-${Date.now()}`, ...payload }]; setSessions(next); updateReviewPatch(selected.id, { sessions: next }); } else if (editingSession) { await customFetch(`/api/show-books/${selected.id}/sessions/${editingSession.id}`, { method: "PATCH", body: JSON.stringify(payload) }); await open(selected); } else { await customFetch(`/api/show-books/${selected.id}/sessions`, { method: "POST", body: JSON.stringify(payload) }); await open(selected); } setNewSession(false); setEditingSession(null); } catch { setError("Confira início, fim e vigência da sessão."); } finally { setSaving(false); } };
  const createScene = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (!selected) return; const form = new FormData(event.currentTarget); setSaving(true); try { if (review) { setSelected((current) => current ? { ...current, scenes: [...current.scenes, { id: `sample-scene-${Date.now()}`, name: String(form.get("name") ?? "Cena"), order: current.scenes.length + 1, isOptional: false, blocks: [] }] } : current); } else { await customFetch(`/api/show-books/${selected.id}/scenes`, { method: "POST", body: JSON.stringify({ name: form.get("name"), order: selected.scenes.length + 1, isOptional: false }) }); await open(selected); } setNewScene(false); } catch { setError("Não consegui adicionar a cena."); } finally { setSaving(false); } };
  const publishShow = async () => { if (!selected) return; if (review) { setSelected((current) => current ? { ...current, status: "PUBLISHED", version: current.version + 1 } : current); return; } const result = await customFetch<{ showBook: Show }>(`/api/show-books/${selected.id}/status`, { method: "PATCH", body: JSON.stringify({ status: "PUBLISHED", reason: "Publicação confirmada no Livro oficial" }) }); setSelected((current) => current ? { ...current, ...result.showBook } : current); };
  const saveDriveLink = async (draft: Omit<DriveLink, "id">, existing?: DriveLink) => { if (!selected) return; const payload = { label: draft.title, url: draft.url ?? null, type: draft.type, scope: draft.scope, order: draft.order ?? (existing?.order ?? links.length), reason: existing ? "Atalho do Drive atualizado" : "Atalho do Drive acrescentado" }; if (review) { const next = existing ? { ...existing, ...draft } : { ...draft, id: `sample-drive-${Date.now()}` }; const nextLinks = existing ? links.map((link) => link.id === existing.id ? next : link) : [...links, next]; setLinks(nextLinks); updateReviewPatch(selected.id, { links: nextLinks }); return; } const result = existing ? await customFetch<{ link: { id: string; label: string; url?: string | null; type: string; scope: string; order: number } }>(`/api/show-books/${selected.id}/drive-links/${existing.id}`, { method: "PATCH", body: JSON.stringify(payload) }) : await customFetch<{ link: { id: string; label: string; url?: string | null; type: string; scope: string; order: number } }>(`/api/show-books/${selected.id}/drive-links`, { method: "POST", body: JSON.stringify(payload) }); const persisted: DriveLink = { id: result.link.id, title: result.link.label, url: result.link.url, type: result.link.type, scope: result.link.scope, order: result.link.order }; setLinks((current) => existing ? current.map((link) => link.id === existing.id ? persisted : link) : [...current, persisted]); };
  const removeDriveLink = async (link: DriveLink) => { if (!selected || !window.confirm(`Remover o atalho “${link.title}”? O histórico será preservado.`)) return; if (!review) await customFetch(`/api/show-books/${selected.id}/drive-links/${link.id}`, { method: "DELETE", body: JSON.stringify({ reason: "Atalho do Drive removido" }) }); const nextLinks = links.filter((item) => item.id !== link.id); setLinks(nextLinks); if (review) updateReviewPatch(selected.id, { links: nextLinks }); };
  const reorderDriveLink = async (link: DriveLink, direction: -1 | 1) => { const from = links.findIndex((item) => item.id === link.id), to = from + direction; if (from < 0 || to < 0 || to >= links.length) return; const next = links.slice(); [next[from], next[to]] = [next[to]!, next[from]!]; const normalized = next.map((item, order) => ({ ...item, order })); setLinks(normalized); if (review && selected) { updateReviewPatch(selected.id, { links: normalized }); return; } if (selected) await Promise.all(normalized.filter((item) => item.id === link.id || item.id === next[from]?.id).map((item) => customFetch(`/api/show-books/${selected.id}/drive-links/${item.id}`, { method: "PATCH", body: JSON.stringify({ order: item.order, reason: "Ordem dos atalhos do Drive atualizada" }) }))); };
  const saveObservations = async (description: string) => { if (!selected) return; if (!review) await customFetch(`/api/show-books/${selected.id}`, { method: "PATCH", body: JSON.stringify({ description, reason: "Observações do show atualizadas" }) }); else updateReviewPatch(selected.id, { description }); setSelected((current) => current ? { ...current, description } : current); };
  const saveDetails = async (details: Record<string, string>) => { if (!selected) return; if (!review) await customFetch(`/api/show-books/${selected.id}`, { method: "PATCH", body: JSON.stringify({ details, reason: "Informações gerais do show atualizadas" }) }); else updateReviewPatch(selected.id, { details }); setSelected((current) => current ? { ...current, details } : current); };

  if (selected) return <section className="shows-page"><button className="shows-back" onClick={() => setSelected(null)}><ArrowLeft size={16}/> Todos os shows</button><ShowDetail show={selected} sessions={sessions} characters={characters} people={people} locations={locations} links={links} versions={versions} canManage={canManage} onNewScene={() => setNewScene(true)} onNewSession={() => setNewSession(true)} onEditSession={setEditingSession} onPublish={publishShow} onSaveDriveLink={saveDriveLink} onRemoveDriveLink={removeDriveLink} onReorderDriveLink={reorderDriveLink} onSaveObservations={saveObservations} onSaveDetails={saveDetails}/>{newScene && <Dialog title="Adicionar cena" onClose={() => setNewScene(false)} footer={<button form="new-scene" className="shows-primary" disabled={saving}>{saving ? "Salvando…" : "Adicionar cena"}</button>}><form id="new-scene" onSubmit={createScene} className="shows-form"><label>Nome da cena<input required name="name" autoFocus placeholder="Ex.: Entrada"/></label></form></Dialog>}{(newSession || editingSession) && <SessionDialog session={editingSession ?? undefined} saving={saving} onClose={() => { setNewSession(false); setEditingSession(null); }} onSubmit={saveSession}/>} {error && <p className="shows-error">{error}</p>}</section>;
  return <section className="shows-page"><div className="shows-section-bar"><div className="shows-tabs" role="tablist"><button className={tab === "shows" ? "active" : ""} onClick={() => setTab("shows")}>Shows</button><button className={tab === "characters" ? "active" : ""} onClick={() => setTab("characters")}>Personagens</button></div>{canManage && <button className="shows-primary" onClick={() => tab === "shows" ? setNewShow(true) : setNewCharacter(true)}><Plus size={17}/>{tab === "shows" ? "Novo show" : "Novo personagem"}</button>}</div>{error && <div className="shows-error">{error}<button onClick={() => void load()}>Tentar de novo</button></div>}<div className="shows-filter"><Search size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tab === "shows" ? "Pesquisar show por nome" : "Pesquisar personagem"}/></div><LocationFilters locations={locations} value={locationFilter} onChange={setLocationFilter}/>{tab === "shows" && <div className="shows-state-filters"><button className={stateFilter === "ALL" ? "active" : ""} onClick={() => setStateFilter("ALL")}>Todos</button>{!onlyPublished && <><button className={stateFilter === "PUBLISHED" ? "active" : ""} onClick={() => setStateFilter("PUBLISHED")}>Publicados</button><button className={stateFilter === "DRAFT" ? "active" : ""} onClick={() => setStateFilter("DRAFT")}>Rascunhos</button></>}<button className={favoritesOnly ? "active" : ""} onClick={() => setFavoritesOnly((value) => !value)}><Star size={14}/>Favoritos</button></div>}{tab === "shows" ? !carregou && !error ? <div className="shows-carregando" aria-busy="true">Carregando os shows…</div> : !filteredShows.length ? <AsaEmptyState pose="duvida" title={shows.length ? "Nenhum show com este filtro" : "Ainda não há shows cadastrados"} subtitle={shows.length ? "Tire ou altere um filtro para ver os outros shows." : "Crie o primeiro Livro do Show antes de gerar o Livro do Dia."}/> : <ShowShelf shows={filteredShows} locations={locations} people={people} favorites={favoriteIds} onOpen={open} onToggleFavorite={(id) => setFavoriteIds((old) => { const next = new Set(old); next.has(id) ? next.delete(id) : next.add(id); return next; })}/> : <CharacterShelf characters={filteredCharacters} people={people} locationName={locations.find((location) => location.id === locationFilter)?.name} canManage={canManage} onEdit={setEditing} onAddMember={addCharacterMember} onRemoveMember={removeCharacterMember}/>} {newShow && <NewShowDialog locations={locations} saving={saving} onClose={() => setNewShow(false)} onSubmit={createShow}/>} {newCharacter && <CharacterDialog title="Novo personagem" locations={locations} areas={areas} people={people} saving={saving} onClose={() => setNewCharacter(false)} onCreate={addCharacter}/>} {editing && <CharacterDialog title={`Editar ${editing.name}`} locations={locations} areas={areas} people={people} character={editing} saving={saving} onClose={() => setEditing(null)} onSave={saveCharacter}/>}</section>;
}

function LocationFilters({ locations, value, onChange }: { locations: Location[]; value: string; onChange: (value: string) => void }) { return <div className="shows-location-filters"><button className={!value ? "active" : ""} onClick={() => onChange("")}>Todos os locais</button>{locations.map((location) => <button key={location.id} className={value === location.id ? "active" : ""} onClick={() => onChange(location.id)}>{location.name}</button>)}</div>; }
function ShowShelf({ shows, locations, people, favorites, onOpen, onToggleFavorite }: { shows: Show[]; locations: Location[]; people: PersonOption[]; favorites: Set<string>; onOpen: (show: Show) => void; onToggleFavorite: (id: string) => void }) { const groups = locations.map((location) => ({ location, shows: shows.filter((show) => show.locationId === location.id) })).filter((group) => group.shows.length); return <div className="shows-shelf">{groups.map((group) => <section key={group.location.id}><header><span className="shows-location-dot"/><h2>{group.location.name}</h2><small>{group.shows.length} shows</small></header><div className="shows-grid">{group.shows.map((show) => <article key={show.id} className="show-card"><button className="show-card-open" onClick={() => onOpen(show)}><span className="show-cover">{show.title.slice(0, 1)}</span><span className="show-card-body"><span className={`show-status ${statusTone(show.status)}`}>{statusLabel(show.status)}</span><strong>{show.title}</strong><small>{typeLabel(show.type)}{responsibleOf(show, people) && ` · ${responsibleOf(show, people)}`}</small>{show.description && <span className="show-card-desc">{show.description}</span>}<em>v{show.version}{show.updatedAt && ` · atualizado ${updatedLabel(show.updatedAt)}`} <ChevronRight size={15}/></em></span></button><button className={`show-favorite ${favorites.has(show.id) ? "active" : ""}`} aria-label={favorites.has(show.id) ? `Tirar ${show.title} dos favoritos` : `Marcar ${show.title} como favorito`} aria-pressed={favorites.has(show.id)} title={favorites.has(show.id) ? "Tirar dos favoritos" : "Marcar como favorito"} onClick={() => onToggleFavorite(show.id)}><Star size={15}/></button></article>)}</div></section>)}</div>; }
function CharacterShelf({ characters, people, locationName, canManage, onEdit, onAddMember, onRemoveMember }: { characters: Character[]; people: PersonOption[]; locationName?: string; canManage: boolean; onEdit: (character: Character) => void; onAddMember: (character: Character, person: PersonOption) => Promise<void>; onRemoveMember: (character: Character, member: CastMember) => Promise<void> }) { if (!characters.length) return <AsaEmptyState pose="duvida" title={locationName ? `Nenhum personagem em ${locationName}` : "Nenhum personagem neste acesso"} subtitle="Crie o primeiro personagem e depois monte a fila."/>; return <div className="character-grid">{characters.map((character) => <CharacterCard key={character.id} character={character} people={people} canManage={canManage} onEdit={() => onEdit(character)} onAddMember={onAddMember} onRemoveMember={onRemoveMember}/>)}</div>; }
function CharacterCard({ character, people, canManage, onEdit, onAddMember, onRemoveMember }: { character: Character; people: PersonOption[]; canManage: boolean; onEdit: () => void; onAddMember: (character: Character, person: PersonOption) => Promise<void>; onRemoveMember: (character: Character, member: CastMember) => Promise<void> }) { const [adding, setAdding] = useState(false), [search, setSearch] = useState(""); const cast = orderQueue(character.cast ?? []); const chosen = character.mode === "titular" ? cast[0] : cast.slice().sort((a, b) => a.timesDone - b.timesDone || a.order - b.order)[0]; const available = people.filter((person) => person.profile === "MEM" && !cast.some((member) => member.personId === person.id) && `${personName(person)} ${person.nomeCompleto ?? ""}`.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR"))); return <article className="character-card"><header><div><span className={`character-mode ${character.mode}`}>{character.mode === "titular" ? "Titular" : "Rodízio"}</span><h2>{character.name}</h2></div><div className="character-card-actions"><span className="character-local">{character.locationName}</span>{canManage && <button className="icon-button" aria-label={`Editar ${character.name}`} onClick={onEdit}><Pencil size={15}/></button>}</div></header>{cast.length === 1 && <div className="character-warning">Fila com uma pessoa: sem substituto se ela faltar.</div>}<section><h3>Quem entra hoje</h3>{chosen ? <p><strong>{chosen.personName}</strong> · {character.mode === "titular" ? "é a primeira pessoa da fila" : `${chosen.timesDone} vezes; menor contagem, desempate pela ordem`}</p> : <p className="empty">Fila ainda não montada.</p>}</section><section><h3>Fila</h3>{cast.length ? <ol className="character-queue">{cast.map((member, index) => <li key={member.id}><b>{index + 1}</b><span>{member.personName}</span><small>{character.mode === "titular" ? index === 0 ? "titular" : "substituto" : `${member.timesDone} vezes`}</small>{canManage && <button type="button" aria-label={`Remover ${member.personName} da fila`} onClick={() => void onRemoveMember(character, member)}><X size={14}/></button>}</li>)}</ol> : <p className="empty">Sem pessoas na fila.</p>}{canManage && <button type="button" className="character-add-member" onClick={() => setAdding(true)}><Plus size={14}/> Adicionar pessoa</button>}</section><section><h3>Shows e sessões</h3>{character.shows?.map((show) => <div className="character-show" key={show.title}><strong>{show.title}</strong><span>{show.sessions.map((session) => `${time(session.startTime)}–${time(session.endTime)}`).join(" · ")}</span></div>)}</section>{adding && <Dialog title={`Adicionar à fila · ${character.name}`} onClose={() => setAdding(false)}><div className="member-picker-tools"><label><Search size={15}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar pessoa" autoFocus/></label></div><div className="shows-form substitute-picker">{available.map((person) => <button type="button" key={person.id} onClick={() => { void onAddMember(character, person); setAdding(false); }}><strong>{personName(person)}</strong><small>{person.areaName ?? "Área"} · {person.locationName ?? "Local"}</small></button>)}</div></Dialog>}</article>; }

function NewShowDialog({ locations, saving, onClose, onSubmit }: { locations: Location[]; saving: boolean; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) { return <Dialog title="Novo show" onClose={onClose} footer={<button form="new-show" className="shows-primary" disabled={saving}>{saving ? "Criando…" : "Criar Livro do Show"}</button>}><form id="new-show" onSubmit={onSubmit} className="shows-form"><label>Nome do show<input required name="title" autoFocus placeholder="Ex.: Yeti"/></label><label>Local<select required name="locationId" defaultValue=""><option value="" disabled>Selecione o local</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label><label>Tipo de show<select required name="type" defaultValue="COMPLETE"><option value="COMPLETE">Completo — mapa de posições e personagens</option><option value="SIMPLE">Só formação — mapa de posições</option><option value="CHARACTERS_ONLY">Só personagens — sem cena ou mapa</option></select></label></form></Dialog>; }

function SessionDialog({ session, saving, onClose, onSubmit }: { session?: Session; saving: boolean; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) { const [hasCall, setHasCall] = useState(Boolean(session?.callTime)); return <Dialog title={session ? "Editar sessão" : "Nova sessão"} onClose={onClose} footer={<button form="session-form" className="shows-primary" disabled={saving}>{saving ? "Salvando…" : session ? "Salvar sessão" : "Adicionar sessão"}</button>}><form id="session-form" onSubmit={onSubmit} className="shows-form"><label>Início<input required type="time" name="startTime" defaultValue={time(session?.startTime) === "—" ? "" : time(session?.startTime)}/></label><label>Fim<input required type="time" name="endTime" defaultValue={time(session?.endTime) === "—" ? "" : time(session?.endTime)}/></label><label className="shows-switch"><input type="checkbox" role="switch" name="hasCall" checked={hasCall} onChange={(event) => setHasCall(event.target.checked)}/><span aria-hidden="true"/><strong>Horário de chamada separado</strong></label>{hasCall && <label>Chamada<input required type="time" name="callTime" defaultValue={time(session?.callTime) === "—" ? "" : time(session?.callTime)}/></label>}<fieldset className="shows-date-range"><legend>Vigência</legend><p>Opcional. Use quando este horário vale apenas em parte da temporada.</p><label>De<input type="date" name="validFrom" defaultValue={session?.validFrom ?? ""}/></label><label>Até<input type="date" name="validTo" defaultValue={session?.validTo ?? ""}/></label></fieldset>{session && <label className="shows-switch"><input type="checkbox" role="switch" name="active" defaultChecked={session.active !== false}/><span aria-hidden="true"/><strong>Sessão ativa para Escala e Livro do Dia</strong></label>}{!session && <input type="hidden" name="active" value="on"/>}</form></Dialog>; }

function CharacterDialog({ title, locations, areas, people, character, saving, onClose, onCreate, onSave }: { title: string; locations: Location[]; areas: Area[]; people: PersonOption[]; character?: Character; saving: boolean; onClose: () => void; onCreate?: (name: string, locationId: string, mode: "titular" | "rodizio", queue: PersonOption[]) => void; onSave?: (character: Character, name: string, mode: "titular" | "rodizio", queue: CastMember[]) => void }) { const [name, setName] = useState(character?.name ?? ""), [mode, setMode] = useState<"titular" | "rodizio">(character?.mode ?? "titular"), [locationId, setLocationId] = useState(character?.locationId ?? ""), [queue, setQueue] = useState<CastMember[]>(() => orderQueue(character?.cast ?? [])), [search, setSearch] = useState(""), [area, setArea] = useState(""); const editable = !character; const hasLookup = Boolean(search.trim() || area); const roster = people.filter((person) => person.isCharacterEligible !== false); const available = roster.filter((person) => !queue.some((member) => member.personId === person.id) && (hasLookup ? (!area || person.areaId === area) : isStageCastArea(person)) && `${personName(person)} ${person.nomeCompleto ?? person.fullName ?? ""}`.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR"))); const append = (person: PersonOption) => setQueue((old) => [...old, { id: `draft-${person.id}`, personId: person.id, personName: personName(person), order: old.length, timesDone: 0 }]); const move = (index: number, direction: -1 | 1) => setQueue((old) => { const next = old.slice(); const target = index + direction; if (target < 0 || target >= next.length) return old; [next[index], next[target]] = [next[target], next[index]]; return next.map((member, order) => ({ ...member, order })); }); const drag = (from: number, to: number) => { if (from === to) return; setQueue((old) => { const next = old.slice(); const [item] = next.splice(from, 1); next.splice(to, 0, item); return next.map((member, order) => ({ ...member, order })); }); }; const submit = (event: FormEvent) => { event.preventDefault(); if (!name.trim() || !locationId || !queue.length) return; if (character && onSave) onSave(character, name.trim(), mode, queue); else if (onCreate) onCreate(name.trim(), locationId, mode, queue.map((member) => people.find((person) => person.id === member.personId)!).filter(Boolean)); }; return <Dialog title={title} onClose={onClose} footer={<button form="character-form" className="shows-primary" disabled={saving || !name.trim() || !locationId || !queue.length}>{saving ? "Salvando…" : character ? "Salvar personagem" : "Criar personagem"}</button>}><form id="character-form" onSubmit={submit} className="shows-form"><label>Nome<input required value={name} onChange={(event) => setName(event.target.value)} autoFocus/></label><label>Local<select required value={locationId} disabled={!editable} onChange={(event) => setLocationId(event.target.value)}><option value="" disabled>Selecione o local</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label><label>Modo<select value={mode} onChange={(event) => setMode(event.target.value as "titular" | "rodizio")}><option value="titular">Titular</option><option value="rodizio">Rodízio</option></select></label><QueueEditor locationId={locationId} mode={mode} queue={queue} people={people} areas={areas} search={search} area={area} available={available} onSearch={setSearch} onArea={setArea} onAppend={append} onMove={move} onRemove={(id) => setQueue((old) => old.filter((member) => member.id !== id).map((member, order) => ({ ...member, order })))} onDrag={drag}/></form></Dialog>; }

function QueueEditor({ locationId, mode, queue, people, areas, search, area, available, onSearch, onArea, onAppend, onMove, onRemove, onDrag }: { locationId: string; mode: Character["mode"]; queue: CastMember[]; people: PersonOption[]; areas: Area[]; search: string; area: string; available: PersonOption[]; onSearch: (value: string) => void; onArea: (value: string) => void; onAppend: (person: PersonOption) => void; onMove: (index: number, direction: -1 | 1) => void; onRemove: (id: string) => void; onDrag: (from: number, to: number) => void }) { const [dragged, setDragged] = useState<number | null>(null); return <fieldset className="shows-queue"><legend>Fila de quem pode fazer</legend><p>Escolha uma pessoa: ela entra no fim. A ordem é visível e desempata o rodízio.</p><ol className="queue-editor">{queue.map((member, index) => <li key={member.id} draggable onDragStart={() => setDragged(index)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (dragged !== null) onDrag(dragged, index); setDragged(null); }}><GripVertical size={15}/><b>{index + 1}</b><span>{member.personName}</span>{mode === "rodizio" && <small>{member.timesDone} vezes</small>}<button type="button" aria-label="Subir" onClick={() => onMove(index, -1)} disabled={!index}><ArrowUp size={14}/></button><button type="button" aria-label="Descer" onClick={() => onMove(index, 1)} disabled={index === queue.length - 1}><ArrowDown size={14}/></button><button type="button" aria-label="Remover" onClick={() => onRemove(member.id)}><X size={14}/></button></li>)}</ol><div className="queue-picker"><div><Search size={15}/><input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Buscar pessoa"/></div><select value={area} onChange={(event) => onArea(event.target.value)}><option value="">Todas as áreas</option>{areas.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div><div className="queue-options">{available.map((person) => <button type="button" key={person.id} onClick={() => onAppend(person)}><span><strong>{personName(person)}</strong><small>{person.areaName ?? "Sem área"} · {person.locationName ?? "Sem local"}</small></span><Plus size={16}/></button>)}{!available.length && <p className="empty">{!locationId ? "Escolha o local para ver o elenco." : "Nenhuma pessoa disponível neste filtro."}</p>}</div></fieldset>; }

function ShowDetailLegacy({ show, sessions, characters, people, locations, links, versions, canManage, onNewScene, onNewSession, onPublish }: { show: ShowTree; sessions: Session[]; characters: Character[]; people: PersonOption[]; locations: Location[]; links: DriveLink[]; versions: Version[]; canManage: boolean; onNewScene: () => void; onNewSession: () => void; onPublish: () => Promise<void> | void }) { const location = show.locationName ?? locations.find((item) => item.id === show.locationId)?.name ?? "Local não informado"; const characterIds = new Set(show.scenes.flatMap((scene) => scene.blocks.flatMap((block) => block.positions.flatMap((position) => position.lines?.map((line) => line.characterId).filter(Boolean) ?? [])))); const related = characters.filter((character) => characterIds.has(character.id)); return <><header className="show-detail-hero"><span className="show-cover large">{show.title.slice(0, 1)}</span><div><span className={`show-status ${statusTone(show.status)}`}>{statusLabel(show.status)}</span><h2>{show.title}</h2><p>{show.description ?? "Sem descrição cadastrada."}</p><div className="show-detail-meta"><span>{location}</span><span>{typeLabel(show.type)}</span><span><UserRound size={14}/>{show.responsibleName ?? "Responsável não definido"}</span></div></div><span className="show-version">v{show.version}</span></header><div className="show-detail-grid expanded"><article className="show-panel show-book-panel"><header><div><BookOpen size={18}/><div><h3>Livro oficial</h3><p>Estrutura escrita e quadros-chave do palco.</p></div></div>{canManage && <button className="shows-secondary" onClick={onNewScene}><Plus size={15}/> Cena</button>}</header><div className="show-book-layout"><ol className="show-scenes">{show.scenes.length ? show.scenes.slice().sort((a, b) => a.order - b.order).map((scene) => <li key={scene.id}><div className="scene-title"><b>{String(scene.order).padStart(2, "0")}</b><span><strong>{scene.name}</strong><small>{scene.blocks.reduce((sum, block) => sum + block.positions.length, 0)} posições</small></span></div>{scene.blocks.map((block) => <div className="show-block" key={block.id}><strong>{block.name}</strong>{block.positions.map((position) => <div className="show-position" key={position.id}><span>{position.name}</span><small>{position.minimumCoverage} pessoa · {position.lines?.some((line) => line.characterId) ? "personagem definido" : "sem personagem"}</small></div>)}</div>)}</li>) : <div className="show-inline-empty">Este show não usa cena nem mapa de palco.</div>}</ol><StageFrames scenes={show.scenes}/></div></article><aside className="show-side"><article className="show-panel"><header><div><Clock3 size={18}/><div><h3>Sessões</h3><p>Início e fim formam o intervalo de conflito.</p></div></div>{canManage && <button className="shows-secondary" onClick={onNewSession}><Plus size={15}/> Sessão</button>}</header>{sessions.length ? <div className="show-sessions">{sessions.map((session) => <div key={session.id}><b>{time(session.startTime)}–{time(session.endTime)}</b><span>chamada {time(session.callTime)}</span></div>)}</div> : <div className="show-inline-empty">Nenhuma sessão cadastrada.</div>}</article>{show.usesCharacters && <article className="show-panel show-character-summary"><header><div><Sparkles size={18}/><div><h3>Personagens do show</h3><p>Diagnóstico antes do Livro do Dia.</p></div></div></header>{related.length ? related.map((character) => <div className="character-summary-row" key={character.id}><div><strong>{character.name}</strong><small>{character.mode === "titular" ? "titular" : "rodízio"} · {character.cast?.length ?? 0} na fila</small></div>{(character.cast?.length ?? 0) <= 1 && <span>Fila curta</span>}</div>) : <div className="show-inline-empty">Nenhum personagem ligado às cenas.</div>}</article>}</aside></div><div className="show-detail-grid resources"><article className="show-panel"><header><div><Link2 size={18}/><div><h3>Links do Google Drive</h3><p>O acervo fica no Drive; o My ASA guarda atalhos, tipo e escopo.</p></div></div></header>{links.length ? <div className="drive-links">{links.map((link) => link.url ? <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer"><span className="drive-kind">{link.type}</span><strong>{link.title}</strong><small>{link.scope}{link.note ? ` · ${link.note}` : ""}</small><ChevronRight size={15}/></a> : <div className="drive-link-unavailable" key={link.id} title="Cadastre a URL do Drive para abrir este atalho."><span className="drive-kind">{link.type}</span><strong>{link.title}</strong><small>{link.scope}{link.note ? ` · ${link.note}` : ""} · URL não cadastrada</small></div>)}</div> : <div className="show-inline-empty">Nenhum atalho do Drive associado.</div>}</article><aside className="show-side"><article className="show-panel"><header><div><MessageSquareText size={18}/><div><h3>Observações</h3><p>Notas operacionais deste show.</p></div></div></header><div className="show-notes"><p>{show.description ? "Consulte o Drive para materiais e combine mudanças do palco antes do dia." : "Nenhuma observação cadastrada."}</p></div></article></aside></div><article className="show-panel show-history"><header><div><History size={18}/><div><h3>Histórico de versões</h3><p>{versions.length} alteração{versions.length === 1 ? "" : "ões"}</p></div></div></header>{versions.length ? versions.slice().reverse().map((version) => <div className="version-row" key={version.id}><b>v{version.version}</b><span>{version.reason ?? version.changeType ?? "Alteração no Livro do Show"}</span><small>{version.createdAt ? new Date(version.createdAt).toLocaleString("pt-BR") : ""}</small></div>) : <div className="show-inline-empty">Ainda não há versões registradas.</div>}</article></>; }
type StageDefinition = { label: string; ratio: number; points: string; clip: string; areas: Record<StageMarker["side"], [number, number, number, number]>; zones: [string, number, number][]; openings: [number, number, string][]; notes: [number, number][] };
type StageMarker = { side: "BL" | "BR" | "PER"; label: string; x: number; y: number };
type StageMap = { STAGES: Record<"L" | "RET" | "QUAD" | "NONE", StageDefinition>; MODES: Record<string, string>; buildMarkers: (scene: { bl: string[]; br: string[]; chars: [string, string][] }, kind: string, stage: StageDefinition) => StageMarker[]; layout: (side: StageMarker["side"], labels: string[], area: [number, number, number, number], mode: string) => StageMarker[] };

function officialStageMap() { return (window as typeof window & { ASA_MAPA?: StageMap }).ASA_MAPA; }

function LegacyStageFrames({ scenes }: { scenes: Scene[] }) {
  const [frameIndex, setFrameIndex] = useState(0);
  const stageMap = officialStageMap();
  const frames = scenes.flatMap((scene) => scene.blocks.map((block) => ({ scene, block })));
  const frame = frames[Math.min(frameIndex, Math.max(0, frames.length - 1))];
  if (!frames.length) return <aside className="stage-frames"><header><span>Quadros-chave</span><small>palco</small></header><div className="show-inline-empty">Quadros aparecem quando a cena tiver posições de palco.</div></aside>;
  if (!stageMap) return <aside className="stage-frames"><header><span>Quadros-chave</span><small>palco</small></header><div className="show-inline-empty">O mapa de palco não foi carregado.</div></aside>;
  const stage = stageMap.STAGES.L;
  const positions = frame.block.positions;
  const slots = { bl: positions.filter((position) => position.positionJson?.side === "BL").map((position) => position.name), br: positions.filter((position) => position.positionJson?.side === "BR").map((position) => position.name), chars: positions.filter((position) => position.positionJson?.side !== "BL" && position.positionJson?.side !== "BR").map((position, index) => [String(index + 1), position.name] as [string, string]) };
  const markers = stageMap.buildMarkers(slots, ["inicial", "splice", "locacao", "saida"][frameIndex % 4], stage);
  return <aside className="stage-frames" aria-label="Quadros-chave do palco"><header><span>Quadros-chave</span><small>{stage.label}</small></header><div className="stage-canvas"><div className="stage-floor" style={{ clipPath: stage.clip }}/><svg className="stage-outline" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polygon points={stage.points}/></svg>{stage.zones.map(([label, left, top]) => <span className="stage-zone" style={{ left: `${left}%`, top: `${top}%` }} key={label}>{label}</span>)}{stage.openings.map(([left, top, orientation], index) => <i className={`stage-opening ${orientation === "v" ? "vertical" : ""}`} style={{ left: `${left}%`, top: `${top}%` }} key={`${left}-${top}-${index}`}/>) }{stage.notes.map(([left, top], index) => <i className="stage-note" style={{ left: `${left}%`, top: `${top}%` }} key={`${left}-${top}-${index}`}/>) }{markers.map((marker, index) => <button type="button" className={`stage-marker ${marker.side.toLowerCase()}`} style={{ left: `${marker.x}%`, top: `${marker.y}%` }} title={`Slot ${marker.label} · ${slots.chars.find(([label]) => label === marker.label)?.[1] ?? marker.label}`} key={`${marker.side}-${marker.label}-${index}`}>{marker.label}</button>)}</div><div className="stage-frame-list">{frames.map((item, index) => <button type="button" className={index === frameIndex ? "active" : ""} onClick={() => setFrameIndex(index)} key={item.block.id}><span>{String(index + 1).padStart(2, "0")}</span><strong>{item.scene.name}</strong><small>{item.block.positions.length} posições</small></button>)}</div></aside>;
}
function StageFrames({ scenes }: { scenes: Scene[] }) {
  const stageMap = officialStageMap();
  const frames = scenes.flatMap((scene) => scene.blocks.map((block) => ({ scene, block })));
  const format = scenes[0]?.stageFormat ?? "NONE";
  const stage = stageMap?.STAGES[format];
  if (!frames.length || !stage || format === "NONE") return <aside className="stage-frames"><header><span>Quadros-chave</span><small>sem palco</small></header><div className="show-inline-empty">Este show não tem mapa de palco.</div></aside>;
  return <aside className="stage-frames" aria-label="Quadros-chave do palco"><header><span>Quadros-chave</span><small>{stage.label}</small></header><div className="stage-strip">{frames.map(({ scene, block }, index) => {
    const positions = block.positions;
    const slots = { bl: positions.filter((position) => position.positionJson?.side === "BL").map((position) => position.name), br: positions.filter((position) => position.positionJson?.side === "BR").map((position) => position.name), chars: positions.filter((position) => position.positionJson?.side !== "BL" && position.positionJson?.side !== "BR").map((position, markerIndex) => [String(markerIndex + 1), position.name] as [string, string]) };
    const markers = stageMap.buildMarkers(slots, "inicial", stage);
    return <figure className="stage-frame" key={block.id}><div className="stage-thumb"><div className="stage-floor" style={{ clipPath: stage.clip }}/><svg className="stage-outline" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polygon points={stage.points}/></svg>{markers.map((marker, markerIndex) => <button type="button" className="stage-marker" aria-label={`Slot ${marker.label} · ${slots.chars.find(([label]) => label === marker.label)?.[1] ?? marker.label}`} style={{ left: `${marker.x}%`, top: `${marker.y}%` }} key={`${marker.label}-${markerIndex}`}/>)}</div><figcaption><strong>Posição inicial</strong><small>{scene.name} · {block.positions.length} posições</small></figcaption></figure>;
  })}</div></aside>;
}
function ShowDetailMode({ show, sessions, characters, locations, links, versions, canManage }: { show: ShowTree; sessions: Session[]; characters: Character[]; locations: Location[]; links: DriveLink[]; versions: Version[]; canManage: boolean; onNewScene: () => void; onNewSession: () => void }) { const location = show.locationName ?? locations.find((item) => item.id === show.locationId)?.name ?? "Local não informado"; const linkedNames = new Set(show.scenes.flatMap((scene) => scene.blocks.flatMap((block) => block.positions.map((position) => position.name)))); const related = characters.filter((character) => linkedNames.has(character.name) || character.shows?.some((item) => item.title === show.title)); const duration = sessions.reduce((total, session) => { const [startHour, startMinute] = session.startTime.split(":").map(Number), [endHour, endMinute] = session.endTime.split(":").map(Number); return total + endHour * 60 + endMinute - startHour * 60 - startMinute; }, 0); return <section className="show-mode"><header className="show-mode-head"><span className="show-cover large">{show.title.slice(0, 1)}</span><div><span className={`show-status ${statusTone(show.status)}`}>{statusLabel(show.status)}</span><h2>{show.title}</h2><p>{show.description ?? "Sem descrição cadastrada."}</p><small><UserRound size={14}/>{show.responsibleName ?? "Responsável não definido"} · {location}</small></div><div className="show-mode-actions"><button className="shows-secondary" disabled title="Use a estrela na estante para favoritar este show."><Star size={16}/> Favorito</button><button className="shows-primary"><BookOpen size={16}/> Abrir Livro oficial</button></div></header><div className="show-mode-grid"><div className="show-mode-main"><article className="show-panel"><header><div><Link2 size={18}/><div><h3>Links do Google Drive</h3><p>Atalhos, tipo, escopo e acesso ao acervo.</p></div></div></header>{links.length ? <div className="drive-links">{links.map((link) => <a key={link.id} href="#drive" onClick={(event) => event.preventDefault()}><span className="drive-kind">{link.type}</span><strong>{link.title}</strong><small>{link.scope}{link.note ? ` · ${link.note}` : ""}</small><ChevronRight size={15}/></a>)}</div> : <div className="show-inline-empty">Nenhum link deste tipo ainda.</div>}</article><article className="show-panel"><header><div><MessageSquareText size={18}/><div><h3>Observações</h3><p>Notas operacionais deste show.</p></div></div></header><div className="show-notes"><p>{show.description ? "Consulte o Drive para materiais e combine mudanças do palco antes do dia." : "Nenhuma observação cadastrada."}</p></div></article><article className="show-panel show-history"><header><div><History size={18}/><div><h3>Histórico de versões</h3><p>{versions.length} alteração{versions.length === 1 ? "" : "ões"}</p></div></div></header>{versions.length ? versions.slice().reverse().map((version) => <div className="version-row" key={version.id}><b>v{version.version}</b><span>{version.reason ?? version.changeType ?? "Alteração no Livro do Show"}</span><small>{version.createdAt ? new Date(version.createdAt).toLocaleString("pt-BR") : ""}</small></div>) : <div className="show-inline-empty">Ainda não há versões registradas.</div>}</article></div><aside className="show-mode-side"><article className="show-panel"><header><div><FileText size={18}/><div><h3>Informações gerais</h3><p>Resumo do molde do show.</p></div></div></header><dl className="show-info"><div><dt>Duração</dt><dd>{duration ? `${duration} min` : "—"}</dd></div><div><dt>Cenas</dt><dd>{show.scenes.length}</dd></div><div><dt>Elenco base</dt><dd>{related.length} personagens</dd></div></dl></article><article className="show-panel"><header><div><Clock3 size={18}/><div><h3>Horários habituais</h3><p>Início, fim e chamada.</p></div></div>{canManage && <button className="shows-secondary"><Plus size={15}/> Sessão</button>}</header>{sessions.length ? <div className="show-sessions">{sessions.map((session) => <div key={session.id}><b>{time(session.startTime)}–{time(session.endTime)}</b><span>chamada {time(session.callTime)}</span></div>)}</div> : <div className="show-inline-empty">Nenhum horário habitual cadastrado.</div>}</article>{show.usesCharacters && <article className="show-panel show-character-summary"><header><div><Sparkles size={18}/><div><h3>Personagens do show</h3><p>Diagnóstico antes do Livro do Dia.</p></div></div></header>{related.length ? related.map((character) => <div className="character-summary-row" key={character.id}><div><strong>{character.name}</strong><small>{character.mode === "titular" ? "titular" : "rodízio"} · {character.cast?.length ?? 0} na fila</small></div>{(character.cast?.length ?? 0) <= 1 && <span>Fila curta</span>}</div>) : <div className="show-inline-empty">Nenhum personagem associado a este show.</div>}</article>}</aside></div></section>; }

type ShowMetrics = { sceneCount: number; frameCount: number; basePeopleCount: number; roleCount: number; changeover: string };

function metricsForShow(show: ShowTree): ShowMetrics {
  const source = exampleData.shows.find((item) => item.nome === show.title);
  const sourceScenes = source?.cenas ?? [];
  if (sourceScenes.length) {
    const people = new Set(sourceScenes.flatMap((scene) => [...scene.slots_bl, ...scene.slots_br, ...scene.personagens.map((role) => role.pessoa_hoje)]));
    const roles = new Set(sourceScenes.flatMap((scene) => scene.personagens.map((role) => role.personagem)));
    return { sceneCount: sourceScenes.length, frameCount: sourceScenes.reduce((total, scene) => total + scene.quadros.length, 0), basePeopleCount: people.size, roleCount: roles.size, changeover: (source as typeof source & { troca_entre_cenas?: string }).troca_entre_cenas ?? "Não definido" };
  }
  return { sceneCount: show.scenes.length, frameCount: 0, basePeopleCount: 0, roleCount: 0, changeover: "Não definido" };
}

type OfficialRole = { slot: string; personagem: string; pessoa_hoje: string };
type OfficialFrame = { id?: string; ordem?: number; nome: string; tipo: "inicial" | "splice" | "locacao" | "saida" | ""; momento: string; markerPositions?: Record<string, MarkerPosition> };
type SlotCast = { titularId?: string | null; substituteIds?: string[] };
type OfficialSlot = { id?: string; label: string; side: StageMarker["side"]; groupId?: string; groupName?: string; zone?: string; person?: string; role?: OfficialRole; cast?: SlotCast; color?: MarkerColor; positionJson?: Record<string, unknown> };
type OfficialGroup = { id?: string; name: string; prefix: string; zone: string; color?: MarkerColor; slots: OfficialSlot[] };
type OfficialScene = { id?: string; nome: string; personagens: OfficialRole[]; slots_bl: string[]; slots_br: string[]; quadros: OfficialFrame[]; groups?: OfficialGroup[]; hiddenGroups?: string[]; removeKeyframe?: (frame: OfficialFrame, index: number) => void; addCharacter?: () => void };
type DisplayMarker = StageMarker & { displayLabel: string; slot: OfficialSlot };
type MarkerPosition = { x: number; y: number };
type MarkerOverrides = Record<string, Record<string, MarkerPosition>>;
type ZoneOverrides = Partial<Record<StageFormat, Record<string, MarkerPosition>>>;

function sideForZone(zone: string | null | undefined): StageMarker["side"] {
  const normalized = (zone ?? "").toLocaleUpperCase("pt-BR");
  return normalized === "BACKSTAGE LEFT" ? "BL" : normalized === "BACKSTAGE RIGHT" ? "BR" : "PER";
}

function castFromPosition(position: Position): SlotCast | undefined {
  const line = position.lines?.find((item) => item.type === "TITULAR_SUBSTITUTE");
  if (!line?.config || typeof line.config !== "object" || Array.isArray(line.config)) return undefined;
  const config = line.config as Record<string, unknown>;
  return {
    titularId: typeof config.titularId === "string" ? config.titularId : null,
    substituteIds: Array.isArray(config.substituteIds) ? config.substituteIds.filter((id): id is string => typeof id === "string") : [],
  };
}

function groupsForScene(scene: OfficialScene): OfficialGroup[] {
  if (scene.groups) return scene.groups;
  return [
    { name: "Backstage left", prefix: "BL", zone: "BACKSTAGE LEFT", slots: scene.slots_bl.map((person, index) => ({ label: `BL ${String(index + 1).padStart(2, "0")}`, side: "BL" as const, groupName: "Backstage left", zone: "BACKSTAGE LEFT", person: person || undefined })) },
    { name: "Backstage right", prefix: "BR", zone: "BACKSTAGE RIGHT", slots: scene.slots_br.map((person, index) => ({ label: `BR ${String(index + 1).padStart(2, "0")}`, side: "BR" as const, groupName: "Backstage right", zone: "BACKSTAGE RIGHT", person: person || undefined })) },
    { name: "Personagens em cena", prefix: "PER", zone: "CENTRO", slots: scene.personagens.map((role) => ({ label: role.slot, side: "PER" as const, groupName: "Personagens em cena", zone: "CENTRO", role })) },
  ];
}

function officialScenesFor(show: ShowTree, characters: Character[]): OfficialScene[] {
  const source = exampleData.shows.find((item) => item.nome === show.title);
  if (source?.cenas) return source.cenas.map((scene, sceneIndex) => ({ id: show.scenes[sceneIndex]?.id, ...scene, slots_bl: [...scene.slots_bl], slots_br: [...scene.slots_br], personagens: scene.personagens.map((role) => ({ ...role })), quadros: scene.quadros.map((frame, frameIndex) => ({ ...frame, id: `${sceneIndex}-${frameIndex}`, tipo: frame.tipo as OfficialFrame["tipo"] })) }));
  return show.scenes.map((scene) => {
    const groups: OfficialGroup[] = scene.blocks.map((block) => ({
      id: block.id,
      name: block.name,
      prefix: block.prefix ?? "GR",
      zone: block.zone ?? "CENTRO",
      color: block.color ?? undefined,
      slots: block.positions.map((position) => {
        const characterLine = position.lines?.find((line) => line.characterId);
        const character = characterLine?.characterId ? characters.find((item) => item.id === characterLine.characterId) : undefined;
        const role = character ? { slot: position.name, personagem: character.name, pessoa_hoje: "" } : undefined;
        const storedColor = typeof position.positionJson?.markerColor === "string" && position.positionJson.markerColor in markerPalette ? position.positionJson.markerColor as MarkerColor : undefined;
        return { id: position.id, label: position.name, side: sideForZone(block.zone), groupId: block.id, groupName: block.name, zone: block.zone ?? "CENTRO", role, cast: castFromPosition(position), color: storedColor, positionJson: position.positionJson };
      }),
    }));
    return {
      id: scene.id,
      nome: scene.name,
      slots_bl: [],
      slots_br: [],
      personagens: [],
      groups,
      quadros: (scene.keyframes ?? []).map((frame) => ({ id: frame.id, ordem: frame.order, nome: frame.name, tipo: frame.type ?? "", momento: frame.moment ?? "", markerPositions: frame.markerPositions })),
    };
  });
}

/** Coordenadas continuam exclusivamente no mapa-palco.js; aqui só recuperamos a identidade humana de cada slot. */
function slotsForScene(scene: OfficialScene): OfficialSlot[] {
  return groupsForScene(scene).flatMap((group) => group.slots);
}

const markerOverrideKey = (format: StageFormat, scene: OfficialScene, frame: OfficialFrame | undefined) => `${format}:${scene.nome}:${frame?.id ?? frame?.nome ?? "inicial"}`;

function markersForFrame(scene: OfficialScene, frame: OfficialFrame | undefined, stageMap: StageMap, stage: StageDefinition, overrides?: Record<string, MarkerPosition>): DisplayMarker[] {
  const mode = stageMap.MODES[frame?.tipo || "inicial"] ?? "line";
  return groupsForScene(scene).filter((group) => !scene.hiddenGroups?.includes(group.name)).flatMap((group) => {
    const side = sideForZone(group.zone);
    const area = stage.areas[side];
    return stageMap.layout(side, group.slots.map((slot) => slot.label), area, side === "PER" ? "line" : mode).map((marker, index) => {
      const slot = group.slots[index] ?? { side, label: marker.label };
      const override = overrides?.[slot.label] ?? frame?.markerPositions?.[slot.label];
      return { ...marker, x: override?.x ?? marker.x, y: override?.y ?? marker.y, displayLabel: slot.label, slot };
    });
  });
}

/** Dentro do círculo, como no Livro do Dia: o número do slot (BL 01 → 01); papel nomeado mostra o próprio rótulo curto. */
function markerInside(label: string) {
  // A sigla é a identidade do slot. Mantemos BL01/BR01 dentro do ponto para
  // que os dois lados não fiquem ambíguos quando as legendas externas somem
  // no mapa móvel.
  const compact = label.replace(/\s+/g, "");
  return compact.length <= 4 ? compact : compact.slice(0, 1).toLocaleUpperCase("pt-BR");
}

/** O que a ASA de fato sabe calcular, a partir do molde carregado — nada de texto fixo. */
type AsaFinding = { key: string; scene: string; label: string; kind: "sem-titular" | "sem-substituto" | "fila-curta"; detail: string };

function computeAsaFindings(scenes: OfficialScene[], characters: Character[], castFor: (slot: OfficialSlot) => SlotCast): AsaFinding[] {
  const findings: AsaFinding[] = [];
  for (const scene of scenes) {
    for (const group of groupsForScene(scene)) {
      if (group.prefix === "PER") continue; // papéis nomeados têm fila própria, tratada abaixo
      for (const slot of group.slots) {
        const cast = castFor(slot);
        const hasTitular = Boolean(cast.titularId || slot.person);
        const key = `${scene.nome}::${slot.label}`;
        if (!hasTitular) { findings.push({ key, scene: scene.nome, label: slot.label, kind: "sem-titular", detail: `${slot.label} (${scene.nome}): sem titular cadastrado.` }); continue; }
        if (!(cast.substituteIds ?? []).length) findings.push({ key, scene: scene.nome, label: slot.label, kind: "sem-substituto", detail: `${slot.label} (${scene.nome}): sem substituto cadastrado.` });
      }
    }
  }
  const namesInScenes = new Set(
    scenes.flatMap((scene) => groupsForScene(scene).filter((group) => group.prefix === "PER").flatMap((group) => group.slots.map((slot) => slot.role?.personagem)))
      .filter((name): name is string => Boolean(name)),
  );
  for (const character of characters) {
    if (!namesInScenes.has(character.name)) continue;
    const queueLength = character.cast?.length ?? 0;
    if (queueLength <= 1) findings.push({ key: `Personagens::${character.name}`, scene: "Personagens", label: character.name, kind: "fila-curta", detail: `${character.name}: fila com ${queueLength} pessoa${queueLength === 1 ? "" : "s"} — sem substituto se faltar.` });
  }
  return findings;
}

function findAsaSlot(scenes: OfficialScene[], activeSceneName: string, label: string): { slot: OfficialSlot; sceneName: string } | undefined {
  const ordered = [...scenes].sort((a, b) => (a.nome === activeSceneName ? -1 : b.nome === activeSceneName ? 1 : 0));
  for (const scene of ordered) {
    for (const group of groupsForScene(scene)) {
      const slot = group.slots.find((candidate) => candidate.label.toLocaleUpperCase("pt-BR") === label);
      if (slot) return { slot, sceneName: scene.nome };
    }
  }
  return undefined;
}

type AsaAnswer = { question: string; text: string; items: { key: string; label: string; note: string }[]; suggestion?: AsaFinding };
type AsaContext = { scenes: OfficialScene[]; activeSceneName: string; sessions: Session[]; people: PersonOption[]; findings: AsaFinding[]; castFor: (slot: OfficialSlot) => SlotCast; appliedKeys: Set<string> };

/** Só responde com o que está de fato cadastrado no molde carregado — sem inventar. */
function resolveAsaAnswer(question: string, ctx: AsaContext): AsaAnswer {
  const q = question.trim();
  const slotMatch = q.match(/\b([A-Za-z]{1,3})\s?0*(\d{1,2})\b/);
  if (slotMatch) {
    const label = `${slotMatch[1].toLocaleUpperCase("pt-BR")} ${slotMatch[2].padStart(2, "0")}`;
    const found = findAsaSlot(ctx.scenes, ctx.activeSceneName, label);
    if (found) {
      const cast = ctx.castFor(found.slot);
      const nameOf = (id?: string | null) => { const person = ctx.people.find((candidate) => candidate.id === id); return person ? personName(person) : undefined; };
      const titular = nameOf(cast.titularId) ?? found.slot.person;
      const subs = (cast.substituteIds ?? []).map((id) => nameOf(id) ?? id);
      const text = titular
        ? `${label} (${found.sceneName}): titular ${titular}.${subs.length ? ` Substituto${subs.length > 1 ? "s" : ""}: ${subs.join(", ")}.` : " Sem substituto cadastrado."}`
        : `${label} (${found.sceneName}): sem titular cadastrado.`;
      const finding = ctx.findings.find((item) => item.scene === found.sceneName && item.label === label);
      return { question, text, items: [], suggestion: finding && !ctx.appliedKeys.has(finding.key) ? finding : undefined };
    }
  }
  if (/verificar sess|\bsess(ão|ões|oes)\b/i.test(q)) {
    if (!ctx.sessions.length) return { question, text: "Este show ainda não tem sessão cadastrada. A Programação não tem o que selecionar até uma ser criada.", items: [] };
    const active = ctx.sessions.filter((session) => session.active !== false);
    const text = `${ctx.sessions.length} sessão${ctx.sessions.length === 1 ? "" : "ões"} cadastrada${ctx.sessions.length === 1 ? "" : "s"}, ${active.length} ativa${active.length === 1 ? "" : "s"}. Verifique início, fim e chamada antes de publicar.`;
    const items = ctx.sessions.map((session) => ({ key: session.id, label: `${time(session.startTime)}–${time(session.endTime)}`, note: `${session.callTime ? `chamada ${time(session.callTime)}` : "sem chamada"}${session.active === false ? " · inativa" : ""}` }));
    return { question, text, items };
  }
  if (/incomplet|pend|lacuna/i.test(q)) {
    const sceneFindings = ctx.activeSceneName ? ctx.findings.filter((item) => item.scene === ctx.activeSceneName) : [];
    const relevant = sceneFindings.length ? sceneFindings : ctx.findings;
    if (!relevant.length) return { question, text: `Nenhuma lacuna encontrada${ctx.activeSceneName ? ` em ${ctx.activeSceneName}` : ""}. O molde está completo até aqui.`, items: [] };
    const text = sceneFindings.length
      ? `${ctx.activeSceneName}: ${sceneFindings.length} pendência${sceneFindings.length === 1 ? "" : "s"}. Não é erro: fica visível para a supervisão resolver na Escala antes do Livro do Dia.`
      : `Nenhuma pendência em ${ctx.activeSceneName || "esta cena"}. No show todo: ${relevant.length} pendência${relevant.length === 1 ? "" : "s"}.`;
    const items = relevant.slice(0, 5).map((item) => ({ key: item.key, label: item.label, note: item.kind === "fila-curta" ? "fila curta" : item.kind === "sem-titular" ? "sem titular" : "sem substituto" }));
    const suggestion = relevant.find((item) => !ctx.appliedKeys.has(item.key));
    return { question, text, items, suggestion };
  }
  return { question, text: "Não encontrei isso no molde. Pergunte sobre um slot (ex.: “BR 04”), uma cena, sessões ou o que está incompleto.", items: [] };
}

function OfficialBookSkeleton({ show, sessions, onBack, canManage, characters, people, onNewScene, onPublish }: { show: ShowTree; sessions: Session[]; onBack: () => void; canManage: boolean; characters: Character[]; people: PersonOption[]; onNewScene: () => void; onPublish: () => Promise<void> | void }) {
  const [scenes, setScenes] = useState<OfficialScene[]>(() => officialScenesFor(show, characters));
  const metrics = metricsForShow(show);
  const [activeName, setActiveName] = useState(() => scenes[0]?.nome ?? "");
  const [selectedSlotLabel, setSelectedSlotLabel] = useState<string | null>(null);
  const [asaOpen, setAsaOpen] = useState(false);
  // Proporção do palco em uso (mapa-palco.js): a coluna do mapa encolhe até a largura dele (shows.css).
  const [stageRatio, setStageRatio] = useState(1);
  const [publishOpen, setPublishOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [markerOverrides, setMarkerOverrides] = useState<MarkerOverrides>({});
  const [zoneOverrides, setZoneOverrides] = useState<ZoneOverrides>({});
  const [memberPicker, setMemberPicker] = useState<{ slot: OfficialSlot; purpose: "titular" | "substituto" } | null>(null);
  const [slotCastOverrides, setSlotCastOverrides] = useState<Record<string, SlotCast>>(() => reviewPatchFor(show.id).slotCasts ?? {});
  const [groupColors, setGroupColors] = useState<Record<string, MarkerColor>>(() => reviewPatchFor(show.id).groupColors ?? {});
  const [slotColors, setSlotColors] = useState<Record<string, MarkerColor>>(() => reviewPatchFor(show.id).slotColors ?? {});
  const [colorEditor, setColorEditor] = useState<{ kind: "group"; group: OfficialGroup } | { kind: "slot"; slot: OfficialSlot } | null>(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberArea, setMemberArea] = useState("");
  const [characterPickerOpen, setCharacterPickerOpen] = useState(false);
  const [characterSearch, setCharacterSearch] = useState("");
  const [groupEditor, setGroupEditor] = useState<{ scene: OfficialScene; group?: OfficialGroup } | null>(null);
  const activeScene = scenes.find((scene) => scene.nome === activeName) ?? scenes[0];
  const [savedAt, setSavedAt] = useState(() => new Date());
  const savedTime = savedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const characterByName = new Map(characters.map((character) => [character.name, character]));
  const titleForRole = (role: OfficialRole) => characterByName.get(role.personagem)?.cast?.[0]?.personName ?? role.pessoa_hoje;
  const isSample = show.id.startsWith("sample-");
  const groupKey = (group: OfficialGroup) => `${activeScene?.nome ?? ""}:${group.id ?? group.prefix}`;
  const slotKey = (slot: OfficialSlot) => `${activeScene?.nome ?? ""}:${slot.label}`;
  const groupForSlot = (slot: OfficialSlot) => groupsForScene(activeScene ?? { nome: "", personagens: [], slots_bl: [], slots_br: [], quadros: [] }).find((group) => group.slots.some((candidate) => candidate.id ? candidate.id === slot.id : candidate.label === slot.label));
  const colorForSlot = (slot: OfficialSlot) => {
    const group = groupForSlot(slot);
    return slotColors[slotKey(slot)] ?? slot.color ?? (group ? groupColors[groupKey(group)] ?? group.color : undefined) ?? (slot.role ? "pink" : "purple");
  };
  const setGroupColor = async (group: OfficialGroup, color: MarkerColor) => {
    const key = groupKey(group); setGroupColors((current) => ({ ...current, [key]: color }));
    if (isSample) updateReviewPatch(show.id, { groupColors: { ...groupColors, [key]: color } });
    if (!isSample && group.id) await customFetch(`/api/show-books/${show.id}/blocks/${group.id}/group`, { method: "PATCH", body: JSON.stringify({ name: group.name, zone: group.zone, prefix: group.prefix, color, reason: "Cor padrão do grupo atualizada" }) });
    setSavedAt(new Date()); setColorEditor(null);
  };
  const setSlotColor = async (slot: OfficialSlot, color: MarkerColor) => {
    const key = slotKey(slot); setSlotColors((current) => ({ ...current, [key]: color }));
    if (isSample) updateReviewPatch(show.id, { slotColors: { ...slotColors, [key]: color } });
    if (!isSample && slot.id) await customFetch(`/api/show-books/${show.id}/positions/${slot.id}`, { method: "PATCH", body: JSON.stringify({ positionJson: { ...slot.positionJson, markerColor: color }, reason: "Cor do círculo atualizada" }) });
    setSavedAt(new Date()); setColorEditor(null);
  };
  const persistFramePositions = (frame: OfficialFrame | undefined, positions: Record<string, MarkerPosition>) => {
    if (isSample || !frame?.id || frame.id.startsWith("draft-")) { setSavedAt(new Date()); return; }
    void customFetch(`/api/show-books/${show.id}/keyframes/${frame.id}`, { method: "PATCH", body: JSON.stringify({ markerPositions: positions, reason: "Coordenadas do quadro-chave ajustadas" }) })
      .then(() => setSavedAt(new Date()));
  };
  const persistZonePositions = (format: StageFormat, positions: Record<string, MarkerPosition>) => {
    if (isSample) { setSavedAt(new Date()); return; }
    void customFetch(`/api/show-books/${show.id}/stage-formats/${format}/zones`, { method: "PUT", body: JSON.stringify({ zonePositions: positions, reason: "Zonas do palco ajustadas" }) })
      .then(() => setSavedAt(new Date()));
  };
  const castFor = (slot: OfficialSlot) => slotCastOverrides[slot.label] ?? slot.cast ?? { titularId: null, substituteIds: [] };
  const persistSlotCast = async (slot: OfficialSlot, next: SlotCast, reason: string) => {
    const nextCasts = { ...slotCastOverrides, [slot.label]: next };
    setSlotCastOverrides(nextCasts);
    if (isSample) updateReviewPatch(show.id, { slotCasts: nextCasts });
    if (!isSample && slot.id) await customFetch(`/api/show-books/${show.id}/positions/${slot.id}/cast`, { method: "PUT", body: JSON.stringify({ ...next, reason }) });
    setSavedAt(new Date());
  };
  const asaFindings = computeAsaFindings(scenes, characters, castFor);
  // O marcador `[[chave]]` no valor (não no rótulo) é o que permite reconhecer, ao reabrir, quais
  // achados já foram aplicados — o rótulo em si fica legível para quem olha Informações gerais.
  const [asaAppliedKeys, setAsaAppliedKeys] = useState<Set<string>>(() => new Set(
    Object.values((isSample ? reviewPatchFor(show.id).details : undefined) ?? show.details ?? {})
      .map((value) => /^\[\[(.+?)\]\]/.exec(value)?.[1]).filter((key): key is string => Boolean(key)),
  ));
  /** Aplicar grava de verdade: entra em Informações gerais (custom field), e em modo real passa por
   * `PATCH /show-books/:id`, que já escreve Registro e sobe a versão na mesma transação. Descartar não chama isto. */
  const applyAsaFinding = async (finding: AsaFinding) => {
    const label = `ASA · ${finding.scene} · ${finding.label}`;
    const value = `[[${finding.key}]] ${finding.detail} (marcado em ${new Date().toLocaleString("pt-BR")})`;
    const current = (isSample ? reviewPatchFor(show.id).details : undefined) ?? show.details ?? {};
    const nextDetails = { ...current, [label]: value };
    if (isSample) updateReviewPatch(show.id, { details: nextDetails });
    else await customFetch(`/api/show-books/${show.id}`, { method: "PATCH", body: JSON.stringify({ details: nextDetails, reason: "Sugestão da ASA aplicada" }) });
    setAsaAppliedKeys((prev) => new Set(prev).add(finding.key));
    setSavedAt(new Date());
  };
  const pickMember = async (person: PersonOption) => {
    if (!memberPicker) return;
    const { slot, purpose } = memberPicker, current = castFor(slot);
    const next = purpose === "titular"
      ? { titularId: person.id, substituteIds: (current.substituteIds ?? []).filter((id) => id !== person.id) }
      : { titularId: current.titularId ?? null, substituteIds: [...new Set([...(current.substituteIds ?? []).filter((id) => id !== person.id), person.id])] };
    await persistSlotCast(slot, next, purpose === "titular" ? "Titular do slot atualizado" : "Substituto do slot acrescentado");
    setMemberPicker(null); setMemberSearch(""); setMemberArea("");
  };
  const addSlot = (sceneName: string, group: OfficialGroup) => {
    const scene = scenes.find((item) => item.nome === sceneName);
    if (!scene) return;
    // Rótulos são a identidade do slot nos quadros-chave: nunca reutilizamos um
    // número que já existiu, mesmo depois de uma remoção lógica.
    const ordinal = Math.max(0, ...group.slots.map((slot) => Number(slot.label.match(/(\d+)$/)?.[1] ?? 0))) + 1;
    const label = `${group.prefix} ${String(ordinal).padStart(2, "0")}`;
    setScenes((current) => current.map((item) => {
      if (item.nome !== sceneName) return item;
      return { ...item, groups: groupsForScene(item).map((itemGroup) => (group.id ? itemGroup.id === group.id : itemGroup.prefix === group.prefix) ? { ...itemGroup, slots: [...itemGroup.slots, { label, side: sideForZone(itemGroup.zone), groupId: itemGroup.id, groupName: itemGroup.name, zone: itemGroup.zone }] } : itemGroup) };
    }));
    if (!isSample && group.id) void customFetch<{ position: Position }>(`/api/show-books/${show.id}/positions`, { method: "POST", body: JSON.stringify({ name: label, order: ordinal, blockId: group.id, reason: "Slot acrescentado à estrutura escrita" }) }).then((result) => { setScenes((current) => current.map((item) => item.nome !== sceneName ? item : { ...item, groups: groupsForScene(item).map((itemGroup) => itemGroup.id !== group.id ? itemGroup : { ...itemGroup, slots: itemGroup.slots.map((slot) => slot.label === label && !slot.id ? { ...slot, id: result.position.id } : slot) }) })); setSavedAt(new Date()); });
  };
  const removeSlot = async (slot: OfficialSlot) => {
    if (!activeScene) return;
    if (!window.confirm(`Remover o slot ${slot.label}? O histórico e os quadros-chave continuam preservados; o slot deixa de aparecer na estrutura.`)) return;
    if (!isSample && slot.id) await customFetch(`/api/show-books/${show.id}/positions/${slot.id}`, { method: "DELETE", body: JSON.stringify({ reason: "Slot removido da estrutura escrita" }) });
    setScenes((current) => current.map((scene) => scene.nome !== activeScene.nome ? scene : {
      ...scene,
      groups: groupsForScene(scene).map((group) => ({ ...group, slots: group.slots.filter((candidate) => candidate.id ? candidate.id !== slot.id : candidate.label !== slot.label) })),
    }));
    setSlotCastOverrides((current) => { const { [slot.label]: _removed, ...rest } = current; if (isSample) updateReviewPatch(show.id, { slotCasts: rest }); return rest; });
    setSelectedSlotLabel(null);
    setSavedAt(new Date());
  };
  const saveGroup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!groupEditor) return;
    const form = new FormData(event.currentTarget), name = String(form.get("name") ?? "").trim(), zone = String(form.get("zone") ?? "CENTRO");
    if (!name) return;
    const existing = groupEditor.group;
    const prefix = existing?.prefix ?? prefixForGroup(name);
    if (existing) {
      setScenes((current) => current.map((scene) => scene.nome !== groupEditor.scene.nome ? scene : { ...scene, groups: groupsForScene(scene).map((group) => group.id === existing.id ? { ...group, name, zone } : group) }));
      if (!isSample && existing.id) await customFetch(`/api/show-books/${show.id}/blocks/${existing.id}/group`, { method: "PATCH", body: JSON.stringify({ name, zone, prefix, reason: "Grupo de slots atualizado" }) });
    } else {
      const next: OfficialGroup = { id: `draft-group-${Date.now()}`, name, prefix, zone, slots: [] };
      setScenes((current) => current.map((scene) => scene.nome !== groupEditor.scene.nome ? scene : { ...scene, groups: [...groupsForScene(scene), next] }));
      if (!isSample && groupEditor.scene.id) {
        const result = await customFetch<{ block: { id: string } }>(`/api/show-books/${show.id}/blocks`, { method: "POST", body: JSON.stringify({ name, zone, prefix, sceneId: groupEditor.scene.id, order: groupsForScene(groupEditor.scene).length, reason: "Grupo de slots criado" }) });
        setScenes((current) => current.map((scene) => scene.nome !== groupEditor.scene.nome ? scene : { ...scene, groups: groupsForScene(scene).map((group) => group.id === next.id ? { ...group, id: result.block.id } : group) }));
      }
    }
    setSavedAt(new Date()); setGroupEditor(null);
  };
  const removeGroup = async (scene: OfficialScene, group: OfficialGroup) => {
    const count = group.slots.length;
    if (!window.confirm(count ? `Remover ${group.name}? ${count} slot${count === 1 ? "" : "s"} será${count === 1 ? "" : "ão"} removido${count === 1 ? "" : "s"} logicamente.` : `Remover ${group.name}?`)) return;
    if (!isSample && group.id) await customFetch(`/api/show-books/${show.id}/blocks/${group.id}`, { method: "DELETE", body: JSON.stringify({ confirm: true, reason: "Grupo de slots removido" }) });
    setScenes((current) => current.map((item) => item.nome !== scene.nome ? item : { ...item, groups: groupsForScene(item).filter((candidate) => candidate.id !== group.id) }));
    setSavedAt(new Date());
  };
  const addKeyframe = (sceneName: string, sourceIndex: number, format: StageFormat) => {
    const scene = scenes.find((item) => item.nome === sceneName);
    if (!scene) return sourceIndex;
    const source = scene.quadros[sourceIndex] ?? scene.quadros[0];
    const id = `draft-${Date.now()}-${scene.quadros.length}`;
    const nextIndex = scene.quadros.length;
    const draft = { id, ordem: nextIndex, nome: "Quadro-chave", tipo: "" as const, momento: "" };
    setScenes((current) => current.map((item) => item.nome === sceneName ? { ...item, quadros: [...item.quadros, draft] } : item));
    const sourceKey = markerOverrideKey(format, scene, source), nextKey = markerOverrideKey(format, scene, { id, nome: "Quadro-chave", tipo: "", momento: "" });
    setMarkerOverrides((current) => ({ ...current, [nextKey]: current[sourceKey] ? { ...current[sourceKey] } : {} }));
    if (!isSample && scene.id) {
      const markerPositions = markerOverrides[sourceKey] ?? source?.markerPositions ?? {};
      void customFetch<{ keyframe: Keyframe }>(`/api/show-books/${show.id}/scenes/${scene.id}/keyframes`, { method: "POST", body: JSON.stringify({ name: draft.nome, order: nextIndex, markerPositions, reason: "Quadro-chave criado a partir do quadro atual" }) })
        .then((result) => {
          setScenes((current) => current.map((item) => item.nome === sceneName ? { ...item, quadros: item.quadros.map((frame) => frame.id === id ? { ...frame, id: result.keyframe.id, ordem: result.keyframe.order, markerPositions: result.keyframe.markerPositions } : frame) } : item));
          setSavedAt(new Date());
        });
    }
    return nextIndex;
  };
  const removeKeyframe = async (frame: OfficialFrame, index: number) => {
    if (!activeScene) return;
    if (activeScene.quadros.length <= 1) { window.alert("A cena precisa manter pelo menos um quadro-chave."); return; }
    if (!window.confirm(`Remover “${frame.nome}”? O histórico será preservado.`)) return;
    if (!isSample && frame.id && !frame.id.startsWith("draft-")) {
      const result = await customFetch<{ warning?: string }>(`/api/show-books/${show.id}/keyframes/${frame.id}`, { method: "DELETE", body: JSON.stringify({ reason: "Quadro-chave removido da cena" }) });
      if (result.warning) window.alert(result.warning);
    }
    setScenes((current) => current.map((scene) => scene.nome === activeScene.nome ? { ...scene, quadros: scene.quadros.filter((candidate, candidateIndex) => candidate.id !== frame.id || candidateIndex !== index) } : scene));
    setSelectedSlotLabel(null); setSavedAt(new Date());
  };
  const characterOptions = activeScene ? characters.filter((character) => character.shows?.some((item) => item.title === show.title) && !groupsForScene(activeScene).some((group) => group.slots.some((slot) => slot.role?.personagem === character.name))) : [];
  const includeCharacterInScene = async (character: Character) => {
    if (!activeScene) return;
    setCharacterPickerOpen(false); setCharacterSearch("");
    const roleGroup = groupsForScene(activeScene).find((group) => group.prefix === "PER") ?? { id: `draft-roles-${Date.now()}`, name: "Personagens em cena", prefix: "PER", zone: "CENTRO", slots: [] };
    // O rótulo é a identidade do slot na cena: inicial, depois duas letras, depois inicial + número.
    const taken = new Set(groupsForScene(activeScene).flatMap((group) => group.slots.map((item) => item.label)));
    const initial = character.name.slice(0, 1).toUpperCase(), two = initial + character.name.slice(1, 2).toLowerCase();
    let label = !taken.has(initial) ? initial : !taken.has(two) ? two : "";
    for (let suffix = 2; !label; suffix += 1) if (!taken.has(`${initial}${suffix}`)) label = `${initial}${suffix}`;
    const role = { slot: label, personagem: character.name, pessoa_hoje: "" };
    const slot: OfficialSlot = { label: role.slot, side: "PER", groupName: roleGroup.name, groupId: roleGroup.id, zone: roleGroup.zone, role };
    setScenes((current) => current.map((scene) => scene.nome !== activeScene.nome ? scene : { ...scene, groups: groupsForScene(scene).some((group) => group.prefix === "PER") ? groupsForScene(scene).map((group) => group.prefix === "PER" ? { ...group, slots: [...group.slots, slot] } : group) : [...groupsForScene(scene), { ...roleGroup, slots: [slot] }] }));
    if (!isSample && activeScene.id) {
      const block = groupsForScene(activeScene).find((group) => group.prefix === "PER");
      if (block?.id) {
        const position = await customFetch<{ position: Position }>(`/api/show-books/${show.id}/positions`, { method: "POST", body: JSON.stringify({ name: role.slot, order: block.slots.length, blockId: block.id, reason: "Personagem incluído na cena" }) });
        await customFetch(`/api/show-books/${show.id}/positions/${position.position.id}/lines`, { method: "POST", body: JSON.stringify({ type: "CHARACTER", characterId: character.id, order: 0, reason: "Personagem associado ao slot da cena" }) });
      }
    }
    setSavedAt(new Date());
  };
  if (activeScene) { activeScene.removeKeyframe = removeKeyframe; activeScene.addCharacter = () => setCharacterPickerOpen(true); }
  if (!scenes.length) return <section className="official-book" aria-label={`Livro oficial de ${show.title}`}><header className="official-publication-bar"><button className="shows-back" onClick={onBack}><ArrowLeft size={16}/> Voltar ao show</button><div className="official-version"><strong>Livro oficial</strong><span>v{show.version} publicada</span></div><small className="official-save">Última alteração · {savedTime}</small></header><div className="official-empty"><BookOpen size={22}/><strong>Este show ainda não tem cena.</strong><p>Adicione a estrutura escrita antes de montar o palco.</p>{canManage && <button className="shows-primary" onClick={onNewScene}><Plus size={16}/> Cena</button>}</div></section>;
  return <section className="official-book" aria-label={`Livro oficial de ${show.title}`}>
    <header className="official-publication-bar"><button className="shows-back" onClick={onBack}><ArrowLeft size={16}/> Voltar ao show</button><div className="official-version"><strong>Livro oficial</strong>{show.status === "PUBLISHED" ? <span>v{show.version} publicada</span> : <small>v{show.version} em edição · rascunho</small>}</div><small className="official-save">Salvo automaticamente · {savedTime}</small><div className="official-actions"><button className="shows-secondary" onClick={() => setHistoryOpen((value) => !value)} aria-expanded={historyOpen}>Histórico</button>{canManage && show.status !== "PUBLISHED" && <button className="shows-primary" onClick={() => setPublishOpen(true)}>Publicar alteração</button>}</div></header>
    {historyOpen && <aside className="official-history" aria-label="Histórico de versões"><strong>v{show.version} publicada</strong><span>Livro oficial publicado</span><small>A versão em edição ainda é um rascunho.</small></aside>}
    <div className={`official-book-grid ${asaOpen ? "asa-open" : "asa-closed"}`} style={{ "--stage-ratio": String(stageRatio) } as CSSProperties}>
      <aside className="official-column official-structure"><header><h2>Estrutura escrita</h2><p>{metrics.sceneCount} cenas · {metrics.frameCount} quadros-chave</p></header><ol className="official-scenes">{scenes.map((scene, index) => { const selected = scene.nome === activeScene?.nome; const groups = groupsForScene(scene), count = groups.reduce((total, group) => total + group.slots.length, 0); return <li key={`${scene.nome}-${index}`}><button className={selected ? "active" : ""} onClick={() => { setActiveName(scene.nome); setSelectedSlotLabel(null); }}><b>{String(index + 1).padStart(2, "0")}</b><span><strong>{scene.nome}</strong><small>{count} slots · {scene.quadros.length} quadros</small></span></button>{selected && <div className="official-slot-groups">{groups.map((group) => <SlotGroup key={group.id ?? `${scene.nome}-${group.prefix}`} group={group} selectedLabel={selectedSlotLabel} onSelect={setSelectedSlotLabel} canManage={canManage} color={groupColors[groupKey(group)] ?? group.color ?? "purple"} onEditColor={() => setColorEditor({ kind: "group", group })} slotSubtitle={(slot) => { if (slot.role) return `${group.name} · personagem`; const titularId = castFor(slot).titularId; const titular = titularId ? people.find((person) => person.id === titularId) : undefined; return titular ? personName(titular) : slot.person ?? `${group.name} · sem titular`; }} onAdd={() => addSlot(scene.nome, group)} onEdit={() => setGroupEditor({ scene, group })} onRemove={() => void removeGroup(scene, group)}/>) }{canManage && <button type="button" className="official-add-group" onClick={() => setGroupEditor({ scene })}><Plus size={14}/> Grupo</button>}</div>}</li>; })}</ol>{canManage && <button className="shows-secondary official-add-scene" onClick={onNewScene}><Plus size={16}/> Cena</button>}</aside>
      <main className="official-column official-stage">{activeScene && <OfficialStage onStageRatio={setStageRatio} scene={activeScene} defaultFormat={show.stageFormat ?? "NONE"} canManage={canManage} characters={characters} people={people} selectedSlotLabel={selectedSlotLabel} onSelectSlot={setSelectedSlotLabel} markerOverrides={markerOverrides} zoneOverrides={zoneOverrides} onChangeMarker={(key, label, position) => setMarkerOverrides((current) => ({ ...current, [key]: { ...current[key], [label]: position } }))} onPersistMarker={(frame, key, label, position) => persistFramePositions(frame, { ...(markerOverrides[key] ?? {}), [label]: position })} onResetMarkers={(key) => setMarkerOverrides((current) => { const next = { ...current }; delete next[key]; return next; })} onChangeZone={(format, label, position) => setZoneOverrides((current) => ({ ...current, [format]: { ...current[format], [label]: position } }))} onPersistZones={(format, label, position) => persistZonePositions(format, { ...(zoneOverrides[format] ?? {}), [label]: position })} onAddKeyframe={addKeyframe} castFor={castFor} colorForSlot={colorForSlot} onSetTitular={(slot) => setMemberPicker({ slot, purpose: "titular" })} onAddSubstitute={(slot) => setMemberPicker({ slot, purpose: "substituto" })} onClearTitular={(slot) => void persistSlotCast(slot, { titularId: null, substituteIds: castFor(slot).substituteIds ?? [] }, "Titular do slot removido")} onRemoveSubstitute={(slot, personId) => void persistSlotCast(slot, { titularId: castFor(slot).titularId ?? null, substituteIds: (castFor(slot).substituteIds ?? []).filter((id) => id !== personId) }, "Substituto do slot removido")} onRemoveSlot={(slot) => void removeSlot(slot)} onEditSlotColor={(slot) => setColorEditor({ kind: "slot", slot })}/>}</main>
      {asaOpen ? <AsaPanel canManage={canManage} scenes={scenes} activeSceneName={activeScene?.nome ?? ""} sessions={sessions} people={people} findings={asaFindings} appliedKeys={asaAppliedKeys} castFor={castFor} onApplyFinding={applyAsaFinding} onClose={() => setAsaOpen(false)}/> : <button type="button" className="official-asa-launcher" aria-label="Abrir assistente ASA" onClick={() => setAsaOpen(true)}><span className="asa-mini">ASA</span></button>}
    </div>
    {publishOpen && <PublishDialog show={show} onClose={() => setPublishOpen(false)} onPublish={onPublish}/>} 
    {memberPicker && <Dialog title={`${memberPicker.purpose === "titular" ? "Definir titular" : "Adicionar substituto"} · ${memberPicker.slot.label}`} onClose={() => setMemberPicker(null)} footer={<button type="button" className="shows-secondary" onClick={() => setMemberPicker(null)}>Cancelar</button>}><div className="member-picker-tools"><label><Search size={15}/><input value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} placeholder="Buscar pessoa" autoFocus/></label><select value={memberArea} onChange={(event) => setMemberArea(event.target.value)}><option value="">Todas as áreas</option>{Array.from(new Map(people.filter((person) => person.areaId && person.areaName).map((person) => [person.areaId!, person.areaName!])).entries()).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></div><div className="shows-form substitute-picker">{people.filter((person) => person.profile === "MEM" && (!memberArea || person.areaId === memberArea) && `${personName(person)} ${person.nomeCompleto ?? person.fullName ?? ""}`.toLocaleLowerCase("pt-BR").includes(memberSearch.toLocaleLowerCase("pt-BR"))).map((person) => <button type="button" key={person.id} onClick={() => void pickMember(person)}><strong>{personName(person)}</strong><small>{person.areaName ?? "Área"} · {person.locationName ?? "Local"}</small></button>)}</div></Dialog>}
    {colorEditor && <Dialog title={colorEditor.kind === "group" ? `Cor do grupo · ${colorEditor.group.name}` : `Cor do círculo · ${colorEditor.slot.label}`} onClose={() => setColorEditor(null)}><ColorPicker value={colorEditor.kind === "group" ? groupColors[groupKey(colorEditor.group)] ?? colorEditor.group.color ?? "purple" : colorForSlot(colorEditor.slot)} onChoose={(color) => void (colorEditor.kind === "group" ? setGroupColor(colorEditor.group, color) : setSlotColor(colorEditor.slot, color))}/></Dialog>}
    {groupEditor && <Dialog title={groupEditor.group ? `Editar grupo · ${groupEditor.group.name}` : "Novo grupo de slots"} onClose={() => setGroupEditor(null)} footer={<button form="group-editor" type="submit" className="shows-primary">{groupEditor.group ? "Salvar grupo" : "Criar grupo"}</button>}><form id="group-editor" className="shows-form" onSubmit={(event) => void saveGroup(event)}><label>Nome do grupo<input required name="name" defaultValue={groupEditor.group?.name ?? ""} autoFocus placeholder="Ex.: Pista"/></label><label>Zona do palco<select name="zone" defaultValue={groupEditor.group?.zone ?? "CENTRO"}><option>BACKSTAGE LEFT</option><option>BACKSTAGE RIGHT</option><option>CENTRO</option><option>STAGE LEFT</option><option>DOWNSTAGE</option></select></label><p className="shows-form-help">{groupEditor.group ? `O prefixo ${groupEditor.group.prefix} e os rótulos existentes permanecem estáveis.` : "O prefixo será criado a partir do nome (Pista → PI)."}</p></form></Dialog>}
    {characterPickerOpen && activeScene && <Dialog title={`Incluir personagem · ${activeScene.nome}`} onClose={() => { setCharacterPickerOpen(false); setCharacterSearch(""); }}>{characterOptions.length ? <><div className="member-picker-tools"><label><Search size={15}/><input value={characterSearch} onChange={(event) => setCharacterSearch(event.target.value)} placeholder="Buscar personagem" autoFocus/></label></div><div className="shows-form substitute-picker">{characterOptions.filter((character) => character.name.toLocaleLowerCase("pt-BR").includes(characterSearch.trim().toLocaleLowerCase("pt-BR"))).map((character) => <button type="button" key={character.id} onClick={() => void includeCharacterInScene(character)}><strong>{character.name}</strong><small>{character.mode === "titular" ? "Titular" : "Rodízio"} · {character.cast?.length ?? 0} na fila</small></button>)}</div></> : <p className="empty">Todos os personagens deste show já estão nesta cena.</p>}</Dialog>}
  </section>;
}

function ColorPicker({ value, onChoose }: { value: MarkerColor; onChoose: (color: MarkerColor) => void }) { return <div className="marker-color-picker" role="group" aria-label="Paleta de cores primárias">{(Object.keys(markerPalette) as MarkerColor[]).map((color) => <button type="button" className={value === color ? "active" : ""} onClick={() => onChoose(color)} key={color}><i style={{ backgroundColor: markerPalette[color].value }}/><span>{markerPalette[color].label}</span></button>)}</div>; }

function SlotGroup({ group, selectedLabel, onSelect, canManage, color, onEditColor, slotSubtitle, onAdd, onEdit, onRemove }: { group: OfficialGroup; selectedLabel: string | null; onSelect: (label: string) => void; canManage: boolean; color: MarkerColor; onEditColor: () => void; slotSubtitle: (slot: OfficialSlot) => string; onAdd: () => void; onEdit: () => void; onRemove: () => void }) { return <section className={`official-slot-group ${group.prefix === "PER" ? "official-role-group" : ""}`}><header><h3>{group.name}</h3>{canManage && <span className="official-group-actions"><button type="button" className="marker-color-swatch" style={{ backgroundColor: markerPalette[color].value }} title="Editar cor do grupo" aria-label={`Cor do grupo ${group.name}`} onClick={onEditColor}/><button type="button" className="icon-button" title="Editar grupo" aria-label={`Editar ${group.name}`} onClick={onEdit}><Pencil size={13}/></button><button type="button" className="icon-button" title="Remover grupo" aria-label={`Remover ${group.name}`} onClick={onRemove}><X size={13}/></button><button type="button" className="official-add-slot" onClick={onAdd}><Plus size={14}/> Slot</button></span>}</header>{group.slots.map((slot) => <button type="button" className={`official-slot ${slot.role ? "official-role-slot" : ""} ${selectedLabel === slot.label ? "active" : ""}`} onClick={() => onSelect(slot.label)} key={slot.id ?? slot.label}><b>{slot.label}</b><span><strong>{slot.role?.personagem ?? "Posição de base"}</strong><small>{slotSubtitle(slot)}</small></span><em>{slot.role ? "Personagem" : "Base"}</em></button>)}</section>; }

const clampMapPosition = (value: number) => Math.min(96, Math.max(4, value));
const positionFromPointer = (event: ReactPointerEvent<HTMLElement>, map: HTMLElement): MarkerPosition => {
  const bounds = map.getBoundingClientRect();
  return { x: clampMapPosition(((event.clientX - bounds.left) / bounds.width) * 100), y: clampMapPosition(((event.clientY - bounds.top) / bounds.height) * 100) };
};

function DraggableMarker({ marker, name, color, mapRef, canManage, selected, onSelect, onMove, onCommit }: { marker: DisplayMarker; name: string; color: MarkerColor; mapRef: RefObject<HTMLDivElement | null>; canManage: boolean; selected: boolean; onSelect: () => void; onMove: (position: MarkerPosition) => void; onCommit: (position: MarkerPosition) => void }) {
  const drag = useRef<{ x: number; y: number; pointerId: number; moved: boolean } | null>(null);
  const [dragging, setDragging] = useState(false);
  const move = (event: ReactPointerEvent<HTMLButtonElement>) => { const state = drag.current, map = mapRef.current; if (!state || !map) return; if (!state.moved && Math.hypot(event.clientX - state.x, event.clientY - state.y) < 3) return; state.moved = true; setDragging(true); onMove(positionFromPointer(event, map)); };
  const finish = (event: ReactPointerEvent<HTMLButtonElement>) => { const state = drag.current, map = mapRef.current; if (!state) return; if (event.currentTarget.hasPointerCapture(state.pointerId)) event.currentTarget.releasePointerCapture(state.pointerId); drag.current = null; setDragging(false); if (!state.moved) onSelect(); else if (map) onCommit(positionFromPointer(event, map)); };
  const style = { left: `${marker.x}%`, top: `${marker.y}%`, "--marker-color": markerPalette[color].value } as CSSProperties;
  return <button type="button" disabled={!canManage} className={`stage-marker ${marker.side === "PER" ? "per" : ""} ${selected ? "selected" : ""} ${dragging ? "dragging" : ""}`} onPointerDown={(event) => { if (!canManage) return; event.currentTarget.setPointerCapture(event.pointerId); drag.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId, moved: false }; }} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} style={style} title={canManage ? `Arraste ou abra o slot ${marker.displayLabel}` : `Slot ${marker.displayLabel} · somente leitura`} aria-label={`Abrir slot ${marker.displayLabel}`}><span className="stage-marker-dot" aria-hidden="true">{markerInside(marker.displayLabel)}</span><span className="stage-marker-caption" aria-hidden="true">{marker.slot.role?.personagem ?? marker.displayLabel}</span>{selected && <span className="stage-marker-name">{name}</span>}</button>;
}

function DraggableZone({ label, position, mapRef, canManage, onMove, onCommit }: { label: string; position: MarkerPosition; mapRef: RefObject<HTMLDivElement | null>; canManage: boolean; onMove: (position: MarkerPosition) => void; onCommit: (position: MarkerPosition) => void }) {
  const drag = useRef<{ x: number; y: number; pointerId: number; moved: boolean } | null>(null);
  const [dragging, setDragging] = useState(false);
  const move = (event: ReactPointerEvent<HTMLSpanElement>) => { const state = drag.current, map = mapRef.current; if (!state || !map) return; if (!state.moved && Math.hypot(event.clientX - state.x, event.clientY - state.y) < 3) return; state.moved = true; setDragging(true); onMove(positionFromPointer(event, map)); };
  const finish = (event: ReactPointerEvent<HTMLSpanElement>) => { const state = drag.current, map = mapRef.current; if (!state) return; if (event.currentTarget.hasPointerCapture(state.pointerId)) event.currentTarget.releasePointerCapture(state.pointerId); drag.current = null; setDragging(false); if (state.moved && map) onCommit(positionFromPointer(event, map)); };
  return <span className={`stage-zone ${position.x <= 20 ? "inset-left" : position.x >= 70 ? "inset-right" : ""} ${canManage ? "draggable" : "locked"} ${dragging ? "dragging" : ""}`} onPointerDown={(event) => { if (!canManage) return; event.currentTarget.setPointerCapture(event.pointerId); drag.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId, moved: false }; }} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} style={{ left: `${position.x}%`, top: `${position.y}%` }} title={canManage ? "Arraste o nome da zona" : "Zona do palco · somente leitura"}>{label}</span>;
}

function OfficialStage({ onStageRatio, scene, defaultFormat, canManage, characters, people, selectedSlotLabel, onSelectSlot, markerOverrides, zoneOverrides, onChangeMarker, onPersistMarker, onResetMarkers, onChangeZone, onPersistZones, onAddKeyframe, castFor, colorForSlot, onSetTitular, onAddSubstitute, onClearTitular, onRemoveSubstitute, onRemoveSlot, onEditSlotColor }: { onStageRatio?: (ratio: number) => void; scene: OfficialScene; defaultFormat: StageFormat; canManage: boolean; characters: Character[]; people: PersonOption[]; selectedSlotLabel: string | null; onSelectSlot: (label: string | null) => void; markerOverrides: MarkerOverrides; zoneOverrides: ZoneOverrides; onChangeMarker: (key: string, label: string, position: MarkerPosition) => void; onPersistMarker: (frame: OfficialFrame | undefined, key: string, label: string, position: MarkerPosition) => void; onResetMarkers: (key: string) => void; onChangeZone: (format: StageFormat, label: string, position: MarkerPosition) => void; onPersistZones: (format: StageFormat, label: string, position: MarkerPosition) => void; onAddKeyframe: (sceneName: string, sourceIndex: number, format: StageFormat) => number; castFor: (slot: OfficialSlot) => SlotCast; colorForSlot: (slot: OfficialSlot) => MarkerColor; onSetTitular: (slot: OfficialSlot) => void; onAddSubstitute: (slot: OfficialSlot) => void; onClearTitular: (slot: OfficialSlot) => void; onRemoveSubstitute: (slot: OfficialSlot, personId: string) => void; onRemoveSlot: (slot: OfficialSlot) => void; onEditSlotColor: (slot: OfficialSlot) => void }) {
  const stageMap = officialStageMap();
  const [format, setFormat] = useState<StageFormat>(defaultFormat);
  const [hiddenZones, setHiddenZones] = useState<Set<string>>(() => new Set());
  const [frameIndex, setFrameIndex] = useState(0);
  const mapRef = useRef<HTMLDivElement>(null);
  const baseStage = stageMap?.STAGES[format];
  const stage = baseStage ? { ...baseStage, zones: [...baseStage.zones, ...groupsForScene(scene).filter((group) => group.prefix === "PER").map((group) => [group.name, 50, 18] as [string, number, number])] } : undefined;
  const frame = scene.quadros[frameIndex] ?? scene.quadros[0];
  const overrideKey = markerOverrideKey(format, scene, frame);
  const markers = stageMap && stage ? markersForFrame(scene, frame, stageMap, stage, markerOverrides[overrideKey]) : [];
  const selectedMarker = markers.find((marker) => marker.displayLabel === selectedSlotLabel);
  const markerName = (slot: OfficialSlot) => { const titularId = castFor(slot).titularId; const titular = titularId ? people.find((person) => person.id === titularId) : undefined; return slot.role?.personagem ?? (titular ? personName(titular) : slot.person ?? "Vago"); };
  const toggleZone = (label: string) => setHiddenZones((old) => { const next = new Set(old); next.has(label) ? next.delete(label) : next.add(label); return next; });
  scene.hiddenGroups = Array.from(hiddenZones).filter((label) => groupsForScene(scene).some((group) => group.name === label));
  useEffect(() => { setFrameIndex(0); }, [scene.nome]);
  useEffect(() => { onStageRatio?.(baseStage?.ratio ?? 1); }, [baseStage?.ratio]);

  return <>
    <header className="official-active-head"><div><h2>{scene.nome}</h2><p>{slotsForScene(scene).length} slots · {scene.quadros.length} quadros-chave · {frame?.nome}</p></div><div className="official-role-chips">{slotsForScene(scene).filter((slot) => slot.role).map((slot) => <span key={`${slot.label}-${slot.role?.personagem}`} title={slot.role?.personagem}>{slot.label}</span>)}{canManage && <button type="button" onClick={() => scene.addCharacter?.()}><Plus size={13}/> Personagem</button>}</div></header>
    <div className="official-map-controls"><div><strong>{frame?.tipo || "inicial"}</strong><span>{frame?.momento || "Sem momento definido"}</span></div><div className="official-stage-presets" role="group" aria-label="Formato do palco">{(["L", "RET", "QUAD", "NONE"] as StageFormat[]).map((item) => <button type="button" className={format === item ? "active" : ""} onClick={() => { setFormat(item); setHiddenZones(new Set()); }} key={item}>{item}</button>)}</div></div>
    {format !== "NONE" && stage && <><div className="official-zone-controls">{canManage && <><span>Zonas</span>{stage.zones.map(([label]) => <button type="button" className={hiddenZones.has(label) ? "off" : ""} onClick={() => toggleZone(label)} key={label}>{label}</button>)}<button type="button" className="official-reset-zones" onClick={() => onResetMarkers(overrideKey)}>Restaurar posições</button></>}</div><div className="official-main-map-slot"><StageMap stage={stage} mapRef={mapRef} className="official-main-map" label={`Mapa de palco · ${scene.nome}`}>{stage.zones.filter(([label]) => !hiddenZones.has(label)).map(([label, x, y]) => <DraggableZone label={label} position={zoneOverrides[format]?.[label] ?? { x, y }} mapRef={mapRef} canManage={canManage} onMove={(position) => onChangeZone(format, label, position)} onCommit={(position) => onPersistZones(format, label, position)} key={label}/>)}{markers.map((marker, index) => <DraggableMarker marker={marker} name={markerName(marker.slot)} color={colorForSlot(marker.slot)} mapRef={mapRef} canManage={canManage} selected={selectedSlotLabel === marker.displayLabel} onSelect={() => onSelectSlot(marker.displayLabel)} onMove={(position) => onChangeMarker(overrideKey, marker.displayLabel, position)} onCommit={(position) => onPersistMarker(frame, overrideKey, marker.displayLabel, position)} key={`${marker.side}-${marker.displayLabel}-${index}`}/>)}{selectedMarker && <SlotCard slot={selectedMarker.slot} characters={characters} people={people} cast={castFor(selectedMarker.slot)} color={colorForSlot(selectedMarker.slot)} canManage={canManage} opensLeft={selectedMarker.x > 50} onClose={() => onSelectSlot(null)} onSetTitular={onSetTitular} onAddSubstitute={onAddSubstitute} onClearTitular={onClearTitular} onRemoveSubstitute={onRemoveSubstitute} onRemoveSlot={onRemoveSlot} onEditColor={onEditSlotColor}/>}</StageMap></div><KeyframeStrip scene={scene} stageMap={stageMap} stage={stage} format={format} markerOverrides={markerOverrides} colorForSlot={colorForSlot} activeIndex={frameIndex} onSelect={setFrameIndex} canManage={canManage} onAdd={() => setFrameIndex(onAddKeyframe(scene.nome, frameIndex, format))}/></>}
    {format === "NONE" && <div className="official-no-stage"><BookOpen size={22}/><strong>Este show não tem palco fixo.</strong><p>O quadro-chave vira uma lista por zona. Ninguém precisa de coordenada — só de saber onde está.</p></div>}
  </>;
}

function KeyframeStrip({ scene, stageMap, stage, format, markerOverrides, colorForSlot, activeIndex, onSelect, canManage, onAdd }: { scene: OfficialScene; stageMap: StageMap | undefined; stage: StageDefinition; format: StageFormat; markerOverrides: MarkerOverrides; colorForSlot: (slot: OfficialSlot) => MarkerColor; activeIndex: number; onSelect: (index: number) => void; canManage: boolean; onAdd: () => void }) {
  if (!stageMap) return null;
  return <section className="official-keyframe-strip" aria-label="Quadros-chave"><header><div><strong>Quadros-chave</strong><span>o mapa fala por número · a posição inicial alimenta o Livro do Dia.</span></div></header><div className="official-keyframe-scroll">{scene.quadros.map((frame, index) => {
    const markers = markersForFrame(scene, frame, stageMap, stage, markerOverrides[markerOverrideKey(format, scene, frame)]);
    return <article className={`official-keyframe ${index === activeIndex ? "active" : ""}`} key={frame.id ?? `${frame.nome}-${index}`}><button type="button" className="official-keyframe-select" onClick={() => onSelect(index)}><span className="official-keyframe-map"><span className="stage-floor" style={{ clipPath: stage.clip }}/><svg className="stage-outline" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polygon points={stage.points}/></svg>{markers.map((marker, markerIndex) => <i className={`stage-marker ${marker.side === "PER" ? "per" : ""}`} style={{ left: `${marker.x}%`, top: `${marker.y}%`, "--marker-color": markerPalette[colorForSlot(marker.slot)].value } as CSSProperties} key={`${marker.side}-${marker.displayLabel}-${markerIndex}`}/>)}</span><span className="official-keyframe-caption"><strong>{frame.nome}</strong><small>{frame.momento || "Sem momento definido"}</small></span></button>{canManage && <button type="button" className="official-remove-keyframe" aria-label={`Remover ${frame.nome}`} title={scene.quadros.length <= 1 ? "A cena precisa manter pelo menos um quadro-chave" : "Remover quadro-chave"} disabled={scene.quadros.length <= 1} onClick={() => scene.removeKeyframe?.(frame, index)}><X size={13}/></button>}</article>;
  })}{canManage && <button type="button" className="official-add-keyframe" onClick={onAdd}><Plus size={16}/> Quadro-chave</button>}</div></section>;
}

function SlotCard({ slot, characters, people, cast, color, canManage, opensLeft, onClose, onSetTitular, onAddSubstitute, onClearTitular, onRemoveSubstitute, onRemoveSlot, onEditColor }: { slot: OfficialSlot; characters: Character[]; people: PersonOption[]; cast: SlotCast; color: MarkerColor; canManage: boolean; opensLeft: boolean; onClose: () => void; onSetTitular: (slot: OfficialSlot) => void; onAddSubstitute: (slot: OfficialSlot) => void; onClearTitular: (slot: OfficialSlot) => void; onRemoveSubstitute: (slot: OfficialSlot, personId: string) => void; onRemoveSlot: (slot: OfficialSlot) => void; onEditColor: (slot: OfficialSlot) => void }) { const character = slot.role ? characters.find((item) => item.name === slot.role?.personagem) : undefined; const characterQueue = orderQueue(character?.cast ?? []); const personById = new Map(people.map((person) => [person.id, personName(person)])); const titularName = slot.role ? characterQueue[0]?.personName : cast.titularId ? personById.get(cast.titularId) : slot.person; const substitutes = slot.role ? characterQueue.slice(1).map((member) => ({ id: member.personId ?? member.id, name: member.personName })) : (cast.substituteIds ?? []).map((id) => ({ id, name: personById.get(id) ?? "Pessoa" })); const place = slot.groupName ?? (slot.side === "BL" ? "Backstage left" : slot.side === "BR" ? "Backstage right" : "Em cena"); return <aside className={`official-slot-card ${opensLeft ? "opens-left" : "opens-right"}`} aria-label={`Detalhes do slot ${slot.label}`}><header><div><span className={slot.side === "PER" ? "role" : ""}>{slot.label}</span><strong>{slot.role?.personagem ?? "Posição de base"}</strong><small>{place}</small></div><button type="button" aria-label="Fechar detalhes do slot" onClick={onClose}><X size={15}/></button></header><dl><div><dt>Titular</dt><dd>{titularName ?? "Sem titular cadastrado"}{canManage && !slot.role && <span className="slot-inline-actions"><button type="button" onClick={() => onSetTitular(slot)}>{titularName ? "Trocar" : "Definir"}</button>{titularName && <button type="button" onClick={() => onClearTitular(slot)}>Remover</button>}</span>}</dd></div><div><dt>Substitutos</dt><dd>{substitutes.length ? <ol>{substitutes.map((member, index) => <li key={`${member.id}-${index}`}><b>{index + 1}</b>{member.name}{canManage && !slot.role && <button type="button" className="slot-remove-substitute" aria-label={`Remover ${member.name}`} onClick={() => onRemoveSubstitute(slot, member.id)}><X size={13}/></button>}</li>)}</ol> : "Sem substituto cadastrado"}</dd></div></dl>{canManage && <button type="button" className="slot-color-control" onClick={() => onEditColor(slot)}><i style={{ backgroundColor: markerPalette[color].value }}/> Cor do círculo</button>}{canManage && !slot.role && <button type="button" className="official-add-substitute" onClick={() => onAddSubstitute(slot)}><Plus size={14}/> Substituto</button>}{canManage && <button type="button" className="official-remove-slot" onClick={() => onRemoveSlot(slot)}>Remover slot</button>}<footer>Escalar por data acontece em Escalas. Aqui é o molde.</footer></aside>; }

function AsaPanel({ canManage, scenes, activeSceneName, sessions, people, findings, appliedKeys, castFor, onApplyFinding, onClose }: { canManage: boolean; scenes: OfficialScene[]; activeSceneName: string; sessions: Session[]; people: PersonOption[]; findings: AsaFinding[]; appliedKeys: Set<string>; castFor: (slot: OfficialSlot) => SlotCast; onApplyFinding: (finding: AsaFinding) => Promise<void> | void; onClose: () => void }) {
  const ctx: AsaContext = { scenes, activeSceneName, sessions, people, findings, castFor, appliedKeys };
  const [entry, setEntry] = useState<AsaAnswer>(() => resolveAsaAnswer("O que está incompleto nesta cena?", ctx));
  const [draft, setDraft] = useState("");
  const [applying, setApplying] = useState(false);
  const ask = (value: string) => { const clean = value.trim(); if (!clean) return; setEntry(resolveAsaAnswer(clean, ctx)); setDraft(""); };
  const apply = async () => {
    if (!entry.suggestion) return;
    setApplying(true);
    try { await onApplyFinding(entry.suggestion); setEntry((current) => ({ ...current, suggestion: undefined })); }
    finally { setApplying(false); }
  };
  const discard = () => setEntry((current) => ({ ...current, suggestion: undefined }));
  // Gaveta: Esc fecha, como o botão ×.
  useEffect(() => { const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [onClose]);
  return <aside className="official-column official-asa" aria-label="Assistente ASA">
    <header><div><img src="/asa-wing.png" alt=""/><span><h2>ASA</h2><small>só responde com o que está cadastrado</small></span></div><button className="icon-button" aria-label="Fechar assistente" onClick={onClose}><X size={16}/></button></header>
    <div className="asa-conversation">
      <div className="asa-message"><img src="/asa/consultando.webp" alt=""/><p>Consulto o molde deste show. Toda mudança passa por uma prévia antes de valer.</p></div>
      <div className="asa-question">{entry.question}</div>
      <div className="asa-message"><img src="/asa/olhos-de-estrela.webp" alt=""/><div>
        <p>{entry.text}</p>
        {entry.items.length > 0 && <div className="asa-list">{entry.items.map((item) => <span key={item.key}><i/>{item.label} <small>{item.note}</small></span>)}</div>}
        {entry.suggestion && <div className="asa-preview">
          <strong><i/>prévia — nada foi salvo</strong>
          <p>Posso marcar “{entry.suggestion.label}” ({entry.suggestion.scene}) como lacuna conhecida em Informações gerais.</p>
          {canManage ? <div><button type="button" onClick={() => void apply()} disabled={applying}>{applying ? "Aplicando…" : "Aplicar"}</button><button type="button" onClick={discard} disabled={applying}>Descartar</button></div> : <small>Seu perfil não edita este show — a ASA mostra, mas não aplica.</small>}
        </div>}
      </div></div>
    </div>
    <footer className="asa-composer">
      <div className="asa-suggestions"><button type="button" onClick={() => ask("O que está incompleto?")}>O que está incompleto?</button><button type="button" onClick={() => ask("Verificar sessões")}>Verificar sessões</button></div>
      <label><input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); ask(draft); } }} placeholder="Pergunte sobre este show"/><button type="button" aria-label="Enviar pergunta" onClick={() => ask(draft)}>↑</button></label>
    </footer>
  </aside>;
}

function PublishDialog({ show, onClose, onPublish }: { show: Show; onClose: () => void; onPublish: () => Promise<void> | void }) { const [audiences, setAudiences] = useState(["Elenco do show", "Supervisão"]); const [important, setImportant] = useState(false); const [publishing, setPublishing] = useState(false); const toggleAudience = (audience: string) => setAudiences((current) => current.includes(audience) ? current.filter((item) => item !== audience) : [...current, audience]); const publish = async () => { setPublishing(true); try { await onPublish(); onClose(); } finally { setPublishing(false); } }; return <div className="publish-backdrop" role="presentation"><section className="publish-dialog" role="dialog" aria-modal="true" aria-label="Publicar alteração"><header><img src="/asa/aviso-importante.webp" alt=""/><div><h2>Publicar alteração</h2><p>{show.title} · v{show.version + 1} substitui a v{show.version}</p></div><button type="button" aria-label="Fechar publicação" onClick={onClose}><X size={18}/></button></header><div className="publish-content"><section><h3>O que mudou</h3><div className="publish-diff"><span>ALTERADO</span><p>Quadro-chave ajustado</p><small>Cena Bandeiras</small></div><div className="publish-diff"><span>REVISADO</span><p>BR 04 sem substituto</p><small>estrutura escrita</small></div></section><section><h3>Quem recebe a notificação</h3><div className="publish-audiences">{["Elenco do show", "Supervisão", "Direção"].map((audience) => <button type="button" className={audiences.includes(audience) ? "active" : ""} onClick={() => toggleAudience(audience)} key={audience}>{audience}</button>)}</div><div className="publish-recipient">Recebem as pessoas vinculadas ao show nos públicos selecionados.</div></section><section><h3>Mensagem</h3><p className="publish-message">O quadro-chave de Bandeiras foi ajustado e BR 04 continua sem substituto. Confiram antes do próximo ensaio.</p><button type="button" className={`publish-important ${important ? "active" : ""}`} onClick={() => setImportant((value) => !value)}><i>{important ? "✓" : ""}</i>Marcar como importante</button></section></div><footer><p>Depois de publicar, o show fica marcado como Atualizado e você pode ver quem recebeu e quem abriu.</p><button type="button" onClick={onClose}>Cancelar</button><button type="button" className="shows-primary" onClick={() => void publish()} disabled={publishing}>{publishing ? "Publicando…" : "Publicar e notificar"}</button></footer></section></div>; }

function ShowDetailReadOnly({ show, sessions, characters, people, locations, links, versions, canManage, onNewScene, onNewSession, onPublish }: { show: ShowTree; sessions: Session[]; characters: Character[]; people: PersonOption[]; locations: Location[]; links: DriveLink[]; versions: Version[]; canManage: boolean; onNewScene: () => void; onNewSession: () => void; onPublish: () => Promise<void> | void }) {
  const [mode, setMode] = useState<"show" | "book">("show");
  const [favorite, setFavorite] = useState(() => window.localStorage.getItem(`myasa-show-favorite:${show.id}`) === "1");
  const location = show.locationName ?? locations.find((item) => item.id === show.locationId)?.name ?? "Local não informado";
  const usesCharacters = typeUsesCharacters(show.type);
  const related = usesCharacters ? characters.filter((character) => character.shows?.some((item) => item.title === show.title)) : [];
  const duration = sessions.reduce((total, session) => { const [startHour, startMinute] = session.startTime.split(":").map(Number), [endHour, endMinute] = session.endTime.split(":").map(Number); return total + endHour * 60 + endMinute - startHour * 60 - startMinute; }, 0);
  const metrics = metricsForShow(show);
  // Alterações estruturais (Cena, grupo, slot) retornam um Livro com versão
  // nova. A chave remonta o estado do Livro a partir do JSON recém-carregado;
  // sem ela, a API gravava a cena mas a tela continuava no esqueleto vazio.
  if (mode === "book") return <OfficialBookSkeleton key={`${show.id}:${show.version}`} show={show} sessions={sessions} characters={characters} people={people} canManage={canManage} onBack={() => setMode("show")} onNewScene={onNewScene} onPublish={onPublish}/>;
  const toggleFavorite = () => { const next = !favorite; setFavorite(next); window.localStorage.setItem(`myasa-show-favorite:${show.id}`, next ? "1" : "0"); };
  return <section className="show-mode"><header className="show-mode-head"><span className="show-cover large">{show.title.slice(0, 1)}</span><div><span className={`show-status ${statusTone(show.status)}`}>{statusLabel(show.status)}</span><h2>{show.title}</h2><p>{show.description ?? "Sem descrição cadastrada."}</p><small><UserRound size={14}/>{show.responsibleName ?? "Responsável não definido"} · {location}</small></div><div className="show-mode-actions"><button className="shows-secondary" onClick={toggleFavorite} aria-pressed={favorite}><Star size={16} fill={favorite ? "currentColor" : "none"}/>{favorite ? "Favorito" : "Favoritar"}</button><button className="shows-primary" onClick={() => setMode("book")}><BookOpen size={16}/> Abrir Livro oficial</button></div></header><div className="show-mode-grid"><div className="show-mode-main"><article className="show-panel"><header><div><Link2 size={18}/><div><h3>Links do Google Drive</h3><p>Atalhos, tipo, escopo e acesso ao acervo.</p></div></div></header>{links.length ? <div className="drive-links">{links.map((link) => link.url ? <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer"><span className="drive-kind">{link.type}</span><strong>{link.title}</strong><small>{link.scope}{link.note ? ` · ${link.note}` : ""}</small><ChevronRight size={15}/></a> : <div className="drive-link-unavailable" key={link.id} title="Cadastre a URL do Drive para abrir este atalho."><span className="drive-kind">{link.type}</span><strong>{link.title}</strong><small>{link.scope}{link.note ? ` · ${link.note}` : ""} · URL não cadastrada</small></div>)}</div> : <div className="show-inline-empty">Nenhum link deste tipo ainda.</div>}</article><article className="show-panel"><header><div><MessageSquareText size={18}/><div><h3>Observações</h3><p>Notas operacionais deste show.</p></div></div></header><div className="show-notes"><p>{show.description ? "Consulte o Drive para materiais e combine mudanças do palco antes do dia." : "Nenhuma observação cadastrada."}</p></div></article><article className="show-panel show-history"><header><div><History size={18}/><div><h3>Histórico de versões</h3><p>{versions.length} alteração{versions.length === 1 ? "" : "ões"}</p></div></div></header>{versions.length ? versions.slice().reverse().map((version) => <div className="version-row" key={version.id}><b>v{version.version}</b><span>{version.reason ?? version.changeType ?? "Alteração no Livro do Show"}</span><small>{version.createdAt ? new Date(version.createdAt).toLocaleString("pt-BR") : ""}</small></div>) : <div className="show-inline-empty">Ainda não há versões registradas.</div>}</article></div><aside className="show-mode-side"><article className="show-panel"><header><div><FileText size={18}/><div><h3>Informações gerais</h3><p>Resumo do molde do show.</p></div></div></header><dl className="show-info"><div><dt>Duração</dt><dd>{duration ? `${duration} min` : "—"}</dd></div><div><dt>Cenas</dt><dd>{metrics.sceneCount ? `${metrics.sceneCount} cenas · ${metrics.frameCount} quadros-chave` : "Sem cenas"}</dd></div><div><dt>Elenco base</dt><dd>{metrics.basePeopleCount ? `${metrics.basePeopleCount} pessoas${metrics.roleCount ? ` + ${metrics.roleCount} personagens` : ""}` : "Não definido"}</dd></div><div><dt>Troca entre cenas</dt><dd>{metrics.changeover}</dd></div></dl></article><article className="show-panel"><header><div><Clock3 size={18}/><div><h3>Sessões</h3><p>A Programação seleciona os horários a partir delas.</p></div></div></header>{sessions.length ? <div className="show-sessions">{sessions.map((session) => <div key={session.id}><b>{time(session.startTime)}–{time(session.endTime)}</b><span>chamada {time(session.callTime)}</span></div>)}</div> : <div className="show-inline-empty">Nenhuma sessão cadastrada.</div>}</article>{usesCharacters && <article className="show-panel show-character-summary"><header><div><Sparkles size={18}/><div><h3>Personagens do show</h3><p>Diagnóstico antes do Livro do Dia.</p></div></div></header>{related.length ? related.map((character) => <div className="character-summary-row" key={character.id}><div><strong>{character.name}</strong><small>{character.mode === "titular" ? "titular" : "rodízio"} · {character.cast?.length ?? 0} na fila</small></div>{(character.cast?.length ?? 0) <= 1 && <span>Fila curta</span>}</div>) : <div className="show-inline-empty">Nenhum personagem associado a este show.</div>}</article>}</aside></div></section>;
}

// Informações gerais têm uma única fonte: o cartão do modo Show, que exibe e edita `show.details`.
function ShowDetail(props: Parameters<typeof ShowDetailContent>[0]) { return <ShowDetailContent {...props}/>; }

const baseDetailLabels = ["Duração", "Elenco base", "Troca entre cenas"];
/** O `[[chave]]` na frente do valor só serve para a ASA reconhecer o que já aplicou; não é para ler. */
const displayDetailValue = (value: string) => value.replace(/^\[\[.+?\]\]\s*/, "");
const sessionMinutes = (session: Session): number | null => { const [sh, sm] = (session.startTime ?? "").split(":").map(Number), [eh, em] = (session.endTime ?? "").split(":").map(Number); const minutes = eh * 60 + em - sh * 60 - sm; return Number.isFinite(minutes) && minutes > 0 ? minutes : null; };

function ShowDetailContent({ show, sessions, characters, people, locations, links, versions, canManage, onNewScene, onNewSession, onEditSession, onPublish, onSaveDriveLink, onRemoveDriveLink, onReorderDriveLink, onSaveObservations, onSaveDetails }: { show: ShowTree; sessions: Session[]; characters: Character[]; people: PersonOption[]; locations: Location[]; links: DriveLink[]; versions: Version[]; canManage: boolean; onNewScene: () => void; onNewSession: () => void; onEditSession: (session: Session) => void; onPublish: () => Promise<void> | void; onSaveDriveLink: (draft: Omit<DriveLink, "id">, existing?: DriveLink) => Promise<void>; onRemoveDriveLink: (link: DriveLink) => Promise<void>; onReorderDriveLink: (link: DriveLink, direction: -1 | 1) => Promise<void>; onSaveObservations: (description: string) => Promise<void>; onSaveDetails: (details: Record<string, string>) => Promise<void> }) {
  const [mode, setMode] = useState<"show" | "book">("show");
  const [favorite, setFavorite] = useState(() => window.localStorage.getItem(`myasa-show-favorite:${show.id}`) === "1");
  const [linkEditor, setLinkEditor] = useState<DriveLink | "new" | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const location = show.locationName ?? locations.find((item) => item.id === show.locationId)?.name ?? "Local não informado";
  const related = typeUsesCharacters(show.type) ? characters.filter((character) => character.shows?.some((item) => item.title === show.title)) : [];
  const metrics = metricsForShow(show);
  // Sessões são ocorrências do mesmo show: a duração é a da sessão ativa mais longa, nunca a soma.
  // Sessão desativada não conta, e sem horário válido o campo fica vazio.
  const duration = sessions.filter((session) => session.active !== false).map(sessionMinutes).filter((minutes): minutes is number => minutes !== null).reduce((longest, minutes) => Math.max(longest, minutes), 0);
  const details = show.details ?? {};
  const customDetails = Object.entries(details).filter(([label]) => !baseDetailLabels.includes(label));
  const saveLink = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = new FormData(event.currentTarget); await onSaveDriveLink({ title: String(form.get("title") ?? "").trim(), url: String(form.get("url") ?? "").trim() || null, type: String(form.get("type") ?? "").trim(), scope: String(form.get("scope") ?? "").trim(), order: linkEditor === "new" ? links.length : linkEditor?.order }, linkEditor === "new" ? undefined : linkEditor ?? undefined); setLinkEditor(null); };
  const saveDetails = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = new FormData(event.currentTarget), next: Record<string, string> = {}; for (const [key, value] of form.entries()) { const text = String(value).trim(); if (key.startsWith("custom-label-")) { const id = key.slice(13), customValue = String(form.get(`custom-value-${id}`) ?? "").trim(); if (text && customValue) next[text] = customValue; } else if (!key.startsWith("custom-value-") && text) next[key] = text; } if (Object.keys(next).length === Object.keys(details).length && Object.entries(next).every(([key, value]) => details[key] === value)) { setDetailsOpen(false); return; } await onSaveDetails(next); setDetailsOpen(false); };
  const saveNotes = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); await onSaveObservations(String(new FormData(event.currentTarget).get("description") ?? "")); setNotesOpen(false); };
  const toggleFavorite = () => { const next = !favorite; setFavorite(next); window.localStorage.setItem(`myasa-show-favorite:${show.id}`, next ? "1" : "0"); };
  if (mode === "book") return <OfficialBookSkeleton key={`${show.id}:${show.version}`} show={show} sessions={sessions} characters={characters} people={people} canManage={canManage} onBack={() => setMode("show")} onNewScene={onNewScene} onPublish={onPublish}/>;
  return <section className="show-mode"><header className="show-mode-head"><span className="show-cover large">{show.title.slice(0, 1)}</span><div><span className={`show-status ${statusTone(show.status)}`}>{statusLabel(show.status)}</span><h2>{show.title}</h2><p>{show.description ?? "Sem observação cadastrada."}</p><small><UserRound size={14}/>{show.responsibleName ?? "Responsável não definido"} · {location}</small></div><div className="show-mode-actions"><button className="shows-secondary" onClick={toggleFavorite} aria-pressed={favorite}><Star size={16} fill={favorite ? "currentColor" : "none"}/>{favorite ? "Favorito" : "Favoritar"}</button><button className="shows-primary" onClick={() => setMode("book")}><BookOpen size={16}/> Abrir Livro oficial</button></div></header><div className="show-mode-grid"><div className="show-mode-main"><article className="show-panel"><header><div><Link2 size={18}/><div><h3>Links do Google Drive</h3><p>Atalhos, tipo, escopo e acesso ao acervo.</p></div></div>{canManage && <button className="shows-secondary" onClick={() => setLinkEditor("new")}><Plus size={15}/> Link</button>}</header>{links.length ? <div className="drive-links editable">{links.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((link, index) => <div key={link.id} className="drive-link-row"><a href={link.url || undefined} target={link.url ? "_blank" : undefined} rel={link.url ? "noopener noreferrer" : undefined} aria-disabled={link.url ? undefined : true} tabIndex={link.url ? undefined : -1} onClick={(event) => { if (!link.url) event.preventDefault(); }} title={link.url ? "Abrir no Drive" : "URL aguardando cadastro"}><span className="drive-kind">{link.type}</span><strong>{link.title}</strong><small>{link.scope}{link.url ? "" : " · URL aguardando cadastro"}</small><ChevronRight size={15}/></a>{canManage && <span className="drive-link-actions"><button type="button" onClick={() => void onReorderDriveLink(link, -1)} disabled={!index} aria-label={`Subir ${link.title}`}><ArrowUp size={14}/></button><button type="button" onClick={() => void onReorderDriveLink(link, 1)} disabled={index === links.length - 1} aria-label={`Descer ${link.title}`}><ArrowDown size={14}/></button><button type="button" onClick={() => setLinkEditor(link)} aria-label={`Editar ${link.title}`}><Pencil size={14}/></button><button type="button" onClick={() => void onRemoveDriveLink(link)} aria-label={`Remover ${link.title}`}><X size={14}/></button></span>}</div>)}</div> : <div className="show-inline-empty">Nenhum atalho do Drive associado.</div>}</article><article className="show-panel"><header><div><MessageSquareText size={18}/><div><h3>Observações</h3><p>Notas operacionais deste show.</p></div></div>{canManage && <button className="shows-secondary" onClick={() => setNotesOpen(true)}><Pencil size={15}/> Editar</button>}</header><div className="show-notes"><p>{show.description || "Nenhuma observação cadastrada."}</p></div></article><article className="show-panel show-history"><header><div><History size={18}/><div><h3>Histórico de versões</h3><p>{versions.length} alteração{versions.length === 1 ? "" : "ões"}</p></div></div></header>{versions.length ? versions.slice().reverse().map((version) => <div className="version-row" key={version.id}><b>v{version.version}</b><span>{version.reason ?? version.changeType ?? "Alteração no Livro do Show"}</span><small>{version.createdAt ? new Date(version.createdAt).toLocaleString("pt-BR") : ""}</small></div>) : <div className="show-inline-empty">Ainda não há versões registradas.</div>}</article></div><aside className="show-mode-side"><article className="show-panel"><header><div><FileText size={18}/><div><h3>Informações gerais</h3><p>Resumo do molde do show.</p></div></div>{canManage && <button className="shows-secondary" onClick={() => setDetailsOpen(true)}><Pencil size={15}/> Editar</button>}</header><dl className="show-info"><div><dt>Duração</dt><dd>{details.Duração ?? (duration ? `${duration} min` : "Não definido")}</dd></div><div><dt>Cenas</dt><dd>{metrics.sceneCount ? `${metrics.sceneCount} cenas · ${metrics.frameCount} quadros-chave` : "Sem cenas"}</dd></div><div><dt>Elenco base</dt><dd>{details["Elenco base"] ?? (metrics.basePeopleCount ? `${metrics.basePeopleCount} pessoas${metrics.roleCount ? ` + ${metrics.roleCount} personagens` : ""}` : "Não definido")}</dd></div><div><dt>Troca entre cenas</dt><dd>{details["Troca entre cenas"] ?? metrics.changeover}</dd></div>{customDetails.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{displayDetailValue(value)}</dd></div>)}</dl></article><article className="show-panel"><header><div><Clock3 size={18}/><div><h3>Sessões</h3><p>A Programação seleciona os horários a partir delas.</p></div></div>{canManage && <button className="shows-secondary" onClick={onNewSession}><Plus size={15}/> Sessão</button>}</header>{sessions.length ? <div className="show-sessions">{sessions.map((session) => { const inactive = session.active === false; const body = <><b>{time(session.startTime)}–{time(session.endTime)}</b><span>{session.callTime ? `chamada ${time(session.callTime)}` : "sem chamada"}</span>{(session.validFrom || session.validTo) && <small>vigência {session.validFrom ?? "…"} — {session.validTo ?? "…"}</small>}{inactive && <em className="show-session-tag">Inativa</em>}</>; return canManage ? <button type="button" key={session.id} className={`show-session-row${inactive ? " inactive" : ""}`} onClick={() => onEditSession(session)} aria-label={`Editar sessão ${time(session.startTime)}–${time(session.endTime)}${inactive ? " (inativa)" : ""}`}>{body}</button> : <div key={session.id} className={`show-session-row${inactive ? " inactive" : ""}`}>{body}</div>; })}</div> : <div className="show-inline-empty">Nenhuma sessão cadastrada.</div>}</article>{typeUsesCharacters(show.type) && <article className="show-panel show-character-summary"><header><div><Sparkles size={18}/><div><h3>Personagens do show</h3><p>Diagnóstico antes do Livro do Dia.</p></div></div></header>{related.length ? related.map((character) => <div className="character-summary-row" key={character.id}><div><strong>{character.name}</strong><small>{character.mode === "titular" ? "titular" : "rodízio"} · {character.cast?.length ?? 0} na fila</small></div>{(character.cast?.length ?? 0) <= 1 && <span>Fila curta</span>}</div>) : <div className="show-inline-empty">Nenhum personagem associado a este show.</div>}</article>}</aside></div>{linkEditor && <Dialog title={linkEditor === "new" ? "Adicionar link do Drive" : "Editar link do Drive"} onClose={() => setLinkEditor(null)} footer={<button form="drive-link-form" className="shows-primary">Salvar link</button>}><form id="drive-link-form" className="shows-form" onSubmit={(event) => void saveLink(event)}><label>Rótulo<input required name="title" defaultValue={linkEditor === "new" ? "" : linkEditor.title} autoFocus/></label><label>URL<input name="url" type="url" defaultValue={linkEditor === "new" ? "" : linkEditor.url ?? ""} placeholder="Pode ser cadastrada depois"/></label><label>Tipo<input required name="type" defaultValue={linkEditor === "new" ? "Pasta" : linkEditor.type}/></label><label>Escopo<input required name="scope" defaultValue={linkEditor === "new" ? "Show" : linkEditor.scope}/></label></form></Dialog>}{notesOpen && <Dialog title="Editar observações" onClose={() => setNotesOpen(false)} footer={<button form="show-notes-form" className="shows-primary">Salvar observações</button>}><form id="show-notes-form" className="shows-form" onSubmit={(event) => void saveNotes(event)}><label>Observações<textarea name="description" defaultValue={show.description ?? ""} rows={7} autoFocus/></label></form></Dialog>}{detailsOpen && <Dialog title="Editar informações gerais" onClose={() => setDetailsOpen(false)} footer={<button form="show-details-form" className="shows-primary">Salvar informações</button>}><form id="show-details-form" className="shows-form" onSubmit={(event) => void saveDetails(event)}><label>Duração<input name="Duração" defaultValue={details.Duração ?? ""} placeholder={duration ? `Sessão mais longa: ${duration} min` : "Ex.: 40 min"}/></label><label>Elenco base<input name="Elenco base" defaultValue={details["Elenco base"] ?? ""} placeholder="Ex.: 18 pessoas + 4 personagens"/></label><label>Troca entre cenas<input name="Troca entre cenas" defaultValue={details["Troca entre cenas"] ?? ""} placeholder="Ex.: 20 s"/></label>{customDetails.map(([label, value], index) => <div className="show-custom-field" key={label}><label>Rótulo<input name={`custom-label-${index}`} defaultValue={label}/></label><label>Valor<input name={`custom-value-${index}`} defaultValue={displayDetailValue(value)}/></label></div>)}<div className="show-custom-field"><label>Campo livre<input name={`custom-label-${customDetails.length}`} placeholder="Ex.: Figurino"/></label><label>Valor<input name={`custom-value-${customDetails.length}`} placeholder="Ex.: Troca no camarim B"/></label></div></form></Dialog>}</section>;
}

function Dialog({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) { return <div className="shows-dialog-backdrop"><div className="shows-dialog" role="dialog" aria-modal="true" aria-label={title}><header className="shows-dialog-header"><h2>{title}</h2><button onClick={onClose} aria-label="Fechar"><X size={18}/></button></header><div className="shows-dialog-content">{children}</div>{footer && <footer className="shows-dialog-footer">{footer}</footer>}</div></div>; }
