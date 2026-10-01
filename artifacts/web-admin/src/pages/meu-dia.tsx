import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import { ApiError, customFetch } from "@workspace/api-client-react";
import { css } from "@/lib/dc-style";
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

const TONES: Record<Tom, { bg: string; fg: string }> = {
  ok: { bg: "#e3f4f1", fg: "#0E8F86" },
  warn: { bg: "#fdeee4", fg: "#C2600F" },
  mute: { bg: "#f0eef5", fg: "#6b6482" },
  mine: { bg: "#fbeaf3", fg: "#C2508F" },
};
const MONO_LABEL = "font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:#6b6482";
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

  if (loading && !dia) return <section className="md-root" aria-busy="true" style={css("padding:18px 20px")}><div className="md-skeleton"/><div className="md-skeleton"/><div className="md-skeleton"/></section>;
  if (error || !dia) return <section className="md-root" style={css("padding:18px 20px")}>
    <div role="alert" style={css("display:flex;align-items:center;gap:12px;background:#fff;border:1px solid #e6e1f2;border-radius:16px;padding:16px 18px")}>
      <img src={mascote("duvida")} alt="" style={css("width:44px;height:44px;object-fit:contain;flex:none")}/>
      <span style={css("font-size:13.5px;color:#3d3559;flex:1")}>{error || "Não consegui montar o seu dia agora."}</span>
      <button type="button" className="md-hit" onClick={load} style={css("border:1px solid #e6e1f2;background:#fff;color:#3d3559;border-radius:999px;padding:9px 16px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:Manrope,sans-serif")}>Tentar de novo</button>
    </div>
  </section>;

  const acao = dia.saudacao.acao;
  const primaryStyle = "border:none;cursor:pointer;font-family:Manrope,sans-serif;font-weight:700;border-radius:999px;padding:11px 20px;font-size:13.5px;background:#fff;color:#2b1f63;text-decoration:none;white-space:nowrap;flex:none";
  return <section className="md-root">
    <div className="md-grid" style={css("padding:18px 20px;display:grid;grid-template-columns:1fr 296px;gap:16px;align-content:start")}>
      <div style={css("display:flex;flex-direction:column;gap:14px;min-width:0")}>
        <div className="md-hero" style={css("display:flex;align-items:center;gap:16px;background:linear-gradient(120deg,#1c1440,#3a2278);border-radius:18px;padding:16px 20px;color:#fff")}>
          <img src={mascote(dia.saudacao.mascote)} alt="ASA" style={css("width:82px;height:82px;object-fit:contain;flex:none")}/>
          <div style={css("display:flex;flex-direction:column;gap:5px;min-width:0")}>
            <span style={css("font-family:Outfit,sans-serif;font-size:22px;font-weight:600;letter-spacing:-0.01em")}>{dia.saudacao.titulo}</span>
            <span style={css("font-size:13.5px;line-height:1.5;color:#d6cff5;text-wrap:pretty")}>{dia.saudacao.texto}</span>
            {aviso && <span role="alert" style={css("font-size:12.5px;line-height:1.45;color:#ffd9c2")}>{aviso}</span>}
          </div>
          <span style={css("flex:1")}/>
          {acao && ("checkIn" in acao
            ? <button type="button" className="md-hit" disabled={saving || review} onClick={() => void checkIn(acao.checkIn)} style={css(primaryStyle)}>{saving ? "Registrando…" : acao.label}</button>
            : <Link href={acao.href} className="md-hit" style={css(primaryStyle)}>{acao.label}</Link>)}
        </div>

        {dia.proximo && <div style={css("background:#fff;border:1px solid #e6e1f2;border-radius:16px;padding:16px 18px;display:flex;flex-direction:column;gap:12px")}>
          <div style={css("display:flex;align-items:center;gap:10px")}>
            <span style={css(MONO_LABEL)}>{dia.proximo.rotulo}</span>
            <span style={css("flex:1")}/>
            <Link href={dia.proximo.href} className="md-hit" style={css("font-size:11.5px;font-weight:600;color:#6C2BF2;text-decoration:none")}>{dia.proximo.link}</Link>
          </div>
          <div style={css("display:flex;align-items:center;gap:16px;flex-wrap:wrap")}>
            <div style={css("display:flex;flex-direction:column;align-items:center;gap:2px;flex:none;width:74px")}>
              <span style={css("font-family:Outfit,sans-serif;font-size:26px;font-weight:700;letter-spacing:-0.02em")}>{dia.proximo.time}</span>
              <span style={css("font-size:11px;color:#6b6482")}>{dia.proximo.rel}</span>
            </div>
            <span style={css("width:3px;align-self:stretch;border-radius:3px;background:linear-gradient(#6C2BF2,#2E3BD6)")}/>
            <div style={css("display:flex;flex-direction:column;gap:4px;min-width:0")}>
              <span style={css("font-family:Outfit,sans-serif;font-size:17px;font-weight:600")}>{dia.proximo.title}</span>
              <span style={css("font-size:13px;color:#6b6482")}>{dia.proximo.sub}</span>
            </div>
            <span style={css("flex:1")}/>
            {dia.proximo.chips.map((c) => <span key={c} style={css("font-size:11.5px;font-weight:600;color:#3d3559;background:#f3f0fb;border-radius:999px;padding:5px 11px")}>{c}</span>)}
          </div>
        </div>}

        <div style={css("background:#fff;border:1px solid #e6e1f2;border-radius:16px;padding:16px 18px;display:flex;flex-direction:column;gap:12px;min-height:0")}>
          <div style={css("display:flex;align-items:center;gap:10px;flex-wrap:wrap")}>
            <span style={css(MONO_LABEL)}>{dia.linhaDoTempo.rotulo}</span>
            <span style={css("flex:1")}/>
            <span style={css("font-size:11.5px;color:#6b6482")}>{dia.linhaDoTempo.dica}</span>
          </div>
          <div style={css("display:flex;flex-direction:column;gap:2px")}>
            {dia.linhaDoTempo.itens.map((t, i) => {
              const T = TONES[t.tone];
              const row = <>
                <span style={css("font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;color:#6b6482;width:46px;flex:none")}>{t.time}</span>
                <span style={css("width:8px;height:8px;border-radius:50%;flex:none;background:" + T.fg + ";" + (t.tone === "mute" ? "opacity:.5;" : ""))}/>
                <span style={css("display:flex;flex-wrap:wrap;align-items:baseline;column-gap:10px;flex:1;min-width:0")}>
                  <span style={css("font-size:13.5px;font-weight:600;min-width:0")}>{t.title}</span>
                  <span style={css("font-size:12px;color:#6b6482")}>{t.sub}</span>
                </span>
                {t.tag && <span style={css("font-size:10.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;padding:3px 8px;border-radius:6px;background:" + T.bg + ";color:" + T.fg + ";font-family:'JetBrains Mono',monospace;white-space:nowrap")}>{t.tag}</span>}
              </>;
              const rowStyle = "display:flex;align-items:center;gap:10px;padding:8px 8px;border-radius:10px;text-decoration:none;color:inherit;" + (t.tone === "mine" ? "background:#fdf4f9;" : "");
              return t.href ? <Link key={i} href={t.href} className="md-row" style={css(rowStyle)}>{row}</Link> : <div key={i} style={css(rowStyle)}>{row}</div>;
            })}
            {!dia.linhaDoTempo.itens.length && <span style={css("font-size:13px;color:#6b6482;padding:8px")}>{dia.linhaDoTempo.dica}</span>}
          </div>
        </div>
      </div>

      <div style={css("display:flex;flex-direction:column;gap:14px;min-width:0")}>
        <div style={css("background:#fff;border:1px solid #e6e1f2;border-radius:16px;padding:14px 16px;display:flex;flex-direction:column;gap:12px")}>
          <div style={css("display:flex;align-items:center;gap:8px")}>
            <img src={mascote(dia.pendencias.mascote)} alt="" style={css("width:34px;height:34px;object-fit:contain;flex:none")}/>
            <span style={css("font-family:Outfit,sans-serif;font-size:15px;font-weight:600")}>{dia.pendencias.titulo}</span>
          </div>
          <div style={css("display:flex;flex-direction:column;gap:8px")}>
            {dia.pendencias.itens.map((p, i) => {
              const T = TONES[p.tone];
              return <Link key={i} href={p.href} className="md-hit md-row" style={css("display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:11px;background:#faf9fe;border:1px solid #f0ecf8;text-decoration:none;color:inherit;min-height:44px")}>
                <span style={css("flex:none;width:26px;height:26px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;background:" + T.bg + ";color:" + T.fg + ";")}>{p.count}</span>
                <div style={css("display:flex;flex-direction:column;gap:2px;min-width:0")}>
                  <span style={css("font-size:13px;font-weight:600")}>{p.title}</span>
                  <span style={css("font-size:11.5px;color:#6b6482")}>{p.sub}</span>
                </div>
              </Link>;
            })}
            {!dia.pendencias.itens.length && <span style={css("font-size:12.5px;color:#6b6482;line-height:1.45")}>Nada esperando por você agora.</span>}
          </div>
        </div>

        <div style={css("background:#fff;border:1px solid #e6e1f2;border-radius:16px;padding:14px 16px;display:flex;flex-direction:column;gap:10px")}>
          <div style={css("display:flex;align-items:center;gap:8px")}>
            <span style={css("font-family:Outfit,sans-serif;font-size:15px;font-weight:600")}>Mural</span>
            <span style={css("flex:1")}/>
            <Link href="/mural" className="md-hit" style={css("font-size:11.5px;font-weight:600;color:#6C2BF2;text-decoration:none")}>abrir o Mural</Link>
          </div>
          <div style={css("display:flex;flex-direction:column;gap:8px")}>
            {dia.mural.map((m, i) => <div key={i} style={css("display:flex;align-items:center;gap:9px")}>
              <img src={mascote(m.icone)} alt="" style={css("width:26px;height:26px;object-fit:contain;flex:none")}/>
              <span style={css("font-size:12.5px;line-height:1.4;color:#3d3559;text-wrap:pretty")}>{m.texto}</span>
            </div>)}
            {!dia.mural.length && <span style={css("font-size:12.5px;color:#6b6482")}>Nada novo no Mural.</span>}
          </div>
          <span style={css("font-size:11px;color:#6b6482;line-height:1.4")}>Três linhas, sempre. A lista inteira mora no Mural.</span>
        </div>
      </div>
    </div>
    <footer style={css("display:flex;align-items:center;gap:8px;padding:8px 20px;border-top:1px solid #ebe6f6;background:#fff;min-height:40px;box-sizing:border-box")}>
      <span style={css("font-family:'JetBrains Mono',monospace;font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:#6b6482")}>My ASA</span>
      <span style={css("flex:1")}/>
      <span style={css("font-size:11px;color:#6b6482")}>{`${dataLonga(dia.data)} · atualizado às ${dia.hora}`}</span>
    </footer>
  </section>;
}
