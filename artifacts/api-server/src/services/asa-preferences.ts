export type AsaPreferencePatch = {
  mode?: "SILENT" | "BALANCED" | "PROACTIVE";
  morningGreeting?: boolean;
  eveningGreeting?: boolean;
  reminders?: boolean;
  birthdayAlerts?: boolean;
  notificationsEnabled?: boolean;
  goodMorningTime?: string | null;
  goodNightTime?: string | null;
  messageFrequency?: "DAILY" | "WEEKLY" | "REALTIME";
  proactivityLevel?: "LOW" | "MEDIUM" | "HIGH";
};

export type AsaPreferencePatchParse =
  | { ok: true; value: AsaPreferencePatch }
  | { ok: false; error: string };

export type AsaModeCommand =
  | { kind: "not_action" }
  | { kind: "incomplete" }
  | { kind: "request"; mode: "SILENT" | "BALANCED" | "PROACTIVE" };

export type AsaPreferenceCommand =
  | { kind: "not_action" }
  | { kind: "incomplete" }
  | { kind: "request"; patch: AsaPreferencePatch };

const PREFERENCE_COMMANDS: Record<string, AsaPreferencePatch> = {
  "ative a saudacao da manha": { morningGreeting: true },
  "desative a saudacao da manha": { morningGreeting: false },
  "ative a saudacao da noite": { eveningGreeting: true },
  "desative a saudacao da noite": { eveningGreeting: false },
  "ative meus lembretes da asa": { reminders: true },
  "desative meus lembretes da asa": { reminders: false },
  "ative alertas de aniversario": { birthdayAlerts: true },
  "desative alertas de aniversario": { birthdayAlerts: false },
  "ative notificacoes da asa": { notificationsEnabled: true },
  "desative notificacoes da asa": { notificationsEnabled: false },
  "mude a frequencia da asa para tempo real": { messageFrequency: "REALTIME" },
  "mude a frequencia da asa para diaria": { messageFrequency: "DAILY" },
  "mude a frequencia da asa para semanal": { messageFrequency: "WEEKLY" },
  "defina a proatividade da asa como baixa": { proactivityLevel: "LOW" },
  "defina a proatividade da asa como media": { proactivityLevel: "MEDIUM" },
  "defina a proatividade da asa como alta": { proactivityLevel: "HIGH" },
};

const PREFERENCE_LABELS: Record<keyof AsaPreferencePatch, string> = {
  mode: "Sugestões",
  morningGreeting: "Saudação da manhã",
  eveningGreeting: "Saudação da noite",
  reminders: "Lembretes",
  birthdayAlerts: "Alertas de aniversário",
  notificationsEnabled: "Notificações da ASA",
  goodMorningTime: "Horário da saudação da manhã",
  goodNightTime: "Horário da saudação da noite",
  messageFrequency: "Frequência",
  proactivityLevel: "Nível de proatividade",
};

export function asaPreferenceLabel(key: keyof AsaPreferencePatch): string {
  return PREFERENCE_LABELS[key];
}

export function formatAsaPreferenceValue(key: keyof AsaPreferencePatch, value: unknown): string {
  if (key === "mode") return value === "SILENT" ? "Pausadas" : value === "PROACTIVE" ? "Proativas" : "Equilibradas";
  if (key === "morningGreeting" || key === "eveningGreeting" || key === "reminders" || key === "birthdayAlerts" || key === "notificationsEnabled") {
    return value === true ? "Ativado" : "Desativado";
  }
  if (key === "messageFrequency") return value === "REALTIME" ? "Tempo real" : value === "WEEKLY" ? "Semanal" : "Diária";
  if (key === "proactivityLevel") return value === "LOW" ? "Baixa" : value === "HIGH" ? "Alta" : "Média";
  return typeof value === "string" && value ? value : "Não definido";
}

export function parseAsaModeCommand(input: string): AsaModeCommand {
  const normalized = input.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ").trim();
  const requests: Record<string, "SILENT" | "BALANCED" | "PROACTIVE"> = {
    "pause minhas sugestoes": "SILENT",
    "pause minhas sugestoes da asa": "SILENT",
    "pause as sugestoes da asa": "SILENT",
    "silencie a asa": "SILENT",
    "retome minhas sugestoes": "BALANCED",
    "retome minhas sugestoes da asa": "BALANCED",
    "retome as sugestoes da asa": "BALANCED",
    "reative as sugestoes da asa": "BALANCED",
    "reative a asa": "BALANCED",
    "ative sugestoes proativas da asa": "PROACTIVE",
    "mude o modo da asa para proativo": "PROACTIVE",
    "mude o modo da asa para equilibrado": "BALANCED",
  };
  const mode = requests[normalized];
  if (mode) return { kind: "request", mode };
  if (/^(pause|silencie|retome|reative)\b/.test(normalized)) return { kind: "incomplete" };
  return { kind: "not_action" };
}

export function parseAsaPreferenceCommand(input: string): AsaPreferenceCommand {
  const mode = parseAsaModeCommand(input);
  if (mode.kind === "request") return { kind: "request", patch: { mode: mode.mode } };
  if (mode.kind === "incomplete") return mode;

  const normalized = input.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9:]+/g, " ").replace(/\s+/g, " ").trim();
  const exactPatch = PREFERENCE_COMMANDS[normalized];
  if (exactPatch) return { kind: "request", patch: exactPatch };

  const timeRequest = /^(?:mude|altere) o horario da saudacao da (manha|noite) para (\d{2}:\d{2})$/.exec(normalized);
  if (timeRequest && /^([01]\d|2[0-3]):[0-5]\d$/.test(timeRequest[2]!)) {
    return { kind: "request", patch: timeRequest[1] === "manha"
      ? { goodMorningTime: timeRequest[2]! }
      : { goodNightTime: timeRequest[2]! } };
  }
  if (/^(ative|desative)\b/.test(normalized)
    || /^(mude|altere|defina)\b/.test(normalized)) return { kind: "incomplete" };
  return { kind: "not_action" };
}

const ALLOWED_FIELDS = new Set([
  "mode", "morningGreeting", "eveningGreeting", "reminders", "birthdayAlerts", "notificationsEnabled",
  "goodMorningTime", "goodNightTime", "messageFrequency", "proactivityLevel",
]);

export function parseAsaPreferencePatch(input: unknown): AsaPreferencePatchParse {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "Preferências inválidas" };
  }
  const body = input as Record<string, unknown>;
  if (Object.keys(body).some((key) => !ALLOWED_FIELDS.has(key))) {
    return { ok: false, error: "Campo de preferência não permitido" };
  }
  for (const key of ["morningGreeting", "eveningGreeting", "reminders", "birthdayAlerts", "notificationsEnabled"] as const) {
    if (body[key] !== undefined && typeof body[key] !== "boolean") {
      return { ok: false, error: `Preferência ${key} inválida` };
    }
  }
  for (const key of ["goodMorningTime", "goodNightTime"] as const) {
    if (body[key] !== undefined && body[key] !== null
      && (typeof body[key] !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(body[key]))) {
      return { ok: false, error: `Horário ${key} inválido` };
    }
  }
  if (body.mode !== undefined && body.mode !== "SILENT" && body.mode !== "BALANCED" && body.mode !== "PROACTIVE") {
    return { ok: false, error: "Modo ASA inválido" };
  }
  if (body.messageFrequency !== undefined && body.messageFrequency !== "DAILY" && body.messageFrequency !== "WEEKLY" && body.messageFrequency !== "REALTIME") {
    return { ok: false, error: "Frequência ASA inválida" };
  }
  if (body.proactivityLevel !== undefined && body.proactivityLevel !== "LOW" && body.proactivityLevel !== "MEDIUM" && body.proactivityLevel !== "HIGH") {
    return { ok: false, error: "Nível de proatividade inválido" };
  }
  const value: AsaPreferencePatch = {};
  if (body.mode !== undefined) value.mode = body.mode as AsaPreferencePatch["mode"];
  if (body.morningGreeting !== undefined) value.morningGreeting = body.morningGreeting as boolean;
  if (body.eveningGreeting !== undefined) value.eveningGreeting = body.eveningGreeting as boolean;
  if (body.reminders !== undefined) value.reminders = body.reminders as boolean;
  if (body.birthdayAlerts !== undefined) value.birthdayAlerts = body.birthdayAlerts as boolean;
  if (body.notificationsEnabled !== undefined) value.notificationsEnabled = body.notificationsEnabled as boolean;
  if (body.goodMorningTime !== undefined) value.goodMorningTime = body.goodMorningTime as string | null;
  if (body.goodNightTime !== undefined) value.goodNightTime = body.goodNightTime as string | null;
  if (body.messageFrequency !== undefined) value.messageFrequency = body.messageFrequency as AsaPreferencePatch["messageFrequency"];
  if (body.proactivityLevel !== undefined) value.proactivityLevel = body.proactivityLevel as AsaPreferencePatch["proactivityLevel"];
  return { ok: true, value };
}
