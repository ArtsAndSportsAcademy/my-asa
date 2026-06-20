import React, { useCallback, useEffect, useRef, useState } from "react";

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

const REACTION_POSES: AsaPose[] = [
  "feliz", "comemoracao", "duvida", "bomdia", "recomendacao", "lembrete",
];

function randomReactionPose(current: AsaPose): AsaPose {
  const options = REACTION_POSES.filter((p) => p !== current);
  return options[Math.floor(Math.random() * options.length)];
}

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
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    injectFloatStyle();
  }, []);

  useEffect(() => {
    setActivePose(pose);
  }, [pose]);

  const handleClick = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const reaction = randomReactionPose(pose);
    setActivePose(reaction);
    timerRef.current = setTimeout(() => {
      setActivePose(pose);
      timerRef.current = null;
    }, 1500);
    onClick?.();
  }, [pose, onClick]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

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
        src={`/asa-poses/${activePose}.png`}
        alt={`ASA — ${activePose}`}
        style={{ width: dim, height: dim, objectFit: "contain" }}
        draggable={false}
      />
    </div>
  );
}
