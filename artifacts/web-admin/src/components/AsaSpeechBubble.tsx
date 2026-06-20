import React, { useEffect, useRef, useState } from "react";

interface AsaSpeechBubbleProps {
  text: string;
  duration?: number;
  visible?: boolean;
  className?: string;
  direction?: "left" | "top";
}

export function AsaSpeechBubble({
  text,
  duration = 4000,
  visible = true,
  className = "",
  direction = "left",
}: AsaSpeechBubbleProps) {
  const [phase, setPhase] = useState<"hidden" | "in" | "visible" | "out">("hidden");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (!visible) {
      setPhase("out");
      timerRef.current = setTimeout(() => setPhase("hidden"), 400);
      return;
    }

    setPhase("in");
    timerRef.current = setTimeout(() => setPhase("visible"), 10);

    const hide = setTimeout(() => {
      setPhase("out");
      setTimeout(() => setPhase("hidden"), 400);
    }, duration);

    return () => {
      clearTimeout(hide);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [visible, text]);

  if (phase === "hidden") return null;

  const isIn = phase === "in";

  const tailClass =
    direction === "left"
      ? [
          "absolute -left-[9px] top-3 w-0 h-0",
          "border-t-[7px] border-t-transparent",
          "border-b-[7px] border-b-transparent",
          "border-r-[9px] border-r-border",
        ].join(" ")
      : [
          "absolute left-3 -top-[9px] w-0 h-0",
          "border-l-[7px] border-l-transparent",
          "border-r-[7px] border-r-transparent",
          "border-b-[9px] border-b-border",
        ].join(" ");

  const tailInnerClass =
    direction === "left"
      ? [
          "absolute -left-[7px] top-[8px] w-0 h-0",
          "border-t-[6px] border-t-transparent",
          "border-b-[6px] border-b-transparent",
          "border-r-[8px] border-r-card",
        ].join(" ")
      : [
          "absolute left-[9px] -top-[7px] w-0 h-0",
          "border-l-[6px] border-l-transparent",
          "border-r-[6px] border-r-transparent",
          "border-b-[8px] border-b-card",
        ].join(" ");

  return (
    <div
      className={`relative transition-all duration-300 ease-out ${
        isIn ? "opacity-0 scale-90" : "opacity-100 scale-100"
      } ${phase === "out" ? "opacity-0 scale-90" : ""} ${className}`}
      style={{ transformOrigin: direction === "left" ? "left center" : "center top" }}
    >
      <div className={tailClass} />
      <div className={tailInnerClass} />
      <div className="bg-card border border-border rounded-xl px-3 py-2 shadow-sm max-w-[220px]">
        <p className="text-xs font-medium text-foreground leading-snug">{text}</p>
      </div>
    </div>
  );
}
