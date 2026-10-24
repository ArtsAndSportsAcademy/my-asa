# Escala do dia: mais fácil de preencher, de conferir e de publicar

Texto para conversa com a Babi. Nada disso foi feito ainda no app: é um plano para aprovar.

- `plano-escala-mais-facil-visual.html`: o plano com desenhos.
- **`prototipo-escala-mais-facil.html`: um protótipo para clicar** (abre no navegador, no computador ou no celular). Nele dá
  para trocar entre Supervisão, Administração e Elenco, resolver a folga de uma pessoa, mudar o horário só dela, preencher
  em lote, enviar a parte, publicar tudo e ver o que o Elenco enxerga. Os dados e os nomes são de exemplo, e nada do app muda.
  Vale clicar nele antes de responder às perguntas.

## O que NÃO muda (o conceito já está certo)

- A Programação diz o que acontece no dia e, quando tem show, o **Livro do Dia nasce sozinho** a partir do Livro oficial.
- A Escala do dia já tira de folga, recesso e afastamento. O Livro usa a Escala.
- Quem decide cada vaga de show é o motor do Livro: titular, depois substituto da posição, depois reserva do grupo,
  depois rodízio. A Escala só lê e mostra.
- Folga vence a escala: só entra quem foi chamado de propósito, com motivo escrito.
- Tudo que se grava vai para o Registro. Remoção é sempre restaurável.
- Não recriamos nada. Mudamos **o jeito de mexer**: menos cliques, menos esquecimento, mais clareza.

## O problema, com 40 pessoas

1. **Ler o dia é difícil.** A planilha de papel por pessoa funciona porque tem cor forte por tipo, linhas de horário
   alinhadas e atividades iguais emendadas em faixas. A tela atual tem cores suaves, toda linha com a mesma altura, uma
   coluna larga por pessoa (a tabela passa de 4.600 px) e o almoço repetido bloco a bloco. A visão "por atividade" ficou
   ruim: os nomes se empilham e não dá para saber como está o dia de uma pessoa.
2. **Preencher é um clique por pessoa e por bloco.**
3. **A folga é esquecida.** Quando alguém entra de folga, ela precisa ser achada em todos os lugares onde aparece (várias
   cenas, vários shows) e trocada uma por uma. E a troca não é sempre pela mesma pessoa: quem cobre a Sofia nas Guardiãs
   pode não ser quem cobre nas Cartas para Noel.

## Como o dia passa a andar (o fluxo)

1. **Cada Supervisão preenche a sua parte** (a Administração preenche qualquer área). A Direção só lê.
2. Terminou? **"Enviar minha parte"**: a área fica marcada como pronta (isso já existe hoje, entra no Registro).
3. A Administração vê o local inteiro, uma linha por área, e **"Publicar tudo"**: publica a Escala e, em seguida, todos os
   Livros do Dia do local.

- A Administração e a Supervisão veem o rascunho enquanto o dia é montado. **Só o Elenco vê apenas o publicado.**
- Hoje o Livro só pode ser publicado depois da Escala, e um por um. "Publicar tudo" faz essa sequência sozinho, na mesma
  ordem, e diz com frase clara se algum Livro não pôde ser publicado e por quê. A regra "Escala primeiro, Livro depois" não muda.
- Mudança depois de publicado espera a republicação, e a Administração é avisada.

## As etapas

Cada etapa deixa a tela usável e é entregue sozinha.

### Etapa 1: ler o dia como a planilha

- **"Por pessoa" vira a visão principal**; "Por atividade" fica como consulta.
- **Cor forte por tipo**, sempre com o nome escrito (a cor ajuda, nunca é a única informação). Sete tipos prontos: treinos no
  gelo, ensaios e preparação, shows e teatro, interações e personagens, produção e apoio, pausas e almoço, outras
  atividades. Os tipos são **por local**: só a Administração cria, renomeia e desativa (tipo usado nunca é apagado). Escolhido
  na Programação; onde ninguém escolheu, o app continua adivinhando pelo nome. Show tem sempre o tipo de show.
- **Altura proporcional à duração**, linhas de horário alinhadas e **atividades iguais emendadas** em faixas.
- **Colunas estreitas** e zoom que faz o dia caber na tela, sem rolar muito para os lados.
- **Resumo no topo**: "38 escaladas · 2 de folga · 1 choque · 3 exceções · 0 sem atividade", cada número abre a lista.
- **Quadro "Não trabalha hoje"**, **busca de pessoa** (ilumina só o dia dela), **filtro "só exceções e choques"** e aviso
  informativo de tempo parado (sugestão: mais de 40 minutos; nunca bloqueia).
- No bloco de show, cada pessoa aparece com o **personagem ou a posição** que faz, e quem cobre alguém aparece como
  "cobre fulano (folga)". Show é só leitura na Escala, com o botão "Abrir Livro".
- No celular, a visão por pessoa continua em cartões empilhados, com uma faixa do dia no topo para dar a ideia geral.

### Etapa 2: resolver a folga em um clique

Painel **"Atenção do dia"** e **"Onde esta pessoa aparece hoje"**:

- Lista quem está de folga ou fora e ainda aparece em alguma atividade ou show, as vagas sem ninguém e os choques.
- Para cada pessoa, **uma linha por lugar** (Guardiãs, Cartas para Noel, ensaio…), cada uma com a **sugestão de quem cobre aquele
  lugar** (a reserva do grupo daquela posição). Aceitar todas de uma vez, ou mudar só uma.
- Prévia antes de gravar e **desfazer**. Nos shows, a troca passa pelo motor do Livro, não por um atalho da Escala.
- Choque na grade: "Tirar de…", "Mudar horário só desta pessoa", "Dividir" (com motivo, e deixando claro que é exceção só dela).
  Show não muda de horário: a saída é tirar do show.

### Etapa 3: preencher em lote

- Marcar várias pessoas, ou um grupo que já existe na Programação, e aplicar a ação de uma vez.
- **Prévia**: quem entra, quem fica de fora (folga ou outra área) e quais choques aparecem. **Desfazer última alteração.**
- Não coloca ninguém em bloco de show: show é do Livro, e a prévia diz isso, com botão para abrir o Livro.
- A Supervisão só age em pessoas da própria área.

### Etapa 4: enviar a minha parte e publicar tudo

- **Supervisão:** resumo só da própria área e o botão "Enviar minha parte". Com choque aberto, avisa antes.
- **Administração:** resumo do local, **uma linha por área** ("Patinadores: pronta · Bailarinos: 1 choque aberto · Produção: não
  enviada"), e o botão **"Publicar tudo"**, que mostra quantas áreas faltam.
- Pendências do Livro (Livro não gerado, vaga sem titular) aparecem como aviso. Sugestão: avisam, mas não bloqueiam.
- Proposta: se alguém altera uma área já enviada, **a marca cai sozinha** e a Supervisão é avisada no sino, dizendo quem mudou o quê.
- Se duas pessoas mexem no mesmo dia ao mesmo tempo, o app confere a versão ao salvar e avisa com uma frase clara.

### Etapa 5: copiar de outro dia

"Igual ao último sábado." Por último e com confirmação forte, porque pode trazer exceções antigas sem ninguém perceber. Copia só
as atividades e as pessoas que continuam disponíveis, e mostra quem ficou de fora.

### Ajuste de texto, depois da aprovação

Na Programação, "Todo mundo do local" passa a se chamar **"Todas as áreas"**, porque as pessoas não têm local. A regra não muda.

## Como a tela deve ser sentida (padrão Apple Design)

O jeito de mexer também importa, não só o que a tela mostra. Em todas as etapas valem estas regras:

- **Responde na hora.** O botão reage no instante do toque. Todo toque tem pelo menos 44 px e nenhum texto fica abaixo de 12 px.
- **Simples não é vazio.** O caminho comum vem primeiro (resumo, exceções, choques) e o resto fica um nível abaixo.
- **Sempre dá para voltar.** Todo lote ou troca tem prévia antes e "Desfazer" depois. Só o que não tem volta pede confirmação.
- **Cada coisa nasce de onde você tocou.** O menu do choque abre junto do bloco tocado. No celular, as janelas sobem de baixo e
  têm sempre o botão de confirmar e o de cancelar à vista.
- **Mesma coisa, mesmo jeito.** A mesma cor quer dizer o mesmo tipo, sempre com o nome escrito. O botão "Enviar minha parte" é igual em toda área.
- **A tela diz onde você está e o que falta.** Dia, local, área e pendências sempre à vista.
- **Cabeçalho e resumo fixos e translúcidos**, com a escala rolando por baixo, sem perder a leitura.
- **Quem pede menos movimento** no aparelho recebe transições simples, sem animação.

## Perguntas de regra para a Babi

1. **Os sete tipos de atividade estão bons?** Falta algum? Exemplo: "Yeti" é interação ou show? A lista é por local e pode mudar.
2. **"Todo o elenco do dia" vale para quem?** Sugestão: todas as pessoas com atividade no dia, sem folga, recesso e afastamento.
3. **Aviso de tempo parado:** 40 minutos está bom? Será só um aviso.
4. **Quem pode preencher em lote?** Sugestão: Administração em qualquer área, Supervisão só na própria.
5. **Área enviada e alguém mexe depois: a marca cai sozinha?** Sugestão: sim, com aviso no sino para a Supervisão.
6. **Rascunho: a Supervisão vê o de todas as áreas ou só o da própria?** Sugestão: de todas, para conferir choques. Edita só a própria.
7. **"Publicar tudo" deve publicar a Escala e todos os Livros de uma vez?** Sugestão: sim, na ordem de hoje, avisando se algum Livro não pôde.
8. **Livro não gerado ou com vaga vazia deve impedir a área de ser enviada?** Sugestão: só avisar, a Administração decide.
9. **Copiar de outro dia:** copiar só quem continua disponível e mostrar quem ficou de fora?

## Como vai ser feito

- Em um ramo novo, uma etapa por vez, sem tocar no que está em produção e sem mexer no motor do Livro, no Livro do Dia nem no Livro oficial.
- Cada etapa é testada abrindo a tela e clicando, no celular e no computador, com os quatro perfis, antes de ser dada como pronta.
- A etapa 1 precisa de tabela nova para os tipos: primeiro só no banco de teste. Quem constrói o app decide quando levar para produção.
