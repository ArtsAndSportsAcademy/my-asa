import { useCallback, useEffect, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { customFetch } from "@workspace/api-client-react";
import { useFecharComEsc } from "@/lib/fechar-com-esc";

const frase = (cause: unknown, padrao: string) => { const data = (cause as { data?: { message?: string; error?: string } } | null)?.data; return data?.message || data?.error || padrao; };
const dia = (iso?: string | null) => iso ? new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : null;

type Escolha = { id: string; title: string; areaName?: string | null; semDono: boolean };

/**
 * Pedir algo a uma responsabilidade ("Perucas"): quem pede escolhe o nome, não a pessoa. O pedido vai para quem cuida; basta
 * uma pessoa aceitar e ele vira uma tarefa.
 */
export function PedidoNovo({ responsabilidadeInicial, onEnviado, onFechar }: { responsabilidadeInicial?: string; onEnviado: (mensagem: string) => void; onFechar: () => void }) {
  const [opcoes, setOpcoes] = useState<Escolha[]>([]), [carregando, setCarregando] = useState(true), [erroLista, setErroLista] = useState(false);
  const [responsabilidade, setResponsabilidade] = useState(responsabilidadeInicial ?? ""), [title, setTitle] = useState(""), [details, setDetails] = useState(""), [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false), [error, setError] = useState(""), [descartando, setDescartando] = useState(false);
  const sujo = Boolean(title.trim() || details.trim());
  const fechar = () => { if (saving) return; if (sujo && !descartando) { setDescartando(true); return; } onFechar(); };
  useFecharComEsc(fechar, true);

  useEffect(() => {
    customFetch<{ responsibilities: Escolha[] }>("/api/responsibilities/pickable")
      .then((dados) => setOpcoes(dados.responsibilities ?? [])).catch(() => setErroLista(true)).finally(() => setCarregando(false));
  }, []);

  const escolhida = opcoes.find((item) => item.id === responsabilidade);
  const enviar = async (event: FormEvent) => {
    event.preventDefault();
    if (!responsabilidade || !title.trim() || saving) return;
    setSaving(true); setError("");
    try {
      await customFetch(`/api/responsibilities/${responsabilidade}/requests`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: title.trim(), details: details.trim() || undefined, dueDate: dueDate || undefined }) });
      onEnviado(escolhida?.semDono ? `Pedido enviado. ${escolhida.title} ainda não tem dono, então ele foi para a Administração.` : `Pedido enviado para quem cuida de ${escolhida?.title ?? "esta responsabilidade"}. Você recebe um aviso quando alguém aceitar.`);
    } catch (cause) { setError(frase(cause, "Não consegui enviar o pedido agora. Nada foi enviado; confira a conexão e tente de novo.")); }
    finally { setSaving(false); }
  };

  return <div className="rt-backdrop" role="presentation" onMouseDown={() => { if (!saving && !sujo) fechar(); }}><section className="rt-dialog" role="dialog" aria-modal="true" aria-labelledby="rt-pedido-title" onMouseDown={(event) => event.stopPropagation()}>
    <header><h2 id="rt-pedido-title">Pedir algo</h2><button className="rt-icon-button" aria-label="Fechar" onClick={fechar}><X size={18}/></button></header>
    <p>Escolha a responsabilidade, não a pessoa: o pedido vai para quem cuida dela.</p>
    <form onSubmit={enviar} className="rt-form">
      <label>A quem<select required value={responsabilidade} onChange={(event) => setResponsabilidade(event.target.value)} disabled={carregando}><option value="">{carregando ? "Carregando…" : "Escolha uma responsabilidade"}</option>{opcoes.map((item) => <option key={item.id} value={item.id}>{item.title}{item.areaName ? ` · ${item.areaName}` : ""}</option>)}</select></label>
      {erroLista && <p className="rt-form-error" role="alert">Não consegui carregar as responsabilidades. Feche e tente de novo.</p>}
      {!carregando && !erroLista && !opcoes.length && <p className="rt-form-error">Ainda não há responsabilidades cadastradas. A Administração cadastra em Responsabilidades.</p>}
      {escolhida && <p className="rt-explainer">{escolhida.semDono ? `${escolhida.title} ainda não tem dono: o pedido vai para a Administração.` : `Vai para quem cuida de ${escolhida.title}. Se for mais de uma pessoa, vai para todas e basta uma aceitar.`}</p>}
      <label>O que você precisa<input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Refazer a peruca da Nona"/></label>
      <label>Detalhes (opcional)<textarea rows={3} value={details} onChange={(event) => setDetails(event.target.value)} placeholder="Qualquer coisa que ajude a pessoa a entender"/></label>
      <label>Para quando (opcional)<input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)}/></label>
      {error && <p className="rt-form-error" role="alert">{error}</p>}
      {descartando && <div className="rt-discard" role="alertdialog" aria-label="Descartar o pedido"><span>Descartar o que você digitou? O pedido não foi enviado.</span><div><button type="button" className="rt-secondary" onClick={() => setDescartando(false)}>Continuar editando</button><button type="button" className="rt-secondary rt-danger" onClick={onFechar}>Descartar</button></div></div>}
      <footer><button type="button" className="rt-secondary" onClick={fechar}>{sujo ? "Descartar" : "Cancelar"}</button><button className="rt-primary" disabled={saving || !responsabilidade || !title.trim()}>{saving ? "Enviando…" : "Enviar pedido"}</button></footer>
    </form>
  </section></div>;
}

type MeuPedido = { id: string; responsibilityTitle: string; title: string; status: "OPEN" | "ACCEPTED" | "DECLINED" | "CANCELLED"; dueDate?: string | null; acceptedByName?: string | null; recipients: { name: string | null; declineReason?: string | null; declinedAt?: string | null }[]; semDono: boolean };
const estado: Record<MeuPedido["status"], string> = { OPEN: "Esperando resposta", ACCEPTED: "Aceito", DECLINED: "Ninguém pôde", CANCELLED: "Cancelado" };

/** Os pedidos que a própria pessoa fez: acompanhar o que aconteceu com cada um e cancelar o que ainda está aberto. */
export function MeusPedidos({ atualizar, onMudou }: { atualizar: number; onMudou: (mensagem: string) => void }) {
  const [pedidos, setPedidos] = useState<MeuPedido[]>([]), [cancelar, setCancelar] = useState<MeuPedido | null>(null), [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false), [error, setError] = useState("");
  const fecharCancelar = useCallback(() => { setCancelar(null); setMotivo(""); setError(""); }, []);
  useFecharComEsc(() => { if (!saving) fecharCancelar(); }, Boolean(cancelar));
  useEffect(() => { customFetch<{ requests: MeuPedido[] }>("/api/responsibility-requests/mine").then((dados) => setPedidos(dados.requests ?? [])).catch(() => setPedidos([])); }, [atualizar]);

  const confirmar = async (event: FormEvent) => {
    event.preventDefault();
    if (!cancelar || saving) return;
    setSaving(true); setError("");
    try {
      await customFetch(`/api/responsibility-requests/${cancelar.id}/cancel`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: motivo.trim() }) });
      fecharCancelar(); onMudou("Pedido cancelado. Quem tinha recebido foi avisada.");
    } catch (cause) { setError(frase(cause, "Não consegui cancelar agora. Nada foi alterado; tente de novo.")); }
    finally { setSaving(false); }
  };
  if (!pedidos.length) return null;
  return <section className="rt-mine" aria-label="Meus pedidos">
    <h3>Meus pedidos</h3>
    <ul>{pedidos.slice(0, 8).map((pedido) => <li key={pedido.id}>
      <div><strong>{pedido.title}</strong><span>{pedido.responsibilityTitle}{pedido.dueDate ? ` · até ${dia(pedido.dueDate)}` : ""}</span>
        {pedido.status === "ACCEPTED" && <span>Aceito por {pedido.acceptedByName}</span>}
        {pedido.status === "DECLINED" && <span>{pedido.recipients.map((pessoa) => `${pessoa.name}: ${pessoa.declineReason}`).join(" · ")}</span>}
      </div>
      <em className={`rt-req-state ${pedido.status.toLowerCase()}`}>{estado[pedido.status]}</em>
      {pedido.status === "OPEN" && <button type="button" className="rt-task-cancel" onClick={() => { setError(""); setCancelar(pedido); }}>Cancelar pedido</button>}
    </li>)}</ul>
    {cancelar && <div className="rt-backdrop" role="presentation" onMouseDown={() => { if (!saving) fecharCancelar(); }}><section className="rt-dialog" role="dialog" aria-modal="true" aria-labelledby="rt-cancel-pedido" onMouseDown={(event) => event.stopPropagation()}>
      <header><h2 id="rt-cancel-pedido">Cancelar pedido</h2><button className="rt-icon-button" aria-label="Fechar" onClick={fecharCancelar}><X size={18}/></button></header>
      <p>{cancelar.title} · {cancelar.responsibilityTitle}. Quem tinha recebido o pedido recebe o aviso de que ele não vale mais.</p>
      <form onSubmit={confirmar} className="rt-form"><label>Motivo<textarea required rows={3} autoFocus value={motivo} onChange={(event) => setMotivo(event.target.value)} placeholder="Quem tinha recebido lê este motivo"/></label>{error && <p className="rt-form-error" role="alert">{error}</p>}
        <footer><button type="button" className="rt-secondary" onClick={fecharCancelar}>Voltar</button><button className="rt-primary rt-danger-solid" disabled={saving || !motivo.trim()}>{saving ? "Cancelando…" : "Cancelar pedido"}</button></footer></form>
    </section></div>}
  </section>;
}
