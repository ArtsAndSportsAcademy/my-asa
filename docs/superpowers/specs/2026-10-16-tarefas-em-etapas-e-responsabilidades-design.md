# Tarefas em etapas e responsabilidades com pedidos — desenho

Data: 16/10/2026. Origem: conversa com a dona do produto. Estado: **rascunho para aprovação**, nada construído.

## Por que isso existe

A Arts and Sports Academy tem muita coisa para fazer, e ela se perde no dia a dia. Quando chega a data, ninguém fez
porque todo mundo esqueceu. Hoje a tela de Tarefas não ajuda o bastante, por três razões:

- Uma tarefa tem **uma pessoa**, **uma data obrigatória** e **uma aprovação ligada por padrão**. O trabalho real
  não é assim.
- O trabalho passa por várias pessoas **em ordens diferentes a cada vez**. Num vídeo, às vezes o Júnior faz o
  roteiro, a Daya grava e a Luíse edita; outras vezes é outra ordem. No fim, alguém aprova.
- A **responsabilidade** (quem cuida de perucas, figurinos, mídias, produção) existe no cadastro, mas só como
  etiqueta. Quem precisa de algo ainda tem que lembrar quem cuida do quê, e a pessoa ocupada esquece.

O sucesso é: quem pede sabe que o pedido não vai se perder, quem recebe sabe quando é a vez dela, e a Administração
vê o que está parado sem precisar perguntar.

## O que a dona do produto decidiu

### Tarefa

1. **Qualquer pessoa cria tarefa para outra**, inclusive o Elenco. Administração, Direção e Supervisão veem e cobram
   as tarefas dos outros; Direção também cria (como a Administração).
2. A tarefa é uma **lista de etapas**. Cada etapa tem nome, **uma pessoa** e, se quiser, **prazo próprio**. Quem cria
   monta a ordem que fizer sentido naquela vez. Exemplo: Roteiro (Júnior) → Gravar (Daya) → Editar (Luíse) → Aprovar (Cris).
3. **Tudo é opcional e configurável**: tarefa sem checklist, sem prazo, com um período em vez de uma data, para uma ou
   várias pessoas, com ou sem aprovação. O checklist se escreve livremente.
4. **A ordem é escolhida por tarefa**: em fila (a próxima etapa só avisa a pessoa quando a anterior termina) ou solta
   (cada um no seu ritmo).
5. **Aprovação é uma etapa como as outras**, posta onde se quiser (normalmente no fim). Sem etapa de aprovação, a
   tarefa termina quando a última etapa termina.
6. A tarefa tem **descrição**. Cada etapa pode ter descrição própria (decisão minha, não pedida).
7. **Anexos são só link do Drive.** Nada de arquivo subindo para o app, por causa do limite do Supabase gratuito.
   O link **abre dentro do My ASA** (visualização embutida). Ao colar o link, o app **avisa que o arquivo não está
   compartilhado** quando for o caso — e deixa salvar mesmo assim? **Não decidido**; ver "Perguntas abertas".

### Responsabilidade

1. A responsabilidade é uma área **contínua**, sem data fixa, de uma pessoa ou de um grupo
   (exemplos reais: perucas; figurinos; mídias — Daya, Júnior e Luíse; produção).
2. Quem a recebe tem uma **lista fixa própria** (coisas que faz sempre).
3. **Qualquer pessoa pede algo a uma responsabilidade** escolhendo o nome dela ("Perucas"), sem precisar saber quem é
   o dono. O pedido vai para o dono; se a responsabilidade tem mais de uma pessoa, vai para todas.
4. Quem recebe **aceita** (ou conversa) e o pedido **vira uma tarefa**, com etapas se precisar e prazo se houver.
5. Telas mostradas e aprovadas em 16/10: dentro de "Perucas" (pedidos novos, lista fixa, em andamento) e "Pedir algo".
   Mockups ficam em `.superpowers/brainstorm/` (local, fora do git).

### Avisos (sino)

- A pessoa de cada etapa é avisada quando chega a vez dela.
- Lembrete um dia antes do prazo e outro no dia do prazo.
- Passou do prazo: avisa a pessoa e quem criou a tarefa.
- Tarefa parada sem ninguém mexer: avisa quem criou.
- Quem aprova é avisado quando a última etapa é entregue.
- Um aviso por acontecimento, não por clique.

## Metas, não metas e o que seria fracasso

**Metas:** montar uma tarefa em poucos toques no telefone; nada se perde sem ninguém ser avisado; cobrar é fácil.

**Não metas:** subir arquivo para o app; relatórios e gráficos de produtividade; integrar com Drive além de abrir o link.

**Seria fracasso mesmo "funcionando":** a pessoa ter que lembrar quem cuida de quê; uma tarefa de Elenco que a
Administração não consegue ver; criar uma tarefa pedir mais campos do que o necessário (só o título é obrigatório —
ver abaixo).

## Restrições

- Telefone primeiro: todo o fluxo se confere a **375 px**, rodapé com confirmar e cancelar sempre visível (crivo 3 e 16).
- Anexo = link do Drive (limite do Supabase gratuito).
- Toda escrita grava no Registro (`writeHistoryEvent`) na mesma transação. Remoção é lógica e restaurável.
- Migração só no banco de teste pelo assistente; **rollback em `lib/db/drizzle/rollback/`** e registro no
  `meta/_journal.json`. Última migração hoje: `0071`.
- Direção cria, vê e cobra tarefas: **anotar a exceção no `AGENTS.md`** (a de 15/10 já cobre Tarefas; confirmar que
  vale também para pedidos às responsabilidades).
- Dados de exemplo com nomes só dentro de `import.meta.env.DEV`; rodar `scripts/verificar-nomes-build.mjs`.
- Nada é promovido: fica local até a Babi dizer "pode enviar".

## O que existe hoje e precisa mudar

- `tasks` (`lib/db/src/schema/tasks.ts`): `assigneeId` e `approverId` únicos e obrigatório, `dueDate` obrigatório,
  `requiresApproval` ligado por padrão, `mandatoryChecklist`/`operationalChecklist` em JSON. Rotas em
  `artifacts/api-server/src/routes/tasks.ts` (cria, lote, inicia, envia para aprovação, aprova, pede ajustes, cancela,
  evidências, comentários). Tela: `artifacts/web-admin/src/pages/responsibilities-tasks.tsx`.
- `responsibilities` e `responsibility_assignments` já têm dono, substituto e período; falta o **pedido** e a lista fixa.
- Evidências hoje têm tipos de arquivo (foto, vídeo, PDF...); passam a ser **link do Drive**.
- Já existe lote de tarefas (uma linha pode valer para várias pessoas) e cancelar tarefa; o desenho novo precisa
  conviver com eles, não quebrá-los.
- Tarefas já criadas continuam válidas: cada uma vira uma tarefa com as etapas implícitas (fazer → aprovar, se
  houver aprovação). O jeito exato é decisão de quem constrói, sem perder dado.

## O que deixo para quem constrói

Modelo de dados das etapas, nomes dos estados, como migrar as tarefas atuais, ordem de implementação e a forma de
embutir o Drive. Sugestão minha de ordem, para entregar valor cedo: (1) etapas e opcionalidade, (2) link do Drive
embutido, (3) pedido a uma responsabilidade e lista fixa, (4) avisos novos, (5) modelos salvos.

## Decisões minhas (a dona do produto não decidiu; vale até ela dizer o contrário)

- **Quem vê**: Administração e Direção veem todas as tarefas da casa. A Supervisão vê as da própria área (como no resto
  do app); as dela e as que ela criou ou recebeu, sempre. Tarefa entre duas pessoas do Elenco também é vista por
  Administração e Direção.
- **Uma pessoa por etapa.** Quem precisa de duas pessoas cria duas etapas. Na tarefa em lote já existente, cada pessoa
  continua virando uma tarefa separada.
- **Mexer na tarefa**: cancelar, reatribuir etapa parada, dispensar etapa e adicionar etapa depois de criada podem
  quem criou, a Administração, a Direção e a Supervisão da área. Tudo com motivo no Registro, e etapa já concluída
  nunca some (remoção lógica). Adicionar ou reatribuir avisa só a pessoa afetada.
- **Aprovação pede ajustes**: o aprovador escolhe para qual etapa a tarefa volta, e a pessoa dessa etapa é avisada.
  Na ordem solta, a etapa de aprovação só abre quando todas as outras terminaram.
- **Link do Drive**: o app tenta avisar que "esse arquivo não está compartilhado" e **deixa salvar mesmo assim**,
  porque sem integração com o Drive a checagem só é confiável em parte. Se o link não abrir embutido, a tela
  oferece "Abrir no Drive". Evidências antigas que não são link continuam visíveis, só não se criam novas.
- **Modelos salvos ficam para depois** da primeira entrega.
- **Avisos**: "parada" = 3 dias sem ninguém mexer (configurável). Com período em vez de data, o prazo é o fim do
  período. Etapa sem prazo próprio herda o da tarefa; etapa sem nenhum prazo só avisa quando chega a vez dela.
  O app já tem um mecanismo de rotinas no servidor (`services/operational-jobs.ts`, `routes/internal.ts`); o
  construtor confirma se serve para os lembretes e garante um aviso por acontecimento.
- **Migração das tarefas atuais**: responsável e aprovador viram duas etapas; sem aprovação, uma só. `dueDate` vira o
  prazo da tarefa. Os checklists atuais ficam como estão. Estados em andamento se mapeiam para a etapa certa. Rollback
  precisa devolver exatamente o que havia.
- **Pedido a responsabilidade sem dono hoje** vai para a Administração, com o aviso dizendo por quê (vazio explicado).
  Responsabilidade com substituto no período: o pedido vai também para o substituto.

## Decididas em 16/10/2026 depois da revisão

- **Pedido a responsabilidade de grupo**: basta **uma pessoa aceitar**. A tarefa fica com quem aceitou, e as outras
  pessoas do grupo **recebem aviso** de que o pedido já foi aceito e por quem.
- **Lista fixa da responsabilidade**: cada item tem uma **repetição configurável**, escolhida por quem cuida dele:
  não repete (fica marcado), ou volta sozinho depois de um tempo e avisa de novo. Decisão minha sobre as opções da
  primeira entrega: nunca, todo dia, toda semana (escolhendo o dia), todo mês, ou a cada N dias. "Depois de cada
  show" ficaria para depois, porque depende da escala. Marcar um item grava no Registro; item que volta avisa só o dono.
  Isso usa o mesmo mecanismo de rotinas do servidor dos lembretes (ver "Avisos").

## Perguntas abertas

Nenhuma que bloqueie o plano. Itens para depois: modelos de tarefa, repetição "depois de cada show".
