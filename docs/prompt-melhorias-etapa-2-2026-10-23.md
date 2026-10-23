# Prompt da Etapa 2 das melhorias: ferramentas de trabalho (23/10/2026)

Para colar numa sessão nova. É a Etapa 2 do plano de 6 etapas (ver `prompts-melhorias-etapas-1-e-3-2026-10-20.md`, no fim). As Etapas 1 e 3 já foram feitas e
promovidas; as próximas (4, 5 e 6) dependem desta para rodar testes sem fila.

O que eu levantei no computador antes de escrever (23/10/2026), para a sessão não partir do zero:
- **Não há** Docker, Postgres, `psql` nem `pg_ctl` instalados. O Node é o 24.21.0. Rodar um banco local exige **baixar** alguma coisa (com permissão).
- O `tsconfig.json` da API só inclui `src`: **os arquivos de teste nunca passam pela checagem de tipos** (hoje deixou passar um erro meu, um nome repetido).
- Há **92 arquivos `*.test.ts` e só 82 rodam na bateria**: estes 10 existem e NÃO estão na lista do executor: `asa-library-citations`, `asa-library-gaps`,
  `daily-book-troca-por-area`, `escala-regras-http`, `folga-dia-dentro-do-intervalo`, `regras-de-escala`, `restricoes-horario-http`,
  `show-book-formato-do-palco`, `sondagem-mes-rodizio`, `teatro-natal-outubro`. (Já houve um caso assim: o `restricao-horario` ficou meses de fora e escondia um defeito.)
- **69 arquivos versionados têm quebra de linha do Windows (CRLF) no repositório** e `core.autocrlf=true` nesta máquina; não existe `.gitattributes` nem `.editorconfig`.
  Isso fez várias edições automáticas falharem ou virarem diffs enormes.
- Hoje a bateria completa leva **de 2h30 a 4 horas** (banco remoto lento, e caiu a conexão duas vezes), um arquivo por vez.

```text
Leia o AGENTS.md na raiz, docs/handoff-2026-10-20-fechamento.md e a seção "COMO RODAR" de docs/prompt-revisao-4-2026-10-20.md antes de qualquer coisa.
Branch codex/myasa-novo; nunca merge na main; tudo em português do Brasil, em linguagem simples. Não envie nada ao GitHub e não promova nada: push e promoção
só quando eu mandar. Em produção você NÃO toca em nada (nem leitura). Não commite .env nem escreva senha, token ou chave em arquivo, log ou conversa.

Contexto: quem constrói este app não é programadora e roda os comandos pelo botão "Run" deste aplicativo. Hoje a bateria de testes leva horas porque o banco de
teste fica na internet (Supabase), e a conexão já caiu duas vezes. Esta etapa faz o trabalho ficar rápido e seguro. Explique cada decisão com o que acontece hoje, as
opções e uma recomendação, e PEÇA PERMISSÃO ANTES DE BAIXAR qualquer coisa (diga o nome, a origem e o tamanho).

Tarefa, em cinco partes (um commit por parte, mensagens longas em prosa dizendo o que estava errado e por que a mudança resolve):

1. BANCO DE TESTE NO COMPUTADOR (a parte principal).
   a. Veja o que há na máquina (não há Docker nem Postgres). Compare em uma tabela curta as opções de ter um PostgreSQL real e local: (i) o pacote
      `embedded-postgres` do npm, que baixa os arquivos de um PostgreSQL de verdade e roda sem instalar nada com administrador; (ii) o instalador oficial do
      PostgreSQL para Windows; (iii) Docker Desktop. Considere: tamanho do download, se precisa de administrador, se tem as extensões que o app usa, e se dá para
      ligar e desligar com um comando. Recomende uma e PARE para eu autorizar o download.
   b. O app foi feito para o Supabase. Confira o que o banco local precisa ter para passar nas migrações e nos testes: os papéis `anon`, `authenticated` e
      `service_role` (o migration-runner confere permissões deles, em lib/db/src/migration-runner.ts), a extensão pgcrypto (ou o que a substitui, sem mudar
      o comportamento nos bancos reais), e o número de conexões. Crie um comando único e simples para: ligar o banco local, aplicar todas as migrações (as 77 da
      pasta lib/db/drizzle), e desligar. Rode a conferência de lib/db/src/audit-rls.ts nele.
   c. O executor de testes (artifacts/api-server/tests/run-tests.mjs) hoje RECUSA qualquer banco que não seja o Supabase de teste (assertSafeTestDatabase e
      scripts/test-database-identity.mjs). Ensine-o a aceitar também um banco LOCAL, de forma explícita: um arquivo `.env.test.local` (ignorado pelo Git) com
      a URL local e uma variável que diga "isto é local". A recusa de qualquer outro banco, em especial o de produção (.env.producao) e o do piloto, tem que continuar
      valendo: ESCREVA UM TESTE da trava que prove que a URL de produção continua sendo recusada, e que um endereço local sem a variável também.
   d. Faça a bateria completa rodar no banco local e COMPARE com o resultado no Supabase de teste: os mesmos arquivos passam? O que falhar só no local
      (por diferença de fuso, de versão do Postgres, de papéis) você investiga e resolve, ou descreve se depender de mim. Meça e me traga o ANTES e o DEPOIS:
      quanto tempo leva a bateria inteira em cada banco, e quanto leva `permission-matrix` e `asa-actions-http` sozinhos.
   e. Meta: a bateria completa em menos de 30 minutos no banco local. Se passar disso, diga onde está o gargalo. Opcional, só depois de tudo passar: rodar
      vários arquivos ao mesmo tempo, cada um no seu próprio banco, para cair mais ainda.
   f. O banco de teste do Supabase continua funcionando como hoje (é ele que prova o comportamento real do Supabase). Nada do que existe se perde.

2. CHECAGEM DE TIPOS TAMBÉM NOS TESTES. O tsconfig.json da API só inclui `src`. Crie um tsconfig.testes.json (ou equivalente) que inclua tests/ e
   rode o tsc com ele. Veja quantos erros aparecem: se forem poucos, conserte; se forem muitos, conserte os mecânicos e LISTE o resto com o arquivo e a causa,
   sem esconder nada com `@ts-ignore`. Documente o comando no AGENTS.md (seção "Comandos").

3. NENHUM TESTE FICA FORA DA BATERIA. (a) Crie uma verificação rápida (por exemplo scripts/verificar-lista-de-testes.mjs) que FALHA se existir um *.test.ts fora da lista do
   executor (ou de uma lista explícita de exceções com o motivo). (b) Os 10 arquivos que hoje estão fora (nomes acima): rode cada um, um por vez, e depois
   ponha na lista; se algum falhar, descubra se é defeito do teste, do app, ou se ficou obsoleto, e me conte antes de apagar ou desligar qualquer um.
   (c) Crie uma LISTA RÁPIDA (uns 10 a 15 arquivos críticos: login e senha, permission-matrix, isolamento-entre-casas, Livro do Dia, folgas, Painel) para rodar ANTES
   de cada envio, com um comando só, e diga quanto tempo leva no banco local.

4. QUEBRAS DE LINHA PADRONIZADAS (com muito cuidado). Hoje há 69 arquivos versionados com CRLF e `core.autocrlf=true`. Primeiro MEÇA e me explique o risco: normalizar
   mexe em muitos arquivos de uma vez e polui o histórico. Proponha: um `.gitattributes` (código e texto em LF) e um `.editorconfig`, e UM commit só de
   normalização, feito depois de confirmar com `git diff --stat --ignore-all-space` que não muda nada além das quebras de linha, e com tipos, build, verificar-nomes-build e a lista
   rápida passando antes e depois. PARE e me peça autorização antes de fazer esse commit. Se ele for feito, as edições automáticas deixam de precisar do truque de
   trocar \r\n.

5. DOCUMENTAR. Atualize o AGENTS.md (seção "Comandos que funcionam nesta máquina") e a seção "COMO RODAR" de docs/prompt-revisao-4-2026-10-20.md com: como ligar
   o banco local, como rodar um teste e a bateria completa nele, a lista rápida, o tsc dos testes, e quando ainda usar o Supabase de teste. Escreva
   docs/banco-de-teste-local.md em linguagem simples, com o que fazer se o banco local não ligar.

REGRAS DESTA ETAPA:
- Há dois arquivos modificados sem commit que NÃO são seus (artifacts/web-admin/src/components/shell-foundation.tsx e artifacts/web-admin/src/pages/shows.tsx). Não
  toque neles. Antes de commitar, `git status`; `git add` arquivo por arquivo, nunca `git add .`.
- Não mude o comportamento do app, só as ferramentas. Se um teste falhar só no banco local por diferença de ambiente, não "arrume" o app para agradar o teste.
- Migração em produção continua sendo de quem constrói o app (scripts/migrar-producao.ts). Aqui só se mexe no banco de TESTE e no banco LOCAL.

ENTREGA: docs/handoff-<data>-etapa-2.md com: o que passou, o ANTES e o DEPOIS da bateria (tempos), os arquivos que rodam no local e no Supabase com o mesmo resultado, o que
falhou só em um dos dois e por quê, a lista dos 10 testes que estavam fora e o que foi feito com cada um, o resultado do tsc dos testes, e o que depende de mim.
Diga com franqueza o que não conseguiu conferir ("li o código" / "rodei o teste" / "vi na tela"), sem misturar.
```

## Decisões que a sessão vai pedir a você (para você já ir pensando)

1. **Autorizar o download** do banco local (a sessão diz o nome, a origem e o tamanho). A minha expectativa é o `embedded-postgres`, que não precisa de administrador.
2. **Autorizar o commit de normalização das quebras de linha** (parte 4), depois de ela mostrar que não muda mais nada.
3. O que fazer com os testes que estavam fora da bateria e falharem.
