/**
 * Mural: o mural da casa, como o de uma escola. Avisos oficiais da gestão (pedem ciente), publicações de
 * qualquer pessoa, reconhecimentos, aniversários e datas especiais. Mostra só o mês atual e o seguinte.
 * Quem publicou edita e remove o que publicou; a Administração e a Direção derrubam o que não valer (com
 * motivo) e trazem de volta. O estilo mora em communication.css.
 */
import { FormEvent, useEffect, useMemo, useState } from "react";
import { CalendarDays, Check, Heart, MessageCircle, Pencil, Plus, Search, Sparkles, SmilePlus, Trash2, Undo2, X } from "lucide-react";
import { customFetch } from "@workspace/api-client-react";
import exampleData from "../../../../design_handoff_my_asa/dados-de-exemplo.json";
import { REVIEW_PERSON } from "@/lib/amostra";
import { Modal, State, displayDate, initials, now, serverError, type Option, type Person, type Role } from "@/components/comm-ui";
import "./communication.css";

type Tipo = "NOTICE" | "RECOGNITION" | "BIRTHDAY" | "TENURE" | "POST";
type Alcance = "HOUSE" | "AREA" | "LOCATION" | "PEOPLE";
type Reacao = { emoji: string; count: number };
type Post = {
  id: string; type: Tipo; scope: Alcance; recipientNames?: string[]; title?: string | null; body: string; reason?: string | null; recipientId?: string | null;
  authorName: string; areaName?: string | null; locationName?: string | null; destinationLabel?: string | null; requiresConfirmation: boolean; publishedAt?: string; editedAt?: string | null;
  mine?: { confirmedAt?: string | null; reaction?: string | null } | null; commentCount?: number; canCancel?: boolean; canEdit?: boolean; ehMeu?: boolean;
  reactions?: Reacao[]; reactionCount?: number; eventDate?: string | null; ackSummary?: { total: number; confirmados: number };
};
type DataEspecial = { id: string; nome: string; mensagem: string | null; dia: string; emDias: number };
type DataCadastrada = { id: string; nome: string; mensagem: string | null; mes: number; dia: number; active: boolean };
type Removida = { id: string; type: Tipo; title?: string | null; body: string; cancelledAt: string; motivo: string; authorName: string; removidoPor: string | null; canRestore: boolean };
type Missing = { post: Post; total?: number; confirmados?: number; faltam?: { id: string; name: string }[]; error?: string };
type Destino = { casa: boolean; areaIds: Set<string>; locationIds: Set<string>; pessoaIds: Set<string> };
type Compor = "NOTICE" | "POST" | "RECOGNITION";

/** As mesmas do servidor (communication-hub.ts): uma reação por pessoa em cada publicação. */
const REACOES = ["❤️", "👏", "🎉", "😂", "🙏", "🎂"];
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const ETIQUETA: Record<Tipo, string> = { NOTICE: "Aviso", POST: "Publicação", RECOGNITION: "Reconhecimento", BIRTHDAY: "Aniversário", TENURE: "Tempo de casa" };

const samplePeople: Person[] = exampleData.pessoas.map((person, index) => ({ id: `sample-person-${index}`, name: person.nome_de_exibicao, areaName: exampleData.areas.find(area => area.id === person.area)?.nome ?? null }));
const sampleAreas: Option[] = exampleData.areas.map(area => ({ id: area.id, name: area.nome }));
const sampleLocations: Option[] = exampleData.locais.map(location => ({ id: location.id, name: location.nome }));

const peopleText = (names: string[] = []) => !names.length ? "pessoas escolhidas" : names.length <= 3 ? (names.length === 1 ? names[0]! : `${names.slice(0, -1).join(", ")} e ${names.at(-1)}`) : `${names.slice(0, 2).join(", ")} e mais ${names.length - 2}`;
const scopeText = (post: Pick<Post, "scope" | "areaName" | "locationName" | "recipientNames" | "destinationLabel">) => post.destinationLabel ?? (post.scope === "HOUSE" ? "toda a casa" : post.scope === "AREA" ? post.areaName ?? "uma área" : post.scope === "PEOPLE" ? peopleText(post.recipientNames) : post.locationName ?? "um local");
const assunto = (post: Pick<Post, "title" | "body">) => (post.title ?? post.body).slice(0, 70);
const destinoVazio = (): Destino => ({ casa: false, areaIds: new Set(), locationIds: new Set(), pessoaIds: new Set() });
const marcouAlgo = (destino: Destino) => destino.casa || destino.areaIds.size > 0 || destino.locationIds.size > 0 || destino.pessoaIds.size > 0;

/** Mesmo texto que o servidor monta para "para quem foi" (modo amostra). */
function rotuloDoDestino(destino: Destino, areas: Option[], locations: Option[], people: Person[]) {
  if (destino.casa) return "toda a casa";
  const grupos = [...areas.filter(item => destino.areaIds.has(item.id)).map(item => item.name), ...locations.filter(item => destino.locationIds.has(item.id)).map(item => item.name)];
  const pessoas = people.filter(item => destino.pessoaIds.has(item.id)).map(item => item.name);
  const partes = [...grupos, ...(pessoas.length ? (pessoas.length <= 2 && !grupos.length ? pessoas : [`${pessoas.length} ${pessoas.length === 1 ? "pessoa" : "pessoas"}`]) : [])];
  return partes.length <= 1 ? (partes[0] ?? "") : `${partes.slice(0, -1).join(", ")} e ${partes.at(-1)}`;
}

/** Atualiza as reações de um cartão na tela, depois que o servidor confirmou. */
function comReacao(post: Post, nova: string | null): Post {
  const atual = post.mine?.reaction ?? null;
  if (atual === nova) return post;
  let reactions = [...(post.reactions ?? [])];
  if (atual) reactions = reactions.map(item => item.emoji === atual ? { ...item, count: item.count - 1 } : item).filter(item => item.count > 0);
  if (nova) {
    const indice = reactions.findIndex(item => item.emoji === nova);
    if (indice >= 0) reactions[indice] = { ...reactions[indice]!, count: reactions[indice]!.count + 1 };
    else reactions.push({ emoji: nova, count: 1 });
  }
  reactions.sort((a, b) => b.count - a.count);
  return { ...post, reactions, reactionCount: reactions.reduce((total, item) => total + item.count, 0), mine: { ...(post.mine ?? {}), reaction: nova } };
}

function amostraDePosts(role: Role): Post[] {
  const eu = REVIEW_PERSON[role];
  const carol = samplePeople.find(person => person.name === "Carol")?.id ?? null;
  return [
    { id: "sample-birthday", type: "BIRTHDAY", scope: "HOUSE", body: "Hoje é aniversário de Carol!", recipientId: carol, authorName: "Carol", requiresConfirmation: false, publishedAt: now(), commentCount: 3, reactions: [{ emoji: "🎂", count: 12 }], reactionCount: 12 },
    { id: "sample-notice", type: "NOTICE", scope: "HOUSE", title: "Mudança no encontro de quinta", body: "A chamada de quinta começa às 9:30. Confirme a leitura para este aviso sair do topo.", eventDate: new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10), authorName: "Barbara", requiresConfirmation: true, publishedAt: now(), commentCount: 0, canCancel: role !== "mem", canEdit: role === "adm" || role === "dir", ackSummary: role !== "mem" ? { total: samplePeople.length, confirmados: Math.max(0, samplePeople.length - 5) } : undefined },
    { id: "sample-post-meu", type: "POST", scope: "HOUSE", title: "Ensaio extra sábado?", body: "Quem topa um ensaio de 1h antes do show de sábado? Respondam aqui que eu combino o horário.", authorName: eu, ehMeu: true, requiresConfirmation: false, publishedAt: now(), commentCount: 4, canCancel: true, canEdit: true, reactions: [{ emoji: "👏", count: 5 }, { emoji: "❤️", count: 3 }], reactionCount: 8 },
    { id: "sample-post-grupo", type: "POST", scope: "PEOPLE", destinationLabel: "Patinadores e Bailarinos", body: "Fotos do ensaio geral já estão no drive, quem quiser dar uma olhada.", authorName: "Sofia", requiresConfirmation: false, publishedAt: now(), commentCount: 1, canCancel: role !== "mem", reactions: [{ emoji: "🎉", count: 2 }], reactionCount: 2 },
    { id: "sample-recognition", type: "RECOGNITION", scope: "HOUSE", body: "Obrigada por segurar a troca de cena com calma e atenção hoje.", reason: "Cuidado com a equipe", recipientId: carol, recipientNames: ["Carol", "Louis"], authorName: "Deborah", requiresConfirmation: false, publishedAt: now(), commentCount: 2, canCancel: role !== "mem" },
  ];
}

function amostraDeDatas(): DataEspecial[] {
  const hoje = new Date(), em4 = new Date(Date.now() + 4 * 86_400_000);
  const dia = (data: Date) => `${String(data.getDate()).padStart(2, "0")}/${String(data.getMonth() + 1).padStart(2, "0")}`;
  return [{ id: "sample-data-1", nome: "Dia do Teatro", mensagem: "Hoje é o dia de quem faz a cena acontecer. Obrigada, elenco!", dia: dia(hoje), emDias: 0 }, { id: "sample-data-2", nome: "Dia da Dança", mensagem: null, dia: dia(em4), emDias: 4 }];
}

export function MuralPage({ role }: { role: Role }) {
  const sample = import.meta.env.DEV && new URLSearchParams(window.location.search).get("amostra") === "1";
  const [posts, setPosts] = useState<Post[]>([]), [people, setPeople] = useState<Person[]>([]), [datas, setDatas] = useState<DataEspecial[]>([]);
  const [podeAvisar, setPodeAvisar] = useState(role !== "mem"), [podeGerirDatas, setPodeGerirDatas] = useState(role === "adm" || role === "dir");
  const [loading, setLoading] = useState(true), [error, setError] = useState(""), [search, setSearch] = useState("");
  // Falha de uma ação (ciente, reação, remoção…) não derruba o Mural: vira uma faixa em cima do feed, que continua lá.
  const [aviso, setAviso] = useState(""), [ocupados, setOcupados] = useState<Set<string>>(() => new Set());
  const [composer, setComposer] = useState<Compor | null>(null), [editing, setEditing] = useState<Post | null>(null), [cancelFor, setCancelFor] = useState<Post | null>(null);
  const [missing, setMissing] = useState<Missing | null>(null), [commentFor, setCommentFor] = useState<string | null>(null), [reagiramFor, setReagiramFor] = useState<Post | null>(null);
  const [removidasAberto, setRemovidasAberto] = useState(false), [datasAberto, setDatasAberto] = useState(false);
  const [desfazer, setDesfazer] = useState<{ id: string; titulo: string } | null>(null);
  const [removidasLocais, setRemovidasLocais] = useState<Post[]>([]);
  const [areas, setAreas] = useState<Option[]>([]), [locations, setLocations] = useState<Option[]>([]);

  const tentar = async (chave: string, falha: string, acao: () => Promise<void>) => {
    if (ocupados.has(chave)) return;
    setOcupados(atual => new Set(atual).add(chave)); setAviso("");
    try { await acao(); }
    catch (err) { setAviso(serverError(err, falha)); }
    finally { setOcupados(atual => { const proximo = new Set(atual); proximo.delete(chave); return proximo; }); }
  };

  // `silencioso`: depois de uma ação a tela já mudou na hora; a releitura só confere, sem piscar nem perder o lugar na rolagem.
  const reload = (silencioso = false) => {
    if (!silencioso) setLoading(true);
    setError("");
    if (sample) {
      setPosts(amostraDePosts(role)); setPeople(samplePeople); setDatas(amostraDeDatas()); setPodeAvisar(role !== "mem"); setPodeGerirDatas(role === "adm" || role === "dir"); setLoading(false);
      return;
    }
    Promise.all([
      customFetch<{ posts: Post[]; datasEspeciais?: DataEspecial[]; podeGerirDatas?: boolean; podeAvisar?: boolean }>("/api/communication/mural"),
      customFetch<{ people: Person[] }>("/api/communication/people"),
    ]).then(([feed, directory]) => {
      setPosts(feed.posts); setDatas(feed.datasEspeciais ?? []); setPodeGerirDatas(Boolean(feed.podeGerirDatas)); setPodeAvisar(feed.podeAvisar ?? role !== "mem"); setPeople(directory.people);
    }).catch(() => { if (!silencioso) setError("Não consegui carregar o Mural agora."); }).finally(() => setLoading(false));
  };
  useEffect(() => { reload(); }, [sample, role]);

  // Áreas e locais para o "Para quem": qualquer pessoa publica, então qualquer pessoa precisa da lista.
  const carregarDestinos = () => {
    if (areas.length || locations.length) return;
    if (sample) { setAreas(sampleAreas); setLocations(sampleLocations); return; }
    customFetch<{ areas: Option[]; locations: Option[] }>("/api/communication/destinations").then(data => { setAreas(data.areas); setLocations(data.locations); }).catch(() => undefined);
  };
  const abrirComposer = (tipo: Compor) => { setComposer(tipo); carregarDestinos(); };

  const visible = useMemo(() => posts.filter(post => `${post.title ?? ""} ${post.body} ${post.authorName}`.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR"))), [posts, search]);
  const pinned = visible.filter(post => post.type === "NOTICE" && post.requiresConfirmation && !post.mine?.confirmedAt), feed = visible.filter(post => !pinned.some(item => item.id === post.id));
  const noticeCount = visible.filter(post => post.type === "NOTICE").length, recognitionCount = visible.filter(post => post.type === "RECOGNITION").length;

  // A tela só muda depois que o servidor confirma; se ele recusar, o motivo aparece em cima do feed e o botão continua ali.
  const acknowledge = (id: string) => tentar(`ciente:${id}`, "Não consegui registrar o ciente. Tente de novo.", async () => {
    if (!sample) await customFetch(`/api/communication/mural/${id}/ack`, { method: "POST" });
    setPosts(rows => rows.map(post => post.id === id ? { ...post, mine: { ...(post.mine ?? {}), confirmedAt: now() } } : post));
    if (!sample) reload(true);
  });
  const react = (id: string, emoji: string | null) => tentar(`reagir:${id}`, "Não consegui reagir agora. Tente de novo.", async () => {
    if (!sample) await customFetch(`/api/communication/mural/${id}/react`, { method: "POST", body: JSON.stringify({ reaction: emoji }) });
    setPosts(rows => rows.map(post => post.id === id ? comReacao(post, emoji) : post));
    if (!sample) reload(true);
  });
  const openMissing = async (post: Post) => {
    setMissing({ post });
    if (sample) { setMissing({ post, total: samplePeople.length, confirmados: samplePeople.length - 5, faltam: samplePeople.slice(0, 5) }); return; }
    try { const data = await customFetch<{ total: number; confirmados: number; faltam: { id: string; name: string }[] }>(`/api/communication/mural/${post.id}/cientes`); setMissing({ post, ...data }); }
    catch (err) { setMissing({ post, error: serverError(err, "Não consegui ver quem falta agora. Tente de novo.") }); }
  };
  const trazerDeVolta = (id: string, titulo: string) => tentar(`voltar:${id}`, "Não consegui trazer de volta agora. Tente de novo.", async () => {
    if (sample) { const guardada = removidasLocais.find(post => post.id === id); if (guardada) { setPosts(rows => [guardada, ...rows]); setRemovidasLocais(rows => rows.filter(post => post.id !== id)); } }
    else { await customFetch(`/api/communication/mural/${id}/restore`, { method: "POST" }); reload(true); }
    setDesfazer(atual => atual?.id === id ? null : atual);
    setAviso(""); void titulo;
  });
  // O "Desfazer" some sozinho depois de uns segundos; o que foi removido continua em "Removidas".
  useEffect(() => { if (!desfazer) return; const id = window.setTimeout(() => setDesfazer(null), 15_000); return () => window.clearTimeout(id); }, [desfazer]);

  const naTela = (post: Post) => setPosts(rows => rows.map(item => item.id === post.id ? post : item));

  return <section className="comm-page">
    <div className="comm-toolbar">
      <div className="comm-search"><Search size={17}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar no mural"/></div>
      <div>
        {podeAvisar && <button className="comm-secondary" onClick={() => abrirComposer("NOTICE")}><Plus size={17}/> Aviso</button>}
        <button className="comm-secondary" onClick={() => abrirComposer("POST")}><Plus size={17}/> Publicar</button>
        <button className="comm-primary" onClick={() => abrirComposer("RECOGNITION")}><Sparkles size={17}/> Reconhecer</button>
      </div>
    </div>
    <div className="comm-links">
      <button type="button" onClick={() => setRemovidasAberto(true)}><Trash2 size={14}/> Removidas</button>
      {podeGerirDatas && <button type="button" onClick={() => setDatasAberto(true)}><CalendarDays size={14}/> Datas especiais</button>}
    </div>
    <div className="comm-metrics" aria-label="Resumo do Mural"><article><b>{pinned.length}</b><span>aguardando seu ciente</span></article><article><b>{noticeCount}</b><span>{noticeCount === 1 ? "aviso" : "avisos"}</span></article><article><b>{recognitionCount}</b><span>{recognitionCount === 1 ? "reconhecimento" : "reconhecimentos"}</span></article></div>
    {datas.length > 0 && <section className="comm-datas" aria-label="Datas especiais">
      {/* A data de hoje é um cartão com a mensagem; as da semana cabem numa linha só, para não empurrar os avisos para baixo no telefone. */}
      {datas.filter(data => data.emDias === 0).map(data => <article key={data.id} className="hoje">
        <img src="/asa/olhos-de-estrela.webp" alt=""/>
        <div><small>hoje</small><strong>{data.nome}</strong>{data.mensagem && <p>{data.mensagem}</p>}</div>
      </article>)}
      {datas.some(data => data.emDias > 0) && <p className="comm-datas-breve"><b>Esta semana:</b> {datas.filter(data => data.emDias > 0).map(data => `${data.nome} (${data.emDias === 1 ? "amanhã" : `${data.dia}, em ${data.emDias} dias`})`).join(" · ")}</p>}
    </section>}
    {aviso && <div className="comm-inline-error" role="alert">{aviso}<button type="button" className="comm-retry" onClick={() => setAviso("")}>Fechar</button></div>}
    {desfazer && <div className="comm-undo" role="status"><span>“{desfazer.titulo}” foi removida.</span><button type="button" onClick={() => void trazerDeVolta(desfazer.id, desfazer.titulo)}><Undo2 size={15}/> Desfazer</button><button type="button" aria-label="Fechar" onClick={() => setDesfazer(null)}><X size={15}/></button></div>}
    <State loading={loading} error={error} empty={!posts.length} emptyHint={podeAvisar ? "Use “Aviso” para o comunicado oficial, “Publicar” para falar com a casa, ou “Reconhecer” para elogiar alguém." : "Publique algo para a casa ou reconheça um colega. O que a gestão avisar também aparece aqui."} onRetry={() => reload()}>
      {!visible.length && posts.length > 0 && <div className="comm-state" role="status"><strong>Nada encontrado</strong><span>Nada no Mural tem “{search.trim()}”.</span><button type="button" onClick={() => setSearch("")}>Limpar a busca</button></div>}
      {pinned.length > 0 && <section className="comm-pinned"><header><span>fica aqui até você dar ciente</span><i/></header>{pinned.map(post => <PostCard key={post.id} post={post} people={people} pinned ocupados={ocupados} onAck={acknowledge} onReact={react} onComment={() => setCommentFor(post.id)} onEdit={() => setEditing(post)} onCancel={() => setCancelFor(post)} onMissing={() => void openMissing(post)} onWho={() => setReagiramFor(post)}/>)}</section>}
      {feed.length > 0 && <header className="comm-feed-title"><span>o mural</span><i/></header>}
      <div className="comm-feed">{feed.map(post => <PostCard key={post.id} post={post} people={people} ocupados={ocupados} onAck={acknowledge} onReact={react} onComment={() => setCommentFor(post.id)} onEdit={() => setEditing(post)} onCancel={() => setCancelFor(post)} onMissing={() => void openMissing(post)} onWho={() => setReagiramFor(post)}/>)}</div>
    </State>
    {composer && <Composer tipo={composer} role={role} sample={sample} people={people} areas={areas} locations={locations} onClose={() => setComposer(null)}
      onSampleDone={post => { setPosts(rows => [post, ...rows]); setComposer(null); }} onDone={() => { setComposer(null); reload(); }}/>}
    {editing && <Editar post={editing} sample={sample} onClose={() => setEditing(null)} onDone={post => { naTela(post); setEditing(null); if (!sample) reload(true); }}/>}
    {cancelFor && <Remover post={cancelFor} sample={sample} onClose={() => setCancelFor(null)} onDone={() => {
      const post = cancelFor; setCancelFor(null);
      setPosts(rows => rows.filter(item => item.id !== post.id));
      if (sample) setRemovidasLocais(rows => [post, ...rows]);
      setDesfazer({ id: post.id, titulo: assunto(post) });
    }}/>}
    {missing && <Modal title="Quem já deu ciente" onClose={() => setMissing(null)}><div className="comm-missing">{missing.error ? <p className="comm-form-error" role="alert">{missing.error}</p> : missing.total === undefined ? <p className="comm-note">Contando…</p> : <><p className="comm-note"><b>{missing.confirmados} de {missing.total}</b> deram ciente em “{assunto(missing.post)}”.</p>{missing.faltam && missing.faltam.length ? <><h3>Faltam {missing.faltam.length}</h3><ul>{missing.faltam.map(person => <li key={person.id}>{person.name}</li>)}</ul></> : <p className="comm-note">Todo mundo já deu ciente.</p>}</>}</div><footer className="comm-modal-footer"><button type="button" onClick={() => setMissing(null)}>Fechar</button></footer></Modal>}
    {commentFor && <Comentarios id={commentFor} sample={sample} role={role} onClose={() => setCommentFor(null)} onCount={(delta) => setPosts(rows => rows.map(post => post.id === commentFor ? { ...post, commentCount: (post.commentCount ?? 0) + delta } : post))}/>}
    {reagiramFor && <QuemReagiu post={reagiramFor} sample={sample} onClose={() => setReagiramFor(null)}/>}
    {removidasAberto && <Removidas sample={sample} locais={removidasLocais} busy={ocupados} onVoltar={(id, titulo) => trazerDeVolta(id, titulo)} onClose={() => setRemovidasAberto(false)}/>}
    {datasAberto && <DatasEspeciais sample={sample} onClose={() => setDatasAberto(false)} onMudou={() => { if (!sample) reload(true); }}/>}
  </section>;
}

// ─── Cartão ───────────────────────────────────────────────────────────────────

function PostCard({ post, people, pinned, ocupados, onAck, onReact, onComment, onEdit, onCancel, onMissing, onWho }: {
  post: Post; people: Person[]; pinned?: boolean; ocupados: Set<string>; onAck: (id: string) => void; onReact: (id: string, emoji: string | null) => void;
  onComment: () => void; onEdit: () => void; onCancel: () => void; onMissing: () => void; onWho: () => void;
}) {
  const registrandoCiente = ocupados.has(`ciente:${post.id}`), reagindo = ocupados.has(`reagir:${post.id}`);
  const minha = post.mine?.reaction ?? null;
  // Aniversário no feed (desenho 22): o nome, quantos deram parabéns e o botão.
  if (post.type === "BIRTHDAY") {
    const who = people.find(person => person.id === post.recipientId)?.name ?? post.authorName;
    return <article className="comm-post comm-birthday"><div className="comm-birthday-head"><img src="/asa/olhos-de-estrela.webp" alt=""/><div><strong>Hoje é aniversário de {who}! 🎂</strong><small>{post.reactionCount ?? 0} parabéns até agora</small></div></div><footer><button className={minha ? "active" : ""} onClick={() => onReact(post.id, minha ? null : "🎂")} disabled={reagindo}><Heart size={16}/> {minha ? "você deu parabéns" : reagindo ? "Enviando…" : "Dar parabéns"}</button><span/><button onClick={onComment}><MessageCircle size={16}/> {post.commentCount ?? 0}</button></footer></article>;
  }
  const ack = post.ackSummary; const ackPercent = ack && ack.total ? Math.round((ack.confirmados / ack.total) * 100) : 0;
  const nomes = post.recipientNames ?? [];
  const recipient = people.find(person => person.id === post.recipientId);
  const acknowledgement = post.requiresConfirmation && !post.mine?.confirmedAt;
  return <article className={`comm-post ${pinned ? "pinned" : ""} ${post.type.toLocaleLowerCase("pt-BR")}`}>
    <header><span className="comm-post-badge">{ETIQUETA[post.type]}</span><b>{post.authorName}</b><small>· {displayDate(post.publishedAt)}{post.editedAt ? " · editado" : ""} · para {scopeText(post)}</small></header>
    {post.type === "RECOGNITION" && (nomes.length > 1
      ? <div className="comm-recipient"><span className="comm-avatar">{nomes.length}</span><div><strong>{peopleText(nomes)}</strong>{post.destinationLabel && <small>{post.destinationLabel}</small>}</div></div>
      : (recipient || nomes[0]) && <div className="comm-recipient"><span className="comm-avatar">{initials(recipient?.name ?? nomes[0]!)}</span><div><strong>{recipient?.name ?? nomes[0]}</strong><small>{recipient?.areaName}</small></div></div>)}
    {post.eventDate && <span className="comm-event-date"><CalendarDays size={14}/> {new Date(`${post.eventDate}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" })}</span>}
    {post.title && <h2>{post.title}</h2>}
    <p>{post.body}</p>
    {post.type === "RECOGNITION" && post.reason && <small className="comm-reason">por {post.reason}</small>}
    {ack && <div className="comm-ack-progress"><div><b>{ack.confirmados} de {ack.total}</b> deram ciente{ack.total > ack.confirmados && <button type="button" onClick={onMissing}>quem falta</button>}</div><span role="progressbar" aria-label="Ciente" aria-valuemin={0} aria-valuemax={100} aria-valuenow={ackPercent}><i style={{ width: `${ackPercent}%` }}/></span></div>}
    <Reacoes post={post} minha={minha} ocupado={reagindo} onReact={emoji => onReact(post.id, emoji)} onWho={onWho}/>
    <footer>
      {acknowledgement ? <button className="comm-ack" onClick={() => onAck(post.id)} disabled={registrandoCiente}><Check size={16}/> {registrandoCiente ? "Registrando…" : "Li e entendi"}</button> : post.requiresConfirmation ? <span className="comm-confirmed"><Check size={15}/> ciente</span> : null}
      <span/>
      <button onClick={onComment}><MessageCircle size={16}/> {post.commentCount ?? 0}</button>
      {post.canEdit && <button onClick={onEdit}><Pencil size={15}/> editar</button>}
      {post.canCancel && <button className="comm-cancel" onClick={onCancel}>{post.type === "NOTICE" ? "cancelar aviso" : "remover"}</button>}
    </footer>
  </article>;
}

function Reacoes({ post, minha, ocupado, onReact, onWho }: { post: Post; minha: string | null; ocupado: boolean; onReact: (emoji: string | null) => void; onWho: () => void }) {
  const [aberto, setAberto] = useState(false);
  const reactions = post.reactions ?? [];
  return <div className="comm-reacoes">
    {reactions.map(item => <button key={item.emoji} type="button" className={item.emoji === minha ? "active" : ""} aria-pressed={item.emoji === minha} disabled={ocupado} onClick={() => onReact(item.emoji === minha ? null : item.emoji)}>{item.emoji} {item.count}</button>)}
    <button type="button" className="comm-reagir" aria-expanded={aberto} onClick={() => setAberto(valor => !valor)}><SmilePlus size={16}/> reagir</button>
    {aberto && <span className="comm-picker" role="group" aria-label="Escolha uma reação">{REACOES.map(emoji => <button key={emoji} type="button" aria-label={`Reagir com ${emoji}`} className={emoji === minha ? "active" : ""} onClick={() => { setAberto(false); onReact(emoji === minha ? null : emoji); }}>{emoji}</button>)}</span>}
    {reactions.length > 0 && <button type="button" className="comm-link" onClick={onWho}>quem reagiu</button>}
  </div>;
}

// ─── Para quem ────────────────────────────────────────────────────────────────

function ParaQuem({ destino, onChange, areas, locations, people, permitirCasa, rotulo }: {
  destino: Destino; onChange: (atualiza: (atual: Destino) => Destino) => void; areas: Option[]; locations: Option[]; people: Person[]; permitirCasa: boolean; rotulo: string;
}) {
  const [busca, setBusca] = useState("");
  // Sempre a partir do estado mais novo: dois toques seguidos não podem apagar um ao outro.
  const alternar = (campo: "areaIds" | "locationIds" | "pessoaIds", id: string) => onChange(atual => {
    const conjunto = new Set(atual[campo]); if (conjunto.has(id)) conjunto.delete(id); else conjunto.add(id);
    return { ...atual, [campo]: conjunto };
  });
  const termo = busca.trim().toLocaleLowerCase("pt-BR");
  const filtradas = people.filter(person => `${person.name} ${person.areaName ?? ""}`.toLocaleLowerCase("pt-BR").includes(termo));
  const resumo = rotuloDoDestino(destino, areas, locations, people);
  return <fieldset className="comm-people comm-paraquem">
    <legend>{rotulo} <b>{resumo || "ninguém marcado ainda"}</b></legend>
    {permitirCasa && <label className="comm-check"><input type="checkbox" checked={destino.casa} onChange={event => { const marcada = event.target.checked; onChange(atual => ({ ...atual, casa: marcada })); }}/> Toda a casa</label>}
    {!destino.casa && <>
      {areas.length > 0 && <div className="comm-chips" role="group" aria-label="Áreas"><span>Áreas</span>{areas.map(area => <button key={area.id} type="button" aria-pressed={destino.areaIds.has(area.id)} className={destino.areaIds.has(area.id) ? "on" : ""} onClick={() => alternar("areaIds", area.id)}>{area.name}</button>)}</div>}
      {locations.length > 0 && <div className="comm-chips" role="group" aria-label="Locais"><span>Locais</span>{locations.map(local => <button key={local.id} type="button" aria-pressed={destino.locationIds.has(local.id)} className={destino.locationIds.has(local.id) ? "on" : ""} onClick={() => alternar("locationIds", local.id)}>{local.name}</button>)}</div>}
      <div className="comm-chips"><span>Pessoas</span></div>
      {destino.pessoaIds.size > 0 && <div className="comm-people-chosen">{people.filter(person => destino.pessoaIds.has(person.id)).map(person => <button type="button" key={person.id} onClick={() => alternar("pessoaIds", person.id)} aria-label={`Tirar ${person.name}`}>{person.name} <X size={13}/></button>)}</div>}
      <input type="search" value={busca} onChange={event => setBusca(event.target.value)} placeholder="Buscar pelo nome ou pela área" aria-label="Buscar pessoa"/>
      <div className="comm-people-list" role="group" aria-label="Pessoas">{filtradas.map(person => <label key={person.id} className="comm-check"><input type="checkbox" checked={destino.pessoaIds.has(person.id)} onChange={() => alternar("pessoaIds", person.id)}/> {person.name}{person.areaName && <small> · {person.areaName}</small>}</label>)}</div>
    </>}
  </fieldset>;
}

// ─── Janelas ──────────────────────────────────────────────────────────────────

function Composer({ tipo, role, sample, people, areas, locations, onClose, onDone, onSampleDone }: {
  tipo: Compor; role: Role; sample: boolean; people: Person[]; areas: Option[]; locations: Option[]; onClose: () => void; onDone: () => void; onSampleDone: (post: Post) => void;
}) {
  const [destino, setDestino] = useState<Destino>(() => ({ ...destinoVazio(), casa: tipo !== "RECOGNITION" }));
  const [erro, setErro] = useState(""), [enviando, setEnviando] = useState(false);
  const titulos: Record<Compor, string> = { NOTICE: "Novo aviso oficial", POST: "Nova publicação", RECOGNITION: "Reconhecer alguém" };
  const publicar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = String(form.get("body") ?? "").trim(), title = String(form.get("title") ?? "").trim() || null, reason = String(form.get("reason") ?? "").trim() || null;
    const eventDate = String(form.get("eventDate") ?? "") || null, requiresConfirmation = Boolean(form.get("requiresConfirmation"));
    if (!marcouAlgo(destino)) { setErro(tipo === "RECOGNITION" ? "Marque quem você quer reconhecer: pessoas, uma área ou um local." : "Marque para quem vai: a casa, uma área, um local ou pessoas."); return; }
    setErro("");
    const rotulo = rotuloDoDestino(destino, areas, locations, people);
    if (sample) {
      const escolhidas = people.filter(person => destino.pessoaIds.has(person.id)).map(person => person.name);
      onSampleDone({ id: `sample-post-${Date.now()}`, type: tipo, scope: destino.casa ? "HOUSE" : "PEOPLE", destinationLabel: destino.casa ? null : rotulo, recipientNames: tipo === "RECOGNITION" ? escolhidas : undefined, title, body, reason, eventDate, authorName: REVIEW_PERSON[role], ehMeu: true, canEdit: true, canCancel: true, requiresConfirmation: tipo === "NOTICE" && requiresConfirmation, publishedAt: now(), commentCount: 0 });
      return;
    }
    setEnviando(true);
    try {
      await customFetch("/api/communication/mural", { method: "POST", body: JSON.stringify({ type: tipo, title, body, reason, eventDate, requiresConfirmation, destinos: { casa: destino.casa, areaIds: [...destino.areaIds], locationIds: [...destino.locationIds], pessoaIds: [...destino.pessoaIds] } }) });
      onDone();
    } catch (err) { setErro(serverError(err, "Não consegui publicar agora. O que você escreveu continua aqui; confira os campos e tente de novo.")); }
    finally { setEnviando(false); }
  };
  return <Modal title={titulos[tipo]} onClose={onClose}>
    <form className="comm-form" onSubmit={publicar}>
      {tipo !== "RECOGNITION" && <label>Título {tipo === "POST" && <small>(opcional)</small>}<input name="title" placeholder={tipo === "NOTICE" ? "O que a casa precisa saber" : "Do que se trata"}/></label>}
      <ParaQuem destino={destino} onChange={setDestino} areas={areas} locations={locations} people={people} permitirCasa={tipo !== "RECOGNITION"} rotulo={tipo === "RECOGNITION" ? "Quem você reconhece" : "Para"}/>
      {tipo === "RECOGNITION" && <label>Por quê<textarea name="reason" required placeholder="Motivo do reconhecimento"/></label>}
      {tipo !== "RECOGNITION" && <label>Data do evento <small>(opcional)</small><input type="date" name="eventDate"/></label>}
      {tipo === "NOTICE" && <><label className="comm-check"><input type="checkbox" name="requiresConfirmation"/> Pede ciente</label><p className="comm-note">Quem recebe é avisado no sino. Com ciente, o aviso chega como alerta e fica no topo do Mural de cada pessoa até ela confirmar que leu.</p></>}
      {tipo === "POST" && <p className="comm-note">A publicação aparece no Mural. Só quem você marcar (ou a área ou o local) é avisado no sino; a casa toda não. A Administração pode tirar do ar o que não couber aqui.</p>}
      <label>{tipo === "NOTICE" ? "Aviso" : tipo === "POST" ? "Publicação" : "Reconhecimento"}<textarea name="body" required placeholder={tipo === "NOTICE" ? "Escreva o aviso" : tipo === "POST" ? "Escreva para a casa" : "Conte o que essas pessoas fizeram"}/></label>
      {erro && <p className="comm-form-error" role="alert">{erro}</p>}
      <footer><button type="button" onClick={onClose}>Cancelar</button><button className="comm-primary" disabled={enviando}>{enviando ? "Publicando…" : "Publicar"}</button></footer>
    </form>
  </Modal>;
}

function Editar({ post, sample, onClose, onDone }: { post: Post; sample: boolean; onClose: () => void; onDone: (post: Post) => void }) {
  const [erro, setErro] = useState(""), [salvando, setSalvando] = useState(false);
  const recon = post.type === "RECOGNITION", oficial = post.type === "NOTICE";
  const salvar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    // A edição vale sobre a versão que está aberta: se alguém editou antes, o servidor recusa em vez de apagar a edição dela.
    const corpo: Record<string, unknown> = { body: String(form.get("body") ?? "").trim(), baseEditedAt: post.editedAt ?? null };
    if (recon) corpo.reason = String(form.get("reason") ?? "").trim();
    else { corpo.title = String(form.get("title") ?? "").trim() || null; corpo.eventDate = String(form.get("eventDate") ?? "") || null; }
    if (oficial) { corpo.pedirCienteDeNovo = Boolean(form.get("pedirCienteDeNovo")); corpo.avisar = Boolean(form.get("avisar")); }
    if (!corpo.body) { setErro("O texto não pode ficar vazio."); return; }
    setErro(""); setSalvando(true);
    try {
      if (sample) { onDone({ ...post, body: corpo.body as string, title: (corpo.title as string | null | undefined) ?? post.title, reason: (corpo.reason as string | undefined) ?? post.reason, editedAt: now() }); return; }
      const result = await customFetch<{ post: Partial<Post> }>(`/api/communication/mural/${post.id}`, { method: "PATCH", body: JSON.stringify(corpo) });
      onDone({ ...post, ...result.post, editedAt: result.post.editedAt ?? now() });
    } catch (err) { setErro(serverError(err, "Não consegui salvar a edição agora. O que você escreveu continua aqui; tente de novo.")); }
    finally { setSalvando(false); }
  };
  return <Modal title={recon ? "Editar reconhecimento" : post.type === "NOTICE" ? "Editar aviso" : "Editar publicação"} onClose={onClose}>
    <form className="comm-form" onSubmit={salvar}>
      {!recon && <label>Título<input name="title" defaultValue={post.title ?? ""}/></label>}
      {recon && <label>Por quê<textarea name="reason" required defaultValue={post.reason ?? ""}/></label>}
      {!recon && <label>Data do evento <small>(opcional)</small><input type="date" name="eventDate" defaultValue={post.eventDate ?? ""}/></label>}
      <label>Texto<textarea name="body" required defaultValue={post.body}/></label>
      {oficial && post.requiresConfirmation && <label className="comm-check"><input type="checkbox" name="pedirCienteDeNovo"/> Pedir ciente de novo</label>}
      {oficial && <label className="comm-check"><input type="checkbox" name="avisar"/> Avisar no sino que mudou</label>}
      <p className="comm-note">{oficial ? "Por padrão a edição é silenciosa: o cartão passa a mostrar “editado” e ninguém recebe aviso. " + (post.requiresConfirmation ? "Quem já deu ciente continua com o ciente, a não ser que você peça de novo." : "") : "O cartão passa a mostrar “editado”. Só a edição do texto muda; o destino fica como foi publicado."}</p>
      {erro && <p className="comm-form-error" role="alert">{erro}</p>}
      <footer><button type="button" onClick={onClose}>Cancelar</button><button className="comm-primary" disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</button></footer>
    </form>
  </Modal>;
}

function Remover({ post, sample, onClose, onDone }: { post: Post; sample: boolean; onClose: () => void; onDone: () => void }) {
  const [erro, setErro] = useState(""), [removendo, setRemovendo] = useState(false);
  const aviso = post.type === "NOTICE";
  const remover = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const reason = String(new FormData(event.currentTarget).get("reason") ?? "").trim();
    if (!reason) { setErro(aviso ? "Escreva o motivo do cancelamento." : "Escreva o motivo da remoção."); return; }
    if (sample) { onDone(); return; }
    setRemovendo(true); setErro("");
    try { await customFetch(`/api/communication/mural/${post.id}/cancel`, { method: "POST", body: JSON.stringify({ reason }) }); onDone(); }
    catch (err) { setErro(serverError(err, `Não consegui ${aviso ? "cancelar" : "remover"} agora. Continua publicado.`)); }
    finally { setRemovendo(false); }
  };
  return <Modal title={aviso ? "Cancelar aviso" : "Remover publicação"} onClose={onClose}>
    <form className="comm-form" onSubmit={remover}>
      <p className="comm-note">“{assunto(post)}” sai do Mural de todo mundo. O motivo fica no Registro e vai para quem publicou. Você pode trazer de volta logo depois (“Desfazer”) ou depois, em “Removidas”.</p>
      <label>Motivo<textarea name="reason" required autoFocus placeholder={aviso ? "Por que este aviso não vale mais" : "Por que isto sai do Mural"}/></label>
      {erro && <p className="comm-form-error" role="alert">{erro}</p>}
      <footer><button type="button" onClick={onClose}>Voltar</button><button className="comm-danger" disabled={removendo}>{removendo ? "Removendo…" : aviso ? "Cancelar aviso" : "Remover"}</button></footer>
    </form>
  </Modal>;
}

function Comentarios({ id, sample, role, onClose, onCount }: { id: string; sample: boolean; role: Role; onClose: () => void; onCount: (delta: number) => void }) {
  type Comentario = { id: string; body: string; authorName: string; createdAt: string };
  const [comments, setComments] = useState<Comentario[]>([]), [carregando, setCarregando] = useState(!sample), [erro, setErro] = useState(""), [enviando, setEnviando] = useState(false);
  useEffect(() => {
    if (sample) return;
    let vivo = true;
    customFetch<{ comments: Comentario[] }>(`/api/communication/mural/${id}/comments`)
      .then(result => { if (vivo) setComments(result.comments); })
      .catch(err => { if (vivo) setErro(serverError(err, "Não consegui carregar os comentários. Feche e abra de novo.")); })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [id, sample]);
  const enviar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // O React zera `event.currentTarget` assim que o clique termina; depois de um `await` ele já é nulo.
    const form = event.currentTarget;
    if (enviando) return;
    const body = String(new FormData(form).get("body") ?? "").trim(); if (!body) return;
    if (sample) { setComments(rows => [...rows, { id: `sample-comment-${Date.now()}`, body, authorName: REVIEW_PERSON[role], createdAt: now() }]); onCount(1); form.reset(); return; }
    setEnviando(true); setErro("");
    try {
      const result = await customFetch<{ comment: Comentario }>(`/api/communication/mural/${id}/comments`, { method: "POST", body: JSON.stringify({ body }) });
      setComments(rows => [...rows, result.comment]); onCount(1); form.reset();
    } catch (err) { setErro(serverError(err, "Não consegui comentar agora. O que você escreveu continua aqui; tente de novo.")); }
    finally { setEnviando(false); }
  };
  return <Modal title="Comentários" onClose={onClose}>
    <div className="comm-comments" aria-busy={carregando}>{carregando ? <p>Carregando os comentários…</p> : comments.length ? comments.map(comment => <article key={comment.id}><strong>{comment.authorName}</strong><p>{comment.body}</p><small>{displayDate(comment.createdAt)}</small></article>) : erro ? null : <p>Ainda não há comentários.</p>}</div>
    <form className="comm-form" onSubmit={enviar}>
      <label>Comentário<textarea name="body" required autoFocus/></label>
      {erro && <p className="comm-form-error" role="alert">{erro}</p>}
      <footer><button type="button" onClick={onClose}>Fechar</button><button className="comm-primary" disabled={enviando}>{enviando ? "Enviando…" : "Enviar"}</button></footer>
    </form>
  </Modal>;
}

function QuemReagiu({ post, sample, onClose }: { post: Post; sample: boolean; onClose: () => void }) {
  type Grupo = { emoji: string; pessoas: string[] };
  const [grupos, setGrupos] = useState<Grupo[] | null>(null), [erro, setErro] = useState("");
  useEffect(() => {
    if (sample) { setGrupos((post.reactions ?? []).map(item => ({ emoji: item.emoji, pessoas: samplePeople.slice(0, item.count).map(person => person.name) }))); return; }
    let vivo = true;
    customFetch<{ reacoes: Grupo[] }>(`/api/communication/mural/${post.id}/reacoes`).then(result => { if (vivo) setGrupos(result.reacoes); }).catch(err => { if (vivo) setErro(serverError(err, "Não consegui ver quem reagiu agora.")); });
    return () => { vivo = false; };
  }, [post.id, post.reactions, sample]);
  return <Modal title="Quem reagiu" onClose={onClose}>
    <div className="comm-missing">{erro ? <p className="comm-form-error" role="alert">{erro}</p> : grupos === null ? <p className="comm-note">Carregando…</p> : grupos.length ? grupos.map(grupo => <div key={grupo.emoji}><h3>{grupo.emoji} {grupo.pessoas.length}</h3><ul>{grupo.pessoas.map((nome, indice) => <li key={`${nome}-${indice}`}>{nome}</li>)}</ul></div>) : <p className="comm-note">Ninguém reagiu ainda.</p>}</div>
    <footer className="comm-modal-footer"><button type="button" onClick={onClose}>Fechar</button></footer>
  </Modal>;
}

function Removidas({ sample, locais, busy, onVoltar, onClose }: { sample: boolean; locais: Post[]; busy: Set<string>; onVoltar: (id: string, titulo: string) => Promise<void>; onClose: () => void }) {
  const [lista, setLista] = useState<Removida[] | null>(sample ? [] : null), [erro, setErro] = useState("");
  const carregar = () => customFetch<{ removidos: Removida[] }>("/api/communication/mural/removidos").then(result => setLista(result.removidos)).catch(err => setErro(serverError(err, "Não consegui listar o que foi removido.")));
  useEffect(() => { if (!sample) void carregar(); }, [sample]);
  const itens: Removida[] | null = sample
    ? locais.map(post => ({ id: post.id, type: post.type, title: post.title, body: post.body, cancelledAt: now(), motivo: "Removida agora, na revisão", authorName: post.authorName, removidoPor: null, canRestore: true }))
    : lista;
  const voltar = async (item: Removida) => { await onVoltar(item.id, assunto(item)); if (!sample) await carregar(); };
  return <Modal title="Removidas" onClose={onClose}>
    <div className="comm-form">
      <p className="comm-note">O que saiu do Mural nos últimos 60 dias. Quem publicou vê o que removeu; a Administração e a Direção veem tudo. Nada é apagado: dá para trazer de volta.</p>
      {erro && <p className="comm-form-error" role="alert">{erro}</p>}
      {itens === null && !erro && <p className="comm-note">Carregando…</p>}
      {itens && !itens.length && <p className="comm-note">Nada foi removido nos últimos 60 dias.</p>}
      {itens && itens.length > 0 && <ul className="comm-removidas">{itens.map(item => <li key={item.id}>
        <div><span className="comm-post-badge">{ETIQUETA[item.type]}</span><strong>{assunto(item)}</strong><small>por {item.authorName}{item.removidoPor ? ` · removida por ${item.removidoPor}` : ""} · {displayDate(item.cancelledAt)}</small><small>Motivo: {item.motivo}</small></div>
        {item.canRestore ? <button type="button" className="comm-secondary" disabled={busy.has(`voltar:${item.id}`)} onClick={() => void voltar(item)}><Undo2 size={15}/> {busy.has(`voltar:${item.id}`) ? "Voltando…" : "Trazer de volta"}</button> : <small>Só a Administração ou a Direção traz de volta.</small>}
      </li>)}</ul>}
      <footer className="comm-modal-footer"><button type="button" onClick={onClose}>Fechar</button></footer>
    </div>
  </Modal>;
}

function DatasEspeciais({ sample, onClose, onMudou }: { sample: boolean; onClose: () => void; onMudou: () => void }) {
  const [lista, setLista] = useState<DataCadastrada[] | null>(sample ? [{ id: "s1", nome: "Dia do Teatro", mensagem: "Hoje é o dia de quem faz a cena acontecer.", mes: 3, dia: 27, active: true }, { id: "s2", nome: "Dia da Dança", mensagem: null, mes: 4, dia: 29, active: true }] : null);
  const [editando, setEditando] = useState<DataCadastrada | null>(null), [erro, setErro] = useState(""), [salvando, setSalvando] = useState(false);
  const carregar = () => customFetch<{ datas: DataCadastrada[] }>("/api/communication/datas-especiais").then(result => setLista(result.datas)).catch(err => setErro(serverError(err, "Não consegui listar as datas especiais.")));
  useEffect(() => { if (!sample) void carregar(); }, [sample]);
  const agir = async (acao: () => Promise<void>, falha: string) => { setSalvando(true); setErro(""); try { await acao(); if (!sample) await carregar(); onMudou(); } catch (err) { setErro(serverError(err, falha)); } finally { setSalvando(false); } };
  const salvar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const dados = new FormData(form);
    const corpo = { nome: String(dados.get("nome") ?? "").trim(), mensagem: String(dados.get("mensagem") ?? "").trim() || null, dia: Number(dados.get("dia")), mes: Number(dados.get("mes")) };
    await agir(async () => {
      if (sample) setLista(rows => editando ? (rows ?? []).map(item => item.id === editando.id ? { ...item, ...corpo } : item) : [...(rows ?? []), { id: `s${Date.now()}`, ...corpo, active: true }]);
      else if (editando) await customFetch(`/api/communication/datas-especiais/${editando.id}`, { method: "PATCH", body: JSON.stringify(corpo) });
      else await customFetch("/api/communication/datas-especiais", { method: "POST", body: JSON.stringify(corpo) });
      setEditando(null); form.reset();
    }, "Não consegui salvar a data. O que você escreveu continua aqui; confira o dia e o mês.");
  };
  const mudar = (item: DataCadastrada, acao: "remover" | "restaurar") => agir(async () => {
    if (sample) setLista(rows => (rows ?? []).map(data => data.id === item.id ? { ...data, active: acao === "restaurar" } : data));
    else if (acao === "remover") await customFetch(`/api/communication/datas-especiais/${item.id}`, { method: "DELETE" });
    else await customFetch(`/api/communication/datas-especiais/${item.id}/restore`, { method: "POST" });
  }, acao === "remover" ? "Não consegui remover a data agora." : "Não consegui trazer a data de volta agora.");
  return <Modal title="Datas especiais" onClose={onClose}>
    <div className="comm-form">
      <p className="comm-note">Datas que se repetem todo ano (Dia do Teatro, Dia da Dança…). O Mural mostra a data durante a semana e no dia, com a mensagem. Quem cadastra: Administração e Direção.</p>
      <form className="comm-form comm-datas-form" key={editando?.id ?? "nova"} onSubmit={salvar}>
        <label>Nome<input name="nome" required maxLength={80} defaultValue={editando?.nome ?? ""} placeholder="Dia do Teatro"/></label>
        <div className="comm-datas-dia"><label>Dia<input name="dia" type="number" min={1} max={31} required defaultValue={editando?.dia ?? ""}/></label><label>Mês<select name="mes" required defaultValue={editando?.mes ?? ""}><option value="" disabled>Escolha</option>{MESES.map((nome, indice) => <option key={nome} value={indice + 1}>{nome}</option>)}</select></label></div>
        <label>Mensagem <small>(opcional, aparece no dia)</small><textarea name="mensagem" maxLength={280} defaultValue={editando?.mensagem ?? ""}/></label>
        <footer>{editando && <button type="button" onClick={() => setEditando(null)}>Cancelar edição</button>}<button className="comm-primary" disabled={salvando}>{salvando ? "Salvando…" : editando ? "Salvar" : "Cadastrar data"}</button></footer>
      </form>
      {erro && <p className="comm-form-error" role="alert">{erro}</p>}
      {lista === null && !erro && <p className="comm-note">Carregando…</p>}
      {lista && !lista.length && <p className="comm-note">Nenhuma data cadastrada ainda.</p>}
      {lista && lista.length > 0 && <ul className="comm-removidas">{lista.map(item => <li key={item.id} className={item.active ? "" : "removida"}>
        <div><strong>{item.nome}</strong><small>{String(item.dia).padStart(2, "0")} de {MESES[item.mes - 1]}{item.active ? "" : " · removida"}</small>{item.mensagem && <small>{item.mensagem}</small>}</div>
        <div className="comm-datas-acoes">{item.active ? <><button type="button" onClick={() => setEditando(item)}>Editar</button><button type="button" disabled={salvando} onClick={() => void mudar(item, "remover")}>Remover</button></> : <button type="button" disabled={salvando} onClick={() => void mudar(item, "restaurar")}>Trazer de volta</button>}</div>
      </li>)}</ul>}
      <footer className="comm-modal-footer"><button type="button" onClick={onClose}>Fechar</button></footer>
    </div>
  </Modal>;
}
