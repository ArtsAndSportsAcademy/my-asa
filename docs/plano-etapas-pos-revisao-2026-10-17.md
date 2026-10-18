# O que falta depois da revisão de ponta a ponta (17/10/2026)

Este arquivo organiza o que ficou de fora em etapas. Cada etapa traz um prompt pronto para colar numa
sessão nova. Todos os prompts mandam a sessão ler o `AGENTS.md` primeiro, porque é lá que estão as regras
(português, crivo das 16 perguntas, migração só no banco de teste, nada de merge na `main`).

## Já feito nesta rodada (não repetir)

Pronta só para áreas com gente ou supervisão no local; Supervisão vê as tarefas da própria área; Livro do
Dia lê os horários da Programação; ajuste em lote conferido antes de gravar; local novo pergunta a operação;
Painel com quatro números claros; fontes e toques do celular; rodapé da Escala reordenado; recusas com
frase; rota de rotinas reescrita (a matriz de permissões passa). Nada commitado, nenhuma migração.

## Ordem e dependências

| Etapa | Assunto | Depende de | Pode andar junto com |
|---|---|---|---|
| 0 | Fechar e commitar o que está pronto | — | — |
| 1 | Cadastro de operações (criar, ativar, ligar locais) | 0 | 2, 6 |
| 2 | Gerar o mês rápido | 0 | 1, 6 |
| 3 | Laços com espera no banco (ciclo, check-in) | 2 | 5, 7 |
| 4 | Gravação atômica (lote da Escala, edição de pessoa) | 0 | 5 |
| 5 | Celular: grade por pessoa, menu "Mais", botão da ASA | 0 | 3, 4 |
| 6 | Hora do cartão do Livro do Dia pela Programação | 0 | 1, 2 |
| 7 | Estilo, formato de erro e arremates | 3, 4, 5 | — |
| 8 | Conferência final e ordem de promoção | todas | — |

Regra para rodar em paralelo: duas sessões nunca mexem nos mesmos arquivos. Etapas 2 e 3 tocam geração e
ciclo, então andam em sequência. As etapas 4 e 5 mexem em `escalas.tsx`: se forem juntas, uma delas usa
worktree próprio.

---

## Etapa 0 — Fechar e commitar o que está pronto

**Por quê:** a rodada de hoje está só no diretório de trabalho. Tudo que vem depois parte dela.

**Prompt:**

```text
Leia o AGENTS.md na raiz do repositório antes de qualquer coisa. Trabalhe na branch codex/myasa-novo e
nunca faça merge na main.

Contexto: em 17/10/2026 houve uma revisão de ponta a ponta com uma empresa fictícia no banco de teste, e
várias correções ficaram sem commit. Veja o que mudou com git status e git diff. As mudanças que importam
estão em: artifacts/api-server (services/escala-dia.ts, services/meu-dia.ts, services/task-access.ts,
routes/escalas.ts, routes/daily-book.ts, routes/areas-locations.ts, routes/show-book.ts,
routes/responsibilities.ts, routes/tasks.ts, tests/), artifacts/web-admin (pages/escalas.tsx,
livro-do-dia.tsx, cadastros.tsx, operational-cycle.tsx, perfil.tsx, meu-dia.tsx, communication.css e
outros), lib/db/src/index.ts, .env.example e docs/.

Tarefa: (1) rode os tipos da API e do site e o build do site, mais o verificar-nomes-build.mjs, com os
comandos do AGENTS.md; (2) rode no banco de teste: escalas-dia, fase-c-meu-dia, permission-matrix,
escala-regras-http, escala-mes e asa-actions-http (o último leva cerca de 25 minutos, rode em segundo
plano); (3) separe o que é desta revisão do que são arquivos soltos (.agents/, .playwright-mcp/, output/,
my-asa-main.zip, "Nuevo Documento de texto.txt", .pnpm-store/): NÃO commite esses soltos nem nenhum .env;
(4) faça commits em português, em prosa longa, contando o que estava errado e por que a mudança resolve,
agrupando por assunto (Escala/pronta, tarefas da Supervisão, Livro do Dia, cadastro de local, Painel,
celular). Não envie nada ao GitHub: push só com o "pode enviar" da Babi. Não rode migração em produção.

Entregue: lista de commits, resultado dos testes (separando o que passou do que não rodou) e o que sobrou
fora dos commits.
```

---

## Etapa 1 — Cadastro de operações (importante)

**Por quê:** hoje não existe tela para criar ou ativar operação. A segunda operação nasce em rascunho e a
ativação pede um checklist que nenhuma tela preenche. Sem isso, uma casa nova não consegue crescer, e o
cadastro de local (que já pergunta a operação) fica sem de onde tirar a escolha.

**Prompt:**

```text
Leia o AGENTS.md na raiz antes de qualquer coisa, e docs/ (principalmente o desenho de Locais, Áreas e
Pessoas) para entender o cadastro. Branch codex/myasa-novo; nunca merge na main; tudo em português.

Problema: não existe tela para cadastrar operações. A API cria a operação em rascunho e a ativação exige um
checklist que nenhuma tela preenche; em 17/10 a operação "Parque das Águas" da empresa fictícia no banco de
teste foi ativada direto no banco. Já existe, no cadastro de locais (artifacts/web-admin/src/pages/
cadastros.tsx, rota POST /locations em artifacts/api-server/src/routes/areas-locations.ts), a pergunta "De
qual operação é este local?", que só aparece com mais de uma operação ativa.

Tarefa:
1. Leia as rotas de operação (routes/organization.ts, GET /operations, e onde a ativação e o checklist são
   implementados) e diga o que o checklist exige hoje, em português simples, antes de desenhar a tela.
2. Crie a tela de Operações dentro de Gestão (junto de Locais, Pessoas e acessos, Áreas): listar, criar,
   editar nome, ver o estado (rascunho, ativa, encerrada), ver quais locais pertencem a cada uma, e ativar
   mostrando o checklist com o que falta, item a item, em frase que explica a regra. Só a Administração
   cria, ativa e encerra; Direção só lê; Supervisão e Elenco não veem. Recusa com frase clara.
3. Ativar e encerrar pedem confirmação; encerrar é lógico e restaurável, com motivo escrito; toda escrita
   grava writeHistoryEvent na mesma transação. Nada de apagar.
4. Passe cada ação pelas 16 perguntas do crivo do AGENTS.md e traga no relato o que foi corrigido e o que
   depende de decisão. Confira especialmente: janela com rodapé (confirmar e cancelar) visível a 375 px,
   Esc fecha, texto vazio quando não há operação, e o que acontece com a operação que perde o último local.
5. Se precisar de migração: escreva o rollback em lib/db/drizzle/rollback/, registre no meta/_journal.json,
   aplique SÓ no banco de teste e avise a ordem (migração, depois API, depois site). Migração em produção é
   de quem constrói o app, não sua.
6. Testes da API no banco de teste (comandos no AGENTS.md; o banco é lento, espere). Teste a tela no
   navegador com a empresa de teste (docs/empresa-de-teste.md), com o perfil Administração e depois com
   Direção e Supervisão para ver as recusas. Verifique também a 375 px.

Não commite .env, não escreva senha nem segredo. Não envie nada ao GitHub.
```

---

## Etapa 2 — Gerar o mês rápido

**Feita em 18/10/2026 (local, sem migração; fechada por quem constrói o app depois do teste dela).** Gerar o mês foi de cerca de
350 para cerca de 50 idas ao banco por dia, com o mesmo resultado; local sem operação é avisado uma vez, não falha dia a dia; a
tela não espera para sempre por uma resposta que não vem (50 s por chamada, "Parar agora" aos 20 s, "Tentar de novo"). Os dias
continuam nunca em paralelo, por causa do equilíbrio do rodízio. Commits `9ad6b11`, `801b9df`, `2739b84`, `00349da`, `bf14d94`.
Como ficou e como medir: `docs/gerar-o-mes.md`. A Etapa 3 veio depois dela e não toca nenhum arquivo dela.

**Por quê:** gerar o mês leva cerca de 20 s por dia por local no banco de teste; três locais levaram cerca de
25 minutos. Em banco lento, silêncio vira clique repetido.

**Prompt:**

```text
Leia o AGENTS.md na raiz antes de qualquer coisa. Branch codex/myasa-novo; nunca merge na main; tudo em
português. O banco de teste é lento (5 a 12 s por escrita): meça com cuidado.

Problema: "Gerar o mês" (rota POST /escalas/mes/... em artifacts/api-server/src/routes/escalas.ts e o serviço
que ela chama, procure por gerarMes em services/) leva cerca de 20 segundos por dia por local no banco de
teste, porque cada Livro do Dia gerado passa por várias idas ao banco. Um mês de 3 locais (109 dias)
levou cerca de 25 minutos. A tela continua sozinha, então funciona, mas é lento demais.

Tarefa:
1. ANTES de mudar qualquer coisa, meça: quantas consultas por dia e por Livro, e onde o tempo vai (log de
   tempo por etapa). Mostre os números.
2. Reduza as idas ao banco: leituras que se repetem por dia viram uma só por mês ou por local; escritas em
   sequência viram em lote dentro da mesma transação; o que for independente roda em paralelo, sem passar
   de poucas conexões ao mesmo tempo (o pooler tem limite; a porta 6543 será usada em produção, veja
   .env.example). Não troque a regra de negócio nem o resultado gerado.
3. Garanta que continua valendo: motivo, Registro (writeHistoryEvent na mesma transação), rascunho
   restaurável, dia publicado nunca é tocado, e a retomada se o pedido cair no meio (idempotência).
4. Prove que o resultado é idêntico: gere o mesmo mês no banco de teste antes e depois e compare as Escalas
   e os Livros (mesmas pessoas nos mesmos blocos). Meça de novo e traga o antes e depois.
5. Passe pelas perguntas 14 e 9 do crivo: o que a pessoa vê enquanto espera, e o que acontece se a rede cair
   no meio.
6. Rode no banco de teste: escala-mes, escalas-dia, fase-c-escala-avisos e o que mais tocar.

Não rode nada em produção. Não commite .env. Não envie ao GitHub.
```

---

## Etapa 3 — Laços com espera no banco (ciclo por minuto e check-in)

**Feita, enviada e promovida em 18/10/2026 (sem migração; a conferência em produção fica para o teste final de quem constrói o app).** Antes e depois no banco de teste (empresa de teste, 6 locais):
`reconcileDueCheckIns` 36 s e 167 consultas → 4–5 s e 27; `reconcileShiftCheckIns` 34 s e 160 → 3,7 s e 25; lembrete do dia
2,8–3,7 s e 13 → 1,3–3,1 s e 7. O ganho maior veio de um laço que abria uma transação por minuto para cada turno de ontem já
fechado; agora uma leitura só separa os fechados. Paralelo limitado a 3 (`lib/em-paralelo.ts`); dentro do local, blocos e pessoas
seguem em fila para o Registro sair na mesma ordem. `autoPublishScales` e os avisos de folga ficaram em série de propósito. A
trava do ciclo não mudou. Teste novo: `ciclo-paralelo.test.ts` (igualdade, fechamento único e aviso único com dois ciclos juntos).
Medição repetível: `scripts/medir-laços-do-ciclo.ts`. Para rodar testes quando o pooler compartilhado estiver cheio, use `DB_POOL_MAX=4`.

**Por quê:** são 135 laços com leitura ou escrita dentro; os que montam a Escala inteira por local estão em
`checkin-reconcile.ts`, `operational-jobs.ts` (ciclo por minuto) e `shift-checkins.ts`. A "Minha escala" já foi
corrigida (4–5 s em vez de 10–12 s com 5 locais) e serve de modelo.

**Prompt:**

```text
Leia o AGENTS.md na raiz antes de qualquer coisa. Branch codex/myasa-novo; nunca merge na main; tudo em
português. Banco de teste lento: espere antes de concluir que algo travou.

Contexto: em 17/10/2026 a rota GET /escalas/minha e o /panel-indicators foram trocados de "montar local por
local em série" para "montar em paralelo" (veja o diff recente em artifacts/api-server/src/routes/escalas.ts
e routes/panel-indicators). Falta o mesmo padrão nos lugares que montam a Escala inteira por local dentro
de um laço com await: artifacts/api-server/src/services/checkin-reconcile.ts, operational-jobs.ts (roda
a cada minuto) e shift-checkins.ts.

Tarefa:
1. Liste os laços com await no banco nesses três arquivos e meça o tempo de cada um com 3 a 5 locais no
   banco de teste (a empresa fictícia da revisão de 17/10 tem 3 locais, veja docs/empresa-de-teste.md).
2. Troque série por paralelo limitado (poucas conexões por vez, o pooler é compartilhado) onde os itens são
   independentes; onde dependem um do outro, deixe em série e diga por quê. Resultado idêntico.
3. Cuidado com o ciclo por minuto: não pode haver duas execuções ao mesmo tempo (veja a trava
   pg_try_advisory_xact_lock em routes/internal.ts) nem aviso duplicado ("um por acontecimento, não um por
   clique", crivo 4).
4. Traga o antes e depois em tempo e em número de consultas, e rode: fase-c-meu-dia, escalas-dia, os testes
   de check-in (procure em artifacts/api-server/tests) e o ciclo operacional.

Não rode em produção. Não commite .env. Não envie ao GitHub.
```

---

## Etapa 4 — Gravação atômica (lote da Escala e edição de pessoa)

**Feita, enviada e promovida em 18/10/2026 (sem migração; a conferência em produção fica para o teste final de quem constrói o app).** O lote de `POST /escalas/dia/ajustes` é conferido inteiro e depois gravado numa transação só (o Livro do Dia, o ajuste, o Registro e os avisos dentro dela; os eventos do Livro só depois do commit). A edição de pessoa passou a ser `PUT /users/:id/cadastro`: nome, área e perfil numa transação, um evento no Registro, aviso à pessoa e "Desfazer" na tela. **Decisões da conversa:** só a Administração edita o cadastro; o e-mail **não** passa por essa rota, porque a casa usa e-mails pessoais e cada pessoa muda o seu no Perfil (a rota recusa e-mail com essa frase). Testes novos em `escalas-dia` e `fase-e-cadastro`; `permission-matrix` e `fase-d-seguranca` seguem verdes. Conferido no navegador com a empresa de teste (editar e desfazer) e a 375 px. Não há teste para uma falha no meio da gravação: a garantia vem de ser uma transação só. Commit `fb26edd`.

**Por quê:** o ajuste em lote confere tudo antes de gravar, mas não é uma transação única; e a edição de pessoa
vai em três chamadas (nome e e-mail, área, perfil). Hoje a tela só avisa o que já ficou salvo.

**Prompt:**

```text
Leia o AGENTS.md na raiz antes de qualquer coisa. Branch codex/myasa-novo; nunca merge na main; tudo em
português.

Problema 1 (Escala): POST /escalas/dia/ajustes em artifacts/api-server/src/routes/escalas.ts confere todas as
pessoas do lote antes de gravar (parâmetro soConferir de ajustarUmaPessoa), mas grava uma a uma; uma falha
inesperada no meio deixa parte gravada. O motivo: ajustarPessoaNoLivro (routes/daily-book.ts) abre a própria
transação via mutateDailyBook e emite eventos depois.
Problema 2 (Cadastros): artifacts/web-admin/src/pages/cadastros.tsx edita a pessoa com PATCH /users/:id +
PUT /users/:id/operational-scope + PUT /users/:id/perfil; se a terceira falha, a pessoa fica meio salva (a
tela hoje só diz o que ficou salvo).

Tarefa:
1. Escala: faça o lote inteiro numa transação só (passe o tx adiante, inclusive para o Livro do Dia), com os
   eventos (eventBus) emitidos só depois do commit e o Registro gravado dentro. Um "não" em qualquer pessoa
   desfaz tudo. A resposta de erro continua com frase clara e a grade como ficou.
2. Cadastros: crie uma rota única para editar a pessoa (nome, e-mail, área, perfil e o motivo da troca de
   perfil) que valide tudo e grave numa transação, com writeHistoryEvent. Troque a tela para usá-la. Mantenha
   as rotas antigas funcionando.
3. Crivo: quem pode (Supervisão só pessoa da própria área; recusa com frase), aviso a quem precisa saber
   (mudança depois de publicada avisa a Administração para republicar, um aviso por acontecimento), desfazer.
4. Testes novos: lote com a terceira pessoa inválida não grava ninguém; edição de pessoa com perfil inválido
   não muda nome nem área. Rode escalas-dia, permission-matrix, fase-d-seguranca e os testes de cadastro.
   Confira a tela no navegador (modo ?amostra=1 e com servidor da empresa de teste), também a 375 px.

Se tocar em escalas.tsx e houver outra sessão mexendo nele, use um worktree próprio. Não rode em produção.
Não commite .env. Não envie ao GitHub.
```

---

## Etapa 5 — Celular: grade por pessoa, menu "Mais" e botão da ASA

**Feita, enviada e promovida em 18/10/2026 (só no site, sem migração; a conferência no celular de verdade e no computador fica para o teste final de quem constrói o app).** "Por pessoa" no celular (até 640 px) virou um cartão por pessoa, com os blocos em ordem de horário, "Ajustar" em cada um (respeitando a área de quem edita; a Direção só lê) e o aviso quando o bloco cruza com outro. O rodapé da Escala guarda Folga, Registrar troca, Regras do local, Gerar o mês e Atividade só de hoje no menu "Mais" (Esc, setas, alvo de 44 px; no celular é uma folha acima da barra de baixo, com "Fechar"); a ação principal fica sozinha, à direita. **Decisão da conversa:** o menu vale também no computador, não só no celular. O botão da ASA ganhou 12 px de respiro do sino. Crivo: os diálogos "Novo bloco" e do molde da Programação não tinham "Cancelar" e agora têm, com "Salvando…"; o cabeçalho da data estourava 3 px a 375 px e foi corrigido. Conferido a 375 px com `adm`, `sup`, `dir` e `mem`; tipos, build e `verificar-nomes-build.mjs` passam. Não reconferido na tela: Esc dos diálogos da Programação e o desktop.

**Por quê:** o Elenco usa o app no celular. A grade "Por pessoa" mostra 1,3 pessoa por tela com 24 colunas; o
rodapé da Escala tem seis botões; o botão da ASA fica a 7 px do sino.

**Prompt:**

```text
Leia o AGENTS.md na raiz antes de qualquer coisa. Branch codex/myasa-novo; nunca merge na main; tudo em
português. Toda tela que o Elenco vê se confere a 375 px de largura (crivo 3).

Contexto: em 17/10/2026 a Escala passou a abrir "Por atividade" em tela estreita e o rodapé de ações foi
reordenado (ação principal por último, à direita). Falta (arquivo principal: artifacts/web-admin/src/pages/
escalas.tsx; o botão da ASA é global-asa-launcher):
1. Grade "Por pessoa" no celular: cabe 1,3 pessoa por tela, coluna de 170 px, cabeçalho em 3 linhas. Desenhe
   uma versão para telefone (por exemplo, uma pessoa por cartão com seus blocos, ou a grade com a coluna da
   pessoa fixa e células legíveis) sem perder a edição.
2. Rodapé de ações da Administração: Folga, Troca, Regras do local e Gerar o mês vão para um menu "Mais"
   (acessível, com Esc, alvo de toque de 44 px, sem ficar atrás do teclado nem da barra de baixo). A ação
   principal fica sempre visível e por último.
3. Botão da ASA: mais respiro do sino no cabeçalho do celular e sem cobrir ação importante.
4. Passe tudo pelas 16 perguntas do crivo (rodapé com confirmar e cancelar em toda janela, vazio explicado,
   Esc fecha).

Teste no navegador: ?amostra=1 e sessionStorage["myasa-review-role"] (adm/sup/dir/mem) para trocar o perfil;
redimensione para 375 px e confira cada perfil, com captura de tela. Rode os tipos e o build do site, e o
verificar-nomes-build.mjs (dados de exemplo com nomes de gente só dentro de import.meta.env.DEV). Se outra
sessão estiver em escalas.tsx, use worktree próprio. Não commite .env. Não envie ao GitHub.
```

---

## Etapa 6 — Hora do cartão do Livro do Dia pela Programação

**Feita, enviada e promovida em 18/10/2026 (API e site, sem migração; a conferência no celular de verdade fica para o teste final de quem constrói o app).** A geração do Livro do Dia grava na Agenda a primeira hora que a Programação dá ao show naquele dia (no evento novo e no que estava sem hora; hora que já existe nunca é apagada). A lista devolve `horarios`: as horas da Programação, de modo que um show com 10:30 e 15:00 aparece como "10:30 · 15:00", igual à Escala; sem Programação, a hora da Agenda; sem ela, as sessões do Livro do Show. Cartão, linha da lista e cabeçalho usam a mesma regra, e show sem hora em lugar nenhum diz isso em frase, em vez de um traço mudo. Livro de sessão separada segue com a hora da própria sessão. Commit `7561f3d`.

**Por quê:** o cartão do Livro mostra "—" quando o show não tem sessão no Livro do Show, porque a geração não
grava na Agenda a hora dos blocos da Programação (e um mesmo Livro pode ter 10:30 e 15:00).

**Prompt:**

```text
Leia o AGENTS.md na raiz antes de qualquer coisa. Branch codex/myasa-novo; nunca merge na main; tudo em
português.

Problema: no Livro do Dia (artifacts/web-admin/src/pages/livro-do-dia.tsx e artifacts/api-server/src/routes/
daily-book.ts), o cartão de cada Livro mostra a hora "—" quando o show não tem sessão cadastrada no Livro do
Show. A geração do Livro do Dia não grava na Agenda a hora dos blocos da Programação. Decisão da Babi
(17/10/2026): o Livro do Dia lê a Programação; as sessões continuam existindo porque a formação da 1ª e da
2ª sessão pode ser diferente. Já existe horariosDoShowNaProgramacao em services/escala-dia.ts e o campo
programacaoHoje na resposta de GET /daily-book/:id; a lista do Livro já usa isso quando não há sessões.

Tarefa:
1. Faça a geração do Livro do Dia gravar na Agenda a primeira hora da Programação para o show naquele dia
   (sem apagar hora que já exista), e o cartão listar as demais horas ("10:30 · 15:00").
2. Dia com dois horários do mesmo show: o cartão e a Escala dizem a mesma coisa. Dez Livros do mesmo dia
   precisam continuar diferenciáveis (hora e local, crivo 12).
3. Vazio explicado: show sem horário na Programação e sem sessão diz isso em frase.
4. Teste no banco de teste (fase-c, escalas-dia, os de Livro do Dia) e no navegador com a empresa de teste.
   Confira o Elenco a 375 px.

Se precisar de migração: rollback em lib/db/drizzle/rollback/, registro no _journal.json, aplicar SÓ no banco
de teste, avisar a ordem. Não rode em produção. Não commite .env. Não envie ao GitHub.
```

---

## Etapa 7 — Estilo, formato de erro e arremates

**Feita, enviada e promovida em 18/10/2026 (sem migração; a conferência visual a 375 px e 1280 px nos quatro perfis fica para o teste final de quem constrói o app).** Três commits, um por parte. **Estilo** (`32d5a91`): cerca de 130 tokens `--asa-*` no `index.css`; 679 cores fixas trocadas em Meu Dia (35), Escala (369) e Livro do Dia (266); `operational-cycle.css` deixou de ser uma linha só. Ficaram como hex de propósito o branco puro das listras da Escala, o `#3c3559` do Livro (difere de `--asa-ink-medium` em um dígito; preservado para não mudar a aparência) e os valores de 8 dígitos da sombra do mapa de palco. **Formato de erro** (`694359c`): `{error: CODIGO, message: frase}` com `ACESSO_NEGADO`, `NAO_ENCONTRADO`, `CAMPOS_INVALIDOS`, `ERRO_INTERNO`, `ESTADO_INVALIDO` e `CONFLITO`, nas rotas da Escala e da Programação, do Livro do Dia, de Operações e de Áreas e Locais; o cliente já lia `message` primeiro. **Falha que parecia vazio** (`595fa12`): em `shows.tsx` e `operational-cycle.tsx` só o 403 esperado fica em silêncio; qualquer outra falha chega à frase "Não consegui carregar...". Passaram `escalas-dia` (91), `permission-matrix` (463) e `fase-d-seguranca` (53), tipos, build e `verificar-nomes-build.mjs`. **Não consta nos commits:** a revisão do campo `decided_by` do pedido de folga que entra como prioridade, pedida no fim da parte 3; segue em aberto até a sessão da etapa dizer a intenção.

**Por quê:** Meu Dia, Escala e Livro do Dia são quase todo estilo inline com cores fixas; as rotas respondem
erro em formatos diferentes; algumas telas transformam falha em lista vazia.

**Prompt:**

```text
Leia o AGENTS.md na raiz antes de qualquer coisa. Branch codex/myasa-novo; nunca merge na main; tudo em
português. Esta etapa não muda comportamento: só organização. Se uma mudança alterar o que a pessoa vê,
pare e pergunte.

Tarefa, em três partes, cada uma num commit próprio:
1. Estilo: Meu Dia (pages/meu-dia.tsx), Escala (pages/escalas.tsx) e Livro do Dia (pages/livro-do-dia.tsx)
   usam estilo inline (css("...")) com cores fixas (#6b6482, #e6e1f2, #1b1630...) em vez dos tokens do
   artifacts/web-admin/src/index.css; o pages/operational-cycle.css é uma linha só de cerca de 10 KB.
   Troque as cores fixas pelos tokens (crie os que faltarem) e quebre o CSS em linhas legíveis. Confira lado
   a lado, antes e depois, em 375 px e 1280 px, nos perfis adm/sup/dir/mem: nada pode mudar de aparência.
2. Formato de erro: as rotas respondem {error} ou {error, message}. Defina um formato único
   ({error: CODIGO, message: frase para a pessoa}), aplique primeiro às rotas da Escala, Programação, Livro
   do Dia e Cadastros, e faça o cliente (customFetch/errMsg) ler message primeiro. Os testes que checam
   texto de erro devem ser atualizados junto.
3. Falha que parece "vazio": pages/shows.tsx e operational-cycle.tsx transformam falha em lista vazia
   (.catch(() => fallback)). Onde a falha for do servidor, mostre "não carregou, tente de novo"; onde for
   recusa esperada (403 do Elenco), deixe como está. Também revise o campo decided_by do pedido de folga que
   entra como prioridade (hoje é a própria pessoa que pediu) e diga qual é a intenção antes de mexer.

Rode tipos e build do site, o verificar-nomes-build.mjs e os testes da API tocados (escalas-dia,
permission-matrix, fase-d-seguranca). Não commite .env. Não envie ao GitHub.
```

---

## Etapa 8 — Conferência final e ordem de promoção

**Por quê:** fechar com a bateria inteira e deixar claro o que a Babi e quem constrói o app precisam fazer.

**Prompt:**

```text
Leia o AGENTS.md na raiz e o último handoff em docs/ antes de qualquer coisa. Branch codex/myasa-novo; nunca
merge na main; tudo em português. Em produção, só leitura.

Tarefa:
1. Rode a bateria inteira de testes da API no banco de teste (um arquivo por vez, em segundo plano; o
   asa-actions-http leva cerca de 25 minutos), os tipos da API e do site, o build do site e o
   verificar-nomes-build.mjs. Conte o que passou, o que falhou e o que não rodou, sem arredondar.
   Falhas que JÁ existiam antes da etapa 2 (conferidas em 18/10/2026 no código de 65a5513, sem a etapa 2) e
   que a conferência final precisa decidir uma a uma (corrigir, ajustar o teste ou abrir issue; hoje só a
   primeira tem issue):
   - restricao-horario: "Livro do dia de show misto: a hora vem da sessão não separada" (veio 17:30 em vez de
     17:00); causa provável é o próprio teste pegar o Livro de apoio. Issue #2 no GitHub.
   - asa-capabilities: "confirmação da checklist deve ter ramo transacional próprio" (teste que lê o código; pode
     ter ficado velho com a mudança do checklist de ativação, etapa 1).
   - fase-e-ciclo: estoura o tempo ("TimeoutError") rodando sozinho.
   - folgas-equipe: a limpeza do teste não consegue apagar usuários (chave estrangeira).
   - mensagens-grupos: "Abrir a conversa marca como lido o aviso dela no sino".
   - shift-checkins: espera a mensagem "janela" e recebe "O check-in do turno Dia ainda não abriu: abre às
     08:00" (depende da hora do dia em que roda).
   Na bateria inteira de 18/10 outros sete arquivos falharam uma vez e passaram rodando sozinhos (token 401,
   "max clients reached" no banco de teste): se repetir, rode a bateria sem outra sessão usando o banco de teste
   ao mesmo tempo.
2. Refaça no navegador, com a empresa de teste (docs/empresa-de-teste.md), o roteiro de cada perfil
   (Administração, Direção, Supervisão, Elenco) a 375 px e 1280 px: Meu Dia, Escala, Livro do Dia, Painel,
   Cadastros (incluindo Operações e Locais), Tarefas. Traga captura de tela e as 16 perguntas do crivo
   respondidas, separando o corrigido do que depende de decisão da Babi.
3. Atualize o AGENTS.md (seção "Estado em ...") e escreva docs/handoff-<data>-sessao-N.md com o que mudou, o
   que ficou, e a ordem de promoção: migrações em ordem, depois a API, depois o site; e a troca da porta do
   banco para a 6543 (DATABASE_URL da Vercel e do teste; migrações seguem na 5432). Quem roda migração e
   script em produção é quem constrói o app, não a Babi.
4. Liste o que a Babi precisa conferir no telefone e o que depende do "pode enviar" dela (push e promoção).

Não envie nada ao GitHub, não rode nada em produção, não commite .env.
```
