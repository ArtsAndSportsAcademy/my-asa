# Handoff — Etapa 3: pedido de folga analisado (16/10/2026)

Quem lê só este arquivo deve conseguir continuar. Leia antes `AGENTS.md` (o crivo das 16 "coisinhas"), o desenho
`docs/superpowers/specs/2026-10-16-pedido-de-folga-analisado-design.md`, o plano
`docs/superpowers/plans/2026-10-16-pedido-de-folga-analisado.md` e `docs/mapa-de-revisao.md`. Os handoffs
anteriores (`handoff-2026-10-15-sessao-2.md`, `-16.md`, `-14.md`) seguem valendo para o que não mudou. Branch de
trabalho: `codex/myasa-novo`. Nunca fazer merge na `main`. **Nada disto foi enviado ao GitHub nem promovido.**

## 1. Quem é quem (mudou nesta sessão)

- Quem conversa com o assistente **constrói o app**, é do Elenco e **não é a Administração**. Quem administra é a
  **Babi**; as respostas de regra de negócio vêm dela (às vezes em áudio, repassado). **Quem roda migrações e scripts
  em produção, e dá o "pode enviar", é quem constrói o app**, não a Babi. Onde os docs antigos dizem "ela/a Babi roda
  em produção", leia isso.
- O assistente não ouve áudio: transcreve com `faster-whisper` (modelo small) num ambiente isolado na pasta temporária
  da sessão, pedindo permissão antes de baixar de novo.

## 2. O que a Babi decidiu em 16/10/2026 (e está nos docs)

- **Não existe folga a mais.** Quem vem trabalhar por emergência tem a folga **transferida**; a gerência registra.
- **Grupos de folga só na alta temporada**, definidos em conjunto pelos supervisores Deb, Victor e Tef; nos outros
  meses é "aleatório" respeitando a cobertura dos shows. A aba antiga **Grupos** do menu foi **retirada** (era a tela de
  equipes operacionais do desenho antigo); os grupos de folga e os Grupos da casa (Mensagens) continuam.
- **Antes de o mapa de folgas do mês estar publicado**, o pedido entra como **prioridade** (já aprovado; a gerência
  desfaz com motivo se houver algo especial). **Depois de publicado**, vai para a **Supervisão da área da pessoa**, e
  a **Administração só decide quando a Supervisão não respondeu e faltam N dias corridos** (padrão 3, configurável), ou
  quando a área não tem Supervisão.
- **Troca só existe quando o colega está de folga no dia pedido** (ele trabalha o dia e fica com uma folga de quem
  pediu; aceita ou recusa, recusa pede motivo e volta para a Supervisão). Quando o colega **trabalha** naquele dia,
  é só **cobertura/alerta**. Quem pode cobrir é quem está na **lista de substituições do Livro do Show** da vaga.
- **Cobertura mínima só avisa**, nunca trava, e o número é **configurável por área** (o "5 bailarinos" era só exemplo).
- **Pedido de vários dias com só parte possível:** a Supervisão **propõe à pessoa só os dias que dão** (mediação).

## 3. O que foi construído (commits locais, nada enviado)

`4fb05c7` respostas da Babi nos docs · `b9ccac8` aba Grupos retirada e mapa de revisão · `dec06b5` desenho, plano e
**panorama do dia** (tarefa 1) · `83a949f` **roteamento e prazo** (tarefa 2) · `ed58ed8` **troca com o colega de folga**
(tarefa 3) · `bba87d1` **mediação** (tarefa 4) · (próximo) **regras configuráveis** (tarefa 5).

- **Panorama do dia** (`services/analise-folga.ts`, `routes/folga-analise.ts`, `pages/folga-analise.tsx`): para cada dia
  pedido (até 14), quem está de folga, quem trabalha, a vaga da pessoa ("Astrid · Ana") com quem pode cobrir e o
  resultado em uma frase; calculado na leitura, nunca gravado. Mostra "já está de folga" quando a pessoa já folga no dia.
- **Roteamento** (`services/folga-roteamento.ts`, `services/folga-decisao.ts`, `routes/operational-cycle.ts`): prioridade
  antes da publicação, Supervisão primeiro depois dela, prazo da Administração, aviso único de prazo aberto
  (`avisarPrazoDaFolgaAberto`, no ciclo de `operational-jobs.ts`).
- **Troca** (`routes/folga-troca.ts`) e **mediação** (`routes/folga-alternativa.ts`): proposta, resposta, retirada.
- **Desfazer a prioridade** (`routes/folga-prioridade.ts`, cartão "entraram como prioridade" em Folgas): a gerência (Administração
  a qualquer momento; Supervisão da área) desfaz com motivo escrito uma folga que entrou como prioridade, de **qualquer mês**
  (`GET /leave-requests/prioridades`); a pessoa é avisada com o motivo. Sem isso a frase "a gerência avisa você" não se cumpria.
- **Regras** (`services/folga-config.ts`, `routes/folga-config.ts`, janela "Regras do pedido" em Folgas): prazo da
  Supervisão (0 a 30 dias) e limite de folgas por dia em cada área (só avisa).

## 4. Migrações (só no banco de TESTE até agora)

`0067_folga_troca`, `0068_folga_alternativa`, `0069_folga_config` (todas só adicionam colunas/tabela; com rollback em
`lib/db/drizzle/rollback/` e no `meta/_journal.json`). **Ordem para produção, por quem constrói o app:** (1) rodar as
três migrações, na ordem; (2) promover a **API**; (3) promover o **site**. O site novo conta com as rotas novas.

## 5. Escolhas minhas, para conferir (também no desenho e nos commits)

- "Esperando o colega/a pessoa" é **derivado das colunas**, não um valor novo do status (o banco não deixa usar um
  valor de tipo recém-criado na mesma migração). O status continua `PENDING`.
- Pedido que entra como prioridade nasce `APPROVED` com **quem pediu** em "decidido por" (o banco exige alguém); o motivo
  da decisão diz que foi automático.
- A troca é de **um dia por vez**. O limite de folgas é por **área** (não por função dentro da área).
- "Publicado" é o **mapa de folgas do mês** (publicação ou retrato inicial), não a Escala do dia; a análise lê o
  rascunho da Escala/Livro do Dia.
- O colega da troca vê o pedido **sem o motivo particular** de quem pediu.

## 5b. Revisão geral desta sessão (skill `code-review`, dois revisores independentes) — o que mudou por causa dela

Corrigido: desfazer a prioridade (não existia); Supervisão única que pede a própria folga (a Administração era avisada e
barrada); pedido que atravessa meses (basta um mês publicado para esperar a Supervisão); **motivo escrito obrigatório** quando a
Administração decide no lugar da Supervisão e quando se aprova dia sem cobertura; frases enganosas (dia sem Escala, prazo
aberto); nota de que a troca é de um dia por vez; código repetido das rotas de folga movido para `services/folga-comum.ts`;
clique no fundo fechava duas janelas da Agenda enquanto salvavam. Fica como está de propósito: o botão "Aprovar e escolher quem
cobre" do rascunho (o desenho final diz que quem cobre se combina fora do app); lembrete automático ao colega que não responde;
limite de cobertura é **máximo** por área (não mínimo por função). **Não coberto por essa revisão:** os commits 4f7372e, a5acdc6 e
61e02cb (Agenda, Tarefas, Cadastros, Painel, Biblioteca) — verificados na sessão anterior, não nesta.

## 6. O que não deu certo (não repetir)

- **Sessão do navegador caindo no login** durante a conferência com a empresa de teste: outra aba do Playwright
  apagava a sessão guardada (a `localStorage` é compartilhada). Feche as outras abas no começo do script e espere a
  página `/login` assentar antes de gravar a sessão.
- **Teste que "passava" por acaso:** pedido em mês sem mapa publicado agora vira prioridade; testes de decisão precisam
  **publicar o mês antes** (`POST /folgas/grid/publicar`). `grupo-b` e `folga-analise` foram ajustados assim.
- **O servidor de teste (`preview_start api-server`) processa a fila de avisos do banco de teste**; ao apagar usuários
  de um teste, apague antes `user_notifications` e `notification_outbox` deles.
- Rodar dois runners de teste ao mesmo tempo apaga `tests/.dist`. Um arquivo por vez.
- **Token e senha:** o Playwright mostra o código que roda, inclusive tokens curtos de teste. Eles são do banco de
  teste e vencem em 15 minutos; a senha da empresa de teste nunca é impressa (fica num arquivo fora do repositório).

## 6b. Conferência em celular simulado (16/10, depois da revisão)

No navegador com tela de 375 px, toque e agente de Android (não é um telefone de verdade): **Perfil** (silêncio noturno, aniversário),
**primeiro acesso com senha provisória** e **PDF da Biblioteca** (abre no toque numa janela nova, como PDF, sem erro). Corrigido: as
opções do Perfil e os filtros da Biblioteca tinham 40 e 25 px de altura e passaram a 44 px. **Não dá para ver sem o aparelho:** o teclado
real cobrindo botões, o bloqueio de pop-up do navegador do celular e o leitor de PDF do sistema. Efeito colateral no banco de teste: a
senha da conta `teste.elenco29` foi trocada nesse teste e **não é mais a do arquivo de senhas**; para usá-la, redefina em Cadastros.
No documento "Regras do camarim (teste)" da empresa de teste agora há um PDF pequeno anexado.

## 6c. O que o telefone de verdade mostrou (iPhone, Safari, depois da promoção)

A Babi/quem constrói o app abriu o site em produção no iPhone e achou dois defeitos que o celular simulado não mostrava:
(1) o **menu de locais da Escala** abria cortado à esquerda (ancorado em `right:0` com 206 px; no celular o botão fica à esquerda) e
não fechava com Esc nem ao tocar fora; (2) o **menu lateral** tinha `height:100vh`, que no Safari do iPhone inclui a área atrás da barra
do navegador, então o rodapé (perfil e **Sair**) ficava escondido. Corrigido: o menu de locais alinha à esquerda no celular e fecha com
Esc e ao tocar fora; o menu lateral, a busca em tela cheia e as janelas (Folgas, Gerar o mês, diálogos) usam `100dvh` (a altura visível),
com `100vh` de reserva, e o menu ganhou folga de área segura embaixo. **Lição:** conferir sempre no navegador do iPhone, não só no
Chromium simulado, e preferir `dvh` a `vh` para qualquer coisa que preencha a tela.

## 7. Próximos passos, em ordem

1. **Perguntar à Babi** (pontos que ficaram como escolha minha acima) e a quem constrói o app: pode enviar ao GitHub e
   promover? (ordem na §4).
2. **Revisão tela a tela com o crivo, ainda pendente:** **Mapa do mês**, **Grupos de folga** e "Definir folga" (agora
   que a Etapa 3 existe), **Shows**, **Registro**, **Perfil** e **Login** (ver `docs/mapa-de-revisao.md`).
3. **Etapa 4** (experimentar grupos da alta temporada e ver o equilíbrio) e a **visão do mês** (calendário e grade
   pessoa × dia) não foram feitas; a Etapa 3 usa o panorama de **um dia**.
4. Pendências antigas: aplicar os 5 grupos do Natal; datas especiais do Mural; bug antigo da linha ROTATION sem
   personagem; Acquamotion sem vagas de personagem (não é defeito); Buona e Bella com vagas a criar; Perfil e PDF da
   Biblioteca no telefone; SQL de limpeza do texto de mensagens no Registro de produção.

## 8. Regras que não se quebram (resumo do AGENTS.md)

Português do Brasil (commits em prosa longa); migração em produção é de quem constrói o app, o assistente só aplica no
banco de teste; push e promoção esperam o "pode enviar"; nunca commitar `.env*` nem escrever senha; remoção lógica;
toda escrita no Registro na mesma transação; teste a tela antes de dizer que está pronta (empresa de teste, 375 px);
rode `node scripts/verificar-nomes-build.mjs` depois do `vite build`.
