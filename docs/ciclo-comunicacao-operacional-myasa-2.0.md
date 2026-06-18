# MyASA 2.0 — Ciclo de Comunicação Operacional

> **Versão:** 18/06/2026
> **Fase:** Modelagem de Comportamento Integrado — anterior a wireframes de S-05, S-08 e S-11
> **Base:** Arquitetura MyASA 2.0 · Entidade Mudança Operacional · Ciclo de Planejamento Operacional · Bloco 1 · S-06 · Pesquisas dos 3 perfis · Jornadas aprovadas
> **Status:** 🟢 Ciclo consistente — pronto para guiar wireframes e design de S-05, S-08 e S-11

---

## Premissa

S-05, S-08 e S-11 contam a **mesma história** pela perspectiva de cada um:

| Superfície | Perspectiva | Tempo verbal |
|---|---|---|
| **S-05 Livro do Dia** | O que é verdade agora para este show | Presente — *"o que está definido"* |
| **S-08 Avisos** | O que mudou e quem precisa saber | Presente imediato — *"o que aconteceu agora"* |
| **S-11 Histórico** | O que aconteceu, por que e quem fez | Passado — *"o que foi registrado"* |

Nenhuma das três substitui as outras. As três precisam ser consistentes entre si a qualquer momento — a mesma realidade operacional, vista de ângulos diferentes.

---

## PARTE 1 — PAPEL DE CADA SUPERFÍCIE

---

### S-05 — Livro do Dia

**Pergunta que responde:**

Para o Supervisor: *"Este show está pronto para acontecer? Todas as posições estão cobertas?"*
Para o Membro: *"No show de hoje, qual é meu papel — e existe algo diferente do que eu estava esperando?"*

**Natureza:** documento operacional vivo. Representa o estado **atual e oficial** de como um show específico em uma data específica está estruturado. Não é histórico — é presente. A versão mais recente do Livro é a verdade oficial. Versões anteriores existem apenas como referência de auditoria.

**Audiência primária:** Supervisor (constrói, revisa, publica). Membro (consulta sua fatia — não o Livro inteiro).

**Frequência de uso:** Supervisor — antes de cada show (véspera ou manhã). Membro — antes de cada show (menos frequente que o Meu Dia).

---

### S-08 — Avisos

**Pergunta que responde:**

Para o Membro: *"Existe alguma comunicação oficial que preciso saber agora — e preciso confirmar?"*
Para o Supervisor: *"Todos os membros afetados pela última mudança já receberam e confirmaram?"*

**Natureza:** canal de comunicação unidirecional operacional. Um Aviso é um **ato de comunicação** — não um documento de estado. Quando o Aviso é enviado, a informação foi comunicada. Quando o destinatário confirma, a comunicação foi recebida. O Aviso não precisa mais ser "atualizado" — ele é imutável após o envio.

**Audiência primária:** Membro (recebe e confirma). Supervisor (monitora confirmações).

**Frequência de uso:** Supervisor envia várias vezes por semana. Membro recebe com frequência variável.

---

### S-11 — Histórico

**Pergunta que responde:**

Para o Admin: *"O que aconteceu nesta operação? Existe algum padrão que indica problema?"*
Para o Supervisor: *"O que aconteceu com este membro / esta atividade nas últimas semanas?"*
Para qualquer perfil: *"Por que a programação de hoje está assim — o que levou a este estado?"*

**Natureza:** narrativa auditável de todos os eventos operacionais agrupados por Mudança Operacional. Não é log técnico — é história. Quem lê o Histórico precisa entender o que aconteceu sem precisar ser um especialista técnico no sistema.

**Audiência primária:** Admin (auditoria e padrões). Supervisor (investigação). IA (contexto para responder perguntas).

**Frequência de uso:** baixa a média — não é consultado diariamente. É consultado quando existe problema, questionamento ou necessidade de auditoria.

---

### Sobreposição entre as três superfícies

| Informação | Livro do Dia | Avisos | Histórico |
|---|---|---|---|
| Quem está alocado em qual papel | ✅ Estado atual | ❌ Não mostra | ✅ Como chegou a esse estado |
| O que mudou em relação à versão anterior | ✅ Delta visível | ✅ Notifica o delta | ✅ Registra o delta com contexto |
| Quem confirmou a mudança | ❌ Não rastreia | ✅ Status de confirmação | ✅ Quem confirmou, quando |
| Por que a mudança aconteceu | ❌ Não explica | ❌ Não explica (notifica o fato) | ✅ Origem, decisão, contexto |
| Estado atual das posições | ✅ Primário | ❌ Só na notificação inicial | ❌ Só o estado passado |

**Conclusão sobre sobreposição:** as três superfícies compartilham dados (o delta de uma mudança), mas nenhuma delas tem o mesmo papel. Não existe duplicação real — existe coerência necessária.

---

### Lacunas identificadas

**Lacuna 1 — Quem explica o "porquê" ao Membro?**
O Livro do Dia mostra o estado atual. O Aviso comunica o que mudou. Mas **nenhuma das duas explica por que** a mudança aconteceu. O Membro vê que seu papel mudou, mas não entende a razão.

**Solução:** a IA é o canal natural de explicação do "porquê" para o Membro. Quando o Membro recebe um Aviso de mudança e pergunta "por que meu papel mudou?", a IA acessa o Histórico e responde com o contexto completo em linguagem pessoal. O Aviso não precisa carregar esse contexto — a IA o serve sob demanda.

**Lacuna 2 — Versões do Livro do Dia vs. Histórico**
O Livro do Dia tem histórico de versões interno (v1, v2, v3 do mesmo show). O Histórico de S-11 registra as Mudanças Operacionais que causaram cada versão. Existe redundância potencial?

**Solução:** os dois coexistem com papéis distintos. O histórico de versões do Livro do Dia é granular e centrado no documento ("o que mudou entre v2 e v3"). O Histórico de S-11 é contextual e centrado no evento ("por que houve uma v3"). O histórico interno do Livro não substitui o Histórico — é seu complemento documental.

---

### Riscos de duplicação

| Risco | Avaliação | Mitigação |
|---|---|---|
| Aviso comunica o mesmo que o Meu Dia mostra | Risco real — ambos mostram "o que mudou" | S-08 é persistente e rastreável; S-01 é contextual ao dia e desaparece após confirmação. Distintos em comportamento. |
| Histórico replica o que o Aviso já registrou | Risco aparente | Aviso registra a comunicação; Histórico registra a causa, a decisão e o contexto. Perspectivas complementares. |
| Livro do Dia replica a Escala | Risco aparente | Escala é quem está disponível e alocado (visão de calendário). Livro é como o show específico está estruturado (visão por espetáculo). |

---

### Definições oficiais

**S-05 Livro do Dia:**
> *O documento operacional oficial de um show específico em uma data específica. Representa o estado presente e publicado de quem faz o quê naquele show. A versão mais recente é a única verdade operacional para aquela data e show. Versões anteriores existem exclusivamente como registro de auditoria.*

**S-08 Avisos:**
> *O ato oficial de comunicação unidirecional que informa membros sobre mudanças na programação publicada. Um Aviso é imutável após o envio. Seu ciclo de vida termina quando todos os destinatários confirmaram, ou quando a atividade ocorreu. O Aviso não é uma tela — é um evento de comunicação com estado.*

**S-11 Histórico:**
> *A narrativa auditável agrupada por Mudança Operacional de todos os eventos que alteraram o estado da operação. Responde as perguntas "o que aconteceu, por quê, quem fez, quem sabia e quem confirmou" — em linguagem compreensível, não em log técnico.*

---

## PARTE 2 — LIVRO DO DIA

---

### Quando um Livro do Dia nasce?

Um Livro do Dia nasce quando o Supervisor **escolhe uma data e solicita a geração** para um show específico.

O sistema gera automaticamente uma proposta considerando:
1. **Livro do Show** — estrutura base de papéis e posições do espetáculo
2. **Folgas aprovadas** — membros indisponíveis na data
3. **Restrições ativas** — limitações de membros dentro do período
4. **Disponibilidade geral** — membros sem conflito de horário
5. **Regras do espetáculo** — exigências específicas do show (ex.: mínimo de cobertura por bloco)

O Livro nasce como **proposta em rascunho** — não é oficial até o Supervisor revisar e publicar.

**Estados na geração:**
```
[GERAÇÃO]
Supervisor seleciona data + show
Sistema gera proposta automática
                ↓
        RASCUNHO (gerado, não publicado)
        Supervisor revisa → ajusta posições → aprova
                ↓
        PUBLICADO (estado oficial)
```

---

### Quando um Livro do Dia fica desatualizado?

Um Livro do Dia **publicado** fica desatualizado quando qualquer Mudança Operacional altera a realidade que ele representa:

| Evento | Livro fica desatualizado? |
|---|---|
| Folga aprovada para membro alocado no Livro | Sim |
| Restrição registrada que conflita com posição do Livro | Sim |
| Substituição confirmada que altera posição no Livro | Sim |
| Ajuste de papel aprovado para membro no Livro | Sim |
| Ajuste de horário que afeta atividade no Livro | Sim |
| Cancelamento do show | Sim (Livro vai para estado CANCELADO) |
| Mudança no Livro do Show (estrutura base) | Não — não propaga automaticamente |
| Folga aprovada para membro NÃO alocado no Livro | Não |

**O sistema detecta a desatualização automaticamente** e muda o estado do Livro de PUBLICADO para DESATUALIZADO. O Supervisor vê esse estado como item de ação pendente.

---

### Quando exige revisão?

Revisão é necessária sempre que o Livro está em estado DESATUALIZADO ou RASCUNHO-COM-PROBLEMAS:

| Situação | Urgência da revisão |
|---|---|
| Livro publicado com data em < 24h | Urgente — revisão deve acontecer imediatamente |
| Livro publicado com data em 1-3 dias | Alta — revisão antes do fim do dia |
| Livro publicado com data em > 3 dias | Normal — revisão antes da véspera |
| Livro em rascunho com posição em aberto | Normal — resolve antes de publicar |
| Múltiplos Livros afetados por Restrição de longa duração | Sistema prioriza por data; Supervisor revisa em fila |

**Quem inicia a revisão:** Supervisor, sempre. O sistema pode gerar uma nova proposta como ponto de partida, mas a revisão é ação humana.

---

### Quando exige republicação?

Toda mudança em Livro **publicado** exige republicação. Não existe "edição silenciosa" de Livro publicado.

**Exige republicação:**
- Qualquer mudança de pessoa em uma posição
- Qualquer mudança de papel
- Qualquer mudança de horário de atividade
- Posição que estava coberta passa para em aberto
- Posição em aberto que é resolvida com nova alocação

**Não exige republicação:**
- Correção de metadado sem impacto operacional (ex.: erro de digitação em campo de observação interna)
- Atualização do status de confirmação dos membros (isso é rastreamento, não publicação)
- Versões em rascunho não publicadas

**Cada republicação:**
1. Cria nova versão (v1 → v2 → v3)
2. Gera nova rodada de Avisos para os membros afetados pelas mudanças
3. É registrada no Histórico com timestamp e autor
4. A versão anterior é preservada em auditoria — nunca apagada

---

### Quando uma mudança afeta apenas parte do Livro?

Uma mudança **parcial** afeta uma posição específica dentro do Livro, mantendo as demais inalteradas.

**Exemplos de mudança parcial:**
- Membro A tem seu papel em Bloco 2 alterado — Blocos 1, 3 e 4 permanecem
- Ajuste de horário de entrada de um membro afeta apenas as atividades pré-horário novo
- Substituição em posição específica mantém todos os outros alocados

**Comportamento:** o Livro é republicado com o delta marcado (o que mudou vs. o que permanece). Os Avisos são enviados apenas para os membros cujas posições mudaram — não para todos os membros do Livro.

---

### Quando uma mudança afeta múltiplos Livros?

Uma mudança afeta **múltiplos Livros do Dia** quando:

1. **Folga de longa duração** — membro alocado em múltiplos shows dentro do período da folga
2. **Restrição com período extenso** — todos os Livros dentro da janela de restrição são afetados
3. **Cancelamento de membro** (saída da companhia) — todos os Livros futuros onde aparece

**Comportamento para múltiplos Livros:**
- O sistema gera **fila de revisão** ordenada por data de ocorrência (mais próximo primeiro)
- O Supervisor revisa um Livro por vez — não todos simultaneamente
- O sistema rastreia quais Livros foram revisados e quais ainda estão em aberto
- Cada Livro revisado gera sua própria rodada de Avisos

---

### Quando um Livro deixa de ser confiável?

Um Livro do Dia deixa de ser confiável quando existe **divergência entre o que o Livro diz e o que a Escala registra** — e essa divergência não está sinalizada.

**Cenários de não-confiabilidade:**

| Cenário | Estado | Grau |
|---|---|---|
| Livro publicado, mas Escala foi alterada desde a publicação | DESATUALIZADO | Alto — ação imediata necessária |
| Livro gerado com dados que já mudaram antes da publicação | RASCUNHO-DESATUALIZADO | Médio — revisão antes de publicar |
| Livro publicado, Escala consistente, mas Restrição não foi ainda registrada | Invisível para o sistema | Crítico — gap identificado na modelagem |

O estado DESATUALIZADO é detectável automaticamente. O terceiro cenário (restrição aprovada mas não registrada) é o único gap onde o Livro pode parecer confiável mas não é.

---

### Quem é responsável por restaurar a confiabilidade?

**Sempre o Supervisor.** O sistema:
- Detecta a desatualização
- Alerta o Supervisor
- Gera proposta de revisão com o delta calculado
- Prioriza a fila de Livros a revisar

Mas a decisão de como resolver cada posição, e a ação de publicar, pertencem ao Supervisor.

---

### Estados formais do Livro do Dia

```
INEXISTENTE
    │
    │ Supervisor solicita geração
    ▼
RASCUNHO
(gerado automaticamente · não publicado)
    │
    ├── Posição em aberto detectada ──────────► RASCUNHO-COM-ALERTAS
    │                                                    │
    │                                                    │ Supervisor resolve
    │                                                    ▼
    │ Supervisor revisa e aprova ──────────────────► PUBLICADO
    │
    │                                               ┌───┴───────────────────┐
    │                                               │                       │
    │                                               ▼                       ▼
    │                                        DESATUALIZADO           CANCELADO
    │                                        (Mudança Op.        (show cancelado)
    │                                         detectada)               │
    │                                               │                   └──► [FIM]
    │                                               │ Supervisor revisa
    │                                               │ e republica
    │                                               ▼
    │                                         PUBLICADO (v2, v3, ...)
    │
    └────────────────────────────────────────► [SHOW OCORREU]
                                               Estado final: EXECUTADO
                                               Livro arquivado no Histórico
```

**6 estados formais:** INEXISTENTE · RASCUNHO · RASCUNHO-COM-ALERTAS · PUBLICADO · DESATUALIZADO · CANCELADO · EXECUTADO (pós-show)

---

## PARTE 3 — AVISOS

---

### Quando um Aviso nasce?

Um Aviso nasce **automaticamente** após qualquer publicação ou republicação de Escala/Livro do Dia que afeta membros — e também em eventos críticos específicos.

**Gatilhos automáticos de Aviso:**

| Gatilho | Aviso gerado |
|---|---|
| Escala publicada (pela primeira vez para uma data) | Informativo para todos os membros alocados |
| Escala republicada com mudança de alocação | Importante para membros com mudança |
| Livro do Dia publicado (primeira vez) | Informativo para todos os membros alocados |
| Livro do Dia republicado com delta de posição | Importante para membros com posição alterada |
| Substituição confirmada | Importante para membro que sai + membro que entra |
| Cancelamento de show | Crítico para todos os membros alocados |
| Solicitação decidida (aprovada ou negada) | Informativo para o membro solicitante |
| Revogação de aprovação | Crítico para o membro afetado |
| Restrição registrada | Informativo para o membro com restrição |
| Membro não confirmou + atividade em limiar crítico | Crítico para o Supervisor |

**Gatilhos manuais de Aviso (criados pelo Supervisor):**

| Gatilho | Aviso gerado |
|---|---|
| Supervisor cria Aviso operacional geral | Nível definido pelo Supervisor |
| Supervisor envia instrução específica ao grupo | Nível definido pelo Supervisor |

---

### Quando um Aviso é obrigatório?

Um Aviso é **obrigatório** — não pode ser omitido — quando:

1. Uma mudança publicada altera a programação de pelo menos um membro
2. Um show é cancelado
3. Uma solicitação é decidida (aprovada ou negada)
4. Uma aprovação é revogada
5. Uma restrição é registrada formalmente
6. Um membro não confirma dentro do limiar crítico antes do início da atividade

**A obrigatoriedade é do sistema, não do Supervisor.** O Supervisor não precisa lembrar de enviar Avisos — eles são gerados automaticamente. O Supervisor cria Avisos adicionais (manuais) quando necessário, mas os Avisos automáticos existem independentemente de qualquer ação manual.

---

### Quando um Aviso não deve existir?

Um Aviso **não deve ser gerado** quando:

| Situação | Razão |
|---|---|
| Análise de impacto pelo Supervisor (processo interno) | Não é oficial; membro não precisa saber que está sendo analisado |
| Atualização da Escala sem publicação | Não oficial; Aviso sobre rascunho gera confusão |
| Flagging automático de Livro para revisão | Alerta interno ao Supervisor; não é comunicação para membros |
| Solicitação Administrativa decidida sem ação pública | Sem impacto operacional |
| Mudança no Livro do Show (estrutura base) | Não propaga para Livros do Dia existentes |
| Membro cria um compromisso pessoal | Privado; sem impacto operacional |
| Estado PARCIALMENTE CONFIRMADA de uma Mudança | Estado interno de rastreamento; não gera novo Aviso |
| Supervisores revisando entre si na Escala (sem publicação) | Processo interno |

**Regra geral:** Aviso existe apenas quando existe evento **oficial e publicado** que impacta alguém. Processos internos de preparação não geram Avisos.

---

### Quando um Aviso deve exigir confirmação?

| Condição | Confirmação obrigatória? |
|---|---|
| Nova alocação em atividade (membro passou a ter papel novo) | Sim |
| Mudança de papel em atividade já alocada | Sim |
| Mudança de horário de atividade | Sim |
| Cancelamento de atividade onde estava alocado | Sim |
| Revogação de aprovação | Sim — nível Crítico |
| Substituição: membro que entra | Sim |
| Substituição: membro que sai | Recomendada (não bloqueante) |
| Solicitação aprovada (própria do membro) | Não — ele solicitou; confirmação implícita |
| Solicitação negada | Não — Aviso informativo com motivo |
| Aviso geral do Supervisor (sem mudança de programação) | Não (mas pode ser configurado como opcional pelo Supervisor) |
| Instrução operacional importante do Supervisor | Sim — quando Supervisor configura confirmação obrigatória |

**Confirmação obrigatória vs. recomendada:**
- **Obrigatória:** o Aviso persiste no Meu Dia do membro e no rastreamento do Supervisor até ser confirmado. O botão de confirmação é o único caminho de encerramento do estado.
- **Recomendada:** o Aviso aparece sem bloquear o fluxo. A ausência de confirmação não gera escalada.

---

### Quando um Aviso desaparece?

**Do Meu Dia (S-01):** o card de Aviso importante desaparece do topo após confirmação do membro. A informação não some — ela desce para a posição normal da linha do tempo, sem urgência visual.

**Da lista de Avisos (S-08):** o Aviso nunca desaparece da lista. Ele muda de estado (não lido → lido → confirmado) mas permanece acessível como registro. Um Aviso de 3 semanas atrás pode ser consultado a qualquer momento.

**Do rastreamento de confirmação:** o Aviso sai da lista de "pendentes de confirmação" do Supervisor quando o destinatário confirma ou quando a atividade ocorreu.

---

### Quando um Aviso permanece no histórico?

Sempre. **Todo Aviso é imutável e permanente.** Ele não pode ser apagado, editado ou reatribuído após o envio.

O que o Histórico preserva de cada Aviso:
- Conteúdo exato no momento do envio
- Data e hora do envio
- Quem o enviou (Supervisor, sistema automático)
- Para quem foi enviado
- Nível (Informativo / Importante / Crítico)
- Status de confirmação de cada destinatário + timestamp de confirmação
- Vínculo com a Mudança Operacional que o originou

---

### Quando um Aviso escala?

Um Aviso escala quando a ausência de confirmação representa risco operacional:

| Condição | Escalada |
|---|---|
| Membro não confirmou e atividade começa em ≤ 2h | Re-notificação automática ao membro (push Crítico) |
| Membro não confirmou e atividade começa em ≤ 30min | Alerta ao Supervisor ("Carlos não confirmou. Show em 28 minutos.") |
| Supervisor não agiu sobre alerta e atividade começa em ≤ 15min | Escalada ao Admin |
| Aviso Crítico sem qualquer confirmação por mais de 1h | Alerta ao Admin |

**A escalada é automática.** O Supervisor não precisa configurar limiares — o sistema usa limiares padrão por tipo de atividade (show: mais restrito; ensaio: mais flexível).

---

### Quando um Aviso deixa de ser relevante?

Um Aviso perde relevância operacional (mas não histórica) quando:

1. A atividade a que se refere já ocorreu — independente de confirmação
2. A mudança que originou o Aviso foi posteriormente revogada (o Aviso permanece, mas um Aviso de revogação é enviado em seguida)
3. O membro deixou a operação (o Aviso permanece no Histórico da operação)

**O Aviso nunca perde relevância histórica.** Ele é parte permanente do registro da operação.

---

### Ciclo de vida completo de um Aviso

```
EVENTO PUBLICADO
      │
      │ Sistema calcula destinatários + nível
      ▼
   CRIADO
(imutável a partir daqui)
      │
      │ Enviado via push + in-app
      ▼
   ENVIADO
      │
      ├── Destinatário abre o app e vê o Aviso ──────────► VISUALIZADO
      │                                                         │
      │                                                         │ Confirma explicitamente
      │                                                         ▼
      │                                                    CONFIRMADO
      │                                                    [ciclo individual encerrado]
      │
      ├── Destinatário não visualiza antes do limiar ──────► ESCALADO
      │                                                         │
      │                                                         │ Re-notificação
      │                                                         ▼
      │                                                    [reinicia a partir de ENVIADO]
      │
      └── Atividade ocorre sem confirmação ────────────────► EXPIRADO
                                                         [registrado no Histórico]

AVISO COMO ENTIDADE: permanece acessível para sempre em S-08 e S-11.
```

**Estados do Aviso:** CRIADO · ENVIADO · VISUALIZADO · CONFIRMADO · ESCALADO · EXPIRADO

---

## PARTE 4 — HISTÓRICO

---

### O que merece virar narrativa?

Um evento merece narrativa no Histórico quando:

1. **Afeta a realidade operacional de pelo menos um membro** — programação, disponibilidade, papel, restrição
2. **Envolve uma decisão** — aprovação, negação, publicação, revogação
3. **Tem consequência auditável** — algo mudou que pode ser questionado depois
4. **Cria ou encerra um estado** — inicio de restrição, fechamento de folga, resolução de posição em aberto

---

### O que não merece narrativa?

| Evento | Por que não merece |
|---|---|
| Análise de impacto pelo sistema | Processo computacional interno; sem decisão humana |
| Abertura do app por qualquer usuário | Sem impacto operacional |
| Rascunho de Escala não publicado | Não foi oficial; não afetou ninguém |
| Mensagens diretas entre usuários | Coberto por S-09; o Histórico vincula, não duplica |
| Criação de entrega (S-07) | Paralelo à operação; tem seu próprio ciclo de rastreamento |
| Compromisso pessoal do membro | Privado; sem impacto operacional |
| Tentativa de solicitação abandonada (não enviada) | Não chegou ao sistema como evento formal |
| Confirmação de Aviso informativo | Ato de leitura, não de decisão |

---

### Como múltiplas Mudanças Operacionais são agrupadas?

O Histórico usa **dois níveis de agrupamento:**

**Nível 1 — Agrupamento por Mudança Operacional:**
Todos os eventos técnicos gerados pela mesma decisão formam uma única entidade narrativa (#MO-XXXX).

**Nível 2 — Agrupamento por Período / Membro / Atividade:**
Múltiplas Mudanças Operacionais relacionadas podem ser consultadas em conjunto. Ex.: "todas as mudanças que afetaram Amanda em junho" ou "todas as mudanças que afetaram o show de sábado".

**Estrutura hierárquica do Histórico:**

```
HISTÓRICO DA OPERAÇÃO
├── Por membro: todas as MO que afetaram esse membro
├── Por atividade: todas as MO que afetaram esse show/ensaio
├── Por data: todas as MO com impacto em uma data específica
├── Por tipo de MO: todas as Mudanças de Pessoa, de Restrição, etc.
└── Por responsável: todas as decisões tomadas por um Supervisor/Admin
```

---

### Como o Histórico conecta as cinco superfícies

**Solicitações → Histórico:**
Toda Solicitação decidida cria um registro no Histórico com: tipo, membro, data criação, data decisão, decisão (aprovada/negada/proposta), motivo (quando negada), impacto operacional calculado.

A Solicitação é a **origem** da cadeia. O Histórico preserva essa origem na narrativa de cada Mudança Operacional que dela nasceu.

---

**Escala → Histórico:**
Toda publicação e republicação da Escala é registrada com: quem publicou, quando, quais membros foram adicionados/removidos/alterados, quais alertas estavam ativos no momento da publicação (publicou com alertas? quais?).

A Escala é o **executor** — ela transforma decisões em realidade. O Histórico registra tanto a decisão quanto a execução.

---

**Livro do Dia → Histórico:**
Toda versão do Livro do Dia é preservada. O Histórico registra: qual versão foi publicada, quando, quem publicou, qual era o estado de cobertura (posições cobertas, em risco, em aberto), o que mudou em relação à versão anterior.

O Livro do Dia é o **documento** — o Histórico é o arquivo de todas as versões com contexto.

---

**Avisos → Histórico:**
Todo Aviso é preservado com conteúdo, destinatários, nível, status de confirmação por membro. O Histórico vincula cada Aviso à Mudança Operacional que o originou.

O Aviso é a **comunicação** — o Histórico é o registro de que a comunicação aconteceu, quem recebeu e quem confirmou.

---

**Confirmações → Histórico:**
Toda confirmação (ou ausência dela) é registrada com timestamp. O Histórico responde: "este membro sabia o que tinha de saber antes de executar?" — com evidência.

As confirmações são o **fechamento do ciclo** — o Histórico preserva esse fechamento como prova auditável.

---

### Como uma pessoa investiga um problema semanas depois?

**Cenário:** Admin recebe reclamação de que Amanda Souza foi escalada em um papel para o qual estava de restrição médica, e executou o show com risco físico. Isso aconteceu em 21/06. Hoje é 05/07.

**Investigação pelo Histórico:**

**Passo 1 — Busca por membro + data:**
O Admin acessa o Histórico e filtra por "Amanda Souza" + "21/06". O sistema retorna todas as Mudanças Operacionais que afetaram Amanda no dia 21/06.

**Passo 2 — Leitura da narrativa:**
O Histórico mostra:
```
#MO-0051 · Restrição Médica de Amanda Souza · 19/06 a 30/06
Registrada por: Ana Silva (Supervisora) em 19/06 às 14h02
Atividades restritas: acrobacia alta, contorção

#MO-0047 · Livro do Dia 21/06 — Musical 12h30 — v3
Publicado por: Ana Silva (Supervisora) em 19/06 às 18h22
Posições:
  Astrid: Amanda Souza ← [ALERTA: Amanda tem restrição ativa que inclui Astrid?]
  ⚠️ SISTEMA NÃO DETECTOU CONFLITO — Astrid não está mapeada como posição restrita
```

**Passo 3 — Investigação do gap:**
O Admin identifica: a Restrição de Amanda foi registrada corretamente. O Livro do Dia foi publicado após a Restrição. Mas o sistema não detectou conflito porque Astrid não estava mapeada como posição que exige acrobacia alta.

**Passo 4 — Causa raiz:**
O gap não é de processo — é de configuração. O papel "Astrid" no Livro do Show não tinha a tag de exigência "acrobacia alta" associada, então o motor de candidatos não eliminou Amanda.

**Passo 5 — Evidência auditável:**
O Histórico confirma que o processo foi seguido corretamente pelo Supervisor (restrição registrada, Livro revisado, Avisos enviados, Amanda confirmou). O problema estava na configuração do papel no Livro do Show — não na execução do processo.

---

### Lógica completa de investigação narrativa

O Histórico deve ser capaz de responder qualquer investigação seguindo esta estrutura:

**Pergunta de investigação → Filtros disponíveis → Narrativa gerada pela IA**

| Pergunta | Filtros | Narrativa |
|---|---|---|
| O que aconteceu com [membro] em [data]? | Membro + Data | Todas as MO que afetaram esse membro nessa data, em ordem cronológica |
| Por que [membro] está alocado em [papel] hoje? | Membro + Papel + Data | MO mais recente que resultou nessa alocação, com cadeia causal completa |
| Quem decidiu [mudança X]? | MO específica | O responsável pela publicação que gerou a MO, com timestamp |
| [Membro] sabia da mudança antes do show? | Membro + MO + Aviso | Status de confirmação do Aviso correspondente, com timestamp |
| Quantas vezes [membro] teve folga negada neste mês? | Membro + Tipo + Período | Todas as Solicitações negadas, com motivos |
| Qual é o padrão de posições em aberto no sábado? | Tipo MO Cobertura + Dia da semana | Frequência e causa das posições em aberto nos sábados |

---

## PARTE 5 — PROPAGAÇÃO POR TIPO DE MUDANÇA OPERACIONAL

---

### Tipo 1 — Mudança de Pessoa

**O que muda no Livro do Dia:**
- Posição A: membro anterior → membro novo
- Se membro anterior saiu sem substituto: posição passa para estado "Em Aberto"
- Livro republica com delta marcado (quem saiu, quem entrou)

**O que gera Aviso:**
- Membro que entra: Aviso Importante com nova alocação (exige confirmação)
- Membro que sai: Aviso Informativo de que foi substituído (confirmação recomendada)
- Supervisor: sem Aviso para ele (foi ele quem agiu)

**O que vai para o Histórico:**
- Origem da mudança (Solicitação aprovada ou ação direta)
- Membro anterior + membro novo + posição
- Status de confirmação de ambos
- Delta do Livro do Dia (versão anterior vs. versão nova)

**Quem confirma:** membro que entra (obrigatório). Membro que sai (recomendado).

**Quem é informado:** ambos os membros + Supervisor (rastreamento de confirmação).

---

### Tipo 2 — Mudança de Papel

**O que muda no Livro do Dia:**
- Mesma posição, mesmo membro, papel diferente
- Delta destacado: era [Papel X] → agora [Papel Y]

**O que gera Aviso:**
- Membro com papel alterado: Aviso Importante com comparativo (exige confirmação)

**O que vai para o Histórico:**
- Papel anterior + papel novo + atividade + data
- Origem (Ajuste de Escala aprovado, revisão direta do Supervisor)
- Confirmação do membro

**Quem confirma:** membro com papel alterado (obrigatório).

**Quem é informado:** membro afetado.

---

### Tipo 3 — Mudança de Horário

**O que muda no Livro do Dia:**
- Horário de entrada, saída ou duração da atividade atualizado
- Atividades que ficam sem cobertura na janela de horário diferente sinalizadas como "Em Risco"

**O que gera Aviso:**
- Membro com horário alterado: Aviso Importante (exige confirmação)
- Supervisor (se houver atividade descoberta na janela): Aviso Importante

**O que vai para o Histórico:**
- Horário anterior + horário novo + atividade + data
- Atividades descobertas na janela, se houver

**Quem confirma:** membro com horário alterado (obrigatório).

**Quem é informado:** membro afetado. Supervisor se houver cobertura descoberta.

---

### Tipo 4 — Mudança de Cobertura

**O que muda no Livro do Dia:**
- Posição passa de Coberta → Em Risco → Em Aberto (ou o inverso)
- Livro fica em RASCUNHO-COM-ALERTAS ou DESATUALIZADO conforme o estado da posição

**O que gera Aviso:**
- Supervisor: Aviso Crítico quando posição crítica fica Em Aberto
- Supervisor: Aviso Importante quando posição Em Aberto é resolvida
- Membros: apenas quando a resolução resulta em nova publicação

**O que vai para o Histórico:**
- Estado anterior da cobertura + estado novo
- Tempo que a posição ficou Em Aberto
- Como foi resolvida (ou que não foi resolvida e show ocorreu assim)

**Quem confirma:** Supervisor confirma a resolução (ao publicar). Membros confirmam quando nova alocação é publicada.

**Quem é informado:** Supervisor (ação necessária). Admin se persistir além do limiar.

---

### Tipo 5 — Mudança de Estrutura

**O que muda no Livro do Dia:**
- Nada imediato — mudança de estrutura afeta geração futura, não Livros já publicados
- Futuros Livros gerados já consideram a nova estrutura

**O que gera Aviso:**
- Supervisores afetados: Aviso Importante com novo escopo
- Membros movidos de grupo: Aviso Informativo

**O que vai para o Histórico:**
- Estrutura anterior + estrutura nova
- Quem fez (Admin), quando
- Supervisores e membros afetados

**Quem confirma:** Supervisor afetado confirma novo escopo (obrigatório).

**Quem é informado:** Supervisores afetados + membros movidos.

---

### Tipo 6 — Mudança de Show

**Cancelamento:**

O que muda no Livro do Dia:
- Livro do Dia correspondente vai para estado CANCELADO
- Todas as posições são formalmente encerradas

O que gera Aviso:
- Todos os membros alocados no show: Aviso Crítico de cancelamento (exige confirmação)
- Supervisor e Admin: notificação automática

O que vai para o Histórico:
- Show cancelado + data + razão (se informada) + todos os membros que estavam alocados + status de confirmação de cada um

Quem confirma: todos os membros alocados (obrigatório).

**Adição de show:**

O que muda no Livro do Dia:
- Novo Livro do Dia nasce (ou precisa ser gerado para a nova data)

O que gera Aviso:
- Supervisor: alerta de nova demanda de cobertura a ser escalada

O que vai para o Histórico:
- Show adicionado + data + quem criou + data de criação

**Mudança de horário de show:**

O que muda no Livro do Dia:
- Horário da atividade no Livro atualizado → Livro vai para DESATUALIZADO

O que gera Aviso:
- Todos os membros alocados no show: Aviso Importante com novo horário (exige confirmação)

---

### Tipo 7 — Mudança de Livro do Dia

**O que muda no Livro do Dia:**
- Nova versão é publicada (incremento de versão)
- Versão anterior arquivada

**O que gera Aviso:**
- Membros com posição alterada: Aviso Importante (nível Importante se mudança de posição; Informativo se apenas nova versão sem mudança para eles)

**O que vai para o Histórico:**
- Versão anterior vs. versão nova (delta)
- Quem publicou, quando
- Lista de membros afetados e status de confirmação

**Quem confirma:** membros com posição alterada na nova versão.

**Quem é informado:** somente membros afetados pelo delta (não todos do Livro).

---

### Tipo 8 — Mudança de Restrição

**O que muda no Livro do Dia:**
- Todos os Livros publicados dentro do período de restrição onde o membro está em posição conflitante: DESATUALIZADO
- Futuros Livros gerados excluem o membro das posições restritas automaticamente

**O que gera Aviso:**
- Membro: Aviso Informativo de que a restrição foi registrada / encerrada / renovada
- Supervisor: lista de Livros do Dia afetados que precisam de revisão

**O que vai para o Histórico:**
- Tipo de restrição + período + atividades restritas
- Impacto (quantos Livros afetados)
- Revisões feitas e data
- Data de revisão (se Médica)

**Quem confirma:** membro confirma ciência da restrição.

**Quem é informado:** membro + Supervisor.

---

### Tipo 9 — Mudança de Escala

**O que muda no Livro do Dia:**
- Posição afetada atualizada → Livro vai para DESATUALIZADO → Supervisor revisa e republica

**O que gera Aviso:**
- Membro com nova alocação: Aviso Importante (exige confirmação)
- Membro liberado de posição: Aviso Informativo

**O que vai para o Histórico:**
- Alteração direta na Escala + quem fez + quando + motivo declarado (se emergência ou ajuste preventivo)

**Quem confirma:** membro com nova alocação (obrigatório). Urgência proporcional à proximidade.

**Quem é informado:** membros afetados.

---

## PARTE 6 — CASOS LIMITE

---

### Caso 1 — Folga aprovada e depois revogada

**O que acontece no Livro do Dia:**

1. Folga aprovada → Livro vai para DESATUALIZADO → Supervisor revisa → aloca substituto → republica (v2)
2. Dias depois: folga revogada → Livro volta para DESATUALIZADO novamente → Supervisor revisa → pode restaurar membro original ou manter substituto → republica (v3)

**Decisão do Supervisor na republicação v3:** o substituto (Beatriz) já foi comunicado e confirmou. Restaurar Amanda cria uma segunda mudança de pessoa. O Supervisor deve decidir conscientemente. O sistema apresenta as duas opções com impacto de cada uma.

**O que acontece nos Avisos:**

Rodada 1 (folga aprovada): Aviso Informativo para Amanda (folga aprovada). Aviso Importante para Beatriz (nova alocação).
Rodada 2 (revogação): Aviso Crítico para Amanda (folga revogada). Aviso Importante ou Crítico para Beatriz (alocação alterada, dependendo do que o Supervisor decidiu).

**Regra obrigatória:** a revogação gera Aviso de nível Crítico — não Importante. A pessoa esperava folga e agora não tem. Isso é operacionalmente crítico para ela.

**O que acontece no Histórico:**
```
#MO-0047 · Folga Amanda · 21/06
  [VINCULADA A]
#MO-0061 · Revogação da Folga Amanda · 21/06
  Motivo da revogação: [motivo declarado pelo Supervisor]
  Estado final: Amanda restaurada como disponível
  Impacto: Beatriz mantida / Beatriz removida [conforme decisão]
```

As duas Mudanças são entidades separadas, vinculadas. O Histórico mostra a cadeia causal completa.

---

### Caso 2 — Livro publicado e depois republicado três vezes

**Comportamento obrigatório:**

Cada republicação é uma nova versão. As versões v1, v2, v3 são preservadas integralmente no Histórico do Livro.

**O que os membros recebem:**
- Cada republicação gera Avisos apenas para os membros cujas posições mudaram em relação à versão anterior
- Um membro cuja posição não mudou entre v1 e v3 recebe 0 Avisos adicionais
- Um membro cuja posição mudou em v2 mas voltou ao original em v3 recebe dois Avisos — e o segundo Aviso é de que voltou à posição original

**Risco crítico:** fadiga de Aviso. Se um show for republicado múltiplas vezes em um curto período, os membros recebem muitos Avisos, perdem a percepção de urgência e começam a não confirmar.

**Mitigação obrigatória:** o sistema deve agrupar múltiplas republicações próximas em janela de tempo (ex.: dentro de 30 minutos) em um único Aviso consolidado, mostrando o estado final — não cada versão intermediária. O membro recebe 1 Aviso com o estado final, não 3 Avisos com cada mudança intermediária.

**Exceção à mitigação:** se uma das versões intermediárias afetou um membro diferente das outras, cada membro recebe o Aviso relevante para ele — não o Aviso consolidado.

---

### Caso 3 — Show cancelado no mesmo dia

**Contexto:** Show das 12h30. Às 10h15, show cancelado. Membros já estão a caminho ou no local.

**Comportamento obrigatório:**

1. Sistema gera Aviso Crítico imediatamente para todos os alocados no show
2. Livro do Dia vai para estado CANCELADO — sem possibilidade de republica
3. Meu Dia de cada membro remove a atividade do dia com label "CANCELADO — [show] — 12h30" — não simplesmente some
4. Confirmação obrigatória de cada membro mesmo que a atividade já não acontecerá — o sistema precisa saber que cada membro recebeu e leu o cancelamento
5. Escala atualizada: posições liberadas para todas as outras atividades do dia (membros voltam a estar disponíveis)

**No Histórico:**
```
#MO-0078 · Cancelamento de Show · Musical 12h30 · 19/06 · 10h15
Cancelado por: [Supervisor/Admin]
Motivo: [motivo declarado]
Membros alocados: 8 | Avisos Críticos enviados: 8
Confirmações: [status de cada um]
```

**Decisão estratégica emergente:** cancelamento no mesmo dia exige canal de comunicação paralelo ao sistema. Se um membro está offline sem conexão, o push não chega. O sistema deve rastrear quem não confirmou e o Supervisor deve ter protocolo de contato direto para os não confirmados.

---

### Caso 4 — Mudança que afeta 30 membros

**Exemplo:** cancelamento de um show de grande elenco. 30 membros alocados.

**Comportamento obrigatório:**

**Geração de Avisos:** 30 Avisos são gerados simultaneamente. O sistema não serializa — todos partem no mesmo instante.

**Rastreamento de confirmação:** o Supervisor não pode gerenciar 30 confirmações individuais manualmente. O sistema deve apresentar:
- Número total: "28 de 30 confirmaram"
- Lista dos não confirmados com tempo decorrido
- Destaque para os não confirmados com atividades subsequentes no mesmo dia (risco de aparecerem para o show cancelado por não terem visto o Aviso)

**No Histórico:** o grupo de 30 membros está dentro da mesma Mudança Operacional — não são 30 registros isolados. A narrativa é uma, com a lista de confirmações como dado.

**Limiar de escalada para grupo grande:** não é "todos ou nenhum" — é "todos os críticos confirmaram?". O sistema deve identificar quais dos 30 membros têm atividades subsequentes que dependem da liberação deste show. Esses são os confirmados prioritários.

---

### Caso 5 — Supervisor publica informação incorreta

**Exemplo:** Supervisor aloca Beatriz em posição que viola sua restrição médica e publica o Livro.

**O que o sistema faz automaticamente:**
- Se o sistema detectar a violação antes da publicação: **alerta de validação** ao Supervisor ("Beatriz Lima tem Restrição Médica — posição de acrobacia é incompatível. Confirma a publicação mesmo assim?")
- Se o Supervisor confirmar mesmo com o alerta: publicação ocorre, mas o alerta fica registrado no Histórico
- Se a violação não for detectada (ex.: papel sem tag de exigência física): sistema publica sem alertar

**Após a publicação incorreta:**
- Aviso é enviado para Beatriz com nova alocação (confirmação obrigatória)
- Se o erro for percebido mais tarde: nova Mudança Operacional de correção é gerada
- O Histórico preserva: a versão incorreta, o momento em que foi percebido, quem corrigiu, se houve alerta ignorado

**No Histórico:**
```
#MO-0082 · Livro do Dia 21/06 — Musical 12h30 — v2 [PUBLICADO COM ALERTA IGNORADO]
Alerta no momento da publicação: "Beatriz Lima — conflito com Restrição Médica"
Supervisor: Ana Silva confirmou publicação mesmo com alerta
  [VINCULADA A]
#MO-0083 · Correção da Alocação de Beatriz Lima · 21/06
Beatriz Lima removida de posição conflitante
```

**Decisão estratégica emergente:** o sistema nunca bloqueia uma publicação — apenas alerta. O Supervisor tem autoridade para publicar com alertas. Mas todo alerta ignorado é registrado — tornando a decisão auditável.

---

### Caso 6 — Membro nunca confirma

**Cenário:** Carlos não confirma mudança crítica. Show começa em 30 minutos.

**Protocolo automático do sistema:**

```
T-2h: re-notificação automática (push Crítico)
T-30min: alerta ao Supervisor ("Carlos não confirmou. Show em 30 min.")
T-15min: escalada ao Admin se Supervisor não agiu
T-0: show inicia
         │
         ├── Carlos apareceu: show acontece; Histórico registra "confirmação pendente — executou"
         └── Carlos não apareceu: Supervisor age; Histórico registra ausência + consequência
```

**Estado final no Histórico:**
A confirmação ausente é registrada permanentemente. Não é apagada após o show. Permite identificar padrão: Carlos nunca confirma? Com que frequência não-confirmação precede ausência?

**O Aviso nunca expira silenciosamente.** Mesmo após o show, o estado do Aviso para Carlos é "EXPIRADO sem confirmação" — não "confirmado".

---

### Caso 7 — Mudança de Estrutura feita pelo Admin

**Exemplo:** Admin reconfigura o Grupo B, movendo 5 membros do Grupo B para o Grupo C, e atribuindo uma nova Supervisora ao Grupo C.

**O que acontece no Livro do Dia:**
- Livros publicados existentes não são alterados automaticamente
- Futuros Livros gerados para o Grupo B já excluem os 5 membros
- Futuros Livros para o Grupo C já incluem os 5 membros

**O que gera Aviso:**
- Nova Supervisora do Grupo C: Aviso Importante com novo escopo de supervisão (exige confirmação)
- 5 membros movidos: Aviso Informativo de mudança de grupo
- Supervisora do Grupo B (que perdeu membros): Aviso Informativo

**Comportamento obrigatório:**
A Supervisora antiga do Grupo B deve ser notificada que o escopo dela mudou — não apenas os membros que foram movidos. Ela pode ter Livros do Dia planejados que incluem esses membros e precisam ser revisados.

**No Histórico:**
```
#MO-0091 · Mudança de Estrutura · Grupos B e C · 18/06 · Admin: Ricardo
5 membros movidos: [lista]
Nova Supervisora Grupo C: Mariana Costa
Livros do Dia afetados: [lista dos próximos 30 dias com esses membros]
Confirmações: Mariana Costa (confirmou), Supervisora Grupo B (confirmou)
```

**Decisão estratégica emergente:** Mudanças de Estrutura precisam de janela de impacto definida. A mudança entra em vigor em qual data? Imediatamente, ou a partir de uma data futura? Livros do Dia entre hoje e a data de vigência devem ser tratados como da estrutura anterior ou nova?

**Resolução proposta:** Mudanças de Estrutura têm data de vigência explícita. O Admin define quando a mudança entra em vigor. Livros antes da data de vigência mantêm a estrutura anterior. Livros após a data: gerados com a nova estrutura.

---

## PARTE 7 — AUDITORIA DE CONSISTÊNCIA

---

### Q1 — Existe informação duplicada?

**Aviso + Meu Dia:** ambos comunicam a mudança para o membro. Risco de duplicação?
**Veredito:** não é duplicação — são canais com comportamentos distintos. Aviso é permanente e rastreável (S-08). Meu Dia é contextual ao dia e desaparece do topo após confirmação (S-01). O mesmo dado em dois formatos com propósitos diferentes.

**Livro do Dia + Escala:** ambos contêm informações sobre quem está alocado onde. Duplicação?
**Veredito:** perspectivas diferentes. A Escala é calendário (quem está disponível, quem está alocado em qual data). O Livro do Dia é documento de show (como o espetáculo específico está estruturado). A Escala alimenta o Livro; o Livro não alimenta a Escala.

**Histórico + Histórico interno do Livro do Dia:** ambos preservam versões do Livro. Duplicação?
**Veredito:** o histórico interno do Livro (v1, v2, v3) é granular e centrado no documento. O Histórico de S-11 é contextual e centrado na causa. Complementares, não duplicados.

**Resultado: sem duplicação real identificada.**

---

### Q2 — Existe narrativa quebrada?

**Risco identificado:** se uma Solicitação é aprovada mas a Escala não é republicada por dias, o Histórico terá a aprovação registrada mas não a comunicação — criando uma narrativa que termina no meio.

**Mitigação:** o sistema deve detectar Mudanças Operacionais no estado APLICADA há mais de X horas sem publicação e alertar o Supervisor. O Histórico registra o estado intermediário explicitamente: "Mudança aplicada. Aguardando publicação."

**Resultado: risco identificado e mitigável.**

---

### Q3 — Existe evento sem rastreabilidade?

**Risco identificado (Caso 5 acima):** se o papel de Astrid no Livro do Show não tiver a tag "exige acrobacia alta", a violação de restrição não é detectada. A publicação ocorre sem alerta. O evento de violação não é rastreável — o sistema não sabe que era uma violação.

**Mitigação:** mapeamento de exigências físicas/técnicas dos papéis no Livro do Show é pré-requisito para o motor de restrições funcionar corretamente. Sem esse mapeamento, o sistema tem um ponto cego.

**Decisão estratégica emergente (D-XX):** todo papel no Livro do Show deve ter tags de exigência operacional (físicas, técnicas, artísticas). Sem tags, o motor de candidatos não pode eliminar membros incompatíveis. A completude das tags é responsabilidade do Supervisor ou Admin na configuração do Livro do Show.

**Resultado: ponto cego identificado — depende de completude de configuração.**

---

### Q4 — Existe mudança sem comunicação?

**Risco:** atualização automática da Escala (estado APLICADA) sem publicação. O sistema mudou internamente, mas o membro não sabe. A comunicação só acontece após publicação.

**Veredito:** isso é correto por design. A comunicação não deve acontecer antes da publicação — o Supervisor precisa revisar o Livro do Dia antes de comunicar. Comunicar uma mudança antes de o Livro estar revisado geraria inconsistência.

**Porém:** existe janela de inconsistência entre APLICADA e PUBLICADA. O Histórico deve registrar essa janela — quanto tempo decorreu entre a aprovação e a publicação. Se for muito tempo, pode indicar que o Supervisor esqueceu de publicar.

**Resultado: sem mudança sem comunicação por design. Janela documentada e rastreável.**

---

### Q5 — Existe comunicação sem histórico?

**Veredito:** não. Todo Aviso é registrado no Histórico com conteúdo completo e status de confirmação. Não existe Aviso "fora do Histórico".

**Exceção potencial:** Avisos manuais criados pelo Supervisor em S-08 sem vínculo a uma Mudança Operacional. Esses Avisos existem e são registrados em S-08, mas podem não estar vinculados a uma entidade MO no Histórico.

**Resolução:** Avisos manuais do Supervisor são registrados no Histórico como "Comunicação Operacional Manual" — entidade própria, não vinculada a MO, mas rastreável.

**Resultado: sem comunicação sem histórico com uma exceção resolvida.**

---

### Q6 — Existe histórico sem contexto?

**Risco:** o Histórico pode ter eventos registrados sem que a causa seja clara. Ex.: Livro republicado (v3) sem que o Histórico explique por que houve uma v3.

**Veredito:** o Histórico está vinculado à Mudança Operacional que causou cada publicação. Se o Livro v3 foi causado pela MO-0047 (folga de Amanda), isso está explicitamente vinculado. O contexto sempre existe se a cadeia MO → Livro → Aviso → Histórico estiver intacta.

**Risco residual:** se o Supervisor editar o Livro do Dia diretamente (sem uma Mudança Operacional formal), a edição pode não estar vinculada a nenhuma MO. Nesse caso, o Histórico registra "Livro editado diretamente por [Supervisor]" sem contexto causal.

**Resolução:** toda edição direta do Livro do Dia pelo Supervisor deve exigir motivo declarado — que vai para o Histórico. Edição sem motivo não é permitida.

**Resultado: sem histórico sem contexto, com uma regra de mitigação para edições diretas.**

---

### Q7 — Existe risco de divergência entre Livro e Escala?

**Sim — este é o risco central do ciclo de comunicação.**

**Janela de divergência:** após uma Mudança Operacional, a Escala é atualizada automaticamente (estado APLICADA), mas o Livro do Dia ainda reflete o estado anterior até o Supervisor revisar e republicar. Durante essa janela, a Escala e o Livro dizem coisas diferentes.

**Duração da janela:** pode ser de minutos (Supervisor age imediatamente) a horas ou dias (Supervisor adia a publicação).

**Consequência:** se um membro consultar o Meu Dia durante essa janela, pode ver informação baseada no Livro (ainda desatualizado) — não na Escala (já atualizada).

**Mitigação em camadas:**
1. O Livro em estado DESATUALIZADO é visivelmente sinalizado para o Supervisor — não pode ser "ignorado"
2. O Meu Dia do membro não é atualizado enquanto o Livro não for republicado — ele continua vendo a versão anterior (que ainda é a oficial publicada)
3. O sistema não permite que a Escala seja usada como fonte do Meu Dia antes do Livro ser republicado — o Livro publicado é sempre a fonte do Meu Dia

**Resultado: risco real e aceito — mitigável por design de estado DESATUALIZADO visível e urgente.**

---

### Q8 — Existe risco de um membro operar com informação incorreta?

**Cenário de risco máximo:** cancelamento de show sem conexão. Membro está sem internet, recebe cancelamento, não confirma. Vai ao local do show que não existe mais.

**Protocolo obrigatório:** o sistema rastreia quem não confirmou. O Supervisor recebe a lista. Para membros que não confirmaram cancelamentos críticos com menos de 2h para o início, o protocolo de contato direto é obrigatório — o app não resolve sozinho nesse cenário.

**Cenário de risco médio:** membro confirma Aviso mecanicamente sem ler o delta. Pensa que seu papel é o mesmo, mas mudou.

**Mitigação:** a confirmação exige visualização do delta antes do botão. O botão "Confirmar" só aparece após o membro ter visto explicitamente "era [X] → agora [Y]". Isso é regra de design inegociável.

**Cenário de risco baixo:** membro lê a mudança mas esquece até a hora do show. Esse cenário é responsabilidade humana — o sistema não pode garantir que o membro lembrará. O que o sistema pode fazer: deixar a informação acessível com 1 toque a qualquer momento.

**Resultado: risco máximo mitigável por protocolo. Risco médio mitigável por design. Risco baixo: responsabilidade humana.**

---

## PARTE 8 — DECISÕES ESTRATÉGICAS

*(Continuando de D-10 — última decisão do Ciclo de Planejamento Operacional)*

---

**D-11 — Livro do Dia publicado nunca é editado silenciosamente**

Toda mudança em Livro do Dia publicado gera nova versão (republicação). Não existe "edição inline" de Livro publicado. A versão anterior é sempre preservada.

**Por que:** garantia de auditabilidade. Qualquer pessoa pode comparar versões e entender o que mudou e quando. Edições silenciosas destroem a rastreabilidade.

**Como aplicar:** ao tentar editar um Livro publicado, o sistema sempre cria uma nova versão em rascunho para revisão antes de republicar.

---

**D-12 — Avisos são gerados pelo sistema, nunca pelo Supervisor manualmente para mudanças automáticas**

Para Mudanças Operacionais, os Avisos são automáticos. O Supervisor não precisa lembrar de comunicar — o sistema comunica. O Supervisor pode criar Avisos adicionais manuais, mas não é responsável pelos Avisos de mudança.

**Por que:** eliminar dependência de ação humana em etapa crítica. O esquecimento de comunicar uma mudança é o principal risco de o membro operar com informação incorreta.

**Como aplicar:** publicação da Escala ou Livro do Dia dispara automaticamente a geração e envio de Avisos para todos os afetados.

---

**D-13 — Nível de Aviso é determinado pelo sistema, não pelo Supervisor**

O nível (Informativo / Importante / Crítico) é calculado com base no impacto da mudança — não é escolha do Supervisor. O Supervisor não pode "rebaixar" um Aviso Crítico para Informativo.

**Por que:** impede que o Supervisor minimize a urgência de comunicações importantes por conveniência ou falta de percepção do impacto.

**Como aplicar:** matriz de nível por tipo de mudança + proximidade temporal. O Supervisor pode adicionar contexto ao Aviso (texto), mas não pode alterar o nível.

---

**D-14 — Confirmação exige visualização do delta antes do botão**

O botão "Confirmar" só é exibido após o membro ter visualizado explicitamente o comparativo "era → agora". Não é possível confirmar sem ver o que mudou.

**Por que:** eliminar confirmações mecânicas que não garantem que o membro absorveu a informação. A confirmação tem valor apenas se o membro leu o que está confirmando.

**Como aplicar:** o fluxo de confirmação tem dois passos obrigatórios: (1) visualização do delta, (2) botão Confirmar.

---

**D-15 — Revogação de aprovação gera Aviso de nível Crítico, sempre**

Qualquer revogação de aprovação — independente de qual tipo de Solicitação — gera Aviso Crítico para o membro afetado. Não existe revogação de nível Informativo ou Importante.

**Por que:** a pessoa estava esperando uma realidade (folga, ajuste, troca) e essa realidade mudou. O impacto psicológico e operacional é sempre alto. Tratar como Informativo seria inadequado e arriscado.

**Como aplicar:** ao confirmar revogação, o sistema força nível Crítico. O Supervisor não pode alterar.

---

**D-16 — Múltiplas republicações próximas são consolidadas em um único Aviso**

Republicações dentro de uma janela de tempo (30 minutos, a definir) são agrupadas em um único Aviso com o estado final — não como Avisos separados por cada versão intermediária.

**Por que:** fadiga de Aviso. Membros que recebem muitos Avisos em sequência perdem a percepção de urgência e passam a ignorar — o oposto do objetivo.

**Exceção:** cada membro recebe apenas o Aviso relevante para ele (seu delta), mesmo em consolidação. A consolidação é por membro, não por Livro.

**Como aplicar:** sistema acumula republicações em janela de tempo e dispara um único Aviso consolidado com o estado final de cada membro.

---

**D-17 — Cancelamento de show com membros sem confirmação exige protocolo de contato direto**

Para cancelamentos em que membros não confirmaram e a atividade está em ≤ 1h, o sistema deve fornecer ao Supervisor lista de contato direto (não apenas re-notificação via app). O sistema alerta; o Supervisor executa o contato.

**Por que:** membro offline não recebe push. O sistema não tem como garantir entrega em todos os cenários. Para cancelamentos críticos, o protocolo humano é a última linha de defesa.

**Como aplicar:** após limiar sem confirmação + atividade próxima, o Supervisor vê lista de "Ação Necessária: contato direto com [lista de membros]".

---

**D-18 — Todo papel no Livro do Show deve ter tags de exigência operacional**

Papéis sem tags de exigência (físicas, técnicas, artísticas) tornam o motor de restrições cego para incompatibilidades. A completude das tags é pré-requisito para o funcionamento correto do sistema de restrições.

**Por que:** sem tags, um membro com restrição médica de acrobacia pode ser alocado em papel que exige acrobacia, sem alerta do sistema. Isso é risco de segurança, não apenas operacional.

**Como aplicar:** ao criar ou editar um papel no Livro do Show, o campo de exigências operacionais é obrigatório (pode ser "nenhuma exigência especial", mas não pode ficar em branco).

---

**D-19 — Mudanças de Estrutura têm data de vigência explícita**

Mudanças de Estrutura (reconfiguração de grupos) não entram em vigor imediatamente — têm data de vigência definida pelo Admin. Livros do Dia gerados antes da data de vigência seguem a estrutura anterior; após, a nova estrutura.

**Por que:** mudanças de estrutura imediatas podem invalidar Livros do Dia já gerados e publicados. A data de vigência permite transição controlada.

**Como aplicar:** ao salvar uma Mudança de Estrutura, o Admin define obrigatoriamente a data de vigência. "Imediato" é uma opção válida mas exige confirmação explícita com aviso de impacto.

---

**D-20 — Edições diretas ao Livro do Dia exigem motivo declarado**

Quando o Supervisor edita o Livro do Dia diretamente (sem que uma Mudança Operacional formal tenha gerado a edição), ele deve declarar o motivo. Sem motivo declarado, a edição não é permitida.

**Por que:** sem motivo, o Histórico tem "Livro editado por Ana Silva" sem contexto. Investigação futura não consegue entender o porquê. O motivo transforma uma ação técnica em evento auditável.

**Como aplicar:** ao tentar publicar uma nova versão do Livro sem Mudança Operacional associada, o sistema exige campo de motivo antes de confirmar.

---

## PARTE 9 — VEREDITO

---

### Mapa Oficial do Ciclo de Comunicação Operacional

```
══════════════════════════════════════════════════════════════════════════
CICLO DE COMUNICAÇÃO OPERACIONAL — MyASA 2.0
S-05 Livro do Dia · S-08 Avisos · S-11 Histórico
══════════════════════════════════════════════════════════════════════════

EVENTO GERADOR
(Solicitação aprovada / Ação do Supervisor / Evento da Agenda)
      │
      ▼
MUDANÇA OPERACIONAL CRIADA
(entidade transversal — nasce no sistema)
      │
      │ Sistema calcula impacto + destinatários
      ▼
┌─────────────────────────────────────────────────────┐
│                   S-05 LIVRO DO DIA                  │
│                                                      │
│  RASCUNHO ──────────────────────────────────────► PUBLICADO
│     ↑                                                    │
│     │ [gerado automaticamente ou                         │ Mudança Op.
│     │  por solicitação do Supervisor]                    │ detectada
│     │                                                    ▼
│  RASCUNHO-COM-ALERTAS ──► [Supervisor resolve] ──► DESATUALIZADO
│                                                         │
│                                           [Supervisor revisa]
│                                                         │
│                                               PUBLICADO (v+1)
│                                                         │
│  CANCELADO ◄── [Show cancelado]              EXECUTADO ◄── [Show ocorre]
└─────────────────────────────────────────────────────┘
                    │
                    │ Publicação dispara
                    ▼
┌─────────────────────────────────────────────────────┐
│                   S-08 AVISOS                         │
│                                                      │
│  CRIADO ──► ENVIADO ──► VISUALIZADO ──► CONFIRMADO  │
│                │                │                    │
│                │                └──► ESCALADO ────── ┘
│                └──────────────────────────────────────► EXPIRADO
│                                                      │
│  Nível: INFORMATIVO · IMPORTANTE · CRÍTICO          │
│  Determinado pelo sistema — não pelo Supervisor     │
│  Imutável após envio                                 │
│  Permanente no Histórico                             │
└─────────────────────────────────────────────────────┘
                    │
                    │ Cada Aviso registrado
                    ▼
┌─────────────────────────────────────────────────────┐
│                  S-11 HISTÓRICO                       │
│                                                      │
│  Agrupado por Mudança Operacional (#MO-XXXX)        │
│                                                      │
│  Cada MO contém:                                     │
│  ├── Evento gerador (Solicitação / Ação)            │
│  ├── Análise de impacto [IA]                        │
│  ├── Delta da Escala                                │
│  ├── Versões do Livro do Dia afetadas               │
│  ├── Avisos gerados + confirmações                  │
│  ├── Responsáveis por cada etapa                    │
│  └── Narrativa resumida [IA]                        │
│                                                      │
│  Consultas disponíveis:                              │
│  ├── Por membro                                     │
│  ├── Por atividade                                  │
│  ├── Por data                                       │
│  ├── Por tipo de MO                                 │
│  └── Por responsável                                │
└─────────────────────────────────────────────────────┘
                    │
                    ▼
                   IA (S-10)
         Responde as 6 perguntas obrigatórias
         Detecta padrões e reincidências
         Gera narrativas para investigação

══════════════════════════════════════════════════════════════════════════
```

---

### As três perspectivas da mesma história

```
┌──────────────────────┬────────────────────────┬──────────────────────┐
│   S-05 LIVRO DO DIA  │     S-08 AVISOS         │   S-11 HISTÓRICO     │
├──────────────────────┼────────────────────────┼──────────────────────┤
│ Estado PRESENTE      │ Evento IMEDIATO         │ Narrativa PASSADA    │
│ O que está definido  │ O que precisa ser       │ O que aconteceu      │
│ agora                │ confirmado agora        │ e por quê            │
├──────────────────────┼────────────────────────┼──────────────────────┤
│ "Beatriz está em     │ "Beatriz: você foi      │ "Amanda solicitou    │
│ Bloco 3 no Ensaio   │ alocada no Bloco 3.     │ folga. Aprovada por  │
│ de sábado."         │ Confirme."              │ Ana Silva. Beatriz   │
│                      │                         │ alocada como         │
│                      │                         │ substituta."         │
├──────────────────────┼────────────────────────┼──────────────────────┤
│ Fonte: Escala        │ Fonte: Publicação       │ Fonte: Cadeia causal │
│ Audiência: Membros   │ Audiência: Destinatários│ Audiência: Admin, IA │
│ e Supervisor         │ específicos             │ Supervisor, todos    │
└──────────────────────┴────────────────────────┴──────────────────────┘
```

---

### Decisões produzidas (D-11 a D-20)

| # | Decisão | Superfícies afetadas |
|---|---|---|
| D-11 | Livro publicado nunca editado silenciosamente — toda mudança gera nova versão | S-05 |
| D-12 | Avisos de mudança são automáticos — Supervisor não precisa lembrá-los | S-08 |
| D-13 | Nível de Aviso determinado pelo sistema — Supervisor não altera | S-08 |
| D-14 | Confirmação exige visualização do delta antes do botão | S-01, S-08 |
| D-15 | Revogação gera sempre Aviso de nível Crítico | S-08 |
| D-16 | Múltiplas republicações próximas consolidadas em um único Aviso | S-08 |
| D-17 | Cancelamento com não-confirmados próximos do horário exige protocolo de contato direto | S-08, S-02 |
| D-18 | Papéis no Livro do Show precisam de tags de exigência operacional | S-05, S-04 |
| D-19 | Mudanças de Estrutura têm data de vigência explícita | S-04, S-05 |
| D-20 | Edições diretas ao Livro do Dia exigem motivo declarado | S-05, S-11 |

---

### Riscos residuais e status

| Risco | Severidade | Status |
|---|---|---|
| Janela de divergência Escala/Livro (APLICADA → PUBLICADA) | Alta | Mitigável por estado DESATUALIZADO visível e urgente |
| Membros offline sem receber cancelamento crítico | Alta | Mitigável por protocolo D-17 de contato direto |
| Papéis sem tags de exigência — motor cego para incompatibilidades | Alta | Mitigável por D-18 (campo obrigatório no Livro do Show) |
| Fadiga de Aviso por múltiplas republicações | Média | Mitigável por D-16 (consolidação em janela de tempo) |
| Confirmação mecânica sem absorção de conteúdo | Média | Mitigável por D-14 (delta obrigatório antes do botão) |
| Edições diretas sem contexto no Histórico | Baixa | Mitigável por D-20 (motivo obrigatório) |

---

### Classificação final

## 🟢 Consistente

O Ciclo de Comunicação Operacional — composto por S-05 Livro do Dia, S-08 Avisos e S-11 Histórico — é estruturalmente coerente e sem contradições com a arquitetura existente.

As três superfícies:
- **Não se sobrepõem** — cada uma tem papel exclusivo na narrativa operacional
- **São coerentes entre si** — alimentadas pela mesma fonte (Mudança Operacional) e representando a mesma realidade de perspectivas diferentes
- **Formam uma cadeia auditável completa** — qualquer investigação futura encontra a narrativa intacta
- **Confirmam as decisões D-01 a D-10** do Ciclo de Planejamento Operacional sem nenhum conflito
- **Produzem 10 novas decisões (D-11 a D-20)** que deverão ser respeitadas por UX, interface e desenvolvimento

**Wireframes e mockups de S-05, S-08 e S-11 podem ser iniciados.**

---

*Documento elaborado por Product Designer Sênior — MyASA 2.0*
*Base: Arquitetura v17/06/2026 · Entidade Mudança Operacional v18/06/2026 · Ciclo de Planejamento Operacional v18/06/2026 · Especificação S-06 v2 · Bloco 1 · Pesquisas dos 3 perfis · Jornadas aprovadas*
