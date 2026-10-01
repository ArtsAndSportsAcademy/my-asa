# Pendência — sessões alimentando o Livro do Dia

Data: 2026-09-21. Escrito **só por leitura de código**. Nada aqui foi executado, tipado,
testado ou visto no navegador (a máquina não tinha Node nem git). Nada está "pronto".

## O que foi pedido

Ao gerar o Livro do Dia, buscar as sessões do show elegíveis na data (ativa + dentro da
vigência) e criar **um bloco por sessão, na ordem de horário**. Sem sessão elegível, o show
não entra naquele dia, sem inventar horário.

A **Escala fica fora**: é tela própria, ainda não portada. Registrada como pendência, não
como bloqueio.

> **Atualização:** decisões tomadas e implementação escrita — ver a seção final
> "Decisões e implementação". **Escrita sem compilar e sem testar.**

## Por que não foi implementado de imediato (histórico)

1. **Conflito com a regra de negócio.** `design_handoff_my_asa/03-regras-de-negocio.md:81`:
   "Uma formação vale para o dia inteiro; se alguém falta só em uma sessão, o app avisa e a
   pessoa ajusta manualmente." E `01-modelo-de-dados.md:74`: o contador do rodízio soma 1
   **por dia, não por sessão**. Um bloco por sessão *com posições e pessoas próprias* faria
   a mesma formação existir N vezes no dia.
2. **Impacto não medível sem rodar a suíte.** Ver "Pontos de contato".
3. **Falta definir o conteúdo do bloco de sessão** (ver Opções).

## Estado atual (lido)

- Geração: `artifacts/api-server/src/routes/daily-book.ts:589-842`. O evento de agenda vem
  do modo por data (Livro do Show + data) ou do modo legado por evento.
- Blocos do Livro do Dia nascem dos **blocos do Livro do Show** (`showBookBlocksTable`,
  `daily-book.ts:698-702`, inserção em `:767`). Cada papel se pendura num bloco por
  `role.blockId` (`:794`).
- A tabela `daily_book_blocks` já tem `start_time`, `end_time`, `source_block_id`,
  `scene_id` (`lib/db/src/schema/daily-book.ts:53-65`) e `is_removed` (remoção lógica).
  **Um bloco de sessão não exige migração.**
- Regeneração recria blocos em outro ponto: `daily-book.ts:905-915`.
- Consumidores de bloco: `services/scale-merge.ts:213-219`, `routes/my-day.ts`, e as rotas de
  remover/restaurar bloco (`daily-book.ts:1593-1742`, lógicas).
- Sessões **nunca** são lidas em `daily-book.ts` nem em `scales.ts`. Hoje só
  `services/schedule-conflicts.ts` (que já filtra ativa + vigência, em duas funções) e o CRUD
  em `routes/entities.ts:302-360` tocam a tabela `sessions`.
- Toda escrita de sessão já é lógica e grava Registro na mesma transação
  (`session.created / updated / deactivated`).

## Opções para o conteúdo do bloco de sessão

**A. Bloco-marcador, sem posições** (recomendada para começar)
Um `daily_book_blocks` por sessão elegível: `name` = "Sessão HH:MM–HH:MM",
`start_time`/`end_time` da sessão, `scene_id` e `source_block_id` nulos, ordenado por
horário. As posições continuam nos blocos do Livro do Show. Respeita "formação vale para o
dia inteiro"; o bloco só mostra *quando* o show acontece. Não exige migração.
Ponto a validar: como `my-day`, `scale-merge` e a impressão tratam um bloco sem posições.

**B. Bloco por sessão com posições duplicadas**
Cada sessão vira uma formação própria. Contradiz `03:81` e `01:74` (contador por dia).
Multiplica atribuições, notificações e alertas. Só com decisão explícita e mudança da regra.

**C. Sessões só no cabeçalho** (`snapshotJson.sessions`), sem bloco
Menos invasiva, mas não é o que foi pedido ("um bloco por sessão").

## Critério de elegibilidade (mesmo de `schedule-conflicts.ts:205-209`)

```
sessions.show_id = <show>
AND sessions.active = true
AND (sessions.valid_from IS NULL OR sessions.valid_from <= <data>)
AND (sessions.valid_to   IS NULL OR sessions.valid_to   >= <data>)
ORDER BY sessions.start_time
```

## Decisões que faltavam antes de codar (resolvidas na seção final)

1. **Opção A, B ou C?**
2. **Sem sessão elegível → o quê exatamente?** Recusar a geração (409 com motivo) ou gerar
   sem blocos de sessão? O pedido diz "o show não entra naquele dia", o que sugere recusar.
   Consequências a decidir:
   - Shows **sem nenhuma sessão cadastrada** (incluindo "só personagens") ficariam sem
     Livro do Dia. Devem ficar isentos?
   - Um Livro do Dia já gerado, cuja sessão foi desativada depois: a regeneração deve
     removê-lo ou apenas avisar? (Regra do sistema: nada apaga fisicamente; usar
     `is_removed`/cancelamento com Registro.)
3. **Regeneração** (`:905-915`) segue a mesma regra?

## Pontos de contato e risco (a confirmar rodando a suíte)

- `tests/permission-matrix.test.ts`, `tests/block6-integrity.test.ts` e
  `tests/daily-book-fill.test.ts` chamam a geração. Pela leitura, `permission-matrix` e
  `daily-book-fill` não criam sessões; um bloqueio por "sem sessão elegível" quebraria essas
  suítes. Precisam ganhar sessão elegível como fixture.
- `run-tests.mjs` **interrompe no primeiro arquivo que falha**: o total de asserts será
  parcial se algo quebrar cedo.

## Regras a respeitar na implementação

- Migração só em banco de teste (`.env.test`), nunca piloto. **Opção A não precisa de migração.**
- Escrita do bloco dentro da mesma transação da geração (`daily-book.ts:738`), com o Registro
  `DAILY_BOOK / generated` já existente, acrescentando `sessionIds` em `metadata`.
- Nada de `DELETE` físico: remoção de bloco de sessão = `is_removed = true` + Registro.
- Não inventar horário: bloco só nasce de sessão real.

## Plano de teste (para quando houver Node)

1. Show com 2 sessões elegíveis → 2 blocos, na ordem de horário, com start/end corretos.
2. Sessão inativa → sem bloco. Sessão com `valid_to` anterior à data → sem bloco.
   Sessão com `valid_from` posterior → sem bloco. Bordas (`valid_from = data`) → entra.
3. Nenhuma sessão elegível → comportamento da decisão 2.
4. Regenerar após desativar uma sessão.
5. Abrir e salvar/regenerar sem mudança não altera nada.
6. Registro gravado na mesma transação (falha forçada → nada persiste).

## Outras pendências desta rodada (não resolvidas)

- **Suíte completa** contra `.env.test`: total de asserts e falhas ainda desconhecidos.
- **`git diff`**: o que o agente anterior deixou aplicado só foi conferido por leitura.
- **Banco da migração `0036`**: não foi possível confirmar em qual banco foi aplicada.
- **Prévia em `?amostra=1` como Supervisão**: nenhum fluxo executado. Cobre: Drive em nova aba
  e link sem URL não clicável, remover pessoa da fila pelo cartão, chamada opcional por
  sessão, Informações gerais com campo livre, remover quadro-chave, "Personagens em cena".
- **Escala**: ligação com sessões fica para a tela própria.

## Decisões e implementação (2026-09-21) — NÃO compilado, NÃO testado

**Decisões da Cris/Supervisão:**
1. **Opção A**: um bloco por sessão que só marca o horário, sem posições próprias.
2. **Sem sessão elegível não recusa a geração.** Show sem sessão cadastrada (inclusive
   "só personagens") entra normalmente, sem bloco de horário.
3. **Sessão desativada depois da geração → regenerar só avisa, não remove.** O bloco antigo
   fica marcado como desatualizado; a Supervisão decide.
4. **Escala fora do escopo**; segue pendência da tela própria.

**Implementado (só por escrita de código):**
- `artifacts/api-server/src/services/session-blocks.ts` (novo): `eligibleSessions` (ativa +
  vigência, ordenada por horário), `syncSessionBlocks` (cria/atualiza, nunca apaga, idempotente),
  `listSessionBlocks` (com `stale` calculado), `isNotSessionBlock`.
- `routes/daily-book.ts`:
  - **Geração**: sincroniza os blocos de sessão dentro da mesma transação; `sessionIds` e
    `sessionBlockIds` entram em `metadata` do Registro `DAILY_BOOK / generated`; a resposta
    devolve `sessionBlocks`.
  - **Regeneração**: o apagamento de blocos passa a **poupar** os blocos de sessão; depois
    sincroniza. Sessão que deixou de ser elegível **não** perde o bloco: ele volta em `warnings`
    (`session_block_stale`). Antes/depois dos blocos de sessão e o resumo do sincronismo entram
    no Registro (`writeDailyBookAudit`), na mesma transação.
  - **Leitura** `GET /daily-book/:id`: novo campo `dailyBook.sessionBlocks` com `stale`.
- **Sem migração.** Sem coluna nova.

**Como o "desatualizado" funciona (sem coluna):** é recalculado a cada leitura. Um bloco de
sessão é órfão quando nenhuma sessão elegível na data do Livro tem o mesmo início/fim. Reativar
a sessão o "reabre" sozinho — mesma ideia do conflito de horário reaberto. Mudar o horário de
uma sessão deixa o bloco antigo órfão e o novo nasce na próxima regeneração.

### Achados que precisam de decisão ou verificação

1. **Regeneração já apaga fisicamente** atribuições, posições, blocos (agora exceto os de
   sessão) e cenas (`daily-book.ts`, 4 chamadas `tx.delete`, ~linhas 913-916). Contraria a regra
   permanente "nada é apagado fisicamente". **Não corrigido; medido abaixo.**

   **Tamanho do problema (por leitura):**
   - **Dentro do módulo Livro do Dia, é o único ponto.** `DELETE /daily-book/:id` e as rotas de
     remover posição/cena/bloco são todas lógicas (`isRemoved`, `status = 'REMOVED'`,
     `CANCELLED`) e gravam Registro na transação.
   - **O que se perde:** as 4 tabelas do rascunho, incluindo ajustes manuais (troca de pessoa,
     posição/bloco/cena removidos). Os ids são novos a cada regeneração.
   - **O que se preserva:** o Registro guarda o snapshot completo de antes (árvore com pessoas) e
     de depois, gravado na mesma transação. O conteúdo é recuperável; as linhas e seus ids não.
   - **Quem aponta para essas linhas:** nenhuma outra tabela do esquema referencia as linhas
     filhas do Livro do Dia (busca em `lib/db/src/schema`, fora de `daily-book.ts`). As FKs
     internas usam `ON DELETE CASCADE` (5). Ids citados em texto de Registro/notificação não
     foram inspecionados.
   - **Guarda de estado frouxa (o mais grave):** a regeneração só recusa `PUBLISHED` e
     `REPUBLISHED` (`daily-book.ts:864`). Pela leitura não há guarda para **`EXECUTED`** nem
     **`CANCELLED`**: um Livro já executado (histórico) ou cancelado (filhos marcados removidos)
     poderia ser apagado e recriado. Não testado; confirmar antes de assumir.
   - **Fora do módulo (não classificado):** `.delete(` aparece em ~14 pontos de `show-book.ts`,
     4 de `scales.ts` (regeneração de Escala apaga `scale_allocations` e
     `allocation_exceptions`, `scales.ts:680-683`, mesmo padrão), além de agenda, atividades,
     áreas/locais etc. Muitos podem ser legítimos (tabelas de ligação, tokens, assinaturas de
     push); não foram avaliados um a um.
2. **A árvore do Livro do Dia só devolve blocos dentro de cenas** (`buildDailyBookTree`,
   `daily-book.ts:260`). Por isso os blocos de sessão (sem cena) **não aparecem** em `scenes`,
   no snapshot, no delta nem na publicação; só no campo novo `sessionBlocks`. Consequência:
   mudança de bloco de sessão não gera delta de republicação. Decidir se deve gerar.
3. **Livro publicado não pode ser regenerado** (409, `daily-book.ts:864`). O aviso de órfão só
   é visível por `GET /daily-book/:id` (`sessionBlocks[].stale`); o caminho de republicação não
   avisa nem sincroniza.
4. **"Só personagens" — DECIDIDO, sem exceção por tipo.** "Só personagens" às vezes usa horário
   e às vezes não, conforme o show. Quem decide se há horário é a **existência de sessão
   elegível cadastrada**, não o tipo (completo, só personagens ou só formação). O código já
   é assim: `services/session-blocks.ts` não consulta tipo de show em lugar nenhum. Falta
   apenas ver, na tela do Livro do Dia (ainda não portada), como o bloco de horário aparece num
   show "só personagens".
5. **Remover bloco de sessão** pela rota existente marca `is_removed`; a próxima regeneração o
   reativa se a sessão continuar elegível.
6. **Critério de elegibilidade duplicado** em três lugares (`schedule-conflicts.ts` ×2 e o novo
   serviço). Convém unificar; não mexi em `schedule-conflicts.ts` para não ampliar o escopo.
7. **Sem teste automatizado** para isto. Escrever um teste às cegas poderia travar a suíte (o
   runner para no primeiro arquivo que falha). O plano de teste acima continua valendo; os
   testes que chamam a geração (`permission-matrix`, `block6-integrity`, `daily-book-fill`)
   não deveriam quebrar, pois sem sessão nada muda — mas isso **não foi confirmado**.

## Verificação com Node (2026-09-21, noite) — EXECUTADA

**Suíte completa contra `.env.test` (piloto ausente do processo): 13 arquivos, 537 asserts, 0 falhas.**
Extras fora da contagem: 305 rotas protegidas verificadas sem autenticação e 175 chamadas da
matriz HTTP do `block6`. Os 5 "Falha de Registro solicitada pelo teste" no log são intencionais.
`tsc --noEmit` do `api-server`: limpo (1274 arquivos, incluindo `session-blocks.ts` e `daily-book.ts`).

**Guarda de regeneração (item 1):** só `DRAFT` regenera; `PUBLISHED`, `REPUBLISHED`, `EXECUTED` e
`CANCELLED` recebem 409 com mensagem própria e nada é tocado. Teste de mutação: com a guarda antiga
o teste novo falhou exatamente em `EXECUTED` e `CANCELLED` (4 asserts), ou seja, esses Livros eram
mesmo regenerados.

**Teste novo:** `tests/daily-book-session-blocks.test.ts` (28 asserts), registrado em `run-tests.mjs`.
Cobre elegibilidade por data/vigência, ordem, show sem sessão, órfão preservado com aviso,
reabertura, mudança de horário, Registro na mesma transação, atomicidade e a guarda.

**Migração 0036:** está no diário do Drizzle e o banco de teste a tem (o teste inseriu
`valid_from/valid_to` e a constraint respondeu). O banco do piloto **não foi consultado**, por regra:
não sei se recebeu ou não.

### Prévia `?amostra=1` como Supervisão — fluxos executados (dados de amostra, sem API)
| Fluxo | Resultado |
|---|---|
| Drive: `target="_blank"` + `rel="noopener noreferrer"`; sem URL não clicável | OK no DOM real; clique sem URL é barrado |
| Remover pessoa da fila pelo cartão, sem abrir o editor | OK (cancelar preserva; confirmar remove) |
| Fila rápida (Adicionar pessoa) | OK |
| Sessão: chamada opcional, vigência, ativa/inativa | funciona, com defeitos visuais (abaixo) |
| Informações gerais editável + campo livre | grava e aparece no resumo; salvar sem mexer não grava nada |
| Remover quadro-chave: confirmação e trava do último | OK |
| "Personagens em cena" (grupo + zona + marcadores rosa) | OK |

### Defeitos da prévia — CORRIGIDOS e verificados na prévia (2026-09-21, noite)
Os 9 itens abaixo foram corrigidos em `shows.tsx`/`shows.css`, conferidos em `?amostra=1` como
Supervisão (DOM + teste de clique) e a suíte voltou a passar: 13 arquivos, 537 asserts, 0 falhas.
Extra encontrado no caminho e corrigido: rótulo de slot de personagem duplicado ("M" para
Mensageiro e Mensageira) — agora inicial → duas letras → inicial + número, único na cena.
Informações gerais têm fonte única: o cartão da direita, que lê e edita `show.details`
(valores digitados têm precedência sobre os derivados). "Gerenciar sessões" virou clique na
própria linha do cartão de Sessões.

### 2026-09-22 — Desativação lógica e migração no piloto

**Piloto — migração 0031–0036 APLICADA (2026-09-22).** Autorizado "Opção A". Como o piloto estava em
0030 e a autorização cobria só até 0036 (não a 0037, que é do item 2), rodei o runner oficial do
Drizzle contra uma pasta de migrações truncada (cópia de `lib/db/drizzle` com o diário cortado em
idx 36 e só os `.sql` de 0000 a 0036) — não existe uma flag "até tal versão" no `migrate()` do Drizzle.
Script em `migrate-pilot-0036.mjs` (scratchpad), com trava: recusa se `DATABASE_URL` (teste) estiver
presente no processo, recusa se a pasta não terminar exatamente em 0036.

- **Migrações aplicadas: 6** (0031 a 0036; diário 31→37 = idx 0..36).
- **Tabelas alteradas (ADD COLUMN, linhas existentes afetadas): 4** — `show_books` (2 colunas),
  `sessions` (2 colunas + 1 constraint), `daily_book_scenes` (1), `show_book_blocks` (2 colunas em
  2 migrações). **Linhas afetadas: 0 em todas** (piloto tinha 0 shows, 0 sessões, 0 blocos — conferido
  por leitura antes e depois).
- **Tabelas novas criadas (vazias): 3** — `show_book_keyframes`, `stage_format_presets`,
  `show_book_drive_links`. 0 linhas.
- **Nenhuma tabela pública ficou exposta ao `anon`** (mesma checagem que `migration-runner.ts` faz).
- Confirmado por leitura: piloto agora em 37 migrações (0000–0036), só a **0037 pendente** — exatamente
  o limite autorizado, nada além disso.

**Feito (teste apenas):**
- Migração `0037_logical_removal_markers` (só no banco de teste): `superseded_at` nas 4 tabelas do
  Livro do Dia; `active` + `updated_at` em `show_book_tags`, `user_tags`, `show_book_position_library_refs`.
- Regeneração do Livro do Dia: sem `DELETE`; a geração anterior fica `is_removed`/`REMOVED` +
  `superseded_at`. Árvore, publicação, execução, cancelamento, remover/restaurar e Meu Dia ignoram
  linhas substituídas; restaurar uma linha substituída é recusado. Guarda "só DRAFT regenera" mantida.
- Tags, tags de pessoa e referências da Biblioteca: desativadas com Registro na mesma transação;
  listagens e motor de cobertura filtram `active`. Tag só é desativada pela própria operação.
- Teste `tests/logical-removal.test.ts` (23 asserts), com mutações conferidas.
- Suíte: 14 arquivos, 560 asserts, 0 falhas.

**Não coberto por teste:** o filtro novo do Meu Dia (exige Livro publicado ligado a alocação de Escala).

### 2026-09-22 (continuação) — as ~43 leituras de `scale_allocations` e a exclusão física da Escala

**Correção das leituras sem filtro `active` (feito, priorizado `asa.ts`).** Reexaminei cada uma das
48 leituras de `scale_allocations` e das 6 de `allocation_exceptions` por leitura de código, não só
por grep — o padrão automático deu pelo menos um falso positivo (`asa.ts:2539`: o filtro pertencia a
um `UPDATE` seguinte, não ao `SELECT`). Classifiquei cada leitura como lista/contagem exibida ou usada
para decisão (precisa do filtro) ou auditoria/diff que precisa do estado completo para detectar o que
mudou (não filtra, de propósito).

- **`asa.ts` — 26 leituras corrigidas.** Quase todas seguiam dois padrões repetidos (contagem por
  `status IN (ASSIGNED, MANUAL_OVERRIDE)` para atividade/carga, e `status = OPEN` para posições
  abertas), usados nos "consultar_*"/"gerar_relatorio_asa"/"sugerir_cobertura" da ASA — sem o filtro,
  uma entrada manual arquivada continuava contando em insights, KPIs, relatórios, detecção de
  "folga com atividade" e nas sugestões de cobertura. Uma delas (linha 4631) estava fora de `and(...)`,
  num ramo de ternário; um `replace_all` ingênuo ali teria criado um bug silencioso pelo operador
  vírgula do JS (`allocFilter` viraria só a condição de `active`, ignorando o `?:`) — corrigida à parte,
  embrulhando em `and(...)`. A saudação do "Meu Dia" da ASA (linha ~106) não tinha filtro de status
  nenhum; só acrescentei `active`.
- **Outros arquivos — 12 leituras corrigidas:** `check-ins.ts` (3, "quem é esperado hoje"),
  `daily-book.ts` (2, mapa de quem ocupa cada posição ao gerar/regenerar o Livro do Dia), `my-day.ts`
  (1, próximas alocações), `operational-panel.ts` (2, painel de saúde/cobertura — inclui
  `allocation_exceptions`), `coverage-engine.ts` (1, conflito entre escalas), `schedule-conflicts.ts`
  (1, compromissos reais da pessoa), `scale-merge.ts` (1, listagem da Escala).
- **`scales.ts` — 5 leituras corrigidas:** duas notificações "escala publicada/republicada" (não
  avisar quem teve a alocação arquivada), cópia de entradas manuais da semana anterior, e a listagem
  de `GET /scales/:id/exceptions`.
- **Deixado sem filtro, de propósito:** `buildScaleVersionSnapshot` e o diff de `mutateScale` em
  `scales.ts` — servem o Registro e a notificação de mudança, e precisam ver o antes/depois completo
  (inclusive o que acabou de ser arquivado) para funcionar. `operational-jobs.ts` já filtrava em
  JavaScript logo após o `select()` (`.filter(row => row.active)`), então não precisava de nada no SQL.
  Um lookup por id já conhecido (`scales.ts:1190`, `asa.ts:2537`) não precisa de filtro.

**Exclusão física da regeneração de Escala → desativação lógica (feito).** `scales.ts` (rota
`POST /scales/:id/regenerate`): os dois `tx.delete(...)` viraram `tx.update(...).set({ active: false,
updatedAt: new Date() })`, preservando a condição original (`isNotNull(agendaEventId)` só troca
alocações vindas do motor, nunca entradas manuais — regra preexistente, mantida). Mesmo padrão já usado
na rota de remover uma entrada manual. **Sem migração nova**: `active` já existe nas duas tabelas desde
o schema original.
- **Guarda de estado preexistente confirmada, não alterada:** só `DRAFT` regenera ou é apagada (a rota
  `DELETE /scales/:id` já era lógica — arquivava a Escala e desativava alocações/exceções/candidatos;
  só o comentário do código estava desatualizado, dizendo "cascade deletes", corrigido).
- **Efeito colateral positivo encontrado com o teste de mutação:** antes, o `DELETE` físico da alocação
  também apagava em cascata (`onDelete: cascade`) os candidatos analisados em `allocation_candidates`
  — perdendo o "porquê" da escolha do motor. Agora eles ficam, ligados à alocação preservada.
- **Teste novo:** `tests/scale-logical-removal.test.ts` (12 asserts). Confirmado com mutação: revertendo
  para `delete`, o teste falha em 4 pontos, incluindo a perda dos candidatos.

**Suíte completa contra `.env.test`: 15 arquivos, 572 asserts, 0 falhas** (mais 305 verificações de
rota sem autenticação e 175 chamadas da matriz HTTP do `block6`, fora da contagem de asserts).

**Piloto confirmado não afetado pelo item 2** (só leitura, depois de tudo): 37 migrações, 0 linhas em
`show_books`/`sessions`, nenhuma coluna da 0037 presente — idêntico ao estado logo após a migração do
item 1. As correções de código do item 2 não pedem migração nenhuma (as colunas `active` usadas já
existiam desde antes de 0030), mas o código em si não foi implantado no piloto — só o banco recebeu
a 0031–0036.

### Alvos de toque e duração (rodada seguinte)
- **Alvos:** varredura automática de todo controle clicável da tela Shows (Estante, Personagens,
  modo Show, Livro oficial, painel da ASA e 13 diálogos). Computador: nenhum abaixo de 44px.
  Celular (≤720px): nenhum abaixo de 48px, exceto os marcadores do mapa, que ficam em 44px porque
  `20-livro-oficial-interacoes.md` §1.5 especifica 44px para eles (conflito com o 48px do doc 18).
  Rótulos de zona passaram de 10px para 11px (piso do `05-design-tokens.md`).
- **Duração:** o valor calculado é a sessão ativa mais longa, não a soma; sem sessão válida,
  "Não definido". Yeti (3 × 20 min) mostra 20 min; antes mostraria 60.

### Defeitos achados na prévia (lista original)
1. **Interruptores invisíveis** (`SessionDialog`): o CSS desenha o interruptor por um `<span>` irmão do
   `input`, que o JSX não renderiza. "Horário de chamada separado" e "Sessão ativa…" ficam só texto,
   sem estado visível, com rótulo de 18 px de altura. Funciona ao clicar no texto.
2. **"Sessão ativa…" fica sob o rodapé** do diálogo de edição (precisa rolar).
3. **"Informações gerais" duplicada e divergente:** faixa no topo (editável, "Não definido") e cartão à
   direita (derivado, "40 min"). Editar não altera o cartão.
4. **"Duração" soma todas as sessões**, inclusive desativadas e fora da vigência (`shows.tsx:571`).
   Adicionar uma sessão de 60 min a um show de 40 min mostra 100 min.
5. **Cartão de Sessões** lista sessão desativada como normal (sem marca de desativada nem vigência).
6. **Faixa "Informações gerais" continua acima da barra do Livro oficial** (o Livro deveria ser modo próprio).
7. **Fila do personagem:** o botão "×" quebra para uma linha abaixo do nome.
8. **Alvo do "×" do quadro-chave: 28×28 px** (mínimo do `05-design-tokens.md`: 44 px).
9. **"Incluir personagem na cena"** usa `window.prompt` (`shows.tsx:442`), fora do padrão de diálogo.

## Alterado nesta rodada em `shows.tsx` (sem tipar nem abrir no navegador)

- Âncoras de Drive com `rel="noopener noreferrer"` no JSX; `aria-disabled`/`tabIndex` do link
  sem URL movidos para o JSX; `useEffect` + `panelRef` de DOM removidos.
- "Editar informações gerais": salvar sem alterar nada agora só fecha o diálogo (sem Registro
  nem nova versão).
