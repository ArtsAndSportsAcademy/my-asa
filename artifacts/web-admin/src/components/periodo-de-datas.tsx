import { useState } from "react";

const hojeISO = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

/**
 * Dois dias que andam juntos: o último não pode vir antes do primeiro, e mudar o primeiro puxa o
 * último junto. Sem isso a pessoa monta "de 20 a 18", e o servidor só reclama depois de enviar.
 * Só dá para escolher de hoje em diante (pedido é sempre para frente).
 */
export function PeriodoDeDatas({ rotuloDe, rotuloAte, de, ate, nomeDe = "data", nomeAte = "ate", className = "sol-duas" }: {
  rotuloDe: string; rotuloAte: string; de: string; ate: string; nomeDe?: string; nomeAte?: string; className?: string;
}) {
  const hoje = hojeISO();
  const [inicio, setInicio] = useState(de < hoje ? hoje : de), [fim, setFim] = useState(ate < hoje ? hoje : ate);
  return <div className={className}>
    <label>{rotuloDe}<input name={nomeDe} type="date" min={hoje} value={inicio} required onChange={(e) => { const v = e.target.value; setInicio(v); if (v && fim && fim < v) setFim(v); }}/></label>
    <label>{rotuloAte}<input name={nomeAte} type="date" min={inicio || hoje} value={fim} required onChange={(e) => setFim(e.target.value)}/></label>
  </div>;
}
