# ASA como secretária — sem modelo de linguagem (levantamento de 16/10/2026)

Decisão dela: **só o motor, sem IA** (custo zero, nenhum dado sai do app). Isto parte do que o motor
já faz e diz o que falta para a ASA ser "a secretária que mora em cada tela".

## O que já existe (conferido no código)

- `services/asa-command-engine.ts` (~1.600 linhas): entende pedidos em português por padrões. Consulta
  34 coisas (Meu Dia, agenda, escala, Livro do Dia, check-in, tarefas, folgas, quem está de folga,
  mensagens, Mural, Biblioteca, pessoas, locais, relatórios…).
- Ações **com prévia e confirmação** (`/asa/actions/:id/confirm`): criar reunião e ajustar rascunho da
  Agenda; criar e editar tarefa (título, prazo, prioridade, responsável, checklist, evidências,
  iniciar, concluir, cancelar); aviso rascunho; mensagem direta e resposta; reagir/reconhecer/comentar
  no Mural; preferências da ASA.
- Memórias por pessoa (`/asa/memories`), sugestões proativas (`/asa/proactive-suggestions`), resumo
  do dia, auditoria (`/asa/audit`), lacunas da Biblioteca.
- 13 poses WebP já em uso nas telas (oi 17 usos, dúvida 13, aviso-importante 10…; atenção e travessa
  só 2 cada, as menos usadas).

## O que falta para o que ela descreveu

| Pedido dela | Hoje | Falta |
|---|---|---|
| "Coloque de folga fulana e beltrana" | A ASA só **consulta** folgas. Não existe ação de folga. | Ação `FOLGA_DEFINIR` em lote (várias pessoas, vários dias), passando pelas mesmas regras de Folgas (prioridade, motivo, cobertura, Registro na mesma transação, aviso). |
| "Faça esta tarefa para mim e tal pessoa" | Tarefa nasce com **um** responsável (`assigneeName`). | Lote de tarefas: um nome vira N tarefas (ou uma tarefa com participantes, como o lote da tela Responsabilidades). |
| "Recomendar" | Sugestões proativas existem, mas só para a própria pessoa. | Recomendações da gerência: dia sem cobertura, pedido parado perto do prazo, escala por publicar, Livro vazio. A análise de pedido (`analisarPedidoDeFolga`) já calcula isso e pode alimentar a ASA. |
| "Aprender com cada pessoa" | Memórias existem; a pessoa as vê e apaga. | Aprender sem IA = **lembrar o que a pessoa costuma pedir** (horário, local, quem costuma escalar) e oferecer como padrão na prévia. Só com aviso e controle dela. |
| "Morar em cada lugar" | Botão flutuante único; sugestões por rota existem. | Em cada tela, 2–3 pedidos prontos (chips) que já levam o contexto (o dia, o local, a pessoa aberta). Ex.: em Escalas, "folga para…"; em Folgas, "quem cobre esse dia?". |
| Usar as emoções | 13 poses em uso. | Mapear momento→pose de forma fixa (ver abaixo); animar fica para depois. |
| Ícone com o nome fora do círculo | **Corrigido** em 16/10 (commit ff39e4d). | — |

## Mapa de poses por momento (proposta)

- `oi` abrir a conversa · `bom-dia` primeira abertura do dia · `sonolenta` depois das 21h
- `consultando` buscando · `pensativa` pedido ambíguo · `duvida` pergunta de volta
- `estudando` quando for ler a Biblioteca · `lembrete` prazo/lembrete · `atencao` conflito/cobertura
- `aviso-importante` coisa urgente · `tarefa-concluida` ação confirmada · `vencemos` lote grande feito
- `olhos-de-estrela` elogio/reconhecimento · `travessa` brincadeira/primeira vez com um recurso

## Fatias propostas (em ordem; cada uma independente e testável)

1. ~~**Chips por tela** e mapa de poses~~ — **feito em 16/10/2026** (`lib/asa-por-tela.ts`; pedidos prontos sempre visíveis, aviso proativo segue a frequência).
2. ~~**Tarefa para várias pessoas**~~ — **feito em 16/10/2026**: `crie uma tarefa "título" para "Ana" e "Bia" até DD/MM/AAAA` (ou `para mim e "Bia"`), até 20 pessoas; uma prévia, uma tarefa e um Registro por pessoa, um aviso por pessoa. Se um nome falhar, nada é criado.
3. ~~**Folga em lote pela ASA**~~ — **feito em 16/10/2026**: `coloque de folga "Ana" e "Bia" nos dias 20/10/2026 e 22/10/2026` (ou `de 20/10/2026 a 24/10/2026`, `de recesso`, `tire a folga de "Ana" do dia 20/10/2026`). Só Administração e Supervisão da área (a Direção e o Elenco recebem um não que explica). A prévia lista pessoas e dias, o que vai ser substituído e os avisos de cobertura (mesma análise do pedido de folga); mês já publicado exige `com motivo "texto"`. Aplica pela mesma função da grade (`aplicarFolgasEmLote`), com um Registro por lote marcado `via: ASA`. Desfazer = pedir `tire a folga`.
4. **Recomendações da gerência** no começo do dia (cobertura, prazos, o que falta publicar).
5. **Lembrar padrões da pessoa** (opt-in).

Cada ação continua: prévia → confirmação → `writeHistoryEvent` na mesma transação → aviso a quem precisa,
e "Dá para desfazer?" respondido antes de construir.

## Mapa: o que a ASA faz hoje em cada tela e o que falta (16/10/2026)

A meta dela: a ASA mora em **toda** tela e faz o que a tela oferece, a partir de uma frase simples, sempre com prévia,
confirmação, Registro e aviso a quem precisa. Sem modelo de linguagem, "falar do seu jeito" se resolve com: leitor de datas
(`services/asa-datas.ts`), nomes achados na lista de pessoas (`acharPessoaPorNome`, `acharPessoasNoTexto`) e verbos variados
por ação. Cada ação nova segue o padrão das três fatias já feitas (prévia → confirmar → Registro na mesma transação → aviso).

| Tela | O que a tela oferece | A ASA já faz | Falta |
|---|---|---|---|
| Meu Dia | ver o dia, check-in | consultar | check-in por mensagem ("cheguei") |
| Escalas | ver, ajustar célula, atividade manual, programação, publicar | consultar | ajustar/trocar pessoa, atividade manual para várias pessoas, publicar (Administração) |
| Shows | criar show, personagens, favoritos | consultar | criar show/personagem, favoritar |
| Livro do Dia | gerar, ajustar vaga, publicar, executar | consultar | gerar o dia, trocar quem cobre uma vaga, publicar |
| Check-in | check-in por turno, ocorrência | consultar | registrar check-in e ocorrência |
| Responsabilidades | tarefas, responsabilidades | **criar tarefa (várias pessoas), editar, concluir, cancelar, comentar** | criar responsabilidade, delegar |
| Folgas | mapa, lote, grupos, regras | **folga em lote e tirar** | aplicar grupo de folga, mudar regras (Administração) |
| Solicitações | pedir, decidir, trocar | consultar | pedir a própria folga, aprovar/recusar com motivo, propor troca |
| Painel | contagens do dia | consultar | — (leitura) |
| Locais / Áreas / Pessoas | cadastros | consultar pessoas e locais | criar/editar pessoa, mudar área, desligar (com motivo) |
| Registro | histórico | — | "o que mudou na folga da Ana?" |
| Mural | avisos, reconhecer | **ciente, reação, comentário, rascunho de aviso** | publicar aviso, datas especiais |
| Mensagens | conversas e grupos | **enviar e responder** | criar grupo |
| Biblioteca | documentos, leitura | buscar, citar, pendências | marcar "li e entendi" |
| Agenda | reuniões, ensaios | **criar reunião, ajustar rascunho** | confirmar, remarcar, cancelar compromisso |
| Perfil | foto, silêncio, preferências | preferências da ASA | silêncio noturno, privacidade |
