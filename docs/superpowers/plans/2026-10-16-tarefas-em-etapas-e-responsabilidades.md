# Tarefas em etapas e responsabilidades com pedidos — plano de construção

> **Para quem executa:** USE superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans, tarefa por tarefa. Os passos usam caixas `- [ ]`.

**Meta:** tarefa vira uma lista de etapas (cada uma com pessoa, prazo e, se quiser, checklist), com aprovação como etapa; responsabilidade passa a receber pedidos e a ter lista fixa com repetição; tudo avisa quem precisa.

**Arquitetura:** a tabela `tasks` continua existindo e continua com `status`, `assignee_id` e `due_date` (ASA, Meu Dia, Painel e os testes atuais leem esses campos). Entram `task_steps` (as etapas) e uma máquina de estados pura em `services/task-steps.ts`, que decide quem tem a vez e qual é o `status` da tarefa. As rotas antigas (`/start`, `/ready-for-approval`, `/approve`, `/request-changes`) passam a agir na etapa ativa, para nada quebrar. Pedidos e a lista fixa são tabelas novas em `responsibilities.ts`. Os lembretes saem do ciclo operacional que já existe (`rodarCicloOperacional`, chamado pelo agendador do Supabase), com `deduplicationKey` para um aviso por acontecimento.

**Tecnologias:** Express + Drizzle (Postgres), React/Vite, testes em `artifacts/api-server/tests` contra o banco de teste.

**Desenho:** `docs/superpowers/specs/2026-10-16-tarefas-em-etapas-e-responsabilidades-design.md` (aprovado em 16/10/2026). Leia junto: as decisões e as "Decisões minhas" valem.

## Restrições globais (valem para toda tarefa)

- Português do Brasil em código, comentários, commits e textos da tela. Texto explica a regra, não o botão.
- Toda escrita grava `writeHistoryEvent` na mesma transação (`category: "TASK"` para tarefas; `"OPERATIONAL_CHANGE"` para responsabilidades, como o código atual). Exceção (dispensar etapa, reatribuir, cancelar) leva o motivo escrito.
- Remoção é lógica e restaurável; etapa concluída nunca some.
- Migração: só no banco de **teste** (`node --env-file=../../.env.test ../../node_modules/.pnpm/tsx@<versão>/node_modules/tsx/dist/cli.mjs src/migrate.ts`, dentro de `lib/db`). Cada migração tem rollback em `lib/db/drizzle/rollback/NNNN_nome.down.sql` e entrada em `meta/_journal.json` (próximos: `0072`, `0073`; `when` = anterior + 86400000, o `0071` é `1792375200000`). Nunca rode em produção.
- Depois de mexer no schema, compile `lib/db` antes de checar os tipos da API.
- Aviso no sino: um por acontecimento, nunca para quem fez a ação, sempre com `deduplicationKey` quando vier de rotina.
- Telefone primeiro: toda tela nova se confere a **375 px**, com rodapé de confirmar e cancelar visível (crivo 3 e 16), fecha com Esc (`useFecharComEsc`), mensagem de erro com a frase do servidor.
- Dados de exemplo com nomes só dentro de `import.meta.env.DEV`; depois do `vite build`, rode `node scripts/verificar-nomes-build.mjs`.
- Anexo é só **link do Drive**: nada de upload. Hosts aceitos: `drive.google.com` e `docs.google.com`.
- Não faça push nem promova nada. Commits locais em português, contando o que estava errado e por quê.
- Comandos de tipo, build e teste estão no `AGENTS.md` (use os caminhos de lá).

## Foco da revisão (o que o desenho não diz e pode morder)

1. **Pedido aceito por duas pessoas ao mesmo tempo:** só uma vence; a outra recebe "já foi aceito por X" (409), nunca duas tarefas. (Task 9)
2. **Etapa em fila com a mesma pessoa em duas etapas seguidas:** um aviso só, não dois. (Task 3)
3. **Tarefa cancelada ou etapa dispensada:** lembrete e "parada" não disparam para ela. (Tasks 4 e 6)
4. **Link que não é do Drive** (`javascript:`, outro host, texto solto): recusado com frase clara; link do Drive sem compartilhamento: avisa e deixa salvar. (Task 5)
5. **Pessoa desligada recebendo etapa ou pedido:** recusado na criação; se ficar desligada depois, a tarefa aparece para a Administração como parada. (Tasks 3 e 9)

---

## Mapa de arquivos

| Arquivo | O que faz |
|---|---|
| `lib/db/src/schema/tasks.ts` (muda) | `task_steps`, colunas novas em `tasks`, `task_evidences.step_id` |
| `lib/db/src/schema/responsibilities.ts` (muda) | `responsibility_requests`, `responsibility_request_recipients`, `responsibility_routines` |
| `lib/db/drizzle/0072_tarefas_em_etapas.sql` + `.down.sql` | etapas, colunas e o preenchimento das tarefas atuais |
| `lib/db/drizzle/0073_pedidos_e_rotinas.sql` + `.down.sql` | pedidos e lista fixa |
| `artifacts/api-server/src/services/task-steps.ts` (novo) | estado das etapas, criação e mudanças, avisos de etapa |
| `artifacts/api-server/src/services/drive-link.ts` (novo) | validar link, montar o endereço embutido, checar compartilhamento |
| `artifacts/api-server/src/services/task-reminders.ts` (novo) | lembretes, atrasada, parada, rotinas que voltam |
| `artifacts/api-server/src/services/responsibility-requests.ts` (novo) | destinatários, aceitar, recusar |
| `artifacts/api-server/src/routes/tasks.ts` (muda) | criação aberta, etapas, rotas antigas sobre a etapa ativa |
| `artifacts/api-server/src/routes/responsibilities.ts` (muda) | pedidos e lista fixa |
| `artifacts/api-server/src/services/operational-jobs.ts`, `routes/internal.ts`, `runtime.ts` (mudam) | lembretes no ciclo; sai `taskReminderService.ts` |
| `artifacts/web-admin/src/components/` (novos) | `tarefa-nova.tsx`, `tarefa-detalhe.tsx`, `drive-link.tsx`, `responsabilidade-detalhe.tsx`, `pedido-novo.tsx` |
| `artifacts/web-admin/src/pages/responsibilities-tasks.tsx` + `.css` (mudam) | só ligam os componentes |
| testes novos | `tarefas-etapas-estado`, `tarefas-etapas`, `tarefas-link-drive`, `tarefas-avisos`, `responsabilidade-pedidos`, `responsabilidade-rotinas` (`.test.ts`, registrados em `tests/run-tests.mjs`) |

---

### Task 1: Migração 0072 e schema das etapas

**Arquivos:**
- Criar: `lib/db/drizzle/0072_tarefas_em_etapas.sql`, `lib/db/drizzle/rollback/0072_tarefas_em_etapas.down.sql`
- Mudar: `lib/db/drizzle/meta/_journal.json`, `lib/db/src/schema/tasks.ts`

**Interfaces — produz:**
- `taskStepsTable` com: `id uuid`, `taskId`, `position int`, `kind: "WORK" | "APPROVAL"`, `title text`, `description text|null`, `assigneeId uuid`, `dueDate date|null`, `status: "WAITING" | "ACTIVE" | "DONE" | "DISPENSED"`, `checklist jsonb {id,label,completed}[]`, `startedAt`, `doneAt`, `doneById`, `dispensedReason text|null`, `active boolean`, `createdAt`.
- `tasks.ordering: "SEQUENTIAL" | "FREE"` (padrão `SEQUENTIAL`), `tasks.period_start date|null`, `tasks.due_date` passa a aceitar nulo, `tasks.last_activity_at timestamptz` (padrão `now()`).
- `task_evidences.step_id uuid|null`.

- [ ] **Passo 1: escreva o SQL aditivo** (padrão do `0071`): cria `task_steps` com `CHECK (btrim(title) <> '')`, índice `(task_id, position)` único entre `active`, `ENABLE ROW LEVEL SECURITY` e `REVOKE ALL ... FROM anon, authenticated, PUBLIC`; `ALTER TABLE tasks` adiciona `ordering`, `period_start`, `last_activity_at` e remove o `NOT NULL` de `due_date`; `ALTER TABLE task_evidences ADD COLUMN step_id`.
- [ ] **Passo 2: preencha as tarefas atuais no mesmo SQL.** Para cada tarefa: etapa 1 `WORK` (pessoa = `assignee_id`, prazo = `due_date`, `checklist` = `mandatory_checklist`); se `requires_approval` e há `approver_id`, etapa 2 `APPROVAL` (pessoa = `approver_id`). Estado: `CREATED/IN_PROGRESS/CHANGES_REQUESTED` → etapa 1 `ACTIVE`; `READY_FOR_APPROVAL` → etapa 1 `DONE`, etapa 2 `ACTIVE`; `APPROVED/COMPLETED` → todas `DONE`; `CANCELLED/EXPIRED` → etapa 1 `ACTIVE`, resto `WAITING` (a tarefa continua encerrada pelo `status`). `last_activity_at = updated_at`.
- [ ] **Passo 3: escreva o rollback** que devolve exatamente o que havia: derruba `task_steps` e as colunas novas e repõe `NOT NULL` em `due_date` só se não houver nulo (se houver, o comentário do arquivo diz para resolver antes). Comentário de cabeçalho dizendo o que se perde, como no `0071`.
- [ ] **Passo 4: registre no `_journal.json`** (`idx 72`, `tag 0072_tarefas_em_etapas`) e declare as tabelas e colunas em `schema/tasks.ts`, exportando os tipos `TaskStep` e `InsertTaskStep`.
- [ ] **Passo 5: aplique no banco de teste** e confira com uma consulta: nenhuma tarefa sem etapa (`SELECT count(*) FROM tasks t WHERE NOT EXISTS (SELECT 1 FROM task_steps s WHERE s.task_id = t.id)` deve dar 0). Depois aplique o rollback e a migração de novo, para provar que desfaz e refaz.
  Esperado: contagem 0 nas duas vezes.
- [ ] **Passo 6: compile `lib/db`** e **commit** ("Etapas de tarefa: migração 0072, schema e preenchimento das tarefas atuais").

---

### Task 2: Máquina de estados das etapas (pura, sem banco)

**Arquivos:**
- Criar: `artifacts/api-server/src/services/task-steps.ts` (parte pura), `artifacts/api-server/tests/tarefas-etapas-estado.test.ts`
- Mudar: `artifacts/api-server/tests/run-tests.mjs` (registrar o teste)

**Interfaces — produz** (tipos exportados):
```ts
type StepKind = "WORK" | "APPROVAL"; type StepStatus = "WAITING" | "ACTIVE" | "DONE" | "DISPENSED";
type Ordering = "SEQUENTIAL" | "FREE"; type TaskStatusValue = "CREATED" | "IN_PROGRESS" | "READY_FOR_APPROVAL" | "CHANGES_REQUESTED" | "COMPLETED";
type StepLite = { id: string; position: number; kind: StepKind; status: StepStatus; assigneeId: string; startedAt: Date | null };
function statusesIniciais(ordering: Ordering, steps: Pick<StepLite, "id" | "kind" | "position">[]): Map<string, StepStatus>;
function aoConcluir(ordering: Ordering, steps: StepLite[], stepId: string): { statuses: Map<string, StepStatus>; novasAtivas: string[]; taskStatus: TaskStatusValue };
function aoPedirAjustes(steps: StepLite[], aprovacaoId: string, voltarParaId: string): { statuses: Map<string, StepStatus>; novasAtivas: string[]; taskStatus: "CHANGES_REQUESTED" };
function aoDispensar(ordering: Ordering, steps: StepLite[], stepId: string): { statuses: Map<string, StepStatus>; novasAtivas: string[]; taskStatus: TaskStatusValue };
function statusDaTarefa(steps: StepLite[], atual: TaskStatusValue): TaskStatusValue;
```
Regras (do desenho): em fila, só a primeira etapa nasce `ACTIVE` e concluir uma ativa a próxima não dispensada; em solta, todas as `WORK` nascem `ACTIVE` e cada `APPROVAL` só fica `ACTIVE` quando todas as outras não dispensadas estão `DONE`; sem etapa `WAITING`/`ACTIVE` a tarefa é `COMPLETED`; etapa `APPROVAL` ativa dá `READY_FOR_APPROVAL`; pedir ajustes reabre a etapa escolhida (`ACTIVE`), recoloca as depois dela como `WAITING` e dá `CHANGES_REQUESTED`.

- [ ] **Passo 1: escreva o teste que falha** (sem banco, roda em milissegundos), com estes casos e afirmações:
  - `fila: só a primeira nasce ativa` → `statusesIniciais("SEQUENTIAL", [a,b,c])` dá `ACTIVE, WAITING, WAITING`.
  - `solta: todas as de trabalho nascem ativas e a aprovação espera` → `ACTIVE, ACTIVE, WAITING`.
  - `concluir a ativa da fila ativa a próxima e avisa só ela` → `novasAtivas` tem só o id da seguinte.
  - `última etapa concluída fecha a tarefa` → `taskStatus === "COMPLETED"`.
  - `aprovação ativa deixa a tarefa READY_FOR_APPROVAL`.
  - `solta: aprovação só abre depois de todas as outras` (concluir uma de duas deixa a aprovação `WAITING`).
  - `dispensar etapa ativa da fila pula para a seguinte`; `dispensar a última etapa pendente fecha a tarefa`; `dispensar todas as etapas deixa a tarefa COMPLETED` (foco da revisão 3).
  - `pedir ajustes volta para a etapa escolhida e as seguintes esperam`.
  - `mesma pessoa em duas etapas seguidas: novasAtivas lista as duas etapas, mas o chamador junta por pessoa` (a junção por pessoa é testada na Task 3; aqui basta `novasAtivas` correto).
- [ ] **Passo 2: rode** `TEST_FILE=tarefas-etapas-estado.test.ts` e confirme que falha ("função não definida").
- [ ] **Passo 3: implemente as funções puras** em `task-steps.ts`, sem importar `db`.
- [ ] **Passo 4: rode de novo; esperado: todos passam.** **Passo 5: commit** ("Estado das etapas: regras de fila, solta, aprovação e ajustes, com testes").

---

### Task 3: Criar, ler e mexer em tarefas com etapas (API)

**Arquivos:**
- Mudar: `artifacts/api-server/src/services/task-steps.ts` (parte com banco), `artifacts/api-server/src/routes/tasks.ts`, `artifacts/api-server/src/services/meu-dia.ts` (linhas ~93 e ~320), `artifacts/api-server/src/routes/asa.ts` (linhas ~215, ~375, ~729)
- Testar: `artifacts/api-server/tests/tarefas-etapas.test.ts` (registrar no `run-tests.mjs`)

**Interfaces — consome:** Task 2. **Produz:**
```ts
type NovaEtapa = { kind?: StepKind; title: string; description?: string; assigneeId: string; dueDate?: string; checklist?: string[] };
type NovaTarefa = { operationId: string; title: string; description?: string; ordering?: Ordering; periodStart?: string; dueDate?: string; priority?: string; responsibilityId?: string; origin?: string; steps: NovaEtapa[] };
function criarTarefa(tx: Transaction, ator: { id: string; organizationId: string; role: string }, entrada: NovaTarefa): Promise<{ task: Task; steps: TaskStep[] }>;  // valida, grava, avisa quem tem a vez, grava no Registro
function concluirEtapa(tx, ator, taskId, stepId): Promise<...>; function dispensarEtapa(tx, ator, taskId, stepId, motivo: string); function reatribuirEtapa(tx, ator, taskId, stepId, novaPessoaId: string, motivo: string); function adicionarEtapa(tx, ator, taskId, etapa: NovaEtapa, depoisDeStepId?: string);
function etapasAbertasDe(userId: string, organizationId: string, executor?): Promise<{ taskId: string; stepId: string; dueDate: string | null }[]>;  // etapas ACTIVE da pessoa em tarefas abertas
```
Rotas: `POST /tasks` aceita `steps`; **qualquer pessoa autenticada da organização cria**, para qualquer pessoa ativa da organização; sem `steps`, o corpo antigo (`assigneeId`, `dueDate`, `requiresApproval`, `approverId`) vira uma etapa `WORK` (+ `APPROVAL` se pedir), para o ASA e os testes atuais seguirem iguais. Novas: `POST /tasks/:id/steps` (adicionar), `POST /tasks/:id/steps/:stepId/{start,complete,dispense,reassign}`, `PATCH /tasks/:id/steps/:stepId` (título, descrição, prazo, checklist). `POST /tasks/:id/request-changes` aceita `backToStepId` (padrão: a última etapa `WORK` concluída). `GET /tasks/my` passa a buscar por `etapasAbertasDe` (e inclui as concluídas da pessoa). `GET /tasks/:id` devolve `steps` e a pessoa "envolvida" passa a incluir quem tem etapa. Quem cancela, reatribui, dispensa e adiciona etapa: quem criou, ADMIN, DIR, e Supervisão que passa em `canManageTasks` (regra já existente, sem mudar). Todo motivo vai no Registro. Etapa concluída não se reabre, não se remove.

- [ ] **Passo 1: escreva o teste que falha** (servidor HTTP como em `tarefas-lote.test.ts`: organização, operação, Administração, três do Elenco e uma pessoa desligada), com estas afirmações:
  - `Elenco cria tarefa de 4 etapas para colegas (roteiro, gravar, editar, aprovar) e recebe 201`; antes o servidor dava 403.
  - `só a pessoa da etapa 1 recebe o aviso "chegou a sua vez" na criação; as outras não` (fila).
  - `concluir a etapa 1 avisa só a pessoa da etapa 2` e `quem concluiu não se avisa`.
  - `a mesma pessoa em duas etapas seguidas recebe um aviso só` (foco 2).
  - `quem não é da tarefa, nem criou, nem gestão: GET /tasks/:id dá 403 com a frase "Esta tarefa não é sua..."`; `Administração e Direção veem; Direção também cria`.
  - `etapa de outra pessoa não pode ser concluída por você` (403 com frase); `Administração pode dispensar com motivo` e `dispensar sem motivo dá 400`.
  - `reatribuir para pessoa desligada dá 400 "essa pessoa não está ativa"` (foco 5).
  - `pedir ajustes devolve à etapa escolhida, a tarefa fica CHANGES_REQUESTED e essa pessoa é avisada`.
  - `a última etapa concluída deixa status COMPLETED` e `GET /tasks/my` da pessoa mostra a tarefa enquanto a etapa dela está ativa e depois que concluiu.
  - `corpo antigo (assigneeId + dueDate + requiresApproval) ainda cria tarefa com etapas`.
  - `todo passo gravou no Registro (history_events com action task.step_completed etc.) e o motivo aparece em metadata.reason`.
- [ ] **Passo 2: rode e confirme que falha.**
- [ ] **Passo 3: implemente** os serviços (cada um em **uma transação**: grava, chama as funções da Task 2, atualiza `tasks.status`, `tasks.assignee_id` (= pessoa da etapa ativa mais recente, para o ASA/Painel) e `last_activity_at`, grava o Registro e enfileira o aviso com `enqueueNotification` e chave `task-step:<stepId>:<userId>`; avisos `type: "task.step_ready"`, categoria `responsibility`, `actionUrl: "/responsabilidades"`). Junte avisos por pessoa antes de enfileirar. Valide: no máximo **20 etapas**, título não vazio, pessoa ativa da organização.
- [ ] **Passo 4: religue as rotas** em `tasks.ts` e troque as consultas de `meu-dia.ts` e `asa.ts` que filtram por `assigneeId` para `etapasAbertasDe`; a inserção direta em `asa.ts` (~729) passa a chamar `criarTarefa`, para toda tarefa nascer com etapas.
- [ ] **Passo 5: rode** `tarefas-etapas`, `tarefas-lote`, `fase-c-meu-dia`, `asa-actions-http` e `block5-integrity`; esperado: todos passam. **Passo 6: commit.**

---

### Task 4: Aprovação como etapa e avisos da tarefa

**Arquivos:** `services/task-steps.ts`, `routes/tasks.ts`, `tests/tarefas-etapas.test.ts` (novos casos)

- [ ] **Passo 1: acrescente os casos que falham:**
  - `a etapa de aprovação ativa avisa só quem aprova ("pronta para aprovar")`.
  - `aprovar conclui a etapa e a tarefa; o aprovador pode ser qualquer pessoa, não só a designada na criação (ADMIN também aprova)`.
  - `quem criou a tarefa recebe um aviso quando a tarefa termina` (sem aviso a si mesmo).
  - `Administração, Direção e a Supervisão da área veem a tarefa parada e podem cobrar` (a cobrança é o aviso de "parada", Task 6; aqui só a visibilidade em `GET /tasks`).
  - `cancelar tarefa avisa quem tem etapa ativa ou esperando`, não só uma pessoa, e nenhum aviso a quem cancelou.
- [ ] **Passo 2: rode, veja falhar; Passo 3: implemente** (`task.awaiting_approval`, `task.completed`; o `task.cancelled` atual passa a avisar todas as pessoas das etapas não concluídas); **Passo 4: rode; esperado passa; Passo 5: commit.**

---

### Task 5: Link do Drive (validar, avisar e abrir dentro do app)

**Arquivos:**
- Criar: `artifacts/api-server/src/services/drive-link.ts`, `artifacts/api-server/tests/tarefas-link-drive.test.ts`
- Mudar: `routes/tasks.ts` (evidências), `tests/run-tests.mjs`

**Interfaces — produz:**
```ts
type LinkDrive = { ok: true; host: "drive.google.com" | "docs.google.com"; fileId: string; kind: "file" | "document" | "spreadsheet" | "presentation" | "folder"; openUrl: string; embedUrl: string | null } | { ok: false; motivo: string };
function lerLinkDrive(texto: string): LinkDrive;                       // pura
function checarCompartilhamento(url: string, buscar?: typeof fetch): Promise<true | false | null>;   // false = pede login; null = não deu para saber
```
Rotas: `POST /tasks/check-link { url }` → `{ valid, shared, embedUrl, openUrl, message }`; `POST /tasks/:id/evidences` passa a aceitar **só link do Drive** (`type: "LINK"`), com `stepId` opcional, e devolve `shared` junto (não bloqueia).

- [ ] **Passo 1: escreva o teste puro que falha** com estas afirmações (valores reais):
  - `https://drive.google.com/file/d/1AbC/view?usp=sharing` → `ok`, `embedUrl === "https://drive.google.com/file/d/1AbC/preview"`.
  - `https://docs.google.com/document/d/1AbC/edit` → `kind "document"`, `embedUrl` termina em `/preview`.
  - `https://drive.google.com/drive/folders/1AbC` → `kind "folder"`, `embedUrl === null` (pasta não incorpora; a tela mostra "Abrir no Drive").
  - `javascript:alert(1)`, `http://drive.google.com.evil.com/file/d/1/view` e `texto solto` → `ok: false` com `motivo` em português.
  - `checarCompartilhamento` com `buscar` simulado que responde redirecionamento para `accounts.google.com` → `false`; resposta 200 → `true`; erro de rede → `null`.
  - Rota (teste HTTP): evidência com link fora do Drive dá 400 com a frase; link do Drive sem compartilhamento (simulado) dá 201 e `shared: false`.
- [ ] **Passo 2: rode e veja falhar. Passo 3: implemente** (host só da lista; a busca usa `redirect: "manual"` e tempo máximo de 4 s, e só vai a esses dois hosts, para o servidor não virar porta de acesso a qualquer endereço; o sinal de "não compartilhado" é o redirecionamento para `accounts.google.com`). Evidências antigas que não são link continuam sendo lidas; só não se criam novas.
- [ ] **Passo 4: rode; esperado passa. Passo 5: commit.**

---

### Task 6: Lembretes, atrasada e parada (substituem o aviso antigo)

**Arquivos:**
- Criar: `artifacts/api-server/src/services/task-reminders.ts`, `artifacts/api-server/tests/tarefas-avisos.test.ts`
- Mudar: `services/operational-jobs.ts` (`rodarCicloOperacional` e `startOperationalScheduler`), `routes/internal.ts`, `runtime.ts`; apagar `services/taskReminderService.ts`
- Mudar: `tests/run-tests.mjs`

**Interfaces — produz:** `enqueueTaskReminders(now?: Date, organizationId?: string): Promise<{ aviso: number; hoje: number; atrasada: number; parada: number }>`

Regras (do desenho): prazo da etapa é `task_steps.due_date`, senão `tasks.due_date` (com período, o fim do período), senão nenhum (sem prazo só avisa quando chega a vez). Etapa `ACTIVE` de tarefa aberta recebe: lembrete **um dia antes**, outro **no dia**, e **atrasada** (aviso à pessoa e a quem criou). Tarefa aberta sem `last_activity_at` há **3 dias** avisa quem criou ("parada"); o limite fica em uma constante `DIAS_PARADA = 3` com comentário de que a Administração poderá configurá-lo. Chaves de deduplicação: `task-due-1:<stepId>:<data>`, `task-due-0:<stepId>:<data>`, `task-late:<stepId>:<data>` (um por dia atrasado, e só no primeiro dia e a cada 3 dias depois), `task-stalled:<taskId>:<data de 3 em 3 dias>`. Nunca para tarefa cancelada, concluída ou etapa dispensada.

- [ ] **Passo 1: escreva o teste que falha** (cria tarefas com datas relativas a um `now` fixo e chama a função):
  - `um dia antes: a pessoa da etapa ativa recebe um aviso; chamar duas vezes não duplica` (chave de deduplicação).
  - `no dia: segundo aviso; etapa em espera (fila) não recebe nada`.
  - `atrasada: avisa a pessoa e quem criou, e não avisa quem criou se ele é a pessoa`.
  - `parada há 3 dias avisa só quem criou; tarefa cancelada e etapa dispensada não avisam` (foco 3).
  - `etapa sem prazo próprio herda o da tarefa; sem nenhum prazo, nenhum lembrete`.
  - `período: o lembrete conta do fim do período`.
- [ ] **Passo 2: rode, falha. Passo 3: implemente e ligue ao ciclo** (`rodarCicloOperacional` ganha `resultado.tarefas = await enqueueTaskReminders(now, organizationId)` antes do segundo `processNotificationOutbox`; `startOperationalScheduler` chama a cada minuto junto do bloco dos check-ins; `internal.ts` e `runtime.ts` deixam de usar `sendTaskDueReminders`/`startTaskReminderScheduler`, e o arquivo antigo é apagado).
- [ ] **Passo 4: rode `tarefas-avisos`, `internal-ciclo-trava` e `grupo-b-operational-cycle`; esperado passam. Passo 5: commit.**

---

### Task 7: Tela de Tarefas (criar com etapas, detalhe, link do Drive)

**Arquivos:**
- Criar: `artifacts/web-admin/src/components/tarefa-nova.tsx`, `tarefa-detalhe.tsx`, `drive-link.tsx`
- Mudar: `artifacts/web-admin/src/pages/responsibilities-tasks.tsx`, `responsibilities-tasks.css`

**Interfaces — consome:** rotas da Task 3 e 5. **Produz:** `<TarefaNova pessoas operacoes responsabilidades onCriada onFechar />`, `<TarefaDetalhe tarefaId meuId papel onMudou onFechar />`, `<LinkDrive url />` (mostra a visualização embutida; se `embedUrl` é nulo ou não carregar, mostra "Abrir no Drive").

Comportamento (mockups aprovados em 16/10, opção A):
- **Botão "Nova tarefa" aparece para todos os papéis, inclusive Elenco** (hoje só quem distribui). "Preparar lote" continua como está, só para quem distribui.
- Formulário: título (único campo obrigatório), descrição, lista de etapas (cada uma: nome, pessoa, prazo opcional, descrição opcional, checklist opcional, marcada ou não como aprovação, adicionar/remover/reordenar), escolha **em fila / solta**, prazo da tarefa ou período (opcional), responsabilidade (opcional). Rodapé fixo com **Cancelar** e **Criar tarefa**, visível a 375 px e sem ficar atrás do teclado; fechar com Esc; com coisa digitada, perguntar antes de descartar (como o lote).
- Lista: cada cartão mostra a etapa da vez e a pessoa ("Editar · Luíse"); filtro "Minhas" vale para quem tem etapa ativa; tarefa sem prazo aparece em "Em aberto" com a palavra "Sem prazo".
- Detalhe: etapas na ordem com estado, quem concluiu e quando; checklist marcável por quem tem a etapa; links do Drive por etapa (com o aviso "esse arquivo não está compartilhado" quando `shared === false`); botões **Concluir etapa**, **Pedir ajustes** (escolhe a etapa e escreve o motivo), **Dispensar**, **Passar para outra pessoa**, **Adicionar etapa** só para quem pode (o servidor decide; a tela esconde o botão e, se o servidor recusar, mostra a frase dele); comentários continuam. "Cancelar tarefa" existe e pergunta (já existe).
- Textos vazios explicados: "Quando uma tarefa for distribuída para você, ela aparece aqui." continua; tarefa sem etapa pendente diz "Todas as etapas foram feitas."

- [ ] **Passo 1: implemente os componentes** seguindo as classes `rt-*` e os diálogos existentes (cópia do padrão de `rt-dialog`, `rt-backdrop`, `useFecharComEsc`); dados de exemplo com nomes só em `import.meta.env.DEV`.
- [ ] **Passo 2: tipos** — rode o `tsc` do site; esperado: sem erro novo (só o erro antigo de `components/ui/spinner.tsx`).
- [ ] **Passo 3: confira na empresa de teste** (`docs/empresa-de-teste.md`, com servidor de verdade): como Elenco, criar a tarefa do vídeo (Roteiro → Gravar → Editar → Aprovar) para três colegas e a aprovação para a Administração; abrir como a pessoa da etapa 1, concluir, ver a etapa 2 ativar; colar um link do Drive e ver o aviso/visualização; a **375 px**, conferir que o rodapé do formulário aparece com o teclado aberto e que Esc fecha. Tirar uma captura.
- [ ] **Passo 4: `vite build` + `node scripts/verificar-nomes-build.mjs`** (0 nomes no pacote). **Passo 5: commit.**

---

### Task 8: Migração 0073, pedidos e lista fixa (schema)

**Arquivos:** `lib/db/drizzle/0073_pedidos_e_rotinas.sql` + `rollback/0073_pedidos_e_rotinas.down.sql`, `meta/_journal.json`, `lib/db/src/schema/responsibilities.ts`

**Produz:**
- `responsibility_requests`: `id`, `org_id`, `responsibility_id`, `requester_id`, `title` (não vazio), `details`, `due_date date|null`, `status: OPEN | ACCEPTED | DECLINED | CANCELLED`, `accepted_by_id`, `accepted_at`, `task_id`, `created_at`.
- `responsibility_request_recipients`: `request_id`, `user_id`, `declined_at`, `decline_reason`, chave `(request_id, user_id)`.
- `responsibility_routines`: `id`, `responsibility_id`, `title`, `owner_id`, `repeat_kind: NONE | DAILY | WEEKLY | MONTHLY | EVERY_N_DAYS`, `repeat_n int|null`, `weekday int|null (0-6)`, `done boolean`, `last_done_at`, `next_due_on date|null`, `active boolean`, `created_by`, `created_at`.
- RLS ligada e `REVOKE ALL ... FROM anon, authenticated, PUBLIC` em todas, como no `0071`.

- [ ] **Passo 1: escreva SQL e rollback** (o rollback derruba as três tabelas, com comentário do que se perde). **Passo 2: journal e schema Drizzle.** **Passo 3: aplique no banco de teste, aplique o rollback e aplique de novo; compile `lib/db`.** **Passo 4: commit.**

---

### Task 9: Pedido a uma responsabilidade (API)

**Arquivos:**
- Criar: `artifacts/api-server/src/services/responsibility-requests.ts`, `artifacts/api-server/tests/responsabilidade-pedidos.test.ts`
- Mudar: `routes/responsibilities.ts`, `tests/run-tests.mjs`

**Interfaces — produz:**
```ts
function destinatariosDoPedido(tx, responsibilityId: string, organizationId: string, quando: Date): Promise<{ userIds: string[]; semDono: boolean }>;  // PRIMARY e SECONDARY ativos (sem VIEWER), mais o substituto dentro do período; vazio -> Administração, semDono=true
function criarPedido(tx, ator, entrada: { responsibilityId: string; title: string; details?: string; dueDate?: string }): Promise<Request>;
function aceitarPedido(tx, ator, requestId: string, entrada?: { dueDate?: string }): Promise<{ request: Request; task: Task }>;   // trava a linha (FOR UPDATE); só um vence
function recusarPedido(tx, ator, requestId: string, motivo: string): Promise<Request>;
```
Rotas: `POST /responsibilities/:id/requests` (qualquer pessoa autenticada), `GET /responsibilities/:id/requests` (destinatários, quem pediu, Administração, Direção), `POST /responsibility-requests/:id/accept`, `.../decline`, `.../cancel` (quem pediu, enquanto `OPEN`).

Regras: aceitar cria **uma tarefa** com `criarTarefa` (criador = quem pediu, uma etapa `WORK` para quem aceitou, `responsibilityId` preenchido, prazo do pedido) e marca o pedido `ACCEPTED`; os outros destinatários recebem o aviso "O pedido de X já foi aceito por Y" e o pedido sai da caixa deles; quem pediu é avisado. Recusar exige motivo; o pedido segue `OPEN` para os outros; quando **todos** recusaram, vira `DECLINED` e quem pediu recebe os motivos. Responsabilidade sem dono hoje: o pedido vai para a Administração, e o aviso diz "esta responsabilidade ainda não tem dono". Nenhuma ação avisa quem a fez. Tudo no Registro; recusa e cancelamento levam o motivo.

- [ ] **Passo 1: escreva o teste que falha:**
  - `pedido a "Perucas" vai para a pessoa principal e para o substituto no período, não para VIEWER`.
  - `grupo de três: as três recebem o aviso; uma aceita; as outras duas recebem "já foi aceito por X"; a tarefa tem uma etapa para quem aceitou`.
  - `duas pessoas aceitam ao mesmo tempo (Promise.all): uma recebe 201, a outra 409 com "já foi aceito por ..."; existe exatamente uma tarefa` (foco 1).
  - `todos recusam: pedido vira DECLINED e quem pediu recebe os motivos`; `recusar sem motivo dá 400`.
  - `responsabilidade sem dono: o pedido vai para a Administração com o aviso explicando`.
  - `Elenco de fora do grupo não vê a caixa de pedidos (403 com frase); a Administração e a Direção veem`.
  - `pedir para pessoa desligada ou responsabilidade inativa dá 404 com frase`.
- [ ] **Passo 2: rode, falha. Passo 3: implemente. Passo 4: rode; esperado passa. Passo 5: commit.**

---

### Task 10: Lista fixa com repetição configurável (API e rotina)

**Arquivos:**
- Mudar: `services/task-reminders.ts` (função `voltarRotinas`), `routes/responsibilities.ts`, `services/operational-jobs.ts`
- Criar: `artifacts/api-server/tests/responsabilidade-rotinas.test.ts`; mudar `tests/run-tests.mjs`

**Interfaces — produz:**
```ts
function proximaData(regra: { kind: RepeatKind; n?: number | null; weekday?: number | null }, aPartirDe: string /* AAAA-MM-DD */): string | null;   // pura; NONE -> null
function voltarRotinas(now?: Date, organizationId?: string): Promise<{ voltaram: number }>;
```
Rotas: `GET/POST /responsibilities/:id/routines`, `PATCH /responsibilities/:id/routines/:routineId` (título, repetição), `POST .../:routineId/check` (marca como feito e agenda a próxima), `POST .../:routineId/uncheck`, `DELETE` lógico (`active=false`) com `POST .../restore`. Quem edita e marca: o dono do item, quem cuida da responsabilidade e a Administração/Direção; Elenco de fora não vê (403 com frase). Opções da primeira entrega: nunca, todo dia, toda semana (dia escolhido), todo mês, a cada N dias (1 a 365). "Depois de cada show" fica fora.

- [ ] **Passo 1: escreva os testes que falham:**
  - puros: `proximaData({kind:"DAILY"}, "2026-10-16") === "2026-10-17"`; `WEEKLY` com `weekday 1` (segunda) a partir de sexta `2026-10-16` dá `"2026-10-19"`; `EVERY_N_DAYS` com `n 3` dá `"2026-10-19"`; `MONTHLY` de `2026-01-31` dá `"2026-02-28"` (último dia do mês curto); `NONE` dá `null`; `EVERY_N_DAYS` sem `n` ou fora de 1 a 365 é inválido.
  - HTTP: `marcar item que não repete deixa marcado e sem próxima data`; `marcar item semanal agenda a próxima`; `desmarcar volta a abrir`; `no dia da próxima data o item volta a "aberto" e o dono recebe um aviso só, mesmo com o ciclo rodando 3 vezes`; `item removido não volta nem avisa e pode ser restaurado`; `marcar e remover gravam no Registro, remover com motivo`.
- [ ] **Passo 2: rode, falha. Passo 3: implemente e ligue `voltarRotinas` ao ciclo** (chave `rotina:<id>:<data>`). **Passo 4: rode; passa. Passo 5: commit.**

---

### Task 11: Tela de Responsabilidades (por dentro, pedir algo, lista fixa)

**Arquivos:**
- Criar: `artifacts/web-admin/src/components/responsabilidade-detalhe.tsx`, `pedido-novo.tsx`
- Mudar: `pages/responsibilities-tasks.tsx` e `.css`

Comportamento (mockups aprovados): ao tocar numa responsabilidade, abre o detalhe com **Pedidos novos** (Aceitar / Recusar com motivo), **Minha lista fixa** (marcar; cada item mostra a repetição; criar, editar a repetição, remover e restaurar; o texto diz quando volta), **Em andamento** (tarefas dessa responsabilidade). Botão **Pedir algo** (todos os papéis): escolhe a responsabilidade, "O que precisa", detalhes, prazo opcional; o texto explica para quem vai ("Vai para: …; se houver mais gente, vai para todas"); responsabilidade sem dono avisa que vai para a Administração. Rodapé com Cancelar e Enviar pedido em todo diálogo, Esc fecha, 375 px. Pedido aceito por outra pessoa some da caixa com a frase "Já foi aceito por X". Vazios explicados: "Nenhum pedido novo", "A lista fixa está vazia. Adicione o que você faz sempre."

- [ ] **Passo 1: implemente. Passo 2: `tsc` do site sem erro novo. Passo 3: confira na empresa de teste** com dois perfis (quem pede e quem cuida): pedir, aceitar numa conta e ver o aviso na outra, marcar um item semanal, ver o texto da repetição; tudo a **375 px**, rodapé e Esc. Tirar capturas. **Passo 4: `vite build` + `verificar-nomes-build.mjs`. Passo 5: commit.**

---

### Task 12: Documentos, regra da Direção e verificação final

**Arquivos:** `AGENTS.md`, `docs/tarefas-e-responsabilidades.md` (novo, curto), `docs/mapa-de-revisao.md`, um handoff novo em `docs/`

- [ ] **Passo 1:** no `AGENTS.md`, na linha de Perfis: Direção também **cria, vê e cobra tarefas e pedidos às responsabilidades como a Administração**; Elenco cria tarefa para qualquer pessoa. Atualize "Estado" (tarefas em etapas, pedidos, lista fixa; migrações 0072 e 0073 só no teste; ordem para promover: 0072, 0073, API, site; **quem roda em produção é quem constrói o app**).
- [ ] **Passo 2:** escreva `docs/tarefas-e-responsabilidades.md` (o modelo de etapas, as rotas antigas que agem na etapa ativa, os avisos e as chaves de deduplicação, o que ficou para depois: modelos de tarefa, repetição "depois de cada show", configurar o limite de "parada").
- [ ] **Passo 3: verificação completa**, com saída real colada no relato: `tsc` de `lib/db`, da API e do site; `node ./build.mjs`; `vite build` + `verificar-nomes-build.mjs`; a suíte inteira da API contra o banco de teste (`run-tests.mjs`, sem `TEST_FILE`); esperado: tudo passa, ou a falha é citada com a saída. Lembre que o banco de teste é lento.
- [ ] **Passo 4:** relate, separando o que foi corrigido do que depende de decisão dela, e responda ao crivo (as 16 perguntas) para as duas telas. **Passo 5: commit.**

---

## Autorrevisão

- **Cobertura do desenho:** etapas e fila/solta (Tasks 1–3), aprovação como etapa (4), opcionalidade (3 e 7: só o título é obrigatório), descrição da tarefa e da etapa (3 e 7), link do Drive aberto no app e aviso de não compartilhado (5 e 7), quem vê/cobra e Direção (3, 4 e 12), avisos (3, 4 e 6), pedidos com "basta uma aceitar" e aviso aos outros (8–9 e 11), lista fixa com repetição (8, 10 e 11), responsabilidade sem dono/substituto (9), migração das tarefas atuais com rollback (1), "ficam para depois" (12). Sem lacuna.
- **Consistência de nomes:** `criarTarefa`, `etapasAbertasDe`, `enqueueTaskReminders`, `voltarRotinas`, `lerLinkDrive` e `proximaData` aparecem com a mesma assinatura onde são usados. As chaves de deduplicação são todas minhas e distintas.
- **Um ponto que o desenho dava por certo e eu não vi no código:** a Supervisão só vê as tarefas da própria área **se tiver a responsabilidade "Aprovação de tarefas"** (regra atual de `canManageTasks`). O plano **mantém** essa regra. Se a Babi quiser que toda a Supervisão da área veja, é uma mudança à parte.
- **Push no celular:** os avisos novos entram no sino. O push do celular só vale para os tipos que já estão em `WEB_PUSH_TYPES`; incluir `task.step_ready` e `responsibility.request` nessa lista é uma decisão da Babi, não tomada aqui.
