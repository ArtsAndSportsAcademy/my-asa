# Prompt da revisão 4 (20/10/2026)

Para colar numa sessão nova. A lista de assuntos vem do fim de `plano-etapas-revisao-3-2026-10-18.md`; este
arquivo acrescenta o que se aprendeu em 19 e 20/10 sobre como rodar a revisão neste computador.

```text
Leia o AGENTS.md na raiz, docs/plano-etapas-revisao-3-2026-10-18.md (o quadro "Situação em 20/10/2026" no topo e
a seção "Revisão 4" no fim) e docs/handoff-2026-10-19.md antes de qualquer coisa. Branch codex/myasa-novo;
nunca merge na main; tudo em português do Brasil, com os textos da interface explicando a regra, não o botão.
Só no banco de teste. Em produção, só leitura, e só se eu pedir. Não envie nada ao GitHub e não promova nada:
push e promoção só quando eu mandar. Não commite .env nem escreva senha em arquivo, log ou conversa.

Tarefa: a revisão 4. É uma revisão COM CONSERTO: ache o defeito, conserte o que for pequeno e seguro (com teste
de regressão), e o que depender de decisão minha, descreva e pare. Traga as duas coisas separadas no relato:
"corrigido" e "depende de decisão". Passe cada tela e cada ação pelas 16 perguntas do crivo do AGENTS.md e
acrescente uma pergunta nova ao AGENTS.md (com o caso real) quando uma delas pegar algo que a lista não pegava.

Assuntos, nesta ordem (um por vez; commite cada um separado):
1. Registro: toda escrita grava writeHistoryEvent na mesma transação, com o motivo quando a ação é exceção.
   Procure ESCRITAS SEM REGISTRO (rotas POST/PUT/PATCH/DELETE que não chamam writeHistoryEvent). Depois: quem lê
   o quê, filtro e busca.
2. Perfil, senha e sessões: trocar senha, sessões abertas, encerrar sessão, foto, o que a pessoa pode e não pode
   mudar sozinha, senha provisória (a pessoa fica barrada até trocar: confira a frase e o caminho até a troca).
3. Biblioteca: publicar, versões, arquivar e restaurar, "quem já leu", pedido de material, Direção só leitura.
4. Cadastros pela tela: Pessoas, Locais, Áreas e Operações com cada perfil, a 375 px e em desktop.
5. Desktop da Supervisão e da Administração: todas as telas, não só as que mudaram.
6. Concorrência: duas pessoas editando a mesma coisa (Escala, Livro, Mural, Tarefa): o aviso "a versão mudou",
   nada se perde em silêncio.
7. Notificações: entrega do push e do sino, um aviso por acontecimento, quem NÃO deve receber.

COMO RODAR (aprendido a duras penas, siga):
- Contas de teste: a empresa "ASA Teste" (12 pessoas, banco de teste), logins e senhas em
  artifacts/api-server/scripts/empresa-de-teste.local.json (ignorado pelo Git). Chaves: admin, direcao,
  sup.patinadores, sup.bailarinos, p1..p4, b1..b4. Use senhaAtual quando existir, senão senha. Nunca imprima
  senha nem token. A senha provisória já foi trocada nas contas de Elenco e Direção.
- Servidor local: `node ./build.mjs` em artifacts/api-server e preview_start da configuração "api-server"
  (porta 3001, lê o .env.test). RECOMPILE depois de mexer em código da API: o servidor roda o dist. Rotas
  ficam em /api/... (login: POST /api/auth/login, o token vem em token/accessToken). Para telas, a configuração
  "web-admin" (porta 3000, repassa /api para a 3001) e `?amostra=1` + sessionStorage["myasa-review-role"]
  (adm/sup/dir/mem) para revisar sem entrar com conta.
- Banco de teste é lento (2 a 6 minutos por arquivo de teste) e tem limite de conexões. NUNCA rode dois arquivos
  de teste ao mesmo tempo, nem teste junto com o servidor local ligado. O servidor local e os testes disputam o
  mesmo banco: desligue um para usar o outro.
- Testes: `$env:MYASA_TEST_RUNNER="1"; $env:TEST_FILE="nome.test.ts"; node --env-file=../../.env.test ./tests/run-tests.mjs`
  em artifacts/api-server, um arquivo por vez, em segundo plano. Se der ETIMEDOUT / EMAXCONN / "max clients" /
  "Connection terminated", é o banco, não o código: espere e repita antes de concluir qualquer coisa. Se o
  processo parar de escrever no log por muito tempo, está pendurado: pare e recomece. Lista de arquivos por
  assunto está em tests/run-tests.mjs. Ao criar um teste novo, ACRESCENTE-O à lista (restricao-horario ficou
  meses fora da bateria e escondia um defeito).
- Se escrever um script que lê uma lista de arquivos no Windows, tire o \r das linhas (um \r invisível fez
  44 testes falharem em 1 segundo sem rodar nada).
- Tipos: `node ../../node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/bin/tsc -p tsconfig.json --noEmit`
  em artifacts/api-server e em artifacts/web-admin. Antes de entregar tela: build do site e
  `node scripts/verificar-nomes-build.mjs` (regra D1: nenhum nome do elenco no pacote).
- Id inválido na URL ("undefined") já responde 404 com frase nos roteadores principais, via
  exigirUuidNosParametros (lib/uuid.ts). Ao criar um roteador novo com :id, chame o ajudante.
- Antes de commitar, confira `git status`: há arquivos soltos que NÃO são seus. Faça `git add` arquivo por
  arquivo, nunca `git add .` nem `-A`. Commits em português, em prosa longa: o que estava errado e por que a
  mudança resolve. Termine com `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

JÁ SABIDO (não refaça):
- Bateria completa de testes (72 arquivos de uma vez) fica para o FIM desta revisão, não rode agora. Rode só os
  testes ligados ao que você mexer.
- O assistente ASA com IA não é conferível no banco de teste (não há chave de IA). Confira só o que não chama a IA.
- R3-D (consulta de folgas invertidas em produção) e R3-E (conferência no aparelho: Perfil e PDF no telefone,
  Livro do Dia com teclado aberto, arrastar o mapa do palco, push de verdade, imprimir a Escala) são MINHAS;
  não as faça nem as espere.
- Flash de dados antigos na Escala ao trocar de local: a correção está em escalas.tsx e ainda precisa ser
  conferida NA TELA com a empresa de teste (troque de local várias vezes e veja se aparece a grade do local
  anterior). Inclua isso no item 5.
- Acquamotion não tem vagas de personagem nos shows (planilha "a definir"), então o Livro do Dia de lá nasce
  vazio. Não é defeito.

ENTREGA: para cada assunto, o que passou, o que corrigiu (commit), o que depende de decisão minha, e o que não
conseguiu conferir (diga "li o código" / "rodei o teste" / "vi na tela", sem misturar). No fim, atualize o
quadro de situação do plano e escreva docs/handoff-<data>-revisao-4.md para a próxima sessão. Respostas curtas,
em português simples, sem jargão; quando houver decisão, dê as opções e uma recomendação.
```
