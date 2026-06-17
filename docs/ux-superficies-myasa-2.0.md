# MyASA 2.0 — Mapa Oficial de Superfícies

> Versão: 17/06/2026
> Fase: UX Estratégico — anterior a wireframes, layouts e componentes
> Origem: Arquitetura + Pesquisa (3 perfis) + Mapeamento de Jornadas
> Status: Base para navegação, arquitetura de informação e interface

---

## Nota Metodológica

Uma **superfície** não é necessariamente uma tela. É um lugar onde o usuário vai para realizar um objetivo específico. A pergunta que guia a classificação é: *"para que o usuário abre isso?"*

Nem todo pilar da arquitetura precisa virar superfície própria. Alguns pilares são representados como contexto dentro de outras superfícies. Alguns pilares precisam de duas superfícies (uma operacional, uma administrativa). Alguns pilares não precisam de superfície alguma — são infraestrutura invisível.

### Pilares que NÃO se tornam superfícies independentes

**Folgas** — são um tipo dentro de Solicitações. Nenhum usuário "abre Folgas" como destino primário. O Membro cria via Solicitações. O Supervisor analisa via Solicitações. O Admin vê como indicador no Painel de Saúde. Folgas é contexto, não superfície.

**Restrições** — são atributo de um membro visível como contexto em Escala e Livro do Dia. O Supervisor registra dentro do perfil do membro ou dentro do fluxo de Escala. Nenhum usuário "vai para Restrições" como destino. Restrição é dado, não superfície.

**Central de Notificações / Push** — é infraestrutura de entrega. As notificações são o gatilho que leva o usuário para uma superfície; não são uma superfície por si mesmas. O rastreamento de confirmação aparece contextualizado dentro de cada superfície relevante (Escala, Meu Dia, Aviso específico).

**Inbox Unificado** — conceito arquitetural válido, mas do ponto de vista do UX já é coberto pela combinação de Mensagens + Solicitações + Entregas com estados visíveis. Não justifica superfície própria no MVP — seria um agregador que replica o que já existe.

**Auditoria técnica** — subconjunto do Histórico com filtros avançados. Não é uma superfície separada; é uma camada de profundidade dentro do Histórico.

---

## SUPERFÍCIES PRIMÁRIAS
> Uso diário. Definem a experiência central de cada perfil. Precisam ser perfeitas.

---

### S-01 — MEU DIA
**Classificação:** Primária | **Perfil principal:** Membro

**1. Objetivo principal**
Ser a resposta completa para a pergunta diária do Membro: *"O que preciso fazer hoje — e mudou alguma coisa?"* Não é uma lista de atividades. É a confirmação ativa de que o Membro está pronto para executar.

**2. Público principal**
Membro. Exclusivamente individual — o Membro jamais vê dados de outros membros nessa superfície.

**3. Frequência de uso**
Múltiplas vezes ao dia. Abertura matinal obrigatória + verificações ao longo do dia + antes de cada atividade.

**4. Pergunta que responde**
*"O que eu faço hoje, em qual personagem, em qual horário — e tem algo diferente do que eu sabia antes?"*

**5. Jornadas relacionadas**
- JM-01 (Abertura do Dia) — jornada principal
- JM-02 (Descoberta de Mudança) — jornada crítica
- JM-05 (Consulta à IA) — jornada eventual, frequente

**6. Informações mais importantes**
Em ordem de prioridade visual:
1. Próxima atividade: o que, onde, quando, em qual papel
2. Alterações desde a última abertura: o que mudou, o que era antes
3. Confirmações pendentes: existe algo que o Membro precisa reconhecer
4. Linha do tempo do dia completo: acesso sob demanda
5. Status das solicitações em aberto: quantas pendentes, nenhum detalhe desnecessário
6. Prazo de entrega próximo: se existe algo urgente

**7. Decisões que suporta**
- *"Preciso me preparar diferente de ontem?"* (mudança de personagem, horário)
- *"Preciso confirmar algo agora?"* (alteração crítica que exige reconhecimento)
- *"Preciso agir em alguma solicitação ou entrega?"*

**8. Riscos se for mal projetada**
- Membro não percebe que houve uma mudança → chega no lugar errado, no horário errado, de personagem errado
- Mudança aparece mas não está destacada → passa despercebida visualmente
- "Sem novidades" não é comunicado → Membro não sabe se verificou a versão mais recente
- Informações operacionais gerais (de outros membros) aparecem → gera confusão e ansiedade
- Muita informação → Membro não consegue encontrar o que importa

**9. Relação com IA**
A IA do Membro tem seu maior momento de valor aqui. Atua como intérprete pessoal:
- Resume o dia em linguagem natural antes de mostrar a lista
- Destaca o que mudou e por quê (se a IA tiver contexto)
- Responde perguntas sobre o dia sem precisar navegar para outra superfície
- *"O que mudou no show de hoje?"* → resposta imediata contextualizada

**10. Relação com outros pilares**
- Alimentada por: Escala (fonte de dados), Livro do Dia (posições específicas), Notificações (gatilho de atualização)
- Conecta para: Solicitações (acompanhar), Entregas (prazos próximos), Mensagens (contextual), IA
- Restrições ativas do Membro aparecem como contexto (ex.: *"você está com restrição de alta acrobacia registrada"*)

---

### S-02 — PAINEL OPERACIONAL (Home do Supervisor)
**Classificação:** Primária | **Perfil principal:** Supervisor

**1. Objetivo principal**
Ser a resposta imediata para a pergunta operacional diária do Supervisor: *"A operação de hoje está protegida?"* Não é um dashboard de indicadores. É uma triagem de exceções com visão de consequências.

**2. Público principal**
Supervisor. Escopo restrito ao seu Grupo Operacional dentro da Operação.

**3. Frequência de uso**
Múltiplas vezes ao dia. Abertura ao iniciar o turno + verificações entre atividades + quando chega notificação de exceção.

**4. Pergunta que responde**
*"Existe alguma exceção que precisa da minha atenção agora? O que vai afetar a operação hoje?"*

**5. Jornadas relacionadas**
- JS-01 (Início do Dia Operacional) — jornada principal
- JS-03 (Substituição Emergencial) — jornada crítica, ponto de entrada
- JS-08 (Múltiplas Exceções) — jornada crítica
- JS-05 (Monitoramento de Confirmação) — presente como elemento desta superfície

**6. Informações mais importantes**
Em ordem de prioridade visual:
1. Status geral da operação: Pronta / Atenção / Crítico
2. Exceções ativas: lista priorizada por impacto e urgência
3. Para cada exceção: qual atividade afeta, em quanto tempo começa, existe cobertura?
4. Confirmações pendentes: quem ainda não confirmou mudanças publicadas
5. Visão do multi-horizonte: riscos dos próximos 3 dias (sob demanda)
6. Solicitações aguardando análise (badge / indicador)

**7. Decisões que suporta**
- *"Existe algo que precisa de mim agora ou posso planejar?"* (urgência vs. planejamento)
- *"Qual exceção resolver primeiro quando existem múltiplas?"* (triagem por impacto)
- *"Todos os membros afetados pela última mudança confirmaram?"* (rastreamento de comunicação)

**8. Riscos se for mal projetada**
- Exceções listadas em ordem de criação, não de impacto → Supervisor resolve a errada primeiro
- Status da operação não aparece imediatamente → Supervisor precisa fazer triagem manual
- Multi-horizonte exige navegação separada → Supervisor perde o contexto do dia enquanto planeja a semana
- Confirmações pendentes não são visíveis nesta superfície → Supervisor assume que notificou = ciente

**9. Relação com IA**
A IA do Supervisor tem seu maior momento de valor aqui. Atua como copiloto operacional:
- Identifica e prioriza exceções automaticamente ao abrir
- Resume o impacto de cada exceção em linguagem operacional
- Propõe a próxima ação recomendada ("Resolva isso primeiro")
- *"O que aconteceu enquanto eu estava offline?"* → narrativa de eventos desde a última abertura

**10. Relação com outros pilares**
- Alimentada por: Escala (estado atual), Solicitações (pendências), Notificações (status de confirmação)
- Conecta para: Escala (para agir), Livro do Dia (revisar), Solicitações (analisar), Mensagens (comunicar)
- Visão do Grupo: apenas o escopo de autoridade do Supervisor (não da Operação inteira)

---

### S-03 — PAINEL DE SAÚDE (Home do Admin)
**Classificação:** Primária | **Perfil principal:** Admin

**1. Objetivo principal**
Ser a resposta para a pergunta organizacional do Admin: *"O ecossistema está saudável? Existe algo que exige minha atenção?"* Não é uma réplica do Painel Operacional — é uma camada acima, que mostra tendências e padrões, não eventos individuais.

**2. Público principal**
Admin. Escopo: todas as Operações.

**3. Frequência de uso**
Diária ou semanal. Menos frequente que as Homes de Supervisor e Membro, mas abre crises quando não é verificada.

**4. Pergunta que responde**
*"Qual das minhas operações precisa de atenção? Existe algum padrão que está piorando?"*

**5. Jornadas relacionadas**
- JA-01 (Verificação de Saúde) — jornada principal
- JA-04 (Monitoramento de Tendências) — presente como elemento desta superfície
- JA-02 (Investigação de Problema) — ponto de entrada para mergulho

**6. Informações mais importantes**
Em ordem de prioridade visual:
1. Estado de saúde por Operação: Saudável / Atenção / Crítico
2. Para cada operação em Atenção ou Crítico: sinal específico e tendência (crescendo ou estável?)
3. Indicadores de tendência: tempo médio de resposta em Solicitações, frequência de correções pós-publicação, escaladas para Admin
4. Itens sem responsável definido (Grupos, funções, solicitações sem dono)
5. Padrões detectados automaticamente: reincidências, concentrações de risco

**7. Decisões que suporta**
- *"Devo intervir agora ou acompanhar?"*
- *"Isso é um evento isolado ou está se tornando um padrão?"*
- *"Qual operação precisa de atenção prioritária?"*

**8. Riscos se for mal projetada**
- Mostra números sem contexto → Admin não sabe o que o indicador significa
- Mostra estado atual sem tendência → Admin não sabe se está melhorando ou piorando
- Mistura nível operacional (Supervisor) com nível organizacional (Admin) → superfície errada para o problema
- Itens sem responsável não aparecem → problemas crescem sem dono

**9. Relação com IA**
A IA do Admin tem seu maior momento de valor aqui. Atua como analista organizacional:
- Resume o estado de cada Operação em linguagem narrativa
- Detecta padrões antes que o Admin precise perguntar
- *"Existe algo que preciso saber hoje?"* → diagnóstico proativo por Operação
- *"Qual é a tendência do Snowland nas últimas 3 semanas?"* → resposta analítica com dados

**10. Relação com outros pilares**
- Alimentada por: dados agregados de todas as Operações (Escala, Solicitações, Histórico, Entregas)
- Conecta para: Histórico (investigar), Operações (configurar), Grupos (ajustar estrutura), IA (análise)
- Não conecta diretamente para: Meu Dia, Livro do Dia — esses são operacionais, não estratégicos

---

### S-04 — ESCALA
**Classificação:** Primária | **Perfil principal:** Supervisor (gestão), Admin (visibilidade)

**1. Objetivo principal**
Ser a representação oficial de quem faz o quê e quando em cada Operação. A Escala é a fonte de verdade que alimenta todas as outras superfícies operacionais. Tudo que o Membro vê no Meu Dia vem da Escala.

**2. Público principal**
Supervisor (constrói e publica). Admin (visualiza e monitora). Membro nunca acessa a Escala diretamente — recebe sua fatia via Meu Dia.

**3. Frequência de uso**
Supervisor: diária ou na véspera (construção/revisão). Admin: semanal ou quando investiga.

**4. Pergunta que responde**
Para o Supervisor: *"Quem está alocado onde, existe alguma posição descoberta, está tudo validado para publicar?"*

**5. Jornadas relacionadas**
- JS-04 (Geração e Publicação do Livro do Dia) — usa Escala como base
- JS-02 (Análise de Folga) — impacto visível na Escala
- JS-03 (Substituição) — resultado publicado na Escala
- JS-08 (Múltiplas Exceções) — visão global via Escala

**6. Informações mais importantes**
Em ordem de prioridade:
1. Estado de cada posição: coberta / em risco / em aberto
2. Alertas de validação: conflitos de horário, posições críticas sem cobertura
3. Folgas e restrições ativas visíveis como contexto de cada membro
4. Alternativas disponíveis para cada posição problemática
5. Efeito cascata antes de confirmar qualquer substituição
6. Histórico de publicações (quando foi publicada, quem publicou, o que mudou)

**7. Decisões que suporta**
- *"Posso publicar agora ou ainda tenho posições críticas em aberto?"*
- *"Quem pode cobrir esta posição sem gerar novos problemas?"*
- *"Esta substituição cria cascata? Qual?"*

**8. Riscos se for mal projetada**
- Apresenta lista plana de membros disponíveis → Supervisor escolhe sem critério de risco
- Cascata não é visível antes da confirmação → Supervisor resolve um problema e cria dois
- Publicar com alertas abertos sem confirmação explícita → erros chegam aos membros
- Escala de toda a Operação visível para Supervisor → excesso de informação além do seu escopo

**9. Relação com IA**
- Gera proposta automática de cobertura para posições problemáticas
- Classifica candidatos a substituto por risco (4 camadas)
- Simula cascata antes de confirmar movimento
- Detecta acúmulo invisível de folgas em uma mesma data

**10. Relação com outros pilares**
- Alimenta: Meu Dia (fatia individual), Livro do Dia (posições específicas do show)
- Alimentada por: Agenda (eventos), Folgas (ausências aprovadas), Restrições (limitações ativas), Livro do Show (estrutura base)
- Conecta para: Livro do Dia (geração), Solicitações (solicitações pendentes), Histórico (registro de publicações)

---

### S-05 — LIVRO DO DIA
**Classificação:** Primária | **Perfil principal:** Supervisor (gestão), Membro (consulta)

**1. Objetivo principal**
Ser o detalhamento operacional de um show específico em uma data específica: quem faz cada papel, quais são as particularidades do dia, o que foi ajustado em relação ao Livro do Show base. É o documento operacional do dia do show.

**2. Público principal**
Supervisor (cria/revisa/aprova). Membro (consulta sua parte, acesso ao contexto completo do show).

**3. Frequência de uso**
Supervisor: diária (antes de cada show ou na véspera). Membro: antes de cada show (menos frequente que o Meu Dia).

**4. Pergunta que responde**
Para Supervisor: *"Este show está pronto para acontecer? Todas as posições estão cobertas?"*
Para Membro: *"No show de hoje, qual é meu papel e existe algo diferente do usual?"*

**5. Jornadas relacionadas**
- JS-04 (Geração e Publicação do Livro do Dia) — jornada principal para esta superfície
- JS-03 (Substituição) — resultado refletido no Livro do Dia
- JM-01 (Meu Dia) — Membro acessa Livro do Dia para aprofundamento

**6. Informações mais importantes**
Para Supervisor:
1. Status por posição: coberta / em risco / em aberto
2. Diferenças em relação ao Livro do Show base (o que foi ajustado)
3. Alertas: posições críticas sem cobertura definida
4. Histórico de versões do Livro do Dia (o que mudou em qual versão)

Para Membro:
1. Qual é seu papel neste show
2. Existe alguma diferença do usual (personagem diferente, horário diferente, instrução especial)
3. Informações do Livro do Show relacionadas ao seu papel

**7. Decisões que suporta**
Para Supervisor: *"Aprovo este Livro do Dia ou ainda preciso ajustar posições?"*
Para Membro: *"Estou preparado para o show de hoje como definido?"*

**8. Riscos se for mal projetada**
- Supervisor aprova Livro com posição em aberto sem perceber visualmente
- Membro vê o Livro do Dia inteiro (de toda a Operação) e fica confuso com informações que não são suas
- Diferenças em relação ao Livro do Show não estão destacadas → Membro não sabe o que mudou
- Livro do Dia gerado com dados desatualizados (restrição registrada depois da geração)

**9. Relação com IA**
- Geração automática da proposta a partir do Livro do Show + Folgas + Restrições
- Identifica posições em aberto e sugere cobertura
- Detecta diferenças em relação à versão anterior do Livro do Dia para o mesmo show
- Para o Membro: *"O que mudou no Livro do Dia de hoje em relação ao que eu estava esperando?"*

**10. Relação com outros pilares**
- Gerado a partir de: Livro do Show (estrutura base), Escala (alocações), Folgas (ausências), Restrições (limitações)
- Alimenta: Meu Dia do Membro (fatia individual do Livro)
- Conecta para: Histórico (versões anteriores), Escala (ajustes de cobertura)

**Tensão crítica com S-04 (Escala):**
Escala e Livro do Dia representam coisas diferentes: a Escala é quem está alocado em qual data (visão de calendário), o Livro do Dia é como um show específico está escalado naquela data (visão por espetáculo). A distinção precisa ser clara na navegação — Supervisor não deve confundir as duas superfícies.

---

## SUPERFÍCIES SECUNDÁRIAS
> Uso frequente. Suportam as jornadas principais e ciclos de trabalho específicos.

---

### S-06 — SOLICITAÇÕES
**Classificação:** Secundária | **Perfil principal:** Membro (criação), Supervisor (análise), Admin (monitoramento)

**1. Objetivo principal**
Ser o canal formal de pedidos estruturados entre Membro e Supervisor. Substituir conversas informais que hoje não têm rastreamento, estado visível ou histórico. Não é um formulário — é um processo com estado.

**2. Público principal**
Três públicos com funções diferentes:
- Membro: cria e acompanha
- Supervisor: analisa e decide
- Admin: monitora como indicador de saúde operacional

**3. Frequência de uso**
Semanal. O Membro cria 1-3 solicitações por semana. O Supervisor analisa em lotes.

**4. Pergunta que responde**
Para Membro: *"Em que estado está minha solicitação? Preciso fazer algo?"*
Para Supervisor: *"Existe alguma solicitação que preciso analisar agora? Qual é o impacto operacional de cada uma?"*

**5. Jornadas relacionadas**
- JM-03 (Criação e Acompanhamento de Solicitação) — jornada principal desta superfície
- JS-02 (Análise e Decisão de Folga) — jornada principal do Supervisor nesta superfície
- JA-01 (Saúde do Ecossistema) — Solicitações aparecem como indicador para o Admin

**6. Informações mais importantes**
Para Membro:
1. Estado de cada solicitação: Enviada / Em análise / Decidida
2. Há quanto tempo está no estado atual
3. Se decidida: resultado e motivo (obrigatório em negativas)
4. Se existe proposta alternativa do Supervisor: prazo para responder

Para Supervisor:
1. Solicitações aguardando análise, em ordem de urgência (por data de impacto, não por data de criação)
2. Para cada solicitação: análise de impacto automática antes de qualquer ação
3. Acumulado de folgas aprovadas para as mesmas datas solicitadas

**7. Decisões que suporta**
Para Supervisor: *"Aprovar, negar ou propor alternativa? Qual é o impacto operacional real desta decisão?"*

**8. Riscos se for mal projetada**
- Estado visível apenas dentro de cada item → Membro precisa abrir um por um para saber o que está acontecendo
- Solicitações em ordem de criação → Supervisor analisa uma folga de baixo impacto antes de uma urgente
- Negativa sem motivo possível → sistema permite que Supervisor negar sem explicação (destruidor de confiança)
- Tipos de solicitação visíveis apenas como código interno → Membro não entende em qual categoria se enquadra

**9. Relação com IA**
Para Supervisor: calcula impacto de cada solicitação antes de apresentar as opções de decisão
Para Membro: *"Por que minha folga foi negada?"* → IA explica o contexto operacional da decisão

**10. Relação com outros pilares**
- Gera: atualizações na Escala (quando aprovada), Notificação para o Membro
- Depende de: Escala (para calcular impacto), Histórico (para acumular decisões como dado de tendência)
- Conecta para: Mensagens (quando solicitação exige conversa), Histórico (registro de decisões)

**Pilar embutido:** Folgas não são superfície separada — são o tipo mais frequente dentro de Solicitações.

---

### S-07 — ENTREGAS
**Classificação:** Secundária | **Perfil principal:** Membro (execução), Supervisor (criação e avaliação)

**1. Objetivo principal**
Ser o ciclo completo de expectativa → execução → avaliação de tarefas entre Supervisor e Membro. Não é uma lista de tarefas — é um processo com expectativa explícita, prazo, critério e feedback.

**2. Público principal**
- Supervisor: cria, acompanha, avalia
- Membro: recebe, executa, envia

**3. Frequência de uso**
Periódica. Pode ser semanal ou mensal dependendo do tipo de Operação.

**4. Pergunta que responde**
Para Membro: *"O que é esperado de mim, qual é o prazo e o que significa fazer certo?"*
Para Supervisor: *"Em que estado estão as entregas do meu grupo? Existe alguma atrasada ou aguardando minha revisão?"*

**5. Jornadas relacionadas**
- JM-04 (Ciclo de Entrega) — jornada principal desta superfície
- JS-07 (Criação de Entrega para Membro) — jornada do Supervisor

**6. Informações mais importantes**
Para Membro:
1. Objetivo claro (o que é esperado — não o que precisa fazer)
2. Critério de avaliação (o que significa "feito certo")
3. Prazo exato (data e horário — sem ambiguidade)
4. Estado atual (aguardando envio / enviada / em análise / aprovada / ajuste solicitado)
5. Feedback do Supervisor quando existe (específico, não genérico)

Para Supervisor:
1. Estado de cada Entrega em andamento: enviada / aguardando envio / prazo próximo
2. Entregas que exigem minha revisão agora

**7. Decisões que suporta**
Para Membro: *"O que preciso fazer agora? Tenho uma entrega urgente?"*
Para Supervisor: *"Aprovado / Solicitar ajuste / Negar? O que precisa ser corrigido?"*

**8. Riscos se for mal projetada**
- Objetivo genérico → Membro entrega algo diferente do esperado
- Prazo sem horário → Membro entrega às 23h quando era esperado para as 14h
- Feedback genérico ("pode melhorar") → Membro não sabe o que mudar
- Ciclo de ajustes não mantém histórico → perda de contexto entre iterações
- Estado visível apenas dentro de cada item → Membro não sabe se tem urgência sem abrir todos

**9. Relação com IA**
Para Membro: *"O que exatamente é esperado nesta entrega?"* → IA interpreta os campos e responde em linguagem pessoal
Para Supervisor: IA alerta sobre entregas com prazo próximo sem envio

**10. Relação com outros pilares**
- Conecta para: Mensagens (conversa contextual dentro da Entrega), Histórico (registro de todas as versões e feedbacks)
- Independente de: Escala e Livro do Dia (Entregas são paralelas à operação diária, não dependem de shows)

---

### S-08 — AVISOS
**Classificação:** Secundária | **Perfil principal:** Supervisor (envio), Admin (envio multi-operação), Membro (recebimento)

**1. Objetivo principal**
Ser o canal oficial de comunicação unidirecional operacional. Informações que todos precisam saber, não precisam responder, e ficam registradas como documento operacional. Não é mensagem — é documento com data.

**2. Público principal**
- Supervisor: cria e envia para seu Grupo
- Admin: cria e envia para uma ou múltiplas Operações
- Membro: recebe e confirma leitura (quando exigido)

**3. Frequência de uso**
Supervisor: várias vezes por semana. Membro: recebe avisos com frequência variável.

**4. Pergunta que responde**
Para Membro: *"Existe alguma comunicação oficial que preciso ler e confirmar?"*
Para Supervisor: *"Todos leram o aviso que enviei?"*

**5. Jornadas relacionadas**
- JS-05 (Comunicação Pós-Alteração) — Avisos são um dos instrumentos desta jornada
- JM-01 (Meu Dia) — Avisos importantes aparecem como elemento do Meu Dia

**6. Informações mais importantes**
Para Membro: o que o Aviso comunica, se exige confirmação, se já foi lido
Para Supervisor: lista de quem confirmou vs. quem não confirmou, com rastreamento por proximidade de horário

**7. Decisões que suporta**
Para Supervisor: *"Preciso renotificar alguém que não confirmou leitura antes do início da atividade?"*

**8. Riscos se for mal projetada**
- Aviso e Mensagem usam o mesmo canal → distinção mental se perde, o Membro começa a esperar resposta de Avisos
- Confirmação de leitura opcional → Supervisor não consegue rastrear quem está ciente
- Aviso enterrado entre outros avisos de menor urgência → comunicação crítica passa despercebida
- Rastreamento de confirmação não acessível → Supervisor assume que enviou = todos sabem

**9. Relação com IA**
IA pode resumir Avisos acumulados não lidos para o Membro
IA pode alertar o Supervisor sobre membros que não confirmaram leitura próximo do horário da atividade

**10. Relação com outros pilares**
- Fundamentalmente diferente de: Mensagens (unidirecional vs. bidirecional; broadcast vs. contextual)
- Conecta para: Histórico (todos os Avisos ficam registrados como documento operacional)
- Gera: Notificações para os destinatários

**Sobreposição crítica com S-09 (Mensagens):**
Avisos e Mensagens precisam de distinção visual clara no produto. A pesquisa do Membro confirmou que a distinção mental existe ("Aviso = sei, Mensagem = respondo"), mas o UX precisa reforçar isso. O risco é que uma única caixa de entrada misture os dois e destrua a distinção.

---

### S-09 — MENSAGENS
**Classificação:** Secundária | **Perfil principal:** Todos (comunicação contextual e direta)

**1. Objetivo principal**
Ser o canal de comunicação conversacional bidirecional do produto. Abrange: mensagens diretas entre usuários, conversas contextuais dentro de Entregas e Solicitações, e comunicação de alinhamento pós-decisão.

**2. Público principal**
Todos os perfis. Cada um com um padrão de uso diferente:
- Membro: usa para perguntar, esclarecer, acompanhar
- Supervisor: usa para alinhar após decisões e dar contexto
- Admin: usa para escaladas recebidas e comunicações de nível organizacional

**3. Frequência de uso**
Frequente mas assíncrona. Não é tempo real — é contextual.

**4. Pergunta que responde**
Para Membro: *"Existe uma conversa que preciso de mim?"*
Para Supervisor: *"Existe alguém aguardando minha resposta?"*

**5. Jornadas relacionadas**
- JM-02 (Mudança de Última Hora) — Membro pode enviar Mensagem para esclarecer a mudança
- JM-03 (Solicitação) — Mensagens contextuais dentro de Solicitações
- JM-04 (Entrega) — Mensagens contextuais dentro de Entregas
- JS-05 (Comunicação Pós-Alteração) — Supervisor usa Mensagem quando Aviso não é suficiente

**6. Informações mais importantes**
1. Mensagens que exigem resposta (vs. informativos)
2. Contexto da conversa: a qual item está vinculada (Entrega, Solicitação, ou é direta)?
3. Histórico da conversa: o que foi dito antes

**7. Decisões que suporta**
Para qualquer perfil: *"Preciso responder algo agora? Existe uma conversa que está aguardando minha contribuição?"*

**8. Riscos se for mal projetada**
- Mensagens diretas e contextuais misturadas sem distinção → usuário não sabe a que contexto pertence cada conversa
- Mensagem se comporta como Aviso → Membro começa a não responder Mensagens reais
- Ausência de indicação de quem está aguardando resposta → conversas ficam paradas sem que ninguém perceba

**9. Relação com IA**
IA não atua como participante de conversas entre usuários. Pode atuar como:
- Contextualizador: *"Qual é o histórico desta conversa com o Supervisor?"*
- Draftassistant (fora do MVP): ajuda a formular uma mensagem

**10. Relação com outros pilares**
- Conversas contextuais existem dentro de: Entregas, Solicitações (comentários vinculados)
- Diferente de: Avisos (unidirecional, broadcast), Notificações (infraestrutura)
- Conecta para: Histórico (conversas são registradas)

---

### S-10 — IA / ASSISTENTE
**Classificação:** Secundária (como superfície dedicada) + embarcada em todas as superfícies

**1. Objetivo principal**
Como superfície dedicada: ser o lugar onde o usuário faz perguntas livres e acessa o histórico de interações com a IA. Como elemento embarcado: contextualizar e facilitar o uso de cada outra superfície.

**2. Público principal**
Todos os perfis, com personas radicalmente diferentes:
- Supervisor: copiloto operacional (análise, recomendação, cascata)
- Membro: intérprete pessoal (tradução, dúvidas, status)
- Admin: analista organizacional (padrões, narrativas, tendências)

**3. Frequência de uso**
Como elemento embarcado: diária, invisível (aparece como sugestão ou resposta contextual).
Como superfície dedicada: frequente mas secundária (quando o usuário quer conversa livre).

**4. Pergunta que responde**
Para Supervisor: *"O que eu deveria fazer agora? Qual é o impacto desta decisão?"*
Para Membro: *"O que está acontecendo comigo hoje? O que mudou?"*
Para Admin: *"O que está acontecendo no meu ecossistema? Existe algum padrão que preciso ver?"*

**5. Jornadas relacionadas**
- JM-05 (Consulta à IA) — jornada dedicada a esta superfície
- Presente em: JS-01, JS-03, JS-04, JM-01, JM-02, JA-01 (embarcada)

**6. Informações mais importantes**
1. Histórico de conversas anteriores com a IA
2. Contexto da última ação feita no produto
3. Para o Admin: capacidade de acesso transversal a dados de todas as Operações

**7. Decisões que suporta**
A IA suporta decisões — não as substitui. O fluxo é sempre: Proposta → Confirmação → Execução → Desfazer.

**8. Riscos se for mal projetada**
- IA executa sem pedir confirmação → usuário perde controle
- IA propõe algo errado e não é possível desfazer → dano sem reversão
- IA do Membro exibe dados de outros membros → quebra de privacidade
- IA generalista responde igualmente para todos os perfis → perde o valor de persona
- Histórico de ações da IA não é auditável → Admin não consegue investigar o que a IA fez

**9. Relação com outros pilares**
- Acessa: todos os pilares com base nas permissões do usuário que a acionou
- Age com: as permissões do usuário ativo (Membro da IA não pode publicar Escala)
- Registra no: Histórico (todas as ações da IA são rastreáveis)

**Decisão de design crítica:**
A IA não é uma única superfície — é um elemento que tem dois modos:
1. **Embarcado (contextual):** aparece dentro de cada superfície como sugestão, alerta ou resposta rápida
2. **Dedicado (chat livre):** superfície onde o usuário faz perguntas abertas e vê histórico

Esses dois modos precisam ser projetados com consistência. O usuário não deve precisar "ir para a IA" para ter ajuda — a ajuda aparece onde está.

---

### S-11 — HISTÓRICO
**Classificação:** Secundária | **Perfil principal:** Admin (investigação), todos (consulta e prova)

**1. Objetivo principal**
Ser a memória auditável do produto. Não é um log técnico — é uma narrativa de eventos organizados por contexto, que qualquer usuário pode usar para entender o que aconteceu.

**2. Público principal**
- Admin: usa como ferramenta de investigação e prova organizacional
- Supervisor: usa para verificar o que foi comunicado e confirmado
- Membro: usa como prova de que recebeu (ou não) uma informação

**3. Frequência de uso**
Baixa por perfil. Alta em situações de conflito, investigação ou auditoria.

**4. Pergunta que responde**
*"O que aconteceu? Quem fez o quê? Quando? O sistema pode provar isso?"*

**5. Jornadas relacionadas**
- JA-02 (Investigação de Problema) — jornada principal desta superfície para Admin
- JS-03 (Substituição) — Supervisor pode verificar histórico de uma substituição
- JM-03 (Solicitação) — Membro pode ver o histórico de uma solicitação

**6. Informações mais importantes**
1. Para cada evento: quem fez, o que fez, quando, qual era o estado antes e depois
2. Para ações da IA: exatamente o que a IA propôs, o usuário confirmou, e qual foi o resultado
3. Navegabilidade por entidade: histórico de um membro específico, de uma Escala específica, de um show específico
4. Detecção de padrão de reincidência: esse tipo de evento aconteceu outras vezes?

**7. Riscos se for mal projetada**
- Histórico exibe dados técnicos sem contexto → Admin precisa interpretar o que significam
- Histórico é uma tabela linear → impossível investigar uma situação que envolveu múltiplas entidades
- Histórico de ações da IA misturado com ações humanas sem distinção → impossível separar responsabilidades

**8. Relação com IA**
A IA tem seu maior papel no Histórico para o Admin: transforma registros em narrativa.
*"Resuma o que aconteceu com a Escala do dia 14."* → IA conta a história em linguagem natural, não retorna uma lista de eventos.

**9. Relação com outros pilares**
- Alimentado por: todos os pilares (toda ação em qualquer pilar gera registro)
- Conecta para: cada entidade do sistema (abre o Histórico de uma Solicitação específica, de um Membro, de um Show)

---

### S-12 — AGENDA
**Classificação:** Secundária | **Perfil principal:** Admin (gestão), Supervisor (consulta), Membro (compromissos pessoais)

**1. Objetivo principal**
Ser a fonte oficial de eventos que determinam quando e o que acontece em cada Operação. É o calendário de verdade do produto — não o calendário pessoal de ninguém.

**2. Público principal**
- Admin: cria e gerencia eventos oficiais (shows, temporadas, ensaios gerais)
- Supervisor: consulta para entender o que tem que cobrir e quando
- Membro: cria compromissos pessoais (que não entram na Escala operacional)

**3. Frequência de uso**
Admin: na criação de temporadas / programação de shows. Supervisor: consulta frequente mas passiva (vê o que tem, não cria).

**4. Pergunta que responde**
Para Admin: *"O calendário operacional está correto para as próximas semanas?"*
Para Supervisor: *"O que tem programado para esta semana que precisa de cobertura?"*

**5. Jornadas relacionadas**
- JS-06 (Planejamento Semanal) — Supervisor usa Agenda como base
- JA-05 (Setup de Nova Operação) — Admin constrói Agenda na implantação

**6. Tensão de design:**
A Agenda existe como entidade separada na arquitetura, mas na experiência do Supervisor pode ser difícil distingui-la da Escala. A distinção é: Agenda = *o que vai acontecer* (eventos), Escala = *quem vai cobrir o que vai acontecer* (pessoas). Essa distinção precisa ser clara no UX ou os usuários vão tentar fazer as duas coisas na mesma superfície.

**7. Riscos se for mal projetada**
- Supervisores tentam criar eventos na Agenda (é território do Admin) → conflito de permissão não claro
- Distinção Agenda/Escala não é percebida → usuário busca o evento no lugar errado
- Compromissos pessoais do Membro aparecem misturados com eventos operacionais → confusão

**8. Relação com outros pilares**
- Alimenta: Escala (eventos da Agenda definem o que precisa de cobertura na Escala)
- Conecta para: Livro do Show (cada evento da Agenda tem um Livro do Show associado)

---

## SUPERFÍCIES EVENTUAIS
> Uso ocasional. Necessárias mas não diárias. Podem ter menos polimento inicial.

---

### S-13 — LIVRO DO SHOW
**Classificação:** Eventual | **Perfil principal:** Admin/Supervisor (construção e manutenção)

**1. Objetivo principal**
Ser a estrutura permanente de um espetáculo: quais posições existem, quais funções cada posição exige, quais são as regras de substituição, qual é o elenco base. É o template que gera o Livro do Dia.

**2. Público principal**
Admin: cria e gerencia. Supervisor: consulta como referência.

**3. Frequência de uso**
Baixa. Criado uma vez por show, atualizado quando existe mudança estrutural no espetáculo.

**4. Tensão crítica com S-05 (Livro do Dia):**
Livro do Show é o template. Livro do Dia é a instância. A navegação precisa deixar absolutamente claro em qual dos dois o usuário está. Uma mudança no Livro do Show não altera automaticamente Livros do Dia já gerados — isso precisa ser explícito.

**5. Riscos se for mal projetada**
- Usuário edita o Livro do Show achando que está editando o Livro do Dia → impacto indesejado em shows futuros
- Distinção visual insuficiente entre os dois → erros permanentes de cobertura

---

### S-14 — BIBLIOTECA
**Classificação:** Eventual | **Perfil principal:** Todos (consulta), Admin (gestão de conteúdo)

**1. Objetivo principal**
Ser o repositório de conhecimento da Operação. O lugar onde qualquer usuário pode encontrar resposta para uma dúvida operacional sem precisar perguntar para uma pessoa.

**2. Frequência de uso**
Baixa mas importante. O Membro usa quando tem dúvida específica. A IA acessa constantemente como base de conhecimento.

**3. Pergunta que responde**
*"Onde encontro a informação oficial sobre [X]?"*

**4. Relação com IA**
A IA acessa a Biblioteca automaticamente para responder perguntas dos usuários. Para o Membro, a Biblioteca é frequentemente acessada *via IA*, não diretamente. Isso tem implicação de design: a superfície Biblioteca precisa existir para o Admin gerenciar conteúdo, mas o acesso do Membro pode ser primariamente mediado pela IA.

**5. Riscos se for mal projetada**
- Conteúdo organizado em uma lógica que não corresponde a como os usuários buscam (por categoria vs. por situação)
- IA responde com base em informação desatualizada da Biblioteca
- Membro precisa navegar manualmente por estrutura hierárquica sem mecanismo de busca eficiente

---

## SUPERFÍCIES ADMINISTRATIVAS
> Configuração e governança. Baixa frequência, alta consequência. Usadas para construir a estrutura que tudo o mais usa.

---

### S-15 — EQUIPES / GRUPOS OPERACIONAIS
**Classificação:** Administrativa | **Perfil principal:** Admin (gestão), Supervisor (consulta)

**1. Objetivo principal**
Definir e gerenciar a estrutura humana da Operação: quais Grupos existem, quem pertence a cada Grupo, quem é o Supervisor responsável por cada Grupo, quais Funções cada membro pode exercer.

**2. Frequência de uso**
Baixa. Alta consequência. Mudanças aqui afetam todos os outros pilares.

**3. Pergunta que responde**
Para Admin: *"A estrutura de pessoas e responsabilidades está correta?"*
Para Supervisor: *"Quais são os membros do meu Grupo e quais funções cada um pode exercer?"*

**4. Decisões que suporta**
- *"Quem é responsável por este Grupo?"*
- *"Quem pode exercer esta função?"*
- *"Existe algum Grupo sem Supervisor ou alguma função sem membro habilitado?"*

**5. Riscos se for mal projetada**
- Mudança estrutural sem visibilidade de impacto → consequências não esperadas aparecem na Escala dias depois
- Grupo fica sem Supervisor e ninguém percebe imediatamente
- Membro é removido de Grupo sem que suas solicitações e entregas em andamento sejam transferidas

**6. Pilar embutido:** Restrições ativas de cada membro são acessíveis dentro do Perfil do Membro nesta superfície.

---

### S-16 — OPERAÇÕES
**Classificação:** Administrativa | **Perfil principal:** Admin

**1. Objetivo principal**
Gerenciar as Operações existentes no sistema: criar, configurar, ativar, desativar. É a superfície de mais alto nível do produto — todas as outras superfícies existem dentro de uma Operação.

**2. Frequência de uso**
Muito baixa. Criação acontece uma vez. Ajustes são raros.

**3. Tensão com S-15 (Grupos):**
Operações e Grupos têm uma relação hierárquica clara (Operação → Grupos → Membros). A navegação entre estas duas superfícies administrativas precisa refletir essa hierarquia sem exigir que o usuário navegue entre superfícies desconectadas.

---

### S-17 — CONFIGURAÇÕES
**Classificação:** Administrativa | **Perfil principal:** Admin

**1. Objetivo principal**
Gerenciar parâmetros técnicos e operacionais: usuários e permissões, notificações padrão, regras de validação da Escala, integrações. Não é uma superfície de uso — é uma sala de controle.

**2. Frequência de uso**
Baixíssima. Usada na implantação e em manutenções pontuais.

**3. Riscos se for mal projetada**
- Configurações que afetam comportamento de segurança (permissões, notificações críticas) misturadas com configurações triviais → risco de erro com consequências sérias
- Mudanças de permissão sem log no Histórico → impossível auditar quem fez o quê

---

## ANÁLISE CRÍTICA DE SOBREPOSIÇÕES

### Sobreposição 1: Avisos vs. Mensagens
**Risco:** Alta. A pesquisa do Membro confirmou que a distinção mental existe, mas é frágil. Se o UX não reforçar a distinção visualmente, o Membro começa a esperar resposta de Avisos e a ignorar Mensagens como documentos.

**Decisão de design recomendada:** Avisos e Mensagens devem ter tratamento visual completamente diferente — fonte, cor, ícone, comportamento. Avisos são documentos; Mensagens são conversas. Jamais devem aparecer na mesma lista sem distinção.

### Sobreposição 2: Escala vs. Livro do Dia vs. Meu Dia
**Risco:** Médio. Os três mostram "quem faz o quê e quando" mas em perspectivas radicalmente diferentes. A sobreposição é de conteúdo, não de propósito.

**Decisão de design recomendada:** As três superfícies precisam de nomenclatura e narrativa de entrada absolutamente distintas. A navegação entre elas deve ser explícita (não existe caminho ambíguo).

### Sobreposição 3: Home Supervisor vs. Escala
**Risco:** Médio. O Painel Operacional do Supervisor mostra o estado da operação (via Escala), e a Escala é o lugar onde o Supervisor age sobre essa operação. O risco é que o Supervisor resolva tudo na Home sem ir para a Escala — e perca visibilidade de cascata.

**Decisão de design recomendada:** A Home do Supervisor é diagnóstico + triagem. A Escala é onde se age. A Home deve sempre conduzir o Supervisor para a Escala quando existe ação necessária — não resolver diretamente.

### Sobreposição 4: Histórico vs. Estado de cada superfície
**Risco:** Baixo. O Histórico é uma superfície separada de investigação. O estado de cada item (solicitação, entrega, aviso) é visível dentro da própria superfície. Não existe redundância — são níveis diferentes de detalhe.

### Sobreposição potencial: Livro do Show vs. Configurações
**Risco:** Médio. O Livro do Show tem natureza administrativa (criado uma vez, raramente alterado) mas propósito operacional (é o template que gera o Livro do Dia). Colocá-lo em Configurações seria um erro — pertence ao contexto operacional mas tem frequência de edição administrativa.

**Decisão de design recomendada:** Livro do Show pertence à Agenda ou à superfície de Operações como subitem de configuração de show — não a Configurações técnicas.

---

## MAPA HIERÁRQUICO DE SUPERFÍCIES

### Nível 1 — Superfícies Centrais
> Definem o valor core do produto. São a experiência.

```
PRODUTO MYASA 2.0
│
├── MEU DIA (S-01)
│   └── Entrada principal do Membro
│
├── PAINEL OPERACIONAL (S-02)
│   └── Entrada principal do Supervisor
│
├── PAINEL DE SAÚDE (S-03)
│   └── Entrada principal do Admin
│
├── ESCALA (S-04)
│   └── Fonte de verdade operacional
│
└── LIVRO DO DIA (S-05)
    └── Operacionalização de cada show
```

### Nível 2 — Superfícies de Apoio
> Suportam os ciclos de trabalho de cada perfil. Presença necessária no MVP.

```
CICLOS DE TRABALHO
│
├── SOLICITAÇÕES (S-06)
│   └── Inclui Folgas como tipo
│
├── ENTREGAS (S-07)
│
├── AVISOS (S-08)
│   └── Broadcast operacional
│
├── MENSAGENS (S-09)
│   └── Contextual e bidirecional
│
├── IA / ASSISTENTE (S-10)
│   ├── Embarcada em todas as superfícies
│   └── Chat dedicado (histórico de conversas)
│
├── HISTÓRICO (S-11)
│   └── Memória auditável
│
└── AGENDA (S-12)
    └── Calendário oficial de eventos
```

### Nível 3 — Superfícies Administrativas e Eventuais
> Estrutura que tudo o mais depende. Menos frequência, não menos importância.

```
ESTRUTURA E CONFIGURAÇÃO
│
├── LIVRO DO SHOW (S-13)
│   └── Template estrutural de cada espetáculo
│
├── BIBLIOTECA (S-14)
│   └── Repositório de conhecimento
│
├── EQUIPES / GRUPOS (S-15)
│   └── Inclui Perfil do Membro e Restrições
│
├── OPERAÇÕES (S-16)
│   └── Gestão da unidade mais alta
│
└── CONFIGURAÇÕES (S-17)
    └── Permissões, notificações, integrações
```

---

## RESPOSTAS ESTRATÉGICAS

### 1. Quais superfícies representam 80% do uso real?

| Superfície | Perfis que usam | Frequência | Criticidade |
|---|---|---|---|
| Meu Dia (S-01) | Membro | Diária, múltipla | Alta |
| Painel Operacional (S-02) | Supervisor | Diária, múltipla | Alta |
| Escala (S-04) | Supervisor | Diária | Alta |
| Livro do Dia (S-05) | Supervisor | Diária | Alta |
| Solicitações (S-06) | Membro + Supervisor | Semanal | Média |
| Avisos (S-08) | Todos | Frequente | Média |
| Mensagens (S-09) | Todos | Frequente | Média |
| IA embarcada (S-10) | Todos | Diária (invisível) | Alta |
| Painel de Saúde (S-03) | Admin | Semanal | Alta |
| Histórico (S-11) | Admin | Semanal | Média |

**Essas 10 superfícies representam o produto que os usuários realmente usam todos os dias. O sucesso ou fracasso do MyASA será decidido por elas.**

---

### 2. Quais superfícies definem o sucesso do produto?

**Sucesso do produto depende de 5 superfícies-chave:**

**S-01 (Meu Dia)** — Se o Membro não confiar nessa superfície como fonte de verdade pessoal, o produto falha para o maior grupo de usuários. Meu Dia é a promessa do produto para o Membro.

**S-02 (Painel Operacional)** — Se o Supervisor não conseguir resolver exceções com velocidade e confiança nessa superfície, ele vai para o WhatsApp. O produto perde seu motivo de existir.

**S-04 (Escala)** — Se a Escala não refletir a realidade com precisão e sem cascata invisível, todo o ecossistema de dados quebra. Meu Dia exibe dado errado. Livro do Dia é gerado errado.

**S-10 (IA embarcada)** — A IA é o diferencial competitivo do MyASA. Se a IA for um chatbot genérico em vez de três personas contextuais, o produto é apenas mais um sistema operacional.

**S-11 (Histórico)** — A confiança no produto a longo prazo depende da capacidade de qualquer usuário provar o que aconteceu. Sem Histórico robusto, o produto não substitui o WhatsApp como sistema de registro.

---

### 3. Quais superfícies podem ficar para fases futuras sem comprometer o MVP?

| Superfície | Justificativa para adiar |
|---|---|
| Biblioteca (S-14) | A IA pode responder dúvidas básicas sem base estruturada no MVP. A Biblioteca melhora a IA mas não a bloqueia. |
| Agenda (S-12) — gestão avançada | Eventos básicos podem ser inseridos durante o setup. Gestão avançada de temporadas pode ser V2. |
| Livro do Show (S-13) — editor avançado | O setup inicial pode ser feito manualmente no onboarding. Editor avançado é V2. |
| Configurações (S-17) — integrações | Permissões e usuários são MVP. Integrações externas são V2. |
| Painel de Saúde (S-03) — tendências avançadas | O estado atual de cada Operação é MVP. Análise de tendência com IA precisa de dados históricos acumulados. |
| Entregas (S-07) — múltiplos tipos | Tarefa simples e Entrega digital são MVP. Projeto e Avaliação presencial podem ser V2. |

---

### 4. Quais superfícies precisam existir obrigatoriamente na versão piloto?

**Piloto = produto funcional que valida a hipótese central com usuários reais.**

Hipótese central: *"O MyASA resolve o silêncio operacional que hoje é preenchido pelo WhatsApp."*

**Superfícies obrigatórias no piloto:**

| Superfície | Por que não pode faltar |
|---|---|
| Meu Dia (S-01) | É o produto para o Membro. Sem isso, o Membro não tem razão para abrir o app. |
| Painel Operacional (S-02) | É o produto para o Supervisor. Sem isso, o Supervisor não abandona o WhatsApp. |
| Escala (S-04) | Sem Escala funcional, Meu Dia exibe dados fictícios. Tudo o mais quebra. |
| Livro do Dia (S-05) | É a primeira entrega de valor do Supervisor após a Escala. |
| Solicitações (S-06) — tipos básicos | Folga e Restrição no mínimo. É onde o Membro deixa de usar o WhatsApp para pedir. |
| Avisos (S-08) | É a comunicação oficial que substitui o "aviso no grupo do WhatsApp". |
| Mensagens (S-09) — básico | Mensagem direta contextual mínima. Sem isso, usuários voltam para o WhatsApp para conversar. |
| IA embarcada (S-10) — básica | A triagem de exceções do Supervisor precisa de IA para funcionar. Sem IA, a Escala é trabalho manual. |
| Equipes / Grupos (S-15) | Sem a estrutura de pessoas, nada funciona. |
| Operações + Configurações básicas (S-16/S-17) | Setup mínimo para a piloto rodar. |

**Superfícies que podem ser simplificadas no piloto (não removidas):**
- Histórico: versão básica (o que aconteceu, quem fez, quando). Investigação avançada é V2.
- Entregas: apenas Tarefa simples no piloto. Outros tipos na V2.
- Painel de Saúde: visão de estado atual. Tendências históricas na V2.

---

## PRINCÍPIOS DE DESIGN QUE EMERGEM DO MAPA

**1. Três produtos em um**
O MyASA é, na prática, três produtos com dados compartilhados: o produto do Membro (Meu Dia + Solicitações + Entregas), o produto do Supervisor (Painel Operacional + Escala + Livro do Dia), e o produto do Admin (Painel de Saúde + Histórico + Configurações). A navegação precisa refletir isso — os três não deveriam ter a mesma estrutura de menu.

**2. Nenhuma superfície primária deve exigir navegação para fazer seu trabalho principal**
O Membro não deve precisar sair do Meu Dia para confirmar uma mudança. O Supervisor não deve precisar sair do Painel Operacional para ver o impacto de uma exceção. Cada superfície primária deve ser autocontida para suas ações mais frequentes.

**3. A IA não é uma superfície — é uma camada**
A IA existe em duas formas: embarcada (em cada superfície, como contexto e sugestão) e dedicada (superfície de chat com histórico). A forma embarcada é mais valiosa e mais frequente. A forma dedicada existe para casos de uso avançado. O design não deve tratar a IA como uma seção isolada do menu.

**4. Superfícies administrativas devem confirmar antes de agir**
Qualquer mudança em Equipes/Grupos, Operações ou Configurações tem impacto em toda a estrutura. Essas superfícies nunca devem executar sem mostrar o impacto completo primeiro.

**5. O Histórico é a fundação da confiança**
O produto pode ter a melhor UX do mundo, mas se o usuário não conseguir provar o que aconteceu, não vai confiar nele para decisões importantes. O Histórico não é funcionalidade adicional — é o que torna o produto confiável para ser o sistema oficial.
