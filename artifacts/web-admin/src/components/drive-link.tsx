import { ExternalLink, TriangleAlert } from "lucide-react";

/** O endereço que abre dentro do app (mesma regra do servidor); pasta e tipo desconhecido não abrem embutidos. */
export function embedDoDrive(openUrl: string): string | null {
  try {
    const url = new URL(openUrl);
    const partes = url.pathname.split("/").filter(Boolean);
    if (url.hostname === "drive.google.com") {
      const id = partes[0] === "file" && partes[1] === "d" ? partes[2] : partes[0] === "open" ? url.searchParams.get("id") : null;
      return id ? `https://drive.google.com/file/d/${id}/preview` : null;
    }
    if (url.hostname === "docs.google.com" && partes[1] === "d" && partes[2] && ["document", "spreadsheets", "presentation"].includes(partes[0]!)) {
      return `https://docs.google.com/${partes[0]}/d/${partes[2]}/${partes[0] === "presentation" ? "embed" : "preview"}`;
    }
  } catch { /* link que não é endereço: sem visualização */ }
  return null;
}

/**
 * O link do Drive aberto dentro do My ASA. Quando o arquivo não está compartilhado o Drive pede login dentro da janela, então o
 * aviso vem antes. "Abrir no Drive" fica sempre à mão: pasta e alguns arquivos não abrem embutidos.
 */
export function LinkDrive({ openUrl, shared, descricao, aberto = false }: { openUrl: string; shared?: boolean | null; descricao?: string | null; aberto?: boolean }) {
  const embed = embedDoDrive(openUrl);
  return <div className="rt-drive">
    <div className="rt-drive-head"><strong>{descricao || "Link do Drive"}</strong><a href={openUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={14}/>Abrir no Drive</a></div>
    {shared === false && <p className="rt-drive-warn" role="status"><TriangleAlert size={14}/>Esse arquivo não está compartilhado. Quem for abrir vai ver um pedido de acesso: compartilhe o arquivo com quem precisa.</p>}
    {embed
      ? <details open={aberto}><summary>Ver aqui no app</summary><iframe src={embed} title={descricao || "Arquivo do Drive"} loading="lazy" referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-popups allow-forms"/></details>
      : <p className="rt-drive-note">Esse tipo de link não abre aqui dentro. Use “Abrir no Drive”.</p>}
  </div>;
}
