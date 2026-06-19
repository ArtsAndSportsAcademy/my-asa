# AI-D01 — Auditoria Completa da Inteligência Operacional do MyASA

**Data:** Junho 2026  
**Versão:** 1.0  
**Status:** Auditoria — sem implementação de código  
**Escopo:** Mapeamento de capacidades, permissões, riscos e roadmap para uma IA assistente operacional integrada ao MyASA.

---

## Diagnóstico Inicial

> **O MyASA não possui IA integrada.**

O sistema possui dois componentes que podem ser confundidos com IA:

- **`coverage-engine.ts`** — algoritmo determinístico de pontuação de candidatos para escalas. Calcula `priorityScore` com base em tags de habilidade (+10/tag compatível), diversidade de perfil (+2/tag, máx. 20), conflitos de agenda e restrições ativas. É puro SQL + aritmética, sem nenhum modelo de linguagem.
- **`insights.ts`** — análises estatísticas SQL sobre check-ins, solicitações, tarefas, carga de trabalho, avisos, biblioteca e tendências. Dashboards de dados, não inteligência.

**Conclusão:** A IA descrita neste documento é uma *capacidade a ser construída*, não algo já existente. Esta auditoria mapeia o que o MyASA oferece como substrato para uma futura IA assistente operacional.

---

## PARTE 1 — Inventário de Capacidades

### Metodologia

Para cada ação avaliada:
- **Rota existente:** o endpoint de API está implementado?
- **Funciona:** o endpoint está estável e utilizável?
- **Protegida por permissão:** RBAC enforçado?
- **Gera auditoria:** `recordAudit()` é chamado nessa rota?
- **Requer confirmação:** há confirmação de usuário prevista no fluxo atual?

> **Nota sobre auditoria:** `audit.service.ts` implementa `recordAudit()` via `securityAuditLogTable`. Após análise de código, essa função é chamada apenas em eventos de autenticação (login, refresh de token). Nenhuma das rotas operacionais (agenda, escalas, avisos, solicitações) chama `recordAudit()` explicitamente. **Esta é uma lacuna crítica para qualquer operação de IA.**

---

### 1.1 Criar Ensaio

| Critério | Estado |
|---|---|
| Rota existente | `POST /agenda/events` (type: REHEARSAL) |
| Funciona | ✅ Sim |
| Protegida por permissão | ✅ MANAGER_ROLES (inline check) |
| Gera auditoria | ❌ Não — nenhuma chamada a `recordAudit()` |
| Requer confirmação | ❌ Não no nível de API |

**Classificação:** 🟡 Experimental  
**Para IA:** A ação existe na API mas não gera trilha de auditoria. Uma IA poderia criar ensaios sem rastro, o que é inaceitável. Requer instrumentação antes de liberar para IA.

---

### 1.2 Cancelar Ensaio

| Critério | Estado |
|---|---|
| Rota existente | `POST /agenda/events/:id/cancel` |
| Funciona | ✅ Sim |
| Protegida por permissão | ✅ MANAGER_ROLES |
| Gera auditoria | ❌ Não |
| Requer confirmação | ❌ Não — **ação irreversível sem proteção** |

**Classificação:** 🔴 Incompleto  
**Para IA:** Ação destrutiva irreversível. A IA **nunca deve cancelar eventos autonomamente**. Apenas sugerir. Cancelamento requer confirmação humana explícita + auditoria.

---

### 1.3 Adicionar Participantes em Ensaio/Escala

| Critério | Estado |
|---|---|
| Rota existente | `PATCH /scales/:id/allocations/:allocationId` (troca de pessoa) |
| Funciona | ✅ Sim |
| Protegida por permissão | ✅ MANAGER_ROLES (inline check em scales.ts) |
| Gera auditoria | ❌ Não |
| Requer confirmação | ❌ Não |

**Classificação:** 🟡 Experimental  
**Para IA:** O endpoint existe mas a semântica é "substituir alocação existente". Adicionar uma pessoa nova a uma posição requer geração de nova escala (`POST /scales/generate`) ou manipulação de alocação. Complexo para IA sem verificação de conflito explícita.

---

### 1.4 Criar Aviso

| Critério | Estado |
|---|---|
| Rota existente | `POST /notices` + `POST /notices/:id/publish` |
| Funciona | ✅ Sim |
| Protegida por permissão | ✅ MANAGER_ROLES_NOTICES (inline) |
| Gera auditoria | ❌ Não |
| Requer confirmação | ✅ Parcial — há etapa separada de publicação |

**Classificação:** 🟡 Experimental  
**Para IA:** O fluxo de rascunho → publicação fornece uma camada natural de confirmação humana. A IA poderia criar rascunhos de avisos para revisão do supervisor. Publicação direta pela IA é arriscada: um aviso publicado incorretamente com urgência CRITICAL gera notificações push para toda a equipe.

---

### 1.5 Adicionar em Escala

| Critério | Estado |
|---|---|
| Rota existente | `POST /scales/generate` (gera escala inteira via coverage-engine) |
| Funciona | ✅ Sim |
| Protegida por permissão | ✅ MANAGER_ROLES |
| Gera auditoria | ❌ Não |
| Requer confirmação | ✅ Parcial — escala gerada precisa ser publicada |

**Classificação:** 🟡 Experimental  
**Para IA:** A geração já é algorítmica (coverage-engine determinístico). A IA poderia invocar `/scales/generate` como ferramenta. Mas a escala só ativa para a equipe após `/scales/:id/publish`. O fluxo de publicação é a salvaguarda natural.

---

### 1.6 Remover da Escala

| Critério | Estado |
|---|---|
| Rota existente | `PATCH /scales/:id/allocations/:allocationId` (status change) |
| Funciona | ✅ Sim |
| Protegida por permissão | ✅ MANAGER_ROLES |
| Gera auditoria | ❌ Não |
| Requer confirmação | ❌ Não — escala publicada pode ter pessoa removida silenciosamente |

**Classificação:** 🔴 Incompleto  
**Para IA:** Remover pessoa de escala já publicada é ação de alto impacto (pessoa perde a informação sobre sua alocação). A IA **não deve executar isso autonomamente**. Apenas sugerir, com notificação ao supervisor.

---

### 1.7 Trocar Pessoas na Escala

| Critério | Estado |
|---|---|
| Rota existente | `PATCH /scales/:id/allocations/:allocationId` (troca de candidato) + `POST /scales/:id/republish` |
| Funciona | ✅ Sim |
| Protegida por permissão | ✅ MANAGER_ROLES |
| Gera auditoria | ❌ Não |
| Requer confirmação | ✅ Parcial — republish é etapa separada |

**Classificação:** 🟡 Experimental  
**Para IA:** É a ação mais útil e natural para IA. O coverage-engine já verifica restrições e conflitos. A IA poderia sugerir trocas baseadas em análise de disponibilidade + tags, cabendo ao supervisor aprovar via republish.

---

### 1.8 Aprovar Solicitações

| Critério | Estado |
|---|---|
| Rota existente | `POST /requests/:id/decision` |
| Funciona | ✅ Sim |
| Protegida por permissão | ✅ MANAGER_ROLES (inline) |
| Gera auditoria | ❌ Não |
| Requer confirmação | ❌ Não — decisão é imediata |

**Classificação:** 🔴 Incompleto para execução autônoma  
**Para IA:** Aprovar/negar solicitações de folga, afastamento ou substituição tem impacto direto nas pessoas e na cobertura operacional. A IA pode **analisar e recomendar** a decisão (verificar restrições, cobertura no período, histórico), mas nunca executar a decisão sozinha. Envolve julgamento de contexto humano.

---

### 1.9 Consultar Folgas (Restrições)

| Critério | Estado |
|---|---|
| Rota existente | `GET /restrictions` (tipos: PHYSICAL, HEALTH, SCHEDULE, ROLE, TECHNICAL, PERSONAL) |
| Funciona | ✅ Sim |
| Protegida por permissão | ✅ Sim |
| Gera auditoria | — (leitura, não aplicável) |
| Requer confirmação | — (leitura) |

**Classificação:** 🟢 Produção  
**Para IA:** Leitura de restrições é segura e fundamental. O coverage-engine já a usa. A IA deve ter acesso de leitura irrestrito a restrições para qualquer análise de cobertura ou sugestão de escala.

---

### 1.10 Consultar Cobertura Operacional

| Critério | Estado |
|---|---|
| Rota existente | `GET /operational-panel` + coverage-engine (análise de candidatos por posição) |
| Funciona | ✅ Sim |
| Protegida por permissão | ✅ MANAGER_ROLES |
| Gera auditoria | — (leitura) |
| Requer confirmação | — (leitura) |

**Classificação:** 🟢 Produção  
**Para IA:** Capacidade fundamental. O painel operacional expõe exatamente o que a IA precisa para responder "quem pode cobrir o turno de X?", "qual a cobertura para o show de sábado?". É a base de qualquer análise inteligente de escala.

---

### 1.11 Consultar Operação

| Critério | Estado |
|---|---|
| Rota existente | `GET /operations`, `GET /operations/:id` |
| Funciona | ✅ Sim |
| Protegida por permissão | ✅ requireOrganization |
| Gera auditoria | — (leitura) |
| Requer confirmação | — (leitura) |

**Classificação:** 🟢 Produção  
**Para IA:** Fundamental. A IA precisa conhecer a operação (nome, grupos, membros associados) para qualquer resposta contextual.

---

### 1.12 Consultar Livro do Dia

| Critério | Estado |
|---|---|
| Rota existente | `GET /daily-book`, `GET /daily-book/:id`, `GET /daily-book/:id/delta` |
| Funciona | ✅ Sim |
| Protegida por permissão | ✅ requireOrganization |
| Gera auditoria | — (leitura) |
| Requer confirmação | — (leitura) |

**Classificação:** 🟢 Produção  
**Para IA:** Leitura completa e segura. O delta (comparação entre versões) é especialmente útil para a IA resumir mudanças operacionais. A IA pode responder "o que mudou no roteiro de hoje?" com base no `/daily-book/:id/delta`.

---

### Resumo da Parte 1

| Ação | Rota | Funciona | Permissão | Auditoria | Confirmação | Status |
|---|---|---|---|---|---|---|
| Criar ensaio | `POST /agenda/events` | ✅ | ✅ | ❌ | ❌ | 🟡 |
| Cancelar ensaio | `POST /agenda/events/:id/cancel` | ✅ | ✅ | ❌ | ❌ | 🔴 |
| Adicionar participantes | `PATCH /scales/:id/allocations/:id` | ✅ | ✅ | ❌ | ❌ | 🟡 |
| Criar aviso | `POST /notices` + publish | ✅ | ✅ | ❌ | ✅ parcial | 🟡 |
| Adicionar em escala | `POST /scales/generate` | ✅ | ✅ | ❌ | ✅ parcial | 🟡 |
| Remover da escala | `PATCH /scales/:id/allocations/:id` | ✅ | ✅ | ❌ | ❌ | 🔴 |
| Trocar pessoas | `PATCH + republish` | ✅ | ✅ | ❌ | ✅ parcial | 🟡 |
| Aprovar solicitações | `POST /requests/:id/decision` | ✅ | ✅ | ❌ | ❌ | 🔴 |
| Consultar folgas | `GET /restrictions` | ✅ | ✅ | — | — | 🟢 |
| Consultar cobertura | `GET /operational-panel` | ✅ | ✅ | — | — | 🟢 |
| Consultar operação | `GET /operations` | ✅ | ✅ | — | — | 🟢 |
| Consultar Livro do Dia | `GET /daily-book` | ✅ | ✅ | — | — | 🟢 |

**Lacuna sistêmica crítica:** Nenhuma rota operacional chama `recordAudit()`. Para qualquer ação de escrita executada por IA, auditoria deve ser instrumentada antes.

---

## PARTE 2 — Conhecimento Atual

A IA teria acesso de **leitura** a todos os domínios via API. A distinção é entre o que a IA pode *ler*, o que pode *sugerir com base na leitura*, e o que pode *executar diretamente*.

### Escalas

| Capacidade | Estado |
|---|---|
| **Leitura** | ✅ Completa — GET /scales, /scales/:id, /scales/:id/allocations, /scales/:id/exceptions |
| **Sugestão** | ✅ Alta qualidade — coverage-engine já realiza análise de candidatos com score, tags e conflitos. A IA pode usar esse resultado como base para sugestões narrativas. |
| **Execução** | 🟡 Condicional — gerar escala via `/scales/generate` é seguro; publicar requer confirmação humana. Troca individual de alocação é executável com auditoria. |

### Agenda

| Capacidade | Estado |
|---|---|
| **Leitura** | ✅ Completa — GET /agenda/events com filtros por data, tipo, status |
| **Sugestão** | ✅ Pode sugerir datas de ensaio baseadas em disponibilidade, conflitos de operação e histórico |
| **Execução** | 🟡 Criar rascunho de evento sim; confirmar/cancelar não autônomo |

### Folgas (Restrições)

| Capacidade | Estado |
|---|---|
| **Leitura** | ✅ Completa — tipos: PHYSICAL, HEALTH, SCHEDULE, ROLE, TECHNICAL, PERSONAL |
| **Sugestão** | ✅ Pode correlacionar restrições com cobertura, identificar riscos |
| **Execução** | 🔴 A IA nunca deve criar, modificar ou remover restrições de saúde/físicas. São dados sensíveis de RH. |

### Avisos

| Capacidade | Estado |
|---|---|
| **Leitura** | ✅ Completa — GET /my-notices, GET /notices com filtros |
| **Sugestão** | ✅ Pode sugerir texto de aviso baseado em contexto operacional |
| **Execução** | 🟡 Rascunho sim; publicação autônoma não — risco de notificação push indevida para toda a equipe |

### Notificações

| Capacidade | Estado |
|---|---|
| **Leitura** | ✅ GET /notifications com filtros por categoria (schedule, book, notice, approval, responsibility, message, system) |
| **Sugestão** | ✅ Pode resumir pendências de um usuário |
| **Execução** | ✅ `notificationService` já é usado internamente por outras rotas. A IA pode disparar notificações operacionais via o serviço existente. |

### Livro do Dia

| Capacidade | Estado |
|---|---|
| **Leitura** | ✅ Completa — GET /daily-book/:id, delta de mudanças, posições, cenas, blocos |
| **Sugestão** | ✅ Alta qualidade — delta disponível via `/daily-book/:id/delta` para sumarização de mudanças |
| **Execução** | 🔴 Geração e publicação do livro requerem supervisão. Modificar posições/cenas de um livro já publicado tem impacto direto no show. |

### Responsabilidades

| Capacidade | Estado |
|---|---|
| **Leitura** | ✅ Completa — GET /responsibilities com filtros por categoria, operação, membro, `unassigned=true` |
| **Sugestão** | ✅ Identificar responsabilidades sem dono, sugerir candidatos por tags/histórico |
| **Execução** | 🟡 Atribuir responsabilidade pode ser executado pela IA mediante confirmação do ADMIN |

### Mensagens

| Capacidade | Estado |
|---|---|
| **Leitura** | 🔴 **Proibido para conteúdo de mensagens** — ver Parte 5 |
| **Sugestão** | 🟡 Apenas metadados (existe thread aberta sobre X) sem ler conteúdo |
| **Execução** | 🔴 A IA nunca envia mensagens em nome de um usuário sem confirmação explícita |

---

## PARTE 3 — Permissões

### Mapa de Permissões por Papel

| Ação de IA | ADMIN | SUPERVISOR_A/B | MEMBER |
|---|---|---|---|
| Consultar agenda | ✅ | ✅ | ✅ (própria) |
| Consultar escala | ✅ | ✅ | ✅ (própria) |
| Consultar cobertura | ✅ | ✅ | ❌ |
| Consultar responsabilidades | ✅ | ✅ | ✅ (atribuídas) |
| Consultar folgas da equipe | ✅ | ✅ | ❌ (apenas própria) |
| Consultar Livro do Dia | ✅ | ✅ | ✅ |
| Criar rascunho de aviso | ✅ | ✅ | ❌ |
| Publicar aviso (via IA) | 🟡 confirmar | 🟡 confirmar | ❌ |
| Gerar escala (via IA) | ✅ | ✅ | ❌ |
| Publicar escala (via IA) | 🟡 confirmar | 🟡 confirmar | ❌ |
| Trocar alocação na escala | 🟡 confirmar | 🟡 confirmar | ❌ |
| Criar ensaio | 🟡 confirmar | 🟡 confirmar | ❌ |
| Cancelar ensaio | 🔴 humano | 🔴 humano | ❌ |
| Aprovar/negar solicitação | 🔴 humano | 🔴 humano | ❌ |
| Atribuir responsabilidade | 🟡 confirmar | ❌ | ❌ |
| Ler mensagens de outros | ❌ | ❌ | ❌ |
| Enviar mensagem por usuário | ❌ | ❌ | ❌ |

**Legenda:**
- ✅ Permitido e seguro
- 🟡 Permitido somente com confirmação humana explícita
- 🔴 Nunca autônomo — apenas sugestão ao humano
- ❌ Não permitido

---

### Elevações de Privilégio — Riscos Identificados

**1. Personificação de papel.** Se a IA tiver acesso ao token de um usuário e executar ações em nome dele, ela herda todos os privilégios desse usuário. Um ADMIN que peça "publique este aviso" dá à IA permissão de ADMIN para publicar — sem distinção de que foi iniciativa da IA, não do humano.

**Mitigação:** A IA deve operar com um token de serviço com papel próprio `AI_SERVICE`, com escopo mínimo necessário (somente leitura por padrão; escrita mediante confirmação explícita com auditoria).

**2. Comandos em cadeia.** "Troque todos que têm restrição SCHEDULE no show de sábado" pode resultar em múltiplas alterações de alocação sem revisão individual. Uma troca pode resolver uma cobertura e criar outra descoberta invisível.

**Mitigação:** A IA deve apresentar o plano completo de todas as trocas antes de executar qualquer uma. Confirmação única para o lote, não por ação individual invisível.

**3. Acesso a dados sensíveis via filtros.** Restrições do tipo HEALTH (doenças, condições médicas) e PHYSICAL são dados sensíveis de RH. Consultar "quem tem restrição de saúde?" expõe informação que não deveria aparecer em resumos ou logs.

**Mitigação:** A IA nunca deve citar o *tipo* de restrição de saúde de uma pessoa. Deve usar apenas "indisponível por restrição" sem especificar a natureza.

---

### Comandos Perigosos

| Ação | Por quê é perigosa |
|---|---|
| `POST /agenda/events/:id/cancel` | Irreversível. Cancela evento com notificações para toda a equipe. |
| `POST /requests/:id/decision` | Decisão imediata. Aprovação/negação de folga afeta a pessoa e a cobertura. |
| `POST /scales/:id/publish` | Publica escala para toda a equipe. Erro visível a todos. |
| `DELETE /daily-book/:id/positions/:positionId` | Remove posição do livro do show. Sem undo. |
| `POST /notices/:id/publish` com urgência CRITICAL | Dispara push notification para todos os membros. |

---

## PARTE 4 — Explicabilidade

### Estado Atual

Não existe nenhum sistema de explicabilidade implementado. O coverage-engine retorna `priorityScore`, `rejectionReason` e `exception` para cada posição — esses dados são usados pelo Painel Operacional mas não são expostos em linguagem natural para o usuário.

### Modelo Desejado para Respostas da IA

Toda resposta de IA que envolva uma sugestão operacional deve seguir o seguinte formato:

```
CONCLUSÃO
→ Sugiro substituir Carlos por Mariana na posição Técnico de Som no show de sábado.

DADOS ANALISADOS
→ Carlos: restrição SCHEDULE ativa (19–21/06), confirmada em /restrictions
→ Mariana: sem restrições no período, compatível com tags [som, técnico]
→ Cobertura atual sem Mariana: 4/5 posições cobertas (aceitável)

MOTIVO
→ Mariana tem o maior priorityScore (32) entre os candidatos disponíveis para a posição.
   Carlos continua na escala para outros turnos fora da restrição.

ALTERNATIVAS
→ Pedro: score 24, disponível, tags incompletas (falta certificação de som)
→ Contratar externo: não há registro de tags na operação

RISCOS
→ Mariana já está alocada em outra posição no mesmo show.
   Confirmar se a dupla alocação é intencional.
```

### O Que a IA Nunca Deve Omitir

- Quais dados foram consultados para chegar à conclusão
- Existência de riscos ou conflitos — mesmo que não impeçam a ação
- Alternativas disponíveis, mesmo que piores
- Que a ação final requer confirmação humana

---

## PARTE 5 — Mensagens e Privacidade

### Tipos de Mensagem no Sistema

O MyASA possui dois tipos de thread de mensagem:

**1. Threads Contextuais (Operacionais)**
Vinculadas a um objeto: `contextType` ∈ {SCALE, DAILY_BOOK, AGENDA, NOTICE, REQUEST, OPERATIONAL_CHANGE}. São discussões sobre um item operacional específico (ex: "comentários sobre a escala do show de sábado").

**2. Threads Diretas (`DIRECT`)**
Conversas privadas entre usuários. Sem contexto operacional.

---

### Nível de Acesso da IA — Posicionamento

| Nível | Descrição | Recomendação |
|---|---|---|
| **Nível 0** | Nenhum acesso a mensagens | Para MEMBER |
| **Nível 1** | Apenas metadados (thread existe, tem X mensagens não lidas) | ✅ Adequado para IA em contexto MEMBER |
| **Nível 2** | Apenas avisos (`/my-notices`) | ✅ Adequado para resumo de contexto |
| **Nível 3** | Threads operacionais (contextuais) com permissão do participante | 🟡 Somente se o usuário autenticado for participante |
| **Nível 4** | Resumos de threads operacionais | 🟡 Apenas operacionais, nunca diretas |

**Posição recomendada para IA em lançamento:** Nível 2 (apenas avisos) + Nível 1 (metadados de threads contextuais se o usuário autenticado for participante).

---

### Riscos de Privacidade

| Risco | Gravidade | Mitigação |
|---|---|---|
| IA lê conversa privada de dois membros | Alta | Nunca acessar threads DIRECT |
| IA cita conteúdo de mensagem em resposta a terceiro | Alta | IA nunca cita conteúdo de mensagem; apenas confirma existência de discussão |
| IA resume negociação interna de supervisores | Média | Resumos só com consentimento explícito do solicitante que participa da thread |
| IA acessa threads de todos os grupos sem filtro | Alta | Sempre filtrar por `userId` do usuário autenticado como participante |
| Logs de IA armazenam conteúdo de mensagem | Alta | Logs de IA nunca devem conter fragmentos de mensagens |

### Informações Que Nunca Devem Ser Expostas

- Conteúdo de threads `DIRECT` (mensagens privadas entre pessoas)
- Tipo específico de restrição de saúde de qualquer pessoa
- Histórico de decisões negadas em solicitações (apenas o solicitante e os gestores devem ver)
- Informações financeiras (se houver no futuro)
- Dados de avaliação de desempenho individual (não existe no sistema, não deve ser inferido)

---

## PARTE 6 — Limites da IA

### A IA Nunca Deve

| Limite | Motivo |
|---|---|
| Punir pessoas | Não há mecanismo de punição no MyASA. Qualquer menção a penalidade cria risco jurídico e de RH. |
| Avaliar desempenho individual | O MyASA não tem módulo de performance. A IA não tem dados suficientes e nunca deve inferir "João performa mal". |
| Decidir escalas sozinha | Escalas envolvem julgamento de contexto humano (motivação, conflitos interpessoais, saúde emocional) invisíveis para a IA. |
| Aprovar folgas sozinha | Aprovação de afastamento tem implicações de RH e cobertura que requerem julgamento humano. |
| Expor mensagens privadas | Violação de privacidade. |
| Divulgar tipo de restrição HEALTH/PHYSICAL | Dado sensível de saúde. |
| Substituir supervisores | A IA é uma ferramenta de apoio, nunca uma autoridade operacional. |
| Executar múltiplas ações em cadeia sem revisão intermediária | Risco de efeito cascata irreversível. |
| Agir sem rastrear a ação | Toda escrita deve gerar auditoria. |

### A IA Sempre Deve

| Obrigação | Implementação |
|---|---|
| Sugerir, não decidir | Apresentar recomendação; aguardar confirmação para execução |
| Justificar | Mostrar dados que embasam a sugestão |
| Explicar | Usar linguagem operacional simples, não técnica |
| Registrar | Toda ação executada deve ir para `securityAuditLogTable` com `actorId` do usuário confirmante, não da IA |
| Revelar alternativas | Sempre mostrar pelo menos uma alternativa à sugestão principal |
| Indicar riscos | Jamais omitir um conflito detectado, mesmo que não impeça a ação |
| Respeitar o papel do usuário | Nunca sugerir ações que o usuário autenticado não tem permissão de executar |

---

## PARTE 7 — Futuro Pós-Piloto

### Classificação de Funcionalidades

#### 🟢 Implementar Logo (AI-D02)

| Funcionalidade | Justificativa |
|---|---|
| **Resumo diário personalizado** | Dados disponíveis em `/my-day`. Alta utilidade operacional. Impacto zero em escrita. |
| **Alerta de cobertura descoberta** | Coverage-engine já calcula. A IA traduz o resultado em linguagem natural e notifica proativamente via `notificationService`. |
| **Responsabilidades sem dono** | `/responsibilities?unassigned=true` existe e está integrado ao Meu Dia. IA pode alertar e sugerir candidatos. |
| **Sugestão de troca de alocação** | Coverage-engine fornece candidatos ranqueados. IA apresenta sugestão com dados; supervisor confirma. |
| **Resumo de mudanças no Livro do Dia** | `/daily-book/:id/delta` disponível. IA traduz delta em mensagem operacional humana. |
| **Consulta de disponibilidade** | "João está disponível no sábado?" — cruza agenda + restrições + escalas. Pura leitura. |

#### 🟡 Avaliar (AI-D03+)

| Funcionalidade | Condição |
|---|---|
| **Criar rascunho de aviso** | Requer revisão obrigatória antes de publicar. Implementar com confirmação explícita. |
| **Sugestão de resposta a solicitações** | IA pode analisar e recomendar APPROVE/DENY com justificativa. Humano executa. |
| **Pessoas sobrecarregadas** | Insights de carga de trabalho existem via `/insights/workload`. IA pode alertar gestores. Sensível — nunca expor ao próprio membro. |
| **Conflitos operacionais** | Detectar duas escalas sobrepostas para o mesmo membro. Pura leitura. Sensível se exposto indevidamente. |
| **Resumo de avisos pendentes** | Ler `/my-notices` e sumarizar o que precisa de confirmação. Útil. Requer cuidado com urgência CRITICAL. |

#### 🔴 Não Implementar

| Funcionalidade | Motivo |
|---|---|
| **Aprovação autônoma de folgas** | Impacto em RH. Requer julgamento humano. |
| **Cancelamento autônomo de eventos** | Irreversível, alto impacto. |
| **Acesso a mensagens diretas** | Privacidade inviolável. |
| **Avaliação de desempenho individual** | Não há dados adequados. Risco jurídico e de RH. |
| **Substituição autônoma em escala sem confirmação** | Pode quebrar cobertura em cascata. |
| **Comunicação com membros em nome de supervisores** | Personificação. Cria ambiguidade de autoridade. |
| **Acesso a dados de saúde com nomeação** | Sensível. Viola privacidade médica. |

---

## PARTE 8 — Perguntas Obrigatórias

### 1. O que a IA faz hoje?

**Nada.** O MyASA não possui IA integrada. O coverage-engine é um algoritmo determinístico de pontuação de candidatos, e os insights são analytics SQL. Não há nenhum modelo de linguagem, chatbot ou assistente conversacional no sistema.

---

### 2. O que realmente funciona?

Do ponto de vista de *substrato para uma futura IA*:

- ✅ **Coverage-engine** — analisa candidatos com score, tags, restrições e conflitos. Base sólida para sugestões de escala.
- ✅ **API completa de leitura** — todos os domínios têm endpoints GET funcionais e protegidos.
- ✅ **notificationService** — infraestrutura de notificação lista para a IA disparar alertas operacionais.
- ✅ **Meu Dia** — endpoint `/my-day` compila visão individualizada. Ponto de entrada natural para IA personalizada.
- ✅ **Daily Book delta** — diferencial de versão disponível via API. Base para sumarização de mudanças.

---

### 3. O que ninguém usa?

- **`GET /scales/:id/exceptions`** — retorna exceções detectadas pelo coverage-engine (posições sem candidato, conflitos). Dado de alta qualidade que o Painel Operacional exibe mas que nenhum fluxo da IA consumiria atualmente.
- **`GET /insights/trends`** — tendências históricas disponíveis mas não apresentadas em lugar nenhum do frontend.
- **`GET /daily-book/:id/delta`** — diferencial de versão do livro. Disponível na API; o frontend exibe de forma limitada. A IA poderia transformar esse dado em linguagem natural ("o número de cenas mudou de 12 para 14; 2 posições foram adicionadas ao bloco 3").

---

### 4. O que oferece risco?

| Risco | Gravidade | Origem |
|---|---|---|
| Execução de ação sem auditoria | Alta | Nenhuma rota operacional chama `recordAudit()` |
| Acesso a dados de saúde (restrições HEALTH/PHYSICAL) | Alta | API de restrições não filtra tipo sensível |
| Publicação de aviso com urgência CRITICAL via IA | Alta | Um aviso publicado incorretamente dispara push para toda a equipe |
| Aprovação de solicitação de folga sem revisão humana | Alta | `POST /requests/:id/decision` é imediato, sem confirmação |
| Personificação de usuário | Alta | IA com token de usuário tem acesso irrestrito ao papel desse usuário |
| Comandos em cadeia sem revisão | Média | Múltiplas trocas de escala podem criar descobertas em cascata |
| Leitura de threads DIRECT | Alta | API de mensagens disponível sem filtro de tipo no endpoint |

---

### 5. O que falta?

Para uma IA operacional minimamente segura:

1. **Auditoria em rotas operacionais** — `recordAudit()` deve ser chamado em toda ação de escrita (agenda, escalas, avisos, solicitações, daily-book).
2. **Token de serviço `AI_SERVICE`** — papel próprio com escopo mínimo e auditoria diferenciada.
3. **Filtro de tipo sensível em `/restrictions`** — API deve ter opção de retornar apenas disponibilidade (sim/não) sem expor tipo de restrição.
4. **Mecanismo de confirmação** — endpoint `POST /ai/pending-actions/:id/confirm` para operações que requerem aprovação humana antes de execução.
5. **Integração de LLM** — não existe nenhum modelo de linguagem; o projeto tem skills disponíveis (Anthropic, OpenAI, Gemini) mas nenhum está configurado.

---

### 6. O que nunca deve existir?

- IA com capacidade de aprovação autônoma de qualquer decisão que afete pessoas (folgas, substituições definitivas, cancelamentos).
- IA com acesso ao conteúdo de mensagens diretas (`DIRECT`) de qualquer usuário.
- IA que cite dados de saúde de pessoas pelo nome.
- IA que execute ações sem registro de auditoria rastreável ao usuário confirmante.
- IA que envie avisos em nome de supervisores sem que o supervisor tenha confirmado o conteúdo.
- IA que tome decisões de RH (demissão, advertência, avaliação de performance).

---

### 7. Qual o nível de maturidade atual?

**Nível 0 de 5 — Substrato Disponível, IA Inexistente.**

| Dimensão | Nível | Descrição |
|---|---|---|
| Dados disponíveis | 4/5 | API completa, bem estruturada, domínios cobertos |
| Infraestrutura de IA | 0/5 | Nenhum LLM integrado; zero conversas, zero histórico |
| Auditoria de ações | 1/5 | `recordAudit()` existe mas não é chamado em operações |
| Mecanismo de confirmação | 0/5 | Inexistente |
| Explicabilidade | 1/5 | Coverage-engine tem `rejectionReason` mas não exposto como narrativa |
| Privacidade de dados | 2/5 | Sem filtro de dados sensíveis para consumo de IA |
| RBAC para IA | 0/5 | Nenhum papel específico para agente de IA |

---

### 8. A IA está pronta para piloto?

**Não.** Para um piloto seguro, são necessários no mínimo:

1. ✅ Auditoria instrumentada nas rotas operacionais principais
2. ✅ Papel `AI_SERVICE` com token próprio
3. ✅ Mecanismo de confirmação antes de qualquer escrita
4. ✅ Integração de LLM (Anthropic via Replit AI Integrations é o caminho mais direto)
5. ✅ Filtro de sensibilidade em dados de saúde/restrição

Os pontos 1-3 são mudanças de API. Os pontos 4-5 são novos módulos. Estimativa de esforço para piloto seguro: **AI-D02 (implementação mínima segura)** + **AI-D03 (funcionalidades de conversa)**.

---

## Entregável Complementar: Roadmap AI-D02

### Objetivo do AI-D02

Implementar a base técnica mínima para que uma IA operacional possa ser integrada ao MyASA de forma segura e auditável.

### Escopo

#### Bloco A — Segurança e Auditoria (pré-requisito)
- `A01` Instrumentar `recordAudit()` nas rotas: `agenda`, `scales`, `notices`, `requests`, `daily-book`, `responsibilities`
- `A02` Criar papel `AI_SERVICE` no `userRoleEnum` com token de serviço
- `A03` Endpoint `POST /ai/actions/confirm` — mecanismo de confirmação de ação pendente

#### Bloco B — Inteligência de Leitura (sem risco)
- `B01` Integração de LLM via Replit AI Integrations (Anthropic)
- `B02` Endpoint `POST /ai/ask` — responde perguntas operacionais em linguagem natural (somente leitura)
- `B03` Ferramentas de leitura: `get_my_day`, `get_coverage`, `get_restrictions`, `get_scale`, `get_daily_book_delta`, `get_responsibilities`

#### Bloco C — Sugestões Operacionais (read + suggest)
- `C01` Ferramenta `suggest_scale_swap` — usa coverage-engine e retorna plano com dados + confirmação
- `C02` Ferramenta `suggest_notice_draft` — gera rascunho de aviso para revisão humana
- `C03` Alerta proativo de cobertura descoberta via `notificationService`

#### Bloco D — Interface (UX da IA)
- `D01` Tela de chat no mobile (seção "Assistente" no menu Mais)
- `D02` Widget de sugestão no Painel Operacional web-admin
- `D03` Histórico de conversas por sessão

### Fora do Escopo de AI-D02

- Aprovação autônoma de qualquer ação
- Acesso a mensagens privadas
- Avaliação de performance
- Comandos de escrita sem confirmação humana

---

*Este documento não implica mudanças de código. Toda implementação deve ser aprovada como task separada (AI-D02 em diante).*
