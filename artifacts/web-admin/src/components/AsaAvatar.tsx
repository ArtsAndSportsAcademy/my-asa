import React, { useCallback, useEffect, useState } from "react";

export type AsaPose =
  | "idle"
  | "bomdia"
  | "boanoite"
  | "duvida"
  | "aviso_importante"
  | "arquivo"
  | "lembrete"
  | "tarefa_concluida"
  | "biblioteca"
  | "analisando"
  | "carregando"
  | "enviando"
  | "chuva"
  | "frio"
  | "recomendacao"
  | "comemoracao"
  | "vazio"
  | "focado"
  | "planejando"
  | "feliz";

const OFFICIAL_POSE_FILE: Record<AsaPose, string> = {
  idle: "oi", bomdia: "bom-dia", boanoite: "sonolenta", duvida: "duvida",
  aviso_importante: "aviso-importante", arquivo: "estudando", lembrete: "lembrete",
  tarefa_concluida: "tarefa-concluida", biblioteca: "estudando", analisando: "consultando",
  carregando: "pensativa", enviando: "travessa", chuva: "sonolenta", frio: "sonolenta",
  recomendacao: "pensativa", comemoracao: "vencemos", vazio: "oi", focado: "estudando",
  planejando: "pensativa", feliz: "olhos-de-estrela",
};

type AsaSize = "small" | "medium" | "large";

const SIZE_MAP: Record<AsaSize, number> = {
  small:  40,
  medium: 64,
  large:  96,
};

interface AsaAvatarProps {
  pose?: AsaPose;
  size?: AsaSize;
  className?: string;
  onClick?: () => void;
}

const FLOAT_KEYFRAMES = `
@keyframes asa-float {
  0%   { transform: translateY(0px); }
  50%  { transform: translateY(-6px); }
  100% { transform: translateY(0px); }
}
`;

let styleInjected = false;
function injectFloatStyle() {
  if (styleInjected || typeof document === "undefined") return;
  const style = document.createElement("style");
  style.textContent = FLOAT_KEYFRAMES;
  document.head.appendChild(style);
  styleInjected = true;
}

export function AsaAvatar({
  pose = "idle",
  size = "medium",
  className = "",
  onClick,
}: AsaAvatarProps) {
  const dim = SIZE_MAP[size];
  const [activePose, setActivePose] = useState<AsaPose>(pose);

  useEffect(() => {
    injectFloatStyle();
  }, []);

  useEffect(() => {
    setActivePose(pose);
  }, [pose]);

  const handleClick = useCallback(() => onClick?.(), [onClick]);

  return (
    <div
      className={`inline-flex flex-shrink-0 cursor-pointer select-none ${className}`}
      style={{
        width: dim,
        height: dim,
        animation: "asa-float 3s ease-in-out infinite",
      }}
      onClick={handleClick}
      title="ASA — assistente inteligente do MyASA"
    >
      <img
        src={`/asa/${OFFICIAL_POSE_FILE[activePose]}.webp`}
        onError={(event) => {
          if (event.currentTarget.src.endsWith(".webp")) {
            event.currentTarget.src = `/asa/${OFFICIAL_POSE_FILE[activePose]}.png`;
          }
        }}
        alt={`ASA — ${activePose}`}
        style={{ width: dim, height: dim, objectFit: "contain" }}
        draggable={false}
      />
    </div>
  );
}
