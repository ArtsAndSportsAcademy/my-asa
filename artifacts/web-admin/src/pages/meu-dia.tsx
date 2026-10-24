import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import { ApiError, customFetch } from "@workspace/api-client-react";
import { semRede } from "@/lib/sem-rede";
import { REVIEW_PERSON } from "@/lib/amostra";
import { sampleDia, todayISO } from "@/lib/review-escala";
import "./meu-dia.css";

/* 17 Meu Dia — cópia de design_handoff_my_asa/telas/17 Meu Dia.dc.html (quadro web), sem a moldura de
   documentação. O conteúdo vem montado do servidor (`GET /api/meu-dia`), já no recorte do perfil. */

type Role = "adm" | "dir" | "sup" | "mem";
type Tom = "ok" | "warn" | "mute" | "mine";
type Acao = { label: string; href: string } | { label: string; checkIn: { scaleId: string; sourceKey: string; date: string } };
type MeuDia = {
  perfil: Role; nome: string; data: string; hora: string;
  saudacao: { titulo: string; texto: string; mascote: string; acao: Acao | null };
  proximo: { rotulo: string; link: string; href: string; time: string; rel: string; title: string; sub: string; chips: string[] } | null;
  linhaDoTempo: { rotulo: string; dica: string; itens: { time: string; title: string; sub: string; tag: string; tone: Tom; href?: string }[] };
  pendencias: { titulo: string; mascote: string; itens: { count: number; title: string; sub: string; tone: Exclude<Tom, "mine">; href: string }[] };
  mural: { icone: string; texto: string }[];
};

const WEEKDAY = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const MONTH = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const dataLonga = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return `${WEEKDAY[new Date(y, m - 1, d).getDay()]}, ${d} de ${MONTH[m - 1]}`; };
const mascote = (nome: string) => `/asa/${nome}.webp`;

/** Amostra local: o mesmo formato, montado do dados-de-exemplo.json (Snowland, hoje). */
function amostra(role: Role): MeuDia {
  const pessoa = REVIEW_PERSON[role];
  const dia = sampleDia("snowland", todayISO());
  const agora = new Date(), hora = `${String(agora.getHours()).padStart(2, "0")}:${String(agora.getMinutes()).padStart(2, "0")}`;
  const blocos = (role === "mem" ? dia.blocos.filter((b) => b.pessoaIds.includes(pessoa)) : dia.blocos.filter((b) => !b.vazio)).slice(0, 8);
  const prox = blocos.find((b) => (b.fim ?? b.inicio) > hora) ?? blocos[0];
  return {
    perfil: role, nome: pessoa, data: todayISO(), hora,
    saudacao: { titulo: `Bom dia, ${pessoa}!`, texto: role === "mem" ? `Você entra às ${blocos[0]?.inicio ?? "—"}. Faz o check-in por aqui mesmo — leva um toque.` : "Amostra local: os números reais vêm do servidor.", mascote: role === "mem" ? "bom-dia" : role === "dir" ? "consultando" : role === "adm" ? "estudando" : "aviso-importante", acao: { label: role === "mem" ? "Ver minha escala" : "Ver a escala de hoje", href: "/escalas" } },
    proximo: prox ? { rotulo: role === "mem" ? "Sua próxima atividade" : "Próximo em Snowland", link: "abrir a escala", href: "/escalas", time: prox.inicio, rel: "hoje", title: prox.rotulo, sub: `Snowland${prox.fim ? ` · até ${prox.fim}` : ""}`, chips: ["Snowland"] } : null,
    linhaDoTempo: { rotulo: role === "mem" ? "Seu dia" : "Grade de hoje — Snowland", dica: "amostra do dados-de-exemplo.json", itens: blocos.map((b) => ({ time: b.inicio, title: b.rotulo, sub: b.fim ? `até ${b.fim}` : "", tag: b.dailyBookId ? "show" : "", tone: b.dailyBookId ? "mine" as const : "mute" as const })) },
    pendencias: { titulo: role === "mem" ? "Do seu lado" : role === "dir" ? "Sinais da empresa" : role === "adm" ? "Depende da administração" : "Decisões suas", mascote: "lembrete", itens: [] },
    mural: [],
  };
}

export default function MeuDiaPage({ role }: { role: Role }) {
  const review = import.meta.env.DEV && (new URLSearchParams(window.location.search).get("amostra") === "1" || window.sessionStorage.getItem("myasa-review-sample") === "1");
  const [dia, setDia] = useState<MeuDia | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aviso, setAviso] = useState("");

  const load = useCallback(() => {
    setError(""); setLoading(true);
    if (review) { setDia(amostra(role)); setLoading(false); return; }
    customFetch<MeuDia>("/api/meu-dia").then(setDia).catch(() => setError("Não consegui montar o seu dia agora.")).finally(() => setLoading(false));
  }, [review, role]);
  useEffect(load, [load]);

  const checkIn = async (target: { scaleId: string; sourceKey: string; date: string }) => {
    setSaving(true); setAviso("");
    try {
      await customFetch("/api/day-checkins", { method: "POST", body: JSON.stringify({ scaleId: target.scaleId, sourceKey: target.sourceKey, status: "CHECKED_IN", date: target.date }) });
      load();
    } catch (err) {
      setAviso(semRede(err) ?"Sem conexão. Avise a sua supervisão por fora — o check-in não fica guardado para depois." : "Não consegui registrar o check-in. Tente de novo ou avise a sua supervisão.");
    } finally { setSaving(false); }
  };

  if (loading && !dia) return <section className="md-root" aria-busy="true"><div className="md-page"><div className="md-skeleton"/><div className="md-skeleton"/><div className="md-skeleton"/></div></section>;
  if (error || !dia) return <section className="md-root"><div className="md-page">
    <div role="alert" className="md-card md-error">
      <img src={mascote("duvida")} alt="" className="md-error-img"/>
      <span className="md-error-text">{error || "Não consegui montar o seu dia agora."}</span>
      <button type="button" className="md-hit md-btn-ghost" onClick={load}>Tentar de novo</button>
    </div>
  </div></section>;

  const acao = dia.saudacao.acao;
  return <section className="md-root">
    <div className="md-page md-grid">
      <div className="md-col">
        <div className="md-hero">
          <img src={mascote(dia.saudacao.mascote)} alt="ASA" className="md-hero-img"/>
          <div className="md-hero-text">
            <h2>{dia.saudacao.titulo}</h2>
            <p>{dia.saudacao.texto}</p>
            {aviso && <p role="alert" className="md-hero-alert">{aviso}</p>}
          </div>
          {acao && ("checkIn" in acao
            ? <button type="button" className="md-hit md-hero-cta" disabled={saving || review} onClick={() => void checkIn(acao.checkIn)}>{saving ? "Registrando…" : acao.label}</button>
            : <Link href={acao.href} className="md-hit md-hero-cta">{acao.label}</Link>)}
        </div>

        {dia.proximo && <div className="md-card">
          <div className="md-card-head">
            <span className="md-label">{dia.proximo.rotulo}</span>
            <Link href={dia.proximo.href} className="md-hit md-link">{dia.proximo.link}</Link>
          </div>
          <div className="md-next">
            <div className="md-next-time"><b>{dia.proximo.time}</b><span>{dia.proximo.rel}</span></div>
            <span className="md-next-bar" aria-hidden="true"/>
            <div className="md-next-text"><b>{dia.proximo.title}</b><span>{dia.proximo.sub}</span></div>
            {dia.proximo.chips.length > 0 && <div className="md-chips">{dia.proximo.chips.map((c) => <span key={c} className="md-chip">{c}</span>)}</div>}
          </div>
        </div>}

        <div className="md-card">
          <div className="md-card-head">
            <span className="md-label">{dia.linhaDoTempo.rotulo}</span>
            <span className="md-note">{dia.linhaDoTempo.dica}</span>
          </div>
          <div className="md-timeline">
            {dia.linhaDoTempo.itens.map((t, i) => {
              const row = <>
                <span className="md-t-time">{t.time}</span>
                <span className="md-t-dot" aria-hidden="true"/>
                <span className="md-t-text"><b>{t.title}</b>{t.sub && <span>{t.sub}</span>}</span>
                {t.tag && <span className="md-t-tag">{t.tag}</span>}
              </>;
              const cls = `md-t-row tone-${t.tone}`;
              return t.href ? <Link key={i} href={t.href} className={`${cls} md-row`}>{row}</Link> : <div key={i} className={cls}>{row}</div>;
            })}
            {!dia.linhaDoTempo.itens.length && <p className="md-empty">{dia.perfil === "mem" ? "Nada na sua escala de hoje." : "Nada pedindo atenção aqui agora."}</p>}
          </div>
        </div>
      </div>

      <div className="md-col">
        <div className="md-card">
          <div className="md-card-title">
            <img src={mascote(dia.pendencias.mascote)} alt="" className="md-card-img"/>
            <h3>{dia.pendencias.titulo}</h3>
          </div>
          <div className="md-stack">
            {dia.pendencias.itens.map((p, i) => <Link key={i} href={p.href} className={`md-hit md-row md-pend tone-${p.tone}`}>
              <span className="md-pend-count">{p.count}</span>
              <span className="md-pend-text"><b>{p.title}</b><span>{p.sub}</span></span>
            </Link>)}
            {!dia.pendencias.itens.length && <p className="md-empty">Nada esperando por você agora.</p>}
          </div>
        </div>

        <div className="md-card">
          <div className="md-card-head">
            <h3>Mural</h3>
            <Link href="/mural" className="md-hit md-link">abrir o Mural</Link>
          </div>
          <div className="md-stack">
            {dia.mural.map((m, i) => <div key={i} className="md-mural-item">
              <img src={mascote(m.icone)} alt="" className="md-mural-img"/>
              <span>{m.texto}</span>
            </div>)}
            {!dia.mural.length && <p className="md-empty">Nada novo no Mural.</p>}
          </div>
        </div>
      </div>
    </div>
    <footer className="md-foot">
      <span className="md-foot-brand">My ASA</span>
      <span>{`${dataLonga(dia.data)} · atualizado às ${dia.hora}`}</span>
    </footer>
  </section>;
}
