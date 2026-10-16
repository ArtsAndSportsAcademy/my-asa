# Pedido de folga analisado — Plano de construção

> **Para quem for executar:** usar superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans, tarefa por tarefa. Os passos usam caixas `- [ ]`.

**Objetivo:** a Supervisão da área da pessoa decide pedido de folga com o panorama do dia já pronto (quem folga, quem trabalha, a vaga e quem pode cobrir), e a Administração só entra depois de um prazo configurável.

**Arquitetura:** a análise é calculada **na leitura** por um serviço novo (`services/analise-folga.ts`) que reaproveita a Escala do dia (`montarEscalaDoDia`) e o Livro do Dia vivo; nada dela é gravado. O roteamento e a troca ficam em `routes/operational-cycle.ts` (pedido de folga = `leave_requests`), com a mesma disciplina de sempre: Registro na mesma transação e aviso pela fila durável.

**Tecnologia:** Express + Drizzle (api-server), React + Vite (web-admin), testes do api-server pelo runner `tests/run-tests.mjs` contra o banco de **teste**, conferência de tela com Playwright a 375 px.

**Desenho:** `docs/superpowers/specs/2026-10-16-pedido-de-folga-analisado-design.md` (ler primeiro; as respostas da Babi estão na §10). Contexto das regras: `docs/regras-de-folgas.md`, `AGENTS.md` (o crivo das 16 perguntas).

## Restrições globais

- Português do Brasil em tudo (código, comentários, textos da tela, mensagens de commit em prosa longa). Os textos explicam a regra, não o botão.
- Toda escrita grava `writeHistoryEvent` **na mesma transação**, com o motivo quando a ação o pede. Aviso: um por acontecimento, pela fila (`enqueueNotification` com `deduplicationKey`).
- Remoção é lógica. Nada de apagar dado real.
- **Migração só no banco de teste.** Cada migração tem rollback em `lib/db/drizzle/rollback/` e entrada em `lib/db/drizzle/meta/_journal.json`. Em produção quem roda é você (a pessoa que constrói o app); avisar a ordem (migração primeiro, promoção depois).
- Perfis: Supervisão decide só pessoa da própria área (`canSupervisorAccessPerson`); Administração conforme o prazo; **Direção só lê**; Elenco não vê a análise do dia.
- Telas conferem a 375 px; toda janela tem rodapé com confirmar e cancelar, visível com o teclado aberto; Esc fecha.
- Nunca commitar `.env*`; nunca escrever senha em arquivo, log ou conversa. Commit só depois de perguntar, sem push.
- Depois do `vite build`, rodar `node scripts/verificar-nomes-build.mjs`. Dados de exemplo com nome de gente só dentro de `import.meta.env.DEV`.
- Banco de teste é lento (5–12 s por escrita); um arquivo de teste por vez; apagar `tests/.dist` depois.

## Revisão de foco (o que a spec não diz e pode quebrar)

1. **Pedido de intervalo longo** (ex.: 30 dias): a análise roda por dia e não pode estourar o tempo. Limite de **14 dias** por análise, com a frase "Mostrando os 14 primeiros dias" — teste em Tarefa 1.
2. **Dia sem Escala nem Livro** (mês ainda não gerado): a tela diz que falta gerar, não fica em branco — Tarefa 1.
3. **Vaga sem nenhum substituto cadastrado**: resultado "Não dá" com a frase dizendo que a vaga não tem substituto, e a saída é a troca — Tarefa 1 e 3.
4. **Quem pede é a própria Supervisão** (ou não há Supervisão na área): ninguém decide o próprio pedido; sem supervisão, a Administração decide **desde o início** — Tarefa 2.
5. **Pedido cancelado, ou colega que some, durante a troca; duplo clique em aprovar**: estados terminais não reabrem, segunda decisão devolve 409 com frase clara — Tarefa 3.

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `api-server/src/services/analise-folga.ts` (novo) | Calcula o panorama de cada dia do pedido. Só leitura. |
| `api-server/src/routes/folga-analise.ts` (novo) | `GET /leave-requests/:id/analise`. |
| `api-server/src/services/folga-config.ts` (novo) | Lê prazo e limite de folgas por dia; valores padrão até a Tarefa 5. |
| `api-server/src/routes/operational-cycle.ts` | Roteamento do pedido, prazo da Administração, troca, alternativa. |
| `api-server/src/services/operational-jobs.ts` | Aviso único à Administração quando o prazo abre. |
| `lib/db/src/schema/operational-cycle.ts` | Colunas novas de `leave_requests` e tabela de configuração. |
| `lib/db/drizzle/0067_*.sql`, `0068_*.sql` + rollbacks + `_journal.json` | Migrações (só no teste). |
| `web-admin/src/pages/folga-analise.tsx` + `.css` (novo) | Os quatro blocos da análise, em componente próprio. |
| `web-admin/src/pages/operational-cycle.tsx` | Diálogo de decisão usa a análise; troca e alternativa; configuração. |
| `web-admin/src/pages/solicitacoes.tsx` | O colega vê e responde a troca de folga. |
| `api-server/tests/folga-analise.test.ts`, `folga-roteamento.test.ts`, `folga-troca.test.ts` (novos) | Registrar em `tests/run-tests.mjs`. |

---

### Tarefa 1: Panorama do dia (só leitura)

É a que mais alivia; dá para a Supervisão usar sozinha.

**Arquivos:**
- Criar: `artifacts/api-server/src/services/analise-folga.ts`, `artifacts/api-server/src/routes/folga-analise.ts`, `artifacts/api-server/src/services/folga-config.ts`
- Criar: `artifacts/web-admin/src/pages/folga-analise.tsx`, `folga-analise.css`
- Modificar: o índice de rotas (onde `operational-cycle` é registrado), `operational-cycle.tsx` (diálogo de decisão)
- Teste: `artifacts/api-server/tests/folga-analise.test.ts` (+ registrar em `run-tests.mjs`)

**Interfaces:**
- Produz: `type DiaAnalisado = { date: string; deFolga: { id: string; name: string }[]; trabalham: { id: string; name: string }[]; vagas: { personagem: string; pessoa: string; podeCobrir: { id: string; name: string }[] }[]; resultado: { da: boolean; frase: string }; aviso: string | null; semEscala: boolean }`
- Produz: `analisarPedidoDeFolga(input: { organizationId: string; userId: string; startDate: string; endDate: string }): Promise<{ dias: DiaAnalisado[]; cortado: boolean }>`
- Produz: `lerConfigFolga(organizationId: string): Promise<{ prazoSupervisaoDias: number; limiteFolgaPorArea: Record<string, number> }>` (padrão `{ 3, {} }`)
- Produz: `GET /api/leave-requests/:id/analise` → `{ dias: DiaAnalisado[]; cortado: boolean }`

- [ ] **Passo 1: testes que falham** em `folga-analise.test.ts`, no molde de `folgas-equipe.test.ts` (org, operação, locais, áreas, usuários, papéis criados no teste). Casos, cada um com nome e asserção:
  - `lista quem está de folga e quem trabalha no dia` — `deFolga` contém só quem tem folga ACTIVE naquele dia; `trabalham` contém quem está num bloco da Escala (rascunho conta).
  - `quem pode cobrir é só quem está na lista de substituições da vaga` — um substituto que trabalha entra; um substituto de folga **não** entra; uma pessoa fora da lista que trabalha **não** entra.
  - `sem substituto: resultado não dá e a frase diz por quê` — `resultado.da === false` e `frase` contém "substituto".
  - `dia sem Escala diz que falta gerar` — `semEscala === true`, `resultado.da === true`, `frase` contém "ainda não tem Escala".
  - `corta em 14 dias` — pedido de 20 dias devolve 14 dias e `cortado === true`.
  - `Elenco recebe 403 com frase; outra organização recebe 404; Direção lê; Supervisão de outra área recebe 403`.
  - `a análise não grava nada` — contagem de `history_events` e `folgas` igual antes e depois.
- [ ] **Passo 2: rodar e ver falhar** — `$env:MYASA_TEST_RUNNER="1"; $env:TEST_FILE="folga-analise.test.ts"; node --env-file=../../.env.test ./tests/run-tests.mjs` (em `artifacts/api-server`). Esperado: falhas por rota/serviço inexistente.
- [ ] **Passo 3: implementar `analisarPedidoDeFolga`** em `services/analise-folga.ts`. Para cada dia (máx. 14): `montarEscalaDoDia(organizationId, locationId, date)` (sem `publishedOnly`) para cada local da pessoa dá `pessoas[].folga` e `blocos[].pessoaIds`; as vagas e os substitutos vêm do Livro do Dia vivo daquele dia (linhas `TITULAR_SUBSTITUTE` com `config.substituteIds` e a fila de `ROTATION`; ver `line-resolver.ts` e `resolveLiveTree` em `routes/daily-book.ts`, exportando só o mínimo necessário). "Sem outro show no mesmo horário" usa `services/schedule-conflicts.ts`. O `aviso` de limite de folga por área usa `lerConfigFolga`.
- [ ] **Passo 4: implementar `GET /leave-requests/:id/analise`** em `routes/folga-analise.ts` com a mesma regra de acesso do `PATCH /leave-requests/:id` (Administração; Supervisão com `canSupervisorAccessPerson`), mais Direção só leitura; Elenco: 403 "A análise do dia é só para quem decide o pedido."
- [ ] **Passo 5: rodar os testes e ver passar.**
- [ ] **Passo 6: tela** `folga-analise.tsx`: componente `AnaliseDoPedido({ pedidoId })` com os quatro blocos, só nomes (modelo aprovado: "Astrid · Ana", "Se a Ana folgar, pode cobrir: Carol, Isa"); vazios explicados; no diálogo de decisão (`operational-cycle.tsx` ~linha 159) o bloco aparece acima dos botões; rodapé fixo com Aprovar e Recusar com motivo.
- [ ] **Passo 7: conferir na tela** com a empresa de teste (`docs/empresa-de-teste.md`), entrando como Supervisão e Administração, a 375 px; checar o console sem erros e que o rodapé não some com o teclado.
- [ ] **Passo 8: tipos, build, nomes** — `tsc --noEmit` nos dois pacotes, `vite build`, `verificar-nomes-build.mjs`. Perguntar antes de commitar.

---

### Tarefa 2: Roteamento e prazo da Administração

**Arquivos:**
- Modificar: `routes/operational-cycle.ts` (`POST /leave-requests`, `PATCH /leave-requests/:id`, `GET /leave-requests`), `services/operational-jobs.ts`, `folga-config.ts`
- Teste: `artifacts/api-server/tests/folga-roteamento.test.ts` (+ registrar)

**Interfaces:**
- Consome: `ultimoRetratoFolgas(operationId, year, month)` de `services/folgas-publicadas.ts` (devolve `null` quando o mês não está publicado), `lerConfigFolga`.
- Produz: `mesDeFolgasPublicado(operationId: string, date: string): Promise<boolean>` (em `folga-config.ts` ou `folgas-publicadas.ts`)
- Produz: `prazoAdminAberto(dataPedida: string, hoje: string, prazoDias: number): boolean` — verdadeiro quando `dataPedida − hoje ≤ prazoDias`, em **dias corridos**.
- Produz: o `GET /leave-requests` passa a devolver `destino: { quem: "SUPERVISAO" | "ADMINISTRACAO" | "PRIORIDADE"; area: string | null; adminPodeDecidirEm: string | null }` por pedido.

- [ ] **Passo 1: testes que falham**:
  - `mês não publicado: o pedido entra como prioridade` — resposta 201 com `status: "APPROVED"`, existe `folga` ACTIVE com `origem: "SOLICITACAO"`, uma linha no Registro, um aviso à gestão; a gerência desfaz com `POST /folgas/:id/cancelar` e motivo.
  - `mês publicado: o pedido fica PENDING e só a Supervisão da área é avisada` — nenhum aviso para a Administração.
  - `Administração não decide antes do prazo` — `PATCH` devolve 409/403 com frase "A Supervisão da área tem até DD/MM para responder; a Administração pode decidir a partir daí."
  - `Administração decide quando o prazo abriu` (data pedida a ≤ 3 dias) e `Administração decide desde o início quando a área não tem supervisão`.
  - `ninguém decide o próprio pedido` (Supervisão que pede).
  - `o prazo abre uma vez: o job avisa a Administração uma única vez` (rodar duas vezes, uma notificação).
- [ ] **Passo 2: rodar e ver falhar.**
- [ ] **Passo 3: implementar** `mesDeFolgasPublicado` e `prazoAdminAberto`; no `POST /leave-requests`, antes de publicar criar `APPROVED` com a folga na mesma transação (*escolha: "prioridade" = já aprovado e desfeito pela gerência com motivo, em vez de uma fila nova*); depois de publicar manter `PENDING` e trocar `avisarGestaoDaFolga` para avisar **só a Supervisão da área** (Administração só quando a área não tem supervisão). No `PATCH`, aplicar a regra de prazo para quem é Administração.
- [ ] **Passo 4: job** em `operational-jobs.ts`: função que acha pedidos `PENDING` com prazo aberto e sem aviso e envia um aviso por pedido (`deduplicationKey: "folga:${id}:prazo"`).
- [ ] **Passo 5: rodar os testes e ver passar.**
- [ ] **Passo 6: tela** — o Elenco vê em "Minhas folgas" a frase de `destino` ("Aguardando a Supervisão de Patinadores"); a Administração vê o pedido com "Você poderá decidir a partir de DD/MM" e os botões desativados com a explicação, nunca sem explicação (pergunta 2 do crivo). Conferir como Elenco, Supervisão, Administração e Direção a 375 px.
- [ ] **Passo 7: tipos, build, nomes.** Perguntar antes de commitar.

---

### Tarefa 3: Troca com quem está de folga

**Arquivos:**
- Criar: `lib/db/drizzle/0067_folga_troca.sql` + `rollback/0067_*.sql`, entrada no `_journal.json`
- Modificar: `lib/db/src/schema/operational-cycle.ts`, `routes/operational-cycle.ts`, `pages/solicitacoes.tsx`, `pages/operational-cycle.tsx`
- Teste: `artifacts/api-server/tests/folga-troca.test.ts` (+ registrar)

**Interfaces:**
- Produz (schema): `leave_requests` ganha `peerId uuid null`, `peerRespondedAt timestamptz null`, `peerReason text null`, `swapReturnDate date null`; o enum `leave_request_status` ganha `WAITING_PEER`.
- Produz: `POST /api/leave-requests/:id/troca` corpo `{ peerId: string; diaDevolvido: string }` (Supervisão decisora) → pedido em `WAITING_PEER`.
- Produz: `POST /api/leave-requests/:id/troca/resposta` corpo `{ aceita: boolean; motivo?: string }` (só o colega; `motivo` obrigatório se `aceita === false`).

- [ ] **Passo 1: migração só no banco de teste** (`tsx ... src/migrate.ts` com `.env.test`), com rollback escrito e journal conferido. Avisar a você a ordem para produção.
- [ ] **Passo 2: testes que falham**:
  - `a Supervisão propõe troca a quem está de folga no dia` (colega sem folga naquele dia → 400 "Esse colega não está de folga nesse dia: não é troca, é cobertura.").
  - `colega aceita: a troca se aplica numa transação` — a pessoa ganha o dia pedido e perde o `diaDevolvido`; o colega perde a folga do dia pedido e ganha a do `diaDevolvido`; **a contagem de folgas de cada um no mês não muda**; uma linha no Registro; aviso de republicação (`avisarRepublicacaoFolgas`).
  - `colega recusa com motivo: volta para PENDING, a Supervisão é avisada com o motivo`; recusa sem motivo → 400.
  - `só o colega responde; segunda resposta devolve 409`.
  - `pedido cancelado durante a espera não reabre`.
  - `o dia devolvido precisa ser uma folga da pessoa` (senão 400).
- [ ] **Passo 3: rodar e ver falhar.**
- [ ] **Passo 4: implementar** os dois endpoints reaproveitando o padrão de troca de `routes/solicitacoes.ts` (`WAITING_PEER` → `PENDING`) e a aplicação da folga que o `PATCH` já faz (sem empilhar folga duplicada).
- [ ] **Passo 5: rodar os testes e ver passar.**
- [ ] **Passo 6: telas** — diálogo da Supervisão ganha "Pedir troca a quem está de folga" (lista os que estão de folga no dia e fazem a vaga; escolher o dia devolvido; rodapé com confirmar e cancelar); `solicitacoes.tsx` mostra ao colega "Ana quer folgar na sexta 23 e pediu para você trabalhar. Você ganha a folga do dia X." com Aceitar e Recusar (motivo). Conferir com dois logins da empresa de teste a 375 px.
- [ ] **Passo 7: tipos, build, nomes.** Perguntar antes de commitar.

---

### Tarefa 4: Mediação — proposta de só os dias que dão

**Arquivos:**
- Criar: `lib/db/drizzle/0068_folga_alternativa.sql` + rollback + journal
- Modificar: `schema/operational-cycle.ts`, `routes/operational-cycle.ts`, `pages/operational-cycle.tsx`, `pages/solicitacoes.tsx`
- Teste: acrescentar casos em `folga-troca.test.ts`

**Interfaces:**
- Produz (schema): `leave_requests.alternativeDates date[] null`; enum ganha `ALTERNATIVE_PROPOSED`.
- Produz: `POST /api/leave-requests/:id/alternativa` corpo `{ dias: string[]; motivo?: string }` (Supervisão decisora; `dias` ⊂ período pedido e não vazio).
- Produz: `POST /api/leave-requests/:id/alternativa/resposta` corpo `{ aceita: boolean }` (só quem pediu).

- [ ] **Passo 1: migração só no teste**, rollback, journal.
- [ ] **Passo 2: testes que falham**: a Supervisão propõe 1 dos 3 dias; a pessoa aceita → só esse dia vira folga, o resto fica registrado como não concedido, com Registro e aviso; a pessoa recusa → volta para `PENDING` e a Supervisão é avisada; `dias` fora do período → 400; só quem pediu responde; segunda resposta 409.
- [ ] **Passo 3: rodar e ver falhar.**
- [ ] **Passo 4: implementar** os dois endpoints; a aplicação da folga reusa o código do `PATCH`.
- [ ] **Passo 5: rodar e ver passar.**
- [ ] **Passo 6: telas** — no diálogo, quando a análise mostra dias que dão e dias que não, aparece "Propor só os dias que dão" (marcados por padrão os que dão); a pessoa vê a proposta em "Minhas folgas" com Aceitar e Recusar. Conferir a 375 px.
- [ ] **Passo 7: tipos, build, nomes.** Perguntar antes de commitar.

---

### Tarefa 5: Configuração (prazo e limite de folgas por área)

**Arquivos:**
- Criar: `lib/db/drizzle/0069_folga_config.sql` + rollback + journal
- Modificar: `schema/operational-cycle.ts` (tabela `folga_config`), `services/folga-config.ts`, `routes/operational-cycle.ts`, `pages/operational-cycle.tsx`
- Teste: `folga-roteamento.test.ts` (casos novos)

**Interfaces:**
- Produz (schema): `folga_config { organizationId uuid pk, prazoSupervisaoDias int not null default 3 check 0..30, limiteFolgaPorArea jsonb not null default '{}' }`. *Escolha: o limite é por **área** (Bailarinos, Patinadores); se a Babi precisar de "função" dentro da área, vira outra tarefa.*
- Produz: `GET /api/folga-config` (Administração e Direção leem; Supervisão lê o próprio limite) e `PUT /api/folga-config` (só Administração; grava Registro com antes e depois).
- `lerConfigFolga` passa a ler da tabela, com o padrão `{ 3, {} }` quando não há linha.

- [ ] **Passo 1: migração só no teste**, rollback, journal.
- [ ] **Passo 2: testes que falham**: mudar o prazo para 5 muda a regra da Tarefa 2; limite 3 para Bailarinos faz a análise trazer `aviso` quando o dia passaria de 3 de folga; o aviso **nunca bloqueia** a decisão; só a Administração grava; valor inválido (`-1`, `31`, texto) → 400 com frase.
- [ ] **Passo 3: rodar e ver falhar.**
- [ ] **Passo 4: implementar** tabela, serviço e endpoints.
- [ ] **Passo 5: rodar e ver passar.**
- [ ] **Passo 6: tela** — em Folgas, seção "Regras do pedido" para a Administração: prazo da Supervisão em dias (texto: "A Administração pode decidir quando faltarem N dias para a data pedida e a Supervisão não tiver respondido") e limite de folgas por dia em cada área; Salvar e Descartar no rodapé; estado vazio explicado. Conferir a 375 px.
- [ ] **Passo 7: tipos, build, nomes.** Perguntar antes de commitar.

---

### Tarefa 6: Conferência de ponta a ponta e fechamento

**Arquivos:** `docs/mapa-de-revisao.md`, `docs/plano-folga-como-troca-e-mes-em-rascunho.md`, `AGENTS.md`, um handoff novo em `docs/`.

- [ ] **Passo 1:** na empresa de teste, com Playwright, percorrer: Elenco pede antes e depois de publicar; Supervisão vê o panorama, aprova, propõe troca, propõe só os dias que dão; colega aceita e recusa; Administração antes e depois do prazo; Direção só lê. Tudo a 375 px e no computador; console sem erros.
- [ ] **Passo 2:** rodar a suíte relacionada: `folga-analise`, `folga-roteamento`, `folga-troca`, `folgas-equipe`, `fase-e-ciclo`, `grupo-b-operational-cycle`.
- [ ] **Passo 3:** atualizar o `mapa-de-revisao.md` (Folgas passa a "Revisada" só para o que foi conferido; Mapa do mês e Grupos de folga seguem pendentes) e escrever o handoff com: o que está só local, as três migrações a rodar em produção e a ordem (migração primeiro, API, depois site).
- [ ] **Passo 4:** perguntar antes de commitar. Não enviar ao GitHub nem promover.

---

## Conferência do plano contra o desenho

- Antes/depois de publicar (§3.1–2) → Tarefa 2. Prazo configurável e aviso único (§3.3) → Tarefas 2 e 5. Troca só com colega de folga e aceite com motivo (§3.4) → Tarefa 3. Mediação com dias que dão (§4) → Tarefa 4. Cobertura só avisa (§3.6) → Tarefas 1 e 5. Registro e avisos (§3.8, §6) → todas. Quatro blocos e casos vazios (§4) → Tarefa 1. Direção só lê → Tarefa 1.
- **Fora do plano de propósito:** folga transferida em emergência (já existe como remarcar no mapa; a conta do mês é conferida nos testes da Tarefa 3), visão do mês e grupos da alta temporada.
