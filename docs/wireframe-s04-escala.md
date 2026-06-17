# MyASA 2.0 — Wireframe Estrutural — S-04 Escala

> Versão: 17/06/2026
> Fase: Wireframe Estrutural — anterior a mockup visual
> Superfície: S-04 Escala (Supervisor / Admin)
> Autoria: Senior Product Designer
> Status: Validação estrutural — pronta para revisão antes do mockup

---

## Premissa do Wireframe

A Escala é a fonte de verdade operacional do MyASA. É onde as decisões são tomadas — e onde o erro custa mais caro.

O design desta superfície precisa resolver uma tensão central:

> **Construção metódica e resposta urgente no mesmo espaço.**

Um Supervisor que está montando a Escala com 3 dias de antecedência precisa de uma ferramenta sistemática. O mesmo Supervisor que chega via notificação crítica com 20 minutos para resolver um no-show precisa da mesma superfície funcionando em modo de urgência — sem mudar de tela, sem reaprender a interface.

A distinção entre os dois modos é **contextual, não estrutural.** A arquitetura da Escala é a mesma. O que muda é o que aparece em destaque.

**Convenções:**
```
╔══╗  = elemento dominante (exceção pré-carregada)
┌──┐  = card padrão
│  │  = conteúdo interno
[ AÇÃO ]     = botão primário
( ação )     = botão secundário
[ ████████ ] = botão de largura total
── = Posição coberta (slot visual com membro)
~~ = Posição em risco
□□ = Posição em aberto (slot vazio)
~ ~ = elemento da IA
▓▓  = barra de progresso preenchida
░░  = barra de progresso vazia
■ ■ = nav bar
```

**Viewport de referência:** iPhone 14 Pro (390 × 844px)
**Perfil:** Fernanda — Supervisora do Grupo Ballet / Musical das Estrelas

---

---

# WIREFRAME 1 — MODO CONSTRUÇÃO

**Cenário:** Sexta-feira, 09:30. Fernanda está construindo a Escala do show de amanhã (Musical das Estrelas · 15h · Sábado 20/06). A maioria das posições está coberta, exceto Astrid — Amanda tem folga aprovada. Fernanda está alocando preventivamente.

---

```
╔═══════════════════════════════════════╗
║  STATUS BAR  ·  19/06 Sex  ·  09:30  ║
╠═══════════════════════════════════════╣
║                                       ║
║  ← Painel       Escala   [avatar]    ║  ← Retorno ao Painel sempre visível
║  Musical das Estrelas · Grupo Ballet  ║
║                                       ║
║  ─────────────────────────────────    ║
║                                       ║
║  Sáb 20 │ Dom 21 │ Seg 22 │ Ter 23 ·  ║  ← Strip de datas (rolável)
║  ──↑──   │        │        │           ║    Sáb 20 selecionado (sublinhado)
║  Show ★  │        │        │           ║    Ícone ★ = show nesta data
║                                       ║
║  ─────────────────────────────────    ║
║                                       ║
║  ┌─────────────────────────────────┐  ║
║  │  SÁB 20/06 · RESUMO            │  ║  ← Resumo de cobertura da data
║  │                                 │  ║
║  │  ██████████████████░░ 5/6       │  ║  ← Barra de progresso
║  │  5 cobertas · 0 em risco · 1 ↓  │  ║
║  │                                 │  ║
║  │  Status: Rascunho (não publicado)│  ║
║  └─────────────────────────────────┘  ║
║                                       ║
║  ATIVIDADES — SÁB 20/06               ║
║                                       ║
║  ┌─────────────────────────────────┐  ║  ← Atividade 1 — Expandida
║  │ Musical das Estrelas  ★  15:00  │  ║    Borda esquerda vermelha (1 aberta)
║  │ até 18:30 · Teatro Principal    │  ║
║  │ ─────────────────────────────   │  ║
║  │ Posições: 5 cobertas · 1 aberta │  ║
║  │                                 │  ║
║  │  ── Amanda      Astrid     ✕    │  ║  ← Slot vazio (folga aprovada)
║  │     Folga aprovada · 20/06      │  ║    ✕ = posição em aberto
║  │     [ + Alocar substituta ]     │  ║    Ação inline direta
║  │                                 │  ║
║  │  ── Bruno       Marcos     ✓    │  ║  ← Slot coberto
║  │  ── Carol       Elena      ✓    │  ║
║  │  ── Diego       Figurante A ✓   │  ║
║  │  ── Sara        Figurante B ✓   │  ║
║  │  ── Rafael      Regência   ✓    │  ║
║  │                                 │  ║
║  └─────────────────────────────────┘  ║
║                                       ║
║  ┌─────────────────────────────────┐  ║  ← Atividade 2 — Fechada (sem problemas)
║  │ Ensaio Técnico   09:00 — 11:30  │  ║
║  │ Estúdio B · 6/6 cobertas    ✓  ( ∨ )║
║  └─────────────────────────────────┘  ║
║                                       ║
╠═══════════════════════════════════════╣
║  ┌─────────────────────────────────┐  ║  ← PAINEL DE VALIDAÇÃO — fixo
║  │ 1 posição em aberto             │  ║    Always visible
║  │ Astrid · Musical das Estrelas   │  ║
║  │              [ Publicar (!) ]   │  ║  ← Publicar com alerta (não bloqueado)
║  └─────────────────────────────────┘  ║
╠═══════════════════════════════════════╣
║  ○ Painel  ■ Escala  ○ Solic  ○ Msg   ║
╚═══════════════════════════════════════╝
```

---

## Anotações do Modo Construção

### Como Fernanda entende a situação em menos de 10 segundos

1. Strip de datas: está na data correta (Sáb 20)
2. Resumo de cobertura: "5/6 · 1 aberta" — sabe exatamente quantas posições faltam
3. Barra de progresso: visualmente 83% completo — falta pouco
4. Card da atividade com borda vermelha: qual atividade tem problema
5. Slot com "✕" e "Folga aprovada": quem, qual posição, por quê

**Total: < 10 segundos para ter o diagnóstico completo da data.**

### Anatomia do slot de posição

```
  ── [nome do membro]  [papel]  [status]
  └── linha do slot — formato de "trilho"
```

Cada slot é uma linha horizontal com 3 elementos: membro, papel, status. O status é o elemento mais à direita e o mais escaneável — Fernanda pode ler os status (✓, ✕, ⚠) verticalmente sem ler os nomes.

### Por que a atividade sem problema está fechada

O card "Ensaio Técnico" está recolhido porque não tem problemas. Fernanda não precisa ver detalhes do que está OK. Expande se precisar.

### O Painel de Validação

Sempre visível, sempre atualizado. Fernanda sabe o estado de publicação sem calcular. O botão "Publicar (!)" tem o "!" porque há 1 posição em aberto — mas está disponível, não bloqueado.

---

---

# WIREFRAME 2 — MODO CONSTRUÇÃO COM ALERTAS

**Cenário:** Mesmo dia, mesma data (Sáb 20). Fernanda resolve mais alertas: Bruno tem uma restrição ativa (lesão lombar — sem saltos), e Elena está alocada em dois lugares sobrepostos (Ensaio das 09h vai até 11:30; ela é regência também no Workshop das 11h).

---

```
╔═══════════════════════════════════════╗
║  STATUS BAR  ·  19/06 Sex  ·  09:45  ║
╠═══════════════════════════════════════╣
║                                       ║
║  ← Painel       Escala   [avatar]    ║
║  Musical das Estrelas · Grupo Ballet  ║
║                                       ║
║  Sáb 20 │ Dom 21 │ Seg 22 │ ···      ║
║  ──↑──   ●âmbar   │        │           ║  ← Dom 21 com risco futuro (IA detectou)
║  Show ★  Show ★   │        │           ║
║                                       ║
║  ┌─────────────────────────────────┐  ║
║  │  SÁB 20/06 · RESUMO            │  ║
║  │                                 │  ║
║  │  ████████████░░░░░░░░ 3/6       │  ║  ← 3 cobertas, 2 em risco, 1 aberta
║  │  3 cobertas · 2 em risco · 1 ↓  │  ║
║  │                                 │  ║
║  │  Status: Rascunho                │  ║
║  └─────────────────────────────────┘  ║
║                                       ║
║  ATIVIDADES — SÁB 20/06               ║
║                                       ║
║  ┌─────────────────────────────────┐  ║  ← Atividade com múltiplos alertas
║  │ Musical das Estrelas  ★  15:00  │  ║    Borda vermelha (posição aberta)
║  │ ─────────────────────────────   │  ║
║  │                                 │  ║
║  │  ✕  Amanda      Astrid          │  ║  ← Aberta
║  │     Folga aprovada              │  ║
║  │     [ + Alocar substituta ]     │  ║
║  │                                 │  ║
║  │  ⚠  Bruno       Marcos          │  ║  ← Em risco — restrição ativa
║  │     Restrição: sem saltos       │  ║
║  │     Marcos inclui sequência A5  │  ║
║  │     ( Ver impacto )             │  ║  ← Expande para detalhes
║  │                                 │  ║
║  │  ── Carol       Elena      ✓    │  ║
║  │  ── Diego       Figurante A ✓   │  ║
║  │  ── Sara        Figurante B ✓   │  ║
║  │  ── Rafael      Regência   ✓    │  ║
║  │                                 │  ║
║  └─────────────────────────────────┘  ║
║                                       ║
║  ┌─────────────────────────────────┐  ║  ← Segunda atividade — com conflito
║  │ Workshop de Repertório  ★ 11:00  │  ║    Borda âmbar (risco, não aberta)
║  │ até 12:30 · Estúdio A           │  ║
║  │ ─────────────────────────────   │  ║
║  │                                 │  ║
║  │  ⚠  Elena      Regência         │  ║  ← Conflito de horário
║  │     ↕ Conflito: Ensaio 09h      │  ║
║  │     até 11:30 / Workshop 11:00  │  ║
║  │     Sobreposição: 30 minutos    │  ║
║  │     ( Resolver conflito )       │  ║
║  │                                 │  ║
║  │  ── Marco       Figurante  ✓    │  ║
║  │  ── Silvia      Figurante  ✓    │  ║
║  │                                 │  ║
║  └─────────────────────────────────┘  ║
║                                       ║
║  ┌─────────────────────────────────┐  ║
║  │ ~                               │  ║  ← Card IA
║  │ ~ Três itens para resolver:     │  ║
║  │ ~ 1. Astrid em aberto (crítico) │  ║
║  │ ~ 2. Conflito de Elena (resolva │  ║
║  │ ~    antes das 11h)             │  ║
║  │ ~ 3. Bruno: sequência A5 é 2   │  ║
║  │ ~    minutos do show — risco    │  ║
║  │ ~    baixo se ele aqueceu hoje. │  ║
║  │                    ( Perguntar )│  ║
║  └─────────────────────────────────┘  ║
║                                       ║
╠═══════════════════════════════════════╣
║  ┌─────────────────────────────────┐  ║
║  │ 1 aberta · 2 em risco · 1 conf. │  ║  ← Painel de validação detalhado
║  │              [ Publicar (!!!) ] │  ║  ← 3 alertas no botão
║  └─────────────────────────────────┘  ║
╠═══════════════════════════════════════╣
║  ○ Painel  ■ Escala  ○ Solic  ○ Msg   ║
╚═══════════════════════════════════════╝
```

---

## Anotações do Modo Construção com Alertas

### Os 3 tipos de alerta e seus visuais

| Tipo | Ícone | Borda do card | Ação disponível |
|---|---|---|---|
| Posição em aberto | ✕ | Vermelha | "Alocar substituta" — abre candidatos |
| Posição em risco (restrição) | ⚠ | Âmbar (na posição) | "Ver impacto" — expande detalhe |
| Conflito de horário | ⚠ + ↕ | Âmbar (no card de atividade) | "Resolver conflito" — abre candidatos |

### A IA como triador de alertas

No modo com múltiplos alertas, a IA faz o trabalho de triagem que o Supervisor teria que fazer mentalmente: "Três itens para resolver, nesta ordem, com este contexto". Fernanda não precisa calcular qual é mais urgente — a IA já ordenou e explicou brevemente.

Nota crítica na IA sobre Bruno: "risco baixo se ele aqueceu hoje" — a IA não é categórica, contextualiza. Isso é diferente de um sistema que simplesmente marca "RISCO" sem qualificação.

### Painel de Validação com múltiplos alertas

O botão "Publicar (!!!)" tem 3 pontos de exclamação correspondendo a 3 alertas. É um sistema de intensidade progressiva — não apenas "tem problema", mas "tem N problemas". No wireframe final/visual, isso será representado visualmente (não literalmente com "!!!"), mas a lógica progressiva se mantém.

---

---

# WIREFRAME 3 — MODO EXCEÇÃO

**Cenário:** 13:42. Fernanda recebe notificação crítica: Carlos não apareceu para o show das 14h. Ela toca na notificação e chega à Escala **diretamente na exceção pré-carregada**. O sistema já calculou os candidatos.

---

```
╔═══════════════════════════════════════╗
║  STATUS BAR  ·  18/06 Qui  ·  13:42  ║
╠═══════════════════════════════════════╣
║                                       ║
║  ← Painel       Escala   [avatar]    ║
║  Musical das Estrelas · Grupo Ballet  ║
║                                       ║
║  ╔═════════════════════════════════╗  ║
║  ║                                 ║  ║  ← EXCEÇÃO PRÉ-CARREGADA (dominante)
║  ║  ⚑  EXCEÇÃO — AÇÃO NECESSÁRIA  ║  ║    Borda completa
║  ║                                 ║  ║    Ocupa ~35% do viewport
║  ║  Musical das Estrelas · 14:00   ║  ║
║  ║  Marcos · Carlos ausente        ║  ║
║  ║                                 ║  ║
║  ║  Começa em:  18 minutos         ║  ║  ← Countdown
║  ║                                 ║  ║
║  ║  ─────────────────────────────  ║  ║
║  ║                                 ║  ║
║  ║  ~ IA: Beatriz disponível e     ║  ║  ← IA já calculou — inline no card
║  ║  ~   habilitada. Recomendo ela  ║  ║    D5: candidatos pré-calculados
║  ║  ~   como primeira opção.       ║  ║
║  ║                                 ║  ║
║  ╚═════════════════════════════════╝  ║
║                                       ║
║  CANDIDATOS — MARCOS             3    ║  ← Título + número de candidatos
║                                       ║
║  ╔═════════════════════════════════╗  ║  ← Candidato 1 — DESTAQUE MÁXIMO
║  ║  ✓ RECOMENDADA                  ║  ║    D3: maior, borda verde completa
║  ║                                 ║  ║
║  ║  Beatriz                        ║  ║  ← T1 bold — nome
║  ║                                 ║  ║
║  ║  ~ Substituta habitual de Marcos ║  ║  ← Rationale da IA (italic)
║  ║  ~ Disponível agora             ║  ║
║  ║  ~ Sem restrições · Sem conflito║  ║
║  ║                                 ║  ║
║  ║  [ Selecionar Beatriz ]         ║  ║  ← Botão primário
║  ╚═════════════════════════════════╝  ║
║                                       ║
║  ┌─────────────────────────────────┐  ║  ← Candidato 2 — padrão
║  │  ⚠ Risco moderado              │  ║    Tag âmbar
║  │                                 │  ║
║  │  Clara                          │  ║
║  │                                 │  ║
║  │  ~ Já fez Marcos como titular   │  ║
║  │  ~ mas há 3 meses. Disponível.  │  ║
║  │                                 │  ║
║  │  ( Selecionar Clara )           │  ║  ← Botão secundário
║  └─────────────────────────────────┘  ║
║                                       ║
║  ┌─────────────────────────────────┐  ║  ← Candidato 3 — menor relevância
║  │  ✕ Risco alto                  │  ║    Tag vermelha
║  │  Diana — nunca fez Marcos       │  ║
║  │  como titular                   │  ║
║  │                 ( Ver mesmo so  │  ║  ← Ação terciária
║  └─────────────────────────────────┘  ║
║                                       ║
╠═══════════════════════════════════════╣
║  ┌─────────────────────────────────┐  ║  ← Painel de validação — simplificado
║  │ Exceção ativa · Resolução pend. │  ║    em modo exceção
║  └─────────────────────────────────┘  ║
╠═══════════════════════════════════════╣
║  ○ Painel  ■ Escala  ○ Solic  ○ Msg   ║
╚═══════════════════════════════════════╝
```

---

## Anotações do Modo Exceção

### D5 — IA pronta ao chegar pela notificação

Fernanda toca na notificação e aterrissa aqui. Os candidatos **já estão calculados**. Não há loading state, não há "Calculando disponibilidade...". O sistema calculou em background no momento em que Carlos foi marcado como ausente.

**O que aparece imediatamente:**
- A exceção pré-carregada com contexto completo (atividade, posição, countdown)
- A recomendação da IA já dentro do card de exceção
- Os candidatos em hierarquia visual

Fernanda não precisou ir ao Painel → decidir agir → abrir a Escala → navegar para o dia certo → encontrar a posição → buscar candidatos. Tudo isso foi eliminado. Ela aterrissou direto na decisão.

### D3 — Hierarquia visual de candidatos

**3 níveis visuais distintos:**

| Candidato | Borda | Tag | Botão | Tamanho relativo |
|---|---|---|---|---|
| Beatriz (recomendada) | Verde completa (╔══╗) | "✓ RECOMENDADA" | Primário (full) | Maior |
| Clara (risco moderado) | Âmbar esquerda | "⚠ Risco moderado" | Secundário | Padrão |
| Diana (risco alto) | Sem borda / vermelha | "✕ Risco alto" | Terciário | Menor/compacto |

Fernanda identifica a melhor opção **sem ler os rationales** — a hierarquia visual conduz. Os rationales existem para explicar, não para guiar a escolha.

### Como Fernanda identifica o melhor candidato sem ler tudo

**Teste visual:** se Fernanda olhar para os 3 cards por 1 segundo sem ler:
- O maior card, com borda verde, com a tag mais clara → Beatriz
- O card do meio, com âmbar → segunda opção
- O card menor, com vermelho → opção de último recurso

A hierarquia funciona pela visão periférica. A leitura adiciona contexto, não guia a escolha inicial.

### O resto da Escala fica atrás

Quando a exceção está ativa, o resto da Escala (outras atividades, outros dias) está acessível pelo scroll mas visualmente subordinado. Fernanda está em modo de resolução — não de construção. O contexto visual reflete isso.

---

---

# WIREFRAME 4 — SUBSTITUIÇÃO ASSISTIDA (FLUXO COMPLETO)

**Este wireframe documenta o fluxo de 4 etapas da substituição assistida.**

---

## Etapa 1 — Posição em aberto identificada

```
  Fernanda vê posição em aberto no card de atividade:

  │  ✕  Amanda      Astrid          │
  │     Folga aprovada · 20/06      │
  │     [ + Alocar substituta ]     │

  Ela toca em "Alocar substituta"
  → Vai para Etapa 2
```

---

## Etapa 2 — Candidatos calculados

```
╔═══════════════════════════════════════╗
║                                       ║
║  ← Escala   CANDIDATOS — ASTRID       ║  ← Header contextual
║  Musical das Estrelas · Sáb 20/06    ║
║                                       ║
║  ┌─────────────────────────────────┐  ║  ← Contexto da posição
║  │  Posição: Astrid                │  ║
║  │  Show: Musical das Estrelas     │  ║
║  │  Data: Sáb 20/06 · 15:00       │  ║
║  │  Cobertura atual: nenhuma       │  ║
║  └─────────────────────────────────┘  ║
║                                       ║
║  CANDIDATOS DISPONÍVEIS — 3           ║
║                                       ║
║  ╔═════════════════════════════════╗  ║  ← Candidato 1
║  ║  ✓ RECOMENDADA  Risco: mínimo  ║  ║
║  ║                                 ║  ║
║  ║  Beatriz                        ║  ║
║  ║                                 ║  ║
║  ║  ~ Titular de Astrid · 12       ║  ║  ← Rationale IA
║  ║  ~   shows nos últimos 90 dias  ║  ║
║  ║  ~ Disponível Sáb 20            ║  ║
║  ║  ~ Sem restrições ativas        ║  ║
║  ║  ~ Aloca Astrid: sem conflito   ║  ║
║  ║                                 ║  ║
║  ║  [ Selecionar Beatriz ]         ║  ║  ← Botão primário
║  ╚═════════════════════════════════╝  ║
║                                       ║
║  ┌─────────────────────────────────┐  ║  ← Candidato 2
║  │  ⚠ Risco moderado               │  ║
║  │                                 │  ║
║  │  Clara                          │  ║
║  │                                 │  ║
║  │  ~ Fez Astrid como titular há   │  ║
║  │  ~   3 meses · 4 shows no total │  ║
║  │  ~ Disponível Sáb 20            │  ║
║  │  ~ Aloca Astrid: sem conflito   │  ║
║  │                                 │  ║
║  │  ( Selecionar Clara )           │  ║
║  └─────────────────────────────────┘  ║
║                                       ║
║  ┌─────────────────────────────────┐  ║  ← Candidato 3
║  │  ✕ Risco alto                  │  ║
║  │                                 │  ║
║  │  Diana · nunca fez como titular │  ║
║  │  Apenas observou em 2 ensaios   │  ║
║  │                                 │  ║
║  │  ( Selecionar Diana mesmo assim)│  ║
║  └─────────────────────────────────┘  ║
║                                       ║
║  ┌─────────────────────────────────┐  ║
║  │ ~                               │  ║
║  │ ~ Beatriz é a escolha mais      │  ║
║  │ ~ segura. Clara tem histórico   │  ║
║  │ ~ mas está há 3 meses sem fazer │  ║
║  │ ~ Astrid. Diana não tem         │  ║
║  │ ~ experiência suficiente para   │  ║
║  │ ~ um show.                      │  ║
║  └─────────────────────────────────┘  ║
║                                       ║
╚═══════════════════════════════════════╝
```

---

## Etapa 3 — Candidato selecionado → Simulação de Cascata

**Fernanda toca "Selecionar Beatriz"**

```
╔═══════════════════════════════════════╗
║                                       ║
║  ← Candidatos  IMPACTO DA TROCA       ║  ← Header mudou — contexto de confirmação
║                                       ║
║  ┌─────────────────────────────────┐  ║  ← Card de escolha — compacto, confirmatório
║  │  Beatriz → Astrid               │  ║
║  │  Musical das Estrelas · Sáb 20  │  ║
║  └─────────────────────────────────┘  ║
║                                       ║
║  IMPACTO DESTA TROCA                  ║  ← Seção de cascata — D4
║                                       ║
║  ┌─────────────────────────────────┐  ║
║  │                                 │  ║
║  │  ✓ Astrid no Musical das Est.   │  ║  ← O que resolve — verde
║  │    Sáb 20 · 15h → coberta       │  ║
║  │                                 │  ║
║  │  ─────────────────────────────  │  ║
║  │                                 │  ║
║  │  ⚠ Beatriz era backup de        │  ║  ← O que fica exposto — âmbar
║  │    Bloco 3 no Ensaio de Sáb     │  ║
║  │    09:00 · Bloco 3 → sem backup │  ║
║  │                                 │  ║
║  │  ─────────────────────────────  │  ║
║  │                                 │  ║
║  │  ~ Vale a troca. Bloco 3 no     │  ║  ← IA recomenda — italic, borda identidade
║  │  ~ Ensaio tem Carolina disponível│  ║
║  │  ~ como backup — sem risco real. │  ║
║  │                                 │  ║
║  └─────────────────────────────────┘  ║
║                                       ║
║  ─────────────────────────────────    ║
║                                       ║
║  [ ████ CONFIRMAR: BEATRIZ = ASTRID ] ║  ← Botão full-width — ação definitiva
║                                       ║
║  ( Escolher outro candidato )         ║  ← Volta sem confirmar
║                                       ║
╚═══════════════════════════════════════╝
```

---

## Anotações da Simulação de Cascata — D4

### Linguagem operacional, não técnica

**O que D4 proíbe:**
```
❌  "Conflito detectado em ResourceAllocation.id=4521 
     (foreign key: MemberSchedule) — overlap com 
     BackupAssignment Bloco 3 · data=2026-06-20T09:00"
```

**O que D4 exige:**
```
✓   "Beatriz era backup de Bloco 3 no Ensaio de Sáb
     Se você a alocar como Astrid, Bloco 3 fica sem backup."
```

A linguagem usa o vocabulário da operação, não do sistema. O Supervisor reconhece "Bloco 3 do Ensaio" porque é o contexto real da companhia — não um ID de registro.

### Anatomia da simulação de cascata

```
IMPACTO DESTA TROCA

  ✓ [O que é RESOLVIDO por esta escolha]   ← Verde · concreto · específico
  ─────────────────────
  ⚠ [O que FICA EXPOSTO por esta escolha]  ← Âmbar · específico · acionável
  ─────────────────────
  ~ [IA: vale a troca? raciocínio exposto]  ← Italic · borda identidade · recomendação
```

A ordem importa: primeiro o que resolve (o motivo da troca), depois o que expõe (o custo da troca), depois a avaliação da IA (se vale pagar o custo).

### Confirmação consciente

Fernanda sabe exatamente o que está confirmando. Não há surpresas depois. Isso é a proposta de valor central da simulação de cascata: **eliminar o retrabalho pós-confirmação**.

---

## Etapa 4 — Pós-confirmação da substituição

```
  Toast: "✓ Beatriz alocada como Astrid · Sáb 20/06"

  Fernanda retorna ao card de atividade — atualizado:

  │  ── Beatriz     Astrid      ✓    │  ← Slot agora coberto
  │     (substituta · Amanda folga)  │  ← Label contextual
```

---

---

# WIREFRAME 5 — PUBLICAÇÃO

**Cenário:** Fernanda resolveu todas as posições da Escala de Sáb 20. 1 risco permanece (Bruno com restrição — ela decidiu manter, a restrição é de baixo impacto na posição dele). Pronta para publicar.

---

```
╔═══════════════════════════════════════╗
║  STATUS BAR  ·  19/06 Sex  ·  10:15  ║
╠═══════════════════════════════════════╣
║                                       ║
║  ← Painel       Escala   [avatar]    ║
║  Musical das Estrelas · Grupo Ballet  ║
║                                       ║
║  Sáb 20 │ Dom 21 │ Seg 22 │ ···      ║
║  ──↑──   │        │        │           ║
║  Show ★  │        │        │           ║
║                                       ║
║  ┌─────────────────────────────────┐  ║
║  │  SÁB 20/06 · RESUMO            │  ║
║  │                                 │  ║
║  │  ████████████████████░░ 5/6 ✓  │  ║  ← Quase completa — 5 OK, 1 aceito
║  │  5 cobertas · 1 risco aceito    │  ║    Risco aceito = Fernanda decidiu
║  │                                 │  ║    manter mesmo com alerta
║  │  Status: Rascunho                │  ║
║  └─────────────────────────────────┘  ║
║                                       ║
║  [Escala resumida, não o foco agora]  ║
║  ···  (atividades em segundo plano)   ║
║                                       ║
╠═══════════════════════════════════════╣
║                                       ║
║  ┌─────────────────────────────────┐  ║  ← PAINEL DE VALIDAÇÃO — expandido
║  │                                 │  ║    para publicação
║  │  PUBLICAR ESCALA — SÁB 20/06   │  ║
║  │  ─────────────────────────────  │  ║
║  │                                 │  ║
║  │  ✓  5 posições cobertas         │  ║
║  │  ⚠  1 risco ativo (Bruno/       │  ║
║  │       Marcos · restrição lombar)│  ║
║  │  —  0 posições em aberto        │  ║
║  │                                 │  ║
║  │  Membros notificados: 8         │  ║
║  │  (todos que têm posição no dia) │  ║
║  │                                 │  ║
║  │  ─────────────────────────────  │  ║
║  │                                 │  ║
║  │  ~ Escala está bem coberta.     │  ║
║  │  ~ O risco do Bruno é baixo se  │  ║
║  │  ~ ele aqueceu adequadamente.   │  ║
║  │  ~ Você decidiu manter — OK.    │  ║
║  │                                 │  ║
║  │  ─────────────────────────────  │  ║
║  │                                 │  ║
║  │  [ ████ PUBLICAR ESCALA ██████ ]│  ║  ← Botão full-width — ação definitiva
║  │                                 │  ║
║  │  ( Continuar editando )         │  ║  ← Volta sem publicar
║  │                                 │  ║
║  └─────────────────────────────────┘  ║
║                                       ║
╠═══════════════════════════════════════╣
║  ○ Painel  ■ Escala  ○ Solic  ○ Msg   ║
╚═══════════════════════════════════════╝
```

---

## Anotações da Publicação

### Alertas não bloqueantes — decisão consciente

O sistema não impede Fernanda de publicar com o risco do Bruno. Ela decidiu manter. O painel de validação confirma isso — "Você decidiu manter — OK" — respeitando a decisão sem repetir o alerta como punição.

**O que o painel de validação não faz:**
- Não bloqueia a publicação
- Não exige justificativa escrita para cada risco aceito
- Não mostra um modal de "Tem certeza? Tem certeza mesmo?" aninhados

**O que o painel faz:**
- Resume o estado final: coberto / em risco / em aberto
- Mostra quantos membros serão notificados
- A IA confirma que a decisão é razoável
- O botão de publicar está disponível, proeminente, sem ambiguidade

### O botão "Publicar Escala"

É o botão mais importante do sistema — a ação que desencadeia notificações, atualiza o Meu Dia de todos os membros, e cria um registro no Histórico.

Precisa ser:
- Inequívoco (sem ambiguidade sobre o que faz)
- Proeminente (maior botão da tela)
- Não ansioso (não precisa de 3 confirmações — apenas 1 clara)

---

## Wireframe 5B — Confirmação de Publicação

**Após tocar "Publicar Escala" — modal de confirmação:**

```
╔═══════════════════════════════════════╗
║                                       ║
║  ┌─────────────────────────────────┐  ║
║  │                                 │  ║  ← Modal overlay (glassmorphism light)
║  │  Publicar Escala?               │  ║
║  │  Sáb 20/06 · Musical das Est.  │  ║
║  │                                 │  ║
║  │  8 membros serão notificados    │  ║
║  │  Não poderá ser desfeito       │  ║
║  │  (mas pode ser republicada      │  ║
║  │   com alterações)              │  ║
║  │                                 │  ║
║  │  [ ████ PUBLICAR AGORA ███████ ]│  ║
║  │                                 │  ║
║  │  ( Cancelar )                   │  ║
║  │                                 │  ║
║  └─────────────────────────────────┘  ║
║                                       ║
╚═══════════════════════════════════════╝
```

**Nota:** o modal não repete todos os alertas — apenas o que importa para a ação: quantas pessoas serão notificadas e que a ação não é irreversível mas pode ser corrigida.

---

---

# WIREFRAME 6 — PÓS-PUBLICAÇÃO

**Cenário:** Fernanda publicou. A Escala está ativa para Sáb 20.

---

```
╔═══════════════════════════════════════╗
║  STATUS BAR  ·  19/06 Sex  ·  10:16  ║
╠═══════════════════════════════════════╣
║                                       ║
║  ✓  Escala publicada · 8 notificados  ║  ← Toast — 3s
║                                       ║
║  ─────────────────────────────────    ║
║                                       ║
║  ← Painel       Escala   [avatar]    ║
║  Musical das Estrelas · Grupo Ballet  ║
║                                       ║
║  Sáb 20 │ Dom 21 │ Seg 22 │ ···      ║
║  ──↑──   │        │        │           ║
║  ★ PUBL  │        │        │           ║  ← "PUBL" = publicada na strip
║                                       ║
║  ┌─────────────────────────────────┐  ║
║  │  SÁB 20/06 · PUBLICADA  ✓      │  ║  ← Status: Publicada
║  │                                 │  ║
║  │  Publicada às 10:16 por Fernanda│  ║
║  │  5 cobertas · 1 risco aceito    │  ║
║  │  Confirmações: 0/8 até agora    │  ║  ← Rastreamento começa imediatamente
║  │                                 │  ║
║  │  ░░░░░░░░░░░░░░░░░░░░ 0/8 ✓   │  ║  ← Barra vazia = aguardando
║  └─────────────────────────────────┘  ║
║                                       ║
║  ATIVIDADES — SÁB 20/06               ║
║                                       ║
║  ┌─────────────────────────────────┐  ║
║  │ Musical das Estrelas  ★  15:00  │  ║
║  │  PUBLICADA  ✓                   │  ║
║  │ ─────────────────────────────   │  ║
║  │                                 │  ║
║  │  ── Beatriz     Astrid     ✓    │  ║  ← Beatriz (substituta) — visível
║  │  ── Bruno       Marcos    ⚠    │  ║  ← Bruno — risco mantido
║  │  ── Carol       Elena      ✓    │  ║
║  │  ── Diego       Figurante A ✓   │  ║
║  │  ── Sara        Figurante B ✓   │  ║
║  │  ── Rafael      Regência   ✓    │  ║
║  │                                 │  ║
║  └─────────────────────────────────┘  ║
║                                       ║
╠═══════════════════════════════════════╣
║  ┌─────────────────────────────────┐  ║  ← Painel pós-publicação
║  │ Publicada · Monitorar confirmações│  ║
║  │              ( ← Ir ao Painel ) │  ║  ← Ação sugerida: retornar
║  └─────────────────────────────────┘  ║
╠═══════════════════════════════════════╣
║  ○ Painel  ■ Escala  ○ Solic  ○ Msg   ║
╚═══════════════════════════════════════╝
```

---

## Anotações do Pós-Publicação

### O que acontece automaticamente após a publicação

1. Toast de confirmação ("8 notificados")
2. Status da data na strip muda para "★ PUBL"
3. Card de resumo mostra "PUBLICADA ✓" com horário e autoria
4. Rastreador de confirmações começa: "0/8" com barra vazia
5. O Meu Dia de todos os 8 membros notificados foi atualizado automaticamente
6. Registro no Histórico criado

### A ação sugerida: retornar ao Painel

O Painel de Validação muda de "publicar" para "monitorar confirmações". A ação disponível é "(← Ir ao Painel)" — o Painel é o lugar de monitoramento, não a Escala.

### Republicação com alterações

Se Fernanda precisar mudar algo após publicar:

```
  Fernanda edita uma posição na Escala publicada
       │
       ▼
  Sistema detecta: "Esta posição está na Escala publicada"
       │
       ▼
  Card de atividade: "Escala publicada — edição gerará republicação"
       │
       ▼
  Fernanda confirma a edição
       │
       ▼
  Painel de Validação: "Republicar com 1 alteração?"
  Diff resumido: "Beatriz → Clara · Astrid"
       │
       ▼
  [ REPUBLICAR ] → Notificações enviadas apenas para afetados
```

---

---

# WIREFRAME 7 — VISÃO POR MEMBRO (alternativa à visão por atividade)

**Quando usar:** Fernanda quer verificar a carga total do dia de um membro específico antes de alocá-lo.

---

```
╔═══════════════════════════════════════╗
║                                       ║
║  ← Escala   BEATRIZ — SÁB 20/06      ║  ← Filtrado por membro
║                                       ║
║  ┌─────────────────────────────────┐  ║
║  │  Beatriz Santos                 │  ║
║  │  Ballet · Grupo 2               │  ║
║  │  Status: disponível · sem rest. │  ║
║  └─────────────────────────────────┘  ║
║                                       ║
║  ALOCAÇÕES EM SÁB 20/06               ║
║                                       ║
║  ┌─────────────────────────────────┐  ║
║  │  09:00 Ensaio Técnico           │  ║
║  │       Bloco 3 · backup (não     │  ║
║  │       confirmado como titular)  │  ║
║  │                                 │  ║
║  │  15:00 Musical das Estrelas     │  ║
║  │       Astrid · titular          │  ║  ← Alocação que estamos confirmando
║  │       (substituta de Amanda)    │  ║
║  │                                 │  ║
║  │  Intervalo: 3h30 entre ativid.  │  ║
║  └─────────────────────────────────┘  ║
║                                       ║
║  PRÓXIMOS 7 DIAS — BEATRIZ            ║
║  ┌─────────────────────────────────┐  ║
║  │  Sex 19 · 2 atividades ✓        │  ║
║  │  Sáb 20 · 2 atividades (acima)  │  ║
║  │  Dom 21 · livre                 │  ║
║  │  ···  ( ver mais )              │  ║
║  └─────────────────────────────────┘  ║
║                                       ║
║  ~ Beatriz tem carga normal.          ║  ← IA: avaliação de sobrecarga
║  ~ O intervalo de 3h30 é suficiente.  ║
║  ~ Sem risco de sobrecarga.           ║
║                                       ║
╚═══════════════════════════════════════╝
```

**Acesso:** a partir do card de candidato, botão discreto "(Ver agenda de Beatriz)" abre esta visão. Fernanda pode verificar antes de confirmar — mas não é obrigatório.

---

---

# WIREFRAME 8 — ESCALA EM MODO ADMIN

**Como o Admin vê a Escala — diferente do Supervisor.**

---

```
╔═══════════════════════════════════════╗
║  STATUS BAR  ·  19/06 Sex  ·  09:30  ║
╠═══════════════════════════════════════╣
║                                       ║
║  ← Painel de Saúde    Escala  [av]   ║  ← Retorna ao Painel de Saúde (não Painel Operacional)
║  Musical das Estrelas                 ║  ← Opera sem "Grupo X" — vê todos
║                                       ║
║  GRUPOS                               ║  ← Filtro de Grupo visível para Admin
║  [ Todos ] [ Ballet ] [ Elenco ] ···  ║
║                                       ║
║  Sáb 20 │ Dom 21 │ Seg 22 │ ···      ║
║                                       ║
║  ┌─────────────────────────────────┐  ║
║  │  SÁB 20/06 · TODOS OS GRUPOS   │  ║
║  │                                 │  ║
║  │  Ballet:  5/6 cobertas · 1 ↓   │  ║  ← Por Grupo
║  │  Elenco:  8/8 cobertas   ✓      │  ║
║  │  Técnico: 4/4 cobertas   ✓      │  ║
║  │                                 │  ║
║  │  Total: 17/18 · 1 aberta       │  ║
║  └─────────────────────────────────┘  ║
║                                       ║
║  [Supervisora Fernanda responsável    ║  ← Admin vê quem é o Supervisor
║  pelo grupo com posição em aberto]    ║    responsável por cada situação
║                                       ║
╚═══════════════════════════════════════╝
```

**Diferença do Admin vs. Supervisor na Escala:**
- Admin vê todos os Grupos em uma visão agregada
- Admin não publica para grupos além do seu escopo (sem botão "Publicar" global)
- Admin pode ver e investigar, mas a responsabilidade de resolução é do Supervisor do Grupo
- Admin usa a Escala para diagnóstico estratégico — não para alocação operacional diária

---

---

# FLUXOS DE DECISÃO — S-04

---

## Fluxo A — Construção planejada completa

```
  Fernanda abre a Escala para uma data futura
       │
       ▼
  Strip de datas → seleciona a data do show
       │
       ▼
  Resumo de cobertura: N/M posições
       │
       ├── Todas cobertas → Painel de Validação: "Pronta para publicar"
       │        → [Publicar]
       │
       └── Posições em aberto ou em risco
                │
                ▼
           Fernanda toca na atividade com problema
                │
                ▼
           Card expandido mostra posições
                │
                ▼
           Fernanda toca na posição em aberto
                │
                ▼
           Candidatos calculados (Etapa 2 da substituição)
                │
                ▼
           Fernanda seleciona candidato
                │
                ▼
           Simulação de cascata (Etapa 3)
                │
                ▼
           Fernanda confirma ou escolhe outro candidato
                │
                ▼
           Posição atualizada — repete para próxima em aberto
                │
                ▼
           Todas resolvidas → [Publicar]
```

---

## Fluxo B — Exceção crítica (via notificação)

```
  Notificação: "Carlos não apareceu — Marcos em aberto"
       │
       ▼
  Fernanda toca na notificação
       │
       ▼
  Escala abre DIRETAMENTE no Modo Exceção
  Exceção pré-carregada + candidatos calculados pela IA
       │
       ▼
  Fernanda lê contexto da exceção (5s)
  │
  └── IA recomendou Beatriz (visível no card de exceção)
           │
           ▼
      Fernanda seleciona Beatriz (1 toque)
           │
           ▼
      Simulação de cascata (Etapa 3)
      "✓ Marcos coberto · ⚠ Bloco 3 sem backup · IA: vale a troca"
           │
           ▼
      Fernanda confirma
           │
           ▼
      Escala republicada automaticamente
      Notificações enviadas para afetados
      Fernanda toca "← Painel"
           │
           ▼
      Painel atualizado: exceção resolvida, rastreador ativo
```

---

## Fluxo C — Resolução com cascata que exige segunda decisão

```
  Fernanda seleciona candidato A → Simulação de Cascata
       │
       ▼
  "⚠ Posição X fica descoberta · Sem candidatos disponíveis"
       │
       ├── IA: "Não recomendo — posição X é crítica"
       │        │
       │        └── Fernanda escolhe outro candidato
       │                 → Repete Etapa 2 com outro candidato
       │
       └── IA: "Não ideal, mas posição X tem cobertura alternativa"
                │
                └── Fernanda confirma com ciência
```

---

## Fluxo D — Gerar Livro do Dia a partir da Escala

```
  Escala publicada para uma data com show
       │
       ▼
  Fernanda toca "(•) Gerar Livro do Dia"
       │         (ação disponível na Escala quando Escala está publicada)
       ▼
  Abre S-05 — Livro do Dia
  IA gera proposta automaticamente com base na Escala publicada
       │
       ▼
  Fernanda revisa, ajusta se necessário
       │
       ▼
  Aprova o Livro → disponível para os Membros no Meu Dia
```

---

---

# AUDITORIA DO WIREFRAME — S-04

---

## Coerência com as Pesquisas

| Descoberta | Resposta no wireframe |
|---|---|
| **D1: Supervisor precisa de diagnóstico em segundos** | Resumo de cobertura com barra de progresso + contadores diretos. Estado da data visível antes de scrollar. ✅ |
| **D3: Candidatos por risco — não lista plana** | 3 camadas visuais distintas (D3 validado explicitamente). Rationale da IA por candidato. ✅ |
| **D4: Cascata invisível é o maior risco** | Simulação de cascata obrigatória antes de qualquer confirmação de substituição. Linguagem operacional. ✅ |
| **D5: IA pré-calculada em modo de urgência** | Modo Exceção: candidatos e recomendação da IA visíveis sem nenhum delay. ✅ |
| **D6: Confirmação consciente** | Modal de publicação com resumo claro. Simulação de cascata antes de confirmar substituição. ✅ |
| **D8: Folgas acumuladas criam risco invisível** | IA menciona no wireframe 2 a folga de Amanda + risco acumulado para a data. ✅ |

---

## Coerência com as Jornadas

| Jornada | Wireframe | Validação |
|---|---|---|
| **JS-03 — Substituição Emergencial** | WF3 (Modo Exceção) + Fluxo B | Notificação → exceção pré-carregada → candidatos em hierarquia → cascata → confirmar. ✅ |
| **JS-04 — Livro do Dia** | WF6 (pós-publicação) + Fluxo D | Publicar → gerar Livro do Dia. Fluxo natural. ✅ |
| **JS-05 — Comunicação pós-publicação** | WF6 + rastreador de confirmações | Rastreador inicia automaticamente após publicação. ✅ |
| **JS-07 — Construção planejada** | WF1 + WF2 + Fluxo A | Visão sistemática por atividade + posição + alerta. ✅ |
| **JS-08 — Múltiplas exceções** | WF3 + WF2 (com alertas) | Alertas priorizados, IA com ordem de resolução. ✅ |

---

## Coerência com a Arquitetura de Navegação

| Princípio | Validação |
|---|---|
| **Notificação crítica → Escala (não Painel)** | Fluxo B: notificação aterrissa diretamente no Modo Exceção da Escala. ✅ |
| **Painel = diagnóstico; Escala = resolução** | A Escala tem o botão "← Painel" sempre visível. Pós-publicação sugere retorno ao Painel. ✅ |
| **S-04 alimenta S-01 e S-05** | WF6: publicação atualiza Meu Dia automaticamente. Fluxo D: Livro do Dia gerado a partir da Escala. ✅ |
| **Histórico registra todas as ações** | WF3 + WF5: toda confirmação gera registro automático. ✅ |
| **Admin tem visão diferente do Supervisor** | WF8: Admin vê por Grupo agregado, sem publicação global. ✅ |

---

## Coerência com a Identidade da Asa

| Princípio | Como aparece na Escala |
|---|---|
| **Leveza** | Atividades sem problemas ficam recolhidas. Apenas o que precisa de atenção ocupa espaço. ✅ |
| **Profundidade** | Modo Exceção tem candidato 1 maior, candidato 2 padrão, candidato 3 compacto — planos perceptivos distintos. ✅ |
| **Direção** | Todo card com problema tem uma ação imediata. Fernanda nunca olha para um problema sem saber o que fazer. ✅ |
| **Precisão** | Nenhum elemento sem função. A Escala não tem KPIs decorativos ou widgets de cobertura genéricos. ✅ |
| **Não planilha** | Posições como slots em cards, não linhas em tabela. Borda colorida com significado, não zebra-stripe. ✅ |

---

## Coerência com "Transformar Caos em Clareza de Decisão"

### As 5 perguntas da spec — respondidas pelo wireframe

**"Como o Supervisor entende a situação em menos de 10 segundos?"**
→ Strip de datas com indicadores + Resumo de cobertura com barra de progresso + contadores diretos. Fernanda sabe "5/6, 1 aberta, Astrid" em < 10 segundos. ✅

**"Como identifica o melhor candidato sem ler tudo?"**
→ D3: Candidato recomendado tem borda verde completa + tag "RECOMENDADA" + botão primário. Fernanda identifica Beatriz pela forma visual antes de ler qualquer texto. ✅

**"Como entende o impacto antes de confirmar?"**
→ D4: Simulação de cascata inline antes da confirmação. "✓ Astrid coberta · ⚠ Bloco 3 sem backup · IA: vale a troca". Tudo visível, em linguagem operacional. ✅

**"Como distingue construção de resposta à exceção?"**
→ O contexto visual diferencia os dois modos: no Modo Exceção, o card de exceção domina o topo (╔══╗), candidatos aparecem logo abaixo, e o resto da Escala recua. No Modo Construção, a navegação temporal e o resumo de cobertura lideram. ✅

**"Como publica com confiança?"**
→ Painel de Validação com resumo claro (cobertas / em risco / em aberto). IA confirma que a decisão é razoável. Modal de confirmação direto sem excesso de advertências. ✅

---

## Problemas identificados e ajustes

### P1 — Modo Exceção: candidatos em scroll podem não ser todos visíveis

No Modo Exceção com countdown apertado, o card de exceção + candidato 1 provavelmente cobre todo o viewport. Candidatos 2 e 3 podem exigir scroll.

**Decisão:** aceitável. Fernanda raramente precisa de candidato 3. O candidato recomendado está acima do fold. O scroll existe para os casos em que a recomendação não é a escolha certa. ✅

### P2 — Simulação de cascata quando o impacto é zero

Quando a substituição não cria nenhum impacto (Beatriz está livre, não tem outras alocações na data), a simulação de cascata deve:

```
IMPACTO DESTA TROCA:
  ✓ Astrid no Musical → coberta
  ✓ Sem impacto adicional — Beatriz estava livre neste dia
```

Não omitir a seção — confirmar explicitamente que não há cascata. Isso aumenta a confiança. ⚠

### P3 — Acúmulo de folgas: onde aparece na Escala

O WF2 mostra a IA mencionando o risco de Amanda no card IA. Mas o Resumo de Cobertura não tem um indicador específico de "risco acumulado de folgas". Para a Escala, o risco acumulado se manifesta como "posição em aberto" — é o resultado da folga, não a folga em si.

**Conclusão:** o tratamento atual está correto. O risco de folgas acumuladas é uma preocupação do Painel Operacional (multi-horizonte), não da Escala (que trata a consequência da folga). ✅

### P4 — Edição de posição na Escala publicada

O fluxo de republicação foi documentado brevemente. Precisa de wireframe específico em iteração futura — especialmente o diff visual entre a versão anterior e a nova. ⚠

### P5 — Visão "Por Membro" como modo alternativo

A visão por membro (WF7) está documentada mas seu acesso na navegação da Escala não está claro no wireframe principal. Recomendação: toggle "Por atividade / Por membro" no cabeçalho da Escala, imediatamente abaixo do strip de datas. ⚠

---

## Veredicto da Auditoria

**O wireframe estrutural de S-04 Escala está aprovado para avançar ao mockup visual.**

As 5 perguntas da spec foram respondidas. D3, D4 e D5 estão validados estruturalmente. Os dois modos (Construção e Exceção) são visualmente distinguíveis sem mudar a arquitetura da superfície. A simulação de cascata está em linguagem operacional. Os candidatos têm hierarquia visual imediata.

5 ajustes foram identificados: P1 (aceito), P2 e P5 (atenção para o mockup), P3 (confirmado como correto), P4 (wireframe adicional em iteração futura).

---

## Status do Bloco 1 — Wireframes

| Superfície | Wireframe | Status |
|---|---|---|
| **S-01 Meu Dia** | docs/wireframe-s01-meu-dia.md | ✅ Aprovado para mockup |
| **S-02 Painel Operacional** | docs/wireframe-s02-painel-operacional.md | ✅ Aprovado para mockup |
| **S-04 Escala** | docs/wireframe-s04-escala.md | ✅ Aprovado para mockup |

**Todas as superfícies do Bloco 1 estão prontas para a fase de mockup visual.**

---

*Base para mockup visual: docs/design-visual-bloco1-myasa-2.0.md*
*Especificação funcional: docs/especificacao-bloco1-myasa-2.0.md*
*Próxima fase: Mockup Visual — S-01 Meu Dia (primeira superfície a ser desenhada)*
