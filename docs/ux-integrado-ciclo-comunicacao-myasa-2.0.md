# MyASA 2.0 — UX Integrado do Ciclo de Comunicação Operacional

> **Versão:** 18/06/2026
> **Fase:** UX Estratégico — anterior a wireframes
> **Base:** Entidade Mudança Operacional · Ciclo de Comunicação Operacional · Bloco 1 · S-06
> **Escopo:** S-05 Livro do Dia · S-08 Avisos · S-11 Histórico
> **Status:** 🟢 Pronto para Wireframe

---

## Princípio fundador deste documento

Três superfícies. Uma realidade. Três perspectivas.

S-05, S-08 e S-11 não são três produtos separados. São três janelas para o mesmo fato operacional — a Mudança Operacional. O design de cada uma deve reconhecer as outras duas: o que aparece em uma não precisa ser repetido nas outras, e quem está em uma deve conseguir chegar às outras sem perder o contexto.

**O risco de design que este documento existe para evitar:**
> Três superfícies projetadas isoladamente que juntas criam fragmentação, duplicação e navegação sem sentido.

---

## PARTE 1 — O QUE CADA PERFIL VÊ PRIMEIRO

---

### S-05 — Livro do Dia

| Perfil | O que vê primeiro | Por quê |
|---|---|---|
| **Supervisor** | Estado de cobertura: quantas posições cobertas / em risco / em aberto — antes de ver qualquer nome ou papel | A pergunta operacional é "está pronto?" — não "quem está onde". A cobertura responde essa pergunta em segundos. |
| **Membro** | Seu papel neste show e o que é diferente do usual | O Membro não vê o Livro inteiro — vê sua fatia. A primeira informação é "o que eu faço" e "tem algo diferente do esperado?". |
| **Admin** | Status do Livro (PUBLICADO / DESATUALIZADO / CANCELADO) e data de publicação | O Admin não gerencia shows — audita. O status e o momento da publicação são o que importa para ele. |

**Regra de conteúdo por perfil:**

O Supervisor vê o **Livro completo** — todas as posições, todos os membros alocados, todos os alertas.
O Membro vê **apenas sua fatia** — seu papel, suas particularidades, o que mudou para ele.
O Admin vê **metadados do Livro** — versões, publicações, alertas pendentes — e pode descer ao detalhe se necessário.

---

### S-08 — Avisos

| Perfil | O que vê primeiro | Por quê |
|---|---|---|
| **Membro** | Avisos não lidos, ordenados por urgência (Crítico → Importante → Informativo) | A pergunta do Membro é "existe algo que preciso fazer agora?". Urgência determina a ordem — não a data. |
| **Supervisor** | Painel de confirmações: quem confirmou vs. quem não confirmou, com countdown de proximidade | O Supervisor não gerencia o conteúdo do Aviso — já enviou. Agora gerencia a confirmação. |
| **Admin** | Avisos sem confirmação acima do limiar de tempo + padrões de não-confirmação | O Admin não recebe avisos operacionais diretamente — monitora falhas no ciclo de comunicação. |

**Regra fundamental de S-08:** o Membro e o Supervisor têm visões completamente diferentes da mesma superfície. Para o Membro, S-08 é uma caixa de recebimento. Para o Supervisor, S-08 é um painel de rastreamento. Não são a mesma tela com permissões diferentes — são experiências distintas dentro da mesma superfície.

---

### S-11 — Histórico

| Perfil | O que vê primeiro | Por quê |
|---|---|---|
| **Admin** | Mudanças Operacionais agrupadas — com narrativa resumida da IA para cada uma, ordenadas por data | O Admin precisa entender rapidamente o que aconteceu em um período — não ler evento por evento. |
| **Supervisor** | Histórico do seu Grupo Operacional — filtrado por padrão para seu escopo | O Supervisor investiga eventos dentro do seu grupo. Ver todo o Histórico da Operação seria ruído. |
| **Membro** | Histórico pessoal — mudanças que afetaram ele, solicitações que criou, confirmações que deu | O Membro nunca vê dados de outros membros no Histórico. Seu histórico é exclusivamente individual. |

---

## PARTE 2 — AÇÃO, CONFIRMAÇÃO E CONSULTA

---

### O que exige ação

**Ação** é quando o usuário precisa fazer algo para que o sistema avance — não apenas ler.

| Superfície | Perfil | O que exige ação | Consequência de não agir |
|---|---|---|---|
| **S-05** | Supervisor | Revisar Livro DESATUALIZADO | Membros operam com informação desatualizada |
| **S-05** | Supervisor | Publicar Livro após revisão | Mudança não chega aos membros |
| **S-05** | Supervisor | Resolver posição Em Aberto | Show ocorre com posição descoberta |
| **S-08** | Supervisor | Agir sobre membro não confirmado próximo do horário | Membro executa sem saber o que fazer |
| **S-08** | Membro | Confirmar Aviso de nível Importante ou Crítico | Persiste como pendente no Supervisor; escalada automática |
| **S-11** | Supervisor | Registrar Restrição após aprovação da Solicitação | Gap de cobertura não detectado pelo motor |
| **S-11** | Admin | Investigar padrão identificado pela IA | Problema sistêmico continua sem intervenção |

**Regra de design:** ações devem ser apresentadas com seu contexto de consequência. O usuário nunca vê apenas um botão — vê o botão com o peso da inação. Ex.: não "Revisar Livro" mas "Livro desatualizado — 3 membros ainda verão a versão antiga."

---

### O que exige confirmação

**Confirmação** é quando o usuário precisa sinalizar que recebeu e absorveu uma informação.

| Superfície | Perfil | O que exige confirmação | Gatilho |
|---|---|---|---|
| **S-05** | Membro | Nova publicação do Livro do Dia que altera sua posição | Publicação pelo Supervisor |
| **S-08** | Membro | Aviso de nível Importante (nova alocação, mudança de papel, mudança de horário) | Publicação da Escala/Livro |
| **S-08** | Membro | Aviso de nível Crítico (cancelamento, revogação) | Evento crítico |
| **S-08** | Supervisor | Novo escopo após Mudança de Estrutura | Admin reconfigura grupos |

**Regra de confirmação — inegociável:** toda confirmação mostra o delta (era → agora) antes do botão. Confirmar sem ver o que está confirmando não é uma confirmação — é um gesto vazio.

**Regra de não-duplicação de confirmação:** se o Membro confirma no Meu Dia (S-01), ele não precisa confirmar de novo no Aviso (S-08). A confirmação é feita uma única vez, válida para todas as superfícies. O estado "confirmado" propaga para todas as representações do mesmo evento.

---

### O que é apenas consulta

**Consulta** é quando o usuário acessa informação sem que o sistema espere nada de volta.

| Superfície | Perfil | O que é consulta |
|---|---|---|
| **S-05** | Membro | Ver detalhes do Livro do Dia de um show (além da sua fatia) |
| **S-05** | Admin | Ver qualquer versão do Livro do Dia |
| **S-08** | Membro | Ler Avisos Informativos |
| **S-08** | Qualquer | Ler Avisos já confirmados |
| **S-11** | Qualquer | Acessar o Histórico de qualquer Mudança Operacional |
| **S-11** | Membro | Consultar histórico de suas solicitações passadas |
| **S-11** | Supervisor | Verificar quem confirmou o quê em uma Mudança passada |

---

## PARTE 3 — JORNADAS INTEGRADAS

---

### JI-01 — Supervisor: do Aviso ao Livro publicado

**Trigger:** Solicitação de Folga aprovada → sistema cria Mudança Operacional → Livro vai para DESATUALIZADO

**Jornada:**

```
PAINEL OPERACIONAL (S-02)
  └── Badge: "1 Livro do Dia desatualizado"
             │
             │ Supervisor toca
             ▼
LIVRO DO DIA (S-05) — estado: DESATUALIZADO
  └── O que o Supervisor vê primeiro:
      ├── Banner: "Livro desatualizado · Folga de Amanda aprovada em 17/06"
      ├── Cobertura atual: 11 cobertas · 1 em risco · 1 em aberto
      └── Posições afetadas em destaque (não lista completa)
             │
             │ Supervisor toca na posição Em Aberto (Astrid · Musical 12h30)
             ▼
RESOLUÇÃO DA POSIÇÃO (dentro de S-05)
  └── Candidatos classificados por risco [IA]
  └── Simulação de cascata disponível
  └── Supervisor seleciona Beatriz Lima
             │
             │ Supervisor aprova Livro revisado
             ▼
PUBLICAÇÃO (dentro de S-05)
  └── Validações do sistema
  └── Resumo do delta: "2 posições alteradas. 3 membros serão notificados."
  └── Supervisor confirma publicação
             │
             │ Sistema publica + gera Avisos + atualiza Meu Dia
             ▼
RASTREAMENTO (S-08 — visão do Supervisor)
  └── "3 membros notificados. 0 confirmaram."
  └── [15 min depois] "2 confirmaram. Carlos pendente."
  └── [Show em 1h] Alerta: "Carlos não confirmou. Show em 60 min."
             │
             │ Supervisor decide contato direto com Carlos
             ▼
HISTÓRICO (S-11) — registro automático
  └── Narrativa completa da MO: causa → decisão → publicação → comunicação → confirmações
```

**Duração esperada:** 3-8 minutos para o fluxo principal. Monitoramento de confirmações: contínuo, passivo, com alertas proativos.

---

### JI-02 — Membro: do Aviso à confirmação

**Trigger:** Supervisor publica Livro do Dia republicado → sistema envia Aviso → Membro recebe push

**Jornada:**

```
PUSH NOTIFICATION
  └── "Sua programação do sábado mudou. Confirme."
             │
             │ Membro toca no push
             ▼
MEU DIA (S-01) — card de alteração no topo
  └── Card ALTERAÇÃO:
      ├── Era: Musical 12h30 · Mensageira
      └── Agora: Musical 12h30 · Astrid
  └── [Botão: Ver detalhes]
             │
             ├── Membro confirma direto ──────────────────────────────────► CONFIRMADO
             │   └── Card desce para linha do tempo
             │   └── Supervisor vê confirmação em tempo real (S-08)
             │   └── Histórico registra: confirmação às [hora]
             │
             └── Membro quer entender mais
                        │
                        │ Toca em "Ver detalhes"
                        ▼
             LIVRO DO DIA (S-05) — fatia do Membro
               └── Papel completo de Astrid neste show
               └── Diferenças em relação ao usual [destacadas]
               └── Informações do Livro do Show para Astrid
               └── [Botão: Perguntar à IA] ────► "O que mudou exatamente?"
                        │
                        │ Membro entende, volta ao Meu Dia, confirma
                        ▼
             CONFIRMADO
```

**Princípio de design:** o Membro nunca precisa ir a S-08 para confirmar. A confirmação acontece onde ele está — Meu Dia (S-01) ou Livro do Dia (S-05). S-08 para o Membro é consulta de histórico, não ponto de confirmação.

---

### JI-03 — Admin: investigação retrospectiva

**Trigger:** Admin recebe reclamação de que um membro foi escalado em posição incompatível com sua restrição médica.

**Jornada:**

```
PAINEL DE SAÚDE (S-03)
  └── Admin pesquisa: "Amanda Souza · junho"
             │
             ▼
HISTÓRICO (S-11) — filtrado por membro + período
  └── Lista de Mudanças Operacionais que afetaram Amanda em junho
  └── [Narrativas resumidas pela IA para cada MO]
             │
             │ Admin identifica: MO-0051 · Restrição Médica · 19/06
             │                   MO-0047 · Livro do Dia 21/06 v3
             ▼
DETALHE DA MO-0047 (dentro de S-11)
  └── Narrativa: "Amanda alocada como Astrid no Musical 21/06"
  └── Estado de cobertura no momento da publicação
  └── Alertas ativos no momento da publicação [se houver]
  └── Quem publicou + quando
  └── [Link: "Ver Livro do Dia v3 de 21/06"]
             │
             │ Admin acessa o link
             ▼
LIVRO DO DIA (S-05) — versão v3 de 21/06 [modo leitura]
  └── Estado completo do Livro como estava publicado
  └── Posição de Amanda: Astrid · Musical 12h30
  └── [Restrição de Amanda ativa nesta data: Médica · acrobacia]
  └── [Sistema: nenhum alerta de conflito foi gerado na publicação]
             │
             │ Admin identifica a causa: papel Astrid sem tag de exigência física
             ▼
INVESTIGAÇÃO CONCLUÍDA
  └── Admin registra: "Papel Astrid no Livro do Show sem tag de exigência.
       Motor de restrições não detectou conflito. Correção necessária na configuração."
  └── Histórico registra a investigação do Admin como evento
```

**Princípio de design:** a investigação parte do Histórico (contexto) → desce ao Livro do Dia (evidência) → nunca precisa de S-08 (a comunicação já foi, é dado passado). A navegação é sempre de contexto → detalhe, nunca ao contrário.

---

### JI-04 — Supervisor: cancelamento de show no mesmo dia

**Trigger:** Show das 12h30 cancelado às 10h15. Supervisora precisa comunicar imediatamente.

**Jornada:**

```
AGENDA (fora do escopo deste documento — gera o evento)
  └── Supervisora cancela show
  └── Sistema pergunta: "Impactar Escala?"
  └── Supervisora confirma: Sim
             │
             │ Sistema processa Mudança de Show
             ▼
PAINEL OPERACIONAL (S-02) — atualizado automaticamente
  └── Status: CRÍTICO
  └── "Musical 12h30 cancelado. 8 membros alocados. 0 confirmaram."
             │
             │ [O que a Supervisora faz agora?]
             │ Sistema não exige ação — Avisos já foram enviados automaticamente
             │ Mas o monitoramento está disponível imediatamente
             ▼
AVISOS (S-08) — visão do Supervisor
  └── Aviso Crítico enviado: "Musical 12h30 · CANCELADO"
  └── Destinatários: 8 | Confirmaram: 0
  └── [2 min depois] Confirmaram: 3
  └── [10 min depois] Confirmaram: 6 | Pendentes: Carlos, Débora
  └── [Alerta: "Carlos não confirmou. Atividade cancelada em 2h10."]
  └── [Botão: "Ver contato direto de Carlos"] ← lista de contato, não conversa in-app
             │
             │ Supervisora liga para Carlos
             │ Carlos aparece ciente
             ▼
HISTÓRICO (S-11) — gerado automaticamente
  └── MO-0089 · Cancelamento · Musical 12h30 · 19/06 · 10h15
  └── Causa: [motivo declarado pela Supervisora]
  └── 8 membros notificados · 7 confirmaram · Carlos: expirado sem confirmação
  └── Nota: Carlos compareceu ciente após contato direto da Supervisora
```

---

### JI-05 — Membro: investigando o próprio histórico

**Trigger:** Membro quer entender por que suas escalas mudaram tanto neste mês.

**Jornada:**

```
MEU DIA (S-01) — entrada
  └── [Acesso ao Histórico pessoal]
             │
             ▼
HISTÓRICO PESSOAL (S-11 — visão do Membro)
  └── Filtro: junho
  └── Lista de eventos que o afetaram:
      ├── 14/06 · Solicitação de Folga · Negada · [motivo]
      ├── 19/06 · Nova alocação: Ensaio 16h Bloco 3
      ├── 21/06 · Substituição revertida: retornou ao papel original
      └── 23/06 · Restrição Médica registrada
             │
             │ Membro toca em 19/06 (nova alocação)
             ▼
DETALHE DA MO (dentro de S-11 — visão limitada do Membro)
  └── "Você foi alocado no Bloco 3 do Ensaio de 19/06
       porque Amanda Souza obteve folga nessa data."
  └── [Aviso que você recebeu: ver]
  └── [Você confirmou às 18h40]
             │
             │ Membro toca em "ver Aviso"
             ▼
AVISO ARQUIVADO (S-08 — histórico do Membro)
  └── Conteúdo original do Aviso de 19/06 às 18h22
  └── Status: Confirmado às 18h40
  └── [Botão: Perguntar à IA sobre este evento]
```

**Princípio de design:** o Membro acessa o Histórico como narrativa pessoal — nunca como log técnico. Ele vê "o que aconteceu comigo" — não "o que aconteceu na operação".

---

## PARTE 4 — ARQUITETURA DE INFORMAÇÃO

---

### S-05 — Livro do Dia

**Dois eixos organizadores:** Show + Data

```
LIVRO DO DIA
├── [Seleção de Data]
│     └── Calendário com indicadores: Livro publicado · DESATUALIZADO · Sem Livro
│
└── [Livro da data selecionada]
      ├── Cabeçalho
      │     ├── Show: [nome]
      │     ├── Data: [data]
      │     ├── Estado: PUBLICADO v3 · publicado por Ana Silva · 17/06 às 18h22
      │     └── [Se DESATUALIZADO]: banner de revisão necessária
      │
      ├── Cobertura Geral [primeira informação para o Supervisor]
      │     ├── Cobertas: 11
      │     ├── Em Risco: 1
      │     └── Em Aberto: 1 [destacado — exige ação]
      │
      ├── Posições [lista completa — Supervisor]
      │     ├── [posição coberta]: Papel · Membro · Estado
      │     ├── [posição em risco]: Papel · Membro · motivo do risco
      │     └── [posição em aberto]: Papel · [resolver] · candidatos disponíveis
      │
      ├── Minha posição [primeira informação para o Membro]
      │     ├── Papel: [nome do papel]
      │     ├── [Se diferente do usual]: tag ALTERADO + comparativo
      │     └── Particularidades do show para este papel
      │
      └── Histórico de versões [acesso sob demanda]
            ├── v1 · 15/06 · publicado por Ana Silva
            ├── v2 · 16/06 · republicado (folga de Pedro)
            └── v3 · 17/06 · republicado (restrição de Beatriz)
```

**Regra de conteúdo:**
- Supervisor acessa o Livro completo. Sua visão padrão é o Livro completo.
- Membro acessa o Livro da data/show a partir do Meu Dia — e vê apenas sua fatia por padrão. Pode expandir para ver o Livro completo, mas a fatia é o padrão.
- Admin acessa Livro em modo leitura — sem poder publicar ou editar.

---

### S-08 — Avisos

**Dois eixos organizadores por perfil:**

**Para o Membro:** Urgência + Status de leitura

```
AVISOS (visão do Membro)
├── [Pendentes de confirmação — topo]
│     └── Avisos Importantes e Críticos não confirmados
│           ├── [Aviso Crítico]: banner destacado · confirmação bloqueante
│           └── [Aviso Importante]: card com botão confirmar
│
├── [Lidos — histórico]
│     ├── Avisos confirmados, ordenados por data (mais recente primeiro)
│     ├── Avisos informativos lidos
│     └── [Filtros: por superfície de origem, por período]
│
└── [Não lidos — indicador]
      └── Badge no ícone de Avisos indicando quantos não lidos
```

**Para o Supervisor:** Rastreamento de confirmação

```
AVISOS (visão do Supervisor)
├── [Avisos com confirmação pendente — urgente]
│     └── Para cada Aviso com pendente:
│           ├── Aviso enviado: [conteúdo resumido] · [data/hora]
│           ├── [Membros que confirmaram]: lista com ✓
│           ├── [Membros pendentes]: lista com tempo decorrido
│           └── [Alerta de proximidade]: "Show em Xh. Carlos não confirmou."
│
├── [Avisos recentes — informativos]
│     └── Avisos enviados recentemente sem pendência
│
└── [Criar Aviso manual]
      └── Para comunicação operacional adicional
```

---

### S-11 — Histórico

**Dois eixos organizadores:** Mudança Operacional + Tempo

```
HISTÓRICO
├── [Filtros principais]
│     ├── Por membro [Supervisor pesquisa membro específico]
│     ├── Por data ou período
│     ├── Por tipo de Mudança Operacional
│     └── Por Grupo Operacional [para Supervisor com múltiplos grupos]
│
├── [Lista de Mudanças Operacionais]
│     └── Para cada MO:
│           ├── Resumo da IA: 1-2 frases do que aconteceu
│           ├── Data · Tipo · Membros afetados
│           ├── Estado final: Confirmada / Expirada / Revogada
│           └── [Expandir para ver narrativa completa]
│
└── [Detalhe de uma MO]
      ├── Narrativa expandida da IA
      ├── Linha do tempo de eventos
      ├── Delta da Escala (antes → depois)
      ├── Versões do Livro do Dia geradas
      ├── Avisos enviados e confirmações
      ├── [Links para as superfícies originais]
      └── Padrão detectado [se reincidência]
```

---

## PARTE 5 — HIERARQUIA DE CONTEÚDO

---

### Por perfil × superfície

#### Supervisor

| Superfície | 1º — Imediato | 2º — Contextual | 3º — Profundo |
|---|---|---|---|
| **S-05** | Estado de cobertura (números) | Lista de posições com status | Candidatos e cascata por posição |
| **S-08** | Confirmações pendentes com urgência | Avisos recentes enviados | Histórico de Avisos passados |
| **S-11** | Mudanças do dia/semana no grupo | Narrativa de cada MO | Padrões e reincidências |

#### Membro

| Superfície | 1º — Imediato | 2º — Contextual | 3º — Profundo |
|---|---|---|---|
| **S-05** | Meu papel neste show | O que é diferente do usual | Detalhes do Livro do Show para meu papel |
| **S-08** | Confirmações pendentes | Avisos recentes não lidos | Histórico de Avisos confirmados |
| **S-11** | Eventos que me afetaram | Contexto de cada evento | Solicitações passadas e seus resultados |

#### Admin

| Superfície | 1º — Imediato | 2º — Contextual | 3º — Profundo |
|---|---|---|---|
| **S-05** | Estado do Livro + metadados | Versões e publicações | Posições e cobertura (modo auditoria) |
| **S-08** | Avisos Críticos sem confirmação além do limiar | Padrões de não-confirmação | Avisos passados por Operação |
| **S-11** | Narrativas de MOs agrupadas | Padrões detectados pela IA | Investigação linha por linha |

---

### Hierarquia dinâmica — regras de reordenação

A hierarquia de conteúdo é estática por padrão, mas se reorganiza automaticamente quando:

**Para o Supervisor:**
- Existe Livro DESATUALIZADO com data em < 24h → S-05 sobe na prioridade do Painel Operacional
- Aviso Crítico com membro não confirmado + atividade em < 1h → S-08 sobe com alerta no topo
- Padrão de reincidência detectado pela IA → S-11 aparece como item de atenção no Painel

**Para o Membro:**
- Alteração não confirmada → S-01 Meu Dia mostra o card no topo (acima de tudo)
- Aviso de nível Crítico não confirmado → aparece como banner persistente na navegação

---

## PARTE 6 — REGRAS DE NAVEGAÇÃO

---

### Princípios gerais

**Princípio 1 — Contexto nunca é perdido**
Ao navegar de S-11 para S-05 (ex.: investigação abre o Livro específico), o usuário deve conseguir voltar ao ponto exato do Histórico de onde partiu — sem ter que recriar o filtro ou rolar para encontrar o item.

**Princípio 2 — Deep links são possíveis**
Qualquer Mudança Operacional, qualquer versão de Livro do Dia, qualquer Aviso deve ter um endereço único e acessível via link. O Histórico vincula diretamente ao Livro e ao Aviso — sem depender de navegação manual.

**Princípio 3 — A navegação segue a intenção**
- Supervisor com intenção de resolver → navega de S-11 ou S-02 para S-05
- Membro com intenção de entender → navega de S-08 ou S-01 para S-05 (sua fatia)
- Admin com intenção de investigar → navega de S-03 para S-11 e de S-11 para S-05 (modo leitura)
- Qualquer perfil curioso sobre contexto → navega para S-11

**Princípio 4 — Confirmação não exige troca de superfície**
O Membro confirma onde está — Meu Dia ou Livro do Dia. Não precisa ir a S-08 para confirmar. S-08 para o Membro é arquivo e consulta, não ponto de ação primário.

---

### Mapa de navegação entre as três superfícies

```
                    ┌──────────────────┐
                    │   S-02 / S-03    │
                    │ (Painéis de home)│
                    └────────┬─────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
      ┌───────────┐  ┌───────────┐  ┌───────────┐
      │  S-05     │  │  S-08     │  │  S-11     │
      │  LIVRO    │  │  AVISOS   │  │ HISTÓRICO │
      │  DO DIA   │  │           │  │           │
      └─────┬─────┘  └─────┬─────┘  └─────┬─────┘
            │              │              │
            │ [ver contexto│              │ [ver o que
            │  de uma      │              │  mudou]
            │  mudança]    │              │
            └──────────────┼──────────────┘
                           │
                     [investigar]
                           │
                    ┌──────┴──────┐
                    │  Retorna ao  │
                    │  ponto de   │
                    │  partida    │
                    └─────────────┘
```

**Fluxos autorizados de navegação cruzada:**

| De | Para | Gatilho | O que é preservado |
|---|---|---|---|
| S-11 | S-05 | "Ver Livro do Dia v3 de 21/06" | Contexto da MO aberta; volta ao Histórico no mesmo ponto |
| S-11 | S-08 | "Ver Aviso enviado" | Contexto da MO; volta ao Histórico no mesmo ponto |
| S-05 | S-11 | "Ver histórico desta versão" | Qual Livro e versão estava sendo visualizado |
| S-08 | S-05 | "Ver Livro do Dia relacionado" | Qual Aviso estava sendo visualizado |
| S-08 | S-11 | "Ver Mudança Operacional completa" | Qual Aviso estava sendo visualizado |
| S-01 (Meu Dia) | S-05 | "Ver detalhes do show" | Card de alteração permanece visível ao voltar |
| S-01 (Meu Dia) | S-08 | "Ver todos os Avisos" | Card de alteração permanece visível ao voltar |

---

### Regras de navegação por superfície

**S-05 — Livro do Dia:**
- A data selecionada persiste ao navegar para outra superfície e voltar
- Ao entrar no Livro via link do Histórico: sistema abre a versão específica indicada (não a versão mais recente)
- Ao entrar no Livro via Meu Dia (Membro): sistema abre diretamente na fatia do Membro — não no Livro completo

**S-08 — Avisos:**
- Ao confirmar um Aviso: o item não some imediatamente — muda de estado (de pendente para confirmado) e permanece visível por 2-3 segundos antes de descer para o histórico (feedback visual de ação completa)
- Ao abrir um Aviso via link do Histórico: sistema abre o Aviso específico em modo leitura, com link de volta ao Histórico
- Avisos de Cancelamento crítico: não podem ser arquivados ou marcados como "menos urgentes" pelo usuário

**S-11 — Histórico:**
- A primeira abertura do Histórico mostra o período mais recente (7 dias por padrão)
- Filtros aplicados persistem durante a sessão — não são resetados ao voltar de outra superfície
- A busca por membro retorna todas as MOs que afetaram aquele membro (não apenas as criadas por ele)

---

## PARTE 7 — COMO EVITAR DUPLICAÇÃO DE INFORMAÇÃO

---

### Regra mestre de distribuição de conteúdo

Cada informação tem uma superfície **primária** onde aparece com profundidade máxima. Nas outras superfícies, ela aparece apenas como **referência** (link ou resumo), nunca com profundidade igual.

| Informação | Superfície primária | Como aparece nas outras |
|---|---|---|
| Estado atual das posições do show | S-05 | S-11: delta histórico; S-08: aviso de mudança |
| Confirmação de leitura de um Aviso | S-08 | S-11: registrado como evento; S-05: não aparece |
| Causa de uma mudança | S-11 | S-05: link "ver por que mudou"; S-08: não aparece |
| Conteúdo de um Aviso específico | S-08 | S-11: link para o Aviso original |
| Narrativa de uma Mudança Operacional | S-11 | S-05: link "ver Mudança"; S-08: link "ver Mudança" |

**Aplicação prática:**
- O Livro do Dia não explica por que uma posição mudou — ele mostra o que é agora. O "por que" está no Histórico.
- O Aviso não descreve o estado completo da operação — ele notifica a mudança específica. O estado completo está no Livro do Dia.
- O Histórico não re-exibe o conteúdo do Livro nem o conteúdo do Aviso — ele vincula a eles.

---

### Anti-padrões a evitar

| Anti-padrão | Por que é um problema | Como evitar |
|---|---|---|
| Mostrar o Livro completo dentro do Aviso | O Aviso fica pesado e confuso — duplica o Livro | O Aviso mostra apenas o delta relevante para aquele membro + link para o Livro |
| Repetir a narrativa do Histórico dentro do Livro | O Livro vira um documento de auditoria — não um guia operacional | O Livro mostra estado presente; o Histórico mostra a história |
| Mostrar status de confirmação dentro do Livro do Dia | O Livro se confunde com painel de rastreamento de comunicação | Confirmações ficam em S-08; o Livro mostra apenas alocações |
| Mostrar versões antigas do Livro como padrão | O usuário pode agir sobre informação desatualizada | A versão mais recente é sempre o padrão; versões antigas são acesso explícito sob demanda |

---

## PARTE 8 — COMO PRESERVAR CONTEXTO AO TROCAR DE SUPERFÍCIE

---

### Contexto que precisa ser preservado

**Contexto de investigação** (quando o usuário está investigando algo):
- Qual Mudança Operacional estava sendo investigada
- Qual filtro estava aplicado no Histórico
- Qual versão do Livro estava sendo lida

**Contexto de ação** (quando o usuário estava no meio de uma ação):
- Qual posição estava sendo resolvida no Livro
- Qual Aviso estava sendo lido

**Contexto de confirmação** (quando o usuário ainda não confirmou):
- O card de alteração no Meu Dia não desaparece enquanto a confirmação estiver pendente — mesmo se o usuário navegar para S-05 ou S-08 e voltar

---

### Mecanismos de preservação

**Breadcrumb de contexto:**
Quando o usuário chega a uma superfície via link de outra, um breadcrumb mostra a origem:
```
S-11 › MO-0047 › Livro do Dia v3 · 21/06
```
O breadcrumb é um link — clicar volta ao ponto exato de origem.

**Estado de filtros persistente na sessão:**
Filtros aplicados em S-11 (por membro, por data) persistem durante toda a sessão. Ao voltar de S-05 para S-11, o filtro continua ativo — o usuário não recomeça do zero.

**Memória da versão do Livro:**
Quando o usuário acessa o Livro do Dia v3 via link do Histórico, e depois volta ao Histórico, o link indica "v3 visualizado" — permitindo distinguir que ele já leu aquela versão específica.

---

## PARTE 9 — COMO INVESTIGAR UMA MUDANÇA OPERACIONAL COMPLETA

---

### Protocolo de investigação em 5 passos

**Passo 1 — Contextualizar (S-11)**
Abrir o Histórico. Filtrar pela data, membro ou tipo de MO. Ler o resumo da IA para cada MO relevante. Identificar a MO que precisa ser investigada.

**Passo 2 — Entender a causa (S-11 — detalhe)**
Expandir a MO selecionada. Ver a linha do tempo de eventos. Identificar o evento gerador (Solicitação, ação direta, evento da Agenda). Ler a narrativa completa.

**Passo 3 — Verificar o impacto operacional (S-05)**
Via link do Histórico, abrir a versão específica do Livro do Dia afetada. Ver o estado de cobertura na data da MO. Comparar versões (antes e depois da MO).

**Passo 4 — Verificar a comunicação (S-08)**
Via link do Histórico, abrir o Aviso gerado pela MO. Verificar: quem recebeu, quem confirmou, quem não confirmou, em quanto tempo. Identificar se houve falha de comunicação ou de confirmação.

**Passo 5 — Conclusão**
Com os dados dos 4 passos, o investigador tem:
- O que aconteceu (S-11)
- Como estava a operação na hora (S-05)
- Se todos souberam (S-08)
- Se houve algum ponto cego (entre causa, cobertura e comunicação)

---

### Perguntas de investigação e onde encontrar as respostas

| Pergunta | Onde encontrar |
|---|---|
| O que aconteceu? | S-11 — resumo da MO |
| Por que aconteceu? | S-11 — evento gerador + cadeia causal |
| Quem decidiu? | S-11 — responsável pela publicação |
| O que estava escalado antes? | S-05 — versão anterior do Livro |
| O que estava escalado depois? | S-05 — versão posterior do Livro |
| Todos souberam? | S-08 — status de confirmação |
| Quem não confirmou? | S-08 — lista de pendentes |
| O membro que não confirmou foi coberto? | S-11 — registro de atividade sem confirmação |
| Existe padrão de reincidência? | S-11 — padrão detectado pela IA |
| O processo foi seguido corretamente? | S-11 — alertas registrados e alertas ignorados |

---

## PARTE 10 — VEREDITO

---

### Auditoria UX de consistência

| Critério | Status | Nota |
|---|---|---|
| Cada perfil vê o que importa primeiro | ✅ | Hierarquias de conteúdo definidas por perfil × superfície |
| Confirmação acontece uma única vez | ✅ | Confirmação no Meu Dia válida para todas as superfícies |
| Navegação cruzada preserva contexto | ✅ | Breadcrumb + filtros persistentes + deep links |
| Ausência de duplicação de conteúdo | ✅ | Mapa de distribuição definido; anti-padrões explicitados |
| Investigação possível sem treinamento | ✅ | Protocolo de 5 passos com IA como guia |
| As 3 superfícies contam a mesma história | ✅ | Mesma MO, três perspectivas coerentes |
| Regras de navegação consistentes | ✅ | Fluxos autorizados definidos; gatilhos e preservação de estado documentados |
| Hierarquia dinâmica por urgência | ✅ | Regras de reordenação automática definidas |

---

### Jornadas produzidas

| Jornada | Perfil | Superfícies envolvidas |
|---|---|---|
| JI-01 | Supervisor — do Aviso ao Livro publicado | S-02 → S-05 → S-08 → S-11 |
| JI-02 | Membro — do Aviso à confirmação | Push → S-01 → S-05 → Confirmado |
| JI-03 | Admin — investigação retrospectiva | S-03 → S-11 → S-05 |
| JI-04 | Supervisor — cancelamento de show | Agenda → S-02 → S-08 → S-11 |
| JI-05 | Membro — histórico pessoal | S-01 → S-11 → S-08 |

---

### Arquitetura de informação produzida

| Superfície | Eixos organizadores | Visão Supervisor | Visão Membro | Visão Admin |
|---|---|---|---|---|
| S-05 | Show + Data | Completa | Fatia pessoal | Metadados + leitura |
| S-08 | Urgência + Status | Rastreamento | Recebimento | Monitoramento de falhas |
| S-11 | MO + Tempo | Grupo operacional | Histórico pessoal | Toda a operação |

---

### Decisões de UX produzidas

| # | Decisão |
|---|---|
| UX-01 | S-08 tem duas experiências radicalmente diferentes: para o Membro é caixa de recebimento; para o Supervisor é painel de rastreamento |
| UX-02 | O Membro confirma no Meu Dia ou no Livro do Dia — nunca precisa ir a S-08 para confirmar |
| UX-03 | A versão mais recente do Livro do Dia é sempre o padrão; versões antigas são acesso explícito sob demanda |
| UX-04 | Ao chegar numa superfície via link de outra, o breadcrumb de origem é obrigatório com link de retorno |
| UX-05 | Filtros aplicados em S-11 persistem durante a sessão — nunca são resetados ao voltar de outra superfície |
| UX-06 | O Aviso mostra apenas o delta relevante para aquele membro — não o estado completo do Livro |
| UX-07 | O Histórico vincula às superfícies originais — nunca replica o conteúdo delas |
| UX-08 | A hierarquia de conteúdo se reorganiza automaticamente por urgência quando existem alertas ativos |
| UX-09 | A investigação de uma MO completa é feita em S-11 como ponto de partida — não em S-05 ou S-08 |
| UX-10 | Avisos de Cancelamento Crítico não podem ser arquivados ou minimizados pelo usuário |

---

## 🟢 Pronto para Wireframe

S-05 Livro do Dia, S-08 Avisos e S-11 Histórico têm arquitetura de informação, hierarquia de conteúdo, jornadas integradas e regras de navegação completamente definidas.

As três superfícies estão modeladas como perspectivas coerentes da mesma Mudança Operacional — sem duplicação, sem fragmentação e com navegação cruzada com preservação de contexto.

---

*Documento elaborado por Product Designer Sênior — MyASA 2.0*
*Base: Entidade Mudança Operacional v18/06/2026 · Ciclo de Comunicação Operacional v18/06/2026 · Bloco 1 · S-06 · Pesquisas dos 3 perfis · Jornadas aprovadas*
