# MyASA 2.0 — Wireframes Estruturais do Ciclo de Comunicação Operacional

> **Versão:** 18/06/2026
> **Fase:** Wireframe Estrutural — anterior a mockups visuais
> **Base:** Arquitetura · Entidade MO · Ciclo de Planejamento · Ciclo de Comunicação · UX Integrado · Bloco 1 · S-06 · D-01–D-20 · UX-01–UX-10
> **Escopo:** S-05 Livro do Dia · S-08 Avisos · S-11 Histórico
> **Status:** 🟢 Pronto para Mockup

---

## Convenções deste documento

```
┌─────────────────────────────┐   Zona de conteúdo
│  [RÓTULO DA ZONA]           │   Título da zona em maiúsculas
│                             │
│  · Item de conteúdo         │   Conteúdo dentro da zona
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │   Divisor interno
│  [AÇÃO]                     │   Elemento interativo (botão, link, toggle)
└─────────────────────────────┘

▶ Elemento prioritário / atenção imediata
◆ Elemento informativo / sem ação necessária
⚡ Elemento de ação obrigatória
⚠ Elemento de alerta / estado degradado
✓ Elemento confirmado / resolvido

Perfis:
  SUP = Supervisor     MEM = Membro     ADM = Admin
```

---

## PARTE 1 — CENÁRIOS OBRIGATÓRIOS

Os 7 cenários abaixo definem os estados que os wireframes devem suportar. Cada wireframe nas partes 2, 3 e 4 é anotado com os cenários que cobre.

---

**WC-01 — Mudança simples (1 membro afetado)**
> Folga de 1 dia aprovada para Amanda Souza. Musical 12h30 afetado. 1 posição descoberta.
> Afeta: 1 membro na posição. Substituta: Beatriz Lima. Avisos: 2 (Amanda, Beatriz).

**WC-02 — Mudança importante (5 membros afetados)**
> Ensaio cancelado de última hora. 5 membros alocados. Avisos Críticos para todos.
> Afeta: 5 membros. Confirmações pendentes: todas.

**WC-03 — Mudança persistente (vários dias)**
> Restrição Médica de Beatriz Lima: 19/06 a 30/06. 4 Livros do Dia afetados no período.
> Afeta: fila de revisão de 4 Livros. Múltiplos shows ao longo de 11 dias.

**WC-04 — Livro republicado**
> Musical 21/06 recebeu 3 versões (v1, v2, v3) em 24h. Diferentes posições afetadas em cada versão.
> Afeta: histórico de versões visível, avisos agrupados para não saturar membros.

**WC-05 — Membro sem confirmação**
> Carlos não confirmou Aviso Importante. Show começa em 1h40min. Supervisor não agiu.
> Afeta: escalada automática. Rastreamento de urgência em tempo real.

**WC-06 — Investigação pelo Supervisor**
> Supervisora Ana Silva investiga por que o Membro Carlos apareceu no Musical 14/06 com papel trocado sem ela saber.
> Fluxo: Histórico → MO → Livro do Dia → Aviso correspondente.

**WC-07 — Investigação pelo Admin**
> Admin Ricardo investiga por que 3 shows de sábado tiveram posições Em Aberto em junho.
> Fluxo: Histórico → padrão identificado por IA → múltiplas MOs → análise causal.

---

## PARTE 2 — S-05 LIVRO DO DIA

---

### WL-01 — Livro Publicado

*Cenários: WC-01 (após resolução e publicação) · WC-04 (versão mais recente)*

---

#### Visão do Supervisor

```
┌─────────────────────────────────────────────────────┐
│  [ZONA CABEÇALHO]                                    │
│                                                      │
│  Musical Grandes Clássicos                           │
│  Sábado, 21/06 · 12h30                              │
│                                                      │
│  ✓ PUBLICADO v3 · por Ana Silva · hoje às 18h22     │
│  [VER VERSÕES ANTERIORES]                            │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  [ZONA COBERTURA] — primeira informação              │
│                                                      │
│  ▶ 12 de 12 posições cobertas                       │
│     ✓ Cobertas: 12   ─   Em Risco: 0   ─   Em Aberto: 0  │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  [ZONA POSIÇÕES]                                     │
│                                                      │
│  BLOCO 1 · 12h30–13h45                              │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─        │
│  ◆ Astrid            Beatriz Lima     ✓ Confirmado  │
│  ◆ Mensageira        Carlos Andrade   · Pendente    │
│  ◆ Rainha            Diana Costa      ✓ Confirmado  │
│                                                      │
│  BLOCO 2 · 13h45–15h00                              │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─        │
│  ◆ Astrid            Beatriz Lima     ✓ Confirmado  │
│  ◆ Cavaleiro         Eduardo Melo     ✓ Confirmado  │
│  ...                                                │
│                                                      │
│  [EXPANDIR TODOS OS BLOCOS]                          │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  [ZONA AÇÕES DO SUPERVISOR]                          │
│                                                      │
│  [REPUBLICAR LIVRO]    [EXPORTAR]    [VER HISTÓRICO] │
└─────────────────────────────────────────────────────┘
```

**O que o Supervisor vê primeiro:** Cobertura (12/12). Segundo: estado das confirmações inline nas posições. Terceiro: posições com confirmação pendente.

**Regra de hierarquia:** o Supervisor não precisa ler todos os nomes — a cobertura responde "está pronto?". Os nomes e confirmações são informação secundária.

---

#### Visão do Membro

```
┌─────────────────────────────────────────────────────┐
│  [ZONA CABEÇALHO — fatia]                            │
│                                                      │
│  Musical Grandes Clássicos                           │
│  Sábado, 21/06 · 12h30                              │
│                                                      │
│  ✓ Você confirmou este show                         │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  [ZONA MEU PAPEL] — primeira informação              │
│                                                      │
│  ▶ Seu papel neste show                             │
│                                                      │
│  Astrid · Blocos 1, 2 e 4                           │
│                                                      │
│  Entrada: 12h15 (15 min antes)                      │
│  Local: Camarim B                                   │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  [ZONA DETALHES DO PAPEL]                            │
│                                                      │
│  Posições específicas em cada bloco                  │
│  Particularidades do figurino                        │
│  Observações da Supervisora                          │
│                                                      │
│  [VER LIVRO DO SHOW COMPLETO PARA ASTRID]           │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  [ZONA ELENCO RESUMIDO]  ← sob demanda              │
│                                                      │
│  [VER QUEM MAIS ESTÁ NESTE SHOW]                    │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  [ZONA IA]                                           │
│                                                      │
│  [PERGUNTAR À IA SOBRE ESTE SHOW]                   │
└─────────────────────────────────────────────────────┘
```

**O que o Membro vê primeiro:** seu papel — não o Livro completo. A fatia é o padrão. O Livro completo é acesso sob demanda.

---

### WL-02 — Livro Desatualizado

*Cenários: WC-01 (após aprovação da folga, antes da revisão) · WC-03 (restrição afetando múltiplos livros)*

---

#### Visão do Supervisor

```
┌─────────────────────────────────────────────────────┐
│  [ZONA ALERTA — topo absoluto]                       │
│                                                      │
│  ⚠ LIVRO DESATUALIZADO                              │
│                                                      │
│  Folga de Amanda Souza aprovada em 17/06             │
│  Posições afetadas: 2 · Revisão necessária          │
│                                                      │
│  ⚡ [REVISAR AGORA]                  [VER DETALHES] │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  [ZONA CABEÇALHO]                                    │
│                                                      │
│  Musical Grandes Clássicos                           │
│  Sábado, 21/06 · 12h30                              │
│                                                      │
│  ⚠ DESATUALIZADO · última versão: v2 · 15/06       │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  [ZONA COBERTURA — estado degradado]                 │
│                                                      │
│  ▶ 10 de 12 posições cobertas                       │
│     ✓ Cobertas: 10   ─   Em Risco: 0   ─   ⚠ Em Aberto: 2  │
│                                                      │
│  As posições abaixo estão Em Aberto por causa       │
│  da folga aprovada de Amanda Souza                  │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  [ZONA POSIÇÕES AFETADAS — destacadas]               │
│                                                      │
│  ⚠ EM ABERTO                                        │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─        │
│  ⚡ Astrid · Bloco 1       [era Amanda] → Em Aberto │
│     Candidatos disponíveis: 3                        │
│     [RESOLVER ESTA POSIÇÃO]                         │
│                                                      │
│  ⚡ Astrid · Bloco 4       [era Amanda] → Em Aberto │
│     Candidatos disponíveis: 3                        │
│     [RESOLVER ESTA POSIÇÃO]                         │
│                                                      │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─        │
│  POSIÇÕES INALTERADAS (10)                          │
│  [EXPANDIR]                                         │
└─────────────────────────────────────────────────────┘
```

**Como identificar perda de confiabilidade:**
O banner de alerta aparece acima do cabeçalho — antes de qualquer informação de conteúdo. O Supervisor não pode "ver o Livro normalmente" enquanto ele está desatualizado. A desatualização é inescapável visualmente.

**Como mostrar impacto sem obrigar leitura completa:**
Apenas as posições Em Aberto são destacadas. As 10 posições inalteradas ficam colapsadas — "POSIÇÕES INALTERADAS (10) [EXPANDIR]". O Supervisor age sobre o problema sem precisar re-ler o Livro inteiro.

---

#### Visão do Membro

```
┌─────────────────────────────────────────────────────┐
│  [ZONA ALERTA — informativo]                         │
│                                                      │
│  ◆ Este Livro está sendo atualizado pela Supervisora │
│  As informações abaixo refletem a versão anterior   │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  [ZONA MEU PAPEL — inalterado]                       │
│                                                      │
│  Seu papel neste show não foi alterado               │
│                                                      │
│  Astrid · Blocos 1, 2 e 4                           │
│  (mesmo da versão anterior)                          │
└─────────────────────────────────────────────────────┘
```

**Regra de design:** o Membro vê o estado mais recente publicado — com aviso de que o Livro está sendo revisado. Ele não vê um Livro "parcialmente atualizado". A versão publicada mais recente permanece a fonte de verdade até nova publicação.

---

### WL-03 — Livro Republicado

*Cenários: WC-04 (3 republicações) · WC-01 (após substituição)*

---

#### Visão do Supervisor

```
┌─────────────────────────────────────────────────────┐
│  [ZONA CABEÇALHO]                                    │
│                                                      │
│  Musical Grandes Clássicos                           │
│  Sábado, 21/06 · 12h30                              │
│                                                      │
│  ✓ PUBLICADO v3 · por Ana Silva · hoje às 18h22     │
│  [VER VERSÕES ANTERIORES ▾]                          │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  [ZONA DELTA — o que mudou nesta versão]             │
│                                                      │
│  ◆ v3 em relação a v2:                              │
│                                                      │
│  → Astrid · Bloco 1: Amanda Souza → Beatriz Lima    │
│  → Astrid · Bloco 4: Amanda Souza → Beatriz Lima    │
│                                                      │
│  3 membros notificados · 2 confirmaram · 1 pendente │
│  [VER RASTREAMENTO DE CONFIRMAÇÕES]                 │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  [ZONA HISTÓRICO DE VERSÕES — colapsado por padrão] │
│                                                      │
│  [VER VERSÕES ANTERIORES ▾]                          │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─        │
│  v2 · 16/06 às 14h10 · por Ana Silva               │
│     Amanda Souza → posição Em Aberto                │
│     [VER v2]                                        │
│                                                      │
│  v1 · 15/06 às 10h30 · por Ana Silva               │
│     Versão original                                  │
│     [VER v1]                                        │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  [ZONA POSIÇÕES]                                     │
│                                                      │
│  BLOCO 1 · 12h30–13h45                              │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─        │
│  ▶ Astrid [ALTERADO em v3]  Beatriz Lima  · Pendente│
│  ◆ Mensageira               Carlos Andrade ✓        │
│  ...                                                │
└─────────────────────────────────────────────────────┘
```

**Como visualizar alterações entre versões:**
- Na zona Delta: resumo do que mudou em linguagem direta
- Na lista de posições: tag [ALTERADO em v3] nas posições que mudaram
- Acesso explícito a versões anteriores: colapsado por padrão, disponível sob demanda

**Como diferenciar conteúdo normal / alterado / crítico:**
- Conteúdo normal: ◆ + sem marcação adicional
- Conteúdo alterado: ▶ + tag [ALTERADO em vX]
- Conteúdo crítico: ⚡ + banner de alerta + ação obrigatória

---

#### Visão do Membro — com alteração na sua posição

```
┌─────────────────────────────────────────────────────┐
│  [ZONA DELTA PESSOAL — primeira informação]          │
│                                                      │
│  ▶ ALTERAÇÃO NO SEU PAPEL                           │
│                                                      │
│  Era:   Mensageira · Blocos 1, 2 e 4               │
│  Agora: Astrid · Blocos 1, 2 e 4                   │
│                                                      │
│  ⚡ [CONFIRMAR ALTERAÇÃO]                           │
│  [ENTENDER MELHOR]  →  IA ou Histórico              │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  [ZONA MEU PAPEL — novo papel]                       │
│                                                      │
│  Astrid · Blocos 1, 2 e 4                           │
│  Entrada: 12h15 (15 min antes)                      │
│  Particularidades: ...                              │
└─────────────────────────────────────────────────────┘
```

**Regra inegociável (D-14):** o Membro vê o delta (era → agora) antes de ver qualquer botão de confirmação. O botão [CONFIRMAR ALTERAÇÃO] aparece abaixo do delta — nunca antes ou sem o delta.

---

### WL-04 — Livro Executado

*Cenários: WC-01, WC-04 (após o show ocorrer)*

```
┌─────────────────────────────────────────────────────┐
│  [ZONA CABEÇALHO]                                    │
│                                                      │
│  Musical Grandes Clássicos                           │
│  Sábado, 21/06 · 12h30                              │
│                                                      │
│  ✓ EXECUTADO · Show ocorreu · v3 foi a versão final │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  [ZONA RESUMO DE EXECUÇÃO]                           │
│                                                      │
│  ◆ 12 de 12 posições cobertas no momento do show    │
│  ◆ 11 de 12 membros confirmaram antes do início     │
│  ◆ 1 membro executou sem confirmação: Carlos Andrade│
│                                                      │
│  [VER HISTÓRICO COMPLETO DESTE SHOW]                │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  [ZONA POSIÇÕES — modo leitura]                      │
│                                                      │
│  Todas as posições em modo leitura                  │
│  Nenhuma ação disponível — show concluído           │
│                                                      │
│  ◆ Astrid · Bloco 1: Beatriz Lima  ✓ Confirmado    │
│  ◆ Mensageira · Bloco 1: Carlos     ⚠ Sem confirm. │
│  ...                                                │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  [ZONA VERSÕES]                                      │
│                                                      │
│  Este Livro teve 3 versões                          │
│  [VER HISTÓRICO DE VERSÕES]                         │
└─────────────────────────────────────────────────────┘
```

**Regra:** o Livro Executado é somente leitura. Nenhuma ação é possível. Ele existe como registro permanente. A única interação disponível é navegar para o Histórico.

---

## PARTE 3 — S-08 AVISOS

---

### WA-01 — Aviso Simples (Informativo)

*Cenário: WC-01 — Amanda recebe aviso de que sua folga foi aprovada*

---

#### Visão do Membro

```
┌─────────────────────────────────────────────────────┐
│  [ZONA LISTA DE AVISOS]                              │
│                                                      │
│  NÃO LIDOS (1)                                      │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─        │
│  ◆ INFORMATIVO · 17/06 · 18h22                      │
│     Sua solicitação de folga foi aprovada            │
│     21/06 — dia livre                               │
│     [LER]                                           │
│                                                      │
│  LIDOS                                              │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─        │
│  [avisos anteriores...]                             │
└─────────────────────────────────────────────────────┘
```

**Detalhe do Aviso Informativo (ao abrir):**

```
┌─────────────────────────────────────────────────────┐
│  [DETALHE DO AVISO]                                  │
│                                                      │
│  ◆ INFORMATIVO                                       │
│  Sábado, 17/06 · 18h22 · Sistema                   │
│                                                      │
│  Sua solicitação de folga foi aprovada               │
│                                                      │
│  Data da folga: 21/06 (sexta-feira)                 │
│  Aprovada por: Ana Silva                             │
│                                                      │
│  Sua programação foi ajustada.                      │
│  Ver Meu Dia para 21/06                             │
│                                                      │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─        │
│  ◆ Ciência não é necessária — aviso informativo     │
│                                                      │
│  [VER MEU DIA 21/06]    [FECHAR]                    │
└─────────────────────────────────────────────────────┘
```

**Regra:** aviso informativo não tem botão de confirmação. A leitura é o suficiente. O Membro vê, entende, segue em frente.

---

### WA-02 — Aviso Importante

*Cenário: WC-01 — Beatriz recebe aviso de nova alocação*

---

#### Visão do Membro

```
┌─────────────────────────────────────────────────────┐
│  [ZONA LISTA DE AVISOS — Aviso Importante em topo]  │
│                                                      │
│  CONFIRMAÇÃO PENDENTE (1)                           │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─        │
│  ▶ IMPORTANTE · 17/06 · 18h22                       │
│     Sua programação de 21/06 foi alterada           │
│     Musical Grandes Clássicos · 12h30               │
│     ⚡ Confirmar até antes do show                  │
│     [CONFIRMAR]                                     │
│                                                      │
│  NÃO LIDOS · LIDOS                                  │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─        │
│  [avisos anteriores...]                             │
└─────────────────────────────────────────────────────┘
```

**Detalhe do Aviso Importante (ao abrir):**

```
┌─────────────────────────────────────────────────────┐
│  [DETALHE DO AVISO IMPORTANTE]                       │
│                                                      │
│  ▶ IMPORTANTE · Confirmação necessária              │
│  Sábado, 17/06 · 18h22 · Ana Silva (Supervisora)   │
│                                                      │
│  Sua programação de 21/06 foi alterada              │
│                                                      │
│  Musical Grandes Clássicos · 12h30                  │
│                                                      │
│  ┌─────────────────────────────────────────────┐   │
│  │ ERA                 │ AGORA                  │   │
│  │ Não escalada        │ Astrid · Blocos 1 e 4  │   │
│  └─────────────────────────────────────────────┘   │
│                                                      │
│  Entrada: 12h15 · Local: Camarim B                 │
│                                                      │
│  [VER DETALHES DO PAPEL]   [VER LIVRO DO DIA]      │
│                                                      │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─        │
│  ⚡ Você precisa confirmar este aviso               │
│                                                      │
│  ⚡ [CONFIRMAR QUE ENTENDI A ALTERAÇÃO]             │
└─────────────────────────────────────────────────────┘
```

**Regra (D-14):** o delta (ERA / AGORA) aparece antes do botão de confirmação. O botão só está visível após o conteúdo do delta ser exibido na tela. Rolar para ver o botão confirma que o usuário viu o delta.

**Como mostrar impacto individual:** o delta é sempre apresentado na perspectiva do membro — o que mudou para ele, não o que mudou no Livro inteiro.

---

### WA-03 — Alteração Operacional Persistente

*Cenário: WC-03 — Restrição Médica de Beatriz: 4 Livros afetados*

---

#### Visão do Supervisor

```
┌─────────────────────────────────────────────────────┐
│  [ZONA RASTREAMENTO — visão do Supervisor]           │
│                                                      │
│  ⚠ AVISOS COM PENDÊNCIA (4)                         │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─        │
│  ▶ Musical 21/06 · 1 membro pendente               │
│     Beatriz Lima · pendente desde 18h22 (3h atrás) │
│     Show: sábado · 12h30                            │
│     [VER]                                           │
│                                                      │
│  ▶ Ensaio 23/06 · 1 membro pendente               │
│     Carlos Andrade · pendente desde 18h22 (3h atrás)│
│     [VER]                                           │
│                                                      │
│  ▶ Musical 26/06 · 3 membros pendentes             │
│     [VER]                                           │
│                                                      │
│  ▶ Musical 28/06 · 2 membros pendentes             │
│     [VER]                                           │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  [ZONA FILA DE REVISÃO]                              │
│                                                      │
│  ⚡ LIVROS DO DIA COM REVISÃO PENDENTE (4)           │
│  Ordenados por proximidade                           │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─        │
│  ⚡ Musical 21/06 · Em 3 dias · URGENTE             │
│     1 posição Em Aberto                             │
│     [REVISAR AGORA]                                 │
│                                                      │
│  ⚡ Ensaio 23/06 · Em 5 dias                        │
│     2 posições Em Aberto                            │
│     [REVISAR]                                       │
│  ...                                                │
└─────────────────────────────────────────────────────┘
```

**Como mostrar impacto coletivo:**
Para o Supervisor, o impacto coletivo é mostrado como fila de ação — não como lista de nomes. Cada item da fila tem: a atividade, o prazo, o número de posições descobertas. O Supervisor resolve um Livro por vez — a fila organiza a ordem.

---

### WA-04 — Aviso Escalado

*Cenário: WC-05 — Carlos não confirmou, show começa em 1h40*

---

#### Visão do Supervisor

```
┌─────────────────────────────────────────────────────┐
│  [ZONA ALERTA CRÍTICO — topo absoluto]               │
│                                                      │
│  ⚡ AÇÃO NECESSÁRIA AGORA                            │
│                                                      │
│  Carlos Andrade não confirmou                        │
│  Musical 12h30 começa em 1h40min                    │
│                                                      │
│  [VER CONTATO DIRETO]    [VER AVISO]                │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  [ZONA STATUS DO AVISO ESCALADO]                     │
│                                                      │
│  AVISO CRÍTICO #AV-0211                             │
│  Mensageira · Bloco 1 · Musical 12h30               │
│                                                      │
│  Enviado: 17/06 às 18h22                            │
│  Re-notificado: hoje às 10h50 (T-2h automático)    │
│  Re-notificado: hoje às 11h20 (T-1h30 automático)  │
│  Alerta ao Supervisor: hoje às 11h50 (T-1h automático) │
│                                                      │
│  Status de Carlos: não visualizado                  │
│                                                      │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─        │
│  Próxima escalada automática:                        │
│  Se nenhuma ação em 1h10min → alerta ao Admin       │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  [ZONA CONTATO DIRETO]                               │
│                                                      │
│  ◆ Contato direto de Carlos Andrade:                │
│     Telefone: [número]                              │
│                                                      │
│  [REGISTRAR QUE CONTATEI CARLOS]                   │
│  (resolve o rastreamento — Carlos foi avisado)       │
└─────────────────────────────────────────────────────┘
```

**Como evitar fadiga de notificações:**
Para o Membro, o sistema envia no máximo 2 re-notificações automáticas antes de escalar ao Supervisor. Para o Supervisor, o alerta aparece como banner persistente no topo — não como novo Aviso na lista. O rastreamento de urgência é visual e contextual, não uma enxurrada de novos itens.

---

## PARTE 4 — S-11 HISTÓRICO

---

### WH-01 — Consulta Rápida

*Cenário: WC-06 — Supervisora consulta rapidamente o que aconteceu hoje*

```
┌─────────────────────────────────────────────────────┐
│  [ZONA CABEÇALHO + FILTROS]                          │
│                                                      │
│  HISTÓRICO DA OPERAÇÃO                              │
│                                                      │
│  Filtrar por:                                        │
│  [PERÍODO ▾ Hoje]  [MEMBRO ▾]  [TIPO ▾]  [GRUPO ▾] │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  [ZONA RESUMO DO PERÍODO]                            │
│                                                      │
│  ◆ Hoje, 18/06: 3 Mudanças Operacionais             │
│                                                      │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─        │
│  ▶ #MO-0091 · Mudança de Pessoa · hoje 18h22        │
│     Amanda Souza substituída por Beatriz Lima        │
│     Musical 21/06 · 1 posição resolvida             │
│     2 membros notificados · 1 confirmou · 1 pendente│
│     [VER DETALHES]                                  │
│                                                      │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─        │
│  ◆ #MO-0090 · Restrição Médica · hoje 14h10        │
│     Restrição de Beatriz Lima registrada            │
│     19/06 a 30/06 · 4 Livros afetados              │
│     [VER DETALHES]                                  │
│                                                      │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─        │
│  ◆ #MO-0089 · Solicitação · hoje 11h30             │
│     Folga de Amanda Souza aprovada                  │
│     21/06 · Decisão de Ana Silva                    │
│     [VER DETALHES]                                  │
└─────────────────────────────────────────────────────┘
```

**Narrativa, não log:** cada item mostra o que aconteceu em linguagem direta — não código de evento ou ID técnico. O Histórico é lido como uma linha de jornal, não como um relatório de banco de dados.

---

### WH-02 — Investigação de Mudança Operacional

*Cenário: WC-06 — Supervisora investiga MO-0091 completa*

```
┌─────────────────────────────────────────────────────┐
│  [BREADCRUMB]                                        │
│  Histórico › MO-0091                               │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  [ZONA NARRATIVA PRINCIPAL]                          │
│                                                      │
│  #MO-0091 · Mudança de Pessoa                       │
│  Musical Grandes Clássicos · 21/06                  │
│                                                      │
│  ◆ O que aconteceu:                                 │
│  Amanda Souza obteve folga no dia 21/06.            │
│  Beatriz Lima foi alocada em seu lugar nas          │
│  posições de Astrid (Blocos 1 e 4).                │
│  O Livro do Dia foi republicado (v3) às 18h22.     │
│  3 membros foram notificados. 2 confirmaram.        │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  [ZONA LINHA DO TEMPO]                               │
│                                                      │
│  ◆ 17/06 · 11h30 · Amanda solicitou folga          │
│  ◆ 17/06 · 18h10 · Ana Silva aprovou (#MO-0089)   │
│  ◆ 17/06 · 18h20 · Sistema detectou posição Em Aberto │
│  ◆ 17/06 · 18h21 · Ana Silva resolveu: Beatriz    │
│  ◆ 17/06 · 18h22 · Livro republicado v3            │
│  ◆ 17/06 · 18h22 · 3 Avisos enviados               │
│  ◆ 17/06 · 18h40 · Beatriz confirmou               │
│  ◆ 17/06 · 19h05 · Amanda confirmou ciência        │
│  ⚠ 18/06 · 11h00 · Carlos: sem confirmação (20h)  │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  [ZONA LINKS CRUZADOS]                               │
│                                                      │
│  ◆ Livro do Dia afetado:                            │
│     [VER LIVRO DO DIA 21/06 v3]                    │
│                                                      │
│  ◆ MO relacionada (causa):                          │
│     [VER MO-0089 · Folga de Amanda]                │
│                                                      │
│  ◆ Avisos enviados:                                 │
│     [VER AVISO PARA BEATRIZ]                        │
│     [VER AVISO PARA AMANDA]                         │
│     [VER AVISO PARA CARLOS]                         │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  [ZONA CAUSA / DECISÃO / CONSEQUÊNCIA / RESOLUÇÃO]  │
│                                                      │
│  Causa:       Folga aprovada de Amanda Souza        │
│  Decisão:     Ana Silva aloca Beatriz               │
│  Consequência: Beatriz em Astrid · Blocos 1 e 4    │
│  Resolução:   2/3 confirmações · Carlos pendente   │
└─────────────────────────────────────────────────────┘
```

**Como mostrar causa / decisão / consequência / resolução:**
A zona final do detalhe da MO apresenta as quatro dimensões em formato direto. Não é um formulário — é uma síntese narrativa estruturada. Cada elemento é uma linha com rótulo e valor.

---

### WH-03 — Investigação por Membro

*Cenário: WC-07 — Admin investiga Amanda Souza em junho*

```
┌─────────────────────────────────────────────────────┐
│  [ZONA FILTROS ATIVOS]                               │
│                                                      │
│  HISTÓRICO · Filtrando por:                         │
│  [✕ MEMBRO: Amanda Souza]  [✕ PERÍODO: Junho 2026] │
│  [LIMPAR FILTROS]                                   │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  [ZONA RESUMO DO MEMBRO]                             │
│                                                      │
│  ◆ Amanda Souza · Grupo B · Membro                 │
│  ◆ 6 eventos em junho                              │
│  ◆ 2 Solicitações · 1 Restrição · 3 Mudanças       │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  [ZONA LINHA DO TEMPO PESSOAL]                       │
│                                                      │
│  ▶ 14/06 · #MO-0071 · Folga Negada                 │
│     Solicitação de folga 16/06 · Negada por Ana Silva│
│     Motivo: cobertura mínima não garantida          │
│     [VER]                                           │
│                                                      │
│  ◆ 17/06 · #MO-0089 · Folga Aprovada              │
│     Solicitação de folga 21/06 · Aprovada          │
│     Impacto: substituição gerada                    │
│     [VER]                                           │
│                                                      │
│  ◆ 17/06 · #MO-0091 · Substituída                  │
│     Beatriz Lima alocada no seu lugar (Musical 21/06)│
│     [VER]                                           │
│                                                      │
│  ◆ 19/06 · #MO-0094 · Restrição Médica registrada │
│     Período: 19/06 a 30/06                         │
│     Atividades restritas: acrobacia, contorção      │
│     [VER]                                           │
│  ...                                                │
└─────────────────────────────────────────────────────┘
```

---

### WH-04 — Investigação por Atividade

*Cenário: WC-07 — Admin investiga todos os shows de sábado em junho*

```
┌─────────────────────────────────────────────────────┐
│  [ZONA FILTROS ATIVOS]                               │
│                                                      │
│  HISTÓRICO · Filtrando por:                         │
│  [✕ ATIVIDADE: Musicais de Sábado]  [✕ PERÍODO: Junho] │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  [ZONA PADRÃO DETECTADO — IA]                        │
│                                                      │
│  ▶ Padrão identificado pela IA:                     │
│                                                      │
│  "3 dos 4 musicais de sábado em junho tiveram       │
│  posição Em Aberto em algum momento. Em todos os    │
│  casos, a posição era Astrid (Bloco 1). A causa     │
│  recorrente foi folga ou restrição da mesma          │
│  membro: Amanda Souza."                             │
│                                                      │
│  [VER ANÁLISE COMPLETA]                             │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  [ZONA ATIVIDADES]                                   │
│                                                      │
│  Musical 07/06 · 12h30 · 0 posições Em Aberto       │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─        │
│  ⚠ Musical 14/06 · 12h30 · 1 posição Em Aberto     │
│     Resolvida em 12/06 · Astrid · Amanda → Beatriz  │
│     [VER]                                           │
│                                                      │
│  ⚠ Musical 21/06 · 12h30 · 2 posições Em Aberto   │
│     Resolvidas em 17/06                             │
│     [VER]                                           │
│                                                      │
│  ⚠ Musical 28/06 · 12h30 · 1 posição Em Aberto    │
│     Ainda em aberto · Restrição de Amanda até 30/06 │
│     [VER]                                           │
└─────────────────────────────────────────────────────┘
```

---

### WH-05 — Investigação por Período

*Cenário: WC-07 — Admin revisa toda a semana de 17–23/06*

```
┌─────────────────────────────────────────────────────┐
│  [ZONA FILTROS]                                      │
│                                                      │
│  HISTÓRICO · Filtrando por:                         │
│  [✕ PERÍODO: 17/06 a 23/06]                         │
│                                                      │
│  [AGRUPAR POR: Tipo ▾]  [ORDENAR POR: Data ▾]      │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  [ZONA RESUMO DO PERÍODO]                            │
│                                                      │
│  ◆ 17/06 a 23/06                                   │
│  ◆ 12 Mudanças Operacionais                        │
│  ◆ 4 Folgas · 2 Restrições · 3 Substituições · 3 Livros │
│  ◆ 8 Avisos Críticos · 24 Avisos Importantes       │
│  ◆ Confirmações: 96% (média da semana)             │
│  ⚠ Sem confirmação: 2 casos (Carlos Andrade · 2x)  │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  [ZONA LINHA DO TEMPO DA SEMANA]                     │
│                                                      │
│  17/06 (segunda)                                    │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─        │
│  · #MO-0089 · Folga Amanda · aprovada              │
│  · #MO-0090 · Restrição Beatriz · registrada       │
│  · #MO-0091 · Substituição Musical 21/06            │
│                                                      │
│  18/06 (terça)                                      │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─        │
│  · #MO-0092 · Livro Ensaio 20/06 publicado         │
│  ...                                                │
└─────────────────────────────────────────────────────┘
```

---

## PARTE 5 — TRAVESSIAS

---

### T-01 — Livro → Aviso

**Gatilho:** Supervisor está no Livro do Dia e quer ver o rastreamento de confirmações.

```
[LIVRO DO DIA — Zona Posições]
  ◆ Astrid · Beatriz Lima · Pendente
              ↑
              [VER AVISO DE BEATRIZ]
                        │
                        ▼
[AVISO — Detalhe do Aviso para Beatriz]
  [BREADCRUMB: Livro do Dia 21/06 › Aviso de Beatriz]
  Aviso Importante · Beatriz Lima
  Status: Pendente · enviado há 3h
  [← VOLTAR AO LIVRO DO DIA 21/06]
```

| Preservado | Mudado | Nunca pode perder |
|---|---|---|
| Qual Livro e data | A superfície ativa | Qual membro estava sendo rastreado |
| A versão do Livro | A zona de conteúdo | O contexto de confirmação pendente |

---

### T-02 — Aviso → Livro

**Gatilho:** Membro lê o Aviso e quer ver os detalhes do Livro do Dia.

```
[AVISO — Detalhe do Aviso Importante]
  ▶ Sua programação de 21/06 foi alterada
  ERA: Mensageira → AGORA: Astrid
              [VER LIVRO DO DIA 21/06]
                        │
                        ▼
[LIVRO DO DIA — Fatia do Membro]
  [BREADCRUMB: Avisos › Aviso 17/06 › Livro do Dia 21/06]
  Seu papel: Astrid · Blocos 1, 2 e 4
  [← VOLTAR AO AVISO]
  [CONFIRMAR ALTERAÇÃO] ← botão de confirmação disponível aqui também
```

| Preservado | Mudado | Nunca pode perder |
|---|---|---|
| Qual Aviso originou a navegação | A superfície ativa | O botão de confirmação (disponível em ambas as superfícies) |
| Status de pendência de confirmação | O contexto de visualização | O delta (era → agora) |

**Regra:** confirmação pode acontecer no Aviso ou no Livro — onde o Membro estiver. A confirmação em um lugar sincroniza automaticamente o outro. O Membro nunca precisa confirmar duas vezes o mesmo evento.

---

### T-03 — Aviso → Histórico

**Gatilho:** Supervisor quer entender por que um Aviso foi enviado.

```
[AVISO — Detalhe do Aviso #AV-0211]
  ▶ Carlos Andrade · Mensageira · Musical 21/06
              [VER MUDANÇA OPERACIONAL COMPLETA]
                        │
                        ▼
[HISTÓRICO — Detalhe da MO-0091]
  [BREADCRUMB: Avisos › Aviso #AV-0211 › MO-0091]
  Causa: Folga de Amanda → Beatriz alocada → Carlos notificado
  [← VOLTAR AO AVISO #AV-0211]
```

| Preservado | Mudado | Nunca pode perder |
|---|---|---|
| Qual Aviso originou a navegação | A superfície ativa | A cadeia causal que gerou o Aviso |
| Contexto de confirmação pendente | A profundidade de detalhe | |

---

### T-04 — Livro → Histórico

**Gatilho:** Supervisor quer entender por que o Livro foi republicado 3 vezes.

```
[LIVRO DO DIA v3 — Zona Cabeçalho]
  ✓ PUBLICADO v3 · por Ana Silva · 17/06
  [VER VERSÕES ANTERIORES ▾]
  v2 → v3: Amanda substituída por Beatriz [VER MUDANÇA]
                        │
                        ▼
[HISTÓRICO — Detalhe da MO-0091]
  [BREADCRUMB: Livro do Dia 21/06 › MO-0091]
  O que levou à v3: Folga de Amanda aprovada → posição Em Aberto → Beatriz alocada → v3 publicada
  [← VOLTAR AO LIVRO DO DIA 21/06]
```

| Preservado | Mudado | Nunca pode perder |
|---|---|---|
| Qual Livro e versão originou a navegação | A superfície ativa | A versão específica do Livro sendo analisada |
| | | O vínculo entre versão e MO que a causou |

---

### T-05 — Meu Dia → Aviso

**Gatilho:** Membro está no Meu Dia, vê card de alteração, quer ver todos os Avisos.

```
[MEU DIA — Card de Alteração no Topo]
  ▶ Sua programação de 21/06 mudou
  Era: Mensageira → Agora: Astrid
  [CONFIRMAR]  [VER TODOS OS AVISOS]
                        │
                        ▼
[AVISOS — Lista com foco no Aviso pendente]
  [BREADCRUMB: Meu Dia › Avisos]
  CONFIRMAÇÃO PENDENTE (1) ← com foco visual neste aviso
  ▶ IMPORTANTE · 17/06 · Sua programação de 21/06 foi alterada
  [CONFIRMAR]
  [← VOLTAR AO MEU DIA]
```

| Preservado | Mudado | Nunca pode perder |
|---|---|---|
| O estado de pendência de confirmação | A superfície ativa | O card de alteração no Meu Dia (continua lá ao voltar) |
| Qual aviso está pendente | O contexto de lista | |

---

### T-06 — Painel Operacional → Livro

**Gatilho:** Supervisor vê badge "1 Livro desatualizado" no Painel e vai direto ao Livro.

```
[PAINEL OPERACIONAL]
  ⚠ 1 Livro do Dia desatualizado
  Musical 21/06 · 2 posições Em Aberto
  [REVISAR AGORA]
                        │
                        ▼
[LIVRO DO DIA 21/06 — estado DESATUALIZADO]
  [BREADCRUMB: Painel Operacional › Livro do Dia 21/06]
  ⚠ LIVRO DESATUALIZADO
  Cobertura: 10/12 · 2 Em Aberto
  [← VOLTAR AO PAINEL]
```

| Preservado | Mudado | Nunca pode perder |
|---|---|---|
| Qual alerta originou a navegação | A superfície ativa | O estado de urgência (Livro desatualizado) |
| O contexto de "qual Livro" | A visão de múltiplos Livros | |

**Regra de foco:** ao chegar no Livro via Painel, o Livro abre diretamente nas posições Em Aberto — não no topo do Livro. O Supervisor é levado diretamente ao problema, sem precisar rolar.

---

## PARTE 6 — AUDITORIA DE WIREFRAME

---

### 1. Existe duplicação visual?

**Risco identificado:** o delta de uma mudança aparece em S-08 (Aviso) e também em S-05 (Livro republicado). São duas representações da mesma mudança.

**Avaliação:** não é duplicação — são perspectivas distintas. O Aviso mostra o delta na **perspectiva do membro** ("o que mudou para você"). O Livro mostra o delta na **perspectiva do documento** ("o que mudou em relação à versão anterior"). O conteúdo se sobrepõe mas os frames de referência são diferentes.

**Mitigação no wireframe:** a linguagem usada nos dois contextos é diferente. No Aviso: "Seu papel mudou de X para Y." No Livro: "Posição Z: Amanda → Beatriz." Diferentes atores, diferentes ênfases.

**Veredito:** ✅ Sem duplicação prejudicial.

---

### 2. Existe contexto perdido?

**Risco identificado:** nas travessias T-01 a T-06, o breadcrumb resolve o contexto de navegação. Mas existe um caso não coberto: o usuário navega de S-11 → S-05 → S-08 (três superfícies em sequência). O breadcrumb de S-08 mostra apenas o passo imediato anterior (S-05), não a origem da investigação (S-11).

**Mitigação:** o breadcrumb deve ser empilhado — não apenas um nível. "Histórico › MO-0091 › Livro do Dia 21/06 › Aviso #AV-0211". O usuário vê a cadeia completa e pode voltar a qualquer ponto.

**Veredito:** ✅ Resolvido com breadcrumb empilhado.

---

### 3. Existe investigação interrompida?

**Risco identificado:** na investigação WH-04 (por atividade), o Admin identifica um padrão recorrente. A IA gera o padrão, mas o Admin pode não saber como agir sobre ele — a investigação encontra o problema mas não apresenta o próximo passo.

**Mitigação no wireframe:** após o padrão detectado pela IA, o Histórico apresenta:
- O que o padrão significa operacionalmente
- Qual superfície permite agir sobre isso (ex.: "Configurar o papel Astrid no Livro do Show com cobertura dupla")
- Um link para essa ação (se disponível)

**Veredito:** ✅ Resolvido com ação sugerida após padrão.

---

### 4. Existe navegação desnecessária?

**Risco identificado:** o Membro precisa confirmar um Aviso Importante. O fluxo documentado permite confirmar no Meu Dia, no Aviso ou no Livro do Dia. Três superfícies com o mesmo botão de confirmação podem gerar confusão sobre qual usar.

**Avaliação:** não é navegação desnecessária — é confirmação onde o usuário está. A regra é: o Membro confirma onde está. O sistema não direciona o Membro para uma superfície específica para confirmar. Onde ele vir o botão, ele confirma.

**Veredito:** ✅ Intencional. Navegação reduz, não aumenta — o Membro não precisa trocar de superfície para confirmar.

---

### 5. Existe risco de membro não entender a mudança?

**Risco identificado:** o delta (ERA → AGORA) é mostrado antes do botão de confirmação (D-14). Mas se o delta for muito técnico ("Papel ID #4712 alterado de PosType-A para PosType-B"), o membro não entende.

**Mitigação no wireframe:** o delta usa linguagem operacional, não técnica. Nunca IDs, nunca códigos. Sempre: nome do papel, nome do bloco, horário de entrada. "Era: Mensageira · Blocos 1 e 4 → Agora: Astrid · Blocos 1, 2 e 4."

**Veredito:** ✅ Mitigável por regra de linguagem no conteúdo do delta.

---

### 6. Existe risco de supervisor perder rastreabilidade?

**Risco identificado:** em WC-02 (5 membros afetados), o Supervisor precisa rastrear 5 confirmações simultâneas. Se as confirmações chegarem em momentos diferentes, o estado do painel de rastreamento muda constantemente — difícil de acompanhar.

**Mitigação no wireframe (WA-03, visão do Supervisor):** o rastreamento agrupa por urgência, não por ordem de chegada. Os não-confirmados ficam em topo. Os confirmados descem para a lista inferior. O Supervisor sempre vê quem falta — não quem já confirmou.

**Veredito:** ✅ Resolvido por ordenação por urgência.

---

### 7. Existe risco de admin perder narrativa?

**Risco identificado:** em WC-07 (investigação por período), o Admin vê 12 Mudanças Operacionais em uma semana. Se cada MO for apresentada como item independente, a narrativa da semana como um todo se perde — parece uma lista de eventos, não uma história.

**Mitigação no wireframe (WH-05):** o resumo do período aparece antes da lista — com números consolidados e padrões já destacados. O Admin lê o resumo e depois desce ao detalhe se necessário. A narrativa da semana existe antes da narrativa de cada MO.

**Veredito:** ✅ Resolvido com resumo de período como primeiro conteúdo.

---

### 8. Existe risco de Livro e Aviso divergirem?

**Risco identificado:** janela de divergência entre APLICADA e PUBLICADA (documentada no Ciclo de Comunicação Operacional). Durante essa janela, o Livro está desatualizado mas nenhum Aviso foi enviado ainda.

**Mitigação no wireframe:** o Livro em estado DESATUALIZADO mostra claramente que os Avisos ainda não foram enviados. A sequência obrigatória é: Supervisor resolve → Supervisor aprova → Livro publicado → Avisos enviados automaticamente. Não existe Aviso antes da publicação. Não existe publicação sem o Livro ter sido revisado. A sincronização é garantida pela sequência do fluxo — não por checagem manual.

**Veredito:** ✅ Divergência impossível por design de fluxo.

---

## PARTE 7 — VEREDITO

---

### Cobertura dos cenários obrigatórios

| Cenário | Superfícies cobertas | Status |
|---|---|---|
| WC-01 · Mudança simples | WL-01, WL-02, WL-03, WA-01, WA-02, WH-02 | ✅ |
| WC-02 · 5 membros afetados | WA-03, WH-05 | ✅ |
| WC-03 · Mudança persistente | WL-02, WA-03 | ✅ |
| WC-04 · Livro republicado | WL-03, WH-02 | ✅ |
| WC-05 · Membro sem confirmação | WA-04, T-01 | ✅ |
| WC-06 · Investigação Supervisor | WH-01, WH-02, T-04, T-06 | ✅ |
| WC-07 · Investigação Admin | WH-03, WH-04, WH-05 | ✅ |

---

### Wireframes produzidos

| ID | Nome | Perfil | Cenários |
|---|---|---|---|
| WL-01 | Livro Publicado | SUP, MEM | WC-01 |
| WL-02 | Livro Desatualizado | SUP, MEM | WC-01, WC-03 |
| WL-03 | Livro Republicado | SUP, MEM | WC-04 |
| WL-04 | Livro Executado | SUP | WC-01, WC-04 |
| WA-01 | Aviso Informativo | MEM | WC-01 |
| WA-02 | Aviso Importante | MEM | WC-01 |
| WA-03 | Alteração Persistente | SUP | WC-02, WC-03 |
| WA-04 | Aviso Escalado | SUP | WC-05 |
| WH-01 | Consulta Rápida | SUP | WC-06 |
| WH-02 | Investigação de MO | SUP, ADM | WC-06 |
| WH-03 | Investigação por Membro | ADM | WC-07 |
| WH-04 | Investigação por Atividade | ADM | WC-07 |
| WH-05 | Investigação por Período | ADM | WC-07 |

---

### Travessias mapeadas

| ID | Travessia | Contexto preservado |
|---|---|---|
| T-01 | Livro → Aviso | Livro + versão + membro rastreado |
| T-02 | Aviso → Livro | Aviso de origem + estado de confirmação |
| T-03 | Aviso → Histórico | Aviso + MO completa |
| T-04 | Livro → Histórico | Livro + versão + MO causal |
| T-05 | Meu Dia → Aviso | Estado de pendência + card de alteração |
| T-06 | Painel Operacional → Livro | Alerta de origem + foco nas posições Em Aberto |

---

### Decisões de wireframe produzidas

| # | Decisão |
|---|---|
| WF-01 | Cobertura (X/Y posições) é sempre o primeiro elemento na visão do Supervisor no Livro — antes dos nomes |
| WF-02 | Posições inalteradas ficam colapsadas no Livro Desatualizado — o Supervisor age sobre o problema sem re-ler o Livro inteiro |
| WF-03 | No Livro Republicado, a zona Delta aparece antes da lista de posições — o Supervisor entende o que mudou antes de ver o estado atual |
| WF-04 | O Membro nunca vê o Livro completo por padrão — sua fatia (seu papel) é o padrão |
| WF-05 | No Aviso Importante, a tabela ERA / AGORA aparece antes do botão de confirmação — sempre |
| WF-06 | No rastreamento de confirmações (Supervisor), não-confirmados ficam em topo; confirmados descem |
| WF-07 | Breadcrumb empilhado em toda navegação cruzada — o usuário vê a cadeia completa, não apenas o passo anterior |
| WF-08 | Ao chegar no Livro via Painel Operacional, o foco vai direto às posições Em Aberto — não ao topo do Livro |
| WF-09 | No Histórico, o Resumo do Período aparece antes da lista de MOs — a narrativa da semana/dia é sempre o primeiro contexto |
| WF-10 | Padrão detectado pela IA no Histórico sempre apresenta uma ação possível após a análise |

---

### Auditoria de conformidade com decisões anteriores

| Decisão | Aplicada nos wireframes? |
|---|---|
| D-11 · Livro não editado silenciosamente | ✅ WL-03: zona de histórico de versões, delta destacado |
| D-12 · Avisos automáticos | ✅ WA-02: "18h22 · Sistema" (não "por Ana Silva") |
| D-13 · Nível determinado pelo sistema | ✅ WA-04: Supervisor não pode alterar nível do Aviso |
| D-14 · Delta antes do botão | ✅ WA-02, WL-03: botão sempre após a tabela ERA/AGORA |
| D-15 · Revogação = Crítico | ✅ WA-04: nível Crítico inegociável |
| D-16 · Consolidação de republicações | ✅ WA-02: regra de agrupamento de avisos em janela de tempo |
| D-17 · Protocolo de contato direto | ✅ WA-04: zona de contato direto com botão "Registrar que contatei" |
| D-18 · Tags de exigência operacional | ✅ WH-02: conflito de restrição identificado por ausência de tag |
| D-19 · Data de vigência nas Mudanças de Estrutura | ✅ WH-03: restrição com período definido |
| D-20 · Edições diretas com motivo | ✅ WL-03: toda versão tem "por [nome] às [hora]" |
| UX-01 · S-08 diferentes para Membro e Supervisor | ✅ WA-01–WA-04: visões completamente distintas |
| UX-02 · Confirmação não exige S-08 | ✅ T-02: botão de confirmação disponível no Livro do Dia |
| UX-03 · Versão mais recente como padrão | ✅ WL-03: versões antigas sob demanda, v mais recente como padrão |
| UX-04 · Breadcrumb obrigatório | ✅ T-01 a T-06: breadcrumb em toda travessia |
| UX-05 · Filtros persistentes | ✅ WH-03, WH-04: filtros ativos exibidos permanentemente |
| UX-06 · Aviso mostra apenas delta do membro | ✅ WA-02: delta na perspectiva do membro |
| UX-07 · Histórico vincula, não replica | ✅ WH-02: zona de links cruzados, não cópia do conteúdo |
| UX-08 · Hierarquia dinâmica por urgência | ✅ WA-04: alerta crítico sobe ao topo absoluto |
| UX-09 · Investigação parte de S-11 | ✅ WH-01–WH-05: S-11 como ponto de partida de toda investigação |
| UX-10 · Avisos críticos não arquiváveis | ✅ WA-04: sem opção de arquivar ou minimizar aviso crítico |

---

## 🟢 Pronto para Mockup

S-05 Livro do Dia, S-08 Avisos e S-11 Histórico têm wireframes estruturais completos para todos os estados relevantes, com:

- **13 wireframes** cobrindo os 4 estados do Livro, os 4 estados de Aviso e os 5 modos de investigação do Histórico
- **6 travessias** com contexto preservado mapeado e regras de breadcrumb definidas
- **7 cenários obrigatórios** cobertos por pelo menos 2 wireframes cada
- **20 decisões de design (D-11–D-20 + UX-01–UX-10)** verificadas e aplicadas
- **10 novas decisões de wireframe (WF-01–WF-10)** que guiarão os mockups visuais
- **8 pontos de auditoria** verificados sem problema estrutural remanescente

As três superfícies foram projetadas como perspectivas de uma única realidade operacional — não como módulos independentes.

---

*Documento elaborado por Product Designer Sênior — MyASA 2.0*
*Base: Arquitetura · Entidade MO · Ciclo de Planejamento · Ciclo de Comunicação · UX Integrado · Bloco 1 · S-06 · D-01–D-20 · UX-01–UX-10*
