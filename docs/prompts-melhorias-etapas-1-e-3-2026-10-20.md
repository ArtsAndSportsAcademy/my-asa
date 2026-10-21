# Prompts das melhorias: Etapa 1 (proteger o dia de show) e Etapa 3 (segurança)

Para colar em duas sessões novas, uma para cada etapa. As duas podem andar ao mesmo tempo: a Etapa 3 quase só lê. O plano das 6
etapas está no fim deste arquivo.

## Etapa 1 — Proteger o dia de show

```text
Leia o AGENTS.md na raiz, docs/handoff-2026-10-20-fechamento.md e a seção "COMO RODAR" de docs/prompt-revisao-4-2026-10-20.md antes
de qualquer coisa. Branch codex/myasa-novo; nunca merge na main; tudo em português do Brasil, em linguagem simples. Só banco de teste.
Em produção, só leitura, e só se eu pedir. Não envie nada ao GitHub e não promova nada: push e promoção só quando eu mandar. Não commite
.env nem escreva senha, token ou chave em arquivo, log ou conversa.

Contexto: o app é usado por gente de verdade, num parque, no dia do show. Hoje, se o app cair ou se a tarefa que roda a cada minuto
(POST /internal/ciclo, chamada pelo pg_cron: check-ins, lembretes, avisos) parar, ninguém é avisado: a Administração só descobre quando
alguém reclama. Esta etapa faz o app AVISAR quando algo vai mal. Quem usa não entende de programação: explique cada decisão com o que acontece
hoje, as opções e uma recomendação, e peça a decisão antes de gastar dinheiro ou mandar dado para um serviço de fora.

Tarefa, em três partes (um commit por parte, mensagens longas em prosa dizendo o que estava errado e por que a mudança resolve):

1. VIGIA DO RELÓGIO. Descubra como o ciclo por minuto é registrado hoje (routes/internal.ts, services/operational-jobs.ts e vizinhos). Se
   não guarda "quando rodou pela última vez", passe a guardar (migração aditiva só no banco de teste, com rollback em
   lib/db/drizzle/rollback/ e entrada no meta/_journal.json; quem roda migração em produção sou eu, com lib/db/scripts/migrar-producao.ts:
   diga a ordem). Exponha "há quantos segundos o ciclo rodou" num endpoint de saúde que não mostre dado de ninguém (por exemplo
   GET /api/saude, ao lado do /api/healthz que já existe; não mude o que o healthz devolve). Se o ciclo passar de 3 minutos sem rodar, a
   Administração recebe UM aviso no sino por parada (não um por minuto) e o Painel mostra uma faixa clara: "O relógio do sistema parou há X
   minutos: check-ins e lembretes podem não ter saído". Ao voltar, a faixa some e a Administração recebe um aviso de que voltou. Entra no Registro.

2. VERIFICADOR DE "ESTÁ NO AR?". Um serviço de fora que olha o endereço de saúde a cada poucos minutos e avisa por e-mail ou mensagem
   quando falha ou quando o ciclo parou. Compare as opções gratuitas (UptimeRobot, Better Stack, o próprio Vercel) em uma tabela curta, recomende
   uma, e me dê o passo a passo para eu criar a conta e apontar para o endereço, sem eu precisar saber o que é um "monitor". O endereço de saúde
   não pode revelar nada de pessoas.

3. ALERTA DE ERRO. Compare em linguagem simples o Sentry (plano gratuito) com as alternativas e recomende. PARE e me peça a decisão antes de
   instalar, porque um serviço de fora vai receber dados de erro. Se eu aceitar: instale no servidor (artifacts/api-server) e no site
   (artifacts/web-admin), LIGADO SÓ quando a chave existir como variável de ambiente (sem chave, não envia nada, e os testes nunca enviam);
   nunca envie corpo de requisição, senha, token, cabeçalho de autorização, nem nome ou mensagem de pessoa (sendDefaultPii desligado e um filtro
   que apaga o que for sensível antes de sair; teste o filtro com um erro de login e um de mensagem). No servidor da Vercel, garanta que o
   erro é enviado antes de a função terminar. O site NÃO pode levar nome do elenco no pacote: rode `node scripts/verificar-nomes-build.mjs`.
   Explique onde fica a chave e como eu a ponho na Vercel (não a escreva em arquivo do repositório).

Além disso, escreva docs/quando-o-app-cai.md para uma pessoa que não é técnica: "o alerta tocou, e agora?" em passos curtos (olhar o Vercel,
olhar o Supabase, voltar o deploy anterior, quem avisar), com o que cada tela mostra.

Cada parte tem teste de regressão novo (ACRESCENTE-O à lista de artifacts/api-server/tests/run-tests.mjs; lembre que o tsc não confere arquivos de
teste, só rodar o teste confere). Passe a tela do Painel pelo crivo das 19 perguntas, a 375 px e em desktop, e confira na tela com
navegador de verdade (faixa aparecendo e sumindo: simule o ciclo parado alterando o instante registrado no banco de teste).

REGRAS DESTA ETAPA (outra sessão trabalha ao mesmo tempo, a Etapa 3, de segurança):
- Outra sessão pode estar rodando testes no banco de teste. Erro de conexão (ETIMEDOUT, EMAXCONN, "max clients") é o banco ocupado, não o
  seu código: espere 2 minutos e repita antes de concluir qualquer coisa. Nunca rode dois arquivos de teste ao mesmo tempo.
- Antes de commitar, `git status`. `git add` arquivo por arquivo, nunca `git add .`. Se aparecer alteração que não é sua, não toque.
- Os arquivos que são seus: routes/internal.ts, o endpoint de saúde, services/operational-jobs.ts, o Painel e o que você criar. A sessão de
  segurança vai ler o resto do código e pode consertar coisas pequenas em outros arquivos.

ENTREGA: docs/handoff-<data>-etapa-1.md com o que passou, o que corrigiu (commits), o que depende de mim, o que NÃO conseguiu conferir
(diga "li o código" / "rodei o teste" / "vi na tela"), a ordem para promover (migração primeiro, depois API, depois site) e o que eu preciso
configurar fora do repositório (conta do verificador, chave do alerta na Vercel).
```

## Etapa 3 — Segurança

```text
Leia o AGENTS.md na raiz, docs/handoff-2026-10-20-fechamento.md e a seção "COMO RODAR" de docs/prompt-revisao-4-2026-10-20.md antes
de qualquer coisa. Branch codex/myasa-novo; nunca merge na main; tudo em português do Brasil, em linguagem simples. Só banco de teste.
Em produção você NÃO toca em nada. Não envie nada ao GitHub e não promova nada. Não commite .env nem escreva senha, token ou chave em
arquivo, log ou conversa.

Contexto: o app guarda nome, aniversário, telefone, mensagens e escala de pessoas reais, em duas organizações ("casas") separadas no mesmo
banco. Em 18/10 achamos que a Administração de uma casa conseguia cancelar o Livro do Dia de outra só sabendo o id; e hoje a revisão 4 achou
que não havia limite de tentativas de senha (já resolvido, migração 0075). Nunca houve uma revisão de segurança do código inteiro. Esta etapa
é isso. Quem usa não entende de programação: o relato precisa ser em português simples, dizendo para cada achado "o que um mal-intencionado
conseguiria fazer" em uma frase.

Tarefa, em duas partes (comece pela 1):

1. REVISÃO DO CÓDIGO (só leitura no começo). Percorra, nesta ordem de risco, e anote com arquivo:linha:
   a. ISOLAMENTO ENTRE CASAS: toda rota que recebe um id (de pessoa, Livro, tarefa, documento, folga, mensagem, grupo, show, escala...)
      confere que o recurso é da organização de quem pede? Procure consultas só por id, joins que não filtram organizationId, e rotas em que
      o papel ADMIN "passa sem olhar a organização". Os roteadores com :id são muitos; use o mesmo método do permission-matrix para listar.
   b. AUTORIZAÇÃO POR PERFIL e por ÁREA/LOCAL (Supervisão só da própria área; Direção só lê; Elenco só o dele): rotas que escrevem sem
      requireRole, ou que confiam no que o cliente manda (areaId, userId, role no corpo).
   c. LOGIN E SESSÃO: segredo e validade do JWT, renovação (refresh) e encerramento de sessão, senha provisória, "esqueci minha senha"
      (resposta igual exista o usuário ou não), o limite de tentativas novo (lib/tentativas-de-acesso.ts), e o endpoint interno /internal/ciclo
      (como prova que quem chama é o pg_cron?).
   d. ENTRADA DE DADOS: SQL escrito à mão (sql`...`, pool.query) com texto vindo do cliente; upload de PDF e de foto (tipo, tamanho, conteúdo);
      uso de dangerouslySetInnerHTML ou HTML montado no site; redirecionamentos; links montados com dado de pessoa.
   e. VAZAMENTO: o que os logs e os erros mostram (senha, token, corpo de login, pilha de erro para o cliente); o que as rotas de
      listagem devolvem a mais (campos de outra pessoa, e-mail e telefone quando a pessoa escolheu "só a gestão"); mensagens privadas (a
      Administração NÃO lê conversa).
   f. A ASSISTENTE ASA (IA): as ferramentas que ela chama respeitam o perfil e a organização de quem pergunta? Uma instrução escondida em
      texto de documento, mensagem ou nome pode fazê-la gravar algo ou mostrar dado de outra pessoa? Toda gravação pede confirmação?
   g. DEPENDÊNCIAS E CONFIGURAÇÃO: `pnpm audit` (só relate), cabeçalhos de segurança (vercel.json), CORS, cookies, RLS e permissões do banco
      (o migration-runner já recusa tabela exposta: confirme que cobre tudo).
   Classifique cada achado em CRÍTICO / ALTO / MÉDIO / BAIXO, com: onde está, o que um mal-intencionado conseguiria, como reproduzir, e o
   conserto proposto.

2. TESTE DE ISOLAMENTO ENTRE CASAS (novo, entra na bateria). Escreva tests/isolamento-entre-casas.test.ts: cria duas organizações com dados
   mínimos e, para cada rota com id que dá para exercitar, chama como ADMIN da casa B sobre o recurso da casa A e afirma 404 ou 403 (nunca
   200, nunca 500), e confere que o recurso da casa A não mudou. Comece pelas rotas de maior risco da revisão (Livro do Dia, tarefas,
   Biblioteca, folgas, mensagens, grupos, pessoas) e diga quantas rotas com id existem e quantas o teste cobre; o que ficar de fora, liste.
   ACRESCENTE-O à lista de tests/run-tests.mjs.

Consertos: conserte o que for pequeno e seguro, com teste de regressão, um commit por assunto. Se um achado exigir decisão de negócio, mudar o
banco ou mexer em muitas rotas, DESCREVA e pare: a decisão é minha. Achado CRÍTICO ou ALTO: me avise no meio do trabalho, não só no fim.

REGRAS DESTA ETAPA (outra sessão trabalha ao mesmo tempo, a Etapa 1, "proteger o dia de show"):
- Não mexa em: routes/internal.ts, no endpoint de saúde, em services/operational-jobs.ts nem no Painel: são da Etapa 1. Se achar problema
  neles, REPORTE em vez de consertar.
- Outra sessão pode estar rodando testes no banco de teste. Erro de conexão (ETIMEDOUT, EMAXCONN, "max clients") é o banco ocupado: espere 2
  minutos e repita. Nunca rode dois arquivos de teste ao mesmo tempo.
- Antes de commitar, `git status`. `git add` arquivo por arquivo, nunca `git add .`. Se aparecer alteração que não é sua, não toque.

ENTREGA: docs/seguranca-2026-10-<dia>.md com a lista de achados (por gravidade, em linguagem simples), o que foi consertado (commits), o que depende
de mim, o que o teste de isolamento cobre e o que não, e o que NÃO deu para conferir. Mais docs/handoff-<data>-etapa-3.md curto.
```

## O plano completo (as 6 etapas)

| Etapa | O quê | Depende de |
|---|---|---|
| 1 | Proteger o dia de show: alerta de falha, verificador de "está no ar?", vigia do relógio | — |
| 2 | Ferramentas: banco de teste local, tipos nos testes, quebras de linha padronizadas | — |
| 3 | Segurança: revisão do código e teste de isolamento entre casas | — (só lê; pode andar junto com a 1) |
| 4 | Primeiro acesso (guia no app) e painel de pendências da Administração | 2 (para rodar testes sem fila) |
| 5 | Detalhes de tela: nomes iguais, botões de 44 px, funcionar sem sinal, tempo das telas | 2 |
| 6 | Ambiente de ensaio, conferência automática a cada envio, limpeza da API e das dependências | 2 |
