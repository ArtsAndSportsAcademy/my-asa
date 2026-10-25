import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { customFetch } from "@workspace/api-client-react";
import { css } from "@/lib/dc-style";
import { mensagemDoErro } from "@/lib/mensagem-do-erro";
import type { Dia } from "@/pages/escalas";
import "./escala-tokens.css";

/** Um show do dia como a Escala o mostra: o estado da conferência do Livro, sem abrir nada. */
export type CartaoDoLivro = {
  id: string; showTitle: string | null; showType: string | null; sessionLabel: string | null; horarios: string[]; status: string;
  responsavel: { id: string; name: string | null } | null; vagas: number; vagasSemPessoa: number;
  conferido: boolean; conferidoPor: string | null; conferidoEm: string | null; conferenciaCaiu: { por: string | null; em: string | null } | null;
  podeConferir: boolean;
};

const plural = (n: number, um: string, muitos: string) => `${n} ${n === 1 ? um : muitos}`;
const quando = (iso: string | null) => { if (!iso) return ""; const d = new Date(iso); return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} às ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };

/**
 * Cartões "Livros do dia": um por show do local naquele dia, com a conferência do elenco. Tocar abre o Livro que já existe (um lugar
 * só para conferir); "Conferir os que faltam" leva de um Livro ao próximo e volta para cá sozinho. A Supervisão só vê os shows que ela
 * opera (a API decide); o Elenco não vê nada disto.
 */
export function LivrosDoDia({ dia, review }: { dia: Dia; review: boolean }) {
  const [cartoes, setCartoes] = useState<CartaoDoLivro[] | null>(null);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState("");
  const [aberto, setAberto] = useState<boolean | null>(null);
  const localId = dia.location.id, data = dia.date;

  const carregar = useCallback(async () => {
    setErro("");
    try {
      if (review) {
        // Prévia local (só no desenvolvimento): os shows da amostra viram cartões, sem servidor.
        setCartoes((atual) => dia.blocos.filter((b) => b.regra === "livro" && b.dailyBookId).map((b) => {
          const antes = atual?.find((c) => c.id === b.dailyBookId);
          return antes ?? { id: b.dailyBookId!, showTitle: b.rotulo, showType: b.showTipo ?? null, sessionLabel: null, horarios: [b.inicio], status: b.dailyBookStatus ?? "DRAFT", responsavel: null, vagas: b.vagas?.length ?? 0, vagasSemPessoa: b.vagas?.filter((v) => !v.userId).length ?? 0, conferido: false, conferidoPor: null, conferidoEm: null, conferenciaCaiu: null, podeConferir: true };
        }));
        return;
      }
      const r = await customFetch<{ cartoes: CartaoDoLivro[] }>(`/api/daily-book/cartoes?locationId=${localId}&date=${data}`);
      setCartoes(r.cartoes);
    } catch (e) { setErro(mensagemDoErro(e, "Não consegui carregar os Livros do dia.")); setCartoes((atual) => atual ?? []); }
  }, [review, localId, data, dia.blocos]);

  // Recarrega quando o dia muda, ou quando a Escala foi mexida (versão nova): o elenco do Livro pode ter mudado.
  useEffect(() => { setCartoes(null); }, [localId, data]);
  useEffect(() => { void carregar(); }, [localId, data, dia.escala?.version, dia.blocos.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const marcar = async (c: CartaoDoLivro, conferido: boolean) => {
    setOcupado(c.id); setErro("");
    try {
      if (review) {
        setCartoes((atual) => (atual ?? []).map((x) => x.id === c.id ? { ...x, conferido, conferidoPor: conferido ? "você" : null, conferidoEm: conferido ? new Date().toISOString() : null, conferenciaCaiu: null } : x));
        return;
      }
      await customFetch(`/api/daily-book/${c.id}/conferir`, { method: conferido ? "POST" : "DELETE" });
      await carregar();
    } catch (e) { setErro(mensagemDoErro(e, conferido ? "Não consegui marcar o Livro como conferido." : "Não consegui tirar a marca de conferido.")); }
    finally { setOcupado(""); }
  };

  const faltam = useMemo(() => (cartoes ?? []).filter((c) => c.podeConferir && !c.conferido), [cartoes]);
  if (cartoes === null) return <p className="ge-livros-aviso" role="status">Carregando os Livros do dia…</p>;
  if (!cartoes.length) return erro ? <p className="ge-livros-aviso" role="alert" style={css("color:var(--esc-choque)")}>{erro}</p> : null;

  const conferidos = cartoes.filter((c) => c.conferido).length;
  const guiado = faltam.length ? `/livro-do-dia?data=${data}&livro=${faltam[0]!.id}&conferir=${faltam.map((c) => c.id).join(",")}&local=${localId}` : null;
  const estaAberto = aberto ?? faltam.length > 0;

  return <details className="ge-livros" open={estaAberto} onToggle={(e) => setAberto((e.currentTarget as HTMLDetailsElement).open)}>
    <summary className="ge-livros-topo">
      <h2>Livros do dia</h2>
      <span className="ge-livros-conta" data-tudo={conferidos === cartoes.length}>{`${conferidos} de ${cartoes.length} conferidos`}</span>
      <span className="ge-livros-ver">{estaAberto ? "esconder" : "ver os cartões"}</span>
    </summary>
    {erro && <p className="ge-livros-aviso" role="alert" style={css("color:var(--esc-choque);margin:0")}>{erro}</p>}
    <p className="ge-livros-ajuda">Confira quem faz cada papel de cada show. Se outra pessoa mudar o elenco de um Livro depois, a marca de conferido sai sozinha e o cartão volta a pedir conferência.</p>
    {guiado && <Link href={guiado} className="ge-livros-guiar">{`Conferir os que faltam (${faltam.length})`}</Link>}
    <ul className="ge-livros-lista">
      {cartoes.map((c) => {
        const hora = [c.horarios.join(" · "), c.sessionLabel && !c.horarios.includes(c.sessionLabel) ? c.sessionLabel : ""].filter(Boolean).join(" · ");
        const estado = c.conferido ? "ok" : c.conferenciaCaiu ? "caiu" : "falta";
        return <li key={c.id} className="ge-livro" data-estado={estado}>
          <Link href={`/livro-do-dia?data=${data}&livro=${c.id}`} className="ge-livro-nome" aria-label={`Abrir o Livro do Dia de ${c.showTitle ?? "show"}`}>
            <strong>{c.showTitle ?? "Show"}</strong>
            {hora && <span className="ge-livro-hora">{hora}</span>}
          </Link>
          <span className="ge-livro-estado">
            {c.conferido ? `Conferido${c.conferidoPor ? ` por ${c.conferidoPor}` : ""}${c.conferidoEm ? ` · ${quando(c.conferidoEm)}` : ""}`
              : c.conferenciaCaiu ? `${c.conferenciaCaiu.por ? `Conferido por ${c.conferenciaCaiu.por}, mas` : "Estava conferido, mas"} o elenco mudou depois: confira de novo`
                : "Falta conferir"}
          </span>
          <span className="ge-livro-meta">
            {c.vagasSemPessoa > 0 && <b style={css("color:var(--esc-choque)")}>{plural(c.vagasSemPessoa, "vaga sem ninguém", "vagas sem ninguém")}</b>}
            <span>{c.responsavel ? `Responsável: ${c.responsavel.name ?? "—"}` : "Sem responsável definido: a Supervisão do local ou a Administração confere"}</span>
            {c.status === "DRAFT" && <span>Rascunho</span>}
          </span>
          <span className="ge-livro-acoes">
            {c.podeConferir && !c.conferido && <button type="button" className="ge-livro-botao" data-primario="true" disabled={ocupado === c.id} onClick={() => void marcar(c, true)}>{ocupado === c.id ? "Marcando…" : "Conferido"}</button>}
            {c.podeConferir && c.conferido && <button type="button" className="ge-livro-botao" disabled={ocupado === c.id} onClick={() => void marcar(c, false)}>{ocupado === c.id ? "Tirando…" : "Tirar a marca"}</button>}
            <Link href={`/livro-do-dia?data=${data}&livro=${c.id}`} className="ge-livro-botao">Abrir o Livro</Link>
          </span>
        </li>;
      })}
    </ul>
  </details>;
}
