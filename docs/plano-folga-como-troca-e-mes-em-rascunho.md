# Plano — folga como troca, mês em rascunho e folgas em lote

Escrito em 13/10/2026, a partir de como a casa trabalha de verdade. Nada aqui foi implementado
ainda. As três frentes se encaixam numa só: **sem o mês gerado, não dá para dizer se uma troca de
folga é viável**, e é isso que hoje faz a gerência abrir tudo à mão para decidir um pedido.

## O entendimento que muda tudo

Hoje o app trata pedido de folga como **folga nova**: aprovou, nasce uma folga. Na prática da ASA
quase nunca é isso. A pessoa já tem as folgas do mês; quando ela pede um dia específico, a gerência
procura **qual folga dela dá para mover** para aquele dia. Às vezes nem precisa trocar com ninguém;
às vezes precisa que alguém assuma o show dela.

Isso tem uma consequência direta: do jeito atual, aprovar um pedido **aumenta** o número de folgas
da pessoa no mês e quebra a conta mensal — a regra que a Babi explicou (duas por semana, contadas no
mês). O pedido precisa nascer sabendo que é uma troca.

Três formas, e o app deve distinguir:

| Forma | O que acontece | Conta do mês |
|---|---|---|
| **Troca de dia** (a mais comum) | devolve a folga do dia Y, fica com o dia X | não muda |
| **Troca com colega** | A e B trocam os dias entre si | não muda para nenhuma das duas |
| **Folga a mais** | exceção: um dia a mais, sem devolver nenhum | muda — e precisa de decisão explícita |

## Etapa 1 — Folgas em lote

Pintar célula por célula vira trabalho braçal, e é onde o erro entra.

**O que já existe:** marcar várias datas **de uma pessoa** (`/folgas/grid/bulk`, que é o "+ semana")
e repetir o mês anterior inteiro (`/folgas/grid/repeat`).

**O que falta:**

- **Várias pessoas de uma vez** — escolhidas a dedo, por área, ou por grupo.
- **Padrão por dia da semana** — "toda segunda", "toda quarta e quinta", dentro de um período.
- **Datas soltas e intervalos** na mesma marcação.
- **Prévia antes de aplicar**: "vai marcar 24 folgas para 6 pessoas; 3 dias já tinham folga e ficam
  como estão" — a pessoa confirma sabendo o tamanho do que fez.
- **Um registro por lote**, não 24 registros soltos, para o histórico ficar legível.
- **Grupos de folga**: na alta temporada as duas folgas são fixas por grupo (regra da Babi). Guardar
  "Grupo A: segunda e terça / Grupo B: quarta e quinta" e aplicar ao mês com um clique.

Esta etapa é independente das outras, rende de imediato e é a de menor risco. Começa por aqui.

## Etapa 2 — Gerar o mês inteiro em rascunho

Hoje o dia é gerado um a um. A proposta é **gerar o mês do local inteiro em rascunho**, para o mês
chegar 80% pronto e a gerência só conferir.

**Por que vale:** com o mês montado, dá para ver como os shows ficam, perceber cedo quem está
sobrecarregado, e — principalmente — responder a um pedido de folga sabendo o que acontece naquele
dia. É a base das etapas 3 e 4.

**O que ajuda:** a Escala do dia é **montada na leitura**. Quem entra em cada bloco é resolvido na
hora, então uma folga marcada depois já aparece sozinha nos dias em rascunho. Não há desatualização
a sincronizar.

**O Livro do Dia passa a ser vivo também** (decidido em 13/10). Hoje ele **congela** quem faz cada
vaga no momento em que é gerado, e por isso uma folga marcada depois deixa o livro com alguém que
não trabalha mais naquele dia. A decisão é que o livro funcione como a Escala: **ele se completa
sozinho na leitura**, e a gerência só confere e mexe no que quiser.

O caminho já existe e está provado na Escala:

- **Quem faz cada vaga é resolvido na hora**, pela mesma fila (titular, depois rodízio), sem quem
  está de folga.
- **O que a gerência mexer à mão fica guardado como exceção daquele dia** — igual aos ajustes da
  Escala, que sobrevivem à remontagem. Trocar alguém continua valendo; o resto acompanha.
- **Dia publicado continua preservado**: quem faz vê a versão publicada até a republicação, e dia
  executado vira registro do que aconteceu e não se remonta nunca mais.

É a mudança mais estrutural do plano, e a que mais trabalho dá — mas é ela que faz o mês em rascunho
valer a pena, porque sem isso cada folga nova estragaria os livros já gerados.

**Cuidados reais:**

- **Volume.** 31 dias × 5 shows × um local são centenas de escritas. Tem de rodar em segundo plano,
  com andamento visível, e poder ser interrompido sem deixar meio mês montado.
- **Ordem do rodízio.** O rodízio escolhe quem fez menos vezes. Gerar o mês tem de resolver **dia a
  dia, em ordem**, senão todos os dias enxergam a mesma contagem e a distribuição sai errada.
- **Publicação continua dia a dia** (decidido em 13/10). Gerar o mês não publica nada: ninguém é
  avisado enquanto está em rascunho, e a Administração continua assinando dia por dia.

## Etapa 3 — Pedido de folga analisado pela ASA

O pedido chega para a gerência **já analisado**, para ela só decidir.

**No pedido**, a pessoa diz o dia que quer e, se souber, qual folga devolve. Se não souber, marca
"não sei, me ajuda" e a ASA propõe.

**O que a ASA confere**, no momento do pedido e de novo se o mês mudar:

1. **No dia pedido** — quais vagas ela cobre e o que fica descoberto se ela sair; quem mais está na
   fila daquela vaga e está livre naquele dia (sem folga e sem outro show no mesmo horário).
2. **No dia devolvido** — ela volta a trabalhar; isso tira alguém de alguma vaga, ou ela entra onde
   hoje falta gente?
3. **A conta do mês** — a troca mantém o número de folgas dela? O dia de parque fechado (quarta em
   Snowland, segunda em Acquamotion) continua respeitado?
4. **Equilíbrio** — a troca faz alguém passar a fazer mais shows que o resto do grupo?

**O veredicto** vem em uma frase, com o porquê:

- *"Dá, sem trocar com ninguém: no dia 22 as suas duas vagas têm a Carol e a Isa livres."*
- *"Dá, se a Carol trocar com você: ela é a única outra que faz a Astrid naquele dia."*
- *"Não dá: no dia 22 você é a única na fila do Yeti, e quem está livre não faz esse personagem."*

A gerência vê pedido + veredicto + o que muda, e decide num clique. Aprovar aplica a troca inteira
numa transação — tira a folga do dia devolvido, cria a do dia pedido —, grava no Registro e marca o
mês como "mudou depois de publicar", para a republicação avisar quem foi mexido.

**Depende da Etapa 2:** sem o mês montado, não há o que conferir.

## Etapa 4 — Experimentar os grupos da alta temporada

Antes de fechar os grupos fixos, poder **experimentar**: aplicar um desenho de grupos, gerar o mês
em rascunho e ver um resumo de equilíbrio — shows por pessoa, folgas por pessoa, quem ficou acima da
média, quais vagas ficaram descobertas. Se não agradar, desfazer e tentar outro desenho.

É o que evita o problema que você descreveu: alguém acabar fazendo mais que os outros porque o
desenho das folgas empurrou o rodízio.

Começa simples: aplicar, gerar, ler o resumo, desfazer. "Cenários" guardados lado a lado podem vir
depois, se fizer falta.

## Ordem sugerida

1. **Folgas em lote** — independente, alivia o trabalho braçal agora.
2. **Gerar o mês em rascunho** — destrava o resto.
3. **Pedido como troca, com a análise da ASA** — o que mais muda o dia a dia da gerência.
4. **Experimentar grupos** — quando os três primeiros estiverem rodando.

## Etapa 2, parte 2 — plano detalhado: gerar o mês em rascunho (14/10/2026)

### O que já existe e vamos reaproveitar

- **Gerar um dia já existe** (`POST /escalas/dia/gerar`, só Administração): cria a Escala em rascunho
  do local naquela data e um Livro do Dia em rascunho para cada show que a Programação pede. É
  **idempotente** — rodar de novo não duplica, não apaga ajuste, e recusa dia já publicado. O mês
  inteiro é esse mesmo passo repetido dia a dia; **não existe regra nova de geração**.
- **Como o Livro agora é vivo**, o mês gerado não envelhece: folga marcada depois já aparece sozinha
  nos dias em rascunho, sem regenerar nada.
- **Dias de funcionamento do local** já estão cadastrados (`operating_days`, e `closed`). Parque
  fechado na quarta (Snowland, a partir de novembro) simplesmente não entra no mês.
- **Limite do servidor**: cada chamada na Vercel vive no máximo 60 s (`maxDuration` do `my-asa`).
  Gerar o mês numa chamada só **não cabe**.

### Como vai funcionar para quem usa

Na Escala, um botão **"Gerar o mês"** (só Administração). O diálogo pergunta o local e o mês e já
diz o tamanho: *"Snowland, novembro: 26 dias abertos, 4 já gerados, 0 publicados. Vai gerar 22
dias."* A pessoa confirma e vê **andamento de verdade** ("dia 9 de 22 · 41 Livros"), com botão
**Parar** que deixa tudo consistente (o que já foi gerado fica, o resto espera).

- **Quem dirige o trabalho é a própria tela**, chamando o servidor **um bloco de dias por vez** (cada
  chamada com orçamento de ~40 s e devolvendo "gerei estes dias, faltam estes"). Não precisa de fila
  nem de processo novo, **retoma sozinho** de onde parou se a aba fechar (os dias gerados já existem
  e são pulados), e mostra andamento real.
- **Em ordem, dia a dia** (do dia 1 ao 31), nunca em paralelo: o rodízio e o equilíbrio por carga
  dependem do que os dias anteriores já escalaram.
- **Pula, com o motivo à vista**: dia fechado, dia já publicado, dia com Escala já em rascunho (só
  completa os Livros que faltam). No fim: *"22 gerados · 4 já existiam · 3 fechados · 1 falhou
  (Acquamotion 17/11: show sem vagas)"* — a falha de um dia **não derruba os outros**.
- **Nada é publicado e ninguém é avisado.** Rascunho é rascunho (regra de sempre).
- **Registro**: cada bloco grava um evento com os dias gerados e quem pediu (um por bloco, não um por
  dia).

### Dá para desfazer? (pergunta 7 do crivo)

**"Descartar rascunhos do mês"**: arquiva as Escalas e cancela os Livros **que ainda estão em
rascunho**, de forma lógica e restaurável, com motivo escrito. Dia com publicação nunca é tocado.
Dia em que a gerência **mexeu à mão** (ajuste na Escala, vaga `manual`, atividade manual) é listado
antes e só entra se ela confirmar, para ninguém perder trabalho sem querer.

### Trabalho, em ordem (cada passo se promove sozinho)

1. **Sondagem do rodízio (antes de construir).** O contador do rodízio só avança na publicação, e o
   equilíbrio por carga conta as vagas guardadas dos outros dias. Com o mês todo gerado, preciso
   **medir** se a leitura ao vivo de um dia mantém a mesma pessoa ou vai trocando conforme os outros
   dias aparecem (ver "Risco" abaixo). É um script de medida, sem tela, que decide o desenho do passo 2.
2. **Servidor**: extrair o "gerar um dia" numa função reaproveitável; `POST /escalas/mes/gerar`
   (bloco de dias com orçamento de tempo, devolve andamento) e `GET /escalas/mes/resumo` (o que o
   diálogo mostra antes de confirmar). Testes contra o banco de teste.
3. **Tela**: botão e diálogo "Gerar o mês", andamento, parar, resultado com motivos; texto que
   acompanha o contexto (mês, local); conferido a 375 px.
4. **Descartar rascunhos do mês** (servidor + tela), com a lista do que seria perdido.
5. **Visão do mês** (opcional, se couber): uma grade pessoa × dia mostrando quem trabalha em quê e
   quem está de folga, para **ver o mês montado**. É o que a Etapa 3 (pedido como troca) vai precisar.

### Risco principal — e a decisão que preciso de você

Hoje o motor escolhe, entre os disponíveis, **quem tem menos shows no mês** (somando as vagas já
guardadas dos outros dias) e só depois o contador do rodízio. Com o mês todo em rascunho, cada dia
passa a "enxergar" os outros. Dois cuidados:

- **Estabilidade**: ler o dia 5 hoje e amanhã pode dar pessoas diferentes só porque outros dias foram
  gerados, sem folga nenhuma. Isso seria confuso ("o rascunho mexe sozinho"). A sondagem do passo 1
  mede isso. Se for um problema, a saída é **fixar a escolha de cada dia ao gerar o mês** (a pessoa
  fica gravada, como era antes do Livro vivo) e só **reabrir a escolha** quando houver folga ou troca
  que a invalide — o que é fácil de explicar: *"o mês nasce montado em ordem; mudou a folga, só o que
  mudou se refaz"*.
- **Justiça**: gerar em ordem faz o equilíbrio por carga distribuir bem pelo mês (quem já tem mais
  shows passa a vez). Quem decide o que "justo" significa para o rodízio é a Babi.

### Resultado da sondagem do rodízio (14/10/2026)

Medido no banco de teste com `tests/sondagem-mes-rodizio.test.ts` (14 dias × 2 shows, 6 pessoas, 2
personagens em rodízio compartilhados entre os shows, gerado em ordem):

- **Estabilidade**: 4 de 56 vagas (7%) mostram, na leitura ao vivo, uma pessoa diferente da gravada na
  geração, sem folga nenhuma — é o equilíbrio do mês inteiro entrando na conta (a geração em ordem só
  via os dias anteriores).
- **Reação a uma folga**: uma folga no dia 8 mudou **1 vaga em 1 dia** (o próprio dia 8). Sem efeito
  cascata sobre os outros dias.
- **Distribuição**: cada pessoa ficou com 9 vagas no mês (uma com 11). O equilíbrio por carga distribui
  bem.

**Decisão: não fixar a escolha ao gerar o mês.** O rascunho é sempre lido ao vivo, então a pessoa nunca
chega a "mudar sozinha" diante de quem olha: o que a tela mostra é sempre o resultado atual, e uma folga
só mexe no dia da folga. Fixar traria o problema contrário (rascunho velho depois de folga). O tempo de
gerar um Livro foi ~13 s (média) no banco de teste, que é muito mais lento que o real; mesmo assim o
bloco de dias com orçamento de tempo é o desenho certo.

### Decisões tomadas (14/10/2026)

1. Só a **Administração** gera o mês.
2. Pode gerar o mês corrente e **até 2 meses à frente** (não 3), com aviso se a Programação do mês
   não existir.
3. Dia **sem Programação**: o dia é recusado e listado ("sem Programação nestes dias").
4. **Descartar rascunhos** entra junto, na primeira entrega.
5. A **visão em calendário** fica para a Etapa 3 (ver o desenho abaixo).

### Visão do mês (Etapa 3) — desenho

Duas visões, porque respondem perguntas diferentes:

- **Calendário do local**: cada dia é uma célula com o estado (fechado, sem Escala, rascunho,
  publicado, "mudou depois de publicar") e sinais de atenção (vaga descoberta, gente chamada na
  folga). Clicar no dia abre a Escala dele. É a que se usa logo depois de "Gerar o mês".
- **Grade pessoa × dia**: quem trabalha em quê e quem está de folga, no mês inteiro. É a base do
  pedido de folga como troca (a ASA precisa olhar a pessoa e o dia ao mesmo tempo).

### Decisões (versão original das perguntas, para registro)

1. **Quem pode gerar o mês?** Só a Administração (como o dia hoje) — ou a Supervisão também, para o
   próprio local? *(Recomendo só Administração, como já é; a Supervisão vê o resultado.)*
2. **Meses à frente**: pode gerar qualquer mês futuro, ou só o corrente e o próximo? Mês distante
   demais (ex.: janeiro em outubro) depende de Programação, folgas e personagens que ainda não estão
   fechados. *(Recomendo permitir até 3 meses à frente, com aviso se a Programação do mês não existir.)*
3. **Mês sem Programação** (ou parte dele): gerar só as Escalas vazias, ou recusar e dizer o que
   falta? *(Recomendo recusar o dia e listar "sem Programação nestes dias".)*
4. **Descartar rascunhos**: precisa existir já na primeira entrega, ou pode vir logo depois? *(Recomendo
   junto — sem desfazer, ninguém gera um mês com tranquilidade.)*
5. **Visão do mês (passo 5)**: entra agora ou fica para a Etapa 3, que é quando mais vai precisar?

## Etapa 2, parte 1 — decisões técnicas do "Livro do Dia vivo" (14/10/2026)

O motor que decide quem faz cada vaga (`resolveAssignmentsByRole`, em `services/line-resolver.ts`)
já existe e já é usado para gerar e para regenerar — a mesma fila (titular, depois rodízio, sem
quem está de folga) que a Escala usa. A mudança é **chamar esse motor também na leitura**, não só
na geração, e guardar como exceção só o que a gerência mexeu à mão — exatamente como
`escalaBlocoAjustesTable` faz pela Escala.

- **Uma coluna nova** (`manual`, booleana) na vaga do Livro do Dia. Marca quando a gerência trocou
  aquela vaga à mão (pela Escala, que já é o caminho real — "Trocar alguém na Escala troca a vaga
  aqui também"). Vaga marcada `manual` não é mais recalculada sozinha; o resto continua.
- **Leitura ao vivo**: para livro em rascunho, publicado ou republicado, a vaga sem `manual` é
  recalculada na hora com o mesmo motor da geração — titular, rodízio, sem quem está de folga. Livro
  executado ou cancelado nunca mais recalcula: é o registro do que aconteceu.
- **Publicado continua preservado**: quem faz vê a foto da última publicação/republicação
  (`snapshotJson`, que já existe) até a Administração publicar de novo — igual à Escala. Quem
  publica (Administração/Supervisão/capitão delegado) sempre vê a versão ao vivo, para decidir se
  republica.
- **Executar e cancelar gravam de vez**: no instante de executar ou cancelar, o que estava ao vivo
  é escrito nas vagas de verdade (não só mostrado) — para o registro do "o que aconteceu" não voltar
  a depender de recálculo depois que o livro virou histórico.
- **O contador do rodízio não muda de quando avança.** Continua avançando na publicação, para o
  vencedor que foi gerado — mesmo que a disponibilidade mude entre gerar e publicar. Isso já é
  testado e intencional (ver `daily-book-fill.test.ts`, teste "(c)"); mexer nisso é risco separado,
  não faz parte desta etapa.
- **Achado durante o teste — o rodízio não pode pesar o próprio dia.** Publicar avança o contador do
  vencedor (em `characterCastTable.timesDone` e em `config.executionCounts`, os dois vitalícios e
  sem data). Com a leitura ao vivo, a primeira releitura depois de publicar já via "fulano fez hoje"
  e trocava o rodízio sozinho, sem folga nem mexida. O motor (`line-resolver.ts`) agora desconta o
  avanço de hoje dos dois contadores, igual ao equilíbrio por carga já fazia. Os testes antigos do
  rodízio seguem passando.
- **Vaga mantida manualmente que acabou de folga**: por enquanto só avisa (um sinal visível na
  tela), não bloqueia nem desfaz sozinha. O fluxo completo de "chamar na folga com motivo" já existe
  pela Escala (`PESSOA_DE_FOLGA`); estender isso à troca direta no Livro do Dia fica para quando essa
  troca direta ganhar tela própria — hoje a troca de pessoa só acontece pela Escala.

## Decisões já tomadas (13/10/2026)

- **Publicar continua dia a dia.** Gerar o mês é só rascunho.
- **O Livro do Dia passa a ser vivo**, como a Escala: completa-se sozinho e a gerência confere e
  mexe no que quiser; o que ela mexer fica guardado como exceção do dia.
- **A Direção entra no mapa de folgas** normalmente.

## Decisões que ainda são suas

1. **Folga a mais existe?** Quando não dá para trocar, a pessoa pode ganhar um dia a mais — e aí a
   conta do mês fica diferente para ela — ou o pedido simplesmente é negado?
2. **Os grupos de folga** são definidos por quem, e valem por mês ou por temporada?
3. Quando a ASA diz *"dá, trocando com a Carol"*: **a Carol precisa aceitar antes** de o pedido ir
   para a gerência, ou a gerência decide e a Carol é avisada?
