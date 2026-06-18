# MyASA 2.0 — Wireframes Estruturais do S-13 Livro do Show

> **Versão:** 18/06/2026
> **Fase:** Wireframe Estrutural — anterior a mockups visuais
> **Base:** Recuperação Arquitetural · Fechamento de Lacunas (LS-D01–LS-D05) · Arquitetura · Entidade MO · Ciclo de Planejamento · Ciclo de Comunicação · Bloco 1 · D-01–D-20 · UX-01–UX-10 · WF-01–WF-10 · AU-01–AU-04 · LS-C01–LS-C12
> **Escopo:** S-13 Livro do Show — template permanente do espetáculo
> **Status:** 🟢 Pronto para Mockup

---

## Convenções deste documento

```
┌─────────────────────────────┐   Zona de conteúdo
│  [RÓTULO DA ZONA]           │   Título da zona em maiúsculas
│                             │
│  · Item de conteúdo         │   Conteúdo dentro da zona
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │   Divisor interno
│  [AÇÃO]                     │   Elemento interativo
└─────────────────────────────┘

▶ Elemento prioritário / atenção imediata
◆ Elemento informativo / contextual
⚡ Elemento de ação obrigatória
⚠ Elemento de alerta / estado degradado
✓ Elemento confirmado / sem pendência
🔒 Somente Admin — bloqueado para Supervisor
✏ Configuração — Admin ou Supervisor (Tipo B)
👁 Somente leitura para Supervisor neste contexto

Perfis:
  ADM = Admin     SUP = Supervisor

Marcadores de permissão inline:
  [🔒 Admin]  = ação somente Admin
  [✏ Config]  = configuração permitida ao Supervisor
  [👁 Leitura] = Supervisor só pode ver
```

---

## PARTE 1 — CENÁRIOS OBRIGATÓRIOS

Os 10 cenários definem os estados que os wireframes devem suportar.

---

**WS-01 — Consulta simples de Show**
> Admin ou Supervisor abre o Livro do Show para entender a estrutura. Sem intenção de editar.
> Cobre: WLV-01, hierarquia geral, wireframes WLS-01 e WLS-02.

**WS-02 — Navegação Show → Cena → Bloco → Posição → Linha**
> Usuário navega do nível mais alto até a menor unidade para entender ou editar.
> Cobre: WLS-01 a WLS-05, breadcrumb, preservação de contexto.

**WS-03 — Edição de configuração permitida**
> Supervisor troca a pessoa numa Linha tipo "Pessoa fixa" (Tipo B — Configuração).
> Cobre: WLE-01 — edição de configuração com campo de motivo.

**WS-04 — Tentativa de alteração estrutural**
> Supervisor tenta adicionar uma nova Posição (Tipo A — Estrutural) e descobre que precisa solicitar ao Admin.
> Cobre: WLE-02 — bloqueio de estrutural e Solicitação Administrativa.

**WS-05 — Mudança em tags operacionais**
> Admin aplica tag CAT-04 (Médica — inviolável) em uma Posição. Supervisor consulta mas não pode editar.
> Cobre: WLT-01, WLT-02 — consulta e edição de tags.

**WS-06 — Mudança de versão do Livro do Show**
> Admin remove uma Cena → nova versão criada. Sistema gera delta v1 → v2.
> Cobre: WLV-02 — comparação de versões.

**WS-07 — Livros futuros impactados**
> Após mudança de versão, 3 Livros do Dia futuros são sinalizados como TEMPLATE DESATUALIZADO.
> Cobre: WLV-03, WLV-04 — estado e fila de revisão.

**WS-08 — Linha Em Aberto por design**
> Linha tipo "Dia da Semana" com Padrão = Em Aberto. Show ocorre em dia sem mapeamento → Em Aberto esperado.
> Cobre: WLS-05, contexto de Em Aberto por design.

**WS-09 — Linha Em Aberto por configuração ausente**
> Linha tipo "Dia da Semana" sem campo Padrão configurado. Show ocorre em dia sem mapeamento → Em Aberto por omissão.
> Cobre: WLS-05, alerta de configuração incompleta distinto de WS-08.

**WS-10 — Auditoria de histórico do Show**
> Admin investiga quem removeu a Cena 3 e quando. Quais Livros do Dia futuros foram afetados por aquela mudança.
> Cobre: WLH-01 — histórico do Livro do Show.

---

## PARTE 2 — VISÃO GERAL DO SHOW (WLV-01)

---

### WLV-01 — Visão Geral do Show

*Cenários: WS-01 · WS-07*
*Perfis: ADM (gestão) · SUP (consulta)*

---

#### Visão do Admin

```
┌─────────────────────────────────────────────────────┐
│  [ZONA CABEÇALHO DO SHOW]                            │
│                                                      │
│  Musical Grandes Clássicos                           │
│  Modelo: Estruturado · v3 · atualizada em 18/06     │
│                                                      │
│  [VER HISTÓRICO DE VERSÕES]    [EDITAR SHOW] [🔒]   │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  [ZONA SAÚDE DO TEMPLATE]  ← primeira informação    │
│                                                      │
│  ◆ Estrutura completa · 0 Linhas abertas por design │
│  ◆ 0 Linhas com configuração ausente                │
│                                                      │
│  ⚠ LIVROS FUTUROS COM TEMPLATE DESATUALIZADO (3)    │
│     Musical 21/06 · Musical 28/06 · Ensaio 23/06    │
│     [VER LIVROS AFETADOS]                           │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  [ZONA ESTRUTURA — resumo]                           │
│                                                      │
│  ◆ 3 Cenas · 8 Blocos · 12 Posições · 18 Linhas    │
│                                                      │
│  CENA 1 — Abertura              [🔒 Admin] [ABRIR ▶]│
│  2 Blocos · 4 Posições · 6 Linhas                   │
│  ✓ Configuração completa                            │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─        │
│  CENA 2 — Desenvolvimento       [🔒 Admin] [ABRIR ▶]│
│  4 Blocos · 6 Posições · 8 Linhas                   │
│  ⚠ 1 Linha com configuração incompleta              │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─        │
│  CENA 3 — Encerramento          [🔒 Admin] [ABRIR ▶]│
│  2 Blocos · 2 Posições · 4 Linhas                   │
│  ✓ Configuração completa                            │
│                                                      │
│  [🔒 ADICIONAR CENA] [🔒 Admin exclusivo]           │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  [ZONA AÇÕES DO ADMIN]                               │
│                                                      │
│  [VER TODOS OS LIVROS DO DIA GERADOS DESTE SHOW]   │
│  [VER ANÁLISE DE COBERTURA HISTÓRICA]  ← IA        │
└─────────────────────────────────────────────────────┘
```

**O que o Admin vê primeiro:** saúde do template (linhas abertas, configuração ausente, livros futuros afetados). Segundo: resumo estrutural (contagem). Terceiro: a hierarquia de Cenas com status individual.

---

#### Visão do Supervisor

```
┌─────────────────────────────────────────────────────┐
│  [ZONA CABEÇALHO DO SHOW]                            │
│                                                      │
│  Musical Grandes Clássicos                           │
│  Modelo: Estruturado · v3 · atualizada em 18/06     │
│                                                      │
│  👁 Somente leitura — alterações via Admin          │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  [ZONA SAÚDE DO TEMPLATE — simplificada]             │
│                                                      │
│  ⚠ 3 Livros futuros com template desatualizado      │
│     [VER QUAIS LIVROS PRECISAM DE REVISÃO]          │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  [ZONA ESTRUTURA]                                    │
│                                                      │
│  ◆ 3 Cenas · 8 Blocos · 12 Posições · 18 Linhas    │
│                                                      │
│  CENA 1 — Abertura                          [ABRIR] │
│  CENA 2 — Desenvolvimento                   [ABRIR] │
│  CENA 3 — Encerramento                      [ABRIR] │
│                                                      │
│  Linhas configuráveis por você: 6           [VER ▶] │
│  (Tipo B — Configuração · com motivo obrigatório)   │
└─────────────────────────────────────────────────────┘
```

**Regra de hierarquia para o Supervisor:** o Supervisor vê a estrutura completa mas com permissões explicitamente marcadas. A seção "Linhas configuráveis por você" agrupa as Linhas onde o Supervisor pode agir — sem que precise descobrir navegando toda a hierarquia.

---

## PARTE 3 — NAVEGAÇÃO HIERÁRQUICA

---

### WLS-01 — Nível Show

*Cenários: WS-01 · WS-02*

```
┌─────────────────────────────────────────────────────┐
│  [BREADCRUMB]                                        │
│  Livros do Show › Musical Grandes Clássicos          │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  [ZONA IDENTIDADE DO SHOW]                           │
│                                                      │
│  ◆ Nome: Musical Grandes Clássicos                  │
│  ◆ Modelo: Estruturado                              │
│  ◆ Versão: v3                          [🔒 Admin]   │
│  ◆ Duração estimada: 90 min                         │
│  ◆ Criado por: Admin Ricardo · 01/03/2026           │
│  ◆ Última edição: Ana Silva (Supervisor) · 18/06    │
│                                                      │
│  [🔒 EDITAR IDENTIDADE DO SHOW]                     │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  [ZONA MAPA DE CENAS]                                │
│                                                      │
│  Cenas neste Show: 3                                │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─        │
│  [1] Abertura          2B · 4P · 6L    [ABRIR ▶]   │
│  [2] Desenvolvimento   4B · 6P · 8L    [ABRIR ▶]   │
│  [3] Encerramento      2B · 2P · 4L    [ABRIR ▶]   │
│                                                      │
│  B = Blocos · P = Posições · L = Linhas             │
│                                                      │
│  [🔒 ADICIONAR CENA]   [🔒 REORDENAR CENAS]        │
└─────────────────────────────────────────────────────┘
```

---

### WLS-02 — Nível Cena

*Cenários: WS-02 · WS-06*

```
┌─────────────────────────────────────────────────────┐
│  [BREADCRUMB]                                        │
│  Livros do Show › Musical Grandes Clássicos › Cena 1 — Abertura │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  [ZONA IDENTIDADE DA CENA]                           │
│                                                      │
│  ◆ Cena 1 — Abertura                               │
│  ◆ Opcional? Não — esta cena sempre acontece        │
│  ◆ Ordem: posição 1 de 3                           │
│                                                      │
│  [🔒 RENOMEAR CENA]   [🔒 REMOVER CENA]            │
│  [🔒 MARCAR COMO OPCIONAL]                          │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  [ZONA BLOCOS DESTA CENA]                            │
│                                                      │
│  Blocos nesta Cena: 2                               │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─        │
│  Bloco 1.1 · 12h30–13h00   2P · 3L    [ABRIR ▶]   │
│  Bloco 1.2 · 13h00–13h45   2P · 3L    [ABRIR ▶]   │
│                                                      │
│  [✏ REORDENAR BLOCOS]   [🔒 ADICIONAR BLOCO]       │
└─────────────────────────────────────────────────────┘
```

**Regra de navegação:** o breadcrumb é empilhado em toda navegação hierárquica — o usuário sempre sabe onde está e pode voltar a qualquer nível. Isso aplica a mesma regra WF-07 dos wireframes do Ciclo de Comunicação.

---

### WLS-03 — Nível Bloco

*Cenários: WS-02*

```
┌─────────────────────────────────────────────────────┐
│  [BREADCRUMB]                                        │
│  Livros do Show › Musical… › Cena 1 › Bloco 1.1 · 12h30–13h00 │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  [ZONA IDENTIDADE DO BLOCO]                          │
│                                                      │
│  ◆ Bloco 1.1                                        │
│  ◆ Horário padrão: 12h30–13h00                     │
│  ◆ Posições neste bloco: 2                         │
│                                                      │
│  [🔒 EDITAR HORÁRIO]   [🔒 REMOVER BLOCO]          │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  [ZONA POSIÇÕES]                                     │
│                                                      │
│  POSIÇÃO 1 — Astrid                     [ABRIR ▶]  │
│  Tipo de Linha: Titular + Substituto                │
│  Tags: CAT-07 (habilitado para Astrid)              │
│        CAT-03 (extensão lombar extrema) ✏          │
│  Linha configurada: ✓                               │
│                                                      │
│  POSIÇÃO 2 — Mensageira                 [ABRIR ▶]  │
│  Tipo de Linha: Rodízio                             │
│  Tags: CAT-07 (habilitado para Mensageira)          │
│  Linha configurada: ✓                               │
│                                                      │
│  [🔒 ADICIONAR POSIÇÃO]                             │
└─────────────────────────────────────────────────────┘
```

---

### WLS-04 — Nível Posição

*Cenários: WS-02 · WS-05*

```
┌─────────────────────────────────────────────────────┐
│  [BREADCRUMB]                                        │
│  Livros do Show › … › Bloco 1.1 › Posição: Astrid  │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  [ZONA IDENTIDADE DA POSIÇÃO]                        │
│                                                      │
│  ◆ Posição: Astrid                                  │
│  ◆ No Bloco: 1.1 · 12h30–13h00                    │
│                                                      │
│  [🔒 RENOMEAR]   [🔒 REMOVER POSIÇÃO]               │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  [ZONA TAGS DE EXIGÊNCIA]  ← segunda informação     │
│                                                      │
│  Tags aplicadas a esta Posição:                     │
│                                                      │
│  CAT-07 · Personagem                                │
│  ◆ habilitado para Astrid               [✏ Config] │
│                                                      │
│  CAT-03 · Exigência Física                          │
│  ◆ extensão lombar extrema              [✏ Config] │
│  ◆ carga cardiovascular alta            [✏ Config] │
│                                                      │
│  CAT-04 · Exigência Médica                          │
│  ◆ liberação médica para acrobacia      [🔒 Admin] │
│                                                      │
│  [✏ ADICIONAR TAG — CAT-01 a CAT-03 · CAT-07 a CAT-09] │
│  [🔒 ADICIONAR TAG — CAT-04 · CAT-05 · CAT-06 · CAT-10] │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  [ZONA LINHAS]                                       │
│                                                      │
│  1 Linha nesta Posição:                             │
│  Tipo: Titular + Substituto             [ABRIR ▶]  │
│  Titular: Amanda Souza        [✏ Config]            │
│  Substituto: Beatriz Lima     [✏ Config]            │
│                                                      │
│  [🔒 ADICIONAR LINHA]   [🔒 MUDAR TIPO DE LINHA]   │
└─────────────────────────────────────────────────────┘
```

**Regra de design:** na Posição, as tags aparecem antes das Linhas — porque as tags definem o contexto de quem pode estar naquela posição. O usuário entende a "exigência" antes de ver "quem está configurado para cumpri-la".

---

### WLS-05 — Nível Linha

*Cenários: WS-02 · WS-03 · WS-08 · WS-09*

---

#### Linha tipo Titular + Substituto

```
┌─────────────────────────────────────────────────────┐
│  [BREADCRUMB]                                        │
│  Livros do Show › … › Posição: Astrid › Linha       │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  [ZONA IDENTIDADE DA LINHA]                          │
│                                                      │
│  ◆ Tipo: Titular + Substituto          [🔒 Admin]   │
│  ◆ Resolução: automática                            │
│  ◆ Lógica: Titular em primeiro; Substituto se Titular│
│             indisponível; Em Aberto se ambos         │
│             indisponíveis                            │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  [ZONA CONFIGURAÇÃO]                                 │
│                                                      │
│  Titular:    Amanda Souza              [✏ EDITAR]   │
│  Substituto: Beatriz Lima             [✏ EDITAR]    │
│                                                      │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─        │
│  ◆ Candidatos que atendem às tags desta Posição: 4  │
│     (Amanda, Beatriz, Diana, Carlos)                │
│     [VER CANDIDATOS ELEGÍVEIS]                      │
└─────────────────────────────────────────────────────┘
```

---

#### Linha tipo Rodízio

```
┌─────────────────────────────────────────────────────┐
│  [ZONA IDENTIDADE DA LINHA]                          │
│                                                      │
│  ◆ Tipo: Rodízio                       [🔒 Admin]   │
│  ◆ Resolução: automática                            │
│  ◆ Lógica: menor número de execuções nesta Linha;  │
│             desempate por data da última execução;  │
│             segundo desempate por posição na rotação│
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  [ZONA CONFIGURAÇÃO DA ROTAÇÃO]                      │
│                                                      │
│  Membros da rotação (ordem define desempate final): │
│                                                      │
│  Rotação 1: Diana Costa      [✏ TROCAR] [✏ MOVER]  │
│  Rotação 2: Eduardo Melo     [✏ TROCAR] [✏ MOVER]  │
│  Rotação 3: Fernanda Luz     [✏ TROCAR] [✏ MOVER]  │
│                                                      │
│  [✏ ADICIONAR MEMBRO À ROTAÇÃO]                     │
│  [✏ REMOVER MEMBRO DA ROTAÇÃO]                      │
│                                                      │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─        │
│  ◆ Histórico desta Linha (últimas execuções):       │
│  Eduardo · 14/06 · automático                       │
│  Diana · 07/06 · automático                        │
│  Fernanda · 31/05 · automático                     │
│  [VER HISTÓRICO COMPLETO DE EXECUÇÕES]             │
└─────────────────────────────────────────────────────┘
```

---

#### Linha tipo Dia da Semana — Configuração Completa (WS-08)

```
┌─────────────────────────────────────────────────────┐
│  [ZONA IDENTIDADE DA LINHA]                          │
│                                                      │
│  ◆ Tipo: Dia da Semana                [🔒 Admin]   │
│  ◆ Resolução: automática para dias mapeados;       │
│               Padrão para dias sem mapeamento        │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  [ZONA MAPEAMENTO POR DIA]                           │
│                                                      │
│  Segunda:   Amanda Souza       [✏ EDITAR]           │
│  Terça:     Beatriz Lima       [✏ EDITAR]           │
│  Quarta:    Carlos Andrade     [✏ EDITAR]           │
│  Quinta:    — sem mapeamento —  [✏ ADICIONAR]       │
│  Sexta:     — sem mapeamento —  [✏ ADICIONAR]       │
│  Sábado:    Amanda Souza       [✏ EDITAR]           │
│  Domingo:   Beatriz Lima       [✏ EDITAR]           │
│                                                      │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─        │
│  PADRÃO (dias sem mapeamento):                      │
│  ◆ Em Aberto — Supervisor resolve no dia [✏ EDITAR] │
│                                                      │
│  ◆ Quinta e Sexta sem mapeamento →                 │
│    Se show nestes dias: Em Aberto por design        │
│    (comportamento esperado — configurado assim)      │
└─────────────────────────────────────────────────────┘
```

---

#### Linha tipo Dia da Semana — Configuração Ausente (WS-09)

```
┌─────────────────────────────────────────────────────┐
│  [ZONA ALERTA — topo da Linha]                       │
│                                                      │
│  ⚠ CONFIGURAÇÃO INCOMPLETA                          │
│                                                      │
│  O campo Padrão não foi configurado para esta Linha. │
│  Dias sem mapeamento gerarão Em Aberto por omissão  │
│  (não por design). Configure o Padrão para evitar   │
│  Em Abertos inesperados.                            │
│                                                      │
│  ⚡ [CONFIGURAR PADRÃO AGORA]                       │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  [ZONA MAPEAMENTO POR DIA]                           │
│                                                      │
│  Segunda:   Amanda Souza       [✏ EDITAR]           │
│  Terça:     Beatriz Lima       [✏ EDITAR]           │
│  Quarta:    Carlos Andrade     [✏ EDITAR]           │
│  Quinta:    — sem mapeamento —  [✏ ADICIONAR]       │
│  Sexta–Dom: — sem mapeamento —  [✏ ADICIONAR]      │
│                                                      │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─        │
│  PADRÃO: ⚠ Não configurado                         │
│  → Comportamento atual: Em Aberto por omissão       │
│  → Distinguish de Em Aberto por design              │
│                                                      │
│  ⚡ [CONFIGURAR PADRÃO]   Opções:                   │
│     ( ) Pessoa fixa: [selecionar membro]            │
│     ( ) Rodízio entre mapeados                      │
│     (●) Em Aberto (confirmado por design)           │
└─────────────────────────────────────────────────────┘
```

**Regra de diferenciação (WS-08 vs WS-09):** o banner de alerta aparece apenas no caso de configuração ausente (WS-09). No caso de Em Aberto por design (WS-08), não há alerta — o sistema confirma que o comportamento é esperado. A distinção é crítica: um é problema de configuração, o outro é decisão de produto.

---

## PARTE 4 — EDIÇÃO

---

### WLE-01 — Edição de Configuração Permitida (Tipo B)

*Cenário: WS-03 — Supervisor troca pessoa numa Linha tipo Pessoa fixa*

```
┌─────────────────────────────────────────────────────┐
│  [ZONA CONTEXTO DA EDIÇÃO]                           │
│                                                      │
│  ✏ Editando: Linha da Posição Astrid — Bloco 1.1   │
│  Tipo de edição: Configuração (Tipo B)              │
│  Autoridade: Admin ou Supervisor                    │
│                                                      │
│  Esta edição afeta:                                 │
│  ◆ Livros do Dia futuros ainda não gerados         │
│  ◆ Não afeta Livros do Dia já gerados              │
│  ◆ Não afeta Livros do Dia já publicados           │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  [ZONA EDIÇÃO]                                       │
│                                                      │
│  Campo: Titular                                     │
│                                                      │
│  ERA:   Amanda Souza                                │
│  AGORA: [selecionar membro elegível]                │
│                                                      │
│  Candidatos elegíveis (atendem às tags da Posição): │
│  ◆ Beatriz Lima                                    │
│  ◆ Diana Costa                                     │
│  ◆ Carlos Andrade                                  │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─        │
│  Membros inelegíveis (por tag de exigência):       │
│  ⚠ Eduardo Melo — sem habilitação para Astrid (CAT-07) │
│  ⚠ Fernanda Luz — restrição médica ativa (CAT-04) │
│  [VER RAZÃO COMPLETA DE CADA EXCLUSÃO]             │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  [ZONA MOTIVO — obrigatório]                         │
│                                                      │
│  ⚡ Motivo desta alteração:                         │
│  [campo de texto obrigatório]                       │
│                                                      │
│  Exemplos: "Amanda transferida para outro grupo"    │
│            "Beatriz assume como titular permanente" │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  [ZONA AÇÕES]                                        │
│                                                      │
│  ⚡ [SALVAR CONFIGURAÇÃO]    [CANCELAR]              │
│                                                      │
│  ◆ Esta edição cria versão v4 do Livro do Show      │
│  ◆ Livros do Dia futuros gerados de v3 serão        │
│    sinalizados como TEMPLATE DESATUALIZADO          │
│  ◆ Registro no Histórico com sua autoria            │
└─────────────────────────────────────────────────────┘
```

**Regra:** o painel de ações pré-visualiza o impacto da edição antes do Supervisor confirmar. O Supervisor sabe que está criando uma nova versão do Livro do Show antes de salvar.

---

### WLE-02 — Tentativa de Alteração Estrutural pelo Supervisor (Tipo A bloqueada)

*Cenário: WS-04 — Supervisor tenta adicionar uma Posição*

```
┌─────────────────────────────────────────────────────┐
│  [ZONA BLOQUEIO EXPLICATIVO]                         │
│                                                      │
│  🔒 AÇÃO EXCLUSIVA DO ADMIN                         │
│                                                      │
│  Adicionar uma nova Posição é uma alteração          │
│  estrutural (Tipo A). Somente o Admin pode executar │
│  alterações estruturais no Livro do Show.           │
│                                                      │
│  Alterações estruturais incluem:                    │
│  · Adicionar ou remover Cenas, Blocos ou Posições  │
│  · Adicionar ou remover Linhas                      │
│  · Mudar o tipo de uma Linha                        │
│  · Criar ou remover tags do catálogo                │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  [ZONA AÇÃO DISPONÍVEL PARA O SUPERVISOR]            │
│                                                      │
│  Você pode solicitar esta alteração ao Admin         │
│  através de uma Solicitação Administrativa.          │
│                                                      │
│  ⚡ [CRIAR SOLICITAÇÃO ADMINISTRATIVA]              │
│                                                      │
│  A Solicitação será encaminhada ao Admin Ricardo    │
│  para análise. Você pode acompanhar em S-06.        │
│                                                      │
│  [CANCELAR]                                         │
└─────────────────────────────────────────────────────┘
```

**Regra de design:** o bloqueio não é um erro genérico — é um contexto explicativo seguido de uma ação disponível. O Supervisor não fica sem saída — tem uma alternativa clara.

---

#### Fluxo da Solicitação Administrativa para mudança estrutural

```
[SUPERVISOR]
  ⚡ [CRIAR SOLICITAÇÃO ADMINISTRATIVA]
              │
              ▼
[S-06 — Solicitação Administrativa pré-preenchida]
  · Tipo: Mudança Estrutural no Livro do Show
  · Show: Musical Grandes Clássicos
  · Elemento: Adição de nova Posição — Bloco 1.1
  · Descrição da proposta: [campo livre]
  · Motivo operacional: [campo obrigatório]
              │
              ▼
[ADMIN recebe em S-06]
  · Análise da proposta
  · Decisão: Aprovado / Negado (com motivo)
              │
              ▼
[Se aprovado: Admin executa no Livro do Show]
[Histórico: "Mudança estrutural solicitada por Ana Silva, executada por Ricardo"]
```

---

## PARTE 5 — TAGS OPERACIONAIS

---

### WLT-01 — Consulta de Tags de uma Posição

*Cenários: WS-05*

```
┌─────────────────────────────────────────────────────┐
│  [ZONA TAGS DA POSIÇÃO ASTRID]                       │
│                                                      │
│  TAGS APLICADAS (4 tags em 3 categorias)            │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─        │
│  CAT-07 · Personagem              [✏ Config]        │
│  ▶ habilitado para Astrid                           │
│     Membros habilitados: Amanda Souza · Beatriz Lima │
│     · Diana Costa · Carlos Andrade                  │
│     [VER HABILITAÇÕES]                              │
│                                                      │
│  CAT-03 · Exigência Física        [✏ Config]        │
│  ◆ extensão lombar extrema                         │
│  ◆ carga cardiovascular alta                       │
│                                                      │
│  CAT-04 · Exigência Médica        [🔒 Admin]        │
│  ◆ liberação médica para acrobacia                 │
│     ⚠ Inviolável — não pode ser sobrescrito        │
│     Se um candidato não tem clearance: excluído.   │
│     Supervisor não pode alocar manualmente.        │
│                                                      │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─        │
│  Categorias sem tag nesta Posição:                  │
│  CAT-01 CAT-02 CAT-05 CAT-06 CAT-08 CAT-09 CAT-10 │
│  CAT-11                                             │
│  [VER DESCRIÇÃO DE CADA CATEGORIA]                 │
└─────────────────────────────────────────────────────┘
```

---

### WLT-02 — Edição de Tags

*Cenário: WS-05 — Admin aplica nova tag CAT-04*

```
┌─────────────────────────────────────────────────────┐
│  [ZONA ADICIONAR TAG]   — visão Admin                │
│                                                      │
│  Posição: Astrid · Bloco 1.1                        │
│                                                      │
│  Selecionar categoria:                              │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─        │
│  [CAT-01 Habilidade Artística]      [✏ Config]      │
│  [CAT-02 Habilidade Técnica]        [✏ Config]      │
│  [CAT-03 Exigência Física]          [✏ Config]      │
│  [CAT-04 Exigência Médica]          [🔒 Admin]      │
│  [CAT-05 Segurança]                 [🔒 Admin]      │
│  [CAT-06 Certificação]              [🔒 Admin]      │
│  [CAT-07 Personagem]                [✏ Config]      │
│  [CAT-08 Figurino]                  [✏ Config]      │
│  [CAT-09 Equipamento]               [✏ Config]      │
│  [CAT-10 Substituição]              [🔒 Admin]      │
│  [CAT-11 Cobertura Crítica]         [🔒 Admin]      │
│                                                      │
│  Selecionado: CAT-04 · Exigência Médica [🔒 Admin] │
│  Tag a aplicar: liberação médica para acrobacia     │
│                                                      │
│  ⚠ Esta tag é INVIOLÁVEL.                          │
│  Membros sem esta clearance serão excluídos pelo    │
│  motor automaticamente. Supervisores não podem      │
│  sobrescrever esta exclusão.                        │
│                                                      │
│  Membros atualmente afetados pela aplicação desta tag: │
│  · Eduardo Melo — sem clearance → será excluído    │
│  · Fernanda Luz — sem clearance → será excluída    │
│                                                      │
│  ⚡ [CONFIRMAR APLICAÇÃO DA TAG]   [CANCELAR]       │
└─────────────────────────────────────────────────────┘
```

**Regra:** antes de aplicar uma tag de categoria inviolável, o sistema mostra quais membros já cadastrados perderão elegibilidade para aquela posição. O Admin confirma com conhecimento do impacto.

---

### WLT-03 — Auditoria de Tags

*Cenário: WS-10*

```
┌─────────────────────────────────────────────────────┐
│  [ZONA HISTÓRICO DE TAGS — Posição Astrid]           │
│                                                      │
│  HISTÓRICO DE TAGS DESTA POSIÇÃO                   │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─        │
│  ◆ 18/06 · CAT-04 aplicada             Admin Ricardo│
│     Tag: liberação médica para acrobacia            │
│     Motivo: "Acrobacia aérea adicionada ao bloco 1" │
│     Impacto: Eduardo Melo e Fernanda Luz excluídos  │
│                                                      │
│  ◆ 10/05 · CAT-03 adicionada          Admin Ricardo │
│     Tag: carga cardiovascular alta                  │
│     Motivo: "Coreografia revisada em março"         │
│                                                      │
│  ◆ 01/03 · CAT-07 aplicada (criação)  Admin Ricardo │
│     Tag: habilitado para Astrid                     │
│     Motivo: "Setup inicial do Livro do Show"        │
└─────────────────────────────────────────────────────┘
```

---

## PARTE 6 — VERSIONAMENTO

---

### WLV-02 — Comparação de Versões (ERA → AGORA)

*Cenário: WS-06 — Admin remove Cena 3 → v1 → v2*

```
┌─────────────────────────────────────────────────────┐
│  [ZONA COMPARAÇÃO DE VERSÕES]                        │
│                                                      │
│  Musical Grandes Clássicos                          │
│  Comparando: v2 (atual) vs. v1 (anterior)           │
│                                                      │
│  ◆ v2 criada em 18/06 às 14h10 por Admin Ricardo   │
│  ◆ Motivo declarado: "Ato 3 removido desta temporada"│
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  [ZONA DELTA v1 → v2]                                │
│                                                      │
│  O QUE MUDOU:                                       │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─        │
│  🔴 REMOVIDO: Cena 3 — Encerramento                │
│     · 2 Blocos removidos                           │
│     · 2 Posições removidas                         │
│     · 4 Linhas removidas                           │
│     Membros afetados: Amanda Souza · Beatriz Lima   │
│                                                      │
│  O QUE NÃO MUDOU:                                  │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─        │
│  ✓ Cena 1 — Abertura (sem alterações)              │
│  ✓ Cena 2 — Desenvolvimento (sem alterações)       │
│                                                      │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─        │
│  Impacto em Livros do Dia futuros:                 │
│  ⚠ 3 Livros gerados de v1 sinalizados como         │
│    TEMPLATE DESATUALIZADO                          │
│  [VER LIVROS AFETADOS]                             │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  [ZONA HISTÓRICO DE VERSÕES — colapsado]             │
│                                                      │
│  [TODAS AS VERSÕES ▾]                               │
│  v2 · 18/06 · Remoção de Cena 3       [VER]        │
│  v1 · 01/03 · Versão original         [VER]        │
└─────────────────────────────────────────────────────┘
```

---

### WLV-03 — Estado TEMPLATE DESATUALIZADO

*Cenário: WS-07 — Livro do Dia 21/06 gerado de v1, Show agora em v2*

```
┌─────────────────────────────────────────────────────┐
│  [ZONA ALERTA — topo do Livro do Dia 21/06]          │
│                                                      │
│  ⚠ TEMPLATE DESATUALIZADO                          │
│                                                      │
│  Este Livro foi gerado com o Livro do Show v1.      │
│  O Livro do Show foi atualizado para v2 em 18/06.  │
│  A Cena 3 — Encerramento foi removida em v2.       │
│                                                      │
│  Posições possivelmente afetadas neste Livro:      │
│  · Posição Astrid · Cena 3 · Bloco 3.1            │
│  · Posição Rainha · Cena 3 · Bloco 3.2            │
│                                                      │
│  [VER DIFERENÇA v1 → v2]                           │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  [ZONA AÇÕES — Supervisor decide]                    │
│                                                      │
│  ⚡ Como deseja proceder com este Livro do Dia?    │
│                                                      │
│  ┌─────────────────────────────────────────────┐   │
│  │ OPÇÃO 1 — REGENERAR                         │   │
│  │ Descarta este Livro e gera novo com v2.     │   │
│  │ ⚠ Edições manuais anteriores serão perdidas │   │
│  │ [REGENERAR COM v2]                          │   │
│  └─────────────────────────────────────────────┘   │
│                                                      │
│  ┌─────────────────────────────────────────────┐   │
│  │ OPÇÃO 2 — MANTER E REVISAR                  │   │
│  │ Revisa manualmente as posições afetadas.    │   │
│  │ Livro sai do estado TEMPLATE DESATUALIZADO  │   │
│  │ após revisão explícita.                     │   │
│  │ [REVISAR MANUALMENTE]                       │   │
│  └─────────────────────────────────────────────┘   │
│                                                      │
│  ┌─────────────────────────────────────────────┐   │
│  │ OPÇÃO 3 — MANTER SEM REVISÃO                │   │
│  │ Aceita o Livro como está.                   │   │
│  │ Registrado no Histórico:                    │   │
│  │ "Aceito sem revisão após mudança de template"│   │
│  │ [MANTER SEM REVISÃO]                        │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

**Regra inegociável (LS-D04):** as 3 opções são apresentadas com o mesmo peso visual — o sistema não sugere nenhuma delas como preferida. A decisão é do Supervisor.

---

### WLV-04 — Fila de Livros Futuros Impactados

*Cenário: WS-07 — Admin vê todos os Livros afetados pela mudança de versão*

```
┌─────────────────────────────────────────────────────┐
│  [ZONA CABEÇALHO]                                    │
│                                                      │
│  LIVROS COM TEMPLATE DESATUALIZADO                  │
│  Musical Grandes Clássicos · v1 → v2                │
│                                                      │
│  ⚠ 3 Livros do Dia precisam de ação do Supervisor  │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  [ZONA FILA — ordenada por proximidade]              │
│                                                      │
│  ⚡ Musical 21/06 · Sábado · 12h30 · em 3 dias     │
│     2 posições afetadas · Status: aguardando decisão│
│     [VER LIVRO]    [NOTIFICAR SUPERVISOR]           │
│                                                      │
│  ⚠ Ensaio 23/06 · Segunda · 10h00 · em 5 dias     │
│     1 posição afetada · Status: aguardando decisão  │
│     [VER LIVRO]                                     │
│                                                      │
│  ◆ Musical 28/06 · Sábado · 12h30 · em 10 dias    │
│     2 posições afetadas · Status: aguardando decisão│
│     [VER LIVRO]                                     │
│                                                      │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─        │
│  Livros futuros ainda não gerados (serão gerados    │
│  automaticamente com v2): 4 shows · nenhuma ação   │
│  necessária.                                        │
└─────────────────────────────────────────────────────┘
```

---

## PARTE 7 — AUDITORIA DO HISTÓRICO DO SHOW

---

### WLH-01 — Histórico do Livro do Show

*Cenário: WS-10 — Admin investiga quem removeu Cena 3 e quando*

```
┌─────────────────────────────────────────────────────┐
│  [ZONA CABEÇALHO]                                    │
│                                                      │
│  HISTÓRICO DO LIVRO DO SHOW                        │
│  Musical Grandes Clássicos                          │
│                                                      │
│  Filtrar: [TIPO ▾] [AUTOR ▾] [PERÍODO ▾]           │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  [ZONA LINHA DO TEMPO]                               │
│                                                      │
│  18/06 · 14h10 · Admin Ricardo                      │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─        │
│  🔴 [Estrutural] Cena 3 — Encerramento removida    │
│     Versão criada: v2                               │
│     Motivo: "Ato 3 removido desta temporada"        │
│     Livros afetados: 3 (21/06, 23/06, 28/06)       │
│     [VER DELTA v1 → v2]   [VER LIVROS AFETADOS]   │
│                                                      │
│  18/06 · 11h30 · Ana Silva (Supervisor)             │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─        │
│  ✏ [Configuração] Titular da Posição Astrid alterado│
│     ERA: Carlos Andrade → AGORA: Amanda Souza      │
│     Versão criada: v1.1 (sub-versão de config.)    │
│     Motivo: "Carlos transferido para Musical B"     │
│     Livros afetados: 2 (gerados de v1 + afetados)  │
│                                                      │
│  01/03 · 09h00 · Admin Ricardo                      │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─        │
│  ◆ [Estrutural] Livro do Show criado · v1 inicial  │
│     3 Cenas · 8 Blocos · 12 Posições · 18 Linhas   │
│     Motivo: "Setup inicial temporada 2026"          │
└─────────────────────────────────────────────────────┘
```

**Como distinguir Estrutural de Configuração no Histórico:**
- 🔴 **[Estrutural]** — mudança de topologia; apenas Admin; vermelho no histórico
- ✏ **[Configuração]** — ajuste de comportamento; Admin ou Supervisor; ícone de edição

---

## PARTE 8 — AUDITORIA DE CONSISTÊNCIA

---

### 1. O Livro do Show continua distinto do Livro do Dia?

**Sim.** A distinção é estrutural e inescapável:

- O Livro do Show nunca é acessado pelo Membro
- O Livro do Show nunca tem estado PUBLICADO, DESATUALIZADO ou EXECUTADO — esses estados pertencem ao Livro do Dia
- O Livro do Show tem estado TEMPLATE DESATUALIZADO (que os Livros do Dia recebem) e VERSIONAMENTO (que é próprio do Show)
- O breadcrumb em S-13 sempre começa com "Livros do Show ›" — nunca com contexto de data ou show em execução

**Risco residual mitigado:** a distinção visual entre os dois precisa ser reforçada no mockup visual — não apenas no título, mas no design completo da superfície (esquema visual diferente, linguagem de cabeçalho diferente). Isso é uma instrução para o mockup, não um problema estrutural.

---

### 2. Existe risco de confusão entre estrutura e operação?

**Baixo.** Os wireframes de S-13 não usam terminologia operacional (PUBLICADO, AVISO, CONFIRMAÇÃO). A linguagem é exclusivamente de template: versão, cena, posição, linha, tag, configuração.

**Distinção adicional:** em S-05 (Livro do Dia), o breadcrumb incluirá a data ("Livro do Dia 21/06"). Em S-13 (Livro do Show), o breadcrumb incluirá o nome do Show sem data ("Musical Grandes Clássicos"). Essa diferença de linguagem no breadcrumb é a primeira linha de defesa contra confusão.

---

### 3. Existe risco de o Supervisor alterar algo estrutural sem perceber?

**Não.** Três camadas de proteção:

1. **Marcação visual inline:** todo elemento de autoridade Admin tem [🔒 Admin] visível antes do elemento
2. **Ação bloqueada com contexto:** ao tentar executar uma ação estrutural, o Supervisor recebe explicação — não um erro genérico
3. **Alternativa oferecida:** o bloqueio sempre oferece a Solicitação Administrativa como caminho. O Supervisor não fica sem ação.

---

### 4. Existe risco de perda de rastreabilidade?

**Não.** Três mecanismos garantem rastreabilidade completa:

1. **Versionamento numerado** de toda mudança que afeta o motor de geração
2. **Registro no Histórico** com autor, timestamp, tipo (Estrutural/Configuração) e motivo obrigatório
3. **Vínculo permanente** entre cada Livro do Dia e a versão do Livro do Show que o gerou

A IA pode responder qualquer pergunta do Admin sobre o que aconteceu, quando, por que e quem fez — sem que o Admin precise navegar em múltiplas telas.

---

### 5. Existe risco para o motor de cobertura?

**Baixo.** O motor de cobertura é protegido por:

1. **Validação de candidatos antes da edição:** ao editar uma Linha de Configuração, o sistema só exibe membros elegíveis (que atendem às tags da Posição). O Supervisor não consegue acidentalmente colocar um membro inelegível.
2. **Inviolabilidade de CAT-04, CAT-05, CAT-06, CAT-10:** exclusões por essas categorias não têm caminho de sobrescrita para o Supervisor. O motor nunca gera uma proposta que viola essas tags.
3. **Alerta de impacto antes da confirmação:** ao aplicar uma nova tag, o sistema mostra quais membros perderão elegibilidade antes de salvar.

---

### 6. Existe risco para as tags operacionais?

**Não.** A governança de tags é clara e aplicada em três níveis:

1. **Catálogo:** Admin cria as tags disponíveis. Supervisor não pode criar tags novas.
2. **Aplicação:** as 4 categorias críticas (CAT-04, CAT-05, CAT-06, CAT-10) são exclusivas do Admin. As demais permitem Supervisor com motivo.
3. **Sobrescrita:** as categorias críticas não podem ser sobrescritas pelo Supervisor em uma alocação manual. Somente o Admin pode remover ou pausar uma restrição de categoria crítica.

---

### 7. Existe risco para os Livros futuros?

**Não.** O mecanismo de TEMPLATE DESATUALIZADO garante:

1. **Nenhuma alteração silenciosa:** o Supervisor sempre sabe que um Livro do Dia foi gerado de uma versão anterior
2. **Três opções explícitas:** Regenerar, Manter e Revisar, Manter sem Revisão — nenhuma é default oculto
3. **Registro de decisão:** a opção escolhida fica no Histórico, com autoria e timestamp
4. **Livros não gerados:** recebem automaticamente a versão mais recente — sem ação necessária

---

## PARTE 9 — VEREDITO

---

### Wireframes produzidos

| ID | Nome | Cenários | Perfis |
|---|---|---|---|
| WLV-01 | Visão Geral do Show | WS-01 · WS-07 | ADM · SUP |
| WLS-01 | Nível Show | WS-01 · WS-02 | ADM · SUP |
| WLS-02 | Nível Cena | WS-02 · WS-06 | ADM · SUP |
| WLS-03 | Nível Bloco | WS-02 | ADM · SUP |
| WLS-04 | Nível Posição | WS-02 · WS-05 | ADM · SUP |
| WLS-05 | Nível Linha (4 tipos) | WS-02 · WS-03 · WS-08 · WS-09 | ADM · SUP |
| WLE-01 | Edição de Configuração | WS-03 | ADM · SUP |
| WLE-02 | Bloqueio Estrutural + Solicitação | WS-04 | SUP |
| WLT-01 | Consulta de Tags | WS-05 | ADM · SUP |
| WLT-02 | Edição de Tags | WS-05 | ADM |
| WLT-03 | Auditoria de Tags | WS-10 | ADM |
| WLV-02 | Comparação de Versões | WS-06 | ADM · SUP |
| WLV-03 | Estado TEMPLATE DESATUALIZADO | WS-07 | SUP |
| WLV-04 | Fila de Livros Futuros | WS-07 | ADM |
| WLH-01 | Histórico do Livro do Show | WS-10 | ADM |

---

### Cobertura dos cenários obrigatórios

| Cenário | Wireframes que cobrem | Status |
|---|---|---|
| WS-01 Consulta simples | WLV-01, WLS-01 | ✅ |
| WS-02 Navegação hierárquica | WLS-01 a WLS-05 | ✅ |
| WS-03 Edição de configuração | WLS-05, WLE-01 | ✅ |
| WS-04 Tentativa estrutural | WLE-02 | ✅ |
| WS-05 Mudança em tags | WLT-01, WLT-02 | ✅ |
| WS-06 Mudança de versão | WLS-02, WLV-02 | ✅ |
| WS-07 Livros futuros impactados | WLV-03, WLV-04 | ✅ |
| WS-08 Em Aberto por design | WLS-05 (tipo Dia da Semana) | ✅ |
| WS-09 Em Aberto por omissão | WLS-05 (tipo Dia da Semana) | ✅ |
| WS-10 Auditoria do histórico | WLH-01, WLT-03 | ✅ |

---

### Decisões de wireframe produzidas

| # | Decisão |
|---|---|
| WLS-D01 | A Saúde do Template é sempre o primeiro elemento na Visão Geral — antes da hierarquia de Cenas |
| WLS-D02 | O breadcrumb empilhado é obrigatório em toda navegação hierárquica de S-13 — sem exceção |
| WLS-D03 | Tags são apresentadas antes das Linhas no nível de Posição — a exigência precede quem a cumpre |
| WLS-D04 | Bloqueio de ação estrutural nunca é um erro genérico — é sempre um contexto explicativo + alternativa (Solicitação Administrativa) |
| WLS-D05 | A distinção Em Aberto por design vs. Em Aberto por configuração ausente é visual e textual — nunca ambas recebem o mesmo tratamento |
| WLS-D06 | As 3 opções de ação no estado TEMPLATE DESATUALIZADO têm peso visual igual — o sistema não sugere nenhuma como preferida |
| WLS-D07 | No Histórico do Livro do Show, Estrutural é marcado com ícone e cor distintos de Configuração |
| WLS-D08 | Ao editar uma Linha de Configuração, o sistema exibe candidatos elegíveis e inelegíveis com razão — nunca apenas a lista de nomes |
| WLS-D09 | A fila de Livros futuros com TEMPLATE DESATUALIZADO é ordenada por proximidade de data (mais urgente primeiro) |
| WLS-D10 | O Supervisor tem sempre visível a lista de Linhas onde pode agir (Tipo B) — sem precisar navegar toda a hierarquia para descobrir |

---

### Conformidade com decisões anteriores

| Decisão | Aplicada em S-13? |
|---|---|
| D-20 · Edições diretas com motivo obrigatório | ✅ WLE-01: campo de motivo obrigatório em toda edição de Configuração |
| LS-D01 · Rodízio por Linha | ✅ WLS-05: histórico de execuções visível, lógica de menor contador documentada |
| LS-D02 · Padrão obrigatório em Dia da Semana | ✅ WLS-05: WS-08 vs WS-09 com tratamento distintos |
| LS-D03 · Dois tipos de mudança | ✅ WLE-01 (Configuração) e WLE-02 (Estrutural bloqueada) |
| LS-D04 · Versionamento e TEMPLATE DESATUALIZADO | ✅ WLV-02, WLV-03, WLV-04 |
| LS-D05 · 11 categorias com governança diferenciada | ✅ WLT-01, WLT-02: [🔒 Admin] vs [✏ Config] visíveis |
| WF-07 · Breadcrumb obrigatório | ✅ Em todos os wireframes WLS-01 a WLS-05 |
| AU-03 · S-13 modelado em paralelo aos mockups de S-05 | ✅ S-13 encerrado para wireframe |

---

## 🟢 Pronto para Mockup

S-13 Livro do Show tem wireframes estruturais completos com:

- **15 wireframes** cobrindo todos os estados relevantes: visão geral, 5 níveis hierárquicos, edição (Configuração e Estrutural), tags (consulta, edição, auditoria), versionamento (comparação, estado TEMPLATE DESATUALIZADO, fila de futuros) e histórico
- **10 cenários obrigatórios** cobertos por pelo menos 2 wireframes cada
- **10 novas decisões de wireframe (WLS-D01 a WLS-D10)** que guiarão os mockups visuais
- **Todas as decisões LS-D01–LS-D05** aplicadas e verificadas
- **7 pontos de auditoria de consistência** verificados sem risco estrutural remanescente

O Livro do Show foi projetado como **template invisível para o Membro e transparente para o Supervisor** — com autoridade clara, rastreabilidade total e motor de cobertura protegido.

---

*Documento elaborado por Product Designer Sênior — MyASA 2.0*
*Base: Recuperação Arquitetural · Fechamento de Lacunas (LS-D01–LS-D05) · todos os documentos do núcleo operacional*
