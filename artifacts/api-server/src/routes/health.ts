import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { HealthCheckResponse } from "@workspace/api-zod";
import { LIMITE_DO_RELOGIO_SEGUNDOS, verificarRelogio } from "../services/relogio-do-sistema.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();
const log = logger.child({ domain: "saude" });

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

const ESPERA_DO_BANCO_MS = 8_000;
const comPrazo = <T,>(promessa: Promise<T>): Promise<T> => Promise.race([
  promessa,
  new Promise<never>((_, falhou) => setTimeout(() => falhou(new Error("prazo do banco esgotado")), ESPERA_DO_BANCO_MS).unref()),
]);

/**
 * Endereço para o verificador de fora ("está no ar?"). Público de propósito, por isso só devolve números e palavras de estado:
 * nunca nome, id, e-mail, nem contagem de pessoas. Responde 200 quando tudo vai bem e 503 quando o banco não responde ou o
 * relógio do sistema (o ciclo por minuto) parou, para qualquer verificador que só olha o código de resposta já servir.
 *
 * Efeito colateral deliberado: se o relógio estiver parado e ninguém foi avisado desta parada, esta chamada avisa a Administração
 * (um aviso por parada). É assim que a parada vira aviso sem depender de o ciclo, que é justamente quem parou, funcionar.
 */
router.get("/saude", async (_req, res) => {
  res.set("Cache-Control", "no-store");
  try {
    // O prazo vale só para "o banco responde?". Avisar a Administração pode demorar mais num banco cheio, e isso não é o banco fora.
    await comPrazo(db.execute(sql`select 1`));
    const { relogio } = await verificarRelogio();
    const parado = relogio.situacao === "parado";
    res.status(parado ? 503 : 200).json({
      status: parado ? "relogio_parado" : "ok",
      banco: "ok",
      relogio: { situacao: relogio.situacao, segundosDesdeUltimoCiclo: relogio.segundosDesdeUltimoCiclo, limiteSegundos: LIMITE_DO_RELOGIO_SEGUNDOS },
    });
  } catch (err) {
    log.error({ err }, "verificação de saúde falhou");
    res.status(503).json({ status: "banco_fora", banco: "falha", relogio: null });
  }
});

export default router;
