# MSG-D01 — Mensagens, Avisos, Notificações e IA
## Especificação Oficial de Comunicação do MyASA

**Versão:** 1.1  
**Data:** 2026-06-19  
**Status:** Aprovado para implementação  
**Baseado em:** Documento MSG-D01 original + auditoria completa do codebase

---

## Contexto e Auditoria do Codebase

Antes de responder as perguntas do MSG-D01, foi realizada uma auditoria completa do codebase. Os resultados revelam que **a infraestrutura central de comunicação já foi construída na Sprint 11** e está operacional:

| Módulo | Status | Onde |
|--------|--------|------|
| Schema `notices` + `notice_recipients` + `notice_escalations` | ✅ Implementado | `lib/db/src/schema/communication.ts` |
| Schema `message_threads` + `message_thread_participants` + `messages` | ✅ Implementado | `lib/db/src/schema/communication.ts` |
| Schema `notifications` (infra de push) | ✅ Implementado | `lib/db/src/schema/notifications.ts` |
| Rotas de Avisos (criar, publicar, confirmar, escalar, listar) | ✅ Implementado | `artifacts/api-server/src/routes/notices.ts` |
| Rotas de Mensagens (criar thread, enviar, listar, fechar) | ✅ Implementado | `artifacts/api-server/src/routes/messages.ts` |
| Tela mobile Avisos (`avisos.tsx`) com urgência, confirmação, ERA→AGORA | ✅ Implementado | `artifacts/mobile/app/(tabs)/avisos.tsx` |
| Tela mobile Mensagens (`mensagens.tsx`) com threads e contexto | ✅ Implementado | `artifacts/mobile/app/(tabs)/mensagens.tsx` |
| Delegação `NOTICES` e `OPERATIONAL_MESSAGES` (Capitão) | ✅ Implementado | `artifacts/api-server/src/routes/delegations.ts` |

**Lacunas identificadas (ainda não implementadas):**
- Push notifications: tabela existe, entrega real (Expo Push) não conectada
- Badge numérico na tab Mensagens (lastReadAt existe no schema, UI ausente)
- Aviso CRITICAL pendente não aparece em Meu Dia
- IA: não iniciada em nenhum módulo
- Fixação de mensagem em grupo: não implementada

A spec abaixo responde cada pergunta do MSG-D01 considerando o que já existe e o que precisa ser construído.

---

## PARTE 1 — Diferença oficial entre Mensagens e Avisos

### Definições

**Mensagem:** conversa rápida entre participantes identificados, vinculada ou não a um contexto operacional. É bidirecional, imutável após o envio e encerrada pelo iniciador ou Admin quando o assunto é resolvido.

**Aviso:** comunicado oficial e unidirecional emitido por quem tem autoridade para uma audiência definida dentro de uma Operação. Tem urgência declarada, pode exigir confirmação de leitura e fica publicado no mural até a data de expiração.

| Dimensão | Mensagem | Aviso |
|----------|----------|-------|
| Direção | Bidirecional (conversa) | Unidirecional (broadcast) |
| Resposta | Qualquer participante responde | Sem resposta no próprio aviso |
| Iniciativa | Qualquer usuário autorizado | Supervisor, Admin ou Capitão |
| Rastreabilidade | Thread com histórico | Confirmação por destinatário |
| Urgência | Sem urgência estruturada | INFORMATIVE / IMPORTANT / CRITICAL |
| Fixação | Pós-piloto (por Supervisor) | Sim — Avisos IMPORTANT/CRITICAL ficam fixados até confirmação |

### Exemplos do contexto MyASA

| Situação | Tipo correto |
|----------|-------------|
| "O show de hoje está cancelado — confirmar leitura" | **Aviso CRITICAL** |
| "A escala do sábado mudou — confira o Livro do Dia" | **Aviso IMPORTANT** |
| "Lembrete: reunião de pré-show às 18h" | **Aviso INFORMATIVE** |
| "Você pode trocar de folga comigo no dia 25?" | **Mensagem** |
| "Dúvida sobre a marcação da minha escala" | **Mensagem** |
| "Patinador X não chegou — como proceder?" | **Mensagem** |
| "Comunicado de mudança de horário de ensaio" | **Aviso IMPORTANT** com ERA→AGORA |

### Respostas às 5 perguntas da Parte 1

**1. Quando algo deve ser Mensagem?**  
Quando requer resposta de um ou mais participantes, é situacional e transitória, ou é uma troca de informação entre indivíduos identificados. Exemplos: dúvidas sobre escala, troca de folga, alinhamento operacional rápido, qualquer situação que exige diálogo.

**2. Quando algo deve ser Aviso?**  
Quando é um comunicado oficial com impacto na programação ou conduta de membros, deve ser registrado formalmente, e/ou exige confirmação de leitura. Exemplos: cancelamento de show, mudança de alocação, instrução operacional importante do Supervisor.

**3. Um Aviso pode nascer de uma Mensagem?**  
Sim — indiretamente. Se durante uma conversa o Supervisor decide formalizar uma decisão, ele pode criar um Aviso manualmente referenciando o contexto daquela conversa. O botão "Criar Aviso a partir desta conversa" é uma feature pós-piloto. No piloto: o Supervisor cria o Aviso separadamente.

**4. Uma Mensagem importante pode virar Aviso?**  
Sim, mas o processo é sempre manual e humano: o Supervisor lê a conversa, decide que o conteúdo merece status oficial, e cria um Aviso com o conteúdo reformulado. Uma Mensagem nunca se transforma automaticamente em Aviso — a decisão de oficializar é exclusivamente humana.

**5. O usuário entende a diferença?**  
Sim, se a interface deixar claro: Mensagens ficam na tab "Mensagens" (ícone de balão de conversa), Avisos ficam na tab "Avisos" (ícone de sino/megafone). A linguagem também diferencia: Mensagens têm "Nova Conversa", Avisos têm "Novo Aviso" com seleção de urgência. O comportamento diferente (Aviso exige confirmação, Mensagem não) reforça a distinção na prática.

---

## PARTE 2 — Mensagens estilo WhatsApp

### Classificação completa de features

🔴 Necessário para piloto | 🟡 Recomendado | 🟢 Pós-piloto

| Feature | Prioridade | Estado atual | Justificativa |
|---------|-----------|--------------|---------------|
| Conversa individual (1:1) | 🔴 | ✅ Implementado | Base do sistema |
| Grupos | 🔴 | ✅ Schema suporta N participantes | UI deve validar multi-seleção |
| Operação inteira (broadcast thread) | 🟡 | ⚠️ Schema suporta, UI ausente | Importante mas não bloqueia piloto |
| Grupos operacionais (Patinadores, Musical…) | 🟡 | ⚠️ Schema suporta, UI ausente | Depende de integração com grupos existentes |
| Grupos temporários | 🟡 | ⚠️ Schema suporta via ad-hoc | Criar thread com múltiplos membros manuais |
| Mensagens de texto | 🔴 | ✅ Implementado | Base do sistema |
| Emojis | 🟡 | ✅ Suportado nativamente (TextInput aceita Unicode) | Sem custo extra; melhorar UX no piloto |
| Reações (👍 etc.) | 🟢 | ❌ Não implementado | Schema não suporta; requer nova tabela |
| Resposta direta (reply a mensagem específica) | 🟡 | ❌ Não implementado | Contexto operacional se beneficia; pós-piloto inicial |
| Encaminhar mensagem | 🟢 | ❌ Não implementado | Baixa prioridade no contexto operacional |
| Apagar para mim | 🟢 | ❌ Mensagens são imutáveis (MSG-D04) | Política de imutabilidade impede |
| Apagar para todos | 🟢 | ❌ Mensagens são imutáveis (MSG-D04) | Registros operacionais não podem ser apagados |
| Editar mensagem | 🟢 | ❌ Mensagens são imutáveis (MSG-D04) | Imutabilidade é requisito de auditoria |
| Mensagem fixada no grupo | 🟡 | ❌ Não implementado | Supervisor pode fixar instrução importante |
| Busca de mensagens | 🟢 | ❌ Não implementado | Pós-piloto |
| Áudio / mensagem de voz | 🟢 | ❌ Não implementado | Alta complexidade; pós-piloto |
| Imagem | 🟢 | ❌ Object storage não configurado | Pós-piloto (sprint de object storage) |
| Vídeo | 🟢 | ❌ Object storage não configurado | Pós-piloto |
| PDF / documento | 🟢 | ❌ Object storage não configurado | Pós-piloto |
| Figurinha / sticker | 🟢 | ❌ Não implementado | Sem fit com contexto operacional |

### Notas sobre imutabilidade

Mensagens são imutáveis após o envio (comentado no schema como "MSG-D04"). Esta é uma decisão de auditoria: registros operacionais em companhias de espetáculo precisam de integridade histórica. Consequência: "apagar para mim", "apagar para todos" e "editar mensagem" são incompatíveis com esta política e ficam permanentemente fora do escopo.

---

## PARTE 3 — Grupos de conversa

### 5 tipos de grupo definidos

O sistema usa **threads** com múltiplos participantes como unidade de "grupo". Os tipos abaixo correspondem aos 5 casos de uso do MSG-D01, mapeados para o modelo existente.

---

#### 1. Grupo operacional
*Exemplos: Patinadores, Musical, Fisioterapia*

- **O que é:** thread permanente com todos os membros de um grupo operacional da organização.
- **Quem cria:** ADMIN ou SUPERVISOR_A ao configurar o grupo. Pode ser criado manualmente ou futuro: automaticamente ao criar o grupo operacional.
- **Quem pode adicionar/remover:** ADMIN e SUPERVISOR da operação. Membros não podem alterar composição.
- **Nasce automaticamente de Agenda/Escala/Tarefa?** Pós-piloto — ao criar um Grupo Operacional, oferecer opção de criar thread associado.
- **Pode ser arquivado?** Sim, quando o grupo operacional for desativado. Status → CLOSED.
- **Membro pode sair?** Não — a composição espelha o grupo operacional. Saída do grupo remove do thread.
- **Supervisor pode fixar mensagem?** Sim — feature 🟡 (pós-piloto inicial). Supervisor fixa uma mensagem de instrução no topo do thread.

---

#### 2. Grupo de evento
*Exemplos: Ensaio Musical 20/07, Show de Natal 25/12*

- **O que é:** thread criado para coordenação de um evento específico da Agenda. Vinculado a `contextType = AGENDA` com `contextId` apontando para o evento.
- **Quem cria:** Supervisor responsável pelo evento ou Capitão com delegação `OPERATIONAL_MESSAGES`.
- **Quem pode adicionar/remover:** Criador do thread + ADMIN. Membros não podem alterar.
- **Nasce automaticamente?** Pós-piloto — ao publicar evento na Agenda, oferecer "Criar grupo de coordenação".
- **Pode ser arquivado?** Sim — arquivado automaticamente após a data do evento (status → CLOSED).
- **Membro pode sair?** Não durante o evento ativo. Após encerramento, thread fica em modo leitura.
- **Supervisor pode fixar mensagem?** Sim — feature 🟡.

---

#### 3. Grupo de tarefa
*Exemplos: Atualizar Biblioteca Astrid, Preparar figurinos do Musical*

- **O que é:** thread criado para coordenação de uma tarefa específica. Vinculado a `contextType = DAILY_BOOK` ou contexto futuro `TASK`.
- **Quem cria:** Supervisor que atribuiu a tarefa, ou ADMIN.
- **Quem pode adicionar/remover:** Criador + ADMIN.
- **Nasce automaticamente?** Pós-piloto — ao criar tarefa com múltiplos responsáveis, oferecer criação automática do thread.
- **Pode ser arquivado?** Sim — ao encerrar a tarefa (status APPROVED/COMPLETED), thread é arquivado automaticamente.
- **Membro pode sair?** Não enquanto a tarefa está ativa.
- **Supervisor pode fixar mensagem?** Sim — feature 🟡.

---

#### 4. Grupo temporário
*Exemplos: Pocket Páscoa, Pré-show emergencial 18/06*

- **O que é:** thread ad-hoc criado manualmente para um assunto específico sem vínculo formal com um objeto do sistema.
- **Quem cria:** SUPERVISOR, ADMIN ou MEMBER com delegação `OPERATIONAL_MESSAGES`. `contextType = DIRECT` com múltiplos participantes.
- **Quem pode adicionar/remover:** Criador (INITIATOR) + ADMIN. Pós-piloto: UI de gerenciar participantes.
- **Nasce automaticamente?** Não. Criação sempre manual.
- **Pode ser arquivado?** Sim — encerrado manualmente pelo criador ou ADMIN.
- **Membro pode sair?** Pós-piloto — UI de "Sair do grupo" não existe no piloto.
- **Supervisor pode fixar mensagem?** Sim — feature 🟡.

---

#### 5. Grupo de supervisão
*Exemplos: Supervisores Snowland, Equipe de gestão*

- **O que é:** thread privado composto exclusivamente por Supervisores e Admins. Pode ser permanente ou por temporada.
- **Quem cria:** ADMIN ou SUPERVISOR_A.
- **Quem pode adicionar/remover:** ADMIN apenas.
- **Nasce automaticamente?** Não.
- **Pode ser arquivado?** Sim — encerrado manualmente pelo ADMIN.
- **Membro pode sair?** Não — composição definida pelo ADMIN.
- **Supervisor pode fixar mensagem?** Sim — qualquer participante pode fixar para os demais supervisores.

---

### Respostas às perguntas gerais da Parte 3

**Quem pode criar grupo?**  
Grupos de supervisão e operacional: ADMIN. Grupos de evento e tarefa: SUPERVISOR ou ADMIN. Grupos temporários: SUPERVISOR, ADMIN ou MEMBER com delegação `OPERATIONAL_MESSAGES`.

**Quem pode adicionar/remover pessoas?**  
ADMIN sempre. SUPERVISOR dentro da sua operação. No piloto, UI de gerenciar participantes pós-criação é limitada. Pós-piloto: UI completa de gestão de membros.

**Grupos podem nascer automaticamente de Agenda, Escala ou Tarefa?**  
Arquitetura suporta (schema tem `contextType` e `contextId`). No piloto: criação automática não implementada. Pós-piloto: ao publicar Escala, evento na Agenda, ou criar Tarefa multi-responsável, sistema oferece opção de criar thread vinculado.

**Grupo pode ser arquivado?**  
Sim. Status do thread muda para CLOSED. Thread arquivado fica acessível em modo leitura. Nenhuma mensagem é apagada.

**Membro pode sair?**  
No piloto: não — thread é encerrado pelo criador ou ADMIN, não por saída individual de membro. Pós-piloto: opção de "Sair do grupo" para grupos temporários e de evento.

**Supervisor pode fixar mensagem?**  
Sim, como feature 🟡. A fixação de mensagem exige nova coluna `pinnedMessageId` na tabela `message_threads` e UI de destaque no topo do thread. Deve ser implementada antes de expandir grupos para todas as operações.

---

## PARTE 4 — Avisos como mural oficial

### Estrutura de dados completa do objeto Aviso

Baseada no schema existente (`lib/db/src/schema/communication.ts`), com campos adicionais necessários:

```
Aviso {
  id              uuid          — identificador único
  title           text|null     — título (opcional)
  content         text          — corpo do aviso (obrigatório)
  urgency         enum          — INFORMATIVE | IMPORTANT | CRITICAL
  status          enum          — DRAFT | PUBLISHED | EXPIRED | CANCELLED
  authorId        uuid          — quem criou (FK → users)
  operationId     uuid          — qual operação (FK → operations)
  publicAlvo      —             — definido pelos registros em notice_recipients
  pinned          boolean       — [NOVO] fixado no mural ou não (padrão: false)
  requiresConfirmation boolean  — exige confirmação explícita de leitura
  publishedAt     timestamp     — quando foi publicado
  expiresAt       timestamp|null — data de fim (quando perde relevância operacional)
  createdAt       timestamp
  cancelledAt     timestamp|null
  deltaJson       jsonb|null    — { changeBefore, changeAfter } para ERA → AGORA
  autoGenerated   boolean       — true se criado automaticamente pelo sistema
  sourceType      text|null     — "SCALE", "DAILY_BOOK", etc.
  sourceId        text|null     — ID do objeto de origem
}

NoticeRecipient {
  noticeId    uuid
  userId      uuid
  groupId     uuid|null     — para avisos enviados a um grupo inteiro
  status      enum          — PENDING | SENT | VIEWED | CONFIRMED | ESCALATED
  sentAt      timestamp|null
  viewedAt    timestamp|null
  confirmedAt timestamp|null
  escalatedAt timestamp|null
}
```

> **Nota de implementação:** o campo `pinned` não existe ainda no schema. Deve ser adicionado via migration antes do piloto se a feature de fixação for incluída (prioridade 🟡).

### Respostas às 7 perguntas da Parte 4

**1. Avisos aparecem em Meu Dia?**  
Sim. Avisos CRITICAL e IMPORTANT não confirmados devem aparecer como card de ação no topo de Meu Dia, com botão "Ver Aviso". Esta integração está **ausente** no piloto atual e deve ser implementada antes do lançamento (item 🔴). Avisos INFORMATIVE não aparecem em Meu Dia — apenas na tab Avisos.

**2. Avisos aparecem em uma aba própria?**  
Sim. A tab "Avisos" já existe e está implementada (`avisos.tsx`). Lista todos os avisos do usuário com filtro por urgência e status de leitura, badge de não-lidos e modal de detalhe com ERA→AGORA.

**3. Avisos importantes ficam fixados?**  
Por política: sim, Avisos CRITICAL e IMPORTANT não confirmados devem permanecer visíveis no topo da lista ("fixados" visualmente) até confirmação. A fixação visual (por status + urgência) já funciona na UI atual. A fixação explícita por campo `pinned` (que o Supervisor ativa manualmente) é feature 🟡 — requer campo adicional no schema e UI de toggle.

**4. Aviso pode ser criado a partir de uma mensagem?**  
Sim — mas no piloto apenas de forma manual: o Supervisor lê a conversa e cria um Aviso separado. O botão "Criar Aviso a partir desta conversa" (que pré-preenche o formulário com o conteúdo da mensagem) é feature 🟢 pós-piloto.

**5. Aviso pode gerar notificação?**  
Sim — deve gerar push notification ao publicar. Avisos CRITICAL e IMPORTANT geram push de alta prioridade. Avisos INFORMATIVE geram apenas badge interno. A infraestrutura de push (tabela `notifications`) existe mas a entrega real ainda não está conectada — prioridade 🟡 antes de expandir o piloto.

**6. Aviso pode ter reações simples?**  
Não no piloto. Avisos são unidirecionais e imutáveis após publicação. Reações (👍 etc.) mudariam o caráter do mural para algo mais social, o que conflita com o tom de comunicado oficial. Decisão: reações em Avisos ficam fora do escopo permanente. Se o Supervisor quiser reconhecer alguém, deve usar o campo de conteúdo (ver pergunta 7).

**7. Aviso pode reconhecer alguém?**  
Sim — pelo conteúdo. O Supervisor escreve "Parabéns para Amanda pelo excelente trabalho hoje 👏" e publica como Aviso INFORMATIVE sem exigência de confirmação. O sistema não tem um campo especial de "reconhecimento" — o conteúdo livre do Aviso já suporta esse uso. Pós-piloto: tipo especial `RECOGNITION` para destacar visualmente reconhecimentos no mural.

---

## PARTE 5 — Notificações do aplicativo

### Canais disponíveis

| Canal | Descrição | Status |
|-------|-----------|--------|
| **Push** | Notificação no SO (iOS/Android) via Expo Push | ⚠️ Infra pronta, entrega não conectada |
| **Badge interno** | Contador na tab do app | ⚠️ Parcialmente implementado (tab Avisos tem badge, tab Mensagens não) |
| **Meu Dia** | Card/alerta na tela Meu Dia | ⚠️ Delegações aparecem; Avisos CRITICAL ausentes |

### Tabela de notificações por evento

| Evento | Push | Badge interno | Meu Dia | Crítico | Piloto |
|--------|------|--------------|---------|---------|--------|
| Novo aviso (INFORMATIVE) | ❌ | ✅ tab Avisos | ❌ | Não | 🔴 |
| Novo aviso (IMPORTANT) | ✅ | ✅ tab Avisos | ✅ card | Sim | 🟡 |
| Aviso urgente (CRITICAL) | ✅ alta prioridade | ✅ tab Avisos | ✅ card persistente | Máxima | 🟡 |
| Mensagem nova | ✅ | ✅ tab Mensagens | ❌ | Sim | 🟡 |
| Menção (@nome) | ✅ | ✅ tab Mensagens | ❌ | Sim | 🟢 (requer @ support) |
| Tarefa atribuída | ✅ | ✅ tab Tarefas | ✅ card | Sim | 🟡 |
| Tarefa aprovada | ✅ | ✅ | ❌ | Não | 🟡 |
| Tarefa com ajustes solicitados | ✅ | ✅ | ✅ card | Sim | 🟡 |
| Solicitação aprovada | ✅ | ✅ | ✅ card | Sim | 🟡 |
| Solicitação negada | ✅ | ✅ | ✅ card | Sim | 🟡 |
| Delegação recebida (Capitão) | ✅ | ✅ | ✅ DelegateBanner | Sim | 🔴 (já implementado) |
| Mudança de escala | ✅ | ✅ | ✅ card | Sim | 🟡 |
| Evento novo na agenda | ✅ | ✅ | ✅ | Não | 🟢 |
| Evento cancelado | ✅ alta prioridade | ✅ | ✅ card | Máxima | 🟡 |
| Livro do dia publicado | ❌ | ✅ | ✅ card | Não | 🟢 |
| Check-in pendente (30min antes) | ✅ | ✅ | ✅ | Sim | 🟢 |
| Atraso detectado | ✅ | ✅ | ✅ | Sim | 🟢 |

### Respostas às 6 perguntas da Parte 5

**1. Quais notificações são push?**  
Push para: novos avisos IMPORTANT/CRITICAL, mensagens novas, tarefas atribuídas ou com feedback, solicitações decididas, delegações recebidas, mudanças de escala, cancelamentos de evento. Push de alta prioridade para: aviso CRITICAL, evento cancelado, atraso detectado.

**2. Quais são apenas badge interno?**  
Avisos INFORMATIVE: apenas incrementam o badge da tab Avisos, sem push. Livro do dia publicado: badge em Meu Dia, sem push (informativo, não urgente). Tarefas aprovadas sem pendência: badge, sem push disruptivo.

**3. Quais aparecem em Meu Dia?**  
Avisos IMPORTANT/CRITICAL não confirmados, tarefas com ação pendente, solicitações decididas, delegações ativas (já implementado via DelegateBanner), mudanças de escala que afetam o dia atual, evento cancelado que afeta o dia.

**4. Quais são críticas?**  
Críticas (interrompem o usuário, alta prioridade no SO): aviso CRITICAL, evento cancelado, atraso detectado, tarefa com ajustes solicitados, mensagem nova em thread ativo. Não críticas: aviso INFORMATIVE, tarefa aprovada sem pendência, Livro do Dia publicado.

**5. O usuário pode silenciar?**  
No piloto: não — todas as notificações ativas por padrão. O usuário pode silenciar via configurações nativas do SO (iOS/Android). Controle granular dentro do app (silenciar por tipo ou por período) é pós-piloto.

**6. Supervisor pode marcar como urgente?**  
Sim — ao criar um Aviso, o Supervisor escolhe a urgência (INFORMATIVE / IMPORTANT / CRITICAL). Avisos CRITICAL geram push de alta prioridade automaticamente. Para mensagens: o Supervisor não pode marcar uma mensagem individual como urgente (use Aviso para isso).

---

## PARTE 6 — IA nas mensagens

### Níveis de acesso definidos no MSG-D01

| Nível | Descrição |
|-------|-----------|
| **Nível 1** | Sem leitura automática — IA só age quando chamada explicitamente (`@IA`) |
| **Nível 2** | Leitura operacional limitada — IA analisa apenas grupos operacionais, não conversas privadas |
| **Nível 3** | Detecção de decisões — IA identifica acordos (horário alterado, substituição, tarefa combinada) |
| **Nível 4** | Ação sugerida, não automática — IA sugere "Quer transformar em Aviso?" sem executar |

### Nível recomendado para o piloto: nenhum (IA pós-piloto)

A IA nas mensagens fica fora do piloto. O nível recomendado para a **primeira implementação pós-piloto é o Nível 3** combinado com ações do Nível 4: IA detecta decisões operacionais em grupos e sugere ações sem executar. Conversas privadas (1:1) nunca são lidas automaticamente.

### Respostas às 8 perguntas da Parte 6

**1. IA pode ler conversas privadas?**  
Não — nunca de forma automática. Apenas se o usuário chamar explicitamente (`@IA resume essa conversa`) dentro da conversa. Mesmo com chamada explícita, o conteúdo não é armazenado para treino sem consentimento.

**2. IA pode ler grupos operacionais?**  
Sim, mas apenas com permissão explícita habilitada pelo Admin da operação. Por padrão, IA está desabilitada em todos os grupos. O Admin ativa a análise por grupo operacional individualmente. Membros veem o ícone "IA ativa neste grupo" quando habilitado.

**3. IA só age quando chamada?**  
No Nível 1: sim, exclusivamente. No Nível 3 (pós-piloto): IA analisa grupos autorizados em background, mas **nunca age** — apenas coloca sugestões na interface para o Supervisor aprovar. A regra inviolável: **IA nunca envia mensagem, cria aviso ou executa ação sem confirmação humana explícita**.

**4. IA pode sugerir avisos?**  
Sim — Nível 4. Exemplo: IA detecta "combinamos que o ensaio de amanhã é às 15h" em uma conversa de grupo operacional e sugere ao Supervisor "Quer transformar isso em Aviso?" com o texto pré-preenchido. O Supervisor revisa, edita e publica. IA não publica diretamente.

**5. IA pode sugerir tarefas?**  
Sim — Nível 4. Exemplo: IA detecta "Amanda vai cuidar da atualização do figurino Astrid" e sugere ao Supervisor "Quer criar uma Tarefa para Amanda?" com título e responsável pré-preenchidos.

**6. IA pode resumir decisões?**  
Sim — chamada explícita (`@IA resume`) em qualquer thread onde a IA está autorizada. O resumo lista decisões detectadas ("horário alterado para 15h", "Beatriz substituirá Amanda"). Resumo não é armazenado — gerado sob demanda.

**7. IA registra no histórico?**  
A ação da IA (sugestão feita, resumo gerado) é registrada em `audit_logs`. O conteúdo das mensagens que a IA analisou **não** é duplicado no histórico. Apenas o fato "IA sugeriu Aviso X às 14h32, aprovado por Ana Silva às 14h35" é registrado.

**8. Como proteger confidencialidade?**  
- Conversas 1:1 nunca são analisadas automaticamente.
- Grupos operacionais com IA ativa são sinalizado visualmente.
- IA opera apenas dentro da organização — sem acesso cross-org.
- Modelo de IA acessa apenas o thread relevante, não o histórico completo da organização.
- Nenhum conteúdo de conversa é armazenado fora do banco para treino sem consentimento explícito do Admin da organização.

---

## PARTE 7 — Privacidade e Confidencialidade

### Políticas oficiais

- Conversas privadas (1:1) não são analisadas automaticamente por ninguém — nem IA, nem Admin.
- Grupos operacionais podem ter IA habilitada pelo Admin com sinalização visual clara.
- Mensagens sensíveis nunca viram aviso automaticamente — a decisão de oficializar é sempre humana.
- IA nunca executa ação sem confirmação humana explícita.
- Histórico de auditoria registra ações e metadados, não conteúdo privado completo.
- Admin não deve ler conversas privadas sem regra clara e rastreamento de auditoria.

### Respostas às 5 perguntas da Parte 7

**1. Quem pode ver conversas privadas (threads 1:1)?**  
Apenas os participantes do thread. Admin pode acessar para fins de auditoria e moderação (ex.: investigação de conduta), mas este acesso deve ser registrado em `audit_logs` com timestamp, Admin que acessou e motivo declarado. Sem registro de auditoria, acesso Admin a thread privado é bloqueado pela API.

**2. Admin pode auditar mensagens?**  
Sim, com rastreabilidade obrigatória. Admin pode ver qualquer thread de sua organização, mas cada acesso gera registro em `audit_logs`. Este log é visível para o próprio Admin acessado (transparência). Auditoria de mensagens privadas sem registro é tecnicamente impossível no sistema.

**3. O que entra no histórico (`audit_logs` e S-11)?**  
Metadados: quem criou o thread, quando, quem enviou mensagem (nome + timestamp), quais decisões a IA detectou, quais avisos foram criados e por quem, quais ações Admin/Supervisor tomaram. Status de confirmação de cada aviso por destinatário.

**4. O que não deve entrar no histórico?**  
Conteúdo completo de conversas privadas (1:1). Conteúdo de mensagens em grupos operacionais sem análise de IA habilitada. Dados pessoais além do necessário para auditoria operacional (ex.: conteúdo de mensagens de saúde pessoal).

**5. Como evitar sensação de vigilância?**  
- Sinalização visual clara quando IA está ativa em um grupo (ícone permanente no header do thread).
- Usuário vê, no seu próprio perfil, a lista de quem acessou suas conversas com motivo declarado.
- Política publicada para membros na onboarding: "Mensagens são registradas para fins operacionais. Conversas privadas não são monitoradas automaticamente."
- Acesso Admin a threads privados requer motivo declarado (campo obrigatório antes de acessar).
- Sem análise automática de sentimento ou comportamento — IA analisa apenas decisões operacionais declaradas.

---

## PARTE 8 — Prioridade para piloto

### 🔴 Necessário antes do piloto

| # | Funcionalidade | Estado atual |
|---|---------------|--------------|
| 1 | Mensagens de texto em thread (individual e grupo) | ✅ Implementado |
| 2 | Grupos básicos (multi-participante em thread) | ✅ Schema pronto; validar UI |
| 3 | Avisos oficiais com urgência (INFORMATIVE/IMPORTANT/CRITICAL) | ✅ Implementado |
| 4 | Leitura e confirmação de Avisos | ✅ Implementado |
| 5 | Badge de não-lidos na tab Avisos | ✅ Implementado |
| 6 | Badge de não-lidos na tab Mensagens | ❌ Ausente — implementar |
| 7 | Aviso CRITICAL/IMPORTANT em Meu Dia | ❌ Ausente — implementar |
| 8 | Notificações básicas (badge interno) | ✅ Parcial (tab Avisos tem; Mensagens não) |
| 9 | Escalação manual de Avisos CRITICAL | ✅ Implementado |
| 10 | Delegação NOTICES e OPERATIONAL_MESSAGES (Capitão) | ✅ Implementado |

### 🟡 Recomendado (antes de expandir para todas as operações)

| # | Funcionalidade |
|---|---------------|
| 1 | Emojis em mensagens (suportado pelo TextInput; confirmar no teclado mobile) |
| 2 | Resposta direta (reply a mensagem específica) |
| 3 | Mensagem fixada no grupo por Supervisor |
| 4 | Anexos por link (URL externa — sem upload; sem object storage) |
| 5 | Push notifications para avisos IMPORTANT/CRITICAL e mensagens novas |
| 6 | Badge numérico no ícone do app (iOS/Android) |
| 7 | Polling automático de mensagens (React Query refetchInterval 15s) |
| 8 | Indicador "lido por" na thread (lastReadAt já existe no schema) |
| 9 | Grupos operacionais vinculados automaticamente a grupos existentes |

### 🟢 Pós-piloto

| # | Funcionalidade |
|---|---------------|
| 1 | Áudio / mensagem de voz |
| 2 | Vídeo |
| 3 | Upload de imagem e PDF (requer object storage) |
| 4 | Figurinhas / stickers |
| 5 | IA automática em grupos operacionais |
| 6 | Busca avançada em mensagens |
| 7 | Encaminhar mensagem |
| 8 | Apagar para todos (incompatível com imutabilidade — permanentemente fora do escopo) |
| 9 | Central de notificações com histórico |
| 10 | Controle granular de notificações pelo usuário |
| 11 | Menção com @nome |
| 12 | Botão "Criar Aviso a partir desta conversa" |
| 13 | Grupos nascem automaticamente de Agenda/Escala/Tarefa |
| 14 | Saída individual de membro de grupo |
| 15 | Tipo especial de Aviso RECOGNITION |

---

## PARTE 9 — Veredito

### Respostas às 7 perguntas do veredito

**1. O sistema de mensagens atual substitui WhatsApp?**  
Não — e não deve tentar. O MyASA tem um objetivo diferente: coordenação operacional rastreável, não comunicação social. O sistema atual substitui o WhatsApp nas seguintes situações operacionais específicas: dúvidas sobre escala, alinhamento de tarefa, comunicados oficiais (Avisos), coordenação de substituição de membro. Para comunicação social e pessoal, membros continuarão usando WhatsApp fora do MyASA — e isso é aceitável.

**2. O que falta para substituir WhatsApp no piloto (para as funções operacionais)?**  
Os dois itens críticos ausentes: (a) badge de não-lidos na tab Mensagens — sem ele, membros não percebem mensagens novas; (b) push notifications — sem push, o MyASA precisa que o membro abra o app para ver comunicados. Com esses dois itens, o MyASA substitui o WhatsApp para fins operacionais no piloto.

**3. Avisos estão bem separados de mensagens?**  
Sim — estruturalmente e visualmente. Tabs separadas, ícones distintos, comportamentos diferentes (Aviso exige confirmação, Mensagem não), e o fluxo de criação é completamente diferente (Aviso tem urgência + público-alvo; Mensagem tem participantes + contexto). A distinção é clara para o usuário que passar pelo onboarding.

**4. Notificações estão suficientes para o piloto?**  
Parcialmente. Badge interno na tab Avisos está implementado. Badge na tab Mensagens está ausente (🔴). Push notifications estão ausentes (🟡). Para o dia 1 do piloto, o sistema funciona com polling manual — o risco é que membros percam avisos urgentes. A mitigação é exibir avisos CRITICAL em Meu Dia (também ausente, 🔴). Com os dois itens 🔴 implementados, as notificações são suficientes para o piloto.

**5. IA pode participar sem violar confidencialidade?**  
Sim — se implementada no Nível 3/4 com as salvaguardas definidas na Parte 7: nunca lê conversas privadas automaticamente, sinaliza visualmente quando ativa em grupo, rastreia todos os acessos em audit_logs, e nunca executa ação sem confirmação humana. A IA projetada para o MyASA é compatível com confidencialidade operacional de companhias de espetáculo.

**6. O que deve ser implementado agora?**  
Dois itens 🔴 ausentes que bloqueiam o piloto:
1. Badge de não-lidos na tab Mensagens (campo `lastReadAt` já existe no schema `message_thread_participants`)
2. Card de aviso CRITICAL/IMPORTANT não confirmado em Meu Dia

E dois itens complementares de qualidade:
3. Polling automático de mensagens (React Query `refetchInterval` de 15s nas threads)
4. Validação na API que Avisos CRITICAL sempre tenham `requiresConfirmation = true`

**7. O que deve ficar para depois?**  
IA, push notifications, áudio, vídeo, upload de arquivos, mensagem fixada, resposta direta, grupos automáticos, busca, emojis avançados, figurinhas, apagar para todos (permanentemente fora do escopo por imutabilidade), controle granular de notificações, central de notificações, e todas as features classificadas 🟢 na Parte 8.

---

## Apêndice A — Terminologia oficial

| Termo no app (UI) | Nunca usar | Motivo |
|-------------------|------------|--------|
| Avisos | Notificações, Alertas | "Notificação" causa confusão com push do sistema |
| Mensagens | Chat, DM, WhatsApp | Tom casual não alinha com contexto operacional |
| Conversa | Thread | "Thread" é interno; na UI usar "Conversa" |
| Confirmar leitura | Dar ok, Assinar | Termo preciso e juridicamente correto |
| Urgência | Prioridade, Severidade | Alinha com vernáculo operacional de shows |
| Escalar | Reportar, Notificar gestor | Termo correto para Avisos não confirmados |

---

## Apêndice B — Diagrama de fluxo de um Aviso CRITICAL

```
Supervisor / Capitão com delegação NOTICES
    │
    ├─ Cria aviso (status: DRAFT)
    │    urgency=CRITICAL, requiresConfirmation=true
    │    content + title + deltaJson (ERA→AGORA)
    │
    ├─ Publica (status: PUBLISHED)
    │    → sistema cria notice_recipients para cada destinatário
    │    → status inicial: PENDING
    │    → [🟡 futuro: dispara push de alta prioridade]
    │    → [🔴 faltando: card aparece em Meu Dia do membro]
    │
Membro
    │
    ├─ Abre app → Meu Dia mostra card do Aviso CRITICAL
    ├─ Toca no card → abre tab Avisos → status: SENT
    ├─ Visualiza detalhe completo → status: VIEWED
    ├─ Toca "Confirmar leitura" → status: CONFIRMED, confirmedAt = now()
    │
    └─ SE não confirmar
         Supervisor vê painel de confirmações pendentes
         Toca "Escalar" → status: ESCALATED
         → registro em notice_escalations
         → [🟡 futuro: push adicional de re-notificação]

REGRA: Aviso nunca é apagado. Status CONFIRMED encerra o ciclo individual.
       O Aviso permanece acessível na tab Avisos indefinidamente.
```

---

## Apêndice C — Próximas sprints recomendadas

**MSG-S01 — Lacunas do Piloto** (🔴 deve ser feito antes do lançamento):
1. Badge de não-lidos na tab Mensagens
2. Card de aviso CRITICAL/IMPORTANT em Meu Dia
3. Polling automático nas threads ativas (React Query refetchInterval 15s)
4. Validação API: CRITICAL + requiresConfirmation=true obrigatório
5. Auditoria de acesso Admin a threads em audit_logs

**MSG-S02 — Push Notifications** (🟡 antes de expandir):
1. Integração Expo Push Token
2. Disparo de push ao publicar aviso IMPORTANT/CRITICAL
3. Disparo de push ao receber mensagem nova
4. Badge numérico no ícone do app (iOS/Android)

**MSG-S03 — IA Assistente** (🟢 pós-piloto):
1. Resumo de thread sob demanda (@IA)
2. Detecção de decisões operacionais em grupos autorizados
3. Sugestão "Criar Aviso?" com texto pré-preenchido
4. Sugestão "Criar Tarefa?" com responsável e título

---

*Documento aprovado para guiar as sprints de comunicação do MyASA. Revisões devem ser numeradas (v1.2, v2.0) com data e justificativa.*
