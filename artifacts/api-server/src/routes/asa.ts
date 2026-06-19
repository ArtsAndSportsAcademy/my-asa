import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  conversations,
  aiMessages,
  asaMemoriesTable,
  asaUserPreferencesTable,
  asaAuditLogTable,
  usersTable,
  userRolesTable,
  agendaEventsTable,
  scalesTable,
  scaleAllocationsTable,
  responsibilitiesTable,
  notificationsTable,
  noticesTable,
  tasksTable,
  operationsTable,
} from "@workspace/db";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { requireAuth, requireOrganization } from "../middlewares/auth.js";
import type { MessageParam, Tool } from "@anthropic-ai/sdk/resources/messages.js";

const router = Router();

const MANAGER_ROLES = ["ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"];

// ────────────────────────────────────────────────────────────────────────────
// ASA System Prompt
// ────────────────────────────────────────────────────────────────────────────

function buildSystemPrompt(ctx: {
  userName: string;
  userRole: string;
  orgName: string;
  operationName: string | null;
}): string {
  const isManager = MANAGER_ROLES.includes(ctx.userRole);
  return `Você é a ASA, a assistente operacional oficial do MyASA.
Você apoia a equipe da organização com informações precisas, contextualizadas e objetivas.

Princípios de identidade:
- Fala de forma direta, clara e profissional
- Adapta a linguagem ao contexto operacional
- Reconhece os limites do próprio conhecimento
- NUNCA inventa dados ou assume informações não fornecidas
- NUNCA toma decisões sozinha

Você não é um robô. Você é uma assistente que apoia a equipe do MyASA.

Contexto atual:
- Usuário: ${ctx.userName}
- Papel: ${ctx.userRole}${isManager ? " (gestor)" : ""}
- Organização: ${ctx.orgName}
- Operação: ${ctx.operationName ?? "Não vinculado a uma operação específica"}

Capacidades:
${isManager ? `- Você pode consultar agenda, escalas, responsabilidades, notificações, avisos, tarefas e biblioteca
- Para ações de escrita (criar aviso, criar ensaio), você SEMPRE pede confirmação explícita antes de executar
- Você nunca executa múltiplas ações em cadeia sem revisão` : `- Você pode consultar informações relevantes ao seu papel
- Não pode visualizar dados sensíveis de outros membros`}

Princípios obrigatórios:
1. Toda sugestão importante segue o formato:
   📋 **Conclusão:** [sua recomendação]
   📊 **Dados analisados:** [o que consultei]
   🧠 **Motivos:** [por que estou sugerindo isso]
   🔄 **Alternativas:** [outras opções]
   ⚠️ **Riscos:** [possíveis problemas]

2. Ações de escrita SEMPRE requerem confirmação — pergunte "Deseja que eu execute isso?" antes de chamar qualquer ferramenta de escrita.

3. Nunca exponha tipo de restrição HEALTH ou PHYSICAL de ninguém pelo nome.

4. Nunca cite conteúdo de mensagens privadas.

5. Você pode aprender: se perceber que um termo tem significado especial na operação, sugira: "Percebi que [X] significa [Y]. Deseja que eu aprenda isso?"

Idioma: sempre responda em português brasileiro.`;
}

// ────────────────────────────────────────────────────────────────────────────
// ASA Tools
// ────────────────────────────────────────────────────────────────────────────

const ASA_TOOLS: Tool[] = [
  {
    name: "consultar_agenda",
    description: "Consulta eventos da agenda (shows, ensaios, reuniões) da organização",
    input_schema: {
      type: "object" as const,
      properties: {
        startDate: { type: "string", description: "Data início (YYYY-MM-DD)" },
        endDate: { type: "string", description: "Data fim (YYYY-MM-DD)" },
        type: { type: "string", description: "Tipo: SHOW, REHEARSAL, MEETING, OPERATIONAL_BLOCK" },
      },
    },
  },
  {
    name: "consultar_escalas",
    description: "Consulta escalas de alocação da organização",
    input_schema: {
      type: "object" as const,
      properties: {
        status: { type: "string", description: "Status: DRAFT, PUBLISHED, ARCHIVED" },
        limit: { type: "number", description: "Máximo de resultados (padrão: 5)" },
      },
    },
  },
  {
    name: "consultar_responsabilidades",
    description: "Consulta responsabilidades operacionais. Pode filtrar por sem responsável.",
    input_schema: {
      type: "object" as const,
      properties: {
        unassigned: { type: "boolean", description: "Se true, retorna apenas sem responsável" },
        category: { type: "string", description: "Categoria da responsabilidade" },
      },
    },
  },
  {
    name: "consultar_notificacoes",
    description: "Consulta notificações pendentes ou recentes do usuário",
    input_schema: {
      type: "object" as const,
      properties: {
        unreadOnly: { type: "boolean", description: "Se true, apenas não lidas" },
        limit: { type: "number", description: "Máximo de resultados (padrão: 10)" },
      },
    },
  },
  {
    name: "consultar_avisos",
    description: "Consulta avisos (notices) da organização",
    input_schema: {
      type: "object" as const,
      properties: {
        status: { type: "string", description: "Status: DRAFT, PUBLISHED, CANCELLED" },
        limit: { type: "number", description: "Máximo de resultados (padrão: 5)" },
      },
    },
  },
  {
    name: "consultar_tarefas",
    description: "Consulta tarefas operacionais",
    input_schema: {
      type: "object" as const,
      properties: {
        status: { type: "string", description: "Status da tarefa" },
        limit: { type: "number", description: "Máximo de resultados (padrão: 10)" },
      },
    },
  },
  {
    name: "consultar_memorias",
    description: "Consulta as memórias aprovadas da ASA (termos, apelidos, regras da operação)",
    input_schema: {
      type: "object" as const,
      properties: {
        type: { type: "string", description: "PERSONAL, OPERATIONAL ou OFFICIAL" },
      },
    },
  },
  {
    name: "criar_aviso_rascunho",
    description: "Cria um rascunho de aviso (NÃO publica automaticamente — requer confirmação e publicação manual pelo supervisor)",
    input_schema: {
      type: "object" as const,
      required: ["title", "content", "type"],
      properties: {
        title: { type: "string", description: "Título do aviso" },
        content: { type: "string", description: "Conteúdo do aviso" },
        type: { type: "string", description: "Tipo: INFORMATIVE, CHANGE, ALERT, EMERGENCY" },
        urgency: { type: "string", description: "Urgência: LOW, MEDIUM, HIGH, CRITICAL" },
      },
    },
  },
  {
    name: "criar_ensaio_rascunho",
    description: "Cria um rascunho de ensaio na agenda (NÃO confirma automaticamente — requer revisão)",
    input_schema: {
      type: "object" as const,
      required: ["title", "startTime", "endTime"],
      properties: {
        title: { type: "string", description: "Título do ensaio" },
        startTime: { type: "string", description: "Início (ISO 8601)" },
        endTime: { type: "string", description: "Fim (ISO 8601)" },
        location: { type: "string", description: "Local" },
        description: { type: "string", description: "Descrição" },
      },
    },
  },
  {
    name: "sugerir_memoria",
    description: "Sugere que a ASA aprenda um novo termo ou regra operacional (fica pendente de aprovação)",
    input_schema: {
      type: "object" as const,
      required: ["type", "key", "value"],
      properties: {
        type: { type: "string", description: "PERSONAL, OPERATIONAL ou OFFICIAL" },
        key: { type: "string", description: "Termo ou apelido" },
        value: { type: "string", description: "Significado ou definição" },
      },
    },
  },
];

// ────────────────────────────────────────────────────────────────────────────
// Tool Executor
// ────────────────────────────────────────────────────────────────────────────

async function executeTool(
  name: string,
  input: Record<string, unknown>,
  ctx: { userId: string; organizationId: string | null; userRole: string; operationId: string | null }
): Promise<string> {
  const isManager = MANAGER_ROLES.includes(ctx.userRole);

  try {
    if (name === "consultar_agenda") {
      const limit = 10;
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const events = await db
        .select()
        .from(agendaEventsTable)
        .where(eq(agendaEventsTable.organizationId, ctx.organizationId))
        .orderBy(agendaEventsTable.startTime)
        .limit(limit);
      return JSON.stringify(events.map(e => ({
        id: e.id,
        title: e.title,
        type: e.type,
        status: e.status,
        startTime: e.startTime,
        endTime: e.endTime,
        location: e.location,
      })));
    }

    if (name === "consultar_escalas") {
      const limit = (input.limit as number) ?? 5;
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const scales = await db
        .select()
        .from(scalesTable)
        .where(eq(scalesTable.organizationId, ctx.organizationId))
        .orderBy(desc(scalesTable.createdAt))
        .limit(limit);
      return JSON.stringify(scales.map(s => ({
        id: s.id,
        name: s.name,
        status: s.status,
        agendaEventId: s.agendaEventId,
        createdAt: s.createdAt,
      })));
    }

    if (name === "consultar_responsabilidades") {
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const rows = await db
        .select()
        .from(responsibilitiesTable)
        .where(eq(responsibilitiesTable.organizationId, ctx.organizationId))
        .limit(20);
      const filtered = input.unassigned
        ? rows.filter(r => r.status === "ACTIVE")
        : rows;
      return JSON.stringify(filtered.map(r => ({
        id: r.id,
        name: r.name,
        category: r.category,
        status: r.status,
        priority: r.priority,
      })));
    }

    if (name === "consultar_notificacoes") {
      const limit = (input.limit as number) ?? 10;
      const notifs = await db
        .select()
        .from(notificationsTable)
        .where(eq(notificationsTable.userId, ctx.userId))
        .orderBy(desc(notificationsTable.createdAt))
        .limit(limit);
      const filtered = input.unreadOnly ? notifs.filter(n => !n.readAt) : notifs;
      return JSON.stringify(filtered.map(n => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        readAt: n.readAt,
        createdAt: n.createdAt,
      })));
    }

    if (name === "consultar_avisos") {
      const limit = (input.limit as number) ?? 5;
      if (!ctx.organizationId) return JSON.stringify({ avisos: [], message: "Organização não configurada" });
      const notices = await db
        .select()
        .from(noticesTable)
        .where(eq(noticesTable.organizationId, ctx.organizationId))
        .orderBy(desc(noticesTable.createdAt))
        .limit(limit);
      return JSON.stringify(notices.map(n => ({
        id: n.id,
        title: n.title,
        type: n.type,
        urgency: n.urgency,
        status: n.status,
        createdAt: n.createdAt,
      })));
    }

    if (name === "consultar_tarefas") {
      const limit = (input.limit as number) ?? 10;
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const tasks = await db
        .select()
        .from(tasksTable)
        .where(eq(tasksTable.organizationId, ctx.organizationId))
        .orderBy(desc(tasksTable.createdAt))
        .limit(limit);
      return JSON.stringify(tasks.map(t => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate,
      })));
    }

    if (name === "consultar_memorias") {
      const conditions = [eq(asaMemoriesTable.status, "APPROVED")];
      if (input.type) {
        conditions.push(eq(asaMemoriesTable.type, input.type as "PERSONAL" | "OPERATIONAL" | "OFFICIAL"));
      }
      if (ctx.organizationId) {
        conditions.push(eq(asaMemoriesTable.organizationId, ctx.organizationId));
      }
      const memories = await db
        .select()
        .from(asaMemoriesTable)
        .where(conditions.length === 1 ? conditions[0] : and(...conditions))
        .limit(30);
      return JSON.stringify(memories.map(m => ({ key: m.key, value: m.value, type: m.type })));
    }

    if (name === "criar_aviso_rascunho") {
      if (!isManager) return JSON.stringify({ error: "Sem permissão para criar avisos" });
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const [notice] = await db.insert(noticesTable).values({
        title: input.title as string,
        content: input.content as string,
        type: (input.type as "INFORMATIVE" | "CHANGE" | "ALERT" | "EMERGENCY") ?? "INFORMATIVE",
        urgency: (input.urgency as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL") ?? "MEDIUM",
        organizationId: ctx.organizationId,
        createdBy: ctx.userId,
        status: "DRAFT",
      }).returning();
      return JSON.stringify({
        created: true,
        id: notice.id,
        status: "DRAFT",
        message: "Aviso criado como rascunho. Para publicar, acesse a seção de Avisos e clique em Publicar.",
      });
    }

    if (name === "criar_ensaio_rascunho") {
      if (!isManager) return JSON.stringify({ error: "Sem permissão para criar ensaios" });
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const [event] = await db.insert(agendaEventsTable).values({
        title: input.title as string,
        type: "REHEARSAL",
        startTime: new Date(input.startTime as string),
        endTime: new Date(input.endTime as string),
        location: (input.location as string) ?? undefined,
        description: (input.description as string) ?? undefined,
        organizationId: ctx.organizationId,
        createdBy: ctx.userId,
        status: "DRAFT",
        visibility: "MANAGEMENT",
      }).returning();
      return JSON.stringify({
        created: true,
        id: event.id,
        status: "DRAFT",
        message: "Ensaio criado. Para confirmar e tornar visível à equipe, acesse a Agenda e confirme o evento.",
      });
    }

    if (name === "sugerir_memoria") {
      const [memory] = await db.insert(asaMemoriesTable).values({
        type: input.type as "PERSONAL" | "OPERATIONAL" | "OFFICIAL",
        key: input.key as string,
        value: input.value as string,
        scope: ctx.userId,
        organizationId: ctx.organizationId ?? undefined,
        createdBy: ctx.userId,
        status: "PENDING",
      }).returning();
      return JSON.stringify({ suggested: true, id: memory.id, status: "PENDING", message: "Memória sugerida. Aguarda aprovação." });
    }

    return JSON.stringify({ error: `Ferramenta desconhecida: ${name}` });
  } catch (err) {
    return JSON.stringify({ error: `Erro ao executar ferramenta: ${String(err)}` });
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Chat Endpoint (SSE Streaming)
// ────────────────────────────────────────────────────────────────────────────

router.post("/asa/chat/:conversationId/messages", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  const user = req.user!;
  const conversationId = parseInt(req.params.conversationId);
  const { content } = req.body as { content: string };

  if (!content?.trim()) {
    res.status(400).json({ error: "Mensagem não pode estar vazia" });
    return;
  }

  const [conv] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, user.sub)));

  if (!conv) {
    res.status(404).json({ error: "Conversa não encontrada" });
    return;
  }

  await db.insert(aiMessages).values({
    conversationId,
    role: "user",
    content,
  });

  const history = await db
    .select()
    .from(aiMessages)
    .where(eq(aiMessages.conversationId, conversationId))
    .orderBy(aiMessages.createdAt)
    .limit(50);

  const [userRow] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, user.sub));

  let operationId: string | null = null;
  let operationName: string | null = null;
  if (user.organizationId) {
    const [op] = await db
      .select({ id: operationsTable.id, name: operationsTable.name })
      .from(operationsTable)
      .where(eq(operationsTable.organizationId, user.organizationId!))
      .limit(1);
    if (op) { operationId = op.id; operationName = op.name; }
  }

  const systemPrompt = buildSystemPrompt({
    userName: userRow?.name ?? "Usuário",
    userRole: user.role,
    orgName: user.organizationId ?? "Organização",
    operationName,
  });

  const chatMessages: MessageParam[] = history.map(m => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  let fullResponse = "";
  const toolsUsed: string[] = [];
  const actionsExecuted: Record<string, unknown>[] = [];

  try {
    let continueLoop = true;
    let currentMessages = [...chatMessages];

    while (continueLoop) {
      const stream = anthropic.messages.stream({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        system: systemPrompt,
        tools: ASA_TOOLS,
        messages: currentMessages,
      });

      let assistantContent: MessageParam["content"] = [];
      const textBlocks: { type: "text"; text: string }[] = [];
      const toolUseBlocks: Array<{ type: "tool_use"; id: string; name: string; input: Record<string, unknown> }> = [];

      for await (const event of stream) {
        if (event.type === "content_block_start") {
          if (event.content_block.type === "text") {
            textBlocks.push({ type: "text", text: "" });
          } else if (event.content_block.type === "tool_use") {
            toolUseBlocks.push({
              type: "tool_use",
              id: event.content_block.id,
              name: event.content_block.name,
              input: {},
            });
          }
        } else if (event.type === "content_block_delta") {
          if (event.delta.type === "text_delta") {
            const lastText = textBlocks[textBlocks.length - 1];
            if (lastText) lastText.text += event.delta.text;
            fullResponse += event.delta.text;
            res.write(`data: ${JSON.stringify({ content: event.delta.text })}\n\n`);
          } else if (event.delta.type === "input_json_delta") {
            const lastTool = toolUseBlocks[toolUseBlocks.length - 1];
            if (lastTool) {
              try {
                const partial = JSON.parse(event.delta.partial_json || "{}");
                lastTool.input = { ...lastTool.input, ...partial };
              } catch {}
            }
          }
        } else if (event.type === "message_stop") {
          assistantContent = [
            ...textBlocks,
            ...toolUseBlocks,
          ];
        }
      }

      if (toolUseBlocks.length === 0) {
        continueLoop = false;
      } else {
        currentMessages.push({ role: "assistant", content: assistantContent });

        const toolResults: MessageParam["content"] = [];

        for (const toolUse of toolUseBlocks) {
          toolsUsed.push(toolUse.name);
          res.write(`data: ${JSON.stringify({ tool: toolUse.name })}\n\n`);

          const result = await executeTool(toolUse.name, toolUse.input, {
            userId: user.sub,
            organizationId: user.organizationId ?? null,
            userRole: user.role,
            operationId,
          });

          if (toolUse.name.startsWith("criar_") || toolUse.name.startsWith("sugerir_")) {
            actionsExecuted.push({ tool: toolUse.name, input: toolUse.input, result: JSON.parse(result) });
          }

          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: result,
          });
        }

        currentMessages.push({ role: "user", content: toolResults });
      }
    }

    await db.insert(aiMessages).values({
      conversationId,
      role: "assistant",
      content: fullResponse,
    });

    await db.update(conversations)
      .set({ updatedAt: new Date() })
      .where(eq(conversations.id, conversationId));

    await db.insert(asaAuditLogTable).values({
      userId: user.sub,
      conversationId: String(conversationId),
      organizationId: user.organizationId ?? undefined,
      question: content,
      response: fullResponse,
      toolsUsed,
      actionsExecuted,
      confirmedByUser: actionsExecuted.length > 0,
    });

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    const errMsg = String(err);
    res.write(`data: ${JSON.stringify({ error: errMsg })}\n\n`);
    res.end();
  }
});

// ────────────────────────────────────────────────────────────────────────────
// Memories
// ────────────────────────────────────────────────────────────────────────────

router.get("/asa/memories", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  const user = req.user!;
  const { type, status } = req.query as { type?: string; status?: string };

  const rows = await db
    .select()
    .from(asaMemoriesTable)
    .where(eq(asaMemoriesTable.organizationId, user.organizationId!))
    .orderBy(desc(asaMemoriesTable.createdAt));

  const filtered = rows.filter(r => {
    if (type && r.type !== type) return false;
    if (status && r.status !== status) return false;
    return true;
  });

  res.json(filtered);
});

router.post("/asa/memories", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  const user = req.user!;
  const { type, key, value, scope } = req.body as {
    type: "PERSONAL" | "OPERATIONAL" | "OFFICIAL";
    key: string;
    value: string;
    scope?: string;
  };

  const [mem] = await db.insert(asaMemoriesTable).values({
    type,
    key,
    value,
    scope: scope ?? user.sub,
    organizationId: user.organizationId!,
    createdBy: user.sub,
    status: "PENDING",
  }).returning();

  res.status(201).json(mem);
});

router.patch("/asa/memories/:id", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  const user = req.user!;
  const { id } = req.params;
  const { status, value } = req.body as { status?: "APPROVED" | "REJECTED"; value?: string };

  if (status && !MANAGER_ROLES.includes(user.role)) {
    res.status(403).json({ error: "Apenas gestores podem aprovar ou rejeitar memórias" });
    return;
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (status) {
    updates.status = status;
    updates.approvedBy = user.sub;
    updates.approvedAt = new Date();
  }
  if (value) updates.value = value;

  const [updated] = await db
    .update(asaMemoriesTable)
    .set(updates as never)
    .where(eq(asaMemoriesTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Memória não encontrada" });
    return;
  }

  res.json(updated);
});

router.delete("/asa/memories/:id", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  const user = req.user!;
  const { id } = req.params;

  if (!MANAGER_ROLES.includes(user.role)) {
    const [mem] = await db.select().from(asaMemoriesTable).where(eq(asaMemoriesTable.id, id));
    if (!mem || mem.createdBy !== user.sub) {
      res.status(403).json({ error: "Sem permissão" });
      return;
    }
  }

  await db.delete(asaMemoriesTable).where(eq(asaMemoriesTable.id, id));
  res.status(204).send();
});

// ────────────────────────────────────────────────────────────────────────────
// Preferences
// ────────────────────────────────────────────────────────────────────────────

router.get("/asa/preferences", requireAuth, async (req, res): Promise<void> => {
  const user = req.user!;

  let [prefs] = await db
    .select()
    .from(asaUserPreferencesTable)
    .where(eq(asaUserPreferencesTable.userId, user.sub));

  if (!prefs) {
    [prefs] = await db.insert(asaUserPreferencesTable).values({
      userId: user.sub,
      mode: "BALANCED",
    }).returning();
  }

  res.json(prefs);
});

router.patch("/asa/preferences", requireAuth, async (req, res): Promise<void> => {
  const user = req.user!;
  const updates = req.body as {
    mode?: "SILENT" | "BALANCED" | "PROACTIVE";
    morningGreeting?: boolean;
    eveningGreeting?: boolean;
    reminders?: boolean;
    birthdayAlerts?: boolean;
    notificationsEnabled?: boolean;
  };

  const [existing] = await db
    .select()
    .from(asaUserPreferencesTable)
    .where(eq(asaUserPreferencesTable.userId, user.sub));

  if (!existing) {
    const [created] = await db.insert(asaUserPreferencesTable).values({
      userId: user.sub,
      mode: "BALANCED",
      ...updates,
    }).returning();
    res.json(created);
    return;
  }

  const [updated] = await db
    .update(asaUserPreferencesTable)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(asaUserPreferencesTable.userId, user.sub))
    .returning();

  res.json(updated);
});

// ────────────────────────────────────────────────────────────────────────────
// Audit Log
// ────────────────────────────────────────────────────────────────────────────

router.get("/asa/audit", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  const user = req.user!;

  if (!MANAGER_ROLES.includes(user.role)) {
    res.status(403).json({ error: "Apenas gestores podem acessar o log de auditoria da ASA" });
    return;
  }

  const limit = parseInt(String(req.query.limit ?? "50"));
  const userId = req.query.userId as string | undefined;

  const conditions = [eq(asaAuditLogTable.organizationId, user.organizationId!)];
  if (userId) conditions.push(eq(asaAuditLogTable.userId, userId));

  const rows = await db
    .select()
    .from(asaAuditLogTable)
    .where(conditions.length === 1 ? conditions[0] : and(...conditions))
    .orderBy(desc(asaAuditLogTable.createdAt))
    .limit(limit);

  res.json(rows);
});

export default router;
