export const HEALTH_CONFIG = {
  HEALTHY:   { label: "Saudável",  bg: "bg-green-50",  border: "border-green-200",  borderL: "border-l-green-500",  text: "text-green-700",  badge: "bg-green-100 text-green-800"   },
  ATTENTION: { label: "Atenção",   bg: "bg-amber-50",  border: "border-amber-200",  borderL: "border-l-amber-500",  text: "text-amber-700",  badge: "bg-amber-100 text-amber-800"   },
  RISK:      { label: "Risco",     bg: "bg-orange-50", border: "border-orange-200", borderL: "border-l-orange-500", text: "text-orange-700", badge: "bg-orange-100 text-orange-800" },
  CRITICAL:  { label: "Crítico",   bg: "bg-red-50",    border: "border-red-200",    borderL: "border-l-red-500",    text: "text-red-700",    badge: "bg-red-100 text-red-800"       },
} as const;

export const EVENT_TYPE_LABELS: Record<string, string> = {
  SHOW:                "Espetáculo",
  REHEARSAL:           "Ensaio",
  MEETING:             "Reunião",
  OPERATIONAL_BLOCK:   "Bloco Operacional",
  COLLECTIVE_VACATION: "Férias Coletivas",
};

export const EVENT_TYPE_BADGES: Record<string, string> = {
  SHOW:                "bg-violet-100 text-violet-800",
  REHEARSAL:           "bg-blue-100 text-blue-800",
  MEETING:             "bg-amber-100 text-amber-800",
  OPERATIONAL_BLOCK:   "bg-indigo-100 text-indigo-800",
  COLLECTIVE_VACATION: "bg-green-100 text-green-800",
};

export const EXCEPTION_TYPE_LABELS: Record<string, string> = {
  ALLOCATION_EXCEPTION: "Exceção",
  OPEN_POSITION:        "Aberto",
  CONFLICT:             "Conflito",
  MANUAL_OVERRIDE:      "Substituição",
};

export const EXCEPTION_TYPE_BADGES: Record<string, string> = {
  ALLOCATION_EXCEPTION: "bg-violet-100 text-violet-800",
  OPEN_POSITION:        "bg-red-100 text-red-800",
  CONFLICT:             "bg-orange-100 text-orange-800",
  MANUAL_OVERRIDE:      "bg-blue-100 text-blue-800",
};

export const SCALE_STATUS_LABELS: Record<string, string> = {
  DRAFT:       "Rascunho",
  PUBLISHED:   "Publicada",
  REPUBLISHED: "Republicada",
  ARCHIVED:    "Arquivada",
};

export const DOC_STATUS_LABELS: Record<string, string> = {
  DRAFT:     "Rascunho",
  PUBLISHED: "Publicado",
  UPDATED:   "Atualizado",
  ARCHIVED:  "Arquivado",
};

export const ALLOCATION_STATUS_LABELS: Record<string, string> = {
  ASSIGNED:        "Alocado",
  OPEN:            "Em Aberto",
  CONFLICT:        "Conflito",
  MANUAL_OVERRIDE: "Override",
};
