import { useEffect, useState } from "react";
import { customFetch } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

type InstallEvent = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> };
export function isIosOutsideSafari(userAgent: string, installed: boolean) {
  return !installed && /iPhone|iPad|iPod/.test(userAgent) && (!/Safari/.test(userAgent) || /CriOS|FxiOS|EdgiOS|OPiOS|WhatsApp|Instagram|FBAN|FBAV/.test(userAgent));
}
function installedMode() { return window.matchMedia("(display-mode: standalone)").matches || window.matchMedia("(display-mode: fullscreen)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone); }
/** Este aparelho já recebe avisos (app instalado, permissão dada e inscrição no push). */
export function usePushSubscribed(installed: boolean) {
  const [subscribed, setSubscribed] = useState(false);
  useEffect(() => {
    if (!installed || !("serviceWorker" in navigator) || !("Notification" in window) || Notification.permission !== "granted") return;
    navigator.serviceWorker.ready.then(registration => registration.pushManager.getSubscription()).then(subscription => setSubscribed(Boolean(subscription))).catch(() => undefined);
  }, [installed]);
  return [subscribed, setSubscribed] as const;
}
export { installedMode };
function installationId() { let id = localStorage.getItem("myasa_installation_id"); if (!id) { id = crypto.randomUUID(); localStorage.setItem("myasa_installation_id", id); } return id; }
/** `embedded`: dentro do cartão de instalação do Meu Dia — sem título nem instruções (o cartão já dá), só a ação; some quando os avisos já estão ativos. */
export function PwaSetup({ embedded = false }: { embedded?: boolean } = {}) {
  const { isAuthenticated } = useAuth();
  const [installed, setInstalled] = useState(installedMode), [prompt, setPrompt] = useState<InstallEvent | null>(null), [message, setMessage] = useState(""), [busy, setBusy] = useState(false), [registered, setRegistered] = useState(false);
  const [config, setConfig] = useState<{ configured: boolean; publicKey: string } | null>(null);
  const [subscribed, setSubscribed] = usePushSubscribed(installed);
  useEffect(() => {
    if (!isAuthenticated || !("serviceWorker" in navigator)) return;
    customFetch<{ configured: boolean; publicKey: string }>("/api/web-push/config").then(setConfig).catch(() => setConfig(null));
    navigator.serviceWorker.register("/sw.js").catch(() => setMessage("Não foi possível preparar a instalação. Verifique a conexão e o HTTPS."));
    const before = (event: Event) => { event.preventDefault(); setPrompt(event as InstallEvent); };
    const installedEvent = () => { setPrompt(null); setMessage("Instalado. Abra o My ASA pelo ícone para ativar notificações."); };
    window.addEventListener("beforeinstallprompt", before); window.addEventListener("appinstalled", installedEvent);
    const mode = window.matchMedia("(display-mode: standalone)");
    const changed = () => setInstalled(installedMode()); mode.addEventListener("change", changed);
    if (installed) customFetch("/api/pwa/installations", { method: "POST", body: JSON.stringify({ installationId: installationId(), displayMode: "standalone" }) }).then(() => setRegistered(true)).catch(() => setMessage("Falhou o registro da instalação. Reabra o app para tentar novamente."));
    return () => { window.removeEventListener("beforeinstallprompt", before); window.removeEventListener("appinstalled", installedEvent); mode.removeEventListener("change", changed); };
  }, [isAuthenticated, installed]);
  async function subscribe() {
    if (!installed || !registered) return;
    setBusy(true); setMessage("");
    try {
      if (!("Notification" in window) || !("PushManager" in window)) throw new Error("Este navegador não suporta Web Push. No iPhone, use iOS 16.4 ou mais recente.");
      if (!config?.configured) throw new Error("A Administração ainda precisa configurar as chaves de notificações.");
      // requestPermission belongs to the direct user gesture; avoid asking automatically on load.
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Notificações não autorizadas. Você pode liberar nas configurações do navegador.");
      const registration = await navigator.serviceWorker.ready;
      const binary = atob(config.publicKey.replace(/-/g, "+").replace(/_/g, "/"));
      const key = Uint8Array.from(binary, character => character.charCodeAt(0));
      const subscription = await registration.pushManager.getSubscription() ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      await customFetch("/api/web-push/subscriptions", { method: "POST", body: JSON.stringify({ ...subscription.toJSON(), installationId: installationId() }) });
      setSubscribed(true);
      setMessage("Ativadas: escala mudou, check-in do turno e aviso que pede ciente.");
    } catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  }
  if (!isAuthenticated) return null;
  const outside = isIosOutsideSafari(navigator.userAgent, installed);
  if (embedded) {
    if (subscribed && !message) return null;
    return <div className="asa-install-action">
      {!installed ? prompt && <Button size="sm" onClick={async () => { await prompt.prompt(); await prompt.userChoice; setPrompt(null); }}>Instalar My ASA</Button> : !subscribed && <Button size="sm" disabled={busy || !registered} onClick={subscribe}>Ativar notificações</Button>}
      {message && <p role="status">{message}</p>}
    </div>;
  }
  return <section className="mt-8 rounded-lg border bg-card p-4 space-y-2 text-sm" aria-label="Instalar e ativar notificações"><h2 className="font-medium">My ASA no seu celular</h2>
    {!installed ? <><p>1. Instale na tela de início. 2. Abra pelo ícone. Só depois ative as notificações.</p>{outside ? <p className="text-amber-800">No iPhone, abra este endereço no Safari para instalar. Use Compartilhar → Adicionar à Tela de Início.</p> : prompt ? <Button size="sm" onClick={async () => { await prompt.prompt(); await prompt.userChoice; setPrompt(null); }}>Instalar My ASA</Button> : <p>{/iPhone|iPad|iPod/.test(navigator.userAgent) ? "No Safari: Compartilhar → Adicionar à Tela de Início." : "No menu do navegador, escolha Instalar app. Depois abra pelo ícone."}</p>}</> : <><p>Instalação identificada. Agora você pode ativar os três avisos.</p><Button size="sm" disabled={busy || !registered} onClick={subscribe}>Ativar notificações</Button></>}
    {message && <p role="status">{message}</p>}
  </section>;
}
