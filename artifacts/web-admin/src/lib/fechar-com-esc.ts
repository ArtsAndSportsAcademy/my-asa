import { useEffect } from "react";

/**
 * Esc fecha o diálogo aberto, como em qualquer janela do sistema. Sem isto a pessoa precisa
 * achar o × — e no telefone, com o teclado aberto, o × costuma ficar escondido.
 */
export function useFecharComEsc(onClose: () => void, ativo = true) {
  useEffect(() => {
    if (!ativo) return;
    const aoTeclar = (evento: KeyboardEvent) => { if (evento.key === "Escape") { evento.stopPropagation(); onClose(); } };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [onClose, ativo]);
}
