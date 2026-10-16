import { useEffect, useState } from "react";
import { customFetch } from "@workspace/api-client-react";
import { mensagemDoErro } from "@/lib/mensagem-do-erro";
import "./folga-analise.css";

type Pessoa = { id: string; name: string };
type Dia = {
  date: string;
  deFolga: Pessoa[];
  trabalham: Pessoa[];
  vagas: { personagem: string; pessoa: string; podeCobrir: Pessoa[]; deFolgaNaLista: Pessoa[] }[];
  resultado: { da: boolean; frase: string };
  aviso: string | null;
  semEscala: boolean;
};
type Troca = { colegas: { id: string; name: string; dias: string[] }[] };

const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const rotuloDoDia = (iso: string) => {
  const [, m, d] = iso.split("-").map(Number);
  return `${DIAS[new Date(`${iso}T12:00:00Z`).getUTCDay()]} ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
};
const nomes = (lista: Pessoa[]) => lista.map((p) => p.name).join(", ");

/**
 * O panorama de cada dia pedido, para quem decide: quem já está de folga, quem trabalha, a vaga da
 * pessoa com quem pode cobrir, e o resultado. Só leitura; o servidor calcula na hora, então nunca
 * fica velho. Se a análise falhar, a decisão continua possível: o pedido não depende dela.
 *
 * Quando ninguém que trabalha pode cobrir e algum colega da lista da vaga está de folga nesse dia, a
 * Supervisão pode propor a TROCA a ele: ele trabalha o dia pedido e fica com um dia de folga de quem pediu.
 */
export function AnaliseDoPedido({ pedidoId, pessoa, onTrocaProposta }: { pedidoId: string; pessoa: string; onTrocaProposta?: () => void }) {
  const [dados, setDados] = useState<{ dias: Dia[]; cortado: boolean; troca: Troca | null } | null>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let vivo = true;
    setDados(null); setErro("");
    customFetch<{ dias: Dia[]; cortado: boolean; troca: Troca | null }>(`/api/leave-requests/${pedidoId}/analise`)
      .then((r) => { if (vivo) setDados(r); })
      .catch((e) => { if (vivo) setErro(mensagemDoErro(e, "Não consegui montar o panorama do dia agora. Você ainda pode decidir; o pedido continua na fila.")); });
    return () => { vivo = false; };
  }, [pedidoId]);

  if (erro) return <p className="analise-erro" role="alert">{erro}</p>;
  if (!dados) return <p className="analise-espera" role="status">Olhando o dia…</p>;
  if (!dados.dias.length) return <p className="analise-espera">Não há dias para analisar neste pedido.</p>;

  const naoDa = dados.dias.length === 1 && !dados.dias[0]!.resultado.da;
  return (
    <div className="analise" aria-label="Panorama do dia pedido">
      {dados.dias.map((dia) => (
        <section key={dia.date} className="analise-dia">
          <h3>{rotuloDoDia(dia.date)}</h3>

          <p className="analise-rotulo">Quem já está de folga</p>
          <p>{dia.deFolga.length ? <>{nomes(dia.deFolga)} <small>({dia.deFolga.length} {dia.deFolga.length === 1 ? "pessoa" : "pessoas"}; com {pessoa} seriam {dia.deFolga.length + 1})</small></> : "Ninguém está de folga nesse dia."}</p>

          <p className="analise-rotulo">Quem trabalha</p>
          <p>{dia.trabalham.length ? <>{nomes(dia.trabalham)} <small>({dia.trabalham.length} {dia.trabalham.length === 1 ? "pessoa" : "pessoas"})</small></> : dia.semEscala ? "Este dia ainda não tem Escala, então ninguém aparece escalado." : "Ninguém aparece escalado nesse dia."}</p>

          <p className="analise-rotulo">A vaga de {pessoa}</p>
          {dia.vagas.length ? dia.vagas.map((vaga) => (
            <p key={vaga.personagem}><b>{vaga.personagem}</b> · {vaga.pessoa} — {vaga.podeCobrir.length ? <>se {pessoa} folgar, pode cobrir: <b>{nomes(vaga.podeCobrir)}</b></> : "ninguém da lista de substituições pode cobrir."}</p>
          )) : <p>{pessoa} não tem vaga em show nesse dia.</p>}

          <p className={dia.resultado.da ? "analise-resultado ok" : "analise-resultado nao"} role="status"><b>{dia.resultado.frase}</b></p>
          {dia.aviso && <p className="analise-aviso" role="note">{dia.aviso}</p>}
        </section>
      ))}
      {dados.cortado && <p className="analise-aviso" role="note">Mostrando os 14 primeiros dias do pedido.</p>}
      {naoDa && dados.troca && <ProporTroca pedidoId={pedidoId} pessoa={pessoa} dia={dados.dias[0]!.date} troca={dados.troca} onProposta={onTrocaProposta} />}
    </div>
  );
}

function ProporTroca({ pedidoId, pessoa, dia, troca, onProposta }: { pedidoId: string; pessoa: string; dia: string; troca: Troca; onProposta?: () => void }) {
  const [colegaId, setColegaId] = useState(troca.colegas[0]!.id);
  const colega = troca.colegas.find((c) => c.id === colegaId) ?? troca.colegas[0]!;
  const [devolvido, setDevolvido] = useState(colega.dias[0] ?? "");
  const [enviando, setEnviando] = useState(false), [erro, setErro] = useState("");
  useEffect(() => { setDevolvido(colega.dias[0] ?? ""); }, [colega.id]);
  const propor = async () => {
    setEnviando(true); setErro("");
    try {
      await customFetch(`/api/leave-requests/${pedidoId}/troca`, { method: "POST", body: JSON.stringify({ peerId: colega.id, diaDevolvido: devolvido }) });
      onProposta?.();
    } catch (e) { setErro(mensagemDoErro(e, "Não consegui propor a troca agora. Nada foi enviado ao colega; tente de novo.")); }
    finally { setEnviando(false); }
  };
  return (
    <section className="analise-troca" aria-label="Pedir troca a quem está de folga">
      <h3>Pedir troca a quem está de folga</h3>
      <p>Ninguém que trabalha em {rotuloDoDia(dia)} pode cobrir. {colega.name} já está de folga nesse dia: se aceitar, trabalha nele e fica com um dia de folga de {pessoa}. A conta de folgas dos dois no mês não muda.</p>
      <label>Colega<select value={colega.id} onChange={(e) => setColegaId(e.target.value)}>{troca.colegas.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label>Folga de {pessoa} que ele recebe<select value={devolvido} onChange={(e) => setDevolvido(e.target.value)}>{colega.dias.map((d) => <option key={d} value={d}>{rotuloDoDia(d)}</option>)}</select></label>
      {erro && <p className="analise-erro" role="alert">{erro}</p>}
      <button type="button" className="analise-propor" onClick={() => void propor()} disabled={enviando || !devolvido}>{enviando ? "Enviando…" : "Propor a troca"}</button>
    </section>
  );
}
