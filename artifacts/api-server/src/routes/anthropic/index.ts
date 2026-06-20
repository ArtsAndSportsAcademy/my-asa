import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { conversations, aiMessages } from "@workspace/db";
import { requireAuth } from "../../middlewares/auth.js";

const router = Router();

router.get("/anthropic/conversations", requireAuth, async (req, res): Promise<void> => {
  const user = req.user!;
  const rows = await db
    .select()
    .from(conversations)
    .where(eq(conversations.userId, user.sub))
    .orderBy(conversations.updatedAt);

  res.json(rows.reverse());
});

router.post("/anthropic/conversations", requireAuth, async (req, res): Promise<void> => {
  const user = req.user!;
  const { title } = req.body as { title: string };

  if (!title) {
    res.status(400).json({ error: "title é obrigatório" });
    return;
  }

  const [conv] = await db.insert(conversations).values({
    title,
    userId: user.sub,
    organizationId: user.organizationId ?? undefined,
  }).returning();

  res.status(201).json(conv);
});

router.get("/anthropic/conversations/:id", requireAuth, async (req, res): Promise<void> => {
  const user = req.user!;
  const id = parseInt(req.params["id"] as string);

  const [conv] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, user.sub)));

  if (!conv) {
    res.status(404).json({ error: "Conversa não encontrada" });
    return;
  }

  const msgs = await db
    .select()
    .from(aiMessages)
    .where(eq(aiMessages.conversationId, id))
    .orderBy(aiMessages.createdAt);

  res.json({ ...conv, messages: msgs });
});

router.delete("/anthropic/conversations/:id", requireAuth, async (req, res): Promise<void> => {
  const user = req.user!;
  const id = parseInt(req.params["id"] as string);

  const [conv] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, user.sub)));

  if (!conv) {
    res.status(404).json({ error: "Conversa não encontrada" });
    return;
  }

  await db.delete(conversations).where(eq(conversations.id, id));
  res.status(204).send();
});

router.get("/anthropic/conversations/:id/messages", requireAuth, async (req, res): Promise<void> => {
  const user = req.user!;
  const id = parseInt(req.params["id"] as string);

  const [conv] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, user.sub)));

  if (!conv) {
    res.status(404).json({ error: "Conversa não encontrada" });
    return;
  }

  const msgs = await db
    .select()
    .from(aiMessages)
    .where(eq(aiMessages.conversationId, id))
    .orderBy(aiMessages.createdAt);

  res.json(msgs);
});

export default router;
