import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Check, CircleDot, Link2, X } from "lucide-react";
import { customFetch } from "@workspace/api-client-react";
import { useFecharComEsc } from "@/lib/fechar-com-esc";
import { LinkDrive } from "@/components/drive-link";
import type { PessoaTarefa } from "@/components/tarefa-nova";

type Item = { id: string; label: string; completed: boolean };
type EtapaDetalhe = { id: string; position: number; kind: "WORK" | "APPROVAL"; title: string; description?: string | null; assigneeId: string; assigneeName: string; dueDate?: string | null; status: "WAITING" | "ACTIVE" | "DONE" | "DISPENSED"; checklist: Item[]; doneAt?: string | null; dispensedReason?: string | null };
type Anexo = { id: string; url: string; description?: string | null; stepId?: string | null; uploaderId: string };
type Detalhe = { id: string; title: string; description?: string | null; status: string; ordering: "SEQUENTIAL" | "FREE"; dueDate?: string | null; periodStart?: string | null; creatorId: string; creatorName?: string | null; steps: EtapaDetalhe[] };
type Painel = { tipo: "dispensar" | "passar" | "ajustes" | "etapa" | "link"; etapaId?: string } | null;

const estadoRotulo: Record<EtapaDetalhe["status"], string> = { WAITING: "Aguardando a vez", ACTIVE: "Na vez", DONE: "Feita", DISPENSED: "Dispensada" };
const encerrada = (status: string) => ["APPROVED", "COMPLETED", "CANCELLED", "EXPIRED"].includes(status);
const dia = (iso?: string | null) => iso ? new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : null;
const nomeDe = (pessoa?: PessoaTarefa) => pessoa?.displayName ?? pessoa?.name ?? "Pessoa";
const frase = (cause: unknown, padrao: string) => { const data = (cause as { data?: { message?: string; error?: string } } | null)?.data; return data?.message || data?.error || padrao; };

/**
 * A tarefa por dentro: as etapas na ordem com a pessoa e o estado de cada uma, o checklist, os links do Drive (abrem aqui
 * dentro) e as ações de quem pode. O servidor decide quem pode o quê; a tela só esconde o que a pessoa não pode e mostra a
 * frase dele quando recusa.
 */
export default function TarefaDetalhe({ tarefaId, meuId, papel, pessoas, onMudou, onFechar }: {
  tarefaId: string; meuId: string | null; papel: "adm" | "dir" | "sup" | "mem"; pessoas: PessoaTarefa[]; onMudou: (mensagem?: string) => void; onFechar: () => void;
}) {
  const [tarefa, setTarefa] = useState<Detalhe | null>(null), [anexos, setAnexos] = useState<Anexo[]>([]);
  const [carregando, setCarregando] = useState(true), [erro, setErro] = useState("");
  const [painel, setPainel] = useState<Painel>(null), [saving, setSaving] = useState(false), [erroPainel, setErroPainel] = useState("");
  const [motivo, setMotivo] = useState(""), [pessoaId, setPessoaId] = useState(""), [voltarPara, setVoltarPara] = useState("");
  const [novaEtapa, setNovaEtapa] = useState({ title: "", assigneeId: "", kind: "WORK" as "WORK" | "APPROVAL" });
  const [link, setLink] = useState({ url: "", descricao: "" }), [aviso, setAviso] = useState("");
  const [compartilhado, setCompartilhado] = useState<Record<string, boolean | null>>({});

  const fecharPainel = useCallback(() => { setPainel(null); setErroPainel(""); setMotivo(""); setPessoaId(""); setVoltarPara(""); setAviso(""); }, []);
  useFecharComEsc(() => { if (saving) return; if (painel) fecharPainel(); else onFechar(); }, true);

  const carregar = useCallback(async () => {
    setCarregando(true); setErro("");
    try {
      const dados = await customFetch<{ task: Detalhe; steps: EtapaDetalhe[]; evidences: Anexo[] }>(`/api/tasks/${tarefaId}`);
      setTarefa({ ...dados.task, steps: dados.steps }); setAnexos(dados.evidences ?? []);
    } catch (cause) { setErro(frase(cause, "Não consegui abrir a tarefa agora. Confira a conexão e tente de novo.")); }
    finally { setCarregando(false); }
  }, [tarefaId]);
  useEffect(() => { void carregar(); }, [carregar]);

  const adm = papel === "adm" || papel === "dir";
  const gestao = adm || papel === "sup" || tarefa?.creatorId === meuId;
  const aberta = tarefa ? !encerrada(tarefa.status) : false;
  const etapaDoPainel = tarefa?.steps.find((etapa) => etapa.id === painel?.etapaId);

  // Uma ação do servidor: mostra a frase dele quando recusa e avisa a lista de que algo mudou.
  const agir = async (caminho: string, metodo: "POST" | "PATCH", corpo: unknown, sucesso: string, onde: "tela" | "painel" = "painel") => {
    setSaving(true); setErroPainel(""); setErro("");
    try {
      await customFetch(caminho, { method: metodo, headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo ?? {}) });
      fecharPainel(); setLink({ url: "", descricao: "" }); setNovaEtapa({ title: "", assigneeId: "", kind: "WORK" });
      await carregar(); onMudou(sucesso);
    } catch (cause) {
      const mensagem = frase(cause, "Não consegui fazer isso agora. Nada foi alterado; confira a conexão e tente de novo.");
      if (onde === "painel") setErroPainel(mensagem); else setErro(mensagem);
    } finally { setSaving(false); }
  };

  const marcarItem = (etapa: EtapaDetalhe, item: Item) => void agir(`/api/tasks/${tarefaId}/steps/${etapa.id}`, "PATCH", { checklist: [{ id: item.id, completed: !item.completed }] }, "", "tela");
  const conferirLink = async (url: string) => {
    if (!url.trim()) { setAviso(""); return; }
    try {
      const resposta = await customFetch<{ valid: boolean; shared: boolean | null; message: string }>("/api/tasks/check-link", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) });
      setAviso(resposta.valid && resposta.shared !== false ? "" : resposta.message);
    } catch { setAviso(""); }
  };
  const anexar = (event: FormEvent) => {
    event.preventDefault();
    void agir(`/api/tasks/${tarefaId}/evidences`, "POST", { url: link.url.trim(), description: link.descricao.trim() || undefined, stepId: painel?.etapaId }, "Link anexado.").then(() => setCompartilhado({}));
  };

  const ativaDeAprovacao = tarefa?.steps.find((etapa) => etapa.kind === "APPROVAL" && etapa.status === "ACTIVE");
  const trabalhoFeito = tarefa?.steps.filter((etapa) => etapa.kind === "WORK" && etapa.status === "DONE") ?? [];

  return <div className="rt-backdrop" role="presentation" onMouseDown={() => { if (!saving && !painel) onFechar(); }}><section className="rt-dialog rt-lot-dialog" role="dialog" aria-modal="true" aria-labelledby="rt-det-title" onMouseDown={(event) => event.stopPropagation()}>
    <header><h2 id="rt-det-title">{tarefa?.title ?? "Tarefa"}</h2><button className="rt-icon-button" aria-label="Fechar" onClick={() => { if (!saving) onFechar(); }}><X size={18}/></button></header>
    {carregando && !tarefa ? <div className="rt-loading" aria-busy="true"><i/><i/></div> : null}
    {erro && <p className="rt-form-error" role="alert">{erro}</p>}
    {tarefa && <div className="rt-detail">
      <p className="rt-detail-meta">
        <span>Criada por {tarefa.creatorName ?? "—"}</span>
        <span>{tarefa.periodStart && tarefa.dueDate ? `De ${dia(tarefa.periodStart)} a ${dia(tarefa.dueDate)}` : tarefa.dueDate ? `Até ${dia(tarefa.dueDate)}` : "Sem prazo"}</span>
        <span>{tarefa.ordering === "SEQUENTIAL" ? "Em fila" : "Etapas soltas"}</span>
      </p>
      {tarefa.description && <p className="rt-detail-desc">{tarefa.description}</p>}

      <ol className="rt-step-list">{tarefa.steps.map((etapa) => {
        const meu = etapa.assigneeId === meuId, daVez = etapa.status === "ACTIVE";
        const anexosDaEtapa = anexos.filter((anexo) => anexo.stepId === etapa.id);
        return <li key={etapa.id} className={`rt-step is-${etapa.status.toLowerCase()}`}>
          <span className="rt-step-mark" aria-hidden="true">{etapa.status === "DONE" ? <Check size={14}/> : daVez ? <CircleDot size={14}/> : etapa.position}</span>
          <div className="rt-step-body">
            <strong>{etapa.title}{etapa.kind === "APPROVAL" ? " (aprovação)" : ""}</strong>
            <div className="rt-step-line"><span>{etapa.assigneeName}</span>{etapa.dueDate && <span>até {dia(etapa.dueDate)}</span>}<span className={`rt-step-state ${etapa.status.toLowerCase()}`}>{estadoRotulo[etapa.status]}</span></div>
            {etapa.description && <p className="rt-detail-desc">{etapa.description}</p>}
            {etapa.status === "DISPENSED" && etapa.dispensedReason && <p className="rt-detail-desc">Dispensada: {etapa.dispensedReason}</p>}
            {etapa.checklist.length > 0 && <ul className="rt-checklist">{etapa.checklist.map((item) => <li key={item.id}><label><input type="checkbox" checked={item.completed} disabled={saving || !daVez || !(meu || gestao)} onChange={() => marcarItem(etapa, item)}/><span>{item.label}</span></label></li>)}</ul>}
            {anexosDaEtapa.map((anexo) => <LinkDrive key={anexo.id} openUrl={anexo.url} descricao={anexo.description} shared={compartilhado[anexo.id]}/>)}
            {aberta && <div className="rt-step-actions">
              {daVez && (meu || adm) && <button type="button" className="rt-primary" disabled={saving} onClick={() => void agir(`/api/tasks/${tarefaId}/steps/${etapa.id}/complete`, "POST", {}, etapa.kind === "APPROVAL" ? "Tarefa aprovada." : "Etapa concluída.", "tela")}>{saving ? "Salvando…" : etapa.kind === "APPROVAL" ? "Aprovar" : "Concluir etapa"}</button>}
              {(meu || gestao) && etapa.status !== "DISPENSED" && etapa.status !== "DONE" && <button type="button" className="rt-secondary" onClick={() => { fecharPainel(); setPainel({ tipo: "link", etapaId: etapa.id }); }}><Link2 size={15}/>Anexar link do Drive</button>}
              {gestao && (daVez || etapa.status === "WAITING") && <>
                <button type="button" className="rt-secondary" onClick={() => { fecharPainel(); setPainel({ tipo: "passar", etapaId: etapa.id }); }}>Passar para outra pessoa</button>
                <button type="button" className="rt-secondary rt-danger" onClick={() => { fecharPainel(); setPainel({ tipo: "dispensar", etapaId: etapa.id }); }}>Dispensar</button>
              </>}
            </div>}
          </div>
        </li>;
      })}</ol>

      {anexos.some((anexo) => !anexo.stepId) && <div className="rt-detail"><h3 className="rt-sec">Links da tarefa</h3>{anexos.filter((anexo) => !anexo.stepId).map((anexo) => <LinkDrive key={anexo.id} openUrl={anexo.url} descricao={anexo.description} shared={compartilhado[anexo.id]}/>)}</div>}

      {aberta && ativaDeAprovacao && (ativaDeAprovacao.assigneeId === meuId || adm) && trabalhoFeito.length > 0 && <button type="button" className="rt-secondary rt-danger" onClick={() => { fecharPainel(); setVoltarPara(trabalhoFeito[trabalhoFeito.length - 1]!.id); setPainel({ tipo: "ajustes" }); }}>Pedir ajustes</button>}
      {aberta && gestao && <button type="button" className="rt-secondary rt-add" onClick={() => { fecharPainel(); setPainel({ tipo: "etapa" }); }}>Adicionar etapa</button>}

      {painel && <form className="rt-form rt-panel" onSubmit={(event) => { event.preventDefault(); }}>
        {painel.tipo === "dispensar" && <>
          <h3>Dispensar “{etapaDoPainel?.title}”</h3><p className="rt-explainer">A tarefa segue sem esta etapa. O motivo fica no Registro.</p>
          <label>Motivo<textarea required rows={2} autoFocus value={motivo} onChange={(event) => setMotivo(event.target.value)}/></label>
          {erroPainel && <p className="rt-form-error" role="alert">{erroPainel}</p>}
          <footer><button type="button" className="rt-secondary" onClick={fecharPainel}>Cancelar</button><button type="button" className="rt-primary rt-danger-solid" disabled={saving || !motivo.trim()} onClick={() => void agir(`/api/tasks/${tarefaId}/steps/${painel.etapaId}/dispense`, "POST", { reason: motivo.trim() }, "Etapa dispensada.")}>{saving ? "Dispensando…" : "Dispensar etapa"}</button></footer>
        </>}
        {painel.tipo === "passar" && <>
          <h3>Passar “{etapaDoPainel?.title}” para outra pessoa</h3><p className="rt-explainer">A nova pessoa recebe o aviso se a etapa já estiver na vez dela. O motivo fica no Registro.</p>
          <label>Para quem<select required value={pessoaId} onChange={(event) => setPessoaId(event.target.value)}><option value="">Escolha uma pessoa</option>{pessoas.filter((pessoa) => (!pessoa.status || pessoa.status === "ACTIVE") && pessoa.id !== etapaDoPainel?.assigneeId).map((pessoa) => <option key={pessoa.id} value={pessoa.id}>{nomeDe(pessoa)}</option>)}</select></label>
          <label>Motivo<textarea required rows={2} value={motivo} onChange={(event) => setMotivo(event.target.value)}/></label>
          {erroPainel && <p className="rt-form-error" role="alert">{erroPainel}</p>}
          <footer><button type="button" className="rt-secondary" onClick={fecharPainel}>Cancelar</button><button type="button" className="rt-primary" disabled={saving || !pessoaId || !motivo.trim()} onClick={() => void agir(`/api/tasks/${tarefaId}/steps/${painel.etapaId}/reassign`, "POST", { assigneeId: pessoaId, reason: motivo.trim() }, "Etapa passada para a nova pessoa.")}>{saving ? "Passando…" : "Passar etapa"}</button></footer>
        </>}
        {painel.tipo === "ajustes" && <>
          <h3>Pedir ajustes</h3><p className="rt-explainer">A tarefa volta para a etapa que você escolher, e a pessoa dela é avisada.</p>
          <label>Voltar para<select required value={voltarPara} onChange={(event) => setVoltarPara(event.target.value)}>{trabalhoFeito.map((etapa) => <option key={etapa.id} value={etapa.id}>{etapa.title} · {etapa.assigneeName}</option>)}</select></label>
          <label>O que precisa mudar<textarea required rows={3} autoFocus value={motivo} onChange={(event) => setMotivo(event.target.value)}/></label>
          {erroPainel && <p className="rt-form-error" role="alert">{erroPainel}</p>}
          <footer><button type="button" className="rt-secondary" onClick={fecharPainel}>Cancelar</button><button type="button" className="rt-primary" disabled={saving || !voltarPara || !motivo.trim()} onClick={() => void agir(`/api/tasks/${tarefaId}/request-changes`, "POST", { comment: motivo.trim(), backToStepId: voltarPara }, "Ajustes pedidos. A pessoa da etapa foi avisada.")}>{saving ? "Enviando…" : "Pedir ajustes"}</button></footer>
        </>}
        {painel.tipo === "etapa" && <>
          <h3>Adicionar etapa</h3><p className="rt-explainer">A nova etapa entra no fim, antes de nada ser alterado nas que já foram feitas.</p>
          <label>Nome da etapa<input required autoFocus value={novaEtapa.title} onChange={(event) => setNovaEtapa({ ...novaEtapa, title: event.target.value })}/></label>
          <label>Quem faz<select required value={novaEtapa.assigneeId} onChange={(event) => setNovaEtapa({ ...novaEtapa, assigneeId: event.target.value })}><option value="">Escolha uma pessoa</option>{pessoas.filter((pessoa) => !pessoa.status || pessoa.status === "ACTIVE").map((pessoa) => <option key={pessoa.id} value={pessoa.id}>{nomeDe(pessoa)}</option>)}</select></label>
          <label>Tipo<select value={novaEtapa.kind} onChange={(event) => setNovaEtapa({ ...novaEtapa, kind: event.target.value as "WORK" | "APPROVAL" })}><option value="WORK">Trabalho</option><option value="APPROVAL">Aprovação</option></select></label>
          {erroPainel && <p className="rt-form-error" role="alert">{erroPainel}</p>}
          <footer><button type="button" className="rt-secondary" onClick={fecharPainel}>Cancelar</button><button type="button" className="rt-primary" disabled={saving || !novaEtapa.title.trim() || !novaEtapa.assigneeId} onClick={() => void agir(`/api/tasks/${tarefaId}/steps`, "POST", { title: novaEtapa.title.trim(), assigneeId: novaEtapa.assigneeId, kind: novaEtapa.kind }, "Etapa acrescentada.")}>{saving ? "Acrescentando…" : "Acrescentar etapa"}</button></footer>
        </>}
        {painel.tipo === "link" && <>
          <h3>Anexar link do Drive em “{etapaDoPainel?.title}”</h3><p className="rt-explainer">Só link do Google Drive: o app não guarda arquivo. Compartilhe o arquivo com quem precisa abrir.</p>
          <label>Link<input required type="url" inputMode="url" autoFocus value={link.url} onChange={(event) => setLink({ ...link, url: event.target.value })} onBlur={(event) => void conferirLink(event.target.value)} placeholder="https://drive.google.com/…"/></label>
          <label>O que é (opcional)<input value={link.descricao} onChange={(event) => setLink({ ...link, descricao: event.target.value })} placeholder="Ex.: Música final"/></label>
          {aviso && <p className="rt-drive-warn" role="status">{aviso}</p>}
          {erroPainel && <p className="rt-form-error" role="alert">{erroPainel}</p>}
          <footer><button type="button" className="rt-secondary" onClick={fecharPainel}>Cancelar</button><button type="button" className="rt-primary" disabled={saving || !link.url.trim()} onClick={anexar}>{saving ? "Anexando…" : "Anexar link"}</button></footer>
        </>}
      </form>}
    </div>}
    <footer className="rt-detail-footer"><button type="button" className="rt-secondary" onClick={() => { if (!saving) onFechar(); }}>Fechar</button></footer>
  </section></div>;
}
