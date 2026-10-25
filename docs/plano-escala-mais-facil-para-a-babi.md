# Escala do dia: mais fácil de preencher, de conferir e de publicar

Texto para conversa com a Babi. Nada disso foi feito ainda no app: é um plano para aprovar.

- `plano-escala-mais-facil-visual.html`: o plano com desenhos.
- **`prototipo-escala-mais-facil.html`: um protótipo para clicar** (abre no navegador, no computador ou no celular). Nele dá
  para trocar entre Supervisão, Administração e Elenco, ver a Escala por pessoa e por atividade, abrir um Livro do dia,
  resolver uma vaga, mudar o horário só de uma pessoa, preencher em lote, enviar a parte, publicar tudo e ver o que o
  Elenco enxerga. Os dados e os nomes são de exemplo, e nada do app muda. Vale clicar nele antes de responder às perguntas.

## O que NÃO muda (o conceito já está certo)

- A Programação (a da semana, como é hoje) diz o que acontece no dia e, quando tem show, o **Livro do Dia nasce sozinho** a
  partir do Livro oficial do show.
- A Escala já tira de folga, recesso e afastamento. O Livro do Dia usa a Escala e **já se resolve sozinho**: titular, depois
  substituto da posição, depois reserva do grupo.
- O Livro é **do show inteiro**, não da pessoa. A pessoa só é chamada para o show e vê, no celular dela, "você foi chamada
  para o show, você faz tal coisa".
- Folga vence a escala: só entra quem foi chamado de propósito, com motivo escrito.
- Tudo que se grava vai para o Registro. Remoção é sempre restaurável.
- As duas visões que já existem ("Por pessoa" e "Por atividade") continuam.
- Não recriamos nada. Mudamos **o jeito de mexer**: menos repetição, menos cliques e uma tela tão fácil de ler quanto a planilha.

## O problema, com 40 pessoas

1. **Ler o dia é difícil.** A planilha de papel por pessoa funciona porque tem cor forte por tipo, horários alinhados e
   atividades iguais emendadas em faixas. A tela atual repete o mesmo bloco lado a lado, tem cores suaves, toda linha com a
   mesma altura e uma coluna larga por pessoa (a tabela passa de 4.600 px). A visão "por atividade" empilha nomes.
2. **Preencher é um clique por pessoa e por bloco.**
3. **Conferir os shows é manual.** O Livro já tira a folga e coloca a reserva sozinho. O que dá trabalho é descobrir, entre
   vários shows, **o que ele não conseguiu resolver** (vaga sem ninguém, troca de formação) e conferir o que mudou.

## Como o dia passa a andar (o fluxo)

O dia que se prepara é quase sempre **o seguinte**: a escala e o Livro de terça são feitos e publicados na noite de segunda. A Administração define, por local, **a partir de que horas a Escala passa a abrir no dia seguinte** (por exemplo, 18:00) **e a partir de que horas volta a abrir em hoje** (por exemplo, 05:00). A tela diz em que dia está e o botão diz "Publicar a escala de terça".

1. **Cada Supervisão preenche a sua parte** (a Administração preenche qualquer área). A Direção só lê.
2. Confere os **Livros do dia** (cartões na Escala que abrem o Livro) e marca cada um como conferido.
3. **"Enviar minha parte"**: a área fica marcada como pronta (isso já existe hoje, entra no Registro).
4. A Administração vê o local inteiro, uma linha por área, e **"Publicar tudo"**: publica a Escala e todos os
   Livros do dia (o sistema já faz isso hoje, na mesma operação). O botão passa a explicar o que vai acontecer e a pedir confirmação.

- A Administração e a Supervisão veem o rascunho enquanto o dia é montado. **Só o Elenco vê apenas o publicado.**
- Mudança depois de publicado espera a republicação, e a Administração é avisada.

## As etapas

Cada etapa deixa a tela usável e é entregue sozinha.

### Etapa 1: ler o dia como a planilha

- **Um bloco só por atividade**, emendado entre as pessoas que fazem a mesma coisa (um "Ensaio do show" largo, não vários
  iguais lado a lado). **Cor forte por tipo**, sempre com o nome escrito (cor nunca é a única informação). Sete tipos prontos:
  treinos no gelo, ensaios e preparação, shows e teatro, interações e personagens, produção e apoio, pausas e almoço, outras
  atividades. Os tipos são **por local**: só a Administração cria, renomeia e desativa (tipo usado nunca é apagado). O tipo é
  escolhido na Programação; onde ninguém escolheu, o app continua adivinhando pelo nome.
- **Altura proporcional à duração**, linhas de horário alinhadas e colunas estreitas, para o dia caber na tela.
- **Quem não trabalha no dia sai da grade** (folga, recesso, afastamento) e aparece só numa linha compacta no alto, "Não trabalham hoje (3): …, ver todos", que abre a lista por motivo. A busca de pessoa responde mesmo para quem está fora, e quem foi chamado de propósito na folga entra na grade com o motivo escrito. Só aparecem as pessoas que
  trabalham naquele dia.
- **Show é um bloco comum** ("Show Patinação 14:00") em cada pessoa chamada, sem cenas nem posições. Os detalhes ficam no Livro.
- **Resumo no topo**: "38 escaladas · 2 de folga · 1 choque · 3 exceções · 0 sem atividade", cada número abre a lista.
- **Busca de pessoa** (ilumina só o dia dela), **filtro "só exceções e choques"**, aviso informativo de tempo parado
  (sugestão: mais de 40 minutos; nunca bloqueia) e uma faixa com os momentos do dia.
- **Estados explicados na tela:** contorno vermelho = choque de horário; contorno amarelo = exceção (por exemplo, a reserva
  que entrou no lugar de alguém). Cada coluna com problema também traz o aviso escrito.
- **"Por atividade"** passa a dizer "Todo o elenco do dia" em vez de uma lista enorme de nomes.
- No celular, a visão por pessoa continua em cartões empilhados.

### Etapa 2: os Livros do dia dentro da Escala (um lugar só para conferir)

**Não existe uma segunda tela do Livro.** O Livro do Dia que já existe no app continua sendo o lugar onde se vê e se mexe:
nele se navega por outros dias e se "brinca" com o show. A Escala mostra **o que o dia vai virar** (hoje, amanhã…) e só liga as
duas coisas:

- Na Escala, um cartão **"Livros do dia"** por show daquele dia, vindos da Programação: horário, tipo (completo ou só
  personagens), quantas pessoas, **mudança** ("Pessoa M entrou no lugar de Pessoa S, de folga"), **vaga sem ninguém** e se já foi
  **conferido**. É para bater o olho e saber onde olhar.
- Tocar no cartão **abre o Livro do Dia que já existe, no dia e no show tocados** (e volta para a Escala). Serve para show
  completo e para só personagens: a mesma tela, sem dois jeitos de fazer a mesma coisa.
- **Sem ir e voltar.** Um botão **"Conferir os Livros do dia (2)"** abre o primeiro Livro que falta conferir. Ao apertar "Conferido", abre o próximo, e no último **volta sozinho para a Escala**. Se a pessoa tocar num cartão só, depois do "Conferido" também volta sozinho. Quem quer sair antes usa "Voltar para a Escala".
- **Cada Supervisão vê e confere só os Livros dos shows sob a sua responsabilidade**; a Administração vê todos. A fila de conferência de cada pessoa só tem os shows dela.
- O botão **"Conferido"** aparece no próprio Livro e no cartão da Escala, e quem conferiu fica no Registro.
- O Livro já mostra "o que mudou desde que foi gerado" e "sem ninguém escalado hoje"; nada disso é refeito.
- O "Atenção do dia" da Escala só **avisa e leva ao Livro**. Quem decide cada posição é sempre o Livro, nunca a Escala.
- A Escala tem o seletor **Hoje / Amanhã** (e o calendário que já existe), e o Livro abre no mesmo dia que está sendo visto.
- Choque de horário na grade: "Tirar de…", "Mudar horário só desta pessoa", "Dividir" (com motivo, deixando claro que é
  exceção só dela). Show não muda de horário: a saída é tirar do show, pelo Livro.

**O que muda no código (pequeno):** hoje o Livro do Dia sempre abre em hoje, e o atalho que a Escala já tem ("Abrir no Livro do
Dia") abre o Livro de hoje mesmo quando se está vendo outro dia. O ajuste é ler `?data=` e `?livro=` do endereço ao abrir, em umas
dez linhas. A tela do Livro é mexida por outras sessões, então esse ajuste só entra com autorização, em um commit só dele.

**A conferir antes de construir (eu testo no banco de teste):** se alguém entra de folga **depois** de o Livro já ter sido
gerado, o Livro troca sozinho ou continua com a pessoa? Se não trocar, o cartão avisa "folga marcada depois de gerado" e oferece
o botão de gerar de novo que já existe.
### Etapa 3: preencher em lote

- Marcar várias pessoas, ou um grupo que já existe na Programação, e aplicar a atividade de uma vez.
- **Prévia**: quem entra, quem fica de fora (folga ou outra área) e quais choques aparecem. **Desfazer última alteração.**
- Não coloca ninguém em show: show é do Livro, e a janela diz isso.
- A Supervisão só age em pessoas da própria área.

### Etapa 4: enviar a minha parte e publicar tudo

- **Supervisão:** resumo só da própria área, Livros conferidos e o botão "Enviar minha parte". Com pendência aberta, avisa antes.
- **Administração:** resumo do local, **uma linha por área**, e o botão **"Publicar tudo"**, que mostra quantas áreas faltam.
- Pendências dos Livros (a conferir, vaga sem ninguém) aparecem como aviso. Sugestão: avisam, mas não bloqueiam.
- Proposta: se alguém altera uma área já enviada, **a marca cai sozinha** e a Supervisão é avisada no sino, dizendo quem mudou o quê.
- Se duas pessoas mexem no mesmo dia ao mesmo tempo, o app confere a versão ao salvar e avisa com uma frase clara.

### Etapa 5: copiar de outro dia

"Igual ao último sábado." Por último e com confirmação forte, porque pode trazer exceções antigas sem ninguém perceber. Copia só
as atividades e as pessoas que continuam disponíveis, e mostra quem ficou de fora.

### Ajuste de texto, depois da aprovação

Na Programação, "Todo mundo do local" passa a se chamar **"Todas as áreas"**, porque as pessoas não têm local. A regra não muda.
A Programação da semana continua; ganha o campo "Tipo" da atividade, um botão "+ Bloco" de verdade, e fica mais enxuta: o que acontece no mesmo horário aparece **lado a lado em uma linha só**, em vez de uma linha por bloco.

## Ideias para depois (já combinadas, sem pressa)

- **O imprevisto do dia.** Folga e recesso já são conhecidos (a grade de folgas sai no fim do mês). O que sobra é alguém que passa mal ou
  precisa sair no meio do dia. Vai existir **uma ação só**, "Saiu / não vem a partir de [hora]", que tira a pessoa do resto do dia, mostra
  antes quem cobre cada show (a reserva do grupo) e o que fica sem ninguém, avisa quem precisa saber e grava o motivo. Tem desfazer.
- **Gerar a semana e ver o equilíbrio.** Gerar a semana inteira de uma vez (como já existe para o mês) e uma visão "Semana", só de leitura,
  mostrando quantos shows de elenco limitado cada pessoa faz, para ninguém ficar sobrecarregado enquanto outra faz quase nada. Show de
  **elenco todo do show** (como a Patinação) não conta. Cada show terá um interruptor "Conta para o equilíbrio", que vale até alguém
  mudar e **só a partir do dia da mudança** (o que passou não muda).
- **Relatório do mês** (quanto cada pessoa fez), depois de um mês real de uso.

Perguntas novas para a Babi: **11.** Quais shows contam como "elenco limitado" no Snowland (Boas-vindas, Teatro, Musical e Montanha, e a
Patinação não)? **12.** No imprevisto do dia, além da Administração e da Supervisão da área, quem mais deve ser avisado (por exemplo, o
responsável de cada show afetado)? **13.** O que o relatório do mês precisa responder?
## Como a tela deve ser sentida (padrão Apple Design)

- **Responde na hora.** O botão reage no instante do toque. Todo toque tem pelo menos 44 px e nenhum texto fica abaixo de 12 px.
- **Simples não é vazio.** O caminho comum vem primeiro (resumo, exceções, choques) e o resto fica um nível abaixo.
- **Sempre dá para voltar.** Todo lote ou troca tem prévia antes e "Desfazer" depois. Só o que não tem volta pede confirmação.
- **Cada coisa nasce de onde você tocou.** O menu do choque abre junto do bloco tocado. No celular, as janelas sobem de baixo e
  têm sempre o botão de confirmar e o de cancelar à vista.
- **Mesma coisa, mesmo jeito.** A mesma cor quer dizer o mesmo tipo, sempre com o nome escrito.
- **A tela diz onde você está e o que falta.** Dia, local, área e pendências sempre à vista.
- **Cabeçalho e resumo fixos e translúcidos**, com a escala rolando por baixo.
- **Quem pede menos movimento** no aparelho recebe transições simples.

## Perguntas de regra para a Babi

1. **Os sete tipos de atividade estão bons?** Falta algum? Exemplo: "Yeti" é interação ou show? A lista é por local e pode mudar.
2. **"Todo o elenco do dia" vale para quem?** Sugestão: todas as pessoas com atividade no dia, sem folga, recesso e afastamento.
3. **Aviso de tempo parado:** 40 minutos está bom? Será só um aviso, nunca um bloqueio.
4. **Quem pode preencher em lote?** Sugestão: Administração em qualquer área, Supervisão só na própria.
5. **Área enviada e alguém mexe depois: a marca cai sozinha?** Sugestão: sim, com aviso no sino para a Supervisão da área.
6. **Rascunho: a Supervisão vê o de todas as áreas ou só o da própria?** Sugestão: de todas, para conferir choques. Edita só a própria.
7. **"Publicar tudo":** isso já é assim hoje no sistema (publicar a Escala publica os Livros do dia juntos, e só com todas as áreas prontas). Vamos só deixar o botão explicar o que vai acontecer e pedir confirmação. Concorda?
8. **Livro com vaga sem ninguém ou ainda não conferido impede a área de ser enviada?** Sugestão: só avisar, a Administração decide.
9. **Quem confere cada Livro?** Sugestão: a Supervisão responsável pelo show (e a Administração, em qualquer um). Precisa confirmar: ''responsável pelo show'' é a Supervisão da área do show, ou há alguém indicado show a show? O 'Conferido' fica no próprio Livro e no cartão da Escala. Sugestão: a Supervisão da área do show ou a Administração, e quem conferiu fica no Registro.
10. **Horário da virada:** a Administração escolhe, por local, a hora em que a Escala passa a abrir no dia seguinte e a hora em que volta a abrir em hoje. Os valores padrão sugeridos (18:00 e 05:00) servem?
11. **Copiar de outro dia:** copiar só quem continua disponível e mostrar quem ficou de fora?

## Como vai ser feito

- Em um ramo novo, uma etapa por vez, sem tocar no que está em produção e sem mexer no motor do Livro, no Livro do Dia nem no Livro oficial.
- Cada etapa é testada abrindo a tela e clicando, no celular e no computador, com os quatro perfis, antes de ser dada como pronta.
- A etapa 1 precisa de tabela nova para os tipos: primeiro só no banco de teste. Quem constrói o app decide quando levar para produção.
