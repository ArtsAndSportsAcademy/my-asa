import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Check, CirclePlus, RotateCcw, X } from "lucide-react";
import { customFetch } from "@workspace/api-client-react";
import { useFecharComEsc } from "@/lib/fechar-com-esc";

type Repeticao = "NONE" | "DAILY" | "WEEKLY" | "MONTHLY" | "EVERY_N_DAYS";
type Item = { id: string; title: string; ownerId: string; ownerName: string; repeatKind: Repeticao; repeatN?: number | null; weekday?: number | null; done: boolean; nextDueOn?: string | null; active: boolean; removedReason?: string | null };
type Pedido = { id: string; title: string; details?: string | null; dueDate?: string | null; requesterName?: string | null; semDono: boolean; responsibilityId: string };
export type TarefaDaResponsabilidade = { id: string; title: string; responsibilityId?: string | null; assigneeName: string; dueDate?: string | null; status: string };
type Painel = { tipo: "recusar"; pedido: Pedido } | { tipo: "item"; item?: Item } | { tipo: "remover"; item: Item } | null;

const DIAS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
const dia = (iso?: string | null) => iso ? new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : null;
const frase = (cause: unknown, padrao: string) => { const data = (cause as { data?: { message?: string; error?: string } } | null)?.data; return data?.message || data?.error || padrao; };
export function textoDaRepeticao(item: Pick<Item, "repeatKind" | "repeatN" | "weekday">) {
  switch (item.repeatKind) {
    case "DAILY": return "Volta todo dia";
    case "WEEKLY": return `Volta ${item.weekday === 0 || item.weekday === 6 ? "todo" : "toda"} ${DIAS[item.weekday ?? 1]}`;
    case "MONTHLY": return "Volta todo mês";
    case "EVERY_N_DAYS": return `Volta a cada ${item.repeatN} ${item.repeatN === 1 ? "dia" : "dias"}`;
    default: return "Não repete";
  }
}

/**
 * Uma responsabilidade por dentro: os pedidos que chegaram para quem cuida (aceitar ou recusar com motivo), a lista fixa
 * (o que se faz sempre, com a repetição de cada item) e as tarefas em andamento dela.
 */
export default function ResponsabilidadeDetalhe({ responsabilidade, tarefas, onMudou, onAbrirTarefa, onPedir, onFechar }: {
  responsabilidade: { id: string; title: string; description?: string | null }; tarefas: TarefaDaResponsabilidade[];
  onMudou: (mensagem?: string) => void; onAbrirTarefa: (id: string) => void; onPedir: () => void; onFechar: () => void;
}) {
  const [pedidos, setPedidos] = useState<Pedido[]>([]), [itens, setItens] = useState<Item[]>([]), [verRemovidos, setVerRemovidos] = useState(false);
  const [carregando, setCarregando] = useState(true), [erro, setErro] = useState(""), [saving, setSaving] = useState(false);
  const [painel, setPainel] = useState<Painel>(null), [erroPainel, setErroPainel] = useState(""), [motivo, setMotivo] = useState("");
  const [form, setForm] = useState({ title: "", repeatKind: "NONE" as Repeticao, repeatN: "7", weekday: "1" });
  const fecharPainel = useCallback(() => { setPainel(null); setErroPainel(""); setMotivo(""); }, []);
  useFecharComEsc(() => { if (saving) return; if (painel) fecharPainel(); else onFechar(); }, true);

  const carregar = useCallback(async () => {
    setCarregando(true); setErro("");
    try {
      const [caixa, lista] = await Promise.all([
        customFetch<{ requests: Pedido[] }>("/api/responsibility-requests/inbox"),
        customFetch<{ routines: Item[] }>(`/api/responsibilities/${responsabilidade.id}/routines${verRemovidos ? "?removidos=1" : ""}`),
      ]);
      setPedidos((caixa.requests ?? []).filter((pedido) => pedido.responsibilityId === responsabilidade.id)); setItens(lista.routines ?? []);
    } catch (cause) { setErro(frase(cause, "Não consegui abrir esta responsabilidade agora. Confira a conexão e tente de novo.")); }
    finally { setCarregando(false); }
  }, [responsabilidade.id, verRemovidos]);
  useEffect(() => { void carregar(); }, [carregar]);

  const agir = async (caminho: string, metodo: "POST" | "PATCH" | "DELETE", corpo: unknown, sucesso: string, noPainel = false) => {
    setSaving(true); setErro(""); setErroPainel("");
    try {
      await customFetch(caminho, { method: metodo, headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo ?? {}) });
      fecharPainel(); await carregar(); onMudou(sucesso);
    } catch (cause) {
      const mensagem = frase(cause, "Não consegui fazer isso agora. Nada foi alterado; confira a conexão e tente de novo.");
      if (noPainel) setErroPainel(mensagem); else setErro(mensagem);
    } finally { setSaving(false); }
  };

  const base = `/api/responsibilities/${responsabilidade.id}/routines`;
  const abrirItem = (item?: Item) => { setForm(item ? { title: item.title, repeatKind: item.repeatKind, repeatN: String(item.repeatN ?? 7), weekday: String(item.weekday ?? 1) } : { title: "", repeatKind: "NONE", repeatN: "7", weekday: "1" }); setErroPainel(""); setPainel({ tipo: "item", item }); };
  const salvarItem = (event: FormEvent) => {
    event.preventDefault();
    if (painel?.tipo !== "item" || saving || !form.title.trim()) return;
    const corpo = { title: form.title.trim(), repeatKind: form.repeatKind, repeatN: form.repeatKind === "EVERY_N_DAYS" ? Number(form.repeatN) : undefined, weekday: form.repeatKind === "WEEKLY" ? Number(form.weekday) : undefined };
    void agir(painel.item ? `${base}/${painel.item.id}` : base, painel.item ? "PATCH" : "POST", corpo, painel.item ? "Item atualizado." : "Item acrescentado à lista fixa.", true);
  };
  const emAndamento = tarefas.filter((tarefa) => tarefa.responsibilityId === responsabilidade.id && !["APPROVED", "COMPLETED", "CANCELLED", "EXPIRED"].includes(tarefa.status));

  return <div className="rt-backdrop" role="presentation" onMouseDown={() => { if (!saving && !painel) onFechar(); }}><section className="rt-dialog rt-lot-dialog" role="dialog" aria-modal="true" aria-labelledby="rt-resp-det-title" onMouseDown={(event) => event.stopPropagation()}>
    <header><h2 id="rt-resp-det-title">{responsabilidade.title}</h2><button className="rt-icon-button" aria-label="Fechar" onClick={() => { if (!saving) onFechar(); }}><X size={18}/></button></header>
    {responsabilidade.description && <p>{responsabilidade.description}</p>}
    {erro && <p className="rt-form-error" role="alert">{erro}</p>}
    {carregando && !itens.length && !pedidos.length ? <div className="rt-loading" aria-busy="true"><i/><i/></div> : <div className="rt-detail">
      <h3 className="rt-sec">Pedidos novos{pedidos.length ? ` (${pedidos.length})` : ""}</h3>
      {pedidos.length ? <ul className="rt-req-list">{pedidos.map((pedido) => <li key={pedido.id}>
        <div><strong>{pedido.title}</strong><span>pedido de {pedido.requesterName ?? "alguém"}{pedido.dueDate ? ` · para ${dia(pedido.dueDate)}` : " · sem prazo"}</span>{pedido.details && <span>{pedido.details}</span>}{pedido.semDono && <span>Esta responsabilidade ainda não tem dono; o pedido veio para a Administração.</span>}</div>
        <div className="rt-req-actions"><button type="button" className="rt-primary" disabled={saving} onClick={() => void agir(`/api/responsibility-requests/${pedido.id}/accept`, "POST", {}, "Pedido aceito: ele virou uma tarefa sua.")}>Aceitar</button><button type="button" className="rt-secondary" disabled={saving} onClick={() => { setErroPainel(""); setMotivo(""); setPainel({ tipo: "recusar", pedido }); }}>Recusar</button></div>
      </li>)}</ul> : <p className="rt-explainer">Nenhum pedido novo. Quando alguém pedir algo a esta responsabilidade, aparece aqui e você recebe um aviso.</p>}

      <h3 className="rt-sec">Lista fixa</h3>
      {itens.some((item) => item.active) || verRemovidos ? <ul className="rt-routine-list">{itens.map((item) => <li key={item.id} className={`${item.done ? "is-done" : ""} ${item.active ? "" : "is-removed"}`}>
        {item.active
          ? <button type="button" className="rt-check" aria-label={`${item.done ? "Desmarcar" : "Marcar como feito"}: ${item.title}`} aria-pressed={item.done} disabled={saving} onClick={() => void agir(`${base}/${item.id}/${item.done ? "uncheck" : "check"}`, "POST", {}, item.done ? "Item reaberto." : "Item feito.")}>{item.done ? <Check size={17}/> : null}</button>
          : <button type="button" className="rt-check" aria-label={`Trazer de volta: ${item.title}`} disabled={saving} onClick={() => void agir(`${base}/${item.id}/restore`, "POST", {}, "Item de volta à lista.")}><RotateCcw size={15}/></button>}
        <div><strong>{item.title}</strong><span>{textoDaRepeticao(item)}{item.done && item.nextDueOn ? ` · volta em ${dia(item.nextDueOn)}` : ""}{item.ownerName ? ` · de ${item.ownerName}` : ""}</span>{!item.active && <span>Tirado: {item.removedReason}</span>}</div>
        {item.active && <div className="rt-routine-actions"><button type="button" className="rt-link-button" onClick={() => abrirItem(item)}>Repetição</button><button type="button" className="rt-task-cancel" onClick={() => { setErroPainel(""); setMotivo(""); setPainel({ tipo: "remover", item }); }}>Tirar</button></div>}
      </li>)}</ul> : <p className="rt-explainer">A lista fixa está vazia. Adicione o que você faz sempre; cada item pode voltar sozinho todo dia, toda semana, todo mês ou de tantos em tantos dias.</p>}
      <div className="rt-routine-tools"><button type="button" className="rt-secondary" onClick={() => abrirItem()}><CirclePlus size={16}/>Adicionar item</button><button type="button" className="rt-link-button" onClick={() => setVerRemovidos((v) => !v)}>{verRemovidos ? "Esconder os tirados" : "Ver os tirados"}</button></div>

      <h3 className="rt-sec">Em andamento{emAndamento.length ? ` (${emAndamento.length})` : ""}</h3>
      {emAndamento.length ? <ul className="rt-req-list">{emAndamento.map((tarefa) => <li key={tarefa.id}><div><strong>{tarefa.title}</strong><span>{tarefa.assigneeName}{tarefa.dueDate ? ` · até ${dia(tarefa.dueDate)}` : " · sem prazo"}</span></div><button type="button" className="rt-link-button" onClick={() => onAbrirTarefa(tarefa.id)}>Abrir</button></li>)}</ul> : <p className="rt-explainer">Nada em andamento por aqui.</p>}
      <button type="button" className="rt-secondary rt-add" onClick={onPedir}>Pedir algo a esta responsabilidade</button>

      {painel && <form className="rt-form rt-panel" onSubmit={salvarItem}>
        {painel.tipo === "recusar" && <>
          <h3>Recusar “{painel.pedido.title}”</h3><p className="rt-explainer">Quem pediu vai ler o motivo. Se mais alguém cuida desta responsabilidade, o pedido segue para ela.</p>
          <label>Motivo<textarea required rows={2} autoFocus value={motivo} onChange={(event) => setMotivo(event.target.value)}/></label>
          {erroPainel && <p className="rt-form-error" role="alert">{erroPainel}</p>}
          <footer><button type="button" className="rt-secondary" onClick={fecharPainel}>Cancelar</button><button type="button" className="rt-primary rt-danger-solid" disabled={saving || !motivo.trim()} onClick={() => void agir(`/api/responsibility-requests/${painel.pedido.id}/decline`, "POST", { reason: motivo.trim() }, "Pedido recusado.", true)}>{saving ? "Recusando…" : "Recusar pedido"}</button></footer>
        </>}
        {painel.tipo === "remover" && <>
          <h3>Tirar “{painel.item.title}” da lista</h3><p className="rt-explainer">O item fica guardado e dá para trazê-lo de volta em “Ver os tirados”.</p>
          <label>Motivo<textarea required rows={2} autoFocus value={motivo} onChange={(event) => setMotivo(event.target.value)}/></label>
          {erroPainel && <p className="rt-form-error" role="alert">{erroPainel}</p>}
          <footer><button type="button" className="rt-secondary" onClick={fecharPainel}>Cancelar</button><button type="button" className="rt-primary rt-danger-solid" disabled={saving || !motivo.trim()} onClick={() => void agir(`${base}/${painel.item.id}`, "DELETE", { reason: motivo.trim() }, "Item tirado da lista.", true)}>{saving ? "Tirando…" : "Tirar item"}</button></footer>
        </>}
        {painel.tipo === "item" && <>
          <h3>{painel.item ? "Repetição do item" : "Novo item da lista fixa"}</h3>
          <label>O que se faz<input required autoFocus value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Ex.: Lavar e guardar depois do show"/></label>
          <label>Quando volta<select value={form.repeatKind} onChange={(event) => setForm({ ...form, repeatKind: event.target.value as Repeticao })}><option value="NONE">Não volta (fica marcado)</option><option value="DAILY">Todo dia</option><option value="WEEKLY">Toda semana</option><option value="MONTHLY">Todo mês</option><option value="EVERY_N_DAYS">De tantos em tantos dias</option></select></label>
          {form.repeatKind === "WEEKLY" && <label>Em que dia<select value={form.weekday} onChange={(event) => setForm({ ...form, weekday: event.target.value })}>{DIAS.map((nome, indice) => <option key={nome} value={indice}>{nome}</option>)}</select></label>}
          {form.repeatKind === "EVERY_N_DAYS" && <label>A cada quantos dias (1 a 365)<input type="number" min={1} max={365} required value={form.repeatN} onChange={(event) => setForm({ ...form, repeatN: event.target.value })}/></label>}
          <p className="rt-explainer">Quando você marca o item como feito, ele volta a ficar aberto no dia certo e você recebe um aviso.</p>
          {erroPainel && <p className="rt-form-error" role="alert">{erroPainel}</p>}
          <footer><button type="button" className="rt-secondary" onClick={fecharPainel}>Cancelar</button><button className="rt-primary" disabled={saving || !form.title.trim()}>{saving ? "Salvando…" : painel.item ? "Salvar" : "Adicionar item"}</button></footer>
        </>}
      </form>}
    </div>}
    <footer className="rt-detail-footer"><button type="button" className="rt-secondary" onClick={() => { if (!saving) onFechar(); }}>Fechar</button></footer>
  </section></div>;
}
