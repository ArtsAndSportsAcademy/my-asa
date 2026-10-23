import { useEffect, useState } from "react";
import { Redirect } from "wouter";
import { customFetch } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/useAuth";
import { sampleDia, sampleLocais } from "@/lib/review-escala";

/**
 * Folha do camarim (doc 12: "a escala do dia precisa existir fora do app"). Lê a mesma Escala do dia da
 * tela 15 (`/api/escalas/dia`), pronta para imprimir, de dois jeitos como a própria tela: por pessoa
 * ou por atividade. Quando o bloco é de um Livro do Dia, cada um sai com o personagem (a vaga) que faz.
 * Rascunho sai marcado como rascunho.
 */
type Vaga = { assignmentId: string; personagem: string; userId: string | null };
type Bloco = { key: string; rotulo: string; inicio: string; fim: string | null; regra: string | null; pessoaIds: string[]; vazio: boolean; sinal: string | null; vagas?: Vaga[] };
type Dia = {
  date: string; location: { id: string; name: string };
  escala: { status: string; version: number; publishedAt: string | null; alteradaDesde: string | null } | null;
  pessoas: { id: string; name: string; areaName: string | null; folga: string | null }[];
  blocos: Bloco[];
};
const WEEKDAY = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
const MONTH = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const longDate = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return `${WEEKDAY[new Date(y, m - 1, d).getDay()]}, ${d} de ${MONTH[m - 1]} de ${y}`; };
const FOLGA: Record<string, string> = { DAY_OFF: "folga", RECESSO: "recesso", NO_SHOW: "no show", AFASTAMENTO: "afastamento", RESTRICAO: "restrição", OUTRO: "fora" };
const texto = (b: Bloco) => b.regra === "livro" && !/\d{1,2}(:|h)\d{0,2}/i.test(b.rotulo) ? `${b.rotulo} ${b.inicio}` : b.rotulo; // "Musical 15h" já traz a hora
const nomeOrdem = (a: string, b: string) => a.localeCompare(b, "pt-BR");
/** Personagens que a pessoa faz neste bloco (um show pode dar duas vagas à mesma pessoa). */
const personagensDe = (b: Bloco, pessoaId: string) => (b.vagas ?? []).filter((v) => v.userId === pessoaId).map((v) => v.personagem);
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

export default function PrintDayPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const params = new URLSearchParams(window.location.search);
  // A folha do camarim também se revisa em amostra, como as outras telas.
  const review = import.meta.env.DEV && (params.get("amostra") === "1" || window.sessionStorage.getItem("myasa-review-sample") === "1");
  const [date, setDate] = useState(params.get("data") ?? today());
  const [locationId, setLocationId] = useState(params.get("local") ?? "");
  const [locais, setLocais] = useState<{ id: string; name: string }[]>([]);
  const [modo, setModo] = useState<"pessoa" | "atividade">(params.get("ver") === "atividade" ? "atividade" : "pessoa");
  const [dia, setDia] = useState<Dia | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (review) { setLocais(sampleLocais); setLocationId((atual) => atual || sampleLocais[0]?.id || ""); return; }
    if (!isAuthenticated) return;
    customFetch<{ locais: { id: string; name: string }[] }>("/api/escalas/locais").then((r) => {
      setLocais(r.locais);
      setLocationId((current) => current || r.locais[0]?.id || "");
      if (!r.locais.length) { setLoading(false); setError("Nenhum local no seu acesso."); }
    }).catch(() => { setLoading(false); setError("Não consegui carregar os locais."); });
  }, [isAuthenticated]);

  useEffect(() => {
    if (!locationId) return;
    // Esvazia o dia anterior: se a nova escala falhar ao carregar, o botão de imprimir não pode seguir ligado com a folha velha.
    setDia(null); setLoading(true); setError("");
    if (review) { setDia(sampleDia(locationId, date) as unknown as Dia); setLoading(false); return; }
    customFetch<{ dia: Dia }>(`/api/escalas/dia?locationId=${locationId}&date=${date}`)
      .then((r) => setDia(r.dia))
      .catch(() => setError("Não consegui carregar a escala. Não imprima uma versão antiga."))
      .finally(() => setLoading(false));
  }, [locationId, date, review]);

  if (isLoading) return null;
  if (!isAuthenticated && !review) return <Redirect to="/login"/>;

  const publicada = dia?.escala && dia.escala.status !== "DRAFT";
  const porPessoa = (dia?.pessoas ?? []).filter((p) => !p.folga).map((p) => ({ ...p, blocos: (dia?.blocos ?? []).filter((b) => b.pessoaIds.includes(p.id)).sort((a, b) => a.inicio.localeCompare(b.inicio)) }))
    .filter((p) => p.blocos.length).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const nomeDe = new Map((dia?.pessoas ?? []).map((p) => [p.id, p.name]));
  // Por atividade: só entra bloco que convoca alguém ou que ficou sem ninguém (bloco "ninguém" é pausa, não escala).
  const porAtividade = (dia?.blocos ?? []).filter((b) => b.pessoaIds.length || b.vazio).sort((a, b) => a.inicio.localeCompare(b.inicio) || a.rotulo.localeCompare(b.rotulo, "pt-BR"))
    .map((b) => {
      const comVaga = new Set<string>();
      const personagens = (b.vagas ?? []).map((v) => { const quem = v.userId && b.pessoaIds.includes(v.userId) ? v.userId : null; if (quem) comVaga.add(quem); return { personagem: v.personagem, nome: quem ? nomeDe.get(quem) ?? "—" : null }; });
      const semVaga = b.pessoaIds.filter((id) => !comVaga.has(id)).map((id) => nomeDe.get(id) ?? "—").sort(nomeOrdem);
      return { bloco: b, personagens, semVaga };
    });
  const colunas = [porPessoa.slice(0, Math.ceil(porPessoa.length / 2)), porPessoa.slice(Math.ceil(porPessoa.length / 2))];
  const fora = (dia?.pessoas ?? []).filter((p) => p.folga);
  const vazios = (dia?.blocos ?? []).filter((b) => b.vazio);

  return <main className="print-day max-w-5xl mx-auto p-6">
    <div className="print-controls flex flex-wrap gap-3 mb-5 items-center">
      <label>Local <select value={locationId} onChange={(e) => setLocationId(e.target.value)}>{locais.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
      <label>Dia <input type="date" value={date} onChange={(e) => setDate(e.target.value)}/></label>
      <span role="group" aria-label="Como imprimir">
        <button type="button" className="print-button" aria-pressed={modo === "pessoa"} style={{ fontWeight: modo === "pessoa" ? 700 : 400 }} onClick={() => setModo("pessoa")}>Por pessoa</button>{" "}
        <button type="button" className="print-button" aria-pressed={modo === "atividade"} style={{ fontWeight: modo === "atividade" ? 700 : 400 }} onClick={() => setModo("atividade")}>Por atividade</button>
      </span>
      <button type="button" className="print-button" disabled={!dia || loading} onClick={() => window.print()}>Imprimir a escala do dia</button>
      <a href="/escalas">Voltar para Escalas</a>
    </div>
    <h1 className="text-2xl font-semibold">Escala do dia · {dia?.location.name ?? "…"} · {modo === "atividade" ? "por atividade" : "por pessoa"}</h1>
    <p className="my-3">{longDate(date)} · {publicada ? `publicada${dia?.escala?.publishedAt ? ` às ${new Date(dia.escala.publishedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}` : ""} · versão ${dia?.escala?.version}` : "sem publicação"} · impressa em {new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}</p>
    {!loading && dia && !publicada && <p className="print-warning" role="alert">RASCUNHO — esta escala ainda não foi publicada e pode mudar.</p>}
    {dia?.escala?.alteradaDesde && <p className="print-warning" role="alert">Mudou depois da publicação e ainda não foi republicada.</p>}
    {loading ? <p>Carregando escala…</p> : error ? <p role="alert">{error}</p> : <>
      {modo === "pessoa"
        ? <div className="print-columns grid grid-cols-2 gap-5">{colunas.map((coluna, i) => <table className="w-full text-sm" key={i}><thead><tr><th>Pessoa</th><th>Blocos do dia</th></tr></thead><tbody>{coluna.map((p) => <tr key={p.id}><td><strong>{p.name}</strong><div>{p.areaName ?? ""}</div></td><td>{p.blocos.map((b) => <div key={b.key}>{b.inicio}{b.fim ? `–${b.fim}` : ""} · {texto(b)}{personagensDe(b, p.id).length > 0 && <strong> — {personagensDe(b, p.id).join(", ")}</strong>}</div>)}</td></tr>)}</tbody></table>)}</div>
        : <table className="w-full text-sm"><thead><tr><th>Horário</th><th>Atividade</th><th>Quem</th></tr></thead><tbody>{porAtividade.map(({ bloco: b, personagens, semVaga }) => <tr key={b.key}>
            <td style={{ whiteSpace: "nowrap" }}>{b.inicio}{b.fim ? `–${b.fim}` : ""}</td>
            <td><strong>{texto(b)}</strong></td>
            <td>{b.vazio ? <em>Sem ninguém escalado</em> : <>
              {personagens.map((v, i) => <div key={i}>{v.personagem}: {v.nome ? <strong>{v.nome}</strong> : <em>vaga sem ninguém</em>}</div>)}
              {semVaga.length > 0 && <div>{semVaga.join(" · ")}</div>}
            </>}</td>
          </tr>)}</tbody></table>}
      {modo === "pessoa" ? !porPessoa.length && <p>Nenhuma pessoa escalada neste dia.</p> : !porAtividade.length && <p>Nenhuma atividade neste dia.</p>}
      {fora.length > 0 && <p className="mt-4"><strong>Fora o dia todo:</strong> {fora.map((p) => `${p.name} (${FOLGA[p.folga ?? ""] ?? "fora"})`).join(" · ")}</p>}
      {modo === "pessoa" && vazios.length > 0 && <p className="mt-2"><strong>Blocos sem ninguém:</strong> {vazios.map((b) => `${b.inicio} ${texto(b)}`).join(" · ")}</p>}
    </>}
  </main>;
}
