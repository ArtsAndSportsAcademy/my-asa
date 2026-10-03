/**
 * Regras puras da configuração global de turnos.
 * Intervalos incluem o início e excluem o fim; podem atravessar meia-noite.
 * Atividades no intervalo após o turno estendem seu encerramento (decisão 03/10).
 */
export interface ShiftScheduleInput {
  name: string;
  startTime: string;
  endTime: string;
}

export interface ShiftScheduleGap {
  startTime: string;
  endTime: string;
  minutes: number;
  previousShiftIndex: number;
}

const DAY = 1440;

export function shiftTimeMinutes(value: string): number {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    throw new Error("Informe o horário no formato HH:mm, entre 00:00 e 23:59.");
  }
  const [hours, minutes] = value.split(":").map(Number);
  return hours! * 60 + minutes!;
}

function clock(minutes: number): string {
  const normalized = ((minutes % DAY) + DAY) % DAY;
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
}

function duration(shift: ShiftScheduleInput): number {
  return (shiftTimeMinutes(shift.endTime) - shiftTimeMinutes(shift.startTime) + DAY) % DAY;
}

/** Validação também deve ser chamada no servidor, nunca somente no formulário. */
export function validateShiftSchedule(input: readonly ShiftScheduleInput[]): {
  shifts: ShiftScheduleInput[];
  gaps: ShiftScheduleGap[];
} {
  if (input.length < 1 || input.length > 3) {
    throw new Error("Configure de 1 a 3 turnos.");
  }
  const shifts = input.map((shift) => ({
    name: shift.name.trim(), startTime: shift.startTime, endTime: shift.endTime,
  }));
  const names = new Set<string>();
  const ownership = Array<number>(DAY).fill(-1);
  for (const [index, shift] of shifts.entries()) {
    if (!shift.name || shift.name.length > 80) {
      throw new Error("O nome do turno deve ter entre 1 e 80 caracteres.");
    }
    const nameKey = shift.name.normalize("NFKC").toLocaleLowerCase("pt-BR");
    if (names.has(nameKey)) throw new Error("Use um nome diferente para cada turno.");
    names.add(nameKey);
    const start = shiftTimeMinutes(shift.startTime);
    const length = duration(shift);
    if (length === 0) throw new Error("O início e o fim do turno devem ser diferentes.");
    for (let offset = 0; offset < length; offset++) {
      const minute = (start + offset) % DAY;
      if (ownership[minute] !== -1) throw new Error("Os horários dos turnos não podem se sobrepor.");
      ownership[minute] = index;
    }
  }

  const gaps: ShiftScheduleGap[] = [];
  // Cada transição de um turno para minutos livres inicia exatamente um buraco,
  // inclusive quando ele cruza meia-noite. Os índices preservam a ordem enviada.
  for (let minute = 0; minute < DAY; minute++) {
    const previous = ownership[(minute + DAY - 1) % DAY]!;
    if (ownership[minute] !== -1 || previous === -1) continue;
    let length = 1;
    while (length < DAY && ownership[(minute + length) % DAY] === -1) length++;
    gaps.push({ startTime: clock(minute), endTime: clock(minute + length), minutes: length, previousShiftIndex: previous });
  }
  return { shifts, gaps };
}

/**
 * Classifica SOMENTE pelo início da atividade, nunca pela sua duração.
 * Em um buraco, retorna o turno anterior e sinaliza isso explicitamente.
 * startDayOffset é relativo à data civil da atividade (0 ou -1).
 */
export function assignActivityToShift(input: readonly ShiftScheduleInput[], activityStart: string): {
  shiftIndex: number;
  startDayOffset: 0 | -1;
  inGap: boolean;
} {
  const { shifts } = validateShiftSchedule(input);
  const minute = shiftTimeMinutes(activityStart);
  let selected = 0;
  let nearestStart = DAY + 1;
  for (const [index, shift] of shifts.entries()) {
    const distance = (minute - shiftTimeMinutes(shift.startTime) + DAY) % DAY;
    if (distance < nearestStart) { selected = index; nearestStart = distance; }
  }
  const shift = shifts[selected]!;
  return {
    shiftIndex: selected,
    startDayOffset: shiftTimeMinutes(shift.startTime) > minute ? -1 : 0,
    inGap: nearestStart >= duration(shift),
  };
}

/**
 * Janela de uma pessoa numa ocorrência de turno. O chamador deve fornecer apenas
 * suas atividades de escalas publicadas, todas da mesma ocorrência de turno.
 * Minutos são relativos à meia-noite da data em que o turno começou, podendo
 * ser negativos (abertura na véspera) ou maiores que 1440 (fim no dia seguinte).
 * Não converter esses valores diretamente em horários UTC.
 */
export function shiftCheckInWindow(
  input: readonly ShiftScheduleInput[],
  shiftIndex: number,
  activities: readonly { startTime: string; endTime: string }[],
): { opensAtMinute: number; firstActivityMinute: number; closesAtMinute: number; extended: boolean } | null {
  const { shifts } = validateShiftSchedule(input);
  const shift = shifts[shiftIndex];
  if (!Number.isInteger(shiftIndex) || !shift) throw new Error("Turno inválido.");
  if (!activities.length) return null;
  const shiftStart = shiftTimeMinutes(shift.startTime);
  const nominalEnd = shiftStart + duration(shift);
  let firstActivity = Infinity;
  let lastActivityEnd = nominalEnd;
  let hasGapActivity = false;
  for (const activity of activities) {
    const assignment = assignActivityToShift(shifts, activity.startTime);
    if (assignment.shiftIndex !== shiftIndex) throw new Error("A atividade pertence a outro turno.");
    const startClock = shiftTimeMinutes(activity.startTime);
    const endClock = shiftTimeMinutes(activity.endTime);
    const activityDuration = (endClock - startClock + DAY) % DAY;
    if (!activityDuration) throw new Error("A atividade precisa ter início e fim diferentes.");
    const start = startClock - assignment.startDayOffset * DAY;
    firstActivity = Math.min(firstActivity, start);
    lastActivityEnd = Math.max(lastActivityEnd, start + activityDuration);
    hasGapActivity ||= assignment.inGap;
  }
  const closesAtMinute = hasGapActivity ? lastActivityEnd : nominalEnd;
  return {
    opensAtMinute: firstActivity - 120,
    firstActivityMinute: firstActivity,
    closesAtMinute,
    extended: closesAtMinute > nominalEnd,
  };
}
