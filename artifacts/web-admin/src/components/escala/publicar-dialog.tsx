import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { customFetch } from "@workspace/api-client-react";
import { css } from "@/lib/dc-style";
import { useFecharComEsc } from "@/lib/fechar-com-esc";
import type { Dia } from "@/pages/escalas";
import type { CartaoDoLivro } from "./livros-do-dia";
import "./escala-tokens.css";

const plural = (n: number, um: string, muitos: string) => `${n} ${n === 1 ? um : muitos}`;
const lista = (nomes: string[]) => nomes.length <= 1 ? nomes.join("") : `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;

/**
 * Confirmação antes de publicar (ou republicar) a escala do dia: diz o que vai acontecer (quantas pessoas são avisadas, quais Livros saem junto)
 * e mostra o que ainda pede atenção. Livro sem conferir, vaga sem ninguém, choque de horário e chamado na folga só AVISAM: falta de gente acontece de verdade e o Livro segue; quem
 * decide é a Administração. A janela não bloqueia nada que a regra de publicar já não bloqueasse (todas as áreas enviadas).
 */
export function PublicarDialog({ dia, dataLonga, republicar, review, ocupado, onClose, onConfirmar }: {
  dia: Dia; dataLonga: string; republicar: boolean; review: boolean; ocupado: boolean; onClose: () => void; onConfirmar: () => void;
}) {
  useFecharComEsc(onClose);
  const [cartoes, setCartoes] = useState<CartaoDoLivro[] | null>(review ? [] : null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (review) return;
    let cancelado = false;
    customFetch<{ cartoes: CartaoDoLivro[] }>(`/api/daily-book/cartoes?locationId=${dia.location.id}&date=${dia.date}`)
      .then((r) => { if (!cancelado) setCartoes(r.cartoes); })
      .catch(() => { if (!cancelado) { setCartoes([]); setErro("Não consegui conferir os Livros do dia agora. Você pode publicar mesmo assim, mas confira antes se puder."); } });
    return () => { cancelado = true; };
  }, [review, dia.location.id, dia.date]);

  // Quem é convocado: toda pessoa que está em algum bloco do dia (quem está de folga já não entra nos blocos).
  const convocados = useMemo(() => new Set(dia.blocos.flatMap((b) => b.pessoaIds)).size, [dia.blocos]);
  const livrosDoBloco = useMemo(() => {
    const vistos = new Map<string, string>();
    for (const b of dia.blocos) if (b.regra === "livro" && b.dailyBookId && !vistos.has(b.dailyBookId)) vistos.set(b.dailyBookId, b.rotulo);
    return vistos;
  }, [dia.blocos]);

  // Mesma regra da tela da Escala (conflitos): pessoa em dois blocos que se cruzam. Aqui só informa; quem decide é a Administração.
  const choques = useMemo(() => {
    const out: { pessoa: string; a: string; b: string }[] = [];
    for (const p of dia.pessoas) {
      const seus = dia.blocos.filter((b) => !b.flexivel && b.pessoaIds.includes(p.id)).sort((x, y) => x.inicio.localeCompare(y.inicio));
      for (let i = 0; i < seus.length; i++) for (let j = i + 1; j < seus.length; j++) {
        const a = seus[i]!, b = seus[j]!;
        if (b.inicio < (a.fim ?? a.inicio) || (b.inicio === a.inicio && b.fim && a.fim)) out.push({ pessoa: p.name, a: a.rotulo, b: b.rotulo });
      }
    }
    return out;
  }, [dia.pessoas, dia.blocos]);
  const pessoasComChoque = lista([...new Set(choques.map((c) => c.pessoa))]);
  const chamadasNaFolga = dia.pessoas.filter((p) => p.chamadaNaFolga && dia.blocos.some((b) => b.pessoaIds.includes(p.id)));

  const semConferir = (cartoes ?? []).filter((c) => !c.conferido);
  const comVagaAberta = (cartoes ?? []).filter((c) => c.vagasSemPessoa > 0);
  const nomeDe = (c: CartaoDoLivro) => `${c.showTitle ?? "Show"}${c.horarios[0] ? ` ${c.horarios[0]}` : ""}`;
  // Os Livros que saem junto levam o mesmo nome dos avisos (título do show e hora); sem os cartões, vale o nome do bloco da Escala.
  const livrosDoDia = [...livrosDoBloco].map(([id, rotulo]) => { const c = (cartoes ?? []).find((x) => x.id === id); return c ? nomeDe(c) : rotulo; });
  const semAvisos = cartoes !== null && !semConferir.length && !comVagaAberta.length && !choques.length && !chamadasNaFolga.length;
  const enviadas = dia.areas.filter((a) => a.pronta).map((a) => a.name);

  return <div className="shows-dialog-backdrop"><div className="shows-dialog ge-publicar-dialog" role="dialog" aria-modal="true" aria-label={republicar ? "Republicar a escala" : "Publicar a escala"}>
    <header className="shows-dialog-header"><div><h2>{republicar ? "Republicar a escala" : "Publicar a escala"}</h2><p>{`${dia.location.name} · ${dataLonga}`}</p></div><button type="button" onClick={onClose} aria-label="Fechar"><X size={18}/></button></header>
    <div className="shows-dialog-content ge-publicar">
      <p className="ge-publicar-lead">{republicar
        ? "Republicar avisa só quem mudou desde a última publicação e atualiza os Livros do dia que já estavam publicados."
        : `Publicar convoca ${plural(convocados, "pessoa", "pessoas")}: cada uma recebe um aviso, e os Livros do dia saem juntos.`}</p>
      {!republicar && enviadas.length > 0 && <p className="ge-publicar-linha"><b>Partes enviadas:</b> {lista(enviadas)}.</p>}
      {livrosDoDia.length > 0 && <p className="ge-publicar-linha"><b>{republicar ? "Livros do dia atualizados" : "Livros do dia que saem junto"}:</b> {lista(livrosDoDia)}.</p>}

      <section aria-label="O que ainda pede atenção" className="ge-publicar-avisos" data-ok={semAvisos}>
        <h3>{cartoes === null ? "Conferindo os Livros do dia…" : semAvisos ? "Nada pedindo atenção" : "O que ainda pede atenção (não impede de publicar)"}</h3>
        {semConferir.length > 0 && <p><b>{plural(semConferir.length, "Livro ainda não conferido", "Livros ainda não conferidos")}:</b> {lista(semConferir.map(nomeDe))}.</p>}
        {comVagaAberta.length > 0 && <p><b>{plural(comVagaAberta.reduce((n, c) => n + c.vagasSemPessoa, 0), "vaga sem ninguém", "vagas sem ninguém")}:</b> {lista(comVagaAberta.map((c) => `${nomeDe(c)} (${c.vagasSemPessoa})`))}. Isso acontece quando falta gente; o Livro segue assim e dá para completar depois.</p>}
        {choques.length > 0 && <p><b>{plural(new Set(choques.map((c) => c.pessoa)).size, "pessoa em dois lugares ao mesmo tempo", "pessoas em dois lugares ao mesmo tempo")}:</b> {pessoasComChoque}. Os horários se cruzam; dá para ajustar na Escala antes ou publicar assim.</p>}
        {chamadasNaFolga.length > 0 && <p><b>{plural(chamadasNaFolga.length, "pessoa chamada na própria folga", "pessoas chamadas na própria folga")}:</b> {lista(chamadasNaFolga.map((p) => p.name))}. Ela recebe o aviso de convocação mesmo estando de folga.</p>}
        {semAvisos && <p>Todos os Livros estão conferidos e sem vaga aberta.</p>}
        {erro && <p role="alert" style={css("color:var(--asa-error-fg)")}>{erro}</p>}
      </section>
    </div>
    <footer className="shows-dialog-footer">
      <button type="button" className="shows-secondary" onClick={onClose}>Cancelar</button>
      <button type="button" className="shows-primary" disabled={ocupado || cartoes === null} onClick={onConfirmar}>{ocupado ? (republicar ? "Republicando…" : "Publicando…") : republicar ? "Republicar" : `Publicar e convocar ${plural(convocados, "pessoa", "pessoas")}`}</button>
    </footer>
  </div></div>;
}
