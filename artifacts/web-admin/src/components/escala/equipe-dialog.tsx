import { useEffect, useId, useMemo, useState } from "react";
import { X } from "lucide-react";
import { ApiError, customFetch } from "@workspace/api-client-react";
import { useFecharComEsc } from "@/lib/fechar-com-esc";
import "./equipe-dialog.css";

/* ---------- modelo ---------- */
type Janela = { inicio: string | null; fim: string | null };
type Grade = Record<string, Record<number, Janela[]>>;
type PessoaDaEquipe = { id: string; nome: string; areaId: string | null; areaNome: string | null };
type LinhaDaApi = { userId: string; weekday: number; inicio: string | null; fim: string | null };
type TelaDaEquipe = { equipe: LinhaDaApi[]; versao: string | null; pessoas: PessoaDaEquipe[]; podeEditar?: boolean };
type SugestaoDaApi = { janela: { de: string; ate: string }; escalasLidas: number; semHistorico: boolean; sugestoes: { userId: string; nome: string; dias: { weekday: number; vezes: number; de: number; jaMarcado: boolean }[]; frase: string }[] };

/** A semana começa na segunda; o servidor guarda 0 = domingo … 6 = sábado. */
const DIAS = [{ w: 1, curto: "Seg", longo: "segunda" }, { w: 2, curto: "Ter", longo: "terça" }, { w: 3, curto: "Qua", longo: "quarta" }, { w: 4, curto: "Qui", longo: "quinta" }, { w: 5, curto: "Sex", longo: "sexta" }, { w: 6, curto: "Sáb", longo: "sábado" }, { w: 0, curto: "Dom", longo: "domingo" }];
const hhmm = (t: string | null | undefined) => (t ? t.slice(0, 5) : null);
const TODOS_OS_DIAS = [1, 2, 3, 4, 5, 6, 0], DIAS_UTEIS = [1, 2, 3, 4, 5], FIM_DE_SEMANA = [6, 0];

const gradeDe = (linhas: LinhaDaApi[]): Grade => {
  const g: Grade = {};
  for (const l of linhas) ((g[l.userId] ??= {})[l.weekday] ??= []).push({ inicio: hhmm(l.inicio), fim: hhmm(l.fim) });
  return g;
};
const linhasDe = (g: Grade): LinhaDaApi[] => Object.entries(g).flatMap(([userId, dias]) => Object.entries(dias).flatMap(([w, janelas]) => janelas.map((j) => ({ userId, weekday: Number(w), inicio: j.inicio || null, fim: j.fim || null }))));
const chaveDaLinha = (l: LinhaDaApi) => `${l.userId}|${l.weekday}|${l.inicio ?? ""}|${l.fim ?? ""}`;
const textoDaJanela = (j: Janela) => j.inicio && j.fim ? `${j.inicio}–${j.fim}` : j.inicio ? `a partir de ${j.inicio}` : j.fim ? `até ${j.fim}` : "dia inteiro";
const janelaInvalida = (j: Janela) => Boolean(j.inicio && j.fim && j.fim <= j.inicio);
const frase = (err: unknown, padrao: string) => {
  if (!(err instanceof ApiError)) return "Não consegui falar com o servidor agora. Nada foi alterado: confira a conexão e tente de novo.";
  const dados = err.data as { message?: unknown } | null;
  return typeof dados?.message === "string" && dados.message ? dados.message : padrao;
};

type Props = {
  programacaoId: string; programacaoNome: string; vigencia: string; localName: string; review: boolean;
  /** No modo de amostra não há servidor: a lista de pessoas vem da amostra e nada é gravado. */
  pessoasDaAmostra?: PessoaDaEquipe[]; editavelNaAmostra?: boolean;
  onClose: () => void; onSaved: () => void;
};

/**
 * A equipe de um local na Programação (pacote O): quem trabalha aqui, em que dias da semana e, se a pessoa divide o dia entre locais, de que hora
 * a que hora. A grade inteira vai de uma vez, com a versão que a tela abriu; o que sai fica guardado (nunca é apagado). Quem não tem nenhuma marca
 * em lugar nenhum segue entrando em tudo, como antes.
 */
export function EquipeDialog({ programacaoId, programacaoNome, vigencia, localName, review, pessoasDaAmostra, editavelNaAmostra, onClose, onSaved }: Props) {
  const id = useId();
  const [carregando, setCarregando] = useState(!review);
  const [pessoas, setPessoas] = useState<PessoaDaEquipe[]>(review ? pessoasDaAmostra ?? [] : []);
  const [podeEditar, setPodeEditar] = useState(review ? editavelNaAmostra ?? true : false);
  const [versao, setVersao] = useState<string | null>(null);
  const [original, setOriginal] = useState<LinhaDaApi[]>([]);
  const [grade, setGrade] = useState<Grade>({});
  const [busca, setBusca] = useState(""), [areaId, setAreaId] = useState("");
  const [marcadas, setMarcadas] = useState<string[]>([]);
  const [diasDoLote, setDiasDoLote] = useState<number[]>(DIAS_UTEIS);
  const [aberta, setAberta] = useState<string | null>(null);
  const [sugestao, setSugestao] = useState<SugestaoDaApi | null>(null), [pedindoSugestao, setPedindoSugestao] = useState(false);
  const [saving, setSaving] = useState(false), [erro, setErro] = useState(""), [aviso, setAviso] = useState("");
  const [descartando, setDescartando] = useState(false);

  const carregar = (r: TelaDaEquipe) => { setPessoas(r.pessoas); setVersao(r.versao); setOriginal(r.equipe.map((l) => ({ ...l, inicio: hhmm(l.inicio), fim: hhmm(l.fim) }))); setGrade(gradeDe(r.equipe)); setMarcadas([]); };
  useEffect(() => {
    if (review) return;
    let vivo = true;
    customFetch<TelaDaEquipe>(`/api/programacoes/${programacaoId}/equipe`)
      .then((r) => { if (vivo) { setPodeEditar(r.podeEditar === true); carregar(r); } })
      .catch((err) => { if (vivo) setErro(frase(err, "Não consegui abrir a equipe agora. Tente de novo.")); })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [review, programacaoId]);

  const linhas = useMemo(() => linhasDe(grade), [grade]);
  const mudancas = useMemo(() => {
    const antes = new Set(original.map(chaveDaLinha)), depois = new Set(linhas.map(chaveDaLinha));
    return { entram: [...depois].filter((k) => !antes.has(k)).length, saem: [...antes].filter((k) => !depois.has(k)).length };
  }, [original, linhas]);
  const total = mudancas.entram + mudancas.saem;
  const algumaInvalida = linhas.some((l) => janelaInvalida(l));
  const nomeDe = useMemo(() => new Map(pessoas.map((p) => [p.id, p.nome])), [pessoas]);
  const areas = useMemo(() => [...new Map(pessoas.filter((p) => p.areaId).map((p) => [p.areaId!, p.areaNome ?? ""])).entries()].sort((a, b) => a[1].localeCompare(b[1], "pt-BR")), [pessoas]);
  const listadas = useMemo(() => pessoas.filter((p) => (!areaId || p.areaId === areaId) && (!busca.trim() || p.nome.toLocaleLowerCase("pt-BR").includes(busca.trim().toLocaleLowerCase("pt-BR")))), [pessoas, areaId, busca]);
  const comMarca = (userId: string) => Object.values(grade[userId] ?? {}).some((j) => j.length > 0);
  const quantasPessoas = pessoas.filter((p) => comMarca(p.id)).length;

  const tentarFechar = () => { if (saving) return; if (total > 0 && !descartando) { setDescartando(true); return; } onClose(); };
  useFecharComEsc(tentarFechar);

  const mudarCelula = (userId: string, w: number, janelas: Janela[]) => setGrade((g) => {
    const dias = { ...(g[userId] ?? {}) };
    if (janelas.length) dias[w] = janelas; else delete dias[w];
    const novo = { ...g, [userId]: dias };
    if (!Object.keys(dias).length) delete novo[userId];
    return novo;
  });
  const alternar = (userId: string, w: number) => { setAviso(""); mudarCelula(userId, w, (grade[userId]?.[w] ?? []).length ? [] : [{ inicio: null, fim: null }]); };
  const noLote = (acao: "marcar" | "tirar") => {
    setAviso("");
    setGrade((g) => {
      const novo: Grade = { ...g };
      for (const userId of marcadas) {
        const dias = { ...(novo[userId] ?? {}) };
        for (const w of diasDoLote) { if (acao === "marcar") { if (!(dias[w]?.length)) dias[w] = [{ inicio: null, fim: null }]; } else delete dias[w]; }
        if (Object.keys(dias).length) novo[userId] = dias; else delete novo[userId];
      }
      return novo;
    });
  };
  const alternarMarca = (userId: string) => setMarcadas((m) => m.includes(userId) ? m.filter((x) => x !== userId) : [...m, userId]);
  const alternarDiaDoLote = (w: number) => setDiasDoLote((d) => d.includes(w) ? d.filter((x) => x !== w) : [...d, w]);

  const pedirSugestao = async () => {
    setPedindoSugestao(true); setErro(""); setAviso("");
    try { setSugestao(await customFetch<SugestaoDaApi>(`/api/programacoes/${programacaoId}/equipe/sugestao`)); }
    catch (err) { setErro(frase(err, "Não consegui montar a sugestão agora. Tente de novo.")); }
    finally { setPedindoSugestao(false); }
  };
  const aplicarSugestao = () => {
    if (!sugestao) return;
    setGrade((g) => {
      const novo: Grade = { ...g };
      for (const s of sugestao.sugestoes) {
        if (!nomeDe.has(s.userId)) continue;
        const dias = { ...(novo[s.userId] ?? {}) };
        for (const d of s.dias) if (!(dias[d.weekday]?.length)) dias[d.weekday] = [{ inicio: null, fim: null }];
        novo[s.userId] = dias;
      }
      return novo;
    });
    setAviso(`A sugestão foi para a grade. Confira, ajuste o que precisar e salve: nada foi gravado ainda.`);
    setSugestao(null);
  };

  const salvar = async () => {
    if (saving || !total || algumaInvalida) return;
    setSaving(true); setErro(""); setAviso("");
    try {
      if (!review) await customFetch(`/api/programacoes/${programacaoId}/equipe`, { method: "PUT", body: JSON.stringify({ baseVersao: versao, linhas }) });
      onSaved(); onClose();
    } catch (err) {
      setErro(frase(err, "Não consegui salvar agora. Nada foi alterado; tente de novo."));
      // Outra pessoa salvou antes: a grade passa a mostrar o que está valendo agora, e a frase diz que nada foi salvo.
      const atual = err instanceof ApiError && err.status === 409 ? (err.data as Partial<TelaDaEquipe> | null) : null;
      if (atual?.equipe && atual.pessoas) { carregar({ equipe: atual.equipe, versao: atual.versao ?? null, pessoas: atual.pessoas }); setDescartando(false); }
    } finally { setSaving(false); }
  };

  return <div className="shows-dialog-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) tentarFechar(); }}>
    <div className="shows-dialog eq-dialog" role="dialog" aria-modal="true" aria-labelledby={`${id}-titulo`}>
      <header className="shows-dialog-header"><div><h2 id={`${id}-titulo`}>Equipe de {localName}</h2><p>{programacaoNome} · {vigencia}</p></div><button type="button" onClick={tentarFechar} aria-label="Fechar"><X size={18}/></button></header>
      <div className="shows-dialog-content eq-conteudo">
        <p className="eq-explica">Marque em que dias da semana cada pessoa trabalha em {localName} nesta Programação. Quem ainda não tem marca em nenhum local continua entrando em tudo, como antes. Quem tem marca só entra nos blocos de <b>todo mundo</b> e de <b>área</b> do local e do dia marcados; blocos de grupo, de pessoas escolhidas pelo nome e os shows não mudam.</p>
        {carregando && <p className="eq-nota" role="status">Abrindo a equipe…</p>}
        {!carregando && pessoas.length > 0 && <>
          <p className="eq-resumo" aria-live="polite">{quantasPessoas === 0 ? "Ninguém marcado ainda neste local." : `${quantasPessoas} ${quantasPessoas === 1 ? "pessoa marcada" : "pessoas marcadas"} neste local.`}</p>
          <div className="eq-filtros">
            <input type="search" placeholder="Buscar pessoa" aria-label="Buscar pessoa" value={busca} onChange={(e) => setBusca(e.target.value)}/>
            <select aria-label="Filtrar por área" value={areaId} onChange={(e) => setAreaId(e.target.value)}><option value="">Todas as áreas</option>{areas.map(([aid, nome]) => <option key={aid} value={aid}>{nome}</option>)}</select>
            {podeEditar && !review && <button type="button" className="shows-secondary eq-sugerir" disabled={pedindoSugestao || saving} onClick={() => void pedirSugestao()}>{pedindoSugestao ? "Olhando as Escalas…" : "Sugerir pelas Escalas feitas"}</button>}
          </div>

          {sugestao && <div className="eq-sugestao" role="region" aria-label="Sugestão pelas Escalas feitas">
            {sugestao.semHistorico
              ? <p>Ainda não há Escalas publicadas deste local nas últimas semanas ({sugestao.janela.de.split("-").reverse().join("/")} a {sugestao.janela.ate.split("-").reverse().join("/")}) para sugerir. Marque à mão.</p>
              : sugestao.sugestoes.length === 0
                ? <p>Li {sugestao.escalasLidas} {sugestao.escalasLidas === 1 ? "Escala publicada" : "Escalas publicadas"}, mas ninguém teve atividade própria neste local em metade delas. Marque à mão.</p>
                : <>
                  <p>Li {sugestao.escalasLidas} {sugestao.escalasLidas === 1 ? "Escala publicada" : "Escalas publicadas"} deste local ({sugestao.janela.de.split("-").reverse().join("/")} a {sugestao.janela.ate.split("-").reverse().join("/")}). É só uma sugestão: confira antes de salvar.</p>
                  <ul>{sugestao.sugestoes.map((s) => <li key={s.userId}>{s.frase}</li>)}</ul>
                </>}
            <div className="eq-sugestao-acoes">
              {!sugestao.semHistorico && sugestao.sugestoes.length > 0 && <button type="button" className="shows-primary" onClick={aplicarSugestao}>{`Marcar o sugerido (${sugestao.sugestoes.length} ${sugestao.sugestoes.length === 1 ? "pessoa" : "pessoas"})`}</button>}
              <button type="button" className="shows-secondary" onClick={() => setSugestao(null)}>Fechar sugestão</button>
            </div>
          </div>}

          {podeEditar && <div className="eq-lote" role="group" aria-label="Marcar várias pessoas de uma vez">
            <div className="eq-lote-topo">
              <span>{marcadas.length ? `${marcadas.length} ${marcadas.length === 1 ? "pessoa escolhida" : "pessoas escolhidas"}` : "Escolha pessoas na lista para marcar vários dias de uma vez."}</span>
              <button type="button" className="eq-link" onClick={() => setMarcadas(listadas.map((p) => p.id))}>Escolher as da lista</button>
              {marcadas.length > 0 && <button type="button" className="eq-link" onClick={() => setMarcadas([])}>Limpar escolha</button>}
            </div>
            {marcadas.length > 0 && <>
              <div className="eq-lote-dias">
                {DIAS.map((d) => <button key={d.w} type="button" aria-pressed={diasDoLote.includes(d.w)} aria-label={d.longo} onClick={() => alternarDiaDoLote(d.w)}>{d.curto}</button>)}
              </div>
              <div className="eq-lote-atalhos">
                <button type="button" className="eq-link" onClick={() => setDiasDoLote(TODOS_OS_DIAS)}>Todos os dias</button>
                <button type="button" className="eq-link" onClick={() => setDiasDoLote(DIAS_UTEIS)}>Segunda a sexta</button>
                <button type="button" className="eq-link" onClick={() => setDiasDoLote(FIM_DE_SEMANA)}>Fim de semana</button>
              </div>
              <div className="eq-lote-acoes">
                <button type="button" className="shows-primary" disabled={!diasDoLote.length} onClick={() => noLote("marcar")}>{`Marcar em ${localName}`}</button>
                <button type="button" className="shows-secondary" disabled={!diasDoLote.length} onClick={() => noLote("tirar")}>Tirar dos dias escolhidos</button>
              </div>
            </>}
          </div>}

          <div className="eq-grade" role="table" aria-label={`Equipe de ${localName}: pessoas e dias da semana`}>
            <div className="eq-linha eq-cabecalho" role="row">
              <span className="eq-pessoa" role="columnheader">Pessoa</span>
              {DIAS.map((d) => <span key={d.w} className="eq-dia-cab" role="columnheader" aria-label={d.longo}>{d.curto}</span>)}
            </div>
            {listadas.length === 0 && <p className="eq-nota">Ninguém na lista com esse filtro.</p>}
            {listadas.map((p) => {
              const abertaAqui = aberta === p.id;
              const comHorario = DIAS.some((d) => (grade[p.id]?.[d.w] ?? []).some((j) => j.inicio || j.fim));
              return <div key={p.id} className={`eq-pessoa-bloco${comMarca(p.id) ? " tem-marca" : ""}`}>
                <div className="eq-linha" role="row">
                  <span className="eq-pessoa" role="rowheader">
                    {podeEditar && <input type="checkbox" aria-label={`Escolher ${p.nome}`} checked={marcadas.includes(p.id)} onChange={() => alternarMarca(p.id)}/>}
                    <button type="button" className="eq-nome" aria-expanded={abertaAqui} onClick={() => setAberta(abertaAqui ? null : p.id)}>
                      <b>{p.nome}</b>{p.areaNome && <small>{p.areaNome}</small>}{comHorario && <small className="eq-com-horario">com horário</small>}
                    </button>
                  </span>
                  {DIAS.map((d) => {
                    const janelas = grade[p.id]?.[d.w] ?? [];
                    const ligado = janelas.length > 0;
                    return <button key={d.w} type="button" role="cell" className={`eq-celula${ligado ? " ligado" : ""}`} aria-pressed={ligado} disabled={!podeEditar || saving}
                      aria-label={`${p.nome}, ${d.longo}: ${ligado ? `trabalha em ${localName} (${janelas.map(textoDaJanela).join(", ")})` : "não trabalha aqui"}`} onClick={() => alternar(p.id, d.w)}>
                      <span aria-hidden="true">{ligado ? (janelas.some((j) => j.inicio || j.fim) ? "◐" : "●") : ""}</span>
                    </button>;
                  })}
                </div>
                {abertaAqui && <div className="eq-detalhe">
                  {DIAS.filter((d) => (grade[p.id]?.[d.w] ?? []).length > 0).length === 0
                    ? <p className="eq-nota">{p.nome} ainda não tem dia marcado em {localName}.{podeEditar ? " Toque nos dias acima." : ""}</p>
                    : DIAS.filter((d) => (grade[p.id]?.[d.w] ?? []).length > 0).map((d) => {
                      const janelas = grade[p.id]![d.w]!;
                      return <div key={d.w} className="eq-detalhe-dia">
                        <strong>{d.longo}</strong>
                        {janelas.map((j, i) => <div key={i} className="eq-janela">
                          <label>a partir de<input type="time" disabled={!podeEditar || saving} value={j.inicio ?? ""} onChange={(e) => mudarCelula(p.id, d.w, janelas.map((x, k) => k === i ? { ...x, inicio: e.target.value || null } : x))}/></label>
                          <label>até<input type="time" disabled={!podeEditar || saving} value={j.fim ?? ""} onChange={(e) => mudarCelula(p.id, d.w, janelas.map((x, k) => k === i ? { ...x, fim: e.target.value || null } : x))}/></label>
                          {janelas.length > 1 && podeEditar && <button type="button" className="eq-link" onClick={() => mudarCelula(p.id, d.w, janelas.filter((_, k) => k !== i))}>Tirar esta janela</button>}
                          {janelaInvalida(j) ? <small className="eq-erro" role="alert">O fim precisa ser depois do início.</small> : <small>{textoDaJanela(j)}</small>}
                        </div>)}
                        {podeEditar && <button type="button" className="eq-link" onClick={() => mudarCelula(p.id, d.w, [...janelas, { inicio: null, fim: null }])}>Outra janela neste dia</button>}
                      </div>;
                    })}
                  <p className="eq-nota">Sem horário, a pessoa trabalha o dia inteiro aqui. Com horário (por exemplo "até 13:00"), o resto do dia pode ser em outro local.</p>
                </div>}
              </div>;
            })}
          </div>
        </>}
        {!carregando && !pessoas.length && !erro && <p className="eq-nota">Não há pessoas no elenco ativo para marcar.</p>}
        {!podeEditar && !carregando && pessoas.length > 0 && <p className="eq-nota">Quem escreve a equipe é a Administração ou a Supervisão deste local. Aqui você só lê.</p>}
        {aviso && <p className="eq-aviso" role="status">{aviso}</p>}
        {erro && <p className="eq-erro-geral" role="alert">{erro}</p>}
      </div>
      <footer className="shows-dialog-footer eq-rodape">
        {descartando
          ? <>
            <span className="eq-descartar" role="alert">{`Descartar ${total === 1 ? "a mudança" : `as ${total} mudanças`} ainda não salva${total === 1 ? "" : "s"}?`}</span>
            <button type="button" className="shows-secondary" onClick={() => setDescartando(false)}>Voltar</button>
            <button type="button" className="shows-primary" onClick={onClose}>Descartar</button>
          </>
          : <>
            <span className="eq-contagem" aria-live="polite">{total === 0 ? "" : `${mudancas.entram ? `${mudancas.entram} ${mudancas.entram === 1 ? "marcação nova" : "marcações novas"}` : ""}${mudancas.entram && mudancas.saem ? " · " : ""}${mudancas.saem ? `${mudancas.saem} ${mudancas.saem === 1 ? "retirada" : "retiradas"}` : ""}`}</span>
            <button type="button" className="shows-secondary" onClick={tentarFechar} disabled={saving}>{podeEditar ? "Cancelar" : "Fechar"}</button>
            {podeEditar && <button type="button" className="shows-primary" disabled={saving || total === 0 || algumaInvalida} onClick={() => void salvar()}>{saving ? "Salvando…" : "Salvar equipe"}</button>}
          </>}
      </footer>
    </div>
  </div>;
}
