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

1. **Serve para várias pessoas de uma vez?** Uma atividade manual que só aceitava uma pessoa, um
   bloco da Programação que só valia para um dia da semana, um ajuste por vez numa conexão lenta.
2. **Quem precisa ficar sabendo?** Mudança depois de publicada que ninguém avisa; pessoa chamada na
   folga sem receber aviso; administração que só descobre se abrir a tela.
3. **Dá para desfazer?** Tirar sem perguntar, sem restaurar e sem registro. Tudo o que remove deve
   ser recuperável e aparecer no Registro.

Erro aparece no teste; isso aqui só aparece se alguém perguntar. Traga as duas coisas juntas no
relato, separando o que já foi corrigido do que depende de decisão dela.

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
