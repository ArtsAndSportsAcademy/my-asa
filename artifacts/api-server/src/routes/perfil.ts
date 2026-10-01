/**
 * 28 Perfil — o que a própria pessoa decide sobre si e as regras da casa.
 * - Regras da casa (Administração): silêncio noturno padrão e antecedência do lembrete de check-in.
 * - Preferências da pessoa: quem vê telefone/e-mail/aniversário e a própria janela de silêncio.
 * - Foto de perfil: no Postgres, só pela API autenticada; trocar desativa a anterior.
 * - Aniversários do Mural: só dia e mês, obedecendo a escolha de cada pessoa.
 * Toda escrita entra no Registro na mesma transação.
 */
import express, { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, organizationsTable, userPhotosTable, usersTable, type JanelaSilencio, type Privacidade } from "@workspace/db";
import { requireAuth, requireOrganization, requireRole } from "../middlewares/auth.js";
import { writeHistoryEvent } from "../lib/history-helper.js";
import { comPadrao, janelaValida, LEMBRETE_OPCOES, regrasDaOrganizacao } from "../services/regras-casa.js";
import { aniversariosDaCasa } from "../services/aniversarios.js";

const router: IRouter = Router();

const NIVEIS = ["gestao", "grupo", "asa"] as const;
const ANIVERSARIO = ["off", "lista", "mural"] as const;
const FOTO_TIPOS = ["image/jpeg", "image/png", "image/webp"];

// ─── Regras da casa ───────────────────────────────────────────────────────────

router.get("/organization/regras", requireAuth, requireOrganization, async (req, res) => {
  res.json({ regras: await regrasDaOrganizacao(req.user!.organizationId), lembreteOpcoes: LEMBRETE_OPCOES });
});

router.patch("/organization/regras", requireAuth, requireOrganization, requireRole("ADMIN"), async (req, res) => {
  const { silencio, lembreteCheckinMin } = req.body ?? {};
  if (silencio !== undefined && !janelaValida(silencio)) { res.status(400).json({ error: "BAD_REQUEST", message: "Silêncio inválido: use horários HH:MM diferentes e on verdadeiro ou falso." }); return; }
  if (lembreteCheckinMin !== undefined && !(LEMBRETE_OPCOES as readonly number[]).includes(lembreteCheckinMin)) { res.status(400).json({ error: "BAD_REQUEST", message: `O lembrete de check-in aceita ${LEMBRETE_OPCOES.join(", ")} minutos.` }); return; }
  const orgId = req.user!.organizationId;
  const regras = await db.transaction(async (tx) => {
    const [org] = await tx.select({ regras: organizationsTable.regras }).from(organizationsTable).where(eq(organizationsTable.id, orgId)).for("update");
    const antes = comPadrao(org?.regras);
    const depois = { silencio: silencio ?? antes.silencio, lembreteCheckinMin: lembreteCheckinMin ?? antes.lembreteCheckinMin };
    await tx.update(organizationsTable).set({ regras: depois, updatedAt: new Date() }).where(eq(organizationsTable.id, orgId));
    const partes = [
      silencio !== undefined ? (depois.silencio.on ? `silêncio noturno da casa das ${depois.silencio.de} às ${depois.silencio.ate}` : "sem silêncio noturno da casa") : "",
      lembreteCheckinMin !== undefined ? `lembrete de check-in ${depois.lembreteCheckinMin} min antes do primeiro bloco` : "",
    ].filter(Boolean);
    await writeHistoryEvent({
      category: "OPERATIONAL_CHANGE", action: "organization.regras_atualizadas", title: "Regras da casa atualizadas",
      narrative: `A Administração mudou as regras da casa: ${partes.join(" e ")}.`,
      entityType: "organization", entityId: orgId, actorId: req.user!.sub, orgId,
      beforeState: antes, afterState: depois,
    }, tx as never);
    return depois;
  });
  res.json({ regras });
});

// ─── Preferências da própria pessoa ───────────────────────────────────────────

router.patch("/users/me/preferencias", requireAuth, requireOrganization, async (req, res) => {
  const { privacidade, silencio } = req.body ?? {};
  const p = privacidade as Partial<Privacidade> | undefined;
  if (p !== undefined && (typeof p !== "object" || p === null
    || (p.tel !== undefined && !NIVEIS.includes(p.tel)) || (p.mail !== undefined && !NIVEIS.includes(p.mail)) || (p.bday !== undefined && !ANIVERSARIO.includes(p.bday)))) {
    res.status(400).json({ error: "BAD_REQUEST", message: "Visibilidade inválida." }); return;
  }
  if (silencio !== undefined && silencio !== null && !janelaValida(silencio)) {
    res.status(400).json({ error: "BAD_REQUEST", message: "Silêncio inválido: use horários HH:MM diferentes." }); return;
  }
  const userId = req.user!.sub, orgId = req.user!.organizationId;
  const resultado = await db.transaction(async (tx) => {
    const [me] = await tx.select({ privacidade: usersTable.privacidade, silencio: usersTable.silencio }).from(usersTable)
      .where(and(eq(usersTable.id, userId), eq(usersTable.organizationId, orgId))).for("update");
    if (!me) return null;
    const novaPrivacidade: Privacidade = { ...me.privacidade, ...(p ?? {}) };
    const novoSilencio: JanelaSilencio | null = silencio === undefined ? me.silencio : silencio;
    await tx.update(usersTable).set({
      privacidade: novaPrivacidade, silencio: novoSilencio,
      // Campo antigo continua coerente para quem ainda lê booleano: "só a gestão" = não aparece para colegas.
      contactVisibility: { phone: novaPrivacidade.tel !== "gestao", email: novaPrivacidade.mail !== "gestao" },
      updatedAt: new Date(),
    }).where(eq(usersTable.id, userId));
    await writeHistoryEvent({
      category: "OPERATIONAL_CHANGE", action: "user.preferencias_atualizadas", title: "Preferências do perfil atualizadas",
      narrative: "A pessoa mudou quem vê seus dados ou o próprio silêncio noturno.",
      entityType: "user", entityId: userId, actorId: userId, orgId,
      beforeState: { privacidade: me.privacidade, silencio: me.silencio }, afterState: { privacidade: novaPrivacidade, silencio: novoSilencio },
    }, tx as never);
    return { privacidade: novaPrivacidade, silencio: novoSilencio };
  });
  if (!resultado) { res.status(404).json({ error: "NOT_FOUND" }); return; }
  res.json(resultado);
});

// ─── Foto de perfil ───────────────────────────────────────────────────────────

router.put("/users/me/photo", requireAuth, requireOrganization, express.raw({ type: FOTO_TIPOS, limit: "1mb" }), async (req, res) => {
  const tipo = String(req.headers["content-type"] ?? "").split(";")[0]!.trim();
  const content = req.body as Buffer;
  if (!FOTO_TIPOS.includes(tipo) || !Buffer.isBuffer(content) || !content.length) {
    res.status(400).json({ error: "BAD_REQUEST", message: "Envie uma imagem JPG, PNG ou WebP de até 1 MB." }); return;
  }
  const userId = req.user!.sub, orgId = req.user!.organizationId;
  const foto = await db.transaction(async (tx) => {
    const anteriores = await tx.update(userPhotosTable).set({ active: false }).where(and(eq(userPhotosTable.userId, userId), eq(userPhotosTable.active, true))).returning({ id: userPhotosTable.id });
    const [criada] = await tx.insert(userPhotosTable).values({ userId, orgId, contentType: tipo, sizeBytes: content.length, content }).returning({ id: userPhotosTable.id });
    const photoUrl = `/api/users/${userId}/photo?v=${criada!.id}`;
    await tx.update(usersTable).set({ photoUrl, updatedAt: new Date() }).where(eq(usersTable.id, userId));
    await writeHistoryEvent({
      category: "OPERATIONAL_CHANGE", action: "user.foto_trocada", title: "Foto de perfil trocada",
      narrative: anteriores.length ? "A pessoa trocou a foto do perfil; a anterior ficou guardada e desativada." : "A pessoa colocou uma foto no perfil.",
      entityType: "user", entityId: userId, actorId: userId, orgId,
      beforeState: { fotoAnterior: anteriores[0]?.id ?? null }, afterState: { foto: criada!.id, sizeBytes: content.length, contentType: tipo },
    }, tx as never);
    return { id: criada!.id, photoUrl };
  });
  res.status(201).json(foto);
});

router.delete("/users/me/photo", requireAuth, requireOrganization, async (req, res) => {
  const userId = req.user!.sub, orgId = req.user!.organizationId;
  const tiradas = await db.transaction(async (tx) => {
    const desativadas = await tx.update(userPhotosTable).set({ active: false }).where(and(eq(userPhotosTable.userId, userId), eq(userPhotosTable.active, true))).returning({ id: userPhotosTable.id });
    await tx.update(usersTable).set({ photoUrl: null, updatedAt: new Date() }).where(eq(usersTable.id, userId));
    if (desativadas.length) await writeHistoryEvent({
      category: "OPERATIONAL_CHANGE", action: "user.foto_retirada", title: "Foto de perfil retirada",
      narrative: "A pessoa tirou a foto do perfil; a imagem ficou guardada e desativada.",
      entityType: "user", entityId: userId, actorId: userId, orgId,
      beforeState: { foto: desativadas[0]!.id }, afterState: { foto: null },
    }, tx as never);
    return desativadas.length;
  });
  res.json({ ok: true, retiradas: tiradas });
});

router.get("/users/:id/photo", requireAuth, requireOrganization, async (req, res) => {
  const id = String(req.params.id);
  if (!/^[0-9a-f-]{36}$/i.test(id)) { res.status(404).end(); return; }
  const [foto] = await db.select({ content: userPhotosTable.content, contentType: userPhotosTable.contentType, sizeBytes: userPhotosTable.sizeBytes })
    .from(userPhotosTable)
    .where(and(eq(userPhotosTable.userId, id), eq(userPhotosTable.orgId, req.user!.organizationId), eq(userPhotosTable.active, true))).limit(1);
  if (!foto) { res.status(404).end(); return; }
  res.setHeader("Content-Type", foto.contentType);
  res.setHeader("Content-Length", String(foto.sizeBytes));
  res.setHeader("Cache-Control", "private, max-age=86400");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.end(foto.content);
});

// ─── Aniversários (Mural) ─────────────────────────────────────────────────────

router.get("/mural/aniversarios", requireAuth, requireOrganization, async (req, res) => {
  res.json(await aniversariosDaCasa(req.user!.organizationId));
});

export default router;
