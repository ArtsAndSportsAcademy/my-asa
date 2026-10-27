import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { customFetch } from "@workspace/api-client-react";
import { useFecharComEsc } from "@/lib/fechar-com-esc";
import { mensagemDoErro } from "@/lib/mensagem-do-erro";
import "./chamadas.css";

/**
 * Chamadas (0086): o horário em que as pessoas de um show ou de uma atividade têm que estar prontas ("Aquecimento 13:00", "Call do show 13:45").
 * O mesmo editor serve a três lugares: a sessão do show, o bloco da Programação e a atividade só de um dia. Quem vai NÃO se escolhe aqui:
 * são as pessoas da atividade (no show, as do Livro do Dia).
 */
export type ModoDeChamada = "fixo" | "antes";
/** Uma chamada como a tela a edita: tudo texto/boolean, para o campo aceitar o que a pessoa digita antes de valer. */
export type ChamadaRascunho = {
  chave: string; id?: string; nome: string; modo: ModoDeChamada; horaFixa: string; minutosAntes: string; duracaoMin: string;
  ocupaTempo: boolean; avisar: boolean; updatedAt?: string;
};
/** A chamada como a API a devolve. */
export type ChamadaDaApi = {
  id: string; nome: string; modo: ModoDeChamada; horaFixa: string | null; minutosAntes: number | null; duracaoMin: number;
  ocupaTempo: boolean; avisar: boolean; ordem: number; active: boolean; updatedAt: string; janela: { inicio: string; fim: string } | null;
};
/** De quem é a chamada: de uma sessão do show, de um bloco da Programação, ou de uma atividade só de um dia. */
export type DonaDeChamada = { sessionId: string } | { programacaoBlocoId: string } | { scaleId: string; blocoKey: string };

export const SUGESTOES_DE_NOME = ["Chamada", "Aquecimento", "Call do show"];
let contador = 0;
const chaveNova = () => `novo-${Date.now()}-${contador++}`;

export const chamadaVazia = (): ChamadaRascunho => ({ chave: chaveNova(), nome: "", modo: "antes", horaFixa: "", minutosAntes: "15", duracaoMin: "15", ocupaTempo: true, avisar: true });
export const doApi = (c: ChamadaDaApi): ChamadaRascunho => ({
  chave: c.id, id: c.id, nome: c.nome, modo: c.modo, horaFixa: c.horaFixa ?? "", minutosAntes: c.minutosAntes ? String(c.minutosAntes) : "", duracaoMin: String(c.duracaoMin),
  ocupaTempo: c.ocupaTempo, avisar: c.avisar, updatedAt: c.updatedAt,
});

const minutos = (hora: string) => { const [h, m] = hora.slice(0, 5).split(":").map(Number); return h! * 60 + (m || 0); };
const horaDe = (total: number) => `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;

/** Em que janela do relógio a chamada cai, dado o início da atividade (a mesma conta do servidor). Null = não cai antes do início. */
export function janelaLocal(c: Pick<ChamadaRascunho, "modo" | "horaFixa" | "minutosAntes" | "duracaoMin">, inicio: string | null): { inicio: string; fim: string } | null {
  if (!inicio) return null;
  const comeco = minutos(inicio), duracao = Number(c.duracaoMin);
  const dela = c.modo === "fixo" ? (/^\d{2}:\d{2}$/.test(c.horaFixa) ? minutos(c.horaFixa) : null) : (Number(c.minutosAntes) > 0 ? comeco - Number(c.minutosAntes) : null);
  if (dela === null || !Number.isFinite(duracao) || dela < 0 || dela >= comeco) return null;
  return { inicio: horaDe(dela), fim: horaDe(Math.min(dela + duracao, comeco)) };
}

/** O que está errado numa chamada, em português; null = pode salvar. `inicio` null = a atividade ainda não tem hora (não dá para conferir o horário). */
export function erroDaChamada(c: ChamadaRascunho, inicio: string | null): string | null {
  const nome = c.nome.trim();
  if (nome.length < 2 || nome.length > 40) return "Dê um nome à chamada, de 2 a 40 letras.";
  if (c.modo === "fixo" && !/^\d{2}:\d{2}$/.test(c.horaFixa)) return "Escolha a hora da chamada.";
  if (c.modo === "antes" && !(Number.isInteger(Number(c.minutosAntes)) && Number(c.minutosAntes) >= 1 && Number(c.minutosAntes) <= 600)) return "Diga quantos minutos antes (de 1 a 600).";
  const d = Number(c.duracaoMin);
  if (!Number.isInteger(d) || d < 5 || d > 240) return "A duração vai de 5 a 240 minutos.";
  if (inicio && !janelaLocal(c, inicio)) return `A chamada precisa começar antes do início da atividade (${inicio}).`;
  return null;
}

/** A chamada em uma frase curta, para listas: "Aquecimento 13:00–13:30" (ou "15 min antes" quando não há hora da atividade). */
export function resumoDaChamada(c: Pick<ChamadaDaApi, "nome" | "modo" | "horaFixa" | "minutosAntes" | "duracaoMin"> & { janela?: { inicio: string; fim: string } | null }, inicio?: string | null): string {
  const j = c.janela ?? (inicio ? janelaLocal({ modo: c.modo, horaFixa: c.horaFixa ?? "", minutosAntes: String(c.minutosAntes ?? ""), duracaoMin: String(c.duracaoMin) }, inicio) : null);
  return `${c.nome} ${j ? `${j.inicio}–${j.fim}` : c.modo === "fixo" ? c.horaFixa?.slice(0, 5) ?? "" : `${c.minutosAntes} min antes`}`.trim();
}

const corpoDaApi = (c: ChamadaRascunho) => ({
  nome: c.nome.trim(), modo: c.modo, horaFixa: c.modo === "fixo" ? c.horaFixa : null, minutosAntes: c.modo === "antes" ? Number(c.minutosAntes) : null,
  duracaoMin: Number(c.duracaoMin), ocupaTempo: c.ocupaTempo, avisar: c.avisar,
});
const mudou = (a: ChamadaRascunho, b: ChamadaRascunho) => JSON.stringify(corpoDaApi(a)) !== JSON.stringify(corpoDaApi(b));
const parametros = (dona: DonaDeChamada) => new URLSearchParams(dona as Record<string, string>).toString();

/**
 * Grava o que a pessoa mexeu: tira as que saíram, muda as que mudaram e cria as novas (nessa ordem, para o limite de chamadas não atrapalhar).
 * Para na primeira recusa e devolve a frase do servidor. Chamadas que não mudaram não vão ao servidor.
 */
export async function gravarChamadas(dona: DonaDeChamada, atuais: ChamadaRascunho[], originais: ChamadaRascunho[]): Promise<void> {
  const tiradas = originais.filter((o) => !atuais.some((a) => a.id === o.id));
  for (const o of tiradas) await customFetch(`/api/escalas/chamadas/${o.id}`, { method: "DELETE" });
  for (const a of atuais) {
    if (!a.id) continue;
    const antes = originais.find((o) => o.id === a.id);
    if (antes && mudou(a, antes)) await customFetch(`/api/escalas/chamadas/${a.id}`, { method: "PATCH", body: JSON.stringify({ ...corpoDaApi(a), baseUpdatedAt: antes.updatedAt }) });
  }
  for (const a of atuais) { if (!a.id) await customFetch("/api/escalas/chamadas", { method: "POST", body: JSON.stringify({ ...dona, ...corpoDaApi(a) }) }); }
}

/** Lista editável de chamadas (rascunho local). Serve aos três lugares; quem a usa decide quando gravar. */
export function ChamadasLista({ valor, onChange, inicioDaAtividade, desabilitado = false, soLeitura = false }: { valor: ChamadaRascunho[]; onChange: (v: ChamadaRascunho[]) => void; inicioDaAtividade: string | null; desabilitado?: boolean; /** Quem só lê não vê "Tirar" nem "+ Chamada". */ soLeitura?: boolean }) {
  const listaId = useId();
  const muda = (chave: string, parte: Partial<ChamadaRascunho>) => onChange(valor.map((c) => c.chave === chave ? { ...c, ...parte } : c));
  return <div className="ch-lista">
    <datalist id={listaId}>{SUGESTOES_DE_NOME.map((s) => <option key={s} value={s}/>)}</datalist>
    {valor.length === 0 && <p className="ch-vazio">{soLeitura ? "Nenhuma chamada." : "Nenhuma chamada. Acrescente uma para as pessoas saberem a que horas estar prontas."}</p>}
    {valor.map((c, i) => {
      const janela = janelaLocal(c, inicioDaAtividade);
      const erro = c.nome.trim() || c.horaFixa || c.minutosAntes ? erroDaChamada(c, inicioDaAtividade) : null;
      return <fieldset key={c.chave} className="ch-card" disabled={desabilitado} aria-label={`Chamada ${i + 1}`}>
        <div className="ch-topo">
          <strong>{`Chamada ${i + 1}`}</strong>
          {!soLeitura && <button type="button" className="ch-tirar" onClick={() => onChange(valor.filter((x) => x.chave !== c.chave))} aria-label={`Tirar a chamada ${c.nome.trim() || i + 1}`}><X size={16}/> Tirar</button>}
        </div>
        <label className="ch-campo">Nome
          <input value={c.nome} list={listaId} maxLength={40} placeholder="Aquecimento" onChange={(e) => muda(c.chave, { nome: e.target.value })}/>
        </label>
        <div className="ch-linha">
          <label className="ch-campo">Horário
            <select value={c.modo} onChange={(e) => muda(c.chave, { modo: e.target.value as ModoDeChamada })}>
              <option value="antes">Minutos antes do início</option>
              <option value="fixo">Hora fixa</option>
            </select>
          </label>
          {c.modo === "fixo"
            ? <label className="ch-campo">Hora<input type="time" value={c.horaFixa} onChange={(e) => muda(c.chave, { horaFixa: e.target.value })}/></label>
            : <label className="ch-campo">Minutos antes<input type="number" inputMode="numeric" min={1} max={600} value={c.minutosAntes} onChange={(e) => muda(c.chave, { minutosAntes: e.target.value })}/></label>}
          <label className="ch-campo">Duração (min)
            <input type="number" inputMode="numeric" min={5} max={240} step={5} value={c.duracaoMin} onChange={(e) => muda(c.chave, { duracaoMin: e.target.value })}/>
          </label>
        </div>
        <div className="ch-marcas">
          <label><input type="checkbox" checked={c.ocupaTempo} onChange={(e) => muda(c.chave, { ocupaTempo: e.target.checked })}/> Ocupa tempo <small>(gera choque se a pessoa tiver outra coisa)</small></label>
          <label><input type="checkbox" checked={c.avisar} onChange={(e) => muda(c.chave, { avisar: e.target.checked })}/> Avisar <small>(entra no aviso de convocação)</small></label>
        </div>
        {erro ? <p className="ch-erro" role="alert">{erro}</p>
          : <p className="ch-previa">{janela ? `Das ${janela.inicio} às ${janela.fim}` : inicioDaAtividade ? "" : "O horário se confere quando a atividade tiver hora de início."}</p>}
      </fieldset>;
    })}
    {!soLeitura && <button type="button" className="ch-mais" disabled={desabilitado || valor.length >= 8} onClick={() => onChange([...valor, chamadaVazia()])}><Plus size={16}/> Chamada</button>}
    {!soLeitura && valor.length >= 8 && <p className="ch-previa">Uma atividade pode ter até 8 chamadas.</p>}
  </div>;
}

/** Algum rascunho com erro? (para travar o "Salvar") */
export const primeiroErro = (valor: ChamadaRascunho[], inicio: string | null) => { for (const c of valor) { const e = erroDaChamada(c, inicio); if (e) return e; } return null; };

/**
 * Janela "Chamadas": carrega as chamadas da dona, deixa mexer num rascunho e grava no "Salvar chamadas". Na sessão de um show tem ainda
 * "Copiar para as outras sessões" (a hora fixa mantém a distância do início da sessão).
 */
export function ChamadasDialog({ dona, titulo, inicioDaAtividade, onClose, onSalvou }: { dona: DonaDeChamada; titulo: string; inicioDaAtividade: string | null; onClose: () => void; onSalvou?: () => void }) {
  useFecharComEsc(onClose);
  const [originais, setOriginais] = useState<ChamadaRascunho[] | null>(null);
  const [valor, setValor] = useState<ChamadaRascunho[]>([]);
  const [podeEditar, setPodeEditar] = useState(true);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  // A dona vira texto: se quem abre a janela passar um objeto novo a cada render, a lista não recarrega (e não apaga o que a pessoa digitou).
  const chaveDaDona = parametros(dona);
  const carregar = useCallback(async () => {
    try {
      const r = await customFetch<{ chamadas: ChamadaDaApi[]; podeEditar: boolean }>(`/api/escalas/chamadas?${chaveDaDona}`);
      const lista = r.chamadas.map(doApi);
      setOriginais(lista); setValor(lista); setPodeEditar(r.podeEditar);
    } catch (e) { setErro(mensagemDoErro(e, "Não consegui carregar as chamadas.")); setOriginais((atual) => atual ?? []); }
  }, [chaveDaDona]);
  useEffect(() => { void carregar(); }, [carregar]);
  const semMudanca = useMemo(() => !originais || JSON.stringify(valor.map((c) => [c.id ?? c.chave, corpoDaApi(c)])) === JSON.stringify(originais.map((c) => [c.id ?? c.chave, corpoDaApi(c)])), [valor, originais]);
  const bloqueio = primeiroErro(valor, inicioDaAtividade);
  const salvar = async () => {
    if (!originais || bloqueio) { if (bloqueio) setErro(bloqueio); return; }
    setOcupado(true); setErro(""); setAviso("");
    try { await gravarChamadas(dona, valor, originais); onSalvou?.(); onClose(); }
    catch (e) { setErro(mensagemDoErro(e, "Não consegui salvar as chamadas. Nada além do que já apareceu foi salvo; confira e tente de novo.")); await carregar(); }
    finally { setOcupado(false); }
  };
  const copiar = async () => {
    if (!("sessionId" in dona)) return;
    setOcupado(true); setErro(""); setAviso("");
    try {
      const r = await customFetch<{ copiadas: number; resultado: { inicio: string; copiadas: number; pulada?: string }[] }>("/api/escalas/chamadas/copiar", { method: "POST", body: JSON.stringify({ deSessionId: dona.sessionId }) });
      const partes = r.resultado.map((x) => x.pulada ? `a das ${x.inicio} ${x.pulada}` : `a das ${x.inicio} recebeu ${x.copiadas}`);
      setAviso(r.resultado.length ? `Copiado: ${partes.join("; ")}.` : "Este show não tem outras sessões para receber a cópia.");
      onSalvou?.();
    } catch (e) { setErro(mensagemDoErro(e, "Não consegui copiar as chamadas.")); }
    finally { setOcupado(false); }
  };
  return <div className="shows-dialog-backdrop"><div className="shows-dialog ch-dialog" role="dialog" aria-modal="true" aria-label={titulo}>
    <header className="shows-dialog-header"><div><h2>{titulo}</h2><p>Vão as pessoas que estão na atividade (no show, as do Livro do Dia). Quem está de folga não recebe.</p></div><button type="button" onClick={onClose} aria-label="Fechar"><X size={18}/></button></header>
    <div className="shows-dialog-content">
      {originais === null ? <p className="ch-vazio">Carregando as chamadas…</p>
        : <ChamadasLista valor={valor} onChange={setValor} inicioDaAtividade={inicioDaAtividade} desabilitado={!podeEditar || ocupado} soLeitura={!podeEditar}/>}
      {!podeEditar && originais !== null && <p className="ch-previa">Você só lê as chamadas: quem muda é a Administração, o responsável pelo show e a Supervisão do local.</p>}
      {podeEditar && "sessionId" in dona && originais !== null && originais.length > 0 && semMudanca && <button type="button" className="ch-copiar" disabled={ocupado} onClick={() => void copiar()}>Copiar para as outras sessões do show</button>}
      {aviso && <p className="ch-ok" role="status">{aviso}</p>}
      {erro && <p className="ch-erro" role="alert">{erro}</p>}
    </div>
    <footer className="shows-dialog-footer">
      <button type="button" className="shows-secondary" onClick={onClose}>{podeEditar ? "Cancelar" : "Fechar"}</button>
      {podeEditar && <button type="button" className="shows-primary" disabled={ocupado || originais === null || semMudanca || Boolean(bloqueio)} onClick={() => void salvar()}>{ocupado ? "Salvando…" : "Salvar chamadas"}</button>}
    </footer>
  </div></div>;
}
