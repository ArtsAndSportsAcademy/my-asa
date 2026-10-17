# Tarefas em etapas e responsabilidades com pedidos

Decidido e desenhado com a Babi em 16/10/2026. O desenho completo está em
`docs/superpowers/specs/2026-10-16-tarefas-em-etapas-e-responsabilidades-design.md`; o plano de construção, em
`docs/superpowers/plans/2026-10-16-tarefas-em-etapas-e-responsabilidades.md`. Este arquivo é o resumo de como ficou.

## Tarefa = lista de etapas

- **Qualquer pessoa cria tarefa para qualquer pessoa ativa**, inclusive o Elenco. Só o título é obrigatório.
- Cada etapa tem nome, **uma pessoa**, prazo próprio (opcional), descrição (opcional) e checklist (opcional). A
  **aprovação é uma etapa** (`kind = APPROVAL`) posta onde a pessoa quiser.
- **Em fila** (`SEQUENTIAL`): só a primeira etapa nasce ativa; concluir uma abre a próxima. **Solta** (`FREE`): todas as de
  trabalho nascem ativas e a aprovação espera as outras. Sem etapa pendente, a tarefa termina.
- Prazo da tarefa: nenhum, uma data, ou um período (`period_start` até `due_date`). `due_date` pode ser nulo.
- Limite de **20 etapas** por tarefa.
- As regras de quem tem a vez são funções puras em `services/task-steps-estado.ts`; a gravação, o Registro e os avisos em
  `services/task-steps.ts`. A tabela `tasks` continua com `status`, `assignee_id` e `due_date`, mantidos pelo serviço
  (`assignee_id` = a pessoa que está com a vez), porque o ASA, o Meu Dia e o Painel leem esses campos. Quem passou por uma
  aprovação termina em `APPROVED`; as outras, em `COMPLETED`.
- As rotas de antes (`/start`, `/ready-for-approval`, `/approve`, `/request-changes`) agem na **etapa que está com a vez**.
  O corpo antigo de `POST /tasks` (uma pessoa, uma data, aprovação opcional) vira a etapa "Fazer" (+ "Aprovar").
- Tarefa que nasce direto no banco, sem etapas, continua valendo pela pessoa da tarefa (Meu Dia e ASA olham as duas).

### A ASA e as etapas

A ASA ainda confirma suas propostas escrevendo na linha de `tasks` (status, pessoa, prazo, checklist). Logo depois de cada escrita,
`sincronizarEtapasDaTarefa(tx, antes, depois, ator)` (em `services/task-steps.ts`) faz as etapas acompanharem o que mudou, na mesma
transação: cancelar e concluir encerram as etapas; "pronta para aprovação" entrega a etapa de trabalho e abre a aprovação (e avisa quem
aprova); trocar a pessoa move a etapa da vez e avisa a nova; mudar o prazo acompanha as etapas que usavam o prazo antigo. Tarefa criada pela
ASA nasce com as etapas (`preencherEtapasDe`). O checklist obrigatório de tarefa antiga existe na tarefa (a ASA confere) e na primeira etapa
de trabalho (a tela marca): marcar de um lado marca do outro, pelo id do item. A ASA grava o próprio Registro (`semRegistro`).
Limite conhecido: a ASA só enxerga a "pessoa da vez" (`assignee_id`); em tarefa com várias etapas soltas ela age na etapa dessa pessoa.

### Quem faz o quê

| Ação | Quem pode |
|---|---|
| Criar tarefa | qualquer pessoa autenticada (Direção também) |
| Ver a tarefa | quem criou, quem tem etapa nela, Administração, Direção, Supervisão da própria área e local (desde 17/10/2026 não depende mais da responsabilidade "Aprovação de tarefas") |
| Concluir etapa | a pessoa da etapa; Administração e Direção concluem por ela |
| Pedir ajustes | quem aprova, Administração, Direção; o aprovador escolhe para qual etapa a tarefa volta |
| Dispensar, passar para outra pessoa, acrescentar etapa, cancelar | quem criou, Administração, Direção, Supervisão da área; **motivo escrito** vai no Registro |

### Avisos (sino)

Um por acontecimento, nunca para quem fez a ação, sempre com chave de deduplicação.

- `task.step_ready` quando chega a vez (um aviso por pessoa, mesmo com duas etapas ativas); `task.awaiting_approval` para quem aprova.
- `task.completed` para quem criou, quando a tarefa termina (menos se foi ela mesma quem terminou).
- `task.cancelled` para todas as pessoas que ainda tinham etapa por fazer.
- Lembretes do ciclo (`services/task-reminders.ts`): `task.due_soon` (um dia antes), `task.due_today`, `task.overdue`
  (pessoa e quem criou; no primeiro dia e depois a cada 3 dias) e `task.stalled` (3 dias sem ninguém mexer; só quem criou).
  Nada antes das 8h do horário local. Antes das etapas havia um agendador próprio (`taskReminderService`); saiu. A rota
  `POST /api/internal/tarefas-do-dia` continua respondendo 200 para o agendador das 8h que já existe no Supabase.

### Anexo = link do Drive

O Supabase gratuito não comporta arquivo. Só `https://drive.google.com` e `https://docs.google.com` valem
(`services/drive-link.ts`). O link abre dentro do app (visualização embutida; pasta e alguns tipos não abrem e ficam com
"Abrir no Drive"). `POST /api/tasks/check-link` e o anexo avisam "esse arquivo não está compartilhado" no melhor esforço
(sem integração com o Drive a checagem é parcial) e **deixam salvar mesmo assim**.

## Responsabilidade

- **Pedido** (`responsibility_requests`): qualquer pessoa pede algo escolhendo a responsabilidade. Vai para quem cuida
  (principal e participantes; o substituto dentro do período; nunca quem só lê). Sem ninguém cuidando, vai para a
  Administração, e o aviso diz por quê. **Basta uma pessoa aceitar**: o pedido vira uma tarefa (criada por quem pediu, com
  uma etapa para quem aceitou) e as outras são avisadas. Recusar pede motivo; quando todas recusam, quem pediu recebe os
  motivos. Cancelar (quem pediu) pede motivo e avisa quem recebeu.
- **Lista fixa** (`responsibility_routines`): o que quem cuida faz sempre. Cada item repete como o dono escolher: nunca,
  todo dia, toda semana (dia escolhido), todo mês ou a cada N dias (1 a 365). Marcar agenda a próxima vez; no dia ela volta
  a ficar aberta e o dono recebe um aviso (`responsibility.routine_back`). Remover é lógico, com motivo, e dá para restaurar.
  "Depois de cada show" ficou para depois: depende da escala.

## Migrações (só no banco de teste até a Babi dizer)

- `0072_tarefas_em_etapas` — `task_steps`, `tasks.ordering/period_start/last_activity_at`, `due_date` aceita nulo,
  `task_evidences.step_id`; as tarefas que já existiam ganham "Fazer" (+ "Aprovar").
- `0073_pedidos_e_rotinas` — pedidos, quem os recebeu e a lista fixa.
- Rollbacks em `lib/db/drizzle/rollback/`. O de `0072` falha de propósito se houver tarefa sem prazo (dê um prazo antes).
- **Ordem para promover:** 0072, 0073, depois a API, depois o site. Quem roda em produção é quem constrói o app.

## Fica para depois

Modelos de tarefa ("Coreografia de hotel"), repetição "depois de cada show", configurar os 3 dias de "parada" e o push no
celular dos avisos novos (hoje só entram no sino).
