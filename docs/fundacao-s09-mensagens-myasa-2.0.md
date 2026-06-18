# MyASA 2.0 — Fundação da Superfície S-09 Mensagens

> **Versão:** 18/06/2026
> **Fase:** Modelagem Comportamental — anterior a wireframes e mockups
> **Base:** Arquitetura MyASA 2.0 · Auditoria Final da Arquitetura Funcional · Núcleo Operacional · Ecossistema de IA · Governança Organizacional · Ciclo de Comunicação Operacional · Entidade MO · todas as decisões formais acumuladas
> **Status:** 🟢 Superfície modelada — pronta para guiar UX de S-09

---

## Premissa da modelagem

A auditoria final (A-02) identificou que S-09 Mensagens existe no mapa de superfícies mas sem fundação comportamental. Este documento resolve essa lacuna.

**Ponto de partida obrigatório:** não assumir que Mensagens é um chat. Não partir do produto — partir do problema.

**A pergunta correta:** *qual atividade operacional real não é servida por nenhuma superfície existente?*

---

## PARTE 1 — O PROBLEMA OPERACIONAL

---

### O que já existe e o que cada um faz

| Superfície | Para que serve | Limitação estrutural |
|---|---|---|
| **S-08 Avisos** | Comunicação oficial unidirecional — o Supervisor diz, o Membro confirma | Não permite resposta. O Membro recebe mas não pode esclarecer, questionar ou perguntar. |
| **S-06 Solicitações** | Pedido formal com fluxo de estados e impacto operacional | É um processo — não é uma conversa. Não existe para esclarecimentos. |
| **S-07 Entregas** | Atribuição formal com prazo, critério e feedback estruturado | O feedback é avaliativo, não conversacional. Não existe para coordenação. |
| **S-10 IA** | Consulta individual ao assistente inteligente | A IA responde perguntas do próprio usuário — não conecta duas pessoas. |

**A lacuna:** existe uma família inteira de comunicações operacionais que não é nenhuma dessas coisas:

- O Membro recebe um Aviso de que seu personagem mudou. Quer entender por quê — mas o Aviso não permite resposta.
- O Supervisor decide negar uma Solicitação e quer dar contexto além do campo de motivo — mas a Solicitação não é o lugar para isso.
- Dois Supervisores precisam coordenar quem cobre uma posição entre seus dois grupos — não existe canal para isso.
- Um Membro tem dúvida específica sobre o critério de uma Entrega — o sistema não tem lugar para esse esclarecimento.

**O que todas essas situações têm em comum:**

1. São comunicações **entre pessoas**, não entre uma pessoa e o sistema
2. Não geram nem substituem uma decisão operacional formal
3. Precisam de **resposta** — não são broadcast
4. São **operacionalmente motivadas** — não são sociais

---

### A lacuna que Mensagens fecha

> **Mensagens existe porque toda a operação produz dúvidas, alinhamentos e coordenações que não são pedidos formais, não são notificações oficiais e não são tarefas atribuídas — mas precisam acontecer para que a operação funcione.**

Sem Mensagens, essas comunicações migram para fora do sistema: WhatsApp, SMS, conversa de corredor. O efeito é invisibilidade: decisões relevantes acontecem, alinhamentos são feitos, contextos são dados — e nada disso fica registrado, rastreável ou associado ao evento operacional que o originou.

---

## DEFINIÇÃO OFICIAL

> *Mensagens é o canal de esclarecimento e coordenação contextual do MyASA. É uma comunicação bidirecional assíncrona entre dois participantes autorizados, cujo propósito é esclarecer, coordenar ou alinhar um fato operacional que não é melhor servido por um Aviso oficial, uma Solicitação formal ou uma Entrega estruturada.*

**Mensagens não é:**
- Chat social entre colegas
- Canal de pedidos informais que substituem Solicitações
- Forma alternativa de comunicar mudanças operacionais que deveriam ser Avisos
- Ferramenta de gestão de tarefas que substitui Entregas
- Caixa de entrada unificada que agrega tudo

**Mensagens é:**
- O lugar onde a operação conversa
- Esclarecimento: *"Por que meu personagem mudou?"*
- Coordenação: *"Você pode cobrir a entrada de segunda no meu lugar se eu cobrir a saída?"*
- Alinhamento: *"Quero dar mais contexto sobre por que neguei sua solicitação"*
- Confirmação informal de entendimento: *"Entendido, me preparo para o personagem novo"*

---

## PARTE 2 — FRONTEIRAS

---

### Mensagem × Aviso

| Dimensão | Mensagem | Aviso |
|---|---|---|
| Direção | Bidirecional — permite resposta | Unidirecional — não permite resposta |
| Natureza | Diálogo de esclarecimento | Comunicação oficial de mudança |
| Efeito operacional | Nenhum — não altera Escala ou Livro do Dia | Notifica uma mudança já registrada |
| Imutabilidade | Sim — não pode ser editada | Sim — imutável após envio |
| Confirmação formal | Não exige | Pode exigir (Avisos críticos) |
| Audiência | Individual ou grupo restrito | Individual, grupo ou toda a Operação |
| Registro | Arquivado contextualmente | Registrado como documento operacional |

**Risco de duplicação:** Supervisor tende a usar Mensagem quando deveria usar Aviso — para comunicar informalmente uma mudança sem o peso formal do Aviso. Isso é o principal risco de contaminação do canal.

**Regra de separação formal:**
- A comunicação informa uma mudança no estado oficial da operação → **Aviso**
- A comunicação esclarece, coordena ou contextualiza → **Mensagem**
- Em caso de dúvida: se o destinatário precisa confirmar formalmente → Aviso.

---

### Mensagem × Solicitação

| Dimensão | Mensagem | Solicitação |
|---|---|---|
| Propósito | Esclarecer ou coordenar | Pedido formal com decisão e impacto operacional |
| Iniciador | Qualquer participante autorizado | Membro (regra geral) |
| Fluxo | Conversacional — sem estados formais | Processo com estados: Criada → Decidida |
| Efeito | Nenhum por si só | Aprovação → gera MO e atualiza Escala |
| Rastreabilidade | Contextual à entidade vinculada | Formal — cada estado é registrado |

**Risco de duplicação:** Membro usa Mensagem para fazer pedido informal que deveria ser Solicitação ("Você pode me liberar na quinta?"). O pedido acontece, o Supervisor responde sim — e nenhum registro formal existe.

**Regra de separação formal:**
- O pedido afeta Escala, Livro do Dia ou alocação de qualquer membro → **Solicitação**
- O pedido é uma dúvida, esclarecimento ou alinhamento → **Mensagem**
- Alinhamento via Mensagem que resulta em decisão operacional deve ser seguido de uma Solicitação formal.

---

### Mensagem × Entrega

| Dimensão | Mensagem | Entrega |
|---|---|---|
| Propósito | Esclarecimento do contexto ou critério | Atribuição formal com prazo e avaliação |
| Iniciador | Qualquer participante | Supervisor ou Admin |
| Resultado | Alinhamento — sem efeito formal | Conclusão e avaliação formal |
| Relação | Mensagem contextual existe dentro de Entrega | Entrega existe independentemente |

**Relação natural:** Mensagens contextuais dentro de Entregas são o canal de diálogo ao longo do ciclo de uma Entrega. Não substituem o feedback formal de avaliação — são o diálogo que precede e acompanha.

**Risco de duplicação:** Supervisor usa Mensagem para atribuir tarefa informal em vez de criar Entrega formal. A tarefa existe, é feita, mas sem prazo, critério ou registro estruturado.

**Regra de separação formal:**
- Há expectativa, prazo e critério de avaliação → **Entrega**
- Há dúvida sobre a Entrega existente → **Mensagem contextual**

---

### Mensagem × IA

Não existe sobreposição. São categorias fundamentalmente diferentes:

- A IA responde perguntas do **próprio usuário** com base nos dados do sistema
- Mensagens conectam **duas pessoas**

A IA não é interlocutora de Mensagens. Pode auxiliar o usuário *sobre* uma conversa (resumir, contextualizar), mas não *na* conversa.

**Risco:** Membro pergunta à IA algo que deveria perguntar ao Supervisor. A IA pode responder se tiver contexto — mas certas dúvidas só o Supervisor pode resolver. A IA deve reconhecer esse limite e sugerir o canal correto.

---

### Mensagem × Histórico

Mensagens não são diretamente o Histórico — mas alimentam o Histórico de forma contextual:

- Histórico registra **eventos operacionais** com causa, quem fez, quando
- Mensagens que fazem parte do processo de uma decisão operacional são arquivadas como **contexto narrativo** dessa decisão no Histórico

**Regra:** uma Mensagem não gera um evento no Histórico por si só. Mas quando uma Mensagem está vinculada a uma Solicitação, MO ou Entrega, ela fica acessível no contexto histórico dessa entidade.

---

## PARTE 3 — QUEM PODE FALAR COM QUEM

---

### Matriz de permissões

| Canal | Status | Justificativa |
|---|---|---|
| **Membro → Supervisor** | ✅ Permitido | Canal primário de esclarecimento operacional. Principal uso do MVP. |
| **Supervisor → Membro** | ✅ Permitido | Canal primário de contextualização e coordenação individual. |
| **Supervisor → Grupo** | ✅ Permitido (condicional) | Para coordenação operacional do grupo. Nunca para comunicação oficial — isso é Aviso. |
| **Admin → Supervisor** | ✅ Permitido | Para alinhamento, contexto e coordenação institucional. |
| **Supervisor → Admin** | ✅ Permitido | Para escaladas de dúvida ou contexto que Admin precisa saber. |
| **Admin → Grupo** | ⚠ Condicional | Somente para diálogo específico com um grupo. Comunicação de mudança oficial → Aviso. |
| **Admin → Toda a Organização** | ❌ Proibido | Isso é Aviso, não Mensagem. Não existe Mensagem de broadcast para a organização. |
| **Membro → Membro** | ❌ Proibido no MVP | Risco de criar canal social horizontal sem supervisão operacional. Toda comunicação horizontal de Membros passa pelo Supervisor. |
| **Supervisor → Supervisor** | ⚠ Condicional | Permitido exclusivamente para coordenação de cobertura entre Grupos/Operações (ex.: conflito de membro em dois grupos). Não para conversas gerais. |
| **Membro → Admin** | ❌ Proibido no MVP | Membros escalam para Supervisor. Supervisor escala para Admin. Não existe acesso direto Membro-Admin via Mensagem. |

---

### Justificativa para as proibições

**Membro → Membro (proibido):**
O principal risco de S-09 virar WhatsApp é justamente a comunicação horizontal entre Membros. Essa é a origem de canais paralelos que destroem a arquitetura de comunicação. No MVP, todo Membro que precisa comunicar algo a outro Membro faz isso via Supervisor ou via fluxo formal (Solicitação de troca, por exemplo). Isso não é uma limitação social — é proteção arquitetural.

**Membro → Admin (proibido):**
A hierarquia de escalada é Membro → Supervisor → Admin. Acesso direto Membro-Admin cria curto-circuito na cadeia de autoridade e sobrecarrega o Admin com questões que devem ser resolvidas no nível do Supervisor.

**Admin → Organização (proibido):**
Mensagem de Admin para todos é um Aviso. Sem exceção. O canal de Mensagens não comporta broadcast organizacional — nem deve.

---

## PARTE 4 — TIPOS DE CONVERSA

---

### Classificação por tipo

| Tipo | Descrição | MVP / Pós-MVP |
|---|---|---|
| **Esclarecimento operacional** | Dúvida sobre uma decisão, posição, mudança ou instrução existente. Ex.: "Por que meu personagem mudou no show de amanhã?" | MVP |
| **Coordenação de cobertura** | Alinhamento entre Supervisores para resolver conflito de cobertura. Ex.: "Seu Membro X pode cobrir minha posição Y se eu ceder a posição Z para seu grupo?" | MVP |
| **Alinhamento pós-decisão** | Supervisor dá contexto adicional após decisão de Solicitação ou Entrega. Ex.: "Neguei sua folga porque essa semana é semana de estreia — vamos conversar sobre outra data?" | MVP |
| **Confirmação informal de entendimento** | Resposta simples que fecha o ciclo de comunicação sem criar novo processo formal. Ex.: "Entendido, me preparo para o personagem novo." | MVP |
| **Coordenação de planejamento** | Alinhamento de calendário, planejamento de temporada ou coordenação de múltiplos grupos para uma mesma produção. | Pós-MVP |
| **Feedback iterativo expandido** | Ciclos de revisão aprofundados dentro de Entregas complexas com múltiplas iterações. | Pós-MVP |
| **Conversação social / informal** | "Oi, tudo bem? Vai no ensaio de amanhã?" — sem propósito operacional | Nunca |
| **Pedido informal que substitui Solicitação** | "Você me libera na quinta?" sem criar Solicitação formal | Nunca (o sistema deve sugerir criar Solicitação) |
| **Comunicação de mudança oficial** | "Atenção: o horário de amanhã mudou para 19h" — isso é Aviso | Nunca (redirecionar para S-08) |

---

## PARTE 5 — CONTEXTO

---

### Mensagem Contextual vs. Mensagem Livre

| Dimensão | Mensagem Contextual | Mensagem Livre |
|---|---|---|
| **Definição** | Nasce vinculada a uma entidade operacional existente | Nasce sem vínculo a uma entidade específica |
| **Origem** | Usuário abre uma Solicitação, Entrega, Aviso ou MO e inicia uma Mensagem a partir dali | Usuário abre S-09 diretamente e inicia uma conversa |
| **Contexto compartilhado** | Ambos os participantes veem a entidade vinculada | Apenas o que foi escrito na própria Mensagem |
| **Arquivamento** | Arquivada junto com a entidade quando encerrada | Arquivada por data no Histórico de Mensagens |
| **Frequência no MVP** | Principal tipo — a maioria das Mensagens nasce de um contexto | Secundário — mais raro, para alinhamentos sem contexto formal |

---

### De onde uma Mensagem Contextual pode nascer

| Entidade de origem | Cenário típico | Status |
|---|---|---|
| **Solicitação** | Membro quer entender motivo da negativa. Supervisor quer dar contexto além do campo de motivo. | ✅ MVP |
| **Aviso** | Membro tem dúvida sobre o conteúdo do Aviso. | ✅ MVP |
| **Entrega** | Membro quer esclarecer critério. Supervisor quer alinhar expectativa antes do prazo. | ✅ MVP |
| **Mudança Operacional (MO)** | Membro quer entender o contexto da mudança. | ✅ MVP |
| **Livro do Dia** | Supervisor quer coordenar instrução específica com um Membro sobre o show do dia. | ✅ MVP |
| **Escala** | Supervisor quer alinhar com outro Supervisor sobre cobertura de posição. | ✅ MVP |
| **Agenda** | Supervisor quer coordenar instrução especial sobre um evento futuro. | ✅ MVP |
| **Entidade de Biblioteca** | Supervisor quer complementar um documento com contexto específico para o grupo. | Pós-MVP |

---

### O que uma Mensagem Contextual carrega

Uma Mensagem Contextual exibe automaticamente:
1. A entidade de origem (qual Solicitação, qual Entrega, qual Aviso)
2. O estado atual da entidade (ex.: Solicitação em análise · Entrega atrasada)
3. O histórico do thread vinculado à entidade
4. Os participantes autorizados (quem pode participar desta conversa)

Isso significa que quando o Supervisor abre a Mensagem contextual de uma Solicitação, ele vê a conversa e a Solicitação ao mesmo tempo — sem navegar para dois lugares diferentes.

---

## PARTE 6 — HISTÓRICO E PERSISTÊNCIA

---

### O que permanece

| Tipo de Mensagem | O que acontece ao encerrar a entidade vinculada |
|---|---|
| Contextual vinculada a Solicitação | Arquivada com a Solicitação. Acessível como contexto histórico da decisão. Não é deletada. |
| Contextual vinculada a Entrega | Arquivada com a Entrega. Acessível como contexto histórico do ciclo. |
| Contextual vinculada a MO | Arquivada com a MO. Acessível como contexto do evento operacional. |
| Contextual vinculada a Aviso | Arquivada com o Aviso. Acessível como contexto do esclarecimento. |
| Mensagem Livre | Permanece no histórico de Mensagens por prazo indefinido. Não é deletada. |
| Thread de grupo encerrado | Preservado em modo leitura. Nenhum participante pode deletar. |

---

### O que pode ser apagado

**Resposta: nada.**

Uma Mensagem enviada é imutável e permanente. Não existe edição. Não existe exclusão. Não existe "apagar para mim" ou "apagar para todos."

**Justificativa:** em um ambiente operacional onde Mensagens servem como registro de alinhamentos e coordenações, a edição ou exclusão destrói a narrativa. A imutabilidade é proteção operacional, não limitação técnica.

---

### Quando uma conversa se torna parte da narrativa operacional

A Mensagem é incluída na narrativa histórica da entidade quando:

1. Está vinculada a uma entidade operacional (Solicitação, MO, Entrega, Aviso)
2. A entidade gera um evento no Histórico

**Resultado prático:** quando o Admin investiga o Histórico de uma Solicitação complexa, pode ver não apenas os estados formais (criada, decidida) mas também a conversa que aconteceu durante o processo. Isso transforma o Histórico de um log de estados em uma narrativa completa.

---

### O que não entra no Histórico

Mensagens Livres não geram automaticamente eventos no Histórico. Elas ficam no arquivo de Mensagens, acessíveis por quem participou, mas não são parte da narrativa operacional da organização a não ser que o usuário explicitamente vincule a uma entidade ou a ação resultante crie um evento formal.

---

## PARTE 7 — IA EM MENSAGENS

---

### O que a IA pode fazer

| Ação | Status | Condição |
|---|---|---|
| **Resumir uma conversa longa** | ✅ Permitido | Sob demanda do usuário. Ex.: "Resuma esta conversa." A IA resumiu — não participou. |
| **Contextualizar** | ✅ Permitido | A IA pode dizer: "Esta conversa é sobre a Solicitação de folga de X, que foi negada porque Y." Ela acessa o contexto da entidade vinculada, não o conteúdo subjetivo das mensagens. |
| **Alertar sobre conversa sem resposta** | ✅ Permitido | A IA do Supervisor pode alertar: "Carlos enviou uma mensagem há 2 dias e você não respondeu — o show onde ele está alocado é amanhã." |
| **Sugerir rascunho de resposta** | ⚠ Pós-MVP | A IA pode oferecer um rascunho. O usuário edita e envia — nunca a IA envia diretamente. |
| **Identificar que uma Mensagem deveria ser uma Solicitação** | ✅ Permitido | A IA detecta: "Parece que você está pedindo uma folga. Deseja criar uma Solicitação formal?" — protege a arquitetura. |

---

### O que a IA não pode fazer

| Ação proibida | Motivo |
|---|---|
| **Participar da conversa como interlocutor** | A IA não é uma pessoa. Se aparecer como participante, cria confusão sobre quem disse o quê. |
| **Responder em nome do Supervisor ou Admin** | Mesmo que o Supervisor autorize, a IA respondendo como "Supervisor" é uma usurpação de identidade operacional — e cria risco legal. |
| **Iniciar Mensagens** | A IA não abre conversas. Ela reage ao contexto do usuário ativo. |
| **Acessar conversas de outro usuário** | A IA do Membro não vê as mensagens do Supervisor com outro Membro. A IA opera estritamente no escopo do usuário ativo. |
| **Deletar, editar ou arquivar Mensagens** | A IA não tem ações de curadoria sobre conteúdo de Mensagens. |

---

## PARTE 8 — CASOS LIMITE

---

### Supervisor desligado durante conversa ativa

**Comportamento:**
- O thread existente fica preservado — não é deletado
- O status do interlocutor muda para "inativo" — o Membro vê "Supervisor [nome] não está mais ativo"
- Novas mensagens não podem ser enviadas ao interlocutor inativo
- O Admin é notificado de que existe um thread aberto sem Supervisor ativo
- O Admin pode designar um Supervisor substituto — a partir daí, o novo Supervisor herda o acesso ao thread contextual (vinculado às entidades do grupo, não conversas pessoais)
- Mensagens Livres entre o Membro e o Supervisor desligado ficam arquivadas — não transitam para o novo Supervisor (são pessoais ao interlocutor)

---

### Solicitação encerrada com conversa contextual aberta

**Comportamento:**
- A Solicitação é encerrada (aprovada, negada ou cancelada)
- A conversa contextual é automaticamente arquivada junto com a Solicitação
- Ambas as partes podem ainda **ler** o histórico do thread — não podem enviar novas mensagens naquele contexto
- Se houver necessidade de continuar, uma nova Mensagem pode ser iniciada — mas será Livre ou vinculada a outra entidade

---

### Mensagem vinculada a MO encerrada

**Comportamento:**
- MO encerrada = evento operacional concluído
- A conversa contextual vinculada à MO fica arquivada com a MO
- Acessível no Histórico como contexto da MO
- Não pode receber novas mensagens

---

### Grupo arquivado

**Comportamento:**
- Todas as conversas do Grupo (mensagens de Supervisor → Grupo) ficam em modo leitura
- Nenhum membro pode enviar novas mensagens em canais do Grupo arquivado
- Admin pode consultar o histórico de Mensagens do Grupo arquivado para fins de auditoria
- Se o Grupo for reativado, os canais voltam ao estado ativo com o histórico preservado

---

### Membro desligado

**Comportamento equivalente ao Supervisor desligado:**
- Threads existentes preservados em modo leitura
- Interlocutor marcado como inativo
- O Supervisor pode ver o histórico das conversas contextuais daquele Membro (vinculadas a entidades do Grupo)
- Mensagens Livres pessoais ficam arquivadas — acessíveis ao Supervisor por ser da hierarquia operacional

---

### Operação arquivada

**Comportamento:**
- Todas as Mensagens da Operação ficam em modo leitura
- Nenhuma nova Mensagem pode ser iniciada dentro do escopo da Operação arquivada
- Admin pode consultar o arquivo completo de Mensagens para fins de auditoria
- O arquivo não é deletado — permanece como registro histórico da Operação

---

### Admin ausente

**Mensagens não são bloqueadas.** O canal S-09 opera independentemente da presença do Admin. Conversas entre Membro e Supervisor continuam normalmente. O único impacto é que Mensagens direcionadas ao Admin ficam sem resposta — o que é tratado como ausência do interlocutor, não como falha do sistema.

---

## PARTE 9 — AUDITORIA DOS RISCOS

---

### Risco: virar WhatsApp

**Definição do risco:** os usuários começam a usar S-09 para conversas sociais, memes, figurinhas e conversas pessoais não operacionais.

**Mitigações arquiteturais:**
- Membro → Membro proibido no MVP — principal vetor de comunicação social horizontal eliminado
- Sem reações, sem emojis expandidos, sem "visto às" social, sem status pessoal
- Sem mensagem de voz no MVP
- Sem grupos livres — apenas canais operacionais definidos pela estrutura (Supervisor → Grupo, Membro → Supervisor)
- A interface de S-09 é contextual e operacional — não tem aparência de app social

**Risco residual:** baixo. A proibição de Membro → Membro e a ausência de features sociais afasta o comportamento de WhatsApp. O principal vetor é a interface — se parecer WhatsApp, vai ser usado como WhatsApp.

---

### Risco: virar e-mail interno

**Definição do risco:** Supervisores e Admins começam a trocar mensagens longas, com assunto, em CC, substituindo e-mail por outro e-mail.

**Mitigações arquiteturais:**
- Sem campo de assunto (assunto é a entidade contextual ou o canal)
- Sem CC/BCC
- Sem encaminhamento de Mensagem para outros destinatários
- Mensagens Livres entre Admin e Supervisor são o único vetor de risco

**Risco residual:** médio. Conversas Admin ↔ Supervisor sobre planejamento estratégico ou gestão organizacional podem assumir padrão de e-mail. A mitigação é de UX e cultura — não é possível eliminar completamente via arquitetura.

---

### Risco: duplicar Avisos

**Definição do risco:** Supervisor usa Mensagem para comunicar mudança operacional sem criar Aviso formal ("Só para avisar que o show de amanhã mudou de horário").

**Mitigações arquiteturais:**
- A regra é estrutural e explícita: comunicação que muda estado oficial → Aviso
- A IA deve detectar esse padrão e sugerir a criação de Aviso
- A Mensagem não gera o estado de confirmação formal — o Supervisor que comunicar via Mensagem não tem rastreamento de quem recebeu

**Risco residual:** alto sem enforcement ativo. Esta é a maior ameaça à integridade do canal. O único enforcement real é a IA sugerindo o canal correto e o treinamento de uso. Não há como bloquear tecnicamente uma Mensagem que diz "o show mudou de horário" — apenas educar.

---

### Risco: duplicar Solicitações

**Definição do risco:** Membro usa Mensagem para fazer pedidos informais que são aceitos ou negados via Mensagem, sem criar Solicitação formal.

**Mitigações arquiteturais:**
- A IA detecta: "Parece que você está fazendo um pedido. Deseja criar uma Solicitação formal?"
- Alinhamento via Mensagem sem Solicitação não gera MO — a mudança operacional não existe formalmente
- O Supervisor que aceitar um pedido informal via Mensagem precisa criar a MO manualmente ou via Solicitação — senão a mudança não chega à Escala

**Risco residual:** médio. O Supervisor pode informalmente aceitar um pedido e depois esquecer de formalizar. A IA deve alertar o Supervisor quando detecta um alinhamento que sugere uma decisão operacional sem Solicitação associada.

---

### Risco: virar canal social

**Definição do risco:** membros começam a comentar sobre suas vidas, fazer piadas, criar dinâmicas de grupo não operacionais.

**Mitigações arquiteturais:**
- Membro → Membro proibido (elimina o principal vetor)
- Sem grupos de interesse, sem canais temáticos, sem feeds

**Risco residual:** baixo no MVP dada a proibição de comunicação horizontal.

---

### Risco: gerar ruído operacional

**Definição do risco:** Supervisores recebem volume alto de mensagens de membros simultaneamente, sem sistema de priorização, e deixam de responder mensagens operacionalmente urgentes.

**Mitigações arquiteturais:**
- Mensagens contextuais têm visibilidade da entidade vinculada — Supervisor vê "Carlos · Sobre a Solicitação de Folga de amanhã" e prioriza imediatamente
- A IA do Supervisor alerta sobre mensagens não respondidas com urgência operacional
- Mensagens Livres aparecem com menor destaque que Mensagens contextuais

**Risco residual:** médio em operações com 30+ membros por Supervisor. A priorização da IA é o principal mecanismo de mitigação — e depende de A-05 (modo degradado da IA) estar resolvido.

---

## PARTE 10 — DECISÕES FORMAIS

---

### MSG-D01 — Definição oficial de S-09

S-09 Mensagens é o canal de esclarecimento e coordenação contextual do MyASA. Não é broadcast, não é pedido formal, não é atribuição de tarefa e não é substituto para nenhuma dessas superfícies. Existe para preencher o espaço conversacional entre os processos formais.

---

### MSG-D02 — Mensagem não é canal oficial de mudança operacional

Nenhuma mudança operacional é oficializada via Mensagem. A Mensagem pode comunicar informalmente, mas o efeito operacional só existe quando a mudança é formalizada via Solicitação, MO ou Aviso. Mensagem que comunica mudança de estado oficial sem o processo formal correspondente é uma falha de processo — não uma alternativa válida.

---

### MSG-D03 — Membro → Membro proibido no MVP

Toda comunicação operacional de Membros passa pelo Supervisor. Comunicação horizontal entre Membros não existe em S-09 no MVP. Isso protege a arquitetura de comunicação e impede a formação de canais paralelos não supervisionados.

---

### MSG-D04 — Imutabilidade total

Uma Mensagem enviada não pode ser editada, deletada ou arquivada pelo remetente. A imutabilidade é proteção operacional: alinhamentos, coordenações e esclarecimentos precisam ser rastreáveis exatamente como aconteceram. Não existe "apagar para mim" ou "apagar para todos."

---

### MSG-D05 — Mensagem contextual é arquivada com sua entidade de origem

Quando uma Solicitação, MO, Entrega, Aviso ou qualquer outra entidade operacional é encerrada, a Mensagem contextual vinculada a ela é arquivada junto. Não é deletada. Permanece acessível como contexto histórico da entidade no Histórico.

---

### MSG-D06 — A IA não é participante de Mensagens

A IA não envia, responde ou inicia Mensagens como participante. Atua exclusivamente como assistente contextual do usuário ativo: resume, contextualiza, alerta sobre não-respostas e sugere o canal correto quando detecta padrão de pedido informal ou comunicação oficial feita pelo canal errado. Toda intervenção da IA é identificada explicitamente como IA — nunca como outro usuário.

---

### MSG-D07 — Supervisor → Grupo é coordenação, não Aviso

Mensagens de Supervisor para o Grupo existem para coordenação operacional. Não substituem Avisos. Uma Mensagem de Grupo não gera confirmação formal de leitura, não é imutável como comunicação oficial e não é registrada como documento operacional. Comunicação que exige confirmação ou que muda estado oficial → Aviso.

---

### MSG-D08 — Mensagem contextual entra no Histórico como contexto narrativo

Quando uma Mensagem está vinculada a uma entidade operacional que gera evento no Histórico, a Mensagem é incluída como contexto narrativo desse evento. O Admin que investiga o Histórico de uma Solicitação complex pode ver a conversa que aconteceu durante o processo — não apenas os estados formais.

---

### MSG-D09 — Mensagem livre existe apenas nos canais autorizados

Mensagem Livre (sem vínculo a uma entidade operacional) é permitida apenas nos canais:
- Membro ↔ Supervisor
- Admin ↔ Supervisor
- Supervisor ↔ Supervisor (somente para coordenação de cobertura)

Não existe Mensagem Livre de broadcast, não existe Mensagem Livre para grupos, não existe Mensagem Livre de Admin para a organização.

---

### MSG-D10 — Admin → Organização não existe como Mensagem

Comunicação do Admin para toda a organização é um Aviso — sempre. Não existe tipo de Mensagem que alcance toda a organização ou toda uma Operação. Qualquer tentativa de criar esse tipo de Mensagem deve ser redirecionada para S-08.

---

## VEREDITO

### 🟢 S-09 Mensagens — pronta para UX

S-09 Mensagens tem:
- Problema operacional definido (o esclarecimento e a coordenação que não têm canal formal)
- Definição oficial que não se confunde com nenhuma outra superfície
- Fronteiras formais com Avisos, Solicitações, Entregas, IA e Histórico
- Matriz de permissões completa (quem pode falar com quem e por quê)
- Tipos de conversa classificados (MVP / Pós-MVP / Nunca)
- Modelo de contexto (contextual vs. livre)
- Regras de persistência e arquivamento
- Comportamento da IA com limites explícitos
- 8 casos limite modelados
- Auditoria de riscos com mitigações e riscos residuais avaliados
- 10 decisões formais (MSG-D01 a MSG-D10)

---

## Resposta à pergunta final

**"Após esta modelagem, existe alguma superfície principal do MyASA sem fundação comportamental formal?"**

**Não.**

| Superfície | Status |
|---|---|
| S-01 Meu Dia | ✅ Wireframe estrutural completo (963 linhas) + definição no mapa de superfícies |
| S-02 Painel Operacional | ✅ Wireframe estrutural completo + definição no mapa de superfícies |
| S-03 Painel de Saúde | ✅ Fundação comportamental na Governança |
| S-04 Escala | ✅ Fundação comportamental completa + mockup |
| S-05 Livro do Dia | ✅ Fundação no Ciclo de Comunicação (1400 linhas) |
| S-06 Solicitações | ✅ Fundação comportamental completa + mockup |
| S-07 Entregas | ✅ Fundação produzida · Divergência conceitual pendente de decisão do PO (A-01) |
| S-08 Avisos | ✅ Fundação no Ciclo de Comunicação |
| S-09 Mensagens | ✅ Este documento |
| S-10 IA | ✅ Ecossistema completo (3 contextos + 10 decisões) |
| S-11 Histórico | ✅ Fundação no Ciclo de Comunicação |
| S-12 Agenda | ✅ Fundação comportamental completa |
| S-13 Livro do Show | ✅ 3 documentos + wireframes |
| S-14 Biblioteca | ✅ Fundação comportamental completa |
| S-15 Equipes | ✅ Fundação na Governança |
| S-16 Operações | ✅ Fundação na Governança |
| S-17 Administração | ✅ Fundação na Governança |

**O único item estruturalmente pendente antes do UX global é A-01: a decisão de qual modelo vai para o MVP de S-07 Entregas — gestão de tarefas com avaliação ou compliance de conteúdo obrigatório.** Essa é uma decisão de produto de responsabilidade do Product Owner, não uma lacuna de modelagem.

**A arquitetura funcional do MyASA 2.0 está completa.**

---

*Fundação produzida em 18/06/2026 — MyASA 2.0*
*10 decisões formais — MSG-D01 a MSG-D10*
*Total acumulado: 131 decisões formais de produto*
