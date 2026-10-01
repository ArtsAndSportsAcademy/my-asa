/**
 * D6 do plano: aviso único de "sem conexão", em qualquer tela. O camarim tem sinal ruim; quem está
 * sem rede precisa saber que a tela pode estar velha e que o que mandar agora não fica guardado.
 * Liga quando o navegador diz que está offline OU quando um pedido ao servidor falha por rede
 * (celular "conectado", mas sem sinal de verdade). Desliga na primeira resposta que chegar.
 */
import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { setNetworkStatusHandler } from "@workspace/api-client-react";

const SEM_REDE = "myasa:sem-rede", COM_REDE = "myasa:com-rede";
// Dá razão ao pedido que começou por último: um pedido antigo que termina depois não desfaz o estado.
let inicioMaisRecente = 0;
if (typeof window !== "undefined") {
  setNetworkStatusHandler((online, startedAt) => {
    if (startedAt < inicioMaisRecente) return;
    inicioMaisRecente = startedAt;
    window.dispatchEvent(new Event(online ? COM_REDE : SEM_REDE));
  });
}

export function useOnline() {
  const [online, setOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    window.addEventListener(COM_REDE, on);
    window.addEventListener(SEM_REDE, off);
    return () => {
      window.removeEventListener("online", on); window.removeEventListener("offline", off);
      window.removeEventListener(COM_REDE, on); window.removeEventListener(SEM_REDE, off);
    };
  }, []);
  return online;
}

export default function AvisoSemConexao() {
  const online = useOnline();
  if (online) return null;
  return <div role="status" aria-live="polite" className="asa-sem-conexao">
    <WifiOff size={18} aria-hidden="true"/>
    <span><strong>Sem conexão.</strong> O que está na tela pode estar desatualizado, e o que você mandar agora não fica guardado. Para check-in ou falta, avise a sua supervisão por fora.</span>
  </div>;
}
