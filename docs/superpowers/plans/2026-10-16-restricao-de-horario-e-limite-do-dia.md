# Restrição de horário, limite de shows por dia e rodízio do Teatro de Natal — plano de construção

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Uma sessão de show pode ser "separada" (Livro do Dia próprio, com as próprias pessoas), e o motor que gera o Livro do Dia passa a respeitar (1) restrição de horário por pessoa, (2) limite de shows por pessoa por dia, configurável por local, e (3) a preferência de evitar a mesma pessoa em shows do dia colados um no outro; quem gerencia passa de qualquer uma das três à mão, com motivo escrito.

**Architecture:** Duas tabelas novas (`restricoes_horario`, `escala_regras_local`). O motor (`resolveShowBookCast`, em `services/line-resolver.ts`) ganha um mapa de **bloqueios** (restrição, limite) que se soma a `unavailable`, e uma chave de **evitar** (shows colados) que entra na fila de `balance` antes da carga. A exceção é a própria mexida à mão (`manual=true`), exigindo motivo, igual a "chamar na folga" hoje (`PESSOA_DE_FOLGA`).

**Tech Stack:** Express + Drizzle (Postgres/Supabase), React + Vite. Testes de chamada direta em `artifacts/api-server/tests` contra o banco de teste.

**Spec:** `docs/superpowers/specs/2026-10-16-restricao-de-horario-e-limite-do-dia-design.md`

## Decisão já tomada com a Babi: "sessão separada" (Tasks 2A, 2B e 7A)

Hoje há **um Livro do Dia por show por dia**: `gerarDiaDoLocal` repete o show uma vez só, `generateDailyBookDraftForScale` acha o evento por (show, data) com `.limit(1)`, o evento nasce **sem horário**, e as sessões (`sessions`) só marcam hora ("a formação vale para o dia inteiro"). A Babi decidiu (16/10/2026): **um show só** (Teatro de Natal) e, ao adicionar uma sessão, o app **pergunta se ela é "separada"**. Sessão separada vira **um Livro do Dia próprio** (com a hora no nome), compartilhando os personagens e a fila do rodízio do show; não separada segue como hoje. Com isso "uma sessão por dia" sai da carga do dia que já existe.

**De onde vem a hora de um Livro** (as regras de horário precisam dela, e o evento da agenda hoje não a guarda): Livro de sessão separada usa a hora da sessão; os demais usam a hora do bloco da Programação do dia para aquele show (`programacao_blocos.inicio`/`fim`, o menor `inicio` se o show aparece em mais de um bloco); sem nenhuma das duas, **sem hora** (a restrição de horário não se aplica e a tela diz "sem horário, restrição não conferida").

## Global Constraints

- Tudo em **português do Brasil**: comentários, mensagens de commit (prosa longa: o que estava errado e por que a mudança resolve), textos da interface (explicam a regra, não o botão).
- **Migração só no banco de teste.** Cada migração tem rollback em `lib/db/drizzle/rollback/<mesmo nome>.down.sql` e entrada no `lib/db/drizzle/meta/_journal.json`. Quem roda em produção é quem constrói o app. Ordem de promoção: migração 0071, depois a API, depois o site.
- **Nunca** escrever senha, token ou `.env*` no repositório. Nada de apagar dado real: remoção é lógica (`status`, `active`).
- Toda escrita grava `writeHistoryEvent` **na mesma transação**; exceções levam o motivo escrito.
- Perfis: Administração cadastra restrição, define limite e libera exceção; Supervisão cadastra restrição e libera exceção só para pessoa da **própria área** (recusa com frase clara); Direção só lê; Elenco só vê a própria restrição.
- Aviso no sino: **um por acontecimento**, nunca um por clique.
- Telas: conferir a **375 px**; todo formulário e janela tem rodapé com confirmar e cancelar sempre à vista, e Esc fecha.
- Nomes de pessoas em dados de exemplo só dentro de `import.meta.env.DEV`; depois rodar `node scripts/verificar-nomes-build.mjs` em `artifacts/web-admin`.
- Comandos desta máquina (PowerShell): ver `AGENTS.md`. Tipos: `node ../../node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/bin/tsc -p tsconfig.json --noEmit`. Depois de mexer no schema, compilar `lib/db` antes de checar a API. Banco de teste é lento (5 a 12 s por escrita): esperar antes de concluir que travou.
- Não commitar nem dar push sem o "pode" da Babi; **não** mexer em produção.

## Review Focus

Entradas que o spec implica e que nenhum teste de tarefa cobriria por conta própria (cada uma ganha o teste na tarefa dona):

1. **Livro sem horário** (nem sessão separada nem bloco da Programação): a restrição de horário não pode derrubar a geração nem escalar às cegas; deve ignorar a regra e anotar "sem horário, restrição não conferida". (Task 3)
6. **Sessão marcada "separada" com Livro já gerado e publicado**: não pode apagar nem duplicar o Livro do dia; a tela explica e nada muda sozinho. Gerar de novo não cria um segundo Livro da mesma sessão. (Task 2A)
7. **Dois blocos da Programação do mesmo show (11:30 e 15:30) com sessão não separada**: continuam apontando para o mesmo Livro do dia, como hoje; só a sessão separada escolhe o Livro pelo horário. (Task 2B)
2. **Restrição encerrada no meio do mês** com Livro vivo: depois de encerrada a pessoa volta a ser opção sem regenerar; a exceção já dada (`manual=true`) não muda. (Task 3)
3. **Vaga de personagem em modo titular** cujo titular está bloqueado por restrição ou limite: cai para o próximo da fila, com a nota explicando o motivo, nunca fica "descoberta" se houver outro. (Task 3)
4. **Limite configurado em 0 ou sem valor**: vazio/nulo significa "sem limite" (nunca "ninguém pode"); 0 é recusado na gravação. (Task 6)
5. **Domingo** (`getUTCDay() = 0`) e fuso: o dia da semana e a hora vêm da data operacional e do `start_time` do show, sem conversão de fuso. (Task 2)

## Estrutura de arquivos

| Arquivo | O que faz |
|---|---|
| `lib/db/src/schema/restricao-horario.ts` (novo) | tabelas `restricoesHorarioTable`, `escalaRegrasLocalTable` e tipos |
| `lib/db/drizzle/0071_restricao_horario_e_limite_do_dia.sql` + `rollback/…down.sql` (novos) | migração e desfazer |
| `artifacts/api-server/src/services/regras-de-escala.ts` (novo) | regras puras e leitura do que o motor precisa |
| `artifacts/api-server/src/services/line-resolver.ts` | motor: bloqueios e "evitar" |
| `artifacts/api-server/src/routes/daily-book.ts`, `routes/escalas.ts` | gerar Livro por sessão separada; passar `eventId` ao motor; exigir motivo na exceção |
| `artifacts/api-server/src/services/escala-mes.ts`, `services/escala-dia.ts`, `routes/entities.ts` | gerar o dia por sessão separada; ligar bloco ao Livro pela hora; campo `separada` na sessão |
| `artifacts/api-server/src/routes/restricoes-horario.ts`, `routes/escala-regras.ts` (novos) | HTTP |
| `artifacts/web-admin/src/pages/restricoes-horario.tsx` (+ `.css`) (novo) | cadastro e lista |
| `artifacts/web-admin/src/pages/escalas.tsx` | regras do local e diálogo de exceção |
| `artifacts/api-server/tests/restricao-horario.test.ts` (novo) | testes das Tasks 2 a 6 e cenário do Natal |

---

### Task 1: Tabelas e migração 0071

**Files:**
- Create: `lib/db/src/schema/restricao-horario.ts`, `lib/db/drizzle/0071_restricao_horario_e_limite_do_dia.sql`, `lib/db/drizzle/rollback/0071_restricao_horario_e_limite_do_dia.down.sql`
- Modify: `lib/db/src/schema/index.ts` (exportar o arquivo novo), `lib/db/drizzle/meta/_journal.json`

**Interfaces:**
- Produces:
  - `restricoesHorarioTable`: `id uuid`, `userId uuid → users`, `diasSemana integer[]` (0 = domingo … 6 = sábado; não vazio), `horaInicio time`, `horaFim time` (janela em que a pessoa **pode** trabalhar), `periodStart date`, `periodEnd date` (null = sem fim), `motivo text` (obrigatório), `status text` (`ACTIVE` | `ENDED`), `createdBy uuid`, `createdAt`, `endedBy uuid|null`, `endedAt|null`.
  - `escalaRegrasLocalTable`: `locationId uuid` (chave), `limiteShowsDia integer|null` (null = sem limite; CHECK entre 1 e 20), `intervaloMinimoMinutos integer` (padrão 20; CHECK entre 0 e 240), `updatedBy`, `updatedAt`.
  - `sessions.separada boolean NOT NULL DEFAULT false` (em `lib/db/src/schema/block2.ts`) e `daily_books.session_id uuid NULL REFERENCES sessions(id)` (em `lib/db/src/schema/daily-book.ts`: `sessionId`), com índice único parcial `daily_books_session_dia_uq` em `(agenda_event_id, session_id) WHERE session_id IS NOT NULL AND status <> 'CANCELLED'`.

- [ ] **Step 1: Escrever** a migração com `CREATE TABLE`, `ENABLE ROW LEVEL SECURITY` e `REVOKE ALL … FROM anon, authenticated, PUBLIC` (igual a `0069_folga_config.sql`), mais índice `restricoes_horario_user_ativa_idx` em `(user_id) WHERE status = 'ACTIVE'`, e os dois `ALTER TABLE … ADD COLUMN` aditivos (`sessions.separada`, `daily_books.session_id`) com o índice único parcial.
- [ ] **Step 2: Escrever** o rollback (`DROP INDEX`, `ALTER TABLE … DROP COLUMN` das duas colunas e `DROP TABLE IF EXISTS` das duas tabelas, com comentário em português do que se perde: as sessões voltam a "não separada" e os Livros de sessão separada perdem o vínculo com a sessão) e registrar `{"idx":71,"version":"7","when":1792375200000,"tag":"0071_restricao_horario_e_limite_do_dia","breakpoints":true}` no `_journal.json`.
- [ ] **Step 3: Escrever** o schema Drizzle espelhando a migração e exportá-lo.
- [ ] **Step 4: Aplicar no banco de TESTE** e compilar `lib/db`:
  Run (em `lib/db`): `node --env-file=../../.env.test ../../node_modules/.pnpm/tsx@<versão>/node_modules/tsx/dist/cli.mjs src/migrate.ts` e `node ../../node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/bin/tsc -p tsconfig.json`
  Expected: migração aplicada sem erro; `tsc` sem saída.
- [ ] **Step 5: Commit** (mensagem em prosa: o que não existia e por que as duas tabelas).

---

### Task 2A: Gerar um Livro do Dia por sessão separada

**Files:**
- Modify: `artifacts/api-server/src/routes/daily-book.ts` (`generateDailyBookDraftForScale`), `artifacts/api-server/src/services/escala-mes.ts` (`gerarDiaDoLocal`), `artifacts/api-server/src/routes/entities.ts` (POST/PATCH `/show-books/:showId/sessions`, GET devolve `separada`)
- Test: `artifacts/api-server/tests/restricao-horario.test.ts` (seção "sessão separada")

**Interfaces:**
- Consumes: Task 1 (`sessions.separada`, `daily_books.session_id`).
- Produces:
  - `generateDailyBookDraftForScale` aceita `sessionId?: string | null`. Com `sessionId`, o evento da agenda é achado ou criado por **(show, data, hora de início da sessão)**, nasce com `startTime` e `endTime` da sessão e título `"<show> · HH:MM"`, o Livro grava `sessionId`, e "já existe Livro" passa a comparar também `sessionId`. Sem `sessionId`, comportamento idêntico ao de hoje (evento por show e data, `sessionId` nulo).
  - `gerarDiaDoLocal` gera, para cada show da Programação do dia: **um Livro por sessão separada** que roda na data (`eligibleSessions` com `separada = true`), mais **o Livro do dia (`sessionId` nulo)** quando o show tem alguma sessão não separada que roda na data ou nenhuma sessão. Ordem de geração: por hora de início, para a sessão das 11:30 existir antes da das 15:30 (a carga do dia só enxerga Livros já gravados).
  - `POST /show-books/:showId/sessions` e `PATCH …/:sessionId` aceitam `separada: boolean` (padrão `false`); o `GET` devolve o campo. Mudar `separada` de uma sessão que já tem Livro com pessoas ou publicado responde `409 { error: "SESSAO_COM_LIVRO", message }` com a frase "Esta sessão já tem Livro do Dia com pessoas. Cancele o Livro antes de mudar se ela é separada." (Review Focus 6); Livro em rascunho sem ajuste à mão é cancelado de forma lógica e o Registro grava.

- [ ] **Step 1: Escrever os testes que falham**: show com duas sessões (11:30 e 15:30), ambas `separada: true`, na Programação do dia → gerar o dia cria **dois** Livros, com títulos "… · 11:30" e "… · 15:30", eventos com `start_time` e `end_time` das sessões e `session_id` preenchido; gerar de novo **não** cria um terceiro (idempotente); sessão `separada: false` → um só Livro, igual a hoje (`sondagem-mes-rodizio.test.ts` e `daily-book-session-blocks.test.ts` continuam passando); show com uma separada e uma não separada → um Livro por separada mais o do dia; mudar `separada` com Livro publicado → `409 SESSAO_COM_LIVRO`; Review Focus 6.
- [ ] **Step 2: Rodar e ver falhar.** Run (em `artifacts/api-server`): `$env:MYASA_TEST_RUNNER="1"; $env:TEST_FILE="restricao-horario.test.ts"; node --env-file=../../.env.test ./tests/run-tests.mjs`. Expected: FAIL.
- [ ] **Step 3: Implementar** as mudanças acima. O Livro de sessão separada **não** recebe o bloco "Sessão HH:MM" de `session-blocks.ts` (a sessão já é o Livro); nos demais, o comportamento de hoje.
- [ ] **Step 4: Rodar os testes novos e os que protegem a geração**: `restricao-horario`, `daily-book-session-blocks`, `daily-book-fill`, `daily-book-vivo`, `escalas-dia`, `sondagem-mes-rodizio`. Expected: PASS.
- [ ] **Step 5: Commit.**

---

### Task 2B: Escala do dia e Livro do Dia mostram a sessão separada

**Files:**
- Modify: `artifacts/api-server/src/services/escala-dia.ts` (`montarEscalaDoDia`, ligação bloco → Livro), `artifacts/api-server/src/routes/daily-book.ts` (cabeçalho com `showTitle`, linhas ~109-136)
- Test: `artifacts/api-server/tests/restricao-horario.test.ts` (seção "Escala com sessão separada")

**Interfaces:**
- Consumes: Task 2A.
- Produces: `montarEscalaDoDia` liga um bloco da Programação com `regra = 'livro'` ao Livro **da sessão cujo início é o `inicio` do bloco** quando o show tem sessão separada naquela data; senão, ao Livro do dia, como hoje (Review Focus 7). O cabeçalho do Livro devolve `sessionLabel: string | null` (ex.: "11:30") e o título passa a "Teatro de Natal · 11:30". O Livro de sessão separada sem bloco na Programação continua convocando (caminho "Show com Livro do Dia no local e sem bloco no molde").

- [ ] **Step 1: Escrever os testes que falham**: Programação com dois blocos do mesmo show (11:30 e 15:30), sessões separadas → cada bloco da Escala aponta para o seu Livro e mostra as pessoas dele; sem sessão separada → os dois blocos apontam para o mesmo Livro (como hoje); a lista de Livros do dia distingue os dois pelo horário no nome (pergunta 12 do crivo).
- [ ] **Step 2: Rodar e ver falhar.** Expected: FAIL.
- [ ] **Step 3: Implementar** a ligação por início da sessão e o `sessionLabel` no cabeçalho do Livro.
- [ ] **Step 4: Rodar** `restricao-horario`, `escalas-dia`, `fase-c-meu-dia`, `daily-book-vivo`. Expected: PASS.
- [ ] **Step 5: Commit.**

---

### Task 2: Regras puras

**Files:**
- Create: `artifacts/api-server/src/services/regras-de-escala.ts`, `artifacts/api-server/tests/restricao-horario.test.ts` (seção "regras puras")

**Interfaces:**
- Produces (todas puras, sem banco):
  - `type RestricaoDeHorario = { userId: string; diasSemana: number[]; horaInicio: string; horaFim: string; periodStart: string; periodEnd: string | null; motivo: string }`
  - `restricaoImpede(restricoes: RestricaoDeHorario[], userId: string, date: string, startTime: string | null): RestricaoDeHorario | null` — devolve a restrição que impede, ou `null`. Dia da semana por `new Date(`${date}T00:00:00Z`).getUTCDay()`; `startTime` é `"HH:MM"` ou `"HH:MM:SS"`; impede quando o dia está em `diasSemana`, a data está no período e `startTime` está **fora** de `[horaInicio, horaFim]`. `startTime` nulo devolve `null` (Review Focus 1).
  - `showsColados(a: { start: string; end: string | null }, b: { start: string; end: string | null }, intervaloMinimoMinutos: number): boolean` — verdadeiro quando o intervalo entre o fim de um e o início do outro é menor que o mínimo, ou os dois se sobrepõem. Show sem `end` conta como 30 minutos.
  - `chaveDeEvitar(userId: string, ctx: { colados: ReadonlySet<string> }): number` — `1` se a pessoa está em `colados`, senão `0`.

- [ ] **Step 1: Escrever os testes que falham**, com os valores do spec:
  - `restricaoImpede` com Sofia (`diasSemana: [1,2,3,4,5]`, `horaInicio: "15:00"`, `horaFim: "23:59"`): segunda 2026-10-26 às `11:30` → impede; às `15:30` → `null`; sábado 2026-10-24 às `11:30` → `null`; domingo 2026-10-25 às `11:30` → `null`; `startTime: null` → `null`; data fora do período → `null`.
  - `showsColados({start:"15:15",end:"15:20"},{start:"15:30",end:"16:00"}, 20)` → `true`; com intervalo `10` → `false`; `{start:"11:30",end:"12:00"}` e `{start:"15:30",end:"16:00"}` com 20 → `false`.
- [ ] **Step 2: Rodar e ver falhar**
  Run (em `artifacts/api-server`): `$env:MYASA_TEST_RUNNER="1"; $env:TEST_FILE="restricao-horario.test.ts"; node --env-file=../../.env.test ./tests/run-tests.mjs`
  Expected: FAIL (módulo inexistente).
- [ ] **Step 3: Implementar** as três funções acima em `regras-de-escala.ts`.
- [ ] **Step 4: Rodar e ver passar** (mesmo comando). Expected: PASS.
- [ ] **Step 5: Commit.**

---

### Task 3: Motor do Livro do Dia respeita as regras

**Files:**
- Modify: `artifacts/api-server/src/services/line-resolver.ts` (`resolveShowBookCast`, `resolveAssignmentsByRole`, `resolveLine`, `workloadBalance`); `artifacts/api-server/src/routes/daily-book.ts` (os cinco chamadores: linhas ~645, ~832, ~1030, ~1210, ~1909)
- Modify: `artifacts/api-server/src/services/regras-de-escala.ts` (acrescentar `carregarRegrasDoDia`)
- Test: `artifacts/api-server/tests/restricao-horario.test.ts` (seção "motor")

**Interfaces:**
- Consumes: Task 1 (tabelas), Task 2 (`restricaoImpede`, `showsColados`), Task 2A (Livros de sessão separada, com horário).
- Produces:
  - `opts.eventId?: string` em `resolveShowBookCast` e `resolveAssignmentsByRole` (o evento da agenda do Livro; dele vêm `locationId` e, para Livro de sessão separada, `startTime` e `endTime`). Os cinco chamadores passam `eventId`.
  - `horarioDoLivro(book: { id: string; agendaEventId: string; showBookId: string | null; sessionId: string | null }, date: string): Promise<{ start: string; end: string | null } | null>` em `regras-de-escala.ts`: horário do evento quando existe; senão o da sessão (`sessionId`); senão o menor `inicio` (e o `fim`) do bloco da Programação do dia para aquele show; senão `null`.
  - `carregarRegrasDoDia(input: { eventId: string; userIds: string[]; date: string; operationId: string }): Promise<{ bloqueios: Map<string, string>; colados: Set<string>; semHorario: boolean }>` — `bloqueios` mapeia `userId → frase` ("restrição de horário: só a partir das 15:00 (escola)" ou "já está em 3 shows hoje (limite do local)"); `colados` = quem tem outro show do dia a menos que o intervalo mínimo deste.
  - `resolveLine` ganha o parâmetro final `bloqueios: ReadonlyMap<string, string> = new Map()`; `blocked(id)` passa a ser `unavailable.has(id) || excluded.has(id) || bloqueios.has(id)` e `blockReason(id)` devolve a frase do mapa quando for o caso.
  - `BalanceKey` ganha, logo depois do supervisor e antes da carga, a chave de evitar: `[supervisor, evitar, dia, semana, mês]`.

- [ ] **Step 1: Escrever os testes que falham** (cenário completo contra o banco de teste, via funções do motor; montar organização, operação, local, **um show "Teatro de Natal" com duas sessões separadas (11:30 e 15:30)**, personagens Jingle e Bell em rodízio e elenco Sofia, Esther, Daia, Kauã, Julia, Bel, e a Montanha com bloco da Programação às 15:15):
  - Sofia com restrição (segunda a sexta, a partir das 15:00): gerar segunda → Sofia **nunca** em 11:30 e aparece só às 15:30; `note` da vaga que a pularia contém "restrição de horário".
  - No sábado a mesma Sofia **pode** cair às 11:30.
  - Limite do local `3`: pessoa com 3 Livros no dia aparece em `bloqueios` ("limite") e não é escolhida para o quarto; local sem linha em `escala_regras_local` → sem limite.
  - Show das 15:30 gerado depois do das 11:30: quem fez 11:30 só repete se não houver mais ninguém (com 4 pessoas livres, as quatro vagas do dia saem com **4 pessoas diferentes**).
  - Show colado (Montanha 15:15–15:20 e Teatro 15:30, intervalo 20): quem está na Montanha fica por último na fila do Teatro, mas é escolhido se for o único.
  - Review Focus 1: evento sem `start_time` → restrição ignorada, geração termina, `semHorario` verdadeiro.
  - Review Focus 2: encerrar a restrição (`status = 'ENDED'`) → a próxima leitura do Livro vivo já a considera livre; vaga com `manual=true` não muda.
  - Review Focus 3: personagem em modo `titular` com o titular bloqueado → usa o próximo e a nota explica o motivo.
- [ ] **Step 2: Rodar e ver falhar** (mesmo comando da Task 2, `TEST_FILE="restricao-horario.test.ts"`). Expected: FAIL.
- [ ] **Step 3: Implementar `horarioDoLivro` e `carregarRegrasDoDia`** com as consultas de `restricoes_horario` (status `ACTIVE`, período cobre a data, `userId in ids`), `escala_regras_local` do local do evento e dos Livros do mesmo dia na mesma operação (não cancelados, designações vivas), cada um com o horário de `horarioDoLivro`; contar cada Livro como 1 show, **excluindo o próprio Livro** (pelo `eventId` e `sessionId`, não só pelo show: duas sessões separadas do mesmo show têm de se enxergar).
  - `workloadBalance` hoje exclui "o mesmo show na mesma data" (`not (b.show_book_id = … and e.date = …)`); trocar essa exclusão por "o próprio Livro" (`b.id <> <livro atual>`), senão a sessão das 15:30 não enxerga quem fez a das 11:30.
- [ ] **Step 4: Ligar ao motor**: `resolveShowBookCast` chama `carregarRegrasDoDia` quando recebe `opts.eventId`, soma `bloqueios` ao que `resolveLine` bloqueia e monta a chave de evitar a partir de `colados`. Sem `eventId` o comportamento é exatamente o de hoje (nenhum teste existente muda).
- [ ] **Step 5: Atualizar os cinco chamadores** em `daily-book.ts` para passar `eventId` (nos três de geração e no vivo é o `event.id`; em `buildPatternDiffRows` é `book.agendaEventId`).
- [ ] **Step 6: Rodar os testes novos e os que protegem o motor**
  Run: `TEST_FILE` = `restricao-horario.test.ts`, depois `daily-book-vivo.test.ts`, `escalas-dia.test.ts`, `sondagem-mes-rodizio.test.ts`, `personagens-por-show.test.ts`.
  Expected: todos PASS (nenhum dos antigos muda de resultado).
- [ ] **Step 7: Commit.**

---

### Task 4: Exceção à mão com motivo e aviso

**Files:**
- Modify: `artifacts/api-server/src/routes/escalas.ts` (`ajustarUmaPessoa`), `artifacts/api-server/src/routes/daily-book.ts` (PATCH `/daily-book/:id/assignments/:assignmentId`), `artifacts/api-server/src/services/regras-de-escala.ts`
- Test: `artifacts/api-server/tests/restricao-horario.test.ts` (seção "exceção")

**Interfaces:**
- Consumes: Task 3 (`carregarRegrasDoDia`).
- Produces: `verificarRegrasDeEscala(input: { eventId: string; userId: string; date: string; operationId: string }): Promise<{ regra: "RESTRICAO_HORARIO" | "LIMITE_DO_DIA"; frase: string }[]>` — lista vazia quando nada impede. Respostas HTTP novas: `409 { error: "PESSOA_COM_RESTRICAO_DE_HORARIO" | "ACIMA_DO_LIMITE_DO_DIA", message, pessoa }` quando falta motivo (`motivo` com menos de 3 caracteres).

- [ ] **Step 1: Escrever os testes que falham**:
  - Administração e Supervisão **da área da pessoa** adicionam Sofia às 11:30 de uma segunda sem motivo → `409 PESSOA_COM_RESTRICAO_DE_HORARIO` com a frase "Sofia: só a partir das 15:00 (escola). Para escalar mesmo assim, escreva o motivo."; com `motivo: "sem aula hoje"` → 200, vaga `manual=true`, Registro `escala.pessoa_adicionada` com `metadata.regras = ["RESTRICAO_HORARIO"]` e o motivo.
  - Supervisão de **outra** área → `403` com a frase "Supervisão ajusta somente pessoas da própria área" (já existe; garantir que vale antes da regra).
  - Quarta pessoa acima do limite 3 por "última hora": com motivo passa, e a **Administração recebe um aviso** (`notification_outbox`, tipo `escala.excecao_de_regra`, uma por acontecimento com `deduplicationKey` `excecao:${scaleId}:${userId}:${regra}`); sem motivo → `409 ACIMA_DO_LIMITE_DO_DIA`.
  - Direção e Elenco recebem `403`.
- [ ] **Step 2: Rodar e ver falhar.** Expected: FAIL.
- [ ] **Step 3: Implementar `verificarRegrasDeEscala`** usando `carregarRegrasDoDia` para um só `userId`.
- [ ] **Step 4: Ligar em `ajustarUmaPessoa`** (junto do bloco `deFolga`, só para `ADICIONAR` em bloco com `dailyBookId`) e no PATCH de `assignments` (novo campo opcional `motivo` no corpo; exigido só quando a regra acusa); gravar `regras` e `motivo` no `writeHistoryEvent` da mesma transação e enfileirar o aviso à Administração com `enqueueNotification`, no mesmo padrão de `escala.chamada_na_folga`.
- [ ] **Step 5: Rodar os testes novos e `escalas-dia.test.ts`, `permission-matrix.test.ts`.** Expected: PASS.
- [ ] **Step 6: Commit.**

---

### Task 5: Cadastro de restrição de horário (HTTP)

**Files:**
- Create: `artifacts/api-server/src/routes/restricoes-horario.ts`
- Modify: `artifacts/api-server/src/routes/index.ts` (registrar)
- Test: `artifacts/api-server/tests/restricao-horario.test.ts` (seção "cadastro")

**Interfaces:**
- Produces:
  - `GET /restricoes-horario?userId=` → `{ restricoes: [...], podeEditar: boolean }`. Administração e Direção veem todas; Supervisão vê as da sua área; Elenco vê só as próprias.
  - `POST /restricoes-horario` corpo `{ userIds: string[], diasSemana: number[], horaInicio: string, horaFim: string, periodStart: string, periodEnd?: string | null, motivo: string }` → `201 { restricoes }` (uma por pessoa, tudo na mesma transação). Recusas com frase: Supervisão com pessoa de outra área (`403`, "Você só cadastra restrição de pessoas da sua área."); `motivo` vazio; `horaFim <= horaInicio`; `diasSemana` vazio ou fora de 0 a 6.
  - `POST /restricoes-horario/:id/encerrar` corpo `{ motivo }` → `ENDED`, nunca apaga.

- [ ] **Step 1: Escrever os testes que falham**, incluindo cadastro de **três pessoas de uma vez** (pergunta 1 do crivo), recusa de outra área, encerrar e restaurar (`POST …/:id/reabrir` volta a `ACTIVE`, pergunta 7), e o **aviso no sino**: um por acontecimento à Administração e à Supervisão da pessoa, e à própria pessoa (para ela ver a restrição na Minha escala).
- [ ] **Step 2: Rodar e ver falhar.** Expected: FAIL.
- [ ] **Step 3: Implementar** as rotas seguindo `routes/restrictions.ts` e `routes/folga-config.ts`: `requireAuth`, `requireOrganization`, `writeHistoryEvent` na mesma transação (`category: "RESTRICTION"`, `action: "restricao_horario.criada" | "encerrada" | "reaberta"`), checagem de área com `canSupervisorAccessPerson` de `services/area-local-scope.ts`.
- [ ] **Step 4: Rodar os testes novos.** Expected: PASS.
- [ ] **Step 5: Commit.**

---

### Task 6: Regras do local (limite e intervalo)

**Files:**
- Create: `artifacts/api-server/src/routes/escala-regras.ts`
- Modify: `artifacts/api-server/src/routes/index.ts`
- Test: `artifacts/api-server/tests/restricao-horario.test.ts` (seção "regras do local")

**Interfaces:**
- Produces: `GET /escala-regras?locationId=` → `{ limiteShowsDia: number | null, intervaloMinimoMinutos: number, podeEditar: boolean }` (local sem linha devolve `null` e `20`); `PUT /escala-regras` corpo `{ locationId, limiteShowsDia?: number | null, intervaloMinimoMinutos?: number }`, só Administração.

- [ ] **Step 1: Escrever os testes que falham**: Snowland recebe `3`; `0` e `21` são recusados com frase ("O limite é de 1 a 20 shows por dia; deixe em branco para não ter limite"); `null` remove o limite; Supervisão e Direção leem mas recebem `403` ao gravar; Registro com antes e depois (Review Focus 4).
- [ ] **Step 2: Rodar e ver falhar.** Expected: FAIL.
- [ ] **Step 3: Implementar** no estilo de `routes/folga-config.ts` (`UPSERT` por `locationId`, `writeHistoryEvent` na mesma transação).
- [ ] **Step 4: Rodar os testes novos.** Expected: PASS.
- [ ] **Step 5: Commit.**

---

### Task 7: Tela de restrições de horário

**Files:**
- Create: `artifacts/web-admin/src/pages/restricoes-horario.tsx`, `artifacts/web-admin/src/pages/restricoes-horario.css`
- Modify: o roteador e o menu onde `folgas` e `escalas` são registrados (procurar `path="/folgas"` em `artifacts/web-admin/src`); `artifacts/web-admin/src/pages/meu-dia.tsx` (linha curta com a própria restrição)

**Interfaces:**
- Consumes: Task 5 (HTTP).

- [ ] **Step 1: Escrever a tela**: lista com pessoa, dias, horário, período e motivo (pergunta 12 do crivo); botão "Nova restrição" abre a janela com **várias pessoas** (busca e seleção múltipla), dias da semana, "pode trabalhar das … às …", período e motivo; **rodapé fixo** com Salvar e Cancelar visível a 375 px e Esc que fecha (perguntas 15 e 16); estado vazio dizendo "Nenhuma restrição de horário cadastrada" (pergunta 10); botões "Encerrar" (com motivo) e "Reabrir" (pergunta 7); mensagem de recusa vinda da API mostrada tal e qual (pergunta 8).
- [ ] **Step 2: Em `meu-dia.tsx`**, mostrar para a própria pessoa "Você tem uma restrição de horário: só pode trabalhar das 15:00 às 23:59 de segunda a sexta (escola)".
- [ ] **Step 3: Conferir no navegador** com `?amostra=1` e perfil trocado em `sessionStorage["myasa-review-role"]` (`adm`, `sup`, `dir`, `mem`) e **a 375 px**: abrir, cadastrar para três pessoas, encerrar, reabrir, fechar com Esc; conferir o console sem erros.
- [ ] **Step 4: Tipos e build**: `tsc -p tsconfig.json --noEmit` em `artifacts/web-admin`, build do site (comando em `AGENTS.md`) e `node scripts/verificar-nomes-build.mjs`. Expected: sem erros; nenhum nome de elenco no pacote.
- [ ] **Step 5: Commit.**

---

### Task 7A: Pergunta "sessão separada?" ao adicionar sessão

**Files:**
- Modify: `artifacts/web-admin/src/pages/shows.tsx` (janela de sessão), `artifacts/web-admin/src/pages/livro-do-dia.tsx` (título com a hora)

**Interfaces:**
- Consumes: Task 2A (`separada` em `POST/PATCH /show-books/:showId/sessions`), Task 2B (`sessionLabel`).

- [ ] **Step 1: Na janela de adicionar/editar sessão**, incluir a escolha "Esta sessão tem as próprias vagas e as próprias pessoas?" com **Sim, separada** e **Não, mesmo Livro do dia**, e a frase que explica a regra: "Separada: o Livro do Dia dela é só dela, com a hora no nome, e o rodízio escolhe as pessoas de cada sessão. Não separada: a mesma formação vale para o dia inteiro." Padrão: **Não**. Rodapé com Salvar e Cancelar sempre à vista, Esc fecha, conferido a 375 px.
- [ ] **Step 2: Ao mudar a escolha de uma sessão que já tem Livro**, mostrar a frase do `409 SESSAO_COM_LIVRO` tal e qual, sem perder o que a pessoa digitou.
- [ ] **Step 3: Na lista e no cabeçalho do Livro do Dia**, mostrar "Teatro de Natal · 11:30" usando `sessionLabel`, para as duas linhas do dia serem diferentes à primeira vista.
- [ ] **Step 4: Conferir no navegador** (`?amostra=1`, perfis `adm` e `sup`, 375 px): adicionar sessão separada e não separada, mudar a escolha, fechar com Esc; tipos, build e `node scripts/verificar-nomes-build.mjs`. Expected: tudo verde.
- [ ] **Step 5: Commit.**

---

### Task 8: Regras do local e diálogo de exceção na Escala

**Files:**
- Modify: `artifacts/web-admin/src/pages/escalas.tsx` (e `escalas.css`)

**Interfaces:**
- Consumes: Task 6 (`/escala-regras`) e Task 4 (os dois `409`).

- [ ] **Step 1: "Regras do local"** na Escala (só a Administração edita, os outros leem): campo "Máximo de shows por pessoa no dia" (vazio = sem limite; o texto diz "sem limite" quando vazio) e "Intervalo mínimo entre shows, em minutos"; rodapé com Salvar e Cancelar.
- [ ] **Step 2: Diálogo de exceção**: ao receber `PESSOA_COM_RESTRICAO_DE_HORARIO` ou `ACIMA_DO_LIMITE_DO_DIA`, abrir a mesma janela que já existe para `PESSOA_DE_FOLGA`, com a frase da API e o campo "Motivo" obrigatório; rodapé "Escalar mesmo assim" e "Cancelar"; Esc fecha.
- [ ] **Step 3: Mostrar na vaga** o porquê quando o motor pulou alguém ("Sofia não entra às 11:30: restrição de horário, escola"), usando a `note` que o motor já devolve.
- [ ] **Step 4: Conferir no navegador** a 375 px, com tipos, build e `verificar-nomes-build.mjs` como na Task 7. Expected: tudo verde.
- [ ] **Step 5: Commit.**

---

### Task 9: Cenário do Natal e documentação

**Files:**
- Modify: `artifacts/api-server/tests/restricao-horario.test.ts` (seção "Natal 22 a 31/10")
- Modify: `AGENTS.md` (seção Estado e a lista do crivo, só se uma pergunta nova pegar defeito); criar `docs/handoff-restricao-de-horario.md`

- [ ] **Step 1: Escrever o teste de aceitação** com as folgas **reais** de 22 a 31/10 (Bel 23; Esther 24; Sofia e Kauã 25; Daia 27; Julia 31; quarta 28 sem show), **um show "Teatro de Natal" com duas sessões separadas (11:30 e 15:30)**, Sofia restrita (segunda a sexta só tarde), limite 3, Julia e Bel também na Montanha 15:15. Gerar os nove dias em ordem e afirmar: ninguém na própria folga; Sofia nunca de manhã em dia de semana; ninguém acima de 3 shows; nenhum fixo repete sessão no dia; Julia e Bel só aparecem em 24, 25 e 27.
- [ ] **Step 2: Rodar a suíte inteira que toca o motor**: `restricao-horario`, `daily-book-vivo`, `escalas-dia`, `sondagem-mes-rodizio`, `personagens-por-show`, `permission-matrix`, `folgas-equipe`. Expected: todos PASS.
- [ ] **Step 3: Escrever o handoff** (o que foi feito, o que depende da Babi, a premissa dos dois shows, e a ordem: migração 0071 em produção, depois API, depois site) e acrescentar uma linha em "Estado" do `AGENTS.md`.
- [ ] **Step 4: Commit.**

---

## Auto-revisão

- **Sessão separada (spec, seção 0):** pergunta e padrão → Task 7A; Livro próprio com hora no nome e personagens compartilhados → Tasks 2A e 2B; tornar a sessão "não separada" de novo só mexe em rascunho sem ajuste → Task 2A (`SESSAO_COM_LIVRO`). A regra "só se junta de volta o rascunho sem ajuste à mão" está marcada no spec como minha decisão a confirmar.
- **Cobertura do spec:** restrição proibitiva e exceção do dia → Tasks 3 e 4; quem cadastra e libera, recusa com frase → Tasks 4 e 5; limite configurável por local, proibição passável à mão com motivo e aviso → Tasks 3, 4 e 6; uma sessão por dia e shows colados como "evitar" → Task 3; cadastro em lote, desfazer, vazio, rodapé, 375 px, Esc → Tasks 7 e 8; Registro e aviso no sino → Tasks 4 e 5; peso por show e preferência ficaram fora, como o spec manda.
- **Onde o plano se afasta do spec, de propósito:** (1) o spec fala de uma tabela de "exceção do dia"; aqui a exceção é a própria mexida à mão (`manual=true`, motivo no Registro e no aviso), igual a "chamar na folga" hoje, sem tabela nova. (2) A Supervisão libera pelo mesmo caminho de ajuste da Escala, que já limita à própria área.
- **Consistência de nomes:** `restricaoImpede`, `showsColados`, `carregarRegrasDoDia`, `verificarRegrasDeEscala`, `bloqueios`, `eventId` e os dois códigos de erro aparecem com a mesma grafia em todas as tarefas.
- **Ainda não confirmado no código:** onde exatamente o menu e o roteador do site registram as páginas (Task 7); quanto a Programação, o cadastro do Teatro de Natal precisa ter **dois blocos** (11:30 e 15:30) do mesmo show para a Escala do dia mostrar uma linha por sessão; e o efeito de uma sessão separada sobre o `check-in por turno` e a publicação do dia (cada Livro publica como hoje; conferir `fase-c-escala-avisos.test.ts` e `shift-checkins.test.ts` na Task 2B).
- **Tamanho:** o plano passou de 9 para 11 tarefas por causa da sessão separada (2A, 2B e 7A). Tasks 2A e 2B são as de maior risco, porque mexem em como o dia é gerado e como a Escala liga o bloco ao Livro; vale revisão independente depois delas.
