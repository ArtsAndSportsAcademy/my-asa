# Handoff — Revisão 4 (20/10/2026)

Quem lê só este arquivo deve conseguir continuar. Leia antes `AGENTS.md` (agora com 18 perguntas no crivo: a 17 e a 18 nasceram
nesta revisão). Branch `codex/myasa-novo`. Nada foi enviado ao GitHub, nada foi promovido, nenhuma migração nova, nada rodou em
produção. Tudo no banco de teste ("ASA Teste").

## Commits desta revisão (um por assunto)

| Assunto | Commit | Resumo |
|---|---|---|
| 1 Registro | `d2bebf2` | Escritas fora do Registro fechadas; filtro com id quebrado dá 400; filtro de Assunto cobre os tipos novos |
| 2 Perfil, senha, sessões | `ac2cd4a` | Recusa por perfil em português (antes: "Role DIR is not authorized…") |
| 3 Biblioteca | `d985322` | Id quebrado em "quem já leu" e categoria dá 404, não 500 |
| 9 (parte) Busca e impressão | `f7229db` | Busca levava ao Meu Dia; gaveta do celular não fechava; botão Imprimir ligado com folha velha |
| 4 Cadastros | `0027593` | Falha do servidor não vira "já existe"; id quebrado dá 404 |
| 6 Concorrência | `3d7c9af` | Editar Mural sobre versão velha dá 409 e não apaga a edição salva |
| 7 Notificações | `1237cb2` | `notifyMany` tira repetidos (um aviso por pessoa) |
| 8 Folgas | `73d943d` | Pedido repetido diz o que houve; Supervisão sem local aberto não segura o pedido; fila mostra todos os meses |
| docs | (este) | AGENTS.md (perguntas 17 e 18), plano, mapa, handoff, levantamento do assunto 10 |

## Assunto 1 — Registro

- **Passou (li o código e rodei):** varri as ~137 rotas POST/PUT/PATCH/DELETE; as escritas sem `writeHistoryEvent` eram só
  quatro grupos reais. O resto é estado pessoal (reação, "li", preferência da ASA) ou já registra por serviço.
- **Corrigido:** Livro do Show estrutural (cena, grupo, slot, linha: 11 rotas que só criavam "versão", fora da transação, agora mudança +
  Registro + versão na mesma transação); criar tag e dar tag a pessoa; criar categoria da Biblioteca; reconhecimento da ASA. Filtro
  do Registro por pessoa/operação/grupo com código quebrado: 400 com frase (era 500). Filtro de Assunto da tela cobria 11 tipos a menos
  do que o servidor grava. Valor fora da lista (tipo de linha, categoria de tag): 400 com a lista (era 500).
- **Testes:** `show-book-slots-groups` (24), `fase-c-registro` (24), `registro-das-escritas` (novo, entrou na bateria).
- **Depende de decisão:** as "narrativas" do Registro (`/history/narratives`) não têm tela nenhuma (nenhum site vivo as chama). Manter
  ou tirar?
- **Não conferi:** a tela do Registro a 375 px depois do filtro novo (a revisão de 16/10 já tinha passado por ela).

## Assunto 2 — Perfil, senha e sessões

- **Passou (rodei contra o servidor local com as contas de teste; 41 verificações):** sessões abertas e "encerrar as outras";
  senha atual errada (sessão continua valendo); senha fraca e igual; troca e volta; redefinição pela Administração só com motivo,
  com provisória e sessões antigas encerradas; pessoa barrada com a frase "Troque a senha provisória antes de continuar" e podendo
  sair; só a Administração redefine (Direção, Supervisão e Elenco recebem 403); a própria senha não se redefine por ali; foto (tipo
  errado, grande demais, retirar, id quebrado); preferências inválidas; o que o Elenco não muda (nome completo, situação, notas,
  especialização) nem em outra pessoa; o Registro guarda motivo e nunca a senha.
- **Corrigido:** a recusa por perfil falava em inglês técnico em centenas de rotas (`requireRole`).
- **Depende de decisão:** **não existe nenhum limite de tentativas de senha** (login e troca de senha). Opções: (a) limite por
  usuário em tabela do banco (bloqueia 15 min após 8 erros); (b) limite por IP no Vercel; (c) deixar. **Recomendo (a)**, porque o
  servidor é sem estado (Vercel) e só o banco serve de memória. Precisa de migração: é decisão de quem constrói o app.
- **Não conferi:** o teclado real do celular no Perfil e na troca de senha (já era do R3-E, que você disse ter feito).

## Assunto 3 — Biblioteca

- **Passou (33 verificações pela API):** rascunho invisível ao Elenco; quem cria, publica e versiona; Supervisão só da própria área;
  Direção lê "quem já leu" e não publica nem edita; versão nova recomeça a leitura; confirmar duas vezes não duplica; um aviso por
  publicação; documento de área fica na área; só a Administração arquiva; arquivado some do Elenco; Registro de criar/publicar/
  versão/leitura.
- **Corrigido:** id quebrado em `/leituras` e na categoria (404); mensagens de recusa e de Registro (sem código de pessoa).
- **Depende de decisão:** (1) **não existe "restaurar documento arquivado"** depois dos 10 s de desfazer. Quem restaura, e volta como
  publicado (avisa o público de novo?) ou como rascunho? **Recomendo:** só a Administração, volta como rascunho, sem aviso, e
  publica de novo se quiser. (2) A Direção não lê o histórico de versões (403); a regra diz "só leitura" na Biblioteca. **Recomendo**
  liberar a leitura das versões para a Direção. (3) "Pedido de material" é o `GET /asa/library-gaps` (temas que a ASA não achou), só
  da Administração; a Supervisão, que cuida da Biblioteca, não vê. **Recomendo** liberar para a Supervisão.
- **Não conferi:** o assistente ASA com IA (sem chave no banco de teste); a tela da Biblioteca com clique (vi só pela API).

## Assunto 4 — Cadastros pela tela

- **Passou:** li o código; toda janela de Cadastros e Operações tem rodapé fixo com confirmar e cancelar, Esc e ×; criar/alterar/
  encerrar gravam Registro; só a Administração cadastra; Locais a 375 px sem estouro (medi por script).
- **Corrigido:** criar/alterar área e local respondiam "já existe" para QUALQUER erro (banco lento, queda, falha do Registro).
  Agora só a violação de unicidade é 409; o resto é 500 "Nada foi alterado". Id quebrado: 404.
- **Depende de decisão (já estava aberto):** encerrar local não pede motivo (reabrir pede). Em Áreas, o cartão mostra a Supervisão
  ligada a um **local encerrado** sem avisar (e, depois do conserto do assunto 8, esse local deixou de contar para o pedido de
  folga). **Recomendo** marcar "(local encerrado)" no cartão da área.
- **Não conferi:** criar pessoa e operação pela tela clicando (só li o código e vi as listas).

## Assunto 5 — Desktop da Supervisão e da Administração

- **Passou (vi na tela, 1280 px, medi estouro de largura e procurei frase de erro em cada rota):** Administração, 20 telas (Meu Dia,
  Agenda, Escalas, Shows, Livro do Dia, Check-in, Responsabilidades, Folgas, Solicitações, Painel, Operações, Locais, Pessoas, Áreas,
  Restrições, Registro, Mural, Mensagens, Biblioteca, Perfil). Supervisão, 18 telas; Operações e Registro levam ao Meu Dia, como
  deve. Nenhuma tela passa da largura nem mostra "Não consegui…".
- **Achado de desempenho, não de tela:** com o banco de teste remoto, cada tela leva de 7 a 10 s para encher. Em produção (porta 6543)
  não medi.
- **Não conferi:** o flash da Escala ao trocar de local. O quadro do plano já diz que foi conferido em 20/10 na tela com Chromium e
  4 locais; a empresa "ASA Teste" não tem dois locais abertos com escala, então não refiz. Se quiser refazer, precisa montar dois
  locais abertos com a escala gerada.

## Assunto 6 — Concorrência

- **Passou (li o código):** Livro do Dia (`expectedVersion` em toda mutação), publicação da Escala (`expectedVersion`, 409), ajustes da
  Escala (adicionar/remover pessoa conferido e gravado na mesma transação, 409 se o Livro mudou), transições de Tarefa (trava de
  linha, 409 de estado).
- **Corrigido:** editar publicação do Mural não conferia nada (a segunda pessoa a salvar apagava, em silêncio, a edição da primeira);
  agora a tela manda a versão aberta e o servidor recusa com 409 e frase; a gravação também confere no próprio UPDATE.
- **Depende de decisão:** a edição de **Tarefa** (`PATCH /tasks/:id`) não tem tela hoje e não confere versão; se a tela for feita,
  incluir. Os **ajustes de Programação** (`PATCH /programacoes/:id/blocos/:blocoId`) também não conferem versão (não olhei a
  tela deles); **recomendo** uma conferência igual à do Mural.
- **Não conferi:** dois navegadores ao mesmo tempo (só pela API e pelo teste).

## Assunto 7 — Notificações

- **Passou (li o código e rodei):** push da Web passa pela fila, respeita o silêncio noturno e usa chave de deduplicação; só crítico
  e o lembrete do próprio turno atravessam o silêncio; o ator não recebe aviso da própria ação nas rotas que conferi; um aviso por
  pedido de folga e um por decisão (conferi ao vivo).
- **Corrigido:** `notifyMany` não tirava repetidos (autor + público + supervisão recebiam em dobro). Teste novo.
- **Depende de decisão:** (1) as chamadas diretas a `sendNotification` não têm chave de deduplicação; hoje cada uma é protegida pelo
  estado da ação. (2) O push por token Expo (app nativo) ignora o silêncio; sem efeito hoje, porque não há app nativo. (3) O aviso da
  decisão de folga leva até ~30 s (local) ou 1 min (produção), por sair pela fila; Tarefas chama o envio na hora.
- **Não conferi:** push de verdade no aparelho (é seu, R3-E).

## Assunto 8 — Folgas (só o que mudou depois de 16/10)

- **Passou (ao vivo, com as contas de teste, e os 8 testes da lista passam):** pedido nasce pendente; vai à Supervisão da área ou à
  Administração; Direção vê e não decide; outra área não vê; Administração antes do prazo recebe 409 com a data; recusar exige motivo;
  decidir duas vezes e retirar pedido decidido dão 409; um aviso por acontecimento; Registro; a pessoa vê com quem está o pedido.
  A 375 px, sem estouro. A regra de 19/10 está inteira no código (nada de "prioridade" nova; os usos de `mesDeFolgasPublicadoNoPeriodo`
  na ASA são do lote da gerência, que pede motivo depois de publicado, e estão certos).
- **Corrigido:** toque duplo dava 500 cru; Supervisão com o único local encerrado "segurava" o pedido sem poder abri-lo; a fila e
  "seus pedidos" só mostravam o mês da tela; `/leave-requests/undefined` dava 500.
- **Depende da Babi (regra de negócio):** quando a Supervisão da área só tem local encerrado, tratei a área como "sem Supervisão" e
  a Administração decide na hora. Está de acordo com a regra de 19/10? **Recomendo que sim.**
- **Não conferi:** a mediação e a troca com colega a 375 px na tela (os testes passam); o desfazer de pedido antigo de prioridade pela
  tela (a rota existe e responde; não há prioridade antiga na empresa de teste, e a rota recusa o que não é prioridade com frase).

## Assunto 9 — Telas sem registro no mapa

Ver as linhas atualizadas em `docs/mapa-de-revisao.md`. Resumo:

- **Busca:** defeito sério corrigido (ver commit). **Impressão:** corrigido o botão com folha velha. **Restrições de horário:** vista a
  375 px como Elenco e a 1280 px como Administração e Supervisão; sem defeito. **Faixa de aniversários:** li o código; sem defeito.
- **Ações de formação e de local:** não são telas vivas (sem rota). Ver o assunto 10.
- **Solicitações (aba de Folgas):** passou junto com o assunto 8; **ressalva:** o botão "Retirar pedido" mede 40 px de altura a 375 px
  (as outras ações medem 44). Não mexi.
- **Não conferi:** impressão com a escala preenchida (a empresa de teste não tem escala), e a folha de impressão no celular.

## Assunto 10 — Código sem uso (só leitura)

Ver `docs/revisao-4-codigo-sem-uso-2026-10-20.md`: 114 de 177 arquivos do site não são alcançados (cerca de 27.500 linhas só em
`pages/admin|supervisor|membro`); 12 roteadores da API sem chamada no site vivo; `groups.ts` não pode sair inteiro porque a ASA, a
mesclagem de escala e a Supervisão antiga ainda usam as funções. Recomendação: tirar as telas mortas em um commit só; manter a API.
Visão do mês e Etapa 4: continuam sem decisão; recomendo descartar até o primeiro mês real mostrar desequilíbrio (pergunta à Babi).

## O que falta

1. **Bateria completa (72+ arquivos, um por vez, ~3 a 5 h)**: ficou para o fim, como você pediu. Não rodei. Rodaram só os arquivos
   ligados ao que mexi: `show-book-slots-groups`, `fase-c-registro`, `registro-das-escritas`, `revisao-agenda-biblioteca`,
   `block7-integrity`, `fase-e-cadastro`, `mural-aberto`, `notificacoes-sem-duplicar`, os 8 de folga e `permission-matrix`
   (463/463 rotas sem login, 25 asserts, 0 falhas; rodei depois de mexer em `requireRole`).
2. Decisões acima, na ordem de importância: tentativas de senha (2); restaurar documento (3); Supervisão com local encerrado (8);
   tirar as telas mortas (10).
3. Ordem para promover quando você mandar: **nenhuma migração nova**; API primeiro, site depois.

## Como refazer o que fiz

- Roteiros ao vivo ficaram no bloco de notas da sessão (não estão no repositório): login com `empresa-de-teste.local.json`, sem
  imprimir senha nem token. Para entrar na tela sem digitar senha, gerei uma página temporária em `web-admin/public/_entrar.html` que
  grava a sessão no navegador e apaguei logo depois; nunca foi commitada.
- O servidor local lê o `dist`: **recompile** (`node ./build.mjs`) depois de mexer na API. Servidor local e testes disputam o banco.
- Sobrou na empresa de teste: um local aberto "Local R4 …" com a Supervisão de Patinadores ligada, pedidos de folga de exemplo e
  documentos "R4 …" na Biblioteca. É lixo de teste; pode ficar.
