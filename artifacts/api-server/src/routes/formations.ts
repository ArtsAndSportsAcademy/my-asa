import { Router, type IRouter } from "express";
import {
  applyFormationToScene,
  findFormationsByPeopleCount,
  FormationNameRequiredError,
  FormationNotFoundError,
  FormationPositionsInvalidError,
  FormationTargetNotFoundError,
  listFormationsForShow,
  saveFormationFromScene,
  updateFormation,
} from "../services/formation-library.js";
import { requireAuth, requireOrganization, requireRole } from "../middlewares/auth.js";
import { registerUndo, type Transaction } from "../services/undo.js";

const router: IRouter = Router();
const manager = requireRole("ADMIN", "SUPERVISOR_A", "SUPERVISOR_B");

router.get("/formations", requireAuth, requireOrganization, async (req, res) => {
  const raw = (req.query.peopleCount ?? req.query.quantidade_pessoas) as string | undefined;
  const showId = req.query.showId as string | undefined;
  const peopleCount = raw ? Number(raw) : NaN;
  if (!Number.isInteger(peopleCount) || peopleCount <= 0) {
    res.status(400).json({ error: "peopleCount é obrigatório e deve ser inteiro positivo" });
    return;
  }
  try {
    res.json({ formations: await findFormationsByPeopleCount(peopleCount, req.user!.organizationId, showId) });
  } catch (error) {
    console.error("erro ao buscar formações", error);
    res.status(500).json({ error: "Erro ao buscar formações" });
  }
});

// Biblioteca inteira de um show, agrupada por quantidade — aba "Formações" do Livro do Dia.
router.get("/formations/by-show/:showId", requireAuth, requireOrganization, async (req, res) => {
  try {
    const formations = await listFormationsForShow(req.params.showId as string, req.user!.organizationId);
    res.json({ formations });
  } catch (error) {
    console.error("erro ao buscar formações do show", error);
    res.status(500).json({ error: "Erro ao buscar formações do show" });
  }
});

router.post("/formations/:id/apply", requireAuth, requireOrganization, manager, async (req, res) => {
  try {
    const result = await applyFormationToScene({
      formationId: req.params.id as string,
      showBookId: req.body?.showBookId,
      sceneId: req.body?.sceneId,
      blockId: req.body?.blockId ?? null,
      actorId: req.user!.sub,
      organizationId: req.user!.organizationId,
    });
    res.status(201).json(result);
  } catch (error) {
    if (error instanceof FormationNotFoundError) { res.status(404).json({ error: error.message }); return; }
    if (error instanceof FormationTargetNotFoundError) { res.status(404).json({ error: error.message }); return; }
    if (error instanceof FormationPositionsInvalidError) { res.status(400).json({ error: error.message }); return; }
    console.error("erro ao aplicar formação", error);
    res.status(500).json({ error: "Erro ao aplicar formação" });
  }
});

router.post("/formations/from-scene", requireAuth, requireOrganization, manager, async (req, res) => {
  try {
    const formation = await saveFormationFromScene({
      sceneId: req.body?.sceneId,
      name: req.body?.name,
      showId: req.body?.showId ?? null,
      actorId: req.user!.sub,
      organizationId: req.user!.organizationId,
    });
    res.status(201).json({ formation });
  } catch (error) {
    if (error instanceof FormationNameRequiredError) { res.status(400).json({ error: "NAME_REQUIRED", message: error.message }); return; }
    if (error instanceof FormationTargetNotFoundError) { res.status(404).json({ error: error.message }); return; }
    console.error("erro ao salvar formação da cena", error);
    res.status(500).json({ error: "Erro ao salvar formação da cena" });
  }
});

router.patch("/formations/:id", requireAuth, requireOrganization, manager, async (req, res) => {
  try {
    let undo: Awaited<ReturnType<typeof registerUndo>> | undefined;
    const formation = await updateFormation({
      formationId: req.params.id as string,
      actorId: req.user!.sub,
      name: req.body?.name,
      positions: req.body?.positions,
      active: req.body?.active,
      organizationId: req.user!.organizationId,
      onChanged: async (tx, before, after) => {
        if (before.active && !after.active) undo = await registerUndo(tx as unknown as Transaction, { actorId: req.user!.sub, organizationId: req.user!.organizationId, kind: "formation", entityId: before.id, changes: [{ table: "formation", id: before.id, before: { active: before.active }, after: { active: after.active, updatedAt: after.updatedAt } }] });
      },
    });
    res.json({ formation, undo });
  } catch (error) {
    if (error instanceof FormationNameRequiredError || error instanceof FormationPositionsInvalidError) { res.status(400).json({ error: error.message }); return; }
    if (error instanceof FormationNotFoundError) { res.status(404).json({ error: error.message }); return; }
    console.error("erro ao atualizar formação", error);
    res.status(500).json({ error: "Erro ao atualizar formação" });
  }
});

router.post("/formations/:id/deactivate", requireAuth, requireOrganization, manager, async (req, res) => {
  try {
    let undo: Awaited<ReturnType<typeof registerUndo>> | undefined;
    const formation = await updateFormation({ formationId: req.params.id as string, actorId: req.user!.sub, organizationId: req.user!.organizationId, active: false,
      onChanged: async (tx, before, after) => {
        if (before.active) undo = await registerUndo(tx as unknown as Transaction, { actorId: req.user!.sub, organizationId: req.user!.organizationId, kind: "formation", entityId: before.id, changes: [{ table: "formation", id: before.id, before: { active: before.active }, after: { active: false, updatedAt: after.updatedAt } }] });
      },
    });
    res.json({ formation, undo });
  } catch (error) {
    if (error instanceof FormationNotFoundError) { res.status(404).json({ error: error.message }); return; }
    console.error("erro ao desativar formação", error);
    res.status(500).json({ error: "Erro ao desativar formação" });
  }
});

export default router;
