/**
 * Trava do ciclo operacional (/internal/ciclo): dois ciclos nunca rodam juntos. É de TRANSAÇÃO
 * (pg_try_advisory_xact_lock), porque a de sessão não é confiável atrás do pooler em modo
 * transação (porta 6543) — a trava ficaria presa ou nunca seria solta.
 *
 * O ciclo de verdade varre o banco inteiro e é lento demais para um teste; aqui a trava é segurada
 * por outra conexão e se confirma que a rota pula sem rodar e sem deixar trava para trás.
 */
import { pool } from "@workspace/db";
import app from "../src/application.js";

let passed = 0;
const failures: string[] = [];
function assert(cond: boolean, msg: string) {
  if (cond) passed += 1;
  else { failures.push(msg); console.error(`  ✗ ${msg}`); }
}

const TRAVA_CICLO = 77_204_001;

async function run() {
  const segredo = `teste_${Date.now()}_${"x".repeat(30)}`;
  process.env.CRON_SECRET = segredo;
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const port = (server.address() as { port: number }).port;
  const chamar = (chave?: string) => fetch(`http://127.0.0.1:${port}/api/internal/ciclo`, {
    method: "POST", signal: AbortSignal.timeout(60_000),
    headers: chave ? { "x-myasa-cron": chave } : {},
  }).then(async (r) => ({ status: r.status, body: await r.json() as Record<string, unknown> }));
  const travasAbertas = async () => Number((await pool.query(
    `select count(*)::int n from pg_locks where locktype = 'advisory' and objid = $1::int`, [TRAVA_CICLO],
  )).rows[0].n);

  const outra = await pool.connect();
  try {
    assert((await chamar()).status === 401, "sem chave: 401");
    assert((await chamar("errada")).status === 401, "chave errada: 401");
    assert(await travasAbertas() === 0, "começa sem trava aberta");

    // Outro ciclo "rodando": a mesma trava, numa transação aberta noutra conexão.
    await outra.query("begin");
    const dono = (await outra.query("select pg_try_advisory_xact_lock($1) as ok", [TRAVA_CICLO])).rows[0].ok;
    assert(dono === true, "a outra conexão pega a trava");

    const pulada = await chamar(segredo);
    assert(pulada.status === 200 && pulada.body.pulado === "outro ciclo ainda rodando", "com a trava ocupada, a rota pula o ciclo sem falhar");
    assert(await travasAbertas() === 1, "a chamada pulada não deixa trava própria — só a da outra conexão");

    // A trava é de transação: solta sozinha no rollback, sem unlock explícito.
    await outra.query("rollback");
    assert(await travasAbertas() === 0, "rollback da outra conexão solta a trava sozinho");
  } finally {
    await outra.query("rollback").catch(() => undefined);
    outra.release();
    server.closeAllConnections?.();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  if (failures.length > 0) throw new Error(`${failures.length} falha(s) na trava do ciclo`);
  process.stdout.write(`internal-ciclo-trava: ${passed} asserts passed\n`);
}

process.stdout.write("internal-ciclo-trava: starting\n");
try {
  await run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
