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
        eq(folgasTable.organizationId, organizationId),
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
• Gerar resumo personalizado do dia com análise operacional
• Consultar aniversários e detectar marcos de tempo de casa
• Criar e consultar reconhecimentos para membros da equipe
• Consultar o clima atual
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
    description: "Registra uma ausência (no-show) de um membro em uma data específica. Use consultar_membros ANTES para obter o userId correto. Confirme com o usuário antes de executar.",
    input_schema: {
      type: "object" as const,
      required: ["userId", "date"],
      properties: {
        userId:   { type: "string", description: "ID do membro ausente (obtido via consultar_membros)" },
        userName: { type: "string", description: "Nome do membro (para confirmação na resposta)" },
        date:     { type: "string", description: "Data da ausência (YYYY-MM-DD)" },
        type:     { type: "string", description: "Tipo: NO_SHOW (padrão) | DAY_OFF | OUTRO" },
        reason:   { type: "string", description: "Motivo da ausência (opcional)" },
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
          inArray(scaleAllocationsTable.status, ["ASSIGNED", "CONFIRMED", "MANUAL_OVERRIDE"]),
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
      const recUserId = input.userId as string;
      const recType   = input.type    as string;
      const recTitle  = input.title   as string;
      const recMsg    = input.message as string;
      if (!recUserId || !recType || !recTitle || !recMsg)
        return JSON.stringify({ error: "userId, type, title e message são obrigatórios" });
      const [rec] = await db.insert(recognitionsTable).values({
        organizationId: ctx.organizationId,
        userId:         recUserId,
        type:           recType,
        title:          recTitle,
        message:        recMsg,
        createdBy:      ctx.userId,
        publishedAt:    new Date(),
      }).returning();
      return JSON.stringify({
        created: true,
        id: rec.id,
        message: `🎉 Reconhecimento "${recTitle}" criado com sucesso!`,
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
          temp: Math.round(temp), description, emoji,
          wind: Math.round(wind), precipitation: Math.round(precipitation * 10) / 10,
          rainChancePercent: Math.round(rainChance), advice,
          message: `${emoji} ${Math.round(temp)}°C — ${description}. Vento ${Math.round(wind)} km/h.${rainChance > 30 ? ` Chance de chuva: ${Math.round(rainChance)}%.` : ""} ${advice}`.trim(),
        });
      } catch {
        return JSON.stringify({ error: "Não foi possível consultar o clima agora." });
      }
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
          inArray(scaleAllocationsTable.status, ["ASSIGNED", "CONFIRMED", "MANUAL_OVERRIDE"]),
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
        .where(and(inArray(scaleAllocationsTable.status, ["ASSIGNED", "CONFIRMED", "MANUAL_OVERRIDE"]), sql`${scaleAllocationsTable.manualDate} between ${from} and ${to}`))
        .groupBy(scaleAllocationsTable.userId)
        .orderBy(desc(sql`count(*)`))
        .limit(3);

      // Most absences
      const topAbsence = await db
        .select({ userId: folgasTable.userId, count: sql<number>`count(*)::int` })
        .from(folgasTable)
        .where(and(ctx.operationId ? eq(folgasTable.operationId, ctx.operationId) : sql`true`, eq(folgasTable.status, "ACTIVE"), lte(folgasTable.startDate, to), gte(folgasTable.endDate, from)))
        .groupBy(folgasTable.userId)
        .orderBy(desc(sql`count(*)`))
        .limit(3);

      // Task completion
      const [totalTasks] = await db.select({ count: sql<number>`count(*)::int` }).from(tasksTable).where(and(eq(tasksTable.organizationId, ctx.organizationId), sql`date(created_at) between ${from} and ${to}`));
      const [doneTasks]  = await db.select({ count: sql<number>`count(*)::int` }).from(tasksTable).where(and(eq(tasksTable.organizationId, ctx.organizationId), eq(tasksTable.status, "DONE"), sql`date(updated_at) between ${from} and ${to}`));
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
        ? and(eq(scaleAllocationsTable.userId, uid), inArray(scaleAllocationsTable.status, ["ASSIGNED", "CONFIRMED", "MANUAL_OVERRIDE"]), sql`${scaleAllocationsTable.manualDate} between ${from} and ${to}`)
        : and(inArray(scaleAllocationsTable.status, ["ASSIGNED", "CONFIRMED", "MANUAL_OVERRIDE"]), sql`${scaleAllocationsTable.manualDate} between ${from} and ${to}`);
      const allocByMember = await db
        .select({ userId: scaleAllocationsTable.userId, atividades: sql<number>`count(*)::int` })
        .from(scaleAllocationsTable)
        .where(actFilter)
        .groupBy(scaleAllocationsTable.userId)
        .orderBy(desc(sql`count(*)`))
        .limit(limit);

      const doneTskFilter = uid
        ? and(eq(tasksTable.organizationId, ctx.organizationId), eq(tasksTable.assigneeId, uid), eq(tasksTable.status, "DONE"), sql`date(updated_at) between ${from} and ${to}`)
        : and(eq(tasksTable.organizationId, ctx.organizationId), eq(tasksTable.status, "DONE"), sql`date(updated_at) between ${from} and ${to}`);
      const doneByMember = await db
        .select({ assigneeId: tasksTable.assigneeId, concluidas: sql<number>`count(*)::int` })
        .from(tasksTable).where(doneTskFilter).groupBy(tasksTable.assigneeId).limit(limit);
      const doneMap = new Map(doneByMember.map(t => [t.assigneeId, t.concluidas]));

      const delayedByMember = await db
        .select({ assigneeId: tasksTable.assigneeId, atrasadas: sql<number>`count(*)::int` })
        .from(tasksTable)
        .where(and(eq(tasksTable.organizationId, ctx.organizationId), uid ? eq(tasksTable.assigneeId, uid) : sql`true`, inArray(tasksTable.status, ["CREATED", "IN_PROGRESS"]), sql`${tasksTable.dueDate} < ${today09}`))
        .groupBy(tasksTable.assigneeId).limit(limit);
      const delayMap = new Map(delayedByMember.map(t => [t.assigneeId, t.atrasadas]));

      const absFilter = uid
        ? and(eq(folgasTable.userId, uid), eq(folgasTable.status, "ACTIVE"), lte(folgasTable.startDate, to), gte(folgasTable.endDate, from))
        : and(ctx.operationId ? eq(folgasTable.operationId, ctx.operationId) : sql`true`, eq(folgasTable.status, "ACTIVE"), lte(folgasTable.startDate, to), gte(folgasTable.endDate, from));
      const absByMember = await db
        .select({ userId: folgasTable.userId, ausencias: sql<number>`count(*)::int` })
        .from(folgasTable).where(absFilter).groupBy(folgasTable.userId).limit(limit);
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
        .where(and(inArray(scaleAllocationsTable.status, ["ASSIGNED", "CONFIRMED", "MANUAL_OVERRIDE"]), sql`${scaleAllocationsTable.manualDate} between ${from} and ${to}`))
        .groupBy(scaleAllocationsTable.userId, usersTable.name)
        .orderBy(desc(sql`count(*)`))
        .limit(limit);

      const [avgRow] = await db
        .select({ media: sql<number>`avg(cnt)::numeric(6,1)` })
        .from(
          db.select({ userId: scaleAllocationsTable.userId, cnt: sql<number>`count(*)` })
            .from(scaleAllocationsTable)
            .where(and(inArray(scaleAllocationsTable.status, ["ASSIGNED", "CONFIRMED", "MANUAL_OVERRIDE"]), sql`${scaleAllocationsTable.manualDate} between ${from} and ${to}`))
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
        "🌴 AUSÊNCIA": "Confirme o membro e a data, depois ofereça registrar_ausencia.",
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
        ? and(eq(scaleAllocationsTable.userId, input.userId as string), inArray(scaleAllocationsTable.status, ["ASSIGNED", "CONFIRMED", "MANUAL_OVERRIDE"]))
        : inArray(scaleAllocationsTable.status, ["ASSIGNED", "CONFIRMED", "MANUAL_OVERRIDE"]);
      const allocCounts = await db
        .select({ userId: scaleAllocationsTable.userId, count: sql<number>`count(*)::int` })
        .from(scaleAllocationsTable)
        .where(allocFilter)
        .groupBy(scaleAllocationsTable.userId)
        .limit(limit);

      // Completed tasks count per user
      const taskFilter = input.userId
        ? and(eq(tasksTable.organizationId, ctx.organizationId), eq(tasksTable.assigneeId, input.userId as string), eq(tasksTable.status, "DONE"))
        : and(eq(tasksTable.organizationId, ctx.organizationId), eq(tasksTable.status, "DONE"));
      const taskCounts = await db
        .select({ assigneeId: tasksTable.assigneeId, count: sql<number>`count(*)::int` })
        .from(tasksTable)
        .where(taskFilter)
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

      const [rec] = await db.insert(recognitionsTable).values({
        organizationId: ctx.organizationId,
        userId:         recUserId,
        type:           `AUTO_${triggerType}`,
        title,
        message,
        createdBy:      ctx.userId,
        publishedAt:    new Date(),
      }).returning();

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
        .where(and(eq(scaleAllocationsTable.userId, memberId), inArray(scaleAllocationsTable.status, ["ASSIGNED", "CONFIRMED", "MANUAL_OVERRIDE"])));

      const [tasksDone] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(tasksTable)
        .where(and(eq(tasksTable.assigneeId, memberId), eq(tasksTable.organizationId, ctx.organizationId), eq(tasksTable.status, "DONE")));

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
            inArray(scaleAllocationsTable.status, ["ASSIGNED", "CONFIRMED", "MANUAL_OVERRIDE"]),
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
          positionName: scaleAllocationsTable.positionName,
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
          atividade: r.positionName ?? r.manualLabel ?? "—",
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
            inArray(scaleAllocationsTable.status, ["ASSIGNED", "CONFIRMED", "MANUAL_OVERRIDE"]),
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
        : eq(userRolesTable.organizationId, ctx.organizationId);

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
          inArray(scaleAllocationsTable.status, ["ASSIGNED", "CONFIRMED", "MANUAL_OVERRIDE"]),
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
            inArray(scaleAllocationsTable.status, ["ASSIGNED", "CONFIRMED", "MANUAL_OVERRIDE"]),
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
        data,
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
          inArray(scaleAllocationsTable.status, ["ASSIGNED", "CONFIRMED", "MANUAL_OVERRIDE"]),
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
      if (!ctx.organizationId) return JSON.stringify({ error: "Organização não configurada" });
      if (!ctx.operationId) return JSON.stringify({ error: "Selecione uma operação antes de registrar ausências" });

      const targetUserId = input.userId as string;
      const date         = input.date   as string;
      const absType      = ((input.type as string | undefined) ?? "NO_SHOW") as "NO_SHOW" | "DAY_OFF" | "OUTRO";
      const reason       = input.reason as string | undefined;
      const displayName  = (input.userName as string | undefined) ?? targetUserId;

      const [folga] = await db.insert(folgasTable).values({
        userId:      targetUserId,
        operationId: ctx.operationId,
        type:        absType,
        startDate:   date,
        endDate:     date,
        status:      "ACTIVE",
        origem:      "MANUAL",
        createdBy:   ctx.userId,
        notes:       reason ?? `Ausência registrada pela ASA em ${new Date().toLocaleDateString("pt-BR")}`,
      }).returning();

      return JSON.stringify({
        registered: true,
        id: folga.id,
        member: displayName,
        date,
        type: absType,
        message: `📋 Ausência de ${displayName} registrada para ${date}. Você pode acompanhar na página de Folgas.`,
      });
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

  res.json({ upcoming_birthdays, upcoming_milestones, recent_recognitions });
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

  const [rec] = await db.insert(recognitionsTable).values({
    organizationId: user.organizationId!,
    userId,
    type,
    title,
    message,
    createdBy: user.sub,
    publishedAt: new Date(),
  }).returning();

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
