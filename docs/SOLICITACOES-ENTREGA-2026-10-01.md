# Solicitações — entrega (01/10/2026)

A dona do produto notou que a área de Solicitações tinha ficado de fora do app novo. O servidor tinha
uma versão antiga, e existia uma tela antiga do Elenco, que o app novo não abria mais. Não havia
desenho no pacote de telas.

## Decisões da dona do produto (01/10)

- **Tipos de pedido:**
  - **horário na escala**, para algo da pessoa (ex.: horário de peruca, gravar o vídeo do Dia das
    Mães);
  - troca com colega;
  - mudança de horário;
  - restrição (saúde/física);
  - outro assunto;
  - folga.
- **Folga nos dois lugares:** a tela Folgas e a de Solicitações. Os dois gravam o **mesmo** pedido
  (`leave_requests`), sem duplicar.
- **Quem decide:** a Supervisão da área da pessoa. A Administração vê tudo e também pode decidir. A
  Direção só acompanha.

## Escolhas feitas na construção (podem ser revistas)

- **Horário aprovado entra sozinho na Escala do dia**, como um bloco só da pessoa. Ele aparece em
  "Minha escala" e no Meu Dia. É lido ao vivo, então aparece igual se for aprovado depois de a Escala
  ser gerada, ou antes de ela existir. Folga vence: em dia de folga, o horário não aparece.
- **Troca:** a colega aceita antes; só depois o pedido vai para a Supervisão. Aprovada, a Supervisão
  faz o ajuste na Escala (a troca não muda a Escala sozinha).
- **Aprovar em outro horário:** no horário na escala, a Supervisão pode aprovar com outro horário,
  com motivo. Isso substitui a "proposta de alternativa" da especificação antiga (S-06), mais
  simples para o piloto.
- **Restrição aprovada** fica registrada na pessoa (`restrictions`), no período pedido.
- **Cancelar:** a própria pessoa cancela enquanto o pedido não foi decidido.

## Regras (todas no servidor, `routes/solicitacoes.ts`)

- **Supervisão:** vê e decide só os pedidos da própria área. Usa a mesma regra de área + local das
  Folgas.
- **Ninguém decide o próprio pedido.** A Supervisão ou a Administração que pede é decidida por outra
  pessoa.
- Recusar exige motivo. Aprovar em outro horário exige motivo. A colega que não aceita a troca diz
  por quê.
- **Direção:** vê os pedidos e não decide nem abre pedido. **Não lê o detalhe de restrição de
  saúde** (doc 12). O Registro também não guarda esse detalhe.
- **Duas decisões ao mesmo tempo:** a linha é travada, uma vale e a outra recebe "já foi decidido"
  (409).
- **Toda escrita entra no Registro** na mesma transação.
- **Avisos pela fila durável:**
  - pedido novo: para a supervisão da área (sem supervisão, para a Administração);
  - troca: para a colega;
  - decisão: para quem pediu (e para a colega, na troca).
- **Meu Dia:**
  - Elenco: "pedido em análise" e "troca esperando você";
  - Supervisão e Administração: "pedidos a decidir".

## Arquivos

- Migração `0051_solicitacoes` (com rollback):
  - tipo `ESCALA_SLOT`;
  - estados `WAITING_PEER` e `CANCELLED`;
  - colunas de organização, área, local, colega, horário, assunto e decisão em `requests`.
- Servidor:
  - `routes/solicitacoes.ts` (novo);
  - `services/solicitacoes.ts` (Meu Dia);
  - `services/escala-dia.ts` (horário aprovado vira bloco, `origem: "solicitacao"`);
  - `services/meu-dia.ts`;
  - `lib/app-routes.ts` (avisos de pedido abrem `/solicitacoes`).
- Tela:
  - `pages/solicitacoes.tsx` e `.css` (novos);
  - item **Solicitações** no menu dos quatro perfis, depois de Folgas (`shell-foundation.tsx`, 3
    linhas);
  - o botão "Pedir troca" da Minha escala virou "Pedir troca ou horário" e abre Solicitações.
- A rota antiga `/api/requests` continua como estava (a ASA do Codex a usa). A tela nova não a usa.

## Teste

- **`fase-e-solicitacoes`** (banco de teste): 51 verificações passaram.
- **Mutações:** 9 erros plantados, todos pegos pelo teste:
  - supervisão sem escopo de área;
  - decidir o próprio pedido;
  - Direção lendo saúde;
  - folga não vencendo o horário;
  - recusar sem motivo;
  - decidir antes da colega;
  - Elenco vendo tudo;
  - sem trava de concorrência;
  - aviso indo para a supervisão de outra área.
- **Regressão:**
  - `permission-matrix`: 373/373 rotas, incluindo as 6 novas, recusam sem login.
  - `fase-c-meu-dia`, `escalas-dia`, `fase-c-escala-avisos`, `block7`, `fase-c-registro` e
    `fase-b-regressoes` passaram.
  - `fase-b-regressoes` foi atualizado: aviso antigo de pedido agora abre Solicitações, e folga
    continua em Folgas.
- **Build de produção:** sem nome da amostra (verificação da D1).
- **Conferido no navegador**, com o servidor e o banco de teste:
  - Julia pediu horário de peruca (3/10, 14:00–14:30) e uma folga.
  - Deborah viu os dois em "Para decidir".
  - Ao aprovar em outro horário sem motivo, a recusa apareceu dentro da janela. Com motivo, foi
    aprovado em 14:30–15:00.
  - Na tela Escalas do dia 3, a Julia aparece com "Peruca 14:30–15:00".
- **Também conferido na amostra** (`?amostra=1`): Elenco, Supervisão e Direção, no computador e no
  celular.

## Produção

- `0051_solicitacoes` foi aplicada no banco de São Paulo em 01/10, com autorização da dona do
  produto.
  - Foi aplicada **só ela**: a `0052_library_page_citations` (Codex) ficou de fora, porque não foi
    autorizada.
  - O banco tem as migrações de 0000 a 0051 (52 no total). RLS conferido, a Barbara continua lá.
