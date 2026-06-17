# MyASA 2.0 — Design Visual Estratégico — Bloco 1

> Versão: 17/06/2026
> Fase: Design Visual Estratégico — anterior a wireframes e mockups
> Escopo: S-01 Meu Dia · S-02 Painel Operacional · S-04 Escala
> Autoria: Product Designer Sênior
> Status: Fundação visual aprovada — pronta para guiar wireframes

---

## Premissa do Design Visual Estratégico

Design visual estratégico não é estética — é a tradução das decisões funcionais em linguagem perceptiva. O objetivo deste documento é definir **o que o usuário percebe, em que ordem, em quanto tempo, e com qual sensação emocional** — antes de qualquer escolha de cor, tipografia ou componente específico.

A fundação visual do MyASA deve honrar uma tensão:

> **Calma e urgência ao mesmo tempo.**
> O produto lida com situações críticas, mas não pode transmitir ansiedade. Deve ser preciso como um cockpit, elegante como uma plataforma premium, e humano como um copiloto de confiança.

Isso elimina dois caminhos errados:
- **O caminho ERP:** tabelas, menus longos, informação densa, hierarquia burocrática → transmite peso, não controle
- **O caminho ansioso:** alertas piscando, cores gritantes, badges em tudo → transmite caos, não urgência gerenciada

O caminho certo é o da **calma inteligente:** informação certa, no momento certo, com a hierarquia visual correta — e silêncio onde não há nada urgente.

---

## Análise da Identidade da Asa

A asa do MyASA não é decorativa. Ela é a chave interpretativa do design.

**O que a asa comunica:**
- **Leveza:** o produto não pesa sobre o usuário. A interface não é um fardo — é suporte.
- **Profundidade:** a asa é tridimensional, tem estrutura. O produto tem substância — não é superficial.
- **Direção:** a asa move. O produto é orientado para a ação, não para a contemplação.
- **Precisão:** cada pena tem uma função. O produto não tem elemento sem propósito.

**O gradiente roxo → azul:**
- Roxo: criatividade, profundidade, o mundo artístico
- Azul: confiança, clareza, operação precisa
- A transição: o MyASA vive no espaço entre arte e operação

**O que a identidade da asa proíbe:**
- Interfaces pesadas e densas (contradiz leveza)
- Alertas visuais ansiosos e piscantes (contradiz direção e precisão)
- Decoração gratuita sem função (contradiz precisão)
- Fundo escuro dentro da interface (foi explicitamente eliminado — o fundo escuro seria clausura, não voo)

**Tradução para design de interface:**
- Leveza → espaço em branco generoso, tipografia aérea, cards com respiração
- Profundidade → hierarquia visual clara (não toda informação no mesmo plano), sombra sutil em camadas
- Direção → ação primária sempre visível e próxima, fluxo visual que conduz o olho
- Precisão → cada elemento ganha apenas o espaço que merece

---

## Fundação Visual do Sistema

Antes de tratar cada superfície, os princípios visuais são válidos para todo o Bloco 1.

### 1. Superfície de fundo

**Cor:** branco puro ou cinza muito claro (próximo de branco — nunca cinza médio ou escuro).

**Razão:** a clareza do fundo é o que torna possível a hierarquia. Se o fundo "fala", os elementos de conteúdo precisam gritar para ser ouvidos. O fundo silencia para que o conteúdo fale.

**Exceções permitidas:**
- Overlays modais: fundo escurecido semitransparente (não opaco)
- Bloco de Alteração: fundo com leve tint de cor de estado — a única exceção dentro do fluxo principal

---

### 2. Camadas visuais (z-index visual, não técnico)

O design opera em 3 camadas perceptivas:

**Camada 0 — Estrutura (fundo):** cor base, sem conteúdo
**Camada 1 — Cards principais:** conteúdo de primeiro plano, fundo branco, sombra mínima
**Camada 2 — Elementos interativos:** botões, ações, elementos de estado
**Camada 3 — Destaque de urgência:** usado apenas para Bloco de Alteração e Status Crítico — nunca para elementos secundários

A violação crítica seria colocar elementos secundários na Camada 3 — isso esvazia o significado de urgência.

---

### 3. Cor como linguagem de estado

**Princípio:** cor não é decoração — é semântica. Cada cor carrega um significado operacional e mantém esse significado de forma consistente em todo o produto.

| Estado | Cor | Uso |
|---|---|---|
| **Normal / Confirmado** | Verde calmo — não neon, não saturado | Posição coberta, solicitação resolvida, confirmação recebida |
| **Atenção / Risco** | Âmbar / Laranja — quente, não agressivo | Exceção com tempo, solicitação pendente, risco futuro |
| **Crítico / Urgente** | Vermelho — profundo, não vibrante | Exceção iminente, alteração não confirmada, posição crítica em aberto |
| **Neutro / Padrão** | Cinza médio | Informação contextual, estado passado, elementos de apoio |
| **IA** | Roxo-azul suave — derivado do gradiente da asa | Narrativa da IA, sugestões, elementos de análise |
| **Ação Primária** | Gradiente roxo → azul (identidade da asa) | Botão principal de cada estado |
| **Ação Secundária** | Cinza claro com borda | Ações de apoio, expandir, ver mais |

**Regra crítica:** vermelho e âmbar nunca aparecem sem motivo semântico real. Se forem usados decorativamente ou com frequência excessiva, perdem o sinal.

---

### 4. Tipografia como hierarquia

A tipografia define hierarquia antes de qualquer cor ou forma.

| Nível | Peso | Tamanho relativo | Uso |
|---|---|---|---|
| **T1 — Primário** | Bold / Semibold | Grande | Informação mais importante da tela (papel do Membro, status da operação, nome da atividade) |
| **T2 — Secundário** | Regular / Medium | Médio | Informação de contexto (horário, local, status) |
| **T3 — Contextual** | Regular | Pequeno | Informação de apoio (quando foi, quem, metadado) |
| **T4 — Silenciado** | Regular | Pequeno | Informação passada, já resolvida, de menor relevância |

**A tipografia T4 é tão importante quanto a T1.** Ela comunica "isso já foi resolvido, não precisa da sua atenção agora" — sem remover a informação.

---

### 5. Cards — o elemento estrutural central

O card é a unidade visual do MyASA. Cada unidade de informação coerente vive em um card.

**Anatomia do card padrão:**
- Fundo branco
- Border radius generoso (iOS-inspired — 16px ou mais)
- Sombra muito sutil (elevation 1 — quase imperceptível, apenas para separar do fundo)
- Padding interno generoso — respiração, não compressão
- Hierarquia interna: T1 no topo, T2 abaixo, T3 na base

**Variações de card por estado:**

| Variação | Diferença visual | Uso |
|---|---|---|
| **Card Padrão** | Branco, sombra mínima | Informação normal |
| **Card de Atenção** | Borda esquerda âmbar (4px) + fundo levemente tintado de âmbar | Exceção com atenção necessária |
| **Card Crítico** | Borda esquerda vermelha (4px) + fundo levemente tintado de vermelho | Exceção urgente, Bloco de Alteração |
| **Card Confirmado** | Borda esquerda verde (2px) | Ação resolvida, confirmação recebida |
| **Card IA** | Borda esquerda roxo-azul (3px) + ícone de asa | Narrativa e análise da IA |
| **Card Silenciado** | Opacidade reduzida (60–70%) | Atividade passada, informação não prioritária |

**O que card nunca é:** tabela. Nunca grid com células. Nunca linhas alternadas de cor. Nunca header de coluna.

---

### 6. Espaço em branco como elemento de design

O espaço em branco no MyASA é funcional — não desperdício.

**Espaço entre cards:** suficiente para que cada card seja uma unidade perceptiva separada. O usuário não deve precisar verificar onde termina um item e começa outro.

**Espaço interno do card:** o conteúdo respira. O padding interno nunca é menor que o que torna a leitura confortável em mobilidade (não sentado estático na mesa).

**Espaço como silêncio semântico:** quando não há exceções, o espaço em branco do Painel Operacional é a confirmação visual de "está tudo bem". O Supervisor percebe a ausência de densidade como sinal positivo — não como bug.

---

### 7. Glassmorphism — uso restrito

O glassmorphism (vidro fosco, transparência, blur) está na identidade visual do MyASA. Mas o uso é restrito:

**Onde é permitido:**
- Overlays de ação (modal de confirmação de publicação, simulação de cascata)
- Cabeçalho fixo que rola sobre o conteúdo (blur do conteúdo atrás)
- Card de IA quando em destaque especial

**Onde é proibido:**
- Como estética geral de fundo de telas
- Em listas ou conteúdo de informação operacional
- Em qualquer superfície onde clareza é prioritária sobre estética

**Razão:** glassmorphism é profundidade. Usado corretamente, diz "este elemento está sobre tudo — é o que importa agora". Usado em excesso, vira ruído.

---

### 8. Ícones e indicadores de estado

**Ícones:** funcionais, não decorativos. Cada ícone tem um significado consistente em todas as superfícies. Ícones não aparecem em elementos que já têm estado visual claro (ex.: um card crítico com borda vermelha não precisa de ícone de alerta adicional — a borda já fala).

**Indicadores de estado:** pills (pílulas) com cor de fundo e texto curto. Nunca apenas cor sem texto — acessibilidade exige que o estado seja legível por texto também.

---

---

# S-01 — MEU DIA — Design Visual

---

## 1. Hierarquia visual principal

A hierarquia visual do Meu Dia é **dinâmica** — muda com o estado do sistema. O design deve comunicar visualmente qual é o estado antes de qualquer leitura.

### Estado A: Existe Alteração Não Confirmada

```
┌─────────────────────────────────────┐  ← Zona de percepção imediata (acima do fold)
│  [Header: data, operação]           │
│                                     │
│  ┌───────────────────────────────┐  │
│  │ !! BLOCO DE ALTERAÇÃO !!      │  │  ← Elemento dominante — ocupa 40-50% da tela
│  │   (Card Crítico)              │  │
│  │   O que era · O que mudou     │  │
│  │   [Confirmar]  ←botão enorme  │  │
│  └───────────────────────────────┘  │
│                                     │
│  [Card de Próxima Atividade]        │  ← Segundo elemento — visível mas não dominante
│  [Narrativa da IA — contextual]     │  ← Terceiro
└─────────────────────────────────────┘
```

### Estado B: Nenhuma Alteração

```
┌─────────────────────────────────────┐  ← Zona de percepção imediata
│  [Header: data, operação]           │
│                                     │
│  ┌───────────────────────────────┐  │
│  │ CARD DE PRÓXIMA ATIVIDADE     │  │  ← Elemento dominante — ocupa 35-40% da tela
│  │   (Card Padrão — visualmente  │  │
│  │    calmo, sem tensão)         │  │
│  └───────────────────────────────┘  │
│                                     │
│  [Card IA — narrativa do dia]       │  ← Segundo elemento
│  [Linha do tempo — contraída]       │  ← Terceiro — expansível
│  [Pendências menores — suaves]      │  ← Quarto — não competem
└─────────────────────────────────────┘
```

---

## 2. Ordem de percepção em até 2 segundos

**Estado A (com alteração):**
- 0–0,5s: Vermelho. Bloco grande. Algo mudou.
- 0,5–1s: "O que era / O que é agora" — entende a mudança
- 1–2s: Botão "Confirmar" — sabe o que fazer

**Estado B (sem alteração):**
- 0–0,5s: Branco, calmo. Sem urgência.
- 0,5–1s: Nome da atividade + horário — o que acontece a seguir
- 1–2s: Papel do Membro — confirma o que fazer

**Princípio:** nos primeiros 2 segundos, o Membro já deve ter respondido à pergunta mais urgente — sem ler parágrafos, sem escanear listas.

---

## 3. Elemento visual dominante

### Quando há alteração: **Bloco de Alteração**

- **Dimensão:** ocupa a maior área do viewport acima do fold
- **Cor de fundo:** tint muito suave de vermelho (não saturado — mais como uma névoa coral)
- **Borda esquerda:** linha vertical espessa (6px) em vermelho profundo
- **Tipografia:**
  - "O que era antes" → T3, tachado, cinza (visualmente "morto")
  - "O que é agora" → T1, bold, preto — vivo, presente
- **Ação:** botão "Confirmar" em gradiente roxo-azul (ação primária da identidade), grande, centralizado dentro do bloco
- **Comportamento:** sem animação de entrada ansiosa — aparece estático, firme, como um fato

### Quando não há alteração: **Card de Próxima Atividade**

- **Dimensão:** card grande, confortável, generoso
- **Cor de fundo:** branco puro
- **Sem borda colorida** — calmo, sem tensão
- **Tipografia:**
  - Nome da atividade → T1, bold
  - Horário → T2, medium, com muito espaço ao redor
  - Papel do Membro → T2, com pill de cor neutra
  - Local → T3, cinza suave
- **Detalhe de identidade:** canto superior do card tem o ícone de asa em roxo muito suave (quasi-transparente) — presença da marca sem decoração gratuita

---

## 4. Elementos secundários

### Narrativa da IA

- **Posição:** imediatamente abaixo do elemento dominante
- **Visual:** Card IA (borda esquerda roxo-azul suave + ícone de asa pequeno)
- **Tipografia:** T2 em italic suave — diferencia da voz do sistema
- **Tamanho máximo:** 3 linhas de texto. Se mais, colapsa com "continuar lendo"
- **Interação:** toque no card expande para campo de pergunta (não abre nova tela)

### Linha do Tempo

- **Visual padrão (contraída):** apenas indicador — "Hoje: 3 atividades · Ver linha do tempo ▾"
- **Visual expandido:** lista vertical de atividades
  - Atividade futura: card normal, tipografia plena
  - Próxima atividade: levemente destacada (borda esquerda sutil em gradiente)
  - Atividade passada: card silenciado (opacidade 60%), tipografia T4
- **Intervalos entre atividades:** linha pontilhada com duração do intervalo — leve, não poluente

---

## 5. Elementos contextuais

### Confirmações Pendentes

- **Visual:** seção com fundo levemente acinzentado (não card branco — diferente do conteúdo principal)
- **Cada item:** icon + texto em uma linha + arrow para navegar
- **Estado:** nunca visualmente mais proeminente que o elemento dominante

### Solicitações e Entregas com Prazo

- **Visual:** pills informativos embaixo da linha do tempo — pequenos, compactos
- **Conteúdo máximo:** "Entrega: Relatório · Amanhã" — sem abrir nada, só informa
- **Acesso:** toque navega para S-07 ou S-06

---

## 6. Estados normais

**Visual:** branco, espaçoso, sem tensão.

O estado normal do Meu Dia deve ser o mais silencioso visualmente. O Membro que abre o app e vê o estado normal deve sentir: *"Está tudo como esperado."* Qualquer elemento vermelho, âmbar, ou de alta saturação estaria fora de lugar — e por isso teria poder de atenção absoluto quando aparecer.

**Elementos ativos no estado normal:**
- Header: data, nome da operação, avatar do Membro
- Card de Próxima Atividade: visual calmo
- Narrativa da IA: suave, informativa
- Linha do Tempo: contraída, acessível

---

## 7. Estados de atenção

**Visual:** âmbar discreto, não dominante.

Atenção no Meu Dia é rara — o Membro não está em modo de gerenciamento. Quando aparece, não compete com o Card de Próxima Atividade.

**Exemplos visuais:**
- Solicitação sem resposta há 3+ dias: pill âmbar pequeno na seção de Solicitações — não um card grande
- Entrega com prazo em 24h: borda esquerda âmbar no item de Entrega — não um alerta separado
- Restrição ativa que pode impactar a atividade: tooltip contextual no Card de Próxima Atividade — não um bloco separado

**Regra:** estados de atenção no Meu Dia são sussurros, não gritos. O Membro nota — e pode agir — mas o foco principal do dia não é perturbado.

---

## 8. Estados críticos

**Visual:** vermelho profundo, dominante, inescapável.

Crítico no Meu Dia tem apenas um manifestação real: **Alteração Operacional Persistente não confirmada.**

**Comportamento visual completo do Bloco de Alteração:**

- Ocupa 40–50% da tela acima do fold
- Fundo: tint coral/vermelho suave (não saturado — não é um semáforo)
- Borda esquerda: 6px vermelho profundo
- Typography do "antes": tachado, acinzentado — visualmente morto
- Typography do "depois": T1, bold, vivo — o que importa agora
- Botão Confirmar: largura total do card, gradiente roxo-azul (identidade da asa), peso T1
- Badge temporal: "Alterado há [X horas]" — contextualiza sem pressionar
- O scroll da tela não é necessário para ver o botão — o card inteiro está visible above fold

**O que o Bloco de Alteração não faz:**
- Não pisca
- Não vibra além do haptic inicial ao carregar
- Não tem animação de atenção repetitiva
- Não bloqueia o resto da tela (o Membro pode scrollar e ver o Card de Próxima Atividade abaixo)
- Não desaparece ao scrollar para baixo — retorna ao topo quando o Membro sobe

---

## 9. Como a IA aparece visualmente — S-01

**Modo passivo (sempre presente):**
Card IA com borda roxo-azul suave + ícone de asa pequeno (16px) no canto. Texto em italic regular. Sem botão — o card inteiro é tocável para expandir.

**Modo ativo (após toque):**
O card expande inline — sem abrir modal, sem trocar de tela. Aparece campo de texto na base do card expandido. A IA responde no mesmo card — a conversa acontece no contexto do Meu Dia, não em outro lugar.

**Visual da resposta da IA:**
- Bubble de resposta com fundo roxo-azul muito suave
- Tipografia T2 em italic
- Sem avatar genérico de "chatbot" — apenas o ícone de asa

**O que a IA não parece visualmente:**
- Não parece WhatsApp (sem bubble de chat estilo mensagem)
- Não parece ChatGPT (sem área de chat separada, sem "loading..." com pontos)
- Não parece assistente genérico (sem "Como posso ajudar você hoje?")

---

## 10. Como a identidade da Asa se manifesta — S-01

1. **Gradiente roxo-azul:** usado no botão de Confirmar (ação mais importante do estado crítico) e nos elementos da IA
2. **Ícone de asa:** presente no Card IA, como watermark ultra-suave no Card de Próxima Atividade
3. **Leveza:** espaço em branco generoso, cards respirando
4. **Profundidade:** hierarquia visual com planos distintos — não tudo no mesmo nível
5. **Direção:** a ação mais importante está sempre próxima — o Membro nunca procura o que fazer

---

## 11. Como transmite calma inteligente — S-01

- **No estado normal:** a ausência de cor viva e densidade é o sinal de calma. O branco e o espaço são a mensagem.
- **No estado crítico:** a presença do Bloco de Alteração é firme, não ansiosa. Ele está lá, estável, esperando a ação. Não pulsa, não avisa repetidamente — é um fato apresentado com clareza.
- **A IA narra:** a presença da IA como elemento narrativo (não apenas como chatbot) diz ao Membro "alguém já analisou o seu dia — você não precisa fazer esse trabalho".

---

## 12. Como evita parecer ERP — S-01

- **Sem tabelas:** a programação do dia é timeline vertical, não grade
- **Sem labels de campo:** "Horário: 14h30" → apenas "14h30" com contexto visual suficiente
- **Sem menus de filtro:** o Membro não filtra nada no Meu Dia
- **Sem paginação:** o conteúdo é de hoje — não há navegação para outro conjunto de dados
- **Sem ID de registros:** o Membro nunca vê "Registro #4521" ou "Código de atividade"

---

## 13. Como evita parecer chat genérico — S-01

- **A IA não inicia com pergunta:** não diz "O que posso fazer por você?". Diz o que já sabe sobre o dia do Membro.
- **A conversa acontece no contexto:** não em uma tela separada de chat
- **O card IA tem estrutura, não apenas texto livre:** a narrativa tem um começo (contexto do dia), meio (o que mudou) e fim (o que saber)
- **O usuário não precisa "abrir o chat" para receber valor da IA:** o valor é passivo por padrão

---

## 14. Como evita sobrecarga cognitiva — S-01

- **Hierarquia dinâmica:** o sistema decide o que mostrar primeiro. O Membro nunca precisa escanear para encontrar o prioritário.
- **Seções secundárias contraídas:** Linha do Tempo, Solicitações, Entregas são acessíveis mas não exibidas por padrão
- **Tipografia T4 para informação não prioritária:** o passado é visualmente silenciado
- **Máximo de 1 elemento crítico simultâneo:** se existem 3 alterações não confirmadas, elas aparecem em sequência — não todas ao mesmo tempo

---

---

# S-02 — PAINEL OPERACIONAL — Design Visual

---

## 1. Hierarquia visual principal

O Painel Operacional tem uma hierarquia mais permanente que o Meu Dia — os elementos mudam de estado, mas a estrutura visual é consistente.

```
┌─────────────────────────────────────┐
│  [Header: data, operação, Grupo]    │
│                                     │
│  ┌───────────────────────────────┐  │  ← Zona de percepção imediata
│  │   STATUS DA OPERAÇÃO          │  │
│  │   (Indicador dominante)       │  │  ← 30-35% do viewport
│  │   Pronta / Atenção / Crítico  │  │
│  │   + Narrativa rápida do estado│  │
│  └───────────────────────────────┘  │
│                                     │
│  [Lista de Exceções Priorizadas]    │  ← Segunda zona
│  [Rastreador de Confirmações]       │  ← Terceira zona
│  [Multi-horizonte — expansível]     │  ← Quarta zona
│  [Indicador de Solicitações]        │  ← Quinta zona
└─────────────────────────────────────┘
```

---

## 2. Ordem de percepção em até 2 segundos

**Estado Crítico:**
- 0–0,3s: Vermelho. Grande. Urgência imediata (percepção periférica — antes de focar)
- 0,3–1s: "[Atividade] em [X min] · Cobertura: zero" — entende o problema
- 1–2s: "Resolver" — sabe a próxima ação

**Estado Atenção:**
- 0–0,5s: Âmbar. Algo precisa de análise.
- 0,5–1,5s: Lista de exceções — a mais urgente em destaque
- 1,5–2s: Ação na primeira exceção — ponto de entrada para resolução

**Estado Pronta:**
- 0–0,5s: Verde (ou neutro positivo). Calma.
- 0,5–2s: Leitura relaxada do multi-horizonte — planejamento, não urgência

---

## 3. Elemento visual dominante: Indicador de Status da Operação

Este é o elemento mais crítico do produto inteiro para o Supervisor. Deve ser percebido **pela visão periférica** — antes de o olho focar.

**Anatomia do Indicador de Status:**

**Card grande que ocupa todo o width da tela.**

Interior do card em Estado Pronta:
- Fundo: tint muito suave de verde (quase branco com leve toque verde)
- Ícone: grande, centralizado ou à esquerda — shield ou check (escudo ou marca de verificação)
- Texto principal (T1 bold): "Operação Pronta"
- Texto secundário (T2): "[N] atividades · Cobertura completa"
- Nenhum outro elemento visual competindo

Interior do card em Estado Atenção:
- Fundo: tint suave de âmbar
- Ícone: grande — sinal de atenção (não alarme)
- Texto T1: "Atenção"
- Texto T2: "[N] exceções · Mais urgente: [atividade] às [horário]"
- Link de ação: "Ver exceções ↓"

Interior do card em Estado Crítico:
- Fundo: tint coral/vermelho suave
- Borda: sem borda esquerda (como os outros cards) — borda completa em vermelho profundo
- Ícone: grande, claro
- Texto T1 (maior que o normal): "Crítico"
- Texto T2: "[Atividade] começa em [X min] · Cobertura: zero"
- Botão: "Resolver agora" — largura total, gradiente da identidade
- Countdown visual se < 30min: timer visível (não piscante — apenas presente)

**Princípio do Indicador:** o Supervisor que acessa o Painel ao sair de uma reunião, enquanto caminha, com o celular à distância do braço — deve conseguir identificar o estado pela cor de fundo do card sem aproximar o celular. Isso não é hipérbole — é o teste de design.

---

## 4. Elementos secundários

### Lista de Exceções Priorizadas

**Visual:** cada exceção é um card individual — não uma linha de tabela.

**Anatomia de um card de exceção:**
- Borda esquerda: âmbar (atenção) ou vermelho (crítico) — 4px
- Topo do card: atividade afetada (T1) + horário de início + countdown
- Meio: qual é o problema — "Amanda ausente · Astrid descoberta"
- Base: pills de estado — "Cobertura: Parcial" ou "Cobertura: Zero"
- Ação: botão secundário "Resolver" alinhado à direita

**Ordenação visual:** a primeira exceção da lista é maior que as demais — comunica visualmente "comece por aqui".

**Múltiplas exceções:** a lista rola. O Supervisor sabe que há mais porque o segundo card é parcialmente visível abaixo do primeiro (peek). Sem paginação.

---

### Rastreador de Confirmações

**Visual:** uma seção com fundo sutilmente diferente (não card — mais como uma faixa informativa).

**Anatomia:**
- Cabeçalho: "Confirmações · [N de N]"
- Barra de progresso: visual de preenchimento (não numérico apenas)
- Lista de pendentes: avatares ou nomes em pills âmbar "Bruno · não confirmou"
- Ação por pendente: botão discreto "Renotificar"

**Estados da barra de progresso:**
- Todos confirmados: verde, completa
- Maioria confirmada, tempo suficiente: âmbar parcial
- Pendentes com atividade chegando: vermelho parcial + urgência no texto

---

### Multi-horizonte

**Visual padrão (contraído):** uma faixa com 3 blocos — hoje, amanhã, depois de amanhã. Cada bloco tem um indicador de status (bolinha verde / âmbar / vermelho) e o nome do dia.

**Visual expandido:** cada dia abre com lista resumida de riscos identificados.

**O que não é:** calendário completo. Grade. Tabela. É uma leitura de risco resumida, não uma agenda completa.

---

### Indicador de Solicitações

**Visual:** seção compacta — ícone + contador + a mais urgente em uma linha.

**Estado urgente (data de impacto próxima):** pill âmbar ao lado do contador.

---

## 5. Elementos contextuais

### Narrativa da IA

- **Visual:** card IA (borda roxo-azul + ícone de asa) imediatamente abaixo do Indicador de Status
- **Conteúdo:** briefing do estado atual em 2–4 linhas
- **Expansão:** toque abre campo de pergunta inline

### Último Evento

- **Visual:** linha de texto T3, cinza suave, no final do Painel — "Último evento: [descrição] · [hora]"
- **Ação:** toque abre S-11 filtrado

---

## 6. Estados normais

**Visual do Estado Pronta:** o Painel no estado normal é o mais tranquilo possível — e esse silêncio visual é uma mensagem positiva explícita. O Supervisor vê branco e verde e sabe: não há nada urgente agora.

**O risco oposto:** se o Painel sempre parecer denso mesmo quando está OK, o Supervisor para de dar atenção ao Painel — porque espera ruído e aprende a ignorar. O estado Pronta deve ser visivelmente diferente do estado Atenção.

---

## 7. Estados de atenção

O Painel em Atenção é o estado mais comum no dia a dia. Deve transmitir: *"Há algo aqui, mas está sob controle. Você pode resolver isso."*

**Hierarquia visual do Atenção:**
- Indicador: âmbar dominante (mas não vermelho)
- Lista de exceções: visível e clara
- Ação disponível: o Supervisor sabe como resolver sem precisar investigar

---

## 8. Estados críticos

O Painel em Crítico é o estado que o design precisa tornar impossível de ignorar — mesmo que o Supervisor abra o app distraído.

**Além da cor:** quando o status é Crítico, o painel dispara uma animação única de entrada — um pulso suave (não repetitivo) que chama a atenção para o Indicador de Status. Acontece apenas uma vez ao abrir o app neste estado — não fica pulsando.

**A urgência visual cresce com o tempo:** o countdown dentro do Indicador Crítico usa tipografia que aumenta levemente de peso conforme o tempo diminui — sutil, mas percebido.

---

## 9. Como a IA aparece visualmente — S-02

**No Indicador de Status:** a IA contribui para a narrativa do status (a linha que diz "mais urgente: [atividade]") — mas não tem card próprio no topo. O status é do sistema; a interpretação é da IA.

**Card IA (abaixo do Indicador):** briefing narrativo. A IA é a voz que contextualiza o que o sistema apresenta como dado.

**No fluxo de exceção:** quando o Supervisor toca "Resolver" em uma exceção, a IA já apresentou a recomendação antes de qualquer scroll. O Supervisor vê a recomendação da IA como o primeiro elemento do fluxo de resolução — não como um passo extra.

**Proatividade visual:** quando a IA identifica algo que o Supervisor ainda não viu (risco acumulado, confirmação atrasada crítica), aparece um badge discreto no Card IA — "IA identificou um risco não óbvio". O Supervisor pode tocar para ver. Não é um alerta — é um convite.

---

## 10. Como a identidade da Asa se manifesta — S-02

1. **Gradiente roxo-azul:** ação primária "Resolver agora" em qualquer estado crítico
2. **Leveza no estado Pronta:** o estado positivo do Painel é arejado — o Supervisor não sente o peso de um sistema de monitoramento quando tudo está OK
3. **Profundidade nos estados de exceção:** a hierarquia de exceções (a primeira maior, as demais em segundo plano) cria profundidade — não uma lista plana
4. **Precisão:** cada elemento do Painel tem uma função clara — nada é decorativo

---

## 11. Como transmite calma inteligente — S-02

- **Estado Pronta:** a clareza visual do "tudo bem" é tão forte quanto a urgência do "há um problema"
- **Estado Crítico:** firme, não ansioso. O vermelho não pisca. O countdown não é um relógio de bomba — é informação.
- **A IA como narrador:** a presença da IA transformando dados em narrativa diz ao Supervisor "você não está sozinho lidando com isso"
- **Priorização explícita:** quando há múltiplas exceções, a ordem visual já fez a triagem. O Supervisor não precisa decidir por onde começar.

---

## 12. Como evita parecer ERP — S-02

- **Sem dashboard de KPIs:** o Painel não tem gráficos de linha, gauges, ou cards de "Total de Folgas: 23"
- **Sem tabela de turnos:** a cobertura não é uma grade com cabeçalhos de coluna (turno matutino / turno vespertino / turno noturno)
- **Sem filtros expostos:** o Supervisor não filtra o Painel — o Painel já filtra por relevância automaticamente
- **Sem navegação de "módulos":** o Painel não tem abas internas (Operação / Equipe / Relatório)

---

## 13. Como evita sobrecarga cognitiva — S-02

- **Máximo de 1 elemento crítico visual simultâneo:** o Indicador de Status ocupa toda a largura e domina. Não compete com mais nada.
- **Exceções em lista ordenada:** o Supervisor resolve uma de cada vez — a hierarquia visual guia a sequência
- **Multi-horizonte contraído:** o Supervisor no meio de uma crise não vê planejamento da semana — vê apenas o problema imediato
- **Ação sempre próxima:** nunca mais de 1 toque para chegar à ação relevante de qualquer elemento

---

---

# S-04 — ESCALA — Design Visual

---

## 1. Hierarquia visual principal

A Escala tem duas hierarquias diferentes dependendo do modo de entrada.

### Modo construção planejada

```
┌─────────────────────────────────────┐
│  [Navegação temporal — strip]       │  ← Seletor de data
│                                     │
│  ┌───────────────────────────────┐  │
│  │ RESUMO DE COBERTURA           │  │  ← Diagnóstico rápido da data
│  │ 8 cobertas · 2 em risco · 1 aberta │
│  └───────────────────────────────┘  │
│                                     │
│  [Lista de Atividades com Status]   │  ← Cards de atividade
│    ↳ [Posições — expansível]        │
│                                     │
│  [Painel de Validação — fixo]       │  ← Sempre visível
│  [Publicar — sempre visível]        │  ← Ação principal
└─────────────────────────────────────┘
```

### Modo exceção (chegando do Painel)

```
┌─────────────────────────────────────┐
│  [← Voltar ao Painel]               │
│                                     │
│  ┌───────────────────────────────┐  │
│  │ EXCEÇÃO CARREGADA             │  │  ← Elemento dominante — pré-carregado
│  │ Amanda ausente · Musical 14h  │  │
│  │ Astrid: sem cobertura         │  │
│  │ Começa em: 43 minutos         │  │
│  │                               │  │
│  │ CANDIDATOS (já calculados)    │  │
│  │ → Beatriz (recomendada)       │  │
│  │ → Carlos (risco moderado)     │  │
│  │ → Marina (risco alto)         │  │
│  └───────────────────────────────┘  │
│                                     │
│  [Resto da Escala — em segundo]     │
└─────────────────────────────────────┘
```

---

## 2. Ordem de percepção em até 2 segundos

**Modo construção:**
- 0–0,5s: Seletor de data — onde estou no tempo?
- 0,5–1,5s: Resumo de cobertura — quantas posições estão OK / em risco / em aberto
- 1,5–2s: Primeira atividade com problema — onde agir primeiro

**Modo exceção:**
- 0–0,5s: Contexto da exceção já visível — qual atividade, qual posição, quanto tempo
- 0,5–1,5s: Candidato recomendado em destaque — o sistema já fez o trabalho
- 1,5–2s: Ação de confirmar ou explorar alternativas

---

## 3. Elemento visual dominante

### Modo construção: **Resumo de Cobertura**

- **Visual:** card compacto, amplo, com 3 contadores lado a lado
- **Cobertas:** número + pill verde
- **Em risco:** número + pill âmbar
- **Em aberto:** número + pill vermelho (se houver) — vermelho só aparece se existir posição em aberto
- **Interação:** toque em cada contador filtra a lista abaixo

### Modo exceção: **Card de Exceção + Candidatos**

Este card não existe na hierarquia dos cards padrão. É o maior card da Escala. Visualmente diferente de tudo.

- **Fundo:** tint de âmbar a vermelho (dependendo da urgência)
- **Topo do card:** contexto da exceção — atividade, posição, horário, countdown
- **Seção de candidatos:** integrada ao mesmo card (não um card separado)
- **Candidato recomendado:** posição visual destacada — maior, borda verde, label "Recomendado"
- **Candidatos subsequentes:** progressivamente menores, sem borda verde, com tag de risco

---

## 4. Elementos secundários

### Navegação Temporal (Strip de Datas)

**Visual:** uma faixa horizontal rolável com os próximos 14 dias.

Por dia:
- Data abreviada
- Indicador de status (bolinha: verde / âmbar / vermelho)
- Show indicator (ícone de microfone ou teatro se há show)

A data selecionada: levemente maior e com sublinhado do gradiente da identidade.

**Não é um calendário mensal** — é uma régua de planejamento imediato.

---

### Lista de Atividades

**Cada atividade = 1 card**

**Anatomia do card de atividade (fechado):**
- Linha superior: nome + tipo + horário
- Linha inferior: pills resumidos — "8 cobertas · 1 em risco"
- Borda esquerda: verde (completa) / âmbar (em risco) / vermelho (em aberto)
- Seta de expansão

**Anatomia do card de atividade (expandido, posições visíveis):**

Cada posição = uma linha dentro do card expandido:
- Slot visual: avatar circular do membro + nome + pill de status
- Slots em aberto: espaço vazio visível + "Adicionar" — não apenas texto
- Restrição ativa: ícone de alerta ao lado do avatar + tooltip ao tocar

**O que uma posição não é:** linha de tabela com células. É um elemento com forma própria.

---

### Painel de Validação

**Visual:** faixa fixa na base da tela (above the nav bar, below the content).

- Fundo branco com sombra para cima (separação visual do conteúdo)
- Conteúdo dinâmico: "Pronto para publicar" ou "[N] posições em aberto · [N] conflitos"
- Botão "Publicar": sempre visível nesta faixa — nunca some com scroll

---

## 5. Elementos contextuais

### Simulação de Cascata (D4)

**Ativada:** após selecionar um candidato, antes de confirmar.

**Visual:** não um modal separado — um painel que expande abaixo do candidato selecionado dentro do card de exceção.

**Conteúdo visual:**

```
┌─────────────────────────────────────┐
│  IMPACTO DA TROCA                   │
│                                     │
│  ✓  Astrid no Musical 14h → coberta │
│  ⚠  Bloco 3 no Ensaio 16h → aberto │
│                                     │
│  IA: "Beatriz pode cobrir Bloco 3.  │
│  Vale a troca."                     │
│                                     │
│  [Confirmar troca]  [Cancelar]      │
└─────────────────────────────────────┘
```

**Linguagem visual:**
- Check verde para o que é resolvido
- Atenção âmbar para o que fica descoberto
- Texto da IA em italic, borda esquerda roxo-azul — linguagem operacional, não técnica
- Os dois botões têm clareza visual absoluta — não há ambiguidade sobre qual confirma e qual cancela

**O que a cascata não é:** tabela de conflitos. Lista de registros afetados. Código de sistema.

---

### Candidatos Classificados por Risco (D3)

**Visual:** cards de candidato ordenados verticalmente por nível de risco.

**Card do candidato recomendado:**
- Tamanho: maior que os demais
- Borda: verde suave (2px) + tag "Recomendado" no canto
- IA rationale: uma linha abaixo do nome ("Titular de Astrid · Sem conflitos hoje")
- Ação: "Selecionar Beatriz" — botão primário

**Card de candidato com risco moderado:**
- Tamanho: padrão
- Sem borda verde
- Tag âmbar "Risco moderado"
- IA rationale: motivo do risco ("Nunca foi titular, apenas observadora")
- Ação: "Selecionar Carlos" — botão secundário

**Card de candidato com risco alto:**
- Tamanho: ligeiramente menor (ou mesmo tamanho, mas opacidade reduzida)
- Tag vermelha "Risco alto" + ícone de alerta
- IA rationale: motivo detalhado
- Ação: "Selecionar Marina" — botão terciário (delineado, sem preenchimento)

**O que candidatos não são:** lista plana. Dropdown. Radio buttons.

---

## 6. Estados normais

A Escala em modo construção com boa cobertura é o estado normal. Deve parecer uma ferramenta de revisão, não de emergência.

**Visual:** branco dominante, verde nas bordas dos cards de atividade completa, navegação temporal tranquila.

**O Supervisor deve sentir:** controle. Estou revisando e aprovando — não apagando incêndios.

---

## 7. Estados de atenção

Posições em risco na Escala. O Supervisor percebe, mas não entra em modo de urgência.

**Visual:** âmbar nas bordas dos cards afetados. Resumo de Cobertura com contador âmbar visível. O Supervisor sabe que tem algo a resolver quando puder — não agora necessariamente.

---

## 8. Estados críticos

Posição crítica em aberto com show iminente. O Supervisor chega aqui via Painel (notificação crítica).

**Visual:** o card de exceção domina a tela no topo. O resto da Escala fica em segundo plano (opacidade reduzida levemente). O Supervisor não pode "ignorar" a exceção e ir mexer em outra coisa — visualmente, a exceção ocupa o espaço principal.

**Countdown:** se < 30 minutos, o timer é visível no topo do card de exceção. Não animado — apenas presente, atualizado a cada minuto.

---

## 9. Como a IA aparece visualmente — S-04

**Na classificação de candidatos:** a IA não aparece como um card separado. O rationale da IA está integrado em cada card de candidato — é a linha abaixo do nome que explica o risco ou a recomendação. Ícone de asa ultra-pequeno (12px) ao lado do rationale indica que vem da IA.

**Na simulação de cascata:** a IA aparece como um bloco de texto italic dentro do painel de cascata — com borda esquerda roxo-azul. Sua voz é operacional: "vale a troca" ou "não recomendo neste caso".

**Na geração do Livro do Dia:** o resultado da IA é um card expandido com a proposta completa e os pontos de atenção destacados. O Supervisor revisa, não escolhe de uma lista vazia.

**D5 — IA pronta ao chegar de notificação crítica:**
Quando o Supervisor chega à Escala via notificação crítica, os candidatos já estão calculados. Visualmente: não há loading state — os candidatos aparecem com o card de exceção. Se o cálculo ainda está em progresso (cenário de latência), o estado intermediário mostra um skeleton de candidato com "Analisando disponibilidade..." — nunca uma lista vazia que força espera ativa.

---

## 10. Como a identidade da Asa se manifesta — S-04

1. **Gradiente roxo-azul:** na ação de Publicar (sempre visível no Painel de Validação) e na confirmação de substituição
2. **Ícone de asa:** no rationale da IA integrado nos cards de candidato
3. **Leveza:** a Escala não parece uma planilha — parece cards de cobertura com respiração
4. **Profundidade:** o modo de exceção cria um segundo plano (o restante da Escala recua) para que o card de exceção tenha profundidade perceptiva
5. **Precisão:** cada elemento da Escala tem função clara e visível

---

## 11. Como transmite calma inteligente — S-04

- **No modo construção:** o Supervisor vê uma Escala organizada por atividade, não por um problema de cada vez. Pode trabalhar sistematicamente.
- **No modo exceção:** o card de exceção pré-carregado com candidatos já calculados diz ao Supervisor "o sistema fez o trabalho difícil — você só precisa confirmar". Isso é calma inteligente.
- **Na cascata:** apresentar o impacto antes da confirmação — sem surpresas depois — é a maior contribuição para a calma do Supervisor.

---

## 12. Como evita parecer ERP — S-04

- **Sem grid de turnos:** a Escala não é uma tabela com membros nas linhas e horários nas colunas
- **Sem código de alocação:** o Supervisor não vê "ID_ALLOC_2025_0614_ASTRID_AMANDA"
- **Sem relatório de cobertura:** o Resumo de Cobertura é um card compacto — não um relatório exportável
- **Sem dropdown de status manual:** o status de uma posição não é selecionado em um menu — é inferido automaticamente pelo sistema

---

## 13. Como evita parecer planilha — S-04

- **Cards em lugar de linhas:** toda unidade de informação coerente é um card com borda e padding
- **Hierarquia visual dentro de cada card:** título, detalhe, ação — não células planas
- **Cor com significado:** verde/âmbar/vermelho nas bordas dos cards de atividade — não em células alternadas
- **Ações inline:** o Supervisor age dentro do card, não em uma tela separada

---

## 14. Como evita sobrecarga cognitiva — S-04

- **Modo exceção isola o problema:** o restante da Escala recua quando há exceção crítica
- **Candidatos pré-ordenados:** o Supervisor não analisa todos os candidatos — o primeiro da lista é a resposta para a maioria dos casos
- **Cascata antes da confirmação:** o impacto é visível antes da ação — não há arrependimento pós-confirmação que cria retrabalho mental
- **Painel de Validação como âncora:** o estado de publicação está sempre visível — o Supervisor sabe em que ponto está sem precisar calcular

---

---

# DESIGN SYSTEM NECESSÁRIO PARA O BLOCO 1

---

## Fundação de Cores

```
CORES DE ESTADO (semânticas — nunca decorativas)

Estado Normal / Confirmado
  Fundo tint:     #F0FAF0 (verde muito suave)
  Borda:          #4CAF50 (verde calmo — não neon)
  Pill:           #E8F5E9 com texto #2E7D32

Estado Atenção / Risco
  Fundo tint:     #FFF8E7 (âmbar muito suave)
  Borda:          #FF9800 (âmbar quente)
  Pill:           #FFF3E0 com texto #E65100

Estado Crítico / Urgente
  Fundo tint:     #FFF0EE (coral/vermelho muito suave)
  Borda:          #D32F2F (vermelho profundo — não vibrante)
  Pill:           #FFEBEE com texto #B71C1C

IDENTIDADE DA ASA
  Gradiente:      #7C3AED → #2563EB (roxo para azul)
  Ação primária:  botão com este gradiente
  IA:             variação suave do gradiente — mais claro e mais transparente

NEUTROS
  Fundo base:     #FFFFFF
  Fundo sutil:    #F8F9FA
  Cinza suave:    #E9ECEF
  Texto primário: #111827
  Texto secundário: #6B7280
  Texto silenciado: #9CA3AF
```

---

## Tipografia

```
HIERARQUIA

T1 — Primário
  Tamanho: 20–24px (mobile) / 24–28px (desktop)
  Peso: 700 (Bold)
  Cor: #111827
  Uso: nome da atividade, status da operação, papel do membro

T2 — Secundário
  Tamanho: 15–17px
  Peso: 500 (Medium)
  Cor: #374151
  Uso: horário, local, descrição de exceção

T3 — Contextual
  Tamanho: 13–14px
  Peso: 400 (Regular)
  Cor: #6B7280
  Uso: data, quem fez, metadado

T4 — Silenciado
  Tamanho: 13px
  Peso: 400
  Cor: #9CA3AF
  Uso: atividades passadas, informação não prioritária

T-IA — Narrativa da IA
  Tamanho: 14–15px
  Peso: 400
  Estilo: italic
  Cor: #374151
  Uso: texto gerado pela IA
```

---

## Componentes de Card

```
CARD PADRÃO
  background: #FFFFFF
  border-radius: 16px
  box-shadow: 0 1px 4px rgba(0,0,0,0.08)
  padding: 20px
  margin-bottom: 12px

CARD COM ESTADO (variação)
  + border-left: 4px solid [cor de estado]
  + background: [fundo tint do estado]

CARD CRÍTICO (Bloco de Alteração / Status Crítico)
  border-left: 6px solid #D32F2F
  background: #FFF0EE
  — sem sombra adicional (a borda já faz o trabalho)

CARD IA
  border-left: 3px solid #7C3AED (roxo suave)
  background: #FAFBFF
  — ícone de asa 16px no canto superior esquerdo

CARD SILENCIADO
  opacity: 0.6
  background: #FFFFFF
  — sem borda colorida
```

---

## Botões

```
PRIMÁRIO (ação principal, uma por tela)
  background: gradiente #7C3AED → #2563EB
  cor do texto: #FFFFFF
  border-radius: 12px
  padding: 16px 24px
  peso da fonte: 600
  uso: Confirmar / Publicar / Resolver agora

SECUNDÁRIO (ações de apoio)
  background: #FFFFFF
  border: 1.5px solid #E9ECEF
  cor do texto: #374151
  border-radius: 12px
  uso: Cancelar / Ver mais / Expandir

DESTRUTIVO / CRÍTICO (apenas em confirmações que afetam dados)
  background: #D32F2F
  cor do texto: #FFFFFF
  uso: nunca no fluxo normal — apenas em confirmações de exclusão
```

---

## Pills (indicadores de estado)

```
FORMATO: inline badge arredondado (border-radius: 20px)
CONTEÚDO: ícone 12px (opcional) + texto curto

Exemplos:
  ✓ Confirmado      — verde
  ⚠ Em risco        — âmbar
  ✕ Em aberto       — vermelho
  IA Recomendado    — roxo-azul suave
  ↺ Pendente        — cinza médio
```

---

## Navegação Temporal (strip)

```
FORMATO: faixa horizontal rolável
LARGURA DE CADA DÍA: 56–64px
ALTURA DA FAIXA: 72px

POR DIA:
  Data abreviada: T3
  Indicador de status: bolinha 8px com cor de estado
  Ícone de show: ícone 12px se há show programado

DIA SELECIONADO:
  Texto: T2 bold
  Underline: linha de 3px com gradiente da identidade
  Fundo: levemente tintado
```

---

## Painel de Validação (fixo na S-04)

```
POSIÇÃO: fixo na base da tela, acima da nav bar
ALTURA: 72px
FUNDO: branco + sombra para cima (box-shadow: 0 -2px 8px rgba(0,0,0,0.06))

CONTEÚDO:
  Esquerda: status da validação (texto T3)
  Direita: botão Publicar (primário, compacto — 44px de altura)

ESTADOS:
  Pronto para publicar: texto verde
  Com alertas: texto âmbar + contagem
  Erro crítico: texto vermelho
```

---

## Ícone de Asa — Uso no Sistema

```
TAMANHOS PERMITIDOS:
  32px — em cards de IA em destaque especial
  16px — em cards de IA padrão (canto superior esquerdo)
  12px — em linha junto ao rationale da IA

COR:
  Gradiente completo: apenas quando é elemento principal do card
  Roxo suave (#7C3AED 40%): quando é watermark ou indicador discreto

PROIBIDO:
  Usar a asa como ícone de "mais opções" ou elemento de navegação
  Usar em qualquer contexto que não seja identidade ou IA
```

---

---

# VALIDAÇÃO DAS 5 DECISÕES DE DESIGN

---

## D1 — Bloco de Alteração Visualmente Inconfundível

**Especificação visual:**
- Borda esquerda 6px (vs. 4px dos outros cards de estado — fisicamente maior)
- Fundo coral/vermelho tint único — não usado em nenhum outro componente do sistema
- O "antes" está tachado e cinza — visualmente morto
- O "depois" está em T1 bold — visualmente vivo
- Botão Confirmar em largura total do card, gradiente da identidade
- Nenhum outro elemento do sistema usa essa combinação visual

**Teste de inconfundibilidade:** se o Membro ver este card entre 20 outros cards do sistema, imediatamente sabe que exige ação. Nenhum outro card passa nesse teste porque nenhum usa borda de 6px + fundo tintado + tachado + botão full-width simultaneamente.

**Validado: ✅**

---

## D2 — Status da Operação Percebido em 2 Segundos

**Especificação visual:**
- O Indicador de Status ocupa 30–35% do viewport na abertura — impossível não ver
- Cor de fundo do card muda com o estado — percepção periférica antes do foco
- O texto T1 (Pronta / Atenção / Crítico) é a maior tipografia da tela
- No estado Crítico: a única animação do sistema (pulso único de entrada) direciona o olhar

**Teste de periférica:** o Supervisor que abre o app enquanto caminha, com o celular à distância do braço, percebe o estado pela cor de fundo do card dominante antes de aproximar o celular para ler. Verde = relaxar. Âmbar = preparar. Vermelho = agir.

**Validado: ✅**

---

## D3 — Hierarquia Clara de Candidatos

**Especificação visual:**
- Candidato recomendado: maior, borda verde, tag "Recomendado", botão primário
- Candidato risco moderado: tamanho padrão, tag âmbar, botão secundário
- Candidato risco alto: tamanho padrão (ou levemente menor), tag vermelha, botão terciário
- A hierarquia é visual (tamanho + cor + tipo de botão) — não apenas textual

**Teste de condução visual:** o Supervisor que vê a lista de candidatos pela primeira vez deve selecionar o candidato recomendado como ação natural — sem precisar ler as razões. A hierarquia visual conduz. As razões explicam.

**Validado: ✅**

---

## D4 — Simulação de Cascata em Linguagem Operacional

**Especificação visual:**
- Check verde para o que é resolvido
- Atenção âmbar para o que fica descoberto
- Texto da IA em italic com borda esquerda roxo-azul — voz diferenciada visualmente
- Os verbos são operacionais: "coberta / aberto / vale a troca / não recomendo"
- Nunca: "Conflito detectado em registro ID_4521 com foreign key constraint"

**Teste de linguagem:** um Supervisor sem treinamento técnico em sistemas lê a simulação de cascata e entende o impacto. Não precisa traduzir para operação — já está em operação.

**Validado: ✅**

---

## D5 — IA Pronta para Agir em Situações Críticas

**Especificação visual:**
- Quando o Supervisor chega via notificação crítica: candidatos visíveis com o card de exceção — zero delay percebido
- Se cálculo em progresso: skeleton de candidato com "Analisando disponibilidade..." em T3 — nunca tela vazia
- A recomendação da IA está no primeiro card de candidato — não precisa scrollar
- O rationale da IA é a primeira linha de texto após o nome do candidato — contexto antes da ação

**Teste de urgência:** o Supervisor com 15 minutos para resolver, no backstage, com o polegar no celular — consegue fazer a substituição antes de sair da coxia. A IA não é passo adicional — é parte do card que ele já está olhando.

**Validado: ✅**

---

---

# RISCOS VISUAIS

---

## Risco V1 — Vermelho Inflacionado

**Risco:** usar vermelho em estados de atenção (que deveriam ser âmbar) por preguiça de distinção.

**Consequência:** quando tudo é vermelho, nada é crítico. O Supervisor aprende a ignorar o vermelho.

**Mitigação:** o vermelho é reservado exclusivamente para: Bloco de Alteração, Status Crítico, posição crítica em aberto. Qualquer outro estado usa âmbar.

---

## Risco V2 — Densidade por Completude

**Risco:** designer colocar todas as informações disponíveis no card porque "pode ser útil".

**Consequência:** cards densos que o Supervisor não lê — apenas escaneia em busca da ação.

**Mitigação:** cada card tem no máximo 3 linhas de conteúdo visível (sem expandir). Informação adicional existe — mas requer intenção do usuário para ver.

---

## Risco V3 — IA Como Bloco de Texto

**Risco:** o texto da IA ser longo, não editado, parecendo output de LLM bruto.

**Consequência:** o Supervisor para de ler a narrativa da IA — se torna ruído.

**Mitigação:** limite rígido de 3 linhas para a narrativa da IA em qualquer modo passivo. Texto editado para ser específico ("Amanda ausente · Astrid a descoberto"), não genérico ("Há uma ausência que pode impactar a operação de hoje").

---

## Risco V4 — Estado Pronta Vazio

**Risco:** quando a operação está OK, o Painel Operacional parece vazio ou incompleto.

**Consequência:** o Supervisor pensa que algo falhou no sistema — não que está tudo bem.

**Mitigação:** o estado Pronta é explicitamente positivo e generoso. O Indicador de Status no estado Pronta tem conteúdo afirmativo ("3 shows hoje · Cobertura completa · Todas as confirmações recebidas"). A ausência de problema é comunicada, não implícita.

---

## Risco V5 — Escala Como Planilha Disfarçada

**Risco:** posições representadas como linhas em uma tabela com avatar adicionado.

**Consequência:** parece o sistema de planilha que o MyASA promete substituir.

**Mitigação:** posições dentro de um card de atividade são elementos com forma própria — slot com avatar, nome e pill de status. Nenhum elemento de grid ou tabela. Os testes visuais devem incluir comparação com uma planilha de Excel: se o design lembra a planilha, refazer.

---

## Risco V6 — Glassmorphism Como Estética Geral

**Risco:** aplicar glassmorphism em todos os cards por parecer premium.

**Consequência:** conteúdo operacional perde legibilidade. Em condições de luminosidade variável (ao ar livre, backstage com luz de palco), textura de vidro sobre vidro é ilegível.

**Mitigação:** glassmorphism restrito a overlays e modais de confirmação. Nenhum card de conteúdo operacional usa glassmorphism.

---

---

# DECISÕES VISUAIS OBRIGATÓRIAS

---

As decisões a seguir não são sugestões — são restrições que o designer deve honrar. Qualquer desvio precisa de justificativa explícita e validação com o Product Owner.

**DVO-01:** O Bloco de Alteração usa borda esquerda de exatamente 6px — diferente de todos os outros estados (4px). Nunca pode ser menor.

**DVO-02:** O gradiente roxo-azul da identidade é usado exclusivamente em: botão de ação primária, elementos de IA, ícone de asa. Nunca como fundo de card, header, ou elemento decorativo.

**DVO-03:** Vermelho é reservado para: Bloco de Alteração, Status Crítico, posição crítica em aberto. Nunca para estados de atenção ou avisos comuns.

**DVO-04:** Nenhuma superfície do Bloco 1 usa fundo escuro. O fundo de qualquer tela é branco ou cinza muito claro (< 5% de cinza).

**DVO-05:** A IA nunca abre uma tela separada por padrão. Ela responde inline, no contexto da superfície atual. O chat dedicado existe mas é acessado por intenção explícita do usuário.

**DVO-06:** O botão "Publicar" em S-04 está sempre visível — no Painel de Validação fixo. Nunca some com scroll.

**DVO-07:** A lista de candidatos nunca é plana. A hierarquia visual (tamanho, cor, tipo de botão) entre recomendado / risco moderado / risco alto é sempre preservada.

**DVO-08:** A simulação de cascata aparece inline (dentro do card de exceção expandido) — nunca como modal separado que bloqueia o contexto.

**DVO-09:** No estado Pronta do Painel Operacional, o espaço em branco é intencional e não deve ser preenchido com conteúdo adicional "para parecer completo". Espaço é a mensagem.

**DVO-10:** A Escala nunca apresenta posições como linhas de tabela ou células de grid. Cada posição é um slot visual com forma própria dentro de um card de atividade.

---

## Veredicto

**A fundação visual do MyASA 2.0 — Bloco 1 está definida.**

As três superfícies têm princípios visuais claros, hierarquias bem definidas, e a identidade da Asa traduzida em linguagem de design. As 5 decisões críticas (D1–D5) estão validadas visualmente. Os 6 riscos estão mapeados com mitigação. As 10 Decisões Visuais Obrigatórias estão documentadas.

**O próximo passo é a criação dos wireframes de S-01, S-02 e S-04 — baseados neste documento.**

---

*Próximo passo: Wireframes do Bloco 1*
*Bloco 2 Visual: S-05 Livro do Dia · S-08 Avisos · S-09 Mensagens · S-06 Solicitações*
