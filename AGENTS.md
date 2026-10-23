# Como trabalhar neste repositório

Este arquivo vale para qualquer assistente que abrir o projeto (Codex, Claude, outro). Ele não
descreve a arquitetura — isso está em `docs/` — e sim **como a dona do produto quer que o trabalho
seja feito**. Foi escrito a partir de meses de trabalho junto com ela.

O My ASA é o app que a Arts and Sports Academy usa para a escala do dia, o livro de cada show, as
folgas e a comunicação do elenco. Quem usa são pessoas reais, num parque, no dia do show. Um erro
aqui não é um teste vermelho: é alguém que não aparece no show, ou que trabalha na própria folga.

## Idioma e tom

- **Sempre em português do Brasil**, inclusive nos comentários do código, nas mensagens de commit e
  nos textos da interface.
- Escreva como gente fala. Nada de "otimizar o fluxo" ou "melhorar a experiência": diga o que muda
  para quem usa. Os textos da interface explicam a regra, não o botão.
- Nas mensagens de commit, conte **o que estava errado e por quê a mudança resolve**, em prosa. Elas
  são longas de propósito — alguém vai lê-las daqui a um ano para entender uma decisão.

## O crivo das "coisinhas"

Ao mexer ou revisar qualquer tela, passe cada ação por três perguntas. Foi assim que apareceram os
problemas que mais incomodavam no uso real:

Cada pergunta abaixo nasceu de um defeito real encontrado no uso, e está anotada com ele. Não é
formulário: é a lista do que já escapou antes.

### Quem usa

1. **Serve para várias pessoas (ou vários dias) de uma vez?**
   *Pegou:* a atividade manual da Escala só aceitava uma pessoa por vez; o bloco novo da Programação
   valia para um único dia da semana, obrigando a repetir a mesma digitação cinco vezes; o ajuste de
   célula ia de uma pessoa por vez, cada uma com sua ida ao servidor.
2. **Quem pode fazer isso — e quem não pode recebe um "não" que explica?**
   *Pegou:* supervisão ajustando pessoa de outra área; Direção que só lê; Elenco que não resolve
   folga de ninguém. Recusa sem frase clara vira "o app está quebrado".
3. **Funciona no telefone?**
   *Pegou:* na Minha escala, "Livro do Dia publicado" quebrava uma palavra por linha. O Elenco usa o
   app no celular, não no computador — toda tela que o Elenco vê se confere a 375px de largura.

### Quem precisa ficar sabendo

4. **Quem precisa saber disso, e como fica sabendo?**
   *Pegou:* mudança depois de publicada que não avisava ninguém; pessoa chamada na própria folga sem
   receber aviso; Administração que só descobria se abrisse a tela. Aviso no sino, e um por
   acontecimento — não um por clique.
5. **Entrou no Registro, com o porquê?**
   Toda escrita grava `writeHistoryEvent` na mesma transação. Quando a ação é exceção (chamar na
   folga, reabrir dia fechado, tirar do molde), o motivo escrito vai junto.
6. **Depois de publicado, o que muda sozinho e o que espera republicação?**
   *Pegou:* o Elenco via a troca antes de a Administração republicar. A versão publicada é o que vale
   para quem faz; a mudança espera a republicação, e a Administração é avisada de que há o que
   republicar.

### Quando dá errado

7. **Dá para desfazer?**
   *Pegou:* "tirar do molde" sumia com o bloco sem perguntar e sem jeito de trazer de volta. Remoção
   é lógica, restaurável e visível — e o que é irreversível (marcar executado) pergunta antes.
8. **Se der errado, a mensagem diz a verdade?**
   *Pegou:* a tela de entrada dizia "usuário ou senha não conferem" quando o servidor falhava, e a
   pessoa revisava a própria senha dez vezes atrás de um problema que não era dela.
9. **Falha de rede ou servidor derruba o trabalho?**
   *Pegou:* a renovação do acesso apagava a sessão em qualquer erro — a pessoa ia parar no login no
   meio do trabalho, com a credencial ainda válida. Só a recusa do servidor encerra a sessão.
10. **O que aparece quando está vazio, ou é a primeira vez?**
    *Pegou:* show sem vagas gera Livro do Dia vazio — a tela precisa dizer que falta o cadastro, não
    só mostrar nada. Vazio explicado não é defeito; vazio mudo é.

### O caminho até ali

11. **Dá para chegar? Em que dia e em que local a tela abre?**
    *Pegou:* o Livro do Dia só mostrava hoje, então quem prepara o dia seguinte não alcançava; abria
    no show das 10h já executado às 18h; a Escala abria sempre no primeiro local da lista.
12. **Dá para diferenciar uma linha da outra?**
    *Pegou:* dez Livros do mesmo dia em linhas quase idênticas — sem hora, e com a operação no lugar
    do local, o "Musical" de Snowland e o de Acquamotion ficavam iguais.
13. **O texto acompanha o contexto?**
    *Pegou:* "shows na agenda de hoje" continuava escrito enquanto a tela mostrava amanhã.

### Enquanto acontece

14. **O que a pessoa vê enquanto espera, e quando termina?**
    *Pegou:* publicar respondia certo e a tela seguia dizendo "Rascunho"; o botão "Gerar" ficava mudo
    por vinte segundos. Em banco lento, silêncio vira clique repetido.
15. **Dá para sair sem salvar?**
    *Pegou:* os diálogos não fechavam com Esc, só no ×. No telefone, com o teclado aberto, o × fica
    escondido.
16. **Toda janela e todo formulário tem rodapé com a ação de confirmar (e a de cancelar)?**
    *Pegou:* em Escalas → Programação, o "ajustar" no horário do bloco "Boas-vindas" abria sem
    rodapé: dava para mexer no horário, mas não havia botão para salvar nem para desistir. Confira
    **toda** janela, painel e formulário: se a pessoa altera algo, tem que existir o botão que confirma
    e o que cancela, visíveis também a 375 px (no telefone o rodapé não pode ficar escondido atrás do
    teclado nem da barra de baixo). Janela sem rodapé é defeito mesmo quando "funciona".
17. **Todo link, atalho e resultado leva a uma tela que existe — e à coisa que a pessoa tocou?**
    *Pegou (revisão 4):* todo resultado da Busca apontava para `/admin/search?...`, endereço que nenhuma tela
    atende desde que o shell novo entrou; o shell manda para o Meu Dia o que não conhece, então a pessoa tocava
    numa data ou num documento e caía no Meu Dia, sem erro nem explicação. Ninguém percebeu porque a Busca
    "funcionava" (listava certo). Ao mexer em rotas, procure no servidor e nas telas todo `href` e
    `actionUrl` gerado e confira que cada um abre uma tela viva; no celular, confira também que a gaveta ou
    a janela de onde a pessoa saiu fechou.
18. **A recusa e o erro falam a língua de quem lê?**
    *Pegou (revisão 4):* toda rota protegida por perfil respondia "Role DIR is not authorized for this resource",
    e valor fora da lista respondia 500 "Erro ao criar linha". A Direção lia isso como "o app quebrou". A frase
    diz quem pode fazer e qual é o perfil de quem tentou; erro de dado que a pessoa digitou é 400 com a lista do
    que vale, nunca 500. Id quebrado na URL é 404 com frase (`exigirUuidNosParametros`).

19. **E se duas pessoas mexerem na mesma coisa ao mesmo tempo — e o "não" diz o motivo de verdade?**
    *Pegou (revisão 4):* editar uma publicação do Mural, ou um bloco da Programação, sobre uma versão velha apagava, em
    silêncio, a mudança que a outra pessoa tinha acabado de salvar. O conserto (a tela manda a versão que abriu, o servidor
    recusa com 409 e uma frase) ainda tinha um furo que só apareceu com dois navegadores abertos: o rodapé do editor
    trocava a frase do servidor por "Não consegui salvar… tente de novo", e a pessoa lia como falha de rede. Toda edição de
    algo que mais de uma pessoa mexe confere a versão, e a frase da recusa chega até quem salvou.

Erro aparece no teste; isso aqui só aparece se alguém perguntar. Traga as duas coisas juntas no
relato, separando o que já foi corrigido do que depende de decisão dela. Quando uma pergunta nova
pegar um defeito, acrescente-a aqui com o caso — a lista cresce pelo que acontece, não pelo que se
imagina.

## Regras que não se quebram

- **Quem autoriza é quem constrói o app** (a pessoa que conversa com o assistente), não a Babi. O "pode enviar"
  (push, deploy, produção) é dela; a Babi só é consultada para regra de negócio que essa pessoa não sabe, e o
  assistente não pede confirmação à Babi nem a cita como quem libera.
- **Migração em produção é de quem constrói o app**, não do assistente. O assistente aplica migrações **só no banco de teste**.
  Ao criar uma migração, escreva também o rollback em `lib/db/drizzle/rollback/` e registre no
  `meta/_journal.json`. Avise a ordem: migração primeiro, promoção depois.
- **Nunca commite `.env*`** (estão no `.gitignore`) e **nunca escreva senha, token ou segredo** em
  arquivo do repositório, em log ou na conversa.
- **Nada de apagar dado real.** Remoção é lógica (`active: false`, `isRemoved`), sempre restaurável.
- **Toda escrita grava no Registro na mesma transação** (`writeHistoryEvent`), com o porquê quando a
  ação pede motivo.
- **Teste a tela antes de dizer que está pronta.** Abrir, clicar, conferir o resultado — não basta o
  `tsc` passar. Em produção, só leitura; escrever lá exige pedir antes.
- **Branch `codex/myasa-novo`.** Nunca faça merge na `main` por conta própria.
- Perfis: Administração publica o dia; Supervisão cuida da própria área; Direção só lê a operação
  (escala, livro, folgas), **mas interage no Mural e nas Mensagens como a Administração** (publica,
  edita e cancela aviso, reconhece, conversa) — decisão de 14/10/2026 — **e também na Agenda e nas Tarefas** (marca, confirma, remarca e cancela compromisso; prepara lote, adiciona participante e cancela tarefa) — decisão de 15/10/2026 — **e cria, vê e cobra tarefas e pedidos às responsabilidades** (decisão de 16/10/2026; o Elenco também cria tarefa para qualquer pessoa, e a Supervisão vê e cobra as da própria área). **Operações (cadastro, 17/10/2026): a Direção só lê; criar, ativar, encerrar e dar acesso é da Administração; Supervisão e Elenco não veem a tela** (`docs/operacoes-cadastro.md`). Biblioteca continua só leitura para a Direção (ela vê quem leu, mas não publica nem edita); Elenco vê o que é dele. Quando
  uma tela nova tiver exceção para a Direção, anote aqui. Folga vence a escala — só entra quem foi
  chamado de propósito, com motivo escrito.

## Comandos que funcionam nesta máquina (Windows, PowerShell, pnpm)

O `pnpm` daqui não resolve os binários pelos atalhos; use os caminhos abaixo.

```powershell
# tipos (api-server e web-admin)
node ../../node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/bin/tsc -p tsconfig.json --noEmit

# build da API (artifacts/api-server)
node ./build.mjs

# build do site (artifacts/web-admin) — PORT e BASE_PATH são obrigatórios
$env:PORT="3000"; $env:BASE_PATH="/"; node ../../node_modules/.pnpm/vite@<versão>/node_modules/vite/bin/vite.js build --config vite.config.ts

# o Vercel roda ISTO logo depois do build e reprova se achar nome de pessoa do elenco no pacote (regra D1).
# Rode sempre que mexer em tela com dados de exemplo; só o build passar não basta.
node scripts/verificar-nomes-build.mjs

# testes da API, contra o banco de TESTE (artifacts/api-server)
$env:MYASA_TEST_RUNNER="1"; $env:TEST_FILE="escalas-dia.test.ts"
node --env-file=../../.env.test ./tests/run-tests.mjs

# migração no banco de teste (lib/db)
node --env-file=../../.env.test ../../node_modules/.pnpm/tsx@<versão>/node_modules/tsx/dist/cli.mjs src/migrate.ts
```

Dados de exemplo com nomes de gente **só podem ser criados dentro de `import.meta.env.DEV`** (ou de uma
constante que o build resolve, como `sample`). Passar `sample` como parâmetro de componente não basta: o
bundler não descarta o que está atrás dele, e os nomes vão para o navegador de todo mundo.

Depois de mexer no schema (`lib/db/src/schema`), compile o pacote do banco antes de checar os tipos
da API — ela lê os `.d.ts` gerados: `node ../../node_modules/.pnpm/typescript@5.9.3/.../tsc -p tsconfig.json`
dentro de `lib/db`.

O banco de teste é lento (uma escrita leva de 5 a 12 segundos). Suíte parecendo travada costuma ser
só isso; não conclua que quebrou antes de esperar.

## Onde fica cada coisa

- `artifacts/api-server` — Express + Drizzle. Rotas em `src/routes`, regra de negócio em
  `src/services`. A Escala do dia é montada na leitura por `services/escala-dia.ts`.
- `artifacts/web-admin` — Vite + React. Uma tela por arquivo em `src/pages`, sem submódulos.
  `?amostra=1` abre qualquer tela com dados de exemplo, e `sessionStorage["myasa-review-role"]`
  (`adm`/`sup`/`dir`/`mem`) troca o perfil — é assim que se revisa sem entrar com conta de ninguém.
- `lib/db` — schema, migrações e rollbacks.
- `docs/` — decisões e desenho das telas.

## Estado em 15/10/2026 (depois da revisão das telas)

**Atualização de 17/10/2026 (revisão de ponta a ponta com empresa fictícia):** pronta só de área com gente ou supervisão no local; Supervisão vê e cobra as tarefas da própria área (sem a responsabilidade "Aprovação de tarefas"); Livro do Dia lê os horários da Programação; ajuste em lote conferido antes de gravar; cadastro de local pergunta a operação quando há mais de uma ativa; Painel com quatro números distintos; banco de produção na porta 6543 (migrações seguem na 5432; as migrações da 0000 à 0074 estão aplicadas em produção (a 0075, limite de tentativas de senha, aplicada em produção em 20/10); a 0074, do formato do palco no show, foi promovida depois, com a API e o site, e o mapa e as formações já aparecem para o elenco). Os commits foram enviados à `codex/myasa-novo` (nada na `main`). O que falta está em `docs/plano-etapas-pos-revisao-2026-10-17.md`, em oito etapas com prompt pronto (a 1, cadastro de operações, é a importante).

Pronto e em produção: Escala do dia, Programação (com rascunho e rodapé), Livro do Dia, check-in por turno,
Meu Dia, Folgas em lote e grupos de folga, Gerar o mês, **Mural aberto** (o Elenco publica, edita, remove e
desfaz, reações, datas especiais) e **Mensagens com grupos** (privadas: a Administração não lê conversa),
com o elenco de Snowland carregado e gerando o dia de verdade. O último handoff é
`docs/handoff-2026-10-19.md` (19/10: revisão completa de todos os perfis, permission-matrix limpo): leia antes de continuar.

**Feito em 16/10 (ainda local, nada enviado ao GitHub nem promovido; 3 migrações só no banco de teste, 0067 a 0069):** a
Etapa 3 de folgas (pedido analisado pela Supervisão da área, troca com colega de folga, mediação, regras configuráveis), a
aba Grupos antiga retirada do menu e o mapa de revisão em `docs/mapa-de-revisao.md`. **Quem roda migração e script em
produção é quem constrói o app (não a Babi).** Ordem para promover: migrações 0067, 0068, 0069; depois a API; depois o site.

**Feito em 17/10 (local, nada enviado; migrações 0072 e 0073 só no banco de teste):** tarefas em etapas (fila ou solta, aprovação como etapa, link do Drive, lembretes), pedidos às responsabilidades e lista fixa com repetição. Resumo e regras em `docs/tarefas-e-responsabilidades.md`. **Ordem para promover: 0072, 0073, depois a API, depois o site.** Quem roda em produção é quem constrói o app.

Feito em 15/10 (**ainda local: nada enviado ao GitHub nem promovido**, sem migração): a revisão com o crivo em
Agenda, Tarefas, Cadastros, Painel e Biblioteca, as decisões da Babi (Direção na Agenda e nas Tarefas, cancelar e
remarcar, ensaio na folga com motivo, avisos e "quem já leu" na Biblioteca, lotes, push web de mensagem) e a
**empresa de teste** (`docs/empresa-de-teste.md`): use-a para conferir telas com servidor de verdade.

**Feito em 18/10, sessão 1 (nenhum código alterado; só build, tipos, testes e revisão parcial de telas):**
`tsc`, build e D1 limpos. Bateria da API rodada contra o banco de teste (resultado parcial: `permission-matrix`
com 1 falha de autorização — rerrun zerou, era transitória; `daily-book-session-blocks` com 4 falhas por
EMAXCONNSESSION + teste de rollback; demais arquivos vistos: OK). Revisão de telas feita só com perfil ADM a
375px: achados em `docs/handoff-2026-10-18-sessao-1.md`.

**Feito em 18/10, sessão 2:** Livro do Dia corrigido — cartões aparecem logo após a lista chegar (detalhes
carregam em fundo, sem travar o header em "carregando…"); removido "em 13 Shows" hardcoded da mensagem de livro
sem cenas. `tsc` limpo após as mudanças.

**Feito em 19/10 (Etapa 8 — conferência final):** revisão de telas no modo amostra com `sessionStorage["myasa-review-role"]`
para todos os quatro perfis (ADM, DIR, SUP, MEM) a 375px e 1280px — Meu Dia, Escala, Livro do Dia, Painel, Operações, Locais,
Tarefas. `permission-matrix` rerodado: 463/463 rotas sem auth + 25 cases de autorização real = 0 falhas. Nenhum código
alterado. O último handoff é `docs/handoff-2026-10-19.md`; leia antes de continuar.

**Feito em 20/10/2026 (revisão 3, revisão 4 e fechamento; tudo enviado ao GitHub até `565788d` e promovido em produção no mesmo dia: migração 0075, API e site, nessa ordem, e o teste nas 4 contas sem frase de erro, por quem constrói o app):** a rodada 3
voltou ao branch; R3-B, R3-D e R3-E fechadas; Livro do dia de show misto não herda a hora da sessão separada; id inválido na URL
dá 404 com frase (`exigirUuidNosParametros`); Registro, recusas em português, Busca, Mural, Cadastros, Folgas (revisão 4). Depois do
"pode enviar" de 20/10: **limite de tentativas de senha (migração 0075, já aplicada em produção; o limite só vale quando a API nova for promovida)**, restaurar
documento arquivado da Biblioteca, Direção lê as versões e Supervisão vê os temas sem documento, conferência de versão nos
blocos da Programação, "(local encerrado)" no cartão da Área, 114 telas mortas tiradas do site. **Em produção desde 20/10: a migração 0075, a API e o site.** Tudo está em `docs/handoff-2026-10-20-fechamento.md`: leia antes de continuar.
Decisões já tomadas (não reabrir): **Supervisão da área que só tem local encerrado vale como "área sem Supervisão"** (a Administração
decide na hora); **Mural continua aberto**; **a "grade pessoa × dia" e a Etapa 4 (experimentar grupos) foram descartadas até o primeiro
mês real mostrar desequilíbrio** (a Babi só confirma). Sem tela e sem pedido: desativar formação (só a API).

Pendente:
- **Bateria completa de testes:** rodada em 20/10 depois de tudo, **76 de 76 verdes** (ver `docs/handoff-2026-10-20-fechamento.md`). Rode-a de novo antes de cada promoção.
- **Verificador de fora (Better Stack) criado em 22/10/2026** pela pessoa que constrói o app, olhando `https://my-asa.vercel.app/api/saude` a cada 3 minutos e avisando por e-mail; o e-mail de teste chegou. **Alerta de erros (Sentry) ligado em 23/10/2026** (`SENTRY_DSN` na API e `VITE_SENTRY_DSN` no site, em Production; a chave do site está no pacote, conferido de fora; a API subiu em dia). **Backup: o Supabase está no plano grátis e NÃO guarda backup automático** (confirmado em 23/10/2026). Caminho B (decisão de quem constrói o app): backup manual com `lib/db/scripts/backup-producao.ts` e restaurador `restaurar-backup.ts`, testados no banco de teste (`docs/backup-e-restauracao.md`); **o primeiro backup em produção foi feito e conferido em 23/10/2026** (116 tabelas, 2.009 linhas, 77 migrações; guardar uma segunda cópia fora do computador). Rode um por semana e sempre antes de mexer em produção. O plano pago será decidido com a Cris (`docs/para-a-cris-o-que-vale-pagar.md`).
- **A Babi confirma duas regras** (a decisão já está aplicada como recomendado): a Supervisão só com local encerrado; descartar "grade pessoa × dia" e grupos experimentais.
- **Limpeza do texto de mensagens no registro: não há o que limpar** (conferido em produção em 23/10/2026: 0 linhas na ASA e 0 no Registro; a tabela de mensagens está vazia). Os dois scripts `limpar-texto-...` ficam sem uso e **não devem ser rodados**. **Issues e rótulos do GitHub não esperam por isso** (decisão de 16/10/2026).
- **Não conferido, por falta de meio:** o assistente ASA com IA (o banco de teste não tem chave de IA); o desempenho em produção
  (no banco de teste cada tela leva de 7 a 10 s; produção não foi medida).
- **Acquamotion** não tem as vagas de personagem dos shows (a planilha ainda está "a definir"), por
  isso os Livros do Dia de lá nascem vazios. Não é defeito.
- **Buona e Bella** têm as filas definidas e as vagas a criar.

## Agent skills

### Issue tracker

Issues e specs ficam no GitHub Issues de `ArtsAndSportsAcademy/my-asa`, via CLI `gh`. Criar e usar issues e rótulos não depende do "pode enviar" de quem constrói o app; push de código e promoção continuam dependendo. Ver `docs/agents/issue-tracker.md`.

### Triage labels

Vocabulário padrão: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. Ver `docs/agents/triage-labels.md`.

### Domain docs

Contexto único: um `GLOSSARY.md` e um `docs/adr/` na raiz. Ver `docs/agents/domain.md`.
