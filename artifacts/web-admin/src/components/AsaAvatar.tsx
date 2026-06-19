import React from "react";

type AsaSize = "small" | "medium" | "large";

const SIZE_MAP: Record<AsaSize, { img: string; wrapper: string }> = {
  small:  { img: "w-10 h-10",   wrapper: "w-10 h-10"   },
  medium: { img: "w-16 h-16",   wrapper: "w-16 h-16"   },
  large:  { img: "w-24 h-24",   wrapper: "w-24 h-24"   },
};

interface AsaAvatarProps {
  size?: AsaSize;
  className?: string;
}

export function AsaAvatar({ size = "medium", className = "" }: AsaAvatarProps) {
  const { img, wrapper } = SIZE_MAP[size];
  return (
    <div className={`${wrapper} rounded-full overflow-hidden flex-shrink-0 ${className}`}>
      <img
        src="/asa-avatar.png"
        alt="ASA — assistente inteligente do MyASA"
        className={`${img} object-cover rounded-full`}
      />
    </div>
  );
}
