# O que sobrou da revisão 3 (18/10/2026), em etapas

Complementa `plano-etapas-pos-revisao-2026-10-17.md` (etapas 0 a 8) e não repete nada dele. Aqui está só o que
a rodada 3 (`f3cceb2`, relatório em `revisao-ponta-a-ponta-2026-10-17.md`) deixou. Cada etapa de código traz
um prompt pronto; todos mandam ler o `AGENTS.md` primeiro.

A revisão 4 (Registro, Perfil e senha, Biblioteca, Cadastros pela tela, desktop da Supervisão e da
Administração, concorrência) fica para depois destas etapas e está descrita no fim.

## Ordem

| Etapa | Assunto | Quem | Depende de |
|---|---|---|---|
| R3-A | Arremates pequenos (404 de id inválido, texto da Agenda, teste preso à hora) | assistente | — |
| R3-B | Roteiros que pararam por erro dos meus passos (Tarefas até a aprovação, responsabilidades, restrição, ASA) | assistente | — |
| R3-C | Decisões do Mural (publicar para outra área, reconhecer a si mesma) | você decide, depois assistente | sua resposta |
| R3-D | Produção, só leitura: folgas invertidas | você | — |
| R3-E | Conferência no aparelho | você | — |

Os rótulos de 9–10 px no celular já estão na Etapa 5 do plano anterior; não duplique.
R3-A e R3-B podem andar juntas (não mexem nos mesmos arquivos), mas R3-A toca `agenda.ts`, então não rode junto
com a Etapa 4 se ela mexer lá.

---

## R3-A — Arremates pequenos

**Por quê:** coisas pequenas que mascaram erro real ou enganam quem lê a recusa.

**Prompt:**

```text
Leia o AGENTS.md na raiz antes de qualquer coisa. Branch codex/myasa-novo; nunca merge na main; tudo em
português. Banco de teste lento: espere antes de concluir que algo travou.

Contexto: a revisão de 18/10/2026 achou três coisas pequenas (docs/revisao-ponta-a-ponta-2026-10-17.md,
seção "Rodada 3").

1. Id inválido na URL dá 500. Exemplos: PATCH /agenda/events/undefined → 500 "Erro ao atualizar evento",
   POST /agenda/events/undefined/cancel → 500, POST /communication/datas-especiais/undefined/restore → 500
   "Não consegui salvar agora". Deveria ser 404 com frase ("Compromisso não encontrado"). O padrão já existe em
   getDailyBookOrFail (routes/daily-book.ts): confere o formato do uuid antes de ir ao banco. Procure as rotas
   com :id que vão ao banco sem essa conferência (agenda.ts, communication-hub.ts, mural-datas.ts, tasks.ts,
   library.ts, requests.ts, notices.ts) e crie um ajudante único em vez de repetir a expressão regular.
2. Texto de recusa que esquece a Direção: "Apenas administradores e supervisores podem editar eventos" (agenda.ts).
   A Direção age como a Administração na Agenda (AGENTS.md, decisão de 15/10/2026). Confira se a regra deixa a
   Direção editar; se deixa, corrija só o texto; se a regra e o texto divergem, pare e me conte antes de mudar.
3. artifacts/api-server/tests/shift-checkins.test.ts falha fora da janela do turno porque a mensagem muda
   ("ainda não abriu: abre às 08:00" no lugar de "janela"). Faça o teste não depender da hora do dia (relógio
   fixo ou data de referência), sem enfraquecer o que ele afirma.

Crivo: o item 8 (mensagem diz a verdade) e o 2 (recusa que explica). Acrescente testes de regressão para o
404 e rode: o teste que você mexeu, permission-matrix, mural-aberto, grupo-c-communication e os de agenda
(procure em tests/). Tipos da API com o comando do AGENTS.md. Não rode em produção. Não commite .env. Não
envie ao GitHub. Commit em português, prosa longa.
```

---

## R3-B — Roteiros que pararam

**Por quê:** na rodada 3 alguns roteiros terminaram antes da hora por erro dos meus passos (ordem das chamadas,
id errado), não por defeito do app. Ficaram sem conferir: Tarefas até a aprovação, aceitar pedido a
responsabilidade, restrição de horário com janela que realmente impede, e o ASA ao vivo.

**Prompt:**

```text
Leia o AGENTS.md na raiz e docs/empresa-de-teste.md antes de qualquer coisa. Branch codex/myasa-novo; nunca
merge na main; tudo em português. Só no banco de teste. Não commite .env nem escreva senha em arquivo.

Tarefa: escreva e rode roteiros (scripts fora do repositório, na pasta temporária) contra o servidor local
com a empresa de teste, um perfil por vez, e relate o que o app responde, separando "defeito do app" de
"erro do roteiro".

1. Tarefa em etapas até o fim: criar fila costura → ferro → aprovação; cada pessoa começa e conclui a sua
   na vez; a aprovação por quem pode; pedir ajuste com motivo; aprovar; conferir quem é avisado em cada
   passo (um aviso por acontecimento) e o que o Registro guarda. Tentar aprovar a própria tarefa.
2. Responsabilidades: criar, dar dono (o corpo exige memberId), Elenco faz pedido à responsabilidade, a dona
   aceita (vira tarefa) ou recusa com motivo; estranho não consegue aceitar; Direção vê e cobra.
3. Restrição de horário que realmente impede: escolher um show cujo horário de início fica FORA da janela da
   pessoa; ajustar sem motivo deve dar 409 e com motivo gravar a exceção e avisar a Administração. Também o
   limite de shows por dia, com dois shows no mesmo dia.
4. ASA: a rota é POST /asa/chat/:conversationId/messages (SSE) e a conversa vem de POST /asa/conversations;
   descubra o formato certo da resposta (o roteiro anterior leu o id no lugar errado). Só rode o que não
   chama a IA se não houver chave de teste configurada; se houver, rode: tarefa para duas pessoas com
   confirmação, folga em lote (cancelar a proposta), data inexistente, pedido sem sentido, tentativa de
   injeção, e os limites por perfil (Supervisão de outra área, Elenco, Direção). Elenco não lê nem escreve na
   conversa de outra pessoa.

Para cada defeito do app: corrija se for pequeno e seguro (com teste), senão descreva e peça decisão. Passe
pelas 16 perguntas do crivo. Atualize a seção "Rodada 3" do relatório com o resultado. Não rode em produção.
Não envie ao GitHub.
```

---

## R3-C — Decisões do Mural (você responde, depois eu faço)

Duas perguntas curtas:

1. **Quem publica para a área de outra pessoa no Mural?** Hoje o Elenco e a Supervisão publicam para qualquer
   área. Se é "Mural aberto", fica como está. Se a Supervisão só deve falar com a própria área (e o Elenco só
   com a casa ou colegas), é uma regra nova em `services/mural-destinos.ts`.
2. **Reconhecer a si mesma:** hoje é aceito, sem aviso a ninguém, e o teste `mural-avisos` afirma isso de
   propósito. Recusar com frase ("reconhecimento é para os colegas") ou manter?

Quando responder, a mudança é pequena: uma regra em `mural-destinos.ts` e/ou na rota de publicar, mais o teste.
Se for recusar a si mesma, o teste antigo muda junto.

---

## R3-D — Produção, só leitura (você roda)

**Por quê:** antes da correção de 18/10, dividir uma folga em intervalo podia gravar a data final antes da
inicial. Pode haver linha assim em produção.

Rode **só leitura** e me conte o resultado antes de qualquer correção:

```sql
-- folgas ativas com intervalo invertido
select id, user_id, start_date, end_date
from folgas
where active = true and end_date < start_date;
```

Ajuste o nome da tabela e das colunas ao esquema real (confira em `lib/db/src/schema`). Se aparecer linha,
não corrija na mão: me traga as linhas, que eu preparo um script de correção com rollback, para você rodar.

---

## R3-E — Conferência no aparelho (você)

Coisas que eu não consigo fazer daqui:

- Perfil (foto, nome, trocar senha) e o PDF da Biblioteca, no telefone.
- Livro do Dia com o teclado aberto; o "×" que tira posição não pode pegar a linha vizinha.
- Arrastar os marcadores do mapa do palco com o dedo.
- Push de verdade (instalar na tela de início, permitir aviso, receber uma mensagem).
- Imprimir a Escala.

Se algo estiver errado, me diga a tela, o perfil e o aparelho.

---

## Revisão 4 (depois destas etapas)

Foco: o que a rodada 3 não alcançou a fundo.

1. **Registro:** toda escrita nova grava `writeHistoryEvent` na mesma transação, com o motivo quando a ação é
   exceção; quem lê o quê; filtro e busca.
2. **Perfil, senha e sessões:** troca de senha, sessões abertas, encerrar sessão, foto, o que a pessoa pode e
   não pode mudar sozinha.
3. **Biblioteca:** publicar, versões, arquivar e restaurar, "quem já leu", pedido de material, Direção só leitura.
4. **Cadastros pela tela:** Pessoas, Locais, Áreas e Operações com cada perfil, a 375 px e em desktop, com as
   16 perguntas.
5. **Desktop da Supervisão e da Administração:** todas as telas, não só as que mudaram.
6. **Concorrência:** duas pessoas editando a mesma coisa (Escala, Livro, Mural, Tarefa), o aviso de versão
   mudou, nada se perde em silêncio.
7. **Notificações:** entrega do push e do sino, um aviso por acontecimento, quem não deve receber.
8. **Bateria completa de testes** (a Etapa 8 do plano anterior cobre; aqui só entra o que for novo).
