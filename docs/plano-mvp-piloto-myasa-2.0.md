# MyASA 2.0 — Plano Oficial do MVP Piloto ASA

> **Versão:** 18/06/2026
> **Fase:** Planejamento de Construção — arquitetura funcional congelada
> **Base:** Backlog Mestre · Auditoria Final · 17 superfícies · 131 decisões formais
> **Status:** 🟢 Pronto para Construção

---

## Premissa

A arquitetura funcional está congelada. Nenhuma nova funcionalidade. Nenhum novo pilar. As decisões técnicas pendentes (A-03, A-05, S-07) são encerradas neste documento com justificativa formal.

**O objetivo é único:** transformar o backlog em uma sequência de sprints executável que entrega o produto nas mãos de usuários reais no menor tempo possível com o menor risco possível.

---

## PARTE 1 — DEFINIÇÃO DO PILOTO

---

### O que significa sucesso para o piloto?

O piloto é bem-sucedido quando uma equipe real consegue operar uma semana de shows **sem usar WhatsApp para comunicação operacional**. Não como experimento — como modo de trabalho real.

Sucesso não é os usuários gostarem do produto. Sucesso é os usuários **precisarem** do produto para trabalhar.

---

### Configuração do piloto

| Parâmetro | Definição | Justificativa |
|---|---|---|
| **Duração** | 4 semanas de operação real | Suficiente para shows repetidos, padrões emergirem e vícios de uso se revelarem |
| **Operação** | 1 única Operação ativa | Elimina variáveis de multi-operação. O produto é testado no núcleo, não na borda. |
| **Supervisores** | 1 Supervisor ativo no piloto | 1 Supervisor = 1 voz de feedback coerente. Múltiplos Supervisores dividem atenção e aumentam risco de conflito de fluxo. |
| **Membros** | 15 a 25 membros | Abaixo de 15: amostra insuficiente. Acima de 25: risco operacional alto para o Supervisor pilotar simultaneamente. |
| **Admin** | 1 Admin responsável pelo piloto | O Admin é o parceiro técnico da equipe de produto durante o piloto. |
| **Perfis presentes** | Admin + 1 Supervisor + 15-25 Membros | Representa o ciclo operacional completo. |
| **Tipo de shows** | Shows reais do calendário da ASA | Dados reais. Urgências reais. Reações reais. |

---

### O menor grupo capaz de validar o produto

Um grupo com **1 Supervisor + 15 Membros + shows regulares** já valida:
- O ciclo de alocação e publicação (Escala)
- O fluxo de pedidos formais (Solicitações)
- A visibilidade do Membro sobre o próprio dia (Meu Dia)
- A gestão de exceções pelo Supervisor (Painel Operacional)
- A comunicação de mudanças (Notificações)

Esse é o grupo mínimo. O piloto deve ter entre 15 e 25 membros para ter variedade de comportamentos e situações operacionais reais.

---

### Semana de pré-piloto (obrigatória)

A semana imediatamente anterior ao início do piloto é dedicada a:
1. Admin configura toda a estrutura organizacional no sistema (Operação, Grupos, Membros)
2. Admin e Supervisor configuram o Livro do Show e a Agenda
3. Supervisor publica a primeira Escala (sem mostrar aos Membros — teste de sistema)
4. Membros instalam o aplicativo e fazem login
5. Supervisor faz uma Publicação de Escala real — Membros recebem notificação e confirmam

Apenas após essa semana o piloto inicia com shows reais.

---

## PARTE 2 — MVP PILOTO — CLASSIFICAÇÃO DOS ÉPICOS

---

### Tabela de classificação para o piloto

| Épico | Status no piloto | Justificativa |
|---|---|---|
| **Epic 00 — Infra Base** | 🔴 Obrigatório | Nada funciona sem isso |
| **Epic 01 — Fundação Organizacional** | 🔴 Obrigatório | Sem estrutura, ninguém tem identidade no sistema |
| **Epic 02 — Livro do Show + Agenda** | 🔴 Obrigatório | Sem template e calendário, não há shows para escalar |
| **Epic 03 — Escala** | 🔴 Obrigatório | É o núcleo do produto — o loop começa aqui |
| **Epic 04 — Solicitações** | 🔴 Obrigatório | Sem isso, os pedidos voltam para o WhatsApp |
| **Epic 05 — Meu Dia + Painel Operacional** | 🔴 Obrigatório | Sem isso, nenhum usuário tem razão de abrir o app |
| **Epic 07 — Avisos** | 🟡 Importante | Aumenta a completude da comunicação. Entra na semana 3 do piloto como expansão. |
| **Epic 06 — Livro do Dia** | 🟡 Importante | Detalha o show. Valioso mas não crítico na semana 1. Entra na semana 2 do piloto. |
| **Epic 08 — Histórico** | 🟡 Importante | Admin precisa auditar ao final do piloto. Versão básica entra no final da Fase 1. |
| **Epic 09 — Painel de Saúde** | ⬜ Pode esperar | 1 Operação e 1 Admin monitorando ativamente não precisam de dashboard. Pós-piloto. |
| **Epic 10 — Entregas** | ⬜ Pode esperar | Compliance de conteúdo não é o núcleo do ciclo operacional. Pós-piloto. |
| **Epic 11 — Mensagens** | ⬜ Pode esperar | O ciclo operacional funciona sem Mensagens. Pós-piloto. |
| **Epic 12 — Biblioteca** | ⬜ Pode esperar | Repositório de conhecimento é valioso mas não operacionalmente crítico para o piloto. |
| **Epic 13 — IA** | ⬜ Pode esperar | Motor determinístico substitui no piloto. LLM entra na Fase 4. |

---

## PARTE 3 — CORTE DE ESCOPO DO PILOTO

---

### O que explicitamente NÃO entra no piloto

| Funcionalidade | Épico | Justificativa do corte |
|---|---|---|
| **IA conversacional (LLM)** | Epic 13 | Motor determinístico cobre o piloto. LLM adiciona custo, latência e dependência externa desnecessária antes de ter dados reais de uso. |
| **S-03 Painel de Saúde** | Epic 09 | Com 1 Operação, o Admin monitora diretamente. Dashboard sem escala não gera valor real. |
| **S-07 Entregas** | Epic 10 | Compliance de conteúdo não é urgência operacional. O piloto valida o ciclo de alocação e comunicação — não de formação. |
| **S-09 Mensagens** | Epic 11 | O loop operacional funciona sem canal de esclarecimento formal no piloto. WhatsApp pode continuar para conversas contextuais durante o piloto — apenas a comunicação operacional oficial migra. |
| **S-14 Biblioteca** | Epic 12 | Repositório de conhecimento é valioso em escala. No piloto com 15-25 membros e 1 Operação, o conhecimento operacional cabe em outros canais. |
| **Coordenação Supervisor ↔ Supervisor** | Epic 11 | Piloto tem 1 Supervisor. Sem conflito de multi-Supervisor a resolver. |
| **Conflito de Operações simultâneas** | Governança | Piloto tem 1 Operação. O fluxo de conflito não existe no contexto do piloto. |
| **Bulk import de membros** | P3 | Piloto tem 15-25 membros — cadastro manual é viável e controlável. |
| **Delegações complexas** | Epic 01 | Delegação básica (Supervisor ausente) implementada. Delegações encadeadas ficam para pós-piloto. |
| **Compromissos pessoais na Agenda** | Epic 02 | No piloto, o Supervisor conhece o calendário do grupo. Conflitos pessoais são informados via Solicitação. |
| **Motor de cobertura — 4ª camada (histórico de função)** | Epic 03 | Motor com 3 camadas cobre o piloto: sem restrição, sem folga, sem conflito de horário. A 4ª camada (experiência histórica) entra pós-piloto. |
| **Versionamento do Livro do Show — Tipo A estrutural** | Epic 02 | No piloto, o template não é alterado estruturalmente. Apenas configurações menores. |
| **Multi-operação no Admin** | Epic 01 | Piloto tem 1 Operação. Admin vê apenas essa. |
| **In-app banner (web)** | Infra | Decisão A-03 encerrada: push-only no piloto. |

---

## PARTE 4 — ORDEM DE CONSTRUÇÃO — SPRINTS

---

### Configuração dos sprints

**Duração de cada sprint:** 2 semanas
**Total de sprints para entrega do piloto:** 5 sprints (10 semanas)
**Equipe mínima por sprint:** 2 desenvolvedores backend + 1 desenvolvedor mobile + 1 designer (UX/UI paralelo)
**Metodologia:** cada sprint entrega features funcionais e testáveis — sem "sprints de infra pura" que não são verificáveis pelo PO

---

### Sprint 1 — "O sistema existe"

**Duração:** semanas 1–2
**Objetivo:** o Admin consegue criar a organização completa. Nenhum outro fluxo funciona — mas a base está pronta e testada.

**Features do Sprint 1:**

*Infra Base (Epic 00):*
- 00.01 Autenticação completa (registro, login, refresh, logout) — web + mobile
- 00.03 Schema de banco de dados v1 (organizations, users, groups, operations, roles, permissions, restrictions)
- 00.04 API REST base com middleware de autenticação e controle de acesso por perfil
- 00.09 Mobile shell (Expo + navigation base + auth flow)
- 00.10 Web shell (React + Vite + routing base + auth flow)

*Fundação Organizacional (Epic 01) — parte:*
- 01.01 Criação e configuração de Operação
- 01.02 Criação e gestão de Grupos Operacionais
- 01.03 Cadastro e edição de membros (nome, perfil, foto, contato)
- 01.04 Gestão de papéis (Admin / Supervisor A / Supervisor B / Membro)
- 01.06 Fluxo de setup obrigatório (wizard sequencial para Admin — web)

**Dependências:** nenhuma (primeiro sprint)

**Critério de aceite do Sprint 1:**
- [ ] Admin cria conta e entra na plataforma (web)
- [ ] Admin completa o wizard: cria Operação → cria 2 Grupos → cadastra 5 membros → atribui papéis
- [ ] Membro faz login no aplicativo mobile com as credenciais criadas pelo Admin
- [ ] Perfis diferentes têm acesso a telas diferentes (Admin vê gestão, Membro vê apenas seu perfil)
- [ ] Nenhum erro de autenticação em 20 ciclos de login/logout consecutivos

---

### Sprint 2 — "O show existe"

**Duração:** semanas 3–4
**Objetivo:** o Livro do Show está criado. A Agenda tem shows cadastrados. O template e o calendário existem como base para tudo que vem depois.

**Features do Sprint 2:**

*Fundação Organizacional (Epic 01) — restante:*
- 01.07 Restrições de membro (6 tipos: registro, período, categorias)
- 01.08 Desativação e arquivamento de membros
- 01.10 Configuração de limiares de saúde básica (valores default)

*Livro do Show + Agenda (Epic 02):*
- 02.01 Criação e edição de Livro do Show
- 02.02 Estrutura de blocos, papéis e cobertura mínima
- 02.03 Versionamento básico (Tipo B — configurações) — Tipo A estrutural: pós-piloto
- 02.05 Criação e gestão de eventos na Agenda (5 tipos MVP)
- 02.06 Visualização da Agenda (calendário + lista) — web e mobile

*Infra — notificação (Epic 00):*
- 00.05 Push notification: registro de device, envio básico, prioridades
- 00.08 Filas de mensagens (para propagações assíncronas futuras)

**Dependências:** Sprint 1 completo

**Critério de aceite do Sprint 2:**
- [ ] Admin cria Livro do Show com ao menos 3 papéis e 2 blocos
- [ ] Admin registra 5 shows na Agenda em datas futuras
- [ ] Supervisor visualiza a Agenda no web e mobile
- [ ] Membro visualiza os shows da Agenda no mobile
- [ ] Admin registra restrição para 1 membro e o sistema a exibe na tela de perfil
- [ ] Device de teste recebe notificação push após ação de teste no backend

---

### Sprint 3 — "A alocação existe"

**Duração:** semanas 5–6
**Objetivo:** o Supervisor consegue alocar membros em shows, visualizar posições em aberto, e publicar a Escala. É o coração técnico do produto.

**Features do Sprint 3:**

*Escala (Epic 03):*
- 03.01 Visualização da Escala por período (semana/mês) — web
- 03.02 Criação e edição de alocações individuais
- 03.03 Motor de cobertura — 3 camadas (sem restrição + sem folga + sem conflito de horário)
- 03.04 Cálculo de cascata antes de confirmar substituição
- 03.05 Detecção de conflitos de horário e restrições ativas
- 03.06 Estados de posição: Coberta / Em Risco / Em Aberto
- 03.07 Publicação de Escala (com confirmação explícita se há alertas abertos)
- 03.08 Republicação de Escala
- 03.09 Rastreamento de confirmações de mudança por membro
- 03.11 Substituição emergencial — fluxo de urgência

*Infra — MO:*
- 00.06 Entidade MO — criação automática após publicação de Escala com mudança

*Mobile — Meu Dia básico:*
- 05.01 Composição mínima do Meu Dia: próxima atividade (somente, sem complementos ainda)
- 05.02 Flag de alteração desde última abertura (versão básica)

**Dependências:** Sprint 2 completo

**Critério de aceite do Sprint 3:**
- [ ] Supervisor cria Escala para um show real com 5 posições
- [ ] Motor de cobertura lista candidatos para posição em aberto em ordem de adequação
- [ ] Supervisor publica Escala — sistema exige confirmação se há posição Em Aberto
- [ ] Membro afetado por mudança recebe notificação push
- [ ] Membro abre Meu Dia e vê a próxima atividade com o papel correto
- [ ] Membro vê flag visual de "algo mudou desde a última vez que você abriu"
- [ ] Substituição emergencial: Supervisor remove membro → sistema sugere substitutos → Supervisor confirma → MO criada automaticamente

---

### Sprint 4 — "O pedido existe"

**Duração:** semanas 7–8
**Objetivo:** o Membro consegue fazer uma Solicitação formal dentro do produto. O Supervisor decide com informação de impacto. O Membro vê o resultado no Meu Dia.

**Features do Sprint 4:**

*Solicitações (Epic 04) — tipos P0:*
- 04.01 Solicitação de Folga (tipo mais frequente — P0)
- 04.02 Solicitação de Restrição (segundo mais frequente — P0)
- 04.08 Análise de impacto automática antes da tela de decisão
- 04.09 Decisão: Aprovar
- 04.10 Decisão: Negar (motivo obrigatório — sem campo de motivo = botão bloqueado)
- 04.11 Decisão: Proposta Alternativa
- 04.12 Aceitação/Recusa de Proposta Alternativa pelo Membro
- 04.13 Geração automática de MO após aprovação
- 04.14 Propagação da MO para Escala (folga aprovada → posição do membro flagged)
- 04.15 Notificação ao Membro após decisão
- 04.16 Priorização por data de impacto (não data de criação)

*Solicitações (Epic 04) — tipos P1 (implementados mas com menor destaque):*
- 04.03 Troca de Folga
- 04.04 Chegada Tardia
- 04.05 Saída Antecipada

*Meu Dia (Epic 05) — completar:*
- 05.03 Confirmações pendentes no Meu Dia
- 05.04 Linha do tempo do dia completo (sob demanda)
- 05.05 Status de Solicitações em aberto no Meu Dia
- 05.07 Hierarquia de urgência aplicada (regra formal)
- 05.08 Estado "sem novidades" — confirmação visual

**Dependências:** Sprint 3 completo

**Critério de aceite do Sprint 4:**
- [ ] Membro cria Solicitação de Folga para uma data futura — fluxo completo no mobile
- [ ] Supervisor vê análise de impacto automática antes de decidir (quantas posições afetadas, quem cobre)
- [ ] Supervisor nega Solicitação — campo de motivo é obrigatório (botão bloqueado sem preenchimento)
- [ ] Membro recebe notificação push da decisão e abre o Meu Dia para ver o resultado
- [ ] Solicitação aprovada → MO criada → Escala flagged com posição desprotegida
- [ ] Solicitações do Supervisor são ordenadas por data de impacto, não por data de criação
- [ ] Membro abre Meu Dia sem novidades → vê estado "Tudo certo — nada mudou desde ontem"

---

### Sprint 5 — "O loop está completo"

**Duração:** semanas 9–10
**Objetivo:** o Supervisor tem visão de exceções priorizadas. O ciclo completo funciona end-to-end. O sistema está pronto para onboarding da equipe piloto.

**Features do Sprint 5:**

*Painel Operacional (Epic 05):*
- 05.09 Status geral da operação (Pronto / Atenção / Crítico)
- 05.10 Lista de exceções priorizadas por impacto e tempo até início
- 05.11 Rastreamento de confirmações pendentes no Painel
- 05.12 Multi-horizonte: riscos dos próximos 3 dias
- 05.13 Badge de Solicitações aguardando análise

*Solicitações (Epic 04) — tipos restantes:*
- 04.06 Ajuste de Escala
- 04.07 Solicitação Excepcional
- 04.17 Histórico de decisões por Supervisor

*Livro do Dia — versão básica para o piloto (Epic 06):*
- 06.01 Geração automática de proposta
- 06.03 Publicação do Livro do Dia
- 06.06 Detecção de desatualização automática
- 06.07 Estados básicos (RASCUNHO / PUBLICADO / DESATUALIZADO)
- 06.08 View do Membro no Livro do Dia (fatia individual)

*Histórico — versão básica (Epic 08):*
- 08.01 Engine de registro automático de eventos por MO
- 08.02 Visualização básica do Histórico (lista por MO)
- 08.07 Histórico contextual de uma Solicitação

*Integração e estabilização:*
- Testes de integração end-to-end do ciclo completo
- Ciclo: Solicitação aprovada → MO → Escala atualizada → Notificação → Meu Dia atualizado → Confirmação do Membro → Histórico registrado
- Performance e stress test com dados de piloto (25 membros, 8 shows por semana)
- Onboarding flow e guia de primeiro uso para cada perfil

**Dependências:** Sprint 4 completo

**Critério de aceite do Sprint 5:**
- [ ] Ciclo completo end-to-end funciona sem intervenção manual:
  - Membro cria Solicitação → Supervisor decide → MO gerada → Escala atualizada → Membro notificado → Membro vê no Meu Dia → Membro confirma → Histórico registrado
- [ ] Supervisor abre Painel Operacional e vê exceções em ordem de urgência (por tempo até início da atividade)
- [ ] Supervisor gera Livro do Dia para show amanhã — proposta gerada automaticamente
- [ ] Admin visualiza Histórico das últimas 48h com eventos agrupados por MO
- [ ] Sistema suporta 25 usuários simultâneos sem degradação de performance (< 2s de resposta para todas as ações principais)
- [ ] Fluxo de onboarding: Admin + Supervisor conseguem completar setup do piloto em menos de 1 hora sem assistência
- [ ] Zero bugs críticos (crash, perda de dados, autenticação quebrada)

---

### Marco do Sprint 5: o piloto está pronto

Após o Sprint 5:
- Semana 11: pré-piloto (setup real da ASA + onboarding da equipe)
- Semanas 12-15: piloto com shows reais (4 semanas)
- Semana 16: análise de dados e decisão de expansão

---

## PARTE 5 — DECISÕES TÉCNICAS PENDENTES — ENCERRAMENTO FORMAL

---

### A-03 — Infraestrutura de Notificação

**Decisão: PUSH-ONLY no MVP Piloto**

**Justificativa:**
1. Membros usam exclusivamente mobile — push notification é o canal correto e suficiente
2. Supervisores e Admin acessam web proativamente — não dependem de banner para verificar exceções
3. In-app banner web adiciona complexidade de implementação (sessão ativa, socket connection, estado de leitura sincronizado web/mobile) sem entregar valor proporcional no piloto
4. Push-only mantém a infra de notificação simples e testável
5. In-app banner para web entra na Fase 2 após o piloto validar que Supervisores precisam de notificação proativa no web (hoje não é evidente)

**Especificação de implementação:**
- Notificações push via FCM (Android) + APNs (iOS)
- 3 níveis de prioridade: CRÍTICO (exige abertura imediata), IMPORTANTE (abre em background), INFORMATIVO (entregue silenciosamente)
- Retry: 3 tentativas com backoff de 30s → 5min → 30min
- Device token atualizado a cada login
- Fallback: se push falha 3 vezes → flag no Meu Dia na próxima abertura
- Confirmação de entrega: distinct de confirmação de leitura. Push entregue ≠ Membro viu o Aviso.

**Registro formal:** NOTIF-D01 — Push-only no MVP Piloto. In-app banner web entra na Fase 2.

---

### A-05 — Motor Determinístico vs. LLM

**Decisão: MOTOR DETERMINÍSTICO no MVP Piloto. LLM na Fase 4.**

**Justificativa:**
1. O valor central do MVP é o ciclo operacional — não a inteligência artificial. O produto precisa provar que o loop funciona antes de potencializar com IA.
2. LLM adiciona: custo de API em produção, latência variável, dependência de terceiro, complexidade de prompts por persona, risco de respostas incorretas com dado operacional real.
3. O motor determinístico cobre TODAS as features críticas do piloto com regras precisas e previsíveis.
4. LLM entra na Fase 4 quando o produto tem dados operacionais reais para treinar e avaliar.

**O que o motor determinístico cobre no piloto:**

| Feature | Implementação determinística |
|---|---|
| Candidatos a substituto | Ranqueamento por 3 camadas: (1) sem restrição ativa, (2) sem folga aprovada, (3) sem conflito de horário. Empate desfeito por tempo na função. |
| Detecção de conflito de Escala | Verificação de sobreposição de horários + restrições ativas no período |
| Cálculo de cascata | Grafo de dependências: cada substituição recalcula disponibilidade dos envolvidos |
| Análise de impacto da Solicitação | Verificação automática de cobertura mínima para cada data afetada |
| MO automática | Trigger determinístico em cada mudança de estado que gera MO (lista formal no mudanca-operacional-myasa-2.0.md) |
| Priorização de exceções no Painel | Regra: urgência = (tempo até início da atividade) × (posição crítica sem cobertura = peso 2) |
| Flag de desatualização no Livro do Dia | Event-driven: qualquer MO que afeta posição no Livro → flag automático |
| Estado de saúde da Operação (básico) | Cálculo por limiares configuráveis: % de posições cobertas, % de Solicitações respondidas em < 48h |

**O que LLM fará na Fase 4 (não no piloto):**

| Feature | Implementação LLM |
|---|---|
| Resumo do dia em linguagem natural | "Bom dia, Carlos — hoje você faz Mercutio às 15h. O horário mudou ontem mas você já confirmou." |
| Narrativa de Histórico | "O que aconteceu com a Escala do dia 14?" → resposta narrativa |
| Análise de padrões organizacionais | "A Equipe A tem concentração de folgas às sextas — risco crescente" |
| Chat livre por perfil (3 personas) | Membro/Supervisor/Admin têm acesso a chat conversacional com contexto operacional |
| Explicação de cascata | "Esta substituição afeta X porque Y" — em linguagem operacional, não técnica |

**Registro formal:** IA-MVP-D01 — Motor determinístico no piloto. LLM introduzido na Fase 4 após dados reais.

---

### S-07 — Confirmação do Modelo MVP

**Decisão: CONFIRMADO — Compliance de Conteúdo**

O S-07 do MVP é a superfície de **atribuição formal de conteúdo obrigatório com confirmação de conclusão pelo Membro**.

| Decisão | Valor |
|---|---|
| Modelo | Compliance de Conteúdo — atribuição → consumo → confirmação |
| Tipos MVP | Leitura Obrigatória, Vídeo, Atualização Operacional, Checklist |
| Quem cria | Supervisor ou Admin |
| Quem executa | Membro (consume o conteúdo e confirma conclusão) |
| Avaliação subjetiva | Não existe no MVP — é binário (CONCLUÍDO / NÃO CONCLUÍDO) |
| Membro cria para si mesmo | Não — Membro não cria Entregas no MVP |
| Feedback do Supervisor | Não existe no MVP — o Supervisor monitora conclusão, não avalia |

**Nota:** a definição original em `ux-superficies-myasa-2.0.md` (gestão de tarefas com avaliação) foi descontinuada. A fundação produzida em `ciclo-entregas-s07-myasa-2.0.md` é a especificação oficial.

**Registro formal:** ENT-MVP-D01 — S-07 = Compliance de Conteúdo. Gestão de tarefas com avaliação subjetiva é Pós-MVP.

---

## PARTE 6 — RISCOS DO PILOTO

---

### Riscos Técnicos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| **Push notification falha no iOS (APNs)** — certificados, sandboxes, perfis de entrega são complexos e lentos de configurar | Alta | Alto | Reservar 5 dias extras no Sprint 2 para troubleshooting de push. Testar com devices reais desde o Sprint 1. Ter fallback de email para o piloto se push falhar. |
| **Motor de cobertura com edge cases de restrições sobrepostas** — membro com múltiplas restrições ativas de tipos diferentes pode gerar comportamento inesperado | Média | Médio | Modelar os casos limite de restrição no Sprint 3 antes de construir. Teste unitário extensivo do motor de cobertura antes de integração. |
| **Performance da Escala com muitas posições** — Supervisor com Grupo de 25 membros e 10 shows por semana pode ter visualização lenta | Baixa | Médio | Índices de banco definidos no Sprint 1 (não depois). Load test no Sprint 5 com dados reais. |
| **Sincronização Meu Dia — race condition** — Supervisors publica Escala enquanto Membro está com app aberto; Meu Dia pode mostrar dado desatualizado | Média | Médio | Implementar refresh automático por polling a cada 60s + push como gatilho. Evitar cache sem invalidação. |
| **Schema de banco de dados v1 insuficiente** — mudança de schema após Sprint 1 é cara | Alta | Alto | Fazer revisão técnica do schema antes de iniciar o Sprint 1. Simular os fluxos completos no papel antes de implementar. |

---

### Riscos Operacionais

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| **Supervisor resiste a mudar workflow** — tem sistema próprio que "funciona" (planilha, WhatsApp) e não vê razão de mudar | Alta | Alto | Escolher para o piloto o Supervisor mais receptivo à inovação. Acompanhar ativamente a primeira semana. Não forçar abandono do WhatsApp no dia 1 — deixar migração acontecer naturalmente. |
| **Admin não consegue configurar o setup sozinho** — wizard complexo, muitos passos, erro num campo bloqueia o fluxo | Média | Alto | Testar o setup wizard com um usuário real antes do pré-piloto. Estar presente (produto) durante o setup da semana de pré-piloto. |
| **Shows cancelados ou reformulados durante o piloto** — operação real tem imprevistos | Alta | Médio | O produto suporta cancelamento de show (Agenda → CANCELADO + propagação). O risco não é técnico — é de moral do piloto se houver muita instabilidade operacional. |
| **Supervisor usa o sistema mas comunica mudanças pelo WhatsApp em paralelo** — duplo canal de comunicação | Alta | Alto | Combinar explicitamente com o Supervisor: durante o piloto, **toda** comunicação operacional oficial passa pelo MyASA. WhatsApp apenas para emergências técnicas do app. Monitorar via métricas (confirmações no sistema). |

---

### Riscos de Adoção

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| **Membros não instalam o aplicativo** — sem incentivo claro, instalação voluntária tem taxa baixa | Alta | Alto | O Supervisor deve exigir instalação como condição do piloto. Criar momento de instalação coletiva (1 ensaio ou 1 show como ponto de coleta de dados de login). |
| **Membros instalam mas não abrem no dia do show** — hábito não formado | Alta | Alto | O gatilho é a notificação push. Sem push, sem abertura. A confirmação de push deve ser testada com cada membro durante o pré-piloto. |
| **Membros com celular antigo sem suporte ao app** — Android 7 / iOS 13 ou mais antigo | Baixa | Alto | Definir versões mínimas de OS antes do pré-piloto. Identificar membros com dispositivos incompatíveis na semana de onboarding — não durante o piloto. |
| **Membro prefere pedir folga pelo WhatsApp** — processo de Solicitação percebido como burocrático | Média | Médio | O UX da Solicitação precisa ser extremamente simples no mobile (3 telas no máximo para criar uma Folga). Testar com usuário real antes do piloto. |

---

### Riscos de UX

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| **Meu Dia não destaca mudanças claramente** — Membro não percebe que algo mudou | Alta | Alto | O destaque visual de "algo mudou" é requisito não-negociável do design. Testar com usuário real antes do Sprint 4 chegar a produção. |
| **Escala confunde Supervisor na primeira semana** — muitas posições, terminologia nova | Média | Alto | Onboarding do Supervisor inclui sessão guiada de publicação de Escala. Presença do produto no primeiro uso real. |
| **Distinção Aviso × Notificação push não é clara** — Membro confunde "recebi uma notificação" com "confirmar o Aviso" | Média | Médio | Design system deve distinguir visualmente. A notificação push é o gatilho — o Aviso dentro do app é onde a confirmação acontece. |
| **Estado "Em Aberto" assusta o Supervisor** — Supervisor hesita em publicar com posições Em Aberto | Média | Baixo | UX da publicação deve mostrar claramente que publicar com Em Aberto é possível com confirmação explícita — não é erro, é escolha. |

---

## PARTE 7 — MÉTRICAS OFICIAIS DO PILOTO

---

### Métricas primárias (definem Go/No-Go)

| Métrica | Definição técnica | Meta do piloto | Frequência de medição |
|---|---|---|---|
| **M1 — Taxa de publicação de Escala no produto** | % de shows da semana com Escala publicada via MyASA (vs. total de shows realizados) | ≥ 90% na semana 2 | Semanal |
| **M2 — Taxa de confirmação de mudanças pelos Membros** | % de notificações de mudança de Escala com confirmação no Meu Dia dentro de 2h | ≥ 80% | Por evento |
| **M3 — Taxa de Solicitações processadas no produto** | % de Solicitações de Folga e Restrição criadas via MyASA (vs. total de pedidos do período) | ≥ 70% na semana 2, ≥ 90% na semana 4 | Semanal |
| **M4 — Qualidade de decisão** | % de Solicitações negadas COM motivo preenchido (deve ser 100% — é obrigatório) | 100% | Contínuo |
| **M5 — Tempo médio de decisão de Solicitação** | Mediana do tempo entre criação da Solicitação e decisão do Supervisor | < 24h para Folgas simples | Semanal |

---

### Métricas secundárias (diagnóstico e aprendizado)

| Métrica | O que mede | Sinal positivo |
|---|---|---|
| **M6 — DAU/MAU do Membro** | % de membros que abrem o app ao menos 1x nos dias em que têm show | > 60% na semana 1, > 85% na semana 3 |
| **M7 — Tempo de session no Meu Dia** | Tempo médio por sessão no Meu Dia (proxy de engajamento) | > 30s (Membro leu, não apenas abriu) |
| **M8 — Taxa de renotificação pelo Supervisor** | % de Avisos que exigiram renotificação manual por não-confirmação | < 20% (alto = membros não confirmando) |
| **M9 — Erros de publicação de Escala** | Número de Escalas republicadas no mesmo dia (proxy de erro na publicação) | < 1 por semana por Supervisor |
| **M10 — NPS pós-piloto** | Net Promoter Score coletado ao final da semana 4 | ≥ 40 (Supervisor), ≥ 30 (Membro) |

---

### Como coletar as métricas

| Método | Aplica a |
|---|---|
| Dados do sistema (automático) | M1, M2, M3, M4, M5, M6, M7, M8, M9 |
| Entrevista estruturada com Supervisor (30min, semana 4) | M10 + dados qualitativos |
| Survey mobile anônimo para Membros (5 perguntas, semana 4) | M10 |
| Observação direta (presença do produto em 1 ensaio) | Qualitativo — UX, terminologia, hesitações |

---

## PARTE 8 — CRITÉRIOS GO / NO-GO

---

### GO — Expandir o piloto

**Condição:** ao final da semana 4, TODOS os critérios abaixo são verdadeiros:

| Critério | Threshold |
|---|---|
| M1 ≥ 90% na semana 4 | Escala publicada consistentemente |
| M2 ≥ 80% | Membros confirmando mudanças |
| M3 ≥ 85% | Maioria das Solicitações dentro do produto |
| M4 = 100% | Todas as negativas com motivo |
| M5 < 24h | Decisões rápidas |
| Zero bugs críticos durante as 4 semanas | Sem crash, perda de dados ou autenticação quebrada |
| Supervisor NPS ≥ 40 | O Supervisor que opera recomendaria para outro Supervisor |

**Ação:** adicionar um segundo Supervisor e expandir para 40-60 membros. Iniciar construção da Fase 2 (Livro do Dia completo + Avisos + Histórico completo + Painel de Saúde).

---

### AJUSTAR — Corrigir antes de expandir

**Condição:** ao final da semana 4, 3 ou mais métricas primárias estão dentro do threshold MAS existem problemas específicos de UX ou fluxo identificados.

| Sinal | O que ajustar |
|---|---|
| M1 < 90% mas M3 ≥ 80% | Supervisor não está publicando Escala — problema de UX da Escala ou de fluxo do Livro do Show |
| M2 < 80% | Membro não está confirmando — problema de UX do Meu Dia ou de notificações push |
| M3 < 70% | Membros não usam Solicitações — UX do fluxo de criação é complexa demais |
| NPS < 30 | Experiência geral insatisfatória — entrevista qualitativa para identificar causa raiz |

**Ação:** semana 5 de piloto adicional com correções específicas. Reavaliar métricas ao final. Não expandir até métricas estabilizadas.

---

### NO-GO — Repensar antes de prosseguir

**Condição:** qualquer um dos cenários abaixo ocorre:

| Cenário | Ação |
|---|---|
| Bug crítico que compromete dados (perda de alocação, autenticação quebrada para membros) | Interromper piloto imediatamente. Investigar, corrigir, retomar com novo grupo. |
| M1 < 50% após semana 3 | O Supervisor não adotou o produto para a função central. Problema de fit, não de bug. Entrevista profunda antes de prosseguir. |
| Membro com dado de outro membro visível | Violação de privacidade. Interrupção imediata. Bug de permissão crítico. |
| Supervisor abandona o piloto | Risco do piloto com 1 único Supervisor. Avaliar se é o Supervisor ou o produto. Reiniciar piloto com perfil diferente. |

**Não-GO não significa fim do produto.** Significa pausa para diagnóstico antes de expansão.

---

## PARTE 9 — AUDITORIA DO PLANO

---

### Existe alguma dependência crítica esquecida?

**Verificado:**

**Certificados de push notification (iOS):** necessitam de conta Apple Developer ativa, provisionamento de perfil e certificado APNs. Isso não é uma tarefa de desenvolvimento — é uma tarefa de infraestrutura que precisa de conta configurada antes do Sprint 2. **Ação: criar conta Apple Developer antes do Sprint 1.**

**Domínio e SSL:** a aplicação web precisa de domínio próprio e certificado SSL antes de qualquer teste com usuário real. Decisão de infraestrutura que precisa ser tomada no Sprint 1. **Ação: definir domínio e configurar SSL antes do Sprint 2.**

**Definição de versões mínimas de OS:** iOS 15+ e Android 8+ são recomendados para suporte de push com comportamento previsível. Definir antes do Sprint 1 para não gerar surprise técnica no onboarding do piloto.

**Resultado:** 3 dependências de infraestrutura identificadas. Nenhuma é de desenvolvimento — são pré-requisitos de conta e configuração que precisam ser resolvidos antes do Sprint 2.

---

### Existe algum épico obrigatório ausente?

**Verificado:** os 6 épicos marcados como obrigatórios para o piloto (Epics 00-05) cobrem o ciclo operacional completo. A sequência Epic 00 → 01 → 02 → 03 → 04 → 05 não tem lacuna.

O Livro do Dia (Epic 06) entra parcialmente no Sprint 5 (versão básica) — sua ausência no Sprint 4 é intencional: a Escala publicada já responde "quem trabalha hoje". O Livro do Dia adiciona "como é o show de hoje" — valioso mas não bloqueante para a semana 1 do piloto.

**Resultado:** nenhum épico obrigatório ausente.

---

### Existe alguma funcionalidade do piloto sem dono técnico?

| Área sem dono definido | Ação necessária |
|---|---|
| Motor de cobertura (lógica de negócio complexa) | Deve ser responsabilidade de 1 desenvolvedor backend sênior — não dividir entre dois |
| MO engine (propagação assíncrona) | Requer desenvolvedor com experiência em sistemas de eventos — identificar no Sprint 0 |
| Push notification (FCM + APNs) | Requer desenvolvedor com experiência em mobile e certificados iOS — não é tarefa para quem nunca fez |
| Design system (tokens + componentes) | Deve ser feito pelo designer antes do Sprint 2 para não bloquear o desenvolvimento de frontend |

**Resultado:** 4 áreas que precisam de atribuição explícita antes do Sprint 1.

---

## PARTE 10 — VEREDITO

---

## 🟢 Pronto para Construção

O plano está completo. A arquitetura está congelada. As decisões técnicas pendentes estão encerradas. O caminho crítico está claro. Os riscos estão mapeados. Os critérios de sucesso estão definidos.

---

### Plano oficial — resumo executivo

| Período | Marcos |
|---|---|
| **Antes de iniciar** | Conta Apple Developer ativa · Domínio e SSL definidos · Versões mínimas de OS definidas · Atribuições de equipe por área técnica |
| **Semanas 1-2 (Sprint 1)** | Sistema existe. Admin entra. Estrutura organizacional configurada. |
| **Semanas 3-4 (Sprint 2)** | Livro do Show criado. Agenda com shows cadastrados. Push notification configurado. |
| **Semanas 5-6 (Sprint 3)** | Escala publicada. Motor de cobertura funcionando. Membro vê próxima atividade no app. |
| **Semanas 7-8 (Sprint 4)** | Solicitação de Folga criada, decidida, propagada. Meu Dia completo. |
| **Semanas 9-10 (Sprint 5)** | Loop completo end-to-end. Painel Operacional. Livro do Dia básico. Histórico básico. |
| **Semana 11** | Pré-piloto: setup real da ASA + onboarding de todos os membros |
| **Semanas 12-15** | Piloto com shows reais (4 semanas) |
| **Semana 16** | Análise de dados + decisão de Go/No-Go/Ajustar |

---

### Resposta à pergunta final

**"Se a equipe começar a desenvolver amanhã, qual é a primeira sprint e qual é o primeiro marco visível para os usuários?"**

**A primeira sprint é a Sprint 1 — "O sistema existe."**

O que a equipe faz nos primeiros 14 dias:
- Backend configura banco de dados, autenticação e API base
- Mobile configura o shell do app com auth flow
- Web configura o shell com auth flow e design system base
- Admin cria conta, cria Operação, cria Grupos, cadastra Membros

**O primeiro marco visível para usuários reais acontece ao final da Sprint 1:**

> **O Admin entra na plataforma web, configura a organização completa, e o Supervisor faz login no aplicativo mobile com as credenciais criadas.**

Nenhum show existe ainda. Nenhuma Escala existe. Mas a organização tem uma identidade digital dentro do MyASA. Esse é o primeiro momento em que um usuário real toca o produto.

O primeiro marco operacionalmente significativo — onde um usuário real vê **valor** — acontece ao final da **Sprint 3**:

> **O Supervisor publica a Escala de um show real. O Membro recebe uma notificação push, abre o Meu Dia, e vê seu papel no show de amanhã.**

Esse é o momento em que o MyASA para de ser um sistema e começa a ser uma ferramenta de trabalho.

---

*Plano Oficial do MVP Piloto produzido em 18/06/2026 — MyASA 2.0*
*5 sprints · 10 semanas de desenvolvimento · 4 semanas de piloto · 3 decisões técnicas encerradas formalmente*
