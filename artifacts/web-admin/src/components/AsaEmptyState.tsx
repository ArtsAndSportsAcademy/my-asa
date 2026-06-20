import React from "react";
import { AsaAvatar, AsaPose } from "./AsaAvatar";

interface AsaEmptyStateProps {
  title: string;
  subtitle?: string;
  pose?: AsaPose;
  className?: string;
}

export function AsaEmptyState({
  title,
  subtitle,
  pose = "duvida",
  className = "",
}: AsaEmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-16 px-8 ${className}`}>
      <AsaAvatar size="large" pose={pose} />
      <p className="text-base font-semibold text-foreground text-center mt-1">{title}</p>
      {subtitle && (
        <p className="text-sm text-muted-foreground text-center max-w-xs leading-relaxed">
          {subtitle}
        </p>
      )}
    </div>
  );
}
