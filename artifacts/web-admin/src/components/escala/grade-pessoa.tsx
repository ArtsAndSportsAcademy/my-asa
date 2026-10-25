import { useMemo } from "react";
import type { CSSProperties } from "react";
import type { Bloco, Pessoa } from "@/pages/escalas";
import { ehExcecao, faixa, fimEmMinutos, horaDe, minutosDe, nomesCurtos, resolverTipo, textoDoBloco, toneDoTipo, type TipoDoLocal } from "./tipos";
import "./escala-tokens.css";

/** Pixels por minuto: 20 minutos ficam com 26 px, o bastante para uma linha de texto de 12 px. */
const PX = 1.3;
const GAP = 3;

type Faixa = { lane: number; n: number };

/** Blocos de uma pessoa que se cruzam dividem a coluna lado a lado. */
function lanesDe(blocos: Bloco[]): Map<string, Faixa> {
  const ordenados = [...blocos].sort((a, b) => minutosDe(a.inicio) - minutosDe(b.inicio) || fimEmMinutos(a) - fimEmMinutos(b));
  const saida = new Map<string, Faixa>();
  let grupo: Bloco[] = [];
  let fimDoGrupo = -1;
  const fechar = () => {
    const finais: number[] = [];
    const lanes = new Map<string, number>();
    for (const b of grupo) {
      let lane = finais.findIndex((f) => f <= minutosDe(b.inicio));
      if (lane < 0) { lane = finais.length; finais.push(0); }
      finais[lane] = fimEmMinutos(b);
      lanes.set(b.key, lane);
    }
    for (const b of grupo) saida.set(b.key, { lane: lanes.get(b.key)!, n: Math.max(1, finais.length) });
    grupo = [];
  };
  for (const b of ordenados) {
    if (grupo.length && minutosDe(b.inicio) >= fimDoGrupo) { fechar(); fimDoGrupo = -1; }
    grupo.push(b);
    fimDoGrupo = Math.max(fimDoGrupo, fimEmMinutos(b));
  }
  if (grupo.length) fechar();
  return saida;
}

/** Duas pessoas que fazem a mesma coisa no mesmo horário viram uma faixa só. */
const chaveDaFaixa = (b: Bloco) => `${b.tipoId ?? ""}|${b.rotulo}|${b.inicio}|${b.fim ?? ""}|${b.regra ?? ""}|${b.showBookId ?? ""}`;

export type GradePessoaProps = {
  colunas: Pessoa[];
  blocosDe: (pessoaId: string) => Bloco[];
  temChoque: (pessoa: Pessoa, bloco: Bloco) => boolean;
  /** Tipos de atividade do local: dão a cor e o nome de cada bloco (sem eles, valem os sete de fábrica). */
  tipos?: TipoDoLocal[];
  /** Nome de quem mexeu por último na pessoa (outra Supervisão), ou null. */
  mexidoPor?: (pessoaId: string) => string | null;
  soExcecoes: boolean;
  busca: Set<string> | null;
  selecionada: string | null;
  onEscolherPessoa: (pessoaId: string) => void;
  onTocarBloco: (bloco: Bloco, pessoa: Pessoa, elemento: HTMLElement) => void;
};

export function GradePessoa({ colunas, blocosDe, temChoque, tipos, mexidoPor, soExcecoes, busca, selecionada, onEscolherPessoa, onTocarBloco }: GradePessoaProps) {
  const dados = useMemo(() => {
    const porColuna = colunas.map((p) => { const blocos = blocosDe(p.id); return { pessoa: p, blocos, lanes: lanesDe(blocos) }; });
    const todos = porColuna.flatMap((c) => c.blocos);
    if (!todos.length) return null;
    const ini = Math.floor(Math.min(...todos.map((b) => minutosDe(b.inicio))) / 30) * 30;
    const fim = Math.ceil(Math.max(...todos.map(fimEmMinutos)) / 30) * 30;
    return { porColuna, ini, fim };
  }, [colunas, blocosDe]);

  const nomeCurto = useMemo(() => nomesCurtos(colunas), [colunas]);

  if (!dados) return <div className="ge-wrap"><p className="ge-vazio">Nenhum bloco neste dia.</p></div>;
  const { porColuna, ini, fim } = dados;
  const altura = (fim - ini) * PX;
  const horas: number[] = [];
  for (let t = Math.ceil(ini / 60) * 60; t <= fim; t += 60) horas.push(t);
  const estiloGrade = { "--ge-n": colunas.length, "--ge-h": `${altura}px`, "--ge-hora": `${60 * PX}px` } as CSSProperties;
  const deslocamentoDasLinhas = ((60 - (ini % 60)) % 60) * PX;

  return <div className="ge-wrap esc-scroll" tabIndex={0} role="group" aria-label="Escala por pessoa: uma coluna por pessoa, horários na vertical">
    <div className="ge-grid" style={estiloGrade}>
      <div className="ge-corner" aria-hidden="true"/>
      {porColuna.map(({ pessoa, blocos }) => {
        const choque = blocos.some((b) => temChoque(pessoa, b));
        return <button key={pessoa.id} type="button" className="ge-head" aria-pressed={selecionada === pessoa.id} title={pessoa.name} onClick={() => onEscolherPessoa(pessoa.id)}>
          <strong>{nomeCurto(pessoa)}</strong>
          <small>{pessoa.areaName ?? "sem área"}</small>
          {choque && <span className="ge-aviso ge-aviso-choque">choque</span>}
          {pessoa.chamadaNaFolga && <span className="ge-aviso ge-aviso-folga">chamado na folga</span>}
          {mexidoPor?.(pessoa.id) && <span className="ge-aviso ge-aviso-mexida">{`ajustado por ${mexidoPor(pessoa.id)!.split(" ")[0]}`}</span>}
        </button>;
      })}
      <div className="ge-axis" aria-hidden="true">{horas.map((t) => <i key={t} style={{ top: (t - ini) * PX }}>{horaDe(t)}</i>)}</div>
      {porColuna.map(({ pessoa, blocos, lanes }, i) => {
        const anterior = porColuna[i - 1];
        const seguintes = porColuna.slice(i + 1);
        const simples = (c: typeof porColuna[number] | undefined, b: Bloco) => Boolean(c && c.blocos.some((x) => chaveDaFaixa(x) === chaveDaFaixa(b) && c.lanes.get(x.key)?.n === 1 && !temChoque(c.pessoa, x)));
        return <div key={pessoa.id} className="ge-col" data-dim={busca ? !busca.has(pessoa.id) : false} style={{ backgroundSize: "100% var(--ge-hora)", backgroundPositionY: deslocamentoDasLinhas }}>
          {blocos.map((b) => {
            const faixaDoBloco = lanes.get(b.key) ?? { lane: 0, n: 1 };
            const tipo = resolverTipo(b, tipos);
            const tom = toneDoTipo(tipo.cor);
            const choque = temChoque(pessoa, b);
            const excecao = ehExcecao(b);
            const apagado = soExcecoes && !choque && !excecao;
            const topo = (minutosDe(b.inicio) - ini) * PX;
            const alto = Math.max(22, (fimEmMinutos(b) - minutosDe(b.inicio)) * PX - 2);
            const largura = 100 / faixaDoBloco.n;
            const posicao = { top: topo, height: alto, left: `${faixaDoBloco.lane * largura}%`, width: `${largura}%`, "--bg": tom.bg, "--fg": tom.fg, "--bd": tom.bd } as CSSProperties;
            const unica = faixaDoBloco.n === 1 && !choque;
            const primeira = unica && !simples(anterior, b);
            let corrida = 1;
            if (primeira) { for (const c of seguintes) { if (simples(c, b)) corrida += 1; else break; } }
            const nome = `${pessoa.name}: ${textoDoBloco(b)}, ${faixa(b)}, ${tipo.nome}${choque ? ", choque de horário" : ""}${excecao ? ", exceção" : ""}`;
            return <span key={b.key}>
              <button type="button" className="ge-bloco" data-choque={choque} data-excecao={excecao} data-apagado={apagado} style={posicao} aria-label={nome} onClick={(e) => onTocarBloco(b, pessoa, e.currentTarget)}/>
              {(primeira || faixaDoBloco.n > 1 || (unica === false && faixaDoBloco.n === 1)) && <span className="ge-rotulo" aria-hidden="true" data-apagado={apagado}
                style={{ top: topo, height: alto, left: `${faixaDoBloco.lane * largura}%`, width: primeira ? `calc(${corrida} * 100% + ${(corrida - 1) * GAP}px)` : `${largura}%`, "--fg": tom.fg } as CSSProperties}>
                <span>{textoDoBloco(b)}</span>
                {alto >= 44 && b.regra !== "livro" && b.fim && <small>{faixa(b)}</small>}
              </span>}
            </span>;
          })}
        </div>;
      })}
    </div>
  </div>;
}
