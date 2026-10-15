/**
 * Peças que o Mural, as Mensagens e a Biblioteca dividem: a janela (Esc fecha; toque fora só fecha sem texto
 * digitado), o estado de carregando/erro/vazio e alguns formatadores. O estilo mora em pages/communication.css.
 */
import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { ApiError } from "@workspace/api-client-react";

export type Role = "adm" | "dir" | "sup" | "mem";
export type Person = { id: string; name: string; areaName?: string | null };
export type Option = { id: string; name: string };

/** Texto do servidor quando ele explica o porquê; senão, o texto da tela. */
export const serverError = (err: unknown, fallback: string) => {
  if (err instanceof ApiError) { const data = err.data as { error?: string; message?: string } | null; return data?.message ?? data?.error ?? fallback; }
  return fallback;
};

export const displayDate = (value?: string) => value ? new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "agora";
export const initials = (name: string) => name.split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase();
export const now = () => new Date().toISOString();

export function State({ loading, error, empty, emptyHint, onRetry, children }: { loading: boolean; error: string; empty: boolean; emptyHint?: string; onRetry: () => void; children: React.ReactNode }) {
  if (loading) return <div className="comm-state comm-skeleton" aria-busy="true"><i/><i/><i/></div>;
  if (error) return <div className="comm-state comm-error"><img src="/asa/duvida.webp" alt=""/><strong>{error}</strong><button onClick={onRetry}>Tentar de novo</button></div>;
  if (empty) return <div className="comm-state"><img src="/asa/oi.webp" alt=""/><strong>Ainda não há nada aqui</strong><span>{emptyHint ?? "Quando houver algo no seu acesso, aparece no mural."}</span></div>;
  return <>{children}</>;
}

export function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  const janela = useRef<HTMLElement>(null);
  // Esc sai da janela, como o ×: no telefone, com o teclado aberto, o × some da tela.
  useEffect(() => {
    const aoTeclar = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [onClose]);
  // Um toque fora também fecha, mas não quando já há texto escrito: no telefone é fácil encostar fora sem querer e perder um aviso inteiro.
  const tocouFora = () => {
    const campos = Array.from(janela.current?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("textarea, input:not([type=checkbox]):not([type=hidden]):not([type=search])") ?? []);
    if (!campos.some(campo => campo.value.trim())) onClose();
  };
  return <div className="comm-backdrop" onMouseDown={tocouFora}><section ref={janela} className="comm-modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={event => event.stopPropagation()}><header><h2>{title}</h2><button onClick={onClose} aria-label="Fechar"><X/></button></header>{children}</section></div>;
}
