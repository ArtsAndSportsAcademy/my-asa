# MyASA 2.0 — Pesquisa UX: Jornada do Admin

> Versão: 17/06/2026
> Origem: Entrevista estruturada — fase pré-design
> Status: Aprovado para uso em UX e Design System

---

## Síntese em Uma Frase

> O trabalho do Admin não é executar a operação nem proteger uma operação específica. É garantir que a estrutura que sustenta todas as operações continue saudável, resiliente e capaz de absorver problemas sem entrar em crise.

---

## Posicionamento dos Três Perfis

| Dimensão | Supervisor | Membro | Admin |
|---|---|---|---|
| Pergunta central | O que mudou na operação? | O que eu preciso fazer hoje? | A operação está saudável? |
| Perspectiva | Uma operação | A si mesmo | O ecossistema inteiro |
| Horizonte | O dia e a semana | O dia | Semanas, meses, tendências |
| Principal risco | Exceção não percebida | Mudança não recebida | Problema que virou padrão |
| Fonte de ansiedade | Operação sem cobertura | Incerteza sobre o que é esperado | Consequências invisíveis de mudanças estruturais |
| Mede sucesso por | Operação executada sem crises | Execução correta | Estrutura absorvendo problemas sem entrar em crise |
| Relação com a IA | Copiloto operacional | Intérprete pessoal | Analista organizacional |

---

## Descobertas Fundamentais

### D1 — O Admin olha para o ecossistema, não para operações individuais

**Resposta Operacional:**
Quando o Admin abre o produto, sua primeira pergunta não é sobre um show específico, um Membro ausente ou uma substituição. É: *"A operação está saudável?"* — uma pergunta que engloba todas as operações sob sua responsabilidade simultaneamente. O foco não está em atividade — está em estado do sistema.

**Impacto Operacional:**
O Admin precisa identificar rapidamente qual operação está saudável, qual está em atenção e qual está em risco elevado — sem precisar mergulhar nos detalhes de cada uma. Quanto mais cedo ele identifica tendências, menor a chance de problemas se espalharem entre operações.

**Impacto para UX:**
A experiência do Admin deve começar com uma visão ampla e navegar do macro para o micro: estado geral → operações → detalhes. Ele não deve cair diretamente dentro de uma operação específica ao abrir o produto — isso seria a experiência do Supervisor, não do Admin.

**Impacto para Interface:**
- Primeira camada: Saúde Geral (operações ativas, operações em atenção, pendências críticas, indicadores principais)
- Segunda camada: Operações (status por operação, alertas, cobertura, pendências)
- Terceira camada: Governança (aprovações, auditoria, configurações, administração)
- O Admin deve conseguir entender o estado geral do ecossistema em poucos segundos, sem abrir cada operação individualmente

**Riscos:**
Transformar o Admin em um Supervisor com mais permissões. Isso faria os três perfis se aproximarem demais, resultando em um produto confuso onde cada perfil responde perguntas que não são as suas.

**Oportunidade para IA:**
A IA do Admin atua como analista de gestão, não como assistente operacional: *"Existe alguma operação em risco?"*, *"Quais são os principais gargalos desta semana?"*, *"Existem grupos com excesso de carga?"* A IA procura padrões e tendências, não atividades individuais.

---

### D2 — O Admin pensa em estruturas de responsabilidade, não em pessoas individuais

**Resposta Operacional:**
Quando o Admin configura o produto, ele não começa criando usuários. Ele constrói camadas: Operação → Grupos Operacionais → Funções → Pessoas → Permissões. A estrutura precede as pessoas porque a estrutura persiste mesmo quando as pessoas mudam. Um Supervisor que sai não é um problema de cadastro — é um problema de continuidade de responsabilidade.

**Impacto Operacional:**
Mudanças estruturais são menos frequentes que mudanças operacionais, mas têm impacto duradouro. Em uma operação artística dinâmica — com novos shows, novos personagens, funções emergentes, projetos temporários — a estrutura precisa ser flexível o suficiente para evoluir sem exigir reconstrução. O Admin reorganiza o que existe, não reconstrói do zero.

**Impacto para UX:**
A área administrativa não deve parecer um conjunto de cadastros isolados — deve mostrar relações. O Admin pensa em como Operações, Grupos, Funções e Pessoas se conectam. Quando essa estrutura é apresentada como uma lista de registros independentes, a complexidade cresce rapidamente e a gestão se torna burocrática.

**Impacto para Interface:**
- A estrutura deve ser visualizada como sistema conectado: Operações → Grupos → Funções → Pessoas
- Mudanças recentes devem ser visíveis: novos grupos, alterações de responsabilidade, novas funções, mudanças de acesso
- Antes de executar qualquer alteração estrutural, o sistema deve mostrar o impacto esperado da mudança
- A sensação deve ser: *"Entendo como a organização está montada"* — não: *"Estou preenchendo formulários"*

**Riscos:**
Transformar a Administração em uma área burocrática onde o Admin gerencia campos individuais em vez de estruturas. Quando o sistema enfatiza cadastros em vez de relações, o Admin perde a visão sistêmica que é exatamente seu papel manter.

**Oportunidade para IA:**
A IA pode responder perguntas de impacto estrutural antes que o Admin execute uma mudança: *"Se eu mover este Supervisor para outro Grupo, quais impactos existirão?"*, *"Quais grupos estão sem responsável?"*, *"Existem funções sem cobertura?"*, *"Existe alguma estrutura inconsistente?"*

---

### D3 — O Admin teme consequências invisíveis — assim como o Supervisor, mas numa camada acima

**Resposta Operacional:**
O maior motivo de insegurança do Admin não é criar algo novo. É alterar algo existente sem entender o alcance das consequências. *"Se eu remover este Grupo, quem será afetado?"*, *"Se eu alterar esta permissão, quem perde acesso?"* São perguntas que surgem antes de qualquer mudança estrutural relevante.

**Impacto Operacional:**
Uma estrutura mal organizada gera problemas invisíveis que aparecem depois: permissões incorretas, grupos confusos, responsabilidades indefinidas, dificuldade de crescimento. O papel do Admin é preventivo — ele organiza hoje para evitar problemas futuros que ele pode não conseguir rastrear até sua causa raiz.

**Impacto para UX:**
O sistema deve tornar visíveis as consequências antes que o Admin as confirme. Não como bloqueio, mas como visibilidade. O Admin que vê o impacto antes de agir toma decisões melhores e com mais confiança. Isso reduz erros e reduz resistência à mudança.

**Impacto para Interface:**
- Antes de confirmar alterações estruturais: mostrar quem é afetado, o que muda, quais dependências existem
- Histórico de mudanças estruturais sempre disponível: o que mudou, quando, por quem
- Reversão possível quando aplicável — com clareza sobre o que a reversão desfaz

**Riscos:**
Não mostrar impacto antes de mudanças estruturais. O Admin que não vê as consequências antes de agir ou vai hesitar desnecessariamente (bloqueando mudanças legítimas) ou vai agir sem consciência (gerando problemas que só aparecem depois).

**Oportunidade para IA:**
*"Se eu desativar esta função, quais membros perdem ela? Existem atividades programadas que dependem dela?"* A IA transforma mudanças potencialmente opacas em decisões informadas.

---

### D4 — O Admin entra quando o problema ultrapassa a camada operacional

**Resposta Operacional:**
A primeira camada de resolução de qualquer problema é sempre o Supervisor — ele está mais próximo da execução, tem contexto imediato e consegue agir rapidamente. O Admin é acionado quando o problema excede essa camada: conflito entre Supervisores, falha recorrente de processo, problemas que afetam múltiplas operações, ou situações sem responsável claro.

**Impacto Operacional:**
Quanto mais o Admin é acionado para problemas que deveriam ser resolvidos pelo Supervisor, mais isso é um sinal de que alguma camada anterior está perdendo capacidade de absorver problemas. A frequência de escaladas para o Admin é, por si só, um indicador de saúde da estrutura.

**Impacto para UX:**
O Admin precisa distinguir claramente: *"Isso exige minha intervenção agora?"* vs. *"Isso é o Supervisor resolvendo dentro do seu escopo?"* O produto deve ajudá-lo a fazer essa triagem sem precisar mergulhar em cada caso individualmente.

**Impacto para Interface:**
- Pendências que requerem ação do Admin devem ser claramente separadas do fluxo operacional normal
- Items escalados (que subiram do Supervisor para o Admin) devem ter contexto visível: o que foi tentado, por quem, por que não foi resolvido na camada operacional
- O Admin deve conseguir responder: *"Existe algo que precisa da minha atenção agora?"* em segundos

**Riscos:**
O Admin ter visibilidade total de tudo sem distinção de prioridade. Ver tudo sem filtro gera o mesmo problema que não ver nada: incapacidade de triagem. A seleção do que merece atenção do Admin é crítica.

**Oportunidade para IA:**
*"Existem situações que precisam da minha atenção hoje?"*, *"Quais problemas já foram tratados pelos Supervisores e quais ainda estão em aberto?"* A IA faz a triagem que hoje o Admin faz manualmente.

---

### D5 — O Histórico é uma ferramenta de investigação narrativa, não um log técnico

**Resposta Operacional:**
Quando algo dá errado, o Admin não procura culpados — procura contexto. As perguntas típicas são: *"O que aconteceu? Quando? Quem estava envolvido? A regra foi seguida? O problema foi exceção ou padrão?"* O objetivo é reconstruir a sequência de eventos — e essa reconstrução hoje é fragmentada, lenta e dependente de múltiplas fontes conflitantes.

**Impacto Operacional:**
Quando o contexto de um problema não está disponível, o mesmo problema tende a se repetir — porque ninguém consegue identificar sua causa raiz. A capacidade de investigação do Admin é diretamente proporcional à capacidade da organização de aprender com seus erros.

**Impacto para UX:**
O Histórico deve ser construído como narrativa, não como lista de eventos. A experiência de auditoria deve responder *"o que aconteceu?"* — não *"quais registros existem?"* Essa diferença muda completamente o design: em vez de tabelas de log, o Admin vê uma linha do tempo contextualizada com atores, decisões e impactos.

**Impacto para Interface:**
- Primeira camada: O que aconteceu (resumo simples do evento)
- Segunda camada: Linha do tempo (criação → alterações → aprovações → publicações → comentários → reversões)
- Terceira camada: Contexto (pessoas envolvidas, operações, responsáveis, impactos)
- O Admin deve conseguir reconstruir a história de qualquer decisão sem precisar investigar em vários lugares

**Riscos:**
Tratar auditoria como registro legal — tecnicamente completo, operacionalmente inútil. Um log com todos os campos preenchidos mas sem capacidade de contar a história do que aconteceu não resolve o problema do Admin.

**Oportunidade para IA:**
A IA funciona como investigadora narrativa: *"O que aconteceu com esta solicitação?"*, *"Por que esta escala precisou ser corrigida?"*, *"Resuma os eventos que levaram a este conflito."* Transforma centenas de registros em uma narrativa compreensível.

---

### D6 — O Admin lê sinais antes de ler números

**Resposta Operacional:**
A leitura de saúde de uma operação começa por sinais perceptíveis antes de aparecerem em métricas formais. Um Supervisor sobrecarregado demonstra sinais antes de gerar um relatório. Uma equipe com dificuldades de cobertura gera ajustes antes de gerar indicadores. O Admin desenvolve uma leitura de *temperatura da operação* — não de análise de dashboard.

**Impacto Operacional:**
Uma operação saudável tem fluxo, previsibilidade e estabilidade — não pela ausência de problemas, mas porque os problemas não se acumulam. Os sinais de atenção são: muitas trocas de última hora, muitos ajustes após publicação, muitas solicitações sem resposta, repetição dos mesmos conflitos, dependência excessiva de pessoas específicas.

**Impacto para UX:**
O painel do Admin deve mostrar saúde antes de atividade. Primeiro: saudável / atenção / crítico. Depois: motivos e tendências. Depois: números. O Admin procura diagnóstico — não estatísticas. Os números devem explicar os sinais, nunca substituir os sinais.

**Impacto para Interface:**
- Status de saúde por operação como elemento principal e imediato
- Tendências destacadas: crescimento de pendências, aumento de correções, sobrecarga de grupos
- Ações recomendadas: o que exige intervenção, o que exige revisão, o que exige acompanhamento
- A pergunta central que o produto deve responder ao Admin: *"Preciso me preocupar com alguma coisa?"*

**Riscos:**
Transformar a Home do Admin em um dashboard corporativo cheio de gráficos e números. Isso cria informação mas não cria entendimento. O Admin que vê um gráfico sem contexto ainda precisa descobrir o que ele significa.

**Oportunidade para IA:**
*"Quais operações merecem atenção esta semana?"*, *"Existe algum padrão recorrente?"*, *"Quais grupos apresentam maior instabilidade?"* A IA antecipa problemas antes que o Admin precise procurá-los.

---

### D7 — Saúde organizacional é a capacidade de absorver problemas, não a ausência deles

**Resposta Operacional:**
O Admin não mede sucesso pela ausência de problemas — isso seria impossível em operações artísticas vivas. O sucesso é medido pela capacidade da estrutura de absorver problemas sem entrar em crise. Uma operação que resolve seus próprios problemas consistentemente está mais saudável do que uma operação silenciosa que esconde tensão.

**Impacto Operacional:**
Os indicadores naturais de saúde que o Admin observa mesmo sem sistema formal:
- **Tempo de resposta em Solicitações** — demora excessiva indica sobrecarga, gargalo ou falha de processo
- **Idade das pendências** — uma solicitação de duas semanas é diferente de uma de ontem
- **Frequência de correções pós-publicação** — indica planejamento instável ou cobertura insuficiente
- **Dependência de pessoas-chave** — sempre os mesmos substitutos indica fragilidade organizacional
- **Cobertura de funções críticas** — papéis sem alternativas são risco futuro latente
- **Frequência de escaladas para o Admin** — quanto mais sobem, mais a camada abaixo está perdendo capacidade
- **Pendências sem responsável** — qualquer item sem dono tende a se transformar em problema
- **Reincidência** — o mesmo problema aparecendo repetidamente indica causa estrutural, não operacional

**Impacto para UX:**
O produto deve ajudar o Admin a perceber tendências antes que se tornem crises. A distinção entre evento isolado e padrão emergente é crítica — e hoje ela é feita manualmente, com esforço considerável.

**Impacto para Interface:**
- Indicadores de tendência, não apenas de estado atual: *"Solicitações acumuladas aumentaram 40% nesta semana"*
- Alerta de reincidência: *"Este tipo de conflito ocorreu 3 vezes nas últimas 2 semanas nesta operação"*
- Visibilidade de dependência: *"Esta função tem apenas 1 pessoa habilitada"*
- Visibilidade de itens sem responsável em tempo real

**Riscos:**
Mostrar apenas o estado atual sem contexto de tendência. Um número isolado tem pouco valor para o Admin — o que importa é se está crescendo, estável ou melhorando em relação ao período anterior.

**Oportunidade para IA:**
*"Quais problemas estamos repetindo?"*, *"Existe algum gargalo crescente?"*, *"Quais grupos apresentam instabilidade recorrente?"* A IA transforma dados históricos em inteligência organizacional.

---

### D8 — Reincidência é o indicador mais valioso para o Admin

**Resposta Operacional:**
Entre todos os sinais que o Admin observa, a reincidência é o mais revelador: *"Estamos resolvendo problemas ou repetindo problemas?"* Quando o mesmo tipo de conflito aparece repetidamente — nas mesmas funções, nos mesmos grupos, com as mesmas solicitações — o Admin entende que existe uma causa estrutural que não foi endereçada.

**Impacto Operacional:**
Resolver um problema sem entender sua causa raiz significa que ele vai reaparecer. A reincidência representa custo operacional contínuo: o mesmo esforço aplicado repetidamente ao mesmo problema, sem aprendizado organizacional.

**Impacto para UX:**
O produto deve ser capaz de identificar e destacar padrões de recorrência automaticamente. Hoje esse trabalho é feito pelo Admin manualmente — cruzando informações de diferentes fontes ao longo do tempo.

**Impacto para Interface:**
- Indicador de recorrência visível por tipo de evento, por grupo, por operação
- Histórico de um mesmo tipo de problema ao longo do tempo
- Conexão entre eventos similares: *"Isto ocorreu também em 15/05 e 30/05 — nesta mesma função"*

**Riscos:**
Um sistema que registra todos os eventos mas não conecta eventos similares ao longo do tempo. Isso gera um histórico completo e analiticamente inútil para identificar padrões.

**Oportunidade para IA:**
A IA como detektora de padrões: *"Esta operação apresenta conflitos de cobertura recorrentes nas quintas-feiras. As últimas 4 ocorrências envolveram a função Astrid."* Isso transforma dados dispersos em inteligência acionável.

---

### D9 — A IA do Admin é uma analista organizacional, não um assistente operacional

**Resposta Operacional:**
A IA dos três perfis resolve problemas fundamentalmente diferentes. O Supervisor usa a IA para tomar decisões operacionais. O Membro usa a IA para entender sua parte na operação. O Admin usa a IA para enxergar além do que os dados isolados conseguem mostrar — padrões, tendências e riscos sistêmicos.

**Impacto Operacional:**
A IA do Admin tem valor máximo quando consegue detectar riscos antes que se tornem crises, conectar eventos que parecem não relacionados, identificar padrões recorrentes e sugerir intervenções estruturais — não operacionais.

**Impacto para UX:**
O tom e o modo de interação da IA variam por perfil. Para o Admin: linguagem analítica, orientada a padrões e tendências, com recomendações de natureza estrutural — não operacional. Não deve sugerir quem substitui quem hoje; deve sugerir por que a cobertura está sistematicamente frágil.

**Impacto para Interface:**
- Perguntas típicas do Admin: *"Existe alguma operação em risco?"*, *"Quais gargalos estão crescendo?"*, *"Quais problemas estamos repetindo?"*, *"Existe alguma área sem acompanhamento?"*, *"Quem tem permissões que não deveria?"*
- A IA responde com análise e recomendação — não apenas com dados brutos
- Exemplo ideal: *"A Operação Snowland apresentou aumento de 60% em correções pós-publicação nas últimas 3 semanas. As correções se concentram no Grupo de Patinação. Pode indicar instabilidade de planejamento ou escassez de cobertura nesse grupo."*

**Riscos:**
Dar ao Admin a mesma IA do Supervisor com mais permissões. Isso seria perder a oportunidade de criar uma IA que pensa na escala certa para o perfil certo.

**Oportunidade para IA:**
A IA do Admin como parceira de governança contínua: monitora, identifica, alerta e explica — permitindo que o Admin tome decisões estruturais com base em evidência, não em intuição ou em problemas que já viraram crise.

---

### D10 — O valor do MyASA para o Admin é transformar eventos dispersos em leitura de saúde organizacional

**Resposta Operacional:**
A maior dificuldade do Admin hoje não é falta de informação — é falta de contexto organizado. As informações existem: em mensagens, planilhas, conversas, versões de documentos. Mas estão espalhadas. O Admin gasta energia para descobrir o que aconteceu antes de poder analisar e decidir.

**Impacto Operacional:**
Quando o Admin tem visibilidade clara e organizada do ecossistema, ele pode intervir cedo, aprender com padrões e construir uma organização que melhora continuamente. Quando não tem, reage a crises sem compreender suas causas — e as mesmas crises voltam.

**Impacto para UX:**
A proposta de valor do produto para o Admin é transformar complexidade em clareza de três formas: estado (o que está acontecendo agora), tendência (o que está mudando ao longo do tempo) e contexto (por que as coisas aconteceram). As três juntas permitem governança real.

**Impacto para Interface:**
Hierarquia de informação para todas as telas do Admin:
1. Estado de saúde geral (saudável / atenção / crítico)
2. O que exige minha ação agora
3. Tendências e padrões relevantes
4. Detalhes e histórico quando necessário

Nenhuma tela do Admin deve começar pelo item 4.

**Riscos:**
Construir o produto para o Admin como um sistema de administração de banco de dados disfarçado — onde ele passa mais tempo gerenciando registros do que governando a organização. Isso seria resolver o problema errado para o perfil certo.

**Oportunidade para IA:**
A IA como principal interface do Admin com o ecossistema: em vez de navegar por múltiplas telas para coletar informação manualmente, o Admin faz uma pergunta e recebe uma análise. A IA reduz a distância entre *"preciso saber o que está acontecendo"* e *"sei o que está acontecendo e o que fazer"*.

---

## Padrão Central do Admin

Todas as dez descobertas convergem para um único padrão:

> **O Admin não administra eventos. Administra estruturas e padrões.**

A diferença entre o Admin e os outros perfis:
- O Supervisor enxerga uma operação no tempo
- O Membro enxerga a si mesmo no tempo
- O Admin enxerga o sistema inteiro no tempo — e especialmente como ele está evoluindo

O maior valor do MyASA para o Admin é tornar essa evolução visível:
- O que está melhorando
- O que está se deteriorando
- O que está se repetindo
- O que ainda não tem responsável

---

## Princípios de Design para o Admin

Derivados diretamente das descobertas:

1. **Saúde antes de atividade** — o estado geral precede os detalhes sempre
2. **Sinais antes de números** — diagnóstico antes de estatística; números explicam sinais, nunca os substituem
3. **Tendência antes de evento** — o que está mudando é mais importante do que o que aconteceu ontem
4. **Impacto visível antes de confirmação** — qualquer mudança estrutural mostra suas consequências antes de ser executada
5. **Narrativa antes de log** — o histórico conta o que aconteceu, não apenas o que foi registrado
6. **Estrutura antes de pessoa** — o sistema apresenta relações e responsabilidades, não cadastros individuais
7. **IA como analista** — perguntas respondidas com análise e recomendação, não com dados brutos

---

## Implicações por Pilar

| Pilar | Implicação para o Admin |
|---|---|
| **Home** | Começa com saúde geral do ecossistema. Nunca com uma operação específica. |
| **Operações** | Visão comparativa entre operações (saudável / atenção / crítico). Estado e tendência por operação. |
| **Grupos Operacionais** | Visualização estrutural com responsáveis, cobertura e fragilidades. |
| **Usuários e Permissões** | Gestão por estrutura (quem pertence a que grupo, com qual função), não por cadastro individual. |
| **Solicitações** | Visibilidade de tempo médio de resposta, age das pendências e gargalos por Supervisor. |
| **Histórico** | Ferramenta de investigação narrativa. Linha do tempo contextualizada por entidade. |
| **Indicadores** | Tendências ao longo do tempo, reincidências, dependências críticas, itens sem responsável. |
| **IA** | Analista organizacional. Detecta padrões, antecipa riscos, resume eventos complexos em narrativa. |
| **Auditoria** | Reconstrução de qualquer decisão sem depender de memória de pessoas ou de fontes paralelas. |
| **Configurações** | Ambiente estrutural flexível que permite evolução sem reconstrução. |
