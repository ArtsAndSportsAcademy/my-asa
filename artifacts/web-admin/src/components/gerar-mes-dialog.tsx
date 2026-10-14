import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, customFetch } from "@workspace/api-client-react";
import { useFecharComEsc } from "@/lib/fechar-com-esc";

/**
 * Gerar o mês em rascunho (Escala + Livros do Dia de todos os dias de um local). A tela dirige o
 * trabalho: pede ao servidor um bloco de dias por vez (cada chamada vive no máximo ~40 s), mostra
 * o andamento de verdade e pode parar. Dia já gerado é pulado, então retomar não repete nada.
 * Nada é publicado e ninguém é avisado.
 */
type Estado = "a_gerar" | "faltam_livros" | "completo" | "publicado" | "passou" | "fechado" | "sem_programacao" | "sem_atividades";
type DiaMes = { date: string; weekday: number; estado: Estado; motivo: string | null; livrosEsperados: number; livrosGerados: number; escalaStatus: string | null };
type Resumo = { location: { id: string; name: string }; year: number; month: number; dias: DiaMes[]; totais: { aGerar: number; completos: number; publicados: number; naoEntram: number } };
type Resultado = { gerados: { date: string; livros: number }[]; falhas: { date: string; motivo: string }[]; pulados: { date: string; estado: Estado; motivo: string | null }[]; restantes: number; proximoDia: string | null };

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const dm = (iso: string) => { const [, m, d] = iso.split("-").map(Number); return `${d}/${String(m).padStart(2, "0")}`; };
const plural = (n: number, um: string, muitos: string) => `${n} ${n === 1 ? um : muitos}`;
const ROTULO_PULADO: Record<string, string> = { passou: "já passou", fechado: "local fechado", sem_programacao: "sem Programação", sem_atividades: "Programação sem blocos", publicado: "já publicado" };
const mensagem = (err: unknown, padrao: string) => err instanceof ApiError && err.data && typeof err.data === "object" && typeof (err.data as { message?: unknown }).message === "string" ? (err.data as { message: string }).message : padrao;

/** Os meses que o servidor aceita: o corrente e até 2 à frente. */
function opcoesDeMes(hoje = new Date()) {
  return [0, 1, 2].map((n) => { const d = new Date(hoje.getFullYear(), hoje.getMonth() + n, 1); return { year: d.getFullYear(), month: d.getMonth() + 1, rotulo: `${MESES[d.getMonth()]} de ${d.getFullYear()}` }; });
}

/** Amostra (?amostra=1): resumo e geração de mentira, para revisar a tela sem tocar em dado nenhum. */
function resumoDeAmostra(local: { id: string; name: string }, year: number, month: number): Resumo {
  const ultimo = new Date(year, month, 0).getDate();
  const dias: DiaMes[] = Array.from({ length: ultimo }, (_, i) => {
    const d = i + 1, date = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`, weekday = new Date(year, month - 1, d).getDay();
    const base = { date, weekday, livrosEsperados: 5, livrosGerados: 0, escalaStatus: null as string | null };
    if (weekday === 3) return { ...base, estado: "fechado" as Estado, motivo: "O local não abre neste dia da semana.", livrosEsperados: 0 };
    if (d > 28) return { ...base, estado: "sem_programacao" as Estado, motivo: "Sem Programação para este dia.", livrosEsperados: 0 };
    if (d <= 3) return { ...base, estado: "completo" as Estado, motivo: null, livrosGerados: 5, escalaStatus: "DRAFT" };
    return { ...base, estado: "a_gerar" as Estado, motivo: null };
  });
  const conta = (...e: Estado[]) => dias.filter((x) => e.includes(x.estado)).length;
  return { location: local, year, month, dias, totais: { aGerar: conta("a_gerar", "faltam_livros"), completos: conta("completo"), publicados: conta("publicado"), naoEntram: conta("passou", "fechado", "sem_programacao", "sem_atividades") } };
}

export function GerarMesDialog({ locais, localInicial, review, onClose, onGerou }: {
  locais: { id: string; name: string }[]; localInicial: string; review: boolean; onClose: () => void; onGerou: () => void;
}) {
  const meses = useMemo(() => opcoesDeMes(), []);
  const [localId, setLocalId] = useState(localInicial);
  const [mesIdx, setMesIdx] = useState(0);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [rodando, setRodando] = useState(false);
  const [feitos, setFeitos] = useState(0);
  const [livrosFeitos, setLivrosFeitos] = useState(0);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [mostrarPulados, setMostrarPulados] = useState(false);
  const [modo, setModo] = useState<"gerar" | "descartar">("gerar");
  const parar = useRef(false);
  const mes = meses[mesIdx]!;
  const local = locais.find((l) => l.id === localId);
  // Esc fecha, mas não no meio da geração: parar é um botão (o que já foi gerado fica de qualquer jeito).
  useFecharComEsc(() => { if (!rodando) onClose(); });

  useEffect(() => {
    let cancelado = false;
    setCarregando(true); setErro(""); setResultado(null); setFeitos(0); setLivrosFeitos(0);
    (async () => {
      try {
        const r = review && local ? resumoDeAmostra(local, mes.year, mes.month)
          : await customFetch<Resumo>(`/api/escalas/mes/resumo?locationId=${localId}&year=${mes.year}&month=${mes.month}`);
        if (!cancelado) setResumo(r);
      } catch (e) { if (!cancelado) { setResumo(null); setErro(mensagem(e, "Não consegui ver o mês agora. Tente de novo.")); } }
      finally { if (!cancelado) setCarregando(false); }
    })();
    return () => { cancelado = true; };
  }, [localId, mesIdx, review]);

  const gerar = async () => {
    if (!resumo || rodando) return;
    parar.current = false; setRodando(true); setErro(""); setFeitos(0); setLivrosFeitos(0);
    // Ao continuar depois de parar, o que falta mudou: relê o mês para o andamento ter o tamanho certo.
    if (resultado && !review) {
      try { setResumo(await customFetch<Resumo>(`/api/escalas/mes/resumo?locationId=${localId}&year=${mes.year}&month=${mes.month}`)); } catch { /* segue com o resumo antigo */ }
    }
    setResultado(null);
    const acumulado: Resultado = { gerados: [], falhas: [], pulados: [], restantes: 0, proximoDia: null };
    let desde: string | null = null;
    try {
      for (;;) {
        const r: Resultado = review
          ? { gerados: resumo.dias.filter((d) => d.estado === "a_gerar").slice(acumulado.gerados.length, acumulado.gerados.length + 4).map((d) => ({ date: d.date, livros: 5 })), falhas: [], pulados: resumo.dias.filter((d) => d.estado !== "a_gerar" && d.estado !== "completo").map((d) => ({ date: d.date, estado: d.estado, motivo: d.motivo })), restantes: 0, proximoDia: null }
          : await customFetch<Resultado>("/api/escalas/mes/gerar", { method: "POST", body: JSON.stringify({ locationId: localId, year: mes.year, month: mes.month, desde }) });
        if (review) { const feitosAteAgora = acumulado.gerados.length + r.gerados.length; r.restantes = resumo.totais.aGerar - feitosAteAgora; r.proximoDia = r.restantes > 0 ? resumo.dias.filter((d) => d.estado === "a_gerar")[feitosAteAgora]?.date ?? null : null; await new Promise((ok) => setTimeout(ok, 500)); }
        acumulado.gerados.push(...r.gerados); acumulado.falhas.push(...r.falhas); acumulado.pulados = r.pulados;
        acumulado.restantes = r.restantes; acumulado.proximoDia = r.proximoDia;
        setFeitos(acumulado.gerados.length + acumulado.falhas.length); setLivrosFeitos(acumulado.gerados.reduce((s, g) => s + g.livros, 0));
        // Um dia que falhou continua pendente no servidor; `desde` faz a próxima chamada seguir adiante.
        if (!r.proximoDia || parar.current || (r.gerados.length === 0 && r.falhas.length === 0)) break;
        desde = r.proximoDia;
      }
      setResultado(acumulado);
      onGerou();
    } catch (e) {
      // O que já foi gerado fica; só mostra onde parou.
      setResultado(acumulado);
      setErro(`${mensagem(e, "A conexão falhou no meio do caminho.")} O que já foi gerado fica guardado; é só tentar de novo que ele continua de onde parou.`);
      onGerou();
    } finally { setRodando(false); }
  };

  const total = resumo?.totais.aGerar ?? 0;
  const entram = resumo ? resumo.dias.length - resumo.totais.naoEntram : 0;
  const pct = total ? Math.min(100, Math.round((feitos / total) * 100)) : 0;
  const naoEntram = resumo?.dias.filter((d) => ["passou", "fechado", "sem_programacao", "sem_atividades"].includes(d.estado)) ?? [];
  const botao = (primario: boolean) => ({ borderRadius: 999, padding: "10px 18px", fontSize: 13, fontWeight: 700 as const, cursor: "pointer", fontFamily: "Manrope,sans-serif", minHeight: 44, border: primario ? "none" : "1px solid #e6e1f2", background: primario ? "linear-gradient(135deg,#6C2BF2,#2E3BD6)" : "#fff", color: primario ? "#fff" : "#3d3559" });

  if (modo === "descartar" && local) {
    return <Casca titulo="Descartar rascunhos do mês" onClose={onClose} bloqueado={false}>
      <DescartarMes localId={localId} localNome={local.name} ano={mes.year} mes={mes.month} rotuloMes={mes.rotulo} review={review} onVoltar={() => { setModo("gerar"); onGerou(); }} onClose={onClose} onMudou={onGerou}/>
    </Casca>;
  }
  const temRascunho = Boolean(resumo?.dias.some((d) => d.escalaStatus === "DRAFT"));

  return <Casca titulo="Gerar o mês" onClose={onClose} bloqueado={rodando}>
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "#5b5473" }}>Cria, em rascunho, a Escala e os Livros do Dia de todos os dias do mês, em ordem. <b>Nada é publicado e ninguém é avisado</b> — a Administração continua publicando dia a dia.</p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label style={{ display: "grid", gap: 5, fontSize: 12, fontWeight: 700 }}>Local
          <select value={localId} disabled={rodando} onChange={(e) => setLocalId(e.target.value)} style={{ minHeight: 44, border: "1px solid #e6e1f2", borderRadius: 10, padding: 9, fontSize: 13 }}>
            {locais.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </label>
        <label style={{ display: "grid", gap: 5, fontSize: 12, fontWeight: 700 }}>Mês
          <select value={mesIdx} disabled={rodando} onChange={(e) => setMesIdx(Number(e.target.value))} style={{ minHeight: 44, border: "1px solid #e6e1f2", borderRadius: 10, padding: 9, fontSize: 13 }}>
            {meses.map((m, i) => <option key={m.rotulo} value={i}>{m.rotulo}</option>)}
          </select>
        </label>
      </div>

      {carregando && <div aria-busy="true" style={{ padding: 14, borderRadius: 12, background: "#f6f3fd", fontSize: 13, color: "#6b6482" }}>Vendo o mês…</div>}
      {!carregando && erro && !resultado && <div role="alert" style={{ padding: 14, borderRadius: 12, background: "#fdecea", color: "#a12c2c", fontSize: 13, lineHeight: 1.5 }}>{erro}</div>}

      {!carregando && resumo && !resultado && !rodando && <>
        <div role="status" style={{ padding: 14, borderRadius: 12, background: "#f6f3fd", fontSize: 13, lineHeight: 1.55, color: "#3d3559" }}>
          <b>{local?.name}, {mes.rotulo.split(" de ")[0]}:</b> {plural(entram, "dia com atividade", "dias com atividade")} · {resumo.totais.completos} já {resumo.totais.completos === 1 ? "gerado" : "gerados"} · {resumo.totais.publicados} {resumo.totais.publicados === 1 ? "publicado" : "publicados"}.
          <div style={{ marginTop: 4, fontWeight: 700, color: total ? "#5B23C9" : "#6b6482" }}>{total ? `Vai gerar ${plural(total, "dia", "dias")}.` : "Nada a gerar: o mês já está montado."}</div>
        </div>
        {naoEntram.length > 0 && <div>
          <button type="button" onClick={() => setMostrarPulados((v) => !v)} aria-expanded={mostrarPulados} style={{ border: 0, background: "none", padding: 0, fontSize: 12.5, fontWeight: 700, color: "#6C2BF2", cursor: "pointer", minHeight: 32 }}>{mostrarPulados ? "▾" : "▸"} {plural(naoEntram.length, "dia não entra", "dias não entram")}</button>
          {mostrarPulados && <ul style={{ margin: "6px 0 0", padding: 0, listStyle: "none", display: "grid", gap: 3, fontSize: 12, color: "#5b5473", maxHeight: 160, overflow: "auto" }}>
            {naoEntram.map((d) => <li key={d.date}><b>{dm(d.date)}</b> · {d.motivo ?? ROTULO_PULADO[d.estado]}</li>)}
          </ul>}
        </div>}
      </>}

      {rodando && <div role="status" aria-live="polite" style={{ display: "grid", gap: 8 }}>
        <div style={{ height: 10, borderRadius: 999, background: "#ece7f8", overflow: "hidden" }}><div style={{ width: `${pct}%`, height: "100%", background: "linear-gradient(90deg,#6C2BF2,#2E3BD6)", transition: "width .3s" }}/></div>
        <div style={{ fontSize: 13, color: "#3d3559" }}><b>Dia {Math.min(feitos + 1, total)} de {total}</b> · {plural(livrosFeitos, "Livro gerado", "Livros gerados")}. Pode demorar um pouco: cada dia monta a Escala e os Livros dos shows.</div>
      </div>}

      {resultado && <div role="status" style={{ display: "grid", gap: 8, padding: 14, borderRadius: 12, background: resultado.falhas.length ? "#fff7ea" : "#e6f5f3", fontSize: 13, lineHeight: 1.55, color: "#3d3559" }}>
        <div><b>{plural(resultado.gerados.length, "dia gerado", "dias gerados")}</b> em rascunho{resultado.gerados.length ? ` (${plural(resultado.gerados.reduce((s, g) => s + g.livros, 0), "Livro", "Livros")})` : ""}{resultado.falhas.length ? ` · ${plural(resultado.falhas.length, "falhou", "falharam")}` : ""}.</div>
        {resultado.falhas.length > 0 && <ul style={{ margin: 0, paddingLeft: 18 }}>{resultado.falhas.map((f) => <li key={f.date}><b>{dm(f.date)}</b> — {f.motivo}</li>)}</ul>}
        {resultado.restantes > 0 && <div>Parei antes do fim: {plural(resultado.restantes, "dia ficou", "dias ficaram")} para depois. É só gerar de novo — ele continua de onde parou.</div>}
        {erro && <div role="alert" style={{ color: "#a12c2c" }}>{erro}</div>}
      </div>}

      <footer style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span>{!rodando && temRascunho && <button type="button" onClick={() => setModo("descartar")} style={{ border: 0, background: "none", padding: 0, fontSize: 12.5, fontWeight: 700, color: "#a12c2c", cursor: "pointer", minHeight: 44 }}>Descartar rascunhos do mês…</button>}</span>
        <span style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {rodando
            ? <button type="button" onClick={() => { parar.current = true; }} style={botao(false)}>Parar depois deste dia</button>
            : <>
                <button type="button" onClick={onClose} style={botao(false)}>{resultado ? "Fechar" : "Cancelar"}</button>
                {!resultado && <button type="button" onClick={() => void gerar()} disabled={!resumo || total === 0 || carregando} style={{ ...botao(true), opacity: !resumo || total === 0 || carregando ? 0.5 : 1 }}>{total ? `Gerar ${plural(total, "dia", "dias")}` : "Gerar"}</button>}
                {resultado && resultado.restantes > 0 && <button type="button" onClick={() => void gerar()} style={botao(true)}>Continuar</button>}
              </>}
        </span>
      </footer>
  </Casca>;
}

/** A casca do diálogo (fundo, cartão, título e ×), igual para gerar e descartar. */
function Casca({ titulo, onClose, bloqueado, children }: { titulo: string; onClose: () => void; bloqueado: boolean; children: ReactNode }) {
  return <div role="dialog" aria-modal="true" aria-label={titulo} style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(28,20,64,.42)", display: "grid", placeItems: "center", padding: 12 }}>
    <div style={{ width: "min(100%,560px)", maxHeight: "calc(100vh - 24px)", overflow: "auto", background: "#fff", borderRadius: 18, padding: 20, boxShadow: "0 20px 44px -20px rgba(28,20,64,.5)", display: "grid", gap: 14, fontFamily: "Manrope,sans-serif" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0, fontFamily: "Outfit,sans-serif", fontSize: 22, fontWeight: 600 }}>{titulo}</h2>
        <button type="button" onClick={onClose} disabled={bloqueado} aria-label="Fechar" style={{ width: 44, height: 44, border: 0, background: "transparent", fontSize: 24, color: "#6b6482", cursor: bloqueado ? "default" : "pointer" }}>×</button>
      </header>
      {children}
    </div>
  </div>;
}

type DiaDescartavel = { date: string; escalaId: string; livros: number; ajustes: { naEscala: number; atividadesManuais: number; vagasTrocadas: number; posicoesTiradas: number; total: number } };
type Descarte = { descartados: { date: string; livros: number }[]; pulados: { date: string; motivo: string }[]; eventoId: string | null };

/**
 * Descartar os rascunhos do mês: lógico e restaurável. Mostra antes o que seria perdido, pede o
 * motivo, deixa de fora o dia que a gerência mexeu à mão (a menos que ela confirme) e nunca toca em
 * dia publicado. Depois de descartar, "Desfazer" devolve tudo.
 */
function DescartarMes({ localId, localNome, ano, mes, rotuloMes, review, onVoltar, onClose, onMudou }: {
  localId: string; localNome: string; ano: number; mes: number; rotuloMes: string; review: boolean; onVoltar: () => void; onClose: () => void; onMudou: () => void;
}) {
  const [dias, setDias] = useState<DiaDescartavel[] | null>(null);
  const [erro, setErro] = useState("");
  const [motivo, setMotivo] = useState("");
  const [incluir, setIncluir] = useState(false);
  const [trabalhando, setTrabalhando] = useState(false);
  const [feito, setFeito] = useState<Descarte | null>(null);
  const [desfeito, setDesfeito] = useState<string>("");
  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const r = review
          ? { dias: [1, 2, 3, 4, 5].map((n) => ({ date: `${ano}-${String(mes).padStart(2, "0")}-${String(n + 14).padStart(2, "0")}`, escalaId: `x${n}`, livros: 5, ajustes: { naEscala: n === 2 ? 2 : 0, atividadesManuais: 0, vagasTrocadas: n === 2 ? 1 : 0, posicoesTiradas: 0, total: n === 2 ? 3 : 0 } })) }
          : await customFetch<{ dias: DiaDescartavel[] }>(`/api/escalas/mes/descartaveis?locationId=${localId}&year=${ano}&month=${mes}`);
        if (!cancelado) setDias(r.dias);
      } catch (e) { if (!cancelado) setErro(mensagem(e, "Não consegui ver o que seria descartado.")); }
    })();
    return () => { cancelado = true; };
  }, [localId, ano, mes, review]);

  const comAjuste = dias?.filter((d) => d.ajustes.total > 0) ?? [];
  const entram = dias ? (incluir ? dias.length : dias.length - comAjuste.length) : 0;
  const descrever = (a: DiaDescartavel["ajustes"]) => [a.naEscala && plural(a.naEscala, "ajuste na Escala", "ajustes na Escala"), a.atividadesManuais && plural(a.atividadesManuais, "atividade só de um dia", "atividades só de um dia"), a.vagasTrocadas && plural(a.vagasTrocadas, "vaga trocada", "vagas trocadas"), a.posicoesTiradas && plural(a.posicoesTiradas, "posição tirada", "posições tiradas")].filter(Boolean).join(", ");
  const descartar = async () => {
    setTrabalhando(true); setErro("");
    try {
      const r = review ? { descartados: (dias ?? []).filter((d) => incluir || d.ajustes.total === 0).map((d) => ({ date: d.date, livros: d.livros })), pulados: incluir ? [] : comAjuste.map((d) => ({ date: d.date, motivo: `Tem ${d.ajustes.total} ajuste(s) feito(s) à mão.` })), eventoId: "amostra" }
        : await customFetch<Descarte>("/api/escalas/mes/descartar", { method: "POST", body: JSON.stringify({ locationId: localId, year: ano, month: mes, motivo, incluirComAjustes: incluir }) });
      setFeito(r); onMudou();
    } catch (e) { setErro(mensagem(e, "Não consegui descartar. Nada foi alterado; tente de novo.")); }
    finally { setTrabalhando(false); }
  };
  const desfazer = async () => {
    if (!feito?.eventoId) return;
    setTrabalhando(true); setErro("");
    try {
      const r = review ? { restauradas: feito.descartados.length, livros: feito.descartados.reduce((s, d) => s + d.livros, 0), conflitos: [] as { date: string; motivo: string }[] }
        : await customFetch<{ restauradas: number; livros: number; conflitos: { date: string; motivo: string }[] }>("/api/escalas/mes/restaurar", { method: "POST", body: JSON.stringify({ eventoId: feito.eventoId }) });
      setDesfeito(`${plural(r.restauradas, "dia voltou", "dias voltaram")} a rascunho (${plural(r.livros, "Livro", "Livros")}).${r.conflitos.length ? ` ${plural(r.conflitos.length, "dia não voltou", "dias não voltaram")}: ${r.conflitos.map((c) => `${dm(c.date)} — ${c.motivo}`).join("; ")}` : ""}`);
      onMudou();
    } catch (e) { setErro(mensagem(e, "Não consegui desfazer agora. Tente de novo.")); }
    finally { setTrabalhando(false); }
  };
  const botao = (primario: boolean, perigo = false) => ({ borderRadius: 999, padding: "10px 18px", fontSize: 13, fontWeight: 700 as const, cursor: "pointer", fontFamily: "Manrope,sans-serif", minHeight: 44, border: primario ? "none" : "1px solid #e6e1f2", background: primario ? (perigo ? "#a12c2c" : "linear-gradient(135deg,#6C2BF2,#2E3BD6)") : "#fff", color: primario ? "#fff" : "#3d3559" });

  return <>
    <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "#5b5473" }}>Tira do caminho as Escalas e os Livros do Dia <b>em rascunho</b> de <b>{localNome}, {rotuloMes.split(" de ")[0]}</b>. Nada é apagado e dá para desfazer. <b>Dia publicado nunca é tocado.</b></p>
    {erro && <div role="alert" style={{ padding: 12, borderRadius: 12, background: "#fdecea", color: "#a12c2c", fontSize: 13 }}>{erro}</div>}
    {!dias && !erro && <div aria-busy="true" style={{ padding: 14, borderRadius: 12, background: "#f6f3fd", fontSize: 13, color: "#6b6482" }}>Vendo o que seria descartado…</div>}

    {dias && !feito && (dias.length === 0
      ? <div style={{ padding: 14, borderRadius: 12, background: "#f6f3fd", fontSize: 13, color: "#6b6482" }}>Não há rascunhos neste mês para descartar.</div>
      : <>
          <div role="status" style={{ padding: 14, borderRadius: 12, background: "#f6f3fd", fontSize: 13, lineHeight: 1.55, color: "#3d3559" }}>
            <b>{plural(dias.length, "dia em rascunho", "dias em rascunho")}</b>, {plural(dias.reduce((s, d) => s + d.livros, 0), "Livro", "Livros")}. {comAjuste.length ? <>Em <b>{plural(comAjuste.length, "dia", "dias")}</b> a gerência mexeu à mão.</> : "Nenhum tem ajuste feito à mão."}
          </div>
          {comAjuste.length > 0 && <div style={{ padding: 12, borderRadius: 12, background: "#fff7ea", fontSize: 12.5, lineHeight: 1.5, color: "#5b4a1f", display: "grid", gap: 6 }}>
            <b>O que se perderia se esses dias entrarem:</b>
            <ul style={{ margin: 0, paddingLeft: 18 }}>{comAjuste.map((d) => <li key={d.date}><b>{dm(d.date)}</b> — {descrever(d.ajustes)}</li>)}</ul>
            <label style={{ display: "flex", gap: 8, alignItems: "center", minHeight: 44, fontWeight: 700 }}><input type="checkbox" checked={incluir} onChange={(e) => setIncluir(e.target.checked)} style={{ width: 20, height: 20 }}/> Incluir também esses dias</label>
          </div>}
          <label style={{ display: "grid", gap: 5, fontSize: 12, fontWeight: 700 }}>Motivo (obrigatório)
            <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} placeholder="Por que está descartando o mês?" style={{ border: "1px solid #e6e1f2", borderRadius: 10, padding: 9, fontSize: 13, fontFamily: "Manrope,sans-serif", resize: "vertical" }}/>
          </label>
        </>)}

    {feito && <div role="status" style={{ padding: 14, borderRadius: 12, background: desfeito ? "#e6f5f3" : "#fff7ea", fontSize: 13, lineHeight: 1.55, color: "#3d3559", display: "grid", gap: 6 }}>
      {desfeito ? <div><b>Desfeito.</b> {desfeito}</div> : <>
        <div><b>{plural(feito.descartados.length, "dia descartado", "dias descartados")}</b> ({plural(feito.descartados.reduce((s, d) => s + d.livros, 0), "Livro", "Livros")}).</div>
        {feito.pulados.length > 0 && <div>{plural(feito.pulados.length, "dia ficou", "dias ficaram")} de fora: {feito.pulados.map((p) => `${dm(p.date)} — ${p.motivo}`).join("; ")}</div>}
      </>}
    </div>}

    <footer style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <button type="button" onClick={onVoltar} disabled={trabalhando} style={botao(false)}>← Voltar</button>
      <span style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
        {feito && !desfeito && feito.eventoId && <button type="button" onClick={() => void desfazer()} disabled={trabalhando} style={botao(true)}>{trabalhando ? "Desfazendo…" : "Desfazer"}</button>}
        {!feito && dias && dias.length > 0 && <button type="button" onClick={() => void descartar()} disabled={trabalhando || motivo.trim().length < 3 || entram === 0} style={{ ...botao(true, true), opacity: trabalhando || motivo.trim().length < 3 || entram === 0 ? 0.5 : 1 }}>{trabalhando ? "Descartando…" : entram ? `Descartar ${plural(entram, "dia", "dias")}` : "Descartar"}</button>}
        {(feito || (dias && dias.length === 0)) && <button type="button" onClick={onClose} style={botao(!feito)}>Fechar</button>}
      </span>
    </footer>
  </>;
}
