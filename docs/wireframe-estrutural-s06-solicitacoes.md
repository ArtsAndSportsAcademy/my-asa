# WIREFRAME ESTRUTURAL — S-06 SOLICITAÇÕES
## MyASA 2.0 — Bloco 2

> **Fase:** Wireframe Estrutural — posterior à especificação funcional, anterior ao mockup visual
> **Objetivo:** Verificar se a interface consegue representar corretamente tudo o que foi decidido na especificação
> **Viewport de referência:** iPhone 14 Pro — 390 × 844
> **Notação:** `[ ]` = botão · `( )` = campo de entrada · `●` = badge/indicador · `▸` = expansível · `—` = divisor · `⬆⬇` = scroll
> **Status:** 🟢 Pronto para Mockup

---

## PERFIL 1 — MEMBRO

---

### W1 — Lista de Solicitações (Membro)

**Objetivo:** Membro vê estado de todas as solicitações sem precisar abrir nenhuma.

```
┌─────────────────────────────────────────┐
│  ←  Solicitações                ● 2     │  ← Nav header + badge de ação necessária
├─────────────────────────────────────────┤
│  [ + Nova solicitação           ▸ ]     │  ← CTA principal sempre visível no topo
├─────────────────────────────────────────┤
│                                         │
│  AÇÃO NECESSÁRIA  ────────────────────  │  ← Seção 1: itens que exigem ação do Membro
│                                         │  ← Aparece apenas quando existem itens
│  ┌─────────────────────────────────┐   │
│  │ ● Pedir folga        Sáb 21/06  │   │
│  │   PROPOSTA ALTERNATIVA          │   │  ← Estado em destaque visual
│  │   Supervisor propôs: Dom 22/06  │   │  ← Conteúdo da proposta resumido
│  │   ⏱ Prazo: 19h restantes        │   │  ← Prazo: PROEMINENTE, impossível de ignorar
│  │   [ Responder agora           ] │   │  ← Ação inline — não exige abrir o item
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ ● Pedir algo diferente  Ter 18  │   │
│  │   AGUARDANDO INFORMAÇÃO         │   │
│  │   "Qual o motivo específico...?" │   │  ← Preview da pergunta do Supervisor
│  │   [ Responder agora           ] │   │
│  └─────────────────────────────────┘   │
│                                         │
│  EM PROCESSO  ─────────────────────────  │  ← Seção 2: solicitações em andamento
│                                         │
│  ┌─────────────────────────────────┐   │
│  │   Pedir folga        Sex 28/06  │   │
│  │   EM ANÁLISE · há 6 horas       │   │  ← Estado + tempo decorrido
│  │   Supervisor Ana Silva           │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │   Pedir folga        Dom 29/06  │   │
│  │   EXPIRADA                      │   │
│  │   Aguardando nova decisão       │   │  ← Estado EXPIRADA: informativo, sem ação do Membro
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │   Pedir chegada tardia  Qui 19  │   │
│  │   ENVIADA · há 2 horas          │   │
│  │   Aguardando análise            │   │
│  └─────────────────────────────────┘   │
│                                         │
│  DECIDIDAS RECENTEMENTE  ──────────────  │  ← Seção 3: últimos 7 dias
│                                         │
│  ┌─────────────────────────────────┐   │
│  │   Pedir folga        Seg 16/06  │   │
│  │   ✓ APROVADA · 2 dias atrás     │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │   Corrigir minha escala         │   │
│  │   ✕ NEGADA · 3 dias atrás       │   │
│  │   "Posição já confirmada com..." │   │  ← Preview do motivo (parcial)
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │   Pedir folga        Qui 12/06  │   │
│  │   ✕ REVOGADA · 5 dias atrás     │   │
│  │   "Nova restrição eliminou..."   │   │  ← Preview do motivo de revogação
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │   Reportar limitação  Ago–indef │   │
│  │   ✓ APROVADA · 1 semana atrás   │   │
│  └─────────────────────────────────┘   │
│                                         │
│  [ Ver solicitações anteriores    ▸ ]   │  ← Acesso ao histórico completo
│                                         │
└─────────────────────────────────────────┘
│  Meu Dia │ Solicitações │ Entregas │ Msg │  ← Nav permanente
```

**Validações:**
- ✅ Estado visível sem abrir (em todos os itens)
- ✅ Ação necessária evidente (seção separada + botão inline)
- ✅ Prazo de Proposta Alternativa proeminente ("19h restantes" — não em texto pequeno)
- ✅ EXPIRADA informativa, sem ação do Membro
- ✅ Motivo de negativa e revogação em preview — motivo nunca vazio
- ✅ Ordenação: ação necessária → em processo → decididas recentes

---

### W2 — Criar Solicitação (Membro)

**Objetivo:** Fluxo de criação com mínimo esforço, prevenção de duplicidade e confirmação clara.

**Etapa 1 — Escolha do tipo:**
```
╔═════════════════════════════════════════╗
║  ETAPA 1 de 3                           ║
╠═════════════════════════════════════════╣

  O que você precisa pedir?

  ┌─────────────────────────────────────┐
  │  Pedir folga                      ▸ │
  ├─────────────────────────────────────┤
  │  Trocar minha folga               ▸ │
  ├─────────────────────────────────────┤
  │  Pedir saída antecipada           ▸ │
  ├─────────────────────────────────────┤
  │  Pedir chegada tardia             ▸ │
  ├─────────────────────────────────────┤
  │  Corrigir ou ajustar minha escala ▸ │
  ├─────────────────────────────────────┤
  │  Reportar uma limitação           ▸ │
  ├─────────────────────────────────────┤
  │  Pedir algo diferente             ▸ │
  ├─────────────────────────────────────┤
  │  Pedido administrativo            ▸ │
  └─────────────────────────────────────┘

  [ ← Voltar ]
```

**Verificação de duplicidade (aparece antes do formulário se detectado):**
```
╔═════════════════════════════════════════╗
║  VERIFICAÇÃO DE DUPLICIDADE             ║
╠═════════════════════════════════════════╣

  ⚠ Você já tem uma solicitação de
  folga para o dia 21/06 em análise.

  ┌─────────────────────────────────────┐
  │  Pedir folga          Sáb 21/06    │
  │  EM ANÁLISE · há 6 horas           │
  └─────────────────────────────────────┘

  Quer continuar com um novo pedido
  mesmo assim?

  [ Abrir pedido existente     ]
  [ Continuar com novo pedido  ]
  [ ← Cancelar                ]
```

**Etapa 2 — Preenchimento (exemplo: Folga):**
```
╔═════════════════════════════════════════╗
║  ETAPA 2 de 3 — Pedir folga            ║
╠═════════════════════════════════════════╣

  Data da folga *
  ( __/__/____ )

  Período
  ( ) Dia inteiro
  ( ) Apenas a manhã
  ( ) Apenas a tarde
  ( ) Personalizado

  Motivo *
  ┌─────────────────────────────────────┐
  │                                     │  ← Texto livre, obrigatório
  └─────────────────────────────────────┘

  Observação adicional (opcional)
  ┌─────────────────────────────────────┐
  │                                     │
  └─────────────────────────────────────┘

  [ Continuar →                        ]
  [ ← Voltar — alterar tipo            ]
```

**Etapa 3 — Confirmação:**
```
╔═════════════════════════════════════════╗
║  ETAPA 3 de 3 — Confirmar              ║
╠═════════════════════════════════════════╣

  Verifique antes de enviar:

  ┌─────────────────────────────────────┐
  │  Pedir folga                        │
  │  Sábado, 21 de junho de 2026        │
  │  Dia inteiro                        │
  │  Motivo: Compromisso familiar       │
  └─────────────────────────────────────┘

  Será enviada para:
  Supervisora Ana Silva

  [ Enviar solicitação ✓             ]
  [ ← Editar                        ]
```

**Confirmação pós-envio:**
```
╔═════════════════════════════════════════╗
║  ENVIADA ✓                             ║
╠═════════════════════════════════════════╣

  Sua solicitação foi enviada e
  encaminhada para:

  Supervisora Ana Silva
  Enviada hoje, 17/06 às 14h37

  Estado atual:
  ┌─────────────────────────────────────┐
  │  ENVIADA — aguardando análise       │
  └─────────────────────────────────────┘

  A partir de agora você acompanha
  o andamento aqui em Solicitações.

  [ Ver minhas solicitações            ]
```

**Validações:**
- ✅ Mínimo esforço (3 etapas: tipo → campos → confirmar)
- ✅ Prevenção de duplicidade antes do formulário
- ✅ Confirmação clara com todos os dados antes do envio
- ✅ Confirmação pós-envio com supervisor nomeado e timestamp

---

### W3 — Acompanhamento de Solicitação (Membro)

**Objetivo:** Membro abre uma solicitação e vê tudo — linha do tempo, decisão, motivo, ações disponíveis.

**Variante: NEGADA**
```
┌─────────────────────────────────────────┐
│  ←  Pedir folga              ✕ NEGADA  │
├─────────────────────────────────────────┤
│                                         │
│  Sábado, 21 de junho de 2026            │
│  Dia inteiro                            │
│                                         │
├─────────────────────────────────────────┤
│  LINHA DO TEMPO                         │
│                                         │
│  ● Enviada                              │
│    17/06/2026 · 14h37                   │
│                                         │
│  ● Em análise                           │
│    17/06/2026 · 16h02                   │
│    Supervisora Ana Silva                │
│                                         │
│  ● Negada                               │
│    17/06/2026 · 18h15                   │
│    Supervisora Ana Silva                │
│                                         │
├─────────────────────────────────────────┤
│  PEDIDO                                 │
│                                         │
│  Motivo declarado:                      │
│  "Compromisso familiar."                │
│                                         │
├─────────────────────────────────────────┤
│  DECISÃO                                │
│                                         │
│  ✕  Negada                             │
│                                         │
│  Motivo:                                │
│  "Você é a única titular de Astrid     │
│  disponível nesta data. O Musical      │
│  das 14h ficaria sem cobertura."       │
│                                         │
├─────────────────────────────────────────┤
│  [ Perguntar à IA sobre este motivo ] ▸ │
│  [ Abrir conversa com o Supervisor  ] ▸ │
│                                         │
└─────────────────────────────────────────┘
```

**Variante: APROVADA — bloco Decisão:**
```
├─────────────────────────────────────────┤
│  DECISÃO                                │
│                                         │
│  ✓  Aprovada                           │
│     Supervisora Ana Silva · 17/06 18h  │
│                                         │
│  O que mudou na sua escala:             │
│  Sábado 21/06 — dia inteiro: livre      │
│                                         │
│  [ Ver no Meu Dia                   ] ▸ │
└─────────────────────────────────────────┘
```

**Variante: REVOGADA — bloco Decisão:**
```
│  DECISÃO ANTERIOR (Aprovada em 10/06)   │
│  ✓  Aprovada por Ana Silva              │
│                                         │
│  ──────────────────────────────────     │
│                                         │
│  REVOGAÇÃO (17/06 às 09h22)             │
│  Supervisora Ana Silva                  │
│                                         │
│  Motivo da revogação:                   │
│  "A lesão de Beatriz eliminou a        │
│  cobertura de Astrid que sustentava    │
│  esta folga. Sem alternativa."         │
│                                         │
│  Sua escala foi restaurada              │
│  automaticamente para o dia 21/06.      │
│                                         │
│  [ Abrir conversa                    ] ▸│
```

**Validações:**
- ✅ Linha do tempo com todos os atores e timestamps
- ✅ Motivo sempre presente (negativa e revogação)
- ✅ Consequências automáticas visíveis (o que mudou na escala)
- ✅ Ações contextuais por estado — nunca ações irrelevantes

---

### W4 — Proposta Alternativa (Membro)

**Objetivo:** Prazo impossível de ignorar. 3 ações claras. Contexto completo da proposta.

```
┌─────────────────────────────────────────┐
│  ←  Pedir folga                        │
│     PROPOSTA ALTERNATIVA                │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  ⏱ RESPOSTA NECESSÁRIA          │   │  ← Bloco de prazo: destaque máximo
│  │     Até hoje às 23h59           │   │
│  │     19 horas restantes          │   │
│  └─────────────────────────────────┘   │
│                                         │
├─────────────────────────────────────────┤
│  O QUE VOCÊ PEDIU                       │
│                                         │
│  Folga · Sábado, 21 de junho           │
│  Dia inteiro                            │
│                                         │
├─────────────────────────────────────────┤
│  O QUE O SUPERVISOR PROPÕE              │
│                                         │
│  Folga · Domingo, 22 de junho          │
│  Dia inteiro                            │
│                                         │
│  Justificativa:                         │
│  "O sábado 21 está crítico de          │
│  cobertura. No domingo 22 você        │
│  pode folgar sem impacto."             │
│                                         │
├─────────────────────────────────────────┤
│  [ ✓ Aceitar — Dom 22/06            ]   │
│  [ ✕ Recusar                        ]   │
│  [ ↗ Negociar via mensagem          ]   │
│                                         │
│  Se não responder até o prazo,          │
│  sua solicitação ficará como           │
│  "Expirada" e o Supervisor decidirá    │
│  o próximo passo.                       │  ← Consequência da inação explícita
│                                         │
└─────────────────────────────────────────┘
```

**Validações:**
- ✅ Prazo impossível de ignorar (bloco em destaque, horário + contagem)
- ✅ O que pediu vs. o que foi proposto em paralelo
- ✅ Justificativa do Supervisor visível
- ✅ 3 ações claras: aceitar / recusar / negociar
- ✅ Consequência da inação explícita (estado EXPIRADA em linguagem do Membro)

---

### W5 — Aguardando Informação (Membro)

**Objetivo:** Pergunta do Supervisor proeminente. Contexto original preservado. Resposta imediata.

```
┌─────────────────────────────────────────┐
│  ←  Pedir algo diferente               │
│     AGUARDANDO INFORMAÇÃO              │
├─────────────────────────────────────────┤
│                                         │
│  O Supervisor tem uma pergunta          │
│  antes de decidir:                      │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  "Você mencionou participar de  │   │  ← Pergunta em destaque visual
│  │  um evento externo. Trata-se    │   │
│  │  de atividade remunerada ou     │   │
│  │  pessoal?"                      │   │
│  │                                 │   │
│  │  Supervisora Ana Silva          │   │
│  │  17/06 · 15h42                  │   │
│  └─────────────────────────────────┘   │
│                                         │
├─────────────────────────────────────────┤
│  SEU PEDIDO ORIGINAL                    │
│                                         │
│  Terça, 18 de junho · Dia inteiro       │
│  "Preciso participar de um evento       │
│  de formação profissional."             │
│                                         │
├─────────────────────────────────────────┤
│  SUA RESPOSTA *                         │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │                                 │   │
│  │                                 │   │
│  │                                 │   │
│  └─────────────────────────────────┘   │
│                                         │
│  [ Enviar resposta →                ]   │
│                                         │
│  Aviso: esta é a 1ª de no máximo 2     │
│  rodadas de informação. Após isso, o   │
│  Supervisor precisará tomar uma        │
│  decisão.                              │
│                                         │
└─────────────────────────────────────────┘
```

**Validações:**
- ✅ Pergunta do Supervisor proeminente (bloco em destaque)
- ✅ Contexto original preservado visualmente
- ✅ Campo de resposta imediato — sem navegação adicional
- ✅ Transparência sobre limite de ciclos

---

## PERFIL 2 — SUPERVISOR

---

### W6 — Lista de Solicitações (Supervisor)

**Objetivo:** Ordenação por impacto. Agrupamento por data. Visão consolidada acessível.

```
┌─────────────────────────────────────────┐
│  ←  Solicitações             ● 7 pend.  │
├─────────────────────────────────────────┤
│  [ Todas  ] [ Pendentes ▌] [ Decididas ]│
├─────────────────────────────────────────┤
│                                         │
│  ⚠ CRÍTICO — ATIVIDADE EM < 24H  ────  │  ← Seção 1: urgência Crítica
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ ● CRÍTICO · Sáb 21/06 · 8h     │   │
│  │   Amanda Souza · Folga          │   │
│  │   Única titular de Astrid       │   │  ← Preview do risco mais crítico
│  │   Enviada há 4h · em análise    │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ▲ ALTO — ATIVIDADE EM 1-7 DIAS  ─────  │  ← Seção 2: urgência Alta
│                                         │
│  ┌─────────────────────────────────┐   │  ← AGRUPAMENTO POR DATA
│  │  📅 3 solicitações · Sex 27/06  │   │
│  │  [ Ver impacto consolidado  ▸ ] │   │  ← Acesso à Visão Consolidada (W8)
│  ├─────────────────────────────────┤   │
│  │  Carolina Lima · Folga   ▲ ALTO │   │
│  │  Enviada há 2h · enviada        │   │
│  ├─────────────────────────────────┤   │
│  │  Arthur Melo · Folga     ▲ ALTO │   │
│  │  Enviada há 5h · em análise     │   │
│  ├─────────────────────────────────┤   │
│  │  Débora Pires · Folga    ▲ ALTO │   │
│  │  Enviada há 1h · enviada        │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  Carlos Neto · Restrição ▲ ALTO │   │
│  │  Médica · 20/06 a 30/07         │   │
│  │  Enviada há 3h · enviada        │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ─ MÉDIO — ATIVIDADE EM 7-30 DIAS ───  │  ← Seção 3: urgência Média
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  Pedro Faria · Troca de folga   │   │
│  │  30/06 → 05/07  ─ MÉDIO         │   │
│  │  Enviada há 1 dia · em análise  │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ▾ BAIXO  ─────────────────────────── ▸│  ← Seção 4: Baixo (colapsável)
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  Júlia Costa · Adm. urgente     │   │
│  │  Documento · Urgência Alta ●    │   │  ← Push enviado para este item
│  │  Enviada há 30min               │   │
│  └─────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

**Validações:**
- ✅ Ordenação por urgência de impacto (Crítico → Alto → Médio → Baixo)
- ✅ Agrupamento por data quando múltiplas solicitações
- ✅ Botão de Visão Consolidada visível no agrupamento
- ✅ Urgência Administrativa Alta com destaque diferenciado
- ✅ Cada item: nome + tipo + nível de impacto + tempo de espera + estado

---

### W7 — Análise Individual (Supervisor)

**Objetivo:** 4 blocos obrigatórios em sequência. Nenhum botão de decisão antes dos blocos.

```
┌─────────────────────────────────────────┐
│  ←  Análise de Solicitação             │
│     Amanda Souza · Pedir folga         │
├─────────────────────────────────────────┤
│                                         │
│  ●─── BLOCO 1 — O PEDIDO ──────────── │  ← Bloco 1: sempre primeiro
│                                         │
│  Amanda Souza solicita:                 │
│  Folga · Sábado, 21 de junho           │
│  Dia inteiro                            │
│                                         │
│  Motivo declarado:                      │
│  "Compromisso familiar."                │
│                                         │
│  Enviada: 17/06 às 10h14               │
│                                         │
├─────────────────────────────────────────┤
│                                         │
│  ●─── BLOCO 2 — IMPACTO OPERACIONAL ── │  ← Bloco 2: IA analisa
│                                         │
│  Amanda cobre no sábado 21:             │
│                                         │
│  ┌────────────────────────────────────┐│
│  │ Musical 12h30 · Astrid             ││
│  │ ⚠ Papel único — sem substituto    ││
│  ├────────────────────────────────────┤│
│  │ Ensaio 16h · Bloco 3               ││
│  │ ✓ Beatriz pode cobrir              ││
│  └────────────────────────────────────┘│
│                                         │
│  Recomendação da IA:                    │
│  "Negociar data alternativa ou          │
│  confirmar cobertura para Astrid       │
│  antes de aprovar."                    │
│                                         │
├─────────────────────────────────────────┤
│                                         │
│  ●─── BLOCO 3 — ACUMULADO ──────────── │  ← Bloco 3: impacto coletivo
│                                         │
│  Folgas já aprovadas · Sáb 21/06:      │
│                                         │
│  Carlos Neto · Aprovada 3 dias atrás   │
│  Fernanda Lima · Aprovada 1 dia atrás  │
│                                         │
│  Cobertura atual do grupo: 72%          │
│  Se Amanda for aprovada: 61% ⚠         │  ← Cálculo em tempo real
│                                         │
│  Papéis que ficariam descobertos:       │
│  → Astrid (Musical 12h30)               │
│                                         │
├─────────────────────────────────────────┤
│                                         │
│  ●─── BLOCO 4 — DECISÃO ────────────── │  ← Bloco 4: APENAS aqui aparecem os botões
│                                         │
│  [ ✓ Aprovar                        ]   │
│  [ ↗ Propor data alternativa        ]   │
│  [ ✕ Negar                          ]   │
│  [ ? Solicitar mais informação      ]   │
│                                         │
└─────────────────────────────────────────┘
```

**Fluxo de Negar — expansão inline do Bloco 4:**
```
│  ─── NEGAR ─────────────────────────── │
│                                         │
│  Motivo da negativa *                   │
│  ┌─────────────────────────────────┐   │
│  │                                 │   │  ← Bloqueio técnico — campo obrigatório
│  └─────────────────────────────────┘   │
│                                         │
│  Ex: "Você é a única titular de        │
│  Astrid disponível nesta data."        │
│                                         │
│  [ Confirmar negativa →             ]   │  ← Bloqueado até campo preenchido
│  [ ← Voltar                         ]   │
```

**Fluxo de Propor Alternativa — expansão inline:**
```
│  ─── PROPOR ALTERNATIVA ─────────────  │
│                                         │
│  Data alternativa sugerida *            │
│  ( __/__/____ )                         │
│                                         │
│  Justificativa *                        │
│  ┌─────────────────────────────────┐   │
│  │                                 │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Prazo para o Membro responder          │
│  ( ) 24 horas   (●) 48 horas   ( ) 72h │  ← Padrão: 48h pré-selecionado
│                                         │
│  [ Enviar proposta →                ]   │
```

**Validações:**
- ✅ 4 blocos rigorosamente sequenciais — nenhum botão antes do Bloco 4
- ✅ Bloco 2: papéis em risco vs. papéis com cobertura disponível
- ✅ Bloco 3: cobertura antes e depois da aprovação (cálculo em tempo real)
- ✅ Bloco 4: botão [Confirmar negativa] bloqueado até motivo preenchido
- ✅ Prazo de proposta alternativa com padrão pré-selecionado (48h)
- ✅ Blocos colapsáveis após leitura para reduzir carga cognitiva na análise em lote

---

### W8 — Visão Consolidada (Supervisor)

**Objetivo:** Múltiplas solicitações para a mesma data. Impacto coletivo antes de decidir individualmente.

```
┌─────────────────────────────────────────┐
│  ←  Impacto Consolidado                │
│     Sexta-feira, 27 de junho de 2026   │
├─────────────────────────────────────────┤
│                                         │
│  3 solicitações de folga               │
│  para este dia                          │
│                                         │
├─────────────────────────────────────────┤
│  SIMULAÇÃO DE COBERTURA                 │
│                                         │
│  Cobertura atual do grupo: 100%         │
│                                         │
│  Se 1 aprovada:  [ Carolina ]    88%    │
│  Se 2 aprovadas: [ + Arthur ]    76%    │
│  Se 3 aprovadas: [ + Débora ]    61% ⚠ │
│                                         │
│  Papéis críticos descobertos            │
│  se todas forem aprovadas:              │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ ⚠ Astrid · Musical 14h          │   │
│  │   Nenhum substituto disponível  │   │
│  ├─────────────────────────────────┤   │
│  │ ⚠ Bloco 3 · Ensaio 16h          │   │
│  │   Beatriz disponível (1 opção)  │   │
│  └─────────────────────────────────┘   │
│                                         │
├─────────────────────────────────────────┤
│  MEMBROS SOLICITANTES                   │
│                                         │
│  Carolina Lima · Folga · Dia inteiro    │
│  Papéis: Mensageira (substitutos: 2)    │
│  Risco se aprovada: Baixo               │
│                                         │
│  Arthur Melo · Folga · Dia inteiro      │
│  Papéis: Bloco 3, Ensaio (subs: 1)     │
│  Risco se aprovada: Médio               │
│                                         │
│  Débora Pires · Folga · Dia inteiro     │
│  Papéis: Astrid Musical 14h (subs: 0)  │
│  Risco se aprovada: ⚠ Crítico           │
│                                         │
├─────────────────────────────────────────┤
│  RECOMENDAÇÃO DA IA                     │
│                                         │
│  "Carolina e Arthur podem ser           │
│  aprovados sem risco crítico.           │
│  Débora: negociar data alternativa      │
│  — Astrid ficaria sem cobertura."       │
│                                         │
├─────────────────────────────────────────┤
│  [ Analisar Carolina →              ]   │  ← Ordem sugerida: menor risco primeiro
│  [ Analisar Arthur   →              ]   │
│  [ Analisar Débora   →              ]   │
│                                         │
└─────────────────────────────────────────┘
```

**Validações:**
- ✅ Simulação de cobertura mostra impacto cumulativo (1, 2, 3 aprovadas)
- ✅ Papéis críticos descobertos se todas aprovadas
- ✅ Cada solicitante com nível de risco individual
- ✅ Recomendação da IA orienta a sequência de análise
- ✅ Ordem de análise sugerida do menor para o maior risco

---

### W9 — Fluxo de Revogação (Supervisor)

**Objetivo:** Impacto visível antes da confirmação. Motivo obrigatório. Confirmação clara.

```
┌─────────────────────────────────────────┐
│  ←  Revogar Aprovação                  │
│     Amanda Souza · Folga 21/06         │
├─────────────────────────────────────────┤
│                                         │
│  ⚠ IMPACTO DESTA REVOGAÇÃO            │
│                                         │
│  Amanda voltará a estar disponível      │
│  para todas as atividades do:           │
│  Sábado, 21 de junho de 2026           │
│                                         │
│  A Escala será revertida               │
│  automaticamente.                       │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  ⚠ Atenção adicional:                  │
│  O Livro do Dia do sábado 21 já foi    │
│  gerado. Você precisará revisá-lo      │
│  manualmente após a revogação.          │
│                                         │
├─────────────────────────────────────────┤
│                                         │
│  Motivo da revogação *                  │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │                                 │   │  ← Bloqueio técnico — obrigatório
│  │                                 │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Ex: "A lesão de Beatriz eliminou a    │
│  cobertura de Astrid que sustentava    │
│  esta folga."                          │
│                                         │
├─────────────────────────────────────────┤
│  [ Confirmar revogação →            ]   │  ← Bloqueado até motivo preenchido
│  [ ← Cancelar                       ]   │
│                                         │
└─────────────────────────────────────────┘
```

**Tela de confirmação pós-revogação:**
```
┌─────────────────────────────────────────┐
│  ✓ Aprovação revogada                  │
├─────────────────────────────────────────┤
│                                         │
│  A folga de Amanda em 21/06 foi         │
│  revogada. A Escala foi revertida       │
│  automaticamente.                       │
│                                         │
│  Amanda foi notificada com o motivo.    │
│                                         │
│  ⚠ Ação necessária:                    │
│  Revise o Livro do Dia do sábado 21.   │
│  [ Ir para o Livro do Dia →         ]   │
│                                         │
│  [ Voltar para Solicitações         ]   │
└─────────────────────────────────────────┘
```

**Validações:**
- ✅ Impacto da revogação visível ANTES da confirmação
- ✅ Alerta de Livro do Dia gerado quando aplicável
- ✅ Motivo obrigatório com mesmo padrão de bloqueio da negativa
- ✅ Pós-revogação: confirmação + ação sugerida

---

## PERFIL 3 — ADMIN

---

### W10 — Monitoramento (Admin)

**Objetivo:** Visão de saúde das solicitações. Alertas de proximidade. Escaladas. Expirações.

```
┌─────────────────────────────────────────┐
│  ←  Solicitações · Monitoramento       │
│     Operação Snowland                   │
├─────────────────────────────────────────┤
│  [ Snowland ▌] [ Wonderland ] [ Todas ] │
├─────────────────────────────────────────┤
│                                         │
│  INDICADORES DE SAÚDE                   │
│                                         │
│  Tempo médio de resposta esta semana:   │
│  Ana Silva  ·  3,2 horas               │
│  João Costa ·  28,4 horas  ⚠           │
│                                         │
│  Escaladas para Admin este mês:  2      │
│  Revogações este mês:            1      │
│                                         │
├─────────────────────────────────────────┤
│                                         │
│  🔴 ESCALADAS — Admin assumiu  ──────── │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ ● Carlos Neto · Folga           │   │
│  │   Restrição · 20/06             │   │
│  │   Supervisor João Costa         │   │
│  │   Sem resposta há 52h · Médio   │   │
│  │   [ Analisar agora →         ]  │   │
│  └─────────────────────────────────┘   │
│                                         │
│  🟡 EXPIRAÇÕES — Ação do Supervisor ──  │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │   Pedro Faria · Troca de folga  │   │
│  │   Proposta expirada há 4h       │   │
│  │   Supervisor Ana Silva          │   │
│  │   Notificada · Sem ação ainda   │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ⏳ PROXIMIDADE — Em iminência  ─────── │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │   Amanda Souza · Folga          │   │
│  │   Crítico · 80% do limiar       │   │
│  │   Escalada em aprox. 1h         │   │
│  │   Supervisor João Costa         │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │   Débora Pires · Folga          │   │
│  │   Alto · 78% do limiar          │   │
│  │   Escalada em aprox. 5h         │   │
│  │   Supervisor Ana Silva          │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ─ ESTÁVEL — Abaixo de 50%  ──────── ▸ │
│  4 solicitações em andamento           │
│  [ Ver detalhes                    ▸ ] │
│                                         │
└─────────────────────────────────────────┘
```

**Validações:**
- ✅ Alertas de proximidade (80%) visíveis antes da escalada formal
- ✅ Escaladas já assumidas pelo Admin separadas das em iminência
- ✅ EXPIRADA monitorada separadamente (responsabilidade do Supervisor)
- ✅ Indicadores de saúde: tempo médio por Supervisor + outlier identificado

---

### W11 — Investigação (Admin)

**Objetivo:** Histórico narrativo completo. Todos os atores, todas as transições, todos os motivos.

```
┌─────────────────────────────────────────┐
│  ←  Investigação                       │
│     Amanda Souza · Folga 21/06         │
├─────────────────────────────────────────┤
│                                         │
│  RESUMO                                 │
│                                         │
│  Solicitação de folga criada por        │
│  Amanda Souza em 17/06. Analisada      │
│  pelo Supervisor em 16h02. Aprovada    │
│  em 17/06 às 18h. Revogada em 19/06   │
│  após nova restrição de Beatriz.        │
│                                         │
│  Esta é a 3ª solicitação de folga de   │
│  Amanda para o mesmo dia nas últimas   │
│  4 semanas.                             │  ← Padrão de reincidência
│                                         │
├─────────────────────────────────────────┤
│  LINHA DO TEMPO COMPLETA               │
│                                         │
│  ● 17/06 · 10h14                       │
│    Solicitação criada por Amanda Souza  │
│    Tipo: Folga · 21/06 · Dia inteiro    │
│                                         │
│  ● 17/06 · 16h02                       │
│    Visualizada por Ana Silva           │
│    → Estado: EM ANÁLISE                 │
│                                         │
│  ● 17/06 · 18h00                       │
│    Aprovada por Ana Silva              │
│    → Escala atualizada automaticamente  │
│                                         │
│  ● 19/06 · 09h22                       │
│    Restrição de Beatriz Lima aprovada  │
│    → Alerta automático gerado           │
│    → Ana Silva notificada               │
│                                         │
│  ● 19/06 · 11h05                       │
│    Aprovação revogada por Ana Silva    │
│    Motivo: "Lesão de Beatriz eliminou  │
│    cobertura de Astrid."               │
│    → Escala revertida automaticamente   │
│    → Amanda notificada                  │
│    → Alerta: Livro do Dia a revisar    │
│                                         │
│  ● 19/06 · 11h15                       │
│    Livro do Dia 21/06 revisado por     │
│    Ana Silva                           │
│                                         │
├─────────────────────────────────────────┤
│  ATORES                                 │
│                                         │
│  Amanda Souza · Membro (requerente)    │
│  Ana Silva · Supervisora (aprovadora)  │
│  Beatriz Lima · Membro (gerou alerta)  │
│                                         │
├─────────────────────────────────────────┤
│  [ Perguntar à IA sobre este caso   ]   │
│  [ Ver outras solicitações de Amanda]   │
│                                         │
└─────────────────────────────────────────┘
```

**Validações:**
- ✅ Resumo narrativo da IA no topo
- ✅ Padrão de reincidência detectado e visível
- ✅ Linha do tempo com todos os atores e eventos (incluindo alertas automáticos)
- ✅ Motivos de decisões preservados integralmente
- ✅ Consequências automáticas visíveis na linha do tempo

---

## AUDITORIA DE WIREFRAME

---

### 1. Existe excesso de carga cognitiva?

**Não nos fluxos principais. Um ponto de atenção em W7.**

Os wireframes do Membro (W1–W5) são lineares e cada tela tem propósito único. A lista (W1) usa seções nomeadas — o Membro lê apenas "Ação Necessária" se quiser saber o que fazer imediatamente.

O ponto de atenção: **W7 Análise Individual** é a tela mais densa do produto. Os 4 blocos juntos representam volume considerável de informação e o Supervisor faz scroll extenso antes de chegar ao Bloco 4.

**Mitigação incorporada no wireframe:** Cada bloco é colapsável. O padrão é expandido na primeira visita. Após leitura, o Supervisor pode colapsar e avançar — o estado colapsado mostra apenas o título e o nível de risco em resumo.

---

### 2. Existe informação importante escondida?

**Não.** Verificação ponto a ponto:

| Item | Localização no wireframe |
|---|---|
| Estado de cada solicitação | Visível na lista sem abrir (W1, W6) |
| Prazo de Proposta Alternativa | Bloco em destaque W1 + bloco fixo W4 |
| Motivo de negativa e revogação | Preview na lista (W1), completo no detalhe (W3) |
| Acumulado de folgas | Bloco 3 antes das opções de decisão (W7) |
| Impacto de revogação | Bloco de aviso antes do campo de motivo (W9) |
| Alertas de proximidade ao Admin | Seção "Proximidade" de W10 |

---

### 3. Existe algum estado difícil de entender?

**EXPIRADA** tem maior risco de confusão para o Membro.

O Membro pode interpretar como "solicitação perdida" ou "negada por inação". Mitigações no wireframe:
- Label "EXPIRADA" + texto: *"Aguardando nova decisão do Supervisor"* (W1)
- Em W4, a consequência da inação é descrita em linguagem simples antes de acontecer
- EXPIRADA aparece em "EM PROCESSO" na W1 — não em "Decididas" — sinalizando que o processo não terminou

**REVOGADA** tem segundo risco: confusão com NEGADA. A linha do tempo de W3 resolve — REVOGADA aparece depois de APROVADA, tornando a sequência temporal autoexplicativa.

---

### 4. Existe algum fluxo que exige cliques desnecessários?

**Um ponto identificado e resolvido:**

Análise em lote (W7, sequência): após decidir a última solicitação da fila, o Supervisor não tem feedback de encerramento. Adicionado ao wireframe: **tela de encerramento da análise em lote** com resumo de decisões — *"7 de 7 analisadas. 4 aprovadas, 2 negadas, 1 proposta alternativa enviada."*

---

### 5. Existe alguma inconsistência entre Membro, Supervisor e Admin?

**Nenhuma inconsistência de dados.** Uma nomenclatura ajustada durante o wireframe: seção "Em Andamento" renomeada para "Em Processo" na W1 do Membro (cobre ENVIADA, EM ANÁLISE e EXPIRADA de forma mais precisa).

---

### 6. Existe algum ponto onde a interface contradiz a especificação funcional?

**Não foram encontradas contradições.** Verificação das regras críticas:

| Regra | Implementação |
|---|---|
| R01 — Motivo obrigatório em negativa e revogação | W7 e W9: botão bloqueado até campo preenchido ✅ |
| R02 — Estado visível sem abrir | W1 e W6: estado em todas as listas ✅ |
| R03 — Análise de impacto antes dos botões | W7: botões apenas no Bloco 4 ✅ |
| R04 — Acumulado de folgas obrigatório | W7 Bloco 3 permanente ✅ |
| R05 — Ordenação por urgência no Supervisor | W6: Crítico → Alto → Médio → Baixo ✅ |
| L-01 — EXPIRADA não terminal | W10: seção "Expirações" com responsabilidade no Supervisor ✅ |
| L-02 — REVOGADA com impacto na Escala | W9: bloco de impacto antes da confirmação ✅ |
| L-05 — Visão consolidada | W6 + W8: agrupamento + botão de acesso ✅ |
| L-09 — Alertas de proximidade 80% | W10: seção "Proximidade" com percentual e tempo restante ✅ |
| R10 — Limite de ciclos AGUARDANDO INFORMAÇÃO | W5: aviso explícito ao Membro ✅ |

---

## VEREDITO

# 🟢 PRONTO PARA MOCKUP

Os 11 wireframes cobrem todos os estados, todos os fluxos e todas as regras de negócio da especificação funcional. Nenhuma lacuna estrutural foi encontrada durante a fase de wireframe.

**Dois refinamentos de UX a incorporar no mockup (não estruturais):**
1. Blocos de W7 colapsáveis após leitura — reduz carga cognitiva na análise em lote
2. Tela de encerramento da análise em lote com resumo de decisões tomadas

Ambos são refinamentos de experiência, não revisões de estrutura, hierarquia, estados ou regras de negócio.

**Próxima etapa:** Mockup Visual — aplicar design system, cores semânticas, tipografia e componentes da plataforma sobre esta estrutura validada.
