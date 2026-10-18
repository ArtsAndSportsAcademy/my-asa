import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Check, Circle, MapPin, Pause, Pencil, Plus, RotateCcw, Trash2, UserPlus, Users, X } from "lucide-react";
import { ApiError, customFetch } from "@workspace/api-client-react";
import { useFecharComEsc } from "@/lib/fechar-com-esc";
import "./cadastros.css";
import "./operacoes.css";

type ShellRole = "adm" | "dir" | "sup" | "mem";
type Status = "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED";
type ItemChave = "GENERAL_DATA" | "VISUAL_IDENTITY" | "FIXED_TEAM" | "RESPONSIBILITIES" | "RELATED_MODULES";
type Item = { key: ItemChave; label: string; complete: boolean; message: string };
type Readiness = { ready: boolean; items: Item[]; blockers: Item[] };
type Operacao = {
  id: string; name: string; description: string | null; clientName: string | null; color: string; icon: string; status: Status;
  archivedAt: string | null; activatedAt: string | null; modulesReviewedAt: string | null; archivedReason: string | null;
  peopleCount: number; locationIds: string[]; readiness: Readiness;
};
type Local = { id: string; name: string; closed: boolean; operationId: string | null };
type Visao = { canManage: boolean; operations: Operacao[]; locations: Local[] };
type Pessoa = { id: string; name?: string; displayName?: string; fullName?: string; areaId?: string | null; status?: string; personStatus?: string; profile?: string | null; isAdmin?: boolean; operationIds?: string[]; supervisorOperationIds?: string[] };
type Painel =
  | { tipo: "form"; op?: Operacao }
  | { tipo: "check" | "locais" | "pessoas" | "ativar" | "encerrar" | "reabrir" | "pausar"; id: string };

const CORES = ["#6D4AFF", "#0E8F7E", "#C2410C", "#B42340", "#1D4ED8", "#4D7C0F"];
const ESTADO: Record<Status, { texto: string; classe: string }> = {
  DRAFT: { texto: "em configuração", classe: "afastada" },
  ACTIVE: { texto: "ativa", classe: "ativa" },
  PAUSED: { texto: "pausada", classe: "afastada" },
  ARCHIVED: { texto: "encerrada", classe: "encerrada" },
};
const FILTROS = [{ valor: "andamento", rotulo: "Em andamento" }, { valor: "encerradas", rotulo: "Encerradas" }, { valor: "todas", rotulo: "Todas" }] as const;

// A frase que o servidor mandou: `message`, ou `error` quando ele é uma frase (e não um código como INTERNAL_ERROR).
const mensagemDe = (err: unknown, padrao: string) => {
  if (!(err instanceof ApiError)) return padrao;
  const dados = err.data as { message?: unknown; error?: unknown } | null;
  if (typeof dados?.message === "string" && dados.message) return dados.message;
  return typeof dados?.error === "string" && dados.error.includes(" ") ? dados.error : padrao;
};
const normalizar = (valor: string) => valor.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR");
const dataCurta = (iso: string | null) => iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Sao_Paulo" }) : "";
const nomeDe = (p: Pessoa) => p.displayName ?? p.name ?? p.fullName ?? "Pessoa";
const perfilDe = (p: Pessoa) => p.profile === "DIR" ? "Direção" : p.profile === "ADM" || p.isAdmin ? "Administração" : p.profile === "SUP" || (p.supervisorOperationIds?.length ?? 0) > 0 ? "Supervisão" : p.profile === "MEM" ? "Elenco" : "";
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

// Dados de exemplo só existem no Vite local (?amostra=1); o build de produção descarta este bloco.
const amostra: Visao | null = import.meta.env.DEV ? {
  canManage: true,
  locations: [
    { id: "l1", name: "Parque A", closed: false, operationId: "o1" }, { id: "l2", name: "Parque B", closed: false, operationId: "o1" },
    { id: "l3", name: "Parque C", closed: false, operationId: null }, { id: "l4", name: "Parque D", closed: true, operationId: "o3" },
  ],
  operations: [
    { id: "o1", name: "Operação Neve", description: "Shows no parque de neve", clientName: "Parque A S.A.", color: "#6D4AFF", icon: "sparkles", status: "ACTIVE", archivedAt: null, activatedAt: null, modulesReviewedAt: "2026-10-01", archivedReason: null, peopleCount: 24, locationIds: ["l1", "l2"], readiness: { ready: true, blockers: [], items: [] } },
    { id: "o2", name: "Operação Águas", description: null, clientName: null, color: "#0E8F7E", icon: "sparkles", status: "DRAFT", archivedAt: null, activatedAt: null, modulesReviewedAt: null, archivedReason: null, peopleCount: 0, locationIds: [], readiness: { ready: false, get blockers() { return this.items.filter((i) => !i.complete); }, items: [{ key: "GENERAL_DATA", label: "Dados gerais e local", complete: false, message: "Falta informar a descrição; o empreendimento; pelo menos um local aberto ligado a esta operação." }, { key: "VISUAL_IDENTITY", label: "Identidade visual", complete: true, message: "Cor e ícone estão definidos." }, { key: "FIXED_TEAM", label: "Pessoas com acesso", complete: false, message: "Dê acesso a pelo menos uma pessoa." }, { key: "RESPONSIBILITIES", label: "Responsáveis", complete: false, message: "Crie pelo menos uma responsabilidade desta operação." }, { key: "RELATED_MODULES", label: "Módulos relacionados", complete: false, message: "Confira Escalas, Programação e Livros do Dia e marque como revisado." }] } },
    { id: "o3", name: "Operação Antiga", description: "Encerrada na virada", clientName: "Cliente X", color: "#B42340", icon: "sparkles", status: "ARCHIVED", archivedAt: "2026-08-30", activatedAt: null, modulesReviewedAt: null, archivedReason: "Contrato terminou em agosto.", peopleCount: 3, locationIds: ["l4"], readiness: { ready: false, blockers: [], items: [] } },
  ],
} : null;

// `fixo` não existe aqui: toda janela de Operações fecha com Esc, toque fora, × ou Cancelar.
function Dialog({ children, onClose, titulo }: { children: ReactNode; onClose: () => void; titulo: string }) {
  useFecharComEsc(onClose);
  return (
    <div className="cad-dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="cad-dialog op-dialog" role="dialog" aria-modal="true" aria-label={titulo} onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="cad-dialog-close" aria-label="Fechar" onClick={onClose}><X size={20} /></button>
        <h2>{titulo}</h2>
        {children}
      </section>
    </div>
  );
}

export default function OperacoesPage({ role }: { role: ShellRole }) {
  const review = import.meta.env.DEV && (new URLSearchParams(window.location.search).get("amostra") === "1" || window.sessionStorage.getItem("myasa-review-sample") === "1");
  const [, navegar] = useLocation();
  const [visao, setVisao] = useState<Visao | null>(null), [carregando, setCarregando] = useState(true), [erro, setErro] = useState("");
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]["valor"]>("andamento");
  const [painel, setPainel] = useState<Painel | null>(null), [retorno, setRetorno] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false), [erroPainel, setErroPainel] = useState("");

  const carregar = async () => {
    setCarregando(true); setErro("");
    if (review && amostra) { setVisao(amostra); setCarregando(false); return; }
    try { setVisao(await customFetch<Visao>("/api/operations/overview")); }
    catch (err) { setErro(mensagemDe(err, "Não consegui carregar as operações agora. Nada foi perdido; tente de novo.")); }
    finally { setCarregando(false); }
  };
  useEffect(() => { void carregar(); }, [review]);
  useEffect(() => { setErroPainel(""); }, [painel]);

  const pode = role === "adm" && Boolean(visao?.canManage);
  const operacoes = visao?.operations ?? [];
  const nomeDoLocal = (id: string) => visao?.locations.find((l) => l.id === id);
  const visiveis = useMemo(() => operacoes.filter((op) => filtro === "todas" || (filtro === "encerradas" ? op.status === "ARCHIVED" : op.status !== "ARCHIVED")), [operacoes, filtro]);
  const operacaoDe = (id: string) => operacoes.find((op) => op.id === id);
  const ativas = operacoes.filter((op) => op.status === "ACTIVE").length;

  const abrir = (proximo: Painel, voltarPara: string | null = null) => { setRetorno(voltarPara); setPainel(proximo); };
  const fechar = () => {
    if (salvando) return;
    if (retorno) { setPainel({ tipo: "check", id: retorno }); setRetorno(null); } else setPainel(null);
  };
  const concluir = async () => { setPainel(null); setRetorno(null); await carregar(); };
  // Salva e, se a janela veio do checklist, volta a ele já com o item atualizado.
  const salvarEVoltar = async () => { await carregar(); if (retorno) { setPainel({ tipo: "check", id: retorno }); setRetorno(null); } else setPainel(null); };

  const mudarSituacao = async (op: Operacao, status: Status, motivo?: string) => {
    if (review) { await concluir(); return; }
    setSalvando(true); setErroPainel("");
    try {
      await customFetch(`/api/operations/${op.id}/status`, { method: "PATCH", body: JSON.stringify({ status, reason: motivo || undefined }) });
      await concluir();
    } catch (err) {
      setErroPainel(mensagemDe(err, "Não consegui mudar a situação da operação agora. Nada foi alterado; tente de novo."));
      // O servidor pode ter recusado por checklist: a lista mostrada precisa ser a de agora.
      void carregar();
    } finally { setSalvando(false); }
  };

  const textoVazio = filtro === "encerradas" ? "Nenhuma operação encerrada." : operacoes.length ? "Nenhuma operação em andamento." : "Nenhuma operação cadastrada ainda.";
  const op = painel && painel.tipo !== "form" ? operacaoDe(painel.id) : undefined;

  return (
    <section className="cad-page op-page">
      <div className="cad-toolbar">
        <p>{role === "dir" ? "Somente leitura" : "Cadastro da operação"}</p>
        {pode && <div className="cad-toolbar-actions"><button type="button" className="cad-primary" onClick={() => abrir({ tipo: "form" })}><Plus size={17} />Nova operação</button></div>}
      </div>
      <div className="cad-note op-explica">Uma operação reúne locais, pessoas e responsáveis. A Escala, os shows e a Programação de um local seguem a operação dele{role === "dir" ? "." : "; por isso uma operação só pode ser ativada depois de ter local, pessoas e responsável."}</div>
      <div className="cad-status-filters" role="group" aria-label="Situação das operações">
        {FILTROS.map((f) => <button key={f.valor} type="button" className={filtro === f.valor ? "active" : ""} aria-pressed={filtro === f.valor} onClick={() => setFiltro(f.valor)}>{f.rotulo}</button>)}
      </div>
      {erro && <div className="cad-error" role="alert">{erro}<button type="button" onClick={() => void carregar()}>Tentar de novo</button></div>}
      {carregando && !visao ? <div className="cad-skeletons" aria-busy="true"><i /><i /></div> : (
        <div className="cad-grid op-grid">
          {visiveis.map((operacao) => {
            const locais = operacao.locationIds.map(nomeDoLocal).filter((l): l is Local => Boolean(l));
            const abertos = locais.filter((l) => !l.closed).length;
            const prontos = operacao.readiness.items.filter((i) => i.complete).length;
            const emConfiguracao = operacao.status === "DRAFT" || operacao.status === "PAUSED";
            return (
              <article className="cad-card op-card" key={operacao.id} style={{ ["--op-cor" as string]: operacao.color }}>
                <header>
                  <span className="cad-icon op-cor" aria-hidden="true"><Users size={19} /></span>
                  <div><h2>{operacao.name}</h2><p>{operacao.clientName ?? "Empreendimento não informado"}</p></div>
                  <span className={`cad-state ${ESTADO[operacao.status].classe}`}>{ESTADO[operacao.status].texto}</span>
                </header>
                <div className="cad-location-info">
                  {operacao.description && <span>{operacao.description}</span>}
                  <span className="op-locais"><MapPin size={14} />{locais.length ? locais.map((l) => l.closed ? `${l.name} (encerrado)` : l.name).join(" · ") : "Nenhum local ligado"}</span>
                  {operacao.status !== "ARCHIVED" && abertos === 0 && <span className="op-alerta" role="status">{operacao.status === "ACTIVE" ? "Sem nenhum local aberto: a Escala e os shows desta operação não têm onde abrir. Ligue um local ou reabra um dos encerrados." : "Sem local aberto ainda: a operação só pode ser ativada com pelo menos um."}</span>}
                  <span><Users size={14} /> {plural(operacao.peopleCount, "pessoa com acesso", "pessoas com acesso")}</span>
                  {emConfiguracao && operacao.readiness.items.length > 0 && <span>{prontos} de {operacao.readiness.items.length} itens do checklist prontos</span>}
                  {operacao.status === "ARCHIVED" && <span>Encerrada em {dataCurta(operacao.archivedAt)}. {operacao.archivedReason ? `Motivo: ${operacao.archivedReason}` : "Motivo no Registro."}</span>}
                </div>
                {(pode || (emConfiguracao && operacao.status !== "ARCHIVED")) && <footer className="op-footer">
                  {operacao.status === "ARCHIVED" ? (
                    pode ? <button type="button" onClick={() => abrir({ tipo: "reabrir", id: operacao.id })}><RotateCcw size={15} />Reabrir</button> : null
                  ) : (
                    <>
                      {pode && <button type="button" onClick={() => abrir({ tipo: "form", op: operacao })}><Pencil size={15} />Editar</button>}
                      {pode && <button type="button" onClick={() => abrir({ tipo: "locais", id: operacao.id })}><MapPin size={15} />Locais</button>}
                      {pode && <button type="button" onClick={() => abrir({ tipo: "pessoas", id: operacao.id })}><UserPlus size={15} />Pessoas</button>}
                      {emConfiguracao && <button type="button" onClick={() => abrir({ tipo: "check", id: operacao.id })}><Check size={15} />{pode ? (operacao.status === "PAUSED" ? "Checklist e reativar" : "Checklist e ativar") : "Ver checklist"}</button>}
                      {pode && operacao.status === "ACTIVE" && <button type="button" onClick={() => abrir({ tipo: "pausar", id: operacao.id })}><Pause size={15} />Pausar</button>}
                      {pode && <button type="button" className="cad-danger-link" onClick={() => abrir({ tipo: "encerrar", id: operacao.id })}><Trash2 size={15} />Encerrar</button>}
                    </>
                  )}
                </footer>}
              </article>
            );
          })}
        </div>
      )}
      {!carregando && !erro && visiveis.length === 0 && (
        <div className="cad-empty"><Users size={26} /><strong>{textoVazio}</strong><span>{pode ? "Comece pelo botão “Nova operação”: ela nasce em configuração e só aparece para as pessoas depois de ativada." : "Quando houver uma operação, ela aparece aqui."}</span></div>
      )}

      {painel?.tipo === "form" && <FormOperacao op={painel.op} salvando={salvando} erro={erroPainel} onClose={fechar} onSave={async (dados) => {
        if (review) { await concluir(); return; }
        setSalvando(true); setErroPainel("");
        try {
          if (painel.op) { await customFetch(`/api/operations/${painel.op.id}`, { method: "PATCH", body: JSON.stringify(dados) }); await salvarEVoltar(); }
          else {
            const criada = await customFetch<{ operation: { id: string } }>("/api/operations", { method: "POST", body: JSON.stringify(dados) });
            await carregar(); setRetorno(null); setPainel({ tipo: "check", id: criada.operation.id });
          }
        } catch (err) { setErroPainel(mensagemDe(err, "Não consegui salvar a operação. Confira os campos e tente de novo.")); } finally { setSalvando(false); }
      }} />}

      {painel?.tipo === "check" && op && <Checklist op={op} pode={pode} onClose={fechar}
        onEditar={() => abrir({ tipo: "form", op }, op.id)} onLocais={() => abrir({ tipo: "locais", id: op.id }, op.id)} onPessoas={() => abrir({ tipo: "pessoas", id: op.id }, op.id)}
        onResponsabilidades={() => { setPainel(null); navegar("/responsabilidades"); }}
        onRevisao={async (revisado) => {
          if (review) return;
          setSalvando(true); setErroPainel("");
          try { await customFetch(`/api/operations/${op.id}/setup-review`, { method: "PATCH", body: JSON.stringify({ reviewed: revisado }) }); await carregar(); }
          catch (err) { setErroPainel(mensagemDe(err, "Não consegui marcar a revisão agora. Tente de novo.")); } finally { setSalvando(false); }
        }}
        onAtivar={() => abrir({ tipo: "ativar", id: op.id }, op.id)} salvando={salvando} erro={erroPainel} />}

      {painel?.tipo === "locais" && op && visao && <LocaisDaOperacao op={op} locais={visao.locations} operacoes={operacoes} salvando={salvando} erro={erroPainel} onClose={fechar}
        onNovoLocal={() => { setPainel(null); navegar("/locais"); }}
        onSave={async (ids) => {
          if (review) { await salvarEVoltar(); return; }
          setSalvando(true); setErroPainel("");
          try { await customFetch(`/api/operations/${op.id}/locations`, { method: "PUT", body: JSON.stringify({ locationIds: ids }) }); await salvarEVoltar(); }
          catch (err) { setErroPainel(mensagemDe(err, "Não consegui salvar os locais agora. Nada foi alterado; tente de novo.")); } finally { setSalvando(false); }
        }} />}

      {painel?.tipo === "pessoas" && op && <PessoasDaOperacao op={op} review={review} salvando={salvando} erro={erroPainel} onClose={fechar}
        onSave={async (ids) => {
          if (review) { await salvarEVoltar(); return null; }
          setSalvando(true); setErroPainel("");
          try {
            const r = await customFetch<{ liberadas: string[]; jaTinham: string[]; semPerfil: string[] }>(`/api/operations/${op.id}/access`, { method: "POST", body: JSON.stringify({ userIds: ids }) });
            await carregar(); return r;
          } catch (err) { setErroPainel(mensagemDe(err, "Não consegui dar o acesso agora. Nada foi alterado; tente de novo.")); return null; } finally { setSalvando(false); }
        }}
        onConcluir={salvarEVoltar} />}

      {painel?.tipo === "ativar" && op && (
        <Dialog titulo={op.status === "PAUSED" ? `Reativar ${op.name}?` : `Ativar ${op.name}?`} onClose={fechar}>
          <p>Todos os itens do checklist estão prontos. Ao ativar, {op.name} passa a valer: a Escala, os shows e a Programação dos locais dela abrem, e toda pessoa ativa da casa ganha nela o mesmo perfil que já tem. A Administração, a Direção e a Supervisão são avisadas. Dá para pausar ou encerrar depois, com Registro.</p>
          <div className="cad-form"><span />
            {erroPainel && <p className="cad-error" role="alert">{erroPainel}</p>}
            <footer><button type="button" onClick={fechar}>Cancelar</button><button type="button" className="cad-primary" disabled={salvando} onClick={() => void mudarSituacao(op, "ACTIVE")}>{salvando ? "Ativando…" : "Ativar agora"}</button></footer>
          </div>
        </Dialog>
      )}

      {painel?.tipo === "pausar" && op && <Motivo titulo={`Pausar ${op.name}`} botao="Pausar" ocupado="Pausando…" obrigatorio={false} salvando={salvando} erro={erroPainel} onClose={fechar} onConfirm={(m) => mudarSituacao(op, "PAUSED", m)}
        texto={`A operação sai das telas de quem trabalha nela até ser reativada. Locais, pessoas e histórico continuam como estão. ${ativas <= 1 ? "Atenção: é a única operação ativa, e o servidor não deixa a casa sem operação ativa." : ""}`} dica="Ex.: pausa de baixa temporada" />}

      {painel?.tipo === "encerrar" && op && <Motivo titulo={`Encerrar ${op.name}`} botao="Encerrar operação" ocupado="Encerrando…" obrigatorio perigo salvando={salvando} erro={erroPainel} onClose={fechar} onConfirm={(m) => mudarSituacao(op, "ARCHIVED", m)}
        texto={`Nada é apagado: ${plural(op.locationIds.length, "local fica ligado", "locais ficam ligados")}, ${plural(op.peopleCount, "pessoa mantém", "pessoas mantêm")} o vínculo e o histórico continua no Registro. A operação some das listas de uso e dá para reabri-la depois, com motivo. A Administração, a Direção e a Supervisão são avisadas.${ativas <= 1 && op.status === "ACTIVE" ? " Atenção: é a única operação ativa, e o servidor não deixa a casa sem operação ativa." : ""}`} dica="Ex.: contrato terminou" />}

      {painel?.tipo === "reabrir" && op && <Motivo titulo={`Reabrir ${op.name}`} botao="Reabrir" ocupado="Reabrindo…" obrigatorio salvando={salvando} erro={erroPainel} onClose={fechar} onConfirm={(m) => mudarSituacao(op, "DRAFT", m)}
        texto="A operação volta como “em configuração”, com os locais e as pessoas que tinha. Para voltar a valer, passe de novo pelo checklist e ative. A Administração, a Direção e a Supervisão são avisadas." dica="Ex.: voltou a ter contrato" />}
    </section>
  );
}

function FormOperacao({ op, salvando, erro, onClose, onSave }: { op?: Operacao; salvando: boolean; erro: string; onClose: () => void; onSave: (dados: Record<string, string>) => void | Promise<void> }) {
  const [cor, setCor] = useState(op?.color ?? CORES[0]!);
  const enviar = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (salvando) return;
    const f = new FormData(event.currentTarget);
    void onSave({ name: String(f.get("name") ?? "").trim(), description: String(f.get("description") ?? "").trim(), clientName: String(f.get("clientName") ?? "").trim(), color: cor });
  };
  return (
    <Dialog titulo={op ? `Editar ${op.name}` : "Nova operação"} onClose={salvando ? () => undefined : onClose}>
      <p>{op ? "O nome aparece para todo mundo que trabalha nesta operação." : "A operação nasce em configuração. Depois de salvar, o checklist mostra o que falta para ativá-la."}</p>
      <form className="cad-form" onSubmit={enviar}>
        <label>Nome<input name="name" required maxLength={80} defaultValue={op?.name ?? ""} placeholder="Ex.: Parque das Águas" /></label>
        <label>Empreendimento<input name="clientName" defaultValue={op?.clientName ?? ""} placeholder="Para quem a ASA trabalha" /><small>Obrigatório para ativar.</small></label>
        <label>Descrição<textarea name="description" defaultValue={op?.description ?? ""} placeholder="O que a ASA faz nesta operação" /><small>Obrigatória para ativar.</small></label>
        <fieldset className="op-cores"><legend>Cor</legend>
          {CORES.map((c) => <label key={c} className={cor === c ? "on" : ""} style={{ ["--op-cor" as string]: c }}><input type="radio" name="cor" value={c} checked={cor === c} onChange={() => setCor(c)} /><span className="visually-hidden">{c}</span></label>)}
        </fieldset>
        {erro && <p className="cad-error" role="alert">{erro}</p>}
        <footer><button type="button" onClick={onClose} disabled={salvando}>Cancelar</button><button className="cad-primary" disabled={salvando}>{salvando ? "Salvando…" : op ? "Salvar" : "Criar operação"}</button></footer>
      </form>
    </Dialog>
  );
}

function Checklist({ op, pode, salvando, erro, onClose, onEditar, onLocais, onPessoas, onResponsabilidades, onRevisao, onAtivar }: {
  op: Operacao; pode: boolean; salvando: boolean; erro: string; onClose: () => void; onEditar: () => void; onLocais: () => void; onPessoas: () => void;
  onResponsabilidades: () => void; onRevisao: (revisado: boolean) => void | Promise<void>; onAtivar: () => void;
}) {
  const faltam = op.readiness.blockers.length;
  const acao = (item: Item): ReactNode => {
    if (!pode) return null;
    if (item.key === "GENERAL_DATA") return <><button type="button" onClick={onEditar}>Editar dados</button><button type="button" onClick={onLocais}>Ligar locais</button></>;
    if (item.key === "FIXED_TEAM") return <button type="button" onClick={onPessoas}>Dar acesso</button>;
    if (item.key === "RESPONSIBILITIES") return <button type="button" onClick={onResponsabilidades}>Abrir Responsabilidades</button>;
    if (item.key === "RELATED_MODULES") return <button type="button" disabled={salvando} onClick={() => void onRevisao(!item.complete)}>{item.complete ? "Desmarcar revisão" : "Marcar como revisado"}</button>;
    return <button type="button" onClick={onEditar}>Escolher cor</button>;
  };
  return (
    <Dialog titulo={`Checklist de ${op.name}`} onClose={onClose}>
      <p>{faltam === 0 ? "Tudo pronto. A operação pode ser ativada." : `Falta${faltam === 1 ? "" : "m"} ${faltam} ${faltam === 1 ? "item" : "itens"} para poder ativar. Cada um mostra a regra e onde resolver.`}</p>
      <ol className="op-check">
        {op.readiness.items.map((item) => (
          <li key={item.key} className={item.complete ? "pronto" : "falta"}>
            <span className="op-check-icone" aria-hidden="true">{item.complete ? <Check size={16} /> : <Circle size={14} />}</span>
            <div><strong>{item.label}<span className="visually-hidden">{item.complete ? " — pronto" : " — falta"}</span></strong><p>{item.message}</p>{!item.complete || item.key === "RELATED_MODULES" ? <div className="op-check-acoes">{acao(item)}</div> : null}</div>
          </li>
        ))}
      </ol>
      {erro && <p className="cad-error" role="alert">{erro}</p>}
      <footer className="cad-form-footer op-rodape">
        <button type="button" className="op-sec" onClick={onClose}>Fechar</button>
        {pode && <button type="button" className="cad-primary" disabled={faltam > 0 || salvando} onClick={onAtivar}>{faltam > 0 ? `${faltam === 1 ? "Falta" : "Faltam"} ${faltam} para ativar` : op.status === "PAUSED" ? "Reativar…" : "Ativar…"}</button>}
      </footer>
    </Dialog>
  );
}

function LocaisDaOperacao({ op, locais, operacoes, salvando, erro, onClose, onSave, onNovoLocal }: {
  op: Operacao; locais: Local[]; operacoes: Operacao[]; salvando: boolean; erro: string; onClose: () => void; onSave: (ids: string[]) => void | Promise<void>; onNovoLocal: () => void;
}) {
  const meus = locais.filter((l) => l.operationId === op.id);
  const [marcados, setMarcados] = useState<string[]>(meus.filter((l) => !l.closed).map((l) => l.id));
  const abertosAntes = meus.filter((l) => !l.closed).map((l) => l.id);
  const liberados = locais.filter((l) => !l.closed && l.operationId === null);
  const deOutras = locais.filter((l) => l.operationId && l.operationId !== op.id);
  const encerrados = meus.filter((l) => l.closed);
  const tirando = abertosAntes.filter((id) => !marcados.includes(id));
  const ficaSemLocal = op.status === "ACTIVE" && marcados.length === 0;
  const alternar = (id: string) => setMarcados((atual) => atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]);
  const mudou = marcados.length !== abertosAntes.length || tirando.length > 0;
  return (
    <Dialog titulo={`Locais de ${op.name}`} onClose={salvando ? () => undefined : onClose}>
      <p>Um local pertence a uma operação só. Marque os locais que seguem a regra de {op.name}.</p>
      <form className="cad-form" onSubmit={(event) => { event.preventDefault(); if (!salvando && mudou && !ficaSemLocal) void onSave(marcados); }}>
        {[...meus.filter((l) => !l.closed), ...liberados].length === 0 && <p className="cad-form-note">Nenhum local livre. Cadastre um em Locais e volte aqui.</p>}
        <div className="op-lista">
          {[...meus.filter((l) => !l.closed), ...liberados].map((l) => (
            <label key={l.id} className="op-opcao"><input type="checkbox" checked={marcados.includes(l.id)} onChange={() => alternar(l.id)} /><span>{l.name}{l.operationId === null && <small> · sem operação</small>}</span></label>
          ))}
          {encerrados.map((l) => <label key={l.id} className="op-opcao off"><input type="checkbox" checked disabled /><span>{l.name}<small> · local encerrado; continua ligado para voltar junto se reabrir</small></span></label>)}
          {deOutras.map((l) => <label key={l.id} className="op-opcao off"><input type="checkbox" disabled /><span>{l.name}<small> · já é de {operacoes.find((o) => o.id === l.operationId)?.name ?? "outra operação"}</small></span></label>)}
        </div>
        {tirando.length > 0 && <p className="cad-form-note op-aviso">Locais desmarcados ficam sem operação até serem ligados a outra: a Escala e os shows deles não abrem nesse meio-tempo. Nada é apagado.</p>}
        {ficaSemLocal && <p className="cad-error" role="alert">{op.name} está ativa e ficaria sem nenhum local aberto. Marque outro local antes de tirar este, ou encerre a operação.</p>}
        {erro && <p className="cad-error" role="alert">{erro}</p>}
        <button type="button" className="op-link" onClick={onNovoLocal}>Cadastrar um local novo →</button>
        <footer><button type="button" onClick={onClose} disabled={salvando}>Cancelar</button><button className="cad-primary" disabled={salvando || !mudou || ficaSemLocal}>{salvando ? "Salvando…" : "Salvar locais"}</button></footer>
      </form>
    </Dialog>
  );
}

function PessoasDaOperacao({ op, review, salvando, erro, onClose, onSave, onConcluir }: {
  op: Operacao; review: boolean; salvando: boolean; erro: string; onClose: () => void;
  onSave: (ids: string[]) => Promise<{ liberadas: string[]; jaTinham: string[]; semPerfil: string[] } | null>; onConcluir: () => void | Promise<void>;
}) {
  const [pessoas, setPessoas] = useState<Pessoa[] | null>(null), [areas, setAreas] = useState<Record<string, string>>({}), [falha, setFalha] = useState("");
  const [busca, setBusca] = useState(""), [marcadas, setMarcadas] = useState<string[]>([]), [resultado, setResultado] = useState<{ liberadas: string[]; jaTinham: string[]; semPerfil: string[] } | null>(null);
  useEffect(() => {
    if (review) { setPessoas([]); return; }
    let vivo = true;
    Promise.all([customFetch<{ users?: Pessoa[] }>("/api/users"), customFetch<{ areas?: { id: string; name: string }[] }>("/api/areas?includeInactive=true").catch(() => ({ areas: [] }))])
      .then(([u, a]) => { if (!vivo) return; setPessoas(u.users ?? []); setAreas(Object.fromEntries((a.areas ?? []).map((x) => [x.id, x.name]))); })
      .catch((err) => { if (vivo) setFalha(mensagemDe(err, "Não consegui carregar as pessoas agora. Tente de novo.")); });
    return () => { vivo = false; };
  }, [review]);
  const candidatas = useMemo(() => (pessoas ?? []).filter((p) => (!p.status || p.status === "ACTIVE") && p.personStatus !== "LEFT" && p.personStatus !== "ARCHIVED" && !(p.operationIds ?? []).includes(op.id) && (!busca || normalizar(`${nomeDe(p)} ${p.fullName ?? ""}`).includes(normalizar(busca)))), [pessoas, busca, op.id]);
  const marcaveis = candidatas.filter((p) => perfilDe(p));
  const alternar = (id: string) => setMarcadas((atual) => atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]);
  if (resultado) {
    return (
      <Dialog titulo="Acesso dado" onClose={() => void onConcluir()}>
        <p>{plural(resultado.liberadas.length, "pessoa agora tem", "pessoas agora têm")} acesso a {op.name}{op.status === "ACTIVE" ? " e foi avisada no sino" : ", e só vê a operação depois que ela for ativada"}.{resultado.jaTinham.length ? ` ${plural(resultado.jaTinham.length, "já tinha", "já tinham")} o acesso.` : ""}</p>
        {resultado.semPerfil.length > 0 && <p className="cad-error" role="alert">Ficaram de fora por não terem perfil: {resultado.semPerfil.join(", ")}. Defina o perfil em Pessoas e acessos.</p>}
        <footer className="cad-form-footer"><button type="button" className="cad-primary" onClick={() => void onConcluir()}>Pronto</button></footer>
      </Dialog>
    );
  }
  return (
    <Dialog titulo={`Pessoas de ${op.name}`} onClose={salvando ? () => undefined : onClose}>
      <p>Cada pessoa marcada ganha, nesta operação, o mesmo perfil que já tem na casa (Elenco continua Elenco, Supervisão continua Supervisão).{op.status === "ACTIVE" ? " Como a operação está ativa, elas são avisadas." : ""}</p>
      <form className="cad-form" onSubmit={async (event) => { event.preventDefault(); if (salvando || !marcadas.length) return; const r = await onSave(marcadas); if (r) setResultado(r); }}>
        <div className="cad-search"><input aria-label="Buscar pessoa" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar pessoa" /></div>
        {falha ? <p className="cad-error" role="alert">{falha}</p> : !pessoas ? <p className="cad-form-note" aria-busy="true">Carregando pessoas…</p> : candidatas.length === 0 ? <p className="cad-form-note">{busca ? "Ninguém com esse nome sem acesso." : "Todas as pessoas ativas já têm acesso a esta operação."}</p> : (
          <>
            <div className="op-lote"><span>{marcadas.length ? plural(marcadas.length, "pessoa marcada", "pessoas marcadas") : "Marque as pessoas."}</span><button type="button" onClick={() => setMarcadas(marcaveis.map((p) => p.id))}>Marcar todas da lista</button><button type="button" onClick={() => setMarcadas([])}>Limpar</button></div>
            <div className="op-lista">
              {candidatas.map((p) => (
                <label key={p.id} className={`op-opcao${perfilDe(p) ? "" : " off"}`}><input type="checkbox" disabled={!perfilDe(p)} checked={marcadas.includes(p.id)} onChange={() => alternar(p.id)} /><span>{nomeDe(p)}<small> · {perfilDe(p) ? `${perfilDe(p)}${p.areaId && areas[p.areaId] ? ` · ${areas[p.areaId]}` : ""}` : "sem perfil — defina em Pessoas e acessos"}</small></span></label>
              ))}
            </div>
          </>
        )}
        {erro && <p className="cad-error" role="alert">{erro}</p>}
        <footer><button type="button" onClick={onClose} disabled={salvando}>Cancelar</button><button className="cad-primary" disabled={salvando || !marcadas.length}>{salvando ? "Dando acesso…" : marcadas.length ? `Dar acesso a ${marcadas.length}` : "Dar acesso"}</button></footer>
      </form>
    </Dialog>
  );
}

function Motivo({ titulo, texto, dica, botao, ocupado, obrigatorio, perigo = false, salvando, erro, onClose, onConfirm }: {
  titulo: string; texto: string; dica: string; botao: string; ocupado: string; obrigatorio: boolean; perigo?: boolean; salvando: boolean; erro: string; onClose: () => void; onConfirm: (motivo: string) => void | Promise<void>;
}) {
  return (
    <Dialog titulo={titulo} onClose={salvando ? () => undefined : onClose}>
      <p>{texto}</p>
      <form className="cad-form" onSubmit={(event) => { event.preventDefault(); if (salvando) return; void onConfirm(String(new FormData(event.currentTarget).get("reason") ?? "").trim()); }}>
        <label>{obrigatorio ? "Motivo" : "Motivo (opcional)"}<textarea name="reason" required={obrigatorio} placeholder={dica} /></label>
        {erro && <p className="cad-error" role="alert">{erro}</p>}
        <footer><button type="button" onClick={onClose} disabled={salvando}>Cancelar</button><button className={perigo ? "cad-danger" : "cad-primary"} disabled={salvando}>{salvando ? ocupado : botao}</button></footer>
      </form>
    </Dialog>
  );
}
