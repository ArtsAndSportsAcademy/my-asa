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

**O que não é automático:** o **Livro do Dia congela** quem faz cada vaga quando é gerado. Se uma
folga cair depois num dia cujo livro já existe em rascunho, aquele livro fica com alguém que não
trabalha. Precisa de uma das duas: refazer sozinho o livro em rascunho afetado, ou marcar o dia como
"precisa revisar". **Dia publicado não se mexe sozinho** — continua pedindo republicação, como já é.

**Cuidados reais:**

- **Volume.** 31 dias × 5 shows × um local são centenas de escritas. Tem de rodar em segundo plano,
  com andamento visível, e poder ser interrompido sem deixar meio mês montado.
- **Ordem do rodízio.** O rodízio escolhe quem fez menos vezes. Gerar o mês tem de resolver **dia a
  dia, em ordem**, senão todos os dias enxergam a mesma contagem e a distribuição sai errada.
- **Publicação.** Continua dia a dia, ou passa a ter "publicar a semana / o mês"? É uma decisão sua
  (ver abaixo) — gerar não é publicar, e ninguém é avisado enquanto está em rascunho.

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

## Decisões que ainda são suas

1. **Publicar continua dia a dia**, ou passa a existir publicar a semana/o mês de uma vez?
2. **Folga a mais existe?** Quando não dá para trocar, a pessoa pode ganhar um dia a mais — e aí a
   conta do mês fica diferente para ela — ou o pedido simplesmente é negado?
3. **Os grupos de folga** são definidos por quem, e valem por mês ou por temporada?
4. Quando a ASA diz *"dá, trocando com a Carol"*: **a Carol precisa aceitar antes** de o pedido ir
   para a gerência, ou a gerência decide e a Carol é avisada?
5. O que fazer com **livro em rascunho afetado por uma folga nova**: refazer sozinho ou marcar o dia
   para revisão?
