/**
 * Fase E · produção na Vercel (sem processo sempre ligado): o agendador do Supabase (pg_cron + pg_net)
 * chama estas rotas. Elas não usam sessão de pessoa — só a chave do agendador, no cabeçalho
 * `x-myasa-cron`, comparada em tempo constante com a variável CRON_SECRET do servidor.
 */
import { timingSafeEqual } from "node:crypto";
import { Router, type IRouter, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { rodarCicloOperacional } from "../services/operational-jobs.js";
import { sendTaskDueReminders } from "../services/taskReminderService.js";
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
  try {
    const [{ ok }] = (await client.query<{ ok: boolean }>("select pg_try_advisory_lock($1) as ok", [TRAVA_CICLO])).rows;
    if (!ok) { res.json({ ok: true, pulado: "outro ciclo ainda rodando" }); return; }
    try {
      const inicio = Date.now();
      const resultado = await rodarCicloOperacional(new Date());
      res.json({ ok: true, ms: Date.now() - inicio, ...resultado });
    } finally {
      await client.query("select pg_advisory_unlock($1)", [TRAVA_CICLO]);
    }
  } catch (err) {
    log.error({ err }, "ciclo operacional falhou");
    res.status(500).json({ error: "CICLO_FALHOU" });
  } finally {
    client.release();
  }
});

/** Lembrete diário de tarefas (antes rodava às 8h do relógio do servidor; agora o Supabase chama às 8h de São Paulo). */
router.post("/internal/tarefas-do-dia", async (req, res) => {
  if (!chaveValida(req, res)) return;
  try {
    res.json({ ok: true, ...(await sendTaskDueReminders()) });
  } catch (err) {
    log.error({ err }, "lembrete diário de tarefas falhou");
    res.status(500).json({ error: "TAREFAS_FALHOU" });
  }
});

export default router;
