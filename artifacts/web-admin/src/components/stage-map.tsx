import type { CSSProperties, ReactNode, RefObject } from "react";
import "./stage-map.css";

export type StageFormat = "L" | "RET" | "QUAD" | "NONE";
export type StageSide = "BL" | "BR" | "PER";
export type StageDefinition = {
  label: string;
  ratio?: number;
  points: string;
  clip: string;
  areas: Record<StageSide, [number, number, number, number]>;
  zones: [string, number, number][];
  openings: [number, number, string][];
  notes: [number, number][];
};
export type StagePoint = { side: StageSide; label: string; x: number; y: number };
export type StageMapApi = {
  LBL: string[];
  STAGES: Record<StageFormat, StageDefinition>;
  MODES: Record<string, string>;
  layout: (side: StageSide, labels: string[], area: [number, number, number, number], mode: string) => StagePoint[];
  buildMarkers: (scene: { bl: string[]; br: string[]; chars: [string, ...string[]][] }, kind: string, stage: StageDefinition) => StagePoint[];
};

export function stageMapApi(): StageMapApi | undefined {
  return (window as typeof window & { ASA_MAPA?: StageMapApi }).ASA_MAPA;
}

/** Posições de um quadro, pela mesma regra do mapa-palco.js: o tipo do quadro vira modo de
 * desenho via MODES. Shows e Livro do Dia chamam isto — a mesma cena cai no mesmo lugar. */
export function layoutFrame(api: StageMapApi, stage: StageDefinition, sides: Record<StageSide, string[]>, frameType: string | null | undefined): StagePoint[] {
  const mode = api.MODES[frameType ?? "inicial"] ?? "line";
  return [
    ...api.layout("BL", sides.BL, stage.areas.BL, mode),
    ...api.layout("BR", sides.BR, stage.areas.BR, mode),
    ...api.layout("PER", sides.PER, stage.areas.PER, "line"),
  ];
}

/** Mapa de palco único do app: mesma moldura e mesma medida no Shows e no Livro do Dia.
 * Só o conteúdo (zonas e marcadores, via children) muda de uma tela para a outra. */
export function StageMap({ stage, mapRef, children, className = "", thumb = false, label }: {
  stage: StageDefinition;
  mapRef?: RefObject<HTMLDivElement | null>;
  children?: ReactNode;
  className?: string;
  thumb?: boolean;
  label?: string;
}) {
  return <div ref={mapRef} className={`stage-map ${thumb ? "stage-map-thumb" : ""} ${className}`} style={{ aspectRatio: String(stage.ratio ?? 1), "--stage-ratio": String(stage.ratio ?? 1) } as CSSProperties} role="group" aria-label={label ?? stage.label}>
    <div className="stage-map-floor" style={{ clipPath: stage.clip }}/>
    <svg className="stage-map-outline" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polygon points={stage.points}/></svg>
    {stage.openings.map(([left, top, orientation], index) => <i className={`stage-map-opening ${orientation === "v" ? "vertical" : ""}`} style={{ left: `${left}%`, top: `${top}%` }} key={`${left}-${top}-${index}`}/>)}
    {children}
  </div>;
}
