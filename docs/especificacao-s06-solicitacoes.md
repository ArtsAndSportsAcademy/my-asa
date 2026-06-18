# S-06 SOLICITAÇÕES — Especificação Funcional Completa
## MyASA 2.0 — Bloco 2

> **Versão:** 17/06/2026
> **Fase:** Especificação Funcional — anterior a wireframes e componentes de interface
> **Status:** Pronto para revisão com Product Owner antes do design de interface
> **Princípio fundador:** *"O pior não é ouvir não. O pior é não saber se alguém viu."*

---

## PARTE 1 — VISÃO GERAL E POSICIONAMENTO

---

### 1.1 O que é S-06

S-06 Solicitações é o canal formal de pedidos estruturados entre Membro e Supervisor dentro do MyASA. Substitui conversas informais — via WhatsApp, presencialmente, por recado — que hoje acontecem sem rastreamento, sem estado visível e sem histórico recuperável.

**S-06 não é um formulário.** É um processo com estado. A diferença é fundamental: um formulário termina no envio. Um processo continua — e o Membro sabe exatamente em que ponto ele está.

---

### 1.2 Decisão arquitetural de base

S-06 é **uma única superfície** com três visões distintas por perfil, **não três superfícies separadas**. Essa decisão foi tomada e registrada na Auditoria de Consistência Final (Q6) por duas razões:

1. Os dados são compartilhados — a mesma Solicitação vive no centro, vista de ângulos diferentes por cada perfil
2. Separar superfícies criaria fragmentação artificial onde não existe separação funcional real

| Perfil | Papel em S-06 | Pergunta central |
|---|---|---|
| **Membro** | Requerente | *"Em que estado está minha solicitação? Preciso fazer algo?"* |
| **Supervisor** | Aprovador | *"Existe alguma solicitação que preciso analisar agora? Qual é o impacto operacional?"* |
| **Admin** | Monitor | *"Existe acumulação ou padrão que indica problema sistêmico?"* |

---

### 1.3 Frequência de uso e posição na navegação

**Frequência:** Semanal (1–3 solicitações por semana por Membro; análises em lote pelo Supervisor)

**Posição na navegação — Membro:** Nav permanente (Camada 1)
```
[ Meu Dia ] [ Solicitações ] [ Entregas ] [ Mensagens ]
```
S-06 está na barra de navegação permanente do Membro porque é o canal de criação de pedidos formais e de acompanhamento de estado — uso recorrente o suficiente para merecer acesso de um toque.

**Posição na navegação — Supervisor:** Camada 2 (contextual). O Supervisor acessa S-06 a partir do Painel Operacional, onde as solicitações pendentes aparecem como item de atenção. Acesso direto também disponível via nav secundária.

**Posição na navegação — Admin:** Camada 3 (profunda). O Admin acessa dados de Solicitações como indicador dentro do Painel Administrativo (S-03), não como destino primário. Acesso direto via nav profunda para investigação quando necessário.

---

### 1.4 O problema que S-06 existe para resolver

A pesquisa de usuário identificou que o **silêncio após o envio** de uma solicitação é a experiência mais corrosiva para a confiança do Membro no sistema operacional. Não é a negativa — é o vácuo.

O Membro envia. E então não sabe se:
- A solicitação chegou
- O Supervisor viu
- Está sendo analisada
- Foi esquecida
- Uma resposta está chegando

Esse silêncio sem significado (D3 — Pesquisa de Membro) foi a motivação principal para o design de S-06 como **processo com estado visível em tempo real**, não como formulário de envio.

---

## PARTE 2 — TIPOS DE SOLICITAÇÃO

---

### 2.1 Catálogo oficial de tipos

Oito tipos oficiais definidos na arquitetura do sistema. Cada tipo tem características, campos obrigatórios e fluxos de decisão distintos.

---

#### TIPO 1 — Solicitação de Folga

**O que é:** Pedido formal de ausência completa em uma ou mais datas específicas.

**Quando usar:** Membro não estará disponível para nenhuma atividade em determinado dia ou período.

**Campos obrigatórios do Membro:**
- Data(s) solicitadas
- Motivo (texto livre, campo obrigatório — mas não validado: qualquer texto é aceito)

**Campos opcionais:**
- Observação adicional (ex: posso fazer show da manhã, mas não o da tarde)

**Impacto operacional:** Alto. O sistema calcula automaticamente todas as atividades afetadas antes de apresentar opções de decisão ao Supervisor.

**Análise automática que o sistema deve fornecer ao Supervisor:**
- Quais atividades da data solicitada esse Membro cobre
- Quais papéis são exclusivos (sem substituto disponível)
- Quais papéis têm alternativa disponível (e quem são os candidatos)
- Acumulado de folgas já aprovadas para as mesmas datas no mesmo grupo
- Percentual de cobertura do grupo se esta folga for aprovada

**Opções de decisão do Supervisor:** Aprovar / Negar (motivo obrigatório) / Propor data alternativa

---

#### TIPO 2 — Troca de Folga

**O que é:** Pedido de trocar uma folga já agendada por outra data — geralmente porque o Membro precisa trabalhar na data da folga original e folgar em outro dia.

**Quando usar:** Membro tem folga programada na data X e prefere trabalhar nela, folga na data Y.

**Campos obrigatórios do Membro:**
- Data da folga original (que deseja trabalhar)
- Data alternativa proposta (onde deseja folgar)
- Motivo

**Impacto operacional:** Médio. O sistema valida as duas datas — a original e a alternativa — para verificar cobertura em ambas.

**Opções de decisão do Supervisor:** Aprovar / Negar (motivo obrigatório) / Propor combinação alternativa

---

#### TIPO 3 — Solicitação Excepcional

**O que é:** Pedido que não se enquadra nas categorias padronizadas. Requer avaliação case-by-case pelo Supervisor.

**Quando usar:** Situações incomuns que precisam de análise individualizada — ex: participar de um evento externo numa data de trabalho, necessidade de saída emergencial não programada, pedido de reposição especial.

**Campos obrigatórios do Membro:**
- Descrição da exceção (texto livre com mínimo de caracteres — o suficiente para o Supervisor entender o pedido sem precisar pedir mais informações)
- Data(s) impactadas

**Campos opcionais:**
- Proposta de compensação ou alternativa pelo próprio Membro

**Análise automática:** Limitada — o sistema verifica apenas disponibilidade e cobertura básica nas datas indicadas. A decisão depende da análise qualitativa do Supervisor.

**Opções de decisão do Supervisor:** Aprovar / Negar (motivo obrigatório) / Solicitar mais informação / Propor alternativa

**Nota:** Este é o único tipo que inclui o estado intermediário "Aguardando informação do Membro" como estado de decisão ativa.

---

#### TIPO 4 — Solicitação de Restrição

**O que é:** Comunicação formal de uma limitação de disponibilidade ou capacidade física/médica/técnica que afeta a escala por um período.

**Quando usar:** Membro tem uma limitação que impede ou condiciona determinados papéis ou atividades. Exemplos: lesão que impede elementos de risco, impossibilidade de trabalhar em determinados horários por período determinado, limitação técnica específica.

**Campos obrigatórios do Membro:**
- Tipo de restrição: Médica / Operacional / Física / Técnica
- Descrição da limitação
- Data de início
- Data de término (ou "indefinido")
- Data de revisão (opcional — quando a condição pode mudar)

**Impacto operacional:** Variável e duradouro. Uma restrição ativa afeta todas as escalas futuras enquanto estiver vigente. O sistema deve aplicar a restrição automaticamente nas gerações de Escala e Livro do Dia após aprovação.

**Decisão do Supervisor:** Registrar como aprovado (reconhecer a restrição) / Solicitar documento de suporte / Negar (com motivo — raro, mas possível em contextos operacionais)

**Nota arquitetural:** Restrições aprovadas alimentam diretamente o motor de candidatos da Escala (S-04), impactando a camada eliminatória da hierarquia de 4 camadas de candidatos.

---

#### TIPO 5 — Solicitação de Ajuste de Escala

**O que é:** Pedido do Membro para que sua posição em uma atividade específica seja revisada — troca de papel, troca de horário de entrada, ou qualquer modificação pontual na escala já publicada.

**Quando usar:** Membro identificou um erro, tem uma sugestão fundamentada, ou precisa de uma mudança específica em sua posição numa atividade já definida.

**Campos obrigatórios do Membro:**
- Atividade específica (qual show/ensaio/evento)
- O que está publicado atualmente para ele
- O que solicita que seja alterado
- Motivo

**Impacto operacional:** Específico e imediato. O sistema verifica impacto apenas na atividade indicada e nas posições interdependentes.

**Decisão do Supervisor:** Aprovar (e alterar a Escala automaticamente) / Negar (com motivo) / Aprovar parcialmente com modificação

---

#### TIPO 6 — Solicitação de Saída Antecipada

**O que é:** Pedido para encerrar a jornada de trabalho antes do horário previsto na data indicada.

**Quando usar:** Membro precisa sair antes do fim do horário previsto por motivo pessoal ou profissional.

**Campos obrigatórios do Membro:**
- Data
- Horário de saída solicitado (vs. horário previsto — o sistema preenche o horário previsto automaticamente)
- Motivo

**Impacto operacional:** Baixo a médio. O sistema verifica se o Membro tem atividades previstas após o horário de saída solicitado.

**Decisão do Supervisor:** Aprovar / Negar (com motivo) / Aprovar com ajuste de horário

---

#### TIPO 7 — Solicitação de Chegada Tardia

**O que é:** Pedido para iniciar a jornada mais tarde que o horário previsto na data indicada.

**Quando usar:** Membro não consegue chegar no horário previsto por motivo específico.

**Campos obrigatórios do Membro:**
- Data
- Horário de chegada previsto (preenchido automaticamente pelo sistema)
- Horário de chegada solicitado
- Motivo

**Impacto operacional:** Variável. O sistema verifica se o Membro tem atividades previstas entre o horário original e o solicitado — incluindo preparação, ensaios parciais, calls.

**Decisão do Supervisor:** Aprovar / Negar (com motivo) / Aprovar com horário alternativo

---

#### TIPO 8 — Solicitação Administrativa

**O que é:** Canal para pedidos de natureza administrativa não operacional — atualização de dados cadastrais, solicitação de documentos, pedidos relacionados a pagamentos, benefícios, informações de contrato.

**Quando usar:** Pedido que não afeta a escala ou a operação diretamente.

**Campos obrigatórios do Membro:**
- Descrição do pedido
- Urgência percebida (Baixa / Normal / Alta) — informativa, não vinculante

**Impacto operacional:** Nenhum. O sistema não executa análise de impacto de escala.

**Decisão do Supervisor:** Resolver / Encaminhar para Admin / Negar (com motivo)

**Nota:** Solicitações Administrativas podem ser encaminhadas ao Admin pelo Supervisor quando o assunto ultrapassa seu escopo de decisão.

---

### 2.2 Linguagem para o Membro

Os tipos oficiais têm nomes técnicos para o sistema. Para o Membro, a interface deve apresentar linguagem compreensível:

| Nome técnico | Como aparece para o Membro |
|---|---|
| Solicitação de Folga | Pedir folga |
| Troca de Folga | Trocar minha folga |
| Solicitação Excepcional | Pedir algo diferente |
| Solicitação de Restrição | Reportar uma limitação |
| Solicitação de Ajuste de Escala | Corrigir ou ajustar minha escala |
| Solicitação de Saída Antecipada | Pedir saída antecipada |
| Solicitação de Chegada Tardia | Pedir chegada tardia |
| Solicitação Administrativa | Pedido administrativo |

**Regra:** Em nenhum ponto da interface do Membro devem aparecer os nomes técnicos como identificadores primários. O nome amigável é o rótulo. O tipo técnico é metadado.

---

### 2.3 Frequência esperada por tipo

Por frequência de uso, da mais frequente para a menos frequente:

1. **Solicitação de Folga** — núcleo funcional de S-06, maior volume
2. **Solicitação de Restrição** — frequência sazonal mas impacto duradouro
3. **Solicitação de Chegada Tardia / Saída Antecipada** — frequentes, geralmente de baixo impacto
4. **Troca de Folga** — menos frequente que folga simples
5. **Solicitação de Ajuste de Escala** — pontual, reativa a publicação
6. **Solicitação Excepcional** — esporádica
7. **Solicitação Administrativa** — independente do calendário operacional

---

## PARTE 3 — ESTADOS E CICLO DE VIDA

---

### 3.1 Estados oficiais de uma Solicitação

Toda Solicitação passa por estados claramente definidos. O estado é sempre visível para o Membro **sem precisar abrir o item** — esta é uma regra inegociável de S-06.

```
ENVIADA
   │
   ▼
EM ANÁLISE ────────────────────────────────────────────────┐
   │                                                        │
   ├──► AGUARDANDO INFORMAÇÃO DO MEMBRO ────────────────────┤
   │         (Membro responde → volta a EM ANÁLISE)         │
   │                                                        │
   ├──► APROVADA ──────────────────────────────────────── [FIM]
   │                                                        │
   ├──► NEGADA (motivo obrigatório) ───────────────────── [FIM]
   │                                                        │
   └──► PROPOSTA ALTERNATIVA                                │
             │
             ├──► Membro aceita → APROVADA (nova versão)
             ├──► Membro recusa → NEGADA (motivo visível)
             └──► Membro contra-propõe → volta a EM ANÁLISE

CANCELADA (pelo Membro, antes de decisão) ──────────────── [FIM]
```

---

### 3.2 Definição detalhada de cada estado

**ENVIADA**
- O que significa: Solicitação recebida pelo sistema. Supervisor ainda não a visualizou ou ainda não iniciou análise.
- O que o Membro vê: "Enviada — aguardando análise"
- O que o Membro sabe: para quem foi encaminhada (nome do Supervisor), data e hora do envio
- Tempo máximo esperado sem transição: 24h úteis. Após isso, o sistema sinaliza silêncio prolongado para o Admin.

**EM ANÁLISE**
- O que significa: Supervisor visualizou e está analisando. Ainda não tomou decisão.
- O que o Membro vê: "Em análise pelo Supervisor [Nome] desde [hora/data]"
- Valor desta informação: elimina o silêncio — o Membro sabe que alguém viu.
- O que o Membro sabe: há quanto tempo está nesse estado

**AGUARDANDO INFORMAÇÃO DO MEMBRO**
- O que significa: Supervisor precisa de mais dados antes de decidir. Exclusivo de Solicitação Excepcional e casos especiais.
- O que o Membro vê: "Supervisor solicitou informação — ação necessária"
- O que o Membro precisa fazer: responder à pergunta específica do Supervisor (exibida diretamente na solicitação)
- Urgência: alta — a solicitação fica bloqueada até o Membro responder

**APROVADA**
- O que significa: Decisão tomada a favor. Escala atualizada automaticamente (quando aplicável).
- O que o Membro vê: "Aprovada em [data] por [Supervisor]"
- Consequências automáticas: para Folga, Troca e Ajuste de Escala — a Escala é atualizada sem ação adicional do Supervisor. O Membro vê a mudança refletida no Meu Dia (S-01).

**NEGADA**
- O que significa: Decisão tomada contra. **Motivo é obrigatório — o sistema não permite negar sem explicação.**
- O que o Membro vê: "Negada em [data] — Motivo: [texto do Supervisor]"
- Opções após negativa: iniciar conversa via Mensagens / aceitar e encerrar
- O que a IA pode fazer: explicar o contexto operacional da decisão quando solicitado

**PROPOSTA ALTERNATIVA**
- O que significa: Supervisor não aprova na forma solicitada, mas sugere uma alternativa.
- O que o Membro vê: "Proposta alternativa — resposta necessária até [prazo]"
- O que o Membro precisa fazer: aceitar / recusar / contra-propor (abre conversa via Mensagens)
- Se o Membro não responder no prazo: o sistema notifica o Membro e o Supervisor

**CANCELADA**
- O que significa: Membro desistiu do pedido antes de uma decisão.
- Quando disponível: apenas nos estados ENVIADA e EM ANÁLISE
- Não disponível em: AGUARDANDO INFORMAÇÃO, PROPOSTA ALTERNATIVA (já há interação ativa do Supervisor)

---

### 3.3 Transições de estado e quem as aciona

| Transição | Quem aciona |
|---|---|
| Criada → ENVIADA | Membro (ao submeter) |
| ENVIADA → EM ANÁLISE | Supervisor (ao abrir/visualizar — automático) |
| EM ANÁLISE → AGUARDANDO INFORMAÇÃO | Supervisor (ação explícita) |
| AGUARDANDO INFORMAÇÃO → EM ANÁLISE | Membro (ao responder) |
| EM ANÁLISE → APROVADA | Supervisor |
| EM ANÁLISE → NEGADA | Supervisor (com motivo obrigatório) |
| EM ANÁLISE → PROPOSTA ALTERNATIVA | Supervisor |
| PROPOSTA ALTERNATIVA → APROVADA | Membro (ao aceitar proposta) |
| PROPOSTA ALTERNATIVA → NEGADA | Membro (ao recusar) ou expiração de prazo |
| PROPOSTA ALTERNATIVA → EM ANÁLISE | Membro (ao contra-propor) |
| ENVIADA → CANCELADA | Membro |
| EM ANÁLISE → CANCELADA | Membro |

---

### 3.4 Visibilidade de tempo em cada estado

Para cada Solicitação, o tempo decorrido no estado atual é sempre visível. Este dado serve três propósitos:

1. **Para o Membro:** confirma que o sistema não esqueceu
2. **Para o Supervisor:** sinaliza o que está envelhecendo na fila
3. **Para o Admin:** é o dado bruto para o indicador "tempo médio de resposta" por Supervisor

---

### 3.5 Escalada automática para o Admin

**Limiar 1 — Silêncio de 48h:**
Se uma Solicitação permanece no estado ENVIADA por mais de 48 horas úteis sem transição para EM ANÁLISE:
- Admin recebe alerta de "solicitação sem visibilidade"
- Admin pode intervir diretamente: visualizar, encaminhar para outro Supervisor ou aprovar/negar

**Limiar 2 — Análise de 72h:**
Se uma Solicitação permanece no estado EM ANÁLISE por mais de 72 horas úteis sem decisão:
- Admin vê a solicitação como "pendência de alta idade" no painel de monitoramento
- Não é bloqueio — é visibilidade para o Admin agir preventivamente

---

## PARTE 4 — VISÃO DO MEMBRO (Requerente)

---

### 4.1 O que o Membro precisa desta superfície

O Membro usa S-06 em dois modos distintos:

**Modo Criação:** Quando tem um pedido a fazer. Precisa escolher o tipo certo, preencher o mínimo necessário e ter confirmação imediata de que foi recebido.

**Modo Acompanhamento:** Quando quer saber o que está acontecendo com pedidos já enviados. Precisa ver o estado de cada solicitação sem abrir uma por uma.

A pesquisa aponta que **Acompanhamento é mais importante que o ato de criar** (D4 — Pesquisa de Membro). O formulário é apenas o início. O que o Membro realmente quer é a resposta: está sendo visto? Está sendo analisado? O que decidiu?

---

### 4.2 Lista de Solicitações — visão do Membro

**O que aparece na lista (sem precisar abrir):**
- Tipo de solicitação (em linguagem amigável, não técnica)
- Data(s) impactadas
- **Estado atual** — sempre visível, sempre legível
- Tempo no estado atual ("há 2 dias", "há 3 horas")
- Indicador de ação necessária (quando o Membro precisa agir: responder, aceitar proposta)

**Ordenação da lista para o Membro:**
1. **Ação necessária do Membro** (topo absoluto — badge de destaque)
2. **Em andamento** — por data de impacto (a mais próxima primeiro)
3. **Decididas recentemente** — últimos 7 dias
4. **Histórico** — acessível via "ver mais antigas"

---

### 4.3 Fluxo de criação de uma Solicitação

**Passo 1 — Escolha do tipo**

Apresentado em linguagem natural. O sistema pode oferecer entrada por pergunta — *"O que você precisa pedir?"* — e sugerir o tipo mais adequado. Ou o Membro escolhe diretamente da lista de tipos (em linguagem amigável).

**Prevenção de duplicata:** antes de apresentar o formulário, o sistema verifica se existe solicitação similar já em aberto (mesmo tipo + data sobreposta) e exibe aviso: *"Você já tem uma solicitação de folga para o dia 21 em análise. Quer abrir mesmo assim?"*

**Passo 2 — Preenchimento**

Campos mínimos necessários por tipo (definidos na Parte 2). O sistema não deve exigir mais do que o necessário para que o Supervisor consiga analisar.

**Passo 3 — Envio e confirmação imediata**

Após enviar, o Membro vê confirmação explícita:
- "Solicitação enviada e encaminhada para [Nome do Supervisor]"
- Data e hora do envio
- Estado inicial: "Enviada — aguardando análise"

A tela retorna para a lista com o novo item visível no topo.

---

### 4.4 Visualização de uma Solicitação individual

Ao abrir uma solicitação, o Membro vê:

**Cabeçalho fixo:**
- Tipo (amigável) + Estado atual com ícone de cor + Data(s) impactadas

**Linha do tempo simplificada:**
- Enviada em [data/hora]
- Visualizada pelo Supervisor em [data/hora] (quando disponível)
- [Estado atual]

**Conteúdo do pedido:** o que foi solicitado (resumo do preenchimento)

**Decisão (quando decidida):**
- Resultado: Aprovada / Negada / Proposta alternativa
- **Motivo** (quando negada — sempre presente, nunca vazio)
- Data da decisão + Nome do Supervisor que decidiu

**Ações disponíveis por estado:**
- ENVIADA ou EM ANÁLISE → [Cancelar solicitação]
- PROPOSTA ALTERNATIVA → [Aceitar] [Recusar] [Enviar mensagem]
- AGUARDANDO INFORMAÇÃO → [Responder agora]
- APROVADA ou NEGADA → [Abrir conversa] (vai para S-09 com contexto da solicitação pré-carregado)

---

### 4.5 O que o Membro nunca deve precisar fazer

- Abrir cada solicitação para descobrir o estado
- Perguntar ao Supervisor "você viu meu pedido?"
- Enviar solicitação duplicada por não saber que a primeira estava em análise
- Receber uma negativa sem entender o motivo
- Ficar sem resposta por dias sem nenhum sinal de que algo está acontecendo

---

## PARTE 5 — VISÃO DO SUPERVISOR (Aprovador)

---

### 5.1 O que o Supervisor precisa desta superfície

O Supervisor usa S-06 em dois modos:

**Modo Análise Ativa:** Quando precisa processar solicitações pendentes. Pode ser diário ou em lote.

**Modo Monitoramento:** Passivo — as solicitações aparecem no Painel Operacional (S-02) como item de atenção quando existem pendências.

A **análise de impacto** é o elemento central da visão do Supervisor. Antes de ver qualquer botão de decisão, o Supervisor vê o que esta solicitação significa operacionalmente.

---

### 5.2 Lista de Solicitações — visão do Supervisor

**O que aparece na lista (sem precisar abrir):**
- Nome do Membro + Tipo de solicitação + Data(s) solicitadas
- **Nível de impacto operacional:** Baixo / Médio / Alto / Crítico (calculado automaticamente)
- Tempo desde o envio (sinaliza urgência de resposta)
- Estado atual (Enviada / Em análise)

**Ordenação da lista para o Supervisor (fundamental):**

A lista **NÃO é ordenada por data de criação.** É ordenada por impacto e urgência operacional:

1. **Crítico — data de impacto nas próximas 48h** (topo absoluto)
2. **Alto — data de impacto em até 7 dias**
3. **Médio — data de impacto além de 7 dias**
4. **Baixo — impacto operacional reduzido**

Dentro de cada nível, ordenação por data de impacto (a mais próxima primeiro).

**Justificativa:** A folga que começa amanhã é mais urgente que a folga de daqui a três semanas, independentemente de qual foi enviada primeiro.

---

### 5.3 Análise de uma Solicitação pelo Supervisor

Ao abrir uma solicitação, o Supervisor **NÃO vê primeiro os botões de decisão.** Vê primeiro o diagnóstico:

**Bloco 1 — O Pedido**
Quem solicitou, o que pediu, para quando, motivo declarado.

**Bloco 2 — Impacto Operacional (calculado pela IA)**
- Atividades afetadas naquelas datas
- Papéis que este Membro cobre → nível de risco de cada um
- Candidatos disponíveis para cobertura (quando aplicável)

**Bloco 3 — Acumulado de Folgas nas Mesmas Datas**
- Quantas outras folgas já foram aprovadas para as mesmas datas dentro do grupo
- Percentual de cobertura restante do grupo se esta folga for aprovada
- Nomes dos outros Membros já de folga nas mesmas datas

Este bloco é **mandatório e não pode ser omitido ou minimizado.** É a proteção contra decisões que individualmente parecem corretas mas coletivamente criam crise de cobertura (D7 — Pesquisa de Supervisor).

**Bloco 4 — Decisão**
Apenas após os três blocos acima:
- [Aprovar]
- [Negar] → abre campo de motivo obrigatório
- [Propor alternativa] → abre campo para proposta com data(s) alternativas e justificativa
- [Solicitar informação] → disponível para Solicitação Excepcional e casos específicos

---

### 5.4 Regra inegociável: motivo de negativa obrigatório

O sistema **bloqueia o envio da negativa** enquanto o campo de motivo estiver vazio.

Não é um aviso. Não é um lembrete. É um bloqueio técnico.

O campo deve ter prompt de exemplo: *"Ex: Você é a única titular de Astrid disponível nesta data"* ou *"Ex: Cobertura do grupo já está no limite mínimo."*

---

### 5.5 Fluxo de proposta alternativa

1. Supervisor seleciona "Propor alternativa"
2. Informa a(s) data(s) alternativas disponíveis
3. Escreve breve justificativa
4. Envia → Membro recebe notificação com estado "Proposta alternativa — resposta necessária"

O Supervisor vê na lista: *"Proposta enviada — aguardando resposta do Membro [há X horas]"*

---

### 5.6 Análise em lote pelo Supervisor

Quando o Supervisor tem múltiplas solicitações pendentes:
- Ao decidir uma, o sistema avança automaticamente para a próxima na fila de prioridade
- Não precisa voltar para a lista entre cada decisão
- Progresso visível: "3 de 7 solicitações analisadas"

---

### 5.7 Notificações recebidas pelo Supervisor

| Evento | Tipo de notificação |
|---|---|
| Nova solicitação recebida | Informativa (badge no painel) |
| Solicitação de impacto Alto ou Crítico | Importante (push + badge) |
| Membro respondeu proposta alternativa | Informativa |
| Membro respondeu solicitação de informação | Informativa |
| Solicitação sem análise há 48h | Importante (alerta de envelhecimento) |

---

## PARTE 6 — VISÃO DO ADMIN (Monitor)

---

### 6.1 O Admin não é aprovador primário

O Admin **não participa do fluxo normal de aprovação** de Solicitações. Entra em S-06 em duas situações específicas:

**Situação A — Escalada de tempo:** Solicitação ficou sem resposta por mais de 48h úteis. Admin pode aprovar/negar no lugar do Supervisor como medida de contingência.

**Situação B — Investigação de padrão:** Admin usa dados de Solicitações como indicador de saúde operacional — para identificar tendências, não para analisar itens individuais.

---

### 6.2 O que o Admin monitora em S-06

Dados disponíveis no Painel do Admin (S-03):

**Indicadores de tempo:**
- Tempo médio de resposta por Supervisor (esta semana vs. média histórica)
- Solicitações com mais de 48h sem resposta (e qual Supervisor é responsável)
- Volume de solicitações por período (crescendo? estável?)

**Indicadores de padrão:**
- Tipos de solicitação mais frequentes por operação
- Taxa de aprovação vs. negação por Supervisor
- Reincidência: Membros que repetem o mesmo tipo de solicitação seguidas vezes
- Concentração: operação ou grupo com volume anormalmente alto de solicitações de folga

**Indicadores de saúde:**
- Solicitações sem responsável (grupo sem Supervisor ativo)
- Volume de escaladas para Admin por período

---

### 6.3 Acesso direto do Admin a uma Solicitação individual

O Admin pode abrir qualquer Solicitação de qualquer operação para investigação. Ao abrir, vê:
- Todo o histórico de estados com timestamps
- Linha do tempo completa (incluindo se o Supervisor visualizou e quando)
- Decisão tomada e motivo (ou ausência de decisão)
- Metadados de padrão: é a Nth solicitação deste tipo deste Membro nos últimos 30 dias?

Este acesso é investigativo, não operacional.

---

### 6.4 Quando o Admin intervém como aprovador

Se a solicitação chega ao limiar de escalada:
- Admin recebe alerta específico com contexto completo
- Admin pode aprovar/negar com os mesmos campos do Supervisor (incluindo motivo obrigatório em negativas)
- A ação do Admin é registrada com indicador: "aprovado pelo Admin após X dias sem resposta do Supervisor"

---

## PARTE 7 — REGRAS DE NEGÓCIO CRÍTICAS

---

### 7.1 Regras absolutas (não negociáveis)

**R01 — Motivo de negativa obrigatório**
O sistema não permite enviar uma negativa sem motivo preenchido. É bloqueio técnico, não aviso. Aplica-se a Supervisor e Admin.

**R02 — Estado sempre visível sem abrir o item**
Para o Membro, o estado de cada solicitação é sempre legível na lista sem nenhuma interação adicional.

**R03 — Análise de impacto antes dos botões de decisão**
Para o Supervisor, o sistema calcula e exibe o impacto operacional **antes** de tornar as opções de aprovação/negação disponíveis.

**R04 — Acumulado de folgas na mesma tela de análise**
Para folgas e trocas de folga, o acumulado de aprovações nas mesmas datas dentro do grupo é sempre visível na tela de análise. Não exige clique adicional.

**R05 — Ordenação por urgência de impacto para o Supervisor**
A lista de solicitações pendentes do Supervisor é ordenada por urgência de impacto operacional, nunca por data de criação.

**R06 — Prevenção de duplicata**
Antes de criar uma solicitação, o sistema verifica e alerta sobre solicitações similares já em aberto. O Membro pode prosseguir, mas precisa confirmar.

**R07 — Escalada automática de silêncio para o Admin**
Solicitações sem resposta por mais de 48h úteis geram alerta automático para o Admin.

---

### 7.2 Regras de comportamento do sistema

**R08 — Confirmação imediata de recebimento**
Ao submeter, o Membro recebe confirmação visual e informacional imediata: recebida, encaminhada para [nome], estado inicial ENVIADA.

**R09 — Transição automática ENVIADA → EM ANÁLISE**
Quando o Supervisor abre uma solicitação, a transição de estado acontece automaticamente.

**R10 — Cancelamento bloqueado após interação ativa do Supervisor**
Membro não pode cancelar uma solicitação em AGUARDANDO INFORMAÇÃO ou PROPOSTA ALTERNATIVA.

**R11 — Aprovação reflete automaticamente na Escala**
Para Folga, Troca de Folga e Ajuste de Escala, a aprovação desencadeia atualização automática da Escala sem ação adicional do Supervisor.

**R12 — Prazo visível em Proposta Alternativa**
Toda proposta alternativa tem um prazo de resposta. O Supervisor define ao criar (sugestão padrão de 48h).

**R13 — Registro permanente no Histórico**
Toda solicitação e todas as suas transições de estado são registradas em S-11 como dado imutável e auditável.

---

### 7.3 O que o sistema NÃO faz em S-06

- **Não aprova automaticamente** — nenhum tipo pode ser aprovado sem decisão humana
- **Não bloqueia criação** — o Membro sempre pode criar, mesmo com conflito detectado (apenas alerta)
- **Não oculta solicitações negadas** — histórico completo sempre visível para o Membro, incluindo motivos
- **Não permite reclassificar tipo após envio** — o tipo é definitivo no envio

---

## PARTE 8 — INTEGRAÇÕES COM OUTRAS SUPERFÍCIES

---

### 8.1 Mapa de dependências

```
                    S-04 ESCALA
                    (calcula impacto
                    e candidatos)
                         │
                         ▼
S-01 MEU DIA ◄──── S-06 SOLICITAÇÕES ────► S-11 HISTÓRICO
(badge, estado                              (registra cada
resumido, reflexo                           decisão como dado
de aprovações)                              permanente)
                         │
                    ┌────┴─────┐
                    ▼          ▼
               S-09 MSG    S-02/S-03
               (quando      PAINEIS
               exige        (indicadores
               conversa)    de saúde)
```

---

### 8.2 Relação com S-04 — Escala

**Leitura:** S-06 depende de S-04 para calcular o impacto de cada solicitação.

**Escrita:** Quando Folga, Troca ou Ajuste de Escala é aprovado, S-06 escreve na Escala automaticamente.

**Consequência de aprovação:**
1. Disponibilidade do Membro nas datas aprovadas (Escala)
2. Livro do Dia afetado (se já gerado)
3. Meu Dia do Membro (S-01)

---

### 8.3 Relação com S-01 — Meu Dia

- **Badge de pendências:** indicador quando existe solicitação aguardando ação do Membro
- **Reflexo de aprovações:** Meu Dia reflete mudança automaticamente após aprovação com impacto na Escala
- **Estado resumido:** Meu Dia pode exibir "1 solicitação em análise" com link direto para S-06

---

### 8.4 Relação com S-09 — Mensagens

S-06 não é superfície de conversação. Quando a negociação exige conversa, ela acontece em S-09.

**Vínculo de contexto:** Conversa iniciada a partir de uma Solicitação carrega o contexto da solicitação pré-carregado — tipo, data, estado, decisão.

**Gatilho automático:** "Abrir conversa" a partir de solicitação negada ou proposta recusada abre S-09 com contexto já presente.

---

### 8.5 Relação com S-11 — Histórico

O Histórico preserva por solicitação:
- Tipo, data de criação, datas solicitadas
- Cada transição de estado com timestamp e responsável
- Motivos de negativa (texto completo)
- Propostas alternativas e respostas
- Referências às mensagens trocadas

Uso pelo Admin: reconstrução de narrativa completa para investigação de padrões (JA-02).

---

### 8.6 Relação com S-02 — Painel Operacional (Supervisor)

S-02 é o ponto de entrada natural do Supervisor para S-06:
- Número de solicitações pendentes visível no painel
- Destaque visual se existir alguma de urgência alta ou crítica
- Link direto para a fila de análise em S-06

---

### 8.7 Relação com S-03 — Painel Administrativo

S-03 consome dados agregados de S-06:
- Tempo médio de resposta por Supervisor
- Volume de solicitações por período e operação
- Solicitações em estado de escalada
- Taxa de aprovação/negação como indicador de padrão de gestão

---

## PARTE 9 — IA EM S-06

---

### 9.1 Princípio de uso da IA em S-06

A IA opera em duas direções opostas:

- **Para o Supervisor:** analisa **antes** de qualquer ação. Informa o impacto antes de apresentar as opções de decisão.
- **Para o Membro:** explica **depois** da decisão. Responde "por que?" quando o Membro precisa entender o que aconteceu.

---

### 9.2 IA para o Supervisor — análise de impacto

Antes de apresentar as opções de aprovação/negação, a IA calcula e exibe:

Para Solicitação de Folga:
- Atividades afetadas nas datas solicitadas
- Papéis críticos sem cobertura disponível
- Candidatos recomendados para cobertura
- Nível de risco operacional resultante da aprovação

**Exemplo de output:**
> *"Amanda solicitou folga no sábado 21. Ela cobre Astrid no Musical das 14h (papel único — sem substituto confirmado) e Bloco 3 do Ensaio das 16h (Beatriz pode cobrir). Carlos e Fernanda já têm folga aprovada nesse dia — o grupo estará com 60% da cobertura se esta folga for aprovada. Recomendo negociar data alternativa ou confirmar cobertura para Astrid antes de aprovar."*

A IA não decide. Recomenda. O Supervisor decide.

---

### 9.3 IA para o Membro — explicação contextual pós-decisão

Casos de uso:
- *"Por que minha folga foi negada?"* → IA explica o contexto operacional da data
- *"O que acontece com minha escala agora que minha folga foi aprovada?"* → IA lista as mudanças automáticas
- *"Em que estado está minha solicitação?"* → IA retorna estado atual com contexto de tempo

**Limite:** A IA pode explicar o contexto operacional, mas não contesta nem recomenda que o Membro questione a decisão do Supervisor.

---

### 9.4 IA para o Admin — detecção de padrões

- *"Quais Supervisores têm maior tempo médio de resposta esta semana?"*
- *"Existem Membros com padrão recorrente de mesmo tipo de solicitação?"*
- *"Resuma o que aconteceu com esta solicitação específica."*

A IA transforma registros brutos de S-11 em narrativa compreensível — crítico para investigações de padrão (JA-02).

---

### 9.5 O que a IA não faz em S-06

- Não aprova nem nega solicitações — sem exceção
- Não notifica o Supervisor sobre urgência (notificações são do sistema)
- Não sugere ao Membro qual pedido tem mais chance de ser aprovado
- Não altera o estado de qualquer solicitação

---

## PARTE 10 — CRITÉRIOS DE ACEITAÇÃO

---

### 10.1 Critérios para o Membro

| # | Critério | Como verificar |
|---|---|---|
| CM-01 | Estado de cada solicitação legível na lista sem abrir o item | Lista com 5 solicitações em estados diferentes — todos legíveis sem clique |
| CM-02 | Ao enviar, confirmação imediata com nome do Supervisor e timestamp | Criar solicitação e verificar tela de confirmação |
| CM-03 | Transição ENVIADA → EM ANÁLISE acontece quando Supervisor abre, sem ação do Membro | Supervisor abre; Membro atualiza lista e vê "Em análise" |
| CM-04 | Negativa sempre contém motivo visível — nunca campo vazio | Tentar negar sem motivo; sistema deve bloquear |
| CM-05 | Aviso de duplicata antes de criar solicitação sobreposta | Criar folga dia 21; tentar criar segunda folga dia 21; sistema alerta |
| CM-06 | Proposta alternativa exibe prazo de resposta | Supervisor cria proposta; Membro vê prazo na lista |
| CM-07 | Aprovação de folga reflete automaticamente em Meu Dia | Aprovar folga; verificar que Meu Dia mostra atualização |
| CM-08 | IA responde corretamente "por que minha folga foi negada?" | Perguntar à IA após negativa; verificar coerência com contexto |

---

### 10.2 Critérios para o Supervisor

| # | Critério | Como verificar |
|---|---|---|
| CS-01 | Lista ordenada por urgência de impacto, não por data de criação | Criar folga amanhã e folga daqui 3 semanas; folga de amanhã aparece primeiro |
| CS-02 | Análise de impacto visível antes dos botões de decisão | Abrir solicitação de folga; impacto aparece antes de qualquer botão |
| CS-03 | Acumulado de folgas visível sem clique adicional | Abrir solicitação para dia com outras folgas aprovadas; bloco de acumulado visível |
| CS-04 | Campo de motivo bloqueia envio de negativa quando vazio | Tentar negar sem preencher motivo; sistema impede envio |
| CS-05 | Notificação de nova solicitação de impacto alto chega como push | Membro cria folga de impacto alto; Supervisor recebe push |
| CS-06 | Aprovação atualiza Escala sem ação adicional | Aprovar folga; verificar S-04 com data bloqueada para o Membro |
| CS-07 | Navegação sequencial entre solicitações sem voltar para lista | Decidir 3 solicitações em sequência; verificar avanço automático |
| CS-08 | Alerta de solicitação sem resposta após 48h | Criar solicitação; simular 48h sem resposta; Admin recebe alerta |

---

### 10.3 Critérios para o Admin

| # | Critério | Como verificar |
|---|---|---|
| CA-01 | Tempo médio de resposta por Supervisor visível no painel | Acessar S-03 com múltiplas solicitações decididas; verificar indicador |
| CA-02 | Solicitações em escalada aparecem como alerta no painel | Simular 48h sem resposta; verificar alerta em S-03 |
| CA-03 | Admin pode aprovar/negar solicitação em estado de escalada | Admin abre solicitação escalada; verifica opções de decisão |
| CA-04 | Histórico de qualquer solicitação reconstruível cronologicamente | Abrir solicitação via S-11; verificar linha do tempo completa |
| CA-05 | IA responde corretamente sobre padrões de solicitação | Perguntar sobre tempo médio de resposta; verificar coerência |

---

### 10.4 Critérios de sistema

| # | Critério |
|---|---|
| CD-01 | Toda transição de estado registrada em S-11 com timestamp e responsável |
| CD-02 | Aprovação de folga não exige ação em S-04 — propagação automática |
| CD-03 | Restrição aprovada impacta motor de candidatos de S-04 imediatamente |
| CD-04 | Conversa aberta a partir de Solicitação carrega contexto pré-carregado em S-09 |
| CD-05 | Escalada automática de 48h/72h funciona independente de ação manual |

---

### 10.5 Critérios de qualidade de experiência

| # | Critério |
|---|---|
| CX-01 | Nenhuma solicitação em limbo sem estado visível por mais de 24h úteis |
| CX-02 | O Membro nunca precisa abrir uma solicitação individual para saber se precisa agir |
| CX-03 | O Supervisor nunca decide sobre impacto que o sistema poderia ter calculado |
| CX-04 | Toda negativa contém motivo — este critério nunca tem exceção |
| CX-05 | Aprovação reflete no Meu Dia sem que o Membro precise atualizar manualmente |
