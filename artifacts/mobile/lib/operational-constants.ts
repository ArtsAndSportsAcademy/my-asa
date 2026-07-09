export const HEALTH_ICON: Record<string, string> = {
  HEALTHY:   "check-circle",
  ATTENTION: "alert-circle",
  RISK:      "alert-triangle",
  CRITICAL:  "x-circle",
};

export const HEALTH_LABEL: Record<string, string> = {
  HEALTHY:   "Saudável",
  ATTENTION: "Atenção",
  RISK:      "Risco",
  CRITICAL:  "Crítico",
};

export const EVENT_TYPE_LABELS: Record<string, string> = {
  SHOW:                "Espetáculo",
  REHEARSAL:           "Ensaio",
  MEETING:             "Reunião",
  OPERATIONAL_BLOCK:   "Bloco Op.",
  COLLECTIVE_VACATION: "Férias",
  EVENTO:              "Evento",
  EXTERNAL_SHOW:       "Show Externo",
  TRAINING:            "Treinamento",
  OTHER:               "Outro",
};

export const EVENT_TYPE_ICONS: Record<string, string> = {
  SHOW:                "star",
  REHEARSAL:           "music",
  MEETING:             "users",
  OPERATIONAL_BLOCK:   "briefcase",
  COLLECTIVE_VACATION: "sun",
  EVENTO:              "calendar",
  EXTERNAL_SHOW:       "map-pin",
  TRAINING:            "book-open",
  OTHER:               "more-horizontal",
};

export const ALLOCATION_STATUS_LABELS: Record<string, string> = {
  ASSIGNED:        "Alocado",
  OPEN:            "Em Aberto",
  CONFLICT:        "Conflito",
  MANUAL_OVERRIDE: "Override",
};

export const ALLOCATION_STATUS_COLORS: Record<string, string> = {
  ASSIGNED:        "#16A34A",
  OPEN:            "#6B7280",
  CONFLICT:        "#D97706",
  MANUAL_OVERRIDE: "#7C3AED",
};

export const EXCEPTION_TYPE_LABELS: Record<string, string> = {
  ALLOCATION_EXCEPTION: "Exceção",
  OPEN_POSITION:        "Aberto",
  CONFLICT:             "Conflito",
  MANUAL_OVERRIDE:      "Substituição",
};

export const SCALE_STATUS_LABELS: Record<string, string> = {
  DRAFT:       "Rascunho",
  PUBLISHED:   "Publicada",
  REPUBLISHED: "Republicada",
  ARCHIVED:    "Arquivada",
};

export const REQUEST_TYPE_LABELS: Record<string, string> = {
  AVAILABILITY_BLOCK:  "Bloqueio",
  LEAVE_REQUEST:       "Afastamento",
  TRANSFER_REQUEST:    "Transferência",
  ROLE_CHANGE_REQUEST: "Mudança de Função",
};

export const REQUEST_STATUS_LABELS: Record<string, string> = {
  PENDING:  "Pendente",
  APPROVED: "Aprovado",
  REJECTED: "Rejeitado",
  RESOLVED: "Resolvido",
};
