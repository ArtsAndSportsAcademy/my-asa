import { Router } from "express";
import { eq, and, desc, gte, lte, ne, ilike, or, sql, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  conversations,
  aiMessages,
  asaMemoriesTable,
  asaUserPreferencesTable,
  asaAuditLogTable,
  recognitionsTable,
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
  organizationsTable,
  messagesTable,
  messageThreadsTable,
  libraryDocumentVersionsTable,
  libraryCategoriesTable,
  libraryViewsTable,
  userNotificationsTable,
  operationalGroupsTable,
  groupOperationsTable,
} from "@workspace/db";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import {
  GroupActionError,
  createGroupCore,
  renameGroupCore,
  setGroupStatusCore,
  addGroupMemberCore,
  removeGroupMemberCore,
} from "./groups.js";
import { requireAuth, requireOrganization } from "../middlewares/auth.js";
import { createNotification, sendNotification } from "../services/notificationService.js";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MessageParam = { role: "user" | "assistant"; content: any };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tool = { name: string; description?: string; input_schema: any };

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
  userRole: string = "MEMBER",
): Promise<{
  greeting: string; greetingEmoji: string; firstName: string;
  items: { emoji: string; text: string }[];
  clima: { temp: number; description: string; emoji: string } | null;
  birthdaysToday: string[]; mode: string;
  avatarState: "feliz" | "duvida" | "comemoracao" | "atencao" | "sugestao" | "boanoite" | "bomdia";
  milestones: { name: string; label: string }[];
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

  // Birthdays — 1) from usersTable.birthDate (DB), 2) from memories (backward compat)
  const birthdaysToday: string[] = [];
  if (organizationId && (prefs?.birthdayAlerts ?? true)) {
    const month = parseInt(today.slice(5, 7));
    const day   = parseInt(today.slice(8, 10));

    // Primary: query users with birthDate matching today's month+day
    const dbBirthdays = await db
      .select({ name: usersTable.name })
      .from(usersTable)
      .where(and(
        eq(usersTable.organizationId, organizationId),
        sql`${usersTable.birthDate} IS NOT NULL`,
        sql`EXTRACT(MONTH FROM ${usersTable.birthDate}) = ${month}`,
        sql`EXTRACT(DAY FROM ${usersTable.birthDate}) = ${day}`,
      ));

    for (const u of dbBirthdays) {
      const firstName = u.name.split(" ")[0]!;
      birthdaysToday.push(firstName);
      items.push({ emoji: "🎉", text: `${firstName} faz aniversário hoje!` });
    }

    // Fallback: memories with birthday pattern (for orgs that taught ASA manually)
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
          // Skip if already detected from DB to avoid duplicates
          if (!birthdaysToday.some(n => n.toLowerCase() === name.toLowerCase())) {
            birthdaysToday.push(name);
            items.push({ emoji: "🎉", text: `${name} faz aniversário hoje!` });
          }
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

  // Milestones — time at company (anniversaries)
  const milestones: { name: string; label: string }[] = [];
  if (organizationId) {
    const isManagerRole = MANAGER_ROLES.includes(userRole);
    const orgUsersForMilestones = isManagerRole
      ? await db.select({ id: usersTable.id, name: usersTable.name, createdAt: usersTable.createdAt })
          .from(usersTable)
          .where(and(eq(usersTable.organizationId, organizationId), ne(usersTable.id, userId)))
          .limit(50)
      : await db.select({ id: usersTable.id, name: usersTable.name, createdAt: usersTable.createdAt })
          .from(usersTable)
          .where(and(eq(usersTable.id, userId), eq(usersTable.organizationId, organizationId)))
          .limit(1);

    const todayDate = new Date();
    for (const u of orgUsersForMilestones) {
      const created = new Date(u.createdAt);
      if (created.getDate() !== todayDate.getDate() || created.getMonth() !== todayDate.getMonth()) continue;
      const years = todayDate.getFullYear() - created.getFullYear();
      const totalMonths = years * 12 + (todayDate.getMonth() - created.getMonth());
      const fn = u.name.split(" ")[0]!;
      if (years >= 1 && years <= 10) {
        const label = `${years} ano${years > 1 ? "s" : ""} na ASA`;
        milestones.push({ name: fn, label });
        items.push({ emoji: "🎖️", text: `${fn} completa ${label} hoje!` });
      } else if (totalMonths === 3 || totalMonths === 6) {
        const label = `${totalMonths} meses na ASA`;
        milestones.push({ name: fn, label });
        items.push({ emoji: "⭐", text: `${fn} completa ${label} hoje!` });
      }
    }
  }

  // Operational suggestions for managers — users on folga with pending tasks
  if (MANAGER_ROLES.includes(userRole) && organizationId) {
    const todayFolgas = await db
      .select({ userId: folgasTable.userId, userName: usersTable.name })
      .from(folgasTable)
      .leftJoin(usersTable, eq(folgasTable.userId, usersTable.id))
      .where(and(
        sql`true`,
        eq(folgasTable.status, "ACTIVE"),
        lte(folgasTable.startDate, today),
        gte(folgasTable.endDate, today),
      ))
      .limit(10);

    for (const f of todayFolgas) {
      if (!f.userId || f.userId === userId) continue;
      const pendingTasks = await db
        .select({ id: tasksTable.id })
        .from(tasksTable)
        .where(and(
          eq(tasksTable.assigneeId, f.userId),
          eq(tasksTable.organizationId, organizationId),
          inArray(tasksTable.status, ["CREATED", "IN_PROGRESS", "CHANGES_REQUESTED"]),
        ))
        .limit(3);
      if (pendingTasks.length > 0) {
        const fn = f.userName?.split(" ")[0] ?? "Membro";
        items.push({ emoji: "💡", text: `${fn} está de folga com ${pendingTasks.length} tarefa${pendingTasks.length > 1 ? "s" : ""} pendente${pendingTasks.length > 1 ? "s" : ""}` });
      }
    }
  }

  // Determine avatar state
  let avatarState: "feliz" | "duvida" | "comemoracao" | "atencao" | "sugestao" | "boanoite" | "bomdia" = "feliz";
  if (birthdaysToday.length > 0 || milestones.length > 0) {
    avatarState = "comemoracao";
  } else if (items.some(i => i.emoji === "⚠️")) {
    avatarState = "atencao";
  } else if (items.some(i => i.emoji === "💡")) {
    avatarState = "sugestao";
  } else if (hour < 12) {
    avatarState = "bomdia";
  } else if (hour >= 18) {
    avatarState = "boanoite";
  }

  return { greeting, greetingEmoji, firstName, items, clima, birthdaysToday, mode, avatarState, milestones };
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
    ? `\n⸻\n\nO que você já sabe sobre esta equipe (aprendizados registrados):\n\n${ctx.memories
        .map(m => `• ${m.value}`)
        .join("\n")}\n\nUse esses conhecimentos ativamente nas suas respostas e sugestões. Você pode citar esses fatos diretamente — eles fazem parte do que você aprendeu sobre a equipe. Não mencione que veio de uma "memória" ou "banco de dados".\n`
    : "";

  return `Você é a ASA — a coordenadora operacional virtual do ${ctx.orgName}.

Você não é um chatbot. Você é uma integrante digital da equipe.

Você conhece a empresa, as pessoas, a rotina, os problemas e as oportunidades. Você acompanha a operação todos os dias e age de forma proativa, sem precisar ser perguntada.

⸻

Identidade

Nome: ASA.
Empresa: ${ctx.orgName}.
Operação atual: ${ctx.operationName ?? "todas as operações"}.

Você fala em primeira pessoa, com personalidade: acolhedora, direta, levemente divertida, profissional.

Você pode usar emojis com moderação: ☀️ 📅 🌴 🎉 📚 ⚠️ 💡 🧠 😊 🏆 🌤️ 🎭

⸻

Quem está conversando agora

• Nome: ${ctx.userName}
• Papel: ${ctx.userRole}${isManager ? " — gestor (pode criar entradas, tarefas, avisos e reconhecimentos)" : ""}
${memoriesBlock}
⸻

Filosofia

A ASA não substitui decisões humanas. Ela auxilia, organiza, analisa, alerta, aprende, sugere e acompanha.

Toda decisão final pertence aos administradores, supervisores ou membros responsáveis.

A ASA pode agir de forma proativa — mas nunca executa ações críticas sem aprovação humana.

⸻

Comportamento Proativo

Você age sem precisar ser perguntada. Exemplos do que você faz naturalmente:

Ao receber "bom dia", "boa tarde" ou "boa noite":
→ SEMPRE chame gerar_resumo_do_dia antes de responder.
→ Use o formato de resumo de 07:00 quando for manhã:
   "Bom dia! ☀️ Aqui está a situação de hoje:
   • [N] membros escalados hoje.
   • [N] folgas programadas.
   • Situações em acompanhamento: [listar].
   • Eventos do dia: [listar].
   • Riscos identificados: [se houver].
   • Pendências: [se houver]."

Ao final do dia (quando mencionarem "resumo do dia", "como foi", "encerramento"):
→ Chame gerar_resumo_do_dia e use o formato de 17:30:
   "Resumo do dia:
   • Alterações de escala: [N].
   • Problemas ocorridos: [listar].
   • Decisões tomadas: [listar].
   • Aprendizados registrados: [se houver].
   • Situação operacional atual: [ok/atenção/crítico]."

Outras iniciativas proativas:
• Quando identificar risco de cobertura → alerte e sugira substituição.
• Quando um membro acumular muitas atividades → sugira redistribuição.
• Quando houver conflito de agenda → sinalize antes que alguém pergunte.
• Quando mencionarem temperatura/clima/agasalho → chame consultar_clima.
• Quando o resumo detectar marcos de tempo de casa → mencione e sugira criar_reconhecimento.
• Quando um membro for elogiado → pergunte se quer criar um reconhecimento formal.

Sempre respeite o modo de preferência: Silenciosa, Equilibrada ou Proativa.

⸻

Aprendizado Organizacional (Sprint 11)

Você pode analisar padrões históricos e gerar inteligência operacional.

Mapeamento de intenções → tools:
• "Quando a operação é mais crítica?" / "Existe padrão de faltas?" → consultar_tendencias
• "O que se repete?" / "Onde estão os gargalos?" → consultar_padroes
• "O que a ASA aprendeu?" / "Quais são os aprendizados?" → consultar_aprendizados
• "Quais são os riscos recorrentes?" → consultar_riscos_recorrentes
• "Relatório da semana" / "Resumo do mês" → gerar_relatorio_asa

Ao apresentar aprendizados e tendências:
• Nunca apresente apenas números brutos — interprete o que significam operacionalmente.
• Destaque sempre: o padrão mais crítico, a correlação mais relevante e a recomendação mais acionável.
• Use linguagem específica: não "há muitas ausências às sextas" — mas "sextas-feiras concentram N ausências (X% do total), sugerindo conflito com [contexto]."
• Se detectar risco ALTO → ofereça imediatamente consultar_riscos_recorrentes e sugerir_cobertura.

Restrições absolutas:
✗ A ASA não toma decisões — apresenta evidências e sugere opções.
✗ A ASA não redistribui pessoas ou altera escalas automaticamente.
✗ A ASA não remove ou arquiva memórias sem confirmação do gestor.
✓ A ASA sempre explica o raciocínio por trás de cada padrão detectado.
✓ A ASA sempre apresenta evidências quantitativas antes de recomendar.

⸻

Biblioteca Inteligente e Conhecimento (Sprint 10)

Você tem acesso à base de conhecimento institucional da organização.

Quando o usuário perguntar sobre regras, procedimentos, personagens, figurinos ou segurança:
1. Chame sugerir_leituras(tema="{palavra-chave}") para encontrar documentos relevantes.
2. Se o usuário quiser aprofundar → chame resumir_documento para trazer o conteúdo completo.
3. Se o usuário perguntar sobre diferença entre versões ou documentos → use comparar_documentos.

Mapeamento de intenções → tools:
• "O que diz o regulamento de folgas?" → sugerir_leituras(tema="folgas") → resumir_documento
• "Qual a diferença entre o contrato antigo e o novo?" → comparar_documentos
• "Quais documentos temos?" → consultar_perguntas_frequentes
• "Quais documentos estão desatualizados?" → consultar_documentos_populares
• "Explica o procedimento de segurança" → sugerir_leituras(tema="segurança") → resumir_documento

Tipos de documento disponíveis:
• OPERATIONAL_PROCEDURE — como fazer as coisas
• RULES_AND_POLICIES — regulamentos e políticas
• CHARACTER_REFERENCE — referência de personagens
• COSTUME_REFERENCE — referência de figurinos
• ONBOARDING_MATERIAL — integração de novos membros
• SAFETY_PROCEDURE — segurança

Comportamentos proativos:
✓ Se a conversa envolver folgas → sugira documentos de RULES_AND_POLICIES sobre folgas.
✓ Se consultar um personagem → ofereça CHARACTER_REFERENCE relacionado.
✓ Se houver rascunhos pendentes detectados → avise o gestor que há documentos para publicar.
✓ Se um documento estiver desatualizado há > 90 dias → sinalize e sugira revisão.

Apresente documentos de forma útil: não apenas liste títulos — explique o que cada um cobre e por que é relevante para o contexto da pergunta.

⸻

Estatísticas e Inteligência Operacional (Sprint 09)

Você tem acesso a dados históricos e pode responder perguntas analíticas.

Mapeamento de perguntas → tools:
• "Como está a operação?" / "Painel geral" → consultar_estatisticas
• "Quem tem se destacado?" / "KPIs da semana" → consultar_indicadores
• "Quem tem mais atividades?" / "Desempenho da equipe" → consultar_desempenho
• "Quantas ausências tivemos?" / "Padrão de faltas" → consultar_ausencias_historicas
• "Como estão as tarefas?" / "Taxa de conclusão" → consultar_tarefas_historicas
• "Quem está sobrecarregado?" / "Distribuição histórica" → consultar_carga_historica

Ao apresentar estatísticas:
• Use emojis de categoria: 📈 atividades, 📌 tarefas, 🌴 ausências, 🏆 reconhecimentos, ⚠️ conflitos.
• Destaque sempre o TOP e o pior indicador para contextualizar.
• Se detectar desequilíbrio de carga → alerte e ofereça sugerir_cobertura ou redistribuição.
• Se taxa de conclusão de tarefas < 50% → alerte como risco operacional.
• Se houver membro com > 3 ausências no período → mencione e ofereça consultar_historico_membro.

Sempre explique o que o número significa em contexto operacional — não apenas liste dados brutos.

⸻

Mensagens Inteligentes (Sprint 08)

Você pode analisar mensagens de grupos e threads operacionais.

Quando o usuário pedir para "analisar o grupo", "ver o que está acontecendo no chat" ou "resumir as mensagens":
1. Chame analisar_conversa(sinceHours=48) para buscar mensagens recentes.
2. Analise o conteúdo e identifique categorias: 📅 eventos, 🌴 ausências, 🔄 trocas, 📌 tarefas, 🎉 social, ⚠️ atenção.
3. Para cada item detectado, apresente e sugira a ação correspondente — mas NUNCA execute sem confirmação.

Para análises específicas:
• "Tem algum ensaio mencionado?" → detectar_eventos
• "Alguém vai faltar?" → detectar_ausencias
• "Houve alguma troca?" → detectar_trocas
• "Quais tarefas foram mencionadas?" → detectar_tarefas
• "Resumo do grupo" → resumir_conversa
• "O que é importante?" → destacar_itens

Regras absolutas para mensagens:
✗ Nunca cria/registra sem confirmação explícita do gestor.
✗ Não monitora conversas privadas — apenas threads e grupos operacionais.
✓ Sempre explica o que encontrou e por que é relevante.
✓ Sempre confirma o nome do membro via consultar_membros antes de registrar qualquer ação.

⸻

Vida da Equipe e Cultura (Sprint 07)

A ASA celebra a equipe ativamente.

Ao gerar o resumo do dia, SEMPRE chame consultar_aniversarios e detectar_marcos.
Se houver aniversários ou marcos → mencione na resposta E pergunte: "Deseja criar um reconhecimento?"

Proatividade cultural (modo Equilibrado ou Proativo):
• Aniversários → "🎉 [Nome] faz aniversário hoje! Posso criar um reconhecimento especial?"
• Tempo de casa → "⭐ [Nome] completa [N] anos na ASA hoje! Quer que eu crie um reconhecimento?"
• Conquistas → "🏆 [Nome] atingiu [N] atividades! Uma conquista que merece ser celebrada."
• Quando alguém elogia um membro → "Posso criar um reconhecimento formal para [Nome]?"

Ao criar um reconhecimento automático:
1. Chame criar_reconhecimento_automatico com triggerType e triggerLabel claros.
2. Apresente o texto gerado ANTES de publicar.
3. Pergunte: "Posso publicar este reconhecimento?"
4. Só publique após confirmação.

Histórico pessoal:
• Quando perguntarem sobre a trajetória ou conquistas de um membro → use consultar_historico_membro.
• Marcos próximos (próximos 7 dias) → use consultar_marcos para alertas antecipados.

⸻

Modo Supervisor (Sprint 06)${isManager ? "" : "\n[Seção não aplicável ao papel atual]"}

${isManager ? `Você age como assistente operacional dos supervisores e administradores.

Ao gerar o resumo do dia para gestores, SEMPRE use este formato:

☀️ Bom dia! Aqui está o panorama da operação de hoje:

📅 [N] atividades escaladas.
🌴 [N] membros de folga.
⚠️ [N] conflito(s) detectado(s) — listar brevemente.
📌 [N] tarefa(s) crítica(s) — listar as mais urgentes.
💡 Sugestão: [se houver membro sobrecarregado ou posição aberta].

Para isso, chame em sequência: gerar_resumo_do_dia → consultar_riscos_operacionais → consultar_tarefas_criticas.
Se houver riscos, chame também consultar_conflitos.

Ao identificar uma posição sem cobertura:
1. Chame consultar_posicoes_abertas para confirmar.
2. Chame sugerir_cobertura(date, activityLabel) para listar candidatos.
3. Apresente: "💡 Sugiro [Nome] porque [motivo: disponível / tem experiência / menor carga]."
4. Nunca escale automaticamente. Aguarde confirmação.

Ao detectar sobrecarga:
1. Chame consultar_carga_operacional para ver a distribuição.
2. Identifique quem tem mais e quem tem menos carga.
3. Sugira redistribuição: "Arthur tem 6 atividades esta semana. Posso redistribuir alguma?"

Princípio: a ASA supervisiona junto. Nunca substitui o supervisor.` : "[seção disponível apenas para gestores]"}

⸻

Detecção de Intenções Operacionais (Sprint 05)

Você SEMPRE monitora o que as pessoas dizem para identificar intenções operacionais implícitas. Quando detectar qualquer um dos padrões abaixo, reaja imediatamente — sem esperar ser perguntada.

→ Ensaios e eventos ("Amanhã temos ensaio às 09h", "vamos ter um treino", "reunião na sexta")
   Responda: "🔍 Detectei um possível ensaio. Deseja que eu crie um rascunho?
   📅 [título/tipo detectado]
   ⏰ [horário mencionado se houver]
   📍 [local se mencionado]
   Posso criar agora — só confirme ou ajuste os detalhes."
   → Use criar_ensaio_rascunho após confirmação.

→ Trocas de escala ("Amanda vai trocar com Carol", "fulano vai cobrir fulana", "vou cobrir o plantão de X")
   Responda: "🔄 Detectei uma possível troca de escala entre [nome1] e [nome2]. Deseja que eu crie uma solicitação formal?"
   → Use consultar_membros para resolver os nomes, depois criar_solicitacao_troca após confirmação.

→ Ausências e no-shows ("Arthur vai faltar amanhã", "fulano não vem hoje", "vou precisar faltar", "faltei")
   Responda: "📋 Detectei uma possível ausência de [nome] em [data]. Deseja que eu registre?"
   → Use consultar_membros, depois registrar_ausencia após confirmação.

Regras obrigatórias para detecção:
1. NUNCA execute a ação sem confirmação explícita ("sim", "pode criar", "faz isso").
2. Sempre resolva os nomes via consultar_membros antes de agir.
3. Se a data não for mencionada, pergunte antes de continuar.
4. Se detectar mais de uma intenção, trate uma de cada vez.
5. Após criar, informe onde o item foi registrado e como acompanhar.

⸻

Listas de membros e operações em lote (Sprint 12)

Quando o usuário citar VÁRIOS membros numa mesma frase (separados por vírgula, "e", ";" ou quebras de linha — ex: "crie a tarefa X para João, Pedro e Ana" ou "João, Pedro e Ana faltaram hoje"), trate isso como uma operação em lote:

1. RESOLVER: passe a lista inteira de uma vez para consultar_membros (ele aceita vários nomes e devolve "resultados" por nome, mais "membrosResolvidos"). Não chame uma vez por nome.
2. RESUMIR: antes de executar qualquer ação em massa, mostre um resumo claro do que será feito e PEÇA CONFIRMAÇÃO. Ex:
   "📋 Detectei 3 ações. Vou:
   • Criar tarefa 'X' para João Silva (até 25/06)
   • Criar tarefa 'X' para Pedro Santos (até 25/06)
   • Criar tarefa 'X' para Ana Costa (até 25/06)
   ⚠️ 'Bia' não foi encontrada — vou pular.
   Posso executar?"
3. NUNCA execute o lote silenciosamente. Só chame as ferramentas *_lote (criar_tarefas_lote, registrar_ausencias_lote, criar_reconhecimentos_lote, criar_entradas_escala_lote, adicionar_participantes_evento) APÓS o usuário confirmar ("sim", "pode", "manda ver").
4. Para nomes ambíguos ou não encontrados: NÃO trave a operação inteira. Liste-os no resumo, prossiga com os que foram resolvidos e pergunte separadamente sobre os pendentes.
5. RELATAR: após executar, repasse o resultado item a item — quantos deram certo e quais falharam (com o motivo). As ferramentas de lote continuam mesmo quando um item falha.
6. Para 1 só membro numa única data/período, use as ferramentas individuais normais.
6b. UM MEMBRO em VÁRIAS DATAS (ex: "folga para a Amanda nos dias 03, 04, 10, 17 de junho"): isto também é um LOTE. NÃO trate cada data como uma ação separada.
   • Chame consultar_membros UMA ÚNICA VEZ para resolver a pessoa (NUNCA uma vez por data).
   • Para folgas em dias avulsos (não consecutivos), use registrar_ausencias_lote com UM item por data (mesmo userId, startDate = a data de cada dia, type DAY_OFF). Confirme antes.
   • Se as datas forem um período contínuo (ex: "de 03 a 10"), use registrar_ausencia uma só vez com startDate e endDate.
6c. REGRA DE EFICIÊNCIA (obrigatória): nunca chame consultar_membros mais do que uma vez para o mesmo nome dentro da mesma conversa. Depois de resolver um membro, reutilize o userId já obtido para todas as datas/ações seguintes. Repetir consultar_membros deixa tudo lento e é proibido.
7. DESFAZER: se o usuário pedir para desfazer/cancelar/reverter o que você acabou de criar em massa ("desfaz isso", "cancela o que você acabou de criar", "reverte o último lote"), use a ferramenta desfazer_lote. Pegue do resultado do último lote o campo "tipo" e os IDs dos itens que tiveram ok=true (itens[].id). Resuma o que será desfeito e PEÇA CONFIRMAÇÃO antes de chamar. Ela reverte item a item e continua mesmo se algum falhar (relate por item depois).

⸻

Montar escala por GRUPO (Task 114)

Quando o usuário pedir para montar escala/atividade para um GRUPO pelo nome (ex: "escala a Equipe de Palco para o ensaio de sábado", "coloca o grupo Acrobacias na atividade X"):
1. RESOLVER O GRUPO: chame consultar_grupo(query="nome do grupo"). Ele entende grupos da operação atual e grupos amplos (várias/todas operações) que cobrem a operação. Devolve "members" (com userId e name) e "membrosResolvidos".
2. Se found=false → diga que não achou o grupo e ofereça listar os grupos disponíveis. Se ambiguous=true → mostre os grupos parecidos ("groups") e peça para o usuário escolher.
3. Se o grupo não tiver membros ativos → avise e não monte escala vazia.
4. RESUMIR + CONFIRMAR: liste os membros do grupo e o que será criado para cada um, e PEÇA CONFIRMAÇÃO antes de executar.
5. EXECUTAR: após confirmação, use criar_entradas_escala_lote (uma entrada por membro do grupo) — não chame criar_entrada_escala um por um.

⸻

Gerir GRUPOS e MEMBROS (CRUD)${isManager ? "" : "\n[Seção não aplicável ao seu papel atual]"}

${isManager ? `Você pode criar, editar, remover grupos e gerir os membros dentro deles. Regras de papel:
• SUPERVISOR: só grupos da operação atual (scope OPERATION). criar_grupo usa automaticamente a operação atual.
• ADMIN: além dos da operação, pode criar grupos amplos — scope MULTI (com operationIds das operações cobertas) ou scope ALL (todas as operações da organização).

Ferramentas:
• criar_grupo(name, scope?, operationIds?) — cria o grupo.
• editar_grupo(groupId, name?, status?) — renomeia e/ou muda status (ACTIVE/INACTIVE/ARCHIVED).
• remover_grupo(groupId) — arquiva o grupo (status ARCHIVED); é a forma de "remover".
• adicionar_membro_grupo(groupId, userId) — o membro precisa pertencer a uma operação coberta pelo grupo.
• remover_membro_grupo(groupId, userId) — tira o membro do grupo.

Fluxo obrigatório:
1. LOCALIZAR: para editar/remover/gerir membros, use consultar_grupo para obter o groupId (e os membros em "members"). Para achar um userId a adicionar, use consultar_membros.
2. CONFIRMAR: descreva a ação (o que será criado/alterado/removido) e PEÇA CONFIRMAÇÃO explícita antes de executar. Nunca aja sem confirmação.
3. EXECUTAR: só então chame a ferramenta. A ferramenta valida permissões e escopo e devolve erro amigável se algo não for permitido.
4. RELATAR: confirme o resultado de forma simples.` : ""}

⸻

Edição de entidades por conversa

Quando o usuário pedir para MUDAR, ALTERAR, CORRIGIR, REMARCAR, TROCAR ou ATUALIZAR algo que já existe (uma tarefa, folga/ausência, ensaio/bloco de agenda, aviso em rascunho ou reconhecimento), siga SEMPRE este fluxo:

1. LOCALIZAR: identifique o item exato. Use a ferramenta de consulta correspondente (consultar_tarefas, consultar_folgas, consultar_agenda, consultar_avisos, consultar_reconhecimentos) para obter o ID e os valores atuais. Se houver mais de um candidato, pergunte qual antes de prosseguir.
2. MOSTRAR ANTES/DEPOIS: apresente claramente o que vai mudar, no formato:
   "✏️ Vou alterar [item]:
   • [campo]: [valor atual] → [novo valor]
   Confirma?"
3. CONFIRMAR: NUNCA edite sem confirmação explícita ("sim", "pode", "confirmo").
4. EXECUTAR: só então chame a ferramenta de edição (editar_tarefa, editar_ausencia, editar_evento_agenda, editar_aviso, editar_reconhecimento), enviando o ID e APENAS os campos que mudam.
5. RELATAR: após a edição, confirme o que foi alterado.

Restrições de estado (a ferramenta também valida e devolve erro amigável se violado):
• Tarefa: NÃO pode ser editada se estiver APROVADA, CONCLUÍDA ou CANCELADA.
• Evento da agenda (ensaio/bloco): NÃO pode ser editado se estiver CANCELADO ou CONCLUÍDO.
• Aviso: só pode ser editado enquanto estiver em RASCUNHO (DRAFT). Avisos já publicados não podem ser editados.
• Ausência: não pode ser editada se já estiver cancelada.
Se o item não puder ser editado por causa do estado, explique o motivo ao usuário em vez de tentar.

Apenas gestores podem editar entidades.

⸻

Princípios

1. Confirme ações importantes antes de executar.
2. Nunca execute ações irreversíveis sem confirmação explícita.
3. Use o conhecimento sobre a equipe ativamente nas sugestões.
4. Consulte a biblioteca quando a pergunta envolver regulamentos ou documentos.
5. Explique suas decisões de forma clara e humana.
6. Seja útil antes de ser técnica.

⸻

Estilo de Conversa

Fale como uma colega experiente, não como um sistema.

❌ "A consulta ao banco retornou dois registros."
✅ "Eu encontrei duas pessoas chamadas Arthur. Qual você quer dizer?"

❌ "Segundo a memória operacional chave 'cobertura:musical'…"
✅ "Pelo que já vi, Ana Clara é quem melhor cobre o Musical quando alguém falta."

Quando houver dúvida: apresente opções, peça confirmação, explique o problema.

⸻

O que você pode fazer:
${isManager
  ? `• Consultar agenda, escalas, responsabilidades, notificações, avisos, tarefas, folgas, disponibilidade e membros
• Pesquisar documentos na biblioteca (regulamentos, manuais, procedimentos)
• Criar entradas na escala, tarefas, rascunhos de aviso e ensaio
• Registrar ausências, folgas, férias e afastamentos por período (um dia ou múltiplos dias)
• Cancelar ausências e tarefas registradas
• Publicar avisos e escalas com confirmação obrigatória
• Criar blocos operacionais na agenda (preparação, reunião, montagem, treinamento)
• Verificar quem leu (ou não) documentos da biblioteca
• Gerar resumo personalizado do dia com análise operacional
• Consultar aniversários e detectar marcos de tempo de casa
• Criar e consultar reconhecimentos para membros da equipe
• Consultar o clima atual
• Resolver listas de membros e executar ações em lote (tarefas, ausências, reconhecimentos, escala, participantes de evento) com resumo e confirmação antes
• Sugerir memórias para aprovação e aprender com a equipe`
  : `• Consultar sua escala, tarefas e informações do dia
• Pesquisar documentos na biblioteca
• Gerar resumo do dia (escala, tarefas, ausências, clima)
• Consultar aniversários e reconhecimentos da equipe
• Verificar o clima
• Sugerir aprendizados para aprovação`}

⸻

Fluxo obrigatório para ações com membros${isManager ? "" : " (não aplicável ao seu papel atual)"}:

1. Use consultar_membros para resolver o nome ANTES de criar qualquer entrada, tarefa ou reconhecimento.
2. Se houver ambiguidade → "Eu encontrei dois com esse nome. Qual você quer dizer?"
3. Se o membro estiver de folga ou afastado → avise e peça confirmação.
4. Após confirmar tudo → "Posso criar isso?" antes de executar.

⸻

Explicabilidade

Ao tomar decisões ou sugestões importantes, estruture assim:

📋 O que encontrei.
🧠 O que analisei.
⚠️ Riscos ou conflitos.
💡 Minha sugestão.

⸻

Restrições

• Não aprova ações sozinha.
• Não publica conteúdo sozinha.
• Não altera dados críticos sem confirmação.
• Não cria memórias permanentes sem aprovação.
• Não revela o tipo de restrição HEALTH ou PHYSICAL de ninguém pelo nome.
• Não cita mensagens privadas.

A decisão final é sempre humana.

⸻

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
    description: "Consulta a escala pessoal do usuário — suas entradas e alocações confirmadas. Use para responder 'minha escala', 'onde estou na escala', 'o que tenho essa semana'. Gestores podem consultar a escala de outro membro via userId.",
    input_schema: {
      type: "object" as const,
      properties: {
        userId:   { type: "string", description: "ID do membro (opcional — somente gestores; padrão: usuário atual)" },
        dateFrom: { type: "string", description: "Data início (YYYY-MM-DD). Padrão: hoje." },
        dateTo:   { type: "string", description: "Data fim (YYYY-MM-DD). Padrão: +14 dias." },
        limit:    { type: "number", description: "Máximo de entradas (padrão: 20)" },
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
    description: "Consulta tarefas do usuário atual ('minhas tarefas', 'o que tenho para fazer'). Membros veem apenas as próprias tarefas. Gestores veem todas as da organização ou podem filtrar por membro via userId.",
    input_schema: {
      type: "object" as const,
      properties: {
        userId: { type: "string", description: "ID do membro (opcional — somente gestores)" },
        status: { type: "string", description: "Status: CREATED, IN_PROGRESS, DONE, CHANGES_REQUESTED, CANCELLED" },
        limit:  { type: "number", description: "Máximo de resultados (padrão: 10)" },
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
    description: "Consulta aniversários dos membros para uma data. Verifica tanto o campo birthDate dos usuários quanto memórias registradas. Usa para alertas proativos e sugestão de reconhecimentos.",
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
    name: "consultar_grupo",
    description: "Resolve um grupo pelo nome (ex: 'Equipe de Palco', 'Acrobacias') dentro da operação atual e devolve os membros ativos com seus userIds. Considera grupos da operação e grupos amplos (várias/todas as operações) que cobrem a operação atual. Use ANTES de montar escala por grupo: pega os membros e depois cria uma entrada para cada um com criar_entrada_escala.",
    input_schema: {
      type: "object" as const,
      required: ["query"],
      properties: {
        query: { type: "string", description: "Nome ou parte do nome do grupo a buscar" },
      },
    },
  },
  {
    name: "criar_grupo",
    description: "Cria um grupo. SUPERVISOR só cria grupos da operação atual (scope OPERATION). ADMIN pode criar grupos amplos: várias operações (scope MULTI + operationIds) ou todas (scope ALL). Confirme com o usuário antes de criar.",
    input_schema: {
      type: "object" as const,
      required: ["name"],
      properties: {
        name: { type: "string", description: "Nome do grupo" },
        scope: { type: "string", description: "OPERATION (operação atual), MULTI (várias operações) ou ALL (todas). Padrão OPERATION." },
        operationIds: { type: "array", items: { type: "string" }, description: "IDs das operações cobertas (somente scope MULTI; apenas ADMIN)" },
      },
    },
  },
  {
    name: "editar_grupo",
    description: "Edita um grupo existente: renomeia e/ou muda o status (ACTIVE/INACTIVE/ARCHIVED). Use consultar_grupo antes para obter o groupId. Confirme com o usuário antes de editar.",
    input_schema: {
      type: "object" as const,
      required: ["groupId"],
      properties: {
        groupId: { type: "string", description: "ID do grupo (obtido via consultar_grupo)" },
        name: { type: "string", description: "Novo nome (opcional)" },
        status: { type: "string", description: "Novo status: ACTIVE, INACTIVE ou ARCHIVED (opcional)" },
      },
    },
  },
  {
    name: "remover_grupo",
    description: "Remove (arquiva) um grupo, definindo o status como ARCHIVED. Use consultar_grupo antes para obter o groupId. Confirme com o usuário antes de remover.",
    input_schema: {
      type: "object" as const,
      required: ["groupId"],
      properties: {
        groupId: { type: "string", description: "ID do grupo (obtido via consultar_grupo)" },
      },
    },
  },
  {
    name: "adicionar_membro_grupo",
    description: "Adiciona um membro a um grupo. Use consultar_grupo para o groupId e consultar_membros para o userId. O membro deve pertencer a uma operação coberta pelo grupo. Confirme com o usuário antes.",
    input_schema: {
      type: "object" as const,
      required: ["groupId", "userId"],
      properties: {
        groupId: { type: "string", description: "ID do grupo (obtido via consultar_grupo)" },
        userId: { type: "string", description: "ID do membro a adicionar (obtido via consultar_membros)" },
        userName: { type: "string", description: "Nome do membro (para confirmação)" },
      },
    },
  },
  {
    name: "remover_membro_grupo",
    description: "Remove um membro de um grupo. Use consultar_grupo para o groupId (os membros vêm em 'members' com userId). Confirme com o usuário antes de remover.",
    input_schema: {
      type: "object" as const,
      required: ["groupId", "userId"],
      properties: {
        groupId: { type: "string", description: "ID do grupo (obtido via consultar_grupo)" },
        userId: { type: "string", description: "ID do membro a remover (obtido via consultar_grupo em 'members')" },
        userName: { type: "string", description: "Nome do membro (para confirmação)" },
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
  {
    name: "consultar_reconhecimentos",
    description: "Consulta reconhecimentos criados para membros da organização. Mostra histórico de celebrações, marcos e conquistas registradas pela ASA.",
    input_schema: {
      type: "object" as const,
      properties: {
        userId: { type: "string", description: "ID do usuário (opcional, para filtrar por membro)" },
        limit:  { type: "number", description: "Máximo de resultados (padrão: 10)" },
      },
    },
  },
  {
    name: "criar_reconhecimento",
    description: "Cria um reconhecimento personalizado para um membro da equipe (tempo de casa, aniversário, conquista, excelência). Use consultar_membros primeiro. Sempre confirme com o usuário antes de executar.",
    input_schema: {
      type: "object" as const,
      required: ["userId", "type", "title", "message"],
      properties: {
        userId:  { type: "string", description: "ID do membro a ser reconhecido (obtido via consultar_membros)" },
        type:    { type: "string", description: "Tipo: BIRTHDAY, ONE_YEAR, TWO_YEARS, SIX_MONTHS, THREE_MONTHS, TASK_COMPLETED, CUSTOM" },
        title:   { type: "string", description: "Título do reconhecimento (ex: '1 ano na ASA! 🎉')" },
        message: { type: "string", description: "Mensagem personalizada e calorosa de reconhecimento" },
      },
    },
  },
  {
    name: "detectar_marcos",
    description: "Detecta marcos dos membros da organização hoje: tempo de casa (3 meses, 6 meses, 1 ano, 2 anos...). Útil para identificar quem deve ser reconhecido.",
    input_schema: {
      type: "object" as const,
      properties: {
        type: { type: "string", description: "Tipo de marco: TIME_OF_HOUSE ou ALL (padrão: ALL)" },
      },
    },
  },
  // ── Push / Notificações ───────────────────────────────────────────────────────
  {
    name: "enviar_push",
    description: "Envia uma notificação push (bandeja do celular) e registra no histórico in-app de um ou mais responsáveis. Use para avisar sobre pendências, lembretes ou alertas operacionais. Exclusivo para gestores. Sempre confirme com o usuário antes de disparar. Use consultar_membros para obter os IDs. Se o membro não tiver dispositivo registrado, o aviso fica só no histórico in-app.",
    input_schema: {
      type: "object" as const,
      required: ["userIds", "title", "message"],
      properties: {
        userIds:  { type: "array", items: { type: "string" }, description: "IDs dos membros a notificar (obtidos via consultar_membros)" },
        title:    { type: "string", description: "Título curto da notificação (ex: 'Lembrete de tarefa')" },
        message:  { type: "string", description: "Corpo da notificação" },
        priority: { type: "string", description: "Prioridade: LOW, NORMAL, IMPORTANT, CRITICAL (padrão: NORMAL)" },
      },
    },
  },
  // ── Publicação ───────────────────────────────────────────────────────────────
  {
    name: "publicar_aviso",
    description: "Publica um aviso que estava em rascunho (DRAFT). ATENÇÃO: esta ação torna o aviso visível para todos os destinatários. Apresente o título/conteúdo do aviso ao gestor e peça confirmação explícita ('sim, publicar') ANTES de executar. Requer o ID do aviso.",
    input_schema: {
      type: "object" as const,
      properties: {
        noticeId: { type: "string", description: "ID UUID do aviso a publicar (obtido via criar_aviso_rascunho ou histórico)" },
      },
      required: ["noticeId"],
    },
  },
  {
    name: "publicar_escala",
    description: "Publica uma escala que estava em rascunho (DRAFT). ATENÇÃO: após a publicação, os membros passam a ver suas alocações. Apresente o título e período da escala ao gestor e peça confirmação explícita ('sim, publicar') ANTES de executar. Requer o ID da escala — use consultar_escalas para encontrá-la.",
    input_schema: {
      type: "object" as const,
      properties: {
        scaleId: { type: "string", description: "ID UUID da escala a publicar (obtido via consultar_escalas)" },
      },
      required: ["scaleId"],
    },
  },
  // ── Blocos Operacionais ───────────────────────────────────────────────────────
  {
    name: "criar_bloco_agenda",
    description: "Cria um bloco operacional na agenda (preparação, montagem, reunião, manutenção, treinamento, etc.). Criado como rascunho — confirme no web admin para torná-lo visível aos membros. Use quando o usuário disser: 'criar bloco', 'agendar preparação', 'bloco de montagem', 'reservar horário', etc.",
    input_schema: {
      type: "object" as const,
      required: ["titulo", "data"],
      properties: {
        titulo:     { type: "string", description: "Título do bloco (ex: 'Preparação Show A', 'Reunião de equipe', 'Manutenção técnica')" },
        data:       { type: "string", description: "Data do bloco (YYYY-MM-DD)" },
        horaInicio: { type: "string", description: "Hora de início (HH:MM, ex: '08:00')" },
        horaFim:    { type: "string", description: "Hora de fim (HH:MM, ex: '10:00')" },
        descricao:  { type: "string", description: "Descrição ou observações do bloco (opcional)" },
        local:      { type: "string", description: "Local do bloco (opcional)" },
      },
    },
  },
  // ── Biblioteca — Rastreamento de Leitura ─────────────────────────────────────
  {
    name: "consultar_leituras_biblioteca",
    description: "Consulta quem leu (ou não leu) um documento da biblioteca. Use para responder: 'Quem ainda não leu o regulamento?', 'Quantas leituras tem o manual?', 'Amanda já leu o documento X?'. Se mostrarNaoLeram=true, lista membros que AINDA NÃO leram o documento.",
    input_schema: {
      type: "object" as const,
      properties: {
        documentId:      { type: "string", description: "ID UUID do documento (opcional — se omitido, lista top documentos mais lidos)" },
        titulo:          { type: "string", description: "Título parcial para buscar o documento por nome (alternativa ao ID)" },
        mostrarNaoLeram: { type: "boolean", description: "Se true, lista membros que NÃO leram o documento (requer documentId ou titulo)" },
      },
    },
  },
  // ── Operações de Cancelamento / Remoção ──────────────────────────────────────
  {
    name: "cancelar_ausencia",
    description: "Cancela (remove) uma ausência/folga previamente registrada. Use quando o usuário pedir para remover, cancelar ou desfazer uma folga. Requer o ID da folga — use consultar_folgas para encontrá-lo. SEMPRE confirme com o usuário antes de cancelar.",
    input_schema: {
      type: "object" as const,
      properties: {
        folgaId: { type: "string", description: "ID UUID da folga a cancelar" },
        motivo:  { type: "string", description: "Motivo do cancelamento (opcional)" },
      },
      required: ["folgaId"],
    },
  },
  {
    name: "cancelar_tarefa",
    description: "Cancela uma tarefa ou marca como concluída. Use quando o usuário pedir para remover, cancelar ou fechar uma tarefa. Requer o ID da tarefa — use consultar_tarefas para encontrá-lo. SEMPRE confirme com o usuário antes de cancelar.",
    input_schema: {
      type: "object" as const,
      properties: {
        taskId: { type: "string", description: "ID UUID da tarefa" },
        acao:   { type: "string", description: "CANCELAR (marca como CANCELLED) ou CONCLUIR (marca como COMPLETED). Padrão: CANCELAR" },
        motivo: { type: "string", description: "Motivo do cancelamento ou conclusão (opcional)" },
      },
      required: ["taskId"],
    },
  },
  {
    name: "remover_entrada_escala",
    description: "Remove uma entrada manual da escala (criada via criar_entrada_escala). Apenas entradas MANUAL_OVERRIDE podem ser removidas. Use quando o usuário pedir para remover uma célula ou entrada manual de escala. SEMPRE confirme antes de remover.",
    input_schema: {
      type: "object" as const,
      properties: {
        allocationId: { type: "string", description: "ID UUID da alocação a remover" },
      },
      required: ["allocationId"],
    },
  },
  // ── Sprint 11 — Aprendizado Organizacional ───────────────────────────────────
  {
    name: "consultar_tendencias",
    description: "Analisa tendências temporais da operação: quais dias da semana concentram mais ausências ou atrasos, quais meses têm maior carga, e como os indicadores evoluem ao longo do tempo. Use para responder 'quando a operação é mais crítica?' ou 'existe algum padrão temporal?'",
    input_schema: {
      type: "object" as const,
      properties: {
        periodo: { type: "string", description: "Janela de análise: '30d' (padrão), '90d', '6m' ou '12m'" },
        tipo:    { type: "string", description: "Focar em: AUSENCIAS | TAREFAS | ATIVIDADES | TODOS (padrão: TODOS)" },
      },
    },
  },
  {
    name: "consultar_padroes",
    description: "Identifica padrões operacionais recorrentes: membros com comportamento atípico, operações com mais problemas, atividades que geram mais conflitos ou trocas. Responde 'O que se repete?' e 'Onde está o problema?'",
    input_schema: {
      type: "object" as const,
      properties: {
        dateFrom: { type: "string", description: "Data início (YYYY-MM-DD). Padrão: últimos 90 dias." },
        dateTo:   { type: "string", description: "Data fim (YYYY-MM-DD). Padrão: hoje." },
        limite:   { type: "number", description: "Máximo de itens por padrão detectado (padrão: 5)" },
      },
    },
  },
  {
    name: "consultar_aprendizados",
    description: "Recupera o conhecimento acumulado pela ASA: memórias institucionais aprovadas e padrões derivados dos dados históricos. Use quando o usuário perguntar 'o que a ASA aprendeu?' ou 'quais são os aprendizados da operação?'",
    input_schema: {
      type: "object" as const,
      properties: {
        scope: { type: "string", description: "Filtrar por escopo de memória (opcional)" },
      },
    },
  },
  {
    name: "consultar_riscos_recorrentes",
    description: "Detecta riscos operacionais que se repetem com frequência: membros com muitas ausências consecutivas, tarefas cronicamente atrasadas, posições abertas frequentes e membros sobrecarregados. Classifica cada risco como ALTO/MÉDIO/BAIXO.",
    input_schema: {
      type: "object" as const,
      properties: {
        dateFrom: { type: "string", description: "Data início (YYYY-MM-DD). Padrão: últimos 90 dias." },
        dateTo:   { type: "string", description: "Data fim (YYYY-MM-DD). Padrão: hoje." },
      },
    },
  },
  {
    name: "gerar_relatorio_asa",
    description: "Gera um relatório operacional estruturado — semanal ou mensal — com todos os indicadores, destaques, riscos e aprendizados. Claude deve formatar como um relatório executivo com seções, emojis e linguagem clara. Use quando pedirem 'relatório da semana', 'resumo do mês' ou 'como foi o período?'",
    input_schema: {
      type: "object" as const,
      properties: {
        tipo:     { type: "string", description: "SEMANAL (padrão) ou MENSAL" },
        dateFrom: { type: "string", description: "Data início (YYYY-MM-DD). Calculado automaticamente se omitido." },
        dateTo:   { type: "string", description: "Data fim (YYYY-MM-DD). Padrão: hoje." },
      },
    },
  },
  // ── Sprint 10 — Biblioteca Inteligente e Conhecimento ────────────────────────
  {
    name: "resumir_documento",
    description: "Busca um documento da biblioteca pelo título ou ID e retorna seu conteúdo para resumo. Use quando o usuário perguntar 'o que diz o documento X?', 'explica o regulamento Y' ou pedir para ler um documento específico. Claude deve resumir o conteúdo em linguagem clara e operacional.",
    input_schema: {
      type: "object" as const,
      properties: {
        documentId: { type: "string", description: "ID UUID do documento (opcional se buscar por título)" },
        titulo:     { type: "string", description: "Título ou trecho do título para busca (opcional se tiver ID)" },
      },
    },
  },
  {
    name: "comparar_documentos",
    description: "Busca dois documentos (ou duas versões do mesmo documento) e retorna ambos os conteúdos lado a lado para Claude comparar diferenças. Use quando o usuário perguntar 'qual a diferença entre X e Y?' ou 'o que mudou na versão nova?'",
    input_schema: {
      type: "object" as const,
      properties: {
        documentId1: { type: "string", description: "ID do primeiro documento (ou do documento a comparar versões)" },
        documentId2: { type: "string", description: "ID do segundo documento (omitir para comparar versões do mesmo doc)" },
        titulo1:     { type: "string", description: "Título do primeiro documento (alternativa ao ID)" },
        titulo2:     { type: "string", description: "Título do segundo documento (alternativa ao ID)" },
        versao1:     { type: "number", description: "Versão específica para comparar (opcional)" },
        versao2:     { type: "number", description: "Segunda versão para comparar (opcional)" },
      },
    },
  },
  {
    name: "consultar_perguntas_frequentes",
    description: "Lista os tópicos e documentos da biblioteca mais relevantes com base nos tipos de conteúdo disponíveis. Identifica quais documentos têm múltiplas versões (muito atualizados), quais são onboarding e quais são procedimentos operacionais. Use para responder 'que tipo de informação a organização registra?'",
    input_schema: {
      type: "object" as const,
      properties: {
        tipo: { type: "string", description: "Filtrar por tipo: OPERATIONAL_PROCEDURE | RULES_AND_POLICIES | CHARACTER_REFERENCE | COSTUME_REFERENCE | ONBOARDING_MATERIAL | SAFETY_PROCEDURE (opcional)" },
      },
    },
  },
  {
    name: "consultar_documentos_populares",
    description: "Retorna documentos categorizados por estado: recém-atualizados (UPDATED), desatualizados (PUBLISHED há mais de 90 dias sem revisão), rascunhos pendentes (DRAFT) e arquivados. Identifica gaps na base de conhecimento. Use para 'quais documentos precisam de atenção?'",
    input_schema: {
      type: "object" as const,
      properties: {
        limite: { type: "number", description: "Máximo de documentos por categoria (padrão: 5)" },
      },
    },
  },
  {
    name: "sugerir_leituras",
    description: "Busca documentos relevantes para um tema específico. Use quando o usuário perguntar sobre um assunto que pode estar documentado (folgas, figurinos, personagens, segurança, procedimentos) ou quando a conversa atual envolve um tópico com documentos relacionados.",
    input_schema: {
      type: "object" as const,
      properties: {
        tema:  { type: "string", description: "Tema ou palavra-chave para buscar nos documentos (ex: 'folga', 'figurino', 'segurança')" },
        tipo:  { type: "string", description: "Filtrar por tipo de documento (opcional)" },
        limit: { type: "number", description: "Número máximo de sugestões (padrão: 5)" },
      },
      required: ["tema"],
    },
  },
  // ── Sprint 09 — Estatísticas e Inteligência Operacional ──────────────────────
  {
    name: "consultar_estatisticas",
    description: "Retorna um snapshot estatístico da operação: total de atividades escaladas, tarefas por status, ausências registradas, reconhecimentos e posições abertas. Use quando perguntarem 'como está a operação' ou pedirem um painel geral.",
    input_schema: {
      type: "object" as const,
      properties: {
        dateFrom: { type: "string", description: "Data início (YYYY-MM-DD). Padrão: início do mês atual." },
        dateTo:   { type: "string", description: "Data fim (YYYY-MM-DD). Padrão: hoje." },
      },
    },
  },
  {
    name: "consultar_indicadores",
    description: "Retorna KPIs operacionais: top performer (mais atividades), membro com mais ausências, taxa de conclusão de tarefas, cobertura das escalas, número de conflitos detectados. Ideal para o resumo executivo do supervisor.",
    input_schema: {
      type: "object" as const,
      properties: {
        dateFrom: { type: "string", description: "Data início (YYYY-MM-DD). Padrão: últimos 30 dias." },
        dateTo:   { type: "string", description: "Data fim (YYYY-MM-DD). Padrão: hoje." },
      },
    },
  },
  {
    name: "consultar_desempenho",
    description: "Analisa o desempenho individual ou coletivo: atividades realizadas, tarefas concluídas, tarefas atrasadas e ausências por membro. Ordena do melhor para o pior desempenho. Use para responder 'quem tem se destacado?' ou 'quem tem mais atrasos?'",
    input_schema: {
      type: "object" as const,
      properties: {
        dateFrom: { type: "string", description: "Data início (YYYY-MM-DD). Padrão: últimos 30 dias." },
        dateTo:   { type: "string", description: "Data fim (YYYY-MM-DD). Padrão: hoje." },
        userId:   { type: "string", description: "ID do membro específico (opcional — omitir para toda a operação)" },
        limit:    { type: "number", description: "Máximo de membros no ranking (padrão: 10)" },
      },
    },
  },
  {
    name: "consultar_ausencias_historicas",
    description: "Analisa o histórico de ausências: total por período, ranking de membros com mais ausências, distribuição por tipo (NO_SHOW/DAY_OFF/OUTRO) e períodos com maior concentração. Detecta padrões e sazonalidade.",
    input_schema: {
      type: "object" as const,
      properties: {
        dateFrom: { type: "string", description: "Data início (YYYY-MM-DD). Padrão: últimos 90 dias." },
        dateTo:   { type: "string", description: "Data fim (YYYY-MM-DD). Padrão: hoje." },
        limit:    { type: "number", description: "Máximo de membros no ranking (padrão: 10)" },
      },
    },
  },
  {
    name: "consultar_tarefas_historicas",
    description: "Analisa o histórico de tarefas: taxa de conclusão, tarefas atrasadas vs concluídas, membros com mais atrasos, tempo médio de conclusão e gargalos recorrentes. Use para responder 'como está a produtividade?'",
    input_schema: {
      type: "object" as const,
      properties: {
        dateFrom: { type: "string", description: "Data início (YYYY-MM-DD). Padrão: últimos 30 dias." },
        dateTo:   { type: "string", description: "Data fim (YYYY-MM-DD). Padrão: hoje." },
        limit:    { type: "number", description: "Máximo de membros no ranking (padrão: 10)" },
      },
    },
  },
  {
    name: "consultar_carga_historica",
    description: "Mostra a distribuição histórica de carga de trabalho: atividades por membro ao longo do tempo, operações com maior demanda, semanas mais intensas. Ajuda a identificar sobrecarga crônica e desequilíbrios.",
    input_schema: {
      type: "object" as const,
      properties: {
        dateFrom: { type: "string", description: "Data início (YYYY-MM-DD). Padrão: últimos 30 dias." },
        dateTo:   { type: "string", description: "Data fim (YYYY-MM-DD). Padrão: hoje." },
        limit:    { type: "number", description: "Máximo de membros (padrão: 15)" },
      },
    },
  },
  // ── Sprint 08 — Mensagens Inteligentes ───────────────────────────────────────
  {
    name: "analisar_conversa",
    description: "Busca as mensagens recentes de um grupo ou thread operacional e as retorna para análise. Use quando o usuário pedir para analisar um canal, grupo ou conversa. Após receber as mensagens, identifique ensaios, tarefas, ausências, trocas e outros eventos operacionais.",
    input_schema: {
      type: "object" as const,
      properties: {
        threadId: { type: "string", description: "ID do thread de mensagens (opcional)" },
        groupId:  { type: "string", description: "ID do grupo operacional (opcional)" },
        limit:    { type: "number", description: "Número de mensagens a buscar (padrão: 30)" },
        sinceHours: { type: "number", description: "Buscar mensagens das últimas N horas (padrão: 48)" },
      },
    },
  },
  {
    name: "detectar_eventos",
    description: "Analisa mensagens recentes e detecta menções a ensaios, reuniões ou eventos. Retorna as mensagens que contêm palavras-chave como 'ensaio', 'reunião', 'apresentação', horários e datas. Claude deve extrair: hora, data, tipo de evento e sugerir criar_ensaio_rascunho se confirmado.",
    input_schema: {
      type: "object" as const,
      properties: {
        threadId:   { type: "string", description: "ID do thread (opcional)" },
        groupId:    { type: "string", description: "ID do grupo (opcional)" },
        limit:      { type: "number", description: "Mensagens a buscar (padrão: 50)" },
        sinceHours: { type: "number", description: "Janela de tempo em horas (padrão: 72)" },
      },
    },
  },
  {
    name: "detectar_tarefas",
    description: "Analisa mensagens recentes e detecta menções a tarefas implícitas: 'X precisa fazer Y', 'X fica responsável por Y', 'alguém pode fazer Y'. Retorna mensagens com padrões de responsabilidade. Claude deve extrair: responsável, tarefa, prazo (se mencionado) e sugerir criação.",
    input_schema: {
      type: "object" as const,
      properties: {
        threadId:   { type: "string", description: "ID do thread (opcional)" },
        groupId:    { type: "string", description: "ID do grupo (opcional)" },
        limit:      { type: "number", description: "Mensagens a buscar (padrão: 50)" },
        sinceHours: { type: "number", description: "Janela de tempo em horas (padrão: 72)" },
      },
    },
  },
  {
    name: "detectar_ausencias",
    description: "Analisa mensagens recentes e detecta menções a ausências: 'X não vai vir', 'X vai faltar', 'X está afastado'. Retorna mensagens com padrões de ausência. Claude deve extrair: membro, data e sugerir registrar_ausencia se confirmado.",
    input_schema: {
      type: "object" as const,
      properties: {
        threadId:   { type: "string", description: "ID do thread (opcional)" },
        groupId:    { type: "string", description: "ID do grupo (opcional)" },
        limit:      { type: "number", description: "Mensagens a buscar (padrão: 50)" },
        sinceHours: { type: "number", description: "Janela de tempo em horas (padrão: 72)" },
      },
    },
  },
  {
    name: "detectar_trocas",
    description: "Analisa mensagens recentes e detecta menções a trocas de escala: 'X troca com Y', 'X e Y vão trocar'. Retorna mensagens com padrões de troca. Claude deve extrair: os dois membros, a data e sugerir criar_solicitacao_troca se confirmado.",
    input_schema: {
      type: "object" as const,
      properties: {
        threadId:   { type: "string", description: "ID do thread (opcional)" },
        groupId:    { type: "string", description: "ID do grupo (opcional)" },
        limit:      { type: "number", description: "Mensagens a buscar (padrão: 50)" },
        sinceHours: { type: "number", description: "Janela de tempo em horas (padrão: 72)" },
      },
    },
  },
  {
    name: "resumir_conversa",
    description: "Busca e estrutura as mensagens de um grupo/thread para gerar um resumo operacional. Claude deve produzir: total de mensagens, participantes, ensaios detectados, ausências, tarefas e trocas mencionadas.",
    input_schema: {
      type: "object" as const,
      properties: {
        threadId:   { type: "string", description: "ID do thread (opcional)" },
        groupId:    { type: "string", description: "ID do grupo (opcional)" },
        limit:      { type: "number", description: "Mensagens a analisar (padrão: 50)" },
        sinceHours: { type: "number", description: "Janela de tempo em horas (padrão: 48)" },
      },
    },
  },
  {
    name: "destacar_itens",
    description: "Analisa mensagens e destaca itens operacionais importantes categorizados: ensaios, ausências, trocas, tarefas, aniversários e mudanças operacionais. Retorna cada item com categoria, remetente, conteúdo e sugestão de ação.",
    input_schema: {
      type: "object" as const,
      properties: {
        threadId:   { type: "string", description: "ID do thread (opcional)" },
        groupId:    { type: "string", description: "ID do grupo (opcional)" },
        limit:      { type: "number", description: "Mensagens a analisar (padrão: 50)" },
        sinceHours: { type: "number", description: "Janela de tempo em horas (padrão: 72)" },
      },
    },
  },
  // ── Sprint 07 — Vida da Equipe e Cultura Organizacional ─────────────────────
  {
    name: "detectar_conquistas",
    description: "Detecta conquistas de membros: marcos de 50 ou 100 atividades escaladas, 50 ou 100 tarefas concluídas. Retorna lista de membros que atingiram ou estão próximos de marcos. Use ao gerar o resumo do dia ou quando perguntarem sobre conquistas da equipe.",
    input_schema: {
      type: "object" as const,
      properties: {
        userId: { type: "string", description: "ID do membro específico (opcional — omitir para toda a organização)" },
        limit:  { type: "number", description: "Máximo de resultados (padrão: 20)" },
      },
    },
  },
  {
    name: "consultar_marcos",
    description: "Consulta marcos de tempo de casa e aniversários para os próximos N dias. Diferente de detectar_marcos (que verifica hoje): este retorna marcos futuros para planejamento. Excelente para alertas antecipados.",
    input_schema: {
      type: "object" as const,
      properties: {
        daysAhead: { type: "number", description: "Dias à frente para verificar (padrão: 7)" },
      },
    },
  },
  {
    name: "criar_reconhecimento_automatico",
    description: "Cria um reconhecimento formal para um membro baseado em conquista detectada automaticamente (aniversário, tempo de casa, marco de atividades). Sempre pede confirmação antes de publicar.",
    input_schema: {
      type: "object" as const,
      required: ["userId", "userName", "triggerType", "triggerLabel"],
      properties: {
        userId:       { type: "string", description: "ID do membro" },
        userName:     { type: "string", description: "Nome do membro para exibição" },
        triggerType:  { type: "string", description: "Tipo do gatilho: BIRTHDAY | TIME_OF_HOUSE | ACHIEVEMENT" },
        triggerLabel: { type: "string", description: "Descrição do gatilho: 'Aniversário', '2 anos na ASA', '100 apresentações'" },
        customMessage:{ type: "string", description: "Mensagem personalizada (opcional — ASA gera automaticamente se omitido)" },
      },
    },
  },
  {
    name: "consultar_historico_membro",
    description: "Retorna o perfil de conquistas de um membro: reconhecimentos recebidos, tempo de casa, marcos atingidos, atividades realizadas e tarefas concluídas.",
    input_schema: {
      type: "object" as const,
      required: ["userId"],
      properties: {
        userId:   { type: "string", description: "ID do membro" },
        userName: { type: "string", description: "Nome do membro (para exibição)" },
      },
    },
  },
  // ── Sprint 06 — Assistente do Supervisor ────────────────────────────────────
  {
    name: "consultar_riscos_operacionais",
    description: "Analisa a operação e detecta riscos: membros com tarefas atrasadas, membros de folga com atividades, excesso de carga, pendências críticas. Use quando o supervisor pedir um panorama de riscos ou ao gerar o resumo do dia.",
    input_schema: {
      type: "object" as const,
      properties: {
        date: { type: "string", description: "Data de análise (YYYY-MM-DD). Padrão: hoje." },
      },
    },
  },
  {
    name: "consultar_posicoes_abertas",
    description: "Lista posições em aberto nas escalas ativas da operação (alocações sem responsável definido). Ideal para alertar sobre lacunas de cobertura.",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: { type: "number", description: "Máximo de resultados (padrão: 20)" },
      },
    },
  },
  {
    name: "consultar_tarefas_criticas",
    description: "Lista tarefas críticas: atrasadas (vencidas), vencendo hoje ou amanhã, ou com responsável indisponível. Exclusivo para gestores.",
    input_schema: {
      type: "object" as const,
      properties: {
        daysAhead: { type: "number", description: "Dias à frente para alertar (padrão: 2 — hoje e amanhã)" },
        limit:     { type: "number", description: "Máximo de resultados (padrão: 15)" },
      },
    },
  },
  {
    name: "consultar_conflitos",
    description: "Detecta conflitos operacionais: membros de folga com atividades na escala, sobreposições de agenda, disponibilidade comprometida. Retorna lista de conflitos com nome do membro, tipo e data.",
    input_schema: {
      type: "object" as const,
      properties: {
        dateFrom: { type: "string", description: "Data início (YYYY-MM-DD). Padrão: hoje." },
        dateTo:   { type: "string", description: "Data fim (YYYY-MM-DD). Padrão: +7 dias." },
      },
    },
  },
  {
    name: "sugerir_cobertura",
    description: "Sugere membros disponíveis para cobrir uma posição ou atividade. Considera folgas, carga atual e experiência prévia. Sempre deixa a decisão final para o supervisor.",
    input_schema: {
      type: "object" as const,
      required: ["date"],
      properties: {
        date:          { type: "string", description: "Data da cobertura necessária (YYYY-MM-DD)" },
        activityLabel: { type: "string", description: "Nome da atividade a cobrir (opcional — para filtrar por experiência)" },
        excludeUserId: { type: "string", description: "ID do membro a excluir da sugestão (o que vai faltar)" },
      },
    },
  },
  {
    name: "consultar_carga_operacional",
    description: "Mostra a carga de trabalho por membro: número de atividades na escala e tarefas pendentes. Útil para identificar quem está sobrecarregado ou disponível para mais.",
    input_schema: {
      type: "object" as const,
      properties: {
        dateFrom: { type: "string", description: "Data início (YYYY-MM-DD). Padrão: hoje." },
        dateTo:   { type: "string", description: "Data fim (YYYY-MM-DD). Padrão: +7 dias." },
        limit:    { type: "number", description: "Máximo de membros (padrão: 20)" },
      },
    },
  },
  // ── Sprint 05 — Conversas Inteligentes ──────────────────────────────────────
  {
    name: "registrar_ausencia",
    description: "Registra ausência, folga, férias, afastamento ou licença de um membro. Suporta um dia único OU períodos longos (ex: 'Amanda afastada de 01/07 a 20/07'). Use consultar_membros ANTES para obter o userId correto. Para detectar: se o usuário mencionar 'férias', 'afastamento', 'licença', 'recesso' → use AFASTAMENTO ou RECESSO. SEMPRE confirme antes de executar.",
    input_schema: {
      type: "object" as const,
      required: ["userId", "startDate"],
      properties: {
        userId:    { type: "string", description: "ID do membro (obtido via consultar_membros)" },
        userName:  { type: "string", description: "Nome do membro (para confirmação na resposta)" },
        startDate: { type: "string", description: "Data de início (YYYY-MM-DD)" },
        endDate:   { type: "string", description: "Data de fim (YYYY-MM-DD). Se omitido, usa startDate (um único dia)" },
        date:      { type: "string", description: "Alias para startDate — use startDate de preferência" },
        type:      { type: "string", description: "Tipo: NO_SHOW (falta avulsa, padrão) | DAY_OFF | AFASTAMENTO (doença, cirurgia) | RECESSO | RESTRICAO | OUTRO. Para períodos multi-dia, padrão automático é AFASTAMENTO" },
        reason:    { type: "string", description: "Motivo (opcional)" },
      },
    },
  },
  {
    name: "criar_solicitacao_troca",
    description: "Cria uma solicitação formal de troca de escala entre dois membros. Use consultar_membros ANTES para resolver os dois nomes. Confirme com o usuário antes de executar.",
    input_schema: {
      type: "object" as const,
      required: ["userId1", "userName1", "userId2", "userName2", "date"],
      properties: {
        userId1:   { type: "string", description: "ID do primeiro membro (obtido via consultar_membros)" },
        userName1: { type: "string", description: "Nome do primeiro membro" },
        userId2:   { type: "string", description: "ID do segundo membro (obtido via consultar_membros)" },
        userName2: { type: "string", description: "Nome do segundo membro" },
        date:      { type: "string", description: "Data da troca (YYYY-MM-DD)" },
        notes:     { type: "string", description: "Detalhes adicionais sobre a troca (opcional)" },
      },
    },
  },
  // ── Sprint 12 — Multi-membro e operações em lote ────────────────────────────
  {
    name: "criar_tarefas_lote",
    description: "Cria VÁRIAS tarefas de uma vez (uma por membro/item). Use quando o usuário pedir a mesma tarefa para vários membros (ex: 'crie a tarefa X para João, Pedro e Ana') ou várias tarefas diferentes. Resolva os nomes via consultar_membros ANTES. SEMPRE resuma o que será criado e peça confirmação antes de chamar esta ferramenta. Continua mesmo se um item falhar.",
    input_schema: {
      type: "object" as const,
      required: ["tarefas"],
      properties: {
        tarefas: {
          type: "array",
          description: "Lista de tarefas a criar",
          items: {
            type: "object",
            required: ["title", "assigneeId", "dueDate"],
            properties: {
              title:        { type: "string", description: "Título da tarefa" },
              description:  { type: "string", description: "Descrição (opcional)" },
              assigneeId:   { type: "string", description: "ID do responsável (via consultar_membros)" },
              assigneeName: { type: "string", description: "Nome do responsável (para o resumo)" },
              dueDate:      { type: "string", description: "Prazo (YYYY-MM-DD)" },
              priority:     { type: "string", description: "LOW | MEDIUM (padrão) | HIGH | CRITICAL" },
            },
          },
        },
      },
    },
  },
  {
    name: "registrar_ausencias_lote",
    description: "Registra VÁRIAS ausências/folgas/afastamentos de uma vez (uma por membro). Use quando o usuário listar vários membros ausentes (ex: 'João, Pedro e Ana faltaram hoje'). Resolva os nomes via consultar_membros ANTES. SEMPRE resuma e peça confirmação antes de executar. Continua mesmo se um item falhar.",
    input_schema: {
      type: "object" as const,
      required: ["ausencias"],
      properties: {
        ausencias: {
          type: "array",
          description: "Lista de ausências a registrar",
          items: {
            type: "object",
            required: ["userId", "startDate"],
            properties: {
              userId:    { type: "string", description: "ID do membro (via consultar_membros)" },
              userName:  { type: "string", description: "Nome do membro (para o resumo)" },
              startDate: { type: "string", description: "Data de início (YYYY-MM-DD)" },
              endDate:   { type: "string", description: "Data de fim (YYYY-MM-DD). Se omitido, usa startDate" },
              type:      { type: "string", description: "NO_SHOW (padrão dia único) | DAY_OFF | AFASTAMENTO (padrão multi-dia) | RECESSO | RESTRICAO | OUTRO" },
              reason:    { type: "string", description: "Motivo (opcional)" },
            },
          },
        },
      },
    },
  },
  {
    name: "criar_reconhecimentos_lote",
    description: "Cria VÁRIOS reconhecimentos de uma vez (um por membro). Use quando o usuário quiser reconhecer vários membros (ex: 'parabenize João, Pedro e Ana pelo evento'). Resolva os nomes via consultar_membros ANTES. SEMPRE resuma e peça confirmação antes de executar. Continua mesmo se um item falhar.",
    input_schema: {
      type: "object" as const,
      required: ["reconhecimentos"],
      properties: {
        reconhecimentos: {
          type: "array",
          description: "Lista de reconhecimentos a criar",
          items: {
            type: "object",
            required: ["userId", "type", "title", "message"],
            properties: {
              userId:   { type: "string", description: "ID do membro (via consultar_membros)" },
              userName: { type: "string", description: "Nome do membro (para o resumo)" },
              type:     { type: "string", description: "Tipo do reconhecimento" },
              title:    { type: "string", description: "Título do reconhecimento" },
              message:  { type: "string", description: "Mensagem do reconhecimento" },
            },
          },
        },
      },
    },
  },
  {
    name: "criar_entradas_escala_lote",
    description: "Cria VÁRIAS entradas de escala de uma vez (uma por membro). Use quando o usuário quiser escalar vários membros para a mesma atividade/data (ex: 'escale João, Pedro e Ana para o ensaio de sábado'). Resolva os nomes via consultar_membros ANTES. SEMPRE resuma e peça confirmação antes de executar. Requer uma escala ativa cobrindo a data. Continua mesmo se um item falhar.",
    input_schema: {
      type: "object" as const,
      required: ["entradas"],
      properties: {
        entradas: {
          type: "array",
          description: "Lista de entradas de escala a criar",
          items: {
            type: "object",
            required: ["userId", "date", "label"],
            properties: {
              userId:    { type: "string", description: "ID do membro (via consultar_membros)" },
              userName:  { type: "string", description: "Nome do membro (para o resumo)" },
              date:      { type: "string", description: "Data da atividade (YYYY-MM-DD)" },
              label:     { type: "string", description: "Nome/atividade da entrada" },
              startTime: { type: "string", description: "Horário de início (opcional)" },
              endTime:   { type: "string", description: "Horário de fim (opcional)" },
              notes:     { type: "string", description: "Observações (opcional)" },
            },
          },
        },
      },
    },
  },
  {
    name: "adicionar_participantes_evento",
    description: "Adiciona VÁRIOS participantes a um evento da agenda de uma vez (ex: 'adicione todo o time ao ensaio de sábado'). Identifique o evento por eventId (via consultar_agenda) OU por eventoTitulo + data. Resolva os nomes dos participantes via consultar_membros ANTES. Cada participante vira uma entrada de escala vinculada ao evento. SEMPRE resuma e peça confirmação antes de executar. Continua mesmo se um participante falhar.",
    input_schema: {
      type: "object" as const,
      required: ["participantes"],
      properties: {
        eventId:      { type: "string", description: "ID do evento da agenda (via consultar_agenda). Preferencial." },
        eventoTitulo: { type: "string", description: "Título do evento (alternativa ao eventId, combinar com data)" },
        data:         { type: "string", description: "Data do evento YYYY-MM-DD (usada com eventoTitulo, ou como data da entrada)" },
        participantes: {
          type: "array",
          description: "Lista de membros a adicionar como participantes",
          items: {
            type: "object",
            required: ["userId"],
            properties: {
              userId:   { type: "string", description: "ID do membro (via consultar_membros)" },
              userName: { type: "string", description: "Nome do membro (para o resumo)" },
            },
          },
        },
      },
    },
  },
  {
    name: "desfazer_lote",
    description: "Desfaz (cancela/remove) os itens criados na ÚLTIMA execução em lote. Use quando o usuário pedir para desfazer, cancelar ou reverter o que você acabou de criar em massa (ex: 'desfaz isso', 'cancela o que você acabou de criar', 'reverte o último lote'). Pegue do resultado do último lote o campo 'tipo' e os IDs dos itens com sucesso (itens[].id onde ok=true). SEMPRE resuma o que será desfeito e peça confirmação antes de chamar. Reusa os cancelamentos individuais item a item e continua mesmo se um item falhar.",
    input_schema: {
      type: "object" as const,
      required: ["tipo", "ids"],
      properties: {
        tipo: { type: "string", description: "Tipo do lote a desfazer (campo 'tipo' devolvido pela ferramenta de lote): tarefas | ausencias | reconhecimentos | entradas_escala | participantes_evento" },
        ids:  {
          type: "array",
          description: "IDs dos itens criados no lote (itens[].id, apenas os que tiveram ok=true)",
          items: { type: "string" },
        },
      },
    },
  },
  // ── Edição de entidades por conversa ────────────────────────────────────────
  {
    name: "editar_tarefa",
    description: "Edita uma tarefa existente (título, descrição, responsável, prazo ou prioridade). Use quando o usuário pedir para mudar/alterar/corrigir/atualizar uma tarefa (ex: 'mude o prazo da tarefa X para sexta', 'troque o responsável'). Use consultar_tarefas ANTES para obter o taskId. Tarefas APROVADAS, CONCLUÍDAS ou CANCELADAS NÃO podem ser editadas. SEMPRE mostre o antes/depois e peça confirmação explícita antes de chamar esta ferramenta. Envie apenas os campos que mudam.",
    input_schema: {
      type: "object" as const,
      required: ["taskId"],
      properties: {
        taskId:       { type: "string", description: "ID UUID da tarefa (via consultar_tarefas)" },
        title:        { type: "string", description: "Novo título (opcional)" },
        description:  { type: "string", description: "Nova descrição (opcional)" },
        assigneeId:   { type: "string", description: "ID do novo responsável (via consultar_membros) (opcional)" },
        assigneeName: { type: "string", description: "Nome do novo responsável (para o resumo) (opcional)" },
        dueDate:      { type: "string", description: "Novo prazo YYYY-MM-DD (opcional)" },
        priority:     { type: "string", description: "Nova prioridade: LOW | MEDIUM | HIGH | CRITICAL (opcional)" },
      },
    },
  },
  {
    name: "editar_ausencia",
    description: "Edita uma ausência/folga existente (datas, tipo ou motivo). Use quando o usuário pedir para mudar/corrigir uma folga (ex: 'a folga da Amanda é na quinta, não na quarta', 'mude o tipo para afastamento'). Use consultar_folgas ANTES para obter o folgaId. Ausências CANCELADAS não podem ser editadas. SEMPRE mostre o antes/depois e peça confirmação antes de chamar esta ferramenta. Envie apenas os campos que mudam.",
    input_schema: {
      type: "object" as const,
      required: ["folgaId"],
      properties: {
        folgaId:   { type: "string", description: "ID UUID da folga (via consultar_folgas)" },
        startDate: { type: "string", description: "Nova data de início YYYY-MM-DD (opcional)" },
        endDate:   { type: "string", description: "Nova data de fim YYYY-MM-DD (opcional)" },
        type:      { type: "string", description: "Novo tipo: NO_SHOW | DAY_OFF | AFASTAMENTO | RECESSO | RESTRICAO | OUTRO (opcional)" },
        reason:    { type: "string", description: "Novo motivo/observação (opcional)" },
      },
    },
  },
  {
    name: "editar_evento_agenda",
    description: "Edita um evento da agenda existente — ensaio ou bloco operacional (título, data, horários, local ou descrição). Use quando o usuário pedir para mudar/remarcar/alterar um ensaio ou bloco (ex: 'mude o ensaio de sábado para domingo', 'o bloco começa às 9h'). Use consultar_agenda ANTES para obter o eventId. Eventos CANCELADOS ou CONCLUÍDOS não podem ser editados. SEMPRE mostre o antes/depois e peça confirmação antes de chamar esta ferramenta. Envie apenas os campos que mudam.",
    input_schema: {
      type: "object" as const,
      required: ["eventId"],
      properties: {
        eventId:    { type: "string", description: "ID UUID do evento (via consultar_agenda)" },
        titulo:     { type: "string", description: "Novo título (opcional)" },
        data:       { type: "string", description: "Nova data YYYY-MM-DD (opcional)" },
        dataFim:    { type: "string", description: "Nova data de fim YYYY-MM-DD (opcional)" },
        horaInicio: { type: "string", description: "Novo horário de início HH:MM (opcional)" },
        horaFim:    { type: "string", description: "Novo horário de fim HH:MM (opcional)" },
        local:      { type: "string", description: "Novo local (opcional)" },
        descricao:  { type: "string", description: "Nova descrição/observações (opcional)" },
      },
    },
  },
  {
    name: "editar_aviso",
    description: "Edita um aviso que ainda está em rascunho (DRAFT) — título, conteúdo, tipo, urgência ou confirmação. Use quando o usuário pedir para corrigir/ajustar um aviso ANTES de publicá-lo. Use consultar_avisos ANTES para obter o noticeId. Apenas avisos em RASCUNHO podem ser editados; avisos já publicados NÃO podem. SEMPRE mostre o antes/depois e peça confirmação antes de chamar esta ferramenta. Envie apenas os campos que mudam.",
    input_schema: {
      type: "object" as const,
      required: ["noticeId"],
      properties: {
        noticeId:             { type: "string", description: "ID UUID do aviso (via consultar_avisos)" },
        title:                { type: "string", description: "Novo título (opcional)" },
        content:              { type: "string", description: "Novo conteúdo (opcional)" },
        type:                 { type: "string", description: "Novo tipo: INFORMATIVE | IMPORTANT | PERSISTENT | ESCALATED (opcional)" },
        urgency:              { type: "string", description: "Nova urgência: INFORMATIVE | IMPORTANT | CRITICAL (opcional)" },
        requiresConfirmation: { type: "boolean", description: "Exige confirmação de leitura (opcional)" },
      },
    },
  },
  {
    name: "editar_reconhecimento",
    description: "Edita um reconhecimento existente (tipo, título ou mensagem). Use quando o usuário pedir para corrigir/ajustar um reconhecimento já criado. Use consultar_reconhecimentos ANTES para obter o recognitionId. SEMPRE mostre o antes/depois e peça confirmação antes de chamar esta ferramenta. Envie apenas os campos que mudam.",
    input_schema: {
      type: "object" as const,
      required: ["recognitionId"],
      properties: {
        recognitionId: { type: "string", description: "ID UUID do reconhecimento (via consultar_reconhecimentos)" },
        type:          { type: "string", description: "Novo tipo do reconhecimento (opcional)" },
        title:         { type: "string", description: "Novo título (opcional)" },
        message:       { type: "string", description: "Nova mensagem (opcional)" },
      },
    },
  },
];

// ────────────────────────────────────────────────────────────────────────────
// Shared helpers — resolução multi-membro + cores de operação (single + lote)
// ────────────────────────────────────────────────────────────────────────────

type ToolCtx = { userId: string; organizationId: string | null; userRole: string; operationId: string | null };

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .trim();
}

/**
 * Quebra uma query de membros em nomes individuais. Aceita vírgula, ponto-e-vírgula,
 * o conectivo "e" (com espaços ao redor) e quebras de linha.
 * Ex.: "João, Pedro e Ana" → ["João", "Pedro", "Ana"]
 */
function splitMemberQueries(raw: string): string[] {
  const parts = raw
    .split(/\s*,\s*|\s*;\s*|\s+e\s+|\n+/i)
    .map((s) => s.trim())
    .filter(Boolean);
  // Deduplicate preserving order (case-insensitive)
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const key = normalizeName(p);
    if (key && !seen.has(key)) { seen.add(key); out.push(p); }
  }
  return out;
}

type MemberMatch = { id: string; name: string };
type MemberResolution = {
  query: string;
  found: boolean;
  ambiguous: boolean;
  member: MemberMatch | null;
  members: MemberMatch[];
  message: string;
};

/**
 * Resolve um único nome contra a lista de usuários, usando as memórias para apelidos.
 * Não aborta — sempre devolve um resultado estruturado (encontrado / ambíguo / não encontrado).
 */
function resolveOneMember(
  query: string,
  users: MemberMatch[],
  memories: { key: string; value: string }[],
): MemberResolution {
  const normQuery = normalizeName(query);
  let resolvedQuery = normQuery;
  for (const m of memories) {
    if (normalizeName(m.key) === normQuery) { resolvedQuery = normalizeName(m.value); break; }
  }

  const scored = users
    .map((u) => {
      const normName = normalizeName(u.name);
      let score = 0;
      if (normName === resolvedQuery) score = 100;
      else {
        const nameWords = normName.split(" ");
        const qWords = resolvedQuery.split(" ").filter(Boolean);
        for (const qw of qWords) {
          for (const nw of nameWords) {
            if (nw === qw) score += 40;
            else if (nw.startsWith(qw) && qw.length >= 3) score += 25;
            else if (nw.includes(qw) && qw.length >= 3) score += 12;
          }
        }
      }
      return { id: u.id, name: u.name, score };
    })
    .filter((u) => u.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  if (scored.length === 0) {
    return {
      query, found: false, ambiguous: false, member: null, members: [],
      message: `Nenhum membro encontrado para "${query}".`,
    };
  }

  const isAmbiguous = scored.length > 1 && scored[0]!.score === scored[1]!.score;
  return {
    query,
    found: true,
    ambiguous: isAmbiguous,
    member: isAmbiguous ? null : { id: scored[0]!.id, name: scored[0]!.name },
    members: scored.map((u) => ({ id: u.id, name: u.name })),
    message: isAmbiguous
      ? `"${query}": encontrei ${scored.length} membros com nomes similares. Qual você quer dizer?`
      : `"${query}": ${scored[0]!.name}`,
  };
}

/** Carrega os usuários ativos da operação/organização + memórias aprovadas (para apelidos). */
async function loadOrgMembersAndMemories(ctx: ToolCtx): Promise<{ users: MemberMatch[]; memories: { key: string; value: string }[] }> {
  const allUsers = await db
    .select({ id: usersTable.id, name: usersTable.name })
    .from(usersTable)
    .innerJoin(userRolesTable, eq(userRolesTable.userId, usersTable.id))
    .where(and(
      ctx.operationId ? eq(userRolesTable.operationId, ctx.operationId) : sql`true`,
      ne(usersTable.status, "INACTIVE"),
    ));
  const userMap = new Map<string, MemberMatch>();
  for (const u of allUsers) userMap.set(u.id, u);

  const memories = ctx.organizationId
    ? await db
        .select({ key: asaMemoriesTable.key, value: asaMemoriesTable.value })
        .from(asaMemoriesTable)
        .where(and(
          eq(asaMemoriesTable.status, "APPROVED"),
          eq(asaMemoriesTable.organizationId, ctx.organizationId),
        ))
        .limit(100)
    : [];

  return { users: [...userMap.values()], memories };
}

type GroupMatch = { id: string; name: string; scope: string };

/** Operações cobertas por um grupo (OPERATION→[operationId]; MULTI→group_operations; ALL→todas da org). */
async function groupCoverageOps(group: GroupMatch, organizationId: string): Promise<string[]> {
  if (group.scope === "ALL") {
    const ops = await db
      .select({ id: operationsTable.id })
      .from(operationsTable)
      .where(eq(operationsTable.organizationId, organizationId));
    return ops.map((o) => o.id);
  }
  if (group.scope === "MULTI") {
    const links = await db
      .select({ operationId: groupOperationsTable.operationId })
      .from(groupOperationsTable)
      .where(eq(groupOperationsTable.groupId, group.id));
    return links.map((l) => l.operationId);
  }
  const [g] = await db
    .select({ operationId: operationalGroupsTable.operationId })
    .from(operationalGroupsTable)
    .where(eq(operationalGroupsTable.id, group.id))
    .limit(1);
  return g?.operationId ? [g.operationId] : [];
}

/**
 * Resolve um grupo pelo nome dentro do escopo da operação atual e devolve os membros ativos.
 * Considera grupos da operação (OPERATION) e grupos amplos (MULTI/ALL) que cobrem a operação atual.
 * Não aborta — devolve sempre um resultado estruturado.
 */
async function coreResolverGrupo(
  ctx: ToolCtx,
  query: string,
): Promise<{
  found: boolean;
  ambiguous: boolean;
  group: GroupMatch | null;
  groups: GroupMatch[];
  members: MemberMatch[];
  message: string;
}> {
  if (!ctx.organizationId) {
    return { found: false, ambiguous: false, group: null, groups: [], members: [], message: "Organização não configurada" };
  }

  // Operações da organização (para mapear grupos amplos/ALL).
  const orgOps = await db
    .select({ id: operationsTable.id })
    .from(operationsTable)
    .where(eq(operationsTable.organizationId, ctx.organizationId));
  const orgOpIds = new Set(orgOps.map((o) => o.id));

  // Todos os grupos ativos visíveis à organização.
  const allGroups = await db
    .select({
      id: operationalGroupsTable.id,
      name: operationalGroupsTable.name,
      scope: operationalGroupsTable.scope,
      organizationId: operationalGroupsTable.organizationId,
      operationId: operationalGroupsTable.operationId,
    })
    .from(operationalGroupsTable)
    .where(eq(operationalGroupsTable.status, "ACTIVE"));

  // Mantém apenas grupos da organização atual que cobrem a operação atual.
  const inScope: GroupMatch[] = [];
  for (const g of allGroups) {
    const belongsToOrg =
      g.organizationId === ctx.organizationId || (g.operationId ? orgOpIds.has(g.operationId) : false);
    if (!belongsToOrg) continue;
    const match: GroupMatch = { id: g.id, name: g.name, scope: g.scope };
    if (ctx.operationId) {
      const covered = await groupCoverageOps(match, ctx.organizationId);
      if (!covered.includes(ctx.operationId)) continue;
    }
    inScope.push(match);
  }

  // Pontuação por nome (reaproveita normalizeName).
  const normQuery = normalizeName(query);
  const scored = inScope
    .map((g) => {
      const normName = normalizeName(g.name);
      let score = 0;
      if (normName === normQuery) score = 100;
      else {
        const nameWords = normName.split(" ");
        const qWords = normQuery.split(" ").filter(Boolean);
        for (const qw of qWords) {
          for (const nw of nameWords) {
            if (nw === qw) score += 40;
            else if (nw.startsWith(qw) && qw.length >= 3) score += 25;
            else if (nw.includes(qw) && qw.length >= 3) score += 12;
          }
        }
      }
      return { ...g, score };
    })
    .filter((g) => g.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  if (scored.length === 0) {
    return {
      found: false, ambiguous: false, group: null, groups: [], members: [],
      message: `Nenhum grupo encontrado para "${query}" nesta operação.`,
    };
  }

  const ambiguous = scored.length > 1 && scored[0]!.score === scored[1]!.score;
  if (ambiguous) {
    return {
      found: true, ambiguous: true, group: null,
      groups: scored.map((g) => ({ id: g.id, name: g.name, scope: g.scope })),
      members: [],
      message: `Encontrei ${scored.length} grupos com nomes parecidos com "${query}". Qual você quer dizer?`,
    };
  }

  const top = scored[0]!;
  const group: GroupMatch = { id: top.id, name: top.name, scope: top.scope };

  // Membros ativos do grupo (user_roles role=MEMBER, groupId, active).
  // Quando há operação atual, restringe aos membros dessa operação — para montar escala
  // da operação corrente não faz sentido trazer membros de outra operação (grupos amplos).
  const memberConds = [
    eq(userRolesTable.groupId, group.id),
    eq(userRolesTable.role, "MEMBER"),
    eq(userRolesTable.active, true),
    ne(usersTable.status, "INACTIVE"),
  ];
  if (ctx.operationId) {
    memberConds.push(eq(userRolesTable.operationId, ctx.operationId));
  }
  const memberRows = await db
    .select({ id: usersTable.id, name: usersTable.name })
    .from(userRolesTable)
    .innerJoin(usersTable, eq(usersTable.id, userRolesTable.userId))
    .where(and(...memberConds));
  const memberMap = new Map<string, MemberMatch>();
  for (const m of memberRows) memberMap.set(m.id, m);
  const members = [...memberMap.values()];

  return {
    found: true,
    ambiguous: false,
    group,
    groups: [group],
    members,
    message: members.length > 0
      ? `Grupo "${group.name}": ${members.length} membro(s) — ${members.map((m) => m.name).join(", ")}`
      : `Grupo "${group.name}" não tem membros ativos.`,
  };
}

// ── Cores de operação (lançam Error com mensagem amigável em caso de falha) ──────

async function coreCriarTarefa(
  ctx: ToolCtx,
  p: { title?: string; description?: string; assigneeId?: string; dueDate?: string; priority?: string },
): Promise<{ id: string }> {
  if (!ctx.organizationId) throw new Error("Organização não configurada");
  if (!ctx.operationId) throw new Error("Operação não configurada");
  if (!p.title || !p.assigneeId || !p.dueDate) throw new Error("title, assigneeId e dueDate são obrigatórios");
  const priority = (p.priority as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL") ?? "MEDIUM";
  const [task] = await db
    .insert(tasksTable)
    .values({
      organizationId: ctx.organizationId,
      operationId: ctx.operationId,
      title: p.title,
      description: p.description ?? undefined,
      creatorId: ctx.userId,
      assigneeId: p.assigneeId,
      priority,
      dueDate: p.dueDate,
      status: "CREATED",
      origin: "AI",
      requiresApproval: true,
    })
    .returning();
  return { id: task!.id };
}

async function coreRegistrarAusencia(
  ctx: ToolCtx,
  p: { userId?: string; startDate?: string; endDate?: string; date?: string; type?: string; reason?: string },
): Promise<{ id: string; startDate: string; endDate: string; type: string; isSingleDay: boolean }> {
  if (!ctx.organizationId) throw new Error("Organização não configurada");
  if (!ctx.operationId) throw new Error("Selecione uma operação antes de registrar ausências");
  if (!p.userId) throw new Error("userId é obrigatório");
  const startDate = ((p.startDate ?? p.date) as string | undefined) ?? "";
  if (!startDate) throw new Error("startDate é obrigatório");
  const endDate = (p.endDate ?? startDate) as string;
  const isSingleDay = startDate === endDate;
  const defaultType = isSingleDay ? "NO_SHOW" : "AFASTAMENTO";
  const absType = ((p.type as string | undefined) ?? defaultType) as typeof folgasTable.$inferInsert["type"];
  const [folga] = await db.insert(folgasTable).values({
    userId: p.userId,
    operationId: ctx.operationId,
    type: absType,
    startDate,
    endDate,
    status: "ACTIVE",
    origem: "MANUAL",
    createdBy: ctx.userId,
    notes: p.reason ?? `Registrado pela ASA em ${new Date().toLocaleDateString("pt-BR")}`,
  }).returning();
  return { id: folga!.id, startDate, endDate, type: absType as string, isSingleDay };
}

async function coreCriarReconhecimento(
  ctx: ToolCtx,
  p: { userId?: string; type?: string; title?: string; message?: string },
): Promise<{ id: string }> {
  if (!ctx.organizationId) throw new Error("Organização não configurada");
  if (!p.userId || !p.type || !p.title || !p.message)
    throw new Error("userId, type, title e message são obrigatórios");
  const [recTarget] = await db.select({ id: usersTable.id }).from(usersTable)
    .where(and(eq(usersTable.id, p.userId), eq(usersTable.organizationId, ctx.organizationId)))
    .limit(1);
  if (!recTarget) throw new Error("Membro não encontrado nesta organização");
  const [rec] = await db.insert(recognitionsTable).values({
    organizationId: ctx.organizationId,
    userId: p.userId,
    type: p.type,
    title: p.title,
    message: p.message,
    createdBy: ctx.userId,
    publishedAt: new Date(),
  }).returning();
  try {
    await sendNotification({
      userId: p.userId,
      type: "RECOGNITION_RECEIVED",
      title: "🎉 Você recebeu um reconhecimento!",
      message: p.title,
      priority: "IMPORTANT",
      category: "system",
      entityType: "recognition",
      entityId: rec!.id,
    });
  } catch (err) { console.error("Falha ao notificar reconhecimento", { targetUserId: p.userId, recognitionId: rec!.id, err }); }
  return { id: rec!.id };
}

async function coreCriarEntradaEscala(
  ctx: ToolCtx,
  p: {
    userId?: string; userName?: string; date?: string; label?: string;
    startTime?: string; endTime?: string; notes?: string; agendaEventId?: string | null;
  },
): Promise<{ id: string; scaleId: string; scaleName: string; warning: string | null }> {
  if (!ctx.operationId) throw new Error("Operação não configurada");
  if (!p.userId || !p.date || !p.label) throw new Error("userId, date e label são obrigatórios");

  const scales = await db
    .select({ id: scalesTable.id, title: scalesTable.title, status: scalesTable.status })
    .from(scalesTable)
    .where(and(
      eq(scalesTable.operationId, ctx.operationId),
      lte(scalesTable.periodStart, p.date),
      gte(scalesTable.periodEnd, p.date),
    ))
    .orderBy(desc(scalesTable.updatedAt))
    .limit(5);

  const active = scales.filter((s) => ["DRAFT", "PUBLISHED", "REPUBLISHED"].includes(s.status));
  if (active.length === 0)
    throw new Error(`Nenhuma escala ativa cobre a data ${p.date}. Crie ou gere uma escala que inclua essa data primeiro.`);

  const scale = active[0]!;

  const folgas = await db
    .select({ id: folgasTable.id, type: folgasTable.type })
    .from(folgasTable)
    .where(and(
      eq(folgasTable.userId, p.userId),
      eq(folgasTable.status, "ACTIVE"),
      lte(folgasTable.startDate, p.date),
      gte(folgasTable.endDate, p.date),
    ))
    .limit(1);

  const [entry] = await db
    .insert(scaleAllocationsTable)
    .values({
      scaleId: scale.id,
      agendaEventId: p.agendaEventId ?? null,
      userId: p.userId,
      status: "MANUAL_OVERRIDE",
      manualDate: p.date,
      manualLabel: p.label,
      startTime: p.startTime ?? null,
      endTime: p.endTime ?? null,
      notes: p.notes ?? null,
      overriddenBy: ctx.userId,
      overrideReason: "Criado via ASA",
    })
    .returning();

  const warning = folgas.length > 0
    ? `⚠️ ${p.userName ?? "Este membro"} tem folga registrada em ${p.date} (${folgas[0]!.type}).`
    : null;

  return { id: entry!.id, scaleId: scale.id, scaleName: scale.title, warning };
}

// ── Cores de cancelamento / remoção (reusados por single + desfazer_lote) ───────

async function coreCancelarTarefa(
  ctx: ToolCtx,
  taskId: string,
  acao: string = "CANCELAR",
): Promise<{ id: string; novoStatus: string; title: string }> {
  if (!ctx.organizationId) throw new Error("Organização não configurada");
  const novoStatus = acao.toUpperCase() === "CONCLUIR" ? "COMPLETED" : "CANCELLED";
  const [existing] = await db
    .select({ id: tasksTable.id, status: tasksTable.status, title: tasksTable.title })
    .from(tasksTable)
    .where(and(eq(tasksTable.id, taskId), eq(tasksTable.organizationId, ctx.organizationId)))
    .limit(1);
  if (!existing) throw new Error("Tarefa não encontrada");
  if (existing.status === "CANCELLED" || existing.status === "COMPLETED")
    throw new Error(`Tarefa já está no status ${existing.status}`);
  await db.update(tasksTable).set({ status: novoStatus as typeof existing.status, updatedAt: new Date() }).where(eq(tasksTable.id, taskId));
  return { id: taskId, novoStatus, title: existing.title };
}

async function coreCancelarAusencia(
  _ctx: ToolCtx,
  folgaId: string,
): Promise<{ id: string; startDate: string }> {
  const [existing] = await db
    .select({ id: folgasTable.id, status: folgasTable.status, startDate: folgasTable.startDate })
    .from(folgasTable)
    .where(eq(folgasTable.id, folgaId))
    .limit(1);
  if (!existing) throw new Error("Ausência não encontrada com esse ID");
  if (existing.status === "CANCELLED") throw new Error("Esta ausência já está cancelada");
  await db.update(folgasTable).set({ status: "CANCELLED", updatedAt: new Date() }).where(eq(folgasTable.id, folgaId));
  return { id: folgaId, startDate: existing.startDate };
}

async function coreRemoverEntradaEscala(
  _ctx: ToolCtx,
  allocationId: string,
): Promise<{ id: string; label: string }> {
  const [existing] = await db
    .select({ id: scaleAllocationsTable.id, status: scaleAllocationsTable.status, manualLabel: scaleAllocationsTable.manualLabel })
    .from(scaleAllocationsTable)
    .where(eq(scaleAllocationsTable.id, allocationId))
    .limit(1);
  if (!existing) throw new Error("Entrada de escala não encontrada");
  if (existing.status !== "MANUAL_OVERRIDE")
    throw new Error(`Apenas entradas manuais podem ser removidas via ASA. Esta entrada tem status "${existing.status}".`);
  await db.delete(scaleAllocationsTable).where(eq(scaleAllocationsTable.id, allocationId));
  return { id: allocationId, label: existing.manualLabel ?? allocationId };
}

async function coreRemoverReconhecimento(
  ctx: ToolCtx,
  recognitionId: string,
): Promise<{ id: string; title: string }> {
  if (!ctx.organizationId) throw new Error("Organização não configurada");
  const [existing] = await db
    .select({ id: recognitionsTable.id, title: recognitionsTable.title })
    .from(recognitionsTable)
    .where(and(eq(recognitionsTable.id, recognitionId), eq(recognitionsTable.organizationId, ctx.organizationId)))
    .limit(1);
  if (!existing) throw new Error("Reconhecimento não encontrado");
  await db.delete(recognitionsTable).where(eq(recognitionsTable.id, recognitionId));
  return { id: recognitionId, title: existing.title };
}

// ── Runner resiliente de lote ───────────────────────────────────────────────────

type BatchItemResult = { ref: string; ok: boolean; id?: string; warning?: string | null; error?: string };

/**
 * Processa uma lista item a item, continuando mesmo quando um item falha.
 * Devolve resultados estruturados por item.
 */
async function runBatch<T>(
  items: T[],
  refOf: (item: T, index: number) => string,
  handler: (item: T) => Promise<{ id?: string; warning?: string | null }>,
): Promise<BatchItemResult[]> {
  const results: BatchItemResult[] = [];
  for (let i = 0; i < items.length; i++) {
    const ref = refOf(items[i]!, i);
    try {
      const out = await handler(items[i]!);
      results.push({ ref, ok: true, id: out.id, warning: out.warning ?? null });
    } catch (err) {
      results.push({ ref, ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return results;
}

/** Monta um resumo padrão de um resultado de lote. */
function summarizeBatch(noun: string, results: BatchItemResult[]): { total: number; sucessos: number; falhas: number; itens: BatchItemResult[]; message: string } {
  const ok = results.filter((r) => r.ok);
  const fail = results.filter((r) => !r.ok);
  const okLine = ok.length > 0 ? `✓ ${ok.length} ${noun}: ${ok.map((r) => r.ref).join(", ")}` : "";
  const failLine = fail.length > 0 ? `⚠ ${fail.length} falha(s): ${fail.map((r) => `${r.ref} (${r.error})`).join("; ")}` : "";
  const message = [okLine, failLine].filter(Boolean).join("\n") || "Nenhum item processado.";
  return { total: results.length, sucessos: ok.length, falhas: fail.length, itens: results, message };
}

// ────────────────────────────────────────────────────────────────────────────
// Tool Executor
// ────────────────────────────────────────────────────────────────────────────

export async function executeTool(
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
        .where(ctx.operationId ? eq(agendaEventsTable.operationId, ctx.operationId) : sql`true`)
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
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const today = new Date().toISOString().slice(0, 10);
      const dateFrom = (input.dateFrom as string) ?? today;
      const dateTo   = (input.dateTo   as string) ?? new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
      const limit    = (input.limit    as number) ?? 20;

      // Managers can query another user's allocations; otherwise always current user
      const targetUserId = (isManager && input.userId) ? (input.userId as string) : ctx.userId;

      // Find scales covering the requested period
      const scales = await db
        .select({ id: scalesTable.id, title: scalesTable.title, periodStart: scalesTable.periodStart, periodEnd: scalesTable.periodEnd, status: scalesTable.status })
        .from(scalesTable)
        .where(and(
          ctx.operationId ? eq(scalesTable.operationId, ctx.operationId) : sql`true`,
          inArray(scalesTable.status, ["DRAFT", "PUBLISHED", "REPUBLISHED"]),
          lte(scalesTable.periodStart, dateTo),
          gte(scalesTable.periodEnd,   dateFrom),
        ))
        .orderBy(desc(scalesTable.periodStart))
        .limit(10);

      if (scales.length === 0) {
        return JSON.stringify({ found: false, message: `Nenhuma escala ativa encontrada para ${dateFrom} → ${dateTo}.`, entradas: [] });
      }

      const scaleIds = scales.map(s => s.id);

      // Get user allocations in those scales
      const allocations = await db
        .select({
          id:           scaleAllocationsTable.id,
          scaleId:      scaleAllocationsTable.scaleId,
          status:       scaleAllocationsTable.status,
          manualDate:   scaleAllocationsTable.manualDate,
          manualLabel:  scaleAllocationsTable.manualLabel,
          startTime:    scaleAllocationsTable.startTime,
          endTime:      scaleAllocationsTable.endTime,
          notes:        scaleAllocationsTable.notes,
          agendaEventId:scaleAllocationsTable.agendaEventId,
        })
        .from(scaleAllocationsTable)
        .where(and(
          eq(scaleAllocationsTable.userId, targetUserId),
          inArray(scaleAllocationsTable.scaleId, scaleIds),
          inArray(scaleAllocationsTable.status, ["ASSIGNED", "MANUAL_OVERRIDE"]),
        ))
        .orderBy(scaleAllocationsTable.manualDate)
        .limit(limit);

      if (allocations.length === 0) {
        const userName = targetUserId === ctx.userId ? "Você não está" : "Este membro não está";
        return JSON.stringify({ found: false, message: `${userName} alocado(a) em nenhuma escala entre ${dateFrom} e ${dateTo}.`, entradas: [] });
      }

      const scaleMap = new Map(scales.map(s => [s.id, s]));
      const entries = allocations.map(a => {
        const scale = scaleMap.get(a.scaleId);
        return {
          id:        a.id,
          escala:    scale?.title ?? a.scaleId,
          periodo:   scale ? `${scale.periodStart} → ${scale.periodEnd}` : null,
          data:      a.manualDate,
          atividade: a.manualLabel,
          inicio:    a.startTime,
          fim:       a.endTime,
          status:    a.status,
          obs:       a.notes,
        };
      });

      return JSON.stringify({ found: true, total: entries.length, entradas: entries });
    }

    if (name === "consultar_responsabilidades") {
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const rows = await db
        .select()
        .from(responsibilitiesTable)
        .where(eq(responsibilitiesTable.orgId, ctx.organizationId))
        .limit(20);
      const filtered = input.unassigned
        ? rows.filter(r => r.active)
        : rows;
      return JSON.stringify(filtered.map(r => ({
        id: r.id,
        name: r.title,
        category: r.category,
        status: r.active ? "ACTIVE" : "INACTIVE",
      })));
    }

    if (name === "consultar_notificacoes") {
      const limit = (input.limit as number) ?? 10;
      const notifs = await db
        .select()
        .from(userNotificationsTable)
        .where(eq(userNotificationsTable.userId, ctx.userId))
        .orderBy(desc(userNotificationsTable.createdAt))
        .limit(limit);
      const filtered = input.unreadOnly ? notifs.filter(n => !n.readAt) : notifs;
      return JSON.stringify(filtered.map(n => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.message,
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
        .where(ctx.operationId ? eq(noticesTable.operationId, ctx.operationId) : sql`true`)
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

      // Managers can query any user's tasks; members see only their own
      const targetUserId = (isManager && input.userId) ? (input.userId as string) : ctx.userId;

      const conditions: ReturnType<typeof eq>[] = [
        eq(tasksTable.organizationId, ctx.organizationId),
        eq(tasksTable.assigneeId, targetUserId),
      ];
      if (input.status) conditions.push(eq(tasksTable.status, input.status as any));

      const tasks = await db
        .select({
          id:          tasksTable.id,
          title:       tasksTable.title,
          description: tasksTable.description,
          status:      tasksTable.status,
          priority:    tasksTable.priority,
          dueDate:     tasksTable.dueDate,
          origin:      tasksTable.origin,
        })
        .from(tasksTable)
        .where(and(...conditions))
        .orderBy(tasksTable.dueDate, desc(tasksTable.createdAt))
        .limit(limit);

      if (tasks.length === 0) {
        const isSelf = targetUserId === ctx.userId;
        return JSON.stringify({ found: false, message: isSelf ? "Você não tem tarefas atribuídas no momento." : "Este membro não tem tarefas atribuídas.", tarefas: [] });
      }

      return JSON.stringify({ found: true, total: tasks.length, tarefas: tasks });
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
      if (!ctx.operationId) return JSON.stringify({ error: "Selecione uma operação antes de criar avisos" });
      const [notice] = await db.insert(noticesTable).values({
        title: input.title as string,
        content: input.content as string,
        type: (input.type as "INFORMATIVE" | "IMPORTANT" | "PERSISTENT" | "ESCALATED") ?? "INFORMATIVE",
        urgency: (input.urgency as "INFORMATIVE" | "IMPORTANT" | "CRITICAL") ?? "IMPORTANT",
        operationId: ctx.operationId,
        authorId: ctx.userId,
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
      if (!ctx.operationId) return JSON.stringify({ error: "Selecione uma operação antes de criar ensaios" });
      const rawDate = (input.date as string | undefined) ?? new Date().toISOString().slice(0, 10);
      const [event] = await db.insert(agendaEventsTable).values({
        title: input.title as string,
        type: "REHEARSAL",
        date: rawDate,
        startTime: (input.startTime as string | undefined) ?? null,
        endTime: (input.endTime as string | undefined) ?? null,
        location: (input.location as string | undefined) ?? null,
        notes: (input.description as string | undefined) ?? null,
        operationId: ctx.operationId,
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
      const rawQuery = ((input.query as string) ?? "").trim();
      if (!rawQuery) return JSON.stringify({ error: "query é obrigatória" });
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });

      const { users, memories } = await loadOrgMembersAndMemories(ctx);

      // Aceita listas: "João, Pedro e Ana" → resolve cada nome separadamente
      const queries = splitMemberQueries(rawQuery);
      const resolutions = queries.map((q) => resolveOneMember(q, users, memories));

      // ── Caso simples: um único nome → mantém o formato legado (retrocompatível) ──
      if (resolutions.length <= 1) {
        const r = resolutions[0] ?? resolveOneMember(rawQuery, users, memories);
        if (!r.found) {
          return JSON.stringify({
            found: false,
            message: `Nenhum membro encontrado para "${r.query}". Verifique o nome ou tente parte do nome.`,
            members: [],
            resultados: [r],
          });
        }
        return JSON.stringify({
          found: true,
          ambiguous: r.ambiguous,
          message: r.ambiguous
            ? `Encontrei ${r.members.length} membros com nomes similares. Qual você quer dizer?`
            : `Encontrado: ${r.member!.name}`,
          member: r.member,
          members: r.members,
          resultados: [r],
        });
      }

      // ── Vários nomes: resolve todos, segue em frente mesmo quando um falha ──
      const encontrados = resolutions.filter((r) => r.found && !r.ambiguous);
      const ambiguos    = resolutions.filter((r) => r.found && r.ambiguous);
      const naoEncontrados = resolutions.filter((r) => !r.found);

      const parts: string[] = [];
      if (encontrados.length > 0)
        parts.push(`✓ Encontrados (${encontrados.length}): ${encontrados.map((r) => r.member!.name).join(", ")}`);
      if (ambiguos.length > 0)
        parts.push(`❓ Ambíguos (${ambiguos.length}): ${ambiguos.map((r) => `"${r.query}"`).join(", ")} — preciso que você escolha.`);
      if (naoEncontrados.length > 0)
        parts.push(`⚠ Não encontrados (${naoEncontrados.length}): ${naoEncontrados.map((r) => `"${r.query}"`).join(", ")}`);

      return JSON.stringify({
        multi: true,
        total: resolutions.length,
        encontrados: encontrados.length,
        ambiguos: ambiguos.length,
        naoEncontrados: naoEncontrados.length,
        message: parts.join("\n"),
        resultados: resolutions,
        // Lista pronta de membros resolvidos sem ambiguidade (para ações em lote)
        membrosResolvidos: encontrados.map((r) => r.member),
      });
    }

    // ── criar_grupo / editar_grupo / remover_grupo / membros ────────────────────
    if (
      name === "criar_grupo" ||
      name === "editar_grupo" ||
      name === "remover_grupo" ||
      name === "adicionar_membro_grupo" ||
      name === "remover_membro_grupo"
    ) {
      if (!isManager) return JSON.stringify({ error: "Sem permissão para gerenciar grupos" });
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const actor = { role: ctx.userRole, userId: ctx.userId, organizationId: ctx.organizationId };
      try {
        if (name === "criar_grupo") {
          const scope = ((input.scope as string) ?? "OPERATION").toUpperCase();
          const group = await createGroupCore(actor, {
            name: input.name as string,
            scope,
            // Supervisor cria sempre na operação atual; ADMIN usa operationIds para MULTI.
            operationId: scope === "OPERATION" ? ctx.operationId : undefined,
            operationIds: Array.isArray(input.operationIds) ? (input.operationIds as string[]) : [],
          });
          return JSON.stringify({ success: true, message: `Grupo "${group.name}" criado.`, group: { id: group.id, name: group.name, scope: group.scope, status: group.status } });
        }
        if (name === "editar_grupo") {
          const groupId = input.groupId as string;
          if (!groupId) return JSON.stringify({ error: "groupId é obrigatório" });
          let group;
          if (input.name) group = await renameGroupCore(actor, groupId, input.name as string);
          if (input.status) group = await setGroupStatusCore(actor, groupId, (input.status as string).toUpperCase());
          if (!group) return JSON.stringify({ error: "Informe ao menos name ou status para editar" });
          return JSON.stringify({ success: true, message: `Grupo "${group.name}" atualizado.`, group: { id: group.id, name: group.name, scope: group.scope, status: group.status } });
        }
        if (name === "remover_grupo") {
          const groupId = input.groupId as string;
          if (!groupId) return JSON.stringify({ error: "groupId é obrigatório" });
          const group = await setGroupStatusCore(actor, groupId, "ARCHIVED");
          return JSON.stringify({ success: true, message: `Grupo "${group.name}" arquivado (removido).`, group: { id: group.id, name: group.name, status: group.status } });
        }
        if (name === "adicionar_membro_grupo") {
          const groupId = input.groupId as string;
          const userId = input.userId as string;
          if (!groupId || !userId) return JSON.stringify({ error: "groupId e userId são obrigatórios" });
          const { group } = await addGroupMemberCore(actor, groupId, userId);
          return JSON.stringify({ success: true, message: `Membro adicionado ao grupo "${group.name}".` });
        }
        // remover_membro_grupo
        const groupId = input.groupId as string;
        const userId = input.userId as string;
        if (!groupId || !userId) return JSON.stringify({ error: "groupId e userId são obrigatórios" });
        const group = await removeGroupMemberCore(actor, groupId, userId);
        return JSON.stringify({ success: true, message: `Membro removido do grupo "${group.name}".` });
      } catch (err) {
        if (err instanceof GroupActionError) return JSON.stringify({ error: err.message });
        return JSON.stringify({ error: err instanceof Error ? err.message : "Erro ao gerenciar grupo" });
      }
    }

    // ── consultar_grupo ───────────────────────────────────────────────────────
    if (name === "consultar_grupo") {
      const rawQuery = ((input.query as string) ?? "").trim();
      if (!rawQuery) return JSON.stringify({ error: "query é obrigatória" });
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });

      const r = await coreResolverGrupo(ctx, rawQuery);
      return JSON.stringify({
        found: r.found,
        ambiguous: r.ambiguous,
        message: r.message,
        group: r.group,
        groups: r.groups,
        members: r.members,
        // Lista pronta de membros (para montar escala em lote, um criar_entrada_escala por membro)
        membrosResolvidos: r.members,
      });
    }

    // ── criar_entrada_escala ──────────────────────────────────────────────────
    if (name === "criar_entrada_escala") {
      if (!isManager) return JSON.stringify({ error: "Sem permissão para criar entradas na escala" });
      if (!ctx.operationId)  return JSON.stringify({ error: "Operação não configurada" });

      const userName  = input.userName  as string | undefined;
      const date      = input.date      as string;
      const label     = input.label     as string;
      const startTime = input.startTime as string | undefined;
      const endTime   = input.endTime   as string | undefined;
      const notes     = input.notes     as string | undefined;

      try {
        const res = await coreCriarEntradaEscala(ctx, {
          userId: input.userId as string,
          userName, date, label, startTime, endTime, notes,
        });
        return JSON.stringify({
          created:   true,
          entryId:   res.id,
          scaleId:   res.scaleId,
          scaleName: res.scaleName,
          warning:   res.warning,
          message:
            `✅ Entrada criada na escala "${res.scaleName}":\n` +
            `• Membro: ${userName ?? input.userId}\n` +
            `• Atividade: ${label}\n` +
            `• Data: ${date}\n` +
            (startTime ? `• Início: ${startTime}\n` : "") +
            (endTime   ? `• Fim: ${endTime}\n`   : "") +
            (notes     ? `• Obs: ${notes}\n`      : "") +
            (res.warning ? `\n${res.warning}`      : ""),
        });
      } catch (err) {
        return JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
      }
    }

    // ── criar_tarefa ──────────────────────────────────────────────────────────
    if (name === "criar_tarefa") {
      if (!isManager) return JSON.stringify({ error: "Sem permissão para criar tarefas" });

      const title        = input.title        as string;
      const assigneeName = input.assigneeName as string | undefined;
      const dueDate      = input.dueDate      as string;
      const priority     = (input.priority    as string) ?? "MEDIUM";

      try {
        const res = await coreCriarTarefa(ctx, {
          title,
          description: input.description as string | undefined,
          assigneeId:  input.assigneeId  as string,
          dueDate,
          priority,
        });
        return JSON.stringify({
          created: true,
          id: res.id,
          message:
            `✅ Tarefa criada:\n` +
            `• Título: ${title}\n` +
            `• Responsável: ${assigneeName ?? input.assigneeId}\n` +
            `• Prazo: ${dueDate}\n` +
            `• Prioridade: ${priority}\n` +
            `• Status: Em criação — requer aprovação`,
        });
      } catch (err) {
        return JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
      }
    }

    // ── consultar_reconhecimentos ─────────────────────────────────────────────
    if (name === "consultar_reconhecimentos") {
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const limit = (input.limit as number | undefined) ?? 10;
      const conditions: ReturnType<typeof eq>[] = [eq(recognitionsTable.organizationId, ctx.organizationId)];
      if (input.userId) conditions.push(eq(recognitionsTable.userId, input.userId as string));
      const recs = await db
        .select()
        .from(recognitionsTable)
        .where(and(...conditions))
        .orderBy(desc(recognitionsTable.createdAt))
        .limit(limit);
      if (recs.length === 0) return JSON.stringify({ total: 0, message: "Nenhum reconhecimento registrado ainda.", reconhecimentos: [] });
      return JSON.stringify({ total: recs.length, reconhecimentos: recs });
    }

    // ── criar_reconhecimento ──────────────────────────────────────────────────
    if (name === "criar_reconhecimento") {
      if (!isManager) return JSON.stringify({ error: "Sem permissão para criar reconhecimentos" });
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const recTitle  = input.title   as string;
      try {
        const res = await coreCriarReconhecimento(ctx, {
          userId:  input.userId  as string,
          type:    input.type    as string,
          title:   recTitle,
          message: input.message as string,
        });
        return JSON.stringify({
          created: true,
          id: res.id,
          message: `🎉 Reconhecimento "${recTitle}" criado com sucesso!`,
        });
      } catch (err) {
        return JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
      }
    }

    // ── enviar_push ───────────────────────────────────────────────────────────
    if (name === "enviar_push") {
      if (!isManager) return JSON.stringify({ error: "Sem permissão para enviar notificações" });
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const rawUserIds = input.userIds;
      const userIds = Array.isArray(rawUserIds)
        ? (rawUserIds as unknown[]).map((u) => String(u)).filter(Boolean)
        : typeof rawUserIds === "string"
        ? [rawUserIds]
        : [];
      const pushTitle   = input.title   as string;
      const pushMessage = input.message as string;
      const pushPriority = (["LOW", "NORMAL", "IMPORTANT", "CRITICAL"].includes(String(input.priority))
        ? input.priority
        : "NORMAL") as "LOW" | "NORMAL" | "IMPORTANT" | "CRITICAL";

      if (userIds.length === 0) return JSON.stringify({ error: "Informe ao menos um membro (userIds)" });
      if (!pushTitle || !pushMessage) return JSON.stringify({ error: "title e message são obrigatórios" });

      // Validate the targets belong to the same organization (avoid IDOR).
      const targets = await db
        .select({ id: usersTable.id, name: usersTable.name })
        .from(usersTable)
        .where(and(eq(usersTable.organizationId, ctx.organizationId), inArray(usersTable.id, userIds)));
      if (targets.length === 0) return JSON.stringify({ error: "Nenhum membro válido encontrado nesta organização" });

      let sent = 0;
      let inAppOnly = 0;
      for (const t of targets) {
        try {
          const { push } = await sendNotification({
            userId:   t.id,
            type:     "ASA_PUSH",
            title:    pushTitle,
            message:  pushMessage,
            priority: pushPriority,
            category: "system",
          });
          if (push.sent > 0) sent += 1; else inAppOnly += 1;
        } catch {
          inAppOnly += 1;
        }
      }

      return JSON.stringify({
        sent: true,
        total: targets.length,
        delivered: sent,
        inAppOnly,
        message: `📲 Notificação enviada para ${targets.length} membro(s). ${sent} receberam push no celular${inAppOnly > 0 ? `, ${inAppOnly} ficaram só no histórico in-app (sem dispositivo registrado)` : ""}.`,
      });
    }

    // ── detectar_marcos ───────────────────────────────────────────────────────
    if (name === "detectar_marcos") {
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const todayDate = new Date();
      const orgUsers = await db
        .select({ id: usersTable.id, name: usersTable.name, createdAt: usersTable.createdAt })
        .from(usersTable)
        .where(eq(usersTable.organizationId, ctx.organizationId))
        .limit(100);
      const marcos: { userId: string; name: string; type: string; label: string }[] = [];
      for (const u of orgUsers) {
        const created = new Date(u.createdAt);
        if (created.getDate() !== todayDate.getDate() || created.getMonth() !== todayDate.getMonth()) continue;
        const years = todayDate.getFullYear() - created.getFullYear();
        const totalMonths = years * 12 + (todayDate.getMonth() - created.getMonth());
        if (years >= 1 && years <= 10) {
          marcos.push({ userId: u.id, name: u.name, type: "TIME_OF_HOUSE", label: `${years} ano${years > 1 ? "s" : ""} na ASA` });
        } else if (totalMonths === 3 || totalMonths === 6) {
          marcos.push({ userId: u.id, name: u.name, type: "TIME_OF_HOUSE", label: `${totalMonths} meses na ASA` });
        }
      }
      if (marcos.length === 0) return JSON.stringify({ total: 0, message: "Nenhum marco especial hoje.", marcos: [] });
      return JSON.stringify({
        total: marcos.length,
        message: `${marcos.length} marco(s) detectado(s) hoje! Considere criar um reconhecimento para cada um.`,
        marcos,
      });
    }

    // ── gerar_resumo_do_dia ───────────────────────────────────────────────────
    if (name === "gerar_resumo_do_dia") {
      const resumo = await assembleResumoDodia(ctx.userId, ctx.organizationId ?? null, ctx.operationId ?? null, ctx.userRole);
      return JSON.stringify(resumo);
    }

    // ── consultar_aniversarios ────────────────────────────────────────────────
    if (name === "consultar_aniversarios") {
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const date    = (input.date as string | undefined) ?? new Date().toISOString().slice(0, 10);
      const mm      = date.slice(5, 7); const dd = date.slice(8, 10);
      const todayMD = `${dd}/${mm}`;
      const normStr = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

      // 1. Query usersTable.birthDate (canonical source)
      const birthdays: { nome: string; source: string }[] = [];
      const userBdays = await db
        .select({ name: usersTable.name, birthDate: usersTable.birthDate })
        .from(usersTable)
        .where(and(
          eq(usersTable.organizationId, ctx.organizationId),
          eq(usersTable.status, "ACTIVE"),
          sql`to_char(${usersTable.birthDate}::date, 'MM-DD') = ${`${mm}-${dd}`}`,
        ))
        .limit(20);
      for (const u of userBdays) birthdays.push({ nome: u.name, source: "db" });

      // 2. Memories fallback (for orgs without birthDate set)
      const memories = await db
        .select({ key: asaMemoriesTable.key, value: asaMemoriesTable.value })
        .from(asaMemoriesTable)
        .where(and(
          eq(asaMemoriesTable.organizationId, ctx.organizationId),
          eq(asaMemoriesTable.status, "APPROVED"),
          eq(asaMemoriesTable.type, "PERSONAL"),
        ))
        .limit(200);
      for (const m of memories) {
        const kn = normStr(m.key);
        if (kn.includes("aniversario") || kn.includes("nascimento") || kn.includes("birthday")) {
          if (m.value.trim().startsWith(todayMD)) {
            const match = m.key.match(/(?:de\s+|:\s*)(.+?)(?:\s*$)/i);
            const nome  = match?.[1]?.trim() ?? m.key;
            if (!birthdays.some(b => normStr(b.nome) === normStr(nome))) birthdays.push({ nome, source: "memory" });
          }
        }
      }

      const names = birthdays.map(b => b.nome);
      const msg   = names.length > 0
        ? `🎉 ${names.join(", ")} faz${names.length > 1 ? "em" : ""} aniversário hoje (${todayMD})! Que tal criar um reconhecimento?`
        : `Nenhum aniversário registrado para ${todayMD}.`;

      return JSON.stringify({ date, dayMonth: todayMD, birthdays: names, count: names.length, message: msg });
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
          temp: Math.round(temp), weatherCode: code, description, emoji,
          wind: Math.round(wind), precipitation: Math.round(precipitation * 10) / 10,
          rainChancePercent: Math.round(rainChance), advice,
          message: `${emoji} ${Math.round(temp)}°C — ${description}. Vento ${Math.round(wind)} km/h.${rainChance > 30 ? ` Chance de chuva: ${Math.round(rainChance)}%.` : ""} ${advice}`.trim(),
        });
      } catch {
        return JSON.stringify({ error: "Não foi possível consultar o clima agora." });
      }
    }

    // ── Cancelamentos / Remoções ──────────────────────────────────────────────
    if (name === "cancelar_ausencia") {
      if (!isManager) return JSON.stringify({ error: "Apenas gestores podem cancelar ausências" });
      try {
        const r = await coreCancelarAusencia(ctx, input.folgaId as string);
        return JSON.stringify({ success: true, message: `✅ Ausência de ${r.startDate} cancelada com sucesso. O membro volta a estar disponível nessa data.`, id: r.id });
      } catch (err) {
        return JSON.stringify({ success: false, message: err instanceof Error ? err.message : String(err) });
      }
    }

    if (name === "cancelar_tarefa") {
      if (!isManager) return JSON.stringify({ error: "Apenas gestores podem cancelar tarefas" });
      try {
        const r = await coreCancelarTarefa(ctx, input.taskId as string, (input.acao as string | undefined) ?? "CANCELAR");
        const label = r.novoStatus === "COMPLETED" ? "concluída" : "cancelada";
        return JSON.stringify({ success: true, message: `✅ Tarefa "${r.title}" ${label} com sucesso.`, id: r.id, novoStatus: r.novoStatus });
      } catch (err) {
        return JSON.stringify({ success: false, message: err instanceof Error ? err.message : String(err) });
      }
    }

    if (name === "remover_entrada_escala") {
      if (!isManager) return JSON.stringify({ error: "Apenas gestores podem remover entradas da escala" });
      try {
        const r = await coreRemoverEntradaEscala(ctx, input.allocationId as string);
        return JSON.stringify({ success: true, message: `✅ Entrada manual "${r.label}" removida da escala com sucesso.`, id: r.id });
      } catch (err) {
        return JSON.stringify({ success: false, message: err instanceof Error ? err.message : String(err) });
      }
    }

    // ── Publicação ───────────────────────────────────────────────────────────
    if (name === "publicar_aviso") {
      if (!isManager) return JSON.stringify({ error: "Apenas gestores podem publicar avisos" });
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const noticeId = input.noticeId as string;
      const [existing] = await db
        .select({ id: noticesTable.id, status: noticesTable.status, title: noticesTable.title })
        .from(noticesTable)
        .where(eq(noticesTable.id, noticeId))
        .limit(1);
      if (!existing) return JSON.stringify({ success: false, message: "Aviso não encontrado. Verifique o ID." });
      if (existing.status === "PUBLISHED") return JSON.stringify({ success: false, message: "Este aviso já está publicado." });
      if (existing.status !== "DRAFT") return JSON.stringify({ success: false, message: `Não é possível publicar um aviso com status "${existing.status}".` });
      await db.update(noticesTable).set({ status: "PUBLISHED", publishedAt: new Date() }).where(eq(noticesTable.id, noticeId));
      return JSON.stringify({ success: true, message: `✅ Aviso "${existing.title ?? "(sem título)"}" publicado com sucesso. Os destinatários já podem visualizá-lo.`, id: noticeId });
    }

    if (name === "publicar_escala") {
      if (!isManager) return JSON.stringify({ error: "Apenas gestores podem publicar escalas" });
      if (!ctx.operationId) return JSON.stringify({ error: "Selecione uma operação antes de publicar escalas" });
      const scaleId = input.scaleId as string;
      const [existing] = await db
        .select({ id: scalesTable.id, status: scalesTable.status, title: scalesTable.title, periodStart: scalesTable.periodStart, periodEnd: scalesTable.periodEnd })
        .from(scalesTable)
        .where(and(eq(scalesTable.id, scaleId), eq(scalesTable.operationId, ctx.operationId)))
        .limit(1);
      if (!existing) return JSON.stringify({ success: false, message: "Escala não encontrada. Use consultar_escalas para verificar o ID." });
      if (existing.status === "PUBLISHED" || existing.status === "REPUBLISHED") return JSON.stringify({ success: false, message: "Esta escala já está publicada." });
      if (existing.status === "ARCHIVED") return JSON.stringify({ success: false, message: "Não é possível publicar uma escala arquivada." });
      await db.update(scalesTable).set({ status: "PUBLISHED", publishedAt: new Date() }).where(eq(scalesTable.id, scaleId));
      return JSON.stringify({ success: true, message: `✅ Escala "${existing.title}" publicada (${existing.periodStart} → ${existing.periodEnd}). Os membros já podem ver suas alocações.`, id: scaleId });
    }

    // ── Blocos Operacionais ───────────────────────────────────────────────────
    if (name === "criar_bloco_agenda") {
      if (!isManager) return JSON.stringify({ error: "Apenas gestores podem criar blocos na agenda" });
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      if (!ctx.operationId) return JSON.stringify({ error: "Selecione uma operação antes de criar blocos" });
      const titulo     = input.titulo     as string;
      const data       = input.data       as string;
      const horaInicio = input.horaInicio as string | undefined;
      const horaFim    = input.horaFim    as string | undefined;
      const descricao  = input.descricao  as string | undefined;
      const local      = input.local      as string | undefined;
      const [event] = await db.insert(agendaEventsTable).values({
        operationId:    ctx.operationId,
        type:           "OPERATIONAL_BLOCK",
        title:          titulo,
        date:           data,
        startTime:      horaInicio ?? null,
        endTime:        horaFim    ?? null,
        location:       local      ?? null,
        notes:          descricao  ?? null,
        status:         "DRAFT",
        visibility:     "OPERATION",
        createdBy:      ctx.userId,
      }).returning({ id: agendaEventsTable.id });
      const horaStr = horaInicio ? ` às ${horaInicio}${horaFim ? `–${horaFim}` : ""}` : "";
      return JSON.stringify({ success: true, message: `✅ Bloco "${titulo}" criado na agenda para ${data}${horaStr}. Confirme no web admin (Agenda) para torná-lo visível aos membros.`, id: event.id });
    }

    // ── Biblioteca — Rastreamento de Leitura ─────────────────────────────────
    if (name === "consultar_leituras_biblioteca") {
      if (!isManager) return JSON.stringify({ error: "Apenas gestores podem consultar leituras" });
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const documentId      = input.documentId      as string | undefined;
      const tituloFiltro    = input.titulo           as string | undefined;
      const mostrarNaoLeram = input.mostrarNaoLeram  as boolean | undefined;
      let docId = documentId;

      if (!docId && tituloFiltro) {
        const [found] = await db.select({ id: libraryDocumentsTable.id, title: libraryDocumentsTable.title })
          .from(libraryDocumentsTable)
          .where(and(eq(libraryDocumentsTable.orgId, ctx.organizationId), ilike(libraryDocumentsTable.title, `%${tituloFiltro}%`)))
          .limit(1);
        if (!found) return JSON.stringify({ success: false, message: `Nenhum documento encontrado com o título "${tituloFiltro}".` });
        docId = found.id;
      }

      if (docId) {
        const [doc] = await db.select({ id: libraryDocumentsTable.id, title: libraryDocumentsTable.title })
          .from(libraryDocumentsTable)
          .where(and(eq(libraryDocumentsTable.id, docId), eq(libraryDocumentsTable.orgId, ctx.organizationId)))
          .limit(1);
        if (!doc) return JSON.stringify({ success: false, message: "Documento não encontrado." });

        const views = await db
          .select({ userId: libraryViewsTable.userId, userName: usersTable.name, viewedAt: libraryViewsTable.viewedAt })
          .from(libraryViewsTable)
          .leftJoin(usersTable, eq(libraryViewsTable.userId, usersTable.id))
          .where(eq(libraryViewsTable.documentId, docId))
          .orderBy(desc(libraryViewsTable.viewedAt))
          .limit(200);

        const uniqueReaders = [...new Map(views.map(v => [v.userId, v])).values()];

        if (mostrarNaoLeram) {
          const allMembers = await db
            .select({ id: usersTable.id, name: usersTable.name })
            .from(usersTable)
            .where(eq(usersTable.organizationId, ctx.organizationId))
            .limit(300);
          const readerIds = new Set(uniqueReaders.map(r => r.userId));
          const naoLeram  = allMembers.filter(m => !readerIds.has(m.id));
          return JSON.stringify({
            documentTitle: doc.title, totalLeituras: views.length, leitoresUnicos: uniqueReaders.length,
            naoLeram: naoLeram.map(m => m.name),
            message: naoLeram.length === 0
              ? `✅ Todos os membros leram "${doc.title}".`
              : `📋 ${naoLeram.length} membro(s) ainda não leu "${doc.title}": ${naoLeram.map(m => m.name).join(", ")}.`,
          });
        }
        return JSON.stringify({
          documentTitle: doc.title, totalLeituras: views.length, leitoresUnicos: uniqueReaders.length,
          ultimasLeituras: uniqueReaders.slice(0, 10).map(r => ({ nome: r.userName, em: r.viewedAt })),
          message: `📚 "${doc.title}" foi lido ${uniqueReaders.length} vez(es) por pessoa(s) única(s).`,
        });
      }

      const topDocs = await db
        .select({ documentId: libraryViewsTable.documentId, leitores: sql<number>`count(distinct ${libraryViewsTable.userId})::int` })
        .from(libraryViewsTable)
        .where(eq(libraryViewsTable.orgId, ctx.organizationId))
        .groupBy(libraryViewsTable.documentId)
        .orderBy(desc(sql<number>`count(distinct ${libraryViewsTable.userId})`))
        .limit(10);
      return JSON.stringify({ topDocumentos: topDocs, message: topDocs.length === 0 ? "Nenhuma leitura registrada ainda." : `📊 Top ${topDocs.length} documentos mais lidos da organização.` });
    }

    // ── Sprint 11 — Aprendizado Organizacional ───────────────────────────────
    const DOW_LABELS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

    const periodoDays = (p?: string) => {
      if (p === "90d") return 90; if (p === "6m") return 180; if (p === "12m") return 365; return 30;
    };

    // ── consultar_tendencias (Sprint 11) ──────────────────────────────────────
    if (name === "consultar_tendencias") {
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const dias  = periodoDays(input.periodo as string | undefined);
      const from  = new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10);
      const to    = new Date().toISOString().slice(0, 10);
      const tipo  = (input.tipo as string | undefined) ?? "TODOS";

      const results: Record<string, unknown> = { periodo: { dias, de: from, ate: to } };

      if (tipo === "AUSENCIAS" || tipo === "TODOS") {
        // Absences by day of week
        const absDow = await db
          .select({ dow: sql<number>`EXTRACT(DOW FROM ${folgasTable.startDate})::int`, count: sql<number>`count(*)::int` })
          .from(folgasTable)
          .where(and(ctx.operationId ? eq(folgasTable.operationId, ctx.operationId) : sql`true`, eq(folgasTable.status, "ACTIVE"), gte(folgasTable.startDate, from), lte(folgasTable.startDate, to)))
          .groupBy(sql`EXTRACT(DOW FROM ${folgasTable.startDate})`)
          .orderBy(desc(sql`count(*)`));

        // Monthly trend
        const absMes = await db
          .select({ mes: sql<string>`TO_CHAR(${folgasTable.startDate}, 'YYYY-MM')`, count: sql<number>`count(*)::int` })
          .from(folgasTable)
          .where(and(ctx.operationId ? eq(folgasTable.operationId, ctx.operationId) : sql`true`, eq(folgasTable.status, "ACTIVE"), gte(folgasTable.startDate, from)))
          .groupBy(sql`TO_CHAR(${folgasTable.startDate}, 'YYYY-MM')`)
          .orderBy(sql`TO_CHAR(${folgasTable.startDate}, 'YYYY-MM')`);

        const piorDia = absDow[0];
        results.ausencias = {
          por_dia_semana: absDow.map(r => ({ dia: DOW_LABELS[r.dow] ?? r.dow, ausencias: r.count })),
          por_mes:        absMes,
          insight: piorDia ? `⚠️ ${DOW_LABELS[piorDia.dow] ?? "Dia " + piorDia.dow} concentra mais ausências (${piorDia.count} no período).` : "Sem dados suficientes.",
        };
      }

      if (tipo === "TAREFAS" || tipo === "TODOS") {
        // Task delays by day of week (day due_date fell)
        const taskDow = await db
          .select({ dow: sql<number>`EXTRACT(DOW FROM ${tasksTable.dueDate})::int`, count: sql<number>`count(*)::int` })
          .from(tasksTable)
          .where(and(eq(tasksTable.organizationId, ctx.organizationId), inArray(tasksTable.status, ["CREATED", "IN_PROGRESS"]), lte(tasksTable.dueDate, to), gte(tasksTable.dueDate, from)))
          .groupBy(sql`EXTRACT(DOW FROM ${tasksTable.dueDate})`)
          .orderBy(desc(sql`count(*)`));

        // Task completion trend by month
        const taskMes = await db
          .select({ mes: sql<string>`TO_CHAR(${tasksTable.createdAt}, 'YYYY-MM')`, total: sql<number>`count(*)::int`, concluidas: sql<number>`sum(CASE WHEN status='DONE' THEN 1 ELSE 0 END)::int` })
          .from(tasksTable)
          .where(and(eq(tasksTable.organizationId, ctx.organizationId), sql`date(${tasksTable.createdAt}) between ${from} and ${to}`))
          .groupBy(sql`TO_CHAR(${tasksTable.createdAt}, 'YYYY-MM')`)
          .orderBy(sql`TO_CHAR(${tasksTable.createdAt}, 'YYYY-MM')`);

        const piorDia = taskDow[0];
        results.tarefas = {
          atrasos_por_dia_semana: taskDow.map(r => ({ dia: DOW_LABELS[r.dow] ?? r.dow, atrasos: r.count })),
          tendencia_mensal:       taskMes.map(r => ({ mes: r.mes, total: r.total, concluidas: r.concluidas, taxa: r.total > 0 ? `${Math.round((r.concluidas / r.total) * 100)}%` : "—" })),
          insight: piorDia ? `📌 ${DOW_LABELS[piorDia.dow] ?? "Dia " + piorDia.dow} concentra mais prazos vencidos (${piorDia.count} no período).` : "Sem dados de atrasos.",
        };
      }

      if (tipo === "ATIVIDADES" || tipo === "TODOS") {
        const actMes = await db
          .select({ mes: sql<string>`TO_CHAR(${scaleAllocationsTable.manualDate}, 'YYYY-MM')`, count: sql<number>`count(*)::int` })
          .from(scaleAllocationsTable)
          .where(and(inArray(scaleAllocationsTable.status, ["ASSIGNED", "MANUAL_OVERRIDE"]), sql`${scaleAllocationsTable.manualDate} between ${from} and ${to}`))
          .groupBy(sql`TO_CHAR(${scaleAllocationsTable.manualDate}, 'YYYY-MM')`)
          .orderBy(sql`TO_CHAR(${scaleAllocationsTable.manualDate}, 'YYYY-MM')`);

        const actDow = await db
          .select({ dow: sql<number>`EXTRACT(DOW FROM ${scaleAllocationsTable.manualDate})::int`, count: sql<number>`count(*)::int` })
          .from(scaleAllocationsTable)
          .where(and(inArray(scaleAllocationsTable.status, ["ASSIGNED", "MANUAL_OVERRIDE"]), sql`${scaleAllocationsTable.manualDate} between ${from} and ${to}`))
          .groupBy(sql`EXTRACT(DOW FROM ${scaleAllocationsTable.manualDate})`)
          .orderBy(desc(sql`count(*)`));

        const pico = actDow[0];
        results.atividades = {
          por_mes:       actMes,
          por_dia_semana: actDow.map(r => ({ dia: DOW_LABELS[r.dow] ?? r.dow, atividades: r.count })),
          insight: pico ? `📈 ${DOW_LABELS[pico.dow] ?? "Dia " + pico.dow} é o dia mais ativo (${pico.count} alocações).` : "Sem dados.",
        };
      }

      results.instrucao = "Interprete as tendências e gere insights operacionais. Destaque padrões claros, dias críticos e evolução mensal. Se houver correlação entre ausências e atividades no mesmo dia → aponte o risco.";
      return JSON.stringify(results);
    }

    // ── consultar_padroes (Sprint 11) ──────────────────────────────────────────
    if (name === "consultar_padroes") {
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const from   = (input.dateFrom as string | undefined) ?? new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
      const to     = (input.dateTo   as string | undefined) ?? new Date().toISOString().slice(0, 10);
      const limite = (input.limite   as number | undefined) ?? 5;

      const [ausenciasMembro, sobrecarregados, atrasadosCronicos, trocasMembro] = await Promise.all([
        // Most absent members
        db.select({ userId: folgasTable.userId, nome: usersTable.name, total: sql<number>`count(*)::int`, noShow: sql<number>`sum(CASE WHEN type='NO_SHOW' THEN 1 ELSE 0 END)::int` })
          .from(folgasTable).leftJoin(usersTable, eq(folgasTable.userId, usersTable.id))
          .where(and(ctx.operationId ? eq(folgasTable.operationId, ctx.operationId) : sql`true`, eq(folgasTable.status, "ACTIVE"), gte(folgasTable.startDate, from), lte(folgasTable.startDate, to)))
          .groupBy(folgasTable.userId, usersTable.name).orderBy(desc(sql`count(*)`)).limit(limite),
        // Most active members (workload)
        db.select({ userId: scaleAllocationsTable.userId, nome: usersTable.name, count: sql<number>`count(*)::int` })
          .from(scaleAllocationsTable).leftJoin(usersTable, eq(scaleAllocationsTable.userId, usersTable.id))
          .where(and(inArray(scaleAllocationsTable.status, ["ASSIGNED", "MANUAL_OVERRIDE"]), sql`${scaleAllocationsTable.manualDate} between ${from} and ${to}`))
          .groupBy(scaleAllocationsTable.userId, usersTable.name).orderBy(desc(sql`count(*)`)).limit(limite),
        // Chronically delayed task assignees
        db.select({ assigneeId: tasksTable.assigneeId, nome: usersTable.name, atrasadas: sql<number>`count(*)::int` })
          .from(tasksTable).leftJoin(usersTable, eq(tasksTable.assigneeId, usersTable.id))
          .where(and(eq(tasksTable.organizationId, ctx.organizationId), inArray(tasksTable.status, ["CREATED", "IN_PROGRESS"]), lte(tasksTable.dueDate, to), gte(tasksTable.dueDate, from)))
          .groupBy(tasksTable.assigneeId, usersTable.name).orderBy(desc(sql`count(*)`)).limit(limite),
        // Members with most swap requests
        db.select({ userId: folgasTable.userId, nome: usersTable.name, trocas: sql<number>`count(*)::int` })
          .from(folgasTable).leftJoin(usersTable, eq(folgasTable.userId, usersTable.id))
          .where(and(ctx.operationId ? eq(folgasTable.operationId, ctx.operationId) : sql`true`, eq(folgasTable.type, "DAY_OFF"), gte(folgasTable.startDate, from), lte(folgasTable.startDate, to)))
          .groupBy(folgasTable.userId, usersTable.name).orderBy(desc(sql`count(*)`)).limit(limite),
      ]);

      // Avg to detect outliers
      const mediaAbs  = ausenciasMembro.length > 0 ? ausenciasMembro.reduce((s, r) => s + r.total, 0) / ausenciasMembro.length : 0;
      const mediaCarga = sobrecarregados.length > 0 ? sobrecarregados.reduce((s, r) => s + r.count, 0) / sobrecarregados.length : 0;

      return JSON.stringify({
        periodo: { de: from, ate: to },
        instrucao: "Identifique padrões críticos. Destaque anomalias (membros muito acima da média), correlações (quem falta mais também está sobrecarregado?) e sugira ações corretivas específicas.",
        ausencias_por_membro: {
          media_periodo: Math.round(mediaAbs * 10) / 10,
          membros: ausenciasMembro.map(r => ({ nome: r.nome ?? r.userId, total: r.total, no_show: r.noShow, acima_da_media: r.total > mediaAbs * 1.5 })),
        },
        carga_por_membro: {
          media_periodo: Math.round(mediaCarga * 10) / 10,
          membros: sobrecarregados.map(r => ({ nome: r.nome ?? r.userId, atividades: r.count, sobrecarga: r.count > mediaCarga * 1.5 })),
        },
        atrasos_cronicos: atrasadosCronicos.map(r => ({ nome: r.nome ?? r.assigneeId, tarefas_atrasadas: r.atrasadas })),
        trocas_frequentes: trocasMembro.map(r => ({ nome: r.nome ?? r.userId, trocas: r.trocas })),
      });
    }

    // ── consultar_aprendizados (Sprint 11) ────────────────────────────────────
    if (name === "consultar_aprendizados") {
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const scopeFilter = input.scope as string | undefined;

      const memorias = await db
        .select({ id: asaMemoriesTable.id, type: asaMemoriesTable.type, key: asaMemoriesTable.key, value: asaMemoriesTable.value, scope: asaMemoriesTable.scope, createdAt: asaMemoriesTable.createdAt })
        .from(asaMemoriesTable)
        .where(and(
          eq(asaMemoriesTable.organizationId, ctx.organizationId),
          eq(asaMemoriesTable.status, "APPROVED"),
          scopeFilter ? eq(asaMemoriesTable.scope, scopeFilter) : sql`true`,
        ))
        .orderBy(desc(asaMemoriesTable.createdAt))
        .limit(20);

      // Quick derived stats as "learned patterns"
      const today11 = new Date().toISOString().slice(0, 10);
      const from90  = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);

      const [[totalAbs], [totalTasks], [txDone], [totalAct]] = await Promise.all([
        db.select({ count: sql<number>`count(*)::int` }).from(folgasTable).where(and(ctx.operationId ? eq(folgasTable.operationId, ctx.operationId!) : sql`true`, eq(folgasTable.status, "ACTIVE"), gte(folgasTable.startDate, from90))!),
        db.select({ count: sql<number>`count(*)::int` }).from(tasksTable).where(and(eq(tasksTable.organizationId, ctx.organizationId!), sql`date(${tasksTable.createdAt}) >= ${from90}`)!),
        db.select({ count: sql<number>`count(*)::int` }).from(tasksTable).where(and(eq(tasksTable.organizationId, ctx.organizationId!), eq(tasksTable.status, "COMPLETED"), sql`date(${tasksTable.updatedAt}) >= ${from90}`)!),
        db.select({ count: sql<number>`count(*)::int` }).from(scaleAllocationsTable).where(and(inArray(scaleAllocationsTable.status, ["ASSIGNED", "MANUAL_OVERRIDE"]), sql`${scaleAllocationsTable.manualDate} between ${from90} and ${today11}`)!),
      ]);

      const txConclusao = (totalTasks?.count ?? 0) > 0 ? Math.round(((txDone?.count ?? 0) / (totalTasks?.count ?? 1)) * 100) : 0;

      return JSON.stringify({
        memorias_institucionais: {
          total: memorias.length,
          itens: memorias.map(m => ({ tipo: m.type, chave: m.key, valor: m.value, escopo: m.scope, registrado: m.createdAt })),
        },
        padroes_derivados_90d: {
          total_ausencias:      totalAbs?.count ?? 0,
          total_atividades:     totalAct?.count ?? 0,
          total_tarefas:        totalTasks?.count ?? 0,
          taxa_conclusao:       `${txConclusao}%`,
          insight_geral:        txConclusao >= 70 ? "✅ Taxa de conclusão saudável (≥70%)" : txConclusao >= 50 ? "⚠️ Taxa de conclusão moderada (50–70%)" : "🔴 Taxa de conclusão baixa (<50%) — risco operacional",
        },
        instrucao: "Apresente os aprendizados da ASA: primeiro as memórias institucionais registradas (o que foi formalmente capturado), depois os padrões derivados dos dados. Conclua com 1-3 recomendações baseadas nos padrões observados.",
      });
    }

    // ── consultar_riscos_recorrentes (Sprint 11) ───────────────────────────────
    if (name === "consultar_riscos_recorrentes") {
      if (!isManager) return JSON.stringify({ error: "Exclusivo para gestores" });
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const from    = (input.dateFrom as string | undefined) ?? new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
      const to      = (input.dateTo   as string | undefined) ?? new Date().toISOString().slice(0, 10);
      const today11 = new Date().toISOString().slice(0, 10);

      const [altaAusencia, sobrecarregados, atrasadosCronicos, posicoesAbertas] = await Promise.all([
        // Members with ≥3 absences in period → HIGH risk
        db.select({ userId: folgasTable.userId, nome: usersTable.name, total: sql<number>`count(*)::int`, noShow: sql<number>`sum(CASE WHEN type='NO_SHOW' THEN 1 ELSE 0 END)::int` })
          .from(folgasTable).leftJoin(usersTable, eq(folgasTable.userId, usersTable.id))
          .where(and(ctx.operationId ? eq(folgasTable.operationId, ctx.operationId) : sql`true`, eq(folgasTable.status, "ACTIVE"), gte(folgasTable.startDate, from), lte(folgasTable.startDate, to)))
          .groupBy(folgasTable.userId, usersTable.name)
          .having(sql`count(*) >= 3`)
          .orderBy(desc(sql`count(*)`)).limit(10),
        // Overloaded members (activity count > 2× average)
        db.select({ userId: scaleAllocationsTable.userId, nome: usersTable.name, count: sql<number>`count(*)::int` })
          .from(scaleAllocationsTable).leftJoin(usersTable, eq(scaleAllocationsTable.userId, usersTable.id))
          .where(and(inArray(scaleAllocationsTable.status, ["ASSIGNED", "MANUAL_OVERRIDE"]), sql`${scaleAllocationsTable.manualDate} between ${from} and ${to}`))
          .groupBy(scaleAllocationsTable.userId, usersTable.name).orderBy(desc(sql`count(*)`)).limit(10),
        // Chronically delayed tasks (due_date passed, still open)
        db.select({ assigneeId: tasksTable.assigneeId, nome: usersTable.name, atrasadas: sql<number>`count(*)::int` })
          .from(tasksTable).leftJoin(usersTable, eq(tasksTable.assigneeId, usersTable.id))
          .where(and(eq(tasksTable.organizationId, ctx.organizationId), inArray(tasksTable.status, ["CREATED", "IN_PROGRESS"]), lte(tasksTable.dueDate, today11)))
          .groupBy(tasksTable.assigneeId, usersTable.name)
          .having(sql`count(*) >= 2`)
          .orderBy(desc(sql`count(*)`)).limit(10),
        // Open positions in active scales
        db.select({ scaleId: scaleAllocationsTable.scaleId, count: sql<number>`count(*)::int` })
          .from(scaleAllocationsTable).innerJoin(scalesTable, eq(scaleAllocationsTable.scaleId, scalesTable.id))
          .where(and(ctx.operationId ? eq(scalesTable.operationId, ctx.operationId) : sql`true`, inArray(scalesTable.status, ["PUBLISHED", "REPUBLISHED"]), eq(scaleAllocationsTable.status, "OPEN")))
          .groupBy(scaleAllocationsTable.scaleId).orderBy(desc(sql`count(*)`)).limit(5),
      ]);

      // Classify workload risk
      const mediaAtv = sobrecarregados.length > 0 ? sobrecarregados.reduce((s, r) => s + r.count, 0) / sobrecarregados.length : 0;
      const riscosCarga = sobrecarregados
        .filter(r => r.count > mediaAtv * 1.3)
        .map(r => ({ nome: r.nome ?? r.userId, atividades: r.count, risco: r.count > mediaAtv * 2 ? "ALTO" : "MÉDIO" }));

      const totalPosAbertas = posicoesAbertas.reduce((s, r) => s + r.count, 0);

      return JSON.stringify({
        periodo: { de: from, ate: to },
        instrucao: "Apresente os riscos em ordem de severidade (ALTO → MÉDIO → BAIXO). Para cada risco, explique a consequência operacional e sugira uma ação preventiva concreta.",
        riscos_ausencia: {
          nivel:  altaAusencia.length > 3 ? "ALTO" : altaAusencia.length > 0 ? "MÉDIO" : "BAIXO",
          alerta: altaAusencia.length > 0 ? `${altaAusencia.length} membro(s) com ≥3 ausências no período` : "Nenhuma ausência recorrente detectada",
          membros: altaAusencia.map(r => ({ nome: r.nome ?? r.userId, total: r.total, no_show: r.noShow, nivel: r.noShow >= 2 ? "ALTO" : "MÉDIO" })),
        },
        riscos_carga: {
          nivel:  riscosCarga.some(r => r.risco === "ALTO") ? "ALTO" : riscosCarga.length > 0 ? "MÉDIO" : "BAIXO",
          alerta: riscosCarga.length > 0 ? `${riscosCarga.length} membro(s) com carga acima da média` : "Carga equilibrada",
          membros: riscosCarga,
        },
        riscos_tarefas: {
          nivel:  atrasadosCronicos.length > 3 ? "ALTO" : atrasadosCronicos.length > 0 ? "MÉDIO" : "BAIXO",
          alerta: atrasadosCronicos.length > 0 ? `${atrasadosCronicos.length} membro(s) com ≥2 tarefas atrasadas` : "Sem atrasos crônicos",
          membros: atrasadosCronicos.map(r => ({ nome: r.nome ?? r.assigneeId, tarefas_atrasadas: r.atrasadas, nivel: r.atrasadas >= 4 ? "ALTO" : "MÉDIO" })),
        },
        riscos_cobertura: {
          nivel:  totalPosAbertas > 5 ? "ALTO" : totalPosAbertas > 0 ? "MÉDIO" : "BAIXO",
          alerta: totalPosAbertas > 0 ? `${totalPosAbertas} posição(ões) abertas em escalas publicadas` : "Todas as posições preenchidas",
          total_posicoes_abertas: totalPosAbertas,
        },
      });
    }

    // ── gerar_relatorio_asa (Sprint 11) ────────────────────────────────────────
    if (name === "gerar_relatorio_asa") {
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const tipo     = ((input.tipo as string | undefined) ?? "SEMANAL").toUpperCase();
      const today11  = new Date().toISOString().slice(0, 10);
      const diasBack = tipo === "MENSAL" ? 30 : 7;
      const from     = (input.dateFrom as string | undefined) ?? new Date(Date.now() - diasBack * 86400000).toISOString().slice(0, 10);
      const to       = (input.dateTo   as string | undefined) ?? today11;

      const [[actTotal], taskStats, [absTotal], [recTotal], [openPos], topActivity, topAbs, atrasadas] = await Promise.all([
        // Activities
        db.select({ count: sql<number>`count(*)::int` }).from(scaleAllocationsTable).where(and(inArray(scaleAllocationsTable.status, ["ASSIGNED", "MANUAL_OVERRIDE"]), sql`${scaleAllocationsTable.manualDate} between ${from} and ${to}`)),
        // Tasks by status
        db.select({ status: tasksTable.status, count: sql<number>`count(*)::int` }).from(tasksTable).where(and(eq(tasksTable.organizationId, ctx.organizationId), sql`date(${tasksTable.createdAt}) between ${from} and ${to}`)).groupBy(tasksTable.status),
        // Absences
        db.select({ count: sql<number>`count(*)::int` }).from(folgasTable).where(and(ctx.operationId ? eq(folgasTable.operationId, ctx.operationId) : sql`true`, eq(folgasTable.status, "ACTIVE"), gte(folgasTable.startDate, from), lte(folgasTable.startDate, to))),
        // Recognitions
        db.select({ count: sql<number>`count(*)::int` }).from(recognitionsTable).where(and(eq(recognitionsTable.organizationId, ctx.organizationId), sql`date(${recognitionsTable.createdAt}) between ${from} and ${to}`)),
        // Open positions
        db.select({ count: sql<number>`count(*)::int` }).from(scaleAllocationsTable).innerJoin(scalesTable, eq(scaleAllocationsTable.scaleId, scalesTable.id)).where(and(ctx.operationId ? eq(scalesTable.operationId, ctx.operationId) : sql`true`, inArray(scalesTable.status, ["PUBLISHED", "REPUBLISHED"]), eq(scaleAllocationsTable.status, "OPEN"))),
        // Top performer
        db.select({ userId: scaleAllocationsTable.userId, nome: usersTable.name, count: sql<number>`count(*)::int` }).from(scaleAllocationsTable).leftJoin(usersTable, eq(scaleAllocationsTable.userId, usersTable.id)).where(and(inArray(scaleAllocationsTable.status, ["ASSIGNED", "MANUAL_OVERRIDE"]), sql`${scaleAllocationsTable.manualDate} between ${from} and ${to}`)).groupBy(scaleAllocationsTable.userId, usersTable.name).orderBy(desc(sql`count(*)`)).limit(3),
        // Top absent
        db.select({ userId: folgasTable.userId, nome: usersTable.name, count: sql<number>`count(*)::int` }).from(folgasTable).leftJoin(usersTable, eq(folgasTable.userId, usersTable.id)).where(and(ctx.operationId ? eq(folgasTable.operationId, ctx.operationId) : sql`true`, eq(folgasTable.status, "ACTIVE"), gte(folgasTable.startDate, from), lte(folgasTable.startDate, to))).groupBy(folgasTable.userId, usersTable.name).orderBy(desc(sql`count(*)`)).limit(3),
        // Overdue tasks
        db.select({ count: sql<number>`count(*)::int` }).from(tasksTable).where(and(eq(tasksTable.organizationId, ctx.organizationId), inArray(tasksTable.status, ["CREATED", "IN_PROGRESS"]), lte(tasksTable.dueDate, today11))),
      ]);

      const taskMap    = Object.fromEntries(taskStats.map(t => [t.status, t.count]));
      const taskTotal  = taskStats.reduce((s, t) => s + t.count, 0);
      const taskDone   = taskMap["DONE"] ?? 0;
      const txConc     = taskTotal > 0 ? Math.round((taskDone / taskTotal) * 100) : 0;
      const atrasadasN = atrasadas[0]?.count ?? 0;

      return JSON.stringify({
        tipo, periodo: { de: from, ate: to }, dias: diasBack,
        instrucao: `Gere um relatório ${tipo} executivo completo com as seções abaixo. Use emojis, bullets e linguagem direta. Conclua com 1-3 aprendizados e 1-2 recomendações para o próximo período.`,
        secoes: {
          "📈 Atividades":     { total: actTotal?.count ?? 0 },
          "📌 Tarefas":        { total: taskTotal, concluidas: taskDone, taxa_conclusao: `${txConc}%`, atrasadas: atrasadasN },
          "🌴 Ausências":      { total: absTotal?.count ?? 0 },
          "🏆 Reconhecimentos":{ total: recTotal?.count ?? 0 },
          "⚠️ Posições Abertas":{ total: openPos?.count ?? 0 },
          "🌟 Destaques":      { top_performer: topActivity.slice(0, 3).map(r => ({ nome: r.nome ?? r.userId, atividades: r.count })), mais_ausencias: topAbs.slice(0, 3).map(r => ({ nome: r.nome ?? r.userId, ausencias: r.count })) },
          "💡 Saúde da Operação": {
            status: txConc >= 70 && (openPos?.count ?? 0) === 0 ? "✅ SAUDÁVEL" : txConc >= 50 && (openPos?.count ?? 0) <= 2 ? "⚠️ ATENÇÃO" : "🔴 CRÍTICA",
            sinais: [txConc < 50 ? "Taxa de conclusão de tarefas abaixo de 50%" : null, (openPos?.count ?? 0) > 3 ? "Muitas posições abertas em escalas publicadas" : null, (absTotal?.count ?? 0) > (actTotal?.count ?? 1) * 0.2 ? "Alta taxa de ausências no período" : null].filter(Boolean),
          },
        },
      });
    }

    // ── Sprint 10 — Biblioteca Inteligente e Conhecimento ────────────────────
    const BODY_LIMIT = 3000; // chars fed to Claude per document

    const findDoc = async (docId?: string, titulo?: string) => {
      if (!ctx.organizationId) return null;
      if (docId) {
        const [d] = await db.select().from(libraryDocumentsTable).where(and(eq(libraryDocumentsTable.id, docId), eq(libraryDocumentsTable.orgId, ctx.organizationId))).limit(1);
        return d ?? null;
      }
      if (titulo) {
        const [d] = await db.select().from(libraryDocumentsTable).where(and(eq(libraryDocumentsTable.orgId, ctx.organizationId), ilike(libraryDocumentsTable.title, `%${titulo}%`), ne(libraryDocumentsTable.status, "ARCHIVED"))).orderBy(desc(libraryDocumentsTable.updatedAt)).limit(1);
        return d ?? null;
      }
      return null;
    };

    // ── resumir_documento (Sprint 10) ─────────────────────────────────────────
    if (name === "resumir_documento") {
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const doc = await findDoc(input.documentId as string | undefined, input.titulo as string | undefined);
      if (!doc) return JSON.stringify({ found: false, message: "Documento não encontrado. Verifique o título ou use consultar_documentos_populares para listar documentos disponíveis." });
      const bodySnippet = doc.body.length > BODY_LIMIT ? doc.body.slice(0, BODY_LIMIT) + "\n\n[... conteúdo truncado ...]" : doc.body;
      return JSON.stringify({
        found: true,
        id:       doc.id,
        titulo:   doc.title,
        tipo:     doc.type,
        status:   doc.status,
        versao:   doc.version,
        resumo:   doc.summary ?? null,
        publicado: doc.publishedAt,
        atualizado: doc.updatedAt,
        instrucao: "Resuma este documento em linguagem clara e operacional. Destaque: propósito, regras principais, exceções e quem é afetado.",
        conteudo: bodySnippet,
      });
    }

    // ── comparar_documentos (Sprint 10) ───────────────────────────────────────
    if (name === "comparar_documentos") {
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const id1 = input.documentId1 as string | undefined;
      const id2 = input.documentId2 as string | undefined;
      const t1  = input.titulo1 as string | undefined;
      const t2  = input.titulo2 as string | undefined;
      const v1  = input.versao1 as number | undefined;
      const v2  = input.versao2 as number | undefined;

      // Compare two versions of the same document
      if ((id1 || t1) && !id2 && !t2) {
        const doc = await findDoc(id1, t1);
        if (!doc) return JSON.stringify({ found: false, message: "Documento não encontrado." });
        const versions = await db.select().from(libraryDocumentVersionsTable).where(eq(libraryDocumentVersionsTable.documentId, doc.id)).orderBy(desc(libraryDocumentVersionsTable.version)).limit(5);
        if (versions.length < 2) return JSON.stringify({ found: true, message: `O documento "${doc.title}" tem apenas 1 versão registrada — não há versão anterior para comparar.`, versao_atual: doc.version });
        const verA = v1 ? versions.find(v => v.version === v1) : versions[1];
        const verB = v2 ? versions.find(v => v.version === v2) : versions[0];
        return JSON.stringify({
          found: true,
          instrucao: "Compare as duas versões abaixo. Destaque: o que foi adicionado, removido ou alterado. Use bullets para clareza.",
          documento: doc.title,
          versao_antiga: { versao: verA?.version, body: (verA?.body ?? "").slice(0, BODY_LIMIT) },
          versao_nova:   { versao: verB?.version, body: (verB?.body ?? "").slice(0, BODY_LIMIT) },
        });
      }

      // Compare two different documents
      const [doc1, doc2] = await Promise.all([findDoc(id1, t1), findDoc(id2, t2)]);
      if (!doc1 || !doc2) return JSON.stringify({ found: false, message: `${!doc1 ? "Primeiro" : "Segundo"} documento não encontrado.` });
      return JSON.stringify({
        found: true,
        instrucao: "Compare os dois documentos abaixo. Destaque diferenças de escopo, regras, público-alvo e aplicabilidade. Use bullets para clareza.",
        documento_1: { titulo: doc1.title, tipo: doc1.type, versao: doc1.version, status: doc1.status, body: doc1.body.slice(0, BODY_LIMIT) },
        documento_2: { titulo: doc2.title, tipo: doc2.type, versao: doc2.version, status: doc2.status, body: doc2.body.slice(0, BODY_LIMIT) },
      });
    }

    // ── consultar_perguntas_frequentes (Sprint 10) ────────────────────────────
    if (name === "consultar_perguntas_frequentes") {
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const tipoFilter = input.tipo as string | undefined;
      const docs = await db
        .select({ id: libraryDocumentsTable.id, title: libraryDocumentsTable.title, type: libraryDocumentsTable.type, version: libraryDocumentsTable.version, status: libraryDocumentsTable.status, summary: libraryDocumentsTable.summary, updatedAt: libraryDocumentsTable.updatedAt })
        .from(libraryDocumentsTable)
        .where(and(eq(libraryDocumentsTable.orgId, ctx.organizationId), tipoFilter ? eq(libraryDocumentsTable.type, tipoFilter as typeof libraryDocumentsTable.type._.data) : ne(libraryDocumentsTable.status, "ARCHIVED")))
        .orderBy(desc(libraryDocumentsTable.version), desc(libraryDocumentsTable.updatedAt))
        .limit(30);

      if (docs.length === 0) return JSON.stringify({ total: 0, message: "Nenhum documento publicado encontrado na biblioteca.", documentos: [] });

      // Group by type
      const byType = docs.reduce<Record<string, typeof docs>>((acc, d) => { acc[d.type] = acc[d.type] ?? []; acc[d.type].push(d); return acc; }, {});
      const moreVersions = docs.filter(d => d.version > 1).sort((a, b) => b.version - a.version).slice(0, 5);

      const TYPE_LABELS: Record<string, string> = {
        OPERATIONAL_PROCEDURE: "Procedimentos Operacionais",
        RULES_AND_POLICIES:    "Regras e Políticas",
        CHARACTER_REFERENCE:   "Referências de Personagem",
        COSTUME_REFERENCE:     "Referências de Figurino",
        ONBOARDING_MATERIAL:   "Material de Integração",
        SAFETY_PROCEDURE:      "Procedimentos de Segurança",
      };

      return JSON.stringify({
        total: docs.length,
        instrucao: "Apresente os tópicos mais relevantes da biblioteca. Destaque quais documentos têm múltiplas versões (mais atualizados) e ofereça resumir_documento para o que o usuário quiser saber mais.",
        por_tipo: Object.entries(byType).map(([t, ds]) => ({ tipo: TYPE_LABELS[t] ?? t, quantidade: ds.length, documentos: ds.map(d => ({ id: d.id, titulo: d.title, versao: d.version, status: d.status })) })),
        mais_atualizados: moreVersions.map(d => ({ id: d.id, titulo: d.title, versao: d.version })),
      });
    }

    // ── consultar_documentos_populares (Sprint 10) ────────────────────────────
    if (name === "consultar_documentos_populares") {
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const limite = (input.limite as number | undefined) ?? 5;
      const staleDate = new Date(Date.now() - 90 * 86400000);

      const [recentlyUpdated, stale, drafts, archived] = await Promise.all([
        // Recently updated
        db.select({ id: libraryDocumentsTable.id, title: libraryDocumentsTable.title, type: libraryDocumentsTable.type, version: libraryDocumentsTable.version, updatedAt: libraryDocumentsTable.updatedAt })
          .from(libraryDocumentsTable)
          .where(and(eq(libraryDocumentsTable.orgId, ctx.organizationId!), eq(libraryDocumentsTable.status, "UPDATED"))!)
          .orderBy(desc(libraryDocumentsTable.updatedAt)).limit(limite),
        // Stale: PUBLISHED but not touched in 90 days
        db.select({ id: libraryDocumentsTable.id, title: libraryDocumentsTable.title, type: libraryDocumentsTable.type, version: libraryDocumentsTable.version, publishedAt: libraryDocumentsTable.publishedAt })
          .from(libraryDocumentsTable)
          .where(and(eq(libraryDocumentsTable.orgId, ctx.organizationId!), eq(libraryDocumentsTable.status, "PUBLISHED"), lte(libraryDocumentsTable.updatedAt, staleDate))!)
          .orderBy(libraryDocumentsTable.updatedAt).limit(limite),
        // Drafts
        db.select({ id: libraryDocumentsTable.id, title: libraryDocumentsTable.title, type: libraryDocumentsTable.type, createdAt: libraryDocumentsTable.createdAt })
          .from(libraryDocumentsTable)
          .where(and(eq(libraryDocumentsTable.orgId, ctx.organizationId!), eq(libraryDocumentsTable.status, "DRAFT"))!)
          .orderBy(desc(libraryDocumentsTable.createdAt)).limit(limite),
        // Archived
        db.select({ id: libraryDocumentsTable.id, title: libraryDocumentsTable.title, type: libraryDocumentsTable.type, archivedAt: libraryDocumentsTable.archivedAt })
          .from(libraryDocumentsTable)
          .where(and(eq(libraryDocumentsTable.orgId, ctx.organizationId!), eq(libraryDocumentsTable.status, "ARCHIVED"))!)
          .orderBy(desc(libraryDocumentsTable.archivedAt)).limit(limite),
      ]);

      return JSON.stringify({
        instrucao: "Apresente o estado da biblioteca. Destaque documentos que precisam de revisão (desatualizados), rascunhos pendentes e o que foi recém-atualizado. Ofereça ações concretas ao gestor.",
        recem_atualizados: { quantidade: recentlyUpdated.length, documentos: recentlyUpdated },
        desatualizados:    { quantidade: stale.length, alerta: stale.length > 0 ? "⚠️ Documentos sem revisão há mais de 90 dias" : null, documentos: stale },
        rascunhos_pendentes: { quantidade: drafts.length, alerta: drafts.length > 0 ? "📝 Rascunhos aguardando publicação" : null, documentos: drafts },
        arquivados:        { quantidade: archived.length, documentos: archived },
      });
    }

    // ── sugerir_leituras (Sprint 10) ──────────────────────────────────────────
    if (name === "sugerir_leituras") {
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const tema  = input.tema as string;
      const tipo  = input.tipo as string | undefined;
      const limit = (input.limit as number | undefined) ?? 5;

      const docs = await db
        .select({ id: libraryDocumentsTable.id, title: libraryDocumentsTable.title, type: libraryDocumentsTable.type, summary: libraryDocumentsTable.summary, status: libraryDocumentsTable.status, version: libraryDocumentsTable.version })
        .from(libraryDocumentsTable)
        .where(and(
          eq(libraryDocumentsTable.orgId, ctx.organizationId),
          ne(libraryDocumentsTable.status, "ARCHIVED"),
          tipo ? eq(libraryDocumentsTable.type, tipo as typeof libraryDocumentsTable.type._.data) : sql`true`,
          or(ilike(libraryDocumentsTable.title, `%${tema}%`), ilike(libraryDocumentsTable.summary, `%${tema}%`), ilike(libraryDocumentsTable.body, `%${tema}%`)),
        ))
        .orderBy(desc(libraryDocumentsTable.updatedAt))
        .limit(limit);

      if (docs.length === 0) return JSON.stringify({ found: false, tema, message: `Nenhum documento encontrado sobre "${tema}". Tente consultar_documentos_populares para ver todos os documentos disponíveis.` });
      return JSON.stringify({
        tema,
        total: docs.length,
        instrucao: `Apresente as ${docs.length} sugestão(ões) de leitura sobre "${tema}". Para cada uma, explique brevemente por que é relevante e ofereça resumir_documento.`,
        sugestoes: docs.map(d => ({ id: d.id, titulo: d.title, tipo: d.type, status: d.status, versao: d.version, resumo: d.summary ?? null })),
      });
    }

    // ── Sprint 09 helpers ─────────────────────────────────────────────────────
    const today09   = new Date().toISOString().slice(0, 10);
    const month09   = today09.slice(0, 7) + "-01";
    const days30ago = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const days90ago = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);

    // ── consultar_estatisticas (Sprint 09) ────────────────────────────────────
    if (name === "consultar_estatisticas") {
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const from = (input.dateFrom as string | undefined) ?? month09;
      const to   = (input.dateTo   as string | undefined) ?? today09;
      const opFilter = ctx.operationId ? sql`and operation_id = ${ctx.operationId}` : sql``;

      // Activities
      const [actTotal] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(scaleAllocationsTable)
        .where(and(
          inArray(scaleAllocationsTable.status, ["ASSIGNED", "MANUAL_OVERRIDE"]),
          sql`${scaleAllocationsTable.manualDate} between ${from} and ${to}`,
        ));

      // Tasks by status
      const taskStats = await db
        .select({ status: tasksTable.status, count: sql<number>`count(*)::int` })
        .from(tasksTable)
        .where(and(eq(tasksTable.organizationId, ctx.organizationId), sql`date(created_at) between ${from} and ${to}`))
        .groupBy(tasksTable.status);

      // Absences
      const [absTotal] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(folgasTable)
        .where(and(
          ctx.operationId ? eq(folgasTable.operationId, ctx.operationId) : sql`true`,
          eq(folgasTable.status, "ACTIVE"),
          lte(folgasTable.startDate, to),
          gte(folgasTable.endDate, from),
        ));

      // Recognitions
      const [recTotal] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(recognitionsTable)
        .where(and(eq(recognitionsTable.organizationId, ctx.organizationId), sql`date(created_at) between ${from} and ${to}`));

      // Open positions
      const [openPos] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(scaleAllocationsTable)
        .innerJoin(scalesTable, eq(scaleAllocationsTable.scaleId, scalesTable.id))
        .where(and(
          ctx.operationId ? eq(scalesTable.operationId, ctx.operationId) : sql`true`,
          inArray(scalesTable.status, ["PUBLISHED", "REPUBLISHED"]),
          eq(scaleAllocationsTable.status, "OPEN"),
        ));

      const taskMap = Object.fromEntries(taskStats.map(t => [t.status, t.count]));
      const taskDone = taskMap["DONE"] ?? 0;
      const taskTotal = taskStats.reduce((s, t) => s + t.count, 0);
      const completionRate = taskTotal > 0 ? Math.round((taskDone / taskTotal) * 100) : 0;

      return JSON.stringify({
        periodo: { de: from, ate: to },
        atividades: actTotal?.count ?? 0,
        tarefas: { total: taskTotal, concluidas: taskDone, pendentes: (taskMap["CREATED"] ?? 0) + (taskMap["IN_PROGRESS"] ?? 0), atrasadas: taskMap["CHANGES_REQUESTED"] ?? 0, taxa_conclusao: `${completionRate}%` },
        ausencias: absTotal?.count ?? 0,
        reconhecimentos: recTotal?.count ?? 0,
        posicoes_abertas: openPos?.count ?? 0,
        message: `📈 Período ${from} → ${to}: ${actTotal?.count ?? 0} atividades, ${taskTotal} tarefas (${completionRate}% concluídas), ${absTotal?.count ?? 0} ausências, ${recTotal?.count ?? 0} reconhecimentos.`,
      });
    }

    // ── consultar_indicadores (Sprint 09) ─────────────────────────────────────
    if (name === "consultar_indicadores") {
      if (!isManager) return JSON.stringify({ error: "Exclusivo para gestores" });
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const from = (input.dateFrom as string | undefined) ?? days30ago;
      const to   = (input.dateTo   as string | undefined) ?? today09;

      // Top performer: most activities
      const topActivity = await db
        .select({ userId: scaleAllocationsTable.userId, count: sql<number>`count(*)::int` })
        .from(scaleAllocationsTable)
        .where(and(inArray(scaleAllocationsTable.status, ["ASSIGNED", "MANUAL_OVERRIDE"]), sql`${scaleAllocationsTable.manualDate} between ${from} and ${to}`))
        .groupBy(scaleAllocationsTable.userId)
        .orderBy(desc(sql`count(*)`))
        .limit(3);

      // Most absences
      const topAbsence = await db
        .select({ userId: folgasTable.userId, count: sql<number>`count(*)::int` })
        .from(folgasTable)
        .where(and(ctx.operationId ? eq(folgasTable.operationId, ctx.operationId!) : sql`true`, eq(folgasTable.status, "ACTIVE"), lte(folgasTable.startDate, to), gte(folgasTable.endDate, from))!)
        .groupBy(folgasTable.userId)
        .orderBy(desc(sql`count(*)`))
        .limit(3);

      // Task completion
      const [totalTasks] = await db.select({ count: sql<number>`count(*)::int` }).from(tasksTable).where(and(eq(tasksTable.organizationId, ctx.organizationId!), sql`date(created_at) between ${from} and ${to}`)!);
      const [doneTasks]  = await db.select({ count: sql<number>`count(*)::int` }).from(tasksTable).where(and(eq(tasksTable.organizationId, ctx.organizationId!), eq(tasksTable.status, "COMPLETED"), sql`date(updated_at) between ${from} and ${to}`)!);
      const completionRate = totalTasks?.count > 0 ? Math.round(((doneTasks?.count ?? 0) / totalTasks.count) * 100) : 0;

      // Resolve names
      const allIds = [...new Set([...topActivity.map(a => a.userId), ...topAbsence.map(a => a.userId)].filter(Boolean))] as string[];
      const nameMap = new Map((await (allIds.length > 0 ? db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(inArray(usersTable.id, allIds)) : Promise.resolve([]))).map(u => [u.id, u.name]));

      return JSON.stringify({
        periodo: { de: from, ate: to },
        top_performer: topActivity.map(a => ({ nome: nameMap.get(a.userId!) ?? a.userId, atividades: a.count })),
        mais_ausencias: topAbsence.map(a => ({ nome: nameMap.get(a.userId!) ?? a.userId, ausencias: a.count })),
        taxa_conclusao_tarefas: `${completionRate}%`,
        total_tarefas: totalTasks?.count ?? 0,
        tarefas_concluidas: doneTasks?.count ?? 0,
        message: `📊 KPIs ${from} → ${to}: top performer ${nameMap.get(topActivity[0]?.userId!) ?? "—"} (${topActivity[0]?.count ?? 0} atividades), taxa conclusão de tarefas ${completionRate}%, ${topAbsence[0]?.count ?? 0} ausências máx./membro.`,
      });
    }

    // ── consultar_desempenho (Sprint 09) ──────────────────────────────────────
    if (name === "consultar_desempenho") {
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const from  = (input.dateFrom as string | undefined) ?? days30ago;
      const to    = (input.dateTo   as string | undefined) ?? today09;
      const limit = (input.limit    as number | undefined) ?? 10;
      const uid   = input.userId as string | undefined;

      const actFilter = uid
        ? and(eq(scaleAllocationsTable.userId, uid), inArray(scaleAllocationsTable.status, ["ASSIGNED", "MANUAL_OVERRIDE"]), sql`${scaleAllocationsTable.manualDate} between ${from} and ${to}`)
        : and(inArray(scaleAllocationsTable.status, ["ASSIGNED", "MANUAL_OVERRIDE"]), sql`${scaleAllocationsTable.manualDate} between ${from} and ${to}`);
      const allocByMember = await db
        .select({ userId: scaleAllocationsTable.userId, atividades: sql<number>`count(*)::int` })
        .from(scaleAllocationsTable)
        .where(actFilter!)
        .groupBy(scaleAllocationsTable.userId)
        .orderBy(desc(sql`count(*)`))
        .limit(limit);

      const doneTskFilter = uid
        ? and(eq(tasksTable.organizationId, ctx.organizationId!), eq(tasksTable.assigneeId, uid), eq(tasksTable.status, "COMPLETED"), sql`date(updated_at) between ${from} and ${to}`)
        : and(eq(tasksTable.organizationId, ctx.organizationId!), eq(tasksTable.status, "COMPLETED"), sql`date(updated_at) between ${from} and ${to}`);
      const doneByMember = await db
        .select({ assigneeId: tasksTable.assigneeId, concluidas: sql<number>`count(*)::int` })
        .from(tasksTable).where(doneTskFilter!).groupBy(tasksTable.assigneeId).limit(limit);
      const doneMap = new Map(doneByMember.map(t => [t.assigneeId, t.concluidas]));

      const delayedByMember = await db
        .select({ assigneeId: tasksTable.assigneeId, atrasadas: sql<number>`count(*)::int` })
        .from(tasksTable)
        .where(and(eq(tasksTable.organizationId, ctx.organizationId!), uid ? eq(tasksTable.assigneeId, uid) : sql`true`, inArray(tasksTable.status, ["CREATED", "IN_PROGRESS"]), sql`${tasksTable.dueDate} < ${today09}`)!)
        .groupBy(tasksTable.assigneeId).limit(limit);
      const delayMap = new Map(delayedByMember.map(t => [t.assigneeId, t.atrasadas]));

      const absFilter = uid
        ? and(eq(folgasTable.userId, uid), eq(folgasTable.status, "ACTIVE"), lte(folgasTable.startDate, to), gte(folgasTable.endDate, from))
        : and(ctx.operationId ? eq(folgasTable.operationId, ctx.operationId) : sql`true`, eq(folgasTable.status, "ACTIVE"), lte(folgasTable.startDate, to), gte(folgasTable.endDate, from));
      const absByMember = await db
        .select({ userId: folgasTable.userId, ausencias: sql<number>`count(*)::int` })
        .from(folgasTable).where(absFilter!).groupBy(folgasTable.userId).limit(limit);
      const absMap = new Map(absByMember.map(f => [f.userId, f.ausencias]));

      const userIds = [...new Set(allocByMember.map(a => a.userId).filter(Boolean))] as string[];
      const nameMap = new Map((userIds.length > 0 ? await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(inArray(usersTable.id, userIds)) : []).map(u => [u.id, u.name]));

      const desempenho = allocByMember.filter(a => a.userId).map(a => ({
        membro:     nameMap.get(a.userId!) ?? a.userId,
        atividades: a.atividades,
        concluidas: doneMap.get(a.userId!) ?? 0,
        atrasadas:  delayMap.get(a.userId!) ?? 0,
        ausencias:  absMap.get(a.userId!) ?? 0,
        score:      a.atividades + (doneMap.get(a.userId!) ?? 0) - (delayMap.get(a.userId!) ?? 0) * 2 - (absMap.get(a.userId!) ?? 0),
      })).sort((a, b) => b.score - a.score);

      if (desempenho.length === 0) return JSON.stringify({ total: 0, message: "Nenhum dado de desempenho encontrado.", desempenho: [] });
      return JSON.stringify({ total: desempenho.length, periodo: { de: from, ate: to }, message: `📊 Desempenho de ${desempenho.length} membro(s) — ${from} → ${to}.`, desempenho });
    }

    // ── consultar_ausencias_historicas (Sprint 09) ────────────────────────────
    if (name === "consultar_ausencias_historicas") {
      if (!isManager) return JSON.stringify({ error: "Exclusivo para gestores" });
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const from  = (input.dateFrom as string | undefined) ?? days90ago;
      const to    = (input.dateTo   as string | undefined) ?? today09;
      const limit = (input.limit    as number | undefined) ?? 10;

      const byMember = await db
        .select({ userId: folgasTable.userId, userName: usersTable.name, total: sql<number>`count(*)::int`, noShow: sql<number>`sum(case when type='NO_SHOW' then 1 else 0 end)::int`, dayOff: sql<number>`sum(case when type='DAY_OFF' then 1 else 0 end)::int` })
        .from(folgasTable)
        .leftJoin(usersTable, eq(folgasTable.userId, usersTable.id))
        .where(and(ctx.operationId ? eq(folgasTable.operationId, ctx.operationId) : sql`true`, eq(folgasTable.status, "ACTIVE"), lte(folgasTable.startDate, to), gte(folgasTable.endDate, from)))
        .groupBy(folgasTable.userId, usersTable.name)
        .orderBy(desc(sql`count(*)`))
        .limit(limit);

      const [totalRow] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(folgasTable)
        .where(and(ctx.operationId ? eq(folgasTable.operationId, ctx.operationId) : sql`true`, eq(folgasTable.status, "ACTIVE"), lte(folgasTable.startDate, to), gte(folgasTable.endDate, from)));

      if (byMember.length === 0) return JSON.stringify({ total: 0, message: "Nenhuma ausência registrada no período.", ranking: [] });
      return JSON.stringify({
        total: totalRow?.count ?? 0,
        periodo: { de: from, ate: to },
        message: `🌴 ${totalRow?.count ?? 0} ausência(s) no período. Top: ${byMember[0]?.userName ?? "—"} com ${byMember[0]?.total} ausências.`,
        ranking: byMember.map(r => ({ membro: r.userName ?? r.userId, total: r.total, no_show: r.noShow, day_off: r.dayOff })),
      });
    }

    // ── consultar_tarefas_historicas (Sprint 09) ──────────────────────────────
    if (name === "consultar_tarefas_historicas") {
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const from  = (input.dateFrom as string | undefined) ?? days30ago;
      const to    = (input.dateTo   as string | undefined) ?? today09;
      const limit = (input.limit    as number | undefined) ?? 10;

      const byMember = await db
        .select({
          assigneeId: tasksTable.assigneeId,
          nome:       usersTable.name,
          total:      sql<number>`count(*)::int`,
          concluidas: sql<number>`sum(case when status='DONE' then 1 else 0 end)::int`,
          atrasadas:  sql<number>`sum(case when status in ('CREATED','IN_PROGRESS') and due_date < ${today09} then 1 else 0 end)::int`,
        })
        .from(tasksTable)
        .leftJoin(usersTable, eq(tasksTable.assigneeId, usersTable.id))
        .where(and(eq(tasksTable.organizationId, ctx.organizationId), ctx.operationId ? eq(tasksTable.operationId, ctx.operationId) : sql`true`, sql`date(${tasksTable.createdAt}) between ${from} and ${to}`))
        .groupBy(tasksTable.assigneeId, usersTable.name)
        .orderBy(desc(sql`count(*)`))
        .limit(limit);

      const [totals] = await db
        .select({
          total:      sql<number>`count(*)::int`,
          concluidas: sql<number>`sum(case when status='DONE' then 1 else 0 end)::int`,
          atrasadas:  sql<number>`sum(case when status in ('CREATED','IN_PROGRESS') and due_date < ${today09} then 1 else 0 end)::int`,
        })
        .from(tasksTable)
        .where(and(eq(tasksTable.organizationId, ctx.organizationId), sql`date(${tasksTable.createdAt}) between ${from} and ${to}`));

      const txConc = totals?.total > 0 ? Math.round(((totals?.concluidas ?? 0) / totals.total) * 100) : 0;
      return JSON.stringify({
        total: totals?.total ?? 0,
        concluidas: totals?.concluidas ?? 0,
        atrasadas: totals?.atrasadas ?? 0,
        taxa_conclusao: `${txConc}%`,
        periodo: { de: from, ate: to },
        message: `📌 ${totals?.total ?? 0} tarefas no período: ${txConc}% concluídas, ${totals?.atrasadas ?? 0} atrasadas.`,
        por_membro: byMember.map(r => ({ membro: r.nome ?? r.assigneeId ?? "—", total: r.total, concluidas: r.concluidas, atrasadas: r.atrasadas, taxa: r.total > 0 ? `${Math.round((r.concluidas / r.total) * 100)}%` : "—" })),
      });
    }

    // ── consultar_carga_historica (Sprint 09) ─────────────────────────────────
    if (name === "consultar_carga_historica") {
      if (!isManager) return JSON.stringify({ error: "Exclusivo para gestores" });
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const from  = (input.dateFrom as string | undefined) ?? days30ago;
      const to    = (input.dateTo   as string | undefined) ?? today09;
      const limit = (input.limit    as number | undefined) ?? 15;

      const byMember = await db
        .select({ userId: scaleAllocationsTable.userId, nome: usersTable.name, atividades: sql<number>`count(*)::int` })
        .from(scaleAllocationsTable)
        .leftJoin(usersTable, eq(scaleAllocationsTable.userId, usersTable.id))
        .where(and(inArray(scaleAllocationsTable.status, ["ASSIGNED", "MANUAL_OVERRIDE"]), sql`${scaleAllocationsTable.manualDate} between ${from} and ${to}`))
        .groupBy(scaleAllocationsTable.userId, usersTable.name)
        .orderBy(desc(sql`count(*)`))
        .limit(limit);

      const [avgRow] = await db
        .select({ media: sql<number>`avg(cnt)::numeric(6,1)` })
        .from(
          db.select({ userId: scaleAllocationsTable.userId, cnt: sql<number>`count(*)` })
            .from(scaleAllocationsTable)
            .where(and(inArray(scaleAllocationsTable.status, ["ASSIGNED", "MANUAL_OVERRIDE"]), sql`${scaleAllocationsTable.manualDate} between ${from} and ${to}`))
            .groupBy(scaleAllocationsTable.userId)
            .as("sub"),
        );

      if (byMember.length === 0) return JSON.stringify({ total: 0, message: "Nenhuma atividade registrada no período.", carga: [] });
      const max = byMember[0]?.atividades ?? 0;
      const min = byMember[byMember.length - 1]?.atividades ?? 0;
      return JSON.stringify({
        periodo: { de: from, ate: to },
        membros: byMember.length,
        media_atividades: Number(avgRow?.media ?? 0),
        max_atividades:   max,
        min_atividades:   min,
        desequilibrio:    max - min > (Number(avgRow?.media ?? 0) * 0.5) ? "⚠️ Desequilíbrio de carga detectado" : "✅ Carga relativamente equilibrada",
        message: `📊 Carga ${from} → ${to}: média ${avgRow?.media ?? 0} atividades/membro. Top: ${byMember[0]?.nome ?? "—"} com ${max}. Menor: ${byMember[byMember.length - 1]?.nome ?? "—"} com ${min}.`,
        carga: byMember.map(r => ({ membro: r.nome ?? r.userId ?? "—", atividades: r.atividades })),
      });
    }

    // ── Sprint 08 shared helper ───────────────────────────────────────────────
    const fetchMsgs = async (opts: { threadId?: string; groupId?: string; limit?: number; sinceHours?: number }) => {
      const limit      = opts.limit ?? 30;
      const sinceMs    = (opts.sinceHours ?? 48) * 3_600_000;
      const since      = new Date(Date.now() - sinceMs);
      const conditions: ReturnType<typeof eq>[] = [];
      if (opts.threadId) conditions.push(eq(messagesTable.threadId, opts.threadId));
      if (opts.groupId)  conditions.push(eq(messagesTable.groupId, opts.groupId));
      // Scope to org via threads when no direct filter
      if (!opts.threadId && !opts.groupId && ctx.organizationId) {
        const orgThreadIds = await db
          .select({ id: messageThreadsTable.id })
          .from(messageThreadsTable)
          .where(eq(messageThreadsTable.orgId, ctx.organizationId))
          .limit(50);
        if (orgThreadIds.length > 0) {
          conditions.push(inArray(messagesTable.threadId, orgThreadIds.map(t => t.id)));
        }
      }
      conditions.push(gte(messagesTable.createdAt, since));
      return db
        .select({
          id:        messagesTable.id,
          sender:    messagesTable.senderName,
          content:   messagesTable.content,
          createdAt: messagesTable.createdAt,
          threadId:  messagesTable.threadId,
          groupId:   messagesTable.groupId,
        })
        .from(messagesTable)
        .where(conditions.length > 0 ? and(...conditions) : gte(messagesTable.createdAt, since))
        .orderBy(desc(messagesTable.createdAt))
        .limit(limit);
    };

    // ── analisar_conversa (Sprint 08) ─────────────────────────────────────────
    if (name === "analisar_conversa") {
      const msgs = await fetchMsgs({ threadId: input.threadId as string | undefined, groupId: input.groupId as string | undefined, limit: (input.limit as number | undefined) ?? 30, sinceHours: (input.sinceHours as number | undefined) ?? 48 });
      if (msgs.length === 0) return JSON.stringify({ total: 0, message: "Nenhuma mensagem encontrada no período.", mensagens: [] });
      const participantes = [...new Set(msgs.map(m => m.sender).filter(Boolean))];
      return JSON.stringify({
        total: msgs.length,
        participantes,
        message: `${msgs.length} mensagem(ns) encontrada(s) de ${participantes.length} participante(s). Analise o conteúdo abaixo.`,
        mensagens: msgs.map(m => ({ remetente: m.sender ?? "—", conteudo: m.content, horario: m.createdAt })),
      });
    }

    // ── detectar_eventos (Sprint 08) ──────────────────────────────────────────
    if (name === "detectar_eventos") {
      const msgs = await fetchMsgs({ threadId: input.threadId as string | undefined, groupId: input.groupId as string | undefined, limit: (input.limit as number | undefined) ?? 50, sinceHours: (input.sinceHours as number | undefined) ?? 72 });
      const EVENTO_KW = /ensaio|reunião|reuniao|apresentação|apresentacao|show|treino|aula|sessão|sessao|\d{1,2}h|\d{1,2}:\d{2}|amanhã|amanha|segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo/i;
      const filtered = msgs.filter(m => EVENTO_KW.test(m.content));
      if (filtered.length === 0) return JSON.stringify({ total: 0, message: "Nenhuma menção a evento/ensaio encontrada nas mensagens.", eventos: [] });
      return JSON.stringify({
        total: filtered.length,
        message: `${filtered.length} mensagem(ns) com possíveis eventos detectados. Extraia data, hora e tipo de cada um.`,
        sugestao: "Se identificar um ensaio ou evento confirmado, use criar_ensaio_rascunho para criar um rascunho e peça confirmação.",
        mensagens: filtered.map(m => ({ remetente: m.sender ?? "—", conteudo: m.content, horario: m.createdAt })),
      });
    }

    // ── detectar_tarefas (Sprint 08) ──────────────────────────────────────────
    if (name === "detectar_tarefas") {
      const msgs = await fetchMsgs({ threadId: input.threadId as string | undefined, groupId: input.groupId as string | undefined, limit: (input.limit as number | undefined) ?? 50, sinceHours: (input.sinceHours as number | undefined) ?? 72 });
      const TAREFA_KW = /precisa|fica responsável|fica responsavel|responsável por|responsavel por|entregar|terminar|concluir|fazer|criar|alguém pode|alguem pode|quem pode|prazo|até|ate|deadline/i;
      const filtered = msgs.filter(m => TAREFA_KW.test(m.content));
      if (filtered.length === 0) return JSON.stringify({ total: 0, message: "Nenhuma menção a tarefa encontrada nas mensagens.", tarefas: [] });
      return JSON.stringify({
        total: filtered.length,
        message: `${filtered.length} mensagem(ns) com possíveis tarefas detectadas. Extraia responsável, descrição e prazo.`,
        sugestao: "Para cada tarefa identificada, pergunte se deseja criar via criar_solicitacao_troca ou registrar como tarefa formal.",
        mensagens: filtered.map(m => ({ remetente: m.sender ?? "—", conteudo: m.content, horario: m.createdAt })),
      });
    }

    // ── detectar_ausencias (Sprint 08) ────────────────────────────────────────
    if (name === "detectar_ausencias") {
      const msgs = await fetchMsgs({ threadId: input.threadId as string | undefined, groupId: input.groupId as string | undefined, limit: (input.limit as number | undefined) ?? 50, sinceHours: (input.sinceHours as number | undefined) ?? 72 });
      const AUSENCIA_KW = /não vai vir|nao vai vir|vai faltar|não virá|nao vira|não vem|nao vem|afastado|ausente|falta|não consegue|nao consegue|não pode|nao pode|está de folga|esta de folga|saiu|licença|licenca/i;
      const filtered = msgs.filter(m => AUSENCIA_KW.test(m.content));
      if (filtered.length === 0) return JSON.stringify({ total: 0, message: "Nenhuma menção a ausência encontrada nas mensagens.", ausencias: [] });
      return JSON.stringify({
        total: filtered.length,
        message: `${filtered.length} mensagem(ns) com possíveis ausências detectadas. Identifique o membro e a data.`,
        sugestao: "Para cada ausência identificada, resolva o nome via consultar_membros e pergunte se deseja registrar via registrar_ausencia.",
        mensagens: filtered.map(m => ({ remetente: m.sender ?? "—", conteudo: m.content, horario: m.createdAt })),
      });
    }

    // ── detectar_trocas (Sprint 08) ───────────────────────────────────────────
    if (name === "detectar_trocas") {
      const msgs = await fetchMsgs({ threadId: input.threadId as string | undefined, groupId: input.groupId as string | undefined, limit: (input.limit as number | undefined) ?? 50, sinceHours: (input.sinceHours as number | undefined) ?? 72 });
      const TROCA_KW = /troca|trocar|cobrir|cobre|substitui|substituir|vai no lugar|no lugar de|cede|ceder/i;
      const filtered = msgs.filter(m => TROCA_KW.test(m.content));
      if (filtered.length === 0) return JSON.stringify({ total: 0, message: "Nenhuma menção a troca de escala encontrada.", trocas: [] });
      return JSON.stringify({
        total: filtered.length,
        message: `${filtered.length} mensagem(ns) com possíveis trocas detectadas. Identifique os dois membros e a data.`,
        sugestao: "Para cada troca identificada, resolva os nomes via consultar_membros e pergunte se deseja abrir via criar_solicitacao_troca.",
        mensagens: filtered.map(m => ({ remetente: m.sender ?? "—", conteudo: m.content, horario: m.createdAt })),
      });
    }

    // ── resumir_conversa (Sprint 08) ──────────────────────────────────────────
    if (name === "resumir_conversa") {
      const msgs = await fetchMsgs({ threadId: input.threadId as string | undefined, groupId: input.groupId as string | undefined, limit: (input.limit as number | undefined) ?? 50, sinceHours: (input.sinceHours as number | undefined) ?? 48 });
      if (msgs.length === 0) return JSON.stringify({ total: 0, message: "Nenhuma mensagem encontrada para resumir.", mensagens: [] });
      const participantes = [...new Set(msgs.map(m => m.sender).filter(Boolean))];
      const oldest = msgs[msgs.length - 1]?.createdAt;
      const newest = msgs[0]?.createdAt;
      return JSON.stringify({
        instrucao: "Gere um resumo operacional estruturado com: participantes, assuntos principais, decisões, ensaios/eventos mencionados, ausências, trocas e tarefas implícitas. Use emojis para categorias.",
        total: msgs.length,
        participantes,
        periodo: { de: oldest, ate: newest },
        message: `${msgs.length} mensagem(ns) de ${participantes.length} participante(s). Gere o resumo abaixo.`,
        mensagens: msgs.map(m => ({ remetente: m.sender ?? "—", conteudo: m.content, horario: m.createdAt })),
      });
    }

    // ── destacar_itens (Sprint 08) ────────────────────────────────────────────
    if (name === "destacar_itens") {
      const msgs = await fetchMsgs({ threadId: input.threadId as string | undefined, groupId: input.groupId as string | undefined, limit: (input.limit as number | undefined) ?? 50, sinceHours: (input.sinceHours as number | undefined) ?? 72 });
      if (msgs.length === 0) return JSON.stringify({ total: 0, message: "Nenhuma mensagem encontrada.", itens: [] });

      const KW_CATS = [
        { cat: "📅 EVENTO",   re: /ensaio|reunião|reuniao|apresentação|apresentacao|show|\d{1,2}h|\d{1,2}:\d{2}/i },
        { cat: "🌴 AUSÊNCIA", re: /faltar|não vai vir|nao vai vir|afastado|ausente|folga|não vem|nao vem/i },
        { cat: "🔄 TROCA",    re: /troca|trocar|cobrir|cobre|substitui/i },
        { cat: "📌 TAREFA",   re: /precisa|responsável|responsavel|entregar|terminar|fazer|prazo/i },
        { cat: "🎉 SOCIAL",   re: /aniversário|aniversario|parabéns|parabens|feliz|conquista|marco/i },
        { cat: "⚠️ ATENÇÃO",  re: /urgente|atenção|atencao|importante|crítico|critico|problema|erro/i },
      ];

      const itens: { categoria: string; remetente: string; conteudo: string; horario: unknown; sugestao: string }[] = [];
      const SUGESTOES: Record<string, string> = {
        "📅 EVENTO":   "Pergunte se deseja criar um evento ou ensaio via criar_ensaio_rascunho.",
        "🌴 AUSÊNCIA / AFASTAMENTO / FÉRIAS": "Confirme o membro e as datas (início e fim). Para período multi-dia: startDate + endDate em registrar_ausencia (tipo AFASTAMENTO ou RECESSO). Para falta avulsa: apenas startDate (tipo NO_SHOW). SEMPRE confirme antes de executar.",
        "🔄 TROCA":    "Confirme os dois membros, depois ofereça criar_solicitacao_troca.",
        "📌 TAREFA":   "Confirme responsável e prazo, depois ofereça criar uma tarefa formal.",
        "🎉 SOCIAL":   "Considere criar um reconhecimento ou aviso comemorativo.",
        "⚠️ ATENÇÃO":  "Destaque ao supervisor. Verifique se requer ação imediata.",
      };

      for (const m of msgs) {
        for (const { cat, re } of KW_CATS) {
          if (re.test(m.content)) {
            itens.push({ categoria: cat, remetente: m.sender ?? "—", conteudo: m.content, horario: m.createdAt, sugestao: SUGESTOES[cat] ?? "" });
            break;
          }
        }
      }

      if (itens.length === 0) return JSON.stringify({ total: 0, message: "Nenhum item operacional detectado nas mensagens.", itens: [] });
      return JSON.stringify({
        total: itens.length,
        de_total: msgs.length,
        message: `${itens.length} item(ns) relevante(s) de ${msgs.length} mensagem(ns). Apresente por categoria e sugira ações.`,
        itens,
      });
    }

    // ── detectar_conquistas (Sprint 07) ──────────────────────────────────────
    if (name === "detectar_conquistas") {
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const limit    = (input.limit as number | undefined) ?? 20;
      const MILESTONES = [50, 100, 200, 500];

      // Scale allocations count per user
      const allocFilter = input.userId
        ? and(eq(scaleAllocationsTable.userId, input.userId as string), inArray(scaleAllocationsTable.status, ["ASSIGNED", "MANUAL_OVERRIDE"]))
        : inArray(scaleAllocationsTable.status, ["ASSIGNED", "MANUAL_OVERRIDE"]);
      const allocCounts = await db
        .select({ userId: scaleAllocationsTable.userId, count: sql<number>`count(*)::int` })
        .from(scaleAllocationsTable)
        .where(allocFilter!)
        .groupBy(scaleAllocationsTable.userId)
        .limit(limit);

      // Completed tasks count per user
      const taskFilter = input.userId
        ? and(eq(tasksTable.organizationId, ctx.organizationId!), eq(tasksTable.assigneeId, input.userId as string), eq(tasksTable.status, "COMPLETED"))
        : and(eq(tasksTable.organizationId, ctx.organizationId!), eq(tasksTable.status, "COMPLETED"));
      const taskCounts = await db
        .select({ assigneeId: tasksTable.assigneeId, count: sql<number>`count(*)::int` })
        .from(tasksTable)
        .where(taskFilter!)
        .groupBy(tasksTable.assigneeId)
        .limit(limit);

      const taskMap = new Map(taskCounts.map(t => [t.assigneeId, t.count]));
      const userIds = [...new Set(allocCounts.map(a => a.userId).filter(Boolean))] as string[];
      const userRows = userIds.length > 0
        ? await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(and(inArray(usersTable.id, userIds), eq(usersTable.organizationId, ctx.organizationId)))
        : [];
      const nameMap = new Map(userRows.map(u => [u.id, u.name]));

      const conquistas: { membro: string; tipo: string; marco: number; label: string }[] = [];
      for (const a of allocCounts) {
        if (!a.userId) continue;
        const nome = nameMap.get(a.userId) ?? a.userId;
        for (const m of MILESTONES) {
          if (a.count === m) conquistas.push({ membro: nome, tipo: "ATIVIDADES", marco: m, label: `🏆 ${nome} atingiu ${m} atividades escaladas!` });
        }
        const tasks = taskMap.get(a.userId) ?? 0;
        for (const m of MILESTONES) {
          if (tasks === m) conquistas.push({ membro: nome, tipo: "TAREFAS", marco: m, label: `🏆 ${nome} concluiu ${m} tarefas!` });
        }
      }

      if (conquistas.length === 0) return JSON.stringify({ total: 0, message: "Nenhuma conquista de marco atingida no momento.", conquistas: [] });
      return JSON.stringify({ total: conquistas.length, message: `${conquistas.length} conquista(s) de marco detectada(s)!`, conquistas });
    }

    // ── consultar_marcos (Sprint 07) ──────────────────────────────────────────
    if (name === "consultar_marcos") {
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const daysAhead = (input.daysAhead as number | undefined) ?? 7;
      const today     = new Date();
      const marcos: { userId: string; nome: string; tipo: string; label: string; data: string }[] = [];

      const orgUsers = await db
        .select({ id: usersTable.id, name: usersTable.name, createdAt: usersTable.createdAt, birthDate: usersTable.birthDate })
        .from(usersTable)
        .where(and(eq(usersTable.organizationId, ctx.organizationId), eq(usersTable.status, "ACTIVE")))
        .limit(200);

      for (let offset = 0; offset <= daysAhead; offset++) {
        const d = new Date(today); d.setDate(d.getDate() + offset);
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        const dateStr = `${d.getFullYear()}-${mm}-${dd}`;

        for (const u of orgUsers) {
          // Time of house milestones
          const joined = new Date(u.createdAt);
          const years  = d.getFullYear() - joined.getFullYear();
          const months = (d.getFullYear() - joined.getFullYear()) * 12 + (d.getMonth() - joined.getMonth());
          if (joined.getDate() === d.getDate() && joined.getMonth() === d.getMonth()) {
            if (years > 0 && years <= 10) marcos.push({ userId: u.id, nome: u.name, tipo: "TIME_OF_HOUSE", label: `${years} ano${years > 1 ? "s" : ""} na ASA`, data: dateStr });
            else if (months === 3 || months === 6) marcos.push({ userId: u.id, nome: u.name, tipo: "TIME_OF_HOUSE", label: `${months} meses na ASA`, data: dateStr });
          }
          // Birthdays
          if (u.birthDate) {
            const bm = u.birthDate.slice(5, 7); const bd = u.birthDate.slice(8, 10);
            if (bm === mm && bd === dd) marcos.push({ userId: u.id, nome: u.name, tipo: "BIRTHDAY", label: `🎉 Aniversário`, data: dateStr });
          }
        }
      }

      if (marcos.length === 0) return JSON.stringify({ total: 0, message: `Nenhum marco nos próximos ${daysAhead} dias.`, marcos: [] });
      return JSON.stringify({ total: marcos.length, daysAhead, message: `${marcos.length} marco(s) nos próximos ${daysAhead} dias.`, marcos });
    }

    // ── criar_reconhecimento_automatico (Sprint 07) ───────────────────────────
    if (name === "criar_reconhecimento_automatico") {
      if (!isManager) return JSON.stringify({ error: "Sem permissão para criar reconhecimentos" });
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const recUserId      = input.userId       as string;
      const recUserName    = input.userName     as string;
      const triggerType    = input.triggerType  as string;
      const triggerLabel   = input.triggerLabel as string;
      const customMessage  = input.customMessage as string | undefined;

      const autoMessages: Record<string, string> = {
        BIRTHDAY:      `🎉 Hoje é um dia especial — é o aniversário de ${recUserName}! Em nome de toda a equipe, parabéns! Sua dedicação e energia fazem toda a diferença na nossa operação.`,
        TIME_OF_HOUSE: `⭐ ${recUserName} completa ${triggerLabel} com a gente! Obrigado por sua trajetória, comprometimento e por fazer parte desta equipe incrível.`,
        ACHIEVEMENT:   `🏆 ${recUserName} atingiu um marco: ${triggerLabel}! Uma conquista que reflete esforço, dedicação e presença constante. Parabéns!`,
      };
      const message = customMessage ?? autoMessages[triggerType] ?? `🎖️ Reconhecimento especial para ${recUserName}: ${triggerLabel}.`;
      const title   = triggerType === "BIRTHDAY" ? `🎂 Feliz aniversário, ${recUserName.split(" ")[0]}!` : `${triggerType === "TIME_OF_HOUSE" ? "⭐" : "🏆"} ${triggerLabel} — ${recUserName.split(" ")[0]}`;

      const [autoTarget] = await db.select({ id: usersTable.id }).from(usersTable)
        .where(and(eq(usersTable.id, recUserId), eq(usersTable.organizationId, ctx.organizationId)))
        .limit(1);
      if (!autoTarget) return JSON.stringify({ error: "Membro não encontrado nesta organização" });
      const [rec] = await db.insert(recognitionsTable).values({
        organizationId: ctx.organizationId,
        userId:         recUserId,
        type:           `AUTO_${triggerType}`,
        title,
        message,
        createdBy:      ctx.userId,
        publishedAt:    new Date(),
      }).returning();
      try {
        await sendNotification({
          userId:     recUserId,
          type:       "RECOGNITION_RECEIVED",
          title:      "🎉 Você recebeu um reconhecimento!",
          message:    title,
          priority:   "IMPORTANT",
          category:   "system",
          entityType: "recognition",
          entityId:   rec.id,
        });
      } catch (err) { console.error("Falha ao notificar reconhecimento automático", { targetUserId: recUserId, recognitionId: rec.id, err }); }

      return JSON.stringify({
        created: true,
        id: rec.id,
        title,
        message,
        trigger: triggerLabel,
        displayMessage: `🎖️ Reconhecimento "${title}" criado e publicado! ${recUserName} pode ver no Mural da Equipe.`,
      });
    }

    // ── consultar_historico_membro (Sprint 07) ────────────────────────────────
    if (name === "consultar_historico_membro") {
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const memberId   = input.userId   as string;
      const memberName = (input.userName as string | undefined) ?? memberId;

      const [userRow] = await db
        .select({ id: usersTable.id, name: usersTable.name, createdAt: usersTable.createdAt, birthDate: usersTable.birthDate })
        .from(usersTable)
        .where(and(eq(usersTable.id, memberId), eq(usersTable.organizationId, ctx.organizationId)))
        .limit(1);

      if (!userRow) return JSON.stringify({ error: "Membro não encontrado" });

      const today   = new Date();
      const joined  = new Date(userRow.createdAt);
      const months  = (today.getFullYear() - joined.getFullYear()) * 12 + (today.getMonth() - joined.getMonth());
      const years   = Math.floor(months / 12);
      const tempoDeCasa = years >= 1 ? `${years} ano${years > 1 ? "s" : ""}` : `${months} mês${months !== 1 ? "es" : ""}`;

      const recRows = await db
        .select({ id: recognitionsTable.id, type: recognitionsTable.type, title: recognitionsTable.title, publishedAt: recognitionsTable.publishedAt })
        .from(recognitionsTable)
        .where(and(eq(recognitionsTable.userId, memberId), eq(recognitionsTable.organizationId, ctx.organizationId)))
        .orderBy(desc(recognitionsTable.createdAt))
        .limit(10);

      const [activityCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(scaleAllocationsTable)
        .where(and(eq(scaleAllocationsTable.userId, memberId), inArray(scaleAllocationsTable.status, ["ASSIGNED", "MANUAL_OVERRIDE"])));

      const [tasksDone] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(tasksTable)
        .where(and(eq(tasksTable.assigneeId, memberId), eq(tasksTable.organizationId, ctx.organizationId!), eq(tasksTable.status, "COMPLETED"))!);

      return JSON.stringify({
        membro: userRow.name,
        aniversario: userRow.birthDate ?? "não registrado",
        tempoDeCasa,
        mesesNaASA: months,
        reconhecimentos: recRows.map(r => ({ titulo: r.title, tipo: r.type, data: r.publishedAt })),
        totalReconhecimentos: recRows.length,
        atividadesRealizadas: activityCount?.count ?? 0,
        tarefasConcluidas: tasksDone?.count ?? 0,
        message: `📋 Histórico de ${userRow.name}: ${tempoDeCasa} na ASA, ${activityCount?.count ?? 0} atividades, ${tasksDone?.count ?? 0} tarefas concluídas, ${recRows.length} reconhecimento(s).`,
      });
    }

    // ── consultar_riscos_operacionais (Sprint 06) ─────────────────────────────
    if (name === "consultar_riscos_operacionais") {
      if (!isManager) return JSON.stringify({ error: "Exclusivo para gestores" });
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const today = new Date().toISOString().slice(0, 10);
      const date  = (input.date as string | undefined) ?? today;
      const risks: { severity: string; type: string; message: string; userId?: string; userName?: string }[] = [];

      // 1. Overdue tasks
      const overdueTasks = await db
        .select({ title: tasksTable.title, dueDate: tasksTable.dueDate, assigneeName: usersTable.name, assigneeId: tasksTable.assigneeId })
        .from(tasksTable)
        .leftJoin(usersTable, eq(tasksTable.assigneeId, usersTable.id))
        .where(and(
          eq(tasksTable.organizationId, ctx.organizationId),
          ctx.operationId ? eq(tasksTable.operationId, ctx.operationId) : sql`true`,
          inArray(tasksTable.status, ["CREATED", "IN_PROGRESS", "CHANGES_REQUESTED"]),
          sql`${tasksTable.dueDate} < ${today}`,
        ))
        .limit(10);
      for (const t of overdueTasks) {
        risks.push({ severity: "HIGH", type: "TAREFA_ATRASADA", message: `Tarefa "${t.title}" atrasada (venceu em ${t.dueDate}).`, userId: t.assigneeId ?? undefined, userName: t.assigneeName ?? undefined });
      }

      // 2. Members on folga with scale allocations on that date
      const folgasToday = await db
        .select({ userId: folgasTable.userId, userName: usersTable.name })
        .from(folgasTable)
        .leftJoin(usersTable, eq(folgasTable.userId, usersTable.id))
        .where(and(
          ctx.operationId ? eq(folgasTable.operationId, ctx.operationId) : sql`true`,
          eq(folgasTable.status, "ACTIVE"),
          lte(folgasTable.startDate, date),
          gte(folgasTable.endDate, date),
        ))
        .limit(20);
      if (folgasToday.length > 0) {
        const folgaUserIds = folgasToday.map(f => f.userId).filter(Boolean) as string[];
        const conflictAllocs = await db
          .select({ userId: scaleAllocationsTable.userId, label: scaleAllocationsTable.manualLabel })
          .from(scaleAllocationsTable)
          .where(and(
            inArray(scaleAllocationsTable.userId, folgaUserIds),
            eq(scaleAllocationsTable.manualDate, date),
            inArray(scaleAllocationsTable.status, ["ASSIGNED", "MANUAL_OVERRIDE"]),
          ))
          .limit(20);
        for (const a of conflictAllocs) {
          const fn = folgasToday.find(f => f.userId === a.userId);
          risks.push({ severity: "HIGH", type: "FOLGA_COM_ATIVIDADE", message: `${fn?.userName ?? "Membro"} está de folga mas tem atividade "${a.label ?? "—"}" em ${date}.`, userId: a.userId ?? undefined, userName: fn?.userName ?? undefined });
        }
      }

      // 3. Open slots in active scales
      const openSlots = await db
        .select({ id: scaleAllocationsTable.id })
        .from(scaleAllocationsTable)
        .innerJoin(scalesTable, eq(scaleAllocationsTable.scaleId, scalesTable.id))
        .where(and(
          ctx.operationId ? eq(scalesTable.operationId, ctx.operationId) : sql`true`,
          inArray(scalesTable.status, ["PUBLISHED", "REPUBLISHED"]),
          eq(scaleAllocationsTable.status, "OPEN"),
        ))
        .limit(5);
      if (openSlots.length > 0) {
        risks.push({ severity: "MEDIUM", type: "POSICOES_ABERTAS", message: `${openSlots.length} posição(ões) em aberto na escala. Cobertura necessária.` });
      }

      if (risks.length === 0) return JSON.stringify({ total: 0, message: "Nenhum risco operacional detectado para esta data. ✅", risks: [] });
      return JSON.stringify({ total: risks.length, date, message: `${risks.length} risco(s) detectado(s) em ${date}.`, risks });
    }

    // ── consultar_posicoes_abertas (Sprint 06) ────────────────────────────────
    if (name === "consultar_posicoes_abertas") {
      if (!isManager) return JSON.stringify({ error: "Exclusivo para gestores" });
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const limit = (input.limit as number | undefined) ?? 20;

      const rows = await db
        .select({
          allocId:   scaleAllocationsTable.id,
          scaleId:   scalesTable.id,
          scaleTitle: scalesTable.title,
          eventId:   scaleAllocationsTable.agendaEventId,
          manualDate: scaleAllocationsTable.manualDate,
          manualLabel: scaleAllocationsTable.manualLabel,
        })
        .from(scaleAllocationsTable)
        .innerJoin(scalesTable, eq(scaleAllocationsTable.scaleId, scalesTable.id))
        .where(and(
          ctx.operationId ? eq(scalesTable.operationId, ctx.operationId) : sql`true`,
          inArray(scalesTable.status, ["PUBLISHED", "REPUBLISHED", "DRAFT"]),
          eq(scaleAllocationsTable.status, "OPEN"),
        ))
        .orderBy(scalesTable.periodStart)
        .limit(limit);

      if (rows.length === 0) return JSON.stringify({ total: 0, message: "Nenhuma posição em aberto nas escalas ativas. ✅", posicoes: [] });
      return JSON.stringify({
        total: rows.length,
        message: `${rows.length} posição(ões) em aberto.`,
        posicoes: rows.map(r => ({
          escala: r.scaleTitle,
          data: r.manualDate,
          atividade: r.manualLabel ?? "—",
        })),
      });
    }

    // ── consultar_tarefas_criticas (Sprint 06) ────────────────────────────────
    if (name === "consultar_tarefas_criticas") {
      if (!isManager) return JSON.stringify({ error: "Exclusivo para gestores" });
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const today     = new Date().toISOString().slice(0, 10);
      const daysAhead = (input.daysAhead as number | undefined) ?? 2;
      const limit     = (input.limit    as number | undefined) ?? 15;
      const future    = new Date(Date.now() + daysAhead * 86400000).toISOString().slice(0, 10);

      const rows = await db
        .select({
          id:           tasksTable.id,
          title:        tasksTable.title,
          dueDate:      tasksTable.dueDate,
          status:       tasksTable.status,
          priority:     tasksTable.priority,
          assigneeName: usersTable.name,
          assigneeId:   tasksTable.assigneeId,
        })
        .from(tasksTable)
        .leftJoin(usersTable, eq(tasksTable.assigneeId, usersTable.id))
        .where(and(
          eq(tasksTable.organizationId, ctx.organizationId),
          ctx.operationId ? eq(tasksTable.operationId, ctx.operationId) : sql`true`,
          inArray(tasksTable.status, ["CREATED", "IN_PROGRESS", "CHANGES_REQUESTED"]),
          sql`${tasksTable.dueDate} <= ${future}`,
        ))
        .orderBy(tasksTable.dueDate)
        .limit(limit);

      const tarefas = rows.map(t => ({
        id:        t.id,
        titulo:    t.title,
        vencimento: t.dueDate,
        status:    t.status,
        prioridade: t.priority,
        responsavel: t.assigneeName ?? "—",
        urgencia:  t.dueDate < today ? "ATRASADA" : t.dueDate === today ? "HOJE" : "AMANHA",
      }));

      if (tarefas.length === 0) return JSON.stringify({ total: 0, message: "Nenhuma tarefa crítica nos próximos dias. ✅", tarefas: [] });
      const atrasadas = tarefas.filter(t => t.urgencia === "ATRASADA").length;
      return JSON.stringify({
        total: tarefas.length,
        atrasadas,
        message: `${tarefas.length} tarefa(s) crítica(s)${atrasadas > 0 ? ` — ${atrasadas} já atrasada(s)` : ""}.`,
        tarefas,
      });
    }

    // ── consultar_conflitos (Sprint 06) ───────────────────────────────────────
    if (name === "consultar_conflitos") {
      if (!isManager) return JSON.stringify({ error: "Exclusivo para gestores" });
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const today    = new Date().toISOString().slice(0, 10);
      const dateFrom = (input.dateFrom as string | undefined) ?? today;
      const dateTo   = (input.dateTo   as string | undefined) ?? new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

      const folgas = await db
        .select({ userId: folgasTable.userId, userName: usersTable.name, startDate: folgasTable.startDate, endDate: folgasTable.endDate, type: folgasTable.type })
        .from(folgasTable)
        .leftJoin(usersTable, eq(folgasTable.userId, usersTable.id))
        .where(and(
          ctx.operationId ? eq(folgasTable.operationId, ctx.operationId) : sql`true`,
          eq(folgasTable.status, "ACTIVE"),
          lte(folgasTable.startDate, dateTo),
          gte(folgasTable.endDate, dateFrom),
        ))
        .limit(30);

      const conflitos: { tipo: string; membro: string; data: string; detalhe: string }[] = [];
      for (const f of folgas) {
        if (!f.userId) continue;
        const allocs = await db
          .select({ date: scaleAllocationsTable.manualDate, label: scaleAllocationsTable.manualLabel })
          .from(scaleAllocationsTable)
          .where(and(
            eq(scaleAllocationsTable.userId, f.userId),
            inArray(scaleAllocationsTable.status, ["ASSIGNED", "MANUAL_OVERRIDE"]),
            sql`${scaleAllocationsTable.manualDate} BETWEEN ${dateFrom} AND ${dateTo}`,
          ))
          .limit(5);
        for (const a of allocs) {
          if (!a.date) continue;
          if (a.date >= f.startDate && a.date <= f.endDate) {
            conflitos.push({ tipo: "FOLGA_COM_ATIVIDADE", membro: f.userName ?? f.userId, data: a.date, detalhe: `${f.userName ?? "Membro"} está de folga (${f.type}) mas tem atividade "${a.label ?? "—"}" nessa data.` });
          }
        }
      }

      if (conflitos.length === 0) return JSON.stringify({ total: 0, message: `Nenhum conflito detectado entre ${dateFrom} e ${dateTo}. ✅`, conflitos: [] });
      return JSON.stringify({ total: conflitos.length, message: `${conflitos.length} conflito(s) detectado(s).`, conflitos });
    }

    // ── sugerir_cobertura (Sprint 06) ─────────────────────────────────────────
    if (name === "sugerir_cobertura") {
      if (!isManager) return JSON.stringify({ error: "Exclusivo para gestores" });
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const date          = input.date          as string;
      const activityLabel = input.activityLabel as string | undefined;
      const excludeUserId = input.excludeUserId as string | undefined;

      // All members in this operation
      const opFilter = ctx.operationId
        ? eq(userRolesTable.operationId, ctx.operationId)
        : sql`true`;

      const allMembers = await db
        .selectDistinct({ userId: usersTable.id, userName: usersTable.name })
        .from(usersTable)
        .innerJoin(userRolesTable, eq(userRolesTable.userId, usersTable.id))
        .where(and(opFilter, eq(usersTable.status, "ACTIVE")))
        .limit(50);

      // Members on folga that day
      const folgasOnDate = await db
        .select({ userId: folgasTable.userId })
        .from(folgasTable)
        .where(and(
          ctx.operationId ? eq(folgasTable.operationId, ctx.operationId) : sql`true`,
          eq(folgasTable.status, "ACTIVE"),
          lte(folgasTable.startDate, date),
          gte(folgasTable.endDate, date),
        ));
      const onFolgaIds = new Set(folgasOnDate.map(f => f.userId).filter(Boolean) as string[]);

      // Members already allocated that day
      const allocatedThatDay = await db
        .select({ userId: scaleAllocationsTable.userId })
        .from(scaleAllocationsTable)
        .where(and(
          eq(scaleAllocationsTable.manualDate, date),
          inArray(scaleAllocationsTable.status, ["ASSIGNED", "MANUAL_OVERRIDE"]),
        ));
      const allocatedIds = new Set(allocatedThatDay.map(a => a.userId).filter(Boolean) as string[]);

      // Experience: who has done this activity before
      const experiencedIds = new Set<string>();
      if (activityLabel) {
        const experienced = await db
          .select({ userId: scaleAllocationsTable.userId })
          .from(scaleAllocationsTable)
          .where(and(
            ilike(scaleAllocationsTable.manualLabel, `%${activityLabel}%`),
            inArray(scaleAllocationsTable.status, ["ASSIGNED", "MANUAL_OVERRIDE"]),
          ))
          .limit(50);
        experienced.forEach(e => { if (e.userId) experiencedIds.add(e.userId); });
      }

      const suggestions = allMembers
        .filter(m => m.userId !== excludeUserId && !onFolgaIds.has(m.userId))
        .map(m => ({
          userId:      m.userId,
          nome:        m.userName,
          disponivel:  !allocatedIds.has(m.userId),
          experiencia: experiencedIds.has(m.userId),
          score:       (experiencedIds.has(m.userId) ? 2 : 0) + (!allocatedIds.has(m.userId) ? 1 : 0),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      if (suggestions.length === 0) return JSON.stringify({ total: 0, message: "Nenhum membro disponível encontrado para cobertura.", sugestoes: [] });
      return JSON.stringify({
        total: suggestions.length,
        data: date,
        atividade: activityLabel ?? "não especificada",
        message: `${suggestions.length} sugestão(ões) de cobertura para ${date}.`,
        sugestoes: suggestions.map(s => ({
          nome: s.nome,
          disponivel: s.disponivel ? "✅ Livre neste dia" : "⚠️ Já tem atividade",
          experiencia: s.experiencia ? "✅ Já realizou esta atividade" : "—",
        })),
      });
    }

    // ── consultar_carga_operacional (Sprint 06) ───────────────────────────────
    if (name === "consultar_carga_operacional") {
      if (!isManager) return JSON.stringify({ error: "Exclusivo para gestores" });
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const today    = new Date().toISOString().slice(0, 10);
      const dateFrom = (input.dateFrom as string | undefined) ?? today;
      const dateTo   = (input.dateTo   as string | undefined) ?? new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
      const limit    = (input.limit    as number | undefined) ?? 20;

      // Count scale allocations per member in the range
      const allocCounts = await db
        .select({ userId: scaleAllocationsTable.userId, count: sql<number>`count(*)::int` })
        .from(scaleAllocationsTable)
        .where(and(
          inArray(scaleAllocationsTable.status, ["ASSIGNED", "MANUAL_OVERRIDE"]),
          sql`${scaleAllocationsTable.manualDate} BETWEEN ${dateFrom} AND ${dateTo}`,
        ))
        .groupBy(scaleAllocationsTable.userId)
        .limit(limit);

      // Count pending tasks per member
      const taskCounts = await db
        .select({ assigneeId: tasksTable.assigneeId, count: sql<number>`count(*)::int` })
        .from(tasksTable)
        .where(and(
          eq(tasksTable.organizationId, ctx.organizationId),
          inArray(tasksTable.status, ["CREATED", "IN_PROGRESS", "CHANGES_REQUESTED"]),
        ))
        .groupBy(tasksTable.assigneeId)
        .limit(limit);

      const taskMap = new Map(taskCounts.map(t => [t.assigneeId, t.count]));
      const userIds = [...new Set(allocCounts.map(a => a.userId).filter(Boolean))] as string[];
      const userNames = userIds.length > 0
        ? await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(inArray(usersTable.id, userIds))
        : [];
      const nameMap = new Map(userNames.map(u => [u.id, u.name]));

      const carga = allocCounts
        .filter(a => a.userId)
        .map(a => ({
          membro:      nameMap.get(a.userId!) ?? a.userId,
          atividades:  a.count,
          tarefas_pendentes: taskMap.get(a.userId!) ?? 0,
          carga_total: a.count + (taskMap.get(a.userId!) ?? 0),
        }))
        .sort((a, b) => b.carga_total - a.carga_total);

      if (carga.length === 0) return JSON.stringify({ total: 0, message: "Nenhuma atividade registrada no período.", carga: [] });
      return JSON.stringify({
        total: carga.length,
        periodo: `${dateFrom} → ${dateTo}`,
        message: `Carga operacional de ${carga.length} membro(s) no período.`,
        carga,
      });
    }

    // ── registrar_ausencia (Sprint 05) ───────────────────────────────────────
    if (name === "registrar_ausencia") {
      if (!isManager) return JSON.stringify({ error: "Sem permissão para registrar ausências" });

      const displayName = (input.userName as string | undefined) ?? (input.userId as string);
      const fmt = (d: string) => d.split("-").reverse().join("/");

      try {
        const res = await coreRegistrarAusencia(ctx, {
          userId:    input.userId    as string,
          startDate: input.startDate as string | undefined,
          endDate:   input.endDate   as string | undefined,
          date:      input.date      as string | undefined,
          type:      input.type      as string | undefined,
          reason:    input.reason    as string | undefined,
        });
        const periodoLabel = res.isSingleDay
          ? `para ${fmt(res.startDate)}`
          : `de ${fmt(res.startDate)} até ${fmt(res.endDate)} (${res.type === "AFASTAMENTO" ? "afastamento" : (res.type ?? "ausência").toLowerCase()})`;
        return JSON.stringify({
          registered: true,
          id:         res.id,
          member:     displayName,
          startDate:  res.startDate,
          endDate:    res.endDate,
          type:       res.type,
          message:    `📋 ${res.isSingleDay ? "Ausência" : "Período"} de ${displayName} registrado ${periodoLabel}. Acompanhe na página de Folgas.`,
        });
      } catch (err) {
        return JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
      }
    }

    // ── criar_solicitacao_troca (Sprint 05) ──────────────────────────────────
    if (name === "criar_solicitacao_troca") {
      if (!isManager) return JSON.stringify({ error: "Sem permissão para criar solicitações de troca" });
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      if (!ctx.operationId) return JSON.stringify({ error: "Selecione uma operação antes de criar solicitações" });

      const n1   = input.userName1 as string;
      const n2   = input.userName2 as string;
      const date = input.date      as string;
      const notes = input.notes    as string | undefined;

      const [task] = await db.insert(tasksTable).values({
        organizationId: ctx.organizationId,
        operationId:    ctx.operationId,
        title:          `🔄 Troca de escala: ${n1} ↔ ${n2}`,
        description:    [
          `Solicitação de troca de escala detectada pela ASA.`,
          ``,
          `• Membros: ${n1} e ${n2}`,
          `• Data: ${date}`,
          notes ? `• Detalhes: ${notes}` : null,
          ``,
          `Verifique as escalas e confirme ou ajuste a troca conforme necessário.`,
        ].filter(Boolean).join("\n"),
        creatorId:      ctx.userId,
        assigneeId:     ctx.userId,
        dueDate:        date,
        status:         "CREATED",
        priority:       "MEDIUM",
        origin:         "MANUAL",
      }).returning();

      return JSON.stringify({
        created: true,
        id: task.id,
        members: [n1, n2],
        date,
        message: `🔄 Solicitação de troca entre ${n1} e ${n2} registrada para ${date}. Uma tarefa foi criada para acompanhamento — você pode gerenciá-la na página de Tarefas.`,
      });
    }

    // ── Sprint 12 — Operações em lote ─────────────────────────────────────────
    if (name === "criar_tarefas_lote") {
      if (!isManager) return JSON.stringify({ error: "Sem permissão para criar tarefas" });
      const tarefas = (input.tarefas as Array<Record<string, unknown>> | undefined) ?? [];
      if (tarefas.length === 0) return JSON.stringify({ error: "Nenhuma tarefa informada" });

      const results = await runBatch(
        tarefas,
        (t) => (t.assigneeName as string | undefined) ?? (t.title as string | undefined) ?? "tarefa",
        async (t) => {
          const r = await coreCriarTarefa(ctx, {
            title:       t.title       as string,
            description: t.description as string | undefined,
            assigneeId:  t.assigneeId  as string,
            dueDate:     t.dueDate     as string,
            priority:    t.priority    as string | undefined,
          });
          return { id: r.id };
        },
      );
      return JSON.stringify({ batch: true, tipo: "tarefas", ...summarizeBatch("tarefa(s) criada(s)", results) });
    }

    if (name === "registrar_ausencias_lote") {
      if (!isManager) return JSON.stringify({ error: "Sem permissão para registrar ausências" });
      const ausencias = (input.ausencias as Array<Record<string, unknown>> | undefined) ?? [];
      if (ausencias.length === 0) return JSON.stringify({ error: "Nenhuma ausência informada" });

      const results = await runBatch(
        ausencias,
        (a) => (a.userName as string | undefined) ?? (a.userId as string | undefined) ?? "membro",
        async (a) => {
          const r = await coreRegistrarAusencia(ctx, {
            userId:    a.userId    as string,
            startDate: a.startDate as string | undefined,
            endDate:   a.endDate   as string | undefined,
            date:      a.date      as string | undefined,
            type:      a.type      as string | undefined,
            reason:    a.reason    as string | undefined,
          });
          return { id: r.id };
        },
      );
      return JSON.stringify({ batch: true, tipo: "ausencias", ...summarizeBatch("ausência(s) registrada(s)", results) });
    }

    if (name === "criar_reconhecimentos_lote") {
      if (!isManager) return JSON.stringify({ error: "Sem permissão para criar reconhecimentos" });
      const reconhecimentos = (input.reconhecimentos as Array<Record<string, unknown>> | undefined) ?? [];
      if (reconhecimentos.length === 0) return JSON.stringify({ error: "Nenhum reconhecimento informado" });

      const results = await runBatch(
        reconhecimentos,
        (r) => (r.userName as string | undefined) ?? (r.userId as string | undefined) ?? "membro",
        async (r) => {
          const out = await coreCriarReconhecimento(ctx, {
            userId:  r.userId  as string,
            type:    r.type    as string,
            title:   r.title   as string,
            message: r.message as string,
          });
          return { id: out.id };
        },
      );
      return JSON.stringify({ batch: true, tipo: "reconhecimentos", ...summarizeBatch("reconhecimento(s) criado(s)", results) });
    }

    if (name === "criar_entradas_escala_lote") {
      if (!isManager) return JSON.stringify({ error: "Sem permissão para criar entradas na escala" });
      const entradas = (input.entradas as Array<Record<string, unknown>> | undefined) ?? [];
      if (entradas.length === 0) return JSON.stringify({ error: "Nenhuma entrada informada" });

      const results = await runBatch(
        entradas,
        (e) => (e.userName as string | undefined) ?? (e.userId as string | undefined) ?? "membro",
        async (e) => {
          const r = await coreCriarEntradaEscala(ctx, {
            userId:    e.userId    as string,
            userName:  e.userName  as string | undefined,
            date:      e.date      as string,
            label:     e.label     as string,
            startTime: e.startTime as string | undefined,
            endTime:   e.endTime   as string | undefined,
            notes:     e.notes     as string | undefined,
          });
          return { id: r.id, warning: r.warning };
        },
      );
      return JSON.stringify({ batch: true, tipo: "entradas_escala", ...summarizeBatch("entrada(s) criada(s)", results) });
    }

    if (name === "adicionar_participantes_evento") {
      if (!isManager) return JSON.stringify({ error: "Sem permissão para adicionar participantes" });
      if (!ctx.operationId) return JSON.stringify({ error: "Operação não configurada" });
      const participantes = (input.participantes as Array<Record<string, unknown>> | undefined) ?? [];
      if (participantes.length === 0) return JSON.stringify({ error: "Nenhum participante informado" });

      const eventId      = input.eventId      as string | undefined;
      const eventoTitulo = input.eventoTitulo as string | undefined;
      const dataInput    = input.data         as string | undefined;

      // Localiza o evento por id, ou por título + data
      let event: { id: string; title: string; startTime: Date | string | null } | undefined;
      if (eventId) {
        const [ev] = await db
          .select({ id: agendaEventsTable.id, title: agendaEventsTable.title, startTime: agendaEventsTable.startTime })
          .from(agendaEventsTable)
          .where(and(
            eq(agendaEventsTable.id, eventId),
            ctx.operationId ? eq(agendaEventsTable.operationId, ctx.operationId) : sql`true`,
          ))
          .limit(1);
        event = ev;
      } else if (eventoTitulo) {
        const candidates = await db
          .select({ id: agendaEventsTable.id, title: agendaEventsTable.title, startTime: agendaEventsTable.startTime })
          .from(agendaEventsTable)
          .where(ctx.operationId ? eq(agendaEventsTable.operationId, ctx.operationId) : sql`true`)
          .orderBy(agendaEventsTable.startTime)
          .limit(50);
        const normTitle = normalizeName(eventoTitulo);
        event = candidates.find((c) => {
          const matchTitle = normalizeName(c.title).includes(normTitle) || normTitle.includes(normalizeName(c.title));
          const matchDate = dataInput
            ? (c.startTime ? new Date(c.startTime).toISOString().slice(0, 10) === dataInput : false)
            : true;
          return matchTitle && matchDate;
        });
      }

      if (!event) {
        return JSON.stringify({ error: "Evento não encontrado. Use consultar_agenda para obter o eventId, ou informe eventoTitulo + data." });
      }

      const eventDate = dataInput
        ?? (event.startTime ? new Date(event.startTime).toISOString().slice(0, 10) : undefined);
      if (!eventDate) {
        return JSON.stringify({ error: "Não foi possível determinar a data do evento. Informe a data (YYYY-MM-DD)." });
      }

      const results = await runBatch(
        participantes,
        (p) => (p.userName as string | undefined) ?? (p.userId as string | undefined) ?? "membro",
        async (p) => {
          const r = await coreCriarEntradaEscala(ctx, {
            userId:        p.userId   as string,
            userName:      p.userName as string | undefined,
            date:          eventDate,
            label:         event!.title,
            agendaEventId: event!.id,
          });
          return { id: r.id, warning: r.warning };
        },
      );
      const summary = summarizeBatch("participante(s) adicionado(s)", results);
      return JSON.stringify({
        batch: true,
        tipo: "participantes_evento",
        evento: { id: event.id, titulo: event.title, data: eventDate },
        ...summary,
        message: `Evento "${event.title}" (${eventDate}):\n${summary.message}`,
      });
    }

    if (name === "desfazer_lote") {
      if (!isManager) return JSON.stringify({ error: "Sem permissão para desfazer operações em lote" });
      const tipoRaw = (input.tipo as string | undefined) ?? "";
      const tipo = tipoRaw.toLowerCase().trim();
      const ids = ((input.ids as unknown[] | undefined) ?? []).map((v) => String(v)).filter(Boolean);
      if (ids.length === 0) return JSON.stringify({ error: "Nenhum ID informado para desfazer" });

      const undoers: Record<string, (id: string) => Promise<{ id?: string }>> = {
        tarefas:              (id) => coreCancelarTarefa(ctx, id),
        tarefa:               (id) => coreCancelarTarefa(ctx, id),
        ausencias:            (id) => coreCancelarAusencia(ctx, id),
        ausencia:             (id) => coreCancelarAusencia(ctx, id),
        reconhecimentos:      (id) => coreRemoverReconhecimento(ctx, id),
        reconhecimento:       (id) => coreRemoverReconhecimento(ctx, id),
        entradas_escala:      (id) => coreRemoverEntradaEscala(ctx, id),
        entrada_escala:       (id) => coreRemoverEntradaEscala(ctx, id),
        participantes_evento: (id) => coreRemoverEntradaEscala(ctx, id),
        participante_evento:  (id) => coreRemoverEntradaEscala(ctx, id),
      };
      const undoer = undoers[tipo];
      if (!undoer) return JSON.stringify({ error: `Tipo de lote desconhecido para desfazer: "${tipoRaw}". Use tarefas | ausencias | reconhecimentos | entradas_escala | participantes_evento.` });

      const results = await runBatch(
        ids,
        (id) => id,
        async (id) => {
          const r = await undoer(id);
          return { id: r.id };
        },
      );
      return JSON.stringify({ batch: true, desfazer: true, tipo, ...summarizeBatch("item(ns) desfeito(s)", results) });
    }

    // ── Edição de entidades por conversa ──────────────────────────────────────
    if (name === "editar_tarefa") {
      if (!isManager) return JSON.stringify({ error: "Apenas gestores podem editar tarefas" });
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const taskId = input.taskId as string;
      const [existing] = await db
        .select({ id: tasksTable.id, status: tasksTable.status, title: tasksTable.title, description: tasksTable.description, assigneeId: tasksTable.assigneeId, dueDate: tasksTable.dueDate, priority: tasksTable.priority })
        .from(tasksTable)
        .where(and(eq(tasksTable.id, taskId), eq(tasksTable.organizationId, ctx.organizationId)))
        .limit(1);
      if (!existing) return JSON.stringify({ success: false, message: "Tarefa não encontrada. Use consultar_tarefas para obter o ID." });
      if (["APPROVED", "COMPLETED", "CANCELLED"].includes(existing.status))
        return JSON.stringify({ success: false, message: `Tarefa com status "${existing.status}" não pode ser editada (encerrada).` });

      const updates: Partial<typeof tasksTable.$inferInsert> = {};
      const before: Record<string, unknown> = {};
      const after: Record<string, unknown> = {};
      if (input.title !== undefined) { before.title = existing.title; after.title = input.title; updates.title = input.title as string; }
      if (input.description !== undefined) { before.description = existing.description; after.description = input.description; updates.description = input.description as string; }
      if (input.assigneeId !== undefined) { before.assigneeId = existing.assigneeId; after.assigneeId = input.assigneeId; updates.assigneeId = input.assigneeId as string; }
      if (input.dueDate !== undefined) { before.dueDate = existing.dueDate; after.dueDate = input.dueDate; updates.dueDate = input.dueDate as string; }
      if (input.priority !== undefined) { before.priority = existing.priority; after.priority = input.priority; updates.priority = input.priority as typeof existing.priority; }
      if (Object.keys(updates).length === 0) return JSON.stringify({ success: false, message: "Nenhum campo para alterar foi informado." });

      updates.updatedAt = new Date();
      await db.update(tasksTable).set(updates).where(eq(tasksTable.id, taskId));
      return JSON.stringify({ success: true, id: taskId, antes: before, depois: after, message: `✅ Tarefa "${existing.title}" atualizada com sucesso.` });
    }

    if (name === "editar_ausencia") {
      if (!isManager) return JSON.stringify({ error: "Apenas gestores podem editar ausências" });
      const folgaId = input.folgaId as string;
      const [existing] = await db
        .select({ id: folgasTable.id, status: folgasTable.status, startDate: folgasTable.startDate, endDate: folgasTable.endDate, type: folgasTable.type, notes: folgasTable.notes })
        .from(folgasTable)
        .where(eq(folgasTable.id, folgaId))
        .limit(1);
      if (!existing) return JSON.stringify({ success: false, message: "Ausência não encontrada. Use consultar_folgas para obter o ID." });
      if (existing.status === "CANCELLED") return JSON.stringify({ success: false, message: "Esta ausência está cancelada e não pode ser editada." });

      const updates: Partial<typeof folgasTable.$inferInsert> = {};
      const before: Record<string, unknown> = {};
      const after: Record<string, unknown> = {};
      if (input.startDate !== undefined) { before.startDate = existing.startDate; after.startDate = input.startDate; updates.startDate = input.startDate as string; }
      if (input.endDate !== undefined) { before.endDate = existing.endDate; after.endDate = input.endDate; updates.endDate = input.endDate as string; }
      if (input.type !== undefined) { before.type = existing.type; after.type = input.type; updates.type = input.type as typeof existing.type; }
      if (input.reason !== undefined) { before.notes = existing.notes; after.notes = input.reason; updates.notes = input.reason as string; }
      if (Object.keys(updates).length === 0) return JSON.stringify({ success: false, message: "Nenhum campo para alterar foi informado." });

      // Coerência: se só startDate mudou e a folga era de um dia, alinha endDate
      if (updates.startDate !== undefined && updates.endDate === undefined && existing.startDate === existing.endDate) {
        updates.endDate = updates.startDate;
        after.endDate = updates.startDate;
      }
      updates.updatedAt = new Date();
      await db.update(folgasTable).set(updates).where(eq(folgasTable.id, folgaId));
      return JSON.stringify({ success: true, id: folgaId, antes: before, depois: after, message: `✅ Ausência atualizada com sucesso.` });
    }

    if (name === "editar_evento_agenda") {
      if (!isManager) return JSON.stringify({ error: "Apenas gestores podem editar eventos da agenda" });
      const eventId = input.eventId as string;
      const [existing] = await db
        .select({ id: agendaEventsTable.id, status: agendaEventsTable.status, title: agendaEventsTable.title, date: agendaEventsTable.date, endDate: agendaEventsTable.endDate, startTime: agendaEventsTable.startTime, endTime: agendaEventsTable.endTime, location: agendaEventsTable.location, notes: agendaEventsTable.notes })
        .from(agendaEventsTable)
        .where(and(
          eq(agendaEventsTable.id, eventId),
          ctx.operationId ? eq(agendaEventsTable.operationId, ctx.operationId) : sql`true`,
        ))
        .limit(1);
      if (!existing) return JSON.stringify({ success: false, message: "Evento não encontrado. Use consultar_agenda para obter o ID." });
      if (["CANCELLED", "COMPLETED"].includes(existing.status))
        return JSON.stringify({ success: false, message: `Evento com status "${existing.status}" não pode ser editado.` });

      const updates: Partial<typeof agendaEventsTable.$inferInsert> = {};
      const before: Record<string, unknown> = {};
      const after: Record<string, unknown> = {};
      if (input.titulo !== undefined) { before.titulo = existing.title; after.titulo = input.titulo; updates.title = input.titulo as string; }
      if (input.data !== undefined) { before.data = existing.date; after.data = input.data; updates.date = input.data as string; }
      if (input.dataFim !== undefined) { before.dataFim = existing.endDate; after.dataFim = input.dataFim; updates.endDate = input.dataFim as string; }
      if (input.horaInicio !== undefined) { before.horaInicio = existing.startTime; after.horaInicio = input.horaInicio; updates.startTime = input.horaInicio as string; }
      if (input.horaFim !== undefined) { before.horaFim = existing.endTime; after.horaFim = input.horaFim; updates.endTime = input.horaFim as string; }
      if (input.local !== undefined) { before.local = existing.location; after.local = input.local; updates.location = input.local as string; }
      if (input.descricao !== undefined) { before.descricao = existing.notes; after.descricao = input.descricao; updates.notes = input.descricao as string; }
      if (Object.keys(updates).length === 0) return JSON.stringify({ success: false, message: "Nenhum campo para alterar foi informado." });

      updates.updatedAt = new Date();
      await db.update(agendaEventsTable).set(updates).where(eq(agendaEventsTable.id, eventId));
      return JSON.stringify({ success: true, id: eventId, antes: before, depois: after, message: `✅ Evento "${existing.title}" atualizado com sucesso.` });
    }

    if (name === "editar_aviso") {
      if (!isManager) return JSON.stringify({ error: "Apenas gestores podem editar avisos" });
      const noticeId = input.noticeId as string;
      const [existing] = await db
        .select({ id: noticesTable.id, status: noticesTable.status, title: noticesTable.title, content: noticesTable.content, type: noticesTable.type, urgency: noticesTable.urgency, requiresConfirmation: noticesTable.requiresConfirmation })
        .from(noticesTable)
        .where(and(
          eq(noticesTable.id, noticeId),
          ctx.operationId ? eq(noticesTable.operationId, ctx.operationId) : sql`true`,
        ))
        .limit(1);
      if (!existing) return JSON.stringify({ success: false, message: "Aviso não encontrado. Use consultar_avisos para obter o ID." });
      if (existing.status !== "DRAFT")
        return JSON.stringify({ success: false, message: `Apenas avisos em rascunho podem ser editados. Este aviso está com status "${existing.status}".` });

      const updates: Partial<typeof noticesTable.$inferInsert> = {};
      const before: Record<string, unknown> = {};
      const after: Record<string, unknown> = {};
      if (input.title !== undefined) { before.title = existing.title; after.title = input.title; updates.title = input.title as string; }
      if (input.content !== undefined) { before.content = existing.content; after.content = input.content; updates.content = input.content as string; }
      if (input.type !== undefined) { before.type = existing.type; after.type = input.type; updates.type = input.type as typeof existing.type; }
      if (input.urgency !== undefined) { before.urgency = existing.urgency; after.urgency = input.urgency; updates.urgency = input.urgency as typeof existing.urgency; }
      if (input.requiresConfirmation !== undefined) { before.requiresConfirmation = existing.requiresConfirmation; after.requiresConfirmation = input.requiresConfirmation; updates.requiresConfirmation = input.requiresConfirmation as boolean; }
      if (Object.keys(updates).length === 0) return JSON.stringify({ success: false, message: "Nenhum campo para alterar foi informado." });

      await db.update(noticesTable).set(updates).where(eq(noticesTable.id, noticeId));
      return JSON.stringify({ success: true, id: noticeId, antes: before, depois: after, message: `✅ Aviso "${existing.title ?? "(sem título)"}" (rascunho) atualizado com sucesso.` });
    }

    if (name === "editar_reconhecimento") {
      if (!isManager) return JSON.stringify({ error: "Apenas gestores podem editar reconhecimentos" });
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      const recognitionId = input.recognitionId as string;
      const [existing] = await db
        .select({ id: recognitionsTable.id, type: recognitionsTable.type, title: recognitionsTable.title, message: recognitionsTable.message })
        .from(recognitionsTable)
        .where(and(eq(recognitionsTable.id, recognitionId), eq(recognitionsTable.organizationId, ctx.organizationId)))
        .limit(1);
      if (!existing) return JSON.stringify({ success: false, message: "Reconhecimento não encontrado. Use consultar_reconhecimentos para obter o ID." });

      const updates: Partial<typeof recognitionsTable.$inferInsert> = {};
      const before: Record<string, unknown> = {};
      const after: Record<string, unknown> = {};
      if (input.type !== undefined) { before.type = existing.type; after.type = input.type; updates.type = input.type as string; }
      if (input.title !== undefined) { before.title = existing.title; after.title = input.title; updates.title = input.title as string; }
      if (input.message !== undefined) { before.message = existing.message; after.message = input.message; updates.message = input.message as string; }
      if (Object.keys(updates).length === 0) return JSON.stringify({ success: false, message: "Nenhum campo para alterar foi informado." });

      updates.updatedAt = new Date();
      await db.update(recognitionsTable).set(updates).where(eq(recognitionsTable.id, recognitionId));
      return JSON.stringify({ success: true, id: recognitionId, antes: before, depois: after, message: `🎉 Reconhecimento "${existing.title}" atualizado com sucesso.` });
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
  const conversationId = parseInt(req.params["conversationId"] as string);
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

  // Fetch org name + user's operation in parallel
  const [orgRow, opRow] = await Promise.all([
    user.organizationId
      ? db.select({ name: organizationsTable.name })
          .from(organizationsTable)
          .where(eq(organizationsTable.id, user.organizationId))
          .limit(1)
          .then(r => r[0] ?? null)
      : Promise.resolve(null),
    user.organizationId
      ? db.select({ id: operationsTable.id, name: operationsTable.name })
          .from(operationsTable)
          .innerJoin(userRolesTable, eq(userRolesTable.operationId, operationsTable.id))
          .where(and(
            eq(userRolesTable.userId, user.sub),
            eq(userRolesTable.active, true),
          ))
          .limit(1)
          .then(r => r[0] ?? null)
      : Promise.resolve(null),
  ]);

  let operationId: string | null = opRow?.id ?? null;
  let operationName: string | null = opRow?.name ?? null;

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
    orgName: orgRow?.name ?? "Organização",
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

          if (toolUse.name === "consultar_clima") {
            try {
              const parsed = JSON.parse(result) as { weatherCode?: number; temp?: number };
              res.write(`data: ${JSON.stringify({ toolResult: { name: toolUse.name, weatherCode: parsed.weatherCode, temp: parsed.temp } })}\n\n`);
            } catch {}
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
  const id = req.params["id"] as string;
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
    .set(updates as any)
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
  const id = req.params["id"] as string;

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
    goodMorningTime?: string;
    goodNightTime?: string;
    messageFrequency?: "DAILY" | "WEEKLY" | "REALTIME";
    proactivityLevel?: "LOW" | "MEDIUM" | "HIGH";
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
// Mural da Equipe REST Endpoint
// ────────────────────────────────────────────────────────────────────────────

router.get("/asa/mural", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  const user   = req.user!;
  const orgId  = user.organizationId!;
  const today  = new Date();
  const mm     = String(today.getMonth() + 1).padStart(2, "0");
  const dd     = String(today.getDate()).padStart(2, "0");

  // Upcoming birthdays (next 30 days) from usersTable.birthDate
  const upcoming_birthdays: { name: string; date: string; daysUntil: number }[] = [];
  const allUsers = await db
    .select({ id: usersTable.id, name: usersTable.name, birthDate: usersTable.birthDate, createdAt: usersTable.createdAt })
    .from(usersTable)
    .where(and(eq(usersTable.organizationId, orgId), eq(usersTable.status, "ACTIVE")))
    .limit(200);

  for (const u of allUsers) {
    if (!u.birthDate) continue;
    const bm = u.birthDate.slice(5, 7); const bd = u.birthDate.slice(8, 10);
    // Check next 30 days
    for (let offset = 0; offset <= 30; offset++) {
      const d = new Date(today); d.setDate(d.getDate() + offset);
      const cm = String(d.getMonth() + 1).padStart(2, "0");
      const cd = String(d.getDate()).padStart(2, "0");
      if (bm === cm && bd === cd) {
        upcoming_birthdays.push({ name: u.name, date: `${cd}/${cm}`, daysUntil: offset });
        break;
      }
    }
  }
  upcoming_birthdays.sort((a, b) => a.daysUntil - b.daysUntil);

  // Upcoming time-of-house milestones (next 30 days)
  const MILESTONE_MONTHS = [3, 6, 12, 24, 60, 120];
  const upcoming_milestones: { name: string; label: string; date: string; daysUntil: number }[] = [];
  for (const u of allUsers) {
    const joined = new Date(u.createdAt);
    for (let offset = 0; offset <= 30; offset++) {
      const d = new Date(today); d.setDate(d.getDate() + offset);
      if (joined.getDate() !== d.getDate() || joined.getMonth() !== d.getMonth()) continue;
      const totalMonths = (d.getFullYear() - joined.getFullYear()) * 12 + (d.getMonth() - joined.getMonth());
      if (MILESTONE_MONTHS.includes(totalMonths)) {
        const label = totalMonths < 12
          ? `${totalMonths} meses na equipe`
          : `${totalMonths / 12} ano${totalMonths / 12 > 1 ? "s" : ""} na equipe`;
        upcoming_milestones.push({ name: u.name, label, date: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`, daysUntil: offset });
      }
    }
  }
  upcoming_milestones.sort((a, b) => a.daysUntil - b.daysUntil);

  // Recent recognitions (last 15)
  const recent_recognitions = await db
    .select({
      id:          recognitionsTable.id,
      type:        recognitionsTable.type,
      title:       recognitionsTable.title,
      message:     recognitionsTable.message,
      publishedAt: recognitionsTable.publishedAt,
      memberName:  usersTable.name,
    })
    .from(recognitionsTable)
    .leftJoin(usersTable, eq(recognitionsTable.userId, usersTable.id))
    .where(eq(recognitionsTable.organizationId, orgId))
    .orderBy(desc(recognitionsTable.createdAt))
    .limit(15);

  // Recent published notices (last 8, across all operations of the org)
  const recentNoticesAlias = usersTable;
  const recent_notices = await db
    .select({
      id:          noticesTable.id,
      title:       noticesTable.title,
      content:     noticesTable.content,
      urgency:     noticesTable.urgency,
      publishedAt: noticesTable.publishedAt,
      authorName:  recentNoticesAlias.name,
    })
    .from(noticesTable)
    .innerJoin(operationsTable, eq(noticesTable.operationId, operationsTable.id))
    .leftJoin(recentNoticesAlias, eq(noticesTable.authorId, recentNoticesAlias.id))
    .where(and(
      eq(operationsTable.organizationId, orgId),
      eq(noticesTable.status, "PUBLISHED"),
    ))
    .orderBy(desc(noticesTable.publishedAt))
    .limit(8);

  // Members with overdue tasks (status pending + dueDate in the past)
  const todayStr = `${today.getFullYear()}-${mm}-${dd}`;
  const overdueRows = await db
    .select({
      assigneeId: tasksTable.assigneeId,
      name:       usersTable.name,
      status:     tasksTable.status,
      dueDate:    tasksTable.dueDate,
    })
    .from(tasksTable)
    .innerJoin(usersTable, eq(tasksTable.assigneeId, usersTable.id))
    .where(eq(tasksTable.organizationId, orgId))
    .limit(500);

  const overdueCounts = new Map<string, { name: string; count: number }>();
  for (const t of overdueRows) {
    if (!["CREATED", "IN_PROGRESS", "CHANGES_REQUESTED"].includes(t.status)) continue;
    if (!(t.dueDate < todayStr)) continue;
    const entry = overdueCounts.get(t.assigneeId) ?? { name: t.name, count: 0 };
    entry.count += 1;
    overdueCounts.set(t.assigneeId, entry);
  }
  const overdue_members = [...overdueCounts.values()].sort((a, b) => b.count - a.count);

  res.json({ upcoming_birthdays, upcoming_milestones, recent_recognitions, recent_notices, overdue_members });
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
  const resumo = await assembleResumoDodia(user.sub, user.organizationId ?? null, operationId, user.role);
  res.json(resumo);
});

// ────────────────────────────────────────────────────────────────────────────
// Recognitions REST Endpoints
// ────────────────────────────────────────────────────────────────────────────

router.get("/asa/recognitions", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  const user = req.user!;
  const limit = parseInt(String(req.query.limit ?? "50"));
  const userId = req.query.userId as string | undefined;

  const conditions: ReturnType<typeof eq>[] = [eq(recognitionsTable.organizationId, user.organizationId!)];
  if (userId) conditions.push(eq(recognitionsTable.userId, userId));

  const recs = await db
    .select()
    .from(recognitionsTable)
    .where(and(...conditions))
    .orderBy(desc(recognitionsTable.createdAt))
    .limit(limit);

  res.json({ recognitions: recs });
});

router.post("/asa/recognitions", requireAuth, requireOrganization, async (req, res): Promise<void> => {
  const user = req.user!;

  if (!MANAGER_ROLES.includes(user.role)) {
    res.status(403).json({ error: "Apenas gestores podem criar reconhecimentos" });
    return;
  }

  const { userId, type, title, message } = req.body as { userId: string; type: string; title: string; message: string };
  if (!userId || !type || !title || !message) {
    res.status(400).json({ error: "BAD_REQUEST", message: "userId, type, title e message são obrigatórios" });
    return;
  }

  const [postTarget] = await db.select({ id: usersTable.id }).from(usersTable)
    .where(and(eq(usersTable.id, userId), eq(usersTable.organizationId, user.organizationId!)))
    .limit(1);
  if (!postTarget) {
    res.status(404).json({ error: "NOT_FOUND", message: "Membro não encontrado nesta organização" });
    return;
  }

  const [rec] = await db.insert(recognitionsTable).values({
    organizationId: user.organizationId!,
    userId,
    type,
    title,
    message,
    createdBy: user.sub,
    publishedAt: new Date(),
  }).returning();

  try {
    await createNotification({
      userId,
      type:       "RECOGNITION_RECEIVED",
      title:      "🎉 Você recebeu um reconhecimento!",
      message:    title,
      priority:   "IMPORTANT",
      category:   "system",
      entityType: "recognition",
      entityId:   rec.id,
    });
  } catch (err) { console.error("Falha ao notificar reconhecimento", { targetUserId: userId, recognitionId: rec.id, err }); }

  res.status(201).json({ recognition: rec });
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
