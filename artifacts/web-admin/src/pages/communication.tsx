import { FormEvent, useEffect, useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { ChevronRight, FileText, Plus, Search, X } from "lucide-react";
import { ApiError, customFetch } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/useAuth";
import { GestaoDoDocumento } from "./biblioteca-gestao";
import exampleData from "../../../../design_handoff_my_asa/dados-de-exemplo.json";
import { REVIEW_PERSON } from "@/lib/amostra";
import { Modal, State, displayDate, now, serverError, type Person, type Role } from "@/components/comm-ui";
import "./communication.css";

// O Mural mora em pages/mural.tsx e as Mensagens em pages/mensagens.tsx; aqui fica a Biblioteca.
type LibraryCitation = { pageNumber: number; excerpt: string };
type LibraryDoc = { id: string; title: string; type: string; body?: string | null; summary?: string | null; version: number; status: string; categoryId?: string | null; responsibleName?: string | null; publishedAt?: string | null; fileUrl?: string | null; fileName?: string | null; tags?: string[]; requiresConfirmation?: boolean; waitingMe?: boolean; myConfirmed?: boolean; scopeType?: "HOUSE" | "AREA" | "LOCATION" };

const samplePeople: Person[] = exampleData.pessoas.map((person, index) => ({ id: `sample-person-${index}`, name: person.nome_de_exibicao, areaName: exampleData.areas.find(area => area.id === person.area)?.nome ?? null }));
const TIPO_DOC: Record<string, string> = { OPERATIONAL_PROCEDURE: "Procedimento operacional", RULES_AND_POLICIES: "Regras e políticas", CHARACTER_REFERENCE: "Referência de personagens", COSTUME_REFERENCE: "Referência de figurinos", ONBOARDING_MATERIAL: "Material de integração", SAFETY_PROCEDURE: "Procedimento de segurança" };
const tipoDoc = (type: string) => TIPO_DOC[type] ?? "Documento";

export function LibraryPage({ role }: { role: Role }) {
  const sample = import.meta.env.DEV && new URLSearchParams(window.location.search).get("amostra") === "1";
  const search = useSearch();
  const [, setLocation] = useLocation();
  const selectedDocumentId = new URLSearchParams(search).get("document");
  const [docs, setDocs] = useState<LibraryDoc[]>([]), [query, setQuery] = useState(""), [libraryFilter, setLibraryFilter] = useState<"all" | "waiting" | "recent">("all"), [loading, setLoading] = useState(true), [error, setError] = useState(""), [newOpen, setNewOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<LibraryDoc | null>(null), [detailLoading, setDetailLoading] = useState(false), [detailError, setDetailError] = useState("");
  const [readerSection, setReaderSection] = useState(0);
  // "Pedir um material" (desenho 24): vira uma Solicitação "Outro assunto" e segue o fluxo de decisão de sempre.
  const [askOpen, setAskOpen] = useState(false), [askError, setAskError] = useState(""), [askSent, setAskSent] = useState(false), [asking, setAsking] = useState(false);
  const canAsk = role !== "dir";
  const { user } = useAuth();
  // Erro de uma ação (confirmar leitura, abrir PDF) não pode apagar a lista inteira: tem seu próprio aviso.
  const [actionError, setActionError] = useState(""), [notice, setNotice] = useState("");
  // Quem pode gerenciar o documento aberto (o servidor decide) e um contador para recarregar o detalhe depois de uma mudança.
  const [detailFlags, setDetailFlags] = useState({ canManage: false, canArchive: false, canSeeReaders: false }), [detailTick, setDetailTick] = useState(0);
  const [publishing, setPublishing] = useState(false), [publishError, setPublishError] = useState(""), [etapas, setEtapas] = useState<{ id: string | null; arquivo: boolean }>({ id: null, arquivo: false });
  const [scopeChoice, setScopeChoice] = useState<"HOUSE" | "AREA" | "LOCATION">("HOUSE"), [areaOptions, setAreaOptions] = useState<{ id: string; name: string }[]>([]), [locationOptions, setLocationOptions] = useState<{ id: string; name: string }[]>([]), [optionsFailed, setOptionsFailed] = useState(false);
  useEffect(() => {
    if (!newOpen || role !== "adm" || sample) return;
    let active = true; setOptionsFailed(false);
    Promise.all([customFetch<{ areas?: { id: string; name: string }[] }>("/api/areas"), customFetch<{ locations?: { id: string; name: string; closed?: boolean }[] }>("/api/locations")])
      .then(([a, l]) => { if (active) { setAreaOptions(a.areas ?? []); setLocationOptions((l.locations ?? []).filter(item => !item.closed)); } })
      .catch(() => { if (active) setOptionsFailed(true); });
    return () => { active = false; };
  }, [newOpen, role, sample]);
  const askMaterial = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const what = String(form.get("what") ?? "").trim(), why = String(form.get("why") ?? "").trim();
    if (!what || !why) { setAskError("Diga qual material e para que você precisa."); return; }
    if (sample) { setAskSent(true); return; }
    setAsking(true); setAskError("");
    try { await customFetch("/api/solicitacoes", { method: "POST", body: JSON.stringify({ tipo: "OTHER", assunto: `Material para a Biblioteca: ${what}`.slice(0, 120), motivo: why }) }); setAskSent(true); }
    catch (err) { setAskError(serverError(err, "Não consegui enviar o pedido agora. O que você escreveu continua aqui.")); }
    finally { setAsking(false); }
  };
  const [citations, setCitations] = useState<LibraryCitation[]>([]), [canManageCitations, setCanManageCitations] = useState(false), [editingCitations, setEditingCitations] = useState(false), [citationRows, setCitationRows] = useState<Array<{ pageNumber: string; excerpt: string }>>([]), [citationError, setCitationError] = useState(""), [savingCitations, setSavingCitations] = useState(false);
  const canPublish = role === "adm" || role === "sup";
  const reload = () => { setLoading(true); setError(""); if (sample) { setDocs([{ id: "sample-safety", title: "Procedimento de segurança", type: "SAFETY_PROCEDURE", summary: "Como agir em uma intercorrência durante a operação.", version: 2, status: "PUBLISHED", responsibleName: "Barbara", fileUrl: "", requiresConfirmation: true }, { id: "sample-house", title: "Regras da casa", type: "RULES_AND_POLICIES", summary: "Convivência, conduta e cuidado com a equipe.", version: 1, status: "PUBLISHED", responsibleName: "Cris", fileUrl: "" }]); setLoading(false); return; } customFetch<{ documents: LibraryDoc[] }>(`/api/library/documents?q=${encodeURIComponent(query)}`).then(result => setDocs(result.documents)).catch(() => setError("Não consegui carregar a Biblioteca.")).finally(() => setLoading(false)); };
  useEffect(reload, [sample]);
  useEffect(() => {
    if (!selectedDocumentId) {
      setSelectedDocument(null);
      setCitations([]);
      setCanManageCitations(false);
      setEditingCitations(false);
      setDetailError("");
      setDetailLoading(false);
      return;
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(selectedDocumentId)) {
      setSelectedDocument(null);
      setDetailError("Link de documento inválido.");
      setDetailLoading(false);
      return;
    }
    let active = true;
    setDetailLoading(true);
    setDetailError("");
    customFetch<{ document: LibraryDoc; citations?: LibraryCitation[]; canManageCitations?: boolean; canManage?: boolean; canArchive?: boolean; canSeeReaders?: boolean }>(`/api/library/documents/${selectedDocumentId}`)
      .then(result => { if (active) { setDetailFlags({ canManage: Boolean(result.canManage), canArchive: Boolean(result.canArchive), canSeeReaders: Boolean(result.canSeeReaders) }); setSelectedDocument(result.document); setReaderSection(0); setCitations(result.citations ?? []); setCanManageCitations(Boolean(result.canManageCitations)); setEditingCitations(false); } })
      .catch(err => { if (active) { setSelectedDocument(null); setDetailError(err instanceof ApiError && (err.status === 403 || err.status === 404) ? "Este documento não está disponível no seu acesso." : "Não consegui abrir este documento agora. Confira a conexão e tente de novo."); } })
      .finally(() => { if (active) setDetailLoading(false); });
    return () => { active = false; };
  }, [selectedDocumentId, sample, detailTick]);
  const readerSections = useMemo(() => {
    const body = selectedDocument?.body?.trim() || "Sem conteúdo disponível.";
    const chunks = body.split(/\n(?=(?:#{1,3}\s+|[A-ZÁÉÍÓÚÃÕÇ][^\n]{3,80}\n))/).map(section => section.trim()).filter(Boolean);
    return chunks.length ? chunks : [body];
  }, [selectedDocument?.body]);
  const filtered = useMemo(() => docs.filter(doc => `${doc.title} ${doc.summary ?? ""} ${(doc.tags ?? []).join(" ")}`.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR")) && (libraryFilter === "all" || (libraryFilter === "waiting" ? Boolean(sample ? doc.requiresConfirmation : doc.waitingMe) : Boolean(doc.publishedAt && Date.now() - new Date(doc.publishedAt).getTime() <= 7 * 24 * 60 * 60 * 1000)))), [docs, query, libraryFilter]);
  const abrirPublicacao = () => { setPublishError(""); setEtapas({ id: null, arquivo: false }); setScopeChoice("HOUSE"); setNewOpen(true); };
  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (publishing) return;
    const data = new FormData(event.currentTarget);
    // Campo de arquivo vazio chega como um File sem nome e sem bytes: isso é "sem PDF", não um PDF inválido.
    const escolhido = data.get("file"), file = escolhido instanceof File && escolhido.size > 0 ? escolhido : null;
    // Administração escolhe para quem vale; Supervisão só publica para a própria área (regra do servidor).
    const scope = role === "adm" ? scopeChoice : "AREA";
    const areaId = role === "adm" ? (scope === "AREA" ? String(data.get("areaId") ?? "") || null : null) : (user as { areaId?: string | null } | null)?.areaId ?? null;
    const locationId = role === "adm" && scope === "LOCATION" ? String(data.get("locationId") ?? "") || null : null;
    if (scope === "AREA" && !areaId) { setPublishError(role === "adm" ? "Escolha a área que vai receber o documento." : "Seu cadastro está sem área, então não dá para publicar. Peça à Administração para colocar você em uma área."); return; }
    if (scope === "LOCATION" && !locationId) { setPublishError("Escolha o local que vai receber o documento."); return; }
    const body = { title: String(data.get("title") ?? "").trim(), type: String(data.get("type")), summary: String(data.get("summary") ?? "").trim(), body: String(data.get("summary") ?? "").trim(), fileUrl: String(data.get("fileUrl") ?? "").trim() || null, tags: String(data.get("tags") ?? "").split(",").map(tag => tag.trim()).filter(Boolean), requiresConfirmation: Boolean(data.get("requiresConfirmation")), scopeType: scope, areaId, locationId };
    if (file && (file.type !== "application/pdf" || file.size > 15 * 1024 * 1024)) { setPublishError("Envie um PDF de até 15 MB."); return; }
    if (sample) { setDocs(rows => [{ id: `sample-doc-${Date.now()}`, ...body, fileName: file?.name ?? null, version: 1, status: "PUBLISHED", responsibleName: REVIEW_PERSON[role] }, ...rows]); setNewOpen(false); return; }
    setPublishing(true); setPublishError("");
    // Três passos no servidor (criar, enviar o PDF, publicar). Se um falhar, o que já foi feito fica guardado
    // e "Publicar" de novo continua de onde parou, em vez de criar um segundo documento igual.
    let atual = etapas;
    try {
      if (!atual.id) { const created = await customFetch<{ document: LibraryDoc }>("/api/library/documents", { method: "POST", body: JSON.stringify(body) }); atual = { ...atual, id: created.document.id }; setEtapas(atual); }
      if (file && !atual.arquivo) { await customFetch(`/api/library/documents/${atual.id}/file`, { method: "PUT", body: file, headers: { "content-type": "application/pdf", "x-file-name": encodeURIComponent(file.name) } }); atual = { ...atual, arquivo: true }; setEtapas(atual); }
      await customFetch(`/api/library/documents/${atual.id}/publish`, { method: "POST" });
      setNewOpen(false); setEtapas({ id: null, arquivo: false }); reload();
    } catch (err) {
      const detalhe = serverError(err, ""), generico = !detalhe || detalhe === "Erro interno";
      setPublishError(atual.id ? `O documento ficou salvo como rascunho, mas não consegui terminar de publicar${generico ? "" : ` (${detalhe})`}. Toque em “Terminar de publicar” para continuar de onde parou; não será criado outro.` : generico ? "Não consegui publicar agora. Nada foi criado; confira a conexão e tente de novo." : detalhe);
    } finally { setPublishing(false); }
  };
  const openDocument = async (doc: LibraryDoc) => {
    setActionError("");
    try {
      if (doc.fileUrl) { window.open(doc.fileUrl, "_blank", "noopener"); return; }
      if (!doc.fileName) return;
      // A janela abre já no toque e recebe o PDF depois: no telefone, abrir só depois de esperar a resposta costuma ser bloqueado.
      const janela = window.open("", "_blank");
      if (!janela) { setActionError("O navegador bloqueou a janela do PDF. Permita pop-ups para este site e toque em Abrir de novo."); return; }
      try { const blob = await customFetch<Blob>(`/api/library/documents/${doc.id}/file`, { responseType: "blob" }); const url = URL.createObjectURL(blob); janela.location.href = url; window.setTimeout(() => URL.revokeObjectURL(url), 60_000); }
      catch (err) { janela.close(); throw err; }
    } catch (err) { setActionError(serverError(err, "Não consegui abrir o PDF agora. Confira a conexão e tente de novo.")); }
  };
  const confirm = async (doc: LibraryDoc) => { setActionError(""); if (sample) { setDocs(rows => rows.map(row => row.id === doc.id ? { ...row, requiresConfirmation: false } : row)); return; } try { await customFetch(`/api/library/documents/${doc.id}/confirm`, { method: "POST" }); reload(); } catch (err) { setActionError(serverError(err, "Não consegui confirmar a leitura agora. Tente de novo; a confirmação só vale depois de aparecer aqui.")); } };
  const closeDetail = () => { const params = new URLSearchParams(search); params.delete("document"); const queryString = params.toString(); setLocation(`/biblioteca${queryString ? `?${queryString}` : ""}`); };
  const confirmSelected = async () => {
    if (!selectedDocument) return;
    try {
      if (!sample) await customFetch(`/api/library/documents/${selectedDocument.id}/confirm`, { method: "POST" });
      setSelectedDocument(current => current ? { ...current, waitingMe: false, requiresConfirmation: sample ? false : current.requiresConfirmation } : null);
      reload();
    } catch { setDetailError("Não consegui confirmar a leitura."); }
  };
  const savePageCitations = async () => {
    if (!selectedDocument) return;
    setSavingCitations(true);
    setCitationError("");
    try {
      const result = await customFetch<{ citations: LibraryCitation[] }>(`/api/library/documents/${selectedDocument.id}/citations`, {
        method: "PUT",
        body: JSON.stringify({ version: selectedDocument.version, citations: citationRows.map(row => ({ pageNumber: Number(row.pageNumber), excerpt: row.excerpt })) }),
      });
      setCitations(result.citations);
      setEditingCitations(false);
    } catch {
      setCitationError("Não foi possível salvar. Recarregue e confira se a versão continua atual.");
    } finally { setSavingCitations(false); }
  };
  return <section className="comm-page"><div className="comm-library-head"><div><span>fonte oficial da casa</span><h2>Biblioteca</h2><p>Procedimentos, regras e documentos institucionais.</p></div><div className="comm-library-actions">{canAsk && <button className="comm-secondary" onClick={() => { setAskOpen(true); setAskSent(false); setAskError(""); }}>Pedir um material</button>}{canPublish && <button className="comm-primary" onClick={abrirPublicacao}><Plus size={17}/> Publicar documento</button>}</div></div>{askOpen && <Modal title="Pedir um material" onClose={() => setAskOpen(false)}>{askSent ? <div className="comm-form"><p className="comm-note">Pedido enviado. A supervisão da sua área recebe e decide; você acompanha em <b>Folgas e solicitações › Solicitações</b>.</p><footer><button type="button" className="comm-primary" onClick={() => setAskOpen(false)}>Fechar</button></footer></div> : <form className="comm-form" onSubmit={askMaterial}><label>Qual material<input name="what" maxLength={80} required placeholder="Ex.: mapa de palco do Yeti atualizado"/></label><label>Para que você precisa<textarea name="why" required placeholder="Conte o que está faltando"/></label>{askError && <p className="comm-form-error" role="alert">{askError}</p>}<footer><button type="button" onClick={() => setAskOpen(false)}>Cancelar</button><button className="comm-primary" disabled={asking}>{asking ? "Enviando…" : "Enviar pedido"}</button></footer></form>}</Modal>}{actionError && <p className="comm-form-error" role="alert">{actionError}</p>}{notice && <p className="comm-note" role="status">{notice} <button type="button" className="comm-secondary" onClick={() => setNotice("")}>Dispensar</button></p>}<div className="comm-search"><Search size={17}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar por título ou assunto"/></div><div className="comm-thread-filters" aria-label="Filtros da Biblioteca"><button className={libraryFilter === "all" ? "active" : ""} onClick={() => setLibraryFilter("all")}>Todos</button><button className={libraryFilter === "waiting" ? "active" : ""} onClick={() => setLibraryFilter("waiting")}>Esperando você</button><button className={libraryFilter === "recent" ? "active" : ""} onClick={() => setLibraryFilter("recent")}>Mudou esta semana</button></div><State loading={loading} error={error} empty={!filtered.length} onRetry={reload} emptyHint={query.trim() ? "Nenhum documento combina com a busca. Tente uma palavra do título ou do assunto." : libraryFilter === "waiting" ? "Nenhum documento está esperando a sua leitura." : libraryFilter === "recent" ? "Nenhum documento foi publicado ou atualizado nos últimos 7 dias." : "Quando a Administração publicar um documento, ele aparece aqui."}><div className="comm-library-grid">{filtered.map(doc => <article className="comm-document" key={doc.id}><span className="comm-document-icon"><FileText size={22}/><small>PDF</small></span><div><small>{tipoDoc(doc.type)}</small><h2>{doc.title}</h2><p>{doc.summary}</p></div><footer><span>v{doc.version} · {doc.responsibleName ?? "Casa"}{doc.scopeType === "AREA" ? " · só uma área" : doc.scopeType === "LOCATION" ? " · só um local" : ""}</span><button type="button" className="comm-secondary" onClick={() => setLocation(`/biblioteca?document=${doc.id}`)}>Detalhes <ChevronRight size={16}/></button>{(doc.fileUrl || doc.fileName) ? <button onClick={() => void openDocument(doc)}>Abrir <ChevronRight size={16}/></button> : <span className="comm-pending-url">PDF aguardando envio</span>}{(sample ? doc.requiresConfirmation : doc.waitingMe) && <button className="comm-doc-confirm" onClick={() => void confirm(doc)}>Li e entendi</button>}</footer></article>)}</div></State>{newOpen && <Modal title="Publicar documento" onClose={() => setNewOpen(false)}><form className="comm-form" onSubmit={create}><fieldset disabled={Boolean(etapas.id) || publishing} style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: "inherit", minWidth: 0 }}><label>Título<input name="title" required/></label><label>Tipo<select name="type"><option value="RULES_AND_POLICIES">Regra ou política</option><option value="OPERATIONAL_PROCEDURE">Procedimento operacional</option><option value="SAFETY_PROCEDURE">Procedimento de segurança</option><option value="ONBOARDING_MATERIAL">Material de integração</option></select></label>{role === "adm" ? <><label>Para quem vale<select value={scopeChoice} onChange={event => setScopeChoice(event.target.value as "HOUSE" | "AREA" | "LOCATION")}><option value="HOUSE">A casa inteira</option><option value="AREA">Uma área</option><option value="LOCATION">Um local</option></select></label>{scopeChoice === "AREA" && <label>Área<select name="areaId" required defaultValue=""><option value="" disabled>Escolha a área</option>{areaOptions.map(area => <option key={area.id} value={area.id}>{area.name}</option>)}</select></label>}{scopeChoice === "LOCATION" && <label>Local<select name="locationId" required defaultValue=""><option value="" disabled>Escolha o local</option>{locationOptions.map(location => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>}{optionsFailed && scopeChoice !== "HOUSE" && <p className="comm-form-error" role="alert">Não consegui carregar a lista de áreas e locais. Feche e abra de novo, ou publique para a casa inteira.</p>}</> : <p className="comm-note">Este documento vale só para a sua área. Quem é de outra área não vê.</p>}<label>PDF<input name="file" type="file" accept="application/pdf"/></label><label>ou link do PDF/documento<input name="fileUrl" type="url" placeholder="https://…"/></label><label>Resumo<textarea name="summary" required/></label><label>Tags, separadas por vírgula<input name="tags" placeholder="segurança, camarim"/></label><label className="comm-check"><input name="requiresConfirmation" type="checkbox"/> Pede confirmação de leitura</label></fieldset>{etapas.id && !publishError && <p className="comm-note">Documento salvo como rascunho. Falta terminar de publicar.</p>}{publishError && <p className="comm-form-error" role="alert">{publishError}</p>}<footer><button type="button" onClick={() => setNewOpen(false)}>Cancelar</button><button className="comm-primary" disabled={publishing}>{publishing ? "Publicando…" : etapas.id ? "Terminar de publicar" : "Publicar"}</button></footer></form></Modal>}{selectedDocumentId && <Modal title={selectedDocument?.title ?? "Documento da Biblioteca"} onClose={closeDetail}>{detailLoading ? <div style={{ padding: 20 }} aria-busy="true">Carregando documento…</div> : detailError ? <div style={{ padding: 20 }} role="alert">{detailError}</div> : selectedDocument ? <article style={{ display: "grid", gap: 14, maxHeight: "70vh", overflowY: "auto", padding: 4 }}><div style={{ color: "#6b6482", fontSize: 12 }}>{tipoDoc(selectedDocument.type)} · v{selectedDocument.version}{selectedDocument.publishedAt ? ` · ${displayDate(selectedDocument.publishedAt)}` : ""}</div>{selectedDocument.summary && <p style={{ margin: 0, color: "#4a4363", lineHeight: 1.5 }}>{selectedDocument.summary}</p>}<div style={{ display: "grid", gridTemplateColumns: "minmax(120px, 0.28fr) minmax(0, 1fr)", gap: 16, alignItems: "start" }}><nav aria-label="Índice do documento" style={{ display: "grid", gap: 6, position: "sticky", top: 0 }}>{readerSections.map((section, index) => <button type="button" key={index} className={readerSection === index ? "comm-secondary active" : "comm-secondary"} onClick={() => setReaderSection(index)}>Seção {index + 1}</button>)}</nav><div><div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6, overflowWrap: "anywhere", minHeight: 140 }}>{readerSections[readerSection] ?? readerSections[0]}</div><footer style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 14 }}><button type="button" className="comm-secondary" disabled={readerSection === 0} onClick={() => setReaderSection(index => Math.max(0, index - 1))}>Anterior</button><small>Seção {readerSection + 1} de {readerSections.length}</small><button type="button" className="comm-secondary" disabled={readerSection >= readerSections.length - 1} onClick={() => setReaderSection(index => Math.min(readerSections.length - 1, index + 1))}>Próxima</button></footer></div></div>{citations.length > 0 && <section aria-label="Citações da fonte" style={{ borderTop: "1px solid #e8e5ee", paddingTop: 12, display: "grid", gap: 8 }}><h3 style={{ margin: 0, fontSize: 14 }}>Trechos com página · v{selectedDocument.version}</h3>{citations.map((citation, index) => <div key={`${citation.pageNumber}-${index}`} style={{ borderLeft: "2px solid #779b7c", paddingLeft: 10 }}><small>Página {citation.pageNumber}</small><p style={{ margin: "4px 0 0", whiteSpace: "pre-wrap" }}>{citation.excerpt}</p></div>)}</section>}{canManageCitations && <section aria-label="Gerenciar citações da Biblioteca" style={{ borderTop: "1px solid #e8e5ee", paddingTop: 12, display: "grid", gap: 10 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}><div><h3 style={{ margin: 0, fontSize: 14 }}>Citações por página</h3><small>Referências vinculadas à versão v{selectedDocument.version}</small></div><button type="button" className="comm-secondary" onClick={() => { setCitationRows(citations.map(item => ({ pageNumber: String(item.pageNumber), excerpt: item.excerpt })).concat(citations.length ? [] : [{ pageNumber: "", excerpt: "" }])); setCitationError(""); setEditingCitations(value => !value); }}>{editingCitations ? "Fechar edição" : "Editar"}</button></div>{editingCitations && <><p style={{ margin: 0, color: "#666", fontSize: 13 }}>Use o número da página do PDF e copie o trecho exatamente como aparece. Editar o texto ou substituir o PDF invalida estas referências.</p>{citationRows.map((row, index) => <div key={index} style={{ display: "grid", gridTemplateColumns: "5rem minmax(0, 1fr) auto", gap: 8, alignItems: "start" }}><label style={{ fontSize: 12 }}>Página<input type="number" min="1" value={row.pageNumber} onChange={event => setCitationRows(rows => rows.map((item, rowIndex) => rowIndex === index ? { ...item, pageNumber: event.target.value } : item))}/></label><label style={{ fontSize: 12 }}>Trecho exato<textarea rows={3} maxLength={1000} value={row.excerpt} onChange={event => setCitationRows(rows => rows.map((item, rowIndex) => rowIndex === index ? { ...item, excerpt: event.target.value } : item))}/></label><button type="button" className="comm-secondary" aria-label="Remover trecho" title="Remover trecho" onClick={() => setCitationRows(rows => rows.filter((_, rowIndex) => rowIndex !== index))}><X size={16}/></button></div>)}<div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}><button type="button" className="comm-secondary" onClick={() => setCitationRows(rows => [...rows, { pageNumber: "", excerpt: "" }])}><Plus size={16}/> Adicionar trecho</button><button type="button" className="comm-primary" disabled={savingCitations || citationRows.some(row => !Number.isInteger(Number(row.pageNumber)) || Number(row.pageNumber) < 1 || row.excerpt.trim().length < 8 || row.excerpt.trim().length > 1000)} onClick={() => void savePageCitations()}>{savingCitations ? "Salvando…" : "Salvar citações"}</button></div></>}{citationError && <p role="alert" style={{ margin: 0, color: "#a33" }}>{citationError}</p>}</section>}{!sample && <GestaoDoDocumento doc={selectedDocument} canManage={detailFlags.canManage} canArchive={detailFlags.canArchive} canSeeReaders={detailFlags.canSeeReaders} onNotice={setNotice} onChanged={() => { setDetailTick(value => value + 1); reload(); }} onArchived={() => { closeDetail(); reload(); }}/>}<footer style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>{(selectedDocument.fileUrl || selectedDocument.fileName) && <button className="comm-secondary" onClick={() => void openDocument(selectedDocument)}>Abrir arquivo <ChevronRight size={16}/></button>}{(sample ? selectedDocument.requiresConfirmation : selectedDocument.waitingMe) && <button className="comm-primary" onClick={() => void confirmSelected()}>Li e entendi</button>}</footer></article> : <div style={{ padding: 20 }} role="status">Documento não encontrado no seu acesso.</div>}</Modal>}</section>;
}
