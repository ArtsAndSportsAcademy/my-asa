import { FormEvent, useEffect, useState } from "react";
import { Archive, ArchiveRestore, CheckCircle2, FilePlus2, FileUp, Pencil, Users } from "lucide-react";
import { customFetch } from "@workspace/api-client-react";
import { serverError } from "@/components/comm-ui";

// Gestão de um documento da Biblioteca, dentro da janela de detalhe: só aparece para quem pode (o servidor decide).
// Editar muda título, resumo, etiquetas e se pede leitura; texto novo é "Nova versão", que recomeça a leitura de todos.
type Doc = { id: string; title: string; summary?: string | null; body?: string | null; tags?: string[]; requiresConfirmation?: boolean; version: number; status: string; scopeType?: string };
type Leituras = { scopeType?: string; version: number; requiresConfirmation: boolean; total: number; abriram: number; confirmaram: number; pessoas: { id: string; name: string; areaName?: string | null; abriu: boolean; confirmou: boolean }[] };
type Modo = null | "editar" | "versao" | "pdf" | "leituras" | "arquivar" | "restaurar";

export function GestaoDoDocumento({ doc, canManage, canArchive, canRestore = false, canSeeReaders, onChanged, onArchived, onNotice }: { doc: Doc; canManage: boolean; canArchive: boolean; canRestore?: boolean; canSeeReaders: boolean; onChanged: () => void; onArchived: () => void; onNotice: (texto: string) => void }) {
  const [modo, setModo] = useState<Modo>(null), [busy, setBusy] = useState(false), [erro, setErro] = useState("");
  const [leituras, setLeituras] = useState<Leituras | null>(null), [soFaltam, setSoFaltam] = useState(false);
  const abrir = (proximo: Modo) => { setErro(""); setModo((atual) => atual === proximo ? null : proximo); };
  const fechar = () => { setModo(null); setErro(""); };

  useEffect(() => {
    if (modo !== "leituras") return;
    let ativo = true; setLeituras(null);
    customFetch<Leituras>(`/api/library/documents/${doc.id}/leituras`)
      .then((dados) => { if (ativo) setLeituras(dados); })
      .catch((err) => { if (ativo) setErro(serverError(err, "Não consegui carregar quem já leu agora. Tente de novo.")); });
    return () => { ativo = false; };
  }, [modo, doc.id, doc.version]);

  const enviar = async (executar: () => Promise<void>, falha: string) => {
    if (busy) return;
    setBusy(true); setErro("");
    try { await executar(); } catch (err) { setErro(serverError(err, falha)); } finally { setBusy(false); }
  };
  const editar = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const dados = new FormData(event.currentTarget);
    void enviar(async () => {
      await customFetch(`/api/library/documents/${doc.id}`, { method: "PATCH", body: JSON.stringify({ title: String(dados.get("title") ?? "").trim(), summary: String(dados.get("summary") ?? "").trim(), tags: String(dados.get("tags") ?? "").split(",").map((tag) => tag.trim()).filter(Boolean), requiresConfirmation: Boolean(dados.get("requiresConfirmation")) }) });
      fechar(); onNotice("Informações do documento salvas. Quem já leu continua como estava; para mudar o texto, publique uma nova versão."); onChanged();
    }, "Não consegui salvar agora. Nada foi alterado; tente de novo.");
  };
  const novaVersao = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const dados = new FormData(event.currentTarget);
    void enviar(async () => {
      await customFetch(`/api/library/documents/${doc.id}/version`, { method: "POST", body: JSON.stringify({ title: String(dados.get("title") ?? "").trim(), summary: String(dados.get("summary") ?? "").trim(), body: String(dados.get("body") ?? "").trim() }) });
      fechar(); onNotice(`Versão ${doc.version + 1} publicada. O público foi avisado${doc.requiresConfirmation ? " e todos voltam a ter a leitura pendente" : ""}.`); onChanged();
    }, "Não consegui publicar a versão nova agora. Nada foi alterado; tente de novo.");
  };
  const trocarPdf = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const escolhido = new FormData(event.currentTarget).get("file");
    const arquivo = escolhido instanceof File && escolhido.size > 0 ? escolhido : null;
    if (!arquivo) { setErro("Escolha o PDF."); return; }
    if (arquivo.type !== "application/pdf" || arquivo.size > 15 * 1024 * 1024) { setErro("Envie um PDF de até 15 MB."); return; }
    void enviar(async () => {
      await customFetch(`/api/library/documents/${doc.id}/file`, { method: "PUT", body: arquivo, headers: { "content-type": "application/pdf", "x-file-name": encodeURIComponent(arquivo.name) } });
      fechar(); onNotice("PDF trocado. As citações por página da versão anterior deixam de valer."); onChanged();
    }, "Não consegui enviar o PDF agora. O que já estava continua valendo; tente de novo.");
  };
  const arquivar = () => void enviar(async () => {
    await customFetch(`/api/library/documents/${doc.id}/archive`, { method: "POST" });
    onNotice("Documento arquivado. Ele sai da Biblioteca de todos, e o histórico fica preservado. Dá para desfazer por alguns segundos, no aviso que aparece embaixo.");
    onArchived();
  }, "Não consegui arquivar agora. Nada foi alterado; tente de novo.");

  const restaurar = () => void enviar(async () => {
    await customFetch(`/api/library/documents/${doc.id}/restore`, { method: "POST" });
    fechar(); onNotice("Documento restaurado como rascunho. Ninguém foi avisado e o Elenco ainda não o vê: quando quiser, publique de novo."); onChanged();
  }, "Não consegui restaurar agora. Nada foi alterado; tente de novo.");

  if (!canManage && !canSeeReaders && !canRestore) return null;
  const lista = leituras ? leituras.pessoas.filter((pessoa) => !soFaltam || !(leituras.requiresConfirmation ? pessoa.confirmou : pessoa.abriu)) : [];
  return <section aria-label="Gerenciar o documento" className="comm-reader-section comm-gestao">
    <div><h3>Gerenciar o documento</h3><small>Só quem cuida deste documento vê estes botões.</small></div>
    <div className="comm-reader-buttons">
      {canManage && <button type="button" className={modo === "editar" ? "comm-secondary active" : "comm-secondary"} onClick={() => abrir("editar")}><Pencil size={15}/> Editar informações</button>}
      {canManage && <button type="button" className={modo === "versao" ? "comm-secondary active" : "comm-secondary"} onClick={() => abrir("versao")}><FilePlus2 size={15}/> Nova versão</button>}
      {canManage && <button type="button" className={modo === "pdf" ? "comm-secondary active" : "comm-secondary"} onClick={() => abrir("pdf")}><FileUp size={15}/> Trocar o PDF</button>}
      {canSeeReaders && <button type="button" className={modo === "leituras" ? "comm-secondary active" : "comm-secondary"} onClick={() => abrir("leituras")}><Users size={15}/> Quem já leu</button>}
      {canRestore && <button type="button" className={modo === "restaurar" ? "comm-secondary active" : "comm-secondary"} onClick={() => abrir("restaurar")}><ArchiveRestore size={15}/> Restaurar</button>}
      {canArchive && <button type="button" className={modo === "arquivar" ? "comm-secondary active" : "comm-secondary"} onClick={() => abrir("arquivar")}><Archive size={15}/> Arquivar</button>}
    </div>
    {modo === "editar" && <form className="comm-form" onSubmit={editar}><label>Título<input name="title" required defaultValue={doc.title}/></label><label>Resumo<textarea name="summary" required defaultValue={doc.summary ?? ""}/></label><label>Etiquetas, separadas por vírgula<input name="tags" defaultValue={(doc.tags ?? []).join(", ")}/></label><label className="comm-check"><input name="requiresConfirmation" type="checkbox" defaultChecked={Boolean(doc.requiresConfirmation)}/> Pede confirmação de leitura</label><p className="comm-note">Isto não cria versão nova nem pede leitura de novo. Para mudar o texto, use “Nova versão”.</p>{erro && <p className="comm-form-error" role="alert">{erro}</p>}<footer><button type="button" onClick={fechar}>Cancelar</button><button className="comm-primary" disabled={busy}>{busy ? "Salvando…" : "Salvar"}</button></footer></form>}
    {modo === "versao" && <form className="comm-form" onSubmit={novaVersao}><label>Título<input name="title" required defaultValue={doc.title}/></label><label>Resumo<textarea name="summary" required defaultValue={doc.summary ?? ""}/></label><label>Texto do documento<textarea name="body" required rows={8} defaultValue={doc.body ?? ""}/></label><p className="comm-note">Vai ser a versão {doc.version + 1}. O público é avisado{doc.requiresConfirmation ? ", e quem já tinha confirmado a leitura volta a ter a leitura pendente" : ""}. A versão {doc.version} fica guardada no histórico.</p>{erro && <p className="comm-form-error" role="alert">{erro}</p>}<footer><button type="button" onClick={fechar}>Cancelar</button><button className="comm-primary" disabled={busy}>{busy ? "Publicando…" : `Publicar versão ${doc.version + 1}`}</button></footer></form>}
    {modo === "pdf" && <form className="comm-form" onSubmit={trocarPdf}><label>Novo PDF (até 15 MB)<input name="file" type="file" accept="application/pdf" required/></label><p className="comm-note">O PDF antigo é substituído. As citações por página da versão atual deixam de valer, então confira-as depois.</p>{erro && <p className="comm-form-error" role="alert">{erro}</p>}<footer><button type="button" onClick={fechar}>Cancelar</button><button className="comm-primary" disabled={busy}>{busy ? "Enviando…" : "Trocar o PDF"}</button></footer></form>}
    {modo === "leituras" && <div className="comm-form">{!leituras && !erro && <p aria-busy="true">Carregando…</p>}{erro && <p className="comm-form-error" role="alert">{erro}</p>}{leituras && <>
      <p className="comm-note"><CheckCircle2 size={14} style={{ verticalAlign: "-2px" }}/> {leituras.requiresConfirmation ? `${leituras.confirmaram} de ${leituras.total} confirmaram a leitura da versão ${leituras.version}.` : `${leituras.abriram} de ${leituras.total} abriram a versão ${leituras.version} (este documento não pede confirmação).`}{leituras.scopeType === "LOCATION" ? " Documento de local não tem público definido." : ""}</p>
      <label className="comm-check"><input type="checkbox" checked={soFaltam} onChange={(event) => setSoFaltam(event.target.checked)}/> Mostrar só quem falta</label>
      <ul className="comm-leituras">{lista.map((pessoa) => <li key={pessoa.id}><span>{pessoa.name}{pessoa.areaName ? ` · ${pessoa.areaName}` : ""}</span><b className={pessoa.confirmou ? "ok" : pessoa.abriu ? "meio" : "nao"}>{pessoa.confirmou ? "confirmou" : pessoa.abriu ? "abriu, não confirmou" : "não abriu"}</b></li>)}{!lista.length && <li>Ninguém falta.</li>}</ul>
      <footer><button type="button" onClick={fechar}>Fechar</button></footer></>}</div>}
    {modo === "arquivar" && <div className="comm-form"><p className="comm-note">Arquivar tira “{doc.title}” da Biblioteca de todos. Nada é apagado: o histórico fica preservado. Logo depois de arquivar aparece um aviso com “Desfazer” por alguns segundos.</p>{erro && <p className="comm-form-error" role="alert">{erro}</p>}<footer><button type="button" onClick={fechar}>Cancelar</button><button type="button" className="comm-primary" disabled={busy} onClick={arquivar}>{busy ? "Arquivando…" : "Arquivar documento"}</button></footer></div>}
    {modo === "restaurar" && <div className="comm-form"><p className="comm-note">Restaurar traz “{doc.title}” de volta como <b>rascunho</b>. Ninguém é avisado, e o Elenco só volta a ver o documento depois que você publicar de novo. O texto, as versões e quem já leu continuam como estavam.</p>{erro && <p className="comm-form-error" role="alert">{erro}</p>}<footer><button type="button" onClick={fechar}>Cancelar</button><button type="button" className="comm-primary" disabled={busy} onClick={restaurar}>{busy ? "Restaurando…" : "Restaurar como rascunho"}</button></footer></div>}
  </section>;
}
