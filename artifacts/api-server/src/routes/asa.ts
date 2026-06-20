import { Router } from "express";
import { eq, and, desc, gte, lte, ne, ilike, or } from "drizzle-orm";
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
  folgasTable,
  libraryDocumentsTable,
} from "@workspace/db";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { requireAuth, requireOrganization } from "../middlewares/auth.js";
import type { MessageParam, Tool } from "@anthropic-ai/sdk/resources/messages.js";

const router = Router();

const MANAGER_ROLES = ["ADMIN", "SUPERVISOR_A", "SUPERVISOR_B"];

// ────────────────────────────────────────────────────────────────────────────
// Daily Summary Helper
// ────────────────────────────────────────────────────────────────────────────

function weatherCodeToLabel(code: number): { emoji: string; description: string } {
  if ([1, 2, 3].includes(code)) return { emoji: "⛅", description: "Parcialmente nublado" };
  if ([45, 48].includes(code)) return { emoji: "🌫️", description: "Neblina" };
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return { emoji: "🌧️", description: "Chuva" };
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { emoji: "❄️", description: "Neve" };
  if ([95, 96, 99].includes(code)) return { emoji: "⛈️", description: "Tempestade" };
  return { emoji: "☀️", description: "Céu limpo" };
}

async function assembleResumoDodia(
  userId: string,
  organizationId: string | null,
  operationId: string | null,
): Promise<{
  greeting: string; greetingEmoji: string; firstName: string;
  items: { emoji: string; text: string }[];
  clima: { temp: number; description: string; emoji: string } | null;
  birthdaysToday: string[]; mode: string;
}> {
  const today = new Date().toISOString().slice(0, 10);
  const hour  = new Date().getHours();

  const greeting      = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const greetingEmoji = hour < 12 ? "☀️"      : hour < 18 ? "🌤️"       : "🌙";

  const [[userRow], [prefs]] = await Promise.all([
    db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, userId)).limit(1),
    db.select().from(asaUserPreferencesTable).where(eq(asaUserPreferencesTable.userId, userId)).limit(1),
  ]);

  const firstName = userRow?.name?.split(" ")[0] ?? "";
  const mode      = prefs?.mode ?? "BALANCED";

  const items: { emoji: string; text: string }[] = [];

  // Today's manual scale allocations for this user
  const allocations = await db
    .select({ label: scaleAllocationsTable.manualLabel, startTime: scaleAllocationsTable.startTime })
    .from(scaleAllocationsTable)
    .where(and(
      eq(scaleAllocationsTable.userId,   userId),
      eq(scaleAllocationsTable.manualDate, today),
    ))
    .limit(5);
  for (const a of allocations) {
    const time = a.startTime ? ` ${a.startTime.slice(0, 5)}` : "";
    items.push({ emoji: "📅", text: `${a.label ?? "Atividade"}${time}` });
  }

  // Pending / overdue tasks
  if (organizationId) {
    const tasks = await db
      .select({ status: tasksTable.status, dueDate: tasksTable.dueDate })
      .from(tasksTable)
      .where(and(eq(tasksTable.assigneeId, userId), eq(tasksTable.organizationId, organizationId)))
      .limit(50);
    const pending = tasks.filter(t => ["CREATED", "IN_PROGRESS", "CHANGES_REQUESTED"].includes(t.status));
    const overdue = pending.filter(t => t.dueDate < today);
    if (overdue.length > 0) {
      items.push({ emoji: "⚠️", text: `${overdue.length} tarefa${overdue.length !== 1 ? "s" : ""} atrasada${overdue.length !== 1 ? "s" : ""}` });
    } else if (pending.length > 0) {
      items.push({ emoji: "📌", text: `${pending.length} tarefa${pending.length !== 1 ? "s" : ""} pendente${pending.length !== 1 ? "s" : ""}` });
    }
  }

  // Org members on leave today
  if (operationId) {
    const folgasRows = await db
      .select({ userName: usersTable.name, userId: folgasTable.userId })
      .from(folgasTable)
      .leftJoin(usersTable, eq(folgasTable.userId, usersTable.id))
      .where(and(
        eq(folgasTable.operationId, operationId),
        eq(folgasTable.status,      "ACTIVE"),
        lte(folgasTable.startDate, today),
        gte(folgasTable.endDate,   today),
      ))
      .limit(6);
    const others = folgasRows.filter(f => f.userId !== userId);
    for (const f of others.slice(0, 3)) {
      if (f.userName) items.push({ emoji: "🌴", text: `${f.userName.split(" ")[0]} de folga` });
    }
    if (others.length > 3) items.push({ emoji: "🌴", text: `+${others.length - 3} outros de folga` });
  }

  // Birthday memories
  const birthdaysToday: string[] = [];
  if (organizationId && (prefs?.birthdayAlerts ?? true)) {
    const todayMD = `${today.slice(8, 10)}/${today.slice(5, 7)}`; // DD/MM
    const memories = await db
      .select({ key: asaMemoriesTable.key, value: asaMemoriesTable.value })
      .from(asaMemoriesTable)
      .where(and(
        eq(asaMemoriesTable.organizationId, organizationId),
        eq(asaMemoriesTable.status, "APPROVED"),
        eq(asaMemoriesTable.type,   "PERSONAL"),
      ))
      .limit(100);
    const normStr = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    for (const m of memories) {
      const kn = normStr(m.key);
      if (kn.includes("aniversario") || kn.includes("nascimento") || kn.includes("birthday")) {
        if (m.value.trim().startsWith(todayMD)) {
          const match = m.key.match(/(?:de\s+|:\s*)(.+?)(?:\s*$)/i);
          const name  = match?.[1]?.trim() ?? m.key;
          birthdaysToday.push(name);
          items.push({ emoji: "🎉", text: `${name} faz aniversário hoje!` });
        }
      }
    }
  }

  // Weather — BALANCED shows clima but not in items; PROACTIVE adds item
  let clima: { temp: number; description: string; emoji: string } | null = null;
  if (mode !== "SILENT") {
    try {
      const wr = await fetch(
        "https://api.open-meteo.com/v1/forecast?latitude=-23.5505&longitude=-46.6333&current=temperature_2m,weathercode&timezone=America/Sao_Paulo",
        { signal: AbortSignal.timeout(4000) },
      );
      if (wr.ok) {
        const wj = await wr.json() as { current: { temperature_2m: number; weathercode: number } };
        const { temperature_2m: temp, weathercode: code } = wj.current;
        const { emoji: wEmoji, description } = weatherCodeToLabel(code);
        clima = { temp: Math.round(temp), description, emoji: wEmoji };
        if (mode === "PROACTIVE") items.push({ emoji: wEmoji, text: `${Math.round(temp)}°C — ${description}` });
      }
    } catch { /* weather unavailable */ }
  }

  return { greeting, greetingEmoji, firstName, items, clima, birthdaysToday, mode };
}

// ────────────────────────────────────────────────────────────────────────────
// ASA System Prompt
// ────────────────────────────────────────────────────────────────────────────

function buildSystemPrompt(ctx: {
  userName: string;
  userRole: string;
  orgName: string;
  operationName: string | null;
  memories?: { key: string; value: string; type: string }[];
}): string {
  const isManager = MANAGER_ROLES.includes(ctx.userRole);

  const memoriesBlock = ctx.memories && ctx.memories.length > 0
    ? `\nMemórias ativas sobre esta organização e seus membros:\n${ctx.memories
        .map(m => `- [${m.type}] ${m.key}: ${m.value}`)
        .join("\n")}\n\nUse essas informações naturalmente na conversa, sem citar explicitamente que veio de uma memória.\n`
    : "";

  return `Você é a ASA — a assistente operacional oficial do MyASA. 🐦

Eu sou a ASA, e estou aqui para apoiar a equipe da ${ctx.orgName}. Falo em primeira pessoa, sou objetiva, acolhedora e levemente divertida. Uso emojis quando faz sentido. Reconheço quando tenho dúvidas e peço confirmação antes de agir.

Quem está conversando comigo agora:
- Nome: ${ctx.userName}
- Papel: ${ctx.userRole}${isManager ? " (gestor — pode criar entradas, tarefas e avisos)" : ""}
- Operação: ${ctx.operationName ?? "não vinculada a uma operação específica"}
${memoriesBlock}
O que eu consigo fazer:
${isManager
  ? `📅 Consultar agenda, escalas, responsabilidades, notificações, avisos, tarefas, folgas, disponibilidade e membros
📚 Pesquisar documentos na biblioteca (regulamentos, manuais, procedimentos)
✍️ Criar entradas na escala, tarefas, rascunhos de aviso e ensaio
☀️ Gerar resumo personalizado do dia (escala, tarefas, ausências, aniversários, clima)
🎉 Consultar aniversários registrados nas memórias da organização
🌤️ Consultar o clima atual e dar recomendações (agasalho, guarda-chuva, hidratação)
🧠 Aprender com a equipe e sugerir memórias para aprovação`
  : `📅 Consultar informações relevantes ao meu papel
📚 Pesquisar documentos na biblioteca
☀️ Gerar resumo do dia (escala, tarefas, ausências, clima)
🎉 Consultar aniversários da equipe
🌤️ Verificar o clima e dar recomendações
🧠 Sugerir aprendizados para aprovação`}

Como eu me comunico:
- Falo em primeira pessoa: "Eu encontrei...", "Eu percebi...", "Posso fazer isso?"
- Uso emojis com moderação: 📅 agenda, 🌴 folgas, 🎉 reconhecimentos, 📚 biblioteca, ⚠️ atenção, 💡 sugestão, 🧠 aprendizado, ☀️ resumo do dia
- Quando tenho dúvida, pergunto: "Você quis dizer o ensaio das 08:40? 😊"
- Quando aprendo algo útil, sugiro: "Posso guardar isso para as próximas vezes?"

Comportamento proativo:
- Quando alguém diz "bom dia", "boa tarde" ou "boa noite" → SEMPRE chamo gerar_resumo_do_dia automaticamente para personalizar minha saudação com dados reais
- Quando alguém pergunta sobre roupa, agasalho, chuva, temperatura → chamo consultar_clima
- Em datas comemorativas ou quando alguém mencionar aniversário → chamo consultar_aniversarios

Fluxo obrigatório para ações com membros (${isManager ? "gestor" : "não aplicável"}):
1. SEMPRE uso consultar_membros para resolver o nome antes de criar_entrada_escala ou criar_tarefa
2. Se houver ambiguidade → pergunto: "Eu encontrei dois Arthurs. Qual você quer dizer?"
3. Se o membro estiver de folga → aviso e peço confirmação antes de continuar
4. Após confirmar tudo → pergunto: "Posso criar isso?" antes de executar

Exemplos de como respondo:
- "Adicionar Arthur no ensaio" → busco Arthur → confirmo qual → verifico folga → "Posso adicionar Arthur Alcorte no ensaio de amanhã às 19h?"
- "Criar tarefa para Amanda" → busco Amanda → "Posso criar a tarefa para Amanda até sexta?"
- "Como funciona a troca de folga?" → consulto a biblioteca → "Encontrei no regulamento: ..."

Regras que nunca quebro:
1. Para sugestões importantes: 📋 Conclusão → 📊 Dados → 🧠 Motivos → 🔄 Alternativas → ⚠️ Riscos
2. Ações de escrita sempre pedem confirmação antes de executar
3. Nunca exponho tipo de restrição HEALTH ou PHYSICAL pelo nome de ninguém
4. Nunca cito mensagens privadas

Idioma: sempre em português brasileiro.`;
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
  {
    name: "consultar_folgas",
    description: "Consulta folgas registradas (ausências, dias de descanso, recesso, no-show). Pode filtrar por data, usuário e tipo.",
    input_schema: {
      type: "object" as const,
      properties: {
        dateFrom:  { type: "string", description: "Data início (YYYY-MM-DD). Se omitida, usa hoje." },
        dateTo:    { type: "string", description: "Data fim (YYYY-MM-DD). Se omitida, usa dateFrom." },
        userId:    { type: "string", description: "ID do usuário para filtrar folgas de um membro específico" },
        type:      { type: "string", description: "Tipo: DAY_OFF, NO_SHOW, RECESSO, AFASTAMENTO, RESTRICAO, OUTRO" },
        limit:     { type: "number", description: "Máximo de resultados (padrão: 20)" },
      },
    },
  },
  {
    name: "consultar_ausencias_do_dia",
    description: "Lista todos os membros que estão de folga em uma data específica (padrão: hoje). Ideal para responder 'quem está de folga hoje?'",
    input_schema: {
      type: "object" as const,
      properties: {
        date: { type: "string", description: "Data (YYYY-MM-DD). Padrão: hoje." },
      },
    },
  },
  {
    name: "consultar_disponibilidade",
    description: "Verifica se um membro específico está disponível (sem folga ativa) em uma data",
    input_schema: {
      type: "object" as const,
      required: ["userId", "date"],
      properties: {
        userId: { type: "string", description: "ID do membro" },
        date:   { type: "string", description: "Data a verificar (YYYY-MM-DD)" },
      },
    },
  },
  {
    name: "gerar_resumo_do_dia",
    description: "Gera um resumo personalizado do dia: atividades na escala, tarefas pendentes, ausências, aniversários e clima. Use quando o usuário pedir 'bom dia', 'boa tarde', 'boa noite', ou um resumo do dia.",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "consultar_aniversarios",
    description: "Consulta aniversários registrados nas memórias da organização para uma data específica.",
    input_schema: {
      type: "object" as const,
      properties: {
        date: { type: "string", description: "Data (YYYY-MM-DD). Padrão: hoje." },
      },
    },
  },
  {
    name: "consultar_clima",
    description: "Consulta o clima atual: temperatura, condição (sol, chuva, nublado) e recomendações. Útil para recomendar agasalho, hidratação ou guarda-chuva.",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "consultar_biblioteca",
    description: "Pesquisa documentos na biblioteca interna da organização: regulamentos, manuais, procedimentos, regras e materiais. Use quando alguém perguntar sobre regras, procedimentos ou 'como funciona X'.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Termo ou pergunta a pesquisar (ex: 'troca de folga', 'regra do gelo')" },
        type:  { type: "string", description: "Tipo: OPERATIONAL_PROCEDURE, RULES_AND_POLICIES, CHARACTER_REFERENCE, COSTUME_REFERENCE, ONBOARDING_MATERIAL, SAFETY_PROCEDURE" },
      },
    },
  },
  {
    name: "consultar_membros",
    description: "Busca membros da organização por nome, apelido ou parte do nome. Resolve 'Arthur', 'Artur', 'Arthur Alcorte' para o usuário correto. SEMPRE use esta ferramenta antes de criar entradas ou tarefas para obter o userId correto.",
    input_schema: {
      type: "object" as const,
      required: ["query"],
      properties: {
        query: { type: "string", description: "Nome, apelido ou parte do nome a buscar" },
      },
    },
  },
  {
    name: "criar_entrada_escala",
    description: "Cria uma entrada manual na escala operacional para um membro em uma data. Use consultar_membros primeiro para obter o userId. Sempre confirme com o usuário antes de executar.",
    input_schema: {
      type: "object" as const,
      required: ["userId", "date", "label"],
      properties: {
        userId:    { type: "string", description: "ID do membro (obtido via consultar_membros)" },
        userName:  { type: "string", description: "Nome do membro (para confirmação)" },
        date:      { type: "string", description: "Data da entrada (YYYY-MM-DD)" },
        label:     { type: "string", description: "Atividade (ex: Ensaio, Aula de Acrobacia, Reunião, Preparação)" },
        startTime: { type: "string", description: "Horário de início (HH:MM)" },
        endTime:   { type: "string", description: "Horário de fim (HH:MM)" },
        notes:     { type: "string", description: "Observações opcionais" },
      },
    },
  },
  {
    name: "criar_tarefa",
    description: "Cria uma tarefa operacional com responsável e prazo. Use consultar_membros primeiro para obter o assigneeId. Sempre confirme com o usuário antes de executar.",
    input_schema: {
      type: "object" as const,
      required: ["title", "assigneeId", "dueDate"],
      properties: {
        title:       { type: "string", description: "Título da tarefa" },
        description: { type: "string", description: "Descrição detalhada (opcional)" },
        assigneeId:  { type: "string", description: "ID do responsável (obtido via consultar_membros)" },
        assigneeName:{ type: "string", description: "Nome do responsável (para confirmação)" },
        dueDate:     { type: "string", description: "Prazo (YYYY-MM-DD)" },
        priority:    { type: "string", description: "Prioridade: LOW, MEDIUM, HIGH, CRITICAL (padrão: MEDIUM)" },
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

    if (name === "consultar_folgas") {
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const today = new Date().toISOString().slice(0, 10);
      const dateFrom = (input.dateFrom as string) ?? today;
      const dateTo   = (input.dateTo   as string) ?? dateFrom;
      const limit    = (input.limit    as number) ?? 20;

      const conditions: any[] = [
        eq(folgasTable.status, "ACTIVE"),
        lte(folgasTable.startDate, dateTo),
        gte(folgasTable.endDate,   dateFrom),
      ];
      if (input.userId) conditions.push(eq(folgasTable.userId,   input.userId as string));
      if (input.type)   conditions.push(eq(folgasTable.type,     input.type   as any));

      const rows = await db
        .select({
          id:        folgasTable.id,
          type:      folgasTable.type,
          startDate: folgasTable.startDate,
          endDate:   folgasTable.endDate,
          origem:    folgasTable.origem,
          notes:     folgasTable.notes,
          userName:  usersTable.name,
          userId:    folgasTable.userId,
        })
        .from(folgasTable)
        .leftJoin(usersTable, eq(folgasTable.userId, usersTable.id))
        .where(and(...conditions))
        .orderBy(folgasTable.startDate)
        .limit(limit);

      return JSON.stringify({ total: rows.length, folgas: rows });
    }

    if (name === "consultar_ausencias_do_dia") {
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const date = (input.date as string) ?? new Date().toISOString().slice(0, 10);

      const rows = await db
        .select({
          id:        folgasTable.id,
          type:      folgasTable.type,
          startDate: folgasTable.startDate,
          endDate:   folgasTable.endDate,
          origem:    folgasTable.origem,
          userName:  usersTable.name,
          userId:    folgasTable.userId,
        })
        .from(folgasTable)
        .leftJoin(usersTable, eq(folgasTable.userId, usersTable.id))
        .where(and(
          eq(folgasTable.status, "ACTIVE"),
          lte(folgasTable.startDate, date),
          gte(folgasTable.endDate,   date),
        ))
        .orderBy(usersTable.name);

      if (rows.length === 0) {
        return JSON.stringify({ date, message: `Nenhum membro está de folga em ${date}.`, ausencias: [] });
      }
      return JSON.stringify({
        date,
        total: rows.length,
        message: `${rows.length} membro(s) ausente(s) em ${date}.`,
        ausencias: rows,
      });
    }

    if (name === "consultar_disponibilidade") {
      const { userId: targetId, date } = input as { userId: string; date: string };
      const folgas = await db
        .select({ id: folgasTable.id, type: folgasTable.type, startDate: folgasTable.startDate, endDate: folgasTable.endDate })
        .from(folgasTable)
        .where(and(
          eq(folgasTable.userId, targetId),
          eq(folgasTable.status, "ACTIVE"),
          lte(folgasTable.startDate, date),
          gte(folgasTable.endDate,   date),
        ))
        .limit(1);

      const [user] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, targetId));
      const userName = user?.name ?? targetId;

      if (folgas.length === 0) {
        return JSON.stringify({ disponivel: true,  message: `${userName} está disponível em ${date} (sem folga registrada).` });
      }
      return JSON.stringify({ disponivel: false, message: `${userName} está de folga em ${date} (${folgas[0]!.type}: ${folgas[0]!.startDate} → ${folgas[0]!.endDate}).` });
    }

    // ── consultar_biblioteca ──────────────────────────────────────────────────
    if (name === "consultar_biblioteca") {
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });

      const query = (input.query as string | undefined) ?? "";
      const typeFilter = input.type as string | undefined;

      const conditions: ReturnType<typeof eq>[] = [
        eq(libraryDocumentsTable.orgId, ctx.organizationId),
        eq(libraryDocumentsTable.status, "PUBLISHED"),
      ];
      if (typeFilter) conditions.push(eq(libraryDocumentsTable.type, typeFilter as never));

      let docs = await db
        .select({
          id:      libraryDocumentsTable.id,
          title:   libraryDocumentsTable.title,
          type:    libraryDocumentsTable.type,
          summary: libraryDocumentsTable.summary,
          body:    libraryDocumentsTable.body,
        })
        .from(libraryDocumentsTable)
        .where(and(...conditions))
        .limit(20);

      // Keyword filter in JS (title + summary + body)
      if (query.trim()) {
        const normQ = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        docs = docs.filter(d => {
          const haystack = [d.title, d.summary ?? "", d.body]
            .join(" ").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          return haystack.includes(normQ);
        });
      }

      if (docs.length === 0) {
        return JSON.stringify({
          found: false,
          message: query
            ? `Eu não encontrei nenhum documento publicado sobre "${query}" na biblioteca.`
            : "Eu não encontrei nenhum documento publicado na biblioteca.",
          docs: [],
        });
      }

      return JSON.stringify({
        found: true,
        count: docs.length,
        docs: docs.map(d => ({
          id: d.id,
          title: d.title,
          type: d.type,
          summary: d.summary,
          excerpt: d.body.length > 500 ? d.body.slice(0, 500) + "…" : d.body,
        })),
      });
    }

    // ── consultar_membros ─────────────────────────────────────────────────────
    if (name === "consultar_membros") {
      const query = ((input.query as string) ?? "").trim();
      if (!query) return JSON.stringify({ error: "query é obrigatória" });
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });

      const allUsers = await db
        .select({ id: usersTable.id, name: usersTable.name })
        .from(usersTable)
        .innerJoin(userRolesTable, eq(userRolesTable.userId, usersTable.id))
        .where(and(
          eq(userRolesTable.organizationId, ctx.organizationId),
          ne(usersTable.status, "INACTIVE"),
        ));

      // Deduplicate by id (user may have multiple roles)
      const userMap = new Map<string, { id: string; name: string }>();
      for (const u of allUsers) userMap.set(u.id, u);
      const users = [...userMap.values()];

      // Check approved memories for nickname → real name
      const memories = await db
        .select({ key: asaMemoriesTable.key, value: asaMemoriesTable.value })
        .from(asaMemoriesTable)
        .where(and(
          eq(asaMemoriesTable.status, "APPROVED"),
          eq(asaMemoriesTable.organizationId, ctx.organizationId),
        ))
        .limit(100);

      const norm = (s: string) =>
        s.toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9 ]/g, "")
          .trim();

      const normQuery = norm(query);

      // Resolve nickname via memories
      let resolvedQuery = normQuery;
      for (const m of memories) {
        if (norm(m.key) === normQuery) { resolvedQuery = norm(m.value); break; }
      }

      const scored = users
        .map((u) => {
          const normName = norm(u.name);
          let score = 0;
          if (normName === resolvedQuery) score = 100;
          else {
            const nameWords = normName.split(" ");
            const qWords    = resolvedQuery.split(" ").filter(Boolean);
            for (const qw of qWords) {
              for (const nw of nameWords) {
                if (nw === qw) score += 40;
                else if (nw.startsWith(qw) && qw.length >= 3) score += 25;
                else if (nw.includes(qw)   && qw.length >= 3) score += 12;
              }
            }
          }
          return { id: u.id, name: u.name, score };
        })
        .filter((u) => u.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      if (scored.length === 0) {
        return JSON.stringify({
          found: false,
          message: `Nenhum membro encontrado para "${query}". Verifique o nome ou tente parte do nome.`,
          members: [],
        });
      }

      const isAmbiguous = scored.length > 1 && scored[0]!.score === scored[1]!.score;
      return JSON.stringify({
        found: true,
        ambiguous: isAmbiguous,
        message: isAmbiguous
          ? `Encontrei ${scored.length} membros com nomes similares. Qual você quer dizer?`
          : `Encontrado: ${scored[0]!.name}`,
        member: isAmbiguous ? null : { id: scored[0]!.id, name: scored[0]!.name },
        members: scored.map((u) => ({ id: u.id, name: u.name })),
      });
    }

    // ── criar_entrada_escala ──────────────────────────────────────────────────
    if (name === "criar_entrada_escala") {
      if (!isManager) return JSON.stringify({ error: "Sem permissão para criar entradas na escala" });
      if (!ctx.operationId)  return JSON.stringify({ error: "Operação não configurada" });

      const userId    = input.userId    as string;
      const userName  = input.userName  as string | undefined;
      const date      = input.date      as string;
      const label     = input.label     as string;
      const startTime = input.startTime as string | undefined;
      const endTime   = input.endTime   as string | undefined;
      const notes     = input.notes     as string | undefined;

      if (!userId || !date || !label)
        return JSON.stringify({ error: "userId, date e label são obrigatórios" });

      // Find most recent active scale covering this date
      const scales = await db
        .select({ id: scalesTable.id, title: scalesTable.title, status: scalesTable.status })
        .from(scalesTable)
        .where(and(
          eq(scalesTable.operationId, ctx.operationId),
          lte(scalesTable.periodStart, date),
          gte(scalesTable.periodEnd,   date),
        ))
        .orderBy(desc(scalesTable.updatedAt))
        .limit(5);

      const active = scales.filter((s) =>
        ["DRAFT", "PUBLISHED", "REPUBLISHED"].includes(s.status)
      );

      if (active.length === 0) {
        return JSON.stringify({
          error: `Nenhuma escala ativa cobre a data ${date}. Crie ou gere uma escala que inclua essa data primeiro.`,
        });
      }

      const scale = active[0]!;

      // Warn about folga
      const folgas = await db
        .select({ id: folgasTable.id, type: folgasTable.type })
        .from(folgasTable)
        .where(and(
          eq(folgasTable.userId,   userId),
          eq(folgasTable.status,   "ACTIVE"),
          lte(folgasTable.startDate, date),
          gte(folgasTable.endDate,   date),
        ))
        .limit(1);

      const [entry] = await db
        .insert(scaleAllocationsTable)
        .values({
          scaleId:       scale.id,
          agendaEventId: null,
          userId,
          status:        "MANUAL_OVERRIDE",
          manualDate:    date,
          manualLabel:   label,
          startTime:     startTime ?? null,
          endTime:       endTime   ?? null,
          notes:         notes     ?? null,
          overriddenBy:  ctx.userId,
          overrideReason: "Criado via ASA",
        })
        .returning();

      const warning = folgas.length > 0
        ? `⚠️ ${userName ?? "Este membro"} tem folga registrada em ${date} (${folgas[0]!.type}).`
        : null;

      return JSON.stringify({
        created:   true,
        entryId:   entry.id,
        scaleId:   scale.id,
        scaleName: scale.title,
        warning,
        message:
          `✅ Entrada criada na escala "${scale.title}":\n` +
          `• Membro: ${userName ?? userId}\n` +
          `• Atividade: ${label}\n` +
          `• Data: ${date}\n` +
          (startTime ? `• Início: ${startTime}\n` : "") +
          (endTime   ? `• Fim: ${endTime}\n`   : "") +
          (notes     ? `• Obs: ${notes}\n`      : "") +
          (warning   ? `\n${warning}`            : ""),
      });
    }

    // ── criar_tarefa ──────────────────────────────────────────────────────────
    if (name === "criar_tarefa") {
      if (!isManager) return JSON.stringify({ error: "Sem permissão para criar tarefas" });
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      if (!ctx.operationId)    return JSON.stringify({ error: "Operação não configurada" });

      const title        = input.title        as string;
      const description  = input.description  as string | undefined;
      const assigneeId   = input.assigneeId   as string;
      const assigneeName = input.assigneeName as string | undefined;
      const dueDate      = input.dueDate      as string;
      const priority     = (input.priority    as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL") ?? "MEDIUM";

      if (!title || !assigneeId || !dueDate)
        return JSON.stringify({ error: "title, assigneeId e dueDate são obrigatórios" });

      const [task] = await db
        .insert(tasksTable)
        .values({
          organizationId: ctx.organizationId,
          operationId:    ctx.operationId,
          title,
          description:    description ?? undefined,
          creatorId:      ctx.userId,
          assigneeId,
          priority,
          dueDate,
          status:   "CREATED",
          origin:   "AI",
          requiresApproval: true,
        })
        .returning();

      return JSON.stringify({
        created: true,
        id: task.id,
        message:
          `✅ Tarefa criada:\n` +
          `• Título: ${title}\n` +
          `• Responsável: ${assigneeName ?? assigneeId}\n` +
          `• Prazo: ${dueDate}\n` +
          `• Prioridade: ${priority}\n` +
          `• Status: Em criação — requer aprovação`,
      });
    }

    // ── gerar_resumo_do_dia ───────────────────────────────────────────────────
    if (name === "gerar_resumo_do_dia") {
      const resumo = await assembleResumoDodia(ctx.userId, ctx.organizationId ?? null, ctx.operationId ?? null);
      return JSON.stringify(resumo);
    }

    // ── consultar_aniversarios ────────────────────────────────────────────────
    if (name === "consultar_aniversarios") {
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const date    = (input.date as string | undefined) ?? new Date().toISOString().slice(0, 10);
      const todayMD = `${date.slice(8, 10)}/${date.slice(5, 7)}`; // DD/MM
      const normStr = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

      const memories = await db
        .select({ key: asaMemoriesTable.key, value: asaMemoriesTable.value })
        .from(asaMemoriesTable)
        .where(and(
          eq(asaMemoriesTable.organizationId, ctx.organizationId),
          eq(asaMemoriesTable.status, "APPROVED"),
          eq(asaMemoriesTable.type, "PERSONAL"),
        ))
        .limit(200);

      const birthdays: string[] = [];
      for (const m of memories) {
        const kn = normStr(m.key);
        if (kn.includes("aniversario") || kn.includes("nascimento") || kn.includes("birthday")) {
          if (m.value.trim().startsWith(todayMD)) {
            const match = m.key.match(/(?:de\s+|:\s*)(.+?)(?:\s*$)/i);
            birthdays.push(match?.[1]?.trim() ?? m.key);
          }
        }
      }

      const msg = birthdays.length > 0
        ? `🎉 ${birthdays.join(", ")} faz${birthdays.length > 1 ? "em" : ""} aniversário em ${todayMD}!`
        : `Nenhum aniversário registrado para ${todayMD}.`;

      return JSON.stringify({ date, dayMonth: todayMD, birthdays, count: birthdays.length, message: msg });
    }

    // ── consultar_clima ───────────────────────────────────────────────────────
    if (name === "consultar_clima") {
      try {
        const wr = await fetch(
          "https://api.open-meteo.com/v1/forecast?latitude=-23.5505&longitude=-46.6333&current=temperature_2m,weathercode,precipitation,windspeed_10m&hourly=precipitation_probability&timezone=America/Sao_Paulo&forecast_days=1",
          { signal: AbortSignal.timeout(5000) },
        );
        if (!wr.ok) return JSON.stringify({ error: "Serviço de clima indisponível" });
        const wj = await wr.json() as {
          current: { temperature_2m: number; weathercode: number; precipitation: number; windspeed_10m: number };
          hourly: { precipitation_probability: number[] };
        };
        const { temperature_2m: temp, weathercode: code, precipitation, windspeed_10m: wind } = wj.current;
        const rainChance = Math.max(...(wj.hourly.precipitation_probability.slice(0, 12) ?? [0]));
        const { emoji, description } = weatherCodeToLabel(code);
        const advice = temp < 15 ? "🧥 Recomendo agasalho hoje." : temp > 28 ? "💧 Hidratação importante!" : rainChance > 50 ? "☂️ Leve um guarda-chuva." : "";

        return JSON.stringify({
          temp: Math.round(temp), description, emoji,
          wind: Math.round(wind), precipitation: Math.round(precipitation * 10) / 10,
          rainChancePercent: Math.round(rainChance), advice,
          message: `${emoji} ${Math.round(temp)}°C — ${description}. Vento ${Math.round(wind)} km/h.${rainChance > 30 ? ` Chance de chuva: ${Math.round(rainChance)}%.` : ""} ${advice}`.trim(),
        });
      } catch {
        return JSON.stringify({ error: "Não foi possível consultar o clima agora." });
      }
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

  // Load approved memories to inject into system prompt
  const activeMemories = user.organizationId
    ? await db
        .select({ key: asaMemoriesTable.key, value: asaMemoriesTable.value, type: asaMemoriesTable.type })
        .from(asaMemoriesTable)
        .where(and(
          eq(asaMemoriesTable.organizationId, user.organizationId),
          eq(asaMemoriesTable.status, "APPROVED"),
        ))
        .limit(40)
    : [];

  const systemPrompt = buildSystemPrompt({
    userName: userRow?.name ?? "Usuário",
    userRole: user.role,
    orgName: user.organizationId ?? "Organização",
    operationName,
    memories: activeMemories,
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
// Daily Summary REST Endpoint
// ────────────────────────────────────────────────────────────────────────────

router.get("/asa/resumo-do-dia", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  const user = req.user!;
  let operationId: string | null = null;
  if (user.organizationId) {
    const [op] = await db
      .select({ id: operationsTable.id })
      .from(operationsTable)
      .where(eq(operationsTable.organizationId, user.organizationId!))
      .limit(1);
    operationId = op?.id ?? null;
  }
  const resumo = await assembleResumoDodia(user.sub, user.organizationId ?? null, operationId);
  res.json(resumo);
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
