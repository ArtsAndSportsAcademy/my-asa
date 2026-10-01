# Bloco 2 — entidades próprias

Prompt para o Codex. Cole inteiro. Referências: `01-modelo-de-dados.md` (campos),
`03-regras-de-negocio.md` (regras), `09-decisoes-confirmadas.md` (decisões da auditoria).

---

## Prompt

> Bloco 2 do plano de construção do My ASA. O Bloco 1 está aceito e validado contra Postgres
> real — não altere o que ele entregou (ledger de rodízio, motivo obrigatório, 409 com diff,
> regeneração em transação). O Bloco 2 promove a entidades próprias cinco conceitos que hoje
> vivem como texto livre ou como status escondido em outra tabela.
>
> ### O que criar
>
> **1. Personagem** — `id`, `nome`, `local_id` fk, `modo` enum (`titular` | `rodizio`).
> Nomes reais: Astrid, Guardião, Chocolato, Igno, Mensageiro, Mensageira, Rainha, Yeti, Nanook.
>
> **2. PersonagemElenco** — `personagem_id`, `pessoa_id`, `ordem` (posição na fila),
> `vezes_feitas` inteiro. Titular é o de `ordem` 0. No modo rodízio entra quem tem menor
> `vezes_feitas`; empate desempata pela `ordem`.
>
> **3. Sessao** — `id`, `show_id` fk, `inicio` hora, `fim` hora, `horario_chamada` hora
> opcional. Um show pode ter várias sessões no mesmo dia (ex.: 10:00–11:00 e 16:00–17:00).
>
> **4. Formacao** — `id`, `nome`, `quantidade_pessoas` inteiro, `posicoes` json,
> `show_id` opcional, `vezes_usada`, `ultima_vez_em`. Índice em `quantidade_pessoas`.
>
> **5. Ocorrencia** — `id`, `pessoa_id`, `data`, `tipo`, `descricao`,
> `estado` enum (`aberta` | `em_analise` | `resolvida`), `registrada_por`,
> `motivo` texto obrigatório. É entidade com ciclo de vida próprio, **não** um status dentro
> do check-in: uma ocorrência pode nascer sem check-in e continuar aberta depois do dia acabar.
>
> ### Dois pontos que decidem se o bloco presta
>
> **Personagem deixa de ser string.** Onde hoje existe nome de personagem em texto, passa a
> existir `personagem_id`. Isso inclui as filas de rodízio que o Bloco 1 acabou de consertar:
> o ledger passa a referenciar o id. Portanto a migração é **de dados, não só de schema** —
> crie as linhas de Personagem a partir dos nomes distintos que já existem, mapeie as
> referências antigas para os ids novos, e só então aplique a constraint de fk. Se sobrar
> qualquer nome sem par, **pare e me mostre a lista** em vez de criar um personagem órfão ou
> descartar a linha. O teste do Bloco 1 tem que continuar passando depois da migração —
> rode-o como parte do aceite deste bloco.
>
> **Sessao nasce com `fim` obrigatório.** O Bloco 3 detecta conflito de horário comparando
> intervalos; sem `fim`, não há intervalo e o Bloco 3 não tem como existir. `inicio` e `fim`
> são NOT NULL, com check de que `fim` > `inicio`. `horario_chamada` é o único opcional dos três.
>
> ### Regras que valem aqui
>
> - Constraint no banco, não só validação na aplicação. Enum como tipo do Postgres ou check
>   constraint — não texto livre.
> - Uma pessoa não pode ocupar duas posições na mesma cena: garanta isso por unique
>   constraint, não por lógica de tela.
> - Nada de apagar: desligar é `ativa = false` / `encerrado = true`.
> - Toda escrita sensível grava em Registro: quem, quando, o quê, entidade, antes, depois, motivo.
> - Migrações incrementais e reversíveis, na mesma numeração que o Bloco 1 (0018, 0019…).
>
> ### Aceite
>
> Precisa de teste rodando contra o Postgres de teste, não só typecheck. O que quero ver
> passando:
>
> 1. Show com duas sessões no mesmo dia, cada uma com início e fim distintos, ambas válidas.
> 2. `fim` <= `inicio` é rejeitado pelo banco.
> 3. Rodízio continua dando 1 avanço por personagem/pessoa/dia **depois** da migração para
>    `personagem_id` — ou seja, o teste do Bloco 1 passando sobre o schema novo.
> 4. Busca de Formacao por `quantidade_pessoas` retornando as formações daquele número.
> 5. Ocorrência criada sem check-in associado, e transição `aberta → em_analise → resolvida`
>    com motivo obrigatório em cada mudança.
> 6. Pessoa em duas posições da mesma cena é rejeitada pela constraint.
>
> Não inicie os Blocos 3 e 4. Quando terminar, mande a saída do teste e a lista de migrações
> aplicadas.

---

## Depois deste bloco

Corrigir a dívida dos fixtures de Operações/Livro do Dia (usuários sem `user_roles` → 403).
Deixada para o fim do Bloco 2 de propósito: o modelo de perfis só estabiliza aqui.
