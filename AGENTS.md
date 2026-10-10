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

Erro aparece no teste; isso aqui só aparece se alguém perguntar. Traga as duas coisas juntas no
relato, separando o que já foi corrigido do que depende de decisão dela. Quando uma pergunta nova
pegar um defeito, acrescente-a aqui com o caso — a lista cresce pelo que acontece, não pelo que se
imagina.

## Regras que não se quebram

- **Migração em produção é ela quem roda.** O assistente aplica migrações **só no banco de teste**.
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
- Perfis: Administração publica o dia; Supervisão cuida da própria área; Direção só lê; Elenco vê o
  que é dele. Folga vence a escala — só entra quem foi chamado de propósito, com motivo escrito.

## Comandos que funcionam nesta máquina (Windows, PowerShell, pnpm)

O `pnpm` daqui não resolve os binários pelos atalhos; use os caminhos abaixo.

```powershell
# tipos (api-server e web-admin)
node ../../node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/bin/tsc -p tsconfig.json --noEmit

# build da API (artifacts/api-server)
node ./build.mjs

# build do site (artifacts/web-admin) — PORT e BASE_PATH são obrigatórios
$env:PORT="3000"; $env:BASE_PATH="/"; node ../../node_modules/.pnpm/vite@<versão>/node_modules/vite/bin/vite.js build --config vite.config.ts

# testes da API, contra o banco de TESTE (artifacts/api-server)
$env:MYASA_TEST_RUNNER="1"; $env:TEST_FILE="escalas-dia.test.ts"
node --env-file=../../.env.test ./tests/run-tests.mjs

# migração no banco de teste (lib/db)
node --env-file=../../.env.test ../../node_modules/.pnpm/tsx@<versão>/node_modules/tsx/dist/cli.mjs src/migrate.ts
```

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

## Estado em 10/10/2026

Pronto e em produção: Escala do dia, Programação, Livro do Dia, check-in por turno, Meu Dia, com o
elenco de Snowland carregado e gerando o dia de verdade.

Pendente:
- **Folgas e Solicitações** é o próximo módulo a ser revisado tela a tela, com o crivo acima. A regra
  real de folgas está em `docs/regras-de-folgas.md` — leia antes de mexer.
- **Acquamotion** não tem as vagas de personagem dos shows (a planilha ainda está "a definir"), por
  isso os Livros do Dia de lá nascem vazios. Não é defeito.
- **Buona e Bella** têm as filas definidas e as vagas a criar.
