import { useMemo, useState, type FormEvent } from "react";
import { ArrowDown, ArrowUp, CirclePlus, Trash2, X } from "lucide-react";
import { customFetch } from "@workspace/api-client-react";
import { useFecharComEsc } from "@/lib/fechar-com-esc";

export type PessoaTarefa = { id: string; name?: string; displayName?: string; areaName?: string | null; status?: string; operationIds?: string[] };
export type OperacaoTarefa = { id: string; name: string };
export type ResponsabilidadeTarefa = { id: string; title: string };

type Etapa = { key: number; title: string; assigneeId: string; kind: "WORK" | "APPROVAL"; dueDate: string; description: string; checklist: string };
const etapaVazia = (key: number, kind: "WORK" | "APPROVAL" = "WORK"): Etapa => ({ key, title: kind === "APPROVAL" ? "Aprovar" : "", assigneeId: "", kind, dueDate: "", description: "", checklist: "" });
const nomeDe = (pessoa?: PessoaTarefa) => pessoa?.displayName ?? pessoa?.name ?? "Pessoa";
const frase = (cause: unknown, padrao: string) => { const data = (cause as { data?: { message?: string; error?: string } } | null)?.data; return data?.message || data?.error || padrao; };

/**
 * Nova tarefa. Qualquer pessoa cria para qualquer pessoa. Só o título é obrigatório; a tarefa é uma lista de etapas (cada uma com
 * sua pessoa e, se quiser, prazo, descrição e checklist), em fila ou solta, e a aprovação é uma etapa como as outras.
 */
export default function TarefaNova({ pessoas, operacoes, responsabilidades, responsabilidadeInicial, onCriada, onFechar }: {
  pessoas: PessoaTarefa[]; operacoes: OperacaoTarefa[]; responsabilidades: ResponsabilidadeTarefa[]; responsabilidadeInicial?: string;
  onCriada: (mensagem: string) => void; onFechar: () => void;
}) {
  const [title, setTitle] = useState(""), [description, setDescription] = useState("");
  const [ordering, setOrdering] = useState<"SEQUENTIAL" | "FREE">("SEQUENTIAL");
  const [prazo, setPrazo] = useState<"none" | "date" | "period">("none"), [dueDate, setDueDate] = useState(""), [periodStart, setPeriodStart] = useState("");
  const [responsibilityId, setResponsibilityId] = useState(responsabilidadeInicial ?? "");
  const [operationId, setOperationId] = useState(operacoes[0]?.id ?? "");
  const [etapas, setEtapas] = useState<Etapa[]>([etapaVazia(0)]), [proxima, setProxima] = useState(1);
  const [saving, setSaving] = useState(false), [error, setError] = useState(""), [descartando, setDescartando] = useState(false);

  const ativas = useMemo(() => pessoas.filter((pessoa) => (!pessoa.status || pessoa.status === "ACTIVE") && (!operationId || !pessoa.operationIds?.length || pessoa.operationIds.includes(operationId))), [pessoas, operationId]);
  const sujo = Boolean(title.trim() || description.trim() || etapas.some((etapa) => etapa.title.trim() && etapa.title !== "Aprovar" || etapa.assigneeId));
  const incompleta = !title.trim() || etapas.some((etapa) => !etapa.title.trim() || !etapa.assigneeId);
  const fechar = () => { if (saving) return; if (sujo && !descartando) { setDescartando(true); return; } onFechar(); };
  useFecharComEsc(fechar, true);

  const mexer = (key: number, patch: Partial<Etapa>) => setEtapas((atuais) => atuais.map((etapa) => etapa.key === key ? { ...etapa, ...patch } : etapa));
  const mover = (indice: number, passo: -1 | 1) => setEtapas((atuais) => { const destino = indice + passo; if (destino < 0 || destino >= atuais.length) return atuais; const copia = [...atuais]; [copia[indice], copia[destino]] = [copia[destino]!, copia[indice]!]; return copia; });
  const acrescentar = (kind: "WORK" | "APPROVAL") => { setEtapas((atuais) => [...atuais, etapaVazia(proxima, kind)]); setProxima((n) => n + 1); };

  const criar = async (event: FormEvent) => {
    event.preventDefault();
    if (incompleta || saving) return;
    setSaving(true); setError("");
    try {
      const corpo = {
        operationId, title: title.trim(), description: description.trim() || undefined, ordering,
        dueDate: prazo === "none" ? undefined : dueDate || undefined, periodStart: prazo === "period" ? periodStart || undefined : undefined,
        responsibilityId: responsibilityId || undefined,
        steps: etapas.map((etapa) => ({
          kind: etapa.kind, title: etapa.title.trim(), assigneeId: etapa.assigneeId, dueDate: etapa.dueDate || undefined, description: etapa.description.trim() || undefined,
          checklist: etapa.checklist.split("\n").map((linha) => linha.trim()).filter(Boolean),
        })),
      };
      await customFetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
      const primeira = pessoas.find((pessoa) => pessoa.id === etapas[0]?.assigneeId);
      onCriada(`Tarefa criada. ${ordering === "SEQUENTIAL" && etapas.length > 1 ? `${nomeDe(primeira)} recebe o aviso agora; as outras pessoas são avisadas quando chegar a vez delas.` : "Cada pessoa recebe um aviso no sino."}`);
    } catch (cause) {
      setError(frase(cause, "Não consegui criar a tarefa agora. Nada foi criado; confira a conexão e tente de novo."));
    } finally { setSaving(false); }
  };

  return <div className="rt-backdrop" role="presentation" onMouseDown={() => { if (!saving && !sujo) fechar(); }}><section className="rt-dialog rt-lot-dialog" role="dialog" aria-modal="true" aria-labelledby="rt-nova-title" onMouseDown={(event) => event.stopPropagation()}>
    <header><h2 id="rt-nova-title">Nova tarefa</h2><button className="rt-icon-button" aria-label="Fechar" onClick={fechar}><X size={18}/></button></header>
    <p>Só o título é obrigatório. Monte as etapas na ordem em que o trabalho acontece: cada uma tem a sua pessoa.</p>
    <form onSubmit={criar} className="rt-form">
      <label>Título<input required autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Vídeo de Natal para o TikTok"/></label>
      <label>Descrição (opcional)<textarea rows={2} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="O que precisa ser entregue"/></label>
      {operacoes.length > 1 && <label>Operação<select value={operationId} onChange={(event) => setOperationId(event.target.value)}>{operacoes.map((operacao) => <option key={operacao.id} value={operacao.id}>{operacao.name}</option>)}</select></label>}
      {!operacoes.length && <p className="rt-form-error">Nenhuma operação disponível para criar tarefa.</p>}

      <div className="rt-steps" role="group" aria-label="Etapas">
        {etapas.map((etapa, indice) => <fieldset key={etapa.key}>
          <legend>{etapa.kind === "APPROVAL" ? "Aprovação" : `Etapa ${indice + 1}`}</legend>
          <label>Nome da etapa<input required value={etapa.title} onChange={(event) => mexer(etapa.key, { title: event.target.value })} placeholder={etapa.kind === "APPROVAL" ? "Aprovar" : "Ex.: Gravar"}/></label>
          <label>{etapa.kind === "APPROVAL" ? "Quem aprova" : "Quem faz"}<select required value={etapa.assigneeId} onChange={(event) => mexer(etapa.key, { assigneeId: event.target.value })}><option value="">Escolha uma pessoa</option>{ativas.map((pessoa) => <option key={pessoa.id} value={pessoa.id}>{nomeDe(pessoa)}{pessoa.areaName ? ` · ${pessoa.areaName}` : ""}</option>)}</select></label>
          <label>Prazo desta etapa (opcional)<input type="date" value={etapa.dueDate} onChange={(event) => mexer(etapa.key, { dueDate: event.target.value })}/></label>
          {etapa.kind === "WORK" && <label>Checklist (um item por linha, opcional)<textarea rows={2} value={etapa.checklist} onChange={(event) => mexer(etapa.key, { checklist: event.target.value })} placeholder={"Subir as músicas\nDizer quanto tempo dura"}/></label>}
          <label>Descrição da etapa (opcional)<input value={etapa.description} onChange={(event) => mexer(etapa.key, { description: event.target.value })}/></label>
          <div className="rt-step-tools">
            <button type="button" className="rt-icon-button" aria-label={`Subir ${etapa.title || "etapa"}`} disabled={indice === 0} onClick={() => mover(indice, -1)}><ArrowUp size={16}/></button>
            <button type="button" className="rt-icon-button" aria-label={`Descer ${etapa.title || "etapa"}`} disabled={indice === etapas.length - 1} onClick={() => mover(indice, 1)}><ArrowDown size={16}/></button>
            {etapas.length > 1 && <button type="button" className="rt-remove" aria-label={`Remover ${etapa.title || `etapa ${indice + 1}`}`} onClick={() => setEtapas((atuais) => atuais.filter((item) => item.key !== etapa.key))}><Trash2 size={15}/>Remover</button>}
          </div>
        </fieldset>)}
      </div>
      <div className="rt-step-add">
        <button type="button" className="rt-secondary rt-add" disabled={etapas.length >= 20} onClick={() => acrescentar("WORK")}><CirclePlus size={16}/>Adicionar etapa</button>
        <button type="button" className="rt-secondary rt-add" disabled={etapas.length >= 20 || etapas.some((etapa) => etapa.kind === "APPROVAL")} onClick={() => acrescentar("APPROVAL")}><CirclePlus size={16}/>Pedir aprovação</button>
      </div>
      {etapas.length >= 20 && <p className="rt-explainer">Uma tarefa aceita até 20 etapas. Divida em duas tarefas.</p>}

      {etapas.length > 1 && <fieldset className="rt-order"><legend>Ordem</legend>
        <label className="rt-radio"><input type="radio" name="rt-ordem" checked={ordering === "SEQUENTIAL"} onChange={() => setOrdering("SEQUENTIAL")}/><span>Em fila: cada pessoa só é avisada quando a etapa anterior termina.</span></label>
        <label className="rt-radio"><input type="radio" name="rt-ordem" checked={ordering === "FREE"} onChange={() => setOrdering("FREE")}/><span>Solta: todas começam juntas, cada uma no seu ritmo. A aprovação espera as outras.</span></label>
      </fieldset>}

      <fieldset className="rt-order"><legend>Prazo da tarefa</legend>
        <label className="rt-radio"><input type="radio" name="rt-prazo" checked={prazo === "none"} onChange={() => setPrazo("none")}/><span>Sem prazo</span></label>
        <label className="rt-radio"><input type="radio" name="rt-prazo" checked={prazo === "date"} onChange={() => setPrazo("date")}/><span>Uma data</span></label>
        <label className="rt-radio"><input type="radio" name="rt-prazo" checked={prazo === "period"} onChange={() => setPrazo("period")}/><span>Um período</span></label>
        {prazo === "date" && <label>Entregar até<input type="date" required value={dueDate} onChange={(event) => setDueDate(event.target.value)}/></label>}
        {prazo === "period" && <div className="rt-draft-pair"><label>De<input type="date" required value={periodStart} onChange={(event) => setPeriodStart(event.target.value)}/></label><label>Até<input type="date" required min={periodStart || undefined} value={dueDate} onChange={(event) => setDueDate(event.target.value)}/></label></div>}
      </fieldset>

      {responsabilidades.length > 0 && <label>Responsabilidade (opcional)<select value={responsibilityId} onChange={(event) => setResponsibilityId(event.target.value)}><option value="">Tarefa avulsa</option>{responsabilidades.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>}

      {error && <p className="rt-form-error" role="alert">{error}</p>}
      {descartando && <div className="rt-discard" role="alertdialog" aria-label="Descartar a tarefa"><span>Descartar o que você digitou? A tarefa não foi criada.</span><div><button type="button" className="rt-secondary" onClick={() => setDescartando(false)}>Continuar editando</button><button type="button" className="rt-secondary rt-danger" onClick={onFechar}>Descartar</button></div></div>}
      <footer><button type="button" className="rt-secondary" onClick={fechar}>{sujo ? "Descartar" : "Cancelar"}</button><button className="rt-primary" disabled={saving || incompleta || !operationId}>{saving ? "Criando…" : "Criar tarefa"}</button></footer>
    </form>
  </section></div>;
}
