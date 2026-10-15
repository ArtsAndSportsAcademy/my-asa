# Handoff — revisão das telas com o crivo, decisões da Babi e empresa de teste (15/10/2026)

Quem lê só este arquivo deve conseguir continuar. Leia antes `AGENTS.md` (regras da dona do produto e o crivo das
**16** "coisinhas"), `docs/empresa-de-teste.md` e este arquivo. Os handoffs anteriores seguem valendo para o que
não mudou: `docs/handoff-2026-10-16.md` (Mural aberto, Mensagens com grupos, rodapé em toda janela) e
`docs/handoff-2026-10-14.md` (Folgas, Livro do Dia vivo, Gerar o mês). Branch de trabalho: `codex/myasa-novo`.
Nunca fazer merge na `main`. **Nada desta sessão foi enviado ao GitHub nem promovido**: há 4 commits locais à
frente do remoto (`89b4e11`, `4f7372e`, `a5acdc6`, `61e02cb`). Não há migração.

## 1. Objetivo e estado atual

**Objetivo.** O My ASA é o app da Arts and Sports Academy (escala do dia, Livro do Dia, folgas, comunicação do elenco).
A meta é ele funcionar em produção com dado real, conferido tela a tela com o crivo. Esta sessão fez a **revisão
Agenda → Tarefas → Cadastros → Painel → Biblioteca** pedida no handoff anterior, implementou as decisões que a Babi
respondeu e criou uma **empresa de teste** para conferir com servidor de verdade. (Folgas, Mapa e Grupos de folga
ficaram para depois, como combinado.)

**Commits desta sessão (todos locais):**
- `4f7372e` Revisão com o crivo nas 5 telas (primeira rodada de correções).
- `a5acdc6` Segunda rodada: as decisões da Babi (cancelar/remarcar, ensaio na folga, Biblioteca, lotes, push web de mensagem).
- `61e02cb` Empresa de teste e as 9 correções que o teste com servidor de verdade achou.

**Verificado:** tipos do site e da API (só o erro antigo de `components/ui/spinner.tsx`), `vite build` + `scripts/verificar-nomes-build.mjs`
(51 nomes, 0 no pacote), e os testes `revisao-agenda-biblioteca` (41), `tarefas-lote` (8), `grupo-b` (30),
`block7-integrity`, `agenda-group-d`, `library-access`, `asa-actions-http` (300). As telas foram vistas no navegador, a 375 px,
com respostas simuladas e depois com servidor de verdade (4 perfis).

## 2. Decisões e porquês

**Decididas pela Babi em 15/10/2026:**
- **A Direção age como a Administração também na Agenda e nas Tarefas** (marca, confirma, remarca, cancela compromisso;
  prepara lote, adiciona participante, cancela tarefa). Já está no `AGENTS.md`. Na Biblioteca ela só lê (vê "quem já leu").
- **Cancelar e remarcar compromisso, e cancelar tarefa, existem na tela; o motivo é opcional.** Por quê: um compromisso
  confirmado não tinha volta pela tela (a API tinha). Cancelar/remarcar avisa **só quem já sabia**: participantes se estava
  confirmado, quem propôs se era proposta, ninguém se era rascunho (antes, cancelar ensaio avisava a organização inteira, com um
  endereço do app antigo, e cancelar reunião não avisava ninguém).
- **Chamar para ensaio quem está de folga exige motivo escrito** (criando ou remarcando para o dia da folga). O Registro guarda o
  motivo e quem foi chamada; quem foi chamada recebe a frase de que a folga foi desconsiderada de propósito. Por quê: "folga vence a escala".
- **Recusar convite pede motivo, mas não obrigatório**; vai para quem convidou.
- **Proposta de reunião do Elenco em área sem supervisão cadastrada avisa a Administração**, dizendo por quê.
- **Tarefa do lote toca o celular como qualquer aviso** (um aviso por pessoa por lote, nunca para quem atribuiu a si mesma).
- **Biblioteca:** publicar e versionar avisam o público (casa inteira ou a área); "esperando você" é por pessoa **e por versão** (versão nova
  recomeça a leitura de todos); tela "Quem já leu" (Administração, Supervisão da área, Direção só leitura); editar informações, nova
  versão, trocar o PDF e arquivar (pergunta antes; "Desfazer" por alguns segundos). A Supervisão só publica e edita documento da
  **própria área** (antes a tela mandava sempre "casa inteira" e o servidor recusava: ela nunca conseguia publicar; e o servidor deixava
  a Supervisão editar documento de qualquer área, o que foi fechado).
- **Reabrir área desativada e local encerrado** (local exige motivo, como o servidor), **desligar várias pessoas** (um motivo para
  todas), **adicionar várias pessoas a uma responsabilidade**, **confirmar vários rascunhos da Agenda** (pergunta antes), **uma linha do
  lote de tarefas vale para várias pessoas**.
- **Push web de mensagem: sim, toca o celular** (`message.new` entrou em `WEB_PUSH_TYPES`). O push é **sempre genérico** ("Você tem uma
  mensagem nova"), sem texto nem nome; folga continua sem push e o silêncio noturno vale. O `block7-integrity` agora fixa isso.
- **Texto antigo de mensagem no Registro: pode limpar.** Script pronto, **a Babi roda em produção**: `lib/db/scripts/limpar-texto-de-mensagens-no-registro.sql`
  (passo 1 só conta, passo 2 limpa; não é migração, não tem volta; melhor backup antes). O ASA ainda gravava o começo da mensagem no
  Registro ao enviar proposta confirmada (`routes/asa.ts`, 2 lugares): corrigido para gravar só quem, onde e quando.
- **A Escala em rascunho de 14/10 22:14 foi teste dela**: ignorar (o Painel agora mostra "Escala(s) em rascunho" e atrasos).
- **Datas especiais do Mural:** ela passa a lista depois.

**Escolhas minhas, para ela conferir:**
- Cancelar compromisso não tem volta (só marcar de novo); a janela avisa antes e diz quantas pessoas recebem o aviso.
- Arquivar documento só desfaz pelo aviso de poucos segundos; **não existe tela de arquivados** (ver §5).
- `waitingMe` da Biblioteca tira quem publicou o documento da lista de quem deve ler.
- O Painel passou a ter **navegação de dia**; "folgas" conta quem está de folga no dia (mapa + pedidos aprovados), e as vagas em risco
  agora são do dia consultado e ignoram Livro cancelado (antes somava vagas de todos os dias, para sempre).
- Documento de **local** não tem público a avisar (por regra, só quem gerencia lê).

## 3. Arquivos criados ou alterados

API: `routes/agenda.ts` (folga, avisos, cancelar/remarcar, `hhmm`, `locationId ""`), `routes/tasks.ts` (aviso do lote e do cancelamento,
recusa do lote em português), `routes/library.ts` (leitura por pessoa e versão, avisos, `/leituras`, escopo nas escritas), `routes/operational-cycle.ts`
(Painel: vagas por dia, folgas), `routes/asa.ts` (Registro sem texto), `services/web-push.ts`. Script: `scripts/empresa-de-teste.ts`.
SQL: `lib/db/scripts/limpar-texto-de-mensagens-no-registro.sql`.

Site: `pages/agenda-workspace.tsx/.css`, `pages/responsibilities-tasks.tsx/.css`, `pages/cadastros.tsx/.css`, `pages/communication.tsx`,
`pages/biblioteca-gestao.tsx` (novo), `pages/operational-cycle.tsx` (`PanelPage`).

Testes novos (entraram em `tests/run-tests.mjs`): `tarefas-lote.test.ts`, `revisao-agenda-biblioteca.test.ts`. Ajustados: `block7-integrity`
(push de mensagem), `grupo-b-operational-cycle` (vagas por dia e limpeza), `asa-actions-http` (limpeza). Docs: `AGENTS.md`, `docs/mensagens-grupos.md`,
`docs/empresa-de-teste.md`.

## 4. O que tentamos e NÃO deu certo (não repetir)

- **Testar só com respostas simuladas.** Deixou passar 9 defeitos reais (500 ao marcar sem local, nome do responsável em branco, 403 escondido
  atrás da janela, "0 folgas" com gente de folga…). Use a empresa de teste.
- **Entrar na Escala/Mural/Meu Dia com `window.fetch` falso** derruba o app inteiro (a tela recebe `{}` onde espera lista). Para o truque do fetch falso,
  entre por `/escalas?amostra=1`, apague `sessionStorage["myasa-review-sample"]` e então vá para a tela. Mas prefira a empresa de teste.
- **`asa-actions-http` leva ~22 min** e falhava ao final por limpeza de teste (fila de avisos com chave estrangeira). Confirmei rodando com o `asa.ts`
  anterior: o problema já existia. Está corrigido.
- **`block7-integrity` falha às vezes** (janelas de 10 s e banco lento); passou limpo na rodada seguinte.
- **Rodar dois runners de teste ao mesmo tempo** apaga `tests/.dist`. Um arquivo por vez, e apague `tests/.dist` depois.
- **Edit com texto diferente do real** falha; confira. O CSS da Agenda recusou um trecho que existia: anexar um bloco novo ao fim do arquivo resolve.
- **O navegador do Claude** às vezes diz "navigation denied" na primeira navegação ao `localhost`; navegue de novo. As capturas de tela ficam cortadas
  na largura depois de trocar o tamanho da janela (artefato do painel); confie nas medidas por JavaScript (`scrollWidth` = `innerWidth`).
- **O Vite do projeto já roda na porta 3000** (de outra conversa); `preview_start web-admin` cai na 3001 e atrapalha a API. Use a 3000 e suba só a API.
- Telas antigas `pages/admin/*`, `supervisor/*`, `membro/*` não têm rota (órfãs). Erro antigo de tipos em `components/ui/spinner.tsx`: ignorar.

## 5. Próximos passos, em ordem

1. **A Babi confere no telefone:** Perfil (silêncio noturno, exige login) e o PDF da Biblioteca (abre a janela no toque, por causa do bloqueio de pop-up no celular).
2. **A Babi roda em produção** `lib/db/scripts/limpar-texto-de-mensagens-no-registro.sql` (passo 1, conferir o número, passo 2).
3. **Perguntar se pode enviar ao GitHub e promover.** Ordem: **API primeiro, site depois** (o site novo conta com `waitingMe`, `/leituras`, avisos novos). Sem migração.
4. **Fechar o que falta testar:** na empresa de teste, dar à `teste.sup1` a responsabilidade "Aprovação de tarefas" e testar o caminho feliz de a
   Supervisão distribuir tarefa (só a recusa foi vista). Também: Biblioteca com PDF de verdade, Mural e Mensagens com a empresa de teste, tela com muito elenco.
5. **Possíveis melhorias oferecidas, sem resposta:** tela "Arquivados" na Biblioteca (hoje arquivar só desfaz por alguns segundos); vocabulário único
   ("Voltar" para sair da janela, "Cancelar compromisso" para a ação); dizer quantas pessoas serão avisadas antes de confirmar/publicar; a operação padrão do
   formulário é a primeira em ordem alfabética (poderia ser a do dia).
6. **Pendências antigas ainda de pé** (handoffs de 14 e 16/10): Folgas Etapa 3 e 4 esperam 3 respostas da Babi; aplicar os 5 grupos do Natal; Mapa/Grupos/
   "Definir folga" ainda sem a revisão com o crivo; lista das datas especiais do Mural; bug antigo da linha ROTATION sem personagem; Acquamotion sem vagas de
   personagem (não é defeito); Buona e Bella com vagas a criar.

## 6. A empresa de teste (como usar)

Detalhes em `docs/empresa-de-teste.md`. Resumo: organização inventada no banco de **teste** ("EMPRESA DE TESTE · My ASA", 35 pessoas, 2 operações, 4 locais,
4 áreas; Produção sem supervisão de propósito; `teste.elenco03` de folga hoje e amanhã). Logins `teste.admin`, `teste.direcao`, `teste.sup1`, `teste.sup2`,
`teste.elenco01`…`30`, `teste.desligada`. **A senha foi sorteada** e ficou num arquivo do scratchpad da sessão (fora do repositório); se sumir, apague a
organização do banco de teste e rode `scripts/empresa-de-teste.ts` de novo (precisa de `MYASA_E2E_QA=1` e `MYASA_SENHAS_ARQUIVO`). Para testar: `node ./build.mjs`
em `artifacts/api-server`, `preview_start api-server` (porta 3001, lê o `.env.test`), e o Vite da 3000 repassa `/api`. Troque de perfil limpando `localStorage` e
`sessionStorage`. **Nunca** aponte para produção e nunca escreva a senha em arquivo do repositório, log ou conversa.

## 7. Regras que não se quebram (resumo do AGENTS.md)

- Português do Brasil em tudo (código, commits em prosa longa, interface). Commit longo: mensagem num arquivo e `git commit -F` (git do runtime do
  Codex, `C:\Users\Usuario\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\git\cmd\git.exe`; `git` não está no PATH).
- **Migração em produção é ela quem roda** (o assistente só aplica no banco de teste), e **push ao GitHub e promoção esperam o "pode enviar"/"promovi" dela**.
- Nunca commitar `.env*`; nunca escrever senha, token ou segredo em arquivo, log ou conversa.
- Nada de apagar dado real (remoção lógica); toda escrita grava `writeHistoryEvent` na mesma transação, com motivo quando é exceção.
- **Teste a tela antes de dizer que está pronta**; em produção só leitura. Rode `node scripts/verificar-nomes-build.mjs` depois do `vite build`.
- Perfis: Administração publica o dia; Supervisão cuida da própria área; Direção só lê a operação, **mas age no Mural, nas Mensagens, na Agenda e nas Tarefas
  como a Administração**; Elenco vê o que é dele. Folga vence a escala — só entra quem foi chamado de propósito, com motivo escrito.
- Banco de teste é lento (5–12 s por escrita); suíte parecendo travada costuma ser só isso.
