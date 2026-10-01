import { useEffect, useState } from "react";
import { Redirect } from "wouter";
import { customFetch } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/useAuth";

/**
 * Folha do camarim (doc 12: "a escala do dia precisa existir fora do app"). Lê a mesma Escala do dia da
 * tela 15 (`/api/escalas/dia`), por pessoa, pronta para imprimir. Rascunho sai marcado como rascunho.
 */
type Bloco = { key: string; rotulo: string; inicio: string; fim: string | null; regra: string | null; pessoaIds: string[]; vazio: boolean; sinal: string | null };
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
const texto = (b: Bloco) => b.regra === "livro" && !b.rotulo.includes(":") ? `${b.rotulo} ${b.inicio}` : b.rotulo;
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

export default function PrintDayPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const params = new URLSearchParams(window.location.search);
  const [date, setDate] = useState(params.get("data") ?? today());
  const [locationId, setLocationId] = useState(params.get("local") ?? "");
  const [locais, setLocais] = useState<{ id: string; name: string }[]>([]);
  const [dia, setDia] = useState<Dia | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) return;
    customFetch<{ locais: { id: string; name: string }[] }>("/api/escalas/locais").then((r) => {
      setLocais(r.locais);
      setLocationId((current) => current || r.locais[0]?.id || "");
      if (!r.locais.length) { setLoading(false); setError("Nenhum local no seu acesso."); }
    }).catch(() => { setLoading(false); setError("Não consegui carregar os locais."); });
  }, [isAuthenticated]);

  useEffect(() => {
    if (!locationId) return;
    setLoading(true); setError("");
    customFetch<{ dia: Dia }>(`/api/escalas/dia?locationId=${locationId}&date=${date}`)
      .then((r) => setDia(r.dia))
      .catch(() => setError("Não consegui carregar a escala. Não imprima uma versão antiga."))
      .finally(() => setLoading(false));
  }, [locationId, date]);

  if (isLoading) return null;
  if (!isAuthenticated) return <Redirect to="/login"/>;

  const publicada = dia?.escala && dia.escala.status !== "DRAFT";
  const porPessoa = (dia?.pessoas ?? []).filter((p) => !p.folga).map((p) => ({ ...p, blocos: (dia?.blocos ?? []).filter((b) => b.pessoaIds.includes(p.id)).sort((a, b) => a.inicio.localeCompare(b.inicio)) }))
    .filter((p) => p.blocos.length).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const colunas = [porPessoa.slice(0, Math.ceil(porPessoa.length / 2)), porPessoa.slice(Math.ceil(porPessoa.length / 2))];
  const fora = (dia?.pessoas ?? []).filter((p) => p.folga);
  const vazios = (dia?.blocos ?? []).filter((b) => b.vazio);

  return <main className="print-day max-w-5xl mx-auto p-6">
    <div className="print-controls flex flex-wrap gap-3 mb-5 items-center">
      <label>Local <select value={locationId} onChange={(e) => setLocationId(e.target.value)}>{locais.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
      <label>Dia <input type="date" value={date} onChange={(e) => setDate(e.target.value)}/></label>
      <button type="button" className="print-button" disabled={!dia || loading} onClick={() => window.print()}>Imprimir a escala do dia</button>
      <a href="/escalas">Voltar para Escalas</a>
    </div>
    <h1 className="text-2xl font-semibold">Escala do dia · {dia?.location.name ?? "…"}</h1>
    <p className="my-3">{longDate(date)} · {publicada ? `publicada${dia?.escala?.publishedAt ? ` às ${new Date(dia.escala.publishedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}` : ""} · versão ${dia?.escala?.version}` : "sem publicação"} · impressa em {new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}</p>
    {!loading && dia && !publicada && <p className="print-warning" role="alert">RASCUNHO — esta escala ainda não foi publicada e pode mudar.</p>}
    {dia?.escala?.alteradaDesde && <p className="print-warning" role="alert">Mudou depois da publicação e ainda não foi republicada.</p>}
    {loading ? <p>Carregando escala…</p> : error ? <p role="alert">{error}</p> : <>
      <div className="print-columns grid grid-cols-2 gap-5">{colunas.map((coluna, i) => <table className="w-full text-sm" key={i}><thead><tr><th>Pessoa</th><th>Blocos do dia</th></tr></thead><tbody>{coluna.map((p) => <tr key={p.id}><td><strong>{p.name}</strong><div>{p.areaName ?? ""}</div></td><td>{p.blocos.map((b) => <div key={b.key}>{b.inicio}{b.fim ? `–${b.fim}` : ""} · {texto(b)}</div>)}</td></tr>)}</tbody></table>)}</div>
      {!porPessoa.length && <p>Nenhuma pessoa escalada neste dia.</p>}
      {fora.length > 0 && <p className="mt-4"><strong>Fora o dia todo:</strong> {fora.map((p) => `${p.name} (${FOLGA[p.folga ?? ""] ?? "fora"})`).join(" · ")}</p>}
      {vazios.length > 0 && <p className="mt-2"><strong>Blocos sem ninguém:</strong> {vazios.map((b) => `${b.inicio} ${texto(b)}`).join(" · ")}</p>}
    </>}
  </main>;
}
