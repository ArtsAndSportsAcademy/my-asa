/**
 * Link do Drive. O anexo da tarefa é só link: o Supabase gratuito não comporta arquivo. Aqui o link é lido, o endereço
 * "embutido" (que abre dentro do My ASA) é montado e, no melhor esforço, se descobre se o arquivo está compartilhado.
 *
 * Só dois hosts valem — drive.google.com e docs.google.com, escritos exatamente assim, em https. Isso também é o que
 * impede o servidor de virar porta de acesso a qualquer endereço quando confere o compartilhamento.
 */
export type LinkDrive =
  | { ok: true; host: "drive.google.com" | "docs.google.com"; fileId: string; kind: "file" | "document" | "spreadsheet" | "presentation" | "folder"; openUrl: string; embedUrl: string | null }
  | { ok: false; motivo: string };

const ID = /^[A-Za-z0-9_-]{3,}$/;
const RECUSA = "Cole um link do Google Drive (drive.google.com) ou de um documento do Google (docs.google.com).";

export function lerLinkDrive(texto: string): LinkDrive {
  let url: URL;
  try { url = new URL((texto ?? "").trim()); } catch { return { ok: false, motivo: `Isso não parece um link. ${RECUSA}` }; }
  if (url.protocol !== "https:") return { ok: false, motivo: `O link precisa começar com https://. ${RECUSA}` };
  // Porta e usuário no endereço fariam o servidor conectar onde o endereço mandar: só o endereço limpo do Google vale.
  if (url.port || url.username || url.password) return { ok: false, motivo: `Esse link do Drive tem porta ou usuário no endereço. ${RECUSA}` };
  const host = url.hostname;
  if (host !== "drive.google.com" && host !== "docs.google.com") return { ok: false, motivo: `Esse link não é do Google Drive. ${RECUSA}` };
  const partes = url.pathname.split("/").filter(Boolean);
  const aberto = (kind: "file" | "document" | "spreadsheet" | "presentation" | "folder", fileId: string, embedUrl: string | null): LinkDrive => ({ ok: true, host, fileId, kind, openUrl: url.toString(), embedUrl });

  if (host === "drive.google.com") {
    const arquivo = partes[0] === "file" && partes[1] === "d" ? partes[2] : undefined;
    if (arquivo && ID.test(arquivo)) return aberto("file", arquivo, `https://drive.google.com/file/d/${arquivo}/preview`);
    const antigo = partes[0] === "open" ? url.searchParams.get("id") : null;
    if (antigo && ID.test(antigo)) return aberto("file", antigo, `https://drive.google.com/file/d/${antigo}/preview`);
    const pasta = partes.includes("folders") ? partes[partes.indexOf("folders") + 1] : undefined;
    if (pasta && ID.test(pasta)) return aberto("folder", pasta, null);
    return { ok: false, motivo: `Esse link do Drive não aponta para um arquivo ou pasta. Abra o arquivo no Drive e copie o link de compartilhamento.` };
  }
  const tipos = { document: "document", spreadsheets: "spreadsheet", presentation: "presentation" } as const;
  const tipo = tipos[partes[0] as keyof typeof tipos];
  const id = partes[1] === "d" ? partes[2] : undefined;
  if (tipo && id && ID.test(id)) return aberto(tipo, id, `https://docs.google.com/${partes[0]}/d/${id}/${tipo === "presentation" ? "embed" : "preview"}`);
  return { ok: false, motivo: `Esse tipo de link do Google não abre aqui. Use um documento, planilha, apresentação ou arquivo do Drive.` };
}

/**
 * true = o Drive mostra o arquivo sem pedir login; false = pede login ou nega; null = não deu para saber (rede, Drive fora).
 * Sem integração com o Drive isto é melhor esforço: quem chama avisa, nunca bloqueia.
 */
export async function checarCompartilhamento(link: string, buscar: typeof fetch = fetch): Promise<boolean | null> {
  const lido = lerLinkDrive(link);
  if (!lido.ok) return null;
  try {
    const resposta = await buscar(lido.openUrl, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(4_000) });
    if (resposta.status === 200) return true;
    if (resposta.status >= 300 && resposta.status < 400) return /accounts\.google\.com/.test(resposta.headers.get("location") ?? "") ? false : null;
    if (resposta.status === 401 || resposta.status === 403 || resposta.status === 404) return false;
    return null;
  } catch {
    return null;
  }
}
