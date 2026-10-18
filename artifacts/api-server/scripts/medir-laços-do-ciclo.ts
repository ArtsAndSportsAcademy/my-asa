// Medição (banco de TESTE): tempo e número de consultas dos laços do ciclo por minuto.
import pg from "pg";
import { pool } from "@workspace/db";
import { operationalDate } from "../src/lib/operational-date.js";
import { reconcileDueCheckIns } from "../src/services/checkin-reconcile.js";
import { enqueueEscalaReminders, enqueueShiftReminders } from "../src/services/operational-jobs.js";
import { reconcileShiftCheckIns, shiftPlans } from "../src/services/shift-checkins.js";

let consultas = 0;
const proto = (pg as any).Client.prototype;
const original = proto.query;
proto.query = function (...a: unknown[]) { consultas++; return original.apply(this, a); };

const orgId = process.argv[2];
const rodadas = Number(process.argv[3] ?? 3);
const agora = new Date();
const data = operationalDate(agora);
async function medir(nome: string, fn: () => Promise<unknown>) {
  const tempos: number[] = []; let q = 0; let ultimo: unknown;
  for (let i = 0; i < rodadas; i++) { consultas = 0; const t = Date.now(); ultimo = await fn(); tempos.push(Date.now() - t); q = consultas; }
  console.log(JSON.stringify({ nome, ms: tempos, consultas: q, retorno: ultimo }));
}
await medir("enqueueEscalaReminders", () => enqueueEscalaReminders(agora, orgId));
await medir("enqueueShiftReminders", () => enqueueShiftReminders(agora, orgId));
await medir("reconcileDueCheckIns", () => reconcileDueCheckIns(agora, orgId));
await medir("reconcileShiftCheckIns", () => reconcileShiftCheckIns(agora, orgId));
await medir("shiftPlans", () => shiftPlans(orgId!, data).then((p) => p.length));
await pool.end();
