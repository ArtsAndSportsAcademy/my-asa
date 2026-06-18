# MyASA 2.0 — Gate Final de Construção

> **Versão:** 18/06/2026
> **Propósito:** proteger a integridade arquitetural durante o desenvolvimento
> **Base:** Blueprint Executivo · Backlog Mestre · Plano MVP Piloto · 131 decisões formais
> **Destino:** toda a equipe de desenvolvimento — desenvolvedores, designers, PMs, QA

---

## Premissa

Este documento não descreve o que construir. Descreve as regras que protegem o que foi decidido. A arquitetura funcional está congelada. O desenvolvimento pode — e deve — tomar decisões técnicas de implementação livremente. O que não pode mudar sem revisão formal está listado neste documento.

**A distinção central:** decisões técnicas (framework, biblioteca, query, componente) são autonomia da equipe. Decisões de produto (quem pode fazer o quê, quando algo é imutável, o que a IA pode e não pode fazer) são protegidas por este Gate.

---

## PARTE 1 — O QUE ESTÁ CONGELADO

---

### Superfícies congeladas

As 17 superfícies do MyASA 2.0 estão definidas e nomeadas. Nenhuma nova superfície pode ser adicionada sem revisão arquitetural formal. Nenhuma das 17 pode ser removida ou fundida com outra sem revisão formal.

| Código | Nome | Classificação |
|---|---|---|
| S-01 | Meu Dia | Primária — Membro |
| S-02 | Painel Operacional | Primária — Supervisor |
| S-03 | Painel de Saúde | Primária — Admin |
| S-04 | Escala | Primária — Supervisor |
| S-05 | Livro do Dia | Primária — Supervisor/Membro |
| S-06 | Solicitações | Secundária — Membro/Supervisor |
| S-07 | Entregas | Secundária — Supervisor/Membro |
| S-08 | Avisos | Secundária — Supervisor/Admin |
| S-09 | Mensagens | Secundária — Membro/Supervisor |
| S-10 | IA | Secundária — Todos |
| S-11 | Histórico | Secundária — Admin/Supervisor |
| S-12 | Agenda | Suporte — Admin |
| S-13 | Livro do Show | Suporte — Admin |
| S-14 | Biblioteca | Suporte — Admin/Supervisor |
| S-15 | Equipes | Suporte — Admin |
| S-16 | Operações | Suporte — Admin |
| S-17 | Administração | Suporte — Admin |

---

### Entidades congeladas

Nenhuma entidade nova pode ser criada sem revisão formal. Nenhuma entidade existente pode ter seu papel fundamental alterado.

| Entidade | Responsável | Regra inviolável |
|---|---|---|
| **Mudança Operacional (MO)** | Sistema (automático) | Nunca criada manualmente pelo usuário |
| **Histórico** | Sistema (automático) | Nunca editável, nunca deletável — nem pelo Admin |
| **Mensagem** | Usuário (cria uma vez) | Imutável após envio — sem edição, sem exclusão |
| **Entrega EXPIRADA** | Sistema (automático) | Estado terminal imutável — não desaparece |
| **Solicitação** | Membro (cria) | Decisão com motivo obrigatório para negações |
| **Livro do Dia** | Supervisor (publica) | Toda mudança em posição publicada exige republicação com nova versão |
| **Escala** | Supervisor (publica) | Publicação exige confirmação explícita com alertas visíveis |

---

### Ciclos congelados

Os 5 ciclos operacionais têm estrutura definida. O caminho dos dados entre entidades não pode ser alterado sem revisão formal.

1. **Ciclo de Planejamento Operacional** — Livro do Show + Agenda → Escala → Livro do Dia → Meu Dia
2. **Ciclo de Solicitações** — Membro cria → análise de impacto automática → Supervisor decide → MO propaga
3. **Ciclo de Comunicação** — Supervisor/Admin cria → push entrega → Membro confirma → rastreamento registrado
4. **Ciclo de Entregas** — Supervisor atribui → Membro executa → estado binário (CONCLUÍDA / EXPIRADA)
5. **Ciclo de Governança** — estrutura org → Painel de Saúde → limiares → alertas → investigação no Histórico

---

### Decisões fundadoras que não podem ser revertidas sem revisão formal

| Decisão | Código | Conteúdo |
|---|---|---|
| Push-only no piloto | NOTIF-D01 | In-app banner web na Fase 2 |
| Motor determinístico no piloto | IA-MVP-D01 | LLM na Fase 4 |
| S-07 = Compliance binário | ENT-MVP-D01 | Sem avaliação subjetiva no MVP |
| Membro → Membro proibido | MSG-D03 | Toda comunicação horizontal passa pelo Supervisor |
| Imutabilidade de Mensagem | MSG-D04 | Sem edição, sem exclusão |
| IA não participa da conversa | MSG-D06 | IA nunca como interlocutor |

---

### O que não pode mudar sem revisão formal

- Adicionar ou remover superfícies
- Alterar quem pode publicar o quê (permissões de publicação)
- Alterar quando uma MO é gerada (lista de triggers)
- Alterar regras de imutabilidade (Mensagem, Histórico, Entrega EXPIRADA)
- Alterar os limites de acesso da IA por perfil
- Alterar o modelo de compliance de S-07 (de binário para avaliativo)
- Permitir que a IA execute ações sem confirmação humana
- Alterar quem pode ver dados de quem (escopo de visibilidade por perfil)
- Criar canal de comunicação oficial fora do fluxo rastreável (S-08 Avisos)

---

## PARTE 2 — CRITÉRIOS DE ACEITE ARQUITETURAIS

---

### S-04 Escala

| ✅ Implementação correta | ❌ Implementação incorreta |
|---|---|
| Publicação exige confirmação explícita se há alertas em aberto | Publicação automática ao salvar sem confirmação |
| Cascata calculada e exibida antes de confirmar substituição | Substituição executada sem mostrar impacto |
| Motor de cobertura lista candidatos em ordem de risco | Lista plana de membros disponíveis sem critério |
| Republicação exige nova confirmação após mudança em posição publicada | Campo editável diretamente na Escala publicada |
| Supervisor vê apenas seu Grupo Operacional | Supervisor vê Escala de toda a Operação |

---

### S-06 Solicitações

| ✅ Implementação correta | ❌ Implementação incorreta |
|---|---|
| Botão de negar bloqueado sem campo de motivo preenchido | Motivo opcional — negação sem justificativa possível |
| Análise de impacto automática antes da tela de decisão | Supervisor decide sem ver quantas posições são afetadas |
| Ordenação por data de impacto (não por data de criação) | Fila de Solicitações em ordem cronológica de criação |
| MO gerada automaticamente após aprovação | Supervisor precisa criar MO manualmente após aprovar |
| Membro vê estado e motivo da decisão no Meu Dia | Membro precisa navegar para Solicitações para ver resultado |

---

### S-05 Livro do Dia

| ✅ Implementação correta | ❌ Implementação incorreta |
|---|---|
| Toda mudança em posição publicada cria nova versão | Campo de posição editável in-place sem versionamento |
| Escala muda → Livro do Dia automaticamente flagged DESATUALIZADO | Livro do Dia continua PUBLICADO com dados desatualizados |
| Membro vê apenas sua fatia individual | Membro vê Livro do Dia completo de toda a Operação |
| Delta entre versões visível ao Supervisor | Supervisor não sabe o que mudou entre versões |

---

### S-09 Mensagens

| ✅ Implementação correta | ❌ Implementação incorreta |
|---|---|
| Mensagem enviada é imutável | Botão de editar ou apagar mensagem |
| Membro → Membro proibido no MVP | Chat entre Membros sem Supervisor como intermediário |
| Mensagem contextual nasce vinculada a uma entidade | Mensagem solta sem contexto de origem visível |
| Distinção visual clara Mensagem × Aviso | Mensagens e Avisos aparecem no mesmo feed |
| Arquivamento automático com entidade de origem | Mensagem fica visível após entidade arquivada |

---

### S-07 Entregas

| ✅ Implementação correta | ❌ Implementação incorreta |
|---|---|
| Conclusão é binária: CONCLUÍDA ou não | Campo de avaliação, nota ou feedback qualitativo |
| Estado EXPIRADA é permanente e imutável | Supervisor pode "reabrir" Entrega expirada |
| Membro não cria Entregas para si mesmo | Interface de auto-atribuição de Entrega para Membro |
| Supervisor monitora conclusão — não avalia | Tela de "aprovar conclusão" para o Supervisor |

---

### S-10 IA

| ✅ Implementação correta | ❌ Implementação incorreta |
|---|---|
| IA propõe → Supervisor confirma → sistema executa | IA executa substituição diretamente sem confirmação |
| Ações de IA identificadas separadamente no Histórico | Ações de IA registradas como se fossem do Supervisor |
| Produto funciona completamente sem IA disponível | Fluxo bloqueado se serviço de IA está indisponível |
| IA do Membro acessa apenas dados do próprio Membro | IA do Membro tem acesso a dados do grupo |
| IA nunca envia Mensagem ou Aviso em nome de usuário | Botão "sugerir mensagem para enviar pelo Supervisor" que envia diretamente |

---

### S-11 Histórico

| ✅ Implementação correta | ❌ Implementação incorreta |
|---|---|
| Eventos agrupados por MO (narrativa operacional) | Log técnico cronológico sem contexto operacional |
| Nenhuma entrada pode ser editada ou deletada | Botão de "limpar histórico" — nem para Admin |
| Ações humanas distinguidas de ações de IA | Todas as ações no mesmo formato sem identificação de origem |
| Admin acessa Histórico de todas as Operações | Admin limitado ao Histórico da Operação padrão |

---

### S-08 Avisos

| ✅ Implementação correta | ❌ Implementação incorreta |
|---|---|
| Rastreamento individual: quem confirmou, quem não confirmou | Indicador de "X de Y leram" sem identificação individual |
| Aviso crítico de cancelamento de show gerado automaticamente | Supervisor precisa criar manualmente Aviso após cancelar show |
| Notificação push é gatilho — confirmação acontece no app | Push já conta como "lido" sem abertura e confirmação no app |

---

### Permissões e escopo

| ✅ Implementação correta | ❌ Implementação incorreta |
|---|---|
| Membro nunca vê dados de outros Membros em S-01 | "Visão da equipe" no Meu Dia mostrando colegas |
| Supervisor vê apenas seu Grupo Operacional | Supervisor acessa dados de outro Grupo sem delegação |
| Admin não publica Escala sem delegação formal | Admin tem acesso direto de publicação sem delegação |
| Delegação tem prazo definido e expiração registrada | Delegação permanente sem expiração |

---

## PARTE 3 — RED FLAGS DE DEGRADAÇÃO ARQUITETURAL

---

Red flags são sinais de que a arquitetura está sendo corroída durante o desenvolvimento. Qualquer um desses sinais deve pausar o desenvolvimento da feature para revisão antes de prosseguir.

### Red Flags de Escopo de Feature

🚩 **Nova tela sem pergunta do usuário definida**
Toda superfície existe para responder uma pergunta específica. Se uma nova tela não tem uma pergunta clara ("O que o usuário perguntou que levou até aqui?"), ela não deveria existir.

🚩 **Nova entidade que duplica outra existente**
Exemplos de duplicação que devem ser recusadas: "Lista de Avisos Lidos" (isso já é o rastreamento de S-08) · "Tarefas do Dia" (isso é S-01 Meu Dia) · "Chat de Equipe" (isso tenta ser S-09 sem os limites formais de S-09).

🚩 **Feature que existe em dois lugares ao mesmo tempo**
Se a mesma informação aparece em S-01 Meu Dia e também em um "painel de resumo" novo, um deles é redundante. Redundância de superfície fragmenta a fonte de verdade.

🚩 **"Vista simplificada" que remove rastreabilidade**
Qualquer feature que apresenta dados operacionais sem identificar autor, timestamp ou contexto é uma violação da rastreabilidade — mesmo que seja "para simplificar".

---

### Red Flags de IA

🚩 **IA publicando algo diretamente**
Se o código chama uma função de publicação de Escala, Livro do Dia ou Aviso sem passar por uma ação explícita do usuário, a IA está agindo sozinha.

🚩 **Lógica operacional migrando para IA sem motor de regras**
O motor determinístico precisa existir como fallback. Se uma feature só funciona com LLM disponível, a dependência está errada.

🚩 **IA gerando texto "em nome de" alguém**
"Sugerimos o seguinte texto para o seu Aviso" é aceitável (Supervisor revisa e envia). "Enviamos este Aviso automaticamente baseado na situação" não é.

🚩 **IA como destino primário de navegação**
IA é assistente dentro de superfícies — não é superfície em si. Se há um botão "Falar com a IA" como item principal de navegação, o enquadramento está errado.

---

### Red Flags de Comunicação

🚩 **Canal de comunicação novo fora do sistema rastreável**
Qualquer mecanismo de comunicação entre usuários que não passa por S-08 (Avisos) ou S-09 (Mensagens) — como comentários ad hoc, reações, etc. — cria um canal não rastreável.

🚩 **Mensagem com botão de editar, apagar ou "apagar para todos"**
Imutabilidade de Mensagem não é negociável. "Mas o WhatsApp deixa" não é argumento.

🚩 **Aviso sem rastreamento de confirmação individual**
"Enviado para X pessoas" sem saber quem especificamente não confirmou é uma regressão do modelo de rastreabilidade.

---

### Red Flags de Gestão de Mudança

🚩 **Livro do Dia editável in-place após publicação**
"Só deixa editar a observação — não é uma posição crítica" — qualquer campo editável em Livro publicado sem nova versão é uma violação.

🚩 **Solicitação auto-aprovada por regra automática**
"Se a folga é para mais de 30 dias no futuro, aprova automaticamente" — a aprovação de Solicitação requer Supervisor. Sem exceção no MVP.

🚩 **MO criada manualmente pelo Supervisor**
Se há um botão "registrar mudança operacional" para o Supervisor, o sistema de propagação automática falhou.

---

### Red Flags de Entregas

🚩 **Entrega com campo de avaliação, nota ou feedback**
O modelo é binário: CONCLUÍDA ou não. Qualquer campo de avaliação subjetiva é S-07 se tornando gestor de tarefas — decisão formalmente encerrada.

🚩 **Entrega EXPIRADA reabrível**
"O Supervisor quer dar outra chance ao Membro" → crie uma nova Entrega. O estado EXPIRADA da primeira é permanente.

🚩 **Membro criando Entrega para si mesmo**
Entrega é atribuição de Supervisor ou Admin para Membro. Auto-atribuição muda o modelo de compliance para auto-gestão.

---

## PARTE 4 — CLASSIFICAÇÃO DE MUDANÇAS FUTURAS

---

### Bug

**Definição:** o sistema não se comporta conforme especificado no backlog ou neste Gate.

**Exemplos:**
- Botão de negar Solicitação aceita envio sem motivo preenchido
- MO não é gerada após aprovação de Solicitação
- Livro do Dia permanece PUBLICADO após mudança de Escala sem ser flagged DESATUALIZADO

**Quem aprova:** qualquer desenvolvedor com revisão de par. Não exige aprovação de produto.
**Prazo:** deve ser corrigido antes da próxima publicação de sprint.

---

### Melhoria

**Definição:** feature existente se torna mais rápida, mais clara ou mais agradável de usar — sem alterar o comportamento especificado, sem alterar o modelo de dados, sem alterar permissões.

**Exemplos:**
- Refatoração visual do card de Solicitação para melhor legibilidade
- Animação de transição na publicação de Escala
- Texto do estado "sem novidades" mais amigável

**Quem aprova:** Product Owner. Não exige revisão arquitetural.
**Critério:** "O comportamento é o mesmo. Apenas a apresentação mudou."

---

### Evolução

**Definição:** nova feature prevista no backlog sendo construída, ou expansão de feature existente dentro do escopo do backlog.

**Exemplos:**
- Implementar tipo de Solicitação que ainda não estava no sprint (previsto no backlog)
- Adicionar filtro de período no Histórico (funcionalidade prevista, ainda não implementada)
- Expansão do motor de cobertura para a 4ª camada pós-piloto

**Quem aprova:** Product Owner + Tech Lead. Não exige revisão arquitetural.
**Critério:** "Está no backlog. Estamos construindo o que foi planejado."

---

### Mudança Arquitetural

**Definição:** qualquer alteração que afeta superfícies, entidades, ciclos, permissões, princípios inegociáveis ou limites da IA.

**Exemplos:**
- Permitir que Membro veja Escala de outros Membros do grupo
- Adicionar avaliação subjetiva em S-07 Entregas
- Criar nova superfície não prevista no mapa de 17
- Mudar quando uma MO é gerada
- Permitir que IA publique sem confirmação humana

**Quem aprova:** Product Owner + Tech Lead + Arquiteto de Produto.
**Processo obrigatório:**
1. Documento de proposta com justificativa (problema que resolve + trade-offs)
2. Análise de impacto nas superfícies dependentes
3. Verificação de conflito com princípios inegociáveis
4. Nova decisão formal registrada (com código de decisão no padrão existente)
5. Atualização do Blueprint Executivo e dos documentos afetados
**Prazo mínimo:** 5 dias úteis de análise antes de implementar.

---

## PARTE 5 — AUDITORIA DE SPRINT

---

Este checklist deve ser executado ao final de cada sprint, antes de considerar o sprint completo.

---

### Checklist de Aderência ao Blueprint

```
ADERÊNCIA AO BLUEPRINT
□ Todas as features implementadas têm correspondência no backlog?
□ Existe alguma feature implementada que não estava planejada?
□ Alguma entidade nova foi criada? (requer revisão arquitetural se sim)
□ Alguma superfície nova foi criada? (requer revisão arquitetural se sim)
□ As permissões de acesso por perfil foram respeitadas?
  □ Membro não acessa dados de outros Membros
  □ Supervisor limitado ao seu Grupo Operacional
  □ Admin com visibilidade total mas sem autoridade de publicação direta
```

### Checklist de Aderência aos Princípios

```
PRINCÍPIOS INEGOCIÁVEIS
□ O sistema informa, o humano decide?
  □ Nenhuma ação operacional executada automaticamente sem confirmação
  □ Motor de cobertura propõe — Supervisor confirma
□ Uma única fonte de verdade?
  □ Não existe forma de comunicar alocações fora da Escala publicada
□ O Livro do Dia nunca foi alterado silenciosamente?
  □ Toda mudança gera nova versão com versão anterior preservada
□ Toda decisão tem registro?
  □ Negações têm motivo obrigatório (validado backend + UI)
  □ MOs geradas automaticamente para todas as mudanças operacionais
□ Imutabilidade respeitada?
  □ Mensagem sem botão de editar ou apagar
  □ Estado EXPIRADA de Entrega sem opção de reabertura
  □ Histórico sem opção de editar ou deletar entradas
□ Escopo de visibilidade correto?
  □ S-01 Meu Dia não mostra dados de outros Membros
□ IA dentro dos limites?
  □ Nenhuma ação de IA executada sem confirmação humana explícita
  □ Produto funciona sem IA disponível
  □ Ações de IA identificadas separadamente no Histórico
```

### Checklist de Aderência ao Backlog

```
ADERÊNCIA AO BACKLOG
□ Os critérios de aceite do sprint foram verificados um a um?
□ Existe regressão em feature entregue em sprint anterior?
□ Dependências técnicas entre épicos estão sendo respeitadas?
□ A ordem de construção do caminho crítico está sendo seguida?
□ Existe débito técnico criado que impacta o piloto? (deve ser registrado)
```

### Checklist de Red Flags

```
RED FLAGS (responda "sim encontrei" se qualquer um for verdadeiro)
□ Nova tela foi adicionada sem pergunta do usuário clara?
□ Nova entidade duplica outra existente?
□ Lógica operacional está dependendo de IA como único caminho?
□ Canal de comunicação foi criado fora do fluxo rastreável?
□ Campo editável existe em dado que deveria ser imutável?
□ IA está publicando algo sem confirmação humana?
□ Membro consegue ver dados de outro Membro?
```

**Regra:** se qualquer Red Flag for "sim encontrei", o sprint não está completo até que o item seja resolvido ou documentado como mudança arquitetural aprovada.

---

## PARTE 6 — GO LIVE

---

### Condições para Pré-Piloto

> O sistema está pronto para o setup real da ASA e onboarding da equipe piloto.

**Técnico:**
- [ ] Todos os critérios de aceite do Sprint 5 foram verificados
- [ ] Ciclo E2E funciona sem intervenção manual: Solicitação → Decisão → MO → Escala → Notificação → Meu Dia → Confirmação → Histórico
- [ ] Push notification testado com devices reais (iOS + Android) — entrega confirmada
- [ ] Performance: < 2s de resposta para todas as ações principais com 25 usuários simultâneos
- [ ] Zero bugs críticos (crash, perda de dados, autenticação quebrada)
- [ ] Conta Apple Developer ativa + certificados APNs configurados

**Segurança:**
- [ ] Membro autenticado não acessa dados de outro Membro (testado)
- [ ] Supervisor não acessa dados de Grupo que não é o seu (testado)
- [ ] Tokens expirados rejeitados (testado)
- [ ] SQL injection e input malicioso tratados

**UX:**
- [ ] Fluxo de setup (wizard do Admin) testado com usuário real sem assistência — < 1 hora para completar
- [ ] Fluxo de Solicitação de Folga testado com Membro real no mobile — < 3 minutos do início ao envio
- [ ] Estado "sem novidades" visível claramente no Meu Dia

---

### Condições para início do Piloto

> A equipe real está usando o sistema com shows reais.

**Operacional:**
- [ ] Admin completou o setup da Operação piloto (S-17 → S-15 → S-16 → S-13 → Agenda)
- [ ] Supervisor publicou ao menos 1 Escala real antes do primeiro show do piloto
- [ ] Todos os 15-25 membros do piloto fizeram login e receberam ao menos 1 notificação push
- [ ] Acordo explícito com o Supervisor: toda comunicação operacional oficial durante o piloto passa pelo MyASA

**Monitoramento:**
- [ ] Dashboard de métricas do piloto configurado (M1 a M5 coletáveis automaticamente)
- [ ] Canal de reporte de bugs para a equipe do produto durante o piloto definido
- [ ] Contato de escalada técnica definido para o Supervisor

**Onboarding:**
- [ ] Guia de primeiro uso por perfil disponível (Admin, Supervisor, Membro)
- [ ] Sessão guiada de primeira publicação de Escala realizada com o Supervisor (presencial ou remota)

---

### Condições para Produção

> O produto está disponível para novas ASAs além da organização piloto.

**Resultados do piloto:**
- [ ] Critérios GO/NO-GO da semana 4 avaliados
- [ ] M1 ≥ 90%, M2 ≥ 80%, M3 ≥ 85%, M4 = 100%, M5 < 24h
- [ ] NPS Supervisor ≥ 40
- [ ] Zero eventos de perda de dados ou violação de acesso durante o piloto

**Escala técnica:**
- [ ] Infraestrutura testada para 5x o volume do piloto (125 usuários simultâneos)
- [ ] Backup automático de banco de dados configurado e testado
- [ ] Monitoramento de erros em produção configurado (alertas automáticos)
- [ ] Plano de rollback documentado e testado

**Produto:**
- [ ] Bugs críticos identificados no piloto corrigidos
- [ ] Melhorias de UX prioritárias do feedback do piloto implementadas
- [ ] Documentação de onboarding atualizada com aprendizados do piloto

---

## PARTE 7 — VEREDITO

---

### Gate Final Oficial de Construção do MyASA 2.0

O MyASA 2.0 está arquiteturalmente completo, documentado e protegido. A equipe de desenvolvimento tem:

1. **O que construir** — Blueprint Executivo + Backlog Mestre (131 features, 14 épicos)
2. **Em que ordem** — Plano MVP Piloto (5 sprints, 10 semanas, critérios de aceite por sprint)
3. **Com quais regras** — Gate Final (o que está congelado, red flags, critérios de aceite arquiteturais)
4. **Como validar** — Métricas oficiais do piloto + critérios Go/No-Go

---

### Como garantir fidelidade à visão com uma nova equipe daqui a 12 meses

**Resposta direta:** os 36 documentos do projeto são o ativo que preserva a visão — não as pessoas. Mas documentos não protegem nada se não forem usados. O protocolo abaixo garante que uma nova equipe chegue ao produto certo:

---

**Protocolo de integração de nova equipe:**

**Dia 1 — Leitura obrigatória (nesta ordem):**
1. `blueprint-executivo-myasa-2.0.md` — Parte 9 (resumo executivo) primeiro, depois o documento completo
2. `gate-final-construcao-myasa-2.0.md` — este documento
3. `plano-mvp-piloto-myasa-2.0.md` — Parte 4 (sprints) e Parte 5 (decisões técnicas)

**Semana 1 — Imersão:**
4. `backlog-mestre-myasa-2.0.md` — Partes 2 e 3 (épicos e features)
5. `ux-superficies-myasa-2.0.md` — superfícies relevantes ao sprint atual
6. Documentos de ciclo relevantes ao trabalho em andamento

**Antes de qualquer PR que toque em lógica de produto:**
- Verificar se a mudança está no backlog
- Executar o checklist de red flags da Parte 5
- Se houver dúvida sobre classificação (Bug / Melhoria / Evolução / Mudança Arquitetural): perguntar ao Product Owner antes de implementar

---

**As 4 perguntas que protegem a visão:**

> **1. "Qual pergunta do usuário esta feature responde?"**
> Se não há resposta clara, a feature pode não ser necessária.

> **2. "Esta mudança afeta quem pode ver o quê, ou quem pode fazer o quê?"**
> Se sim, é uma Mudança Arquitetural — requer revisão formal.

> **3. "Esta feature cria um novo canal de comunicação ou um novo estado de dado?"**
> Se sim, verificar se conflita com entidades existentes antes de implementar.

> **4. "Se a IA estiver indisponível, esta feature ainda funciona?"**
> Se não, revisar a separação entre motor determinístico e LLM.

---

**O que fazer quando surgir pressão para mudar algo congelado:**

A pressão para mudar arquitetura durante o desenvolvimento é normal — os usuários pedem, a equipe de vendas sugere, o desenvolvedor vê um atalho. O processo é:

1. Documentar a proposta por escrito (o que, por que, impacto estimado)
2. Classificar como Mudança Arquitetural se tocar em qualquer item congelado
3. Aguardar o processo de revisão (mínimo 5 dias úteis)
4. Registrar a decisão formalmente — mesmo se a decisão for "não fazer"

**O maior risco para a visão de longo prazo não são grandes decisões erradas — são pequenas concessões acumuladas.** "Só deixar o Membro ver a Escala do grupo" · "Só permitir um motivo padrão na negação" · "Só uma edição rápida no Livro publicado". Cada uma dessas, isolada, parece razoável. Juntas, destroem a arquitetura.

Este Gate existe para que cada "só isso" passe pelo processo correto antes de chegar ao código.

---

## 🟢 Pronto para Construção

Arquitetura congelada. Backlog executável. Sprints definidos. Critérios de aceite claros. Red flags mapeados. Go Live com condições objetivas. Protocolo de proteção para equipes futuras.

**O MyASA 2.0 pode ser construído.**

---

*Gate Final de Construção produzido em 18/06/2026 — MyASA 2.0*
*37 documentos · 131 decisões formais · 1 arquitetura protegida*
