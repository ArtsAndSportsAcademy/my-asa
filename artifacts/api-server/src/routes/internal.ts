/**
 * Fase E · produção na Vercel (sem processo sempre ligado): o agendador do Supabase (pg_cron + pg_net)
 * chama estas rotas. Elas não usam sessão de pessoa — só a chave do agendador, no cabeçalho
 * `x-myasa-cron`, comparada em tempo constante com a variável CRON_SECRET do servidor.
 */
import { timingSafeEqual } from "node:crypto";
import { Router, type IRouter, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { rodarCicloOperacional } from "../services/operational-jobs.js";
import { enqueueTaskReminders } from "../services/task-reminders.js";
import { registrarCicloBemSucedido, registrarCicloComFalha, registrarInicioDoCiclo } from "../services/relogio-do-sistema.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();
const log = logger.child({ domain: "agendador" });
/** Trava do Postgres para dois ciclos nunca rodarem ao mesmo tempo (um minuto lento não atropela o próximo). */
const TRAVA_CICLO = 77_204_001;

function chaveValida(req: Request, res: Response) {
  const recebida = String(req.header("x-myasa-cron") ?? "");
  // Quem chega sem chave recebe 401 sempre, mesmo com o servidor sem CRON_SECRET (não revela configuração).
  if (!recebida) { res.status(401).json({ error: "Unauthorized" }); return false; }
  const esperada = process.env.CRON_SECRET;
  if (!esperada || esperada.length < 24) { res.status(503).json({ error: "AGENDADOR_NAO_CONFIGURADO" }); return false; }
  const a = Buffer.from(recebida), b = Buffer.from(esperada);
  if (a.length !== b.length || !timingSafeEqual(a, b)) { res.status(401).json({ error: "Unauthorized" }); return false; }
  return true;
}

router.post("/internal/ciclo", async (req, res) => {
  if (!chaveValida(req, res)) return;
  const client = await pool.connect();
  let aberta = false;
  try {
    // Trava de TRANSAÇÃO, não de sessão: vale enquanto esta transação estiver aberta e se solta
    // sozinha no commit/rollback. A trava de sessão (pg_try_advisory_lock + unlock em consultas
    // separadas) deixa de ser confiável atrás do pooler em modo transação (porta 6543), onde cada
    // consulta pode cair numa conexão diferente — a trava ficaria presa ou nunca seria solta.
    await client.query("begin");
    aberta = true;
    const [{ ok }] = (await client.query<{ ok: boolean }>("select pg_try_advisory_xact_lock($1) as ok", [TRAVA_CICLO])).rows;
    if (!ok) {
      await client.query("rollback");
      aberta = false;
      res.json({ ok: true, pulado: "outro ciclo ainda rodando" });
      return;
    }
    const inicio = Date.now();
    await registrarInicioDoCiclo();
    const resultado = await rodarCicloOperacional(new Date());
    await client.query("commit");
    aberta = false;
    // Só depois do commit: o vigia anota "terminou bem" (e, se havia parada avisada, avisa que voltou) fora da trava do ciclo.
    await registrarCicloBemSucedido();
    res.json({ ok: true, ms: Date.now() - inicio, ...resultado });
  } catch (err) {
    log.error({ err }, "ciclo operacional falhou");
    await registrarCicloComFalha();
    res.status(500).json({ error: "CICLO_FALHOU" });
  } finally {
    // Falha no meio: o rollback solta a trava; sem ele a conexão voltaria ao pool com a transação aberta.
    if (aberta) await client.query("rollback").catch(() => undefined);
    client.release();
  }
});

/**
 * Lembrete de tarefas. Os lembretes agora saem do ciclo (a cada minuto, com chave de deduplicação), então esta rota só
 * existe para o agendador das 8h que já está configurado no Supabase continuar respondendo 200: chamar de novo não repete aviso.
 */
router.post("/internal/tarefas-do-dia", async (req, res) => {
  if (!chaveValida(req, res)) return;
  try {
    res.json({ ok: true, ...(await enqueueTaskReminders(new Date())) });
  } catch (err) {
    log.error({ err }, "lembrete diário de tarefas falhou");
    res.status(500).json({ error: "TAREFAS_FALHOU" });
  }
});

export default router;
