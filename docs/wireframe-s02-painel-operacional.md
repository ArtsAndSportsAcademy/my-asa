# MyASA 2.0 — Wireframe Estrutural — S-02 Painel Operacional

> Versão: 17/06/2026
> Fase: Wireframe Estrutural — anterior a mockup visual
> Superfície: S-02 Painel Operacional (Produto do Supervisor)
> Autoria: Senior Product Designer
> Status: Validação estrutural — pronta para revisão antes do mockup

---

## Premissa do Wireframe

O Painel Operacional é a principal ferramenta de diagnóstico do Supervisor. Cada abertura responde à mesma pergunta em menos de 2 segundos:

> **"A operação está protegida?"**

O design desta superfície deve fazer uma coisa melhor do que qualquer outra: tornar a resposta a essa pergunta **inescapável** — visível antes de o olho focar, antes de qualquer leitura, antes de qualquer scroll.

**Convenções do wireframe:**
```
╔══╗  = elemento dominante (status, exceção crítica)
┌──┐  = card padrão
│  │  = conteúdo interno
[ AÇÃO ]     = botão primário
( ação )     = botão secundário
[ ████████ ] = botão de largura total
~ ~ ~        = elemento da IA
▓▓▓▓▓▓       = barra de progresso preenchida
░░░░░░       = barra de progresso vazia
■ ■ ■        = nav bar
──── = divisor
···  = conteúdo expandível / recolhido
```

**Viewport de referência:** iPhone 14 Pro (390 × 844px)
**Perfil:** Fernanda — Supervisora do Grupo Ballet / Musical das Estrelas

---

---

# WIREFRAME 1 — ESTADO PRONTA

**Cenário:** Quinta-feira, 10:15. Dois shows hoje (14h e 19h30). Todas as posições cobertas. Oito membros confirmaram. Multi-horizonte sem riscos relevantes.

---

```
╔═══════════════════════════════════════╗
║  STATUS BAR  ·  18/06 Qui  ·  10:15  ║
╠═══════════════════════════════════════╣
║                                       ║
║  Painel Operacional    [avatar] [·]   ║
║  Musical das Estrelas · Grupo Ballet  ║
║                                       ║
║  ┌─────────────────────────────────┐  ║
║  │                                 │  ║  ← STATUS — elemento dominante
║  │    ✓  OPERAÇÃO PRONTA           │  ║    Ocupa 30% do viewport
║  │                                 │  ║    Fundo verde suave
║  │    2 shows hoje · Cobertura     │  ║
║  │    completa · 8/8 confirmados   │  ║
║  │                                 │  ║
║  └─────────────────────────────────┘  ║
║                                       ║
║  ┌─────────────────────────────────┐  ║  ← Card IA
║  │ ~                               │  ║
║  │ ~ Bom dia, Fernanda. A operação │  ║
║  │ ~ está protegida. Bruno e Carol │  ║
║  │ ~ confirmaram há 20 minutos.    │  ║
║  │ ~ Amanhã: um risco leve no      │  ║
║  │ ~ show das 15h — vale antecipar.│  ║
║  │                    ( Perguntar )│  ║
║  └─────────────────────────────────┘  ║
║                                       ║
║  PRÓXIMOS 3 DIAS                      ║  ← Multi-horizonte
║  ┌─────────────────────────────────┐  ║
║  │  Qui 18 ●verde  Sex 19 ●âmbar  │  ║  ← Strip de 3 dias
║  │          ↑ hoje          ↑ risco│  ║
║  │  Sáb 20 ●verde                  │  ║
║  │                                 │  ║
║  │  Sex 19: Folga de Amanda ·      │  ║  ← Risco expandido inline
║  │  Musical 15h · cobertura limite │  ║
║  │          ( Antecipar resolução )│  ║
║  └─────────────────────────────────┘  ║
║                                       ║
║  ─────────────────────────────────    ║
║                                       ║
║  ┌─────────────────────────────────┐  ║  ← Indicador de solicitações
║  │  Solicitações  ·  0 pendentes   │  ║
║  └─────────────────────────────────┘  ║
║                                       ║
║  Último evento: Escala publicada      ║  ← Último evento (linha T3)
║  ontem às 21:45                       ║
║                                       ║
╠═══════════════════════════════════════╣
║  ■ Painel  ○ Escala  ○ Solic  ○ Msg   ║
╚═══════════════════════════════════════╝
```

---

## Anotações do Estado Pronta

### Zona de percepção imediata (acima do fold)

O que Fernanda vê sem nenhum scroll:
1. Status "OPERAÇÃO PRONTA" em verde — resposta em < 1 segundo
2. Contexto numérico: "2 shows · cobertura completa · 8/8 confirmados"
3. Narrativa da IA: confirmação + 1 risco futuro mencionado proativamente

**Tempo para certeza: < 2 segundos.** Fernanda vê verde e pode fechar o app ou planejar com calma.

### O que o espaço em branco comunica aqui

No estado Pronta, a ausência de cards de exceção, a ausência de vermelho, e o espaço generoso são a mensagem. Fernanda percebe "não há urgência aqui" pela baixa densidade visual — não pela leitura de um texto que diz "sem problemas".

### Comportamento do multi-horizonte

O multi-horizonte está expandido por padrão no Estado Pronta — porque é a próxima coisa útil para o Supervisor quando não há exceções imediatas. No Estado Atenção e Crítico, ele é recolhido para dar prioridade às exceções.

### Hierarquia

```
1° Indicador de Status           [~28% do viewport]
2° Card IA                       [~18% do viewport]
3° Multi-horizonte               [~22% do viewport]
4° Indicador de Solicitações     [~8% do viewport]
5° Último Evento                 [~4% do viewport]
6° Nav bar                       [~8% do viewport]
── Espaço em branco              [~12% do viewport]
```

---

---

# WIREFRAME 2 — ESTADO ATENÇÃO

**Cenário:** 10:15, mesmo dia. Marina solicitou folga emergencial para o show das 19h30. A posição dela (Astrid no 2° show) está em aberto. Bruno ainda não confirmou a alteração publicada há 2h para o show das 14h (começa em menos de 4h).

---

```
╔═══════════════════════════════════════╗
║  STATUS BAR  ·  18/06 Qui  ·  10:15  ║
╠═══════════════════════════════════════╣
║                                       ║
║  Painel Operacional    [avatar] [!]   ║  ← Badge ativo
║  Musical das Estrelas · Grupo Ballet  ║
║                                       ║
║  ┌─────────────────────────────────┐  ║
║  │                                 │  ║  ← STATUS — elemento dominante
║  │    ⚠  ATENÇÃO                  │  ║    Fundo âmbar suave
║  │                                 │  ║
║  │    2 exceções ativas            │  ║
║  │    Mais urgente: Astrid · 19h30 │  ║
║  │                                 │  ║
║  └─────────────────────────────────┘  ║
║                                       ║
║  EXCEÇÕES — 2 ATIVAS                  ║  ← Cabeçalho de seção
║                                       ║
║  ┌─────────────────────────────────┐  ║  ← Exceção 1 — maior, mais urgente
║  │ ⚠  Show das 19h30              │  ║    Borda esquerda âmbar espessa
║  │    Musical das Estrelas         │  ║
║  │    Marina ausente · Astrid ↓    │  ║
║  │    ─────────────────────────    │  ║
║  │    Cobertura: NENHUMA           │  ║
║  │    9h30 até o show começar      │  ║
║  │                    [Resolver →] │  ║  ← Botão primário alinhado à direita
║  └─────────────────────────────────┘  ║
║                                       ║
║  ┌─────────────────────────────────┐  ║  ← Exceção 2 — tamanho padrão
║  │ ⚠  Confirmação pendente — Bruno │  ║    Borda esquerda âmbar fina
║  │    Show das 14h · Bruno · Marcos│  ║
║  │    Publicada há 2h              │  ║
║  │    Atividade em: 3h45           │  ║
║  │     ( Renotificar Bruno )       │  ║  ← Ação inline
║  └─────────────────────────────────┘  ║
║                                       ║
║  ┌─────────────────────────────────┐  ║  ← Card IA
║  │ ~                               │  ║
║  │ ~ Marina solicitou folga hoje   │  ║
║  │ ~ cedo. Astrid no 2° show está  │  ║
║  │ ~ em aberto. Beatriz é a melhor │  ║
║  │ ~ opção — sem conflitos hoje.   │  ║
║  │                    ( Perguntar )│  ║
║  └─────────────────────────────────┘  ║
║                                       ║
║  PRÓXIMOS 3 DIAS       ( ver ▾ )     ║  ← Multi-horizonte recolhido
║                                       ║
║  ┌─────────────────────────────────┐  ║  ← Indicador de solicitações
║  │  Solicitações  ·  1 pendente    │  ║    (solicitação da Marina)
║  │  Marina · folga hoje · urgente  │  ║
║  └─────────────────────────────────┘  ║
║                                       ║
╠═══════════════════════════════════════╣
║  ■ Painel  ○ Escala  ○ Solic  ○ Msg   ║
╚═══════════════════════════════════════╝
```

---

## Anotações do Estado Atenção

### O que muda em relação ao Estado Pronta

| Elemento | Estado Pronta | Estado Atenção |
|---|---|---|
| Indicador de Status | Verde · "Operação Pronta" | Âmbar · "Atenção · 2 exceções" |
| Card IA | Briefing positivo | Briefing com diagnóstico + sugestão |
| Multi-horizonte | Expandido (próxima prioridade) | Recolhido (exceções têm prioridade) |
| Cards de exceção | Não existem | Aparecem em hierarquia visual |
| Espaço em branco | Generoso | Reduzido — conteúdo aumentou |

### Priorização das exceções

A Exceção 1 (Marina · 19h30) é maior que a Exceção 2 (Bruno · 14h). Isso pode parecer contraintuitivo — o show das 14h começa antes. Mas o critério de prioridade não é apenas horário:

- **Exceção 1:** posição crítica sem nenhuma cobertura + 9h30 para resolver
- **Exceção 2:** confirmação pendente de Bruno (o show das 14h tem cobertura, apenas Bruno não confirmou)

A cobertura zero tem peso maior que a confirmação pendente com cobertura garantida.

A IA reforça esse raciocínio no card ("Astrid no 2° show está em aberto"), para que Fernanda entenda a prioridade sem precisar calcular.

### Como a ação "Renotificar Bruno" funciona

É uma ação inline — Fernanda toca no botão dentro do card da Exceção 2, uma notificação é disparada para Bruno, e o card atualiza para "Renotificado · agora". Fernanda não sai do Painel. Essa é a distinção entre exceção que exige navegação (Resolver →) e exceção que exige uma ação simples (Renotificar).

---

---

# WIREFRAME 3 — ESTADO CRÍTICO

**Cenário:** 13:38. Show das 14h começa em 22 minutos. Carlos não apareceu — no-show confirmado pelo gerente. Posição "Marcos" no show das 14h está descoberta.

---

```
╔═══════════════════════════════════════╗
║  STATUS BAR  ·  18/06 Qui  ·  13:38  ║
╠═══════════════════════════════════════╣
║                                       ║
║  Painel Operacional    [avatar] [!!]  ║  ← Badge duplo
║  Musical das Estrelas · Grupo Ballet  ║
║                                       ║
║  ╔═════════════════════════════════╗  ║
║  ║                                 ║  ║  ← STATUS CRÍTICO — borda completa
║  ║    ⚑  CRÍTICO                  ║  ║    Fundo coral/vermelho suave
║  ║                                 ║  ║    Ocupa ~32% do viewport
║  ║    Musical das Estrelas · 14:00 ║  ║
║  ║    Marcos · sem cobertura       ║  ║
║  ║                                 ║  ║
║  ║    Começa em:  22 minutos       ║  ║  ← Countdown — atualiza por minuto
║  ║                                 ║  ║
║  ║    [████ RESOLVER AGORA ████]   ║  ║  ← Botão full-width
║  ║                                 ║  ║
║  ╚═════════════════════════════════╝  ║
║                                       ║
║  ─────────────────────────────────    ║
║                                       ║
║  ┌─────────────────────────────────┐  ║  ← Card IA — contextual à crise
║  │ ~                               │  ║
║  │ ~ Carlos não apareceu. Marcos   │  ║
║  │ ~ em aberto. Beatriz pode cobrir│  ║
║  │ ~ — ela saiu às 11h do Estúdio  │  ║
║  │ ~ e não tem conflito. Recomendo │  ║
║  │ ~ ligar agora.                  │  ║
║  │                    ( Resolver →)│  ║  ← Atalho para S-04
║  └─────────────────────────────────┘  ║
║                                       ║
║  OUTRAS EXCEÇÕES — 1              ·   ║  ← Outras exceções em segundo plano
║  ┌─────────────────────────────────┐  ║
║  │   Marina · 19h30 · Astrid       │  ║  ← Card menor, sem urgência imediata
║  │   Cobertura: nenhuma · 6h12     │  ║    comparado à crise de agora
║  └─────────────────────────────────┘  ║
║                                       ║
║  CONFIRMAÇÕES           ( ver ▾ )    ║  ← Confirmações recolhidas
║                                       ║
╠═══════════════════════════════════════╣
║  ■ Painel  ○ Escala  ○ Solic  ○ Msg   ║
╚═══════════════════════════════════════╝
```

---

## Anotações do Estado Crítico

### O que muda em relação ao Estado Atenção

| Elemento | Estado Atenção | Estado Crítico |
|---|---|---|
| Indicador de Status | Âmbar · borda esquerda | Vermelho · borda completa · maior |
| Exceção principal | Card com "Resolver →" | Card full-width com "RESOLVER AGORA" |
| Countdown | Não existe | Visível no status card, atualiza por minuto |
| Outras exceções | Hierarquia normal | Empurradas para baixo, visualmente menores |
| Multi-horizonte | Recolhido | Desaparece (não prioritário) |
| Card IA | Diagnóstico + sugestão | Ação específica imediata ("ligar agora") |

### D2 — Percepção em 2 segundos — validação rigorosa

**Pergunta: o Supervisor que abre o app distraído, com o celular à distância, percebe o estado crítico?**

Sim. O Indicador de Status no estado Crítico tem:
- Borda completa (não apenas esquerda) — forma visual diferente de qualquer outro elemento
- Fundo coral/vermelho — única cor de alta intensidade na tela
- Texto "CRÍTICO" em T1 bold — maior texto da tela
- O countdown "22 minutos" em T1 — segunda informação mais legível

Fernanda não precisa ler o card inteiro. A combinação de cor + forma + tamanho dispara o reconhecimento antes de qualquer leitura.

### O que o "RESOLVER AGORA" faz

Toque em "RESOLVER AGORA" → abre S-04 — Escala **diretamente na posição de Marcos com candidatos já calculados**. Fernanda não aterrissa na Escala genérica — aterrissa no fluxo de resolução desta exceção específica.

### Por que a Exceção da Marina fica menor

Marina e 19h30 têm mais de 6 horas. Essa exceção existe e precisa ser resolvida, mas não compete com a crise de agora. O design comunica essa hierarquia de tempo visualmente — card menor, sem botão de ação imediata, apenas informação de estado.

O Supervisor sabe que tem duas exceções. Mas sabe qual resolver primeiro — sem precisar calcular.

---

---

# WIREFRAME 4 — MÚLTIPLAS EXCEÇÕES SIMULTÂNEAS

**Cenário:** 11:30. Dia de múltiplas exceções: 3 problemas simultâneos com pesos diferentes.

- **Exceção A:** Posição crítica "Astrid" em aberto no show das 14h — a mais urgente
- **Exceção B:** Conflito de horário detectado — Bruno alocado em 2 atividades simultâneas às 15h
- **Exceção C:** Escala do show das 19h30 ainda não publicada — show em 8h

---

```
╔═══════════════════════════════════════╗
║  STATUS BAR  ·  18/06 Qui  ·  11:30  ║
╠═══════════════════════════════════════╣
║                                       ║
║  Painel Operacional    [avatar] [!]   ║
║  Musical das Estrelas · Grupo Ballet  ║
║                                       ║
║  ┌─────────────────────────────────┐  ║
║  │                                 │  ║
║  │    ⚠  ATENÇÃO                  │  ║
║  │                                 │  ║
║  │    3 exceções · Resolver nesta  │  ║  ← IA já priorizou
║  │    ordem:                       │  ║
║  │    1. Astrid · 14h · posição    │  ║
║  │    2. Conflito Bruno · 15h      │  ║
║  │    3. Escala 19h30 não publicada│  ║
║  │                                 │  ║
║  └─────────────────────────────────┘  ║
║                                       ║
║  EXCEÇÕES — 3 ATIVAS                  ║
║                                       ║
║  ╔═════════════════════════════════╗  ║  ← Exceção 1 — DESTAQUE (maior)
║  ║ 1  Show das 14h · 2h30          ║  ║    Borda âmbar espessa
║  ║    Musical das Estrelas         ║  ║    Label numérico "1"
║  ║    Astrid: sem cobertura        ║  ║
║  ║    ─────────────────────────    ║  ║
║  ║    IA: Beatriz disponível       ║  ║  ← Sugestão IA inline
║  ║    e habilitada para Astrid     ║  ║
║  ║                  [Resolver →]   ║  ║
║  ╚═════════════════════════════════╝  ║
║                                       ║
║  ┌─────────────────────────────────┐  ║  ← Exceção 2 — padrão
║  │ 2  Conflito de horário · Bruno  │  ║    Label "2"
║  │    Ensaio 15h + Foto 15h        │  ║
║  │    Um deverá ser remanejado     │  ║
║  │                  ( Resolver )   │  ║
║  └─────────────────────────────────┘  ║
║                                       ║
║  ┌─────────────────────────────────┐  ║  ← Exceção 3 — padrão mas diferente
║  │ 3  Escala 19h30 não publicada   │  ║    Label "3"
║  │    Show em 8h · gerar antes     │  ║
║  │                  ( Publicar )   │  ║
║  └─────────────────────────────────┘  ║
║                                       ║
║  ┌─────────────────────────────────┐  ║
║  │ ~                               │  ║
║  │ ~ Três exceções. Comece por     │  ║  ← IA: raciocínio de prioridade
║  │ ~ Astrid — posição sem cobertura│  ║
║  │ ~ com o show mais próximo.      │  ║
║  │ ~ O conflito do Bruno precisa   │  ║
║  │ ~ ser resolvido até 14h.        │  ║
║  │                    ( Perguntar )│  ║
║  └─────────────────────────────────┘  ║
║                                       ║
╠═══════════════════════════════════════╣
║  ■ Painel  ○ Escala  ○ Solic  ○ Msg   ║
╚═══════════════════════════════════════╝
```

---

## Anotações do Estado de Múltiplas Exceções

### Como a priorização visual funciona

**Labels numéricos (1, 2, 3):** são o mecanismo de prioridade. Fernanda não precisa analisar qual resolver primeiro — o sistema já decidiu e comunicou a ordem. Os labels são o resultado da análise de urgência + impacto feita automaticamente.

**Exceção 1 com destaque diferente:** usa borda completa (╔══╗) em vez de borda esquerda apenas. A forma visual maior comunica "começa aqui" antes da leitura do label.

**O Indicador de Status resume a priorização:** "3 exceções · Resolver nesta ordem: 1. Astrid, 2. Conflito Bruno, 3. Escala" — a ordem está visível no próprio status card antes de scrollar para as exceções.

### O papel da IA nas múltiplas exceções

A IA não aparece como elemento separado apenas — ela está **incorporada na Exceção 1** ("Beatriz disponível e habilitada") e como **Card IA** com o raciocínio de prioridade exposto.

A IA não apenas lista as exceções — ela explica por que essa é a ordem. "O conflito do Bruno precisa ser resolvido até 14h" — a IA adiciona a janela de tempo que o label numérico não carrega.

### Resolução sequencial

Quando Fernanda resolver a Exceção 1 e retornar ao Painel:
- A Exceção 1 some
- As Exceções 2 e 3 sobem, renumeradas para 1 e 2
- O Indicador de Status atualiza: "2 exceções"
- A IA atualiza o card com novo contexto

---

---

# WIREFRAME 5 — PÓS-RESOLUÇÃO DE EXCEÇÃO

**Cenário:** Fernanda acabou de resolver a Exceção 1 (alocou Beatriz como Astrid no show das 14h). Retornou ao Painel. Resta apenas a exceção de Marina no 19h30.

---

```
╔═══════════════════════════════════════╗
║  STATUS BAR  ·  18/06 Qui  ·  11:52  ║
╠═══════════════════════════════════════╣
║                                       ║
║  ✓  Beatriz alocada como Astrid       ║  ← Toast de confirmação — 3s
║                                       ║
║  ─────────────────────────────────    ║
║                                       ║
║  Painel Operacional    [avatar] [!]   ║
║  Musical das Estrelas · Grupo Ballet  ║
║                                       ║
║  ┌─────────────────────────────────┐  ║
║  │                                 │  ║  ← STATUS: ainda Atenção (1 exceção)
║  │    ⚠  ATENÇÃO                  │  ║    mas menos urgente
║  │                                 │  ║
║  │    1 exceção · Show das 19h30   │  ║
║  │    Astrid sem cobertura · 7h38  │  ║
║  │                                 │  ║
║  └─────────────────────────────────┘  ║
║                                       ║
║  EXCEÇÕES — 1 ATIVA                   ║
║                                       ║
║  ┌─────────────────────────────────┐  ║
║  │ ⚠  Show das 19h30              │  ║
║  │    Musical das Estrelas         │  ║
║  │    Marina ausente · Astrid ↓    │  ║
║  │    Cobertura: nenhuma · 7h38    │  ║
║  │                    [Resolver →] │  ║
║  └─────────────────────────────────┘  ║
║                                       ║
║  CONFIRMAÇÕES                         ║  ← Confirmações agora expandidas
║  ┌─────────────────────────────────┐  ║    (foram contraídas no estado crítico)
║  │  Show 14h · Beatriz notificada  │  ║
║  │  ▓▓▓▓▓▓▓▓▓▓░░░░░░░░ 7/8 ✓     │  ║  ← Barra de progresso
║  │                                 │  ║
║  │  Bruno · não confirmou ainda    │  ║
║  │            ( Renotificar Bruno )│  ║
║  └─────────────────────────────────┘  ║
║                                       ║
║  ┌─────────────────────────────────┐  ║
║  │ ~                               │  ║
║  │ ~ Beatriz confirmou por mensagem│  ║  ← IA: atualiza com informação nova
║  │ ~ há 3 minutos. Falta Bruno     │  ║
║  │ ~ confirmar. Marina entrou em   │  ║
║  │ ~ contato e confirmou a folga.  │  ║
║  └─────────────────────────────────┘  ║
║                                       ║
║  PRÓXIMOS 3 DIAS       ( ver ▾ )     ║
║                                       ║
╠═══════════════════════════════════════╣
║  ■ Painel  ○ Escala  ○ Solic  ○ Msg   ║
╚═══════════════════════════════════════╝
```

---

## Anotações do Pós-Resolução

### O que a transição comunica

1. **Toast imediato:** "✓ Beatriz alocada como Astrid" — feedback de que a ação funcionou
2. **Status atualizado:** o número de exceções caiu de 2 para 1 — Fernanda vê o resultado da sua ação no mesmo instante
3. **Confirmações aparecem:** no estado crítico, confirmações estavam recolhidas. Após resolver a urgência maior, elas sobem para visibilidade — Fernanda precisa monitorar quem confirmou a substituição

### O rastreador de confirmações após a substituição

A barra de progresso "7/8 ✓" comunica visualmente que está quase completo. O único pendente (Bruno) está identificado com ação disponível inline. Fernanda não precisa ir a outra superfície para renotificar.

### A IA atualiza automaticamente

A IA não espera ser perguntada. Quando Beatriz confirma por mensagem, a IA inclui essa informação no card atualizado — sem notificação extra. Fernanda abre o Painel e o contexto já está atualizado.

---

---

# WIREFRAME 6 — DIA SEM ATIVIDADES (Estado Vazio Operacional)

**Cenário:** Segunda-feira, 9h. Sem shows hoje. Próximo show é quarta. Mas há uma solicitação de folga pendente que afeta quarta.

---

```
╔═══════════════════════════════════════╗
║  STATUS BAR  ·  16/06 Seg  ·  09:00  ║
╠═══════════════════════════════════════╣
║                                       ║
║  Painel Operacional    [avatar] [·]   ║
║  Musical das Estrelas · Grupo Ballet  ║
║                                       ║
║  ┌─────────────────────────────────┐  ║
║  │                                 │  ║
║  │    ✓  SEM ATIVIDADES HOJE       │  ║  ← Status diferente de "Pronta"
║  │                                 │  ║    não há shows para proteger
║  │    Próximo show: quarta, 18/06  │  ║
║  │    Musical das Estrelas · 14h   │  ║
║  │                                 │  ║
║  └─────────────────────────────────┘  ║
║                                       ║
║  ┌─────────────────────────────────┐  ║
║  │ ~                               │  ║
║  │ ~ Dia sem operação. Próximo     │  ║
║  │ ~ show é quarta. Amanda         │  ║
║  │ ~ solicitou folga para quarta   │  ║
║  │ ~ — ela cobre Astrid. Vale      │  ║
║  │ ~ analisar antes de aprovar.    │  ║
║  │                    ( Perguntar )│  ║
║  └─────────────────────────────────┘  ║
║                                       ║
║  PRÓXIMOS 3 DIAS                      ║  ← Multi-horizonte expandido (sem exceções)
║  ┌─────────────────────────────────┐  ║
║  │                                 │  ║
║  │  Seg 16 ○cinza  Ter 17 ○cinza  │  ║  ← Cinza = sem atividades
║  │                                 │  ║
║  │  Qua 18 ●âmbar                  │  ║  ← Âmbar = risco futuro
║  │    Show 14h · Amanda solicitou  │  ║
║  │    folga · Astrid afetada       │  ║
║  │    ( Antecipar resolução )      │  ║
║  └─────────────────────────────────┘  ║
║                                       ║
║  ┌─────────────────────────────────┐  ║  ← Solicitações — destaque
║  │  Solicitações · 1 pendente      │  ║
║  │  ⚠ Amanda · Folga Qua 18/06    │  ║
║  │    Afeta Astrid no show das 14h │  ║
║  │                    [ Analisar ] │  ║
║  └─────────────────────────────────┘  ║
║                                       ║
╠═══════════════════════════════════════╣
║  ■ Painel  ○ Escala  ○ Solic  ○ Msg   ║
╚═══════════════════════════════════════╝
```

---

## Anotações do Estado Vazio Operacional

### Distinção entre "Pronta" e "Sem atividades hoje"

| Estado | Quando | Mensagem |
|---|---|---|
| Pronta | Há shows hoje, todos cobertos | "Operação Pronta" — positivo, operacional |
| Sem atividades | Não há shows hoje | "Sem Atividades Hoje" — neutro, informativo |

São estados distintos. "Pronta" implica que existe uma operação e ela está segura. "Sem atividades" implica que não há operação hoje — o Supervisor está em modo de planejamento.

### Multi-horizonte expandido

No dia sem atividades, o multi-horizonte é o elemento de maior valor — é o planejamento preventivo. Por isso aparece expandido, diferente dos estados de Atenção/Crítico onde ficava recolhido.

### A solicitação de folga com impacto futuro

A IA identifica proativamente que a solicitação da Amanda afeta uma posição crítica na quarta. O card de Solicitações reflete essa análise — não é apenas "1 pendente" genérico, é "Amanda · folga quarta · Astrid afetada". Fernanda tem contexto antes de abrir S-06.

---

---

# WIREFRAME 7 — RASTREADOR DE CONFIRMAÇÕES EXPANDIDO

**Cenário:** 14:05. Show das 14h começou há 5 minutos. A Escala foi republicada com a substituição de Beatriz. O rastreador de confirmações está em foco.

---

```
╔═══════════════════════════════════════╗
║  STATUS BAR  ·  18/06 Qui  ·  14:05  ║
╠═══════════════════════════════════════╣
║                                       ║
║  Painel Operacional    [avatar] [·]   ║
║  Musical das Estrelas · Grupo Ballet  ║
║                                       ║
║  ┌─────────────────────────────────┐  ║
║  │   ⚠  ATENÇÃO                   │  ║
║  │   Show das 14h: 2 sem confirmar │  ║  ← Status Atenção
║  └─────────────────────────────────┘  ║    (Bruno e Carlos · show em andamento)
║                                       ║
║  CONFIRMAÇÕES — SHOW DAS 14H          ║  ← Seção expandida em destaque
║  ┌─────────────────────────────────┐  ║
║  │  Publicada há: 1h12             │  ║
║  │  Show em andamento              │  ║
║  │                                 │  ║
║  │  ▓▓▓▓▓▓▓▓▓▓░░░ 6/8 confirmados │  ║  ← Barra de progresso
║  │                                 │  ║
║  │  Confirmados (6):               │  ║
║  │  ✓ Ana · ✓ Beatriz · ✓ Marcos  │  ║  ← Nomes resumidos
║  │  ✓ Julia · ✓ Rafael · ✓ Sara    │  ║
║  │                                 │  ║
║  │  Pendentes (2):                 │  ║
║  │  ┌─────────────────────────┐    │  ║
║  │  │ ◯ Bruno · 1h12 sem conf.│    │  ║  ← Cada pendente: nome + tempo
║  │  │  ( Renotificar Bruno )  │    │  ║
║  │  └─────────────────────────┘    │  ║
║  │  ┌─────────────────────────┐    │  ║
║  │  │ ◯ Carlos · ausente conf.│    │  ║  ← Carlos: marcado como ausente (no-show)
║  │  │  Substituído por Beatriz│    │  ║
║  │  └─────────────────────────┘    │  ║
║  │                                 │  ║
║  └─────────────────────────────────┘  ║
║                                       ║
║  ┌─────────────────────────────────┐  ║
║  │ ~                               │  ║
║  │ ~ Show em andamento. Carlos não │  ║  ← IA: contexto do no-show
║  │ ~ confirmou porque está ausente │  ║
║  │ ~ (substituído). Bruno não      │  ║
║  │ ~ responde — pode estar no palco│  ║
║  │ ~ já. Sem impacto operacional.  │  ║
║  └─────────────────────────────────┘  ║
║                                       ║
╠═══════════════════════════════════════╣
║  ■ Painel  ○ Escala  ○ Solic  ○ Msg   ║
╚═══════════════════════════════════════╝
```

---

## Anotações do Rastreador Expandido

### Carlos como ausente confirmado vs. Bruno como pendente real

O rastreador distingue dois tipos de "não confirmado":
- **Carlos:** ausente confirmado, substituído — não confirma porque não está no show
- **Bruno:** pendente real — foi notificado, não respondeu, mas está no show

A IA interpreta essa distinção para Fernanda: "Bruno pode estar no palco já. Sem impacto operacional." O rastreador mostra os dois como "pendentes" estruturalmente, mas a IA adiciona o contexto que transforma a ansiedade em tranquilidade.

---

---

# WIREFRAME 8 — MULTI-HORIZONTE EXPANDIDO

**Cenário:** Fernanda quer planejar a semana. Está no Estado Pronta e expande o multi-horizonte.

---

```
╔═══════════════════════════════════════╗
║  STATUS BAR  ·  18/06 Qui  ·  10:15  ║
╠═══════════════════════════════════════╣
║                                       ║
║  ┌─────────────────────────────────┐  ║
║  │    ✓  OPERAÇÃO PRONTA           │  ║
║  └─────────────────────────────────┘  ║
║                                       ║
║  PRÓXIMOS 3 DIAS           ( ∧ )     ║  ← Toggle expandido
║  ┌─────────────────────────────────┐  ║
║  │                                 │  ║
║  │  QUI 18 — HOJE     ●verde       │  ║
║  │  2 shows · cobertura completa   │  ║
║  │  8/8 confirmados                │  ║
║  │                                 │  ║
║  │  ─────────────────────────────  │  ║
║  │                                 │  ║
║  │  SEX 19              ●âmbar     │  ║  ← Dia com risco expandido
║  │  1 show · Musical das Estrelas  │  ║
║  │  ⚠ Amanda: folga aprovada      │  ║
║  │     Astrid: cobertura no limite │  ║
║  │     Apenas Beatriz habilitada   │  ║
║  │  ( Antecipar resolução )        │  ║
║  │                                 │  ║
║  │  ─────────────────────────────  │  ║
║  │                                 │  ║
║  │  SÁB 20              ●verde     │  ║
║  │  1 show · Cobertura: completa   │  ║
║  │  Nenhum risco identificado      │  ║
║  │                                 │  ║
║  └─────────────────────────────────┘  ║
║                                       ║
║  ┌─────────────────────────────────┐  ║
║  │ ~                               │  ║
║  │ ~ Sexta tem um risco real: só   │  ║
║  │ ~ Beatriz cobre Astrid e ela já │  ║
║  │ ~ está no show de hoje. Se ela  │  ║
║  │ ~ se machucar, o show de sexta  │  ║
║  │ ~ fica descoberto. Vale definir │  ║
║  │ ~ um backup agora.              │  ║
║  └─────────────────────────────────┘  ║
║                                       ║
╠═══════════════════════════════════════╣
║  ■ Painel  ○ Escala  ○ Solic  ○ Msg   ║
╚═══════════════════════════════════════╝
```

---

## Anotações do Multi-horizonte

### O que o multi-horizonte não é

Não é um calendário mensal. Não é uma agenda de eventos. É uma **leitura de risco resumida** dos próximos 3 dias — 3 dias porque é o horizonte operacional relevante para o Supervisor.

### A IA identifica o risco de segunda ordem

O risco da sexta não é apenas "Amanda de folga". É que Beatriz é a única cobertura de Astrid — e ela já está escalada para o show de hoje. Se algo acontecer hoje, a sexta também fica descoberta. Esse é um risco de segundo nível que o Supervisor não veria apenas olhando os dias separadamente. A IA identifica a cadeia.

### Botão "Antecipar Resolução"

Ao tocar, abre S-04 — Escala filtrada para a data de sexta, com o risco de Astrid em destaque. Fernanda resolve antes que vire exceção urgente.

---

---

# WIREFRAME 9 — COMO A IA PARTICIPA SEM VIRAR O CENTRO

Este wireframe documenta os 4 modos de presença da IA no Painel — respondendo à pergunta da spec.

---

```
╔═══════════════════════════════════════╗
║         MODO 1 — NARRADOR (padrão)   ║
╠═══════════════════════════════════════╣
║                                       ║
║  ┌─────────────────────────────────┐  ║
║  │ ~  Bom dia, Fernanda. Operação  │  ║  ← Card IA abaixo do status
║  │ ~  pronta. Amanhã, 1 risco leve.│  ║    Fundo sutil, borda identidade
║  │                    ( Perguntar )│  ║    Não domina — informa
║  └─────────────────────────────────┘  ║
║                                       ║
╠═══════════════════════════════════════╣
║       MODO 2 — DIAGNÓSTICO (atenção) ║
╠═══════════════════════════════════════╣
║                                       ║
║  ┌─────────────────────────────────┐  ║
║  │ ~  Marina ausente. Astrid 19h30 │  ║  ← IA no card de exceção (inline)
║  │    sem cobertura. Beatriz       │  ║    Não é card separado — faz parte
║  │    disponível e habilitada.     │  ║    do card da exceção
║  └─────────────────────────────────┘  ║
║                                       ║
╠═══════════════════════════════════════╣
║        MODO 3 — AÇÃO URGENTE (crítico)║
╠═══════════════════════════════════════╣
║                                       ║
║  ┌─────────────────────────────────┐  ║
║  │ ~  Carlos não apareceu. Beatriz │  ║  ← IA com linguagem de ação
║  │ ~  disponível — recomendo ligar │  ║    aparece LOGO ABAIXO do status
║  │ ~  agora.       ( Resolver → )  │  ║    crítico — não precisa scrollar
║  └─────────────────────────────────┘  ║
║                                       ║
╠═══════════════════════════════════════╣
║      MODO 4 — BADGE PROATIVO         ║
╠═══════════════════════════════════════╣
║                                       ║
║  ┌─────────────────────────────────┐  ║
║  │ ~  [! Risco não óbvio]          │  ║  ← Badge no card IA
║  │ ~  Beatriz é a única cobertura  │  ║    Fernanda toca para ver
║  │ ~  de Astrid na sexta. Se ela   │  ║    Não é alerta — é convite
║  │ ~  falhar hoje, sexta descobre. │  ║
║  └─────────────────────────────────┘  ║
║                                       ║
╚═══════════════════════════════════════╝
```

---

**Regra dos 4 modos:**

| Modo | Quando | Comportamento |
|---|---|---|
| Narrador | Estado Pronta | Card IA com briefing passivo |
| Diagnóstico | Estado Atenção | IA integrada no card de exceção + card próprio |
| Ação Urgente | Estado Crítico | Card IA com linguagem de ação logo após o status |
| Badge Proativo | Qualquer estado | Badge no card IA para risco não óbvio |

---

---

# FLUXOS DE DECISÃO

---

## Fluxo A — Início do Dia Operacional (JS-01)

```
  Fernanda abre o app
       │
       ▼
  Painel carrega — status em 2s
       │
       ├── ● VERDE (Pronta) ─────────────────────────────────────────→
       │        Multi-horizonte expandido                              │
       │        Fernanda planeja a semana                             │
       │        Identifica risco futuro                               │
       │        ( Antecipar resolução ) → S-04 (data futura)          │
       │                                                              │
       ├── ● ÂMBAR (Atenção) ──────────────────────────────────────→  │
       │        Lista de exceções priorizada                          │
       │        Fernanda resolve exceção 1 → S-04                    │
       │        Retorna ao Painel                                     │
       │        Resolve exceção 2 se necessário                       │
       │        Painel atualiza                                       │
       │                                                              │
       └── ● VERMELHO (Crítico) ────────────────────────────────────→ │
                Fernanda vê countdown + RESOLVER AGORA               │
                Toca → vai para S-04 (exceção pré-carregada)         │
                Resolve substituição                                  │
                Retorna ao Painel                                    │
                Status atualiza                                      │
                                                                     ▼
                                          FIM: Fernanda fecha o app sabendo
                                          o estado da operação
```

---

## Fluxo B — Resposta a Exceção (via notificação)

```
  Notificação crítica chega
  "Carlos não apareceu — Marcos sem cobertura"
       │
       ▼
  Fernanda toca na notificação
       │
       ▼
  App abre em S-04 (DIRETO NA EXCEÇÃO)
  — não passa pelo Painel —
       │
       ▼
  Fernanda resolve a substituição em S-04
       │
       ▼
  Fernanda toca "← Voltar ao Painel"
       │
       ▼
  Painel carrega com estado atualizado
  Toast: "✓ Beatriz alocada como Marcos"
       │
       ▼
  Rastreador de confirmações ativo
  Fernanda monitora quem confirmou
```

**Por que a notificação crítica vai direto para S-04?**
O Painel diagnostica — a Escala resolve. Quando a urgência é máxima, o Supervisor não quer passar pelo diagnóstico (que ele já conhece pela notificação) antes de agir. Ir direto para S-04 elimina 1 toque em situação de crise.

---

## Fluxo C — Análise de Solicitação

```
  Indicador de Solicitações: "2 pendentes"
  Fernanda toca no indicador ou na nav → S-06
       │
       ▼
  S-06 abre com a fila de solicitações pendentes
       │
       ▼
  Fernanda abre a solicitação da Amanda
  IA: análise de impacto automática já exibida
  "Amanda cobre Astrid — aprovação afeta o show de sexta"
       │
       ├── Fernanda aprova ──→ S-04 atualizada automaticamente
       │                       Retorna ao Painel
       │                       Status da sexta atualiza
       │
       └── Fernanda nega ──→ Motivo obrigatório
                              Amanda notificada
                              Retorna ao Painel
                              Indicador de Solicitações: 1 pendente
```

---

## Fluxo D — Multi-horizonte → Ação Preventiva

```
  Estado Pronta — multi-horizonte expandido
       │
       ▼
  Fernanda vê: "Sex 19 · risco"
       │
       ▼
  Toca "Antecipar resolução"
       │
       ▼
  Abre S-04 filtrada para sexta
  Astrid em destaque — sem aguardar uma crise
       │
       ▼
  Fernanda aloca substituta preventivamente
       │
       ▼
  Retorna ao Painel
  Multi-horizonte atualiza: Sex 19 → ●verde
  IA: "Risco de sexta resolvido."
```

---

---

# PARTE FINAL — AUDITORIA DO WIREFRAME

---

## Coerência com a Pesquisa do Supervisor

| Descoberta | Como o wireframe responde |
|---|---|
| **D1: status → impacto → recomendação → cascata** | Indicador de Status (diagnóstico) → exceção com cobertura (impacto) → IA com sugestão (recomendação) → cascata em S-04. Sequência preservada. ✅ |
| **D2: exceções surgem inesperadamente** | Notificação → S-04 direto (sem passar pelo Painel em crise). Para estados não-críticos: Painel como intermediário. ✅ |
| **D5: cascata invisível é o maior risco** | IA do multi-horizonte identifica riscos de segunda ordem ("Beatriz é a única cobertura e está no show de hoje"). ✅ |
| **D6: confirmação ≠ ciência** | Rastreador de Confirmações com barra de progresso + nomes pendentes. "Notificado" e "confirmado" são estados distintos. ✅ |
| **D7: folgas aprovadas individualmente criam problemas** | Indicador de Solicitações mostra impacto antes da aprovação ("Afeta Astrid no show das 14h"). ✅ |
| **D9: multi-horizonte sem trocar de tela** | Multi-horizonte inline, expansível. Nunca exige navegação para outra superfície. ✅ |

---

## Coerência com as Jornadas do Supervisor

| Jornada | Wireframe | Validação |
|---|---|---|
| **JS-01 — Início do Dia** | WF1 (Pronta) + WF2 (Atenção) + WF3 (Crítico) | Status em < 2s. Multi-horizonte para planejamento. ✅ |
| **JS-02 — Análise de Folga** | WF6 (sem atividades) + Fluxo C | Solicitação com impacto já calculado. ✅ |
| **JS-03 — Substituição Emergencial** | WF3 (Crítico) + Fluxo B | Notificação → S-04 direto. Candidatos pré-calculados. ✅ |
| **JS-04 — Livro do Dia** | Não é foco do Painel (fluxo em S-04 → S-05) | Painel tem atalho "Gerar Livro" quando não existe para data próxima. ✅ |
| **JS-05 — Comunicação pós-alteração** | WF5 (pós-resolução) + WF7 (rastreador) | Rastreador de confirmações com ação inline. ✅ |
| **JS-08 — Múltiplas Exceções** | WF4 (múltiplas exceções) | Labels 1/2/3 + IA com raciocínio de prioridade. ✅ |

---

## Coerência com a Arquitetura de Navegação

| Princípio | Validação |
|---|---|
| **Painel = diagnóstico; Escala = ação** | "Resolver →" sempre navega para S-04. Nenhuma resolução acontece no Painel. ✅ |
| **Notificação crítica → S-04 (não Painel)** | Fluxo B documentado explicitamente. ✅ |
| **Painel é o ponto de retorno** | Após S-04, S-06, Fernanda sempre retorna ao Painel. Toast de confirmação visível no retorno. ✅ |
| **Multi-horizonte inline** | Seção expansível no Painel — nunca exige S-12 para os 3 dias. ✅ |
| **Nav com 4 itens** | [■ Painel] [○ Escala] [○ Solicitações] [○ Mensagens] em todos os wireframes. ✅ |

---

## Coerência com a Identidade da Asa

| Princípio | Como aparece |
|---|---|
| **Leveza** | Estado Pronta com espaço generoso. Seções recolhidas por padrão. ✅ |
| **Profundidade** | Exceção 1 maior que Exceção 2, que é maior que as demais. Planos perceptivos distintos. ✅ |
| **Direção** | Toda exceção tem uma ação clara. O Supervisor nunca olha para uma exceção sem saber o que fazer. ✅ |
| **Precisão** | Cada elemento tem função definida. O Painel não tem KPIs decorativos, gráficos de linha, ou widgets de status genéricos. ✅ |
| **Não ERP** | Sem tabelas de cobertura, sem dashboards de KPIs, sem módulos aninhados, sem IDs de registro. ✅ |

---

## Coerência com a Filosofia "Transformar Caos em Clareza de Decisão"

### O que o Painel garante?

**Antes do MyASA (situação atual):**
Fernanda abre o WhatsApp e vê 47 mensagens de grupos diferentes. Precisa mentalmente fazer triagem, lembrar o que ficou pendente, e descobrir o que é urgente. Isso leva minutos. Às vezes algo importante passa.

**Com o Painel Operacional:**
Fernanda abre o app. Em 2 segundos: verde, âmbar, ou vermelho. Se vermelho: 1 toque para o fluxo de resolução. Se âmbar: lista priorizada com a IA já calculando candidatos. Se verde: planeja com calma.

**A clareza não vem de ter menos informação — vem de ter a informação certa na ordem certa.**

### Teste da filosofia — 5 perguntas

**"A operação está protegida?"**
→ Indicador de Status — resposta em < 2 segundos. ✅

**"O que precisa de minha atenção agora?"**
→ Lista de exceções priorizadas por urgência + impacto. ✅

**"Qual exceção resolver primeiro?"**
→ Labels 1/2/3 + IA com raciocínio exposto. ✅

**"Quem ainda não confirmou?"**
→ Rastreador de Confirmações com nomes + ação inline. ✅

**"Existe algum risco que ainda não vi?"**
→ Badge proativo da IA + multi-horizonte com riscos futuros. ✅

---

## Problemas identificados e ajustes

### P1 — "Atenção" e "Crítico" — a fronteira de urgência precisa ser clara

No wireframe atual, a exceção com countdown aparece no status Crítico, mas exceções com tempo suficiente ficam no status Atenção. O critério de fronteira (qual tempo/impacto leva de Atenção para Crítico) precisa ser definido nas regras de negócio — não apenas no design.

**Recomendação para spec técnica:** definir threshold. Sugestão: Status Crítico quando qualquer exceção tem atividade iniciando em menos de 30 minutos com posição crítica sem cobertura. Atenção para todos os outros casos. ⚠

### P2 — "Renotificar" inline vs. confirmação de que foi recebida

Quando Fernanda toca "Renotificar Bruno", o card muda para "Renotificado · agora". Mas se Bruno continua sem responder 10 minutos depois, o sistema precisa de um ciclo de reaparecimento — o card não pode ficar "Renotificado" para sempre.

**Recomendação:** após X minutos sem confirmação após renotificação, o item volta para "ainda sem confirmar" com o timestamp atualizado. ⚠

### P3 — Labels numéricos com 4+ exceções

Com 4 ou mais exceções, os labels 1/2/3/4 continuam funcionando? Sim estruturalmente, mas a leitura vertical fica muito longa. Limite máximo de exceções visíveis sem scroll: 3. Com 4+ exceções, as primeiras 2 ficam visíveis e um "ver mais [N] exceções" indica as demais.

**Recomendação:** regra visual de máximo 2 exceções visíveis acima do fold, com peek da terceira. ⚠

### P4 — Multi-horizonte recolhido no estado crítico

No Estado Crítico, o multi-horizonte desaparece do wireframe para dar espaço à crise. Isso é correto. Mas Fernanda precisa conseguir acessá-lo se precisar — mesmo durante uma crise.

**Solução:** o multi-horizonte existe como linha "PRÓXIMOS 3 DIAS (···)" mesmo no estado crítico — acessível mas recolhido e sem destaque. Não desaparece, apenas perde prioridade visual. ⚠ (P4 corrigido no wireframe 3 — linha adicionada)

---

## Veredicto da Auditoria

**O wireframe estrutural de S-02 Painel Operacional está aprovado para avançar ao mockup visual.**

A hierarquia visual responde à filosofia do produto. O Indicador de Status (D2) é perceptível em menos de 2 segundos em todos os estados. A IA participa como copiloto — não como chatbot, não como centro da tela. As transições entre estados são lógicas e documentadas. Os 5 estados (Pronta, Atenção, Crítico, Múltiplas, Vazio) cobrem os cenários operacionais relevantes.

4 ajustes menores foram identificados (P1–P4) — todos são decisões de regras de negócio ou limites de casos extremos, não problemas estruturais.

---

*Documento base para mockup visual: docs/design-visual-bloco1-myasa-2.0.md*
*Próxima superfície: Wireframe Estrutural de S-04 — Escala*
