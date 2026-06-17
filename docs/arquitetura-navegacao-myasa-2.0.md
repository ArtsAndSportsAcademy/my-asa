# MyASA 2.0 — Arquitetura Oficial de Navegação

> Versão: 17/06/2026
> Fase: Arquitetura de Interface — anterior a wireframes, layouts e componentes
> Base: Arquitetura + Diretrizes + Pesquisas + Jornadas + Mapa de Superfícies + Auditoria Final
> Status: Pronto para servir de base ao Design de Interface

---

## Premissa Fundamental

O MyASA são **três produtos com dados compartilhados**, não um produto único com perfis diferentes.

Isso tem consequência direta na navegação: os três perfis não compartilham a mesma estrutura de menu, a mesma home, nem a mesma hierarquia de acesso. Cada perfil tem seu próprio sistema de navegação, calibrado pela sua frequência de uso, pela sua missão operacional, e pela sua relação com o tempo.

| Produto | Missão | Relação com o tempo |
|---|---|---|
| **Produto do Membro** | Certeza para executar | Hoje, agora, próxima atividade |
| **Produto do Supervisor** | Clareza para decidir | Agora, próximas horas, próximos 3 dias |
| **Produto do Admin** | Saúde organizacional | Semana, mês, tendência |

---

## Princípios de Navegação — Não Negociáveis

1. **Frequência de uso determina posição.** O que é usado todos os dias está sempre visível. O que é usado semanalmente exige um passo. O que é eventual fica em navegação profunda.

2. **A home não é um menu.** Para nenhum dos três perfis. A home é o ponto de diagnóstico — o lugar que responde à pergunta mais urgente antes de qualquer navegação.

3. **Notificação leva a superfície, não a um feed.** Quando o usuário toca em uma notificação, aterrissa na superfície relevante com o contexto do que mudou — não em um inbox genérico.

4. **A IA não é uma tela separada.** A IA é um elemento presente em múltiplas superfícies. Quando a jornada exige uma conversa mais profunda, existe um modo de chat dedicado — mas a IA não vive em uma aba isolada no final da nav bar.

5. **Sem navegação lateral entre perfis.** O MyASA não é um sistema onde o Supervisor "acessa a visão do Membro". Cada sessão tem um perfil ativo. Não existe alternância de perfil durante o uso.

6. **Navegação por tarefa, não por módulo.** O usuário não "vai para Folgas". O usuário "cria uma solicitação de folga" a partir de Solicitações. A navegação reflete objetivos, não estrutura de banco de dados.

7. **Profundidade de 3 níveis máximo.** Home → Superfície → Detalhe do item. Nenhuma ação crítica exige mais de 3 toques a partir da home.

---

## Modelo de Camadas de Navegação

Cada produto opera em 3 camadas de navegação:

**Camada 1 — Navegação Permanente (sempre visível)**
Superfícies de uso diário. Acessíveis com um toque a partir de qualquer estado do app.

**Camada 2 — Navegação Contextual (visível dentro de um fluxo)**
Superfícies de apoio que aparecem como destino natural de uma ação. O usuário chega aqui seguindo um fluxo, não procurando no menu.

**Camada 3 — Navegação Profunda (acessível via menu secundário)**
Superfícies de uso eventual ou administrativo. Não competem pela atenção no dia a dia.

---

---

# PARTE 1 — Arquitetura de Navegação do Membro

---

## Missão do Produto do Membro

> *"O que preciso fazer hoje, e mudou alguma coisa que eu precisa saber?"*

O Membro não gerencia operações. O Membro executa. A navegação do Membro deve ser tão simples que possa ser usada em trânsito, no camarim, nos 3 minutos antes de entrar em cena.

**Característica dominante:** navegação linear e pessoal. O Membro raramente precisa ir a mais de uma superfície para resolver o que precisa.

---

## 1. Ponto de entrada principal

**S-01 — Meu Dia**

O app abre sempre no Meu Dia. Sem exceção. Sem tela de boas-vindas. Sem feed de notícias. O Membro abre o app e imediatamente vê sua realidade operacional.

Se existe alguma alteração desde a última abertura, o Meu Dia a apresenta em primeiro lugar — antes de qualquer outra informação.

---

## 2. Primeira informação que o Membro precisa ver

Em ordem de prioridade (o sistema decide qual exibir primeiro com base no estado atual):

1. **Se existe alteração não confirmada:** o que mudou, o que era antes, o que confirmar
2. **Se não existe alteração:** próxima atividade — o quê, onde, quando, em qual papel
3. **Se não existe atividade hoje:** próximo evento futuro + eventuais pendências de solicitação ou entrega

O Membro nunca deve precisar procurar esta informação. Ela é o estado inicial da tela.

---

## 3. Superfícies acessadas diariamente

| Superfície | Frequência | Via |
|---|---|---|
| **S-01 Meu Dia** | Múltiplas vezes ao dia | Abertura do app + notificação |
| **S-08 Avisos** | Quando há aviso novo | Badge no Meu Dia → acesso direto |
| **S-10 IA (embarcada no Meu Dia)** | Sempre que tem dúvida sobre o dia | Elemento do Meu Dia |

---

## 4. Superfícies acessadas semanalmente

| Superfície | Frequência | Via |
|---|---|---|
| **S-06 Solicitações** | 1–3x por semana | Nav permanente |
| **S-07 Entregas** | 1–3x por semana | Nav permanente |
| **S-09 Mensagens** | Quando necessário | Nav permanente |

---

## 5. Superfícies acessadas eventualmente

| Superfície | Frequência | Via |
|---|---|---|
| **S-05 Livro do Dia** | Antes de shows | Link do Meu Dia → aprofundamento |
| **S-12 Agenda** | Quando quer ver calendário completo | Nav secundária |
| **S-14 Biblioteca** | Quando precisa de referência técnica | Nav secundária ou via IA |
| **S-10 IA (chat)** | Quando precisa de uma conversa mais profunda | Dentro do Meu Dia → expandir |
| **S-11 Histórico** | Raramente — apenas para verificar registro de decisão | Nav profunda |

---

## 6. Superfícies que precisam estar sempre acessíveis (Camada 1 — Nav Permanente)

```
[ Meu Dia ] [ Solicitações ] [ Entregas ] [ Mensagens ]
```

Quatro destinos. Não mais. O Membro não precisa de mais destinos de acesso rápido.

**Justificativa:**
- **Meu Dia:** razão de existir do app para o Membro
- **Solicitações:** canal formal de pedidos (folga, troca, exceção) — criação e acompanhamento
- **Entregas:** ciclo de tarefas recebidas e enviadas
- **Mensagens:** comunicação conversacional quando necessário

**Avisos** não está na nav permanente porque o Membro raramente vai buscar um aviso — o aviso chega. O acesso direto a Avisos existe via notificação ou via destaque no Meu Dia.

---

## 7. Superfícies em navegação secundária

```
[ Meu Dia ] [ Solicitações ] [ Entregas ] [ Mensagens ] [ Mais ▾ ]
              └── Agenda
              └── Livro do Dia
              └── Avisos (arquivo)
              └── Histórico
              └── Biblioteca
              └── IA (chat)
```

O item "Mais" (ou equivalente) agrupa o acesso a superfícies de uso menos frequente sem poluir a nav principal.

---

## 8. Superfícies que nunca devem competir pela atenção

- **S-11 Histórico** — investigação profunda, não uso cotidiano. Nunca na nav principal.
- **S-14 Biblioteca** — referência técnica. Acesso via IA é preferível ao acesso direto.
- **S-12 Agenda** — o Membro não gerencia calendário operacional. Vê sua programação via Meu Dia. Agenda é acesso eventual.
- **S-05 Livro do Dia** — o Membro acessa por aprofundamento a partir do Meu Dia, não como destino independente.

---

## 9. Fluxos que exigem troca entre superfícies

**Fluxo: Solicitação de Folga**
```
Meu Dia (gatilho: quero pedir folga)
→ Solicitações (criar: tipo = folga, data, motivo)
→ Meu Dia (retorno após criação, com badge de "solicitação pendente")
→ Solicitações (acompanhar estado)
→ Meu Dia (notificação de resposta → visualizar resultado)
```

**Fluxo: Descoberta de Mudança**
```
Notificação push (alteração na programação)
→ Meu Dia (aterrisagem: mudança destacada em primeiro plano)
→ Confirmação (ação na própria superfície, sem troca)
→ Meu Dia (estado atualizado: mudança confirmada)
```
*Observação: este é o fluxo mais crítico do produto do Membro. Ele não deve exigir nenhuma troca de superfície — tudo acontece no Meu Dia.*

**Fluxo: Entrega**
```
Notificação (nova entrega atribuída)
→ Entregas (ver detalhes: objetivo, critério, prazo)
→ [execução acontece fora do app]
→ Entregas (envio da entrega)
→ Entregas (acompanhar feedback)
```

**Fluxo: Dúvida sobre o Show**
```
Meu Dia (elemento IA: "O que mudou no show de hoje?")
→ IA responde em linha, sem troca de superfície
→ Meu Dia (continua o fluxo normal)
→ [opcional] Livro do Dia (se quiser ver o detalhamento completo)
```

---

## 10. Superfícies que funcionam como destino final de uma jornada

| Jornada | Destino final |
|---|---|
| Descoberta de mudança | **S-01 Meu Dia** (confirmação na própria superfície) |
| Criação de solicitação | **S-06 Solicitações** (enviada, retorna ao Meu Dia) |
| Envio de entrega | **S-07 Entregas** (enviada, fica aguardando revisão) |
| Consulta ao show do dia | **S-05 Livro do Dia** (leitura, sem ação) |
| Dúvida via IA | **S-01 Meu Dia** (resposta embarcada) |

---

## 11. Superfícies que funcionam apenas como apoio

- **S-05 Livro do Dia:** apoio contextual do Meu Dia. Nunca destino primário de navegação.
- **S-14 Biblioteca:** repositório de referência. Acessado via IA ou diretamente quando necessário, mas não como parte do ciclo diário.
- **S-11 Histórico:** prova e referência. Nunca usado no ciclo operacional diário.

---

## 12. Caminho mais curto para as tarefas mais frequentes do Membro

| Tarefa | Caminho | Número de toques |
|---|---|---|
| Ver programação do dia | Abrir app → Meu Dia | 1 toque |
| Confirmar alteração recebida | Notificação → Meu Dia → Confirmar | 2 toques |
| Criar solicitação de folga | Nav → Solicitações → Criar | 2 toques |
| Ver estado de uma solicitação | Nav → Solicitações → Estado visível na lista | 2 toques |
| Ver detalhes de uma entrega | Nav → Entregas → Abrir item | 3 toques |
| Enviar entrega | Nav → Entregas → Abrir item → Enviar | 4 toques |
| Perguntar à IA sobre o dia | Meu Dia → Campo IA → Digitar | 2 toques |
| Ver Livro do Dia completo | Meu Dia → Link do show → Livro do Dia | 3 toques |

---

## Relação com IA — Produto do Membro

A IA do Membro atua como **intérprete pessoal**. Não como chatbot, não como assistente genérico.

**Presença na navegação:**
- **Embarcada no Meu Dia:** elemento sempre visível, com uma linha de contexto ativa ("Hoje você tem 2 atividades. Seu papel no show das 14h mudou desde ontem."). O Membro pode expandir para fazer perguntas sem sair do Meu Dia.
- **Chat dedicado:** acessível via "Mais" para conversas mais profundas. Usado quando a resposta embarcada não é suficiente.
- **Embarcada nas Entregas:** interpreta o objetivo da entrega em linguagem pessoal quando o Membro abre um item.
- **Embarcada nas Solicitações:** explica o motivo operacional de uma negativa.

**A IA do Membro nunca:**
- Mostra dados de outros Membros
- Faz perguntas sobre a operação geral
- Acessa informações além do escopo do próprio Membro

---

---

# PARTE 2 — Arquitetura de Navegação do Supervisor

---

## Missão do Produto do Supervisor

> *"A operação de hoje está protegida?"*

O Supervisor não trabalha de forma linear. Trabalha com exceções — situações que surgem, interrompem o plano e exigem decisão com consequências em cascata. A navegação do Supervisor deve ser rápida, contextual, e sempre orientada para a ação.

**Característica dominante:** navegação reativa e não-linear. O Supervisor salta entre superfícies seguindo o fio de uma exceção — do diagnóstico (Painel) para a ação (Escala) para a comunicação (Avisos/Mensagens) e de volta para o monitoramento (Painel).

---

## 1. Ponto de entrada principal

**S-02 — Painel Operacional**

O app abre sempre no Painel Operacional. O Supervisor precisa saber em 10 segundos se a operação está protegida. Se não está, precisa saber qual é a exceção mais urgente e qual ação tomar.

**Exceção:** quando o Supervisor abre o app por causa de uma notificação crítica, o app aterrissa diretamente na superfície relevante (ex.: Escala com a exceção em destaque) — não no Painel Operacional. Ao resolver, o botão de retorno leva de volta ao Painel.

---

## 2. Primeira informação que o Supervisor precisa ver

1. **Status geral da operação:** Pronta / Atenção / Crítico — em uma única leitura visual
2. **Se Atenção ou Crítico:** lista de exceções priorizadas por impacto e urgência de horário — não por ordem de criação
3. **Confirmações pendentes:** membros que ainda não confirmaram alterações publicadas
4. **Multi-horizonte sob demanda:** riscos dos próximos 3 dias sem precisar sair da superfície

---

## 3. Superfícies acessadas diariamente

| Superfície | Frequência | Via |
|---|---|---|
| **S-02 Painel Operacional** | Múltiplas vezes ao dia | Abertura do app + notificação |
| **S-04 Escala** | Diariamente (construção e publicação) | Do Painel → agir na exceção |
| **S-05 Livro do Dia** | A cada show (geração/aprovação) | Do Painel ou da Escala |
| **S-08 Avisos** | Após publicação ou alteração | Do fluxo de publicação |

---

## 4. Superfícies acessadas semanalmente

| Superfície | Frequência | Via |
|---|---|---|
| **S-06 Solicitações** | Múltiplas vezes por semana | Nav permanente (badge) |
| **S-09 Mensagens** | Quando necessário | Nav permanente |
| **S-07 Entregas** | 1–2x por semana | Nav permanente |
| **S-12 Agenda** | Para planejamento da semana | Do Painel → multi-horizonte |

---

## 5. Superfícies acessadas eventualmente

| Superfície | Frequência | Via |
|---|---|---|
| **S-11 Histórico** | Quando investiga algo específico | Nav secundária |
| **S-13 Livro do Show** | Setup e manutenção (raro) | Nav profunda (Administração) |
| **S-15 Equipes / Grupos** | Para consultar perfil de membro ou funções | Nav secundária |
| **S-10 IA (chat)** | Para análise complexa de planejamento | Dentro do Painel ou Escala |

---

## 6. Superfícies que precisam estar sempre acessíveis (Camada 1 — Nav Permanente)

```
[ Painel ] [ Escala ] [ Solicitações ] [ Mensagens ]
```

Quatro destinos. O Supervisor tem uma nav diferente do Membro — centrada em ação operacional.

**Justificativa:**
- **Painel Operacional:** diagnóstico permanente da operação. Volta a este ponto após cada ação.
- **Escala:** ferramenta de ação. O Supervisor a usa diariamente para construir, ajustar e publicar.
- **Solicitações:** canal de pedidos do time. Badge mostra pendências. Análise de folgas exige acesso rápido.
- **Mensagens:** comunicação direta quando um aviso não é suficiente.

**Por que Livro do Dia não está na nav permanente?**
O Supervisor chega ao Livro do Dia a partir da Escala — é um passo natural do fluxo, não um destino que o Supervisor busca independentemente. Colocá-lo na nav permanente criaria um atalho que pularia o contexto necessário.

**Por que Avisos não está na nav permanente?**
Avisos são criados como parte de um fluxo (após publicar, após alterar, após cancelar) — não como destino autônomo. O Supervisor raramente abre Avisos sem estar no meio de um fluxo de comunicação.

---

## 7. Superfícies em navegação secundária

```
[ Painel ] [ Escala ] [ Solicitações ] [ Mensagens ] [ Mais ▾ ]
              └── Avisos (criar e histórico)
              └── Entregas
              └── Agenda
              └── Histórico
              └── Equipes / Grupos
              └── IA (chat)
```

---

## 8. Superfícies que nunca devem competir pela atenção

- **S-13 Livro do Show** — configuração de template. Nunca no fluxo operacional diário.
- **S-15 Equipes / Grupos** — consultado, não operado. Acesso via "Mais" ou a partir de um perfil de membro específico.
- **S-11 Histórico** — investigação profunda. Nunca na nav principal.
- **S-17 Configurações** — não existe no universo operacional do Supervisor. Vai para Administração do Admin.
- **S-03 Painel de Saúde** — território do Admin. O Supervisor não vê este painel.
- **S-14 Biblioteca** — referência ocasional. Mediada pela IA quando possível.

---

## 9. Fluxos que exigem troca entre superfícies

**Fluxo: Início do Dia Operacional (JS-01)**
```
Abrir app → Painel (status geral)
→ [se OK] Multi-horizonte inline → Planejamento diário concluído
→ [se Atenção] Lista de exceções → selecionar a mais urgente
→ Escala (agir na exceção)
→ [publicar] → Avisos disparados automaticamente
→ Painel (monitorar confirmações)
```

**Fluxo: Substituição por Ausência (JS-03) — fluxo mais crítico**
```
Notificação crítica → Escala (aterrissagem direta na exceção)
→ Análise de impacto inline (sistema calcula, não navega)
→ Lista de candidatos com classificação de risco inline
→ Simulação de cascata inline (não navega para outra tela)
→ Confirmar substituição → Escala atualizada
→ Aviso automático gerado → [opcional] Mensagem personalizada
→ Painel (monitorar confirmações de Carlos e Beatriz)
```
*Observação: este fluxo deve exigir o mínimo de trocas de superfície possível. A análise de impacto, candidatos e cascata são apresentados dentro da Escala — não em superfícies separadas.*

**Fluxo: Geração e Publicação do Livro do Dia (JS-04)**
```
Painel → [nova data] → Livro do Dia (gerar proposta)
→ Livro do Dia (revisar posições por status)
→ [posição em aberto] → Fluxo de substituição inline
→ Livro do Dia (aprovar)
→ Escala (publicar)
→ Avisos automáticos disparados
→ Painel (monitorar)
```

**Fluxo: Análise de Solicitação de Folga (JS-02)**
```
Painel (badge de solicitações pendentes) → Solicitações
→ Abrir solicitação → análise de impacto automática inline
→ Decisão: Aprovar / Negar / Negociar
→ [se negar] Motivo obrigatório → Enviado
→ [se aprovar] Escala atualizada automaticamente
→ Solicitações (próxima pendente) ou → Painel
```

**Fluxo: Planejamento Semanal (JS-06)**
```
Painel (multi-horizonte) → [dia de risco identificado]
→ Escala (visão da semana, filtrar por data crítica)
→ [ação preventiva] Substituição preventiva inline
→ [ou] Comunicação preventiva via Avisos ou Mensagens
→ Painel
```

---

## 10. Superfícies que funcionam como destino final de uma jornada

| Jornada | Destino final |
|---|---|
| Início do dia (status OK) | **S-02 Painel** (sem ação necessária) |
| Substituição por ausência | **S-02 Painel** (monitoramento de confirmação) |
| Publicação da Escala | **S-02 Painel** (monitoramento pós-publicação) |
| Decisão de folga | **S-06 Solicitações** (próxima pendente) ou **S-02 Painel** |
| Comunicação pós-alteração | **S-02 Painel** (rastreamento de confirmação) |

**Padrão identificado:** o Supervisor sempre retorna ao Painel. O Painel é o hub central — não o ponto de entrada de todos os fluxos, mas o ponto de retorno após cada ação resolvida.

---

## 11. Superfícies que funcionam apenas como apoio

- **S-05 Livro do Dia:** apoio da Escala. Acessado dentro do fluxo de geração/publicação, não autonomamente.
- **S-08 Avisos:** apoio da Publicação. Criado dentro do fluxo de publicação ou alteração.
- **S-12 Agenda:** apoio do Planejamento. Consultada para verificar datas de shows, não como destino primário.
- **S-11 Histórico:** apoio da investigação. Acessado quando o Supervisor precisa entender o que aconteceu antes de uma exceção atual.

---

## 12. Caminho mais curto para as tarefas mais frequentes do Supervisor

| Tarefa | Caminho | Número de toques |
|---|---|---|
| Verificar estado da operação | Abrir app → Painel | 1 toque |
| Agir em exceção crítica | Notificação → Escala (direta) | 1 toque |
| Ver lista de exceções priorizadas | Painel → Lista inline | 1 toque |
| Resolver substituição | Notificação → Escala → Candidatos → Confirmar | 3–4 toques |
| Analisar solicitação de folga | Painel (badge) → Solicitações → Abrir → Decidir | 3 toques |
| Gerar Livro do Dia | Painel → Livro do Dia → Gerar | 2 toques |
| Publicar Escala | Escala → Publicar → Confirmar | 2 toques |
| Verificar confirmações pendentes | Painel → Seção inline de confirmações | 1 toque |
| Enviar aviso urgente | Escala (pós-publicação) ou Avisos → Criar | 2 toques |

---

## Relação com IA — Produto do Supervisor

A IA do Supervisor atua como **copiloto operacional**. Não responde perguntas genéricas — analisa a operação e propõe ações.

**Presença na navegação:**

- **Embarcada no Painel Operacional:** ao abrir, a IA gera uma narrativa de contexto ("Bom dia. Detectei 2 exceções. A mais urgente afeta o show das 12h30."). O Supervisor pode perguntar diretamente a partir do Painel.
- **Embarcada na Escala:** ao analisar uma exceção, a IA classifica candidatos, simula cascata e apresenta recomendação. Tudo inline — sem abrir chat.
- **Embarcada nas Solicitações:** ao abrir uma solicitação, a IA já calculou o impacto e apresentou a análise antes de qualquer ação.
- **Chat dedicado:** acessível via "Mais" para cenários complexos de planejamento ("Qual é o risco de cobertura da semana que vem?").

**A IA do Supervisor nunca:**
- Executa sem confirmação explícita
- Mostra dados fora do escopo do Grupo do Supervisor
- Apresenta candidatos como lista plana sem classificação de risco
- Omite o raciocínio da recomendação

**Princípio crítico:** a IA do Supervisor precisa funcionar em situação de crise — quando o Supervisor está com um dedo, em pé, no backstage, com 15 minutos para resolver. A IA precisa ser mais rápida que não tê-la. Se for mais lenta, ela não será usada.

---

---

# PARTE 3 — Arquitetura de Navegação do Admin

---

## Missão do Produto do Admin

> *"O ecossistema está saudável? O que está surgindo como padrão?"*

O Admin não opera — governa. A navegação do Admin é exploratória e investigativa. O Admin abre o app com menos urgência que o Supervisor, mas com maior amplitude: precisa ver além de uma operação, além de um dia, além de um evento específico.

**Característica dominante:** navegação estratégica e investigativa. O Admin salta entre Painel (diagnóstico macro) e Histórico (investigação profunda) e Equipes/Operações (ajuste estrutural).

---

## 1. Ponto de entrada principal

**S-03 — Painel de Saúde**

O app abre no Painel de Saúde. Diferente do Supervisor (que precisa agir em minutos), o Admin precisa de uma visão macro antes de qualquer ação.

**Exceção:** quando o Admin recebe uma notificação de escalada (Supervisor escalou um problema que não consegue resolver), o app aterrissa na superfície relevante com o contexto da escalada.

---

## 2. Primeira informação que o Admin precisa ver

1. **Estado de saúde por Operação:** Saudável / Atenção / Crítico — todas as operações em uma leitura
2. **Para operações em Atenção ou Crítico:** sinal específico, tendência (crescendo ou estável?) e há quanto tempo está assim
3. **Itens sem responsável definido** em qualquer operação
4. **Padrões detectados automaticamente:** o que está surgindo como recorrência?

---

## 3. Superfícies acessadas diariamente ou quase diariamente

| Superfície | Frequência | Via |
|---|---|---|
| **S-03 Painel de Saúde** | Diária ou a cada 2 dias | Abertura do app |
| **S-11 Histórico** | Quando investiga sinal do Painel | Do Painel → investigar |

---

## 4. Superfícies acessadas semanalmente

| Superfície | Frequência | Via |
|---|---|---|
| **S-06 Solicitações** | Para monitorar tendências | Nav permanente (como indicador) |
| **S-08 Avisos** | Para comunicação multi-operação | Nav permanente |
| **S-15 Equipes / Grupos** | Ajuste estrutural | Nav secundária |
| **S-04 Escala** | Visão de cobertura geral | Nav secundária (visão Admin) |

---

## 5. Superfícies acessadas eventualmente

| Superfície | Frequência | Via |
|---|---|---|
| **S-16 Operações** | Setup e ajuste de operação | Nav profunda (Administração) |
| **S-17 Configurações** | Manutenção técnica | Nav profunda (Administração) |
| **S-13 Livro do Show** | Setup de espetáculo | Nav profunda (Administração) |
| **S-12 Agenda** | Visão calendário multi-operação | Nav secundária |
| **S-14 Biblioteca** | Criação/atualização de conteúdo | Nav secundária |
| **S-07 Entregas** | Monitoramento macro | Nav secundária |

---

## 6. Superfícies que precisam estar sempre acessíveis (Camada 1 — Nav Permanente)

```
[ Painel de Saúde ] [ Histórico ] [ Avisos ] [ Administração ]
```

Quatro destinos, completamente diferentes da nav do Supervisor e do Membro.

**Justificativa:**
- **Painel de Saúde:** diagnóstico macro. Ponto de retorno após qualquer investigação.
- **Histórico:** ferramenta de investigação principal do Admin. Acesso rápido é crítico.
- **Avisos:** o Admin cria avisos para múltiplas operações. Comunicação oficial é parte do seu trabalho.
- **Administração:** agrupa Operações + Configurações + Livro do Show. Acesso frequente o suficiente para estar na nav principal, raro o suficiente para estar agrupado.

---

## 7. Superfícies em navegação secundária

```
[ Painel ] [ Histórico ] [ Avisos ] [ Administração ] [ Mais ▾ ]
              └── Equipes / Grupos
              └── Escala (visão global)
              └── Solicitações (indicador)
              └── Entregas (monitoramento)
              └── Agenda (calendário multi-operação)
              └── Biblioteca
              └── IA (chat)
```

---

## 8. Superfícies que nunca devem competir pela atenção

- **S-01 Meu Dia** — território do Membro. Não existe para o Admin.
- **S-02 Painel Operacional** — território do Supervisor. O Admin não usa esta superfície.
- **S-05 Livro do Dia** — operacional, não estratégico. Admin consulta quando investiga, não rotineiramente.
- **S-09 Mensagens** — o Admin raramente usa mensagem direta. Quando precisa comunicar, usa Avisos (escala) ou Histórico/IA para investigar.

---

## 9. Fluxos que exigem troca entre superfícies

**Fluxo: Verificação de Saúde do Ecossistema (JA-01)**
```
Painel de Saúde (diagnóstico macro)
→ [operação em Atenção] Sinal específico destacado
→ Histórico (investigar: o que está acontecendo nessa operação?)
→ [padrão identificado] → Equipes/Grupos (ajuste estrutural)
→ [ou] Avisos (comunicação de alerta)
→ Painel de Saúde (monitorar)
```

**Fluxo: Investigação de Problema (JA-02)**
```
Painel (sinal de Atenção) → Histórico
→ Investigar por entidade (membro, show, grupo)
→ IA: "Resuma o que aconteceu com a Escala do dia 14" → narrativa
→ [root cause identificado] → Equipes/Grupos (corrigir estrutura)
→ [ou] Avisos (comunicar)
→ Painel (monitorar tendência)
```

**Fluxo: Mudança Estrutural (JA-03)**
```
Painel (sinal: Grupo sem Supervisor) → Equipes/Grupos
→ Editar estrutura → Confirmar impacto antes de salvar
→ Avisos (comunicar mudança para grupos afetados)
→ Painel (verificar se sinal foi resolvido)
```

**Fluxo: Setup de Nova Operação (JA-05) — fluxo eventual**
```
Administração → Operações → Criar nova
→ Administração → Configurações (parâmetros)
→ Equipes/Grupos (criar estrutura)
→ Administração → Livro do Show (template do espetáculo)
→ Agenda (eventos iniciais)
→ Painel de Saúde (operação aparece como nova)
```

---

## 10. Superfícies que funcionam como destino final de uma jornada

| Jornada | Destino final |
|---|---|
| Verificação de saúde (nada crítico) | **S-03 Painel de Saúde** (leitura, sem ação) |
| Investigação de problema | **S-11 Histórico** (entendimento completo) |
| Mudança estrutural | **S-03 Painel de Saúde** (monitorar se sinal desaparece) |
| Setup de nova operação | **S-03 Painel de Saúde** (operação ativa) |
| Comunicação multi-operação | **S-08 Avisos** (enviado) |

**Padrão identificado:** assim como o Supervisor retorna ao Painel Operacional, o Admin retorna ao Painel de Saúde. A diferença é a frequência: o Supervisor retorna múltiplas vezes ao dia; o Admin retorna após cada ciclo de investigação.

---

## 11. Superfícies que funcionam apenas como apoio

- **S-04 Escala (visão Admin):** contexto de investigação. O Admin vê a Escala para entender o que aconteceu, não para operar.
- **S-06 Solicitações:** indicador de saúde. O Admin monitora tendências de volume e tempo de resposta, não analisa solicitações individuais.
- **S-07 Entregas:** monitoramento macro. Não criação ou avaliação rotineira.
- **S-12 Agenda:** calendário de referência. Contexto para análise de tendências.

---

## 12. Caminho mais curto para as tarefas mais frequentes do Admin

| Tarefa | Caminho | Número de toques |
|---|---|---|
| Verificar saúde geral | Abrir app → Painel | 1 toque |
| Investigar operação específica | Painel → sinal → Histórico | 2–3 toques |
| Criar aviso multi-operação | Nav → Avisos → Criar | 2 toques |
| Ajustar estrutura de equipe | Nav → Mais → Equipes → Editar | 3 toques |
| Consultar configurações | Nav → Administração → Configurações | 2 toques |
| Perguntar à IA sobre tendência | Painel → IA inline → Perguntar | 2 toques |

---

## Relação com IA — Produto do Admin

A IA do Admin atua como **analista organizacional**. Não opera, não decide — transforma dados em narrativa e padrões em hipóteses.

**Presença na navegação:**

- **Embarcada no Painel de Saúde:** ao abrir, gera um resumo narrativo do estado de cada operação. O Admin pode perguntar "Existe algo que preciso saber hoje?" e receber um diagnóstico proativo.
- **Embarcada no Histórico:** transforma registros técnicos em narrativa investigativa. "Resuma o que aconteceu com o Grupo A no último mês" → resposta em linguagem natural.
- **Chat dedicado:** acesso mais frequente do que para o Supervisor. O Admin usa o chat para análises longas ("Qual é a tendência de solicitações de folga nas últimas 6 semanas?").

**A IA do Admin nunca:**
- Toma decisões estruturais
- Acessa dados individualmente identificáveis além do que é relevante para o padrão
- Apresenta estatísticas sem contexto narrativo

---

---

# PARTE 4 — Mapa Global de Navegação

---

## Fluxos mais frequentes do sistema (uso diário, múltiplas vezes)

| # | Fluxo | Perfis envolvidos | Superfícies envolvidas |
|---|---|---|---|
| F01 | Membro abre app e verifica programação do dia | Membro | S-01 |
| F02 | Membro confirma alteração na programação | Membro | S-01 (apenas) |
| F03 | Supervisor verifica estado da operação ao abrir | Supervisor | S-02 |
| F04 | Supervisor age em exceção prioritária | Supervisor | S-02 → S-04 |
| F05 | Supervisor monitora confirmações pós-publicação | Supervisor | S-02 (inline) |

---

## Fluxos mais críticos do sistema (quando falham, a operação é afetada)

| # | Fluxo | Impacto se falhar | Superfícies envolvidas |
|---|---|---|---|
| FC01 | Membro não confirma alteração operacional persistente | Membro entra no show com programação errada | S-01 |
| FC02 | Supervisor não detecta exceção a tempo | Atividade começa sem cobertura | S-02 → S-04 |
| FC03 | Substituição emergencial por no-show | Atividade crítica sem cobertura | S-04 (intensivo) |
| FC04 | Publicação com posição crítica em aberto | Escala publicada com erro de cobertura | S-04 → S-05 |
| FC05 | Folgas aprovadas individualmente que juntas descobrem função crítica | Cobertura insuficiente não detectada | S-06 → S-04 |

---

## Fluxos mais raros do sistema (eventuais, mas consequentes)

| # | Fluxo | Frequência | Superfícies envolvidas |
|---|---|---|---|
| FR01 | Setup de nova operação | Uma vez | S-16 → S-15 → S-13 → S-12 |
| FR02 | Edição do Livro do Show | Mensal ou menos | S-13 |
| FR03 | Mudança estrutural de Grupos | Mensal ou menos | S-15 |
| FR04 | Ajuste de configurações | Trimestral ou menos | S-17 |
| FR05 | Cancelamento de show | Irregular, eventual | S-04 → S-08 |

---

## Superfícies Centrais
> Definem a experiência. O produto falha se estas falharem.

| Superfície | Perfil | Critério |
|---|---|---|
| **S-01 Meu Dia** | Membro | Maior frequência. Primeiro ponto de contato. |
| **S-02 Painel Operacional** | Supervisor | Define se o WhatsApp é substituído. |
| **S-04 Escala** | Supervisor | Fonte de verdade. Alimenta tudo. |
| **S-10 IA (embarcada)** | Todos | Diferencial competitivo. Se falhar, o produto perde o que o distingue. |

---

## Superfícies de Apoio
> Completam os ciclos de trabalho. Necessárias, mas não definem sozinhas o produto.

| Superfície | Perfil Principal | Função |
|---|---|---|
| S-05 Livro do Dia | Supervisor / Membro | Detalhamento operacional do show |
| S-06 Solicitações | Membro / Supervisor | Ciclo formal de pedidos |
| S-07 Entregas | Membro / Supervisor | Ciclo de expectativa → execução → feedback |
| S-08 Avisos | Supervisor / Admin | Comunicação oficial de broadcast |
| S-09 Mensagens | Todos | Comunicação conversacional direta |
| S-11 Histórico | Admin / Supervisor | Auditoria e investigação |
| S-12 Agenda | Supervisor / Admin | Calendário operacional oficial |
| S-03 Painel de Saúde | Admin | Home do Admin. Central para governança. |

---

## Superfícies Administrativas
> Constroem a estrutura. Usadas raramente, mas com alta consequência.

| Superfície | Perfil | Frequência |
|---|---|---|
| S-13 Livro do Show | Admin / Supervisor | Eventual |
| S-14 Biblioteca | Admin | Eventual |
| S-15 Equipes / Grupos | Admin | Baixa |
| S-16 Operações | Admin | Muito baixa |
| S-17 Configurações | Admin | Muito baixa |

---

## Mapa de Relacionamentos entre Superfícies

```
Fontes de dados que alimentam outras superfícies:

S-04 Escala ────────────→ S-01 Meu Dia (fatia individual)
                        → S-05 Livro do Dia (posições do show)
                        → S-02 Painel Operacional (estado atual)
                        → S-03 Painel de Saúde (dados agregados)

S-13 Livro do Show ─────→ S-05 Livro do Dia (estrutura base)
                        → S-04 Escala (referência de papéis)

S-06 Solicitações ──────→ S-04 Escala (quando aprovada)
                        → S-03 Painel de Saúde (indicador de tendência)

S-11 Histórico ─────────→ S-03 Painel de Saúde (padrões e tendências)

S-12 Agenda ────────────→ S-04 Escala (eventos com impacto operacional)
                        → S-05 Livro do Dia (shows confirmados)

Destinos de resultado das ações:

Qualquer ação confirmada → S-11 Histórico (registro obrigatório)
Qualquer ação da IA     → S-11 Histórico (com autor identificado)
Publicação da Escala    → S-01 Meu Dia (atualizado automaticamente)
                        → Notificação para membros afetados
```

---

## Pesos de Navegação por Perfil

Representa quão central cada superfície é para o perfil (1–5, sendo 5 a mais central).

| Superfície | Membro | Supervisor | Admin |
|---|---|---|---|
| S-01 Meu Dia | **5** | 1 (não usa) | 1 (não usa) |
| S-02 Painel Operacional | 1 (não usa) | **5** | 1 (não usa) |
| S-03 Painel de Saúde | 1 (não usa) | 2 (eventual) | **5** |
| S-04 Escala | 1 (não acessa) | **5** | 3 |
| S-05 Livro do Dia | 3 | **4** | 2 |
| S-06 Solicitações | **4** | **4** | 2 |
| S-07 Entregas | **4** | 3 | 2 |
| S-08 Avisos | 2 | **4** | **4** |
| S-09 Mensagens | 3 | 3 | 1 |
| S-10 IA (embarcada) | **5** | **5** | **4** |
| S-10 IA (chat) | 2 | 2 | 3 |
| S-11 Histórico | 1 | 2 | **5** |
| S-12 Agenda | 2 | 3 | 3 |
| S-13 Livro do Show | 1 | 2 | 3 |
| S-14 Biblioteca | 2 | 1 | 2 |
| S-15 Equipes / Grupos | 1 | 2 | **4** |
| S-16 Operações | 1 | 1 | 3 |
| S-17 Configurações | 1 | 1 | 3 |

---

## Estrutura de Navegação Comparativa — os três produtos

```
PRODUTO DO MEMBRO
Nav Permanente:  [ Meu Dia ] [ Solicitações ] [ Entregas ] [ Mensagens ]
Nav Secundária:  Agenda · Livro do Dia · Avisos (arquivo) · Histórico · Biblioteca · IA (chat)

PRODUTO DO SUPERVISOR
Nav Permanente:  [ Painel ] [ Escala ] [ Solicitações ] [ Mensagens ]
Nav Secundária:  Avisos · Entregas · Agenda · Histórico · Equipes/Grupos · IA (chat)

PRODUTO DO ADMIN
Nav Permanente:  [ Painel de Saúde ] [ Histórico ] [ Avisos ] [ Administração ]
Nav Secundária:  Equipes/Grupos · Escala (visão global) · Solicitações · Entregas · Agenda · Biblioteca · IA (chat)
```

Nenhum dos três produtos tem a mesma estrutura de nav. Isso é intencional.

---

---

# PARTE 5 — Validação da Arquitetura de Navegação

---

## Coerência com a Arquitetura do Produto

| Princípio arquitetural | Respeitado? | Evidência na navegação |
|---|---|---|
| Mobile e Web possuem a mesma importância | ✅ | Todos os fluxos críticos são executáveis em 3–4 toques. Nenhuma tarefa essencial exige desktop. |
| Nenhuma funcionalidade é considerada pronta sem experiência mobile | ✅ | A nav permanente de cada perfil é otimizada para polegar — 4 itens máximo. |
| Características não viram módulos | ✅ | Folgas e Restrições não têm entrada na nav. Vivem dentro de Solicitações e Perfil do Membro. |
| O sistema deve parecer um produto premium | ✅ | Nav minimalista. Sem excesso de itens. Profundidade acessível mas não imposta. |
| O sistema deve ser simples mesmo em dias caóticos | ✅ | O Supervisor chega à ação crítica em 1 toque via notificação. O Membro confirma sem sair do Meu Dia. |
| A IA ajuda a operar — não substitui pessoas | ✅ | IA sempre apresenta proposta + confirmação obrigatória. Nunca executa diretamente. |
| Meu Dia é a tela principal do Membro | ✅ | É a home imutável do produto do Membro. |

---

## Coerência com as Pesquisas

**Supervisor:**

| Descoberta | Resposta na navegação |
|---|---|
| D1: precisa de status → impacto → recomendação → cascata | Painel abre com status. Escala entrega impacto + candidatos + cascata inline. Sem navegação adicional. |
| D2: exceções surgem a qualquer hora | Notificação aterrissa diretamente na superfície de ação — não no Painel. |
| D9: multi-horizonte — hoje, amanhã, semana | Multi-horizonte é elemento inline do Painel. Não exige troca de superfície. |
| D6: confirmação como garantia, não apenas envio | Painel tem seção permanente de confirmações pendentes. Visível sem navegar. |

**Membro:**

| Descoberta | Resposta na navegação |
|---|---|
| D1: segurança antes de informação | Meu Dia abre com o estado mais urgente primeiro — sempre. |
| D2: mudanças são mais importantes que programação estável | Alteração aparece em primeiro plano no Meu Dia. Confirmação sem troca de superfície. |
| D3: limbo = silêncio sem significado | Estado de solicitação sempre visível na lista — sem precisar abrir item. |
| D9: confiança vem de consistência | Meu Dia tem a mesma estrutura sempre. O Membro nunca precisa procurar onde as coisas estão. |

**Admin:**

| Descoberta | Resposta na navegação |
|---|---|
| D1: visão do ecossistema inteiro | Painel de Saúde abre com todas as operações em uma leitura. |
| D5: histórico como narrativa investigativa | Histórico está na nav permanente — nível de importância equivalente ao Painel. |
| D7: saúde medida por: tempo de resposta, correções pós-publicação, escaladas | Painel de Saúde exibe esses indicadores sem navegação adicional. |
| D8: itens sem responsável como sinal de risco | Painel de Saúde destaca itens sem dono como elemento de primeiro nível. |

---

## Coerência com as Jornadas

| Jornada | Fluxo de navegação | Validação |
|---|---|---|
| JS-01 (Início do Dia Operacional) | Painel → exceção inline → Escala → Painel | ✅ Status visível imediatamente. Multi-horizonte inline. |
| JS-02 (Análise de Folga) | Painel (badge) → Solicitações → análise inline → decidir | ✅ Análise de impacto acontece antes das opções de decisão. |
| JS-03 (Substituição Emergencial) | Notificação → Escala (direta) → candidatos inline → cascata inline → confirmar → Painel | ✅ Máximo 4 toques. Sem troca desnecessária de superfície. |
| JS-04 (Livro do Dia) | Painel → Livro do Dia → posições inline → Escala (publicar) → Painel | ✅ Fluxo sequencial natural. |
| JS-05 (Comunicação Pós-Alteração) | Automático (Aviso disparado) + Painel (confirmações) | ✅ Monitoramento inline no Painel. |
| JS-09 (Cancelamento de Show) | Escala (exceção) → confirmação de impacto → Escala atualizada → Aviso automático | ✅ Coberto pelo fluxo da Escala. |
| JM-01 (Abertura do Dia) | Abrir app → Meu Dia | ✅ 1 toque. |
| JM-02 (Descoberta de Mudança) | Notificação → Meu Dia → confirmar inline | ✅ Sem troca de superfície. |
| JM-03 (Solicitação) | Nav → Solicitações → criar → retorno ao Meu Dia | ✅ 2 toques. |
| JM-06 (Solicitação Negada) | Notificação → Meu Dia (badge) → Solicitações → ver motivo + IA explica | ✅ Contexto da negativa sempre disponível. |
| JA-01 (Saúde do Ecossistema) | Abrir app → Painel de Saúde | ✅ 1 toque. |
| JA-02 (Investigação) | Painel → sinal → Histórico → IA narrativa | ✅ Histórico na nav permanente. |
| JA-06 (Conflito entre Supervisores) | Painel (escalada) → Histórico (evidência) → Equipes/Grupos (resolver) | ✅ Fluxo natural entre as 3 superfícies. |

---

## Coerência com o Mapa de Superfícies

| Decisão do Mapa de Superfícies | Respeitada na arquitetura de navegação? |
|---|---|
| Folgas não são superfície — embutidas em Solicitações | ✅ Não há entrada "Folgas" em nenhuma nav |
| Restrições não são superfície — atributo do Membro | ✅ Acessíveis via Perfil do Membro em Equipes/Grupos |
| Central de Notificações é infraestrutura, não destino | ✅ Notificação leva à superfície de ação, não a um feed |
| Inbox Unificado eliminado do MVP | ✅ Não existe como item de navegação |
| S-16 + S-17 com potencial de fusão | ✅ Agrupados como "Administração" na nav do Admin |
| S-13 como sub-seção de Operações no MVP | ✅ Livro do Show vive dentro de Administração |
| IA embarcada antes de ser destino | ✅ IA aparece como elemento nas superfícies principais antes do chat dedicado |

---

## Coerência com a Identidade do MyASA

| Princípio de identidade | Violação possível | Como foi evitado |
|---|---|---|
| Não parecer ERP | Nav com 12+ itens no primeiro nível | Nav com máximo 4 itens permanentes por perfil |
| Não parecer sistema de RH | Superfícies de gestão de pessoas em primeiro plano | Equipes/Grupos em navegação secundária — operação em primeiro plano |
| iOS-inspired, premium | Menus profundos e confusos | Profundidade máxima de 3 níveis. Fluxos contextuais, não hierárquicos. |
| Simples em dias caóticos | Exigir navegação complexa em situação de urgência | Notificação → ação em 1–2 toques. Análise inline, sem troca de superfície. |
| Três produtos distintos | Mesma nav para todos os perfis | Três estruturas de nav completamente diferentes |
| IA como diferencial premium | IA como aba genérica no final | IA embarcada nas superfícies centrais de cada perfil |

---

## Achados da Validação

### ✅ Consistente

1. **Os três produtos têm navegações distintas e calibradas pelo perfil.** O Membro, o Supervisor e o Admin nunca encontram a mesma home, a mesma nav, ou a mesma hierarquia de acesso.

2. **Nenhuma jornada exige mais de 4 toques para a ação central.** O fluxo mais crítico (substituição emergencial) — o mais longo — exige 4 toques a partir da notificação.

3. **A IA está onde importa, não onde é decorativa.** Embarcada nas 3 homes, contextualizada em Escala, Solicitações e Entregas — antes de qualquer chat dedicado.

4. **O Painel é sempre o ponto de retorno, não o ponto de partida universal.** O Supervisor e o Admin retornam ao seu respectivo Painel após cada ciclo de ação — a home como confirmação de estado resolvido, não apenas como menu.

5. **Fluxos críticos minimizam trocas de superfície.** A substituição emergencial, a confirmação de alteração pelo Membro e a análise de folga — os três fluxos de maior urgência — acontecem com o menor número possível de navegações.

### 🟡 Pontos de atenção para o Design de Interface

**A — Distinção visual entre os três produtos:**
A diferença entre os produtos precisa ser imediatamente percebida visualmente — não apenas estruturalmente. Um Supervisor que herda um perfil de Membro por engano (ex.: app compartilhado) precisa perceber imediatamente que está no produto errado. O design deve honrar essa separação.

**B — Retorno ao Painel após notificação:**
Quando uma notificação leva o usuário diretamente a uma superfície de ação (ex.: Escala), o retorno ao Painel deve ser explícito e imediato — não via botão "voltar" genérico. O usuário precisa saber que está "saindo de uma exceção" e "voltando ao estado geral".

**C — IA embarcada vs. IA chat — quando expandir:**
A fronteira entre a resposta inline da IA e a abertura do chat dedicado precisa ser clara. A IA embarcada responde perguntas sobre o contexto atual. O chat é para análises que vão além do contexto imediato. O design precisa tornar esse gatilho natural — sem o usuário precisar decidir qual usar.

**D — Avisos vs. Mensagens — distinção visual obrigatória:**
Os dois conceitos são distintos na arquitetura, mas se o design os apresentar com visual similar (dois itens numa lista com ícones parecidos), a distinção mental do usuário colapsa. A distinção precisa ser visual, não apenas estrutural.

**E — "Mais" como destino:**
As superfícies agrupadas em "Mais" (ou equivalente) não devem parecer uma lixeira de itens menos importantes. A organização interna do "Mais" precisa ter hierarquia clara: superfícies de apoio primeiro, superfícies de referência depois.

---

## Veredicto Final

**A Arquitetura de Navegação do MyASA 2.0 está validada e pronta para servir de base ao Design de Interface.**

Os três produtos têm estruturas de navegação distintas, calibradas pela frequência de uso, pela missão operacional e pela relação de cada perfil com o tempo. Nenhuma jornada crítica foi deixada sem um caminho de navegação claro. A IA está presente nas superfícies onde agrega maior valor — não como aba isolada.

Os 5 pontos de atenção identificados (A–E) são diretrizes de design, não bloqueantes. Devem guiar as decisões visuais das superfícies ao longo do processo de design de interface.

---

*Próxima fase: Design de Interface — Bloco 1 (S-01 Meu Dia, S-02 Painel Operacional, S-04 Escala)*
