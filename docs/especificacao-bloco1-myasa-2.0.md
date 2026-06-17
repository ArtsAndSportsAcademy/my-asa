# MyASA 2.0 — Especificação Funcional — Bloco 1

> Versão: 17/06/2026
> Fase: Design de Interface — Bloco 1
> Escopo: S-01 Meu Dia · S-02 Painel Operacional · S-04 Escala
> Status: Especificação funcional — anterior a wireframes, layouts e componentes

---

## Premissa do Bloco 1

As três superfícies deste bloco formam o núcleo operacional do MyASA. São as mais utilizadas, as mais críticas e as que definem se o produto cumpre sua promessa de substituir o WhatsApp e os processos informais.

**S-01 Meu Dia** → Certeza para executar (Membro)
**S-02 Painel Operacional** → Clareza para decidir (Supervisor)
**S-04 Escala** → Controle para proteger a operação (Supervisor / Admin)

O design destas três superfícies **define o caráter do produto**. Se forem claras, leves e decisivas — o produto tem identidade. Se forem densas, tabeladas ou burocráticas — o produto é mais um sistema que as pessoas vão evitar.

---

---

# S-01 — MEU DIA
**Perfil:** Membro | **Classificação:** Primária | **Frequência:** Múltiplas vezes ao dia

---

## 1. Objetivo principal

Ser a **resposta completa e confiável** para a pergunta diária do Membro:
*"O que preciso fazer hoje — e mudou alguma coisa desde a última vez que abri isso?"*

Não é uma agenda. Não é um feed. Não é um painel de tarefas.

É a **confirmação ativa de que o Membro está pronto para executar.** Cada abertura do Meu Dia deve terminar com o Membro sabendo exatamente o que fazer — ou sabendo que não há nada diferente do esperado.

---

## 2. Estado mental do usuário ao entrar

O Membro abre o Meu Dia em contextos radicalmente diferentes ao longo do dia:

| Momento | Contexto | O que precisa |
|---|---|---|
| **Manhã** | Em casa ou em trânsito | Confirmação de que o dia está como esperado |
| **Antes de uma atividade** | No camarim, bastidor, corredor | Rapidez absoluta — confirmação em segundos |
| **Após uma notificação** | Em qualquer lugar | Entender o que mudou e confirmar |
| **No meio do dia** | Entre atividades | Checar próxima atividade e pendências |
| **No final do dia** | Após todas as atividades | Ver se há alguma entrega ou confirmação pendente |

**Estado mental dominante:** vigilância tranquila. O Membro não está em modo de urgência — mas precisa de certeza. O app deve transmitir: *"Está tudo bem. / Atenção a isso."* — nunca ambiguidade.

**Risco de design:** se o Meu Dia apresentar muita informação, o Membro não sabe o que focar. Se apresentar informação errada em primeiro lugar (ex.: avisos gerais antes da programação pessoal), a confiança colapsa.

---

## 3. Hierarquia de informação

A hierarquia é dinâmica — o sistema decide o que aparece em primeiro lugar com base no estado atual. O Membro nunca precisa procurar o que importa.

### Hierarquia quando existe alteração não confirmada (estado mais crítico)

```
1. ⚠️  ALTERAÇÃO DESDE A ÚLTIMA ABERTURA  ⚠️
   └── O que era antes → O que é agora
   └── Ação: Confirmar (obrigatória para desaparecer)

2. Próxima atividade (com o papel atual, pós-alteração)
3. Linha do tempo do dia (com a mudança refletida)
4. IA: interpretação da mudança em linguagem pessoal
5. Pendências menores (solicitações, entregas)
```

### Hierarquia quando não existe alteração (estado padrão)

```
1. Próxima atividade
   └── O quê / Onde / Quando / Em qual papel
   └── Status: confirmado ✓

2. IA: resumo narrativo do dia (1–2 linhas)

3. Linha do tempo do dia completo
   └── Todas as atividades ordenadas por horário
   └── Sob demanda (expansível, não imposta)

4. Confirmações pendentes (se existirem)
5. Status de solicitações em aberto (resumido)
6. Entregas com prazo próximo (resumido)
7. Avisos não lidos (indicador, não conteúdo completo)
```

### Hierarquia quando o Membro não tem atividades hoje

```
1. "Sem atividades hoje" — comunicado com clareza
2. Próxima atividade (data futura)
3. Pendências: solicitações, entregas, avisos
4. IA: disponível para perguntas
```

**Princípio crítico:** o sistema sempre diz ao Membro qual é o estado das coisas — incluindo "está tudo certo". O silêncio não existe.

---

## 4. Seções obrigatórias

### 4.1 — Cabeçalho de contexto temporal

**Conteúdo:** data atual, cumprimento contextual (bom dia / boa tarde / boa noite), nome da operação ativa.

**Regra:** simples, não decorativo. O Membro sabe onde está no tempo sem precisar calcular.

---

### 4.2 — Bloco de Alteração (condicional — aparece apenas quando existe)

**Condição de aparição:** existe pelo menos uma Alteração Operacional Persistente não confirmada.

**Conteúdo obrigatório:**
- O que era antes (estado anterior)
- O que é agora (estado atual)
- Quando a alteração foi feita
- Quem fez a alteração (nome do Supervisor ou sistema)
- Ação: **Confirmar** — botão primário, visível sem scroll

**Comportamento:**
- Persiste como elemento de topo da superfície até confirmação explícita
- Não desaparece com o fechamento do app
- Não desaparece após X horas
- O Membro não pode "ignorar" — pode visualizar e confirmar, ou sair sem confirmar (e o bloco continuará na próxima abertura)

**Múltiplas alterações:** se existirem 2+ alterações não confirmadas, são exibidas em sequência — a mais recente primeiro. O Membro confirma cada uma individualmente.

**Estado pós-confirmação:** o bloco desaparece e a hierarquia padrão assume.

---

### 4.3 — Card de Próxima Atividade

**É o elemento âncora do Meu Dia.** Se o Membro abrir o app e só olhar para uma coisa, é este card.

**Conteúdo obrigatório:**
- Tipo da atividade (Show / Ensaio / Aula / Reunião...)
- Nome da atividade / espetáculo
- Horário de início
- Horário de término
- Local (quando aplicável)
- Papel do Membro nesta atividade (personagem, função, posição)
- Status: Confirmado / Alterado / Atenção

**Conteúdo secundário (sob demanda / expansível):**
- Diferenças em relação ao esperado ("Personagem diferente do habitual")
- Instruções específicas do Livro do Dia
- Link para ver o Livro do Dia completo

**Regra de papel:** o papel exibido é sempre o papel do Membro **nesta atividade específica**, não uma lista de todos os papéis possíveis. Clareza sobre precisão.

**Quando não há atividade iminente:** o card mostra "Próxima atividade: [nome], [data], [horário]" — não fica vazio.

---

### 4.4 — Narrativa da IA (1–3 linhas)

**Posicionamento:** logo após o Card de Próxima Atividade, antes da linha do tempo.

**Conteúdo:** a IA gera uma frase que resume o estado do dia em linguagem pessoal e direta.

**Exemplos:**
- *"Hoje você tem 2 shows. Seu personagem no das 14h é diferente do de costume — confirme a alteração acima."*
- *"Tudo como esperado hoje. Você entra em cena às 15h como Astrid."*
- *"Dia livre de shows. Você tem uma entrega com prazo amanhã."*
- *"A alteração de ontem foi confirmada. Hoje você atua como substituto no Musical das 16h."*

**Regras:**
- Máximo 3 linhas
- Linguagem na 2ª pessoa ("você"), direta, sem jargão operacional
- Faz referência ao estado real do dia — não é genérica
- Não repete o que o card já mostra — adiciona contexto ou síntese
- O Membro pode tocar para expandir e fazer perguntas (abre modo de chat embarcado)

---

### 4.5 — Linha do Tempo do Dia

**Conteúdo:** todas as atividades do dia em ordem cronológica.

**Exibição padrão:** contraída (o Membro vê apenas o card da próxima atividade).

**Exibição expandida:** lista completa de atividades do dia, cada uma com:
- Horário de início e término
- Nome da atividade
- Papel do Membro
- Status (Confirmado / Alterado / Atenção)

**Atividades passadas:** exibidas com visual atenuado (já aconteceram). Não removidas — o Membro pode querer verificar o que já cumpriu.

**Espaços entre atividades:** o sistema mostra intervalos ("Intervalo de 2h entre o ensaio e o show").

**Atividade com restrição ativa:** exibe indicador contextual ("Você está com restrição de alta acrobacia registrada — verifique com o Supervisor se há impacto nesta atividade").

---

### 4.6 — Confirmações Pendentes (condicional)

**Condição de aparição:** existe pelo menos uma ação que o Membro precisa confirmar (exceto Alteração Operacional — essa tem bloco próprio).

**Exemplos de confirmações pendentes:**
- Proposta de troca de folga enviada pelo Supervisor aguardando resposta
- Entrega com feedback solicitado aguardando revisão
- Aviso com confirmação de leitura obrigatória

**Conteúdo:** lista resumida dos itens pendentes. Cada item tem um link direto para a superfície relevante.

---

## 5. Seções secundárias

### 5.1 — Solicitações em Aberto

**Conteúdo:** número de solicitações com estado diferente de "resolvido" + estado de cada uma em uma linha (ex.: "Folga 21/06 — Em análise há 2 dias").

**Acesso:** toque leva para S-06 Solicitações.

**Visibilidade:** não exibido quando todas as solicitações estão resolvidas.

---

### 5.2 — Entregas com Prazo Próximo

**Conteúdo:** entregas com prazo nas próximas 48h. Máximo 2 itens visíveis — "ver todas" para acessar S-07.

**Exibição:** nome da entrega + prazo + estado (aguardando envio / aguardando revisão).

**Visibilidade:** não exibido quando não há entregas com prazo próximo.

---

### 5.3 — Avisos Não Lidos

**Conteúdo:** número de avisos não lidos. Toque leva para S-08 Avisos.

**Não exibido:** quando todos os avisos foram lidos.

**Nota:** avisos críticos ou que exigem confirmação de leitura sobem para a seção 4.6 (Confirmações Pendentes) — não ficam apenas nesta seção secundária.

---

## 6. Ações principais

| Ação | Onde aparece | O que faz |
|---|---|---|
| **Confirmar Alteração** | Bloco de Alteração | Marca alteração como confirmada, remove o bloco |
| **Ver Livro do Dia** | Card de Próxima Atividade | Abre S-05 com contexto do show atual |
| **Expandir Linha do Tempo** | Abaixo do card | Exibe todas as atividades do dia |
| **Perguntar à IA** | Narrativa da IA | Abre modo de chat embarcado |

---

## 7. Ações secundárias

| Ação | Onde aparece | O que faz |
|---|---|---|
| **Ver solicitação** | Seção de Solicitações | Abre item específico em S-06 |
| **Ver entrega** | Seção de Entregas | Abre item específico em S-07 |
| **Ver avisos** | Seção de Avisos | Abre S-08 |
| **Criar solicitação** | Ação rápida (no card ou nav) | Atalho para criar em S-06 |

---

## 8. Estados vazios

### 8.1 — Sem atividades hoje, sem pendências

Mensagem: *"Hoje não há atividades programadas."*
Complemento: próxima atividade futura (data e nome).
IA: *"Bom descanso. Sua próxima atividade é [atividade] no dia [data]."*

### 8.2 — Início de uso (primeiro acesso, sem dados)

Mensagem: *"Sua programação aparecerá aqui assim que o Supervisor publicar a Escala."*
IA: disponível para perguntas gerais.

### 8.3 — Dia com atividades mas Escala ainda não publicada

Mensagem: *"A programação de hoje ainda não foi publicada pelo Supervisor."*
Complemento: última Escala publicada (se existir) como referência provisória, claramente marcada como "última versão conhecida".

---

## 9. Estados de atenção

| Situação | Indicador |
|---|---|
| Solicitação sem resposta há mais de 3 dias | Badge de tempo na seção de Solicitações |
| Entrega com prazo em menos de 24h | Indicador de urgência na seção de Entregas |
| Aviso com confirmação pendente há mais de 24h | Destaque na seção de Confirmações Pendentes |
| Próxima atividade com papel diferente do habitual | Nota contextual no Card de Próxima Atividade |
| Restrição ativa que pode impactar a atividade | Indicador contextual na atividade afetada |

---

## 10. Estados críticos

| Situação | Comportamento do sistema |
|---|---|
| Alteração Operacional não confirmada | Bloco de Alteração ocupa o topo. Não pode ser ignorado. |
| Atividade em menos de 30 minutos com papel diferente do habitual | Card de Próxima Atividade em estado de urgência + notificação push adicional |
| Solicitação negada (resposta nova desde a última abertura) | Badge no card de Solicitações + notificação em Confirmações Pendentes |
| Show cancelado | Alteração Operacional Persistente do tipo cancelamento — com explicação clara do que mudou |

---

## 11. Integração da IA — S-01

### Modo embarcado (padrão)

A IA está sempre presente no Meu Dia como elemento ativo. Não é um botão que abre um chat — é parte da superfície.

**Presença passiva:** a narrativa da IA (seção 4.4) é gerada automaticamente ao abrir. O Membro lê sem interagir.

**Presença ativa:** o Membro toca na narrativa ou no campo de IA para fazer uma pergunta. A resposta aparece na própria superfície — não abre uma nova tela.

**Perguntas típicas no Meu Dia:**
- *"O que mudou no show de hoje?"*
- *"Qual é meu personagem no Musical das 14h?"*
- *"Por que minha folga foi negada?"*
- *"Tenho alguma entrega para hoje?"*
- *"O que aconteceu com o ensaio de amanhã?"*

**Escopo da IA no Meu Dia:** responde apenas sobre a realidade do próprio Membro. Nunca acessa informações de outros Membros. Nunca faz afirmações sobre a operação geral.

### Quando expandir para chat dedicado

Quando a conversa exige mais de 3 trocas, ou quando o Membro precisa de algo que vai além do contexto do dia atual, a IA oferece a opção de "continuar no assistente" — que abre o modo de chat dedicado de S-10.

---

## 12. Relação com notificações — S-01

| Tipo de notificação | Comportamento ao tocar |
|---|---|
| Alteração Operacional Persistente | Abre Meu Dia com Bloco de Alteração em destaque |
| Aviso operacional | Abre Meu Dia com Aviso visível em Confirmações Pendentes |
| Resposta a solicitação | Abre Meu Dia com item em Confirmações Pendentes |
| Lembrete de entrega | Abre Meu Dia com Entrega em seção de Entregas |
| Notificação crítica (cancelamento de show) | Abre Meu Dia com Bloco de Alteração do tipo crítico |

**Regra:** todas as notificações do Membro aterrissam no Meu Dia — não em superfícies específicas. O Meu Dia é o hub central do Membro. A superfície relevante (S-06, S-07, S-08) é acessível a partir do Meu Dia via link contextual.

---

## 13. Relação com Histórico — S-01

O Membro tem acesso limitado ao Histórico. Pode ver:
- Histórico das suas próprias confirmações
- Histórico das suas solicitações (estado por estado)
- Histórico das suas entregas (versões enviadas)

Acesso via S-11 (Histórico), não via Meu Dia diretamente. O Meu Dia não exibe histórico — exibe estado atual.

---

## 14. Relação com outras superfícies — S-01

| Superfície | Relação |
|---|---|
| **S-04 Escala** | Fonte de dados. O Meu Dia é a fatia individual da Escala. Toda atualização da Escala gera atualização no Meu Dia. |
| **S-05 Livro do Dia** | Aprofundamento. Meu Dia → "Ver Livro do Dia" abre S-05 com contexto do show. Retorno natural ao Meu Dia. |
| **S-06 Solicitações** | Destino para criar ou acompanhar solicitações. Meu Dia exibe estado resumido. |
| **S-07 Entregas** | Destino para entregas. Meu Dia exibe apenas prazo próximo. |
| **S-08 Avisos** | Avisos importantes aparecem como indicador. Conteúdo completo em S-08. |
| **S-10 IA** | Embarcada no Meu Dia. Chat dedicado acessível via expansão. |

---

---

# S-02 — PAINEL OPERACIONAL
**Perfil:** Supervisor | **Classificação:** Primária | **Frequência:** Múltiplas vezes ao dia

---

## 1. Objetivo principal

Ser a **resposta imediata para a pergunta operacional do Supervisor:**
*"A operação de hoje está protegida? Existe alguma exceção que precisa da minha atenção agora?"*

Não é um dashboard de indicadores. Não é um feed de atividades. Não é uma lista de tarefas.

É uma **central de triagem de exceções com visão de consequências.** O Supervisor abre o Painel e em 10 segundos sabe: está tudo bem, ou tem algo crítico, e qual é a próxima ação.

---

## 2. Estado mental do usuário ao entrar

O Supervisor abre o Painel Operacional em contextos distintos:

| Momento | Contexto | O que precisa |
|---|---|---|
| **Início do turno** | Em qualquer lugar — pode estar caminhando | Status imediato: pronta / atenção / crítico |
| **Após notificação** | Interrupção de outra atividade | A exceção específica em destaque + próxima ação |
| **Entre atividades** | 5 minutos de janela | Confirmações pendentes + riscos imediatos |
| **Planejamento da semana** | Sentado, com tempo | Multi-horizonte + planejamento preventivo |
| **Pós-publicação** | Aguardando confirmações | Rastreamento de quem confirmou |

**Estado mental dominante:** **vigilância ativa com tolerância a interrupções.** O Supervisor está sempre pronto para uma nova exceção. A interface deve criar a sensação de controle — mesmo quando existem múltiplos problemas simultâneos.

**O que o Supervisor nunca quer:** surpresas depois que é tarde. A interface deve ser o sistema que previne surpresas — não o que as comunica tarde.

---

## 3. Hierarquia de informação

A hierarquia do Painel é determinada pela **urgência do impacto operacional**, não pela ordem de criação ou pelo tipo de evento.

### Hierarquia quando status = Crítico

```
1. 🔴 STATUS: CRÍTICO
   └── "[Atividade] começa em [X minutos] com cobertura insuficiente"
   └── Ação primária: "Resolver agora" → abre Escala na exceção

2. Outras exceções ativas (em segundo plano)

3. Confirmações pendentes (rastreamento pós-publicação)

4. Multi-horizonte (visível mas não prioritário)
```

### Hierarquia quando status = Atenção

```
1. 🟡 STATUS: ATENÇÃO
   └── "[N] exceções ativas"

2. Lista de exceções priorizadas por impacto + urgência
   └── Exceção 1: [atividade afetada] · [horário] · [cobertura disponível?]
   └── Exceção 2: ...
   └── Exceção N: ...

3. Confirmações pendentes

4. Multi-horizonte (expansível)

5. Solicitações aguardando análise (badge/indicador)
```

### Hierarquia quando status = Pronta

```
1. ✅ STATUS: OPERAÇÃO PRONTA
   └── Confirmação de que não há exceções ativas

2. Confirmações pendentes (se existirem — pode haver mesmo sem exceções)

3. Multi-horizonte: próximos 3 dias
   └── Dias sem risco (verde)
   └── Dias com risco previsível (amarelo) + qual é o risco

4. Solicitações aguardando análise

5. IA: briefing do dia
```

**Princípio de prioridade:** exceções são exibidas por **impacto na operação + urgência de horário**. Uma folga de amanhã não aparece antes de uma cobertura ausente que começa em 20 minutos.

---

## 4. Seções obrigatórias

### 4.1 — Indicador de Status da Operação

**É o elemento mais importante do Painel.** Deve ser percebido em menos de 2 segundos, sem precisar ler texto.

**Três estados visuais claramente distintos:**
- **Pronta** — estado positivo, tranquilo
- **Atenção** — estado intermediário, exige análise
- **Crítico** — estado urgente, exige ação imediata

**Conteúdo complementar ao status:**
- Status Pronta: "[N] atividades hoje · Cobertura: completa"
- Status Atenção: "[N] exceções ativas · Mais urgente: [atividade] às [horário]"
- Status Crítico: "[Atividade] começa em [X min] · Cobertura insuficiente"

**Comportamento:** o status é recalculado em tempo real. Quando uma exceção é resolvida, o status atualiza imediatamente — o Supervisor vê o efeito da sua ação.

---

### 4.2 — Lista de Exceções Priorizadas

**Condição de aparição:** existe pelo menos uma exceção ativa.

**O que é uma exceção:** qualquer condição que impede a operação de acontecer como planejado.

**Exemplos de exceções:**
- Ausência de membro com atividade programada (no-show, folga de última hora)
- Posição crítica em aberto no Livro do Dia
- Conflito de horário detectado na Escala
- Membro com restrição emergencial afetando atividade
- Escala não publicada com show em menos de Xh

**Conteúdo de cada exceção na lista:**
- Qual atividade é afetada (nome + horário de início)
- Qual é o problema (ausência de quem, posição em aberto, qual conflito)
- Existe cobertura disponível? (Sim / Parcial / Não)
- Urgência: em quanto tempo começa a atividade afetada
- Ação: "Resolver" → entra no fluxo de substituição na Escala com o contexto pré-carregado

**Ordenação:** pela combinação de urgência (tempo até a atividade) + impacto (posição crítica tem peso maior que posição de backup).

**Múltiplas exceções simultâneas:** a lista exibe todas, com a primeira claramente em destaque como "resolver primeiro". O Supervisor pode ver o raciocínio de priorização ("Esta é a mais urgente porque o show começa em 18 minutos e Astrid é uma posição sem substituto definido").

---

### 4.3 — Rastreador de Confirmações

**Condição de aparição:** existe pelo menos uma publicação recente com confirmações pendentes.

**Conteúdo:**
- Quantos membros foram notificados
- Quantos já confirmaram
- Quem ainda não confirmou (nomes)
- Há quanto tempo a notificação foi enviada
- Quanto tempo falta para a atividade afetada começar

**Estados do rastreador:**
- **Verde:** todos confirmaram
- **Amarelo:** maioria confirmou, alguns pendentes, tempo suficiente
- **Vermelho:** confirmações pendentes com atividade chegando em menos de X minutos

**Ação disponível:** "Renotificar [nome]" — dispara nova notificação para membro específico sem sair do Painel.

---

### 4.4 — Multi-horizonte (sob demanda)

**Posicionamento:** abaixo das seções de exceções e confirmações. Acessível sem troca de superfície.

**Exibição padrão:** contraído — mostra apenas "Próximos 3 dias: [N] riscos identificados".

**Exibição expandida:** visão de 3 dias (hoje + amanhã + depois de amanhã) com:
- Por dia: status resumido (OK / Atenção / Risco)
- Para dias em Atenção/Risco: qual é o sinal específico
- Exemplos: "Amanhã: 3 folgas aprovadas, cobertura de Astrid no limite"

**Não inclui:** planejamento da semana completa (essa é a função da Agenda via S-12 — o Painel tem apenas os próximos 3 dias).

**Ação disponível em cada dia com risco:** "Antecipar resolução" → abre Escala filtrada para aquela data.

---

### 4.5 — Indicador de Solicitações Pendentes

**Conteúdo:** número de solicitações aguardando análise + a mais urgente (quem solicitou, qual data de impacto).

**Não é uma lista completa** — o Supervisor acessa S-06 para ver todas. O Painel exibe apenas o sinal de "tem algo esperando por mim".

**Urgência:** se existe uma solicitação com data de impacto para hoje ou amanhã, o indicador tem destaque adicional.

---

## 5. Seções secundárias

### 5.1 — Narrativa da IA

**Posicionamento:** abaixo do Indicador de Status, visível na abertura.

**Conteúdo:** resumo do estado operacional em 2–4 linhas.

**Exemplos:**
- *"Bom dia. A operação está protegida. Detectei um risco para sexta: 3 folgas aprovadas com cobertura de Astrid no limite — vale antecipar."*
- *"Amanda solicitou folga para sábado e ainda não foi analisada. O Musical das 14h tem Amanda como titular de Astrid."*
- *"Todas as exceções de hoje foram resolvidas. Bruno e Carol já confirmaram as mudanças."*

**Interação:** toque na narrativa abre modo de chat embarcado da IA.

---

### 5.2 — Último Evento (contextual)

**Conteúdo:** o evento mais recente que afetou a operação (última publicação, última substituição resolvida, última solicitação aprovada).

**Utilidade:** permite ao Supervisor que retorna após um período fora do app entender rapidamente "o que aconteceu enquanto eu estava offline".

**Expansão:** "Ver histórico de hoje" → abre S-11 filtrado por data.

---

## 6. Ações principais

| Ação | Onde aparece | O que faz |
|---|---|---|
| **Resolver exceção** | Em cada exceção da lista | Abre S-04 com exceção pré-carregada para ação |
| **Renotificar membro** | Rastreador de confirmações | Dispara nova notificação para membro específico |
| **Antecipar resolução de risco futuro** | Multi-horizonte | Abre S-04 filtrada para data futura com risco |
| **Analisar solicitações** | Indicador de Solicitações | Abre S-06 com fila de solicitações pendentes |

---

## 7. Ações secundárias

| Ação | Onde aparece | O que faz |
|---|---|---|
| **Gerar Livro do Dia** | Acesso rápido (se não foi gerado) | Abre S-05 para a data mais próxima sem Livro |
| **Ver histórico de hoje** | Seção de Último Evento | Abre S-11 filtrado |
| **Criar aviso** | Ação disponível sempre | Atalho para criar em S-08 |
| **Perguntar à IA** | Narrativa da IA | Expande para chat embarcado |

---

## 8. Estados vazios

### 8.1 — Operação Pronta, sem pendências

Não é um estado vazio real — é o estado de sucesso. Deve ser comunicado positivamente:
*"Operação protegida. [N] atividades hoje com cobertura completa."*
Seguido de multi-horizonte e indicador de solicitações.

### 8.2 — Nenhuma atividade hoje

*"Sem atividades operacionais hoje. Próximo show: [nome], [data]."*
Multi-horizonte disponível para planejamento preventivo.

### 8.3 — Grupo sem atividades configuradas

*"O Grupo [nome] ainda não tem atividades configuradas para esta semana."*
Ação: "Configurar Escala" → abre S-04.

---

## 9. Estados de atenção

| Situação | Indicador |
|---|---|
| Exceção com impacto moderado e tempo suficiente | Exceção visível na lista, sem urgência de cor |
| Solicitação aguardando análise há mais de 24h | Destaque no indicador de Solicitações |
| Membro sem confirmação de publicação há mais de 1h | Destaque no Rastreador de Confirmações |
| Risco no multi-horizonte (não iminente) | Dia destacado no Multi-horizonte |
| Escala ainda não publicada com show em menos de 4h | Alerta no Painel abaixo do status |

---

## 10. Estados críticos

| Situação | Comportamento |
|---|---|
| Atividade começa em menos de 30min com posição crítica em aberto | Status = Crítico. Exceção em destaque máximo. Notificação push se app não está aberto. |
| Múltiplos membros ausentes com show iminente | Status = Crítico. Ordem de prioridade explícita. IA: "Esta é a ordem de resolução recomendada." |
| Membro não confirmou com atividade em menos de 15min | Rastreador em estado crítico + alerta proativo da IA |
| Escala publicada com erro detectado após publicação | Alerta de inconsistência pós-publicação com ação "Corrigir e republicar" |

---

## 11. Integração da IA — S-02

### Modo embarcado (padrão)

A IA do Supervisor tem seu maior momento de valor no Painel. Atua como **copiloto operacional ativo**.

**Abertura automática:** ao abrir o Painel, a IA gera uma narrativa de contexto do estado atual. O Supervisor não precisa pedir — a IA apresenta.

**Análise proativa:** quando existe exceção, a IA não apenas lista — ela analisa:
- Qual é o impacto real desta ausência nas atividades do dia
- Qual é a recomendação de priorização
- Qual é a ação sugerida com o raciocínio exposto

**Perguntas típicas no Painel:**
- *"O que aconteceu enquanto eu estava offline?"*
- *"Qual exceção devo resolver primeiro?"*
- *"Existe algum risco que eu ainda não vi?"*
- *"Carlos não confirmou — o que devo fazer?"*
- *"Qual é a situação da semana?"*

**Princípio crítico:** a IA do Supervisor no Painel deve responder em menos de 3 segundos. O Supervisor pode estar em crise. A IA que demora é a IA que não é usada.

### Proatividade da IA

A IA do Painel tem papel proativo — não espera ser perguntada para situações críticas:

- Quando detecta que uma confirmação está atrasada em relação ao horário da atividade, alerta sem ser perguntada
- Quando o multi-horizonte mostra risco elevado, menciona no briefing de abertura
- Quando uma resolução de exceção criou cascata em outra atividade, alerta imediatamente

---

## 12. Relação com notificações — S-02

| Tipo de notificação | Comportamento ao tocar |
|---|---|
| Nova exceção crítica | **Abre S-04 diretamente na exceção**, não o Painel — urgência máxima exige ação imediata |
| Nova solicitação | Abre Painel com Indicador de Solicitações em destaque |
| Membro não confirmou (alerta proativo) | Abre Painel com Rastreador de Confirmações em estado crítico |
| Risco futuro identificado pela IA | Abre Painel com Multi-horizonte expandido |

**Regra de exceção:** notificações críticas aterrissam **na superfície de ação** (S-04), não no Painel. O Painel recebe de volta o Supervisor após a ação resolvida. Isso preserva o fluxo de urgência — o Painel é destino de diagnóstico e monitoramento, não de resolução imediata.

---

## 13. Relação com Histórico — S-02

O Painel conecta ao Histórico via "Ver histórico de hoje" (ação secundária). O Supervisor raramente precisa do Histórico no fluxo diário — mas quando precisa entender o que aconteceu antes de agir, o acesso precisa ser direto e contextualizado.

---

## 14. Relação com outras superfícies — S-02

| Superfície | Relação |
|---|---|
| **S-04 Escala** | Destino principal de ação. "Resolver exceção" → S-04. O Painel diagnostica; a Escala resolve. |
| **S-06 Solicitações** | Destino para análise de folgas e pedidos. O Painel exibe apenas o sinal. |
| **S-05 Livro do Dia** | Acesso rápido quando Livro não foi gerado para data próxima. |
| **S-08 Avisos** | Criação de aviso a partir de uma ação de comunicação. |
| **S-11 Histórico** | Acesso contextual para investigar o que aconteceu antes de uma exceção. |
| **S-10 IA** | Embarcada no Painel. Chat dedicado via expansão para análises mais profundas. |

---

---

# S-04 — ESCALA
**Perfil:** Supervisor (construção/publicação), Admin (visibilidade/publicação) | **Classificação:** Primária | **Frequência:** Diária

---

## 1. Objetivo principal

Ser a **representação oficial e a ferramenta de ação** para a gestão de quem faz o quê e quando em cada Operação.

A Escala responde e permite agir sobre:
- *"Quem eu tenho disponível hoje?"*
- *"Quais posições estão cobertas, em risco, em aberto?"*
- *"Posso publicar ou ainda tenho posições críticas não resolvidas?"*
- *"Esta substituição cria cascata em outra atividade?"*

A Escala é a **fonte de verdade** que alimenta o Meu Dia, o Livro do Dia e o Painel Operacional. Toda ação confirmada na Escala tem consequências reais e imediatas em outras superfícies.

---

## 2. Estado mental do usuário ao entrar

O Supervisor entra na Escala em dois modos distintos:

| Modo | Contexto | O que precisa |
|---|---|---|
| **Construção planejada** | Preparando o dia com antecedência | Visão completa das posições, candidatos disponíveis, ferramentas de alocação |
| **Resposta a exceção** | Veio do Painel após uma exceção crítica | A exceção já visível e pré-selecionada. Candidatos já calculados. Tempo mínimo até a decisão. |

**Estado mental dominante em construção:** concentração sistemática. O Supervisor revisa posição por posição, identifica problemas, resolve.

**Estado mental dominante em exceção:** urgência controlada. O Supervisor confia que o sistema já fez a triagem — ele só precisa decidir e confirmar.

**O que o Supervisor nunca quer na Escala:** lista plana de membros sem contexto de risco. A Escala que apresenta "João, Maria, Carlos disponíveis" sem classificar por aptidão, restrição e cascata é uma Escala que transfere trabalho mental para o Supervisor — e esse é o trabalho que o MyASA deve eliminar.

---

## 3. Hierarquia de informação

### Hierarquia quando acessada via exceção do Painel (modo urgência)

```
1. [Exceção pré-carregada em destaque]
   └── Qual atividade está afetada
   └── Horário de início (com contagem regressiva se < 2h)
   └── Qual posição está descoberta

2. Candidatos classificados por risco (4 camadas já calculadas)
   └── Candidato 1 (recomendado): [nome] · risco: baixo
   └── Candidato 2: [nome] · risco: moderado · por quê?
   └── Candidato N: [nome] · risco: alto · por quê?

3. Simulação de cascata para o candidato selecionado

4. Confirmação da substituição

5. [Retorno ao estado geral da Escala pós-resolução]
```

### Hierarquia no modo construção planejada

```
1. Seletor de data / navegação temporal

2. Resumo de cobertura da data selecionada
   └── [N] posições cobertas · [N] em risco · [N] em aberto

3. Lista de atividades do dia com status por posição

4. Detalhamento de posições [por atividade selecionada]
   └── Posição 1: [nome] · status · folga/restrição?
   └── Posição 2: ...

5. Alertas de validação
   └── Conflitos de horário detectados
   └── Posições críticas ainda em aberto

6. Ação de publicar (sempre visível, com estado)
```

---

## 4. Seções obrigatórias

### 4.1 — Navegação Temporal (Seletor de Data)

**Função:** permite ao Supervisor trabalhar em qualquer data — hoje, amanhã, próxima semana, data de um show específico.

**Exibição padrão:** data atual selecionada.

**Visualizações disponíveis:**
- **Dia específico** (padrão) — visão detalhada de uma data
- **Semana** (secundária) — visão de cobertura por dia, para identificar dias críticos rapidamente

**Indicadores na navegação temporal:**
- Datas com shows: marcador de show
- Datas com risco identificado: indicador de atenção
- Datas com Escala publicada: indicador de publicado
- Datas com Escala não publicada com show próximo: indicador de urgência

---

### 4.2 — Resumo de Cobertura da Data

**Posicionamento:** topo da visão da data selecionada.

**Conteúdo:**
- Número de posições cobertas (status: OK)
- Número de posições em risco (cobertura disponível mas não ideal)
- Número de posições em aberto (sem cobertura definida)
- Status de publicação: Publicada / Rascunho / Não gerada

**Comportamento:** ao tocar em uma categoria (ex.: "3 em aberto"), filtra a lista abaixo para mostrar apenas aquelas posições.

---

### 4.3 — Lista de Atividades com Status de Cobertura

**Conteúdo:** todas as atividades do dia (shows, ensaios, aulas, reuniões) com um indicador de status de cobertura.

**Por atividade:**
- Nome + tipo + horário de início e término
- Status de cobertura resumido: Completa / Parcial / Crítica
- Número de posições por status: "[N] cobertas · [N] em risco · [N] em aberto"

**Comportamento:** ao tocar em uma atividade, expande para o detalhamento de posições (seção 4.4).

**Ordenação:** cronológica por horário de início. Atividades com posições críticas ganham indicador de urgência.

---

### 4.4 — Detalhamento de Posições por Atividade

**Ativado ao tocar em uma atividade.**

**Conteúdo de cada posição:**
- Nome da posição / papel (ex.: Astrid, Bloco 3, Posição 7)
- Membro alocado (nome + foto de perfil)
- Status da alocação:
  - **Confirmado** — alocação normal, sem pendências
  - **Com restrição ativa** — membro alocado mas tem restrição; indicador de tipo e data de revisão
  - **Em risco** — membro alocado mas com sinais de fragilidade (ex.: única pessoa disponível)
  - **Em aberto** — nenhum membro alocado ainda
  - **Folga aprovada** — membro tem folga nesta data; posição descoberta
- Histórico da posição (expansível): quem esteve alocado aqui antes

**Posição em aberto — fluxo de resolução inline:**
1. Toque em "Resolver" (ou em posição em aberto)
2. Sistema exibe candidatos classificados por risco (seção 4.5)
3. Supervisor escolhe candidato
4. Sistema exibe simulação de cascata (seção 4.6)
5. Supervisor confirma
6. Posição atualizada

---

### 4.5 — Candidatos Classificados por Risco

**Ativado ao resolver uma posição em aberto ou substituir um membro.**

**As 4 camadas de classificação (filtros sequenciais):**

**Camada 1 — Eliminatória (não negocia):**
- Disponível na data/horário
- Sem folga aprovada que conflite
- Sem restrição que impeça esta posição
- Sem conflito de horário com outra atividade

**Camada 2 — Artística:**
- Conhece o papel (já atuou antes como titular ou substituto)
- Nível de familiaridade: titular / substituto habitual / eventual / sem histórico

**Camada 3 — Operacional:**
- A troca não gera conflito de horário em outras atividades
- A troca não deixa outra posição descoberta

**Camada 4 — Segurança:**
- Sem risco físico para esta posição
- Qualidade mantida (sem degradação de cobertura)

**Exibição dos candidatos:**
- Ordenados do menor para o maior risco total
- Por candidato: nome + classificação de risco + motivo ("baixo risco: titular de Astrid, sem conflitos") ou motivo de risco ("risco moderado: nunca atuou como titular, apenas como observador")
- Candidatos que passam na Camada 1 mas falham nas demais: exibidos com aviso claro ("disponível, mas sem histórico neste papel")
- Candidatos que falham na Camada 1: não exibidos (eliminados antes de aparecer)

**Candidatos recomendados pela IA:** o primeiro da lista vem com recomendação explícita da IA e raciocínio exposto.

---

### 4.6 — Simulação de Cascata

**Ativada ao selecionar um candidato antes de confirmar.**

**Conteúdo:**
- Quais posições este candidato já ocupa no dia
- Se ele for movido: quais dessas posições ficam descobertas
- Impacto líquido: "Resolve Astrid no Show das 12h30, mas deixa Bloco 3 do Ensaio das 14h descoberto"
- Recomendação da IA: "Vale a troca? Bloco 3 tem cobertura disponível — recomendo" ou "Não recomendo: Bloco 3 ficaria sem cobertura e é uma posição crítica"

**Decisão do Supervisor:** pode confirmar mesmo com cascata, com ciência do impacto.

**Após confirmação:** sistema registra no Histórico a decisão com o raciocínio documentado.

---

### 4.7 — Painel de Validação

**Posicionamento:** persistente na parte inferior da Escala, sempre visível.

**Conteúdo:**
- Número de posições ainda em aberto
- Número de conflitos de horário detectados (membros alocados em duas atividades sobrepostas)
- Número de alertas de restrição ativa em posições críticas
- Status de publicação: "Pronta para publicar" / "Há [N] problemas pendentes"

**O painel de validação não bloqueia a publicação.** O Supervisor pode publicar mesmo com alertas. O sistema exige confirmação explícita: "Publicar com [N] posições em aberto?" — decisão consciente, não bloqueio.

---

### 4.8 — Ação de Publicar

**Sempre visível** — não exige scroll para encontrar.

**Estados da ação:**
- **Pronta para publicar:** destaque máximo, sem restrição
- **Publicar com alertas:** destaque moderado + contagem de alertas + confirmação explícita
- **Já publicada:** estado diferente — "Republicar com alterações"

**O que acontece ao publicar:**
1. Sistema executa validações finais
2. Exibe resumo: "Publicando para [N] membros · [N] posições cobertas · [N] alertas mantidos"
3. Supervisor confirma
4. Escala publicada → Meu Dia de todos os afetados atualizado automaticamente
5. Notificações disparadas para membros afetados
6. Registro no Histórico

---

## 5. Seções secundárias

### 5.1 — Histórico de Publicações

**Conteúdo:** lista de publicações anteriores para a data selecionada:
- Quando foi publicada
- Quem publicou
- O que mudou nesta versão (diff resumido)

**Acesso:** expansível dentro da Escala. Link para S-11 (Histórico) para versão completa.

---

### 5.2 — Visão por Membro (alternativa à visão por Atividade)

**Função:** permite ao Supervisor ver as alocações de um membro específico ao longo do dia — útil para detectar sobrecarga ou para planejar substituições.

**Conteúdo por membro:**
- Todas as posições que o membro ocupa no dia
- Status de cada posição (titular / substituto / em risco)
- Restrições ativas
- Folgas aprovadas nas próximas datas

**Acesso:** toggle de visão na Escala ("Por atividade" / "Por membro").

---

### 5.3 — Filtro de Grupo Operacional

**Disponível para:** Supervisor (vê apenas seu Grupo por padrão) e Admin (vê todos os Grupos, pode filtrar).

**Para o Supervisor:** a Escala exibe por padrão apenas o seu Grupo. Pode ver outros Grupos em modo de leitura quando necessário para entender disponibilidade cruzada.

**Para o Admin:** pode visualizar qualquer combinação de Grupos. Publicação ainda respeita escopos.

---

## 6. Ações principais

| Ação | Onde aparece | O que faz |
|---|---|---|
| **Alocar membro em posição** | Posição em aberto | Abre fluxo de candidatos classificados |
| **Substituir membro em posição** | Posição com membro alocado | Abre fluxo de candidatos com simulação de cascata |
| **Publicar Escala** | Painel de Validação + Ação de Publicar | Publica, atualiza Meu Dia, dispara notificações |
| **Republicar Escala** | Após alteração em Escala já publicada | Fluxo de confirmação com diff das alterações |
| **Resolver exceção** | Posição crítica em aberto (via Painel) | Fluxo acelerado com contexto pré-carregado |

---

## 7. Ações secundárias

| Ação | Onde aparece | O que faz |
|---|---|---|
| **Gerar Livro do Dia** | Ação da Escala para data selecionada | Abre S-05 com proposta gerada automaticamente |
| **Ver histórico de publicações** | Seção de Histórico | Expande histórico da data / link para S-11 |
| **Trocar visão** | Toggle | Alterna entre visão por atividade e por membro |
| **Filtrar por Grupo** | Filtro | Filtra Escala por Grupo Operacional |
| **Ver Livro do Dia** | Ação da Escala | Abre S-05 para a data selecionada |

---

## 8. Estados vazios

### 8.1 — Data sem atividades

*"Nenhuma atividade programada para [data]."*
Ação disponível: "Ver próxima data com show" — navega para a data mais próxima com atividades.

### 8.2 — Escala não iniciada para data com show

*"A Escala de [data] ainda não foi iniciada. O show [nome] está agendado para este dia."*
Ação: "Gerar Livro do Dia" → cria proposta automática a partir do Livro do Show.

### 8.3 — Posição sem candidatos disponíveis

*"Não há candidatos disponíveis para esta posição em [data]. Todos os membros habilitados têm folga ou conflito."*
IA: analisa se existe alguma alternativa de ajuste (troca de posição, redução de escopo, contato com Admin).

---

## 9. Estados de atenção

| Situação | Indicador |
|---|---|
| Posição em risco (cobertura disponível mas não ideal) | Indicador amarelo na posição + tooltip com o risco específico |
| Candidato com risco moderado selecionado | Aviso no fluxo de confirmação com o motivo |
| Membro com restrição ativa alocado em posição que ela afeta | Indicador na posição com detalhes da restrição |
| Folgas acumuladas na mesma data com cobertura no limite | Alerta no Resumo de Cobertura da Data |
| Escala não publicada com show em menos de 4h | Alerta persistente no Painel de Validação |

---

## 10. Estados críticos

| Situação | Comportamento |
|---|---|
| Posição crítica em aberto com show em menos de 1h | Posição em destaque máximo + notificação push se Supervisor não está na Escala |
| Conflito de horário detectado após alocação | Alerta imediato com identificação dos dois conflitos + opção de desfazer |
| Publicação com posição crítica em aberto | Confirmação explícita obrigatória: "Há [N] posições críticas em aberto. Publicar assim mesmo?" |
| Cascata criada por substituição que deixa posição crítica descoberta | Alerta antes da confirmação + simulação do impacto + recomendação da IA |

---

## 11. Integração da IA — S-04

### Modo embarcado na Escala

A IA da Escala é a mais operacional do sistema. Não narra — calcula, classifica e simula.

**Classificação automática de candidatos:** ao abrir o fluxo de resolução de posição, a IA já calculou as 4 camadas de risco e ordenou os candidatos. O Supervisor recebe uma lista estruturada, não uma lista plana.

**Simulação de cascata:** ao selecionar um candidato, a IA simula o impacto em tempo real — antes da confirmação.

**Detecção de acúmulo invisível:** a IA alerta quando múltiplas folgas aprovadas em datas separadas criam um risco acumulado que não é evidente analisando cada uma individualmente.

**Proposta de Livro do Dia:** quando o Supervisor solicita geração do Livro do Dia, a IA gera a proposta considerando Livro do Show + Folgas + Restrições + Disponibilidade. Apresenta a proposta com destaque nos pontos de atenção — não como uma lista completa de tudo que está OK.

**Perguntas típicas na Escala:**
- *"Quem pode substituir Amanda no Musical das 14h?"*
- *"Se eu mover Bruno para Astrid, o que acontece com o Bloco 3?"*
- *"Quantas folgas estão aprovadas para sábado?"*
- *"A cobertura do show de amanhã está completa?"*
- *"Qual é o risco de publicar agora com 2 posições em aberto?"*

---

## 12. Relação com notificações — S-04

| Tipo de notificação | Comportamento ao tocar |
|---|---|
| Exceção crítica (no-show, restrição emergencial) | Abre S-04 diretamente na posição afetada, com fluxo de candidatos pré-carregado |
| Conflito detectado pós-publicação | Abre S-04 com alerta de conflito em destaque |
| Cancelamento de show | Abre S-04 com pergunta: "Impactar Escala?" e preview do impacto |

**Regra:** a S-04 é a superfície de ação — recebe notificações que exigem ação imediata na Escala. O Painel recebe notificações de monitoramento.

---

## 13. Relação com Histórico — S-04

Cada ação confirmada na Escala gera registro automático no Histórico:
- Quem alocou / realocou / removeu
- Qual posição, qual atividade, qual data
- Qual era o estado anterior
- Se a ação foi sugerida pela IA ou tomada manualmente

O Supervisor pode acessar o Histórico de publicações diretamente da Escala (seção 5.1). Para investigação profunda, acessa S-11.

---

## 14. Relação com outras superfícies — S-04

| Superfície | Relação |
|---|---|
| **S-01 Meu Dia** | A Escala alimenta o Meu Dia. Toda publicação atualiza automaticamente a fatia individual de cada Membro afetado. |
| **S-05 Livro do Dia** | A Escala é a base do Livro do Dia. A geração do Livro usa o estado atual da Escala como ponto de partida. |
| **S-02 Painel Operacional** | O Painel diagnóstica; a Escala resolve. Exceções do Painel abrem a Escala com contexto pré-carregado. |
| **S-06 Solicitações** | Solicitações de folga aprovadas atualizam automaticamente a Escala (membro marcado como ausente na data). |
| **S-12 Agenda** | A Agenda alimenta a Escala com eventos de impacto operacional (shows, ensaios, aulas confirmados). |
| **S-13 Livro do Show** | O Livro do Show fornece a estrutura base (posições, papéis) para a geração automática do Livro do Dia. |
| **S-11 Histórico** | Toda ação na Escala gera registro no Histórico. |

---

---

# VALIDAÇÃO DO BLOCO 1

---

## Coerência com as Pesquisas

### Supervisor

| Descoberta | Como S-02 e S-04 respondem |
|---|---|
| D1: precisa de status → impacto → recomendação → cascata | S-02: status é o primeiro elemento. S-04: candidatos classificados + cascata inline. |
| D2: exceções surgem inesperadamente, qualquer hora | S-02: notificação de exceção crítica → S-04 direto. Sem fricção de navegação. |
| D5: cascata invisível é o maior risco | S-04: simulação de cascata obrigatória antes de qualquer confirmação de substituição. |
| D6: confirmação ≠ ciência | S-02: Rastreador de Confirmações separado do "notificado". |
| D7: folgas aprovadas individualmente que juntas causam problema | S-04: IA detecta acúmulo. S-02: indicador de risco cumulativo no multi-horizonte. |
| D9: multi-horizonte sem trocar de tela | S-02: Multi-horizonte inline, expansível. |

### Membro

| Descoberta | Como S-01 responde |
|---|---|
| D1: segurança antes de informação | Card de Próxima Atividade é o primeiro elemento pós-alteração (quando não há alteração). |
| D2: mudanças são mais importantes que programação estável | Bloco de Alteração ocupa o topo absoluto quando existe. Não pode ser ignorado. |
| D3: limbo = silêncio sem significado | Meu Dia sempre comunica o estado — incluindo "está tudo bem, sem novidades". |
| D9: confiança vem de consistência | Estrutura do Meu Dia é a mesma sempre. O Membro sabe onde olhar sem aprender de novo. |
| D10: histórico como prova | Confirmações registradas e acessíveis via S-11. |

---

## Coerência com as Jornadas

| Jornada | Superfície principal | Validação |
|---|---|---|
| JM-01 (Abertura do Dia) | S-01 | ✅ Abertura = Meu Dia. Status imediato. Hierarquia dinâmica. |
| JM-02 (Descoberta de Mudança) | S-01 | ✅ Bloco de Alteração + confirmação sem troca de superfície. |
| JS-01 (Início do Dia Operacional) | S-02 | ✅ Status em 10s. Exceções priorizadas. Multi-horizonte inline. |
| JS-02 (Análise de Folga) | S-02 → S-06 | ✅ Indicador de Solicitações no Painel → análise em S-06. |
| JS-03 (Substituição Emergencial) | S-02 → S-04 | ✅ Notificação → S-04 direto. Candidatos + cascata inline. |
| JS-04 (Geração e Publicação do Livro do Dia) | S-04 → S-05 | ✅ Fluxo natural dentro de S-04 → geração de Livro do Dia. |
| JS-05 (Comunicação Pós-Alteração) | S-02 | ✅ Rastreador de Confirmações no Painel. Renotificar sem sair. |
| JS-08 (Múltiplas Exceções) | S-02 → S-04 | ✅ Priorização explícita da IA. Resolve um por vez sem perder o fio. |

---

## Coerência com a Arquitetura de Navegação

| Princípio de navegação | Respeitado? |
|---|---|
| Frequência de uso determina posição | ✅ Bloco de Alteração (evento mais importante) → topo. Histórico → acesso via link, nunca topo. |
| A home não é um menu | ✅ Meu Dia = estado atual. Painel = diagnóstico. Não são menus. |
| Notificação leva à superfície de ação | ✅ Exceção crítica → S-04 (ação). Monitoramento → S-02 (diagnóstico). |
| IA embarcada nas superfícies centrais | ✅ IA em S-01, S-02 e S-04 como elemento primário, não aba isolada. |
| Profundidade máxima de 3 níveis | ✅ Nenhuma ação crítica exige mais de 3 toques a partir da home. |
| S-04 = diagnóstico + ação, S-02 = diagnóstico | ✅ Painel diagnostica, Escala resolve. Distinção preservada. |

---

## Coerência com a Identidade do MyASA

| Princípio de identidade | Como as 3 superfícies honram |
|---|---|
| Não parecer ERP | S-01: card, não tabela. S-02: status + exceções, não lista de campos. S-04: posições por atividade, não planilha de alocação. |
| Informação mais importante primeiro | ✅ Hierarquia dinâmica em todas as 3 superfícies. |
| Clareza acima de densidade | ✅ Seções secundárias contraídas por padrão. Expandem sob demanda. |
| Simples em dias caóticos | ✅ Fluxo de substituição emergencial em 4 toques. Confirmação de alteração sem troca de superfície. |
| Leveza, profundidade e clareza (identidade da asa) | ✅ Superfícies com resposta imediata ao estado mais urgente, profundidade acessível mas não imposta. |
| IA integrada ao contexto | ✅ IA nas 3 superfícies como elemento ativo, não como destino separado. |

---

## Achados da Validação

### ✅ Aprovado

As três especificações funcionais estão:
- Fundamentadas nas 30 descobertas de pesquisa (30 verificadas)
- Alinhadas com todas as jornadas do Bloco 1 (8 jornadas verificadas)
- Coerentes com a Arquitetura de Navegação (6 princípios verificados)
- Fiéis à identidade do produto (6 princípios verificados)

### 🟡 Decisões de design a honrar na interface

**D1 — Bloco de Alteração (S-01):** o visual do Bloco de Alteração deve ser inconfundível — o Membro não pode confundi-lo com um aviso comum ou uma notificação. A ação de "Confirmar" deve ser o elemento mais saliente do bloco. Design deve garantir que o Membro sabe que precisa agir, não apenas ler.

**D2 — Status da Operação (S-02):** o Indicador de Status deve ser percebido em menos de 2 segundos sem leitura de texto. Cor, tamanho e posição precisam trabalhar juntos. Um Supervisor que acaba de abrir o app deve saber o estado da operação pela percepção periférica — antes de focar ativamente.

**D3 — Candidatos na Escala (S-04):** a distinção entre Candidato Recomendado, Candidato com Risco Moderado e Candidato com Risco Alto deve ser visual e imediata. O Supervisor não deve precisar ler os detalhes de todos para escolher — a hierarquia visual deve conduzir para a escolha de menor risco naturalmente.

**D4 — Cascata (S-04):** a simulação de cascata deve usar linguagem operacional, não técnica. "Se você mover Bruno para Astrid, o Bloco 3 do Ensaio das 14h fica descoberto. Beatriz pode cobrir." — não uma tabela de conflitos.

**D5 — IA em modo urgência (S-04):** quando o Supervisor chega à Escala via notificação crítica de exceção, a IA deve ter os candidatos já calculados e a recomendação já pronta — não pode haver delay de cálculo. A IA deve parecer que já estava esperando o Supervisor.

---

## Veredicto

**As especificações funcionais de S-01, S-02 e S-04 estão aprovadas para servir de base ao Design Visual.**

A fundação está definida. As hierarquias, seções, ações, estados e integrações estão especificadas com profundidade suficiente para guiar decisões de design sem pré-determinar escolhas visuais.

---

*Próximo passo: Design Visual do Bloco 1 — S-01, S-02 e S-04*
*Bloco 2 em seguida: S-05 Livro do Dia · S-08 Avisos · S-09 Mensagens · S-06 Solicitações*
