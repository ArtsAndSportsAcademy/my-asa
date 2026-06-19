# MyASA 2.0 — AUD-D02 — Arquitetura de Tarefas Operacionais

**Status:** Auditoria concluída — pronta para implementação na Sprint 18  
**Referência:** Sprints 0–17 concluídas, Catálogo Oficial de Superfícies, S-06, S-07, S-08, S-11, S-14  
**Objetivo:** Definir oficialmente o domínio de Tarefas Operacionais antes da implementação  

---

## VEREDITO PRINCIPAL

> **Uma Tarefa no MyASA é uma unidade de trabalho operacional com execução rastreada, evidência obrigatória e ciclo de aprovação.**
>
> Tarefas não são avisos, não são materiais para consumir e não são pedidos de permissão.  
> Tarefas são compromissos de entrega com prestação de contas.

---

## PARTE 1 — FRONTEIRAS DE DOMÍNIO

### Mapa comparativo

| Dimensão | Aviso | Solicitação | Entrega | **Tarefa** |
|---|---|---|---|---|
| **Quem inicia** | Admin / Supervisor | Membro | Admin / Supervisor | Admin / Supervisor / Delegado |
| **Direção** | Broadcast ↓ | Membro → Supervisor | Supervisor ↓ Membro | Supervisor → Responsável |
| **O que exige** | Leitura / confirmação | Decisão do supervisor | Consumo (ler, assistir, marcar) | **Execução de trabalho** |
| **Rastreamento** | Confirmação booleana | Status da decisão | Progresso de checklist | Progresso + evidências + aprovação |
| **Aprovação** | Não | Não | Não | **Sim (opcional por tarefa)** |
| **Evidência** | Não | Não | Não | **Sim (obrigatória e complementar)** |
| **Tem responsável único** | Não (broadcast) | Sim (membro solicitante) | Sim (atribuído) | **Sim (responsável designado)** |
| **Pode ter checklist próprio do executor** | Não | Não | Não | **Sim (checklist operacional)** |

---

### O que pertence a cada domínio

#### Aviso
- Comunicado de mudança operacional urgente
- Alteração de local, horário, figurino, protocolo
- Informação que todos precisam saber, mas ninguém precisa *fazer* além de confirmar
- **NÃO pertence:** execução, produção de conteúdo, trabalho rastreável

#### Solicitação
- Pedido de ausência, restrição, troca de escala, mudança de função
- Sempre parte de um Membro em direção à gestão
- Fluxo de negociação (proposta alternativa)
- **NÃO pertence:** tarefas operacionais, criação de conteúdo, trabalho de produção

#### Entrega
- Conteúdo obrigatório para consumo: leitura, vídeo, checklist de protocolo
- Criado pela gestão e empurrado para membros específicos
- Progresso é de consumo (recebido → visualizado → concluído)
- **NÃO pertence:** trabalho de produção, aprovação de resultado, evidências de execução

#### Tarefa
- Trabalho a ser **executado e comprovado**
- Tem responsável, prazo, prioridade, checklist duplo e aprovação
- O resultado final é verificável: existe uma evidência de que o trabalho foi feito
- **NÃO pertence:** comunicados, pedidos de permissão, materiais para leitura

---

### Regra de desambiguação rápida

```
"Preciso que alguém SAIBA disso."          → Aviso
"Preciso que alguém ME AUTORIZE isso."     → Solicitação
"Preciso que alguém LEIA/ASSISTA isso."    → Entrega
"Preciso que alguém FAÇA e COMPROVE isso." → Tarefa
```

---

## PARTE 2 — CLASSIFICAÇÃO DE CASOS REAIS DA ASA

| Caso | Classificação | Justificativa |
|---|---|---|
| **Preparar Pocket** | **Tarefa** | Trabalho de produção (montar material físico), com checklist de itens e evidência fotográfica do resultado |
| **Atualizar figurino** | **Tarefa** | Execução de ajuste físico em figurino, requer evidência (foto antes/depois), pode exigir aprovação do diretor |
| **Revisar coreografia** | **Tarefa** | Trabalho artístico com prazo, responsável (coreógrafo/membro), checklist de pontos revisados e aprovação do supervisor |
| **Treinar substituto** | **Tarefa** | Trabalho de capacitação interna, com checklist operacional (tópicos a cobrir) e evidência de conclusão (confirmação do treinado) |
| **Criar apresentação** | **Tarefa** | Produção de conteúdo com entregável concreto (arquivo), evidência obrigatória (link/PDF), aprovação antes de publicar |
| **Atualizar biblioteca** | **Tarefa** → resultado vai para **Biblioteca** | O *ato* de atualizar é uma Tarefa (com responsável, prazo e aprovação). O documento atualizado fica na Biblioteca. A Tarefa é a origem; a Biblioteca é o destino. |
| **Produzir vídeo** | **Tarefa** | Produção criativa com prazo, checklist de etapas (roteiro, gravação, edição) e evidência (link do vídeo finalizado) |
| **Organizar evento** | **Tarefa** | Coordenação operacional complexa, pode ter checklist obrigatório extenso, evidências por etapa e aprovação ao concluir |

### Nota sobre "Atualizar biblioteca"

Este é o único caso com dois domínios envolvidos. O fluxo correto é:

```
Tarefa criada (responsável: X, prazo: Y)
  → Checklist: [rascunhar novo conteúdo] [submeter para revisão] [publicar na Biblioteca]
  → Evidência obrigatória: link do documento publicado
  → Aprovação: Supervisor
Tarefa aprovada → documento vive na Biblioteca como fonte permanente
```

---

## PARTE 3 — ESTRUTURA OFICIAL DA TAREFA

### Campos validados

| Campo | Tipo | Obrigatório | Observação |
|---|---|---|---|
| `título` | string | ✅ | Nome curto e operacional |
| `descrição` | texto longo | — | Detalhamento do que precisa ser feito |
| `operação` | FK Operation | ✅ | Contexto operacional da tarefa |
| `responsável` | FK User | ✅ | Quem executa |
| `criador` | FK User | ✅ | Quem criou (para rastreabilidade) |
| `prazo` | date | ✅ | Quando deve ser concluída |
| `prioridade` | enum | ✅ | BAIXA / MÉDIA / ALTA / CRÍTICA |
| `progresso` | enum de estágios | ✅ | Ver Part 6 — estados do ciclo |
| `comentários` | array thread | — | Comentários entre criador e responsável |
| `checklist obrigatório` | JSONB array | — | Criado pelo criador da tarefa |
| `checklist operacional` | JSONB array | — | Criado pelo responsável |
| `requer aprovação` | boolean | ✅ | Define se há etapa de aprovação |
| `aprovador` | FK User | condicional | Obrigatório se `requer aprovação = true` |
| `evidências obrigatórias` | array de tipo+descrição | — | Definidas pelo criador |
| `evidências complementares` | array de uploads | — | Adicionadas pelo responsável |
| `origem` | enum | — | MANUAL / SOLICITACAO / BIBLIOTECA / IA |

### Campos ausentes identificados

**`operação`** — campo obrigatório que não estava na lista original. Toda tarefa precisa de contexto operacional para filtrar, atribuir e reportar corretamente. Sem ele, a tarefa fica "solta" no sistema.

**`criador`** — diferente do `aprovador`. O criador pode não ser o aprovador. Necessário para rastreabilidade e para o Histórico.

**`origem`** — de onde veio esta tarefa? Criada manualmente? Gerada a partir de uma decisão de Solicitação? Sugerida pela IA? Essencial para o futuro do módulo de IA (Parte 7).

### Campos sem redundância

Todos os 11 campos originais são necessários. Não há sobreposição.

O par `checklist obrigatório` + `checklist operacional` pode parecer redundante mas **não é**: servem perspectivas opostas (o que deve ser feito vs. como farei). O par `evidências obrigatórias` + `evidências complementares` também é necessário: um define o mínimo exigido, o outro permite enriquecer sem obrigatoriedade.

---

## PARTE 4 — CHECKLISTS

### Validação do modelo

**A separação faz sentido. É a base da prestação de contas no domínio de Tarefas.**

```
Checklist Obrigatório (criado pelo criador da tarefa)
  → "O que precisa estar feito para eu aceitar que a tarefa foi concluída"
  → Define o contrato de entrega
  → Exemplos: [Figurino ajustado] [Foto tirada] [Aprovação do diretor obtida]

Checklist Operacional (criado pelo responsável)
  → "Como eu vou organizar meu próprio trabalho para chegar lá"
  → Define o método de execução
  → Exemplos: [Separar material] [Verificar tamanho] [Reservar sala de costura] [Realizar ajuste]
```

### Regras de negócio dos checklists

- O Checklist Obrigatório só pode ser editado pelo **criador** enquanto a tarefa não estiver em "Pronta para Aprovação"
- O Checklist Operacional pode ser editado pelo **responsável** enquanto a tarefa estiver "Em Andamento"
- A conclusão de todos os itens do Checklist Obrigatório é pré-requisito para mover para "Pronta para Aprovação"
- O Checklist Operacional é informativo para o aprovador — não bloqueia a aprovação

---

## PARTE 5 — EVIDÊNCIAS

### Tipos validados

| Tipo | Uso típico na ASA |
|---|---|
| **Foto** | Figurino ajustado, pocket montado, cenário organizado |
| **Vídeo** | Coreografia revisada, treinamento documentado |
| **Documento** | Apresentação, roteiro, instrução escrita |
| **PDF** | Contrato, protocolo formalizado |
| **Link** | Vídeo no YouTube/Drive, apresentação no Canva, documento no Notion |
| **Áudio** | Trilha produzida, narração gravada |
| **Apresentação** | Slides, material de treinamento |

Todos os 7 tipos são necessários e cobrem os casos reais da ASA.

### Respostas às perguntas da auditoria

**A tarefa pode possuir múltiplas evidências?**  
Sim. Uma tarefa pode — e frequentemente vai — ter múltiplas evidências. Exemplo: "Preparar Pocket" pode ter foto do material separado + foto do pocket montado + foto da entrega ao membro.

**Quem define a quantidade mínima?**  
O **criador da tarefa** define as evidências obrigatórias (tipo + descrição do que deve ser fotografado/documentado). O sistema só permite avançar para "Pronta para Aprovação" quando todas as evidências obrigatórias foram anexadas.

**Quem adiciona evidências complementares?**  
O **responsável** pode adicionar quantas evidências complementares quiser além das obrigatórias. O aprovador e o criador também podem anexar materiais complementares ao comentar.

---

## PARTE 6 — APROVAÇÃO E CICLO DE VIDA

### Fluxo validado

```
CRIADA
  ↓
EM ANDAMENTO          ← responsável aceita e começa a trabalhar
  ↓
PRONTA PARA APROVAÇÃO ← checklist obrigatório 100% + evidências obrigatórias anexadas
  ↓
APROVADA              ← aprovador valida o resultado
  
  ou
  
AJUSTES SOLICITADOS   ← aprovador pede correção, com comentário obrigatório
  ↓
EM ANDAMENTO          ← responsável retoma
```

### Estados adicionais necessários

**`CANCELADA`** — a tarefa foi cancelada antes de ser concluída. Criador ou Admin podem cancelar. Motivo registrado. Fica visível no Histórico.

**`EXPIRADA`** — prazo passou sem conclusão. Gerada automaticamente pelo sistema. Notifica supervisor e gera entrada no Histórico.

**`SEM APROVAÇÃO`** — para tarefas com `requer_aprovação = false`, o fluxo encerra em "Concluída" assim que o responsável marca completo e as evidências obrigatórias estão presentes.

### Fluxo completo

```
CRIADA
  ↓
EM ANDAMENTO
  ↓ (prazo excede sem avanço)         ↓ (cancelada pelo criador)
EXPIRADA                           CANCELADA
  ↓ (checklist + evidências ok)
PRONTA PARA APROVAÇÃO
  ↓ (aprovação não exigida)          ↓ (aprovação exigida)
CONCLUÍDA                          APROVADA
                                      ou
                                   AJUSTES SOLICITADOS → EM ANDAMENTO
```

### Esse fluxo atende a operação ASA?

**Sim.** A ASA opera com combinação de tarefas rápidas (sem aprovação formal) e tarefas com impacto cênico ou organizacional alto (requerem aprovação explícita). O campo `requer_aprovação` torna o fluxo adaptável sem complexificar o modelo.

O ciclo de "Ajustes Solicitados → Em Andamento" é especialmente importante para o contexto artístico, onde revisões são parte natural do processo (figurino ajustado, coreografia refinada, apresentação refeita).

---

## PARTE 7 — IA FUTURA

### Como a IA utilizará Tarefas

O módulo de IA do MyASA terá acesso ao domínio de Tarefas para as seguintes capacidades, em ordem de complexidade crescente:

**Nível 1 — Observação (disponível imediatamente após implementação)**
- Acompanhar progresso em tempo real: "Tarefa X está há 3 dias sem atualização"
- Detectar atrasos iminentes: "Tarefa Y vence em 24h e ainda está Em Andamento"
- Gerar resumos operacionais: "Esta semana: 4 tarefas concluídas, 2 atrasadas, 1 aguardando aprovação"

**Nível 2 — Sugestão (após acumular histórico)**
- Sugerir responsável com base em histórico: "Pedro concluiu as últimas 3 tarefas de figurino dentro do prazo"
- Sugerir prazo realista: "Tarefas similares levaram em média 4 dias"
- Identificar bloqueios: "Tarefa Z está Pronta para Aprovação há 48h sem aprovador responder"

**Nível 3 — Geração (integrado com Biblioteca e Histórico)**
- Criar tarefa automaticamente a partir de uma decisão de Solicitação aprovada com follow-up ("Solicitação de ajuste de figurino aprovada → criar tarefa para costureira")
- Sugerir criação de tarefa ao detectar lacuna operacional no Livro do Show
- Gerar checklist operacional sugerido com base em tarefas similares anteriores

**Campo `origem` = 'IA'** rastreia todas as tarefas geradas automaticamente, permitindo auditoria e refinamento do modelo.

---

## PARTE 8 — GOVERNANÇA

### Quem pode criar?

| Papel | Pode criar? | Escopo |
|---|---|---|
| **Admin** | ✅ Sim | Qualquer operação da organização |
| **Supervisor A** | ✅ Sim | Operações sob sua responsabilidade |
| **Supervisor B** | ✅ Sim | Operações sob sua responsabilidade |
| **Delegado** | ✅ Sim (GOV-D11) | Operações dentro do período de delegação |
| **Membro** | ❌ Não | Membros executam, não criam tarefas operacionais |

**Nota sobre Membros:** Membros não criam Tarefas — eles podem criar **Solicitações** se precisam que algo seja feito pela gestão. A gestão então decide se abre ou não uma Tarefa. Isso preserva a cadeia de responsabilidade.

### Quem pode aprovar?

| Papel | Pode aprovar? | Condição |
|---|---|---|
| **Admin** | ✅ Sempre | Pode aprovar qualquer tarefa na organização |
| **Supervisor A/B** | ✅ Sim | Quando designado como `aprovador` da tarefa |
| **Delegado** | ✅ Sim | Dentro do escopo e período delegados |
| **Membro** | ❌ Não | Membros não aprovam |

O campo `aprovador` da tarefa define quem é o aprovador designado. O Admin sempre pode aprovar independentemente de designação.

### Quem pode encerrar (cancelar)?

| Papel | Pode encerrar? | Condição |
|---|---|---|
| **Admin** | ✅ Sempre | Qualquer tarefa |
| **Criador da tarefa** | ✅ Sim | Tarefas que ele criou, antes de "Pronta para Aprovação" |
| **Supervisor A/B** | ✅ Sim | Tarefas em sua operação |
| **Membro (responsável)** | ❌ Não | O responsável não pode cancelar — pode apenas comunicar impedimento via comentário |

**Regra de ouro:** O responsável pelo trabalho não pode cancelar o compromisso — apenas reportar bloqueios. A decisão de cancelamento é sempre da gestão.

---

## SÍNTESE FINAL

### Definição oficial do domínio

> **Tarefa Operacional** é uma unidade de trabalho no MyASA que:
>
> 1. É atribuída pela gestão a um responsável com prazo e prioridade definidos
> 2. Possui um contrato de entrega claro (checklist obrigatório + evidências obrigatórias)
> 3. Permite que o responsável organize sua própria execução (checklist operacional)
> 4. Rastreia progresso ao longo de um ciclo de vida com estados definidos
> 5. Culmina em aprovação verificável (quando exigida) antes de ser encerrada
> 6. Deixa rastro no Histórico operacional

### O que a Tarefa NÃO é

- Não é um aviso (ninguém "executa" um aviso)
- Não é uma solicitação (ninguém "aprova" uma solicitação como se fosse trabalho)
- Não é uma entrega (ninguém "produz" uma entrega — ele consome)
- Não é uma mensagem (mensagens são conversacionais, não têm ciclo de aprovação)

### Campos obrigatórios no schema (S-18)

```
tasks
  id
  organizationId
  operationId         ← ADICIONADO na auditoria
  title
  description
  creatorId           ← ADICIONADO na auditoria
  assigneeId          (responsável)
  approverId          (condicional)
  requiresApproval    boolean
  priority            BAIXA | MÉDIA | ALTA | CRÍTICA
  status              CRIADA | EM_ANDAMENTO | PRONTA_PARA_APROVACAO | AJUSTES_SOLICITADOS | APROVADA | CONCLUIDA | CANCELADA | EXPIRADA
  dueDate
  mandatoryChecklist  JSONB []{ id, label, completed }
  operationalChecklist JSONB []{ id, label, completed }
  mandatoryEvidences  JSONB []{ id, type, description }
  origin              MANUAL | SOLICITACAO | BIBLIOTECA | IA
  createdAt
  updatedAt

task_evidences
  id
  taskId
  uploaderId
  type                FOTO | VIDEO | DOCUMENTO | PDF | LINK | AUDIO | APRESENTACAO
  url
  description
  isRequired          boolean (true = obrigatória, false = complementar)
  createdAt

task_comments
  id
  taskId
  authorId
  body
  createdAt
```

---

*Documento gerado para Sprint 18. Nenhuma tabela criada, nenhuma API implementada, nenhuma tela construída.*  
*A implementação da Sprint 18 deve ser baseada exclusivamente nesta arquitetura.*
