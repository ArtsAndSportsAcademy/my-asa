# Handoff — Etapa 1: o app passa a avisar quando algo vai mal (21/10/2026)

Branch `codex/myasa-novo`. Nada foi enviado ao GitHub, nada foi promovido, nenhuma migração foi aplicada em produção. Só o banco de teste foi tocado.
Leia antes: `AGENTS.md`. Documentos novos desta etapa: `docs/verificador-de-fora.md`, `docs/quando-o-app-cai.md`, `docs/alerta-de-erros-sentry.md`.

## Em uma frase

Três coisas: (1) o app percebe quando o relógio por minuto (`/api/internal/ciclo`) para, avisa a Administração no sino e mostra uma faixa no Painel; (2) o endereço
`/api/saude` serve a um verificador de fora que manda e-mail quando o app cai ou o relógio para; (3) erros de código vão para o Sentry, **só quando a chave existir**.

## Commits (3, locais)

| Commit | O que é |
|---|---|
| `9cda975` | Vigia do relógio: migração 0076, `/api/saude`, aviso no sino, Registro, faixa do Painel, teste |
| `a565c93` | Documentos: verificador de fora e guia "quando o app cai" |
| `825f699` | Alerta de erros (Sentry) no servidor e no site, filtro de dados, teste, guia da chave |

## O que passou, e como foi conferido

| Verificação | Resultado | Como |
|---|---|---|
| `relogio-do-sistema.test.ts` (novo, na bateria) | 31 de 31 | **rodei o teste** no banco de teste (parada, um aviso por parada mesmo com 4 chamadas ao mesmo tempo, volta, nova parada, faixa, recusas, `/saude` sem dado de pessoa) |
| Ciclo real no banco de teste | 200 em 33 s; anotou início e sucesso; `/api/saude` respondeu `em_dia` | **rodei** uma vez com um teste descartável (apagado depois) |
| `alerta-de-erros.test.ts` (novo, na bateria) | 24 de 24 | **rodei o teste**, sem internet e sem banco: erro de login e de mensagem cheios de segredo, pelo filtro e de ponta a ponta com transporte falso |
| `permission-matrix` | 465/465 rotas protegidas sem autenticação (401), 5 públicas, 25 casos de autorização, 0 falhas | **rodei** |
| `internal-ciclo-trava`, `fase-e-ciclo` | passaram (saída 0) | **rodei** |
| Tipos da API e do site (`tsc --noEmit`) | limpos | **rodei** |
| Build do site + `verificar-nomes-build` (regra D1) | limpo, 51 nomes fora do pacote, **com e sem** chave do Sentry. Sem a chave nenhum arquivo do pacote cita Sentry | **rodei** |
| Pacote da API para a Vercel (`VERCEL=1 node build.mjs`) | carrega e responde `/api/healthz`, com e sem `SENTRY_DSN` | **rodei** |
| Faixa do Painel | liga e some; a 375 px sem rolagem lateral, botão de 44 px | **vi na tela**, mas em **modo amostra** (`?amostra=1&relogio=parado`), não com conta real |

Passei a faixa pelo crivo das 19 perguntas. O que pegou (e foi corrigido): a frase da faixa e do aviso apontava para o guia "Quando o app cai", que a pessoa
não consegue abrir dentro do app (pergunta 17); agora diz "avise quem cuida do app". Também vi o risco de "banco fora" falso quando o banco só estava lento gravando o
aviso (pergunta 8): o prazo de 8 s agora vale só para "o banco responde?".

## O que **não** consegui conferir

- **A faixa com servidor e conta de verdade** no navegador (liguei só a versão de amostra). O que a alimenta (`GET /api/painel/relogio`) está coberto pelo teste: 200 para Administração e Direção, 403 com frase para Supervisão e Elenco, 401 sem entrar. *Li o código e rodei o teste; não vi na tela.*
- **O Sentry de verdade.** Nada foi enviado a lugar nenhum (transporte falso). Que o alerta chega na conta só se confirma depois de você pôr a chave.
- **A espera de 2 s do envio na Vercel.** O teste prova que a resposta só termina depois de o erro entrar no transporte, mas *não rodei na Vercel*.
- **O tempo do `/api/saude` em produção.** No banco de teste, com muitas casas, o primeiro aviso demora (gravar o Registro de cada casa). Em produção há uma casa só.
- **A bateria completa (76 + 2 arquivos).** Rodei só os arquivos ligados ao que mexi. Rode a bateria inteira antes de promover.

## O que depende de você (decisões e ações fora do repositório)

1. **Conta do verificador (Better Stack)**, com o passo a passo de `docs/verificador-de-fora.md`: endereço `https://my-asa.vercel.app/api/saude`, de 3 em 3 minutos, aviso por e-mail. Confira na página de preços deles (os números que usei vêm de páginas de comparação; o plano grátis do UptimeRobot é relatado como só para uso não comercial).
2. **Conta do Sentry + chaves na Vercel**, passo a passo em `docs/alerta-de-erros-sentry.md`:
   - projeto **my-asa** (API): variável `SENTRY_DSN` (Production);
   - projeto **my-asa-web** (site): variável `VITE_SENTRY_DSN` (Production), lida na compilação, então precisa refazer o envio.
   Não escreva a chave em arquivo do repositório nem na conversa.
3. **Migração 0076 em produção**, por você, com `lib/db/scripts/migrar-producao.ts` (ensaio primeiro, depois `--aplicar --so=0076_relogio_do_sistema`). É só uma tabela nova; aplicar antes do código é seguro (a API que está no ar não a usa). Desfazer: `lib/db/drizzle/rollback/0076_relogio_do_sistema.down.sql`, **antes** de voltar a API (a API nova lê a tabela; sem ela o vigia só registra erro no log, o ciclo continua).

## Ordem para promover

1. **Migração 0076** em produção (ensaio, depois aplicar). Já aplicada no **banco de teste**.
2. **Enviar ao GitHub** (só quando você mandar).
3. **API** (`my-asa`). Antes, ponha `SENTRY_DSN` se já tiver a conta.
4. **Site** (`my-asa-web`): rode `node scripts/verificar-nomes-build.mjs` antes (já passa). Antes, ponha `VITE_SENTRY_DSN` se já tiver a conta.
5. **Conferência** (30 segundos): abra `https://my-asa.vercel.app/api/saude`. Tem que mostrar `"situacao":"em_dia"` com poucos segundos. Se mostrar `"sem_registro"` por mais de 2 minutos, o agendador `myasa-ciclo` do Supabase não está chamando a API (guia, passo 3).
6. **Depois** crie o monitor do Better Stack (assim ele não dá alarme antes de a primeira chamada do ciclo gravar o instante).

## Decisões de desenho que valem saber

- **Sem registro não é alarme.** Antes de qualquer ciclo anotado, `/api/saude` responde 200 `sem_registro`. Foi escolha minha para não disparar alarme falso no minuto da promoção; o custo é que um agendador que nunca funcionou depois da promoção só se descobre pela conferência do passo 5.
- **A parada vira aviso por quem olha**, não por um relógio interno (o relógio é justamente quem parou): o verificador de fora (a cada 3 min) ou a Administração abrindo o Painel. O app só avisa quem marcar `parado_desde` primeiro: um aviso por parada.
- **Aviso direto no sino, não pela fila**, pois a fila só é esvaziada pelo próprio ciclo. Não sai push de celular (só o sino), como pedido.
- **Sentry 11 coleta tudo por padrão.** Cada coleta está desligada em `dataCollection`, e o filtro de `lib/shared/src/limpar-erro-para-envio.ts` é a segunda trava. Limite: uma frase de erro escrita pelo próprio código com nome de pessoa dentro seria enviada (só e-mail, token, CPF, telefone e códigos longos são apagados); hoje os erros registrados vêm do banco e do código, não de texto digitado.
- **Empacotamento:** `@opentelemetry/*` deixou de ser "externo" em `build.mjs` e `tests/run-tests.mjs`, porque o Sentry os importa. `pnpm add` exige `npm_config_node_linker=isolated` e o `pnpm.cjs` do runtime do Codex (comando em `memory/ambiente-pnpm11-testes`).

## Para a outra sessão (Etapa 3, segurança), se ela ler isto

- Mexi em `lib/logger.ts` (um `hooks.logMethod` que manda `log.error({ err })` ao alerta, só se ligado) e em `application.ts` (dois `app.use` e a chamada de `iniciarAlertaDeErros()`).
- Em `tests/run-tests.mjs` a linha da lista tem a entrada dela (`isolamento-entre-casas`) e as minhas; commitei só o meu pedaço. O resto do arquivo e os arquivos `delegations`, `groups`, `roles`, `show-book`, `tasks`, `task-steps` continuam como a outra sessão deixou (não os toquei nem os commitei).

## Pendência que ficou aberta

- Uma pasta antiga do `drizzle-orm` ficou em `node_modules/.pnpm` depois da instalação do Sentry. É inofensiva; só confirme com `pnpm install --frozen-lockfile` num clone limpo antes de promover, para o lockfile reproduzir os tipos sem erro (aqui os tipos ficaram limpos depois de sincronizar a instalação).
