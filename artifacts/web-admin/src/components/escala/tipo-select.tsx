import type { CSSProperties } from "react";
import type { TipoDoLocal } from "./tipos";

/**
 * Lista de escolha do tipo de uma atividade. "Automático" não escolhe tipo: a Escala adivinha pelo nome, como sempre fez.
 * Tipo arquivado só aparece quando é o que a atividade já tem (para não sumir da tela); não dá para escolhê-lo de novo.
 */
export function TipoSelect({ tipos, value, onChange, disabled, style, ariaLabel = "Tipo da atividade" }: {
  tipos: TipoDoLocal[]; value: string | null | undefined; onChange: (tipoId: string | null) => void; disabled?: boolean; style?: CSSProperties; ariaLabel?: string;
}) {
  const atuais = tipos.filter((t) => t.active || t.id === value);
  return <select aria-label={ariaLabel} value={value ?? ""} disabled={disabled} style={style} onChange={(e) => onChange(e.target.value || null)}>
    <option value="">Automático (pelo nome da atividade)</option>
    {atuais.map((t) => <option key={t.id} value={t.id}>{t.active ? t.nome : `${t.nome} (arquivado)`}</option>)}
  </select>;
}
