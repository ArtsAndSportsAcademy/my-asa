# Regras de folga da ASA

Respondido pela Babi (administração) em 09/10/2026. É a regra real da casa, não uma suposição do
app — qualquer validação automática de folga precisa obedecer a isto.

## Quantas folgas

- **Duas folgas por semana.** Uma delas é o dia em que o parque fecha: **quarta-feira em Snowland**,
  **segunda-feira em Acquamotion**.
- **A segunda folga é condicionada à jornada completa** nos outros cinco dias. Quem não cumpre a
  jornada inteira não tem direito a ela. Exemplos dados por ela: o Arthur, que não está de segunda a
  quinta, não tem a segunda folga; quem teve vinte dias de recesso no mês também não.
- **Nos meses em que os parques abrem sete dias por semana**, as duas folgas passam a ser fixas, por
  grupos definidos pela supervisão.

## Como contar

- **A conta é mensal, não semanal.** Não existe dia fixo de início de semana. O que precisa fechar é
  todo mundo terminar o mês com o mesmo número de dias de folga, fora os casos específicos acima.
- Quando é preciso deixar uma semana sem ninguém de fora, o dia "em aberto" vai para outra semana.
  Então uma semana com menos folgas não é erro.

Consequência para o app: um aviso de "está faltando folga" calculado por semana vai acusar falso
quase toda semana. A verificação é no mês, e precisa conhecer quem tem jornada reduzida.

## Quem decide o pedido de folga (decisão de 19/10/2026)

- **Todo pedido do Elenco vai para a Supervisão da área da pessoa**, com o mapa do mês publicado ou não.
  O pedido nunca nasce aprovado: fica "aguardando a Supervisão" até alguém decidir. (Até 18/10 valia o áudio
  de 16/10/2026: com o mês não publicado o pedido entrava como "prioridade", já aprovado. Isso acabou.)
- **A Administração só decide** quando a Supervisão não respondeu e faltam N dias corridos ou menos para a
  data pedida (N configurável, começa em 3), **ou quando a área não tem Supervisão** (ou a única pessoa da
  Supervisão é quem pediu). Decidindo no lugar da Supervisão, escreve o motivo.
- O pedido que a **Administração registra pelo calendário** (`POST /leave-calendar`) continua nascendo
  aprovado: ali quem decide é quem registra, com motivo.
- A pessoa vê com quem o pedido está e, se a Supervisão não responder, a partir de que dia a Administração
  também pode decidir. Quem analisa recebe um aviso por pedido; a pessoa recebe a decisão.
- Na análise, a Supervisão vê um **aviso (não bloqueia)** quando a pessoa está num grupo de folga: se o dia
  pedido já é folga do grupo (talvez ela já esteja de folga) ou se foge do padrão do grupo.
- Pedidos antigos que entraram como prioridade seguem como estão, e a gerência ainda pode desfazê-los
  (`routes/folga-prioridade.ts`).

## No mapa de No Shows

- **Asterisco** (`NO SHOW*`) — dia que a pessoa pediu; a administração tenta manter aquele dia.
- **`NO SHOW SET`** — dia que a pessoa não tirou em setembro e passou para outubro.

## Em aberto

- **Recesso**: a regra de 2027 ainda está sendo definida.
- A tabela de folgas montada automaticamente ainda precisa de uma revisão com a Babi antes de virar
  fonte de verdade.
