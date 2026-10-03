import assert from "node:assert/strict";
import { test } from "node:test";
import { assignActivityToShift, shiftTimeMinutes, validateShiftSchedule, shiftCheckInWindow } from "../src/services/checkin-shift-schedule.js";

const day = { name: "Dia", startTime: "07:00", endTime: "18:00" };
const night = { name: "Noite", startTime: "18:00", endTime: "22:00" };

test("atividade após o fim do turno estende fechamento até seu fim", () => {
  assert.deepEqual(shiftCheckInWindow([day, night], 1, [{ startTime: "23:00", endTime: "23:45" }]), {
    opensAtMinute: 1260, firstActivityMinute: 1380, closesAtMinute: 1425, extended: true,
  });
});

test("extensão considera a última atividade e preserva abertura pela primeira", () => {
  assert.deepEqual(shiftCheckInWindow([day, night], 1, [
    { startTime: "23:00", endTime: "00:30" },
    { startTime: "19:00", endTime: "20:00" },
    { startTime: "02:00", endTime: "03:00" },
  ]), { opensAtMinute: 1020, firstActivityMinute: 1140, closesAtMinute: 1620, extended: true });
});

test("sem atividade no intervalo livre mantém o encerramento configurado", () => {
  assert.deepEqual(shiftCheckInWindow([day, night], 0, [{ startTime: "07:00", endTime: "08:00" }]), {
    opensAtMinute: 300, firstActivityMinute: 420, closesAtMinute: 1080, extended: false,
  });
  assert.equal(shiftCheckInWindow([day, night], 0, []), null);
});

test("abertura pode cair na véspera sem truncar os minutos", () => {
  assert.deepEqual(shiftCheckInWindow([{ name: "Madrugada", startTime: "00:00", endTime: "08:00" }], 0,
    [{ startTime: "00:30", endTime: "01:00" }]), {
    opensAtMinute: -90, firstActivityMinute: 30, closesAtMinute: 480, extended: false,
  });
});

test("não mistura atividades de outro turno nem aceita duração ambígua", () => {
  assert.throws(() => shiftCheckInWindow([day, night], 0, [{ startTime: "19:00", endTime: "20:00" }]));
  assert.throws(() => shiftCheckInWindow([day, night], 2, []));
  assert.throws(() => shiftCheckInWindow([day, night], 0, [{ startTime: "07:00", endTime: "07:00" }]));
});

test("valida e normaliza nomes sem mudar a ordem dos turnos", () => {
  assert.deepEqual(validateShiftSchedule([{ ...night, name: "  Noite  " }, day]).shifts, [night, day]);
});

test("aceita de um a três turnos", () => {
  assert.throws(() => validateShiftSchedule([]));
  assert.throws(() => validateShiftSchedule([day, night, day, night]));
  assert.equal(validateShiftSchedule([day]).shifts.length, 1);
  assert.equal(validateShiftSchedule([
    { name: "A", startTime: "00:00", endTime: "08:00" },
    { name: "B", startTime: "08:00", endTime: "16:00" },
    { name: "C", startTime: "16:00", endTime: "00:00" },
  ]).gaps.length, 0);
});

test("recusa nomes vazios, repetidos e excessivos", () => {
  for (const name of [" ", "x".repeat(81)]) assert.throws(() => validateShiftSchedule([{ ...day, name }]));
  assert.throws(() => validateShiftSchedule([day, { ...night, name: " DIA " }]));
});

test("horários inválidos não são normalizados silenciosamente", () => {
  for (const time of ["24:00", "12:60", "7:00", "-1:00", "12:00:00", "abc", ""]) {
    assert.throws(() => shiftTimeMinutes(time));
    assert.throws(() => validateShiftSchedule([{ ...day, endTime: time }]));
  }
  assert.equal(shiftTimeMinutes("00:00"), 0);
  assert.equal(shiftTimeMinutes("23:59"), 1439);
  assert.throws(() => validateShiftSchedule([{ ...day, endTime: "07:00" }]));
});

test("recusa sobreposição, inclusive através da meia-noite", () => {
  assert.throws(() => validateShiftSchedule([day, { ...night, startTime: "17:59" }]));
  assert.throws(() => validateShiftSchedule([
    { ...night, startTime: "22:00", endTime: "08:00" }, day,
  ]));
});

test("encontra um único buraco que cruza meia-noite", () => {
  assert.deepEqual(validateShiftSchedule([day, night]).gaps, [
    { startTime: "22:00", endTime: "07:00", minutes: 540, previousShiftIndex: 1 },
  ]);
});

test("encontra buracos diurnos e noturnos preservando a pessoa configuradora", () => {
  const gaps = validateShiftSchedule([{ ...night, startTime: "19:00" }, day]).gaps;
  assert.deepEqual(gaps, [
    { startTime: "18:00", endTime: "19:00", minutes: 60, previousShiftIndex: 1 },
    { startTime: "22:00", endTime: "07:00", minutes: 540, previousShiftIndex: 0 },
  ]);
});

test("fronteira entre turnos pertence ao turno que começa", () => {
  assert.deepEqual(assignActivityToShift([day, night], "17:59"), { shiftIndex: 0, startDayOffset: 0, inGap: false });
  assert.deepEqual(assignActivityToShift([day, night], "18:00"), { shiftIndex: 1, startDayOffset: 0, inGap: false });
});

test("atividade em buraco pertence ao turno anterior, com sinalização explícita", () => {
  assert.deepEqual(assignActivityToShift([night, day], "23:00"), { shiftIndex: 0, startDayOffset: 0, inGap: true });
  assert.deepEqual(assignActivityToShift([day, night], "06:00"), { shiftIndex: 1, startDayOffset: -1, inGap: true });
});

test("turno noturno iniciado ontem cobre atividade de madrugada", () => {
  const shifts = [day, { ...night, startTime: "22:00", endTime: "06:00" }];
  assert.deepEqual(assignActivityToShift(shifts, "02:00"), { shiftIndex: 1, startDayOffset: -1, inGap: false });
  assert.deepEqual(assignActivityToShift(shifts, "06:00"), { shiftIndex: 1, startDayOffset: -1, inGap: true });
  assert.deepEqual(assignActivityToShift(shifts, "07:00"), { shiftIndex: 0, startDayOffset: 0, inGap: false });
});

test("um dia completo particionado classifica todos os minutos sem buracos", () => {
  const shifts = [
    { name: "A", startTime: "06:00", endTime: "14:00" },
    { name: "B", startTime: "14:00", endTime: "22:00" },
    { name: "C", startTime: "22:00", endTime: "06:00" },
  ];
  assert.deepEqual(validateShiftSchedule(shifts).gaps, []);
  for (let minute = 0; minute < 1440; minute++) {
    const time = `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
    const result = assignActivityToShift(shifts, time);
    assert.equal(result.inGap, false);
    assert.equal(result.shiftIndex, minute < 360 || minute >= 1320 ? 2 : minute < 840 ? 0 : 1);
  }
});
