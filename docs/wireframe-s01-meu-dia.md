# MyASA 2.0 — Wireframe Estrutural — S-01 Meu Dia

> Versão: 17/06/2026
> Fase: Wireframe Estrutural — anterior a mockup visual
> Superfície: S-01 Meu Dia (Produto do Membro)
> Autoria: Senior Product Designer
> Status: Validação estrutural — pronta para revisão antes do mockup

---

## Premissa do Wireframe

Este documento representa a estrutura do Meu Dia em notação ASCII/esquemática. Não há cor, tipografia final, sombra, gradiente ou detalhe visual. O objetivo é validar:

- **O que aparece** em cada estado
- **Em que ordem** aparece
- **Quanto espaço** cada elemento ocupa
- **Onde ficam** as ações
- **Como a hierarquia** muda entre estados

A representação usa as seguintes convenções:

```
┌──────────┐  = card / container
│          │  = conteúdo de um card
[ BOTÃO ]     = ação primária
( botão )     = ação secundária
[ ████████ ]  = botão de largura total
─────────     = divisor ou separador
~ ~ ~ ~ ~    = elemento da IA
···           = conteúdo recolhido / expansível
■ ■ ■ ■      = nav bar
```

**Viewport de referência:** iPhone 14 Pro (390 × 844px) — proporções refletidas no ASCII.
**Orientação:** portrait.

---

---

# WIREFRAME 1 — ESTADO NORMAL

**Cenário:** Carlos, Membro do grupo Ballet — Musical. Hoje tem show às 14h. Nenhuma alteração desde a última abertura. Uma solicitação de folga em análise. Sem entregas urgentes.

---

```
╔═══════════════════════════════════════╗
║  STATUS BAR   ·   18/06 Qui  ·  9:41 ║
╠═══════════════════════════════════════╣
║                                       ║
║  Bom dia, Carlos         [avatar] [·] ║  ← Cumprimento contextual + avatar + notif
║  Musical das Estrelas                 ║  ← Nome da Operação ativa
║                                       ║
║ ─────────────────────────────────── ║
║                                       ║
║  ┌─────────────────────────────────┐  ║
║  │                                 │  ║
║  │  PRÓXIMA ATIVIDADE              │  ║  ← T1 bold — elemento dominante
║  │                                 │  ║
║  │  Musical das Estrelas      SHOW │  ║  ← Nome + tipo (pill)
║  │  ─────────────────────────────  │  ║
║  │  14:00 → 17:30                  │  ║  ← T1 bold — horário em destaque
║  │  Teatro Principal               │  ║  ← T2 — local
║  │                                 │  ║
║  │  Seu papel                      │  ║  ← Label T3
║  │  Marcos                    ✓    │  ║  ← T1 bold — papel + confirmado
║  │                                 │  ║
║  │  ( Ver Livro do Dia )           │  ║  ← Ação secundária
║  │                                 │  ║
║  └─────────────────────────────────┘  ║
║                                       ║
║  ┌─────────────────────────────────┐  ║
║  │ ~                               │  ║  ← Card IA (borda esquerda: identidade)
║  │ ~ Hoje você tem 1 show às 14h   │  ║
║  │ ~ como Marcos. Tudo confirmado. │  ║
║  │ ~ Próximo ensaio: sexta, 15h.   │  ║
║  │                                 │  ║
║  │ ( Perguntar à IA )              │  ║  ← Expansão para chat inline
║  └─────────────────────────────────┘  ║
║                                       ║
║  HOJE — 2 ATIVIDADES                  ║  ← Cabeçalho da linha do tempo
║  ┌─────────────────────────────────┐  ║
║  │  10:00 Aquecimento técnico      │  ║  ← Atividade 1 (passará em breve)
║  │  14:00 Musical das Estrelas ←   │  ║  ← Atividade 2 (próxima — marcada)
║  │  ···  ( ver linha do tempo )    │  ║  ← Expansível
║  └─────────────────────────────────┘  ║
║                                       ║
║  ─────────────────────────────────    ║
║                                       ║
║  PENDÊNCIAS                           ║  ← Seção secundária — label pequeno
║                                       ║
║  ┌─────────────────────────────────┐  ║
║  │  Solicitações  ·  1 em análise  │  ║  ← Estado resumido — não lista
║  │  Folga 25/06 · em análise há 1d │  ║
║  └─────────────────────────────────┘  ║
║                                       ║
║  ─────────────────────────────────    ║
║                                       ║
╠═══════════════════════════════════════╣
║  ■ Meu Dia  ○ Solic  ○ Entregas ○ Msg ║  ← Nav bar — Meu Dia ativo
╚═══════════════════════════════════════╝
```

---

## Anotações do Estado Normal

### Zona de percepção imediata (acima do fold)

O que Carlos vê sem nenhum scroll:
1. Cumprimento + operação (contexto temporal imediato)
2. Card de Próxima Atividade completo — show, horário, papel
3. Narrativa da IA — validação em 1 linha: "tudo confirmado"

**Tempo para certeza: < 3 segundos.** Carlos vê "14h, Marcos, confirmado" e pode fechar o app sabendo o que precisa saber.

### Zona de aprofundamento (abaixo do fold, scroll curto)

4. Linha do tempo contraída — expandível se Carlos quiser ver tudo
5. Pendências: solicitação em análise — 1 linha, sem urgência

### Elementos ausentes intencionalmente

- **Avisos:** não há avisos não lidos — seção não aparece (não ocupa espaço)
- **Entregas:** sem prazo próximo — seção não aparece
- **Mensagens:** sem mensagem não lida — sem badge na nav

### Análise de hierarquia

```
Hierarquia do Estado Normal:
  1° Card de Próxima Atividade      [~40% do viewport]
  2° Card IA narrativa              [~15% do viewport]
  3° Linha do tempo                 [~12% do viewport]
  4° Pendências                     [~10% do viewport]
  5° Nav bar                        [~8% do viewport]
  ─  Espaço em branco              [~15% do viewport]
```

O espaço em branco é o sinal de "está tudo bem". Não deve ser preenchido.

---

---

# WIREFRAME 2 — ESTADO DE ATENÇÃO

**Cenário:** Carlos, mesmo dia. Nenhuma alteração crítica. Mas: a solicitação de folga está sem resposta há 3 dias (data de impacto em 2 dias) e há uma entrega com prazo amanhã ao meio-dia que ainda não foi enviada.

---

```
╔═══════════════════════════════════════╗
║  STATUS BAR   ·   18/06 Qui  ·  9:41 ║
╠═══════════════════════════════════════╣
║                                       ║
║  Bom dia, Carlos         [avatar] [·] ║
║  Musical das Estrelas                 ║
║                                       ║
║ ─────────────────────────────────── ║
║                                       ║
║  ┌─────────────────────────────────┐  ║
║  │  PRÓXIMA ATIVIDADE              │  ║  ← Card principal — SEM alteração visual
║  │                                 │  ║    O card continua calmo
║  │  Musical das Estrelas      SHOW │  ║
║  │  ─────────────────────────────  │  ║
║  │  14:00 → 17:30                  │  ║
║  │  Teatro Principal               │  ║
║  │                                 │  ║
║  │  Seu papel                      │  ║
║  │  Marcos                    ✓    │  ║
║  │                                 │  ║
║  │  ( Ver Livro do Dia )           │  ║
║  └─────────────────────────────────┘  ║
║                                       ║
║  ┌─────────────────────────────────┐  ║
║  │ ~                               │  ║  ← Card IA — narrativa ajustada
║  │ ~ Tudo OK para o show de hoje.  │  ║    IA menciona as atenções
║  │ ~ Atenção: você tem 2 itens     │  ║
║  │ ~ que precisam de ação antes    │  ║
║  │ ~ de amanhã.                    │  ║
║  │                                 │  ║
║  │ ( Perguntar à IA )              │  ║
║  └─────────────────────────────────┘  ║
║                                       ║
║  REQUER SUA ATENÇÃO                   ║  ← Seção de atenção — aparece AQUI
║                                       ║    entre a IA e a linha do tempo
║  ┌─────────────────────────────────┐  ║
║  │ ⚠  Entrega — Relatório Técnico │  ║  ← Card atenção (borda âmbar esquerda)
║  │    Prazo: amanhã às 12:00      │  ║
║  │    Status: aguardando envio    │  ║
║  │                    ( Ver )     │  ║
║  └─────────────────────────────────┘  ║
║                                       ║
║  ┌─────────────────────────────────┐  ║
║  │ ⚠  Folga 25/06 — sem resposta  │  ║  ← Card atenção (borda âmbar)
║  │    Solicitada há 3 dias        │  ║
║  │    Impacto em: 2 dias          │  ║
║  │                    ( Ver )     │  ║
║  └─────────────────────────────────┘  ║
║                                       ║
║  HOJE — 2 ATIVIDADES                  ║
║  ┌─────────────────────────────────┐  ║
║  │  10:00 Aquecimento técnico      │  ║
║  │  14:00 Musical das Estrelas ←   │  ║
║  │  ···  ( ver linha do tempo )    │  ║
║  └─────────────────────────────────┘  ║
║                                       ║
╠═══════════════════════════════════════╣
║  ■ Meu Dia  ○ Solic  ○ Entregas ○ Msg ║
╚═══════════════════════════════════════╝
```

---

## Anotações do Estado de Atenção

### Diferença crítica em relação ao Estado Normal

O Card de Próxima Atividade **não muda visualmente** no estado de atenção. Ele continua calmo porque o show de hoje está confirmado. O que muda:

1. **A narrativa da IA** reconhece as atenções — é a primeira sinalização
2. **A seção "Requer sua atenção"** aparece entre a IA e a linha do tempo
3. **Os cards de atenção** têm borda esquerda âmbar — distinguíveis, mas não dominantes

### O que NÃO acontece no estado de atenção

- O Card de Próxima Atividade não fica âmbar — o show de hoje está OK
- Os cards de atenção não sobem acima da Próxima Atividade — prioridade do show é mantida
- O visual geral não "fica ansioso" — a leitura imediata ainda é "show confirmado"
- Não há badge vermelho no ícone da nav bar — âmbar no máximo

### Reorganização automática de conteúdo

No estado Normal, a ordem era:
```
1° Próxima Atividade → 2° IA → 3° Linha do Tempo → 4° Pendências
```

No estado de Atenção:
```
1° Próxima Atividade → 2° IA (menciona atenções) → 3° Atenções → 4° Linha do Tempo
```

A seção de Atenções **empurra** a Linha do Tempo para baixo. O Carlos pode scrollar para ver a linha do tempo se quiser, mas primeiro vê o que precisa de ação.

### Análise de hierarquia

```
Hierarquia do Estado de Atenção:
  1° Card de Próxima Atividade      [~38% do viewport]
  2° Card IA (narrativa ajustada)   [~15% do viewport]
  3° Cards de Atenção (2 items)     [~20% do viewport]  ← novo
  4° Linha do tempo (contraída)     [~10% do viewport]  ← desceu
  5° Nav bar                        [~8% do viewport]
  ─  Espaço em branco              [~9% do viewport]    ← reduzido
```

---

---

# WIREFRAME 3 — ESTADO CRÍTICO

**Cenário:** Carlos abre o app e existe uma Alteração Operacional Persistente não confirmada. O Supervisor publicou uma alteração às 22h de ontem: Carlos, que seria Astrid no Musical das 14h, agora é Marcos.

---

```
╔═══════════════════════════════════════╗
║  STATUS BAR   ·   18/06 Qui  ·  9:41 ║
╠═══════════════════════════════════════╣
║                                       ║
║  Bom dia, Carlos         [avatar] [!] ║  ← Badge de notif ativo (!)
║  Musical das Estrelas                 ║
║                                       ║
║ ════════════════════════════════════  ║  ← Separador mais denso (não sutil)
║                                       ║
║  ╔═════════════════════════════════╗  ║
║  ║  ⚠  ALTERAÇÃO NA SUA ESCALA   ║  ║  ← BLOCO DE ALTERAÇÃO
║  ║                                 ║  ║    Borda esquerda espessa
║  ║  Publicada ontem às 22:14       ║  ║    Fundo coral (representado por ╔)
║  ║  pelo Supervisor Fernanda       ║  ║
║  ║                                 ║  ║
║  ║  MUSICAL DAS ESTRELAS · 14:00   ║  ║
║  ║                                 ║  ║
║  ║  Antes    Astrid          ~~    ║  ║  ← "Antes": visualmente cancelado
║  ║           Musical das Est ~~    ║  ║    ~~ = tachado
║  ║                                 ║  ║
║  ║  Agora    Marcos          ✓     ║  ║  ← "Agora": T1 bold, vivo
║  ║           Musical das Est       ║  ║
║  ║                                 ║  ║
║  ║  ─────────────────────────────  ║  ║
║  ║                                 ║  ║
║  ║  [████ CONFIRMAR ALTERAÇÃO ████]║  ║  ← Botão FULL WIDTH — ação primária
║  ║                                 ║  ║
║  ╚═════════════════════════════════╝  ║
║                                       ║
║  ─────────────────────────────────    ║
║                                       ║
║  ┌─────────────────────────────────┐  ║  ← Card Próxima Atividade
║  │  PRÓXIMA ATIVIDADE — ATUALIZADA │  ║    Label indica que reflete a alteração
║  │                                 │  ║
║  │  Musical das Estrelas      SHOW │  ║
║  │  14:00 → 17:30                  │  ║
║  │  Teatro Principal               │  ║
║  │                                 │  ║
║  │  Seu papel                      │  ║
║  │  Marcos                   ↑ new │  ║  ← Papel novo marcado (não confirmado ainda)
║  │                                 │  ║
║  └─────────────────────────────────┘  ║
║                                       ║
║  ┌─────────────────────────────────┐  ║
║  │ ~                               │  ║  ← Card IA — contextual à alteração
║  │ ~ Seu papel no Musical mudou    │  ║
║  │ ~ de Astrid para Marcos. O      │  ║
║  │ ~ figurino e entrada de cena    │  ║
║  │ ~ são diferentes. Confirme      │  ║
║  │ ~ quando estiver pronto.        │  ║
║  │                                 │  ║
║  │ ( Perguntar sobre a mudança )   │  ║
║  └─────────────────────────────────┘  ║
║                                       ║
║  ···  ( linha do tempo — ver abaixo ) ║  ← Linha do tempo acessível mas não exibida
║                                       ║
╠═══════════════════════════════════════╣
║  ■ Meu Dia  ○ Solic  ○ Entregas ○ Msg ║
╚═══════════════════════════════════════╝
```

---

## Wireframe 3B — Estado Crítico com múltiplas alterações

**Cenário:** Carlos tem 2 alterações não confirmadas — duas mudanças publicadas ontem.

```
╔═══════════════════════════════════════╗
║  STATUS BAR   ·   18/06 Qui  ·  9:41 ║
╠═══════════════════════════════════════╣
║                                       ║
║  Bom dia, Carlos         [avatar] [!] ║
║  Musical das Estrelas                 ║
║                                       ║
║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
║                                       ║
║  ╔═════════════════════════════════╗  ║
║  ║  ⚠  ALTERAÇÃO 1 DE 2           ║  ║  ← Contador de alterações
║  ║                                 ║  ║
║  ║  MUSICAL DAS ESTRELAS · 14:00   ║  ║
║  ║                                 ║  ║
║  ║  Antes    Astrid          ~~    ║  ║
║  ║  Agora    Marcos          ✓     ║  ║
║  ║                                 ║  ║
║  ║  [████ CONFIRMAR ALTERAÇÃO ████]║  ║
║  ║                                 ║  ║
║  ╚═════════════════════════════════╝  ║
║                                       ║
║  ╔═════════════════════════════════╗  ║  ← Segunda alteração — parcialmente visível
║  ║  ⚠  ALTERAÇÃO 2 DE 2           ║  ║    (peek) abaixo da primeira
║  ║  ENSAIO TÉCNICO · 10:00  ···   ║  ║
║  ╚═════════════════════════════════╝  ║
║                                       ║
║  ─────────────────────────────────    ║
║                                       ║
║  ┌─────────────────────────────────┐  ║
║  │  PRÓXIMA ATIVIDADE — ATUALIZADA │  ║
║  │  Musical das Estrelas   · 14:00 │  ║
║  │  Marcos                   ↑ new │  ║
║  └─────────────────────────────────┘  ║
║                                       ║
╠═══════════════════════════════════════╣
║  ■ Meu Dia  ○ Solic  ○ Entregas ○ Msg ║
╚═══════════════════════════════════════╝
```

**Fluxo de múltiplas alterações:**
1. Carlos vê "Alteração 1 de 2" — confirmável imediatamente
2. Ao confirmar a 1ª: a 2ª sobe para a mesma posição com "Alteração 1 de 1"
3. Ao confirmar a 2ª: o Bloco desaparece, estado Normal assume

---

## Anotações do Estado Crítico — Respostas às perguntas da spec

### O que aparece primeiro?

O **Bloco de Alteração** — ocupa 45–50% do viewport acima do fold. Nenhum outro elemento visual compete com ele. Carlos abre o app e a primeira coisa que vê é o bloco com borda espessa, fundo diferente, e o botão de Confirmar.

### O que desaparece?

**Nada some** — mas a hierarquia visual muda radicalmente. A Linha do Tempo é recolhida automaticamente (não expandida) para dar espaço ao Bloco. A seção de Pendências não aparece até o Bloco ser confirmado.

### O que é empurrado para baixo?

- **Card de Próxima Atividade:** desce, mas ainda visível acima do fold (parcialmente) — Carlos pode ver que já reflete a nova realidade
- **Card da IA:** desce para abaixo do Card de Próxima Atividade
- **Linha do Tempo:** recolhida e acessível via link no fundo, mas não exibida
- **Pendências:** não visíveis enquanto o Bloco de Alteração existe

### O que exige confirmação?

Apenas o **Bloco de Alteração**. O botão "Confirmar Alteração" em largura total dentro do bloco é a única ação primária da tela. Todas as outras ações são secundárias e não competem visualmente.

### D1 — Impossível de ignorar?

**Validação:**
- Ocupa metade do viewport sem scroll
- Borda espessa (6px) — visualmente diferente de qualquer outro card
- Fundo diferente do resto da tela
- O botão de ação tem a maior área tocável da tela
- A navegação (nav bar) e as outras seções ficam acessíveis, mas visualmente subordinadas
- O estado persiste: se Carlos fechar o app e reabrir, o Bloco está lá. Não desapareceu.

---

## Wireframe 3C — Pós-Confirmação (transição)

```
╔═══════════════════════════════════════╗
║  STATUS BAR   ·   18/06 Qui  ·  9:41 ║
╠═══════════════════════════════════════╣
║                                       ║
║  ✓  Alteração confirmada              ║  ← Toast de feedback — 2s, desaparece
║                                       ║
║  ─────────────────────────────────    ║
║                                       ║
║  Bom dia, Carlos         [avatar] [·] ║
║  Musical das Estrelas                 ║
║                                       ║
║  ┌─────────────────────────────────┐  ║
║  │  PRÓXIMA ATIVIDADE              │  ║  ← Agora o card principal assume
║  │                                 │  ║    sem label "atualizada"
║  │  Musical das Estrelas      SHOW │  ║
║  │  14:00 → 17:30                  │  ║
║  │  Teatro Principal               │  ║
║  │                                 │  ║
║  │  Seu papel                      │  ║
║  │  Marcos                    ✓    │  ║  ← Papel confirmado — sem "new"
║  │                                 │  ║
║  │  ( Ver Livro do Dia )           │  ║
║  └─────────────────────────────────┘  ║
║                                       ║
║  [Estado Normal assume aqui]          ║
║                                       ║
╠═══════════════════════════════════════╣
║  ■ Meu Dia  ○ Solic  ○ Entregas ○ Msg ║
╚═══════════════════════════════════════╝
```

**Transição:** o Bloco de Alteração não "desliza" — desaparece com um fade curto (não animação elaborada). O toast de confirmação aparece no topo por 2 segundos. O Estado Normal assume imediatamente.

---

---

# WIREFRAME 4 — FLUXOS

---

## Fluxo 1 — Entrada Normal

```
  ┌─────────────────────────────────────────────────────┐
  │                   ENTRADA NORMAL                    │
  └─────────────────────────────────────────────────────┘

  Carlos abre o app
       │
       ▼
  Sistema verifica estado
       │
       ├── Existe alteração não confirmada? ──── SIM ──→ [FLUXO 3: Recebimento de Alteração]
       │
       └── NÃO
            │
            ▼
       Carrega Meu Dia — Estado Normal
            │
            ▼
       Carlos vê: Próxima Atividade + IA + Linha do Tempo
            │
            ├── Não há nada que exija ação ──→ Carlos fecha o app (certeza obtida)
            │
            ├── Carlos quer aprofundar ──→ [FLUXO 4: Abertura da Próxima Atividade]
            │
            ├── Carlos quer perguntar ──→ [FLUXO 5: Consulta à IA]
            │
            ├── Carlos quer ver solicitação ──→ [FLUXO 6: Acompanhamento de Solicitação]
            │
            └── Carlos quer ver entrega ──→ [FLUXO 7: Acompanhamento de Entrega]
```

---

## Fluxo 2 — Recebimento de Alteração (via notificação)

```
  ┌─────────────────────────────────────────────────────┐
  │            RECEBIMENTO DE ALTERAÇÃO                 │
  └─────────────────────────────────────────────────────┘

  Supervisor publica alteração
       │
       ▼
  Sistema gera Alteração Operacional Persistente
       │
       ▼
  Push notification enviada para Carlos:
  "Alteração na sua escala — Musical 14h"
       │
       ├── Carlos está com o app aberto ──→
       │        Bloco de Alteração aparece imediatamente (sem reload)
       │
       └── Carlos está com o app fechado ──→
                Carlos toca na notificação
                │
                ▼
                App abre diretamente no Meu Dia — Estado Crítico
                (não no feed de notificações)
                │
                ▼
                [FLUXO 3: Confirmação de Alteração]
```

---

## Fluxo 3 — Confirmação da Alteração

```
  ┌─────────────────────────────────────────────────────┐
  │              CONFIRMAÇÃO DA ALTERAÇÃO               │
  └─────────────────────────────────────────────────────┘

  Estado Crítico — Bloco de Alteração visível
       │
       ▼
  Carlos lê:
  ├── O que era antes (tachado)
  └── O que é agora (bold)
       │
       ├── Carlos quer entender melhor ──→
       │        Toca no Card IA abaixo do Bloco
       │        IA explica em linguagem operacional
       │        Carlos retorna ao Bloco (sem sair da tela)
       │        │
       │        └──→ Carlos toca "Confirmar Alteração"
       │
       └── Carlos confirma diretamente ──→
                Toca "Confirmar Alteração" (botão full-width)
                │
                ▼
           Sistema registra confirmação + horário
                │
                ▼
           Toast: "✓ Alteração confirmada"
                │
                ▼
           Bloco desaparece (fade)
                │
                ▼
           ├── Se havia outra alteração → próxima sobe
           │
           └── Se era a última → Estado Normal assume
```

---

## Fluxo 4 — Abertura da Próxima Atividade

```
  ┌─────────────────────────────────────────────────────┐
  │           ABERTURA DA PRÓXIMA ATIVIDADE             │
  └─────────────────────────────────────────────────────┘

  Estado Normal — Card de Próxima Atividade visível
       │
       ▼
  Carlos toca "Ver Livro do Dia" (ação secundária no card)
       │
       ▼
  Abre S-05 — Livro do Dia
  (contexto do show atual pré-carregado)
       │
       ├── Carlos lê o Livro do Dia
       │        │
       │        └── Toca "← Voltar" ou usa gesto de volta
       │                │
       │                ▼
       │        Retorna ao Meu Dia (mesmo estado)
       │
       └── Carlos expande linha do tempo primeiro ──→
                Toca "ver linha do tempo" no Meu Dia
                Linha do tempo expande inline (sem trocar de tela)
                Carlos toca em uma atividade específica
                Detalhe da atividade aparece em modal leve
                Pode acessar Livro do Dia a partir do modal
```

---

## Fluxo 5 — Consulta à IA

```
  ┌─────────────────────────────────────────────────────┐
  │                  CONSULTA À IA                      │
  └─────────────────────────────────────────────────────┘

  Carlos vê Card IA com narrativa passiva
       │
       ├── Carlos não tem pergunta ──→ Lê a narrativa, não interage
       │
       └── Carlos tem pergunta ──→
                Toca no Card IA ou em "Perguntar à IA"
                │
                ▼
           Card IA expande inline
           Campo de texto aparece na base do card
           Teclado sobe
                │
                ▼
           Carlos digita: "O que mudou no show de hoje?"
                │
                ▼
           IA responde dentro do card expandido
           (bubble de resposta — sem abrir nova tela)
                │
                ├── Resposta suficiente ──→
                │        Carlos fecha o card expandido
                │        Retorna ao Meu Dia normal
                │
                └── Carlos quer conversa mais profunda ──→
                         IA oferece: "Continuar no assistente →"
                         Carlos aceita (opcional)
                         Abre S-10 — IA Chat
                         (com contexto da conversa preservado)
```

---

## Fluxo 6 — Acompanhamento de Solicitação

```
  ┌─────────────────────────────────────────────────────┐
  │          ACOMPANHAMENTO DE SOLICITAÇÃO              │
  └─────────────────────────────────────────────────────┘

  Carlos vê no Meu Dia: "Folga 25/06 · em análise"
       │
       ├── Estado Normal: item na seção Pendências
       │
       └── Estado Atenção: card com borda âmbar em "Requer Atenção"
                │
                ▼
           Carlos toca "Ver" no item
                │
                ▼
           Navega para S-06 — Solicitações
           Solicitação específica já expandida
                │
                ├── Resposta recebida (aprovada/negada) ──→
                │        Carlos lê resultado
                │        Se negada: IA explica motivo
                │        Carlos retorna ao Meu Dia
                │        Badge de Solicitações desaparece
                │
                └── Ainda sem resposta ──→
                         Carlos vê estado atual
                         Retorna ao Meu Dia
```

---

## Fluxo 7 — Acompanhamento de Entrega

```
  ┌─────────────────────────────────────────────────────┐
  │            ACOMPANHAMENTO DE ENTREGA                │
  └─────────────────────────────────────────────────────┘

  Carlos vê no Meu Dia: entrega com prazo próximo
       │
       └── Carlos toca "Ver" no item
                │
                ▼
           Navega para S-07 — Entregas
           Entrega específica já aberta
                │
                ├── Entrega já enviada ──→ Carlos vê estado "aguardando revisão"
                │
                ├── Entrega não enviada ──→
                │        Carlos lê detalhes (objetivo, critério, prazo)
                │        IA interpreta o objetivo em linguagem pessoal
                │        Carlos trabalha externamente
                │        Retorna ao app para enviar
                │        Toca "Enviar entrega"
                │        Entrega muda para "aguardando revisão"
                │        Retorna ao Meu Dia
                │        Prazo não aparece mais na seção de atenção
                │
                └── Feedback recebido ──→
                         Badge de Entregas ativo
                         Carlos lê feedback
                         Se aprovada: desaparece do Meu Dia
                         Se revisão necessária: continua com status "revisão"
```

---

---

# WIREFRAME 5 — ESTADO VAZIO

**Cenário:** Carlos abre o app em um domingo — dia livre. Nenhuma atividade. Sem pendências urgentes.

```
╔═══════════════════════════════════════╗
║  STATUS BAR   ·   22/06 Dom  ·  10:15 ║
╠═══════════════════════════════════════╣
║                                       ║
║  Bom dia, Carlos         [avatar] [·] ║
║  Musical das Estrelas                 ║
║                                       ║
║  ─────────────────────────────────    ║
║                                       ║
║  ┌─────────────────────────────────┐  ║
║  │                                 │  ║
║  │  Hoje não há atividades         │  ║  ← T1 — comunicado com clareza
║  │  programadas.                   │  ║
║  │                                 │  ║
║  │  Próxima atividade:             │  ║  ← T2 — futuro próximo
║  │  Segunda, 24/06                 │  ║
║  │  Ensaio Técnico · 10:00         │  ║
║  │                                 │  ║
║  └─────────────────────────────────┘  ║
║                                       ║
║  ┌─────────────────────────────────┐  ║
║  │ ~                               │  ║
║  │ ~ Dia livre. Sua próxima        │  ║
║  │ ~ atividade é segunda, 10h.     │  ║
║  │ ~ Você tem uma solicitação      │  ║
║  │ ~ pendente de análise.          │  ║
║  │                                 │  ║
║  │ ( Perguntar à IA )              │  ║
║  └─────────────────────────────────┘  ║
║                                       ║
║  PENDÊNCIAS                           ║
║  ┌─────────────────────────────────┐  ║
║  │  Folga 25/06 · em análise há 2d │  ║
║  └─────────────────────────────────┘  ║
║                                       ║
║  ─────────────────────────────────    ║
║                                       ║
║  [Grande espaço em branco]            ║  ← Respira. Não preenche.
║                                       ║
╠═══════════════════════════════════════╣
║  ■ Meu Dia  ○ Solic  ○ Entregas ○ Msg ║
╚═══════════════════════════════════════╝
```

**Anotação:** o dia vazio é comunicado positivamente — não como erro ou tela em branco. A IA ainda está presente. A próxima atividade futura âncora o Membro no tempo.

---

---

# WIREFRAME 6 — LINHA DO TEMPO EXPANDIDA

```
╔═══════════════════════════════════════╗
║  STATUS BAR   ·   18/06 Qui  ·  11:30 ║
╠═══════════════════════════════════════╣
║                                       ║
║  Bom dia, Carlos         [avatar] [·] ║
║  Musical das Estrelas                 ║
║                                       ║
║  ┌─────────────────────────────────┐  ║
║  │  [Próxima Atividade — compacta] │  ║  ← Card ainda presente, mas menor
║  │  Musical das Estrelas · 14h · Marcos │
║  └─────────────────────────────────┘  ║
║                                       ║
║  HOJE — 3 ATIVIDADES        ( ∧ )    ║  ← Toggle: expandido
║  ┌─────────────────────────────────┐  ║
║  │                                 │  ║
║  │  ● 09:00 ─────────────────────  │  ║
║  │  │ Aquecimento técnico          │  ║  ← Atividade passada (atenuada)
║  │  │ Estúdio B · Sem papel espec. │  ║
║  │  ● ────────────────────────── ✓ │  ║
║  │                                 │  ║
║  │  Intervalo · 2h30               │  ║  ← Intervalo entre atividades
║  │                                 │  ║
║  │  ● 14:00 ─────────────────────  │  ║
║  │  │ Musical das Estrelas   SHOW  │  ║  ← Próxima (destacada levemente)
║  │  │ Teatro Principal             │  ║
║  │  │ Seu papel: Marcos        ✓   │  ║
║  │  ● ─────────────────────────── ▶│  ║  ← Seta indica "agora"
║  │                                 │  ║
║  │  Intervalo · sem intervalo      │  ║
║  │                                 │  ║
║  │  ● 17:45 ─────────────────────  │  ║
║  │  │ Sessão de fotos        FOTO  │  ║  ← Atividade futura (normal)
║  │  │ Camarim Principal            │  ║
║  │  │ Participação: toda a companhia│  ║
║  │  ● ────────────────────────────  │  ║
║  │                                 │  ║
║  └─────────────────────────────────┘  ║
║                                       ║
║  ┌─────────────────────────────────┐  ║
║  │ ~ Três atividades hoje. A       │  ║
║  │ ~ Sessão de Fotos começa logo   │  ║
║  │ ~ depois do show — sem intervalo│  ║
║  └─────────────────────────────────┘  ║
║                                       ║
╠═══════════════════════════════════════╣
║  ■ Meu Dia  ○ Solic  ○ Entregas ○ Msg ║
╚═══════════════════════════════════════╝
```

**Anotações:**
- Atividades passadas: atenuadas (opacidade reduzida), com check ✓
- Próxima atividade: levemente destacada, seta ▶
- Atividades futuras: normais
- Intervalo: indicado em texto entre as atividades
- IA adapta a narrativa para o contexto da linha do tempo expandida

---

---

# PARTE 5 — AUDITORIA DO WIREFRAME

---

## Coerência com as Pesquisas

| Descoberta de pesquisa | Resposta no wireframe |
|---|---|
| **D1 — Segurança antes de informação** | Card de Próxima Atividade é o elemento dominante no Estado Normal. Carlos sabe o que fazer antes de qualquer scroll. ✅ |
| **D2 — Mudanças são mais importantes que programação estável** | Bloco de Alteração ocupa 45-50% do viewport quando existe. Nada compete. ✅ |
| **D3 — Limbo = silêncio sem significado** | Meu Dia sempre comunica o estado — incluindo "Folga em análise há 2 dias". Nunca vazio de informação. ✅ |
| **D4 — O app é aberto em contextos variados** | A informação mais importante cabe acima do fold. Nenhum scroll necessário para certeza básica. ✅ |
| **D5 — Confirmação deve ser simples** | Bloco de Alteração: botão full-width, única ação primária da tela. ✅ |
| **D9 — Confiança vem de consistência** | Estrutura idêntica em todos os estados — apenas o conteúdo muda. Carlos sabe onde olhar. ✅ |
| **D10 — Histórico como prova** | Cada confirmação registrada. Acessível via S-11 (sem estar no Meu Dia). ✅ |

---

## Coerência com as Jornadas

| Jornada | Wireframe correspondente | Validação |
|---|---|---|
| **JM-01 — Abertura do Dia** | Wireframe 1 (Normal) + Wireframe 5 (Vazio) | Carlos abre o app, vê o estado imediato. ✅ |
| **JM-02 — Descoberta de Mudança** | Wireframe 3 + Fluxo 2 + Fluxo 3 | Notificação → Meu Dia com Bloco → Confirmar. ✅ |
| **JM-03 — Solicitação de Folga** | Fluxo 6 | Meu Dia → Solicitações → criar. Retorno natural. ✅ |
| **JM-04 — Dúvida sobre o Show** | Fluxo 5 + Wireframe 6 | IA inline → sem troca de tela. Linha do Tempo disponível. ✅ |
| **JM-05 — Entrega** | Fluxo 7 | Meu Dia → Entregas. Prazo visível antes da troca. ✅ |
| **JM-06 — Solicitação Negada** | Fluxo 6 (ramo "resposta recebida") | IA explica motivo. Estado de Atenção resolve. ✅ |

---

## Coerência com a Arquitetura de Navegação

| Princípio de navegação | Validação |
|---|---|
| **Frequência determina posição** | Próxima Atividade = posição 1. Histórico = não aparece. ✅ |
| **Home não é menu** | Meu Dia apresenta estado — não um índice de features. ✅ |
| **Notificação leva à superfície** | Push → Meu Dia (Estado Crítico). Não a um feed. ✅ |
| **IA embarcada na home** | Card IA presente em todos os estados. Sem trocar de tela para usar. ✅ |
| **Profundidade máxima de 3 níveis** | Meu Dia → Solicitações → Item = 3 níveis. Confirmação = 2 níveis. ✅ |
| **Nav bar com 4 itens** | Meu Dia / Solicitações / Entregas / Mensagens — confirmado nos wireframes. ✅ |

---

## Coerência com a Identidade da Asa

| Princípio de identidade | Como aparece no wireframe |
|---|---|
| **Leveza** | Espaço em branco generoso nos estados Normal e Vazio. Seções secundárias recolhidas. ✅ |
| **Profundidade** | Hierarquia visual com 3 planos distintos. Informação secundária acessível mas não imposta. ✅ |
| **Direção** | Ação mais importante (Confirmar) tem maior área. A IA direciona para o que importa. ✅ |
| **Precisão** | Nenhum elemento sem função. Seções que não têm conteúdo não aparecem. ✅ |
| **Não ERP** | Sem tabelas, sem labels de campo, sem menus de filtro, sem IDs de registro. ✅ |

---

## Coerência com a Filosofia "O Membro Busca Certeza"

Este é o teste mais importante da auditoria.

### O wireframe responde às 5 perguntas do Membro?

**"Tenho show hoje?"**
→ Estado Normal: Card de Próxima Atividade. Resposta em < 1 segundo. ✅

**"O que mudou desde ontem?"**
→ Estado Crítico: Bloco de Alteração em destaque absoluto. Resposta em < 1 segundo. ✅

**"Qual é o meu papel?"**
→ Estado Normal: "Seu papel: Marcos" — T1 bold dentro do card. ✅

**"Tenho alguma pendência que precisa de ação?"**
→ Estado Atenção: seção "Requer sua atenção" com cards específicos. ✅

**"Está tudo bem para o show de hoje?"**
→ Estado Normal: IA confirma em 1 linha. ✅

---

## Problemas identificados e ajustes

### P1 — O Card de Próxima Atividade não desaparece no Estado Crítico (correto)

O Card continua abaixo do Bloco de Alteração no estado crítico. Isso é intencional — Carlos precisa ver como ficou a atividade com a mudança aplicada. O label "PRÓXIMA ATIVIDADE — ATUALIZADA" confirma que ele já reflete a alteração.

**Decisão mantida.** ✅

### P2 — Texto tachado no "antes" (precisa de atenção especial no móvel)

O tachado em texto muito pequeno pode não ser legível em displays de baixa resolução. A spec usa "~~" para representar isso — na implementação, deve ser combinado com cor cinza para garantir percepção mesmo sem ver o traço.

**Recomendação:** combinar strike-through + cor T4 (cinza silenciado) para dupla garantia visual. ⚠

### P3 — Múltiplas alterações (wireframe 3B)

O peek da segunda alteração abaixo da primeira comunica que há mais — mas Carlos pode não entender a metáfora imediatamente. O label "Alteração 1 de 2" é a âncora textual para isso.

**Decisão:** manter peek + label textual. Suficiente para comunicar sem explicar. ✅

### P4 — IA em estado crítico — foco no conteúdo relevante

No estado crítico, a narrativa da IA deve ser específica para a alteração — não uma narrativa genérica do dia. O wireframe mostra isso ("Seu papel mudou de Astrid para Marcos..."). Na implementação, a IA precisa detectar que existe um Bloco ativo e ajustar o conteúdo do card automaticamente.

**Recomendação para spec técnica:** flag de estado "alteração_ativa" dispara narrativa contextual da IA no card. ⚠

### P5 — Empty state não é suficientemente afirmativo

O wireframe 5 (dia vazio) mostra a informação corretamente, mas a linguagem pode parecer negativa ("Hoje não há atividades programadas"). A intenção é que o dia livre seja positivo.

**Ajuste recomendado:** testar com "Dia livre hoje · Próxima atividade: [data]" como abertura. Mais leve. ⚠

---

## Veredicto da Auditoria

**O wireframe estrutural de S-01 Meu Dia está aprovado para avançar ao mockup visual.**

Todas as decisões críticas (D1–D5 no escopo do Meu Dia) foram validadas estruturalmente. As 5 perguntas da filosofia "o membro busca certeza" têm resposta visual clara em todos os estados. 4 ajustes menores foram identificados (P2, P4, P5 como atenções; P1, P3 confirmados como corretos).

---

## Próximos passos

1. **Mockup Visual de S-01** — aplicar o sistema de cores, tipografia, componentes e identidade da Asa sobre esta estrutura validada
2. **Wireframe de S-02** — Painel Operacional (Supervisor)
3. **Wireframe de S-04** — Escala (Supervisor / Admin)

---

*Documento base para mockup visual: docs/design-visual-bloco1-myasa-2.0.md*
*Especificação funcional de referência: docs/especificacao-bloco1-myasa-2.0.md*
