import { useEffect, useState } from "react";
import { customFetch } from "@workspace/api-client-react";
import { mensagemDoErro } from "@/lib/mensagem-do-erro";
import "./folga-analise.css";

type Pessoa = { id: string; name: string };
type Dia = {
  date: string;
  deFolga: Pessoa[];
  trabalham: Pessoa[];
  vagas: { personagem: string; pessoa: string; podeCobrir: Pessoa[] }[];
  resultado: { da: boolean; frase: string };
  aviso: string | null;
  semEscala: boolean;
};

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
 */
export function AnaliseDoPedido({ pedidoId, pessoa }: { pedidoId: string; pessoa: string }) {
  const [dados, setDados] = useState<{ dias: Dia[]; cortado: boolean } | null>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let vivo = true;
    setDados(null); setErro("");
    customFetch<{ dias: Dia[]; cortado: boolean }>(`/api/leave-requests/${pedidoId}/analise`)
      .then((r) => { if (vivo) setDados(r); })
      .catch((e) => { if (vivo) setErro(mensagemDoErro(e, "Não consegui montar o panorama do dia agora. Você ainda pode decidir; o pedido continua na fila.")); });
    return () => { vivo = false; };
  }, [pedidoId]);

  if (erro) return <p className="analise-erro" role="alert">{erro}</p>;
  if (!dados) return <p className="analise-espera" role="status">Olhando o dia…</p>;
  if (!dados.dias.length) return <p className="analise-espera">Não há dias para analisar neste pedido.</p>;

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
    </div>
  );
}
