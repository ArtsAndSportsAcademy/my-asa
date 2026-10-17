# Handoff — restrição de horário, limite de shows por dia e sessão separada (17/10/2026)

Pedido da Babi em 16/10/2026: montar o rodízio do Teatro de Natal (Snowland, 22/10 a 17/01) com Jingle e Bell em
duas sessões (11:30 e 15:30), cada pessoa fazendo uma sessão por dia, sem sobrecarregar ninguém. O desenho está em
`docs/superpowers/specs/2026-10-16-restricao-de-horario-e-limite-do-dia-design.md` e o plano em
`docs/superpowers/plans/2026-10-16-restricao-de-horario-e-limite-do-dia.md`. **Nada foi enviado ao GitHub nem
promovido.** A migração 0071 só rodou no banco de teste.

## O que passou a existir

- **Sessão separada.** Ao adicionar uma sessão ao Show, pergunta-se "tem as próprias vagas e as próprias pessoas?".
  Separada = um Livro do Dia próprio (hora no nome, personagens e fila do rodízio compartilhados com o show). Não
  separada = como sempre foi (um Livro do dia para o show). Um show pode misturar as duas.
- **Restrição de horário por pessoa** (ex.: Sofia, escola): proibição no rodízio. Cadastro em lote, encerrar com motivo,
  reabrir. Tela "Restrições de horário" (Elenco vê "Minhas restrições").
- **Limite de shows por pessoa por dia, por local**, e **intervalo mínimo entre shows** (shows mais perto que isso são
  "colados": o rodízio evita a mesma pessoa, mas escala se não houver outra). Tela: Escalas → "Regras do local".
- **Exceção à mão**: escalar alguém além de uma regra exige motivo escrito (ajuste na Escala ou troca direta no Livro).
  O Registro grava a regra passada e o sino avisa as outras pessoas da Administração e a Supervisão da área.
  Vaga passada à mão (manual) não conta para o limite dos outros Livros.
- **Nenhuma mudança para quem não usa**: sem restrição, sem limite configurado e sem sessão separada, o motor se comporta
  como antes.

## O que a Babi precisa fazer antes de o rodízio funcionar de verdade

1. **Cadastrar o Teatro de Natal como um show só**, com as duas sessões (11:30–12:00 e 15:30–16:00) marcadas como
   **separadas**, e as vagas Jingle e Bell ligadas aos personagens (a planilha ainda tem Jingle e Bell "a definir").
2. **A Programação do Natal precisa de dois blocos** do show (11:30 e 15:30) em cada dia da semana em que o teatro roda,
   com a mesma hora das sessões (o bloco escolhe o Livro pela hora da sessão).
3. **Cadastrar a restrição da Sofia** (segunda a sexta, a partir das 15:00, de 22/10 a quando acabar a escola) e **o
   limite de 3** em Escalas → Regras do local (Snowland).
4. Conferir se a fila Jingle/Bell tem Sofia, Esther, Daia, Kauã, Julia e Bel nessa ordem (fixos primeiro).

## Ordem para promover

1. Migração **0071** (`lib/db/drizzle/0071_restricao_horario_e_limite_do_dia.sql`; rollback em `rollback/`). Quem roda em
   produção é quem constrói o app. (As migrações 0072 e 0073 são de outra frente de trabalho em paralelo.)
2. API. 3. Site.

## Como foi conferido

- `restricao-horario.test.ts` (83 asserts, cenário completo contra o banco de teste), `regras-de-escala.test.ts` (19),
  `restricoes-horario-http.test.ts` (29), `escala-regras-http.test.ts` (16) e `teatro-natal-outubro.test.ts` (as regras
  nos nove dias de 22 a 31/10 com as folgas reais).
- Regressão da geração, do Livro vivo e da Escala (11 testes antigos) passou. **`shift-checkins.test.ts` falhou**: a
  mensagem da janela de check-in depende do relógio e o arquivo já estava modificado antes deste trabalho; não foi
  investigado.
- Telas conferidas no navegador contra a API e a empresa de teste: cadastro para duas pessoas, Regras do local salvas e
  relidas, Esc fechando, a 375 px sem rolagem lateral. Revisão independente do motor feita; achados corrigidos.

## Pontos que ficaram para depois

- O resumo do mês (`resumoDoMes`) conta Livros esperados por show, não por sessão separada; um dia "completo" não
  notaria uma sessão separada nova sem Livro.
- A restrição de horário confere só a hora de **início** do show.
- O aviso "sem horário, restrição não conferida" existe no resultado do motor, mas não aparece em nenhuma tela.
- A conferência por data do Livro do Show (`routes/show-book.ts`) e `advanceRotationCounts` (legado) não aplicam as
  regras novas.
- A exceção feita pela Escala grava o Registro e o aviso numa transação diferente da troca no Livro (padrão
  anterior); em falha rara a pessoa fica no Livro sem Registro da exceção.
- Dois "Gerar" simultâneos, ou um evento da Agenda com `showBookId` na mesma hora da sessão, ainda podem duplicar
  Livro (o botão fica desabilitado enquanto gera).
- Dados de teste: na conferência da tela criei restrições para "Teste Elenco 01" e "02" e limite 3 no Ginásio da
  empresa de teste; depois removi essas linhas (e os avisos que elas geraram na fila).
- Se a Babi preferir **um show com duas sessões e pessoas por sessão sem Livros separados**, é outro desenho (a
  formação hoje vale o dia inteiro por Livro).
