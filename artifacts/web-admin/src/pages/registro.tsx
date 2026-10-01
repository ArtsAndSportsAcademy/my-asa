/**
 * Registro — quem fez o quê, quando, com antes/depois e motivo. Só Administração e Direção.
 * Sem .dc.html próprio: segue a linguagem visual das telas portadas (Perfil, Meu Dia).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { customFetch } from "@workspace/api-client-react";
import { css } from "@/lib/dc-style";
import { semRede } from "@/lib/sem-rede";
import "./registro.css";

type ShellRole = "adm" | "dir" | "sup" | "mem";
type Evento = {
  id: string; occurredAt: string; title: string; narrative: string; action: string; entityType: string; entityId: string;
  actorName: string | null; actorType: string; beforeState: Record<string, unknown> | null; afterState: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
};
type Pessoa = { id: string; name?: string; displayName?: string; fullName?: string };

const PAGE = 50;
const CARD = "background:#fff;border:1px solid #e6e1f2;border-radius:16px;padding:14px 16px";
const MONO = "font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:#6b6482";
const INPUT = "font:inherit;font-size:13px;padding:9px 12px;border:1px solid #e6e1f2;border-radius:11px;background:#fff;color:#1c1440;min-height:44px";

const PERIODOS = [
  { id: "hoje", label: "Hoje", dias: 0 },
  { id: "7", label: "7 dias", dias: 7 },
  { id: "30", label: "30 dias", dias: 30 },
  { id: "tudo", label: "Tudo", dias: null },
] as const;

/** Assuntos do filtro → entityType gravados pelas rotas. */
const ASSUNTOS: { label: string; tipos: string[] }[] = [
  { label: "Pessoas e acessos", tipos: ["user", "person", "user_role", "web_push_subscription", "pwa_installation"] },
  { label: "Escalas", tipos: ["scale", "scale_entry", "scale_allocation", "programacao"] },
  { label: "Livro do Dia", tipos: ["daily_book", "formation", "schedule_conflict"] },
  { label: "Shows", tipos: ["show_book", "show_book_scene", "show_book_position", "show_book_block", "show_book_keyframe", "show_book_tag", "show_book_drive_link", "stage_format_preset", "character", "character_cast", "session"] },
  { label: "Check-in e ocorrências", tipos: ["day_checkin", "check_in", "occurrence"] },
  { label: "Folgas", tipos: ["folga", "leave_request", "leave_regime"] },
  { label: "Tarefas e responsabilidades", tipos: ["task", "task_evidence", "responsibility", "responsibility_assignment", "delegation", "delivery", "delivery_assignment"] },
  { label: "Mural, mensagens e biblioteca", tipos: ["announcement", "announcement_comment", "notice", "message", "message_thread", "thread", "library_document", "library_category", "library_document_file"] },
  { label: "Agenda", tipos: ["agenda_event", "recurring_activity"] },
  { label: "Áreas, locais e grupos", tipos: ["area", "location", "area_local_supervisor", "operation", "group"] },
  { label: "Pedidos e restrições", tipos: ["request", "supervisor_request", "restriction"] },
  { label: "Reconhecimentos", tipos: ["recognition"] },
];
const TIPOS: Record<string, string> = Object.fromEntries(ASSUNTOS.flatMap((a) => a.tipos.map((t) => [t, a.label])));
const CAMPOS: Record<string, string> = {
  name: "Nome de uso", fullName: "Nome completo", email: "E-mail", phone: "Telefone", status: "Situação da conta", personStatus: "Situação",
  contactVisibility: "Quem vê o contato", mustChangePassword: "Precisa trocar a senha", sessoesEncerradas: "Sessões encerradas", areaId: "Área",
  title: "Título", description: "Descrição", startDate: "Início", endDate: "Fim", inicio: "Início", fim: "Fim", rotulo: "Bloco", reason: "Motivo",
  version: "Versão", publishedAt: "Publicada em", userId: "Pessoa", pessoaIds: "Pessoas",
};
const IGNORAR = new Set(["id", "createdAt", "updatedAt", "organizationId", "orgId"]);

function inicioDoPeriodo(dias: number | null) {
  if (dias === null) return undefined;
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - dias);
  return d.toISOString();
}
function dia(iso: string) { return new Date(iso).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Sao_Paulo" }); }
function hora(iso: string) { return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }); }
function valor(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "sim" : "não";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) return new Date(v).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  if (typeof v === "object") { const s = JSON.stringify(v); return s.length > 120 ? `${s.slice(0, 117)}…` : s; }
  return String(v);
}
/** O que mudou, campo a campo. Criação mostra o que nasceu; remoção, o que existia. */
function diferencas(antes: Record<string, unknown> | null, depois: Record<string, unknown> | null) {
  const chaves = [...new Set([...Object.keys(antes ?? {}), ...Object.keys(depois ?? {})])].filter((k) => !IGNORAR.has(k));
  return chaves
    .filter((k) => JSON.stringify(antes?.[k] ?? null) !== JSON.stringify(depois?.[k] ?? null))
    .slice(0, 16)
    .map((k) => ({ campo: CAMPOS[k] ?? k, antes: antes ? legivel(k, antes[k]) : null, depois: depois ? legivel(k, depois[k]) : null }));
}
function legivel(campo: string, v: unknown) {
  if (campo === "contactVisibility" && v && typeof v === "object") {
    const c = v as { email?: boolean; phone?: boolean };
    return `telefone: ${c.phone === false ? "só a gestão" : "colegas veem"} · e-mail: ${c.email === false ? "só a gestão" : "colegas veem"}`;
  }
  return valor(v);
}
function nomeDe(p: Pessoa) { return p.fullName ?? p.displayName ?? p.name ?? "Pessoa"; }

export default function RegistroPage({ role }: { role: ShellRole }) {
  const review = import.meta.env.DEV && (new URLSearchParams(window.location.search).get("amostra") === "1" || window.sessionStorage.getItem("myasa-review-sample") === "1");
  const [q, setQ] = useState(""), [busca, setBusca] = useState(""), [periodo, setPeriodo] = useState<(typeof PERIODOS)[number]["id"]>("7");
  const [ator, setAtor] = useState(""), [tipo, setTipo] = useState("");
  const [eventos, setEventos] = useState<Evento[]>([]), [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true), [erro, setErro] = useState(""), [aberto, setAberto] = useState<string | null>(null);
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);

  useEffect(() => { const t = window.setTimeout(() => setBusca(q.trim()), 300); return () => window.clearTimeout(t); }, [q]);
  useEffect(() => { if (!review) customFetch<{ users?: Pessoa[] }>("/api/users").then((r) => setPessoas(r.users ?? [])).catch(() => setPessoas([])); }, [review]);

  const params = useMemo(() => {
    const p = new URLSearchParams({ limit: String(PAGE) });
    const desde = inicioDoPeriodo(PERIODOS.find((x) => x.id === periodo)!.dias);
    if (desde) p.set("dateFrom", desde);
    if (busca) p.set("q", busca);
    if (ator) p.set("actorId", ator);
    if (tipo) p.set("entityType", tipo);
    return p;
  }, [periodo, busca, ator, tipo]);

  const carregar = useCallback(async (offset = 0) => {
    if (review) { setLoading(false); return; }
    setLoading(true); setErro("");
    try {
      const p = new URLSearchParams(params); p.set("offset", String(offset));
      const r = await customFetch<{ events: Evento[]; hasMore: boolean }>(`/api/history?${p.toString()}`);
      setEventos((atual) => offset ? [...atual, ...r.events] : r.events); setHasMore(r.hasMore);
    } catch (err) {
      setErro(semRede(err) ? "Sem conexão. O Registro aparece quando a internet voltar." : "Não consegui carregar o Registro agora.");
    } finally { setLoading(false); }
  }, [params, review]);
  useEffect(() => { void carregar(0); }, [carregar]);

  const porDia = useMemo(() => {
    const grupos: { dia: string; itens: Evento[] }[] = [];
    for (const e of eventos) { const d = dia(e.occurredAt); const g = grupos[grupos.length - 1]; if (g?.dia === d) g.itens.push(e); else grupos.push({ dia: d, itens: [e] }); }
    return grupos;
  }, [eventos]);

  if (role !== "adm" && role !== "dir") {
    return <section className="rg-root"><div className="rg-col"><div style={css(CARD)}><strong>O Registro é da Administração e da Direção.</strong><p style={css("margin:6px 0 0;font-size:13px;color:#6b6482")}>Ele guarda o antes de tudo o que mudou no app. O que você fez aparece nas telas de cada assunto.</p></div></div></section>;
  }

  return <section className="rg-root">
    <div className="rg-col">
      <p style={css("margin:0;font-size:13px;color:#5b5473;line-height:1.5")}>Tudo o que muda no My ASA fica aqui: quem fez, quando, o que era antes, como ficou e por quê. Nada se apaga — o Registro só cresce.{role === "dir" ? " Você lê; ninguém edita." : ""}</p>

      <div className="rg-filtros" style={css(CARD + ";display:flex;flex-wrap:wrap;gap:10px;align-items:center")}>
        <input aria-label="Buscar no Registro" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar: nome, escala, figurino…" style={css(INPUT + ";flex:1 1 220px;min-width:0")} />
        <div role="radiogroup" aria-label="Período" style={css("display:flex;gap:6px;flex-wrap:wrap")}>
          {PERIODOS.map((p) => <button key={p.id} type="button" role="radio" aria-checked={periodo === p.id} onClick={() => setPeriodo(p.id)} className={`rg-pill${periodo === p.id ? " on" : ""}`}>{p.label}</button>)}
        </div>
        <select aria-label="Quem fez" value={ator} onChange={(e) => setAtor(e.target.value)} style={css(INPUT + ";flex:0 1 200px")}>
          <option value="">Qualquer pessoa</option>
          {pessoas.slice().sort((a, b) => nomeDe(a).localeCompare(nomeDe(b), "pt-BR")).map((p) => <option key={p.id} value={p.id}>{nomeDe(p)}</option>)}
        </select>
        <select aria-label="Assunto" value={tipo} onChange={(e) => setTipo(e.target.value)} style={css(INPUT + ";flex:0 1 180px")}>
          <option value="">Todos os assuntos</option>
          {ASSUNTOS.map((a) => <option key={a.label} value={a.tipos.join(",")}>{a.label}</option>)}
        </select>
      </div>

      {review && <div style={css(CARD)}><span style={css("font-size:13px;color:#5b5473")}>Na amostra o Registro fica vazio: ele só mostra o que aconteceu de verdade no servidor.</span></div>}
      {erro && <div role="alert" className="rg-erro">{erro}<button type="button" onClick={() => void carregar(0)}>Tentar de novo</button></div>}
      {loading && !eventos.length && <div aria-busy="true"><div className="rg-skel"/><div className="rg-skel"/><div className="rg-skel"/></div>}
      {!loading && !erro && !review && !eventos.length && <div style={css(CARD + ";display:flex;gap:12px;align-items:center")}><img src="/asa/consultando.webp" alt="" style={css("width:56px;height:56px;object-fit:contain")}/><span style={css("font-size:13px;color:#5b5473")}>Nada no Registro com esses filtros. Tente outro período ou limpe a busca.</span></div>}

      {porDia.map((g) => <section key={g.dia} aria-label={g.dia} style={css("display:flex;flex-direction:column;gap:8px")}>
        <h2 style={css(MONO + ";margin:6px 2px 0;font-weight:700")}>{g.dia}</h2>
        <div style={css("background:#fff;border:1px solid #e6e1f2;border-radius:16px;overflow:hidden")}>
          {g.itens.map((e) => {
            const motivo = typeof e.metadata?.reason === "string" && e.metadata.reason ? e.metadata.reason : null;
            const difs = aberto === e.id ? diferencas(e.beforeState, e.afterState) : [];
            return <article key={e.id} className="rg-item">
              <button type="button" className="rg-linha" aria-expanded={aberto === e.id} onClick={() => setAberto(aberto === e.id ? null : e.id)}>
                <span style={css("font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;color:#6b6482;width:44px;flex:none")}>{hora(e.occurredAt)}</span>
                <span style={css("display:flex;flex-direction:column;gap:2px;min-width:0;flex:1;text-align:left")}>
                  <span style={css("font-size:13.5px;font-weight:700;color:#1c1440")}>{e.title || e.action}</span>
                  <span style={css("font-size:12.5px;color:#5b5473;line-height:1.45")}>{e.narrative}</span>
                  <span style={css("display:flex;gap:6px;flex-wrap:wrap;margin-top:3px")}>
                    <span className="rg-chip">{e.actorName ?? (e.actorType === "HUMAN" ? "alguém" : "o sistema")}</span>
                    <span className="rg-chip rg-chip-tipo">{TIPOS[e.entityType] ?? e.entityType}</span>
                    {motivo && <span className="rg-chip rg-chip-motivo">motivo: {motivo}</span>}
                  </span>
                </span>
                <span aria-hidden="true" style={css("color:#6C2BF2;font-weight:700;flex:none")}>{aberto === e.id ? "−" : "+"}</span>
              </button>
              {aberto === e.id && <div className="rg-detalhe">
                {difs.length ? <table><thead><tr><th scope="col">Campo</th><th scope="col">Antes</th><th scope="col">Depois</th></tr></thead><tbody>
                  {difs.map((d) => <tr key={d.campo}><th scope="row">{d.campo}</th><td>{d.antes ?? <em>não existia</em>}</td><td>{d.depois ?? <em>removido</em>}</td></tr>)}
                </tbody></table> : <p>Sem antes/depois guardado para este registro — a descrição acima é o que ficou.</p>}
                <p className="rg-tecnico">{e.action} · {e.entityType} {e.entityId}</p>
              </div>}
            </article>;
          })}
        </div>
      </section>)}

      {hasMore && <div><button type="button" className="rg-mais" disabled={loading} onClick={() => void carregar(eventos.length)}>{loading ? "Carregando…" : "Carregar mais"}</button></div>}
    </div>
  </section>;
}
