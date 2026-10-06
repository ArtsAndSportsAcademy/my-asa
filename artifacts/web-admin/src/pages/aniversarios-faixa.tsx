/**
 * Alto do Mural: aniversário de hoje (quem escolheu "mural no meu dia") e a lista da semana
 * (quem escolheu "só na lista" ou "mural"). Dia e mês, nunca o ano — a escolha é de cada pessoa, no Perfil.
 */
import { useEffect, useState } from "react";
import { customFetch } from "@workspace/api-client-react";
import { css } from "@/lib/dc-style";

type Aniversarios = { hoje: { id: string; nome: string }[]; semana: { id: string; nome: string; dia: string; emDias: number }[] };

export default function AniversariosFaixa() {
  const sample = import.meta.env.DEV && new URLSearchParams(window.location.search).get("amostra") === "1";
  const [dados, setDados] = useState<Aniversarios | null>(null);
  useEffect(() => {
    if (sample) { setDados({ hoje: [{ id: "a", nome: "Carol" }], semana: [{ id: "a", nome: "Carol", dia: "hoje", emDias: 0 }, { id: "b", nome: "Louis", dia: "03/10", emDias: 3 }] }); return; }
    customFetch<Aniversarios>("/api/mural/aniversarios").then(setDados).catch(() => setDados(null));
  }, [sample]);
  // O aniversário de hoje virou cartão no feed, com "Parabéns" (desenho 22); aqui fica só a semana.
  const proximos = dados?.semana.filter((p) => p.emDias > 0) ?? [];
  if (!proximos.length) return null;
  return <section aria-label="Aniversários" style={css("margin:16px 20px 0;display:flex;flex-wrap:wrap;align-items:center;gap:12px;background:linear-gradient(120deg,#fbeaf3,#f3ebff);border:1px solid #f0d5e6;border-radius:16px;padding:12px 16px")}>
    <img src="/asa/olhos-de-estrela.webp" alt="" style={css("width:40px;height:40px;object-fit:contain;flex:none")}/>
    <div style={css("display:flex;flex-direction:column;gap:3px;flex:1;min-width:200px")}>
      <span style={css("font-size:12.5px;color:#6b4a66")}>{`Aniversários nesta semana: ${proximos.map((p) => `${p.nome} (${p.dia})`).join(" · ")}`}</span>
    </div>
  </section>;
}
