/**
 * Mensagens: o chat da casa, no jeito do WhatsApp mas para o trabalho. Conversa direta, grupo da área
 * (automático), grupo da casa (criado pela Administração/Direção) e grupo criado por qualquer pessoa. Texto,
 * figurinhas da ASA e reações; "visto por" só para quem enviou. A Administração e a Direção veem que o grupo
 * existe e quem está nele, nunca o que se conversa. No telefone é lista → conversa em tela cheia.
 * O estilo mora em pages/mensagens.css.
 */
import { FormEvent, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, BellOff, Check, CheckCheck, Pin, Plus, Reply, Search, Send, SmilePlus, Sticker, Users, X } from "lucide-react";
import { customFetch } from "@workspace/api-client-react";
import exampleData from "../../../../design_handoff_my_asa/dados-de-exemplo.json";
import { REVIEW_PERSON } from "@/lib/amostra";
import { useAuth } from "@/hooks/useAuth";
import { Modal, initials, now, serverError, type Option, type Person, type Role } from "@/components/comm-ui";
import "./communication.css"; // janelas, formulários e seletor de pessoas compartilhados
import "./mensagens.css";

type Integrante = { userId: string; name: string; role?: string };
type Conversa = {
  id: string; title: string; contextType?: string | null; status?: string; closedReason?: string | null; createdAt?: string;
  participants: Integrante[]; lastMessage?: { content: string; senderName: string | null; createdAt: string } | null;
  unreadCount?: number; pinned?: boolean; muted?: boolean; podeGerir?: boolean; myRole?: string;
};
type Reacao = { emoji: string; count: number; pessoas: string[] };
type Msg = {
  id: string; content: string; kind: "TEXT" | "STICKER"; senderId: string; senderName: string | null; createdAt: string; quotedMessageId?: string | null;
  reacoes?: Reacao[]; minhaReacao?: string | null; vistoPor?: string[]; estado?: "enviando" | "falhou";
};
type GrupoAdmin = { id: string; title: string; tipo: string; status: string; closedReason?: string | null; criadoPor?: string | null; arquivadoPor?: string | null; integrantes: { userId: string; name: string }[]; total: number; ultimaMensagemEm?: string | null };

/** As mesmas do servidor (services/mensagens.ts). */
const REACOES = ["❤️", "👏", "🎉", "😂", "🙏", "🎂"];
const FIGURINHAS = ["oi", "bom-dia", "vencemos", "tarefa-concluida", "olhos-de-estrela", "travessa", "lembrete", "atencao", "aviso-importante", "duvida", "pensativa", "consultando", "estudando", "sonolenta"];
const NOME_FIGURINHA: Record<string, string> = { oi: "Oi", "bom-dia": "Bom dia", vencemos: "Vencemos", "tarefa-concluida": "Tarefa pronta", "olhos-de-estrela": "Uau", travessa: "Travessa", lembrete: "Lembrete", atencao: "Atenção", "aviso-importante": "Importante", duvida: "Dúvida", pensativa: "Pensando", consultando: "Consultando", estudando: "Estudando", sonolenta: "Sono" };

const samplePeople: Person[] = exampleData.pessoas.map((person, index) => ({ id: `sample-person-${index}`, name: person.nome_de_exibicao, areaName: exampleData.areas.find(area => area.id === person.area)?.nome ?? null }));
const sampleAreas: Option[] = exampleData.areas.map(area => ({ id: area.id, name: area.nome }));

const EH_GRUPO = (conversa: Pick<Conversa, "contextType">) => ["GROUP", "HOUSE_GROUP", "AREA_GROUP"].includes(conversa.contextType ?? "");
const hora = (iso?: string) => {
  if (!iso) return "";
  const data = new Date(iso), hoje = new Date();
  return data.toDateString() === hoje.toDateString() ? data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
};
/** Na conversa: hora se for de hoje; senão dia e hora. */
const horaCompleta = (iso: string) => {
  const data = new Date(iso), hoje = new Date();
  const h = data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return data.toDateString() === hoje.toDateString() ? h : `${data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} ${h}`;
};
const quemEstaNaConversa = (conversa: Conversa) => conversa.contextType === "DIRECT" ? "conversa direta" : `${conversa.contextType === "HOUSE_GROUP" ? "grupo da casa" : conversa.contextType === "AREA_GROUP" ? "grupo da área" : "grupo"} · ${conversa.participants.length} ${conversa.participants.length === 1 ? "pessoa" : "pessoas"}`;
const resumoDaUltima = (conversa: Conversa, eu: string) => !conversa.lastMessage ? "Conversa nova"
  : `${conversa.lastMessage.senderName && conversa.lastMessage.senderName === eu ? "Você: " : EH_GRUPO(conversa) && conversa.lastMessage.senderName ? `${conversa.lastMessage.senderName.split(" ")[0]}: ` : ""}${conversa.lastMessage.content}`;

function amostraDeConversas(eu: string): { conversas: Conversa[]; mensagens: Record<string, Msg[]> } {
  const barbara = { userId: "sample-person-b", name: "Barbara" }, carol = { userId: "sample-person-c", name: "Carol" }, louis = { userId: "sample-person-l", name: "Louis" }, sofia = { userId: "sample-person-s", name: "Sofia" }, yo = { userId: "me", name: eu };
  const t = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
  const conversas: Conversa[] = [
    { id: "s-dm", title: "Carol", contextType: "DIRECT", participants: [yo, carol], lastMessage: { content: "Combinado, obrigada!", senderName: "Carol", createdAt: t(5) }, unreadCount: 1, myRole: "INITIATOR" },
    { id: "s-area", title: "Patinadores · grupo da área", contextType: "AREA_GROUP", participants: [yo, carol, louis, sofia, barbara], lastMessage: { content: "Ensaio geral às 9h!", senderName: "Sofia", createdAt: t(40) }, unreadCount: 3, myRole: "PARTICIPANT" },
    { id: "s-midias", title: "Mídias do Natal", contextType: "GROUP", participants: [yo, louis, sofia], lastMessage: { content: "oi", senderName: "Louis", createdAt: t(200) }, podeGerir: true, myRole: "INITIATOR" },
    { id: "s-casa", title: "Meninas", contextType: "HOUSE_GROUP", participants: [yo, carol, sofia], lastMessage: { content: "Figurinha", senderName: "Carol", createdAt: t(600) }, myRole: "PARTICIPANT", muted: true },
    { id: "s-arq", title: "Campanha de outubro", contextType: "GROUP", status: "CLOSED", closedReason: "Acabou a campanha", participants: [yo, louis], lastMessage: { content: "Valeu, pessoal", senderName: "Louis", createdAt: t(5000) }, myRole: "PARTICIPANT" },
  ];
  const m = (id: string, de: Integrante, content: string, min: number, extra: Partial<Msg> = {}): Msg => ({ id, content, kind: "TEXT", senderId: de.userId, senderName: de.name, createdAt: t(min), reacoes: [], minhaReacao: null, ...extra });
  const mensagens: Record<string, Msg[]> = {
    "s-dm": [m("1", yo, "Oi Carol, você consegue trocar o horário de quinta?", 30, { vistoPor: ["Carol"] }), m("2", carol, "Consigo sim! Que horas fica melhor?", 20), m("3", yo, "Às 15h", 12, { vistoPor: ["Carol"] }), m("4", carol, "Combinado, obrigada!", 5, { reacoes: [{ emoji: "👏", count: 1, pessoas: ["Carol"] }] })],
    "s-area": [m("5", sofia, "Bom dia, pessoal!", 90), m("6", louis, "bom-dia", 80, { kind: "STICKER" }), m("7", yo, "Quem leva a caixa de som?", 60, { vistoPor: ["Carol", "Louis", "Sofia"], reacoes: [{ emoji: "🙏", count: 2, pessoas: ["Louis", "Sofia"] }] }), m("8", sofia, "Ensaio geral às 9h!", 40, { quotedMessageId: "7" })],
    "s-midias": [m("9", yo, "Vamos dividir as fotos do Natal por dia?", 300, { vistoPor: ["Louis"] }), m("10", louis, "oi", 200)],
    "s-casa": [m("11", carol, "vencemos", 600, { kind: "STICKER", reacoes: [{ emoji: "🎉", count: 3, pessoas: [eu, "Sofia", "Barbara"] }], minhaReacao: "🎉" })],
    "s-arq": [m("12", louis, "Valeu, pessoal", 5000)],
  };
  return { conversas, mensagens };
}

export function MessagesPage({ role }: { role: Role }) {
  const sample = import.meta.env.DEV && new URLSearchParams(window.location.search).get("amostra") === "1";
  const { user } = useAuth();
  const eu = sample ? REVIEW_PERSON[role] : ((user as { displayName?: string } | null)?.displayName ?? user?.name ?? "");
  const meuId = sample ? "me" : (user?.id ?? "");
  const gestao = role === "adm" || role === "dir";

  const [conversas, setConversas] = useState<Conversa[]>([]), [pessoas, setPessoas] = useState<Person[]>([]), [areas, setAreas] = useState<Option[]>([]);
  const [carregouLista, setCarregouLista] = useState(false), [erroLista, setErroLista] = useState("");
  const [ativaId, setAtivaId] = useState<string | null>(null), [mensagens, setMensagens] = useState<Msg[]>([]), [participantes, setParticipantes] = useState<Integrante[]>([]);
  const [carregandoConversa, setCarregandoConversa] = useState(false), [erroConversa, setErroConversa] = useState("");
  const [aviso, setAviso] = useState("");
  const [busca, setBusca] = useState(""), [filtro, setFiltro] = useState<"todas" | "naoLidas" | "grupos">("todas");
  const [texto, setTexto] = useState(""), [rascunhos, setRascunhos] = useState<Record<string, string>>({}), [citando, setCitando] = useState<Msg | null>(null);
  const [figurinhasAbertas, setFigurinhasAbertas] = useState(false), [reagindoEm, setReagindoEm] = useState<string | null>(null), [selecionada, setSelecionada] = useState<string | null>(null);
  const [novaAberta, setNovaAberta] = useState(false), [integrantesAberto, setIntegrantesAberto] = useState(false), [gruposAberto, setGruposAberto] = useState(false), [vistoPorDe, setVistoPorDe] = useState<Msg | null>(null);
  const amostra = useRef(amostraDeConversas(eu || "Julia"));
  const rolagem = useRef<HTMLDivElement>(null), colada = useRef(true);

  const ativa = conversas.find(conversa => conversa.id === ativaId) ?? null;
  const encerrada = ativa?.status === "CLOSED";

  // ─ Lista ─
  const carregarLista = useCallback((silencioso = false) => {
    if (sample) {
      setConversas(amostra.current.conversas); setPessoas(samplePeople); setAreas(sampleAreas); setCarregouLista(true); return;
    }
    if (!silencioso) setErroLista("");
    Promise.all([customFetch<{ threads: Conversa[] }>("/api/messages/threads"), customFetch<{ people: Person[] }>("/api/communication/people")])
      .then(([inbox, diretorio]) => { setConversas(inbox.threads); setPessoas(diretorio.people); })
      .catch(() => { if (!silencioso) setErroLista("Não consegui abrir as mensagens."); })
      .finally(() => setCarregouLista(true));
  }, [sample]);
  useEffect(() => { carregarLista(); }, [carregarLista]);

  // A lista se atualiza sozinha, mas só com a aba à vista (aba escondida não gasta rede nem marca nada).
  useEffect(() => {
    if (sample) return;
    const id = window.setInterval(() => { if (document.visibilityState === "visible") carregarLista(true); }, 20_000);
    return () => window.clearInterval(id);
  }, [sample, carregarLista]);

  // ─ Conversa aberta ─
  const aplicarConversa = (lista: Msg[], integrantes: Integrante[]) => { setMensagens(lista); setParticipantes(integrantes); };
  const abrir = useCallback(async (id: string) => {
    setAtivaId(id); setErroConversa(""); setCitando(null); setFigurinhasAbertas(false); setReagindoEm(null); colada.current = true;
    setConversas(rows => rows.map(row => row.id === id ? { ...row, unreadCount: 0 } : row));
    if (sample) { aplicarConversa(amostra.current.mensagens[id] ?? [], amostra.current.conversas.find(row => row.id === id)?.participants ?? []); return; }
    setCarregandoConversa(true);
    try {
      // Abrir marca como visto; as atualizações automáticas (abaixo) usam ?semLer=1 e não marcam.
      const dados = await customFetch<{ messages: Msg[]; participants: Integrante[]; thread: Partial<Conversa> }>(`/api/messages/threads/${id}`);
      aplicarConversa(dados.messages, dados.participants);
      setConversas(rows => rows.map(row => row.id === id ? { ...row, ...dados.thread, title: row.title, participants: dados.participants } : row));
    } catch (err) { setErroConversa(serverError(err, "Não consegui abrir esta conversa. Tente de novo.")); }
    finally { setCarregandoConversa(false); }
  }, [sample]);

  // Atualização automática da conversa aberta: sem marcar "visto" — só marca quando a aba está à vista e em foco.
  useEffect(() => {
    if (sample || !ativaId) return;
    let vivo = true;
    const atualizar = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const dados = await customFetch<{ messages: Msg[]; participants: Integrante[] }>(`/api/messages/threads/${ativaId}?semLer=1`);
        if (!vivo) return;
        setMensagens(atuais => {
          const pendentes = atuais.filter(item => item.estado);
          return [...dados.messages, ...pendentes];
        });
        setParticipantes(dados.participants);
        if (document.hasFocus() && dados.messages.some(item => item.senderId !== meuId)) {
          void customFetch(`/api/messages/threads/${ativaId}/read`, { method: "PATCH" }).catch(() => undefined);
          setConversas(rows => rows.map(row => row.id === ativaId ? { ...row, unreadCount: 0 } : row));
        }
      } catch { /* a próxima volta tenta de novo; um erro de rede não derruba a conversa aberta */ }
    };
    const id = window.setInterval(() => void atualizar(), 5_000);
    const aoVoltar = () => { if (document.visibilityState === "visible") void atualizar(); };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => { vivo = false; window.clearInterval(id); document.removeEventListener("visibilitychange", aoVoltar); };
  }, [sample, ativaId, meuId]);

  // Na amostra, o que se escreve e reage fica guardado enquanto a página está aberta (para revisar sem servidor).
  useEffect(() => { if (sample && ativaId) amostra.current.mensagens[ativaId] = mensagens; }, [sample, ativaId, mensagens]);

  // Rola para o fim quando chega mensagem, a menos que a pessoa tenha subido para ler o que veio antes.
  useEffect(() => { const el = rolagem.current; if (el && colada.current) el.scrollTop = el.scrollHeight; }, [mensagens, ativaId]);
  const aoRolar = () => { const el = rolagem.current; if (el) colada.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120; };

  // O que foi escrito e não enviado fica guardado por conversa.
  const mudarTexto = (valor: string) => { setTexto(valor); if (ativaId) setRascunhos(atual => ({ ...atual, [ativaId]: valor })); };
  useEffect(() => { setTexto(ativaId ? (rascunhos[ativaId] ?? "") : ""); /* só ao trocar de conversa */ // eslint-disable-line react-hooks/exhaustive-deps
  }, [ativaId]);

  const voltar = () => { setAtivaId(null); setMensagens([]); carregarLista(true); };

  // ─ Enviar ─
  const enviar = async (conteudo: string, kind: "TEXT" | "STICKER" = "TEXT", reenviando?: Msg) => {
    if (!ativa || encerrada) return;
    const limpo = conteudo.trim(); if (!limpo) return;
    setAviso("");
    const provisoria: Msg = { id: reenviando?.id ?? `provisoria-${Date.now()}`, content: limpo, kind, senderId: meuId, senderName: eu, createdAt: now(), quotedMessageId: reenviando?.quotedMessageId ?? citando?.id ?? null, reacoes: [], minhaReacao: null, vistoPor: [], estado: "enviando" };
    colada.current = true;
    setMensagens(atuais => reenviando ? atuais.map(item => item.id === reenviando.id ? provisoria : item) : [...atuais, provisoria]);
    if (kind === "TEXT" && !reenviando) { setTexto(""); setRascunhos(atual => ({ ...atual, [ativa.id]: "" })); setCitando(null); }
    if (kind === "STICKER") setFigurinhasAbertas(false);
    if (sample) {
      setMensagens(atuais => atuais.map(item => item.id === provisoria.id ? { ...provisoria, id: `amostra-${Date.now()}`, estado: undefined } : item));
      setConversas(rows => rows.map(row => row.id === ativa.id ? { ...row, lastMessage: { content: kind === "STICKER" ? "Figurinha" : limpo, senderName: eu, createdAt: now() } } : row));
      return;
    }
    try {
      const resposta = await customFetch<{ message: Msg }>(`/api/messages/threads/${ativa.id}/messages`, { method: "POST", body: JSON.stringify({ content: limpo, kind, quotedMessageId: provisoria.quotedMessageId }) });
      setMensagens(atuais => atuais.map(item => item.id === provisoria.id ? { ...resposta.message, vistoPor: [] } : item));
      setConversas(rows => rows.map(row => row.id === ativa.id ? { ...row, lastMessage: { content: kind === "STICKER" ? "Figurinha" : limpo, senderName: eu, createdAt: resposta.message.createdAt } } : row));
    } catch (err) {
      // Falhou: o texto continua na tela, marcado, com "tentar de novo" — nada se perde.
      setMensagens(atuais => atuais.map(item => item.id === provisoria.id ? { ...item, estado: "falhou" } : item));
      setAviso(serverError(err, "Não consegui enviar a mensagem. Ela continua aqui; toque em “tentar de novo”."));
    }
  };
  const aoEnviar = (event: FormEvent) => { event.preventDefault(); void enviar(texto); };
  const aoTeclar = (event: KeyboardEvent<HTMLTextAreaElement>) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void enviar(texto); } };

  // ─ Reações e preferências ─
  const reagir = async (msg: Msg, emoji: string | null) => {
    if (!ativa) return;
    setReagindoEm(null);
    try {
      if (!sample) await customFetch(`/api/messages/threads/${ativa.id}/messages/${msg.id}/react`, { method: "POST", body: JSON.stringify({ reaction: emoji }) });
      setMensagens(atuais => atuais.map(item => {
        if (item.id !== msg.id) return item;
        let reacoes = (item.reacoes ?? []).map(r => ({ ...r, pessoas: r.pessoas.filter(nome => nome !== eu) })).map(r => ({ ...r, count: r.pessoas.length })).filter(r => r.count > 0);
        if (emoji) { const i = reacoes.findIndex(r => r.emoji === emoji); if (i >= 0) reacoes[i] = { ...reacoes[i]!, pessoas: [...reacoes[i]!.pessoas, eu], count: reacoes[i]!.count + 1 }; else reacoes = [...reacoes, { emoji, count: 1, pessoas: [eu] }]; }
        return { ...item, reacoes: reacoes.sort((a, b) => b.count - a.count), minhaReacao: emoji };
      }));
    } catch (err) { setAviso(serverError(err, "Não consegui reagir agora. Tente de novo.")); }
  };
  const preferencia = async (campo: "pinned" | "muted") => {
    if (!ativa) return;
    const novo = !ativa[campo];
    try {
      if (!sample) await customFetch(`/api/messages/threads/${ativa.id}/preferences`, { method: "PATCH", body: JSON.stringify({ [campo]: novo }) });
      setConversas(rows => rows.map(row => row.id === ativa.id ? { ...row, [campo]: novo } : row));
    } catch (err) { setAviso(serverError(err, "Não consegui mudar isso agora.")); }
  };

  // ─ Lista visível ─
  const visiveis = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    return conversas
      .filter(c => (!termo || `${c.title} ${c.lastMessage?.content ?? ""}`.toLocaleLowerCase("pt-BR").includes(termo)) && (filtro === "todas" || (filtro === "naoLidas" ? Boolean(c.unreadCount) : EH_GRUPO(c))))
      .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || new Date(b.lastMessage?.createdAt ?? b.createdAt ?? 0).getTime() - new Date(a.lastMessage?.createdAt ?? a.createdAt ?? 0).getTime());
  }, [conversas, busca, filtro]);
  const totalNaoLidas = conversas.reduce((total, c) => total + (c.muted ? 0 : c.unreadCount ?? 0), 0);
  const citada = (id?: string | null) => id ? mensagens.find(item => item.id === id) : undefined;

  return <section className="msg-page">
    <div className={`msg-app ${ativa ? "conversa-aberta" : ""}`}>
      <aside className="msg-lista" aria-label="Conversas">
        <header><div><span>conversas</span><h2>Mensagens{totalNaoLidas > 0 && <b>{totalNaoLidas}</b>}</h2></div><button className="msg-primario" onClick={() => setNovaAberta(true)}><Plus size={17}/> Nova</button></header>
        <div className="msg-busca"><Search size={16}/><input value={busca} onChange={event => setBusca(event.target.value)} placeholder="Buscar conversa" aria-label="Buscar conversa"/></div>
        <div className="msg-filtros" role="group" aria-label="Filtro">{([["todas", "Todas"], ["naoLidas", "Não lidas"], ["grupos", "Grupos"]] as const).map(([chave, rotulo]) => <button key={chave} className={filtro === chave ? "on" : ""} aria-pressed={filtro === chave} onClick={() => setFiltro(chave)}>{rotulo}</button>)}</div>
        {gestao && <button className="msg-gestao" onClick={() => setGruposAberto(true)}><Users size={15}/> Grupos da casa</button>}
        {erroLista && <div className="msg-erro" role="alert">{erroLista}<button onClick={() => { setCarregouLista(false); carregarLista(); }}>Tentar de novo</button></div>}
        <div className="msg-itens">
          {!carregouLista ? <p className="msg-vazio" aria-busy="true">Carregando conversas…</p>
            : visiveis.length ? visiveis.map(conversa => <button key={conversa.id} className={`msg-item ${conversa.id === ativaId ? "ativa" : ""}`} onClick={() => void abrir(conversa.id)}>
              <span className={`msg-avatar ${EH_GRUPO(conversa) ? "grupo" : ""}`}>{EH_GRUPO(conversa) ? <Users size={18}/> : initials(conversa.title)}</span>
              <span className="msg-item-texto"><strong>{conversa.title}</strong><small>{resumoDaUltima(conversa, eu)}</small></span>
              <span className="msg-item-lado"><small>{hora(conversa.lastMessage?.createdAt)}</small>{conversa.unreadCount ? <b className={conversa.muted ? "mudo" : ""}>{conversa.unreadCount}</b> : conversa.pinned ? <Pin size={13}/> : conversa.muted ? <BellOff size={13}/> : null}</span>
            </button>)
              : <div className="msg-vazio">{conversas.length === 0 ? <><strong>Nenhuma conversa ainda</strong><span>Toque em “Nova” para falar com alguém ou criar um grupo.</span></> : <><strong>Nada encontrado</strong><span>{busca ? `Nenhuma conversa tem “${busca.trim()}”.` : "Nenhuma conversa neste filtro."}</span></>}</div>}
        </div>
      </aside>

      <article className="msg-conversa">
        {!ativa ? <div className="msg-sem-conversa"><img src="/asa/oi.webp" alt=""/><strong>Escolha uma conversa</strong><span>Ou crie uma nova com o botão “Nova”.</span></div> : <>
          <header>
            <button className="msg-voltar" onClick={voltar} aria-label="Voltar para as conversas"><ArrowLeft size={20}/></button>
            <span className={`msg-avatar ${EH_GRUPO(ativa) ? "grupo" : ""}`}>{EH_GRUPO(ativa) ? <Users size={18}/> : initials(ativa.title)}</span>
            <button className="msg-titulo" onClick={() => setIntegrantesAberto(true)}><strong>{ativa.title}</strong><small>{quemEstaNaConversa(ativa)}{ativa.muted ? " · silenciada" : ""}</small></button>
            <button className="msg-icone" onClick={() => void preferencia("pinned")} aria-pressed={Boolean(ativa.pinned)} aria-label={ativa.pinned ? "Desafixar conversa" : "Fixar conversa"} title={ativa.pinned ? "Desafixar" : "Fixar"}><Pin size={17}/></button>
            <button className="msg-icone" onClick={() => void preferencia("muted")} aria-pressed={Boolean(ativa.muted)} aria-label={ativa.muted ? "Ativar avisos da conversa" : "Silenciar conversa"} title={ativa.muted ? "Ativar avisos" : "Silenciar"}><BellOff size={17}/></button>
          </header>
          {aviso && <div className="msg-erro" role="alert">{aviso}<button onClick={() => setAviso("")}>Fechar</button></div>}
          {encerrada && <div className="msg-arquivado">Grupo arquivado{ativa.closedReason ? `: ${ativa.closedReason}` : ""}. Dá para ler, mas não para escrever.</div>}
          <div className="msg-mensagens" ref={rolagem} onScroll={aoRolar} aria-live="polite">
            {carregandoConversa ? <p className="msg-vazio" aria-busy="true">Abrindo a conversa…</p> : erroConversa ? <div className="msg-erro" role="alert">{erroConversa}<button onClick={() => void abrir(ativa.id)}>Tentar de novo</button></div>
              : mensagens.length === 0 ? <div className="msg-vazio"><strong>Nenhuma mensagem ainda</strong><span>Escreva abaixo ou mande uma figurinha da ASA.</span></div>
                : mensagens.map(msg => {
                  const minha = msg.senderId === meuId, grupo = EH_GRUPO(ativa), original = citada(msg.quotedMessageId);
                  return <div key={msg.id} className={`msg-balao-linha ${minha ? "minha" : "outra"} ${selecionada === msg.id ? "sel" : ""}`}>
                    <div className={`msg-balao ${msg.kind === "STICKER" ? "figurinha" : ""} ${msg.estado ?? ""}`} onClick={() => setSelecionada(atual => atual === msg.id ? null : msg.id)}>
                      {!minha && grupo && <strong className="msg-remetente">{msg.senderName}</strong>}
                      {msg.quotedMessageId && <div className="msg-citada">{original ? <><b>{original.senderId === meuId ? "Você" : original.senderName}</b><span>{original.kind === "STICKER" ? "Figurinha" : original.content}</span></> : <span>Mensagem anterior</span>}</div>}
                      {msg.kind === "STICKER" ? <img className="msg-figurinha" src={`/asa/${msg.content}.webp`} alt={`Figurinha: ${NOME_FIGURINHA[msg.content] ?? msg.content}`}/> : <p>{msg.content}</p>}
                      <small className="msg-meta">{msg.estado === "enviando" ? "enviando…" : msg.estado === "falhou" ? "não enviou" : horaCompleta(msg.createdAt)}
                        {minha && !msg.estado && (msg.vistoPor?.length ? <button className="msg-visto" onClick={() => setVistoPorDe(msg)} aria-label="Ver quem viu"><CheckCheck size={14}/>{grupo ? ` visto por ${msg.vistoPor.length}` : " visto"}</button> : <span className="msg-visto"><Check size={14}/> enviada</span>)}
                      </small>
                      {msg.estado === "falhou" && <button className="msg-retentar" onClick={() => void enviar(msg.content, msg.kind, msg)}>Tentar de novo</button>}
                    </div>
                    {!msg.estado && <>
                      {(msg.reacoes?.length ?? 0) > 0 && <div className="msg-reacoes">{msg.reacoes!.map(reacao => <button key={reacao.emoji} className={reacao.emoji === msg.minhaReacao ? "on" : ""} aria-pressed={reacao.emoji === msg.minhaReacao} title={reacao.pessoas.join(", ")} onClick={() => void reagir(msg, reacao.emoji === msg.minhaReacao ? null : reacao.emoji)}>{reacao.emoji} {reacao.count}</button>)}</div>}
                      <div className="msg-acoes">
                        <button onClick={() => setReagindoEm(reagindoEm === msg.id ? null : msg.id)} aria-label="Reagir" aria-expanded={reagindoEm === msg.id}><SmilePlus size={15}/></button>
                        {!encerrada && <button onClick={() => { setCitando(msg); }} aria-label="Responder"><Reply size={15}/></button>}
                      </div>
                      {reagindoEm === msg.id && <div className="msg-picker" role="group" aria-label="Escolha uma reação">{REACOES.map(emoji => <button key={emoji} className={emoji === msg.minhaReacao ? "on" : ""} aria-label={`Reagir com ${emoji}`} onClick={() => void reagir(msg, emoji === msg.minhaReacao ? null : emoji)}>{emoji}</button>)}</div>}
                    </>}
                  </div>;
                })}
          </div>
          {!encerrada && <div className="msg-compor">
            {citando && <div className="msg-citando"><Reply size={14}/><span><b>{citando.senderId === meuId ? "Você" : citando.senderName}</b> {citando.kind === "STICKER" ? "Figurinha" : citando.content.slice(0, 90)}</span><button onClick={() => setCitando(null)} aria-label="Cancelar resposta"><X size={15}/></button></div>}
            {figurinhasAbertas && <div className="msg-figurinhas" role="group" aria-label="Figurinhas da ASA">{FIGURINHAS.map(nome => <button key={nome} onClick={() => void enviar(nome, "STICKER")} aria-label={`Enviar figurinha ${NOME_FIGURINHA[nome]}`}><img src={`/asa/${nome}.webp`} alt=""/><span>{NOME_FIGURINHA[nome]}</span></button>)}</div>}
            <form onSubmit={aoEnviar}>
              <button type="button" className="msg-icone" onClick={() => setFigurinhasAbertas(valor => !valor)} aria-expanded={figurinhasAbertas} aria-label="Figurinhas da ASA"><Sticker size={20}/></button>
              <textarea value={texto} onChange={event => mudarTexto(event.target.value)} onKeyDown={aoTeclar} rows={1} placeholder="Escreva uma mensagem" aria-label="Mensagem" maxLength={4000}/>
              <button className="msg-primario msg-enviar" aria-label="Enviar" disabled={!texto.trim()}><Send size={18}/></button>
            </form>
          </div>}
        </>}
      </article>
    </div>

    {novaAberta && <NovaConversa pessoas={pessoas.filter(p => p.id !== meuId && p.name !== eu)} sample={sample} onClose={() => setNovaAberta(false)}
      onCriada={async (id, lista) => { setNovaAberta(false); if (lista) setConversas(lista); else carregarLista(true); await abrir(id); if (!sample) carregarLista(true); }}
      amostra={amostra.current} eu={eu}/>}
    {integrantesAberto && ativa && <Integrantes conversa={ativa} participantes={participantes.length ? participantes : ativa.participants} pessoas={pessoas} meuId={meuId} gestao={gestao} sample={sample}
      onClose={() => setIntegrantesAberto(false)} onMudou={() => { carregarLista(true); void abrir(ativa.id); }} onSaiu={() => { setIntegrantesAberto(false); voltar(); }}
      onRenomeou={titulo => setConversas(rows => rows.map(row => row.id === ativa.id ? { ...row, title: titulo } : row))}/>}
    {gruposAberto && <GruposDaCasa pessoas={pessoas} areas={areas} sample={sample} onClose={() => setGruposAberto(false)} onMudou={() => carregarLista(true)}/>}
    {vistoPorDe && <Modal title="Visto por" onClose={() => setVistoPorDe(null)}><div className="comm-form"><ul className="msg-lista-nomes">{(vistoPorDe.vistoPor ?? []).map(nome => <li key={nome}>{nome}</li>)}</ul><footer className="comm-modal-footer"><button type="button" onClick={() => setVistoPorDe(null)}>Fechar</button></footer></div></Modal>}
  </section>;
}

// ─── Escolher pessoas ─────────────────────────────────────────────────────────

function EscolherPessoas({ pessoas, escolhidas, onChange, rotulo }: { pessoas: Person[]; escolhidas: Set<string>; onChange: (proximo: Set<string>) => void; rotulo: string }) {
  const [busca, setBusca] = useState("");
  const termo = busca.trim().toLocaleLowerCase("pt-BR");
  const lista = pessoas.filter(p => `${p.name} ${p.areaName ?? ""}`.toLocaleLowerCase("pt-BR").includes(termo));
  const alternar = (id: string) => { const proximo = new Set(escolhidas); if (proximo.has(id)) proximo.delete(id); else proximo.add(id); onChange(proximo); };
  return <fieldset className="comm-people">
    <legend>{rotulo} <b>{escolhidas.size ? `${escolhidas.size} ${escolhidas.size === 1 ? "pessoa" : "pessoas"}` : "ninguém marcado ainda"}</b></legend>
    {escolhidas.size > 0 && <div className="comm-people-chosen">{pessoas.filter(p => escolhidas.has(p.id)).map(p => <button type="button" key={p.id} onClick={() => alternar(p.id)} aria-label={`Tirar ${p.name}`}>{p.name} <X size={13}/></button>)}</div>}
    <input type="search" value={busca} onChange={event => setBusca(event.target.value)} placeholder="Buscar pelo nome ou pela área" aria-label="Buscar pessoa"/>
    <div className="comm-people-list" role="group" aria-label="Pessoas">{lista.map(p => <label key={p.id} className="comm-check"><input type="checkbox" checked={escolhidas.has(p.id)} onChange={() => alternar(p.id)}/> {p.name}{p.areaName && <small> · {p.areaName}</small>}</label>)}</div>
  </fieldset>;
}

// ─── Nova conversa ou grupo ───────────────────────────────────────────────────

function NovaConversa({ pessoas, sample, amostra, eu, onClose, onCriada }: { pessoas: Person[]; sample: boolean; amostra: ReturnType<typeof amostraDeConversas>; eu: string; onClose: () => void; onCriada: (id: string, lista?: Conversa[]) => Promise<void> }) {
  const [modo, setModo] = useState<"conversa" | "grupo">("conversa");
  const [escolhidas, setEscolhidas] = useState<Set<string>>(() => new Set()), [erro, setErro] = useState(""), [criando, setCriando] = useState(false);
  const criar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nome = String(new FormData(event.currentTarget).get("nome") ?? "").trim();
    if (!escolhidas.size) { setErro(modo === "conversa" ? "Escolha com quem você quer conversar." : "Marque quem vai no grupo."); return; }
    if (modo === "conversa" && escolhidas.size > 1) { setErro("Conversa direta é com uma pessoa só. Para várias, crie um grupo."); return; }
    if (modo === "grupo" && !nome) { setErro("Dê um nome ao grupo."); return; }
    setErro(""); setCriando(true);
    try {
      if (sample) {
        const escolhidasPessoas = pessoas.filter(p => escolhidas.has(p.id));
        const id = `amostra-${Date.now()}`;
        const nova: Conversa = { id, title: modo === "conversa" ? escolhidasPessoas[0]!.name : nome, contextType: modo === "conversa" ? "DIRECT" : "GROUP", participants: [{ userId: "me", name: eu, role: "INITIATOR" }, ...escolhidasPessoas.map(p => ({ userId: p.id, name: p.name }))], lastMessage: null, myRole: "INITIATOR", podeGerir: modo === "grupo", createdAt: now() };
        amostra.conversas.unshift(nova); amostra.mensagens[id] = [];
        await onCriada(id, [...amostra.conversas]); return;
      }
      const resposta = await customFetch<{ thread: { id: string } }>("/api/messages/threads", { method: "POST", body: JSON.stringify({ participantIds: [...escolhidas], ...(modo === "grupo" ? { title: nome, grupo: true } : {}) }) });
      await onCriada(resposta.thread.id);
    } catch (err) { setErro(serverError(err, "Não consegui criar agora. O que você marcou continua aqui; tente de novo.")); }
    finally { setCriando(false); }
  };
  return <Modal title={modo === "conversa" ? "Nova conversa" : "Novo grupo"} onClose={onClose}>
    <form className="comm-form" onSubmit={criar}>
      <div className="msg-abas" role="tablist"><button type="button" role="tab" aria-selected={modo === "conversa"} className={modo === "conversa" ? "on" : ""} onClick={() => { setModo("conversa"); setEscolhidas(new Set()); }}>Conversa</button><button type="button" role="tab" aria-selected={modo === "grupo"} className={modo === "grupo" ? "on" : ""} onClick={() => setModo("grupo")}>Grupo</button></div>
      {modo === "grupo" && <label>Nome do grupo<input name="nome" maxLength={80} placeholder="Ex.: Mídias do Natal" autoFocus/></label>}
      <EscolherPessoas pessoas={pessoas} escolhidas={escolhidas} onChange={proximo => setEscolhidas(modo === "conversa" && proximo.size > 1 ? new Set([[...proximo].at(-1)!]) : proximo)} rotulo={modo === "conversa" ? "Com quem" : "Quem entra"}/>
      <p className="comm-note">{modo === "conversa" ? "Se vocês já têm uma conversa, ela se abre." : "Quem criou o grupo é a dona dele: convida, tira, muda o nome e arquiva. A Administração vê que o grupo existe e quem está nele, mas não lê as mensagens."}</p>
      {erro && <p className="comm-form-error" role="alert">{erro}</p>}
      <footer><button type="button" onClick={onClose}>Cancelar</button><button className="comm-primary" disabled={criando}>{criando ? "Criando…" : modo === "conversa" ? "Conversar" : "Criar grupo"}</button></footer>
    </form>
  </Modal>;
}

// ─── Integrantes e gestão do grupo ────────────────────────────────────────────

function Integrantes({ conversa, participantes, pessoas, meuId, gestao, sample, onClose, onMudou, onSaiu, onRenomeou }: {
  conversa: Conversa; participantes: Integrante[]; pessoas: Person[]; meuId: string; gestao: boolean; sample: boolean; onClose: () => void; onMudou: () => void; onSaiu: () => void; onRenomeou: (titulo: string) => void;
}) {
  const [erro, setErro] = useState(""), [ocupado, setOcupado] = useState(false), [convidando, setConvidando] = useState(false), [arquivando, setArquivando] = useState(false);
  const [novos, setNovos] = useState<Set<string>>(() => new Set());
  const grupo = EH_GRUPO(conversa), daPessoa = conversa.contextType === "GROUP", daCasa = conversa.contextType === "HOUSE_GROUP", daArea = conversa.contextType === "AREA_GROUP";
  const gerencia = Boolean(conversa.podeGerir);
  const podeArquivar = !daArea && (daPessoa ? (gerencia || gestao) : gestao);
  const agir = async (acao: () => Promise<void>, falha: string) => { setOcupado(true); setErro(""); try { await acao(); } catch (err) { setErro(serverError(err, falha)); } finally { setOcupado(false); } };
  const tirar = (alvo: Integrante) => agir(async () => { if (!sample) await customFetch(`/api/messages/threads/${conversa.id}/members/${alvo.userId}`, { method: "DELETE" }); if (alvo.userId === meuId) onSaiu(); else onMudou(); }, "Não consegui tirar agora.");
  const convidar = () => agir(async () => { if (!novos.size) throw new Error("vazio"); if (!sample) await customFetch(`/api/messages/threads/${conversa.id}/members`, { method: "POST", body: JSON.stringify({ userIds: [...novos] }) }); setNovos(new Set()); setConvidando(false); onMudou(); }, "Não consegui convidar. Escolha quem ainda não está no grupo.");
  const renomear = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const titulo = String(new FormData(event.currentTarget).get("titulo") ?? "").trim(); if (!titulo || titulo === conversa.title) return; void agir(async () => { if (!sample) await customFetch(`/api/messages/threads/${conversa.id}`, { method: "PATCH", body: JSON.stringify({ title: titulo }) }); onRenomeou(titulo); }, "Não consegui mudar o nome agora."); };
  const arquivar = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const reason = String(new FormData(event.currentTarget).get("reason") ?? "").trim(); if (!reason) { setErro("Escreva o motivo."); return; } void agir(async () => { if (!sample) await customFetch(`/api/messages/threads/${conversa.id}/arquivar`, { method: "POST", body: JSON.stringify({ reason }) }); setArquivando(false); onMudou(); }, "Não consegui arquivar agora."); };
  const restaurar = () => agir(async () => { if (!sample) await customFetch(`/api/messages/threads/${conversa.id}/restaurar`, { method: "POST" }); onMudou(); }, "Não consegui trazer o grupo de volta agora.");
  const jaEstao = new Set(participantes.map(p => p.userId));
  const encerrada = conversa.status === "CLOSED";
  return <Modal title={grupo ? "Sobre o grupo" : "Sobre a conversa"} onClose={onClose}>
    <div className="comm-form">
      {gerencia && !encerrada && <form className="msg-renomear" onSubmit={renomear}><label>Nome do grupo<input name="titulo" defaultValue={conversa.title} maxLength={80}/></label><button className="comm-secondary" disabled={ocupado}>Salvar nome</button></form>}
      <p className="comm-note">{daArea ? "Grupo da área: acompanha o cadastro. Quem entra ou sai da área entra ou sai do grupo sozinho." : daCasa ? "Grupo da casa: quem organiza é a Administração. Você pode silenciar as mensagens." : daPessoa ? (gerencia ? "Você criou este grupo: convida, tira gente, muda o nome e arquiva." : "Grupo criado por uma pessoa da equipe.") : "Conversa direta."}</p>
      <h3 className="msg-subtitulo">{participantes.length} {participantes.length === 1 ? "pessoa" : "pessoas"}</h3>
      <ul className="msg-integrantes">{participantes.map(p => <li key={p.userId}><span className="msg-avatar">{initials(p.name)}</span><span>{p.name}{p.userId === meuId ? " (você)" : ""}{p.role === "INITIATOR" && daPessoa ? <small> · dona do grupo</small> : null}</span>
        {!encerrada && ((gerencia && p.userId !== meuId && !daArea) || (daPessoa && p.userId === meuId)) && <button type="button" className="msg-tirar" disabled={ocupado} onClick={() => void tirar(p)}>{p.userId === meuId ? "Sair" : "Tirar"}</button>}</li>)}</ul>
      {gerencia && !encerrada && (convidando
        ? <><EscolherPessoas pessoas={pessoas.filter(p => !jaEstao.has(p.id))} escolhidas={novos} onChange={setNovos} rotulo="Convidar"/><div className="msg-botoes"><button type="button" onClick={() => { setConvidando(false); setNovos(new Set()); }}>Cancelar</button><button type="button" className="comm-primary" disabled={ocupado || !novos.size} onClick={() => void convidar()}>Convidar</button></div></>
        : <button type="button" className="comm-secondary" onClick={() => setConvidando(true)}><Plus size={16}/> Convidar pessoas</button>)}
      {encerrada && <p className="comm-note"><b>Arquivado</b>{conversa.closedReason ? `: ${conversa.closedReason}` : ""}.</p>}
      {podeArquivar && (encerrada
        ? <button type="button" className="comm-secondary" disabled={ocupado} onClick={() => void restaurar()}>Trazer o grupo de volta</button>
        : arquivando
          ? <form className="comm-form msg-arquivar" onSubmit={arquivar}><label>Motivo do arquivamento<textarea name="reason" required autoFocus placeholder="Por que este grupo não é mais necessário"/></label><div className="msg-botoes"><button type="button" onClick={() => setArquivando(false)}>Voltar</button><button className="comm-danger" disabled={ocupado}>Arquivar</button></div></form>
          : <button type="button" className="msg-link-perigo" onClick={() => setArquivando(true)}>Arquivar grupo</button>)}
      {erro && <p className="comm-form-error" role="alert">{erro}</p>}
      <footer className="comm-modal-footer"><button type="button" onClick={onClose}>Fechar</button></footer>
    </div>
  </Modal>;
}

// ─── Grupos da casa (Administração e Direção) ─────────────────────────────────

function GruposDaCasa({ pessoas, areas, sample, onClose, onMudou }: { pessoas: Person[]; areas: Option[]; sample: boolean; onClose: () => void; onMudou: () => void }) {
  const [grupos, setGrupos] = useState<GrupoAdmin[] | null>(sample ? [
    { id: "g1", title: "Meninas", tipo: "HOUSE_GROUP", status: "OPEN", criadoPor: "Barbara", integrantes: [{ userId: "a", name: "Carol" }, { userId: "b", name: "Sofia" }], total: 2, ultimaMensagemEm: new Date().toISOString() },
    { id: "g2", title: "Mídias do Natal", tipo: "GROUP", status: "OPEN", criadoPor: "Louis", integrantes: [{ userId: "c", name: "Louis" }, { userId: "d", name: "Sofia" }, { userId: "e", name: "Julia" }], total: 3, ultimaMensagemEm: new Date().toISOString() },
    { id: "g3", title: "Patinadores · grupo da área", tipo: "AREA_GROUP", status: "OPEN", criadoPor: null, integrantes: [{ userId: "f", name: "Carol" }], total: 12, ultimaMensagemEm: null },
  ] : null);
  const [erro, setErro] = useState(""), [criando, setCriando] = useState(false), [aberto, setAberto] = useState<string | null>(null), [ocupado, setOcupado] = useState(false);
  const [escolhidas, setEscolhidas] = useState<Set<string>>(() => new Set()), [areasEscolhidas, setAreasEscolhidas] = useState<Set<string>>(() => new Set());
  const carregar = () => customFetch<{ grupos: GrupoAdmin[] }>("/api/messages/grupos").then(r => setGrupos(r.grupos)).catch(err => setErro(serverError(err, "Não consegui listar os grupos.")));
  useEffect(() => { if (!sample) void carregar(); }, [sample]);
  const agir = async (acao: () => Promise<void>, falha: string) => { setOcupado(true); setErro(""); try { await acao(); if (!sample) await carregar(); onMudou(); } catch (err) { setErro(serverError(err, falha)); } finally { setOcupado(false); } };
  const criar = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nome = String(new FormData(event.currentTarget).get("nome") ?? "").trim();
    if (!nome) { setErro("Dê um nome ao grupo."); return; }
    if (!escolhidas.size && !areasEscolhidas.size) { setErro("Escolha pelo menos uma pessoa ou uma área."); return; }
    void agir(async () => {
      if (sample) setGrupos(rows => [{ id: `g${Date.now()}`, title: nome, tipo: "HOUSE_GROUP", status: "OPEN", criadoPor: "você", integrantes: pessoas.filter(p => escolhidas.has(p.id)).map(p => ({ userId: p.id, name: p.name })), total: escolhidas.size, ultimaMensagemEm: null }, ...(rows ?? [])]);
      else await customFetch("/api/messages/grupos", { method: "POST", body: JSON.stringify({ nome, pessoaIds: [...escolhidas], areaIds: [...areasEscolhidas] }) });
      setCriando(false); setEscolhidas(new Set()); setAreasEscolhidas(new Set());
    }, "Não consegui criar o grupo. O que você marcou continua aqui; tente de novo.");
  };
  const arquivar = (grupo: GrupoAdmin, event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const reason = String(new FormData(event.currentTarget).get("reason") ?? "").trim();
    if (!reason) { setErro("Escreva o motivo."); return; }
    void agir(async () => { if (sample) setGrupos(rows => (rows ?? []).map(g => g.id === grupo.id ? { ...g, status: "CLOSED", closedReason: reason } : g)); else await customFetch(`/api/messages/threads/${grupo.id}/arquivar`, { method: "POST", body: JSON.stringify({ reason }) }); setAberto(null); }, "Não consegui arquivar agora.");
  };
  const restaurar = (grupo: GrupoAdmin) => agir(async () => { if (sample) setGrupos(rows => (rows ?? []).map(g => g.id === grupo.id ? { ...g, status: "OPEN", closedReason: null } : g)); else await customFetch(`/api/messages/threads/${grupo.id}/restaurar`, { method: "POST" }); }, "Não consegui trazer o grupo de volta agora.");
  const ROTULO: Record<string, string> = { HOUSE_GROUP: "da casa", GROUP: "de uma pessoa", AREA_GROUP: "da área" };
  return <Modal title="Grupos da casa" onClose={onClose}>
    <div className="comm-form">
      <p className="comm-note">Aqui você vê que os grupos existem e quem está em cada um. <b>As mensagens não aparecem para a Administração</b>: só quem está no grupo lê. Para ler um grupo da casa, entre nele de propósito (à vista de todos).</p>
      {criando ? <form className="comm-form msg-arquivar" onSubmit={criar}>
        <label>Nome do grupo<input name="nome" maxLength={80} placeholder="Ex.: Meninas" autoFocus/></label>
        {areas.length > 0 && <div className="comm-chips" role="group" aria-label="Áreas"><span>Reunir uma área inteira</span>{areas.map(area => <button key={area.id} type="button" aria-pressed={areasEscolhidas.has(area.id)} className={areasEscolhidas.has(area.id) ? "on" : ""} onClick={() => setAreasEscolhidas(atual => { const proximo = new Set(atual); if (proximo.has(area.id)) proximo.delete(area.id); else proximo.add(area.id); return proximo; })}>{area.name}</button>)}</div>}
        <EscolherPessoas pessoas={pessoas} escolhidas={escolhidas} onChange={setEscolhidas} rotulo="Pessoas"/>
        <div className="msg-botoes"><button type="button" onClick={() => setCriando(false)}>Cancelar</button><button className="comm-primary" disabled={ocupado}>{ocupado ? "Criando…" : "Criar grupo"}</button></div>
      </form> : <button type="button" className="comm-primary" onClick={() => setCriando(true)}><Plus size={16}/> Novo grupo da casa</button>}
      {erro && <p className="comm-form-error" role="alert">{erro}</p>}
      {grupos === null && !erro && <p className="comm-note">Carregando…</p>}
      {grupos && !grupos.length && <p className="comm-note">Ainda não há grupos.</p>}
      {grupos && grupos.length > 0 && <ul className="comm-removidas">{grupos.map(grupo => <li key={grupo.id} className={grupo.status === "CLOSED" ? "removida" : ""}>
        <div><strong>{grupo.title}</strong><small>Grupo {ROTULO[grupo.tipo] ?? ""} · {grupo.total} {grupo.total === 1 ? "pessoa" : "pessoas"}{grupo.criadoPor ? ` · criado por ${grupo.criadoPor}` : ""}{grupo.ultimaMensagemEm ? ` · última mensagem ${hora(grupo.ultimaMensagemEm)}` : " · sem mensagens"}</small>
          <small>{grupo.integrantes.slice(0, 6).map(p => p.name).join(", ")}{grupo.total > 6 ? ` e mais ${grupo.total - 6}` : ""}</small>
          {grupo.status === "CLOSED" && <small><b>Arquivado</b>{grupo.closedReason ? `: ${grupo.closedReason}` : ""}</small>}
          {aberto === grupo.id && <form className="msg-arquivar" onSubmit={event => arquivar(grupo, event)}><label>Motivo<textarea name="reason" required autoFocus placeholder="Por que este grupo vai ser arquivado"/></label><div className="msg-botoes"><button type="button" onClick={() => setAberto(null)}>Voltar</button><button className="comm-danger" disabled={ocupado}>Arquivar</button></div></form>}
        </div>
        {grupo.tipo !== "AREA_GROUP" && (grupo.status === "CLOSED" ? <button type="button" className="comm-secondary" disabled={ocupado} onClick={() => void restaurar(grupo)}>Trazer de volta</button> : aberto !== grupo.id && <button type="button" className="comm-secondary" onClick={() => setAberto(grupo.id)}>Arquivar</button>)}
      </li>)}</ul>}
      <footer className="comm-modal-footer"><button type="button" onClick={onClose}>Fechar</button></footer>
    </div>
  </Modal>;
}
