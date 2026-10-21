import { Router, type IRouter } from "express";
import { requireAuth, requireOrganization, requireRole } from "../middlewares/auth.js";
import { LIMITE_DO_RELOGIO_SEGUNDOS, verificarRelogio } from "../services/relogio-do-sistema.js";

const router: IRouter = Router();

/**
 * Faixa do Painel: "o relógio do sistema parou há X minutos". Só Administração e Direção veem (a Supervisão e o Elenco não têm
 * o que fazer com isso). Abrir o Painel também confere o relógio e, se ele parou sem aviso, avisa a Administração: assim a parada
 * aparece mesmo que o verificador de fora ainda não tenha olhado.
 */
router.get("/painel/relogio", requireAuth, requireOrganization, requireRole("ADMIN", "DIR", "DIRECTOR"), async (_req, res) => {
  const { relogio } = await verificarRelogio();
  const segundos = relogio.segundosDesdeUltimoCiclo;
  res.set("Cache-Control", "no-store");
  res.json({
    parado: relogio.situacao === "parado",
    semRegistro: relogio.situacao === "sem_registro",
    minutosParado: relogio.situacao === "parado" && segundos !== null ? Math.max(3, Math.floor(segundos / 60)) : 0,
    limiteSegundos: LIMITE_DO_RELOGIO_SEGUNDOS,
  });
});

export default router;
