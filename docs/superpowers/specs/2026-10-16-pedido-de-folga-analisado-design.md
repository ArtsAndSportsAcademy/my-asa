# Desenho — Etapa 3: pedido de folga analisado (16/10/2026)

Fonte das decisões: respostas e áudios da Administração (Babi) repassados em 16/10/2026, e os rascunhos de
tela aprovados no navegador. O que é **palpite meu** vem marcado com *(minha escolha)*. Este documento
substitui, para a Etapa 3, o texto antigo de `docs/plano-folga-como-troca-e-mes-em-rascunho.md`; aquele
arquivo segue valendo para as Etapas 1, 2 e 4.

## 1. Por que isso existe

Hoje o pedido de folga chega para qualquer Supervisão da área ou para a Administração, **sem nenhuma
análise**: quem decide abre a Escala, o mapa e o Livro do Dia à mão para descobrir quem está no dia, se o
show fica coberto e com quem dá para mexer. É nisso que o tempo se perde. Depois de a escala publicada, quem
sabe responder são as Supervisões (Deb, Victor e Tef na prática), e não a Administração.

## 2. O que muda para cada pessoa

- **Elenco** pede folga como hoje (dia, motivo). Passa a ver para quem o pedido foi e em que pé está.
- **Supervisão da área da pessoa** recebe o pedido **já analisado** (ver §4) e decide.
- **Administração** só decide quando a Supervisão não respondeu até o prazo (§3), ou quando a área não tem
  supervisão cadastrada (isso já é assim hoje).
- **Direção** só lê, como nas folgas de hoje.

## 3. Regras

1. **"Publicar" é a tabela de folgas do mês.** No dia a dia da casa ela é publicada no fim do mês para o mês
   seguinte; é aí que a pessoa vê as folgas dela e pede para trocar *(resposta da Babi, 16/10)*. **Antes de a
   tabela do mês estar publicada**, o pedido **entra direto como prioridade**, sem análise e sem aceite de
   colega. Só deixa de entrar se a gerência recusar com motivo por algo especial naquele dia.
2. **Depois de a tabela estar publicada**: o pedido vai **para a Supervisão da área da pessoa** (no local do
   pedido, se houver, como já faz `decisores` em `solicitacoes.ts`), com a análise da §4. **A análise não
   pode depender de a Escala do dia estar publicada**: na prática as Escalas ainda não existem nesse
   momento, e foi para isso que o "Gerar o mês/semana em rascunho" (Etapa 2) foi feito. A análise lê o
   **Livro do Dia vivo e a Escala em rascunho** do dia, publicados ou não.
3. **A Administração entra** quando a Supervisão não respondeu e faltam **N dias** para a data pedida. **N é
   configurável**; começa em **3** (Babi disse "3 ou 4"). Antes disso a Administração vê o pedido, mas não
   decide. Quando o prazo abre, a Administração recebe **um** aviso por pedido.
4. **Troca só existe quando o colega está de folga** no dia pedido: ele trabalha o dia e os dois trocam de
   dia. O colega aceita antes, ou recusa **com motivo**, e a recusa volta para a Supervisão. Se o colega
   **trabalha** naquele dia, não há troca: é **alerta** ("se a Ana folgar, a Carol e a Isa podem cobrir a
   Astrid"), e quem cobre não recebe nada em troca. Quem cobre é combinado fora do app; o app só mostra quem
   *pode*.
5. **Folga não é a mais:** não existe dia extra. Quem foi chamada em emergência tem a folga **transferida**
   para outro dia, e quem registra a transferência é a gerência (isso já existe como remarcar folga no mapa;
   a Etapa 3 só garante que a conta do mês não muda).
6. **Cobertura mínima só avisa, nunca trava.** O número mínimo é **configurável por área e por função**, porque
   depende dos shows. Os shows cobertos vêm primeiro; o número de folgas é consequência.
7. **A folga que já passou não se pede** (regra de 14/10, mantida).
8. Toda decisão, aceite, recusa e mudança de prazo grava no **Registro na mesma transação**, com o motivo
   quando a ação o pede (recusa, folga em dia de show descoberto, decisão da Administração fora do prazo).

## 4. A tela que a Supervisão vê (aprovada em rascunho)

Em quatro blocos, nesta ordem, **só com nomes**, sem tabela:

1. **Quem já está de folga** no dia, com a contagem ("6 pessoas; com a Ana seriam 7").
2. **Quem trabalha** no dia, também só nomes, com a contagem.
3. **A vaga da pessoa**, no formato **"Astrid · Ana"** (personagem · pessoa), e ao lado **quem pode cobrir**
   ("Se a Ana folgar, pode cobrir: Carol, Isa"). **Pode cobrir = quem está na lista de substituições daquela
   vaga** (Babi, 16/10), **que trabalha nesse dia** e **sem outro show no mesmo horário**. *(Minha leitura de
   "lista de substituições": os substitutos cadastrados na posição do Livro do Show, `TITULAR_SUBSTITUTE`, e
   as pessoas da fila de rodízio quando a vaga é de rodízio. O construtor confere no código.)* Se ela tiver
   mais de uma vaga no dia, uma linha por vaga.
4. **Resultado** em uma frase: "Dá. A Astrid fica coberta." / "Não dá: ninguém que trabalha nesse dia pode
   assumir a Astrid." Com os botões **Aprovar e escolher quem cobre** e **Recusar com motivo**.

Casos que a tela precisa dizer, não calar (pergunta 10 do crivo):
- Dia sem Escala nem Livro: "Este dia ainda não tem Escala; o pedido entra como prioridade."
- Vaga sem ninguém que possa cobrir: o resultado é "Não dá" e oferece **pedir troca a quem está de folga**
  (regra 4).
- Cobertura mínima da área abaixo do configurado: um **aviso** em texto simples, sem bloquear.
- Pedido de vários dias: o panorama é por dia, uma seção por dia, com o resultado de cada um. Se só parte
  dos dias dá, a Supervisão pode **propor à pessoa só os dias que dão** (mediação, Babi, 16/10: "a gente
  sempre tenta dar certo"). A pessoa aceita ou recusa a proposta; recusando, o pedido volta para a
  Supervisão decidir. O fluxo de "alternativa proposta" já existe nos estados de `requests`
  (`ALTERNATIVE_PROPOSED`/`ACCEPTED`/`REJECTED`); o construtor vê se reaproveita ou se `leave_requests` precisa
  dos mesmos estados.

No celular (375 px) os quatro blocos ficam um embaixo do outro, e os botões ficam num rodapé fixo, visível
com o teclado aberto (pergunta 16).

## 5. O que o servidor precisa entregar

- **Um endpoint de análise** do pedido: dado pedido (pessoa + datas), devolve por dia a lista de quem está de
  folga, quem trabalha, as vagas da pessoa e quem pode cobrir cada uma, e o resultado. Calculado **na leitura**
  (como a Escala do dia), nunca gravado, para não envelhecer. Reaproveitar `services/escala-dia.ts` e o
  Livro do Dia vivo para as vagas, e `folgas`/mapa para quem folga.
- **Configuração**: prazo N da Supervisão; cobertura mínima por área e função. *(Minha escolha: guardar na
  organização, editável só pela Administração, com tela simples em Cadastros.)* Precisa de **migração**,
  com rollback em `lib/db/drizzle/rollback/` e entrada no `meta/_journal.json`. Aplicar **só no banco de
  teste**; quem roda em produção é quem constrói o app (a usuária), não a Babi.
- **Roteamento do pedido** pelo estado (antes/depois de publicar) e pelo prazo, reaproveitando os papéis e os
  avisos de `leave-requests` e do fluxo de troca (`WAITING_PEER` → `PENDING`) de `requests`.

## 6. Avisos (um por acontecimento, não um por clique)

- Supervisão da área: um aviso quando chega um pedido pós-publicação.
- Administração: um aviso quando o prazo abre sem resposta.
- Quem pediu: decisão (aprovada/recusada, com motivo se recusada).
- Colega da troca: um aviso pedindo o aceite; a Supervisão é avisada da resposta.
- Elenco que perde ou ganha uma vaga: o aviso de mudança depois de publicado e a **republicação** seguem o
  fluxo que já existe (a versão publicada vale até a Administração republicar).

## 7. Não é objetivo

- Montar o calendário do mês e a grade pessoa × dia (a **visão do mês** continua pendente; a Etapa 3 usa o
  panorama de **um dia**, não o mês inteiro).
- Experimentar grupos da alta temporada (Etapa 4).
- Aprovar folga em lote (decisão de 14/10: de um em um).
- Decidir quem cobre automaticamente. O app mostra quem pode; a Supervisão escolhe.

## 8. O que seria falha mesmo funcionando

- Tela que trava a Supervisão por cobertura mínima (só avisa).
- Análise que fica velha: se o dia mudou, a análise é refeita na leitura.
- Pedido que some para a Supervisão e só a Administração enxerga.
- Recusa sem motivo, ou aceite do colega sem aviso a quem precisa saber.
- Janela sem rodapé com confirmar e cancelar, ou ilegível a 375 px.

## 9. Fatias de construção *(minha escolha de ordem)*

1. **Panorama do dia**: endpoint de análise + os quatro blocos na tela de decisão, só leitura. É a parte que
   mais alivia, e dá para a Supervisão usar já.
2. **Roteamento e prazo**: antes/depois de publicar, Supervisão primeiro, Administração depois do prazo
   configurável, avisos.
3. **Troca com quem está de folga**: aceite e recusa com motivo, aplicação em uma transação.
4. **Configuração**: prazo e cobertura mínima por função, com migração só no teste.

Cada fatia tem testes (API contra o banco de teste) e é conferida na tela com a empresa de teste, entrando
como Elenco, Supervisão e Administração, a 375 px.

## 10. Perguntas respondidas pela Babi em 16/10/2026

1. **"Publicar"** = a tabela de folgas do mês (fim do mês, para o mês seguinte). A Escala do dia pode ainda
   nem existir; a análise usa o rascunho gerado por mês/semana. *(Resolvido; mudou a §3.)*
2. **Quem pode cobrir** = só quem está na **lista de substituições** da vaga. *(Resolvido; §4.)*
3. **Prazo em dias corridos.** *(Resolvido.)*
4. **Pedido de vários dias com só parte possível:** a Supervisão **propõe à pessoa os dias que dão**, como
   mediação; a pessoa aceita ou recusa. *(Resolvido; §4.)*

**Ainda em aberto, para o construtor decidir e marcar como escolha dele:** onde exatamente mora a "lista de
substituições" no modelo de dados; e se o estado de "alternativa proposta" entra em `leave_requests` ou se o
pedido de folga passa a usar `requests`.
