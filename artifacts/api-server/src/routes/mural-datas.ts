import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, muralDatasEspeciaisTable } from "@workspace/db";
import { requireAuth, requireOrganization } from "../middlewares/auth.js";
import { writeHistoryEvent } from "../lib/history-helper.js";
import { diaValido } from "../services/mural-janela.js";

/**
 * Datas especiais do Mural (Dia do Teatro, Dia da Dança…): se repetem todo ano e aparecem na semana e no dia.
 * Quem cadastra: Administração e Direção. Remover é lógico (a data some do Mural e pode voltar).
 */
const router: IRouter = Router();

function podeGerir(req: any) {
  const papel = String(req.user?.role ?? "").toUpperCase();
  return ["ADMIN", "ADM", "DIRECTOR", "DIR", "DIRECTION"].includes(papel);
}

const NEGADO = { error: "Só a Administração e a Direção cadastram as datas especiais do Mural." };

function ler(body: unknown) {
  const { nome, mensagem, mes, dia } = (body ?? {}) as { nome?: unknown; mensagem?: unknown; mes?: unknown; dia?: unknown };
  const texto = typeof nome === "string" ? nome.trim() : "";
  if (!texto || texto.length > 80) return { erro: "Dê um nome à data, com até 80 letras." } as const;
  const recado = typeof mensagem === "string" && mensagem.trim() ? mensagem.trim() : null;
  if (recado && recado.length > 280) return { erro: "A mensagem da data tem no máximo 280 letras." } as const;
  const m = Number(mes), d = Number(dia);
  if (!diaValido(m, d)) return { erro: "Esse dia não existe nesse mês." } as const;
  return { valor: { nome: texto, mensagem: recado, mes: m, dia: d } } as const;
}

router.get("/communication/datas-especiais", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  if (!podeGerir(req)) { res.status(403).json(NEGADO); return; }
  try {
    const datas = await db.select().from(muralDatasEspeciaisTable).where(eq(muralDatasEspeciaisTable.orgId, req.user!.organizationId!)).orderBy(muralDatasEspeciaisTable.mes, muralDatasEspeciaisTable.dia, muralDatasEspeciaisTable.nome);
    res.json({ datas: datas.map(({ orgId: _orgId, createdBy: _createdBy, ...data }) => data) });
  } catch (error) { console.error("[mural-datas] GET", error); res.status(500).json({ error: "Não consegui listar as datas especiais" }); }
});

router.post("/communication/datas-especiais", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  if (!podeGerir(req)) { res.status(403).json(NEGADO); return; }
  const lido = ler(req.body);
  if ("erro" in lido) { res.status(400).json({ error: lido.erro }); return; }
  try {
    const orgId = req.user!.organizationId!;
    const [data] = await db.transaction(async tx => {
      const [criada] = await tx.insert(muralDatasEspeciaisTable).values({ orgId, createdBy: req.user!.sub, ...lido.valor }).returning();
      await writeHistoryEvent({ category: "NOTICE", action: "mural.date_created", title: "Data especial cadastrada", narrative: `${criada!.nome} (${String(criada!.dia).padStart(2, "0")}/${String(criada!.mes).padStart(2, "0")})`, entityType: "mural_data_especial", entityId: criada!.id, actorId: req.user!.sub, orgId, afterState: criada }, tx as any);
      return [criada!] as const;
    });
    res.status(201).json({ data });
  } catch (error) { console.error("[mural-datas] POST", error); res.status(500).json({ error: "Não consegui cadastrar a data agora" }); }
});

async function mudar(req: any, res: any, acao: "editar" | "remover" | "restaurar") {
  if (!podeGerir(req)) { res.status(403).json(NEGADO); return; }
  const id = String(req.params.id), orgId = req.user.organizationId as string;
  let valor: { nome: string; mensagem: string | null; mes: number; dia: number } | null = null;
  if (acao === "editar") {
    const lido = ler(req.body);
    if ("erro" in lido) { res.status(400).json({ error: lido.erro }); return; }
    valor = lido.valor;
  }
  try {
    const [antes] = await db.select().from(muralDatasEspeciaisTable).where(and(eq(muralDatasEspeciaisTable.id, id), eq(muralDatasEspeciaisTable.orgId, orgId))).limit(1);
    if (!antes) { res.status(404).json({ error: "Data não encontrada" }); return; }
    if (acao === "editar" && !antes.active) { res.status(400).json({ error: "Essa data está removida. Traga-a de volta antes de editar." }); return; }
    if (acao === "remover" && !antes.active) { res.status(400).json({ error: "Essa data já estava removida." }); return; }
    if (acao === "restaurar" && antes.active) { res.status(400).json({ error: "Essa data já está no Mural." }); return; }
    const agora = new Date();
    const [data] = await db.transaction(async tx => {
      const [depois] = await tx.update(muralDatasEspeciaisTable).set({ ...(valor ?? { active: acao === "restaurar" }), updatedAt: agora }).where(eq(muralDatasEspeciaisTable.id, id)).returning();
      await writeHistoryEvent({
        category: "NOTICE", action: acao === "editar" ? "mural.date_updated" : acao === "remover" ? "mural.date_removed" : "mural.date_restored",
        title: acao === "editar" ? "Data especial editada" : acao === "remover" ? "Data especial removida" : "Data especial restaurada",
        narrative: depois!.nome, entityType: "mural_data_especial", entityId: id, actorId: req.user.sub, orgId, beforeState: antes, afterState: depois,
      }, tx as any);
      return [depois!] as const;
    });
    res.json({ data });
  } catch (error) { console.error("[mural-datas] mudar", error); res.status(500).json({ error: "Não consegui salvar agora" }); }
}

router.patch("/communication/datas-especiais/:id", requireAuth, requireOrganization, (req, res) => void mudar(req, res, "editar"));
router.delete("/communication/datas-especiais/:id", requireAuth, requireOrganization, (req, res) => void mudar(req, res, "remover"));
router.post("/communication/datas-especiais/:id/restore", requireAuth, requireOrganization, (req, res) => void mudar(req, res, "restaurar"));

export default router;
