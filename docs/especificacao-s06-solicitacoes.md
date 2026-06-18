# S-06 SOLICITAÇÕES — Especificação Funcional Completa
## MyASA 2.0 — Bloco 2

> **Versão:** 17/06/2026 — v2 (Pós-Auditoria de Cenários Limite)
> **Fase:** Especificação Funcional — anterior a wireframes e componentes de interface
> **Status:** 🟢 Pronta para Wireframe
> **Princípio fundador:** *"O pior não é ouvir não. O pior é não saber se alguém viu."*
>
> **Histórico de versões:**
> - v1 — Especificação inicial (17/06/2026)
> - v2 — Incorporação das 13 lacunas identificadas na Auditoria de Cenários Limite (17/06/2026)

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

**Posição na navegação — Supervisor:** Camada 2 (contextual). Acesso via Painel Operacional onde as solicitações pendentes aparecem como item de atenção. Acesso direto também disponível via nav secundária.

**Posição na navegação — Admin:** Camada 3 (profunda). Dados de Solicitações como indicador dentro do Painel Administrativo (S-03). Acesso direto via nav profunda para investigação.

---

### 1.4 O problema que S-06 existe para resolver

A pesquisa de usuário identificou que o **silêncio após o envio** de uma solicitação é a experiência mais corrosiva para a confiança do Membro. Não é a negativa — é o vácuo.

O Membro envia. E então não sabe se a solicitação chegou, se o Supervisor viu, se está sendo analisada, se foi esquecida, se uma resposta está chegando.

Esse silêncio sem significado (D3 — Pesquisa de Membro) é a motivação principal para o design de S-06 como **processo com estado visível em tempo real**, não como formulário de envio.

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
- Motivo (texto livre obrigatório — qualquer texto é aceito sem validação de conteúdo)

**Campos opcionais:**
- Observação adicional (ex: posso fazer show da manhã, mas não o da tarde)

**Impacto operacional:** Alto. O sistema calcula automaticamente todas as atividades afetadas antes de apresentar opções de decisão ao Supervisor.

**Análise automática para o Supervisor:**
- Quais atividades da data solicitada esse Membro cobre
- Quais papéis são exclusivos (sem substituto disponível)
- Quais papéis têm alternativa disponível (e quem são os candidatos)
- Acumulado de folgas já aprovadas para as mesmas datas no mesmo grupo
- Percentual de cobertura do grupo se esta folga for aprovada

**Opções de decisão do Supervisor:** Aprovar / Negar (motivo obrigatório) / Propor data alternativa

---

#### TIPO 2 — Troca de Folga

**O que é:** Pedido de trocar uma folga já agendada por outra data.

**Quando usar:** Membro tem folga programada na data X e prefere trabalhar nela, folga na data Y.

**Campos obrigatórios do Membro:**
- Data da folga original (que deseja trabalhar)
- Data alternativa proposta (onde deseja folgar)
- Motivo

**Impacto operacional:** Médio. O sistema valida as duas datas para verificar cobertura em ambas.

**Comportamento ao aprovar (L-10):** Quando a Troca de Folga é aprovada, o sistema executa automaticamente duas atualizações na Escala:
1. Data original (X): disponibilidade do Membro **restaurada** — ele volta a estar disponível para atividades naquela data
2. Data nova (Y): disponibilidade do Membro **bloqueada** — folga registrada

Ambas as atualizações acontecem simultaneamente, sem ação adicional do Supervisor.

**Opções de decisão do Supervisor:** Aprovar / Negar (motivo obrigatório) / Propor combinação alternativa

---

#### TIPO 3 — Solicitação Excepcional

**O que é:** Pedido que não se enquadra nas categorias padronizadas. Requer avaliação case-by-case pelo Supervisor.

**Quando usar:** Situações incomuns — ex: participar de evento externo em data de trabalho, saída emergencial não programada, pedido de reposição especial.

**Campos obrigatórios do Membro:**
- Descrição da exceção (mínimo de caracteres suficiente para o Supervisor entender sem precisar pedir mais informações)
- Data(s) impactadas

**Campos opcionais:**
- Proposta de compensação ou alternativa pelo próprio Membro

**Análise automática:** Limitada — verifica disponibilidade e cobertura básica. Decisão depende de análise qualitativa do Supervisor.

**Opções de decisão do Supervisor:** Aprovar / Negar (motivo obrigatório) / Solicitar mais informação / Propor alternativa

**Nota:** Este é o único tipo que ativa o estado AGUARDANDO INFORMAÇÃO DO MEMBRO como estado de decisão intermediária regular. Outros tipos podem atingir este estado em casos excepcionais.

**Limite de ciclos (L-11):** Máximo de 2 rodadas de pedido de informação. Na terceira necessidade, o Supervisor deve tomar uma decisão (Aprovar / Negar / Propor Alternativa) ou abrir conversa via S-09 Mensagens. O sistema bloqueia a opção "Solicitar mais informação" após 2 usos na mesma solicitação.

---

#### TIPO 4 — Solicitação de Restrição

**O que é:** Comunicação formal de uma limitação de disponibilidade ou capacidade física/médica/técnica que afeta a escala por um período.

**Campos obrigatórios do Membro:**
- Tipo de restrição: Médica / Operacional / Física / Técnica
- Descrição da limitação
- Data de início
- Data de término (ou "Indefinido")

**Data de revisão (L-12):**
- Para Restrições Médicas: **obrigatória**. O sistema não aceita submeter uma Restrição Médica sem data de revisão.
- Para demais tipos (Operacional, Física, Técnica): opcional.
- Quando a data de revisão de uma Restrição Médica é atingida sem que o Supervisor tenha revisado e encerrado ou renovado a restrição, o sistema envia alerta ao Supervisor: *"Restrição Médica de [Membro] atingiu a data de revisão em [data]. Revisar e confirmar continuidade ou encerrar."*

**Impacto operacional:** Variável e duradouro. Uma restrição ativa afeta todas as escalas futuras enquanto vigente. O sistema aplica automaticamente nas gerações de Escala e Livro do Dia após aprovação.

**Nota arquitetural:** Restrições aprovadas alimentam diretamente o motor de candidatos da Escala (S-04), impactando a camada eliminatória da hierarquia de 4 camadas.

**Decisão do Supervisor:** Registrar como aprovado / Solicitar documento de suporte / Negar (com motivo)

---

#### TIPO 5 — Solicitação de Ajuste de Escala

**O que é:** Pedido do Membro para que sua posição em uma atividade específica seja revisada — troca de papel, troca de horário de entrada, ou qualquer modificação pontual na escala já publicada.

**Campos obrigatórios do Membro:**
- Atividade específica (qual show/ensaio/evento)
- O que está publicado atualmente para ele
- O que solicita que seja alterado
- Motivo

**Impacto operacional:** Específico e imediato. Verificado apenas na atividade indicada e posições interdependentes.

**Decisão do Supervisor:** Aprovar (Escala alterada automaticamente) / Negar (com motivo) / Aprovar parcialmente com modificação

---

#### TIPO 6 — Solicitação de Saída Antecipada

**O que é:** Pedido para encerrar a jornada antes do horário previsto na data indicada.

**Campos obrigatórios do Membro:**
- Data
- Horário de saída solicitado (horário previsto preenchido automaticamente pelo sistema)
- Motivo

**Impacto operacional:** Baixo a médio. O sistema verifica se o Membro tem atividades previstas após o horário de saída solicitado.

**Decisão do Supervisor:** Aprovar / Negar (com motivo) / Aprovar com ajuste de horário

---

#### TIPO 7 — Solicitação de Chegada Tardia

**O que é:** Pedido para iniciar a jornada mais tarde que o horário previsto na data indicada.

**Campos obrigatórios do Membro:**
- Data
- Horário de chegada previsto (preenchido automaticamente)
- Horário de chegada solicitado
- Motivo

**Impacto operacional:** Variável. O sistema verifica se o Membro tem atividades previstas entre o horário original e o solicitado — incluindo preparação, ensaios parciais, calls.

**Decisão do Supervisor:** Aprovar / Negar (com motivo) / Aprovar com horário alternativo

---

#### TIPO 8 — Solicitação Administrativa

**O que é:** Canal para pedidos de natureza administrativa não operacional — atualização de dados cadastrais, documentos, pagamentos, benefícios, informações de contrato.

**Campos obrigatórios do Membro:**
- Descrição do pedido
- Urgência percebida: Baixa / Normal / Alta

**Comportamento da urgência (L-13):** A marcação de urgência **não é apenas informativa** — tem efeito operacional no sistema:
- **Urgência Baixa:** aparece na lista do Supervisor sem destaque adicional
- **Urgência Normal:** badge padrão na lista
- **Urgência Alta:** push notification enviado ao Supervisor + item aparece no topo dentro da categoria Administrativa + label de urgência visível na lista

A urgência Alta não altera os limiares de escalada automática para o Admin — apenas acelera a visibilidade para o Supervisor.

**Impacto operacional:** Nenhum sobre a Escala. O sistema não executa análise de impacto operacional.

**Decisão do Supervisor:** Resolver / Encaminhar para Admin / Negar (com motivo)

---

### 2.2 Linguagem para o Membro

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

1. **Solicitação de Folga** — maior volume
2. **Solicitação de Restrição** — frequência sazonal, impacto duradouro
3. **Chegada Tardia / Saída Antecipada** — frequentes, baixo impacto médio
4. **Troca de Folga** — menos frequente que folga simples
5. **Ajuste de Escala** — pontual, reativo a publicação
6. **Solicitação Excepcional** — esporádica
7. **Solicitação Administrativa** — independente do calendário operacional

---

## PARTE 3 — ESTADOS E CICLO DE VIDA

---

### 3.1 Estados oficiais de uma Solicitação

Toda Solicitação passa por estados claramente definidos. O estado é sempre visível para o Membro **sem precisar abrir o item** — regra inegociável de S-06.

```
ENVIADA
   │
   ▼
EM ANÁLISE
   │
   ├──► AGUARDANDO INFORMAÇÃO DO MEMBRO
   │         │
   │         └──► (Membro responde) → EM ANÁLISE
   │              (max 2 rodadas — Tipo 3; max 1 — demais tipos)
   │
   ├──► APROVADA ────────────────────────────────────── [FIM]
   │
   ├──► NEGADA (motivo obrigatório) ─────────────────── [FIM]
   │
   └──► PROPOSTA ALTERNATIVA
             │
             ├──► Membro aceita → APROVADA ──────────── [FIM]
             ├──► Membro recusa → NEGADA ─────────────── [FIM]
             ├──► Membro contra-propõe → EM ANÁLISE
             └──► Prazo vence → EXPIRADA
                       │
                       └──► Supervisor age → EM ANÁLISE

APROVADA ──► (nova circunstância) ──► REVOGADA ──────── [FIM]

CANCELADA (pelo Membro, antes de decisão) ───────────── [FIM]
```

---

### 3.2 Definição detalhada de cada estado

**ENVIADA**
- O que significa: Solicitação recebida pelo sistema. Supervisor ainda não a visualizou.
- O que o Membro vê: *"Enviada — aguardando análise pelo Supervisor [Nome] desde [hora/data]"*
- Ação do Membro: pode cancelar

**EM ANÁLISE**
- O que significa: Supervisor visualizou e está analisando. Ainda não tomou decisão.
- O que o Membro vê: *"Em análise pelo Supervisor [Nome] desde [hora/data]"*
- Valor: elimina o silêncio — o Membro sabe que foi visto
- Transição automática: acontece quando o Supervisor abre a solicitação

**AGUARDANDO INFORMAÇÃO DO MEMBRO**
- O que significa: Supervisor precisa de mais dados antes de decidir.
- O que o Membro vê: *"Supervisor solicitou informação — ação necessária"* + texto da pergunta do Supervisor
- Ação do Membro: responder (botão [Responder agora])
- Limite de ciclos: máximo 2 rodadas. Sistema bloqueia terceiro pedido de informação.

**APROVADA**
- O que significa: Decisão favorável. Escala atualizada automaticamente quando aplicável.
- O que o Membro vê: *"Aprovada em [data] por Supervisor [Nome]"*
- Consequências automáticas: para Folga, Troca e Ajuste de Escala — Escala e Meu Dia atualizados sem ação adicional

**NEGADA**
- O que significa: Decisão contrária. **Motivo é obrigatório — bloqueio técnico, não aviso.**
- O que o Membro vê: *"Negada em [data] — Motivo: [texto do Supervisor]"*
- Opções após negativa: abrir conversa via S-09 / criar nova solicitação se contexto mudou

**PROPOSTA ALTERNATIVA**
- O que significa: Supervisor não aprova na forma original mas sugere alternativa.
- O que o Membro vê: *"Proposta alternativa — resposta necessária até [prazo]"*
- Ações: [Aceitar] [Recusar] [Contra-propor via Mensagem]
- Prazo: definido pelo Supervisor ao criar a proposta (padrão sugerido: 48h)

**EXPIRADA (L-01)**
- O que significa: O Membro não respondeu à Proposta Alternativa dentro do prazo definido pelo Supervisor.
- Quando ocorre: automaticamente ao término do prazo da Proposta Alternativa sem resposta do Membro
- **Não é estado terminal.** A expiração reabre a responsabilidade no lado do Supervisor.
- O que o Membro vê: *"Proposta alternativa expirada — aguardando nova decisão do Supervisor"*
- O que o Supervisor vê: *"Proposta alternativa não respondida pelo Membro — ação necessária"* + notificação push
- Quem pode agir após: exclusivamente o Supervisor (pode: propor nova alternativa, aprovar a solicitação original, ou negar com motivo)
- Quando o Supervisor age: estado retorna a EM ANÁLISE, e novo fluxo de decisão se inicia
- O que o Admin monitora: Solicitações em EXPIRADA aparecem no painel como "aguardando nova ação do Supervisor" e entram na contagem de tempo de resposta
- Como o Histórico registra: *"Proposta alternativa expirada em [data] após [X] dias sem resposta do Membro."* + nova entrada quando Supervisor age
- Prazo de nova ação pelo Supervisor após EXPIRADA: sujeito à mesma tabela de escalada proporcional (seção 3.5) contada a partir da data de expiração

**REVOGADA (L-02)**
- O que significa: Uma aprovação previamente emitida foi desfeita por circunstância superveniente ou por erro identificado.
- **Quem pode revogar:** o Supervisor responsável pela aprovação original, ou o Admin
- **O Membro não pode revogar** uma aprovação já emitida — pode apenas cancelar antes da decisão
- **Cenários válidos para revogação:**
  - Nova Restrição de outro Membro elimina a cobertura que sustentava a aprovação
  - Mudança estrutural torna a folga operacionalmente inviável
  - Cancelamento de show impacta diretamente o contexto da aprovação
  - Supervisor identificou erro na análise antes da data efetiva
- **Cenários inválidos:** Supervisor simplesmente mudou de ideia sem contexto operacional novo — neste caso, deve abrir conversa com o Membro antes de revogar
- **Justificativa obrigatória:** mesma regra da negativa — bloqueio técnico sem preenchimento do motivo
- **Impacto na Escala:** automático — a Escala é revertida imediatamente ao estado anterior à aprovação
- **Impacto no Livro do Dia:** se o Livro do Dia da data afetada já foi gerado, o sistema emite alerta ao Supervisor para revisão manual do Livro
- **Notificação ao Membro:** nível Importante (não Crítico se a data ainda está distante; Crítico se a atividade afetada começa em menos de 24h) + motivo da revogação visível
- **Como o Histórico registra:** nova entrada imutável — *"Aprovação revogada em [data] por [Supervisor/Admin] — Motivo: [texto]. Estado anterior da Escala restaurado automaticamente."*
- REVOGADA é **estado terminal** — a solicitação encerra. Se o Membro quiser pedir novamente, cria nova Solicitação com novo contexto.
- O Membro pode abrir conversa via S-09 após receber notificação de revogação

**CANCELADA**
- O que significa: Membro desistiu antes de uma decisão.
- Quando disponível: apenas em ENVIADA e EM ANÁLISE
- Não disponível em: AGUARDANDO INFORMAÇÃO, PROPOSTA ALTERNATIVA (há interação ativa do Supervisor)
- Estado terminal

---

### 3.3 Transições de estado e quem as aciona

| Transição | Quem aciona |
|---|---|
| Criada → ENVIADA | Membro (ao submeter) |
| ENVIADA → EM ANÁLISE | Sistema (automático quando Supervisor abre) |
| EM ANÁLISE → AGUARDANDO INFORMAÇÃO | Supervisor (ação explícita — máx. 2x) |
| AGUARDANDO INFORMAÇÃO → EM ANÁLISE | Membro (ao responder) |
| EM ANÁLISE → APROVADA | Supervisor |
| EM ANÁLISE → NEGADA | Supervisor (motivo obrigatório) |
| EM ANÁLISE → PROPOSTA ALTERNATIVA | Supervisor |
| PROPOSTA ALTERNATIVA → APROVADA | Membro (ao aceitar) |
| PROPOSTA ALTERNATIVA → NEGADA | Membro (ao recusar) |
| PROPOSTA ALTERNATIVA → EM ANÁLISE | Membro (ao contra-propor) |
| PROPOSTA ALTERNATIVA → EXPIRADA | Sistema (automático ao vencer o prazo) |
| EXPIRADA → EM ANÁLISE | Supervisor (ao agir novamente) |
| APROVADA → REVOGADA | Supervisor ou Admin (motivo obrigatório) |
| ENVIADA → CANCELADA | Membro |
| EM ANÁLISE → CANCELADA | Membro |

---

### 3.4 Visibilidade de tempo em cada estado

Para cada Solicitação, o tempo decorrido no estado atual é sempre visível:
1. **Para o Membro:** confirma que o sistema não esqueceu
2. **Para o Supervisor:** sinaliza o que está envelhecendo na fila
3. **Para o Admin:** dado bruto para o indicador "tempo médio de resposta" por Supervisor

---

### 3.5 Escalada proporcional por urgência de impacto (L-03 + L-09)

A escalada automática **não é fixa em 48h/72h para todos os casos.** Os limiares são proporcionais à urgência do impacto operacional da solicitação.

#### Tabela oficial de escalada

| Nível de impacto | Definição | Limiar de escalada para Admin | Alerta de proximidade para Supervisor |
|---|---|---|---|
| **Crítico** | Atividade afetada começa em menos de 24h | **6 horas** sem resposta | 3 horas (50% do limiar) |
| **Alto** | Atividade afetada em 1 a 7 dias | **24 horas** sem resposta | 12 horas (50% do limiar) |
| **Médio** | Atividade afetada em 7 a 30 dias | **48 horas** sem resposta | 24 horas (50% do limiar) |
| **Baixo** | Atividade em > 30 dias ou sem impacto operacional direto (ex: Administrativa) | **72 horas** sem resposta | 36 horas (50% do limiar) |

#### Justificativa de cada limiar

**Crítico — 6 horas:**
Uma solicitação Crítica afeta atividade que começa em menos de 24h. Se o Supervisor não age em 6h, o Admin precisa ter tempo hábil para intervir antes da atividade. Com escalada em 6h, o Admin recebe o caso com pelo menos 18h de antecedência — tempo suficiente para tomar decisão e comunicar o Membro.

**Alto — 24 horas:**
Atividade em até 7 dias. O Supervisor precisa de tempo para analisar o impacto e, se necessário, reorganizar a cobertura. 24h de silêncio é o sinal de que a análise está travada e o Admin deve estar ciente.

**Médio — 48 horas:**
Atividade distante o suficiente para não ser emergência imediata, mas próxima o suficiente para não ser ignorada. 48h é o limiar adequado para uso normal.

**Baixo — 72 horas:**
Sem urgência operacional direta. O Admin monitora como indicador de gestão, não como risco imediato.

#### Alertas de proximidade (L-09)

O sistema não espera o limiar ser atingido para alertar. Dois alertas progressivos:

**Alerta 1 — 50% do limiar:** Supervisor recebe lembrete in-app: *"Solicitação de [Membro] aguarda análise há [X] horas. Limiar de escalada em [Y] horas."* Não é push — é notificação in-app visível ao abrir o painel.

**Alerta 2 — 80% do limiar:** Supervisor recebe push notification urgente + Admin recebe prévia da pendência: *"Solicitação de [Membro] pode escalar para você em [X] horas se não for analisada."* O Admin não precisa agir ainda, mas está informado antecipadamente.

**Escalada no limiar (100%):** Admin recebe push com responsabilidade formal transferida. Supervisor recebe notificação de que o Admin assumiu.

#### Aplicação da tabela por tipo de solicitação

| Tipo de Solicitação | Nível de impacto padrão | Observação |
|---|---|---|
| Folga (data próxima < 24h) | Crítico | Calculado pela data de impacto, não pela data de envio |
| Folga (data em 1-7 dias) | Alto | |
| Folga (data em 7-30 dias) | Médio | |
| Troca de Folga | Alto ou Médio | Conforme data de impacto |
| Restrição | Alto | Impacto duradouro justifica escalada mais rápida |
| Ajuste de Escala | Calculado pela data da atividade | |
| Chegada Tardia / Saída Antecipada | Calculado pela data da atividade | |
| Excepcional | Calculado pela data de impacto declarada | |
| Administrativa — Urgência Alta | Baixo (sobreposto por push direto ao Supervisor) | A urgência Alta não muda a tabela de escalada |
| Administrativa — Normal/Baixa | Baixo | |

---

## PARTE 4 — VISÃO DO MEMBRO (Requerente)

---

### 4.1 O que o Membro precisa desta superfície

O Membro usa S-06 em dois modos:

**Modo Criação:** Quando tem um pedido a fazer. Precisa escolher o tipo certo, preencher o mínimo necessário e ter confirmação imediata.

**Modo Acompanhamento:** Quando quer saber o que está acontecendo. Precisa ver o estado de cada solicitação sem abrir uma por uma.

A pesquisa aponta que **Acompanhamento é mais importante que o ato de criar** (D4 — Pesquisa de Membro). O formulário é apenas o início. O que o Membro realmente quer é a resposta: está sendo visto? Está sendo analisado? O que foi decidido?

---

### 4.2 Lista de Solicitações — visão do Membro

**O que aparece na lista (sem precisar abrir):**
- Tipo de solicitação (em linguagem amigável)
- Data(s) impactadas
- **Estado atual** — sempre visível, sempre legível
- Tempo no estado atual ("há 2 dias", "há 3 horas")
- Indicador de ação necessária quando o Membro precisa agir

**Ordenação:**
1. **Ação necessária do Membro** (topo — badge de destaque)
2. **Em andamento** — por data de impacto (mais próxima primeiro)
3. **Decididas recentemente** — últimos 7 dias
4. **Histórico** — via "ver mais antigas"

---

### 4.3 Fluxo de criação de uma Solicitação

**Passo 1 — Escolha do tipo:** Apresentado em linguagem natural. O sistema pode sugerir o tipo com base em descrição livre, ou o Membro escolhe diretamente.

**Prevenção de duplicata:** antes de apresentar o formulário, o sistema verifica solicitação similar em aberto e exibe aviso: *"Você já tem uma solicitação de folga para o dia 21 em análise. Quer abrir mesmo assim?"*

**Passo 2 — Preenchimento:** Campos mínimos necessários por tipo. O sistema não exige mais do que o necessário para análise.

**Cache local:** o formulário em preenchimento é salvo temporariamente em memória local do dispositivo. Se o app for fechado acidentalmente durante o preenchimento, o rascunho é recuperado na próxima abertura. Não existe estado RASCUNHO no backend — apenas cache local que expira em 24h.

**Passo 3 — Envio e confirmação imediata:** confirmação visual + informacional:
- *"Solicitação enviada e encaminhada para Supervisor [Nome]"*
- Data e hora do envio
- Estado inicial: "Enviada — aguardando análise"

---

### 4.4 Visualização de uma Solicitação individual

**Cabeçalho fixo:** Tipo (amigável) + Estado atual com ícone de cor + Data(s) impactadas

**Linha do tempo simplificada:**
- Enviada em [data/hora]
- Visualizada pelo Supervisor em [data/hora] (quando disponível)
- [Transições subsequentes com timestamps]

**Conteúdo do pedido:** o que foi solicitado

**Decisão (quando decidida):** resultado + motivo (negativa e revogação: sempre presente) + data + nome do decisor

**Ações por estado:**
- ENVIADA ou EM ANÁLISE → [Cancelar solicitação]
- PROPOSTA ALTERNATIVA → [Aceitar] [Recusar] [Enviar mensagem]
- AGUARDANDO INFORMAÇÃO → [Responder agora]
- EXPIRADA → apenas leitura — Membro aguarda nova ação do Supervisor
- APROVADA, NEGADA, REVOGADA → [Abrir conversa] (→ S-09 com contexto pré-carregado)

---

### 4.5 O que o Membro nunca deve precisar fazer

- Abrir cada solicitação para descobrir o estado
- Perguntar ao Supervisor "você viu meu pedido?"
- Enviar solicitação duplicada por não saber que a primeira estava em análise
- Receber negativa ou revogação sem entender o motivo
- Ficar sem qualquer sinal por mais de [limiar proporcional] horas

---

## PARTE 5 — VISÃO DO SUPERVISOR (Aprovador)

---

### 5.1 O que o Supervisor precisa desta superfície

**Modo Análise Ativa:** processar solicitações pendentes.
**Modo Monitoramento:** passivo — solicitações aparecem no Painel Operacional (S-02) quando existem pendências.

A **análise de impacto** é o elemento central. Antes de ver qualquer botão de decisão, o Supervisor vê o que esta solicitação significa operacionalmente.

---

### 5.2 Lista de Solicitações — visão do Supervisor

**O que aparece na lista (sem precisar abrir):**
- Nome do Membro + Tipo + Data(s) solicitadas
- **Nível de impacto operacional:** Baixo / Médio / Alto / Crítico
- Tempo desde o envio
- Estado atual

**Ordenação:** por urgência e impacto operacional — nunca por data de criação:
1. Crítico — atividade em < 24h (topo absoluto)
2. Alto — atividade em até 7 dias
3. Médio — atividade em até 30 dias
4. Baixo — atividade distante ou sem impacto operacional direto

---

### 5.3 Visão consolidada de solicitações relacionadas (L-05)

Quando existem **2 ou mais Solicitações para a mesma data**, a interface do Supervisor apresenta agrupamento visual com alerta:

> *"3 solicitações para o dia 21/06 — recomendamos analisar o impacto consolidado antes de decidir individualmente."*

**O Supervisor pode:**
- Ignorar o alerta e analisar individualmente (permitido — não é bloqueio)
- Acessar a **Visão de Impacto Consolidado** antes de abrir qualquer solicitação individual

**Visão de Impacto Consolidado:**
- Lista de todos os Membros com solicitação para aquela data (pendentes e já decididas)
- Papéis cobertos por cada um
- Percentual de cobertura do grupo **se todas as pendentes forem aprovadas**
- Papéis que ficariam descobertos no cenário de aprovação total
- Papéis que ficariam descobertos com aprovação parcial (simulação com N aprovadas)

**Atualização em tempo real:** À medida que o Supervisor aprova individualmente, o Bloco 3 (acumulado) de cada próxima solicitação reflete as aprovações já feitas. A Visão Consolidada também se atualiza.

**Agrupamento adicional:** Quando múltiplas solicitações afetam o mesmo papel ou função, o sistema pode agrupar por papel além de por data: *"2 solicitações afetam o papel de Astrid no Musical das 14h."*

---

### 5.4 Análise de uma Solicitação individual

**Bloco 1 — O Pedido:** quem, o que, para quando, motivo declarado.

**Bloco 2 — Impacto Operacional (IA):**
- Atividades afetadas nas datas solicitadas
- Papéis que este Membro cobre → nível de risco de cada um
- Candidatos disponíveis para cobertura

**Bloco 3 — Acumulado de Folgas nas Mesmas Datas:**
- Folgas já aprovadas para as mesmas datas no grupo (atualizado em tempo real)
- Percentual de cobertura restante do grupo se esta solicitação for aprovada
- Nomes dos outros Membros já com ausência aprovada para as mesmas datas

Estes três blocos são **mandatórios e não podem ser omitidos ou minimizados** antes das opções de decisão.

**Bloco 4 — Decisão:**
- [Aprovar]
- [Negar] → campo de motivo obrigatório (bloqueio técnico)
- [Propor alternativa] → campo de data(s) alternativas + justificativa + prazo de resposta
- [Solicitar informação] → disponível apenas para Tipo 3, máx. 2x por solicitação

---

### 5.5 Regra inegociável: motivo obrigatório em toda decisão contrária

O sistema **bloqueia o envio** de:
- Negativa sem motivo preenchido
- Revogação sem motivo preenchido

Aplica-se ao Supervisor e ao Admin. Sem exceção.

Prompt de exemplo no campo: *"Ex: Você é a única titular de Astrid disponível nesta data"* ou *"Ex: Cobertura do grupo já está no limite mínimo."*

---

### 5.6 Fluxo de proposta alternativa

1. Supervisor seleciona "Propor alternativa"
2. Informa data(s) alternativas disponíveis + justificativa + prazo de resposta (padrão sugerido: 48h)
3. Envia → Membro recebe notificação + estado PROPOSTA ALTERNATIVA
4. Se prazo vence sem resposta → estado EXPIRADA → Supervisor recebe notificação para nova ação

---

### 5.7 Fluxo de revogação de aprovação (L-02)

1. Supervisor acessa a solicitação em estado APROVADA
2. Botão [Revogar aprovação] disponível apenas se a data efetiva da folga ainda não ocorreu
3. Sistema exibe aviso com impacto: *"Revogar esta aprovação irá restaurar [Membro] como disponível em [data] e reverter a Escala. Confirme o motivo da revogação."*
4. Supervisor preenche motivo obrigatório + confirma
5. Estado → REVOGADA. Escala revertida. Membro notificado.
6. Se Livro do Dia da data afetada já foi gerado: alerta adicional ao Supervisor para revisão do Livro.

**O botão [Revogar aprovação] não está disponível** se a data efetiva da folga já passou — a decisão histórica é imutável.

---

### 5.8 Análise em lote pelo Supervisor

- Ao decidir uma solicitação, o sistema avança automaticamente para a próxima na fila de prioridade
- Progresso visível: "3 de 7 solicitações analisadas"
- O Supervisor pode interromper a sequência a qualquer momento

---

### 5.9 Notificações recebidas pelo Supervisor

| Evento | Tipo |
|---|---|
| Nova solicitação — impacto Crítico ou Alto | Push + badge |
| Nova solicitação — impacto Médio ou Baixo | Badge no painel |
| Solicitação Administrativa — Urgência Alta | Push + destaque na lista |
| Membro respondeu proposta alternativa | In-app |
| Membro respondeu pedido de informação | In-app |
| Alerta de proximidade (50% do limiar) | In-app |
| Alerta de proximidade (80% do limiar) | Push |
| Proposta alternativa expirada (EXPIRADA) | Push — ação necessária |
| Restrição Médica atingiu data de revisão | In-app |

---

## PARTE 6 — VISÃO DO ADMIN (Monitor)

---

### 6.1 O Admin não é aprovador primário

O Admin entra em S-06 em situações específicas:

**A — Escalada por limiar:** Solicitação atingiu o limiar proporcional sem resposta. Admin recebe responsabilidade formal e pode aprovar/negar.

**B — Investigação de padrão:** Usa dados de Solicitações como indicador de saúde operacional.

**C — Supervisão de continuidade:** Admin atua quando Supervisor está ausente ou foi desligado (seção 7 — Governança).

---

### 6.2 O que o Admin monitora em S-06

**Indicadores de tempo:**
- Tempo médio de resposta por Supervisor (semana atual vs. média histórica)
- Solicitações em estado ENVIADA ou EM ANÁLISE próximas do limiar (alerta de proximidade)
- Solicitações em EXPIRADA aguardando nova ação do Supervisor
- Volume de solicitações por período

**Indicadores de padrão:**
- Tipos mais frequentes por operação
- Taxa de aprovação vs. negação por Supervisor
- Reincidência: Membros que repetem o mesmo tipo de solicitação (sinal de problema estrutural)
- Concentração: grupo com volume anormalmente alto para uma mesma data

**Indicadores de saúde:**
- Solicitações sem responsável (grupo sem Supervisor ativo)
- Volume de escaladas para Admin por período (crescendo = sinal de gestão ineficaz)
- Revogações: frequência indica instabilidade de decisão

---

### 6.3 Alertas de proximidade — visão do Admin (L-09)

O Admin não aguarda o limiar ser atingido para ser informado. Recebe prévia progressiva:

**80% do limiar:** Admin recebe notificação in-app de pendência iminente, com contexto: *"Solicitação de [Membro] sob responsabilidade de [Supervisor] atingirá o limiar de escalada em [X] horas."* O Admin está informado mas a responsabilidade ainda é do Supervisor.

**100% do limiar:** Admin recebe push. Responsabilidade formal transferida. Supervisor notificado de que o Admin assumiu.

Esse modelo garante que o Admin **nunca seja surpreendido** por uma escalada sem contexto prévio.

---

### 6.4 Acesso direto do Admin a Solicitações individuais

O Admin pode abrir qualquer Solicitação de qualquer operação. Vê:
- Histórico completo de estados com timestamps
- Se e quando o Supervisor visualizou
- Decisões tomadas e motivos
- Metadados de padrão: Nth solicitação deste tipo deste Membro nos últimos 30 dias

Acesso investigativo — não operacional rotineiro.

---

### 6.5 Quando o Admin intervém como aprovador

Ao receber uma solicitação via escalada:
- Aprova/nega com os mesmos campos do Supervisor (motivo obrigatório em decisões contrárias)
- Pode revogar uma aprovação anterior (incluindo de outro Supervisor) se circunstância justificar
- A ação do Admin é registrada com indicador: *"Decidida pelo Admin em [data] após [X] horas sem resposta do Supervisor [Nome]."*

---

## PARTE 7 — REGRAS DE NEGÓCIO CRÍTICAS

---

### 7.1 Regras absolutas (não negociáveis)

**R01 — Motivo obrigatório em toda decisão contrária**
Sistema bloqueia envio de: Negativa sem motivo, Revogação sem motivo. Aplica-se a Supervisor e Admin. Sem exceção.

**R02 — Estado sempre visível sem abrir o item**
Para o Membro, o estado de cada solicitação é legível na lista sem clique adicional.

**R03 — Análise de impacto antes dos botões de decisão**
O Supervisor vê impacto operacional (Blocos 1, 2, 3) antes de qualquer opção de aprovação/negação.

**R04 — Acumulado de folgas na mesma tela de análise**
Para Folgas e Trocas de Folga, o acumulado de aprovações nas mesmas datas está visível sem clique adicional. Atualizado em tempo real à medida que aprovações são feitas na fila.

**R05 — Ordenação por urgência de impacto para o Supervisor**
Lista de solicitações pendentes do Supervisor: sempre ordenada por urgência de impacto, nunca por data de criação.

**R06 — Prevenção de duplicata**
Antes de criar, o sistema verifica e alerta sobre solicitações similares em aberto. O Membro pode prosseguir confirmando.

**R07 — Escalada proporcional automática**
Os limiares da seção 3.5 são aplicados automaticamente. Não exigem configuração manual por operação.

**R08 — EXPIRADA não é terminal**
Estado EXPIRADA reabre a responsabilidade no Supervisor — não encerra a solicitação sem decisão.

**R09 — REVOGADA exige motivo e impacta Escala automaticamente**
Revogação sem motivo é bloqueada. Revogação aprovada reverte a Escala imediatamente.

**R10 — Limite de rodadas em AGUARDANDO INFORMAÇÃO**
Máximo de 2 pedidos de informação por solicitação. Sistema bloqueia o terceiro.

---

### 7.2 Regras de comportamento do sistema

**R11 — Confirmação imediata de recebimento**
Ao submeter, o Membro vê: nome do Supervisor, timestamp, estado inicial ENVIADA.

**R12 — Transição automática ENVIADA → EM ANÁLISE**
Quando o Supervisor abre a solicitação, a transição acontece automaticamente.

**R13 — Cache local de formulário em preenchimento**
Formulário em progresso salvo localmente por 24h. Recuperável ao reabrir o app. Não gera estado backend.

**R14 — Aprovação reflete automaticamente na Escala e Meu Dia**
Para Folga, Troca (ambas as datas, seção 2.2) e Ajuste de Escala.

**R15 — Revogação disponível apenas antes da data efetiva**
Botão [Revogar aprovação] indisponível se a data efetiva da folga/ausência já ocorreu.

**R16 — Contexto pré-carregado em Mensagens**
Conversa iniciada a partir de Solicitação carrega contexto completo no S-09.

**R17 — Registro permanente no Histórico**
Toda solicitação e todas as transições — incluindo EXPIRADA e REVOGADA — registradas em S-11 como dados imutáveis.

---

### 7.3 Verificação retroativa — impacto de mudanças supervenientes (L-06)

O sistema realiza verificação retroativa automaticamente nos seguintes eventos:

**Evento: nova Restrição aprovada**
O sistema verifica: existe alguma Folga aprovada para datas futuras que dependia deste Membro como cobertura?
- Se sim: alerta ao Supervisor responsável pelas folgas afetadas
- Texto do alerta: *"A nova restrição de [Membro A] pode ter impacto em folgas já aprovadas: [lista de Membros com folgas aprovadas nas datas afetadas] dependiam de [Membro A] como cobertura. Revisar?"*
- O sistema não revoga automaticamente — alerta apenas

**Evento: cancelamento de show**
O sistema verifica: existem Folgas aprovadas para a data do show cancelado?
- Alerta ao Supervisor: *"[N] folgas aprovadas para [data do show cancelado]. Com o cancelamento, estas folgas continuam afetando: [outras atividades do dia, se existirem]. Deseja rever alguma delas?"*
- O sistema não revoga automaticamente

**Evento: mudança estrutural (grupo/Supervisor)**
Coberto na seção 8 — Governança.

**Princípio invariante:** O sistema nunca decide. O sistema informa com contexto. O Supervisor decide.

---

### 7.4 O que o sistema NÃO faz em S-06

- Não aprova nem nega automaticamente — sem exceção
- Não bloqueia criação — o Membro sempre pode criar (apenas alerta sobre duplicatas)
- Não oculta solicitações negadas ou revogadas — histórico completo sempre visível ao Membro
- Não permite reclassificar tipo após envio
- Não revoga aprovações cuja data efetiva já ocorreu
- Não decide pelo Supervisor quando uma verificação retroativa gera alerta

---

### 7.5 Encaminhamento de Solicitação Administrativa para Admin (L-08)

Quando o Supervisor encaminha uma Solicitação Administrativa para o Admin:

**Transferência de responsabilidade:** O Admin passa a ser o responsável formal. O Supervisor deixa de ser.

**Notificação ao Membro:** automática — *"Sua solicitação foi encaminhada pelo Supervisor [Nome] para o Admin em [data]."*

**Registro no Histórico:** *"Encaminhada por Supervisor [Nome] para Admin em [data/hora]. Motivo do encaminhamento: [texto opcional do Supervisor]."*

**Reinício dos prazos:** os limiares de escalada são reiniciados a partir do momento do encaminhamento. O Admin tem o mesmo janela proporcional (tabela 3.5) a partir da data de recebimento, não da data de criação original.

**Acesso do Supervisor após encaminhamento:** o Supervisor ainda pode ver a solicitação em modo leitura, mas não pode mais tomar decisão sobre ela.

---

## PARTE 8 — GOVERNANÇA E CONTINUIDADE (L-04 + L-07)

---

### 8.1 Ausência planejada do Supervisor (férias, afastamento)

O Supervisor deve designar um **Supervisor substituto** antes de entrar em período de ausência planejada. O sistema apresenta prompt ao Supervisor quando registra ausência futura: *"Você tem Solicitações pendentes e está de saída. Deseja designar um Supervisor substituto para este período?"*

**Quando substituto é designado:**
- Todas as Solicitações em aberto do grupo são **reatribuídas** para o substituto
- Novas Solicitações criadas durante o período são direcionadas ao substituto
- O Membro recebe notificação: *"Sua solicitação será analisada pelo Supervisor substituto [Nome] durante a ausência de [Supervisor original]."*
- Histórico registra: *"Reatribuída para Supervisor substituto [Nome] por ausência planejada de [Supervisor original] de [data] a [data]."*

**Quando substituto não é designado:**
- O sistema aplica a tabela de escalada normalmente — Solicitações escalam para o Admin conforme os limiares proporcionais
- Admin recebe contexto adicional: *"Supervisor [Nome] está em período de ausência. [N] solicitações pendentes sem substituto designado."*

---

### 8.2 Ausência emergencial do Supervisor

**Quando identificada** (o Supervisor para de acessar o sistema sem aviso e solicitações começam a escalar):
- Admin recebe alerta consolidado: *"Supervisor [Nome] não acessou o sistema há [X] horas. [N] Solicitações em processo de escalada."*
- Admin pode:
  - Assumir diretamente como aprovador temporário
  - Designar outro Supervisor como responsável temporário pelo grupo

**Reatribuição pelo Admin:**
- Admin seleciona o Supervisor temporário
- Todas as Solicitações em aberto são reatribuídas
- Membros notificados da mudança
- Histórico registra: *"Reatribuída pelo Admin por ausência emergencial do Supervisor [Nome] em [data]."*

---

### 8.3 Desligamento do Supervisor (L-07)

Quando um Supervisor é desligado da operação:

**Solicitações em aberto (ENVIADA, EM ANÁLISE, AGUARDANDO INFORMAÇÃO, PROPOSTA ALTERNATIVA, EXPIRADA):**
- Reatribuídas **automaticamente** para o Admin ou para o Supervisor substituto designado pelo Admin
- Membros notificados: *"Sua solicitação foi reatribuída para [novo responsável]."*
- Histórico: *"Reatribuída por desligamento do Supervisor [Nome] em [data]."*

**Solicitações em estado terminal (APROVADA, NEGADA, REVOGADA, CANCELADA):**
- Mantidas no histórico sem alteração
- Nome do Supervisor aparece como "[Nome] (desligado)" no histórico — nunca apagado

**Aprovações com efeitos futuros:**
- Permanecem válidas — não há motivo para revogar decisões corretas de um Supervisor desligado
- Se o Admin identificar que alguma aprovação específica precisa ser revista, usa o fluxo de Revogação (R09)

**Gap de responsabilidade:** O período entre o desligamento e a designação do substituto é coberto pelo Admin automaticamente. O sistema não permite que Solicitações fiquem sem responsável definido por mais de 24h após um desligamento.

---

### 8.4 Delegação em situações de conflito de autoridade

Quando dois Supervisores reivindicam responsabilidade sobre a mesma Solicitação (ex: Membro pertencia a dois grupos), o Admin é o árbitro. A Solicitação fica em estado de espera com alerta ao Admin. Não é situação comum mas deve ter responsável definido.

---

## PARTE 9 — INTEGRAÇÕES COM OUTRAS SUPERFÍCIES

---

### 9.1 Mapa de dependências

```
                    S-04 ESCALA
                    (calcula impacto,
                    candidatos,
                    verifica retroativamente)
                         │
                         ▼
S-01 MEU DIA ◄──── S-06 SOLICITAÇÕES ────► S-11 HISTÓRICO
(badge, reflexo                             (imutável, auditável,
de aprovações e                             inclui EXPIRADA e
revogações)                                 REVOGADA)
                         │
                    ┌────┴──────┐
                    ▼           ▼
               S-09 MSG     S-02/S-03
               (contexto     PAINEIS
               pré-carregado) (indicadores +
                              alertas de
                              proximidade)
```

---

### 9.2 Relação com S-04 — Escala

**Leitura:** S-06 depende de S-04 para calcular impacto de cada solicitação e para a verificação retroativa quando novas Restrições são aprovadas.

**Escrita:** Aprovações de Folga, Troca (ambas as datas) e Ajuste de Escala escrevem na Escala automaticamente. Revogações revertem a Escala automaticamente.

**Verificação retroativa:** quando nova Restrição é aprovada, S-06 consulta S-04 para identificar folgas aprovadas cuja cobertura dependia do Membro agora restrito.

---

### 9.3 Relação com S-01 — Meu Dia

- Badge quando existe solicitação aguardando ação do Membro (PROPOSTA ALTERNATIVA, AGUARDANDO INFORMAÇÃO)
- Reflexo de aprovações e revogações sem necessidade de atualização manual
- Estado resumido: *"1 solicitação em análise"* com link direto para S-06

---

### 9.4 Relação com S-09 — Mensagens

- Conversa iniciada a partir de qualquer Solicitação carrega contexto completo pré-carregado
- Ativado por: Membro após negativa ou revogação, Membro para contra-propor após proposta alternativa, qualquer parte para negociação adicional

---

### 9.5 Relação com S-11 — Histórico

O Histórico preserva para cada Solicitação:
- Tipo, data de criação, datas solicitadas
- Cada transição de estado com timestamp e responsável
- Motivos de todas as decisões contrárias (negativa, revogação)
- Propostas alternativas, respostas, expirações
- Encaminhamentos e reatribuições com contexto
- Ações de delegação de Supervisores

---

### 9.6 Relação com S-02 — Painel Operacional (Supervisor)

- Volume de solicitações pendentes + destaque visual para urgência Alta/Crítica
- Link direto para fila de análise
- Alerta de proximidade (80% do limiar) exibido no painel

---

### 9.7 Relação com S-03 — Painel Administrativo

- Tempo médio de resposta por Supervisor
- Solicitações em escalada (atingiram limiar)
- Solicitações em EXPIRADA aguardando ação do Supervisor
- Pré-alertas de proximidade (80% do limiar)
- Solicitações reatribuídas por ausência ou desligamento de Supervisor
- Taxa de revogação como indicador de instabilidade de decisão

---

## PARTE 10 — IA EM S-06

---

### 10.1 Princípio de uso

A IA opera em duas direções opostas:
- **Para o Supervisor:** analisa **antes** da ação — informa o impacto antes de apresentar opções de decisão
- **Para o Membro:** explica **depois** da decisão — responde "por que?" com contexto operacional

---

### 10.2 IA para o Supervisor — análise de impacto

Output antes das opções de decisão para Folga:
> *"Amanda solicitou folga no sábado 21. Ela cobre Astrid no Musical das 14h (papel único — sem substituto confirmado) e Bloco 3 do Ensaio das 16h (Beatriz pode cobrir). Carlos e Fernanda já têm folga aprovada nesse dia — o grupo estará com 60% da cobertura se esta folga for aprovada. Recomendo negociar data alternativa ou confirmar cobertura para Astrid antes de aprovar."*

A IA recomenda. O Supervisor decide.

---

### 10.3 IA para o Membro — explicação pós-decisão

- *"Por que minha folga foi negada?"* → IA explica contexto operacional da data
- *"Por que minha folga foi revogada?"* → IA explica a circunstância superveniente que motivou a revogação
- *"O que acontece com minha escala agora que minha folga foi aprovada?"* → lista mudanças automáticas
- *"Em que estado está minha solicitação?"* → estado atual com contexto de tempo

**Limite:** A IA clarifica o contexto operacional. Não contesta decisões do Supervisor nem recomenda que o Membro questione.

---

### 10.4 IA para o Admin — detecção de padrões

- *"Quais Supervisores têm maior tempo médio de resposta esta semana?"*
- *"Existem Membros com padrão recorrente de mesmo tipo de solicitação?"*
- *"Resuma o que aconteceu com esta solicitação específica."*
- *"Existe algum Supervisor com taxa de revogação anormalmente alta?"*

---

### 10.5 O que a IA não faz em S-06

- Não aprova, nega nem revoga — sem exceção
- Não gera as notificações automáticas (responsabilidade do sistema, não da IA)
- Não sugere ao Membro qual pedido tem mais chance de aprovação
- Não altera estado de qualquer solicitação

---

## PARTE 11 — CRITÉRIOS DE ACEITAÇÃO

---

### 11.1 Critérios para o Membro

| # | Critério | Como verificar |
|---|---|---|
| CM-01 | Estado legível na lista sem abrir o item | Lista com 7 solicitações em estados diferentes — todos legíveis sem clique |
| CM-02 | Confirmação imediata com nome do Supervisor e timestamp | Criar solicitação e verificar tela de confirmação |
| CM-03 | Transição ENVIADA → EM ANÁLISE ao Supervisor abrir | Supervisor abre; Membro atualiza lista e vê "Em análise" |
| CM-04 | Negativa sempre com motivo — campo vazio bloqueia envio | Tentar negar sem motivo; sistema impede |
| CM-05 | Aviso de duplicata antes de criar solicitação sobreposta | Criar folga dia 21; tentar criar segunda folga dia 21; alerta aparece |
| CM-06 | Proposta alternativa exibe prazo de resposta | Supervisor cria proposta; Membro vê prazo na lista |
| CM-07 | Aprovação de folga reflete automaticamente em Meu Dia | Aprovar folga; Meu Dia atualizado sem ação do Membro |
| CM-08 | Troca de folga aprovada restaura data original E bloqueia nova data | Aprovar Troca; verificar Escala em ambas as datas |
| CM-09 | Estado EXPIRADA visível quando proposta vence sem resposta | Simular vencimento de prazo; Membro vê EXPIRADA na lista |
| CM-10 | Revogação sempre com motivo visível | Supervisor revoga; Membro vê motivo na solicitação |
| CM-11 | Formulário recuperado após fechamento acidental do app | Iniciar preenchimento; fechar app; reabrir; rascunho disponível |

---

### 11.2 Critérios para o Supervisor

| # | Critério | Como verificar |
|---|---|---|
| CS-01 | Lista ordenada por urgência de impacto, não por data de criação | Criar folga amanhã e folga em 3 semanas; folga de amanhã aparece primeiro |
| CS-02 | Análise de impacto visível antes dos botões de decisão | Abrir folga; Blocos 1, 2, 3 aparecem antes de qualquer botão |
| CS-03 | Acumulado de folgas visível sem clique adicional | Abrir folga para dia com outras folgas aprovadas; bloco de acumulado na mesma tela |
| CS-04 | Acumulado atualiza em tempo real a cada aprovação na fila | Aprovar folga de Carolina; abrir folga de Amanda para mesma data; acumulado mostra Carolina aprovada |
| CS-05 | Visão consolidada apresentada quando 2+ solicitações para mesma data | Criar 2 folgas para dia 21; Supervisor vê agrupamento e opção de ver impacto consolidado |
| CS-06 | Negativa bloqueia sem motivo | Tentar negar sem preencher motivo; sistema impede |
| CS-07 | Proposta alternativa expira e gera estado EXPIRADA + notificação ao Supervisor | Simular vencimento; verificar EXPIRADA + push ao Supervisor |
| CS-08 | Supervisor age após EXPIRADA; estado retorna a EM ANÁLISE | Supervisor propõe nova alternativa; estado atualizado corretamente |
| CS-09 | Revogação reverte Escala automaticamente | Revogar aprovação; verificar S-04 com disponibilidade restaurada |
| CS-10 | Alerta de proximidade em 50% e 80% do limiar | Simular solicitação sem resposta; verificar alertas progressivos |
| CS-11 | Terceiro pedido de informação bloqueado | Usar "Solicitar informação" 2x; verificar bloqueio da terceira tentativa |
| CS-12 | Supervisão em lote avança automaticamente entre solicitações | Decidir 3 solicitações em sequência; verificar avanço automático |

---

### 11.3 Critérios para o Admin

| # | Critério | Como verificar |
|---|---|---|
| CA-01 | Tempo médio de resposta por Supervisor visível em S-03 | Múltiplas solicitações decididas; verificar indicador por Supervisor |
| CA-02 | Alerta de proximidade em 80% do limiar antes da escalada | Simular 80% do limiar; Admin recebe prévia |
| CA-03 | Escalada ao limiar gera push ao Admin com responsabilidade formal | Simular 100% do limiar; verificar push + transferência de responsabilidade |
| CA-04 | Admin pode aprovar/negar/revogar em solicitações escaladas | Admin abre solicitação escalada; opções de decisão disponíveis |
| CA-05 | Solicitações em EXPIRADA aparecem no painel do Admin | Simular expiração; verificar item no painel de S-03 |
| CA-06 | Desligamento de Supervisor reatribui solicitações em aberto | Desligar Supervisor; verificar reatribuição automática e notificação aos Membros |
| CA-07 | Encaminhamento de Administrativa para Admin reinicia prazos | Supervisor encaminha; verificar novo prazo a partir da data de encaminhamento |
| CA-08 | Histórico de Supervisor desligado preservado com indicador | Verificar solicitação de Supervisor desligado em S-11; nome marcado, não apagado |

---

### 11.4 Critérios de sistema

| # | Critério |
|---|---|
| CD-01 | Toda transição registrada em S-11 com timestamp e responsável — incluindo EXPIRADA, REVOGADA, reatribuições |
| CD-02 | Aprovação de Folga e Troca não exige ação em S-04 — propagação automática, ambas as datas para Troca |
| CD-03 | Restrição aprovada impacta motor de candidatos de S-04 imediatamente |
| CD-04 | Verificação retroativa executada automaticamente quando nova Restrição é aprovada |
| CD-05 | Tabela de escalada proporcional aplicada automaticamente por tipo e urgência de impacto |
| CD-06 | Alertas de proximidade (50% e 80%) disparados automaticamente sem ação manual |
| CD-07 | Cache local do formulário expira em 24h |

---

### 11.5 Critérios de qualidade de experiência

| # | Critério |
|---|---|
| CX-01 | Nenhuma solicitação em limbo sem estado visível por mais de [limiar proporcional] |
| CX-02 | O Membro nunca precisa abrir uma solicitação individual para saber se precisa agir |
| CX-03 | O Supervisor nunca decide sobre impacto que o sistema poderia ter calculado |
| CX-04 | Toda decisão contrária (negativa, revogação) contém motivo — sem exceção |
| CX-05 | Aprovação e revogação refletem em Meu Dia sem atualização manual do Membro |
| CX-06 | O Admin nunca é surpreendido por uma escalada sem prévia de 80% |
| CX-07 | Nenhuma solicitação fica sem responsável definido após saída de Supervisor |

---

## PARTE 12 — MINI-AUDITORIA FINAL

---

### 12.1 Existe algum estado sem responsável definido?

**Não.**

| Estado | Responsável pela próxima ação |
|---|---|
| ENVIADA | Supervisor (ou Admin após limiar proporcional) |
| EM ANÁLISE | Supervisor (ou Admin após limiar proporcional) |
| AGUARDANDO INFORMAÇÃO | Membro |
| PROPOSTA ALTERNATIVA | Membro (ou Supervisor se prazo vencer → EXPIRADA) |
| EXPIRADA | Supervisor (notificado imediatamente via push) |
| APROVADA | Nenhum — estado estável. Se circunstância mudar: Supervisor age via Revogação |
| NEGADA | Nenhum — estado terminal |
| REVOGADA | Nenhum — estado terminal |
| CANCELADA | Nenhum — estado terminal |

---

### 12.2 Existe algum estado sem saída definida?

**Não.**

Todo estado tem saídas explícitas mapeadas na tabela 3.3. EXPIRADA — que na v1 era lacuna — agora tem saída definida: Supervisor age → EM ANÁLISE.

---

### 12.3 Existe algum cenário sem dono?

**Não.** Cenários anteriormente sem dono, agora cobertos:

| Cenário | Dono definido |
|---|---|
| Proposta alternativa não respondida | EXPIRADA → Supervisor (push obrigatório) |
| Aprovação que se torna inviável | Verificação retroativa alerta o Supervisor; Supervisor decide sobre Revogação |
| Supervisor de férias sem substituto | Admin assume via escalada proporcional com contexto de ausência |
| Supervisor desligado | Admin reatribui automaticamente em até 24h |
| Solicitação Administrativa encaminhada | Admin assume formalmente; prazos reiniciam |
| Conflito de autoridade entre Supervisores | Admin é árbitro definido |

---

### 12.4 Existe algum limbo operacional?

**Não.**

Definição de limbo: estado em que a solicitação existe no sistema sem nenhum agente responsável e sem saída definida.

Todos os estados têm responsável e saída. A escalada proporcional garante que nenhum estado de responsabilidade do Supervisor pode durar indefinidamente sem o Admin ser acionado. O estado EXPIRADA tem saída e responsável. Reatribuições por ausência ou desligamento cobrem o gap entre Supervisores.

---

### 12.5 Existe alguma solicitação que possa ficar esquecida indefinidamente?

**Não.**

O sistema de alertas progressivos (50% + 80% + 100% de cada limiar proporcional) garante que qualquer solicitação sem resposta gera alertas progressivos ao Supervisor e, no limiar, escalada formal ao Admin. EXPIRADA também gera push ao Supervisor imediatamente.

Não existe estado em que a solicitação pode envelhecer sem que nenhum agente seja notificado.

---

### 12.6 Existe alguma aprovação que não possa ser revisada quando o contexto muda?

**Não** — com a ressalva correta.

A Revogação (L-02) cobre todos os cenários de revisão de aprovações. A única limitação é que Revogação não está disponível após a data efetiva da folga/ausência já ter ocorrido — o que é correto: uma decisão histórica é imutável.

Se o contexto mudou e a data ainda não ocorreu: Supervisor pode revogar.
Se a data já ocorreu: a decisão é histórica e não revisável — comportamento correto.

---

### 12.7 Existe algum caso onde o sistema perde rastreabilidade?

**Não.**

Todos os eventos com impacto no ciclo de vida de uma Solicitação são registrados em S-11:
- Transições de estado com timestamps e responsáveis
- Motivos de todas as decisões contrárias
- Reatribuições por ausência, desligamento ou encaminhamento — com contexto
- Estado EXPIRADA com data e hora do vencimento
- Ações do Admin distinguidas de ações do Supervisor no histórico
- Nome do Supervisor desligado preservado (nunca apagado)

---

## PARTE 13 — VEREDITO FINAL

---

### Resultado da mini-auditoria

Todas as 7 perguntas da mini-auditoria resultaram em **Não** para lacunas. Nenhum estado sem responsável, nenhum estado sem saída, nenhum cenário sem dono, nenhum limbo operacional, nenhuma solicitação que possa ser esquecida, nenhuma aprovação irreviável dentro do prazo, rastreabilidade completa em todos os fluxos.

### Lacunas resolvidas

| Lacuna | Status |
|---|---|
| L-01 Estado EXPIRADA | ✅ Incorporado — seção 3.2, 3.3, 3.5, 7.1 |
| L-02 Estado REVOGADA | ✅ Incorporado — seção 3.2, 3.3, 5.7, 7.1 |
| L-03 Escalada proporcional | ✅ Incorporado — seção 3.5 com tabela oficial e justificativas |
| L-04 Delegação temporária de Supervisor | ✅ Incorporado — seção 8.1 e 8.2 |
| L-05 Visão consolidada de solicitações relacionadas | ✅ Incorporado — seção 5.3 |
| L-06 Verificação retroativa | ✅ Incorporado — seção 7.3 |
| L-07 Solicitações de Supervisor desligado | ✅ Incorporado — seção 8.3 |
| L-08 Encaminhamento para Admin | ✅ Incorporado — seção 7.5 |
| L-09 Alertas de proximidade | ✅ Incorporado — seção 3.5 e 6.3 |
| L-10 Restauração de disponibilidade em Troca de Folga | ✅ Incorporado — seção 2.2 (Tipo 2) |
| L-11 Limite de ciclos em AGUARDANDO INFORMAÇÃO | ✅ Incorporado — seção 2.3 (Tipo 3) e R10 |
| L-12 Data de revisão obrigatória para Restrições Médicas | ✅ Incorporado — seção 2.4 (Tipo 4) |
| L-13 Comportamento da urgência em Solicitação Administrativa | ✅ Incorporado — seção 2.8 (Tipo 8) |

---

# 🟢 PRONTA PARA WIREFRAME

A especificação funcional de S-06 Solicitações está encerrada. Todas as lacunas estruturais identificadas pela Auditoria de Cenários Limite foram incorporadas formalmente. A mini-auditoria final não encontrou novas lacunas estruturais.

A superfície pode avançar para a fase de wireframe sem pendências em aberto.
